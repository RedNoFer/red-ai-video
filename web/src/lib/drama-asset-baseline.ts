import type { DramaAssetReference, DramaNamedAsset } from "./drama-project-contract";

export function approvedAssetReference(asset?: DramaNamedAsset): DramaAssetReference | undefined {
    if (!asset?.primaryReferenceId) return undefined;
    const reference = asset.references?.find((item) => item.id === asset.primaryReferenceId);
    return reference?.status === "approved" && reference.url ? reference : undefined;
}

export function hasApprovedAssetReference(asset?: DramaNamedAsset): boolean {
    return Boolean(approvedAssetReference(asset));
}

/**
 * A normal panorama prompt contains negative rules such as “不生成九宫格”.
 * Those rules must not turn the asset into a legacy board just because the
 * forbidden layout is mentioned in the prompt.
 */
export function isLegacySceneReferenceBoard(asset?: DramaNamedAsset): boolean {
    if (asset?.sceneReferenceBoard?.layout !== "legacy-3x3") return false;
    const primary = approvedAssetReference(asset);
    const source = [asset.supplierPrompt, primary?.compiledPrompt, primary?.label, asset.description, asset.profile?.visualIdentity, asset.profile?.designPrompt, asset.profile?.consistencyRules].filter(Boolean).join("\n");
    // 负面约束常按长清单枚举多个禁项后才出现「九宫格」，窗口过短会把「不得加入…九宫格」误判成九宫格要求。
    const withoutNegativeRules = source.replace(/(?:不生成|禁止(?:生成)?|不要|不得|无|避免)[^。；;\n]{0,64}(?:九宫格|九格|3\s*[x×*]\s*3|三列[\s\S]*三行|3列[\s\S]*3行)/gu, "");
    if (/九宫格|九格|3\s*[x×*]\s*3|三列[\s\S]*三行|3列[\s\S]*3行/u.test(withoutNegativeRules)) return true;
    // 「单张全景」「全景空镜」与「单视角全景」同义，都是全景契约的明确证据。
    return !/(?:单视角(?:场景)?全景|单张(?:场景)?全景|全景(?:建立图|空镜))/u.test(withoutNegativeRules);
}

export function approvedScenePanoramaReference(asset?: DramaNamedAsset): DramaAssetReference | undefined {
    if (asset?.sceneReferenceBoard?.layout === "legacy-3x3" && isLegacySceneReferenceBoard(asset)) return undefined;
    if (asset?.sceneReferenceBoard?.layout !== "panorama" && !asset?.sceneReferenceBoard?.layout) return undefined;
    return approvedAssetReference(asset);
}

export function hasApprovedScenePanoramaReference(asset?: DramaNamedAsset): boolean {
    return Boolean(approvedScenePanoramaReference(asset));
}

export function assetReferenceStatus(reference?: DramaAssetReference): "candidate" | "approved" | "rejected" | "missing" {
    return reference?.status || "candidate";
}
