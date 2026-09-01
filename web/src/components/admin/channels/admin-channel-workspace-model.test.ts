import { describe, expect, it } from "vitest";

import type { SystemModelChannel } from "@/lib/auth/store";
import { applyChannelProtocol } from "@/lib/channel-protocol-registry";
import { channelCanEnable, channelEffectiveEnabled, channelProtocolLabel, channelWorkspaceStatus, channelWorkspaceStatusLabel, defaultModelField, removeChannelFromWorkspace, synchronizeChannelModels, updateChannelInWorkspace } from "./admin-channel-workspace-model";

const channel = applyChannelProtocol({ id: "sd2", name: "SD2 渠道", baseUrl: "https://api.example.com", apiKey: "secret", apiFormat: "openai", models: ["seedance-pro"], enabled: true } satisfies SystemModelChannel, "seedance");

describe("admin channel workspace model", () => {
    it("keeps SD2 and Stable Diffusion labels distinct", () => {
        const stableDiffusion = applyChannelProtocol({ ...channel, id: "sd", models: ["sdxl"] }, "stable-diffusion");
        expect(channelProtocolLabel(channel)).toContain("SD2");
        expect(channelProtocolLabel(stableDiffusion)).toContain("Stable Diffusion");
    });

    it("derives channel status from runtime readiness", () => {
        expect(channelWorkspaceStatus(channel)).toBe("enabled");
        expect(channelWorkspaceStatus({ ...channel, enabled: false })).toBe("disabled");
        expect(channelWorkspaceStatus({ ...channel, enabled: false, baseUrl: "" })).toBe("draft");
        expect(channelWorkspaceStatus({ ...channel, models: [] })).toBe("incomplete");
    });

    it("uses configuration status labels", () => {
        expect(channelWorkspaceStatusLabel(channelWorkspaceStatus(channel))).toBe("已启用");
        expect(channelWorkspaceStatusLabel(channelWorkspaceStatus({ ...channel, models: [] }))).toBe("待补模型");
    });

    it("does not treat a saved channel without models as runtime enabled", () => {
        const incompleteChannel = { ...channel, models: [] };
        expect(channelCanEnable(incompleteChannel)).toBe(false);
        expect(channelEffectiveEnabled(incompleteChannel)).toBe(false);
    });

    it("removes dead bindings and defaults with a deleted channel", () => {
        const settings = {
            systemChannels: [channel],
            logicalModels: [{ id: "video-pro", name: "专业视频", capability: "video" as const, enabled: true, bindings: [{ id: "binding", channelId: channel.id, upstreamModel: "seedance-pro", enabled: true, priority: 1 }] }],
            defaultModels: { textModel: "", imageModel: "", videoModel: "video-pro", audioModel: "" },
        };
        expect(removeChannelFromWorkspace(settings, channel.id)).toEqual({ systemChannels: [], logicalModels: [], defaultModels: { textModel: "", imageModel: "", videoModel: "", audioModel: "" } });
        expect(defaultModelField("video")).toBe("videoModel");
    });

    it("clears an unresolved default as soon as its only channel is disabled", () => {
        const settings = {
            systemChannels: [channel],
            logicalModels: [{ id: "video-pro", name: "专业视频", capability: "video" as const, enabled: true, bindings: [{ id: "binding", channelId: channel.id, upstreamModel: "seedance-pro", enabled: true, priority: 1 }] }],
            defaultModels: { textModel: "", imageModel: "", videoModel: "video-pro", audioModel: "" },
        };

        expect(updateChannelInWorkspace(settings, channel.id, { enabled: false }).defaultModels.videoModel).toBe("");
    });

    it("switches the default capability model when a new channel is marked as default", () => {
        const existing = applyChannelProtocol({ ...channel, id: "existing", models: ["gpt-image-2"] }, "openai");
        const replacement = applyChannelProtocol({ ...channel, id: "replacement", models: ["gpt-image-2-official"] }, "openai");
        const settings = {
            systemChannels: [existing, replacement],
            logicalModels: [],
            defaultModels: { textModel: "", imageModel: "gpt-image-2", videoModel: "", audioModel: "" },
        };

        const next = synchronizeChannelModels(settings, replacement.id, true);

        expect(next.defaultModels.imageModel).toBe("gpt-image-2-official");
    });
});
