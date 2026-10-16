import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), updateDramaVideoPromptPrefixForUser: vi.fn() }));
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
    updateDramaVideoPromptPrefixForUser: mocks.updateDramaVideoPromptPrefixForUser,
}));
import { PATCH } from "./route";
import { DramaProjectServiceError } from "@/lib/server/drama-project-service";

const context = { params: Promise.resolve({ id: "project-one" }) };
const request = () =>
    new Request("http://localhost/api/drama/projects/project-one/video-prompt-prefix", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "undo", expectedUpdatedAt: "2026-10-16T00:00:00.000Z" }) });

describe("project video declaration route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
    });
    it("uses the session owner and returns the small persisted acknowledgement", async () => {
        const ack = { projectId: "project-one", updatedAt: "2026-10-16T00:00:01.000Z", videoPromptPrefix: { text: "" } };
        mocks.updateDramaVideoPromptPrefixForUser.mockResolvedValue(ack);
        const response = await PATCH(request(), context);
        expect(await response.json()).toMatchObject({ code: 0, data: ack });
        expect(mocks.updateDramaVideoPromptPrefixForUser).toHaveBeenCalledWith("user-one", "project-one", { action: "undo", expectedUpdatedAt: "2026-10-16T00:00:00.000Z" });
    });
    it("rejects anonymous users without reading a project", async () => {
        mocks.getCurrentUser.mockResolvedValue(null);
        expect((await PATCH(request(), context)).status).toBe(401);
        expect(mocks.updateDramaVideoPromptPrefixForUser).not.toHaveBeenCalled();
    });
    it("reports a version conflict without overwriting newer settings", async () => {
        mocks.updateDramaVideoPromptPrefixForUser.mockRejectedValue(new DramaProjectServiceError("项目已更新", 409));
        const response = await PATCH(request(), context);
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ code: 409, data: null, msg: "项目已更新" });
    });
});
