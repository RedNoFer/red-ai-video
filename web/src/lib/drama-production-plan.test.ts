import { describe, expect, it } from "vitest";

import { defaultDramaProductionPlan, normalizeDramaProductionPlan } from "@/lib/drama-production-plan";

describe("drama production plan", () => {
    it("defaults new projects to locked-by-confirmation storyboard settings", () => {
        const plan = defaultDramaProductionPlan();
        expect(plan.video).toMatchObject({ model: "seedance-2-0-official", mode: "storyboard", resolution: "720p", count: 1, allowExplicitFallback: false });
        expect(plan.references).toMatchObject({ strategy: "adaptive", minImages: 3, maxImages: 5 });
        expect(plan.continuity).toMatchObject({ mode: "strict", requireAcceptedActualTail: true });
    });

    it("normalizes legacy multi-reference plans into storyboard workflow", () => {
        const plan = normalizeDramaProductionPlan({ video: { model: "seedance-2-5", mode: "reference", resolution: "720p", count: 2 }, references: { minImages: 3, maxImages: 5 }, continuity: { requireAcceptedActualTail: true } });
        expect(plan).toMatchObject({ video: { model: "seedance-2-5", mode: "storyboard", count: 2 }, references: { minImages: 3, maxImages: 5 }, continuity: { requireAcceptedActualTail: true } });
    });

    it("normalizes episode resolution to the editable 480p/720p/1080p set", () => {
        expect(normalizeDramaProductionPlan({ video: { resolution: "480" } })?.video.resolution).toBe("480p");
        expect(normalizeDramaProductionPlan({ video: { resolution: "2160p" } })?.video.resolution).toBe("720p");
    });
});
