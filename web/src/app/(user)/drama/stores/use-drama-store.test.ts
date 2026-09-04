import { afterEach, describe, expect, it } from "vitest";

import { dramaVideoPromptRunKey, hasActiveDramaVideoPromptRun, useDramaStore } from "./use-drama-store";

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

    it("recognizes prompt optimization runs without requiring a project reload", () => {
        const runs = { [dramaVideoPromptRunKey("project-one", "episode-one", "shot-one")]: { startedAt: Date.now() } };
        expect(hasActiveDramaVideoPromptRun(runs, "project-one", "episode-one")).toBe(true);
        expect(hasActiveDramaVideoPromptRun(runs, "project-one", "episode-two")).toBe(false);
    });

    it("ignores malformed optimization keys when checking active runs", () => {
        expect(hasActiveDramaVideoPromptRun({ broken: { startedAt: Date.now() } }, "project-one", "episode-one")).toBe(false);
    });
});
