import { after, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    getDramaAssetGenerationBatchForUser,
    DramaAssetGenerationBatchError,
    isDramaAssetBatchCapacityError,
    runDramaAssetGenerationBatchInBackground,
    updateDramaAssetGenerationBatchForUser,
    withDramaAssetBatchTerminalStatus,
} from "@/lib/server/drama-asset-generation-batch";
import { getImageTask } from "@/lib/server/image-task-store";
import { getAudioTask } from "@/lib/server/audio-task-store";
import { cancellationExecutionPatch } from "@/lib/server/generation-task-cancellation-service";
import { transitionAudioTask } from "@/lib/server/audio-task-store";
import { getDramaProjectForUser, updateDramaProjectForUser } from "@/lib/server/drama-project-service";
import { persistDramaGeneratedImageReference } from "@/lib/server/drama-asset-reference-media";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { runGenerationTaskRecoveryBatch } from "@/lib/server/generation-task-recovery-service";

type Context = { params: Promise<{ id: string; batchId: string }> };

export async function GET(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const params = await context.params;
        let batch = await getDramaAssetGenerationBatchForUser(user.id, params.id, params.batchId);
        const legacyVoiceItems = batch.items.filter((item) => item.outputType === "character_voice" && (item.status === "queued" || item.status === "running"));
        if (legacyVoiceItems.length) {
            await Promise.all(
                legacyVoiceItems.map(async (item) => {
                    if (!item.generationTaskId) return;
                    const task = await getAudioTask(item.generationTaskId);
                    if (!task || !["pending", "running"].includes(task.status)) return;
                    await transitionAudioTask(
                        task,
                        ["pending", "running"],
                        { status: "cancelled", error: "批量素材生成不支持音色任务", billing: task.billing },
                        cancellationExecutionPatch({ type: "audio", taskId: task.id, userId: task.userId, executionPhase: task.executionPhase, upstreamTaskId: task.upstream?.id, queryPath: task.config.advancedConfig?.queryPath, config: task.config }),
                    );
                }),
            );
            batch = await updateDramaAssetGenerationBatchForUser(user.id, {
                ...batch,
                items: batch.items.map((item) =>
                    item.outputType === "character_voice" && (item.status === "queued" || item.status === "running")
                        ? { ...item, status: "cancelled" as const, voiceStatus: "not_applicable" as const, error: undefined, voiceError: undefined, completedAt: new Date().toISOString() }
                        : item,
                ),
            });
        }
        const capacityFailures = batch.items.filter((item) => item.outputType === "reference_image" && item.status === "error" && isDramaAssetBatchCapacityError(item.error));
        if (capacityFailures.length) {
            batch = await updateDramaAssetGenerationBatchForUser(user.id, {
                ...batch,
                items: batch.items.map((item) =>
                    item.outputType === "reference_image" && item.status === "error" && isDramaAssetBatchCapacityError(item.error)
                        ? { ...item, status: "queued" as const, error: undefined, referenceError: undefined, completedAt: undefined, generationTaskId: undefined }
                        : item,
                ),
            });
        }
        const origin = resolveInternalOrigin(new URL(request.url).origin);
        const cookie = request.headers.get("cookie") || "";
        if (batch.status === "queued" || batch.status === "running") after(() => runDramaAssetGenerationBatchInBackground({ userId: user.id, projectId: params.id, batchId: batch.id, origin, cookie, config: batch.executionConfig || {} }));
        const activeTaskIds = batch.items.filter((item) => item.status === "running" && item.generationTaskId).map((item) => item.generationTaskId!);
        if (activeTaskIds.length) await runGenerationTaskRecoveryBatch({ origin, cookie, limit: activeTaskIds.length, taskIds: activeTaskIds }).catch(() => undefined);
        let project = await getDramaProjectForUser(user.id, params.id);
        const resolved = await Promise.all(
            batch.items.map(async (item) => {
                const asset = item.outputType === "reference_image" ? project[item.kind].find((candidate) => candidate.id === item.assetId) : undefined;
                const needsReferenceRepair = item.status === "success" && Boolean(item.generationTaskId && item.candidateReferenceId && !asset?.references?.some((reference) => reference.id === item.candidateReferenceId));
                if (!item.generationTaskId || item.status === "error" || item.status === "cancelled" || (item.status === "success" && !needsReferenceRepair)) return { item, task: undefined };
                return { item, task: item.outputType === "character_voice" ? await getAudioTask(item.generationTaskId) : await getImageTask(item.generationTaskId) };
            }),
        );
        const items = [] as typeof batch.items;
        for (const { item, task } of resolved) {
            if (!item.generationTaskId || ["error", "cancelled"].includes(item.status)) {
                items.push(item);
                continue;
            }
            if (item.status === "success" && !task) {
                items.push(item);
                continue;
            }
            if (!task) {
                items.push({ ...item, status: "error", error: item.outputType === "character_voice" ? "试听任务已过期" : "图片任务已过期", completedAt: new Date().toISOString() });
                continue;
            }
            const taskProgress = {
                generationTaskStatus: task.status,
                generationExecutionPhase: task.executionPhase,
                generationLastUpstreamStatus: task.lastUpstreamStatus,
            };
            if (item.outputType === "character_voice") {
                if (task.status === "success") {
                    const asset = project.characters.find((candidate) => candidate.id === item.assetId);
                    const audioResult = task.result as { url?: string } | undefined;
                    if (asset?.voiceProfile)
                        project = await updateDramaProjectForUser(user.id, project.id, {
                            ...project,
                            characters: project.characters.map((candidate) =>
                                candidate.id === asset.id ? { ...candidate, voiceProfile: { ...candidate.voiceProfile!, previewStatus: "success", previewAudioUrl: audioResult?.url, previewError: "" } } : candidate,
                            ),
                        });
                    items.push(withDramaAssetBatchTerminalStatus(item, "success", { ...taskProgress, voiceId: asset?.voiceProfile?.voiceId || item.voiceId }));
                } else if (task.status === "error") items.push({ ...item, ...taskProgress, status: "error", error: task.error || "试听生成失败", completedAt: new Date().toISOString() });
                else if (task.status === "cancelled") items.push({ ...item, ...taskProgress, status: "cancelled", completedAt: new Date().toISOString() });
                else items.push({ ...item, ...taskProgress, status: "running" });
                continue;
            }
            if (task.status === "success") {
                const candidateReferenceId = item.candidateReferenceId || `batch-reference-${item.id}`;
                const asset = project[item.kind].find((candidate) => candidate.id === item.assetId);
                const promoteToPrimary = Boolean(asset && !asset.references?.length);
                const imageResult = task.result as { serverUrl?: string; remoteUrl?: string; dataUrl?: string; width?: number; height?: number } | undefined;
                const storedMedia = imageResult ? await persistDramaGeneratedImageReference(imageResult, { ownerUserId: user.id, projectId: project.id, taskId: item.generationTaskId, originalName: `${item.assetName}.png` }) : null;
                if (!storedMedia) {
                    items.push({ ...item, ...taskProgress, status: "error", referenceStatus: "error", error: "图片任务没有返回可用媒体", referenceError: "图片任务没有返回可用媒体", completedAt: new Date().toISOString() });
                    continue;
                }
                if (asset && storedMedia.url && !asset.references?.some((reference) => reference.id === candidateReferenceId)) {
                    const now = new Date().toISOString();
                    const reference = {
                        id: candidateReferenceId,
                        url: storedMedia.url,
                        remoteUrl: storedMedia.remoteUrl,
                        storageKey: storedMedia.storageKey,
                        source: "generated" as const,
                        label: promoteToPrimary ? `批量基准 · ${item.assetName}` : `批量候选 · ${item.assetName}`,
                        width: imageResult?.width,
                        height: imageResult?.height,
                        createdAt: now,
                        ...(promoteToPrimary ? { status: "approved" as const, reviewStatus: "passed" as const, approvedAt: now } : { status: "candidate" as const, reviewStatus: "pending" as const }),
                        generationTaskId: item.generationTaskId,
                        compiledPrompt: item.prompt,
                        promptVersion: (asset.references || []).reduce((max, reference) => Math.max(max, reference.promptVersion || 0), 0) + 1,
                    };
                    const references = [...(asset.references || []), reference];
                    project = await updateDramaProjectForUser(user.id, project.id, {
                        ...project,
                        [item.kind]: project[item.kind].map((candidate) =>
                            candidate.id === asset.id ? { ...candidate, references, ...(promoteToPrimary ? { primaryReferenceId: candidateReferenceId, referenceImageUrl: storedMedia.url, referenceStorageKey: storedMedia.storageKey } : {}) } : candidate,
                        ),
                    });
                }
                const persistedAsset = project[item.kind].find((candidate) => candidate.id === item.assetId);
                if (!persistedAsset?.references?.some((reference) => reference.id === candidateReferenceId)) {
                    items.push({ ...item, ...taskProgress, status: "running", referenceStatus: "running" });
                    continue;
                }
                items.push(withDramaAssetBatchTerminalStatus(item, "success", { ...taskProgress, referenceStatus: promoteToPrimary ? "primary" : "candidate", candidateReferenceId }));
            } else if (task.status === "error") items.push({ ...item, ...taskProgress, status: "error", error: task.error || "图片生成失败", completedAt: new Date().toISOString() });
            else if (task.status === "cancelled") items.push({ ...item, ...taskProgress, status: "cancelled", completedAt: new Date().toISOString() });
            else items.push({ ...item, ...taskProgress, status: "running" });
        }
        const updated = await updateDramaAssetGenerationBatchForUser(user.id, { ...batch, items });
        return NextResponse.json({ code: 0, data: { batch: updated }, msg: "OK" });
    } catch (error) {
        const status = error instanceof DramaAssetGenerationBatchError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "读取批量进度失败" }, { status });
    }
}
