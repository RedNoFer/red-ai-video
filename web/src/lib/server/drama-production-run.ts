import { createHash } from "node:crypto";

import { nanoid } from "nanoid";

import { hasApprovedAssetReference } from "@/lib/drama-asset-baseline";
import { latestFrameEvidence } from "@/lib/drama-continuity-policy";
import { planDramaVideoSegments } from "@/lib/drama-frame-sequence";
import type { DramaEpisode, DramaProductionPlan, DramaProductionRun, DramaProductionStep, DramaProject } from "@/lib/drama-project-contract";

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
};

export function buildDramaProductionRun(project: DramaProject, episode: DramaEpisode, parameters: DramaProductionParameterInput): DramaProductionRun {
    const configuredPlan = parameters.productionPlan || project.productionBible?.productionPlan;
    const productionPlan = configuredPlan ? { ...configuredPlan, video: { ...configuredPlan.video, model: parameters.videoModel } } : undefined;
    const steps: DramaProductionStep[] = [];
    const anchorStepIds = new Map<string, string>();
    const referencedAssetIds = new Set(episode.shots.flatMap((shot) => shotReferenceIds(project, shot)));
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
        const assetIds = shotReferenceIds(project, shot);
        const assetDependencies = assetIds.map((id) => anchorStepIds.get(id)).filter((id): id is string => Boolean(id));
        const previousQc = incoming ? qcStepIds.get(incoming.fromShotId) : undefined;
        const continuityDependencies = previousQc ? [previousQc] : [];
        const frameStepIds: string[] = [];
        const allFrames = shot.storyboardFrameMode === "all_frames" && Boolean(shot.framePlan?.frames.length);
        let videoSegments: Array<{ startSecond: number; endSecond: number; duration: number; frameIds: string[] }>;

        if (allFrames) {
            const beats = shot.framePlan!.frames;
            for (const beat of beats) {
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
                    dependsOn: beat.sequenceIndex === 1 ? [...assetDependencies, ...continuityDependencies] : [`frame-${shot.id}-${beats[beat.sequenceIndex - 2].id}`],
                    status: validFrame(stored) ? "success" : "blocked",
                    outputUrls: validFrame(stored) ? [stored!.mediaUrl!] : undefined,
                    outputRemoteUrls: validFrame(stored) && stored!.remoteUrl ? [stored!.remoteUrl] : undefined,
                    continuityEvidenceId: stored?.continuityEvidenceId,
                    referenceShotId: beat.sequenceIndex === 1 ? incoming?.fromShotId : undefined,
                });
            }
            videoSegments = planDramaVideoSegments(beats, {
                minDurationSeconds: Math.max(0, parameters.minVideoSeconds || 0),
                maxDurationSeconds: parameters.maxVideoSeconds && parameters.maxVideoSeconds > 0 ? parameters.maxVideoSeconds : shot.duration,
                maxReferenceImages: Math.min(parameters.maxReferenceImages && parameters.maxReferenceImages > 0 ? parameters.maxReferenceImages : assetIds.length + beats.length, assetIds.length + 5, 9),
                assetReferenceCount: assetIds.length,
            });
        } else {
            const start = latestFrameEvidence(shot, "storyboard_start", ["candidate", "accepted"]);
            const end = latestFrameEvidence(shot, "storyboard_end", ["candidate", "accepted"]);
            const usesStoryboard = (shot.videoMode || project.defaultVideoMode) !== "direct";
            if (usesStoryboard) {
                const startId = `start-${shot.id}`;
                frameStepIds.push(startId);
                steps.push({
                    id: startId,
                    shotId: shot.id,
                    type: "start_frame",
                    dependsOn: [...assetDependencies, ...continuityDependencies],
                    status: start ? "success" : "blocked",
                    outputUrls: start ? [start.mediaUrl] : undefined,
                    outputRemoteUrls: start?.remoteUrl ? [start.remoteUrl] : undefined,
                    referenceShotId: incoming?.fromShotId,
                });
                if (shot.storyboardFrameMode === "first_last") {
                    const endId = `end-${shot.id}`;
                    frameStepIds.push(endId);
                    steps.push({ id: endId, shotId: shot.id, type: "end_frame", dependsOn: [startId], status: end ? "success" : "blocked", outputUrls: end ? [end.mediaUrl] : undefined, outputRemoteUrls: end?.remoteUrl ? [end.remoteUrl] : undefined });
                }
            }
            videoSegments = durationSegments(shot.duration, parameters.maxVideoSeconds);
        }

        const videoStepIds: string[] = [];
        for (const [index, segment] of videoSegments.entries()) {
            const id = videoSegments.length === 1 ? `video-${shot.id}` : `video-${shot.id}-${index + 1}`;
            const segmentFrames = allFrames
                ? segment.frameIds.map((frameId) => shot.storyboardFrames?.find((frame) => frame.id === frameId)).filter((frame): frame is NonNullable<typeof frame> => Boolean(frame?.mediaUrl))
                : frameStepIds.map((stepId) => steps.find((step) => step.id === stepId)).flatMap((step) => (step?.outputUrls?.[0] ? [{ mediaUrl: step.outputUrls[0], remoteUrl: step.outputRemoteUrls?.[0] }] : []));
            const dependencies = [
                ...assetDependencies,
                ...continuityDependencies,
                ...frameStepIds.filter((stepId) => !allFrames || segment.frameIds.some((frameId) => stepId === `frame-${shot.id}-${frameId}`)),
                ...(index ? [videoStepIds[index - 1]] : []),
            ];
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
                prompt: allFrames ? compileDramaVideoSegmentPrompt(shot, segment.frameIds) : shot.executionVideoPrompt || shot.videoPrompt,
                referenceAssetIds: assetIds,
                referenceImageUrls: segmentFrames.map((frame) => frame.mediaUrl!),
                referenceImageRemoteUrls: segmentFrames.map((frame) => frame.remoteUrl),
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

export function compileDramaVideoSegmentPrompt(shot: DramaEpisode["shots"][number], frameIds: string[]) {
    const frames = frameIds.flatMap((id) => shot.framePlan?.frames.find((frame) => frame.id === id) || []);
    return [shot.executionVideoPrompt || shot.videoPrompt, ...frames.map((frame) => `P${String(shot.order).padStart(2, "0")}-F${String(frame.sequenceIndex).padStart(2, "0")} ${frame.startSecond}-${frame.endSecond}s：${frame.actionPrompt}`)]
        .filter(Boolean)
        .join("\n");
}

function shotReferenceIds(project: DramaProject, shot: DramaEpisode["shots"][number]) {
    const available = [shot.sceneId, ...shot.characterIds, ...shot.propIds, ...shot.clueIds, ...(shot.sourceAssetIds || [])].filter((id): id is string => {
        if (!id) return false;
        const source = project.sourceAssets?.find((item) => item.id === id);
        return !source || (source.type === "image" && Boolean(source.serverUrl || source.remoteUrl));
    });
    const preferred = (shot.framePlan?.referenceManifest || []).flatMap((item) => (item.assetId && available.includes(item.assetId) ? [item.assetId] : []));
    return Array.from(new Set([...preferred, ...available]));
}

function validFrame(frame: DramaEpisode["shots"][number]["storyboardFrames"] extends Array<infer T> | undefined ? T | undefined : never) {
    return Boolean(frame?.mediaUrl && frame.status === "success" && frame.continuityStatus !== "needs_review" && frame.continuityStatus !== "stale");
}

function durationSegments(duration: number, maxVideoSeconds?: number) {
    const max = maxVideoSeconds && maxVideoSeconds > 0 ? maxVideoSeconds : duration;
    const count = Math.ceil(duration / max);
    return Array.from({ length: count }, (_, index) => ({ startSecond: index * max, endSecond: Math.min(duration, (index + 1) * max), duration: Math.min(max, duration - index * max), frameIds: [] }));
}
