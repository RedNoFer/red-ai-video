import { beforeEach, describe, expect, it, vi } from "vitest";

const writePersistentMediaDataUrl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/reference-asset-store", () => ({ writePersistentMediaDataUrl }));

import { persistDramaGeneratedImageReference } from "./drama-asset-reference-media";

describe("drama generated asset media", () => {
    beforeEach(() => vi.clearAllMocks());

    it("keeps an existing site media URL", async () => {
        await expect(
            persistDramaGeneratedImageReference(
                { serverUrl: "/api/generation-log-assets/permanent/image.png", remoteUrl: "https://provider.example/image.png" },
                { ownerUserId: "user-one", projectId: "drama-one", taskId: "task-one", originalName: "角色.png" },
            ),
        ).resolves.toEqual({ url: "/api/generation-log-assets/permanent/image.png", remoteUrl: "https://provider.example/image.png" });
        expect(writePersistentMediaDataUrl).not.toHaveBeenCalled();
    });

    it("normalizes an absolute internal media URL", async () => {
        await expect(
            persistDramaGeneratedImageReference(
                { serverUrl: "https://app.example/api/generation-log-assets/permanent/image.png", remoteUrl: "https://provider.example/image.png" },
                { ownerUserId: "user-one", projectId: "drama-one", taskId: "task-one", originalName: "角色.png" },
            ),
        ).resolves.toEqual({ url: "/api/generation-log-assets/permanent/image.png", remoteUrl: "https://provider.example/image.png" });
        expect(writePersistentMediaDataUrl).not.toHaveBeenCalled();
    });

    it("persists inline results before exposing them as project references", async () => {
        writePersistentMediaDataUrl.mockResolvedValue({ token: "permanent/2026/08/22/images/result.png" });

        await expect(
            persistDramaGeneratedImageReference({ dataUrl: "data:image/png;base64,AAAA", remoteUrl: "https://provider.example/expired.png" }, { ownerUserId: "user-one", projectId: "drama-one", taskId: "task-one", originalName: "角色.png" }),
        ).resolves.toEqual({ url: "/api/reference-assets/permanent/2026/08/22/images/result.png", storageKey: "permanent/2026/08/22/images/result.png", remoteUrl: "https://provider.example/expired.png" });
        expect(writePersistentMediaDataUrl).toHaveBeenCalledWith("data:image/png;base64,AAAA", "image", expect.objectContaining({ ownerUserId: "user-one", projectId: "drama-one", taskId: "task-one", source: "drama-asset-generation" }));
    });

    it("does not persist an upstream-only URL", async () => {
        await expect(persistDramaGeneratedImageReference({ remoteUrl: "https://provider.example/expired.png" }, { ownerUserId: "user-one", projectId: "drama-one", taskId: "task-one", originalName: "角色.png" })).resolves.toBeNull();
        expect(writePersistentMediaDataUrl).not.toHaveBeenCalled();
    });
});
