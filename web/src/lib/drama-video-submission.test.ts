import { describe, expect, it } from "vitest";
import type { DramaProject, DramaShot, DramaVideoReferenceBinding } from "./drama-project-contract";
import { compileDramaVideoSubmissionPrompt } from "./drama-video-submission";

describe("drama submission reference prefix", () => {
    it("strips accidentally embedded QC bookkeeping from submitted prompts", () => {
        const project = { id: "project", characters: [] } as unknown as DramaProject;
        const shot = { utterances: [] } as unknown as DramaShot;
        const dirty = "开场时，人物站在门边。\n00.0–05.0秒，人物停步，门外传来脚步。减切原因：结果停留；实际：3帧/2次硬切；修订状态：reduced-density-exception-registered-awaiting-final-QC。\n结束时，人物仍站在门边。";

        const prompt = compileDramaVideoSubmissionPrompt(dirty, project, shot, [], []);

        expect(prompt).toContain("人物停步，门外传来脚步。");
        expect(prompt).toContain("结束时，人物仍站在门边。");
        expect(prompt).not.toMatch(/减切原因|实际：3帧|修订状态|reduced-density-exception/iu);
    });

    it("places current image and voice bindings ahead of the original text without duplication", () => {
        const original = "开场时，岚音站在湖岸边，双脚踩在湿石上。\n00.0–05.0秒，岚音凝视湖面，听见岸边脚步后收紧手指，轻声说：“别说话。”原句清晰居前，水声在发声时压低。\n结束时，岚音仍站在湿石上，视线停在湖面。";
        const project = {
            id: "project",
            characters: [
                { id: "text", name: "岚音", voiceProfile: { timbrePrompt: "清亮温润\n轻微气声" } },
                { id: "audio", name: "陆川", voiceProfile: { creationSampleAssetId: "permanent/audio/sample.wav" } },
            ],
        } as DramaProject;
        const shot = { utterances: [] } as unknown as DramaShot;
        const bindings = [{ alias: "@图片1", role: "scene_anchor", purpose: "场景「湖岸」", url: "/scene.png" }] as DramaVideoReferenceBinding[];
        const compile = (prompt: string) => compileDramaVideoSubmissionPrompt(prompt, project, shot, bindings, ["text", "audio"]);
        const prompt = compile(original);
        expect(prompt).toContain("参考图片：\n@图片1：场景「湖岸」");
        expect(prompt).not.toContain("【参考图片】");
        expect(prompt).not.toContain("【角色音色】");
        expect(prompt).toContain("角色「岚音」：清亮温润\n轻微气声");
        expect(prompt).not.toContain("配音引用");
        expect(prompt).not.toContain("固定音色提示词");
        expect(prompt).not.toContain("不增加对白");
        expect(prompt).not.toContain("实际说话内容以本提示词台词为准");
        expect(prompt).not.toContain("完整说出本提示词已有的对白和旁白原句");
        expect(prompt).toContain("00.0–05.0秒，岚音凝视湖面，听见岸边脚步后收紧手指，轻声说：“别说话。”原句清晰居前，水声在发声时压低。");
        expect(prompt).toContain("开场时，岚音站在湖岸边，双脚踩在湿石上。");
        expect(prompt).toMatch(/\n声音：角色「岚音」：/u);
        expect(compile(prompt)).toBe(prompt);
        const withoutBindings = compileDramaVideoSubmissionPrompt(prompt, project, shot, [], []);
        expect(withoutBindings).toContain("岚音站在湖岸边，双脚踩在湿石上。");
        expect(withoutBindings).toContain("结束时，岚音仍站在湿石上，视线停在湖面。");
        expect(withoutBindings).not.toContain("参考图片：");
    });
});
