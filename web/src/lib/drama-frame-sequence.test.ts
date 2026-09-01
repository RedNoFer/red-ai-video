import { describe, expect, it } from "vitest";

import type { DramaFrameBeat, DramaStoryboardFrame } from "./drama-project-contract";
import {
    defaultDramaFrameBeats,
    deleteDramaFrameBeat,
    insertDramaFrameBeat,
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
    it("rejects dialogue-only or camera-only frame content", () => {
        expect(validateDramaFrameVisualContent('耳语："你又来迟了"', '耳语："你又来迟了"')).toContain("每帧必须描述");
        expect(validateDramaFrameVisualContent("85mm沿铁砧慢推", "镜头沿铁砧慢推")).toContain("每帧必须描述");
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

        expect(prompt).toContain("景别：ELS");
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

    it("creates five continuous default beats and honors an explicit frame count", () => {
        const defaults = defaultDramaFrameBeats(15, "角色拔剑", "角色站在黑湖边");
        expect(defaults).toHaveLength(5);
        expect(defaults.map((frame) => [frame.startSecond, frame.endSecond])).toEqual([
            [0, 3],
            [3, 6],
            [6, 9],
            [9, 12],
            [12, 15],
        ]);
        expect(defaults.every((frame) => Number.isInteger(frame.startSecond) && Number.isInteger(frame.endSecond))).toBe(true);
        expect(defaultDramaFrameBeats(30, "角色拔剑", "角色站在黑湖边", 7)).toHaveLength(7);
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
