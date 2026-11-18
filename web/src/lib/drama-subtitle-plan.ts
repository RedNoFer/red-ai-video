import type { DramaShot } from "@/lib/drama-project-contract";

export const DRAMA_SUBTITLE_EXPORT_MODES = ["bilingual", "english"] as const;
export type DramaSubtitleExportMode = (typeof DRAMA_SUBTITLE_EXPORT_MODES)[number];

export type DramaSubtitleCue = {
    startMs: number;
    endMs: number;
    text: string;
    secondaryText?: string;
};

export type DramaSubtitleSource = {
    text: string;
    translation?: string;
    hasEnglish: boolean;
    startMs?: number;
    endMs?: number;
};

export type DramaSubtitleAvailability = {
    hasText: boolean;
    hasEnglish: boolean;
};

export type DramaSubtitleLayout = {
    width: number;
    height: number;
    fontSize: number;
    marginV: number;
    marginH: number;
    outline: number;
    shadow: number;
    maxCharsPerLine: number;
    maxCharsPerCue: number;
};

type DramaSubtitleChunk = {
    text: string;
    secondaryText?: string;
};

const CHINESE_CHARS_PER_SECOND = 4.5;
const MIN_CUE_MS = 350;
const MAX_CUE_MS = 6_000;
const CUE_GAP_MS = 160;

/** 只读取镜头已保存的台词；镜头没有正文时，才从当前集剧本文本回退。 */
export function dramaShotSubtitleSources(shot: DramaShot, script?: string): DramaSubtitleSource[] {
    const shotSources = shotSubtitleSources(shot);
    if (shotSources.length) {
        if (shotSources.some((source) => source.hasEnglish)) return shotSources;
        const scriptSources = dramaScriptShotSubtitleSources(script, shot.code);
        const translations = new Map<string, DramaSubtitleSource>();
        for (const source of scriptSources) {
            if (source.hasEnglish && source.translation) translations.set(subtitleMatchKey(source.translation), source);
        }
        return shotSources.map((source) => {
            const match = translations.get(subtitleMatchKey(source.text));
            return match ? { ...source, text: match.text, translation: match.translation, hasEnglish: true } : source;
        });
    }
    return dramaScriptShotSubtitleSources(script, shot.code);
}

/** 按镜头编号读取剧本里的英中对照台词，供制作包没有写入镜头台词时使用。 */
export function dramaScriptShotSubtitleSources(script: string | undefined, shotCode: string | undefined): DramaSubtitleSource[] {
    const code = normalizeShotCode(shotCode);
    if (!script || !code) return [];
    const blocks = splitScriptBlocks(script);
    const block = blocks.find((item) => normalizeShotCode(item.code) === code);
    if (!block) return [];
    return scriptDialogueSources(block.body);
}

export function dramaShotSubtitleAvailability(shot: DramaShot, script?: string): DramaSubtitleAvailability {
    const sources = dramaShotSubtitleSources(shot, script);
    return { hasText: sources.length > 0, hasEnglish: sources.some((source) => source.hasEnglish) };
}

export function dramaShotHasSubtitleText(shot: DramaShot, script?: string) {
    return dramaShotSubtitleAvailability(shot, script).hasText;
}

export function dramaShotHasEnglishSubtitleText(shot: DramaShot, script?: string) {
    return dramaShotSubtitleAvailability(shot, script).hasEnglish;
}

export function planDramaShotSubtitles(shot: DramaShot, durationMs: number, width = 1080, height = 1920, options: { script?: string; mode?: DramaSubtitleExportMode } = {}): DramaSubtitleCue[] {
    const sources = dramaShotSubtitleSources(shot, options.script);
    return planDramaSubtitleSources(sources, durationMs, width, height, options.mode);
}

/** 已按真实音频拆句并写入起止时间后，按统一排版规则生成最终 cue。 */
export function planDramaSubtitleSources(sources: DramaSubtitleSource[], durationMs: number, width = 1080, height = 1920, requestedMode: DramaSubtitleExportMode = "bilingual"): DramaSubtitleCue[] {
    const totalMs = Math.max(500, Math.round(Number.isFinite(durationMs) ? durationMs : 5_000));
    const layout = dramaSubtitleLayout(width, height);
    const mode = requestedMode === "english" ? "english" : "bilingual";
    const selected = sources.filter((source) => mode !== "english" || source.hasEnglish);
    if (!selected.length) return [];

    const cues: DramaSubtitleCue[] = [];
    let cursor = Math.min(200, totalMs / 2);
    for (const source of selected) {
        const chunks = sourceChunks(source, mode, layout);
        if (!chunks.length) continue;
        const hasWindow = source.startMs !== undefined && source.endMs !== undefined && source.endMs > source.startMs;
        const windowStart = hasWindow ? Math.max(0, Math.min(totalMs, source.startMs!)) : cursor;
        const windowEnd = hasWindow ? Math.max(0, Math.min(totalMs, source.endMs!)) : totalMs;
        if (windowEnd <= windowStart) continue;

        const planned = hasWindow ? allocateWindow(chunks, windowStart, windowEnd) : estimateWindow(chunks, windowStart, windowEnd);
        for (const cue of planned) {
            const startMs = Math.max(cues.length ? cues[cues.length - 1].endMs + 40 : 0, Math.round(cue.startMs));
            const endMs = Math.max(startMs + 120, Math.min(totalMs, Math.round(cue.endMs)));
            if (endMs <= startMs || startMs >= totalMs) continue;
            cues.push({ startMs, endMs, text: cue.text, ...(cue.secondaryText ? { secondaryText: cue.secondaryText } : {}) });
        }
        cursor = Math.max(cursor, cues.length ? cues[cues.length - 1].endMs + CUE_GAP_MS : cursor);
        if (cursor >= totalMs) break;
    }
    return cues.filter((cue, index) => index === 0 || cue.startMs >= cues[index - 1].endMs);
}

export function dramaSubtitleLayout(width: number, height: number): DramaSubtitleLayout {
    const safeWidth = Math.max(320, Math.round(width || 1080));
    const safeHeight = Math.max(320, Math.round(height || 1920));
    // 横屏 1080p 此前只有 35px，明显小于常见成片字幕；按画面短边计算可同时覆盖横竖屏。
    const fontSize = clamp(Math.round(Math.min(safeWidth, safeHeight) * 0.05), 24, 96);
    const marginV = Math.round(safeHeight * 0.08);
    const marginH = Math.round(safeWidth * 0.06);
    const maxCharsPerLine = clamp(Math.floor((safeWidth - marginH * 2) / fontSize), 8, 28);
    return {
        width: safeWidth,
        height: safeHeight,
        fontSize,
        marginV,
        marginH,
        outline: Math.max(2, Math.round(fontSize * 0.06)),
        shadow: Math.max(1, Math.round(fontSize * 0.02)),
        maxCharsPerLine,
        maxCharsPerCue: maxCharsPerLine * 2,
    };
}

/** 供 ASR 拆句和翻译复用同一套标点、长度规则。 */
export function splitDramaSubtitleText(text: string, maxChars: number) {
    return splitSubtitleText(text, maxChars);
}

/** 在已经识别出的真实语音窗口内，按字幕长度分配每一句的起止时间。 */
export function allocateDramaSubtitleWindow(chunks: string[], startMs: number, endMs: number) {
    return allocateWindow(
        chunks.map((text) => ({ text })),
        startMs,
        endMs,
    ).map((cue) => ({ text: cue.text, startMs: cue.startMs, endMs: cue.endMs }));
}

export function buildDramaSrt(cues: DramaSubtitleCue[]) {
    return cues.map((cue, index) => `${index + 1}\n${srtTime(cue.startMs)} --> ${srtTime(cue.endMs)}\n${[cue.text, cue.secondaryText].filter(Boolean).join("\n")}`).join("\n\n");
}

export function buildDramaAss(cues: DramaSubtitleCue[], width: number, height: number) {
    const layout = dramaSubtitleLayout(width, height);
    const header = [
        "[Script Info]",
        "ScriptType: v4.00+",
        `PlayResX: ${layout.width}`,
        `PlayResY: ${layout.height}`,
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "YCbCr Matrix: TV.709",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        `Style: Default,Noto Sans CJK SC,${layout.fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,${layout.outline},${layout.shadow},2,${layout.marginH},${layout.marginH},${layout.marginV},1`,
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ].join("\n");
    const events = cues.map((cue) => {
        const primary = assText(cue.text, layout.maxCharsPerLine);
        const secondary = cue.secondaryText ? assText(cue.secondaryText, layout.maxCharsPerLine) : "";
        return `Dialogue: 0,${assTime(cue.startMs)},${assTime(cue.endMs)},Default,,0,0,0,,{\\an2}${primary}${secondary ? `\\N${secondary}` : ""}`;
    });
    return `${header}\n${events.join("\n")}${events.length ? "\n" : ""}`;
}

function shotSubtitleSources(shot: DramaShot): DramaSubtitleSource[] {
    const utterances = (shot.utterances || [])
        .filter((utterance) => (utterance.type === "dialogue" || utterance.type === "voiceover") && (utterance.text || "").trim())
        .sort((left, right) => left.order - right.order)
        .flatMap((utterance) => textSources(utterance.text, secondsToMs(utterance.startSecond), secondsToMs(utterance.endSecond)));
    if (utterances.length) return utterances;

    const subtitleLines = textSources(shot.subtitle || "");
    if (subtitleLines.length) return subtitleLines;

    return [shot.dialogue || "", shot.narration || ""].flatMap((value) => textSources(value));
}

function textSources(value: string, startMs?: number, endMs?: number): DramaSubtitleSource[] {
    const lines = value.split(/\r?\n/u).map(cleanScriptLine).filter(Boolean);
    if (!lines.length) return [];
    const translationIndex = lines.findIndex(isTranslationLine);
    if (translationIndex >= 0) {
        const text = lines.slice(0, translationIndex).join(" ").trim();
        const translation = lines.slice(translationIndex).map(stripTranslationPrefix).filter(Boolean).join(" ").trim();
        if (!text) return translation ? [{ text: translation, hasEnglish: looksLikeEnglish(translation), startMs, endMs }] : [];
        return [{ text, translation: translation || undefined, hasEnglish: looksLikeEnglish(text), startMs, endMs }];
    }
    return lines.map((text) => ({ text, hasEnglish: looksLikeEnglish(text), startMs, endMs }));
}

function splitScriptBlocks(script: string) {
    const blocks: Array<{ code: string; body: string }> = [];
    const header = /^【([^】]+)】/gmu;
    const matches = Array.from(script.matchAll(header));
    for (const [index, match] of matches.entries()) {
        const code = (match[1] || "").split(/[｜|]/u)[0]?.trim() || "";
        const start = (match.index || 0) + match[0].length;
        const end = matches[index + 1]?.index ?? script.length;
        blocks.push({ code, body: script.slice(start, end) });
    }
    return blocks;
}

function scriptDialogueSources(body: string) {
    const sources: DramaSubtitleSource[] = [];
    let last: DramaSubtitleSource | undefined;
    for (const raw of body.split(/\r?\n/u)) {
        const line = raw.trim();
        if (!line) continue;
        if (isTranslationLine(line)) {
            if (last && !last.translation) last.translation = stripTranslationPrefix(line);
            continue;
        }
        const text = scriptDialogueText(line);
        if (!text) continue;
        const source: DramaSubtitleSource = { text, hasEnglish: looksLikeEnglish(text) };
        sources.push(source);
        last = source;
    }
    return sources;
}

function scriptDialogueText(line: string) {
    if (/^[*]{2,}/u.test(line) || /^(?:人物|场景|地点)[：:]/u.test(line) || /^△/u.test(line) || /^【/u.test(line)) return "";
    if ((line.startsWith('"') && line.endsWith('"')) || (line.startsWith("“") && line.endsWith("”"))) {
        return normalizeSubtitleText(line.slice(1, -1));
    }
    if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**") && !line.endsWith("**")) {
        return normalizeSubtitleText(line.slice(1, -1));
    }
    return "";
}

function sourceChunks(source: DramaSubtitleSource, mode: DramaSubtitleExportMode, layout: DramaSubtitleLayout): DramaSubtitleChunk[] {
    if (mode === "english" || !source.hasEnglish) {
        return splitSubtitleText(source.text, layout.maxCharsPerCue).map((text) => ({ text }));
    }
    const translation = (source.translation || "").trim();
    if (!translation) return splitSubtitleText(source.text, layout.maxCharsPerCue).map((text) => ({ text }));
    const primaryChunks = splitSubtitleText(source.text, layout.maxCharsPerCue);
    const secondaryChunks = splitSubtitleText(translation, layout.maxCharsPerCue);
    if (primaryChunks.length === secondaryChunks.length) {
        return primaryChunks.map((text, index) => ({ text, secondaryText: secondaryChunks[index] }));
    }
    return [{ text: source.text, secondaryText: translation }];
}

function splitSubtitleText(text: string, maxChars: number) {
    const atoms = normalizeSubtitleText(text)
        .split(/(?<=[。！？!?；;，,、：:.…])/u)
        .map((value) => value.trim())
        .filter(Boolean);
    const chunks: string[] = [];
    let current = "";
    for (const atom of atoms) {
        const next = joinSubtitleAtoms(current, atom);
        if (!current || textWeight(next) <= maxChars) {
            current = next;
            continue;
        }
        chunks.push(current);
        current = atom;
        if (textWeight(current) > maxChars) {
            const pieces = hardSplit(current, maxChars);
            chunks.push(...pieces.slice(0, -1));
            current = pieces[pieces.length - 1] || "";
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(Boolean);
}

function joinSubtitleAtoms(current: string, atom: string) {
    if (!current) return atom;
    const left = current.slice(-1);
    const right = atom.slice(0, 1);
    const latin = /[A-Za-z]/u.test(current + atom);
    return latin && /[A-Za-z0-9,.;:!?)]/u.test(left) && /[A-Za-z0-9(]/u.test(right) ? `${current} ${atom}` : `${current}${atom}`;
}

function hardSplit(text: string, maxChars: number) {
    if (/\s/u.test(text) && /[A-Za-z]/u.test(text)) {
        const words = text.split(/\s+/u).filter(Boolean);
        const pieces: string[] = [];
        let current = "";
        for (const word of words) {
            const next = current ? `${current} ${word}` : word;
            if (textWeight(next) <= maxChars) {
                current = next;
                continue;
            }
            if (current) pieces.push(current);
            if (textWeight(word) > maxChars) pieces.push(...hardSplit(word, maxChars));
            else current = word;
        }
        if (current) pieces.push(current);
        return pieces;
    }
    const pieces: string[] = [];
    let current = "";
    for (const char of Array.from(text)) {
        const next = `${current}${char}`;
        if (current && textWeight(next) > maxChars) {
            pieces.push(current);
            current = char;
        } else {
            current = next;
        }
    }
    if (current) pieces.push(current);
    return pieces;
}

function allocateWindow(chunks: DramaSubtitleChunk[], startMs: number, endMs: number): DramaSubtitleCue[] {
    const weights = chunks.map((chunk) => textWeight(chunk.text) + textWeight(chunk.secondaryText || ""));
    const total = weights.reduce((sum, value) => sum + value, 0) || chunks.length;
    const available = endMs - startMs;
    let cursor = startMs;
    return chunks.map((chunk, index) => {
        const share = available * ((weights[index] || 1) / total);
        const next = index === chunks.length - 1 ? endMs : Math.max(cursor + 120, Math.min(endMs, cursor + Math.round(share)));
        const cue = { startMs: cursor, endMs: Math.max(cursor + 120, next), text: chunk.text, ...(chunk.secondaryText ? { secondaryText: chunk.secondaryText } : {}) };
        cursor = cue.endMs + 20;
        return cue;
    });
}

function estimateWindow(chunks: DramaSubtitleChunk[], startMs: number, endMs: number): DramaSubtitleCue[] {
    const available = Math.max(0, endMs - startMs - 200);
    const rawDurations = chunks.map((chunk) => clamp(Math.round(((textWeight(chunk.text) + textWeight(chunk.secondaryText || "")) / CHINESE_CHARS_PER_SECOND) * 1000), MIN_CUE_MS, MAX_CUE_MS));
    const gaps = Math.max(0, chunks.length - 1) * CUE_GAP_MS;
    const total = rawDurations.reduce((sum, value) => sum + value, 0) + gaps;
    const scale = total > available && total > 0 ? Math.max(0.25, available / total) : 1;
    let cursor = startMs;
    return chunks.map((chunk, index) => {
        const duration = Math.max(160, Math.round(rawDurations[index] * scale));
        const cue = { startMs: cursor, endMs: cursor + duration, text: chunk.text, ...(chunk.secondaryText ? { secondaryText: chunk.secondaryText } : {}) };
        cursor = cue.endMs + CUE_GAP_MS;
        return cue;
    });
}

function normalizeSubtitleText(value: string) {
    return value.replace(/\s+/gu, " ").trim();
}

function cleanScriptLine(value: string) {
    return normalizeSubtitleText(value);
}

function isTranslationLine(value: string) {
    return /^(?:中译|翻译|英译)[：:]/u.test(value);
}

function stripTranslationPrefix(value: string) {
    return normalizeSubtitleText(value.replace(/^(?:中译|翻译|英译)[：:]\s*/u, ""));
}

function looksLikeEnglish(value: string) {
    return /[A-Za-z]/u.test(value);
}

function subtitleMatchKey(value: string) {
    return normalizeSubtitleText(value)
        .replace(/^[\p{L}\p{N}_·\s]{1,20}[：:]\s*/u, "")
        .replace(/["'“”‘’\s]/gu, "")
        .toLowerCase();
}

function normalizeShotCode(value: string | undefined) {
    return (value || "").trim().toUpperCase().replace(/\s+/gu, "");
}

function textWeight(value: string) {
    let weight = 0;
    for (const char of Array.from(value)) {
        if (/^[\u2e80-\u9fff\uf900-\ufaff]/u.test(char)) weight += 1;
        else if (/^[，。！？!?；;、：:]/u.test(char)) weight += 0.3;
        else if (/^\s$/u.test(char)) weight += 0.25;
        else weight += 0.55;
    }
    return weight;
}

function wrapAssText(value: string, maxChars: number) {
    const lines = hardSplit(value, maxChars);
    return lines.length ? lines.join("\\N") : value;
}

function assText(value: string, maxChars: number) {
    return wrapAssText(value.replace(/\\/gu, "\\\\").replace(/\{/gu, "｛").replace(/\}/gu, "｝"), maxChars);
}

function assTime(milliseconds: number) {
    const value = Math.max(0, Math.round(milliseconds));
    const hours = Math.floor(value / 3_600_000);
    const minutes = Math.floor((value % 3_600_000) / 60_000);
    const seconds = Math.floor((value % 60_000) / 1_000);
    const centiseconds = Math.floor((value % 1_000) / 10);
    return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
}

function srtTime(milliseconds: number) {
    const value = Math.max(0, Math.round(milliseconds));
    const hours = Math.floor(value / 3_600_000);
    const minutes = Math.floor((value % 3_600_000) / 60_000);
    const seconds = Math.floor((value % 60_000) / 1_000);
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${String(value % 1_000).padStart(3, "0")}`;
}

function secondsToMs(value?: number) {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value * 1_000)) : undefined;
}

function pad(value: number) {
    return String(value).padStart(2, "0");
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}
