import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { normalizeGeneratedImageBytes } from "./generated-image-normalizer";

describe("generated image normalization", () => {
    it("preserves the full upstream image when fitting a different target ratio", async () => {
        const source = await sharp(
            Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"><rect width="900" height="1600" fill="white"/><rect width="900" height="120" fill="red"/><rect y="1480" width="900" height="120" fill="blue"/></svg>'),
        )
            .png()
            .toBuffer();

        const result = await normalizeGeneratedImageBytes(source, "image/png", "1600x900");
        const pixels = await sharp(result.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const pixelAt = (x: number, y: number) => {
            const offset = (y * pixels.info.width + x) * pixels.info.channels;
            return [...pixels.data.subarray(offset, offset + 3)];
        };

        expect(pixelAt(800, 20)).toEqual([255, 0, 0]);
        expect(pixelAt(800, 880)).toEqual([0, 0, 255]);
    });

    it("resizes an upstream image to the exact requested dimensions", async () => {
        const source = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#7c8da5" } })
            .png()
            .toBuffer();
        const result = await normalizeGeneratedImageBytes(source, "image/png", "1824x1024");

        expect(result).toMatchObject({ mimeType: "image/png", width: 1824, height: 1024 });
        await expect(sharp(result.bytes).metadata()).resolves.toMatchObject({ format: "png", width: 1824, height: 1024 });
    });

    it("restores a provider-safe image to a small exact requested size", async () => {
        const source = await sharp({ create: { width: 672, height: 1008, channels: 3, background: "#9a6b4f" } })
            .png()
            .toBuffer();
        const result = await normalizeGeneratedImageBytes(source, "image/png", "400x600");

        expect(result).toMatchObject({ mimeType: "image/png", width: 400, height: 600 });
        await expect(sharp(result.bytes).metadata()).resolves.toMatchObject({ format: "png", width: 400, height: 600 });
    });

    it("keeps the upstream file unchanged when no exact target is configured", async () => {
        const source = await sharp({ create: { width: 1280, height: 720, channels: 3, background: "#506070" } })
            .jpeg({ quality: 92 })
            .toBuffer();
        const result = await normalizeGeneratedImageBytes(source, "image/jpeg", "16:9");

        expect(result).toMatchObject({ mimeType: "image/jpeg", width: 1280, height: 720 });
        expect(result.bytes).toEqual(source);
    });

    it("keeps a large exact upstream image instead of applying a platform edge ceiling", async () => {
        const source = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#203040" } })
            .webp()
            .toBuffer();
        const result = await normalizeGeneratedImageBytes(source, "image/webp", "4096x2304");

        expect(result).toMatchObject({ width: 4096, height: 2304 });
        await expect(sharp(result.bytes).metadata()).resolves.toMatchObject({ format: "webp", width: 4096, height: 2304 });
    });
});
