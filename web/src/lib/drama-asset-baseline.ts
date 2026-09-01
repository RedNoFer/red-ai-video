import type { DramaAssetReference, DramaNamedAsset } from "./drama-project-contract";

export function approvedAssetReference(asset?: DramaNamedAsset): DramaAssetReference | undefined {
    if (!asset?.primaryReferenceId) return undefined;
    const reference = asset.references?.find((item) => item.id === asset.primaryReferenceId);
    return reference?.status === "approved" && reference.url ? reference : undefined;
}

export function hasApprovedAssetReference(asset?: DramaNamedAsset): boolean {
    return Boolean(approvedAssetReference(asset));
}

export function assetReferenceStatus(reference?: DramaAssetReference): "candidate" | "approved" | "rejected" | "missing" {
    return reference?.status || "candidate";
}
