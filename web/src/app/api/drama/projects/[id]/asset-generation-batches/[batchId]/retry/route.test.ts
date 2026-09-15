import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    after: vi.fn(),
    getCurrentUser: vi.fn(),
    getBatch: vi.fn(),
    updateBatch: vi.fn(),
    runBackground: vi.fn(),
}));

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: mocks.after };
});

vi.mock("@/lib/auth/session", () => ({
    getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/server/drama-asset-generation-batch", () => ({
    DramaAssetGenerationBatchError: class DramaAssetGenerationBatchError extends Error {},
    getDramaAssetGenerationBatchForUser: mocks.getBatch,
    updateDramaAssetGenerationBatchForUser: mocks.updateBatch,
    runDramaAssetGenerationBatchInBackground: mocks.runBackground,
}));

import { POST } from "./route";

describe("POST /asset-generation-batches/:batchId/retry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.after.mockImplementation((callback: () => void) => callback());
        mocks.updateBatch.mockImplementation(async (_userId: string, nextBatch) => ({
            ...nextBatch,
            status: "queued",
            completedCount: 0,
            failedCount: 0,
            cancelledCount: 0,
        }));
    });

    it("requeues cancelled image items for an explicit retry", async () => {
        mocks.getBatch.mockResolvedValue({
            id: "batch-one",
            projectId: "project-one",
            status: "cancelled",
            executionConfig: { count: "1" },
            items: [
                {
                    id: "item-one",
                    kind: "prop",
                    outputType: "reference_image",
                    assetId: "asset-one",
                    assetName: "毛笔",
                    status: "cancelled",
                    attempt: 1,
                    generationTaskId: "old-task",
                    completedAt: "2026-09-15T00:00:00.000Z",
                },
            ],
        });

        const response = await POST(
            new Request("http://localhost/api/drama/projects/project-one/asset-generation-batches/batch-one/retry", {
                method: "POST",
                body: JSON.stringify({}),
                headers: { "content-type": "application/json" },
            }),
            { params: Promise.resolve({ id: "project-one", batchId: "batch-one" }) },
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.retryCount).toBe(1);
        expect(mocks.updateBatch).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({
                items: [
                    expect.objectContaining({
                        status: "queued",
                        generationTaskId: undefined,
                        completedAt: undefined,
                    }),
                ],
            }),
        );
        expect(mocks.runBackground).toHaveBeenCalledWith({
            userId: "user-one",
            projectId: "project-one",
            batchId: "batch-one",
            origin: "http://localhost",
            publicOrigin: "http://localhost",
            cookie: "",
            config: { count: "1" },
        });
    });
});
