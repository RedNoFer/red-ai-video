import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDramaProjectForUser, updateDramaProjectForUser } from "@/lib/server/drama-project-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { submitDramaVoicePreview, syncDramaVoicePreview } from "@/lib/server/drama-voice-preview";

export async function POST(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
    return retry(request, context);
}

export async function GET(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
    return sync(request, context);
}

async function sync(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const { id, assetId } = await context.params;
        const project = await getDramaProjectForUser(user.id, id);
        const character = project.characters.find((item) => item.id === assetId);
        if (!character) return NextResponse.json({ code: 404, data: null, msg: "角色不存在" }, { status: 404 });
        const synced = await syncDramaVoicePreview({ project, character });
        if (!synced.task) return NextResponse.json({ code: 409, data: { project, voiceProfile: synced.profile }, msg: "请先点击智能维护音色生成试听任务" }, { status: 409 });
        const nextProject = await updateDramaProjectForUser(user.id, id, {
            ...project,
            characters: project.characters.map((item) => (item.id === assetId ? { ...item, voiceProfile: synced.profile } : item)),
        });
        const message = synced.profile?.previewStatus === "error" ? `试听失败：${synced.profile.previewError || "上游未返回可播放音频"}` : synced.message;
        return NextResponse.json({ code: 0, data: { project: nextProject, voiceProfile: synced.profile, task: synced.task }, msg: message });
    } catch (error) {
        return NextResponse.json({ code: 500, data: null, msg: error instanceof Error ? error.message : "试听状态同步失败" }, { status: 500 });
    }
}

async function retry(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const { id, assetId } = await context.params;
        const project = await getDramaProjectForUser(user.id, id);
        const character = project.characters.find((item) => item.id === assetId);
        if (!character) return NextResponse.json({ code: 404, data: null, msg: "角色不存在" }, { status: 404 });
        const submitted = await submitDramaVoicePreview({
            origin: resolveInternalOrigin(new URL(request.url).origin),
            cookie: request.headers.get("cookie") || "",
            project,
            character,
        });
        const nextProject = await updateDramaProjectForUser(user.id, id, {
            ...project,
            characters: project.characters.map((item) => (item.id === assetId ? { ...item, voiceProfile: submitted.profile } : item)),
        });
        const message = submitted.profile.previewAudioUrl ? "试听已完成" : submitted.cached ? "试听音频已就绪" : "试听任务已重新提交";
        return NextResponse.json({ code: 0, data: { project: nextProject, voiceProfile: submitted.profile, task: submitted.task, cached: submitted.cached }, msg: message });
    } catch (error) {
        return NextResponse.json({ code: 500, data: null, msg: error instanceof Error ? error.message : "试听任务提交失败" }, { status: 500 });
    }
}
