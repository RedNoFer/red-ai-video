import { describe, expect, it, beforeEach } from "vitest";

import { consumeDramaCanvasSynced, markDramaCanvasSynced } from "./canvas-drama-navigation";

describe("canvas drama navigation", () => {
    beforeEach(() => {
        const values = new Map<string, string>();
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: { sessionStorage: { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } },
        });
    });

    it("consumes the post-sync marker once", () => {
        markDramaCanvasSynced("canvas-1");
        expect(consumeDramaCanvasSynced("canvas-1")).toBe(true);
        expect(consumeDramaCanvasSynced("canvas-1")).toBe(false);
    });
});
