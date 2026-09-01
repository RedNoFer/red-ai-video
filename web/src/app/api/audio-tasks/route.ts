import { after, NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings, isAuthInputError } from "@/lib/auth/store";
import { mediaTaskSource } from "@/lib/media-management-contract";
import { resolveAudioTaskOptions } from "@/lib/server/audio-task-config";
import { createAudioTask, type AudioTask, type AudioTaskConfig } from "@/lib/server/audio-task-store";
import { generationModelId, toSystemGenerationChannel } from "@/lib/server/generation-channel";
import { runGenerationTaskRecoveryBatch } from "@/lib/server/generation-task-recovery-service";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";
import { getStoredGenerationTaskByRequest, linkStoredGenerationTask, withGenerationConcurrencyLimit, type GenerationTaskContext } from "@/lib/server/generation-task-store";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { resolveAudioLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { checkGenerationRateLimit, rateLimitHeaders } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 2400;

export async function POST(request: Request) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    const rate = await checkGenerationRateLimit(user.id, request, "audio");
    if (!rate.allowed) return NextResponse.json({ error: "音频生成请求过于频繁，请稍后重试" }, { status: 429, headers: rateLimitHeaders(rate) });
    const settings = await getAuthSettings();
    const response = await withGenerationConcurrencyLimit(user.id, "audio", 10 * 60 * 1000, settings.generationConcurrency.audio, async () => {
        let body: { config?: AudioTaskConfig; prompt?: string; source?: string; preferredChannelId?: string; context?: GenerationTaskContext };
        try {
            body = await readJsonBody(request);
        } catch (error) {
            if (isAuthInputError(error)) return NextResponse.json({ error: error.message }, { status: error.status });
            throw error;
        }
        const requestedModelId = body.config?.model || settings.defaultModels.audioModel;
        const resolvedChannels = resolveAudioLogicalModelCandidates(settings, requestedModelId, body.preferredChannelId || "");
        const channels = resolvedChannels.map((resolved) => ({ ...toSystemGenerationChannel(resolved), channelId: resolved.channelId }));
        const prompt = String(body.prompt || "").trim();
        const supportedChannels = channels.filter((channel) => channel.apiFormat !== "gemini");
        if (!prompt) return NextResponse.json({ error: "音频任务参数不完整或渠道不支持" }, { status: 400 });
        if (!supportedChannels.length) {
            const requestedLogicalModel = settings.logicalModels.find((model) => model.enabled && model.capability === "audio" && model.id.toLowerCase() === requestedModelId.trim().toLowerCase());
            if (requestedLogicalModel) return NextResponse.json({ error: "后台默认音频模型不可解析，请先在模型渠道里设置可用的音频逻辑模型" }, { status: 400 });
            if (settings.logicalModels.length) return NextResponse.json({ error: "当前供应商没有可用的真实音频模型；请先在模型渠道中同步并启用音频输出模型，再配置为音频能力" }, { status: 400 });
            return NextResponse.json({ error: body.preferredChannelId ? "当前角色绑定的音频渠道已失效，且没有可用的备用音频渠道" : "音频任务参数不完整或渠道不支持" }, { status: 400 });
        }
        const configs: AudioTaskConfig[] = supportedChannels.map((channel) => ({ ...channel, ...resolveAudioTaskOptions(body.config, settings.generationDefaults), instructions: clean(body.config?.instructions, 2_000) }));
        const requestId = body.context?.clientRequestId?.trim();
        if (requestId) {
            const existing = await getStoredGenerationTaskByRequest<AudioTask>("audio", user.id, requestId, body.context?.attemptNo);
            if (existing) return NextResponse.json({ task: publicTask(existing) });
        }
        const task = await createAudioTask({ ...(body.context || {}), userId: user.id, config: configs[0], candidateConfigs: configs.slice(1), prompt: prompt.slice(0, 20_000), source: mediaTaskSource(body.source, body.context, "audio-task") });
        await linkStoredGenerationTask("audio", task.id, body.context || {});
        const origin = resolveInternalOrigin(new URL(request.url).origin);
        const cookie = request.headers.get("cookie") || "";
        await scheduleGenerationTask("audio", task.id, { executionPhase: "created", channelId: task.config.channelId, provider: task.config.advancedConfig?.protocol || task.config.apiFormat, nextPollAt: Date.now(), lastUpstreamStatus: "created" });
        after(() => runGenerationTaskRecoveryBatch({ origin, cookie, limit: 1, taskIds: [task.id] }));
        return NextResponse.json({ task: publicTask(task) });
    });
    return response || NextResponse.json({ error: "当前用户音频任务已达到并发上限" }, { status: 429 });
}

function publicTask(task: AudioTask) {
    return { id: task.id, status: task.status, channelId: task.config.channelId, model: generationModelId(task.config), result: task.result, error: task.error };
}

function clean(value: unknown, max: number) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}
