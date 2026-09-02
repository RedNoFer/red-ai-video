import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), saveDramaEpisodeSettingsForUser: vi.fn() }));

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
    saveDramaEpisodeSettingsForUser: mocks.saveDramaEpisodeSettingsForUser,
}));

import { PATCH } from "./route";

describe("/api/drama/projects/[id]/episodes/[episodeId]/settings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.saveDramaEpisodeSettingsForUser.mockResolvedValue({ id: "drama-one", episodes: [{ id: "episode-one" }] });
    });

    it("saves a compact settings payload for the current user", async () => {
        const body = { title: "第 1 集", summary: "摘要", style: "学院", productionPlan: { lockedAt: "2026-09-02T12:00:00.000Z" } };

        const response = await PATCH(new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/settings", { method: "PATCH", body: JSON.stringify(body) }), context());

        expect(response.status).toBe(200);
        expect(mocks.saveDramaEpisodeSettingsForUser).toHaveBeenCalledWith("user-one", "drama-one", "episode-one", body);
        await expect(response.json()).resolves.toMatchObject({ code: 0, data: { project: { id: "drama-one" } } });
    });

    it("requires authentication before writing settings", async () => {
        mocks.getCurrentUser.mockResolvedValue(null);

        const response = await PATCH(new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/settings", { method: "PATCH", body: "{}" }), context());

        expect(response.status).toBe(401);
        expect(mocks.saveDramaEpisodeSettingsForUser).not.toHaveBeenCalled();
    });
});

function context() {
    return { params: Promise.resolve({ id: "drama-one", episodeId: "episode-one" }) };
}
