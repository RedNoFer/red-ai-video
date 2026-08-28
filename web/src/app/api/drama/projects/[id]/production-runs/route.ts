import { NextResponse } from "next/server";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { createDramaProductionRunForUser, DramaProjectServiceError, getDramaProductionPreflightForUser, getLatestDramaProductionRunForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 2400;

export async function GET(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const projectId = (await context.params).id;
        const episodeId = new URL(request.url).searchParams.get("episodeId") || "";
        const scope = new URL(request.url).searchParams.get("scope") === "visual" ? ("visual" as const) : ("production" as const);
        const preflight = await getDramaProductionPreflightForUser(user.id, projectId, episodeId);
        const run = await getLatestDramaProductionRunForUser(user.id, projectId, episodeId, { origin: resolveInternalOrigin(new URL(request.url).origin), cookie: request.headers.get("cookie") || "", scope });
        return NextResponse.json({ code: 0, data: { run, preflight }, msg: "OK" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, 256 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const body = parsed.data && typeof parsed.data === "object" ? { ...(parsed.data as Record<string, unknown>), origin: resolveInternalOrigin(new URL(request.url).origin), cookie: request.headers.get("cookie") || "" } : parsed.data;
        const run = await createDramaProductionRunForUser(user.id, (await context.params).id, body);
        return NextResponse.json({ code: 0, data: { run }, msg: "连续性生产计划已锁定" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
