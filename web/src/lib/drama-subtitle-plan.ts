import type { DramaShot } from "@/lib/drama-project-contract";

export type DramaSubtitleCue = {
    startMs: number;
    endMs: number;
    text: string;
};

export type DramaSubtitleSource = {
    text: string;
    startMs?: number;
    endMs?: number;
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

const CHINESE_CHARS_PER_SECOND = 4.5;
const MIN_CUE_MS = 350;
const MAX_CUE_MS = 6_000;
const CUE_GAP_MS = 160;

export function dramaShotSubtitleSources(shot: DramaShot): DramaSubtitleSource[] {
    const utterances = (shot.utterances || [])
        .filter((utterance) => (utterance.type === "dialogue" || utterance.type === "voiceover") && (utterance.text || "").trim())
        .sort((left, right) => left.order - right.order)
        .map((utterance) => ({
            text: normalizeSubtitleText(utterance.text),
            startMs: secondsToMs(utterance.startSecond),
            endMs: secondsToMs(utterance.endSecond),
        }))
        .filter((source) => source.text);
    if (utterances.length) return utterances;

    const subtitleLines = (shot.subtitle || "").split(/\r?\n/u).map(cleanScriptLine).filter(Boolean);
    if (subtitleLines.length) return subtitleLines.map((text) => ({ text }));

    const scriptLines = [shot.dialogue || "", shot.narration || ""]
        .flatMap((value) => value.split(/\r?\n/u))
        .map(cleanScriptLine)
        .filter(Boolean);
    return scriptLines.map((text) => ({ text }));
}

export function dramaShotHasSubtitleText(shot: DramaShot) {
    return dramaShotSubtitleSources(shot).length > 0;
}

export function planDramaShotSubtitles(shot: DramaShot, durationMs: number, width = 1080, height = 1920): DramaSubtitleCue[] {
    const totalMs = Math.max(500, Math.round(Number.isFinite(durationMs) ? durationMs : 5_000));
    const layout = dramaSubtitleLayout(width, height);
    const sources = dramaShotSubtitleSources(shot);
    if (!sources.length) return [];

    const cues: DramaSubtitleCue[] = [];
    let cursor = Math.min(200, totalMs / 2);
    for (const source of sources) {
        const chunks = splitSubtitleText(source.text, layout.maxCharsPerCue);
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
            cues.push({ startMs, endMs, text: cue.text });
        }
        cursor = Math.max(cursor, cues.length ? cues[cues.length - 1].endMs + CUE_GAP_MS : cursor);
        if (cursor >= totalMs) break;
    }
    return cues.filter((cue, index) => index === 0 || cue.startMs >= cues[index - 1].endMs);
}

export function dramaSubtitleLayout(width: number, height: number): DramaSubtitleLayout {
    const safeWidth = Math.max(320, Math.round(width || 1080));
    const safeHeight = Math.max(320, Math.round(height || 1920));
    const fontSize = clamp(Math.round(safeHeight * 0.032), 18, 96);
    const marginV = Math.round(safeHeight * 0.08);
    const marginH = Math.round(safeWidth * 0.06);
    const maxCharsPerLine = clamp(Math.floor((safeWidth - marginH * 2) / fontSize), 8, 28);
    return {
        width: safeWidth,
        height: safeHeight,
        fontSize,
        marginV,
        marginH,
        outline: Math.max(1, Math.round(fontSize * 0.045)),
        shadow: Math.max(1, Math.round(fontSize * 0.02)),
        maxCharsPerLine,
        maxCharsPerCue: maxCharsPerLine * 2,
    };
}

export function buildDramaSrt(cues: DramaSubtitleCue[]) {
    return cues.map((cue, index) => `${index + 1}\n${srtTime(cue.startMs)} --> ${srtTime(cue.endMs)}\n${cue.text}`).join("\n\n");
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
    const events = cues.map((cue) => `Dialogue: 0,${assTime(cue.startMs)},${assTime(cue.endMs)},Default,,0,0,0,,{\\an2}${assText(cue.text, layout.maxCharsPerLine)}`);
    return `${header}\n${events.join("\n")}${events.length ? "\n" : ""}`;
}

function splitSubtitleText(text: string, maxChars: number) {
    const atoms = normalizeSubtitleText(text)
        .split(/(?<=[。！？!?；;，,、：:])/u)
        .map((value) => value.trim())
        .filter(Boolean);
    const chunks: string[] = [];
    let current = "";
    for (const atom of atoms) {
        const next = `${current}${atom}`;
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

function hardSplit(text: string, maxChars: number) {
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

function allocateWindow(chunks: string[], startMs: number, endMs: number): DramaSubtitleCue[] {
    const weights = chunks.map(textWeight);
    const total = weights.reduce((sum, value) => sum + value, 0) || chunks.length;
    const available = endMs - startMs;
    let cursor = startMs;
    return chunks.map((text, index) => {
        const share = available * ((weights[index] || 1) / total);
        const next = index === chunks.length - 1 ? endMs : Math.max(cursor + 120, Math.min(endMs, cursor + Math.round(share)));
        const cue = { startMs: cursor, endMs: Math.max(cursor + 120, next), text };
        cursor = cue.endMs + 20;
        return cue;
    });
}

function estimateWindow(chunks: string[], startMs: number, endMs: number): DramaSubtitleCue[] {
    const available = Math.max(0, endMs - startMs - 200);
    const rawDurations = chunks.map((text) => clamp(Math.round((textWeight(text) / CHINESE_CHARS_PER_SECOND) * 1000), MIN_CUE_MS, MAX_CUE_MS));
    const gaps = Math.max(0, chunks.length - 1) * CUE_GAP_MS;
    const total = rawDurations.reduce((sum, value) => sum + value, 0) + gaps;
    const scale = total > available && total > 0 ? Math.max(0.25, available / total) : 1;
    let cursor = startMs;
    return chunks.map((text, index) => {
        const duration = Math.max(160, Math.round(rawDurations[index] * scale));
        const cue = { startMs: cursor, endMs: cursor + duration, text };
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
