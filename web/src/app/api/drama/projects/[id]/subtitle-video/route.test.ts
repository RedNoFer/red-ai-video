import { writeFile } from "node:fs/promises";

import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    project: vi.fn(),
    collect: vi.fn(),
    resolve: vi.fn(),
    download: vi.fn(),
    probe: vi.fn(),
    render: vi.fn(),
    ffmpeg: vi.fn(),
    limit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => ({ id: "user-one" }) }));
vi.mock("@/lib/auth/store", () => ({ getAuthSettings: async () => ({ generationConcurrency: { render: 2 } }) }));
vi.mock("@/lib/server/security", () => ({ checkGenerationRateLimit: async () => ({ allowed: true }), rateLimitHeaders: () => ({}) }));
vi.mock("@/lib/server/generation-task-store", () => ({ withGenerationConcurrencyLimit: mocks.limit }));
vi.mock("@/lib/server/drama-project-service", () => ({
    getDramaProjectForUser: mocks.project,
    DramaProjectServiceError: class extends Error {
        status = 403;
    },
}));
vi.mock("@/lib/server/drama-video-export", () => ({
    collectDramaVideoExportPayload: mocks.collect,
    resolveDramaVideoExportEntries: mocks.resolve,
    DramaVideoExportError: class extends Error {
        status = 422;
    },
}));
vi.mock("@/lib/server/media-download", () => ({ downloadMediaToFile: mocks.download }));
vi.mock("@/lib/server/drama-subtitle-render", () => ({ probeDramaVideo: mocks.probe, renderDramaSubtitleVideo: mocks.render }));
vi.mock("@/lib/server/ffmpeg", () => ({ ffmpegAvailable: mocks.ffmpeg, ffmpegSubtitleAvailable: mocks.ffmpeg }));
vi.mock("@/lib/server/internal-origin", () => ({ resolveInternalOrigin: () => "http://127.0.0.1:3000" }));

import { POST } from "./route";

beforeEach(() => {
    vi.clearAllMocks();
    mocks.ffmpeg.mockResolvedValue(true);
    mocks.project.mockResolvedValue(projectWithSubtitle());
    mocks.collect.mockResolvedValue({
        projectId: "project-one",
        projectTitle: "测试短剧",
        episodes: [{ episodeId: "episode-one", order: 1, title: "第 1 集", shots: [{ shotId: "shot-one", code: "SH01", title: "开场", hasSubtitles: true, videos: [{ id: "task-one", url: "/api/media/video.mp4", isCurrent: true }] }] }],
    });
    mocks.resolve.mockReturnValue([{ episodeId: "episode-one", episodeTitle: "第 1 集", episodeOrder: 1, shotId: "shot-one", shotCode: "SH01", shotTitle: "开场", videoId: "task-one", url: "/api/media/video.mp4" }]);
    mocks.download.mockImplementation(async (_url: string, path: string) => {
        await writeFile(path, new Uint8Array([1, 2, 3, 4]));
        return { bytes: 4, mimeType: "video/mp4" };
    });
    mocks.probe.mockResolvedValue({ width: 1080, height: 1920, durationMs: 5_000, audioCodec: "aac" });
    mocks.render.mockImplementation(async ({ outputPath }: { outputPath: string }) => {
        await writeFile(outputPath, new Uint8Array([7, 7, 7]));
    });
    mocks.limit.mockImplementation(async (_userId, _type, _stale, _limit, handler: () => Promise<Response>) => handler());
});

it("streams a burned subtitle video for the selected shot video", async () => {
    const response = await POST(new Request("http://localhost/api/drama/projects/project-one/subtitle-video", { method: "POST", body: JSON.stringify({ episodeId: "episode-one", shotId: "shot-one", videoId: "task-one" }) }), {
        params: Promise.resolve({ id: "project-one" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-disposition")).toContain(encodeURIComponent("测试短剧_SH01_字幕版.mp4"));
    expect(mocks.render).toHaveBeenCalledWith(expect.objectContaining({ cues: expect.arrayContaining([expect.objectContaining({ text: "第一句台词。第二句台词。" })]), width: 1080, height: 1920 }));
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([7, 7, 7]));
});

it("rejects shots without subtitle text", async () => {
    mocks.project.mockResolvedValue(projectWithoutSubtitle());

    const response = await POST(new Request("http://localhost/api/drama/projects/project-one/subtitle-video", { method: "POST", body: JSON.stringify({ episodeId: "episode-one", shotId: "shot-one", videoId: "task-one" }) }), {
        params: Promise.resolve({ id: "project-one" }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(expect.objectContaining({ msg: "本镜头没有可烧录的台词或旁白" }));
    expect(mocks.render).not.toHaveBeenCalled();
});

it("requires FFmpeg with libass before burning subtitles", async () => {
    mocks.ffmpeg.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const response = await POST(new Request("http://localhost/api/drama/projects/project-one/subtitle-video", { method: "POST", body: JSON.stringify({ episodeId: "episode-one", shotId: "shot-one", videoId: "task-one" }) }), {
        params: Promise.resolve({ id: "project-one" }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expect.objectContaining({ msg: "当前服务器 FFmpeg 未启用 libass，无法烧录字幕" }));
    expect(mocks.render).not.toHaveBeenCalled();
});

function projectWithSubtitle() {
    const shot = {
        id: "shot-one",
        code: "SH01",
        order: 1,
        title: "开场",
        description: "",
        sourceText: "",
        shotBoundary: "",
        dialogue: "",
        narration: "",
        utterances: [{ id: "u1", order: 1, type: "dialogue", speaker: "林雪", text: "第一句台词。第二句台词。", startSecond: 0.2, endSecond: 4.5 }],
        imagePrompt: "",
        videoPrompt: "",
        cameraMotion: "",
        duration: 5,
        characterIds: [],
        propIds: [],
        clueIds: [],
        subtitle: "第一句台词。第二句台词。",
    };
    return { id: "project-one", title: "测试短剧", episodes: [{ id: "episode-one", title: "第 1 集", shots: [shot] }] };
}

function projectWithoutSubtitle() {
    const project = projectWithSubtitle();
    project.episodes[0].shots[0].utterances = [];
    project.episodes[0].shots[0].subtitle = "";
    project.episodes[0].shots[0].dialogue = "";
    project.episodes[0].shots[0].narration = "";
    return project;
}
