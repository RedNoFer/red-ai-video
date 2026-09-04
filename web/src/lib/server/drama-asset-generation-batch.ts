import { nanoid } from "nanoid";

import type { DramaAssetGenerationBatch, DramaAssetGenerationBatchItem, DramaNamedAsset, DramaProject } from "@/lib/drama-project-contract";
import { compileDramaAssetReferencePrompt, DRAMA_CHARACTER_TURNAROUND_SIZE } from "@/lib/drama-prompt-compiler";
import { getDramaAssetMissingItems } from "@/lib/drama-asset-completion";
import { createDramaAssetGenerationBatch, getDramaAssetGenerationBatch, listDramaAssetGenerationBatches, updateDramaAssetGenerationBatch } from "@/lib/server/drama-asset-generation-batch-store";
import { getDramaProjectForUser } from "@/lib/server/drama-project-service";
import { approvedAssetReference } from "@/lib/drama-asset-baseline";
import { completeDramaAsset } from "@/lib/server/drama-asset-completion-service";
import { fetchInternalApi } from "@/lib/server/internal-origin";
import { runGenerationTaskRecoveryBatch } from "@/lib/server/generation-task-recovery-service";

export class DramaAssetGenerationBatchError extends Error {
    constructor(
        message: string,
        readonly status = 400,
    ) {
        super(message);
    }
}

type AssetKind = "characters" | "scenes" | "props";
type BatchConfig = Record<string, unknown>;
const activeProcessors = new Set<string>();

function withoutVoiceGeneration(config: BatchConfig): BatchConfig {
    const { generateVoice: _generateVoice, ...safeConfig } = config;
    return safeConfig;
}

export function dramaAssetCompletionRequestId(batchId: string, itemId: string, attempt: number) {
    return `${batchId}:${itemId}:${Math.max(1, attempt)}:completion`;
}

export function isDramaAssetBatchCapacityError(error: string | undefined) {
    const message = error?.trim() || "";
    return message.includes("生图任务已达到并发上限") || message.includes("图片任务已达到并发上限");
}

export async function createDramaAssetGenerationBatchForUser(userId: string, projectId: string, assetIds: Array<{ kind: string; assetId: string }>, executionConfig: BatchConfig = {}) {
    const project = await getDramaProjectForUser(userId, projectId);
    const unique = new Map<string, { kind: AssetKind; asset: DramaNamedAsset }>();
    for (const input of assetIds) {
        if (input.kind !== "characters" && input.kind !== "scenes" && input.kind !== "props") throw new DramaAssetGenerationBatchError("批量生成只支持角色、场景和道具");
        const asset = project[input.kind].find((item) => item.id === input.assetId);
        if (!asset) throw new DramaAssetGenerationBatchError("选择的项目资产不存在", 404);
        unique.set(`${input.kind}:${asset.id}`, { kind: input.kind, asset });
    }
    if (!unique.size) throw new DramaAssetGenerationBatchError("请至少选择一个角色、场景或道具");
    const now = new Date().toISOString();
    const safeExecutionConfig = withoutVoiceGeneration(executionConfig);
    const imageItems: DramaAssetGenerationBatchItem[] = [...unique.values()].map(({ kind, asset }) => ({
        id: `asset-batch-item-${nanoid()}`,
        kind,
        outputType: "reference_image",
        assetId: asset.id,
        assetName: asset.name,
        prompt: compileDramaAssetReferencePrompt(project, asset, kind === "characters" ? "角色" : kind === "scenes" ? "场景" : "道具"),
        status: "queued",
        attempt: 0,
        missingItems: getDramaAssetMissingItems(asset, kind),
        planningStatus: getDramaAssetMissingItems(asset, kind).some((missing) => missing.task === "planning") ? "queued" : "success",
        voiceStatus: "not_applicable",
        referenceStatus: getDramaAssetMissingItems(asset, kind).some((missing) => missing.task === "reference") ? "queued" : "not_applicable",
    }));
    const items = imageItems;
    const batch: DramaAssetGenerationBatch = {
        id: `asset-batch-${nanoid()}`,
        projectId,
        executionConfig: safeExecutionConfig,
        status: "queued",
        totalCount: items.length,
        completedCount: 0,
        successCount: 0,
        failedCount: 0,
        cancelledCount: 0,
        items,
        createdAt: now,
        updatedAt: now,
    };
    return createDramaAssetGenerationBatch(userId, batch);
}

export function compileDramaAssetBatchItemPrompt(project: Pick<DramaProject, "title" | "style" | "ratio" | "productionBible" | "characters" | "scenes" | "props">, item: Pick<DramaAssetGenerationBatchItem, "kind" | "assetId" | "prompt" | "outputType">) {
    const assets = item.kind === "characters" ? project.characters : item.kind === "scenes" ? project.scenes : project.props;
    const asset = assets.find((candidate) => candidate.id === item.assetId);
    if (!asset) throw new DramaAssetGenerationBatchError("批量生成资产不存在", 404);
    return compileDramaAssetReferencePrompt(project, asset, item.kind === "characters" ? "角色" : item.kind === "scenes" ? "场景" : "道具");
}

export async function listDramaAssetGenerationBatchesForUser(userId: string, projectId: string) {
    return listDramaAssetGenerationBatches(userId, projectId);
}

export async function getDramaAssetGenerationBatchForUser(userId: string, projectId: string, batchId: string) {
    const batch = await getDramaAssetGenerationBatch(userId, projectId, batchId);
    if (!batch) throw new DramaAssetGenerationBatchError("批量生成任务不存在", 404);
    return batch;
}

export async function updateDramaAssetGenerationBatchForUser(userId: string, batch: DramaAssetGenerationBatch) {
    const existing = await getDramaAssetGenerationBatchForUser(userId, batch.projectId, batch.id);
    const next = recomputeBatch({ ...existing, ...batch, items: batch.items, updatedAt: new Date().toISOString() });
    const saved = await updateDramaAssetGenerationBatch(userId, next);
    if (!saved) throw new DramaAssetGenerationBatchError("批量生成任务不存在", 404);
    return saved;
}

export function runDramaAssetGenerationBatchInBackground(input: { userId: string; projectId: string; batchId: string; config: BatchConfig; origin: string; cookie: string }) {
    if (activeProcessors.has(input.batchId)) return Promise.resolve();
    activeProcessors.add(input.batchId);
    return processDramaAssetGenerationBatch(input)
        .catch(async (error) => {
            const batch = await getDramaAssetGenerationBatch(input.userId, input.projectId, input.batchId);
            if (!batch) return;
            const message = error instanceof Error ? error.message : "批量生成执行失败";
            await updateDramaAssetGenerationBatchForUser(input.userId, {
                ...batch,
                items: batch.items.map((item) => (item.status === "queued" || item.status === "running" ? { ...item, status: "error", error: message, completedAt: new Date().toISOString() } : item)),
            });
        })
        .finally(() => activeProcessors.delete(input.batchId));
}

async function processDramaAssetGenerationBatch(input: { userId: string; projectId: string; batchId: string; config: BatchConfig; origin: string; cookie: string }) {
    let batch = await getDramaAssetGenerationBatchForUser(input.userId, input.projectId, input.batchId);
    if (!batch || ["completed", "partial_failed", "failed", "cancelled"].includes(batch.status)) return;
    for (const item of batch.items) {
        if (item.status !== "queued" && !(item.status === "running" && !item.generationTaskId)) continue;
        if (item.outputType === "character_voice") {
            batch = await updateDramaAssetGenerationBatchForUser(input.userId, {
                ...batch,
                items: batch.items.map((candidate) => (candidate.id === item.id ? { ...candidate, status: "cancelled" as const, voiceStatus: "not_applicable" as const, completedAt: new Date().toISOString() } : candidate)),
            });
            continue;
        }
        const running = await updateDramaAssetGenerationBatchForUser(input.userId, {
            ...batch,
            items: batch.items.map((candidate) =>
                candidate.id === item.id ? { ...candidate, status: "running", startedAt: candidate.startedAt || new Date().toISOString(), attempt: candidate.status === "queued" ? candidate.attempt + 1 : candidate.attempt } : candidate,
            ),
        });
        batch = running;
        const runningItem = running.items.find((candidate) => candidate.id === item.id) || item;
        const nextItem = await submitBatchItem(input, batch, runningItem, input.config);
        batch = await updateDramaAssetGenerationBatchForUser(input.userId, { ...batch, items: batch.items.map((candidate) => (candidate.id === item.id ? nextItem : candidate)) });
        if (nextItem.status === "queued") break;
    }
}

async function submitBatchItem(input: { userId: string; projectId: string; batchId: string; config: BatchConfig; origin: string; cookie: string }, batch: DramaAssetGenerationBatch, item: DramaAssetGenerationBatchItem, config: BatchConfig) {
    let project = await getDramaProjectForUser(input.userId, input.projectId);
    let planningStatus = item.planningStatus;
    let voiceStatus = item.voiceStatus;
    let planningError: string | undefined;
    let voiceError: string | undefined;
    if (config.completeSettings !== false) {
        try {
            const completion = await completeDramaAsset({
                userId: input.userId,
                projectId: input.projectId,
                kind: item.kind,
                assetId: item.assetId,
                requestId: dramaAssetCompletionRequestId(batch.id, item.id, item.attempt),
                origin: input.origin,
                cookie: input.cookie,
                config: item.kind === "characters" ? { ...config, count: "1", size: DRAMA_CHARACTER_TURNAROUND_SIZE } : config,
                skipReference: true,
                skipVoice: true,
            });
            project = completion.project;
            planningStatus = completion.planning === "success" || completion.planning === "not_needed" ? "success" : planningStatus;
            voiceStatus = completion.voice === "success" || completion.voice === "not_needed" ? (item.kind === "characters" ? "success" : "not_applicable") : completion.voice === "running" ? "running" : voiceStatus;
        } catch (error) {
            planningError = error instanceof Error ? error.message : "设定补全失败";
            voiceError = planningError;
            if (item.missingItems?.some((missing) => missing.task === "planning")) planningStatus = "error";
            if (item.missingItems?.some((missing) => missing.task === "voice")) voiceStatus = "error";
        }
    } else {
        planningStatus = "success";
        voiceStatus = item.kind === "characters" ? "not_applicable" : voiceStatus;
    }

    const asset = project[item.kind].find((candidate) => candidate.id === item.assetId);
    const primary = asset ? approvedAssetReference(asset) : undefined;
    const common = { ...item, planningStatus, voiceStatus, planningError, voiceError };
    if (config.completeMissingOnly === true && primary) return withDramaAssetBatchTerminalStatus(common, "success", { referenceStatus: "primary" as const });
    const references = primary?.url ? [{ id: primary.id, name: primary.label, type: "image/png", dataUrl: primary.url, url: primary.url }] : [];
    try {
        const response = await fetchInternalApi(`${input.origin}/api/image-tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: input.cookie, "X-VOZEB-PRO-Client-Request-Id": `${batch.id}:${item.id}:${item.attempt}` },
            body: JSON.stringify({
                config: item.kind === "characters" ? { ...config, count: "1", size: DRAMA_CHARACTER_TURNAROUND_SIZE } : config,
                prompt: compileDramaAssetBatchItemPrompt(project, item),
                references,
                source: "drama",
                title: `${project.title} · ${item.assetName}批量候选`,
                context: { surface: "drama", projectId: input.projectId, clientRequestId: `${batch.id}:${item.id}:${item.attempt}` },
            }),
        });
        const payload = (await response.json().catch(() => ({}))) as { task?: { id?: string }; error?: string };
        if (!response.ok || !payload.task?.id) {
            const error = payload.error || "图片任务创建失败";
            if (response.status === 429) {
                return { ...common, status: "queued" as const, referenceStatus: "queued" as const, referenceError: undefined, error: undefined, generationTaskId: undefined, completedAt: undefined };
            }
            return { ...common, referenceStatus: "error" as const, referenceError: error, status: "error" as const, error, completedAt: new Date().toISOString() };
        }
        await runGenerationTaskRecoveryBatch({ origin: input.origin, cookie: input.cookie, limit: 1, taskIds: [payload.task.id] }).catch(() => undefined);
        return { ...common, referenceStatus: "running" as const, status: "running" as const, generationTaskId: payload.task.id, startedAt: item.startedAt || new Date().toISOString() };
    } catch (error) {
        const message = error instanceof Error ? error.message : "图片任务创建失败";
        return { ...common, status: "error" as const, error: message, completedAt: new Date().toISOString() };
    }
}

function recomputeBatch(batch: DramaAssetGenerationBatch): DramaAssetGenerationBatch {
    const completed = batch.items.filter((item) => ["success", "error", "cancelled"].includes(item.status));
    const successCount = batch.items.filter((item) => item.status === "success").length;
    const failedCount = batch.items.filter((item) => item.status === "error").length;
    const cancelledCount = batch.items.filter((item) => item.status === "cancelled").length;
    const active = batch.items.find((item) => item.status === "running");
    const status = completed.length < batch.totalCount ? (active ? "running" : "queued") : successCount === batch.totalCount ? "completed" : successCount ? "partial_failed" : cancelledCount === batch.totalCount ? "cancelled" : "failed";
    return { ...batch, status, completedCount: completed.length, successCount, failedCount, cancelledCount, currentItemId: active?.id };
}

export function withDramaAssetBatchTerminalStatus(item: DramaAssetGenerationBatchItem, status: "success" | "error" | "cancelled", patch: Partial<DramaAssetGenerationBatchItem> = {}): DramaAssetGenerationBatchItem {
    const next = { ...item, ...patch, status, completedAt: patch.completedAt || new Date().toISOString() };
    if (status !== "success") return next;
    const stepError = next.planningStatus === "error" ? next.planningError || "设定补全失败" : next.voiceStatus === "error" ? next.voiceError || "音色补全失败" : next.referenceStatus === "error" ? next.referenceError || "基准图生成失败" : "";
    return stepError ? { ...next, status: "error", error: next.error || stepError } : next;
}
