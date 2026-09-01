import type { AuthSettings, CharacterVoicePoolEntry } from "@/lib/auth/store-types";
import type { DramaCharacter, DramaVoiceBlueprint, DramaVoiceProfile } from "./drama-project-contract";

export class DramaVoiceAllocationError extends Error {}
export const DRAMA_PROVIDER_VOICE_POOL = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"] as const;

export function normalizeDramaVoiceProfile(value: unknown): DramaVoiceProfile {
    const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const voiceId = clean(input.voiceId) || clean(input.voice);
    return {
        identityType: input.identityType === "custom" || input.identityType === "parameterized" ? input.identityType : voiceId ? "provider" : "parameterized",
        provider: clean(input.provider),
        model: clean(input.model),
        logicalModelId: clean(input.logicalModelId),
        channelId: clean(input.channelId),
        voiceId,
        status: input.status === "unavailable" || input.status === "needs_review" ? input.status : voiceId ? "assigned" : "unassigned",
        blueprint: normalizeBlueprint(input.blueprint),
        sampleAssetId: clean(input.sampleAssetId),
        assignedAt: clean(input.assignedAt),
        assignmentSource: input.assignmentSource === "gpt" || input.assignmentSource === "auto" ? input.assignmentSource : voiceId ? "manual" : undefined,
        blueprintVersion: Number.isSafeInteger(input.blueprintVersion) ? Number(input.blueprintVersion) : undefined,
        speed: Math.max(0.25, Math.min(4, Number(input.speed) || 1)),
        instructions: clean(input.instructions),
        previewStatus: input.previewStatus === "queued" || input.previewStatus === "running" || input.previewStatus === "success" || input.previewStatus === "error" || input.previewStatus === "stale" ? input.previewStatus : "idle",
        previewTaskId: clean(input.previewTaskId),
        previewLogicalModelId: clean(input.previewLogicalModelId),
        previewChannelId: clean(input.previewChannelId),
        previewAudioUrl: clean(input.previewAudioUrl),
        previewText: clean(input.previewText),
        previewFingerprint: clean(input.previewFingerprint),
        previewError: clean(input.previewError),
        creationMode: input.creationMode === "clone" ? "clone" : "design",
        designPrompt: cleanLong(input.designPrompt, 2_000),
        creationTaskId: clean(input.creationTaskId),
        creationStatus: input.creationStatus === "queued" || input.creationStatus === "running" || input.creationStatus === "success" || input.creationStatus === "error" ? input.creationStatus : "idle",
        creationSampleAssetId: clean(input.creationSampleAssetId),
        creationFingerprint: clean(input.creationFingerprint),
        creationError: cleanLong(input.creationError, 500),
    };
}

export function assertUniqueDramaVoices(characters: DramaCharacter[]) {
    const seen = new Map<string, string>();
    for (const character of characters) {
        const voiceId = character.voiceProfile?.voiceId?.trim();
        if (!voiceId) continue;
        const previous = seen.get(voiceId.toLowerCase());
        if (previous && previous !== character.id) throw new DramaVoiceAllocationError(`项目内角色“${character.name}”与“${previous}”不能使用相同音色 ID：${voiceId}`);
        seen.set(voiceId.toLowerCase(), character.id);
    }
}

export function allocateDramaVoiceProfile(character: DramaCharacter, characters: DramaCharacter[], pool?: CharacterVoicePoolEntry[], logicalModelId = "", channelId = "", now = new Date().toISOString()): DramaVoiceProfile {
    const existing = normalizeDramaVoiceProfile(character.voiceProfile);
    if (existing.voiceId) return existing;
    const used = new Set(
        characters
            .filter((item) => item.id !== character.id)
            .map((item) => item.voiceProfile?.voiceId?.trim().toLowerCase())
            .filter(Boolean),
    );
    const configuredPool = pool?.length ? pool : DRAMA_PROVIDER_VOICE_POOL.map((voiceId) => ({ id: voiceId, label: voiceId, voiceId, logicalModelId, channelId, language: "zh-CN", tags: [], enabled: true, verified: true }));
    const candidate = configuredPool.find((item) => item.enabled && item.verified && item.logicalModelId === logicalModelId && item.channelId === channelId && !used.has(item.voiceId.trim().toLowerCase()));
    if (!candidate) throw new DramaVoiceAllocationError("项目角色数超过当前音色池容量，无法保证角色音色唯一");
    const blueprint = buildVoiceBlueprint(character);
    return {
        voiceId: candidate.voiceId,
        identityType: "parameterized",
        provider: "configured",
        logicalModelId,
        channelId,
        status: "assigned",
        blueprint,
        assignedAt: now,
        assignmentSource: "auto",
        blueprintVersion: 1,
        speed: 1,
        instructions: describeBlueprint(blueprint),
        previewStatus: "idle",
    };
}

export function voicePoolFor(settings: AuthSettings) {
    return settings.characterVoicePool.filter((item) => item.enabled && item.verified);
}

function buildVoiceBlueprint(character: DramaCharacter): DramaVoiceBlueprint {
    const text = `${character.name} ${character.description} ${character.profile?.visualIdentity || ""}`;
    return {
        age: /少年|少女|年轻|青年/u.test(text) ? "young" : /老人|老年/u.test(text) ? "mature" : "adult",
        register: /女性|女/u.test(text) ? "warm" : /男性|男/u.test(text) ? "grounded" : "neutral",
        temperament: /冷静|克制|沉着/u.test(text) ? "restrained" : /活泼|开朗|热情/u.test(text) ? "bright" : "natural",
        emotionalRange: "natural dramatic range",
        texture: "clear and stable",
    };
}
function describeBlueprint(blueprint: DramaVoiceBlueprint) {
    return [blueprint.age, blueprint.register, blueprint.temperament, blueprint.emotionalRange, blueprint.texture].filter(Boolean).join(", ");
}
function normalizeBlueprint(value: unknown): DramaVoiceBlueprint | undefined {
    if (!value || typeof value !== "object") return undefined;
    const input = value as Record<string, unknown>;
    const result = { age: clean(input.age), register: clean(input.register), temperament: clean(input.temperament), emotionalRange: clean(input.emotionalRange), texture: clean(input.texture) };
    return Object.values(result).some(Boolean) ? result : undefined;
}
function clean(value: unknown) {
    return typeof value === "string" ? value.trim().slice(0, 160) : "";
}
function cleanLong(value: unknown, max = 160) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}
