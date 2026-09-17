import { describe, expect, it } from "vitest";

import {
    isGenericDramaDetail,
    validateDramaCameraPlan,
    validateDramaDialogueSegmentDetail,
    validateDramaNpcSegmentDetail,
    validateDramaPerformanceDetail,
    validateDramaVideoAuthoringQuality,
    validateDramaVideoPromptTemplateLayout,
    validateDramaVideoSegmentDetail,
} from "./drama-prompt-quality";

describe("drama prompt quality", () => {
    it("recognizes generic placeholder performance language", () => {
        expect(isGenericDramaDetail("表情自然")).toBe(true);
        expect(isGenericDramaDetail("眉心收紧，右手扣住桌沿，视线停在对方的手上")).toBe(false);
    });

    it("requires observable changes in each video timeline segment", () => {
        expect(validateDramaVideoSegmentDetail("情绪加剧", "保持本镜可见反应", "保持状态", "SH01")).toHaveLength(2);
        expect(validateDramaVideoSegmentDetail("萧炎抬眼，右手指节压紧桌沿", "纳兰嫣然的目光掠向北侧首位", "茶盏仍停在萧战手边，六名旁听者同时收声", "SH01")).toEqual([]);
        expect(validateDramaVideoSegmentDetail("萧炎抬眼，右手指节压紧桌沿", "", "萧炎停在桌案旁", "SH01", { requiresBackgroundNpc: true })).toEqual([expect.stringContaining("背景 NPC")]);
    });

    it("requires concrete performance and dialogue reactions", () => {
        const errors = validateDramaPerformanceDetail(
            {
                emotionalObjective: "守住秘密",
                emotionalArc: "平静到警觉",
                speechStyle: "压低声音，句尾收住",
                pace: "前慢后快",
                breath: "说前屏息，说完短促呼气",
                restraintLevel: "克制",
                beats: {
                    start: { emotion: "平静", facialAction: "眉眼放松", gaze: "看向对方", bodyAction: "左手压住桌沿" },
                    middle: { emotion: "警觉", facialAction: "眉心收紧", gaze: "扫向门口", bodyAction: "右肩后撤" },
                    end: { emotion: "紧张", facialAction: "下颌绷住", gaze: "锁定门缝", bodyAction: "手指扣紧桌沿" },
                },
            },
            [
                {
                    utteranceId: "u1",
                    intent: "试探对方是否知情",
                    tone: "压低声音，尾音上扬",
                    pace: "每个短句之间停半拍",
                    pause: "说出关键称谓前停顿",
                    emphasis: "重读‘你看见了吗’",
                    facialReactionBefore: "先抬眼确认对方视线",
                    facialReactionDuring: "说到关键称谓时眉心收紧",
                    facialReactionAfter: "闭口后保持盯视，不移开视线",
                },
            ],
            1,
            "SH01",
        );
        expect(errors).toEqual([]);
    });

    it("requires machine-checkable NPC distribution and reaction", () => {
        const valid = "NPC群像：7名；分布：前景2名、中景3名、后景2名；密度：中低密度；反应：后景旁听者收声低头，中景两人抬眼看向首位";
        expect(validateDramaNpcSegmentDetail(valid, "SH01", { min: 5, max: 8 })).toEqual([]);
        expect(validateDramaNpcSegmentDetail("NPC群像：7名；分布：前景1名、中景3名、后景2名；密度：中低密度；反应：保持关注", "SH01", { min: 5, max: 8 })).not.toEqual([]);
    });

    it("accepts stable NPC slots without treating screen depth as identity", () => {
        const valid = "NPC连续性：可见槽位：seat-left-01、seat-wall-02；世界锚点：左侧后席、北墙阴影处；状态变化：seat-left-01从低头看纸延迟抬眼，seat-wall-02保持贴墙收声";
        expect(validateDramaNpcSegmentDetail(valid, "SH01")).toEqual([]);
        expect(validateDramaNpcSegmentDetail("NPC连续性：可见槽位：seat-left-01；世界锚点：左侧后席；状态变化：保持状态", "SH01")).not.toEqual([]);
    });

    it("requires dialogue performance details inside each segment", () => {
        expect(validateDramaDialogueSegmentDetail("萧炎抬眼；对白表演：萧炎说：“他是一族之长。”；语气：压怒；停顿：半拍；重音：落在父亲；说后反应：闭口盯视", "SH01")).toEqual([]);
        expect(validateDramaDialogueSegmentDetail("萧炎开口，情绪加剧", "SH01")).not.toEqual([]);
        expect(validateDramaDialogueSegmentDetail("对白表演：说话人：萧炎；语气：低声克制；停顿：半拍；重音：纳兰小姐；说后反应：视线承接", "SH01")).toEqual(expect.arrayContaining([expect.stringContaining("实际台词")]));
    });

    it("requires the production video prompt layout and one named shot per frame", () => {
        const prompt = [
            "【重要剪辑指令】\n真实硬切。",
            "【素材绑定】\n@图片1：角色。",
            "【故事意图】\n把压力交还给对手。",
            "【空间与连续性】\n180度轴线不变。",
            "【灯光与画面】\n左侧窗光。",
            "【摄影总则】\n近景保持脸部清晰。",
            "【逐镜头时间线】\n镜头1，00.0—02.0秒，起点：萧炎低头；动作与触发：萧炎抬眼；可见衔接：纳兰接住视线；终点：萧炎抬眼停住。\n镜头2，02.0—04.0秒，起点：萧炎抬眼；动作与触发：右手压住桌沿；可见衔接：桌沿出现受力；终点：指节停在桌沿。",
            "【硬性禁止】\n不新增人物。",
        ].join("\n\n");
        expect(validateDramaVideoPromptTemplateLayout(prompt, 2, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptTemplateLayout(prompt.replace("镜头2，", "时间段2，"), 2, "SH01")).toEqual(expect.arrayContaining([expect.stringContaining("写出")]));
    });

    it("does not treat keyframe boundaries as implicit cuts", () => {
        const prompt = "时间段动作：0-10秒；10-21秒；21-30秒\n单一主运镜：镜头模式：连续镜头；中景平视沿中央长桌缓慢推进";
        expect(
            validateDramaCameraPlan(prompt, [
                { startSecond: 0, endSecond: 10 },
                { startSecond: 10, endSecond: 21 },
                { startSecond: 21, endSecond: 30 },
            ]),
        ).toBe("");
    });

    it("requires complete, frame-aligned camera cut events", () => {
        const prompt = [
            "时间段动作：0-10秒；10-21秒；21-30秒",
            "单一主运镜：镜头模式：内部切镜（1次）；先中景固定，再切近景",
            "可见衔接：镜头事件：10秒；类型：硬切；触发事件：萧炎抬眼质问；新机位：近景平视锁定萧炎与纳兰；切后主运镜：锁定机位，随萧炎呼吸保留极轻微手持；信息目的：把家族压力收束到质问；承接：沿180度轴线接住萧炎视线",
        ].join("\n");
        expect(
            validateDramaCameraPlan(prompt, [
                { startSecond: 0, endSecond: 10 },
                { startSecond: 10, endSecond: 21 },
                { startSecond: 21, endSecond: 30 },
            ]),
        ).toBe("");
        expect(
            validateDramaCameraPlan(prompt.replace("切后主运镜：锁定机位，随萧炎呼吸保留极轻微手持；", ""), [
                { startSecond: 0, endSecond: 10 },
                { startSecond: 10, endSecond: 21 },
                { startSecond: 21, endSecond: 30 },
            ]),
        ).toContain("切后主运镜");
        expect(
            validateDramaCameraPlan(prompt.replace("镜头事件：10秒", "镜头事件：11秒"), [
                { startSecond: 0, endSecond: 10 },
                { startSecond: 10, endSecond: 21 },
                { startSecond: 21, endSecond: 30 },
            ]),
        ).toContain("段起点边界");
    });

    it("blocks mechanical action, emotion, NPC, and camera-motivation repetition in Agent authoring", () => {
        const performancePlan = {
            emotionalObjective: "把私人难堪转成维护父亲族长颜面的质问",
            emotionalArc: "由压抑承受到抬眼质问再到停住呼吸等待回应",
            speechStyle: "冷笑压怒，提到父亲时重音下沉",
            pace: "前段短促，中段连续，结尾放慢",
            breath: "起始压住呼吸，中段短吸，结束屏息",
            restraintLevel: "由克制转为锋利",
            beats: {
                start: { emotion: "承受难堪", facialAction: "眼睑下压", gaze: "看向桌面", bodyAction: "肩背低伏，指节贴住桌沿" },
                middle: { emotion: "转为质问", facialAction: "眉心收紧", gaze: "从萧战转回纳兰", bodyAction: "肩背抬高，右手压住桌沿" },
                end: { emotion: "冷硬停顿", facialAction: "嘴角冷笑收平", gaze: "直视纳兰", bodyAction: "下颌定住并屏息" },
            },
        };
        const frames = [
            {
                startSecond: 0,
                endSecond: 10,
                actionPrompt: "萧炎抬眼接住纳兰视线，右手指节压住桌沿\nNPC群像：7名；分布：前景2名、中景3名、后景2名；密度：中低密度；反应：旁听者收声低头",
                transitionPrompt: "纳兰视线不移",
                endPrompt: "萧炎抬眼，右手仍压住桌沿",
            },
            {
                startSecond: 10,
                endSecond: 21,
                actionPrompt: "萧炎说到父亲时短促吸气，肩背抬高并回看萧战\nNPC群像：7名；分布：前景2名、中景3名、后景2名；密度：中低密度；反应：中景三人抬眼看向首位",
                transitionPrompt: "萧战离开椅背",
                endPrompt: "萧炎肩背直起并回看纳兰",
            },
        ];
        const prompt = "单一主运镜：镜头模式：连续镜头；中景平视沿中央长桌缓慢推进，服务于萧炎抬眼锁定纳兰的视线压力";
        expect(validateDramaVideoAuthoringQuality(prompt, frames, performancePlan, "SH01", { requiresBackgroundNpc: true })).toEqual([]);

        const repeatedFrames = frames.map((frame) => ({ ...frame, actionPrompt: frames[0].actionPrompt }));
        const repeatedPlan = { ...performancePlan, beats: { start: performancePlan.beats.start, middle: performancePlan.beats.start, end: performancePlan.beats.start } };
        const errors = validateDramaVideoAuthoringQuality("单一主运镜：镜头模式：连续镜头；中景平视沿中央长桌缓慢推进，服务于当前信息或动作变化", repeatedFrames, repeatedPlan, "SH01", { requiresBackgroundNpc: true });
        expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("动作完全重复"), expect.stringContaining("情绪递进"), expect.stringContaining("NPC 反应没有变化"), expect.stringContaining("主运镜缺少具体动机")]));
    });
});
