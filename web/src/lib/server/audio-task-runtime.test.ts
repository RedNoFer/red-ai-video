import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/safe-outbound-fetch", () => ({ fetchSafeOutbound: (url: string | URL, init?: RequestInit) => fetch(url, init) }));
vi.mock("@/lib/server/generation-media-authorization", () => ({ generationMediaProxyHeaders: vi.fn(() => ({ "x-media-auth": "signed" })) }));

const mocks = vi.hoisted(() => ({
    getTask: vi.fn(),
    updateTask: vi.fn(),
    transitionTask: vi.fn(),
    schedule: vi.fn(),
    register: vi.fn(),
    writeMedia: vi.fn(),
}));

vi.mock("@/lib/auth/store", () => ({ getAuthSettings: vi.fn(), refundUserPoints: vi.fn() }));
vi.mock("@/lib/server/audio-task-store", () => ({
    getAudioTask: mocks.getTask,
    updateAudioTask: mocks.updateTask,
    transitionAudioTask: mocks.transitionTask,
}));
vi.mock("@/lib/server/creative-runtime-service", () => ({ registerGenerationTaskAssetsForUser: mocks.register }));
vi.mock("@/lib/server/generation-task-scheduler", () => ({ scheduleGenerationTask: mocks.schedule }));
vi.mock("@/lib/server/reference-asset-store", () => ({ writePersistentMediaDataUrl: mocks.writeMedia }));

import { createProtocolFixtureServer } from "../../../scripts/protocol-fixture-server.mjs";
import { GenerationSubmissionSafeFailure, GenerationSubmissionUncertainError } from "./generation-submission-error";
import { createAudioTaskUpstreamStep, persistAudioTaskResult } from "./audio-task-runtime";
import type { AudioTask } from "./audio-task-store";
import { emptyAdvancedConfig, protocolModelConfig, registeredChannelProtocolDefinitions } from "@/lib/channel-protocol-registry";

const AUDIO_PROTOCOLS = registeredChannelProtocolDefinitions.filter((definition) => definition.capabilities.includes("audio"));

describe("audio task runtime submission safety", () => {
    let state: AudioTask;

    beforeEach(() => {
        vi.clearAllMocks();
        state = audioTask();
        mocks.getTask.mockImplementation(async () => state);
        mocks.updateTask.mockImplementation(async (_id: string, patch: Partial<AudioTask>) => {
            state = { ...state, ...patch };
            return state;
        });
        mocks.transitionTask.mockImplementation(async (_task: AudioTask, allowed: string[], patch: Partial<AudioTask>) => {
            if (!allowed.includes(state.status)) return null;
            state = { ...state, ...patch };
            return state;
        });
        mocks.writeMedia.mockResolvedValue({ token: "fixture-audio", url: "/api/reference-assets/fixture-audio.wav" });
        mocks.register.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("switches to the next channel after a deterministic 422 rejection", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(Response.json({ error: { message: "参数不受支持" } }, { status: 422 }))
            .mockResolvedValueOnce(Response.json({ audio_url: "https://cdn.example/result.mp3" }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(createAudioTaskUpstreamStep(state, "http://internal")).resolves.toMatchObject({
            state: "result_ready",
            resultUrl: "https://cdn.example/result.mp3",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(state.config.channelId).toBe("channel-two");
        expect(state.candidateConfigs).toEqual([]);
        expect(state.attempts?.map(({ status }) => status)).toEqual(["failed", "running"]);
        expect(mocks.schedule).toHaveBeenLastCalledWith(
            "audio",
            "audio-one",
            expect.objectContaining({ executionPhase: "result_ready", channelId: "channel-two", resultPayload: { url: "https://cdn.example/result.mp3" }, lastUpstreamStatus: "completed" }),
        );
    });

    it("persists an asynchronous upstream task identity before returning", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ id: "audio-upstream-one" })));

        await expect(createAudioTaskUpstreamStep(state, "http://internal")).resolves.toMatchObject({ state: "pending", upstreamTaskId: "audio-upstream-one" });

        expect(state.upstream).toEqual({ id: "audio-upstream-one", createPath: "/audio/speech" });
        expect(mocks.schedule).toHaveBeenLastCalledWith("audio", "audio-one", expect.objectContaining({ executionPhase: "submitted", upstreamTaskId: "audio-upstream-one", channelId: "channel-one", lastUpstreamStatus: "submitted" }));
    });

    it("does not persist an HTML fallback page as generated audio", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response("<!doctype html><html><body>fallback</body></html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }))
            .mockResolvedValueOnce(Response.json({ audio_url: "https://cdn.example/result.mp3" }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(createAudioTaskUpstreamStep(state, "http://internal")).resolves.toMatchObject({ state: "result_ready", resultUrl: "https://cdn.example/result.mp3" });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(mocks.writeMedia).not.toHaveBeenCalled();
        expect(state.attempts?.map(({ status }) => status)).toEqual(["failed", "running"]);
    });

    it("downloads a remote result before storing the local playback URL", async () => {
        const remoteAudio = Buffer.from("UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=", "base64");
        const fetchMock = vi.fn().mockResolvedValue(new Response(remoteAudio, { status: 200, headers: { "content-type": "audio/wav" } }));
        vi.stubGlobal("fetch", fetchMock);
        state.config.baseUrl = "https://provider.example";

        const completed = await persistAudioTaskResult(state, "http://internal", "https://cdn.example/preview.wav");

        expect(completed).toMatchObject({ status: "success", result: { url: "/api/reference-assets/fixture-audio.wav", mimeType: "audio/wav" } });
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(mocks.writeMedia).toHaveBeenCalledWith(expect.stringMatching(/^data:audio\/wav;base64,/), "audio", expect.objectContaining({ ownerUserId: "user-one", taskId: "audio-one" }));
    });

    it("persists hex-encoded trial audio from voice design style responses", async () => {
        const remoteAudio = Buffer.from("UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=", "base64");
        const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ voice_id: "custom-voice-one", trial_audio: remoteAudio.toString("hex") }));
        vi.stubGlobal("fetch", fetchMock);
        state.config.format = "wav";
        state.config.voiceOperation = "voice-design";
        state.config.advancedConfig = { ...(state.config.advancedConfig || {}), voiceIdField: "voice_id", previewAudioField: "trial_audio" } as never;
        state.candidateConfigs = [];

        await expect(createAudioTaskUpstreamStep(state, "http://internal")).resolves.toEqual({ state: "completed" });

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(mocks.writeMedia).toHaveBeenCalledWith(expect.stringMatching(/^data:audio\/wav;base64,/), "audio", expect.objectContaining({ ownerUserId: "user-one", taskId: "audio-one" }));
        expect(state).toMatchObject({ status: "success", result: { url: "/api/reference-assets/fixture-audio.wav", mimeType: "audio/wav", voiceId: "custom-voice-one" } });
    });

    it("retains voice_id while a remote trial audio waits for persistence", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ voice_id: "custom-voice-one", trial_audio: "https://cdn.example/trial.wav" })));
        state.config.voiceOperation = "voice-design";
        state.config.advancedConfig = { ...(state.config.advancedConfig || {}), voiceIdField: "voice_id", previewAudioField: "trial_audio" } as never;
        state.candidateConfigs = [];

        await expect(createAudioTaskUpstreamStep(state, "http://internal")).resolves.toMatchObject({ state: "result_ready", resultUrl: "https://cdn.example/trial.wav", voiceId: "custom-voice-one" });
        expect(mocks.schedule).toHaveBeenLastCalledWith("audio", "audio-one", expect.objectContaining({ resultPayload: { url: "https://cdn.example/trial.wav", voiceId: "custom-voice-one" } }));
    });

    it("rejects a Voice Design result without voice_id before it can replace a role voice", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ trial_audio: "00".repeat(32) })));
        state.config.voiceOperation = "voice-design";
        state.config.advancedConfig = { ...(state.config.advancedConfig || {}), voiceIdField: "voice_id", previewAudioField: "trial_audio" } as never;
        state.candidateConfigs = [];

        await expect(createAudioTaskUpstreamStep(state, "http://internal")).resolves.toMatchObject({ state: "failed", error: expect.stringContaining("声纹创建接口未返回 voice_id") });
        expect(mocks.writeMedia).not.toHaveBeenCalled();
    });

    it("treats a missing remote result as a permanent audio failure", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "404 page not found" }), { status: 404, headers: { "content-type": "application/json" } })));
        state.config.baseUrl = "https://provider.example";

        await expect(persistAudioTaskResult(state, "http://internal", "https://cdn.example/missing.wav")).rejects.toMatchObject({
            name: "GenerationSubmissionSafeFailure",
            status: 404,
            message: "音频结果下载失败：404 page not found",
        });
        expect(mocks.writeMedia).not.toHaveBeenCalled();
    });

    it.each(AUDIO_PROTOCOLS)("receives an audio response from the $id protocol over a local TCP interface", async (definition) => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const custom = definition.id === "custom";
        const advancedConfig = custom
            ? {
                  ...emptyAdvancedConfig(),
                  protocol: "custom" as const,
                  createPath: "/custom/audio",
                  requestTemplate: '{"deployment":"{{model}}","content":"{{input}}","speaker":"{{voice}}","rate":"{{speed}}"}',
                  resultField: "data.audio_url",
              }
            : { ...emptyAdvancedConfig(), ...(protocolModelConfig(definition.id, "audio") || { protocol: definition.id }) };
        state = {
            ...audioTask(),
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: `${definition.id}-audio`,
                channelId: `fixture-${definition.id}-audio`,
                voice: custom ? "nova" : "alloy",
                format: "wav",
                speed: custom ? "1.25" : "1",
                advancedConfig,
            },
            candidateConfigs: [],
        };

        try {
            const result = await createAudioTaskUpstreamStep(state, "http://internal");
            if (custom) {
                expect(result).toMatchObject({ state: "result_ready", resultUrl: expect.stringContaining("/media/fixture.wav") });
                expect(JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}")).toEqual({ deployment: "custom-audio", content: "test", speaker: "nova", rate: 1.25 });
            } else {
                expect(result).toEqual({ state: "completed" });
                expect(state).toMatchObject({ status: "success", result: { url: "/api/reference-assets/fixture-audio.wav", mimeType: "audio/wav" } });
                expect(mocks.writeMedia).toHaveBeenCalledWith(expect.stringMatching(/^data:audio\/wav;base64,UklGR/), "audio", expect.objectContaining({ ownerUserId: "user-one", taskId: "audio-one" }));
                expect(mocks.register).toHaveBeenCalledOnce();
            }
            const expectedPath = custom ? "/custom/audio" : definition.id === "openai-audio-dialogue" ? "/chat/completions" : "/audio/speech";
            expect(fixture.requests[0]).toMatchObject({ method: "POST", path: expectedPath });
            if (definition.id === "openai-audio-dialogue") {
                expect(JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}")).toMatchObject({ modalities: ["text", "audio"], audio: { voice: "alloy", format: "wav" } });
            }
            expect(fixture.requests[0]?.headers.authorization).toBe("Bearer fixture-key");
            expect(fixture.requests[0]?.headers["idempotency-key"]).toBe("audio-task:audio-one:attempt:1");
            expect(fixture.requests[0]?.headers["x-client-request-id"]).toBe("audio-task:audio-one:attempt:1");
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error) => (error ? reject(error) : resolve())));
        }
    });

    it("keeps the original candidate when the request connection is interrupted", async () => {
        const fetchMock = vi.fn().mockRejectedValueOnce(new Error("socket closed"));
        vi.stubGlobal("fetch", fetchMock);

        await expect(createAudioTaskUpstreamStep(state, "http://internal")).rejects.toBeInstanceOf(GenerationSubmissionUncertainError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(state.config.channelId).toBe("channel-one");
        expect(state.candidateConfigs).toHaveLength(1);
        expect(state.attempts?.map(({ status }) => status)).toEqual(["running"]);
    });

    it("treats a successful response with invalid JSON as an uncertain submission", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("not-json", { status: 200, headers: { "content-type": "application/json" } })));

        await expect(createAudioTaskUpstreamStep(state, "http://internal")).rejects.toBeInstanceOf(GenerationSubmissionUncertainError);
        expect(state.config.channelId).toBe("channel-one");
    });

    it("parses a Responses output_audio payload without using the speech endpoint", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        state = {
            ...audioTask(),
            config: {
                ...audioTask().config,
                baseUrl: `http://127.0.0.1:${address.port}`,
                advancedConfig: {
                    protocol: "openai-audio-dialogue",
                    createPath: "/responses",
                    requestTemplate: '{"model":"{{model}}","input":"{{prompt}}","modalities":["text","audio"],"audio":{"voice":"{{voice}}","format":"{{format}}"}}',
                    resultField: "output[0].content[0].audio",
                } as never,
            },
            candidateConfigs: [],
        };
        try {
            await expect(createAudioTaskUpstreamStep(state, "http://internal")).resolves.toEqual({ state: "completed" });
            expect(state).toMatchObject({ status: "success", result: { mimeType: "audio/wav", assetId: "fixture-audio" } });
            expect(fixture.requests[0]).toMatchObject({ method: "POST", path: "/responses" });
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error) => (error ? reject(error) : resolve())));
        }
    });

    it("does not guess a Chat/Responses polling URL when the provider returns only an ID", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ id: "resp_123" }));
        vi.stubGlobal("fetch", fetchMock);
        state = {
            ...audioTask(),
            config: {
                ...audioTask().config,
                advancedConfig: {
                    protocol: "openai-audio-dialogue",
                    createPath: "/chat/completions",
                    requestTemplate: '{"model":"{{model}}","messages":[{"role":"user","content":"{{prompt}}"}],"modalities":["text","audio"],"audio":{"voice":"{{voice}}","format":"{{format}}"}}',
                    resultField: "choices[0].message.audio",
                } as never,
            },
            candidateConfigs: [],
        };

        await expect(createAudioTaskUpstreamStep(state, "http://internal")).rejects.toThrow("未配置官方查询路径");
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(state.upstream).toBeUndefined();
    });
});

function audioTask(): AudioTask {
    const second = { baseUrl: "https://two.example", apiKey: "two", apiFormat: "openai" as const, model: "audio-two", channelId: "channel-two", voice: "alloy", format: "mp3", speed: "1" };
    return {
        id: "audio-one",
        userId: "user-one",
        status: "pending",
        createdAt: 1,
        updatedAt: 1,
        config: { baseUrl: "https://one.example", apiKey: "one", apiFormat: "openai", model: "audio-one", channelId: "channel-one", voice: "alloy", format: "mp3", speed: "1" },
        candidateConfigs: [second],
        prompt: "test",
    };
}
