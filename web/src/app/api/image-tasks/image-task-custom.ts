import type { ImageTask } from "@/lib/server/image-task-store";
import { getAuthSettings } from "@/lib/auth/store";
import { GenerationSubmissionSafeFailure, GenerationSubmissionUncertainError } from "@/lib/server/generation-submission-error";
import { buildProviderRequest, isProviderBusinessError, readProviderError, readProviderString, serializeProviderRequest } from "@/lib/server/provider-task-config";
import { fetchSafeOutbound } from "@/lib/server/safe-outbound-fetch";
import { buildYumengImageRequest, resolveYumengImageResolution } from "@/lib/yumeng-model-center";

import { isExternalPublicMediaUrl, isExternalPublicOrigin, publicImageReferenceRequestUrl, referenceRequestUrlCandidates } from "./image-task-reference-urls";
import { IMAGE_TASK_POLL_INTERVAL_MS, type ImageApiResponse, type ImageTaskResult } from "./image-task-types";
import {
    findImageResult,
    imagePointsIdempotencyKey,
    imageSubmissionFetch,
    imageSubmissionResponseError,
    imageReferenceToDataUrl,
    dataUrlToFile,
    imageTaskPollAttempts,
    imageTaskPollUrls,
    isPendingImageStatus,
    parseChargedImageResponse,
    readFetchError,
    readImageTaskId,
    parseImageSubmissionJson,
    imageRequestAspectRatio,
    resolveRequestSize,
    taskFetch,
    taskHeaders,
    taskUrl,
    withSystemPrompt,
    ImageUpstreamTerminalError,
} from "./image-task-support";

export async function runCustomImageTask(task: ImageTask, origin: string, publicOrigin: string, cookie: string, singleStep = false) {
    const config = task.config;
    const advanced = config.advancedConfig;
    if (!advanced?.createPath || !advanced.requestTemplate || !advanced.resultField) throw new GenerationSubmissionSafeFailure("自定义图片协议缺少创建路径、请求模板或结果字段");
    const size = resolveDeclarativeImageSize(config);
    const [width, height] = /^\d+x\d+$/.test(size) ? size.split("x").map(Number) : [undefined, undefined];
    const context = { ownerUserId: task.userId, taskId: task.id };
    const inlineReferences = advanced.protocol === "stable-diffusion" || /\bbase64\b|data:image|\binline\b/i.test(advanced.referenceRule || "");
    const images = (
        await Promise.all(
            task.references.map((reference, index) =>
                inlineReferences
                    ? imageReferenceToDataUrl(reference, reference.name || `reference-${index + 1}.png`, origin, cookie)
                    : advanced.protocol === "buming-image"
                      ? bumingImageReferenceUrl(config, reference, origin, publicOrigin, cookie, context, index)
                      : publicImageReferenceRequestUrl(reference, origin, publicOrigin, context),
            ),
        )
    ).filter(Boolean);
    const values = {
        model: config.model,
        prompt: withSystemPrompt(config, task.prompt),
        size,
        aspect_ratio: imageRequestAspectRatio(config.size || "auto"),
        resolution: advanced.protocol === "yumeng" ? resolveYumengImageResolution(config.model, config.quality) : advanced.protocol === "buming-image" ? resolveBumingImageResolution(config.quality) : config.quality || "auto",
        width,
        height,
        quality: config.quality || "auto",
        mode: images.length ? "image-edit" : "text-to-image",
        output_format: "png",
        n: config.count || 1,
        image: images[0] || "",
        images,
    };
    const payload =
        advanced.protocol === "yumeng"
            ? buildYumengImageRequest({ model: config.model, prompt: values.prompt, images, aspectRatio: values.aspect_ratio, resolution: values.resolution, size })
            : buildProviderRequest(advanced.requestTemplate, values, values);
    const url = taskUrl(config, task.kind === "edit" ? advanced.editPath || advanced.createPath : advanced.createPath, origin);
    const headers = taskHeaders(config, cookie, imagePointsIdempotencyKey(task));
    headers.set("content-type", "application/json");
    const response = await imageSubmissionFetch(config, url, { method: "POST", headers, body: serializeProviderRequest(payload), cache: "no-store" });
    if (!response.ok) throw imageSubmissionResponseError(response.status, await readFetchError(response, "自定义图片接口调用失败"));
    const data = await parseImageSubmissionJson<ImageApiResponse>(response);
    return parseChargedImageResponse(task, response, async () => {
        if (isProviderBusinessError(data)) throw new GenerationSubmissionSafeFailure(readProviderError(data) || "自定义图片接口返回失败");
        const baseUrl = response.headers.get("x-vozeb-pro-upstream-url") || url;
        const direct = configuredImageResult(data, baseUrl, task);
        if (direct) return direct;
        const taskId = readImageTaskId(data);
        if (!taskId || !advanced.queryPath) throw new GenerationSubmissionUncertainError("自定义图片接口没有返回图片或任务 ID，创建结果待确认");
        if (singleStep) return { dataUrl: "", pending: { id: taskId, mediaBaseUrl: baseUrl, pollBaseUrl: baseUrl } };
        return pollCustomImageTask(task, taskId, baseUrl, cookie);
    });
}

export function resolveDeclarativeImageSize(config: Pick<ImageTask["config"], "quality" | "size" | "advancedConfig">) {
    const size = resolveRequestSize(config.quality, config.size || "auto") || config.size || "";
    return !size || size.toLowerCase() === "auto" ? (config.advancedConfig?.protocol === "stable-diffusion" ? "1024x1024" : "") : size;
}

function resolveBumingImageResolution(quality: ImageTask["config"]["quality"]) {
    if (quality === "low") return "1K";
    if (quality === "high") return "4K";
    return "2K";
}

async function bumingImageReferenceUrl(config: ImageTask["config"], reference: ImageTask["references"][number], origin: string, publicOrigin: string, cookie: string, context: { ownerUserId: string; taskId: string }, index: number) {
    if (isExternalPublicOrigin(publicOrigin)) return publicImageReferenceRequestUrl(reference, origin, publicOrigin, context);
    const external = referenceRequestUrlCandidates(reference, origin).find(isExternalPublicMediaUrl);
    if (external) return external;

    const dataUrl = await imageReferenceToDataUrl(reference, reference.name || `reference-${index + 1}.png`, origin, cookie);
    const file = dataUrlToFile(dataUrl, reference.name || `reference-${index + 1}.png`, reference.type);
    const channel = config.apiKey === "system" && config.channelId ? (await getAuthSettings()).systemChannels.find((item) => item.id === config.channelId) : undefined;
    const apiKey = config.apiKey !== "system" ? config.apiKey : channel?.apiKey || "";
    const baseUrl = channel?.baseUrl || config.baseUrl;
    if (!apiKey || !baseUrl) throw new GenerationSubmissionSafeFailure("图片渠道缺少可用的上传凭证，请检查渠道配置");
    const uploadUrl = `${bumingApiRoot(baseUrl)}/v1/files`;
    const form = new FormData();
    form.set("file", file);
    const response = await fetchSafeOutbound(uploadUrl, { method: "POST", headers: { authorization: `Bearer ${apiKey}` }, body: form, cache: "no-store" });
    if (!response.ok) throw new GenerationSubmissionSafeFailure(`参考图上传失败，状态码 ${response.status}`);
    const payload = (await response.json().catch(() => null)) as unknown;
    const uploadedUrl = findPublicUrl(payload);
    if (!uploadedUrl) throw new GenerationSubmissionSafeFailure("供应商没有返回可访问的参考图 URL");
    return uploadedUrl;
}

function bumingApiRoot(value: string) {
    return value.trim().replace(/\/+$/, "").replace(/\/api\/v1$/i, "").replace(/\/v1$/i, "");
}

function findPublicUrl(value: unknown): string {
    const queue: unknown[] = [value];
    const visited = new Set<object>();
    for (let index = 0; index < queue.length && index < 128; index += 1) {
        const current = queue[index];
        if (typeof current === "string") {
            if (isExternalPublicMediaUrl(current)) return current;
            continue;
        }
        if (!current || typeof current !== "object") continue;
        if (visited.has(current)) continue;
        visited.add(current);
        const entries = Object.entries(current);
        entries.sort(([left], [right]) => Number(/url|uri|src/i.test(right)) - Number(/url|uri|src/i.test(left)));
        for (const [, nested] of entries) queue.push(nested);
    }
    return "";
}

export async function pollCustomImageTask(task: ImageTask, taskId: string, requestUrl: string, cookie: string, singleStep = false) {
    const config = task.config;
    let lastError = "";
    for (let attempt = 0; attempt < (singleStep ? 1 : imageTaskPollAttempts(config)); attempt += 1) {
        for (const url of imageTaskPollUrls(config, requestUrl, taskId)) {
            const response = await taskFetch(config, url, { headers: taskHeaders(config, cookie), cache: "no-store" });
            if (!response.ok) {
                lastError = await readFetchError(response, "自定义图片任务查询失败");
                continue;
            }
            const data = (await response.json().catch(() => null)) as ImageApiResponse | null;
            if (!data || isProviderBusinessError(data)) throw new ImageUpstreamTerminalError(readProviderError(data) || "自定义图片任务查询失败");
            const result = configuredImageResult(data, response.headers.get("x-vozeb-pro-upstream-url") || url, task);
            if (result) return result;
            const status = readProviderString(data, config.advancedConfig?.statusField, STATUS_KEYS).toLowerCase();
            if (!isPendingImageStatus(status)) throw new ImageUpstreamTerminalError(readProviderError(data) || "自定义图片任务完成但没有返回图片");
            lastError = "";
            break;
        }
        if (lastError) throw new Error(lastError);
        if (!singleStep) await new Promise((resolve) => setTimeout(resolve, IMAGE_TASK_POLL_INTERVAL_MS));
    }
    if (singleStep) return { dataUrl: "", pending: { id: taskId, mediaBaseUrl: requestUrl, pollBaseUrl: requestUrl } };
    throw new Error("自定义图片任务生成超时");
}

function configuredImageResult(data: ImageApiResponse, baseUrl: string, task: ImageTask): ImageTaskResult | null {
    const value = readProviderString(data, task.config.advancedConfig?.resultField, []);
    return value ? findImageResult(value, baseUrl, task.config) : null;
}

const STATUS_KEYS = ["status", "state", "task_status", "taskStatus"];
