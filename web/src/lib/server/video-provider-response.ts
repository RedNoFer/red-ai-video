import { readProviderError, readProviderString } from "@/lib/server/provider-task-config";

export const VIDEO_PROVIDER_ID_KEYS = ["task_id", "taskId", "id", "job_id", "jobId", "request_id", "requestId", "uuid", "task_uuid", "taskUuid", "generation_id", "generationId"];
export const VIDEO_PROVIDER_STATUS_KEYS = ["status", "state", "task_status", "taskStatus"];
export const VIDEO_PROVIDER_MEDIA_KEYS = ["video_url", "videoUrl", "media_url", "mediaUrl", "content_url", "contentUrl", "output_url", "outputUrl", "result_url", "resultUrl", "url", "uri"];
export const VIDEO_PROVIDER_SUCCESS = new Set(["completed", "complete", "succeeded", "success", "done", "finished"]);
export const VIDEO_PROVIDER_FAILED = new Set(["failed", "failure", "error", "cancelled", "canceled", "expired"]);

export function parseVideoProviderJson(value: string) {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        throw new Error("视频接口返回了无效 JSON");
    }
}

export function readVideoProviderHttpError(value: string, status: number) {
    try {
        return readVideoProviderError(JSON.parse(value)) || `视频接口请求失败（${status}）`;
    } catch {
        return value.slice(0, 300) || `视频接口请求失败（${status}）`;
    }
}

export function readVideoProviderError(value: unknown) {
    const message = readProviderError(value);
    const code = readProviderErrorCode(value);
    if (code && message) return `${message}（${code}）`;
    return message || (code ? `视频生成失败（${code}）` : "");
}

export function readVideoProviderId(value: unknown) {
    return readProviderString(value, undefined, VIDEO_PROVIDER_ID_KEYS);
}

export function readVideoProviderStatus(value: unknown, configuredPath?: string) {
    const status = readProviderString(value, configuredPath, VIDEO_PROVIDER_STATUS_KEYS).toLowerCase();
    if (status) return status;
    if (value && typeof value === "object" && (value as Record<string, unknown>).is_final === true) return "completed";
    return "";
}

export function readVideoProviderUrl(value: unknown, configuredPath?: string) {
    return readProviderString(value, configuredPath, VIDEO_PROVIDER_MEDIA_KEYS);
}

function readProviderErrorCode(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    const record = value as Record<string, unknown>;
    const nested = record.error && typeof record.error === "object" && !Array.isArray(record.error) ? (record.error as Record<string, unknown>) : undefined;
    const code = nested?.code ?? record.error_code ?? record.errorCode;
    return typeof code === "string" || typeof code === "number" ? String(code).trim().slice(0, 120) : "";
}

/** Some gateways return an HTTP URL whose path is an encoded provider error instead of video media. */
export function videoProviderResultUrlError(value: string | undefined) {
    const url = value?.trim() || "";
    if (!url) return "";
    let detail = url;
    try {
        detail = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, "");
    } catch {
        try {
            detail = decodeURIComponent(url);
        } catch {
            // Keep the raw provider value for the error pattern check below.
        }
    }
    return /(?:参考素材|reference\s*(?:image|asset)|素材).{0,120}(?:下载失败|download\s*failed|fetch\s*failed)|(?:HTTP\s*4\d{2}|资源不存在|resource\s+not\s+found|已过期|timed?\s*out|timeout)/iu.test(detail) ? detail.slice(0, 300) : "";
}

export function videoProviderMediaUrl(baseUrl: string, url: string) {
    const base = baseUrl.replace(/\/+$/, "");
    if (/^https?:\/\//i.test(base)) return /^https?:\/\//i.test(url) ? url : `${base}/${url.replace(/^\/+/, "")}`;
    return /^https?:\/\//i.test(url) ? `${base}/_media?url=${encodeURIComponent(url)}` : `${base}/${url.replace(/^\/+/, "")}`;
}
