import { fetchSafeOutbound } from "@/lib/server/safe-outbound-fetch";

const PROVIDER_REFERENCE_PROBE_TIMEOUT_MS = 30_000;

type ProviderReferenceMedia = { type: string; url: string; remoteUrl?: string; serverUrl?: string };

export async function resolveProviderReadableReferenceMedia<T extends ProviderReferenceMedia>(references: readonly T[]): Promise<T[]> {
    let imageIndex = 0;
    return Promise.all(
        references.map(async (reference) => {
            if (reference.type !== "image") return reference;
            imageIndex += 1;
            for (const url of uniqueUrls([reference.remoteUrl, reference.url, reference.serverUrl])) {
                if (/^assetId:\/\//i.test(url) || (await isReachableProviderImage(url))) return { ...reference, url } as T;
            }
            throw new Error(`参考素材第 ${imageIndex} 个图片公网不可读，无法提交给上游`);
        }),
    );
}

async function isReachableProviderImage(url: string) {
    const probe = async (init: RequestInit) => {
        const response = await fetchSafeOutbound(url, {
            ...init,
            cache: "no-store",
            signal: AbortSignal.timeout(PROVIDER_REFERENCE_PROBE_TIMEOUT_MS),
        });
        const readable = response.ok && response.headers.get("content-type")?.toLowerCase().startsWith("image/");
        await response.body?.cancel().catch(() => undefined);
        return { readable, status: response.status };
    };
    try {
        const head = await probe({ method: "HEAD", headers: { accept: "image/*" } });
        return head.readable || ((head.status === 405 || head.status === 501) && (await probe({ headers: { accept: "image/*", range: "bytes=0-0" } })).readable);
    } catch {
        return false;
    }
}

function uniqueUrls(values: Array<string | undefined>) {
    return Array.from(new Set(values.map((value) => value?.trim() || "").filter(Boolean)));
}
