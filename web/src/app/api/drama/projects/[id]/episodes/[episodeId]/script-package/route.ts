import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import { applyDramaEpisodeProductionPackageForUser, DramaProjectServiceError, previewDramaProductionPackageForUser } from "@/lib/server/drama-project-service";

export async function POST(request: Request, context: { params: Promise<{ id: string; episodeId: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, 8 * 1024 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const { id, episodeId } = await context.params;
        const input = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) ? (parsed.data as Record<string, unknown>) : {};
        if (input.action === "apply") {
            const project = await applyDramaEpisodeProductionPackageForUser(user.id, id, episodeId, input);
            return NextResponse.json({ code: 0, data: { project }, msg: "当前集制作包已回填" });
        }
        const preview = previewDramaProductionPackageForUser(input);
        if (preview.package.episodes.length !== 1) return NextResponse.json({ code: 400, data: null, msg: "剧本 Agent 制作包只能包含当前集" }, { status: 400 });
        return NextResponse.json({ code: 0, data: { preview }, msg: "当前集制作包预览已生成" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
