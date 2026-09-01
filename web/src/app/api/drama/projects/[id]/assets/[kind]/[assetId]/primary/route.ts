import { NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { approveDramaAssetReferenceForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; kind: string; assetId: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<{ referenceId?: unknown }>(request);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    const referenceId = typeof parsed.data?.referenceId === "string" ? parsed.data.referenceId.trim() : "";
    if (!referenceId) return NextResponse.json({ code: 400, data: null, msg: "候选图 ID 无效" }, { status: 400 });
    try {
        const { id, kind, assetId } = await context.params;
        const project = await approveDramaAssetReferenceForUser(user.id, id, kind, assetId, referenceId);
        return NextResponse.json({ code: 0, data: { project }, msg: "主基准图已保存" });
    } catch (error) {
        const status = error instanceof DramaProjectServiceError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "主基准图保存失败" }, { status });
    }
}
