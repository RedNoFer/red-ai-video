import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { CREATIVE_UPLOAD_MAX_BYTES } from "@/lib/creative-upload";
import { writePersistentMediaBytes, writePersistentMediaDataUrl, writeReferenceMediaBytes, writeReferenceMediaDataUrl } from "@/lib/server/reference-asset-store";
import { readJsonBody } from "@/lib/auth/request";
import { createSignedReferenceAssetUrl } from "@/lib/server/reference-asset-access";
import { resolvePublicRequestOrigin } from "@/lib/server/public-request-origin";
import { readRequestBodyBytes, RequestBodyTooLargeError } from "@/lib/server/request-body-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_UPLOAD_REQUEST_BYTES = CREATIVE_UPLOAD_MAX_BYTES + 64 * 1024;

export async function POST(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    try {
        const contentType = request.headers.get("content-type") || "";
        let body: { dataUrl?: unknown; type?: unknown; persistent?: unknown; originalName?: unknown } = {};
        let file: File | null = null;
        if (contentType.startsWith("multipart/form-data")) {
            const formData = await readRequestBodyBytes(request, MAX_UPLOAD_REQUEST_BYTES)
                .then((bytes) => new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: bytes }).formData())
                .catch((error) => {
                    if (error instanceof RequestBodyTooLargeError) throw error;
                    return null;
                });
            const formFile = formData?.get("file");
            if (!formData || !formFile || typeof formFile === "string") return NextResponse.json({ error: "缺少参考素材" }, { status: 400 });
            file = formFile;
            body = {
                type: formData.get("type"),
                persistent: formData.get("persistent"),
                originalName: formData.get("originalName") || file.name,
            };
        } else {
            body = await readJsonBody<{ dataUrl?: unknown; type?: unknown; persistent?: unknown; originalName?: unknown }>(request, 28 * 1024 * 1024).catch(() => ({}));
        }
        const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
        if (!file && !dataUrl) return NextResponse.json({ error: "缺少参考素材" }, { status: 400 });
        const type = body.type === "video" || body.type === "audio" ? body.type : "image";
        const persistent = body.persistent === true || body.persistent === "true";

        const context = {
            ownerUserId: currentUser.id,
            source: "user-upload",
            originalName: typeof body.originalName === "string" ? body.originalName : undefined,
            maxBytes: CREATIVE_UPLOAD_MAX_BYTES,
        };
        const asset = file
            ? persistent
                ? await writePersistentMediaBytes(new Uint8Array(await file.arrayBuffer()), type, file.type, context)
                : await writeReferenceMediaBytes(new Uint8Array(await file.arrayBuffer()), type, file.type, context)
            : persistent
              ? await writePersistentMediaDataUrl(dataUrl, type, context)
              : await writeReferenceMediaDataUrl(dataUrl, type, context);
        const origin = resolvePublicRequestOrigin(request);
        const browserUrl = `/api/reference-assets/${asset.token
            .split("/")
            .map((part) => encodeURIComponent(part))
            .join("/")}`;
        return NextResponse.json({
            url: browserUrl,
            upstreamUrl: asset.url || createSignedReferenceAssetUrl(asset.token, origin) || undefined,
            token: asset.token,
            key: asset.token,
            storage: asset.storage,
            bytes: asset.bytes,
            mimeType: asset.mimeType,
        });
    } catch (error) {
        if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "单个文件不能超过 20MB" }, { status: error.status });
        return NextResponse.json({ error: error instanceof Error ? error.message : "参考图临时保存失败" }, { status: 400 });
    }
}
