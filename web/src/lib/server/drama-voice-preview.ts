import { createHash } from "node:crypto";

import { getAuthSettings } from "@/lib/auth/store";
import { resolveChannelCapabilityConfig } from "@/lib/channel-protocol-registry";
import type { DramaCharacter, DramaProject } from "@/lib/drama-project-contract";
import { getAudioTask } from "@/lib/server/audio-task-store";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { resolveAudioLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";

const FALLBACK_TEXT = "你好，这是角色试听。";

export async function submitDramaVoicePreview(input: { origin: string; cookie: string; project: DramaProject; character: DramaCharacter }) {
    const settings = await getAuthSettings();
    const profile = input.character.voiceProfile;
    if (!profile?.voiceId) throw new Error("请先完成角色音色维护");
    const resolvedAudio = resolvePreviewTtsCandidate(settings, profile);
    if (!resolvedAudio)
        throw new Error("当前没有可用的普通 TTS 音频模型。Voice Design 只创建 voice_id；请在同一供应商渠道同步并启用支持该 voice_id 的 TTS 模型，再将其设为默认音频模型。");
    const logicalModelId = resolvedAudio.logicalModelId;
    const channelId = resolvedAudio.channelId;

    const previewText = firstDialogue(input.project, input.character.id, input.character.name);
    const fingerprint = hash([logicalModelId, profile.voiceId, channelId, profile.instructions, profile.speed, profile.blueprintVersion, previewText].join("|"));
    if (profile.previewStatus === "success" && profile.previewFingerprint === fingerprint && profile.previewAudioUrl) return { profile, task: undefined, cached: true };

    if (profile.previewTaskId) {
        const task = await getAudioTask(profile.previewTaskId);
        if (task && (task.status === "pending" || task.status === "running") && task.executionPhase !== "needs_review")
            return { profile: { ...profile, previewStatus: task.status === "running" ? "running" : "queued", previewAudioUrl: "" }, task, cached: true };
    }

    const origin = resolveInternalOrigin(input.origin);
    const retryIdentity = profile.previewTaskId ? `:retry:${profile.previewTaskId}` : "";
    const response = await fetch(`${origin}/api/audio-tasks`, {
        method: "POST",
        headers: { cookie: input.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: previewText,
            ...(channelId ? { preferredChannelId: channelId } : {}),
            config: { model: logicalModelId, voice: profile.voiceId, speed: String(profile.speed), instructions: profile.instructions },
            source: "drama-voice-preview",
            context: { clientRequestId: `drama-voice-preview:${input.project.id}:${input.character.id}:${fingerprint}${retryIdentity}`, projectId: input.project.id, characterId: input.character.id },
        }),
    });
    const payload = (await response.json().catch(() => ({}))) as { task?: { id: string; status?: string; channelId?: string; result?: { url?: string; assetId?: string } }; error?: string };
    if (!response.ok || !payload.task?.id) throw new Error(payload.error || "试听任务创建失败");
    return {
        profile: {
            ...profile,
            previewLogicalModelId: logicalModelId,
            previewChannelId: payload.task.channelId || channelId,
            previewStatus: payload.task.result?.url ? ("success" as const) : ("queued" as const),
            previewTaskId: payload.task.id,
            previewText,
            previewFingerprint: fingerprint,
            previewAudioUrl: payload.task.result?.url || "",
            sampleAssetId: payload.task.result?.assetId || profile.sampleAssetId,
            previewError: "",
        },
        task: payload.task,
        cached: false,
    };
}

export async function syncDramaVoicePreview(input: { project: DramaProject; character: DramaCharacter }) {
    const profile = input.character.voiceProfile;
    if (!profile?.previewTaskId) return { profile, task: undefined, message: "暂无试听任务" };
    const task = await getAudioTask(profile.previewTaskId);
    const missingQueryContract = task?.config.advancedConfig?.protocol === "openai-audio-dialogue" && Boolean(task.upstream?.id) && !task.config.advancedConfig.queryPath?.trim();
    const reviewReason = task?.reviewReason || (missingQueryContract && task.lastUpstreamStatus?.startsWith("query_error") ? "Chat/Responses 音频接口只返回了任务 ID，未返回可播放音频；请检查供应商是否支持同步音频输出" : "");
    if (task && reviewReason) {
        if (task.executionPhase !== "needs_review") {
            await scheduleGenerationTask("audio", task.id, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "query_contract_missing", resultPayload: { reviewReason } });
        }
        const nextProfile = { ...profile, previewStatus: "error" as const, previewAudioUrl: "", previewError: reviewReason };
        return { profile: nextProfile, task, message: `试听失败：${reviewReason}` };
    }
    if (!task || task.status === "pending" || task.status === "running")
        return { profile: { ...profile, previewChannelId: task?.config.channelId || profile.previewChannelId, previewStatus: task?.status === "running" ? ("running" as const) : ("queued" as const) }, task, message: "试听生成中" };
    const nextProfile =
        task.status === "success" && task.result?.url
            ? { ...profile, previewChannelId: task.config.channelId || profile.previewChannelId, previewStatus: "success" as const, previewAudioUrl: task.result.url, sampleAssetId: task.result.assetId || profile.sampleAssetId, previewError: "" }
            : { ...profile, previewChannelId: task.config.channelId || profile.previewChannelId, previewStatus: "error" as const, previewError: task.error || "试听生成失败" };
    return { profile: nextProfile, task, message: task.status === "success" ? "试听已完成" : nextProfile.previewError };
}

function resolvePreviewTtsCandidate(settings: Awaited<ReturnType<typeof getAuthSettings>>, profile: NonNullable<DramaCharacter["voiceProfile"]>) {
    const preferredChannelId = profile.previewChannelId || profile.channelId || "";
    const modelIds = Array.from(new Set([profile.previewLogicalModelId, settings.defaultModels.audioModel, ...settings.logicalModels.filter((model) => model.enabled && model.capability === "audio").map((model) => model.id)].filter((value): value is string => Boolean(value))));
    const candidates = modelIds
        .flatMap((modelId) => resolveAudioLogicalModelCandidates(settings, modelId, preferredChannelId))
        .filter((candidate, index, all) => all.findIndex((item) => `${item.logicalModelId}:${item.channelId}:${item.upstreamModel}` === `${candidate.logicalModelId}:${candidate.channelId}:${candidate.upstreamModel}`) === index)
        .filter((candidate) => !["voice-design", "voice-clone"].includes(resolveChannelCapabilityConfig(candidate.channel.advancedConfig, candidate.upstreamModel, "audio")?.audioOperation || ""));
    return candidates.find((candidate) => candidate.channelId === profile.channelId) || candidates[0];
}

function firstDialogue(project: DramaProject, characterId: string, name: string) {
    const normalized = name.trim().toLocaleLowerCase();
    for (const episode of project.episodes)
        for (const shot of [...episode.shots].sort((a, b) => a.order - b.order))
            for (const utterance of [...shot.utterances].sort((a, b) => a.order - b.order))
                if (utterance.type === "dialogue" && (utterance.characterId === characterId || (!utterance.characterId && utterance.speaker.trim().toLocaleLowerCase() === normalized)) && utterance.text.trim()) return utterance.text.trim();
    return FALLBACK_TEXT;
}

function hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
}
