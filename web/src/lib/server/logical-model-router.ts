import type { AuthSettings, LogicalModelCapability, SystemModelChannel } from "@/lib/auth/store";
import { channelModelCapability, resolveLogicalModelCapabilityProfile } from "@/lib/model-routing-config";
import { resolveBumingSeedanceVideoModelContract, resolveChannelCapabilityConfig } from "@/lib/channel-protocol-registry";
import { channelSupportsModel } from "./generation-channel";
import { filterHealthyRuntimeCandidates } from "./channel-runtime-health";
import { channelConnectionReady } from "@/lib/channel-protocol-registry";
import { inferModelCapability, normalizeModelId } from "@/lib/model-capability";

export type ResolvedLogicalModel = {
    logicalModelId: string;
    capability: LogicalModelCapability;
    upstreamModel: string;
    channelId: string;
    channel: SystemModelChannel;
    capabilityProfile?: ReturnType<typeof resolveLogicalModelCapabilityProfile>;
};

export function resolveLogicalModel(settings: Pick<AuthSettings, "logicalModels" | "systemChannels">, capability: LogicalModelCapability, requestedModelId: string, preferredChannelId = ""): ResolvedLogicalModel | null {
    return resolveLogicalModelCandidates(settings, capability, requestedModelId, preferredChannelId)[0] || null;
}

export function resolveLogicalModelCandidates(settings: Pick<AuthSettings, "logicalModels" | "systemChannels">, capability: LogicalModelCapability, requestedModelId: string, preferredChannelId = ""): ResolvedLogicalModel[] {
    const requested = requestedModelId.trim();
    if (!requested) return [];
    const logical = settings.logicalModels.find((model) => model.enabled && model.capability === capability && model.id.toLowerCase() === requested.toLowerCase());
    if (logical) {
        const bindings = logical.bindings.filter((binding) => binding.enabled).sort((a, b) => a.priority - b.priority || (b.weight || 100) - (a.weight || 100) || a.id.localeCompare(b.id));
        const preferred = preferredChannelId ? bindings.find((binding) => binding.channelId === preferredChannelId) : undefined;
        const resolved: ResolvedLogicalModel[] = [];
        for (const binding of preferred ? [preferred, ...bindings.filter((item) => item !== preferred)] : bindings) {
            const channel = settings.systemChannels.find(
                (item) => item.id === binding.channelId && item.enabled && channelConnectionReady(item) && channelSupportsModel(item.models, binding.upstreamModel) && logicalBindingSupportsCapability(item, binding.upstreamModel, capability),
            );
            if (channel)
                resolved.push({ logicalModelId: logical.id, capability, upstreamModel: binding.upstreamModel, channelId: channel.id, channel, capabilityProfile: resolveLogicalModelCapabilityProfile(binding, capability, channel, binding.upstreamModel) });
        }
        // Text planning tracks health per channel + upstream model in
        // text-planning-runtime. A channel-level cooldown must not hide a healthy
        // backup text model that shares the same gateway.
        return capability === "text" ? resolved : filterHealthyRuntimeCandidates(resolved, capability);
    }
    if (settings.logicalModels.length) return [];
    const upstreamRequested = normalizeUpstreamModelName(requestedModelId);
    if (!upstreamRequested) return [];
    const ordered = preferredChannelId ? [...settings.systemChannels.filter((channel) => channel.id === preferredChannelId), ...settings.systemChannels.filter((channel) => channel.id !== preferredChannelId)] : settings.systemChannels;
    const resolved = ordered
        .filter(
            (item) =>
                item.enabled &&
                channelConnectionReady(item) &&
                channelSupportsModel(item.models, upstreamRequested) &&
                channelModelCapability(item, upstreamRequested) === capability &&
                logicalBindingSupportsCapability(item, upstreamRequested, capability),
        )
        .map((channel) => ({ logicalModelId: upstreamRequested, capability, upstreamModel: upstreamRequested, channelId: channel.id, channel, capabilityProfile: resolveLogicalModelCapabilityProfile({}, capability, channel, upstreamRequested) }));
    return capability === "text" ? resolved : filterHealthyRuntimeCandidates(resolved, capability);
}

export function resolveVideoLogicalModelCandidates(settings: Pick<AuthSettings, "logicalModels" | "systemChannels">, requestedModelId: string, preferredChannelId = "", durationSeconds?: number): ResolvedLogicalModel[] {
    const requested = settings.logicalModels.find((model) => model.enabled && model.capability === "video" && model.id.toLowerCase() === requestedModelId.trim().toLowerCase());
    if (!requested) return resolveLogicalModelCandidates(settings, "video", requestedModelId, preferredChannelId);

    const modelIds = [
        requested.id,
        ...(requested.fallbackModelIds || []).flatMap((id) => {
            const fallback = settings.logicalModels.find((model) => model.enabled && model.capability === "video" && model.id.toLowerCase() === id.trim().toLowerCase());
            return fallback && !fallback.fallbackModelIds?.length ? [fallback.id] : [];
        }),
    ];
    const seenModels = new Set<string>();
    const resolved = modelIds.flatMap((modelId) => {
        const key = modelId.trim().toLowerCase();
        if (!key || seenModels.has(key)) return [];
        seenModels.add(key);
        return resolveLogicalModelCandidates(settings, "video", modelId, modelId === requested.id ? preferredChannelId : "");
    });
    const candidates = deduplicateVideoCandidates(resolved);
    if (requested.fallbackStrategy !== "cheapest") return candidates;
    return sortVideoCandidatesByCost(settings, candidates, durationSeconds);
}

function deduplicateVideoCandidates(candidates: ResolvedLogicalModel[]) {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
        const key = `${candidate.channelId}:${candidate.upstreamModel.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function sortVideoCandidatesByCost(settings: Pick<AuthSettings, "logicalModels" | "systemChannels">, candidates: ResolvedLogicalModel[], durationSeconds?: number) {
    const priced = candidates.map((candidate, index) => {
        const profile = candidate.capabilityProfile;
        const basis = profile?.unitCostBasis;
        const cost = profile?.unitCost;
        const currency = profile?.unitCostCurrency?.trim().toUpperCase();
        if (cost === undefined || !currency || !basis || (basis === "second" && (!durationSeconds || durationSeconds <= 0))) return null;
        const binding = settings.logicalModels
            .find((model) => model.id.toLowerCase() === candidate.logicalModelId.toLowerCase())
            ?.bindings.find((item) => item.channelId === candidate.channelId && item.upstreamModel.trim().toLowerCase() === candidate.upstreamModel.trim().toLowerCase());
        return { candidate, index, cost: basis === "second" ? cost * durationSeconds! : cost, currency, basis, priority: binding?.priority || Number.MAX_SAFE_INTEGER, weight: binding?.weight || 100 };
    });
    if (priced.some((item) => !item)) return candidates;
    const comparable = priced.filter((item): item is NonNullable<typeof item> => Boolean(item));
    const currency = comparable[0]?.currency;
    const basis = comparable[0]?.basis;
    if (!currency || !basis || comparable.some((item) => item.currency !== currency || item.basis !== basis)) return candidates;
    return comparable
        .sort(
            (left, right) =>
                left.cost - right.cost ||
                left.priority - right.priority ||
                right.weight - left.weight ||
                left.candidate.channelId.localeCompare(right.candidate.channelId) ||
                left.candidate.upstreamModel.localeCompare(right.candidate.upstreamModel) ||
                left.index - right.index,
        )
        .map((item) => item.candidate);
}

/** Only declared capabilities may opt a model into ordered all-frame video generation. */
export function supportsVideoKeyframeReferences(candidate: ResolvedLogicalModel, keyframeCount: number) {
    if (candidate.capability !== "video" || keyframeCount < 1) return false;
    if (candidate.channel.advancedConfig?.protocol === "newapi-video") return false;
    const contract = candidate.channel.advancedConfig?.protocol === "buming-seedance" ? resolveBumingSeedanceVideoModelContract(candidate.upstreamModel) : undefined;
    const supportsKeyframes = contract ? contract.videoReferenceModes.includes("all_frames") : candidate.capabilityProfile?.supportsKeyframes;
    return Boolean(supportsKeyframes);
}

export function resolveVideoKeyframeModelCandidates(settings: Pick<AuthSettings, "logicalModels" | "systemChannels">, preferredModelIds: string[], keyframeCount: number) {
    const modelIds = [...preferredModelIds, ...settings.logicalModels.filter((model) => model.enabled && model.capability === "video").map((model) => model.id)];
    const seenModels = new Set<string>();
    const seenCandidates = new Set<string>();
    return modelIds
        .filter((modelId) => {
            const normalized = modelId.trim().toLowerCase();
            if (!normalized || seenModels.has(normalized)) return false;
            seenModels.add(normalized);
            return true;
        })
        .flatMap((modelId) => resolveLogicalModelCandidates(settings, "video", modelId))
        .filter((candidate) => supportsVideoKeyframeReferences(candidate, keyframeCount))
        .filter((candidate) => {
            const key = `${candidate.channelId}:${candidate.upstreamModel.toLowerCase()}`;
            if (seenCandidates.has(key)) return false;
            seenCandidates.add(key);
            return true;
        });
}

export function resolveTextPlanningModelCandidates(settings: Pick<AuthSettings, "logicalModels" | "systemChannels">, requestedModelId: string, preferredChannelId = "") {
    const requested = requestedModelId.trim().toLowerCase();
    const modelIds = [requestedModelId, ...settings.logicalModels.filter((model) => model.enabled && model.capability === "text" && model.id.trim().toLowerCase() !== requested).map((model) => model.id)];
    const seen = new Set<string>();
    return modelIds
        .flatMap((modelId) => resolveLogicalModelCandidates(settings, "text", modelId, preferredChannelId))
        .filter((candidate) => {
            const key = `${candidate.channelId}:${candidate.upstreamModel.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function logicalBindingSupportsCapability(channel: SystemModelChannel, model: string, capability: LogicalModelCapability) {
    if (capability !== "audio") return true;
    const declaredCapability = channel.advancedConfig?.modelCapabilities?.[normalizeModelId(model)];
    if (declaredCapability && declaredCapability !== "audio") return false;
    const modelConfig = channel.advancedConfig?.modelConfigs?.[normalizeModelId(model)];
    const capabilityConfig = resolveChannelCapabilityConfig(channel.advancedConfig, model, capability);
    if (modelConfig && modelConfig.capability !== "audio") return false;
    if (modelConfig?.capability === "audio") return true;
    if (capabilityConfig?.protocol === "openai-audio-dialogue") return Boolean(capabilityConfig.createPath && capabilityConfig.requestTemplate);
    return channelModelCapability(channel, model) === "audio" || inferModelCapability(model) === "audio";
}

export function resolveAudioLogicalModelCandidates(settings: Pick<AuthSettings, "logicalModels" | "systemChannels">, requestedModelId: string, preferredChannelId = "") {
    const requested = resolveLogicalModelCandidates(settings, "audio", requestedModelId, preferredChannelId);
    if (requested.length) return requested;
    const fallbackIds = (settings.logicalModels || []).filter((model) => model.enabled && model.capability === "audio" && model.id.toLowerCase() !== requestedModelId.trim().toLowerCase()).map((model) => model.id);
    return fallbackIds.flatMap((modelId) => resolveLogicalModelCandidates(settings, "audio", modelId, preferredChannelId));
}

export function resolveDialogueAudioLogicalModelCandidates(settings: Pick<AuthSettings, "logicalModels" | "systemChannels">, requestedModelId: string, preferredChannelId = "") {
    const requested = resolveLogicalModelCandidates(settings, "audio", requestedModelId, preferredChannelId);
    const requestedDialogue = requested.filter(isDialogueAudioCandidate);
    if (requestedDialogue.length) return requestedDialogue;
    const fallbackIds = (settings.logicalModels || []).filter((model) => model.enabled && model.capability === "audio" && model.id.toLowerCase() !== requestedModelId.trim().toLowerCase()).map((model) => model.id);
    return fallbackIds.flatMap((modelId) => resolveLogicalModelCandidates(settings, "audio", modelId, preferredChannelId)).filter(isDialogueAudioCandidate);
}

function isDialogueAudioCandidate(candidate: ResolvedLogicalModel) {
    return resolveChannelCapabilityConfig(candidate.channel.advancedConfig, candidate.upstreamModel, "audio")?.protocol === "openai-audio-dialogue";
}

export function resolveLogicalBillingModel(logicalModels: AuthSettings["logicalModels"], capability: LogicalModelCapability, channelId: string, upstreamModel: string, preferredLogicalModelId = "") {
    const matches = logicalModels.filter(
        (logical) => logical.enabled && logical.capability === capability && logical.bindings.some((binding) => binding.enabled && binding.channelId === channelId && channelSupportsModel([binding.upstreamModel], upstreamModel)),
    );
    return matches.find((logical) => logical.id.toLowerCase() === preferredLogicalModelId.trim().toLowerCase())?.id || matches[0]?.id || upstreamModel;
}

function normalizeUpstreamModelName(value: string) {
    return String(value || "")
        .trim()
        .replace(/^models\//i, "")
        .replace(/::(?:text|image|video|audio)$/i, "");
}
