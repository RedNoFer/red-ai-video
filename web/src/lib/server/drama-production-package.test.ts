import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type { DramaProductionPackageV1, DramaProject } from "@/lib/drama-project-contract";
import { DRAMA_STYLE_COLOR_SCRIPT, DRAMA_STYLE_NAME } from "@/lib/drama-style";
import { applyDramaProductionPackage, previewDramaProductionPackage } from "@/lib/server/drama-production-package";

const productionPackage: DramaProductionPackageV1 = {
    schemaVersion: 1,
    project: {
        title: "四界之心",
        summary: "两个新生进入阿佐雷斯。",
        style: DRAMA_STYLE_NAME,
        ratio: "9:16",
        productionBible: { targetPlatform: "Seedance 2.0", language: "中文", ratio: "9:16", targetDuration: 30, visualStyle: DRAMA_STYLE_NAME, colorScript: DRAMA_STYLE_COLOR_SCRIPT, continuityMode: "strict" },
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
        expect(preview.package.project).toMatchObject({ style: DRAMA_STYLE_NAME, productionBible: { visualStyle: DRAMA_STYLE_NAME, colorScript: DRAMA_STYLE_COLOR_SCRIPT } });
        expect(preview.summary).toEqual({ episodes: 1, storyScenes: 1, shots: 2, characters: 2, locations: 1, duration: 30, archiveSections: 0, promptAssets: 0, performancePlans: 2, lightingPlans: 2, continuityPlans: 2 });
        expect(preview.package.episodes[0].shots[0]).toMatchObject({ code: "SH01", lens: "50mm", sound: { ambience: "车轮声" }, videoPrompt: "梦中惊醒" });
        expect(preview.package.assets.characters.find((item) => item.code === "C02")?.profile).toMatchObject({
            styling: "Rifa的发型、服装、随身物件与材质按描述固定",
            colorPalette: "按制作包描述中的固有色保持跨镜头一致",
        });
    });

    it("deduplicates package assets by stable code before preview and apply", () => {
        const source = structuredClone(productionPackage);
        source.assets.characters.push({ code: "C01", name: "Karin", description: "重复记录" });
        source.assets.props.push({ code: "P01", name: "断剑", description: "重复记录" });
        const preview = previewDramaProductionPackage(JSON.stringify(source), "package.json");
        expect(preview.package.assets.characters).toHaveLength(2);
        expect(preview.package.assets.props).toHaveLength(1);
        expect(preview.package.assets.characters.find((item) => item.code === "C01")?.description).toBe("重复记录");
    });

    it("preserves all-frames storyboard mode from an imported package", () => {
        const source = structuredClone(productionPackage);
        source.episodes[0].shots[0].storyboardFrameMode = "all_frames";
        const preview = previewDramaProductionPackage(JSON.stringify(source), "package.json");
        expect(preview.package.episodes[0].shots[0].storyboardFrameMode).toBe("all_frames");
    });

    it("rejects a package that omits required state and frame-plan fields", () => {
        const incomplete = structuredClone(productionPackage);
        const target = incomplete.episodes[0].shots[0];
        target.performancePlan = undefined;
        target.lightingPlan = undefined;
        target.continuity = {
            shotSize: "",
            cameraAngle: "",
            composition: "",
            characterBlocking: "",
            gazeDirection: "",
            actionStart: "",
            actionEnd: "",
            screenDirection: "",
            axisRule: "",
            continuityNotes: "",
        };
        target.entryState = undefined;
        target.exitState = undefined;

        expect(() => previewDramaProductionPackage(JSON.stringify(incomplete), "package.json")).toThrow("必须声明入口和出口状态");
    });

    it("rejects a legacy Markdown snapshot that lacks required frame plans", () => {
        const source = readFileSync(new URL("../../../../output/mahadel-episode-01-production-package.md", import.meta.url), "utf8");
        expect(() => previewDramaProductionPackage(source, "mahadel-episode-01-production-package.md")).toThrow("缺少有效 framePlan");
    });

    it("recognizes the generated multiframe Markdown package", () => {
        const source = readFileSync(new URL("../../../../output/mahadel-episode-01-production-package-v2-multiframe.md", import.meta.url), "utf8");
        const preview = previewDramaProductionPackage(source, "mahadel-episode-01-production-package-v2-multiframe.md");
        expect(preview.package.schemaVersion).toBe(1);
        expect(preview.package.project.productionBible.productionPlan?.video.mode).toBe("storyboard");
        expect(preview.package.episodes[0].shots.every((shot) => shot.storyboardFrameMode === "all_frames")).toBe(true);
    });

    it("derives concrete profile fields when a package omits optional character profile values", () => {
        const source = readFileSync(new URL("../../../../output/mahadel-episode-01-production-package-v2-multiframe.md", import.meta.url), "utf8");
        const preview = previewDramaProductionPackage(source, "mahadel-episode-01-production-package-v2-multiframe.md");
        const inspector = preview.package.assets.characters.find((item) => item.code === "C05");
        expect(inspector?.profile).toMatchObject({
            visualIdentity: expect.stringContaining("铁灰短发"),
            styling: expect.stringContaining("制服"),
            colorPalette: expect.stringContaining("皇家深蓝"),
        });
        expect(inspector?.profile?.styling).not.toContain("按制作包设定保持稳定");
    });

    it("normalizes generic location consistency rules into executable spatial constraints", () => {
        const source = structuredClone(productionPackage);
        source.assets.locations = [{
            code: "S01",
            name: "铸剑铺",
            description: "纵深店铺，入口在前，铁砧居中，炉膛在后左，柜台在右侧。",
            profile: {
                visualIdentity: "纵深铸剑铺",
                styling: "铁砧居中、炉膛后左、柜台右侧",
                colorPalette: "煤黑与暗琥珀",
                consistencyRules: "按设计 Prompt 保持一致",
                spatialRules: ["入口在前", "铁砧居中", "炉膛后左", "柜台右侧"],
            },
        }];

        const location = previewDramaProductionPackage(JSON.stringify(source), "package.json").package.assets.locations[0];
        expect(location.profile?.consistencyRules).toContain("空间拓扑");
        expect(location.profile?.consistencyRules).toContain("入口在前");
        expect(location.profile?.consistencyRules).not.toBe("按设计 Prompt 保持一致");
    });

    it("does not infer character styling for a location with incomplete profile fields", () => {
        const source = structuredClone(productionPackage);
        source.assets.locations = [{ code: "S01", name: "黑湖记忆", description: "无风黑湖、倒悬古塔、雪地边界" }];

        const location = previewDramaProductionPackage(JSON.stringify(source), "package.json").package.assets.locations[0];
        expect(location.profile?.styling).not.toContain("发型");
        expect(location.profile?.styling).not.toContain("服装");
        expect(location.profile?.styling).toContain("陈设");
    });

    it("keeps carried prop states identical across split director shots", () => {
        const episode = previewDramaProductionPackage(JSON.stringify(productionPackage), "package.json").package.episodes[0];
        const shots = new Map(episode.shots.map((shot) => [shot.code, shot]));

        for (const edge of episode.continuityEdges) {
            const from = shots.get(edge.fromShotCode);
            const to = shots.get(edge.toShotCode);
            if (!from || !to) continue;
            for (const propCode of edge.carryPropIds) {
                const left = from.exitState?.props.find((item) => item.assetId === propCode);
                const right = to.entryState?.props.find((item) => item.assetId === propCode);
                expect(right).toMatchObject({ assetId: propCode, state: left?.state, holderId: left?.holderId });
            }
        }
    });

    it("derives every split shot entry from the previous exit without retaining prompt facts", () => {
        const episode = previewDramaProductionPackage(JSON.stringify(productionPackage), "package.json").package.episodes[0];
        const splitShots = episode.shots.filter((shot) => /\d+\/\d+$/.test(shot.title));

        for (let index = 1; index < splitShots.length; index += 1) {
            const previous = splitShots[index - 1];
            const current = splitShots[index];
            if (current.framePlan.start.source !== "previous_accepted_actual_tail") continue;
            expect(current.entryState).toEqual(previous.exitState);
            expect(current.startFramePrompt).toBeUndefined();
            expect(current.endFramePrompt).toBeUndefined();
        }
    });

    it("normalizes an incompatible carried entry state before package output", () => {
        const inconsistent = structuredClone(productionPackage);
        const entryState = inconsistent.episodes[0].shots[1].entryState!;
        inconsistent.episodes[0].shots[1].entryState = {
            ...entryState,
            props: [{ assetId: "P01", state: "错误的持有状态", holderId: "C02" }],
        };
        const normalized = previewDramaProductionPackage(JSON.stringify(inconsistent), "package.json").package.episodes[0];
        const previous = normalized.shots[0].exitState?.props.find((item) => item.assetId === "P01");
        const next = normalized.shots[1].entryState?.props.find((item) => item.assetId === "P01");
        expect(next).toMatchObject({ assetId: "P01", state: previous?.state, holderId: previous?.holderId });
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
        expect(second).toMatchObject({ style: DRAMA_STYLE_NAME, productionBible: { visualStyle: DRAMA_STYLE_NAME, colorScript: DRAMA_STYLE_COLOR_SCRIPT } });
        expect(second.episodes[0].shots[0].id).toBe(shotId);
        expect(second.episodes[0].storyScenes?.[0].shotIds).toEqual([shotId, second.episodes[0].shots[1].id]);
        expect(second.episodes[0].continuityEdges?.[0]).toMatchObject({ fromShotId: shotId, toShotId: second.episodes[0].shots[1].id, inheritActualEndFrame: true });
        expect(second.sourceAssets?.at(-1)).toMatchObject({ type: "text", title: "制作包 package.json", textContent: "hash-two" });
        expect(second.episodes[0].reviewStatus).toBe("visual_ready");
        expect(second.productionArchive).toEqual(productionPackage.archive);
    });

    it("remaps reference manifest codes to stable project and shot ids", () => {
        const source = structuredClone(productionPackage);
        source.episodes[0].shots[0].framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: source.episodes[0].shots[0].framePlan.frames,
            referenceManifest: [
                { alias: "@图片1", role: "character_anchor", purpose: "角色基准图", assetId: "C01" },
                { alias: "@图片2", role: "scene_anchor", purpose: "场景基准图", assetId: "S01" },
                { alias: "@图片3", role: "action_keyframe", purpose: "动作关键帧", shotId: "SH01" },
            ],
        };
        const applied = applyDramaProductionPackage(project(), source, "hash-manifest");
        const shot = applied.episodes[0].shots[0];
        const karinId = applied.characters.find((item) => item.name === "Karin")!.id;
        const sceneId = applied.scenes.find((item) => item.name === "阿佐雷斯城门")!.id;
        expect(shot.framePlan?.referenceManifest).toMatchObject([
            { assetId: karinId },
            { assetId: sceneId },
            { shotId: shot.id },
        ]);
    });

    it("round-trips structured review fields from the package into the project", () => {
        const reviewPackage = {
            ...productionPackage,
            episodes: [
                {
                    ...productionPackage.episodes[0],
                    shots: [
                        {
                            ...productionPackage.episodes[0].shots[0],
                            performancePlan: {
                                emotionalObjective: "守住秘密",
                                emotionalArc: "平静到警觉",
                                speechStyle: "低声克制",
                                pace: "慢",
                                breath: "屏息后缓呼",
                                restraintLevel: "克制",
                                beats: {
                                    start: { emotion: "平静", facialAction: "眉眼放松", gaze: "看向门外", bodyAction: "站定" },
                                    middle: { emotion: "警觉", facialAction: "眉心收紧", gaze: "锁定门缝", bodyAction: "肩膀绷紧" },
                                    end: { emotion: "紧张", facialAction: "嘴角压住", gaze: "不移开", bodyAction: "后退半步" },
                                },
                            },
                            dialoguePerformance: [{ utteranceId: "u1", intent: "试探", tone: "压低", pace: "慢", pause: "句中停顿", emphasis: "最后一个字", facialReactionBefore: "抬眉", facialReactionDuring: "盯住对方", facialReactionAfter: "闭口" }],
                            lightingPlan: {
                                palette: "冷灰蓝",
                                colorTemperature: "4200K",
                                keyLight: "左上冷主光",
                                fillLight: "低强度正面补光",
                                rimLight: "背后蓝色轮廓光",
                                contrast: "中高反差",
                                materialResponse: "湿地反射",
                                skinToneProtection: "保留肤色",
                                inheritFromPrevious: "无",
                                transitionToNext: "冷光延续",
                            },
                        },
                    ],
                },
            ],
        } as DramaProductionPackageV1;
        const applied = applyDramaProductionPackage(project(), reviewPackage, "hash-review");
        expect(applied.episodes[0].shots[0]).toMatchObject({
            fieldOrigins: expect.objectContaining({ performancePlan: "package", dialoguePerformance: "package", lightingPlan: "package" }),
            performancePlan: expect.objectContaining({ emotionalObjective: "守住秘密" }),
            lightingPlan: expect.objectContaining({ colorTemperature: "4200K" }),
        });
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
        framePlan: {
            start: { source: order === 1 ? "independent" : "previous_accepted_actual_tail" },
            end: { required: true },
            frames: [{ id: `${code}-frame-1`, sequenceIndex: 1, startSecond: 0, endSecond: 15, actionPrompt: videoPrompt, imagePrompt: `${videoPrompt}画面` }],
        },
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
