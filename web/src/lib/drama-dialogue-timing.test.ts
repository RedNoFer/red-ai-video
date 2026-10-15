import { describe, expect, it } from "vitest";

import { dramaDialogueFragmentOverlap, dramaDialogueTimingIssue, dramaDialogueTimingReminder, dramaUtteranceTimingIssues, estimateDramaDialogueSeconds, extractQuotedDramaDialogues, formatDramaDialogueLine } from "@/lib/drama-dialogue-timing";

describe("drama dialogue timing", () => {
    it("extracts dialogue after inline field labels and detects repeated fragments", () => {
        expect(extractQuotedDramaDialogues("动作与触发：对白表演：萧炎说：“纳兰小姐，你应该知道，在”")).toEqual([{ speaker: "萧炎", text: "纳兰小姐，你应该知道，在" }]);
        expect(dramaDialogueFragmentOverlap("纳兰小姐，你应该知道，在", "纳兰小姐，你应该知道，")).toBeGreaterThanOrEqual(8);
    });

    it("recognizes only the explicit voiceover labels without turning narration into direct speech", () => {
        const labels = ["心理旁白", "记忆旁白", "人物介绍旁白"];
        const lines = labels.map((label) => formatDramaDialogueLine(`齐岚（${label}）`, "她记得。"));
        expect(lines).toEqual(labels.map((label) => `齐岚（${label}）：“她记得。”`));
        expect(extractQuotedDramaDialogues(lines.join("；"))).toEqual(labels.map((label) => ({ speaker: `齐岚（${label}）`, text: "她记得。" })));
        expect(extractQuotedDramaDialogues("陆泊言说：“我记得。”")).toEqual([{ speaker: "陆泊言", text: "我记得。" }]);
        expect(extractQuotedDramaDialogues("齐岚：“她记得。”；齐岚（梦境旁白）：“她记得。”；齐岚（心理旁白）说：“她记得。”")).toEqual([]);
    });

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

it("does not report binary floating point residue as an overfull speech window", () => {
    expect(dramaDialogueTimingReminder(20.68 - 19.43, [{ type: "dialogue", text: "这是五个字", speechRateCharsPerSecond: 4 }])).toBeUndefined();
    expect(dramaDialogueTimingReminder(1.2, [{ type: "dialogue", text: "这是五个字", speechRateCharsPerSecond: 4 }])).toBeDefined();
});
