import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchSafeOutbound: vi.fn() }));

vi.mock("@/lib/server/safe-outbound-fetch", () => ({ fetchSafeOutbound: mocks.fetchSafeOutbound }));

import { resolveProviderReadableReferenceMedia } from "./provider-reference-media";

describe("provider reference media", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects a protected reference image before it can be submitted upstream", async () => {
        mocks.fetchSafeOutbound.mockResolvedValue(new Response('{"error":"请先登录"}', { status: 401, headers: { "content-type": "application/json" } }));

        await expect(resolveProviderReadableReferenceMedia([{ type: "image", url: "https://app.example.com/api/generation-log-assets/permanent/reference.png" }])).rejects.toThrow("参考素材第 1 个图片公网不可读");
        expect(mocks.fetchSafeOutbound).toHaveBeenCalledWith(
            "https://app.example.com/api/generation-log-assets/permanent/reference.png",
            expect.objectContaining({ method: "HEAD", headers: { accept: "image/*" } }),
        );
    });

    it("accepts an image URL that returns an image response", async () => {
        mocks.fetchSafeOutbound.mockResolvedValue(new Response(null, { status: 200, headers: { "content-type": "image/png" } }));

        await expect(resolveProviderReadableReferenceMedia([{ type: "image", url: "https://app.example.com/api/generation-log-assets/permanent/reference.png?purpose=provider-read" }])).resolves.toEqual([
            { type: "image", url: "https://app.example.com/api/generation-log-assets/permanent/reference.png?purpose=provider-read" },
        ]);
    });

    it("uses a signed local mirror when the provider URL is stale", async () => {
        mocks.fetchSafeOutbound
            .mockResolvedValueOnce(new Response('{"error":"not found"}', { status: 404, headers: { "content-type": "application/json" } }))
            .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-type": "image/png" } }));

        await expect(
            resolveProviderReadableReferenceMedia([
                {
                    type: "image",
                    url: "https://provider.example/expired.png",
                    remoteUrl: "https://provider.example/expired.png",
                    serverUrl: "https://app.example.com/api/generation-log-assets/permanent/reference.png?purpose=provider-read",
                },
            ]),
        ).resolves.toEqual([
            {
                type: "image",
                url: "https://app.example.com/api/generation-log-assets/permanent/reference.png?purpose=provider-read",
                remoteUrl: "https://provider.example/expired.png",
                serverUrl: "https://app.example.com/api/generation-log-assets/permanent/reference.png?purpose=provider-read",
            },
        ]);
    });
});
