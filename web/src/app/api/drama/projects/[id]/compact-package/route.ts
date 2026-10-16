import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { DRAMA_PRODUCTION_PACKAGE_MAX_BYTES } from "@/lib/server/drama-production-package";
import { applyDramaCompactPackageForUser, DramaProjectServiceError, getDramaProjectForUser, previewDramaCompactPackageForUser } from "@/lib/server/drama-project-service";
import { dramaProjectForClient } from "@/lib/server/drama-project-response";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, DRAMA_PRODUCTION_PACKAGE_MAX_BYTES);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    const input = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) ? (parsed.data as Record<string, unknown>) : {};
    try {
        const id = (await context.params).id;
        if (input.action === "apply") {
            const project = await applyDramaCompactPackageForUser(user.id, id, input);
            return NextResponse.json({ code: 0, data: { project: dramaProjectForClient(project) }, msg: "精简制作包已导入" });
        }
        const project = await getDramaProjectForUser(user.id, id);
        return NextResponse.json({ code: 0, data: { preview: previewDramaCompactPackageForUser(input, project) }, msg: "精简制作包预览已生成" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
