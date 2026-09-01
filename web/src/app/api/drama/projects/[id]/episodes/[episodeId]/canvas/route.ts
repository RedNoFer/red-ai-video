import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { DramaProjectServiceError, ensureDramaEpisodeCanvasForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; episodeId: string }> };

export async function POST(_request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const params = await context.params;
        const canvas = await ensureDramaEpisodeCanvasForUser(user.id, params.id, params.episodeId);
        return NextResponse.json({ code: 0, data: { canvas }, msg: "本集画布已同步" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
