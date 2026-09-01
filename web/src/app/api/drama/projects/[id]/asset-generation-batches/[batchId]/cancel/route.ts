import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDramaAssetGenerationBatchForUser, DramaAssetGenerationBatchError, updateDramaAssetGenerationBatchForUser } from "@/lib/server/drama-asset-generation-batch";

type Context = { params: Promise<{ id: string; batchId: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const params = await context.params;
        const batch = await getDramaAssetGenerationBatchForUser(user.id, params.id, params.batchId);
        const items = await Promise.all(batch.items.map(async (item) => {
            if (item.status === "queued") return { ...item, status: "cancelled" as const, completedAt: new Date().toISOString() };
            if (item.status === "running" && item.generationTaskId) {
                const endpoint = item.outputType === "character_voice" ? "audio-tasks" : "image-tasks";
                const response = await fetch(new URL(`/api/${endpoint}/${encodeURIComponent(item.generationTaskId)}`, request.url), { method: "PATCH", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" }, body: JSON.stringify({ status: "cancelled" }) }).catch(() => null);
                if (response?.ok) return { ...item, status: "cancelled" as const, completedAt: new Date().toISOString() };
            }
            return item;
        }));
        const updated = await updateDramaAssetGenerationBatchForUser(user.id, { ...batch, items });
        return NextResponse.json({ code: 0, data: { batch: updated }, msg: "批量任务已取消" });
    } catch (error) {
        const status = error instanceof DramaAssetGenerationBatchError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "取消批量任务失败" }, { status });
    }
}
