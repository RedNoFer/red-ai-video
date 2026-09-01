import type { ApiCallFormat, LogicalModelCapability, SystemChannelAdvancedConfig, SystemChannelAuthMode, SystemChannelModelConfig, SystemChannelProtocol, SystemModelChannel } from "@/lib/auth/store-types";
import { inferModelCapability, normalizeModelId } from "@/lib/model-capability";
import { SEEDANCE_SPECIAL_MODELS } from "@/lib/seedance-special";
import { normalizeYumengModelCenterBaseUrl, YUMENG_DEFAULT_IMAGE_OPERATION, YUMENG_DEFAULT_VIDEO_OPERATION, YUMENG_MODEL_CENTER_BASE_URL, YUMENG_MODEL_CENTER_MODELS } from "@/lib/yumeng-model-center";

type ProtocolOperation = Omit<SystemChannelModelConfig, "capability" | "source" | "protocol" | "apiFormat"> & {
    capability: LogicalModelCapability;
};

export type ChannelProtocolDefinition = {
    id: SystemChannelProtocol;
    label: string;
    description: string;
    apiFormat: ApiCallFormat;
    authMode: SystemChannelAuthMode;
    defaultBaseUrl?: string;
    modelCatalogPaths: string[];
    capabilities: LogicalModelCapability[];
    operations: Partial<Record<LogicalModelCapability, ProtocolOperation>>;
    builtInModels?: ReadonlyArray<{ id: string; label: string; capability: LogicalModelCapability; operation?: ProtocolOperation }>;
    strict?: boolean;
    advanced?: boolean;
};

const openAiOperations: ChannelProtocolDefinition["operations"] = {
    text: { capability: "text", createPath: "/chat/completions", requestTemplate: '{"model":"{{model}}","messages":[{"role":"user","content":"{{prompt}}"}]}', resultField: "choices[0].message.content" },
    image: {
        capability: "image",
        createPath: "/images/generations",
        editPath: "/images/edits",
        requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","size":"{{size}}","quality":"{{quality}}"}',
        resultField: "data[0].url / data[0].b64_json",
        referenceRule: "文生图使用 /images/generations；参考图编辑使用 /images/edits multipart/form-data。",
        supportsReferenceImage: true,
    },
    video: {
        capability: "video",
        createPath: "/videos",
        imageToVideoPath: "/videos",
        queryPath: "/videos/:task_id",
        requestTemplate: "multipart/form-data: model、prompt、seconds、size、input_reference",
        resultField: "/videos/:task_id/content",
        statusField: "status",
        referenceRule: "参考图使用 multipart/form-data 的单个 input_reference 文件字段。",
        supportsReferenceImage: true,
    },
    audio: { capability: "audio", createPath: "/audio/speech", requestTemplate: '{"model":"{{model}}","input":"{{prompt}}","voice":"alloy","response_format":"mp3"}', resultField: "binary" },
};

const openAiAudioDialogueOperation: ProtocolOperation = {
    capability: "audio",
    createPath: "/chat/completions",
    requestTemplate:
        '{"model":"{{model}}","messages":[{"role":"user","content":"{{prompt}}"}],"modalities":["text","audio"],"audio":{"voice":"{{voice}}","format":"{{format}}"}}',
    resultField: "choices[0].message.audio / output[0].content[0].audio / audio",
    statusField: "status / state",
    referenceRule: "使用 Chat Completions 或 Responses 音频输出；音频结果必须由服务端下载并落盘后再播放，不回退 /audio/speech。",
};

const geminiVideoOperation: ProtocolOperation = {
    capability: "video",
    createPath: "/models/:model:predictLongRunning",
    imageToVideoPath: "/models/:model:predictLongRunning",
    queryPath: "/models/:model/operations/:task_id",
    requestTemplate:
        '{"instances":[{"prompt":"{{prompt}}","image":"{{image}}","lastFrame":"{{last_frame}}","referenceImages":"{{references}}"}],"parameters":{"durationSeconds":"{{duration}}","aspectRatio":"{{ratio}}","resolution":"{{resolution}}","generateAudio":"{{generate_audio}}"}}',
    resultField: "response.generateVideoResponse.generatedSamples[0].video.uri",
    statusField: "done",
    durationRange: "4、6、8 秒",
    referenceRule: "服务端将参考图片转为 inlineData；支持普通参考图、首帧和尾帧，不支持参考视频或参考音频。",
    supportsReferenceImage: true,
    supportsReferenceVideo: false,
    supportsReferenceAudio: false,
};

const seedanceOperation: ProtocolOperation = {
    capability: "video",
    createPath: "/contents/generations/tasks",
    imageToVideoPath: "/contents/generations/tasks",
    queryPath: "/contents/generations/tasks/:task_id",
    requestTemplate: '{"model":"{{model}}","content":"{{content}}","ratio":"{{ratio}}","resolution":"{{resolution}}","duration":"{{duration}}","generate_audio":true,"watermark":false}',
    resultField: "content.video_url",
    statusField: "status",
    durationRange: "4-15 秒，具体范围以模型文档为准",
    referenceRule: "图片、视频和音频使用 content 多模态数组；首帧与尾帧分别使用 first_frame、last_frame 角色；媒体必须使用上游可访问的 URL 或供应商素材 ID。",
    supportsReferenceImage: true,
    supportsReferenceVideo: true,
    supportsReferenceAudio: true,
};

const seedanceSpecialOperation: ProtocolOperation = {
    capability: "video",
    createPath: "/v1/seedance-special/videos",
    imageToVideoPath: "/v1/seedance-special/videos",
    queryPath: "/v1/result/:task_id",
    requestTemplate: '{"model":"{{model}}","ratio":"{{ratio}}","duration":"{{duration}}","generate_audio":true,"return_last_frame":false,"seed":-1,"content":"{{content}}"}',
    resultField: "video_url",
    statusField: "status",
    durationRange: "4-15 秒",
    referenceRule: "严格使用 content 数组；图片/视频/音频只能是公网 URL 或 assetId://，禁止 base64。首帧、首尾帧和多模态参考不可混用；音频不能单独输入。",
    supportsReferenceImage: true,
    supportsReferenceVideo: true,
    supportsReferenceAudio: true,
};

const newApiVideoOperation: ProtocolOperation = {
    capability: "video",
    createPath: "/v1/videos",
    imageToVideoPath: "/v1/videos",
    queryPath: "/v1/videos/:task_id",
    requestTemplate:
        '{"model":"{{model}}","prompt":"{{prompt}}","duration":"{{duration}}","ratio":"{{ratio}}","resolution":"{{resolution}}","referenceImages":"{{images}}","referenceVideos":"{{videos}}","referenceAudios":"{{audios}}"}',
    resultField: "video_url / data.url / url",
    statusField: "status",
    referenceRule: "参考图片最多 9 张、参考视频最多 3 个、参考音频最多 3 个；所有素材必须是公网可访问的 http/https URL 或站点签名地址；不支持显式首帧或尾帧。",
    supportsReferenceImage: true,
    supportsReferenceVideo: true,
    supportsReferenceAudio: true,
};

const vozebRecommendedVideoOperation: ProtocolOperation = {
    capability: "video",
    createPath: "/v1/videos/generations",
    imageToVideoPath: "/v1/videos/generations",
    queryPath: "/v1/videos/generations/:task_id",
    requestTemplate:
        '{"model":"{{model}}","prompt":"{{prompt}}","duration":"{{duration}}","resolution":"{{resolution}}","generate_audio":"{{generate_audio}}","aspect_ratio":"{{aspect_ratio}}","images":"{{images}}","videos":"{{videos}}","audios":"{{audios}}"}',
    resultField: "metadata.url",
    statusField: "status",
    durationRange: "5-15 秒",
    referenceRule: "使用 application/json；参考图片、视频和音频分别写入 images、videos、audios 字符串数组。Seedance 2.0-fast-720p 仅支持参考图片且不支持声音生成。",
    supportsReferenceImage: true,
    supportsReferenceVideo: true,
    supportsReferenceAudio: true,
};

const bumingSeedanceVideoOperation: ProtocolOperation = {
    capability: "video",
    createPath: "/v1/videos/generations",
    imageToVideoPath: "/v1/videos/generations",
    queryPath: "/v1/tasks/:task_id",
    requestTemplate:
        '{"model":"{{model}}","prompt":"{{prompt}}","mode":"{{mode}}","duration":"{{duration}}","aspect_ratio":"{{aspect_ratio}}","resolution":"{{resolution}}","quality":"{{quality}}","client_request_id":"{{client_request_id}}","images":"{{images}}","videos":"{{videos}}","audios":"{{audios}}","count":1}',
    resultField: "output_url / result_url / result.videos[0].url / result.videos[0].video_url / output.videos[0].url",
    statusField: "state / status",
    durationRange: "4-15 秒",
    referenceRule: "使用 application/json 扁平请求；参考图、参考视频、参考音频分别写入 images、videos、audios URL 数组。首帧/首尾帧通过 mode=text-to-video、reference、first-frame、first-last 区分，首尾帧模式下 images 数组前两项依次为首帧和尾帧。全能帧使用 mode=reference，连续帧按 images 前序排列并在 prompt 中以 @图片N 标注。媒体必须是上游可访问的 URL 或供应商素材 ID。",
    supportsReferenceImage: true,
    supportsReferenceVideo: true,
    supportsReferenceAudio: true,
};

export type BumingSeedanceVideoModelContract = {
    videoReferenceModes: Array<"reference" | "first_frame" | "first_last" | "all_frames">;
    maxReferenceImages?: number;
    supportsReferenceVideo: boolean;
    supportsReferenceAudio: boolean;
    quality?: string;
    requestTemplate?: string;
};

const BUMING_SEEDANCE_VIDEO_MODEL_CONTRACTS: Record<string, BumingSeedanceVideoModelContract> = {
    "seedance-2-0-official": {
        videoReferenceModes: ["reference", "first_frame", "first_last", "all_frames"],
        maxReferenceImages: 9,
        supportsReferenceVideo: true,
        supportsReferenceAudio: true,
        quality: "mini",
    },
    "seedance-2-0-special": {
        videoReferenceModes: ["reference", "first_frame", "first_last", "all_frames"],
        maxReferenceImages: 9,
        supportsReferenceVideo: true,
        supportsReferenceAudio: true,
        quality: "标准",
    },
    "seedance-2-0-manju-special": {
        videoReferenceModes: ["first_frame", "first_last"],
        maxReferenceImages: 2,
        supportsReferenceVideo: false,
        supportsReferenceAudio: false,
        requestTemplate:
            '{"model":"{{model}}","prompt":"{{prompt}}","mode":"{{mode}}","duration":"{{duration}}","aspect_ratio":"{{aspect_ratio}}","resolution":"{{resolution}}","client_request_id":"{{client_request_id}}","images":"{{images}}","count":1}',
    },
};

export function resolveBumingSeedanceVideoModelContract(model: string): BumingSeedanceVideoModelContract {
    return (
        BUMING_SEEDANCE_VIDEO_MODEL_CONTRACTS[normalizeModelId(model)] || {
        videoReferenceModes: ["reference", "first_frame", "first_last"],
        supportsReferenceVideo: true,
        supportsReferenceAudio: true,
        quality: "mini",
    }
    );
}

const bumingImageOperation: ProtocolOperation = {
    capability: "image",
    createPath: "/api/v1/model-runtime/invoke",
    queryPath: "/api/v1/model-runtime/tasks/:task_id",
    requestTemplate:
        '{"modality":"image","model_id":"{{model}}","operation":"generate","params":{"prompt":"{{prompt}}","mode":"{{mode}}","aspect_ratio":"{{aspect_ratio}}","size":"{{size}}","resolution":"{{resolution}}","quality":"{{quality}}","count":1,"output_format":"{{output_format}}","images":"{{images}}"}}',
    resultField: "result_url / output_url / result.images[0].url",
    statusField: "status / state",
    referenceRule: "文生图使用 mode=text-to-image；图生图使用 mode=image-edit，参考图必须是供应商可访问的公网 URL 数组并写入 images。",
    supportsReferenceImage: true,
};

const bumingVoiceDesignOperation: ProtocolOperation = {
    capability: "audio",
    createPath: "/v1/media/generate",
    requestTemplate: '{"model":"{{model}}","prompt":"{{design_prompt}}"}',
    voiceIdField: "voice_id",
    previewAudioField: "trial_audio",
    resultField: "trial_audio",
    audioOperation: "voice-design",
    referenceRule: "Voice Design 使用文字描述生成新的专属声纹；返回 voice_id 与 trial_audio。Voice Clone 的样本字段必须由管理员单独配置，平台不会猜测上传字段。",
};

const stableDiffusionOperation: ProtocolOperation = {
    capability: "image",
    createPath: "/sdapi/v1/txt2img",
    editPath: "/sdapi/v1/img2img",
    requestTemplate: '{"prompt":"{{prompt}}","width":"{{width}}","height":"{{height}}","batch_size":1,"init_images":"{{images}}","override_settings":{"sd_model_checkpoint":"{{model}}"},"override_settings_restore_afterwards":true}',
    resultField: "images[0]",
    referenceRule: "文生图使用 txt2img；图生图使用 img2img，参考图写入 init_images 数组。",
    supportsReferenceImage: true,
};

export const registeredChannelProtocolDefinitions: ChannelProtocolDefinition[] = [
    {
        id: "openai",
        label: "OpenAI",
        description: "OpenAI 官方及严格兼容接口，支持文本、图片、视频和语音。",
        apiFormat: "openai",
        authMode: "bearer",
        modelCatalogPaths: ["/v1/models"],
        capabilities: ["text", "image", "video", "audio"],
        operations: openAiOperations,
        strict: true,
    },
    {
        id: "openai-audio-dialogue",
        label: "OpenAI Chat/Responses 音频",
        description: "使用 Chat Completions 或 Responses 的文本加音频输出协议生成角色试听；不使用 /audio/speech TTS。",
        apiFormat: "openai",
        authMode: "bearer",
        modelCatalogPaths: ["/v1/models"],
        capabilities: ["audio"],
        operations: { audio: openAiAudioDialogueOperation },
        strict: true,
    },
    {
        id: "yumeng",
        label: "昱梦",
        description: "昱梦新版模型中心协议，统一提交和查询图片、视频异步任务。",
        apiFormat: "openai",
        authMode: "bearer",
        defaultBaseUrl: YUMENG_MODEL_CENTER_BASE_URL,
        modelCatalogPaths: [],
        builtInModels: YUMENG_MODEL_CENTER_MODELS,
        capabilities: ["image", "video"],
        operations: { image: YUMENG_DEFAULT_IMAGE_OPERATION, video: YUMENG_DEFAULT_VIDEO_OPERATION },
        strict: true,
    },
    {
        id: "gemini",
        label: "Google Gemini / Veo",
        description: "Google Gemini API 的 Veo 异步视频协议，使用 predictLongRunning 与 operation 轮询。",
        apiFormat: "gemini",
        authMode: "custom-header",
        defaultBaseUrl: "https://generativelanguage.googleapis.com",
        modelCatalogPaths: ["/v1beta/models"],
        capabilities: ["video"],
        operations: { video: geminiVideoOperation },
        strict: true,
    },
    {
        id: "seedance",
        label: "Seedance 2.0 / SD2",
        description: "Seedance 2.0 多模态视频协议。SD2 在这里不表示 Stable Diffusion。",
        apiFormat: "openai",
        authMode: "bearer",
        modelCatalogPaths: ["/models"],
        capabilities: ["video"],
        operations: { video: seedanceOperation },
        strict: true,
    },
    {
        id: "stable-diffusion",
        label: "Stable Diffusion（SD）",
        description: "Automatic1111 / Forge WebUI 图片协议；与 Seedance 2.0（SD2）视频协议完全独立。",
        apiFormat: "openai",
        authMode: "none",
        modelCatalogPaths: ["/sdapi/v1/sd-models"],
        capabilities: ["image"],
        operations: { image: stableDiffusionOperation },
        strict: true,
    },
    {
        id: "volcengine-video",
        label: "火山方舟视频",
        description: "火山方舟视频生成协议，仅配置视频模型与文生视频、图生视频任务路径。",
        apiFormat: "openai",
        authMode: "bearer",
        defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        modelCatalogPaths: ["/api/v3/models"],
        capabilities: ["video"],
        operations: { video: seedanceOperation },
        strict: true,
    },
    {
        id: "sub2api",
        label: "sub2api",
        description: "sub2api 聚合接口；图片严格沿用供应商的 OpenAI 图片契约，文生图使用 generations，图生图使用 edits。",
        apiFormat: "openai",
        authMode: "bearer",
        modelCatalogPaths: ["/v1/models"],
        capabilities: ["text", "image", "video", "audio"],
        operations: {
            ...openAiOperations,
            image: {
                ...openAiOperations.image!,
                editPath: "/images/edits",
                requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","images":[{"image_url":"{{image}}"}],"size":"{{size}}","quality":"{{quality}}","output_format":"png"}',
                referenceRule: "图生图使用 /images/edits JSON 请求体，参考图字段必须是 images 数组中的 image_url；站内参考图先上传到供应商文件接口，再使用返回的公网 URL。",
            },
        },
        strict: true,
    },
    {
        id: "newapi",
        label: "New API",
        description: "New API 聚合网关，按 OpenAI 路径调用并保留独立协议身份。",
        apiFormat: "openai",
        authMode: "bearer",
        modelCatalogPaths: ["/v1/models"],
        capabilities: ["text", "image", "video", "audio"],
        operations: openAiOperations,
        strict: true,
    },
    {
        id: "newapi-video",
        label: "New API 视频（MegabyAI）",
        description: "MegabyAI New API 视频中转协议，使用 /v1/videos 提交和查询异步任务。",
        apiFormat: "openai",
        authMode: "bearer",
        defaultBaseUrl: "https://newapi.megabyai.cc",
        modelCatalogPaths: ["/v1/models"],
        capabilities: ["video"],
        operations: { video: newApiVideoOperation },
        strict: true,
    },
    {
        id: "vozeb-recommended",
        label: "VOZEB推荐",
        description: "VOZEB 推荐的 JSON 异步视频协议，支持多模态参考素材与持久结果地址。",
        apiFormat: "openai",
        authMode: "bearer",
        defaultBaseUrl: "https://new.aiym.ink/v1",
        modelCatalogPaths: ["/v1/models"],
        capabilities: ["video"],
        operations: { video: vozebRecommendedVideoOperation },
        strict: true,
    },
    {
        id: "seedance-special",
        label: "Seedance 2.0 特价版",
        description: "按特价版接口文档固定模型、参数、素材与轮询路径。",
        apiFormat: "openai",
        authMode: "bearer",
        defaultBaseUrl: "https://zcbservice.aizfw.cn/kyyReactApiServer",
        modelCatalogPaths: [],
        capabilities: ["video"],
        operations: { video: seedanceSpecialOperation },
        builtInModels: SEEDANCE_SPECIAL_MODELS.map(([id, label]) => ({ id, label, capability: "video" as const })),
        strict: true,
    },
    {
        id: "buming-seedance",
        label: "不鸣 TokenGo Seedance",
        description: "不鸣 TokenGo 的 Seedance 视频扁平异步接口，使用 /v1/videos/generations 创建和 /v1/tasks 查询；模型 ID 以目录或供应商确认值为准。",
        apiFormat: "openai",
        authMode: "bearer",
        defaultBaseUrl: "https://api.tokengo.love",
        modelCatalogPaths: ["/v1/logical-models", "/v1/skills/models"],
        capabilities: ["video"],
        operations: { video: bumingSeedanceVideoOperation },
        strict: true,
    },
    {
        id: "buming-image",
        label: "不鸣 TokenGo 图片",
        description: "不鸣 TokenGo 的图片异步运行时协议，统一使用 model-runtime/invoke 与任务查询接口；参考图通过公网 URL 传入。",
        apiFormat: "openai",
        authMode: "bearer",
        defaultBaseUrl: "https://api.tokengo.love",
        modelCatalogPaths: ["/v1/skills/models"],
        capabilities: ["image"],
        operations: { image: bumingImageOperation },
        strict: true,
    },
    {
        id: "custom",
        label: "自定义协议",
        description: "通过文档 URL、cURL 和请求/响应示例生成可复核的声明式协议。",
        apiFormat: "openai",
        authMode: "bearer",
        modelCatalogPaths: [],
        capabilities: ["text", "image", "video", "audio"],
        operations: {},
        advanced: true,
    },
    {
        id: "globalaiopc",
        label: "GlobalAiOpc",
        description: "按现有 GlobalAiOpc 模型预设执行文本、图片与视频请求。",
        apiFormat: "openai",
        authMode: "bearer",
        modelCatalogPaths: [],
        capabilities: ["text", "image", "video"],
        operations: {},
        advanced: true,
    },
    {
        id: "compatible",
        label: "通用兼容",
        description: "保留旧版兼容模式；新接口优先使用自定义协议并完成测试。",
        apiFormat: "openai",
        authMode: "bearer",
        modelCatalogPaths: ["/v1/models"],
        capabilities: ["text", "image", "video", "audio"],
        operations: {},
        advanced: true,
    },
    {
        id: "auto",
        label: "自动识别（旧配置）",
        description: "仅用于已有渠道过渡；新增渠道应明确选择协议。",
        apiFormat: "openai",
        authMode: "bearer",
        modelCatalogPaths: ["/v1/models"],
        capabilities: ["text", "image", "video", "audio"],
        operations: {},
        advanced: true,
    },
];

const retiredProtocolIds = new Set<SystemChannelProtocol>(["vozeb-recommended", "seedance-special", "globalaiopc"]);

export const channelProtocolDefinitions = registeredChannelProtocolDefinitions.filter((definition) => !retiredProtocolIds.has(definition.id));

export function channelProtocolDefinition(protocol: SystemChannelProtocol) {
    return registeredChannelProtocolDefinitions.find((item) => item.id === protocol) || registeredChannelProtocolDefinitions.at(-1)!;
}

export function channelProtocolOptions() {
    return channelProtocolDefinitions.map(({ id: value, label, description, advanced }) => ({ value, label, description, advanced }));
}

export function channelSupportsModelCatalog(channel: Pick<SystemModelChannel, "advancedConfig">) {
    const advanced = channel.advancedConfig;
    const paths = advanced?.modelCatalogPaths ?? channelProtocolDefinition(advanced?.protocol || "auto").modelCatalogPaths;
    return paths.some((path) => Boolean(path.trim()));
}

export function channelAllowsManualModels(channel: Pick<SystemModelChannel, "advancedConfig">) {
    const definition = channelProtocolDefinition(channel.advancedConfig?.protocol || "auto");
    return channelSupportsModelCatalog(channel) || !definition.builtInModels?.length;
}

export function protocolCatalogCapability(protocol: SystemChannelProtocol): LogicalModelCapability | undefined {
    const definition = channelProtocolDefinition(protocol);
    return definition.strict && definition.capabilities.length === 1 ? definition.capabilities[0] : undefined;
}

export function protocolModelConfig(protocol: SystemChannelProtocol, capability: LogicalModelCapability, model?: string): SystemChannelModelConfig | undefined {
    const definition = channelProtocolDefinition(protocol);
    if (protocol === "buming-seedance" && capability === "audio" && normalizeModelId(model || "") === "voice-design") {
        return { ...bumingVoiceDesignOperation, capability, source: "manual", protocol, apiFormat: definition.apiFormat };
    }
    const builtIn = model ? definition.builtInModels?.find((item) => normalizeModelId(item.id) === normalizeModelId(model)) : undefined;
    const operation = builtIn?.capability === capability && builtIn.operation ? builtIn.operation : definition.operations[capability];
    if (!operation) return undefined;
    if (protocol === "buming-seedance" && capability === "video") {
        const contract = resolveBumingSeedanceVideoModelContract(model || "");
        return {
            ...operation,
            ...(contract.requestTemplate ? { requestTemplate: contract.requestTemplate } : {}),
            supportsReferenceVideo: contract.supportsReferenceVideo,
            supportsReferenceAudio: contract.supportsReferenceAudio,
            supportsKeyframes: contract.videoReferenceModes.includes("all_frames"),
            videoReferenceModes: contract.videoReferenceModes,
            ...(contract.maxReferenceImages ? { maxReferenceImages: contract.maxReferenceImages } : {}),
            capability,
            source: "manual",
            protocol,
            apiFormat: definition.apiFormat,
        };
    }
    return { ...operation, capability, source: "manual", protocol, apiFormat: definition.apiFormat };
}

export function applyModelProtocol(config: SystemChannelModelConfig, protocol: SystemChannelProtocol, model?: string): SystemChannelModelConfig {
    return protocolModelConfig(protocol, config.capability, model) || { ...config, source: "manual", protocol };
}

export function normalizeStrictProtocolModelConfig(config: SystemChannelModelConfig, fallbackProtocol: SystemChannelProtocol, model?: string): SystemChannelModelConfig {
    const protocol = config.protocol || fallbackProtocol;
    if (!channelProtocolDefinition(protocol).strict) return config;
    return protocolModelConfig(protocol, config.capability, model) || config;
}

export function resolveChannelModelConfig(config: SystemChannelAdvancedConfig | undefined, model: string) {
    if (!config) return undefined;
    const key = normalizeModelId(model);
    const modelConfig = config.modelConfigs?.[key];
    const legacyVoiceDesign = resolveLegacyVoiceDesignConfig(config, model, modelConfig);
    if (legacyVoiceDesign) return legacyVoiceDesign;
    const configuredCapability = modelConfig?.capability || config.modelCapabilities?.[key] || inferModelCapability(model);
    if (config.protocol === "sub2api" && configuredCapability === "image") {
        const strictPreset = protocolModelConfig(config.protocol, "image", model);
        if (strictPreset) return strictPreset;
    }
    if (modelConfig) {
        if (modelConfig.audioOperation) return modelConfig;
        const protocol = modelConfig.protocol || config.protocol;
        if (protocol === config.protocol && channelProtocolDefinition(protocol).strict && modelConfig.capability) return protocolModelConfig(protocol, modelConfig.capability, model) || modelConfig;
        return modelConfig;
    }
    const capability = protocolCatalogCapability(config.protocol) || config.modelCapabilities?.[key] || inferModelCapability(model);
    return config.operationConfigs?.[capability];
}

export function resolveChannelCapabilityConfig(config: SystemChannelAdvancedConfig | undefined, model: string, capability: LogicalModelCapability) {
    if (!config) return undefined;
    const modelConfig = resolveChannelModelConfig(config, model);
    if (modelConfig?.capability === capability && modelConfig.audioOperation === "voice-design") return modelConfig;
    const strictPreset = protocolModelConfig(config.protocol, capability, model);
    if (strictPreset && channelProtocolDefinition(config.protocol).strict) return strictPreset;
    if (modelConfig?.capability === capability && modelConfig.createPath && (modelConfig.requestTemplate || modelConfig.protocol === "custom")) return modelConfig;
    return config.operationConfigs?.[capability] || strictPreset;
}

/**
 * Before Voice Design had a dedicated route, `voice-design` was commonly
 * saved under the generic OpenAI TTS operation. The supplier documents a
 * distinct endpoint for this exact model, so upgrade only that unambiguous
 * legacy shape at resolution time. Explicit TTS choices remain untouched.
 */
function resolveLegacyVoiceDesignConfig(config: SystemChannelAdvancedConfig, model: string, modelConfig?: SystemChannelModelConfig) {
    if (normalizeModelId(model) !== "voice-design") return undefined;
    const protocol = modelConfig?.protocol || config.protocol;
    if (!(["openai", "auto", "compatible"] as SystemChannelProtocol[]).includes(protocol)) return undefined;
    if (modelConfig?.audioOperation) return undefined;
    const capability = modelConfig?.capability || config.modelCapabilities?.[normalizeModelId(model)] || inferModelCapability(model);
    if (capability !== "audio") return undefined;
    if (modelConfig && (modelConfig.createPath !== "/audio/speech" || !modelConfig.requestTemplate?.includes("{{prompt}}"))) return undefined;
    return protocolModelConfig("buming-seedance", "audio", "voice-design");
}

export function resolveChannelModelAdvancedConfig(config: SystemChannelAdvancedConfig | undefined, model: string) {
    if (!config) return undefined;
    const modelConfig = resolveChannelModelConfig(config, model);
    if (!modelConfig) return config;
    const { capability: _capability, apiFormat: _apiFormat, ...modelAdvanced } = modelConfig;
    return { ...config, ...modelAdvanced };
}

export function applyChannelProtocol(channel: SystemModelChannel, protocol: SystemChannelProtocol): SystemModelChannel {
    const definition = channelProtocolDefinition(protocol);
    const advanced = channel.advancedConfig || emptyAdvancedConfig();
    const builtInModels = definition.builtInModels?.map((item) => item.id) || [];
    const models = builtInModels.length ? builtInModels : protocol === "buming-seedance" ? Array.from(new Set([...channel.models, "voice-design"])) : channel.models;
    const modelConfigs = { ...(advanced.modelConfigs || {}) };
    const modelCapabilities = { ...(advanced.modelCapabilities || {}) };
    const operationConfigs = definition.strict
        ? Object.fromEntries(definition.capabilities.flatMap((capability) => (protocolModelConfig(protocol, capability) ? [[capability, protocolModelConfig(protocol, capability)!] as const] : [])))
        : protocol === "custom"
          ? advanced.operationConfigs || {}
          : {};
    for (const model of models) {
        const key = normalizeModelId(model);
        const builtIn = definition.builtInModels?.find((item) => normalizeModelId(item.id) === key);
        const capability = protocol === "buming-seedance" && key === "voice-design" ? "audio" : builtIn?.capability || protocolCatalogCapability(protocol) || modelConfigs[key]?.capability || modelCapabilities[key] || inferModelCapability(model);
        const strict = protocolModelConfig(protocol, capability, model);
        if (strict) modelConfigs[key] = strict;
        modelCapabilities[key] = capability;
    }
    const primary = definition.capabilities.length === 1 ? definition.operations[definition.capabilities[0]] : undefined;
    const primaryAdvanced = primary ? Object.fromEntries(Object.entries(primary).filter(([key]) => key !== "capability")) : {};
    return {
        ...channel,
        baseUrl: protocol === "yumeng" ? normalizeYumengModelCenterBaseUrl(channel.baseUrl) : channel.baseUrl.trim() || definition.defaultBaseUrl || "",
        apiFormat: definition.apiFormat,
        models,
        advancedConfig: {
            ...advanced,
            protocol,
            authMode: definition.authMode,
            modelCatalogPaths: definition.modelCatalogPaths,
            ...primaryAdvanced,
            modelConfigs,
            modelCapabilities,
            operationConfigs,
        },
    };
}

export function protocolAuthHeaders(apiKey: string, input: Pick<SystemChannelAdvancedConfig, "protocol" | "authMode" | "authHeader" | "authPrefix"> | undefined, fallback: ApiCallFormat = "openai"): Record<string, string> {
    if (input?.protocol === "gemini") return { "x-goog-api-key": apiKey };
    const mode = resolveChannelAuthMode(input);
    if (mode === "none") return {};
    if (fallback === "gemini" && !input?.authMode) return { "x-goog-api-key": apiKey };
    if (mode === "x-api-key") return { "x-api-key": apiKey };
    if (mode === "custom-header") {
        const name = input?.authHeader?.trim() || "x-api-key";
        const prefix = input?.authPrefix?.trim();
        return { [name]: prefix ? `${prefix} ${apiKey}` : apiKey };
    }
    return { authorization: `Bearer ${apiKey}` };
}

export function resolveChannelAuthMode(input: Pick<SystemChannelAdvancedConfig, "protocol" | "authMode"> | undefined): SystemChannelAuthMode {
    const definition = channelProtocolDefinition(input?.protocol || "auto");
    return definition.strict ? definition.authMode : input?.authMode || definition.authMode;
}

export function channelRequiresApiKey(channel: Pick<SystemModelChannel, "advancedConfig">) {
    return resolveChannelAuthMode(channel.advancedConfig) !== "none";
}

export function channelCredentialsReady(channel: Pick<SystemModelChannel, "apiKey" | "hasApiKey" | "advancedConfig">) {
    return !channelRequiresApiKey(channel) || Boolean(channel.apiKey.trim() || channel.hasApiKey);
}

export function channelConnectionReady(channel: Pick<SystemModelChannel, "baseUrl" | "apiKey" | "hasApiKey" | "advancedConfig">) {
    return Boolean(channel.baseUrl.trim() && channelCredentialsReady(channel));
}

export function channelProtocolValidationErrors(channel: SystemModelChannel) {
    const advanced = channel.advancedConfig;
    if (!advanced) return [];
    const errors: string[] = [];
    const definition = channelProtocolDefinition(advanced.protocol);
    if (definition.strict && advanced.authMode && advanced.authMode !== definition.authMode) errors.push(`${channel.name || "渠道"} 的鉴权方式必须使用 ${definition.label} 协议预设`);
    if (advanced.authMode === "custom-header" && !isSafeAuthHeaderName(advanced.authHeader)) errors.push(`${channel.name || "渠道"} 的自定义鉴权请求头名称无效`);
    for (const model of channel.models) {
        const key = normalizeModelId(model);
        const config = advanced.modelConfigs?.[key] || resolveChannelModelConfig(advanced, model);
        const protocol = config?.protocol || advanced.protocol;
        const definition = channelProtocolDefinition(protocol);
        if (protocol === "custom") {
            if (!config?.createPath) errors.push(`${model} 的自定义协议缺少创建路径`);
            if (!config?.requestTemplate) errors.push(`${model} 的自定义协议缺少请求模板`);
            if (!config?.resultField && config?.capability !== "audio") errors.push(`${model} 的自定义协议缺少结果字段`);
            continue;
        }
        if (!definition.strict) continue;
        const capability = config?.capability || advanced.modelCapabilities?.[key] || inferModelCapability(model);
        const expected = protocolModelConfig(protocol, capability, model);
        if (!expected) {
            errors.push(`${definition.label} 不支持 ${capability} 模型 ${model}`);
            continue;
        }
        if (definition.builtInModels && !definition.builtInModels.some((item) => normalizeModelId(item.id) === key)) errors.push(`${model} 不在 ${definition.label} 文档模型列表中`);
        if (!config) {
            errors.push(`${model} 缺少 ${definition.label} 的严格模型配置`);
            continue;
        }
        if (config.protocol !== protocol) errors.push(`${model} 的协议必须为 ${protocol}`);
        if ((config.apiFormat || definition.apiFormat) !== expected.apiFormat) errors.push(`${model} 的 API 格式必须为 ${expected.apiFormat}`);
        if (protocol === "openai-audio-dialogue") {
            if (config.capability !== "audio") errors.push(`${model} 的 Chat/Responses 音频配置必须声明为音频能力`);
            if (!/^\/(?:chat\/completions|responses)$/.test(config.createPath || "")) errors.push(`${model} 的 Chat/Responses 音频创建路径必须为 /chat/completions 或 /responses`);
            if (!config.requestTemplate || !/audio/i.test(config.requestTemplate) || !/modalit(?:y|ies)/i.test(config.requestTemplate)) errors.push(`${model} 的 Chat/Responses 音频请求模板必须声明 modalities 和 audio`);
            if (!config.resultField) errors.push(`${model} 的 Chat/Responses 音频结果字段不能为空`);
            continue;
        }
        if (config.createPath !== expected.createPath) errors.push(`${model} 的创建路径必须为 ${expected.createPath}`);
        if ((config.editPath || "") !== (expected.editPath || "")) errors.push(`${model} 的图生图路径必须为 ${expected.editPath || "空"}`);
        if ((config.imageToVideoPath || "") !== (expected.imageToVideoPath || "")) errors.push(`${model} 的图生视频路径必须为 ${expected.imageToVideoPath || "空"}`);
        if ((config.queryPath || "") !== (expected.queryPath || "")) errors.push(`${model} 的查询路径必须为 ${expected.queryPath || "空"}`);
        if ((config.requestTemplate || "") !== (expected.requestTemplate || "")) errors.push(`${model} 的请求参数必须使用 ${definition.label} 协议预设`);
        if ((config.resultField || "") !== (expected.resultField || "")) errors.push(`${model} 的结果字段必须使用 ${definition.label} 协议预设`);
        if ((config.statusField || "") !== (expected.statusField || "")) errors.push(`${model} 的状态字段必须使用 ${definition.label} 协议预设`);
        if ((config.audioOperation || "") !== (expected.audioOperation || "")) errors.push(`${model} 的音频操作必须使用 ${definition.label} 协议预设`);
        if ((config.voiceIdField || "") !== (expected.voiceIdField || "")) errors.push(`${model} 的 voice_id 字段必须使用 ${definition.label} 协议预设`);
        if ((config.previewAudioField || "") !== (expected.previewAudioField || "")) errors.push(`${model} 的试听音频字段必须使用 ${definition.label} 协议预设`);
        if (Boolean(config.supportsReferenceImage) !== Boolean(expected.supportsReferenceImage)) errors.push(`${model} 的参考图片能力必须使用 ${definition.label} 协议预设`);
        if (Boolean(config.supportsReferenceVideo) !== Boolean(expected.supportsReferenceVideo)) errors.push(`${model} 的参考视频能力必须使用 ${definition.label} 协议预设`);
        if (Boolean(config.supportsReferenceAudio) !== Boolean(expected.supportsReferenceAudio)) errors.push(`${model} 的参考音频能力必须使用 ${definition.label} 协议预设`);
    }
    return errors;
}

function isSafeAuthHeaderName(value: string | undefined) {
    const name = value?.trim() || "";
    return /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) && !["connection", "content-length", "cookie", "host", "transfer-encoding"].includes(name.toLowerCase());
}

export function emptyAdvancedConfig(): SystemChannelAdvancedConfig {
    return {
        protocol: "auto",
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
    };
}
