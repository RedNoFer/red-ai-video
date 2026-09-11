import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getDramaProjectForUser: vi.fn(), queryStoredGenerationTasks: vi.fn(), updateDramaAssetForUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/drama-project-service", () => ({
    DramaProjectServiceError: class DramaProjectServiceError extends Error {
        constructor(
            message: string,
            readonly status: number,
        ) {
            super(message);
        }
    },
    getDramaProjectForUser: mocks.getDramaProjectForUser,
    updateDramaAssetForUser: mocks.updateDramaAssetForUser,
}));
vi.mock("@/lib/server/generation-task-store", () => ({ queryStoredGenerationTasks: mocks.queryStoredGenerationTasks }));

import { GET, PATCH } from "./route";

describe("PATCH /api/drama/projects/[id]/assets/[kind]/[assetId]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.getDramaProjectForUser.mockResolvedValue({ characters: [{ id: "character-one" }], scenes: [], props: [] });
        mocks.queryStoredGenerationTasks.mockResolvedValue([]);
        mocks.updateDramaAssetForUser.mockResolvedValue({ id: "project-one", updatedAt: "2026-09-06T00:00:00.000Z" });
    });

    it("returns the latest asset-scoped image task for refresh recovery", async () => {
        mocks.queryStoredGenerationTasks.mockResolvedValue([
            {
                id: "task-one",
                kind: "generation",
                status: "running",
                config: { model: "image-model" },
                prompt: "道具本体静置展示",
                generationStage: "initial",
            },
        ]);
        const response = await GET(new Request("http://localhost"), context());
        expect(response.status).toBe(200);
        expect(mocks.queryStoredGenerationTasks).toHaveBeenCalledWith(
            "image",
            expect.objectContaining({ userId: "user-one", projectId: "project-one", surface: "drama", assetKind: "characters", assetId: "character-one", statuses: ["pending", "running"], limit: 1 }),
        );
        await expect(response.json()).resolves.toMatchObject({ data: { task: { id: "task-one", model: "image-model", status: "running" } } });
    });

    it("does not restore a historical completed task as an active generation", async () => {
        mocks.queryStoredGenerationTasks.mockImplementation(async (_type: string, options: { statuses?: string[] }) =>
            options.statuses?.includes("success") ? [{ id: "historical-task", kind: "generation", status: "success", config: { model: "image-model" }, prompt: "历史场景图" }] : [],
        );

        const response = await GET(new Request("http://localhost"), context());

        expect(response.status).toBe(200);
        expect(mocks.queryStoredGenerationTasks).toHaveBeenCalledWith("image", expect.objectContaining({ statuses: ["pending", "running"] }));
        await expect(response.json()).resolves.toMatchObject({ data: { task: null } });
    });

    it("requires authentication", async () => {
        mocks.getCurrentUser.mockResolvedValue(null);
        const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: "{}" }), context());
        expect(response.status).toBe(401);
        expect(mocks.updateDramaAssetForUser).not.toHaveBeenCalled();
    });

    it("passes the stable asset identity and patch to the latest-snapshot service", async () => {
        const patch = { name: "萧炎", profile: { colorPalette: "墨青、暖金" } };
        const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(patch) }), context());
        expect(response.status).toBe(200);
        expect(mocks.updateDramaAssetForUser).toHaveBeenCalledWith("user-one", "project-one", "characters", "character-one", patch);
        await expect(response.json()).resolves.toMatchObject({ data: { project: { id: "project-one" } } });
    });
});

function context() {
    return { params: Promise.resolve({ id: "project-one", kind: "characters", assetId: "character-one" }) };
}
