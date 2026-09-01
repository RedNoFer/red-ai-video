import { afterEach, describe, expect, it, vi } from "vitest";

import { applyDramaProductionPackage, createDramaProductionRun, generateDramaImagePrompt, generateDramaVideoPrompt, getLatestDramaProductionRun, listDramaProjectSummaries, updateDramaShotImagePrompt, updateDramaShotPrompt } from "./drama-projects";
import type { DramaProductionPackagePreview, DramaProject } from "@/lib/drama-project-contract";

describe("drama project api", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("requests a bounded summary page", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { projects: [], total: 24, page: 2, pageSize: 12 }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(listDramaProjectSummaries({ page: 2, pageSize: 12 })).resolves.toMatchObject({ total: 24, page: 2, pageSize: 12 });
        expect(fetchMock).toHaveBeenCalledWith("/api/drama/projects?page=2&pageSize=12", { cache: "no-store" });
    });

    it("applies a production package without a stale project version token", async () => {
        const project = { id: "project-one", updatedAt: "2026-08-28T10:00:00.000Z" } as DramaProject;
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { project }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);

        await applyDramaProductionPackage(project, { sourceHash: "hash-one" } as DramaProductionPackagePreview, "package-source", "package.md");
        const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        expect(body).toMatchObject({ action: "apply", sourceHash: "hash-one" });
        expect(body).not.toHaveProperty("expectedUpdatedAt");
    });

    it("requests visual and full production runs through separate scopes", async () => {
        const fetchMock = vi.fn().mockImplementation(async () => Response.json({ code: 0, data: { run: null, preflight: { status: "passed", issues: [] } }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);

        await getLatestDramaProductionRun("project-one", "episode-one", "visual");
        await getLatestDramaProductionRun("project-one", "episode-one", "production");

        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/drama/projects/project-one/production-runs?episodeId=episode-one&scope=visual", "/api/drama/projects/project-one/production-runs?episodeId=episode-one&scope=production"]);
    });

    it("sends the selected frame ids and explicit full-regeneration intent", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { run: { id: "run-one" } }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);

        await createDramaProductionRun("project-one", "episode-one", "visual", undefined, { shotIds: ["shot-one"], frameType: "all_frames", frameIds: ["f2"], regenerateAll: true });

        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ episodeId: "episode-one", scope: "visual", shotIds: ["shot-one"], frameType: "all_frames", frameIds: ["f2"], regenerateAll: true });
    });

    it("uses a fresh request identity for each video prompt generation", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { shots: [{ shotId: "shot-one", videoPrompt: "动作" }] }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("prompt-request-one") });

        await generateDramaVideoPrompt({
            project: { id: "project-one", summary: "", style: "", characters: [], scenes: [], props: [], clues: [] } as never,
            episode: { id: "episode-one" } as never,
            shot: { id: "shot-one" } as never,
            referenceMaterials: [],
        });

        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ phase: "video_prompt", requestId: "prompt-request-one" });
    });

    it("sends bounded shot context for image prompt generation", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { shots: [{ shotId: "shot-one", imagePrompt: "优化后的静态画面" }] }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("image-prompt-request-one") });

        await generateDramaImagePrompt({
            project: { id: "project-one", summary: "摘要", style: "电影感", characters: [{ id: "character-one" }, { id: "other" }], scenes: [{ id: "scene-one" }, { id: "other-scene" }], props: [{ id: "prop-one" }], clues: [] } as never,
            episode: { id: "episode-one", title: "第一集", script: "不得发送" } as never,
            shot: { id: "shot-one", sceneId: "scene-one", characterIds: ["character-one"], propIds: ["prop-one"], clueIds: [] } as never,
        });

        const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        expect(body).toMatchObject({ phase: "image_prompt", requestId: "image-prompt-request-one", characters: [{ id: "character-one" }], scenes: [{ id: "scene-one" }], props: [{ id: "prop-one" }] });
        expect(body.episode).not.toHaveProperty("script");
    });

    it("does not duplicate shots inside episode context", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { shots: [{ shotId: "shot-one", videoPrompt: "动作" }] }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);
        const selectedShot = { id: "shot-one", title: "当前镜头" };
        const selectedShotWithReferences = { ...selectedShot, characterIds: ["character-one"], sceneId: "scene-one", propIds: ["prop-one"], clueIds: ["clue-one"] };

        await generateDramaVideoPrompt({
            project: {
                id: "project-one",
                summary: "摘要",
                style: "风格",
                characters: [{ id: "character-one" }, { id: "character-other" }],
                scenes: [{ id: "scene-one" }, { id: "scene-other" }],
                props: [{ id: "prop-one" }, { id: "prop-other" }],
                clues: [{ id: "clue-one" }, { id: "clue-other" }],
            } as never,
            episode: { id: "episode-one", title: "第一集", script: "整集剧本不应发送", shots: [{ id: "other-shot" }], continuityEdges: [{ fromShotId: "other-shot", toShotId: "shot-one" }] } as never,
            shot: selectedShotWithReferences as never,
            referenceMaterials: [],
        });

        const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        expect(body.episode).toMatchObject({ id: "episode-one", title: "第一集", continuityEdges: [{ fromShotId: "other-shot", toShotId: "shot-one" }] });
        expect(body.episode).not.toHaveProperty("shots");
        expect(body.episode).not.toHaveProperty("script");
        expect(body.characters).toEqual([{ id: "character-one" }]);
        expect(body.scenes).toEqual([{ id: "scene-one" }]);
        expect(body.props).toEqual([{ id: "prop-one" }]);
        expect(body.clues).toEqual([{ id: "clue-one" }]);
        expect(body.shots).toEqual([selectedShotWithReferences]);
    });

    it("updates a generated prompt without sending the whole project", async () => {
        const project = { id: "project-one", updatedAt: "2026-08-31T00:00:00.000Z" } as DramaProject;
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { project }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(updateDramaShotPrompt("project-one", "episode-one", "shot-one", "Seedance 动作提示词")).resolves.toEqual(project);
        expect(fetchMock).toHaveBeenCalledWith("/api/drama/projects/project-one/episodes/episode-one/shots/shot-one/prompt", expect.objectContaining({ method: "PATCH" }));
        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ executionVideoPrompt: "Seedance 动作提示词" });
    });

    it("updates an image prompt through the prompt endpoint", async () => {
        const project = { id: "project-one", updatedAt: "2026-08-31T00:00:00.000Z" } as DramaProject;
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { project }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);
        await expect(updateDramaShotImagePrompt("project-one", "episode-one", "shot-one", "图片提示词")).resolves.toEqual(project);
        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ imagePrompt: "图片提示词" });
    });
});
