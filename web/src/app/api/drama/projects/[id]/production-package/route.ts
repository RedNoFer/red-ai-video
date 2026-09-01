import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { applyDramaProductionPackageForUser, DramaProjectServiceError, previewDramaProductionPackageForUser } from "@/lib/server/drama-project-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, 8 * 1024 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    const input = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) ? (parsed.data as Record<string, unknown>) : {};
    try {
        if (input.action === "apply") {
            const project = await applyDramaProductionPackageForUser(user.id, (await context.params).id, input);
            return NextResponse.json({ code: 0, data: { project }, msg: "完整制作包已导入" });
        }
        const preview = previewDramaProductionPackageForUser(input);
        return NextResponse.json({ code: 0, data: { preview }, msg: "制作包预览已生成" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
