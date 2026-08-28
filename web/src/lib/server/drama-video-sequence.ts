import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dramaOutputDimensions } from "@/lib/drama-image-size";
import { ffmpegAvailable, runFfmpeg, runFfprobe } from "@/lib/server/ffmpeg";
import { fetchInternalApi } from "@/lib/server/internal-origin";
import { writeReferenceMediaFile } from "@/lib/server/reference-asset-store";
import { fetchSafeOutbound } from "@/lib/server/safe-outbound-fetch";

export async function composeDramaVideoSegments(input: { clips: Array<{ url: string; duration: number }>; ratio: string; origin: string; cookie: string; ownerUserId: string; projectId: string; runId: string; shotId: string; title: string }) {
    if (!input.clips.length) throw new Error("没有可拼接的视频子段");
    if (!(await ffmpegAvailable())) throw new Error("当前服务器未安装 FFmpeg，无法拼接视频子段");
    const workdir = await mkdtemp(join(tmpdir(), "vozeb-pro-drama-shot-"));
    try {
        const size = dramaOutputDimensions(input.ratio);
        const normalized: string[] = [];
        for (const [index, clip] of input.clips.entries()) {
            const source = join(workdir, `source-${index}.mp4`);
            await downloadMedia(clip.url, source, input.origin, input.cookie);
            const output = join(workdir, `clip-${index}.mp4`);
            const hasAudio = await containsAudio(source, workdir);
            const filter = `[0:v]scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=${clip.duration},trim=0:${clip.duration}[v]`;
            const args = ["-y", "-i", source];
            if (hasAudio) args.push("-filter_complex", `${filter};[0:a]aresample=async=1:first_pts=0,apad,atrim=0:${clip.duration}[a]`, "-map", "[v]", "-map", "[a]");
            else args.push("-f", "lavfi", "-t", String(clip.duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-filter_complex", filter, "-map", "[v]", "-map", "1:a");
            args.push("-t", String(clip.duration), "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", output);
            await runFfmpeg(args, { cwd: workdir });
            normalized.push(output);
        }
        await writeFile(join(workdir, "concat.txt"), normalized.map((_, index) => `file 'clip-${index}.mp4'`).join("\n"), "utf8");
        const joined = join(workdir, "joined.mp4");
        await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "-movflags", "+faststart", joined], { cwd: workdir });
        const asset = await writeReferenceMediaFile(joined, "video", "video/mp4", true, {
            ownerUserId: input.ownerUserId,
            source: "drama-shot-sequence",
            projectId: input.projectId,
            runId: input.runId,
            taskId: input.shotId,
            originalName: `${input.title}.mp4`,
        });
        return asset.url || `/api/reference-assets/${asset.token}`;
    } finally {
        await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
    }
}

async function containsAudio(path: string, cwd: string) {
    const result = await runFfprobe(["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "default=noprint_wrappers=1:nokey=1", path], { cwd, timeoutMs: 30_000 });
    return result.stdout.trim() === "audio";
}

async function downloadMedia(url: string, path: string, origin: string, cookie: string) {
    const target = url.startsWith("/") ? `${origin}${url}` : url;
    const response = url.startsWith("/") ? await fetchInternalApi(target, { headers: cookie ? { cookie } : undefined }) : await fetchExternalMedia(target);
    if (!response.ok || !response.body) throw new Error(`视频子段下载失败（${response.status}）`);
    const file = await open(path, "w");
    let bytes = 0;
    try {
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 200 * 1024 * 1024) {
                await reader.cancel();
                throw new Error("视频子段文件超过大小限制");
            }
            await file.write(value);
        }
    } finally {
        await file.close();
    }
    if (!bytes) throw new Error("视频子段文件为空");
}

async function fetchExternalMedia(initialUrl: string) {
    let target = initialUrl;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
        const response = await fetchSafeOutbound(target, { redirect: "manual" });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        const location = response.headers.get("location");
        if (!location) throw new Error("视频子段重定向地址无效");
        target = new URL(location, target).toString();
    }
    throw new Error("视频子段重定向次数过多");
}
