import { after, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDramaVideoExportJob, publicDramaVideoExportJob } from "@/lib/server/drama-video-export-store";
import { prepareResumableDramaVideoExportJobs, runDramaVideoExportJob } from "@/lib/server/drama-video-export-runner";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; jobId: string }> };

export async function GET(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const job = await getDramaVideoExportJob((await context.params).jobId);
    if (!job || job.userId !== user.id) return NextResponse.json({ code: 404, data: null, msg: "导出任务不存在" }, { status: 404 });
    if (job.status === "pending" || job.status === "running") {
        const resumable = prepareResumableDramaVideoExportJobs([job]);
        if (resumable.length) {
            const origin = resolveInternalOrigin(new URL(request.url).origin);
            const cookie = request.headers.get("cookie") || "";
            after(async () => {
                for (const item of resumable) await runDramaVideoExportJob(item, { origin, cookie });
            });
        }
    }
    return NextResponse.json({ code: 0, data: publicDramaVideoExportJob(job), msg: "OK" });
}
