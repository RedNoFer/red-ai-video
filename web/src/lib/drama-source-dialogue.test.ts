import { describe, expect, it } from "vitest";
import { extractDramaSourceDialogues, normalizeDramaSpeaker } from "./drama-source-dialogue";

describe("source dialogue facts", () => {
    it("reads unquoted, indented multiline and explicitly attributed quoted dialogue in source order", () => {
        const source = "林雪：外套颜色没变，别说话。\n林雪儿：\n  第一行，\n  第二行。\n林雪轻声说：“收到。”\n信封上标着“证物”。";
        expect(extractDramaSourceDialogues(source, ["林雪", "林雪儿"]).map(({ speaker, text }) => ({ speaker, text }))).toEqual([
            { speaker: "林雪", text: "外套颜色没变，别说话。" },
            { speaker: "林雪儿", text: "第一行，\n  第二行。" },
            { speaker: "林雪", text: "收到。" },
            { speaker: undefined, text: "证物" },
        ]);
    });

    it("keeps legal appellations and similar names distinct while normalizing off-screen speech", () => {
        expect(normalizeDramaSpeaker("林雪（场内画外对白）")).toBe("林雪");
        expect(normalizeDramaSpeaker("林雪儿")).not.toBe(normalizeDramaSpeaker("林雪"));
        expect(extractDramaSourceDialogues("父亲：把信留下。")[0].speaker).toBe("父亲");
    });

    it("reads unindented wrapped dialogue without swallowing the next speaker or stage direction", () => {
        const source = "林雪：\n外套颜色没变，\n别说话。\n（林雪收回信封）\n林雪儿：收到。";
        expect(extractDramaSourceDialogues(source).map((line) => line.text)).toEqual(["外套颜色没变，\n别说话。", "收到。"]);
        expect(extractDramaSourceDialogues("林雪：收到。\n  （收回信封）\n  林雪儿：明白。").map((line) => line.text)).toEqual(["收到。", "明白。"]);
    });
});
