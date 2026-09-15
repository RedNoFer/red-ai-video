import { approvedAssetReference, approvedScenePanoramaReference } from "@/lib/drama-asset-baseline";
import type { DramaProject, DramaShot, DramaVideoReferenceMode } from "@/lib/drama-project-contract";

export function resolveDramaVideoReferenceMode(value: unknown): DramaVideoReferenceMode {
    return value === "all_frames" ? "all_frames" : "reference";
}

export function dramaShotReferenceAssetIds(project: DramaProject, shot: DramaShot) {
    const declared = [shot.sceneId, ...shot.characterIds, ...shot.propIds, ...shot.clueIds, ...(shot.sourceAssetIds || [])].filter((id): id is string => Boolean(id));
    return declared.filter((id) => Boolean(readableShotReference(project, shot, id)));
}

export function defaultDramaShotReferenceAssetIds(project: DramaProject, shot: DramaShot) {
    const available = new Set(dramaShotReferenceAssetIds(project, shot));
    return [shot.sceneId, ...shot.characterIds].filter((id): id is string => Boolean(id && available.has(id)));
}

export function selectedDramaShotReferenceAssetIds(project: DramaProject, shot: DramaShot, selections?: Record<string, string[]>) {
    const available = dramaShotReferenceAssetIds(project, shot);
    const selected = selections?.[shot.id];
    if (!selected) return defaultDramaShotReferenceAssetIds(project, shot);
    const availableIds = new Set(available);
    return selected.filter((id, index, ids) => availableIds.has(id) && ids.indexOf(id) === index);
}

export function selectedDramaShotFrameIds(shot: DramaShot, mode: DramaVideoReferenceMode, selections?: Record<string, string[]>) {
    const frameIds = (shot.framePlan?.frames || []).map((frame) => frame.id);
    if (mode === "all_frames") return frameIds;
    const selected = selections?.[shot.id];
    if (!selected) return [];
    const selectedIds = new Set(selected);
    return frameIds.filter((id) => selectedIds.has(id));
}

export function dramaShotReferenceSelectionIds(project: DramaProject, shot: DramaShot, mode: DramaVideoReferenceMode, selections?: Record<string, string[]>) {
    return [...selectedDramaShotReferenceAssetIds(project, shot, selections), ...selectedDramaShotFrameIds(shot, mode, selections)];
}

export function readableShotReference(project: DramaProject, shot: DramaShot, id: string) {
    const source = project.sourceAssets?.find((asset) => asset.id === id);
    if (source) return source.type === "image" && (source.serverUrl || source.remoteUrl) ? { url: source.serverUrl || source.remoteUrl, remoteUrl: source.remoteUrl } : undefined;
    const asset = [...(project.characters || []), ...(project.scenes || []), ...(project.props || []), ...(project.clues || [])].find((item) => item.id === id);
    if (!asset) return undefined;
    const reference = id === shot.sceneId ? approvedScenePanoramaReference(asset) : approvedAssetReference(asset);
    return reference?.url ? { url: reference.url, remoteUrl: reference.remoteUrl } : undefined;
}
