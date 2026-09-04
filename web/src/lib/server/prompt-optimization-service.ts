import { getAuthSettings, refundUserPoints } from "@/lib/auth/store";
import { CREATE_AGENT_PROMPT_MAX_LENGTH } from "@/lib/create-agent-prompt";
import { formatPromptFieldLines } from "@/lib/drama-frame-sequence";
import { DRAMA_ASSET_IMAGE_SKILL } from "@/lib/drama-image-skill";
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
            const optimizedPrompt = parseOptimizedPrompt(call.arguments, input.mode);
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
        return `你是 VOZEB PRO 的短剧资产图片提示词编辑器。当前资产类型是“${kind}”。只输出一条全新的、可直接提交给图片供应商的中文公开生图提示词，不输出解释、分析、JSON、Markdown 标题、内部规则、模型理由、ID 或 URL。\n${DRAMA_ASSET_IMAGE_SKILL.instructions}\n必须严格执行单主体基准图职责：角色只生成一个完整可识别的单人角色，优先头到鞋完整入画；场景只生成一个没有人物的空间；道具只生成一个完整道具及其关键材质。绝对禁止多角度、三视图、五官九宫格、角色表、联系表、拼版、分格或动作海报。保留原提示词中的项目风格、资产身份/结构锚点、固定服装材质、颜色、空间规则、画幅和负面要求，不新增任何剧情事实。输出时按以下顺序逐行组织：主体与资产类型；身份/结构锚点；可见状态与材质；构图与画幅；光色与风格；用途；负面约束。即使原文含有“多视角/设定板”等旧布局，也必须改为一张完整、独立的单主体基准图。只返回优化后的公开提示词。`;
    }
    if (mode === "image")
        return "你是 VOZEB PRO 图片提示词编辑器。把用户原文整理为可直接提交的中文图片提示词：先锁定主体与身份锚点，再写当前要改变的内容、构图、光色材质、用途和约束。图片编辑必须分别写 change、preserve、constraints；change 只包含一个已定位变量，preserve 明确保留身份、构图、光线、材质和文字等未修改事实，constraints 写清比例、尺寸、参考图用途和不可出现内容。多张参考图按角色、场景、道具或构图分配唯一用途，禁止按标题或文本相似度猜测。保留用户原文的主体、品牌、数量、尺寸、比例、文字和否定要求，不新增剧情事实或供应商字段。只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。";
    if (mode === "video") {
        const seedance25 = resolveSeedance25DirectorInstructions({ prompt, durationSeconds: inferSeedance25VideoDuration(prompt) });
        return `你是 VOZEB PRO 视频提示词编辑器。把用户原文改写为可直接发送的中文视频提示词。镜头级 videoPrompt 只写简短动态摘要、一个主运镜、环境/声音母题、明确结束画面和必要连续性；具体的主体动作推进不要重复写在摘要中。若输入包含连续时间段，按真实动作节点逐段写“起点、动作与触发、可见衔接、终点”，每段时间连续且上一段终点必须成为下一段起点；不要按每一秒机械切碎。${SEEDANCE_VIDEO_PROMPT_LAYOUT}${DRAMA_CONTINUOUS_FRAME_RULES}\n${seedance25.instructions}每个时间段都必须让姿态、表情/视线、手部/道具或环境产生可验证变化；减少“保持构图、主体稳定、情绪不变”等静态约束，只保留身份、空间、道具和轴线等必要连续性。不得输出 A线、B线、主线、副线、钩子等叙事规划标签，必须改写为对应的可见动作、状态或触发。保留用户的主体、人名、品牌、比例、时长、参考素材和否定要求，不新增剧情事实；只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。`;
    }
    const target = mode === "audio" ? "音频" : "创作";
    return `你是 VOZEB PRO 提示词编辑器。把用户原文改写为清晰、紧凑、可直接发送的中文${target}提示词。保留主体、人名、品牌、数量、尺寸、比例、时长、文字内容、参考素材要求和否定要求；不得改变用户意图，不得虚构事实或添加用户没有要求的复杂设定。只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。`;
}

function parseOptimizedPrompt(value: string, mode: PromptOptimizationMode) {
    try {
        const payload = JSON.parse(value) as { optimizedPrompt?: unknown };
        const optimized = typeof payload.optimizedPrompt === "string" && mode === "video" ? stripVideoNarrativeLabels(payload.optimizedPrompt) : payload.optimizedPrompt;
        const prompt = typeof optimized === "string" ? formatPromptFieldLines(optimized, mode === "drama-frame" ? "static" : mode === "video" ? "video" : "static") : "";
        return prompt && prompt.length <= CREATE_AGENT_PROMPT_MAX_LENGTH ? prompt : "";
    } catch {
        return "";
    }
}

function stripVideoNarrativeLabels(value: string) {
    return value
        .replace(/(^|\n)(\s*(?:动态意图|主体动作与反应|触发)[：:]\s*)(?:[AB]线(?:钩子|主线|副线)?|(?:主线|副线|叙事)钩子)(?:中)?\s*[，,:：、-]*/giu, "$1$2")
        .replace(/(^|\n)\s*(?:[AB]线(?:钩子|主线|副线)?|(?:主线|副线|叙事)钩子)(?:中)?\s*[：:,，、-]*/giu, "$1");
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
