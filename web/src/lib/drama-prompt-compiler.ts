import type { DramaAssetRefinementProposal, DramaContinuityState, DramaEpisode, DramaFrameBeat, DramaNamedAsset, DramaProject, DramaReferenceManifestItem, DramaShot, DramaShotContinuity } from "@/lib/drama-project-contract";
import { resolveDramaStyleContract, sanitizeDramaVisualPrompt } from "@/lib/drama-style";
import { upgradeDramaFrameImagePrompt } from "@/lib/drama-frame-sequence";
import { DRAMA_ASSET_IMAGE_SKILL } from "@/lib/drama-image-skill";

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
        beats: (shot.framePlan?.frames || []).map(({ id, sequenceIndex, startSecond, endSecond, startPrompt, actionPrompt, transitionPrompt, endPrompt, imagePrompt }) => ({ id, sequenceIndex, startSecond, endSecond, startPrompt, actionPrompt, transitionPrompt, endPrompt, imagePrompt })),
        camera: { shotSize: continuity?.shotSize || "", cameraAngle: continuity?.cameraAngle || "", composition: continuity?.composition || "", movement: shot.cameraMotion || "", reason: continuity?.actionEnd ? `响应动作变化：${continuity.actionEnd}` : "" },
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
    const styleContract = resolveDramaStyleContract(project);
    const derived = deriveDramaShotPromptContract(project, episode, shot);
    const scene = project.scenes.find((item) => item.id === shot.sceneId);
    const characters = project.characters.filter((item) => shot.characterIds.includes(item.id));
    const props = project.props.filter((item) => shot.propIds.includes(item.id));
    const clues = project.clues.filter((item) => shot.clueIds.includes(item.id));
    const physicalConstraint = scenePhysicalConstraint(scene, characters.length);
    const continuity = continuityLines(shot.continuity);
    const imagePlan = sanitizeDramaSupplierText(sanitizeDramaVisualPrompt(shot.executionImagePrompt || shot.imagePrompt), project);
    const startPlan = sanitizeDramaSupplierText(sanitizeDramaVisualPrompt(shot.startFramePrompt || imagePlan), project);
    const endPlan = sanitizeDramaSupplierText(sanitizeDramaVisualPrompt(shot.endFramePrompt || shot.executionVideoPrompt || shot.videoPrompt || imagePlan), project);
    const entryState = stateLines(derived.entryState, project);
    const exitState = stateLines(derived.exitState, project);
    const inheritedTail = shot.framePlan?.start.source === "previous_accepted_actual_tail";
    const referenceManifest = derived.references;
    const styleName = styleContract.name;
    const visualStyle = styleContract.visualDescription;
    const finalStyleLock = `最终视觉锁定：${visualStyle}；镜头中已有视觉方案若与统一风格冲突，必须以本风格为准。`;
    const shared = compact([
        `项目：${project.title} / ${episode.title}`,
        `统一风格：${styleName}`,
        `统一视觉风格（最高级风格约束）：${visualStyle}`,
        `画幅：${project.ratio}`,
        scene ? `场景设定：${assetText(scene, project)}` : "",
        characters.length ? `角色设定：${characters.map((item) => assetText(item, project)).join("；")}` : "",
        props.length ? `道具设定：${props.map((item) => assetText(item, project)).join("；")}` : "",
        clues.length ? `叙事线索：${clues.map((item) => `${assetText(item, project)}；回收：${sanitizeDramaSupplierText(item.payoff, project)}`).join("；")}` : "",
        physicalConstraint ? `场景现实性与调度：${physicalConstraint}` : "",
        continuity.length ? `连续性约束：${continuity.join("；")}` : "",
        entryState.length ? `入口状态：${entryState.join("；")}` : "",
        exitState.length ? `出口状态：${exitState.join("；")}` : "",
        `首帧引用策略：${inheritedTail ? "仅引用上一镜当前视频版本、已人工验收的实际尾帧作为 first_frame" : "独立镜头，按本镜入口状态生成"}`,
        inheritedTail ? "不得引用历史分镜首帧、旧任务结果、已删除、已拒绝或已失效的帧图；不得把上一镜的起始动作复制为本镜入口状态。" : "不得继承未在本镜入口状态中明确声明的上一镜动作、站位或道具状态。",
        referenceManifest.length
            ? `参考图职责计划：${referenceManifest.map((item) => `${manifestTarget(item, project)}=${item.role}${item.purpose ? `（${item.purpose}）` : ""}`).join("；")}。最终图片编号必须以本次请求末尾的“实际参考图绑定”为准，不得沿用计划别名猜测顺序。`
            : "",
        shot.negativePrompt ? `避免：${shot.negativePrompt}` : "",
        styleContract.colorScript ? `全局色彩脚本：${styleContract.colorScript}` : "",
    ]);
    const imagePrompt = compact([
        ...shared,
        `镜头事实：${sanitizeDramaSupplierText(shot.description || shot.sourceText, project)}`,
        imagePlan ? `视觉方案：${imagePlan}` : "",
        shot.startFramePrompt ? `起始画面：${startPlan}` : "",
        "保持角色身份、服装、道具形态、场景空间关系与相邻镜头一致，不添加未在设定中出现的主体或文字。",
        finalStyleLock,
    ]).join("\n");
    const startFramePrompt = compact([...shared, `起始动作状态：${shot.entryState ? entryState.join("；") : shot.continuity?.actionStart || shot.description}`, startPlan, finalStyleLock]).join("\n");
    const endFramePrompt = compact([...shared, `结束动作状态：${shot.exitState ? exitState.join("；") : shot.continuity?.actionEnd || shot.description}`, endPlan, finalStyleLock]).join("\n");
    const videoPrompt = shot.executionVideoPrompt?.trim() || shot.videoPrompt?.trim() || "";
    return {
        imagePrompt: sanitizeDramaSupplierText(imagePrompt, project),
        startFramePrompt: sanitizeDramaSupplierText(startFramePrompt, project),
        endFramePrompt: sanitizeDramaSupplierText(endFramePrompt, project),
        videoPrompt,
    };
}

export function dramaFrameVisibleState(imagePrompt: string, actionPrompt = "") {
    const candidates = [
        extractPromptField(imagePrompt, "可见状态"),
        extractPromptField(imagePrompt, "可见表演状态"),
        extractPromptField(imagePrompt, "站位与视线"),
        extractPromptField(imagePrompt, "静态关键帧"),
        actionPrompt,
    ].map((value) => value.trim()).filter(Boolean);
    return candidates.find((value) => !isGenericTimelineState(value)) || candidates[0] || "";
}

function isGenericTimelineState(value: string) {
    return /^(?:动作入口已成立|镜头推进后主体重心、视线或手部位置已经改变|关键动作已经发生|结果状态继续发展|结果状态与转场落点已经成立|主体处于可辨识准备姿态|道具或环境出现可见结果|主体反应或道具关系已经转向|(?:表情|情绪|视线|姿态|动作|身体状态|手部状态)由.+(?:转为|变为|变化为))/u.test(value);
}

function extractPromptField(value: string, label: string) {
    const labels = ["静态关键帧", "可见状态", "可见表演状态", "景别", "机位与构图", "站位与视线", "三层空间", "光色与风格", "负面约束"];
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
    const savedScored = beat.supplierPrompt ? scoreScenes(beat.supplierPrompt.toLocaleLowerCase()) : [];
    return savedScored[0]?.score ? savedScored[0].scene : sceneReferences.find((scene) => scene.id === shot.sceneId) || fallback;
}

function sceneMatchTerms(value: string) {
    return (value.match(/[\p{Script=Han}]+|[A-Za-z0-9][A-Za-z0-9_-]*/gu) || [value]).flatMap((term) => {
        if (!/^[\p{Script=Han}]+$/u.test(term) || term.length < 2) return [term];
        return [term, ...Array.from({ length: term.length - 1 }, (_, index) => term.slice(index, index + 2))];
    });
}

export function compileDramaFrameSupplierPrompt(project: DramaProject, episode: DramaEpisode, shot: DramaShot, beat?: DramaFrameBeat, phase: "start" | "end" | "keyframe" = "keyframe") {
    const styleContract = resolveDramaStyleContract(project);
    const scene = resolveDramaFrameScene(project, shot, beat);
    const frameSceneChanged = Boolean(beat && scene && scene.id !== shot.sceneId);
    const characters = project.characters.filter((item) => shot.characterIds.includes(item.id)).map((item) => assetText(item, project));
    const props = project.props.filter((item) => shot.propIds.includes(item.id)).map((item) => assetText(item, project));
    const clues = project.clues.filter((item) => shot.clueIds.includes(item.id)).map((item) => item.name);
    const saved = phase === "start" ? (shot.fieldOrigins?.startFramePrompt === "manual" ? shot.startFramePrompt : undefined) : phase === "end" ? (shot.fieldOrigins?.endFramePrompt === "manual" ? shot.endFramePrompt : undefined) : beat?.supplierPrompt;
    const image = beat?.imagePrompt || shot.imagePrompt;
    const action = beat?.actionPrompt || (phase === "start" ? shot.continuity?.actionStart || shot.description : phase === "end" ? shot.continuity?.actionEnd || shot.description : shot.description);
    const sequenceIndex = beat?.sequenceIndex || (phase === "end" ? Number.MAX_SAFE_INTEGER : 1);
    // Only preserve a manually saved prompt when it already follows the current
    // static-frame contract. Legacy prompts are rebuilt from the canonical beat
    // image prompt so old asset-anchor text cannot leak back into the preview.
    const savedPrompt = saved?.trim();
    const preservesManualPrompt = Boolean(savedPrompt && isCurrentStaticFramePrompt(savedPrompt));
    const sourceImage = preservesManualPrompt ? savedPrompt! : image;
    const sceneText = scene ? assetText(scene, project) : "";
    const frameSceneComposition =
        frameSceneChanged && scene
            ? /(?:马车|车厢|车内)/u.test(`${scene.name} ${scene.description} ${scene.profile?.visualIdentity || ""}`)
                ? `当前帧场景：${sceneText}；用中景完整建立车厢空间，人物不得超过画面主体的45%，左右长凳、右侧竖向车窗和车厢纵深必须同时清晰可辨，禁止人物特写或肖像构图`
                : `当前帧场景：${sceneText}；用中景完整建立场景空间，主体与环境关系必须同时清晰可辨，禁止人物特写遮挡场景`
            : "";
    const staticPrompt = upgradeDramaFrameImagePrompt(sourceImage, action, {
        description: [frameSceneChanged ? image : shot.description, characters.length ? characters.join("；") : "", sceneText, props.length ? props.join("；") : "", clues.length ? `线索：${clues.join("、")}` : ""].filter(Boolean).join("；") || image,
        shotSize: frameSceneChanged ? "中景" : shot.continuity?.shotSize || "中景",
        cameraAngle: shot.continuity?.cameraAngle || "视线高度平视",
        composition: [shot.continuity?.composition, frameSceneComposition].filter(Boolean).join("；") || "主体位于9:16安全区，前景有具体框景",
        characterBlocking: frameSceneChanged && scene ? `人物位于${scene.name}内部，以中景与场景同框并保持空间纵深` : shot.continuity?.characterBlocking || "按当前动作关系安排主体站位",
        gazeDirection: shot.continuity?.gazeDirection || "视线落向当前叙事目标",
        lighting: shot.lighting || "延续本场主光",
        colorPalette: [shot.colorPalette || "沿用本场色板", `统一风格：${styleContract.visualDescription}`].join("；"),
        sequenceIndex,
        forceRefresh: frameSceneChanged && !preservesManualPrompt,
    });
    return sanitizeDramaSupplierText(appendStaticFramePositionConstraint(staticPrompt, scenePhysicalConstraint(scene, characters.length)), project);
}

function isCurrentStaticFramePrompt(value: string) {
    return (
        /^静态关键帧[：:]/u.test(value) &&
        ["可见表演状态", "景别", "机位与构图", "站位与视线", "三层空间", "光色与风格", "负面约束"].every((label) => new RegExp(`${label}[：:]`, "u").test(value)) &&
        !/参考图职责[：:]/u.test(value)
    );
}

function scenePhysicalConstraint(scene: DramaNamedAsset | undefined, characterCount: number) {
    if (!scene) return "";
    const sceneText = `${scene.name} ${scene.description} ${scene.profile?.visualIdentity || ""} ${scene.profile?.consistencyRules || ""} ${scene.profile?.spatialRules?.join(" ") || ""}`;
    const explicitLayout = scene.profile?.spatialRules?.filter(Boolean).join("；");
    const layout = explicitLayout ? `资产固定布局：${explicitLayout}；` : "";
    const relationships = characterCount > 1 ? "多名出镜人物以同一镜头/场景参照系写清左右或前后、朝向、视线和接触关系，未声明人物不得入画" : "人物相对可见门窗、通道、座位或关键道具的位置、朝向、视线和接触关系必须明确，未声明人物不得入画";
    if (/(?:马车|车厢|车内)/u.test(sceneText))
        return `车厢真实调度：${layout}坐姿必须落在左右长凳或明确座位；中央过道保持通行，惊醒角色不得蹲坐、跪坐或悬空；按车厢前进方向说明左右邻座人物或空位；若原文和资产未指定座位侧，必须选择与动作和机位相容的左侧或右侧座位，并将另一侧明确为已声明同伴或空位；若其他字段写出“坐在车厢中央”等冲突位置，以本调度约束为准并修正；${relationships}`;
    return `场景真实调度：${layout}人物姿势必须有可见且合理的支撑面或接触物，动作路径不得穿过场景结构；${relationships}`;
}

function appendStaticFramePositionConstraint(prompt: string, constraint: string) {
    if (!constraint) return prompt;
    const lines = prompt.split("\n");
    const index = lines.findIndex((line) => line.startsWith("站位与视线："));
    if (index < 0 || lines[index].includes(constraint)) return prompt;
    lines[index] = `${lines[index]}；${constraint}`;
    return lines.join("\n");
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
    const styleContract = resolveDramaStyleContract(project);
    const constraints = compileDramaAssetConstraints(project, asset, kind);
    const styleName = styleContract.name;
    const visualStyle = styleContract.visualDescription;
    return compact([
        "这是严格的资产基准图生成任务，不是自由创作或概念发挥。请先核对全部硬约束，再生成一张可直接用于后续镜头的基准图。",
        `资产图片 Skill 规则：${DRAMA_ASSET_IMAGE_SKILL.promptRules}`,
        kind === "角色" ? "约束优先级：白底三视图布局 > 身份锚点与固定规则 > 用户明确设定 > 人物本体材质与配色风格；项目环境风格不得进入角色基准板。" : "约束优先级：统一视觉风格 > 身份锚点与固定规则 > 用户明确设定 > 画幅和构图约束；资产历史提示词不得覆盖统一视觉风格。",
        `${kind}设定图，画幅 ${kind === "角色" ? DRAMA_CHARACTER_TURNAROUND_SIZE : project.ratio}`,
        `统一风格：${styleName}`,
        kind === "角色" ? "人物本体风格：项目风格只控制五官、发丝、服装、材质与角色固有配色；纯白背景中禁止出现学院建筑、符文法阵、场景光影或其他环境元素。" : `统一视觉风格（最高级风格约束）：${visualStyle}`,
        kind === "角色" ? "人物光色：均匀、低干扰的棚拍光，仅用于辨识五官、服装轮廓和材质，不制造环境戏剧光。" : `风格指引：${visualStyle}`,
        styleContract.colorScript ? `${kind === "角色" ? "角色固有色彩参考" : "全局色彩脚本"}：${styleContract.colorScript}` : "",
        `名称：${asset.name}`,
        `基础描述：${asset.description}`,
        asset.profile?.visualIdentity ? `视觉识别：${sanitizeDramaVisualPrompt(asset.profile.visualIdentity)}` : "",
        asset.profile?.styling ? `造型与材质：${sanitizeDramaVisualPrompt(asset.profile.styling)}` : "",
        asset.profile?.colorPalette ? `固定色彩：${sanitizeDramaVisualPrompt(asset.profile.colorPalette)}` : "",
        asset.profile?.consistencyRules ? `一致性规则：${sanitizeDramaVisualPrompt(asset.profile.consistencyRules)}` : "",
        asset.profile?.designPrompt ? "资产档案中的历史 designPrompt 不直接发送；生图只使用已结构化的身份、服装、材质、固定道具和一致性字段，不采用其中的旧画风、旧色彩、旧背景、旧构图或设定板布局。" : "",
        asset.profile?.identityAnchors?.length ? `身份锚点（必须保留）：${asset.profile.identityAnchors.join("；")}` : "",
        asset.profile?.spatialRules?.length ? `空间/位置约束（必须准确）：${asset.profile.spatialRules.join("；")}` : "",
        asset.profile?.stateRules?.length ? `状态约束：${asset.profile.stateRules.join("；")}` : "",
        kind === "角色"
            ? "角色构图硬约束（高于项目背景）：纯白色无缝背景上的三视图角色基准板；正面、侧面、背面三个同一角色的全身立姿从头顶到鞋靴完整入画，侧面固定为左侧，等距水平排列、同一基线、同一头身比例，脸部、发型、服装与关键道具在各视图完全一致。"
            : "",
        kind === "角色" ? "角色视觉刻画优先级：三视图的完整头部、脸部、发型、服装结构与关键道具一致性 > 五官与材质细节 > 光线；不得用场景氛围、主立绘或肖像特写替代三视图。" : "",
        ...constraints.map((item) => `输出约束：${item}`),
        kind === "角色" ? `最终风格锁定：角色基准板保持纯白色无缝背景，角色本体使用「${styleName}」指定的五官、发丝、服装与材质方向；不得回退到历史 designPrompt 的旧版多模块布局。` : `最终风格锁定：${visualStyle}。不得回退到历史 designPrompt 的旧风格或中性灰设定板。`,
        `最终自检：${kind === "角色" ? "只能出现同一角色的正面、侧面、背面三视图，侧面固定为左侧；每个视图的全身、头部、躯干、双臂、双手、双腿和鞋靴完整入画，且身份锚点完全一致" : "主体结构和关键材质必须完整入画"}，必须能从身份锚点准确识别；若无法同时满足全部约束，宁可保持设定的简洁原貌，也不得自行添加、替换或拼版。`,
    ]).join("\n");
}

export function compileDramaAssetConstraints(project: Pick<DramaProject, "ratio">, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具") {
    const forbidden = asset.profile?.forbiddenChanges?.length ? asset.profile.forbiddenChanges : ["未授权的服装、道具、饰品、武器、徽章、文字、水印或品牌"];
    return compact([
        kind === "角色" ? `只输出一张完整、独立的 ${DRAMA_CHARACTER_TURNAROUND_SIZE} 三视图角色基准板，不生成第二张候选图或额外版式。` : `只输出一张完整、独立的 ${project.ratio || "9:16"} 设定图，不要拼版、联系表、多视角或分格模块。`,
        kind === "角色"
            ? "角色基准图必须固定为纯白色无缝背景三视图：正面、侧面、背面三个同一角色的完整全身立姿，侧面固定为左侧，头顶、完整头部、脸部、颈部、躯干、双臂、双手、双腿和鞋靴全部入画；三个视图等高、等距、同一基线，服装、体态、关键识别配件、发型和脸部特征严格一致。只允许这三个视图，不得新增任何人物、角度、主立绘、肖像、表情组、手部特写或道具拆解。"
            : kind === "场景"
              ? "单一场景主体完整可见，结构轮廓和关键材质清晰，环境、光线与色彩按项目视觉风格呈现。"
              : "单一道具主体完整可见，结构轮廓和关键材质清晰，置于符合项目视觉风格的环境或展示台中。",
        kind === "角色" ? "负面构图词：额外人物、额外视图、四分之三视图、主立绘、肖像、表情组、手部特写、道具拆解、场景背景、灰色背景、网格、边框、文字、水印、logo、无头、无脸、缺失头部、裁掉头部、裁脸、画面外人头、半身、胸像、躯干特写、身体局部、只画服装。" : "",
        "不得添加设定中没有出现的主体、装饰或剧情信息，不添加文字、水印、logo、边框。",
        `严格保留${kind}的身份、轮廓、年龄感、色彩和一致性规则，不得擅自改写。`,
        kind === "角色" ? "禁止把中文说明、角色关系表、参数表或海报排版画进图片；三视图只作为同一角色的固定基准板，不添加任何文字或其他模块。" : "禁止把中文说明、角色关系表、参数表、海报排版或多张视图画进图片；设定文字只作为生成约束，不是画面内容。",
        `禁止：${forbidden.join("；")}`,
    ]);
}

export function preflightDramaAssetGeneration(project: Pick<DramaProject, "ratio">, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具"): DramaAssetGenerationPreflight {
    const constraints = compileDramaAssetConstraints(project, asset, kind);
    const errors = compact([asset.name.trim() ? "" : "缺少资产名称"]);
    return errors.length ? { ok: false, errors, constraints } : { ok: true, constraints };
}

export function compileDramaAssetRefinementPrompt(project: Pick<DramaProject, "title" | "style" | "ratio" | "productionBible">, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具", proposal: DramaAssetRefinementProposal, request: string) {
    const updatedAsset = { ...asset, description: proposal.updatedDescription || asset.description, profile: proposal.updatedProfile };
    return compact([
        compileDramaAssetReferencePrompt(project, updatedAsset, kind),
        `本轮调整：${request}`,
        proposal.preservedRules.length ? `必须保留：${proposal.preservedRules.join("；")}` : "",
        proposal.negativePrompt ? `负面约束：${proposal.negativePrompt}` : "",
        kind === "角色" ? "服装必须体现剧情功能、职业经历和社会身份，具有稳定识别配件；禁止通用 NPC、模板化游戏角色和无意义装饰。" : "",
    ]).join("\n");
}

function assetText(asset: DramaNamedAsset, project: DramaProject) {
    return sanitizeDramaSupplierText(
        compact([
            `${asset.name}：${asset.description}`,
            asset.profile?.visualIdentity,
            asset.profile?.styling,
            asset.profile?.colorPalette ? `色彩 ${asset.profile.colorPalette}` : "",
            asset.profile?.consistencyRules ? `固定规则 ${asset.profile.consistencyRules}` : "",
            asset.profile?.spatialRules?.length ? `空间布局 ${asset.profile.spatialRules.join("；")}` : "",
        ]).join("，"),
        project,
    );
}

function continuityLines(value?: DramaShotContinuity) {
    if (!value) return [];
    return compact([
        value.shotSize ? `景别 ${value.shotSize}` : "",
        value.cameraAngle ? `机位 ${value.cameraAngle}` : "",
        value.composition ? `构图 ${value.composition}` : "",
        value.characterBlocking ? `站位 ${value.characterBlocking}` : "",
        value.gazeDirection ? `视线 ${value.gazeDirection}` : "",
        value.screenDirection ? `运动方向 ${value.screenDirection}` : "",
        value.axisRule ? `轴线 ${value.axisRule}` : "",
        value.continuityNotes,
    ]);
}

function stateLines(value: DramaShot["entryState"], project: DramaProject) {
    if (!value) return [];
    const nameFor = (id: string) => [...project.characters, ...project.scenes, ...project.props, ...project.clues].find((asset) => asset.id === id)?.name || "当前对象";
    return compact([
        value.environment ? `环境 ${value.environment}` : "",
        value.lighting ? `灯光 ${value.lighting}` : "",
        value.axis ? `轴线 ${value.axis}` : "",
        value.screenDirection ? `屏幕方向 ${value.screenDirection}` : "",
        ...value.characters.map(
            (entity) =>
                `角色 ${nameFor(entity.assetId)}：位置${entity.position}，视线${entity.gaze}，姿态${entity.pose}，动作${sanitizeDramaSupplierText(entity.action || "保持当前状态", project)}${entity.wardrobe ? `，服装${entity.wardrobe}` : ""}${entity.expression ? `，表情${entity.expression}` : ""}`,
        ),
        ...value.props.map((entity) => `道具 ${nameFor(entity.assetId)}：${sanitizeDramaSupplierText(entity.state || "保持当前状态", project)}，由${entity.holderId ? nameFor(entity.holderId) : "环境"}持有`),
    ]);
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

function manifestTarget(item: DramaReferenceManifestItem, project: DramaProject) {
    const asset = [...project.characters, ...project.scenes, ...project.props, ...project.clues].find((candidate) => candidate.id === item.assetId);
    const shot = project.episodes.flatMap((episode) => episode.shots).find((candidate) => candidate.id === item.shotId);
    return asset ? `固定资产「${asset.name}」` : shot ? `镜头「${shot.title}」` : item.role === "previous_actual_tail" ? "上一镜已验收实际尾帧" : "未解析参考对象";
}

function compact(values: Array<string | undefined>) {
    return values.map((value) => value?.trim() || "").filter(Boolean);
}
