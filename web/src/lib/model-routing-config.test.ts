import { describe, expect, it } from "vitest";

import type { LogicalModel, SystemModelChannel } from "@/lib/auth/store";
import {
    channelDetectedCapabilities,
    channelModelCapability,
    deriveLogicalModelsConfig,
    isLogicalModelResolvable,
    mergeChannelModelsIntoLogicalModels,
    modelRoutingValidationErrors,
    normalizeDefaultModelsConfig,
    normalizeLogicalModelsConfig,
    resolveLogicalModelConfig,
    synchronizeLogicalModelsWithChannels,
} from "./model-routing-config";
import { applyChannelProtocol, resolveChannelCapabilityConfig } from "./channel-protocol-registry";

const channel = (id: string, models: string[], enabled = true): SystemModelChannel => ({ id, name: id, baseUrl: `https://${id}.example.com/v1`, apiKey: "test-secret", apiFormat: "openai", models, enabled });

describe("model routing config", () => {
    it("removes missing, unsupported, and duplicate bindings", () => {
        const channels = [channel("one", ["models/GPT-TEST"]), channel("two", ["gpt-test-2"], false)];
        const models: LogicalModel[] = [
            {
                id: "writer",
                name: "Writer",
                capability: "text",
                enabled: true,
                bindings: [
                    { id: "one", channelId: "one", upstreamModel: "gpt-test", enabled: true, priority: 2 },
                    { id: "duplicate", channelId: "one", upstreamModel: "models/GPT-TEST", enabled: true, priority: 1 },
                    { id: "missing", channelId: "missing", upstreamModel: "gpt-test", enabled: true, priority: 3 },
                    { id: "unsupported", channelId: "two", upstreamModel: "other", enabled: true, priority: 4 },
                ],
            },
        ];
        expect(normalizeLogicalModelsConfig(models, channels)[0].bindings).toEqual([{ id: "one", channelId: "one", upstreamModel: "models/GPT-TEST", enabled: true, priority: 2 }]);
    });

    it("rebuilds an explicitly empty logical model catalog from channel models", () => {
        const channels = [channel("one", ["writer"])];

        expect(normalizeLogicalModelsConfig([], channels)).toHaveLength(1);
        expect(normalizeLogicalModelsConfig(undefined, channels)).toHaveLength(1);
    });

    it("distinguishes SD2.0 video aliases from full Stable Diffusion image names", () => {
        const models = normalizeLogicalModelsConfig(undefined, [channel("one", ["sd2.0", "sd_2.0_fast_discount_720p", "seedance-2.0", "stable-diffusion-2.0", "sdxl"])]);

        expect(models.find((model) => model.id === "sd2.0")?.capability).toBe("video");
        expect(models.find((model) => model.id === "sd_2.0_fast_discount_720p")?.capability).toBe("video");
        expect(models.find((model) => model.id === "seedance-2.0")?.capability).toBe("video");
        expect(models.find((model) => model.id === "stable-diffusion-2.0")?.capability).toBe("image");
        expect(models.find((model) => model.id === "sdxl")?.capability).toBe("image");
    });

    it("keeps an explicitly selected logical model capability", () => {
        const channels = [channel("one", ["stable-diffusion-2.0"])];
        const models = normalizeLogicalModelsConfig(
            [{ id: "stable-diffusion-2.0", name: "自定义视频能力", capability: "video", enabled: true, bindings: [{ id: "one", channelId: "one", upstreamModel: "stable-diffusion-2.0", enabled: true, priority: 1 }] }],
            channels,
        );

        expect(models[0]?.capability).toBe("video");
        expect(normalizeDefaultModelsConfig({ textModel: "", imageModel: "", videoModel: "stable-diffusion-2.0", audioModel: "" }, models, channels).videoModel).toBe("stable-diffusion-2.0");
    });

    it("uses channel capability metadata before model-name inference", () => {
        const source = channel("one", ["opaque-a", "stable-video-diffusion"]);
        source.advancedConfig = { modelCapabilities: { "opaque-a": "image", "stable-video-diffusion": "video" } } as never;

        const models = deriveLogicalModelsConfig([source]);

        expect(models.find((model) => model.id === "opaque-a")?.capability).toBe("image");
        expect(models.find((model) => model.id === "stable-video-diffusion")?.capability).toBe("video");
    });

    it("repairs stale health detection for Nano Banana image models", () => {
        const source = channel("sub2api", ["gemini-3.1-flash-image-preview", "nano-banana-2"]);
        source.advancedConfig = {
            modelCapabilities: { "gemini-3.1-flash-image-preview": "text", "nano-banana-2": "text" },
            modelConfigs: {
                "gemini-3.1-flash-image-preview": { capability: "text", source: "health" },
                "nano-banana-2": { capability: "text", source: "health" },
            },
        } as never;

        expect(channelModelCapability(source, "gemini-3.1-flash-image-preview")).toBe("image");
        expect(channelModelCapability(source, "nano-banana-2")).toBe("image");
        expect(Array.from(channelDetectedCapabilities(source))).toEqual(["image"]);
    });

    it("uses refreshed protocol catalog metadata to repair an existing logical capability", () => {
        const source = channel("newapi", ["opaque-media"]);
        source.advancedConfig = {
            protocol: "newapi",
            modelCapabilities: { "opaque-media": "image" },
            modelConfigs: { "opaque-media": { capability: "image", source: "provider" } },
        } as never;
        const existing: LogicalModel[] = [{ id: "opaque-media", name: "opaque-media", capability: "text", enabled: true, bindings: [{ id: "old", channelId: "newapi", upstreamModel: "opaque-media", enabled: true, priority: 1 }] }];

        expect(synchronizeLogicalModelsWithChannels(existing, [source])[0]?.capability).toBe("image");
    });

    it("uses single-capability protocol catalogs for opaque model names", () => {
        const video = channel("seedance", ["opaque-video-model"]);
        video.advancedConfig = { protocol: "seedance" } as never;
        const image = channel("stable-diffusion", ["opaque-image-model"]);
        image.advancedConfig = { protocol: "stable-diffusion" } as never;

        expect(channelModelCapability(video, "opaque-video-model")).toBe("video");
        expect(channelModelCapability(image, "opaque-image-model")).toBe("image");
    });

    it("does not expose non-creative channel models to generation surfaces", () => {
        const source = channel("newapi", ["gpt-4.1", "text-embedding-3-small", "bge-reranker-v2-m3", "dots.ocr", "gcp-speech-to-text", "whisper-1", "llama-3.1-nemoguard-8b-topic-control", "tts-1"]);
        source.advancedConfig = {
            protocol: "newapi",
            modelConfigs: {
                "gcp-speech-to-text": { capability: "audio", source: "provider" },
                "whisper-1": { capability: "audio", source: "provider" },
                "tts-1": { capability: "audio", source: "provider" },
            },
        } as never;

        const models = deriveLogicalModelsConfig([source]);

        expect(models.map((model) => model.id)).toEqual(["gpt-4.1", "tts-1"]);
        expect(Array.from(channelDetectedCapabilities(source))).toEqual(["text", "audio"]);
        expect(normalizeDefaultModelsConfig({ textModel: "gpt-4.1", imageModel: "", videoModel: "", audioModel: "gcp-speech-to-text" }, models, [source]).audioModel).toBe("tts-1");
    });

    it("merges the same upstream model from multiple channels into one logical model", () => {
        const channels = [channel("one", ["models/GPT-IMAGE-2"]), channel("two", ["gpt-image-2"])];
        const existing: LogicalModel[] = [{ id: "gpt-image-2", name: "GPT Image 2", capability: "image", enabled: true, bindings: [{ id: "one:gpt-image-2", channelId: "one", upstreamModel: "gpt-image-2", enabled: true, priority: 1 }] }];

        const models = mergeChannelModelsIntoLogicalModels(existing, channels);

        expect(models).toHaveLength(1);
        expect(models[0].bindings).toEqual([{ ...existing[0].bindings[0], upstreamModel: "models/GPT-IMAGE-2" }, expect.objectContaining({ channelId: "two", upstreamModel: "gpt-image-2" })]);
    });

    it("does not keep a text-only upstream model as an audio logical route", () => {
        const source = channel("sub2api", ["gpt-5.5"]);
        source.advancedConfig = { protocol: "sub2api", modelCapabilities: { "gpt-5.5": "text" }, modelConfigs: { "gpt-5.5": { capability: "text", source: "provider" } } } as never;
        const existing: LogicalModel[] = [
            { id: "gpt-5.5", name: "gpt-5.5", capability: "text", enabled: true, bindings: [{ id: "text", channelId: "sub2api", upstreamModel: "gpt-5.5", enabled: true, priority: 1 }] },
            { id: "gpt-5.5::audio", name: "gpt-5.5", capability: "audio", enabled: true, bindings: [{ id: "audio", channelId: "sub2api", upstreamModel: "gpt-5.5", enabled: true, priority: 1 }] },
        ];

        const models = synchronizeLogicalModelsWithChannels(existing, [source]);

        expect(models).toHaveLength(1);
        expect(models.find((model) => model.capability === "text")).toMatchObject({ id: "gpt-5.5", name: "gpt-5.5" });
        expect(models.find((model) => model.capability === "audio")).toBeUndefined();
        expect(normalizeDefaultModelsConfig({ textModel: "gpt-5.5", imageModel: "", videoModel: "", audioModel: "gpt-5.5::audio" }, models, [source])).toMatchObject({ textModel: "gpt-5.5", audioModel: "" });
    });

    it("rejects image models as audio routes without explicit audio model metadata", () => {
        const source = channel("sub2api", ["gpt-image-2"]);
        source.advancedConfig = { protocol: "sub2api", operationConfigs: { audio: { capability: "audio", createPath: "/audio/speech", requestTemplate: '{"model":"{{model}}","input":"{{prompt}}"}' } } } as never;
        const models: LogicalModel[] = [{ id: "gpt-image-2::audio", name: "gpt-image-2", capability: "audio", enabled: true, bindings: [{ id: "audio", channelId: "sub2api", upstreamModel: "gpt-image-2", enabled: true, priority: 1 }] }];

        expect(modelRoutingValidationErrors(models, [source], { textModel: "", imageModel: "", videoModel: "", audioModel: "gpt-image-2::audio" })).toContain("逻辑模型 gpt-image-2::audio：图片或视频模型不能作为音频模型，请配置明确的音频模型");
    });

    it("rejects a text-only provider model even when a dialogue audio operation is configured", () => {
        const source = channel("sub2api", ["gpt-5.5"]);
        source.advancedConfig = {
            protocol: "sub2api",
            modelCapabilities: { "gpt-5.5": "text" },
            modelConfigs: { "gpt-5.5": { capability: "text", source: "provider" } },
            operationConfigs: { audio: { capability: "audio", protocol: "openai-audio-dialogue", createPath: "/chat/completions", requestTemplate: '{"model":"{{model}}","modalities":["text","audio"]}', resultField: "choices[0].message.audio" } },
        } as never;
        const models: LogicalModel[] = [{ id: "gpt-5.5::audio", name: "gpt-5.5", capability: "audio", enabled: true, bindings: [{ id: "audio", channelId: "sub2api", upstreamModel: "gpt-5.5", enabled: true, priority: 1 }] }];

        expect(modelRoutingValidationErrors(models, [source], { textModel: "", imageModel: "", videoModel: "", audioModel: "gpt-5.5::audio" })).toContain(
            "逻辑模型 gpt-5.5::audio：上游模型已声明为文本模型，不能作为音频模型；请在供应商模型目录中启用真实音频模型并标记为音频能力",
        );
    });

    it("accepts Chat/Responses audio for a model that is also exposed as text", () => {
        const source = channel("sub2api", ["gpt-5.5"]);
        source.advancedConfig = {
            protocol: "sub2api",
            modelCapabilities: { "gpt-5.5": "audio" },
            modelConfigs: {
                "gpt-5.5": {
                    capability: "audio",
                    source: "provider",
                    protocol: "openai-audio-dialogue",
                    createPath: "/chat/completions",
                    requestTemplate: '{"model":"{{model}}","messages":[{"role":"user","content":"{{prompt}}"}],"modalities":["text","audio"],"audio":{"voice":"{{voice}}","format":"{{format}}"}}',
                    resultField: "choices[0].message.audio",
                },
            },
            operationConfigs: {
                audio: {
                    capability: "audio",
                    protocol: "openai-audio-dialogue",
                    createPath: "/chat/completions",
                    requestTemplate: '{"model":"{{model}}","messages":[{"role":"user","content":"{{prompt}}"}],"modalities":["text","audio"],"audio":{"voice":"{{voice}}","format":"{{format}}"}}',
                    resultField: "choices[0].message.audio",
                },
            },
        } as never;
        const models: LogicalModel[] = [{ id: "gpt-5.5::audio", name: "gpt-5.5", capability: "audio", enabled: true, bindings: [{ id: "audio", channelId: "sub2api", upstreamModel: "gpt-5.5", enabled: true, priority: 1 }] }];

        expect(modelRoutingValidationErrors(models, [source], { textModel: "", imageModel: "", videoModel: "", audioModel: "gpt-5.5::audio" })).toEqual([]);
    });

    it("keeps the dialogue protocol on a channel-level audio preset", () => {
        const configured = applyChannelProtocol({ ...channel("dialogue", ["mock-audio"]), baseUrl: "http://127.0.0.1:4010/v1" }, "openai-audio-dialogue");
        const resolved = resolveChannelCapabilityConfig(configured.advancedConfig, "mock-audio", "audio");
        expect(configured.advancedConfig?.protocol).toBe("openai-audio-dialogue");
        expect(resolved).toMatchObject({ protocol: "openai-audio-dialogue", createPath: "/chat/completions" });
        expect(
            modelRoutingValidationErrors([{ id: "mock-audio", name: "mock-audio", capability: "audio", enabled: true, bindings: [{ id: "binding", channelId: "dialogue", upstreamModel: "mock-audio", enabled: true, priority: 1 }] }], [configured], {
                textModel: "",
                imageModel: "",
                videoModel: "",
                audioModel: "mock-audio",
            }),
        ).toEqual([]);
    });

    it("keeps an explicit audio model config on a mixed video protocol channel", () => {
        const source = channel("buming", ["gemini-3.1-flash-tts"]);
        source.advancedConfig = {
            protocol: "buming-seedance",
            modelCapabilities: { "gemini-3.1-flash-tts": "audio" },
            modelConfigs: {
                "gemini-3.1-flash-tts": {
                    capability: "audio",
                    source: "manual",
                    protocol: "custom",
                    createPath: "/audio/speech",
                    requestTemplate: '{"model":"{{model}}","input":"{{prompt}}","voice":"{{voice}}","response_format":"{{format}}"}',
                    resultField: "binary",
                },
            },
        } as never;

        const models = synchronizeLogicalModelsWithChannels(
            [{ id: "gemini-3.1-flash-tts::video", name: "gemini-3.1-flash-tts", capability: "video", enabled: true, bindings: [{ id: "video", channelId: "buming", upstreamModel: "gemini-3.1-flash-tts", enabled: true, priority: 1 }] }],
            [source],
        );

        expect(models).toHaveLength(1);
        expect(models[0]).toMatchObject({ id: "gemini-3.1-flash-tts", capability: "audio" });
        expect(modelRoutingValidationErrors(models, [source], { textModel: "", imageModel: "", videoModel: "", audioModel: "gemini-3.1-flash-tts" })).toEqual([]);
    });

    it("explains that a strict video channel cannot host an audio logical model", () => {
        const source = channel("buming", ["gemini-3.1-flash-tts"]);
        source.advancedConfig = { protocol: "buming-seedance", modelCapabilities: { "gemini-3.1-flash-tts": "video" }, modelConfigs: {} } as never;
        const logicalModels: LogicalModel[] = [
            { id: "gemini-3.1-flash-tts::audio", name: "Gemini TTS", capability: "audio", enabled: true, bindings: [{ id: "audio", channelId: "buming", upstreamModel: "gemini-3.1-flash-tts", enabled: true, priority: 1 }] },
        ];

        expect(modelRoutingValidationErrors(logicalModels, [source], { textModel: "", imageModel: "", videoModel: "", audioModel: "gemini-3.1-flash-tts::audio" })).toContain(
            "逻辑模型 gemini-3.1-flash-tts::audio：渠道 buming 使用不鸣 TokenGo Seedance，仅支持视频；请新建 OpenAI 兼容音频渠道并按 TTS 文档配置 /audio/speech",
        );
    });

    it("removes stale bindings and creates separate logical models for different upstream names", () => {
        const channels = [channel("one", ["writer", "writer-mini"]), channel("two", ["models/WRITER"])];
        const existing: LogicalModel[] = [
            {
                id: "custom-writer",
                name: "旧名称",
                capability: "text",
                enabled: false,
                bindings: [
                    { id: "keep", channelId: "one", upstreamModel: "writer", enabled: false, priority: 9, weight: 25 },
                    { id: "stale", channelId: "gone", upstreamModel: "writer", enabled: true, priority: 1 },
                ],
            },
        ];

        const models = synchronizeLogicalModelsWithChannels(existing, channels);

        expect(models).toHaveLength(2);
        expect(models[0]).toMatchObject({ id: "custom-writer", name: "旧名称", enabled: false });
        expect(models[0].bindings).toEqual([
            expect.objectContaining({ channelId: "two", upstreamModel: "models/WRITER", priority: 2 }),
            expect.objectContaining({ id: "keep", channelId: "one", upstreamModel: "writer", enabled: false, priority: 9, weight: 25 }),
        ]);
        expect(models[1]).toMatchObject({ id: "writer-mini", name: "writer-mini", bindings: [{ channelId: "one", upstreamModel: "writer-mini" }] });
        expect(models.flatMap((model) => model.bindings).some((binding) => binding.channelId === "gone")).toBe(false);
    });

    it("preserves an administrator model nickname when the channel catalog is synchronized", () => {
        const existing: LogicalModel[] = [
            {
                id: "image-pro",
                name: "商业图片 Pro",
                capability: "image",
                enabled: true,
                bindings: [{ id: "binding", channelId: "one", upstreamModel: "vendor/image-v2", enabled: true, priority: 1 }],
            },
        ];

        expect(synchronizeLogicalModelsWithChannels(existing, [channel("one", ["vendor/image-v2"])])[0]?.name).toBe("商业图片 Pro");
    });

    it("keeps the upstream auto model classified as text", () => {
        const source = channel("one", ["auto"]);
        source.advancedConfig = { modelCapabilities: { auto: "audio" }, modelConfigs: { auto: { capability: "audio", source: "health" } } } as never;

        expect(channelModelCapability(source, "auto")).toBe("text");
    });

    it("only exposes capabilities represented by real channel models", () => {
        const source = channel("one", ["auto", "gpt-5-3", "gpt-image-2"]);

        expect(Array.from(channelDetectedCapabilities(source))).toEqual(["text", "image"]);
    });

    it("requires an enabled matching binding for defaults", () => {
        const channels = [channel("one", ["vendor/writer"]), channel("off", ["voice"], false)];
        const models: LogicalModel[] = [
            { id: "writer", name: "Writer", capability: "text", enabled: true, bindings: [{ id: "one", channelId: "one", upstreamModel: "vendor/writer", enabled: true, priority: 1 }] },
            { id: "voice", name: "Voice", capability: "audio", enabled: true, bindings: [{ id: "two", channelId: "off", upstreamModel: "voice", enabled: true, priority: 1 }] },
        ];
        expect(isLogicalModelResolvable(models, channels, "text", "writer")).toBe(true);
        expect(normalizeDefaultModelsConfig({ textModel: "writer", imageModel: "writer", videoModel: "", audioModel: "voice" }, models, channels)).toEqual({ textModel: "writer", imageModel: "", videoModel: "", audioModel: "" });
    });

    it("switches a stale default to another resolvable model of the same capability", () => {
        const channels = [channel("off", ["gpt-image-2"], false), channel("backup", ["flux-pro"])];
        const models: LogicalModel[] = [
            { id: "gpt-image-2", name: "GPT Image 2", capability: "image", enabled: true, bindings: [{ id: "off", channelId: "off", upstreamModel: "gpt-image-2", enabled: true, priority: 1 }] },
            { id: "flux-pro", name: "Flux Pro", capability: "image", enabled: true, bindings: [{ id: "backup", channelId: "backup", upstreamModel: "flux-pro", enabled: true, priority: 1 }] },
        ];

        expect(normalizeDefaultModelsConfig({ textModel: "", imageModel: "gpt-image-2", videoModel: "", audioModel: "" }, models, channels).imageModel).toBe("flux-pro");
    });

    it("uses binding priority and falls back from a disabled channel", () => {
        const channels = [channel("primary", ["writer-v1"], false), channel("backup", ["writer-v2"])];
        const models: LogicalModel[] = [
            {
                id: "writer",
                name: "Writer",
                capability: "text",
                enabled: true,
                bindings: [
                    { id: "one", channelId: "primary", upstreamModel: "writer-v1", enabled: true, priority: 1 },
                    { id: "two", channelId: "backup", upstreamModel: "writer-v2", enabled: true, priority: 2 },
                ],
            },
        ];
        expect(resolveLogicalModelConfig(models, channels, "text", "writer")).toMatchObject({ channel: { id: "backup" }, binding: { upstreamModel: "writer-v2" } });
    });

    it("normalizes binding weight and capability profile limits", () => {
        const channels = [channel("one", ["video-model"])];
        const models = normalizeLogicalModelsConfig(
            [
                {
                    id: "video",
                    name: "Video",
                    capability: "video",
                    enabled: true,
                    bindings: [
                        {
                            id: "one",
                            channelId: "one",
                            upstreamModel: "video-model",
                            enabled: true,
                            priority: 1,
                            weight: 250,
                            capabilityProfile: {
                                supportsReferenceImage: true,
                                maxReferenceImages: 4,
                                aspectRatios: ["16:9", "16:9", "9:16"],
                                maxDurationSeconds: 10,
                                maxBatchSize: 2,
                                timeoutMs: 600000,
                                concurrencyLimit: 3,
                                unitCost: 0,
                                unitCostCurrency: "USD",
                            },
                        },
                    ],
                },
            ],
            channels,
        );

        expect(models[0].bindings[0]).toMatchObject({
            weight: 250,
            capabilityProfile: { supportsReferenceImage: true, maxReferenceImages: 4, aspectRatios: ["16:9", "9:16"], maxDurationSeconds: 10, maxBatchSize: 2, timeoutMs: 600000, concurrencyLimit: 3, unitCost: 0, unitCostCurrency: "USD" },
        });
    });

    it("preserves video fallback routing and cost strategy during channel synchronization", () => {
        const channels = [channel("one", ["wan-video"]), channel("two", ["seedance-video"])];
        const models: LogicalModel[] = [
            {
                id: "video-primary",
                name: "视频主路由",
                capability: "video",
                enabled: true,
                fallbackModelIds: ["video-backup"],
                fallbackStrategy: "cheapest",
                bindings: [{ id: "one", channelId: "one", upstreamModel: "wan-video", enabled: true, priority: 1, capabilityProfile: { unitCost: 4, unitCostCurrency: "CNY", unitCostBasis: "call" } }],
            },
            {
                id: "video-backup",
                name: "视频后备",
                capability: "video",
                enabled: true,
                bindings: [{ id: "two", channelId: "two", upstreamModel: "seedance-video", enabled: true, priority: 1, capabilityProfile: { unitCost: 2, unitCostCurrency: "CNY", unitCostBasis: "call" } }],
            },
        ];

        const normalized = normalizeLogicalModelsConfig(models, channels);

        expect(normalized.find((model) => model.id === "video-primary")).toMatchObject({ fallbackModelIds: ["video-backup"], fallbackStrategy: "cheapest" });
        expect(normalized.find((model) => model.id === "video-primary")?.bindings[0].capabilityProfile).toMatchObject({ unitCostBasis: "call" });
    });

    it("rejects invalid video fallback references and nested fallback routes", () => {
        const channels = [channel("one", ["wan-video"]), channel("two", ["seedance-video"]), channel("three", ["text-model"])];
        const models: LogicalModel[] = [
            {
                id: "video-primary",
                name: "视频主路由",
                capability: "video",
                enabled: true,
                fallbackModelIds: ["video-primary", "video-backup", "missing", "text-route"],
                bindings: [{ id: "one", channelId: "one", upstreamModel: "wan-video", enabled: true, priority: 1 }],
            },
            { id: "video-backup", name: "视频后备", capability: "video", enabled: true, fallbackModelIds: ["video-third"], bindings: [{ id: "two", channelId: "two", upstreamModel: "seedance-video", enabled: true, priority: 1 }] },
            { id: "video-third", name: "视频第三候选", capability: "video", enabled: true, bindings: [{ id: "two-third", channelId: "two", upstreamModel: "seedance-video", enabled: true, priority: 2 }] },
            { id: "text-route", name: "文本", capability: "text", enabled: true, bindings: [{ id: "three", channelId: "three", upstreamModel: "text-model", enabled: true, priority: 1 }] },
        ];

        expect(modelRoutingValidationErrors(models, channels, { textModel: "", imageModel: "", videoModel: "video-primary", audioModel: "" })).toEqual(
            expect.arrayContaining([
                "视频逻辑模型 video-primary 不能引用自身作为后备模型",
                "视频逻辑模型 video-primary 不能继续引用后备模型：video-backup",
                "视频逻辑模型 video-primary 引用了不存在的后备模型：missing",
                "视频逻辑模型 video-primary 只能引用视频逻辑模型：text-route",
            ]),
        );
    });

    it("keeps invalid fallback IDs visible for API validation instead of dropping them during synchronization", () => {
        const models: LogicalModel[] = [
            { id: "video-primary", name: "视频主路由", capability: "video", enabled: true, fallbackModelIds: ["missing-video"], bindings: [{ id: "one", channelId: "one", upstreamModel: "wan-video", enabled: true, priority: 1 }] },
        ];
        const normalized = normalizeLogicalModelsConfig(models, [channel("one", ["wan-video"])]);

        expect(normalized[0]?.fallbackModelIds).toEqual(["missing-video"]);
        expect(modelRoutingValidationErrors(normalized, [channel("one", ["wan-video"])], { textModel: "", imageModel: "", videoModel: "video-primary", audioModel: "" })).toContain("视频逻辑模型 video-primary 引用了不存在的后备模型：missing-video");
    });

    it("rejects fallback strategies on non-video models and duplicate fallback IDs", () => {
        const channels = [channel("one", ["writer"]), channel("two", ["video-model"])];
        const models: LogicalModel[] = [
            { id: "writer", name: "文本", capability: "text", enabled: true, fallbackStrategy: "cheapest", fallbackModelIds: ["video-model"], bindings: [{ id: "one", channelId: "one", upstreamModel: "writer", enabled: true, priority: 1 }] },
            { id: "video-model", name: "视频", capability: "video", enabled: true, bindings: [{ id: "two", channelId: "two", upstreamModel: "video-model", enabled: true, priority: 1 }] },
            { id: "video-primary", name: "视频主路由", capability: "video", enabled: true, fallbackModelIds: ["video-model", "VIDEO-MODEL"], bindings: [{ id: "two-primary", channelId: "two", upstreamModel: "video-model", enabled: true, priority: 2 }] },
        ];

        expect(modelRoutingValidationErrors(models, channels, { textModel: "writer", imageModel: "", videoModel: "video-primary", audioModel: "" })).toEqual(
            expect.arrayContaining(["只有视频逻辑模型可以配置后备排序策略：writer", "只有视频逻辑模型可以配置后备模型：writer", "视频逻辑模型 video-primary 存在重复后备模型：VIDEO-MODEL"]),
        );
    });

    it("reports duplicate bindings and invalid defaults", () => {
        const channels = [channel("one", ["writer"])];
        const models: LogicalModel[] = [
            {
                id: "writer",
                name: "Writer",
                capability: "text",
                enabled: true,
                bindings: [
                    { id: "one", channelId: "one", upstreamModel: "writer", enabled: true, priority: 1 },
                    { id: "two", channelId: "one", upstreamModel: "models/WRITER", enabled: true, priority: 2 },
                ],
            },
        ];
        expect(modelRoutingValidationErrors(models, channels, { textModel: "missing", imageModel: "", videoModel: "", audioModel: "" })).toEqual(expect.arrayContaining(["逻辑模型 writer 存在重复绑定", "默认文本模型不可解析：missing"]));
    });

    it("does not reject an administrator capability override based only on its name", () => {
        const channels = [channel("one", ["stable-diffusion-2.0"])];
        const models: LogicalModel[] = [{ id: "stable-diffusion-2.0", name: "自定义视频能力", capability: "video", enabled: true, bindings: [{ id: "one", channelId: "one", upstreamModel: "stable-diffusion-2.0", enabled: true, priority: 1 }] }];

        expect(modelRoutingValidationErrors(models, channels, { textModel: "", imageModel: "", videoModel: "stable-diffusion-2.0", audioModel: "" })).not.toContain("逻辑模型 stable-diffusion-2.0 更像图片模型，请调整能力类型");
    });
});
