import { after, NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { createDramaAssetGenerationBatchForUser, DramaAssetGenerationBatchError, listDramaAssetGenerationBatchesForUser } from "@/lib/server/drama-asset-generation-batch";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { runDramaAssetGenerationBatchInBackground } from "@/lib/server/drama-asset-generation-batch";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const projectId = (await context.params).id;
        const batches = await listDramaAssetGenerationBatchesForUser(user.id, projectId);
        const origin = resolveInternalOrigin(new URL(request.url).origin);
        const cookie = request.headers.get("cookie") || "";
        for (const batch of batches.filter((item) => item.status === "queued" || item.status === "running")) {
            after(() => runDramaAssetGenerationBatchInBackground({ userId: user.id, projectId, batchId: batch.id, origin, cookie, config: batch.executionConfig || {} }));
        }
        return NextResponse.json({ code: 0, data: { batches }, msg: "OK" });
    } catch (error) {
        return errorResponse(error);
    }
}

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<{ assets?: unknown; config?: unknown }>(request, 512 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const projectId = (await context.params).id;
        const assets = normalizeAssets(parsed.data?.assets);
        const config = parsed.data?.config && typeof parsed.data.config === "object" ? (parsed.data.config as Record<string, unknown>) : {};
        const batch = await createDramaAssetGenerationBatchForUser(user.id, projectId, assets, config);
        const origin = resolveInternalOrigin(new URL(request.url).origin);
        const cookie = request.headers.get("cookie") || "";
        after(() => runDramaAssetGenerationBatchInBackground({ userId: user.id, projectId, batchId: batch.id, origin, cookie, config }));
        return NextResponse.json({ code: 0, data: { batch }, msg: "批量生成已提交，任务将在后台继续运行" });
    } catch (error) {
        return errorResponse(error);
    }
}

function normalizeAssets(value: unknown) {
    return (Array.isArray(value) ? value : []).flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const input = item as Record<string, unknown>;
        return typeof input.kind === "string" && typeof input.assetId === "string" ? [{ kind: input.kind, assetId: input.assetId }] : [];
    });
}

function errorResponse(error: unknown) {
    const status = error instanceof DramaAssetGenerationBatchError ? error.status : 500;
    return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "批量生成失败" }, { status });
}
