import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), updateDramaStoryboardFramePromptForUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/drama-project-service", () => ({
    DramaProjectServiceError: class DramaProjectServiceError extends Error {
        constructor(message: string, readonly status: number) {
            super(message);
        }
    },
    updateDramaStoryboardFramePromptForUser: mocks.updateDramaStoryboardFramePromptForUser,
}));

import { PATCH } from "./route";

describe("PATCH /api/drama/projects/[id]/episodes/[episodeId]/shots/[shotId]/frames/[frameId]/prompt", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.updateDramaStoryboardFramePromptForUser.mockResolvedValue({ id: "drama-one", episodes: [{ id: "episode-one" }] });
    });

    it("persists the prompt for the requested stable frame", async () => {
        const body = { supplierPrompt: "静态关键帧：已编辑" };
        const response = await PATCH(
            new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/shots/shot-one/frames/frame-five/prompt", { method: "PATCH", body: JSON.stringify(body) }),
            { params: Promise.resolve({ id: "drama-one", episodeId: "episode-one", shotId: "shot-one", frameId: "frame-five" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.updateDramaStoryboardFramePromptForUser).toHaveBeenCalledWith("user-one", "drama-one", "episode-one", "shot-one", "frame-five", body);
        await expect(response.json()).resolves.toMatchObject({ code: 0, data: { project: { id: "drama-one" } } });
    });

    it("requires authentication before writing a frame prompt", async () => {
        mocks.getCurrentUser.mockResolvedValue(null);
        const response = await PATCH(
            new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/shots/shot-one/frames/frame-five/prompt", { method: "PATCH", body: "{}" }),
            { params: Promise.resolve({ id: "drama-one", episodeId: "episode-one", shotId: "shot-one", frameId: "frame-five" }) },
        );

        expect(response.status).toBe(401);
        expect(mocks.updateDramaStoryboardFramePromptForUser).not.toHaveBeenCalled();
    });
});
