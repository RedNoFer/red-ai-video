import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getDramaProductionPreflightForUser: vi.fn(),
    getLatestDramaProductionRunForUser: vi.fn(),
    createDramaProductionRunForUser: vi.fn(),
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
    createDramaProductionRunForUser: mocks.createDramaProductionRunForUser,
    getDramaProductionPreflightForUser: mocks.getDramaProductionPreflightForUser,
    getLatestDramaProductionRunForUser: mocks.getLatestDramaProductionRunForUser,
}));

import { GET, POST } from "./route";

describe("/api/drama/projects/[id]/production-runs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.getDramaProductionPreflightForUser.mockResolvedValue({ status: "passed", issues: [] });
        mocks.getLatestDramaProductionRunForUser.mockResolvedValue({ id: "run-one", scope: "visual", status: "completed" });
        mocks.createDramaProductionRunForUser.mockResolvedValue({ id: "run-created", scope: "visual", status: "running" });
    });

    it("does not rerun production preflight while syncing visual task results", async () => {
        const response = await GET(new Request("http://localhost/api/drama/projects/drama-one/production-runs?episodeId=episode-one&scope=visual"), {
            params: Promise.resolve({ id: "drama-one" }),
        });

        expect(response.status).toBe(200);
        expect(mocks.getDramaProductionPreflightForUser).not.toHaveBeenCalled();
        expect(mocks.getLatestDramaProductionRunForUser).toHaveBeenCalledWith("user-one", "drama-one", "episode-one", expect.objectContaining({ scope: "visual" }));
    });

    it("still returns production preflight for the production scope", async () => {
        const response = await GET(new Request("http://localhost/api/drama/projects/drama-one/production-runs?episodeId=episode-one&scope=production"), {
            params: Promise.resolve({ id: "drama-one" }),
        });

        expect(response.status).toBe(200);
        expect(mocks.getDramaProductionPreflightForUser).toHaveBeenCalledWith("user-one", "drama-one", "episode-one");
        await expect(response.json()).resolves.toMatchObject({ data: { preflight: { status: "passed" } } });
    });

    it("injects the trusted internal origin and request cookie before creating the run", async () => {
        const response = await POST(
            new Request("http://localhost:3010/api/drama/projects/drama-one/production-runs", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: "session=test" },
                body: JSON.stringify({ episodeId: "episode-one", scope: "visual", frameIds: ["f1"] }),
            }),
            { params: Promise.resolve({ id: "drama-one" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.createDramaProductionRunForUser).toHaveBeenCalledWith("user-one", "drama-one", expect.objectContaining({ episodeId: "episode-one", scope: "visual", frameIds: ["f1"], origin: expect.any(String), cookie: "session=test" }));
    });

    it("returns a structured error when production run creation throws unexpectedly", async () => {
        mocks.createDramaProductionRunForUser.mockRejectedValueOnce(new Error("并发状态更新冲突"));

        const response = await POST(
            new Request("http://localhost/api/drama/projects/drama-one/production-runs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ episodeId: "episode-one" }),
            }),
            { params: Promise.resolve({ id: "drama-one" }) },
        );

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({ code: 500, data: null, msg: "并发状态更新冲突" });
    });
});
