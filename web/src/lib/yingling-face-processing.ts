import { normalizeModelId } from "@/lib/model-capability";

export const YINGLING_FACE_PROCESSING_METHODS = ["grid", "feature_split"] as const;
export type YinglingFaceProcessingMethod = (typeof YINGLING_FACE_PROCESSING_METHODS)[number];

/** 影灵视频接口的过脸参数只对 seedance-2.0 系列生效，不包含 2.5 及其他模型。 */
const YINGLING_FACE_PROCESSING_MODEL_PATTERN = /seedance[-_.]?2\.?0(?:$|[-_.])/;

export function isYinglingFaceProcessingModel(model: string) {
    return YINGLING_FACE_PROCESSING_MODEL_PATTERN.test(normalizeModelId(model));
}

export function normalizeYinglingFaceProcessingMethod(value: unknown): YinglingFaceProcessingMethod {
    return value === "feature_split" ? "feature_split" : "grid";
}

/** 有参考图的 seedance-2.0 请求才追加 face_processing；渠道开关默认开启，显式关闭后不再追加。 */
export function withYinglingFaceProcessing(payload: Record<string, unknown> | undefined, input: { protocol?: string; model: string; enabled?: boolean; method?: unknown }): Record<string, unknown> | undefined {
    if (!payload || input.protocol !== "yinglingapi" || input.enabled === false) return payload;
    if (!isYinglingFaceProcessingModel(input.model)) return payload;
    const images = payload.images;
    if (!(Array.isArray(images) ? images.length : typeof images === "string" && images.trim())) return payload;
    return {
        ...payload,
        face_processing: true,
        face_processing_method: normalizeYinglingFaceProcessingMethod(input.method),
    };
}
