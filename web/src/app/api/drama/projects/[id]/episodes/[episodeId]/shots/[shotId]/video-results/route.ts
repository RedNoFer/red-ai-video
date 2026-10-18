import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { DramaProjectServiceError, syncDramaShotVideoResultsForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; episodeId: string; shotId: string }> };

export async function GET(_: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const params = await context.params;
        const result = await syncDramaShotVideoResultsForUser(user.id, params.id, params.episodeId, params.shotId);
        return NextResponse.json({ code: 0, data: result, msg: "镜头成功视频已同步" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
