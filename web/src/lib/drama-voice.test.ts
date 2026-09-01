import { describe, expect, it } from "vitest";

import type { DramaCharacter } from "./drama-project-contract";
import { allocateDramaVoiceProfile, assertUniqueDramaVoices, DramaVoiceAllocationError, DRAMA_PROVIDER_VOICE_POOL, normalizeDramaVoiceProfile } from "./drama-voice";

const character = (id: string, voiceId = ""): DramaCharacter => ({ id, name: id, description: "年轻冷静的男性角色", voiceProfile: { voiceId, speed: 1, instructions: "" } });

describe("drama voice identity", () => {
    it("imports a legacy voice value as a provider identity", () => {
        expect(normalizeDramaVoiceProfile({ voice: "nova", speed: 1.1 })).toMatchObject({ voiceId: "nova", identityType: "provider", status: "assigned", assignmentSource: "manual" });
    });

    it("allocates and persists a distinct parameterized identity", () => {
        const first = character("first", "alloy");
        const second = character("second");
        expect(allocateDramaVoiceProfile(second, [first, second])).toMatchObject({ voiceId: "ash", identityType: "parameterized", status: "assigned", assignmentSource: "auto", blueprintVersion: 1 });
    });

    it("rejects duplicate voices within a project", () => {
        expect(() => assertUniqueDramaVoices([character("甲", "nova"), character("乙", "NOVA")])).toThrow(DramaVoiceAllocationError);
    });

    it("blocks allocation when the project voice pool is exhausted", () => {
        const existing = DRAMA_PROVIDER_VOICE_POOL.map((voice, index) => character(`c${index}`, voice));
        const target = character("target");
        expect(() => allocateDramaVoiceProfile(target, [...existing, target])).toThrow("项目角色数超过当前音色池容量");
    });
});
