import path from "node:path";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { DramaProductionRun, DramaProject, DramaShot } from "../src/lib/drama-project-contract";
import { readJsonDataFile, withJsonDataFileLock, writeJsonDataFile } from "../src/lib/server/data-adapter";
import { expectNoHorizontalOverflow } from "./responsive-helpers";
import { e2eSettingsPatch, pollTask, protocolFixtureState, resetProtocolFixture, saveDramaProjectFixture } from "./support";

test("镜头跨计划同步终态、刷新恢复并允许再次生成，未知提交继续待确认", async ({ page, request }) => {
    test.skip(Boolean(process.env.VOZEB_PRO_E2E_DATABASE_URL), "文件夹具由独立 PostgreSQL 集成测试补充");
    process.env.VOZEB_PRO_DATA_DIR = path.resolve(process.cwd(), ".e2e-data");
    expect((await request.patch("/api/admin/settings", { data: e2eSettingsPatch() })).ok()).toBe(true);
    await resetProtocolFixture(request);
    const credentials = { username: `video_sync_${Date.now()}`, password: "E2e_Video_Sync_2026!" };
    const provisioned = await request.post("/api/admin/users", { data: { ...credentials, displayName: "视频状态回归", role: "admin", adminPermissions: ["users.read"], status: "active", pointsBalance: 0 } });
    expect(provisioned.ok(), await provisioned.text()).toBe(true);
    expect((await request.post("/api/auth/login", { data: credentials })).ok()).toBe(true);
    await page.context().clearCookies();
    await page.context().addCookies((await request.storageState()).cookies);
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 跨生产计划同步", ratio: "16:9" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const user = (await (await request.get("/api/auth/session")).json()).user;
    const episode = project.episodes[0];
    const now = Date.now();
    const shots = ["error", "success", "needs_review"].map((status, index): DramaShot => ({
        id: `${project.id}-shot-${index}`,
        order: index + 1,
        title: ["上游已失败", "上游已成功", "提交结果不明"][index],
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
        generationRunId: `${project.id}-run-${index}`,
        generationTaskId: `${project.id}-task-${index}`,
    }));
    const runs = shots.map((shot, index): DramaProductionRun => ({
        id: shot.generationRunId!,
        projectId: project.id,
        episodeId: episode.id,
        planRevision: shot.id,
        status: "running",
        mode: "strict",
        parameterSnapshot: { imageModel: "e2e-image", videoModel: "e2e-video", ratio: "16:9" },
        steps: [
            { id: `video-${shot.id}`, shotId: shot.id, type: "video", dependsOn: [], status: "running", taskId: shot.generationTaskId, duration: 5 },
            { id: `extract-${shot.id}`, shotId: shot.id, type: "extract_frames", dependsOn: [`video-${shot.id}`], status: "blocked" },
        ],
        confirmedAt: new Date(now).toISOString(),
        createdAt: new Date(now + index).toISOString(),
        updatedAt: new Date(now + index).toISOString(),
    }));
    await withJsonDataFileLock("generation-tasks.json", async () => {
        const existing = await readJsonDataFile<unknown[]>("generation-tasks.json", []);
        const tasks = shots.map((shot, index) => {
            const status = index === 0 ? "error" : index === 1 ? "success" : "running";
            return {
                id: shot.generationTaskId,
                type: "video",
                userId: user.id,
                status,
                expiresAt: now + 86_400_000,
                createdAt: now,
                updatedAt: now,
                executionPhase: index === 2 ? "needs_review" : "completed",
                lastUpstreamStatus: index === 2 ? "submission_outcome_unknown" : status,
                payload: {
                    id: shot.generationTaskId,
                    userId: user.id,
                    status,
                    createdAt: now,
                    updatedAt: now,
                    projectId: project.id,
                    runId: shot.generationRunId,
                    config: { model: "e2e-video" },
                    upstream: { id: index === 2 ? "" : `provider-${shot.id}` },
                    error: index === 0 ? "供应商明确返回失败" : undefined,
                    result: index === 1 ? { url: "https://example.com/recovered.mp4" } : undefined,
                },
            };
        });
        await writeJsonDataFile("generation-tasks.json", [...existing, ...tasks]);
    });
    await withJsonDataFileLock("drama-production-runs.json", async () => {
        const existing = await readJsonDataFile<{ version: number; items: unknown[] }>("drama-production-runs.json", { version: 1, items: [] });
        await writeJsonDataFile("drama-production-runs.json", { ...existing, items: [...existing.items, ...runs.map((run) => ({ ...run, userId: user.id }))] });
    });
    const saved = await saveDramaProjectFixture(request, project, { ...project, activeEpisodeId: episode.id, episodes: [{ ...episode, reviewStatus: "visual_ready", shots }] });
    expect(saved.ok(), await saved.text()).toBe(true);
    const videoBytes = await readFile(new URL("./fixtures/video-recovery.mp4", import.meta.url));
    await page.route("**/api/video-tasks/*/download*", (route) => route.fulfill({ status: 200, contentType: "video/mp4", body: videoBytes }));
    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "切换到镜头生成" }).click();
    const readProject = async () => ((await (await request.get(`/api/drama/projects/${project.id}`)).json()) as { data: { project: DramaProject } }).data.project;
    await expect.poll(async () => (await readProject()).episodes[0].shots.map((shot) => shot.generationStatus)).toEqual(["error", "success", "needs_review"]);
    await expect(page.locator("[data-drama-shot-task]").nth(0).getByRole("button", { name: "重试镜头", exact: true })).toBeEnabled();
    await expect(page.locator("[data-drama-shot-task]").nth(1).getByRole("button", { name: "重新生成", exact: true })).toBeEnabled();
    await page.locator("[data-drama-shot-task]").nth(2).getByRole("button", { name: "拉取最新视频", exact: true }).click();
    await expect(page.getByText("提交结果尚未确认，请先由管理员核对供应商原任务", { exact: true })).toBeVisible();
    expect((await protocolFixtureState(request)).requests.filter((item) => item.method === "POST" && item.path.endsWith("/videos"))).toHaveLength(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "切换到镜头生成" }).click();
    await expect.poll(async () => (await readProject()).episodes[0].shots.map((shot) => shot.generationStatus)).toEqual(["error", "success", "needs_review"]);
    await expectNoHorizontalOverflow(page, "跨计划视频状态同步");
    const blocked = await request.post(`/api/drama/projects/${project.id}/production-runs`, { data: { episodeId: episode.id, preflight: { checkedShotIds: [shots[2].id] } } });
    expect(blocked.status()).toBe(409);
    expect((await blocked.json()).msg).toContain("待审核");
    const staleConsent = await request.post(`/api/drama/projects/${project.id}/production-runs`, { data: { episodeId: episode.id, preflight: { checkedShotIds: [shots[2].id] }, confirmedUncertainTaskIds: [shots[1].generationTaskId] } });
    expect(staleConsent.status()).toBe(409);
    await page.getByRole("button", { name: "批量生成视频", exact: true }).click();
    const batch = page.getByRole("dialog", { name: "批量生成视频" });
    await expect(batch.getByRole("button", { name: "生成 3 个镜头", exact: true })).toBeDisabled();
    const batchConsent = batch.getByRole("checkbox", { name: "我已核对原提交，仍要发起新任务并承担可能的重复计费" });
    await batchConsent.check();
    await expect(batch.getByRole("button", { name: "生成 3 个镜头", exact: true })).toBeEnabled();
    await batchConsent.uncheck();
    await expect(batch.getByRole("button", { name: "生成 3 个镜头", exact: true })).toBeDisabled();
    await batch.getByRole("button", { name: /^取\s*消$/ }).click();
    for (const shot of shots) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "切换到镜头生成" }).click();
        await page
            .locator("[data-drama-shot-task]")
            .nth(shot.order - 1)
            .getByRole("button", { name: /^(重试镜头|重新生成|处理待确认)$/ })
            .click();
        const confirmation = page.getByRole("dialog", { name: "确认生成 1 个镜头" });
        await expect(confirmation).toBeVisible();
        if (shot.order === 3) {
            const consent = confirmation.getByRole("checkbox", { name: "我已核对原提交，仍要发起新任务并承担可能的重复计费" });
            await expect(consent).not.toBeChecked();
            await confirmation.getByRole("button", { name: "确认生成", exact: true }).click();
            await expect(confirmation).toBeVisible();
            expect((await protocolFixtureState(request)).requests.filter((item) => item.method === "POST" && item.path.endsWith("/videos"))).toHaveLength(2);
            await consent.check();
            await expectNoHorizontalOverflow(page, "待确认重新提交确认");
        }
        const submitted = page.waitForResponse((response) => response.url().endsWith(`/api/drama/projects/${project.id}/production-runs`) && response.request().method() === "POST");
        await confirmation.getByRole("button", { name: "确认生成", exact: true }).click();
        const response = await submitted;
        expect(response.ok(), await response.text()).toBe(true);
        const run = ((await response.json()) as { data: { run: DramaProductionRun } }).data.run;
        expect(run.id).not.toBe(shot.generationRunId);
        if (shot.order === 3) expect(run.parameterSnapshot.confirmedUncertainTaskIds).toEqual([shot.generationTaskId]);
        await expect.poll(async () => (await readProject()).episodes[0].shots.find((item) => item.id === shot.id)?.generationTaskId).toBeTruthy();
        const taskId = (await readProject()).episodes[0].shots.find((item) => item.id === shot.id)!.generationTaskId;
        expect((await pollTask(request, `/api/video-tasks/${taskId}`)).status).toBe("success");
    }
    await expect.poll(async () => (await protocolFixtureState(request)).requests.filter((item) => item.method === "POST" && item.path.endsWith("/videos")).length).toBe(3);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "切换到镜头生成" }).click();
    await expect.poll(async () => (await readProject()).episodes[0].shots.map((shot) => shot.generationStatus)).toEqual(["success", "success", "success"]);
    const originalTask = await request.get(`/api/video-tasks/${shots[2].generationTaskId}`);
    expect(originalTask.ok()).toBe(true);
    expect((await originalTask.json()).task).toMatchObject({ status: "running", needsReview: true });
});

test("待确认镜头展示上游原始报错文案而不是通用提示", async ({ page, request }) => {
    test.skip(Boolean(process.env.VOZEB_PRO_E2E_DATABASE_URL), "文件夹具由独立 PostgreSQL 集成测试补充");
    process.env.VOZEB_PRO_DATA_DIR = path.resolve(process.cwd(), ".e2e-data");
    expect((await request.patch("/api/admin/settings", { data: e2eSettingsPatch() })).ok()).toBe(true);
    const credentials = { username: `video_error_${Date.now()}`, password: "E2e_Video_Error_2026!" };
    const provisioned = await request.post("/api/admin/users", { data: { ...credentials, displayName: "上游报错回归", role: "admin", adminPermissions: ["users.read"], status: "active", pointsBalance: 0 } });
    expect(provisioned.ok(), await provisioned.text()).toBe(true);
    expect((await request.post("/api/auth/login", { data: credentials })).ok()).toBe(true);
    await page.context().clearCookies();
    await page.context().addCookies((await request.storageState()).cookies);
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 上游报错文案", ratio: "16:9" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const user = (await (await request.get("/api/auth/session")).json()).user;
    const episode = project.episodes[0];
    const now = Date.now();
    const shot: DramaShot = {
        id: `${project.id}-shot-upstream-error`,
        order: 1,
        title: "上游拒绝生成",
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
        generationRunId: `${project.id}-run-upstream-error`,
        generationTaskId: `${project.id}-task-upstream-error`,
    };
    const run: DramaProductionRun = {
        id: shot.generationRunId!,
        projectId: project.id,
        episodeId: episode.id,
        planRevision: shot.id,
        status: "running",
        mode: "strict",
        parameterSnapshot: { imageModel: "e2e-image", videoModel: "e2e-video", ratio: "16:9" },
        steps: [{ id: `video-${shot.id}`, shotId: shot.id, type: "video", dependsOn: [], status: "running", taskId: shot.generationTaskId, duration: 5 }],
        confirmedAt: new Date(now).toISOString(),
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
    };
    await withJsonDataFileLock("generation-tasks.json", async () => {
        const existing = await readJsonDataFile<unknown[]>("generation-tasks.json", []);
        await writeJsonDataFile("generation-tasks.json", [
            ...existing,
            {
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
                    runId: shot.generationRunId,
                    config: { model: "e2e-video" },
                    upstream: { id: "" },
                    attempts: [{ attemptNo: 1, status: "failed", error: "这班还没开" }],
                },
            },
        ]);
    });
    await withJsonDataFileLock("drama-production-runs.json", async () => {
        const existing = await readJsonDataFile<{ version: number; items: unknown[] }>("drama-production-runs.json", { version: 1, items: [] });
        await writeJsonDataFile("drama-production-runs.json", { ...existing, items: [...existing.items, { ...run, userId: user.id }] });
    });
    const saved = await saveDramaProjectFixture(request, project, { ...project, activeEpisodeId: episode.id, episodes: [{ ...episode, reviewStatus: "visual_ready", shots: [shot] }] });
    expect(saved.ok(), await saved.text()).toBe(true);
    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "切换到镜头生成" }).click();
    const readProject = async () => ((await (await request.get(`/api/drama/projects/${project.id}`)).json()) as { data: { project: DramaProject } }).data.project;
    await expect.poll(async () => (await readProject()).episodes[0].shots[0]?.generationError).toContain("上游返回「这班还没开」");
    await expect(page.locator("[data-drama-shot-task]").first().getByText("上游返回「这班还没开」").first()).toBeVisible();
});
