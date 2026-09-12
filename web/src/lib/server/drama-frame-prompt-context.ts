import type { DramaEpisode, DramaFrameBeat, DramaNamedAsset, DramaProject, DramaShot } from "@/lib/drama-project-contract";
import { formatDramaGlobalVisualContract, resolveDramaGlobalVisualContract } from "@/lib/drama-style";

export type DramaFramePromptContext = {
    project: DramaProject;
    episode: DramaEpisode;
    shot: DramaShot;
    frame: DramaFrameBeat;
    previousFrame?: DramaFrameBeat;
    nextFrame?: DramaFrameBeat;
    prompt?: string;
};

/**
 * Build the public facts an external prompt editor needs. IDs, URLs, provider
 * settings and execution-only reference data deliberately never enter this text.
 */
export function buildDramaFramePromptContext(project: DramaProject, episodeId: string, shotId: string, frameId: string, prompt?: string): DramaFramePromptContext {
    const episode = project.episodes.find((item) => item.id === episodeId);
    const shot = episode?.shots.find((item) => item.id === shotId);
    const frames = shot?.framePlan?.frames || [];
    const frame = frames.find((item) => item.id === frameId);
    if (!episode || !shot || !frame) throw new Error("当前项目中找不到要优化的图片帧");
    const index = frames.findIndex((item) => item.id === frameId);
    return { project, episode, shot, frame, previousFrame: index > 0 ? frames[index - 1] : undefined, nextFrame: index >= 0 ? frames[index + 1] : undefined, prompt };
}

export function formatDramaFramePromptContext(context: DramaFramePromptContext) {
    const { project, episode, shot, frame, previousFrame, nextFrame } = context;
    const scene = project.scenes.find((item) => item.id === shot.sceneId);
    const characters = project.characters.filter((item) => shot.characterIds.includes(item.id));
    const props = project.props.filter((item) => shot.propIds.includes(item.id));
    const plan = project.productionBible?.productionPlan;
    const visualContract = formatDramaGlobalVisualContract(resolveDramaGlobalVisualContract(project));
    const frameRange = plan?.frameCountRange ? `${plan.frameCountRange.min}-${plan.frameCountRange.max}` : "2-9";
    const framePolicy = plan?.video.framePolicy || "agent";
    const lines = [
        "短剧图片帧公开优化上下文（仅含当前项目事实）",
        `项目：${publicText(project.title)}`,
        `本集：${publicText(episode.title || episode.code || "当前集")}`,
        visualContract ? `项目视觉规则：\n${visualContract}` : "",
        plan?.customDirectorRules ? `项目导演定制规则：\n${publicText(plan.customDirectorRules)}` : "",
        `关键帧策略：${framePolicy === "agent" ? `Agent 按真实动作事件在 ${frameRange} 帧内自适应选择` : framePolicy === "fixed-4" ? "固定 4 帧（项目主动选择）" : "固定 5 帧（项目主动选择）"}`,
        scene ? formatScene(scene) : "场景事实：当前镜头未绑定场景资产",
        `当前镜头事实：\n${formatShotFacts(shot, characters, props)}`,
        `当前帧事实（第 ${frame.sequenceIndex} 帧，${frame.startSecond}-${frame.endSecond} 秒）：\n${formatFrame(frame, context.prompt)}`,
        previousFrame ? `上一帧事实（只能作为连续性参照，不得复制静态画面）：\n${formatFrame(previousFrame)}` : "上一帧事实：无，本帧是镜头入口",
        nextFrame ? `下一帧事实（只能作为连续性参照，不得提前写入本帧）：\n${formatFrame(nextFrame)}` : "下一帧事实：无，本帧是镜头终点",
        formatReferenceRoles(shot),
        "输出约束：只返回公开静态图片提示词；可按画面主体、可见状态、构图与空间、光色与风格、针对性约束组织，缺少事实的段落省略；至少写主体、冻结状态和一项可验收空间/视线/姿态/道具/环境结果。参考图职责留在绑定数据，不写进提示词正文；不新增项目事实。",
    ];
    return publicText(lines.filter(Boolean).join("\n\n"), collectPrivateIds(project, episode, shot, frame));
}

function formatScene(scene: DramaNamedAsset) {
    const profile = scene.profile;
    const policy = scene.backgroundNpcPolicy || { mode: "auto" as const };
    const npc =
        policy.mode === "required"
            ? "必须按当前镜头实际空间容量和剧情功能加入合理数量的无名背景 NPC，并写清数量范围、分布密度和可见行为；NPC 不升级为主角色资产"
            : policy.mode === "forbidden"
              ? "禁止背景 NPC，画面不得出现未声明人物"
              : "由 Agent 根据公共场面、空间规模、剧情压力和群体反应需要判断；不需要时保持无人";
    return `场景资产：${publicText(scene.name)}\n场景描述：${publicText(scene.description)}\n空间事实：${publicText([...(profile?.visualIdentity ? [profile.visualIdentity] : []), ...(profile?.spatialRules || []), ...(profile?.consistencyRules ? [profile.consistencyRules] : [])].join("；"))}\nNPC 策略：${npc}${policy.guidance ? `；补充：${publicText(policy.guidance)}` : ""}${policy.continuity ? `；连续性：${publicText(policy.continuity)}` : ""}\n场景全景基准图仍保持无人，NPC 只可进入当前镜头关键帧和视频公开提示词。`;
}

function formatShotFacts(shot: DramaShot, characters: DramaNamedAsset[], props: DramaNamedAsset[]) {
    const continuity = shot.continuity;
    return [
        `标题：${publicText(shot.title)}`,
        `剧情与动作：${publicText([shot.description, shot.sourceText, continuity?.actionStart, continuity?.actionEnd].filter(Boolean).join("；"))}`,
        `出镜角色：${
            characters.length
                ? characters
                      .map((item) => `${item.name}（${item.profile?.visualIdentity || item.description}）`)
                      .map((value) => publicText(value))
                      .join("；")
                : "无已登记角色"
        }`,
        `道具：${
            props.length
                ? props
                      .map((item) => `${item.name}（${item.description}）`)
                      .map((value) => publicText(value))
                      .join("；")
                : "无已登记道具"
        }`,
        `连续性摄影：${publicText([continuity?.shotSize, continuity?.cameraAngle, continuity?.composition, continuity?.characterBlocking, continuity?.gazeDirection, continuity?.screenDirection, continuity?.axisRule].filter(Boolean).join("；"))}`,
        `表演计划：${publicText([shot.performancePlan?.emotionalObjective, shot.performancePlan?.emotionalArc, shot.performanceNotes].filter(Boolean).join("；"))}`,
        `灯光色彩：${publicText([shot.lightingPlan?.palette, shot.lightingPlan?.colorTemperature, shot.lightingPlan?.keyLight, shot.lightingPlan?.fillLight, shot.lightingPlan?.rimLight, shot.colorPalette, shot.lighting].filter(Boolean).join("；"))}`,
    ].join("\n");
}

function formatFrame(frame: DramaFrameBeat, prompt?: string) {
    return [
        `动作节点：${publicText(frame.actionPrompt)}`,
        frame.startPrompt ? `起点：${publicText(frame.startPrompt)}` : "",
        frame.transitionPrompt ? `衔接：${publicText(frame.transitionPrompt)}` : "",
        frame.endPrompt ? `终点：${publicText(frame.endPrompt)}` : "",
        `图片帧提示词：${publicText(prompt || frame.imagePrompt)}`,
    ]
        .filter(Boolean)
        .join("\n");
}

function formatReferenceRoles(shot: DramaShot) {
    const roles = shot.framePlan?.referenceManifest || [];
    if (!roles.length) return "参考素材职责：本镜无已登记参考职责";
    return `参考素材职责：${roles
        .map((item) => `${item.alias}｜${item.role}｜${item.purpose}`)
        .map((value) => publicText(value))
        .join("；")}`;
}

function publicText(value: string, privateIds: string[] = []) {
    const privatePattern = privateIds.length
        ? new RegExp(
              privateIds
                  .sort((left, right) => right.length - left.length)
                  .map(escapeRegExp)
                  .join("|"),
              "gu",
          )
        : undefined;
    return value
        .replace(/https?:\/\S+/giu, "[已隐藏链接]")
        .replace(privatePattern || /(?!x)x/u, "[已隐藏内部标识]")
        .replace(/\b(?:[a-z]+[-_])?(?:[a-f0-9]{16,}|[A-Za-z0-9_-]{24,})\b/gu, "[已隐藏内部标识]")
        .trim();
}

function collectPrivateIds(project: DramaProject, episode: DramaEpisode, shot: DramaShot, frame: DramaFrameBeat) {
    const values = [
        project.id,
        project.sourceHandoffId,
        project.creativeConversationId,
        episode.id,
        shot.id,
        frame.id,
        ...(project.characters || []).flatMap(assetIds),
        ...(project.scenes || []).flatMap(assetIds),
        ...(project.props || []).flatMap(assetIds),
        ...(project.clues || []).flatMap(assetIds),
        ...(shot.framePlan?.referenceManifest || []).flatMap((item) => [item.assetId, item.shotId, item.frameEvidenceId]),
        ...(shot.framePlan?.manualReferenceImages || []).flatMap((item) => [item.id, item.remoteUrl]),
        ...(shot.frameEvidence || []).flatMap((item) => [item.id, item.sourceShotId, item.generationRunId, item.generationTaskId, item.assetId, item.sourceVideoUrl]),
    ];
    return [...new Set(values.filter((value): value is string => Boolean(value && value.length > 3)))];
}

function assetIds(asset: DramaNamedAsset) {
    return [asset.id, asset.referenceStorageKey, ...(asset.references || []).flatMap((reference) => [reference.id, reference.storageKey, reference.remoteUrl])];
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
