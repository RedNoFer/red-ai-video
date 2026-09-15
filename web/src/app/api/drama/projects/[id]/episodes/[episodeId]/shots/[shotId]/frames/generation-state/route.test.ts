import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    updateDramaStoryboardFrameGenerationStateForUser: vi.fn(),
}));

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
    updateDramaStoryboardFrameGenerationStateForUser: mocks.updateDramaStoryboardFrameGenerationStateForUser,
}));

import { PATCH } from "./route";

describe("PATCH /api/drama/projects/[id]/episodes/[episodeId]/shots/[shotId]/frames/generation-state", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.updateDramaStoryboardFrameGenerationStateForUser.mockResolvedValue({
            projectId: "drama-one",
            episodeId: "episode-one",
            shotId: "shot-one",
            updatedAt: "2026-09-15T00:00:01.000Z",
            shot: { id: "shot-one", storyboardFrames: [{ id: "f2", status: "queued" }] },
        });
    });

    it("returns a compact current-shot result", async () => {
        const response = await PATCH(
            new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/shots/shot-one/frames/generation-state", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ frameType: "all_frames", frameIds: ["f2"], framePlan: { frames: [{ id: "f2", imagePrompt: "画面" }] } }),
            }),
            { params: Promise.resolve({ id: "drama-one", episodeId: "episode-one", shotId: "shot-one" }) },
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            code: 0,
            data: { projectId: "drama-one", episodeId: "episode-one", shotId: "shot-one", updatedAt: "2026-09-15T00:00:01.000Z", shot: { id: "shot-one", storyboardFrames: [{ id: "f2", status: "queued" }] } },
            msg: "当前镜头分镜生成状态已保存",
        });
        expect(mocks.updateDramaStoryboardFrameGenerationStateForUser).toHaveBeenCalledWith("user-one", "drama-one", "episode-one", "shot-one", { frameType: "all_frames", frameIds: ["f2"], framePlan: { frames: [{ id: "f2", imagePrompt: "画面" }] } });
    });
});
