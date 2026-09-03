import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { reviewDramaStoryboardFrameForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { checkRateLimit } from "@/lib/server/security";

type Context = { params: Promise<{ id: string; episodeId: string; shotId: string; frameId: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    if (!(await checkRateLimit(`drama-frame-review:${user.id}`, { maxRequests: 8, windowMs: 60_000 })).allowed) return NextResponse.json({ code: 429, data: null, msg: "图片检验请求过于频繁，请稍后重试" }, { status: 429 });
    try {
        const { id, episodeId, shotId, frameId } = await context.params;
        const data = await reviewDramaStoryboardFrameForUser(user.id, id, episodeId, shotId, frameId, {
            origin: resolveInternalOrigin(new URL(request.url).origin),
            cookie: request.headers.get("cookie") || "",
        });
        return NextResponse.json({ code: 0, data, msg: data.review.status === "unavailable" ? "图片检验暂不可用" : "图片检验完成" });
    } catch (error) {
        const status = error instanceof DramaProjectServiceError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "图片检验失败" }, { status });
    }
}
