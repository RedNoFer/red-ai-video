import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { deleteDramaStoryboardFrameForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; episodeId: string; shotId: string; frameId: string }> };

export async function DELETE(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<{ removeBeat?: unknown }>(request, 16 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const { id, episodeId, shotId, frameId } = await context.params;
        const { project, deletion } = await deleteDramaStoryboardFrameForUser(user.id, id, episodeId, shotId, frameId, parsed.data.removeBeat === true);
        return NextResponse.json({ code: 0, data: { project, ...deletion }, msg: "分镜图片已物理删除" });
    } catch (error) {
        const status = error instanceof DramaProjectServiceError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "分镜图片删除失败" }, { status });
    }
}
