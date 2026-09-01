import { describe, expect, it } from "vitest";

import { videoProviderMediaUrl } from "./video-provider-response";

describe("videoProviderMediaUrl", () => {
    it("keeps direct supplier URLs when a legacy task stores an absolute channel base", () => {
        expect(videoProviderMediaUrl("https://api.tokengo.love", "https://cdn.example.com/video.mp4")).toBe("https://cdn.example.com/video.mp4");
    });

    it("uses the internal authorized media proxy for system channels", () => {
        expect(videoProviderMediaUrl("/api/ai/system/buming-video", "https://cdn.example.com/video.mp4")).toBe("/api/ai/system/buming-video/_media?url=https%3A%2F%2Fcdn.example.com%2Fvideo.mp4");
    });
});
