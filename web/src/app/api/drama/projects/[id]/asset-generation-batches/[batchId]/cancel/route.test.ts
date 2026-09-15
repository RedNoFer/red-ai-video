import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getBatch: vi.fn(),
    updateBatch: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
    getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/server/drama-asset-generation-batch", () => ({
    DramaAssetGenerationBatchError: class DramaAssetGenerationBatchError extends Error {},
    getDramaAssetGenerationBatchForUser: mocks.getBatch,
    updateDramaAssetGenerationBatchForUser: mocks.updateBatch,
}));

import { POST } from "./route";

const createBatch = (item: Record<string, unknown>) => ({
    id: "batch-one",
    projectId: "project-one",
    status: "running",
    totalCount: 1,
    completedCount: 0,
    successCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    items: [
        {
            id: "item-one",
            kind: "prop",
            outputType: "reference_image",
            assetId: "asset-one",
            assetName: "毛笔",
            status: "running",
            attempt: 1,
            referenceStatus: "queued",
            ...item,
        },
    ],
});

describe("POST /asset-generation-batches/:batchId/cancel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", mocks.fetch);
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.fetch.mockResolvedValue(new Response(null, { status: 200 }));
        mocks.updateBatch.mockImplementation(async (_userId: string, nextBatch) => ({
            ...nextBatch,
            status: "cancelled",
            completedCount: 1,
            cancelledCount: 1,
        }));
    });

    it("cancels a running item before its generation task id is attached", async () => {
        mocks.getBatch.mockResolvedValue(
            createBatch({
                generationTaskId: undefined,
            }),
        );

        const response = await POST(
            new Request("http://localhost/api/drama/projects/project-one/asset-generation-batches/batch-one/cancel", {
                method: "POST",
            }),
            {
                params: Promise.resolve({ id: "project-one", batchId: "batch-one" }),
            },
        );

        expect(response.status).toBe(200);
        expect(mocks.updateBatch).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({
                items: [expect.objectContaining({ status: "cancelled", completedAt: expect.any(String) })],
            }),
        );
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("cancels an attached image task before marking the batch item cancelled", async () => {
        mocks.getBatch.mockResolvedValue(
            createBatch({
                generationTaskId: "image-task-one",
            }),
        );

        await POST(
            new Request("http://localhost/api/drama/projects/project-one/asset-generation-batches/batch-one/cancel", {
                method: "POST",
                headers: { cookie: "session=test" },
            }),
            {
                params: Promise.resolve({ id: "project-one", batchId: "batch-one" }),
            },
        );

        expect(mocks.fetch).toHaveBeenCalledWith(
            new URL("http://localhost/api/image-tasks/image-task-one"),
            expect.objectContaining({
                method: "PATCH",
                body: JSON.stringify({ status: "cancelled" }),
            }),
        );
        expect(mocks.updateBatch).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({
                items: [expect.objectContaining({ status: "cancelled" })],
            }),
        );
    });
});
