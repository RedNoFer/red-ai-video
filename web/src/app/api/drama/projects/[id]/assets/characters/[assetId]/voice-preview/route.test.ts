import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getDramaProjectForUser: vi.fn(),
    updateDramaProjectForUser: vi.fn(),
    getAudioTask: vi.fn(),
    scheduleGenerationTask: vi.fn(),
    submitDramaVoicePreview: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/drama-project-service", () => ({ getDramaProjectForUser: mocks.getDramaProjectForUser, updateDramaProjectForUser: mocks.updateDramaProjectForUser }));
vi.mock("@/lib/server/audio-task-store", () => ({ getAudioTask: mocks.getAudioTask }));
vi.mock("@/lib/server/generation-task-scheduler", () => ({ scheduleGenerationTask: mocks.scheduleGenerationTask }));
vi.mock("@/lib/server/drama-voice-preview", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/server/drama-voice-preview")>();
    return { ...actual, submitDramaVoicePreview: mocks.submitDramaVoicePreview };
});

import { GET, POST } from "./route";

describe("/api/drama/projects/[id]/assets/characters/[assetId]/voice-preview", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.getDramaProjectForUser.mockResolvedValue(project());
        mocks.updateDramaProjectForUser.mockImplementation(async (_userId, _projectId, nextProject) => nextProject);
        mocks.getAudioTask.mockResolvedValue({ id: "audio-task-one", status: "pending", config: { channelId: "channel-one" } });
        mocks.submitDramaVoicePreview.mockResolvedValue({
            profile: { ...project().characters[0].voiceProfile, previewStatus: "queued", previewTaskId: "audio-task-two" },
            task: { id: "audio-task-two", status: "pending" },
            cached: false,
        });
    });

    it("re-submits a failed preview instead of reading the old task again", async () => {
        const response = await POST(new Request("http://localhost/api/drama/projects/drama-one/assets/characters/char-one/voice-preview", { method: "POST" }), context());
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.msg).toBe("试听任务已重新提交");
        expect(payload.data.voiceProfile).toMatchObject({ previewStatus: "queued", previewTaskId: "audio-task-two" });
        expect(mocks.submitDramaVoicePreview).toHaveBeenCalledWith(expect.objectContaining({ project: expect.anything(), character: expect.anything() }));
        expect(mocks.updateDramaProjectForUser).toHaveBeenCalledTimes(1);
    });

    it("writes the playable URL when the existing task is complete", async () => {
        mocks.getAudioTask.mockResolvedValue({ id: "audio-task-one", status: "success", config: { channelId: "channel-one" }, result: { url: "https://audio.test/preview.mp3", mimeType: "audio/mpeg" } });

        const response = await GET(new Request("http://localhost/api/drama/projects/drama-one/assets/characters/char-one/voice-preview"), context());
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.msg).toBe("试听已完成");
        expect(payload.data.voiceProfile).toMatchObject({ previewStatus: "success", previewAudioUrl: "https://audio.test/preview.mp3" });
    });

    it("does not expose a provider failure as the preview message", async () => {
        mocks.getAudioTask.mockResolvedValue({ id: "audio-task-one", status: "error", config: { channelId: "channel-one" }, error: "404 page not found" });

        const response = await GET(new Request("http://localhost/api/drama/projects/drama-one/assets/characters/char-one/voice-preview"), context());
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.msg).toBe("试听失败：404 page not found");
        expect(payload.data.voiceProfile).toMatchObject({ previewStatus: "error", previewError: "404 page not found" });
    });

    it("stops a Chat/Responses task that only returned an upstream ID", async () => {
        mocks.getAudioTask.mockResolvedValue({
            id: "audio-task-one",
            status: "running",
            executionPhase: "polling",
            lastUpstreamStatus: "query_error:12",
            upstream: { id: "resp_123", createPath: "/chat/completions" },
            config: { channelId: "channel-one", advancedConfig: { protocol: "openai-audio-dialogue", queryPath: "" } },
        });

        const response = await GET(new Request("http://localhost/api/drama/projects/drama-one/assets/characters/char-one/voice-preview"), context());
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.msg).toContain("只返回了任务 ID");
        expect(payload.data.voiceProfile).toMatchObject({ previewStatus: "error", previewAudioUrl: "", previewError: expect.stringContaining("只返回了任务 ID") });
        expect(mocks.scheduleGenerationTask).toHaveBeenCalledWith("audio", "audio-task-one", expect.objectContaining({ executionPhase: "needs_review", nextPollAt: undefined }));
    });
});

function context() {
    return { params: Promise.resolve({ id: "drama-one", assetId: "char-one" }) };
}

function project() {
    return {
        id: "drama-one",
        title: "测试短剧",
        summary: "",
        style: "",
        characters: [
            {
                id: "char-one",
                name: "Karin",
                description: "18岁男性，冷静",
                profile: { visualIdentity: "年轻男性" },
                voiceProfile: { voiceId: "alloy", logicalModelId: "gpt-5.5::audio", channelId: "", speed: 1, instructions: "", previewStatus: "queued", previewTaskId: "audio-task-one" },
            },
        ],
        scenes: [],
        props: [],
        clues: [],
        episodes: [],
    };
}
