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

/** Remove prompt-editor residue from older runtime-injected voice bindings. */
export function stripDramaCharacterVoiceBindings(prompt: string) {
    const lines = prompt.trim().split(/\r?\n/u);
    const output: string[] = [];
    let skippingVoiceBlock = false;
    for (const line of lines) {
        const value = line.trim();
        if (value === "角色音色：" || value.startsWith("【角色音色】")) {
            skippingVoiceBlock = true;
            continue;
        }
        if (skippingVoiceBlock) {
            if (!value) continue;
            if (/^角色「[^」]+」：/u.test(value)) continue;
            skippingVoiceBlock = false;
            output.push(line);
            continue;
        }
        output.push(line);
    }

    let source = output.join("\n").trim();
    const sound = source.match(/(?:^|\n)声音：([\s\S]*)$/u);
    if (!sound || !/角色「[^」]+」：/u.test(sound[1])) return source;
    const remaining = sound[1]
        .split(/[；;\n]/u)
        .map((item) => item.trim())
        .filter((item) => item && !/^角色「[^」]+」：/u.test(item));
    const start = sound.index ?? 0;
    source = remaining.length ? `${source.slice(0, start).trimEnd()}\n声音：${remaining.join("；")}` : source.slice(0, start).trimEnd();
    return source;
}

/** Place stable role timbres immediately below reference images and before the shot action. */
export function appendDramaCharacterVoiceBindings(prompt: string, voices: DramaCharacterVoiceReference[]) {
    const source = stripDramaCharacterVoiceBindings(prompt).replace(/\n{3,}/gu, "\n\n");
    let audioIndex = 0;
    const bindings = voices.flatMap((voice) => {
        if (voice.audio) return [`角色「${voice.name}」：配音引用 @音频${++audioIndex}`];
        return voice.timbrePrompt ? [`角色「${voice.name}」：${voice.timbrePrompt.trim().replace(/\s*\n+\s*/gu, " ")}`] : [];
    });
    if (!bindings.length) return source;
    const section = `角色音色：\n${bindings.join("\n")}`;
    const referenceHeader = /(?:^|\n)【?参考图片】?[：:]\n/u.exec(source);
    if (referenceHeader) {
        const sectionStart = (referenceHeader.index ?? 0) + referenceHeader[0].length;
        const sectionEnd = source.indexOf("\n\n", sectionStart);
        const insertAt = sectionEnd < 0 ? source.length : sectionEnd;
        return `${source.slice(0, insertAt).trimEnd()}\n\n${section}${source.slice(insertAt)}`.trim();
    }
    const firstPromptEvent = /^[ \t]*(?:\d+(?:\.\d+)?\s*(?:-|至|到|—|–|~|～)\s*\d+(?:\.\d+)?\s*秒\s*[，,:：]|从\s*\d+(?:\.\d+)?\s*秒\s*(?:-|至|到|—|–|~|～)\s*\d+(?:\.\d+)?\s*秒\s*[，,:：]|Cut\s+to\s*[：:]|结束时，|声音：)/mu.exec(source);
    if (!firstPromptEvent) return [source, section].filter(Boolean).join("\n\n");
    const insertAt = firstPromptEvent.index ?? 0;
    return `${source.slice(0, insertAt).trimEnd()}\n\n${section}\n\n${source.slice(insertAt).trimStart()}`;
}
