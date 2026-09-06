import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), updateDramaAssetForUser: vi.fn() }));

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
    updateDramaAssetForUser: mocks.updateDramaAssetForUser,
}));

import { PATCH } from "./route";

describe("PATCH /api/drama/projects/[id]/assets/[kind]/[assetId]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.updateDramaAssetForUser.mockResolvedValue({ id: "project-one", updatedAt: "2026-09-06T00:00:00.000Z" });
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
