import { afterEach, describe, expect, it } from "vitest";

import { dramaVideoPromptRunKey, useDramaStore } from "./use-drama-store";

describe("drama video prompt run lock", () => {
    afterEach(() => useDramaStore.getState().reset());

    it("keeps one in-flight run per project, episode and shot until it finishes", () => {
        const key = dramaVideoPromptRunKey("project-one", "episode-one", "shot-one");
        expect(useDramaStore.getState().beginVideoPrompt("project-one", "episode-one", "shot-one")).toBe(true);
        expect(useDramaStore.getState().videoPromptRuns[key]).toEqual(expect.objectContaining({ startedAt: expect.any(Number) }));
        expect(useDramaStore.getState().beginVideoPrompt("project-one", "episode-one", "shot-one")).toBe(false);
        expect(useDramaStore.getState().beginVideoPrompt("project-one", "episode-one", "shot-two")).toBe(true);

        useDramaStore.getState().finishVideoPrompt("project-one", "episode-one", "shot-one");
        expect(useDramaStore.getState().videoPromptRuns[key]).toBeUndefined();
        expect(useDramaStore.getState().beginVideoPrompt("project-one", "episode-one", "shot-one")).toBe(true);
    });
});
