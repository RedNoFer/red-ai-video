import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getProject: vi.fn(), refine: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/drama-project-service", () => ({ getDramaProjectForUser: mocks.getProject, DramaProjectServiceError: class extends Error {} }));
vi.mock("@/lib/server/drama-asset-refinement-service", () => ({ refineDramaAssetWithModel: mocks.refine }));

import { POST } from "./route";

describe("POST drama asset refinement", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.getProject.mockResolvedValue({ id: "project-one", title: "短剧", style: "暗黑学院史诗奇幻", ratio: "9:16", characters: [{ id: "rifa", name: "Rifa", description: "女主角", profile: { visualIdentity: "深棕肤色", styling: "皮甲", colorPalette: "深色", consistencyRules: "固定五官和年龄" } }], scenes: [], props: [] });
        mocks.refine.mockResolvedValue({ reply: "已调整", changes: [], updatedProfile: {}, compiledPrompt: "prompt", negativePrompt: "NPC", preservedRules: [] });
    });

    it("binds the model request to the authenticated project asset", async () => {
        const request = new Request("http://localhost/api/drama/projects/project-one/assets/characters/rifa/refine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId: "request-one", prompt: "肤色变白，服装不要像 NPC" }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: "project-one", kind: "characters", assetId: "rifa" }) });
        expect(response.status).toBe(200);
        expect(mocks.refine).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-one", requestId: "request-one", kind: "characters", asset: expect.objectContaining({ id: "rifa" }), prompt: "肤色变白，服装不要像 NPC" }));
    });

    it("rejects an asset id outside the current project", async () => {
        const request = new Request("http://localhost/api/drama/projects/project-one/assets/characters/other/refine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "调整" }) });
        const response = await POST(request, { params: Promise.resolve({ id: "project-one", kind: "characters", assetId: "other" }) });
        expect(response.status).toBe(404);
        expect(mocks.refine).not.toHaveBeenCalled();
    });

    it("continues refinement from the approved primary candidate instead of the older asset settings", async () => {
        mocks.getProject.mockResolvedValue({
            id: "project-one",
            title: "短剧",
            style: "暗黑学院史诗奇幻",
            ratio: "9:16",
            characters: [
                {
                    id: "rifa",
                    name: "Rifa",
                    description: "原始角色设定",
                    profile: { visualIdentity: "深棕肤色", styling: "旧服装", colorPalette: "深色", consistencyRules: "固定五官" },
                    primaryReferenceId: "reference-v3",
                    references: [
                        {
                            id: "reference-v3",
                            status: "approved",
                            refinement: {
                                updatedDescription: "保留原身份的审核调整版",
                                updatedProfile: { visualIdentity: "暖棕肤色", styling: "审核调整后的旅行服", colorPalette: "深红与黑色", consistencyRules: "固定五官与年龄" },
                            },
                        },
                    ],
                },
            ],
            scenes: [],
            props: [],
        });
        const request = new Request("http://localhost/api/drama/projects/project-one/assets/characters/rifa/refine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId: "request-two", prompt: "只把肤色提亮一点" }),
        });

        await POST(request, { params: Promise.resolve({ id: "project-one", kind: "characters", assetId: "rifa" }) });

        expect(mocks.refine).toHaveBeenCalledWith(
            expect.objectContaining({
                asset: expect.objectContaining({
                    description: "保留原身份的审核调整版",
                    profile: expect.objectContaining({ styling: "审核调整后的旅行服", colorPalette: "深红与黑色", consistencyRules: "固定五官与年龄" }),
                }),
            }),
        );
    });
});
