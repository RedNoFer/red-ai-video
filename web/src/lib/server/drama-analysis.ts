import { nanoid } from "nanoid";

import type {
    DramaAssetProfile,
    DramaContentAnalysis,
    DramaContinuityTransition,
    DramaDialoguePerformance,
    DramaLightingPlan,
    DramaPerformanceBeat,
    DramaPerformancePlan,
    DramaReferenceManifestRole,
    DramaReviewCompletion,
    DramaShotFramePlan,
    DramaShotContinuity,
    DramaUtterance,
    DramaVisualAnalysis,
} from "@/lib/drama-project-contract";
import { formatPromptFieldLines, normalizeDramaFrameBeats, validateDramaFramePlanVisuals } from "@/lib/drama-frame-sequence";
import { resolveDramaShotDuration } from "@/lib/server/drama-shot-config";
import { strictJsonObjectText } from "@/lib/server/structured-model-output";

export function normalizeDramaContentAnalysis(value: unknown, defaultVideoSeconds: number, sourceScript = ""): DramaContentAnalysis {
    const source = object(value);
    const shots = array(source.shots).flatMap((item, index) => {
        const shot = object(item);
        const sourceText = text(shot.sourceText);
        const description = text(shot.description) || sourceText;
        if (!sourceText || !description) return [];
        const modelUtterances = array(shot.utterances).flatMap((value, utteranceIndex) => {
            const utterance = object(value);
            const utteranceText = text(utterance.text);
            if (!utteranceText) return [];
            return [
                {
                    id: `utterance-${nanoid()}`,
                    order: utteranceIndex + 1,
                    type: utterance.type === "voiceover" ? ("voiceover" as const) : ("dialogue" as const),
                    speaker: text(utterance.speaker),
                    text: utteranceText,
                },
            ];
        });
        const utterances = mergeUtterances(extractDramaUtterances(sourceText), modelUtterances);
        const dialogue = normalizeDialogue(extractQuotedDialogue(sourceText) || shot.dialogue, utterances);
        const narration =
            text(shot.narration) ||
            utterances
                .filter((item) => item.type === "voiceover")
                .map((item) => item.text)
                .join("\n");
        return [
            {
                title: text(shot.title) || `镜头 ${String(index + 1).padStart(2, "0")}`,
                description,
                sourceText,
                shotBoundary: text(shot.shotBoundary) || "动作或叙事节拍变化",
                dialogue,
                narration,
                utterances,
                duration: resolveDramaShotDuration(shot.duration, defaultVideoSeconds),
                characterNames: texts(shot.characterNames),
                sceneName: text(shot.sceneName),
                propNames: texts(shot.propNames),
                clueNames: texts(shot.clueNames),
            },
        ];
    });
    return {
        episode: {
            outline: text(object(source.episode).outline),
            hook: text(object(source.episode).hook),
            nextPreview: text(object(source.episode).nextPreview),
            sourceRange: text(object(source.episode).sourceRange),
        },
        characters: normalizeAssets(source.characters, "character"),
        scenes: normalizeAssets(source.scenes, "scene"),
        props: normalizeAssets(source.props, "prop"),
        clues: normalizeClues(source.clues),
        shots: restoreMissingDialogueCoverage(shots, sourceScript),
    };
}

export function normalizeDramaVisualAnalysis(value: unknown, shotIds: string[], sourceShots: ReadonlyArray<{ id: string; framePlan?: unknown }> = []): DramaVisualAnalysis {
    const allowed = new Set(shotIds);
    const seen = new Set<string>();
    const sourceFramePlans = new Map(sourceShots.map((shot) => [shot.id, shot.framePlan]));
    const shots = array(object(value).shots).flatMap((item) => {
        const shot = object(item);
        const shotId = text(shot.shotId);
        const imagePrompt = text(shot.imagePrompt);
        const videoPrompt = text(shot.videoPrompt);
        const framePlan = normalizeVisualFramePlan(shot.framePlan, sourceFramePlans.get(shotId));
        if (!allowed.has(shotId) || seen.has(shotId) || !imagePrompt || !videoPrompt || !framePlan) return [];
        seen.add(shotId);
        return [
            {
                shotId,
                imagePrompt,
                videoPrompt,
                cameraMotion: text(shot.cameraMotion),
                startFramePrompt: text(shot.startFramePrompt) || imagePrompt,
                endFramePrompt: text(shot.endFramePrompt) || videoPrompt,
                negativePrompt: text(shot.negativePrompt),
                continuity: normalizeContinuity(shot.continuity),
                performancePlan: normalizePerformancePlan(shot.performancePlan),
                dialoguePerformance: normalizeDialoguePerformance(shot.dialoguePerformance),
                lightingPlan: normalizeLightingPlan(shot.lightingPlan),
                framePlan,
            },
        ];
    });
    return { shots };
}

export function validateDramaVisualAnalysis(value: DramaVisualAnalysis) {
    const errors: string[] = [];
    for (const shot of value.shots) {
        const label = shot.shotId;
        const performance = shot.performancePlan;
        const beats = performance?.beats;
        if (
            !performance?.emotionalObjective ||
            !performance.emotionalArc ||
            !performance.speechStyle ||
            !performance.pace ||
            !performance.breath ||
            !performance.restraintLevel ||
            !beats?.start?.facialAction ||
            !beats.middle?.facialAction ||
            !beats.end?.facialAction ||
            !beats.start?.gaze ||
            !beats.middle?.gaze ||
            !beats.end?.gaze
        )
            errors.push(`${label}缺少完整的情绪、表情和视线表演计划`);
        const lighting = shot.lightingPlan;
        if (
            !lighting?.palette ||
            !lighting.colorTemperature ||
            !lighting.keyLight ||
            !lighting.fillLight ||
            !lighting.rimLight ||
            !lighting.contrast ||
            !lighting.materialResponse ||
            !lighting.skinToneProtection ||
            !lighting.inheritFromPrevious ||
            !lighting.transitionToNext
        )
            errors.push(`${label}缺少完整的灯光与材质计划`);
        const continuity = shot.continuity;
        if (
            !continuity?.shotSize ||
            !continuity.cameraAngle ||
            !continuity.composition ||
            !continuity.characterBlocking ||
            !continuity.gazeDirection ||
            !continuity.actionStart ||
            !continuity.actionEnd ||
            !continuity.screenDirection ||
            !continuity.axisRule ||
            !continuity.continuityNotes
        )
            errors.push(`${label}缺少完整的连续性字段`);
        if (!shot.framePlan.frames.length) errors.push(`${label}缺少逐帧计划`);
    }
    return errors;
}

function normalizeVisualFramePlan(value: unknown, fallbackValue?: unknown): DramaShotFramePlan | undefined {
    const input = object(value);
    const fallback = object(fallbackValue);
    const start = object(input.start);
    const end = object(input.end);
    const rawFrames = array(input.frames);
    if (!rawFrames.length || !["independent", "previous_accepted_actual_tail"].includes(text(start.source)) || typeof end.required !== "boolean") return undefined;
    const frames = rawFrames.map((item, index) => {
        const frame = object(item);
        return {
            id: text(frame.id) || `frame-${index + 1}`,
            sequenceIndex: Number(frame.sequenceIndex) || index + 1,
            startSecond: Number(frame.startSecond),
            endSecond: Number(frame.endSecond),
            startPrompt: text(frame.startPrompt),
            actionPrompt: text(frame.actionPrompt),
            transitionPrompt: text(frame.transitionPrompt),
            endPrompt: text(frame.endPrompt),
            imagePrompt: text(frame.imagePrompt),
        };
    });
    const duration = Math.max(...frames.map((frame) => frame.endSecond));
    if (!Number.isFinite(duration) || duration <= 0) return undefined;
    try {
        const normalizedFrames = normalizeDramaFrameBeats(frames, Math.round(duration));
        if (validateDramaFramePlanVisuals(normalizedFrames).length) return undefined;
        return {
            start: { source: text(start.source) as "independent" | "previous_accepted_actual_tail" },
            end: { required: end.required },
            frames: normalizedFrames,
            ...normalizeReferenceFields(input, fallback),
        };
    } catch {
        return undefined;
    }
}

function normalizeReferenceFields(input: Record<string, unknown>, fallback: Record<string, unknown>) {
    const manifest = normalizeReferenceManifest(array(input.referenceManifest).length ? input.referenceManifest : fallback.referenceManifest);
    const inputCount = object(input.referenceCount);
    const fallbackCount = object(fallback.referenceCount);
    const count = inputCount.min || inputCount.max ? normalizeReferenceCount(input.referenceCount) : fallbackCount.min || fallbackCount.max ? normalizeReferenceCount(fallback.referenceCount) : undefined;
    return {
        ...(manifest.length ? { referenceManifest: manifest } : {}),
        ...(count ? { referenceCount: count } : {}),
    };
}

function normalizeReferenceManifest(value: unknown) {
    const roles: DramaReferenceManifestRole[] = ["previous_actual_tail", "character_anchor", "scene_anchor", "prop_anchor", "action_keyframe", "composition_keyframe"];
    return array(value).flatMap((item) => {
        const entry = object(item);
        const alias = text(entry.alias);
        const role = text(entry.role) as DramaReferenceManifestRole;
        if (!alias || !roles.includes(role)) return [];
        return [
            {
                alias,
                role,
                purpose: text(entry.purpose),
                ...(text(entry.assetId) ? { assetId: text(entry.assetId) } : {}),
                ...(text(entry.shotId) ? { shotId: text(entry.shotId) } : {}),
                ...(text(entry.frameEvidenceId) ? { frameEvidenceId: text(entry.frameEvidenceId) } : {}),
            },
        ];
    });
}

function normalizeReferenceCount(value: unknown) {
    const input = object(value);
    const min = Math.max(1, Math.floor(Number(input.min) || 1));
    const max = Math.max(min, Math.floor(Number(input.max) || min));
    return { min: Math.min(30, min), max: Math.min(30, max) };
}

export function normalizeDramaVideoPromptAnalysis(
    value: unknown,
    shotIds: string[],
    sourceShots: ReadonlyArray<{ id: string; framePlan?: unknown }> = [],
): import("@/lib/drama-project-contract").DramaVideoPromptAnalysis {
    const allowed = new Set(shotIds);
    const seen = new Set<string>();
    const sourcePlans = new Map(sourceShots.map((shot) => [shot.id, object(shot.framePlan)]));
    const shots = array(object(value).shots).flatMap((item) => {
        const shot = object(item);
        const shotId = text(shot.shotId);
        const videoPrompt = text(shot.videoPrompt);
        const rawFrames = array(object(shot.framePlan).frames);
        if (!allowed.has(shotId) || seen.has(shotId) || !videoPrompt || !rawFrames.length) return [];
        seen.add(shotId);
        const sourceFrames = array(sourcePlans.get(shotId)?.frames);
        const frames = rawFrames.flatMap((value, index) => {
            const frame = object(value);
            const source = object(sourceFrames[index]);
            const sequenceIndex = Math.floor(Number(frame.sequenceIndex) || index + 1);
            const startSecond = Number(frame.startSecond);
            const endSecond = Number(frame.endSecond);
            const startPrompt = text(frame.startPrompt);
            const actionPrompt = text(frame.actionPrompt);
            const transitionPrompt = text(frame.transitionPrompt);
            const endPrompt = text(frame.endPrompt);
            const imagePrompt = text(frame.imagePrompt);
            if (!Number.isInteger(sequenceIndex) || sequenceIndex < 1 || !Number.isFinite(startSecond) || !Number.isFinite(endSecond) || endSecond <= startSecond || !startPrompt || !actionPrompt || !transitionPrompt || !endPrompt || !imagePrompt) return [];
            return [
                {
                    id: text(frame.id) || text(source.id) || `frame-${index + 1}`,
                    sequenceIndex,
                    startSecond,
                    endSecond,
                    startPrompt,
                    actionPrompt,
                    transitionPrompt,
                    endPrompt,
                    imagePrompt,
                },
            ];
        });
        if (!frames.length) return [];
        return [{ shotId, videoPrompt, framePlan: { frames } }];
    });
    return { shots };
}

export function normalizeDramaImagePromptAnalysis(value: unknown, shotIds: string[]) {
    const allowed = new Set(shotIds);
    const seen = new Set<string>();
    const shots = array(object(value).shots).flatMap((item) => {
        const shot = object(item);
        const shotId = text(shot.shotId);
        const imagePrompt = formatPromptFieldLines(text(shot.imagePrompt), "static");
        if (!allowed.has(shotId) || seen.has(shotId) || !imagePrompt) return [];
        seen.add(shotId);
        return [{ shotId, imagePrompt }];
    });
    return { shots };
}

export function normalizeDramaReviewCompletion(value: unknown, shotIds: string[]): DramaReviewCompletion {
    const allowed = new Set(shotIds);
    const seen = new Set<string>();
    const shots = array(object(value).shots).flatMap((item) => {
        const shot = object(item);
        const shotId = text(shot.shotId);
        if (!allowed.has(shotId) || seen.has(shotId)) return [];
        seen.add(shotId);
        const edge = object(shot.continuityEdge);
        const fromShotId = text(edge.fromShotId);
        const toShotId = text(edge.toShotId);
        return [
            {
                shotId,
                performancePlan: normalizePerformancePlan(shot.performancePlan),
                dialoguePerformance: normalizeDialoguePerformance(shot.dialoguePerformance),
                lightingPlan: normalizeLightingPlan(shot.lightingPlan),
                continuity: normalizeContinuity(shot.continuity),
                entryState: normalizeState(shot.entryState),
                exitState: normalizeState(shot.exitState),
                ...(fromShotId && toShotId
                    ? {
                          continuityEdge: {
                              fromShotId,
                              toShotId,
                              transition: (["continuous", "match_cut", "hard_cut", "scene_change", "jump_cut"].includes(text(edge.transition)) ? text(edge.transition) : "hard_cut") as DramaContinuityTransition,
                              inheritActualEndFrame: Boolean(edge.inheritActualEndFrame),
                              carryCharacterIds: texts(edge.carryCharacterIds),
                              carryPropIds: texts(edge.carryPropIds),
                              carryEnvironment: Boolean(edge.carryEnvironment),
                              carryAxis: Boolean(edge.carryAxis),
                              notes: text(edge.notes) || undefined,
                          },
                      }
                    : {}),
            },
        ];
    });
    return { shots };
}

function normalizePerformancePlan(value: unknown): DramaPerformancePlan {
    const input = object(value);
    const beat = (item: unknown): DramaPerformanceBeat => {
        const value = object(item);
        return { emotion: text(value.emotion), facialAction: text(value.facialAction), gaze: text(value.gaze), bodyAction: text(value.bodyAction) };
    };
    return {
        emotionalObjective: text(input.emotionalObjective),
        emotionalArc: text(input.emotionalArc),
        speechStyle: text(input.speechStyle),
        pace: text(input.pace),
        breath: text(input.breath),
        restraintLevel: text(input.restraintLevel),
        beats: { start: beat(input.beats && object(input.beats).start), middle: beat(input.beats && object(input.beats).middle), end: beat(input.beats && object(input.beats).end) },
    };
}

function normalizeDialoguePerformance(value: unknown): DramaDialoguePerformance[] {
    return array(value).flatMap((item) => {
        const input = object(item);
        const utteranceId = text(input.utteranceId);
        return utteranceId
            ? [
                  {
                      utteranceId,
                      intent: text(input.intent),
                      tone: text(input.tone),
                      pace: text(input.pace),
                      pause: text(input.pause),
                      emphasis: text(input.emphasis),
                      facialReactionBefore: text(input.facialReactionBefore),
                      facialReactionDuring: text(input.facialReactionDuring),
                      facialReactionAfter: text(input.facialReactionAfter),
                  },
              ]
            : [];
    });
}

function normalizeLightingPlan(value: unknown): DramaLightingPlan {
    const input = object(value);
    return {
        palette: text(input.palette),
        colorTemperature: text(input.colorTemperature),
        keyLight: text(input.keyLight),
        fillLight: text(input.fillLight),
        rimLight: text(input.rimLight),
        contrast: text(input.contrast),
        materialResponse: text(input.materialResponse),
        skinToneProtection: text(input.skinToneProtection),
        inheritFromPrevious: text(input.inheritFromPrevious),
        transitionToNext: text(input.transitionToNext),
    };
}

export function readDramaUpstreamError(value: string, status: number) {
    const fallback =
        status === 401 || status === 403
            ? `文本模型渠道鉴权失败（HTTP ${status}），请管理员检查账号、密钥和模型绑定`
            : status === 429
              ? "文本模型渠道请求过于频繁（HTTP 429），可稍后重试或切换备用渠道"
              : status >= 500
                ? `上游文本模型渠道暂时不可用（HTTP ${status}），可重试；连续失败请检查渠道健康、模型账号和网关连通性`
                : "后台文本模型调用失败，需要检查上游响应和模型配置";
    if (!value.trim()) return fallback;
    try {
        const payload = JSON.parse(value) as { msg?: unknown; error?: unknown; response?: unknown };
        const error = object(payload.error);
        const responseError = object(object(payload.response).error);
        const raw = text(payload.msg, 300) || text(payload.error, 300) || text(error.message, 300) || text(responseError.message, 300);
        return actionableUpstreamError(raw, status) || fallback;
    } catch {
        return actionableUpstreamError(value.trim().slice(0, 300), status) || fallback;
    }
}

function actionableUpstreamError(raw: string, status: number) {
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (lower.includes("upstream service temporarily unavailable")) return `上游渠道暂时不可用${status ? `（HTTP ${status}）` : ""}，可重试；连续失败请检查渠道健康、模型账号和网关连通性`;
    if (lower.includes("timeout") || raw.includes("超时")) return "上游任务超时，建议先重试；连续超时请降低任务复杂度或检查渠道响应";
    if (raw.includes("无可用账号") || lower.includes("no available account")) return "模型无可用账号，请管理员检查渠道账号池、额度或模型绑定";
    if (lower.includes("invalid") || raw.includes("协议") || raw.includes("解析")) return `上游返回不符合协议：${raw}`;
    return raw;
}

export function readDramaResponsesArguments(value: unknown, toolName: string) {
    const source = object(value);
    const direct = strictJsonObjectText(source.output_text);
    if (direct) return direct;
    const output = array(source.output);
    const call = output.map(object).find((item) => item.type === "function_call" && item.name === toolName);
    const argumentsText = jsonObjectArguments(call?.arguments);
    if (argumentsText) return argumentsText;
    for (const item of output.map(object)) {
        const itemText = strictJsonObjectText(item.text);
        if (itemText) return itemText;
        for (const content of array(item.content).map(object)) {
            const text = strictJsonObjectText(content.text);
            if (text) return text;
        }
    }
    return "";
}

export function readDramaChatArguments(value: unknown, toolName: string) {
    for (const choice of array(object(value).choices).map(object)) {
        const message = object(choice.message);
        const call = array(message.tool_calls)
            .map(object)
            .map((item) => object(item.function))
            .find((item) => item.name === toolName);
        const legacyCall = object(message.function_call);
        const argumentsText = jsonObjectArguments(call?.arguments) || (legacyCall.name === toolName ? jsonObjectArguments(legacyCall.arguments) : "");
        if (argumentsText) return argumentsText;
        const content = strictJsonObjectText(message.content);
        if (content) return content;
        for (const item of array(message.content).map(object)) {
            const itemText = strictJsonObjectText(item.text);
            if (itemText) return itemText;
        }
    }
    return "";
}

export function hasUsableDramaToolArguments(value: string, toolName: string) {
    try {
        const source = object(JSON.parse(value));
        if (!array(source.shots).length) return false;
        return toolName !== "analyze_drama_content" || Object.keys(object(source.episode)).length > 0;
    } catch {
        return false;
    }
}

export function describeDramaModelOutput(value: unknown) {
    const source = object(value);
    return {
        topLevelKeys: Object.keys(source).slice(0, 12),
        outputTextType: valueType(source.output_text),
        output: array(source.output)
            .slice(0, 10)
            .map((value) => {
                const item = object(value);
                return {
                    type: text(item.type, 40),
                    name: text(item.name, 80),
                    argumentsType: valueType(item.arguments),
                    contentTypes: array(item.content)
                        .slice(0, 10)
                        .map((content) => text(object(content).type, 40) || valueType(content)),
                };
            }),
        choices: array(source.choices)
            .slice(0, 3)
            .map((value) => {
                const message = object(object(value).message);
                return {
                    contentType: valueType(message.content),
                    toolCallCount: array(message.tool_calls).length,
                    toolNames: array(message.tool_calls)
                        .slice(0, 10)
                        .map((toolCall) => text(object(object(toolCall).function).name, 80))
                        .filter(Boolean),
                    functionCallName: text(object(message.function_call).name, 80),
                };
            }),
    };
}

export function describeDramaAnalysisCandidate(value: unknown) {
    const source = object(value);
    return {
        topLevelKeys: Object.keys(source).slice(0, 20),
        episodeKeys: Object.keys(object(source.episode)).slice(0, 20),
        counts: {
            characters: array(source.characters).length,
            scenes: array(source.scenes).length,
            props: array(source.props).length,
            clues: array(source.clues).length,
            shots: array(source.shots).length,
        },
        shots: array(source.shots)
            .slice(0, 5)
            .map((value) => {
                const shot = object(value);
                return {
                    keys: Object.keys(shot).slice(0, 24),
                    titleType: valueType(shot.title),
                    descriptionType: valueType(shot.description),
                    sourceTextType: valueType(shot.sourceText),
                    utterancesType: valueType(shot.utterances),
                    durationType: valueType(shot.duration),
                };
            }),
    };
}

function jsonObjectArguments(value: unknown) {
    if (typeof value === "string") return value.trim();
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    try {
        return JSON.stringify(value);
    } catch {
        return "";
    }
}

function valueType(value: unknown) {
    return Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
}

function normalizeAssets(value: unknown, kind: "character" | "scene" | "prop" = "prop") {
    const seen = new Set<string>();
    return array(value).flatMap((item) => {
        const record = object(item);
        const name = text(record.name);
        const key = name.toLocaleLowerCase();
        if (!name || seen.has(key) || (kind === "character" && /(木匣|断剑|护符|探测器|短刃|银戒|锤柄|铜镜|剑鞘|马车|声音)/u.test(name))) return [];
        seen.add(key);
        return name
            ? [
                  {
                      name,
                      description: text(record.description),
                      profile: normalizeProfile(record.profile, record, kind),
                  },
              ]
            : [];
    });
}

function normalizeClues(value: unknown) {
    return array(value).flatMap((item) => {
        const record = object(item);
        const name = text(record.name);
        return name
            ? [
                  {
                      name,
                      description: text(record.description),
                      profile: normalizeProfile(record.profile, record),
                      payoff: text(record.payoff),
                  },
              ]
            : [];
    });
}

function normalizeProfile(value: unknown, fallback: Record<string, unknown>, kind: "character" | "scene" | "prop" = "prop"): DramaAssetProfile {
    const profile = object(value);
    const styling = text(profile.styling) || text(fallback.styling);
    return {
        visualIdentity: text(profile.visualIdentity) || text(fallback.visualIdentity),
        styling: kind === "scene" && isCharacterStyling(styling) ? "" : styling,
        colorPalette: text(profile.colorPalette) || text(fallback.colorPalette),
        consistencyRules: text(profile.consistencyRules) || text(fallback.consistencyRules),
    };
}

function isCharacterStyling(value: string) {
    return /发型|随身物件|发色|(?:^|[，、；\s])服装(?:[，、；\s]|$)/u.test(value) || (/角色|人物/u.test(value) && /穿着|衣着|造型/u.test(value));
}

function normalizeContinuity(value: unknown): DramaShotContinuity {
    const input = object(value);
    return {
        shotSize: text(input.shotSize),
        cameraAngle: text(input.cameraAngle),
        composition: text(input.composition),
        characterBlocking: text(input.characterBlocking),
        gazeDirection: text(input.gazeDirection),
        actionStart: text(input.actionStart),
        actionEnd: text(input.actionEnd),
        screenDirection: text(input.screenDirection),
        axisRule: text(input.axisRule),
        continuityNotes: text(input.continuityNotes),
    };
}

function normalizeState(value: unknown) {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    const entities = (key: "characters" | "props") =>
        array(input[key]).flatMap((item) => {
            const entity = object(item);
            const assetId = text(entity.assetId);
            return assetId
                ? [
                      {
                          assetId,
                          wardrobe: text(entity.wardrobe) || undefined,
                          position: text(entity.position) || undefined,
                          gaze: text(entity.gaze) || undefined,
                          pose: text(entity.pose) || undefined,
                          expression: text(entity.expression) || undefined,
                          action: text(entity.action) || undefined,
                          state: text(entity.state) || undefined,
                          holderId: text(entity.holderId) || undefined,
                      },
                  ]
                : [];
        });
    return {
        characters: entities("characters"),
        props: entities("props"),
        environment: text(input.environment) || undefined,
        lighting: text(input.lighting) || undefined,
        axis: text(input.axis) || undefined,
        screenDirection: text(input.screenDirection) || undefined,
    };
}

type DialogueSpan = {
    start: number;
    end: number;
    speaker: string;
    text: string;
};

const narrativeDialoguePattern = /^[^。！？!?]{0,24}(?:说明|表示|告知|询问|讲述|描述|解释|透露|提到|认为|发现|来到|进入|看见|感到|回忆|想起|请求|劝说)(?:自己|对方|她|他|其|，|,)/u;
const speechVerbPattern = /(?:说|说道|问|问道|回答|答道|开口|喊|叫|低声道|轻声道|呢喃|嘀咕|回应|回道|回了?一句|应道|接话|追问|反问|提醒|安慰|解释道|补充道|笑道|哭道|吼道|骂道|想说)\s*$/u;

function extractQuotedDialogue(value: string) {
    return extractDialogueSpans(value)
        .map((item) => item.text)
        .join("\n");
}

function normalizeDialogue(value: unknown, utterances: DramaUtterance[]) {
    const direct = text(value);
    const utteranceText = utterances
        .filter((item) => item.type === "dialogue" && !narrativeDialoguePattern.test(item.text))
        .map((item) => item.text)
        .join("\n");
    return utteranceText || (direct && !narrativeDialoguePattern.test(direct) ? direct : "");
}

function extractDramaUtterances(value: string): DramaUtterance[] {
    return extractDialogueSpans(value).map((item, index) => ({
        id: `utterance-${nanoid()}`,
        order: index + 1,
        type: "dialogue",
        speaker: item.speaker,
        text: item.text,
    }));
}

function extractDialogueSpans(value: string): DialogueSpan[] {
    const spans: DialogueSpan[] = [];
    const seen = new Set<string>();
    const quotePattern = /“([^”]+)”|「([^」]+)」|『([^』]+)』|"([^"\r\n]+)"/g;
    for (const match of value.matchAll(quotePattern)) {
        const dialogue = [match[1], match[2], match[3], match[4]].find(Boolean)?.trim() || "";
        if (!dialogue) continue;
        const start = match.index || 0;
        addDialogueSpan(spans, seen, { start, end: start + match[0].length, speaker: inferSpeaker(value.slice(Math.max(0, start - 80), start)), text: dialogue });
    }
    let lineStart = 0;
    for (const line of value.split("\n")) {
        for (const match of line.matchAll(/[：:]/g)) {
            const colonIndex = match.index || 0;
            const before = line.slice(0, colonIndex).trimEnd().slice(-60);
            const after = line.slice(colonIndex + 1).trim();
            if (!speechVerbPattern.test(before) || !after || /^[“"「『]/.test(after)) continue;
            addDialogueSpan(spans, seen, {
                start: lineStart + colonIndex + 1,
                end: lineStart + line.length,
                speaker: inferSpeaker(before),
                text: after,
            });
        }
        lineStart += line.length + 1;
    }
    return spans.sort((left, right) => left.start - right.start);
}

function addDialogueSpan(spans: DialogueSpan[], seen: Set<string>, span: DialogueSpan) {
    const key = dialogueKey(span.text);
    const occurrenceKey = `${span.start}:${key}`;
    if (!key || seen.has(occurrenceKey)) return;
    seen.add(occurrenceKey);
    spans.push(span);
}

function inferSpeaker(value: string) {
    const sentence =
        value
            .split(/[。！？!?；;\n]/)
            .pop()
            ?.trim() || "";
    const verbMatch = sentence.match(/(?:说|说道|问|问道|回答|答道|开口|喊|叫|低声道|轻声道|呢喃|嘀咕|回应|回道|回了?一句|应道|接话|追问|反问|提醒|安慰|解释道|补充道|笑道|哭道|吼道|骂道|想说)\s*[：:]?\s*$/u);
    if (!verbMatch?.index) return "";
    const subject = sentence
        .slice(0, verbMatch.index)
        .replace(/(?:又|再|再次|缓缓|轻轻|低声|轻声|小声|忍不住|刚想|终于|随即|立即|赶紧|回了?一句)+$/u, "")
        .trim();
    const compactSubject = subject.split(/[，,]/).pop()?.trim().replace(/^.*的/u, "") || "";
    const leadingSpeaker = compactSubject.match(/^(他|她|男人|女人|老人|女孩|男孩|医生|护士|[\p{Script=Han}]{2,4})(?=闭|睁|抬|低|看|走|站|坐|转|笑|哭|皱|摇|点|伸|捂|扶|推|拉|拿|压|快|刚|又|再|缓|轻|小|忍|随|立|赶)/u)?.[1];
    if (leadingSpeaker) return leadingSpeaker;
    return compactSubject.match(/[\p{Script=Han}A-Za-z0-9·]{1,12}$/u)?.[0] || "";
}

function mergeUtterances(sourceUtterances: DramaUtterance[], modelUtterances: DramaUtterance[]) {
    const merged = sourceUtterances.map((item) => {
        const model = modelUtterances.find((candidate) => sameDialogue(candidate.text, item.text));
        return model?.speaker ? { ...item, speaker: model.speaker } : item;
    });
    for (const item of modelUtterances) {
        if (item.type === "dialogue" && narrativeDialoguePattern.test(item.text)) continue;
        if (merged.some((candidate) => sameDialogue(candidate.text, item.text))) continue;
        merged.push(item);
    }
    return merged.map((item, index) => ({ ...item, order: index + 1 }));
}

function restoreMissingDialogueCoverage(shots: DramaContentAnalysis["shots"], sourceScript: string) {
    const script = sourceScript.trim();
    if (!script || !shots.length) return shots;
    const covered = new Map<string, number>();
    for (const shot of shots) {
        const values = shot.utterances.filter((item) => item.type === "dialogue").map((item) => item.text);
        for (const value of values.length ? values : shot.dialogue.split("\n")) {
            const key = dialogueKey(value);
            if (key) covered.set(key, (covered.get(key) || 0) + 1);
        }
    }
    const matched = new Map<string, number>();
    const positions = locateShotPositions(script, shots);
    const result = shots.map((shot) => ({ ...shot, utterances: [...shot.utterances] }));
    for (const span of extractDialogueSpans(script)) {
        const key = dialogueKey(span.text);
        if (!key) continue;
        const matchedCount = matched.get(key) || 0;
        if (matchedCount < (covered.get(key) || 0)) {
            fillMissingDialogueSpeaker(result, key, matchedCount, span.speaker);
            matched.set(key, matchedCount + 1);
            continue;
        }
        const targetIndex = nearestShotIndex(span.start, positions, result.length, script.length);
        const target = result[targetIndex];
        if (!target) continue;
        target.utterances.push({ id: `utterance-${nanoid()}`, order: target.utterances.length + 1, type: "dialogue", speaker: span.speaker, text: span.text });
        target.dialogue = target.utterances
            .filter((item) => item.type === "dialogue")
            .map((item) => item.text)
            .join("\n");
        matched.set(key, matchedCount + 1);
    }
    return result;
}

function fillMissingDialogueSpeaker(shots: DramaContentAnalysis["shots"], key: string, occurrence: number, speaker: string) {
    if (!speaker) return;
    let matched = 0;
    for (const shot of shots) {
        for (const utterance of shot.utterances) {
            if (utterance.type !== "dialogue" || dialogueKey(utterance.text) !== key) continue;
            if (matched === occurrence) {
                if (!utterance.speaker.trim()) utterance.speaker = speaker;
                return;
            }
            matched += 1;
        }
    }
}

function locateShotPositions(script: string, shots: DramaContentAnalysis["shots"]) {
    let cursor = 0;
    return shots.map((shot) => {
        const sourceText = shot.sourceText.trim();
        const candidates = [sourceText, sourceText.slice(0, 160), sourceText.slice(0, 80)].filter((value, index, values) => value.length >= 12 && values.indexOf(value) === index);
        let position = -1;
        for (const candidate of candidates) {
            position = script.indexOf(candidate, cursor);
            if (position < 0) position = script.indexOf(candidate);
            if (position >= 0) break;
        }
        if (position >= 0) cursor = position + Math.max(1, sourceText.length);
        return position;
    });
}

function nearestShotIndex(position: number, shotPositions: number[], shotCount: number, scriptLength: number) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    shotPositions.forEach((shotPosition, index) => {
        if (shotPosition < 0) return;
        const distance = Math.abs(position - shotPosition);
        if (distance < bestDistance) {
            bestIndex = index;
            bestDistance = distance;
        }
    });
    if (bestIndex >= 0) return bestIndex;
    return Math.min(shotCount - 1, Math.floor((position / Math.max(1, scriptLength)) * shotCount));
}

function sameDialogue(left: string, right: string) {
    const leftKey = dialogueKey(left);
    const rightKey = dialogueKey(right);
    return Boolean(leftKey && rightKey && (leftKey === rightKey || (Math.min(leftKey.length, rightKey.length) >= 4 && (leftKey.includes(rightKey) || rightKey.includes(leftKey)))));
}

function dialogueKey(value: string) {
    return value.toLocaleLowerCase().replace(/[\s“”"「」『』，。！？!?、：:；;…—-]/g, "");
}

function texts(value: unknown) {
    return array(value)
        .map((item) => text(item))
        .filter(Boolean);
}

function text(value: unknown, max?: number) {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    return max === undefined ? normalized : normalized.slice(0, max);
}

function object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

const namedAssetSchema = {
    type: "object",
    additionalProperties: false,
    required: ["name", "description"],
    properties: {
        name: { type: "string" },
        description: { type: "string" },
        profile: {
            type: "object",
            additionalProperties: false,
            properties: {
                visualIdentity: { type: "string" },
                styling: { type: "string" },
                colorPalette: { type: "string" },
                consistencyRules: { type: "string" },
            },
        },
    },
};

export const dramaContentTool = {
    name: "analyze_drama_content",
    description: "只提取可审核的剧本内容结构，不生成任何图片或视频提示词",
    parameters: {
        type: "object",
        additionalProperties: false,
        required: ["episode", "characters", "scenes", "props", "clues", "shots"],
        properties: {
            episode: {
                type: "object",
                additionalProperties: false,
                required: ["outline", "hook", "nextPreview", "sourceRange"],
                properties: { outline: { type: "string" }, hook: { type: "string" }, nextPreview: { type: "string" }, sourceRange: { type: "string" } },
            },
            characters: { type: "array", items: namedAssetSchema },
            scenes: { type: "array", items: namedAssetSchema },
            props: { type: "array", items: namedAssetSchema },
            clues: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["name", "description", "payoff"],
                    properties: { ...namedAssetSchema.properties, payoff: { type: "string" } },
                },
            },
            shots: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "description", "sourceText", "shotBoundary", "dialogue", "narration", "utterances", "duration", "characterNames", "sceneName", "propNames", "clueNames"],
                    properties: {
                        title: { type: "string" },
                        description: { type: "string", description: "只写画面中发生的动作、人物状态和可观察事实，不写角色台词摘要" },
                        sourceText: { type: "string", description: "对应原文的连续片段，尽量保留原文标点和引号" },
                        shotBoundary: { type: "string", description: "说明为何在此切镜；说话人转换、明显动作反应或场景变化应形成新镜头" },
                        dialogue: { type: "string", description: "只填写角色实际说出口的原话，不要写‘某人说明/表示/询问’等转述；没有明确台词就留空" },
                        narration: { type: "string", description: "只填写原文明确存在的画外音或旁白，不要把镜头事实改写成旁白" },
                        utterances: {
                            type: "array",
                            items: {
                                type: "object",
                                additionalProperties: false,
                                required: ["type", "speaker", "text"],
                                properties: {
                                    type: { type: "string", enum: ["dialogue", "voiceover"] },
                                    speaker: { type: "string", description: "原文可判断时填写说话人；无法判断可留空" },
                                    text: { type: "string", description: "逐句保留原话，不得改写、概括或合并遗漏" },
                                },
                            },
                        },
                        duration: { type: "integer", minimum: 1 },
                        characterNames: { type: "array", items: { type: "string" } },
                        sceneName: { type: "string" },
                        propNames: { type: "array", items: { type: "string" } },
                        clueNames: { type: "array", items: { type: "string" } },
                    },
                },
            },
        },
    },
};

export const dramaVisualTool = {
    name: "design_drama_visuals",
    description: "根据已经审核的镜头事实生成视觉结构，不改变镜头数量、顺序或内容；所有人物站位、坐姿、接触和空间关系必须符合当前场景的真实可用结构",
    parameters: {
        type: "object",
        additionalProperties: false,
        required: ["shots"],
        properties: {
            shots: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["shotId", "imagePrompt", "videoPrompt", "cameraMotion", "startFramePrompt", "endFramePrompt", "negativePrompt", "continuity", "performancePlan", "dialoguePerformance", "lightingPlan", "framePlan"],
                    properties: {
                        shotId: { type: "string" },
                        imagePrompt: { type: "string" },
                        videoPrompt: { type: "string" },
                        cameraMotion: { type: "string" },
                        startFramePrompt: { type: "string" },
                        endFramePrompt: { type: "string" },
                        negativePrompt: { type: "string" },
                        performancePlan: {
                            type: "object",
                            additionalProperties: false,
                            required: ["emotionalObjective", "emotionalArc", "speechStyle", "pace", "breath", "restraintLevel", "beats"],
                            properties: {
                                emotionalObjective: { type: "string" },
                                emotionalArc: { type: "string" },
                                speechStyle: { type: "string" },
                                pace: { type: "string" },
                                breath: { type: "string" },
                                restraintLevel: { type: "string" },
                                beats: { type: "object", additionalProperties: false, required: ["start", "middle", "end"], properties: { start: performanceBeatSchema(), middle: performanceBeatSchema(), end: performanceBeatSchema() } },
                            },
                        },
                        dialoguePerformance: {
                            type: "array",
                            items: {
                                type: "object",
                                additionalProperties: false,
                                required: ["utteranceId", "intent", "tone", "pace", "pause", "emphasis", "facialReactionBefore", "facialReactionDuring", "facialReactionAfter"],
                                properties: {
                                    utteranceId: { type: "string" },
                                    intent: { type: "string" },
                                    tone: { type: "string" },
                                    pace: { type: "string" },
                                    pause: { type: "string" },
                                    emphasis: { type: "string" },
                                    facialReactionBefore: { type: "string" },
                                    facialReactionDuring: { type: "string" },
                                    facialReactionAfter: { type: "string" },
                                },
                            },
                        },
                        lightingPlan: {
                            type: "object",
                            additionalProperties: false,
                            required: ["palette", "colorTemperature", "keyLight", "fillLight", "rimLight", "contrast", "materialResponse", "skinToneProtection", "inheritFromPrevious", "transitionToNext"],
                            properties: {
                                palette: { type: "string" },
                                colorTemperature: { type: "string" },
                                keyLight: { type: "string" },
                                fillLight: { type: "string" },
                                rimLight: { type: "string" },
                                contrast: { type: "string" },
                                materialResponse: { type: "string" },
                                skinToneProtection: { type: "string" },
                                inheritFromPrevious: { type: "string" },
                                transitionToNext: { type: "string" },
                            },
                        },
                        continuity: {
                            type: "object",
                            additionalProperties: false,
                            required: ["shotSize", "cameraAngle", "composition", "characterBlocking", "gazeDirection", "actionStart", "actionEnd", "screenDirection", "axisRule", "continuityNotes"],
                            properties: {
                                shotSize: { type: "string" },
                                cameraAngle: { type: "string" },
                                composition: { type: "string" },
                                characterBlocking: { type: "string", description: "按同一镜头或场景参照系写每位实际出镜人物相对座位/长凳/地面/通道/门窗/道具及其他人物的左右或前后位置、朝向、姿势支撑和接触关系；不得添加未声明人物。" },
                                gazeDirection: { type: "string", description: "写每位实际出镜人物的视线目标，并与上述人物关系和可见场景结构一致。" },
                                actionStart: { type: "string" },
                                actionEnd: { type: "string" },
                                screenDirection: { type: "string" },
                                axisRule: { type: "string" },
                                continuityNotes: { type: "string" },
                            },
                        },
                        framePlan: {
                            type: "object",
                            additionalProperties: false,
                            required: ["start", "end", "frames"],
                            description:
                                "必须按真实可见动作节点拆分 1-9 个连续帧段；每帧 imagePrompt 只描述该时刻可见的姿态、表情、视线、手部/身体或道具/环境状态，不得复制整镜头提示词后追加通用阶段词。每帧还要把人物放在当前场景可用的座位、长凳、地面、通道、门窗或其他结构关系中，坐姿有明确支撑，人与物接触和多人相对方位真实可行；原文未声明的人物不入画。对白不必写入图片，但对白造成的表情、视线、手部或道具变化必须写入对应帧。",
                            properties: {
                                start: { type: "object", additionalProperties: false, required: ["source"], properties: { source: { type: "string", enum: ["independent", "previous_accepted_actual_tail"] } } },
                                end: { type: "object", additionalProperties: false, required: ["required"], properties: { required: { type: "boolean" } } },
                                frames: {
                                    type: "array",
                                    minItems: 1,
                                    maxItems: 9,
                                    items: {
                                        type: "object",
                                        additionalProperties: false,
                                        required: ["id", "sequenceIndex", "startSecond", "endSecond", "actionPrompt", "imagePrompt"],
                                        properties: {
                                            id: { type: "string" },
                                            sequenceIndex: { type: "integer", minimum: 1 },
                                            startSecond: { type: "number", minimum: 0 },
                                            endSecond: { type: "number", exclusiveMinimum: 0 },
                                            actionPrompt: { type: "string" },
                                            imagePrompt: { type: "string" },
                                        },
                                    },
                                },
                                referenceManifest: {
                                    type: "array",
                                    description: "如果输入镜头已有 referenceManifest，必须原样保留 alias、role、purpose 与资产/帧绑定，不得新增、删除或重排引用。",
                                    items: {
                                        type: "object",
                                        additionalProperties: false,
                                        required: ["alias", "role", "purpose"],
                                        properties: {
                                            alias: { type: "string" },
                                            role: { type: "string", enum: ["previous_actual_tail", "character_anchor", "scene_anchor", "prop_anchor", "action_keyframe", "composition_keyframe"] },
                                            purpose: { type: "string" },
                                            assetId: { type: "string" },
                                            shotId: { type: "string" },
                                            frameEvidenceId: { type: "string" },
                                        },
                                    },
                                },
                                referenceCount: {
                                    type: "object",
                                    additionalProperties: false,
                                    properties: { min: { type: "integer", minimum: 1 }, max: { type: "integer", minimum: 1 } },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};

export const dramaVideoPromptTool = {
    name: "generate_drama_video_prompts",
    description: "根据已经生成并验收的顺序帧、固定资产和连续性信息，执行当前 Seedance 2.5 导演 Skill，为每个镜头生成符合公开格式的图生视频提示词和逐帧动作计划",
    parameters: {
        type: "object",
        additionalProperties: false,
        required: ["shots"],
        properties: {
            shots: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["shotId", "videoPrompt", "framePlan"],
                    properties: {
                        shotId: { type: "string" },
                        videoPrompt: {
                            type: "string",
                            description:
                                "只返回执行当前 Seedance 2.5 导演 Skill 后的完整公开视频提示词字符串；公开字段固定按素材绑定（有参考图时）、动态意图、全局设定、起始可见状态、时间段动作、单一主运镜、环境压力与视觉母题、视觉风格与光色、声音意图、结束画面、连续性锁、针对性约束逐行输出；不另设顶层触发或主体动作与反应字段，动作与触发只写在每个时间段内部。输入 referenceMaterials 已提供每项的 alias、role、purpose 和顺序，素材绑定必须逐字使用这些 alias，不得自行猜编号；videoPrompt 本身必须逐段写出每个真实时间范围以及起点、动作与触发、可见衔接和终点，具体画面状态必须与 framePlan.frames 一致。framePlan.frames 是同一公开提示词的结构化镜像，不得用它替代 videoPrompt 正文。有 referenceMaterials 时由 Skill 生成素材绑定和对应职责；不得输出模式、内部 ID、URL、JSON 或解释",
                        },
                        framePlan: {
                            type: "object",
                            additionalProperties: false,
                            required: ["frames"],
                            properties: {
                                frames: {
                                    type: "array",
                                    minItems: 1,
                                    maxItems: 9,
                                    description: "必须由 Agent 为每个真实动作节点返回具体的起点、动作与触发、可见衔接、终点和画面状态；沿用输入帧的 sequenceIndex、startSecond 和 endSecond，不得用通用阶段词代替具体描述",
                                    items: {
                                        type: "object",
                                        additionalProperties: false,
                                        required: ["id", "sequenceIndex", "startSecond", "endSecond", "startPrompt", "actionPrompt", "transitionPrompt", "endPrompt", "imagePrompt"],
                                        properties: {
                                            id: { type: "string" },
                                            sequenceIndex: { type: "integer", minimum: 1 },
                                            startSecond: { type: "number", minimum: 0 },
                                            endSecond: { type: "number", exclusiveMinimum: 0 },
                                            startPrompt: { type: "string" },
                                            actionPrompt: { type: "string" },
                                            transitionPrompt: { type: "string" },
                                            endPrompt: { type: "string" },
                                            imagePrompt: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};

export const dramaImagePromptTool = {
    name: "generate_drama_image_prompts",
    description: "根据当前镜头事实、固定资产和连续性约束，生成可直接用于 Seedance 2.0 图片参考帧的静态画面提示词；必须按固定字段逐行组织，每个非空字段独立一行",
    parameters: {
        type: "object",
        additionalProperties: false,
        required: ["shots"],
        properties: {
            shots: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["shotId", "imagePrompt"],
                    properties: {
                        shotId: { type: "string" },
                        imagePrompt: {
                            type: "string",
                            description:
                                "只写可执行的单一静态画面提示词；按静态关键帧、可见状态、可见表演状态、景别、机位与构图、站位与视线、三层空间、光色与风格、负面约束组织，每个非空字段独立一行，字段之间不得用逗号或分号压成一段；站位与视线必须在同一参照系下具体说明人物相对场景可用座位、长凳、通道、门窗、道具和其他实际出镜人物的位置、朝向、视线、支撑和接触关系，不能把人摆在不合场景常理的位置，也不得添加未声明人物；参考图用途由 framePlan.referenceManifest 和服务端实际绑定提供，不在图片正文新增参考图职责段；不得写运镜、焦段、时间段、动作过程、对白、声音、内部 ID、URL 或解释",
                        },
                    },
                },
            },
        },
    },
};

export const dramaReviewCompletionTool = {
    name: "complete_drama_review",
    description: "只补齐短剧内容审核中缺失的表演、灯光和计划性连续性字段，不改变已有字段和镜头事实；可以只返回本次真正补齐的字段",
    parameters: {
        type: "object",
        additionalProperties: false,
        required: ["shots"],
        properties: {
            shots: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["shotId"],
                    properties: {
                        shotId: { type: "string" },
                        performancePlan: {
                            type: "object",
                            description: "可执行的人物表演：情绪目标、情绪递进、语气、节奏、呼吸、克制度，以及起始/中段/结束三拍的情绪、眉眼嘴角下颌、视线和身体动作。",
                            additionalProperties: false,
                            properties: {
                                emotionalObjective: { type: "string" },
                                emotionalArc: { type: "string" },
                                speechStyle: { type: "string" },
                                pace: { type: "string" },
                                breath: { type: "string" },
                                restraintLevel: { type: "string" },
                                beats: { type: "object", additionalProperties: false, properties: { start: performanceBeatSchema(), middle: performanceBeatSchema(), end: performanceBeatSchema() } },
                            },
                        },
                        dialoguePerformance: {
                            type: "array",
                            description: "按 utterances 逐句填写对白意图、语气、节奏、停顿、重音，以及说话前/中/后的面部反应。",
                            items: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    utteranceId: { type: "string" },
                                    intent: { type: "string" },
                                    tone: { type: "string" },
                                    pace: { type: "string" },
                                    pause: { type: "string" },
                                    emphasis: { type: "string" },
                                    facialReactionBefore: { type: "string" },
                                    facialReactionDuring: { type: "string" },
                                    facialReactionAfter: { type: "string" },
                                },
                            },
                        },
                        lightingPlan: {
                            type: "object",
                            description: "可执行的色彩灯光：色板、色温、主光、补光、轮廓光、反差、材质反射、肤色保护，以及从上一镜继承和向下一镜过渡。",
                            additionalProperties: false,
                            properties: {
                                palette: { type: "string" },
                                colorTemperature: { type: "string" },
                                keyLight: { type: "string" },
                                fillLight: { type: "string" },
                                rimLight: { type: "string" },
                                contrast: { type: "string" },
                                materialResponse: { type: "string" },
                                skinToneProtection: { type: "string" },
                                inheritFromPrevious: { type: "string" },
                                transitionToNext: { type: "string" },
                            },
                        },
                        continuity: {
                            type: "object",
                            description: "镜头连续性关键词：景别、机位与角度、构图、人物站位、视线方向、动作起始、动作结束、屏幕运动方向、轴线规则、相邻镜头衔接备注。",
                            additionalProperties: false,
                            properties: {
                                shotSize: { type: "string" },
                                cameraAngle: { type: "string" },
                                composition: { type: "string" },
                                characterBlocking: { type: "string" },
                                gazeDirection: { type: "string" },
                                actionStart: { type: "string" },
                                actionEnd: { type: "string" },
                                screenDirection: { type: "string" },
                                axisRule: { type: "string" },
                                continuityNotes: { type: "string" },
                            },
                        },
                        entryState: { type: "object", description: "镜头开始时的可观察状态：每位角色相对座位/长凳/床沿/地面/通道/门窗/道具及其他角色的位置、姿态、支撑或接触、视线和表情/动作，关键道具状态，环境、光色和轴线。" },
                        exitState: { type: "object", description: "镜头结束时的可观察状态：每位角色相对座位/长凳/床沿/地面/通道/门窗/道具及其他角色的位置、姿态、支撑或接触、视线和表情/动作，关键道具状态，环境、光色和轴线，供下一镜继承。" },
                        continuityEdge: { type: "object" },
                    },
                },
            },
        },
    },
};

export function dramaReviewCompletionToolForFields(fields: string[]) {
    const parameters = dramaReviewCompletionTool.parameters as { properties: { shots: { items: { properties: Record<string, unknown> } } } };
    const selectedFields = [...new Set(fields.filter((field) => parameters.properties.shots.items.properties[field]))];
    const selectedProperties = Object.fromEntries(selectedFields.map((field) => [field, requiredReviewCompletionProperty(field, parameters.properties.shots.items.properties[field])]));
    return {
        ...dramaReviewCompletionTool,
        description: `${dramaReviewCompletionTool.description}。本次只处理：${selectedFields.join("、")}`,
        parameters: {
            ...dramaReviewCompletionTool.parameters,
            properties: {
                ...parameters.properties,
                shots: {
                    ...parameters.properties.shots,
                    items: { ...parameters.properties.shots.items, required: ["shotId", ...selectedFields], properties: { shotId: parameters.properties.shots.items.properties.shotId, ...selectedProperties } },
                },
            },
        },
    };
}

export function dramaReviewCompletionFieldInstructions(fields: string[]) {
    const instructions: Record<string, string> = {
        performancePlan: "performancePlan 必须填写 emotionalObjective、emotionalArc、speechStyle、pace、breath、restraintLevel，以及 beats.start/middle/end 各自的 emotion、facialAction（眉眼嘴角下颌）、gaze、bodyAction。",
        dialoguePerformance: "dialoguePerformance 必须按输入 utterances 的 utteranceId 逐句填写 intent、tone、pace、pause、emphasis、facialReactionBefore、facialReactionDuring、facialReactionAfter；没有对白时返回空数组。",
        lightingPlan: "lightingPlan 必须填写 palette、colorTemperature、keyLight、fillLight、rimLight、contrast、materialResponse、skinToneProtection、inheritFromPrevious、transitionToNext。",
        continuity:
            "continuity 必须填写 shotSize（景别）、cameraAngle（机位角度）、composition（构图）、characterBlocking（按同一参照系写每位角色相对座位/长凳/床沿/地面/通道/门窗/道具及其他角色的左右或前后、朝向、支撑和接触）、gazeDirection（视线）、actionStart/actionEnd（动作起止）、screenDirection（屏幕运动方向）、axisRule（轴线规则）、continuityNotes（相邻镜头衔接）。",
        entryState: "entryState 必须写镜头开始时每位角色相对场景结构和其他角色的位置、姿态、支撑/接触、视线/表情/动作、关键道具状态、环境、光色和轴线等可观察状态。",
        exitState: "exitState 必须写镜头结束时每位角色相对场景结构和其他角色的位置、姿态、支撑/接触、视线/表情/动作、关键道具状态、环境、光色和轴线等可观察状态，供下一镜继承。",
    };
    return fields
        .map((field) => instructions[field])
        .filter(Boolean)
        .join("\n");
}

function requiredReviewCompletionProperty(field: string, value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const definition = { ...(value as Record<string, unknown>) };
    const requiredByField: Record<string, string[]> = {
        performancePlan: ["emotionalObjective", "emotionalArc", "speechStyle", "pace", "breath", "restraintLevel", "beats"],
        lightingPlan: ["palette", "colorTemperature", "keyLight", "fillLight", "rimLight", "contrast", "materialResponse", "skinToneProtection", "inheritFromPrevious", "transitionToNext"],
        continuity: ["shotSize", "cameraAngle", "composition", "characterBlocking", "gazeDirection", "actionStart", "actionEnd", "screenDirection", "axisRule", "continuityNotes"],
        entryState: [],
        exitState: [],
    };
    if (field === "dialoguePerformance") {
        const item = definition.items;
        if (item && typeof item === "object" && !Array.isArray(item)) {
            definition.items = { ...(item as Record<string, unknown>), required: ["utteranceId", "intent", "tone", "pace", "pause", "emphasis", "facialReactionBefore", "facialReactionDuring", "facialReactionAfter"] };
        }
    }
    if (requiredByField[field]) definition.required = requiredByField[field];
    if (field === "performancePlan") {
        const properties = definition.properties;
        const beats = properties && typeof properties === "object" && !Array.isArray(properties) ? (properties as Record<string, unknown>).beats : undefined;
        if (beats && typeof beats === "object" && !Array.isArray(beats)) definition.properties = { ...(properties as Record<string, unknown>), beats: { ...(beats as Record<string, unknown>), required: ["start", "middle", "end"] } };
    }
    return definition;
}

function performanceBeatSchema() {
    return {
        type: "object",
        additionalProperties: false,
        required: ["emotion", "facialAction", "gaze", "bodyAction"],
        properties: { emotion: { type: "string" }, facialAction: { type: "string" }, gaze: { type: "string" }, bodyAction: { type: "string" } },
    };
}
