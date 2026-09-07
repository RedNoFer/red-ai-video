import { describe, expect, it } from "vitest";

import { applyDramaVisualDirection, defaultDramaProductionPlan, dramaReferenceImageBudget, dramaVisualDirection, normalizeDramaProductionPlan, resolveDramaFrameCountPreference, resolveDramaShotDurationPreference } from "@/lib/drama-production-plan";

describe("drama production plan", () => {
    it("defaults new projects to locked-by-confirmation storyboard settings", () => {
        const plan = defaultDramaProductionPlan();
        expect(plan).toMatchObject({ visual: { visualStyle: "", artStyle: "", source: "agent" }, video: { model: "seedance-2-0-official", mode: "storyboard", resolution: "720p", shotDuration: 15, framePolicy: "agent", count: 1, allowExplicitFallback: false } });
        expect(plan.video.frameCount).toBeUndefined();
        expect(plan.skills.map((skill) => skill.id)).toEqual(["seedance-director", "seedance-25-director"]);
        expect(plan.references).toMatchObject({ strategy: "adaptive", minImages: 3, maxImages: 5 });
        expect(plan.continuity).toMatchObject({ mode: "strict", requireAcceptedActualTail: true });
    });

    it("normalizes legacy multi-reference plans into storyboard workflow", () => {
        const plan = normalizeDramaProductionPlan({ video: { model: "seedance-2-5", mode: "reference", resolution: "720p", count: 2 }, references: { minImages: 3, maxImages: 5 }, continuity: { requireAcceptedActualTail: true } });
        expect(plan).toMatchObject({ video: { model: "seedance-2-5", mode: "storyboard", count: 2 }, references: { minImages: 3, maxImages: 5 }, continuity: { requireAcceptedActualTail: true } });
        expect(plan?.skills.map((skill) => skill.id)).toEqual(["seedance-director", "seedance-25-director"]);
    });

    it("normalizes episode resolution to the editable 480p/720p/1080p set", () => {
        expect(normalizeDramaProductionPlan({ video: { resolution: "480" } })?.video.resolution).toBe("480p");
        expect(normalizeDramaProductionPlan({ video: { resolution: "2160p" } })?.video.resolution).toBe("720p");
    });

    it("normalizes 15/30 second shots and ignores fixed frame counts for Agent splitting", () => {
        expect(defaultDramaProductionPlan().video.shotDuration).toBe(15);
        expect(normalizeDramaProductionPlan({ video: { shotDuration: 30 } })?.video.shotDuration).toBe(30);
        expect(normalizeDramaProductionPlan({ video: { shotDuration: 20, frameCount: 7 } })?.video).toMatchObject({ shotDuration: 15, framePolicy: "agent" });
        expect(normalizeDramaProductionPlan({ video: { framePolicy: "fixed-4", frameCount: 4 } })?.video).toMatchObject({ framePolicy: "fixed-4", frameCount: 4 });
        expect(normalizeDramaProductionPlan({ video: { shotDuration: 12 } })?.video.shotDuration).toBe(15);
        expect(resolveDramaShotDurationPreference("请按每个视频片段30s重新拆分")).toBe(30);
        expect(resolveDramaShotDurationPreference("请按每个视频片段15秒重新拆分")).toBe(15);
        expect(resolveDramaShotDurationPreference("每个镜头20s，分7个帧")).toBe(15);
        expect(resolveDramaFrameCountPreference("每个镜头20s，分7个帧")).toBe(7);
        expect(resolveDramaFrameCountPreference("请分 6 帧")).toBe(6);
        expect(dramaReferenceImageBudget(15)).toBe(9);
        expect(dramaReferenceImageBudget(20)).toBe(9);
        expect(dramaReferenceImageBudget(30)).toBe(9);
    });

    it("keeps visual parameters and fixed frame policies in the normalized plan", () => {
        expect(normalizeDramaProductionPlan({ visual: { visualStyle: "冷峻写实", artStyle: "水墨电影感", source: "manual" }, video: { shotDuration: 30, framePolicy: "fixed-4", frameCount: 4 } })).toMatchObject({
            visual: { visualStyle: "冷峻写实", artStyle: "水墨电影感", source: "manual" },
            video: { shotDuration: 30, framePolicy: "fixed-4", frameCount: 4 },
        });
        expect(normalizeDramaProductionPlan({ video: { framePolicy: "agent" } })?.video.framePolicy).toBe("agent");
    });

    it("round-trips the editable visual direction without losing its split fields", () => {
        const plan = applyDramaVisualDirection(defaultDramaProductionPlan("manual"), "视觉风格：东方写实摄影\n画风：克制电影级空间美术，真实材质");

        expect(plan.visual).toMatchObject({ visualStyle: "东方写实摄影", artStyle: "克制电影级空间美术，真实材质", visualDirection: "视觉风格：东方写实摄影\n画风：克制电影级空间美术，真实材质", source: "manual" });
        expect(dramaVisualDirection(plan)).toBe("视觉风格：东方写实摄影\n画风：克制电影级空间美术，真实材质");
        expect(normalizeDramaProductionPlan(plan)?.visual.visualDirection).toBe(plan.visual.visualDirection);
    });

    it("lets an explicit empty visual direction switch back to Agent suggestions", () => {
        const current = applyDramaVisualDirection(defaultDramaProductionPlan("manual"), "视觉风格：东方写实摄影\n画风：克制电影美术");
        const cleared = normalizeDramaProductionPlan(applyDramaVisualDirection(current, ""), current);

        expect(cleared?.visual).toEqual({ visualStyle: "", artStyle: "", source: "agent" });
    });
});
