import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { decideDramaContinuityFrameForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; episodeId: string; shotId: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const params = await context.params;
        const project = await decideDramaContinuityFrameForUser(user.id, params.id, params.episodeId, params.shotId, parsed.data);
        return NextResponse.json({ code: 0, data: { project }, msg: "连续性尾帧验收已保存" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
