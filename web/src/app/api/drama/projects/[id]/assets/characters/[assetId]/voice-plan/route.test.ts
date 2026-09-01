import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), project: vi.fn(), update: vi.fn(), plan: vi.fn(), defaultPrompt: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/server/drama-project-service", () => ({ getDramaProjectForUser: mocks.project, updateDramaProjectForUser: mocks.update }));
vi.mock("@/lib/server/drama-voice-planning", () => ({ planDramaVoice: mocks.plan }));
vi.mock("@/lib/server/drama-voice-creation", () => ({ defaultDramaVoiceDesignPrompt: mocks.defaultPrompt }));
vi.mock("@/lib/server/internal-origin", () => ({ resolveInternalOrigin: vi.fn(() => "http://localhost") }));

import { POST } from "./route";

describe("legacy drama voice-plan route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.currentUser.mockResolvedValue({ id: "user-one" });
        mocks.project.mockResolvedValue(project());
        mocks.update.mockImplementation(async (_userId: string, _projectId: string, value: unknown) => value);
        mocks.defaultPrompt.mockReturnValue("18 岁少年，清亮自然、克制而有韧性");
    });

    it("only stores an editable Voice Design prompt and does not allocate a fixed pool voice", async () => {
        mocks.plan.mockResolvedValue({ blueprint: { age: "young" }, instructions: "语速自然", designPrompt: "18 岁少年，清亮自然" });
        const response = await POST(new Request("http://localhost/api/drama/projects/project-one/assets/characters/character-one/voice-plan", { method: "POST" }), context());
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.voiceProfile).toMatchObject({ voiceId: "", designPrompt: "18 岁少年，清亮自然", instructions: "语速自然", creationMode: "design" });
        expect(payload.data.voiceProfile.previewTaskId).toBe("");
    });

    it("falls back to a deterministic role prompt when text planning is unavailable", async () => {
        mocks.plan.mockRejectedValue(new Error("text unavailable"));
        const response = await POST(new Request("http://localhost/api/drama/projects/project-one/assets/characters/character-one/voice-plan", { method: "POST" }), context());
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.voiceProfile.designPrompt).toContain("18 岁少年");
        expect(payload.data.voiceProfile.voiceId).toBe("");
        expect(payload.data.warning).toContain("文本规划不可用");
    });
});

function context() {
    return { params: Promise.resolve({ id: "project-one", assetId: "character-one" }) };
}
function project() {
    return { id: "project-one", title: "项目", characters: [{ id: "character-one", name: "Karin", description: "18岁男性", voiceProfile: { voiceId: "", speed: 1, instructions: "" } }], scenes: [], props: [], clues: [], episodes: [], updatedAt: "2026-08-22T00:00:00.000Z" };
}
