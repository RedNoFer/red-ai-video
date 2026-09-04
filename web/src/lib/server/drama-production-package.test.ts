import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type { DramaProductionPackageV1, DramaProject } from "@/lib/drama-project-contract";
import { DRAMA_STYLE_COLOR_SCRIPT, DRAMA_STYLE_NAME } from "@/lib/drama-style";
import { defaultDramaProductionPlan } from "@/lib/drama-production-plan";
import { applyDramaProductionPackage, buildDramaAssetReuseContext, mergeProjectAssetsIntoProductionPackage, previewDramaProductionPackage } from "@/lib/server/drama-production-package";

const productionPackage: DramaProductionPackageV1 = {
    schemaVersion: 1,
    project: {
        title: "四界之心",
        summary: "两个新生进入阿佐雷斯。",
        style: DRAMA_STYLE_NAME,
        ratio: "9:16",
        productionBible: {
            targetPlatform: "Seedance 2.0",
            language: "中文",
            ratio: "9:16",
            targetDuration: 30,
            visualStyle: DRAMA_STYLE_NAME,
            colorScript: DRAMA_STYLE_COLOR_SCRIPT,
            continuityMode: "strict",
            productionPlan: defaultDramaProductionPlan("package"),
        },
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
    it("builds a fixed-asset reuse catalog with stable codes and current-episode usage", () => {
        const current = project();
        current.characters = [{ id: "character-existing", code: "C07", name: "Karin", description: "锁定角色", references: [{ id: "ref-one", label: "角色基准图", url: "https://cdn.example.com/karin.png", source: "generated", status: "approved", createdAt: "2026-01-01" }] }];
        current.scenes = [{ id: "scene-existing", name: "城门", description: "锁定场景" }];
        current.props = [{ id: "prop-existing", name: "断剑", description: "锁定道具" }];
        current.episodes[0] = { ...current.episodes[0], code: "E01", shots: [{ ...shot("SH01", 1, "0-15s", ["C07"], "Karin握住断剑"), characterIds: ["character-existing"], sceneId: "scene-existing", propIds: ["prop-existing"] } as never] };

        const reuse = buildDramaAssetReuseContext(current, current.episodes[0]);

        expect(reuse.rule).toContain("固定资产优先复用");
        expect(reuse.characters[0]).toMatchObject({ code: "C07", id: "character-existing", fixed: true, usedInCurrentEpisode: true, primaryReferenceId: undefined });
        expect(reuse.locations[0]).toMatchObject({ code: "S01", name: "城门", fixed: true, usedInCurrentEpisode: true });
        expect(reuse.props[0]).toMatchObject({ code: "P01", name: "断剑", fixed: true, usedInCurrentEpisode: true });
        expect(reuse.characters[0].references).toEqual([{ id: "ref-one", label: "角色基准图", status: "approved", reviewStatus: undefined }]);
        expect(JSON.stringify(reuse)).not.toContain("https://cdn.example.com/karin.png");
    });

    it("restores omitted project assets and project facts before a package is persisted", () => {
        const current = project();
        current.characters = [{ id: "character-existing", code: "C01", name: "Karin", description: "项目固定描述", profile: { visualIdentity: "固定脸型", styling: "固定服装", colorPalette: "墨绿", consistencyRules: "不可换脸" } }];
        current.scenes = [{ id: "scene-existing", code: "S01", name: "城门", description: "项目固定场景" }];
        const incoming = structuredClone(productionPackage);
        incoming.assets.characters = incoming.assets.characters.filter((asset) => asset.code !== "C01");
        incoming.assets.locations = [];

        const merged = mergeProjectAssetsIntoProductionPackage(incoming, current);

        expect(merged.assets.characters).toEqual(expect.arrayContaining([expect.objectContaining({ code: "C01", name: "Karin", description: "项目固定描述", profile: expect.objectContaining({ visualIdentity: "固定脸型" }) })]));
        expect(merged.assets.locations).toEqual(expect.arrayContaining([expect.objectContaining({ code: "S01", name: "城门", description: "项目固定场景" })]));
    });

    it("restores omitted assets before normalization so shot references are not filtered out", () => {
        const current = project();
        current.characters = [{ id: "character-existing", code: "C01", name: "Karin", description: "项目固定角色" }];
        current.scenes = [{ id: "scene-existing", code: "S01", name: "城门", description: "项目固定场景" }];
        const incoming = structuredClone(productionPackage);
        incoming.assets.characters = incoming.assets.characters.filter((asset) => asset.code !== "C01");
        incoming.assets.locations = [];
        incoming.episodes[0].shots[0].characterCodes = ["C01"];
        incoming.episodes[0].shots[0].locationCode = "S01";

        const preview = previewDramaProductionPackage(JSON.stringify(incoming), "package.json", current);

        expect(preview.package.episodes[0].shots[0].characterCodes).toEqual(["C01"]);
        expect(preview.package.episodes[0].shots[0].locationCode).toBe("S01");
    });

    it("matches legacy project assets by name before allocating fallback codes", () => {
        const current = project();
        current.characters = [
            { id: "character-a", name: "A", description: "项目 A" },
            { id: "character-b", name: "B", description: "项目 B" },
        ];
        const incoming = structuredClone(productionPackage);
        incoming.assets.characters = [
            { code: "C01", name: "B", description: "Agent B" },
            { code: "C02", name: "A", description: "Agent A" },
        ];

        const merged = mergeProjectAssetsIntoProductionPackage(incoming, current);

        expect(merged.assets.characters).toEqual(expect.arrayContaining([expect.objectContaining({ code: "C01", name: "A", description: "项目 A" }), expect.objectContaining({ code: "C02", name: "B", description: "项目 B" })]));
    });

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

    it("preserves Agent video prompt text while normalizing static fields", () => {
        const source = structuredClone(productionPackage);
        source.episodes[0].shots[0].imagePrompt = "静态关键帧：Karin握住断剑；可见状态：指节发白，景别：中景；机位与构图：平视";
        source.episodes[0].shots[0].videoPrompt = "动态意图：Karin抬头；单一主运镜：固定机位；结束画面：视线锁定断剑";
        source.archive = {
            formatVersion: "vozeb-drama-production-package-v1",
            sections: [],
            promptAssets: [{ code: "P01", category: "keyframe", title: "关键帧", prompt: "静态关键帧：Karin握剑；景别：中景", shotCodes: ["SH01"] }],
            dialogueDirections: [],
            voiceDirections: [],
            silenceDirections: [],
            referencePlan: [],
            generationOrder: [],
            qcReport: "",
        };

        const normalized = previewDramaProductionPackage(JSON.stringify(source), "package.json").package;
        expect(normalized.episodes[0].shots[0].imagePrompt).toContain("可见状态：指节发白\n景别：中景");
        expect(normalized.episodes[0].shots[0].videoPrompt).toBe("动态意图：Karin抬头；单一主运镜：固定机位；结束画面：视线锁定断剑");
        expect(normalized.archive?.promptAssets[0]?.prompt).toBe("静态关键帧：Karin握剑\n景别：中景");
    });

    it("deduplicates package assets by stable code before preview and apply", () => {
        const source = structuredClone(productionPackage);
        source.assets.characters.push({ code: "C01", name: "Karin", description: "重复记录" });
        source.assets.props.push({ code: "P01", name: "断剑", description: "重复记录" });
        const preview = previewDramaProductionPackage(JSON.stringify(source), "package.json");
        console.log("DEBUG SCENE", preview.package.episodes[0].storyScenes);
        expect(preview.package.assets.characters).toHaveLength(2);
        expect(preview.package.assets.props).toHaveLength(1);
        expect(preview.package.assets.characters.find((item) => item.code === "C01")?.description).toBe("重复记录");
    });

    it("preserves all-frames storyboard mode from an imported package", () => {
        const source = structuredClone(productionPackage);
        source.episodes[0].shots[0].storyboardFrameMode = "all_frames";
        const preview = previewDramaProductionPackage(JSON.stringify(source), "package.json");
        console.log(
            "DEBUG",
            preview.package.project.productionBible.productionPlan?.video,
            preview.package.episodes[0].shots.map((shot) => ({ title: shot.title, duration: shot.duration, scene: shot.storySceneCode, location: shot.locationCode })),
        );
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

    it("rejects a package that omits explicit frame beats", () => {
        const source = structuredClone(productionPackage);
        source.episodes[0].shots[0].framePlan = { start: { source: "independent" }, end: { required: true }, frames: [] };
        expect(() => previewDramaProductionPackage(JSON.stringify(source), "package.json")).toThrow("缺少逐帧计划");
    });

    it("keeps split shot durations and timecodes integer and continuous", () => {
        const source = structuredClone(productionPackage);
        source.episodes[0].shots[0].duration = 2;
        source.episodes[0].shots[0].timecode = "0-2s";
        source.episodes[0].shots[0].framePlan.frames = [{ ...source.episodes[0].shots[0].framePlan.frames[0], startSecond: 0, endSecond: 2 }];
        const preview = previewDramaProductionPackage(JSON.stringify(source), "package.json");
        const shots = preview.package.episodes[0].shots;
        expect(shots.every((shot) => Number.isInteger(shot.duration))).toBe(true);
        expect(shots.flatMap((shot) => shot.framePlan.frames).every((frame) => Number.isFinite(frame.startSecond) && Number.isFinite(frame.endSecond))).toBe(true);
    });

    it("merges contiguous 8s and 7s fragments into one 15s logical shot", () => {
        const source = structuredClone(productionPackage);
        source.assets.locations.push({ code: "S02", name: "马车", description: "封闭木马车" });
        const [first, second] = source.episodes[0].shots;
        first.title = "黑湖记忆 1/2";
        second.title = "黑湖记忆 2/2";
        first.description = "黑湖中的完整剑刃裂开";
        second.description = "马车中Karin惊醒";
        first.sourceText = first.description;
        second.sourceText = second.description;
        first.duration = 8;
        second.duration = 7;
        first.timecode = "0-8s";
        second.timecode = "8-15s";
        first.storySceneCode = "SC01";
        second.storySceneCode = "SC01";
        first.locationCode = "S02";
        second.locationCode = "S02";
        first.framePlan.referenceManifest = first.framePlan.referenceManifest?.map((item) => (item.role === "scene_anchor" ? { ...item, assetId: "S02" } : item));
        second.framePlan.referenceManifest = second.framePlan.referenceManifest?.map((item) => (item.role === "scene_anchor" ? { ...item, assetId: "S02" } : item));
        second.framePlan.referenceManifest = [...(second.framePlan.referenceManifest || []).filter((item) => item.role !== "scene_anchor"), { alias: "@场景2", role: "scene_anchor", purpose: "马车场景基准", assetId: "S02" }];
        first.framePlan.frames = first.framePlan.frames.map((frame) => ({ ...frame, startSecond: 0, endSecond: 8 }));
        second.framePlan.frames = second.framePlan.frames.map((frame) => ({ ...frame, startSecond: 0, endSecond: 7 }));
        source.episodes[0].storyScenes[0].shotCodes = ["SH01", "SH02"];
        const preview = previewDramaProductionPackage(JSON.stringify(source), "package.json");
        expect(preview.package.episodes[0].shots).toHaveLength(1);
        expect(preview.package.episodes[0].shots[0]).toMatchObject({ duration: 15, timecode: "0-15s", title: "黑湖记忆" });
        expect(preview.package.episodes[0].shots[0].framePlan.frames.at(-1)?.endSecond).toBe(15);
        expect(preview.package.episodes[0].storyScenes[0].shotCodes).toEqual(["SH001"]);
        expect(preview.package.assets.characters.map((asset) => asset.code)).toEqual(["C01", "C02"]);
    });

    it("does not merge duration fragments across a scene change", () => {
        const source = structuredClone(productionPackage);
        source.assets.locations.push({ code: "S02", name: "马车", description: "封闭木马车" });
        const [first, second] = source.episodes[0].shots;
        first.title = "黑湖记忆 1/2";
        second.title = "黑湖记忆 2/2";
        first.description = "黑湖中的完整剑刃裂开";
        second.description = "马车中Karin惊醒";
        first.sourceText = first.description;
        second.sourceText = second.description;
        first.duration = 8;
        second.duration = 7;
        first.timecode = "0-8s";
        second.timecode = "8-15s";
        first.storySceneCode = "SC01";
        second.storySceneCode = "SC01";
        first.locationCode = "S01";
        second.locationCode = "S02";
        second.framePlan.referenceManifest = second.framePlan.referenceManifest?.map((item) => (item.role === "scene_anchor" ? { ...item, assetId: "S02" } : item));
        first.framePlan.frames = first.framePlan.frames.map((frame) => ({ ...frame, startSecond: 0, endSecond: 8 }));
        second.framePlan.frames = second.framePlan.frames.map((frame) => ({ ...frame, startSecond: 0, endSecond: 7 }));
        source.episodes[0].storyScenes[0].shotCodes = ["SH01", "SH02"];

        const preview = previewDramaProductionPackage(JSON.stringify(source), "package.json");
        expect(preview.package.episodes[0].shots).toHaveLength(2);
        expect(preview.package.episodes[0].shots.map((shot) => shot.locationCode)).toEqual(["S01", "S02"]);
    });

    it("recognizes the generated multiframe Markdown package", () => {
        const source = readFileSync(new URL("../../../../output/mahadel-episode-01-production-package-v2-multiframe.md", import.meta.url), "utf8");
        const preview = previewDramaProductionPackage(source, "mahadel-episode-01-production-package-v2-multiframe.md");
        expect(preview.package.schemaVersion).toBe(1);
        expect(preview.package.project.productionBible.productionPlan?.video.mode).toBe("storyboard");
        expect(preview.package.project.productionBible.productionPlan?.video.shotDuration).toBe(15);
        expect(preview.package.episodes[0].shots.every((shot) => shot.storyboardFrameMode === "all_frames")).toBe(true);
        expect(preview.package.episodes[0].shots).toHaveLength(12);
        expect(preview.package.episodes[0].shots.every((shot) => shot.duration === 15)).toBe(true);
        expect(preview.package.episodes[0].shots[0].title).toBe("黑湖记忆");
        expect(preview.package.episodes[0].shots[1].title).toBe("梦醒试探");
        expect(preview.package.episodes[0].shots[1].framePlan?.start.source).toBe("previous_accepted_actual_tail");
        expect(preview.package.episodes[0].shots[0].framePlan?.frames[0].imagePrompt).toContain("黑湖无波");
        expect(preview.package.episodes[0].shots[0].framePlan?.frames.at(-1)?.imagePrompt).toContain("完全惊醒");
    });

    it("keeps the generated package prompts split into static frames and motion intent", () => {
        const source = JSON.parse(readFileSync(new URL("../../../../output/mahadel-episode-01-production-package-v2-multiframe.json", import.meta.url), "utf8")) as DramaProductionPackageV1;
        const movement = /运镜|焦段|推近|拉远|摇镜|跟拍|滑轨|环绕|吊臂|慢推|慢拉|后拉/u;
        const nonVisual = /\b\d+(?:\.\d+)?s\b|时间段|时间轴|动作过程|对白|声音|口型/u;
        for (const shot of source.episodes[0].shots) {
            expect(shot.imagePrompt).not.toMatch(movement);
            expect(shot.imagePrompt).not.toMatch(nonVisual);
            expect(shot.videoPrompt).toContain("起始可见状态");
            expect(shot.videoPrompt).toContain("一个主运镜");
            expect(shot.videoPrompt).toContain("结束画面");
            expect((shot.videoPrompt.match(/一个主运镜：/gu) || []).length).toBe(1);
            expect(shot.videoPrompt).not.toMatch(/本内部|assetId|参考图清单|URL/u);
            for (const frame of shot.framePlan.frames) {
                expect(frame.imagePrompt).not.toMatch(movement);
                expect(frame.imagePrompt).not.toMatch(nonVisual);
            }
        }
    });

    it("binds each generated shot to its declared scene, characters, props, and visible performance state", () => {
        const source = readFileSync(new URL("../../../../output/mahadel-episode-01-production-package-v2-multiframe.md", import.meta.url), "utf8");
        const normalized = previewDramaProductionPackage(source, "mahadel-episode-01-production-package-v2-multiframe.md").package;
        for (const shot of normalized.episodes[0].shots) {
            const manifest = shot.framePlan.referenceManifest || [];
            expect(manifest.find((item) => item.role === "scene_anchor")?.assetId).toBe(shot.locationCode);
            for (const code of shot.characterCodes) expect(manifest.some((item) => item.role === "character_anchor" && item.assetId === code)).toBe(true);
            for (const code of shot.propCodes) expect(manifest.some((item) => item.role === "prop_anchor" && item.assetId === code)).toBe(true);
            expect(shot.framePlan.frames.every((frame) => /(?:表情|眉眼|眼神|视线|手部|道具|姿态)/u.test(frame.imagePrompt))).toBe(true);
        }
    });

    it("keeps every split Mahadel frame executable for its own segment", () => {
        const source = readFileSync(new URL("../../../../output/mahadel-episode-01-production-package-v2-multiframe.md", import.meta.url), "utf8");
        const shots = previewDramaProductionPackage(source, "mahadel-episode-01-production-package-v2-multiframe.md").package.episodes[0].shots.slice(0, 5);
        const plans = shots.map((shot) => JSON.stringify(shot.framePlan.frames.map((frame) => [frame.actionPrompt, frame.imagePrompt])));

        expect(new Set(plans)).toHaveLength(plans.length);
    });

    it("gives every generated Mahadel frame a distinct dynamic image state", () => {
        const source = readFileSync(new URL("../../../../output/mahadel-episode-01-production-package-v2-multiframe.json", import.meta.url), "utf8");
        const shots = previewDramaProductionPackage(source, "mahadel-episode-01-production-package-v2-multiframe.json").package.episodes[0].shots;

        for (const shot of shots) {
            const prompts = shot.framePlan.frames.map((frame) => frame.imagePrompt);
            const states = prompts.map((prompt) => prompt.match(/^静态关键帧：([^；]+)/u)?.[1] || prompt);
            expect(new Set(prompts)).toHaveLength(prompts.length);
            expect(new Set(states)).toHaveLength(states.length);
        }
    });

    it("rejects a copied frame plan across split director shots", () => {
        const source = structuredClone(productionPackage);
        const [first, second] = source.episodes[0].shots;
        first.title = "同一场景 1/2";
        second.title = "同一场景 2/2";
        second.description = first.description;
        second.sourceText = first.sourceText;
        second.imagePrompt = first.imagePrompt;
        second.videoPrompt = first.videoPrompt;
        second.continuity = structuredClone(first.continuity);
        second.framePlan.frames = structuredClone(first.framePlan.frames);

        expect(() => previewDramaProductionPackage(JSON.stringify(source), "package.json")).toThrow("同一场景的拆分镜头复用了整套逐帧计划");
    });

    it("uses the embedded canonical object when Markdown tables are stale", () => {
        const canonical = structuredClone(productionPackage);
        canonical.episodes[0].shots[1].duration = 8;
        canonical.episodes[0].shots[1].timecode = "15-23s";
        canonical.episodes[0].shots[1].framePlan.frames = canonical.episodes[0].shots[1].framePlan.frames.map((frame, index, frames) => ({
            ...frame,
            startSecond: (8 * index) / frames.length,
            endSecond: (8 * (index + 1)) / frames.length,
        }));
        const source = [
            "# 《测试制作包》",
            "",
            "## 四、镜头执行表",
            "| 镜头 | 时间码 | 功能 | 景别 | 运动 | 镜头 | 灯光 | 色彩 | 转场 | 画面 | 动作结果 |",
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
            "| SH02 | 15-22.5s | 旧表格 | CU | 固定 | 50mm | 冷光 | 蓝灰 | 硬切 | 旧画面 | 旧结果 |",
            "",
            "```drama-production-package",
            JSON.stringify(canonical),
            "```",
        ].join("\n");

        const preview = previewDramaProductionPackage(source, "package.md");
        expect(preview.package.episodes[0].shots[1].duration).toBe(8);
        expect(preview.package.episodes[0].shots[1].timecode).toBe("15-23s");
    });

    it("preserves the complete Agent video prompt in package videoPrompt", () => {
        const source = structuredClone(productionPackage);
        source.episodes[0].shots[0].videoPrompt = "生成15秒9:16竖屏电影级视频。角色抬手后停住";

        const shot = previewDramaProductionPackage(JSON.stringify(source), "package.json").package.episodes[0].shots[0];

        expect(shot.videoPrompt).toBe("生成15秒9:16竖屏电影级视频。角色抬手后停住");
    });

    it("upgrades repetitive frame image prompts into independent visual states", () => {
        const source = structuredClone(productionPackage);
        const shot = source.episodes[0].shots[0];
        shot.framePlan.frames = [
            { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 7.5, actionPrompt: "Karin低头站在黑湖边", imagePrompt: "黑湖、倒塔，9:16安全构图。当前时段动作锚点：Karin低头站在黑湖边。保持角色身份、服装、道具、场景结构与上一帧连续。" },
            { id: "f2", sequenceIndex: 2, startSecond: 7.5, endSecond: 15, actionPrompt: "Karin抬眼看向倒悬高塔", imagePrompt: "黑湖、倒塔，9:16安全构图。当前时段动作锚点：Karin抬眼看向倒悬高塔。保持角色身份、服装、道具、场景结构与上一帧连续。" },
        ];
        const frames = previewDramaProductionPackage(JSON.stringify(source), "package.json").package.episodes[0].shots[0].framePlan.frames;
        expect(frames[0].imagePrompt).toContain("静态关键帧：Karin低头站在黑湖边");
        expect(frames[1].imagePrompt).toContain("静态关键帧：Karin抬眼看向倒悬高塔");
        expect(frames[0].imagePrompt).not.toContain("当前时段动作锚点");
        expect(frames[0].imagePrompt).not.toBe(frames[1].imagePrompt);
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
        source.assets.locations = [
            {
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
            },
        ];

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

    it("preserves an imported package visual style instead of replacing it with the app default", () => {
        const importedStyle = "VS14 中世纪史诗的学院奇幻变体；宏大空间与克制人物近景并重，不使用现代元素或科幻 UI。";
        const imported = structuredClone(productionPackage);
        imported.project.style = importedStyle;
        imported.project.productionBible.visualStyle = importedStyle;

        const applied = applyDramaProductionPackage(project(), imported, "hash-custom-style");

        expect(applied.style).toBe(importedStyle);
        expect(applied.productionBible?.visualStyle).toBe(importedStyle);
        expect(applied.productionBible?.colorScript).toBeUndefined();
    });

    it("replaces legacy manual frame plans when importing a newly structured package", () => {
        const first = applyDramaProductionPackage(project(), productionPackage, "hash-legacy-frame");
        const legacyShot = first.episodes[0].shots[0];
        const legacy: DramaProject = {
            ...first,
            episodes: [
                {
                    ...first.episodes[0],
                    shots: [
                        {
                            ...legacyShot,
                            fieldOrigins: { ...legacyShot.fieldOrigins, framePlan: "manual" },
                            framePlan: {
                                ...legacyShot.framePlan!,
                                frames: legacyShot.framePlan!.frames.map((frame) => ({ ...frame, supplierPrompt: "静态画面：旧版长提示词；主体锚点：历史文本" })),
                            },
                        },
                        ...first.episodes[0].shots.slice(1),
                    ],
                },
            ],
        };
        const imported = applyDramaProductionPackage(legacy, productionPackage, "hash-new-frame");
        const prompt = imported.episodes[0].shots[0].framePlan!.frames[0].imagePrompt;
        expect(prompt).toContain("静态关键帧：");
        expect(prompt).toContain("机位与构图：");
        expect(prompt).toContain("光色与风格：");
        expect(prompt).not.toContain("旧版长提示词");
    });

    it("rebuilds old static prompts that contain reference duties on package import", () => {
        const legacy = structuredClone(productionPackage);
        legacy.episodes[0].shots[0].framePlan.frames[0].imagePrompt = "静态关键帧：旧画面；可见状态：手握断剑；可见表演状态：警觉；景别：中景；机位与构图：平视；站位与视线：看向断剑；三层空间：背景古塔；光色与风格：冷光；参考图职责：沿用旧绑定；负面约束：无水印";

        const imported = previewDramaProductionPackage(JSON.stringify(legacy), "package.json").package;
        const prompt = imported.episodes[0].shots[0].framePlan.frames[0].imagePrompt;

        expect(prompt.split("\n")).toHaveLength(9);
        expect(prompt).not.toContain("参考图职责：");
        expect(prompt).toContain("静态关键帧：梦中惊醒");
    });

    it("allows a regenerated package to be identified and applied again", () => {
        const first = applyDramaProductionPackage(project(), productionPackage, "hash-regenerated");
        const second = applyDramaProductionPackage(first, productionPackage, "hash-regenerated");

        expect(second.characters.map((item) => item.id)).toEqual(first.characters.map((item) => item.id));
        expect(second.episodes[0].shots.map((item) => item.id)).toEqual(first.episodes[0].shots.map((item) => item.id));
        expect(second.sourceAssets?.filter((asset) => asset.id === "source-package-hash-regenerated")).toHaveLength(1);
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
                { alias: "@图片4", role: "prop_anchor", purpose: "道具基准图", assetId: "P01" },
            ],
        };
        const applied = applyDramaProductionPackage(project(), source, "hash-manifest");
        const shot = applied.episodes[0].shots[0];
        const karinId = applied.characters.find((item) => item.name === "Karin")!.id;
        const sceneId = applied.scenes.find((item) => item.name === "阿佐雷斯城门")!.id;
        expect(shot.framePlan?.referenceManifest).toEqual(expect.arrayContaining([expect.objectContaining({ assetId: karinId }), expect.objectContaining({ assetId: sceneId }), expect.objectContaining({ shotId: shot.id })]));
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
            referenceManifest: [
                ...characterCodes.map((assetId) => ({ alias: `@${assetId}`, role: "character_anchor" as const, purpose: "角色基准图", assetId })),
                { alias: "@场景", role: "scene_anchor" as const, purpose: "场景基准图", assetId: "S01" },
                { alias: "@道具", role: "prop_anchor" as const, purpose: "道具基准图", assetId: "P01" },
            ],
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
