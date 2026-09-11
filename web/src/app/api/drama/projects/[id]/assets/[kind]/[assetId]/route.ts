import { NextResponse } from "next/server";

import { readJsonBodyResult } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { DramaProjectServiceError, getDramaProjectForUser, updateDramaAssetForUser } from "@/lib/server/drama-project-service";
import { queryStoredGenerationTasks } from "@/lib/server/generation-task-store";
import type { ImageTask } from "@/lib/server/image-task-store";

type Context = { params: Promise<{ id: string; kind: string; assetId: string }> };

export async function GET(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const { id, kind, assetId } = await context.params;
        if (kind !== "characters" && kind !== "scenes" && kind !== "props") return NextResponse.json({ code: 400, data: null, msg: "当前资产类型不支持生图" }, { status: 400 });
        const project = await getDramaProjectForUser(user.id, id);
        if (!project[kind].some((asset) => asset.id === assetId)) return NextResponse.json({ code: 404, data: null, msg: "项目资产不存在，请刷新后重试" }, { status: 404 });
        const tasks = await queryStoredGenerationTasks<ImageTask>("image", {
            userId: user.id,
            projectId: id,
            surface: "drama",
            assetKind: kind,
            assetId,
            statuses: ["pending", "running"],
            limit: 1,
        });
        const task = tasks[0];
        return NextResponse.json({
            code: 0,
            data: {
                task: task
                    ? {
                          id: task.id,
                          kind: task.kind,
                          model: task.config.model,
                          status: task.status,
                          prompt: task.prompt,
                          generationStage: task.generationStage,
                      }
                    : null,
            },
            msg: "资产生成状态已读取",
        });
    } catch (error) {
        const status = error instanceof DramaProjectServiceError ? error.status : 500;
        return NextResponse.json({ code: status, data: null, msg: error instanceof Error ? error.message : "资产生成状态读取失败" }, { status });
    }
}

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
