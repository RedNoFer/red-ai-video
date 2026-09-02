import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getFreshAuthSettings: vi.fn(),
    setAuthSettings: vi.fn(),
    safeRecordAuditLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/auth/store", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth/store")>();
    return { ...actual, getFreshAuthSettings: mocks.getFreshAuthSettings, setAuthSettings: mocks.setAuthSettings };
});
vi.mock("@/lib/server/audit-log-store", () => ({ auditActorFromRequest: vi.fn(() => ({ id: "admin" })), safeRecordAuditLog: mocks.safeRecordAuditLog }));

import { GET, PATCH } from "./route";
import { DEFAULT_SITE_SETTINGS } from "@/lib/auth/store";
import { applyChannelProtocol, protocolModelConfig } from "@/lib/channel-protocol-registry";

const savedSettings = {
    systemChannels: [{ id: "one", name: "主渠道", baseUrl: "https://api.example.com/v1", apiKey: "saved-secret", webhookSecret: "0123456789abcdef0123456789abcdef", apiFormat: "openai", models: ["vendor/writer"], enabled: true }],
    logicalModels: [{ id: "writer", name: "Writer", capability: "text", enabled: true, bindings: [{ id: "binding", channelId: "one", upstreamModel: "vendor/writer", enabled: true, priority: 1 }] }],
    defaultModels: { textModel: "writer", imageModel: "", videoModel: "", audioModel: "" },
};

describe("admin settings model routing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "admin", role: "admin", status: "active", adminPermissions: ["system.manage", "billing.manage", "upstream.manage"] });
        mocks.getFreshAuthSettings.mockResolvedValue(savedSettings);
        mocks.setAuthSettings.mockImplementation(async (patch) => ({ ...savedSettings, ...patch }));
    });

    it("saves a consistent channel, logical model, and default snapshot", async () => {
        const response = await PATCH(
            request({
                systemChannels: [{ ...savedSettings.systemChannels[0], apiKey: "", webhookSecret: "", hasApiKey: true, hasWebhookSecret: true }],
                logicalModels: savedSettings.logicalModels,
                defaultModels: savedSettings.defaultModels,
            }),
        );
        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                systemChannels: [expect.objectContaining({ id: "one", apiKey: "saved-secret", webhookSecret: savedSettings.systemChannels[0].webhookSecret })],
                logicalModels: [expect.objectContaining({ id: "writer", name: "Writer", bindings: savedSettings.logicalModels[0].bindings })],
                defaultModels: savedSettings.defaultModels,
            }),
        );
        expect(mocks.safeRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.settings.update", metadata: { fields: expect.arrayContaining(["systemChannels", "logicalModels", "defaultModels"]) } }));
    });

    it("persists video fallback models, sorting strategy, and cost basis", async () => {
        const channels = [
            { id: "wan", name: "Wan", baseUrl: "https://wan.example.com/v1", apiKey: "wan-secret", apiFormat: "openai" as const, models: ["alibaba/wan-3.0"], enabled: true },
            { id: "seedance", name: "Seedance", baseUrl: "https://seedance.example.com/v1", apiKey: "seedance-secret", apiFormat: "openai" as const, models: ["seedance-2.0"], enabled: true },
        ];
        const logicalModels = [
            {
                id: "wan-route",
                name: "Wan 主路由",
                capability: "video" as const,
                enabled: true,
                fallbackModelIds: ["seedance-route"],
                fallbackStrategy: "cheapest" as const,
                bindings: [{ id: "wan-binding", channelId: "wan", upstreamModel: "alibaba/wan-3.0", enabled: true, priority: 1, capabilityProfile: { unitCost: 4, unitCostCurrency: "CNY", unitCostBasis: "call" as const } }],
            },
            {
                id: "seedance-route",
                name: "Seedance 后备",
                capability: "video" as const,
                enabled: true,
                bindings: [{ id: "seedance-binding", channelId: "seedance", upstreamModel: "seedance-2.0", enabled: true, priority: 1, capabilityProfile: { unitCost: 0.5, unitCostCurrency: "CNY", unitCostBasis: "second" as const } }],
            },
        ];

        const response = await PATCH(
            request({
                systemChannels: channels,
                logicalModels,
                defaultModels: { textModel: "", imageModel: "", videoModel: "wan-route", audioModel: "" },
            }),
        );

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                logicalModels: expect.arrayContaining([
                    expect.objectContaining({ id: "wan-route", fallbackModelIds: ["seedance-route"], fallbackStrategy: "cheapest", bindings: [expect.objectContaining({ capabilityProfile: expect.objectContaining({ unitCostBasis: "call" }) })] }),
                ]),
            }),
        );
    });

    it("rejects invalid fallback references and estimated prices before normalization", async () => {
        const response = await PATCH(
            request({
                systemChannels: [{ id: "video", name: "视频", baseUrl: "https://video.example.com/v1", apiKey: "video-secret", apiFormat: "openai" as const, models: ["video-model"], enabled: true }],
                logicalModels: [
                    {
                        id: "video-route",
                        name: "视频",
                        capability: "video" as const,
                        enabled: true,
                        fallbackModelIds: ["video-route"],
                        fallbackStrategy: "priority",
                        bindings: [{ id: "video-binding", channelId: "video", upstreamModel: "video-model", enabled: true, priority: 1, capabilityProfile: { unitCost: -1, unitCostCurrency: "", unitCostBasis: "minute" as never } }],
                    },
                ],
                defaultModels: { textModel: "", imageModel: "", videoModel: "video-route", audioModel: "" },
            }),
        );

        expect(response.status).toBe(400);
        expect(mocks.setAuthSettings).not.toHaveBeenCalled();
        expect((await response.json()).error).toContain("不能引用自身");
    });

    it("rejects invalid estimated price fields before normalization", async () => {
        const response = await PATCH(
            request({
                systemChannels: [{ id: "video", name: "视频", baseUrl: "https://video.example.com/v1", apiKey: "video-secret", apiFormat: "openai" as const, models: ["video-model"], enabled: true }],
                logicalModels: [
                    {
                        id: "video-route",
                        name: "视频",
                        capability: "video" as const,
                        enabled: true,
                        bindings: [{ id: "video-binding", channelId: "video", upstreamModel: "video-model", enabled: true, priority: 1, capabilityProfile: { unitCost: -1, unitCostCurrency: "", unitCostBasis: "minute" as never } }],
                    },
                ],
                defaultModels: { textModel: "", imageModel: "", videoModel: "video-route", audioModel: "" },
            }),
        );

        expect(response.status).toBe(400);
        expect(mocks.setAuthSettings).not.toHaveBeenCalled();
        expect((await response.json()).error).toContain("估算单价");
    });

    it("repairs a stale Buming Seedance request template before validating and saving", async () => {
        const channel = applyChannelProtocol({ id: "buming", name: "不鸣 TokenGo Seedance 渠道", baseUrl: "https://api.tokengo.love", apiKey: "saved-secret", apiFormat: "openai", models: ["seedance-2-0-official"], enabled: true }, "buming-seedance");
        channel.advancedConfig = {
            ...channel.advancedConfig!,
            modelConfigs: {
                ...channel.advancedConfig!.modelConfigs,
                "seedance-2-0-official": {
                    ...channel.advancedConfig!.modelConfigs!["seedance-2-0-official"],
                    requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","first_frame":"{{first_frame}}","last_frame":"{{last_frame}}"}',
                },
            },
        };

        const response = await PATCH(
            request({
                systemChannels: [channel],
                logicalModels: [{ id: "seedance-2-0-official", name: "Seedance", capability: "video", enabled: true, bindings: [{ id: "video", channelId: "buming", upstreamModel: "seedance-2-0-official", enabled: true, priority: 1 }] }],
                defaultModels: { textModel: "", imageModel: "", videoModel: "seedance-2-0-official", audioModel: "" },
            }),
        );

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                systemChannels: [
                    expect.objectContaining({ advancedConfig: expect.objectContaining({ modelConfigs: expect.objectContaining({ "seedance-2-0-official": expect.objectContaining({ requestTemplate: expect.stringContaining('"mode":"{{mode}}"') }) }) }) }),
                ],
            }),
        );
    });

    it("deletes a channel together with stale logical bindings and defaults", async () => {
        const response = await PATCH(request({ systemChannels: [], logicalModels: savedSettings.logicalModels, defaultModels: savedSettings.defaultModels }));
        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(expect.objectContaining({ systemChannels: [], logicalModels: [], defaultModels: { textModel: "", imageModel: "", videoModel: "", audioModel: "" } }));
    });

    it("rebuilds an explicitly empty logical model catalog from channels", async () => {
        const response = await PATCH(request({ logicalModels: [], defaultModels: { ...savedSettings.defaultModels, textModel: "" } }));

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(expect.objectContaining({ logicalModels: [expect.objectContaining({ id: "vendor/writer", bindings: [expect.objectContaining({ channelId: "one", upstreamModel: "vendor/writer" })] })] }));
    });

    it("recreates channel-backed logical models during a later channel-only save", async () => {
        mocks.getFreshAuthSettings.mockResolvedValue({ ...savedSettings, logicalModels: [], defaultModels: { ...savedSettings.defaultModels, textModel: "" } });

        const response = await PATCH(request({ systemChannels: savedSettings.systemChannels }));

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(expect.objectContaining({ logicalModels: [expect.objectContaining({ id: "vendor/writer" })] }));
    });

    it("saves a disabled channel after clearing its now-unresolvable default", async () => {
        const response = await PATCH(
            request({
                systemChannels: [{ ...savedSettings.systemChannels[0], enabled: false, apiKey: "", hasApiKey: true }],
                logicalModels: savedSettings.logicalModels,
                defaultModels: savedSettings.defaultModels,
            }),
        );

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(expect.objectContaining({ defaultModels: expect.objectContaining({ textModel: "" }) }));
    });

    it("removes a text model configured as a Chat/Responses audio route", async () => {
        const multiCapabilityChannel = applyChannelProtocol(
            {
                id: "multi",
                name: "多能力渠道",
                baseUrl: "https://api.example.com/v1",
                apiKey: "saved-secret",
                apiFormat: "openai",
                models: ["gpt-5.5"],
                enabled: true,
            },
            "sub2api",
        );
        multiCapabilityChannel.advancedConfig = {
            ...multiCapabilityChannel.advancedConfig!,
            operationConfigs: {
                ...multiCapabilityChannel.advancedConfig?.operationConfigs,
                audio: protocolModelConfig("openai-audio-dialogue", "audio", "gpt-5.5"),
            },
        };
        const logicalModels = [
            { id: "gpt-5.5", name: "gpt-5.5", capability: "text" as const, enabled: true, bindings: [{ id: "text", channelId: "multi", upstreamModel: "gpt-5.5", enabled: true, priority: 1 }] },
            { id: "gpt-5.5::audio", name: "gpt-5.5", capability: "audio" as const, enabled: true, bindings: [{ id: "audio", channelId: "multi", upstreamModel: "gpt-5.5", enabled: true, priority: 1 }] },
        ];
        const response = await PATCH(
            request({
                systemChannels: [multiCapabilityChannel],
                logicalModels,
                defaultModels: { textModel: "gpt-5.5", imageModel: "", videoModel: "", audioModel: "gpt-5.5::audio" },
            }),
        );

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                logicalModels: [expect.objectContaining({ id: "gpt-5.5", capability: "text" })],
                defaultModels: expect.objectContaining({ textModel: "gpt-5.5", audioModel: "" }),
            }),
        );
    });

    it("saves a document-derived custom audio route on a mixed channel", async () => {
        const audioChannel = {
            id: "buming",
            name: "不鸣音频",
            baseUrl: "https://buming.token6688.com/v1",
            apiKey: "saved-secret",
            apiFormat: "openai" as const,
            models: ["gemini-3.1-flash-tts"],
            enabled: true,
            advancedConfig: {
                protocol: "custom" as const,
                authMode: "bearer" as const,
                textModel: "",
                imageModel: "",
                videoModel: "",
                createPath: "",
                editPath: "",
                imageToVideoPath: "",
                queryPath: "",
                requestTemplate: "",
                resultField: "",
                statusField: "",
                durationRange: "",
                referenceRule: "",
                supportsReferenceImage: false,
                supportsReferenceVideo: false,
                supportsReferenceAudio: false,
                modelCapabilities: { "gemini-3.1-flash-tts": "audio" as const },
                modelConfigs: {
                    "gemini-3.1-flash-tts": {
                        capability: "audio" as const,
                        source: "manual" as const,
                        protocol: "custom" as const,
                        apiFormat: "openai" as const,
                        createPath: "/audio/speech",
                        requestTemplate: '{"model":"{{model}}","input":"{{prompt}}","voice":"{{voice}}","response_format":"{{format}}"}',
                        resultField: "binary",
                    },
                },
            },
        };

        const response = await PATCH(
            request({
                systemChannels: [audioChannel],
                logicalModels: [],
                defaultModels: { textModel: "", imageModel: "", videoModel: "", audioModel: "" },
            }),
        );

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                logicalModels: [expect.objectContaining({ id: "gemini-3.1-flash-tts", capability: "audio" })],
            }),
        );
    });

    it("rejects a newly submitted short webhook secret instead of silently keeping the old value", async () => {
        const response = await PATCH(request({ systemChannels: [{ ...savedSettings.systemChannels[0], apiKey: "", webhookSecret: "short", hasApiKey: true, hasWebhookSecret: true }] }));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual(expect.objectContaining({ error: expect.stringContaining("至少需要 32 个字符") }));
        expect(mocks.setAuthSettings).not.toHaveBeenCalled();
    });

    it("accepts administrator-configured generation cost controls", async () => {
        const generationCostControl = { maxPointsPerTask: 8.5, dailyUserPointSpend: 40, dailyTotalPointSpend: 200 };

        const response = await PATCH(request({ generationCostControl }));

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith({ generationCostControl });
        expect(mocks.safeRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ metadata: { fields: ["generationCostControl"] } }));
    });

    it("accepts administrator-configured technical data lifecycle controls", async () => {
        const dataLifecycle = { cleanupExpiredSessions: true, cleanupExpiredEmailCodes: true, cleanupExpiredGenerationTasks: false, cleanupExpiredTemporaryMedia: true, maintenanceBatchSize: 80 };

        const response = await PATCH(request({ dataLifecycle }));

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith({ dataLifecycle });
        expect(mocks.safeRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ metadata: { fields: ["dataLifecycle"] } }));
    });

    it("accepts common social address formats without silently deleting them", async () => {
        const site = {
            ...DEFAULT_SITE_SETTINGS,
            socials: {
                ...DEFAULT_SITE_SETTINGS.socials,
                telegram: { enabled: true, label: "Telegram", url: "t.me/vozeb_group" },
                x: { enabled: true, label: "X", url: "@vozeb_pro" },
                instagram: { enabled: true, label: "Instagram", url: "instagram.com/vozeb.pro" },
            },
        };

        const response = await PATCH(request({ site }));

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith({ site });
    });

    it("rejects an invalid non-empty social address instead of reporting a destructive save as successful", async () => {
        const site = {
            ...DEFAULT_SITE_SETTINGS,
            socials: { ...DEFAULT_SITE_SETTINGS.socials, x: { enabled: true, label: "X", url: "not a social address" } },
        };

        const response = await PATCH(request({ site }));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: "X 地址无效，请填写完整链接或 @用户名" });
        expect(mocks.setAuthSettings).not.toHaveBeenCalled();
    });

    it("allows a system administrator to save only system settings", async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: "system-admin", role: "admin", status: "active", adminPermissions: ["system.manage"] });
        const dataLifecycle = { cleanupExpiredSessions: true, cleanupExpiredEmailCodes: true, cleanupExpiredGenerationTasks: true, cleanupExpiredTemporaryMedia: true, maintenanceBatchSize: 60 };

        const response = await PATCH(request({ registrationEnabled: false, dataLifecycle }));

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith({ registrationEnabled: false, dataLifecycle });
    });

    it("allows an upstream administrator to save only generation settings", async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: "upstream-admin", role: "admin", status: "active", adminPermissions: ["upstream.manage"] });
        const generationConcurrency = { agent: 2, image: 2, video: 1, audio: 2, text: 4, render: 1 };

        const response = await PATCH(request({ generationConcurrency }));

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith({ generationConcurrency });
    });

    it("rejects a mixed settings patch when the administrator lacks one required duty", async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: "system-admin", role: "admin", status: "active", adminPermissions: ["system.manage"] });

        const response = await PATCH(request({ registrationEnabled: false, generationConcurrency: { agent: 2 } }));

        expect(response.status).toBe(403);
        expect(mocks.getFreshAuthSettings).not.toHaveBeenCalled();
        expect(mocks.setAuthSettings).not.toHaveBeenCalled();
    });

    it("rejects accounts without an administrator duty before reading settings", async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: "user", role: "user", status: "active", adminPermissions: [] });

        const response = await PATCH(request({ registrationEnabled: false }));

        expect(response.status).toBe(403);
        expect(mocks.getFreshAuthSettings).not.toHaveBeenCalled();
        expect(mocks.setAuthSettings).not.toHaveBeenCalled();
    });

    it("does not return full upstream configuration to a system-only administrator", async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: "system-admin", role: "admin", status: "active", adminPermissions: ["system.manage"] });

        const response = await GET();
        const payload = (await response.json()) as { settings: { systemChannels: Array<{ baseUrl: string; advancedConfig?: unknown }>; agentSkills: unknown[] } };

        expect(response.status).toBe(200);
        expect(payload.settings.systemChannels[0]).toMatchObject({ baseUrl: "" });
        expect(payload.settings.systemChannels[0].advancedConfig).toBeUndefined();
        expect(payload.settings.agentSkills).toEqual([]);
    });

    it("does not return system mail configuration to an upstream-only administrator", async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: "upstream-admin", role: "admin", status: "active", adminPermissions: ["upstream.manage"] });
        mocks.getFreshAuthSettings.mockResolvedValue({ ...savedSettings, mail: { provider: "SMTP", host: "smtp.internal", port: 465, secure: true, username: "admin", password: "mail-secret", fromEmail: "admin@example.com", fromName: "Admin" } });

        const response = await GET();
        const payload = (await response.json()) as { settings: { mail: { host: string; password: string } } };

        expect(response.status).toBe(200);
        expect(payload.settings.mail.host).not.toBe("smtp.internal");
        expect(payload.settings.mail.password).toBe("");
    });
});

function request(body: unknown) {
    return new Request("http://localhost/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
