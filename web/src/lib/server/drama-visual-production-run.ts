import { createHash } from "node:crypto";

import { nanoid } from "nanoid";

import { compileDramaAssetReferencePrompt, compileDramaFrameSupplierPrompt, resolveDramaFrameScene } from "@/lib/drama-prompt-compiler";
import { approvedAssetReference } from "@/lib/drama-asset-baseline";
import { continuityStartEvidence, latestFrameEvidence } from "@/lib/drama-continuity-policy";
import type { DramaEpisode, DramaNamedAsset, DramaProductionRun, DramaProductionStep, DramaProject } from "@/lib/drama-project-contract";

type VisualParameters = {
    imageModel: string;
    imageChannelId?: string;
    imageQuality?: string;
    shotIds?: string[];
    frameType?: "start_frame" | "end_frame" | "all_frames";
    frameCount?: number;
    frameIds?: string[];
    regenerateAll?: boolean;
};

type AssetKind = "characters" | "scenes" | "props";
// Reference-scene resolution changed: existing visual runs must not reuse stale snapshots.
const VISUAL_DISPATCH_REVISION = "reference-edit-kind-v3";

export function buildDramaVisualProductionRun(project: DramaProject, episode: DramaEpisode, parameters: VisualParameters): DramaProductionRun {
    const steps: DramaProductionStep[] = [];
    const assetSteps = new Map<string, string>();
    const selectedShots = selectedEpisodeShots(episode, parameters.shotIds);
    const usedAssets = visualAssets(project, selectedShots);

    for (const { asset, kind, label } of usedAssets) {
        const id = `asset-${asset.id}`;
        assetSteps.set(asset.id, id);
        const approved = approvedAssetReference(asset);
        steps.push({
            id,
            type: "asset_anchor",
            assetId: asset.id,
            assetKind: kind,
            title: `${label} · ${asset.name}`,
            prompt: compileDramaAssetReferencePrompt(project, asset, label),
            dependsOn: [],
            status: approved ? "success" : "ready",
            outputUrls: approved ? [approved.url] : undefined,
        });
    }

    for (const shot of [...selectedShots].sort((left, right) => left.order - right.order)) {
        const incoming = episode.continuityEdges?.find((edge) => edge.toShotId === shot.id && edge.inheritActualEndFrame);
        const requiresAcceptedTail = shot.framePlan?.start.source === "previous_accepted_actual_tail" || Boolean(incoming);
        const previous = requiresAcceptedTail && incoming ? episode.shots.find((candidate) => candidate.id === incoming.fromShotId) : undefined;
        const actualTail = previous ? continuityStartEvidence(previous) : undefined;
        const actualTailReady = !requiresAcceptedTail || Boolean(actualTail);
        const references = orderedVisualReferenceIds(project, shot);
        const dependencies = references.map((id) => assetSteps.get(id)).filter((id): id is string => Boolean(id));
        const startId = `start-${shot.id}`;
        const startFrame = latestFrameEvidence(shot, "storyboard_start", ["candidate", "accepted"]);
        const endFrame = latestFrameEvidence(shot, "storyboard_end", ["candidate", "accepted"]);
        const startReady = Boolean(startFrame);
        const generateEndFrame = parameters.frameType === "end_frame";
        const allFrames = parameters.frameType === "all_frames" || shot.storyboardFrameMode === "all_frames";
        if (allFrames) {
            const beats = shot.framePlan?.frames || [];
            if (!beats.length) continue;
            const selectedFrameIds = new Set(parameters.frameIds || []);
            for (const [index, beat] of beats.entries()) {
                const frameReferences = orderedVisualReferenceIds(project, shot, beat);
                const frameDependencies = frameReferences.map((id) => assetSteps.get(id)).filter((id): id is string => Boolean(id));
                const previousBeat = beats[index - 1];
                const previousStored = previousBeat ? shot.storyboardFrames?.find((frame) => frame.id === previousBeat.id || frame.sequenceIndex === previousBeat.sequenceIndex) : undefined;
                const existing = shot.storyboardFrames?.find((frame) => frame.id === beat.id || frame.sequenceIndex === beat.sequenceIndex);
                const previousUrl = index ? previousStored?.mediaUrl : actualTail?.mediaUrl;
                const inputHash = createHash("sha256")
                    .update(JSON.stringify({ beat, previousUrl, referenceUrls: frameReferences }))
                    .digest("hex");
                const explicitlySelected = !selectedFrameIds.size || selectedFrameIds.has(beat.id);
                const selectedForRegeneration = selectedFrameIds.size > 0 && selectedFrameIds.has(beat.id);
                const existingReady = Boolean(existing?.mediaUrl && existing.status === "success" && (existing.source === "upload" || existing.inputHash === inputHash) && !parameters.regenerateAll && !selectedForRegeneration);
                const previousStepId = previousBeat ? `frame-${shot.id}-${previousBeat.id}` : undefined;
                const previousStep = previousStepId ? steps.find((step) => step.id === previousStepId) : undefined;
                const inheritedDependencies = previousStepId && previousStep?.status !== "stale" ? [previousStepId] : [];
                const previousAssetDependencies = new Set(previousStep?.dependsOn || []);
                const stepDependencies = Array.from(new Set([...inheritedDependencies, ...frameDependencies.filter((dependency) => !previousAssetDependencies.has(dependency))]));
                steps.push({
                    id: `frame-${shot.id}-${beat.id}`,
                    frameId: beat.id,
                    shotId: shot.id,
                    type: "keyframe",
                    sequenceIndex: beat.sequenceIndex,
                    startSecond: beat.startSecond,
                    endSecond: beat.endSecond,
                    title: `${shot.title} · 帧 ${beat.sequenceIndex}`,
                    prompt: compileDramaFrameBeatPrompt(project, episode, shot, beat),
                    referenceAssetIds: frameReferences,
                    manualReferenceImages: shot.framePlan?.manualReferenceImages,
                    referenceManifest: scopedReferenceManifest(project, shot, beat),
                    dependsOn: stepDependencies,
                    status: existingReady ? "success" : !explicitlySelected ? "stale" : stepDependencies.length || !actualTailReady ? "blocked" : "ready",
                    referenceShotId: index === 0 && requiresAcceptedTail ? incoming?.fromShotId : undefined,
                    referenceImageUrls: previousUrl ? [previousUrl] : undefined,
                    referenceImageRemoteUrls: index ? (previousStored?.remoteUrl ? [previousStored.remoteUrl] : undefined) : actualTail?.remoteUrl ? [actualTail.remoteUrl] : undefined,
                    inputHash,
                    outputUrls: existingReady && existing?.mediaUrl ? [existing.mediaUrl] : undefined,
                    outputRemoteUrls: existingReady && existing?.remoteUrl ? [existing.remoteUrl] : undefined,
                    continuityEvidenceId: existingReady ? existing?.continuityEvidenceId : undefined,
                });
            }
        } else
            steps.push({
                id: startId,
                shotId: shot.id,
                type: "start_frame",
                title: `${shot.title} · 起始帧`,
                prompt: compileDramaVisualStartFramePrompt(project, episode, shot),
                referenceAssetIds: references,
                manualReferenceImages: shot.framePlan?.manualReferenceImages,
                dependsOn: dependencies,
                status: generateEndFrame ? (startReady ? "success" : "blocked") : startReady ? "success" : dependencies.length || !actualTailReady ? "blocked" : "ready",
                referenceShotId: requiresAcceptedTail ? incoming?.fromShotId : undefined,
                referenceImageUrls: actualTailReady && actualTail?.mediaUrl ? [actualTail.mediaUrl] : undefined,
                outputUrls: startFrame ? [startFrame.mediaUrl] : undefined,
            });
        if (!allFrames && shot.storyboardFrameMode === "first_last" && parameters.frameType !== "start_frame") {
            steps.push({
                id: `end-${shot.id}`,
                shotId: shot.id,
                type: "end_frame",
                title: `${shot.title} · 结束帧`,
                prompt: compileDramaFrameSupplierPrompt(project, episode, shot, undefined, "end"),
                referenceAssetIds: references,
                manualReferenceImages: shot.framePlan?.manualReferenceImages,
                dependsOn: [startId],
                status: endFrame ? "success" : "blocked",
                outputUrls: endFrame ? [endFrame.mediaUrl] : undefined,
            });
        }
    }

    const blockers = visualPlanBlockers(project, episode, selectedShots);
    const now = new Date().toISOString();
    const planRevision = createHash("sha256")
        .update(
            JSON.stringify({
                revision: VISUAL_DISPATCH_REVISION,
                projectId: project.id,
                updatedAt: project.updatedAt,
                episode,
                imageModel: parameters.imageModel,
                imageChannelId: parameters.imageChannelId,
                shotIds: selectedShots.map((shot) => shot.id),
                frameType: parameters.frameType,
                frameIds: parameters.frameIds,
                regenerateAll: parameters.regenerateAll,
            }),
        )
        .digest("hex");
    return {
        id: `drama-run-${nanoid()}`,
        projectId: project.id,
        episodeId: episode.id,
        planRevision,
        status: blockers.length ? "planning" : "ready",
        scope: "visual",
        mode: project.productionBible?.continuityMode || "strict",
        parameterSnapshot: { imageModel: parameters.imageModel, imageChannelId: parameters.imageChannelId, videoModel: "", imageQuality: parameters.imageQuality, ratio: project.ratio },
        steps,
        blockers,
        createdAt: now,
        updatedAt: now,
    };
}

export function compileDramaVisualStepPrompt(project: DramaProject, episode: DramaEpisode, step: DramaProductionStep) {
    if (step.type === "asset_anchor" && step.assetId && step.assetKind) {
        const asset = project[step.assetKind].find((candidate) => candidate.id === step.assetId);
        return asset ? compileDramaAssetReferencePrompt(project, asset, step.assetKind === "characters" ? "角色" : step.assetKind === "scenes" ? "场景" : "道具") : step.prompt || "";
    }
    if (!step.shotId) return step.prompt || "";
    const shot = episode.shots.find((candidate) => candidate.id === step.shotId);
    if (!shot) return step.prompt || "";
    const beat = step.type === "keyframe" ? shot.framePlan?.frames?.find((frame) => frame.id === step.frameId || frame.sequenceIndex === step.sequenceIndex) : undefined;
    const prompt = step.type === "end_frame" ? compileDramaFrameSupplierPrompt(project, episode, shot, undefined, "end") : beat ? compileDramaFrameBeatPrompt(project, episode, shot, beat) : compileDramaVisualStartFramePrompt(project, episode, shot);
    return (step.type === "start_frame" || step.type === "keyframe") && step.referenceImageUrls?.length
        ? `${prompt}\n上一镜成片实际尾帧是唯一开场依据：必须以该实际尾帧作为本镜头第一帧，保持人物、姿态、光线、环境和构图连续；当前镜头维护的分镜起始帧只能作为辅助参考，不得替代或覆盖实际尾帧。`
        : prompt;
}

export function compileDramaVisualStartFramePrompt(project: DramaProject, episode: DramaEpisode, shot: DramaEpisode["shots"][number]) {
    return compileDramaFrameSupplierPrompt(project, episode, shot, undefined, "start");
}

export function unlockDramaVisualSteps(run: DramaProductionRun) {
    const statuses = new Map(run.steps.map((step) => [step.id, step.status]));
    const byId = new Map(run.steps.map((step) => [step.id, step]));
    const steps = run.steps.map((step) => {
        if (step.status !== "blocked" || !step.dependsOn.every((id) => statuses.get(id) === "success")) return step;
        const previousFrame =
            step.type === "keyframe" ? step.dependsOn.map((id) => byId.get(id)).find((item) => item?.type === "keyframe") : step.type === "end_frame" ? step.dependsOn.map((id) => byId.get(id)).find((item) => item?.type === "start_frame") : undefined;
        return {
            ...step,
            status: "ready" as const,
            ...(previousFrame?.outputUrls?.[0] ? { referenceImageUrls: [previousFrame.outputUrls[0]], referenceImageRemoteUrls: previousFrame.outputRemoteUrls?.[0] ? [previousFrame.outputRemoteUrls[0]] : undefined } : {}),
        };
    });
    const visual = steps.filter((step) => ["asset_anchor", "start_frame", "end_frame", "keyframe"].includes(step.type));
    const active = visual.some((step) => ["ready", "running", "blocked"].includes(step.status));
    const failed = visual.some((step) => ["failed", "needs_review"].includes(step.status));
    const status = run.scope === "visual" ? (failed ? ("needs_review" as const) : active ? (run.confirmedAt ? ("running" as const) : run.status) : ("completed" as const)) : run.status;
    return { ...run, steps, status, updatedAt: new Date().toISOString() };
}

export function compileDramaFrameBeatPrompt(project: DramaProject, episode: DramaEpisode, shot: DramaEpisode["shots"][number], beat: NonNullable<DramaEpisode["shots"][number]["framePlan"]>["frames"][number]) {
    const base = compileDramaFrameSupplierPrompt(project, episode, shot, beat);
    return base + `\n帧：P${String(shot.order).padStart(2, "0")}-F${String(beat.sequenceIndex).padStart(2, "0")}（${beat.startSecond}-${beat.endSecond}s）`;
}

function selectedEpisodeShots(episode: DramaEpisode, shotIds?: string[]) {
    const selected = new Set(shotIds || []);
    return selected.size ? episode.shots.filter((shot) => selected.has(shot.id)) : episode.shots;
}

function orderedVisualReferenceIds(project: DramaProject, shot: DramaEpisode["shots"][number], beat?: NonNullable<DramaEpisode["shots"][number]["framePlan"]>["frames"][number]) {
    // An explicitly maintained list replaces inferred shot assets; continuity frames remain separate.
    if (shot.framePlan?.manualReferenceImages) return [];
    const manifest = scopedReferenceManifest(project, shot, beat);
    const sceneIds = new Set((shot.framePlan?.referenceManifest || []).filter((item) => item.role === "scene_anchor" && item.assetId).map((item) => item.assetId));
    const frameScene = resolveDramaFrameScene(project, shot, beat);
    const declared = [frameScene?.id || shot.sceneId, ...shot.characterIds, ...shot.propIds, ...shot.clueIds, ...(shot.sourceAssetIds || [])].filter((id): id is string => Boolean(id));
    const available = beat && sceneIds.size > 1 ? declared.filter((id) => !sceneIds.has(id)) : declared;
    const preferred = manifest.flatMap((item) => (item.assetId && (available.includes(item.assetId) || project.scenes.some((scene) => scene.id === item.assetId)) ? [item.assetId] : []));
    return Array.from(new Set([...preferred, ...available]));
}

function scopedReferenceManifest(project: DramaProject, shot: DramaEpisode["shots"][number], beat?: NonNullable<DramaEpisode["shots"][number]["framePlan"]>["frames"][number]) {
    const manifest = shot.framePlan?.referenceManifest || [];
    if (!beat) return manifest;
    const sceneReferences = manifest.filter((item) => item.role === "scene_anchor" && item.assetId);
    const selected = resolveDramaFrameScene(project, shot, beat)?.id;
    if (!selected) return manifest;
    const selectedReference = sceneReferences.find((item) => item.assetId === selected);
    const selectedManifestItem = selectedReference || { alias: "@场景帧", role: "scene_anchor" as const, purpose: "按当前帧画面恢复的场景基准图", assetId: selected };
    return [...manifest.filter((item) => item.role !== "scene_anchor"), selectedManifestItem];
}

function visualAssets(project: DramaProject, shots: DramaEpisode["shots"]) {
    const ids = new Set(
        shots.flatMap((shot) =>
            shot.framePlan?.manualReferenceImages
                ? []
                : [
                      ...shot.characterIds,
                      ...(shot.sceneId ? [shot.sceneId] : []),
                      ...shot.propIds,
                      ...(shot.framePlan?.referenceManifest || []).flatMap((item) => (item.assetId ? [item.assetId] : [])),
                      ...(shot.framePlan?.frames || []).flatMap((beat) => {
                          const scene = resolveDramaFrameScene(project, shot, beat);
                          return scene ? [scene.id] : [];
                      }),
                  ],
        ),
    );
    return (
        [
            ...project.characters.map((asset) => ({ asset, kind: "characters" as const, label: "角色" as const })),
            ...project.scenes.map((asset) => ({ asset, kind: "scenes" as const, label: "场景" as const })),
            ...project.props.map((asset) => ({ asset, kind: "props" as const, label: "道具" as const })),
        ] satisfies Array<{ asset: DramaNamedAsset; kind: AssetKind; label: "角色" | "场景" | "道具" }>
    ).filter(({ asset }) => ids.has(asset.id));
}

function visualPlanBlockers(project: DramaProject, episode: DramaEpisode, shots: DramaEpisode["shots"]) {
    const blockers: string[] = [];
    if (!shots.length) blockers.push("当前范围还没有可生成的镜头");
    for (const shot of shots) {
        if (!shot.imagePrompt.trim() && !shot.startFramePrompt?.trim()) blockers.push(`${shot.title}缺少画面提示词`);
        if (shot.sceneId && !project.scenes.some((asset) => asset.id === shot.sceneId)) blockers.push(`${shot.title}引用了不存在的场景`);
        if (shot.characterIds.some((id) => !project.characters.some((asset) => asset.id === id))) blockers.push(`${shot.title}引用了不存在的角色`);
        if (shot.propIds.some((id) => !project.props.some((asset) => asset.id === id))) blockers.push(`${shot.title}引用了不存在的道具`);
        if (shot.framePlan?.start.source === "previous_accepted_actual_tail" && !episode.continuityEdges?.some((edge) => edge.toShotId === shot.id && edge.inheritActualEndFrame)) blockers.push(`${shot.title}声明继承实际尾帧，但没有有效的连续性边来源`);
    }
    return Array.from(new Set(blockers));
}
