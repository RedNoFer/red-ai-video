import { describe, expect, it } from "vitest";

import {
    normalizeDramaReviewCompletionInput,
    normalizeDramaVideoPromptInput,
    normalizeDramaVisualInput,
    reviewCompletionFilledCount,
    reviewCompletionMissingFields,
    reviewCompletionSatisfies,
    validateDramaVideoPromptReferenceBindings,
} from "./drama-analysis-input";

describe("normalizeDramaVisualInput", () => {
    it("keeps every reviewed shot, asset, utterance, relation and full text", () => {
        const longDescription = "镜头描述".repeat(2_500);
        const shots = Array.from({ length: 81 }, (_, index) => ({
            id: `shot-${index}`,
            title: `镜头 ${index}`,
            description: index === 80 ? longDescription : "描述",
            sourceText: "原文",
            duration: index === 80 ? 21 : 5,
            utterances: Array.from({ length: 101 }, (__, utteranceIndex) => ({ id: `utterance-${utteranceIndex}`, order: utteranceIndex + 1, type: "dialogue", speaker: "角色", text: `台词 ${utteranceIndex}` })),
            characterIds: Array.from({ length: 51 }, (__, relationIndex) => `character-${relationIndex}`),
            propIds: Array.from({ length: 51 }, (__, relationIndex) => `prop-${relationIndex}`),
            clueIds: Array.from({ length: 51 }, (__, relationIndex) => `clue-${relationIndex}`),
        }));
        const characters = Array.from({ length: 201 }, (_, index) => ({ id: `character-${index}`, name: `角色 ${index}`, description: index === 200 ? longDescription : "角色设定" }));

        const result = normalizeDramaVisualInput({ phase: "visual", summary: longDescription, characters, shots });

        expect(result.shotIds).toHaveLength(81);
        expect(result.payload.assets.characters).toHaveLength(201);
        expect(result.payload.shots[80]).toMatchObject({ description: longDescription, duration: 21 });
        expect(result.payload.shots[80].utterances).toHaveLength(101);
        expect(result.payload.shots[80].characterIds).toHaveLength(51);
        expect(result.payload.shots[80].propIds).toHaveLength(51);
        expect(result.payload.shots[80].clueIds).toHaveLength(51);
        expect(result.payload.project.summary).toBe(longDescription);
        expect(result.payload.assets.characters[200].description).toBe(longDescription);
    });
});

describe("video prompt reference instructions", () => {
    it("keeps reference duties as structured prompt context without media URLs", () => {
        const result = normalizeDramaVideoPromptInput({
            phase: "video_prompt",
            shots: [{ id: "shot-one", videoPrompt: "动态意图：人物抬头", storyboardFrames: [{ id: "frame-one", mediaUrl: "data:image/png;base64,very-large-frame" }] }],
            referenceMaterials: [{ role: "keyframe", purpose: "顺序帧 1", sequenceIndex: 1, url: "/private/frame.png" }],
        });
        expect(result.payload.referenceMaterials).toEqual([{ role: "keyframe", purpose: "顺序帧 1", sequenceIndex: 1 }]);
        expect(result.payload.shots[0]).toMatchObject({ id: "shot-one", videoPrompt: "动态意图：人物抬头" });
        expect(result.payload.shots[0]).not.toHaveProperty("storyboardFrames");
        expect(JSON.stringify(result.payload)).not.toContain("very-large-frame");
        expect(JSON.stringify(result.payload)).not.toContain("/private/frame.png");
    });

    it("validates that the Agent returns every bound image alias", () => {
        expect(validateDramaVideoPromptReferenceBindings("素材绑定：@图片1：顺序帧 1\n@图片2：角色基准图", [{ role: "keyframe" }, { role: "character_anchor" }])).toBe("");
        expect(validateDramaVideoPromptReferenceBindings("动态意图：人物抬头", [{ role: "keyframe" }])).toContain("@图片1");
        expect(validateDramaVideoPromptReferenceBindings("动态意图：@图片1：人物抬头", [{ role: "keyframe" }])).toContain("素材绑定字段");
        expect(validateDramaVideoPromptReferenceBindings("素材绑定：@图片1：顺序帧\n主体动作：@图片1：重复", [{ role: "keyframe" }])).toContain("重复绑定");
        expect(validateDramaVideoPromptReferenceBindings("素材绑定：@图片2：场景\n@图片1：角色", [{ role: "character_anchor" }, { role: "scene_anchor" }])).toContain("顺序");
    });
});

describe("review completion input", () => {
    it("can force an already-complete shot for conversational continuity refinement", () => {
        const completeContinuity = {
            shotSize: "中景",
            cameraAngle: "平视",
            composition: "人物居左",
            characterBlocking: "女主靠床",
            gazeDirection: "看向右侧",
            actionStart: "抬头",
            actionEnd: "停住",
            screenDirection: "向右",
            axisRule: "不越轴",
            continuityNotes: "保持视线方向",
        };
        const result = normalizeDramaReviewCompletionInput({
            phase: "review_completion",
            completionFields: ["continuity"],
            forceShotIds: ["shot-one"],
            instruction: "让动作衔接更自然",
            shots: [{ id: "shot-one", title: "相遇", utterances: [], continuity: completeContinuity }],
        });

        expect(result.shotIds).toEqual(["shot-one"]);
        expect(result.missingByShot["shot-one"]).toEqual(["continuity"]);
        expect(result.payload.instruction).toBe("让动作衔接更自然");
    });

    it("requires the same key subfields that the review page displays", () => {
        const emptyShell = {
            utterances: [{ type: "dialogue", text: "你醒了？" }],
            performancePlan: { emotionalObjective: "警觉" },
            dialoguePerformance: [],
            lightingPlan: { palette: "冷青" },
            continuity: { shotSize: "中景", cameraAngle: "平视" },
            entryState: {},
            exitState: {},
        };

        expect(reviewCompletionMissingFields(emptyShell)).toEqual(["performancePlan", "dialoguePerformance", "lightingPlan", "continuity", "entryState", "exitState"]);
        expect(reviewCompletionSatisfies(emptyShell, ["performancePlan", "lightingPlan", "continuity", "entryState", "exitState"])).toBe(false);
    });

    it("accepts complete performance, lighting and continuity plans", () => {
        const complete = {
            performancePlan: {
                emotionalObjective: "确认危险",
                emotionalArc: "疑惑到紧绷",
                speechStyle: "低声短句",
                pace: "先慢后急",
                breath: "浅而急",
                beats: { start: { facialAction: "眉头收紧" }, middle: { facialAction: "眼神游移" }, end: { facialAction: "下颌绷住" } },
            },
            lightingPlan: { palette: "冷青", colorTemperature: "4200K", keyLight: "窗侧硬光", fillLight: "弱补光", rimLight: "背后轮廓光", materialResponse: "金属反光偏冷", skinToneProtection: "脸部保留暖色" },
            continuity: { shotSize: "中景", cameraAngle: "平视", composition: "人物居左", characterBlocking: "女主靠床", gazeDirection: "看向右侧", actionStart: "抬头", actionEnd: "停住", screenDirection: "向右", axisRule: "不越轴" },
            entryState: { emotion: "虚弱" },
            exitState: { emotion: "警觉" },
        };

        expect(reviewCompletionMissingFields(complete)).toEqual([]);
        expect(reviewCompletionSatisfies(complete, ["performancePlan", "lightingPlan", "continuity", "entryState", "exitState"])).toBe(true);
    });

    it("counts partial field progress without requiring every missing field", () => {
        const partial = {
            performancePlan: { emotionalObjective: "确认危险", emotionalArc: "紧张递进", speechStyle: "低声", pace: "慢", breath: "浅", beats: { start: { facialAction: "收紧" }, middle: { facialAction: "迟疑" }, end: { facialAction: "绷住" } } },
            lightingPlan: { palette: "冷青", colorTemperature: "4200K", keyLight: "窗侧硬光", fillLight: "弱补光", rimLight: "背后轮廓光", materialResponse: "金属反光", skinToneProtection: "保留肤色" },
            continuity: { shotSize: "中景", cameraAngle: "平视", composition: "左侧留白", characterBlocking: "靠床", gazeDirection: "向右", actionStart: "抬头", actionEnd: "停住", screenDirection: "向右", axisRule: "不越轴" },
        };

        expect(reviewCompletionFilledCount(partial, ["performancePlan", "lightingPlan", "continuity", "entryState"])).toBe(3);
    });
});
