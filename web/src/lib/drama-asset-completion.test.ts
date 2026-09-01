import { describe, expect, it } from "vitest";
import { getDramaAssetMissingItems } from "./drama-asset-completion";

describe("drama asset completion", () => {
    it("detects character text, voice and reference gaps", () => {
        expect(getDramaAssetMissingItems({ id: "character-one", name: "林夏", description: "", voiceProfile: { voiceId: "", speed: 1, instructions: "" } }, "characters").map((item) => item.key)).toEqual([
            "description", "visualIdentity", "styling", "colorPalette", "consistencyRules", "voice", "reference",
        ]);
    });

    it("does not schedule images or voices for clues", () => {
        const missing = getDramaAssetMissingItems({ id: "clue-one", name: "旧钥匙", description: "", payoff: "" }, "clues");
        expect(missing.map((item) => item.key)).toContain("payoff");
        expect(missing.some((item) => item.task === "voice" || item.task === "reference")).toBe(false);
    });

    it("keeps a complete asset untouched", () => {
        const asset = { id: "scene-one", name: "诊所", description: "主场景", profile: { visualIdentity: "狭长走廊", styling: "旧木与瓷砖", colorPalette: "冷白与暗绿", consistencyRules: "入口始终在左侧" }, primaryReferenceId: "ref-one", references: [{ id: "ref-one", url: "/scene.png", source: "generated" as const, label: "基准", status: "approved" as const, createdAt: "2026-01-01T00:00:00.000Z" }] };
        expect(getDramaAssetMissingItems(asset, "scenes")).toEqual([]);
    });
});
