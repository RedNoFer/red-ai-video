import { describe, expect, it } from "vitest";

import type { DramaEpisode, DramaProject, DramaShot } from "./drama-project-contract";
import { analyzeDramaPromptAdvice, compactDramaSupplierPrompt, measureDramaPrompt, resolveDramaPromptLimit } from "./drama-prompt-advice";

describe("drama prompt advice", () => {
    it("uses the documented Seedance special prompt limits", () => {
        const profile = resolveDramaPromptLimit("sd_2.0_special_720p");
        const usage = measureDramaPrompt("啊".repeat(501), profile);

        expect(profile).toMatchObject({ providerId: "seedance-special", characterLimit: 500, wordLimit: 1000, known: true });
        expect(usage).toMatchObject({ characterCount: 501, unit: "characters", overLimit: true, remaining: 0 });
    });

    it("does not invent a limit for an unconfigured model", () => {
        const report = analyzeDramaPromptAdvice({ project: baseProject(), episode: baseEpisode(), shot: baseShot(), prompt: "很长的提示词", model: "vendor-model" });

        expect(report.profile.known).toBe(false);
        expect(report.usage.limit).toBeUndefined();
        expect(report.suggestions.some((item) => item.id.startsWith("prompt-length"))).toBe(false);
    });

    it("uses a separate 5000-character budget for the final package prompt", () => {
        const report = analyzeDramaPromptAdvice({ project: baseProject(), episode: baseEpisode(), shot: baseShot(), prompt: "啊".repeat(5001), model: "vendor-model" });

        expect(report.packageUsage).toMatchObject({ characterCount: 5001, limit: 5000, unit: "characters", overLimit: true });
        expect(report.suggestions.map((item) => item.id)).toContain("package-prompt-length-over-limit");
    });

    it("removes only exact duplicate lines when creating a compact candidate", () => {
        expect(compactDramaSupplierPrompt("人物抬眼\n人物抬眼\n\n保持轴线\n\n保持轴线\n")).toBe("人物抬眼\n\n保持轴线");
    });

    it("surfaces vertical crop, hard-cut, dialogue, and axis advice", () => {
        const shot = baseShot();
        shot.characterIds = ["character-one", "character-two"];
        shot.dialogue = "你应该知道";
        shot.utterances = [{ id: "u1", order: 1, type: "dialogue", speaker: "萧炎", text: "你应该知道" }];
        shot.transitionOut = "硬切";
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: [
                { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "人物抬眼", imagePrompt: "人物抬眼" },
                { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 4, actionPrompt: "人物抬眼", imagePrompt: "人物抬眼" },
            ],
            referenceManifest: [{ alias: "@图片1", role: "scene_anchor", purpose: "大厅", assetId: "scene-one" }],
        };

        const report = analyzeDramaPromptAdvice({ project: baseProject(), episode: baseEpisode(shot), shot, prompt: "9:16竖屏，人物大特写，硬切，保持电影感", model: "sd_2.0_special_720p" });
        const ids = report.suggestions.map((item) => item.id);

        expect(ids).toEqual(expect.arrayContaining(["repeated-frame-performance", "cut-missing-trigger", "vertical-crop-risk", "dialogue-speaker-binding", "skill-axis-and-angle"]));
        expect(report.suggestions.find((item) => item.id === "vertical-crop-risk")?.insertText).toContain("完整头顶");
    });

    it("suggests the reference duty split when manifest roles are incomplete", () => {
        const shot = baseShot();
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 4, actionPrompt: "站定", imagePrompt: "大厅中站定" }],
            referenceManifest: [{ alias: "@图片1", role: "scene_anchor", purpose: "大厅", assetId: "scene-one" }],
        };

        const report = analyzeDramaPromptAdvice({ project: baseProject(), episode: baseEpisode(shot), shot, prompt: "大厅中人物站定", model: "sd_2.0_special_720p" });

        expect(report.suggestions.map((item) => item.id)).toContain("reference-role-gap");
    });
});

function baseShot(): DramaShot {
    return {
        id: "shot-one",
        order: 1,
        title: "对话",
        description: "大厅对话",
        sourceText: "人物在大厅对话",
        shotBoundary: "硬切",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: "大厅",
        videoPrompt: "人物站在大厅",
        cameraMotion: "",
        duration: 5,
        characterIds: ["character-one"],
        propIds: [],
        clueIds: [],
        sceneId: "scene-one",
    };
}

function baseEpisode(shot = baseShot()): DramaEpisode {
    return { id: "episode-one", title: "第1集", script: "", outline: "", hook: "", nextPreview: "", sourceRange: "", reviewStatus: "visual_ready", shots: [shot] };
}

function baseProject(): DramaProject {
    return {
        id: "project-one",
        title: "测试短剧",
        summary: "",
        style: "写实",
        ratio: "9:16",
        productionBible: { language: "中文", ratio: "9:16", visualStyle: "写实", continuityMode: "balanced" },
        status: "active",
        characters: [
            { id: "character-one", name: "萧炎", description: "少年", profile: { visualIdentity: "少年", styling: "深色服装", colorPalette: "灰黑", consistencyRules: "保持一致" } },
            { id: "character-two", name: "纳兰嫣然", description: "少女", profile: { visualIdentity: "少女", styling: "浅色服装", colorPalette: "浅灰", consistencyRules: "保持一致" } },
        ],
        scenes: [{ id: "scene-one", name: "迎客大厅", description: "大厅", profile: { visualIdentity: "大厅", styling: "灰石", colorPalette: "栗灰", consistencyRules: "座次不变" } }],
        props: [],
        clues: [],
        defaultVideoMode: "storyboard",
        episodes: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}
