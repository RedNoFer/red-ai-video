/** Restore only authored prose after structural normalization and ID mapping. */
export function preserveDramaAuthoredText<T extends object>(normalized: T, source: Record<string, unknown>): T {
    const result = { ...normalized } as Record<string, unknown>;
    const fields = [
        "title",
        "name",
        "description",
        "script",
        "outline",
        "hook",
        "nextPreview",
        "sourceRange",
        "shotBoundary",
        "performanceNotes",
        "supplierPrompt",
        "payoff",
        "imagePrompt",
        "videoPrompt",
        "executionImagePrompt",
        "executionVideoPrompt",
        "startFramePrompt",
        "endFramePrompt",
        "dialogue",
        "narration",
        "sourceText",
    ];
    for (const field of fields) if (typeof source[field] === "string") Object.assign(result, { [field]: source[field] });
    for (const field of ["profile", "utterances", "performancePlan", "dialoguePerformance", "lightingPlan", "entryState", "exitState"]) if (source[field] && result[field]) result[field] = restoreNestedText(result[field], source[field]);
    const sourcePlan = source.framePlan as { frames?: Array<Record<string, unknown>> } | undefined;
    const normalizedPlan = result.framePlan as { frames?: Array<Record<string, unknown>> } | undefined;
    if (sourcePlan?.frames && normalizedPlan?.frames)
        result.framePlan = {
            ...normalizedPlan,
            frames: normalizedPlan.frames.map((frame, index) => {
                const authored = sourcePlan.frames?.find((item) => item.id === frame.id) || sourcePlan.frames?.[index];
                return { ...frame, ...Object.fromEntries(["startPrompt", "actionPrompt", "transitionPrompt", "endPrompt", "imagePrompt"].flatMap((field) => (typeof authored?.[field] === "string" ? [[field, authored[field]]] : []))) };
            }),
        };
    return result as T;
}

function restoreNestedText(normalized: unknown, source: unknown): unknown {
    if (Array.isArray(normalized) && Array.isArray(source)) return normalized.map((item, index) => (typeof item === "string" && typeof source[index] === "string" ? source[index] : restoreNestedText(item, source[index])));
    if (!normalized || typeof normalized !== "object" || !source || typeof source !== "object") return normalized;
    const result = { ...normalized } as Record<string, unknown>;
    const authored = source as Record<string, unknown>;
    for (const key of Object.keys(result)) {
        if (["id", "assetId", "characterId", "utteranceId", "holderId", "type"].includes(key)) continue;
        if (typeof authored[key] === "string") result[key] = authored[key];
        else if (typeof authored[key] === "object") result[key] = restoreNestedText(result[key], authored[key]);
    }
    return result;
}
