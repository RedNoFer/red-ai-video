import { approvedAssetReference, approvedScenePanoramaReference, hasApprovedAssetReference, hasApprovedScenePanoramaReference } from "@/lib/drama-asset-baseline";
import { appendDramaCharacterVoiceBindings, dramaShotCharacterVoiceReferences } from "@/lib/drama-character-voice-reference";
import type { DramaEpisode, DramaProject, DramaShot, DramaVideoReferenceBinding, DramaVideoReferenceMode } from "@/lib/drama-project-contract";

/** Build the complete editable prompt before confirmation; dispatch sends it unchanged. */
export function compileDramaVideoSubmissionPrompt(prompt: string, project: DramaProject, shot: DramaShot, bindings: DramaVideoReferenceBinding[], assetIds: string[]) {
    const body = prompt
        .replace(/\n*【参考图片】\n(?:@图片\d+：[^\n]*(?:\n|$))*/u, "\n")
        .replace(/\n*【角色音色】[\s\S]*?\n人声：按原台词和表演使用固定音色[^\n]*(?:\n|$)/u, "\n")
        .trimEnd();
    const images = bindings.length ? `【参考图片】\n${bindings.map((binding, index) => `@图片${index + 1}：${binding.purpose}`).join("\n")}` : "";
    return appendDramaCharacterVoiceBindings([body, images].filter(Boolean).join("\n"), dramaShotCharacterVoiceReferences(project, shot, assetIds));
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
