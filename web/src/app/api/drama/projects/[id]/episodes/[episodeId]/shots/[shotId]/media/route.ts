import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { DramaProjectServiceError, updateDramaShotMediaForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; episodeId: string; shotId: string }> };

export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const parsed = await readJsonBodyResult<unknown>(request);
        if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
        const params = await context.params;
        const project = await updateDramaShotMediaForUser(user.id, params.id, params.episodeId, params.shotId, parsed.data);
        return NextResponse.json({ code: 0, data: { project }, msg: "短剧镜头已更新" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
