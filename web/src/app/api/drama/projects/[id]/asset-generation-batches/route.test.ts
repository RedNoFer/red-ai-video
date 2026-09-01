import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    after: vi.fn(),
    getCurrentUser: vi.fn(),
    createBatch: vi.fn(),
    listBatches: vi.fn(),
    runBackground: vi.fn(),
}));

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: mocks.after };
});
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/drama-asset-generation-batch", () => ({
    DramaAssetGenerationBatchError: class DramaAssetGenerationBatchError extends Error {
        constructor(
            message: string,
            readonly status = 400,
        ) {
            super(message);
        }
    },
    createDramaAssetGenerationBatchForUser: mocks.createBatch,
    listDramaAssetGenerationBatchesForUser: mocks.listBatches,
    runDramaAssetGenerationBatchInBackground: mocks.runBackground,
}));

import { GET, POST } from "./route";

describe("/api/drama/projects/[id]/asset-generation-batches", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.createBatch.mockResolvedValue({ id: "batch-one", projectId: "project-one", status: "queued", totalCount: 2, completedCount: 0, successCount: 0, failedCount: 0, cancelledCount: 0, items: [], createdAt: "2026-08-20T00:00:00.000Z", updatedAt: "2026-08-20T00:00:00.000Z" });
        mocks.listBatches.mockResolvedValue([{ id: "batch-one" }]);
        mocks.after.mockImplementation((callback: () => void) => callback());
    });

    it("returns a queued batch immediately and schedules background processing", async () => {
        const response = await POST(
            new Request("http://127.0.0.1:3010/api/drama/projects/project-one/asset-generation-batches", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: "session=one" },
                body: JSON.stringify({ assets: [{ kind: "characters", assetId: "character-one" }], config: { imageModel: "image-model" } }),
            }),
            context(),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ code: 0, data: { batch: { id: "batch-one", status: "queued" } }, msg: "批量生成已提交，任务将在后台继续运行" });
        expect(mocks.createBatch).toHaveBeenCalledWith("user-one", "project-one", [{ kind: "characters", assetId: "character-one" }], { imageModel: "image-model" });
        expect(mocks.after).toHaveBeenCalledTimes(1);
        expect(mocks.runBackground).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-one", projectId: "project-one", batchId: "batch-one", cookie: "session=one", config: { imageModel: "image-model" } }));
    });

    it("lists persisted batches for progress recovery", async () => {
        const response = await GET(new Request("http://127.0.0.1:3010/api/drama/projects/project-one/asset-generation-batches"), context());

        expect(response.status).toBe(200);
        expect(mocks.listBatches).toHaveBeenCalledWith("user-one", "project-one");
        await expect(response.json()).resolves.toMatchObject({ code: 0, data: { batches: [{ id: "batch-one" }] } });
    });
});

function context() {
    return { params: Promise.resolve({ id: "project-one" }) };
}
