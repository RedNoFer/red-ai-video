import { describe, expect, it } from "vitest";

import { buildDramaAnalyzeSchemaInstruction } from "@/lib/server/drama-analyze-prompt";

describe("drama analyze Skill routing", () => {
    it("does not mix the static Seedance 2.0 contract into video prompt optimization", () => {
        const instruction = buildDramaAnalyzeSchemaInstruction("video_prompt", { type: "object" }, "Seedance 2.5 素材绑定规则");

        expect(instruction).toContain("Seedance 2.5 素材绑定规则");
        expect(instruction).not.toContain("本次视觉任务强制执行 Seedance 2.0 导演 Skill");
    });

    it("keeps the static Seedance 2.0 contract for visual and image phases", () => {
        const instruction = buildDramaAnalyzeSchemaInstruction("image_prompt", { type: "object" });

        expect(instruction).toContain("本次视觉任务强制执行 Seedance 2.0 导演 Skill");
    });
});
