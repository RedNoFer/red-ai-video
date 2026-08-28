import { NextResponse } from "next/server";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { DramaProjectServiceError, updateDramaProductionRunForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; runId: string }> };

export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, 256 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    const params = await context.params;
    try {
        const body = parsed.data && typeof parsed.data === "object" ? { ...(parsed.data as Record<string, unknown>), origin: resolveInternalOrigin(new URL(request.url).origin), cookie: request.headers.get("cookie") || "" } : parsed.data;
        const run = await updateDramaProductionRunForUser(user.id, params.id, params.runId, body);
        return NextResponse.json({ code: 0, data: { run }, msg: "生产运行已更新" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
