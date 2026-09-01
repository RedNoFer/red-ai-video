import { describe, expect, it, vi } from "vitest";

import type { DramaAssetGenerationBatch } from "@/lib/drama-project-contract";
import {
    compileDramaAssetBatchItemPrompt,
    createDramaAssetGenerationBatchForUser,
    dramaAssetCompletionRequestId,
    isDramaAssetBatchCapacityError,
    runDramaAssetGenerationBatchInBackground,
    withDramaAssetBatchTerminalStatus,
} from "./drama-asset-generation-batch";

const getBatch = vi.hoisted(() => vi.fn());
const updateBatch = vi.hoisted(() => vi.fn());
const fetchInternalApi = vi.hoisted(() => vi.fn());
const runRecovery = vi.hoisted(() => vi.fn());

vi.mock("./drama-project-service", () => ({
    getDramaProjectForUser: vi.fn().mockResolvedValue({
        id: "project-one",
        title: "短剧",
        style: "电影感",
        ratio: "9:16",
        characters: [{ id: "rifa", name: "Rifa", description: "女主角", profile: { visualIdentity: "固定五官", styling: "原创服装", colorPalette: "深色", consistencyRules: "固定年龄" } }],
        scenes: [{ id: "scene-one", name: "雪原", description: "雪原", profile: { visualIdentity: "高山", styling: "冰雪材质", colorPalette: "冷色", consistencyRules: "入口固定" } }],
        props: [],
        clues: [],
        episodes: [{ shots: [{ utterances: [{ id: "line-one", order: 1, type: "dialogue", speaker: "Rifa", text: "我们走。" }] }] }],
    }),
}));
vi.mock("./drama-asset-generation-batch-store", () => ({
    createDramaAssetGenerationBatch: async (_userId: string, batch: unknown) => batch,
    getDramaAssetGenerationBatch: getBatch,
    updateDramaAssetGenerationBatch: updateBatch,
}));
vi.mock("./internal-origin", () => ({ fetchInternalApi }));
vi.mock("./drama-asset-completion-service", () => ({ completeDramaAsset: vi.fn() }));
vi.mock("./generation-task-recovery-service", () => ({ runGenerationTaskRecoveryBatch: runRecovery }));

describe("drama asset generation batches", () => {
    it("uses a new billing identity for each explicit retry attempt", () => {
        expect(dramaAssetCompletionRequestId("batch-one", "item-one", 1)).not.toBe(dramaAssetCompletionRequestId("batch-one", "item-one", 2));
    });

    it("recognizes image concurrency admission failures as retryable capacity errors", () => {
        expect(isDramaAssetBatchCapacityError("当前用户生图任务已达到并发上限，请稍后再试")).toBe(true);
        expect(isDramaAssetBatchCapacityError("上游图片生成失败")).toBe(false);
    });

    it("deduplicates selected characters and scenes while rejecting unsupported assets", async () => {
        const batch = await createDramaAssetGenerationBatchForUser("user-one", "project-one", [
            { kind: "characters", assetId: "rifa" },
            { kind: "characters", assetId: "rifa" },
            { kind: "scenes", assetId: "scene-one" },
        ]);
        expect(batch.totalCount).toBe(2);
        expect(batch.items.map((item) => `${item.kind}:${item.assetId}`)).toEqual(["characters:rifa", "scenes:scene-one"]);
        expect(batch.items.every((item) => item.status === "queued" && item.attempt === 0)).toBe(true);
    });

    it("never enqueues character voice tasks, even when a legacy caller requests them", async () => {
        const imageOnly = await createDramaAssetGenerationBatchForUser("user-one", "project-one", [{ kind: "characters", assetId: "rifa" }]);
        expect(imageOnly.items.map((item) => item.outputType)).toEqual(["reference_image"]);

        const withVoice = await createDramaAssetGenerationBatchForUser("user-one", "project-one", [{ kind: "characters", assetId: "rifa" }], { generateVoice: true });
        expect(withVoice.items.map((item) => item.outputType)).toEqual(["reference_image"]);
        expect(withVoice.executionConfig?.generateVoice).toBeUndefined();
    });

    it("rejects clues from the batch surface", async () => {
        await expect(createDramaAssetGenerationBatchForUser("user-one", "project-one", [{ kind: "clues", assetId: "clue-one" }])).rejects.toMatchObject({ status: 400 });
    });

    it("keeps a failed completion failed even when later media success exists", () => {
        const item = withDramaAssetBatchTerminalStatus(
            {
                id: "item-one",
                kind: "characters",
                outputType: "reference_image",
                assetId: "rifa",
                assetName: "Rifa",
                prompt: "prompt",
                status: "success",
                attempt: 1,
                planningStatus: "error",
                planningError: "模型没有返回所需的结构化结果",
                referenceStatus: "candidate",
            },
            "success",
            { referenceStatus: "candidate" },
        );

        expect(item.status).toBe("error");
        expect(item.error).toBe("模型没有返回所需的结构化结果");
    });

    it("recompiles a queued scene or prop item against the current project style", () => {
        const project = {
            id: "project-one",
            title: "短剧",
            style: "暗黑学院史诗奇幻",
            ratio: "9:16",
            scenes: [{ id: "scene-one", name: "雪原", description: "雪原", profile: { visualIdentity: "高山", styling: "冰雪材质", colorPalette: "冷色", consistencyRules: "入口固定" } }],
            characters: [],
            props: [],
            clues: [],
            episodes: [],
        } as never;
        const prompt = compileDramaAssetBatchItemPrompt(project, { kind: "scenes", assetId: "scene-one", outputType: "reference_image", prompt: "旧版 VS14，中性浅灰背景" });

        expect(prompt).toContain("最终风格锁定：半写实动漫幻想风");
        expect(prompt).not.toContain("VS14");
        expect(prompt).not.toContain("中性浅灰背景");
    });

    it("keeps image items queued when the image concurrency limit is full", async () => {
        let current: DramaAssetGenerationBatch = {
            id: "batch-one",
            projectId: "project-one",
            status: "queued" as const,
            executionConfig: { completeSettings: false },
            totalCount: 1,
            completedCount: 0,
            successCount: 0,
            failedCount: 0,
            cancelledCount: 0,
            items: [{ id: "item-one", kind: "characters" as const, outputType: "reference_image" as const, assetId: "rifa", assetName: "Rifa", prompt: "prompt", status: "queued" as const, attempt: 0, referenceStatus: "queued" as const }],
            createdAt: "2026-08-27T00:00:00.000Z",
            updatedAt: "2026-08-27T00:00:00.000Z",
        };
        getBatch.mockImplementation(async () => current);
        updateBatch.mockImplementation(async (_userId: string, next: typeof current) => {
            current = next;
            return current;
        });
        fetchInternalApi.mockResolvedValue({ status: 429, ok: false, json: async () => ({ error: "当前用户生图任务已达到并发上限" }) });

        runDramaAssetGenerationBatchInBackground({ userId: "user-one", projectId: "project-one", batchId: "batch-one", config: current.executionConfig || {}, origin: "http://localhost:3000", cookie: "" });
        await vi.waitFor(() => expect(fetchInternalApi).toHaveBeenCalled());

        expect(current.items[0].referenceStatus).toBe("queued");
        expect(current.items[0].error).toBeUndefined();
        expect(current.failedCount).toBe(0);
    });

    it("starts image-task recovery before reporting an item as running", async () => {
        let current: DramaAssetGenerationBatch = {
            id: "batch-recovery",
            projectId: "project-one",
            status: "queued",
            executionConfig: { completeSettings: false },
            totalCount: 1,
            completedCount: 0,
            successCount: 0,
            failedCount: 0,
            cancelledCount: 0,
            items: [{ id: "item-recovery", kind: "characters", outputType: "reference_image", assetId: "rifa", assetName: "Rifa", prompt: "prompt", status: "queued", attempt: 0, referenceStatus: "queued" }],
            createdAt: "2026-08-27T00:00:00.000Z",
            updatedAt: "2026-08-27T00:00:00.000Z",
        };
        getBatch.mockImplementation(async () => current);
        updateBatch.mockImplementation(async (_userId: string, next: typeof current) => {
            current = next;
            return current;
        });
        fetchInternalApi.mockResolvedValue({ status: 200, ok: true, json: async () => ({ task: { id: "image-task-one" } }) });
        runRecovery.mockResolvedValue({ claimed: 1, completed: 0, failed: 0, deferred: 1, needsReview: 0 });

        await runDramaAssetGenerationBatchInBackground({ userId: "user-one", projectId: "project-one", batchId: "batch-recovery", config: current.executionConfig || {}, origin: "http://localhost:3000", cookie: "session=one" });

        expect(runRecovery).toHaveBeenCalledWith({ origin: "http://localhost:3000", cookie: "session=one", limit: 1, taskIds: ["image-task-one"] });
        expect(current.items[0]).toMatchObject({ status: "running", generationTaskId: "image-task-one" });
    });
});
