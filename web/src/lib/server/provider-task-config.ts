import type { SystemChannelAdvancedConfig } from "@/lib/auth/store";
import type { LogicalModelCapability } from "@/lib/auth/store";
import { channelProtocolDefinition, protocolModelConfig, resolveBumingSeedanceVideoModelContract } from "@/lib/channel-protocol-registry";
import { hasProviderReadSignatureShape, isReferenceAssetUrl } from "@/lib/reference-asset-url";
import type { VideoGenerationReference, VideoReferenceRole } from "@/lib/video-reference-contract";

type TemplateValues = Record<string, unknown>;

const MAX_PROVIDER_TEMPLATE_DEPTH = 128;

export function videoPollingPolicy(globalAiOpc: boolean, protocol?: string) {
    if (protocol === "newapi-video") return { attempts: 180, intervalMs: 5_000 };
    return globalAiOpc ? { attempts: 40, intervalMs: 30_000 } : { attempts: 180, intervalMs: 2_500 };
}

export function providerCreatePaths(config: SystemChannelAdvancedConfig | undefined, fallbacks: string[]) {
    return uniquePaths(config?.createPath ? [config.createPath] : fallbacks);
}

export function resolvedProviderCreatePaths(config: SystemChannelAdvancedConfig | undefined, capability: LogicalModelCapability, fallbacks: string[]) {
    const configured = config?.createPath?.trim();
    if (configured) return providerCreatePaths(config, fallbacks);
    const protocol = config?.protocol || "auto";
    const definition = channelProtocolDefinition(protocol);
    const presetPath = definition.strict ? protocolModelConfig(protocol, capability)?.createPath : undefined;
    return uniquePaths(presetPath ? [presetPath] : fallbacks);
}

export function providerQueryPaths(config: SystemChannelAdvancedConfig | undefined, taskId: string, fallbacks: string[]) {
    const configured = config?.queryPath?.trim();
    return uniquePaths(configured ? [providerTaskPath(configured, taskId)] : fallbacks);
}

export function buildProviderRequest(template: string | undefined, defaults: Record<string, unknown>, values: TemplateValues) {
    if (!template?.trim()) return defaults;
    return renderProviderRequest(template, values);
}

/**
 * Provider payloads cross a JSON boundary. Keep this serialization in one
 * place so a malformed template value fails before fetch receives it.
 */
export function serializeProviderRequest(value: unknown) {
    try {
        return JSON.stringify(value) ?? "null";
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/circular|call stack|nested/i.test(message)) throw new Error("生成请求参数包含循环引用或嵌套层级过深");
        throw error;
    }
}

export function buildVideoProviderRequest(template: string | undefined, defaults: Record<string, unknown>, values: TemplateValues) {
    if (!template?.trim()) return defaults;
    return renderProviderRequest(template, values, alignVideoProviderFields);
}

export function assertReferenceUrls(config: SystemChannelAdvancedConfig | undefined, references: Array<{ url?: string }>, publicUrlRequired = false) {
    if (!references.length) return;
    if (!requiresProviderReadableReferenceUrls(config, publicUrlRequired)) return;
    if (references.some((reference) => !isExternallyReachableReferenceUrl(reference.url || "") || isUnsignedReferenceAssetUrl(reference.url || ""))) {
        throw new Error("当前渠道无法读取站内参考素材，请联系管理员检查站点部署地址");
    }
}

export function requiresProviderReadableReferenceUrls(config: SystemChannelAdvancedConfig | undefined, publicUrlRequired = false) {
    if (publicUrlRequired) return true;
    return /公网|public|next_public_site_url|must.*\burl\b|\burl\b.*only|必须.*\burl\b|仅.*\burl\b|只.*\burl\b/i.test(config?.referenceRule || "");
}

function isUnsignedReferenceAssetUrl(value: string) {
    return isReferenceAssetUrl(value) && !hasProviderReadSignatureShape(value);
}

function renderProviderRequest(template: string, values: TemplateValues, align?: (payload: Record<string, unknown>, values: TemplateValues) => Record<string, unknown>) {
    let parsed: unknown;
    try {
        parsed = JSON.parse(template);
    } catch {
        throw new Error("高级请求模板必须是有效 JSON");
    }
    const rendered = renderTemplateValue(parsed, values);
    if (!rendered || typeof rendered !== "object" || Array.isArray(rendered)) throw new Error("高级请求模板必须是 JSON 对象");
    const normalized = align ? align(rendered as Record<string, unknown>, values) : rendered;
    return pruneEmptyReferenceFields(normalized) as Record<string, unknown>;
}

export function readProviderString(value: unknown, configuredPath: string | undefined, fallbackKeys: string[]) {
    for (const path of (configuredPath || "")
        .split(/\s+\/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)) {
        const configured = readFieldPath(value, path);
        if (typeof configured === "string" && configured.trim()) return configured.trim();
        if (typeof configured === "number") return String(configured);
    }
    return findString(value, new Set(fallbackKeys));
}

export function readProviderValue(value: unknown, configuredPath: string | undefined, fallbackKeys: string[]) {
    for (const path of (configuredPath || "")
        .split(/\s+\/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)) {
        const configured = readFieldPath(value, path);
        if (configured !== undefined && configured !== null) return configured;
    }
    return findValue(value, new Set(fallbackKeys));
}

export function readProviderError(value: unknown) {
    return findString(value, new Set(["error_message", "errorMessage", "error", "msg", "message", "detail"]));
}

export function isProviderBusinessError(value: unknown) {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    if (record.ok === false || record.success === false) return true;

    const message = readProviderError(value);
    if (message && /失败|错误|无效|未授权|验证|禁止|过期|不足|不存在|拒绝|异常|error|fail|invalid|unauthorized|forbidden|expired|insufficient|not found|denied|unsupported/i.test(message)) return true;

    const code = record.code;
    if (code === undefined || code === null || code === "" || !message) return false;
    const normalized = String(code).trim().toLowerCase();
    return !["0", "200", "201", "202", "ok", "success"].includes(normalized);
}

export function assertReferenceCapabilities(config: SystemChannelAdvancedConfig | undefined, references: Array<{ type?: string }>) {
    if (!config || !references.length) return;
    const unsupported = references.find((reference) => (reference.type === "image" ? !config.supportsReferenceImage : reference.type === "video" ? !config.supportsReferenceVideo : reference.type === "audio" ? !config.supportsReferenceAudio : false));
    if (unsupported) throw new Error(`当前渠道未启用${unsupported.type === "image" ? "参考图" : unsupported.type === "video" ? "参考视频" : "参考音频"}能力`);
}

export function assertVideoReferenceRoles(config: SystemChannelAdvancedConfig | undefined, references: readonly VideoGenerationReference[], declaredRoles?: readonly VideoReferenceRole[], model?: string) {
    const requestedRoles = Array.from(new Set(references.map((reference) => reference.role).filter((role): role is VideoReferenceRole => Boolean(role) && role !== "reference")));
    const protocol = config?.protocol || "auto";
    if (protocol === "buming-seedance") {
        const contract = resolveBumingSeedanceVideoModelContract(model || "");
        const keyframes = references.filter((reference) => reference.role === "keyframe");
        const regularReferences = references.filter((reference) => reference.role === "reference");
        const firstFrame = references.some((reference) => reference.role === "first_frame");
        const lastFrame = references.some((reference) => reference.role === "last_frame");
        const requestedMode = keyframes.length ? "all_frames" : firstFrame ? (lastFrame ? "first_last" : "first_frame") : regularReferences.length ? "reference" : undefined;
        if (requestedMode && !contract.videoReferenceModes.includes(requestedMode)) {
            if (requestedMode === "all_frames") throw new Error("当前不鸣视频模型不支持全能帧连续参考");
            throw new Error(`当前不鸣视频模型不支持${requestedMode === "reference" ? "普通参考素材" : requestedMode === "first_last" ? "首尾帧" : "首帧"}`);
        }
        if (contract.maxReferenceImages && references.filter((reference) => reference.type === "image").length > contract.maxReferenceImages) throw new Error(`当前不鸣视频模型最多支持 ${contract.maxReferenceImages} 张参考图`);
        return;
    }
    if (!requestedRoles.length) return;
    const supported = new Set<VideoReferenceRole>(
        declaredRoles ||
            (protocol === "seedance" || protocol === "volcengine-video" || protocol === "seedance-special"
                ? ["reference", "first_frame", "last_frame"]
                : protocol === "yumeng"
                  ? templateVideoReferenceRoles(config?.requestTemplate)
                  : protocol === "newapi-video"
                    ? ["reference", "keyframe"]
                    : protocol === "openai" || protocol === "newapi" || protocol === "sub2api" || protocol === "openai-audio-dialogue"
                      ? ["reference", "first_frame"]
                      : protocol === "custom" || protocol === "compatible" || protocol === "auto"
                        ? templateVideoReferenceRoles(config?.requestTemplate)
                        : ["reference"]),
    );
    const unsupported = requestedRoles.find((role) => !supported.has(role));
    if (unsupported) throw new Error(unsupported === "keyframe" ? "当前视频模型不支持全能帧连续参考" : unsupported === "last_frame" ? "当前视频模型不支持尾帧输入" : "当前视频模型不支持显式首帧输入");
}

export function templateVideoReferenceRoles(template: string | undefined): VideoReferenceRole[] {
    const value = template || "";
    const structured = /\{\{\s*references\s*\}\}/i.test(value);
    return [
        "reference" as const,
        ...(structured || /\{\{\s*(?:first_frame|first_frame_url)\s*\}\}/i.test(value) ? (["first_frame"] as const) : []),
        ...(structured || /\{\{\s*(?:last_frame|last_frame_url)\s*\}\}/i.test(value) ? (["last_frame"] as const) : []),
        ...(structured ? (["keyframe"] as const) : []),
    ];
}

export function providerTaskPath(path: string, taskId: string) {
    const encoded = encodeURIComponent(taskId);
    const rendered = path.replace(/\{\{\s*(?:taskId|task_id|id)\s*\}\}|\{(?:taskId|task_id|id)\}|:(?:taskId|task_id|id)\b/gi, encoded);
    if (rendered !== path) return rendered;
    const separator = path.includes("?") ? "&" : path.endsWith("/") ? "" : "/";
    return `${path}${separator}${encoded}`;
}

function renderTemplateValue(value: unknown, values: TemplateValues, seen = new Set<object>(), depth = 0): unknown {
    assertProviderTemplateDepth(depth);
    if (Array.isArray(value)) {
        if (seen.has(value)) throw new Error("高级请求模板包含循环引用");
        seen.add(value);
        const result = value.map((item) => renderTemplateValue(item, values, seen, depth + 1));
        seen.delete(value);
        return result;
    }
    if (value && typeof value === "object") {
        if (seen.has(value)) throw new Error("高级请求模板包含循环引用");
        seen.add(value);
        const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderTemplateValue(item, values, seen, depth + 1)]));
        seen.delete(value);
        return result;
    }
    if (typeof value !== "string") return value;
    const exact = value.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    if (exact) return values[exact[1]] === undefined ? value : cloneProviderValue(values[exact[1]]);
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => String(values[key] ?? match));
}

function cloneProviderValue(value: unknown, seen = new Set<object>(), depth = 0): unknown {
    assertProviderTemplateDepth(depth);
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) throw new Error("高级请求模板动态值包含循环引用");
    seen.add(value);
    const cloned = Array.isArray(value) ? value.map((item) => cloneProviderValue(item, seen, depth + 1)) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneProviderValue(item, seen, depth + 1)]));
    seen.delete(value);
    return cloned;
}

function alignVideoProviderFields(payload: Record<string, unknown>, values: TemplateValues) {
    const next = { ...payload };
    for (const [key, current] of Object.entries(next)) {
        const normalizedKey = normalizeFieldKey(key);
        const dynamicValueKey = VIDEO_DYNAMIC_VALUE_KEYS[normalizedKey];
        if (dynamicValueKey && values[dynamicValueKey] !== undefined) {
            const value = values[dynamicValueKey];
            next[key] = normalizedKey === "seconds" && typeof current === "string" ? String(value) : cloneProviderValue(value);
            continue;
        }
        const referenceValueKey = VIDEO_REFERENCE_VALUE_KEYS[normalizedKey];
        if (referenceValueKey && shouldAlignReferenceTemplateValue(current)) next[key] = cloneProviderValue(values[referenceValueKey]);
    }
    return next;
}

function shouldAlignReferenceTemplateValue(value: unknown): boolean {
    if (typeof value === "string") return !value.trim() || value.includes("{{") || /^https?:\/\/\.{3}(?:\/|$)/i.test(value.trim());
    if (Array.isArray(value)) return !value.length || value.some(shouldAlignReferenceTemplateValue);
    if (!value || typeof value !== "object") return false;
    return Object.values(value).some(shouldAlignReferenceTemplateValue);
}

function isExternallyReachableReferenceUrl(value: string) {
    if (/^assetId:\/\/[a-zA-Z0-9._:-]+$/i.test(value)) return true;
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
        if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
        if (host.includes(":")) return host !== "::1" && host !== "::" && !/^(?:fc|fd|fe8|fe9|fea|feb)/i.test(host);
        const match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (!match) return true;
        const [a, b] = match.slice(1).map(Number);
        return a !== 0 && a !== 10 && a !== 127 && a < 224 && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && b === 168) && !(a === 198 && (b === 18 || b === 19));
    } catch {
        return false;
    }
}

function pruneEmptyReferenceFields(value: unknown, seen = new Set<object>(), depth = 0): unknown {
    assertProviderTemplateDepth(depth);
    if (Array.isArray(value)) {
        if (seen.has(value)) throw new Error("高级请求模板包含循环引用");
        seen.add(value);
        const result = value.map((item) => pruneEmptyReferenceFields(item, seen, depth + 1));
        seen.delete(value);
        return result;
    }
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) throw new Error("高级请求模板包含循环引用");
    seen.add(value);
    const entries = Object.entries(value).flatMap(([key, item]) => {
        const next = REFERENCE_FIELD_KEYS.has(normalizeFieldKey(key)) ? normalizeReferenceValue(item, seen, depth + 1) : pruneEmptyReferenceFields(item, seen, depth + 1);
        return next === EMPTY_REFERENCE ? [] : [[key, next] as const];
    });
    seen.delete(value);
    return Object.fromEntries(entries);
}

function normalizeReferenceValue(value: unknown, seen = new Set<object>(), depth = 0): unknown {
    assertProviderTemplateDepth(depth);
    if (value === null || value === undefined) return EMPTY_REFERENCE;
    if (typeof value === "string") {
        const text = value.trim();
        return !text || /^\{\{[^{}]+\}\}$/.test(text) || /^https?:\/\/\.{3}(?:\/|$)/i.test(text) ? EMPTY_REFERENCE : value;
    }
    if (Array.isArray(value)) {
        if (seen.has(value)) throw new Error("高级请求模板包含循环引用");
        seen.add(value);
        const items = value.map((item) => normalizeReferenceValue(item, seen, depth + 1)).filter((item) => item !== EMPTY_REFERENCE);
        seen.delete(value);
        return items.length ? items : EMPTY_REFERENCE;
    }
    if (typeof value !== "object") return value;
    if (seen.has(value)) throw new Error("高级请求模板包含循环引用");
    seen.add(value);
    const source = Object.entries(value);
    const entries = source.flatMap(([key, item]) => {
        const normalizedKey = normalizeFieldKey(key);
        const next = REFERENCE_FIELD_KEYS.has(normalizedKey) || REFERENCE_VALUE_KEYS.has(normalizedKey) ? normalizeReferenceValue(item, seen, depth + 1) : pruneEmptyReferenceFields(item, seen, depth + 1);
        return next === EMPTY_REFERENCE ? [] : [[key, next] as const];
    });
    seen.delete(value);
    if (!entries.length || entries.every(([key]) => REFERENCE_METADATA_KEYS.has(normalizeFieldKey(key)))) return EMPTY_REFERENCE;
    const hadReferenceValue = source.some(([key]) => REFERENCE_FIELD_KEYS.has(normalizeFieldKey(key)) || REFERENCE_VALUE_KEYS.has(normalizeFieldKey(key)));
    const hasReferenceValue = entries.some(([key]) => REFERENCE_FIELD_KEYS.has(normalizeFieldKey(key)) || REFERENCE_VALUE_KEYS.has(normalizeFieldKey(key)));
    return hadReferenceValue && !hasReferenceValue ? EMPTY_REFERENCE : Object.fromEntries(entries);
}

function assertProviderTemplateDepth(depth: number) {
    if (depth > MAX_PROVIDER_TEMPLATE_DEPTH) throw new Error("高级请求模板嵌套层级过深");
}

function normalizeFieldKey(key: string) {
    return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function readFieldPath(value: unknown, path: string) {
    const parts = path
        .replace(/^\$\.?/, "")
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .map((item) => item.trim())
        .filter(Boolean);
    let current = value;
    for (const part of parts) {
        if (!current || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

function findString(value: unknown, keys: Set<string>): string {
    const queue: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
    const visited = new Set<object>();
    for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        if (current.depth > 6 || !current.value || typeof current.value !== "object") continue;
        if (visited.has(current.value)) continue;
        visited.add(current.value);
        const entries = Object.entries(current.value);
        for (const [key, item] of entries) {
            if (keys.has(key) && (typeof item === "string" || typeof item === "number") && String(item).trim()) return String(item).trim();
        }
        entries.forEach(([, item]) => queue.push({ value: item, depth: current.depth + 1 }));
    }
    return "";
}

function findValue(value: unknown, keys: Set<string>): unknown {
    const queue: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
    const visited = new Set<object>();
    for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        if (current.depth > 8 || !current.value || typeof current.value !== "object") continue;
        if (visited.has(current.value)) continue;
        visited.add(current.value);
        const entries = Object.entries(current.value);
        for (const [key, item] of entries) {
            if (keys.has(key) && item !== undefined && item !== null) return item;
        }
        entries.forEach(([, item]) => queue.push({ value: item, depth: current.depth + 1 }));
    }
    return undefined;
}

function uniquePaths(paths: string[]) {
    return Array.from(
        new Set(
            paths
                .map((path) => path.trim())
                .filter(Boolean)
                .map((path) => (path.startsWith("/") ? path : `/${path}`)),
        ),
    );
}

const EMPTY_REFERENCE = Symbol("empty-reference");
const REFERENCE_FIELD_KEYS = new Set([
    "image",
    "images",
    "imageurl",
    "imageurls",
    "inputimage",
    "inputimages",
    "inputreference",
    "inputreferences",
    "refassets",
    "reference",
    "references",
    "referenceimage",
    "referenceimages",
    "firstframeurl",
    "firstframeimage",
    "firstframe",
    "firstimage",
    "lastframeurl",
    "lastframeimage",
    "lastframe",
    "lastimage",
    "video",
    "videos",
    "inputvideo",
    "inputvideos",
    "referencevideo",
    "referencevideos",
    "audio",
    "audios",
    "inputaudio",
    "inputaudios",
    "referenceaudio",
    "referenceaudios",
]);
const REFERENCE_VALUE_KEYS = new Set(["url", "uri", "src", "data", "base64", "b64json", "id", "assetid", "imageurl", "videourl", "audiourl"]);
const REFERENCE_METADATA_KEYS = new Set(["type", "kind", "role", "mimetype", "name"]);
const VIDEO_DYNAMIC_VALUE_KEYS: Record<string, string> = {
    model: "model",
    prompt: "prompt",
    duration: "duration",
    seconds: "seconds",
    ratio: "ratio",
    aspectratio: "aspect_ratio",
    resolution: "resolution",
    quality: "quality",
    size: "size",
    width: "width",
    height: "height",
};
const VIDEO_REFERENCE_VALUE_KEYS: Record<string, string> = {
    image: "image",
    imageurl: "image",
    inputimage: "image",
    referenceimage: "image",
    firstframeurl: "first_frame",
    firstframeimage: "first_frame",
    firstimage: "first_frame",
    lastframeurl: "last_frame",
    lastframeimage: "last_frame",
    lastimage: "last_frame",
    images: "images",
    imageurls: "images",
    inputimages: "images",
    inputreference: "images",
    inputreferences: "images",
    referenceimages: "images",
    video: "video",
    referencevideo: "video",
    videos: "videos",
    referencevideos: "videos",
    audio: "audio",
    referenceaudio: "audio",
    audios: "audios",
    referenceaudios: "audios",
    refassets: "references",
    reference: "references",
    references: "references",
};
