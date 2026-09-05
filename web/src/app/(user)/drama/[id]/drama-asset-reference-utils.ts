import { nanoid } from "nanoid";

import type { DramaAssetReference, DramaAssetRefinementProposal, DramaNamedAsset } from "@/lib/drama-project-contract";
import type { ImageGenerationResult } from "@/services/api/image";

export function dramaAssetReferences(item: DramaNamedAsset): DramaAssetReference[] {
    const references = item.references?.length
        ? item.references
        : item.referenceImageUrl
          ? [
                {
                    id: `${item.id}-reference-legacy`,
                    url: item.referenceImageUrl,
                    storageKey: item.referenceStorageKey,
                    source: "library" as const,
                    label: "原参考图",
                    createdAt: new Date(0).toISOString(),
                },
            ]
          : [];
    return ensureUniqueDramaAssetReferenceIds(references);
}

/** Keep malformed historical snapshots from producing duplicate React keys. */
export function ensureUniqueDramaAssetReferenceIds(references: DramaAssetReference[]): DramaAssetReference[] {
    const used = new Set<string>();
    return references.map((reference, index) => {
        const base = reference.id.trim() || `reference-${index + 1}`;
        let id = base;
        let suffix = 2;
        while (used.has(id)) id = `${base}-${suffix++}`;
        used.add(id);
        return id === reference.id ? reference : { ...reference, id };
    });
}

/** Merge client-side review metadata without demoting a server-promoted baseline. */
export function mergeGeneratedReferenceReviews(existing: DramaAssetReference[], reviewed: DramaAssetReference[]): DramaAssetReference[] {
    const reviewedIds = new Set(reviewed.map((reference) => reference.id));
    const merged = reviewed.map((reference) => {
        const persisted = existing.find((candidate) => candidate.id === reference.id);
        return persisted?.status === "approved" ? { ...persisted, ...reference, status: "approved" as const, approvedAt: persisted.approvedAt, version: persisted.version } : { ...persisted, ...reference };
    });
    return ensureUniqueDramaAssetReferenceIds([...existing.filter((reference) => !reviewedIds.has(reference.id)), ...merged]);
}

export function imageResultsToReferences(
    result: ImageGenerationResult & { results?: ImageGenerationResult[] },
    metadata: {
        promptVersion?: number;
        compiledPrompt?: string;
        promptChanges?: DramaAssetRefinementProposal["changes"];
        refinement?: DramaAssetRefinementProposal;
        logicalModelId?: string;
        generationTaskId?: string;
        generationStage?: DramaAssetReference["generationStage"];
        reviewStatus?: DramaAssetReference["reviewStatus"];
    } = {},
): DramaAssetReference[] {
    const images = result.results?.length ? result.results : [result];
    const createdAt = new Date().toISOString();
    return images.flatMap((image, index) => {
        const url = [image.serverUrl, image.remoteUrl, image.dataUrl].find((value) => /^\/api\/(?:reference-assets|generation-log-assets)\//.test((value || "").trim())) || "";
        return url
            ? [
                  {
                      id: metadata.generationTaskId ? `reference-${metadata.generationTaskId}-${index}` : `reference-${nanoid()}`,
                      url,
                      remoteUrl: /^https?:\/\//i.test((image.remoteUrl || "").trim()) ? image.remoteUrl : undefined,
                      source: "generated" as const,
                      label: images.length > 1 ? `AI 候选图 ${index + 1}` : "AI 候选图",
                      width: image.width,
                      height: image.height,
                      createdAt,
                      ...metadata,
                  },
              ]
            : [];
    });
}
