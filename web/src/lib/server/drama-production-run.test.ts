import { describe, expect, it } from "vitest";

import type { DramaEpisode, DramaProject } from "@/lib/drama-project-contract";
import { buildDramaProductionRun, compileDramaVideoSegmentPrompt, invalidateDramaProductionRunFromShot, refreshDramaVideoStepReferences } from "@/lib/server/drama-production-run";

describe("drama production run planning", () => {
    it("locks parameters and gates the next continuous shot on previous continuity QC", () => {
        const project = fixture();
        const run = buildDramaProductionRun(project, project.episodes[0], { imageModel: "image-one", videoModel: "video-one", audioModel: "audio-one", imageQuality: "2k", videoQuality: "1080p" });
        const firstQc = run.steps.find((step) => step.shotId === "shot-one" && step.type === "continuity_qc")!;
        const secondStart = run.steps.find((step) => step.shotId === "shot-two" && step.type === "start_frame")!;

        expect(run).toMatchObject({ mode: "strict", parameterSnapshot: { imageModel: "image-one", videoModel: "video-one", ratio: "9:16" } });
        expect(secondStart.dependsOn).toContain(firstQc.id);
        expect(secondStart.referenceShotId).toBe("shot-one");
        expect(run.steps.find((step) => step.shotId === "shot-three" && step.type === "start_frame")?.referenceShotId).toBeUndefined();
    });

    it("marks the changed shot and its dependency chain stale without invalidating a scene change", () => {
        const project = fixture();
        const run = buildDramaProductionRun(project, project.episodes[0], { imageModel: "image", videoModel: "video" });
        const invalidated = invalidateDramaProductionRunFromShot(run, project.episodes[0], "shot-one");

        expect(invalidated.steps.filter((step) => step.status === "stale").map((step) => step.shotId)).toEqual(expect.arrayContaining(["shot-one", "shot-two"]));
        expect(invalidated.steps.filter((step) => step.shotId === "shot-three").every((step) => step.status !== "stale")).toBe(true);
    });

    it("groups a nine-frame plan by provider duration and image budget with shared boundaries", () => {
        const project = fixture();
        const shot = project.episodes[0].shots[0];
        shot.storyboardFrameMode = "all_frames";
        shot.duration = 8;
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: Array.from({ length: 4 }, (_, index) => ({ id: `f${index + 1}`, sequenceIndex: index + 1, startSecond: index * 2, endSecond: (index + 1) * 2, actionPrompt: `动作${index + 1}`, imagePrompt: `画面${index + 1}` })),
        };
        shot.storyboardFrames = shot.framePlan.frames.map((frame) => ({ id: frame.id, sequenceIndex: frame.sequenceIndex, mediaUrl: `/${frame.id}.png`, source: "upload", status: "success", continuityStatus: "passed" }));

        const run = buildDramaProductionRun(project, { ...project.episodes[0], shots: [shot], continuityEdges: [] }, { imageModel: "image", videoModel: "video", minVideoSeconds: 2, maxVideoSeconds: 5, maxReferenceImages: 4 });
        const videos = run.steps.filter((step) => step.type === "video");

        expect(videos.map((step) => step.referenceImageUrls)).toEqual([
            ["/f1.png", "/f2.png", "/f3.png"],
            ["/f3.png", "/f4.png"],
        ]);
        expect(videos.map((step) => step.duration)).toEqual([4, 4]);
        expect(videos[1].dependsOn).toContain(videos[0].id);
        expect(videos[0].prompt).toContain("P01-F01 0-2s：动作1");
        expect(compileDramaVideoSegmentPrompt(shot, ["f3", "f4"])).toContain("P01-F04 6-8s：动作4");
    });

    it("keeps production-package reference order and accepts usable project source images", () => {
        const project = fixture();
        project.sourceAssets = [
            { id: "source-one", type: "image", title: "角色设定", serverUrl: "/api/reference-assets/one.png" },
            { id: "source-two", type: "image", title: "场景设定", serverUrl: "/api/reference-assets/two.png", remoteUrl: "https://cdn.example.com/two.png" },
        ];
        const shot = project.episodes[0].shots[0];
        shot.characterIds = [];
        shot.sourceAssetIds = ["source-one", "source-two"];
        shot.storyboardFrameMode = "all_frames";
        shot.duration = 4;
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: false },
            referenceManifest: [
                { alias: "@图片1", role: "scene_anchor", purpose: "场景", assetId: "source-two" },
                { alias: "@图片2", role: "character_anchor", purpose: "角色", assetId: "source-one" },
            ],
            frames: [
                { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "抬头", imagePrompt: "人物抬头" },
                { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 4, actionPrompt: "转身", imagePrompt: "人物转身" },
            ],
        };
        const framePlan = shot.framePlan!;
        shot.storyboardFrames = framePlan.frames.map((frame) => ({ id: frame.id, sequenceIndex: frame.sequenceIndex, mediaUrl: `/${frame.id}.png`, source: "upload", status: "success", continuityStatus: "passed" }));

        const run = buildDramaProductionRun(project, { ...project.episodes[0], shots: [shot], continuityEdges: [] }, { imageModel: "image", videoModel: "video", maxReferenceImages: 4 });

        expect(run.steps.filter((step) => step.type === "asset_anchor")).toEqual([
            expect.objectContaining({ assetId: "source-two", status: "success", outputRemoteUrls: ["https://cdn.example.com/two.png"] }),
            expect.objectContaining({ assetId: "source-one", status: "success", outputUrls: ["/api/reference-assets/one.png"] }),
        ]);
        expect(run.steps.find((step) => step.type === "video")?.referenceAssetIds).toEqual(["source-two", "source-one"]);
        expect(run.steps.find((step) => step.type === "video")?.referenceBindingsSnapshot).toMatchObject([
            { alias: "@图片1", role: "keyframe", frameId: "f1" },
            { alias: "@图片2", role: "keyframe", frameId: "f2" },
            { alias: "@图片3", role: "scene_anchor", sourceId: "source-two", url: "/api/reference-assets/two.png" },
            { alias: "@图片4", role: "character_anchor", sourceId: "source-one", url: "/api/reference-assets/one.png" },
        ]);
    });

    it("refreshes a locked video step from keyframes generated after the run was created", () => {
        const project = fixture();
        const shot = project.episodes[0].shots[0];
        shot.storyboardFrameMode = "all_frames";
        shot.duration = 4;
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [
                { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "抬头", imagePrompt: "人物抬头" },
                { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 4, actionPrompt: "转身", imagePrompt: "人物转身" },
            ],
        };
        const locked = buildDramaProductionRun(project, { ...project.episodes[0], shots: [shot], continuityEdges: [] }, { imageModel: "image", videoModel: "video", maxReferenceImages: 4 });
        const video = locked.steps.find((step) => step.type === "video")!;
        expect(video.referenceImageUrls).toEqual([]);

        shot.storyboardFrames = shot.framePlan.frames.map((frame) => ({ id: frame.id, sequenceIndex: frame.sequenceIndex, mediaUrl: `/generated-${frame.id}.png`, source: "generated", status: "success", continuityStatus: "passed" }));
        const refreshed = refreshDramaVideoStepReferences(project, { ...project.episodes[0], shots: [shot], continuityEdges: [] }, video);

        expect(refreshed.referenceImageUrls).toEqual(["/generated-f1.png", "/generated-f2.png"]);
        expect(refreshed.referenceBindingsSnapshot).toMatchObject([{ alias: "@图片1", frameId: "f1" }, { alias: "@图片2", frameId: "f2" }]);
        expect(refreshed.prompt).toContain("P01-F01 0-2s：抬头");
    });

    it("blocks before submission when assets leave room for fewer than two frame anchors", () => {
        const project = fixture();
        const shot = project.episodes[0].shots[0];
        project.sourceAssets = Array.from({ length: 8 }, (_, index) => ({ id: `source-${index}`, type: "image" as const, title: `素材 ${index}`, serverUrl: `/api/reference-assets/${index}.png` }));
        shot.characterIds = [];
        shot.sourceAssetIds = project.sourceAssets.map((asset) => asset.id);
        shot.storyboardFrameMode = "all_frames";
        shot.duration = 4;
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [
                { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "抬头", imagePrompt: "人物抬头" },
                { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 4, actionPrompt: "转身", imagePrompt: "人物转身" },
            ],
        };

        expect(() => buildDramaProductionRun(project, { ...project.episodes[0], shots: [shot], continuityEdges: [] }, { imageModel: "image", videoModel: "video", maxReferenceImages: 20 })).toThrow("至少 2 张逐帧锚点图");
    });
});

function fixture(): DramaProject {
    const episode: DramaEpisode = {
        id: "episode-one",
        title: "第一集",
        script: "",
        outline: "",
        hook: "",
        nextPreview: "",
        sourceRange: "",
        reviewStatus: "visual_ready",
        continuityEdges: [
            { fromShotId: "shot-one", toShotId: "shot-two", transition: "continuous", inheritActualEndFrame: true, carryCharacterIds: ["character-one"], carryPropIds: [], carryEnvironment: true, carryAxis: true },
            { fromShotId: "shot-two", toShotId: "shot-three", transition: "scene_change", inheritActualEndFrame: false, carryCharacterIds: [], carryPropIds: [], carryEnvironment: false, carryAxis: false },
        ],
        shots: [shot("shot-one", 1), shot("shot-two", 2), shot("shot-three", 3)],
    };
    return {
        id: "project",
        title: "项目",
        summary: "",
        style: "写实",
        ratio: "9:16",
        productionBible: { language: "中文", ratio: "9:16", visualStyle: "写实", continuityMode: "strict" },
        status: "active",
        characters: [{ id: "character-one", name: "人物", description: "" }],
        scenes: [],
        props: [],
        clues: [],
        defaultVideoMode: "storyboard",
        episodes: [episode],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}

function shot(id: string, order: number): DramaEpisode["shots"][number] {
    return {
        id,
        order,
        title: id,
        description: id,
        sourceText: id,
        shotBoundary: "",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: "图",
        videoPrompt: "视频",
        cameraMotion: "固定",
        duration: 15,
        characterIds: ["character-one"],
        propIds: [],
        clueIds: [],
        storyboardFrameMode: "first_last",
        continuityStatus: "ready",
    };
}
