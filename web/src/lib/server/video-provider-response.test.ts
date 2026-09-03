import { describe, expect, it } from "vitest";

import { videoProviderMediaUrl, videoProviderResultUrlError } from "./video-provider-response";

describe("videoProviderMediaUrl", () => {
    it("keeps direct supplier URLs when a legacy task stores an absolute channel base", () => {
        expect(videoProviderMediaUrl("https://api.tokengo.love", "https://cdn.example.com/video.mp4")).toBe("https://cdn.example.com/video.mp4");
    });

    it("uses the internal authorized media proxy for system channels", () => {
        expect(videoProviderMediaUrl("/api/ai/system/buming-video", "https://cdn.example.com/video.mp4")).toBe("/api/ai/system/buming-video/_media?url=https%3A%2F%2Fcdn.example.com%2Fvideo.mp4");
    });

    it("recognizes an encoded provider failure returned in place of a media URL", () => {
        expect(
            videoProviderResultUrlError(
                "http://provider.example/%E5%8F%82%E8%80%83%E7%B4%A0%E6%9D%90%E7%AC%AC%201%20%E4%B8%AA%E5%9B%BE%E7%89%87%E4%B8%8B%E8%BD%BD%E5%A4%B1%E8%B4%A5%EF%BC%9AHTTP%20404%EF%BC%8C%E8%B5%84%E6%BA%90%E4%B8%8D%E5%AD%98%E5%9C%A8",
            ),
        ).toContain("参考素材第 1 个图片下载失败");
        expect(videoProviderResultUrlError("http://provider.example/video%20generation%20timed%20out")).toContain("video generation timed out");
        expect(videoProviderResultUrlError("https://cdn.example.com/result.mp4")).toBe("");
    });
});
