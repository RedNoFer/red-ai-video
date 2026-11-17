import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { dramaVideoExportArchivePath, getDramaVideoExportJob } from "@/lib/server/drama-video-export-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; jobId: string }> };

export async function GET(_: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const params = await context.params;
    const job = await getDramaVideoExportJob(params.jobId);
    if (!job || job.userId !== user.id || job.projectId !== params.id) return NextResponse.json({ code: 404, data: null, msg: "导出任务不存在" }, { status: 404 });
    if (job.status !== "success") return NextResponse.json({ code: 409, data: null, msg: "导出任务尚未完成" }, { status: 409 });
    const filePath = dramaVideoExportArchivePath(job.id);
    let size: number;
    try {
        size = (await stat(filePath)).size;
    } catch {
        return NextResponse.json({ code: 404, data: null, msg: "导出文件已过期，请重新导出" }, { status: 404 });
    }
    const stream = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream;
    return new Response(stream, {
        headers: {
            "Content-Type": "application/zip",
            "Content-Length": String(size),
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(job.fileName || "短剧视频.zip")}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
