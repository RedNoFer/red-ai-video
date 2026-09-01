import { NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { reviewCreativeOutputs } from "@/lib/server/creative-review-service";
import { getDramaProjectForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { checkRateLimit } from "@/lib/server/security";

type Context = { params: Promise<{ id: string; kind: string; assetId: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    if (!(await checkRateLimit(`drama-asset-review:${user.id}`, { maxRequests: 12, windowMs: 60_000 })).allowed) return NextResponse.json({ code: 429, data: null, msg: "资产审核请求过于频繁，请稍后重试" }, { status: 429 });
    const parsed = await readJsonBodyResult<{ prompt?: unknown; generationStage?: unknown; references?: unknown }>(request);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const { id, kind, assetId } = await context.params;
        if (kind !== "characters" && kind !== "scenes" && kind !== "props") return NextResponse.json({ code: 400, data: null, msg: "当前资产类型不支持自动审核" }, { status: 400 });
        const project = await getDramaProjectForUser(user.id, id);
        const asset = project[kind].find((item) => item.id === assetId);
        if (!asset) return NextResponse.json({ code: 404, data: null, msg: "项目资产不存在" }, { status: 404 });
        const references = normalizeReferences(parsed.data?.references);
        if (!references.length) return NextResponse.json({ code: 400, data: null, msg: "没有可审核的候选图" }, { status: 400 });
        const profile = asset.profile;
        const prompt = typeof parsed.data?.prompt === "string" ? parsed.data.prompt.trim() : "";
        const generationStage = parsed.data?.generationStage === "refinement" ? "refinement" : "initial";
        const review = await reviewCreativeOutputs({
            origin: resolveInternalOrigin(new URL(request.url).origin),
            cookie: request.headers.get("cookie") || "",
            userId: user.id,
            billingId: `drama-asset:${project.id}:${asset.id}:${references.map((item) => item.id).join(",")}`,
            foundation: {
                complexity: "complex",
                brief: {
                    objective: `审核${asset.name}的最新候选图是否仍是同一个${kind === "characters" ? "角色" : kind === "scenes" ? "场景" : "道具"}`,
                    coreMessage: asset.description,
                    constraints: [profile?.visualIdentity, profile?.consistencyRules, ...(profile?.identityAnchors || []), ...(profile?.forbiddenChanges || [])].filter(Boolean) as string[],
                    referenceStrategy: "以当前资产固定设定和本轮明确调整要求为准，未授权字段必须保持不变",
                },
                direction: {
                    summary: project.style,
                    style: project.style,
                    colors: profile?.colorPalette ? [profile.colorPalette] : [],
                    keywords: [profile?.styling, prompt].filter(Boolean) as string[],
                    avoid: kind === "characters" ? ["改变身份、脸型、核心年龄或族裔特征", "通用 NPC、RPG 套装、模板化盔甲", "未授权武器、徽章、文字或品牌"] : ["改变关键识别轮廓", "未授权文字或品牌"],
                },
            },
            tasks: references.map((reference) => ({ id: reference.id, title: `${asset.name}候选图`, type: "image" as const, prompt, resultSummary: generationStage === "refinement" ? "按建议调整生成的资产候选图" : "首次生成的资产候选图", imageUrls: [reference.url] })),
        });
        return NextResponse.json({ code: 0, data: { review }, msg: "候选图审核已完成" });
    } catch (error) {
        const status = error instanceof DramaProjectServiceError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "候选图审核失败" }, { status });
    }
}

function normalizeReferences(value: unknown) {
    return (Array.isArray(value) ? value : []).flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const input = item as Record<string, unknown>;
        const id = typeof input.id === "string" ? input.id.trim() : "";
        const url = typeof input.url === "string" ? input.url.trim() : "";
        return id && (url.startsWith("/api/") || /^https:\/\//i.test(url) || /^data:image\//i.test(url)) ? [{ id, url }] : [];
    });
}
