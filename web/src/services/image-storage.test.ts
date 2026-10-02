import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), meta: vi.fn() }));
vi.mock("@/services/server-media-storage", () => ({ uploadServerMedia: mocks.upload }));
vi.mock("@/lib/image-utils", () => ({ readImageMeta: mocks.meta }));
import { uploadImage } from "./image-storage";

afterEach(() => vi.restoreAllMocks());

it("reads Blob dimensions locally while uploading, without downloading the uploaded original", async () => {
    const file = new Blob(["image"], { type: "image/png" });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-image");
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    mocks.upload.mockResolvedValue({ url: "/api/reference-assets/permanent/image.png", storageKey: "permanent/image.png", bytes: 5, mimeType: "image/png" });
    mocks.meta.mockResolvedValue({ width: 4000, height: 2000, mimeType: "image/png" });
    await expect(uploadImage(file)).resolves.toMatchObject({ width: 4000, height: 2000 });
    expect(mocks.meta).toHaveBeenCalledWith("blob:local-image");
    expect(revoke).toHaveBeenCalledWith("blob:local-image");
});

it("releases the local preview when upload fails", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:failed-image");
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    mocks.upload.mockRejectedValue(new Error("upload failed"));
    mocks.meta.mockResolvedValue({ width: 10, height: 10 });
    await expect(uploadImage(new Blob(["image"]))).rejects.toThrow("upload failed");
    expect(revoke).toHaveBeenCalledWith("blob:failed-image");
});
