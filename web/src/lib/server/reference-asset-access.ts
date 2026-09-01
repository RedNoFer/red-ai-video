import { createHmac, timingSafeEqual } from "node:crypto";

import { REFERENCE_ASSET_SIGNATURE_PURPOSE } from "@/lib/reference-asset-url";

const SIGNED_URL_TTL_MS = 15 * 60 * 1000;
const SIGNED_URL_TTL_SECONDS = SIGNED_URL_TTL_MS / 1000;
const GENERATION_SCOPE = "generation";

export function createSignedReferenceAssetUrl(token: string, origin: string, now = Date.now()) {
    return createSignedMediaAssetUrl("reference-assets", token, origin, now);
}

export function createSignedGenerationAssetUrl(token: string, origin: string, now = Date.now()) {
    return createSignedMediaAssetUrl("generation-log-assets", token, origin, now);
}

function createSignedMediaAssetUrl(scope: "reference-assets" | "generation-log-assets", token: string, origin: string, now: number) {
    const secret = signingSecret();
    const normalizedOrigin = normalizeOrigin(origin);
    if (!secret || !normalizedOrigin || !token) return "";
    const expires = Math.floor((now + SIGNED_URL_TTL_MS) / 1000);
    const signature = sign(scope === "generation-log-assets" ? `${GENERATION_SCOPE}\0${token}` : token, REFERENCE_ASSET_SIGNATURE_PURPOSE, expires, secret);
    const path = token.split("/").map(encodeURIComponent).join("/");
    return `${normalizedOrigin}/api/${scope}/${path}?purpose=${REFERENCE_ASSET_SIGNATURE_PURPOSE}&expires=${expires}&signature=${signature}`;
}

export function signReferenceAssetInputUrl(value: string, origin: string, now = Date.now()) {
    const raw = value.trim();
    if (!raw) return "";
    let url: URL;
    try {
        url = new URL(raw, normalizeOrigin(origin));
    } catch {
        return raw;
    }
    const scopes = [
        { prefix: "/api/reference-assets/", sign: createSignedReferenceAssetUrl },
        { prefix: "/api/generation-log-assets/", sign: createSignedGenerationAssetUrl },
    ] as const;
    const scope = scopes.find((candidate) => url.pathname.startsWith(candidate.prefix));
    if (!scope) return raw;
    const token = url.pathname
        .slice(scope.prefix.length)
        .split("/")
        .map((part) => decodeURIComponent(part))
        .join("/");
    return scope.sign(token, origin, now) || raw;
}

export function verifyGenerationAssetSignature(token: string, purpose: string | null, expiresValue: string | null, signature: string | null, now = Date.now()) {
    return verifyMediaSignature(`${GENERATION_SCOPE}\0${token}`, purpose, expiresValue, signature, now);
}

export function verifyReferenceAssetSignature(token: string, purpose: string | null, expiresValue: string | null, signature: string | null, now = Date.now()) {
    return verifyMediaSignature(token, purpose, expiresValue, signature, now);
}

function verifyMediaSignature(token: string, purpose: string | null, expiresValue: string | null, signature: string | null, now: number) {
    const secret = signingSecret();
    const expires = Number(expiresValue);
    const nowSeconds = Math.floor(now / 1000);
    if (!secret || !token || purpose !== REFERENCE_ASSET_SIGNATURE_PURPOSE || !signature || !Number.isInteger(expires) || expires <= nowSeconds || expires > nowSeconds + SIGNED_URL_TTL_SECONDS + 1) return false;
    const expected = Buffer.from(sign(token, purpose, expires, secret));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sign(token: string, purpose: string, expires: number, secret: string) {
    return createHmac("sha256", secret).update(`v1\0${purpose}\0${expires}\0${token}`).digest("base64url");
}

function signingSecret() {
    return process.env.VOZEB_PRO_REFERENCE_ASSET_SIGNING_KEY?.trim() || process.env.VOZEB_PRO_ENCRYPTION_KEY?.trim() || "";
}

function normalizeOrigin(value: string) {
    try {
        const url = new URL(value.trim());
        return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
    } catch {
        return "";
    }
}
