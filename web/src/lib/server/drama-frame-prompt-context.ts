import type { DramaEpisode, DramaFrameBeat, DramaNamedAsset, DramaProject, DramaShot } from "@/lib/drama-project-contract";

export type DramaFramePromptContext = {
    project: DramaProject;
    episode: DramaEpisode;
    shot: DramaShot;
    frame: DramaFrameBeat;
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
    return { project, episode, shot, frame, prompt };
}

export function formatDramaFramePromptContext(context: DramaFramePromptContext, options: { includePrompt?: boolean } = {}) {
    const { project, episode, shot, frame } = context;
    const lines = [
        "短剧图片帧优化上下文（只用于当前提示词校验，不是静态画面补写来源）",
        `当前集：${publicText(episode.title || episode.code || "当前集")}`,
        `当前帧序号：${frame.sequenceIndex}；时间范围仅用于定位，不得写入静态提示词`,
        options.includePrompt === false ? "当前 imagePrompt 已在用户消息中提供，只能编辑用户消息中的原文" : `当前 imagePrompt：\n${publicText(context.prompt || frame.imagePrompt)}`,
        "静态提示词只允许按事实选择画面主体、可见状态、构图与空间、光色与风格、针对性约束；缺少的段落省略。不得从动作过程、镜头描述、项目档案、背景群像、相邻帧、历史生成结果或参考图职责补写内容。",
    ];
    return publicText(lines.filter(Boolean).join("\n\n"), collectPrivateIds(project, episode, shot, frame));
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
