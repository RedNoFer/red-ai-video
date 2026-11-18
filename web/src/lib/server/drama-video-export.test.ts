import { writeFile } from "node:fs/promises";

import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DramaEpisode, DramaProject, DramaShot } from "@/lib/drama-project-contract";

const mocks = vi.hoisted(() => ({ queryStoredGenerationTasks: vi.fn(), probeDramaVideo: vi.fn(), renderDramaSubtitleVideo: vi.fn(), resolveSubtitleSources: vi.fn() }));

vi.mock("@/lib/server/generation-task-store", () => ({ queryStoredGenerationTasks: mocks.queryStoredGenerationTasks }));
vi.mock("@/lib/server/drama-subtitle-asr", () => ({ resolveDramaSubtitleSources: mocks.resolveSubtitleSources }));
vi.mock("@/lib/server/media-download", () => ({
    downloadMediaToFile: vi.fn(async (_url: string, path: string) => {
        await writeFile(path, new Uint8Array([1, 2, 3, 4]));
        return { bytes: 4, mimeType: "video/mp4" };
    }),
}));
vi.mock("@/lib/server/drama-subtitle-render", () => ({ probeDramaVideo: mocks.probeDramaVideo, renderDramaSubtitleVideo: mocks.renderDramaSubtitleVideo }));

import { collectDramaVideoExportPayload, DramaVideoExportError, exportDramaVideos, resolveDramaVideoExportEntries, type DramaVideoExportProgress } from "./drama-video-export";

beforeEach(() => {
    mocks.resolveSubtitleSources.mockReset();
    mocks.resolveSubtitleSources.mockResolvedValue([
        { text: "第一句台词。", hasEnglish: true, startMs: 200, endMs: 2_400 },
        { text: "第二句台词。", hasEnglish: true, startMs: 2_600, endMs: 4_800 },
    ]);
});

describe("Drama video export", () => {
    it("lists the current video and the regenerated candidates of every shot", async () => {
        const payload = await collectDramaVideoExportPayload("user-one", project());

        expect(payload.episodes).toHaveLength(2);
        expect(payload.episodes[0].shots[0].videos.map((video) => ({ id: video.id, isCurrent: video.isCurrent }))).toEqual([
            { id: "current-task", isCurrent: true },
            { id: "candidate-task", isCurrent: false },
        ]);
        expect(payload.episodes[1].shots).toHaveLength(0);
    });

    it("does not offer shots that have no current video", async () => {
        const payload = await collectDramaVideoExportPayload("user-one", project());

        expect(payload.episodes[0].shots.map((item) => item.shotId)).toEqual(["shot-one"]);
        expect(payload.episodes[1].shots).toHaveLength(0);
    });

    it("reports download, subtitle and packaging progress", async () => {
        const current = project();
        current.episodes[0].shots[0].dialogue = "第一句台词。第二句台词。";
        const payload = await collectDramaVideoExportPayload("user-one", current);
        const entries = resolveDramaVideoExportEntries(
            payload,
            payload.episodes.flatMap((episode) => episode.shots.flatMap((shot) => shot.videos.map((video) => ({ episodeId: episode.episodeId, shotId: shot.shotId, videoId: video.id })))),
        );
        mocks.probeDramaVideo.mockResolvedValue({ width: 1080, height: 1920, durationMs: 5_000, audioCodec: "aac" });
        mocks.renderDramaSubtitleVideo.mockImplementation(async ({ outputPath }: { outputPath: string }) => {
            await writeFile(outputPath, new Uint8Array([9, 9, 9]));
        });
        const events: DramaVideoExportProgress[] = [];
        const result = await exportDramaVideos({ project: current, entries, origin: "http://127.0.0.1:3000", userId: "user-one", includeSubtitles: true, onProgress: (progress) => events.push(progress) });
        await new Response(result.stream).arrayBuffer();

        expect(events.some((event) => event.phase === "downloading" && event.done === entries.length && event.bytes > 0)).toBe(true);
        expect(events.some((event) => event.phase === "subtitles" && event.subtitlesTotal === entries.length)).toBe(true);
        expect(events.some((event) => event.phase === "packaging")).toBe(true);
    });

    it("packs the selected videos into a zip grouped by episode", async () => {
        const current = project();
        const payload = await collectDramaVideoExportPayload("user-one", current);
        const entries = resolveDramaVideoExportEntries(
            payload,
            payload.episodes.flatMap((episode) => episode.shots.flatMap((shot) => shot.videos.map((video) => ({ episodeId: episode.episodeId, shotId: shot.shotId, videoId: video.id })))),
        );
        const result = await exportDramaVideos({ project: current, entries, origin: "http://127.0.0.1:3000", userId: "user-one" });
        const files = unzipSync(new Uint8Array(await new Response(result.stream).arrayBuffer()));
        const names = Object.keys(files);

        expect(names).toEqual(expect.arrayContaining([expect.stringMatching(/^01_第 1 集\/SH01_开场\.mp4$/), expect.stringMatching(/^01_第 1 集\/SH01_开场_2\.mp4$/), "manifest.json"]));
        expect(result.exported).toBe(2);
        expect(result.failed).toBe(0);
        const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"])) as { exported: unknown[]; failed: unknown[] };
        expect(manifest.exported).toHaveLength(2);
        expect(manifest.failed).toHaveLength(0);
    });

    it("adds burned subtitle videos and SRT files when subtitles are requested", async () => {
        const current = project();
        current.episodes[0].shots[0].dialogue = "第一句台词。第二句台词。";
        const payload = await collectDramaVideoExportPayload("user-one", current);
        const entries = resolveDramaVideoExportEntries(
            payload,
            payload.episodes.flatMap((episode) => episode.shots.flatMap((shot) => shot.videos.map((video) => ({ episodeId: episode.episodeId, shotId: shot.shotId, videoId: video.id })))),
        );
        mocks.probeDramaVideo.mockResolvedValue({ width: 1080, height: 1920, durationMs: 5_000, audioCodec: "aac" });
        mocks.renderDramaSubtitleVideo.mockImplementation(async ({ outputPath }: { outputPath: string }) => {
            await writeFile(outputPath, new Uint8Array([9, 9, 9]));
        });

        const result = await exportDramaVideos({ project: current, entries, origin: "http://127.0.0.1:3000", userId: "user-one", includeSubtitles: true });
        const files = unzipSync(new Uint8Array(await new Response(result.stream).arrayBuffer()));
        const names = Object.keys(files);

        expect(names).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/^01_第 1 集\/SH01_开场\.mp4$/),
                expect.stringMatching(/^01_第 1 集\/字幕版\/SH01_开场_字幕\.mp4$/),
                expect.stringMatching(/^01_第 1 集\/字幕版\/SH01_开场\.srt$/),
                expect.stringMatching(/^01_第 1 集\/字幕版\/SH01_开场_2_字幕\.mp4$/),
                expect.stringMatching(/^01_第 1 集\/字幕版\/SH01_开场_2\.srt$/),
                "manifest.json",
            ]),
        );
        const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"])) as { subtitles: { generated: unknown[]; failed: unknown[]; skipped: unknown[] } };
        expect(manifest.subtitles.generated).toHaveLength(2);
        expect(manifest.subtitles.failed).toHaveLength(0);
        expect(manifest.subtitles.skipped).toHaveLength(0);
        expect(new TextDecoder().decode(files["01_第 1 集/字幕版/SH01_开场.srt"])).toContain("第一句台词");
    });

    it("writes a separate English-only burned video and SRT when both subtitle versions are requested", async () => {
        const current = project();
        current.episodes[0].script = ["【SH01｜0–30秒｜开场】", "", '"By morning, everything would be cheaper."', "中译：到了明早，一切都将便宜一千万倍。"].join("\n");
        const payload = await collectDramaVideoExportPayload("user-one", current);
        const entries = resolveDramaVideoExportEntries(
            payload,
            payload.episodes.flatMap((episode) => episode.shots.flatMap((shot) => shot.videos.map((video) => ({ episodeId: episode.episodeId, shotId: shot.shotId, videoId: video.id })))),
        );
        expect(payload.episodes[0].shots[0]).toMatchObject({ hasSubtitles: true, hasEnglishSubtitles: true });
        mocks.resolveSubtitleSources.mockResolvedValue([{ text: "By morning, everything would be cheaper.", translation: "到了明早，一切都将便宜一千万倍。", hasEnglish: true, startMs: 200, endMs: 4_800 }]);
        mocks.probeDramaVideo.mockResolvedValue({ width: 1080, height: 1920, durationMs: 5_000, audioCodec: "aac" });
        mocks.renderDramaSubtitleVideo.mockImplementation(async ({ outputPath }: { outputPath: string }) => {
            await writeFile(outputPath, new Uint8Array([9, 9, 9]));
        });

        const result = await exportDramaVideos({ project: current, entries, origin: "http://127.0.0.1:3000", userId: "user-one", subtitleModes: ["bilingual", "english"] });
        const files = unzipSync(new Uint8Array(await new Response(result.stream).arrayBuffer()));
        const names = Object.keys(files);

        expect(names).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/^01_第 1 集\/字幕版\/SH01_开场_字幕\.mp4$/),
                expect.stringMatching(/^01_第 1 集\/字幕版\/SH01_开场\.srt$/),
                expect.stringMatching(/^01_第 1 集\/字幕版\/英文\/SH01_开场_英文字幕\.mp4$/),
                expect.stringMatching(/^01_第 1 集\/字幕版\/英文\/SH01_开场\.en\.srt$/),
            ]),
        );
        const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"])) as { subtitles: { modes: string[]; generated: Array<{ mode: string }> } };
        expect(manifest.subtitles.modes).toEqual(["bilingual", "english"]);
        expect(manifest.subtitles.generated.map((item) => item.mode)).toEqual(["bilingual", "english", "bilingual", "english"]);
        expect(new TextDecoder().decode(files["01_第 1 集/字幕版/SH01_开场.srt"])).toContain("By morning, everything would be cheaper.\n到了明早，一切都将便宜一千万倍。");
        expect(new TextDecoder().decode(files["01_第 1 集/字幕版/英文/SH01_开场.en.srt"])).not.toContain("到了明早");
    });

    it("packs only burned subtitle videos and SRT files when originals are excluded", async () => {
        const current = project();
        current.episodes[0].shots[0].dialogue = "第一句台词。第二句台词。";
        const payload = await collectDramaVideoExportPayload("user-one", current);
        const entries = resolveDramaVideoExportEntries(
            payload,
            payload.episodes.flatMap((episode) => episode.shots.flatMap((shot) => shot.videos.map((video) => ({ episodeId: episode.episodeId, shotId: shot.shotId, videoId: video.id })))),
        );
        mocks.probeDramaVideo.mockResolvedValue({ width: 1080, height: 1920, durationMs: 5_000, audioCodec: "aac" });
        mocks.renderDramaSubtitleVideo.mockImplementation(async ({ outputPath }: { outputPath: string }) => {
            await writeFile(outputPath, new Uint8Array([9, 9, 9]));
        });

        const result = await exportDramaVideos({ project: current, entries, origin: "http://127.0.0.1:3000", userId: "user-one", subtitleModes: ["bilingual"], includeOriginals: false });
        const files = unzipSync(new Uint8Array(await new Response(result.stream).arrayBuffer()));
        const names = Object.keys(files);

        expect(result.fileName).toBe("测试短剧_字幕版.zip");
        expect(result.exported).toBe(0);
        expect(names.every((name) => name === "manifest.json" || name.includes("字幕版"))).toBe(true);
        expect(names).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/^01_第 1 集\/字幕版\/SH01_开场_字幕\.mp4$/),
                expect.stringMatching(/^01_第 1 集\/字幕版\/SH01_开场\.srt$/),
                expect.stringMatching(/^01_第 1 集\/字幕版\/SH01_开场_2_字幕\.mp4$/),
                expect.stringMatching(/^01_第 1 集\/字幕版\/SH01_开场_2\.srt$/),
                "manifest.json",
            ]),
        );
        const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"])) as { originalsIncluded: boolean; exported: unknown[]; subtitles: { generated: unknown[] } };
        expect(manifest.originalsIncluded).toBe(false);
        expect(manifest.exported).toHaveLength(0);
        expect(manifest.subtitles.generated).toHaveLength(2);
    });

    it("rejects subtitle-only exports without modes or selected subtitle text", async () => {
        const current = project();
        const payload = await collectDramaVideoExportPayload("user-one", current);
        const entries = resolveDramaVideoExportEntries(
            payload,
            payload.episodes.flatMap((episode) => episode.shots.flatMap((shot) => shot.videos.map((video) => ({ episodeId: episode.episodeId, shotId: shot.shotId, videoId: video.id })))),
        );

        await expect(exportDramaVideos({ project: current, entries, origin: "http://127.0.0.1:3000", userId: "user-one", includeOriginals: false })).rejects.toEqual(
            expect.objectContaining<Partial<DramaVideoExportError>>({ status: 422, message: "仅字幕版需要至少选择一种字幕版本" }),
        );
        await expect(exportDramaVideos({ project: current, entries, origin: "http://127.0.0.1:3000", userId: "user-one", includeOriginals: false, subtitleModes: ["bilingual"] })).rejects.toEqual(
            expect.objectContaining<Partial<DramaVideoExportError>>({ status: 422, message: "所选镜头没有可导出的字幕内容" }),
        );
    });

    it("records skipped subtitles without running media probes when the shot has no text", async () => {
        const current = project();
        mocks.probeDramaVideo.mockClear();
        mocks.renderDramaSubtitleVideo.mockClear();
        const payload = await collectDramaVideoExportPayload("user-one", current);
        const entries = resolveDramaVideoExportEntries(
            payload,
            payload.episodes.flatMap((episode) => episode.shots.flatMap((shot) => shot.videos.map((video) => ({ episodeId: episode.episodeId, shotId: shot.shotId, videoId: video.id })))),
        );

        const result = await exportDramaVideos({ project: current, entries, origin: "http://127.0.0.1:3000", userId: "user-one", includeSubtitles: true });
        const files = unzipSync(new Uint8Array(await new Response(result.stream).arrayBuffer()));
        const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"])) as { subtitles: { generated: unknown[]; failed: unknown[]; skipped: Array<{ reason: string }> } };

        expect(manifest.subtitles.generated).toHaveLength(0);
        expect(manifest.subtitles.failed).toHaveLength(0);
        expect(manifest.subtitles.skipped).toHaveLength(2);
        expect(manifest.subtitles.skipped[0].reason).toContain("没有可烧录");
        expect(Object.keys(files).some((name) => name.includes("字幕版"))).toBe(false);
        expect(mocks.probeDramaVideo).not.toHaveBeenCalled();
        expect(mocks.renderDramaSubtitleVideo).not.toHaveBeenCalled();
    });

    it("ignores selections that do not belong to the project", async () => {
        const payload = await collectDramaVideoExportPayload("user-one", project());

        expect(resolveDramaVideoExportEntries(payload, [{ episodeId: "episode-one", shotId: "shot-one", videoId: "unknown" }])).toHaveLength(0);
        expect(resolveDramaVideoExportEntries(payload, [{ episodeId: "other", shotId: "other", videoId: "current-task" }])).toHaveLength(0);
        expect(resolveDramaVideoExportEntries(payload, [{ episodeId: "episode-one", shotId: "shot-one", videoId: "current-task" }])).toHaveLength(1);
    });

    it("rejects an empty selection", async () => {
        await expect(exportDramaVideos({ project: project(), entries: [], origin: "http://127.0.0.1:3000", userId: "user-one" })).rejects.toEqual(expect.objectContaining<Partial<DramaVideoExportError>>({ status: 422 }));
    });
});

function project(): DramaProject {
    const now = new Date().toISOString();
    const first = episode("episode-one", "第 1 集", [{ ...shot("shot-one", "SH01", "开场"), videoUrl: "/api/media/current.mp4" }]);
    const second = episode("episode-two", "第 2 集", [{ ...shot("shot-two", "SH02", "收尾") }]);
    return {
        id: "project-one",
        title: "测试短剧",
        summary: "",
        style: "电影感",
        ratio: "9:16",
        status: "active",
        activeEpisodeId: first.id,
        characters: [],
        scenes: [],
        props: [],
        clues: [],
        defaultVideoMode: "storyboard",
        episodes: [first, second],
        createdAt: now,
        updatedAt: now,
    };
}

function episode(id: string, title: string, shots: DramaShot[]): DramaEpisode {
    return { id, title, script: "", outline: "", hook: "", nextPreview: "", sourceRange: "", reviewStatus: "visual_ready", shots };
}

function shot(id: string, code: string, title: string): DramaShot {
    return {
        id,
        code,
        order: 1,
        title,
        description: "",
        sourceText: "",
        shotBoundary: "",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: "",
        videoPrompt: "",
        cameraMotion: "",
        duration: 5,
        characterIds: [],
        propIds: [],
        clueIds: [],
    };
}

mocks.queryStoredGenerationTasks.mockImplementation(async (_type: string, options: { projectId?: string; episodeId?: string; limit?: number }) => {
    const tasks = [
        { id: "current-task", projectId: "project-one", episodeId: "episode-one", shotId: "shot-one", result: { url: "/api/media/current.mp4" }, createdAt: Date.now() },
        { id: "candidate-task", projectId: "project-one", episodeId: "episode-one", shotId: "shot-one", result: { url: "/api/media/candidate.mp4" }, createdAt: Date.now() },
        { id: "second-task", projectId: "project-one", episodeId: "episode-two", shotId: "shot-two", result: { url: "/api/media/second.mp4" }, createdAt: Date.now() },
    ].filter((task) => task.projectId === options.projectId && task.episodeId === options.episodeId);
    return tasks.slice(0, options.limit ?? 20);
});
