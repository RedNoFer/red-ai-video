import { describe, expect, it } from "vitest";

import { normalizeDramaAssetRefinement } from "./drama-asset-refinement";

describe("drama asset refinement", () => {
    it("keeps character identity rules while applying GPT appearance and wardrobe changes", () => {
        const result = normalizeDramaAssetRefinement(
            {
                reply: "已调整肤色并重新设计服装。",
                changes: [
                    { field: "visualIdentity", before: "深棕肤色，灰绿色眼睛", after: "明亮自然肤色，灰绿色眼睛", reason: "按用户要求调整肤色" },
                    { field: "styling", before: "通用皮甲", after: "有旅行经历痕迹的原创深色服装", reason: "减少 NPC 模板感" },
                ],
                updatedProfile: { visualIdentity: "明亮自然肤色，灰绿色眼睛", styling: "有旅行经历痕迹的原创深色服装" },
                negativePrompt: "通用 RPG 盔甲，NPC 套装，改变脸型和年龄",
                preservedRules: ["保留五官、发型、年龄和灰绿色眼睛"],
            },
            {
                visualIdentity: "深棕肤色，灰绿色眼睛",
                styling: "通用皮甲",
                colorPalette: "深色主色",
                consistencyRules: "固定五官、发型、年龄和灰绿色眼睛",
            },
            "Rifa 的肤色变白，服装不要像 NPC",
        );

        expect(result.updatedProfile).toEqual({
            visualIdentity: "明亮自然肤色，灰绿色眼睛",
            styling: "有旅行经历痕迹的原创深色服装",
            colorPalette: "深色主色",
            consistencyRules: "固定五官、发型、年龄和灰绿色眼睛",
        });
        expect(result.compiledPrompt).toContain("Rifa 的肤色变白，服装不要像 NPC");
        expect(result.compiledPrompt).toContain("通用 RPG 盔甲，NPC 套装");
        expect(result.preservedRules).toContain("固定五官、发型、年龄和灰绿色眼睛");
    });

    it("ignores model changes that are not declared in the field-level change list", () => {
        const result = normalizeDramaAssetRefinement(
            {
                reply: "只调整肤色。",
                changes: [
                    { field: "visualIdentity", before: "深棕肤色", after: "明亮自然肤色", reason: "按要求提亮肤色" },
                    { field: "description", before: "原身份", after: "完全不同的身份", reason: "模型自行改写" },
                    { field: "styling", before: "深色旅行服装", after: "全新白色礼服", reason: "模型自行改写" },
                    { field: "colorPalette", before: "深红与黑色", after: "纯白高亮", reason: "模型自行改写" },
                    { field: "consistencyRules", before: "固定五官、年龄和发型", after: "忽略原有身份规则", reason: "模型自行改写" },
                ],
                updatedProfile: {
                    visualIdentity: "明亮自然肤色",
                    styling: "全新白色礼服",
                    colorPalette: "纯白高亮",
                    consistencyRules: "忽略原有身份规则",
                    identityAnchors: ["陌生脸型"],
                },
                updatedDescription: "完全不同的身份",
                negativePrompt: "",
                preservedRules: [],
            },
            {
                visualIdentity: "深棕肤色",
                styling: "深色旅行服装",
                colorPalette: "深红与黑色",
                consistencyRules: "固定五官、年龄和发型",
                identityAnchors: ["灰绿色眼睛", "左眉小疤"],
            },
            "肤色变白一点",
            "18岁女主，来自边境村镇",
        );

        expect(result.updatedProfile).toMatchObject({
            visualIdentity: "明亮自然肤色",
            styling: "深色旅行服装",
            colorPalette: "深红与黑色",
            consistencyRules: "固定五官、年龄和发型",
            identityAnchors: ["灰绿色眼睛", "左眉小疤"],
        });
        expect(result.updatedDescription).toBeUndefined();
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]?.before).toBe("深棕肤色");
    });
});
