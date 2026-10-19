import { describe, expect, it } from "vitest";
import type { DramaProject, DramaShot, DramaVideoReferenceBinding } from "./drama-project-contract";
import { compileDramaVideoSubmissionPrompt, buildVideoReferenceBindings } from "./drama-video-submission";

describe("drama submission reference prefix", () => {
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
        expect(prompt).toContain("【参考图片】：\n@图片1：场景「湖岸」");
        expect(prompt.indexOf("【参考图片】：")).toBeLessThan(prompt.indexOf("角色音色："));
        expect(prompt.indexOf("角色音色：")).toBeLessThan(prompt.indexOf("00.0–05.0秒"));
        expect(prompt).not.toContain("【角色音色】");
        expect(prompt).toContain("角色「岚音」：清亮温润 轻微气声");
        expect(prompt).toContain("角色「陆川」：配音引用 @音频1");
        expect(prompt).not.toContain("固定音色提示词");
        expect(prompt).not.toContain("不增加对白");
        expect(prompt).not.toContain("实际说话内容以本提示词台词为准");
        expect(prompt).not.toContain("完整说出本提示词已有的对白和旁白原句");
        expect(prompt).toContain("00.0–05.0秒，岚音凝视湖面，听见岸边脚步后收紧手指，轻声说：“别说话。”原句清晰居前，水声在发声时压低。");
        expect(prompt).toContain("开场时，岚音站在湖岸边，双脚踩在湿石上。");
        expect(compile(prompt)).toBe(prompt);
        const withoutBindings = compileDramaVideoSubmissionPrompt(prompt, project, shot, [], []);
        expect(withoutBindings).toContain("岚音站在湖岸边，双脚踩在湿石上。");
        expect(withoutBindings).toContain("结束时，岚音仍站在湿石上，视线停在湖面。");
        expect(withoutBindings).not.toContain("【参考图片】：");
        expect(withoutBindings).not.toContain("\n参考图片：");
    });

    it("keeps voice directly below image references for Cut to prompts with inline spoken time ranges", () => {
        const original = [
            "卡停在阿泽视线前；他长时间看着卡片，卡片不被手指拨动。",
            "Cut to：屏幕特写，85mm，静止；只确认波形起点数字。",
            "从9秒至17.3秒，原文旁白的声线为成年中性声，中低音区、共鸣平稳。",
            "结束时，录音卡仍在透明小袋内。",
            "声音：角色「阿泽」：旧音色内容。",
        ].join("\n");
        const project = { id: "project", characters: [{ id: "aze", name: "阿泽", voiceProfile: { timbrePrompt: "成年男性中低音区，胸腔共鸣厚实，普通话自然。" } }] } as DramaProject;
        const shot = { utterances: [] } as unknown as DramaShot;
        const bindings = [{ alias: "@图片1", role: "scene_anchor", purpose: "场景「车内」", url: "/scene.png" }] as DramaVideoReferenceBinding[];
        const compile = (prompt: string) => compileDramaVideoSubmissionPrompt(prompt, project, shot, bindings, ["aze"]);

        const prompt = compile(original);

        expect(prompt).toMatch(/【参考图片】：\n@图片1：场景「车内」\n\n角色音色：\n角色「阿泽」：成年男性中低音区，胸腔共鸣厚实，普通话自然。\n\n卡停在阿泽视线前/u);
        expect(prompt).toContain("从9秒至17.3秒，原文旁白的声线为成年中性声");
        expect(prompt).toContain("结束时，录音卡仍在透明小袋内。");
        expect(prompt).not.toContain("旧音色内容");
        expect(compile(prompt)).toBe(prompt);
    });

    it("injects package reference guidance into alias purposes and strips legacy 【参考】 blocks", () => {
        const project = {
            id: "project",
            characters: [{ id: "aze", name: "阿泽", references: [{ id: "ref-1", url: "/aze.png", source: "generated", label: "主基准", createdAt: "2026-01-01T00:00:00.000Z", status: "approved" }], primaryReferenceId: "ref-1" }],
            scenes: [],
            props: [],
            clues: [],
        } as unknown as DramaProject;
        const shot = { utterances: [], referenceIntents: [{ assetId: "aze", code: "CHAR_01", role: "character_anchor", guidance: "阿泽主外观与服装锁定" }] } as unknown as DramaShot;
        const bindings = buildVideoReferenceBindings(project, shot, [], ["aze"]);
        expect(bindings.map((binding) => binding.purpose)).toEqual(["角色「阿泽」（主外观与服装锁定）"]);

        const prompt = compileDramaVideoSubmissionPrompt("【参考】CHAR_01=阿泽主外观与服装锁定。\n参考仅提供外观与空间基准职责。\n\n开场时，阿泽站在门口。", project, shot, bindings, ["aze"]);
        expect(prompt).not.toContain("CHAR_01");
        expect(prompt).toContain("开场时，阿泽站在门口。");
        expect(prompt).toContain("【参考图片】：\n@图片1：角色「阿泽」（主外观与服装锁定）");
        expect(prompt.indexOf("【参考图片】：")).toBe(0);
    });
});
