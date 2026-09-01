import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createAudioTask: vi.fn(),
    resolveAudioLogicalModelCandidates: vi.fn(),
    toSystemGenerationChannel: vi.fn(),
    getAuthSettings: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof import("next/server")>();
    return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => ({ id: "user" })) }));
vi.mock("@/lib/auth/store", () => {
    class AuthInputError extends Error {
        status = 400;
    }
    return {
        AuthInputError,
        getAuthSettings: mocks.getAuthSettings,
        isAuthInputError: (error: unknown) => error instanceof AuthInputError,
        refundUserPoints: vi.fn(),
    };
});
vi.mock("@/lib/server/generation-task-store", () => ({ withGenerationConcurrencyLimit: vi.fn(async (_userId, _type, _staleMs, _limit, handler) => handler()), linkStoredGenerationTask: vi.fn() }));
vi.mock("@/lib/server/generation-task-scheduler", () => ({ scheduleGenerationTask: vi.fn() }));
vi.mock("@/lib/server/generation-task-recovery-service", () => ({ runGenerationTaskRecoveryBatch: vi.fn() }));
vi.mock("@/lib/server/security", () => ({
    checkGenerationRateLimit: vi.fn(async () => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60_000 })),
    rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock("@/lib/server/audio-task-store", () => ({
    createAudioTask: mocks.createAudioTask,
    getAudioTask: vi.fn(),
    transitionAudioTask: vi.fn(),
    updateAudioTask: vi.fn(),
}));
vi.mock("@/lib/server/logical-model-router", () => ({ resolveAudioLogicalModelCandidates: mocks.resolveAudioLogicalModelCandidates }));
vi.mock("@/lib/server/generation-channel", () => ({
    generationModelId: (config: { model: string; logicalModel?: string }) => config.logicalModel || config.model,
    toSystemGenerationChannel: mocks.toSystemGenerationChannel,
}));

import { POST } from "./route";

describe("audio task model routing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resolveAudioLogicalModelCandidates.mockReset();
        mocks.resolveAudioLogicalModelCandidates.mockReturnValue([]);
        mocks.toSystemGenerationChannel.mockReset();
        mocks.toSystemGenerationChannel.mockImplementation((resolved: { channelId: string }) => ({ apiSource: "system", baseUrl: `/api/ai/system/${resolved.channelId}`, apiKey: "system", apiFormat: "openai", model: "audio-model" }));
        mocks.getAuthSettings.mockResolvedValue({
            systemChannels: [],
            logicalModels: [],
            defaultModels: { audioModel: "" },
            generationConcurrency: { audio: 1 },
            generationDefaults: { audioVoice: "alloy", audioFormat: "mp3" },
        });
    });

    it("rejects a forged client model when the backend has no audio default", async () => {
        const response = await POST(
            new Request("http://localhost/api/audio-tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ config: { model: "forged-audio" }, prompt: "Generate narration" }),
            }),
        );

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe("音频任务参数不完整或渠道不支持");
        expect(mocks.createAudioTask).not.toHaveBeenCalled();
    });

    it("keeps fallback audio channels when a character's preferred channel is stale", async () => {
        const preferred = { channelId: "stale-channel" };
        const fallback = { channelId: "current-channel" };
        mocks.resolveAudioLogicalModelCandidates.mockReturnValue([preferred, fallback]);
        mocks.toSystemGenerationChannel.mockImplementation((resolved: { channelId: string }) => ({ apiSource: "system", baseUrl: `/api/ai/system/${resolved.channelId}`, apiKey: "system", apiFormat: "openai", model: "audio-model" }));
        mocks.createAudioTask.mockResolvedValue({ id: "audio-task", status: "pending", config: { channelId: "stale-channel" } });

        const response = await POST(
            new Request("http://localhost/api/audio-tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ preferredChannelId: "stale-channel", config: { model: "audio-model" }, prompt: "试听文本" }),
            }),
        );

        expect(response.status).toBe(200);
        expect(mocks.resolveAudioLogicalModelCandidates).toHaveBeenCalledWith(expect.anything(), "audio-model", "stale-channel");
        expect(mocks.createAudioTask).toHaveBeenCalledWith(expect.objectContaining({ candidateConfigs: [expect.objectContaining({ channelId: "current-channel" })] }));
    });

    it("uses standard audio routing for drama voice previews so TTS channels can preview", async () => {
        mocks.resolveAudioLogicalModelCandidates.mockReturnValue([{ channelId: "tts-channel" }]);
        mocks.createAudioTask.mockResolvedValue({ id: "audio-task", status: "pending", config: { channelId: "tts-channel" } });

        const response = await POST(
            new Request("http://localhost/api/audio-tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ source: "drama-voice-preview", config: { model: "gpt-5.5::audio" }, prompt: "试听文本" }),
            }),
        );

        expect(response.status).toBe(200);
        expect(mocks.resolveAudioLogicalModelCandidates).toHaveBeenCalledWith(expect.anything(), "gpt-5.5::audio", "");
    });

    it("reports a missing audio logical model before claiming the channel is unsupported", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            systemChannels: [],
            logicalModels: [{ id: "missing-audio", name: "Missing Audio", capability: "audio", enabled: true, bindings: [] }],
            defaultModels: { audioModel: "missing-audio" },
            generationConcurrency: { audio: 1 },
            generationDefaults: { audioVoice: "alloy", audioFormat: "mp3" },
        });
        mocks.resolveAudioLogicalModelCandidates.mockReturnValue([]);

        const response = await POST(
            new Request("http://localhost/api/audio-tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ config: { model: "missing-audio" }, prompt: "试听文本" }),
            }),
        );

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe("后台默认音频模型不可解析，请先在模型渠道里设置可用的音频逻辑模型");
        expect(mocks.createAudioTask).not.toHaveBeenCalled();
    });
});
