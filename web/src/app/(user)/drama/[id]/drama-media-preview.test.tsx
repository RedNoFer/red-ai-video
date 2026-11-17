import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DramaMediaThumbnail } from "./drama-media-preview";

describe("drama media thumbnail", () => {
    it("renders image results as an accessible preview button", () => {
        const onOpen = vi.fn();
        const media = { type: "image" as const, title: "镜头起始帧", url: "/media/image" };
        const markup = renderToStaticMarkup(<DramaMediaThumbnail media={media} onOpen={onOpen} />);

        expect(markup).toContain(`<button type="button"`);
        expect(markup).toContain(`aria-label="查看图片：镜头起始帧"`);
        expect(markup).toContain("<img");
        expect(markup).toContain("/media/image");
        expect(markup).toContain("object-contain");
    });

    it("renders video results with a poster instead of preloading the video", () => {
        const onOpen = vi.fn();
        const media = { type: "video" as const, title: "镜头生成视频", url: "/media/video", posterUrl: "/media/poster" };
        const markup = renderToStaticMarkup(<DramaMediaThumbnail media={media} onOpen={onOpen} />);

        expect(markup).toContain(`aria-label="查看视频：镜头生成视频"`);
        expect(markup).toContain("/media/poster");
        expect(markup).not.toContain("<video");
        expect(markup).not.toContain("/media/video");
    });

    it("renders video results without a poster as a neutral placeholder", () => {
        const onOpen = vi.fn();
        const media = { type: "video" as const, title: "镜头生成视频", url: "/media/video" };
        const markup = renderToStaticMarkup(<DramaMediaThumbnail media={media} onOpen={onOpen} />);

        expect(markup).not.toContain("<video");
        expect(markup).not.toContain("/media/video");
    });
});
