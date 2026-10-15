import type { DramaCharacter, DramaProject, DramaShot } from "@/lib/drama-project-contract";

export type DramaCharacterVoiceReference = { characterId: string; name: string; timbrePrompt: string; audio?: { id: string; name: string; url: string } };

/** Uploaded samples take priority; a successful generated audition is also a voice reference. */
export function dramaCharacterVoiceReference(character: DramaCharacter): DramaCharacterVoiceReference {
    const voice = character.voiceProfile;
    const sampleKey = voice?.creationSampleAssetId?.trim();
    const sampleUrl = sampleKey && /^(?:temporary|permanent)\//u.test(sampleKey) ? `/api/reference-assets/${sampleKey.split("/").map(encodeURIComponent).join("/")}` : "";
    const audioUrl = sampleUrl || (voice?.previewStatus === "success" && voice.previewAudioUrl?.startsWith("/api/reference-assets/") ? voice.previewAudioUrl : "");
    return {
        characterId: character.id,
        name: character.name,
        timbrePrompt: voice?.timbrePrompt?.trim() || "",
        ...(audioUrl ? { audio: { id: `voice-${character.id}`, name: `${character.name} 角色配音`, url: audioUrl } } : {}),
    };
}

/** Include selected character anchors and actual speakers, including off-screen dialogue. */
export function dramaShotCharacterVoiceReferences(project: Pick<DramaProject, "id" | "characters">, shot: Pick<DramaShot, "utterances" | "characterId" | "voiceIdentityId">, referenceAssetIds: string[]) {
    const speakers = shot.utterances || [];
    const ids = new Set([...referenceAssetIds, shot.characterId, shot.voiceIdentityId].filter(Boolean));
    return project.characters
        .filter((character) => ids.has(character.id) || ids.has(`${project.id}:${character.id}`) || speakers.some((utterance) => utterance.characterId === character.id || (!utterance.characterId && utterance.speaker === character.name)))
        .map(dramaCharacterVoiceReference);
}

/** Add only stable voice guidance as a plain final sound sentence. */
export function appendDramaCharacterVoiceBindings(prompt: string, voices: DramaCharacterVoiceReference[]) {
    const bindings = voices.filter((voice) => voice.timbrePrompt && !voice.audio).map((voice) => `角色「${voice.name}」：${voice.timbrePrompt}`);
    if (!bindings.length) return prompt;
    const source = prompt.trim();
    const existing = source.match(/(?:^|\n)声音：([\s\S]*)$/u);
    if (!existing) return `${source}\n\n声音：${bindings.join("；")}`;
    const current = existing[1].trim();
    const missing = bindings.filter((binding) => !current.includes(binding.slice(0, binding.indexOf("："))));
    if (!missing.length) return source;
    const start = existing.index ?? 0;
    return `${source.slice(0, start).trimEnd()}\n声音：${[current, ...missing].filter(Boolean).join("；")}`;
}
