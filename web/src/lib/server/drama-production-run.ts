import { createHash } from "node:crypto";

import { nanoid } from "nanoid";

import { approvedAssetReference, approvedScenePanoramaReference, hasApprovedAssetReference, hasApprovedScenePanoramaReference } from "@/lib/drama-asset-baseline";
import { continuityStartEvidence } from "@/lib/drama-continuity-policy";
import { planDramaVideoSegments } from "@/lib/drama-frame-sequence";
import { dramaReferenceImageBudget } from "@/lib/drama-production-plan";
import { compileDramaShotExecutionPrompts, sanitizeDramaSupplierText } from "@/lib/drama-prompt-compiler";
import { resolveDramaVideoReferenceMode, selectedDramaShotFrameIds, selectedDramaShotReferenceAssetIds } from "@/lib/drama-video-reference-plan";
import type { DramaEpisode, DramaProductionPlan, DramaProductionRun, DramaProductionStep, DramaProject, DramaVideoReferenceBinding, DramaVideoReferenceMode } from "@/lib/drama-project-contract";

export type DramaProductionParameterInput = {
    imageModel: string;
    videoModel: string;
    videoChannelId?: string;
    audioModel?: string;
    imageQuality?: string;
    videoQuality?: string;
    maxVideoSeconds?: number;
    minVideoSeconds?: number;
    maxReferenceImages?: number;
    productionPlan?: DramaProductionPlan;
    referenceSelections?: Record<string, string[]>;
    referenceModes?: Record<string, DramaVideoReferenceMode>;
};

export function buildDramaProductionRun(project: DramaProject, episode: DramaEpisode, parameters: DramaProductionParameterInput): DramaProductionRun {
    const configuredPlan = parameters.productionPlan || project.productionBible?.productionPlan;
    const productionPlan = configuredPlan ? { ...configuredPlan, video: { ...configuredPlan.video, model: parameters.videoModel } } : undefined;
    const steps: DramaProductionStep[] = [];
    const anchorStepIds = new Map<string, string>();
    const referencedAssetIds = new Set(episode.shots.flatMap((shot) => selectedDramaShotReferenceAssetIds(project, shot, parameters.referenceSelections)));
    for (const assetId of referencedAssetIds) {
        const id = `anchor-${assetId}`;
        anchorStepIds.set(assetId, id);
        const asset = [...project.characters, ...project.scenes, ...project.props, ...project.clues].find((item) => item.id === assetId);
        const source = project.sourceAssets?.find((item) => item.id === assetId && item.type === "image" && Boolean(item.serverUrl || item.remoteUrl));
        steps.push({
            id,
            type: "asset_anchor",
            assetId,
            dependsOn: [],
            status: hasApprovedAssetReference(asset) || source ? "success" : "blocked",
            outputUrls: source ? [source.serverUrl || source.remoteUrl!] : undefined,
            outputRemoteUrls: source?.remoteUrl ? [source.remoteUrl] : undefined,
        });
    }

    const qcStepIds = new Map<string, string>();
    for (const shot of [...episode.shots].sort((left, right) => left.order - right.order)) {
        const incoming = episode.continuityEdges?.find((edge) => edge.toShotId === shot.id && edge.inheritActualEndFrame);
        const assetIds = selectedDramaShotReferenceAssetIds(project, shot, parameters.referenceSelections);
        const assetDependencies = assetIds.map((id) => anchorStepIds.get(id)).filter((id): id is string => Boolean(id));
        const previousQc = incoming ? qcStepIds.get(incoming.fromShotId) : undefined;
        const continuityDependencies = previousQc ? [previousQc] : [];
        const referenceMode = resolveDramaVideoReferenceMode(parameters.referenceModes?.[shot.id]);
        const selectedFrameIds = selectedDramaShotFrameIds(shot, referenceMode, parameters.referenceSelections);
        const frameStepIds: string[] = [];
        const allFrames = referenceMode === "all_frames" && Boolean(shot.framePlan?.frames.length);
        let videoSegments: Array<{ startSecond: number; endSecond: number; duration: number; frameIds: string[] }>;

        if (allFrames) {
            const allBeats = shot.framePlan!.frames;
            const beats = allBeats;
            for (const [beatIndex, beat] of allBeats.entries()) {
                const stored = shot.storyboardFrames?.find((frame) => frame.id === beat.id || frame.sequenceIndex === beat.sequenceIndex);
                const id = `frame-${shot.id}-${beat.id}`;
                frameStepIds.push(id);
                steps.push({
                    id,
                    frameId: beat.id,
                    shotId: shot.id,
                    type: "keyframe",
                    sequenceIndex: beat.sequenceIndex,
                    startSecond: beat.startSecond,
                    endSecond: beat.endSecond,
                    dependsOn: [...assetDependencies, ...(beatIndex === 0 ? continuityDependencies : [])],
                    status: validFrame(stored, true) ? "success" : "blocked",
                    outputUrls: validFrame(stored, true) ? [stored!.mediaUrl!] : undefined,
                    outputRemoteUrls: validFrame(stored, true) && stored!.remoteUrl ? [stored!.remoteUrl] : undefined,
                    continuityEvidenceId: stored?.continuityEvidenceId,
                    referenceShotId: beat.sequenceIndex === 1 ? incoming?.fromShotId : undefined,
                });
            }
            videoSegments = planDramaVideoSegments(beats, {
                minDurationSeconds: Math.max(0, parameters.minVideoSeconds || 0),
                maxDurationSeconds: parameters.maxVideoSeconds && parameters.maxVideoSeconds > 0 ? parameters.maxVideoSeconds : shot.duration,
                maxReferenceImages: Math.min(parameters.maxReferenceImages && parameters.maxReferenceImages > 0 ? parameters.maxReferenceImages : dramaReferenceImageBudget(shot.duration), dramaReferenceImageBudget(shot.duration)),
                assetReferenceCount: assetIds.length + (incoming ? 1 : 0),
            });
        } else {
            videoSegments = durationSegments(shot.duration, parameters.maxVideoSeconds);
        }

        const videoStepIds: string[] = [];
        for (const [index, segment] of videoSegments.entries()) {
            const id = videoSegments.length === 1 ? `video-${shot.id}` : `video-${shot.id}-${index + 1}`;
            const segmentFrames: Array<{ mediaUrl: string; remoteUrl?: string; frameId?: string; sequenceIndex?: number }> = allFrames
                ? segment.frameIds
                      .map((frameId) => shot.storyboardFrames?.find((frame) => frame.id === frameId))
                      .flatMap((frame) => (frame?.mediaUrl ? [{ mediaUrl: frame.mediaUrl, remoteUrl: frame.remoteUrl, frameId: frame.id, sequenceIndex: frame.sequenceIndex }] : []))
                : selectedFrameIds
                      .map((frameId) => storyboardFrameForId(shot, frameId))
                      .flatMap((frame) => (frame?.mediaUrl && validFrame(frame) ? [{ mediaUrl: frame.mediaUrl, remoteUrl: frame.remoteUrl, frameId: frame.id, sequenceIndex: frame.sequenceIndex }] : []));
            const previousShot = incoming ? episodeShot(project, episode, incoming.fromShotId) : undefined;
            const continuityTail = index === 0 && previousShot ? continuityStartEvidence(previousShot) : undefined;
            const orderedFrames = continuityTail ? [{ mediaUrl: continuityTail.mediaUrl, remoteUrl: continuityTail.remoteUrl }, ...segmentFrames] : segmentFrames;
            const dependencies = [...assetDependencies, ...continuityDependencies, ...(allFrames ? frameStepIds : []), ...(index ? [videoStepIds[index - 1]] : [])];
            videoStepIds.push(id);
            steps.push({
                id,
                shotId: shot.id,
                type: "video",
                clipIndex: index + 1,
                startSecond: segment.startSecond,
                endSecond: segment.endSecond,
                duration: segment.duration,
                dependsOn: Array.from(new Set(dependencies)),
                status: dependencies.every((dependency) => steps.find((step) => step.id === dependency)?.status === "success") ? "ready" : "blocked",
                title: `${shot.title} · 视频段 ${index + 1}/${videoSegments.length}`,
                prompt: compileDramaShotExecutionPrompts(project, episode, shot).videoPrompt,
                referenceAssetIds: assetIds,
                referenceImageUrls: orderedFrames.map((frame) => frame.mediaUrl!),
                referenceImageRemoteUrls: orderedFrames.map((frame) => frame.remoteUrl),
                referenceBindingsSnapshot: buildVideoReferenceBindings(project, shot, orderedFrames, assetIds, incoming?.fromShotId, referenceMode),
                referenceMode,
            });
        }

        const extractId = `extract-${shot.id}`;
        const qcId = `qc-${shot.id}`;
        steps.push({ id: extractId, shotId: shot.id, type: "extract_frames", dependsOn: videoStepIds.length ? [videoStepIds.at(-1)!] : [], status: "blocked" });
        steps.push({ id: qcId, shotId: shot.id, type: "continuity_qc", dependsOn: [extractId], status: "blocked", referenceShotId: incoming?.fromShotId });
        qcStepIds.set(shot.id, qcId);
    }

    const now = new Date().toISOString();
    const planRevision = createHash("sha256")
        .update(JSON.stringify({ projectId: project.id, updatedAt: project.updatedAt, episode, parameters }))
        .digest("hex");
    return {
        id: `drama-run-${nanoid()}`,
        projectId: project.id,
        episodeId: episode.id,
        planRevision,
        status: "ready",
        mode: project.productionBible?.continuityMode || "strict",
        parameterSnapshot: { ...parameters, ratio: productionPlan?.video.ratio || project.ratio, productionPlan, modelParameters: productionPlan?.video.modelParameters },
        steps,
        createdAt: now,
        updatedAt: now,
    };
}

export function invalidateDramaProductionRunFromShot(run: DramaProductionRun, episode: DramaEpisode, shotId: string): DramaProductionRun {
    const affected = new Set([shotId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const edge of episode.continuityEdges || []) {
            if (edge.inheritActualEndFrame && affected.has(edge.fromShotId) && !affected.has(edge.toShotId)) {
                affected.add(edge.toShotId);
                changed = true;
            }
        }
    }
    return {
        ...run,
        status: "paused",
        steps: run.steps.map((step) => (step.shotId && affected.has(step.shotId) ? { ...step, status: "stale" as const, taskId: undefined, outputUrls: undefined, error: undefined } : step)),
        updatedAt: new Date().toISOString(),
    };
}

export function unlockDramaProductionSteps(run: DramaProductionRun) {
    const statuses = new Map(run.steps.map((step) => [step.id, step.status]));
    const steps = run.steps.map((step) => (step.status === "blocked" && step.dependsOn.every((id) => statuses.get(id) === "success") ? { ...step, status: "ready" as const } : step));
    const execution = steps.filter((step) => step.type !== "asset_anchor" && step.type !== "start_frame" && step.type !== "end_frame" && step.type !== "keyframe");
    const failed = steps.some((step) => step.status === "failed" || step.status === "needs_review");
    const active = execution.some((step) => step.status === "ready" || step.status === "running" || step.status === "blocked");
    return { ...run, steps, status: failed ? ("needs_review" as const) : active ? ("running" as const) : ("completed" as const), updatedAt: new Date().toISOString() };
}

export function refreshDramaVideoStepReferences(project: DramaProject, episode: DramaEpisode, step: DramaProductionStep): DramaProductionStep {
    if (step.type !== "video" || !step.shotId) return step;
    const shot = episode.shots.find((item) => item.id === step.shotId);
    if (!shot) return step;
    const incoming = episode.continuityEdges?.find((edge) => edge.toShotId === shot.id && edge.inheritActualEndFrame);
    const referenceMode = resolveDramaVideoReferenceMode(step.referenceMode);
    const allFrames = referenceMode === "all_frames" && Boolean(shot.framePlan?.frames.length);
    const frameIds = allFrames
        ? shot.framePlan!.frames.filter((frame) => frame.startSecond >= (step.startSecond || 0) && frame.startSecond <= (step.endSecond || shot.duration)).map((frame) => frame.id)
        : (step.referenceBindingsSnapshot || []).filter((binding) => binding.role === "reference" && binding.frameId).map((binding) => binding.frameId!);
    const frameRefs = allFrames
        ? frameIds.flatMap((frameId) => {
              const frame = storyboardFrameForId(shot, frameId);
              return validFrame(frame, true) ? [{ mediaUrl: frame!.mediaUrl!, remoteUrl: frame!.remoteUrl, frameId: frame!.id, sequenceIndex: frame!.sequenceIndex }] : [];
          })
        : frameIds.flatMap((frameId) => {
              const frame = storyboardFrameForId(shot, frameId);
              return validFrame(frame) ? [{ mediaUrl: frame!.mediaUrl!, remoteUrl: frame!.remoteUrl, frameId: frame!.id, sequenceIndex: frame!.sequenceIndex }] : [];
          });
    const previousShot = incoming ? episodeShot(project, episode, incoming.fromShotId) : undefined;
    const continuityTail = step.clipIndex === 1 && previousShot ? continuityStartEvidence(previousShot) : undefined;
    const orderedFrames = continuityTail ? [{ mediaUrl: continuityTail.mediaUrl, remoteUrl: continuityTail.remoteUrl }, ...frameRefs] : frameRefs;
    const basePrompt = compileDramaShotExecutionPrompts(project, episode, shot).videoPrompt;
    return {
        ...step,
        prompt: basePrompt,
        referenceImageUrls: orderedFrames.map((frame) => frame.mediaUrl),
        referenceImageRemoteUrls: orderedFrames.map((frame) => frame.remoteUrl),
        referenceBindingsSnapshot: buildVideoReferenceBindings(project, shot, orderedFrames, step.referenceAssetIds || [], incoming?.fromShotId, referenceMode),
        referenceMode,
    };
}

function episodeShot(project: DramaProject, episode: DramaEpisode, shotId: string) {
    return episode.shots.find((shot) => shot.id === shotId) || project.episodes.flatMap((item) => item.shots).find((shot) => shot.id === shotId);
}

function buildVideoReferenceBindings(
    project: DramaProject,
    shot: DramaEpisode["shots"][number],
    frames: Array<{ mediaUrl: string; remoteUrl?: string; frameId?: string; sequenceIndex?: number }>,
    assetIds: string[],
    previousShotId?: string,
    referenceMode: DramaVideoReferenceMode = "reference",
): DramaVideoReferenceBinding[] {
    const manifest = shot.framePlan?.referenceManifest || [];
    const roleFor = (assetId: string): DramaVideoReferenceBinding["role"] => {
        const role = manifest.find((item) => item.assetId === assetId)?.role;
        if (role === "character_anchor") return "character_anchor";
        if (role === "scene_anchor") return "scene_anchor";
        if (assetId === shot.sceneId) return "scene_anchor";
        if (shot.characterIds.includes(assetId)) return "character_anchor";
        return "prop_anchor";
    };
    const purposeFor = (assetId: string) => manifest.find((item) => item.assetId === assetId)?.purpose || "项目资产基准图";
    const hasPreviousTail = Boolean(previousShotId && frames[0] && !frames[0].frameId);
    const bindings: DramaVideoReferenceBinding[] = frames.map((frame, index) => {
        const isPreviousTail = index === 0 && Boolean(previousShotId) && !frame.frameId;
        const role = isPreviousTail ? "first_frame" : referenceMode === "all_frames" ? "keyframe" : "reference";
        const assignedKeyframeIndex = role === "keyframe" ? index + 1 - (hasPreviousTail ? 1 : 0) : undefined;
        return {
            alias: `@图片${index + 1}`,
            role,
            purpose: isPreviousTail ? "上一镜当前视频版本的已人工验收实际尾帧" : referenceMode === "all_frames" ? `顺序帧 ${assignedKeyframeIndex}` : "可选细节参考图",
            shotId: isPreviousTail ? previousShotId : shot.id,
            frameId: frame.frameId,
            url: frame.mediaUrl,
            remoteUrl: frame.remoteUrl,
            ...(assignedKeyframeIndex ? { keyframeIndex: assignedKeyframeIndex } : {}),
        };
    });
    const assetBindings: DramaVideoReferenceBinding[] = [];
    for (const assetId of assetIds) {
        const asset = [...project.characters, ...project.scenes, ...project.props, ...project.clues].find((item) => item.id === assetId);
        const source = project.sourceAssets?.find((item) => item.id === assetId && item.type === "image");
        const isScene = assetId === shot.sceneId;
        const reference = asset
            ? isScene
                ? hasApprovedScenePanoramaReference(asset)
                    ? assetReference(asset, true)
                    : undefined
                : hasApprovedAssetReference(asset)
                  ? assetReference(asset)
                  : undefined
            : source?.serverUrl || source?.remoteUrl
              ? { url: source.serverUrl || source.remoteUrl!, remoteUrl: source.remoteUrl }
              : undefined;
        if (reference?.url) assetBindings.push({ alias: `@图片${bindings.length + assetBindings.length + 1}`, role: roleFor(assetId), purpose: purposeFor(assetId), sourceId: assetId, url: reference.url, remoteUrl: reference.remoteUrl });
    }
    return [...bindings, ...assetBindings];
}

function assetReference(asset: NonNullable<DramaProject["characters"]>[number], scene = false) {
    const reference = scene ? approvedScenePanoramaReference(asset) : approvedAssetReference(asset);
    return reference ? { url: reference.url, remoteUrl: reference.remoteUrl } : undefined;
}

function validFrame(frame: DramaEpisode["shots"][number]["storyboardFrames"] extends Array<infer T> | undefined ? T | undefined : never, requireAccepted = false) {
    return Boolean(frame?.mediaUrl && frame.status === "success" && frame.continuityStatus !== "stale" && (!requireAccepted || (frame.continuityStatus !== "needs_review" && frame.continuityStatus !== "pending")));
}

function storyboardFrameForId(shot: DramaEpisode["shots"][number], frameId: string) {
    const beat = shot.framePlan?.frames.find((item) => item.id === frameId);
    return shot.storyboardFrames?.find((frame) => frame.id === frameId || (beat && frame.sequenceIndex === beat.sequenceIndex));
}

function durationSegments(duration: number, maxVideoSeconds?: number) {
    const max = maxVideoSeconds && maxVideoSeconds > 0 ? maxVideoSeconds : duration;
    const count = Math.ceil(duration / max);
    return Array.from({ length: count }, (_, index) => ({ startSecond: index * max, endSecond: Math.min(duration, (index + 1) * max), duration: Math.min(max, duration - index * max), frameIds: [] }));
}
