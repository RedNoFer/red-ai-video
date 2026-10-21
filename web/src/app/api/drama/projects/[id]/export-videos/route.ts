import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { collectDramaVideoExportPayload, exportDramaVideos, resolveDramaVideoExportEntries, DramaVideoExportError } from "@/lib/server/drama-video-export";
import { getDramaProjectForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

export const runtime = "nodejs";
export const maxDuration = 2400;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const parsed = await readJsonBodyResult<{ items?: Array<{ episodeId?: string; shotId?: string; videoId?: string }> }>(request);
        if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
        const items = Array.isArray(parsed.data.items) ? parsed.data.items : [];
        if (!items.length) return NextResponse.json({ code: 422, data: null, msg: "请先选择要下载的视频" }, { status: 422 });
        const project = await getDramaProjectForUser(user.id, (await context.params).id);
        const payload = await collectDramaVideoExportPayload(user.id, project);
        const entries = resolveDramaVideoExportEntries(payload, items);
        if (!entries.length) return NextResponse.json({ code: 422, data: null, msg: "所选视频已不存在，请刷新后重试" }, { status: 422 });
        const result = await exportDramaVideos({ project, entries, origin: resolveInternalOrigin(new URL(request.url).origin), cookie: request.headers.get("cookie") || "" });
        return new Response(result.stream, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
                "X-Drama-Video-Export-Exported": String(result.exported),
                "X-Drama-Video-Export-Failed": String(result.failed),
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        if (error instanceof DramaProjectServiceError || error instanceof DramaVideoExportError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        console.error("drama video export failed", error);
        return NextResponse.json({ code: 500, data: null, msg: "批量下载视频失败" }, { status: 500 });
    }
}
