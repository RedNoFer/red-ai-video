import { describe, expect, it } from "vitest";
import { appendDramaCharacterVoiceBindings, dramaCharacterVoiceReference, dramaShotCharacterVoiceReferences } from "./drama-character-voice-reference";
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
    it("prefers the uploaded sample to generated audio and never also uses the prompt", () => {
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
    it("writes shared dialogue rules once for multiple character voices", () => {
        const voices = [dramaCharacterVoiceReference(heroine()), dramaCharacterVoiceReference({ ...heroine(), id: "hero", name: "阿泽" })];
        const prompt = appendDramaCharacterVoiceBindings("当前画面", voices);
        expect(prompt.match(/完整说出本提示词已有的对白和旁白原句/gu)).toHaveLength(1);
        expect(prompt.match(/保持原说话人及标注的发声时间/gu)).toHaveLength(1);
        expect(prompt).not.toContain("仅用于该角色已有台词");
        expect(prompt).not.toContain("不增加对白");
        expect(prompt).toContain("角色「岚音」：");
        expect(prompt).toContain("角色「阿泽」：");
    });

    it("matches a stable voice identity or an exact speaker name", () => {
        const project = { id: "project", characters: [heroine()] };
        expect(dramaShotCharacterVoiceReferences(project, { utterances: [], voiceIdentityId: "project:heroine" }, [])).toHaveLength(1);
        expect(dramaShotCharacterVoiceReferences(project, { utterances: [{ id: "1", order: 1, type: "dialogue", speaker: "岚音", text: "原句" }] }, [])).toHaveLength(1);
        expect(dramaShotCharacterVoiceReferences(project, { utterances: [{ id: "1", order: 1, type: "dialogue", speaker: "岚", text: "原句" }] }, [])).toHaveLength(0);
    });
    it("numbers audio independently of prompt voices and binds each sample to its own speaker", () => {
        const voices = [
            dramaCharacterVoiceReference(heroine()),
            dramaCharacterVoiceReference({ ...heroine({ creationSampleAssetId: "permanent/a.wav" }), id: "a", name: "陆川" }),
            dramaCharacterVoiceReference({ ...heroine({ creationSampleAssetId: "permanent/b.wav" }), id: "b", name: "罗衡" }),
        ];
        const prompt = appendDramaCharacterVoiceBindings("原稿", voices);
        expect(prompt).toContain("角色「岚音」：");
        expect(prompt).toContain("角色「陆川」：配音引用 @音频1");
        expect(prompt).toContain("角色「罗衡」：配音引用 @音频2");
        expect(prompt).toContain("实际说话内容以本提示词台词为准");
    });
});
