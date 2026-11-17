import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runFfmpeg: vi.fn(), runFfprobe: vi.fn() }));

vi.mock("./ffmpeg", () => ({ runFfmpeg: mocks.runFfmpeg, runFfprobe: mocks.runFfprobe }));

import { probeDramaVideo, renderDramaSubtitleVideo } from "./drama-subtitle-render";

const workdirs: string[] = [];

afterEach(async () => {
    await Promise.all(workdirs.splice(0).map((workdir) => rm(workdir, { recursive: true, force: true })));
    vi.clearAllMocks();
});

describe("Drama subtitle rendering", () => {
    it("reads display dimensions, duration and audio codec from FFprobe", async () => {
        mocks.runFfprobe.mockResolvedValueOnce({ stdout: JSON.stringify({ streams: [{ width: 720, height: 1280, duration: "4.5" }], format: { duration: "4.6" } }), stderr: "" }).mockResolvedValueOnce({ stdout: "aac\n", stderr: "" });

        await expect(probeDramaVideo("/tmp/source.mp4")).resolves.toEqual({ width: 720, height: 1280, durationMs: 4_500, audioCodec: "aac" });
    });

    it("writes an ASS file and burns subtitles with near-lossless video settings while copying AAC audio", async () => {
        const workdir = await mkdtemp(join(tmpdir(), "vozeb-subtitle-render-test-"));
        workdirs.push(workdir);

        await renderDramaSubtitleVideo({
            workdir,
            sourcePath: join(workdir, "source.mp4"),
            outputPath: join(workdir, "output.mp4"),
            cues: [{ startMs: 0, endMs: 2_000, text: "测试字幕" }],
            width: 1080,
            height: 1920,
            audioCodec: "aac",
        });

        const ass = await readFile(join(workdir, "subtitles.ass"), "utf8");
        expect(ass).toContain("PlayResX: 1080");
        expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:02.00");
        expect(mocks.runFfmpeg).toHaveBeenCalledWith(
            expect.arrayContaining([
                "-map",
                "0:v:0",
                "-map",
                "0:a:0",
                "-c:a",
                "copy",
                "-vf",
                expect.stringContaining("ass="),
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-crf",
                "12",
                "-tune",
                "film",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                join(workdir, "output.mp4"),
            ]),
            expect.objectContaining({ cwd: workdir }),
        );
    });

    it("transcodes unsupported audio and omits audio when the source has none", async () => {
        const workdir = await mkdtemp(join(tmpdir(), "vozeb-subtitle-render-test-"));
        workdirs.push(workdir);
        const base = { workdir, sourcePath: join(workdir, "source.mp4"), outputPath: join(workdir, "output.mp4"), cues: [{ startMs: 0, endMs: 1_000, text: "字幕" }], width: 1280, height: 720 };

        await renderDramaSubtitleVideo({ ...base, audioCodec: "opus" });
        expect(mocks.runFfmpeg).toHaveBeenCalledWith(expect.arrayContaining(["-c:a", "aac", "-b:a", "160k"]), expect.anything());

        await renderDramaSubtitleVideo(base);
        expect(mocks.runFfmpeg).toHaveBeenLastCalledWith(expect.arrayContaining(["-an"]), expect.anything());
    });
});
