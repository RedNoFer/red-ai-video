export const DRAMA_DIALOGUE_CHARS_PER_SECOND = 5;
export const DRAMA_DIALOGUE_TIMING_TOLERANCE_CHARS = 10;

export const DRAMA_DIALOGUE_TIMING_RULES = `对白时长规则：默认按中文对白每秒约 ${DRAMA_DIALOGUE_CHARS_PER_SECOND} 个可发音字估算，不把标点、停顿和动作反应当作可压缩空间。制作包必须按逐句记录 startSecond/endSecond（相对当前镜头，且不含停顿）、pauseBeforeSeconds/pauseAfterSeconds 和情绪语速 speechRate；需要可复核时同时填写 speechRateCharsPerSecond。逐句时间不得越界或重叠，停顿不得跑出镜头。容量偏差只作提醒，不阻止内容分析、制作包导入或生产；不超过 ${DRAMA_DIALOGUE_TIMING_TOLERANCE_CHARS} 个可发音字标记为轻微上线偏差，超过该容差建议在说话人转换、自然分句或动作反应处拆镜。每个镜头先完成对白容量核算，再安排动作节点、表演和画面帧。`;

export type DramaDialogueTimingInput = {
    type?: string;
    text?: string;
    order?: number;
    startSecond?: number;
    endSecond?: number;
    pauseBeforeSeconds?: number;
    pauseAfterSeconds?: number;
    speechRate?: string;
    speechRateCharsPerSecond?: number;
};

export type DramaDialogueTimingIssue = {
    spokenCharacters: number;
    minimumSeconds: number;
    duration: number;
    speechSeconds?: number;
    pauseSeconds?: number;
    requiredSeconds?: number;
    overageCharacters?: number;
    withinTolerance?: boolean;
    message: string;
};

export function countDramaSpokenCharacters(value: string) {
    return (value.match(/[\p{L}\p{N}]/gu) || []).length;
}

export function estimateDramaDialogueSeconds(values: readonly DramaDialogueTimingInput[] | readonly string[], fallback = "") {
    const source = values
        .map((value) => {
            if (typeof value === "string") return { text: value, speechRateCharsPerSecond: DRAMA_DIALOGUE_CHARS_PER_SECOND, pauseBeforeSeconds: 0, pauseAfterSeconds: 0 };
            if (value.type !== "dialogue" && value.type !== "voiceover") return undefined;
            return {
                text: value.text || "",
                speechRateCharsPerSecond: resolveSpeechRateCharsPerSecond(value),
                pauseBeforeSeconds: nonNegative(value.pauseBeforeSeconds),
                pauseAfterSeconds: nonNegative(value.pauseAfterSeconds),
            };
        })
        .filter((value): value is { text: string; speechRateCharsPerSecond: number; pauseBeforeSeconds: number; pauseAfterSeconds: number } => Boolean(value?.text.trim()))
        .map((value) => ({ ...value, text: value.text.trim() }));
    const fallbackValues = fallback
        .split(/\n+/u)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((text) => ({ text, speechRateCharsPerSecond: DRAMA_DIALOGUE_CHARS_PER_SECOND, pauseBeforeSeconds: 0, pauseAfterSeconds: 0 }));
    const entries = source.length ? source : fallbackValues;
    const spokenCharacters = entries.reduce((total, value) => total + countDramaSpokenCharacters(value.text), 0);
    const speechSeconds = entries.reduce((total, value) => total + countDramaSpokenCharacters(value.text) / value.speechRateCharsPerSecond, 0);
    const pauseSeconds = entries.reduce((total, value) => total + value.pauseBeforeSeconds + value.pauseAfterSeconds, 0);
    return { spokenCharacters, speechSeconds, pauseSeconds, minimumSeconds: speechSeconds ? Math.ceil(speechSeconds + pauseSeconds) : 0 };
}

export function dramaDialogueTimingIssue(duration: number, values: readonly DramaDialogueTimingInput[] | readonly string[], fallback = "", label = "镜头"): DramaDialogueTimingIssue | undefined {
    return dramaDialogueTimingReminder(duration, values, fallback, label);
}

/** Returns a non-blocking capacity reminder for any dialogue that runs past the shot. */
export function dramaDialogueTimingReminder(duration: number, values: readonly DramaDialogueTimingInput[] | readonly string[], fallback = "", label = "镜头"): DramaDialogueTimingIssue | undefined {
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const estimate = estimateDramaDialogueSeconds(values, fallback);
    const effectiveSpeechRate = estimate.speechSeconds > 0 ? estimate.spokenCharacters / estimate.speechSeconds : DRAMA_DIALOGUE_CHARS_PER_SECOND;
    const requiredSeconds = estimate.speechSeconds + estimate.pauseSeconds;
    const toleranceSeconds = DRAMA_DIALOGUE_TIMING_TOLERANCE_CHARS / effectiveSpeechRate;
    if (!estimate.minimumSeconds || requiredSeconds <= safeDuration) return undefined;
    const withinTolerance = requiredSeconds <= safeDuration + toleranceSeconds;
    const overageCharacters = Math.max(1, Math.ceil(Number(((requiredSeconds - safeDuration) * effectiveSpeechRate).toFixed(6))));
    return {
        ...estimate,
        duration: safeDuration,
        requiredSeconds,
        overageCharacters,
        withinTolerance,
        message: `${label}包含约 ${estimate.spokenCharacters} 个可发音字，按逐句语速和停顿约需 ${Number(requiredSeconds.toFixed(1))} 秒（默认每秒约 ${DRAMA_DIALOGUE_CHARS_PER_SECOND} 个字），当前仅 ${safeDuration} 秒；对白时长仅作提醒，不阻止导入${withinTolerance ? `，当前偏差约 ${overageCharacters} 字，处于 ${DRAMA_DIALOGUE_TIMING_TOLERANCE_CHARS} 字上线容差内` : `，当前约超出 ${overageCharacters} 字，建议按自然分句/说话人转换拆镜或增加时长`}`,
    };
}

export function dramaFrameDialogueTimingIssue(startSecond: number, endSecond: number, actionPrompt: string, values: readonly DramaDialogueTimingInput[], label = "时间段") {
    return dramaFrameDialogueTimingReminder(startSecond, endSecond, actionPrompt, values, label);
}

export function dramaFrameDialogueTimingReminder(startSecond: number, endSecond: number, actionPrompt: string, values: readonly DramaDialogueTimingInput[], label = "时间段") {
    const action = actionPrompt.trim();
    const matched = values
        .map((value) => (typeof value === "string" ? value : value.type === "dialogue" ? value.text || "" : ""))
        .map((value) => value.trim())
        .filter((value) => value && action.includes(value));
    const issue = dramaDialogueTimingReminder(endSecond - startSecond, matched, "", label);
    return issue ? { ...issue, startSecond, endSecond } : undefined;
}

export function dramaUtteranceTimingIssues(duration: number, values: readonly DramaDialogueTimingInput[], requireAll = false, label = "镜头") {
    const utterances = values.filter((value) => (value.type === "dialogue" || value.type === "voiceover") && Boolean(value.text?.trim()));
    const timed = utterances.filter(
        (value) => value.startSecond !== undefined || value.endSecond !== undefined || value.pauseBeforeSeconds !== undefined || value.pauseAfterSeconds !== undefined || value.speechRate !== undefined || value.speechRateCharsPerSecond !== undefined,
    );
    if (!utterances.length || (!timed.length && !requireAll)) return [];
    const issues: string[] = [];
    if (timed.length !== utterances.length) issues.push(`${label}的逐句对白时序必须全部填写或全部留空，不能只填写部分句子`);
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const ordered = utterances.map((value, index) => ({ value, index })).sort((left, right) => (Number(left.value.order) || left.index + 1) - (Number(right.value.order) || right.index + 1));
    let previousEnd = 0;
    for (const [index, { value }] of ordered.entries()) {
        const prefix = `${label}第 ${index + 1} 句`;
        const start = Number(value.startSecond);
        const end = Number(value.endSecond);
        const pauseBefore = value.pauseBeforeSeconds === undefined ? 0 : Number(value.pauseBeforeSeconds);
        const pauseAfter = value.pauseAfterSeconds === undefined ? 0 : Number(value.pauseAfterSeconds);
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            issues.push(`${prefix}必须同时填写有效 startSecond 和 endSecond`);
            continue;
        }
        if (start < 0 || end <= start || end > safeDuration) issues.push(`${prefix}的 startSecond/endSecond 必须在 0-${safeDuration} 秒内且 endSecond 大于 startSecond`);
        if (start < previousEnd) issues.push(`${prefix}与上一句对白时间重叠`);
        if (!Number.isFinite(pauseBefore) || pauseBefore < 0 || !Number.isFinite(pauseAfter) || pauseAfter < 0) issues.push(`${prefix}的停顿必须是非负数字`);
        if (start - pauseBefore < 0 || end + pauseAfter > safeDuration) issues.push(`${prefix}的停顿超出当前镜头时长`);
        if (!value.speechRate?.trim()) issues.push(`${prefix}必须填写情绪语速 speechRate`);
        if (value.speechRateCharsPerSecond !== undefined && (!Number.isFinite(Number(value.speechRateCharsPerSecond)) || Number(value.speechRateCharsPerSecond) < 2 || Number(value.speechRateCharsPerSecond) > 8))
            issues.push(`${prefix}的 speechRateCharsPerSecond 必须在 2-8 之间`);
        previousEnd = Math.max(previousEnd, end);
    }
    return issues;
}

function resolveSpeechRateCharsPerSecond(value: DramaDialogueTimingInput) {
    const explicit = Number(value.speechRateCharsPerSecond);
    if (Number.isFinite(explicit) && explicit >= 2 && explicit <= 8) return explicit;
    const rate = value.speechRate || "";
    if (/(?:极慢|慢速|慢)/u.test(rate) || /slow/i.test(rate)) return 4;
    if (/(?:极快|快速|偏快|快)/u.test(rate) || /fast/i.test(rate)) return 6;
    return DRAMA_DIALOGUE_CHARS_PER_SECOND;
}

function nonNegative(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}
