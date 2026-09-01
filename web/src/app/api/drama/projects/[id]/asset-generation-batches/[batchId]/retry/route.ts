import { after, NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { getDramaAssetGenerationBatchForUser, DramaAssetGenerationBatchError, runDramaAssetGenerationBatchInBackground, updateDramaAssetGenerationBatchForUser } from "@/lib/server/drama-asset-generation-batch";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

type Context = { params: Promise<{ id: string; batchId: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<{ config?: unknown }>(request, 512 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const params = await context.params;
        const batch = await getDramaAssetGenerationBatchForUser(user.id, params.id, params.batchId);
        const origin = resolveInternalOrigin(new URL(request.url).origin);
        const cookie = request.headers.get("cookie") || "";
        const config = parsed.data?.config && typeof parsed.data.config === "object" ? (parsed.data.config as Record<string, unknown>) : batch.executionConfig || {};
        const retryable = batch.items.filter((item) => item.status === "error" && item.outputType !== "character_voice");
        const items = batch.items.map((item) => {
            if (item.status !== "error") return item;
            if (item.outputType === "character_voice") return { ...item, status: "cancelled" as const, error: undefined, completedAt: new Date().toISOString(), voiceError: undefined, voiceStatus: "not_applicable" as const };
            return { ...item, status: "queued" as const, error: undefined, completedAt: undefined, generationTaskId: undefined, previewTaskId: undefined, planningError: undefined, referenceError: undefined, voiceError: undefined };
        });
        const updated = await updateDramaAssetGenerationBatchForUser(user.id, { ...batch, executionConfig: config, items });
        if (retryable.length) after(() => runDramaAssetGenerationBatchInBackground({ userId: user.id, projectId: params.id, batchId: batch.id, origin, cookie, config }));
        return NextResponse.json({ code: 0, data: { batch: updated, retryCount: retryable.length }, msg: retryable.length ? "失败项已重新排队，后台继续处理" : "没有可重试的失败项" });
    } catch (error) {
        const status = error instanceof DramaAssetGenerationBatchError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "重试批量任务失败" }, { status });
    }
}
