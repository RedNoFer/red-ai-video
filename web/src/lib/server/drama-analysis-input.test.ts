import { describe, expect, it } from "vitest";

import {
    normalizeDramaReviewCompletionInput,
    normalizeDramaVideoPromptInput,
    dramaVideoPromptTimingWarnings,
    normalizeDramaVisualInput,
    reviewCompletionFilledCount,
    reviewCompletionMissingFields,
    reviewCompletionSatisfies,
    validateDramaVideoPromptOutput,
    validateDramaVideoPromptReferenceBindings,
} from "./drama-analysis-input";

const makeVideoCard = (index: number, start: number, end: number, visual: string, dialogue = "无") =>
    [
        `### 镜头 ${String(index).padStart(2, "0")} | ${start}-${end}秒 | 中近景 | 50mm | 侧45度平视 | 锁定机位，沿视线方向保持主体清晰 | 人物镜头`,
        "场景：当前剧情所在的室内空间。",
        `画面内容：${visual}`,
        "光影：侧方窗光落在脸部、手部和衣纹上，接触面保持可辨。",
        "色调：冷灰中性，肤色和材质自然。",
        `台词：${dialogue}`,
        "人声：短促呼吸 / 无",
        "音效：室内底噪和衣料轻响。",
    ].join("\n");

describe("normalizeDramaVisualInput", () => {
    it("derives a timing-checkable utterance when legacy shots only have dialogue text", () => {
        const result = normalizeDramaVisualInput({
            phase: "visual",
            shots: [{ id: "shot-one", dialogue: "纳兰小姐，你应该知道，在斗气大陆，女方悔婚会让对方有多难堪" }],
        });

        expect(result.payload.shots[0]?.utterances).toEqual([expect.objectContaining({ type: "dialogue", text: "纳兰小姐，你应该知道，在斗气大陆，女方悔婚会让对方有多难堪", order: 1 })]);
    });

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

    it("normalizes preflight findings as prompt-only optimization context", () => {
        const result = normalizeDramaVideoPromptInput({
            phase: "video_prompt",
            shots: [{ id: "shot-one", videoPrompt: "动态意图：人物抬头" }],
            optimizationIssues: [{ code: "PERFORMANCE_PLAN_MISSING", severity: "warning", message: "缺少人物表演规划", correction: "补充可见表演" }, { message: "无代码的输入应丢弃" }],
        });

        expect(result.payload.optimizationIssues).toEqual([{ code: "PERFORMANCE_PLAN_MISSING", severity: "warning", message: "缺少人物表演规划", correction: "补充可见表演" }]);
    });

    it("assigns deterministic aliases when older callers omit them", () => {
        const result = normalizeDramaVideoPromptInput({
            phase: "video_prompt",
            shots: [{ id: "shot-one", videoPrompt: "动态意图：人物抬头" }],
            referenceMaterials: [
                { role: "keyframe", purpose: "顺序帧 1" },
                { role: "scene_anchor", purpose: "场景基准图" },
            ],
        });

        expect(result.payload.referenceMaterials).toEqual([
            { alias: "@图片1", role: "keyframe", purpose: "顺序帧 1" },
            { alias: "@图片2", role: "scene_anchor", purpose: "场景基准图" },
        ]);
    });

    it("preserves utterance timing context for video prompt optimization", () => {
        const result = normalizeDramaVideoPromptInput({
            phase: "video_prompt",
            shots: [
                {
                    id: "shot-one",
                    utterances: [
                        {
                            id: "line-one",
                            order: 1,
                            type: "dialogue",
                            speaker: "萧炎",
                            text: "纳兰小姐，你应该知道，在斗气大陆，女方悔婚会让对方有多难堪",
                            startSecond: 0.6,
                            endSecond: 6.4,
                            pauseBeforeSeconds: 0.6,
                            pauseAfterSeconds: 0.2,
                            speechRate: "冷笑压怒",
                            speechRateCharsPerSecond: 6.2,
                        },
                    ],
                    videoPrompt: "动态意图：人物开口",
                },
            ],
        });

        expect(result.payload.shots[0].utterances[0]).toMatchObject({
            startSecond: 0.6,
            endSecond: 6.4,
            pauseBeforeSeconds: 0.6,
            pauseAfterSeconds: 0.2,
            speechRate: "冷笑压怒",
            speechRateCharsPerSecond: 6.2,
        });
    });

    it("validates that the Agent returns every bound image alias", () => {
        expect(validateDramaVideoPromptReferenceBindings("素材绑定：@图片1：顺序帧 1\n@图片2：角色基准图", [{ role: "keyframe" }, { role: "character_anchor" }])).toBe("");
        expect(
            validateDramaVideoPromptReferenceBindings("【素材绑定】\n@参考1：顺序帧 1\n@参考2：角色基准图", [
                { alias: "@图片1", role: "keyframe" },
                { alias: "@图片2", role: "character_anchor" },
            ]),
        ).toBe("");
        expect(
            validateDramaVideoPromptReferenceBindings("素材绑定：@图片1（顺序帧 1）\n@图片2 用于角色基准图", [
                { alias: "@图片1", role: "keyframe" },
                { alias: "@图片2", role: "character_anchor" },
            ]),
        ).toBe("");
        expect(
            validateDramaVideoPromptReferenceBindings("素材绑定：先绑定顺序帧；参考图 @图片 1（顺序帧 1）、@图片 2 用于角色基准图", [
                { alias: "@图片1", role: "keyframe" },
                { alias: "@图片2", role: "character_anchor" },
            ]),
        ).toBe("");
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
                        videoPrompt: `${makeVideoCard(1, 0, 3, "人物抬头看向门外，手指收紧并停住。\n模式：video-edit")}`,
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

    it("rejects a public prompt without Xiaomo time-ranged shot cards", () => {
        const error = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: [
                            "动态意图：人物抬头",
                            "全局设定：冷色夜景",
                            "起始可见状态：人物低头",
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

        expect(error).toContain("缺少小墨式");
    });

    it("accepts a complete Xiaomo director card", () => {
        const prompt = makeVideoCard(1, 0, 3, "人物从低头抬眼看向门外，右手收紧并在胸前停住。");
        const error = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: prompt,
                        framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3, startPrompt: "人物低头", actionPrompt: "手指收紧", transitionPrompt: "视线转向门外", endPrompt: "人物抬头", imagePrompt: "人物抬头看向门外" }] },
                    },
                ],
            },
            ["shot-one"],
            [{ id: "shot-one", framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 }] } }],
            [{ alias: "@图片1", role: "keyframe", purpose: "顺序帧 1" }],
        );

        expect(error).toBe("");
    });

    it("rejects overlapping dialogue prefixes in consecutive video frame prompts", () => {
        const dialogue = "纳兰小姐…你应该知道，在斗气大陆，女方悔婚会让对方有多难堪。";
        const prompt = [
            makeVideoCard(1, 0, 3, "双方关系在萧炎抬眼锁住纳兰时收紧，纳兰肩线在左缘僵住。", "萧炎说：“纳兰小姐…你应该知道，在”"),
            makeVideoCard(2, 3, 6, "双方关系继续承压，萧炎眉心收紧，纳兰肩线保持紧绷。", "萧炎说：“纳兰小姐…你应该知道，”"),
        ].join("\n");
        const error = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: prompt,
                        framePlan: {
                            frames: [
                                {
                                    id: "f1",
                                    sequenceIndex: 1,
                                    startSecond: 0,
                                    endSecond: 3,
                                    startPrompt: "萧炎低头",
                                    actionPrompt: "萧炎说：“纳兰小姐…你应该知道，在”；语气：低声克制；停顿：开口前半拍；重音：知道；说后反应：目光锁住纳兰。",
                                    transitionPrompt: "视线接住纳兰",
                                    endPrompt: "萧炎抬眼锁住纳兰",
                                    imagePrompt: "萧炎抬眼锁住纳兰，纳兰在左侧",
                                },
                                {
                                    id: "f2",
                                    sequenceIndex: 2,
                                    startSecond: 3,
                                    endSecond: 6,
                                    startPrompt: "萧炎抬眼锁住纳兰",
                                    actionPrompt: "萧炎说：“纳兰小姐…你应该知道，”；语气：硬度增加；停顿：句中短停；重音：知道；说后反应：眉心收紧。",
                                    transitionPrompt: "纳兰肩线僵住",
                                    endPrompt: "萧炎眉心收紧",
                                    imagePrompt: "萧炎眉心收紧看向纳兰，纳兰肩线僵住",
                                },
                            ],
                        },
                    },
                ],
            },
            ["shot-one"],
            [
                {
                    id: "shot-one",
                    utterances: [{ type: "dialogue", speaker: "萧炎", text: dialogue, startSecond: 0.5, endSecond: 5 }],
                    framePlan: {
                        frames: [
                            { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 },
                            { id: "f2", sequenceIndex: 2, startSecond: 3, endSecond: 6 },
                        ],
                    },
                },
            ],
            [],
        );

        expect(error).toContain("对白片段与上一时间段重叠");
    });

    it("accepts a card with explicit line-based fields", () => {
        const prompt = makeVideoCard(1, 0, 3, "人物从低头抬眼看向门外，手指收紧并停住。");
        const error = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: prompt,
                        framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3, startPrompt: "人物低头", actionPrompt: "手指收紧", transitionPrompt: "视线转向门外", endPrompt: "人物抬头", imagePrompt: "人物抬头看向门外" }] },
                    },
                ],
            },
            ["shot-one"],
            [{ id: "shot-one", framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 }] } }],
            [],
        );

        expect(error).toBe("");
    });

    it("rejects semantically repeated visual states even when the wording is not identical", () => {
        const prompt = [makeVideoCard(1, 0, 3, "双人关系在萧炎抬眼看向纳兰时收紧，右手按住桌沿，茶盏水面出现细小波纹。"), makeVideoCard(2, 3, 6, "双人关系保持承压，萧炎已经抬眼看向纳兰，右手仍按住桌沿，茶盏水面保持细小波纹。")].join("\n");
        const imagePrompt = (subject: string, state: string, performance: string) => `静态关键帧：${subject}\n可见状态：${state}\n可见表演状态：${performance}`;
        const error = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: prompt,
                        framePlan: {
                            frames: [
                                {
                                    id: "f1",
                                    sequenceIndex: 1,
                                    startSecond: 0,
                                    endSecond: 3,
                                    startPrompt: "萧炎低头按住桌沿",
                                    actionPrompt: "萧炎抬眼看向纳兰",
                                    transitionPrompt: "视线从桌沿转向纳兰",
                                    endPrompt: "萧炎抬眼看向纳兰",
                                    imagePrompt: imagePrompt("萧炎坐在长桌右侧", "右手按住桌沿，茶盏水面出现细小波纹", "眉心收紧，视线看向纳兰，肩背前倾"),
                                },
                                {
                                    id: "f2",
                                    sequenceIndex: 2,
                                    startSecond: 3,
                                    endSecond: 6,
                                    startPrompt: "萧炎低头按住桌沿",
                                    actionPrompt: "萧炎已经抬眼看向纳兰",
                                    transitionPrompt: "视线从桌沿转向纳兰并停住",
                                    endPrompt: "萧炎抬眼看向纳兰并停住",
                                    imagePrompt: imagePrompt("萧炎坐于长桌右侧", "右手已经按住桌沿，茶盏水面已出现细小波纹", "眉心收紧，视线注视纳兰，肩背前倾"),
                                },
                            ],
                        },
                    },
                ],
            },
            ["shot-one"],
            [
                {
                    id: "shot-one",
                    framePlan: {
                        frames: [
                            { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 },
                            { id: "f2", sequenceIndex: 2, startSecond: 3, endSecond: 6 },
                        ],
                    },
                },
            ],
            [],
        );

        expect(error).toContain("画面语义与其他阶段重复");
    });

    it("rejects a concise shot summary when framePlan is present", () => {
        const error = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: "动态意图：Karin从低头状态抬眼锁定门外\n单一主运镜：固定机位\n结束画面：Karin抬头看向门外\n针对性约束：无水印、无额外肢体",
                        framePlan: {
                            frames: [
                                {
                                    sequenceIndex: 1,
                                    startSecond: 0,
                                    endSecond: 3,
                                    startPrompt: "Karin低头，双手扣住断剑",
                                    actionPrompt: "手指收紧并抬头",
                                    transitionPrompt: "视线沿剑柄移向门外",
                                    endPrompt: "Karin抬头看向门外",
                                    imagePrompt: "Karin抬头看向门外，断剑仍在掌中",
                                },
                            ],
                        },
                    },
                ],
            },
            ["shot-one"],
            [{ id: "shot-one", framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 }] } }],
            [],
        );

        expect(error).toContain("缺少小墨式");
    });

    it("rejects duplicated or out-of-order public fields and internal skill text", () => {
        const baseFrame = { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3, startPrompt: "人物低头", actionPrompt: "手指收紧", transitionPrompt: "视线转向门外", endPrompt: "人物抬头", imagePrompt: "人物抬头看向门外" };
        const source = [{ id: "shot-one", framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 }] } }];
        const duplicated = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: `${makeVideoCard(1, 0, 3, "人物从低头抬眼看向门外，手指收紧并停住。\nSkill：内部规则")}`,
                        framePlan: { frames: [baseFrame] },
                    },
                ],
            },
            ["shot-one"],
            source,
            [],
        );
        expect(duplicated).toContain("内部执行信息");

        const internal = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: `${makeVideoCard(1, 0, 3, "人物从低头抬眼看向门外，手指收紧并停住。")}`,
                        framePlan: { frames: [baseFrame] },
                    },
                ],
            },
            ["shot-one"],
            source,
            [],
        );
        expect(internal).toBe("");

        const legacy = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: `${makeVideoCard(1, 0, 3, "人物从低头抬眼看向门外，手指收紧并停住。")}`,
                        framePlan: { frames: [baseFrame] },
                    },
                ],
            },
            ["shot-one"],
            source,
            [],
        );
        expect(legacy).toBe("");
    });

    it("returns a warning for a quoted dialogue fragment that cannot fit its frame duration", () => {
        const dialogue = "纳兰小姐，你应该知道，在斗气大陆，女方悔婚会让对方有多难堪，呵呵，我脸皮厚，倒是没什么";
        const fullDialogue = `${dialogue}，可我的父亲！他是一族之长，今日若是真答应了你的要求，他日后还如何掌管萧家？还如何在乌坦城立足？`;
        const error = validateDramaVideoPromptOutput(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        videoPrompt: makeVideoCard(1, 0, 3, "萧炎低头后抬眼盯住对方，手指收紧并保持肩背克制。", `萧炎说：“${dialogue}”`),
                        framePlan: {
                            frames: [
                                {
                                    id: "f1",
                                    sequenceIndex: 1,
                                    startSecond: 0,
                                    endSecond: 3,
                                    startPrompt: "萧炎低头",
                                    actionPrompt: `对白表演：萧炎说：“${dialogue}”；语气：低声克制；停顿：开口前半拍；重音：句中转折；说后反应：合唇后抬眼盯住对方`,
                                    transitionPrompt: "萧炎抬眼",
                                    endPrompt: "萧炎抬眼",
                                    imagePrompt: "萧炎抬眼，手指收紧",
                                },
                            ],
                        },
                    },
                ],
            },
            ["shot-one"],
            [
                {
                    id: "shot-one",
                    utterances: [
                        {
                            type: "dialogue",
                            speaker: "萧炎",
                            text: fullDialogue,
                            startSecond: 0.6,
                            endSecond: 6.4,
                            speechRate: "冷笑压怒",
                            speechRateCharsPerSecond: 6.2,
                        },
                    ],
                    framePlan: { frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3 }] },
                },
            ],
            [],
        );

        expect(error).toBe("");
        const warnings = dramaVideoPromptTimingWarnings(
            {
                shots: [
                    {
                        shotId: "shot-one",
                        framePlan: {
                            frames: [
                                {
                                    id: "f1",
                                    startSecond: 0,
                                    endSecond: 3,
                                    actionPrompt: `萧炎开口说“${dialogue}”`,
                                },
                            ],
                        },
                    },
                ],
            },
            ["shot-one"],
            [
                {
                    id: "shot-one",
                    utterances: [{ type: "dialogue", text: fullDialogue, speechRateCharsPerSecond: 6.2 }],
                },
            ],
        );
        expect(warnings[0]).toContain("当前仅 3 秒");
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
                restraintLevel: "压住惊慌，只让眼神先泄露警觉",
                beats: {
                    start: { emotion: "刚察觉异常", facialAction: "眉头向中间收紧", gaze: "从床沿移向右侧门口", bodyAction: "手掌撑住床沿，肩膀停止后退" },
                    middle: { emotion: "确认危险", facialAction: "眼神快速扫过门缝", gaze: "短暂看向门外阴影", bodyAction: "右手握紧衣角，呼吸变浅" },
                    end: { emotion: "强行镇定", facialAction: "下颌绷住，嘴唇压成直线", gaze: "重新盯住右侧声源", bodyAction: "脊背贴住床头并抬起下巴" },
                },
            },
            lightingPlan: {
                palette: "冷青",
                colorTemperature: "4200K",
                keyLight: "窗侧硬光",
                fillLight: "弱补光",
                rimLight: "背后轮廓光",
                contrast: "中等反差",
                materialResponse: "金属反光偏冷",
                skinToneProtection: "脸部保留暖色",
                inheritFromPrevious: "无",
                transitionToNext: "冷光延续",
            },
            continuity: { shotSize: "中景", cameraAngle: "平视", composition: "人物居左", characterBlocking: "女主靠床", gazeDirection: "看向右侧", actionStart: "抬头", actionEnd: "停住", screenDirection: "向右", axisRule: "不越轴" },
            entryState: { emotion: "虚弱" },
            exitState: { emotion: "警觉" },
        };

        expect(reviewCompletionMissingFields(complete)).toEqual([]);
        expect(reviewCompletionSatisfies(complete, ["performancePlan", "lightingPlan", "continuity", "entryState", "exitState"])).toBe(true);
    });

    it("counts partial field progress without requiring every missing field", () => {
        const partial = {
            performancePlan: {
                emotionalObjective: "确认危险",
                emotionalArc: "从疑惑转为紧张",
                speechStyle: "压低声音，字尾收住",
                pace: "先慢后快",
                breath: "吸气变浅，句间停顿缩短",
                restraintLevel: "压住惊慌，只让手部和视线泄露警觉",
                beats: {
                    start: { emotion: "疑惑", facialAction: "眉头向中间收紧", gaze: "看向门口", bodyAction: "手掌撑住床沿" },
                    middle: { emotion: "紧张", facialAction: "眼神扫过门缝", gaze: "追向右侧声源", bodyAction: "手指收紧衣角" },
                    end: { emotion: "警觉", facialAction: "下颌绷住", gaze: "盯住门外阴影", bodyAction: "脊背贴住床头" },
                },
            },
            lightingPlan: { palette: "冷青", colorTemperature: "4200K", keyLight: "窗侧硬光", fillLight: "弱补光", rimLight: "背后轮廓光", materialResponse: "金属反光", skinToneProtection: "保留肤色" },
            continuity: { shotSize: "中景", cameraAngle: "平视", composition: "左侧留白", characterBlocking: "靠床", gazeDirection: "向右", actionStart: "抬头", actionEnd: "停住", screenDirection: "向右", axisRule: "不越轴" },
        };

        expect(reviewCompletionFilledCount(partial, ["performancePlan", "lightingPlan", "continuity", "entryState"])).toBe(2);
    });
});
