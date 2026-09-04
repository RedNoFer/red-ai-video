import type { VideoGenerationReference } from "@/lib/video-reference-contract";

export type VideoProviderRequestSnapshot = {
    path: string;
    prompt: string;
    promptLength: number;
    references: Array<Pick<VideoGenerationReference, "type" | "role" | "keyframeIndex" | "url" | "remoteUrl" | "serverUrl" | "durationMs">>;
    body?: Record<string, unknown>;
    bodyKind?: "json" | "multipart";
};

export function createVideoProviderRequestSnapshot(path: string, prompt: string, references: readonly VideoGenerationReference[], body: BodyInit | undefined, multipart: boolean): VideoProviderRequestSnapshot {
    const parsed = !multipart && typeof body === "string" ? parseJsonObject(body) : undefined;
    return {
        path,
        prompt,
        promptLength: prompt.length,
        references: references.map(({ type, role, keyframeIndex, url, remoteUrl, serverUrl, durationMs }) => ({ type, ...(role ? { role } : {}), ...(keyframeIndex ? { keyframeIndex } : {}), url, ...(remoteUrl ? { remoteUrl } : {}), ...(serverUrl ? { serverUrl } : {}), ...(durationMs ? { durationMs } : {}) })),
        ...(parsed ? { body: parsed, bodyKind: "json" as const } : { bodyKind: "multipart" as const }),
    };
}

function parseJsonObject(value: string) {
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
    } catch {
        return undefined;
    }
}
