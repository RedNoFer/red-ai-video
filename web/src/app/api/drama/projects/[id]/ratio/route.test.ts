import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), updateDramaProjectRatioForUser: vi.fn(), readJsonBodyResult: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/auth/request", () => ({ readJsonBodyResult: mocks.readJsonBodyResult }));
vi.mock("@/lib/server/drama-project-service", () => ({
    DramaProjectServiceError: class DramaProjectServiceError extends Error {
        constructor(
            message: string,
            readonly status: number,
        ) {
            super(message);
        }
    },
    updateDramaProjectRatioForUser: mocks.updateDramaProjectRatioForUser,
}));

import { PATCH } from "./route";

describe("PATCH /api/drama/projects/[id]/ratio", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.readJsonBodyResult.mockImplementation(async (request: Request) => ({ ok: true, data: await request.json() }));
        mocks.updateDramaProjectRatioForUser.mockResolvedValue({ projectId: "project-one", ratio: "16:9", updatedAt: "2026-10-06T00:00:01.000Z" });
    });

    it("accepts a compact request and returns only the persisted ratio version", async () => {
        const body = { ratio: "16:9", expectedUpdatedAt: "2026-10-06T00:00:00.000Z" };
        const response = await PATCH(new Request("http://localhost/api/drama/projects/project-one/ratio", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), {
            params: Promise.resolve({ id: "project-one" }),
        });

        expect(response.status).toBe(200);
        const responseText = await response.text();
        expect(JSON.parse(responseText)).toEqual({ code: 0, data: { projectId: "project-one", ratio: "16:9", updatedAt: "2026-10-06T00:00:01.000Z" }, msg: "项目画幅已保存" });
        expect(mocks.readJsonBodyResult).toHaveBeenCalledWith(expect.any(Request));
        expect(mocks.updateDramaProjectRatioForUser).toHaveBeenCalledWith("user-one", "project-one", body);
        expect(responseText.length).toBeLessThan(256);
    });
});
