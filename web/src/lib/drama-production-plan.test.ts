import { describe, expect, it } from "vitest";

import { defaultDramaProductionPlan, dramaReferenceImageBudget, normalizeDramaProductionPlan, resolveDramaFrameCountPreference, resolveDramaShotDurationPreference } from "@/lib/drama-production-plan";

describe("drama production plan", () => {
    it("defaults new projects to locked-by-confirmation storyboard settings", () => {
        const plan = defaultDramaProductionPlan();
        expect(plan.video).toMatchObject({ model: "seedance-2-0-official", mode: "storyboard", resolution: "720p", shotDuration: 15, frameCount: 5, count: 1, allowExplicitFallback: false });
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

    it("normalizes 15/20/30 second shots and explicit frame-count requests", () => {
        expect(defaultDramaProductionPlan().video.shotDuration).toBe(15);
        expect(normalizeDramaProductionPlan({ video: { shotDuration: 30 } })?.video.shotDuration).toBe(30);
        expect(normalizeDramaProductionPlan({ video: { shotDuration: 20, frameCount: 7 } })?.video).toMatchObject({ shotDuration: 20, frameCount: 7 });
        expect(normalizeDramaProductionPlan({ video: { shotDuration: 12 } })?.video.shotDuration).toBe(15);
        expect(resolveDramaShotDurationPreference("请按每个视频片段30s重新拆分")).toBe(30);
        expect(resolveDramaShotDurationPreference("请按每个视频片段15秒重新拆分")).toBe(15);
        expect(resolveDramaShotDurationPreference("每个镜头20s，分7个帧")).toBe(20);
        expect(resolveDramaFrameCountPreference("每个镜头20s，分7个帧")).toBe(7);
        expect(resolveDramaFrameCountPreference("请分 6 帧")).toBe(6);
        expect(dramaReferenceImageBudget(15)).toBe(9);
        expect(dramaReferenceImageBudget(20)).toBe(9);
        expect(dramaReferenceImageBudget(30)).toBe(30);
    });
});
