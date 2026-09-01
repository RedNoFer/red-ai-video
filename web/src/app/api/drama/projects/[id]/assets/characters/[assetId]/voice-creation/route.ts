import { after, NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { runGenerationTaskRecoveryBatch } from "@/lib/server/generation-task-recovery-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { createDramaVoiceCreationTask, DramaVoiceCreationError, syncDramaVoiceCreationTask } from "@/lib/server/drama-voice-creation";
import { getDramaProjectForUser } from "@/lib/server/drama-project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const { id, assetId } = await context.params;
        const body = await readJsonBody<{ mode?: unknown; sampleAssetId?: unknown; requestId?: unknown; confirmReplace?: unknown }>(request);
        if (body.mode !== "clone") return NextResponse.json({ code: 400, data: null, msg: "当前仅支持 Voice Clone" }, { status: 400 });
        const project = await getDramaProjectForUser(user.id, id);
        const character = project.characters.find((item) => item.id === assetId);
        if (!character) return NextResponse.json({ code: 404, data: null, msg: "角色不存在" }, { status: 404 });
        const origin = resolveInternalOrigin(new URL(request.url).origin);
        const result = await createDramaVoiceCreationTask({
            userId: user.id,
            project,
            character,
            mode: "clone",
            sampleAssetId: typeof body.sampleAssetId === "string" ? body.sampleAssetId : "",
            requestId: typeof body.requestId === "string" ? body.requestId : "",
            confirmReplace: body.confirmReplace === true,
            origin,
        });
        if (!result.cached && result.task.status !== "success") after(() => runGenerationTaskRecoveryBatch({ origin, cookie: request.headers.get("cookie") || "", limit: 1, taskIds: [result.task.id] }));
        return NextResponse.json({
            code: 0,
            data: { ...result, task: { id: result.task.id, status: result.task.status, result: result.task.result ? { url: result.task.result.url, mimeType: result.task.result.mimeType, voiceId: result.task.result.voiceId } : undefined } },
            msg: result.task.status === "success" ? "新声纹已生成" : "新声纹任务已创建",
        });
    } catch (error) {
        const status = error instanceof DramaVoiceCreationError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "声纹创建失败" }, { status });
    }
}

export async function GET(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const { id, assetId } = await context.params;
        const result = await syncDramaVoiceCreationTask(user.id, id, assetId);
        return NextResponse.json({ code: 0, data: result, msg: result.voiceProfile?.creationStatus === "success" ? "新声纹已生成" : result.voiceProfile?.creationStatus === "error" ? result.voiceProfile.creationError || "声纹创建失败" : "声纹创建中" });
    } catch (error) {
        const status = error instanceof DramaVoiceCreationError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "声纹状态同步失败" }, { status });
    }
}
