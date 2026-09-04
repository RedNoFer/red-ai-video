import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    updateDramaShotPromptForUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/auth/request", () => ({ readJsonBodyResult: vi.fn(async (request: Request) => ({ ok: true, data: await request.json() })) }));
vi.mock("@/lib/server/drama-project-service", () => ({
    DramaProjectServiceError: class DramaProjectServiceError extends Error {
        constructor(
            message: string,
            readonly status: number,
        ) {
            super(message);
        }
    },
    updateDramaShotPromptForUser: mocks.updateDramaShotPromptForUser,
}));

import { PATCH } from "./route";

describe("PATCH /api/drama/projects/[id]/episodes/[episodeId]/shots/[shotId]/prompt", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.updateDramaShotPromptForUser.mockResolvedValue({
            id: "drama-one",
            updatedAt: "2026-09-04T00:00:01.000Z",
            episodes: [{ id: "episode-one", shots: [{ id: "shot-one", executionVideoPrompt: "修改后的提示词" }] }],
        });
    });

    it("returns a compact shot patch when requested", async () => {
        const response = await PATCH(
            new Request("http://localhost/api/drama/projects/drama-one/episodes/episode-one/shots/shot-one/prompt?response=shot", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ executionVideoPrompt: "修改后的提示词", executionVideoPromptOrigin: "manual" }),
            }),
            context(),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            code: 0,
            data: { projectId: "drama-one", episodeId: "episode-one", shotId: "shot-one", updatedAt: "2026-09-04T00:00:01.000Z", shot: { id: "shot-one", executionVideoPrompt: "修改后的提示词" } },
            msg: "短剧视频提示词已更新",
        });
    });
});

function context() {
    return { params: Promise.resolve({ id: "drama-one", episodeId: "episode-one", shotId: "shot-one" }) };
}
