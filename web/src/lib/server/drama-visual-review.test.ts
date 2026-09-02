import { describe, expect, it } from "vitest";

import { normalizeDramaVisualReviewInput } from "./drama-visual-review";

describe("normalizeDramaVisualReviewInput", () => {
    it("keeps only reviewable server or https storyboard images", () => {
        const result = normalizeDramaVisualReviewInput({
            project: { title: "短剧", summary: "悬疑", style: "暗黑学院史诗奇幻", ratio: "9:16" },
            episode: {
                title: "第 1 集",
                shots: [
                    { id: "shot-one", title: "发现", imagePrompt: "雨夜", storyboardImageUrl: "/api/media-assets/one", storyboardEndImageUrl: "https://example.com/end.png" },
                    { id: "shot-two", title: "无图", storyboardImageUrl: "blob:expired" },
                ],
            },
        });

        expect(result.tasks).toEqual([expect.objectContaining({ id: "shot-one", imageUrls: ["/api/media-assets/one", "https://example.com/end.png"] })]);
        expect(result.foundation.direction.avoid).toContain("轴线与视线错误");
        expect(result.foundation.direction.avoid).not.toContain("纯写实摄影或真人影视感");
        expect(result.foundation.direction.avoid).not.toContain("3D游戏渲染");
    });

    it("keeps the bible style when project.style is empty", () => {
        const result = normalizeDramaVisualReviewInput({
            project: { title: "真实摄影短剧", productionBible: { visualStyle: "ARRI自然光真人影视感，冷灰蓝" }, ratio: "16:9" },
            episode: { title: "第 1 集", shots: [{ id: "shot-one", storyboardImageUrl: "/api/media-assets/one", imagePrompt: "雨夜" }] },
        });

        expect(result.foundation.direction.style).toBe("ARRI自然光真人影视感，冷灰蓝");
        expect(result.foundation.direction.summary).toContain("ARRI自然光真人影视感");
    });

    it("reviews every completed storyboard instead of sampling the first six", () => {
        const shots = Array.from({ length: 21 }, (_, index) => ({ id: `shot-${index}`, title: `镜头 ${index}`, imagePrompt: `提示词 ${index}`, storyboardImageUrl: `/api/media-assets/${index}` }));

        const result = normalizeDramaVisualReviewInput({ project: { title: "长剧集", ratio: "9:16" }, episode: { title: "第 1 集", shots } });

        expect(result.tasks).toHaveLength(21);
        expect(result.tasks.at(-1)).toMatchObject({ id: "shot-20", imageUrls: ["/api/media-assets/20"] });
    });

    it("adds an adjacent boundary task when a continuous shot has actual frames", () => {
        const result = normalizeDramaVisualReviewInput({
            project: { title: "连续场景", ratio: "9:16" },
            episode: {
                title: "第 1 集",
                shots: [
                    { id: "shot-one", title: "上一镜", imagePrompt: "雨夜", storyboardImageUrl: "/api/one", actualEndFrameUrl: "/api/one-end", continuityStatus: "needs_review" },
                    { id: "shot-two", title: "下一镜", imagePrompt: "雨夜", storyboardImageUrl: "/api/two", actualStartFrameUrl: "/api/two-start" },
                ],
                continuityEdges: [{ fromShotId: "shot-one", toShotId: "shot-two", transition: "continuous", inheritActualEndFrame: true, carryCharacterIds: [], carryPropIds: [], carryEnvironment: true, carryAxis: true }],
            },
        });

        expect(result.tasks).toContainEqual(expect.objectContaining({ id: "shot-two", imageUrls: ["/api/one-end", "/api/two-start"] }));
    });
});
