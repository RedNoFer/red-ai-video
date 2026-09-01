import { getAuthSettings, refundUserPoints } from "@/lib/auth/store";
import { CREATE_AGENT_PROMPT_MAX_LENGTH } from "@/lib/create-agent-prompt";
import type { CreativeGenerationMode } from "@/lib/creative-runtime-contract";
import { SEEDANCE_DIRECTOR_SKILL, SEEDANCE_STATIC_FRAME_RULES } from "@/lib/server/agent-skills/creative-shortcuts";
import { toSafeGenerationErrorMessage } from "@/lib/server/generation-errors";
import { resolveLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { hasSystemAiCharge, readSystemAiBilling, systemAiBillingHeaders, systemAiIdempotencyKey } from "@/lib/server/system-ai-billing";
import { rankTextPlanningCandidates, requestStructuredText } from "@/lib/server/text-planning-runtime";

type PromptOptimizationMode = "agent" | CreativeGenerationMode | "drama-frame";

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
                    { role: "system", content: promptOptimizationInstruction(input.mode) },
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
            const optimizedPrompt = parseOptimizedPrompt(call.arguments);
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

function promptOptimizationInstruction(mode: PromptOptimizationMode) {
    if (mode === "drama-frame")
        return `你是 VOZEB PRO 的 Seedance 2.0 静态图片帧提示词导演。必须先按 Seedance 导演 Skill 的资产绑定原则和静态关键帧规则在内部检查原提示词，再输出一条全新的、可直接提交给图片供应商的中文静态画面提示词。\nSeedance 导演 Skill（固定版本 ${SEEDANCE_DIRECTOR_SKILL.sourceVersion}）：${SEEDANCE_DIRECTOR_SKILL.instructions}\n${SEEDANCE_STATIC_FRAME_RULES}\n只处理当前冻结时间点：主体和可见状态前置，明确场景空间、单一景别、机位、构图、站位、视线、光线色彩、材质、风格和针对性负面约束。保留原提示词中的剧情事实、人物身份、固定资产造型、参考图用途、数量、画幅和连续性入口；发现景别冲突、抽象状态、未定义肢体、重复约束或把运镜/时间段混入静态帧的问题时，必须在不新增剧情事实的前提下修正。每张参考图只能承担一个明确用途，@图片编号必须与原有引用顺序一致；引用编号、名称和用途必须作为提示词正文的一部分保留，不得拆成独立 UI 清单；不要输出内部 ID、URL、JSON、Markdown 标题、评估说明或解释文字。禁止运镜、动作过程、对白转述、声音指令、字幕、水印、logo、现代元素、未被用户明确要求的额外主体或额外肢体、手部畸形和脸部变形。只返回优化后的公开提示词。`;
    if (mode === "image")
        return "你是 VOZEB PRO 图片提示词编辑器。把用户原文整理为可直接提交的中文图片提示词：先锁定主体与身份锚点，再写当前要改变的内容、构图、光色材质、用途和约束。图片编辑必须分别写 change、preserve、constraints；change 只包含一个已定位变量，preserve 明确保留身份、构图、光线、材质和文字等未修改事实，constraints 写清比例、尺寸、参考图用途和不可出现内容。多张参考图按角色、场景、道具或构图分配唯一用途，禁止按标题或文本相似度猜测。保留用户原文的主体、品牌、数量、尺寸、比例、文字和否定要求，不新增剧情事实或供应商字段。只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。";
    const target = mode === "video" ? "视频" : mode === "audio" ? "音频" : "创作";
    return `你是 VOZEB PRO 提示词编辑器。把用户原文改写为清晰、紧凑、可直接发送的中文${target}提示词。保留主体、人名、品牌、数量、尺寸、比例、时长、文字内容、参考素材要求和否定要求；不得改变用户意图，不得虚构事实或添加用户没有要求的复杂设定。只返回优化后的公开提示词，不解释修改过程，不输出内部规划、模型选择理由或思维链。`;
}

function parseOptimizedPrompt(value: string) {
    try {
        const payload = JSON.parse(value) as { optimizedPrompt?: unknown };
        const prompt = typeof payload.optimizedPrompt === "string" ? payload.optimizedPrompt.trim() : "";
        return prompt && prompt.length <= CREATE_AGENT_PROMPT_MAX_LENGTH ? prompt : "";
    } catch {
        return "";
    }
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
