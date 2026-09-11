import { getAuthSettings, refundUserPoints } from "@/lib/auth/store";
import { CREATE_AGENT_PROMPT_MAX_LENGTH } from "@/lib/create-agent-prompt";
import { formatPromptFieldLines, isCurrentDramaStaticFramePrompt } from "@/lib/drama-frame-sequence";
import { DRAMA_ASSET_IMAGE_SKILL } from "@/lib/drama-image-skill";
import {
    DRAMA_CHARACTER_DEFAULT_CONSISTENCY,
    DRAMA_CHARACTER_FACE_MODELING_RULES,
    DRAMA_CHARACTER_HAIR_MODELING_RULES,
    DRAMA_CHARACTER_NEGATIVE_RULES,
    DRAMA_CHARACTER_PROFILE_CONTRACT,
    DRAMA_CHARACTER_RENDER_STYLE,
    DRAMA_CHARACTER_STUDIO_LIGHT_RULES,
    DRAMA_CHARACTER_SUPPLIER_QUALITY_RULES,
    DRAMA_CHARACTER_WARDROBE_MATERIAL_RULES,
} from "@/lib/drama-character-rules";
import { DRAMA_CHARACTER_TURNAROUND_LABEL, DRAMA_CHARACTER_TURNAROUND_LAYOUT, DRAMA_CHARACTER_TURNAROUND_SIZE } from "@/lib/drama-prompt-compiler";
import type { CreativeGenerationMode } from "@/lib/creative-runtime-contract";
import {
    DRAMA_CONTINUOUS_FRAME_RULES,
    DRAMA_STATIC_FRAME_DIRECTOR_RULES,
    DRAMA_VIDEO_PROMPT_DIRECTOR_RULES,
    SEEDANCE_DIRECTOR_SKILL,
    SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT,
    SEEDANCE_STATIC_FRAME_RULES,
    SEEDANCE_VIDEO_PROMPT_LAYOUT,
} from "@/lib/server/agent-skills/creative-shortcuts";
import { inferSeedance25VideoDuration, resolveSeedance25DirectorInstructions } from "@/lib/server/agent-skills/seedance-25";
import { toSafeGenerationErrorMessage } from "@/lib/server/generation-errors";
import { resolveLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { hasSystemAiCharge, readSystemAiBilling, systemAiBillingHeaders, systemAiIdempotencyKey } from "@/lib/server/system-ai-billing";
import { rankTextPlanningCandidates, requestStructuredText } from "@/lib/server/text-planning-runtime";
import type { DramaAssetPromptOptimization, DramaAssetPromptFields } from "@/lib/drama-project-contract";
import { formatDramaGlobalVisualContract, type DramaGlobalVisualContract } from "@/lib/drama-style";
import { DRAMA_PUBLIC_STATIC_FRAME_PROMPT_CONTRACT, DRAMA_PUBLIC_VIDEO_PROMPT_CONTRACT } from "@/lib/drama-public-prompt-contract";

type PromptOptimizationMode = "agent" | CreativeGenerationMode | "drama-frame" | "drama-asset";
type NonAssetPromptOptimizationMode = Exclude<PromptOptimizationMode, "drama-asset">;
type PromptOptimizationInput = { origin: string; cookie: string; userId: string; requestId: string; prompt: string; visualContract?: DramaGlobalVisualContract; dramaFrameContext?: string; correctionDirection?: string };

export class PromptOptimizationError extends Error {
    constructor(
        message: string,
        readonly status = 502,
    ) {
        super(message);
        this.name = "PromptOptimizationError";
    }
}

export function optimizeCreativePrompt(input: PromptOptimizationInput & { mode: "drama-asset" }): Promise<DramaAssetPromptOptimization>;
export function optimizeCreativePrompt(input: PromptOptimizationInput & { mode: NonAssetPromptOptimizationMode }): Promise<string>;
export function optimizeCreativePrompt(input: PromptOptimizationInput & { mode: PromptOptimizationMode }): Promise<string | DramaAssetPromptOptimization>;
export async function optimizeCreativePrompt(input: PromptOptimizationInput & { mode: PromptOptimizationMode }): Promise<string | DramaAssetPromptOptimization> {
    const settings = await getAuthSettings();
    const model = settings.defaultModels.textModel;
    const candidates = resolveLogicalModelCandidates(settings, "text", model);
    if (!model || !candidates.length) throw new PromptOptimizationError("后台尚未配置可用的默认文本模型", 503);

    let latestError: unknown;
    for (const candidate of rankTextPlanningCandidates(candidates)) {
        const idempotencyKey = systemAiIdempotencyKey("prompt-optimize", input.userId, input.requestId, candidate.channelId, candidate.upstreamModel);
        try {
            const call = await requestStructuredText({
                origin: input.origin,
                cookie: input.cookie,
                candidate,
                messages: [
                    { role: "system", content: promptOptimizationInstruction(input.mode, input.prompt, input.visualContract, input.dramaFrameContext, input.correctionDirection) },
                    { role: "user", content: input.prompt },
                ],
                tool: input.mode === "drama-asset" ? dramaAssetPromptOptimizationTool : promptOptimizationTool,
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotencyKey,
                    "X-Client-Request-Id": idempotencyKey,
                    ...systemAiBillingHeaders(model, idempotencyKey, candidate.upstreamModel),
                },
                onInvalidResponse: (headers) => refundInvalidResponse(input.userId, model, headers),
            });
            const optimizedPrompt = parseOptimizedPrompt(call.arguments, input.mode, input.prompt, input.visualContract);
            if (!optimizedPrompt) {
                await refundInvalidResponse(input.userId, model, call.headers);
                throw new PromptOptimizationError("默认文本模型没有返回有效提示词");
            }
            return optimizedPrompt;
        } catch (error) {
            latestError = error;
        }
    }
    throw new PromptOptimizationError(toSafeGenerationErrorMessage(latestError, "提示词优化失败，请稍后重试"));
}

function promptOptimizationInstruction(mode: PromptOptimizationMode, prompt = "", visualContract?: DramaGlobalVisualContract, dramaFrameContext = "", correctionDirection = "") {
    const globalVisualContract = formatDramaGlobalVisualContract(visualContract);
    const globalVisualRule = globalVisualContract ? `\n本项目全局视觉合同（必须保留，不得自行替换）：\n${globalVisualContract}\n` : "";
    if (mode === "drama-frame")
        return `你是 VOZEB PRO 的 Seedance 2.0 静态图片帧提示词导演。必须先按 Seedance 导演 Skill 的资产绑定原则和静态关键帧规则在内部检查原提示词，再输出一条全新的、可直接提交给图片供应商的中文静态画面提示词。${DRAMA_PUBLIC_STATIC_FRAME_PROMPT_CONTRACT}\nSeedance 导演 Skill（固定版本 ${SEEDANCE_DIRECTOR_SKILL.sourceVersion}）：${SEEDANCE_DIRECTOR_SKILL.instructions}\n${DRAMA_STATIC_FRAME_DIRECTOR_RULES}\n${SEEDANCE_STATIC_FRAME_RULES}\n${SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT}\n${DRAMA_CONTINUOUS_FRAME_RULES}\n${dramaFrameContext ? `服务端读取的当前项目事实（必须保留，不能把其中的内部数据写进公开提示词）：\n${dramaFrameContext}\n` : ""}${correctionDirection ? `本次用户整改方向（只影响本次输出，不能覆盖项目长期规则）：\n${correctionDirection}\n` : ""}改写时必须严格按“静态关键帧 → 可见状态 → 可见表演状态 → 景别 → 机位与构图 → 站位与视线 → 三层空间 → 光色与风格 → 负面约束”逐行输出；静态画面必须冻结一个已经发生的动作结果，不能只写远景氛围或“保持静止”；如果原文同时出现 ELS/极远景 与清晰面部、手部或道具细节，必须改成能承载这些细节的中远景或全身中景；前景必须是具体框景或遮挡物，不能留空。保留服务端项目事实、原提示词中的剧情事实、人物身份、固定资产造型、数量、画幅和连续性入口；参考图用途由外部 referenceManifest 和服务端绑定负责，不新增“参考图职责”正文段，也不伪造 @图片 编号。发现景别冲突、抽象状态、未定义肢体、重复约束或把运镜/时间段混入静态帧的问题时，必须在不新增剧情事实的前提下修正。不要输出内部 ID、URL、JSON、Markdown 标题、评估说明或解释文字。禁止运镜、动作过程、对白转述、声音指令、字幕、水印、logo、现代元素、未被用户明确要求的额外主体或额外肢体、手部畸形和脸部变形；场景策略要求的无名背景 NPC 不属于额外主角，但必须服从 NPC 数量、位置和行为规则。只返回优化后的公开提示词。`;
    if (mode === "drama-asset") {
        const kind = prompt.match(/资产类型[】：:]\s*(角色|场景|道具)/u)?.[1] || "角色、场景或道具";
        const layout =
            kind === "角色"
                ? `角色固定为一张纯白色无缝背景的${DRAMA_CHARACTER_TURNAROUND_LABEL}：${DRAMA_CHARACTER_TURNAROUND_LAYOUT}，同一基线、同一头身比、同一脸部、发型、服装和关键道具。四视图只表示同一个角色；不得添加四分之三视图、主立绘、表情组、手部或道具拆解、额外角度、边框、网格、文字或水印。`
                : kind === "场景"
                  ? "场景固定为一张高清、完整、独立的当前项目画幅单视角全景建立图：无人物、无文字，入口、出口、门窗、固定陈设、通道、支撑面、材质、光向和轴线必须清晰可读；不得生成九宫格、分格或360°贴图。"
                  : "道具固定为一张完整、独立的单主体基准图，不得添加人物、拼版、文字或水印。";
        return `你是 VOZEB PRO 的短剧资产图片提示词编辑器。当前资产类型是“${kind}”。必须调用固定 JSON 工具返回结果，JSON 只能包含 optimizedPrompt 和 fields 两个顶层键；fields 必须完整包含 description、visualIdentity、styling、colorPalette、consistencyRules 五个字符串键，不得缺失、改名或增加键。optimizedPrompt 是可直接提交给图片供应商的中文公开生图提示词，不得包含 JSON、解释、分析、Markdown 标题、内部规则、模型理由、ID 或 URL。${globalVisualRule}\n${DRAMA_ASSET_IMAGE_SKILL.instructions}\n${kind === "角色" ? `角色质量契约：${DRAMA_CHARACTER_PROFILE_CONTRACT}\n角色供应商质量要求：${DRAMA_CHARACTER_SUPPLIER_QUALITY_RULES}\n角色五官建模：${DRAMA_CHARACTER_FACE_MODELING_RULES}\n角色头发建模：${DRAMA_CHARACTER_HAIR_MODELING_RULES}\n角色服装材质：${DRAMA_CHARACTER_WARDROBE_MATERIAL_RULES}\n角色渲染技术：${DRAMA_CHARACTER_RENDER_STYLE}\n角色棚拍光线：${DRAMA_CHARACTER_STUDIO_LIGHT_RULES}\n角色高代价负面项：${DRAMA_CHARACTER_NEGATIVE_RULES}` : ""}\n${layout}\n${kind === "场景" ? "场景硬规则：只生成一张高清、无人物、无文字的当前项目画幅单视角全景建立图；完整呈现入口、出口、门窗、固定陈设、通道、支撑面、材质、光向和空间轴线；禁止九宫格、分格、方向标签和360°贴图。" : ""}\n项目主题风格只能使用全局视觉合同或原提示词中明确提供的视觉风格，不得自行添加或替换固定题材；保留原提示词中的项目风格、资产身份/结构锚点、固定服装材质、颜色、空间规则、画幅和负面要求，不新增任何剧情事实；fields 同步整理当前资产文案，未被用户要求改变的事实必须保留。角色资产必须把固定脸部、比例、发型、服装和材质事实写入对应字段，不得用“高级、绝美、顶级、仙气”等空泛形容词替代具体事实。场景资产必须具体写出单张全景图中的空间拓扑、透视、入口出口、固定物件、通道、支撑面和材质细节。optimizedPrompt 按以下顺序逐行组织：主体与资产类型；身份/结构锚点；可见状态与材质；构图与画幅；光色与风格；负面约束。`;
    }
    if (mode === "image")
        return `你是 VOZEB PRO 图片提示词编辑器。把用户原文整理为可直接提交的中文图片提示词：先锁定主体与身份锚点，再写当前要改变的内容、构图、光色材质、用途和约束。图片编辑必须分别写 change、preserve、constraints；change 只包含一个已定位变量，preserve 明确保留身份、构图、光线、材质和文字等未修改事实，constraints 写清比例、尺寸、参考图用途和不可出现内容。${globalVisualRule}多张参考图按角色、场景、道具或构图分配唯一用途，禁止按标题或文本相似度猜测。保留用户原文的主体、品牌、数量、尺寸、比例、文字和否定要求，不新增剧情事实或供应商字段。只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。`;
    if (mode === "video") {
        const seedance25 = resolveSeedance25DirectorInstructions({ prompt, durationSeconds: inferSeedance25VideoDuration(prompt) });
        return `你是 VOZEB PRO 视频提示词编辑器。把用户原文改写为可直接发送的中文视频提示词。${DRAMA_PUBLIC_VIDEO_PROMPT_CONTRACT}${globalVisualRule}公开字段固定按动态意图、全局设定、起始可见状态、时间段动作、单一主运镜、环境压力与视觉母题、视觉风格与光色、声音意图、结束画面、连续性锁、针对性约束排列；不另设顶层触发或主体动作与反应字段，动作与触发只写在每个真实时间段内部。你必须在同一条公开 videoPrompt 中直接写出完整可执行内容，包括素材绑定（有素材时）以及每个真实时间段的“起点、动作与触发、可见衔接、终点”和具体时间范围；framePlan 只能作为同一内容的结构化镜像。每段时间连续且上一段终点必须成为下一段起点；不要按每一秒机械切碎。${DRAMA_VIDEO_PROMPT_DIRECTOR_RULES}\n${SEEDANCE_VIDEO_PROMPT_LAYOUT}${DRAMA_CONTINUOUS_FRAME_RULES}\n${seedance25.instructions}每个时间段都必须让姿态、表情/视线、手部/道具或环境产生可验证变化；减少“保持构图、主体稳定、情绪不变”等静态约束，只保留身份、空间、道具和轴线等必要连续性。不得输出 A线、B线、主线、副线、钩子等叙事规划标签，必须改写为对应的可见动作、状态或触发。保留用户的主体、人名、品牌、比例、时长、参考素材和否定要求，不新增剧情事实；只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。`;
    }
    const target = mode === "audio" ? "音频" : "创作";
    return `你是 VOZEB PRO 提示词编辑器。把用户原文改写为清晰、紧凑、可直接发送的中文${target}提示词。保留主体、人名、品牌、数量、尺寸、比例、时长、文字内容、参考素材要求和否定要求；不得改变用户意图，不得虚构事实或添加用户没有要求的复杂设定。只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。`;
}

function parseOptimizedPrompt(value: string, mode: PromptOptimizationMode, sourcePrompt = "", visualContract?: DramaGlobalVisualContract): string | DramaAssetPromptOptimization {
    try {
        const payload = JSON.parse(value) as { optimizedPrompt?: unknown; fields?: unknown; [key: string]: unknown };
        if (mode === "drama-asset" && Object.keys(payload).some((key) => key !== "optimizedPrompt" && key !== "fields")) return "";
        const optimized = payload.optimizedPrompt;
        const prompt = typeof optimized === "string" ? (mode === "video" ? optimized.trim() : formatPromptFieldLines(optimized, mode === "drama-frame" ? "static" : "static")) : "";
        if (mode === "drama-frame" && !isCurrentDramaStaticFramePrompt(prompt)) return "";
        if (mode !== "drama-asset") return prompt && prompt.length <= CREATE_AGENT_PROMPT_MAX_LENGTH ? prompt : "";
        const fields = normalizeDramaAssetPromptFields(payload.fields, sourcePrompt);
        if (!fields) return "";
        const normalized = enforceDramaAssetPromptContract(sourcePrompt, prompt, fields, visualContract);
        return normalized && normalized.length <= CREATE_AGENT_PROMPT_MAX_LENGTH ? { optimizedPrompt: normalized, fields } : "";
    } catch {
        return "";
    }
}

function normalizeDramaAssetPromptFields(value: unknown, sourcePrompt: string): DramaAssetPromptFields | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const input = value as Record<string, unknown>;
    const source = {
        description: extractAssetPromptField(sourcePrompt, "基础描述"),
        visualIdentity: extractAssetPromptField(sourcePrompt, "视觉识别"),
        styling: extractAssetPromptField(sourcePrompt, "造型与材质"),
        colorPalette: extractAssetPromptField(sourcePrompt, "固定色彩"),
        consistencyRules: extractAssetPromptField(sourcePrompt, "一致性规则"),
    };
    const keys = Object.keys(source) as Array<keyof typeof source>;
    if (Object.keys(input).some((key) => !keys.includes(key as keyof typeof source))) return null;
    if (!keys.every((key) => Object.prototype.hasOwnProperty.call(input, key) && typeof input[key] === "string")) return null;
    const fields = Object.fromEntries(keys.map((key) => [key, String(input[key]).trim() || source[key]])) as DramaAssetPromptFields;
    if (sourcePrompt.match(/资产类型[】：:]\s*(角色|场景|道具)/u)?.[1] === "角色") fields.consistencyRules = [fields.consistencyRules, DRAMA_CHARACTER_DEFAULT_CONSISTENCY].filter(Boolean).join("；");
    return fields;
}

function extractAssetPromptField(prompt: string, label: string) {
    const match = prompt.match(new RegExp(`(?:^|\\n)${label}[：:]\\s*([^\\n]*)`, "u"));
    return match?.[1]?.trim() || "";
}

function enforceDramaAssetPromptContract(sourcePrompt: string, prompt: string, fields: DramaAssetPromptFields, visualContract?: DramaGlobalVisualContract) {
    if (!prompt) return "";
    const kind = sourcePrompt.match(/资产类型[】：:]\s*(角色|场景|道具)/u)?.[1];
    const labels = ["主体与资产类型", "身份/结构锚点", "可见状态与材质", "构图与画幅", "光色与风格", "负面约束"];
    const normalized = prompt.replace(new RegExp(`[；;]\\s*(?=(?:${labels.join("|")})[：:])`, "gu"), "\n");
    const retained = normalized
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !new RegExp(`^(?:${labels.slice(3).join("|")})[：:]`, "u").test(line));
    const configuredStyle = extractConfiguredStyle(sourcePrompt);
    const globalVisual = formatDramaGlobalVisualContract(visualContract);
    const defaults = [
        `主体与资产类型：${kind || "角色、场景或道具"}设定图`,
        `身份/结构锚点：${fields.visualIdentity || fields.description || "严格沿用当前资产身份与结构锚点"}`,
        `可见状态与材质：${fields.styling || "按当前资产造型、材质和可见状态呈现"}`,
        kind === "角色"
            ? `构图与画幅：${DRAMA_CHARACTER_TURNAROUND_SIZE} 横向，一张纯白色无缝背景${DRAMA_CHARACTER_TURNAROUND_LABEL}；${DRAMA_CHARACTER_TURNAROUND_LAYOUT}。`
            : kind === "场景"
              ? "构图与画幅：当前项目画幅的一张高清完整单视角场景全景建立图；入口、出口、门窗、陈设、通道、支撑面、材质、光向和空间轴线清晰可读，不生成九宫格或分格。"
              : "构图与画幅：按项目画幅，一张完整、独立的单主体基准图。",
        `光色与风格：${kind === "角色" ? [configuredStyle ? `项目视觉风格：${configuredStyle}` : "", globalVisual, DRAMA_CHARACTER_RENDER_STYLE, DRAMA_CHARACTER_STUDIO_LIGHT_RULES, DRAMA_CHARACTER_SUPPLIER_QUALITY_RULES].filter(Boolean).join("；") : globalVisual || "严格沿用当前项目视觉风格与资产固有色彩，不新增环境或剧情元素。"}`,
        kind === "角色"
            ? `负面约束：${DRAMA_CHARACTER_NEGATIVE_RULES}。`
            : kind === "场景"
              ? `负面约束：无人物、不同地点、方向标签、文字、水印、logo${visualContract?.globalNegativePrompt ? `；${visualContract.globalNegativePrompt}` : ""}。`
              : "负面约束：无额外主体、拼版、多视角、场景文字、边框、文字、水印或 logo。",
    ];
    const retainedByLabel = new Map(
        retained
            .map((line) => {
                const match = line.match(/^([^：:]+)[：:]\s*([\s\S]*)$/u);
                return match ? ([match[1], match[2].trim()] as const) : (["", ""] as const);
            })
            .filter(([label]) => label),
    );
    const canonical = defaults.map((line) => {
        const match = line.match(/^([^：:]+)[：:]\s*([\s\S]*)$/u);
        if (!match) return line;
        const label = match[1];
        const existing = retainedByLabel.get(label);
        if (!existing) return line;
        if (label !== "可见状态与材质" || kind !== "角色") return `${label}：${existing}`;
        const quality = [DRAMA_CHARACTER_FACE_MODELING_RULES, DRAMA_CHARACTER_HAIR_MODELING_RULES, DRAMA_CHARACTER_WARDROBE_MATERIAL_RULES].filter((rule) => !existing.includes(rule.slice(0, 8))).join("；");
        return `${label}：${existing}${quality ? `；${quality}` : ""}`;
    });
    return canonical.join("\n");
}

function extractConfiguredStyle(prompt: string) {
    const match = prompt.match(/项目视觉风格：([\s\S]*?)(?:；高精度人物细节与清晰轮廓边缘|；角色固有色彩|$)/u);
    return match?.[1]?.trim() || "";
}

async function refundInvalidResponse(userId: string, model: string, headers: Headers) {
    const billing = readSystemAiBilling(headers);
    if (hasSystemAiCharge(billing)) await refundUserPoints(userId, model, billing.pointsCost, "text", 1, undefined, billing.pointsRecordId);
}

const promptOptimizationTool = {
    name: "optimize_creative_prompt",
    description: "将用户原文整理为可直接发送的公开创作提示词",
    parameters: {
        type: "object",
        properties: {
            optimizedPrompt: { type: "string", minLength: 1, maxLength: CREATE_AGENT_PROMPT_MAX_LENGTH },
        },
        required: ["optimizedPrompt"],
        additionalProperties: false,
    },
};

const dramaAssetPromptOptimizationTool = {
    name: "optimize_drama_asset_prompt",
    description: "优化短剧资产公开生图提示词，并同步返回固定字段文案",
    parameters: {
        type: "object",
        properties: {
            optimizedPrompt: { type: "string", minLength: 1, maxLength: CREATE_AGENT_PROMPT_MAX_LENGTH },
            fields: {
                type: "object",
                properties: {
                    description: { type: "string" },
                    visualIdentity: { type: "string" },
                    styling: { type: "string" },
                    colorPalette: { type: "string" },
                    consistencyRules: { type: "string" },
                },
                required: ["description", "visualIdentity", "styling", "colorPalette", "consistencyRules"],
                additionalProperties: false,
            },
        },
        required: ["optimizedPrompt", "fields"],
        additionalProperties: false,
    },
};
