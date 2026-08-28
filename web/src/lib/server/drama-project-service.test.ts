import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DramaProject } from "@/lib/drama-project-contract";
import { createFrameEvidence } from "@/lib/drama-continuity-policy";
import { DRAMA_STYLE_NAME } from "@/lib/drama-style";

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
        queryStoredGenerationTasks: vi.fn(),
        createDramaProjectVersion: vi.fn(),
        getDramaProjectVersion: vi.fn(),
        listDramaProjectVersions: vi.fn(),
        deleteUserLocalMediaAssets: vi.fn(),
    };
});

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
vi.mock("@/lib/server/generation-task-store", () => ({ getStoredGenerationTask: mocks.getStoredGenerationTask, queryStoredGenerationTasks: mocks.queryStoredGenerationTasks }));
vi.mock("@/lib/server/local-media-storage", () => ({ deleteUserLocalMediaAssets: mocks.deleteUserLocalMediaAssets }));

import {
    createDramaProjectForUser,
    applyDramaVisualStepResult,
    applyDramaVisualStepFailure,
    compileDramaReferencePrompt,
    createDramaVisualImageReference,
    deleteDramaAgentConversationForUser,
    deleteDramaProjectForUser,
    decideDramaContinuityFrameForUser,
    DramaProjectServiceError,
    getDramaProjectForUser,
    getDramaProductionPreflightForUser,
    normalizeProject,
    recoverInvalidDramaEpisodes,
    recoverStaleDramaBoundaryFrames,
    resolveDramaVisualReferenceUrl,
    restoreDramaProjectVersionForUser,
    updateDramaProjectForUser,
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
        mocks.queryStoredGenerationTasks.mockResolvedValue([]);
        mocks.deleteDramaConversationAggregate.mockResolvedValue({ deletedConversations: 1, mediaStorageKeys: ["permanent/agent.png"], dramaProject: { ...project("2026-07-19T08:00:03.000Z", "项目"), creativeConversationId: "conversation-two" } });
        mocks.findDramaProjectBySourceHandoffId.mockResolvedValue(null);
        mocks.listDramaProjectSummaries.mockResolvedValue([]);
        mocks.createDramaProjectVersion.mockResolvedValue({ id: "version-new", projectId: "drama-one", version: 2, reason: "恢复前自动快照", createdAt: new Date().toISOString() });
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
            episodes: [{
                ...current.episodes[0],
                shots: [{ id: "shot-one", title: "镜头", videoMode: "reference", imagePrompt: "画面", videoPrompt: "动作", characterIds: [], propIds: [], clueIds: [], duration: 5 }],
            }],
        } as unknown as DramaProject;

        const normalized = normalizeProject(legacy, current);

        expect(normalized.defaultVideoMode).toBe("storyboard");
        expect(normalized.productionBible?.productionPlan?.video.mode).toBe("storyboard");
        expect(normalized.episodes[0].shots[0].videoMode).toBe("storyboard");
    });

    it("keeps every generated storyboard result while retaining the first as the main frame", () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [{ id: "shot-one", title: "镜头", storyboardStatus: "running", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 5 } as never];
        const updated = applyDramaVisualStepResult(current, "episode-one", { id: "start-shot-one", type: "start_frame", shotId: "shot-one", dependsOn: [], status: "running" }, [
            { url: "/api/generation-log-assets/one.png", width: 640, height: 960 },
            { url: "/api/generation-log-assets/two.png", width: 640, height: 960 },
        ]);

        expect(updated.episodes[0].shots[0]).toMatchObject({ storyboardImageUrl: "/api/generation-log-assets/one.png", storyboardImageUrls: ["/api/generation-log-assets/one.png", "/api/generation-log-assets/two.png"] });
    });

    it("stores a generated frame against the package frame id and its stable input hash", () => {
        const current = project("2026-07-19T08:00:00.000Z", "项目");
        current.episodes[0].shots = [{ id: "shot-one", title: "镜头", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 5, storyboardFrameMode: "all_frames", storyboardFrames: [] } as never];
        const updated = applyDramaVisualStepResult(
            current,
            "episode-one",
            { id: "frame-shot-one-f1", frameId: "f1", inputHash: "stable-hash", type: "keyframe", sequenceIndex: 1, shotId: "shot-one", dependsOn: [], status: "running", taskId: "task-one" },
            [{ url: "/api/generation-log-assets/f1.png", remoteUrl: "https://cdn.example/f1.png", width: 640, height: 960 }],
        );
        expect(updated.episodes[0].shots[0].storyboardFrames).toEqual([
            expect.objectContaining({ id: "f1", sequenceIndex: 1, inputHash: "stable-hash", continuityStatus: "pending", mediaUrl: "/api/generation-log-assets/f1.png", remoteUrl: "https://cdn.example/f1.png" }),
        ]);
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
        current.episodes[0].shots = [{ id: "shot-one", title: "镜头", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 5, storyboardStatus: "running", storyboardTaskId: "task-one", frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/pending.png", generationTaskId: "task-one", validity: "candidate" })] }] as never;

        const updated = applyDramaVisualStepFailure(current, "episode-one", { id: "start-shot-one", type: "start_frame", shotId: "shot-one", taskId: "task-one", dependsOn: [], status: "running" }, "上游服务暂时不可用");

        expect(updated.episodes[0].shots[0]).toMatchObject({ storyboardStatus: "error", storyboardTaskId: "task-one", storyboardError: "上游服务暂时不可用" });
        expect(updated.episodes[0].shots[0].frameEvidence?.[0]).toMatchObject({ validity: "unavailable", invalidReason: "上游服务暂时不可用" });
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
        current.episodes[0].shots = [{ id: "shot-one", title: "镜头", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 5, storyboardStatus: "success", storyboardImageUrl: "/api/start.png", storyboardImageUrls: ["/api/start.png"], frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/start.png", validity: "candidate" })] }] as never;
        const input = structuredClone(current);
        input.updatedAt = "2026-07-19T08:00:02.000Z";
        delete input.episodes[0].shots[0].frameEvidence;
        input.title = "其他字段已更新";
        mocks.getDramaProject.mockResolvedValue(current);

        const saved = await updateDramaProjectForUser("user-one", current.id, input);

        expect(saved.episodes[0].shots[0]).toMatchObject({ storyboardStatus: "success", storyboardImageUrl: "/api/start.png", frameEvidence: [expect.objectContaining({ role: "storyboard_start", mediaUrl: "/api/start.png", validity: "candidate" })] });
    });

    it("accepts only the current video tail and rejects it by blocking downstream evidence", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "项目");
        const tail = createFrameEvidence({ role: "actual_end", source: "video_extraction", mediaUrl: "/api/reference-assets/tail.png", sourceVideoUrl: "/api/reference-assets/shot-one.mp4", validity: "candidate" });
        current.episodes[0].shots = [
            { id: "shot-one", title: "第一镜", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 5, videoUrl: "/api/reference-assets/shot-one.mp4", frameEvidence: [tail] },
            { id: "shot-two", title: "第二镜", characterIds: [], propIds: [], clueIds: [], imagePrompt: "画面", videoPrompt: "动作", cameraMotion: "固定", duration: 5, framePlan: { start: { source: "previous_accepted_actual_tail" }, end: { required: true } }, frameEvidence: [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/reference-assets/old.png", validity: "candidate" })] },
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

    it("upgrades a legacy project style before the next generation request", async () => {
        const current = project("2026-07-19T08:00:01.000Z", "Mahadel");
        current.style = "VS14 中世纪史诗的学院奇幻变体；宏大空间与克制人物近景并重";
        current.productionBible = { ...current.productionBible!, visualStyle: current.style, colorScript: "深蓝灰、旧银、墨绿、少量暖金" };
        mocks.getDramaProject.mockResolvedValue(current);

        const recovered = await getDramaProjectForUser("user-one", current.id);

        expect(recovered).toMatchObject({ style: DRAMA_STYLE_NAME, productionBible: { visualStyle: DRAMA_STYLE_NAME } });
        expect(mocks.updateDramaProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ style: DRAMA_STYLE_NAME, productionBible: expect.objectContaining({ visualStyle: DRAMA_STYLE_NAME }) }), current.updatedAt);
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
