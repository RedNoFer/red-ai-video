import { NextResponse } from "next/server";
import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { completeDramaAsset } from "@/lib/server/drama-asset-completion-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

export async function POST(request: Request, context: { params: Promise<{ id: string; kind: string; assetId: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<{ requestId?: unknown; config?: unknown }>(request, 512 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    const params = await context.params;
    if (!["characters", "scenes", "props", "clues"].includes(params.kind)) return NextResponse.json({ code: 400, data: null, msg: "资产类型无效" }, { status: 400 });
    try {
        const data = await completeDramaAsset({ userId: user.id, projectId: params.id, kind: params.kind as "characters" | "scenes" | "props" | "clues", assetId: params.assetId, requestId: typeof parsed.data?.requestId === "string" && parsed.data.requestId.trim() ? parsed.data.requestId.trim() : crypto.randomUUID(), origin: resolveInternalOrigin(new URL(request.url).origin), cookie: request.headers.get("cookie") || "", config: parsed.data?.config });
        return NextResponse.json({ code: 0, data, msg: "资产智能补全已提交" });
    } catch (error) {
        return NextResponse.json({ code: 500, data: null, msg: error instanceof Error ? error.message : "资产智能补全失败" }, { status: 500 });
    }
}
