import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    fetchSafeOutbound: vi.fn(),
    getAuthSettings: vi.fn(),
    imageReferenceToDataUrl: vi.fn(),
}));

vi.mock("@/lib/auth/store", () => ({ getAuthSettings: mocks.getAuthSettings }));
vi.mock("@/lib/server/safe-outbound-fetch", () => ({ fetchSafeOutbound: mocks.fetchSafeOutbound }));
vi.mock("./image-task-support", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./image-task-support")>()),
    imageReferenceToDataUrl: mocks.imageReferenceToDataUrl,
}));

import { emptyAdvancedConfig } from "@/lib/channel-protocol-registry";
import { bumingImageReferenceUrl, resolveDeclarativeImageSize } from "./image-task-custom";

beforeEach(() => {
    vi.resetAllMocks();
    process.env.VOZEB_PRO_REFERENCE_ASSET_SIGNING_KEY = "test-signing-key";
});

afterEach(() => {
    delete process.env.VOZEB_PRO_REFERENCE_ASSET_SIGNING_KEY;
});

describe("declarative image request size", () => {
    it("uses a concrete square size for Stable Diffusion auto requests", () => {
        expect(resolveDeclarativeImageSize({ quality: "auto", size: "auto", advancedConfig: { ...emptyAdvancedConfig(), protocol: "stable-diffusion" } })).toBe("1024x1024");
    });

    it("preserves explicit dimensions and does not invent custom protocol defaults", () => {
        expect(resolveDeclarativeImageSize({ quality: "high", size: "1536x1024", advancedConfig: { ...emptyAdvancedConfig(), protocol: "stable-diffusion" } })).toBe("1536x1024");
        expect(resolveDeclarativeImageSize({ quality: "auto", size: "auto", advancedConfig: { ...emptyAdvancedConfig(), protocol: "custom" } })).toBe("");
    });
});

describe("Buming reference image fallback", () => {
    it("uploads the local mirror when the configured public origin is unreachable", async () => {
        mocks.imageReferenceToDataUrl.mockResolvedValue("data:image/png;base64,aW1hZ2U=");
        mocks.getAuthSettings.mockResolvedValue({ systemChannels: [{ id: "channel-system", apiKey: "channel-key", baseUrl: "https://api.example.com/v1" }] });
        mocks.fetchSafeOutbound
            .mockResolvedValueOnce(new Response("expired", { status: 404 }))
            .mockResolvedValueOnce(new Response("tunnel unavailable", { status: 502 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: { url: "https://cdn.example.com/uploaded.png" } }), { status: 200 }));

        const config = {
            apiKey: "system",
            channelId: "channel-system",
            baseUrl: "/api/ai/system/channel-system",
        } as Parameters<typeof bumingImageReferenceUrl>[0];
        const reference = {
            type: "image",
            url: "/api/reference-assets/temporary/2026/09/02/images/example.png",
            remoteUrl: "https://stale.example.com/frame.png",
        } as Parameters<typeof bumingImageReferenceUrl>[1];

        await expect(bumingImageReferenceUrl(config, reference, "http://127.0.0.1:3010", "https://expired.trycloudflare.com", "cookie", { ownerUserId: "user", taskId: "task" }, 0)).resolves.toBe("https://cdn.example.com/uploaded.png");
        expect(mocks.fetchSafeOutbound).toHaveBeenCalledWith("https://api.example.com/v1/files", expect.objectContaining({ method: "POST" }));
    });
});
