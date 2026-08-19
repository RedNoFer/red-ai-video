import { nanoid } from "nanoid";

import { getAuthSettings } from "@/lib/auth/store";
import type { CanvasProject } from "@/lib/canvas-project-contract";
import { applyDramaCanvasMediaField, buildDramaEpisodeCanvasTitle, dramaEpisodeCanvasHandoffId, mergeDramaEpisodeCanvasProject, type DramaCanvasMediaField } from "@/lib/drama-canvas-bridge";
import type { CreateDramaProjectInput, DramaAssetProfile, DramaAssetReference, DramaContinuityEdge, DramaContinuityState, DramaEpisode, DramaFieldOrigin, DramaNamedAsset, DramaProductionArchive, DramaProductionBible, DramaProductionRun, DramaProject, DramaShot, DramaShotContinuity, DramaStoryScene, DramaUtterance, DramaVideoMode } from "@/lib/drama-project-contract";
import { dramaRichContentToPlainText, normalizeDramaScriptRichContent } from "@/lib/drama-script-rich-content";
import { normalizeDramaImageSize } from "@/lib/drama-image-size";
import { resolveDramaShotDuration } from "@/lib/server/drama-shot-config";
import { listAgentRuns } from "@/lib/server/agent-run-store";
import { CreativeEntityDeletionConflict, deleteDramaConversationAggregate } from "@/lib/server/creative-entity-deletion-store";
import { createCreativeConversation, getCreativeConversation, listCreativeConversations, updateCreativeConversation } from "@/lib/server/creative-runtime-store";
import { createDramaProject, deleteDramaProject, DramaProjectStoreError, findDramaProjectBySourceHandoffId, getDramaProject, listDramaProjectSummaries, updateDramaProject } from "@/lib/server/drama-project-store";
import { createDramaProjectVersion, getDramaProjectVersion, listDramaProjectVersions } from "@/lib/server/drama-project-version-store";
import { collectLocalMediaStorageKeys } from "@/lib/server/local-media-references";
import { deleteUserLocalMediaAssets } from "@/lib/server/local-media-storage";
import { applyDramaProductionPackage, DramaProductionPackageError, previewDramaProductionPackage } from "@/lib/server/drama-production-package";
import { buildDramaProductionRun, unlockDramaProductionSteps } from "@/lib/server/drama-production-run";
import { createDramaProductionRun, findLatestDramaProductionRun, getDramaProductionRun, updateDramaProductionRun } from "@/lib/server/drama-production-run-store";
import { createCanvasProjectForUser, getCanvasProjectForUser, updateCanvasProjectForUser } from "@/lib/server/canvas-project-service";

const MAX_PROJECT_BYTES = 2 * 1024 * 1024;

export class DramaProjectServiceError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

export function listDramaProjectSummariesForUser(userId: string, input: { page?: number; pageSize?: number } = {}) {
    return listDramaProjectSummaries(userId, input);
}

export async function getDramaProjectForUser(userId: string, id: string) {
    const project = await getDramaProject(cleanText(id), userId);
    if (!project) throw new DramaProjectServiceError("短剧项目不存在", 404);
    return project;
}

export async function createDramaProjectForUser(userId: string, value: unknown) {
    const input = normalizeCreateInput(value);
    const now = new Date().toISOString();
    if (input.sourceHandoffId) {
        const existing = await findDramaProjectBySourceHandoffId(userId, input.sourceHandoffId);
        if (existing) return existing;
    }
    const projectId = input.sourceHandoffId ? `drama-${input.sourceHandoffId}` : `drama-${nanoid()}`;
    const episode: DramaEpisode = {
        id: `episode-${nanoid()}`,
        title: "第 1 集",
        script: input.initialScript,
        outline: "",
        hook: "",
        nextPreview: "",
        sourceRange: "",
        reviewStatus: "draft",
        shots: [],
    };
    const conversation = await createCreativeConversation(userId, { surface: "drama", projectId, title: input.title });
    const project: DramaProject = {
        id: projectId,
        sourceHandoffId: input.sourceHandoffId,
        title: input.title,
        summary: input.summary,
        style: input.style,
        ratio: input.ratio,
        status: "active",
        creativeConversationId: conversation.id,
        activeEpisodeId: episode.id,
        characters: [],
        scenes: [],
        props: [],
        clues: [],
        defaultVideoMode: input.defaultVideoMode,
        episodes: [episode],
        sourceAssets: input.sourceAssets,
        createdAt: now,
        updatedAt: now,
    };
    try {
        return await createDramaProject(userId, project);
    } catch (error) {
        await updateCreativeConversation(conversation.id, userId, { status: "archived" }).catch(() => null);
        throw error;
    }
}

export async function updateDramaProjectForUser(userId: string, id: string, value: unknown) {
    const current = await getDramaProjectForUser(userId, id);
    const size = Buffer.byteLength(JSON.stringify(value || {}));
    if (size > MAX_PROJECT_BYTES) throw new DramaProjectServiceError("短剧项目数据过大", 413);
    const incomingUpdatedAt = parseTimestamp(object(value).updatedAt);
    if (incomingUpdatedAt && incomingUpdatedAt < parseTimestamp(current.updatedAt)) return current;
    const project = normalizeProject(value, current);
    if (incomingUpdatedAt) project.updatedAt = new Date(incomingUpdatedAt).toISOString();
    try {
        return await updateDramaProject(userId, project, current.updatedAt);
    } catch (error) {
        if (error instanceof DramaProjectStoreError) throw new DramaProjectServiceError(error.message, error.status);
        throw error;
    }
}

export function previewDramaProductionPackageForUser(value: unknown) {
    const input = object(value);
    const source = cleanText(input.source);
    const fileName = cleanText(input.fileName) || "production-package.md";
    try {
        return previewDramaProductionPackage(source, fileName);
    } catch (error) {
        if (error instanceof DramaProductionPackageError) throw new DramaProjectServiceError(error.message, 400);
        throw error;
    }
}

export async function applyDramaProductionPackageForUser(userId: string, id: string, value: unknown) {
    const input = object(value);
    const current = await getDramaProjectForUser(userId, id);
    const expectedUpdatedAt = cleanText(input.expectedUpdatedAt);
    if (!expectedUpdatedAt || expectedUpdatedAt !== current.updatedAt) throw new DramaProjectServiceError("短剧项目已更新，请重新预览制作包", 409);
    const preview = previewDramaProductionPackageForUser(input);
    if (cleanText(input.sourceHash) !== preview.sourceHash) throw new DramaProjectServiceError("制作包内容已变化，请重新预览", 409);
    const project = applyDramaProductionPackage(current, preview.package, preview.sourceHash, cleanText(input.source), cleanText(input.fileName) || "production-package.md");
    project.updatedAt = nextTimestamp(current.updatedAt);
    await createDramaProjectVersion(userId, current.id, "完整制作包导入前", current);
    try {
        return await updateDramaProject(userId, normalizeProject(project, current), current.updatedAt);
    } catch (error) {
        if (error instanceof DramaProjectStoreError) throw new DramaProjectServiceError(error.message, error.status);
        throw error;
    }
}

export async function createDramaProductionRunForUser(userId: string, projectId: string, value: unknown) {
    const project = await getDramaProjectForUser(userId, projectId);
    const episodeId = cleanText(object(value).episodeId);
    const episode = project.episodes.find((item) => item.id === episodeId);
    if (!episode) throw new DramaProjectServiceError("短剧剧集不存在", 404);
    if (episode.reviewStatus !== "visual_ready") throw new DramaProjectServiceError("请先完成内容审核和视觉方案", 409);
    const settings = await getAuthSettings();
    const parameters = {
        imageModel: settings.defaultModels.imageModel,
        videoModel: settings.defaultModels.videoModel,
        audioModel: settings.defaultModels.audioModel || undefined,
        imageQuality: settings.generationDefaults.imageQuality,
        videoQuality: settings.generationDefaults.videoQuality,
    };
    if (!parameters.imageModel || !parameters.videoModel) throw new DramaProjectServiceError("后台尚未配置可用的图片和视频逻辑模型", 409);
    const run = buildDramaProductionRun(project, episode, parameters);
    const latest = await findLatestDramaProductionRun(userId, project.id, episode.id);
    if (latest?.planRevision === run.planRevision && !["cancelled", "failed"].includes(latest.status)) return latest;
    return createDramaProductionRun(userId, run);
}

export async function getLatestDramaProductionRunForUser(userId: string, projectId: string, episodeId: string) {
    await getDramaProjectForUser(userId, projectId);
    return findLatestDramaProductionRun(userId, projectId, cleanText(episodeId));
}

export async function updateDramaProductionRunForUser(userId: string, projectId: string, runId: string, value: unknown) {
    await getDramaProjectForUser(userId, projectId);
    const run = await getDramaProductionRun(userId, projectId, cleanText(runId));
    if (!run) throw new DramaProjectServiceError("生产运行不存在", 404);
    const action = cleanText(object(value).action);
    let next: DramaProductionRun;
    if (action === "cancel") {
        next = { ...run, status: "cancelled", steps: run.steps.map((step) => (["success", "cancelled"].includes(step.status) ? step : { ...step, status: "cancelled" })), updatedAt: new Date().toISOString() };
    } else if (action === "retry") {
        const stepIds = new Set(ids(object(value).stepIds));
        next = unlockDramaProductionSteps({ ...run, status: "ready", steps: run.steps.map((step) => (stepIds.has(step.id) && ["failed", "needs_review", "stale"].includes(step.status) ? { ...step, status: step.dependsOn.length ? "blocked" : "ready", taskId: undefined, error: undefined, outputUrls: undefined } : step)), updatedAt: new Date().toISOString() });
    } else {
        throw new DramaProjectServiceError("不支持的生产运行操作", 400);
    }
    const saved = await updateDramaProductionRun(userId, next);
    if (!saved) throw new DramaProjectServiceError("生产运行不存在", 404);
    return saved;
}

export async function ensureDramaEpisodeCanvasForUser(userId: string, projectId: string, episodeIdValue: string) {
    const project = await getDramaProjectForUser(userId, projectId);
    const episodeId = cleanText(episodeIdValue);
    const episode = project.episodes.find((item) => item.id === episodeId);
    if (!episode) throw new DramaProjectServiceError("短剧剧集不存在", 404);
    const sourceHandoffId = dramaEpisodeCanvasHandoffId(project.id, episode.id);
    const title = buildDramaEpisodeCanvasTitle(project, episode);
    let canvas: CanvasProject;
    try {
        canvas = episode.canvasProjectId ? await getCanvasProjectForUser(userId, episode.canvasProjectId) : await createCanvasProjectForUser(userId, { title, sourceHandoffId });
    } catch (error) {
        if (!(error instanceof Error) || !episode.canvasProjectId || !error.message.includes("不存在")) throw error;
        canvas = await createCanvasProjectForUser(userId, { title, sourceHandoffId });
    }
    const merged = mergeDramaEpisodeCanvasProject(canvas, project, episode);
    if (JSON.stringify({ nodes: canvas.nodes, connections: canvas.connections, title: canvas.title }) !== JSON.stringify({ nodes: merged.nodes, connections: merged.connections, title: merged.title })) {
        canvas = await updateCanvasProjectForUser(userId, canvas.id, { project: merged, expectedUpdatedAt: canvas.updatedAt }) as CanvasProject;
    }
    if (episode.canvasProjectId !== canvas.id) {
        const nextProject = {
            ...project,
            episodes: project.episodes.map((item) => (item.id === episode.id ? { ...item, canvasProjectId: canvas.id } : item)),
            updatedAt: nextTimestamp(project.updatedAt),
        };
        await updateDramaProject(userId, normalizeProject(nextProject, project), project.updatedAt);
    }
    return { canvasProjectId: canvas.id, href: `/canvas/${encodeURIComponent(canvas.id)}?focus=${encodeURIComponent(episode.shots[0]?.id || "")}`, title: canvas.title };
}

export async function updateDramaShotMediaForUser(userId: string, projectId: string, episodeIdValue: string, shotIdValue: string, value: unknown) {
    const project = await getDramaProjectForUser(userId, projectId);
    const episodeId = cleanText(episodeIdValue);
    const shotId = cleanText(shotIdValue);
    const input = object(value);
    const field = cleanText(input.field) as DramaCanvasMediaField;
    if (field !== "storyboardImageUrl" && field !== "storyboardEndImageUrl" && field !== "videoUrl") throw new DramaProjectServiceError("不支持的短剧媒体字段", 400);
    const url = cleanText(input.url);
    if (!url || (!url.startsWith("/api/") && !/^https?:\/\//i.test(url))) throw new DramaProjectServiceError("媒体地址无效", 400);
    let matched = false;
    const nextProject = {
        ...project,
        episodes: project.episodes.map((episode) => {
            if (episode.id !== episodeId) return episode;
            return {
                ...episode,
                renderTask: undefined,
                shots: episode.shots.map((shot) => {
                    if (shot.id !== shotId) return shot;
                    matched = true;
                    return applyDramaCanvasMediaField(shot, field, { url, width: optionalNumber(input.width), height: optionalNumber(input.height) });
                }),
            };
        }),
        updatedAt: nextTimestamp(project.updatedAt),
    };
    if (!matched) throw new DramaProjectServiceError("短剧镜头不存在", 404);
    return updateDramaProject(userId, normalizeProject(nextProject, project), project.updatedAt);
}

export async function listDramaProjectVersionsForUser(userId: string, id: string) {
    await getDramaProjectForUser(userId, cleanText(id));
    return listDramaProjectVersions(userId, cleanText(id));
}

export async function createDramaProjectVersionForUser(userId: string, id: string, value: unknown) {
    const current = await getDramaProjectForUser(userId, cleanText(id));
    const input = object(value);
    const snapshot = normalizeProject(input.snapshot, current);
    if (Buffer.byteLength(JSON.stringify(snapshot)) > MAX_PROJECT_BYTES) throw new DramaProjectServiceError("短剧版本数据过大", 413);
    const reason = cleanText(input.reason) || "手动保存版本";
    return createDramaProjectVersion(userId, current.id, reason, snapshot);
}

export async function restoreDramaProjectVersionForUser(userId: string, id: string, versionId: string) {
    const projectId = cleanText(id);
    const current = await getDramaProjectForUser(userId, projectId);
    const version = await getDramaProjectVersion(userId, projectId, cleanText(versionId));
    if (!version) throw new DramaProjectServiceError("短剧版本不存在", 404);
    await createDramaProjectVersion(userId, projectId, "恢复前自动快照", current);
    try {
        return await updateDramaProject(userId, normalizeProject(version.snapshot, current), current.updatedAt);
    } catch (error) {
        if (error instanceof DramaProjectStoreError) throw new DramaProjectServiceError(error.message, error.status);
        throw error;
    }
}

export async function deleteDramaProjectForUser(userId: string, id: string) {
    const projectId = cleanText(id);
    const current = await getDramaProject(projectId, userId);
    const deleted = await deleteDramaProject(userId, projectId);
    if (!deleted) throw new DramaProjectServiceError("短剧项目不存在", 404);
    if (current?.creativeConversationId) await updateCreativeConversation(current.creativeConversationId, userId, { status: "archived" });
    if (current) await deleteUserLocalMediaAssets(userId, collectLocalMediaStorageKeys(current));
}

export async function deleteDramaAgentConversationForUser(userId: string, projectIdValue: string, conversationIdValue: unknown) {
    const project = await getDramaProjectForUser(userId, projectIdValue);
    const conversationId = cleanText(conversationIdValue);
    if (!conversationId) throw new DramaProjectServiceError("请选择要删除的对话", 400);
    const conversation = await getCreativeConversation(conversationId, userId);
    if (!conversation || conversation.surface !== "drama" || conversation.projectId !== project.id) throw new DramaProjectServiceError("Agent 对话与当前短剧项目不匹配", 409);

    const activeRuns = await listAgentRuns({ userId, conversationId, surface: "drama", statuses: ["planning", "running", "paused"], limit: 1 });
    if (activeRuns.length) throw new DramaProjectServiceError("运行中的对话需先停止任务再删除", 409);

    let replacementConversationId: string | undefined;
    let createdReplacement = false;
    if (project.creativeConversationId === conversationId) {
        const candidates = await listCreativeConversations(userId, { surface: "drama", source: "drama", projectId: project.id, status: "active", limit: 2 });
        let replacement = candidates.find((item) => item.id !== conversationId);
        if (!replacement) {
            replacement = await createCreativeConversation(userId, { surface: "drama", source: "drama", projectId: project.id, title: "新对话" });
            createdReplacement = true;
        }
        replacementConversationId = replacement.id;
    }

    let result: Awaited<ReturnType<typeof deleteDramaConversationAggregate>>;
    try {
        result = await deleteDramaConversationAggregate(userId, project.id, conversationId, replacementConversationId);
    } catch (error) {
        if (createdReplacement && replacementConversationId) await updateCreativeConversation(replacementConversationId, userId, { status: "archived" }).catch(() => null);
        if (error instanceof CreativeEntityDeletionConflict) throw new DramaProjectServiceError(error.message, 409);
        throw error;
    }
    await deleteUserLocalMediaAssets(userId, result.mediaStorageKeys);
    const updatedProject = result.dramaProject || project;
    return { deleted: result.deletedConversations > 0, activeConversationId: updatedProject.creativeConversationId || "", project: updatedProject };
}

function normalizeCreateInput(value: unknown): Required<Omit<CreateDramaProjectInput, "sourceAssets" | "sourceHandoffId">> & Pick<CreateDramaProjectInput, "sourceAssets" | "sourceHandoffId"> {
    const input = object(value);
    const title = cleanText(input.title);
    if (!title) throw new DramaProjectServiceError("项目名称不能为空", 400);
    const ratio = input.ratio === undefined ? "9:16" : normalizeDramaImageSize(input.ratio);
    if (!ratio) throw new DramaProjectServiceError("短剧尺寸无效", 400);
    return {
        title,
        sourceHandoffId: optionalText(input.sourceHandoffId),
        summary: cleanText(input.summary),
        style: cleanText(input.style) || "电影感国漫",
        ratio,
        initialScript: cleanText(input.initialScript),
        sourceAssets: normalizeSourceAssets(input.sourceAssets),
        defaultVideoMode: videoMode(input.defaultVideoMode),
    };
}

export function normalizeProject(value: unknown, current: DramaProject): DramaProject {
    const input = object(value);
    const episodes = array(input.episodes)
        .map(normalizeEpisode)
        .filter((episode): episode is DramaEpisode => Boolean(episode));
    if (!episodes.length) throw new DramaProjectServiceError("短剧项目至少需要一集", 400);
    const activeEpisodeId = cleanText(input.activeEpisodeId);
    const ratio = input.ratio === undefined ? normalizeDramaImageSize(current.ratio) : normalizeDramaImageSize(input.ratio);
    if (!ratio) throw new DramaProjectServiceError("短剧尺寸无效", 400);
    return {
        id: current.id,
        sourceHandoffId: current.sourceHandoffId,
        title: cleanText(input.title) || current.title,
        summary: cleanText(input.summary),
        style: cleanText(input.style),
        ratio,
        productionBible: normalizeProductionBible(input.productionBible, ratio, input.style),
        productionArchive: input.productionArchive === undefined ? current.productionArchive : normalizeProductionArchive(input.productionArchive),
        fieldOrigins: normalizeFieldOrigins(input.fieldOrigins),
        status: input.status === "archived" ? "archived" : "active",
        creativeConversationId: current.creativeConversationId,
        activeEpisodeId: episodes.some((episode) => episode.id === activeEpisodeId) ? activeEpisodeId : episodes[0].id,
        characters: normalizeNamedAssets(input.characters, "character", true),
        scenes: normalizeNamedAssets(input.scenes, "scene"),
        props: normalizeNamedAssets(input.props, "prop"),
        clues: normalizeClues(input.clues),
        defaultVideoMode: videoMode(input.defaultVideoMode),
        episodes,
        sourceAssets: normalizeSourceAssets(input.sourceAssets),
        createdAt: current.createdAt,
        updatedAt: nextTimestamp(current.updatedAt),
    };
}

function normalizeProductionArchive(value: unknown): DramaProductionArchive | undefined {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    return {
        formatVersion: "vozeb-drama-production-package-v1",
        sections: array(input.sections).flatMap((item) => {
            const section = object(item);
            const title = cleanText(section.title);
            return title ? [{ code: cleanText(section.code), title, content: cleanText(section.content) }] : [];
        }),
        promptAssets: array(input.promptAssets).flatMap((item) => {
            const asset = object(item);
            const code = cleanText(asset.code);
            const prompt = cleanText(asset.prompt);
            return code && prompt ? [{ code, category: asset.category === "storyboard" ? "storyboard" as const : "keyframe" as const, title: cleanText(asset.title) || code, prompt, shotCodes: ids(asset.shotCodes) }] : [];
        }),
        dialogueDirections: array(input.dialogueDirections).flatMap((item) => {
            const direction = object(item);
            const id = cleanText(direction.id);
            return id ? [{ id, shotCode: cleanText(direction.shotCode), speaker: cleanText(direction.speaker), text: cleanText(direction.text), performance: cleanText(direction.performance), lipSync: Boolean(direction.lipSync) }] : [];
        }),
        voiceDirections: array(input.voiceDirections).flatMap((item) => {
            const direction = object(item);
            const subject = cleanText(direction.subject);
            return subject ? [{ subject, direction: cleanText(direction.direction) }] : [];
        }),
        silenceDirections: array(input.silenceDirections).flatMap((item) => {
            const direction = object(item);
            const shotCode = cleanText(direction.shotCode);
            return shotCode ? [{ shotCode, direction: cleanText(direction.direction) }] : [];
        }),
        referencePlan: array(input.referencePlan).flatMap((item) => {
            const plan = object(item);
            const asset = cleanText(plan.asset);
            return asset ? [{ priority: Math.max(1, Math.floor(Number(plan.priority) || 1)), asset, purpose: cleanText(plan.purpose), planType: cleanText(plan.planType), shotCodes: ids(plan.shotCodes) }] : [];
        }),
        generationOrder: ids(input.generationOrder),
        qcReport: cleanText(input.qcReport),
    };
}

function normalizeEpisode(value: unknown): DramaEpisode | null {
    const input = object(value);
    const id = cleanText(input.id);
    if (!id) return null;
    const render = object(input.renderTask);
    const renderStatus = render.status;
    const renderTask =
        cleanText(render.id) && ["pending", "running", "success", "error", "cancelled"].includes(String(renderStatus))
            ? {
                  id: cleanText(render.id),
                  status: renderStatus as "pending" | "running" | "success" | "error" | "cancelled",
                  result: stableUrl(object(render.result).url) ? { url: stableUrl(object(render.result).url) } : undefined,
                  error: optionalText(render.error),
              }
            : undefined;
    const script = cleanText(input.script);
    const scriptRichContent = normalizeDramaScriptRichContent(input.scriptRichContent);
    return {
        id,
        code: optionalText(input.code),
        canvasProjectId: optionalText(input.canvasProjectId),
        title: cleanText(input.title) || "未命名剧集",
        script: scriptRichContent ? dramaRichContentToPlainText(scriptRichContent).trim() : script,
        scriptRichContent,
        outline: cleanText(input.outline),
        hook: cleanText(input.hook),
        nextPreview: cleanText(input.nextPreview),
        sourceRange: cleanText(input.sourceRange),
        reviewStatus: reviewStatus(input.reviewStatus),
        storyScenes: normalizeStoryScenes(input.storyScenes),
        continuityEdges: normalizeContinuityEdges(input.continuityEdges),
        fieldOrigins: normalizeFieldOrigins(input.fieldOrigins),
        shots: array(input.shots).map(normalizeShot),
        renderTask,
        visualReview: normalizeVisualReview(input.visualReview),
    };
}

function normalizeVisualReview(value: unknown): DramaEpisode["visualReview"] {
    const input = object(value);
    const mode = input.mode === "visual" || input.mode === "text" || input.mode === "unavailable" ? input.mode : null;
    const status = input.status === "passed" || input.status === "needs_revision" || input.status === "unavailable" ? input.status : null;
    const summary = cleanText(input.summary);
    if (!mode || !status || !summary) return undefined;
    const scoreValue = Number(input.score);
    const issues = array(input.issues).flatMap((item) => {
        const issue = object(item);
        const category = cleanText(issue.category);
        const message = cleanText(issue.message);
        if (!category || !message) return [];
        const severity: "low" | "medium" | "high" = issue.severity === "high" || issue.severity === "medium" ? issue.severity : "low";
        return [
            {
                taskId: optionalText(issue.taskId),
                category,
                severity,
                message,
                correction: optionalText(issue.correction),
            },
        ];
    });
    return {
        mode,
        status,
        score: Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, Math.round(scoreValue))) : undefined,
        summary,
        issues,
        retryTaskIds: ids(input.retryTaskIds),
    };
}

function normalizeShot(value: unknown, index: number): DramaShot {
    const input = object(value);
    return {
        id: cleanText(input.id) || `shot-${nanoid()}`,
        code: optionalText(input.code),
        order: Math.max(1, Math.floor(Number(input.order) || index + 1)),
        title: cleanText(input.title) || `镜头 ${index + 1}`,
        description: cleanText(input.description),
        sourceText: cleanText(input.sourceText),
        shotBoundary: cleanText(input.shotBoundary),
        dialogue: cleanText(input.dialogue),
        narration: cleanText(input.narration),
        utterances: normalizeUtterances(input.utterances),
        imagePrompt: cleanText(input.imagePrompt),
        videoPrompt: cleanText(input.videoPrompt),
        cameraMotion: cleanText(input.cameraMotion),
        startFramePrompt: optionalText(input.startFramePrompt),
        endFramePrompt: optionalText(input.endFramePrompt),
        negativePrompt: optionalText(input.negativePrompt),
        continuity: normalizeContinuity(input.continuity),
        storySceneId: optionalText(input.storySceneId),
        timecode: optionalText(input.timecode),
        dramaticFunction: optionalText(input.dramaticFunction),
        lens: optionalText(input.lens),
        lighting: optionalText(input.lighting),
        colorPalette: optionalText(input.colorPalette),
        transitionIn: optionalText(input.transitionIn),
        transitionOut: optionalText(input.transitionOut),
        performanceNotes: optionalText(input.performanceNotes),
        sound: normalizeShotSound(input.sound),
        entryState: normalizeContinuityState(input.entryState),
        exitState: normalizeContinuityState(input.exitState),
        fieldOrigins: normalizeFieldOrigins(input.fieldOrigins),
        sourceAssetIds: ids(input.sourceAssetIds),
        continuityStatus: continuityStatus(input.continuityStatus),
        actualStartFrameUrl: stableUrl(input.actualStartFrameUrl),
        actualEndFrameUrl: stableUrl(input.actualEndFrameUrl),
        duration: resolveDramaShotDuration(input.duration, 5),
        characterIds: array(input.characterIds)
            .map((id) => cleanText(id))
            .filter(Boolean),
        propIds: ids(input.propIds),
        clueIds: ids(input.clueIds),
        sceneId: optionalText(input.sceneId),
        videoMode: videoMode(input.videoMode),
        storyboardFrameMode: input.storyboardFrameMode === "first_last" ? "first_last" : "single",
        storyboardStatus: taskStatus(input.storyboardStatus),
        storyboardAttempt: optionalPositiveInteger(input.storyboardAttempt),
        storyboardTaskId: optionalText(input.storyboardTaskId),
        storyboardError: optionalText(input.storyboardError),
        storyboardImageUrl: stableUrl(input.storyboardImageUrl),
        storyboardImageWidth: optionalPositiveInteger(input.storyboardImageWidth),
        storyboardImageHeight: optionalPositiveInteger(input.storyboardImageHeight),
        storyboardEndStatus: taskStatus(input.storyboardEndStatus),
        storyboardEndAttempt: optionalPositiveInteger(input.storyboardEndAttempt),
        storyboardEndTaskId: optionalText(input.storyboardEndTaskId),
        storyboardEndError: optionalText(input.storyboardEndError),
        storyboardEndImageUrl: stableUrl(input.storyboardEndImageUrl),
        storyboardEndImageWidth: optionalPositiveInteger(input.storyboardEndImageWidth),
        storyboardEndImageHeight: optionalPositiveInteger(input.storyboardEndImageHeight),
        generationStatus: taskStatus(input.generationStatus),
        generationAttempt: optionalPositiveInteger(input.generationAttempt),
        generationTaskId: optionalText(input.generationTaskId),
        generationError: optionalText(input.generationError),
        videoUrl: stableUrl(input.videoUrl),
        subtitle: optionalText(input.subtitle),
        audioMode: input.audioMode === "voiceover" || input.audioMode === "mute" ? input.audioMode : "source",
        audioStatus: taskStatus(input.audioStatus),
        audioAttempt: optionalPositiveInteger(input.audioAttempt),
        audioTaskId: optionalText(input.audioTaskId),
        audioError: optionalText(input.audioError),
        audioUrl: stableUrl(input.audioUrl),
    };
}

function normalizeNamedAssets(value: unknown, prefix: string, character = false): DramaNamedAsset[] {
    return array(value)
        .map((item) => {
            const input = object(item);
            const id = cleanText(input.id) || `${prefix}-${nanoid()}`;
            const references = normalizeAssetReferences(input.references, id, input.referenceImageUrl, input.referenceStorageKey);
            const primaryReferenceId = references.some((reference) => reference.id === input.primaryReferenceId) ? String(input.primaryReferenceId) : references[0]?.id;
            const primaryReference = references.find((reference) => reference.id === primaryReferenceId);
            return {
                id,
                code: optionalText(input.code),
                name: cleanText(input.name),
                description: cleanText(input.description),
                fieldOrigins: normalizeFieldOrigins(input.fieldOrigins),
                activeEpisodeCodes: ids(input.activeEpisodeCodes),
                profile: normalizeAssetProfile(input.profile),
                references,
                primaryReferenceId,
                referenceImageUrl: primaryReference?.url,
                referenceStorageKey: primaryReference?.storageKey,
                ...(character ? { voiceProfile: normalizeVoiceProfile(input.voiceProfile) } : {}),
            };
        })
        .filter((item) => item.name);
}

function normalizeClues(value: unknown) {
    return array(value).flatMap((item) => {
        const input = object(item);
        const name = cleanText(input.name);
        if (!name) return [];
        const id = cleanText(input.id) || `clue-${nanoid()}`;
        const references = normalizeAssetReferences(input.references, id, input.referenceImageUrl, input.referenceStorageKey);
        const primaryReferenceId = references.some((reference) => reference.id === input.primaryReferenceId) ? String(input.primaryReferenceId) : references[0]?.id;
        const primaryReference = references.find((reference) => reference.id === primaryReferenceId);
        return [
            {
                id,
                code: optionalText(input.code),
                name,
                description: cleanText(input.description),
                fieldOrigins: normalizeFieldOrigins(input.fieldOrigins),
                activeEpisodeCodes: ids(input.activeEpisodeCodes),
                profile: normalizeAssetProfile(input.profile),
                references,
                primaryReferenceId,
                payoff: cleanText(input.payoff),
                referenceImageUrl: primaryReference?.url,
                referenceStorageKey: primaryReference?.storageKey,
            },
        ];
    });
}

function normalizeAssetProfile(value: unknown): DramaAssetProfile {
    const input = object(value);
    return {
        visualIdentity: cleanText(input.visualIdentity),
        styling: cleanText(input.styling),
        colorPalette: cleanText(input.colorPalette),
        consistencyRules: cleanText(input.consistencyRules),
        designPrompt: optionalText(input.designPrompt),
        identityAnchors: ids(input.identityAnchors),
        spatialRules: ids(input.spatialRules),
        stateRules: ids(input.stateRules),
        forbiddenChanges: ids(input.forbiddenChanges),
    };
}

function normalizeAssetReferences(value: unknown, assetId: string, legacyUrl: unknown, legacyStorageKey: unknown): DramaAssetReference[] {
    const references = array(value).flatMap((item, index) => {
        const input = object(item);
        const url = stableUrl(input.url);
        if (!url) return [];
        const source: DramaAssetReference["source"] = input.source === "generated" || input.source === "library" ? input.source : "upload";
        return [
            {
                id: cleanText(input.id) || `${assetId}-reference-${index + 1}`,
                url,
                storageKey: optionalText(input.storageKey),
                source,
                label: cleanText(input.label) || `参考图 ${index + 1}`,
                width: optionalPositiveInteger(input.width),
                height: optionalPositiveInteger(input.height),
                createdAt: timestamp(input.createdAt) || new Date(0).toISOString(),
            },
        ];
    });
    const url = stableUrl(legacyUrl);
    if (!references.length && url) references.push({ id: `${assetId}-reference-legacy`, url, storageKey: optionalText(legacyStorageKey), source: "library", label: "原参考图", width: undefined, height: undefined, createdAt: new Date(0).toISOString() });
    return references;
}

function normalizeVoiceProfile(value: unknown) {
    const input = object(value);
    return {
        voice: cleanText(input.voice),
        speed: Math.max(0.25, Math.min(4, Number(input.speed) || 1)),
        instructions: cleanText(input.instructions),
    };
}

function normalizeContinuity(value: unknown): DramaShotContinuity {
    const input = object(value);
    return {
        shotSize: cleanText(input.shotSize),
        cameraAngle: cleanText(input.cameraAngle),
        composition: cleanText(input.composition),
        characterBlocking: cleanText(input.characterBlocking),
        gazeDirection: cleanText(input.gazeDirection),
        actionStart: cleanText(input.actionStart),
        actionEnd: cleanText(input.actionEnd),
        screenDirection: cleanText(input.screenDirection),
        axisRule: cleanText(input.axisRule),
        continuityNotes: cleanText(input.continuityNotes),
    };
}

function normalizeUtterances(value: unknown): DramaUtterance[] {
    return array(value)
        .map((item, index) => {
            const input = object(item);
            return {
                id: cleanText(input.id) || `utterance-${nanoid()}`,
                order: Math.max(1, Math.floor(Number(input.order) || index + 1)),
                type: input.type === "voiceover" ? "voiceover" : "dialogue",
                speaker: cleanText(input.speaker),
                text: cleanText(input.text),
            } as DramaUtterance;
        })
        .filter((item) => item.text);
}

function ids(value: unknown) {
    return array(value)
        .map((id) => cleanText(id))
        .filter(Boolean);
}

function reviewStatus(value: unknown): DramaEpisode["reviewStatus"] {
    return value === "content_review" || value === "approved" || value === "visual_ready" ? value : "draft";
}

function videoMode(value: unknown): DramaVideoMode {
    return value === "direct" || value === "reference" ? value : "storyboard";
}

function normalizeSourceAssets(value: unknown) {
    return array(value).map((item) => {
        const asset = object(item);
        const type = ["text", "image", "video", "audio"].includes(String(asset.type)) ? (asset.type as "text" | "image" | "video" | "audio") : "text";
        return {
            id: cleanText(asset.id) || `source-${nanoid()}`,
            type,
            title: cleanText(asset.title) || "创作素材",
            textContent: type === "text" ? optionalText(asset.textContent) : undefined,
            storageKey: optionalText(asset.storageKey),
            remoteUrl: stableUrl(asset.remoteUrl),
            serverUrl: stableUrl(asset.serverUrl),
            mimeType: optionalText(asset.mimeType),
            width: optionalPositiveInteger(asset.width),
            height: optionalPositiveInteger(asset.height),
            sourceHash: optionalText(asset.sourceHash),
        };
    });
}

function normalizeProductionBible(value: unknown, ratio: string, style: unknown): DramaProductionBible | undefined {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    return {
        targetPlatform: optionalText(input.targetPlatform),
        language: cleanText(input.language) || "中文",
        ratio: normalizeDramaImageSize(input.ratio) || ratio,
        targetDuration: optionalPositiveInteger(input.targetDuration),
        visualStyle: cleanText(input.visualStyle) || cleanText(style),
        colorScript: optionalText(input.colorScript),
        soundBible: optionalText(input.soundBible),
        globalNegativePrompt: optionalText(input.globalNegativePrompt),
        subtitleSafeArea: optionalText(input.subtitleSafeArea),
        continuityMode: input.continuityMode === "balanced" ? "balanced" : "strict",
    };
}

function normalizeStoryScenes(value: unknown): DramaStoryScene[] {
    return array(value).flatMap((item, index) => {
        const input = object(item);
        const id = cleanText(input.id);
        if (!id) return [];
        return [{ id, code: optionalText(input.code), order: Math.max(1, Math.floor(Number(input.order) || index + 1)), title: cleanText(input.title) || `场 ${index + 1}`, timeOfDay: optionalText(input.timeOfDay), timeRange: optionalText(input.timeRange), locationId: optionalText(input.locationId), summary: cleanText(input.summary), shotIds: ids(input.shotIds), fieldOrigins: normalizeFieldOrigins(input.fieldOrigins) }];
    });
}

function normalizeContinuityEdges(value: unknown): DramaContinuityEdge[] {
    return array(value).flatMap((item) => {
        const input = object(item);
        const fromShotId = cleanText(input.fromShotId);
        const toShotId = cleanText(input.toShotId);
        if (!fromShotId || !toShotId || fromShotId === toShotId) return [];
        const transition = ["continuous", "match_cut", "hard_cut", "scene_change", "jump_cut"].includes(cleanText(input.transition)) ? (cleanText(input.transition) as DramaContinuityEdge["transition"]) : "hard_cut";
        return [{ fromShotId, toShotId, transition, inheritActualEndFrame: Boolean(input.inheritActualEndFrame), carryCharacterIds: ids(input.carryCharacterIds), carryPropIds: ids(input.carryPropIds), carryEnvironment: Boolean(input.carryEnvironment), carryAxis: Boolean(input.carryAxis), notes: optionalText(input.notes) }];
    });
}

function normalizeContinuityState(value: unknown): DramaContinuityState | undefined {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    const entities = (value: unknown) => array(value).flatMap((item) => {
        const entity = object(item);
        const assetId = cleanText(entity.assetId);
        return assetId ? [{ assetId, wardrobe: optionalText(entity.wardrobe), position: optionalText(entity.position), gaze: optionalText(entity.gaze), pose: optionalText(entity.pose), expression: optionalText(entity.expression), action: optionalText(entity.action), state: optionalText(entity.state), holderId: optionalText(entity.holderId) }] : [];
    });
    return { characters: entities(input.characters), props: entities(input.props), environment: optionalText(input.environment), lighting: optionalText(input.lighting), axis: optionalText(input.axis), screenDirection: optionalText(input.screenDirection) };
}

function normalizeShotSound(value: unknown) {
    const input = object(value);
    return Object.keys(input).length ? { ambience: optionalText(input.ambience), soundEffects: optionalText(input.soundEffects), music: optionalText(input.music) } : undefined;
}

function normalizeFieldOrigins(value: unknown): Record<string, DramaFieldOrigin> | undefined {
    const entries = Object.entries(object(value)).flatMap(([key, origin]) => (["package", "manual", "ai", "default"].includes(String(origin)) ? [[key, origin as DramaFieldOrigin] as const] : []));
    return entries.length ? Object.fromEntries(entries) : undefined;
}

function continuityStatus(value: unknown): DramaShot["continuityStatus"] {
    return ["ready", "stale", "blocked", "needs_review", "passed"].includes(String(value)) ? (value as DramaShot["continuityStatus"]) : undefined;
}

function taskStatus(value: unknown) {
    return ["idle", "queued", "running", "success", "error", "cancelled"].includes(String(value)) ? (value as DramaShot["generationStatus"]) : undefined;
}

function optionalPositiveInteger(value: unknown) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number > 0 ? number : undefined;
}

function optionalNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
}

function stableUrl(value: unknown) {
    const text = cleanText(value);
    return text && !text.startsWith("data:") && !text.startsWith("blob:") ? text : undefined;
}

function optionalText(value: unknown) {
    return cleanText(value) || undefined;
}

function cleanText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function parseTimestamp(value: unknown) {
    const time = Date.parse(String(value || ""));
    return Number.isFinite(time) ? time : 0;
}

function nextTimestamp(previous: string) {
    return new Date(Math.max(Date.now(), parseTimestamp(previous) + 1)).toISOString();
}

function timestamp(value: unknown) {
    const time = parseTimestamp(value);
    return time ? new Date(time).toISOString() : "";
}

function object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}
