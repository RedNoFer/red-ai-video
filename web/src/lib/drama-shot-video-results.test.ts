import { describe, expect, it } from "vitest";

import { mergeDramaShotVideoResults, visibleDramaShotVideoResults } from "./drama-shot-video-results";
import type { DramaShot } from "./drama-project-contract";

describe("drama shot video history", () => {
    it("keeps the existing result and merges newly pulled tasks by stable task id", () => {
        const shot = { id: "shot-one", generationTaskId: "task-two", videoUrl: "/two.mp4", videoResults: [{ id: "task-two", taskId: "task-two", url: "/two.mp4" }] } as DramaShot;

        const merged = mergeDramaShotVideoResults(shot, [
            { id: "task-one", taskId: "task-one", url: "/one.mp4", createdAt: "2026-10-16T00:00:00.000Z" },
            { id: "task-two", taskId: "task-two", url: "/two.mp4", createdAt: "2026-10-17T00:00:00.000Z" },
            { id: "task-two", taskId: "task-two", url: "/two.mp4", createdAt: "2026-10-17T00:00:00.000Z" },
        ]);

        expect(merged.videoResults).toHaveLength(2);
        expect(merged.videoResults?.map(({ id }) => id)).toEqual(["task-one", "task-two"]);
        expect(merged.videoUrl).toBe("/two.mp4");
        expect(visibleDramaShotVideoResults(merged).map(({ id }) => id)).toEqual(["task-two", "task-one"]);
    });

    it("adds an existing legacy video to the visible history without replacing it", () => {
        const shot = { id: "shot-one", generationTaskId: "task-old", videoUrl: "/legacy.mp4" } as DramaShot;

        expect(visibleDramaShotVideoResults(shot)).toEqual([{ id: "shot-output:task-old:/legacy.mp4", taskId: "task-old", url: "/legacy.mp4" }]);
    });
});
