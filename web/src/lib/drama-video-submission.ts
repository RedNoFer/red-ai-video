import { approvedAssetReference, approvedScenePanoramaReference, hasApprovedAssetReference, hasApprovedScenePanoramaReference } from "@/lib/drama-asset-baseline";
import { appendDramaCharacterVoiceBindings, dramaShotCharacterVoiceReferences, stripDramaCharacterVoiceBindings } from "@/lib/drama-character-voice-reference";
import { appendDramaImageReferenceBindings, stripDramaReferenceBindingSections } from "@/lib/drama-prompt-compiler";
import { continuityStartEvidence } from "@/lib/drama-continuity-policy";
import { selectedDramaShotFrameIds, selectedDramaShotReferenceAssetIds } from "@/lib/drama-video-reference-plan";
import type { DramaEpisode, DramaProject, DramaShot, DramaVideoReferenceBinding, DramaVideoReferenceMode } from "@/lib/drama-project-contract";

import { stripDramaVideoPromptPrefix, withDramaVideoPromptPrefix } from "@/lib/drama-video-prompt-prefix";

/** Build the complete editable prompt before confirmation; dispatch sends it unchanged. */
export function compileDramaVideoSubmissionPrompt(prompt: string, project: DramaProject, shot: DramaShot, bindings: DramaVideoReferenceBinding[], assetIds: string[]) {
    prompt = stripDramaVideoPromptPrefix(prompt, project);
    const previousAliases = new Map(Array.from(prompt.matchAll(/^(@图片\d+)[：:]([^\n]+)$/gmu), (match) => [match[1], match[2].trim()]));
    const aliases = new Map(bindings.map((binding) => [binding.purpose, binding.alias]));
    const body = stripDramaReferenceBindingSections(stripDramaCharacterVoiceBindings(prompt))
        .replace(/@图片\d+/gu, (alias) => {
            const purpose = previousAliases.get(alias);
            return purpose ? aliases.get(purpose) || purpose : alias;
        })
        .trim();
    const withReferences = appendDramaImageReferenceBindings(
        body,
        bindings.map((binding, index) => ({ id: binding.sourceId || binding.frameId || `reference-${index}`, label: binding.purpose, isCharacter: binding.role === "character_anchor" })),
    );
    return withDramaVideoPromptPrefix(appendDramaCharacterVoiceBindings(withReferences, dramaShotCharacterVoiceReferences(project, shot, assetIds)), project);
}

export function buildDramaShotVideoReferenceBindings(project: DramaProject, episode: DramaEpisode, shot: DramaShot, referenceIds: string[], mode: DramaVideoReferenceMode = "reference") {
    const selections = { [shot.id]: referenceIds };
    const frames = selectedDramaShotFrameIds(shot, mode, selections).flatMap((id) => {
        const frame = shot.storyboardFrames?.find((item) => item.id === id);
        return frame?.mediaUrl && frame.status === "success" ? [{ mediaUrl: frame.mediaUrl, remoteUrl: frame.remoteUrl, frameId: id }] : [];
    });
    const incoming = episode.continuityEdges?.find((edge) => edge.toShotId === shot.id && edge.inheritActualEndFrame);
    const previous = incoming && referenceIds.includes(`tail-${incoming.fromShotId}`) ? episode.shots.find((item) => item.id === incoming.fromShotId) : undefined;
    const tail = previous ? continuityStartEvidence(previous) : undefined;
    return buildVideoReferenceBindings(project, shot, tail ? [{ mediaUrl: tail.mediaUrl, remoteUrl: tail.remoteUrl }, ...frames] : frames, selectedDramaShotReferenceAssetIds(project, shot, selections), previous?.id, mode);
}

export function buildVideoReferenceBindings(
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
        if (project.scenes.some((asset) => asset.id === assetId)) return "scene_anchor";
        if (project.characters.some((asset) => asset.id === assetId)) return "character_anchor";
        return "prop_anchor";
    };
    const hasPreviousTail = Boolean(previousShotId && frames[0] && !frames[0].frameId);
    const frameCandidates: Array<Omit<DramaVideoReferenceBinding, "alias">> = frames.map((frame, index) => {
        const isPreviousTail = index === 0 && Boolean(previousShotId) && !frame.frameId;
        const role: DramaVideoReferenceBinding["role"] = isPreviousTail ? "first_frame" : referenceMode === "all_frames" ? "keyframe" : "reference";
        const assignedKeyframeIndex = role === "keyframe" ? index + 1 - (hasPreviousTail ? 1 : 0) : undefined;
        return {
            role,
            purpose: isPreviousTail ? "上一镜当前视频版本的已人工验收实际尾帧" : referenceMode === "all_frames" ? `顺序帧 ${assignedKeyframeIndex}` : "可选细节参考图",
            shotId: isPreviousTail ? previousShotId : shot.id,
            frameId: frame.frameId,
            url: frame.mediaUrl,
            remoteUrl: frame.remoteUrl,
            ...(assignedKeyframeIndex ? { keyframeIndex: assignedKeyframeIndex } : {}),
        };
    });
    const assetCandidates: Array<Omit<DramaVideoReferenceBinding, "alias"> & { assetId: string }> = [];
    for (const assetId of assetIds) {
        const asset = [...project.characters, ...project.scenes, ...project.props, ...project.clues].find((item) => item.id === assetId);
        const source = project.sourceAssets?.find((item) => item.id === assetId && item.type === "image");
        const isScene = project.scenes.some((asset) => asset.id === assetId);
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
        if (reference?.url) {
            const kind = isScene ? "场景" : project.characters.some((item) => item.id === assetId) ? "角色" : project.clues.some((item) => item.id === assetId) ? "线索" : source ? "来源素材" : "道具";
            assetCandidates.push({ assetId, role: roleFor(assetId), purpose: `${kind}「${asset?.name || source?.title}」`, sourceId: assetId, url: reference.url, remoteUrl: reference.remoteUrl });
        }
    }
    if (!manifest.length) {
        return [...frameCandidates.map((candidate, index) => ({ alias: `@图片${index + 1}`, ...candidate })), ...assetCandidates.map((candidate, index) => ({ alias: `@图片${frameCandidates.length + index + 1}`, ...candidate }))];
    }

    const usedFrames = new Set<number>();
    const usedAssets = new Set<string>();
    let keyframeIndex = 0;
    const bindings: DramaVideoReferenceBinding[] = [];
    for (const item of manifest) {
        if (item.assetId && !assetIds.includes(item.assetId)) continue;
        if (referenceMode === "reference" && item.frameEvidenceId && !frameCandidates.some((frame) => frame.frameId === item.frameEvidenceId)) continue;
        let candidate: Omit<DramaVideoReferenceBinding, "alias"> | undefined;
        let frameIndex = -1;
        if (item.role === "previous_actual_tail") {
            frameIndex = frameCandidates.findIndex((frame, index) => index === 0 && frame.role === "first_frame");
        } else if (item.frameEvidenceId) {
            frameIndex = frameCandidates.findIndex((frame) => frame.frameId === item.frameEvidenceId);
        } else if (item.assetId) {
            const asset = assetCandidates.find((entry) => entry.assetId === item.assetId && !usedAssets.has(entry.assetId));
            if (asset) {
                candidate = asset;
                usedAssets.add(asset.assetId);
            }
        } else if (item.role === "action_keyframe" || item.role === "composition_keyframe") {
            frameIndex = frameCandidates.findIndex((_, index) => !usedFrames.has(index));
        }
        if (frameIndex >= 0) {
            if (usedFrames.has(frameIndex)) continue;
            usedFrames.add(frameIndex);
            candidate = frameCandidates[frameIndex];
        }
        if (!candidate) continue;
        const role: DramaVideoReferenceBinding["role"] = item.role === "previous_actual_tail" ? "first_frame" : item.role === "action_keyframe" || item.role === "composition_keyframe" ? "keyframe" : item.role;
        if (role === "keyframe") keyframeIndex += 1;
        bindings.push({ alias: item.alias, ...candidate, role, purpose: item.assetId ? candidate.purpose : item.purpose || candidate.purpose, ...(role === "keyframe" ? { keyframeIndex } : {}) });
    }

    for (const [index, candidate] of frameCandidates.entries()) {
        if (usedFrames.has(index)) continue;
        bindings.push({ alias: "", ...candidate });
    }
    for (const candidate of assetCandidates) {
        if (usedAssets.has(candidate.assetId)) continue;
        bindings.push({ alias: "", ...candidate });
    }
    return bindings.map((binding, index) => ({ ...binding, alias: `@图片${index + 1}` }));
}

function assetReference(asset: NonNullable<DramaProject["characters"]>[number], scene = false) {
    const reference = scene ? approvedScenePanoramaReference(asset) : approvedAssetReference(asset);
    return reference ? { url: reference.url, remoteUrl: reference.remoteUrl } : undefined;
}
