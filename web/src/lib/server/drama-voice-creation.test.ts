import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DramaProject } from "@/lib/drama-project-contract";

const mocks = vi.hoisted(() => ({
    settings: vi.fn(),
    createTask: vi.fn(),
    getTask: vi.fn(),
    byRequest: vi.fn(),
    link: vi.fn(),
    schedule: vi.fn(),
    project: vi.fn(),
    updateProject: vi.fn(),
    readAsset: vi.fn(),
}));

vi.mock("@/lib/auth/store", () => ({ getAuthSettings: mocks.settings }));
vi.mock("@/lib/server/audio-task-store", () => ({ createAudioTask: mocks.createTask, getAudioTask: mocks.getTask }));
vi.mock("@/lib/server/generation-task-store", () => ({ getStoredGenerationTaskByRequest: mocks.byRequest, linkStoredGenerationTask: mocks.link }));
vi.mock("@/lib/server/generation-task-scheduler", () => ({ scheduleGenerationTask: mocks.schedule }));
vi.mock("@/lib/server/drama-project-service", () => ({ getDramaProjectForUser: mocks.project, updateDramaProjectForUser: mocks.updateProject }));
vi.mock("@/lib/server/reference-asset-store", () => ({ readReferenceAsset: mocks.readAsset }));
vi.mock("@/lib/server/reference-asset-access", () => ({ createSignedReferenceAssetUrl: vi.fn(() => "https://vozeb.example/api/reference-assets/permanent/audio/sample.wav?signature=test") }));

import { applyDramaVoiceCreationTask, createDramaVoiceCreationTask, DramaVoiceCreationError } from "./drama-voice-creation";

describe("drama voice creation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.settings.mockResolvedValue(settings());
        mocks.byRequest.mockResolvedValue(null);
        mocks.createTask.mockResolvedValue(task());
        mocks.project.mockResolvedValue(project());
        mocks.updateProject.mockImplementation(async (_userId: string, _projectId: string, value: unknown) => value);
    });

    it("creates one idempotent Voice Design task without replacing the current voice early", async () => {
        const source = project("old-voice");
        const result = await createDramaVoiceCreationTask({ userId: "user-one", project: source, character: source.characters[0], mode: "design", requestId: "request-one", origin: "https://vozeb.example", confirmReplace: true });

        expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ voiceOperation: "voice-design", designPrompt: expect.stringContaining("Karin") }), voiceCreation: expect.objectContaining({ characterId: "character-one" }) }));
        expect(mocks.link).toHaveBeenCalledWith("audio", "voice-task-one", expect.objectContaining({ clientRequestId: "drama-voice-create:project-one:character-one:request-one" }));
        expect(mocks.schedule).toHaveBeenCalledWith("audio", "voice-task-one", expect.objectContaining({ executionPhase: "created" }));
        expect(result.voiceProfile).toMatchObject({ voiceId: "old-voice", creationTaskId: "voice-task-one", creationStatus: "queued" });
    });

    it("upgrades the documented voice-design model from a legacy OpenAI TTS route", async () => {
        mocks.settings.mockResolvedValue(settings("voice-design", {
            protocol: "openai",
            createPath: "/audio/speech",
            requestTemplate: '{"model":"{{model}}","input":"{{prompt}}","voice":"alloy"}',
            audioOperation: undefined,
            voiceIdField: undefined,
            previewAudioField: undefined,
        }));
        const source = project();

        await createDramaVoiceCreationTask({ userId: "user-one", project: source, character: source.characters[0], mode: "design", requestId: "legacy-route", origin: "https://vozeb.example" });

        expect(mocks.createTask).toHaveBeenCalledWith(
            expect.objectContaining({
                config: expect.objectContaining({
                    voiceOperation: "voice-design",
                    advancedConfig: expect.objectContaining({ createPath: "/v1/media/generate", audioOperation: "voice-design", voiceIdField: "voice_id", previewAudioField: "trial_audio" }),
                }),
            }),
        );
    });

    it("requires explicit replacement confirmation before it creates a billable task", async () => {
        const source = project("old-voice");
        await expect(createDramaVoiceCreationTask({ userId: "user-one", project: source, character: source.characters[0], mode: "design", requestId: "request-one", origin: "https://vozeb.example" })).rejects.toThrow("角色已有声纹");
        expect(mocks.createTask).not.toHaveBeenCalled();
    });

    it("reuses an active voice creation task instead of creating another billable task", async () => {
        const source = project("old-voice", { creationTaskId: "voice-task-one", creationStatus: "queued" });
        mocks.getTask.mockResolvedValue(task());

        const result = await createDramaVoiceCreationTask({ userId: "user-one", project: source, character: source.characters[0], mode: "design", requestId: "second-click", origin: "https://vozeb.example", confirmReplace: true });

        expect(result).toMatchObject({ cached: true, task: { id: "voice-task-one", status: "pending" } });
        expect(mocks.createTask).not.toHaveBeenCalled();
        expect(mocks.schedule).not.toHaveBeenCalled();
    });

    it("does not overwrite a role when a completed task has no voice_id or belongs to an old fingerprint", async () => {
        const source = project("old-voice", { creationTaskId: "voice-task-one", creationFingerprint: "current" });
        mocks.project.mockResolvedValue(source);
        await expect(applyDramaVoiceCreationTask({ ...task("success"), voiceCreation: { projectId: "project-one", characterId: "character-one", fingerprint: "current" }, result: { url: "/api/reference-assets/preview.mp3", mimeType: "audio/mpeg" } } as never)).resolves.toBeNull();
        expect(mocks.updateProject).not.toHaveBeenCalled();

        await expect(applyDramaVoiceCreationTask({ ...task("success"), voiceCreation: { projectId: "project-one", characterId: "character-one", fingerprint: "old" }, result: { url: "/api/reference-assets/preview.mp3", mimeType: "audio/mpeg", voiceId: "new-voice" } } as never)).resolves.toBeNull();
        expect(mocks.updateProject).not.toHaveBeenCalled();
    });

    it("writes voice_id and local trial audio only when the active task fingerprint matches", async () => {
        const source = project("old-voice", { creationTaskId: "voice-task-one", creationFingerprint: "current" });
        mocks.project.mockResolvedValue(source);
        const updated = await applyDramaVoiceCreationTask({ ...task("success"), voiceCreation: { projectId: "project-one", characterId: "character-one", fingerprint: "current" }, result: { url: "/api/reference-assets/preview.mp3", mimeType: "audio/mpeg", assetId: "permanent/audio/preview.mp3", voiceId: "new-voice" } } as never);

        expect(updated?.characters[0].voiceProfile).toMatchObject({ voiceId: "new-voice", creationStatus: "success", previewAudioUrl: "/api/reference-assets/preview.mp3", sampleAssetId: "permanent/audio/preview.mp3" });
    });

    it("keeps Clone unavailable until the provider has a complete sample template", async () => {
        mocks.settings.mockResolvedValue(settings("voice-clone", { audioOperation: "voice-clone", requestTemplate: '{"model":"{{model}}"}', cloneSampleField: "audio" }));
        mocks.readAsset.mockResolvedValue({ size: 1_024, mimeType: "audio/mpeg", registration: { ownerUserId: "user-one" } });
        const source = project();
        await expect(createDramaVoiceCreationTask({ userId: "user-one", project: source, character: source.characters[0], mode: "clone", sampleAssetId: "permanent/audio/sample.mp3", requestId: "clone-one", origin: "https://vozeb.example" })).rejects.toThrow("未配置完整的样本音频请求模板");
        expect(mocks.createTask).not.toHaveBeenCalled();
    });
});

function settings(model = "voice-design", override: Record<string, unknown> = {}) {
    const config = { capability: "audio" as const, audioOperation: model === "voice-clone" ? "voice-clone" as const : "voice-design" as const, createPath: "/v1/media/generate", requestTemplate: '{"model":"{{model}}","prompt":"{{design_prompt}}"}', voiceIdField: "voice_id", previewAudioField: "trial_audio", ...override };
    return {
        defaultModels: { textModel: "", imageModel: "", videoModel: "", audioModel: "", voiceDesignModel: model === "voice-design" ? model : "", voiceCloneModel: model === "voice-clone" ? model : "" },
        logicalModels: [{ id: model, name: model, capability: "audio", enabled: true, bindings: [{ id: "binding", channelId: "channel-one", upstreamModel: model, enabled: true, priority: 1 }] }],
        systemChannels: [{ id: "channel-one", name: "Voice", baseUrl: "https://provider.example", apiKey: "secret", apiFormat: "openai", models: [model], enabled: true, advancedConfig: { protocol: "custom", modelConfigs: { [model]: config } } }],
    };
}

function project(voiceId = "", profile: Record<string, unknown> = {}): DramaProject {
    return {
        id: "project-one",
        title: "项目",
        summary: "",
        style: "",
        ratio: "16:9",
        status: "active",
        defaultVideoMode: "storyboard",
        characters: [{ id: "character-one", name: "Karin", description: "18岁男性，冷静克制", profile: { visualIdentity: "年轻男性", styling: "", colorPalette: "", consistencyRules: "" }, voiceProfile: { voiceId, speed: 1, instructions: "", ...profile } }],
        scenes: [],
        props: [],
        clues: [],
        episodes: [],
        sourceAssets: [],
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T00:00:00.000Z",
    };
}

function task(status: "pending" | "success" = "pending") {
    return { id: "voice-task-one", userId: "user-one", status, createdAt: 1, updatedAt: 1, config: { baseUrl: "/api/ai/system/channel-one", apiKey: "system", apiFormat: "openai" as const, model: "voice-design", logicalModel: "voice-design", channelId: "channel-one", advancedConfig: { protocol: "custom" } }, prompt: "角色 Karin 的新声纹设计", candidateConfigs: [] };
}
