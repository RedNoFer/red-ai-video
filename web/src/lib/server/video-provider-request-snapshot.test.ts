import { describe, expect, it } from "vitest";

import { createVideoProviderRequestSnapshot } from "./video-provider-request-snapshot";

describe("video provider request snapshots", () => {
    it("keeps the exact prompt and ordered image/video references", () => {
        const snapshot = createVideoProviderRequestSnapshot(
            "/v1/videos",
            "动态意图：完整执行提示词\n时间段动作：P01-F01",
            [
                { type: "image", role: "reference", url: "https://cdn.example.com/frame.png" },
                { type: "video", role: "reference", url: "https://cdn.example.com/source.m4v" },
            ],
            JSON.stringify({ model: "alibaba/wan-3.0", prompt: "完整执行提示词", referenceImages: ["https://cdn.example.com/frame.png"], referenceVideos: ["https://cdn.example.com/source.m4v"] }),
            false,
        );

        expect(snapshot).toMatchObject({
            path: "/v1/videos",
            promptLength: "动态意图：完整执行提示词\n时间段动作：P01-F01".length,
            references: [
                { type: "image", role: "reference", url: "https://cdn.example.com/frame.png" },
                { type: "video", role: "reference", url: "https://cdn.example.com/source.m4v" },
            ],
            body: { referenceImages: ["https://cdn.example.com/frame.png"], referenceVideos: ["https://cdn.example.com/source.m4v"] },
            bodyKind: "json",
        });
    });
});
