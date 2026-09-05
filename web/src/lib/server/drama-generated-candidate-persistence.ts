import type { DramaAssetReference, DramaProject } from "@/lib/drama-project-contract";
import { getDramaProjectForUser, updateDramaProjectForUser } from "@/lib/server/drama-project-service";
import { persistDramaGeneratedImageReference } from "@/lib/server/drama-asset-reference-media";

type GeneratedResult = {
    serverUrl?: string;
    remoteUrl?: string;
    dataUrl?: string;
    width?: number;
    height?: number;
};

type CandidatePersistenceInput = {
    ownerUserId: string;
    projectId: string;
    assetKind?: "characters" | "scenes" | "props";
    assetId: string;
    taskId: string;
    prompt: string;
    generationStage?: DramaAssetReference["generationStage"];
    results: GeneratedResult[];
};

export async function persistDramaGeneratedCandidates(input: CandidatePersistenceInput) {
    const project = await getDramaProjectForUser(input.ownerUserId, input.projectId);
    const assetKind = input.assetKind || (["characters", "scenes", "props"] as const).find((kind) => project[kind].some((item) => item.id === input.assetId));
    if (!assetKind) return 0;
    const asset = project[assetKind].find((item) => item.id === input.assetId);
    if (!asset) return 0;
    const existing = asset.references || [];
    const promoteFirst = existing.length === 0;
    const promptVersion = existing.reduce((max, reference) => Math.max(max, reference.promptVersion || 0), 0);
    const additions: DramaAssetReference[] = [];
    for (const [index, result] of input.results.entries()) {
        const id = `reference-${input.taskId}-${index}`;
        if (existing.some((reference) => reference.id === id || reference.generationTaskId === input.taskId)) continue;
        const stored = await persistDramaGeneratedImageReference(result, {
            ownerUserId: input.ownerUserId,
            projectId: input.projectId,
            taskId: input.taskId,
            originalName: `${asset.name}.png`,
        });
        if (!stored) continue;
        const promoted = promoteFirst && index === 0;
        const createdAt = new Date().toISOString();
        additions.push({
            id,
            url: stored.url,
            remoteUrl: stored.remoteUrl,
            storageKey: stored.storageKey,
            source: "generated",
            label: promoted ? `AI 基准图 · ${asset.name}` : input.results.length > 1 ? `AI 候选图 ${index + 1}` : "AI 候选图",
            width: result.width,
            height: result.height,
            createdAt,
            ...(promoted ? { status: "approved" as const, approvedAt: createdAt, version: 1 } : { status: "candidate" as const }),
            reviewStatus: "pending",
            generationTaskId: input.taskId,
            generationStage: input.generationStage || "initial",
            compiledPrompt: input.prompt,
            promptVersion: promptVersion + additions.length + 1,
        });
    }
    if (!additions.length) return 0;
    const nextProject: DramaProject = {
        ...project,
        [assetKind]: project[assetKind].map((item) =>
            item.id === input.assetId
                ? {
                      ...item,
                      references: [...(item.references || []), ...additions],
                      ...(promoteFirst && additions[0] ? { primaryReferenceId: additions[0].id, referenceImageUrl: additions[0].url, referenceStorageKey: additions[0].storageKey } : {}),
                  }
                : item,
        ),
    };
    await updateDramaProjectForUser(input.ownerUserId, input.projectId, { ...nextProject, updatedAt: undefined });
    return additions.length;
}
