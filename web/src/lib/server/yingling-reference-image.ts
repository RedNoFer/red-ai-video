import sharp from "sharp";

import { CREATIVE_UPLOAD_MAX_BYTES } from "@/lib/creative-upload";
import { YINGLING_REFERENCE_IMAGE_MAX_BYTES } from "@/lib/yingling-reference-constraints";
import { createSignedReferenceAssetUrl } from "@/lib/server/reference-asset-access";
import { writeReferenceMediaBytes } from "@/lib/server/reference-asset-store";
import { fetchSafeOutbound } from "@/lib/server/safe-outbound-fetch";

const MAX_REFERENCE_IMAGE_PIXELS = 40_000_000;
const IMAGE_READ_TIMEOUT_MS = 30_000;

export type CompressedReferenceImage = { bytes: Buffer; mimeType: string; changed: boolean };
export type CompressedReferenceImageContext = { ownerUserId: string; publicOrigin: string; taskId?: string };

export async function compressYinglingReferenceImageBytes(bytes: Buffer, mimeType: string, maxBytes = YINGLING_REFERENCE_IMAGE_MAX_BYTES): Promise<CompressedReferenceImage> {
    if (bytes.length <= maxBytes) return { bytes, mimeType, changed: false };

    const image = sharp(bytes, { failOn: "error", limitInputPixels: MAX_REFERENCE_IMAGE_PIXELS });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error("影灵渠道参考图无法读取尺寸，请换一张图片");
    if (metadata.pages && metadata.pages > 1) throw new Error("影灵渠道暂不支持自动压缩超过 9MB 的动图，请先转成静态图片");

    const rotated = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;
    let width = rotated ? metadata.height : metadata.width;
    let height = rotated ? metadata.width : metadata.height;
    const preserveAlpha = Boolean(metadata.hasAlpha);
    const outputMimeType = preserveAlpha ? "image/png" : "image/jpeg";

    while (true) {
        const pipeline = sharp(bytes, { failOn: "error", limitInputPixels: MAX_REFERENCE_IMAGE_PIXELS }).rotate().resize({ width, height, fit: "inside", withoutEnlargement: true });
        const output = preserveAlpha ? await pipeline.png({ palette: true, quality: 88, effort: 10, compressionLevel: 9 }).toBuffer() : await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
        if (output.length <= maxBytes) return { bytes: output, mimeType: outputMimeType, changed: true };

        const scale = Math.min(0.95, Math.sqrt(maxBytes / output.length) * 0.95);
        const nextWidth = Math.max(1, Math.floor(width * scale));
        const nextHeight = Math.max(1, Math.floor(height * scale));
        if (nextWidth === width && nextHeight === height) throw new Error("影灵渠道参考图压缩失败，请重新保存图片后重试");
        width = nextWidth;
        height = nextHeight;
    }
}

export async function publishYinglingReferenceImageUrl(url: string, maxBytes: number, context: CompressedReferenceImageContext) {
    const source = url.trim();
    if (!source) throw new Error("影灵渠道参考图地址无效，请重新上传");

    const inline = parseImageDataUrl(source);
    if (inline) {
        if (inline.bytes.length > CREATIVE_UPLOAD_MAX_BYTES) throw new Error("影灵渠道参考图超过 20MB，无法在本地压缩");
        const compressed = await compressYinglingReferenceImageBytes(inline.bytes, inline.mimeType, maxBytes);
        return compressed.changed ? storeCompressedImage(compressed, maxBytes, context) : storeReferenceImage(compressed, context);
    }

    const contentLength = await readImageContentLength(source);
    if (contentLength !== undefined && contentLength <= maxBytes) return source;
    const image = await readImageUrl(source);
    if (image.bytes.length <= maxBytes) return source;
    return storeCompressedImage(await compressYinglingReferenceImageBytes(image.bytes, image.mimeType, maxBytes), maxBytes, context);
}

export async function publishYinglingInlineVideoReferenceImages<T extends { type: string; url: string; remoteUrl?: string; serverUrl?: string }>(references: readonly T[], maxBytes: number, context: CompressedReferenceImageContext) {
    return Promise.all(
        references.map(async (reference) => {
            if (reference.type !== "image" || !reference.url.startsWith("data:image/")) return reference;
            const publishedUrl = await publishYinglingReferenceImageUrl(reference.url, maxBytes, context);
            return { ...reference, url: publishedUrl, remoteUrl: undefined, serverUrl: undefined };
        }),
    );
}

export async function publishYinglingVideoReferenceImages<T extends { type: string; url: string; remoteUrl?: string; serverUrl?: string }>(references: readonly T[], maxBytes: number, context: CompressedReferenceImageContext) {
    return Promise.all(
        references.map(async (reference) => {
            if (reference.type !== "image") return reference;
            const publishedUrl = await publishYinglingReferenceImageUrl(reference.url, maxBytes, context);
            if (publishedUrl === reference.url) return reference;
            return { ...reference, url: publishedUrl, remoteUrl: undefined, serverUrl: undefined };
        }),
    );
}

export function imageFileNameForMimeType(name: string, mimeType: string) {
    const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/png" ? ".png" : "";
    if (!extension) return name;
    const base = name.replace(/\.[^.]*$/, "");
    return `${base || "reference"}${extension}`;
}

async function readImageContentLength(url: string) {
    try {
        const response = await fetchSafeOutbound(url, {
            method: "HEAD",
            headers: { accept: "image/*" },
            cache: "no-store",
            signal: AbortSignal.timeout(IMAGE_READ_TIMEOUT_MS),
        });
        const rawLength = response.headers.get("content-length");
        const length = Number(rawLength);
        const contentType = response.headers.get("content-type")?.toLowerCase() || "";
        await response.body?.cancel().catch(() => undefined);
        if (response.ok && contentType.startsWith("image/") && rawLength !== null && Number.isSafeInteger(length) && length > 0) return length;
    } catch {
        return undefined;
    }
    return undefined;
}

async function readImageUrl(url: string) {
    const response = await fetchSafeOutbound(url, {
        headers: { accept: "image/*" },
        cache: "no-store",
        signal: AbortSignal.timeout(IMAGE_READ_TIMEOUT_MS),
    });
    if (!response.ok || !response.body) throw new Error("影灵渠道参考图读取失败，请确认图片地址可访问");
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() || "";
    if (!mimeType.startsWith("image/")) throw new Error("影灵渠道参考素材不是有效图片");
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > CREATIVE_UPLOAD_MAX_BYTES) throw new Error("影灵渠道参考图超过 20MB，无法在本地压缩");
    const bytes = await readResponseBytes(response, CREATIVE_UPLOAD_MAX_BYTES);
    if (!bytes.length) throw new Error("影灵渠道参考图读取失败，请重新上传");
    return { bytes, mimeType };
}

async function readResponseBytes(response: Response, maxBytes: number) {
    const reader = response.body?.getReader();
    if (!reader) return Buffer.alloc(0);
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new Error("影灵渠道参考图超过 20MB，无法在本地压缩");
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
}

function parseImageDataUrl(value: string) {
    const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) return null;
    const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
    return bytes.length ? { bytes, mimeType: match[1].toLowerCase() } : null;
}

async function storeCompressedImage(image: CompressedReferenceImage, maxBytes: number, context: CompressedReferenceImageContext) {
    if (image.bytes.length > maxBytes) throw new Error("影灵渠道参考图压缩后仍超过 9MB，请重新选择更小的图片");
    return storeReferenceImage(image, context);
}

async function storeReferenceImage(image: CompressedReferenceImage, context: CompressedReferenceImageContext) {
    const asset = await writeReferenceMediaBytes(image.bytes, "image", image.mimeType, {
        ownerUserId: context.ownerUserId,
        source: image.changed ? "yingling-reference-compressed" : "yingling-reference-inline",
        taskId: context.taskId,
        maxBytes: CREATIVE_UPLOAD_MAX_BYTES,
    });
    const signedUrl = asset.url || createSignedReferenceAssetUrl(asset.token, context.publicOrigin);
    if (!signedUrl) throw new Error("影灵渠道参考图签名失败，请检查媒体签名配置");
    return signedUrl;
}
