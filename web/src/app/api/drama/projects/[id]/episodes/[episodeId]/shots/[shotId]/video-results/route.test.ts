import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), syncDramaShotVideoResultsForUser: vi.fn() }));

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
    syncDramaShotVideoResultsForUser: mocks.syncDramaShotVideoResultsForUser,
}));

import { GET } from "./route";

describe("GET /api/drama/projects/[id]/episodes/[episodeId]/shots/[shotId]/video-results", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("requires an authenticated user", async () => {
        mocks.getCurrentUser.mockResolvedValue(null);

        const response = await GET(new Request("http://localhost"), context());

        expect(response.status).toBe(401);
        expect(mocks.syncDramaShotVideoResultsForUser).not.toHaveBeenCalled();
    });

    it("syncs all successful video tasks for the authorized shot", async () => {
        const data = {
            projectId: "project-one",
            episodeId: "episode-one",
            shotId: "shot-one",
            updatedAt: "2026-10-17T04:30:00.000Z",
            shot: {
                id: "shot-one",
                videoResults: [
                    { id: "task-one", url: "/one.mp4" },
                    { id: "task-two", url: "/two.mp4" },
                ],
            },
        };
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.syncDramaShotVideoResultsForUser.mockResolvedValue(data);

        const response = await GET(new Request("http://localhost"), context());

        expect(response.status).toBe(200);
        expect(mocks.syncDramaShotVideoResultsForUser).toHaveBeenCalledWith("user-one", "project-one", "episode-one", "shot-one");
        await expect(response.json()).resolves.toMatchObject({ code: 0, data, msg: "镜头成功视频已同步" });
    });
});

function context() {
    return { params: Promise.resolve({ id: "project-one", episodeId: "episode-one", shotId: "shot-one" }) };
}
