import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type { DramaProductionPackageV1, DramaProject } from "@/lib/drama-project-contract";
import { applyDramaProductionPackage, previewDramaProductionPackage } from "@/lib/server/drama-production-package";

const productionPackage: DramaProductionPackageV1 = {
    schemaVersion: 1,
    project: {
        title: "四界之心",
        summary: "两个新生进入阿佐雷斯。",
        style: "电影级写实奇幻",
        ratio: "9:16",
        productionBible: { targetPlatform: "Seedance 2.0", language: "中文", ratio: "9:16", targetDuration: 30, visualStyle: "电影级写实奇幻", continuityMode: "strict" },
    },
    assets: {
        characters: [
            { code: "C01", name: "Karin", description: "灰绿色眼睛", profile: { visualIdentity: "右眉尾淡疤", styling: "深墨绿短斗篷", colorPalette: "墨绿", consistencyRules: "断剑不变", identityAnchors: ["灰绿色眼睛"] } },
            { code: "C02", name: "Rifa", description: "琥珀色眼睛" },
        ],
        locations: [{ code: "S01", name: "阿佐雷斯城门", description: "双塔石城门" }],
        props: [{ code: "P01", name: "断剑", description: "不对称双翼护手" }],
        clues: [],
    },
    episodes: [
        {
            code: "E01",
            title: "无灵压的旅人",
            script: "Karin从梦中惊醒。",
            outline: "抵达阿佐雷斯。",
            hook: "观察者出现。",
            nextPreview: "进入铸剑铺。",
            sourceRange: "第一章",
            storyScenes: [{ code: "SC01", order: 1, title: "马车", summary: "梦醒", timeRange: "0-30秒", locationCode: "S01", shotCodes: ["SH01", "SH02"] }],
            shots: [shot("SH01", 1, "0-15s", ["C01"], "梦中惊醒"), shot("SH02", 2, "15-30s", ["C01", "C02"], "接住水囊")],
            continuityEdges: [{ fromShotCode: "SH01", toShotCode: "SH02", transition: "continuous", inheritActualEndFrame: true, carryCharacterIds: ["C01"], carryPropIds: ["P01"], carryEnvironment: true, carryAxis: true }],
        },
    ],
};

describe("production package boundary", () => {
    it("previews canonical JSON without losing production counts", () => {
        const preview = previewDramaProductionPackage(JSON.stringify(productionPackage), "package.json");

        expect(preview.format).toBe("json");
        expect(preview.summary).toEqual({ episodes: 1, storyScenes: 1, shots: 2, characters: 2, locations: 1, duration: 30, archiveSections: 0, promptAssets: 0 });
        expect(preview.package.episodes[0].shots[0]).toMatchObject({ code: "SH01", lens: "50mm", sound: { ambience: "车轮声" }, videoPrompt: "梦中惊醒" });
    });

    it("maps the Mahadel director Markdown into an executable package", () => {
        const source = readFileSync(new URL("../../../../output/mahadel-episode-01-production-package.md", import.meta.url), "utf8");
        const preview = previewDramaProductionPackage(source, "mahadel-episode-01-production-package.md");

        expect(preview.format).toBe("markdown");
        expect(preview.summary).toEqual({ episodes: 1, storyScenes: 7, shots: 12, characters: 7, locations: 4, duration: 180, archiveSections: 13, promptAssets: 7 });
        expect(preview.package.project).toMatchObject({ ratio: "9:16", productionBible: { targetPlatform: "Seedance 2.0", continuityMode: "strict" } });
        expect(preview.package.episodes[0].shots.map((shot) => shot.code)).toEqual(["SH01", "SH02", "SH03", "SH04", "SH05", "SH06", "SH07", "SH08", "SH09", "SH10", "SH11", "SH12"]);
        expect(preview.package.episodes[0].shots[11]).toMatchObject({ lens: "85mm", sound: { ambience: "店外声音像隔水" } });
        expect(preview.package.episodes[0].shots[11].videoPrompt).toContain("拒绝保持完整");
        expect(preview.package.assets.characters.find((asset) => asset.code === "C03")?.activeEpisodeCodes).toEqual([]);
        expect(preview.package.episodes[0].shots.flatMap((shot) => shot.characterCodes)).not.toContain("C03");
        expect(preview.package.episodes[0].shots.flatMap((shot) => shot.characterCodes)).not.toContain("C04");
        expect(preview.package.archive).toMatchObject({
            formatVersion: "vozeb-drama-production-package-v1",
            promptAssets: expect.arrayContaining([
                expect.objectContaining({ code: "V01", category: "keyframe", shotCodes: ["SH01", "SH11"] }),
                expect.objectContaining({ code: "SB01", category: "storyboard", shotCodes: ["SH01", "SH02", "SH03", "SH04"] }),
            ]),
            dialogueDirections: expect.arrayContaining([expect.objectContaining({ id: "D01", performance: "VL1耳语、SP2慢、无呼吸感", lipSync: false })]),
            voiceDirections: expect.arrayContaining([expect.objectContaining({ subject: "Karin" })]),
            silenceDirections: expect.arrayContaining([expect.objectContaining({ shotCode: "SH07" })]),
            referencePlan: expect.arrayContaining([expect.objectContaining({ priority: 1, asset: "C01 Karin角色卡", planType: "consistency_asset" })]),
        });
        expect(preview.package.archive?.sections.map((section) => section.title)).toEqual(
            expect.arrayContaining(["原创第一章", "项目总览", "关键视频资产 Prompt", "全案板 Prompt", "QC 报告"]),
        );
        expect(preview.package.archive?.generationOrder.length).toBeGreaterThan(0);
        expect(preview.package.archive?.qcReport).toContain("总分");
    });

    it("applies package codes to stable project ids and preserves manual fields", () => {
        const existing = project();
        const first = applyDramaProductionPackage(existing, productionPackage, "hash-one");
        const karinId = first.characters.find((item) => item.name === "Karin")!.id;
        const shotId = first.episodes[0].shots[0].id;
        const manuallyEdited: DramaProject = {
            ...first,
            characters: first.characters.map((item) => (item.id === karinId ? { ...item, description: "人工角色描述", fieldOrigins: { ...item.fieldOrigins, description: "manual" } } : item)),
        };
        const second = applyDramaProductionPackage(
            manuallyEdited,
            { ...productionPackage, assets: { ...productionPackage.assets, characters: productionPackage.assets.characters.map((item) => (item.code === "C01" ? { ...item, description: "制作包新描述" } : item)) } },
            "hash-two",
        );

        expect(second.characters.find((item) => item.name === "Karin")).toMatchObject({ id: karinId, description: "人工角色描述" });
        expect(second.episodes[0].shots[0].id).toBe(shotId);
        expect(second.episodes[0].storyScenes?.[0].shotIds).toEqual([shotId, second.episodes[0].shots[1].id]);
        expect(second.episodes[0].continuityEdges?.[0]).toMatchObject({ fromShotId: shotId, toShotId: second.episodes[0].shots[1].id, inheritActualEndFrame: true });
        expect(second.sourceAssets?.at(-1)).toMatchObject({ type: "text", title: "制作包 package.json", textContent: "hash-two" });
        expect(second.episodes[0].reviewStatus).toBe("visual_ready");
        expect(second.productionArchive).toEqual(productionPackage.archive);
    });

    it("treats complete-package asset lists as authoritative while keeping stable matched ids", () => {
        const existing: DramaProject = {
            ...project(),
            characters: [
                { id: "character-existing", name: "Karin", description: "旧描述", fieldOrigins: { description: "ai" } },
                { id: "character-duplicate", name: "断剑少年", description: "旧 AI 重复角色", fieldOrigins: { description: "ai" } },
            ],
            scenes: [{ id: "scene-duplicate", name: "城门", description: "旧 AI 重复地点", fieldOrigins: { description: "ai" } }],
        };

        const applied = applyDramaProductionPackage(existing, productionPackage, "hash-assets");

        expect(applied.characters.map((asset) => asset.name)).toEqual(["Karin", "Rifa"]);
        expect(applied.characters[0].id).toBe("character-existing");
        expect(applied.scenes.map((asset) => asset.name)).toEqual(["阿佐雷斯城门"]);
    });

    it("does not replace a manually locked project bible", () => {
        const existing = { ...project(), productionBible: { targetPlatform: "人工平台", language: "中文", ratio: "9:16", visualStyle: "人工风格", continuityMode: "balanced" as const }, fieldOrigins: { productionBible: "manual" as const } };
        const applied = applyDramaProductionPackage(existing, productionPackage, "hash-bible");
        expect(applied.productionBible).toMatchObject({ targetPlatform: "人工平台", visualStyle: "人工风格", continuityMode: "balanced" });
    });
});

function shot(code: string, order: number, timecode: string, characterCodes: string[], videoPrompt: string): DramaProductionPackageV1["episodes"][number]["shots"][number] {
    return {
        code,
        order,
        title: code,
        description: videoPrompt,
        sourceText: videoPrompt,
        shotBoundary: "时间码边界",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: `${videoPrompt}画面`,
        videoPrompt,
        cameraMotion: "缓慢推进",
        startFramePrompt: "起始",
        endFramePrompt: "结束",
        negativePrompt: "无水印",
        continuity: { shotSize: "中景", cameraAngle: "平视", composition: "竖幅", characterBlocking: "居中", gazeDirection: "向左", actionStart: "静止", actionEnd: "抬手", screenDirection: "向右", axisRule: "不越轴", continuityNotes: "保持服装" },
        duration: 15,
        characterCodes,
        propCodes: ["P01"],
        clueCodes: [],
        locationCode: "S01",
        storySceneCode: "SC01",
        timecode,
        dramaticFunction: "推进",
        lens: "50mm",
        lighting: "阴天柔光",
        colorPalette: "冷灰",
        transitionOut: "动作切",
        sound: { ambience: "车轮声" },
        entryState: { characters: [], props: [] },
        exitState: { characters: [], props: [] },
        videoMode: "storyboard",
        storyboardFrameMode: "first_last",
    };
}

function project(): DramaProject {
    return {
        id: "project-one",
        title: "旧标题",
        summary: "",
        style: "",
        ratio: "9:16",
        status: "active",
        activeEpisodeId: "episode-one",
        characters: [{ id: "character-existing", name: "Karin", description: "旧描述", fieldOrigins: { description: "ai" } }],
        scenes: [],
        props: [],
        clues: [],
        defaultVideoMode: "storyboard",
        episodes: [{ id: "episode-one", title: "第 1 集", script: "", outline: "", hook: "", nextPreview: "", sourceRange: "", reviewStatus: "draft", shots: [] }],
        sourceAssets: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}
