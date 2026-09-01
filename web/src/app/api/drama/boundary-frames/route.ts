import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { ffmpegAvailable, runFfmpeg } from "@/lib/server/ffmpeg";
import { fetchInternalApi, resolveInternalOrigin } from "@/lib/server/internal-origin";
import { getDramaProjectForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { writeReferenceMediaFile } from "@/lib/server/reference-asset-store";
import { fetchSafeOutbound } from "@/lib/server/safe-outbound-fetch";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, 256 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    const input = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) ? (parsed.data as Record<string, unknown>) : {};
    try {
        const projectId = text(input.projectId);
        const episodeId = text(input.episodeId);
        const shotId = text(input.shotId);
        const videoUrl = text(input.videoUrl);
        const project = await getDramaProjectForUser(user.id, projectId);
        const shot = project.episodes.find((episode) => episode.id === episodeId)?.shots.find((item) => item.id === shotId);
        if (!shot || !videoUrl || shot.videoUrl !== videoUrl) return NextResponse.json({ code: 409, data: null, msg: "镜头视频与当前项目不匹配" }, { status: 409 });
        if (!(await ffmpegAvailable())) return NextResponse.json({ code: 503, data: null, msg: "当前服务器未安装 FFmpeg" }, { status: 503 });
        const directory = await mkdtemp(join(tmpdir(), "vozeb-pro-drama-boundary-"));
        try {
            const videoPath = join(directory, "source.mp4");
            const startPath = join(directory, "start.png");
            const endPath = join(directory, "end.png");
            await downloadMedia(videoUrl, videoPath, resolveInternalOrigin(new URL(request.url).origin), request.headers.get("cookie") || "");
            await runFfmpeg(["-y", "-i", videoPath, "-frames:v", "1", startPath], { cwd: directory });
            await runFfmpeg(["-y", "-sseof", "-0.1", "-i", videoPath, "-frames:v", "1", endPath], { cwd: directory });
            const metadata = { ownerUserId: user.id, source: "drama-boundary-frame", projectId, taskId: shot.generationTaskId, originalName: `${shot.code || shot.id}-boundary.png` };
            const [start, end] = await Promise.all([writeReferenceMediaFile(startPath, "image", "image/png", true, metadata), writeReferenceMediaFile(endPath, "image", "image/png", true, metadata)]);
            return NextResponse.json({
                code: 0,
                data: {
                    startFrameUrl: start.url || `/api/reference-assets/${start.token}`,
                    endFrameUrl: end.url || `/api/reference-assets/${end.token}`,
                    sourceVideoUrl: videoUrl,
                },
                msg: "镜头实际首尾帧已提取",
            });
        } finally {
            await rm(directory, { recursive: true, force: true }).catch(() => undefined);
        }
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        return NextResponse.json({ code: 502, data: null, msg: error instanceof Error ? error.message : "镜头首尾帧提取失败" }, { status: 502 });
    }
}

async function downloadMedia(url: string, path: string, origin: string, cookie: string) {
    const response = url.startsWith("/")
        ? await fetchInternalApi(`${origin}${url}`, { headers: cookie ? { cookie } : undefined, signal: AbortSignal.timeout(3 * 60_000) })
        : await fetchSafeOutbound(url, { signal: AbortSignal.timeout(3 * 60_000), redirect: "follow" });
    if (!response.ok) throw new Error(`镜头视频下载失败（${response.status}）`);
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > 300 * 1024 * 1024) throw new Error("镜头视频超过媒体处理上限");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 300 * 1024 * 1024) throw new Error("镜头视频超过媒体处理上限");
    await writeFile(path, bytes);
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}
