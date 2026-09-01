import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { createLocalMediaResponse } from "@/lib/server/local-media-response";
import { fetchInternalApi, resolveInternalOrigin } from "@/lib/server/internal-origin";
import { getLocalMediaRegistration } from "@/lib/server/local-media-registry";
import { createExternalMediaReadUrl } from "@/lib/server/object-storage-service";
import { readReferenceAsset } from "@/lib/server/reference-asset-store";
import { getVideoTask } from "@/lib/server/video-task-store";
import { persistVideoTaskResult, queryVideoTaskUpstream } from "@/lib/server/video-task-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser(request);
    const task = user ? await getVideoTask((await params).id) : null;
    if (!user || !task || (task.userId !== user.id && user.role !== "admin")) {
        return NextResponse.json({ code: user ? 404 : 401, data: null, msg: user ? "视频任务不存在" : "请先登录" }, { status: user ? 404 : 401 });
    }
    if (task.status !== "success") return NextResponse.json({ code: 409, data: null, msg: "视频任务尚未成功，暂时无法下载" }, { status: 409 });

    const requestQuery = new URL(request.url).searchParams;
    let result = task.result;
    const needsRepair = requestQuery.get("repair") === "1" || !result?.url || /^https?:\/\//i.test(result.url);
    if (needsRepair && requestQuery.get("repair") !== "1") {
        return NextResponse.json({ code: 409, data: null, msg: "视频资源尚未补全，请先点击“补全视频”" }, { status: 409 });
    }
    if (needsRepair) {
        const origin = resolveInternalOrigin(new URL(request.url).origin);
        const step = await queryVideoTaskUpstream(task, origin, request.headers.get("cookie") || "", "", true);
        if (step.state !== "result_ready") return NextResponse.json({ code: 409, data: null, msg: "供应商暂未返回可下载的视频地址" }, { status: 409 });
        const persisted = await persistVideoTaskResult(task, step.resultUrl, origin, request.headers.get("cookie") || "", "", true);
        result = persisted?.result;
    }
    if (!result?.url) return NextResponse.json({ code: 502, data: null, msg: "视频资源备份失败，请稍后重试" }, { status: 502 });

    if (requestQuery.get("repair") === "1") return NextResponse.json({ code: 0, data: { url: result.url, mimeType: result.mimeType, durationMs: result.durationMs }, msg: "视频资源已补全" });
    const target = new URL(result.url, new URL(request.url).origin);
    const localPath = target.pathname.startsWith("/api/reference-assets/") ? target.pathname.slice("/api/reference-assets/".length) : "";
    const registration = localPath ? await getLocalMediaRegistration(decodeURIComponent(localPath)) : null;
    const localAsset = localPath ? await readReferenceAsset(decodeURIComponent(localPath)) : null;
    if (registration?.ownerUserId === task.userId && registration.storageProvider === "object") {
        const externalUrl = await createExternalMediaReadUrl(request, registration);
        if (externalUrl) {
            if (requestQuery.get("download") !== "1") return NextResponse.redirect(externalUrl, 307);
            const response = await fetchInternalApi(externalUrl, { cache: "no-store" }).catch(() => null);
            if (response?.ok && response.body) {
                const headers = new Headers(response.headers);
                headers.set("Content-Disposition", `attachment; filename="${safeFileName(task.id)}.mp4"`);
                return new Response(response.body, { status: response.status, headers });
            }
        }
    }
    if (localAsset && registration?.ownerUserId === task.userId) {
        const response = await createLocalMediaResponse(
            request,
            localAsset.filePath,
            localAsset.mimeType,
            requestQuery.get("download") === "1" ? { "Content-Disposition": `attachment; filename="${safeFileName(task.id)}.mp4"` } : {},
        );
        if (response) return response;
    }
    if (requestQuery.get("download") === "1") {
        if (target.pathname.startsWith("/api/reference-assets/")) target.searchParams.set("download", "original");
        const source = target.toString();
        const response = await fetchInternalApi(source, { headers: { cookie: request.headers.get("cookie") || "" }, cache: "no-store" }).catch(() => null);
        if (!response?.ok || !response.body) return NextResponse.json({ code: 502, data: null, msg: "本地视频资源读取失败，请稍后重试" }, { status: 502 });
        const headers = new Headers(response.headers);
        headers.set("Content-Disposition", `attachment; filename="${safeFileName(task.id)}.mp4"`);
        return new Response(response.body, { status: response.status, headers });
    }
    return NextResponse.redirect(target, 307);
}

function safeFileName(taskId: string) {
    return `video-${taskId.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) || "result"}`;
}
