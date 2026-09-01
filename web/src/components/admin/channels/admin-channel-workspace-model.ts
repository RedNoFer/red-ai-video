import type { LogicalModelCapability, SystemDefaultModels, SystemModelChannel } from "@/lib/auth/store";
import { channelDetectedCapabilities, channelModelCapability, normalizeDefaultModelsConfig, synchronizeLogicalModelsWithChannels } from "@/lib/model-routing-config";
import { channelProtocolDefinition } from "@/lib/channel-protocol-registry";

export type ChannelWorkspaceSettings = {
    systemChannels: SystemModelChannel[];
    logicalModels: import("@/lib/auth/store").LogicalModel[];
    defaultModels: SystemDefaultModels;
};

export type ChannelWorkspaceStatus = "enabled" | "incomplete" | "draft" | "disabled";

const capabilityLabels: Record<LogicalModelCapability, string> = { text: "文本", image: "图片", video: "视频", audio: "音频" };

export function channelWorkspaceStatus(channel: SystemModelChannel): ChannelWorkspaceStatus {
    if (!channel.baseUrl.trim()) return "draft";
    if (!channelHasUsableModels(channel)) return "incomplete";
    if (channel.enabled) return "enabled";
    return "disabled";
}

export function channelHasUsableModels(channel: Pick<SystemModelChannel, "models">) {
    return channel.models.some((model) => model.trim());
}

export function channelCanEnable(channel: SystemModelChannel) {
    return Boolean(channel.baseUrl.trim()) && channelHasUsableModels(channel);
}

export function channelEffectiveEnabled(channel: SystemModelChannel) {
    return channel.enabled && channelCanEnable(channel);
}

export function channelEnableBlockReason(channel: SystemModelChannel) {
    if (!channel.baseUrl.trim()) return "请先填写 Base URL";
    if (!channelHasUsableModels(channel)) return "请先添加至少一个上游模型 ID";
    return "";
}

export function channelWorkspaceStatusLabel(status: ChannelWorkspaceStatus) {
    return { enabled: "已启用", incomplete: "待补模型", draft: "草稿", disabled: "已停用" }[status];
}

export function channelRuntimeEnabled(channel: SystemModelChannel) {
    if (!channelCanEnable(channel)) return false;
    return channel.enabled;
}

export function channelUsabilityHint(channel: SystemModelChannel) {
    if (!channel.baseUrl.trim()) return "这个渠道还没有填写 Base URL，不能用于工作台。";
    if (!channelHasUsableModels(channel)) return "这个渠道已经保存了供应商地址和凭据，但还没有上游模型 ID，暂时不能用于工作台调用。";
    if (!channel.enabled) return "这个渠道已有模型配置，启用并保存后才能参与工作台路由。";
    return "";
}

export function channelEnabledMetric(settings: ChannelWorkspaceSettings) {
    return settings.systemChannels.filter(channelRuntimeEnabled).length;
}

export function channelSynchronizedMetric(settings: ChannelWorkspaceSettings) {
    return settings.systemChannels.filter(channelHasUsableModels).length;
}

export function channelCapabilityLabels(channel: SystemModelChannel) {
    return Array.from(channelDetectedCapabilities(channel)).map((capability) => capabilityLabels[capability]);
}

export function channelProtocolLabel(channel: SystemModelChannel) {
    return channelProtocolDefinition(channel.advancedConfig?.protocol || "auto").label;
}

export function removeChannelFromWorkspace(settings: ChannelWorkspaceSettings, channelId: string): ChannelWorkspaceSettings {
    const systemChannels = settings.systemChannels.filter((channel) => channel.id !== channelId);
    const logicalModels = settings.logicalModels.map((model) => ({ ...model, bindings: model.bindings.filter((binding) => binding.channelId !== channelId) })).filter((model) => model.bindings.length);
    const liveIds = new Set(logicalModels.map((model) => model.id));
    return {
        systemChannels,
        logicalModels,
        defaultModels: Object.fromEntries(Object.entries(settings.defaultModels).map(([key, value]) => [key, liveIds.has(value) ? value : ""])) as SystemDefaultModels,
    };
}

export function updateChannelInWorkspace(settings: ChannelWorkspaceSettings, channelId: string, patch: Partial<SystemModelChannel>): ChannelWorkspaceSettings {
    const systemChannels = settings.systemChannels.map((channel) => (channel.id === channelId ? { ...channel, ...patch } : channel));
    return {
        ...settings,
        systemChannels,
        defaultModels: normalizeDefaultModelsConfig(settings.defaultModels, settings.logicalModels, systemChannels),
    };
}

export function defaultModelField(capability: LogicalModelCapability): keyof SystemDefaultModels {
    return capability === "text" ? "textModel" : capability === "image" ? "imageModel" : capability === "video" ? "videoModel" : "audioModel";
}

export function synchronizeChannelModels(settings: ChannelWorkspaceSettings, channelId: string, setAsDefault: boolean) {
    const logicalModels = synchronizeLogicalModelsWithChannels(settings.logicalModels, settings.systemChannels);
    if (!setAsDefault) return { logicalModels, defaultModels: normalizeDefaultModelsConfig(settings.defaultModels, logicalModels, settings.systemChannels) };
    const channel = settings.systemChannels.find((item) => item.id === channelId);
    if (!channel) return { logicalModels, defaultModels: normalizeDefaultModelsConfig(settings.defaultModels, logicalModels, settings.systemChannels) };
    const defaultModels = { ...settings.defaultModels };
    for (const upstreamModel of channel.models) {
        const logical = logicalModels.find((model) => model.bindings.some((binding) => binding.channelId === channel.id && binding.upstreamModel === upstreamModel));
        if (logical) defaultModels[defaultModelField(channelModelCapability(channel, upstreamModel))] = logical.id;
    }
    return { logicalModels, defaultModels: normalizeDefaultModelsConfig(defaultModels, logicalModels, settings.systemChannels) };
}

export function channelBindingCount(channelId: string, settings: ChannelWorkspaceSettings) {
    return settings.logicalModels.reduce((count, model) => count + model.bindings.filter((binding) => binding.channelId === channelId).length, 0);
}

export function channelSearchText(channel: SystemModelChannel) {
    return `${channel.name} ${channel.baseUrl} ${channelProtocolLabel(channel)} ${channel.models.join(" ")}`.toLowerCase();
}
