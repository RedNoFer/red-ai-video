import { createHash } from "node:crypto";

import { getAuthSettings } from "@/lib/auth/store";
import { normalizeDramaVoiceProfile } from "@/lib/drama-voice";
import type { DramaCharacter, DramaProject, DramaVoiceCreationMode, DramaVoiceProfile } from "@/lib/drama-project-contract";
import { resolveChannelCapabilityConfig } from "@/lib/channel-protocol-registry";
import { createAudioTask, getAudioTask, type AudioTask, type AudioTaskConfig } from "@/lib/server/audio-task-store";
import { toSystemGenerationChannel } from "@/lib/server/generation-channel";
import { getStoredGenerationTaskByRequest, linkStoredGenerationTask } from "@/lib/server/generation-task-store";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";
import { resolveAudioLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { createSignedReferenceAssetUrl } from "@/lib/server/reference-asset-access";
import { readReferenceAsset } from "@/lib/server/reference-asset-store";

import { getDramaProjectForUser, updateDramaProjectForUser } from "./drama-project-service";

export class DramaVoiceCreationError extends Error {
    constructor(message: string, readonly status = 400) {
        super(message);
    }
}

type CreationInput = {
    userId: string;
    project: DramaProject;
    character: DramaCharacter;
    mode: DramaVoiceCreationMode;
    designPrompt?: string;
    sampleAssetId?: string;
    requestId: string;
    origin: string;
    confirmReplace?: boolean;
};

export function defaultDramaVoiceDesignPrompt(character: DramaCharacter) {
    const description = [character.description, character.profile?.visualIdentity, character.profile?.styling].filter(Boolean).join("；").slice(0, 1_200);
    return `为角色“${character.name}”设计独立、可长期复用的中文影视配音声纹。角色设定：${description || "根据角色名称设计自然且有辨识度的声音"}。要求贴合角色年龄与身份，避免播音腔和旁白感；给出自然说话的音色、音高、节奏、情绪张力与咬字特征。`;
}

export async function createDramaVoiceCreationTask(input: CreationInput) {
    const existing = normalizeDramaVoiceProfile(input.character.voiceProfile);
    const activeTask = existing.creationTaskId ? await getAudioTask(existing.creationTaskId) : undefined;
    if (activeTask && (activeTask.status === "pending" || activeTask.status === "running")) {
        const creationStatus = activeTask.status === "running" ? "running" : "queued";
        return { task: activeTask, project: input.project, voiceProfile: { ...existing, creationStatus, creationError: "" }, cached: true };
    }
    if (existing.voiceId && !input.confirmReplace) throw new DramaVoiceCreationError("角色已有声纹，确认替换后才会创建新的声纹", 409);
    const requestId = clean(input.requestId, 160);
    if (!requestId) throw new DramaVoiceCreationError("缺少稳定请求 ID");
    const mode = input.mode === "clone" ? "clone" : "design";
    const prompt = cleanLong(input.designPrompt || existing.designPrompt || defaultDramaVoiceDesignPrompt(input.character), 2_000);
    if (mode === "design" && !prompt) throw new DramaVoiceCreationError("请输入声音设计提示词");

    const settings = await getAuthSettings();
    const resolved = resolveVoiceCreationCandidate(settings, mode);
    if (!resolved) throw new DramaVoiceCreationError(mode === "clone" ? "当前供应商没有已完整配置的 Voice Clone 操作" : "当前供应商没有可用的 Voice Design 模型；请在模型渠道同步并启用 voice-design", 409);
    const operation = resolveChannelCapabilityConfig(resolved.channel.advancedConfig, resolved.upstreamModel, "audio");
    if (!operation) throw new DramaVoiceCreationError("声纹创建模型缺少协议配置", 409);

    let sampleAssetId = "";
    let cloneSampleUrl = "";
    if (mode === "clone") {
        sampleAssetId = clean(input.sampleAssetId, 300);
        if (!sampleAssetId) throw new DramaVoiceCreationError("请先上传音频样本");
        if (!operation.cloneSampleField || !hasCloneSampleTemplate(operation.requestTemplate)) throw new DramaVoiceCreationError("当前 Voice Clone 未配置完整的样本音频请求模板", 409);
        const sample = await readReferenceAsset(sampleAssetId);
        if (!sample || !sample.mimeType.startsWith("audio/") || sample.size <= 0 || sample.size > 20 * 1024 * 1024 || sample.registration?.ownerUserId !== input.userId) throw new DramaVoiceCreationError("Clone 音频样本无效、超出 20MB 或不属于当前用户");
        cloneSampleUrl = createSignedReferenceAssetUrl(sampleAssetId, input.origin);
        if (!cloneSampleUrl) throw new DramaVoiceCreationError("Clone 样本需要公网可访问的签名地址，请配置站点签名密钥", 409);
    }

    const fingerprint = hash([mode, prompt, sampleAssetId, resolved.logicalModelId, resolved.channelId, resolved.upstreamModel].join("|"));
    const clientRequestId = `drama-voice-create:${input.project.id}:${input.character.id}:${requestId}`;
    const cached = await getStoredGenerationTaskByRequest<AudioTask>("audio", input.userId, clientRequestId);
    const task = cached ||
        (await createAudioTask({
            userId: input.userId,
            projectId: input.project.id,
            surface: "drama",
            clientRequestId,
            config: {
                ...toSystemGenerationChannel(resolved),
                voiceOperation: mode === "clone" ? "voice-clone" : "voice-design",
                designPrompt: prompt,
                cloneSampleUrl,
                format: "mp3",
            } satisfies AudioTaskConfig,
            candidateConfigs: [],
            prompt: `角色 ${input.character.name} 的${mode === "clone" ? "音色克隆" : "新声纹设计"}`,
            source: "drama-voice-creation",
            voiceCreation: { projectId: input.project.id, characterId: input.character.id, fingerprint },
        }));
    if (!cached) {
        await linkStoredGenerationTask("audio", task.id, { projectId: input.project.id, surface: "drama", clientRequestId });
        await scheduleGenerationTask("audio", task.id, { executionPhase: "created", channelId: task.config.channelId, provider: task.config.advancedConfig?.protocol || task.config.apiFormat, nextPollAt: Date.now(), lastUpstreamStatus: "created" });
    }
    const profile: DramaVoiceProfile = {
        ...existing,
        creationMode: mode,
        designPrompt: prompt,
        creationTaskId: task.id,
        creationStatus: task.status === "success" ? "success" : task.status === "error" ? "error" : task.status === "running" ? "running" : "queued",
        creationSampleAssetId: sampleAssetId,
        creationFingerprint: fingerprint,
        creationError: task.error || "",
        logicalModelId: resolved.logicalModelId,
        channelId: resolved.channelId,
        model: resolved.upstreamModel,
    };
    const nextProject = await updateDramaProjectForUser(input.userId, input.project.id, {
        ...input.project,
        characters: input.project.characters.map((item) => (item.id === input.character.id ? { ...item, voiceProfile: profile } : item)),
    });
    const completed = task.status === "success" ? await applyDramaVoiceCreationTask(task) : null;
    return { task, project: completed || nextProject, voiceProfile: (completed || nextProject).characters.find((item) => item.id === input.character.id)?.voiceProfile || profile, cached: Boolean(cached) };
}

export async function applyDramaVoiceCreationTask(task: AudioTask) {
    const context = task.voiceCreation;
    const voiceId = clean(task.result?.voiceId, 300);
    const previewAudioUrl = cleanLong(task.result?.url, 2_000);
    if (!context || task.status !== "success" || !voiceId || !previewAudioUrl) return null;
    const project = await getDramaProjectForUser(task.userId, context.projectId);
    const character = project.characters.find((item) => item.id === context.characterId);
    if (!character) return null;
    const profile = normalizeDramaVoiceProfile(character.voiceProfile);
    if (profile.creationTaskId !== task.id || profile.creationFingerprint !== context.fingerprint) return null;
    const nextProfile: DramaVoiceProfile = {
        ...profile,
        identityType: "custom",
        provider: task.config.advancedConfig?.protocol || "configured",
        model: task.config.model,
        logicalModelId: task.config.logicalModel || profile.logicalModelId,
        channelId: task.config.channelId || profile.channelId,
        voiceId,
        status: "assigned",
        assignedAt: new Date().toISOString(),
        assignmentSource: "auto",
        creationStatus: "success",
        creationError: "",
        previewStatus: "success",
        previewTaskId: task.id,
        previewAudioUrl,
        sampleAssetId: task.result?.assetId || profile.sampleAssetId,
        previewError: "",
    };
    try {
        return await updateDramaProjectForUser(task.userId, project.id, {
            ...project,
            characters: project.characters.map((item) => (item.id === character.id ? { ...item, voiceProfile: nextProfile } : item)),
        });
    } catch (error) {
        // A duplicate provider response must never overwrite an existing role voice.
        if (error instanceof Error) console.warn("Drama voice creation writeback skipped", { taskId: task.id, error: error.message });
        return null;
    }
}

export async function syncDramaVoiceCreationTask(userId: string, projectId: string, characterId: string) {
    const project = await getDramaProjectForUser(userId, projectId);
    const character = project.characters.find((item) => item.id === characterId);
    if (!character) throw new DramaVoiceCreationError("角色不存在", 404);
    const profile = normalizeDramaVoiceProfile(character.voiceProfile);
    if (!profile.creationTaskId) return { project, voiceProfile: profile, task: undefined };
    const task = await getAudioTask(profile.creationTaskId);
    if (!task || task.userId !== userId) return { project, voiceProfile: { ...profile, creationStatus: "error" as const, creationError: "声纹创建任务不存在" }, task: undefined };
    const nextProject = task.status === "success" ? (await applyDramaVoiceCreationTask(task)) || project : task.status === "error" ? await updateDramaProjectForUser(userId, project.id, { ...project, characters: project.characters.map((item) => (item.id === character.id ? { ...item, voiceProfile: { ...profile, creationStatus: "error", creationError: task.error || "声纹创建失败" } } : item)) }) : project;
    return { project: nextProject, voiceProfile: nextProject.characters.find((item) => item.id === character.id)?.voiceProfile || profile, task };
}

function resolveVoiceCreationCandidate(settings: Awaited<ReturnType<typeof getAuthSettings>>, mode: DramaVoiceCreationMode) {
    const preferred = mode === "clone" ? settings.defaultModels.voiceCloneModel : settings.defaultModels.voiceDesignModel;
    const ids = Array.from(new Set([preferred, ...settings.logicalModels.filter((item) => item.enabled && item.capability === "audio").map((item) => item.id)].filter((value): value is string => Boolean(value))));
    for (const id of ids) {
        const match = resolveAudioLogicalModelCandidates(settings, id).find((candidate) => resolveChannelCapabilityConfig(candidate.channel.advancedConfig, candidate.upstreamModel, "audio")?.audioOperation === (mode === "clone" ? "voice-clone" : "voice-design"));
        if (match) return match;
    }
    return null;
}

function hasCloneSampleTemplate(template?: string) {
    return /\{\{\s*(?:clone_sample_url|sample_audio_url|sample_url)\s*\}\}/i.test(template || "");
}
function hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
}
function clean(value: unknown, max = 160) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function cleanLong(value: unknown, max: number) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}
