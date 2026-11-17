import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { buildDramaAss, type DramaSubtitleCue } from "@/lib/drama-subtitle-plan";

import { runFfmpeg, runFfprobe } from "./ffmpeg";

export type DramaVideoProbe = {
    width: number;
    height: number;
    durationMs: number;
    audioCodec?: string;
};

export async function probeDramaVideo(path: string, options?: { cwd?: string; signal?: AbortSignal }): Promise<DramaVideoProbe> {
    const probe = await runFfprobe(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,duration:format=duration", "-of", "json", path], {
        ...options,
        timeoutMs: 120_000,
    });
    const payload = JSON.parse(probe.stdout || "{}") as {
        streams?: Array<{ width?: number; height?: number; duration?: string }>;
        format?: { duration?: string };
    };
    const stream = payload.streams?.[0];
    const width = Math.round(Number(stream?.width));
    const height = Math.round(Number(stream?.height));
    const seconds = Number(stream?.duration) || Number(payload.format?.duration);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || !Number.isFinite(seconds) || seconds <= 0) throw new Error("视频尺寸或时长无效");
    const audio = await runFfprobe(["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name", "-of", "default=noprint_wrappers=1:nokey=1", path], {
        ...options,
        timeoutMs: 60_000,
    });
    return {
        width,
        height,
        durationMs: Math.round(seconds * 1_000),
        audioCodec: audio.stdout.trim() || undefined,
    };
}

export async function renderDramaSubtitleVideo(input: { workdir: string; sourcePath: string; outputPath: string; cues: DramaSubtitleCue[]; width: number; height: number; audioCodec?: string; signal?: AbortSignal }) {
    const assPath = join(input.workdir, "subtitles.ass");
    await writeFile(assPath, buildDramaAss(input.cues, input.width, input.height), "utf8");
    const audioArgs = input.audioCodec ? (["aac", "mp3"].includes(input.audioCodec) ? ["-map", "0:a:0", "-c:a", "copy"] : ["-map", "0:a:0", "-c:a", "aac", "-b:a", "160k"]) : ["-an"];
    await runFfmpeg(["-y", "-i", input.sourcePath, "-map", "0:v:0", ...audioArgs, "-vf", `ass=${assPath}`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-sn", "-movflags", "+faststart", input.outputPath], {
        cwd: input.workdir,
        signal: input.signal,
        timeoutMs: 30 * 60_000,
    });
}
