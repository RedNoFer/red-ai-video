import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { DramaProject } from "@/lib/drama-project-contract";
import { initializePostgresSchema, postgresQuery } from "@/lib/server/database";
import { createDramaProject, getDramaProject, updateDramaProjectAssetMutation, updateDramaProjectRatioMutation, updateDramaProjectScopedMutation, updateDramaProjectShotMutation } from "./drama-project-store";
import { applyDramaProductionPackageForUser, getDramaProjectForUser, previewDramaProductionPackageForUser, updateDramaShotPromptPatchForUser, updateDramaVideoPromptPrefixForUser, updateDramaProductionRunForUser } from "./drama-project-service";
import { createDramaProductionRun, getDramaProductionRun } from "./drama-production-run-store";
import { createStoredGenerationTask } from "./generation-task-store";
import { GENERATION_TASK_RETENTION_MS } from "./generation-task-retention";
import type { DramaProductionRun } from "@/lib/drama-project-contract";

const postgresDescribe = process.env.VOZEB_PRO_RUN_POSTGRES_INTEGRATION === "1" ? describe : describe.skip;

postgresDescribe("drama project PostgreSQL mutation round-trip", () => {
    beforeAll(() => initializePostgresSchema());

    it("synchronizes terminal tasks in different runs through trigger-backed scoped writes and preserves a newer attempt", async () => {
        const userId = `drama-video-sync-${randomUUID()}`;
        const now = new Date().toISOString();
        const project = {
            id: `drama-${randomUUID()}`,
            title: "视频状态同步",
            ratio: "16:9",
            status: "active",
            characters: [],
            scenes: [],
            props: [],
            clues: [],
            episodes: [{ id: "episode", shots: [] }],
            createdAt: now,
            updatedAt: now,
        } as unknown as DramaProject;
        const taskIds: string[] = [];
        await postgresQuery("INSERT INTO users (id, username, display_name, password_hash) VALUES ($1, $1, '视频同步', 'test-only')", [userId]);
        try {
            for (const status of ["error", "success"] as const) {
                const runId = `run-${randomUUID()}`;
                const taskId = randomUUID();
                taskIds.push(taskId);
                project.episodes[0].shots.push({ id: status, title: status, generationStatus: "running", generationRunId: runId, generationTaskId: taskId } as never);
                await createStoredGenerationTask(
                    "video",
                    {
                        id: taskId,
                        userId,
                        status,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        config: { model: "test-video" },
                        upstream: { id: `provider-${taskId}` },
                        error: status === "error" ? "上游明确失败" : undefined,
                        result: status === "success" ? { url: "/recovered.mp4" } : undefined,
                    },
                    GENERATION_TASK_RETENTION_MS,
                );
            }
            await createDramaProject(userId, project);
            const original = await getDramaProject(project.id, userId);
            for (const shot of project.episodes[0].shots) {
                const run = {
                    id: shot.generationRunId!,
                    projectId: project.id,
                    episodeId: "episode",
                    planRevision: shot.id,
                    status: "running",
                    mode: "strict",
                    parameterSnapshot: { imageModel: "", videoModel: "test-video", ratio: "16:9" },
                    steps: [
                        { id: `video-${shot.id}`, type: "video", shotId: shot.id, status: "running", taskId: shot.generationTaskId, dependsOn: [] },
                        { id: `extract-${shot.id}`, type: "extract_frames", shotId: shot.id, status: "blocked", dependsOn: [`video-${shot.id}`] },
                    ],
                    confirmedAt: now,
                    createdAt: now,
                    updatedAt: now,
                } as DramaProductionRun;
                await createDramaProductionRun(userId, run);
                const synced = await updateDramaProductionRunForUser(userId, project.id, run.id, { action: "sync" });
                const read = await getDramaProject(project.id, userId);
                expect(synced).toHaveProperty("projectUpdatedAt", read?.updatedAt);
                expect(read?.episodes[0].shots.find((item) => item.id === shot.id)).toMatchObject({
                    generationStatus: shot.id,
                    generationTaskId: shot.generationTaskId,
                    ...(shot.id === "success" ? { videoUrl: "/recovered.mp4" } : { generationError: "上游明确失败" }),
                });
                expect((await getDramaProductionRun(userId, project.id, run.id))?.steps[0].status).toBe(shot.id === "error" ? "failed" : "success");
            }
            const read = (await getDramaProject(project.id, userId))!;
            expect(read.title).toBe(original?.title);
            expect(read.ratio).toBe(original?.ratio);
            const first = read.episodes[0].shots[0];
            await updateDramaProjectShotMutation(userId, {
                projectId: project.id,
                episodeId: "episode",
                shotId: first.id,
                shot: { ...first, generationRunId: "newer-run", generationTaskId: "newer-task", generationStatus: "running" },
                expectedUpdatedAt: read.updatedAt,
            });
            await updateDramaProductionRunForUser(userId, project.id, first.generationRunId!, { action: "sync" });
            expect((await getDramaProject(project.id, userId))?.episodes[0].shots[0]).toMatchObject({ generationRunId: "newer-run", generationTaskId: "newer-task", generationStatus: "running" });
        } finally {
            await postgresQuery("DELETE FROM generation_tasks WHERE user_id = $1 AND id = ANY($2::text[])", [userId, taskIds]);
            await postgresQuery("DELETE FROM users WHERE id = $1", [userId]);
        }
    });

    it("round-trips prompt reference preferences and an empty selection through consecutive trigger-backed saves", async () => {
        const userId = `drama-reference-${randomUUID()}`;
        const now = new Date().toISOString();
        const project = {
            id: `drama-${randomUUID()}`,
            title: "引用保存",
            ratio: "16:9",
            status: "active",
            characters: [],
            scenes: [],
            clues: [],
            createdAt: now,
            updatedAt: now,
            props: ["box", "phone"].map((id) => ({ id, name: id, description: id, primaryReferenceId: `${id}-ref`, references: [{ id: `${id}-ref`, url: `/${id}.png`, status: "approved", source: "library", label: id, createdAt: now }] })),
            episodes: [{ id: "episode", shots: [{ id: "shot", title: "桌面", duration: 15, videoPrompt: "桌上的铁盒保持打开。", characterIds: [], propIds: ["box", "phone"], clueIds: [], utterances: [] }] }],
        } as unknown as DramaProject;
        await postgresQuery("INSERT INTO users (id, username, display_name, password_hash) VALUES ($1, $1, '引用保存', 'test-only')", [userId]);
        try {
            await createDramaProject(userId, project);
            const prefix = await updateDramaVideoPromptPrefixForUser(userId, project.id, { action: "save", text: "声明：虚构人物。", expectedUpdatedAt: project.updatedAt });
            const withPrefix = await getDramaProject(project.id, userId);
            expect(withPrefix?.videoPromptPrefix).toEqual({ text: "声明：虚构人物。", previousText: "" });
            expect(withPrefix?.updatedAt).toBe(prefix.updatedAt);
            const saved = await updateDramaShotPromptPatchForUser(userId, project.id, "episode", "shot", { executionVideoPrompt: "声明：虚构人物。\n\n作者修改：铁盒保持打开。", videoReferenceIds: ["box"], videoReferenceMode: "reference" });
            const read = await getDramaProjectForUser(userId, project.id);
            expect(saved.updatedAt).toBe(read.updatedAt);
            expect(read.episodes[0].shots[0]).toMatchObject({ executionVideoPrompt: saved.shot.executionVideoPrompt, videoReferenceIds: ["box"], videoReferenceMode: "reference" });
            expect(saved.shot.executionVideoPrompt).toContain("@图片1：道具「box」");
            const empty = await updateDramaShotPromptPatchForUser(userId, project.id, "episode", "shot", { videoReferenceIds: [], videoReferenceMode: "reference" });
            const reloaded = await getDramaProjectForUser(userId, project.id);
            expect(empty.updatedAt).toBe(reloaded.updatedAt);
            expect(reloaded.episodes[0].shots[0].videoReferenceIds).toEqual([]);
            expect(reloaded.episodes[0].shots[0].executionVideoPrompt).toBe("作者修改：铁盒保持打开。");
            const undo = await updateDramaVideoPromptPrefixForUser(userId, project.id, { action: "undo", expectedUpdatedAt: reloaded.updatedAt });
            const restored = await getDramaProject(project.id, userId);
            expect(restored?.updatedAt).toBe(undo.updatedAt);
            expect(restored?.videoPromptPrefix).toEqual({ text: "" });
            expect(restored?.episodes[0].shots[0]).toMatchObject({ executionVideoPrompt: "作者修改：铁盒保持打开。", videoReferenceIds: [] });
            await expect(updateDramaProjectShotMutation(userId, { projectId: project.id, episodeId: "episode", shotId: "shot", shot: saved.shot, expectedUpdatedAt: saved.updatedAt })).rejects.toMatchObject({ status: 409 });
        } finally {
            await postgresQuery("DELETE FROM users WHERE id = $1", [userId]);
        }
    });

    it("preserves external author prose through import, consecutive trigger-backed saves and fresh reads", async () => {
        const userId = `drama-regression-${randomUUID()}`;
        const now = new Date().toISOString();
        const current = { id: `drama-${randomUUID()}`, title: "原稿回读", ratio: "9:16", status: "active", characters: [], scenes: [], props: [], clues: [], episodes: [], createdAt: now, updatedAt: now } as unknown as DramaProject;
        const source = readFileSync(new URL("../../../../docs/drama-production-package-v1-field-example.json", import.meta.url), "utf8");
        const authored = JSON.parse(source).episodes[0].shots[0];
        const timbrePrompt = JSON.parse(source).assets.characters[0].voiceProfile.timbrePrompt;
        await postgresQuery("INSERT INTO users (id, username, display_name, password_hash) VALUES ($1, $1, '原稿回读', 'test-only')", [userId]);
        try {
            await createDramaProject(userId, current);
            const preview = previewDramaProductionPackageForUser({ source, fileName: "example.json" }, {}, current);
            const imported = await applyDramaProductionPackageForUser(userId, current.id, { source, fileName: "example.json", sourceHash: preview.sourceHash });
            expect(imported.updatedAt).toBe((await getDramaProjectForUser(userId, current.id)).updatedAt);
            expect(imported.characters[0].voiceProfile?.timbrePrompt).toBe(timbrePrompt);
            const shot = imported.episodes[0].shots[0];
            const saved = await updateDramaProjectShotMutation(userId, { projectId: current.id, episodeId: imported.episodes[0].id, shotId: shot.id, shot: { ...shot, title: "人工标题" }, expectedUpdatedAt: imported.updatedAt });
            const persisted = await getDramaProjectForUser(userId, current.id);
            expect(saved.updatedAt).toBe(persisted.updatedAt);
            expect(persisted.episodes[0].shots[0]).toMatchObject({ videoPrompt: authored.videoPrompt, dialogue: authored.dialogue, framePlan: { frames: authored.framePlan.frames } });
            expect(persisted.episodes[0].shots[0].utterances[0].text).toBe("外套颜色没变，别说话。");
            expect(persisted.characters[0].voiceProfile?.timbrePrompt).toBe(timbrePrompt);
            await expect(updateDramaProjectShotMutation(userId, { projectId: current.id, episodeId: imported.episodes[0].id, shotId: shot.id, shot, expectedUpdatedAt: imported.updatedAt })).rejects.toMatchObject({ status: 409 });
            const storedShot = persisted.episodes[0].shots[0];
            await updateDramaProjectShotMutation(userId, {
                projectId: current.id,
                episodeId: persisted.episodes[0].id,
                shotId: storedShot.id,
                shot: { ...storedShot, storyboardStatus: "success", storyboardImageUrl: "/fixture/retained.png", storyboardFrames: [{ id: "F01", sequenceIndex: 1, source: "generated", status: "success", mediaUrl: "/fixture/frame.png" }] },
                expectedUpdatedAt: persisted.updatedAt,
            });
            const beforeRevision = await getDramaProjectForUser(userId, current.id);
            const changed = JSON.parse(source);
            changed.episodes[0].shots[0].framePlan.frames[0].imagePrompt += "\n袖口材质修订。";
            const nextSource = JSON.stringify(changed);
            const nextPreview = previewDramaProductionPackageForUser({ source: nextSource, fileName: "example.json" }, {}, beforeRevision);
            const revision = await applyDramaProductionPackageForUser(userId, current.id, { source: nextSource, fileName: "example.json", sourceHash: nextPreview.sourceHash });
            const refreshed = await getDramaProjectForUser(userId, current.id);
            expect(revision.updatedAt).toBe(refreshed.updatedAt);
            expect(refreshed.episodes[0].shots[0]).toMatchObject({ id: storedShot.id, storyboardStatus: "stale", storyboardImageUrl: "/fixture/retained.png", storyboardFrames: [{ id: "F01", mediaUrl: "/fixture/frame.png", status: "stale" }] });
        } finally {
            await postgresQuery("DELETE FROM users WHERE id = $1", [userId]);
        }
    });

    it("uses the exact persisted JSON version across consecutive shot and asset saves with the real trigger", async () => {
        const userId = `drama-regression-${randomUUID()}`;
        const now = new Date().toISOString();
        const project = {
            id: `drama-${randomUUID()}`,
            title: "版本回归",
            status: "active",
            createdAt: now,
            updatedAt: now,
            characters: [{ id: "character-one", name: "主角", description: "旧设定" }],
            ratio: "9:16",
            productionBible: { ratio: "9:16", productionPlan: { video: { ratio: "9:16" } } },
            episodes: [{ id: "episode-one", shots: [{ id: "shot-one", title: "旧镜头" }] }],
        } as DramaProject;
        await postgresQuery("INSERT INTO users (id, username, display_name, password_hash) VALUES ($1, $1, '版本回归', 'test-only')", [userId]);
        try {
            await createDramaProject(userId, project);
            const shot = await updateDramaProjectShotMutation(userId, { projectId: project.id, episodeId: "episode-one", shotId: "shot-one", shot: { ...project.episodes[0].shots[0], title: "新镜头" }, expectedUpdatedAt: project.updatedAt });
            expect(shot.updatedAt).toBe((await getDramaProject(project.id, userId))?.updatedAt);
            const asset = await updateDramaProjectAssetMutation(userId, { projectId: project.id, assetKind: "characters", assetId: "character-one", asset: { ...project.characters[0], description: "新设定" }, expectedUpdatedAt: shot.updatedAt });
            expect(asset.updatedAt).toBe((await getDramaProject(project.id, userId))?.updatedAt);
            const ratio = await updateDramaProjectRatioMutation(userId, { projectId: project.id, ratio: "16:9", expectedUpdatedAt: asset.updatedAt });
            const persisted = await getDramaProject(project.id, userId);
            expect(ratio.updatedAt).toBe(persisted?.updatedAt);
            expect(persisted).toMatchObject({ ratio: "16:9", productionBible: { ratio: "16:9", productionPlan: { video: { ratio: "16:9" } } } });
            await expect(updateDramaProjectRatioMutation(userId, { projectId: project.id, ratio: "9:16", expectedUpdatedAt: asset.updatedAt })).rejects.toMatchObject({ status: 409 });
            await expect(updateDramaProjectAssetMutation(userId, { projectId: project.id, assetKind: "characters", assetId: "character-one", asset: project.characters[0], expectedUpdatedAt: now })).rejects.toMatchObject({ status: 409 });
            expect((await getDramaProject(project.id, userId))?.characters[0].description).toBe("新设定");
        } finally {
            await postgresQuery("DELETE FROM users WHERE id = $1", [userId]);
        }
    });

    it("saves sparse project and shot edits while preserving the archive and rejecting stale versions", async () => {
        const userId = `drama-regression-${randomUUID()}`;
        const now = new Date().toISOString();
        const project = {
            id: `drama-${randomUUID()}`,
            title: "局部保存回归",
            status: "active",
            createdAt: now,
            updatedAt: now,
            productionArchive: { sections: [{ content: "x".repeat(100_000) }] },
            episodes: [{ id: "episode-one", shots: [{ id: "shot-one", title: "旧镜头", videoPrompt: "旧提示词" }] }],
        } as DramaProject;
        await postgresQuery("INSERT INTO users (id, username, display_name, password_hash) VALUES ($1, $1, '局部保存回归', 'test-only')", [userId]);
        try {
            await createDramaProject(userId, project);
            const next = structuredClone(project);
            next.title = "新标题";
            next.episodes[0].shots[0].title = "新镜头";
            next.updatedAt = new Date(Date.parse(now) + 1000).toISOString();
            const mutation = {
                projectId: project.id,
                expectedUpdatedAt: now,
                updatedAt: next.updatedAt,
                projectPatch: { title: next.title },
                episodes: { patch: [{ id: "episode-one", fields: {}, shots: { patch: [{ id: "shot-one", fields: { title: "新镜头" } }] } }] },
            };
            const saved = await updateDramaProjectScopedMutation(userId, project, next, mutation);
            const persisted = await getDramaProject(project.id, userId);
            expect(saved.updatedAt).toBe(persisted?.updatedAt);
            expect(persisted).toMatchObject({ title: "新标题", episodes: [{ shots: [{ title: "新镜头", videoPrompt: "旧提示词" }] }], productionArchive: project.productionArchive });
            await expect(updateDramaProjectScopedMutation(userId, project, next, mutation)).rejects.toMatchObject({ status: 409 });
        } finally {
            await postgresQuery("DELETE FROM users WHERE id = $1", [userId]);
        }
    });
});
