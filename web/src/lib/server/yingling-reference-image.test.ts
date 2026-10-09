import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchSafeOutbound: vi.fn(), writeReferenceMediaBytes: vi.fn(), createSignedReferenceAssetUrl: vi.fn() }));

vi.mock("@/lib/server/safe-outbound-fetch", () => ({ fetchSafeOutbound: mocks.fetchSafeOutbound }));
vi.mock("@/lib/server/reference-asset-store", () => ({ writeReferenceMediaBytes: mocks.writeReferenceMediaBytes }));
vi.mock("@/lib/server/reference-asset-access", () => ({ createSignedReferenceAssetUrl: mocks.createSignedReferenceAssetUrl }));

import sharp from "sharp";

import { YINGLING_REFERENCE_IMAGE_MAX_BYTES } from "@/lib/yingling-reference-constraints";
import { compressYinglingReferenceImageBytes, publishYinglingVideoReferenceImages } from "./yingling-reference-image";

describe("Yingling reference image compression", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.writeReferenceMediaBytes.mockResolvedValue({ token: "temporary/compressed.jpg", bytes: 1, mimeType: "image/jpeg" });
        mocks.createSignedReferenceAssetUrl.mockReturnValue("https://app.example.com/api/reference-assets/temporary/compressed.jpg?signature=test");
    });

    it("leaves a reference below the supplier cap unchanged", async () => {
        const url = "https://cdn.example.com/reference.jpg";
        mocks.fetchSafeOutbound.mockResolvedValue(new Response(null, { status: 200, headers: { "content-type": "image/jpeg", "content-length": "1000" } }));

        const result = await publishYinglingVideoReferenceImages([{ type: "image", url }], YINGLING_REFERENCE_IMAGE_MAX_BYTES, {
            ownerUserId: "user-one",
            publicOrigin: "https://app.example.com",
        });

        expect(result).toEqual([{ type: "image", url }]);
        expect(mocks.fetchSafeOutbound).toHaveBeenCalledTimes(1);
        expect(mocks.writeReferenceMediaBytes).not.toHaveBeenCalled();
    });

    it("re-encodes an oversized opaque image below the supplier cap", async () => {
        const width = 2000;
        const height = 2000;
        const raw = Buffer.alloc(width * height * 3, 127);
        const source = await sharp(raw, { raw: { width, height, channels: 3 } })
            .png({ compressionLevel: 0 })
            .toBuffer();
        expect(source.length).toBeGreaterThan(YINGLING_REFERENCE_IMAGE_MAX_BYTES);

        const compressed = await compressYinglingReferenceImageBytes(source, "image/png");
        const metadata = await sharp(compressed.bytes).metadata();

        expect(compressed).toMatchObject({ mimeType: "image/jpeg", changed: true });
        expect(compressed.bytes.length).toBeLessThanOrEqual(YINGLING_REFERENCE_IMAGE_MAX_BYTES);
        expect(metadata).toMatchObject({ width, height, format: "jpeg" });
    });

    it("publishes a signed temporary URL for an oversized video reference", async () => {
        const width = 2000;
        const height = 2000;
        const raw = Buffer.alloc(width * height * 3, 127);
        const source = await sharp(raw, { raw: { width, height, channels: 3 } })
            .png({ compressionLevel: 0 })
            .toBuffer();
        const url = "https://cdn.example.com/reference.png";
        mocks.fetchSafeOutbound
            .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-type": "image/png", "content-length": String(source.length) } }))
            .mockResolvedValueOnce(new Response(source, { status: 200, headers: { "content-type": "image/png", "content-length": String(source.length) } }));

        const result = await publishYinglingVideoReferenceImages([{ type: "image", url, remoteUrl: url, serverUrl: "https://app.example.com/original.png" }], YINGLING_REFERENCE_IMAGE_MAX_BYTES, {
            ownerUserId: "user-one",
            publicOrigin: "https://app.example.com",
        });

        expect(result).toEqual([{ type: "image", url: "https://app.example.com/api/reference-assets/temporary/compressed.jpg?signature=test", remoteUrl: undefined, serverUrl: undefined }]);
        const [bytes, type, , context] = mocks.writeReferenceMediaBytes.mock.calls[0] as [Buffer, string, string, { source: string }];
        expect(type).toBe("image");
        expect(context.source).toBe("yingling-reference-compressed");
        expect(bytes.length).toBeLessThanOrEqual(YINGLING_REFERENCE_IMAGE_MAX_BYTES);
    });
});
