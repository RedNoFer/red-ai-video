import { resolveDramaShotDuration } from "@/lib/server/drama-shot-config";

export type DramaAnalyzeBody = {
    phase?: "content" | "visual" | "review_completion" | "video_prompt";
    script?: string;
    summary?: string;
    style?: string;
    episode?: unknown;
    characters?: unknown;
    scenes?: unknown;
    props?: unknown;
    clues?: unknown;
    shots?: unknown;
    completionFields?: unknown;
    forceShotIds?: unknown;
    instruction?: unknown;
    referenceMaterials?: unknown;
};

export function dramaAnalysisText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export function normalizeDramaVisualInput(body: DramaAnalyzeBody) {
    const shots = array(body.shots).flatMap((value) => {
        const shot = object(value);
        const id = dramaAnalysisText(shot.id);
        if (!id) return [];
        return [
            {
                id,
                title: dramaAnalysisText(shot.title),
                description: dramaAnalysisText(shot.description),
                sourceText: dramaAnalysisText(shot.sourceText),
                shotBoundary: dramaAnalysisText(shot.shotBoundary),
                dialogue: dramaAnalysisText(shot.dialogue),
                narration: dramaAnalysisText(shot.narration),
                utterances: normalizeUtterances(shot.utterances),
                duration: resolveDramaShotDuration(shot.duration, 5),
                characterIds: texts(shot.characterIds),
                sceneId: dramaAnalysisText(shot.sceneId),
                propIds: texts(shot.propIds),
                clueIds: texts(shot.clueIds),
                performancePlan: shot.performancePlan,
                dialoguePerformance: shot.dialoguePerformance,
                lightingPlan: shot.lightingPlan,
                continuity: shot.continuity,
                entryState: shot.entryState,
                exitState: shot.exitState,
                framePlan: shot.framePlan,
                storyboardFrames: array(shot.storyboardFrames),
            },
        ];
    });
    return {
        shotIds: shots.map((shot) => shot.id),
        payload: {
            project: { summary: dramaAnalysisText(body.summary), style: dramaAnalysisText(body.style) },
            episode: object(body.episode),
            assets: {
                characters: normalizeVisualAssets(body.characters),
                scenes: normalizeVisualAssets(body.scenes),
                props: normalizeVisualAssets(body.props),
                clues: normalizeVisualAssets(body.clues),
            },
            shots,
            referenceMaterials: array(body.referenceMaterials),
        },
    };
}

export function normalizeDramaVideoPromptInput(body: DramaAnalyzeBody) {
    const visual = normalizeDramaVisualInput(body);
    return {
        shotIds: visual.shotIds,
        payload: { ...visual.payload, instruction: dramaAnalysisText(body.instruction) },
    };
}

export function normalizeDramaReviewCompletionInput(body: DramaAnalyzeBody) {
    const visual = normalizeDramaVisualInput(body);
    const requestedFields = texts(body.completionFields).filter((field): field is DramaReviewCompletionField => ["performancePlan", "dialoguePerformance", "lightingPlan", "continuity", "entryState", "exitState"].includes(field));
    const fields: DramaReviewCompletionField[] = requestedFields.length ? requestedFields : ["performancePlan", "dialoguePerformance", "lightingPlan", "continuity", "entryState", "exitState"];
    const forcedShotIds = new Set(texts(body.forceShotIds));
    const shots = visual.payload.shots.flatMap((shot) => {
        const missingFields = reviewCompletionMissingFields(shot).filter((field) => fields.includes(field));
        const requested = forcedShotIds.has(shot.id) ? fields : missingFields;
        return requested.length ? [{ ...shot, missingFields: requested }] : [];
    });
    return {
        fields,
        shotIds: shots.map((shot) => shot.id),
        missingByShot: Object.fromEntries(shots.map((shot) => [shot.id, shot.missingFields])),
        payload: { ...visual.payload, shots, instruction: dramaAnalysisText(body.instruction) },
    };
}

export type DramaReviewCompletionField = "performancePlan" | "dialoguePerformance" | "lightingPlan" | "continuity" | "entryState" | "exitState";

export function reviewCompletionMissingFields(shot: Record<string, unknown>): DramaReviewCompletionField[] {
    const missing: DramaReviewCompletionField[] = [];
    if (!hasPerformancePlan(shot.performancePlan)) missing.push("performancePlan");
    if (array(shot.utterances).length && blank(shot.dialoguePerformance)) missing.push("dialoguePerformance");
    if (!hasLightingPlan(shot.lightingPlan)) missing.push("lightingPlan");
    if (!hasContinuityPlan(shot.continuity)) missing.push("continuity");
    if (!hasStateContent(shot.entryState)) missing.push("entryState");
    if (!hasStateContent(shot.exitState)) missing.push("exitState");
    return missing;
}

export function reviewCompletionSatisfies(value: Record<string, unknown>, fields: DramaReviewCompletionField[]) {
    return fields.every((field) => isReviewCompletionFieldSatisfied(value, field));
}

export function reviewCompletionFilledCount(value: Record<string, unknown>, fields: DramaReviewCompletionField[]) {
    return fields.reduce((count, field) => count + (isReviewCompletionFieldSatisfied(value, field) ? 1 : 0), 0);
}

function isReviewCompletionFieldSatisfied(value: Record<string, unknown>, field: DramaReviewCompletionField) {
    if (field === "performancePlan") return hasPerformancePlan(value.performancePlan);
    if (field === "lightingPlan") return hasLightingPlan(value.lightingPlan);
    if (field === "continuity") return hasContinuityPlan(value.continuity);
    if (field === "entryState") return hasStateContent(value.entryState);
    if (field === "exitState") return hasStateContent(value.exitState);
    return !blank(value[field]);
}

function hasPerformancePlan(value: unknown) {
    const input = object(value);
    const beats = object(input.beats);
    return Boolean(
        dramaAnalysisText(input.emotionalObjective) &&
        dramaAnalysisText(input.emotionalArc) &&
        dramaAnalysisText(input.speechStyle) &&
        dramaAnalysisText(input.pace) &&
        dramaAnalysisText(input.breath) &&
        dramaAnalysisText(object(beats.start).facialAction) &&
        dramaAnalysisText(object(beats.middle).facialAction) &&
        dramaAnalysisText(object(beats.end).facialAction),
    );
}

function hasLightingPlan(value: unknown) {
    const input = object(value);
    return Boolean(
        dramaAnalysisText(input.palette) &&
        dramaAnalysisText(input.colorTemperature) &&
        dramaAnalysisText(input.keyLight) &&
        dramaAnalysisText(input.fillLight) &&
        dramaAnalysisText(input.rimLight) &&
        dramaAnalysisText(input.materialResponse) &&
        dramaAnalysisText(input.skinToneProtection),
    );
}

function hasContinuityPlan(value: unknown) {
    const input = object(value);
    return Boolean(
        dramaAnalysisText(input.shotSize) &&
        dramaAnalysisText(input.cameraAngle) &&
        dramaAnalysisText(input.composition) &&
        dramaAnalysisText(input.characterBlocking) &&
        dramaAnalysisText(input.gazeDirection) &&
        dramaAnalysisText(input.actionStart) &&
        dramaAnalysisText(input.actionEnd) &&
        dramaAnalysisText(input.screenDirection) &&
        dramaAnalysisText(input.axisRule),
    );
}

function hasStateContent(value: unknown) {
    const input = object(value);
    return Object.values(input).some((item) => (Array.isArray(item) ? item.length > 0 : Boolean(dramaAnalysisText(item))));
}

function normalizeVisualAssets(value: unknown) {
    return array(value).flatMap((item) => {
        const asset = object(item);
        const name = dramaAnalysisText(asset.name);
        if (!name) return [];
        const profile = object(asset.profile);
        return [
            {
                id: dramaAnalysisText(asset.id),
                name,
                description: dramaAnalysisText(asset.description),
                profile: {
                    visualIdentity: dramaAnalysisText(profile.visualIdentity),
                    styling: dramaAnalysisText(profile.styling),
                    colorPalette: dramaAnalysisText(profile.colorPalette),
                    consistencyRules: dramaAnalysisText(profile.consistencyRules),
                },
                payoff: dramaAnalysisText(asset.payoff),
            },
        ];
    });
}

function normalizeUtterances(value: unknown) {
    return array(value).flatMap((item, index) => {
        const utterance = object(item);
        const text = dramaAnalysisText(utterance.text);
        if (!text) return [];
        return [
            {
                id: dramaAnalysisText(utterance.id),
                order: Math.max(1, Math.floor(Number(utterance.order) || index + 1)),
                type: utterance.type === "voiceover" ? "voiceover" : "dialogue",
                speaker: dramaAnalysisText(utterance.speaker),
                text,
            },
        ];
    });
}

function texts(value: unknown) {
    return array(value).map(dramaAnalysisText).filter(Boolean);
}

function object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function blank(value: unknown): boolean {
    if (value === undefined || value === null || value === "") return true;
    if (Array.isArray(value)) return !value.length || value.every(blank);
    if (typeof value !== "object") return !String(value).trim();
    const values = Object.values(value as Record<string, unknown>);
    return !values.length || values.every(blank);
}
