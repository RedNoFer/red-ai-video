import type { DramaAssetPromptFields, DramaAssetRefinementProposal, DramaContinuityState, DramaEpisode, DramaFrameBeat, DramaNamedAsset, DramaProject, DramaReferenceManifestItem, DramaShot } from "@/lib/drama-project-contract";
import {
    DRAMA_CHARACTER_FACE_MODELING_RULES,
    DRAMA_CHARACTER_HAIR_MODELING_RULES,
    DRAMA_CHARACTER_NEGATIVE_RULES,
    DRAMA_CHARACTER_RENDER_STYLE,
    DRAMA_CHARACTER_STUDIO_LIGHT_RULES,
    DRAMA_CHARACTER_SUPPLIER_QUALITY_RULES,
    DRAMA_CHARACTER_WARDROBE_MATERIAL_RULES,
} from "@/lib/drama-character-rules";
import { resolveDramaStyleContract, sanitizeDramaVisualPrompt } from "@/lib/drama-style";
import { formatPromptFieldLines } from "@/lib/drama-frame-sequence";

export type DramaAssetGenerationPreflight = { ok: true; constraints: string[] } | { ok: false; errors: string[]; constraints: string[] };

export type CompiledDramaPrompts = {
    imagePrompt: string;
    startFramePrompt: string;
    endFramePrompt: string;
    videoPrompt: string;
};

/** Server-derived contract shared by video and keyframe generation. */
export type DerivedShotPromptContract = {
    references: DramaReferenceManifestItem[];
    entryState: DramaContinuityState;
    exitState: DramaContinuityState;
    beats: Array<Pick<DramaFrameBeat, "id" | "sequenceIndex" | "startSecond" | "endSecond" | "startPrompt" | "actionPrompt" | "transitionPrompt" | "endPrompt" | "imagePrompt">>;
    camera: { shotSize: string; cameraAngle: string; composition: string; movement: string; reason: string };
    visual: { environmentPressure: string; motif: string; palette: string; lighting: string; texture: string };
    audio?: string;
    constraints: string[];
};

export const DRAMA_CHARACTER_TURNAROUND_SIZE = "16:9";
export const DRAMA_CHARACTER_TURNAROUND_LABEL = "四视图角色基准板";
export const DRAMA_CHARACTER_TURNAROUND_LAYOUT = "身份特写、正面全身立姿、严格左侧面全身立姿、背面全身立姿四个视图，同一角色等距水平排列；身份特写置于同一基准板内，只用于锁定五官、脸型、发际线和脸部识别，后三个视图必须从头顶到鞋靴完整入画";

/**
 * Asset prompts are public supplier text, but their six sections are also the
 * durable contract used by production packages and later regeneration.
 */
export const DRAMA_ASSET_PROMPT_LABELS = ["主体与资产类型", "身份/结构锚点", "可见状态与材质", "构图与画幅", "光色与风格", "负面约束"] as const;

export function formatDramaAssetPrompt(value: string) {
    const prompt = value.trim();
    if (!prompt) return "";
    const labels = DRAMA_ASSET_PROMPT_LABELS.join("|");
    return prompt
        .replace(new RegExp(`[\\s,，;；。]+(?=(?:${labels})[：:])`, "gu"), "\n")
        .replace(/[ \t]*\n[ \t]*/gu, "\n")
        .trim();
}

export function isStructuredDramaAssetPrompt(value: string | undefined) {
    const prompt = formatDramaAssetPrompt(value || "");
    if (!prompt) return false;
    const lines = prompt
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean);
    const indexes = DRAMA_ASSET_PROMPT_LABELS.map((label) => lines.findIndex((line) => line.startsWith(`${label}：`) || line.startsWith(`${label}:`)));
    return indexes.every((index) => index >= 0) && indexes.every((index, position) => position === 0 || index > indexes[position - 1]);
}

export function hasDramaAssetPromptQuality(value: string | undefined, kind: "角色" | "场景" | "道具") {
    const prompt = formatDramaAssetPrompt(value || "");
    if (!isStructuredDramaAssetPrompt(prompt)) return false;
    const required = kind === "角色" ? ["自然骨骼", "五官", "头发", "服装", "纯白色", "四视图", "身份特写", "严格左侧面", "负面约束"] : ["主体", "材质", "构图", "负面约束"];
    if (!required.every((term) => prompt.includes(term))) return false;
    if (kind !== "道具") return true;
    const visibleLines = prompt
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("负面约束：") && !line.startsWith("负面约束:"));
    return visibleLines.every((line) => !hasDramaPropNarrative(line)) && /(?:单一道具主体|只展示道具|道具本体)/u.test(prompt) && /(?:静置|展示)/u.test(prompt);
}

/** Read the editable six-section prompt back into the durable asset fields. */
export function dramaAssetPromptFields(value: string, fallback: DramaAssetPromptFields): DramaAssetPromptFields | undefined {
    const prompt = formatDramaAssetPrompt(value);
    if (!isStructuredDramaAssetPrompt(prompt)) return undefined;
    const field = (label: string) => prompt.match(new RegExp(`(?:^|\\n)${label}[：:]\\s*([^\\n]*)`, "u"))?.[1]?.trim() || "";
    const style = field("光色与风格");
    const palette = style.match(/(?:角色固有色彩|固定色彩)[：:]([^；。]+)/u)?.[1]?.trim() || "";
    return {
        description: fallback.description,
        visualIdentity: field("身份/结构锚点") || fallback.visualIdentity,
        styling: field("可见状态与材质") || fallback.styling,
        colorPalette: palette || fallback.colorPalette,
        consistencyRules: field("一致性锁定") || fallback.consistencyRules,
    };
}

export function deriveDramaShotPromptContract(project: DramaProject, _episode: DramaEpisode, shot: DramaShot): DerivedShotPromptContract {
    const scene = project.scenes.find((item) => item.id === shot.sceneId);
    const continuity = shot.continuity;
    const lighting = shot.lightingPlan;
    const entryState = shot.entryState || { characters: [], props: [] };
    const exitState = shot.exitState || { characters: [], props: [] };
    const environmentPressure = scene?.profile?.spatialRules?.find(Boolean) || scene?.description || entryState.environment || "";
    const palette = lighting?.palette || shot.colorPalette || project.productionBible?.colorScript || "";
    const lightingText = [lighting?.keyLight, lighting?.fillLight, lighting?.rimLight].filter(Boolean).join("；") || shot.lighting || entryState.lighting || "";
    return {
        references: shot.framePlan?.referenceManifest || [],
        entryState,
        exitState,
        beats: (shot.framePlan?.frames || []).map(({ id, sequenceIndex, startSecond, endSecond, startPrompt, actionPrompt, transitionPrompt, endPrompt, imagePrompt }) => ({
            id,
            sequenceIndex,
            startSecond,
            endSecond,
            startPrompt,
            actionPrompt,
            transitionPrompt,
            endPrompt,
            imagePrompt,
        })),
        camera: {
            shotSize: continuity?.shotSize || "",
            cameraAngle: continuity?.cameraAngle || "",
            composition: continuity?.composition || "",
            movement: shot.cameraMotion || "",
            reason: continuity?.actionEnd ? `响应动作变化：${continuity.actionEnd}` : "",
        },
        visual: { environmentPressure, motif: project.seriesBible?.visualMotifs?.find(Boolean) || "", palette, lighting: lightingText, texture: resolveDramaStyleContract(project).visualDescription },
        audio: [shot.sound?.ambience, shot.sound?.soundEffects, shot.sound?.music].filter(Boolean).join("；") || undefined,
        constraints: [shot.negativePrompt, continuity?.continuityNotes].filter(Boolean) as string[],
    };
}

/** Remove reference manifests before the current request order is appended. */
export function stripDramaReferenceBindingSections(prompt: string) {
    const lines = prompt.trim().split(/\r?\n/u);
    const output: string[] = [];
    let skipping = false;
    for (const line of lines) {
        const value = line.trim();
        if (/^(?:参考图顺序（与(?:视频)?请求数组完全一致）|实际参考图绑定（编号与本次请求图片数组完全一致）|素材绑定|参考图职责(?:计划)?)[：:]?/u.test(value)) {
            skipping = true;
            continue;
        }
        if (skipping && (/^@图片\d+[：:]/u.test(value) || /^必须逐图按上述职责使用/u.test(value) || /^执行要求：逐图识别/u.test(value) || !value)) continue;
        skipping = false;
        output.push(line);
    }
    return output.join("\n").trim();
}

/** Append image duties in the exact order used by the supplier request. */
export function appendDramaImageReferenceBindings(prompt: string, references: Array<{ id: string; label?: string; binding?: string }>) {
    const base = stripDramaReferenceBindingSections(prompt);
    if (!references.length) return base;
    const manifest = references
        .map((reference, index) => {
            const label = reference.label || (reference.id.startsWith("continuity-") ? "上一帧连续性锚点" : "项目资产基准图");
            return `@图片${index + 1}：${label}${reference.binding ? `；绑定规则：${reference.binding}` : ""}`;
        })
        .join("\n");
    return [base, `实际参考图绑定（编号与本次请求图片数组完全一致）：\n${manifest}\n执行要求：逐图识别并按上述绑定关系使用；角色图不得替代场景，场景图不得改写角色，连续性帧优先约束当前可见状态。未列入本清单的图片不得假定已引用。`]
        .filter(Boolean)
        .join("\n");
}

export function compileDramaShotPrompts(project: DramaProject, episode: DramaEpisode, shot: DramaShot): CompiledDramaPrompts {
    void project;
    void episode;
    const imagePrompt = formatPromptFieldLines(shot.imagePrompt || "", "static");
    const startFramePrompt = formatPromptFieldLines(shot.startFramePrompt || shot.imagePrompt || "", "static");
    const endFramePrompt = formatPromptFieldLines(shot.endFramePrompt || shot.imagePrompt || "", "static");
    const videoPrompt = shot.executionVideoPrompt?.trim() || shot.videoPrompt?.trim() || "";
    return {
        imagePrompt,
        startFramePrompt,
        endFramePrompt,
        videoPrompt,
    };
}

export function dramaFrameVisibleState(imagePrompt: string, actionPrompt = "") {
    void actionPrompt;
    const candidates = [extractPromptField(imagePrompt, "可见状态"), extractPromptField(imagePrompt, "可见表演状态"), extractPromptField(imagePrompt, "站位与视线"), extractPromptField(imagePrompt, "静态关键帧")]
        .map((value) => value.trim())
        .filter(Boolean);
    return candidates.find((value) => !isGenericTimelineState(value)) || candidates[0] || "";
}

function isGenericTimelineState(value: string) {
    return /^(?:动作入口已成立|镜头推进后主体重心、视线或手部位置已经改变|关键动作已经发生|结果状态继续发展|结果状态与转场落点已经成立|主体处于可辨识准备姿态|道具或环境出现可见结果|主体反应或道具关系已经转向|(?:表情|情绪|视线|姿态|动作|身体状态|手部状态)由.+(?:转为|变为|变化为))/u.test(
        value,
    );
}

function extractPromptField(value: string, label: string) {
    const labels = ["画面主体", "静态关键帧", "可见状态", "可见表演状态", "构图与空间", "景别", "机位与构图", "站位与视线", "三层空间", "光色与风格", "针对性约束", "负面约束"];
    const nextLabels = labels.filter((item) => item !== label).join("|");
    const match = value.match(new RegExp(`(?:^|[\\n；])\\s*${label}[：:]\\s*([\\s\\S]*?)(?=(?:[\\n；]\\s*(?:${nextLabels})[：:]|$))`, "u"));
    return match?.[1]?.trim().replace(/[；。]+$/u, "") || "";
}

/**
 * Runtime generation must always use a fresh compilation so stale execution
 * snapshots cannot override the current project style or asset facts.
 */
export function compileDramaShotExecutionPrompts(project: DramaProject, episode: DramaEpisode, shot: DramaShot) {
    return compileDramaShotPrompts(project, episode, shot);
}

export function resolveDramaFrameScene(project: DramaProject, shot: DramaShot, beat?: DramaFrameBeat) {
    const fallback = project.scenes.find((item) => item.id === shot.sceneId);
    if (!beat) return fallback;
    const sceneReferences = Array.from(
        new Map(
            [...(shot.framePlan?.referenceManifest || []).filter((item) => item.role === "scene_anchor" && item.assetId).map((item) => project.scenes.find((scene) => scene.id === item.assetId)), ...project.scenes]
                .filter((scene): scene is NonNullable<typeof scene> => Boolean(scene))
                .map((scene) => [scene.id, scene] as const),
        ).values(),
    );
    const frameText = `${beat.imagePrompt} ${beat.actionPrompt}`.toLocaleLowerCase();
    const candidates = sceneReferences.length > 1 ? sceneReferences : project.scenes;
    const direct = candidates
        .map((scene) => {
            const terms = sceneMatchTerms(scene.name)
                .filter((term) => term.length >= 2)
                .map((term) => term.toLocaleLowerCase());
            const positions = terms.map((term) => frameText.lastIndexOf(term)).filter((position) => position >= 0);
            return { scene, position: positions.length ? Math.max(...positions) : -1, termLength: positions.length ? Math.max(...terms.filter((term) => frameText.includes(term)).map((term) => term.length)) : 0 };
        })
        .filter((item) => item.position >= 0)
        .sort((left, right) => right.position - left.position || right.termLength - left.termLength);
    if (direct[0]) return direct[0].scene;
    const scoreScenes = (text: string) =>
        candidates
            .map((scene) => {
                const fields = [scene.name, scene.description, scene.profile?.visualIdentity, scene.profile?.consistencyRules].filter(Boolean) as string[];
                const score = fields.reduce((total, field, index) => {
                    const terms = sceneMatchTerms(field);
                    return total + (terms.some((term) => text.includes(term.toLocaleLowerCase())) ? (index === 0 ? 100 : 10) : 0);
                }, 0);
                return { scene, score };
            })
            .sort((left, right) => right.score - left.score);
    const scored = scoreScenes(frameText);
    if (scored[0]?.score) return scored[0].scene;
    return sceneReferences.find((scene) => scene.id === shot.sceneId) || fallback;
}

function sceneMatchTerms(value: string) {
    return (value.match(/[\p{Script=Han}]+|[A-Za-z0-9][A-Za-z0-9_-]*/gu) || [value]).flatMap((term) => {
        if (!/^[\p{Script=Han}]+$/u.test(term) || term.length < 2) return [term];
        return [term, ...Array.from({ length: term.length - 1 }, (_, index) => term.slice(index, index + 2))];
    });
}

export function compileDramaFrameSupplierPrompt(project: DramaProject, episode: DramaEpisode, shot: DramaShot, beat?: DramaFrameBeat, phase: "start" | "end" | "keyframe" = "keyframe") {
    void project;
    void episode;
    const source = phase === "start" ? shot.startFramePrompt || shot.imagePrompt : phase === "end" ? shot.endFramePrompt || shot.imagePrompt : beat?.imagePrompt || shot.imagePrompt;
    return formatPromptFieldLines(source || "", "static");
}

export function compileDramaDialogueAudioInstructions(shot: DramaShot) {
    const plan = shot.performancePlan;
    return compact([
        plan ? `整体语气：${plan.speechStyle}；节奏：${plan.pace}；呼吸：${plan.breath}；情绪递进：${plan.emotionalArc}` : "",
        shot.dialoguePerformance?.length ? shot.dialoguePerformance.map((item) => `【${item.utteranceId}】意图${item.intent}，语气${item.tone}，节奏${item.pace}，停顿${item.pause}，重音${item.emphasis}`).join("\n") : "",
    ]).join("\n");
}

function performanceLines(shot: DramaShot) {
    const plan = shot.performancePlan;
    const beats = plan?.beats;
    return compact([
        plan ? `表演目标：${plan.emotionalObjective}` : "",
        plan ? `情绪递进：${plan.emotionalArc}` : "",
        plan ? `说话方式：${plan.speechStyle}；节奏：${plan.pace}；呼吸：${plan.breath}；克制度：${plan.restraintLevel}` : "",
        shot.performanceNotes ? `补充表演说明：${shot.performanceNotes}` : "",
        beats ? `微表情起始：${beatText(beats.start)}` : "",
        beats ? `微表情中段：${beatText(beats.middle)}` : "",
        beats ? `微表情结束：${beatText(beats.end)}` : "",
        shot.dialoguePerformance?.length
            ? `逐句表演：${shot.dialoguePerformance.map((item) => `【${item.utteranceId}】意图${item.intent}，语气${item.tone}，节奏${item.pace}，停顿${item.pause}，重音${item.emphasis}；开口前${item.facialReactionBefore}，说话中${item.facialReactionDuring}，说完后${item.facialReactionAfter}`).join("；")}`
            : "",
    ]).join("\n");
}

function beatText(beat: NonNullable<NonNullable<DramaShot["performancePlan"]>["beats"]>["start"]) {
    return `情绪${beat.emotion}；面部${beat.facialAction}；视线${beat.gaze}；身体${beat.bodyAction}`;
}

function lightingLines(shot: DramaShot) {
    const plan = shot.lightingPlan;
    return plan
        ? `色彩与灯光：色板${plan.palette}；色温${plan.colorTemperature}；主光${plan.keyLight}；补光${plan.fillLight}；轮廓光${plan.rimLight}；反差${plan.contrast}；材质反射${plan.materialResponse}；肤色保护${plan.skinToneProtection}；上一镜继承${plan.inheritFromPrevious}；下一镜过渡${plan.transitionToNext}`
        : "";
}

export function compileDramaAssetReferencePrompt(project: Pick<DramaProject, "title" | "style" | "ratio" | "productionBible">, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具") {
    const savedSupplierPrompt = asset.supplierPrompt?.trim() || "";
    // A legacy one-line override must not bypass the fixed asset contract. It
    // remains stored for editing, while generation falls back to the durable
    // profile and recompiles the six public sections below.
    if (hasDramaAssetPromptQuality(savedSupplierPrompt, kind) && (kind !== "场景" || (savedSupplierPrompt.includes("全景") && savedSupplierPrompt.includes("高清")))) return formatDramaAssetPrompt(savedSupplierPrompt);
    const styleContract = resolveDramaStyleContract(project);
    const profile = asset.profile;
    const description = kind === "道具" ? sanitizeDramaPropFacts(asset.description) : sanitizeDramaVisualPrompt(asset.description);
    const visualIdentity = joinAssetPromptFacts(kind === "道具" ? [sanitizeDramaPropFacts(profile?.visualIdentity), ...(profile?.identityAnchors || []).map(sanitizeDramaPropFacts)] : [profile?.visualIdentity, ...(profile?.identityAnchors || [])]);
    const styling = kind === "道具" ? sanitizeDramaPropFacts(profile?.styling) : sanitizeDramaVisualPrompt(profile?.styling || "");
    const stylingForPrompt = description.length >= styling.length && styling && description.includes(styling) ? "" : styling;
    const colorPalette = kind === "道具" ? sanitizeDramaPropFacts(profile?.colorPalette) : sanitizeDramaVisualPrompt(profile?.colorPalette || "");
    const consistency = joinAssetPromptFacts(
        kind === "道具"
            ? [sanitizeDramaPropFacts(profile?.consistencyRules), ...(profile?.spatialRules || []).map(sanitizeDramaPropFacts), ...(profile?.stateRules || []).map(sanitizeDramaPropFacts)]
            : [profile?.consistencyRules, ...(profile?.spatialRules || []), ...(profile?.stateRules || [])],
    );
    const globalStyle = [styleContract.visualDescription, styleContract.artStyle ? `全局画风规格：${styleContract.artStyle}` : "", styleContract.colorScript ? `全局色彩脚本：${styleContract.colorScript}` : ""].filter(Boolean).join("；");
    const sceneQuality = kind === "场景" ? "高清完整单视角全景建立图；建筑透视稳定，墙体、门窗、地面和桌椅等直线结构不弯折；入口、出口、主要陈设、材质、光向和轴线清晰可读，背景细节不使用模糊虚化遮蔽" : "";
    const forbidden = joinAssetPromptConstraints([
        ...(profile?.forbiddenChanges || []).filter((value) => kind !== "场景" || !/(?:拼版|多视角|分格)/u.test(value)),
        kind === "角色" ? DRAMA_CHARACTER_NEGATIVE_RULES : kind === "场景" ? "人物、不同地点、方向标签、文字、水印、logo" : "人物、手部、持有人、人物动作、书写过程、额外主体、拼版、多视角、文字、水印、logo",
        styleContract.globalNegativePrompt || "",
    ]);
    const layout =
        kind === "角色"
            ? `${DRAMA_CHARACTER_TURNAROUND_SIZE} 横向，纯白色无缝背景；${DRAMA_CHARACTER_TURNAROUND_LAYOUT}。四个视图同一基线、同一身份、同一头身比，身份特写保持清晰五官，后三个视图全身从头顶、完整头部、躯干、双臂、双手、双腿到鞋靴完整入画。`
            : kind === "场景"
              ? `${project.ratio || "9:16"} 画幅，一张高清、完整、无人物、无文字的单视角场景全景建立图；完整呈现入口、出口、门窗、主要陈设、地面材质、光源方向、空间轴线、通道和人物动作所需的支撑面，不生成九宫格、分格或360°贴图。`
              : `${project.ratio || "9:16"} 画幅，单一道具主体完整入画，静置在中性展示台或符合项目风格的桌面上；只展示道具本体与关键材质细节，不出现人物、手部、持有人或人物动作。`;
    const characterStyle = styleContract.source === "custom" ? `项目视觉风格：${styleContract.visualDescription}` : "";
    const characterLightingStyle = [characterStyle, DRAMA_CHARACTER_RENDER_STYLE, DRAMA_CHARACTER_STUDIO_LIGHT_RULES, DRAMA_CHARACTER_SUPPLIER_QUALITY_RULES, colorPalette ? `角色固有色彩：${colorPalette}` : ""].filter(Boolean).join("；");
    return compact([
        `主体与资产类型：${kind}「${asset.name}」`,
        `身份/结构锚点：${joinAssetPromptFacts([description, visualIdentity]) || "沿用当前资产已确认设定"}`,
        consistency ? `一致性锁定：${consistency}` : "",
        `可见状态与材质：${stylingForPrompt || (kind === "道具" ? "道具本体静置展示，结构轮廓与关键材质细节清晰可见" : "按身份设定中的服装、材质和关键配件呈现")}${kind === "角色" ? `；${DRAMA_CHARACTER_FACE_MODELING_RULES}；${DRAMA_CHARACTER_HAIR_MODELING_RULES}；${DRAMA_CHARACTER_WARDROBE_MATERIAL_RULES}` : sceneQuality ? `；${sceneQuality}` : ""}`,
        `构图与画幅：${layout}`,
        `光色与风格：${kind === "角色" ? `${characterLightingStyle}；${globalStyle}` : `${globalStyle}${colorPalette ? `；固定色彩：${colorPalette}` : ""}`}`,
        `负面约束：${forbidden}`,
    ]).join("\n");
}

export function compileDramaAssetConstraints(project: Pick<DramaProject, "ratio"> & Partial<Pick<DramaProject, "style" | "productionBible">>, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具") {
    const styleContract = resolveDramaStyleContract(project);
    const forbidden = [
        ...(asset.profile?.forbiddenChanges?.length ? asset.profile.forbiddenChanges : ["未授权的服装、道具、饰品、武器、徽章、文字、水印或品牌"]),
        ...(kind === "场景" ? ["人物、不同地点、方向标签、文字、水印、logo"] : []),
        ...(styleContract.globalNegativePrompt ? [styleContract.globalNegativePrompt] : []),
    ].filter((value) => kind !== "场景" || !/(?:拼版|多视角|分格)/u.test(value));
    return compact([
        kind === "角色"
            ? `只输出一张完整、独立的 ${DRAMA_CHARACTER_TURNAROUND_SIZE} ${DRAMA_CHARACTER_TURNAROUND_LABEL}，不生成第二张候选图或额外版式。`
            : kind === "场景"
              ? `只输出一张完整、独立的 ${project.ratio || "9:16"} 高清单视角场景全景建立图；不生成九宫格、分格、第二地点或第二张候选图。`
              : `只输出一张完整、独立的 ${project.ratio || "9:16"} 设定图，不要拼版、联系表、多视角或分格模块。`,
        kind === "角色"
            ? `角色基准图必须固定为纯白色无缝背景四视图：${DRAMA_CHARACTER_TURNAROUND_LAYOUT}；身份特写与后三个全身视图严格保持同一脸型、五官、发际线、发型、服装、体态、关键识别配件和固有色。只允许这四个视图，不得新增任何人物、四分之三视图、主立绘、表情组、手部或道具拆解、额外角度、边框、网格、说明文字或水印。`
            : kind === "场景"
              ? "单张全景图展示同一无人物场景的完整空间状态：保持入口、出口、门窗、固定物件位置、材质、光色、空间拓扑和180度轴线清晰一致，所有背景结构与人物可用支撑面都必须可辨。"
              : "单一道具主体完整可见，结构轮廓和关键材质清晰，静置于符合项目视觉风格的环境或展示台中；只展示道具本体，不出现人物、手部、持有人或人物动作。",
        kind === "角色"
            ? "负面构图词：额外人物、额外视图、四分之三视图、主立绘、表情组、手部特写、道具拆解、场景背景、灰色背景、网格、边框、文字、水印、logo、无头、无脸、缺失头部、裁掉头部、裁脸、画面外人头、后三个全身视图被裁成半身或胸像、身份特写替代全身视图、只画服装。"
            : "",
        "不得添加设定中没有出现的主体、装饰或剧情信息，不添加文字、水印、logo、边框。",
        `严格保留${kind}的身份、轮廓、年龄感、色彩和一致性规则，不得擅自改写。`,
        kind === "角色"
            ? "禁止把中文说明、角色关系表、参数表或海报排版画进图片；四视图只表示同一角色，身份特写只负责五官识别，后三个视图负责全身比例与服装结构，不添加任何文字或其他模块。"
            : kind === "场景"
              ? "禁止人物、文字、方向标签、九宫格、分格、边框、水印、logo、海报排版、不同地点和360°贴图；只输出当前项目画幅内的一张完整单视角场景全景图。"
              : "禁止把中文说明、角色关系表、参数表、海报排版或多张视图画进图片；设定文字只作为生成约束，不是画面内容；禁止人物、手部、持有人、书写、持握和动作过程。",
        `禁止：${forbidden.join("；")}`,
    ]);
}

export function preflightDramaAssetGeneration(project: Pick<DramaProject, "ratio">, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具"): DramaAssetGenerationPreflight {
    const constraints = compileDramaAssetConstraints(project, asset, kind);
    const errors = compact([asset.name.trim() ? "" : "缺少资产名称"]);
    return errors.length ? { ok: false, errors, constraints } : { ok: true, constraints };
}

export function compileDramaAssetRefinementPrompt(project: Pick<DramaProject, "title" | "style" | "ratio" | "productionBible">, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具", proposal: DramaAssetRefinementProposal, request: string) {
    const updatedAsset = { ...asset, description: proposal.updatedDescription || asset.description, profile: proposal.updatedProfile, supplierPrompt: undefined };
    return compact([
        compileDramaAssetReferencePrompt(project, updatedAsset, kind),
        request.trim() ? `本轮调整：${request.trim()}` : "",
        proposal.preservedRules.length ? `一致性锁定：${proposal.preservedRules.join("；")}` : "",
        proposal.negativePrompt ? `负面约束补充：${proposal.negativePrompt}` : "",
    ]).join("\n");
}

function joinAssetPromptFacts(values: Array<string | undefined>) {
    return Array.from(
        new Set(
            values
                .map((value) =>
                    sanitizeDramaVisualPrompt(value || "")
                        .replace(/[、，,；;。\s]+$/u, "")
                        .trim(),
                )
                .filter(Boolean),
        ),
    ).join("；");
}

function sanitizeDramaPropFacts(value?: string) {
    return Array.from(
        new Set(
            sanitizeDramaVisualPrompt(value || "")
                .split(/[；;。\n]+/u)
                .map((item) => item.replace(/^(?:原文事实|导演建议|道具建议|剧情事实|镜头事实)[：:]\s*/u, "").trim())
                .filter((item) => item && !hasDramaPropNarrative(item)),
        ),
    ).join("；");
}

function hasDramaPropNarrative(value: string) {
    return /(?:原文事实|导演建议|剧情事实|镜头事实|时间段动作|动作与触发|可见表演|表演状态|奋笔|落笔|握笔|持握|拿起|挥动|走向|跑向|坐下|站起|转身|抬头|低头|看向|对着)/u.test(value);
}

function joinAssetPromptConstraints(values: Array<string | undefined>) {
    return Array.from(
        new Set(
            values.flatMap((value) =>
                (value || "")
                    .split(/[、，,；;]+/u)
                    .map((item) => item.replace(/[。\s]+$/u, "").trim())
                    .filter(Boolean),
            ),
        ),
    ).join("、");
}

export function sanitizeDramaSupplierText(value: string, project: DramaProject) {
    let result = value;
    for (const asset of [...project.characters, ...project.scenes, ...project.props, ...project.clues]) {
        if (asset.id && asset.id !== asset.name) result = result.split(asset.id).join(asset.name);
    }
    for (const shot of project.episodes.flatMap((episode) => episode.shots)) {
        if (shot.id && shot.id !== shot.title) result = result.split(shot.id).join(shot.title);
    }
    return result.replace(/\b(?:character|prop|scene|shot|frame|source|asset|continuity|storyboard|video|drama)-[A-Za-z0-9_-]{6,}\b/gi, "当前对象").replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "当前对象");
}

function compact(values: Array<string | undefined>) {
    return values.map((value) => value?.trim() || "").filter(Boolean);
}
