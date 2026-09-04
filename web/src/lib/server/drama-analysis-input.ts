import { resolveDramaShotDuration } from "@/lib/server/drama-shot-config";

export type DramaAnalyzeBody = {
    phase?: "content" | "visual" | "review_completion" | "video_prompt" | "image_prompt";
    requestId?: unknown;
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

export class DramaVideoPromptQualityError extends Error {
    readonly status = 422;

    constructor(message: string) {
        super(message);
        this.name = "DramaVideoPromptQualityError";
    }
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
    const sourcePrompts = new Map(
        array(body.shots).flatMap((value) => {
            const shot = object(value);
            const id = dramaAnalysisText(shot.id);
            const prompt = dramaAnalysisText(shot.videoPrompt) || dramaAnalysisText(shot.executionVideoPrompt);
            return id && prompt ? [[id, prompt] as const] : [];
        }),
    );
    return {
        shotIds: visual.shotIds,
        payload: {
            ...visual.payload,
            shots: visual.payload.shots.map((shot) => {
                const { storyboardFrames, framePlan, ...compactShot } = shot;
                void storyboardFrames;
                return { ...compactShot, framePlan: compactVideoFramePlan(framePlan), videoPrompt: sourcePrompts.get(shot.id) || "" };
            }),
            instruction: dramaAnalysisText(body.instruction),
            referenceMaterials: normalizeReferenceMaterials(body.referenceMaterials),
        },
    };
}

function compactVideoFramePlan(value: unknown) {
    const input = object(value);
    const frames = array(input.frames).flatMap((item) => {
        const frame = object(item);
        const id = dramaAnalysisText(frame.id);
        if (!id) return [];
        return [
            {
                id,
                sequenceIndex: Number(frame.sequenceIndex) || 0,
                startSecond: Number(frame.startSecond),
                endSecond: Number(frame.endSecond),
                startPrompt: dramaAnalysisText(frame.startPrompt),
                actionPrompt: dramaAnalysisText(frame.actionPrompt),
                transitionPrompt: dramaAnalysisText(frame.transitionPrompt),
                endPrompt: dramaAnalysisText(frame.endPrompt),
                imagePrompt: dramaAnalysisText(frame.imagePrompt),
            },
        ];
    });
    return {
        ...(object(input.start).source ? { start: { source: dramaAnalysisText(object(input.start).source) } } : {}),
        ...(typeof object(input.end).required === "boolean" ? { end: { required: object(input.end).required } } : {}),
        ...(frames.length ? { frames } : {}),
    };
}

export function validateDramaVideoPromptReferenceBindings(prompt: string, references: unknown) {
    let referenceIndex = 0;
    const referenceList = array(references).flatMap((item) => {
        const reference = object(item);
        if (!dramaAnalysisText(reference.role) && !dramaAnalysisText(reference.purpose)) return [];
        referenceIndex += 1;
        const alias = normalizeReferenceAlias(dramaAnalysisText(reference.alias));
        return [alias || `@图片${referenceIndex}`];
    });
    const expectedCount = referenceList.length;
    if (!expectedCount) return "";
    const lines = prompt.split(/\r?\n/u);
    const bindingLineIndex = lines.findIndex((line) => /^\s*素材绑定\s*[：:]/u.test(line));
    if (bindingLineIndex < 0) return `模型生成的视频提示词缺少素材绑定字段（应包含 ${referenceList.join("、")}）；请按当前 Skill 重新生成`;
    const bindingEnd = lines.findIndex((line, index) => index > bindingLineIndex && /^(?:\s*)(?:动态意图|全局设定|起始可见状态|触发|主体动作与反应|时间段动作|单一主运镜|环境压力与视觉母题|视觉风格与光色|声音意图|结束画面|连续性锁|针对性约束)\s*[：:]/u.test(line));
    const bindingText = lines.slice(bindingLineIndex, bindingEnd < 0 ? lines.length : bindingEnd).join("\n");
    const bindingAliases = parseReferenceAliases(bindingText);
    const aliases = bindingAliases.length ? bindingAliases : parseReferenceAliases(prompt);
    const expectedAliases = referenceList;
    const expectedNumbers = expectedAliases.map((alias) => Number(alias.match(/(\d+)$/u)?.[1])).filter((value) => Number.isInteger(value));
    const aliasNumbers = aliases.map((alias) => Number(alias.match(/(\d+)$/u)?.[1])).filter((value) => Number.isInteger(value));
    const duplicate = aliases.find((alias, index) => aliases.indexOf(alias) !== index);
    if (duplicate) return `模型生成的视频提示词重复绑定 ${duplicate}；请按当前 Skill 重新生成`;
    if (aliasNumbers.some((alias, index) => alias !== expectedNumbers[index])) return "模型生成的视频提示词参考图顺序与输入不一致；请按当前 Skill 重新生成";
    const missing = expectedAliases.filter((alias) => !aliases.includes(alias));
    const unexpected = aliases.find((alias) => !expectedAliases.includes(alias));
    if (missing.length) return `模型生成的视频提示词缺少参考图绑定：${missing.join("、")}；请按当前 Skill 重新生成`;
    if (unexpected) return `模型生成的视频提示词包含未绑定的 ${unexpected}；请按当前 Skill 重新生成`;
    return "";
}

export function validateDramaVideoPromptOutput(value: unknown, shotIds: string[], sourceShots: ReadonlyArray<{ id: string; framePlan?: unknown }>, references: unknown) {
    const output = object(value);
    const outputShots = array(output.shots).map(object);
    const sourcePlans = new Map(sourceShots.map((shot) => [shot.id, object(shot.framePlan)]));
    for (const shotId of shotIds) {
        const shot = outputShots.find((item) => dramaAnalysisText(item.shotId) === shotId);
        if (!shot) return `Agent 没有返回镜头 ${shotId} 的完整视频提示词结果，请按当前 Skill 重新生成`;
        const prompt = normalizePublicVideoPromptForValidation(dramaAnalysisText(shot.videoPrompt));
        if (!prompt) return `镜头 ${shotId} 缺少公开视频提示词，请按当前 Skill 重新生成`;
        if (/^\s*模式\s*[：:]/mu.test(prompt)) return `镜头 ${shotId} 的公开视频提示词暴露了内部模式字段，请按当前 Skill 重新生成`;
        const requiredFields = ["动态意图", "全局设定", "起始可见状态", "主体动作与反应", "时间段动作", "单一主运镜", "环境压力与视觉母题", "视觉风格与光色", "声音意图", "结束画面", "连续性锁", "针对性约束"];
        const missingFields = requiredFields.filter((field) => !new RegExp(`(?:^|\\n)\\s*${field}[：:]`, "u").test(prompt));
        if (missingFields.length) return `镜头 ${shotId} 的公开视频提示词缺少标准字段：${missingFields.join("、")}；请按当前 Skill 重新生成`;
        if (/(?:A线|B线|主线|副线|钩子)/u.test(prompt)) return `镜头 ${shotId} 的公开视频提示词包含内部叙事标签，请按当前 Skill 改写为可见动作、事件或声音`;
        if (/(?:https?:\/\/|data:image\/|\b(?:模式|内部 ID|来源文件|API)\s*[：:])/iu.test(prompt)) return `镜头 ${shotId} 的公开视频提示词包含内部执行信息，请按当前 Skill 重新生成`;
        const referenceError = validateDramaVideoPromptReferenceBindings(prompt, references);
        if (referenceError) return `镜头 ${shotId}：${referenceError}`;
        const expectedFrames = array(sourcePlans.get(shotId)?.frames);
        const outputFrames = array(object(shot.framePlan).frames).map(object);
        if (!outputFrames.length) return `镜头 ${shotId} 缺少逐帧动作计划；请按当前 Skill 返回 framePlan.frames`;
        if (expectedFrames.length && outputFrames.length !== expectedFrames.length) return `镜头 ${shotId} 的逐帧计划数量不一致：应为 ${expectedFrames.length} 段，实际为 ${outputFrames.length} 段；请按当前 Skill 原样保留时间段`;
        const timelineFrameCount = expectedFrames.length || outputFrames.length;
        const timelineFieldCounts = Object.fromEntries(["起点", "动作与触发", "可见衔接", "终点"].map((field) => [field, (prompt.match(new RegExp(`(?:^|\\n)\\s*${field}[：:]`, "gu")) || []).length]));
        if (Object.values(timelineFieldCounts).some((count) => count < timelineFrameCount)) return `镜头 ${shotId} 的“时间段动作”没有逐段写出起点、动作与触发、可见衔接和终点，请按当前 Skill 重新生成`;
        const seenStates = new Set<string>();
        for (const [index, frame] of outputFrames.entries()) {
            const expected = object(expectedFrames[index]);
            const sequenceIndex = Number(frame.sequenceIndex);
            const startSecond = Number(frame.startSecond);
            const endSecond = Number(frame.endSecond);
            const startPrompt = dramaAnalysisText(frame.startPrompt);
            const actionPrompt = dramaAnalysisText(frame.actionPrompt);
            const transitionPrompt = dramaAnalysisText(frame.transitionPrompt);
            const endPrompt = dramaAnalysisText(frame.endPrompt);
            const imagePrompt = dramaAnalysisText(frame.imagePrompt);
            if (!Number.isInteger(sequenceIndex) || sequenceIndex !== index + 1 || !Number.isFinite(startSecond) || !Number.isFinite(endSecond) || endSecond <= startSecond || !startPrompt || !actionPrompt || !transitionPrompt || !endPrompt || !imagePrompt) return `镜头 ${shotId} 的第 ${index + 1} 个时间段缺少具体起点、动作、衔接、终点或画面描述`;
            if (expectedFrames.length && (Math.abs(startSecond - Number(expected.startSecond)) > 0.01 || Math.abs(endSecond - Number(expected.endSecond)) > 0.01)) return `镜头 ${shotId} 的第 ${index + 1} 个时间段改变了既有时间边界；请按当前 Skill 保留 ${expected.startSecond}-${expected.endSecond}s`;
            const expectedStart = expectedFrames.length ? Number(expected.startSecond) : startSecond;
            const expectedEnd = expectedFrames.length ? Number(expected.endSecond) : endSecond;
            const rangePattern = `${escapeRegExp(String(expectedStart))}\\s*(?:-|至|到)\\s*${escapeRegExp(String(expectedEnd))}\\s*(?:s|秒)`;
            if (!new RegExp(rangePattern, "iu").test(prompt)) return `镜头 ${shotId} 的第 ${index + 1} 个时间段未在公开视频提示词中写出 ${expectedStart}-${expectedEnd}s，请按当前 Skill 逐段输出`;
            const stateKey = `${startPrompt}\n${actionPrompt}\n${transitionPrompt}\n${endPrompt}\n${imagePrompt}`;
            if (seenStates.has(stateKey)) return `镜头 ${shotId} 的第 ${index + 1} 个时间段与其他阶段重复，请返回具体可见变化`;
            seenStates.add(stateKey);
        }
    }
    return "";
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\[\]\\]/gu, "\\$&");
}

function normalizePublicVideoPromptForValidation(value: string) {
    return value
        .replace(/\\r?\\n/gu, "\n")
        .replace(/[；;\s]+(?=(?:素材绑定|动态意图|全局设定|起始可见状态|触发|主体动作与反应|时间段动作|起点|动作与触发|可见衔接|终点|单一主运镜|环境压力与视觉母题|视觉风格与光色|声音意图|结束画面|连续性锁|针对性约束)\s*[：:])/gu, "\n")
        .replace(/\n[ \t]*/gu, "\n")
        .trim();
}

export function normalizeDramaImagePromptInput(body: DramaAnalyzeBody) {
    const visual = normalizeDramaVisualInput(body);
    return { shotIds: visual.shotIds, payload: { ...visual.payload, instruction: dramaAnalysisText(body.instruction) } };
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

function normalizeReferenceMaterials(value: unknown) {
    let referenceIndex = 0;
    return array(value).flatMap((item) => {
        const reference = object(item);
        const role = dramaAnalysisText(reference.role);
        const purpose = dramaAnalysisText(reference.purpose);
        if (!role && !purpose) return [];
        referenceIndex += 1;
        const sequenceIndex = Number(reference.sequenceIndex);
        const inputAlias = dramaAnalysisText(reference.alias);
        const alias = normalizeReferenceAlias(inputAlias) || `@图片${referenceIndex}`;
        return [{ alias, role, purpose, ...(Number.isFinite(sequenceIndex) && sequenceIndex > 0 ? { sequenceIndex } : {}) }];
    });
}

function parseReferenceAliases(value: string) {
    return Array.from(value.matchAll(/@(图片|视频|音频)\s*(\d+)(?=\s*(?:[：:，,；;、（）()\s]|$))/gu), (match) => `@${match[1]}${match[2]}`);
}

function normalizeReferenceAlias(value: string) {
    const match = value.match(/^@(图片|视频|音频)\s*(\d+)$/u);
    return match ? `@${match[1]}${match[2]}` : "";
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
