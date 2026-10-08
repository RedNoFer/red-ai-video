import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getDramaProjectForUser: vi.fn(),
    updateDramaProjectForUser: vi.fn(),
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
    deleteDramaProjectForUser: vi.fn(),
    getDramaProjectForUser: mocks.getDramaProjectForUser,
    updateDramaProjectForUser: mocks.updateDramaProjectForUser,
}));

import { GET, PATCH } from "./route";

describe("/api/drama/projects/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.getDramaProjectForUser.mockResolvedValue({ id: "drama-one", title: "测试短剧", episodes: [{ id: "episode-one" }] });
    });

    it("requires authentication", async () => {
        mocks.getCurrentUser.mockResolvedValue(null);

        const response = await GET(new Request("http://localhost/api/drama/projects/drama-one"), context("drama-one"));

        expect(response.status).toBe(401);
        expect(mocks.getDramaProjectForUser).not.toHaveBeenCalled();
    });

    it("loads only the requested project for the current user", async () => {
        const response = await GET(new Request("http://localhost/api/drama/projects/drama-one"), context("drama-one"));

        expect(response.status).toBe(200);
        expect(mocks.getDramaProjectForUser).toHaveBeenCalledWith("user-one", "drama-one");
        await expect(response.json()).resolves.toMatchObject({ data: { project: { id: "drama-one", episodes: [{ id: "episode-one" }] } } });
    });

    it("rejects full project snapshots on the project route", async () => {
        const response = await PATCH(
            new Request("http://localhost/api/drama/projects/drama-one", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "drama-one", episodes: [{ id: "episode-one" }], characters: [] }) }),
            context("drama-one"),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ msg: "不支持提交整份短剧项目；请使用对应的局部变更接口" });
        expect(mocks.updateDramaProjectForUser).not.toHaveBeenCalled();
    });
});

function context(id: string) {
    return { params: Promise.resolve({ id }) };
}
