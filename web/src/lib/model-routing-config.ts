import type { LogicalModel, LogicalModelBinding, LogicalModelCapability, LogicalModelCapabilityProfile, LogicalModelCostBasis, SystemChannelProtocol, SystemDefaultModels, SystemModelChannel } from "@/lib/auth/store";
import { resolveGlobalAiOpcPreset } from "@/lib/globalaiopc-catalog";
import { inferModelCapability, isCreativeGenerationModel, normalizeModelId } from "@/lib/model-capability";
import { channelConnectionReady, channelProtocolDefinition, protocolCatalogCapability, resolveChannelCapabilityConfig, resolveChannelModelConfig } from "@/lib/channel-protocol-registry";

const CAPABILITY_DEFAULT_KEYS = {
    text: "textModel",
    image: "imageModel",
    video: "videoModel",
    audio: "audioModel",
} as const satisfies Record<LogicalModelCapability, keyof SystemDefaultModels>;

export function normalizeLogicalModelsConfig(models: LogicalModel[] | undefined, channels: SystemModelChannel[]) {
    return synchronizeLogicalModelsWithChannels(Array.isArray(models) ? models : [], channels);
}

export function deriveLogicalModelsConfig(channels: SystemModelChannel[]): LogicalModel[] {
    return synchronizeLogicalModelsWithChannels([], channels);
}

export function synchronizeLogicalModelsWithChannels(existingModels: LogicalModel[], channels: SystemModelChannel[]): LogicalModel[] {
    const catalog = new Map<
        string,
        {
            upstreamModel: string;
            capability: LogicalModelCapability;
            bindings: Array<{ channel: SystemModelChannel; channelIndex: number; upstreamModel: string }>;
        }
    >();
    channels.forEach((channel, channelIndex) => {
        channel.models.forEach((upstreamModel) => {
            const id = rawModelName(upstreamModel);
            if (!id || !isCreativeGenerationModel(id)) return;
            const detected = resolveChannelModelCapability(channel, upstreamModel);
            const existingCapabilities = new Set<LogicalModelCapability>();
            for (const existing of existingModels) {
                if (!existing.bindings.some((binding) => binding.channelId === channel.id && normalizeModelName(binding.upstreamModel) === normalizeModelName(id))) continue;
                if (channelSupportsCapability(channel, upstreamModel, existing.capability)) existingCapabilities.add(existing.capability);
            }
            const capabilities = new Set<LogicalModelCapability>(channel.advancedConfig ? [detected.capability, ...existingCapabilities] : existingCapabilities.size ? existingCapabilities : [detected.capability]);
            for (const capability of capabilities) {
                const key = logicalCatalogKey(id, capability);
                const model = catalog.get(key) || { upstreamModel: id, capability, bindings: [] };
                if (!model.bindings.some((binding) => binding.channel.id === channel.id)) model.bindings.push({ channel, channelIndex, upstreamModel });
                catalog.set(key, model);
            }
        });
    });

    const usedExistingIds = new Set<string>();
    const usedModelIds = new Set<string>();
    return Array.from(catalog.values()).map((catalogModel) => {
        const modelKey = normalizeModelName(catalogModel.upstreamModel);
        const matchingModels = existingModels.filter((model) => model.capability === catalogModel.capability && model.bindings?.some((binding) => normalizeModelName(binding.upstreamModel) === modelKey));
        const existing = matchingModels.find((model) => normalizeModelName(model.id) === modelKey && !usedExistingIds.has(model.id.toLowerCase())) || matchingModels.find((model) => !usedExistingIds.has(model.id.toLowerCase()));
        if (existing) usedExistingIds.add(existing.id.toLowerCase());
        const id = uniqueLogicalModelId(existing?.id || catalogModel.upstreamModel, usedModelIds, catalogModel.capability);
        const bindings = catalogModel.bindings
            .map(({ channel, channelIndex, upstreamModel }) => {
                const stored = findStoredBinding(existing, existingModels, channel.id, upstreamModel, catalogModel.capability);
                const capabilityProfile = normalizeStoredCapabilityProfile(stored?.capabilityProfile);
                const weight = clampWeight(stored?.weight);
                return {
                    id: text(stored?.id, 120) || `${channel.id}:${rawModelName(upstreamModel)}`,
                    channelId: channel.id,
                    upstreamModel,
                    enabled: stored?.enabled !== false,
                    priority: clampPriority(stored?.priority, channelIndex + 1),
                    ...(weight !== undefined ? { weight } : {}),
                    ...(capabilityProfile ? { capabilityProfile } : {}),
                };
            })
            .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
        const fallbackModelIds = catalogModel.capability === "video" ? normalizeFallbackModelIds(existing?.fallbackModelIds, id) : [];
        return {
            id,
            name: text(existing?.name, 120) || catalogModel.upstreamModel,
            capability: catalogModel.capability,
            enabled: existing?.enabled !== false,
            bindings,
            ...(fallbackModelIds.length ? { fallbackModelIds } : {}),
            ...(catalogModel.capability === "video" && existing?.fallbackStrategy === "cheapest" ? { fallbackStrategy: "cheapest" as const } : {}),
        };
    });
}

export function mergeChannelModelsIntoLogicalModels(logicalModels: LogicalModel[], channels: SystemModelChannel[]) {
    return synchronizeLogicalModelsWithChannels(logicalModels, channels);
}

export function normalizeDefaultModelsConfig(defaults: Partial<SystemDefaultModels> | undefined, logicalModels: LogicalModel[], channels: SystemModelChannel[]): SystemDefaultModels {
    const normalized = Object.fromEntries(
        (Object.entries(CAPABILITY_DEFAULT_KEYS) as Array<[LogicalModelCapability, keyof SystemDefaultModels]>).map(([capability, key]) => {
            const modelId = text(defaults?.[key], 120);
            if (!modelId || isLogicalModelResolvable(logicalModels, channels, capability, modelId)) return [key, modelId];
            const fallback = logicalModels.find((model) => model.capability === capability && isLogicalModelResolvable(logicalModels, channels, capability, model.id));
            return [key, fallback?.id || ""];
        }),
    ) as SystemDefaultModels;
    const optionalAudioDefault = (key: "voiceDesignModel" | "voiceCloneModel") => {
        const modelId = text(defaults?.[key], 120);
        return modelId && isLogicalModelResolvable(logicalModels, channels, "audio", modelId) ? modelId : "";
    };
    const voiceDesignModel = optionalAudioDefault("voiceDesignModel");
    const voiceCloneModel = optionalAudioDefault("voiceCloneModel");
    return { ...normalized, ...(voiceDesignModel ? { voiceDesignModel } : {}), ...(voiceCloneModel ? { voiceCloneModel } : {}) };
}

export function isLogicalModelResolvable(logicalModels: LogicalModel[], channels: SystemModelChannel[], capability: LogicalModelCapability, modelId: string) {
    return Boolean(resolveLogicalModelConfig(logicalModels, channels, capability, modelId));
}

export function resolveLogicalModelConfig(logicalModels: LogicalModel[], channels: SystemModelChannel[], capability: LogicalModelCapability, modelId: string) {
    const logical = logicalModels.find((model) => model.enabled && model.capability === capability && model.id.toLowerCase() === rawModelName(modelId).toLowerCase());
    if (!logical) return null;
    for (const routeModel of [logical, ...fallbackLogicalModels(logicalModels, logical)]) {
        const bindings = [...routeModel.bindings].filter((binding) => binding.enabled).sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
        for (const binding of bindings) {
            const channel = channels.find((item) => item.id === binding.channelId && item.enabled && channelConnectionReady(item) && channelSupportsModel(item, binding.upstreamModel));
            if (channel) return { logicalModel: logical, binding, channel };
        }
    }
    return null;
}

/** Validate only fields supplied in an admin routing payload before catalog synchronization. */
export function logicalModelRoutingInputErrors(logicalModels: LogicalModel[]) {
    const errors: string[] = [];
    for (const model of logicalModels) {
        const key = rawModelName(model.id).toLowerCase();
        if (model.fallbackStrategy && model.capability !== "video") errors.push(`只有视频逻辑模型可以配置后备排序策略：${model.id}`);
        if (model.fallbackStrategy && !["priority", "cheapest"].includes(model.fallbackStrategy)) errors.push(`视频逻辑模型 ${model.id} 的候选排序策略无效`);
        if (model.fallbackModelIds?.length && model.capability !== "video") errors.push(`只有视频逻辑模型可以配置后备模型：${model.id}`);
        const fallbackIds = new Set<string>();
        for (const fallbackId of model.fallbackModelIds || []) {
            const normalizedFallbackId = rawModelName(fallbackId).toLowerCase();
            if (normalizedFallbackId === key) {
                errors.push(`视频逻辑模型 ${model.id} 不能引用自身作为后备模型`);
                continue;
            }
            if (fallbackIds.has(normalizedFallbackId)) {
                errors.push(`视频逻辑模型 ${model.id} 存在重复后备模型：${fallbackId}`);
                continue;
            }
            fallbackIds.add(normalizedFallbackId);
            const fallback = logicalModels.find((candidate) => rawModelName(candidate.id).toLowerCase() === normalizedFallbackId);
            if (!fallback) errors.push(`视频逻辑模型 ${model.id} 引用了不存在的后备模型：${fallbackId}`);
            else if (fallback.capability !== "video") errors.push(`视频逻辑模型 ${model.id} 只能引用视频逻辑模型：${fallback.id}`);
            else if (fallback.fallbackModelIds?.length) errors.push(`视频逻辑模型 ${model.id} 不能继续引用后备模型：${fallback.id}`);
        }
        for (const binding of model.bindings || []) {
            const profile = binding.capabilityProfile;
            if (profile && "unitCost" in profile && profile.unitCost !== undefined && (!Number.isFinite(profile.unitCost) || profile.unitCost < 0)) errors.push(`逻辑模型 ${model.id} 的估算单价必须是大于等于 0 的有限数字`);
            if (profile && "unitCostCurrency" in profile && profile.unitCostCurrency !== undefined && (typeof profile.unitCostCurrency !== "string" || !profile.unitCostCurrency.trim() || profile.unitCostCurrency.trim().length > 12))
                errors.push(`逻辑模型 ${model.id} 的成本货币无效`);
            if (profile && "unitCostBasis" in profile && profile.unitCostBasis !== undefined && profile.unitCostBasis !== "call" && profile.unitCostBasis !== "second") errors.push(`逻辑模型 ${model.id} 的计费单位无效`);
        }
    }
    return Array.from(new Set(errors));
}

export function modelRoutingValidationErrors(logicalModels: LogicalModel[], channels: SystemModelChannel[], defaults: SystemDefaultModels) {
    const errors: string[] = [];
    const modelIds = new Set<string>();
    for (const model of logicalModels) {
        const key = rawModelName(model.id).toLowerCase();
        if (!key) errors.push("逻辑模型 ID 不能为空");
        else if (modelIds.has(key)) errors.push(`逻辑模型 ID 重复：${model.id}`);
        modelIds.add(key);
        if (!model.bindings.length) errors.push(`逻辑模型 ${model.name || model.id} 至少需要一个渠道绑定`);
        if (model.fallbackStrategy && model.capability !== "video") errors.push(`只有视频逻辑模型可以配置后备排序策略：${model.id}`);
        if (model.fallbackStrategy && !["priority", "cheapest"].includes(model.fallbackStrategy)) errors.push(`视频逻辑模型 ${model.id} 的候选排序策略无效`);
        if (model.fallbackModelIds?.length && model.capability !== "video") errors.push(`只有视频逻辑模型可以配置后备模型：${model.id}`);
        const fallbackIds = new Set<string>();
        for (const fallbackId of model.fallbackModelIds || []) {
            const normalizedFallbackId = rawModelName(fallbackId).toLowerCase();
            if (normalizedFallbackId === key) {
                errors.push(`视频逻辑模型 ${model.id} 不能引用自身作为后备模型`);
                continue;
            }
            if (fallbackIds.has(normalizedFallbackId)) {
                errors.push(`视频逻辑模型 ${model.id} 存在重复后备模型：${fallbackId}`);
                continue;
            }
            fallbackIds.add(normalizedFallbackId);
            const fallback = logicalModels.find((candidate) => rawModelName(candidate.id).toLowerCase() === normalizedFallbackId);
            if (!fallback) errors.push(`视频逻辑模型 ${model.id} 引用了不存在的后备模型：${fallbackId}`);
            else if (fallback.capability !== "video") errors.push(`视频逻辑模型 ${model.id} 只能引用视频逻辑模型：${fallback.id}`);
            else if (fallback.fallbackModelIds?.length) errors.push(`视频逻辑模型 ${model.id} 不能继续引用后备模型：${fallback.id}`);
        }
        const bindingKeys = new Set<string>();
        for (const binding of model.bindings) {
            const channel = channels.find((item) => item.id === binding.channelId);
            const bindingKey = `${binding.channelId}:${normalizeModelName(binding.upstreamModel)}`;
            if (!channel) errors.push(`逻辑模型 ${model.id} 引用了不存在的渠道`);
            else if (!channelSupportsModel(channel, binding.upstreamModel)) errors.push(`渠道 ${channel.name} 未启用上游模型 ${binding.upstreamModel}`);
            else if (model.capability === "audio") {
                const audioError = audioBindingValidationError(channel, binding.upstreamModel);
                if (audioError) errors.push(`逻辑模型 ${model.id}：${audioError}`);
            }
            if (bindingKeys.has(bindingKey)) errors.push(`逻辑模型 ${model.id} 存在重复绑定`);
            bindingKeys.add(bindingKey);
            const profile = binding.capabilityProfile;
            if (profile && "unitCost" in profile && profile.unitCost !== undefined && (!Number.isFinite(profile.unitCost) || profile.unitCost < 0)) errors.push(`逻辑模型 ${model.id} 的估算单价必须是大于等于 0 的有限数字`);
            if (profile && "unitCostCurrency" in profile && profile.unitCostCurrency !== undefined && (typeof profile.unitCostCurrency !== "string" || !profile.unitCostCurrency.trim() || profile.unitCostCurrency.trim().length > 12))
                errors.push(`逻辑模型 ${model.id} 的成本货币无效`);
            if (profile && "unitCostBasis" in profile && profile.unitCostBasis !== undefined && profile.unitCostBasis !== "call" && profile.unitCostBasis !== "second") errors.push(`逻辑模型 ${model.id} 的计费单位无效`);
        }
    }
    for (const [capability, key] of Object.entries(CAPABILITY_DEFAULT_KEYS) as Array<[LogicalModelCapability, keyof SystemDefaultModels]>) {
        const modelId = defaults[key];
        if (modelId && !isLogicalModelResolvable(logicalModels, channels, capability, modelId)) errors.push(`默认${capabilityLabel(capability)}模型不可解析：${modelId}`);
    }
    return Array.from(new Set(errors));
}

export function capabilityLabel(capability: LogicalModelCapability) {
    return capability === "text" ? "文本" : capability === "image" ? "图片" : capability === "video" ? "视频" : "音频";
}

export function channelModelCapability(channel: Pick<SystemModelChannel, "advancedConfig">, model: string): LogicalModelCapability {
    return resolveChannelModelCapability(channel, model).capability;
}

function resolveChannelModelCapability(channel: Pick<SystemModelChannel, "advancedConfig">, model: string) {
    const key = normalizeModelId(model);
    if (key === "auto") return { capability: "text" as const, authoritative: true };
    const config = channel.advancedConfig?.modelConfigs?.[key];
    const inferred = inferModelCapability(model);
    if (config?.source === "health" && inferred !== "text") return { capability: inferred, authoritative: true };
    const configured = config?.capability || channel.advancedConfig?.modelCapabilities?.[key];
    if (configured) return { capability: configured, authoritative: true };
    if (!config && configured === "text" && inferred !== "text") return { capability: inferred, authoritative: true };
    return configured ? { capability: configured, authoritative: true } : { capability: inferred, authoritative: false };
}

export function channelDetectedCapabilities(channel: Pick<SystemModelChannel, "advancedConfig" | "models">) {
    return new Set(channel.models.filter(isCreativeGenerationModel).map((model) => channelModelCapability(channel, model)));
}

export function resolveLogicalModelCapabilityProfile(binding: Pick<LogicalModelBinding, "capabilityProfile">, capability: LogicalModelCapability, channel?: Pick<SystemModelChannel, "advancedConfig">, upstreamModel = "") {
    if (!binding.capabilityProfile && !channel?.advancedConfig) return undefined;
    const stored = binding.capabilityProfile || {};
    const advanced = channel?.advancedConfig;
    const globalPreset = resolveGlobalAiOpcPreset(advanced, upstreamModel);
    const modelConfig = resolveChannelModelConfig(advanced, upstreamModel) || advanced?.operationConfigs?.[capability];
    return {
        supportsReferenceImage: booleanValue(stored.supportsReferenceImage, globalPreset?.supportsReferenceImage ?? modelConfig?.supportsReferenceImage ?? advanced?.supportsReferenceImage),
        supportsReferenceVideo: booleanValue(stored.supportsReferenceVideo, globalPreset?.supportsReferenceVideo ?? modelConfig?.supportsReferenceVideo ?? advanced?.supportsReferenceVideo),
        supportsReferenceAudio: booleanValue(stored.supportsReferenceAudio, globalPreset?.supportsReferenceAudio ?? modelConfig?.supportsReferenceAudio ?? advanced?.supportsReferenceAudio),
        supportsKeyframes: booleanValue(stored.supportsKeyframes, modelConfig?.supportsKeyframes),
        maxReferenceImages: positiveInteger(stored.maxReferenceImages) || positiveInteger(modelConfig?.maxReferenceImages),
        aspectRatios: normalizeAspectRatios(stored.aspectRatios),
        minDurationSeconds: positiveNumber(stored.minDurationSeconds),
        maxDurationSeconds: positiveNumber(stored.maxDurationSeconds),
        maxBatchSize: positiveInteger(stored.maxBatchSize),
        supportsAsync: booleanValue(stored.supportsAsync, capability === "video" || capability === "image"),
        supportsCancel: booleanValue(stored.supportsCancel),
        supportsWebhook: booleanValue(stored.supportsWebhook),
        timeoutMs: timeoutMilliseconds(stored.timeoutMs),
        concurrencyLimit: positiveInteger(stored.concurrencyLimit),
        unitCost: nonNegativeNumber(stored.unitCost),
        unitCostCurrency: text(stored.unitCostCurrency, 12) || undefined,
        unitCostBasis: normalizeCostBasis(stored.unitCostBasis),
    };
}

function channelSupportsModel(channel: Pick<SystemModelChannel, "models">, model: string) {
    const target = normalizeModelName(model);
    return Boolean(target && channel.models.some((item) => normalizeModelName(item) === target));
}

function channelSupportsCapability(channel: Pick<SystemModelChannel, "apiFormat" | "advancedConfig">, model: string, capability: LogicalModelCapability) {
    if (capability === "audio" && channel.apiFormat === "gemini") return false;
    const modelKey = normalizeModelId(model);
    const modelConfig = channel.advancedConfig?.modelConfigs?.[modelKey];
    if (modelConfig) {
        if (modelConfig.capability !== capability) return false;
        if (capability === "audio" && (!modelConfig.createPath || !modelConfig.requestTemplate)) return false;
        return true;
    }
    const declaredCapability = channel.advancedConfig?.modelCapabilities?.[modelKey];
    if (declaredCapability && declaredCapability !== capability) return false;
    if (capability === "audio" && (inferModelCapability(model) === "image" || inferModelCapability(model) === "video")) return false;
    const config = resolveChannelCapabilityConfig(channel.advancedConfig, model, capability);
    return Boolean(config?.createPath && config.requestTemplate) || (capability !== "audio" && !channel.advancedConfig);
}

function audioBindingValidationError(channel: SystemModelChannel, model: string) {
    if (channel.apiFormat === "gemini") return "Gemini 渠道不支持音频生成，请改用 OpenAI 兼容音频渠道";
    const protocol = channel.advancedConfig?.protocol || "auto";
    const definition = channelProtocolDefinition(protocol);
    const modelConfig = channel.advancedConfig?.modelConfigs?.[normalizeModelId(model)];
    const config = resolveChannelCapabilityConfig(channel.advancedConfig, model, "audio");
    const hasExplicitAudioRoute = modelConfig?.capability === "audio" && Boolean(modelConfig.createPath && modelConfig.requestTemplate);
    if (definition.strict && !definition.capabilities.includes("audio") && !hasExplicitAudioRoute) {
        const capabilities = definition.capabilities.map(capabilityLabel).join("、");
        return `渠道 ${channel.name || protocol} 使用${definition.label}，仅支持${capabilities}；请新建 OpenAI 兼容音频渠道并按 TTS 文档配置 /audio/speech`;
    }
    if (inferModelCapability(model) === "image" || inferModelCapability(model) === "video") return "图片或视频模型不能作为音频模型，请配置明确的音频模型";
    if (channel.advancedConfig?.modelCapabilities?.[normalizeModelId(model)] && channel.advancedConfig.modelCapabilities[normalizeModelId(model)] !== "audio")
        return "上游模型已声明为文本模型，不能作为音频模型；请在供应商模型目录中启用真实音频模型并标记为音频能力";
    if (modelConfig && modelConfig.capability !== "audio") return "上游模型已声明为文本模型，不能作为音频模型；请在供应商模型目录中启用真实音频模型并标记为音频能力";
    if (!config?.createPath || !config.requestTemplate) return "缺少音频创建路径或请求模板";
    if (config.audioOperation === "voice-design" || config.audioOperation === "voice-clone") {
        if (!config.voiceIdField || !config.previewAudioField) return "声纹创建模型必须配置 voice_id 和试听音频返回字段";
        if (config.audioOperation === "voice-clone" && (!config.cloneSampleField || !/\{\{\s*(?:clone_sample_url|sample_audio_url|sample_url)\s*\}\}/i.test(config.requestTemplate))) return "Voice Clone 必须配置样本字段和公网样本 URL 请求模板";
        return "";
    }
    if (isOpenAiAudioDialogueProtocol(config.protocol || channel.advancedConfig?.protocol)) {
        if (!/^\/(?:chat\/completions|responses)$/.test(config.createPath)) return "Chat/Responses 音频协议只允许 /chat/completions 或 /responses";
        return "";
    }
    if (isOpenAiSpeechProtocol(channel.advancedConfig?.protocol) && config.createPath !== "/audio/speech") return "OpenAI TTS 音频创建路径必须为 /audio/speech";
    if (!/(?:audio|speech|voice|tts)/i.test(config.createPath) || /(?:images?|videos?)/i.test(config.createPath)) return `音频创建路径无效：${config.createPath}`;
    return "";
}

function isOpenAiSpeechProtocol(protocol: SystemChannelProtocol | undefined) {
    return protocol === "openai" || protocol === "sub2api" || protocol === "newapi" || protocol === "compatible";
}

function isOpenAiAudioDialogueProtocol(protocol: SystemChannelProtocol | undefined) {
    return protocol === "openai-audio-dialogue";
}

function findStoredBinding(existing: LogicalModel | undefined, models: LogicalModel[], channelId: string, upstreamModel: string, capability: LogicalModelCapability) {
    const modelKey = normalizeModelName(upstreamModel);
    return (
        existing?.bindings.find((binding) => binding.channelId === channelId && normalizeModelName(binding.upstreamModel) === modelKey) ||
        models
            .filter((model) => model.capability === capability)
            .flatMap((model) => model.bindings || [])
            .find((binding) => binding.channelId === channelId && normalizeModelName(binding.upstreamModel) === modelKey)
    );
}

function uniqueLogicalModelId(value: string, usedIds: Set<string>, capability: LogicalModelCapability) {
    const base = text(rawModelName(value), 120) || "model";
    let candidate = base;
    if (usedIds.has(candidate.toLowerCase())) candidate = `${base}::${capability}`;
    let suffix = 2;
    while (usedIds.has(candidate.toLowerCase())) {
        const ending = `-${suffix++}`;
        candidate = `${base.slice(0, 120 - ending.length)}${ending}`;
    }
    usedIds.add(candidate.toLowerCase());
    return candidate;
}

function normalizeStoredCapabilityProfile(value: unknown): LogicalModelCapabilityProfile | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const input = value as Record<string, unknown>;
    const profile: LogicalModelCapabilityProfile = {
        supportsReferenceImage: optionalBoolean(input.supportsReferenceImage),
        supportsReferenceVideo: optionalBoolean(input.supportsReferenceVideo),
        supportsReferenceAudio: optionalBoolean(input.supportsReferenceAudio),
        supportsKeyframes: optionalBoolean(input.supportsKeyframes),
        maxReferenceImages: positiveInteger(input.maxReferenceImages),
        aspectRatios: normalizeAspectRatios(input.aspectRatios),
        minDurationSeconds: positiveNumber(input.minDurationSeconds),
        maxDurationSeconds: positiveNumber(input.maxDurationSeconds),
        maxBatchSize: positiveInteger(input.maxBatchSize),
        supportsAsync: optionalBoolean(input.supportsAsync),
        supportsCancel: optionalBoolean(input.supportsCancel),
        supportsWebhook: optionalBoolean(input.supportsWebhook),
        timeoutMs: timeoutMilliseconds(input.timeoutMs),
        concurrencyLimit: positiveInteger(input.concurrencyLimit),
        unitCost: nonNegativeNumber(input.unitCost),
        unitCostCurrency: text(input.unitCostCurrency, 12) || undefined,
        unitCostBasis: normalizeCostBasis(input.unitCostBasis),
    };
    return Object.values(profile).some((item) => item !== undefined && (!Array.isArray(item) || item.length > 0)) ? profile : undefined;
}

function normalizeFallbackModelIds(value: unknown, currentId: string) {
    if (!Array.isArray(value)) return [];
    const current = rawModelName(currentId).toLowerCase();
    const seen = new Set<string>();
    return value.flatMap((item) => {
        if (typeof item !== "string") return [];
        const id = rawModelName(item).trim();
        const normalized = id.toLowerCase();
        if (!id || normalized === current || seen.has(normalized)) return [];
        seen.add(normalized);
        return [id];
    });
}

function fallbackLogicalModels(models: LogicalModel[], logical: LogicalModel) {
    return (logical.fallbackModelIds || []).flatMap((id) => {
        const target = models.find((model) => model.enabled && model.capability === "video" && model.id.toLowerCase() === rawModelName(id).toLowerCase());
        return target && !target.fallbackModelIds?.length ? [target] : [];
    });
}

function normalizeCostBasis(value: unknown): LogicalModelCostBasis | undefined {
    return value === "call" || value === "second" ? value : undefined;
}

function optionalBoolean(value: unknown) {
    return typeof value === "boolean" ? value : undefined;
}

function booleanValue(value: unknown, fallback = false) {
    return typeof value === "boolean" ? value : Boolean(fallback);
}

function positiveInteger(value: unknown) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number > 0 ? Math.min(number, 1000000) : undefined;
}

function timeoutMilliseconds(value: unknown) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number > 0 ? Math.min(number, 30 * 60_000) : undefined;
}

function positiveNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.min(number, 100000000) : undefined;
}

function nonNegativeNumber(value: unknown) {
    if (value === undefined || value === null || value === "") return undefined;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.min(number, 100000000) : undefined;
}

function normalizeAspectRatios(value: unknown) {
    if (!Array.isArray(value)) return undefined;
    const ratios = Array.from(
        new Set(
            value
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim().slice(0, 20))
                .filter(Boolean),
        ),
    ).slice(0, 12);
    return ratios.length ? ratios : undefined;
}

function normalizeModelName(value: string) {
    return rawModelName(value).toLowerCase();
}

function logicalCatalogKey(upstreamModel: string, capability: LogicalModelCapability) {
    return `${normalizeModelName(upstreamModel)}::${capability}`;
}

function rawModelName(value: string) {
    return String(value || "")
        .trim()
        .replace(/^models\//i, "");
}

function clampPriority(value: unknown, fallback: number) {
    return Math.max(1, Math.min(10000, Math.floor(Number(value) || fallback)));
}

function clampWeight(value: unknown) {
    const weight = Math.floor(Number(value));
    return Number.isFinite(weight) && weight > 0 ? Math.min(weight, 10000) : undefined;
}

function text(value: unknown, maxLength: number) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
