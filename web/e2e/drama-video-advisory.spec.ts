import { expect, test } from "@playwright/test";

import type { DramaProductionRun, DramaProject, DramaShot } from "../src/lib/drama-project-contract";
import { expectNoHorizontalOverflow } from "./responsive-helpers";
import { e2eSettingsPatch, pollTask, protocolFixtureState, resetProtocolFixture, saveDramaProjectFixture } from "./support";

test.use({ storageState: ".e2e-data/admin-state.json" });

for (const width of [1672, 390, 430]) {
    test(`video quality findings stay advisory for single and batch submission at ${width}px`, async ({ page, request }) => {
        const settings = await request.patch("/api/admin/settings", { data: e2eSettingsPatch() });
        expect(settings.ok(), await settings.text()).toBe(true);
        await resetProtocolFixture(request);
        const created = await request.post("/api/drama/projects", { data: { title: `E2E 视频建议 ${width}`, summary: "未审核且未锁定方案仍可提交视频", ratio: "9:16" } });
        expect(created.ok(), await created.text()).toBe(true);
        const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
        const episode = project.episodes[0];
        const shots: DramaShot[] = [1, 2, 3].map((order) => ({
            id: `advisory-shot-${order}`,
            order,
            title: `建议镜头 ${order}`,
            code: `SH0${order}`,
            description: "人物近景抬头",
            sourceText: "人物抬头，低声说别走。",
            shotBoundary: "",
            dialogue: "别走。",
            narration: "",
            utterances: [{ id: `u${order}`, order: 1, type: "dialogue", speaker: "人物", text: "别走。", startSecond: 1, endSecond: 3, speechRate: "normal" }],
            imagePrompt: "",
            videoPrompt: "【参数】15秒，9:16，有声。\n【公共总规范】人物近景。\n【时间轴】\n0-15秒：人物近景抬头；台词：人物：“别走。”；人声：低声；音效：风声。\n【收尾】人物站定。",
            duration: 15,
            cameraMotion: "",
            characterIds: [],
            propIds: [],
            clueIds: [],
            generationStatus: "idle",
            audioMode: "source",
            fieldOrigins: { videoPrompt: "manual", framePlan: "manual" },
            framePlan: {
                start: { source: "independent" },
                end: { required: true },
                frames: [0, 1].map((index) => ({ id: `f${order}-${index}`, sequenceIndex: index + 1, startSecond: index * 7.5, endSecond: (index + 1) * 7.5, imagePrompt: "人物近景", actionPrompt: "人物抬头" })),
            },
        }));
        const saved = await saveDramaProjectFixture(request, project, { ...project, episodes: [{ ...episode, reviewStatus: "draft", shots }] });
        expect(saved.ok(), await saved.text()).toBe(true);
        await page.setViewportSize({ width, height: 960 });
        await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "切换到镜头生成" }).click();
        await expect(page.locator("[data-drama-director-warnings]")).toBeVisible();
        await expect(page.getByText("生成建议，不影响视频提交", { exact: true })).toBeVisible();
        await expect(page.getByText("无法提交", { exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "生成 3 个就绪镜头", exact: true })).toBeEnabled();
        await expectNoHorizontalOverflow(page, `${width}px advisory video generation`);

        const firstShot = page.locator("[data-drama-shot-task]").first();
        await firstShot.getByRole("button", { name: "展开详情" }).click();
        const detailPrompt = firstShot.locator("[data-drama-final-submission-prompt] textarea");
        const detailPromptText = await detailPrompt.inputValue();
        expect(detailPromptText).not.toMatch(/减切原因|修订状态|reduced-density-exception/iu);
        await firstShot.getByRole("button", { name: "生成镜头", exact: true }).click();
        const confirmation = page.getByRole("dialog", { name: "确认生成 1 个镜头" });
        await expect(confirmation).toBeVisible();
        await expect(confirmation.getByRole("textbox", { name: `${shots[0].title}视频提示词` })).toHaveValue(detailPromptText);
        const submitted = page.waitForResponse((response) => response.url().endsWith(`/api/drama/projects/${project.id}/production-runs`) && response.request().method() === "POST");
        await confirmation.getByRole("button", { name: "确认生成", exact: true }).click();
        const response = await submitted;
        expect(response.ok(), await response.text()).toBe(true);
        const run = ((await response.json()) as { data: { run: DramaProductionRun } }).data.run;
        expect(run.preflightSnapshot?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "FRAME_DIALOGUE_TIMING", severity: "warning" }), expect.objectContaining({ code: "COMPOSITION_CONTRACT", severity: "warning" })]));
        expect(run.preflightSnapshot?.issues.every((issue) => issue.severity === "warning")).toBe(true);
        const video = run.steps.find((step) => step.type === "video");
        expect(video?.status).toMatch(/^(ready|running|success)$/);
        expect(video?.prompt).toContain("别走。");
        if (video?.taskId) {
            expect(video.executionPrompt).toContain("别走。");
            const upstream = await protocolFixtureState(request);
            expect(upstream.requests.some((item) => item.method === "POST" && item.path.endsWith("/videos"))).toBe(true);
        }
        await expect(confirmation).toBeHidden();
        if (video?.taskId) {
            const singleTask = await pollTask(request, `/api/video-tasks/${video.taskId}`);
            expect(singleTask.status).toBe("success");
        }
        await request.patch(`/api/drama/projects/${project.id}/production-runs/${run.id}`, { data: { action: "cancel" } });

        // Batch creation uses the same backend path, with advisory findings for every selected shot.
        const batch = await request.post(`/api/drama/projects/${project.id}/production-runs`, { data: { episodeId: episode.id, preflight: { checkedShotIds: shots.slice(1).map((shot) => shot.id) } } });
        expect(batch.ok(), await batch.text()).toBe(true);
        const batchRun = ((await batch.json()) as { data: { run: DramaProductionRun } }).data.run;
        expect(batchRun.steps.filter((step) => step.type === "video")).toHaveLength(2);
        const batchVideos = batchRun.steps.filter((step) => step.type === "video");
        expect(batchVideos.every((step) => ["ready", "running", "success"].includes(step.status))).toBe(true);
        for (const step of batchVideos.filter((step) => step.taskId)) {
            const task = await pollTask(request, `/api/video-tasks/${step.taskId}`);
            expect(task.status).toBe("success");
        }
        await request.patch(`/api/drama/projects/${project.id}/production-runs/${batchRun.id}`, { data: { action: "cancel" } });
    });
}
