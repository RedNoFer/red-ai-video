import { describe, expect, it } from "vitest";

import { resolveSeedance25DirectorInstructions } from "./seedance-25";
import { resolveSeedance25VideoPromptRoute } from "./seedance-25-references";

describe("Seedance 2.5 video reference routing", () => {
    it("uses ordinary staging for 15/20-second shots and a timeline for 30-second shots", () => {
        expect(resolveSeedance25VideoPromptRoute({ durationSeconds: 15 })).toBe("basic-multimodal");
        expect(resolveSeedance25VideoPromptRoute({ durationSeconds: 20 })).toBe("basic-multimodal");
        expect(resolveSeedance25VideoPromptRoute({ durationSeconds: 30 })).toBe("timestamp-30s");
        expect(resolveSeedance25DirectorInstructions({ durationSeconds: 30 }).instructions).toContain("本次加载参考：30 秒精确时间轴");
    });

    it("lets an explicit operation override the duration route", () => {
        expect(resolveSeedance25VideoPromptRoute({ prompt: "把原视频延长到后续镜头", durationSeconds: 30 })).toBe("video-extension");
        expect(resolveSeedance25VideoPromptRoute({ prompt: "局部编辑，保留原片背景", durationSeconds: 15 })).toBe("video-edit");
        expect(resolveSeedance25VideoPromptRoute({ prompt: "使用白模作为动作控制", durationSeconds: 15 })).toBe("clay-renderer");
    });

    it("loads specialized direction references only when the request needs them", () => {
        const instructions = resolveSeedance25DirectorInstructions({ prompt: "两位真人在车内对话，参考@视频1的镜头节奏，但上次人物身份漂移", durationSeconds: 15 }).instructions;

        expect(instructions).toContain("附加参考：真人表演与对白");
        expect(instructions).toContain("附加参考：多人物空间调度");
        expect(instructions).toContain("附加参考：示例结构迁移");
        expect(instructions).toContain("附加参考：失败诊断");
        expect(resolveSeedance25DirectorInstructions({ prompt: "产品缓慢旋转", durationSeconds: 15 }).instructions).not.toContain("附加参考：真人表演与对白");
    });
});
