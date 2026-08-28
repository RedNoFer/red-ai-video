import { describe, expect, it } from "vitest";

import {
    describeDramaModelOutput,
    dramaReviewCompletionTool,
    dramaReviewCompletionToolForFields,
    hasUsableDramaToolArguments,
    normalizeDramaContentAnalysis,
    normalizeDramaReviewCompletion,
    normalizeDramaVideoPromptAnalysis,
    normalizeDramaVisualAnalysis,
    readDramaChatArguments,
    readDramaResponsesArguments,
    readDramaUpstreamError,
} from "./drama-analysis";

describe("drama analysis contracts", () => {
    it("keeps content facts separate from visual prompts", () => {
        const result = normalizeDramaContentAnalysis(
            {
                episode: { outline: "大纲", hook: "钩子", nextPreview: "预告", sourceRange: "第一章" },
                characters: [{ name: "女主", description: "红衣", profile: { visualIdentity: "短发", styling: "红衣", colorPalette: "红黑", consistencyRules: "服装不变" } }],
                scenes: [{ name: "天台", description: "夜晚" }],
                props: [{ name: "钥匙", description: "铜钥匙" }],
                clues: [
                    { name: "", description: "空项", payoff: "错误回收" },
                    { name: "血迹", description: "门边血迹", payoff: "第三幕揭示" },
                ],
                shots: [
                    {
                        title: "发现",
                        description: "女主发现血迹",
                        sourceText: "她在门边看见一滴血。",
                        shotBoundary: "发现信息后切镜",
                        dialogue: "谁来过？",
                        narration: "",
                        utterances: [{ type: "dialogue", speaker: "女主", text: "谁来过？" }],
                        duration: 7,
                        characterNames: ["女主"],
                        sceneName: "天台",
                        propNames: ["钥匙"],
                        clueNames: ["血迹"],
                        imagePrompt: "不应进入内容结构",
                    },
                ],
            },
            5,
        );

        expect(result.clues).toEqual([expect.objectContaining({ name: "血迹", payoff: "第三幕揭示" })]);
        expect(result.characters[0]).toMatchObject({ profile: { visualIdentity: "短发", consistencyRules: "服装不变" } });
        expect(result.shots[0]).toMatchObject({ sourceText: "她在门边看见一滴血。", duration: 7, clueNames: ["血迹"] });
        expect(result.shots[0]).not.toHaveProperty("imagePrompt");
    });

    it("keeps character-only appearance fields out of scene profiles", () => {
        const result = normalizeDramaContentAnalysis(
            {
                episode: {},
                characters: [],
                scenes: [{ name: "黑湖记忆", description: "无风黑湖、倒悬古塔、雪地边界", profile: { styling: "黑湖记忆的发型、服装、随身物件与材质按描述固定" } }],
                props: [],
                clues: [],
                shots: [],
            },
            5,
        );

        expect(result.scenes[0]?.profile?.styling).toBe("");
    });

    it("restores every direct line from the source script and rejects narrative summaries", () => {
        const script = ["一旁的女人再次开口：“俊成家的，你还好吗？”", "郁心妍闭着眼回了一句：“我没事，就是有些头晕。”", "“你等着，我这就去给你叫医生。”", "郁心妍刚想说：不用，她缓一下就没事了。"].join("\n");
        const result = normalizeDramaContentAnalysis(
            {
                episode: { outline: "大纲", hook: "钩子", nextPreview: "预告", sourceRange: "第一章" },
                characters: [],
                scenes: [],
                props: [],
                clues: [],
                shots: [
                    {
                        title: "病房问候",
                        description: "女人关心郁心妍的状态",
                        sourceText: "一旁的女人再次开口：“俊成家的，你还好吗？”",
                        shotBoundary: "问候后切镜",
                        dialogue: "女人说明自己关心郁心妍。",
                        narration: "",
                        utterances: [],
                        duration: 5,
                        characterNames: [],
                        sceneName: "",
                        propNames: [],
                        clueNames: [],
                    },
                ],
            },
            5,
            script,
        );

        expect(result.shots.flatMap((shot) => shot.utterances.map((item) => item.text))).toEqual(["俊成家的，你还好吗？", "我没事，就是有些头晕。", "你等着，我这就去给你叫医生。", "不用，她缓一下就没事了。"]);
        expect(result.shots.flatMap((shot) => shot.utterances.map((item) => item.speaker)).slice(0, 2)).toEqual(["女人", "郁心妍"]);
        expect(result.shots[0].dialogue).not.toContain("说明自己");
    });

    it("keeps repeated dialogue occurrences instead of deduplicating by text", () => {
        const script = "她点点头：“好。”\n走到门口，她又回头：“好。”";
        const result = normalizeDramaContentAnalysis(
            {
                episode: { outline: "大纲", hook: "", nextPreview: "", sourceRange: "第一章" },
                characters: [],
                scenes: [],
                props: [],
                clues: [],
                shots: [
                    {
                        title: "第一次回应",
                        description: "她点头回应",
                        sourceText: "她点点头：“好。”",
                        shotBoundary: "动作结束",
                        dialogue: "好。",
                        narration: "",
                        utterances: [],
                        duration: 4,
                        characterNames: [],
                        sceneName: "",
                        propNames: [],
                        clueNames: [],
                    },
                ],
            },
            5,
            script,
        );

        expect(result.shots[0].utterances.filter((item) => item.type === "dialogue").map((item) => item.text)).toEqual(["好。", "好。"]);
    });

    it("only accepts visual fields for reviewed shot ids", () => {
        expect(
            normalizeDramaVisualAnalysis(
                {
                    shots: [
                        {
                            shotId: "shot-one",
                            imagePrompt: "夜景中景",
                            videoPrompt: "缓慢推进",
                            cameraMotion: "dolly in",
                            startFramePrompt: "抬头前",
                            endFramePrompt: "抬头后",
                            negativePrompt: "身份漂移",
                            continuity: {
                                shotSize: "中景",
                                cameraAngle: "平视",
                                composition: "居中",
                                characterBlocking: "女主在门边",
                                gazeDirection: "向左",
                                actionStart: "低头",
                                actionEnd: "抬头",
                                screenDirection: "向左",
                                axisRule: "不越轴",
                                continuityNotes: "服装不变",
                            },
                        },
                        { shotId: "unknown", imagePrompt: "错误", videoPrompt: "错误", cameraMotion: "" },
                        { shotId: "shot-one", imagePrompt: "重复", videoPrompt: "重复", cameraMotion: "" },
                    ],
                },
                ["shot-one"],
            ),
        ).toEqual({
            shots: [
                {
                    shotId: "shot-one",
                    imagePrompt: "夜景中景",
                    videoPrompt: "缓慢推进",
                    cameraMotion: "dolly in",
                    startFramePrompt: "抬头前",
                    endFramePrompt: "抬头后",
                    negativePrompt: "身份漂移",
                    continuity: {
                        shotSize: "中景",
                        cameraAngle: "平视",
                        composition: "居中",
                        characterBlocking: "女主在门边",
                        gazeDirection: "向左",
                        actionStart: "低头",
                        actionEnd: "抬头",
                        screenDirection: "向左",
                        axisRule: "不越轴",
                        continuityNotes: "服装不变",
                    },
                    performancePlan: {
                        emotionalObjective: "",
                        emotionalArc: "",
                        speechStyle: "",
                        pace: "",
                        breath: "",
                        restraintLevel: "",
                        beats: { start: { emotion: "", facialAction: "", gaze: "", bodyAction: "" }, middle: { emotion: "", facialAction: "", gaze: "", bodyAction: "" }, end: { emotion: "", facialAction: "", gaze: "", bodyAction: "" } },
                    },
                    dialoguePerformance: [],
                    lightingPlan: { palette: "", colorTemperature: "", keyLight: "", fillLight: "", rimLight: "", contrast: "", materialResponse: "", skinToneProtection: "", inheritFromPrevious: "", transitionToNext: "" },
                },
            ],
        });
    });

    it("only accepts one generated video prompt per requested shot", () => {
        expect(normalizeDramaVideoPromptAnalysis({ shots: [{ shotId: "shot-one", videoPrompt: "用已验收帧完成匹配切" }, { shotId: "unknown", videoPrompt: "不应进入" }, { shotId: "shot-one", videoPrompt: "重复" }] }, ["shot-one"])).toEqual({
            shots: [{ shotId: "shot-one", videoPrompt: "用已验收帧完成匹配切" }],
        });
    });

    it("normalizes review completion for every requested shot", () => {
        const result = normalizeDramaReviewCompletion(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        performancePlan: {
                            emotionalObjective: "守住秘密",
                            emotionalArc: "平静到警觉",
                            speechStyle: "低声",
                            pace: "慢",
                            breath: "屏息",
                            restraintLevel: "克制",
                            beats: {
                                start: { emotion: "平静", facialAction: "放松", gaze: "向前", bodyAction: "站定" },
                                middle: { emotion: "警觉", facialAction: "收紧", gaze: "看门", bodyAction: "绷紧" },
                                end: { emotion: "紧张", facialAction: "压住", gaze: "锁定", bodyAction: "后退" },
                            },
                        },
                        lightingPlan: {
                            palette: "冷灰",
                            colorTemperature: "4200K",
                            keyLight: "左上",
                            fillLight: "低",
                            rimLight: "蓝",
                            contrast: "中高",
                            materialResponse: "湿地反射",
                            skinToneProtection: "保留肤色",
                            inheritFromPrevious: "无",
                            transitionToNext: "延续",
                        },
                        continuity: {
                            shotSize: "中景",
                            cameraAngle: "平视",
                            composition: "左侧留白",
                            characterBlocking: "门边",
                            gazeDirection: "向左",
                            actionStart: "站定",
                            actionEnd: "后退",
                            screenDirection: "向左",
                            axisRule: "不越轴",
                            continuityNotes: "保持服装",
                        },
                        entryState: { characters: [], props: [], environment: "黑湖", lighting: "冷灰" },
                        exitState: { characters: [], props: [], environment: "黑湖", lighting: "冷灰" },
                    },
                    { shotId: "unknown" },
                ],
            },
            ["shot-one"],
        );
        expect(result.shots).toHaveLength(1);
        expect(result.shots[0]).toMatchObject({
            shotId: "shot-one",
            performancePlan: expect.objectContaining({ emotionalObjective: "守住秘密" }),
            lightingPlan: expect.objectContaining({ keyLight: "左上" }),
            continuity: expect.objectContaining({ shotSize: "中景" }),
        });
    });

    it("turns upstream failures into actionable messages", () => {
        expect(readDramaUpstreamError('{"error":{"message":"无可用账号，请稍后重试"}}', 502)).toBe("模型无可用账号，请管理员检查渠道账号池、额度或模型绑定");
        expect(readDramaUpstreamError("Upstream service temporarily unavailable", 502)).toContain("上游渠道暂时不可用");
        expect(readDramaUpstreamError("", 502)).toContain("上游文本模型渠道暂时不可用");
        expect(readDramaUpstreamError("", 401)).toContain("文本模型渠道鉴权失败");
    });

    it("lets review completion return only the fields that were actually filled", () => {
        expect(dramaReviewCompletionTool.parameters).toMatchObject({
            properties: {
                shots: {
                    items: {
                        required: ["shotId"],
                    },
                },
            },
        });
        const shotProperties = (dramaReviewCompletionTool.parameters as { properties: { shots: { items: { properties: Record<string, unknown> } } } }).properties.shots.items.properties;
        expect(shotProperties.performancePlan).not.toHaveProperty("required");
        expect(shotProperties.lightingPlan).not.toHaveProperty("required");
        expect(shotProperties.continuity).not.toHaveProperty("required");
    });

    it("requires the requested continuity field and its production keywords", () => {
        const tool = dramaReviewCompletionToolForFields(["continuity"]);
        const items = (tool.parameters as { properties: { shots: { items: { required: string[]; properties: Record<string, { required?: string[]; description?: string }> } } } }).properties.shots.items;

        expect(items.required).toContain("continuity");
        expect(items.properties.continuity.required).toEqual(["shotSize", "cameraAngle", "composition", "characterBlocking", "gazeDirection", "actionStart", "actionEnd", "screenDirection", "axisRule", "continuityNotes"]);
        expect(items.properties.continuity.description).toContain("景别");
        expect(items.properties.continuity.description).toContain("轴线");
    });

    it("accepts strict JSON when a channel returns content instead of a tool call", () => {
        expect(readDramaChatArguments({ choices: [{ message: { content: '```json\n{"shots":[]}\n```' } }] }, "analyze_drama_content")).toBe('{"shots":[]}');
        expect(readDramaResponsesArguments({ output: [{ type: "message", content: [{ type: "output_text", text: '{"shots":[]}' }] }] }, "analyze_drama_content")).toBe('{"shots":[]}');
    });

    it("accepts common provider variants without accepting surrounding prose", () => {
        expect(readDramaResponsesArguments({ output_text: '{"shots":[]}' }, "analyze_drama_content")).toBe('{"shots":[]}');
        expect(readDramaResponsesArguments({ output: [{ type: "function_call", name: "analyze_drama_content", arguments: { shots: [] } }] }, "analyze_drama_content")).toBe('{"shots":[]}');
        expect(readDramaChatArguments({ choices: [{ message: { content: [{ type: "text", text: '{"shots":[]}' }] } }] }, "analyze_drama_content")).toBe('{"shots":[]}');
        expect(readDramaChatArguments({ choices: [{ message: { function_call: { name: "analyze_drama_content", arguments: { shots: [] } } } }] }, "analyze_drama_content")).toBe('{"shots":[]}');
        expect(readDramaChatArguments({ choices: [{ message: { content: '结果如下：{"shots":[]}' } }] }, "analyze_drama_content")).toBe("");
    });

    it("rejects echoed input and empty structured results", () => {
        expect(hasUsableDramaToolArguments('{"script":"原始剧本","summary":"简介"}', "analyze_drama_content")).toBe(false);
        expect(hasUsableDramaToolArguments('{"episode":{"outline":"大纲"},"shots":[{"title":"镜头一"}]}', "analyze_drama_content")).toBe(true);
        expect(hasUsableDramaToolArguments('{"shots":[{"shotId":"shot-one"}]}', "design_drama_visuals")).toBe(true);
    });

    it("describes response shape without including model content", () => {
        expect(describeDramaModelOutput({ output_text: "private", choices: [{ message: { content: [{ type: "text", text: "private" }], tool_calls: [{ function: { name: "analyze_drama_content", arguments: "private" } }] } }] })).toEqual({
            topLevelKeys: ["output_text", "choices"],
            outputTextType: "string",
            output: [],
            choices: [{ contentType: "array", toolCallCount: 1, toolNames: ["analyze_drama_content"], functionCallName: "" }],
        });
    });
});
