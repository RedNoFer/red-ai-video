import { describe, expect, it } from "vitest";

import type { DramaNamedAsset, DramaProject, DramaShot } from "@/lib/drama-project-contract";
import { buildDramaAssetLibraryRows } from "./drama-asset-library-utils";

describe("drama asset library usage count", () => {
    it("counts shots referencing an asset only through referenceIntents", () => {
        const scene = assetFixture("scenes-supplement", "Dive bar内(深夜)");
        const shot = shotFixture({ sceneId: "scenes-main", referenceIntents: [{ assetId: "scenes-supplement", code: "LOC_08", role: "scene_anchor", guidance: "内殿空间与烛光基准" }] });
        const project = projectFixture([shot], { scenes: [assetFixture("scenes-main", "主场景"), scene] });

        const rows = buildDramaAssetLibraryRows(project, project.episodes[0], "scenes");

        expect(rows.find((row) => row.asset.id === "scenes-supplement")?.usageCount).toBe(1);
        expect(rows.find((row) => row.asset.id === "scenes-main")?.usageCount).toBe(1);
    });

    it("counts each shot once when the asset is both main-bound and listed in referenceIntents", () => {
        const scene = assetFixture("scenes-main", "主场景");
        const shot = shotFixture({ sceneId: "scenes-main", referenceIntents: [{ assetId: "scenes-main", code: "LOC_12", role: "scene_anchor", guidance: "0-9秒山门基准" }] });
        const project = projectFixture([shot], { scenes: [scene] });

        const rows = buildDramaAssetLibraryRows(project, project.episodes[0], "scenes");

        expect(rows.find((row) => row.asset.id === "scenes-main")?.usageCount).toBe(1);
    });

    it("keeps counting character and prop intents for every asset kind", () => {
        const character = assetFixture("characters-a", "Selene");
        const prop = assetFixture("props-b", "怀表");
        const shot = shotFixture({
            referenceIntents: [
                { assetId: "characters-a", code: "CHAR_01", role: "character_anchor", guidance: "角色基准" },
                { assetId: "props-b", code: "PROP_02", role: "prop_anchor", guidance: "道具基准" },
            ],
        });
        const project = projectFixture([shot], { characters: [character], props: [prop] });

        expect(buildDramaAssetLibraryRows(project, project.episodes[0], "characters").find((row) => row.asset.id === "characters-a")?.usageCount).toBe(1);
        expect(buildDramaAssetLibraryRows(project, project.episodes[0], "props").find((row) => row.asset.id === "props-b")?.usageCount).toBe(1);
    });
});

function assetFixture(id: string, name: string): DramaNamedAsset {
    return { id, name, description: "", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } as DramaNamedAsset;
}

function shotFixture(patch: Partial<DramaShot>): DramaShot {
    return {
        id: "shot",
        order: 1,
        title: "镜头",
        description: "动作",
        sourceText: "原文",
        shotBoundary: "段落",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: "画面提示词",
        videoPrompt: "动态提示词",
        cameraMotion: "固定机位",
        duration: 5,
        characterIds: [],
        propIds: [],
        clueIds: [],
        storyboardStatus: "idle",
        generationStatus: "idle",
        audioMode: "source",
        audioStatus: "idle",
        ...patch,
    } as DramaShot;
}

function projectFixture(shots: DramaShot[], assets: { scenes?: DramaNamedAsset[]; characters?: DramaNamedAsset[]; props?: DramaNamedAsset[] } = {}): DramaProject {
    return {
        id: "project",
        title: "测试短剧",
        summary: "",
        style: "",
        ratio: "9:16",
        status: "active",
        characters: assets.characters || [],
        scenes: assets.scenes || [],
        props: assets.props || [],
        clues: [],
        defaultVideoMode: "storyboard",
        activeEpisodeId: "episode",
        episodes: [{ id: "episode", title: "第一集", script: "剧本", outline: "", hook: "", nextPreview: "", sourceRange: "", reviewStatus: "visual_ready", shots }],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    } as unknown as DramaProject;
}
