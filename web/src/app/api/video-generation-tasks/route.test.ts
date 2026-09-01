import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    after: vi.fn(),
    fetchInternalApi: vi.fn(),
    createVideoTask: vi.fn(),
    claimVideoTaskPoll: vi.fn(),
    completeReconciledVideoTask: vi.fn(),
    failReconciledVideoTask: vi.fn(),
    getAuthSettings: vi.fn(),
    getVideoTask: vi.fn(),
    linkStoredGenerationTask: vi.fn(),
    getStoredGenerationTaskByRequest: vi.fn(),
    touchVideoTask: vi.fn(),
    transitionVideoTask: vi.fn(),
    updateVideoTask: vi.fn(),
    writeVideoGenerationLog: vi.fn(),
    scheduleGenerationTask: vi.fn(),
    withGenerationConcurrencyLimit: vi.fn(async (_userId, _type, _staleMs, _limit, handler) => handler()),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof import("next/server")>();
    return { ...actual, after: mocks.after };
});
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => ({ id: "user", pointsBalance: 100 })) }));
vi.mock("@/lib/auth/store", () => {
    class AuthInputError extends Error {
        status = 400;
    }
    return { AuthInputError, getAuthSettings: mocks.getAuthSettings, isAuthInputError: (error: unknown) => error instanceof AuthInputError, refundUserPoints: vi.fn() };
});
vi.mock("@/lib/server/internal-origin", () => ({ fetchInternalApi: mocks.fetchInternalApi, resolveInternalOrigin: vi.fn(() => "http://localhost") }));
vi.mock("@/lib/server/generation-task-store", () => ({
    withGenerationConcurrencyLimit: mocks.withGenerationConcurrencyLimit,
    linkStoredGenerationTask: mocks.linkStoredGenerationTask,
    getStoredGenerationTaskByRequest: mocks.getStoredGenerationTaskByRequest,
}));
vi.mock("@/lib/server/security", () => ({
    checkGenerationRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })),
    rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock("@/lib/server/generation-task-recovery-service", () => ({ runGenerationTaskRecoveryBatch: vi.fn() }));
vi.mock("@/lib/server/generation-task-scheduler", () => ({ scheduleGenerationTask: mocks.scheduleGenerationTask }));
vi.mock("@/lib/server/video-task-log", () => ({ writeVideoGenerationLog: mocks.writeVideoGenerationLog }));
vi.mock("@/lib/server/video-task-store", () => ({
    createVideoTask: mocks.createVideoTask,
    claimVideoTaskPoll: mocks.claimVideoTaskPoll,
    completeReconciledVideoTask: mocks.completeReconciledVideoTask,
    failReconciledVideoTask: mocks.failReconciledVideoTask,
    getVideoTask: mocks.getVideoTask,
    touchVideoTask: mocks.touchVideoTask,
    transitionVideoTask: mocks.transitionVideoTask,
    updateVideoTask: mocks.updateVideoTask,
}));

import { POST } from "./route";
import { resetChannelRuntimeHealth } from "@/lib/server/channel-runtime-health";
import { applyChannelProtocol } from "@/lib/channel-protocol-registry";
import { emptyAdvancedConfig } from "@/lib/channel-protocol-registry";

const channels = [
    { id: "one", name: "主渠道", baseUrl: "https://one.example.com/v1", apiKey: "one-secret", apiFormat: "openai", models: ["video-one"], enabled: true, advancedConfig: { protocol: "openai" } },
    { id: "two", name: "备用渠道", baseUrl: "https://two.example.com/v1", apiKey: "two-secret", apiFormat: "openai", models: ["video-two"], enabled: true, advancedConfig: { protocol: "openai" } },
] as const;

const settings = {
    systemChannels: channels,
    logicalModels: [
        {
            id: "video",
            name: "Video",
            capability: "video",
            enabled: true,
            bindings: [
                { id: "one", channelId: "one", upstreamModel: "video-one", enabled: true, priority: 1 },
                { id: "two", channelId: "two", upstreamModel: "video-two", enabled: true, priority: 2 },
            ],
        },
    ],
    defaultModels: { videoModel: "video" },
    generationConcurrency: { video: 2 },
    generationDefaults: { imageSize: "16:9", videoQuality: "720", videoSeconds: 5 },
    generationPointMultipliers: { videoQuality: { "720": 1 }, videoSeconds: { "5": 1 } },
};

describe("video generation candidate failover", () => {
    let storedTask: Record<string, unknown> | undefined;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fetchInternalApi.mockReset();
        resetChannelRuntimeHealth();
        mocks.getAuthSettings.mockResolvedValue(settings);
        storedTask = undefined;
        mocks.createVideoTask.mockImplementation(async (input) => {
            storedTask = { ...input, id: "local-task", status: "running", createdAt: Date.now(), updatedAt: Date.now() };
            return storedTask;
        });
        mocks.getVideoTask.mockImplementation(async () => storedTask);
        mocks.claimVideoTaskPoll.mockImplementation(async () => storedTask);
        mocks.after.mockImplementation(() => undefined);
    });

    it("tries the next binding after explicit route failures", async () => {
        const startedAt = Date.now();
        mocks.fetchInternalApi.mockImplementation(async (url: string) => (url.includes("/api/ai/system/one/") ? json({ error: "not found" }, 404) : json({ id: "upstream-two", status: "queued" })));

        const response = await POST(request());
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.task).toMatchObject({ id: "local-task", model: "video", upstreamId: "upstream-two" });
        expect(mocks.fetchInternalApi.mock.calls.some(([url]) => String(url).includes("/api/ai/system/one/"))).toBe(true);
        expect(mocks.fetchInternalApi.mock.calls.some(([url]) => String(url).includes("/api/ai/system/two/"))).toBe(true);
        const submittingSchedules = mocks.scheduleGenerationTask.mock.calls.filter(([, , patch]) => patch.executionPhase === "submitting");
        expect(submittingSchedules).toHaveLength(2);
        expect(submittingSchedules.every(([, , patch]) => patch.nextPollAt >= startedAt + 30 * 60_000)).toBe(true);
    });

    it("returns the original idempotent task before checking concurrency", async () => {
        mocks.getStoredGenerationTaskByRequest.mockResolvedValueOnce({
            id: "existing-task",
            status: "running",
            config: { model: "video-one", logicalModelId: "video" },
            upstream: { id: "existing-upstream" },
        });

        const response = await POST(request({ model: "video" }, [], { clientRequestId: "same-request", attemptNo: 2 }));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ task: { id: "existing-task", upstreamId: "existing-upstream" } });
        expect(mocks.getStoredGenerationTaskByRequest).toHaveBeenCalledWith("video", "user", "same-request", 2);
        expect(mocks.getAuthSettings).not.toHaveBeenCalled();
        expect(mocks.withGenerationConcurrencyLimit).not.toHaveBeenCalled();
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("does not retry another binding after an ambiguous 2xx response", async () => {
        mocks.fetchInternalApi.mockResolvedValue(new Response("not-json", { status: 200 }));

        const response = await POST(request());

        expect(response.status).toBe(202);
        expect(mocks.fetchInternalApi.mock.calls.some(([url]) => String(url).includes("/api/ai/system/two/"))).toBe(false);
        expect(mocks.createVideoTask).toHaveBeenCalledOnce();
        expect(mocks.scheduleGenerationTask).toHaveBeenLastCalledWith("video", "local-task", expect.objectContaining({ executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "submission_outcome_unknown" }));
    });

    it("does not retry another path or binding after an ambiguous server failure", async () => {
        mocks.fetchInternalApi.mockResolvedValue(json({ error: "gateway failed" }, 502));

        const response = await POST(request());

        expect(response.status).toBe(202);
        expect(mocks.fetchInternalApi).toHaveBeenCalledTimes(1);
        expect(mocks.fetchInternalApi.mock.calls.some(([url]) => String(url).includes("/api/ai/system/two/"))).toBe(false);
        expect(mocks.createVideoTask).toHaveBeenCalledOnce();
    });

    it("surfaces an explicit HTTP 200 business failure after safe candidate fallback", async () => {
        mocks.fetchInternalApi.mockImplementation(async () => json({ code: "204", msg: "登录验证失败" }));

        const response = await POST(request());

        expect(response.status).toBe(502);
        expect((await response.json()).error).toBe("登录验证失败");
        expect(mocks.createVideoTask).toHaveBeenCalledOnce();
    });

    it("enqueues a GlobalAiOpc task for the recovery worker after creation", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [{ ...channels[0], advancedConfig: { protocol: "globalaiopc", globalAiOpcPreset: "video-videos" } }],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [settings.logicalModels[0].bindings[0]] }],
        });
        mocks.fetchInternalApi.mockResolvedValueOnce(json({ id: "global-video-task", status: "queued" }));

        const response = await POST(request());

        expect(response.status).toBe(200);
        expect(mocks.scheduleGenerationTask).toHaveBeenLastCalledWith("video", "local-task", expect.objectContaining({ executionPhase: "submitted", upstreamTaskId: "global-video-task" }));
        expect(mocks.after).toHaveBeenCalledWith(expect.any(Function));
    });

    it("uses the backend default logical model when the client omits a model", async () => {
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "upstream-default", status: "queued" }));

        const response = await POST(request({}));

        expect(response.status).toBe(200);
        expect((await response.json()).task.model).toBe("video");
    });

    it("creates a Gemini Veo long-running operation with the native request contract", async () => {
        mocks.getAuthSettings.mockResolvedValue(geminiSettings());
        mocks.fetchInternalApi.mockResolvedValue(json({ name: "models/veo-3.1-generate-preview/operations/gemini-operation-one", done: false }));

        const response = await POST(request({ model: "gemini-video", videoSeconds: 5, size: "16:9", vquality: "720" }));
        const [url, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];
        const payload = JSON.parse(String(init.body));

        expect(response.status).toBe(200);
        expect(url).toContain("/api/ai/system/gemini/models/veo-3.1-generate-preview:predictLongRunning");
        expect(payload).toEqual({
            instances: [{ prompt: "A test video" }],
            parameters: { durationSeconds: 6, aspectRatio: "16:9", resolution: "720p", generateAudio: true },
        });
        expect(mocks.scheduleGenerationTask).toHaveBeenLastCalledWith(
            "video",
            "local-task",
            expect.objectContaining({
                executionPhase: "submitted",
                upstreamTaskId: "gemini-operation-one",
                queryPath: "/models/veo-3.1-generate-preview/operations/gemini-operation-one",
            }),
        );
        expect((await response.json()).task.durationSeconds).toBe(6);
    });

    it("rejects Gemini reference video and audio before creating an operation", async () => {
        mocks.getAuthSettings.mockResolvedValue(geminiSettings());

        const response = await POST(request({ model: "gemini-video" }, [{ type: "video", url: "https://cdn.example.com/reference.mp4" }]));

        expect(response.status).toBe(400);
        expect((await response.json()).error).toContain("参考视频");
        expect(mocks.createVideoTask).not.toHaveBeenCalled();
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("forwards the authenticated maintenance worker identity to the internal system proxy", async () => {
        const token = "maintenance-token-used-by-generation-worker";
        vi.stubEnv("VOZEB_PRO_MAINTENANCE_TOKEN", `${token}-maintenance`);
        vi.stubEnv("VOZEB_PRO_WORKER_TOKEN", token);
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "upstream-worker", status: "queued" }));

        const response = await POST(
            new Request("http://localhost/api/video-generation-tasks", {
                method: "POST",
                headers: {
                    authorization: `Bearer ${token}`,
                    "content-type": "application/json",
                    "x-vozeb-pro-worker-user-id": "user",
                },
                body: JSON.stringify({ config: { model: "video" }, prompt: "A test video", references: [] }),
            }),
        );
        const headers = new Headers((mocks.fetchInternalApi.mock.calls[0]?.[1] as RequestInit).headers);

        expect(response.status).toBe(200);
        expect(headers.get("authorization")).toBe(`Bearer ${token}`);
        expect(headers.get("x-vozeb-pro-worker-user-id")).toBe("user");
        expect(headers.has("cookie")).toBe(false);
        vi.unstubAllEnvs();
    });

    it("uses the SD2.0 model route without affecting OpenAI models on the same channel", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [
                {
                    ...channels[0],
                    models: ["openai-text", "sd2.0"],
                    advancedConfig: {
                        protocol: "auto",
                        createPath: "/wrong-channel-path",
                        modelConfigs: { "sd2.0": { capability: "video", protocol: "seedance", createPath: "/sd2/videos", queryPath: "/sd2/videos/:task_id" } },
                    },
                },
            ],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [{ ...settings.logicalModels[0].bindings[0], upstreamModel: "sd2.0" }] }],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "upstream-sd2", status: "queued" }));

        const response = await POST(request());

        expect(response.status).toBe(200);
        expect(mocks.fetchInternalApi.mock.calls[0][0]).toContain("/api/ai/system/one/sd2/videos");
    });

    it("uses separate text-to-video and image-to-video paths with trusted billing headers", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [
                {
                    ...channels[0],
                    advancedConfig: {
                        protocol: "custom",
                        modelConfigs: {
                            "video-one": {
                                capability: "video",
                                protocol: "custom",
                                createPath: "/text-to-video",
                                imageToVideoPath: "/image-to-video",
                                requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","images":"{{images}}"}',
                                resultField: "id",
                                supportsReferenceImage: true,
                            },
                        },
                    },
                },
            ],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [settings.logicalModels[0].bindings[0]] }],
        });
        mocks.fetchInternalApi.mockImplementation(async () => json({ id: "upstream-custom", status: "queued" }));

        const textResponse = await POST(request({ model: "video" }, [], { clientRequestId: "video-text" }));
        const imageResponse = await POST(request({ model: "video" }, [{ type: "image", url: "https://cdn.example.com/reference.jpg" }], { clientRequestId: "video-image" }));
        const imagePayload = await imageResponse.clone().json();
        const [textUrl, textInit] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];
        const [imageUrl, imageInit] = mocks.fetchInternalApi.mock.calls[1] as [string, RequestInit];
        const textHeaders = new Headers(textInit.headers);
        const imageHeaders = new Headers(imageInit.headers);

        expect(textResponse.status).toBe(200);
        expect(imageResponse.status, JSON.stringify(imagePayload)).toBe(200);
        expect(textUrl).toContain("/api/ai/system/one/text-to-video");
        expect(imageUrl).toContain("/api/ai/system/one/image-to-video");
        expect(textHeaders.get("x-vozeb-pro-logical-model")).toBe("video");
        expect(textHeaders.get("x-vozeb-pro-upstream-model")).toBe("video-one");
        expect(textHeaders.get("x-vozeb-pro-points-idempotency-key")).toBe("video-request:video-text");
        expect(imageHeaders.get("x-vozeb-pro-points-idempotency-key")).toBe("video-request:video-image");
    });

    it("builds an OpenAI video multipart request and uses its image-to-video path", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [
                {
                    ...channels[0],
                    advancedConfig: {
                        protocol: "openai",
                        modelConfigs: {
                            "video-one": {
                                capability: "video",
                                protocol: "openai",
                                createPath: "/videos",
                                imageToVideoPath: "/videos",
                                queryPath: "/videos/:task_id",
                                requestTemplate: "multipart/form-data: model、prompt、seconds、size、input_reference",
                                resultField: "/videos/:task_id/content",
                                statusField: "status",
                                supportsReferenceImage: true,
                            },
                        },
                    },
                },
            ],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [settings.logicalModels[0].bindings[0]] }],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "upstream-openai", status: "queued" }));
        const reference = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

        const response = await POST(request({ model: "video", videoSeconds: "5", size: "16:9" }, [{ type: "image", url: reference }]));
        const [url, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];
        const body = init.body as FormData;

        expect(response.status).toBe(200);
        expect(url).toContain("/api/ai/system/one/videos");
        expect(init.body).toBeInstanceOf(FormData);
        expect(new Headers(init.headers).has("content-type")).toBe(false);
        expect(body.get("model")).toBe("video-one");
        expect(body.get("seconds")).toBe("5");
        expect(body.get("size")).toBe("1280x720");
        expect(body.get("input_reference")).toBeInstanceOf(File);
    });

    it("persists the Drama project, episode and shot task context", async () => {
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "upstream-drama", status: "queued" }));
        const context = { surface: "drama", projectId: "drama-one", episodeId: "episode-one", shotId: "shot-one", estimatedPoints: 8, attemptNo: 2, clientRequestId: "drama-video:one" };

        const response = await POST(request({ model: "video" }, [], context));

        expect(response.status).toBe(200);
        expect(mocks.createVideoTask).toHaveBeenCalledWith(expect.objectContaining(context));
        expect(mocks.linkStoredGenerationTask).toHaveBeenCalledWith("video", "local-task", context);
    });

    it("rejects a raw upstream model when the logical catalog exists", async () => {
        const response = await POST(request({ model: "video-one" }));

        expect(response.status).toBe(400);
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("rejects an image logical model for a video task", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [...channels, { id: "image", name: "图片渠道", baseUrl: "https://image.example.com/v1", apiKey: "image-secret", apiFormat: "openai", models: ["stable-diffusion-2.0"], enabled: true, advancedConfig: { protocol: "openai" } }],
            logicalModels: [
                ...settings.logicalModels,
                {
                    id: "stable-diffusion-2.0",
                    name: "Stable Diffusion",
                    capability: "image",
                    enabled: true,
                    bindings: [{ id: "image-binding", channelId: "image", upstreamModel: "stable-diffusion-2.0", enabled: true, priority: 1 }],
                },
            ],
        });

        const response = await POST(request({ model: "stable-diffusion-2.0" }));

        expect(response.status).toBe(400);
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("sends a compatible image-to-video request with the real reference and current parameters", async () => {
        mocks.getAuthSettings.mockResolvedValue(publicUrlCompatibleSettings());
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "upstream-image-video", status: "queued" }));

        const response = await POST(request({ model: "video", videoSeconds: "10", size: "9:16", vquality: "1080" }, [{ type: "image", url: "https://cdn.example.com/reference.jpg" }]));
        const init = mocks.fetchInternalApi.mock.calls[0]?.[1] as RequestInit;
        const upstreamBody = JSON.parse(String(init.body));

        expect(response.status).toBe(200);
        expect(upstreamBody).toMatchObject({ model: "video-one", duration: 10, ratio: "9:16", image: "https://cdn.example.com/reference.jpg" });
        expect(upstreamBody.prompt).toContain("A test video");
        expect(upstreamBody.prompt).toContain("将参考图作为首帧、主体身份、外观和场景的主要依据");
        expect(upstreamBody.prompt).toContain("禁止替换主体");
        expect(upstreamBody.images).toEqual(["https://cdn.example.com/reference.jpg"]);
    });

    it("sends the New API video request body to the documented videos endpoint", async () => {
        mocks.getAuthSettings.mockResolvedValue(newApiVideoSettings());
        mocks.fetchInternalApi.mockResolvedValue(json({ task_id: "newapi-video-task", status: "queued" }));

        const response = await POST(request({ model: "seedance-2.5", videoSeconds: "5", size: "1280x720" }, [{ type: "image", url: "https://cdn.example.com/reference.jpg" }]));
        const [url, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];

        expect(response.status).toBe(200);
        expect(url).toContain("/api/ai/system/one/v1/videos");
        expect(JSON.parse(String(init.body))).toMatchObject({
            model: "seedance-2.5",
            prompt: expect.stringContaining("A test video"),
            duration: 5,
            ratio: "16:9",
            resolution: "720p",
            referenceImages: ["https://cdn.example.com/reference.jpg"],
        });
        expect(JSON.parse(String(init.body))).not.toHaveProperty("image");
        expect(JSON.parse(String(init.body))).not.toHaveProperty("width");
        expect(JSON.parse(String(init.body))).not.toHaveProperty("height");
        expect(JSON.parse(String(init.body)).prompt).toContain("参考素材一致性要求");
    });

    it.each([
        ["不鸣", 1, 2, "/api/ai/system/buming/v1/videos/generations"],
        ["New API", 2, 1, "/api/ai/system/newapi-video/v1/videos"],
    ] as const)("uses the %s protocol selected by logical-model binding priority", async (_label, bumingPriority, newApiPriority, expectedPath) => {
        const bumingChannel = applyChannelProtocol({ ...channels[0], id: "buming", name: "不鸣", baseUrl: "", models: ["wan-3.0"], advancedConfig: emptyAdvancedConfig() }, "buming-seedance");
        const newApiChannel = applyChannelProtocol({ ...channels[1], id: "newapi-video", name: "New API 视频", baseUrl: "", models: ["wan-3.0"], advancedConfig: emptyAdvancedConfig() }, "newapi-video");
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [bumingChannel, newApiChannel],
            logicalModels: [{ id: "wan-3.0", name: "Wan 3.0", capability: "video", enabled: true, bindings: [
                { id: "buming-binding", channelId: "buming", upstreamModel: "wan-3.0", enabled: true, priority: bumingPriority },
                { id: "newapi-binding", channelId: "newapi-video", upstreamModel: "wan-3.0", enabled: true, priority: newApiPriority },
            ] }],
            defaultModels: { ...settings.defaultModels, videoModel: "wan-3.0" },
        });
        mocks.fetchInternalApi.mockImplementation(async (url: string) => url.includes("/buming/") ? json({ id: "buming-task", state: "queued" }) : json({ task_id: "newapi-task", status: "queued" }));

        const response = await POST(request({ model: "wan-3.0" }));

        expect(response.status).toBe(200);
        expect(mocks.fetchInternalApi).toHaveBeenCalledTimes(1);
        expect(mocks.fetchInternalApi.mock.calls[0]?.[0]).toContain(expectedPath);
    });

    it("sends New API reference media as the documented plural URL arrays", async () => {
        mocks.getAuthSettings.mockResolvedValue(newApiVideoSettings());
        mocks.fetchInternalApi.mockResolvedValue(json({ task_id: "newapi-video-task", status: "queued" }));

        const response = await POST(
            request({ model: "seedance-2.5", videoSeconds: "8", size: "9:16", vquality: "1080" }, [
                { type: "image", url: "https://cdn.example.com/reference-1.jpg" },
                { type: "image", url: "https://cdn.example.com/reference-2.jpg" },
                { type: "video", url: "https://cdn.example.com/reference.mp4" },
                { type: "audio", url: "https://cdn.example.com/reference.mp3" },
            ]),
        );
        const body = JSON.parse(String((mocks.fetchInternalApi.mock.calls[0]?.[1] as RequestInit).body));

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            duration: 8,
            ratio: "9:16",
            resolution: "1080p",
            referenceImages: ["https://cdn.example.com/reference-1.jpg", "https://cdn.example.com/reference-2.jpg"],
            referenceVideos: ["https://cdn.example.com/reference.mp4"],
            referenceAudios: ["https://cdn.example.com/reference.mp3"],
        });
        expect(body).not.toHaveProperty("image");
        expect(body).not.toHaveProperty("images");
        expect(body).not.toHaveProperty("video");
        expect(body).not.toHaveProperty("audio");
    });

    it("sends a compatible text-to-video request without empty reference fields", async () => {
        mocks.getAuthSettings.mockResolvedValue(publicUrlCompatibleSettings());
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "upstream-text-video", status: "queued" }));

        const response = await POST(request({ model: "video", videoSeconds: "5", size: "16:9", vquality: "720" }));
        const init = mocks.fetchInternalApi.mock.calls[0]?.[1] as RequestInit;
        const upstreamBody = JSON.parse(String(init.body));

        expect(response.status).toBe(200);
        expect(upstreamBody).toMatchObject({ model: "video-one", duration: 5, ratio: "16:9", prompt: "A test video" });
        expect(mocks.createVideoTask).toHaveBeenCalledWith(expect.objectContaining({ requestedDurationSeconds: 5 }));
        expect(upstreamBody).not.toHaveProperty("image");
        expect(upstreamBody).not.toHaveProperty("images");
        expect(upstreamBody.prompt).not.toContain("参考素材一致性要求");
    });

    it("rejects over-limit reference images for the New API video protocol", async () => {
        mocks.getAuthSettings.mockResolvedValue(newApiVideoSettings());

        const response = await POST(
            request(
                { model: "seedance-2.5" },
                Array.from({ length: 10 }, (_, index) => ({ type: "image" as const, url: `https://cdn.example.com/reference-${index + 1}.jpg` })),
            ),
        );

        expect(response.status).toBe(400);
        expect((await response.json()).error).toContain("最多支持 9 张参考图");
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("rejects over-limit New API video and audio references before submission", async () => {
        mocks.getAuthSettings.mockResolvedValue(newApiVideoSettings());

        const videoResponse = await POST(
            request({ model: "seedance-2.5" }, [
                { type: "video", url: "https://cdn.example.com/reference-1.mp4" },
                { type: "video", url: "https://cdn.example.com/reference-2.mp4" },
                { type: "video", url: "https://cdn.example.com/reference-3.mp4" },
                { type: "video", url: "https://cdn.example.com/reference-4.mp4" },
            ]),
        );
        expect(videoResponse.status).toBe(400);
        expect((await videoResponse.json()).error).toContain("最多支持 3 个参考视频");

        const audioResponse = await POST(
            request({ model: "seedance-2.5" }, [
                { type: "audio", url: "https://cdn.example.com/reference-1.mp3" },
                { type: "audio", url: "https://cdn.example.com/reference-2.mp3" },
                { type: "audio", url: "https://cdn.example.com/reference-3.mp3" },
                { type: "audio", url: "https://cdn.example.com/reference-4.mp3" },
            ]),
        );
        expect(audioResponse.status).toBe(400);
        expect((await audioResponse.json()).error).toContain("最多支持 3 个参考音频");
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("rejects first-frame references for the New API video protocol", async () => {
        mocks.getAuthSettings.mockResolvedValue(newApiVideoSettings());

        const response = await POST(request({ model: "seedance-2.5" }, [{ type: "image", url: "https://cdn.example.com/first.jpg", role: "first_frame" }]));

        expect(response.status).toBe(400);
        expect((await response.json()).error).toContain("不支持显式首帧输入");

        const lastFrameResponse = await POST(request({ model: "seedance-2.5" }, [{ type: "image", url: "https://cdn.example.com/last.jpg", role: "last_frame" }]));

        expect(lastFrameResponse.status).toBe(400);
        expect((await lastFrameResponse.json()).error).toContain("指定尾帧");
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("converts workbench pixel sizes into the provider ratio field", async () => {
        mocks.getAuthSettings.mockResolvedValue(publicUrlCompatibleSettings());
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "upstream-pixel-ratio", status: "queued" }));

        const response = await POST(request({ model: "video", size: "1280x720" }));
        const init = mocks.fetchInternalApi.mock.calls[0]?.[1] as RequestInit;

        expect(response.status).toBe(200);
        expect(JSON.parse(String(init.body))).toMatchObject({ ratio: "16:9" });
    });

    it("rounds a requested duration up to the next duration supported by the selected upstream", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [
                {
                    ...channels[0],
                    advancedConfig: {
                        protocol: "custom",
                        modelConfigs: {
                            "video-one": {
                                capability: "video",
                                protocol: "custom",
                                createPath: "/videos",
                                queryPath: "/videos/:task_id",
                                requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","duration":"{{duration}}"}',
                                resultField: "id",
                                durationRange: "5、8、10 秒",
                            },
                        },
                    },
                },
            ],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [settings.logicalModels[0].bindings[0]] }],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "upstream-duration", status: "queued" }));

        const response = await POST(request({ model: "video", videoSeconds: 7 }));
        const init = mocks.fetchInternalApi.mock.calls[0]?.[1] as RequestInit;

        expect(response.status).toBe(200);
        expect(JSON.parse(String(init.body))).toMatchObject({ duration: 8 });
        expect(mocks.createVideoTask).toHaveBeenCalledWith(expect.objectContaining({ requestedDurationSeconds: 8 }));
        expect((await response.json()).task.durationSeconds).toBe(8);
    });

    it("uses the selected GlobalAiOpc preset path and Seedance content request body", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [
                {
                    ...channels[0],
                    advancedConfig: {
                        protocol: "globalaiopc",
                        globalAiOpcPreset: "video-seedance-discount",
                        createPath: "/seedance-discount/videos",
                        queryPath: "/result/:task_id",
                        supportsReferenceImage: true,
                        supportsReferenceVideo: true,
                        supportsReferenceAudio: true,
                    },
                },
            ],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [settings.logicalModels[0].bindings[0]] }],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "global-seedance-task", status: "queued" }));

        const response = await POST(request({ model: "video", videoSeconds: "5", size: "16:9" }, [{ type: "image", url: "https://cdn.example.com/reference.jpg" }]));
        const [url, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];

        expect(response.status).toBe(200);
        expect(url).toContain("/api/ai/system/one/seedance-discount/videos");
        expect(JSON.parse(String(init.body))).toMatchObject({
            model: "video-one",
            duration: 5,
            ratio: "16:9",
            content: [expect.objectContaining({ type: "text", text: expect.stringContaining("A test video") }), { type: "image_url", role: "reference_image", image_url: { url: "https://cdn.example.com/reference.jpg" } }],
        });
    });

    it("submits the documented Buming flat Seedance request and keeps the task query path explicit", async () => {
        const bumingChannel = applyChannelProtocol(
            { ...channels[0], baseUrl: "", models: ["seedance-2-5"], advancedConfig: emptyAdvancedConfig() },
            "buming-seedance",
        );
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [bumingChannel],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [{ ...settings.logicalModels[0].bindings[0], channelId: bumingChannel.id, upstreamModel: "seedance-2-5" }] }],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "buming-task", state: "queued" }));

        const response = await POST(
            request({ model: "video", videoSeconds: "8", size: "16:9", vquality: "1080" }, [
                { type: "image", url: "https://cdn.example.com/reference.png" },
                { type: "video", url: "https://cdn.example.com/reference.mp4" },
            ]),
        );
        const [url, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body));

        expect(response.status).toBe(200);
        expect(url).toContain("/api/ai/system/one/v1/videos/generations");
        expect(body).toMatchObject({ model: "seedance-2-5", prompt: expect.stringContaining("A test video"), mode: "reference", duration: 8, aspect_ratio: "16:9", resolution: "1080p", client_request_id: expect.any(String), images: ["https://cdn.example.com/reference.png"], videos: ["https://cdn.example.com/reference.mp4"] });
        expect(body).not.toHaveProperty("first_frame");
        expect(mocks.createVideoTask).toHaveBeenCalledWith(expect.objectContaining({ upstream: expect.objectContaining({ pollPath: "/v1/videos/generations" }) }));
    });

    it("uses Buming Seedance documented mode values and image ordering for first-last", async () => {
        const bumingChannel = applyChannelProtocol(
            { ...channels[0], baseUrl: "", models: ["seedance-2-0-official"], advancedConfig: emptyAdvancedConfig() },
            "buming-seedance",
        );
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [bumingChannel],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [{ ...settings.logicalModels[0].bindings[0], channelId: bumingChannel.id, upstreamModel: "seedance-2-0-official" }] }],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "buming-first-last-task", state: "queued" }));

        const response = await POST(
            request({ model: "video", videoSeconds: "8", size: "9:16", vquality: "720" }, [
                { type: "image", url: "https://cdn.example.com/first.png", role: "first_frame" },
                { type: "image", url: "https://cdn.example.com/last.png", role: "last_frame" },
                { type: "image", url: "https://cdn.example.com/character.png" },
            ]),
        );
        const [, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body));

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ model: "seedance-2-0-official", mode: "first-last", duration: 8, aspect_ratio: "9:16", resolution: "720p", quality: "mini", images: ["https://cdn.example.com/first.png", "https://cdn.example.com/last.png", "https://cdn.example.com/character.png"], count: 1, prompt: expect.stringContaining("首帧使用@图片1，尾帧使用@图片2") });
        expect(body).not.toHaveProperty("first_frame");
        expect(body).not.toHaveProperty("last_frame");
        expect(body).not.toHaveProperty("generate_audio");
    });

    it("submits Buming all-frame references as one ordered reference request", async () => {
        const bumingChannel = applyChannelProtocol(
            { ...channels[0], baseUrl: "", models: ["seedance-2-0-official"], advancedConfig: emptyAdvancedConfig() },
            "buming-seedance",
        );
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [bumingChannel],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [{ ...settings.logicalModels[0].bindings[0], channelId: bumingChannel.id, upstreamModel: "seedance-2-0-official" }] }],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "buming-all-frame-task", state: "queued" }));

        const response = await POST(
            request({ model: "video", videoSeconds: "8", size: "9:16", vquality: "720" }, [
                { type: "image", url: "https://cdn.example.com/frame-1.png", role: "keyframe", keyframeIndex: 1 },
                { type: "image", url: "https://cdn.example.com/frame-2.png", role: "keyframe", keyframeIndex: 2 },
                { type: "image", url: "https://cdn.example.com/frame-3.png", role: "keyframe", keyframeIndex: 3 },
                { type: "image", url: "https://cdn.example.com/character.png" },
            ]),
        );
        const [, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body));

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            model: "seedance-2-0-official",
            mode: "reference",
            images: ["https://cdn.example.com/frame-1.png", "https://cdn.example.com/frame-2.png", "https://cdn.example.com/frame-3.png", "https://cdn.example.com/character.png"],
            prompt: expect.stringContaining("连续关键帧按时间顺序使用@图片1至@图片3"),
        });
        expect(mocks.fetchInternalApi).toHaveBeenCalledTimes(1);
        expect(body).not.toHaveProperty("params");
    });

    it("uses a declared all-frame-capable drama binding before submission", async () => {
        const bumingChannel = applyChannelProtocol(
            { ...channels[1], models: ["seedance-2-0-official"], advancedConfig: emptyAdvancedConfig() },
            "buming-seedance",
        );
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [channels[0], bumingChannel],
            logicalModels: [
                {
                    ...settings.logicalModels[0],
                    bindings: [
                        settings.logicalModels[0].bindings[0],
                        { ...settings.logicalModels[0].bindings[1], channelId: bumingChannel.id, upstreamModel: "seedance-2-0-official" },
                    ],
                },
            ],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "buming-drama-frame-task", state: "queued" }));

        const response = await POST(
            request(
                { model: "video", videoSeconds: "8", size: "9:16", vquality: "720" },
                [
                    { type: "image", url: "https://cdn.example.com/frame-1.png", role: "keyframe", keyframeIndex: 1 },
                    { type: "image", url: "https://cdn.example.com/frame-2.png", role: "keyframe", keyframeIndex: 2 },
                    { type: "image", url: "https://cdn.example.com/frame-3.png", role: "keyframe", keyframeIndex: 3 },
                    { type: "image", url: "https://cdn.example.com/frame-4.png", role: "keyframe", keyframeIndex: 4 },
                ],
                { surface: "drama", runId: "run-one" },
            ),
        );

        expect(response.status).toBe(200);
        expect(mocks.fetchInternalApi).toHaveBeenCalledTimes(1);
        expect(mocks.fetchInternalApi.mock.calls[0]?.[0]).toContain("/api/ai/system/two/");
    });

    it("does not switch a drama all-frame request to another logical model", async () => {
        const bumingChannel = applyChannelProtocol(
            { ...channels[1], models: ["seedance-2-0-official"], advancedConfig: emptyAdvancedConfig() },
            "buming-seedance",
        );
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [channels[0], bumingChannel],
            logicalModels: [
                { id: "default-video", name: "Default", capability: "video", enabled: true, bindings: [{ id: "default", channelId: channels[0].id, upstreamModel: "video-one", enabled: true, priority: 1 }] },
                { id: "storyboard-video", name: "Storyboard", capability: "video", enabled: true, bindings: [{ id: "storyboard", channelId: bumingChannel.id, upstreamModel: "seedance-2-0-official", enabled: true, priority: 1 }] },
            ],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "fallback-drama-frame-task", state: "queued" }));

        const response = await POST(
            request(
                { model: "default-video", videoSeconds: "8", size: "9:16", vquality: "720" },
                [
                    { type: "image", url: "https://cdn.example.com/frame-1.png", role: "keyframe", keyframeIndex: 1 },
                    { type: "image", url: "https://cdn.example.com/frame-2.png", role: "keyframe", keyframeIndex: 2 },
                    { type: "image", url: "https://cdn.example.com/frame-3.png", role: "keyframe", keyframeIndex: 3 },
                    { type: "image", url: "https://cdn.example.com/frame-4.png", role: "keyframe", keyframeIndex: 4 },
                ],
                { surface: "drama", runId: "run-fallback" },
            ),
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: "当前模型未声明支持 4 张全能帧关键图，请切换支持全能帧的模型" });
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
        expect(mocks.createVideoTask).not.toHaveBeenCalled();
    });

    it("blocks Buming manju special before creating an unsupported all-frame task", async () => {
        const bumingChannel = applyChannelProtocol(
            { ...channels[0], baseUrl: "", models: ["seedance-2-0-manju-special"], advancedConfig: emptyAdvancedConfig() },
            "buming-seedance",
        );
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [bumingChannel],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [{ ...settings.logicalModels[0].bindings[0], channelId: bumingChannel.id, upstreamModel: "seedance-2-0-manju-special" }] }],
        });

        const response = await POST(
            request({ model: "video", videoSeconds: "8", size: "9:16", vquality: "720" }, [
                { type: "image", url: "https://cdn.example.com/frame-1.png", role: "keyframe", keyframeIndex: 1 },
                { type: "image", url: "https://cdn.example.com/frame-2.png", role: "keyframe", keyframeIndex: 2 },
            ]),
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: "当前不鸣视频模型不支持全能帧连续参考" });
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
        expect(mocks.createVideoTask).not.toHaveBeenCalled();
    });

    it("sends explicit first and last frames as Seedance content roles", async () => {
        mocks.getAuthSettings.mockResolvedValue(seedanceFrameSettings());
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "seedance-frame-task", status: "queued" }));

        const response = await POST(
            request({ model: "video", videoSeconds: "5", size: "16:9" }, [
                { type: "image", url: "https://cdn.example.com/first.png", role: "first_frame" },
                { type: "image", url: "https://cdn.example.com/last.png", role: "last_frame" },
            ]),
        );
        const [url, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];

        expect(response.status).toBe(200);
        expect(url).toContain("/api/ai/system/one/v1/seedance-special/videos");
        expect(JSON.parse(String(init.body))).toMatchObject({
            content: [
                expect.objectContaining({ type: "text" }),
                { type: "image_url", role: "first_frame", image_url: { url: "https://cdn.example.com/first.png" } },
                { type: "image_url", role: "last_frame", image_url: { url: "https://cdn.example.com/last.png" } },
            ],
        });
    });

    it("rejects a last frame on OpenAI before creating or billing an upstream task", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [{ ...channels[0], advancedConfig: { protocol: "openai", supportsReferenceImage: true } }],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [settings.logicalModels[0].bindings[0]] }],
        });

        const response = await POST(
            request({ model: "video" }, [
                { type: "image", url: "https://cdn.example.com/first.png", role: "first_frame" },
                { type: "image", url: "https://cdn.example.com/last.png", role: "last_frame" },
            ]),
        );

        expect(response.status).toBe(400);
        expect((await response.json()).error).toContain("不支持尾帧输入");
        expect(mocks.createVideoTask).not.toHaveBeenCalled();
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("skips an unsupported candidate and submits the same frame roles to the next capable binding", async () => {
        const seedanceModel = "sd_2.0_fast_special_720p";
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [
                { ...channels[0], advancedConfig: { protocol: "openai", supportsReferenceImage: true } },
                {
                    ...channels[1],
                    models: [seedanceModel],
                    advancedConfig: { protocol: "seedance-special", createPath: "/seedance-special/videos", queryPath: "/result/:task_id", supportsReferenceImage: true },
                },
            ],
            logicalModels: [
                {
                    ...settings.logicalModels[0],
                    bindings: [settings.logicalModels[0].bindings[0], { ...settings.logicalModels[0].bindings[1], upstreamModel: seedanceModel }],
                },
            ],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "seedance-fallback-task", status: "queued" }));

        const response = await POST(
            request({ model: "video" }, [
                { type: "image", url: "https://cdn.example.com/first.png", role: "first_frame" },
                { type: "image", url: "https://cdn.example.com/last.png", role: "last_frame" },
            ]),
        );

        expect(response.status).toBe(200);
        expect(mocks.createVideoTask).toHaveBeenCalledTimes(1);
        expect(mocks.fetchInternalApi).toHaveBeenCalledTimes(1);
        expect(String(mocks.fetchInternalApi.mock.calls[0][0])).toContain("/api/ai/system/two/v1/seedance-special/videos");
    });

    it("ignores legacy GlobalAiOpc sample references for text-to-video requests", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [
                {
                    ...channels[0],
                    advancedConfig: {
                        protocol: "globalaiopc",
                        createPath: "/videos/videos",
                        queryPath: "/result/:task_id",
                        requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","referenceImages":["https://example.com/rabbit.png"],"referenceAudios":["{{image}}"]}',
                        supportsReferenceImage: true,
                        supportsReferenceVideo: true,
                        supportsReferenceAudio: true,
                    },
                },
            ],
            logicalModels: [{ ...settings.logicalModels[0], bindings: [settings.logicalModels[0].bindings[0]] }],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "global-videos-task", status: "queued" }));

        const response = await POST(request({ model: "video", videoSeconds: "5", size: "16:9", vquality: "720" }));
        const [url, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];
        const upstreamBody = JSON.parse(String(init.body));

        expect(response.status).toBe(200);
        expect(url).toContain("/api/ai/system/one/videos/videos");
        expect(upstreamBody).toEqual({ model: "video-one", prompt: "A test video", duration: 5, ratio: "16:9", resolution: "720p" });
        expect(upstreamBody).not.toHaveProperty("referenceImages");
        expect(upstreamBody).not.toHaveProperty("referenceVideos");
        expect(upstreamBody).not.toHaveProperty("referenceAudios");
    });

    it("selects the matching endpoint from a multi-preset GlobalAiOpc channel", async () => {
        mocks.getAuthSettings.mockResolvedValue({
            ...settings,
            systemChannels: [
                {
                    ...channels[0],
                    models: ["happyhorse-1.0-i2v", "videos_stable"],
                    advancedConfig: {
                        protocol: "globalaiopc",
                        globalAiOpcPresets: ["video-happyhorse-i2v", "video-videos"],
                        supportsReferenceImage: true,
                        supportsReferenceVideo: true,
                        supportsReferenceAudio: true,
                    },
                },
            ],
            logicalModels: [
                {
                    ...settings.logicalModels[0],
                    bindings: [{ ...settings.logicalModels[0].bindings[0], upstreamModel: "videos_stable" }],
                },
            ],
        });
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "global-multi-task", status: "queued" }));

        const response = await POST(request({ model: "video", videoSeconds: "5", size: "16:9", vquality: "720" }));
        const [url, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];

        expect(response.status).toBe(200);
        expect(url).toContain("/api/ai/system/one/videos/videos");
        expect(JSON.parse(String(init.body))).toEqual({ model: "videos_stable", prompt: "A test video", duration: 5, ratio: "16:9", resolution: "720p" });
    });

    it("submits the documented Yumeng Seedance 2 fields to the v2 model-center path", async () => {
        mocks.getAuthSettings.mockResolvedValue(yumengSettings());
        mocks.fetchInternalApi.mockResolvedValue(json({ id: "yumeng-task", status: "queued" }));
        const references = [
            { type: "image", url: "https://cdn.example.com/reference.png" },
            { type: "video", url: "https://cdn.example.com/reference.mp4" },
            { type: "audio", url: "https://cdn.example.com/reference.mp3" },
        ];

        const response = await POST(request({ model: "sd_2.0_fast_special", videoSeconds: "60", size: "16:9", vquality: "720" }, references));
        const [url, init] = mocks.fetchInternalApi.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body));

        expect(response.status).toBe(200);
        expect(url).toBe("http://localhost/api/ai/system/yumeng/kyyReactApiServer/v2/model-center/tasks");
        expect(body).toMatchObject({
            model: "sd_2.0_fast_special",
            duration: 15,
            aspect_ratio: "16:9",
            resolution: "720p",
            reference_images: ["https://cdn.example.com/reference.png"],
            reference_videos: ["https://cdn.example.com/reference.mp4"],
            reference_audios: ["https://cdn.example.com/reference.mp3"],
            generate_audio: "true",
            tools: [],
            watermark: "false",
        });
        expect(body).not.toHaveProperty("first_image");
        expect(body).not.toHaveProperty("last_image");
    });

    it("rejects local reference URLs before creating a public-URL provider task", async () => {
        mocks.getAuthSettings.mockResolvedValue(publicUrlCompatibleSettings());

        const response = await POST(request({ model: "video" }, [{ type: "image", url: "http://127.0.0.1:3000/api/reference-assets/reference.jpg" }]));

        expect(response.status).toBe(400);
        expect((await response.json()).error).toContain("站内参考素材");
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("returns 400 for malformed JSON", async () => {
        const response = await POST(new Request("http://localhost/api/video-generation-tasks", { method: "POST", body: "{" }));

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe("请求内容不是有效 JSON");
    });

    it("returns 413 before reading an oversized JSON body", async () => {
        const response = await POST(
            new Request("http://localhost/api/video-generation-tasks", {
                method: "POST",
                headers: { "content-length": String(4 * 1024 * 1024 + 1) },
                body: "{}",
            }),
        );

        expect(response.status).toBe(413);
        expect((await response.json()).error).toBe("请求体过大");
    });
});

function request(config: Record<string, unknown> = { model: "video" }, references: Array<{ type: string; url: string; role?: string; keyframeIndex?: number }> = [], context?: Record<string, unknown>) {
    const clientRequestId = typeof context?.clientRequestId === "string" ? context.clientRequestId : "";
    return new Request("http://localhost/api/video-generation-tasks", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(clientRequestId ? { "x-vozeb-pro-client-request-id": clientRequestId } : {}),
            ...(typeof context?.attemptNo === "number" ? { "x-vozeb-pro-attempt-no": String(context.attemptNo) } : {}),
        },
        body: JSON.stringify({ config, prompt: "A test video", references, context }),
    });
}

function seedanceFrameSettings() {
    const model = "sd_2.0_fast_special_720p";
    return {
        ...settings,
        systemChannels: [
            {
                ...channels[0],
                models: [model],
                advancedConfig: { protocol: "seedance-special", createPath: "/seedance-special/videos", queryPath: "/result/:task_id", supportsReferenceImage: true },
            },
        ],
        logicalModels: [
            {
                ...settings.logicalModels[0],
                bindings: [{ ...settings.logicalModels[0].bindings[0], upstreamModel: model }],
            },
        ],
    };
}

function publicUrlCompatibleSettings() {
    return {
        ...settings,
        systemChannels: [
            {
                ...channels[0],
                advancedConfig: {
                    protocol: "compatible",
                    supportsReferenceImage: true,
                    supportsReferenceVideo: false,
                    supportsReferenceAudio: false,
                    referenceRule: "图生视频使用公网图片 URL；单图字段 image，多图字段 images。",
                    requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","duration":5,"ratio":"16:9","image":"https://...","images":["https://..."]}',
                },
            },
        ],
        logicalModels: [{ ...settings.logicalModels[0], bindings: [settings.logicalModels[0].bindings[0]] }],
    };
}

function newApiVideoSettings() {
    const model = "seedance-2.5";
    const channel = applyChannelProtocol({ ...channels[0], baseUrl: "", models: [model], advancedConfig: emptyAdvancedConfig() }, "newapi-video");
    return {
        ...settings,
        systemChannels: [channel],
        logicalModels: [
            {
                ...settings.logicalModels[0],
                id: model,
                name: model,
                bindings: [{ id: "newapi-video-binding", channelId: channel.id, upstreamModel: model, enabled: true, priority: 1 }],
            },
        ],
        defaultModels: { videoModel: model },
    };
}

function yumengSettings() {
    const model = "sd_2.0_fast_special";
    const operation = {
        capability: "video" as const,
        source: "official" as const,
        protocol: "yumeng" as const,
        apiFormat: "openai" as const,
        createPath: "/kyyReactApiServer/v2/model-center/tasks",
        imageToVideoPath: "/kyyReactApiServer/v2/model-center/tasks",
        queryPath: "/kyyReactApiServer/v2/model-center/tasks/:task_id",
        requestTemplate:
            '{"model":"{{model}}","prompt":"{{prompt}}","reference_images":"{{images}}","reference_videos":"{{videos}}","reference_audios":"{{audios}}","duration":"{{duration}}","aspect_ratio":"{{aspect_ratio}}","resolution":"{{resolution}}","seed":"-1","first_image":"{{first_frame}}","last_image":"{{last_frame}}","generate_audio":"{{generate_audio_text}}","tools":[],"watermark":"{{watermark_text}}"}',
        resultField: "result_url / video_url",
        statusField: "status",
        durationRange: "4-15 秒",
        referenceRule: "参考素材必须是上游可访问的 URL。",
        supportsReferenceImage: true,
        supportsReferenceVideo: true,
        supportsReferenceAudio: true,
    };
    return {
        ...settings,
        systemChannels: [
            {
                id: "yumeng",
                name: "昱梦",
                baseUrl: "https://zcbservice.aizfw.cn/kyyReactApiServer",
                apiKey: "yumeng-secret",
                apiFormat: "openai" as const,
                models: [model],
                enabled: true,
                advancedConfig: { protocol: "yumeng" as const, modelCapabilities: { [model]: "video" as const }, modelConfigs: { [model]: operation } },
            },
        ],
        logicalModels: [
            {
                id: model,
                name: model,
                capability: "video" as const,
                enabled: true,
                bindings: [{ id: "yumeng-seedance", channelId: "yumeng", upstreamModel: model, enabled: true, priority: 1 }],
            },
        ],
    };
}

function geminiSettings() {
    const model = "veo-3.1-generate-preview";
    const operation = {
        capability: "video" as const,
        source: "manual" as const,
        protocol: "gemini" as const,
        apiFormat: "gemini" as const,
        createPath: "/models/:model:predictLongRunning",
        imageToVideoPath: "/models/:model:predictLongRunning",
        queryPath: "/models/:model/operations/:task_id",
        requestTemplate: "gemini",
        resultField: "response.generateVideoResponse.generatedSamples[0].video.uri",
        statusField: "done",
        durationRange: "4、6、8 秒",
        supportsReferenceImage: true,
        supportsReferenceVideo: false,
        supportsReferenceAudio: false,
    };
    return {
        ...settings,
        systemChannels: [
            {
                id: "gemini",
                name: "Gemini",
                baseUrl: "https://generativelanguage.googleapis.com",
                apiKey: "gemini-secret",
                apiFormat: "gemini" as const,
                models: [model],
                enabled: true,
                advancedConfig: { protocol: "gemini" as const, modelCapabilities: { [model]: "video" as const }, modelConfigs: { [model]: operation } },
            },
        ],
        logicalModels: [
            {
                id: "gemini-video",
                name: "Gemini 视频",
                capability: "video" as const,
                enabled: true,
                bindings: [{ id: "gemini-binding", channelId: "gemini", upstreamModel: model, enabled: true, priority: 1 }],
            },
        ],
        defaultModels: { ...settings.defaultModels, videoModel: "gemini-video" },
    };
}

function json(value: unknown, status = 200) {
    return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}
