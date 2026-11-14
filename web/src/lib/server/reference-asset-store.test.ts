import { beforeEach, describe, expect, it, vi } from "vitest";

import sharp from "sharp";

const mocks = vi.hoisted(() => ({
    cleanupExpired: vi.fn(),
    getRegistration: vi.fn(),
    register: vi.fn(),
    persistExternal: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    sharpToBuffer: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
}));

vi.mock("node:fs/promises", () => ({
    copyFile: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
    stat: mocks.stat,
    unlink: mocks.unlink,
    writeFile: vi.fn(),
}));
vi.mock("@/lib/server/local-media-registry", () => ({
    getLocalMediaRegistration: mocks.getRegistration,
    registerLocalMediaAsset: mocks.register,
}));
vi.mock("@/lib/server/local-media-storage", () => ({
    cleanupExpiredLocalMediaAssets: mocks.cleanupExpired,
    createDatedMediaPath: vi.fn(() => "temporary/2026/01/01/images/file.png"),
    REFERENCE_MEDIA_ROOT: "C:\\tmp\\reference-assets",
}));
vi.mock("@/lib/server/object-storage-service", () => ({
    persistExternalMediaIfEnabled: mocks.persistExternal,
}));
vi.mock("sharp", () => ({
    default: vi.fn(() => ({ png: () => ({ toBuffer: mocks.sharpToBuffer }) })),
}));

import { ensureReferenceAssetPngVariantUrl, ensureReferenceImagePngVariant, readReferenceAsset, writeReferenceMediaDataUrl } from "./reference-asset-store";

const JPEG_TOKEN = "permanent/2026/01/01/images/20260101-000000-00000000-0000-4000-8000-000000000000.jpg";
const PNG_TOKEN = "permanent/2026/01/01/images/20260101-000000-00000000-0000-4000-8000-000000000000.png";

describe("reference asset lifecycle boundaries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.persistExternal.mockResolvedValue(null);
    });

    it("does not run media cleanup from the online write path", async () => {
        await expect(writeReferenceMediaDataUrl("invalid", "image", { ownerUserId: "user-one", source: "test" })).rejects.toThrow("参考素材格式不正确");
        expect(mocks.cleanupExpired).not.toHaveBeenCalled();
    });

    it("leaves expired temporary files for reference-aware maintenance", async () => {
        const registration = { storageKey: "temporary/2026/01/01/images/20260101-000000-00000000-0000-4000-8000-000000000000.png" };
        mocks.stat.mockResolvedValue({ size: 12, mtimeMs: 0 });
        mocks.getRegistration.mockResolvedValue(registration);

        await expect(readReferenceAsset(registration.storageKey)).resolves.toMatchObject({ size: 12, registration });
        expect(mocks.unlink).not.toHaveBeenCalled();
    });

    it("reuses an existing PNG variant registration without re-encoding", async () => {
        mocks.getRegistration.mockImplementation(async (key: string) => (key === PNG_TOKEN ? { storageKey: PNG_TOKEN } : null));

        await expect(ensureReferenceImagePngVariant(JPEG_TOKEN, { ownerUserId: "user-one" })).resolves.toBe(PNG_TOKEN);
        expect(mocks.stat).not.toHaveBeenCalled();
        expect(mocks.sharpToBuffer).not.toHaveBeenCalled();
        expect(mocks.register).not.toHaveBeenCalled();
    });

    it("converts a JPEG reference into a deterministic PNG variant", async () => {
        mocks.getRegistration.mockResolvedValue(null);
        mocks.stat.mockResolvedValue({ size: 1200, mtimeMs: 0 });

        await expect(ensureReferenceImagePngVariant(JPEG_TOKEN, { ownerUserId: "user-one" })).resolves.toBe(PNG_TOKEN);
        expect(sharp).toHaveBeenCalledWith(expect.stringContaining("20260101-000000-00000000-0000-4000-8000-000000000000.jpg"));
        expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({ storageKey: PNG_TOKEN, mimeType: "image/png", ownerUserId: "user-one", source: "provider-png-variant" }));
        expect(mocks.persistExternal).toHaveBeenCalledTimes(1);
    });

    it("returns null for non-JPEG sources and missing files", async () => {
        mocks.getRegistration.mockResolvedValue(null);
        mocks.stat.mockRejectedValue(new Error("missing"));

        await expect(ensureReferenceImagePngVariant(PNG_TOKEN, { ownerUserId: "user-one" })).resolves.toBeNull();
        await expect(ensureReferenceImagePngVariant("permanent/2026/01/01/images/short-name.jpg", { ownerUserId: "user-one" })).resolves.toBeNull();
        expect(mocks.sharpToBuffer).not.toHaveBeenCalled();
    });

    it("maps reference asset URLs onto PNG variant URLs", async () => {
        mocks.getRegistration.mockImplementation(async (key: string) => (key === PNG_TOKEN ? { storageKey: PNG_TOKEN } : null));

        await expect(ensureReferenceAssetPngVariantUrl(`/api/reference-assets/${JPEG_TOKEN}?purpose=provider-read`, { ownerUserId: "user-one" })).resolves.toBe(`/api/reference-assets/${PNG_TOKEN}`);
        await expect(ensureReferenceAssetPngVariantUrl(`/api/reference-assets/${PNG_TOKEN}`, { ownerUserId: "user-one" })).resolves.toBeNull();
        await expect(ensureReferenceAssetPngVariantUrl("https://cdn.example.com/media/photo.jpg", { ownerUserId: "user-one" })).resolves.toBeNull();
    });
});
