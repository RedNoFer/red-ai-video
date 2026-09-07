import { describe, expect, it } from "vitest";

import { isGenericDramaDetail, validateDramaPerformanceDetail } from "./drama-prompt-quality";

describe("drama prompt quality", () => {
    it("recognizes generic placeholder performance language", () => {
        expect(isGenericDramaDetail("表情自然")).toBe(true);
        expect(isGenericDramaDetail("眉心收紧，右手扣住桌沿，视线停在对方的手上")).toBe(false);
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
});
