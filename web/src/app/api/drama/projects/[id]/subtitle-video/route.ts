import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings } from "@/lib/auth/store";
import { dramaShotHasSubtitleText, planDramaShotSubtitles } from "@/lib/drama-subtitle-plan";
import { checkGenerationRateLimit, rateLimitHeaders } from "@/lib/server/security";
import { collectDramaVideoExportPayload, DramaVideoExportError, resolveDramaVideoExportEntries } from "@/lib/server/drama-video-export";
import { getDramaProjectForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { ffmpegAvailable, ffmpegSubtitleAvailable } from "@/lib/server/ffmpeg";
import { withGenerationConcurrencyLimit } from "@/lib/server/generation-task-store";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { downloadMediaToFile } from "@/lib/server/media-download";
import { probeDramaVideo, renderDramaSubtitleVideo } from "@/lib/server/drama-subtitle-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 2400;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const rate = await checkGenerationRateLimit(user.id, request, "render");
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: "字幕导出请求过于频繁，请稍后重试" }, { status: 429, headers: rateLimitHeaders(rate) });
    const limit = (await getAuthSettings()).generationConcurrency.render;
    const response = await withGenerationConcurrencyLimit(user.id, "render", 60 * 60_000, limit, async () => {
        const parsed = await readJsonBodyResult<{ episodeId?: unknown; shotId?: unknown; videoId?: unknown }>(request);
        if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
        const episodeId = text(parsed.data.episodeId);
        const shotId = text(parsed.data.shotId);
        const videoId = text(parsed.data.videoId);
        if (!episodeId || !shotId || !videoId) return NextResponse.json({ code: 422, data: null, msg: "缺少镜头视频参数" }, { status: 422 });
        if (!(await ffmpegAvailable())) return NextResponse.json({ code: 503, data: null, msg: "当前服务器未安装 FFmpeg" }, { status: 503 });

        let workdir = "";
        try {
            const project = await getDramaProjectForUser(user.id, (await context.params).id);
            const episode = project.episodes.find((item) => item.id === episodeId);
            const shot = episode?.shots.find((item) => item.id === shotId);
            if (!episode || !shot) return NextResponse.json({ code: 404, data: null, msg: "镜头不存在" }, { status: 404 });
            if (!dramaShotHasSubtitleText(shot)) return NextResponse.json({ code: 422, data: null, msg: "本镜头没有可烧录的台词或旁白" }, { status: 422 });
            if (!(await ffmpegSubtitleAvailable())) return NextResponse.json({ code: 503, data: null, msg: "当前服务器 FFmpeg 未启用 libass，无法烧录字幕" }, { status: 503 });

            const payload = await collectDramaVideoExportPayload(user.id, project);
            const entry = resolveDramaVideoExportEntries(payload, [{ episodeId, shotId, videoId }])[0];
            if (!entry) return NextResponse.json({ code: 422, data: null, msg: "所选视频已不存在，请刷新后重试" }, { status: 422 });

            workdir = await mkdtemp(join(tmpdir(), "vozeb-drama-subtitle-"));
            const sourcePath = join(workdir, "source.mp4");
            const outputPath = join(workdir, "output.mp4");
            const origin = resolveInternalOrigin(new URL(request.url).origin);
            await downloadMediaToFile(entry.url, sourcePath, {
                origin,
                cookie: request.headers.get("cookie") || "",
                maxBytes: 500 * 1024 * 1024,
                timeoutMs: 5 * 60_000,
            });
            const probe = await probeDramaVideo(sourcePath, { cwd: workdir });
            const cues = planDramaShotSubtitles(shot, probe.durationMs, probe.width, probe.height);
            if (!cues.length) return NextResponse.json({ code: 422, data: null, msg: "本镜头没有可烧录的台词或旁白" }, { status: 422 });
            await renderDramaSubtitleVideo({
                workdir,
                sourcePath,
                outputPath,
                cues,
                width: probe.width,
                height: probe.height,
                audioCodec: probe.audioCodec,
            });
            const output = await stat(outputPath);
            if (!output.isFile() || output.size <= 0) throw new Error("字幕视频生成失败");
            const fileName = `${safeName(project.title) || "短剧项目"}_${safeName(shot.code || `镜头${shot.order}`) || "镜头"}_字幕版.mp4`;
            const headers = {
                "Content-Type": "video/mp4",
                "Content-Length": String(output.size),
                "Content-Disposition": `attachment; filename="subtitle-video.mp4"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
                "Cache-Control": "no-store",
                "X-Drama-Subtitle-Cues": String(cues.length),
            };
            return new Response(streamFile(outputPath, workdir), { headers });
        } catch (error) {
            if (workdir) await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
            if (error instanceof DramaProjectServiceError || error instanceof DramaVideoExportError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
            console.error("drama subtitle video failed", error);
            return NextResponse.json({ code: 500, data: null, msg: error instanceof Error ? error.message : "字幕视频生成失败" }, { status: 500 });
        }
    });
    return response || NextResponse.json({ code: 429, data: null, msg: `当前最多同时运行 ${limit} 个字幕导出任务` }, { status: 429 });
}

function streamFile(path: string, workdir: string) {
    const reader = createReadStream(path);
    const iterator = reader[Symbol.asyncIterator]();
    let cleaned = false;
    const cleanup = async () => {
        if (cleaned) return;
        cleaned = true;
        reader.destroy();
        await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
    };
    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            try {
                const next = await iterator.next();
                if (next.done) {
                    await cleanup();
                    controller.close();
                    return;
                }
                controller.enqueue(new Uint8Array(next.value));
            } catch (error) {
                await cleanup();
                controller.error(error);
            }
        },
        async cancel() {
            try {
                await iterator.return?.();
            } finally {
                await cleanup();
            }
        },
    });
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function safeName(value: string) {
    return value
        .trim()
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\.\.+/g, "_")
        .replace(/[. ]+$/g, "");
}
