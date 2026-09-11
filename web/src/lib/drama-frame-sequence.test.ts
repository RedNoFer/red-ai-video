import { describe, expect, it } from "vitest";

import type { DramaFrameBeat, DramaStoryboardFrame } from "./drama-project-contract";
import {
    deleteDramaFrameBeat,
    formatPromptFieldLines,
    insertDramaFrameBeat,
    isCurrentDramaStaticFramePrompt,
    normalizeDramaFrameBeats,
    planDramaVideoSegments,
    updateDramaFrameBeat,
    upgradeDramaFrameImagePrompt,
    validateDramaFramePlanVisuals,
    validateDramaFrameVisualContent,
} from "./drama-frame-sequence";

const beats: DramaFrameBeat[] = [
    { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "抬头", imagePrompt: "人物低头后抬眼" },
    { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 4, actionPrompt: "握剑", imagePrompt: "人物握紧断剑" },
    { id: "f3", sequenceIndex: 3, startSecond: 4, endSecond: 6, actionPrompt: "转身", imagePrompt: "人物转向湖面" },
    { id: "f4", sequenceIndex: 4, startSecond: 6, endSecond: 8, actionPrompt: "冲刺", imagePrompt: "人物向倒塔冲刺" },
];

describe("drama frame sequence", () => {
    it("normalizes known prompt fields onto independent lines", () => {
        expect(formatPromptFieldLines("静态关键帧：角色站立；可见状态：手掌扣住剑柄，景别：中景；机位与构图：平视")).toBe("静态关键帧：角色站立\n可见状态：手掌扣住剑柄\n景别：中景\n机位与构图：平视");
        expect(formatPromptFieldLines("动态意图：角色抬头，单一主运镜：固定机位；结束画面：视线锁定目标", "video")).toBe("动态意图：角色抬头\n单一主运镜：固定机位\n结束画面：视线锁定目标");
    });

    it("recognizes the complete public static-frame contract without rewriting it", () => {
        const prompt = [
            "静态关键帧：Karin站在门边，手掌压住断剑",
            "可见状态：指节发白，断剑贴在右手掌心",
            "可见表演状态：眉心收紧，视线锁定门缝，肩背绷直",
            "景别：中景",
            "机位与构图：视线高度平视，主体位于画面右侧，前景有门框",
            "站位与视线：Karin站在右侧门框内，身体朝向门缝，视线落向门外",
            "三层空间：前景门框，中景Karin与断剑，背景交代大厅纵深",
            "光色与风格：冷灰侧光，保留木石和金属材质纹理",
            "负面约束：无字幕、无水印、无logo、无HUD、无额外主体",
        ].join("\n");

        expect(isCurrentDramaStaticFramePrompt(prompt)).toBe(true);
        expect(isCurrentDramaStaticFramePrompt(prompt.replace("可见状态：指节发白，断剑贴在右手掌心", "可见状态：动作展开"))).toBe(false);
    });

    it("removes legacy reference duties from static prompts", () => {
        const prompt = formatPromptFieldLines(
            "静态关键帧：Karin站在黑湖边；可见状态：四只手扣住断剑；可见表演状态：眉眼清晰；景别：中景；机位与构图：平视；站位与视线：视线落向断剑；三层空间：前景雪地，中景Karin，背景倒悬古塔；光色与风格：冷白无源光；参考图职责：按角色、场景、道具图片执行；负面约束：无水印",
        );

        expect(prompt.split("\n")).toHaveLength(9);
        expect(prompt).not.toContain("参考图职责：");
        expect(prompt).toContain("负面约束：无水印");
    });

    it("rejects dialogue-only or camera-only frame content", () => {
        expect(validateDramaFrameVisualContent('耳语："你又来迟了"', '耳语："你又来迟了"')).toContain("每帧必须描述");
        expect(validateDramaFrameVisualContent("85mm沿铁砧慢推", "镜头沿铁砧慢推")).toContain("每帧必须描述");
    });

    it("allows camera and dialogue prohibitions inside the negative field", () => {
        const prompt = [
            "静态关键帧：人物站在门边，手掌压住门闩",
            "可见状态：门闩已经落下，门缝露出冷光",
            "可见表演状态：眉心收紧，嘴角压住，视线锁定门缝，肩背绷直",
            "景别：中景",
            "机位与构图：视线高度平视，主体位于右侧，前景有门框",
            "站位与视线：人物站在门边，身体朝向门缝，视线落向门外",
            "三层空间：前景门框，中景人物，背景交代大厅通道",
            "光色与风格：冷灰侧光，木石材质纹理清晰",
            "负面约束：无运镜过程、无对白、无声音指令、无水印",
        ].join("\n");

        expect(validateDramaFrameVisualContent(prompt, "人物压住门闩")).toBeUndefined();
        expect(isCurrentDramaStaticFramePrompt(prompt)).toBe(true);
    });

    it("still flags camera language in positive static fields", () => {
        expect(validateDramaFrameVisualContent("静态关键帧：人物站在门边并沿大厅缓慢推进\n负面约束：无运镜过程", "人物站立")).toContain("不能包含运镜");
    });

    it("rejects reference duties embedded in static frame content", () => {
        expect(validateDramaFrameVisualContent("静态关键帧：Karin站立；参考图职责：角色图、场景图；负面约束：无水印", "站立")).toContain("参考图职责属于资产绑定数据");
    });

    it("rejects ELS prompts that also demand readable facial or hand detail", () => {
        expect(validateDramaFrameVisualContent("ELS，面部清晰可读，手部细节明显", "ELS静帧")).toContain("ELS/极远景");
    });

    it("rejects adjacent frames without a visible state change", () => {
        expect(
            validateDramaFramePlanVisuals([
                { ...beats[0], imagePrompt: "角色站在门边" },
                { ...beats[1], imagePrompt: "角色站在门边" },
            ]),
        ).toEqual(["第 2 帧与上一帧的可见画面没有变化，请补充本帧状态变化"]);
    });

    it("rejects adjacent frames whose visible states only differ by filler wording", () => {
        const first = ["静态关键帧：萧炎坐在长桌右侧", "可见状态：右手按住桌沿，茶盏水面出现细小波纹", "可见表演状态：眉心收紧，视线看向纳兰，肩背前倾"].join("\n");
        const second = ["静态关键帧：萧炎坐于长桌右侧", "可见状态：右手已经按住桌沿，茶盏水面已出现细小波纹", "可见表演状态：眉心收紧，视线注视纳兰，肩背前倾"].join("\n");

        expect(
            validateDramaFramePlanVisuals([
                { ...beats[0], imagePrompt: first },
                { ...beats[1], imagePrompt: second },
            ]),
        ).toEqual(["第 2 帧与上一帧的语义状态重复，请补充姿态、视线、手部/道具或环境结果变化"]);
    });

    it("rejects generic phase labels as the only visible frame state", () => {
        expect(validateDramaFrameVisualContent("静态关键帧：角色站在门边；可见状态：入口构图已建立", "建立场景")).toContain("动作节点已经造成的可见状态变化");
    });

    it("adds a distinct photographic role to each multi-frame image prompt", () => {
        const prompt = [
            "静态关键帧：萧炎坐在长桌右侧",
            "可见状态：右手按住桌沿，茶盏水面出现细小波纹",
            "可见表演状态：眉心收紧，视线看向纳兰，肩背前倾",
            "景别：中景",
            "机位与构图：视线高度平视，主体位于画面安全区",
            "站位与视线：萧炎坐在长桌右侧，视线落向纳兰",
            "三层空间：前景门框，中景人物，背景议事大厅",
            "光色与风格：冷灰暖金，背景结构清晰",
            "负面约束：无字幕、无水印",
        ].join("\n");
        const context = {
            description: "萧炎在议事大厅与纳兰对峙",
            shotSize: "中景",
            cameraAngle: "视线高度平视",
            composition: "主体位于画面安全区",
            characterBlocking: "萧炎坐在长桌右侧，纳兰站在左侧",
            gazeDirection: "视线落向纳兰",
            lighting: "南侧暖光与室内冷反射",
            colorPalette: "冷灰暖金",
            characterCount: 3,
            frameCount: 4,
        };

        expect(upgradeDramaFrameImagePrompt(prompt, "建立三人关系", { ...context, sequenceIndex: 1 })).toContain("关系建立构图");
        expect(upgradeDramaFrameImagePrompt(prompt, "抬眼看向纳兰", { ...context, sequenceIndex: 2 })).toContain("对话反应构图");
        expect(upgradeDramaFrameImagePrompt(prompt, "按住茶盏", { ...context, sequenceIndex: 3 })).toContain("观察构图");
        expect(upgradeDramaFrameImagePrompt(prompt, "停在新的终点", { ...context, sequenceIndex: 4 })).toContain("反应构图");
    });

    it("rejects generic performance labels that hide the frame's key point", () => {
        expect(validateDramaFrameVisualContent("静态关键帧：三人站在大厅；可见状态：萧炎低头；可见表演状态：警觉；眉眼、呼吸、手部和道具接触关系清晰可见，情绪通过身体动作呈现")).toContain("当前节点的具体表演反应");
    });

    it("derives concrete facial, hand and environment changes from a frame action", () => {
        const prompt = upgradeDramaFrameImagePrompt(
            "静态关键帧：三人站在大厅；可见状态：萧炎抬眼扫过萧战，右手在桌沿收紧，茶水出现细小波纹；可见表演状态：警觉；眉眼、呼吸、手部和道具接触关系清晰可见，情绪通过身体动作呈现",
            "萧炎抬眼扫过萧战，右手在桌沿收紧，茶水出现细小波纹",
            {
                description: "三人站在议事大厅",
                shotSize: "中景",
                cameraAngle: "平视",
                composition: "主体位于画面右侧",
                characterBlocking: "三人沿大厅轴线站位",
                gazeDirection: "萧炎看向萧战",
                lighting: "暖金侧光",
                colorPalette: "冷灰紫",
                sequenceIndex: 2,
            },
        );

        expect(prompt).toContain("眉眼抬起");
        expect(prompt).toContain("手指或手掌收紧");
        expect(prompt).toContain("关键道具或环境留下与动作对应的可见结果");
        expect(prompt).not.toContain("主体的眉眼、呼吸、手部和道具接触关系清晰可见");
    });

    it("keeps image prompts static and strips video-only direction", () => {
        const prompt = upgradeDramaFrameImagePrompt("当前帧可见画面：”镜头沿倒塔垂直慢推至裂口，再匹配切到马车中Karin猛然睁眼、手扣断剑。ELS→ECU；视线高度平视", "耳语：“你又来迟了", {
            description: "黑湖中的倒塔",
            shotSize: "ELS→ECU",
            cameraAngle: "平视",
            composition: "人物位于画面中央",
            characterBlocking: "Karin坐在马车内",
            gazeDirection: "视线落在断剑",
            lighting: "冷光",
            colorPalette: "深蓝黑",
            sequenceIndex: 2,
        });

        expect(prompt).toContain("静态关键帧：马车中Karin猛然睁眼、手扣断剑");
        expect(prompt).toContain("景别：ECU");
        expect(prompt).toContain("机位与构图：平视");
        expect(prompt).not.toContain("镜头");
        expect(prompt).not.toContain("ELS→ECU");
        expect(prompt).not.toContain("耳语");
        expect(prompt).not.toContain("当前帧可见画面");
    });

    it("does not preserve a dynamic shot transition hidden in an otherwise static prompt", () => {
        const prompt = upgradeDramaFrameImagePrompt("静态关键帧：黑湖无波，倒悬古塔与倒影对齐；可见表演状态：表情保持稳定；景别（本帧固定）：ELS→ECU；冻结为单一静态姿态", "黑湖无波，倒悬古塔与倒影对齐", {
            description: "黑湖记忆",
            shotSize: "ELS→ECU",
            cameraAngle: "平视",
            composition: "主体位于9:16安全区",
            characterBlocking: "Karin站在湖边",
            gazeDirection: "视线朝向倒悬古塔",
            lighting: "无源冷光",
            colorPalette: "深蓝黑与雪白",
            sequenceIndex: 1,
        });

        expect(prompt).toContain("景别：中远景");
        expect(prompt).not.toContain("ELS→ECU");
    });

    it("falls back to the shot description when legacy text is dialogue or camera-only", () => {
        const prompt = upgradeDramaFrameImagePrompt('当前帧可见画面：耳语："你又来迟了"；85mm沿铁砧慢推', '耳语："你又来迟了"', {
            description: "黑暗铁匠铺中的木匣与铁砧",
            shotSize: "特写",
            cameraAngle: "平视",
            composition: "铁砧居中",
            characterBlocking: "主体位于中景",
            gazeDirection: "视线落在木匣",
            lighting: "炉火侧光",
            colorPalette: "暗琥珀",
        });

        expect(prompt).toContain("静态关键帧：黑暗铁匠铺中的木匣与铁砧");
        expect(prompt).not.toContain("耳语");
        expect(prompt).not.toContain("慢推");
        expect(prompt).not.toContain("“");
        expect(prompt).not.toContain("”");
    });

    it("normalizes the newer 本帧可见画面 prefix into a static keyframe subject", () => {
        const prompt = upgradeDramaFrameImagePrompt("本帧可见画面：黑湖无波，倒悬古塔与倒影对齐", "黑湖无波，倒悬古塔与倒影对齐", {
            description: "黑湖记忆",
            shotSize: "ELS",
            cameraAngle: "平视",
            composition: "主体位于9:16安全区",
            characterBlocking: "Karin站在湖边",
            gazeDirection: "视线朝向倒悬古塔",
            lighting: "无源冷光",
            colorPalette: "深蓝黑与雪白",
        });

        expect(prompt).toContain("静态关键帧：黑湖无波，倒悬古塔与倒影对齐");
        expect(prompt).not.toContain("本帧可见画面");
    });

    it("normalizes a plain frame description instead of sending an action process", () => {
        const prompt = upgradeDramaFrameImagePrompt("两人缩短距离", "两人向前靠近", {
            description: "雨夜车站，两人隔着站台对视",
            shotSize: "中景",
            cameraAngle: "平视",
            composition: "主体位于画面中央",
            characterBlocking: "两人分置画面左右",
            gazeDirection: "彼此对视",
            lighting: "雨夜冷光",
            colorPalette: "雾蓝灰",
        });

        expect(prompt).toContain("静态关键帧：雨夜车站，两人隔着站台对视");
        expect(prompt).not.toContain("缩短距离");
        expect(prompt).not.toContain("向前靠近");
    });

    it("preserves decimal frame boundaries inside an integer-second shot", () => {
        const normalized = normalizeDramaFrameBeats(
            beats.map((frame, index) => ({ ...frame, startSecond: index === 0 ? 0 : frame.startSecond - 0.2, endSecond: index === beats.length - 1 ? 8 : frame.endSecond - 0.2 })),
            8,
        );
        expect(normalized.map((frame) => [frame.startSecond, frame.endSecond])).toEqual([
            [0, 1.8],
            [1.8, 3.8],
            [3.8, 5.8],
            [5.8, 8],
        ]);
        expect(normalized.some((frame) => !Number.isInteger(frame.endSecond))).toBe(true);
    });

    it("accepts one to nine ordered beats that continuously cover the shot", () => {
        expect(normalizeDramaFrameBeats(beats, 8)).toEqual(beats);
        expect(() => normalizeDramaFrameBeats([{ ...beats[0], endSecond: 1 }], 8)).toThrow("完整覆盖");
        expect(() => normalizeDramaFrameBeats([...beats, ...Array.from({ length: 6 }, (_, index) => ({ ...beats[0], id: `extra-${index}`, sequenceIndex: index + 5 }))], 8)).toThrow("最多 9 帧");
    });

    it("preserves Agent-authored frame start, transition and end descriptions", () => {
        const result = normalizeDramaFrameBeats(
            [
                { ...beats[0], startPrompt: "人物低头，手掌已经扣住剑柄", transitionPrompt: "手指收紧，视线仍压在剑柄上", endPrompt: "剑柄被稳定握住" },
                { ...beats[1], startPrompt: "剑柄被稳定握住", transitionPrompt: "人物抬头，视线沿门框移向门外", endPrompt: "人物抬头看向门外" },
                ...beats.slice(2),
            ],
            8,
        );

        expect(result.slice(0, 2)).toMatchObject([
            { startPrompt: "人物低头，手掌已经扣住剑柄", transitionPrompt: "手指收紧，视线仍压在剑柄上", endPrompt: "剑柄被稳定握住" },
            { startPrompt: "剑柄被稳定握住", transitionPrompt: "人物抬头，视线沿门框移向门外", endPrompt: "人物抬头看向门外" },
        ]);
    });

    it("splits and merges time segments while preserving continuous coverage", () => {
        const inserted = insertDramaFrameBeat(beats, "f2");
        expect(inserted).toHaveLength(5);
        expect(inserted.map((item) => [item.startSecond, item.endSecond])).toEqual([
            [0, 2],
            [2, 3],
            [3, 4],
            [4, 6],
            [6, 8],
        ]);

        expect(deleteDramaFrameBeat(inserted, inserted[2].id).map((item) => [item.startSecond, item.endSecond])).toEqual([
            [0, 2],
            [2, 4],
            [4, 6],
            [6, 8],
        ]);
    });

    it("invalidates the edited frame and all following images, but action-only edits start after it", () => {
        const frames: DramaStoryboardFrame[] = beats.map((beat) => ({ id: beat.id, sequenceIndex: beat.sequenceIndex, source: "generated", status: "success", mediaUrl: `/${beat.id}.png`, inputHash: beat.id, continuityStatus: "passed" }));
        const imageEdit = updateDramaFrameBeat(beats, frames, "f2", { imagePrompt: "人物双手握剑" });
        expect(imageEdit.frames.map((item) => item.status)).toEqual(["success", "stale", "stale", "stale"]);
        const actionEdit = updateDramaFrameBeat(beats, frames, "f2", { actionPrompt: "缓慢握剑" });
        expect(actionEdit.frames.map((item) => item.status)).toEqual(["success", "success", "stale", "stale"]);
    });

    it("groups adjacent beats by provider duration and total reference budget without dropping assets", () => {
        expect(planDramaVideoSegments(beats, { minDurationSeconds: 2, maxDurationSeconds: 5, maxReferenceImages: 6, assetReferenceCount: 3 })).toEqual([
            { startIndex: 0, endIndex: 2, startSecond: 0, endSecond: 4, duration: 4, frameIds: ["f1", "f2", "f3"] },
            { startIndex: 2, endIndex: 3, startSecond: 4, endSecond: 8, duration: 4, frameIds: ["f3", "f4"] },
        ]);
        expect(planDramaVideoSegments(beats, { minDurationSeconds: 2, maxDurationSeconds: 5, maxReferenceImages: 6, assetReferenceCount: 3 })[0].frameIds.at(-1)).toBe(
            planDramaVideoSegments(beats, { minDurationSeconds: 2, maxDurationSeconds: 5, maxReferenceImages: 6, assetReferenceCount: 3 })[1].frameIds[0],
        );
        expect(() => planDramaVideoSegments(beats, { minDurationSeconds: 5, maxDurationSeconds: 5, maxReferenceImages: 3, assetReferenceCount: 3 })).toThrow("无法同时容纳");
        const longTail = [
            { ...beats[0], endSecond: 2 },
            { ...beats[1], startSecond: 2, endSecond: 10 },
        ];
        expect(() => planDramaVideoSegments(longTail, { minDurationSeconds: 2, maxDurationSeconds: 5, maxReferenceImages: 2, assetReferenceCount: 0 })).toThrow("最后一个视频子段");
    });
});
