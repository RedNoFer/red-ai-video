import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { DramaProjectServiceError, syncDramaCanvasForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const { id } = await context.params;
        const canvas = await syncDramaCanvasForUser(user.id, id);
        return NextResponse.json({ code: 0, data: { canvas }, msg: "历史短剧画布已重建" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
