import { nanoid } from "nanoid";
import { create } from "zustand";

import { createClientSessionEpoch, type ClientSessionStamp } from "@/lib/client-session-epoch";
import type {
    CreateDramaProjectInput,
    DramaAssetReference,
    DramaCharacter,
    DramaClue,
    DramaContentAnalysis,
    DramaEpisode,
    DramaProject,
    DramaProjectSummary,
    DramaProductionArchive,
    DramaProp,
    DramaReviewCompletion,
    DramaScene,
    DramaShot,
    DramaNamedAsset,
    DramaVisualAnalysis,
} from "@/lib/drama-project-contract";
import { summarizeDramaProject } from "@/lib/drama-project-summary";
import { activeFrameEvidence } from "@/lib/drama-continuity-policy";
import type { DramaSourceEpisodeDraft } from "@/lib/drama-source-splitter";
import { ensureUniqueDramaAssetReferenceIds } from "../[id]/drama-asset-reference-utils";
import { dramaShotVideoMode } from "../[id]/drama-shot-generation-utils";
import { createDramaProject, createDramaProjectVersion, deleteDramaProject, getDramaProject, listDramaProjectSummaries, listDramaProjectVersions, restoreDramaProjectVersion, saveDramaProject } from "@/services/api/drama-projects";
import { useUserStore } from "@/stores/use-user-store";

type DramaStore = {
    hydrated: boolean;
    hydratedUserId: string;
    syncError?: string;
    saveStateByProject: Record<string, { status: "saving" | "saved" | "error"; savedAt?: string }>;
    summaries: DramaProjectSummary[];
    summaryTotal: number;
    summaryPage: number;
    summaryPageSize: number;
    summaryLoadingMore: boolean;
    projects: DramaProject[];
    videoPromptRuns: Record<string, { startedAt: number }>;
    hydrate: (force?: boolean) => Promise<void>;
    loadMore: () => Promise<void>;
    loadProject: (id: string, force?: boolean) => Promise<DramaProject>;
    createProject: (input: CreateDramaProjectInput) => Promise<string>;
    deleteProject: (id: string) => Promise<void>;
    updateProject: (id: string, patch: Partial<Pick<DramaProject, "title" | "summary" | "style" | "ratio" | "status" | "creativeConversationId" | "defaultVideoMode" | "productionBible">>) => void;
    addCharacter: (projectId: string, input: Omit<DramaCharacter, "id">) => void;
    addScene: (projectId: string, input: Omit<DramaScene, "id">) => void;
    addProp: (projectId: string, input: Omit<DramaProp, "id">) => void;
    addClue: (projectId: string, input: Omit<DramaClue, "id">) => void;
    updateAsset: (projectId: string, kind: DramaAssetKind, id: string, patch: Partial<DramaCharacter & DramaClue>, options?: { markShotsStale?: boolean }) => void;
    approveAssetReference: (projectId: string, kind: DramaAssetKind, id: string, referenceId: string) => boolean;
    removeAsset: (projectId: string, kind: DramaAssetKind, id: string) => void;
    addEpisode: (projectId: string) => void;
    importEpisodes: (projectId: string, drafts: DramaSourceEpisodeDraft[]) => void;
    deleteEpisode: (projectId: string, episodeId: string) => void;
    selectEpisode: (projectId: string, episodeId: string) => void;
    updateEpisode: (
        projectId: string,
        episodeId: string,
        patch: Partial<Pick<DramaEpisode, "title" | "canvasProjectId" | "script" | "scriptRichContent" | "outline" | "hook" | "nextPreview" | "sourceRange" | "reviewStatus" | "renderTask" | "reviewCompletionTask" | "visualReview">>,
    ) => void;
    buildStoryboard: (projectId: string, episodeId: string) => void;
    updateShot: (projectId: string, episodeId: string, shotId: string, patch: Partial<DramaShot>) => void;
    replaceShot: (projectId: string, episodeId: string, shotId: string, shot: DramaShot, updatedAt?: string) => void;
    saveProjectNow: (projectId: string, updater?: (project: DramaProject) => DramaProject) => Promise<DramaProject>;
    queueShots: (projectId: string, episodeId: string, shotIds: string[]) => void;
    applyContentAnalysis: (projectId: string, episodeId: string, analysis: DramaContentAnalysis) => void;
    applyVisualAnalysis: (projectId: string, episodeId: string, analysis: DramaVisualAnalysis) => void;
    applyReviewCompletion: (projectId: string, episodeId: string, analysis: DramaReviewCompletion) => void;
    applyContinuitySuggestion: (projectId: string, episodeId: string, analysis: DramaReviewCompletion) => void;
    replaceProject: (project: DramaProject) => void;
    beginVideoPrompt: (projectId: string, episodeId: string, shotId: string) => boolean;
    finishVideoPrompt: (projectId: string, episodeId: string, shotId: string) => void;
    createVersion: (project: DramaProject, reason: string) => Promise<void>;
    listVersions: (projectId: string) => Promise<import("@/lib/drama-project-contract").DramaProjectVersion[]>;
    restoreVersion: (projectId: string, versionId: string) => Promise<void>;
    queueAudio: (projectId: string, episodeId: string, shotIds: string[]) => void;
    reset: () => void;
};

type DramaAssetKind = "characters" | "scenes" | "props" | "clues";

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const saveQueues = new Map<string, Promise<void>>();
const suspendedSaves = new Set<string>();
const latestProjectTimes = new Map<string, number>();
const projectRequests = new Map<string, Promise<DramaProject>>();
const sessionEpoch = createClientSessionEpoch(() => useUserStore.getState().user?.id || "");
let hydrateRequestId = 0;
let hydrateRequest: (ClientSessionStamp & { requestId: number; promise: Promise<void> }) | null = null;
const SUMMARY_PAGE_SIZE = 12;

export function dramaVideoPromptRunKey(projectId: string, episodeId: string, shotId: string) {
    return JSON.stringify([projectId, episodeId, shotId]);
}

export function hasActiveDramaVideoPromptRun(runs: Record<string, unknown>, projectId: string, episodeId: string) {
    return Object.keys(runs).some((key) => {
        try {
            const value = JSON.parse(key);
            return Array.isArray(value) && value[0] === projectId && value[1] === episodeId;
        } catch {
            return false;
        }
    });
}

export const useDramaStore = create<DramaStore>((set, get) => ({
    hydrated: false,
    hydratedUserId: "",
    saveStateByProject: {},
    summaries: [],
    summaryTotal: 0,
    summaryPage: 0,
    summaryPageSize: SUMMARY_PAGE_SIZE,
    summaryLoadingMore: false,
    projects: [],
    videoPromptRuns: {},
    hydrate: async (force = false) => {
        const userId = useUserStore.getState().user?.id || "";
        if (!userId) {
            invalidateSession();
            set({ hydrated: true, hydratedUserId: "", summaries: [], summaryTotal: 0, summaryPage: 0, summaryPageSize: SUMMARY_PAGE_SIZE, summaryLoadingMore: false, projects: [], syncError: undefined, videoPromptRuns: {} });
            return;
        }
        if (!force && get().hydrated && get().hydratedUserId === userId) return;
        const session = sessionEpoch.capture();
        if (!force && hydrateRequest?.userId === session.userId && hydrateRequest.epoch === session.epoch) return hydrateRequest.promise;
        const requestId = ++hydrateRequestId;
        set((state) => ({
            hydrated: false,
            hydratedUserId: userId,
            summaries: state.hydratedUserId === userId ? state.summaries : [],
            summaryTotal: state.hydratedUserId === userId ? state.summaryTotal : 0,
            summaryPage: state.hydratedUserId === userId ? state.summaryPage : 0,
            summaryLoadingMore: false,
            projects: state.hydratedUserId === userId ? state.projects : [],
            videoPromptRuns: state.hydratedUserId === userId ? state.videoPromptRuns : {},
            saveStateByProject: state.hydratedUserId === userId ? state.saveStateByProject : {},
            syncError: undefined,
        }));
        const promise = listDramaProjectSummaries({ page: 1, pageSize: SUMMARY_PAGE_SIZE })
            .then((result) => {
                if (!isActiveHydrate(session, requestId)) return;
                set({ summaries: result.projects, summaryTotal: result.total, summaryPage: result.page, summaryPageSize: result.pageSize, hydrated: true, hydratedUserId: userId });
            })
            .catch((error) => {
                if (isActiveHydrate(session, requestId)) set({ summaries: [], summaryTotal: 0, summaryPage: 0, hydrated: false, hydratedUserId: userId, syncError: error instanceof Error ? error.message : "短剧项目加载失败" });
            })
            .finally(() => {
                if (hydrateRequest?.requestId === requestId) hydrateRequest = null;
            });
        hydrateRequest = { ...session, requestId, promise };
        return promise;
    },
    loadMore: async () => {
        const session = requireSession();
        const state = get();
        if (!state.hydrated || state.summaryLoadingMore || state.summaries.length >= state.summaryTotal) return;
        const page = state.summaryPage + 1;
        set({ summaryLoadingMore: true, syncError: undefined });
        try {
            const result = await listDramaProjectSummaries({ page, pageSize: state.summaryPageSize });
            assertCurrent(session);
            set((current) => {
                const existing = new Set(current.summaries.map((item) => item.id));
                return {
                    summaries: [...current.summaries, ...result.projects.filter((item) => !existing.has(item.id))],
                    summaryTotal: result.total,
                    summaryPage: result.page,
                    summaryPageSize: result.pageSize,
                    summaryLoadingMore: false,
                };
            });
        } catch (error) {
            if (sessionEpoch.isCurrent(session)) set({ summaryLoadingMore: false, syncError: error instanceof Error ? error.message : "更多项目加载失败" });
        }
    },
    loadProject: async (id, force = false) => {
        const session = requireSession();
        const current = get().projects.find((project) => project.id === id);
        if (!force && current) return current;
        const key = sessionEpoch.key(session, id);
        const pending = projectRequests.get(key);
        if (!force && pending) return pending;
        const request = getDramaProject(id)
            .then((project) => {
                assertCurrent(session);
                latestProjectTimes.set(key, Date.parse(project.updatedAt) || Date.now());
                set((state) => ({
                    projects: [project, ...state.projects.filter((item) => item.id !== project.id)],
                    summaries: upsertSummary(state.summaries, project),
                    syncError: undefined,
                    saveStateByProject: { ...state.saveStateByProject, [project.id]: { status: "saved", savedAt: project.updatedAt } },
                }));
                return project;
            })
            .finally(() => {
                if (projectRequests.get(key) === request) projectRequests.delete(key);
            });
        projectRequests.set(key, request);
        return request;
    },
    createProject: async (input) => {
        const session = requireSession();
        const project = await createDramaProject(input);
        assertCurrent(session);
        set((state) => {
            const known = state.summaries.some((item) => item.id === project.id);
            return {
                projects: [project, ...state.projects.filter((item) => item.id !== project.id)],
                summaries: upsertSummary(state.summaries, project),
                summaryTotal: known ? state.summaryTotal : state.summaryTotal + 1,
                saveStateByProject: { ...state.saveStateByProject, [project.id]: { status: "saved", savedAt: project.updatedAt } },
            };
        });
        return project.id;
    },
    deleteProject: async (id) => {
        const session = requireSession();
        const key = sessionEpoch.key(session, id);
        clearProjectSave(session, id);
        await saveQueues.get(key)?.catch(() => undefined);
        assertCurrent(session);
        await deleteDramaProject(id);
        if (!sessionEpoch.isCurrent(session)) return;
        latestProjectTimes.delete(key);
        set((state) => ({ projects: state.projects.filter((project) => project.id !== id), summaries: state.summaries.filter((project) => project.id !== id), summaryTotal: Math.max(0, state.summaryTotal - 1) }));
    },
    updateProject: (id, patch) => mutateProject(id, (project) => ({ ...project, ...patch })),
    addCharacter: (projectId, input) => mutateProject(projectId, (project) => ({ ...project, characters: [...project.characters, { ...input, id: `character-${nanoid()}` }] })),
    addScene: (projectId, input) => mutateProject(projectId, (project) => ({ ...project, scenes: [...project.scenes, { ...input, id: `scene-${nanoid()}` }] })),
    addProp: (projectId, input) => mutateProject(projectId, (project) => ({ ...project, props: [...project.props, { ...input, id: `prop-${nanoid()}` }] })),
    addClue: (projectId, input) => mutateProject(projectId, (project) => ({ ...project, clues: [...project.clues, { ...input, id: `clue-${nanoid()}` }] })),
    updateAsset: (projectId, kind, id, patch, options) =>
        mutateProject(projectId, (project) => {
            const updated = { ...project, [kind]: project[kind].map((item) => (item.id === id ? { ...item, ...patch, id } : item)) };
            if (options?.markShotsStale === false) return updated;
            return {
                ...updated,
                episodes: updated.episodes.map((episode) => {
                    const direct = new Set(episode.shots.filter((shot) => shot.characterIds.includes(id) || shot.sceneId === id || shot.propIds.includes(id) || shot.clueIds.includes(id)).map((shot) => shot.id));
                    let changed = true;
                    while (changed) {
                        changed = false;
                        for (const edge of episode.continuityEdges || [])
                            if (edge.inheritActualEndFrame && direct.has(edge.fromShotId) && !direct.has(edge.toShotId)) {
                                direct.add(edge.toShotId);
                                changed = true;
                            }
                    }
                    return {
                        ...episode,
                        shots: episode.shots.map((shot) => (direct.has(shot.id) ? { ...shot, continuityStatus: "stale" as const, continuityError: `资产“${id}”已修改，需要重新审核` } : shot)),
                        visualReview: direct.size ? undefined : episode.visualReview,
                    };
                }),
            };
        }),
    approveAssetReference: (projectId, kind, id, referenceId) =>
        (() => {
            const item = get()
                .projects.find((project) => project.id === projectId)
                ?.[kind].find((asset) => asset.id === id);
            if (!item) return false;
            const itemReferences = assetReferences(item);
            const selected = itemReferences.find((reference) => reference.id === referenceId);
            if (!selected) return false;
            const now = new Date().toISOString();
            const references = itemReferences.map((reference: DramaAssetReference) =>
                reference.id === referenceId ? { ...reference, status: "approved" as const, version: (reference.version || 0) + 1, approvedAt: now } : { ...reference, status: reference.status === "approved" ? ("candidate" as const) : reference.status },
            );
            const primary = references.find((reference) => reference.id === referenceId);
            if (!primary) return false;
            get().updateAsset(
                projectId,
                kind,
                id,
                {
                    references,
                    primaryReferenceId: primary.id,
                    referenceImageUrl: primary.url,
                    referenceStorageKey: primary.storageKey,
                    ...(primary.refinement ? { profile: primary.refinement.updatedProfile, ...(primary.refinement.updatedDescription ? { description: primary.refinement.updatedDescription } : {}) } : {}),
                },
                { markShotsStale: true },
            );
            return true;
        })(),
    removeAsset: (projectId, kind, id) =>
        mutateProject(projectId, (project) => ({
            ...project,
            [kind]: project[kind].filter((item) => item.id !== id),
            episodes: project.episodes.map((episode) => ({
                ...episode,
                shots: episode.shots.map((shot) =>
                    kind === "characters"
                        ? { ...shot, characterIds: shot.characterIds.filter((value) => value !== id) }
                        : kind === "scenes"
                          ? { ...shot, sceneId: shot.sceneId === id ? undefined : shot.sceneId }
                          : kind === "props"
                            ? { ...shot, propIds: shot.propIds.filter((value) => value !== id) }
                            : { ...shot, clueIds: shot.clueIds.filter((value) => value !== id) },
                ),
            })),
        })),
    addEpisode: (projectId) =>
        mutateProject(projectId, (project) => {
            const episode: DramaEpisode = {
                id: `episode-${nanoid()}`,
                title: `第 ${project.episodes.length + 1} 集`,
                script: "",
                outline: "",
                hook: "",
                nextPreview: "",
                sourceRange: "",
                reviewStatus: "draft",
                shots: [],
            };
            return { ...project, activeEpisodeId: episode.id, episodes: [...project.episodes, episode] };
        }),
    importEpisodes: (projectId, drafts) =>
        mutateProject(projectId, (project) => {
            const episodes = drafts.map<DramaEpisode>((draft, index) => ({
                id: `episode-${nanoid()}`,
                title: draft.title || `第 ${index + 1} 集`,
                script: draft.script,
                outline: "",
                hook: "",
                nextPreview: "",
                sourceRange: draft.sourceRange,
                reviewStatus: "draft",
                shots: [],
            }));
            return episodes.length ? { ...project, activeEpisodeId: episodes[0].id, episodes } : project;
        }),
    deleteEpisode: (projectId, episodeId) =>
        mutateProject(projectId, (project) => {
            if (project.episodes.length <= 1) return project;
            const episodes = project.episodes.filter((episode) => episode.id !== episodeId);
            return { ...project, episodes, activeEpisodeId: project.activeEpisodeId === episodeId ? episodes[0].id : project.activeEpisodeId };
        }),
    selectEpisode: (projectId, episodeId) => mutateProject(projectId, (project) => (project.episodes.some((episode) => episode.id === episodeId) ? { ...project, activeEpisodeId: episodeId } : project)),
    updateEpisode: (projectId, episodeId, patch) => mutateProject(projectId, (project) => ({ ...project, episodes: project.episodes.map((episode) => (episode.id === episodeId ? { ...episode, ...patch } : episode)) })),
    buildStoryboard: (projectId, episodeId) =>
        mutateProject(projectId, (project) => ({ ...project, episodes: project.episodes.map((episode) => (episode.id === episodeId ? { ...episode, shots: scriptToShots(episode.script, project), renderTask: undefined } : episode)) })),
    updateShot: (projectId, episodeId, shotId, patch) =>
        mutateProject(projectId, (project) => ({
            ...project,
            episodes: project.episodes.map((episode) => (episode.id === episodeId ? { ...episode, shots: episode.shots.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot)) } : episode)),
        })),
    replaceShot: (projectId, episodeId, shotId, shot, updatedAt) =>
        set((state) => {
            const projects = state.projects.map((project) => {
                if (project.id !== projectId) return project;
                return {
                    ...project,
                    ...(updatedAt ? { updatedAt } : {}),
                    episodes: project.episodes.map((episode) => (episode.id === episodeId ? { ...episode, shots: episode.shots.map((current) => (current.id === shotId ? shot : current)) } : episode)),
                };
            });
            const nextProject = projects.find((project) => project.id === projectId);
            return nextProject ? { projects, summaries: upsertSummary(state.summaries, nextProject) } : state;
        }),
    saveProjectNow: async (projectId, updater) => {
        const session = requireSession();
        clearProjectSave(session, projectId);
        const key = sessionEpoch.key(session, projectId);
        const previous = saveQueues.get(key);
        let saved: DramaProject | undefined;
        const operation = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(async () => {
            assertCurrent(session);
            const currentProject = get().projects.find((item) => item.id === projectId);
            if (!currentProject) throw new Error("短剧项目不存在");
            const project = updater ? { ...updater(currentProject), updatedAt: nextUpdatedAt(session, currentProject) } : currentProject;
            const expectedUpdatedAt = currentProject.updatedAt;
            saved = await saveDramaProject(project);
            assertCurrent(session);
            set((state) => ({
                projects: state.projects.map((item) => (item.id === saved!.id && (updater ? item.updatedAt === expectedUpdatedAt : item.updatedAt === project.updatedAt) ? saved! : item)),
                summaries: upsertSummary(state.summaries, saved!),
                saveStateByProject:
                    state.projects.find((item) => item.id === project.id)?.updatedAt === (updater ? expectedUpdatedAt : project.updatedAt)
                        ? { ...state.saveStateByProject, [saved!.id]: { status: "saved", savedAt: saved!.updatedAt } }
                        : state.saveStateByProject,
            }));
        });
        saveQueues.set(key, operation);
        try {
            await operation;
            if (!saved) throw new Error("短剧项目保存失败");
            return saved;
        } finally {
            if (saveQueues.get(key) === operation) saveQueues.delete(key);
        }
    },
    queueShots: (projectId, episodeId, shotIds) =>
        mutateProject(projectId, (project) => {
            if (project.episodes.find((episode) => episode.id === episodeId)?.reviewStatus !== "visual_ready") return project;
            return updateShots(project, episodeId, shotIds, (shot) => {
                const hasStartFrame = activeFrameEvidence(shot, "storyboard_start").length > 0;
                const hasEndFrame = activeFrameEvidence(shot, "storyboard_end").length > 0;
                const hasAllFrames =
                    shot.storyboardFrameMode === "all_frames" &&
                    Boolean(shot.framePlan?.frames.length) &&
                    shot.framePlan!.frames.every((beat) => {
                        const frame = shot.storyboardFrames?.find((item) => item.id === beat.id || item.sequenceIndex === beat.sequenceIndex);
                        return Boolean(frame?.mediaUrl && frame.status === "success" && frame.continuityStatus !== "needs_review" && frame.continuityStatus !== "stale");
                    });
                const storyboardMode = dramaShotVideoMode(project, shot) === "storyboard";
                const firstLast = shot.storyboardFrameMode === "first_last";
                if (storyboardMode && (hasAllFrames || (hasStartFrame && (!firstLast || hasEndFrame)))) {
                    return {
                        ...shot,
                        storyboardStatus: "success" as const,
                        storyboardEndStatus: firstLast ? ("success" as const) : ("idle" as const),
                        generationStatus: "queued" as const,
                        generationAttempt: (shot.generationAttempt || 0) + 1,
                        generationTaskId: undefined,
                        generationError: undefined,
                        videoUrl: undefined,
                        audioStatus: "idle" as const,
                        audioTaskId: undefined,
                        audioUrl: undefined,
                    };
                }
                if (storyboardMode && hasStartFrame && firstLast) {
                    return {
                        ...shot,
                        storyboardStatus: "success" as const,
                        storyboardEndStatus: "queued" as const,
                        storyboardEndAttempt: (shot.storyboardEndAttempt || 0) + 1,
                        storyboardEndTaskId: undefined,
                        storyboardEndError: undefined,
                        generationStatus: "idle" as const,
                        generationTaskId: undefined,
                        generationError: undefined,
                        videoUrl: undefined,
                    };
                }
                return dramaShotVideoMode(project, shot) !== "storyboard"
                    ? {
                          ...shot,
                          generationStatus: "queued",
                          generationAttempt: (shot.generationAttempt || 0) + 1,
                          generationTaskId: undefined,
                          generationError: undefined,
                          videoUrl: undefined,
                          audioStatus: "idle",
                          audioTaskId: undefined,
                          audioUrl: undefined,
                      }
                    : shot.storyboardStatus === "success" && hasStartFrame && (shot.storyboardFrameMode !== "first_last" || (shot.storyboardEndStatus === "success" && hasEndFrame))
                      ? {
                            ...shot,
                            generationStatus: "queued",
                            generationAttempt: (shot.generationAttempt || 0) + 1,
                            generationTaskId: undefined,
                            generationError: undefined,
                            videoUrl: undefined,
                            audioStatus: "idle",
                            audioTaskId: undefined,
                            audioUrl: undefined,
                        }
                      : shot.storyboardStatus === "success" && hasStartFrame && shot.storyboardFrameMode === "first_last"
                        ? {
                              ...shot,
                              storyboardEndStatus: "queued",
                              storyboardEndAttempt: (shot.storyboardEndAttempt || 0) + 1,
                              storyboardEndTaskId: undefined,
                              storyboardEndError: undefined,
                              generationStatus: "idle",
                              generationTaskId: undefined,
                              generationError: undefined,
                              videoUrl: undefined,
                          }
                        : {
                              ...shot,
                              storyboardStatus: "queued",
                              storyboardAttempt: (shot.storyboardAttempt || 0) + 1,
                              storyboardTaskId: undefined,
                              storyboardError: undefined,
                              storyboardImageUrl: undefined,
                              storyboardImageUrls: undefined,
                              storyboardEndStatus: shot.storyboardEndStatus === "success" && hasEndFrame ? "success" : "idle",
                              storyboardEndTaskId: shot.storyboardEndStatus === "success" && hasEndFrame ? shot.storyboardEndTaskId : undefined,
                              storyboardEndError: shot.storyboardEndStatus === "success" && hasEndFrame ? undefined : shot.storyboardEndError,
                              generationStatus: "idle",
                              generationTaskId: undefined,
                              generationError: undefined,
                              videoUrl: undefined,
                              audioStatus: "idle",
                              audioTaskId: undefined,
                              audioUrl: undefined,
                          };
            });
        }),
    applyContentAnalysis: (projectId, episodeId, analysis) =>
        mutateProject(projectId, (project) => {
            const { items: characters, ids: characterIds } = mergeNamedItems(project.characters, analysis.characters, "character");
            const { items: scenes, ids: sceneIds } = mergeNamedItems(project.scenes, analysis.scenes, "scene");
            const { items: props, ids: propIds } = mergeNamedItems(project.props, analysis.props, "prop");
            const { items: clues, ids: clueIds } = mergeNamedItems(project.clues, analysis.clues, "clue");
            const episodes = project.episodes.map((episode) =>
                episode.id === episodeId
                    ? {
                          ...episode,
                          ...analysis.episode,
                          reviewStatus: "content_review" as const,
                          renderTask: undefined,
                          shots: analysis.shots.map((shot, index) => {
                              const current = episode.shots[index];
                              const incoming = {
                                  id: current?.id || `shot-${nanoid()}`,
                                  order: index + 1,
                                  title: shot.title,
                                  description: shot.description,
                                  sourceText: shot.sourceText,
                                  shotBoundary: shot.shotBoundary,
                                  dialogue: shot.dialogue,
                                  narration: shot.narration,
                                  utterances: shot.utterances,
                                  subtitle: [shot.dialogue, shot.narration].filter(Boolean).join("\n"),
                                  imagePrompt: "",
                                  videoPrompt: "",
                                  cameraMotion: "",
                                  startFramePrompt: "",
                                  endFramePrompt: "",
                                  negativePrompt: "",
                                  continuity: emptyContinuity(),
                                  duration: shot.duration,
                                  characterIds: shot.characterNames.map((name) => characterIds.get(normalizeName(name))).filter((id): id is string => Boolean(id)),
                                  sceneId: sceneIds.get(normalizeName(shot.sceneName)),
                                  propIds: shot.propNames.map((name) => propIds.get(normalizeName(name))).filter((id): id is string => Boolean(id)),
                                  clueIds: shot.clueNames.map((name) => clueIds.get(normalizeName(name))).filter((id): id is string => Boolean(id)),
                                  videoMode: project.defaultVideoMode === "reference" ? "storyboard" : project.defaultVideoMode,
                                  storyboardFrameMode: "single" as const,
                                  storyboardStatus: "idle" as const,
                                  generationStatus: "idle" as const,
                                  audioMode: "source" as const,
                                  audioStatus: "idle" as const,
                                  fieldOrigins: { ...(current?.fieldOrigins || {}), ...(current ? {} : { title: "ai", description: "ai", sourceText: "ai", shotBoundary: "ai", dialogue: "ai", narration: "ai", utterances: "ai", duration: "ai" }) },
                                  continuityStatus: current?.continuityStatus || ("ready" as const),
                              } as DramaShot;
                              if (!current) return incoming;
                              const protectedFields = new Set(
                                  Object.entries(current.fieldOrigins || {})
                                      .filter(([, origin]) => origin === "package" || origin === "manual")
                                      .map(([field]) => field),
                              );
                              const merged = { ...current, ...incoming } as DramaShot;
                              for (const field of protectedFields) (merged as Record<string, unknown>)[field] = (current as Record<string, unknown>)[field];
                              return {
                                  ...merged,
                                  id: current.id,
                                  code: current.code,
                                  storyboardStatus: current.storyboardStatus,
                                  storyboardEndStatus: current.storyboardEndStatus,
                                  generationStatus: current.generationStatus,
                                  videoUrl: current.videoUrl,
                                  actualStartFrameUrl: current.actualStartFrameUrl,
                                  actualEndFrameUrl: current.actualEndFrameUrl,
                              };
                          }),
                      }
                    : episode,
            );
            return { ...project, characters, scenes, props, clues, episodes };
        }),
    applyVisualAnalysis: (projectId, episodeId, analysis) =>
        mutateProject(projectId, (project) => {
            const visualByShot = new Map(analysis.shots.map((shot) => [shot.shotId, shot]));
            return {
                ...project,
                episodes: project.episodes.map((episode) =>
                    episode.id === episodeId
                        ? {
                              ...episode,
                              reviewStatus: "visual_ready" as const,
                              renderTask: undefined,
                              shots: episode.shots.map((shot) => {
                                  const visual = visualByShot.get(shot.id);
                                  return visual
                                      ? {
                                            ...shot,
                                            ...mergeVisualFields(shot, visual),
                                        }
                                      : shot;
                              }),
                          }
                        : episode,
                ),
            };
        }),
    applyReviewCompletion: (projectId, episodeId, analysis) =>
        mutateProject(projectId, (project) => {
            const completed = new Map(analysis.shots.map((shot) => [shot.shotId, shot]));
            const episodes = project.episodes.map((episode) => {
                if (episode.id !== episodeId) return episode;
                const shots = episode.shots.map((shot) => {
                    const incoming = completed.get(shot.id);
                    return incoming ? mergeReviewCompletionFields(shot, incoming) : shot;
                });
                const edges = [...(episode.continuityEdges || [])];
                for (const incoming of analysis.shots.map((shot) => shot.continuityEdge).filter(Boolean)) {
                    const existing = edges.find((edge) => edge.fromShotId === incoming!.fromShotId && edge.toShotId === incoming!.toShotId);
                    if (existing) continue;
                    const fromShot = shots.find((shot) => shot.id === incoming!.fromShotId || shot.code === incoming!.fromShotId);
                    const toShot = shots.find((shot) => shot.id === incoming!.toShotId || shot.code === incoming!.toShotId);
                    if (!fromShot || !toShot) continue;
                    edges.push({ ...incoming!, fromShotId: fromShot.id, toShotId: toShot.id });
                }
                const visualReady = shots.every((shot) => shot.imagePrompt.trim() && shot.videoPrompt.trim());
                return { ...episode, reviewStatus: visualReady ? ("visual_ready" as const) : episode.reviewStatus, shots, continuityEdges: edges };
            });
            return {
                ...project,
                episodes,
                productionArchive: refreshProductionArchive(
                    project.productionArchive,
                    episodes.find((episode) => episode.id === episodeId),
                ),
            };
        }),
    applyContinuitySuggestion: (projectId, episodeId, analysis) =>
        mutateProject(projectId, (project) => {
            const incomingByShot = new Map(analysis.shots.map((shot) => [shot.shotId, shot]));
            const episodes = project.episodes.map((episode) => {
                if (episode.id !== episodeId) return episode;
                const shots = episode.shots.map((shot) => {
                    const incoming = incomingByShot.get(shot.id);
                    if (!incoming) return shot;
                    const next = { ...shot } as DramaShot;
                    const origins = { ...(shot.fieldOrigins || {}) };
                    for (const field of ["continuity", "entryState", "exitState"] as const) {
                        const value = incoming[field];
                        if (value === undefined || (typeof value === "object" && value !== null && !Object.values(value as Record<string, unknown>).some((item) => (Array.isArray(item) ? item.length > 0 : Boolean(String(item || "").trim()))))) continue;
                        next[field] = value as never;
                        origins[field] = "ai";
                    }
                    return {
                        ...next,
                        continuityStatus: shot.videoUrl ? ("stale" as const) : ("ready" as const),
                        continuityError: shot.videoUrl ? "连续性方案已更新，需要重新生成或复核实际首尾帧" : undefined,
                        fieldOrigins: origins,
                    };
                });
                const edges = [...(episode.continuityEdges || [])];
                for (const incoming of analysis.shots.map((shot) => shot.continuityEdge).filter(Boolean)) {
                    const fromShot = shots.find((shot) => shot.id === incoming!.fromShotId || shot.code === incoming!.fromShotId);
                    const toShot = shots.find((shot) => shot.id === incoming!.toShotId || shot.code === incoming!.toShotId);
                    if (!fromShot || !toShot) continue;
                    const edge = { ...incoming!, fromShotId: fromShot.id, toShotId: toShot.id };
                    const index = edges.findIndex((item) => item.fromShotId === edge.fromShotId && item.toShotId === edge.toShotId);
                    if (index >= 0) edges[index] = edge;
                    else edges.push(edge);
                }
                return { ...episode, shots, continuityEdges: edges };
            });
            return {
                ...project,
                episodes,
                productionArchive: refreshProductionArchive(
                    project.productionArchive,
                    episodes.find((episode) => episode.id === episodeId),
                ),
            };
        }),
    replaceProject: (project) => set((state) => ({ projects: state.projects.map((item) => (item.id === project.id ? project : item)), summaries: upsertSummary(state.summaries, project) })),
    beginVideoPrompt: (projectId, episodeId, shotId) => {
        const key = dramaVideoPromptRunKey(projectId, episodeId, shotId);
        let started = false;
        set((state) => {
            if (state.videoPromptRuns[key]) return state;
            started = true;
            return { videoPromptRuns: { ...state.videoPromptRuns, [key]: { startedAt: Date.now() } } };
        });
        return started;
    },
    finishVideoPrompt: (projectId, episodeId, shotId) => {
        const key = dramaVideoPromptRunKey(projectId, episodeId, shotId);
        set((state) => {
            if (!state.videoPromptRuns[key]) return state;
            const videoPromptRuns = { ...state.videoPromptRuns };
            delete videoPromptRuns[key];
            return { videoPromptRuns };
        });
    },
    createVersion: async (project, reason) => {
        await createDramaProjectVersion(project, reason);
    },
    listVersions: (projectId) => listDramaProjectVersions(projectId),
    restoreVersion: async (projectId, versionId) => {
        const session = requireSession();
        const key = sessionEpoch.key(session, projectId);
        clearProjectSave(session, projectId);
        suspendedSaves.add(key);
        try {
            await saveQueues.get(key)?.catch(() => undefined);
            assertCurrent(session);
            const project = await restoreDramaProjectVersion(projectId, versionId);
            assertCurrent(session);
            latestProjectTimes.set(key, Date.parse(project.updatedAt) || Date.now());
            set((state) => ({ projects: state.projects.map((item) => (item.id === project.id ? project : item)), summaries: upsertSummary(state.summaries, project) }));
        } finally {
            suspendedSaves.delete(key);
        }
    },
    queueAudio: (projectId, episodeId, shotIds) =>
        mutateProject(projectId, (project) =>
            updateShots(project, episodeId, shotIds, (shot) =>
                shot.videoUrl && (shot.subtitle || shot.dialogue).trim() ? { ...shot, audioMode: "voiceover", audioStatus: "queued", audioAttempt: (shot.audioAttempt || 0) + 1, audioTaskId: undefined, audioError: undefined, audioUrl: undefined } : shot,
            ),
        ),
    reset: () => {
        invalidateSession();
        set({ hydrated: false, hydratedUserId: "", summaries: [], summaryTotal: 0, summaryPage: 0, summaryPageSize: SUMMARY_PAGE_SIZE, summaryLoadingMore: false, projects: [], syncError: undefined, saveStateByProject: {}, videoPromptRuns: {} });
    },
}));

function mutateProject(projectId: string, updater: (project: DramaProject) => DramaProject) {
    const session = sessionEpoch.capture();
    if (!session.userId) return;
    let nextProject: DramaProject | undefined;
    useDramaStore.setState((state) => {
        const projects = state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const updated = updater(project);
            if (updated === project) return project;
            nextProject = { ...updated, updatedAt: nextUpdatedAt(session, project) };
            return nextProject;
        });
        return { projects, summaries: nextProject ? upsertSummary(state.summaries, nextProject) : state.summaries };
    });
    if (nextProject) queueSave(session, nextProject);
}

function assetReferences(item: DramaNamedAsset): DramaAssetReference[] {
    const references = item.references?.length
        ? item.references
        : item.referenceImageUrl
          ? [{ id: `${item.id}-reference-legacy`, url: item.referenceImageUrl, storageKey: item.referenceStorageKey, source: "library" as const, label: "原参考图", createdAt: new Date(0).toISOString() }]
          : [];
    return ensureUniqueDramaAssetReferenceIds(references);
}

function updateShots(project: DramaProject, episodeId: string, shotIds: string[], update: (shot: DramaShot) => DramaShot) {
    const selected = new Set(shotIds);
    return {
        ...project,
        episodes: project.episodes.map((episode) => {
            if (episode.id !== episodeId) return episode;
            if (episode.renderTask && (episode.renderTask.status === "pending" || episode.renderTask.status === "running")) return episode;
            return { ...episode, renderTask: undefined, shots: episode.shots.map((shot) => (selected.has(shot.id) && !hasActiveShotTask(shot) ? update(shot) : shot)) };
        }),
    };
}

function mergeNamedItems<T extends { id: string; name: string; fieldOrigins?: Record<string, string> }>(existing: T[], incoming: Array<Omit<T, "id">>, prefix: string) {
    const items = existing.map((item) => ({ ...item }));
    const ids = new Map(items.map((item) => [normalizeName(item.name), item.id]));
    for (const item of incoming) {
        const name = normalizeName(item.name);
        if (!name) continue;
        const existingIndex = items.findIndex((current) => normalizeName(current.name) === name);
        if (existingIndex >= 0) {
            const id = items[existingIndex].id;
            const current = items[existingIndex];
            const origins = (current as T & { fieldOrigins?: Record<string, string> }).fieldOrigins || {};
            const merged = Object.fromEntries(Object.entries(item).map(([key, value]) => (origins[key] === "package" || origins[key] === "manual" ? [key, (current as Record<string, unknown>)[key]] : [key, value]))) as Partial<T>;
            items[existingIndex] = { ...current, ...merged, id };
            ids.set(name, id);
            continue;
        }
        const id = `${prefix}-${nanoid()}`;
        items.push({ ...item, id } as T);
        ids.set(name, id);
    }
    return { items, ids };
}
function mergeVisualFields(shot: DramaShot, visual: DramaVisualAnalysis["shots"][number]): DramaShot {
    const origins = shot.fieldOrigins || {};
    const fields = {
        imagePrompt: visual.imagePrompt,
        videoPrompt: visual.videoPrompt,
        cameraMotion: visual.cameraMotion,
        startFramePrompt: visual.startFramePrompt,
        endFramePrompt: visual.endFramePrompt,
        negativePrompt: visual.negativePrompt,
        continuity: visual.continuity,
        performancePlan: visual.performancePlan,
        dialoguePerformance: visual.dialoguePerformance,
        lightingPlan: visual.lightingPlan,
        framePlan: visual.framePlan,
    } as const;
    const next = { ...shot };
    for (const [field, value] of Object.entries(fields)) {
        if (origins[field] !== "package" && origins[field] !== "manual") (next as Record<string, unknown>)[field] = value;
    }
    const changed = Object.keys(fields).some((field) => origins[field] !== "package" && origins[field] !== "manual");
    return changed ? { ...next, continuityStatus: shot.videoUrl ? "stale" : "ready", fieldOrigins: { ...origins, ...Object.fromEntries(Object.keys(fields).map((field) => [field, origins[field] || "ai"])) } } : next;
}

function mergeReviewCompletionFields(shot: DramaShot, incoming: DramaReviewCompletion["shots"][number]): DramaShot {
    const next = { ...shot } as DramaShot;
    const origins = { ...(shot.fieldOrigins || {}) };
    const fields = ["performancePlan", "dialoguePerformance", "lightingPlan", "continuity", "entryState", "exitState"] as const;
    let changed = false;
    for (const field of fields) {
        if (origins[field] === "manual" && !isBlankReviewField(next[field])) continue;
        const current = next[field];
        const value = incoming[field];
        const merged = mergeMissingReviewValue(current, value);
        if (merged !== current) {
            (next as Record<string, unknown>)[field] = merged;
            origins[field] = "ai";
            changed = true;
        }
    }
    return changed
        ? {
              ...next,
              continuityStatus: shot.videoUrl ? "stale" : "ready",
              continuityError: shot.videoUrl ? "审核计划已更新，需要重新生成或复核实际首尾帧" : undefined,
              fieldOrigins: origins,
          }
        : next;
}

function refreshProductionArchive(archive: DramaProductionArchive | undefined, episode: DramaEpisode | undefined) {
    if (!archive || !episode) return archive;
    const shotCodes = new Set(episode.shots.map((shot) => shot.code).filter(Boolean));
    const directions = episode.shots.flatMap((shot) =>
        shot.utterances
            .filter((utterance) => utterance.type === "dialogue")
            .map((utterance) => {
                const performance = shot.dialoguePerformance?.find((item) => item.utteranceId === utterance.id);
                return {
                    id: performance?.utteranceId || utterance.id,
                    shotCode: shot.code || `SH${String(shot.order).padStart(2, "0")}`,
                    speaker: utterance.speaker,
                    text: utterance.text,
                    performance: performance
                        ? [performance.intent, performance.tone, performance.pace, performance.pause, performance.emphasis, performance.facialReactionBefore, performance.facialReactionDuring, performance.facialReactionAfter].filter(Boolean).join("；")
                        : "沿用当前镜头情绪，自然衔接语气与动作",
                    lipSync: true,
                };
            }),
    );
    const dialogueDirections = [...archive.dialogueDirections.filter((item) => !shotCodes.has(item.shotCode)), ...directions];
    const snapshot = episode.shots
        .map((shot) => {
            const performance = shot.performancePlan;
            const lighting = shot.lightingPlan;
            const continuity = shot.continuity;
            const actionStart = continuity?.actionStart || shot.description || shot.title;
            const actionEnd = continuity?.actionEnd || shot.endFramePrompt || actionStart;
            return `| ${shot.code || `SH${String(shot.order).padStart(2, "0")}`} | ${performance?.emotionalObjective || `围绕${actionStart}保持角色目标`} | ${performance?.emotionalArc || `从${actionStart}自然递进至${actionEnd}`} | ${lighting?.palette || "延续本场主色板"} | ${lighting?.keyLight || "延续前镜主光方向"} | ${continuity?.shotSize || "中景"} | ${continuity?.cameraAngle || "沿动作轴线平视"} | ${continuity?.characterBlocking || "按动作关系保持站位"} | ${actionStart} → ${actionEnd} | ${continuity?.axisRule || "保持180度关系轴线"} |`;
        })
        .join("\n");
    const marker = "### 当前集结构化审核字段（自动回填）";
    const sections = archive.sections.map((section) => {
        if (!/镜头执行表|QC 报告|台词与表演脚本/.test(section.title)) return section;
        const base = section.content.split(marker)[0].trimEnd();
        const content = /镜头执行表/.test(section.title)
            ? `${base}\n\n${marker}\n\n| 镜号 | 情绪目标 | 情绪递进 | 色板 | 主光 | 景别 | 机位 | 站位 | 动作衔接 | 轴线 |\n|---|---|---|---|---|---|---|---|---|---|\n${snapshot}`
            : /台词与表演脚本/.test(section.title)
              ? `${base}\n\n${marker}\n\n${dialogueDirections.map((item) => `- ${item.shotCode}｜${item.speaker || "未标注说话人"}｜${item.text}｜${item.performance}`).join("\n") || "无对白"}`
              : `${base}\n\n${marker}\n\n当前集 ${episode.code || episode.title} 已回填 ${episode.shots.length} 个镜头的表演、灯光、连续性与进出状态字段。`;
        return { ...section, content };
    });
    const qcMarker = "当前集结构化审核字段（自动回填）";
    const qcBase = archive.qcReport.split(qcMarker)[0].trimEnd();
    const qcReport = `${qcBase}\n\n${qcMarker}\n当前集 ${episode.code || episode.title} 已回填 ${episode.shots.length} 个镜头的表演、灯光、连续性与进出状态字段。`;
    return { ...archive, sections, dialogueDirections, qcReport };
}

function mergeMissingReviewValue(current: unknown, incoming: unknown): unknown {
    if (isBlankReviewField(incoming)) return current;
    if (isBlankReviewField(current)) return incoming;
    if (Array.isArray(current) || Array.isArray(incoming) || typeof current !== "object" || typeof incoming !== "object") return current;
    let changed = false;
    const result = { ...(current as Record<string, unknown>) };
    for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
        const merged = mergeMissingReviewValue(result[key], value);
        if (merged !== result[key]) {
            result[key] = merged;
            changed = true;
        }
    }
    return changed ? result : current;
}

function isBlankReviewField(value: unknown): boolean {
    if (value === undefined || value === null || value === "") return true;
    if (Array.isArray(value)) return !value.length || value.every(isBlankReviewField);
    if (typeof value !== "object") return !String(value).trim();
    const values = Object.values(value as Record<string, unknown>);
    return !values.length || values.every(isBlankReviewField);
}

function normalizeName(value: string) {
    return value.trim().toLocaleLowerCase();
}

function hasActiveShotTask(shot: DramaShot) {
    return [shot.storyboardStatus, shot.storyboardEndStatus, shot.generationStatus, shot.audioStatus].some((status) => status === "queued" || status === "running");
}

function queueSave(session: ClientSessionStamp, project: DramaProject) {
    const key = sessionEpoch.key(session, project.id);
    if (suspendedSaves.has(key)) return;
    useDramaStore.setState((state) => ({ saveStateByProject: { ...state.saveStateByProject, [project.id]: { status: "saving", savedAt: state.saveStateByProject[project.id]?.savedAt } } }));
    clearProjectSave(session, project.id);
    saveTimers.set(
        key,
        setTimeout(() => {
            saveTimers.delete(key);
            if (!sessionEpoch.isCurrent(session)) return;
            const previous = saveQueues.get(key) || Promise.resolve();
            const operation = previous.then(async () => {
                if (!sessionEpoch.isCurrent(session)) return;
                try {
                    const saved = await saveDramaProject(project);
                    if (!sessionEpoch.isCurrent(session)) return;
                    useDramaStore.setState((state) => ({
                        projects: state.projects.map((item) => (item.id === saved.id && item.updatedAt === project.updatedAt ? saved : item)),
                        summaries: upsertSummary(state.summaries, saved),
                        syncError: undefined,
                        saveStateByProject: state.projects.find((item) => item.id === project.id)?.updatedAt === project.updatedAt ? { ...state.saveStateByProject, [project.id]: { status: "saved", savedAt: saved.updatedAt } } : state.saveStateByProject,
                    }));
                } catch (error) {
                    if (!sessionEpoch.isCurrent(session)) return;
                    const latest = useDramaStore.getState().projects.find((item) => item.id === project.id);
                    if (latest?.updatedAt === project.updatedAt)
                        useDramaStore.setState((state) => ({
                            syncError: error instanceof Error ? error.message : "短剧项目保存失败",
                            saveStateByProject: { ...state.saveStateByProject, [project.id]: { status: "error", savedAt: state.saveStateByProject[project.id]?.savedAt } },
                        }));
                }
            });
            saveQueues.set(key, operation);
            void operation.finally(() => {
                if (saveQueues.get(key) === operation) saveQueues.delete(key);
            });
        }, 250),
    );
}

function nextUpdatedAt(session: ClientSessionStamp, project: DramaProject) {
    const key = sessionEpoch.key(session, project.id);
    const previous = Math.max(Date.parse(project.updatedAt) || 0, latestProjectTimes.get(key) || 0);
    const next = Math.max(Date.now(), previous + 1);
    latestProjectTimes.set(key, next);
    return new Date(next).toISOString();
}

function clearProjectSave(session: ClientSessionStamp, projectId: string) {
    const key = sessionEpoch.key(session, projectId);
    const timer = saveTimers.get(key);
    if (timer) clearTimeout(timer);
    saveTimers.delete(key);
}

function isActiveHydrate(session: ClientSessionStamp, requestId: number) {
    return sessionEpoch.isCurrent(session) && hydrateRequest?.requestId === requestId;
}

function requireSession() {
    const session = sessionEpoch.capture();
    if (!session.userId) throw new Error("请先登录");
    return session;
}

function assertCurrent(session: ClientSessionStamp) {
    if (!sessionEpoch.isCurrent(session)) throw new Error("登录会话已变更，请重试");
}

function invalidateSession() {
    sessionEpoch.invalidate();
    hydrateRequest = null;
    saveTimers.forEach((timer) => clearTimeout(timer));
    saveTimers.clear();
    suspendedSaves.clear();
    latestProjectTimes.clear();
    projectRequests.clear();
}

function upsertSummary(summaries: DramaProjectSummary[], project: DramaProject) {
    const summary = summarizeDramaProject(project);
    return [summary, ...summaries.filter((item) => item.id !== project.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function scriptToShots(script: string, project: DramaProject): DramaShot[] {
    return script
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text, index) => {
            const context = [project.style, project.summary, text].filter(Boolean).join("，");
            return {
                id: `shot-${nanoid()}`,
                order: index + 1,
                title: `镜头 ${String(index + 1).padStart(2, "0")}`,
                description: text,
                sourceText: text,
                shotBoundary: "段落边界",
                dialogue: "",
                narration: "",
                utterances: [],
                imagePrompt: `${context}，角色与画风保持一致，电影分镜画面`,
                videoPrompt: `${context}，镜头运动自然，人物动作连续，保持角色一致性`,
                cameraMotion: "自然镜头运动",
                startFramePrompt: text,
                endFramePrompt: text,
                negativePrompt: "文字、水印、角色身份漂移、服装变化、错误肢体",
                continuity: emptyContinuity(),
                duration: 5,
                characterIds: [],
                propIds: [],
                clueIds: [],
                sceneId: project.scenes[0]?.id,
                videoMode: project.defaultVideoMode === "reference" ? "storyboard" : project.defaultVideoMode,
                storyboardFrameMode: "single",
                storyboardStatus: "idle",
                generationStatus: "idle",
                audioMode: "source",
                audioStatus: "idle",
            };
        });
}

function emptyContinuity() {
    return {
        shotSize: "",
        cameraAngle: "",
        composition: "",
        characterBlocking: "",
        gazeDirection: "",
        actionStart: "",
        actionEnd: "",
        screenDirection: "",
        axisRule: "",
        continuityNotes: "",
    };
}
