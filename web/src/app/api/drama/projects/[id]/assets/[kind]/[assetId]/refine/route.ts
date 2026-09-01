import { NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { refineDramaAssetWithModel, DramaAssetRefinementError } from "@/lib/server/drama-asset-refinement-service";
import { getDramaProjectForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { checkRateLimit } from "@/lib/server/security";

type Context = { params: Promise<{ id: string; kind: string; assetId: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    if (!(await checkRateLimit(`drama-asset-refine:${user.id}`, { maxRequests: 12, windowMs: 60_000 })).allowed) return NextResponse.json({ code: 429, data: null, msg: "资产调整请求过于频繁，请稍后重试" }, { status: 429 });
    const parsed = await readJsonBodyResult<{ requestId?: unknown; prompt?: unknown }>(request);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    const prompt = typeof parsed.data?.prompt === "string" ? parsed.data.prompt.trim() : "";
    const requestId = typeof parsed.data?.requestId === "string" ? parsed.data.requestId.trim() : "";
    if (!prompt || prompt.length > 4000) return NextResponse.json({ code: 400, data: null, msg: "请输入 1–4000 字的调整要求" }, { status: 400 });
    try {
        const { id, kind, assetId } = await context.params;
        if (kind !== "characters" && kind !== "scenes" && kind !== "props") return NextResponse.json({ code: 400, data: null, msg: "当前资产类型不支持 GPT 调整" }, { status: 400 });
        const project = await getDramaProjectForUser(user.id, id);
        const asset = project[kind].find((item) => item.id === assetId);
        if (!asset) return NextResponse.json({ code: 404, data: null, msg: "项目资产不存在" }, { status: 404 });
        const primaryRefinement = asset.references?.find((reference) => reference.id === asset.primaryReferenceId && reference.status === "approved")?.refinement;
        const refinementBase = primaryRefinement
            ? { ...asset, description: primaryRefinement.updatedDescription || asset.description, profile: primaryRefinement.updatedProfile }
            : asset;
        const proposal = await refineDramaAssetWithModel({
            origin: resolveInternalOrigin(new URL(request.url).origin),
            cookie: request.headers.get("cookie") || "",
            userId: user.id,
            requestId: requestId || `${asset.id}:${prompt}`,
            project,
            kind,
            asset: refinementBase,
            prompt,
        });
        return NextResponse.json({ code: 0, data: { proposal }, msg: "资产调整方案已生成" });
    } catch (error) {
        const status = error instanceof DramaAssetRefinementError || error instanceof DramaProjectServiceError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "资产调整失败" }, { status });
    }
}
