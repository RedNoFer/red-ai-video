import { NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { DramaProjectServiceError, updateDramaStoryboardFramePromptForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; episodeId: string; shotId: string; frameId: string }> };

export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<{ supplierPrompt?: string }>(request);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const { id, episodeId, shotId, frameId } = await context.params;
        const project = await updateDramaStoryboardFramePromptForUser(user.id, id, episodeId, shotId, frameId, parsed.data);
        return NextResponse.json({ code: 0, data: { project }, msg: "短剧分镜帧图片提示词已更新" });
    } catch (error) {
        const status = error instanceof DramaProjectServiceError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "分镜帧图片提示词保存失败" }, { status });
    }
}
