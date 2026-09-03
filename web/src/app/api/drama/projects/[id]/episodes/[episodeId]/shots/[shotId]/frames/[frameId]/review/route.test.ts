import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    reviewDramaStoryboardFrameForUser: vi.fn(),
    checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/internal-origin", () => ({ resolveInternalOrigin: (value: string) => value }));
vi.mock("@/lib/server/security", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/server/drama-project-service", () => ({
    reviewDramaStoryboardFrameForUser: mocks.reviewDramaStoryboardFrameForUser,
    DramaProjectServiceError: class DramaProjectServiceError extends Error {
        constructor(message: string, readonly status: number) {
            super(message);
        }
    },
}));

import { POST } from "./route";

describe("POST /api/drama/projects/[id]/episodes/[episodeId]/shots/[shotId]/frames/[frameId]/review", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.checkRateLimit.mockResolvedValue({ allowed: true });
        mocks.reviewDramaStoryboardFrameForUser.mockResolvedValue({ project: { id: "drama-one" }, review: { status: "passed", summary: "符合当前帧" } });
    });

    it("runs a manual frame inspection and returns the review", async () => {
        const response = await POST(new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/shots/shot-one/frames/frame-one/review", { method: "POST", headers: { cookie: "session=1" } }), {
            params: Promise.resolve({ id: "drama-one", episodeId: "episode-one", shotId: "shot-one", frameId: "frame-one" }),
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({ code: 0, data: { project: { id: "drama-one" }, review: { status: "passed" } }, msg: "图片检验完成" });
        expect(mocks.reviewDramaStoryboardFrameForUser).toHaveBeenCalledWith("user-one", "drama-one", "episode-one", "shot-one", "frame-one", { origin: "http://localhost", cookie: "session=1" });
    });

    it("rejects an unauthenticated inspection", async () => {
        mocks.getCurrentUser.mockResolvedValue(null);
        const response = await POST(new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/shots/shot-one/frames/frame-one/review", { method: "POST" }), {
            params: Promise.resolve({ id: "drama-one", episodeId: "episode-one", shotId: "shot-one", frameId: "frame-one" }),
        });
        expect(response.status).toBe(401);
        expect(mocks.reviewDramaStoryboardFrameForUser).not.toHaveBeenCalled();
    });

    it("rejects inspections over the rate limit", async () => {
        mocks.checkRateLimit.mockResolvedValue({ allowed: false });
        const response = await POST(new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/shots/shot-one/frames/frame-one/review", { method: "POST" }), {
            params: Promise.resolve({ id: "drama-one", episodeId: "episode-one", shotId: "shot-one", frameId: "frame-one" }),
        });
        expect(response.status).toBe(429);
        expect(mocks.reviewDramaStoryboardFrameForUser).not.toHaveBeenCalled();
    });
});
