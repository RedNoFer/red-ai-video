export const videoReferenceRoles = ["reference", "first_frame", "last_frame", "keyframe"] as const;
export type VideoReferenceRole = (typeof videoReferenceRoles)[number];

export const creativeVideoReferenceModes = ["reference", "first_frame", "first_last", "all_frames"] as const;
export type CreativeVideoReferenceMode = (typeof creativeVideoReferenceModes)[number];

export type VideoGenerationReference = {
    type: "image" | "video" | "audio";
    url: string;
    role?: VideoReferenceRole;
    keyframeIndex?: number;
};

export const ALL_FRAMES_MIN = 2;
export const ALL_FRAMES_MAX = 5;

export function normalizeVideoReferenceRole(value: unknown): VideoReferenceRole | undefined {
    return typeof value === "string" && videoReferenceRoles.includes(value.trim() as VideoReferenceRole) ? (value.trim() as VideoReferenceRole) : undefined;
}

export function normalizeVideoGenerationReferences(value: unknown): VideoGenerationReference[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error("视频参考素材格式不正确");
    const references: VideoGenerationReference[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("视频参考素材格式不正确");
        const source = item as Record<string, unknown>;
        const type = source.type === "image" || source.type === "video" || source.type === "audio" ? source.type : undefined;
        const url = typeof source.url === "string" ? source.url.trim() : "";
        const role = source.role === undefined ? "reference" : normalizeVideoReferenceRole(source.role);
        if (!type || !url || !role) throw new Error("视频参考素材类型、地址或角色不正确");
        if (role !== "reference" && type !== "image") throw new Error(role === "keyframe" ? "全能帧只能使用图片素材" : "视频首尾帧只能使用图片素材");
        const keyframeIndex = source.keyframeIndex === undefined ? undefined : Number(source.keyframeIndex);
        if (role === "keyframe" && (!Number.isInteger(keyframeIndex) || !keyframeIndex || keyframeIndex < 1 || keyframeIndex > ALL_FRAMES_MAX)) throw new Error("全能帧序号必须是 1 到 5 的整数");
        references.push({ type, url, role, ...(keyframeIndex === undefined ? {} : { keyframeIndex }) });
    }
    const firstFrames = references.filter((reference) => reference.role === "first_frame");
    const lastFrames = references.filter((reference) => reference.role === "last_frame");
    if (firstFrames.length > 1) throw new Error("一次只能指定一张首帧图片");
    if (lastFrames.length > 1) throw new Error("一次只能指定一张尾帧图片");
    if (lastFrames.length && !firstFrames.length) throw new Error("指定尾帧时必须同时指定首帧");
    if (firstFrames.length && lastFrames.length && firstFrames[0].url === lastFrames[0].url) throw new Error("首帧和尾帧不能使用同一张图片");
    const keyframes = references.filter((reference) => reference.role === "keyframe");
    if (keyframes.length && (keyframes.length < ALL_FRAMES_MIN || keyframes.length > ALL_FRAMES_MAX)) throw new Error("全能帧必须提供 2 到 5 张图片");
    if (keyframes.length) {
        if (lastFrames.length) throw new Error("全能帧不能与尾帧混用");
        if (new Set(keyframes.map((reference) => reference.url)).size !== keyframes.length) throw new Error("全能帧图片不能重复");
        const indexes = keyframes.map((reference) => reference.keyframeIndex).sort((left, right) => (left || 0) - (right || 0));
        if (new Set(indexes).size !== indexes.length || indexes.some((index, position) => index !== position + 1)) throw new Error("全能帧序号必须从 1 连续排列");
    }
    return Array.from(new Map(references.map((reference) => [`${reference.type}:${reference.role}:${reference.keyframeIndex || ""}:${reference.url}`, reference])).values());
}

export function videoFrameAssetIds(input: { firstFrameAssetId?: string; lastFrameAssetId?: string; frameAssetIds?: string[] } | undefined) {
    return input?.frameAssetIds?.length ? [...input.frameAssetIds] : Array.from(new Set([input?.firstFrameAssetId, input?.lastFrameAssetId].filter((id): id is string => Boolean(id))));
}

export function videoFrameReferences(references: readonly VideoGenerationReference[]) {
    return {
        firstFrame: references.find((reference) => reference.role === "first_frame"),
        lastFrame: references.find((reference) => reference.role === "last_frame"),
        keyframes: references.filter((reference) => reference.role === "keyframe").sort((left, right) => (left.keyframeIndex || 0) - (right.keyframeIndex || 0)),
    };
}

export function regularVideoReferences(references: readonly VideoGenerationReference[]) {
    return references.filter((reference) => reference.role !== "first_frame" && reference.role !== "last_frame" && reference.role !== "keyframe");
}
