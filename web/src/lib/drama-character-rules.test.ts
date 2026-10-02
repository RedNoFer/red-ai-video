import { describe, expect, it } from "vitest";

import { DRAMA_CHARACTER_DEFAULT_CONSISTENCY, normalizeDramaCharacterProfile } from "./drama-character-rules";

describe("drama character quality contract", () => {
    it("fills missing identity fields and protects high-cost drift", () => {
        const profile = normalizeDramaCharacterProfile(undefined, "萧家少年，黑发高束", "萧炎");

        expect(profile.visualIdentity).toContain("萧炎的脸型、五官、发型和年龄感按当前角色设定固定");
        expect(profile.visualIdentity).toContain("黑发高束");
        expect(profile.visualIdentity).not.toContain("剧情");
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

    it("keeps a renamed identity stable on the first save and subsequent reads", () => {
        const original = normalizeDramaCharacterProfile({ visualIdentity: "固定黑发", styling: "制服", colorPalette: "灰色", consistencyRules: "五官一致" }, "年轻女性", "上传测试角色");
        const renamed = normalizeDramaCharacterProfile(original, "年轻女性", "保存后的上传测试角色");
        expect(renamed.visualIdentity).not.toContain("；上传测试角色的脸型");
        expect(normalizeDramaCharacterProfile(renamed, "年轻女性", "保存后的上传测试角色")).toEqual(renamed);
    });

    it("does not promote narrative description into the character visual identity", () => {
        const profile = normalizeDramaCharacterProfile(undefined, "少年；黑发束起；由被审判的沉默转成冷肃反击；以血手契约承担父亲名声", "萧炎");

        expect(profile.visualIdentity).toContain("少年");
        expect(profile.visualIdentity).toContain("黑发束起");
        expect(profile.visualIdentity).not.toContain("被审判");
        expect(profile.visualIdentity).not.toContain("血手契约");
        expect(profile.visualIdentity).not.toContain("父亲名声");
    });

    it("cleans narrative clauses from persisted visual settings on reload", () => {
        const profile = normalizeDramaCharacterProfile(
            {
                visualIdentity: "少年；黑发束起；由被审判的沉默转成冷肃反击",
                styling: "黑灰窄袖长袍；旧银护腕；以血手契约承担父亲名声",
                colorPalette: "炭黑、旧银；议事大厅冷光",
                consistencyRules: "固定脸型、五官、发束和体态；再以血手契约承担父亲名声；身份特写、正面、严格左侧面、背面保持同一角色",
            },
            "萧炎的脸型和年龄感按剧情身份固定；少年；黑发束起；由被审判的沉默转成冷肃反击",
            "萧炎",
        );

        expect(profile.visualIdentity).toContain("少年");
        expect(profile.visualIdentity).not.toContain("被审判");
        expect(profile.styling).toContain("黑灰窄袖长袍");
        expect(profile.styling).not.toContain("血手契约");
        expect(profile.colorPalette).toBe("炭黑、旧银");
        expect(profile.colorPalette).not.toContain("大厅");
        expect(profile.consistencyRules).toContain("固定脸型");
        expect(profile.consistencyRules).not.toContain("血手契约");
    });

    it("preserves a user-authored non-narrative continuity rule", () => {
        const profile = normalizeDramaCharacterProfile(
            {
                visualIdentity: "清晰眉骨；黑发高束",
                styling: "墨青长袍；黑色短靴",
                colorPalette: "墨青、暗灰、暖金",
                consistencyRules: "锁定脸部、发束、服装层次和左手伤痕",
            },
            "原始身份",
            "保存测试角色",
        );

        expect(profile.consistencyRules).toContain("锁定脸部、发束、服装层次和左手伤痕");
    });
});
