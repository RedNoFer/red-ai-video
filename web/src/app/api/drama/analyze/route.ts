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
    type DramaAnalyzeBody,
} from "@/lib/server/drama-analysis-input";
import { DRAMA_PLANNING_SKILL, SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT, SEEDANCE_STATIC_FRAME_RULES } from "@/lib/server/agent-skills/creative-shortcuts";
import { DRAMA_DIALOGUE_TIMING_RULES, DRAMA_DIALOGUE_TIMING_TOLERANCE_CHARS } from "@/lib/drama-dialogue-timing";
import { resolveSeedance25DirectorInstructions } from "@/lib/server/agent-skills/seedance-25";
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
    if (!model || !candidates.length) return NextResponse.json({ code: 400, data: null, msg: "后台尚未配置可用的默认文本模型" }, { status: 400 });

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
        const videoPromptSource =
            phase === "video_prompt"
                ? (Array.isArray(body.shots) ? body.shots : [])
                      .map((value: unknown) => {
                          const shot = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
                          return [shot.videoPrompt, shot.executionVideoPrompt, shot.description].map(dramaAnalysisText).filter(Boolean).join("\n");
                      })
                      .filter(Boolean)
                      .join("\n")
                : "";
        const seedance25VideoInstructions =
            phase === "video_prompt" ? resolveSeedance25DirectorInstructions({ prompt: [dramaAnalysisText(body.instruction), videoPromptSource].filter(Boolean).join("\n"), durationSeconds: videoPromptDuration }).instructions : "";
        const schemaInstruction = buildDramaAnalyzeSchemaInstruction(phase, tool.parameters, seedance25VideoInstructions);
        const videoReferenceEntries =
            phase === "video_prompt"
                ? Array.isArray(videoPromptInput?.payload.referenceMaterials)
                    ? videoPromptInput.payload.referenceMaterials.flatMap((value) => {
                          const reference = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
                          if (typeof reference.alias !== "string" || !reference.alias.trim()) return [];
                          const purpose = typeof reference.purpose === "string" ? reference.purpose.trim() : "";
                          return [`${reference.alias.trim()}${purpose ? `：${purpose}` : ""}`];
                      })
                    : []
                : [];
        const videoReferenceInstruction = videoReferenceEntries.length ? `本次参考素材绑定清单（必须逐字使用，不能猜测、改名或省略）：${videoReferenceEntries.join("；")}。公开视频的第一段必须写“素材绑定：”，并逐项列出上述 alias 及其唯一职责。` : "";
        const completionFieldInstruction = phase === "review_completion" ? `本次请求字段必须逐项真实补全，禁止只返回 shotId 空壳。${dramaReviewCompletionFieldInstructions(reviewCompletionInput!.fields)}` : "";
        const messages = [
            {
                role: "system",
                content:
                    phase === "visual"
                        ? `你是影视视觉导演和表演导演。输入内容已经由用户审核，必须严格保留每个 shotId、镜头数量、顺序、人物、场景、对白、旁白、原文和时长。为每个镜头补充图片提示词、视频提示词、起始/结束帧提示词、镜头运动、连续性、结构化人物表演计划、逐句对白表演、色彩灯光计划和 framePlan。生成前先根据场景资产完成现实可行的调度：场景有哪些座椅、长凳、地面、通道、门窗、车辆舱位或遮挡；每名实际出镜者在同一参照系下位于哪里、朝向哪里、看向谁或什么、身体如何被支撑、和其他出镜者怎样相对。坐姿必须落在可见的合理支撑面；多人必须写清左右/前后和视线关系；没有原文或资产依据的人物不得新增。表演必须写成可执行的外在行为：情绪目标、情绪起中止递进、眉眼嘴角下颌、视线、呼吸、身体反应、语气、停顿、重音和节奏；禁止只写“表情自然”“情绪丰富”等抽象词。对白和旁白可以不进入静态图片文字，但对白引发的表情、视线、手部/身体姿态、道具或环境变化必须进入对应 framePlan.frames 的 imagePrompt。每帧 imagePrompt 必须是独立可执行的静态画面，写明本帧可见状态并与上一帧有真实可见差异；禁止复制整镜头提示词后追加“起始状态/动作展开/关键变化/结果状态”等通用词。framePlan 必须提供 1-9 个按真实动作节点连续覆盖镜头时长的帧段。灯光必须明确色板、色温、主光、补光、轮廓光、反差、材质反射、肤色保护和跨镜继承/过渡。连续性必须明确景别、机位、构图、人物站位、视线、动作起止、屏幕运动方向和轴线规则。镜头之间要保持人物服装、道具、空间、表演状态和光色关系连续。不得新增输入中没有的剧情事实。必须调用 design_drama_visuals。不要使用 Markdown。${schemaInstruction}`
                        : phase === "video_prompt"
                          ? `你是图生视频执行提示词导演。仅根据输入的镜头事实、已验收帧、连续性状态和脱敏 referenceMaterials 执行当前 Seedance 2.5 导演 Skill，直接生成完整公开 videoPrompt；videoPrompt 本身必须包含每个真实时间段的时间范围、起点、动作与触发、可见衔接和终点，framePlan.frames 只作为同一内容的结构化镜像。不得生成图片提示词、改变镜头事实、输出 URL、内部 ID、JSON、Markdown 标题或解释文字。必须调用 generate_drama_video_prompts。${videoReferenceInstruction}${schemaInstruction}`
                          : phase === "image_prompt"
                            ? `你是 Seedance 2.0 静态生图提示词导演。只优化当前镜头的图片提示词，不改变剧情事实、人物身份、资产造型或镜头数量。${SEEDANCE_STATIC_FRAME_RULES}${SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT}输出一条可直接提交给图片供应商的静态画面提示词，主体和可见状态前置，明确场景空间、景别、机位、构图、光线色彩、材质细节、风格与针对性负面约束；参考图职责由 referenceManifest 和服务端绑定单独承载；禁止运镜、时间段、动作过程、对白转述、内部 ID、URL、JSON、Markdown 标题或解释文字。必须使用固定资产的身份、空间和道具约束，并保持与连续性入口状态一致。${schemaInstruction}`
                            : phase === "review_completion"
                              ? `你是影视制作审核编辑。只根据输入镜头和剧本中明确存在的事实，补充或按用户要求优化审核字段。可以只返回确实能够判断的字段，不要为了凑齐字段编造内容；必须保留每个返回项的 shotId，并且本次请求的字段必须全部返回，禁止只返回 shotId 或空对象。补充表演目标、情绪递进、语气节奏、呼吸、色彩灯光、连续性、转场、实际首帧和实际尾帧等制作审核信息时，内容必须具体、可执行，并与原文和相邻镜头一致。若输入包含 instruction，必须优先响应其中的修改方向，但不得违反项目事实、固定资产和相邻镜头约束。不得生成 imagePrompt、videoPrompt 或无依据的剧情事实。必须调用 complete_drama_review。不要使用 Markdown。${completionFieldInstruction}${schemaInstruction}`
                              : `你是影视剧本编辑。只提取剧本明确存在的内容事实和镜头边界，不生成 imagePrompt、videoPrompt、镜头运动或画面风格，不添加无依据的主要情节。当前阶段强制执行短剧策划 Skill：${DRAMA_PLANNING_SKILL.instructions}\n${DRAMA_DIALOGUE_TIMING_RULES}必须先按对白容量和动作节点拆分镜头，再输出结构；若一段对白超出当前镜头可说时长且超过 ${DRAMA_DIALOGUE_TIMING_TOLERANCE_CHARS} 个可发音字容差，建议在自然分句、说话人转换或动作反应处拆成多个镜头，但只做提醒，不得阻止内容结果返回或后续导入。必须逐句保留所有角色直接说出的原话和原文明示的旁白，utterances 按原文顺序列出每一句，禁止把多句台词压缩成“某人说明/表示/询问”的剧情摘要；说话人转换、明确动作反应或场景变化都应成为可审核的镜头边界，sourceText 必须保留对应连续原文。资产字段必须按类型填写：characters 只写人物身份、外貌、发型、服装与人物固定特征；scenes 只写空间结构、陈设、建筑、地面/墙面/水体等环境材质、天气和环境色，并尽量提取可执行的空间拓扑（入口、出口、座位/长凳、床沿、桌面、通道、门窗、隔断、前进方向、可见支撑面及固定左右关系），让后续镜头能判断人物在哪里坐、站、躺、行走和与谁相邻，禁止在场景的 styling/visualIdentity/description 中写人物发型、服装或随身物件；props 只写道具自身形态、材质和用途。缺少事实时留空，不要用其他资产类型的模板补齐。必须调用 analyze_drama_content。不要使用 Markdown。${schemaInstruction}`,
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
                        const qualityError = validateDramaVideoPromptOutput(parsed, videoPromptInput!.shotIds, videoPromptInput!.payload.shots, videoPromptInput!.payload.referenceMaterials);
                        if (qualityError) throw new DramaVideoPromptQualityError(qualityError);
                    }
                    const resultCount = data.shots.length;
                    const visualErrors = phase === "visual" ? validateDramaVisualAnalysis(data as ReturnType<typeof normalizeDramaVisualAnalysis>) : [];
                    const contentTimingWarnings = phase === "content" ? validateDramaContentAnalysisTiming(data as ReturnType<typeof normalizeDramaContentAnalysis>) : [];
                    const publicContentData = phase === "content" && contentTimingWarnings.length ? { ...data, warnings: contentTimingWarnings } : publicData;
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
        const response = NextResponse.json({ code: status, data: phase === "video_prompt" && videoPromptCandidate.length ? { candidate: videoPromptCandidate[0] } : null, msg: error instanceof Error ? error.message : "剧本分析失败" }, { status });
        if (typeof refundedPointsRemaining === "number") response.headers.set("x-vozeb-pro-points-remaining", String(refundedPointsRemaining));
        return response;
    }
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
