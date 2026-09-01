export const REFERENCE_ASSET_SIGNATURE_PURPOSE = "provider-read";

export function isReferenceAssetUrl(value: string) {
    try {
        return isProtectedAssetPath(new URL(value, "https://vozeb.invalid").pathname);
    } catch {
        return false;
    }
}

export function hasProviderReadSignatureShape(value: string) {
    try {
        const url = new URL(value, "https://vozeb.invalid");
        const expires = url.searchParams.get("expires") || "";
        return isProtectedAssetPath(url.pathname) && url.searchParams.get("purpose") === REFERENCE_ASSET_SIGNATURE_PURPOSE && /^\d+$/.test(expires) && Number(expires) > 0 && Boolean(url.searchParams.get("signature"));
    } catch {
        return false;
    }
}

function isProtectedAssetPath(pathname: string) {
    return pathname.startsWith("/api/reference-assets/") || pathname.startsWith("/api/generation-log-assets/");
}
