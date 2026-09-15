import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { DramaProjectServiceError, updateDramaStoryboardFrameGenerationStateForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; episodeId: string; shotId: string }> };

export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, 256 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const { id, episodeId, shotId } = await context.params;
        const result = await updateDramaStoryboardFrameGenerationStateForUser(user.id, id, episodeId, shotId, parsed.data);
        return NextResponse.json({ code: 0, data: result, msg: "当前镜头分镜生成状态已保存" });
    } catch (error) {
        const status = error instanceof DramaProjectServiceError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "分镜生成状态保存失败" }, { status });
    }
}
