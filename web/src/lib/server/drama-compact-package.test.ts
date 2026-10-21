import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { DramaProject, DramaShot } from "@/lib/drama-project-contract";
import { buildDramaProductionRun } from "./drama-production-run";
import { applyDramaCompactPackage, DramaCompactPackageError, parseDramaCompactPackage, previewDramaCompactPackage } from "./drama-compact-package";

const source = [
    "# 精简制作包",
    "## 固定资产",
    "### 角色 CHAR_01｜林雪",
    "#### 图片提示词",
    "~~~text",
    "新角色外貌提示词",
    "~~~",
    "### 场景 LOC_01｜旧书房",
    "#### 图片提示词",
    "~~~text",
    "后左门、右窗、中央木桌，9:16 单视角全景",
    "~~~",
    "## 剧集 E01｜零公里",
    "### 小说原文",
    "~~~text",
    "第一段。",
    "\n第二段，原文不改。",
    "~~~",
    "### 片段 SH01｜15秒｜取下铁盒",
    "角色：CHAR_01",
    "场景：LOC_01",
    "#### 章节文案",
    "~~~text",
    "林雪推门进屋，桌上旧信未收。",
    "~~~",
    "#### 视频提示词",
    "~~~text",
    "原样保留的画面与对白。\n第二行。",
    "~~~",
].join("\n");

const referenceSource = source.replace("原样保留的画面与对白。\n第二行。", "【参考】CHAR_01=林雪主外观与服装锁定；LOC_01=旧书房清晨光线。\n参考仅提供外观与空间基准职责，不含上传图片编号。\n\n保持CHAR_01形象不漂移。\n原样保留的画面与对白。");

function project(): DramaProject {
    const shot: DramaShot = {
        id: "shot-original",
        code: "SH01",
        order: 1,
        title: "旧标题",
        description: "旧审核描述",
        sourceText: "旧来源",
        shotBoundary: "",
        dialogue: "旧对白",
        narration: "",
        utterances: [],
        imagePrompt: "旧静帧",
        videoPrompt: "旧视频提示词",
        cameraMotion: "",
        duration: 15,
        characterIds: ["character-old"],
        sceneId: "scene-old",
        propIds: [],
        clueIds: [],
        videoMode: "storyboard",
        storyboardStatus: "success",
        storyboardImageUrl: "/old-frame.png",
        generationStatus: "success",
        videoUrl: "/old-video.mp4",
        framePlan: { start: { source: "independent" }, end: { required: true }, frames: [{ id: "old-frame", sequenceIndex: 1, startSecond: 0, endSecond: 15, actionPrompt: "旧动作", imagePrompt: "旧画面" }] },
    };
    return {
        id: "project",
        title: "项目",
        summary: "",
        style: "写实",
        ratio: "9:16",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        defaultVideoMode: "storyboard",
        activeEpisodeId: "episode-original",
        sourceAssets: [],
        characters: [
            {
                id: "character-old",
                code: "OLD_C",
                name: "林雪",
                description: "固定身份",
                supplierPrompt: "已确认的旧基准提示词",
                profile: { visualIdentity: "长脸杏眼", styling: "墨灰夹克", colorPalette: "灰", consistencyRules: "脸不变" },
                references: [{ id: "reference-old", url: "/asset.png", source: "generated", label: "主基准", createdAt: "2026-01-01T00:00:00.000Z", status: "approved" }],
                primaryReferenceId: "reference-old",
            },
        ],
        scenes: [{ id: "scene-old", code: "OLD_L", name: "旧书房", description: "左门右窗", supplierPrompt: "旧场景提示词" }],
        props: [],
        clues: [],
        episodes: [
            {
                id: "episode-original",
                code: "E01",
                title: "原集",
                script: "旧稿",
                outline: "旧大纲",
                hook: "",
                nextPreview: "",
                sourceRange: "",
                reviewStatus: "visual_ready",
                storyScenes: [{ id: "old-scene", order: 1, title: "旧场次", summary: "", shotIds: [shot.id] }],
                continuityEdges: [],
                shots: [shot],
            },
        ],
    };
}

describe("compact drama package", () => {
    it("keeps the downloadable Markdown template parseable", () => {
        const template = readFileSync(new URL("../../../public/drama-compact-package-template.md", import.meta.url), "utf8");
        const parsed = parseDramaCompactPackage(template);
        expect(parsed.episodes).toHaveLength(1);
        expect(parsed.episodes[0].shots).toHaveLength(1);
    });

    it("imports original prose and core shot bindings while reusing confirmed assets and old media", () => {
        const before = project();
        const preview = previewDramaCompactPackage(source, before);
        expect(preview.summary).toMatchObject({ assetsReused: 2, shotsUpdated: 1, oldResultsToReview: 1 });
        const after = applyDramaCompactPackage(before, source, "book.md");
        const episode = after.episodes[0];
        const shot = episode.shots[0];
        expect(episode).toMatchObject({ id: "episode-original", script: "第一段。\n\n第二段，原文不改。", reviewStatus: "draft", storyScenes: [], continuityEdges: [] });
        expect(shot).toMatchObject({
            id: "shot-original",
            description: "林雪推门进屋，桌上旧信未收。",
            videoPrompt: "原样保留的画面与对白。\n第二行。",
            imagePrompt: "",
            characterIds: ["character-old"],
            sceneId: "scene-old",
            videoMode: "direct",
            videoUrl: "/old-video.mp4",
            generationStatus: "stale",
            storyboardImageUrl: "/old-frame.png",
            storyboardStatus: "stale",
        });
        expect(shot.framePlan).toBeUndefined();
        expect(shot.executionVideoPrompt).toBeUndefined();
        expect(after.characters[0]).toMatchObject({ id: "character-old", supplierPrompt: "已确认的旧基准提示词", primaryReferenceId: "reference-old", references: [{ id: "reference-old" }] });
        expect(after.scenes[0].supplierPrompt).toBe("旧场景提示词");
        expect(before.episodes[0].shots[0].videoPrompt).toBe("旧视频提示词");
    });

    it("plans a direct video step without requiring storyboard frames", () => {
        const imported = applyDramaCompactPackage(project(), source, "book.md");
        const run = buildDramaProductionRun(imported, imported.episodes[0], { imageModel: "image", videoModel: "video" });
        expect(run.steps.some((step) => ["start_frame", "end_frame", "keyframe"].includes(step.type))).toBe(false);
        expect(run.steps.find((step) => step.type === "video")?.prompt).toContain("原样保留的画面与对白。\n第二行。");
        expect(run.steps.find((step) => step.type === "video")?.prompt).toContain("@图片1：角色「林雪」");
    });

    it("falls back shot description to the episode prose when the copy block is omitted", () => {
        const withoutCopy = source.slice(0, source.indexOf("#### 章节文案")) + source.slice(source.indexOf("#### 视频提示词"));
        const after = applyDramaCompactPackage(project(), withoutCopy, "book.md");
        expect(after.episodes[0].shots[0].description).toBe("");
        expect(after.episodes[0].script).toBe("第一段。\n\n第二段，原文不改。");
    });

    it("rejects broken shot bindings before applying any change", () => {
        expect(() => previewDramaCompactPackage(source.replace("角色：CHAR_01", "角色：LOC_01"), project())).toThrow(DramaCompactPackageError);
        expect(() => previewDramaCompactPackage(source.replace("15秒", "0秒"), project())).toThrow(DramaCompactPackageError);
    });

    it("extracts 【参考】 facts, strips them from the public prompt, and binds shot reference intents", () => {
        const before = project();
        const preview = previewDramaCompactPackage(referenceSource, before);
        expect(preview.warnings.filter((warning) => warning.includes("【参考】"))).toEqual([]);
        const after = applyDramaCompactPackage(before, referenceSource, "book.md");
        const shot = after.episodes[0].shots[0];
        expect(shot.videoPrompt).toBe("保持林雪形象不漂移。\n原样保留的画面与对白。");
        expect(shot.referenceIntents).toEqual([
            { assetId: "character-old", code: "CHAR_01", role: "character_anchor", guidance: "林雪主外观与服装锁定" },
            { assetId: "scene-old", code: "LOC_01", role: "scene_anchor", guidance: "旧书房清晨光线" },
        ]);
    });

    it("keeps shots without reference blocks unchanged and still binds intents for the previous shot layout", () => {
        const after = applyDramaCompactPackage(project(), source, "book.md");
        expect(after.episodes[0].shots[0].videoPrompt).toBe("原样保留的画面与对白。\n第二行。");
        expect(after.episodes[0].shots[0].referenceIntents).toBeUndefined();
    });

    it("rejects unknown or mismatched 【参考】 codes before applying", () => {
        expect(() => applyDramaCompactPackage(project(), referenceSource.replace("CHAR_01=林雪主外观与服装锁定", "CHAR_09=未知角色主外观"), "book.md")).toThrow(/CHAR_09/);
        const mismatched = source.replace("### 场景 LOC_01｜旧书房", "### 场景 CHAR_02｜旧书房").replace("场景：LOC_01", "场景：CHAR_02").replace("原样保留的画面与对白。", "【参考】CHAR_02=旧书房清晨光线。\n原样保留的画面与对白。");
        expect(() => applyDramaCompactPackage(project(), mismatched, "book.md")).toThrow(/资产类型不符/);
    });

    it("warns when a reference fact names an asset the shot binding lines never declare", () => {
        const withProp = source
            .replace("### 场景 LOC_01｜旧书房", "### 道具 PROP_01｜旧铁盒\n#### 图片提示词\n~~~text\n旧铁盒基础态提示词\n~~~\n### 场景 LOC_01｜旧书房")
            .replace("原样保留的画面与对白。", "【参考】PROP_01=旧铁盒基础态（无银纹）。\n原样保留的画面与对白。");
        const preview = previewDramaCompactPackage(withProp, project());
        expect(preview.warnings.some((warning) => warning.includes("PROP_01") && warning.includes("未在本片段绑定行声明"))).toBe(true);
        const after = applyDramaCompactPackage(project(), withProp, "book.md");
        const intents = after.episodes[0].shots[0].referenceIntents || [];
        expect(intents).toHaveLength(1);
        expect(intents[0]).toMatchObject({ code: "PROP_01", role: "prop_anchor", guidance: "旧铁盒基础态（无银纹）" });
    });
});
