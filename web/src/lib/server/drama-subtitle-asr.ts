import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { cpus } from "node:os";
import { join } from "node:path";

import { getAuthSettings, refundUserPoints } from "@/lib/auth/store";
import { allocateDramaSubtitleWindow, dramaSubtitleLayout, planDramaSubtitleSources, splitDramaSubtitleText, type DramaSubtitleCue, type DramaSubtitleExportMode, type DramaSubtitleSource } from "@/lib/drama-subtitle-plan";
import { runFfmpeg } from "@/lib/server/ffmpeg";
import { resolveTextPlanningModelCandidates } from "@/lib/server/logical-model-router";
import { hasSystemAiCharge, readSystemAiBilling, systemAiBillingHeaders, systemAiIdempotencyKey } from "@/lib/server/system-ai-billing";
import { rankTextPlanningCandidates, requestStructuredText } from "@/lib/server/text-planning-runtime";

const DEFAULT_WHISPER_CLI = "/app/whisper/whisper-cli";
const DEFAULT_WHISPER_MODEL = "/app/whisper/models/ggml-base.bin";
const ASR_TIMEOUT_MS = 10 * 60_000;
const EXTRACT_TIMEOUT_MS = 5 * 60_000;
const SILENCE_TIMEOUT_MS = 2 * 60_000;
const BURST_ASR_TIMEOUT_MS = 2 * 60_000;
const MIN_OVERLAP_MS = 100;
const MIN_OVERLAP_RATIO = 0.15;
// 对齐代价：逐区间单独识别的文本与台词句的词重合误差权重，以及可容忍的最大时长误差（秒）。
// 文本重合是主信号（背景音乐/停顿让 Whisper token 时间轴漂移，但逐区间的识别文本顺序稳定）；
// 识别出的文本没有对应发声区间的句子按罚金空着，不抢真实语音的窗口。
const ALIGN_TEXT_WEIGHT = 3;
// 单独识别的短区间文本证据不足：词数少于该值时按比例降低文本权重，让时长信号主导短句对齐。
const MIN_TEXT_EVIDENCE_WORDS = 3;
const MAX_DURATION_ERROR_S = 1.5;
const EMPTY_ALIGNMENT_COST = 1.2;
// 可读性：短句（如 "What?"）说完后字幕继续停留一小段，但不越过下一句起点，也不超过一个短尾巴。
const MIN_CUE_DISPLAY_MS = 1_000;
const MAX_CUE_TAIL_MS = 800;
const CUE_TAIL_GAP_MS = 60;
const SCRIPT_COVERAGE = 0.8;
const ASR_COVERAGE = 0.75;
const FALLBACK_SCRIPT_COVERAGE = 0.5;
const FALLBACK_ASR_COVERAGE = 0.5;
const MAX_MATCH_SEGMENTS = 3;

export type DramaSubtitleTranscriptSegment = {
    startMs: number;
    endMs: number;
    text: string;
};

export type DramaSubtitleSpeechInterval = {
    startMs: number;
    endMs: number;
};

/** 单独识别过的有声区间：text 是该区间内识别出的语音文本（识别失败时为空串，仅按时长兜底对齐）。 */
export type DramaSubtitleSpeechBurst = DramaSubtitleSpeechInterval & { text: string };

export type DramaSubtitleChunk = {
    text: string;
    startMs: number;
    endMs: number;
};

export class DramaSubtitleAsrError extends Error {
    constructor(
        message: string,
        readonly status = 502,
    ) {
        super(message);
        this.name = "DramaSubtitleAsrError";
    }
}

/** 只有二进制和模型都就绪时才允许进入字幕导出，避免静默回退到旧的字数估算。 */
export async function dramaSubtitleAsrAvailable() {
    try {
        await Promise.all([access(whisperCliPath(), constants.X_OK), access(whisperModelPath(), constants.R_OK)]);
        return true;
    } catch {
        return false;
    }
}

/**
 * 从实际视频音轨识别台词。时间轴只取 Whisper 的真实语音段，并用静音检测去掉段首尾的空白，
 * 不再按剧本字数把整段视频平均铺满。
 */
export async function transcribeDramaSubtitleVideo(input: { sourcePath: string; workdir: string; durationMs: number; audioCodec?: string; signal?: AbortSignal }): Promise<DramaSubtitleTranscriptSegment[]> {
    if (!input.audioCodec) return [];
    const wavPath = join(input.workdir, "subtitle-audio.wav");
    await runFfmpeg(["-y", "-i", input.sourcePath, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", wavPath], {
        cwd: input.workdir,
        signal: input.signal,
        timeoutMs: EXTRACT_TIMEOUT_MS,
    });
    const silence = await runFfmpeg(["-hide_banner", "-nostats", "-i", wavPath, "-af", "silencedetect=noise=-35dB:d=0.2", "-f", "null", "-"], {
        cwd: input.workdir,
        signal: input.signal,
        timeoutMs: SILENCE_TIMEOUT_MS,
    });
    const speechIntervals = parseDramaSilenceIntervals(silence.stderr, input.durationMs);
    if (!speechIntervals.length) return [];

    const outputBase = join(input.workdir, "subtitle-asr");
    await runWhisperCli(["-m", whisperModelPath(), "-f", wavPath, "-l", "en", "-ojf", "-of", outputBase, "-t", String(whisperThreads())], {
        cwd: input.workdir,
        signal: input.signal,
        timeoutMs: ASR_TIMEOUT_MS,
    });
    const payload = JSON.parse(await readFile(`${outputBase}.json`, "utf8"));
    const segments = parseDramaWhisperTranscript(payload, input.durationMs);
    // Whisper 的 token 时间轴在背景音乐/混响下会整体漂移（实测把首句台词提前到音乐起点、句尾拖进静音）；
    // 先逐个有声区间单独识别确认真实语音，再把台词句整段对齐到这些真实发声区间。
    const bursts = await detectDramaSpeechBursts(speechIntervals, { wavPath, workdir: input.workdir, signal: input.signal });
    return alignDramaTranscriptSegments(segments, bursts);
}

/** 先按真实语音段拆句并分配时间，再逐句翻译，保证英文和中文 cue 一一对应。 */
export function buildDramaSubtitleChunks(segments: DramaSubtitleTranscriptSegment[], width: number, height: number): DramaSubtitleChunk[] {
    const layout = dramaSubtitleLayout(width, height);
    return segments.flatMap((segment) => {
        const chunks = splitDramaSubtitleText(segment.text, layout.maxCharsPerCue);
        if (!chunks.length) return [];
        return allocateDramaSubtitleWindow(chunks, segment.startMs, segment.endMs);
    });
}

export function buildDramaSubtitleSources(chunks: DramaSubtitleChunk[], translations?: string[]): DramaSubtitleSource[] {
    return chunks.map((chunk, index) => {
        const translation = (translations?.[index] || "").trim();
        return {
            text: chunk.text,
            hasEnglish: true,
            startMs: chunk.startMs,
            endMs: chunk.endMs,
            ...(translation ? { translation } : {}),
        };
    });
}

/** 字幕导出统一入口：实际音频识别 -> 匹配剧本台词 -> 双语翻译 -> 最终 cue。 */
export async function resolveDramaSubtitleSources(input: {
    sourcePath: string;
    workdir: string;
    durationMs: number;
    width: number;
    height: number;
    mode: DramaSubtitleExportMode;
    audioCodec?: string;
    origin: string;
    cookie: string;
    userId: string;
    projectId: string;
    shotId: string;
    videoId: string;
    signal?: AbortSignal;
    scriptSources?: DramaSubtitleSource[];
}): Promise<DramaSubtitleSource[]> {
    const segments = await transcribeDramaSubtitleVideo(input);
    if (!segments.length) return [];
    const sources = alignDramaSubtitleSources(segments, input.scriptSources || []);
    if (input.mode !== "bilingual") return sources;
    // 剧本已经提供中文翻译时，不再走文本模型：字幕文案、翻译和时间轴都来自剧本与真实语音段。
    if (dramaScriptHasSubtitleTranslations(input.scriptSources)) return sources;
    const untranslated = sources.filter((source) => !source.translation);
    if (!untranslated.length) return sources;
    try {
        const translations = await translateDramaSubtitleChunks({ ...input, chunks: untranslated.map((source) => source.text) });
        if (translations.length !== untranslated.length) throw new DramaSubtitleAsrError("默认文本模型返回的逐句翻译数量不匹配，请稍后重试", 502);
        translations.forEach((translation, index) => {
            untranslated[index].translation = translation;
        });
    } catch (error) {
        // 翻译失败时保留 ASR 的真实时间轴：未翻译的句子只显示英文，不能再把整份剧本按字数铺满全片。
        console.warn("drama subtitle translation failed, keeping ASR timing", error);
    }
    return sources;
}

/** 剧本是否自带中文翻译；有翻译时字幕不再请求文本模型，避免模型改写或额外计费。 */
export function dramaScriptHasSubtitleTranslations(scriptSources: DramaSubtitleSource[] | undefined) {
    return Boolean(scriptSources?.some((source) => source.hasEnglish && Boolean((source.translation || "").trim())));
}

/**
 * 把 Whisper 语音段对齐回剧本台词：
 * 先用高覆盖率匹配常规台词，再用较低覆盖率承接实际发音和剧本措辞不同的台词；
 * 命中后复用剧本英文与中文，并按每个真实语音段的语音占比拆分，每个语音段保留自己的起止时间。
 * 没有出现在音频里的剧本台词（例如未配音的心声）不会进入字幕；完全未匹配的语音段保留 ASR 原文。
 */
export function alignDramaSubtitleSources(segments: DramaSubtitleTranscriptSegment[], scriptSources: DramaSubtitleSource[]): DramaSubtitleSource[] {
    const candidates = scriptSources.filter((source) => source.hasEnglish && Boolean(source.text.trim()));
    const candidateWords = candidates.map((source) => matchWords(source.text));
    const used = new Set<number>();
    const aligned: DramaSubtitleSource[] = [];
    let cursor = 0;
    let lastUsedIndex = -1;
    while (cursor < segments.length) {
        const matched = findScriptMatch(segments, cursor, candidateWords, used, lastUsedIndex, SCRIPT_COVERAGE, ASR_COVERAGE) ?? findScriptMatch(segments, cursor, candidateWords, used, lastUsedIndex, FALLBACK_SCRIPT_COVERAGE, FALLBACK_ASR_COVERAGE);
        if (!matched) {
            const segment = segments[cursor];
            aligned.push({ text: segment.text, hasEnglish: true, startMs: segment.startMs, endMs: segment.endMs });
            cursor += 1;
            continue;
        }

        used.add(matched.index);
        lastUsedIndex = matched.index;
        const source = candidates[matched.index];
        const text = source.text.trim();
        const translation = (source.translation || "").trim();
        const group = segments.slice(cursor, cursor + matched.size);
        const textParts = splitAlignedText(text, group);
        const translationParts = translation ? splitAlignedText(translation, group) : [];
        const canSplit = textParts.length === group.length && (!translation || translationParts.length === group.length);
        if (!canSplit) {
            // 句内标点不足以拆成每个语音段时，合并为一个覆盖整组语音窗口的字幕源，避免把单词拆断。
            aligned.push({
                text,
                hasEnglish: true,
                startMs: group[0].startMs,
                endMs: group[group.length - 1].endMs,
                ...(translation ? { translation } : {}),
            });
        } else {
            for (let offset = 0; offset < group.length; offset += 1) {
                const segment = group[offset];
                const part = textParts[offset] || "";
                const translated = translationParts[offset] || "";
                aligned.push({
                    text: part,
                    hasEnglish: true,
                    startMs: segment.startMs,
                    endMs: segment.endMs,
                    ...(translated ? { translation: translated } : {}),
                });
            }
        }
        cursor += matched.size;
    }
    return aligned;
}

type ScriptMatch = {
    index: number;
    size: number;
};

/** 只在已使用台词之后找匹配，保证剧本顺序；高覆盖率找不到时再放宽到低覆盖率。 */
function findScriptMatch(segments: DramaSubtitleTranscriptSegment[], cursor: number, candidateWords: string[][], used: Set<number>, afterIndex: number, minScriptCoverage: number, minAsrCoverage: number): ScriptMatch | undefined {
    for (let size = 1; size <= MAX_MATCH_SEGMENTS && cursor + size <= segments.length; size += 1) {
        const words = matchWords(
            segments
                .slice(cursor, cursor + size)
                .map((segment) => segment.text)
                .join(" "),
        );
        if (!words.length) continue;
        let bestIndex = -1;
        let bestDice = 0;
        for (let index = afterIndex + 1; index < candidateWords.length; index += 1) {
            if (used.has(index)) continue;
            const candidate = candidateWords[index];
            if (!candidate.length) continue;
            const shared = sharedWordCount(words, candidate);
            const scriptCoverage = shared / candidate.length;
            const asrCoverage = shared / words.length;
            if (scriptCoverage < minScriptCoverage || asrCoverage < minAsrCoverage) continue;
            const dice = (2 * shared) / (words.length + candidate.length);
            if (dice > bestDice) {
                bestDice = dice;
                bestIndex = index;
            }
        }
        if (bestIndex >= 0) return { index: bestIndex, size };
    }
    return undefined;
}

/** 多重集合交集，避免 ASR 重复词把覆盖率算到大于 1。 */
function sharedWordCount(words: string[], candidate: string[]) {
    const remaining = new Map<string, number>();
    for (const word of candidate) remaining.set(word, (remaining.get(word) || 0) + 1);
    let shared = 0;
    for (const word of words) {
        const count = remaining.get(word) || 0;
        if (!count) continue;
        shared += 1;
        remaining.set(word, count - 1);
    }
    return shared;
}

/**
 * 用剧本原文和翻译按真实语音段拆分：句内标点足够时按标点和语音词数比例分组；
 * 不足时返回整条文本，由调用方合并为一个语音窗口，避免拆断单词或把翻译错配到空段。
 */
function splitAlignedText(value: string, segments: DramaSubtitleTranscriptSegment[]) {
    const text = value.trim();
    const count = Math.max(1, segments.length);
    if (!text) return count === 1 ? [""] : [];
    if (count === 1) return [text];
    const atoms = text
        .split(/(?<=[。！？!?；;，,、：:.…])/u)
        .map((item) => item.trim())
        .filter(Boolean);
    if (atoms.length < count) return [text];
    return splitAlignedAtoms(atoms, count, alignedSegmentTargets(segments));
}

/** 以 ASR 真实词数作为每个语音段应占的比例；最后一段承接剩余部分。 */
function alignedSegmentTargets(segments: DramaSubtitleTranscriptSegment[]) {
    const weights = segments.map((segment) => Math.max(1, matchWords(segment.text).length));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let cursor = 0;
    return weights.slice(0, -1).map((weight) => {
        cursor += weight;
        return cursor / total;
    });
}

/** 枚举所有可能的分句边界，选累计文本占比最接近真实语音占比的一组。 */
function splitAlignedAtoms(atoms: string[], count: number, targets: number[]) {
    const weights = atoms.map(alignedTextWeight);
    const total = weights.reduce((sum, value) => sum + value, 0) || atoms.length;
    let cursor = 0;
    const prefixes = weights.map((weight) => {
        cursor += weight;
        return cursor / total;
    });
    let bestPath: number[] | undefined;
    let bestError = Number.POSITIVE_INFINITY;
    const choose = (start: number, path: number[]) => {
        if (path.length === count - 1) {
            const error = path.reduce((sum, boundary, index) => sum + Math.abs(prefixes[boundary - 1] - targets[index]), 0);
            if (error < bestError) {
                bestError = error;
                bestPath = [...path];
            }
            return;
        }
        const remainingParts = count - path.length - 1;
        const maxBoundary = atoms.length - remainingParts;
        for (let boundary = start + 1; boundary <= maxBoundary; boundary += 1) {
            choose(boundary, [...path, boundary]);
        }
    };
    choose(0, []);
    if (!bestPath) return [atoms.join("")];
    const parts: string[] = [];
    let start = 0;
    for (const boundary of bestPath) {
        parts.push(joinAlignedAtoms(atoms.slice(start, boundary)));
        start = boundary;
    }
    parts.push(joinAlignedAtoms(atoms.slice(start)));
    return parts;
}

function alignedTextWeight(value: string) {
    const text = value.trim();
    if (!text) return 0;
    if (/[\u3400-\u9fff]/u.test(text)) return Array.from(text.replace(/\s+/gu, "")).length;
    return text.split(/\s+/u).filter(Boolean).length;
}

function joinAlignedAtoms(atoms: string[]) {
    return atoms.reduce((current, atom) => {
        if (!current) return atom;
        const left = current.slice(-1);
        const right = atom.slice(0, 1);
        const latin = /[A-Za-z]/u.test(current + atom);
        return latin && /[A-Za-z0-9,.;:!?)]/u.test(left) && /[A-Za-z0-9(]/u.test(right) ? `${current} ${atom}` : `${current}${atom}`;
    }, "");
}

function matchWords(value: string) {
    return value
        .toLowerCase()
        .replace(/[\p{P}\p{S}]+/gu, " ")
        .split(/\s+/u)
        .map((word) => word.trim())
        .filter(Boolean);
}

export async function planDramaSubtitlesFromVideo(input: Parameters<typeof resolveDramaSubtitleSources>[0]): Promise<DramaSubtitleCue[]> {
    const sources = await resolveDramaSubtitleSources(input);
    return planDramaSubtitleSources(sources, input.durationMs, input.width, input.height, input.mode);
}

/** 解析 ffmpeg silencedetect 输出，返回实际有声区间；无输出时视为整段都有声。 */
export function parseDramaSilenceIntervals(stderr: string, durationMs: number): DramaSubtitleSpeechInterval[] {
    const totalMs = Math.max(0, Math.round(durationMs));
    if (!totalMs) return [];
    const silences: Array<{ startMs: number; endMs: number }> = [];
    let pendingStart: number | undefined;
    for (const line of stderr.split(/\r?\n/u)) {
        const start = line.match(/silence_start:\s*([0-9.]+)/u);
        if (start) {
            pendingStart = Math.max(0, Math.min(totalMs, Math.round(Number(start[1]) * 1_000)));
            continue;
        }
        const end = line.match(/silence_end:\s*([0-9.]+)/u);
        if (!end) continue;
        const endMs = Math.max(0, Math.min(totalMs, Math.round(Number(end[1]) * 1_000)));
        silences.push({ startMs: pendingStart ?? 0, endMs });
        pendingStart = undefined;
    }
    const intervals: DramaSubtitleSpeechInterval[] = [];
    let cursor = 0;
    for (const silence of silences) {
        if (silence.startMs > cursor) intervals.push({ startMs: cursor, endMs: silence.startMs });
        cursor = Math.max(cursor, silence.endMs);
    }
    if (cursor < totalMs) intervals.push({ startMs: cursor, endMs: totalMs });
    return intervals.filter((interval) => interval.endMs - interval.startMs >= 50);
}

/** 读取 Whisper JSON 的语音段；优先使用真实 token 边界，避免整段视频从 0 秒开始显示字幕。 */
export function parseDramaWhisperTranscript(payload: unknown, durationMs: number): DramaSubtitleTranscriptSegment[] {
    const totalMs = Math.max(0, Math.round(durationMs));
    const transcription = isRecord(payload) && Array.isArray(payload.transcription) ? payload.transcription : [];
    const segments: DramaSubtitleTranscriptSegment[] = [];
    for (const row of transcription) {
        if (!isRecord(row)) continue;
        const text = cleanWhisperText(row.text);
        if (!text) continue;
        const offsets = isRecord(row.offsets) ? row.offsets : {};
        const segmentStart = numberValue(offsets.from);
        const segmentEnd = numberValue(offsets.to);
        const tokens = Array.isArray(row.tokens) ? row.tokens : [];
        const tokenOffsets = tokens.flatMap((token) => {
            if (!isRecord(token) || !isRecord(token.offsets)) return [];
            const value = numberValue(token.offsets.from);
            const end = numberValue(token.offsets.to);
            if (value === undefined || end === undefined || end <= value) return [];
            if (typeof token.text === "string" && /^\[_[^\]]+\]$/u.test(token.text.trim())) return [];
            return [{ startMs: value, endMs: end }];
        });
        const startMs = Math.max(0, Math.min(totalMs, Math.round(tokenOffsets[0]?.startMs ?? segmentStart ?? 0)));
        const endMs = Math.max(startMs, Math.min(totalMs, Math.round(tokenOffsets[tokenOffsets.length - 1]?.endMs ?? segmentEnd ?? startMs)));
        if (endMs - startMs < 120) continue;
        segments.push({ startMs, endMs, text });
    }
    return segments;
}

/** 去掉 Whisper 在静音或段落边界产生的空白/噪声段，并把段首段尾贴回真实语音区间。 */
export function refineDramaTranscriptSegments(segments: DramaSubtitleTranscriptSegment[], speechIntervals: DramaSubtitleSpeechInterval[]): DramaSubtitleTranscriptSegment[] {
    const refined: DramaSubtitleTranscriptSegment[] = [];
    let cursor = 0;
    for (const segment of [...segments].sort((left, right) => left.startMs - right.startMs)) {
        const startMs = Math.max(cursor, segment.startMs);
        const endMs = Math.max(startMs, segment.endMs);
        const overlapping = speechIntervals.filter((interval) => interval.startMs < endMs && interval.endMs > startMs);
        if (!overlapping.length) continue;
        const overlapMs = overlapping.reduce((sum, interval) => sum + Math.max(0, Math.min(endMs, interval.endMs) - Math.max(startMs, interval.startMs)), 0);
        if (overlapMs < MIN_OVERLAP_MS || overlapMs < (endMs - startMs) * MIN_OVERLAP_RATIO) continue;
        const first = overlapping[0];
        const last = overlapping[overlapping.length - 1];
        const snappedStart = startMs < first.startMs ? first.startMs : startMs;
        const snappedEnd = endMs > last.endMs ? last.endMs : endMs;
        if (snappedEnd - snappedStart < 120) continue;
        refined.push({ startMs: snappedStart, endMs: snappedEnd, text: segment.text });
        cursor = snappedEnd + 20;
    }
    return refined;
}

/** 把台词句整段对齐到已确认有语音的区间；没有可用区间时退回旧的贴边逻辑。 */
export function alignDramaTranscriptSegments(segments: DramaSubtitleTranscriptSegment[], bursts: DramaSubtitleSpeechBurst[]): DramaSubtitleTranscriptSegment[] {
    if (!segments.length || !bursts.length) return refineDramaTranscriptSegments(segments, bursts);
    const ordered = [...segments].sort((left, right) => left.startMs - right.startMs);
    const segmentWords = ordered.map((segment) => matchWords(segment.text));
    const burstWords = bursts.map((burst) => matchWords(burst.text));
    const durations = bursts.map((burst) => (burst.endMs - burst.startMs) / 1_000);
    // 每个字/词的期望发声时长，作为文本重合度之外的第二信号。
    const scale = durations.reduce((sum, value) => sum + value, 0) / segmentWords.reduce((sum, words) => sum + Math.max(1, words.length), 0);
    const segmentCount = ordered.length;
    const burstCount = bursts.length;
    // dp[i][j]：前 i 句消费前 j 个发声区间的最小代价；from 记录第 i 句占用的起始区间。
    // 一句可以吞下连续多个区间（一句台词被停顿切开），代价 = 文本重合误差 + 时长误差；
    // 短区间的单独识别文本经常是噪声（如 "What?" 被识别成 "one."），词越少文本证据权重越低、时长权重相对越高；
    // 没有任何匹配的句子宁可空着（罚金），把区间让给真正对应的台词。
    const best: number[][] = Array.from({ length: segmentCount + 1 }, () => new Array<number>(burstCount + 1).fill(Number.POSITIVE_INFINITY));
    const from: number[][] = Array.from({ length: segmentCount + 1 }, () => new Array<number>(burstCount + 1).fill(0));
    best[0][0] = 0;
    for (let i = 0; i < segmentCount; i += 1) {
        const expected = Math.max(1, segmentWords[i].length) * scale;
        const words = segmentWords[i];
        for (let j = 0; j <= burstCount; j += 1) {
            const base = best[i][j];
            if (!Number.isFinite(base)) continue;
            if (base + EMPTY_ALIGNMENT_COST < best[i + 1][j]) {
                best[i + 1][j] = base + EMPTY_ALIGNMENT_COST;
                from[i + 1][j] = j;
            }
            const group: string[] = [];
            let duration = 0;
            const maxK = Math.min(burstCount, j + MAX_MATCH_SEGMENTS);
            for (let k = j; k < maxK; k += 1) {
                group.push(...burstWords[k]);
                duration += durations[k];
                const shared = sharedWordCount(group, words);
                const dice = group.length + words.length ? (2 * shared) / (group.length + words.length) : 0;
                const textWeight = ALIGN_TEXT_WEIGHT * Math.min(1, group.length / MIN_TEXT_EVIDENCE_WORDS);
                const cost = base + (1 - dice) * textWeight + Math.min(Math.abs(duration - expected), MAX_DURATION_ERROR_S);
                if (cost < best[i + 1][k + 1]) {
                    best[i + 1][k + 1] = cost;
                    from[i + 1][k + 1] = j;
                }
            }
        }
    }
    const starts = new Array<number>(segmentCount + 1).fill(burstCount);
    for (let i = segmentCount; i > 0; i -= 1) starts[i - 1] = from[i][starts[i]];
    const windows = ordered.map((_, index) => {
        const start = starts[index];
        const end = starts[index + 1];
        return start < end ? { startMs: bursts[start].startMs, endMs: bursts[end - 1].endMs } : undefined;
    });
    // 连续没有分到区间的句子（静音检测没切开连续语流）按字数借用相邻窗口切开，保证台词不丢。
    for (let index = 0; index < segmentCount; index += 1) {
        if (windows[index]) continue;
        let stop = index;
        while (stop < segmentCount && !windows[stop]) stop += 1;
        const borrowNext = stop < segmentCount;
        const sourceIndex = borrowNext ? stop : index - 1;
        const window = windows[sourceIndex];
        if (!window) return refineDramaTranscriptSegments(segments, bursts);
        const members: number[] = [];
        if (borrowNext) {
            for (let cursor = index; cursor <= stop; cursor += 1) members.push(cursor);
        } else {
            members.push(sourceIndex);
            for (let cursor = index; cursor < stop; cursor += 1) members.push(cursor);
        }
        const slices = sliceAlignedWindow(
            window,
            members.map((member) => Math.max(1, segmentWords[member].length)),
        );
        members.forEach((member, offset) => {
            windows[member] = slices[offset];
        });
    }
    return extendAlignedCueWindows(ordered.map((segment, index) => ({ startMs: windows[index]!.startMs, endMs: windows[index]!.endMs, text: segment.text })));
}

/** 按逐区间识别文本过滤有声区间；undefined 表示该区间识别失败，保守保留，宁可多显示也不丢对白。 */
export function filterDramaSpeechBursts(intervals: DramaSubtitleSpeechInterval[], texts: Array<string | undefined>): DramaSubtitleSpeechBurst[] {
    const bursts: DramaSubtitleSpeechBurst[] = [];
    intervals.forEach((interval, index) => {
        const raw = texts[index];
        if (raw === undefined) {
            bursts.push({ ...interval, text: "" });
            return;
        }
        const text = cleanWhisperText(raw);
        if (text) bursts.push({ ...interval, text });
    });
    return bursts;
}

/**
 * 逐个有声区间单独送一次识别：背景音乐、环境音在能量检测里与语音不可区分，
 * 但单独识别时返回空文本，可以放心剔除，避免字幕在没人说话的音乐段出现。
 */
async function detectDramaSpeechBursts(intervals: DramaSubtitleSpeechInterval[], context: { wavPath: string; workdir: string; signal?: AbortSignal }): Promise<DramaSubtitleSpeechBurst[]> {
    const texts: Array<string | undefined> = [];
    for (const [index, interval] of intervals.entries()) {
        const slicePath = join(context.workdir, `subtitle-burst-${index}.wav`);
        const outputBase = join(context.workdir, `subtitle-burst-${index}`);
        try {
            await runFfmpeg(["-y", "-ss", (interval.startMs / 1_000).toFixed(3), "-i", context.wavPath, "-t", ((interval.endMs - interval.startMs) / 1_000).toFixed(3), slicePath], {
                cwd: context.workdir,
                signal: context.signal,
                timeoutMs: EXTRACT_TIMEOUT_MS,
            });
            await runWhisperCli(["-m", whisperModelPath(), "-f", slicePath, "-l", "en", "-ojf", "-of", outputBase, "-t", String(whisperThreads())], {
                cwd: context.workdir,
                signal: context.signal,
                timeoutMs: BURST_ASR_TIMEOUT_MS,
            });
            const payload = JSON.parse(await readFile(`${outputBase}.json`, "utf8")) as unknown;
            const rows = isRecord(payload) && Array.isArray(payload.transcription) ? payload.transcription : [];
            texts.push(
                rows
                    .map((row) => (isRecord(row) ? cleanWhisperText(row.text) : ""))
                    .join(" ")
                    .trim(),
            );
        } catch {
            texts.push(undefined);
        }
    }
    return filterDramaSpeechBursts(intervals, texts);
}

/** 把一个窗口按字数比例切成 N 份；最后一份承接剩余时间。 */
function sliceAlignedWindow(window: { startMs: number; endMs: number }, weights: number[]): Array<{ startMs: number; endMs: number }> {
    const total = weights.reduce((sum, value) => sum + value, 0) || weights.length;
    const slices: Array<{ startMs: number; endMs: number }> = [];
    let start = window.startMs;
    let consumed = 0;
    for (let index = 0; index < weights.length; index += 1) {
        consumed += weights[index];
        const end = index === weights.length - 1 ? window.endMs : Math.min(window.endMs, window.startMs + Math.round(((window.endMs - window.startMs) * consumed) / total));
        slices.push({ startMs: start, endMs: Math.max(start + 1, end) });
        start = end;
    }
    return slices;
}

/** 台词说完了字幕立刻消失会闪现；把窗口尾部延长到可读时长，但不越过下一句、也不超过一个短尾巴。 */
function extendAlignedCueWindows(segments: DramaSubtitleTranscriptSegment[]): DramaSubtitleTranscriptSegment[] {
    return segments.map((segment, index) => {
        const next = segments[index + 1];
        const tailCap = Math.min(segment.endMs + MAX_CUE_TAIL_MS, next ? next.startMs - CUE_TAIL_GAP_MS : Number.POSITIVE_INFINITY);
        const endMs = Math.max(segment.endMs, Math.min(segment.startMs + MIN_CUE_DISPLAY_MS, tailCap));
        return { startMs: segment.startMs, endMs, text: segment.text };
    });
}

/** 把英文 ASR 台词批量翻译成简体中文；输出条数和输入必须完全一致。 */
export async function translateDramaSubtitleChunks(input: { origin: string; cookie: string; userId: string; projectId: string; shotId: string; videoId: string; chunks: string[]; signal?: AbortSignal }): Promise<string[]> {
    const lines = input.chunks.map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const settings = await getAuthSettings();
    const model = settings.defaultModels.textModel;
    const candidates = resolveTextPlanningModelCandidates(settings, model);
    if (!model || !candidates.length) throw new DramaSubtitleAsrError("后台尚未配置可用的默认文本模型，无法生成双语字幕", 503);
    const ranked = rankTextPlanningCandidates(candidates);
    const translations: string[] = [];
    for (const batch of translationBatches(lines)) {
        translations.push(...(await translateDramaSubtitleBatch({ ...input, lines: batch, model, candidates: ranked })));
    }
    return translations;
}

/** 单批台词可以有界地重试：逐条翻译合并相邻台词是常见模型错误，换一次请求身份再试通常能恢复。 */
async function translateDramaSubtitleBatch(input: {
    origin: string;
    cookie: string;
    userId: string;
    projectId: string;
    shotId: string;
    videoId: string;
    lines: string[];
    model: string;
    candidates: ReturnType<typeof rankTextPlanningCandidates>;
    signal?: AbortSignal;
}): Promise<string[]> {
    let latestError: unknown;
    for (const candidate of input.candidates) {
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            const billingModel = candidate.logicalModelId || input.model;
            const idempotencyKey = systemAiIdempotencyKey("drama-subtitle", input.userId, input.projectId, input.shotId, input.videoId, input.lines.join("\0"), billingModel, candidate.channelId, candidate.upstreamModel, `attempt-${attempt}`);
            try {
                const call = await requestStructuredText({
                    origin: input.origin,
                    cookie: input.cookie,
                    candidate,
                    messages: [
                        {
                            role: "system",
                            content: `你是影视短剧字幕翻译。把输入中的英文台词逐条翻译成自然、简洁、可直接作为字幕的简体中文。输入 ${input.lines.length} 条，必须返回 ${input.lines.length} 条译文，逐条一一对应；保留人名、品牌名、数字和金额；不要合并相邻台词、不要拆分、不要解释或添加说话人；每条只返回一个译文，顺序和数量必须与输入完全一致。`,
                        },
                        { role: "user", content: JSON.stringify({ lines: input.lines }) },
                    ],
                    tool: subtitleTranslationTool,
                    headers: {
                        "Content-Type": "application/json",
                        "Idempotency-Key": idempotencyKey,
                        "X-Client-Request-Id": idempotencyKey,
                        ...systemAiBillingHeaders(billingModel, idempotencyKey, candidate.upstreamModel),
                    },
                    signal: input.signal,
                    onInvalidResponse: (headers) => refundInvalidResponse(input.userId, billingModel, headers),
                });
                const translations = parseDramaSubtitleTranslations(call.arguments, input.lines.length);
                if (!translations) {
                    await refundInvalidResponse(input.userId, billingModel, call.headers);
                    latestError = new DramaSubtitleAsrError("默认文本模型没有返回有效的中文字幕翻译", 502);
                    continue;
                }
                return translations;
            } catch (error) {
                latestError = error;
            }
        }
    }
    if (latestError instanceof DramaSubtitleAsrError) throw latestError;
    const detail = latestError instanceof Error && latestError.message.trim() ? `：${latestError.message.trim()}` : "";
    throw new DramaSubtitleAsrError(`默认文本模型没有返回有效的中文字幕翻译${detail}`, 502);
}

function translationBatches(lines: string[]) {
    const batches: string[][] = [];
    for (let index = 0; index < lines.length; index += 8) batches.push(lines.slice(index, index + 8));
    return batches;
}

export function parseDramaSubtitleTranslations(value: string, expectedCount: number): string[] | undefined {
    try {
        const payload = JSON.parse(value) as unknown;
        if (!isRecord(payload) || !Array.isArray(payload.translations)) return undefined;
        if (payload.translations.length !== expectedCount) return undefined;
        const translations = payload.translations.map((item) => (typeof item === "string" ? item.trim() : ""));
        if (translations.some((item) => !item)) return undefined;
        return translations;
    } catch {
        return undefined;
    }
}

function whisperCliPath() {
    return process.env.WHISPER_CLI_PATH?.trim() || DEFAULT_WHISPER_CLI;
}

function whisperModelPath() {
    return process.env.WHISPER_MODEL_PATH?.trim() || DEFAULT_WHISPER_MODEL;
}

function whisperThreads() {
    return Math.max(1, Math.min(4, cpus().length || 1));
}

function cleanWhisperText(value: unknown) {
    if (typeof value !== "string") return "";
    const text = value
        .replace(/\[_[^\]]+\]/gu, "")
        .replace(/\[(?:BLANK_AUDIO|MUSIC|SOUND|NOISE|LAUGHTER|APPLAUSE)\]/giu, "")
        .replace(/\s+/gu, " ")
        .trim();
    return /[\p{L}\p{N}]/u.test(text) ? text : "";
}

function numberValue(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function runWhisperCli(args: string[], options: { cwd?: string; signal?: AbortSignal; timeoutMs: number }) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), options.timeoutMs);
        const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
        // 语音识别与页面请求让路：POSIX 下用 nice 降低调度优先级（与 FFmpeg 一致，nice 会 exec 目标程序，PID 不变，取消/超时信号照常生效）；
        // turbopackIgnore 阻止构建器追踪动态二进制路径导致整个项目被收入 standalone 产物。
        const useNice = process.platform !== "win32";
        const child = spawn(/* turbopackIgnore: true */ useNice ? "nice" : whisperCliPath(), useNice ? ["-n", "15", whisperCliPath(), ...args] : args, {
            cwd: options.cwd,
            signal,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.setEncoding("utf8");
        child.stderr?.setEncoding("utf8");
        child.stdout?.on("data", (chunk: string) => {
            stdout += chunk;
        });
        child.stderr?.on("data", (chunk: string) => {
            stderr += chunk;
        });
        child.on("error", (error) => {
            clearTimeout(timer);
            reject(new DramaSubtitleAsrError(error.name === "AbortError" ? "字幕语音识别超时" : "字幕语音识别组件无法启动", 503));
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) return resolve({ stdout, stderr });
            const detail = stderr.trim().split(/\r?\n/u).slice(-1)[0] || `退出码 ${code}`;
            reject(new DramaSubtitleAsrError(`字幕语音识别失败：${detail}`, 502));
        });
    });
}

async function refundInvalidResponse(userId: string, model: string, headers: Headers) {
    const billing = readSystemAiBilling(headers);
    if (hasSystemAiCharge(billing)) await refundUserPoints(userId, model, billing.pointsCost, "text", 1, undefined, billing.pointsRecordId);
}

const subtitleTranslationTool = {
    name: "translate_drama_subtitles",
    description: "把英文短剧台词逐条翻译成简体中文，并保持输入顺序和条数",
    parameters: {
        type: "object",
        properties: {
            translations: {
                type: "array",
                items: { type: "string", minLength: 1 },
                minItems: 1,
            },
        },
        required: ["translations"],
        additionalProperties: false,
    },
};
