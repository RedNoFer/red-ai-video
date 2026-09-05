import { describe, expect, it } from "vitest";

import { dramaDialogueTimingIssue, dramaDialogueTimingReminder, dramaUtteranceTimingIssues, estimateDramaDialogueSeconds } from "@/lib/drama-dialogue-timing";

describe("drama dialogue timing", () => {
    it("accounts for emotional speech rate and pauses", () => {
        const estimate = estimateDramaDialogueSeconds([{ type: "dialogue", text: "三年之后我会找你。", speechRate: "克制偏慢", speechRateCharsPerSecond: 4, pauseBeforeSeconds: 0.5, pauseAfterSeconds: 1 }]);

        expect(estimate.spokenCharacters).toBe(8);
        expect(estimate.speechSeconds).toBe(2);
        expect(estimate.pauseSeconds).toBe(1.5);
        expect(estimate.minimumSeconds).toBe(4);
    });

    it("rejects missing, overlapping, or out-of-bounds utterance timing", () => {
        const issues = dramaUtteranceTimingIssues(
            10,
            [
                { type: "dialogue", order: 1, text: "先说", startSecond: 1, endSecond: 4, pauseBeforeSeconds: 0.5, pauseAfterSeconds: 0.5, speechRate: "克制", speechRateCharsPerSecond: 5 },
                { type: "dialogue", order: 2, text: "后说", startSecond: 3, endSecond: 11, pauseBeforeSeconds: 0, pauseAfterSeconds: 0, speechRate: "逼迫偏快", speechRateCharsPerSecond: 6 },
            ],
            true,
            "SH01",
        );

        expect(issues).toEqual(expect.arrayContaining([expect.stringContaining("时间重叠"), expect.stringContaining("必须在"), expect.stringContaining("停顿超出")]));
    });

    it("marks up to ten spoken characters as a light capacity deviation", () => {
        expect(dramaDialogueTimingIssue(15, ["甲".repeat(79)], "", "SH01")).toMatchObject({ withinTolerance: true, overageCharacters: 4 });
        expect(dramaDialogueTimingIssue(15, ["甲".repeat(85)], "", "SH01")).toMatchObject({ withinTolerance: true, overageCharacters: 10 });

        const issue = dramaDialogueTimingIssue(15, ["甲".repeat(86)], "", "SH01");
        expect(issue).toMatchObject({ withinTolerance: false });
        expect(issue?.message).toContain("不阻止导入");
    });

    it("measures the ten-character tolerance against the effective speech rate", () => {
        expect(dramaDialogueTimingIssue(15, [{ type: "dialogue", text: "甲".repeat(100), speechRateCharsPerSecond: 6 }], "", "SH01")).toMatchObject({ withinTolerance: true });
        expect(dramaDialogueTimingIssue(15, [{ type: "dialogue", text: "甲".repeat(101), speechRateCharsPerSecond: 6 }], "", "SH01")).toMatchObject({ withinTolerance: false });
    });

    it("returns a non-blocking reminder for any capacity overage", () => {
        const reminder = dramaDialogueTimingReminder(15, ["甲".repeat(79)], "", "SH01");

        expect(reminder).toMatchObject({ withinTolerance: true, overageCharacters: 4 });
        expect(reminder?.message).toContain("不阻止导入");
    });
});
