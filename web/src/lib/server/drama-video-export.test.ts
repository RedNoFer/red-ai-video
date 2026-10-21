import { writeFile } from "node:fs/promises";

import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

import type { DramaEpisode, DramaProject, DramaShot } from "@/lib/drama-project-contract";

const mocks = vi.hoisted(() => ({ queryStoredGenerationTasks: vi.fn() }));

vi.mock("@/lib/server/generation-task-store", () => ({ queryStoredGenerationTasks: mocks.queryStoredGenerationTasks }));
vi.mock("@/lib/server/media-download", () => ({
    downloadMediaToFile: vi.fn(async (_url: string, path: string) => {
        await writeFile(path, new Uint8Array([1, 2, 3, 4]));
        return { bytes: 4, mimeType: "video/mp4" };
    }),
}));

import { collectDramaVideoExportPayload, DramaVideoExportError, exportDramaVideos, resolveDramaVideoExportEntries } from "./drama-video-export";

describe("Drama video export", () => {
    it("lists the current video and the regenerated candidates of every shot", async () => {
        const payload = await collectDramaVideoExportPayload("user-one", project());

        expect(payload.episodes).toHaveLength(2);
        expect(payload.episodes[0].shots[0].videos.map((video) => ({ id: video.id, isCurrent: video.isCurrent }))).toEqual([
            { id: "current-task", isCurrent: true },
            { id: "candidate-task", isCurrent: false },
        ]);
        expect(payload.episodes[1].shots[0].videos).toHaveLength(1);
    });

    it("packs the selected videos into a zip grouped by episode", async () => {
        const current = project();
        const payload = await collectDramaVideoExportPayload("user-one", current);
        const entries = resolveDramaVideoExportEntries(
            payload,
            payload.episodes.flatMap((episode) => episode.shots.flatMap((shot) => shot.videos.map((video) => ({ episodeId: episode.episodeId, shotId: shot.shotId, videoId: video.id })))),
        );
        const result = await exportDramaVideos({ project: current, entries, origin: "http://127.0.0.1:3000" });
        const files = unzipSync(new Uint8Array(await new Response(result.stream).arrayBuffer()));
        const names = Object.keys(files);

        expect(names).toEqual(expect.arrayContaining([expect.stringMatching(/^01_第 1 集\/SH01_开场\.mp4$/), expect.stringMatching(/^01_第 1 集\/SH01_开场_2\.mp4$/), expect.stringMatching(/^02_第 2 集\/SH02_收尾\.mp4$/), "manifest.json"]));
        expect(result.exported).toBe(3);
        expect(result.failed).toBe(0);
        const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"])) as { exported: unknown[]; failed: unknown[] };
        expect(manifest.exported).toHaveLength(3);
        expect(manifest.failed).toHaveLength(0);
    });

    it("ignores selections that do not belong to the project", async () => {
        const payload = await collectDramaVideoExportPayload("user-one", project());

        expect(resolveDramaVideoExportEntries(payload, [{ episodeId: "episode-one", shotId: "shot-one", videoId: "unknown" }])).toHaveLength(0);
        expect(resolveDramaVideoExportEntries(payload, [{ episodeId: "other", shotId: "other", videoId: "current-task" }])).toHaveLength(0);
        expect(resolveDramaVideoExportEntries(payload, [{ episodeId: "episode-one", shotId: "shot-one", videoId: "current-task" }])).toHaveLength(1);
    });

    it("rejects an empty selection", async () => {
        await expect(exportDramaVideos({ project: project(), entries: [], origin: "http://127.0.0.1:3000" })).rejects.toEqual(expect.objectContaining<Partial<DramaVideoExportError>>({ status: 422 }));
    });
});

function project(): DramaProject {
    const now = new Date().toISOString();
    const first = episode("episode-one", "第 1 集", [{ ...shot("shot-one", "SH01", "开场"), videoUrl: "/api/media/current.mp4" }]);
    const second = episode("episode-two", "第 2 集", [{ ...shot("shot-two", "SH02", "收尾"), videoUrl: "/api/media/second.mp4" }]);
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
