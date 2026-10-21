import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { collectDramaVideoExportPayload } from "@/lib/server/drama-video-export";
import { getDramaProjectForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const project = await getDramaProjectForUser(user.id, (await context.params).id);
        const payload = await collectDramaVideoExportPayload(user.id, project);
        return NextResponse.json({ code: 0, data: payload, msg: "镜头视频已读取" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        console.error("drama video list failed", error);
        return NextResponse.json({ code: 500, data: null, msg: "读取镜头视频失败" }, { status: 500 });
    }
}
