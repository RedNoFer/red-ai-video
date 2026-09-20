import { describe, expect, it } from "vitest";
import { formatDramaCompositionContract, resolveDramaCompositionProfile } from "./drama-composition";

describe("drama composition profiles", () => {
    it("uses vertical subject hierarchy for 9:16", () => {
        const profile = resolveDramaCompositionProfile("9:16");
        expect(profile.orientation).toBe("portrait");
        expect(profile.subjectPriority).toContain("单人");
        expect(profile.framingStrategy).toContain("上下纵深");
        expect(formatDramaCompositionContract("9:16")).toContain("禁止把其他画幅");
    });

    it("uses horizontal spatial relationships for 16:9", () => {
        const profile = resolveDramaCompositionProfile("16:9");
        expect(profile.orientation).toBe("landscape");
        expect(profile.subjectPriority).toContain("多人关系");
        expect(profile.framingStrategy).toContain("横向关系");
    });

    it("falls back to an adaptive custom profile", () => {
        expect(resolveDramaCompositionProfile("4:5")).toMatchObject({ orientation: "custom", aspectRatio: "4:5" });
    });
});
