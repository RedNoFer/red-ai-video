import { after, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import type { DramaSubtitleExportMode } from "@/lib/drama-subtitle-plan";
import { normalizeDramaSubtitleExportModes } from "@/lib/drama-video-export";
import { collectDramaVideoExportPayload, resolveDramaVideoExportEntries, DramaVideoExportError } from "@/lib/server/drama-video-export";
import { createDramaVideoExportJob, listDramaVideoExportJobs, publicDramaVideoExportJob } from "@/lib/server/drama-video-export-store";
import { prepareDramaVideoExportJob, prepareResumableDramaVideoExportJobs, runDramaVideoExportJob } from "@/lib/server/drama-video-export-runner";
import { getDramaProjectForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { ffmpegSubtitleAvailable } from "@/lib/server/ffmpeg";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

export const runtime = "nodejs";
export const maxDuration = 2400;
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const MAX_ACTIVE_EXPORTS = 2;

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const parsed = await readJsonBodyResult<{
            items?: Array<{ episodeId?: string; shotId?: string; videoId?: string }>;
            includeSubtitles?: boolean;
            subtitleModes?: unknown;
            includeOriginals?: boolean;
        }>(request);
        if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
        const items = Array.isArray(parsed.data.items) ? parsed.data.items : [];
        if (!items.length) return NextResponse.json({ code: 422, data: null, msg: "请先选择要下载的视频" }, { status: 422 });
        const includeOriginals = parsed.data.includeOriginals !== false;
        const project = await getDramaProjectForUser(user.id, (await context.params).id);
        const payload = await collectDramaVideoExportPayload(user.id, project);
        const entries = resolveDramaVideoExportEntries(payload, items);
        if (!entries.length) return NextResponse.json({ code: 422, data: null, msg: "所选视频已不存在，请刷新后重试" }, { status: 422 });
        const subtitleModes: DramaSubtitleExportMode[] = normalizeDramaSubtitleExportModes(parsed.data.subtitleModes);
        if (!subtitleModes.length && parsed.data.includeSubtitles === true) subtitleModes.push("bilingual");
        if (!includeOriginals && !subtitleModes.length) return NextResponse.json({ code: 422, data: null, msg: "仅字幕版需要至少选择一种字幕版本" }, { status: 422 });
        const requestedKeys = new Set(entries.map((entry) => `${entry.episodeId}::${entry.shotId}`));
        const selectedShots = payload.episodes.flatMap((episode) => episode.shots.filter((shot) => requestedKeys.has(`${episode.episodeId}::${shot.shotId}`)));
        const needsSubtitleRender = subtitleModes.some((mode) => selectedShots.some((shot) => (mode === "english" ? shot.hasEnglishSubtitles : shot.hasSubtitles)));
        if (!includeOriginals && !needsSubtitleRender) return NextResponse.json({ code: 422, data: null, msg: "所选镜头没有可导出的字幕内容" }, { status: 422 });
        if (needsSubtitleRender && !(await ffmpegSubtitleAvailable())) return NextResponse.json({ code: 503, data: null, msg: "当前服务器 FFmpeg 未启用 libass，无法烧录字幕" }, { status: 503 });
        const activeJobs = (await listDramaVideoExportJobs({ userId: user.id, projectId: project.id, limit: 20 })).filter((job) => job.status === "pending" || job.status === "running");
        if (activeJobs.length >= MAX_ACTIVE_EXPORTS) return NextResponse.json({ code: 429, data: null, msg: `当前已有 ${MAX_ACTIVE_EXPORTS} 个导出任务正在进行，请等待完成` }, { status: 429 });
        const job = await createDramaVideoExportJob({
            userId: user.id,
            projectId: project.id,
            projectTitle: project.title,
            entries,
            subtitleModes,
            includeOriginals,
        });
        const origin = resolveInternalOrigin(new URL(request.url).origin);
        const cookie = request.headers.get("cookie") || "";
        if (prepareDramaVideoExportJob(job.id)) after(() => runDramaVideoExportJob(job, { origin, cookie }));
        return NextResponse.json({ code: 0, data: publicDramaVideoExportJob(job), msg: "导出任务已创建" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError || error instanceof DramaVideoExportError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        console.error("drama video export failed", error);
        return NextResponse.json({ code: 500, data: null, msg: "批量下载视频失败" }, { status: 500 });
    }
}

export async function GET(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const project = await getDramaProjectForUser(user.id, (await context.params).id);
        const jobs = await listDramaVideoExportJobs({ userId: user.id, projectId: project.id, limit: 10 });
        const resumable = prepareResumableDramaVideoExportJobs(jobs);
        if (resumable.length) {
            const origin = resolveInternalOrigin(new URL(request.url).origin);
            const cookie = request.headers.get("cookie") || "";
            after(async () => {
                for (const job of resumable) await runDramaVideoExportJob(job, { origin, cookie });
            });
        }
        return NextResponse.json({ code: 0, data: jobs.map(publicDramaVideoExportJob), msg: "OK" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        console.error("drama video export list failed", error);
        return NextResponse.json({ code: 500, data: null, msg: "读取导出任务失败" }, { status: 500 });
    }
}
