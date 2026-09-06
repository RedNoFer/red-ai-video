import { describe, expect, it } from "vitest";

import { DRAMA_CHARACTER_DEFAULT_CONSISTENCY, normalizeDramaCharacterProfile } from "./drama-character-rules";

describe("drama character quality contract", () => {
    it("fills missing identity fields and protects high-cost drift", () => {
        const profile = normalizeDramaCharacterProfile(undefined, "萧家少年，黑发高束", "萧炎");

        expect(profile.visualIdentity).toContain("萧炎的脸型、五官、发型和年龄感按剧情身份固定");
        expect(profile.visualIdentity).toContain("黑发高束");
        expect(profile.styling).toContain("固定配饰");
        expect(profile.colorPalette).toBe("按角色固有色保持跨镜头一致");
        expect(profile.consistencyRules).toContain(DRAMA_CHARACTER_DEFAULT_CONSISTENCY);
        expect(profile.forbiddenChanges).toEqual(expect.arrayContaining(["换脸", "换年龄", "大头娃娃", "手指畸形"]));
    });

    it("is idempotent when an existing project is loaded repeatedly", () => {
        const first = normalizeDramaCharacterProfile({ visualIdentity: "清晰眉骨", styling: "墨青长袍", colorPalette: "墨青", consistencyRules: "左眉尾微挑" }, "少年", "萧炎");
        const second = normalizeDramaCharacterProfile(first, "少年", "萧炎");

        expect(second).toEqual(first);
    });
});
