import { nanoid } from "nanoid";
import { assertUniqueDramaVoices, normalizeDramaVoiceProfile } from "@/lib/drama-voice";

import { getAuthSettings } from "@/lib/auth/store";
import { fetchInternalApi } from "@/lib/server/internal-origin";
import { getStoredGenerationTask, queryStoredGenerationTasks } from "@/lib/server/generation-task-store";
import type { CanvasProject } from "@/lib/canvas-project-contract";
import { applyDramaCanvasMediaField, buildDramaEpisodeCanvasTitle, dramaEpisodeCanvasHandoffId, mergeDramaEpisodeCanvasProject, type DramaCanvasMediaField } from "@/lib/drama-canvas-bridge";
import type {
    CreateDramaProjectInput,
    DramaAssetProfile,
    DramaAssetReference,
    DramaAssetRefinementChange,
    DramaAssetRefinementMessage,
    DramaAssetRefinementProposal,
    DramaContinuityEdge,
    DramaContinuityState,
    DramaDialoguePerformance,
    DramaEpisode,
    DramaFieldOrigin,
    DramaFrameEvidence,
    DramaShotFramePlan,
    DramaNamedAsset,
    DramaProductionArchive,
    DramaProductionBible,
    DramaProductionRun,
    DramaProductionStep,
    DramaProject,
    DramaReferenceManifestItem,
    DramaSeriesBible,
    DramaShot,
    DramaShotContinuity,
    DramaLightingPlan,
    DramaPerformancePlan,
    DramaStoryScene,
    DramaUtterance,
    DramaVideoMode,
} from "@/lib/drama-project-contract";
import { dramaRichContentToPlainText, normalizeDramaScriptRichContent } from "@/lib/drama-script-rich-content";
import { approvedAssetReference } from "@/lib/drama-asset-baseline";
import { createFrameEvidence, decideActualEndFrame, invalidateFrameEvidence, replaceFrameEvidence, supersedeFrameEvidence } from "@/lib/drama-continuity-policy";
import { DRAMA_STYLE_COLOR_SCRIPT, DRAMA_STYLE_NAME, normalizeDramaStyleName } from "@/lib/drama-style";
import { normalizeDramaImageSize } from "@/lib/drama-image-size";
import { defaultDramaFrameBeats, normalizeDramaFrameBeats } from "@/lib/drama-frame-sequence";
import { defaultDramaProductionPlan, normalizeDramaProductionPlan } from "@/lib/drama-production-plan";
import { resolveDramaShotDuration } from "@/lib/server/drama-shot-config";
import { TEXT_MODEL_REQUEST_TIMEOUT_MS } from "@/lib/server/model-request-policy";
import { listAgentRuns } from "@/lib/server/agent-run-store";
import { reviewCreativeOutputs } from "@/lib/server/creative-review-service";
import { CreativeEntityDeletionConflict, deleteDramaConversationAggregate } from "@/lib/server/creative-entity-deletion-store";
import { createCreativeConversation, getCreativeConversation, listCreativeConversations, updateCreativeConversation } from "@/lib/server/creative-runtime-store";
import { createDramaProject, deleteDramaProject, DramaProjectStoreError, findDramaEpisodeByCanvasProjectId, findDramaProjectBySourceHandoffId, getDramaProject, listDramaProjectSummaries, updateDramaProject } from "@/lib/server/drama-project-store";
import { createDramaProjectVersion, getDramaProjectVersion, listDramaProjectVersions } from "@/lib/server/drama-project-version-store";
import { collectLocalMediaStorageKeys } from "@/lib/server/local-media-references";
import { deleteUserLocalMediaAssets } from "@/lib/server/local-media-storage";
import { signReferenceAssetInputUrl } from "@/lib/server/reference-asset-access";
import { applyDramaProductionPackage, DramaProductionPackageError, previewDramaProductionPackage } from "@/lib/server/drama-production-package";
import { buildDramaProductionRun, unlockDramaProductionSteps } from "@/lib/server/drama-production-run";
import { composeDramaVideoSegments } from "@/lib/server/drama-video-sequence";
import { buildDramaVisualProductionRun, compileDramaVisualStepPrompt, unlockDramaVisualSteps } from "@/lib/server/drama-visual-production-run";
import { preflightDramaProduction } from "@/lib/server/drama-production-preflight";
import { preflightDramaGeneration } from "@/lib/server/drama-generation-preflight";
import { createDramaProductionRun, findLatestDramaProductionRun, getDramaProductionRun, updateDramaProductionRun } from "@/lib/server/drama-production-run-store";
import { createCanvasProjectForUser, getCanvasProjectForUser, updateCanvasProjectForUser } from "@/lib/server/canvas-project-service";
import { resolveLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { getVideoTask } from "@/lib/server/video-task-store";

const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
const REVIEW_COMPLETION_STALE_MS = TEXT_MODEL_REQUEST_TIMEOUT_MS * 4;

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
    const episodesRecovered = recoverInvalidDramaEpisodes(project);
    const styleRecovered = recoverLegacyDramaStyle(episodesRecovered || project);
    const boundaryRecovered = recoverStaleDramaBoundaryFrames(styleRecovered || episodesRecovered || project);
    const frameEvidenceRecovered = recoverLegacyStoryboardFrameEvidence(boundaryRecovered || styleRecovered || episodesRecovered || project);
    const reviewRecovered = recoverStaleReviewCompletionTask(frameEvidenceRecovered || boundaryRecovered || styleRecovered || episodesRecovered || project);
    const profileRecovered = recoverGenericDramaAssetProfiles(reviewRecovered || frameEvidenceRecovered || boundaryRecovered || styleRecovered || episodesRecovered || project);
    const assetRecovered = await recoverStaleGeneratedAssetReferences(userId, profileRecovered || reviewRecovered || frameEvidenceRecovered || boundaryRecovered || styleRecovered || episodesRecovered || project);
    const recovered = assetRecovered || profileRecovered || reviewRecovered || frameEvidenceRecovered || boundaryRecovered || styleRecovered || episodesRecovered;
    if (!recovered) return project;
    try {
        return await updateDramaProject(userId, recovered, project.updatedAt);
    } catch (error) {
        if (error instanceof DramaProjectStoreError && error.status === 409) return (await getDramaProject(cleanText(id), userId)) || recovered;
        throw error;
    }
}

export function recoverInvalidDramaEpisodes(project: DramaProject) {
    const episodes = project.episodes.filter((episode) => episode && typeof episode === "object" && Array.isArray(episode.shots));
    return episodes.length === project.episodes.length ? null : { ...project, episodes, updatedAt: nextTimestamp(project.updatedAt) };
}

export function recoverStaleDramaBoundaryFrames(project: DramaProject) {
    let changed = false;
    const episodes = project.episodes.map((episode) => ({
        ...episode,
        shots: episode.shots.map((shot) => {
            const hasBoundaryFrames = Boolean(shot.actualStartFrameUrl || shot.actualEndFrameUrl);
            if (!shot.videoUrl || !hasBoundaryFrames || shot.actualFrameVideoUrl === shot.videoUrl) return shot;
            changed = true;
            return {
                ...shot,
                actualStartFrameUrl: undefined,
                actualEndFrameUrl: undefined,
                actualFrameVideoUrl: undefined,
                continuityStatus: "ready" as const,
                continuityError: undefined,
            };
        }),
    }));
    return changed ? { ...project, episodes, updatedAt: nextTimestamp(project.updatedAt) } : null;
}

function hasStoryboardStartFrame(shot: DramaShot) {
    return Boolean(
        shot.storyboardImageUrl || shot.storyboardImageUrls?.length || shot.storyboardImageRemoteUrl || shot.frameEvidence?.some((frame) => frame.role === "storyboard_start" && (frame.validity === "candidate" || frame.validity === "accepted")),
    );
}

function recoverLegacyStoryboardFrameEvidence(project: DramaProject) {
    let changed = false;
    const episodes = project.episodes.map((episode) => ({
        ...episode,
        shots: episode.shots.map((shot) => {
            const frameEvidence = shot.frameEvidence || [];
            const nextEvidence = [...frameEvidence];
            const candidates = [
                {
                    role: "storyboard_start" as const,
                    urls: shot.storyboardImageUrls?.length ? shot.storyboardImageUrls : shot.storyboardImageUrl ? [shot.storyboardImageUrl] : [],
                    remoteUrl: shot.storyboardImageRemoteUrl,
                    taskId: shot.storyboardTaskId,
                    status: shot.storyboardStatus,
                    deletedAt: shot.storyboardImageDeletedAt,
                },
                {
                    role: "storyboard_end" as const,
                    urls: shot.storyboardEndImageUrls?.length ? shot.storyboardEndImageUrls : shot.storyboardEndImageUrl ? [shot.storyboardEndImageUrl] : [],
                    remoteUrl: shot.storyboardEndImageRemoteUrl,
                    taskId: shot.storyboardEndTaskId,
                    status: shot.storyboardEndStatus,
                    deletedAt: shot.storyboardEndImageDeletedAt,
                },
            ];
            for (const candidate of candidates) {
                if (candidate.status !== "success" || candidate.deletedAt || !candidate.urls.length) continue;
                const hasActiveEvidence = nextEvidence.some((frame) => frame.role === candidate.role && (frame.validity === "candidate" || frame.validity === "accepted"));
                if (hasActiveEvidence) continue;
                for (const mediaUrl of candidate.urls) {
                    nextEvidence.push(
                        createFrameEvidence({
                            role: candidate.role,
                            source: "generated",
                            mediaUrl,
                            remoteUrl: candidate.remoteUrl,
                            sourceShotId: shot.id,
                            generationTaskId: candidate.taskId,
                            validity: "candidate",
                        }),
                    );
                }
                changed = true;
            }
            return nextEvidence.length === frameEvidence.length ? shot : { ...shot, frameEvidence: nextEvidence };
        }),
    }));
    return changed ? { ...project, episodes, updatedAt: nextTimestamp(project.updatedAt) } : null;
}

function clearStoryboardStartFrame(shot: DramaShot, now: string): Partial<DramaShot> {
    return {
        storyboardStatus: "idle",
        storyboardTaskId: undefined,
        storyboardError: undefined,
        storyboardImageUrl: undefined,
        storyboardImageRemoteUrl: undefined,
        storyboardImageUrls: undefined,
        storyboardImageWidth: undefined,
        storyboardImageHeight: undefined,
        storyboardImageDeletedAt: now,
        frameEvidence: shot.frameEvidence?.map((frame) => (frame.role === "storyboard_start" && (frame.validity === "candidate" || frame.validity === "accepted") ? invalidateFrameEvidence(frame, "superseded", "分镜起始状态已更新") : frame)),
    };
}

function discardStaleStoryboardStartFrames(current: DramaProject, next: DramaProject) {
    let changed = false;
    const now = new Date().toISOString();
    const currentEpisodes = new Map(current.episodes.map((episode) => [episode.id, episode]));
    const episodes = next.episodes.map((episode) => {
        const previousEpisode = currentEpisodes.get(episode.id);
        if (!previousEpisode) return episode;
        const previousShots = new Map(previousEpisode.shots.map((shot) => [shot.id, shot]));
        return {
            ...episode,
            shots: episode.shots.map((shot) => {
                const previousShot = previousShots.get(shot.id);
                const startStateChanged = previousShot && (previousShot.startFramePrompt !== shot.startFramePrompt || previousShot.continuity?.actionStart !== shot.continuity?.actionStart);
                if (!startStateChanged || !hasStoryboardStartFrame(shot)) return shot;
                changed = true;
                return { ...shot, ...clearStoryboardStartFrame(shot, now) };
            }),
        };
    });
    return changed ? { ...next, episodes, updatedAt: nextTimestamp(current.updatedAt) } : next;
}

function preserveMissingFrameEvidence(current: DramaProject, next: DramaProject) {
    const currentEpisodes = new Map(current.episodes.map((episode) => [episode.id, episode]));
    let changed = false;
    const episodes = next.episodes.map((episode) => {
        const previousEpisode = currentEpisodes.get(episode.id);
        if (!previousEpisode) return episode;
        const previousShots = new Map(previousEpisode.shots.map((shot) => [shot.id, shot]));
        return {
            ...episode,
            shots: episode.shots.map((shot) => {
                const previous = previousShots.get(shot.id);
                if (!previous?.frameEvidence?.length || shot.frameEvidence?.length || shot.storyboardImageDeletedAt || shot.storyboardEndImageDeletedAt) return shot;
                changed = true;
                return { ...shot, frameEvidence: previous.frameEvidence };
            }),
        };
    });
    return changed ? { ...next, episodes } : next;
}

function invalidateChangedDramaFrameEvidence(current: DramaProject, next: DramaProject) {
    const currentEpisodes = new Map(current.episodes.map((episode) => [episode.id, episode]));
    let changed = false;
    const episodes = next.episodes.map((episode) => {
        const previousEpisode = currentEpisodes.get(episode.id);
        if (!previousEpisode) return episode;
        const previousShots = new Map(previousEpisode.shots.map((shot) => [shot.id, shot]));
        const stale = new Set<string>();
        for (const shot of episode.shots) {
            const previous = previousShots.get(shot.id);
            if (!previous) continue;
            if (continuityFactsChanged(previous, shot) || frameEvidenceMaterialChanged(previous.frameEvidence, shot.frameEvidence)) stale.add(shot.id);
        }
        const previousEdges = new Map((previousEpisode.continuityEdges || []).map((edge) => [`${edge.fromShotId}:${edge.toShotId}`, JSON.stringify(edge)]));
        const nextEdges = new Map((episode.continuityEdges || []).map((edge) => [`${edge.fromShotId}:${edge.toShotId}`, JSON.stringify(edge)]));
        for (const key of new Set([...previousEdges.keys(), ...nextEdges.keys()])) {
            if (previousEdges.get(key) === nextEdges.get(key)) continue;
            const [fromShotId, toShotId] = key.split(":");
            stale.add(fromShotId);
            stale.add(toShotId);
        }
        let propagated = true;
        while (propagated) {
            propagated = false;
            for (const edge of episode.continuityEdges || []) {
                if (!edge.inheritActualEndFrame || !stale.has(edge.fromShotId) || stale.has(edge.toShotId)) continue;
                stale.add(edge.toShotId);
                propagated = true;
            }
        }
        if (!stale.size) return episode;
        changed = true;
        return {
            ...episode,
            shots: episode.shots.map((shot) =>
                !stale.has(shot.id)
                    ? shot
                    : {
                          ...shot,
                          ...clearLegacyFrameUrls(shot),
                          frameEvidence: supersedeFrameEvidence(shot.frameEvidence, "镜头状态、连续性边或引用帧已变化"),
                          continuityStatus: (shot.id === [...stale][0] ? "stale" : "blocked") as DramaShot["continuityStatus"],
                          continuityError: shot.id === [...stale][0] ? undefined : "上游连续性状态已变化，当前证据不可继续引用。",
                      },
            ),
        };
    });
    return changed ? { ...next, episodes, updatedAt: nextTimestamp(current.updatedAt) } : next;
}

function clearLegacyFrameUrls(shot: DramaShot): Partial<DramaShot> {
    return {
        storyboardStatus: shot.storyboardStatus === "running" ? shot.storyboardStatus : "idle",
        storyboardTaskId: undefined,
        storyboardError: undefined,
        storyboardImageUrl: undefined,
        storyboardImageRemoteUrl: undefined,
        storyboardImageUrls: undefined,
        storyboardImageWidth: undefined,
        storyboardImageHeight: undefined,
        storyboardImageDeletedAt: new Date().toISOString(),
        storyboardEndStatus: shot.storyboardEndStatus === "running" ? shot.storyboardEndStatus : "idle",
        storyboardEndTaskId: undefined,
        storyboardEndError: undefined,
        storyboardEndImageUrl: undefined,
        storyboardEndImageRemoteUrl: undefined,
        storyboardEndImageUrls: undefined,
        storyboardEndImageWidth: undefined,
        storyboardEndImageHeight: undefined,
        storyboardEndImageDeletedAt: new Date().toISOString(),
        actualStartFrameUrl: undefined,
        actualEndFrameUrl: undefined,
        actualFrameVideoUrl: undefined,
    };
}

function continuityFactsChanged(previous: DramaShot, next: DramaShot) {
    return (
        JSON.stringify({ entryState: previous.entryState, exitState: previous.exitState, framePlan: previous.framePlan, videoUrl: previous.videoUrl }) !==
        JSON.stringify({ entryState: next.entryState, exitState: next.exitState, framePlan: next.framePlan, videoUrl: next.videoUrl })
    );
}

function frameEvidenceMaterialChanged(previous: DramaFrameEvidence[] | undefined, next: DramaFrameEvidence[] | undefined) {
    const active = (previous || []).filter((frame) => frame.validity === "candidate" || frame.validity === "accepted");
    if (active.length && !(next || []).length) return false;
    const nextById = new Map((next || []).map((frame) => [frame.id, frame]));
    return active.some((frame) => {
        const replacement = nextById.get(frame.id);
        if (!replacement || replacement.role !== frame.role || replacement.mediaUrl !== frame.mediaUrl || replacement.sourceVideoUrl !== frame.sourceVideoUrl) return true;
        return replacement.validity !== "candidate" && replacement.validity !== "accepted";
    });
}

function recoverLegacyDramaStyle(project: DramaProject) {
    const style = normalizeDramaStyleName(project.style);
    const productionBible = project.productionBible
        ? {
              ...project.productionBible,
              visualStyle: normalizeDramaStyleName(project.productionBible.visualStyle),
              colorScript: project.productionBible.colorScript || DRAMA_STYLE_COLOR_SCRIPT,
          }
        : undefined;
    if (style === project.style && JSON.stringify(productionBible) === JSON.stringify(project.productionBible)) return null;
    return { ...project, style, productionBible };
}

function recoverMissingSeriesBible(project: DramaProject) {
    if (project.seriesBible) return null;
    const seriesBible: DramaSeriesBible = {
        version: "series-bible-v1",
        canonCharacters: project.characters.map((asset) => asset.id),
        immutableRules: ["只使用已登记的项目资产；未经确认不得新增或替换角色、场景、道具。"],
        relationshipState: project.summary.trim() || "人物关系以当前剧本和内容审核结果为准。",
        worldRules: ["不得编造剧本未明确提供的世界观事实。"],
        unresolvedThreads: [],
        visualMotifs: project.style.trim() ? [project.style.trim()] : [],
        soundMotifs: ["按当前集声音设计和对白执行。"],
    };
    return {
        ...project,
        seriesBible,
        fieldOrigins: { ...project.fieldOrigins, seriesBible: "default" as const },
        updatedAt: nextTimestamp(project.updatedAt),
    };
}

async function ensureSeriesBibleForUser(userId: string, project: DramaProject) {
    const recovered = recoverMissingSeriesBible(project);
    if (!recovered) return project;
    try {
        return await updateDramaProject(userId, recovered, project.updatedAt);
    } catch (error) {
        if (error instanceof DramaProjectStoreError && error.status === 409) return (await getDramaProject(project.id, userId)) || recovered;
        throw error;
    }
}

async function recoverStaleGeneratedAssetReferences(userId: string, project: DramaProject) {
    const assets = [
        ["characters", project.characters],
        ["scenes", project.scenes],
        ["props", project.props],
        ["clues", project.clues],
    ] as const;
    const replacements = new Map<string, { url: string; remoteUrl?: string; generationTaskId?: string }>();
    const taskIds = new Set<string>();
    const remoteUrls = new Set<string>();
    const localUrls = new Set<string>();
    for (const [, items] of assets) {
        for (const item of items) {
            for (const reference of item.references || []) {
                if (reference.generationTaskId) taskIds.add(reference.generationTaskId);
                if (/^https?:\/\//i.test(reference.url)) remoteUrls.add(reference.url);
                if (/^\/api\/(?:reference-assets|generation-log-assets)\//i.test(reference.url)) localUrls.add(reference.url);
            }
        }
    }
    if (!taskIds.size && !remoteUrls.size && !localUrls.size) return null;
    await Promise.all(
        [...taskIds].map(async (taskId) => {
            const task = await getStoredGenerationTask<{
                id?: string;
                userId?: string;
                projectId?: string;
                status?: string;
                result?: { remoteUrl?: string; serverUrl?: string; results?: Array<{ remoteUrl?: string; serverUrl?: string }> };
            }>("image", taskId);
            if (!task || task.userId !== userId || (task.projectId && task.projectId !== project.id) || task.status !== "success") return;
            const result = task.result;
            const serverUrl = [result?.serverUrl, ...(result?.results || []).map((item) => item.serverUrl)].find((value) => Boolean(value && /^\/api\/(?:reference-assets|generation-log-assets)\//.test(value)));
            const remoteUrl = [result?.remoteUrl, ...(result?.results || []).map((item) => item.remoteUrl)].find((value) => Boolean(value && /^https?:\/\//i.test(value)));
            if (serverUrl) replacements.set(`task:${taskId}`, { url: serverUrl, remoteUrl, generationTaskId: taskId });
        }),
    );
    if (remoteUrls.size || localUrls.size) {
        const tasks = await queryStoredGenerationTasks<{
            id?: string;
            status?: string;
            result?: { remoteUrl?: string; serverUrl?: string; results?: Array<{ remoteUrl?: string; serverUrl?: string }> };
        }>("image", { userId, projectId: project.id, statuses: ["success"], limit: 100 });
        for (const task of tasks) {
            const results = [task.result, ...(task.result?.results || [])];
            for (const result of results) {
                if (!result?.serverUrl || !/^\/api\/(?:reference-assets|generation-log-assets)\//.test(result.serverUrl)) continue;
                if (result.remoteUrl && remoteUrls.has(result.remoteUrl)) replacements.set(`remote:${result.remoteUrl}`, { url: result.serverUrl, remoteUrl: result.remoteUrl, generationTaskId: task.id });
                if (localUrls.has(result.serverUrl)) replacements.set(`local:${result.serverUrl}`, { url: result.serverUrl, remoteUrl: result.remoteUrl, generationTaskId: task.id });
            }
        }
    }
    if (!replacements.size) return null;
    let changed = false;
    const next = {
        ...project,
        characters: project.characters.map((item) =>
            recoverAssetReference(item, replacements, () => {
                changed = true;
            }),
        ),
        scenes: project.scenes.map((item) =>
            recoverAssetReference(item, replacements, () => {
                changed = true;
            }),
        ),
        props: project.props.map((item) =>
            recoverAssetReference(item, replacements, () => {
                changed = true;
            }),
        ),
        clues: project.clues.map((item) =>
            recoverAssetReference(item, replacements, () => {
                changed = true;
            }),
        ),
    };
    return changed ? { ...next, updatedAt: nextTimestamp(project.updatedAt) } : null;
}

function recoverAssetReference<T extends DramaNamedAsset>(asset: T, replacements: Map<string, { url: string; remoteUrl?: string; generationTaskId?: string }>, markChanged: () => void): T {
    let assetChanged = false;
    const references = (asset.references || []).map((reference) => {
        const replacement = (reference.generationTaskId ? replacements.get(`task:${reference.generationTaskId}`) : undefined) || replacements.get(`remote:${reference.url}`) || replacements.get(`local:${reference.url}`);
        const remoteUrl = replacement?.remoteUrl || reference.remoteUrl;
        if (!replacement || (replacement.url === reference.url && remoteUrl === reference.remoteUrl && (!replacement.generationTaskId || replacement.generationTaskId === reference.generationTaskId))) return reference;
        assetChanged = true;
        markChanged();
        return { ...reference, url: replacement.url, ...(remoteUrl ? { remoteUrl } : {}), ...(reference.generationTaskId || !replacement.generationTaskId ? {} : { generationTaskId: replacement.generationTaskId }) };
    });
    if (!assetChanged) return asset;
    const primary = references.find((reference) => reference.id === asset.primaryReferenceId);
    return { ...asset, references, referenceImageUrl: primary?.url || asset.referenceImageUrl };
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
        productionBible: {
            language: "中文",
            ratio: input.ratio,
            visualStyle: input.style || DRAMA_STYLE_NAME,
            colorScript: DRAMA_STYLE_COLOR_SCRIPT,
            soundBible: "按镜头声音设计表执行，保留对白空间与静默段落",
            globalNegativePrompt: "无字幕、无水印、无logo、无现代元素、无角色身份漂移",
            subtitleSafeArea: "角色头顶与画面底部保留安全区",
            continuityMode: "strict",
            productionPlan: defaultDramaProductionPlan("new-project"),
        },
        seriesBible: {
            version: "series-bible-v1",
            canonCharacters: [],
            immutableRules: ["只使用已登记的项目资产；未经确认不得新增或替换角色、场景、道具。"],
            relationshipState: input.summary.trim() || "人物关系以当前剧本和内容审核结果为准。",
            worldRules: ["不得编造剧本未明确提供的世界观事实。"],
            unresolvedThreads: [],
            visualMotifs: input.style.trim() ? [input.style.trim()] : [],
            soundMotifs: ["按当前集声音设计和对白执行。"],
        },
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
    let project = normalizeProject(value, current);
    try {
        assertUniqueDramaVoices(project.characters);
    } catch (error) {
        if (error instanceof Error) throw new DramaProjectServiceError(error.message, 409);
        throw error;
    }
    if (incomingUpdatedAt) project.updatedAt = new Date(incomingUpdatedAt).toISOString();
    project = preserveMissingFrameEvidence(current, project);
    project = invalidateChangedDramaFrameEvidence(current, project);
    try {
        return await updateDramaProject(userId, project, current.updatedAt);
    } catch (error) {
        if (error instanceof DramaProjectStoreError) throw new DramaProjectServiceError(error.message, error.status);
        throw error;
    }
}

export async function approveDramaAssetReferenceForUser(userId: string, id: string, kind: string, assetId: string, referenceId: string) {
    if (kind !== "characters" && kind !== "scenes" && kind !== "props" && kind !== "clues") throw new DramaProjectServiceError("当前资产类型不支持主基准图", 400);
    const current = await getDramaProjectForUser(userId, id);
    const asset = current[kind].find((item) => item.id === assetId);
    if (!asset) throw new DramaProjectServiceError("项目资产不存在，请刷新后重试", 404);
    const references = assetReferencesForApproval(asset);
    if (!references.some((reference) => reference.id === referenceId)) throw new DramaProjectServiceError("候选图已更新，请刷新后重试", 409);
    const now = new Date().toISOString();
    const nextReferences = references.map((reference) => ({
        ...reference,
        status: reference.id === referenceId ? ("approved" as const) : reference.status === "approved" ? ("candidate" as const) : reference.status,
        ...(reference.id === referenceId ? { approvedAt: now, version: (reference.version || 0) + 1 } : {}),
    }));
    const selected = nextReferences.find((reference) => reference.id === referenceId)!;
    const nextProject = {
        ...current,
        [kind]: current[kind].map((item) =>
            item.id === assetId
                ? { ...item, references: nextReferences, primaryReferenceId: selected.id, referenceImageUrl: selected.url, referenceStorageKey: selected.storageKey }
                : item,
        ),
        updatedAt: nextTimestamp(current.updatedAt),
    };
    try {
        return await updateDramaProject(userId, normalizeProject(nextProject, current), current.updatedAt);
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
        return await updateDramaProject(userId, discardStaleStoryboardStartFrames(current, normalizeProject(project, current)), current.updatedAt);
    } catch (error) {
        if (error instanceof DramaProjectStoreError) throw new DramaProjectServiceError(error.message, error.status);
        throw error;
    }
}

export async function applyDramaEpisodeProductionPackageForUser(userId: string, id: string, episodeIdValue: string, value: unknown) {
    const input = object(value);
    const current = await getDramaProjectForUser(userId, id);
    const episodeId = cleanText(episodeIdValue);
    const target = current.episodes.find((episode) => episode.id === episodeId);
    if (!target) throw new DramaProjectServiceError("短剧剧集不存在", 404);
    const expectedUpdatedAt = cleanText(input.expectedUpdatedAt);
    if (!expectedUpdatedAt || expectedUpdatedAt !== current.updatedAt) throw new DramaProjectServiceError("短剧项目已更新，请重新预览制作包", 409);
    const preview = previewDramaProductionPackageForUser(input);
    if (cleanText(input.sourceHash) !== preview.sourceHash) throw new DramaProjectServiceError("制作包内容已变化，请重新预览", 409);
    if (preview.package.episodes.length !== 1) throw new DramaProjectServiceError("剧本 Agent 制作包只能包含当前集", 400);
    const scoped = { ...current, episodes: [target], activeEpisodeId: target.id };
    const applied = applyDramaProductionPackage(scoped, preview.package, preview.sourceHash, cleanText(input.source), cleanText(input.fileName) || "剧本 Agent 制作包.md");
    const nextEpisode = applied.episodes[0];
    if (!nextEpisode) throw new DramaProjectServiceError("制作包没有可回填的当前集", 400);
    const project = { ...current, ...applied, episodes: current.episodes.map((episode) => (episode.id === target.id ? { ...nextEpisode, id: episode.id } : episode)), activeEpisodeId: current.activeEpisodeId, updatedAt: nextTimestamp(current.updatedAt) };
    await createDramaProjectVersion(userId, current.id, "剧本 Agent 制作包回填前", current);
    try {
        return await updateDramaProject(userId, discardStaleStoryboardStartFrames(current, normalizeProject(project, current)), current.updatedAt);
    } catch (error) {
        if (error instanceof DramaProjectStoreError) throw new DramaProjectServiceError(error.message, error.status);
        throw error;
    }
}

export async function createDramaProductionRunForUser(userId: string, projectId: string, value: unknown) {
    const project = await ensureSeriesBibleForUser(userId, await getDramaProjectForUser(userId, projectId));
    const episodeId = cleanText(object(value).episodeId);
    const episode = project.episodes.find((item) => item.id === episodeId);
    if (!episode) throw new DramaProjectServiceError("短剧剧集不存在", 404);
    if (cleanText(object(value).scope) === "visual") {
        const transport = { origin: cleanText(object(value).origin), cookie: cleanText(object(value).cookie) };
        const settings = await getAuthSettings();
        const requestedModel = cleanText(object(value).imageModel) || settings.defaultModels.imageModel;
        const requestedChannelId = cleanText(object(value).imageChannelId);
        const imageCandidate = resolveLogicalModelCandidates(settings, "image", requestedModel, requestedChannelId)[0];
        if (!imageCandidate) throw new DramaProjectServiceError("当前图片模型或渠道不可用，请刷新模型配置后重试", 409);
        const run = buildDramaVisualProductionRun(project, episode, {
            imageModel: imageCandidate.logicalModelId,
            imageChannelId: imageCandidate.channelId,
            imageQuality: cleanText(object(value).imageQuality) || settings.generationDefaults.imageQuality,
            shotIds: ids(object(value).shotIds),
            frameType: ["start_frame", "end_frame", "all_frames"].includes(cleanText(object(value).frameType)) ? (cleanText(object(value).frameType) as "start_frame" | "end_frame" | "all_frames") : undefined,
            frameCount: Math.max(1, Math.min(9, Math.floor(Number(object(value).frameCount) || 1))),
            frameIds: ids(object(value).frameIds),
            regenerateAll: object(value).regenerateAll === true,
        });
        const latest = await findLatestDramaProductionRun(userId, project.id, episode.id, "visual");
        const syncedLatest = latest?.scope === "visual" ? await syncDramaVisualRun(userId, project, latest, transport) : latest;
        if (syncedLatest?.scope === "visual" && syncedLatest.planRevision === run.planRevision && !["cancelled", "failed", "completed", "needs_review"].includes(syncedLatest.status)) return syncedLatest;
        return createDramaProductionRun(userId, run);
    }
    if (episode.reviewStatus !== "visual_ready") throw new DramaProjectServiceError("请先完成内容审核和视觉方案", 409);
    const settings = await getAuthSettings();
    const parameters = {
        imageModel: settings.defaultModels.imageModel,
        videoModel: settings.defaultModels.videoModel,
        audioModel: settings.defaultModels.audioModel || undefined,
        imageQuality: settings.generationDefaults.imageQuality,
        videoQuality: settings.generationDefaults.videoQuality,
        productionPlan: project.productionBible?.productionPlan,
    };
    if (!parameters.imageModel || !parameters.videoModel) throw new DramaProjectServiceError("后台尚未配置可用的图片和视频逻辑模型", 409);
    const videoCandidate = resolveLogicalModelCandidates(settings, "video", parameters.videoModel)[0];
    if (!videoCandidate) throw new DramaProjectServiceError("当前视频模型或渠道不可用，请刷新模型配置后重试", 409);
    const preflight = preflightDramaProduction(project, episode);
    if (preflight.status === "blocked") {
        const detail = preflight.issues
            .slice(0, 8)
            .map((issue) => issue.message)
            .join("；");
        throw new DramaProjectServiceError(`导演前置检查未通过：${detail}`, 409);
    }
    const submittedPreflight = object(object(value).preflight);
    const requestedPlan = normalizeDramaProductionPlan(object(value).productionPlan, project.productionBible?.productionPlan);
    if (!requestedPlan && !project.productionBible?.productionPlan) throw new DramaProjectServiceError("请先锁定本集生产方案", 409);
    if (requestedPlan && project.productionBible?.productionPlan && JSON.stringify(requestedPlan.video) !== JSON.stringify(project.productionBible.productionPlan.video)) throw new DramaProjectServiceError("生产方案已变化，请重新保存并预检", 409);
    const checkedShotIds = ids(submittedPreflight.checkedShotIds);
    const selectedShotIds = new Set(checkedShotIds);
    const scopedEpisode = selectedShotIds.size
        ? { ...episode, shots: episode.shots.filter((shot) => selectedShotIds.has(shot.id)), continuityEdges: (episode.continuityEdges || []).filter((edge) => selectedShotIds.has(edge.fromShotId) && selectedShotIds.has(edge.toShotId)) }
        : episode;
    const run = {
        ...buildDramaProductionRun(project, scopedEpisode, {
            ...parameters,
            videoChannelId: videoCandidate.channelId,
            productionPlan: requestedPlan || project.productionBible?.productionPlan,
            minVideoSeconds: videoCandidate.capabilityProfile?.minDurationSeconds,
            maxVideoSeconds: videoCandidate.capabilityProfile?.maxDurationSeconds,
            maxReferenceImages: videoCandidate.capabilityProfile?.maxReferenceImages,
        }),
        preflightSnapshot: {
            checkedShotIds,
            issues: array(submittedPreflight.issues).flatMap((item) => {
                const issue = object(item);
                const code = cleanText(issue.code);
                const message = cleanText(issue.message);
                if (!code || !message) return [];
                return [{ code, message, severity: issue.severity === "blocking" ? ("blocking" as const) : ("warning" as const), shotId: optionalText(issue.shotId), assetId: optionalText(issue.assetId), correction: optionalText(issue.correction) }];
            }),
            changeSummary: array(submittedPreflight.changeSummary).map(cleanText).filter(Boolean),
            prompts: Object.fromEntries(
                episode.shots
                    .filter((shot) => !checkedShotIds.length || checkedShotIds.includes(shot.id))
                    .map((shot) => [
                        shot.id,
                        { sourceImagePrompt: shot.imagePrompt, sourceVideoPrompt: shot.videoPrompt, executionImagePrompt: shot.executionImagePrompt || shot.imagePrompt, executionVideoPrompt: shot.executionVideoPrompt || shot.videoPrompt },
                    ]),
            ),
        },
    };
    const latest = await findLatestDramaProductionRun(userId, project.id, episode.id, "production");
    if (latest?.planRevision === run.planRevision && !["cancelled", "failed", "completed"].includes(latest.status)) return latest;
    const confirmed = { ...run, confirmedAt: new Date().toISOString(), status: "running" as const };
    const created = await createDramaProductionRun(userId, confirmed);
    const origin = cleanText(object(value).origin);
    const cookie = cleanText(object(value).cookie);
    const imageRun = await dispatchReadyDramaVisualSteps(userId, project, created, origin, cookie);
    const refreshedProject = await getDramaProjectForUser(userId, project.id);
    const refreshedRun = await getDramaProductionRun(userId, project.id, imageRun.id);
    return refreshedRun ? dispatchReadyDramaProductionSteps(userId, refreshedProject, refreshedRun, origin, cookie) : imageRun;
}

export async function getLatestDramaProductionRunForUser(userId: string, projectId: string, episodeId: string, transport: { origin?: string; cookie?: string; scope?: "visual" | "production" } = {}) {
    const project = await getDramaProjectForUser(userId, projectId);
    const run = await findLatestDramaProductionRun(userId, projectId, cleanText(episodeId), transport.scope || "production");
    if (!run) return run;
    if (!run.scope || run.scope !== "visual") {
        const imageSynced = await syncDramaVisualRun(userId, project, run, transport);
        const imageDispatched = imageSynced.confirmedAt && ["running", "ready"].includes(imageSynced.status) ? await dispatchReadyDramaVisualSteps(userId, project, imageSynced, transport.origin || "", transport.cookie || "") : imageSynced;
        const refreshedProject = await getDramaProjectForUser(userId, projectId);
        const refreshedRun = await getDramaProductionRun(userId, projectId, imageDispatched.id);
        if (!refreshedRun) return imageDispatched;
        const synced = await syncDramaProductionRun(userId, refreshedProject, refreshedRun, transport);
        return synced.confirmedAt && ["running", "ready"].includes(synced.status) ? dispatchReadyDramaProductionSteps(userId, refreshedProject, synced, transport.origin || "", transport.cookie || "") : synced;
    }
    const synced = await syncDramaVisualRun(userId, project, run, transport);
    return synced.confirmedAt && ["running", "ready"].includes(synced.status) ? dispatchReadyDramaVisualSteps(userId, project, synced, transport.origin || "", transport.cookie || "") : synced;
}

export async function preflightDramaGenerationForUser(userId: string, projectId: string, value: unknown) {
    const project = await ensureSeriesBibleForUser(userId, await getDramaProjectForUser(userId, projectId));
    const input = object(value);
    const episodeId = cleanText(input.episodeId);
    const episode = project.episodes.find((item) => item.id === episodeId);
    if (!episode) throw new DramaProjectServiceError("短剧剧集不存在", 404);
    const shotIds = ids(input.shotIds);
    return preflightDramaGeneration({
        origin: cleanText(input.origin),
        cookie: cleanText(input.cookie),
        userId,
        requestId: cleanText(input.requestId) || `${project.id}:${episode.id}:${shotIds.join(",")}`,
        project,
        episode,
        shotIds,
    });
}

async function syncDramaVisualRun(userId: string, project: DramaProject, run: DramaProductionRun, transport: { origin?: string; cookie?: string } = {}) {
    let changed = false;
    let nextProject = project;
    const steps: DramaProductionRun["steps"] = [];
    for (const originalStep of run.steps) {
            const step = originalStep;
            if (!step.taskId) {
                steps.push(step);
                continue;
            }
            if (step.status === "failed" || step.status === "cancelled") {
                const recovered = applyDramaVisualStepFailure(nextProject, run.episodeId, step, step.error || (step.status === "cancelled" ? "图片任务已取消" : "图片任务失败"));
                if (recovered !== nextProject) {
                    changed = true;
                    nextProject = recovered;
                }
                steps.push(step);
                continue;
            }
            if (!["asset_anchor", "start_frame", "end_frame", "keyframe"].includes(step.type)) {
                steps.push(step);
                continue;
            }
            if (!["running", "ready"].includes(step.status)) {
                steps.push(step);
                continue;
            }
            const task = await getStoredGenerationTask<{
                status?: string;
                result?: { serverUrl?: string; remoteUrl?: string; dataUrl?: string; width?: number; height?: number; results?: Array<{ serverUrl?: string; remoteUrl?: string; dataUrl?: string; width?: number; height?: number }> };
                error?: string;
            }>("image", step.taskId);
            if (!task || !["success", "error", "cancelled"].includes(String(task.status))) {
                steps.push(step);
                continue;
            }
            const results = (task.result?.results?.length ? task.result.results : task.result ? [task.result] : [])
                .map((item) => ({ url: item.serverUrl || item.remoteUrl || item.dataUrl || "", remoteUrl: /^https?:\/\//i.test(item.remoteUrl || "") ? item.remoteUrl : undefined, width: item.width, height: item.height }))
                .filter((item) => item.url);
            changed = true;
            if (!results.length || task.status !== "success") {
                nextProject = applyDramaVisualStepFailure(nextProject, run.episodeId, step, task.error || "图片任务失败");
                steps.push({ ...step, status: task.status === "cancelled" ? ("cancelled" as const) : ("failed" as const), error: task.error || "图片任务失败" });
                continue;
            }
            nextProject = applyDramaVisualStepResult(nextProject, run.episodeId, step, results);
            let completed: DramaProductionRun["steps"][number] = {
                ...step,
                status: step.type === "asset_anchor" ? ("needs_review" as const) : ("success" as const),
                outputUrls: results.map((item) => item.url),
                outputRemoteUrls: results.flatMap((item) => (item.remoteUrl ? [item.remoteUrl] : [])),
                outputWidth: results[0].width,
                outputHeight: results[0].height,
                error: step.type === "asset_anchor" ? "候选图已生成，请在项目资产库确认主基准图" : undefined,
            };
            if (step.type === "keyframe" && (step.sequenceIndex || 1) > 1) {
                const previous = [...steps].reverse().find((item) => item.type === "keyframe" && item.shotId === step.shotId && item.sequenceIndex === (step.sequenceIndex || 1) - 1);
                if (!previous?.outputUrls?.[0]) completed = { ...completed, status: "needs_review", error: "缺少上一帧实际结果，无法执行连续性检查" };
                else {
                    const review = await reviewDramaFramePair(userId, run, step, previous.outputUrls[0], results[0].url, transport.origin || "", transport.cookie || "");
                    const passed = review.status === "passed";
                    completed = { ...completed, status: passed ? "success" : "needs_review", continuityEvidenceId: `frame-qc:${run.id}:${step.frameId || step.sequenceIndex}`, error: passed ? undefined : review.summary };
                    nextProject = applyDramaFrameContinuityResult(nextProject, run.episodeId, step, passed, completed.continuityEvidenceId!, review.summary);
                }
            } else if (step.type === "keyframe") {
                completed.continuityEvidenceId = `frame-qc:${run.id}:${step.frameId || step.sequenceIndex}:origin`;
                nextProject = applyDramaFrameContinuityResult(nextProject, run.episodeId, step, true, completed.continuityEvidenceId, "首帧已建立");
            }
            steps.push(completed);
    }
    if (!changed) return run;
    const nextRun = unlockDramaVisualSteps({ ...run, steps });
    if (JSON.stringify(nextProject) !== JSON.stringify(project)) await updateDramaProject(userId, nextProject, project.updatedAt);
    await updateDramaProductionRun(userId, nextRun);
    return nextRun;
}

async function reviewDramaFramePair(userId: string, run: DramaProductionRun, step: DramaProductionStep, previousUrl: string, currentUrl: string, origin: string, cookie: string) {
    return reviewCreativeOutputs({
        origin,
        cookie,
        userId,
        billingId: `drama-frame-qc:${run.id}:${step.frameId || step.sequenceIndex}`,
        foundation: {
            complexity: "complex",
            brief: { objective: "检查短剧相邻锚点帧能否自然连续", constraints: ["人物身份、服装、道具、场景拓扑、光向、构图、站位和轴线保持连续"], referenceStrategy: "第一张为上一帧，第二张为当前帧" },
            direction: { summary: "只判断相邻画面连续性", composition: "核对空间关系、人物姿态和动作推进", avoid: ["身份漂移", "服装突变", "空间跳变", "动作倒退", "轴线错误"] },
        },
        tasks: [{ id: step.id, title: step.title || "相邻帧连续性", type: "image", prompt: step.prompt || "", resultSummary: "第一张是上一帧，第二张是当前帧", imageUrls: [previousUrl, currentUrl] }],
    });
}

function applyDramaFrameContinuityResult(project: DramaProject, episodeId: string, step: DramaProductionStep, passed: boolean, evidenceId: string, error: string) {
    return {
        ...project,
        episodes: project.episodes.map((episode) =>
            episode.id !== episodeId
                ? episode
                : {
                      ...episode,
                      shots: episode.shots.map((shot) =>
                          shot.id !== step.shotId
                              ? shot
                              : {
                                    ...shot,
                                    storyboardFrames: (shot.storyboardFrames || []).map((frame) =>
                                        frame.id === step.frameId || frame.sequenceIndex === step.sequenceIndex
                                            ? { ...frame, continuityStatus: passed ? ("passed" as const) : ("needs_review" as const), continuityEvidenceId: evidenceId, ...(passed ? { error: undefined } : { error }) }
                                            : frame,
                                    ),
                                },
                      ),
                  },
        ),
        updatedAt: new Date().toISOString(),
    };
}

export function applyDramaVisualStepResult(project: DramaProject, episodeId: string, step: DramaProductionRun["steps"][number], results: Array<{ url: string; remoteUrl?: string; width?: number; height?: number }>) {
    const first = results[0];
    if (step.type === "asset_anchor" && step.assetId && step.assetKind) {
        const references = results.map((result, index) => ({
            id: `generated-${step.id}-${index}`,
            url: result.url,
            source: "generated" as const,
            ...(result.remoteUrl ? { remoteUrl: result.remoteUrl } : {}),
            status: "candidate" as const,
            label: step.title || "Agent 生成图",
            width: result.width,
            height: result.height,
            createdAt: new Date().toISOString(),
        }));
        return {
            ...project,
            [step.assetKind]: (project[step.assetKind] || []).map((asset) =>
                asset.id === step.assetId ? { ...asset, references: [...(asset.references || []).filter((reference) => !references.some((item) => item.id === reference.id)), ...references] } : asset,
            ),
            updatedAt: new Date().toISOString(),
        };
    }
    if (!step.shotId) return project;
    return {
        ...project,
        episodes: project.episodes.map((episode) => {
            if (episode.id !== episodeId) return episode;
            return {
                ...episode,
                shots: episode.shots.map((shot) => {
                    if (shot.id !== step.shotId) return shot;
                    const evidence = results.map((result) =>
                        createFrameEvidence({
                            role: step.type === "end_frame" ? "storyboard_end" : step.type === "keyframe" ? "storyboard_keyframe" : "storyboard_start",
                            sequenceIndex: step.sequenceIndex,
                            source: "generated",
                            mediaUrl: result.url,
                            remoteUrl: result.remoteUrl,
                            sourceShotId: shot.id,
                            generationTaskId: step.taskId,
                            validity: "candidate",
                        }),
                    );
                    if (step.type === "keyframe") {
                        const sequenceIndex = step.sequenceIndex || 1;
                        const frameId = step.frameId || `keyframe-${shot.id}-${sequenceIndex}`;
                        return {
                            ...shot,
                            storyboardFrameMode: "all_frames" as const,
                            frameEvidence: [...(shot.frameEvidence || []).filter((frame) => frame.role !== "storyboard_keyframe" || frame.sequenceIndex !== sequenceIndex), ...evidence],
                            storyboardFrames: [
                                ...(shot.storyboardFrames || []).filter((frame) => frame.sequenceIndex !== sequenceIndex),
                                {
                                    id: frameId,
                                    sequenceIndex,
                                    mediaUrl: first.url,
                                    remoteUrl: first.remoteUrl,
                                    width: first.width,
                                    height: first.height,
                                    source: "generated" as const,
                                    status: "success" as const,
                                    taskId: step.taskId,
                                    inputHash: step.inputHash,
                                    continuityStatus: "pending" as const,
                                },
                            ].sort((left, right) => left.sequenceIndex - right.sequenceIndex),
                        };
                    }
                    return step.type === "end_frame"
                        ? {
                              ...shot,
                              frameEvidence: [...replaceFrameEvidence(shot.frameEvidence, evidence[0], "新的分镜尾帧已生成"), ...evidence.slice(1)],
                              storyboardEndStatus: "success" as const,
                              storyboardEndImageUrl: first.url,
                              storyboardEndImageRemoteUrl: first.remoteUrl,
                              storyboardEndImageUrls: results.map((result) => result.url),
                              storyboardEndImageWidth: first.width,
                              storyboardEndImageHeight: first.height,
                              storyboardEndError: undefined,
                              storyboardEndImageDeletedAt: undefined,
                          }
                        : {
                              ...shot,
                              frameEvidence: [...replaceFrameEvidence(shot.frameEvidence, evidence[0], "新的分镜首帧已生成"), ...evidence.slice(1)],
                              storyboardStatus: "success" as const,
                              storyboardImageUrl: first.url,
                              storyboardImageRemoteUrl: first.remoteUrl,
                              storyboardImageUrls: results.map((result) => result.url),
                              storyboardImageWidth: first.width,
                              storyboardImageHeight: first.height,
                              storyboardError: undefined,
                              storyboardImageDeletedAt: undefined,
                          };
                }),
            };
        }),
        updatedAt: new Date().toISOString(),
    };
}

export function applyDramaVisualStepFailure(project: DramaProject, episodeId: string, step: DramaProductionRun["steps"][number], error: string) {
    if (!step.shotId || (step.type !== "start_frame" && step.type !== "end_frame" && step.type !== "keyframe")) return project;
    const current = project.episodes.find((episode) => episode.id === episodeId)?.shots.find((shot) => shot.id === step.shotId);
    if (!current) return project;
    if (step.type === "end_frame" ? current.storyboardEndStatus === "error" && current.storyboardEndError === error : current.storyboardStatus === "error" && current.storyboardError === error) return project;
    return {
        ...project,
        episodes: project.episodes.map((episode) => {
            if (episode.id !== episodeId) return episode;
            return {
                ...episode,
                shots: episode.shots.map((shot) => {
                    if (shot.id !== step.shotId) return shot;
                    const role = step.type === "end_frame" ? "storyboard_end" : step.type === "keyframe" ? "storyboard_keyframe" : "storyboard_start";
                    const frameEvidence = (shot.frameEvidence || []).map((frame) =>
                        frame.role === role && frame.generationTaskId === step.taskId && (frame.validity === "candidate" || frame.validity === "accepted") ? invalidateFrameEvidence(frame, "unavailable", error) : frame,
                    );
                    if (step.type === "keyframe") return { ...shot, frameEvidence, storyboardFrames: (shot.storyboardFrames || []).map((frame) => (frame.id === step.frameId || frame.sequenceIndex === step.sequenceIndex ? { ...frame, status: "error" as const, error } : frame)) };
                    return step.type === "end_frame" ? { ...shot, frameEvidence, storyboardEndStatus: "error" as const, storyboardEndError: error } : { ...shot, frameEvidence, storyboardStatus: "error" as const, storyboardError: error };
                }),
            };
        }),
        updatedAt: new Date().toISOString(),
    };
}

export async function getDramaProductionPreflightForUser(userId: string, projectId: string, episodeId: string) {
    const project = await ensureSeriesBibleForUser(userId, await getDramaProjectForUser(userId, projectId));
    const episode = project.episodes.find((item) => item.id === cleanText(episodeId));
    if (!episode) throw new DramaProjectServiceError("短剧剧集不存在", 404);
    return preflightDramaProduction(project, episode);
}

export async function updateDramaProductionRunForUser(userId: string, projectId: string, runId: string, value: unknown) {
    const project = await getDramaProjectForUser(userId, projectId);
    const run = await getDramaProductionRun(userId, projectId, cleanText(runId));
    if (!run) throw new DramaProjectServiceError("生产运行不存在", 404);
    const action = cleanText(object(value).action);
    let next: DramaProductionRun;
    if (action === "confirm" && run.scope === "visual") {
        if (run.confirmedAt) return run;
        if (run.blockers?.length) throw new DramaProjectServiceError(`视觉计划存在阻断项：${run.blockers.slice(0, 6).join("；")}`, 409);
        next = unlockDramaVisualSteps({ ...run, confirmedAt: new Date().toISOString(), status: "running" });
    } else if (action === "cancel") {
        next = { ...run, status: "cancelled", steps: run.steps.map((step) => (["success", "cancelled"].includes(step.status) ? step : { ...step, status: "cancelled" })), updatedAt: new Date().toISOString() };
    } else if (action === "retry") {
        const stepIds = new Set(ids(object(value).stepIds));
        if (run.scope !== "visual") {
            const shotIds = Array.from(new Set(run.steps.filter((step) => stepIds.has(step.id) && step.shotId).map((step) => step.shotId!)));
            const episode = project.episodes.find((item) => item.id === run.episodeId);
            if (!episode) throw new DramaProjectServiceError("短剧剧集不存在", 404);
            const check = await preflightDramaGeneration({
                origin: cleanText(object(value).origin),
                cookie: cleanText(object(value).cookie),
                userId,
                requestId: `drama-run-retry:${run.id}:${Array.from(stepIds).sort().join(",")}`,
                project,
                episode,
                shotIds,
            });
            if (check.status !== "passed")
                throw new DramaProjectServiceError(
                    `重试前检查未通过：${check.issues
                        .slice(0, 6)
                        .map((issue) => issue.message)
                        .join("；")}`,
                    409,
                );
        }
        next =
            run.scope === "visual"
                ? unlockDramaVisualSteps({
                      ...run,
                      status: "running",
                      steps: run.steps.map((step) =>
                          stepIds.has(step.id) && ["failed", "needs_review", "stale"].includes(step.status) ? { ...step, status: step.dependsOn.length ? "blocked" : "ready", taskId: undefined, error: undefined, outputUrls: undefined } : step,
                      ),
                  })
                : unlockDramaProductionSteps({
                      ...run,
                      status: "ready",
                      steps: run.steps.map((step) =>
                          stepIds.has(step.id) && ["failed", "needs_review", "stale"].includes(step.status) ? { ...step, status: step.dependsOn.length ? "blocked" : "ready", taskId: undefined, error: undefined, outputUrls: undefined } : step,
                      ),
                      updatedAt: new Date().toISOString(),
                  });
    } else {
        throw new DramaProjectServiceError("不支持的生产运行操作", 400);
    }
    const saved = await updateDramaProductionRun(userId, next);
    if (!saved) throw new DramaProjectServiceError("生产运行不存在", 404);
    if (saved.scope === "visual" && (action === "confirm" || action === "retry")) {
        return dispatchReadyDramaVisualSteps(userId, project, saved, cleanText(object(value).origin), cleanText(object(value).cookie));
    }
    return saved;
}

async function dispatchReadyDramaVisualSteps(userId: string, project: DramaProject, run: DramaProductionRun, origin: string, cookie: string) {
    if (!run.confirmedAt || !origin) return run;
    const assetUrls = new Map<string, { url: string; remoteUrl?: string }>();
    for (const asset of [...project.characters, ...project.scenes, ...project.props, ...project.clues]) {
        const reference = approvedAssetReference(asset);
        if (reference?.url) assetUrls.set(asset.id, { url: reference.url, remoteUrl: reference.remoteUrl });
    }
    for (const asset of project.sourceAssets || []) {
        const url = asset.serverUrl || asset.remoteUrl;
        if (asset.type === "image" && url) assetUrls.set(asset.id, { url, remoteUrl: asset.remoteUrl });
    }
    let current = unlockDramaVisualSteps(run);
    const episode = project.episodes.find((candidate) => candidate.id === run.episodeId);
    if (!episode) return run;
    for (const candidate of current.steps) {
        const step = current.steps.find((item) => item.id === candidate.id)!;
        const prompt = compileDramaVisualStepPrompt(project, episode, step);
        if (step.status !== "ready" || step.taskId || !prompt || !["start_frame", "end_frame", "keyframe", "asset_anchor"].includes(step.type)) continue;
        const references = [
            ...(step.referenceImageUrls || [])
                .map((url, index) => createDramaVisualImageReference(`continuity-${index}`, url, origin, step.referenceImageRemoteUrls?.[index]))
                .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference)),
            ...(step.referenceAssetIds || [])
                .map((id) => assetUrls.get(id))
                .map((reference, index) => createDramaVisualImageReference(`asset-${index}`, reference?.url, origin, reference?.remoteUrl))
                .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference)),
        ];
        if ((step.referenceImageUrls || []).length && !references.some((reference) => reference.id.startsWith("continuity-"))) {
            const nextStep = {
                ...step,
                status: "failed" as const,
                error: "上一镜实际尾帧是本地提取帧，当前图片渠道要求公网图片 URL；请部署并配置外部 NEXT_PUBLIC_SITE_URL 后重试。",
            };
            current = { ...current, steps: current.steps.map((item) => (item.id === step.id ? nextStep : item)), status: "running", updatedAt: new Date().toISOString() };
            await updateDramaProductionRun(userId, current);
            continue;
        }
        const requestId = `drama:${run.id}:${step.id}`;
        let nextStep: DramaProductionStep;
        try {
            const response = await fetchInternalApi(`${origin}/api/image-tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie, "X-VOZEB-PRO-Client-Request-Id": requestId },
                body: JSON.stringify({
                    kind: references.length ? "edit" : "generation",
                    config: { model: run.parameterSnapshot.imageModel, channelId: run.parameterSnapshot.imageChannelId, quality: run.parameterSnapshot.imageQuality, size: run.parameterSnapshot.ratio, count: "1" },
                    prompt: compileDramaReferencePrompt(prompt, references),
                    references,
                    source: "drama",
                    title: `${project.title} · ${step.title || step.id}`,
                    context: { runId: run.id, surface: "drama", projectId: project.id, episodeId: run.episodeId, shotId: step.shotId, frameId: step.frameId, inputHash: step.inputHash, clientRequestId: requestId },
                }),
            });
            const payload = (await response.json().catch(() => ({}))) as { task?: { id?: string }; error?: string; msg?: string };
            nextStep = response.ok && payload.task?.id ? { ...step, taskId: payload.task.id, status: "running", error: undefined } : { ...step, status: "failed", error: payload.error || payload.msg || "导演图片任务创建失败" };
        } catch {
            nextStep = { ...step, status: "needs_review", error: "图片任务提交结果未知，请先在供应商任务记录中核对，禁止直接重复创建" };
        }
        current = { ...current, steps: current.steps.map((item) => (item.id === step.id ? nextStep : item)), status: "running", updatedAt: new Date().toISOString() };
        await updateDramaProductionRun(userId, current);
    }
    const finalized = unlockDramaVisualSteps(current);
    if (finalized.status !== current.status || finalized.steps.some((step, index) => step.status !== current.steps[index]?.status)) await updateDramaProductionRun(userId, finalized);
    return finalized;
}

async function syncDramaProductionRun(userId: string, project: DramaProject, run: DramaProductionRun, transport: { origin?: string; cookie?: string } = {}) {
    let changed = false;
    let steps = [...run.steps];
    let nextProject = project;
    for (const step of steps) {
        if (step.type !== "video" || step.status !== "running" || !step.taskId) continue;
        const task = await getVideoTask(step.taskId);
        if (!task || task.userId !== userId || !["success", "error", "cancelled"].includes(task.status)) continue;
        changed = true;
        steps = steps.map((item) =>
            item.id !== step.id
                ? item
                : task.status === "success" && task.result?.url
                  ? { ...item, status: "success" as const, outputUrls: [task.result.url], outputRemoteUrls: task.result.remoteUrl ? [task.result.remoteUrl] : undefined, error: undefined }
                  : { ...item, status: task.status === "cancelled" ? ("cancelled" as const) : ("failed" as const), error: task.error || "视频子段生成失败" },
        );
    }

    let nextRun = unlockDramaProductionSteps({ ...run, steps });
    const episode = nextProject.episodes.find((item) => item.id === run.episodeId);
    if (episode) {
        for (const shot of episode.shots) {
            const videoSteps = nextRun.steps.filter((step) => step.shotId === shot.id && step.type === "video").sort((left, right) => (left.clipIndex || 0) - (right.clipIndex || 0));
            const extract = nextRun.steps.find((step) => step.shotId === shot.id && step.type === "extract_frames");
            if (extract && extract.status !== "success" && videoSteps.length && videoSteps.every((step) => step.status === "success" && step.outputUrls?.[0])) {
                changed = true;
                try {
                    const videoUrl = await composeDramaVideoSegments({
                        clips: videoSteps.map((step) => ({ url: step.outputUrls![0], duration: step.duration || 0 })),
                        ratio: run.parameterSnapshot.ratio,
                        origin: transport.origin || "",
                        cookie: transport.cookie || "",
                        ownerUserId: userId,
                        projectId: project.id,
                        runId: run.id,
                        shotId: shot.id,
                        title: `${project.title}-${shot.title}`,
                    });
                    nextRun = {
                        ...nextRun,
                        steps: nextRun.steps.map((step) => (step.id === extract.id ? { ...step, status: "success" as const, outputUrls: [videoUrl], error: undefined } : step)),
                    };
                    nextProject = updateDramaShotInProject(nextProject, run.episodeId, shot.id, {
                        generationStatus: "success",
                        generationRunId: run.id,
                        generationTaskId: undefined,
                        generationError: undefined,
                        videoUrl,
                        frameEvidence: supersedeFrameEvidence(shot.frameEvidence, "当前镜头视频已重新生成"),
                        actualStartFrameUrl: undefined,
                        actualEndFrameUrl: undefined,
                        actualFrameVideoUrl: undefined,
                        ...(shot.audioMode === "voiceover" && (shot.subtitle || shot.dialogue).trim() ? { audioStatus: "queued" as const, audioError: undefined } : {}),
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : "视频子段拼接失败";
                    nextRun = { ...nextRun, steps: nextRun.steps.map((step) => (step.id === extract.id ? { ...step, status: "failed" as const, error: message } : step)) };
                    nextProject = updateDramaShotInProject(nextProject, run.episodeId, shot.id, { generationStatus: "error", generationRunId: undefined, generationTaskId: undefined, generationError: message });
                }
            }

            const qc = nextRun.steps.find((step) => step.shotId === shot.id && step.type === "continuity_qc");
            const currentShot = nextProject.episodes.find((item) => item.id === run.episodeId)?.shots.find((item) => item.id === shot.id);
            if (qc && ["ready", "needs_review"].includes(qc.status) && currentShot?.continuityStatus === "passed") {
                changed = true;
                nextRun = { ...nextRun, steps: nextRun.steps.map((step) => (step.id === qc.id ? { ...step, status: "success" as const, error: undefined } : step)) };
                nextProject = updateDramaShotInProject(nextProject, run.episodeId, shot.id, { generationRunId: undefined });
            } else if (qc?.status === "ready" && currentShot?.continuityStatus === "blocked") {
                changed = true;
                nextRun = { ...nextRun, steps: nextRun.steps.map((step) => (step.id === qc.id ? { ...step, status: "failed" as const, error: currentShot.continuityError || "镜头连续性检查失败" } : step)) };
            } else if (qc?.status === "ready" && currentShot?.continuityStatus === "needs_review") {
                changed = true;
                nextRun = { ...nextRun, steps: nextRun.steps.map((step) => (step.id === qc.id ? { ...step, status: "needs_review" as const, error: "请验收实际首尾帧连续性" } : step)) };
            }
        }
    }
    nextRun = unlockDramaProductionSteps(nextRun);
    if (!changed && nextRun.status === run.status && nextRun.steps.every((step, index) => step.status === run.steps[index]?.status)) return run;
    if (JSON.stringify(nextProject) !== JSON.stringify(project)) await updateDramaProject(userId, { ...nextProject, updatedAt: nextTimestamp(project.updatedAt) }, project.updatedAt);
    await updateDramaProductionRun(userId, nextRun);
    return nextRun;
}

async function dispatchReadyDramaProductionSteps(userId: string, project: DramaProject, run: DramaProductionRun, origin: string, cookie: string) {
    if (!run.confirmedAt || !origin) return run;
    const assetUrls = new Map<string, { url: string; remoteUrl?: string }>();
    for (const asset of [...project.characters, ...project.scenes, ...project.props, ...project.clues]) {
        const reference = approvedAssetReference(asset);
        if (reference?.url) assetUrls.set(asset.id, { url: reference.url, remoteUrl: reference.remoteUrl });
    }
    for (const asset of project.sourceAssets || []) {
        const url = asset.serverUrl || asset.remoteUrl;
        if (asset.type === "image" && url) assetUrls.set(asset.id, { url, remoteUrl: asset.remoteUrl });
    }
    let current = unlockDramaProductionSteps(run);
    let nextProject = project;
    for (const candidate of current.steps) {
        const step = current.steps.find((item) => item.id === candidate.id)!;
        if (step.type !== "video" || step.status !== "ready" || step.taskId || !step.prompt) continue;
        const shot = project.episodes.find((episode) => episode.id === run.episodeId)?.shots.find((item) => item.id === step.shotId);
        const frameReferences = (step.referenceImageUrls || []).map((url, index) =>
            shot?.storyboardFrameMode === "all_frames"
                ? { type: "image", role: "keyframe", keyframeIndex: index + 1, url: step.referenceImageRemoteUrls?.[index] || url }
                : { type: "image", role: index === 0 ? "first_frame" : "last_frame", url: step.referenceImageRemoteUrls?.[index] || url },
        );
        const assetReferences = (step.referenceAssetIds || []).flatMap((assetId) => {
            const reference = assetUrls.get(assetId);
            return reference ? [{ type: "image", role: "reference", url: reference.remoteUrl || reference.url }] : [];
        });
        const references = [...frameReferences, ...assetReferences];
        const requestId = `drama-video:${run.id}:${step.id}`;
        let nextStep: DramaProductionStep;
        try {
            const response = await fetchInternalApi(`${origin}/api/video-generation-tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie, "X-VOZEB-PRO-Client-Request-Id": requestId },
                body: JSON.stringify({
                    config: {
                        model: run.parameterSnapshot.videoModel,
                        channelId: run.parameterSnapshot.videoChannelId,
                        size: run.parameterSnapshot.ratio,
                        vquality: String(run.parameterSnapshot.productionPlan?.video.resolution || run.parameterSnapshot.videoQuality || "720p").replace(/p$/i, ""),
                        videoSeconds: step.duration,
                        videoGenerateAudio: true,
                    },
                    prompt: compileDramaVideoReferencePrompt(step.prompt, references),
                    references,
                    source: "drama",
                    context: { runId: run.id, surface: "drama", projectId: project.id, episodeId: run.episodeId, shotId: step.shotId, clientRequestId: requestId },
                }),
            });
            const payload = (await response.json().catch(() => ({}))) as { task?: { id?: string; needsReview?: boolean }; error?: string; warning?: string };
            nextStep = response.ok && payload.task?.id
                ? { ...step, taskId: payload.task.id, status: payload.task.needsReview ? "needs_review" : "running", error: payload.task.needsReview ? payload.warning || "视频任务提交结果待审核" : undefined }
                : { ...step, status: "failed", error: payload.error || "视频子段任务创建失败" };
        } catch {
            nextStep = { ...step, status: "needs_review", error: "视频任务提交结果未知，请先在供应商任务记录中核对，禁止直接重复创建" };
        }
        current = unlockDramaProductionSteps({ ...current, steps: current.steps.map((item) => (item.id === step.id ? nextStep : item)) });
        if (step.shotId) nextProject = updateDramaShotInProject(nextProject, run.episodeId, step.shotId, { generationStatus: nextStep.status === "running" ? "running" : nextStep.status === "failed" ? "error" : "needs_review", generationRunId: run.id, generationTaskId: undefined, generationError: nextStep.error });
        await updateDramaProductionRun(userId, current);
    }
    if (JSON.stringify(nextProject) !== JSON.stringify(project)) await updateDramaProject(userId, { ...nextProject, updatedAt: nextTimestamp(project.updatedAt) }, project.updatedAt);
    return current;
}

export function compileDramaVideoReferencePrompt(prompt: string, references: Array<{ role: string }>) {
    if (!references.length) return prompt;
    const labels: Record<string, string> = { keyframe: "有序逐帧锚点", first_frame: "视频首帧", last_frame: "视频尾帧", reference: "项目资产基准图" };
    return `${prompt}\n参考图顺序（与请求数组完全一致）：\n${references.map((reference, index) => `@图片${index + 1}：${labels[reference.role] || "项目资产基准图"}`).join("\n")}`;
}

function updateDramaShotInProject(project: DramaProject, episodeId: string, shotId: string, patch: Partial<DramaShot>): DramaProject {
    return { ...project, episodes: project.episodes.map((episode) => (episode.id === episodeId ? { ...episode, shots: episode.shots.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot)) } : episode)) };
}

export function compileDramaReferencePrompt(prompt: string, references: Array<{ id: string }>) {
    if (!references.length) return prompt;
    const manifest = references.map((reference, index) => `@图片${index + 1}：${reference.id.startsWith("continuity-") ? "上一帧连续性锚点" : "项目资产基准图"}`).join("\n");
    return `${prompt}\n参考图顺序（与请求数组完全一致）：\n${manifest}`;
}

export function resolveDramaVisualReferenceUrl(url: string | undefined, origin: string, remoteUrl?: string) {
    const publicOrigin = externalDramaOrigin(process.env.NEXT_PUBLIC_SITE_URL || "");
    const local = (url || "").trim();
    // A provider-issued CDN URL is already reachable by the image supplier.
    // Prefer it over the local mirror, which may be backed by an ephemeral tunnel.
    if (isExternalDramaUrl(remoteUrl)) return remoteUrl;
    // Prefer the local mirror when available. Historical supplier CDN URLs can
    // be used only when no provider-issued URL is available.
    if (/\/api\/(?:reference-assets|generation-log-assets)\//.test(local)) {
        if (!publicOrigin) return "";
        const absoluteLocal = local.startsWith("/") ? new URL(local, origin).toString() : local;
        const signed = signReferenceAssetInputUrl(absoluteLocal, publicOrigin);
        if (signed !== absoluteLocal) return signed;
    }

    return [remoteUrl, url].find((candidate) => isExternalDramaUrl(candidate)) || "";
}

export function createDramaVisualImageReference(id: string, url: string | undefined, origin: string, remoteUrl?: string) {
    const resolved = resolveDramaVisualReferenceUrl(url, origin, remoteUrl);
    if (!resolved) return null;
    const localMirror = (url || "").trim();
    const inputUrl = localMirror || resolved;
    return {
        id,
        type: "image" as const,
        dataUrl: inputUrl,
        url: inputUrl,
        ...(localMirror ? { serverUrl: localMirror } : {}),
        ...(isExternalDramaUrl(remoteUrl) ? { remoteUrl: remoteUrl!.trim() } : {}),
    };
}

function isExternalDramaUrl(value: string | undefined) {
    if (!value) return false;
    try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && isExternalDramaHost(url.hostname);
    } catch {
        return false;
    }
}

function externalDramaOrigin(value: string) {
    try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && isExternalDramaHost(url.hostname) ? url.origin : "";
    } catch {
        return "";
    }
}

function isExternalDramaHost(hostname: string) {
    const host = hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".localhost") || host === "::1") return false;
    const parts = host.split(".").map((part) => Number(part));
    if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
        const [a, b] = parts;
        return !(a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0);
    }
    return host.includes(".");
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
    if (
        JSON.stringify({ nodes: canvas.nodes, connections: canvas.connections, title: canvas.title, viewport: canvas.viewport, canvasMigrationVersion: canvas.canvasMigrationVersion }) !==
        JSON.stringify({ nodes: merged.nodes, connections: merged.connections, title: merged.title, viewport: merged.viewport, canvasMigrationVersion: merged.canvasMigrationVersion })
    ) {
        canvas = (await updateCanvasProjectForUser(userId, canvas.id, { project: merged, expectedUpdatedAt: canvas.updatedAt })) as CanvasProject;
    }
    if (episode.canvasProjectId !== canvas.id) {
        const nextProject = {
            ...project,
            episodes: project.episodes.map((item) => (item.id === episode.id ? { ...item, canvasProjectId: canvas.id } : item)),
            updatedAt: nextTimestamp(project.updatedAt),
        };
        await updateDramaProject(userId, normalizeProject(nextProject, project), project.updatedAt);
    }
    return { canvasProjectId: canvas.id, href: `/canvas/${encodeURIComponent(canvas.id)}`, title: canvas.title };
}

export async function syncDramaCanvasForUser(userId: string, canvasProjectId: string) {
    const linked = await findDramaEpisodeByCanvasProjectId(userId, cleanText(canvasProjectId));
    if (!linked) throw new DramaProjectServiceError("当前画布没有关联的短剧剧集", 404);
    return ensureDramaEpisodeCanvasForUser(userId, linked.project.id, linked.episode.id);
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

export async function decideDramaContinuityFrameForUser(userId: string, projectId: string, episodeIdValue: string, shotIdValue: string, value: unknown) {
    const project = await getDramaProjectForUser(userId, projectId);
    const input = object(value);
    const episodeId = cleanText(episodeIdValue);
    const shotId = cleanText(shotIdValue);
    const frameEvidenceId = cleanText(input.frameEvidenceId);
    const expectedVideoRevision = cleanText(input.expectedVideoRevision);
    const decision = input.decision === "accept" || input.decision === "reject" ? input.decision : undefined;
    if (!frameEvidenceId || !expectedVideoRevision || !decision) throw new DramaProjectServiceError("连续性验收参数无效", 400);
    let matched = false;
    const nextProject = {
        ...project,
        episodes: project.episodes.map((episode) => {
            if (episode.id !== episodeId) return episode;
            const nextShots = episode.shots.map((shot) => {
                if (shot.id !== shotId) return shot;
                matched = true;
                try {
                    return decideActualEndFrame(shot, frameEvidenceId, decision, expectedVideoRevision);
                } catch (error) {
                    throw new DramaProjectServiceError(error instanceof Error ? error.message : "连续性验收失败", 409);
                }
            });
            if (!matched || decision !== "reject") return { ...episode, shots: nextShots };
            const blocked = new Set<string>([shotId]);
            let changed = true;
            while (changed) {
                changed = false;
                for (const edge of episode.continuityEdges || [])
                    if (edge.inheritActualEndFrame && blocked.has(edge.fromShotId) && !blocked.has(edge.toShotId)) {
                        blocked.add(edge.toShotId);
                        changed = true;
                    }
            }
            return {
                ...episode,
                shots: nextShots.map((shot) =>
                    shot.id === shotId
                        ? shot
                        : blocked.has(shot.id)
                          ? { ...shot, frameEvidence: supersedeFrameEvidence(shot.frameEvidence, "上游实际尾帧已被拒绝"), continuityStatus: "blocked" as const, continuityError: "上一镜实际尾帧未获验收，当前镜头不可引用。" }
                          : shot,
                ),
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
        style: cleanText(input.style) || DRAMA_STYLE_NAME,
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
        style: normalizeDramaStyleName(cleanText(input.style) || current.style),
        ratio,
        productionBible: normalizeProductionBible(input.productionBible, ratio, normalizeDramaStyleName(cleanText(input.style) || current.style)),
        seriesBible: normalizeSeriesBible(input.seriesBible, current.seriesBible),
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

function normalizeSeriesBible(value: unknown, fallback?: DramaSeriesBible): DramaSeriesBible | undefined {
    const input = object(value);
    if (!Object.keys(input).length) return fallback;
    return {
        version: "series-bible-v1",
        canonCharacters: ids(input.canonCharacters),
        immutableRules: texts(input.immutableRules),
        relationshipState: cleanText(input.relationshipState),
        worldRules: texts(input.worldRules),
        unresolvedThreads: texts(input.unresolvedThreads),
        visualMotifs: texts(input.visualMotifs),
        soundMotifs: texts(input.soundMotifs),
        previousEpisodeExitState: normalizeContinuityState(input.previousEpisodeExitState),
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
            return code && prompt ? [{ code, category: asset.category === "storyboard" ? ("storyboard" as const) : ("keyframe" as const), title: cleanText(asset.title) || code, prompt, shotCodes: ids(asset.shotCodes) }] : [];
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
        reviewCompletionTask: normalizeReviewCompletionTask(input.reviewCompletionTask),
        visualReview: normalizeVisualReview(input.visualReview),
    };
}

function normalizeReviewCompletionTask(value: unknown): DramaEpisode["reviewCompletionTask"] {
    const input = object(value);
    const id = cleanText(input.id);
    const status = input.status === "success" || input.status === "error" || input.status === "running" ? input.status : "";
    if (!id || !status) return undefined;
    const startedAt = cleanText(input.startedAt) || new Date().toISOString();
    const updatedAt = cleanText(input.updatedAt) || startedAt;
    return {
        id,
        status,
        missingCount: Math.max(0, Math.floor(Number(input.missingCount) || 0)),
        completedCount: Math.max(0, Math.floor(Number(input.completedCount) || 0)),
        message: optionalText(input.message),
        error: optionalText(input.error),
        startedAt,
        updatedAt,
        completedAt: optionalText(input.completedAt),
    };
}

function recoverStaleReviewCompletionTask(project: DramaProject) {
    const now = Date.now();
    let changed = false;
    const episodes = project.episodes.map((episode) => {
        const task = episode.reviewCompletionTask;
        if (!task || task.status !== "running" || now - Date.parse(task.updatedAt) <= REVIEW_COMPLETION_STALE_MS) return episode;
        changed = true;
        const completedAt = new Date(now).toISOString();
        return {
            ...episode,
            reviewCompletionTask: {
                ...task,
                status: "error" as const,
                error: "补全请求长时间未完成，已自动结束，请重新发起补全。",
                message: "补全请求已超时，可重新发起",
                updatedAt: completedAt,
                completedAt,
            },
        };
    });
    return changed ? { ...project, episodes, updatedAt: nextTimestamp(project.updatedAt) } : null;
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
        performancePlan: normalizePerformancePlan(input.performancePlan),
        dialoguePerformance: normalizeDialoguePerformance(input.dialoguePerformance),
        lightingPlan: normalizeLightingPlan(input.lightingPlan),
        imagePrompt: cleanText(input.imagePrompt),
        videoPrompt: cleanText(input.videoPrompt),
        executionVideoPrompt: optionalText(input.executionVideoPrompt),
        executionImagePrompt: optionalText(input.executionImagePrompt),
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
        framePlan: normalizeShotFramePlan(input.framePlan, resolveDramaShotDuration(input.duration, 5), cleanText(input.videoPrompt), cleanText(input.imagePrompt)),
        frameEvidence: normalizeFrameEvidence(input.frameEvidence),
        fieldOrigins: normalizeFieldOrigins(input.fieldOrigins),
        sourceAssetIds: ids(input.sourceAssetIds),
        continuityStatus: continuityStatus(input.continuityStatus),
        continuityError: optionalText(input.continuityError),
        actualStartFrameUrl: stableUrl(input.actualStartFrameUrl),
        actualEndFrameUrl: stableUrl(input.actualEndFrameUrl),
        actualFrameVideoUrl: stableUrl(input.actualFrameVideoUrl),
        duration: resolveDramaShotDuration(input.duration, 5),
        characterIds: array(input.characterIds)
            .map((id) => cleanText(id))
            .filter(Boolean),
        propIds: ids(input.propIds),
        clueIds: ids(input.clueIds),
        sceneId: optionalText(input.sceneId),
        videoMode: videoMode(input.videoMode),
        storyboardFrameMode: input.storyboardFrameMode === "first_last" || input.storyboardFrameMode === "all_frames" ? input.storyboardFrameMode : "single",
        storyboardFrames: normalizeStoryboardFrames(input.storyboardFrames),
        storyboardStatus: taskStatus(input.storyboardStatus),
        storyboardAttempt: optionalPositiveInteger(input.storyboardAttempt),
        storyboardTaskId: optionalText(input.storyboardTaskId),
        storyboardError: optionalText(input.storyboardError),
        storyboardImageUrl: stableUrl(input.storyboardImageUrl),
        storyboardImageRemoteUrl: stableUrl(input.storyboardImageRemoteUrl),
        storyboardImageUrls: urls(input.storyboardImageUrls, input.storyboardImageUrl),
        storyboardImageWidth: optionalPositiveInteger(input.storyboardImageWidth),
        storyboardImageHeight: optionalPositiveInteger(input.storyboardImageHeight),
        storyboardImageDeletedAt: optionalText(input.storyboardImageDeletedAt),
        storyboardEndStatus: taskStatus(input.storyboardEndStatus),
        storyboardEndAttempt: optionalPositiveInteger(input.storyboardEndAttempt),
        storyboardEndTaskId: optionalText(input.storyboardEndTaskId),
        storyboardEndError: optionalText(input.storyboardEndError),
        storyboardEndImageUrl: stableUrl(input.storyboardEndImageUrl),
        storyboardEndImageRemoteUrl: stableUrl(input.storyboardEndImageRemoteUrl),
        storyboardEndImageUrls: urls(input.storyboardEndImageUrls, input.storyboardEndImageUrl),
        storyboardEndImageWidth: optionalPositiveInteger(input.storyboardEndImageWidth),
        storyboardEndImageHeight: optionalPositiveInteger(input.storyboardEndImageHeight),
        storyboardEndImageDeletedAt: optionalText(input.storyboardEndImageDeletedAt),
        generationStatus: taskStatus(input.generationStatus),
        generationAttempt: optionalPositiveInteger(input.generationAttempt),
        generationRunId: optionalText(input.generationRunId),
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
        characterId: optionalText(input.characterId),
        voiceIdentityId: optionalText(input.voiceIdentityId),
        voiceId: optionalText(input.voiceId),
        voiceBlueprintVersion: optionalPositiveInteger(input.voiceBlueprintVersion),
        voiceAssignmentSource: input.voiceAssignmentSource === "manual" || input.voiceAssignmentSource === "gpt" || input.voiceAssignmentSource === "auto" ? input.voiceAssignmentSource : undefined,
    };
}

function normalizeShotFramePlan(value: unknown, duration: number, actionPrompt: string, imagePrompt: string): DramaShotFramePlan | undefined {
    const input = object(value);
    const start = object(input.start);
    const end = object(input.end);
    if (!Object.keys(input).length) return undefined;
    const manifest = array(input.referenceManifest).flatMap((item) => {
        const itemInput = object(item);
        const alias = cleanText(itemInput.alias);
        const role = cleanText(itemInput.role);
        if (!alias || !["previous_actual_tail", "character_anchor", "scene_anchor", "prop_anchor", "action_keyframe", "composition_keyframe"].includes(role)) return [];
        return [
            { alias, role: role as DramaReferenceManifestItem["role"], purpose: cleanText(itemInput.purpose), assetId: optionalText(itemInput.assetId), shotId: optionalText(itemInput.shotId), frameEvidenceId: optionalText(itemInput.frameEvidenceId) },
        ];
    });
    return {
        start: { source: start.source === "previous_accepted_actual_tail" ? "previous_accepted_actual_tail" : "independent" },
        end: { required: Boolean(end.required) },
        frames: normalizeDramaFrameBeats(
            array(input.frames).length
                ? array(input.frames).map((item, index) => {
                      const frame = object(item);
                      return {
                          id: cleanText(frame.id) || `frame-${nanoid()}`,
                          sequenceIndex: Math.max(1, Math.floor(Number(frame.sequenceIndex) || index + 1)),
                          startSecond: Number(frame.startSecond),
                          endSecond: Number(frame.endSecond),
                          actionPrompt: cleanText(frame.actionPrompt),
                          imagePrompt: cleanText(frame.imagePrompt),
                      };
                  })
                : defaultDramaFrameBeats(duration, actionPrompt, imagePrompt),
            duration,
        ),
        ...(manifest.length ? { referenceManifest: manifest } : {}),
        ...(Object.keys(object(input.referenceCount)).length ? { referenceCount: { min: Math.max(1, Math.floor(Number(object(input.referenceCount).min) || 1)), max: Math.max(1, Math.floor(Number(object(input.referenceCount).max) || 1)) } } : {}),
    };
}

function normalizeFrameEvidence(value: unknown): DramaFrameEvidence[] {
    return array(value).flatMap((item) => {
        const input = object(item);
        const role = input.role;
        const source = input.source;
        const validity = input.validity;
        const mediaUrl = stableUrl(input.mediaUrl);
        if (
            !mediaUrl ||
            !["storyboard_start", "storyboard_end", "storyboard_keyframe", "actual_start", "actual_end"].includes(String(role)) ||
            !["package", "generated", "upload", "video_extraction"].includes(String(source)) ||
            !["candidate", "accepted", "rejected", "superseded", "unavailable"].includes(String(validity))
        )
            return [];
        return [
            {
                id: cleanText(input.id) || `frame-${nanoid()}`,
                role: role as DramaFrameEvidence["role"],
                source: source as DramaFrameEvidence["source"],
                mediaUrl,
                remoteUrl: stableUrl(input.remoteUrl),
                sourceShotId: optionalText(input.sourceShotId),
                sourceVideoUrl: stableUrl(input.sourceVideoUrl),
                generationRunId: optionalText(input.generationRunId),
                generationTaskId: optionalText(input.generationTaskId),
                assetId: optionalText(input.assetId),
                contentHash: cleanText(input.contentHash) || `frame-${nanoid()}`,
                validity: validity as DramaFrameEvidence["validity"],
                createdAt: parseTimestamp(input.createdAt) ? new Date(parseTimestamp(input.createdAt)).toISOString() : new Date().toISOString(),
                acceptedAt: optionalText(input.acceptedAt),
                rejectedAt: optionalText(input.rejectedAt),
                invalidReason: optionalText(input.invalidReason),
                sequenceIndex: optionalPositiveInteger(input.sequenceIndex),
            },
        ];
    });
}

function normalizeStoryboardFrames(value: unknown): DramaShot["storyboardFrames"] {
    return array(value)
        .flatMap((item, index) => {
            const input = object(item);
            const sequenceIndex = Math.floor(Number(input.sequenceIndex) || index + 1);
            if (sequenceIndex < 1 || sequenceIndex > 9) return [];
            const status = taskStatus(input.status) || "idle";
            return [
                {
                    id: cleanText(input.id) || `keyframe-${nanoid()}`,
                    sequenceIndex,
                    mediaUrl: stableUrl(input.mediaUrl),
                    remoteUrl: stableUrl(input.remoteUrl),
                    width: optionalPositiveInteger(input.width),
                    height: optionalPositiveInteger(input.height),
                    source: ["package", "generated", "upload"].includes(String(input.source)) ? (input.source as "package" | "generated" | "upload") : "upload",
                    status,
                    taskId: optionalText(input.taskId),
                    error: optionalText(input.error),
                    inputHash: optionalText(input.inputHash),
                    continuityStatus:
                        input.continuityStatus === "pending" || input.continuityStatus === "passed" || input.continuityStatus === "needs_review" || input.continuityStatus === "stale"
                            ? (input.continuityStatus as "pending" | "passed" | "needs_review" | "stale")
                            : undefined,
                    continuityEvidenceId: optionalText(input.continuityEvidenceId),
                },
            ];
        })
        .sort((left, right) => left.sequenceIndex - right.sequenceIndex)
        .slice(0, 9);
}

function normalizeNamedAssets(value: unknown, prefix: string, character = false): DramaNamedAsset[] {
    return array(value)
        .map((item) => {
            const input = object(item);
            const id = cleanText(input.id) || `${prefix}-${nanoid()}`;
            const references = normalizeAssetReferences(input.references, id, input.referenceImageUrl, input.referenceStorageKey);
            const primaryReferenceId = references.some((reference) => reference.id === input.primaryReferenceId && reference.status === "approved") ? String(input.primaryReferenceId) : undefined;
            const primaryReference = references.find((reference) => reference.id === primaryReferenceId);
            return {
                id,
                code: optionalText(input.code),
                name: cleanText(input.name),
                description: cleanText(input.description),
                fieldOrigins: normalizeFieldOrigins(input.fieldOrigins),
                activeEpisodeCodes: ids(input.activeEpisodeCodes),
                profile: normalizeAssetProfile(input.profile, `${cleanText(input.description)}\n${cleanText(object(input.profile).designPrompt)}`, cleanText(input.name), prefix === "scene"),
                references,
                primaryReferenceId,
                referenceImageUrl: primaryReference?.url,
                referenceStorageKey: primaryReference?.storageKey,
                refinementHistory: normalizeRefinementHistory(input.refinementHistory),
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
        const primaryReferenceId = references.some((reference) => reference.id === input.primaryReferenceId && reference.status === "approved") ? String(input.primaryReferenceId) : undefined;
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

function normalizeAssetProfile(value: unknown, source = "", name = "资产", location = false): DramaAssetProfile {
    const input = object(value);
    const rawVisualIdentity = cleanText(input.visualIdentity);
    const visualIdentity = rawVisualIdentity && !/^不可变为/u.test(rawVisualIdentity) ? rawVisualIdentity : source.split("\n")[0] || `${name}的固定外观与识别特征`;
    const sourceText = source.trim();
    const rawStyling = cleanText(input.styling);
    const styling = rawStyling && rawStyling !== "服装与造型按制作包设定保持稳定" && !(location && isCharacterStylingFallback(rawStyling)) ? rawStyling : inferAssetStyling(sourceText, name, location);
    const colorPalette = cleanText(input.colorPalette) && cleanText(input.colorPalette) !== "沿用项目主色板，保持跨镜头色彩一致" ? cleanText(input.colorPalette) : inferAssetPalette(sourceText);
    const rawConsistency = cleanText(input.consistencyRules);
    const spatialRules = ids(input.spatialRules);
    return {
        visualIdentity,
        styling,
        colorPalette,
        consistencyRules: rawConsistency && rawConsistency !== "按设计 Prompt 保持一致" && !/^固定：不可变为/u.test(rawConsistency)
            ? rawConsistency
            : location
              ? inferLocationConsistencyRules(name, source, spatialRules, styling, colorPalette)
              : `固定${name}的外观、服装、配色和动作状态，不随镜头重设计；${visualIdentity}`,
        designPrompt: optionalText(input.designPrompt),
        identityAnchors: ids(input.identityAnchors),
        spatialRules,
        stateRules: ids(input.stateRules),
        forbiddenChanges: ids(input.forbiddenChanges),
    };
}

function inferLocationConsistencyRules(name: string, source: string, spatialRules: string[], styling: string, colorPalette: string) {
    const fixedText = spatialRules.filter(Boolean).join("；") || styling || source.split("。格")[0] || `${name}的主要空间结构按设计基准锁定`;
    const paletteText = colorPalette && !colorPalette.startsWith("按制作包描述") ? `；环境色与光向保持${colorPalette}` : "";
    return `固定${name}的空间拓扑、入口方向、主要陈设位置与镜头轴线，不随镜头重排；${fixedText}${paletteText}。`;
}

function inferAssetStyling(source: string, name: string, location = false) {
    if (location) return source.match(/(?:陈设|材质|建筑|空间|地面|墙面|入口|固定元素|固定空间)(?:为|是|：)?([^。\n]+)/u)?.[0]?.trim() || `${name}的空间陈设、建筑结构、地面与环境材质按描述固定`;
    return source.match(/(?:服装|造型|制服|斗篷|外套|围裙)(?:为|是|：)?([^。\n]+)/u)?.[0]?.trim() || `${name}的发型、服装、随身物件与材质按描述固定`;
}

function isCharacterStylingFallback(value: string) {
    return /发型、服装、随身物件与材质按描述固定/u.test(value);
}

function inferAssetPalette(source: string) {
    const colors = [...new Set(source.match(/(?:深紫黑|紫黑|皇家深蓝|海军蓝|烟紫|深墨绿|灰蓝|炭灰|暗红|深棕|旧银|铁灰|煤黑|暗琥珀|浅灰蓝|亚麻金|深栗棕|灰绿色|琥珀棕)/gu) || [])];
    return colors.length ? colors.join("、") : "按制作包描述中的固有色保持跨镜头一致";
}

function recoverGenericDramaAssetProfiles(project: DramaProject) {
    let changed = false;
    const repair = <T extends DramaNamedAsset>(asset: T) => {
        const source = `${asset.description}\n${asset.profile?.designPrompt || ""}`.trim();
        const isScene = project.scenes.some((scene) => scene.id === asset.id);
        const hasGenericProfile = asset.profile?.styling === "服装与造型按制作包设定保持稳定" || asset.profile?.colorPalette === "沿用项目主色板，保持跨镜头色彩一致" || asset.profile?.visualIdentity?.startsWith("不可变为") || asset.profile?.consistencyRules === "按设计 Prompt 保持一致" || asset.profile?.consistencyRules?.startsWith("固定：不可变为");
        if (!hasGenericProfile && source.length < 20) return asset;
        const profile = normalizeAssetProfile(asset.profile, `${asset.description}\n${asset.profile?.designPrompt || ""}`, asset.name, isScene);
        if (JSON.stringify(profile) === JSON.stringify(asset.profile || {})) return asset;
        changed = true;
        return { ...asset, profile };
    };
    const characters = project.characters.map(repair);
    const scenes = project.scenes.map(repair);
    const props = project.props.map(repair);
    const clues = project.clues.map(repair);
    return changed ? { ...project, characters, scenes, props, clues, updatedAt: nextTimestamp(project.updatedAt) } : null;
}

function normalizeAssetReferences(value: unknown, assetId: string, legacyUrl: unknown, legacyStorageKey: unknown): DramaAssetReference[] {
    const usedIds = new Set<string>();
    const references: DramaAssetReference[] = array(value).flatMap((item, index): DramaAssetReference[] => {
        const input = object(item);
        const url = stableUrl(input.url);
        if (!url) return [];
        const source: DramaAssetReference["source"] = input.source === "generated" || input.source === "library" ? input.source : "upload";
        const baseId = cleanText(input.id) || `${assetId}-reference-${index + 1}`;
        let id = baseId;
        let suffix = 2;
        while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
        usedIds.add(id);
        return [
            {
                id,
                url,
                remoteUrl: stableUrl(input.remoteUrl),
                storageKey: optionalText(input.storageKey),
                source,
                label: cleanText(input.label) || `参考图 ${index + 1}`,
                width: optionalPositiveInteger(input.width),
                height: optionalPositiveInteger(input.height),
                createdAt: timestamp(input.createdAt) || new Date(0).toISOString(),
                status: input.status === "approved" || input.status === "rejected" ? input.status : "candidate",
                version: optionalPositiveInteger(input.version),
                contentHash: optionalText(input.contentHash),
                approvedAt: timestamp(input.approvedAt),
                promptVersion: optionalPositiveInteger(input.promptVersion),
                compiledPrompt: optionalText(input.compiledPrompt),
                promptChanges: normalizePromptChanges(input.promptChanges),
                logicalModelId: optionalText(input.logicalModelId),
                generationTaskId: optionalText(input.generationTaskId),
                generationStage: input.generationStage === "initial" || input.generationStage === "refinement" ? input.generationStage : undefined,
                reviewStatus: normalizeReferenceReviewStatus(input.reviewStatus),
                reviewSummary: optionalText(input.reviewSummary),
                reviewIssues: normalizeReviewIssues(input.reviewIssues),
                refinement: normalizeRefinementProposal(input.refinement),
            },
        ];
    });
    const url = stableUrl(legacyUrl);
    if (!references.length && url)
        references.push({ id: `${assetId}-reference-legacy`, url, storageKey: optionalText(legacyStorageKey), source: "library", status: "candidate", label: "原参考图", width: undefined, height: undefined, createdAt: new Date(0).toISOString() });
    return references;
}

function assetReferencesForApproval(asset: DramaNamedAsset) {
    return normalizeAssetReferences(asset.references, asset.id, asset.referenceImageUrl, asset.referenceStorageKey);
}

function normalizePromptChanges(value: unknown): DramaAssetRefinementChange[] | undefined {
    const fields = new Set<DramaAssetRefinementChange["field"]>(["description", "visualIdentity", "styling", "colorPalette", "consistencyRules"]);
    const changes = array(value).flatMap((item): DramaAssetRefinementChange[] => {
        const input = object(item);
        const field = cleanText(input.field) as DramaAssetRefinementChange["field"];
        const after = cleanText(input.after);
        if (!fields.has(field) || !after) return [];
        return [{ field, before: cleanText(input.before), after, reason: cleanText(input.reason) }];
    });
    return changes.length ? changes : undefined;
}

function normalizeReferenceReviewStatus(value: unknown): DramaAssetReference["reviewStatus"] {
    return value === "pending" || value === "reviewing" || value === "passed" || value === "needs_revision" || value === "rejected" || value === "unavailable" ? value : undefined;
}

function normalizeReviewIssues(value: unknown): DramaAssetReference["reviewIssues"] {
    const issues = array(value).flatMap((item) => {
        const input = object(item);
        const category = cleanText(input.category);
        const message = cleanText(input.message);
        const severity = input.severity === "low" || input.severity === "medium" || input.severity === "high" ? input.severity : undefined;
        return category && message && severity ? [{ category, severity: severity as "low" | "medium" | "high", message, correction: optionalText(input.correction) }] : [];
    });
    return issues.length ? issues : undefined;
}

function normalizeRefinementProposal(value: unknown): DramaAssetRefinementProposal | undefined {
    const input = object(value);
    const updated = object(input.updatedProfile);
    const compiledPrompt = cleanText(input.compiledPrompt);
    if (!compiledPrompt) return undefined;
    return {
        reply: cleanText(input.reply),
        changes: normalizePromptChanges(input.changes) || [],
        updatedDescription: optionalText(input.updatedDescription),
        updatedProfile: normalizeAssetProfile(updated),
        compiledPrompt,
        negativePrompt: cleanText(input.negativePrompt),
        preservedRules: ids(input.preservedRules),
    };
}

function normalizeRefinementHistory(value: unknown): DramaAssetRefinementMessage[] | undefined {
    const messages = array(value).flatMap((item): DramaAssetRefinementMessage[] => {
        const input = object(item);
        const request = cleanText(input.request);
        const proposal = normalizeRefinementProposal(input.proposal);
        if (!request || !proposal) return [];
        return [
            {
                id: cleanText(input.id) || `refinement-${nanoid()}`,
                request,
                reply: cleanText(input.reply) || proposal.reply,
                proposal,
                createdAt: timestamp(input.createdAt) || new Date(0).toISOString(),
            },
        ];
    });
    return messages.length ? messages : undefined;
}

function normalizeVoiceProfile(value: unknown) {
    return normalizeDramaVoiceProfile(value);
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
                characterId: cleanText(input.characterId) || undefined,
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

function texts(value: unknown) {
    return ids(value);
}

function reviewStatus(value: unknown): DramaEpisode["reviewStatus"] {
    return value === "content_review" || value === "approved" || value === "visual_ready" ? value : "draft";
}

function videoMode(value: unknown): DramaVideoMode {
    return value === "direct" ? value : "storyboard";
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
        visualStyle: normalizeDramaStyleName(cleanText(input.visualStyle) || cleanText(style)),
        colorScript: optionalText(input.colorScript) || DRAMA_STYLE_COLOR_SCRIPT,
        soundBible: optionalText(input.soundBible),
        globalNegativePrompt: optionalText(input.globalNegativePrompt),
        subtitleSafeArea: optionalText(input.subtitleSafeArea),
        continuityMode: input.continuityMode === "balanced" ? "balanced" : "strict",
        productionPlan: normalizeDramaProductionPlan(input.productionPlan),
    };
}

function normalizeStoryScenes(value: unknown): DramaStoryScene[] {
    return array(value).flatMap((item, index) => {
        const input = object(item);
        const id = cleanText(input.id);
        if (!id) return [];
        return [
            {
                id,
                code: optionalText(input.code),
                order: Math.max(1, Math.floor(Number(input.order) || index + 1)),
                title: cleanText(input.title) || `场 ${index + 1}`,
                timeOfDay: optionalText(input.timeOfDay),
                timeRange: optionalText(input.timeRange),
                locationId: optionalText(input.locationId),
                summary: cleanText(input.summary),
                shotIds: ids(input.shotIds),
                fieldOrigins: normalizeFieldOrigins(input.fieldOrigins),
            },
        ];
    });
}

function normalizeContinuityEdges(value: unknown): DramaContinuityEdge[] {
    return array(value).flatMap((item) => {
        const input = object(item);
        const fromShotId = cleanText(input.fromShotId);
        const toShotId = cleanText(input.toShotId);
        if (!fromShotId || !toShotId || fromShotId === toShotId) return [];
        const transition = ["continuous", "match_cut", "hard_cut", "scene_change", "jump_cut"].includes(cleanText(input.transition)) ? (cleanText(input.transition) as DramaContinuityEdge["transition"]) : "hard_cut";
        return [
            {
                fromShotId,
                toShotId,
                transition,
                inheritActualEndFrame: Boolean(input.inheritActualEndFrame),
                carryCharacterIds: ids(input.carryCharacterIds),
                carryPropIds: ids(input.carryPropIds),
                carryEnvironment: Boolean(input.carryEnvironment),
                carryAxis: Boolean(input.carryAxis),
                notes: optionalText(input.notes),
            },
        ];
    });
}

function normalizePerformancePlan(value: unknown): DramaPerformancePlan | undefined {
    const input = object(value);
    const beat = (raw: unknown) => {
        const item = object(raw);
        return { emotion: optionalText(item.emotion) || "", facialAction: optionalText(item.facialAction) || "", gaze: optionalText(item.gaze) || "", bodyAction: optionalText(item.bodyAction) || "" };
    };
    if (!Object.keys(input).length) return undefined;
    const beats = object(input.beats);
    return {
        emotionalObjective: optionalText(input.emotionalObjective) || "",
        emotionalArc: optionalText(input.emotionalArc) || "",
        speechStyle: optionalText(input.speechStyle) || "",
        pace: optionalText(input.pace) || "",
        breath: optionalText(input.breath) || "",
        restraintLevel: optionalText(input.restraintLevel) || "",
        beats: { start: beat(beats.start), middle: beat(beats.middle), end: beat(beats.end) },
    };
}

function normalizeDialoguePerformance(value: unknown): DramaDialoguePerformance[] | undefined {
    const items = array(value).flatMap((raw) => {
        const item = object(raw);
        const utteranceId = optionalText(item.utteranceId);
        return utteranceId
            ? [
                  {
                      utteranceId,
                      intent: optionalText(item.intent) || "",
                      tone: optionalText(item.tone) || "",
                      pace: optionalText(item.pace) || "",
                      pause: optionalText(item.pause) || "",
                      emphasis: optionalText(item.emphasis) || "",
                      facialReactionBefore: optionalText(item.facialReactionBefore) || "",
                      facialReactionDuring: optionalText(item.facialReactionDuring) || "",
                      facialReactionAfter: optionalText(item.facialReactionAfter) || "",
                  },
              ]
            : [];
    });
    return items.length ? items : undefined;
}

function normalizeLightingPlan(value: unknown): DramaLightingPlan | undefined {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    return {
        palette: optionalText(input.palette) || "",
        colorTemperature: optionalText(input.colorTemperature) || "",
        keyLight: optionalText(input.keyLight) || "",
        fillLight: optionalText(input.fillLight) || "",
        rimLight: optionalText(input.rimLight) || "",
        contrast: optionalText(input.contrast) || "",
        materialResponse: optionalText(input.materialResponse) || "",
        skinToneProtection: optionalText(input.skinToneProtection) || "",
        inheritFromPrevious: optionalText(input.inheritFromPrevious) || "",
        transitionToNext: optionalText(input.transitionToNext) || "",
    };
}

function normalizeContinuityState(value: unknown): DramaContinuityState | undefined {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    const entities = (value: unknown) =>
        array(value).flatMap((item) => {
            const entity = object(item);
            const assetId = cleanText(entity.assetId);
            return assetId
                ? [
                      {
                          assetId,
                          wardrobe: optionalText(entity.wardrobe),
                          position: optionalText(entity.position),
                          gaze: optionalText(entity.gaze),
                          pose: optionalText(entity.pose),
                          expression: optionalText(entity.expression),
                          action: optionalText(entity.action),
                          state: optionalText(entity.state),
                          holderId: optionalText(entity.holderId),
                      },
                  ]
                : [];
        });
    return {
        characters: entities(input.characters),
        props: entities(input.props),
        environment: optionalText(input.environment),
        lighting: optionalText(input.lighting),
        axis: optionalText(input.axis),
        screenDirection: optionalText(input.screenDirection),
    };
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

function urls(value: unknown, fallback?: unknown) {
    const values = [...array(value), fallback].map((item) => stableUrl(item)).filter((item): item is string => Boolean(item));
    return Array.from(new Set(values));
}
