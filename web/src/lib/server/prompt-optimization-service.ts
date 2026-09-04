import { getAuthSettings, refundUserPoints } from "@/lib/auth/store";
import { CREATE_AGENT_PROMPT_MAX_LENGTH } from "@/lib/create-agent-prompt";
import { formatPromptFieldLines } from "@/lib/drama-frame-sequence";
import { DRAMA_ASSET_IMAGE_SKILL } from "@/lib/drama-image-skill";
import { DRAMA_CHARACTER_TURNAROUND_SIZE } from "@/lib/drama-prompt-compiler";
import type { CreativeGenerationMode } from "@/lib/creative-runtime-contract";
import { DRAMA_CONTINUOUS_FRAME_RULES, SEEDANCE_DIRECTOR_SKILL, SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT, SEEDANCE_STATIC_FRAME_RULES, SEEDANCE_VIDEO_PROMPT_LAYOUT } from "@/lib/server/agent-skills/creative-shortcuts";
import { inferSeedance25VideoDuration, resolveSeedance25DirectorInstructions } from "@/lib/server/agent-skills/seedance-25";
import { toSafeGenerationErrorMessage } from "@/lib/server/generation-errors";
import { resolveLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { hasSystemAiCharge, readSystemAiBilling, systemAiBillingHeaders, systemAiIdempotencyKey } from "@/lib/server/system-ai-billing";
import { rankTextPlanningCandidates, requestStructuredText } from "@/lib/server/text-planning-runtime";

type PromptOptimizationMode = "agent" | CreativeGenerationMode | "drama-frame" | "drama-asset";

export class PromptOptimizationError extends Error {
    constructor(
        message: string,
        readonly status = 502,
    ) {
        super(message);
        this.name = "PromptOptimizationError";
    }
}

export async function optimizeCreativePrompt(input: { origin: string; cookie: string; userId: string; requestId: string; prompt: string; mode: PromptOptimizationMode }) {
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
                    { role: "system", content: promptOptimizationInstruction(input.mode, input.prompt) },
                    { role: "user", content: input.prompt },
                ],
                tool: promptOptimizationTool,
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotencyKey,
                    "X-Client-Request-Id": idempotencyKey,
                    ...systemAiBillingHeaders(model, idempotencyKey, candidate.upstreamModel),
                },
                onInvalidResponse: (headers) => refundInvalidResponse(input.userId, model, headers),
            });
            const optimizedPrompt = parseOptimizedPrompt(call.arguments, input.mode, input.prompt);
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

function promptOptimizationInstruction(mode: PromptOptimizationMode, prompt = "") {
    if (mode === "drama-frame")
        return `你是 VOZEB PRO 的 Seedance 2.0 静态图片帧提示词导演。必须先按 Seedance 导演 Skill 的资产绑定原则和静态关键帧规则在内部检查原提示词，再输出一条全新的、可直接提交给图片供应商的中文静态画面提示词。\nSeedance 导演 Skill（固定版本 ${SEEDANCE_DIRECTOR_SKILL.sourceVersion}）：${SEEDANCE_DIRECTOR_SKILL.instructions}\n${SEEDANCE_STATIC_FRAME_RULES}\n${SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT}\n${DRAMA_CONTINUOUS_FRAME_RULES}\n改写时必须严格按“静态关键帧 → 可见状态 → 可见表演状态 → 景别 → 机位与构图 → 站位与视线 → 三层空间 → 光色与风格 → 负面约束”逐行输出；静态画面必须冻结一个已经发生的动作结果，不能只写远景氛围或“保持静止”；如果原文同时出现 ELS/极远景 与清晰面部、手部或道具细节，必须改成能承载这些细节的中远景或全身中景；前景必须是具体框景或遮挡物，不能留空。保留原提示词中的剧情事实、人物身份、固定资产造型、数量、画幅和连续性入口；参考图用途由外部 referenceManifest 和服务端绑定负责，不新增“参考图职责”正文段，也不伪造 @图片 编号。发现景别冲突、抽象状态、未定义肢体、重复约束或把运镜/时间段混入静态帧的问题时，必须在不新增剧情事实的前提下修正。不要输出内部 ID、URL、JSON、Markdown 标题、评估说明或解释文字。禁止运镜、动作过程、对白转述、声音指令、字幕、水印、logo、现代元素、未被用户明确要求的额外主体或额外肢体、手部畸形和脸部变形。只返回优化后的公开提示词。`;
    if (mode === "drama-asset") {
        const kind = prompt.match(/资产类型[】：:]\s*(角色|场景|道具)/u)?.[1] || "角色、场景或道具";
        const layout = kind === "角色" ? "角色固定为一张纯白色无缝背景的三视图角色基准板：正面、侧面、背面全身立姿等距水平排列，侧面固定为左侧，同一基线、同一头身比、同一脸部、发型、服装和关键道具。三视图只表示同一个角色；不得添加主立绘、肖像特写、表情组、手部或道具拆解、额外角度、边框、网格、文字或水印。" : "场景或道具固定为一张完整、独立的单主体基准图，不得添加人物、拼版、文字或水印。";
        return `你是 VOZEB PRO 的短剧资产图片提示词编辑器。当前资产类型是“${kind}”。只输出一条全新的、可直接提交给图片供应商的中文公开生图提示词，不输出解释、分析、JSON、Markdown 标题、内部规则、模型理由、ID 或 URL。\n${DRAMA_ASSET_IMAGE_SKILL.instructions}\n${layout}\n保留原提示词中的项目风格、资产身份/结构锚点、固定服装材质、颜色、空间规则、画幅和负面要求，不新增任何剧情事实。输出时按以下顺序逐行组织：主体与资产类型；身份/结构锚点；可见状态与材质；构图与画幅；光色与风格；用途；负面约束。只返回优化后的公开提示词。`;
    }
    if (mode === "image")
        return "你是 VOZEB PRO 图片提示词编辑器。把用户原文整理为可直接提交的中文图片提示词：先锁定主体与身份锚点，再写当前要改变的内容、构图、光色材质、用途和约束。图片编辑必须分别写 change、preserve、constraints；change 只包含一个已定位变量，preserve 明确保留身份、构图、光线、材质和文字等未修改事实，constraints 写清比例、尺寸、参考图用途和不可出现内容。多张参考图按角色、场景、道具或构图分配唯一用途，禁止按标题或文本相似度猜测。保留用户原文的主体、品牌、数量、尺寸、比例、文字和否定要求，不新增剧情事实或供应商字段。只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。";
    if (mode === "video") {
        const seedance25 = resolveSeedance25DirectorInstructions({ prompt, durationSeconds: inferSeedance25VideoDuration(prompt) });
        return `你是 VOZEB PRO 视频提示词编辑器。把用户原文改写为可直接发送的中文视频提示词。你必须在同一条公开 videoPrompt 中直接写出完整可执行内容，包括素材绑定、必要字段以及每个真实时间段的“起点、动作与触发、可见衔接、终点”和具体时间范围；framePlan 只能作为同一内容的结构化镜像。每段时间连续且上一段终点必须成为下一段起点；不要按每一秒机械切碎。${SEEDANCE_VIDEO_PROMPT_LAYOUT}${DRAMA_CONTINUOUS_FRAME_RULES}\n${seedance25.instructions}每个时间段都必须让姿态、表情/视线、手部/道具或环境产生可验证变化；减少“保持构图、主体稳定、情绪不变”等静态约束，只保留身份、空间、道具和轴线等必要连续性。不得输出 A线、B线、主线、副线、钩子等叙事规划标签，必须改写为对应的可见动作、状态或触发。保留用户的主体、人名、品牌、比例、时长、参考素材和否定要求，不新增剧情事实；只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。`;
    }
    const target = mode === "audio" ? "音频" : "创作";
    return `你是 VOZEB PRO 提示词编辑器。把用户原文改写为清晰、紧凑、可直接发送的中文${target}提示词。保留主体、人名、品牌、数量、尺寸、比例、时长、文字内容、参考素材要求和否定要求；不得改变用户意图，不得虚构事实或添加用户没有要求的复杂设定。只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。`;
}

function parseOptimizedPrompt(value: string, mode: PromptOptimizationMode, sourcePrompt = "") {
    try {
        const payload = JSON.parse(value) as { optimizedPrompt?: unknown };
        const optimized = payload.optimizedPrompt;
        const prompt = typeof optimized === "string" ? (mode === "video" ? optimized.trim() : formatPromptFieldLines(optimized, mode === "drama-frame" ? "static" : "static")) : "";
        const normalized = mode === "drama-asset" ? enforceDramaAssetPromptContract(sourcePrompt, prompt) : prompt;
        return normalized && normalized.length <= CREATE_AGENT_PROMPT_MAX_LENGTH ? normalized : "";
    } catch {
        return "";
    }
}

function enforceDramaAssetPromptContract(sourcePrompt: string, prompt: string) {
    if (!prompt) return "";
    const kind = sourcePrompt.match(/资产类型[】：:]\s*(角色|场景|道具)/u)?.[1];
    if (kind !== "角色") return prompt;
    const labels = ["主体与资产类型", "身份/结构锚点", "可见状态与材质", "构图与画幅", "光色与风格", "用途", "负面约束"];
    const normalized = prompt.replace(new RegExp(`[；;]\s*(?=(?:${labels.join("|")})[：:])`, "gu"), "\n");
    const retained = normalized
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !/^(?:构图与画幅|用途|负面约束)[：:]/u.test(line));
    return [
        ...retained,
        `构图与画幅：${DRAMA_CHARACTER_TURNAROUND_SIZE} 横向，一张纯白色无缝背景三视图角色基准板；正面、侧面、背面全身立姿等距水平排列，侧面固定为左侧，同一基线、同一头身比。`,
        "用途：短剧镜头一致性角色基准板。",
        "负面约束：无额外人物、额外角度、主立绘、肖像特写、表情组、手部或道具拆解、场景元素、灰色背景、网格、边框、文字、水印或 logo。",
    ].join("\n");
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
