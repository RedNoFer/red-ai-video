import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { cpus } from "node:os";
import { join } from "node:path";

import { getAuthSettings, refundUserPoints } from "@/lib/auth/store";
import { allocateDramaSubtitleWindow, dramaSubtitleLayout, planDramaSubtitleSources, splitDramaSubtitleText, type DramaSubtitleCue, type DramaSubtitleExportMode, type DramaSubtitleSource } from "@/lib/drama-subtitle-plan";
import { runFfmpeg } from "@/lib/server/ffmpeg";
import { resolveLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { hasSystemAiCharge, readSystemAiBilling, systemAiBillingHeaders, systemAiIdempotencyKey } from "@/lib/server/system-ai-billing";
import { rankTextPlanningCandidates, requestStructuredText } from "@/lib/server/text-planning-runtime";

const DEFAULT_WHISPER_CLI = "/app/whisper/whisper-cli";
const DEFAULT_WHISPER_MODEL = "/app/whisper/models/ggml-base.bin";
const ASR_TIMEOUT_MS = 10 * 60_000;
const EXTRACT_TIMEOUT_MS = 5 * 60_000;
const SILENCE_TIMEOUT_MS = 2 * 60_000;
const MIN_OVERLAP_MS = 100;
const MIN_OVERLAP_RATIO = 0.15;

export type DramaSubtitleTranscriptSegment = {
    startMs: number;
    endMs: number;
    text: string;
};

export type DramaSubtitleSpeechInterval = {
    startMs: number;
    endMs: number;
};

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
    return refineDramaTranscriptSegments(segments, speechIntervals);
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

/** 字幕导出统一入口：实际音频识别 -> 拆句 -> 双语翻译 -> 最终 cue。 */
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
}): Promise<DramaSubtitleSource[]> {
    const segments = await transcribeDramaSubtitleVideo(input);
    if (!segments.length) return [];
    const chunks = buildDramaSubtitleChunks(segments, input.width, input.height);
    if (!chunks.length) return [];
    const translations = input.mode === "bilingual" ? await translateDramaSubtitleChunks({ ...input, chunks: chunks.map((chunk) => chunk.text) }) : undefined;
    return buildDramaSubtitleSources(chunks, translations);
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

/** 把英文 ASR 台词批量翻译成简体中文；输出条数和输入必须完全一致。 */
export async function translateDramaSubtitleChunks(input: { origin: string; cookie: string; userId: string; projectId: string; shotId: string; videoId: string; chunks: string[]; signal?: AbortSignal }): Promise<string[]> {
    const lines = input.chunks.map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const settings = await getAuthSettings();
    const model = settings.defaultModels.textModel;
    const candidates = resolveLogicalModelCandidates(settings, "text", model);
    if (!model || !candidates.length) throw new DramaSubtitleAsrError("后台尚未配置可用的默认文本模型，无法生成双语字幕", 503);

    let latestError: unknown;
    for (const candidate of rankTextPlanningCandidates(candidates)) {
        const idempotencyKey = systemAiIdempotencyKey("drama-subtitle", input.userId, input.projectId, input.shotId, input.videoId, lines.join("\0"), candidate.channelId, candidate.upstreamModel);
        try {
            const call = await requestStructuredText({
                origin: input.origin,
                cookie: input.cookie,
                candidate,
                messages: [
                    {
                        role: "system",
                        content: "你是影视短剧字幕翻译。把输入中的英文台词逐条翻译成自然、简洁、可直接作为字幕的简体中文。保留人名、品牌名、数字和金额；不要合并、拆分、解释或添加说话人；每条只返回一个译文，顺序和数量必须与输入完全一致。",
                    },
                    { role: "user", content: JSON.stringify({ lines }) },
                ],
                tool: subtitleTranslationTool,
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotencyKey,
                    "X-Client-Request-Id": idempotencyKey,
                    ...systemAiBillingHeaders(model, idempotencyKey, candidate.upstreamModel),
                },
                signal: input.signal,
                onInvalidResponse: (headers) => refundInvalidResponse(input.userId, model, headers),
            });
            const translations = parseDramaSubtitleTranslations(call.arguments, lines.length);
            if (!translations) {
                await refundInvalidResponse(input.userId, model, call.headers);
                throw new DramaSubtitleAsrError("默认文本模型没有返回有效的中文字幕翻译", 502);
            }
            return translations;
        } catch (error) {
            latestError = error;
        }
    }
    if (latestError instanceof DramaSubtitleAsrError) throw latestError;
    throw new DramaSubtitleAsrError("默认文本模型没有返回有效的中文字幕翻译，请稍后重试", 502);
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
        const child = spawn(whisperCliPath(), args, {
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
