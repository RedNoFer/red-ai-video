import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DramaProject } from "@/lib/drama-project-contract";
import { createFrameEvidence } from "@/lib/drama-continuity-policy";
import { DRAMA_STYLE_COLOR_SCRIPT, DRAMA_STYLE_NAME } from "@/lib/drama-style";
import { defaultDramaProductionPlan } from "@/lib/drama-production-plan";

const mocks = vi.hoisted(() => {
    class MockDramaProjectStoreError extends Error {
        constructor(
            message: string,
            readonly status: number,
        ) {
            super(message);
        }
    }
    return {
        DramaProjectStoreError: MockDramaProjectStoreError,
        createCreativeConversation: vi.fn(),
        deleteDramaConversationAggregate: vi.fn(),
        getCreativeConversation: vi.fn(),
        listCreativeConversations: vi.fn(),
        listAgentRuns: vi.fn(),
        updateCreativeConversation: vi.fn(),
        createDramaProject: vi.fn(),
        deleteDramaProject: vi.fn(),
        findDramaProjectBySourceHandoffId: vi.fn(),
        getDramaProject: vi.fn(),
        listDramaProjectSummaries: vi.fn(),
        updateDramaProject: vi.fn(),
        getStoredGenerationTask: vi.fn(),
        getStoredGenerationTaskByRequest: vi.fn(),
        queryStoredGenerationTasks: vi.fn(),
        createDramaProjectVersion: vi.fn(),
        getDramaProjectVersion: vi.fn(),
        listDramaProjectVersions: vi.fn(),
        deleteUserLocalMediaAssets: vi.fn(),
        getAuthSettings: vi.fn(),
        resolveLogicalModelCandidates: vi.fn(),
        supportsVideoKeyframeReferences: vi.fn(),
        createDramaProductionRun: vi.fn(),
        findLatestDramaProductionRun: vi.fn(),
        getDramaProductionRun: vi.fn(),
        updateDramaProductionRun: vi.fn(),
        fetchInternalApi: vi.fn(),
        fetchSafeOutbound: vi.fn(),
        reviewCreativeOutputs: vi.fn(),
    };
});

vi.mock("@/lib/auth/store", () => ({ getAuthSettings: mocks.getAuthSettings }));
vi.mock("@/lib/server/agent-run-store", () => ({ listAgentRuns: mocks.listAgentRuns }));
vi.mock("@/lib/server/creative-entity-deletion-store", () => ({
    CreativeEntityDeletionConflict: class CreativeEntityDeletionConflict extends Error {},
    deleteDramaConversationAggregate: mocks.deleteDramaConversationAggregate,
}));
vi.mock("@/lib/server/creative-runtime-store", () => ({
    createCreativeConversation: mocks.createCreativeConversation,
    getCreativeConversation: mocks.getCreativeConversation,
    listCreativeConversations: mocks.listCreativeConversations,
    updateCreativeConversation: mocks.updateCreativeConversation,
}));
vi.mock("@/lib/server/drama-project-store", () => ({
    DramaProjectStoreError: mocks.DramaProjectStoreError,
    createDramaProject: mocks.createDramaProject,
    deleteDramaProject: mocks.deleteDramaProject,
    findDramaProjectBySourceHandoffId: mocks.findDramaProjectBySourceHandoffId,
    getDramaProject: mocks.getDramaProject,
    listDramaProjectSummaries: mocks.listDramaProjectSummaries,
    updateDramaProject: mocks.updateDramaProject,
}));
vi.mock("@/lib/server/drama-project-version-store", () => ({
    createDramaProjectVersion: mocks.createDramaProjectVersion,
    getDramaProjectVersion: mocks.getDramaProjectVersion,
    listDramaProjectVersions: mocks.listDramaProjectVersions,
}));
vi.mock("@/lib/server/generation-task-store", () => ({ getStoredGenerationTask: mocks.getStoredGenerationTask, getStoredGenerationTaskByRequest: mocks.getStoredGenerationTaskByRequest, queryStoredGenerationTasks: mocks.queryStoredGenerationTasks }));
vi.mock("@/lib/server/local-media-storage", () => ({ deleteUserLocalMediaAssets: mocks.deleteUserLocalMediaAssets }));
vi.mock("@/lib/server/logical-model-router", () => ({ resolveLogicalModelCandidates: mocks.resolveLogicalModelCandidates, supportsVideoKeyframeReferences: mocks.supportsVideoKeyframeReferences }));
vi.mock("@/lib/server/drama-production-run-store", () => ({
    createDramaProductionRun: mocks.createDramaProductionRun,
    findLatestDramaProductionRun: mocks.findLatestDramaProductionRun,
    getDramaProductionRun: mocks.getDramaProductionRun,
    updateDramaProductionRun: mocks.updateDramaProductionRun,
}));
vi.mock("@/lib/server/internal-origin", () => ({ fetchInternalApi: mocks.fetchInternalApi }));
vi.mock("@/lib/server/safe-outbound-fetch", () => ({ fetchSafeOutbound: mocks.fetchSafeOutbound }));
vi.mock("@/lib/server/creative-review-service", () => ({ reviewCreativeOutputs: mocks.reviewCreativeOutputs }));

import {
    acceptDramaStoryboardFrameForUser,
    reviewDramaStoryboardFrameForUser,
    createDramaProjectForUser,
    applyDramaVisualStepResult,
    applyDramaVisualStepFailure,
    compileDramaReferencePrompt,
    compileDramaVideoReferencePrompt,
    createDramaProductionRunForUser,
    createDramaVisualImageReference,
    deleteDramaAgentConversationForUser,
    deleteDramaProjectForUser,
    decideDramaContinuityFrameForUser,
    DramaProjectServiceError,
    getDramaProjectForUser,
    getLatestDramaProductionRunForUser,
    getDramaProductionPreflightForUser,
    mergeDramaShotMediaReferences,
    normalizeProject,
    recoverInvalidDramaEpisodes,
    recoverStaleDramaBoundaryFrames,
    resolveDramaVisualReferenceUrl,
    resolveReadableDramaVideoReferenceUrl,
    reconcileDramaVideoStepTask,
    restoreDramaProjectVersionForUser,
    updateDramaProductionRunForUser,
    updateDramaProjectForUser,
    updateDramaShotPromptForUser,
    updateDramaStoryboardFramePromptForUser,
    validateDramaReferenceSelections,
    saveDramaEpisodeSettingsForUser,
} from "./drama-project-service";
import { DramaProjectStoreError } from "./drama-project-store";

describe("drama project service updates", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.updateDramaProject.mockImplementation(async (_userId: string, value: DramaProject) => value);
        mocks.createCreativeConversation.mockResolvedValue({ id: "conversation-new" });
        mocks.updateCreativeConversation.mockResolvedValue({ id: "conversation-new", status: "archived" });
        mocks.getCreativeConversation.mockResolvedValue({ id: "conversation-one", userId: "user-one", surface: "drama", source: "drama", projectId: "drama-one", status: "active" });
        mocks.listCreativeConversations.mockResolvedValue([{ id: "conversation-one" }, { id: "conversation-two" }]);
        mocks.listAgentRuns.mockResolvedValue([]);
        mocks.getStoredGenerationTask.mockResolvedValue(null);
        mocks.getStoredGenerationTaskByRequest.mockResolvedValue(null);
        mocks.queryStoredGenerationTasks.mockResolvedValue([]);
        mocks.fetchSafeOutbound.mockResolvedValue(new Response(new Uint8Array([137]), { status: 206, headers: { "content-type": "image/png" } }));
        mocks.deleteDramaConversationAggregate.mockResolvedValue({ deletedConversations: 1, mediaStorageKeys: ["permanent/agent.png"], dramaProject: { ...project("2026-07-19T08:00:03.000Z", "项目"), creativeConversationId: "conversation-two" } });
        mocks.findDramaProjectBySourceHandoffId.mockResolvedValue(null);
        mocks.listDramaProjectSummaries.mockResolvedValue([]);
        mocks.createDramaProjectVersion.mockResolvedValue({ id: "version-new", projectId: "drama-one", version: 2, reason: "恢复前自动快照", createdAt: new Date().toISOString() });
        mocks.getAuthSettings.mockResolvedValue({ defaultModels: { imageModel: "image-default" }, generationDefaults: { imageQuality: "standard" } });
        mocks.resolveLogicalModelCandidates.mockReturnValue([{ logicalModelId: "image-default", channelId: "image-channel" }]);
        mocks.supportsVideoKeyframeReferences.mockReturnValue(true);
        mocks.createDramaProductionRun.mockImplementation(async (_userId: string, run: unknown) => run);
        mocks.findLatestDramaProductionRun.mockResolvedValue(null);
        mocks.getDramaProductionRun.mockResolvedValue(null);
        mocks.updateDramaProductionRun.mockImplementation(async (_userId: string, run: unknown) => run);
    });

    it("allows eight total image references for a 15-second shot", () => {
        const shot = {
            id: "shot-one",
            title: "镜头一",
            duration: 15,
            sceneId: "scene-one",
            characterIds: ["character-one", "character-two"],
            propIds: ["prop-one"],
            clueIds: [],
            sourceAssetIds: [],
            storyboardFrameMode: "all_frames",
            framePlan: { frames: ["f1", "f2", "f3", "f4"].map((id, index) => ({ id, sequenceIndex: index + 1 })) },
        } as never;

        expect(() => validateDramaReferenceSelections({} as DramaProject, { continuityEdges: [] } as never, [shot], { "shot-one": ["scene-one", "character-one", "character-two", "prop-one", "f1", "f2", "f3", "f4"] })).not.toThrow();
    });

    it("reattaches a video step to the active task created by the same request", () => {
        const step = { id: "video-shot-one", type: "video", status: "failed", error: "当前用户视频任务已达到并发上限" } as never;
        const task = { id: "video-task-one", status: "running", userId: "user-one" } as never;

        expect(reconcileDramaVideoStepTask(step, task)).toMatchObject({ id: "video-shot-one", taskId: "video-task-one", status: "running", error: undefined });
    });

    it("projects a reconciled video failure back to the owning shot", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [{ id: "shot-one", title: "镜头一", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", duration: 5, generationStatus: "idle" }] as never;
        const run = {
            id: "production-run-one",
            projectId: current.id,
            episodeId: "episode-one",
            status: "running",
            mode: "strict",
            parameterSnapshot: { imageModel: "image-default", videoModel: "video-default", ratio: "9:16" },
            steps: [{ id: "video-shot-one", type: "video", shotId: "shot-one", status: "running", dependsOn: [] }],
            blockers: [],
            confirmedAt: current.updatedAt,
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never;
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.findLatestDramaProductionRun.mockResolvedValue(run);
        mocks.getDramaProductionRun.mockResolvedValue(run);
        mocks.getStoredGenerationTaskByRequest.mockResolvedValue({ id: "video-task-one", userId: "user-one", status: "error", error: "video generation timed out" });

        await getLatestDramaProductionRunForUser("user-one", current.id, "episode-one");

        expect(mocks.updateDramaProject).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({ episodes: [expect.objectContaining({ shots: [expect.objectContaining({ id: "shot-one", generationStatus: "error", generationError: "video generation timed out", generationTaskId: "video-task-one" })] })] }),
            current.updatedAt,
        );
    });

    it("maps a completed supplier video result to the production step output", () => {
        const step = { id: "video-shot-one", type: "video", shotId: "shot-one", status: "running", dependsOn: [] } as never;
        const task = { id: "video-task-one", userId: "user-one", status: "success", result: { url: "/api/reference-assets/provider-result.mp4", remoteUrl: "https://provider.example/result.mp4" } } as never;

        expect(reconcileDramaVideoStepTask(step, task)).toMatchObject({ status: "success", outputUrls: ["/api/reference-assets/provider-result.mp4"], outputRemoteUrls: ["https://provider.example/result.mp4"] });
    });

    it("uses a signed local reference copy when the provider URL is no longer readable", async () => {
        const originalKey = process.env.VOZEB_PRO_REFERENCE_ASSET_SIGNING_KEY;
        const originalSite = process.env.NEXT_PUBLIC_SITE_URL;
        process.env.VOZEB_PRO_REFERENCE_ASSET_SIGNING_KEY = "test-signing-key";
        process.env.NEXT_PUBLIC_SITE_URL = "https://vozeb.example";
        mocks.fetchSafeOutbound
            .mockResolvedValueOnce(new Response("not found", { status: 404, headers: { "content-type": "text/plain" } }))
            .mockResolvedValueOnce(new Response(new Uint8Array([137]), { status: 206, headers: { "content-type": "image/png" } }));

        try {
            await expect(resolveReadableDramaVideoReferenceUrl("/api/generation-log-assets/permanent/frame.png", "https://provider.example/expired.png", "http://127.0.0.1:3010")).resolves.toMatch(
                /^https:\/\/vozeb\.example\/api\/generation-log-assets\/permanent\/frame\.png\?purpose=provider-read/,
            );
        } finally {
            if (originalKey === undefined) delete process.env.VOZEB_PRO_REFERENCE_ASSET_SIGNING_KEY;
            else process.env.VOZEB_PRO_REFERENCE_ASSET_SIGNING_KEY = originalKey;
            if (originalSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
            else process.env.NEXT_PUBLIC_SITE_URL = originalSite;
        }
    });

    it("removes invalid historical episode entries before recovery reads their shots", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        const malformed = { ...current, episodes: [...current.episodes, null] } as unknown as DramaProject;
        mocks.getDramaProject.mockResolvedValue(malformed);

        const recovered = await getDramaProjectForUser("user-one", malformed.id);

        expect(recovered.episodes).toHaveLength(1);
        expect(recovered.episodes[0].id).toBe("episode-one");
        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ episodes: [expect.objectContaining({ id: "episode-one" })] }), current.updatedAt);
        expect(recoverInvalidDramaEpisodes(malformed)?.episodes).toHaveLength(1);
    });

    it("normalizes legacy reference modes across the project, production plan, and shots", () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        const legacy = {
            ...current,
            defaultVideoMode: "reference",
            productionBible: {
                ...current.productionBible,
                productionPlan: {
                    version: "drama-production-plan-v1",
                    skills: [],
                    video: { model: "seedance-2-5", mode: "reference", ratio: "9:16", resolution: "720p", durationPolicy: "shot", count: 1, audioMode: "native", allowExplicitFallback: false },
                    references: { strategy: "adaptive", minImages: 3, maxImages: 5, roles: [] },
                    continuity: { mode: "strict", requireAcceptedActualTail: true },
                    source: "manual",
                },
            },
            episodes: [
                {
                    ...current.episodes[0],
                    shots: [{ id: "shot-one", title: "镜头", videoMode: "reference", imagePrompt: "画面", videoPrompt: "动作", characterIds: [], propIds: [], clueIds: [], duration: 5 }],
                },
            ],
        } as unknown as DramaProject;

        const normalized = normalizeProject(legacy, current);

        expect(normalized.defaultVideoMode).toBe("storyboard");
        expect(normalized.productionBible?.productionPlan?.video.mode).toBe("storyboard");
        expect(normalized.episodes[0].shots[0].videoMode).toBe("storyboard");
    });

    it("keeps every generated storyboard result while retaining the first as the main frame", () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [{ id: "shot-one", title: "镜头", storyboardStatus: "running", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 5 } as never];
        const updated = applyDramaVisualStepResult(current, "episode-one", { id: "start-shot-one", type: "start_frame", shotId: "shot-one", dependsOn: [], status: "running", executionPrompt: "完整首帧提示词" }, [
            { url: "/api/generation-log-assets/one.png", width: 640, height: 960 },
            { url: "/api/generation-log-assets/two.png", width: 640, height: 960 },
        ]);

        expect(updated.episodes[0].shots[0]).toMatchObject({
            storyboardImageUrl: "/api/generation-log-assets/one.png",
            storyboardImageUrls: ["/api/generation-log-assets/one.png", "/api/generation-log-assets/two.png"],
            storyboardPrompt: "完整首帧提示词",
        });
    });

    it("does not run continuity review when a generated frame is synchronized", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            { id: "shot-one", title: "镜头", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 5, storyboardFrameMode: "all_frames", storyboardFrames: [] } as never,
        ];
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.findLatestDramaProductionRun.mockResolvedValue({
            id: "run-frame-one",
            projectId: current.id,
            episodeId: "episode-one",
            status: "running",
            scope: "visual",
            mode: "strict",
            confirmedAt: current.updatedAt,
            parameterSnapshot: { imageModel: "image-default", videoModel: "", ratio: "9:16" },
            steps: [{ id: "frame-shot-one-f1", type: "keyframe", shotId: "shot-one", frameId: "f1", sequenceIndex: 1, taskId: "task-one", dependsOn: [], status: "running" }],
            blockers: [],
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never);
        mocks.getStoredGenerationTask.mockResolvedValue({ status: "success", result: { serverUrl: "/api/frame-one.png", width: 640, height: 960 } });

        await getLatestDramaProductionRunForUser("user-one", current.id, "episode-one", { scope: "visual" });

        expect(mocks.reviewCreativeOutputs).not.toHaveBeenCalled();
        expect(mocks.updateDramaProject).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({ episodes: [expect.objectContaining({ shots: [expect.objectContaining({ storyboardFrames: [expect.objectContaining({ continuityStatus: "pending" })] })] })] }),
            current.updatedAt,
        );
    });

    it("reviews only the requested generated frame and persists the result", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                description: "人物在房间内抬头",
                sourceText: "人物在房间内抬头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                storyboardFrameMode: "all_frames",
                framePlan: { start: { source: "independent" }, end: { required: false }, frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 5, actionPrompt: "抬头", imagePrompt: "人物抬头" }] },
                storyboardFrames: [{ id: "f1", sequenceIndex: 1, source: "generated", status: "success", taskId: "task-one", mediaUrl: "/api/frame-one.png", continuityStatus: "pending" }],
            } as never,
        ];
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.reviewCreativeOutputs.mockResolvedValue({ mode: "visual", status: "passed", summary: "符合当前帧", issues: [], retryTaskIds: [] });

        const result = await reviewDramaStoryboardFrameForUser("user-one", current.id, "episode-one", "shot-one", "f1", { origin: "http://localhost:3010", cookie: "session=1" });

        expect(mocks.reviewCreativeOutputs).toHaveBeenCalledWith(expect.objectContaining({ billingId: expect.stringContaining("drama-frame-review:"), tasks: [expect.objectContaining({ id: "f1", imageUrls: ["/api/frame-one.png"] })] }));
        expect(result.review.status).toBe("passed");
        expect(result.project.episodes[0].shots[0].storyboardFrames?.[0]).toMatchObject({ continuityStatus: "passed", error: undefined });
        expect(mocks.updateDramaProject).toHaveBeenCalled();
    });

    it("stores a generated frame against the package frame id and its stable input hash", () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            { id: "shot-one", title: "镜头", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 5, storyboardFrameMode: "all_frames", storyboardFrames: [] } as never,
        ];
        const updated = applyDramaVisualStepResult(
            current,
            "episode-one",
            { id: "frame-shot-one-f1", frameId: "f1", inputHash: "stable-hash", type: "keyframe", sequenceIndex: 1, shotId: "shot-one", dependsOn: [], status: "running", taskId: "task-one", executionPrompt: "完整的最终生图提示词" },
            [{ url: "/api/generation-log-assets/f1.png", remoteUrl: "https://cdn.example/f1.png", width: 640, height: 960 }],
        );
        expect(updated.episodes[0].shots[0].storyboardFrames).toEqual([
            expect.objectContaining({ id: "f1", sequenceIndex: 1, inputHash: "stable-hash", continuityStatus: "pending", mediaUrl: "/api/generation-log-assets/f1.png", remoteUrl: "https://cdn.example/f1.png", generationPrompt: "完整的最终生图提示词" }),
        ]);
    });

    it("keeps the accepted current keyframe when a regenerated candidate arrives", () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                description: "人物在门边握住断剑",
                sourceText: "人物在门边握住断剑",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [{ id: "f1", sequenceIndex: 1, source: "generated", status: "success", taskId: "task-old", mediaUrl: "/api/old.png", continuityStatus: "passed" }],
            } as never,
        ];

        const updated = applyDramaVisualStepResult(current, "episode-one", { id: "frame-shot-one-f1", frameId: "f1", type: "keyframe", sequenceIndex: 1, shotId: "shot-one", dependsOn: [], status: "running", taskId: "task-new" }, [
            { url: "/api/new.png", width: 640, height: 960 },
        ]);
        const frame = updated.episodes[0].shots[0].storyboardFrames?.[0];

        expect(frame).toMatchObject({ mediaUrl: "/api/old.png", taskId: "task-old", continuityStatus: "passed" });
        expect(frame?.candidates).toEqual([expect.objectContaining({ mediaUrl: "/api/old.png", taskId: "task-old", continuityStatus: "passed" }), expect.objectContaining({ mediaUrl: "/api/new.png", taskId: "task-new", continuityStatus: "pending" })]);
    });

    it("persists a manual storyboard-frame acceptance against the latest server project", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [
                    {
                        id: "f2",
                        sequenceIndex: 2,
                        source: "generated",
                        status: "success",
                        taskId: "task-two",
                        mediaUrl: "/api/frame-two.png",
                        continuityStatus: "needs_review",
                        continuityEvidenceId: "frame-qc:old",
                        error: "自动复盘不可用",
                        candidates: [{ id: "candidate-two", mediaUrl: "/api/frame-two.png", source: "generated", taskId: "task-two", createdAt: current.updatedAt, continuityStatus: "needs_review", error: "自动复盘不可用" }],
                    },
                ],
                frameEvidence: [createFrameEvidence({ role: "storyboard_keyframe", sequenceIndex: 2, source: "generated", mediaUrl: "/api/frame-two.png", sourceShotId: "shot-one", generationTaskId: "task-two", validity: "candidate" })],
            } as never,
        ];
        mocks.getDramaProject.mockResolvedValue(current);

        const updated = await acceptDramaStoryboardFrameForUser("user-one", current.id, "episode-one", "shot-one", "f2");
        const frame = updated.episodes[0].shots[0].storyboardFrames?.[0];

        expect(frame).toMatchObject({ id: "f2", status: "success", mediaUrl: "/api/frame-two.png", continuityStatus: "passed", error: undefined });
        expect(frame?.continuityEvidenceId).toMatch(/^manual-accept:f2:/);
        expect(frame?.candidates).toEqual([expect.objectContaining({ id: "candidate-two", continuityStatus: "passed", error: undefined })]);
        expect(updated.episodes[0].shots[0].frameEvidence).toEqual([expect.objectContaining({ mediaUrl: "/api/frame-two.png", validity: "accepted" })]);
        expect(mocks.updateDramaProject).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({ episodes: [expect.objectContaining({ shots: [expect.objectContaining({ storyboardFrames: [expect.objectContaining({ continuityStatus: "passed" })] })] })] }),
            current.updatedAt,
        );
    });

    it("persists a manual prompt on the requested storyboard frame and invalidates its generated result", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                description: "人物在门边握住断剑",
                sourceText: "人物在门边握住断剑",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "旧画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                storyboardFrameMode: "all_frames",
                framePlan: {
                    start: { source: "independent" },
                    end: { required: false },
                    frames: [
                        { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2.5, actionPrompt: "前半段", imagePrompt: "前半画面" },
                        { id: "f2", sequenceIndex: 2, startSecond: 2.5, endSecond: 5, actionPrompt: "后半段", imagePrompt: "后半画面" },
                    ],
                },
                storyboardFrames: [
                    { id: "f1", sequenceIndex: 1, source: "generated", status: "success", mediaUrl: "/api/f1.png", continuityStatus: "passed" },
                    { id: "f2", sequenceIndex: 2, source: "generated", status: "success", mediaUrl: "/api/f2.png", continuityStatus: "passed" },
                ],
            } as never,
        ];
        mocks.getDramaProject.mockResolvedValue(current);
        const supplierPrompt =
            "静态关键帧：用户编辑后的画面\n可见状态：人物握住断剑\n可见表演状态：眉眼紧绷\n景别：中景\n机位与构图：平视，主体位于画面中央\n站位与视线：人物站在门边，视线落向断剑\n三层空间：前景为门框，中景承载人物，背景交代房间纵深\n光色与风格：冷色侧光，半写实动漫幻想风\n负面约束：无字幕、无水印、无logo、无HUD、无变形";

        const saved = await updateDramaStoryboardFramePromptForUser("user-one", current.id, "episode-one", "shot-one", "f2", { supplierPrompt });
        const shot = saved.episodes[0].shots[0];

        expect(shot.framePlan?.frames[1].supplierPrompt).toContain("用户编辑后的画面");
        expect(shot.storyboardFrames).toEqual([expect.objectContaining({ id: "f1", status: "success", mediaUrl: "/api/f1.png" }), expect.objectContaining({ id: "f2", status: "stale", mediaUrl: "/api/f2.png", continuityStatus: "stale" })]);
        expect(mocks.updateDramaProject.mock.calls.at(-1)?.[0]).toBe("user-one");
        expect((mocks.updateDramaProject.mock.calls.at(-1)?.[1] as DramaProject).episodes[0].shots[0].framePlan?.frames[1].supplierPrompt).toContain("用户编辑后的画面");
    });

    it("persists a manually edited video prompt without rewriting the whole project", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                description: "Karin握住断剑",
                sourceText: "Karin握住断剑",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "静态画面",
                videoPrompt: "原始动态",
                cameraMotion: "固定机位",
                duration: 5,
                storyboardFrameMode: "single",
            } as never,
        ];
        mocks.getDramaProject.mockResolvedValue(current);

        const saved = await updateDramaShotPromptForUser("user-one", current.id, "episode-one", "shot-one", { executionVideoPrompt: "动态意图：Karin握住断剑。", executionVideoPromptOrigin: "manual" });

        expect(saved.episodes[0].shots[0]).toMatchObject({ executionVideoPrompt: "动态意图：Karin握住断剑。", fieldOrigins: { executionVideoPrompt: "manual" } });
        expect(mocks.queryStoredGenerationTasks).not.toHaveBeenCalled();
        expect(mocks.getStoredGenerationTask).not.toHaveBeenCalled();
        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ episodes: [expect.objectContaining({ shots: [expect.objectContaining({ executionVideoPrompt: "动态意图：Karin握住断剑。" })] })] }), current.updatedAt);
    });

    it("persists the Agent-generated frame plan without rewriting its prompt fields", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                description: "Karin握住断剑",
                sourceText: "Karin握住断剑",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "静态画面",
                videoPrompt: "原始动态",
                cameraMotion: "固定机位",
                duration: 6,
                storyboardFrameMode: "all_frames",
                framePlan: {
                    start: { source: "independent" },
                    end: { required: true },
                    frames: [
                        { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 3, startPrompt: "人物低头", actionPrompt: "手指收紧", transitionPrompt: "手指压住剑柄并保持低头", endPrompt: "手指收紧剑柄", imagePrompt: "人物低头，手指收紧剑柄" },
                        {
                            id: "f2",
                            sequenceIndex: 2,
                            startSecond: 3,
                            endSecond: 6,
                            startPrompt: "手指收紧剑柄",
                            actionPrompt: "人物抬头",
                            transitionPrompt: "视线从剑柄转向门外",
                            endPrompt: "视线越过门框看向门外",
                            imagePrompt: "人物抬头，视线越过门框看向门外",
                        },
                    ],
                },
            } as never,
        ];
        mocks.getDramaProject.mockResolvedValue(current);

        const agentFramePlan = {
            frames: [
                {
                    id: "f1",
                    sequenceIndex: 1,
                    startSecond: 0,
                    endSecond: 3,
                    startPrompt: "人物低头",
                    actionPrompt: "手指收紧并压住剑柄",
                    transitionPrompt: "手指压住剑柄并保持低头",
                    endPrompt: "手指收紧剑柄",
                    imagePrompt: "静态关键帧：人物低头；可见状态：手指收紧并压住剑柄",
                },
                {
                    id: "f2",
                    sequenceIndex: 2,
                    startSecond: 3,
                    endSecond: 6,
                    startPrompt: "手指收紧剑柄",
                    actionPrompt: "抬头锁定门外",
                    transitionPrompt: "视线从剑柄转向门外",
                    endPrompt: "视线越过门框锁定门外",
                    imagePrompt: "静态关键帧：人物抬头；可见状态：视线越过门框锁定门外",
                },
            ],
        };
        const saved = await updateDramaShotPromptForUser("user-one", current.id, "episode-one", "shot-one", {
            executionVideoPrompt: "素材绑定：@图片1：顺序帧\n动态意图：Karin抬头",
            executionVideoPromptOrigin: "ai",
            framePlan: agentFramePlan,
            framePlanOrigin: "ai",
        });

        expect(saved.episodes[0].shots[0].framePlan?.frames).toEqual(agentFramePlan.frames);
        expect(saved.episodes[0].shots[0].fieldOrigins).toMatchObject({ executionVideoPrompt: "ai", framePlan: "ai" });
    });

    it("persists a missing frame placeholder before confirming its visual run", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [
                    { id: "f1", sequenceIndex: 1, source: "generated", status: "success", mediaUrl: "/api/frame-one.png", continuityStatus: "passed" },
                    { id: "f2", sequenceIndex: 2, source: "generated", status: "success", mediaUrl: "/api/frame-two.png", continuityStatus: "passed" },
                ],
            } as never,
        ];
        const run = {
            id: "run-frame-three",
            projectId: current.id,
            episodeId: "episode-one",
            planRevision: "revision-three",
            status: "ready",
            scope: "visual",
            mode: "strict",
            parameterSnapshot: { imageModel: "image-default", videoModel: "", ratio: "9:16" },
            steps: [
                { id: "frame-shot-one-f1", type: "keyframe", shotId: "shot-one", frameId: "f1", sequenceIndex: 1, dependsOn: [], status: "success", outputUrls: ["/api/frame-one.png"] },
                { id: "frame-shot-one-f2", type: "keyframe", shotId: "shot-one", frameId: "f2", sequenceIndex: 2, dependsOn: [], status: "success", outputUrls: ["/api/frame-two.png"] },
                { id: "frame-shot-one-f3", type: "keyframe", shotId: "shot-one", frameId: "f3", sequenceIndex: 3, dependsOn: [], status: "ready" },
            ],
            blockers: [],
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never;
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.getDramaProductionRun.mockResolvedValue(run);
        mocks.updateDramaProductionRun.mockImplementation(async (_userId: string, value: unknown) => value);

        await updateDramaProductionRunForUser("user-one", current.id, "run-frame-three", { action: "confirm" });

        expect(mocks.updateDramaProject).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({
                episodes: [
                    expect.objectContaining({
                        shots: [expect.objectContaining({ storyboardFrames: expect.arrayContaining([expect.objectContaining({ id: "f3", sequenceIndex: 3, status: "queued" })]) })],
                    }),
                ],
            }),
            current.updatedAt,
        );
    });

    it("redispatches an already confirmed visual run that still has a ready frame", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [{ id: "f1", sequenceIndex: 1, source: "generated", status: "queued" }],
            } as never,
        ];
        const runId = "run-confirmed-ready";
        const run = {
            id: runId,
            projectId: current.id,
            episodeId: "episode-one",
            planRevision: "revision-confirmed-ready",
            status: "running",
            scope: "visual",
            mode: "strict",
            confirmedAt: current.updatedAt,
            parameterSnapshot: { imageModel: "image-default", imageChannelId: "image-channel", imageQuality: "standard", videoModel: "", ratio: "9:16" },
            steps: [{ id: "frame-shot-one-f1", type: "keyframe", shotId: "shot-one", frameId: "f1", sequenceIndex: 1, dependsOn: [], status: "ready" }],
            blockers: [],
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never;
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.getDramaProductionRun.mockResolvedValue(run);
        mocks.updateDramaProductionRun.mockImplementation(async (_userId: string, value: unknown) => value);
        mocks.fetchInternalApi.mockResolvedValue({ ok: true, json: async () => ({ task: { id: "image-task-redispatched" } }) });

        await updateDramaProductionRunForUser("user-one", current.id, runId, { action: "confirm", origin: "http://localhost:3010", cookie: "session=test" });

        expect(mocks.fetchInternalApi).toHaveBeenCalledWith("http://localhost:3010/api/image-tasks", expect.objectContaining({ method: "POST" }));
    });

    it("rebases submission placeholders when an optimistic project save wins the race", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            { id: "shot-one", title: "镜头", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 6, storyboardFrameMode: "all_frames", storyboardFrames: [] },
        ] as never;
        const latest = { ...current, updatedAt: "2026-07-19T08:00:01.000Z" };
        const run = {
            id: "run-frame-three",
            projectId: current.id,
            episodeId: "episode-one",
            planRevision: "revision-three",
            status: "ready",
            scope: "visual",
            mode: "strict",
            parameterSnapshot: { imageModel: "image-default", videoModel: "", ratio: "9:16" },
            steps: [{ id: "frame-shot-one-f3", type: "keyframe", shotId: "shot-one", frameId: "f3", sequenceIndex: 3, dependsOn: [], status: "ready" }],
            blockers: [],
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never;
        mocks.getDramaProject.mockResolvedValueOnce(current).mockResolvedValue(latest);
        mocks.getDramaProductionRun.mockResolvedValue(run);
        mocks.updateDramaProductionRun.mockImplementation(async (_userId: string, value: unknown) => value);
        mocks.updateDramaProject.mockRejectedValueOnce(new DramaProjectStoreError("短剧项目已在其他页面更新，请刷新后重试", 409)).mockImplementation(async (_userId: string, value: DramaProject) => value);

        await expect(updateDramaProductionRunForUser("user-one", current.id, "run-frame-three", { action: "confirm" })).resolves.toMatchObject({ id: "run-frame-three" });
        expect(mocks.updateDramaProject).toHaveBeenLastCalledWith(
            "user-one",
            expect.objectContaining({ episodes: [expect.objectContaining({ shots: [expect.objectContaining({ storyboardFrames: [expect.objectContaining({ id: "f3", status: "queued" })] })] })] }),
            latest.updatedAt,
        );
    });

    it("atomically selects a generated frame candidate and invalidates later frames", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [
                    {
                        id: "f1",
                        sequenceIndex: 1,
                        source: "generated",
                        status: "success",
                        taskId: "task-old",
                        mediaUrl: "/api/frame-old.png",
                        continuityStatus: "passed",
                        candidates: [
                            { id: "candidate-old", mediaUrl: "/api/frame-old.png", source: "generated", taskId: "task-old", createdAt: current.updatedAt, continuityStatus: "passed" },
                            {
                                id: "candidate-new",
                                mediaUrl: "/api/frame-new.png",
                                source: "generated",
                                taskId: "task-new",
                                createdAt: current.updatedAt,
                                continuityStatus: "pending",
                                generationPrompt: "实际提交给供应商的完整提示词",
                                generationReferences: [{ id: "scene-one", label: "黑湖参考图", binding: "锁定湖面与倒悬塔", url: "/api/black-lake.png" }],
                            },
                        ],
                    },
                    { id: "f2", sequenceIndex: 2, source: "generated", status: "success", mediaUrl: "/api/frame-two.png", continuityStatus: "passed" },
                ],
                frameEvidence: [
                    createFrameEvidence({ role: "storyboard_keyframe", sequenceIndex: 1, source: "generated", mediaUrl: "/api/frame-old.png", sourceShotId: "shot-one", generationTaskId: "task-old", validity: "accepted" }),
                    createFrameEvidence({ role: "storyboard_keyframe", sequenceIndex: 1, source: "generated", mediaUrl: "/api/frame-new.png", sourceShotId: "shot-one", generationTaskId: "task-new", validity: "candidate" }),
                ],
            } as never,
        ];
        mocks.getDramaProject.mockResolvedValue(current);

        const updated = await acceptDramaStoryboardFrameForUser("user-one", current.id, "episode-one", "shot-one", "f1", "candidate-new");
        const frames = updated.episodes[0].shots[0].storyboardFrames || [];

        expect(frames[0]).toMatchObject({
            id: "f1",
            mediaUrl: "/api/frame-new.png",
            taskId: "task-new",
            continuityStatus: "passed",
            generationPrompt: "实际提交给供应商的完整提示词",
            generationReferences: [{ id: "scene-one", label: "黑湖参考图", binding: "锁定湖面与倒悬塔", url: "/api/black-lake.png" }],
        });
        expect(frames[1]).toMatchObject({ id: "f2", status: "stale", continuityStatus: "stale" });
        expect(updated.episodes[0].shots[0].frameEvidence).toEqual(expect.arrayContaining([expect.objectContaining({ mediaUrl: "/api/frame-new.png", validity: "accepted" })]));
    });

    it("preserves storyboard frame candidates through project normalization", () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        const normalized = normalizeProject(
            {
                ...current,
                episodes: [
                    {
                        ...current.episodes[0],
                        shots: [
                            {
                                id: "shot-one",
                                title: "镜头",
                                characterIds: [],
                                propIds: [],
                                clueIds: [],
                                imagePrompt: "画面",
                                videoPrompt: "动作",
                                duration: 5,
                                storyboardFrames: [
                                    {
                                        id: "f1",
                                        sequenceIndex: 1,
                                        source: "generated",
                                        status: "success",
                                        mediaUrl: "/api/old.png",
                                        candidateStatus: "running",
                                        candidateTaskId: "task-new",
                                        candidates: [{ id: "candidate-new", mediaUrl: "/api/new.png", source: "generated", taskId: "task-new", createdAt: current.updatedAt, continuityStatus: "pending" }],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            current,
        );

        expect(normalized.episodes[0].shots[0].storyboardFrames?.[0]).toMatchObject({
            candidateStatus: "running",
            candidateTaskId: "task-new",
            candidates: [{ id: "candidate-new", mediaUrl: "/api/new.png", taskId: "task-new", continuityStatus: "pending" }],
        });
    });

    it("revives legacy storyboard image URLs as active frame evidence", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                storyboardFrameMode: "first_last",
                storyboardStatus: "success",
                storyboardImageUrl: "/api/start.png",
                storyboardImageUrls: ["/api/start.png"],
                storyboardEndStatus: "success",
                storyboardEndImageUrl: "/api/end.png",
                storyboardEndImageUrls: ["/api/end.png"],
            },
        ] as never;

        mocks.getDramaProject.mockResolvedValue(current);
        const recovered = await getDramaProjectForUser("user-one", current.id);

        expect(recovered.episodes[0].shots[0].frameEvidence).toMatchObject([
            { role: "storyboard_start", mediaUrl: "/api/start.png", validity: "candidate" },
            { role: "storyboard_end", mediaUrl: "/api/end.png", validity: "candidate" },
        ]);
        expect(mocks.updateDramaProject).toHaveBeenCalled();
    });

    it("marks the originating frame as failed when a visual step has a terminal error", () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                storyboardStatus: "running",
                storyboardTaskId: "task-one",
                frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/pending.png", generationTaskId: "task-one", validity: "candidate" })],
            },
        ] as never;

        const updated = applyDramaVisualStepFailure(current, "episode-one", { id: "start-shot-one", type: "start_frame", shotId: "shot-one", taskId: "task-one", dependsOn: [], status: "running" }, "上游服务暂时不可用");

        expect(updated.episodes[0].shots[0]).toMatchObject({ storyboardStatus: "error", storyboardTaskId: "task-one", storyboardError: "上游服务暂时不可用" });
        expect(updated.episodes[0].shots[0].frameEvidence?.[0]).toMatchObject({ validity: "unavailable", invalidReason: "上游服务暂时不可用" });
    });

    it("restores a missing keyframe placeholder when its submitted task failed quickly", () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [],
            },
        ] as never;

        const updated = applyDramaVisualStepFailure(
            current,
            "episode-one",
            { id: "frame-shot-one-f3", type: "keyframe", shotId: "shot-one", frameId: "f3", sequenceIndex: 3, taskId: "task-three", dependsOn: [], status: "running" },
            "参考素材暂时无法提交给当前生成渠道",
        );

        expect(updated.episodes[0].shots[0].storyboardFrames).toEqual([expect.objectContaining({ id: "f3", sequenceIndex: 3, status: "error", taskId: "task-three", error: "参考素材暂时无法提交给当前生成渠道" })]);
    });

    it("reconciles an already-terminal visual run into a project that missed the fast failure", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [],
            },
        ] as never;
        const failedRun = {
            id: "run-frame-three",
            projectId: current.id,
            episodeId: "episode-one",
            status: "needs_review",
            scope: "visual",
            mode: "strict",
            parameterSnapshot: { imageModel: "image-default", videoModel: "", ratio: "9:16" },
            steps: [
                {
                    id: "frame-shot-one-f3",
                    type: "keyframe",
                    shotId: "shot-one",
                    frameId: "f3",
                    sequenceIndex: 3,
                    taskId: "task-three",
                    dependsOn: [],
                    status: "failed",
                    error: "参考素材暂时无法提交给当前生成渠道",
                },
            ],
            blockers: [],
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never;
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.findLatestDramaProductionRun.mockResolvedValue(failedRun);

        await getLatestDramaProductionRunForUser("user-one", current.id, "episode-one", { scope: "visual" });

        expect(mocks.updateDramaProject).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({
                episodes: [expect.objectContaining({ shots: [expect.objectContaining({ storyboardFrames: [expect.objectContaining({ id: "f3", status: "error", error: "参考素材暂时无法提交给当前生成渠道" })] })] })],
            }),
            current.updatedAt,
        );
    });

    it("submits the prompt captured in the visual run instead of rebuilding from a stale project", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "旧提示词",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [],
            },
        ] as never;
        const runId = "run-frame-snapshot";
        const run = {
            id: runId,
            projectId: current.id,
            episodeId: "episode-one",
            status: "ready",
            scope: "visual",
            mode: "strict",
            confirmedAt: current.updatedAt,
            parameterSnapshot: { imageModel: "image-default", imageChannelId: "image-channel", imageQuality: "standard", videoModel: "", ratio: "9:16" },
            steps: [{ id: "frame-shot-one-f1", type: "keyframe", shotId: "shot-one", frameId: "f1", sequenceIndex: 1, dependsOn: [], status: "ready", prompt: "快照提示词", referenceAssetIds: [] }],
            blockers: [],
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never;
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.findLatestDramaProductionRun.mockResolvedValue(run);
        mocks.fetchInternalApi.mockResolvedValue({ ok: true, json: async () => ({ task: { id: "image-task-snapshot" } }) });

        await getLatestDramaProductionRunForUser("user-one", current.id, "episode-one", { scope: "visual", origin: "http://localhost:3010", cookie: "session=test" });

        const body = JSON.parse(String(mocks.fetchInternalApi.mock.calls[0]?.[1]?.body));
        expect(body.prompt).toContain("快照提示词");
        expect(body.prompt).not.toContain("旧提示词");
        expect(body.context).toMatchObject({ runId, frameId: "f1" });
    });

    it("keeps the persisted continuity URL when creating a run from a local-only shot snapshot", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        const frames = [
            {
                id: "f1",
                sequenceIndex: 1,
                startSecond: 0,
                endSecond: 3,
                actionPrompt: "动作一",
                imagePrompt: "画面一",
                mediaUrl: "/api/generation-log-assets/f1.png",
                remoteUrl: "https://cdn.example.com/f1.png",
                source: "generated" as const,
                status: "success" as const,
            },
            {
                id: "f2",
                sequenceIndex: 2,
                startSecond: 3,
                endSecond: 6,
                actionPrompt: "动作二",
                imagePrompt: "画面二",
                mediaUrl: "/api/generation-log-assets/f2.png",
                remoteUrl: "https://cdn.example.com/f2.png",
                source: "generated" as const,
                status: "success" as const,
            },
        ];
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                description: "连续动作",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                framePlan: { start: { source: "independent" }, end: { required: false }, frames: frames.map(({ mediaUrl: _mediaUrl, remoteUrl: _remoteUrl, source: _source, status: _status, ...beat }) => beat) },
                storyboardFrames: frames,
            },
        ] as never;
        mocks.getDramaProject.mockResolvedValue(current);
        const snapshot = structuredClone(current.episodes[0].shots[0]);
        delete snapshot.storyboardFrames;
        delete snapshot.frameEvidence;

        const run = await createDramaProductionRunForUser("user-one", current.id, { episodeId: "episode-one", scope: "visual", shotIds: ["shot-one"], frameType: "all_frames", frameIds: ["f2"], shotSnapshot: snapshot });

        expect(run.steps.find((step) => step.frameId === "f2")).toMatchObject({ referenceImageUrls: ["/api/generation-log-assets/f1.png"], referenceImageRemoteUrls: ["https://cdn.example.com/f1.png"] });
    });

    it("submits the declared scene reference for a storyboard frame", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        const reference = { id: "carriage-ref", url: "https://cdn.example.com/carriage.png", source: "generated" as const, status: "approved" as const, label: "马车基准图", createdAt: new Date(0).toISOString() };
        current.scenes = [{ id: "scene-carriage", name: "前往阿佐雷斯的马车", description: "封闭木马车，左右长凳与右侧车窗", references: [reference], primaryReferenceId: reference.id }];
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "马车内惊醒",
                characterIds: [],
                sceneId: "scene-carriage",
                propIds: [],
                clueIds: [],
                imagePrompt: "马车内Karin惊醒",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [],
            },
        ] as never;
        const run = {
            id: "run-carriage-reference",
            projectId: current.id,
            episodeId: "episode-one",
            status: "ready",
            scope: "visual",
            mode: "strict",
            confirmedAt: current.updatedAt,
            parameterSnapshot: { imageModel: "image-default", videoModel: "", ratio: "9:16" },
            steps: [
                {
                    id: "frame-shot-one-f1",
                    type: "keyframe",
                    shotId: "shot-one",
                    frameId: "f1",
                    sequenceIndex: 1,
                    dependsOn: [],
                    status: "ready",
                    prompt: "马车中景提示词",
                    referenceAssetIds: ["scene-carriage"],
                    referenceManifest: [{ alias: "@车", role: "scene_anchor", purpose: "锁定马车内部空间", assetId: "scene-carriage" }],
                },
            ],
            blockers: [],
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never;
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.findLatestDramaProductionRun.mockResolvedValue(run);
        mocks.fetchInternalApi.mockResolvedValue({ ok: true, json: async () => ({ task: { id: "image-task-carriage" } }) });

        await getLatestDramaProductionRunForUser("user-one", current.id, "episode-one", { scope: "visual", origin: "http://localhost:3010", cookie: "session=test" });

        const body = JSON.parse(String(mocks.fetchInternalApi.mock.calls[0]?.[1]?.body));
        expect(body.references).toEqual(expect.arrayContaining([expect.objectContaining({ id: "asset-scene-carriage", url: "https://cdn.example.com/carriage.png" })]));
        expect(body.prompt).toContain("锁定马车内部空间");
    });

    it("fails a frame locally when a declared scene reference cannot be submitted", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.scenes = [{ id: "scene-carriage", name: "前往阿佐雷斯的马车", description: "封闭木马车", references: [], primaryReferenceId: "missing" }];
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "马车内惊醒",
                characterIds: [],
                sceneId: "scene-carriage",
                propIds: [],
                clueIds: [],
                imagePrompt: "马车内Karin惊醒",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [],
            },
        ] as never;
        const run = {
            id: "run-missing-reference",
            projectId: current.id,
            episodeId: "episode-one",
            status: "ready",
            scope: "visual",
            mode: "strict",
            confirmedAt: current.updatedAt,
            parameterSnapshot: { imageModel: "image-default", videoModel: "", ratio: "9:16" },
            steps: [{ id: "frame-shot-one-f1", type: "keyframe", shotId: "shot-one", frameId: "f1", sequenceIndex: 1, dependsOn: [], status: "ready", prompt: "马车中景提示词", referenceAssetIds: ["scene-carriage"] }],
            blockers: [],
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never;
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.findLatestDramaProductionRun.mockResolvedValue(run);

        const result = await getLatestDramaProductionRunForUser("user-one", current.id, "episode-one", { scope: "visual", origin: "http://localhost:3010", cookie: "session=test" });

        expect(result).not.toBeNull();
        if (!result) return;
        expect(result.steps[0]).toMatchObject({ status: "failed", error: expect.stringContaining("scene-carriage") });
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("reconciles a running image task whose persisted execution phase needs review", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [{ id: "f2", sequenceIndex: 2, source: "generated", status: "queued" }],
            },
        ] as never;
        const run = {
            id: "run-frame-two",
            projectId: current.id,
            episodeId: "episode-one",
            status: "running",
            scope: "visual",
            mode: "strict",
            confirmedAt: current.updatedAt,
            parameterSnapshot: { imageModel: "image-default", videoModel: "", ratio: "9:16" },
            steps: [
                {
                    id: "frame-shot-one-f2",
                    type: "keyframe",
                    shotId: "shot-one",
                    frameId: "f2",
                    sequenceIndex: 2,
                    taskId: "task-two",
                    dependsOn: [],
                    status: "running",
                },
            ],
            blockers: [],
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never;
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.findLatestDramaProductionRun.mockResolvedValue(run);
        mocks.getStoredGenerationTask.mockResolvedValue({ status: "running", executionPhase: "needs_review", reviewReason: "上游提交结果不确定" });

        await expect(getLatestDramaProductionRunForUser("user-one", current.id, "episode-one", { scope: "visual" })).resolves.toMatchObject({
            id: "run-frame-two",
            status: "needs_review",
            steps: [expect.objectContaining({ id: "frame-shot-one-f2", status: "needs_review", error: "上游提交结果不确定" })],
        });
        expect(mocks.updateDramaProject).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({ episodes: [expect.objectContaining({ shots: [expect.objectContaining({ storyboardFrames: [expect.objectContaining({ id: "f2", status: "error", error: "上游提交结果不确定" })] })] })] }),
            current.updatedAt,
        );
    });

    it("rebases a fast terminal visual failure when the project changed concurrently", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 6,
                storyboardFrameMode: "all_frames",
                storyboardFrames: [],
            },
        ] as never;
        const latest = { ...current, updatedAt: "2026-07-19T08:00:01.000Z" };
        const failedRun = {
            id: "run-frame-three",
            projectId: current.id,
            episodeId: "episode-one",
            status: "needs_review",
            scope: "visual",
            mode: "strict",
            parameterSnapshot: { imageModel: "image-default", videoModel: "", ratio: "9:16" },
            steps: [
                {
                    id: "frame-shot-one-f3",
                    type: "keyframe",
                    shotId: "shot-one",
                    frameId: "f3",
                    sequenceIndex: 3,
                    taskId: "task-three",
                    dependsOn: [],
                    status: "failed",
                    error: "参考素材暂时无法提交给当前生成渠道",
                },
            ],
            blockers: [],
            createdAt: current.updatedAt,
            updatedAt: current.updatedAt,
        } as never;
        mocks.getDramaProject.mockResolvedValueOnce(current).mockResolvedValue(latest);
        mocks.findLatestDramaProductionRun.mockResolvedValue(failedRun);
        mocks.updateDramaProject.mockRejectedValueOnce(new DramaProjectStoreError("短剧项目已在其他页面更新，请刷新后重试", 409)).mockImplementation(async (_userId: string, value: DramaProject) => value);

        await expect(getLatestDramaProductionRunForUser("user-one", current.id, "episode-one", { scope: "visual" })).resolves.toMatchObject({ id: "run-frame-three", status: "needs_review" });

        expect(mocks.updateDramaProject).toHaveBeenLastCalledWith(
            "user-one",
            expect.objectContaining({
                episodes: [expect.objectContaining({ shots: [expect.objectContaining({ storyboardFrames: [expect.objectContaining({ id: "f3", status: "error" })] })] })],
            }),
            latest.updatedAt,
        );
    });

    it("does not restore a storyboard frame the user explicitly removed", async () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                storyboardImageDeletedAt: "2026-07-19T08:00:00.000Z",
            },
        ] as never;
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.queryStoredGenerationTasks.mockResolvedValue([{ id: "old-start-frame", userId: "user-one", projectId: current.id, shotId: "shot-one", title: "镜头起始帧", status: "success", result: { serverUrl: "/api/generation-log-assets/old.png" } }]);

        const recovered = await getDramaProjectForUser("user-one", current.id);

        expect(recovered.episodes[0].shots[0].storyboardImageUrl).toBeUndefined();
        expect(mocks.updateDramaProject).not.toHaveBeenCalled();
    });

    it("invalidates boundary frames when they belong to an older video", () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                videoUrl: "/api/reference-assets/current.mp4",
                actualStartFrameUrl: "/api/reference-assets/old-start.png",
                actualEndFrameUrl: "/api/reference-assets/old-end.png",
                actualFrameVideoUrl: "/api/reference-assets/old.mp4",
                continuityStatus: "passed",
            },
        ] as never;

        const recovered = recoverStaleDramaBoundaryFrames(current);

        expect(recovered?.episodes[0].shots[0]).toMatchObject({ videoUrl: "/api/reference-assets/current.mp4", continuityStatus: "ready" });
        expect(recovered?.episodes[0].shots[0].actualStartFrameUrl).toBeUndefined();
        expect(recovered?.episodes[0].shots[0].actualEndFrameUrl).toBeUndefined();
    });

    it("does not let an older client snapshot overwrite the current project", async () => {
        const current = project("2026-07-19T08:00:02.000Z", "最新标题");
        mocks.getDramaProject.mockResolvedValue(current);

        const saved = await updateDramaProjectForUser("user-one", current.id, project("2026-07-19T08:00:01.000Z", "旧标题"));

        expect(saved).toEqual(current);
        expect(mocks.updateDramaProject).not.toHaveBeenCalled();
    });

    it("supersedes current and downstream frame evidence when a structured state changes", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                startFramePrompt: "黑湖，动作起始状态",
                continuity: { shotSize: "中景", cameraAngle: "平视", composition: "居中", characterBlocking: "湖畔", gazeDirection: "向前", actionStart: "黑湖", actionEnd: "黑湖", screenDirection: "向右", axisRule: "不越轴", continuityNotes: "连续" },
                entryState: { environment: "黑湖", lighting: "冷光", characters: [], props: [] },
                exitState: { environment: "黑湖", lighting: "冷光", characters: [], props: [] },
                framePlan: { start: { source: "independent" }, end: { required: true } },
                storyboardStatus: "success",
                storyboardImageUrl: "/api/old.png",
                storyboardImageUrls: ["/api/old.png"],
                storyboardImageRemoteUrl: "https://provider.example/old.png",
                frameEvidence: [{ id: "frame-old", role: "storyboard_start", source: "generated", mediaUrl: "/api/old.png", validity: "candidate", contentHash: "hash", createdAt: current.updatedAt }],
            },
        ] as never;
        const input = structuredClone(current);
        input.updatedAt = "2026-07-19T08:00:02.000Z";
        input.episodes[0].shots[0].entryState!.environment = "马车内";
        mocks.getDramaProject.mockResolvedValue(current);

        const saved = await updateDramaProjectForUser("user-one", current.id, input);

        expect(saved.episodes[0].shots[0]).toMatchObject({ storyboardStatus: "idle", storyboardImageUrl: undefined, storyboardImageUrls: undefined, storyboardImageRemoteUrl: undefined });
        expect(saved.episodes[0].shots[0].frameEvidence?.[0]).toMatchObject({ validity: "superseded", invalidReason: "镜头状态、连续性边或引用帧已变化" });
    });

    it("does not treat a legacy snapshot without frame evidence as an explicit deletion", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                storyboardStatus: "success",
                storyboardImageUrl: "/api/start.png",
                storyboardImageUrls: ["/api/start.png"],
                frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/start.png", validity: "candidate" })],
            },
        ] as never;
        const input = structuredClone(current);
        input.updatedAt = "2026-07-19T08:00:02.000Z";
        delete input.episodes[0].shots[0].frameEvidence;
        input.title = "其他字段已更新";
        mocks.getDramaProject.mockResolvedValue(current);

        const saved = await updateDramaProjectForUser("user-one", current.id, input);

        expect(saved.episodes[0].shots[0]).toMatchObject({ storyboardStatus: "success", storyboardImageUrl: "/api/start.png", frameEvidence: [expect.objectContaining({ role: "storyboard_start", mediaUrl: "/api/start.png", validity: "candidate" })] });
    });

    it("restores persisted remote image URLs when a browser shot snapshot only has local mirrors", () => {
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "原始提示词",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                storyboardImageUrl: "/api/generation-log-assets/start.png",
                storyboardImageRemoteUrl: "https://cdn.example.com/start.png",
                storyboardFrames: [
                    {
                        id: "f1",
                        sequenceIndex: 1,
                        mediaUrl: "/api/generation-log-assets/frame.png",
                        remoteUrl: "https://cdn.example.com/frame.png",
                        source: "generated",
                        status: "success",
                        candidates: [{ id: "candidate-1", mediaUrl: "/api/generation-log-assets/candidate.png", remoteUrl: "https://cdn.example.com/candidate.png", source: "generated", taskId: "task-old", createdAt: current.updatedAt }],
                    },
                ],
                frameEvidence: [
                    {
                        id: "evidence-1",
                        role: "storyboard_keyframe",
                        source: "generated",
                        mediaUrl: "/api/generation-log-assets/frame.png",
                        remoteUrl: "https://cdn.example.com/frame.png",
                        validity: "candidate",
                        contentHash: "hash",
                        createdAt: current.updatedAt,
                    },
                ],
                framePlan: {
                    start: { source: "independent" },
                    end: { required: false },
                    frames: [],
                    manualReferenceImages: [{ id: "manual-1", label: "场景", binding: "锁定场景", url: "/api/generation-log-assets/manual.png", remoteUrl: "https://cdn.example.com/manual.png" }],
                },
            } as never,
        ];
        const persisted = current.episodes[0].shots[0];
        const snapshot = structuredClone(persisted);
        delete snapshot.storyboardImageRemoteUrl;
        snapshot.storyboardFrames?.forEach((frame) => {
            delete frame.remoteUrl;
            frame.candidates?.forEach((candidate) => delete candidate.remoteUrl);
        });
        snapshot.frameEvidence?.forEach((frame) => delete frame.remoteUrl);
        snapshot.framePlan?.manualReferenceImages?.forEach((reference) => delete reference.remoteUrl);
        snapshot.storyboardFrames?.[0] && (snapshot.storyboardFrames[0].remoteUrl = "https://cdn.example.com/stale-frame.png");
        snapshot.imagePrompt = "用户刚编辑的提示词";

        const merged = mergeDramaShotMediaReferences(persisted, snapshot);

        expect(merged.imagePrompt).toBe("用户刚编辑的提示词");
        expect(merged.storyboardImageRemoteUrl).toBe("https://cdn.example.com/start.png");
        expect(merged.storyboardFrames?.[0]).toMatchObject({ remoteUrl: "https://cdn.example.com/frame.png", candidates: [{ remoteUrl: "https://cdn.example.com/candidate.png" }] });
        expect(merged.frameEvidence?.[0]).toMatchObject({ remoteUrl: "https://cdn.example.com/frame.png" });
        expect(merged.framePlan?.manualReferenceImages?.[0]).toMatchObject({ remoteUrl: "https://cdn.example.com/manual.png" });
    });

    it("accepts only the current video tail and rejects it by blocking downstream evidence", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        const tail = createFrameEvidence({ role: "actual_end", source: "video_extraction", mediaUrl: "/api/reference-assets/tail.png", sourceVideoUrl: "/api/reference-assets/shot-one.mp4", validity: "candidate" });
        current.episodes[0].shots = [
            { id: "shot-one", title: "第一镜", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 5, videoUrl: "/api/reference-assets/shot-one.mp4", frameEvidence: [tail] },
            {
                id: "shot-two",
                title: "第二镜",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                framePlan: { start: { source: "previous_accepted_actual_tail" }, end: { required: true } },
                frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/reference-assets/old.png", validity: "candidate" })],
            },
        ] as never;
        current.episodes[0].continuityEdges = [{ fromShotId: "shot-one", toShotId: "shot-two", transition: "continuous", inheritActualEndFrame: true, carryCharacterIds: [], carryPropIds: [], carryEnvironment: true, carryAxis: true }];
        mocks.getDramaProject.mockResolvedValue(current);

        const rejected = await decideDramaContinuityFrameForUser("user-one", current.id, "episode-one", "shot-one", { frameEvidenceId: tail.id, decision: "reject", expectedVideoRevision: current.episodes[0].shots[0].videoUrl });

        expect(rejected.episodes[0].shots[0].frameEvidence?.[0]).toMatchObject({ validity: "rejected" });
        expect(rejected.episodes[0].shots[1]).toMatchObject({ continuityStatus: "blocked", continuityError: expect.stringContaining("未获验收") });
        expect(rejected.episodes[0].shots[1].frameEvidence?.[0]).toMatchObject({ validity: "superseded" });
    });

    it("marks an abandoned review completion task as retryable when the project is reopened", async () => {
        const staleAt = new Date(Date.now() - 20 * 60_000).toISOString();
        const current = project(new Date(Date.now() - 20 * 60_000).toISOString(), "项目");
        current.episodes[0].reviewCompletionTask = {
            id: "review-completion-stale",
            status: "running",
            missingCount: 110,
            completedCount: 0,
            message: "AI 正在补全表演、光色和连续性字段",
            startedAt: staleAt,
            updatedAt: staleAt,
        };
        mocks.getDramaProject.mockResolvedValue(current);

        const recovered = await getDramaProjectForUser("user-one", current.id);

        expect(recovered.episodes[0].reviewCompletionTask).toMatchObject({ status: "error", error: "补全请求长时间未完成，已自动结束，请重新发起补全。" });
        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ episodes: [expect.objectContaining({ reviewCompletionTask: expect.objectContaining({ status: "error" }) })] }), current.updatedAt);
    });

    it("materializes a minimal series bible for legacy projects before preflight", async () => {
        const current = project("2026-07-19T08:00:02.000Z", "项目");
        current.characters = [{ id: "karin", name: "Karin", description: "角色" }];
        mocks.getDramaProject.mockResolvedValue(current);

        await getDramaProductionPreflightForUser("user-one", current.id, current.episodes[0].id);

        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ seriesBible: expect.objectContaining({ version: "series-bible-v1" }) }), current.updatedAt);
    });

    it("repairs expired generated asset URLs from the retained image task", async () => {
        const current = project("2026-07-19T08:00:02.000Z", "项目");
        current.characters = [
            {
                id: "karin",
                name: "Karin",
                description: "角色",
                references: [{ id: "karin-reference", url: "https://provider.example/expired.png", source: "generated", label: "Karin基准图", generationTaskId: "image-task-karin", status: "approved", createdAt: current.updatedAt }],
                primaryReferenceId: "karin-reference",
            },
        ];
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.getStoredGenerationTask.mockResolvedValue({
            id: "image-task-karin",
            userId: "user-one",
            projectId: current.id,
            status: "success",
            result: { serverUrl: "/api/generation-log-assets/permanent/karin.png" },
        });

        const recovered = await getDramaProjectForUser("user-one", current.id);

        expect(recovered.characters[0].references?.[0]).toMatchObject({ url: "/api/generation-log-assets/permanent/karin.png" });
        expect(recovered.characters[0].referenceImageUrl).toBe("/api/generation-log-assets/permanent/karin.png");
        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ characters: [expect.objectContaining({ referenceImageUrl: "/api/generation-log-assets/permanent/karin.png" })] }), current.updatedAt);
    });

    it("repairs legacy generated asset URLs by matching the retained task result", async () => {
        const current = project("2026-07-19T08:00:02.000Z", "项目");
        current.characters = [
            {
                id: "karin",
                name: "Karin",
                description: "角色",
                references: [{ id: "karin-reference", url: "https://provider.example/expired.png", source: "generated", label: "Karin基准图", status: "approved", createdAt: current.updatedAt }],
                primaryReferenceId: "karin-reference",
            },
        ];
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.queryStoredGenerationTasks.mockResolvedValue([
            {
                id: "image-task-karin-legacy",
                status: "success",
                projectId: current.id,
                result: { remoteUrl: "https://provider.example/expired.png", serverUrl: "/api/generation-log-assets/permanent/karin.png" },
            },
        ]);

        const recovered = await getDramaProjectForUser("user-one", current.id);

        expect(recovered.characters[0].references?.[0]).toMatchObject({ url: "/api/generation-log-assets/permanent/karin.png", generationTaskId: "image-task-karin-legacy" });
        expect(recovered.characters[0].referenceImageUrl).toBe("/api/generation-log-assets/permanent/karin.png");
    });

    it("restores the provider URL for a locally stored generated reference", async () => {
        const current = project("2026-07-19T08:00:02.000Z", "项目");
        current.characters = [
            {
                id: "karin",
                name: "Karin",
                description: "角色",
                references: [{ id: "karin-reference", url: "/api/generation-log-assets/permanent/karin.png", source: "generated", label: "Karin基准图", generationTaskId: "image-task-karin", status: "approved", createdAt: current.updatedAt }],
                primaryReferenceId: "karin-reference",
            },
        ];
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.getStoredGenerationTask.mockResolvedValue({
            id: "image-task-karin",
            userId: "user-one",
            projectId: current.id,
            status: "success",
            result: { remoteUrl: "https://provider.example/karin.png", serverUrl: "/api/generation-log-assets/permanent/karin.png" },
        });

        const recovered = await getDramaProjectForUser("user-one", current.id);

        expect(recovered.characters[0].references?.[0]).toMatchObject({ url: "/api/generation-log-assets/permanent/karin.png", remoteUrl: "https://provider.example/karin.png" });
        expect(mocks.updateDramaProject).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({ characters: [expect.objectContaining({ references: [expect.objectContaining({ remoteUrl: "https://provider.example/karin.png" })] })] }),
            current.updatedAt,
        );
    });

    it("restores the provider URL for a legacy local reference without a task ID", async () => {
        const current = project("2026-07-19T08:00:02.000Z", "项目");
        current.characters = [
            {
                id: "karin",
                name: "Karin",
                description: "角色",
                references: [{ id: "karin-reference", url: "/api/generation-log-assets/permanent/karin.png", source: "generated", label: "Karin基准图", status: "approved", createdAt: current.updatedAt }],
                primaryReferenceId: "karin-reference",
            },
        ];
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.queryStoredGenerationTasks.mockResolvedValue([
            {
                id: "image-task-karin-legacy-local",
                status: "success",
                result: { remoteUrl: "https://provider.example/karin.png", serverUrl: "/api/generation-log-assets/permanent/karin.png" },
            },
        ]);

        const recovered = await getDramaProjectForUser("user-one", current.id);

        expect(recovered.characters[0].references?.[0]).toMatchObject({ url: "/api/generation-log-assets/permanent/karin.png", remoteUrl: "https://provider.example/karin.png", generationTaskId: "image-task-karin-legacy-local" });
    });

    it("normalizes and stores a newer client snapshot", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "旧标题");
        mocks.getDramaProject.mockResolvedValue(current);

        const saved = await updateDramaProjectForUser("user-one", current.id, project("2026-07-19T08:00:02.000Z", "新标题"));

        expect(saved.title).toBe("新标题");
        expect(saved.updatedAt).toBe("2026-07-19T08:00:02.000Z");
        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ id: current.id, title: "新标题", updatedAt: "2026-07-19T08:00:02.000Z" }), current.updatedAt);
    });

    it("persists the locked episode resolution instead of falling back to the default", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        mocks.getDramaProject.mockResolvedValue(current);
        const incoming = {
            ...current,
            updatedAt: "2026-07-19T08:00:02.000Z",
            productionBible: {
                ...current.productionBible,
                productionPlan: {
                    version: "drama-production-plan-v1",
                    skills: [],
                    video: { model: "seedance-2-5", mode: "storyboard", ratio: "9:16", resolution: "480p", durationPolicy: "shot", count: 1, audioMode: "native", allowExplicitFallback: false },
                    references: { strategy: "adaptive", minImages: 3, maxImages: 5, roles: [] },
                    continuity: { mode: "strict", requireAcceptedActualTail: true },
                    lockedAt: "2026-07-19T08:00:02.000Z",
                    source: "manual",
                },
            },
        };

        const saved = await updateDramaProjectForUser("user-one", current.id, incoming);

        expect(saved.productionBible?.productionPlan).toMatchObject({ lockedAt: "2026-07-19T08:00:02.000Z", source: "manual", video: { resolution: "480p" } });
        expect(mocks.updateDramaProject).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({ productionBible: expect.objectContaining({ productionPlan: expect.objectContaining({ lockedAt: "2026-07-19T08:00:02.000Z", video: expect.objectContaining({ resolution: "480p" }) }) }) }),
            current.updatedAt,
        );
    });

    it("saves compact episode settings against the latest large project", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        current.productionArchive = {
            formatVersion: "vozeb-drama-production-package-v1",
            sections: [{ code: "01", title: "大型制作包", content: "制作包内容".repeat(1_000_000) }],
            promptAssets: [],
            dialogueDirections: [],
            voiceDirections: [],
            silenceDirections: [],
            referencePlan: [],
            generationOrder: [],
            qcReport: "",
        };
        mocks.getDramaProject.mockResolvedValue(current);
        const productionPlan = { ...defaultDramaProductionPlan("manual"), lockedAt: "2026-07-19T08:00:02.000Z", video: { ...defaultDramaProductionPlan("manual").video, resolution: "480p" as const } };

        const saved = await saveDramaEpisodeSettingsForUser("user-one", current.id, "episode-one", { title: "新集名", summary: "新摘要", style: "黑暗学院", productionPlan });

        expect(saved).toMatchObject({
            summary: "新摘要",
            style: "黑暗学院",
            episodes: [{ id: "episode-one", title: "新集名" }],
            productionBible: { visualStyle: "黑暗学院", productionPlan: { lockedAt: productionPlan.lockedAt, video: { resolution: "480p" } } },
        });
        expect(saved.productionArchive).toBe(current.productionArchive);
        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ id: current.id, productionArchive: current.productionArchive }), current.updatedAt);
    });

    it("synchronizes episode settings style and removes a stale default color script", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        const customStyle = "ARRI自然光真人影视感，冷灰蓝；禁止动漫与游戏CG";
        current.style = customStyle;
        current.productionBible = { ...current.productionBible!, visualStyle: DRAMA_STYLE_NAME, colorScript: DRAMA_STYLE_COLOR_SCRIPT };
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.updateDramaProject.mockImplementation(async (_userId: string, value: DramaProject) => value);

        const saved = await saveDramaEpisodeSettingsForUser("user-one", current.id, "episode-one", {
            style: customStyle,
            productionPlan: current.productionBible?.productionPlan || defaultDramaProductionPlan("manual"),
        });

        expect(saved.style).toBe(customStyle);
        expect(saved.productionBible?.visualStyle).toBe(customStyle);
        expect(saved.productionBible?.colorScript).toBeUndefined();
    });

    it("applies a stale lock request to the latest project without overwriting other fields", async () => {
        const current = { ...project("2026-07-19T08:00:05.000Z", "最新标题"), summary: "保留服务端摘要" };
        mocks.getDramaProject.mockResolvedValue(current);
        const incomingPlan = { ...defaultDramaProductionPlan("manual"), video: { ...defaultDramaProductionPlan("manual").video, resolution: "480p" as const }, lockedAt: "2026-07-19T08:00:02.000Z", source: "manual" as const };

        const saved = await updateDramaProjectForUser("user-one", current.id, {
            defaultVideoMode: "storyboard",
            productionBible: { productionPlan: incomingPlan },
        });

        expect(saved).toMatchObject({ title: "最新标题", summary: "保留服务端摘要", defaultVideoMode: "storyboard", productionBible: { productionPlan: { lockedAt: incomingPlan.lockedAt, video: { resolution: "480p" } } } });
        expect(mocks.updateDramaProject).toHaveBeenCalledWith(
            "user-one",
            expect.objectContaining({
                title: "最新标题",
                summary: "保留服务端摘要",
                productionBible: expect.objectContaining({ productionPlan: expect.objectContaining({ lockedAt: incomingPlan.lockedAt, video: expect.objectContaining({ resolution: "480p" }) }) }),
            }),
            current.updatedAt,
        );
    });

    it("does not let an autosave clear an already locked production plan", async () => {
        const lockedPlan = { ...defaultDramaProductionPlan("manual"), video: { ...defaultDramaProductionPlan("manual").video, resolution: "480p" as const }, lockedAt: "2026-07-19T08:00:02.000Z", source: "manual" as const };
        const current = { ...project("2026-07-19T08:00:01.000Z", "项目"), productionBible: { ...project("2026-07-19T08:00:01.000Z", "项目").productionBible!, productionPlan: lockedPlan } };
        mocks.getDramaProject.mockResolvedValue(current);

        const saved = await updateDramaProjectForUser("user-one", current.id, {
            ...current,
            updatedAt: "2026-07-19T08:00:03.000Z",
            productionBible: { ...current.productionBible, productionPlan: { ...lockedPlan, lockedAt: undefined, source: "manual" as const } },
        });

        expect(saved.productionBible?.productionPlan).toMatchObject({ lockedAt: lockedPlan.lockedAt, video: { resolution: "480p" } });
    });

    it("uses the backend default video model instead of a project's locked model", async () => {
        const plan = { ...defaultDramaProductionPlan("manual"), lockedAt: "2026-07-19T08:00:00.000Z", video: { ...defaultDramaProductionPlan("manual").video, model: "selected-video" } };
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        current.productionBible = { ...current.productionBible!, productionPlan: plan };
        current.episodes[0].reviewStatus = "visual_ready";
        current.episodes[0].shots = [
            {
                id: "shot-one",
                title: "镜头一",
                description: "人物在场景中完成连续动作",
                sourceText: "人物在场景中完成连续动作",
                storyboardFrameMode: "all_frames",
                framePlan: {
                    start: { source: "independent" },
                    end: { required: true },
                    frames: [1, 2, 3, 4].map((sequenceIndex) => ({
                        id: `f${sequenceIndex}`,
                        sequenceIndex,
                        startSecond: sequenceIndex - 1,
                        endSecond: sequenceIndex,
                        imagePrompt: `静态画面 ${sequenceIndex}，禁止文字水印`,
                        actionPrompt: `动作状态 ${sequenceIndex}`,
                    })),
                },
            } as never,
        ];
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.getAuthSettings.mockResolvedValue({
            defaultModels: { imageModel: "image-default", videoModel: "other-compatible-video", audioModel: "" },
            generationDefaults: { imageQuality: "standard", videoQuality: "720" },
        });
        mocks.resolveLogicalModelCandidates.mockReturnValue([{ logicalModelId: "other-compatible-video", channelId: "default-video-channel" }]);
        mocks.supportsVideoKeyframeReferences.mockReturnValue(false);

        const pending = createDramaProductionRunForUser("user-one", current.id, {
            episodeId: current.episodes[0].id,
            preflight: { checkedShotIds: ["shot-one"] },
        });
        await expect(pending).rejects.toMatchObject({ status: 409, message: "后台默认视频模型 other-compatible-video 未声明支持全能帧关键图，请在后台为该模型声明全能帧能力或调整本集帧模式" });
        expect(mocks.resolveLogicalModelCandidates).toHaveBeenCalledWith(expect.anything(), "video", "other-compatible-video");
        expect(mocks.createDramaProductionRun).not.toHaveBeenCalled();
    });

    it("captures the backend default model in a drama run even when the project plan is stale", async () => {
        const plan = { ...defaultDramaProductionPlan("manual"), lockedAt: "2026-07-19T08:00:00.000Z", video: { ...defaultDramaProductionPlan("manual").video, model: "alibaba/wan-3.0" } };
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        current.productionBible = { ...current.productionBible!, productionPlan: plan };
        current.seriesBible = { version: "series-bible-v1", canonCharacters: [], immutableRules: [], relationshipState: "", worldRules: [], unresolvedThreads: [], visualMotifs: [], soundMotifs: [] };
        current.episodes[0].reviewStatus = "visual_ready";
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.getAuthSettings.mockResolvedValue({
            defaultModels: { imageModel: "image-default", videoModel: "backend-default-video", audioModel: "" },
            generationDefaults: { imageQuality: "standard", videoQuality: "720" },
        });
        mocks.resolveLogicalModelCandidates.mockImplementation((_settings: unknown, capability: string, model: string) =>
            capability === "video" && model === "backend-default-video" ? [{ logicalModelId: "backend-default-video", channelId: "backend-video-channel" }] : [{ logicalModelId: "image-default", channelId: "image-channel" }],
        );
        mocks.supportsVideoKeyframeReferences.mockReturnValue(true);

        const run = await createDramaProductionRunForUser("user-one", current.id, { episodeId: current.episodes[0].id });

        expect(run.parameterSnapshot).toMatchObject({ videoModel: "backend-default-video", videoChannelId: "backend-video-channel", productionPlan: { video: { model: "backend-default-video", channelId: "backend-video-channel" } } });
        expect(mocks.resolveLogicalModelCandidates).toHaveBeenCalledWith(expect.anything(), "video", "backend-default-video");
    });

    it("allows settings updates for a project that already exceeds the snapshot size guard", async () => {
        const current = { ...project("2026-07-19T08:00:05.000Z", "项目"), summary: "x".repeat(2 * 1024 * 1024) };
        mocks.getDramaProject.mockResolvedValue(current);

        const saved = await updateDramaProjectForUser("user-one", current.id, { ...current, summary: `${current.summary}保留` });

        expect(saved.summary).toContain("保留");
        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ summary: expect.stringContaining("保留") }), current.updatedAt);
    });

    it("preserves an imported project style before the next generation request", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "Mahadel");
        current.style = "VS14 中世纪史诗的学院奇幻变体；宏大空间与克制人物近景并重";
        current.productionBible = { ...current.productionBible!, visualStyle: current.style, colorScript: "深蓝灰、旧银、墨绿、少量暖金" };
        mocks.getDramaProject.mockResolvedValue(current);

        const recovered = await getDramaProjectForUser("user-one", current.id);

        expect(recovered).toMatchObject({ style: current.style, productionBible: { visualStyle: current.style, colorScript: "深蓝灰、旧银、墨绿、少量暖金" } });
        expect(mocks.updateDramaProject).not.toHaveBeenCalled();
    });

    it("does not add the default color script to a custom imported style", () => {
        const current = project("2026-07-19T08:00:01.000Z", "Mahadel");
        const customStyle = "现实悬疑电影感，冷蓝灰低饱和";

        const normalized = normalizeProject({ ...current, style: customStyle, productionBible: { ...current.productionBible, visualStyle: customStyle, colorScript: undefined } }, current);

        expect(normalized.style).toBe(customStyle);
        expect(normalized.productionBible?.visualStyle).toBe(customStyle);
        expect(normalized.productionBible?.colorScript).toBeUndefined();
    });

    it("does not infer character styling for a location asset", () => {
        const current = project("2026-07-19T08:00:01.000Z", "Mahadel");
        const normalized = normalizeProject(
            {
                ...current,
                scenes: [{ id: "scene-black-lake", name: "黑湖记忆", description: "无风黑湖、倒悬古塔、雪地边界", profile: { visualIdentity: "无风黑湖、倒悬古塔", styling: "", colorPalette: "", consistencyRules: "" } }],
            },
            current,
        );

        expect(normalized.scenes[0]?.profile?.styling).not.toContain("发型");
        expect(normalized.scenes[0]?.profile?.styling).not.toContain("服装");
        expect(normalized.scenes[0]?.profile?.styling).toContain("陈设");
    });

    it("preserves asset refinement history and candidate review metadata", () => {
        const current = project("2026-07-19T08:00:02.000Z", "项目");
        const proposal = {
            reply: "已调整",
            changes: [{ field: "styling", before: "通用皮甲", after: "原创职业服装", reason: "增强身份识别" }],
            updatedProfile: { visualIdentity: "固定五官", styling: "原创职业服装", colorPalette: "深色", consistencyRules: "固定年龄" },
            compiledPrompt: "完整提示词",
            negativePrompt: "通用 NPC",
            preservedRules: ["固定年龄"],
        };
        const normalized = normalizeProject(
            {
                ...current,
                characters: [
                    {
                        id: "rifa",
                        name: "Rifa",
                        description: "女主角",
                        profile: proposal.updatedProfile,
                        refinementHistory: [{ id: "refine-one", request: "精修服装", reply: "已调整", proposal, createdAt: current.updatedAt }],
                        references: [
                            {
                                id: "candidate-one",
                                url: "https://example.com/rifa.png",
                                source: "generated",
                                label: "候选",
                                createdAt: current.updatedAt,
                                promptVersion: 2,
                                compiledPrompt: "完整提示词",
                                promptChanges: proposal.changes,
                                generationTaskId: "task-one",
                                reviewStatus: "needs_revision",
                                reviewSummary: "服装仍模板化",
                                refinement: proposal,
                            },
                        ],
                    },
                ],
            },
            current,
        );

        expect(normalized.characters[0]).toMatchObject({
            refinementHistory: [{ request: "精修服装", proposal: { compiledPrompt: "完整提示词" } }],
            references: [{ promptVersion: 2, generationTaskId: "task-one", reviewStatus: "needs_revision", refinement: { negativePrompt: "通用 NPC" } }],
        });
    });

    it("normalizes duplicate reference ids before persistence", () => {
        const current = project("2026-07-19T08:00:02.000Z", "项目");
        const normalized = normalizeProject(
            {
                ...current,
                characters: [
                    {
                        id: "character-one",
                        name: "角色",
                        references: [
                            { id: "reference-task-0", url: "/first.png", source: "generated", label: "第一张" },
                            { id: "reference-task-0", url: "/second.png", source: "generated", label: "第二张" },
                        ],
                    },
                ],
            },
            current,
        );

        expect(normalized.characters[0]?.references?.map((reference) => reference.id)).toEqual(["reference-task-0", "reference-task-0-2"]);
    });

    it("preserves exact project dimensions and reference metadata", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "旧标题");
        mocks.getDramaProject.mockResolvedValue(current);
        const input = {
            ...project("2026-07-19T08:00:02.000Z", "新标题"),
            ratio: "1080x1920",
            characters: [
                {
                    id: "character-one",
                    name: "主角",
                    description: "",
                    references: [{ id: "reference-one", url: "/api/reference-assets/hero.png", source: "upload", label: "主角", width: 1080, height: 1920, createdAt: "2026-07-19T08:00:00.000Z" }],
                },
            ],
        };

        const saved = await updateDramaProjectForUser("user-one", current.id, input);

        expect(saved).toMatchObject({ ratio: "1080x1920", characters: [{ references: [{ width: 1080, height: 1920 }] }] });
    });

    it("preserves exact project dimensions without a platform ceiling", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "旧标题");
        mocks.getDramaProject.mockResolvedValue(current);

        await expect(updateDramaProjectForUser("user-one", current.id, { ...project("2026-07-19T08:00:02.000Z", "新标题"), ratio: "5000x5000" })).resolves.toMatchObject({ ratio: "5000x5000" });
    });

    it("keeps projects beyond the former collection and text thresholds", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "旧标题");
        mocks.getDramaProject.mockResolvedValue(current);
        const longDescription = "完整镜头说明".repeat(1_000);
        const shots = Array.from({ length: 501 }, (_, index) => ({
            id: `shot-${index}`,
            order: index + 1,
            title: `镜头 ${index}`,
            description: index === 500 ? longDescription : "描述",
            sourceText: "原文",
            duration: index === 500 ? 21 : 5,
            utterances: index === 500 ? Array.from({ length: 101 }, (__, utteranceIndex) => ({ id: `utterance-${utteranceIndex}`, order: utteranceIndex + 1, type: "dialogue", speaker: "角色", text: `台词 ${utteranceIndex}` })) : [],
            characterIds: Array.from({ length: 51 }, (__, relationIndex) => `character-${relationIndex}`),
            propIds: Array.from({ length: 51 }, (__, relationIndex) => `prop-${relationIndex}`),
            clueIds: Array.from({ length: 51 }, (__, relationIndex) => `clue-${relationIndex}`),
        }));
        const characters = Array.from({ length: 201 }, (_, index) => ({
            id: `character-${index}`,
            name: `角色 ${index}`,
            references: index === 200 ? Array.from({ length: 13 }, (__, referenceIndex) => ({ id: `reference-${referenceIndex}`, url: `/api/reference-assets/reference-${referenceIndex}.png`, source: "upload", label: `参考 ${referenceIndex}` })) : [],
        }));
        const episodes = Array.from({ length: 101 }, (_, index) => ({
            id: `episode-${index}`,
            title: `第 ${index + 1} 集`,
            script: "剧本",
            shots: index === 100 ? shots : [],
            visualReview:
                index === 100 ? { mode: "text", status: "needs_revision", summary: "需要调整", issues: Array.from({ length: 9 }, (__, issueIndex) => ({ category: `问题 ${issueIndex}`, severity: "low", message: `说明 ${issueIndex}` })) } : undefined,
        }));
        const input = {
            ...project("2026-07-19T08:00:02.000Z", "新标题"),
            activeEpisodeId: "episode-100",
            episodes,
            characters,
            scenes: Array.from({ length: 201 }, (_, index) => ({ id: `scene-${index}`, name: `场景 ${index}` })),
            props: Array.from({ length: 201 }, (_, index) => ({ id: `prop-${index}`, name: `道具 ${index}` })),
            clues: Array.from({ length: 201 }, (_, index) => ({ id: `clue-${index}`, name: `线索 ${index}` })),
            sourceAssets: Array.from({ length: 101 }, (_, index) => ({ id: `source-${index}`, type: "text", title: `素材 ${index}`, textContent: `内容 ${index}` })),
        };

        const saved = await updateDramaProjectForUser("user-one", current.id, input);

        expect(saved.episodes).toHaveLength(101);
        expect(saved.characters).toHaveLength(201);
        expect(saved.scenes).toHaveLength(201);
        expect(saved.props).toHaveLength(201);
        expect(saved.clues).toHaveLength(201);
        expect(saved.sourceAssets).toHaveLength(101);
        expect(saved.episodes[100].shots).toHaveLength(501);
        expect(saved.episodes[100].shots[500]).toMatchObject({ duration: 21, description: longDescription });
        expect(saved.episodes[100].shots[500].utterances).toHaveLength(101);
        expect(saved.episodes[100].shots[500].characterIds).toHaveLength(51);
        expect(saved.episodes[100].shots[500].propIds).toHaveLength(51);
        expect(saved.episodes[100].shots[500].clueIds).toHaveLength(51);
        expect(saved.episodes[100].visualReview?.issues).toHaveLength(9);
        expect(saved.characters[200].references).toHaveLength(13);
    });

    it("ignores oversized transient client fields before enforcing the persisted project limit", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "旧标题");
        mocks.getDramaProject.mockResolvedValue(current);
        const input = structuredClone(project("2026-07-19T08:00:02.000Z", "新标题"));
        input.episodes[0].shots = [{ ...input.episodes[0].shots[0], storyboardImageUrl: `data:image/png;base64,${"x".repeat(2 * 1024 * 1024)}` }] as never;

        await expect(updateDramaProjectForUser("user-one", current.id, input)).resolves.toMatchObject({ title: "新标题" });
        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ title: "新标题" }), current.updatedAt);
    });

    it("archives the new conversation when project creation fails", async () => {
        const error = new Error("write failed");
        mocks.createDramaProject.mockRejectedValue(error);

        await expect(createDramaProjectForUser("user-one", { title: "项目" })).rejects.toBe(error);

        expect(mocks.updateCreativeConversation).toHaveBeenCalledWith("conversation-new", "user-one", { status: "archived" });
    });

    it("reuses a handoff project without listing every project snapshot", async () => {
        const existing = { ...project("2026-07-19T08:00:02.000Z", "已存在项目"), sourceHandoffId: "handoff-one" };
        mocks.findDramaProjectBySourceHandoffId.mockResolvedValue(existing);

        await expect(createDramaProjectForUser("user-one", { title: "重复创建", sourceHandoffId: "handoff-one" })).resolves.toEqual(existing);

        expect(mocks.findDramaProjectBySourceHandoffId).toHaveBeenCalledWith("user-one", "handoff-one");
        expect(mocks.createCreativeConversation).not.toHaveBeenCalled();
        expect(mocks.createDramaProject).not.toHaveBeenCalled();
    });

    it("archives the linked conversation after deleting a project", async () => {
        mocks.getDramaProject.mockResolvedValue({ ...project("2026-07-19T08:00:02.000Z", "项目"), creativeConversationId: "conversation-one" });
        mocks.deleteDramaProject.mockResolvedValue(true);

        await deleteDramaProjectForUser("user-one", "drama-one");

        expect(mocks.updateCreativeConversation).toHaveBeenCalledWith("conversation-one", "user-one", { status: "archived" });
        expect(mocks.deleteUserLocalMediaAssets).toHaveBeenCalled();
    });

    it("deletes a project-owned drama conversation and returns the replacement project", async () => {
        mocks.getDramaProject.mockResolvedValue({ ...project("2026-07-19T08:00:02.000Z", "项目"), creativeConversationId: "conversation-one" });

        await expect(deleteDramaAgentConversationForUser("user-one", "drama-one", "conversation-one")).resolves.toMatchObject({ deleted: true, activeConversationId: "conversation-two" });

        expect(mocks.listAgentRuns).toHaveBeenCalledWith({ userId: "user-one", conversationId: "conversation-one", surface: "drama", statuses: ["planning", "running", "paused"], limit: 1 });
        expect(mocks.deleteDramaConversationAggregate).toHaveBeenCalledWith("user-one", "drama-one", "conversation-one", "conversation-two");
        expect(mocks.deleteUserLocalMediaAssets).toHaveBeenCalledWith("user-one", ["permanent/agent.png"]);
    });

    it("rejects deleting a running or unrelated drama conversation", async () => {
        mocks.getDramaProject.mockResolvedValue({ ...project("2026-07-19T08:00:02.000Z", "项目"), creativeConversationId: "conversation-one" });
        mocks.listAgentRuns.mockResolvedValueOnce([{ id: "run-one" }]);

        await expect(deleteDramaAgentConversationForUser("user-one", "drama-one", "conversation-one")).rejects.toMatchObject({ status: 409, message: "运行中的对话需先停止任务再删除" });
        mocks.getCreativeConversation.mockResolvedValueOnce({ id: "conversation-other", userId: "user-one", surface: "drama", source: "drama", projectId: "drama-other" });
        await expect(deleteDramaAgentConversationForUser("user-one", "drama-one", "conversation-other")).rejects.toMatchObject({ status: 409, message: "Agent 对话与当前短剧项目不匹配" });
        expect(mocks.deleteDramaConversationAggregate).not.toHaveBeenCalled();
    });

    it("restores an older snapshot after saving the current project", async () => {
        const current = project("2026-07-19T08:00:02.000Z", "当前版本");
        const legacySnapshot = {
            id: current.id,
            title: "历史版本",
            summary: "旧项目摘要",
            style: "旧画风",
            ratio: "9:16",
            status: "active",
            activeEpisodeId: "episode-one",
            characters: [],
            scenes: [],
            episodes: [{ id: "episode-one", title: "第 1 集", script: "旧剧本", shots: [] }],
            createdAt: current.createdAt,
            updatedAt: "2026-07-18T08:00:00.000Z",
        };
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.getDramaProjectVersion.mockResolvedValue({ id: "version-one", projectId: current.id, version: 1, reason: "初稿", createdAt: current.createdAt, snapshot: legacySnapshot });

        const restored = await restoreDramaProjectVersionForUser("user-one", current.id, "version-one");

        expect(mocks.createDramaProjectVersion).toHaveBeenCalledWith("user-one", current.id, "恢复前自动快照", current);
        expect(restored).toMatchObject({
            title: "历史版本",
            props: [],
            clues: [],
            defaultVideoMode: "storyboard",
            episodes: [{ id: "episode-one", sourceRange: "", reviewStatus: "draft" }],
        });
        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ title: "历史版本" }), current.updatedAt);
    });

    it("maps a concurrent persistence conflict to a user-readable 409", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "旧标题");
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.updateDramaProject.mockRejectedValueOnce(new DramaProjectStoreError("短剧项目已在其他页面更新，请刷新后重试", 409));

        await expect(updateDramaProjectForUser("user-one", current.id, project("2026-07-19T08:00:02.000Z", "新标题"))).rejects.toMatchObject({ status: 409, message: "短剧项目已在其他页面更新，请刷新后重试" });
    });

    it("does not replay an already-recorded visual failure before creating a new frame run", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        current.seriesBible = { version: "series-bible-v1", canonCharacters: [], immutableRules: [], relationshipState: "", worldRules: [], unresolvedThreads: [], visualMotifs: [], soundMotifs: [] };
        current.episodes[0].shots = [
            {
                id: "shot-one",
                order: 1,
                title: "镜头一",
                characterIds: [],
                propIds: [],
                clueIds: [],
                imagePrompt: "画面",
                videoPrompt: "动作",
                cameraMotion: "固定",
                duration: 5,
                storyboardFrameMode: "all_frames",
                storyboardStatus: "queued",
            },
        ] as never;
        const failedRun = {
            id: "run-failed",
            projectId: current.id,
            episodeId: current.episodes[0].id,
            planRevision: "old-revision",
            status: "needs_review",
            scope: "visual",
            mode: "strict",
            parameterSnapshot: { imageModel: "image-default", videoModel: "", ratio: "9:16" },
            steps: [{ id: "frame-shot-one-f1", type: "keyframe", shotId: "shot-one", frameId: "f1", sequenceIndex: 1, dependsOn: [], status: "failed", taskId: "task-failed", error: "参考素材暂时无法提交给当前生成渠道，请重新上传或稍后重试。" }],
            blockers: [],
            confirmedAt: "2026-07-19T08:00:00.000Z",
            createdAt: "2026-07-19T08:00:00.000Z",
            updatedAt: "2026-07-19T08:00:00.000Z",
        } as const;
        mocks.getDramaProject.mockResolvedValue(current);
        mocks.findLatestDramaProductionRun.mockResolvedValue(failedRun);
        mocks.updateDramaProject.mockRejectedValue(new DramaProjectStoreError("短剧项目已在其他页面更新，请刷新后重试", 409));

        await expect(createDramaProductionRunForUser("user-one", current.id, { episodeId: current.episodes[0].id, scope: "visual", shotIds: ["shot-one"], frameType: "all_frames", frameIds: ["frame-1"] })).resolves.toMatchObject({
            scope: "visual",
            status: "ready",
        });
        expect(mocks.updateDramaProject).not.toHaveBeenCalled();
        expect(mocks.createDramaProductionRun).toHaveBeenCalledOnce();
    });

    it("returns 404 before reading another user's version", async () => {
        mocks.getDramaProject.mockResolvedValue(null);

        await expect(restoreDramaProjectVersionForUser("user-two", "drama-one", "version-one")).rejects.toMatchObject({ status: 404 });

        expect(mocks.getDramaProjectVersion).not.toHaveBeenCalled();
        expect(mocks.createDramaProjectVersion).not.toHaveBeenCalled();
    });
});

describe("drama visual reference URL resolution", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("prefers a provider CDN URL over an ephemeral local mirror", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");
        vi.stubEnv("VOZEB_PRO_ENCRYPTION_KEY", "test-encryption-key-that-is-at-least-32-characters");
        expect(resolveDramaVisualReferenceUrl("/api/reference-assets/permanent/local.png", "http://localhost:3010", "https://cdn.example.com/remote.png")).toBe("https://cdn.example.com/remote.png");
    });

    it("compiles prompt aliases from the exact request reference order", () => {
        expect(compileDramaReferencePrompt("生成画面", [{ id: "continuity-0" }, { id: "asset-0" }, { id: "asset-1" }])).toContain("@图片1：上一帧连续性锚点\n@图片2：项目资产基准图\n@图片3：项目资产基准图");
    });

    it("describes the exact asset and continuity binding for every submitted image", () => {
        const prompt = compileDramaReferencePrompt("生成画面", [
            { id: "continuity-0", label: "上一镜「湖畔」已人工验收的实际尾帧", binding: "作为当前帧唯一动作起点" },
            { id: "asset-character-one", label: "角色固定资产「Karin」", binding: "锁定身份、脸部、发型和服装" },
            { id: "asset-scene-one", label: "场景固定资产「黑湖」", binding: "锁定空间拓扑、建筑结构和主光方向" },
        ]);

        expect(prompt).toContain("实际参考图绑定（编号与本次请求图片数组完全一致）");
        expect(prompt).toContain("@图片1：上一镜「湖畔」已人工验收的实际尾帧；绑定规则：作为当前帧唯一动作起点");
        expect(prompt).toContain("@图片2：角色固定资产「Karin」；绑定规则：锁定身份、脸部、发型和服装");
        expect(prompt).toContain("@图片3：场景固定资产「黑湖」；绑定规则：锁定空间拓扑、建筑结构和主光方向");
        expect(prompt).toContain("角色图不得替代场景");
    });

    it("rebases video references without retaining a legacy binding block", () => {
        const prompt = compileDramaVideoReferencePrompt("动态意图：Karin握紧断剑\n参考图顺序（与视频请求数组完全一致）：\n@图片1：旧顺序帧\n必须逐图按上述职责使用；顺序帧用于锁定对应时间段的可见状态，不能用固定资产图替代。", [
            { role: "keyframe", purpose: "顺序帧 1（开始）" },
        ]);

        expect(prompt.match(/实际参考图绑定（编号与本次请求图片数组完全一致）/gu)).toHaveLength(1);
        expect(prompt).not.toContain("参考图顺序（与视频请求数组完全一致）");
        expect(prompt).toContain("@图片1：顺序帧 1（开始）");
    });

    it("removes stale video reference instructions when no images are submitted", () => {
        const prompt = compileDramaVideoReferencePrompt("动态意图：Karin停住\n实际参考图绑定（编号与本次请求图片数组完全一致）：\n@图片1：旧图片", []);

        expect(prompt).toBe("动态意图：Karin停住");
    });

    it("preserves the local mirror when a provider CDN URL is available", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");
        expect(createDramaVisualImageReference("asset-one", "/api/reference-assets/permanent/local.png", "http://localhost:3010", "https://cdn.example.com/remote.png")).toEqual({
            id: "asset-one",
            type: "image",
            dataUrl: "/api/reference-assets/permanent/local.png",
            url: "/api/reference-assets/permanent/local.png",
            serverUrl: "/api/reference-assets/permanent/local.png",
            remoteUrl: "https://cdn.example.com/remote.png",
        });
    });

    it("does not submit local-only references from a localhost deployment", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3010");
        expect(resolveDramaVisualReferenceUrl("/api/reference-assets/permanent/local.png", "http://localhost:3010")).toBe("");
    });

    it("signs local references when an external site origin is configured", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");
        vi.stubEnv("VOZEB_PRO_ENCRYPTION_KEY", "test-encryption-key-that-is-at-least-32-characters");
        expect(resolveDramaVisualReferenceUrl("/api/reference-assets/permanent/local.png", "http://localhost:3010")).toContain("https://app.example.com/api/reference-assets/permanent/local.png?");
    });

    it("re-signs an absolute local URL instead of reusing an expired signature", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");
        vi.stubEnv("VOZEB_PRO_ENCRYPTION_KEY", "test-encryption-key-that-is-at-least-32-characters");
        const value = resolveDramaVisualReferenceUrl("https://old.example.com/api/reference-assets/permanent/local.png?purpose=provider-read&expires=1&signature=expired", "http://localhost:3010");
        expect(value).toContain("https://app.example.com/api/reference-assets/permanent/local.png?");
        expect(value).not.toContain("signature=expired");
    });
});

function project(updatedAt: string, title: string): DramaProject {
    return {
        id: "drama-one",
        title,
        summary: "",
        style: DRAMA_STYLE_NAME,
        ratio: "9:16",
        status: "active",
        activeEpisodeId: "episode-one",
        productionBible: { language: "中文", ratio: "9:16", visualStyle: DRAMA_STYLE_NAME, colorScript: "暮色金紫主调", soundBible: "", globalNegativePrompt: "", subtitleSafeArea: "", continuityMode: "strict" },
        characters: [],
        scenes: [],
        props: [],
        clues: [],
        defaultVideoMode: "storyboard",
        episodes: [{ id: "episode-one", title: "第 1 集", script: "", outline: "", hook: "", nextPreview: "", sourceRange: "", reviewStatus: "draft", shots: [] }],
        createdAt: "2026-07-19T08:00:00.000Z",
        updatedAt,
    };
}
