import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getAuthSettings: vi.fn(),
    resolveAudioLogicalModelCandidates: vi.fn(),
    getAudioTask: vi.fn(),
}));

vi.mock("@/lib/auth/store", () => ({ getAuthSettings: mocks.getAuthSettings }));
vi.mock("@/lib/server/logical-model-router", () => ({ resolveAudioLogicalModelCandidates: mocks.resolveAudioLogicalModelCandidates }));
vi.mock("@/lib/server/audio-task-store", () => ({ getAudioTask: mocks.getAudioTask }));
vi.mock("@/lib/server/internal-origin", () => ({ resolveInternalOrigin: (value: string) => value }));
vi.mock("@/lib/server/generation-task-scheduler", () => ({ scheduleGenerationTask: vi.fn() }));

import { submitDramaVoicePreview } from "./drama-voice-preview";

describe("submitDramaVoicePreview", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getAuthSettings.mockResolvedValue({
            defaultModels: { audioModel: "tts-model" },
            logicalModels: [{ id: "tts-model", name: "TTS", capability: "audio", enabled: true, bindings: [{ id: "binding", channelId: "tts-channel", upstreamModel: "tts-model", enabled: true, priority: 1 }] }],
        });
        mocks.resolveAudioLogicalModelCandidates.mockReturnValue([{ logicalModelId: "tts-model", channelId: "tts-channel", channel: { id: "tts-channel" } }]);
        mocks.getAudioTask.mockResolvedValue(undefined);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify({ task: { id: "audio-task-one", status: "pending", channelId: "tts-channel" } }), { status: 200, headers: { "content-type": "application/json" } })),
        );
    });

    it("accepts a standard TTS audio model for voice preview", async () => {
        const result = await submitDramaVoicePreview({
            origin: "http://localhost:3010",
            cookie: "",
            project: { id: "drama-one", title: "测试", summary: "", style: "", characters: [], scenes: [], props: [], clues: [], episodes: [{ id: "ep1", title: "第一集", scenes: [], shots: [] }] } as never,
            character: {
                id: "char-one",
                name: "Karin",
                description: "冷静",
                profile: { visualIdentity: "年轻男性" },
                voiceProfile: { voiceId: "alloy", logicalModelId: "tts-model", channelId: "tts-channel", speed: 1, instructions: "自然", previewStatus: "idle" },
            } as never,
        });

        expect(mocks.resolveAudioLogicalModelCandidates).toHaveBeenCalledWith(expect.anything(), "tts-model", "tts-channel");
        expect(result.profile.logicalModelId).toBe("tts-model");
        expect(result.profile.previewTaskId).toBe("audio-task-one");
    });

    it("uses a normal TTS model for a Voice Design preview instead of creating another voice", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            defaultModels: { audioModel: "voice-design" },
            logicalModels: [
                { id: "voice-design", name: "Voice Design", capability: "audio", enabled: true, bindings: [{ id: "design-binding", channelId: "design-channel", upstreamModel: "voice-design", enabled: true, priority: 1 }] },
                { id: "speech-2.8", name: "Speech 2.8", capability: "audio", enabled: true, bindings: [{ id: "tts-binding", channelId: "design-channel", upstreamModel: "speech-2.8", enabled: true, priority: 1 }] },
            ],
        });
        mocks.resolveAudioLogicalModelCandidates.mockImplementation((_settings, modelId: string) =>
            modelId === "speech-2.8"
                ? [{ logicalModelId: "speech-2.8", upstreamModel: "speech-2.8", channelId: "design-channel", channel: { id: "design-channel", advancedConfig: { protocol: "custom", modelConfigs: { "speech-2.8": { capability: "audio", createPath: "/audio/speech", requestTemplate: "{}", audioOperation: "tts" } } } } }]
                : [{ logicalModelId: "voice-design", upstreamModel: "voice-design", channelId: "design-channel", channel: { id: "design-channel", advancedConfig: { protocol: "custom", modelConfigs: { "voice-design": { capability: "audio", createPath: "/v1/media/generate", requestTemplate: "{}", audioOperation: "voice-design" } } } } }],
        );

        const result = await submitDramaVoicePreview({
            origin: "http://localhost:3010",
            cookie: "",
            project: { id: "drama-one", title: "测试", summary: "", style: "", characters: [], scenes: [], props: [], clues: [], episodes: [{ id: "ep1", title: "第一集", scenes: [], shots: [] }] } as never,
            character: {
                id: "char-one",
                name: "Karin",
                description: "冷静",
                profile: { visualIdentity: "年轻男性" },
                voiceProfile: { voiceId: "voice-created", logicalModelId: "voice-design", channelId: "design-channel", speed: 1, instructions: "自然", previewStatus: "error" },
            } as never,
        });

        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ body: expect.stringContaining('"model":"speech-2.8"') }),
        );
        expect(result.profile.logicalModelId).toBe("voice-design");
    });
});
