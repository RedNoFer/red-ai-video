import { describe, expect, it } from "vitest";
import type { DramaProject, DramaShot, DramaVideoReferenceBinding } from "./drama-project-contract";
import { compileDramaVideoSubmissionPrompt } from "./drama-video-submission";

describe("drama submission reference prefix", () => {
    it("places current image and voice bindings ahead of the original text without duplication", () => {
        const original = "【参数】5秒，9:16\n【时间轴】0-5秒：岚音凝视湖面；台词：别说话。";
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
        expect(prompt.startsWith("【参考图片】\n@图片1：场景「湖岸」\n\n【角色音色】")).toBe(true);
        expect(prompt).toContain("角色「岚音」：清亮温润\n轻微气声");
        expect(prompt).toContain("角色「陆川」：配音引用 @音频1");
        expect(prompt).not.toContain("固定音色提示词");
        expect(prompt).not.toContain("不增加对白");
        expect(prompt).toContain("实际说话内容以本提示词台词为准");
        expect(prompt.match(/完整说出本提示词已有的对白和旁白原句/gu)).toHaveLength(1);
        expect(prompt.endsWith(original)).toBe(true);
        expect(compile(prompt)).toBe(prompt);
        expect(compileDramaVideoSubmissionPrompt(prompt, project, shot, [], [])).toBe(original);
    });
});
