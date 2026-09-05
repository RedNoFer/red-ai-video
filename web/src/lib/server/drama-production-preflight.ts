import type { DramaEpisode, DramaProductionPreflight, DramaProductionPreflightIssue, DramaProject, DramaShot } from "@/lib/drama-project-contract";
import { hasApprovedAssetReference } from "@/lib/drama-asset-baseline";
import { continuityStartEvidence } from "@/lib/drama-continuity-policy";
import { normalizeDramaFrameBeats, validateDramaFrameVisualContent, dramaFrameVisualSubject } from "@/lib/drama-frame-sequence";
import { dramaReferenceImageBudget } from "@/lib/drama-production-plan";

const blocking = (code: string, message: string, extra: Partial<DramaProductionPreflightIssue> = {}): DramaProductionPreflightIssue => ({ code, severity: "blocking", message, ...extra });
const warning = (code: string, message: string, extra: Partial<DramaProductionPreflightIssue> = {}): DramaProductionPreflightIssue => ({ code, severity: "warning", message, ...extra });

/** Director gate: no paid generation may start until the executable package is internally consistent. */
export function preflightDramaProduction(project: DramaProject, episode: DramaEpisode, shotIds?: string[]): DramaProductionPreflight {
    const issues: DramaProductionPreflightIssue[] = [];
    const selected = new Set(shotIds?.length ? shotIds : episode.shots.map((shot) => shot.id));
    if (project.ratio !== "9:16") issues.push(blocking("RATIO", `本集必须使用9:16，当前为${project.ratio}`));
    if (!project.seriesBible) issues.push(blocking("SERIES_BIBLE", "项目缺少已锁定的系列圣经，不能跨集生产"));
    const plan = project.productionBible?.productionPlan;
    const targetShotDuration = plan?.video.shotDuration;
    const targetFrameCount = plan?.video.frameCount;
    if (plan) {
        // The executable video model is selected by the backend channel binding at task creation.
        // Do not gate production on the stale model label persisted in the editable plan.
        if (plan.references.minImages < 1 || plan.references.maxImages < plan.references.minImages) issues.push(blocking("REFERENCE_PLAN_INVALID", "多帧参考数量范围无效"));
        if (!plan.lockedAt) issues.push(blocking("PRODUCTION_PLAN_UNCONFIRMED", "生产方案尚未锁定，请先在剧本生成前完成方案配置"));
    }
    const characters = new Map(project.characters.map((asset) => [asset.id, asset]));
    const scenes = new Map(project.scenes.map((asset) => [asset.id, asset]));
    const props = new Map(project.props.map((asset) => [asset.id, asset]));
    const clues = new Map(project.clues.map((asset) => [asset.id, asset]));
    const shotById = new Map(episode.shots.map((shot) => [shot.id, shot]));
    const edgeByTo = new Map((episode.continuityEdges || []).map((edge) => [edge.toShotId, edge]));

    for (const shot of episode.shots) if (selected.has(shot.id)) checkShot(shot, episode.code || episode.id, project, characters, scenes, props, clues, edgeByTo, shotById, issues, targetShotDuration, targetFrameCount);
    for (const edge of episode.continuityEdges || []) {
        if (!selected.has(edge.toShotId)) continue;
        const from = shotById.get(edge.fromShotId);
        const to = shotById.get(edge.toShotId);
        if (!from || !to) {
            issues.push(blocking("EDGE_REFERENCE", `连续性边引用了不存在的镜头 ${edge.fromShotId} → ${edge.toShotId}`));
            continue;
        }
        if (edge.inheritActualEndFrame && ["scene_change", "hard_cut", "jump_cut"].includes(edge.transition)) {
            issues.push(blocking("EDGE_CONFLICT", `${to.code || to.title} 的${edge.transition}不能继承上一镜实际尾帧`, { shotId: to.id }));
        }
        if (edge.inheritActualEndFrame && !edge.carryEnvironment && !edge.carryCharacterIds.length && !edge.carryPropIds.length) {
            issues.push(blocking("EDGE_EMPTY", `${to.code || to.title}声明继承尾帧但没有可继承实体或环境`, { shotId: to.id }));
        }
        compareContinuityStates(from, to, edge, issues);
    }
    return { status: issues.some((issue) => issue.severity === "blocking") ? "blocked" : issues.length ? "needs_confirmation" : "passed", issues, checkedShotIds: episode.shots.filter((shot) => selected.has(shot.id)).map((shot) => shot.id) };
}

function compareContinuityStates(from: DramaShot, to: DramaShot, edge: NonNullable<DramaEpisode["continuityEdges"]>[number], issues: DramaProductionPreflightIssue[]) {
    const previous = from.exitState;
    const next = to.entryState;
    if (!previous || !next) return;
    const add = (code: string, detail: string) => issues.push(warning(code, `${from.code || from.title} → ${to.code || to.title}${detail}`, { shotId: to.id, correction: "统一相邻镜头入口与出口状态，或明确标记为有意变化" }));
    if (edge.carryEnvironment && previous.environment && next.environment && previous.environment !== next.environment) add("ENVIRONMENT_CONTINUITY", "环境状态不一致");
    if (edge.carryAxis && previous.axis && next.axis && previous.axis !== next.axis) add("AXIS_CONTINUITY", "轴线规则不一致");
    if (previous.screenDirection && next.screenDirection && previous.screenDirection !== next.screenDirection) add("SCREEN_DIRECTION_CONTINUITY", "屏幕运动方向冲突");
    for (const assetId of edge.carryCharacterIds) {
        const left = previous.characters.find((item) => item.assetId === assetId);
        const right = next.characters.find((item) => item.assetId === assetId);
        if (!left || !right) return add("CHARACTER_CONTINUITY", `缺少延续角色 ${assetId} 的状态`);
        if (left.wardrobe && right.wardrobe && left.wardrobe !== right.wardrobe) add("WARDROBE_CONTINUITY", `角色 ${assetId} 服装状态不一致`);
        if (left.gaze && right.gaze && left.gaze !== right.gaze) add("GAZE_CONTINUITY", `角色 ${assetId} 视线方向冲突`);
        if (left.expression && right.expression && left.expression !== right.expression) add("EXPRESSION_CONTINUITY", `角色 ${assetId} 表情状态不一致`);
        if (left.position && right.position && left.position !== right.position) add("POSITION_CONTINUITY", `角色 ${assetId} 站位不一致`);
    }
    for (const assetId of edge.carryPropIds) {
        const left = previous.props.find((item) => item.assetId === assetId);
        const right = next.props.find((item) => item.assetId === assetId);
        if (!left || !right || left.state !== right.state || left.holderId !== right.holderId) add("PROP_CONTINUITY", `道具 ${assetId} 状态或持有人不一致`);
    }
}

function checkShot(
    shot: DramaShot,
    episodeCode: string,
    project: DramaProject,
    characters: Map<string, DramaProject["characters"][number]>,
    scenes: Map<string, DramaProject["scenes"][number]>,
    props: Map<string, DramaProject["props"][number]>,
    clues: Map<string, DramaProject["clues"][number]>,
    edgeByTo: Map<string, NonNullable<DramaEpisode["continuityEdges"]>[number]>,
    shotById: Map<string, DramaShot>,
    issues: DramaProductionPreflightIssue[],
    targetShotDuration?: 15 | 20 | 30,
    targetFrameCount?: number,
) {
    const label = shot.code || shot.title;
    if (!shot.imagePrompt.trim() || !shot.videoPrompt.trim()) issues.push(blocking("PROMPT_MISSING", `${label}缺少图像或视频Prompt`, { shotId: shot.id }));
    const performance = shot.performancePlan;
    const beats = performance?.beats;
    if (!performance?.emotionalObjective || !performance.emotionalArc || !performance.speechStyle || !performance.pace || !performance.breath || !beats?.start.facialAction || !beats.middle.facialAction || !beats.end.facialAction)
        issues.push(blocking("PERFORMANCE_PLAN_MISSING", `${label}缺少完整人物表演规划`, { shotId: shot.id }));
    const dialogueCount = shot.utterances.filter((item) => item.type === "dialogue").length || (shot.dialogue.trim() ? 1 : 0);
    if (dialogueCount && (!shot.dialoguePerformance?.length || shot.dialoguePerformance.length < dialogueCount)) issues.push(blocking("DIALOGUE_PERFORMANCE_MISSING", `${label}对白缺少逐句语气、节奏和面部反应指导`, { shotId: shot.id }));
    const light = shot.lightingPlan;
    if (!light?.palette || !light.colorTemperature || !light.keyLight || !light.fillLight || !light.rimLight || !light.materialResponse || !light.skinToneProtection)
        issues.push(blocking("LIGHTING_PLAN_MISSING", `${label}缺少完整色彩与灯光规划`, { shotId: shot.id }));
    if (!Number.isFinite(shot.duration) || shot.duration <= 0) issues.push(blocking("DURATION", `${label}缺少有效时长`, { shotId: shot.id }));
    if (targetShotDuration && shot.duration !== targetShotDuration)
        issues.push(warning("SHOT_DURATION_MISMATCH", `${label}当前为${shot.duration}秒，生产方案目标为${targetShotDuration}秒`, { shotId: shot.id, correction: `按生产方案重新生成或调整为${targetShotDuration}秒逻辑镜头` }));
    const fixedReferenceCount = new Set([shot.sceneId, ...shot.characterIds, ...shot.propIds, ...shot.clueIds, ...(shot.sourceAssetIds || [])].filter(Boolean)).size;
    const continuityReferenceCount = edgeByTo.get(shot.id)?.inheritActualEndFrame ? 1 : 0;
    const frameReferenceCount = shot.storyboardFrameMode === "all_frames" ? shot.framePlan?.frames.length || 0 : shot.storyboardFrameMode === "first_last" ? 2 : (shot.videoMode || project.defaultVideoMode) === "direct" ? 0 : 1;
    const referenceCount = fixedReferenceCount + continuityReferenceCount + frameReferenceCount;
    const referenceLimit = dramaReferenceImageBudget(shot.duration);
    if (referenceCount > referenceLimit)
        issues.push(warning("REFERENCE_IMAGE_BUDGET", `${label}计划引用 ${referenceCount} 张图片，超过 ${shot.duration} 秒视频的 ${referenceLimit} 张上限`, { shotId: shot.id, correction: "在提交预览中取消部分中间帧；固定资产、连续性首帧和结束帧必须保留" }));
    if (!shot.continuity?.shotSize || !shot.continuity?.cameraAngle || !shot.continuity?.composition)
        issues.push(warning("FRAMING_UNCLEAR", `${label}缺少完整景别、机位或构图约束，可能导致主体位置和景别漂移`, { shotId: shot.id, correction: "补充明确景别、机位和构图" }));
    if (!shot.lighting && !shot.entryState?.lighting) issues.push(warning("LIGHTING_UNCLEAR", `${label}缺少明确光照方向，生成结果可能出现人物与背景光照脱节`, { shotId: shot.id, correction: "补充主光方向、色温和主体/背景光照关系" }));
    if (!/(文字|字幕|水印|logo|watermark|text)/i.test(`${shot.imagePrompt}\n${shot.videoPrompt}\n${shot.negativePrompt || ""}`))
        issues.push(warning("NEGATIVE_TEXT_MISSING", `${label}未显式禁止文字、水印或 Logo，可能产生不可控画面文字`, { shotId: shot.id, correction: "在负面约束中加入禁止文字、水印和 Logo" }));
    const scene = shot.sceneId ? scenes.get(shot.sceneId) : undefined;
    if (!scene) issues.push(blocking("LOCATION_REFERENCE", `${label}缺少有效地点资产引用`, { shotId: shot.id }));
    else if (!hasApprovedAssetReference(scene)) issues.push(blocking("LOCATION_ANCHOR", `${label}的场景“${scene.name}”缺少已审核基准图`, { shotId: shot.id, assetId: scene.id }));
    if (!shot.entryState || !shot.exitState) issues.push(blocking("STATE_MISSING", `${label}缺少完整入口/出口状态`, { shotId: shot.id }));
    else {
        if (!shot.entryState.environment || !shot.entryState.lighting || !shot.exitState.environment || !shot.exitState.lighting) issues.push(blocking("STATE_INCOMPLETE", `${label}入口/出口必须包含环境和灯光状态`, { shotId: shot.id }));
        for (const entity of [...shot.entryState.characters, ...shot.exitState.characters])
            if (!entity.position || !entity.gaze || !entity.pose || !entity.action) issues.push(blocking("CHARACTER_STATE", `${label}角色状态缺少位置、视线、姿态或动作`, { shotId: shot.id, assetId: entity.assetId }));
        for (const entity of [...shot.entryState.props, ...shot.exitState.props]) if (!entity.state || !entity.holderId) issues.push(blocking("PROP_STATE", `${label}道具状态缺少状态或持有人`, { shotId: shot.id, assetId: entity.assetId }));
    }
    for (const id of shot.characterIds) {
        const asset = characters.get(id);
        if (!asset) issues.push(blocking("CHARACTER_REFERENCE", `${label}引用了不存在的角色`, { shotId: shot.id, assetId: id }));
        else if (!hasApprovedAssetReference(asset)) issues.push(blocking("CHARACTER_ANCHOR", `${label}的角色“${asset.name}”缺少已审核基准图`, { shotId: shot.id, assetId: id }));
    }
    for (const id of shot.propIds) {
        const asset = props.get(id);
        if (!asset) issues.push(blocking("PROP_REFERENCE", `${label}引用了不存在的道具`, { shotId: shot.id, assetId: id }));
        else if (!asset.profile?.identityAnchors?.length || !hasApprovedAssetReference(asset)) issues.push(blocking("PROP_ANCHOR", `${label}的道具“${asset.name}”缺少形制锚点或已审核基准图`, { shotId: shot.id, assetId: id }));
    }
    for (const id of shot.clueIds) if (!clues.has(id)) issues.push(blocking("CLUE_REFERENCE", `${label}引用了不存在的线索`, { shotId: shot.id, assetId: id }));
    for (const id of shot.sourceAssetIds || []) {
        const source = project.sourceAssets?.find((asset) => asset.id === id);
        if (!source || source.type !== "image") issues.push(blocking("SOURCE_ASSET_REFERENCE", `${label}引用的来源素材不是有效图片`, { shotId: shot.id, assetId: id }));
        else if (!source.serverUrl && !source.remoteUrl) issues.push(blocking("SOURCE_ASSET_URL", `${label}的来源图片“${source.title || id}”缺少可访问地址`, { shotId: shot.id, assetId: id }));
    }
    const prompt = `${shot.imagePrompt}\n${shot.videoPrompt}`;
    const referencePrompt = stripNegativeReferenceClauses(prompt);
    const inactiveCharacters = project.characters.filter((asset) => asset.activeEpisodeCodes && !asset.activeEpisodeCodes.includes(episodeCode) && referencePrompt.includes(asset.name));
    for (const asset of inactiveCharacters) issues.push(blocking("INACTIVE_CHARACTER", `${label}Prompt中出现未出镜角色“${asset.name}”`, { shotId: shot.id, assetId: asset.id }));
    for (const asset of project.characters)
        if (referencePrompt.includes(asset.name) && !shot.characterIds.includes(asset.id)) issues.push(blocking("PROMPT_CHARACTER_REFERENCE", `${label}Prompt出现角色“${asset.name}”，但镜头未引用该角色`, { shotId: shot.id, assetId: asset.id }));
    for (const asset of project.props)
        if (prompt.includes(asset.name) && !shot.propIds.includes(asset.id)) issues.push(blocking("PROMPT_PROP_REFERENCE", `${label}Prompt出现道具“${asset.name}”，但镜头未引用该道具`, { shotId: shot.id, assetId: asset.id }));
    const incoming = edgeByTo.get(shot.id);
    const requiresAcceptedTail = shot.framePlan?.start.source === "previous_accepted_actual_tail" || incoming?.inheritActualEndFrame;
    if (requiresAcceptedTail) {
        const previous = incoming ? shotById.get(incoming.fromShotId) : undefined;
        if (!previous) issues.push(blocking("TAIL_REFERENCE", `${label}找不到上一镜尾帧来源`, { shotId: shot.id }));
        else if (!continuityStartEvidence(previous)) issues.push(blocking("TAIL_ACCEPTANCE", `${label}需要上一镜当前视频版本的已验收实际尾帧`, { shotId: shot.id, correction: "先验收上一镜当前视频版本的实际尾帧，再生成本镜头" }));
    }
    if (!shot.framePlan) issues.push(blocking("FRAME_PLAN_MISSING", `${label}缺少起止帧执行计划`, { shotId: shot.id }));
    else {
        validateReferenceManifest(shot, issues);
        if (!shot.framePlan.end || typeof shot.framePlan.end.required !== "boolean") issues.push(blocking("FRAME_PLAN_END", `${label}缺少结束帧要求`, { shotId: shot.id }));
        if (shot.storyboardFrameMode === "all_frames" || shot.fieldOrigins?.framePlan === "package") {
            try {
                normalizeDramaFrameBeats(shot.framePlan.frames, shot.duration);
                if (shot.storyboardFrameMode === "all_frames" && shot.framePlan.frames.length < 2)
                    issues.push(blocking("FRAME_COUNT_MIN", `${label}的 all_frames 至少需要 2 个有序关键帧`, { shotId: shot.id, correction: "补充至少一张具有真实可见变化的关键帧" }));
                if (shot.storyboardFrameMode === "all_frames" && targetFrameCount && shot.framePlan.frames.length !== targetFrameCount)
                    issues.push(blocking("FRAME_COUNT_MISMATCH", `${label}包含 ${shot.framePlan.frames.length} 个关键帧，但当前生产方案要求 ${targetFrameCount} 个`, { shotId: shot.id, correction: `按当前生产方案重新生成 ${targetFrameCount} 个连续关键帧` }));
                shot.framePlan.frames.forEach((frame, index, frames) => {
                    const visualError = validateDramaFrameVisualContent(frame.imagePrompt, frame.actionPrompt);
                    if (visualError) issues.push(blocking("FRAME_VISUAL_CONTENT", `${label}第${index + 1}帧${visualError}`, { shotId: shot.id }));
                    if (index > 0 && dramaFrameVisualSubject(frame.imagePrompt, frame.actionPrompt) === dramaFrameVisualSubject(frames[index - 1].imagePrompt, frames[index - 1].actionPrompt))
                        issues.push(blocking("FRAME_VISUAL_DUPLICATE", `${label}第${index + 1}帧与上一帧的可见画面没有变化`, { shotId: shot.id, correction: "补充当前帧新的姿态、道具状态、表情或环境变化" }));
                    if (shot.storyboardFrameMode === "all_frames") {
                        const stored = shot.storyboardFrames?.find((candidate) => candidate.id === frame.id || candidate.sequenceIndex === frame.sequenceIndex);
                        if (!stored?.mediaUrl?.trim() || stored.status !== "success" || stored.continuityStatus !== "passed")
                            issues.push(blocking("FRAME_ASSET_NOT_ACCEPTED", `${label}第${index + 1}帧（${frame.id}）尚未生成并验收通过，不能提交有序关键帧视频`, { shotId: shot.id, correction: "先生成当前帧真实图片并完成连续性人工验收" }));
                    }
                });
            } catch (error) {
                issues.push(blocking("FRAME_PLAN_INVALID", `${label}逐帧计划无效：${error instanceof Error ? error.message : "时间轴必须连续覆盖镜头时长"}`, { shotId: shot.id }));
            }
        }
    }
}

function validateReferenceManifest(shot: DramaShot, issues: DramaProductionPreflightIssue[]) {
    const manifest = shot.framePlan?.referenceManifest;
    if (!manifest?.length) return;
    const has = (role: string, assetId: string) => manifest.some((item) => item.role === role && item.assetId === assetId);
    if (shot.sceneId && !has("scene_anchor", shot.sceneId))
        issues.push(blocking("REFERENCE_MANIFEST_SCENE", `${shot.code || shot.title}的固定场景引用与镜头场景不一致`, { shotId: shot.id, assetId: shot.sceneId, correction: "将scene_anchor绑定到当前镜头的场景资产" }));
    for (const assetId of shot.characterIds)
        if (!has("character_anchor", assetId)) issues.push(blocking("REFERENCE_MANIFEST_CHARACTER", `${shot.code || shot.title}缺少角色 ${assetId} 的固定引用`, { shotId: shot.id, assetId, correction: "补充该角色的character_anchor引用" }));
    for (const assetId of shot.propIds)
        if (!has("prop_anchor", assetId)) issues.push(blocking("REFERENCE_MANIFEST_PROP", `${shot.code || shot.title}缺少道具 ${assetId} 的固定引用`, { shotId: shot.id, assetId, correction: "补充该道具的prop_anchor引用" }));
}

/** Names inside explicit negative constraints are exclusions, not shot references. */
function stripNegativeReferenceClauses(value: string) {
    return value.replace(/(?:无|没有|不得|禁止|避免|不出现|不展示|不含|不包含)[^。；，,\n]{0,48}/gu, "").replace(/\b(?:no|without|avoid|exclude)\b[^.;,\n]{0,48}/giu, "");
}
