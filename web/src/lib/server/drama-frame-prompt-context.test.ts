import { describe, expect, it } from "vitest";

import type { DramaProject } from "@/lib/drama-project-contract";
import { buildDramaFramePromptContext, formatDramaFramePromptContext } from "@/lib/server/drama-frame-prompt-context";

describe("drama frame prompt context", () => {
    it("shares project rules, NPC policy and neighboring frame facts without private execution data", () => {
        const project = fixture();
        const context = formatDramaFramePromptContext(buildDramaFramePromptContext(project, "episode-one", "shot-one", "frame-two", "当前图片提示词"));

        expect(context).toContain("项目导演定制规则：\n公共场景增加旁听 NPC");
        expect(context).toContain("NPC 策略：必须按当前镜头实际空间容量");
        expect(context).toContain("上一帧事实");
        expect(context).toContain("下一帧事实");
        expect(context).not.toContain("project-private-identifier");
        expect(context).not.toContain("https://private.example");
    });
});

function fixture(): DramaProject {
    return {
        id: "project-private-identifier",
        title: "三人议事",
        summary: "",
        style: "东方写实",
        ratio: "9:16",
        productionBible: {
            language: "中文",
            ratio: "9:16",
            visualStyle: "东方写实",
            colorScript: "冷灰暖金",
            soundBible: "克制",
            globalNegativePrompt: "无水印",
            subtitleSafeArea: "底部",
            continuityMode: "strict",
            productionPlan: {
                version: "drama-production-plan-v1",
                skills: [],
                visual: { visualStyle: "东方写实", artStyle: "电影级空间美术", source: "manual" },
                video: { model: "model-private", mode: "storyboard", ratio: "9:16", resolution: "720p", durationPolicy: "shot", shotDuration: 15, framePolicy: "agent", count: 1, audioMode: "native", allowExplicitFallback: false },
                references: { strategy: "adaptive", minImages: 3, maxImages: 9, roles: [] },
                continuity: { mode: "strict", requireAcceptedActualTail: true },
                frameCountRange: { min: 2, max: 9 },
                customDirectorRules: "公共场景增加旁听 NPC",
                source: "manual",
            },
        },
        status: "active",
        characters: [{ id: "character-private-identifier", name: "萧炎", description: "黑衣，https://private.example/character.png" }],
        scenes: [{ id: "scene-private-identifier", name: "议事大厅", description: "高堂木柱", backgroundNpcPolicy: { mode: "required", guidance: "前后景安排旁听者" } }],
        props: [],
        clues: [],
        defaultVideoMode: "storyboard",
        episodes: [
            {
                id: "episode-one",
                title: "第一集",
                script: "",
                outline: "",
                hook: "",
                nextPreview: "",
                sourceRange: "",
                reviewStatus: "draft",
                shots: [
                    {
                        id: "shot-one",
                        title: "议事",
                        description: "萧炎抬眼",
                        sourceText: "萧炎抬眼",
                        shotBoundary: "",
                        dialogue: "",
                        narration: "",
                        utterances: [],
                        imagePrompt: "旧画面",
                        videoPrompt: "旧视频",
                        cameraMotion: "固定",
                        duration: 15,
                        characterIds: ["character-private-identifier"],
                        propIds: [],
                        clueIds: [],
                        sceneId: "scene-private-identifier",
                        framePlan: {
                            start: { source: "independent" },
                            end: { required: true },
                            frames: [
                                { id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 7.5, actionPrompt: "萧炎低头", imagePrompt: "萧炎低头" },
                                { id: "frame-two", sequenceIndex: 2, startSecond: 7.5, endSecond: 15, actionPrompt: "萧炎抬眼", imagePrompt: "当前图片提示词" },
                                { id: "frame-three", sequenceIndex: 3, startSecond: 15, endSecond: 15.001, actionPrompt: "下一帧", imagePrompt: "下一帧" },
                            ],
                            referenceManifest: [{ alias: "@图片1", role: "scene_anchor", purpose: "场景基准", assetId: "scene-private-identifier" }],
                        },
                    } as never,
                ],
            },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}
