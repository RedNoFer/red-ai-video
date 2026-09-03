import { describe, expect, it } from "vitest";

import { normalizeVideoGenerationReferences } from "./video-reference-contract";

describe("video reference contract", () => {
    it("keeps ordinary references without treating missing frames as duplicates", () => {
        expect(normalizeVideoGenerationReferences(undefined)).toEqual([]);
        expect(normalizeVideoGenerationReferences([{ type: "image", url: "https://cdn.example.com/reference.png" }])).toEqual([{ type: "image", url: "https://cdn.example.com/reference.png", role: "reference" }]);
    });

    it("accepts one distinct first and last frame", () => {
        expect(
            normalizeVideoGenerationReferences([
                { type: "image", url: "https://cdn.example.com/first.png", role: "first_frame" },
                { type: "image", url: "https://cdn.example.com/last.png", role: "last_frame" },
            ]),
        ).toEqual([
            { type: "image", url: "https://cdn.example.com/first.png", role: "first_frame" },
            { type: "image", url: "https://cdn.example.com/last.png", role: "last_frame" },
        ]);
    });

    it("accepts ordered keyframes with a continuity first frame and rejects a mixed last frame", () => {
        expect(
            normalizeVideoGenerationReferences([
                { type: "image", url: "https://cdn.example.com/one.png", role: "keyframe", keyframeIndex: 1 },
                { type: "image", url: "https://cdn.example.com/two.png", role: "keyframe", keyframeIndex: 2 },
            ]),
        ).toMatchObject([
            { role: "keyframe", keyframeIndex: 1 },
            { role: "keyframe", keyframeIndex: 2 },
        ]);
        expect(
            normalizeVideoGenerationReferences([
                { type: "image", url: "https://cdn.example.com/first.png", role: "first_frame" },
                { type: "image", url: "https://cdn.example.com/one.png", role: "keyframe", keyframeIndex: 1 },
                { type: "image", url: "https://cdn.example.com/two.png", role: "keyframe", keyframeIndex: 2 },
            ]),
        ).toHaveLength(3);
        expect(() =>
            normalizeVideoGenerationReferences([
                { type: "image", url: "https://cdn.example.com/first.png", role: "first_frame" },
                { type: "image", url: "https://cdn.example.com/one.png", role: "keyframe", keyframeIndex: 1 },
                { type: "image", url: "https://cdn.example.com/two.png", role: "keyframe", keyframeIndex: 2 },
                { type: "image", url: "https://cdn.example.com/last.png", role: "last_frame" },
            ]),
        ).toThrow("全能帧不能与尾帧混用");
    });

    it("enforces the total nine-image limit, unique images, and contiguous indexes", () => {
        const frame = (index: number, url = `https://cdn.example.com/${index}.png`) => ({ type: "image" as const, url, role: "keyframe" as const, keyframeIndex: index });
        expect(() => normalizeVideoGenerationReferences([frame(1)])).toThrow("全能帧至少需要 2 张图片");
        expect(normalizeVideoGenerationReferences(Array.from({ length: 9 }, (_, index) => frame(index + 1)))).toHaveLength(9);
        expect(() => normalizeVideoGenerationReferences(Array.from({ length: 10 }, (_, index) => frame(index + 1)))).toThrow("视频最多支持 9 张参考图");
        expect(() => normalizeVideoGenerationReferences([frame(1), frame(2, "https://cdn.example.com/1.png")])).toThrow("全能帧图片不能重复");
        expect(() => normalizeVideoGenerationReferences([frame(1), frame(3)])).toThrow("全能帧序号必须从 1 连续排列");
    });

    it("enforces the shared total nine-image reference limit", () => {
        const references = Array.from({ length: 9 }, (_, index) => ({ type: "image" as const, url: `https://cdn.example.com/reference-${index}.png` }));
        expect(normalizeVideoGenerationReferences(references)).toHaveLength(references.length);
        expect(() => normalizeVideoGenerationReferences([...references, { type: "image" as const, url: "https://cdn.example.com/reference-9.png" }])).toThrow("视频最多支持 9 张参考图");
    });

    it.each([
        [[{ type: "image", url: "https://cdn.example.com/last.png", role: "last_frame" }], "指定尾帧时必须同时指定首帧"],
        [
            [
                { type: "image", url: "https://cdn.example.com/same.png", role: "first_frame" },
                { type: "image", url: "https://cdn.example.com/same.png", role: "last_frame" },
            ],
            "首帧和尾帧不能使用同一张图片",
        ],
        [[{ type: "video", url: "https://cdn.example.com/clip.mp4", role: "first_frame" }], "视频首尾帧只能使用图片素材"],
    ])("rejects invalid frame roles", (references, message) => {
        expect(() => normalizeVideoGenerationReferences(references)).toThrow(message);
    });
});
