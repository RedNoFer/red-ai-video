import { describe, expect, it } from "vitest";

import { buildDramaAnalyzeSchemaInstruction } from "@/lib/server/drama-analyze-prompt";

describe("drama analyze Skill routing", () => {
    it("keeps schema fallback separate from director rules", () => {
        const instruction = buildDramaAnalyzeSchemaInstruction("video_prompt", { type: "object" });

        expect(instruction).toContain("JSON Schema");
        expect(instruction).not.toContain("Seedance");
        expect(instruction).not.toContain("静态帧");
    });

    it("routes visual and image phases through one shared static-frame rule", () => {
        const instruction = buildDramaAnalyzeSchemaInstruction("image_prompt", { type: "object" });
        const visualInstruction = buildDramaAnalyzeSchemaInstruction("visual", { type: "object" });

        expect(instruction).not.toContain("静态帧规则");
        expect(visualInstruction).not.toContain("静态帧规则");
        expect(instruction).toContain('"type":"object"');
    });
});
