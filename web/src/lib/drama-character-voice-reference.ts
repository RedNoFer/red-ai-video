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

/** Compact voice identities, shared rules once; included in the editable submission preview. */
export function appendDramaCharacterVoiceBindings(prompt: string, voices: DramaCharacterVoiceReference[]) {
    let audioIndex = 0;
    const bindings = voices.flatMap((voice) => {
        const character = `角色「${voice.name}」`;
        if (voice.audio) return [`${character}：配音引用 @音频${++audioIndex}`];
        if (voice.timbrePrompt) return [`${character}：${voice.timbrePrompt}`];
        return [];
    });
    if (!bindings.length) return prompt;
    return [
        [
            "【角色音色】",
            ...bindings,
            `人声：完整说出本提示词已有的对白和旁白原句，保持原说话人及标注的发声时间；各角色使用上述音色，情绪、语速和停顿按当句表演要求执行。${audioIndex ? "音频样本用于对应角色的声线参考，实际说话内容以本提示词台词为准。" : ""}`,
        ].join("\n"),
        prompt,
    ]
        .filter(Boolean)
        .join("\n\n");
}
