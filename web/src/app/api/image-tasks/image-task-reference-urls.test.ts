import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchSafeOutbound: vi.fn() }));

vi.mock("@/lib/server/safe-outbound-fetch", () => ({ fetchSafeOutbound: mocks.fetchSafeOutbound }));

import { publicImageReferenceRequestUrl } from "./image-task-reference-urls";

describe("image task reference request URLs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_REFERENCE_ASSET_SIGNING_KEY = "test-signing-key";
        mocks.fetchSafeOutbound.mockResolvedValue(new Response(new Uint8Array([137]), { status: 206, headers: { "content-type": "image/png" } }));
    });

    afterEach(() => {
        delete process.env.VOZEB_PRO_REFERENCE_ASSET_SIGNING_KEY;
    });

    it("prefers a provider URL when a reference also has a local mirror", async () => {
        await expect(
            publicImageReferenceRequestUrl(
                {
                    id: "reference-one",
                    type: "image/png",
                    dataUrl: "/api/reference-assets/local.png",
                    url: "/api/reference-assets/local.png",
                    serverUrl: "/api/reference-assets/local.png",
                    remoteUrl: "https://provider.example/generated.png",
                },
                "http://127.0.0.1:3010",
                "https://vozeb.example",
                { ownerUserId: "user-one", taskId: "task-one" },
            ),
        ).resolves.toBe("https://provider.example/generated.png");
    });

    it("keeps the provider URL as the localhost fallback", async () => {
        await expect(
            publicImageReferenceRequestUrl({ id: "reference-one", type: "image/png", dataUrl: "", serverUrl: "/api/generation-log-assets/local.png", remoteUrl: "https://provider.example/generated.png" }, "http://127.0.0.1:3010", "http://127.0.0.1:3010", {
                ownerUserId: "user-one",
                taskId: "task-one",
            }),
        ).resolves.toBe("https://provider.example/generated.png");
    });

    it("rejects a stale provider-only reference before submission", async () => {
        mocks.fetchSafeOutbound.mockResolvedValue(new Response('{"error":"not found"}', { status: 404, headers: { "content-type": "application/json" } }));

        await expect(
            publicImageReferenceRequestUrl({ id: "reference-one", type: "image/png", dataUrl: "", remoteUrl: "https://provider.example/expired.png" }, "http://127.0.0.1:3010", "https://vozeb.example", { ownerUserId: "user-one", taskId: "task-one" }),
        ).rejects.toThrow("供应商参考图已失效且没有可用本地副本");
        expect(mocks.fetchSafeOutbound).toHaveBeenCalledWith("https://provider.example/expired.png", expect.objectContaining({ method: "HEAD", headers: { accept: "image/*" } }));
    });

    it("signs a local mirror only when no provider URL exists", async () => {
        await expect(
            publicImageReferenceRequestUrl({ id: "reference-one", type: "image/png", dataUrl: "", serverUrl: "/api/generation-log-assets/local.png" }, "http://127.0.0.1:3010", "https://vozeb.example", {
                ownerUserId: "user-one",
                taskId: "task-one",
            }),
        ).resolves.toMatch(/^https:\/\/vozeb\.example\/api\/generation-log-assets\/local\.png\?purpose=provider-read/);
        expect(mocks.fetchSafeOutbound).toHaveBeenCalledTimes(1);
    });

    it("falls back to the signed local mirror when the provider URL is stale", async () => {
        mocks.fetchSafeOutbound
            .mockResolvedValueOnce(new Response('{"error":"not found"}', { status: 404, headers: { "content-type": "application/json" } }))
            .mockResolvedValueOnce(new Response(new Uint8Array([137]), { status: 206, headers: { "content-type": "image/png" } }));

        await expect(
            publicImageReferenceRequestUrl(
                {
                    id: "reference-one",
                    type: "image/png",
                    dataUrl: "/api/reference-assets/local.png",
                    url: "/api/reference-assets/local.png",
                    serverUrl: "/api/reference-assets/local.png",
                    remoteUrl: "https://provider.example/expired.png",
                },
                "http://127.0.0.1:3010",
                "https://vozeb.example",
                { ownerUserId: "user-one", taskId: "task-one" },
            ),
        ).resolves.toMatch(/^https:\/\/vozeb\.example\/api\/reference-assets\/local\.png\?purpose=provider-read/);
        expect(mocks.fetchSafeOutbound).toHaveBeenNthCalledWith(1, "https://provider.example/expired.png", expect.objectContaining({ method: "HEAD", headers: { accept: "image/*" } }));
        expect(mocks.fetchSafeOutbound).toHaveBeenCalledTimes(2);
    });

    it("uses a bounded WebP variant for a signed local fallback", async () => {
        mocks.fetchSafeOutbound
            .mockResolvedValueOnce(new Response('{"error":"not found"}', { status: 404, headers: { "content-type": "application/json" } }))
            .mockResolvedValueOnce(new Response(new Uint8Array([137]), { status: 200, headers: { "content-type": "image/webp" } }));

        const result = await publicImageReferenceRequestUrl(
            { id: "reference-one", type: "image/png", dataUrl: "", serverUrl: "/api/generation-log-assets/local.png", remoteUrl: "https://provider.example/expired.png" },
            "http://127.0.0.1:3010",
            "https://vozeb.example",
            { ownerUserId: "user-one", taskId: "task-one" },
        );
        const parsed = new URL(result);
        expect(parsed.pathname).toBe("/api/generation-log-assets/local.png");
        expect(parsed.searchParams.get("purpose")).toBe("provider-read");
        expect(parsed.searchParams.get("format")).toBe("webp");
        expect(parsed.searchParams.get("width")).toBe("1600");
    });

    it("rejects an unreachable local public URL before creating a provider task", async () => {
        mocks.fetchSafeOutbound.mockResolvedValue(new Response("gateway unavailable", { status: 502, headers: { "content-type": "text/plain" } }));

        await expect(
            publicImageReferenceRequestUrl({ id: "reference-one", type: "image/png", dataUrl: "", serverUrl: "/api/generation-log-assets/local.png" }, "http://127.0.0.1:3010", "https://dead-tunnel.example", {
                ownerUserId: "user-one",
                taskId: "task-one",
            }),
        ).rejects.toThrow("本地参考图公网地址不可访问");
    });

    it("falls back to a ranged GET when the image host does not support HEAD", async () => {
        mocks.fetchSafeOutbound
            .mockResolvedValueOnce(new Response("method not allowed", { status: 405, headers: { "content-type": "text/plain" } }))
            .mockResolvedValueOnce(new Response(new Uint8Array([137]), { status: 206, headers: { "content-type": "image/png" } }));

        await expect(
            publicImageReferenceRequestUrl({ id: "reference-one", type: "image/png", dataUrl: "", remoteUrl: "https://provider.example/generated.png" }, "http://127.0.0.1:3010", "https://vozeb.example", {
                ownerUserId: "user-one",
                taskId: "task-one",
            }),
        ).resolves.toBe("https://provider.example/generated.png");
        expect(mocks.fetchSafeOutbound).toHaveBeenNthCalledWith(1, "https://provider.example/generated.png", expect.objectContaining({ method: "HEAD" }));
        expect(mocks.fetchSafeOutbound).toHaveBeenNthCalledWith(2, "https://provider.example/generated.png", expect.objectContaining({ headers: { accept: "image/*", range: "bytes=0-0" } }));
    });

    it("keeps an already signed local asset when the worker cannot sign again", async () => {
        delete process.env.VOZEB_PRO_REFERENCE_ASSET_SIGNING_KEY;
        const signedUrl = "https://vozeb.example/api/generation-log-assets/permanent/frame.png?purpose=provider-read&expires=4102444800&signature=already-signed";
        const result = await publicImageReferenceRequestUrl({ id: "reference-one", type: "image/png", dataUrl: "", url: signedUrl }, "http://127.0.0.1:3010", "https://vozeb.example", {
            ownerUserId: "user-one",
            taskId: "task-one",
        });
        const parsed = new URL(result);
        expect(parsed.origin + parsed.pathname).toBe("https://vozeb.example/api/generation-log-assets/permanent/frame.png");
        expect(parsed.searchParams.get("purpose")).toBe("provider-read");
        expect(parsed.searchParams.get("expires")).toBe("4102444800");
        expect(parsed.searchParams.get("signature")).toBe("already-signed");
        expect(parsed.searchParams.get("format")).toBe("webp");
        expect(parsed.searchParams.get("width")).toBe("1600");
    });
});
