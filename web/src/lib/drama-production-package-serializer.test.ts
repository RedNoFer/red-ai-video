import { describe, expect, it } from "vitest";

import type { DramaProductionPackageV1 } from "@/lib/drama-project-contract";
import { serializeDramaProductionPackageJson, serializeDramaProductionPackageMarkdown } from "@/lib/drama-production-package-serializer";
import { defaultDramaProductionPlan } from "@/lib/drama-production-plan";
import { previewDramaProductionPackage } from "@/lib/server/drama-production-package";

describe("drama production package serialization", () => {
    it("round-trips JSON and deterministic Markdown from the same canonical object", () => {
        const value = previewDramaProductionPackage(JSON.stringify(fixture()), "package.json").package;
        const jsonPackage = previewDramaProductionPackage(serializeDramaProductionPackageJson(value), "package.json").package;
        expect(jsonPackage).toMatchObject({ schemaVersion: value.schemaVersion, project: value.project, assets: value.assets });
        expect(jsonPackage.episodes[0].shots[0].framePlan.frames[0].imagePrompt).toContain("机位与构图：");
        const markdownPackage = previewDramaProductionPackage(serializeDramaProductionPackageMarkdown(value), "package.md").package;
        expect(markdownPackage).toMatchObject({ schemaVersion: value.schemaVersion, project: value.project, assets: value.assets });
        const markdownPrompt = markdownPackage.episodes[0].shots[0].framePlan.frames[0].imagePrompt;
        expect(markdownPrompt).toContain("静态关键帧：");
        expect(markdownPrompt).toContain("机位与构图：");
        expect(markdownPrompt).not.toContain("参考图职责：");
    });

    it("rebuilds exported video prompts from the canonical frame timeline", () => {
        const value = fixture();
        value.episodes[0].shots[0].videoPrompt = "生成15秒9:16竖屏电影级视频。角色站立";
        value.episodes[0].shots[0].framePlan.frames = [
            { id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "角色停住", imagePrompt: "角色停住" },
            { id: "frame-two", sequenceIndex: 2, startSecond: 2, endSecond: 6, actionPrompt: "角色抬头", imagePrompt: "角色抬头" },
        ];
        value.archive!.sections = [{ code: "SEC11", title: "十一、Seedance 分段视频 Prompt", content: "生成15秒旧视频提示词，包含完整角色长档案" }];

        const markdown = serializeDramaProductionPackageMarkdown(value);

        expect(markdown).toContain("P01-F01 0-2s：角色停住");
        expect(markdown).toContain("P01-F02 2-6s：角色抬头");
        expect(markdown).toContain("动态意图：角色站立");
        expect(markdown).not.toContain("生成15秒9:16竖屏电影级视频");
        expect(markdown).not.toContain("生成15秒旧视频提示词");
    });

    it("exports structured video prompt fields one per line", () => {
        const value = fixture();
        value.episodes[0].shots[0].videoPrompt = "动态意图：角色抬头；单一主运镜：固定机位；结束画面：视线锁定断剑";
        value.archive!.sections = [{ code: "SEC11", title: "十一、分段视频 Prompt", content: "旧内容" }];

        const markdown = serializeDramaProductionPackageMarkdown(value);

        expect(markdown).toContain("动态意图：角色抬头\n单一主运镜：固定机位\n结束画面：视线锁定断剑");
        expect(markdown).not.toContain("动态意图：动态意图：");
    });
});

function fixture(): DramaProductionPackageV1 {
    return {
        schemaVersion: 1,
        project: {
            title: "测试",
            summary: "",
            style: "电影感",
            ratio: "9:16",
            productionBible: {
                targetPlatform: "短剧",
                language: "中文",
                ratio: "9:16",
                visualStyle: "电影感",
                colorScript: "冷暖",
                soundBible: "克制",
                globalNegativePrompt: "不要变形",
                subtitleSafeArea: "底部20%",
                targetDuration: 6,
                continuityMode: "strict",
                productionPlan: defaultDramaProductionPlan("package"),
            },
        },
        seriesBible: { version: "series-bible-v1", canonCharacters: ["C01"], immutableRules: ["不可换脸"], relationshipState: "同伴", worldRules: ["规则"], unresolvedThreads: [], visualMotifs: [], soundMotifs: [] },
        assets: { characters: [{ code: "C01", name: "角色", description: "固定角色" }], locations: [{ code: "S01", name: "场景", description: "固定场景" }], props: [{ code: "P01", name: "道具", description: "固定道具" }], clues: [] },
        episodes: [
            {
                code: "E01",
                title: "第一集",
                script: "",
                outline: "",
                hook: "",
                nextPreview: "",
                sourceRange: "",
                storyScenes: [],
                continuityEdges: [],
                shots: [
                    {
                        code: "SH001",
                        order: 1,
                        title: "测试镜头",
                        description: "站立",
                        sourceText: "站立",
                        shotBoundary: "",
                        dialogue: "",
                        narration: "",
                        utterances: [],
                        imagePrompt: "9:16站立",
                        videoPrompt: "角色站立",
                        cameraMotion: "固定",
                        entryState: { characters: [], props: [] },
                        exitState: { characters: [], props: [] },
                        framePlan: {
                            start: { source: "independent" },
                            end: { required: true },
                            frames: [{ id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 6, actionPrompt: "角色站立", imagePrompt: "9:16站立" }],
                            referenceManifest: [
                                { alias: "@图片1", role: "character_anchor", purpose: "角色基准", assetId: "C01" },
                                { alias: "@图片2", role: "scene_anchor", purpose: "场景基准", assetId: "S01" },
                                { alias: "@图片3", role: "prop_anchor", purpose: "道具基准", assetId: "P01" },
                            ],
                        },
                        duration: 6,
                        characterCodes: ["C01"],
                        propCodes: ["P01"],
                        clueCodes: [],
                        locationCode: "S01",
                    },
                ],
            },
        ],
        archive: {
            formatVersion: "vozeb-drama-production-package-v1",
            sections: [{ code: "section-one", title: "导演镜头执行表", content: "旧表" }],
            promptAssets: [],
            dialogueDirections: [],
            voiceDirections: [],
            silenceDirections: [],
            referencePlan: [],
            generationOrder: [],
            qcReport: "",
        },
    };
}
