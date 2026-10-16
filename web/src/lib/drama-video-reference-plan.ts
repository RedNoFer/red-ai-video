import { approvedAssetReference, approvedScenePanoramaReference } from "@/lib/drama-asset-baseline";
import type { DramaProject, DramaShot, DramaVideoReferenceMode } from "@/lib/drama-project-contract";

export function resolveDramaVideoReferenceMode(value: unknown): DramaVideoReferenceMode {
    return value === "all_frames" ? "all_frames" : "reference";
}

export function dramaProjectFixedReferenceAssets(project: DramaProject) {
    return (
        [
            ["scenes", "场景"],
            ["characters", "角色"],
            ["props", "道具"],
            ["clues", "线索"],
        ] as const
    ).flatMap(([kind, label]) => (project[kind] || []).map((asset) => ({ id: asset.id, kind, asset, label: `${label} · ${asset.name}`, reference: kind === "scenes" ? approvedScenePanoramaReference(asset) : approvedAssetReference(asset) })));
}

export function missingDramaShotFixedReferences(project: DramaProject, shot: DramaShot) {
    const ids = new Set([shot.sceneId, ...shot.characterIds, ...shot.propIds, ...shot.clueIds, ...(shot.framePlan?.referenceManifest || []).map((item) => item.assetId)]);
    return dramaProjectFixedReferenceAssets(project).filter((item) => ids.has(item.id) && !item.reference);
}

export function dramaShotReferenceAssetIds(project: DramaProject, shot: DramaShot) {
    const declared = [shot.sceneId, ...shot.characterIds, ...shot.propIds, ...shot.clueIds, ...(shot.sourceAssetIds || [])].filter((id): id is string => Boolean(id));
    return declared.filter((id) => Boolean(readableShotReference(project, shot, id)));
}

export function defaultDramaShotReferenceAssetIds(project: DramaProject, shot: DramaShot) {
    const fixedIds = new Set(dramaProjectFixedReferenceAssets(project).map((item) => item.id));
    return dramaShotReferenceAssetIds(project, shot).filter((id) => fixedIds.has(id));
}

export function selectedDramaShotReferenceAssetIds(project: DramaProject, shot: DramaShot, selections?: Record<string, string[]>) {
    const available = [
        ...dramaProjectFixedReferenceAssets(project)
            .filter((item) => item.reference)
            .map((item) => item.id),
        ...dramaShotReferenceAssetIds(project, shot),
    ];
    const selected = selections?.[shot.id] ?? shot.videoReferenceIds;
    if (!selected) return defaultDramaShotReferenceAssetIds(project, shot);
    const availableIds = new Set(available);
    return selected.filter((id, index, ids) => availableIds.has(id) && ids.indexOf(id) === index);
}

export function selectedDramaShotFrameIds(shot: DramaShot, mode: DramaVideoReferenceMode, selections?: Record<string, string[]>) {
    const frameIds = (shot.framePlan?.frames || []).map((frame) => frame.id);
    const selected = selections?.[shot.id] ?? shot.videoReferenceIds;
    if (mode === "all_frames" && !selected) return frameIds;
    if (!selected) return [];
    const selectedIds = new Set(selected);
    return frameIds.filter((id) => selectedIds.has(id));
}

export function dramaShotReferenceSelectionIds(project: DramaProject, shot: DramaShot, mode: DramaVideoReferenceMode, selections?: Record<string, string[]>) {
    return [...selectedDramaShotReferenceAssetIds(project, shot, selections), ...selectedDramaShotFrameIds(shot, mode, selections)];
}

export function readableShotReference(project: DramaProject, _shot: DramaShot, id: string) {
    const source = project.sourceAssets?.find((asset) => asset.id === id);
    if (source) return source.type === "image" && (source.serverUrl || source.remoteUrl) ? { url: source.serverUrl || source.remoteUrl, remoteUrl: source.remoteUrl } : undefined;
    const asset = [...(project.characters || []), ...(project.scenes || []), ...(project.props || []), ...(project.clues || [])].find((item) => item.id === id);
    if (!asset) return undefined;
    const reference = project.scenes.some((scene) => scene.id === id) ? approvedScenePanoramaReference(asset) : approvedAssetReference(asset);
    return reference?.url ? { url: reference.url, remoteUrl: reference.remoteUrl } : undefined;
}
