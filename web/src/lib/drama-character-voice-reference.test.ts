import { describe, expect, it } from "vitest";
import { appendDramaCharacterVoiceBindings, dramaCharacterVoiceReference, dramaShotCharacterVoiceReferences, stripDramaCharacterVoiceBindings } from "./drama-character-voice-reference";
import { normalizeDramaVoiceProfile } from "./drama-voice";
import type { DramaCharacter } from "./drama-project-contract";

const heroine = (overrides: Partial<NonNullable<DramaCharacter["voiceProfile"]>> = {}): DramaCharacter => ({
    id: "heroine",
    name: "岚音",
    description: "年轻成年女性",
    voiceProfile: { speed: 1, instructions: "克制、收句停顿", timbrePrompt: "中高音区，清亮温润，轻微气声；普通话自然清晰", ...overrides },
});

describe("character voice references", () => {
    it("uses the exact timbre text without requiring a provider voice ID", () => {
        const text = "  清亮温润\n" + "声线保持稳定。".repeat(50);
        const normalized = normalizeDramaVoiceProfile({ timbrePrompt: text });
        expect(normalized.timbrePrompt).toBe(text);
        const voice = dramaCharacterVoiceReference(heroine({ timbrePrompt: text }));
        const original = "台词：岚音：“外套颜色没变，别说话。”";
        expect(appendDramaCharacterVoiceBindings(original, [voice])).toContain(original);
        expect(appendDramaCharacterVoiceBindings(original, [voice])).toContain(text.trim());
        expect(voice.audio).toBeUndefined();
    });
    it("prefers the uploaded sample and references its real audio alias", () => {
        const voice = dramaCharacterVoiceReference(heroine({ creationSampleAssetId: "permanent/audio/岚音.wav", previewStatus: "success", previewAudioUrl: "/api/reference-assets/old.mp3" }));
        expect(voice.audio?.url).toBe("/api/reference-assets/permanent/audio/%E5%B2%9A%E9%9F%B3.wav");
        const prompt = appendDramaCharacterVoiceBindings("原始镜头卡", [voice]);
        expect(prompt).toContain("角色「岚音」：配音引用 @音频1");
        expect(prompt).not.toContain(voice.timbrePrompt);
    });
    it("uses only successful local auditions when there is no upload", () => {
        const voice = heroine({ previewStatus: "success", previewAudioUrl: "/api/reference-assets/audition.mp3" });
        expect(dramaCharacterVoiceReference(voice).audio?.url).toContain("audition.mp3");
        expect(dramaCharacterVoiceReference(heroine({ ...voice.voiceProfile, previewStatus: "stale" })).audio).toBeUndefined();
        expect(dramaCharacterVoiceReference(heroine({ previewStatus: "success", previewAudioUrl: "https://supplier.example/audio.mp3" })).audio).toBeUndefined();
    });
    it("binds selected anchors and the off-screen speaker without using unselected bystanders", () => {
        const project = { id: "project", characters: [heroine(), { ...heroine(), id: "listener", name: "陆川" }, { ...heroine(), id: "bystander", name: "旁人" }] };
        const shot = { utterances: [{ id: "utt1", order: 1, type: "dialogue" as const, speaker: "岚音", characterId: "heroine", text: "别说话。" }] };
        expect(dramaShotCharacterVoiceReferences(project, shot, ["listener"]).map((voice) => voice.name)).toEqual(["岚音", "陆川"]);
        expect(dramaShotCharacterVoiceReferences(project, { utterances: [] }, []).map((voice) => voice.name)).toEqual([]);
    });
    it("writes only stable role-specific timbres in a dedicated voice block", () => {
        const voices = [dramaCharacterVoiceReference(heroine()), dramaCharacterVoiceReference({ ...heroine(), id: "hero", name: "阿泽" })];
        const prompt = appendDramaCharacterVoiceBindings("当前画面", voices);
        expect(prompt.match(/角色音色：/gu)).toHaveLength(1);
        expect(prompt).toContain("角色音色：\n角色「岚音」：");
        expect(prompt).toContain("角色「阿泽」：");
        expect(prompt).not.toContain("完整说出本提示词");
        expect(prompt).not.toContain("保持原说话人");
    });

    it("places voice references after image references and before the first timed segment", () => {
        const voice = dramaCharacterVoiceReference(heroine());
        const prompt = appendDramaCharacterVoiceBindings("参考图片：\n@图片1：角色「岚音」\n\n00.0–05.0秒，岚音看向门口。", [voice]);
        expect(prompt.indexOf("参考图片：")).toBeLessThan(prompt.indexOf("角色音色："));
        expect(prompt.indexOf("角色音色：")).toBeLessThan(prompt.indexOf("00.0–05.0秒"));
    });

    it("removes legacy injected voice notes while preserving authored sound guidance", () => {
        expect(stripDramaCharacterVoiceBindings("画面结束。\n声音：环境风声；角色「岚音」：旧音色说明")).toBe("画面结束。\n声音：环境风声");
        expect(stripDramaCharacterVoiceBindings("画面结束。\n声音：角色「岚音」：旧音色说明")).toBe("画面结束。");
        expect(stripDramaCharacterVoiceBindings("参考图片：\n@图片1：角色\n\n角色音色：\n角色「岚音」：第一行\n\n第二行\n\n00.0–05.0秒，开始表演。")).toBe("参考图片：\n@图片1：角色\n\n00.0–05.0秒，开始表演。");
    });

    it("matches a stable voice identity or an exact speaker name", () => {
        const project = { id: "project", characters: [heroine()] };
        expect(dramaShotCharacterVoiceReferences(project, { utterances: [], voiceIdentityId: "project:heroine" }, [])).toHaveLength(1);
        expect(dramaShotCharacterVoiceReferences(project, { utterances: [{ id: "1", order: 1, type: "dialogue", speaker: "岚音", text: "原句" }] }, [])).toHaveLength(1);
        expect(dramaShotCharacterVoiceReferences(project, { utterances: [{ id: "1", order: 1, type: "dialogue", speaker: "岚", text: "原句" }] }, [])).toHaveLength(0);
    });
    it("references confirmed audio samples instead of repeating their text timbres", () => {
        const voices = [
            dramaCharacterVoiceReference(heroine()),
            dramaCharacterVoiceReference({ ...heroine({ creationSampleAssetId: "permanent/a.wav" }), id: "a", name: "陆川" }),
            dramaCharacterVoiceReference({ ...heroine({ creationSampleAssetId: "permanent/b.wav" }), id: "b", name: "罗衡" }),
        ];
        const prompt = appendDramaCharacterVoiceBindings("原稿", voices);
        expect(prompt).toContain("角色音色：\n角色「岚音」：");
        expect(prompt).toContain("角色「陆川」：配音引用 @音频1");
        expect(prompt).toContain("角色「罗衡」：配音引用 @音频2");
        expect(prompt).not.toContain("角色「陆川」：中高音区");
        expect(prompt).not.toContain("角色「罗衡」：中高音区");
        expect(voices.slice(1).every((voice) => Boolean(voice.audio))).toBe(true);
    });
});
