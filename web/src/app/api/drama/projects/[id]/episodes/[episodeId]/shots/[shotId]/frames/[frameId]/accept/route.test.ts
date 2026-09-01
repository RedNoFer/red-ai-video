import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    acceptDramaStoryboardFrameForUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/drama-project-service", () => ({
    acceptDramaStoryboardFrameForUser: mocks.acceptDramaStoryboardFrameForUser,
    DramaProjectServiceError: class DramaProjectServiceError extends Error {
        constructor(
            message: string,
            readonly status: number,
        ) {
            super(message);
        }
    },
}));

import { POST } from "./route";

describe("POST /api/drama/projects/[id]/episodes/[episodeId]/shots/[shotId]/frames/[frameId]/accept", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.acceptDramaStoryboardFrameForUser.mockResolvedValue({ id: "drama-one", episodes: [{ id: "episode-one", shots: [{ id: "shot-one", storyboardFrames: [{ id: "frame-two", continuityStatus: "passed" }] }] }] });
    });

    it("persists and returns the manually accepted frame", async () => {
        const response = await POST(new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/shots/shot-one/frames/frame-two/accept", { method: "POST" }), {
            params: Promise.resolve({ id: "drama-one", episodeId: "episode-one", shotId: "shot-one", frameId: "frame-two" }),
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({ code: 0, data: { project: { id: "drama-one" } }, msg: "分镜帧已验收" });
        expect(mocks.acceptDramaStoryboardFrameForUser).toHaveBeenCalledWith("user-one", "drama-one", "episode-one", "shot-one", "frame-two", undefined);
    });

    it("selects a specific generated candidate", async () => {
        const response = await POST(
            new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/shots/shot-one/frames/frame-two/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ candidateId: "candidate-new" }),
            }),
            { params: Promise.resolve({ id: "drama-one", episodeId: "episode-one", shotId: "shot-one", frameId: "frame-two" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.acceptDramaStoryboardFrameForUser).toHaveBeenCalledWith("user-one", "drama-one", "episode-one", "shot-one", "frame-two", "candidate-new");
    });

    it("rejects an unauthenticated acceptance", async () => {
        mocks.getCurrentUser.mockResolvedValue(null);

        const response = await POST(new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/shots/shot-one/frames/frame-two/accept", { method: "POST" }), {
            params: Promise.resolve({ id: "drama-one", episodeId: "episode-one", shotId: "shot-one", frameId: "frame-two" }),
        });

        expect(response.status).toBe(401);
        expect(mocks.acceptDramaStoryboardFrameForUser).not.toHaveBeenCalled();
    });
});
