import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { DramaProjectServiceError, updateDramaShotPromptForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; episodeId: string; shotId: string }> };

export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const parsed = await readJsonBodyResult<unknown>(request);
        if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
        const params = await context.params;
        const project = await updateDramaShotPromptForUser(user.id, params.id, params.episodeId, params.shotId, parsed.data);
        const input = parsed.data && typeof parsed.data === "object" ? parsed.data as Record<string, unknown> : {};
        if (new URL(request.url).searchParams.get("response") === "shot") {
            const shot = project.episodes.find((episode) => episode.id === params.episodeId)?.shots.find((item) => item.id === params.shotId);
            if (!shot) return NextResponse.json({ code: 404, data: null, msg: "短剧镜头不存在" }, { status: 404 });
            return NextResponse.json({ code: 0, data: { projectId: project.id, episodeId: params.episodeId, shotId: params.shotId, updatedAt: project.updatedAt, shot }, msg: "短剧视频提示词已更新" });
        }
        return NextResponse.json({ code: 0, data: { project }, msg: typeof input.imagePrompt === "string" ? "短剧图片提示词已更新" : "短剧视频提示词已更新" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
