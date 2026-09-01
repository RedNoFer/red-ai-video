import { writePersistentMediaDataUrl } from "@/lib/server/reference-asset-store";

type GeneratedImageResult = {
    serverUrl?: string;
    remoteUrl?: string;
    dataUrl?: string;
};

export async function persistDramaGeneratedImageReference(result: GeneratedImageResult, context: { ownerUserId: string; projectId: string; taskId: string; originalName: string }) {
    const serverUrl = [result.serverUrl, result.dataUrl].map(normalizeInternalMediaPath).find((value): value is string => Boolean(value));
    if (serverUrl) return { url: serverUrl, remoteUrl: result.remoteUrl };
    if (!result.dataUrl?.startsWith("data:image/")) return null;
    const stored = await writePersistentMediaDataUrl(result.dataUrl, "image", { ...context, source: "drama-asset-generation" });
    return { url: `/api/reference-assets/${stored.token.split("/").map(encodeURIComponent).join("/")}`, storageKey: stored.token, remoteUrl: result.remoteUrl };
}

function normalizeInternalMediaPath(value: string | undefined) {
    if (!value) return null;
    const pathname = value.startsWith("/")
        ? value.split(/[?#]/, 1)[0]
        : (() => {
              try {
                  const parsed = new URL(value);
                  return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.pathname : null;
              } catch {
                  return null;
              }
          })();
    return pathname && /^\/api\/(?:reference-assets|generation-log-assets)\//.test(pathname) ? pathname : null;
}
