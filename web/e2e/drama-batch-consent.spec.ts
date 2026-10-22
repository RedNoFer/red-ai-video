import path from "node:path";

import { expect, test } from "@playwright/test";

import type { DramaProductionRun, DramaProject, DramaShot } from "../src/lib/drama-project-contract";
import { readJsonDataFile, withJsonDataFileLock, writeJsonDataFile } from "../src/lib/server/data-adapter";
import { saveDramaProjectFixture } from "./support";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("批量生成视频里待确认镜头只需勾选一次，并支持全部勾选与全部取消", async ({ page, request }) => {
    process.env.VOZEB_PRO_DATA_DIR = path.resolve(process.cwd(), ".e2e-data");
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 批量确认一次 ${Date.now()}`, ratio: "16:9" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const episode = project.episodes[0];
    const user = (await (await request.get("/api/auth/session")).json()).user as { id: string };
    const now = Date.now();
    const shots = [0, 1].map((index): DramaShot => ({
        id: `${project.id}-pending-shot-${index}`,
        order: index + 1,
        title: `待确认镜头${index + 1}`,
        description: "人物在室内抬头",
        sourceText: "人物在室内抬头",
        shotBoundary: "",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: "",
        videoPrompt: "人物在室内抬头，听到门外声响后站定。",
        cameraMotion: "固定",
        duration: 5,
        characterIds: [],
        propIds: [],
        clueIds: [],
        generationStatus: "running",
        generationRunId: `${project.id}-pending-run-${index}`,
        generationTaskId: `${project.id}-pending-task-${index}`,
    }));
    const runs = shots.map((shot, index): DramaProductionRun => ({
        id: shot.generationRunId!,
        projectId: project.id,
        episodeId: episode.id,
        planRevision: shot.id,
        status: "running",
        mode: "strict",
        parameterSnapshot: { imageModel: "e2e-image", videoModel: "e2e-video", ratio: "16:9" },
        steps: [{ id: `video-${shot.id}`, shotId: shot.id, type: "video", dependsOn: [], status: "running", taskId: shot.generationTaskId, duration: 5 }],
        confirmedAt: new Date(now).toISOString(),
        createdAt: new Date(now + index).toISOString(),
        updatedAt: new Date(now + index).toISOString(),
    }));

    try {
        await withJsonDataFileLock("generation-tasks.json", async () => {
            const existing = await readJsonDataFile<unknown[]>("generation-tasks.json", []);
            await writeJsonDataFile("generation-tasks.json", [
                ...existing,
                ...shots.map((shot) => ({
                    id: shot.generationTaskId,
                    type: "video",
                    userId: user.id,
                    status: "running",
                    expiresAt: now + 86_400_000,
                    createdAt: now,
                    updatedAt: now,
                    executionPhase: "needs_review",
                    lastUpstreamStatus: "submission_outcome_unknown",
                    payload: {
                        id: shot.generationTaskId,
                        userId: user.id,
                        status: "running",
                        createdAt: now,
                        updatedAt: now,
                        projectId: project.id,
                        episodeId: episode.id,
                        shotId: shot.id,
                        surface: "drama",
                        config: { model: "e2e-video" },
                        upstream: { id: "", provider: "openai", model: "e2e-video" },
                        attempts: [{ attemptNo: 1, status: "failed", error: "提交结果未知" }],
                    },
                })),
            ]);
        });
        await withJsonDataFileLock("drama-production-runs.json", async () => {
            const existing = await readJsonDataFile<{ version: number; items: unknown[] }>("drama-production-runs.json", { version: 1, items: [] });
            await writeJsonDataFile("drama-production-runs.json", { ...existing, items: [...existing.items, ...runs.map((run) => ({ ...run, userId: user.id }))] });
        });
        const saved = await saveDramaProjectFixture(request, project, { ...project, activeEpisodeId: episode.id, episodes: [{ ...episode, reviewStatus: "visual_ready", shots }] });
        expect(saved.ok(), await saved.text()).toBe(true);

        await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "切换到镜头生成" }).click();
        const readProject = async () => ((await (await request.get(`/api/drama/projects/${project.id}`)).json()) as { data: { project: DramaProject } }).data.project;
        await expect.poll(async () => (await readProject()).episodes[0].shots.map((shot) => shot.generationStatus)).toEqual(["needs_review", "needs_review"]);

        await page.getByRole("button", { name: "批量生成视频", exact: true }).click();
        const batch = page.getByRole("dialog", { name: "批量生成视频" });
        await expect(batch).toBeVisible();
        const consent = batch.locator("[data-drama-batch-consent]");
        await expect(consent).toBeVisible({ timeout: 15_000 });
        await expect(consent.getByText("已确认 0 / 2")).toBeVisible();
        const rowConsents = batch.getByRole("checkbox", { name: "我已核对原提交，仍要发起新任务并承担可能的重复计费" });
        await expect(rowConsents).toHaveCount(2);
        await expect(rowConsents.first()).not.toBeChecked();

        // 勾选一次即对全部待确认镜头生效
        await batch.getByRole("checkbox", { name: /全部确认原提交并承担可能的重复计费/ }).check();
        await expect(consent.getByText("已确认 2 / 2")).toBeVisible();
        await expect(rowConsents.first()).toBeChecked();
        await expect(rowConsents.last()).toBeChecked();

        // 全部取消勾选后逐镜恢复未确认
        await batch.getByRole("button", { name: "全部取消勾选" }).click();
        await expect(consent.getByText("已确认 0 / 2")).toBeVisible();
        await expect(rowConsents.first()).not.toBeChecked();
        await expect(rowConsents.last()).not.toBeChecked();

        await batch.getByRole("button", { name: "全部勾选" }).click();
        await expect(consent.getByText("已确认 2 / 2")).toBeVisible();
        await expect(rowConsents.first()).toBeChecked();
        await expect(rowConsents.last()).toBeChecked();
    } finally {
        const deleted = await request.delete(`/api/drama/projects/${project.id}`);
        expect(deleted.ok(), await deleted.text()).toBe(true);
    }
});
