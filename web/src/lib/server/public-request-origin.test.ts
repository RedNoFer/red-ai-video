import { afterEach, describe, expect, it, vi } from "vitest";

import { resolvePublicRequestOrigin } from "./public-request-origin";

describe("resolvePublicRequestOrigin", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("uses the current IP when the configured site URL is loopback", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");

        expect(resolvePublicRequestOrigin(new Request("http://192.168.1.20:3000/api/referrals"))).toBe("http://192.168.1.20:3000");
    });

    it("keeps a configured public domain as the canonical origin", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://create.example.com");

        expect(resolvePublicRequestOrigin(new Request("http://192.168.1.20:3000/api/referrals"))).toBe("https://create.example.com");
    });

    it("uses the current public host when the configured origin is an expired tunnel", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://old-tunnel.trycloudflare.com");

        expect(resolvePublicRequestOrigin(new Request("https://bowlpetdaily.com/api/image-tasks"))).toBe("https://bowlpetdaily.com");
    });

    it("accepts a browser origin forwarded through an internal image request", () => {
        expect(resolvePublicRequestOrigin(new Request("http://127.0.0.1:3010/api/image-tasks"), "https://old-tunnel.trycloudflare.com", "https://bowlpetdaily.com")).toBe("https://bowlpetdaily.com");
    });

    it("uses forwarded host and protocol only behind a trusted proxy", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");
        vi.stubEnv("VOZEB_PRO_TRUSTED_PROXY_HOPS", "1");
        const request = new Request("http://127.0.0.1:3000/api/referrals", {
            headers: { host: "127.0.0.1:3000", "x-forwarded-host": "vozeb.example.com", "x-forwarded-proto": "https" },
        });

        expect(resolvePublicRequestOrigin(request)).toBe("https://vozeb.example.com");
    });
});
