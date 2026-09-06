import { NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { DramaProjectServiceError, updateDramaAssetForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string; kind: string; assetId: string }> };

export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const { id, kind, assetId } = await context.params;
        const project = await updateDramaAssetForUser(user.id, id, kind, assetId, parsed.data);
        return NextResponse.json({ code: 0, data: { project }, msg: "资产设定已保存" });
    } catch (error) {
        const status = error instanceof DramaProjectServiceError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "资产设定保存失败" }, { status });
    }
}
