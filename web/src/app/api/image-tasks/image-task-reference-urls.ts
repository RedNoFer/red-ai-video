import type { ImageTaskReference } from "@/lib/server/image-task-store";
import { isRemoteMediaUrl } from "@/lib/browser-media-url";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { writeReferenceImageDataUrl } from "@/lib/server/reference-asset-store";
import { createSignedReferenceAssetUrl, signReferenceAssetInputUrl } from "@/lib/server/reference-asset-access";
import { resolvePublicRequestOrigin } from "@/lib/server/public-request-origin";
import { fetchSafeOutbound } from "@/lib/server/safe-outbound-fetch";

import { INLINE_IMAGE_TIMEOUT_MS } from "./image-task-types";

export function referenceRequestUrl(reference: ImageTaskReference, origin = "") {
    return referenceRequestUrlCandidates(reference, origin)[0] || "";
}

export function jsonImageReferenceRequestUrl(reference: ImageTaskReference, origin = "") {
    const remoteUrl = referenceRequestUrlCandidates(reference, origin).find((value) => isExternalPublicMediaUrl(value));
    if (remoteUrl) return remoteUrl;
    return referenceRequestUrl(reference, origin);
}

export async function publicImageReferenceRequestUrl(reference: ImageTaskReference, origin: string, publicOrigin: string, context: { ownerUserId: string; taskId: string }) {
    const requestCandidates = referenceRequestUrlCandidates(reference, origin);
    const localCandidate = requestCandidates.find((value) => /\/api\/(?:reference-assets|generation-log-assets)\//.test(value));
    const providerCandidates = requestCandidates.filter((value) => isExternalPublicMediaUrl(value) && !/\/api\/(?:reference-assets|generation-log-assets)\//.test(value));
    for (const remoteUrl of providerCandidates) {
        if (await isReachableProviderImage(remoteUrl)) return remoteUrl;
    }

    if (localCandidate) {
        if (hasUsableProviderReadSignature(localCandidate)) {
            const providerUrl = imagePreviewUrl(localCandidate);
            if (await isReachableProviderImage(providerUrl)) return providerUrl;
            throw new Error("本地参考图公网地址不可访问，请检查 NEXT_PUBLIC_SITE_URL 后重试");
        }
        if (isExternalPublicOrigin(publicOrigin)) {
            const signedUrl = signReferenceAssetInputUrl(localCandidate, publicOrigin);
            if (signedUrl !== localCandidate) {
                const providerUrl = imagePreviewUrl(signedUrl);
                if (await isReachableProviderImage(providerUrl)) return providerUrl;
                throw new Error("本地参考图公网地址不可访问，请检查 NEXT_PUBLIC_SITE_URL 后重试");
            }
            throw new Error("站内参考素材签名不可用，请配置 VOZEB_PRO_ENCRYPTION_KEY");
        }
    }

    if (localCandidate) throw new Error("供应商参考图已失效，且本地副本没有可用公网地址；请配置 NEXT_PUBLIC_SITE_URL 后重试");
    if (providerCandidates.length) throw new Error("供应商参考图已失效且没有可用本地副本，请重新上传参考图");

    const dataUrl = (reference.dataUrl || "").trim();
    if (!/^data:image\//i.test(dataUrl)) throw new Error("\u53c2\u8003\u56fe\u9700\u8981\u516c\u7f51\u56fe\u7247 URL\uff0c\u8bf7\u91cd\u65b0\u4e0a\u4f20\u53c2\u8003\u56fe");
    if (!isExternalPublicOrigin(publicOrigin)) throw new Error("参考图需要公网图片 URL；本地开发 localhost 不能直接提交给上游，请部署后配置 NEXT_PUBLIC_SITE_URL");
    const asset = await writeReferenceImageDataUrl(dataUrl, { ownerUserId: context.ownerUserId, source: "image-task-reference", taskId: context.taskId });
    const signedUrl = createSignedReferenceAssetUrl(asset.token, publicOrigin);
    if (!signedUrl) throw new Error("站内参考素材签名不可用，请配置 VOZEB_PRO_ENCRYPTION_KEY");
    return signedUrl;
}

async function isReachableProviderImage(url: string) {
    const probe = async (init: RequestInit) => {
        const response = await fetchSafeOutbound(url, {
            ...init,
            cache: "no-store",
            signal: AbortSignal.timeout(INLINE_IMAGE_TIMEOUT_MS),
        });
        const contentType = response.headers.get("content-type")?.toLowerCase() || "";
        const reachable = response.ok && contentType.startsWith("image/");
        await response.body?.cancel().catch(() => undefined);
        return { reachable, status: response.status };
    };
    try {
        const head = await probe({ method: "HEAD", headers: { accept: "image/*" } });
        if (head.reachable) return true;
        if (head.status !== 405 && head.status !== 501) return false;
        return (await probe({ headers: { accept: "image/*", range: "bytes=0-0" } })).reachable;
    } catch {
        return false;
    }
}

export function referenceRequestUrlCandidates(reference: ImageTaskReference, origin = "") {
    return uniqueStrings([reference.remoteUrl, reference.url, reference.serverUrl, reference.dataUrl].map((value) => normalizeReferenceRequestUrl(value || "", origin)).filter(Boolean));
}

export function rawReferenceRequestUrlCandidates(reference: ImageTaskReference) {
    return uniqueStrings([reference.remoteUrl, reference.url, reference.serverUrl, reference.dataUrl].map((value) => (value || "").trim()).filter(Boolean));
}

export function uniqueStrings(values: string[]) {
    return Array.from(new Set(values));
}

export function normalizeReferenceRequestUrl(value: string, origin: string) {
    const url = value.trim();
    if (!url || isRemoteMediaUrl(url) || /^(data|blob):/i.test(url) || !origin) return url;
    try {
        const absolute = new URL(url, origin);
        const proxiedUrl = absolute.searchParams.get("url") || "";
        if ((absolute.pathname === "/api/media-proxy" || /^\/api\/ai\/system\/[^/]+\/_media$/.test(absolute.pathname)) && isRemoteMediaUrl(proxiedUrl)) return proxiedUrl;
        if (url.startsWith("/")) return absolute.toString();
    } catch {
        return url;
    }
    return url;
}

export function requestPublicOrigin(request: Request) {
    return resolvePublicRequestOrigin(request);
}

export function normalizePublicOrigin(value: string) {
    try {
        const url = new URL(value.trim().replace(/\/+$/, ""));
        if (url.protocol !== "http:" && url.protocol !== "https:") return "";
        return url.origin;
    } catch {
        return "";
    }
}

export function isExternalPublicOrigin(value: string) {
    if (!value) return false;
    try {
        return isExternalPublicHost(new URL(value).hostname);
    } catch {
        return false;
    }
}

export function isExternalPublicMediaUrl(value: string) {
    const url = value.trim();
    if (!/^https?:\/\//i.test(url)) return false;
    try {
        return isExternalPublicHost(new URL(url).hostname);
    } catch {
        return false;
    }
}

function hasUsableProviderReadSignature(value: string) {
    try {
        const url = new URL(value);
        return isExternalPublicMediaUrl(value) && url.searchParams.get("purpose") === "provider-read" && Number(url.searchParams.get("expires")) > Math.floor(Date.now() / 1000) && Boolean(url.searchParams.get("signature"));
    } catch {
        return false;
    }
}

export function isExternalPublicHost(hostname: string) {
    const host = hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
    const parts = host.split(".").map((part) => Number(part));
    if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
        const [a, b] = parts;
        return !(a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0);
    }
    return host.includes(".");
}
