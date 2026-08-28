import { describe, expect, it } from "vitest";

import type { DramaFrameBeat, DramaStoryboardFrame } from "./drama-project-contract";
import { deleteDramaFrameBeat, insertDramaFrameBeat, normalizeDramaFrameBeats, planDramaVideoSegments, updateDramaFrameBeat } from "./drama-frame-sequence";

const beats: DramaFrameBeat[] = [
    { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "抬头", imagePrompt: "人物低头后抬眼" },
    { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 4, actionPrompt: "握剑", imagePrompt: "人物握紧断剑" },
    { id: "f3", sequenceIndex: 3, startSecond: 4, endSecond: 6, actionPrompt: "转身", imagePrompt: "人物转向湖面" },
    { id: "f4", sequenceIndex: 4, startSecond: 6, endSecond: 8, actionPrompt: "冲刺", imagePrompt: "人物向倒塔冲刺" },
];

describe("drama frame sequence", () => {
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
