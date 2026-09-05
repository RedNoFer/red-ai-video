export const DRAMA_DIALOGUE_CHARS_PER_SECOND = 5;

export const DRAMA_DIALOGUE_TIMING_RULES = `对白时长硬约束：按中文对白每秒约 ${DRAMA_DIALOGUE_CHARS_PER_SECOND} 个可发音字估算，不把标点、停顿和动作反应当作可压缩空间。镜头内对白的最低可说时长不得超过该镜头时长；超过时必须在说话人转换、自然分句或动作反应处拆成多个镜头，禁止把完整长台词塞进 5 秒镜头。每个镜头先完成对白容量核算，再安排动作节点、表演和画面帧。`;

export type DramaDialogueTimingInput = { type?: string; text?: string };

export type DramaDialogueTimingIssue = {
    spokenCharacters: number;
    minimumSeconds: number;
    duration: number;
    message: string;
};

export function countDramaSpokenCharacters(value: string) {
    return (value.match(/[\p{L}\p{N}]/gu) || []).length;
}

export function estimateDramaDialogueSeconds(values: readonly DramaDialogueTimingInput[] | readonly string[], fallback = "") {
    const texts = values
        .map((value) => (typeof value === "string" ? value : value.type === "dialogue" ? value.text || "" : ""))
        .map((value) => value.trim())
        .filter(Boolean);
    const source = texts.length
        ? texts
        : fallback
              .split(/\n+/u)
              .map((value) => value.trim())
              .filter(Boolean);
    const spokenCharacters = source.reduce((total, value) => total + countDramaSpokenCharacters(value), 0);
    return { spokenCharacters, minimumSeconds: spokenCharacters ? Math.ceil(spokenCharacters / DRAMA_DIALOGUE_CHARS_PER_SECOND) : 0 };
}

export function dramaDialogueTimingIssue(duration: number, values: readonly DramaDialogueTimingInput[] | readonly string[], fallback = "", label = "镜头"): DramaDialogueTimingIssue | undefined {
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const estimate = estimateDramaDialogueSeconds(values, fallback);
    if (!estimate.minimumSeconds || estimate.minimumSeconds <= safeDuration) return undefined;
    return {
        ...estimate,
        duration: safeDuration,
        message: `${label}包含约 ${estimate.spokenCharacters} 个可发音字，按每秒约 ${DRAMA_DIALOGUE_CHARS_PER_SECOND} 个字至少需要 ${estimate.minimumSeconds} 秒，当前仅 ${safeDuration} 秒；请按自然分句/说话人转换拆镜或增加时长`,
    };
}

export function dramaFrameDialogueTimingIssue(startSecond: number, endSecond: number, actionPrompt: string, values: readonly DramaDialogueTimingInput[], label = "时间段") {
    const action = actionPrompt.trim();
    const matched = values
        .map((value) => (typeof value === "string" ? value : value.type === "dialogue" ? value.text || "" : ""))
        .map((value) => value.trim())
        .filter((value) => value && action.includes(value));
    const issue = dramaDialogueTimingIssue(endSecond - startSecond, matched, "", label);
    return issue ? { ...issue, startSecond, endSecond } : undefined;
}
