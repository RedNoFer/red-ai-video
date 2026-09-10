import { getTrustedProxyHops } from "@/lib/server/trusted-proxy";

export function resolvePublicRequestOrigin(request: Request, configuredValue = process.env.NEXT_PUBLIC_SITE_URL || "", preferredValue = "") {
    const configured = normalizeWebOrigin(configuredValue);
    const requested = requestOrigin(request);
    const preferred = normalizeWebOrigin(preferredValue);

    // Internal calls can carry the public origin from the browser-facing request.
    if (preferred && requested && !isPublicOrigin(requested) && isPublicOrigin(preferred)) return preferred;
    // A temporary tunnel must not override the real domain used for the current request.
    if (configured && isEphemeralTunnelOrigin(configured) && isPublicOrigin(requested)) return requested;
    if (configured && !isLoopbackOrigin(configured)) return configured;
    if (requested && isPublicOrigin(requested)) return requested;
    return requested || configured || "http://localhost:3000";
}

function requestOrigin(request: Request) {
    const requestUrl = parseUrl(request.url);
    if (!requestUrl) return "";

    const trustForwarded = getTrustedProxyHops() > 0;
    const host = (trustForwarded ? firstForwardedValue(request.headers.get("x-forwarded-host")) : "") || request.headers.get("host")?.trim() || requestUrl.host;
    const protocol = (trustForwarded ? firstForwardedValue(request.headers.get("x-forwarded-proto")) : "") || requestUrl.protocol.replace(/:$/, "");
    return normalizeWebOrigin(`${protocol}://${host}`);
}

function firstForwardedValue(value: string | null) {
    return value?.split(",")[0]?.trim() || "";
}

function normalizeWebOrigin(value: string) {
    const parsed = parseUrl(value.trim());
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) return "";
    return parsed.origin;
}

function isLoopbackOrigin(origin: string) {
    const hostname = parseUrl(origin)
        ?.hostname.toLowerCase()
        .replace(/^\[|\]$/g, "");
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isPublicOrigin(origin: string) {
    const hostname = parseUrl(origin)
        ?.hostname.toLowerCase()
        .replace(/^\[|\]$/g, "");
    if (!hostname || isLoopbackOrigin(origin) || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80")) return false;
    const parts = hostname.split(".").map((part) => Number(part));
    if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
        const [a, b] = parts;
        return !(a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0);
    }
    return hostname.includes(".");
}

function isEphemeralTunnelOrigin(origin: string) {
    const hostname = parseUrl(origin)?.hostname.toLowerCase() || "";
    return hostname.endsWith(".trycloudflare.com") || hostname.endsWith(".cfargotunnel.com");
}

function parseUrl(value: string) {
    try {
        return new URL(value);
    } catch {
        return null;
    }
}
