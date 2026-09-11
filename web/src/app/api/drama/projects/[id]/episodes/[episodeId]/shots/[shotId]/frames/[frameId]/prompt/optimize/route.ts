import { NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { CREATE_AGENT_PROMPT_MAX_LENGTH } from "@/lib/create-agent-prompt";
import { resolveDramaGlobalVisualContract } from "@/lib/drama-style";
import { getDramaProjectForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { buildDramaFramePromptContext, formatDramaFramePromptContext } from "@/lib/server/drama-frame-prompt-context";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { optimizeCreativePrompt, PromptOptimizationError } from "@/lib/server/prompt-optimization-service";
import { checkGenerationRateLimit, rateLimitHeaders } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 2400;

type Context = { params: Promise<{ id: string; episodeId: string; shotId: string; frameId: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const rate = await checkGenerationRateLimit(user.id, request, "text");
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: "优化请求过于频繁，请稍后重试" }, { status: 429, headers: rateLimitHeaders(rate) });
    const parsed = await readJsonBodyResult<{ requestId?: unknown; prompt?: unknown; correctionDirection?: unknown }>(request, 512 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    const prompt = text(parsed.data.prompt, CREATE_AGENT_PROMPT_MAX_LENGTH);
    const requestId = text(parsed.data.requestId, 160);
    if (!prompt || !requestId) return NextResponse.json({ code: 400, data: null, msg: "请先输入需要优化的图片帧提示词" }, { status: 400 });
    try {
        const { id, episodeId, shotId, frameId } = await context.params;
        const project = await getDramaProjectForUser(user.id, id);
        const frameContext = buildDramaFramePromptContext(project, episodeId, shotId, frameId, prompt);
        const optimizedPrompt = await optimizeCreativePrompt({
            origin: resolveInternalOrigin(new URL(request.url).origin),
            cookie: request.headers.get("cookie") || "",
            userId: user.id,
            requestId,
            prompt,
            mode: "drama-frame",
            visualContract: resolveDramaGlobalVisualContract(project),
            dramaFrameContext: formatDramaFramePromptContext(frameContext),
            correctionDirection: text(parsed.data.correctionDirection, 4000),
        });
        return NextResponse.json({ code: 0, data: { prompt: optimizedPrompt }, msg: "OK" });
    } catch (error) {
        const status = error instanceof DramaProjectServiceError || error instanceof PromptOptimizationError ? error.status : 502;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "图片帧提示词优化失败" }, { status });
    }
}

function text(value: unknown, maxLength: number) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
