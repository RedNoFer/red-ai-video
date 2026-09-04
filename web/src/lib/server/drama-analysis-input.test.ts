import { describe, expect, it } from "vitest";

import {
    normalizeDramaReviewCompletionInput,
    normalizeDramaVideoPromptInput,
    normalizeDramaVisualInput,
    reviewCompletionFilledCount,
    reviewCompletionMissingFields,
    reviewCompletionSatisfies,
    validateDramaVideoPromptOutput,
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
            referenceMaterials: [{ alias: "@图片1", role: "keyframe", purpose: "顺序帧 1", sequenceIndex: 1, url: "/private/frame.png" }],
        });
        expect(result.payload.referenceMaterials).toEqual([{ alias: "@图片1", role: "keyframe", purpose: "顺序帧 1", sequenceIndex: 1 }]);
        expect(result.payload.shots[0]).toMatchObject({ id: "shot-one", videoPrompt: "动态意图：人物抬头" });
        expect(result.payload.shots[0]).not.toHaveProperty("storyboardFrames");
        expect(result.payload.shots[0].framePlan).toEqual({});
        expect(JSON.stringify(result.payload)).not.toContain("very-large-frame");
        expect(JSON.stringify(result.payload)).not.toContain("/private/frame.png");
    });

    it("assigns deterministic aliases when older callers omit them", () => {
        const result = normalizeDramaVideoPromptInput({
            phase: "video_prompt",
            shots: [{ id: "shot-one", videoPrompt: "动态意图：人物抬头" }],
            referenceMaterials: [{ role: "keyframe", purpose: "顺序帧 1" }, { role: "scene_anchor", purpose: "场景基准图" }],
        });

        expect(result.payload.referenceMaterials).toEqual([
            { alias: "@图片1", role: "keyframe", purpose: "顺序帧 1" },
            { alias: "@图片2", role: "scene_anchor", purpose: "场景基准图" },
        ]);
    });

    it("validates that the Agent returns every bound image alias", () => {
        expect(validateDramaVideoPromptReferenceBindings("素材绑定：@图片1：顺序帧 1\n@图片2：角色基准图", [{ role: "keyframe" }, { role: "character_anchor" }])).toBe("");
        expect(validateDramaVideoPromptReferenceBindings("素材绑定：@图片1（顺序帧 1）\n@图片2 用于角色基准图", [{ alias: "@图片1", role: "keyframe" }, { alias: "@图片2", role: "character_anchor" }])).toBe("");
        expect(validateDramaVideoPromptReferenceBindings("素材绑定：先绑定顺序帧；参考图 @图片 1（顺序帧 1）、@图片 2 用于角色基准图", [{ alias: "@图片1", role: "keyframe" }, { alias: "@图片2", role: "character_anchor" }])).toBe("");
        expect(validateDramaVideoPromptReferenceBindings("动态意图：人物抬头", [{ role: "keyframe" }])).toContain("@图片1");
        expect(validateDramaVideoPromptReferenceBindings("动态意图：@图片1：人物抬头", [{ role: "keyframe" }])).toContain("素材绑定字段");
        expect(validateDramaVideoPromptReferenceBindings("素材绑定：@图片1：顺序帧\n主体动作：@图片1：重复", [{ role: "keyframe" }])).toContain("重复绑定");
        expect(validateDramaVideoPromptReferenceBindings("素材绑定：@图片2：场景\n@图片1：角色", [{ role: "character_anchor" }, { role: "scene_anchor" }])).toContain("顺序");
    });

    it("rejects a video prompt that exposes internal mode or omits concrete frame actions", () => {
        const error = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: "素材绑定：@图片1：顺序帧\n动态意图：人物抬头\n模式：video-edit",
                        framePlan: { frames: [{ sequenceIndex: 1, startSecond: 0, endSecond: 3, startPrompt: "", actionPrompt: "", transitionPrompt: "", endPrompt: "", imagePrompt: "" }] },
                    },
                ],
            },
            ["shot-one"],
            [{ id: "shot-one", framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 }] } }],
            [{ role: "keyframe", purpose: "顺序帧" }],
        );

        expect(error).toContain("内部模式");
    });

    it("requires every source time range to be described in the public prompt", () => {
        const error = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: [
                            "动态意图：人物抬头",
                            "全局设定：冷色夜景",
                            "起始可见状态：人物低头",
                            "主体动作与反应：手指收紧后抬头",
                            "时间段动作：0-3s",
                            "单一主运镜：固定机位",
                            "环境压力与视觉母题：风声",
                            "视觉风格与光色：冷蓝",
                            "声音意图：低声耳语",
                            "结束画面：人物看向门外",
                            "连续性锁：身份不变",
                            "针对性约束：无变形",
                        ].join("\n"),
                        framePlan: { frames: [{ sequenceIndex: 1, startSecond: 0, endSecond: 3, startPrompt: "人物低头", actionPrompt: "手指收紧", transitionPrompt: "视线转向门外", endPrompt: "人物看向门外", imagePrompt: "人物看向门外" }] },
                    },
                ],
            },
            ["shot-one"],
            [{ id: "shot-one", framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 }] } }],
            [],
        );

        expect(error).toContain("逐段写出");
    });

    it("accepts a complete Agent prompt when fields are separated by semicolons or escaped newlines", () => {
        const prompt = [
            "素材绑定：@图片1：顺序帧 1；动态意图：人物抬头；全局设定：冷蓝夜景；起始可见状态：人物低头；主体动作与反应：手指收紧后抬头；时间段动作：0-3s 起点：人物低头；动作与触发：手指收紧；可见衔接：视线转向门外；终点：人物抬头；单一主运镜：固定机位；环境压力与视觉母题：远处风声；视觉风格与光色：冷蓝灰；声音意图：低声耳语；结束画面：人物看向门外；连续性锁：身份不变；针对性约束：无变形",
        ].join("\\n");
        const error = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: prompt,
                        framePlan: { frames: [{ sequenceIndex: 1, startSecond: 0, endSecond: 3, startPrompt: "人物低头", actionPrompt: "手指收紧", transitionPrompt: "视线转向门外", endPrompt: "人物抬头", imagePrompt: "人物抬头看向门外" }] },
                    },
                ],
            },
            ["shot-one"],
            [{ id: "shot-one", framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 }] } }],
            [{ alias: "@图片1", role: "keyframe", purpose: "顺序帧 1" }],
        );

        expect(error).toBe("");
    });

    it("accepts common list markers in Agent prompt fields", () => {
        const prompt = [
            "- 动态意图：人物抬头",
            "- 全局设定：冷蓝夜景",
            "- 起始可见状态：人物低头",
            "- 主体动作与反应：手指收紧后抬头",
            "- 时间段动作：0-3s 起点：人物低头；动作与触发：手指收紧；可见衔接：视线转向门外；终点：人物抬头",
            "- 单一主运镜：固定机位",
            "- 环境压力与视觉母题：远处风声",
            "- 视觉风格与光色：冷蓝灰",
            "- 声音意图：低声耳语",
            "- 结束画面：人物看向门外",
            "- 连续性锁：身份不变",
            "- 针对性约束：无变形",
        ].join("\n");
        const error = validateDramaVideoPromptOutput(
            {
                shots: [{ shotId: "shot-one", videoPrompt: prompt, framePlan: { frames: [{ sequenceIndex: 1, startSecond: 0, endSecond: 3, startPrompt: "人物低头", actionPrompt: "手指收紧", transitionPrompt: "视线转向门外", endPrompt: "人物抬头", imagePrompt: "人物抬头看向门外" }] } }],
            },
            ["shot-one"],
            [{ id: "shot-one", framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 }] } }],
            [],
        );

        expect(error).toBe("");
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
