import { describe, expect, it } from "vitest";

import { createFrameEvidence } from "@/lib/drama-continuity-policy";
import { characterReferenceAudios, dramaShotVideoMode, shotReferenceImages, storyboardReferenceImages, videoReferenceImages } from "./drama-shot-generation-utils";

describe("dramaShotVideoMode", () => {
    it("preserves an explicit shot mode over the project default", () => {
        expect(dramaShotVideoMode({ defaultVideoMode: "reference" } as never, { videoMode: "storyboard" } as never)).toBe("storyboard");
        expect(dramaShotVideoMode({ defaultVideoMode: "storyboard" } as never, { videoMode: "reference" } as never)).toBe("storyboard");
        expect(dramaShotVideoMode({ defaultVideoMode: "storyboard" } as never, {} as never)).toBe("storyboard");
    });
});

describe("storyboardReferenceImages", () => {
    it("uses the planned frame sequence without adding a duplicate start frame", () => {
        const references = storyboardReferenceImages({
            id: "shot-all",
            title: "连续动作",
            storyboardFrameMode: "all_frames",
            frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "upload", mediaUrl: "/start.png", validity: "candidate" })],
            storyboardFrames: [
                { id: "key-1", sequenceIndex: 1, source: "upload", status: "success", mediaUrl: "/key-1.png" },
                { id: "key-2", sequenceIndex: 2, source: "upload", status: "success", mediaUrl: "/key-2.png" },
            ],
        } as never);

        expect(references.map((item) => [item.url, item.keyframeIndex])).toEqual([["/key-1.png", 1], ["/key-2.png", 2]]);
    });

    it("keeps the previous tail as an ordinary reference in an all-frame request", () => {
        const references = videoReferenceImages(
            { characters: [], scenes: [], props: [], clues: [], sourceAssets: [] } as never,
            { characters: [], scenes: [], props: [], clues: [], sourceAssets: [], continuityEdges: [{ fromShotId: "previous", toShotId: "shot-all", inheritActualEndFrame: true }], shots: [{ id: "previous", videoUrl: "/previous.mp4", frameEvidence: [createFrameEvidence({ role: "actual_end", source: "video_extraction", mediaUrl: "/old-tail.png", sourceVideoUrl: "/previous.mp4", validity: "accepted" })] }] } as never,
            {
                id: "shot-all",
                title: "连续动作",
                storyboardFrameMode: "all_frames",
                frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "upload", mediaUrl: "/start.png", validity: "candidate" })],
                storyboardFrames: [{ id: "key-1", sequenceIndex: 1, source: "upload", status: "success", mediaUrl: "/key-1.png" }],
            } as never,
        );
        expect(references).toEqual(expect.arrayContaining([expect.objectContaining({ id: "continuity-end-previous", videoRole: "reference", url: "/old-tail.png" })]));
        expect(references.filter((item) => item.videoRole === "first_frame")).toHaveLength(0);
    });

    it("sends storyboard frames and asset anchors together as ordinary references", () => {
        const references = videoReferenceImages(
            { characters: [{ id: "hero", name: "主角", references: [{ id: "hero-ref", url: "/hero.png", status: "approved", source: "upload", label: "基准", createdAt: new Date(0).toISOString() }], primaryReferenceId: "hero-ref" }], scenes: [], props: [], clues: [], sourceAssets: [] } as never,
            { continuityEdges: [], shots: [] } as never,
            {
                id: "shot-storyboard",
                title: "分镜镜头",
                characterIds: ["hero"],
                propIds: [],
                storyboardFrameMode: "first_last",
                frameEvidence: [
                    createFrameEvidence({ role: "storyboard_start", source: "upload", mediaUrl: "/start.png", validity: "candidate" }),
                    createFrameEvidence({ role: "storyboard_end", source: "upload", mediaUrl: "/end.png", validity: "candidate" }),
                ],
            } as never,
        );

        expect(references.map((item) => [item.url, item.videoRole])).toEqual([
            ["/hero.png", "reference"],
            ["/start.png", "reference"],
            ["/end.png", "reference"],
        ]);
    });

    it("marks the storyboard start and end images as explicit video frames", () => {
        const references = storyboardReferenceImages({
            id: "shot-one",
            title: "雨夜相遇",
            storyboardFrameMode: "first_last",
            storyboardImageUrl: "/api/reference-assets/start.png",
            storyboardImageRemoteUrl: "https://cdn.example.com/start.png",
            storyboardImageWidth: 1280,
            storyboardImageHeight: 720,
            frameEvidence: [
                createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/reference-assets/start.png", remoteUrl: "https://cdn.example.com/start.png", validity: "candidate" }),
                createFrameEvidence({ role: "storyboard_end", source: "generated", mediaUrl: "/api/reference-assets/end.png", remoteUrl: "https://cdn.example.com/end.png", validity: "candidate" }),
            ],
            storyboardEndImageUrl: "/api/reference-assets/end.png",
            storyboardEndImageRemoteUrl: "https://cdn.example.com/end.png",
            storyboardEndImageWidth: 1280,
            storyboardEndImageHeight: 720,
        } as never);

        expect(references).toMatchObject([
            { id: "storyboard-start-shot-one", videoRole: "first_frame", serverUrl: "/api/reference-assets/start.png", remoteUrl: "https://cdn.example.com/start.png" },
            { id: "storyboard-end-shot-one", videoRole: "last_frame", serverUrl: "/api/reference-assets/end.png", remoteUrl: "https://cdn.example.com/end.png" },
        ]);
    });

    it("keeps storyboard mode as a first-frame-only request", () => {
        const references = storyboardReferenceImages({
            id: "shot-two",
            title: "单帧分镜",
            storyboardFrameMode: "first_frame",
            storyboardImageUrl: "https://cdn.example.com/start.png",
            storyboardEndImageUrl: "https://cdn.example.com/end.png",
            frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "https://cdn.example.com/start.png", validity: "candidate" })],
        } as never);

        expect(references).toEqual([expect.objectContaining({ id: "storyboard-start-shot-two", videoRole: "first_frame", remoteUrl: "https://cdn.example.com/start.png" })]);
    });

    it("keeps every matching project reference instead of taking the first four", () => {
        const characters = Array.from({ length: 5 }, (_, index) => ({
            id: `character-${index}`,
            name: `角色 ${index}`,
            references: [{ id: `reference-${index}`, url: `/api/reference-assets/${index}.png`, status: "approved" as const, source: "upload" as const, label: "基准", createdAt: new Date(0).toISOString() }],
            primaryReferenceId: `reference-${index}`,
        }));
        const references = shotReferenceImages({ characters, scenes: [], props: [], sourceAssets: [] } as never, { characterIds: characters.map((item) => item.id), propIds: [] } as never);

        expect(references).toHaveLength(5);
        expect(references.at(-1)).toMatchObject({ id: "character-4", serverUrl: "/api/reference-assets/4.png" });
    });

    it("includes clue baseline images and source images in shot references", () => {
        const references = shotReferenceImages(
            {
                characters: [],
                scenes: [],
                props: [],
                clues: [{ id: "clue-one", name: "裂剑", references: [{ id: "clue-ref", url: "/api/clue.png", status: "approved", source: "upload", label: "基准", createdAt: new Date(0).toISOString() }], primaryReferenceId: "clue-ref" }],
                sourceAssets: [{ id: "source-one", type: "image", title: "来源图", serverUrl: "/api/source.png", mimeType: "image/png" }],
            } as never,
            { characterIds: [], propIds: [], clueIds: ["clue-one"], sourceAssetIds: ["source-one"] } as never,
        );

        expect(references).toEqual([expect.objectContaining({ id: "clue-one", serverUrl: "/api/clue.png" }), expect.objectContaining({ id: "source-one", serverUrl: "/api/source.png" })]);
    });
});

describe("videoReferenceImages", () => {
    it("uses the previous shot actual tail as the only explicit first frame", () => {
        const references = videoReferenceImages(
            { characters: [], scenes: [], props: [], clues: [], sourceAssets: [] } as never,
            {
                continuityEdges: [{ fromShotId: "shot-one", toShotId: "shot-two", transition: "continuous", inheritActualEndFrame: true, carryCharacterIds: [], carryPropIds: [], carryEnvironment: true, carryAxis: true }],
                shots: [
                    { id: "shot-one", title: "上一镜", videoUrl: "/api/reference-assets/one.mp4", frameEvidence: [createFrameEvidence({ role: "actual_end", source: "video_extraction", mediaUrl: "/api/reference-assets/actual-tail.png", sourceVideoUrl: "/api/reference-assets/one.mp4", validity: "accepted" })] },
                    { id: "shot-two", title: "下一镜", storyboardImageUrl: "/api/reference-assets/storyboard-start.png", storyboardFrameMode: "first_last", storyboardEndImageUrl: "/api/reference-assets/storyboard-end.png", frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/reference-assets/storyboard-start.png", validity: "candidate" }), createFrameEvidence({ role: "storyboard_end", source: "generated", mediaUrl: "/api/reference-assets/storyboard-end.png", validity: "candidate" })] },
                ],
            } as never,
            { id: "shot-two", title: "下一镜", storyboardImageUrl: "/api/reference-assets/storyboard-start.png", storyboardFrameMode: "first_last", storyboardEndImageUrl: "/api/reference-assets/storyboard-end.png", frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/reference-assets/storyboard-start.png", validity: "candidate" }), createFrameEvidence({ role: "storyboard_end", source: "generated", mediaUrl: "/api/reference-assets/storyboard-end.png", validity: "candidate" })] } as never,
        );

        expect(references.filter((item) => item.videoRole === "first_frame")).toEqual([expect.objectContaining({ id: "continuity-end-shot-one", url: "/api/reference-assets/actual-tail.png" })]);
        expect(references).toEqual(expect.arrayContaining([expect.objectContaining({ id: "storyboard-start-shot-two", videoRole: "reference" }), expect.objectContaining({ id: "storyboard-end-shot-two", videoRole: "last_frame" })]));
    });
});

describe("characterReferenceAudios", () => {
    it("only passes completed local role audio assets to video generation", () => {
        const project = {
            id: "project-one",
            characters: [
                { id: "karin", name: "Karin", voiceProfile: { sampleAssetId: "sample-one", previewStatus: "success", previewAudioUrl: "/api/reference-assets/permanent/audio/sample-one.wav" } },
                { id: "remote", name: "Remote", voiceProfile: { sampleAssetId: "sample-two", previewStatus: "success", previewAudioUrl: "https://supplier.example/audio.wav" } },
                { id: "running", name: "Running", voiceProfile: { sampleAssetId: "sample-three", previewStatus: "running", previewAudioUrl: "/api/reference-assets/permanent/audio/sample-three.wav" } },
            ],
        } as never;

        expect(characterReferenceAudios(project, { characterIds: ["karin", "remote", "running"], propIds: [] } as never)).toEqual([
            { id: "voice-karin-sample-one", name: "Karin 角色音频", type: "audio/wav", url: "/api/reference-assets/permanent/audio/sample-one.wav" },
        ]);
    });

    it("resolves the character from a stable voice identity key", () => {
        const project = { id: "project-one", characters: [{ id: "karin", name: "Karin", voiceProfile: { sampleAssetId: "sample-one", previewStatus: "success", previewAudioUrl: "/api/reference-assets/permanent/audio/sample-one.wav" } }] } as never;

        expect(characterReferenceAudios(project, { characterIds: [], voiceIdentityId: "project-one:karin" } as never)).toHaveLength(1);
    });
});
