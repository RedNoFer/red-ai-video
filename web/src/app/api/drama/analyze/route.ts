import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/auth/request";
import { getAuthSettings, isAuthInputError, refundUserPoints } from "@/lib/auth/store";
import {
    describeDramaAnalysisCandidate,
    dramaContentTool,
    dramaImagePromptTool,
    dramaReviewCompletionFieldInstructions,
    dramaReviewCompletionToolForFields,
    dramaVideoPromptTool,
    dramaVisualTool,
    hasUsableDramaToolArguments,
    normalizeDramaContentAnalysis,
    validateDramaContentAnalysisTiming,
    normalizeDramaReviewCompletion,
    normalizeDramaVideoPromptAnalysis,
    normalizeDramaImagePromptAnalysis,
    normalizeDramaVisualAnalysis,
    validateDramaVisualAnalysis,
} from "@/lib/server/drama-analysis";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { resolveLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { checkRateLimit } from "@/lib/server/security";
import { hasSystemAiCharge, readSystemAiBilling, systemAiBillingHeaders, systemAiIdempotencyKey, type SystemAiBilling } from "@/lib/server/system-ai-billing";
import { rankTextPlanningCandidates, requestStructuredText, type TextPlanningCandidate } from "@/lib/server/text-planning-runtime";
import {
    dramaAnalysisText,
    DramaContentQualityError,
    DramaVideoPromptQualityError,
    normalizeDramaReviewCompletionInput,
    normalizeDramaVideoPromptInput,
    normalizeDramaImagePromptInput,
    normalizeDramaVisualInput,
    previewDramaVideoPromptOutput,
    reviewCompletionFilledCount,
    validateDramaVideoPromptOutput,
    dramaVideoPromptTimingWarnings,
    type DramaAnalyzeBody,
} from "@/lib/server/drama-analysis-input";
import { DRAMA_PACKAGE_DIRECTOR_RULES, DRAMA_PLANNING_SKILL, DRAMA_STATIC_FRAME_DIRECTOR_RULES, DRAMA_VIDEO_PROMPT_DIRECTOR_RULES } from "@/lib/server/agent-skills/creative-shortcuts";
import { DRAMA_DIALOGUE_TIMING_RULES, DRAMA_DIALOGUE_TIMING_TOLERANCE_CHARS } from "@/lib/drama-dialogue-timing";
import { resolveSeedance25VideoPromptReferences } from "@/lib/server/agent-skills/seedance-25";
import { buildDramaAnalyzeSchemaInstruction } from "@/lib/server/drama-analyze-prompt";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    if (!(await checkRateLimit(`drama-analyze:${user.id}`, { maxRequests: 10, windowMs: 60_000 })).allowed) return NextResponse.json({ code: 429, data: null, msg: "剧本解析过于频繁，请稍后重试" }, { status: 429 });
    let body: DramaAnalyzeBody;
    try {
        body = await readJsonBody(request, 8 * 1024 * 1024);
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
    const phase = body.phase === "visual" || body.phase === "review_completion" || body.phase === "video_prompt" || body.phase === "image_prompt" ? body.phase : "content";
    const script = dramaAnalysisText(body.script);
    if (phase === "content" && !script) return NextResponse.json({ code: 400, data: null, msg: "请先填写剧本" }, { status: 400 });

    const visualInput = phase === "visual" ? normalizeDramaVisualInput(body) : null;
    const videoPromptInput = phase === "video_prompt" ? normalizeDramaVideoPromptInput(body) : null;
    const imagePromptInput = phase === "image_prompt" ? normalizeDramaImagePromptInput(body) : null;
    const reviewCompletionInput = phase === "review_completion" ? normalizeDramaReviewCompletionInput(body) : null;
    if (
        (phase === "visual" && !visualInput?.shotIds.length) ||
        (phase === "video_prompt" && !videoPromptInput?.shotIds.length) ||
        (phase === "image_prompt" && !imagePromptInput?.shotIds.length) ||
        (phase === "review_completion" && !reviewCompletionInput?.shotIds.length)
    )
        return NextResponse.json({ code: 400, data: null, msg: "请先完成内容审核" }, { status: 400 });

    const settings = await getAuthSettings();
    const model = settings.defaultModels.textModel;
    const candidates = resolveLogicalModelCandidates(settings, "text", model);
    if (!model || !candidates.length) return NextResponse.json({ code: 400, data: { reasonCode: "configuration" }, msg: "后台尚未配置可用的默认文本模型" }, { status: 400 });

    let refundedPointsRemaining: number | undefined;
    let videoPromptCandidate: ReturnType<typeof previewDramaVideoPromptOutput> = [];
    try {
        const tool =
            phase === "visual"
                ? dramaVisualTool
                : phase === "video_prompt"
                  ? dramaVideoPromptTool
                  : phase === "image_prompt"
                    ? dramaImagePromptTool
                    : phase === "review_completion"
                      ? dramaReviewCompletionToolForFields(reviewCompletionInput!.fields)
                      : dramaContentTool;
        const input =
            phase === "visual"
                ? visualInput!.payload
                : phase === "video_prompt"
                  ? videoPromptInput!.payload
                  : phase === "image_prompt"
                    ? imagePromptInput!.payload
                    : phase === "review_completion"
                      ? reviewCompletionInput!.payload
                      : { script, summary: dramaAnalysisText(body.summary) };
        const requestId = dramaAnalysisText(body.requestId);
        const videoPromptDuration = videoPromptInput?.payload.shots.reduce((maximum, shot) => Math.max(maximum, shot.duration), 0);
        const seedance25VideoInstructions = phase === "video_prompt" ? resolveSeedance25VideoPromptReferences({ prompt: dramaAnalysisText(body.instruction), durationSeconds: videoPromptDuration }).instructions : "";
        const hasTimedDialogue = phase === "video_prompt" && videoPromptInput!.payload.shots.some((shot) => shot.utterances.some((utterance) => utterance.type === "dialogue" || utterance.type === "voiceover"));
        const dialogueCapacityInstruction = hasTimedDialogue ? "输入 shots.utterances 已提供对白原文、时间边界、停顿和语速；必须以这些当前事实核算每个时间段的可说时长，不要把整句对白压入过短帧段。" : "";
        const schemaInstruction = buildDramaAnalyzeSchemaInstruction(phase, tool.parameters);
        const inputProject = (input as { project?: { visualContract?: Record<string, string> } }).project;
        const hasGlobalVisualContract = Object.values(inputProject?.visualContract || {}).some((value) => Boolean(value?.trim()));
        const globalVisualInstruction = hasGlobalVisualContract ? "\n必须严格遵循输入 project.visualContract，不得自选、替换或重复抄写该合同。\n" : "";
        const hasVideoReferences = phase === "video_prompt" && Array.isArray(videoPromptInput?.payload.referenceMaterials) && videoPromptInput.payload.referenceMaterials.length > 0;
        const videoReferenceInstruction = hasVideoReferences ? "输入 referenceMaterials 已提供本次参考素材的 alias、职责和顺序；公开视频首段必须写出素材绑定，并逐项使用这些 alias，不得猜测、改名或省略。" : "";
        const hasVideoOptimizationIssues = phase === "video_prompt" && videoPromptInput!.payload.optimizationIssues.length > 0;
        const videoOptimizationInstruction = hasVideoOptimizationIssues
            ? "输入 optimizationIssues 是当前镜头的前置检查结果；warning 可以在提示词中修正，blocking 若涉及真实资产、帧图片或连续性状态不能靠改写提示词伪造通过。任何情况下不得改变已确认的人物、场景、道具、时长、帧数或事实。"
            : "";
        const videoPerformanceInstruction =
            phase === "video_prompt"
                ? "如果输入包含 performancePlan 或 dialoguePerformance，必须把其中可执行的眉眼、视线、呼吸、身体/手部动作、语气、停顿和反应转译为公开视频提示词的外在可见动作，并写入对应时间段及 framePlan；不要只保留结构化字段，也不要在公开提示词中输出字段名。"
                : "";
        const completionFieldInstruction = phase === "review_completion" ? `本次请求字段必须逐项真实补全，禁止只返回 shotId 空壳。${dramaReviewCompletionFieldInstructions(reviewCompletionInput!.fields)}` : "";
        const messages = [
            {
                role: "system",
                content:
                    phase === "visual"
                        ? `你是影视视觉导演和表演导演。输入内容已经由用户审核，必须严格保留每个 shotId、镜头数量、顺序、人物、场景、对白、旁白、原文和时长。当前制作包只执行一次 canonical drama-video-director Skill；它负责静态画面、视频正文、帧分配、表演、调度、灯光和连续性，输出必须直接写入对应字段，不得让应用层二次拼接。必须调用 design_drama_visuals。不要使用 Markdown。\n${DRAMA_PACKAGE_DIRECTOR_RULES}${globalVisualInstruction}${schemaInstruction}`
                        : phase === "video_prompt"
                          ? `你是图生视频执行提示词导演。本次只执行一次 canonical drama-video-director Skill：\n${DRAMA_VIDEO_PROMPT_DIRECTOR_RULES}${seedance25VideoInstructions ? `\n本次时长与供应商路由补充（只用于当前执行，不输出模式名）：\n${seedance25VideoInstructions}` : ""}仅根据输入的镜头事实、已验收帧、连续性状态和脱敏 referenceMaterials 直接生成完整公开视频提示词；不得生成图片提示词、改变镜头事实、输出 URL、内部 ID、JSON、Markdown 标题或解释文字。必须调用 generate_drama_video_prompts。公开视频必须按【重要剪辑指令】【素材绑定】【故事意图】【空间与连续性】【灯光与画面】【摄影总则】【逐镜头时间线】【硬性禁止】排版，并让每个 framePlan 时间段对应一个“镜头 N”段落。${DRAMA_DIALOGUE_TIMING_RULES}优化时必须逐句读取输入 shots.utterances 的 startSecond/endSecond、pauseBeforeSeconds/pauseAfterSeconds、speechRate 和 speechRateCharsPerSecond；对白不能被压进短于其可说时长的时间段，若当前时间段容纳不下，应保留动作节点并把对白放入足够长的连续时间段，不能通过异常加速解决。以下是服务端对白容量预检，必须逐条执行：\n${dialogueCapacityInstruction}${videoPerformanceInstruction}${videoOptimizationInstruction}${globalVisualInstruction}${videoReferenceInstruction}${schemaInstruction}`
                          : phase === "image_prompt"
                            ? `你是静态图片帧提示词编辑器。本次只执行一次 canonical 静态帧 Skill：\n${DRAMA_STATIC_FRAME_DIRECTOR_RULES}\n只优化当前镜头的图片提示词，不改变剧情事实、人物身份、资产造型或镜头数量。${globalVisualInstruction}保留原文事实，删除重复和内部执行信息，不从 actionPrompt、镜头描述、资产档案或连续性规则补写静态画面。只返回公开提示词，不输出解释、ID、URL、JSON 或参考绑定。${schemaInstruction}`
                            : phase === "review_completion"
                              ? `你是影视制作审核编辑。只根据输入镜头和剧本中明确存在的事实，补充或按用户要求优化审核字段。可以只返回确实能够判断的字段，不要为了凑齐字段编造内容；必须保留每个返回项的 shotId，并且本次请求的字段必须全部返回，禁止只返回 shotId 或空对象。补充表演目标、情绪递进、语气节奏、呼吸、色彩灯光、连续性、转场、实际首帧和实际尾帧等制作审核信息时，内容必须具体、可执行，并与原文和相邻镜头一致。若输入包含 instruction，必须优先响应其中的修改方向，但不得违反项目事实、固定资产和相邻镜头约束。不得生成 imagePrompt、videoPrompt 或无依据的剧情事实。必须调用 complete_drama_review。不要使用 Markdown。${globalVisualInstruction}${completionFieldInstruction}${schemaInstruction}`
                              : `你是影视剧本编辑。只提取剧本明确存在的内容事实和镜头边界，不生成 imagePrompt、videoPrompt、镜头运动或画面风格，不添加无依据的主要情节。当前阶段强制执行短剧策划 Skill：${DRAMA_PLANNING_SKILL.instructions}\n${DRAMA_DIALOGUE_TIMING_RULES}必须先按对白容量和动作节点拆分镜头，再输出结构；若一段对白超出当前镜头可说时长且超过 ${DRAMA_DIALOGUE_TIMING_TOLERANCE_CHARS} 个可发音字容差，建议在自然分句、说话人转换或动作反应处拆成多个镜头。内容分析阶段可以返回提醒，但正式制作包 authoring/生产阶段必须由最终质量门禁阻止超容量对白。必须逐句保留所有角色直接说出的原话和原文明示的旁白，utterances 按原文顺序列出每一句，禁止把多句台词压缩成“某人说明/表示/询问”的剧情摘要；说话人转换、明确动作反应或场景变化都应成为可审核的镜头边界，sourceText 必须保留对应连续原文。资产字段必须按类型填写：characters 只写人物身份、外貌、发型、服装与人物固定特征；scenes 只写空间结构、陈设、建筑、地面/墙面/水体等环境材质、天气和环境色，并尽量提取可执行的空间拓扑（入口、出口、座位/长凳、床沿、桌面、通道、门窗、隔断、前进方向、可见支撑面及固定左右关系），让后续镜头能判断人物在哪里坐、站、躺、行走和与谁相邻，禁止在场景的 styling/visualIdentity/description 中写人物发型、服装或随身物件；props 只写道具自身形态、材质和用途。缺少事实时留空，不要用其他资产类型的模板补齐。必须调用 analyze_drama_content。不要使用 Markdown。${schemaInstruction}`,
            },
            { role: "user", content: JSON.stringify(input) },
        ];
        let latestError: unknown;
        for (const candidate of rankTextPlanningCandidates(candidates.map((candidate) => ({ ...candidate, channelId: candidate.channel.id })))) {
            try {
                const call = await requestFunctionCall(
                    resolveInternalOrigin(new URL(request.url).origin),
                    request.headers.get("cookie") || "",
                    candidate,
                    model,
                    messages,
                    user.id,
                    tool,
                    systemAiIdempotencyKey("drama-analyze", user.id, phase, requestId || JSON.stringify(input), candidate.channel.id, candidate.upstreamModel),
                );
                try {
                    const parsed = JSON.parse(call.args);
                    if (phase === "video_prompt") videoPromptCandidate = previewDramaVideoPromptOutput(parsed, videoPromptInput!.shotIds);
                    const data =
                        phase === "visual"
                            ? normalizeDramaVisualAnalysis(parsed, visualInput!.shotIds, visualInput!.payload.shots)
                            : phase === "video_prompt"
                              ? normalizeDramaVideoPromptAnalysis(parsed, videoPromptInput!.shotIds, videoPromptInput!.payload.shots)
                              : phase === "image_prompt"
                                ? normalizeDramaImagePromptAnalysis(parsed, imagePromptInput!.shotIds)
                                : phase === "review_completion"
                                  ? normalizeDramaReviewCompletion(parsed, reviewCompletionInput!.shotIds)
                                  : normalizeDramaContentAnalysis(parsed, settings.generationDefaults.videoSeconds, script);
                    const publicData =
                        phase === "video_prompt"
                            ? {
                                  ...(data as ReturnType<typeof normalizeDramaVideoPromptAnalysis>),
                              }
                            : data;
                    if (phase === "video_prompt") {
                        const qualityError = validateDramaVideoPromptOutput(parsed, videoPromptInput!.shotIds, videoPromptInput!.payload.shots, videoPromptInput!.payload.referenceMaterials, {
                            requireCameraPlan: true,
                            requireTemplateLayout: true,
                            ratio: videoPromptInput!.payload.project.ratio,
                            characters: videoPromptInput!.payload.assets.characters,
                        });
                        if (qualityError) throw new DramaVideoPromptQualityError(qualityError);
                    }
                    const videoPromptTimingWarnings = phase === "video_prompt" ? dramaVideoPromptTimingWarnings(parsed, videoPromptInput!.shotIds, videoPromptInput!.payload.shots) : [];
                    const resultCount = data.shots.length;
                    const visualErrors = phase === "visual" ? validateDramaVisualAnalysis(data as ReturnType<typeof normalizeDramaVisualAnalysis>, visualInput!.payload.shots) : [];
                    const contentTimingWarnings = phase === "content" ? validateDramaContentAnalysisTiming(data as ReturnType<typeof normalizeDramaContentAnalysis>) : [];
                    const publicContentData =
                        phase === "content" && contentTimingWarnings.length
                            ? { ...data, warnings: contentTimingWarnings }
                            : phase === "video_prompt" && videoPromptTimingWarnings.length
                              ? { ...publicData, warnings: videoPromptTimingWarnings }
                              : publicData;
                    const expectedCount =
                        phase === "visual"
                            ? visualInput!.shotIds.length
                            : phase === "video_prompt"
                              ? videoPromptInput!.shotIds.length
                              : phase === "image_prompt"
                                ? imagePromptInput!.shotIds.length
                                : phase === "review_completion"
                                  ? reviewCompletionInput!.shotIds.length
                                  : 1;
                    const completionProgress =
                        phase === "review_completion"
                            ? data.shots.reduce((total, shot) => total + ("shotId" in shot ? reviewCompletionFilledCount(shot as unknown as Record<string, unknown>, reviewCompletionInput!.missingByShot[shot.shotId] || []) : 0), 0)
                            : 0;
                    if (!resultCount || visualErrors.length || ((phase === "visual" || phase === "video_prompt" || phase === "image_prompt") && resultCount !== expectedCount) || (phase === "review_completion" && completionProgress <= 0)) {
                        console.error("[drama-analyze] normalized output invalid", JSON.stringify({ phase, channelId: candidate.channel.id, model: candidate.upstreamModel, resultCount, expectedCount, shape: describeDramaAnalysisCandidate(parsed) }));
                        const qualityMessage =
                            phase === "visual"
                                ? visualErrors.length
                                    ? `模型生成的视觉结构不完整：${visualErrors.join("；")}`
                                    : "模型没有为全部镜头生成视觉结构"
                                : phase === "video_prompt"
                                  ? "模型没有为全部镜头生成视频提示词"
                                  : phase === "image_prompt"
                                    ? "模型没有为全部镜头生成图片提示词"
                                    : phase === "review_completion"
                                      ? "模型没有返回可回填的审核字段，请重试或检查默认文本模型"
                                      : "模型没有生成有效内容结构";
                        throw new Error(qualityMessage);
                    }
                    const response = NextResponse.json({
                        code: 0,
                        data: publicContentData,
                        msg:
                            phase === "visual"
                                ? "视觉结构已生成"
                                : phase === "video_prompt"
                                  ? "视频提示词已生成"
                                  : phase === "image_prompt"
                                    ? "图片提示词已生成"
                                    : phase === "review_completion"
                                      ? `审核字段已回填${completionProgress > 0 ? `（${completionProgress} 项）` : ""}`
                                      : contentTimingWarnings.length
                                        ? `内容结构已生成；对白时长提醒 ${contentTimingWarnings.length} 条，仍可继续导入`
                                        : "内容结构待审核",
                    });
                    if (typeof call.pointsRemaining === "number") response.headers.set("x-vozeb-pro-points-remaining", String(call.pointsRemaining));
                    return response;
                } catch (error) {
                    if (hasSystemAiCharge(call)) refundedPointsRemaining = (await refund(user.id, model, call))?.pointsBalance;
                    throw error;
                }
            } catch (error) {
                if (error instanceof DramaVideoPromptQualityError || error instanceof DramaContentQualityError) throw error;
                latestError = error;
            }
        }
        throw latestError instanceof Error ? latestError : new Error("没有可用的文本模型渠道");
    } catch (error) {
        const status = error instanceof DramaVideoPromptQualityError || error instanceof DramaContentQualityError ? error.status : 502;
        const candidate = phase === "video_prompt" && videoPromptCandidate.length ? { candidate: videoPromptCandidate[0] } : {};
        const response = NextResponse.json({ code: status, data: { ...candidate, reasonCode: classifyDramaAnalysisFailure(error) }, msg: error instanceof Error ? error.message : "剧本分析失败" }, { status });
        if (typeof refundedPointsRemaining === "number") response.headers.set("x-vozeb-pro-points-remaining", String(refundedPointsRemaining));
        return response;
    }
}

function classifyDramaAnalysisFailure(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (error instanceof DramaVideoPromptQualityError || error instanceof DramaContentQualityError || /质量|摄影契约|逐帧|提示词缺少|标准字段|内部模式|叙事标签/u.test(message)) return "quality_gate_failed";
    if (/(?:素材绑定|引用素材|参考素材|资产引用|referenceMaterials)/iu.test(message)) return "missing_asset_reference";
    if (/(?:镜头|shot|frame).{0,20}(?:不存在|未找到|无法解析|引用无效)/iu.test(message)) return "unresolved_shot_reference";
    if (/(?:模型没有|结构化剧本结果|有效内容结构|返回有效)/u.test(message)) return "invalid_model_response";
    if (/(?:不支持|未支持).{0,20}(?:模型|运镜|模式|能力|功能)/iu.test(message)) return "unsupported_model_capability";
    return "upstream_failure";
}

async function requestFunctionCall(
    origin: string,
    cookie: string,
    candidate: TextPlanningCandidate,
    billingModel: string,
    messages: Array<{ role: string; content: string }>,
    userId: string,
    tool: { name: string; description: string; parameters: Record<string, unknown> },
    idempotencyKey: string,
) {
    const headers = { "Content-Type": "application/json", cookie, ...systemAiBillingHeaders(billingModel, idempotencyKey, candidate.upstreamModel) };
    const call = await requestStructuredText({
        origin,
        cookie,
        candidate,
        messages,
        tool,
        headers,
        onInvalidResponse: (responseHeaders) => refund(userId, billingModel, responseHeaders),
    });
    if (!hasUsableDramaToolArguments(call.arguments, tool.name)) {
        console.error("[drama-analyze] structured output invalid", JSON.stringify({ endpoint: call.protocol, channelId: candidate.channel.id, model: candidate.upstreamModel, argumentShape: describeArgumentsText(call.arguments) }));
        await refund(userId, billingModel, call.headers);
        throw new Error("模型没有返回结构化剧本结果");
    }
    return readCallResult(call.arguments, call.headers);
}

function readCallResult(args: string, headers: Headers) {
    const remaining = Number(headers.get("x-vozeb-pro-points-remaining"));
    return {
        args,
        pointsRemaining: Number.isFinite(remaining) ? remaining : undefined,
        ...readSystemAiBilling(headers),
    };
}

function describeArgumentsText(value: string) {
    if (!value) return { present: false };
    try {
        return { present: true, ...describeDramaAnalysisCandidate(JSON.parse(value)) };
    } catch {
        return { present: true, parseable: false };
    }
}

async function refund(userId: string, model: string, source: Headers | SystemAiBilling) {
    const billing = source instanceof Headers ? readSystemAiBilling(source) : source;
    return hasSystemAiCharge(billing) ? refundUserPoints(userId, model, billing.pointsCost, "text", 1, undefined, billing.pointsRecordId) : null;
}
