import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getProject: vi.fn(), review: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/drama-project-service", () => ({ getDramaProjectForUser: mocks.getProject, DramaProjectServiceError: class extends Error {} }));
vi.mock("@/lib/server/creative-review-service", () => ({ reviewCreativeOutputs: mocks.review }));

import { POST } from "./route";

describe("POST drama asset candidate review", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.getProject.mockResolvedValue({
            id: "project-one",
            title: "短剧",
            summary: "女主角踏上旅程",
            style: "暗黑学院史诗奇幻",
            characters: [{ id: "rifa", name: "Rifa", description: "女主角", profile: { visualIdentity: "固定五官", styling: "原创职业服装", colorPalette: "深色", consistencyRules: "固定年龄和发型" } }],
            scenes: [],
            props: [],
        });
        mocks.review.mockResolvedValue({ mode: "visual", status: "passed", summary: "身份一致", issues: [], retryTaskIds: [] });
    });

    it("reviews only candidates for the authenticated project asset", async () => {
        const request = new Request("http://localhost/api/drama/projects/project-one/assets/characters/rifa/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "肤色更明亮，保留五官", generationStage: "initial", references: [{ id: "candidate-one", url: "https://example.com/rifa.png" }] }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: "project-one", kind: "characters", assetId: "rifa" }) });
        expect(response.status).toBe(200);
        expect(mocks.review).toHaveBeenCalledWith(expect.objectContaining({
            userId: "user-one",
            tasks: [expect.objectContaining({ id: "candidate-one", imageUrls: ["https://example.com/rifa.png"], resultSummary: "首次生成的资产候选图" })],
            foundation: expect.objectContaining({ brief: expect.objectContaining({ objective: expect.stringContaining("Rifa") }) }),
        }));
    });

    it("rejects candidates when the asset is outside the project", async () => {
        const request = new Request("http://localhost/api/drama/projects/project-one/assets/characters/other/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "调整", references: [{ id: "candidate-one", url: "https://example.com/rifa.png" }] }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: "project-one", kind: "characters", assetId: "other" }) });
        expect(response.status).toBe(404);
        expect(mocks.review).not.toHaveBeenCalled();
    });
});
