import { describe, expect, it } from "vitest";

import { buildDramaAnalyzeSchemaInstruction } from "@/lib/server/drama-analyze-prompt";

describe("drama analyze Skill routing", () => {
    it("does not mix the static Seedance 2.0 contract into video prompt optimization", () => {
        const instruction = buildDramaAnalyzeSchemaInstruction("video_prompt", { type: "object" }, "Seedance 2.5 素材绑定规则");

        expect(instruction).toContain("Seedance 2.5 素材绑定规则");
        expect(instruction).not.toContain("本次视觉任务强制执行 Seedance 2.0 导演 Skill");
    });

    it("routes visual and image phases through one shared static-frame rule", () => {
        const instruction = buildDramaAnalyzeSchemaInstruction("image_prompt", { type: "object" });
        const visualInstruction = buildDramaAnalyzeSchemaInstruction("visual", { type: "object" });

        expect(instruction).toContain("本次静态图片帧任务只执行一次静态帧规则");
        expect(visualInstruction).toContain("本次视觉任务只执行一次静态帧规则");
        expect((visualInstruction.match(/静态帧使用现有/gu) || []).length).toBe(1);
    });
});
