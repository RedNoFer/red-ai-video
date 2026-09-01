import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { normalizeDramaVoiceProfile } from "@/lib/drama-voice";
import { defaultDramaVoiceDesignPrompt } from "@/lib/server/drama-voice-creation";
import { planDramaVoice } from "@/lib/server/drama-voice-planning";
import { getDramaProjectForUser, updateDramaProjectForUser } from "@/lib/server/drama-project-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

/** @deprecated 保留旧地址，只规划可编辑提示词；创建声纹必须调用 voice-creation 并确认替换。 */
export async function POST(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const { id, assetId } = await context.params;
        const project = await getDramaProjectForUser(user.id, id);
        const character = project.characters.find((item) => item.id === assetId);
        if (!character) return NextResponse.json({ code: 404, data: null, msg: "角色不存在" }, { status: 404 });
        const existing = normalizeDramaVoiceProfile(character.voiceProfile);
        let planned = { blueprint: existing.blueprint, instructions: existing.instructions, designPrompt: existing.designPrompt || defaultDramaVoiceDesignPrompt(character) };
        let warning = "";
        try {
            const generated = await planDramaVoice({
                origin: resolveInternalOrigin(new URL(request.url).origin),
                cookie: request.headers.get("cookie") || "",
                character,
                occupiedVoiceIds: project.characters.filter((item) => item.id !== assetId).map((item) => item.voiceProfile?.voiceId || "").filter(Boolean),
                requestId: crypto.randomUUID(),
            });
            planned = { ...planned, ...generated, designPrompt: generated.designPrompt || planned.designPrompt };
        } catch (error) {
            warning = `文本规划不可用，已按角色资料生成默认声音提示词${error instanceof Error && error.message ? `：${error.message}` : ""}`;
        }
        const voiceProfile = { ...existing, ...planned, creationMode: "design" as const, creationStatus: existing.creationStatus === "success" ? "success" as const : "idle" as const };
        const nextProject = await updateDramaProjectForUser(user.id, id, { ...project, characters: project.characters.map((item) => (item.id === assetId ? { ...item, voiceProfile } : item)) });
        return NextResponse.json({ code: 0, data: { project: nextProject, voiceProfile: nextProject.characters.find((item) => item.id === assetId)?.voiceProfile, warning }, msg: warning || "声音设计提示词已生成" });
    } catch (error) {
        return NextResponse.json({ code: 500, data: null, msg: error instanceof Error ? error.message : "声音提示词生成失败" }, { status: 500 });
    }
}
