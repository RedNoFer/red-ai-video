import { after, NextResponse } from "next/server";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { resolvePublicRequestOrigin } from "@/lib/server/public-request-origin";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { createDramaProductionRunForUser, DramaProjectServiceError, getDramaProductionPreflightForUser, getLatestDramaProductionRunForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 2400;

const dispatchingRuns = new Set<string>();

function scheduleProductionDispatch(userId: string, projectId: string, episodeId: string, run: { id: string; confirmedAt?: string; status: string } | null | undefined, transport: { origin: string; publicOrigin: string; cookie: string }) {
    if (!run?.confirmedAt || !["ready", "running"].includes(run.status)) return;
    const key = `${userId}:${projectId}:${run.id}`;
    if (dispatchingRuns.has(key)) return;
    dispatchingRuns.add(key);
    after(async () => {
        try {
            await getLatestDramaProductionRunForUser(userId, projectId, episodeId, { ...transport, scope: "production" });
        } catch (error) {
            console.error("Drama production background dispatch failed", error);
        } finally {
            dispatchingRuns.delete(key);
        }
    });
}

export async function GET(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const projectId = (await context.params).id;
        const episodeId = new URL(request.url).searchParams.get("episodeId") || "";
        const scope = new URL(request.url).searchParams.get("scope") === "visual" ? ("visual" as const) : ("production" as const);
        const preflight = scope === "production" ? await getDramaProductionPreflightForUser(user.id, projectId, episodeId) : undefined;
        const transport = {
            origin: resolveInternalOrigin(new URL(request.url).origin),
            publicOrigin: resolvePublicRequestOrigin(request),
            cookie: request.headers.get("cookie") || "",
        };
        const run = await getLatestDramaProductionRunForUser(user.id, projectId, episodeId, {
            ...transport,
            scope,
            deferDispatch: scope === "production",
        });
        if (scope === "production") scheduleProductionDispatch(user.id, projectId, episodeId, run, transport);
        return NextResponse.json({ code: 0, data: { run, preflight: preflight || null }, msg: "OK" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        console.error("Drama production run read failed", error);
        return NextResponse.json({ code: 500, data: null, msg: error instanceof Error ? error.message : "短剧生产运行读取失败" }, { status: 500 });
    }
}

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, 256 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const projectId = (await context.params).id;
        const transport = { origin: resolveInternalOrigin(new URL(request.url).origin), publicOrigin: resolvePublicRequestOrigin(request), cookie: request.headers.get("cookie") || "" };
        const body = parsed.data && typeof parsed.data === "object" ? { ...(parsed.data as Record<string, unknown>), ...transport, deferDispatch: (parsed.data as Record<string, unknown>).scope !== "visual" } : parsed.data;
        const run = await createDramaProductionRunForUser(user.id, projectId, body);
        if (run.scope !== "visual") scheduleProductionDispatch(user.id, projectId, run.episodeId, run, transport);
        return NextResponse.json({ code: 0, data: { run }, msg: "连续性生产计划已锁定" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        console.error("Drama production run creation failed", error);
        return NextResponse.json({ code: 500, data: null, msg: error instanceof Error ? error.message : "短剧生产计划创建失败" }, { status: 500 });
    }
}
