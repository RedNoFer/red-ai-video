import { describe, expect, it } from "vitest";

import type { DramaProject, DramaShot } from "./drama-project-contract";
import { defaultDramaShotReferenceAssetIds, selectedDramaShotFrameIds, selectedDramaShotReferenceAssetIds } from "./drama-video-reference-plan";

describe("drama video reference plan", () => {
    const project = {
        characters: [{ id: "character-one", name: "角色", primaryReferenceId: "character-ref", references: [{ id: "character-ref", url: "/character.png", status: "approved" }] }],
        scenes: [{ id: "scene-one", name: "场景", references: [{ id: "scene-ref", url: "/scene.png", status: "approved" }], primaryReferenceId: "scene-ref", sceneReferenceBoard: { layout: "panorama", referenceId: "scene-ref" } }],
        props: [{ id: "prop-one", name: "道具", primaryReferenceId: "prop-ref", references: [{ id: "prop-ref", url: "/prop.png", status: "approved" }] }],
        clues: [],
        sourceAssets: [],
    } as unknown as DramaProject;
    const shot = {
        id: "shot-one",
        sceneId: "scene-one",
        characterIds: ["character-one"],
        propIds: ["prop-one"],
        clueIds: [],
        framePlan: {
            frames: [
                { id: "frame-one", sequenceIndex: 1 },
                { id: "frame-two", sequenceIndex: 2 },
            ],
        },
    } as unknown as DramaShot;

    it("defaults to readable scene and character images only", () => {
        expect(defaultDramaShotReferenceAssetIds(project, shot)).toEqual(["scene-one", "character-one"]);
        expect(selectedDramaShotReferenceAssetIds(project, shot)).toEqual(["scene-one", "character-one"]);
    });

    it("keeps explicit empty asset choices empty and treats frames as ordinary refs", () => {
        expect(selectedDramaShotReferenceAssetIds(project, shot, { [shot.id]: [] })).toEqual([]);
        expect(selectedDramaShotFrameIds(shot, "reference", { [shot.id]: ["frame-two"] })).toEqual(["frame-two"]);
        expect(selectedDramaShotFrameIds(shot, "all_frames", { [shot.id]: [] })).toEqual(["frame-one", "frame-two"]);
    });
});
