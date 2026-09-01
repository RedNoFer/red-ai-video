import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { DramaProjectServiceError, preflightDramaGenerationForUser } from "@/lib/server/drama-project-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, 2 * 1024 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const body = parsed.data && typeof parsed.data === "object" ? { ...(parsed.data as Record<string, unknown>), origin: resolveInternalOrigin(new URL(request.url).origin), cookie: request.headers.get("cookie") || "" } : parsed.data;
        const preflight = await preflightDramaGenerationForUser(user.id, String((body as Record<string, unknown>)?.projectId || ""), body);
        return NextResponse.json({ code: 0, data: { preflight }, msg: "生成前预检已完成" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
