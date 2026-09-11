import { NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { CREATE_AGENT_PROMPT_MAX_LENGTH } from "@/lib/create-agent-prompt";
import { DRAMA_PUBLIC_STATIC_FRAME_PROMPT_CONTRACT } from "@/lib/drama-public-prompt-contract";
import { getDramaProjectForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { buildDramaFramePromptContext, formatDramaFramePromptContext } from "@/lib/server/drama-frame-prompt-context";
import { resolveDramaDirectorInstructions, DRAMA_VIDEO_DIRECTOR_SKILL } from "@/lib/server/agent-skills/drama-video-director";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; episodeId: string; shotId: string; frameId: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<{ prompt?: unknown; correctionDirection?: unknown }>(request, 512 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const { id, episodeId, shotId, frameId } = await context.params;
        const project = await getDramaProjectForUser(user.id, id);
        const prompt = text(parsed.data.prompt, CREATE_AGENT_PROMPT_MAX_LENGTH);
        const correctionDirection = text(parsed.data.correctionDirection, 4000);
        const contextFacts = formatDramaFramePromptContext(buildDramaFramePromptContext(project, episodeId, shotId, frameId, prompt || undefined));
        const brief = [
            "短剧图片帧外部 Agent 工作单",
            `规则源版本：${DRAMA_VIDEO_DIRECTOR_SKILL.sourceVersion}`,
            `规则源内容哈希：${DRAMA_VIDEO_DIRECTOR_SKILL.sourceContentHash}`,
            "用途：根据下方项目事实，只生成当前图片帧的公开提示词；完成后可直接复制回项目帧编辑器保存。",
            "",
            "统一导演规则：",
            resolveDramaDirectorInstructions("external-codex"),
            "",
            DRAMA_PUBLIC_STATIC_FRAME_PROMPT_CONTRACT.trim(),
            "",
            contextFacts,
            correctionDirection ? `\n本次用户整改方向（仅影响本次输出，不覆盖项目长期规则）：\n${correctionDirection}` : "",
            "",
            "最终只输出九行公开提示词，字段顺序固定为：静态关键帧、可见状态、可见表演状态、景别、机位与构图、站位与视线、三层空间、光色与风格、负面约束。不要输出 ID、URL、供应商参数、规则说明、JSON、Markdown 或评估文字。",
        ].join("\n");
        return NextResponse.json({ code: 0, data: { brief, sourceVersion: DRAMA_VIDEO_DIRECTOR_SKILL.sourceVersion, sourceContentHash: DRAMA_VIDEO_DIRECTOR_SKILL.sourceContentHash }, msg: "OK" });
    } catch (error) {
        const status = error instanceof DramaProjectServiceError ? error.status : 400;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "外部 Agent 工作单生成失败" }, { status });
    }
}

function text(value: unknown, maxLength: number) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
