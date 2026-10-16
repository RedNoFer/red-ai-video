import { DEFAULT_DRAMA_VIDEO_PROMPT_PREFIX, stripDramaVideoPromptPrefix } from "../src/lib/drama-video-prompt-prefix";
import { expect, test } from "@playwright/test";

import type { DramaProductionRun, DramaProject, DramaShot } from "../src/lib/drama-project-contract";
import { expectNoHorizontalOverflow } from "./responsive-helpers";
import { E2E_PROTOCOL_ORIGIN, e2eSettingsPatch, pollTask, protocolFixtureState, resetProtocolFixture, saveDramaProjectFixture } from "./support";

test.use({ storageState: ".e2e-data/admin-state.json" });

const REFERENCE_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGPQq/3/H4QZYAwAWewKpRUlAtEAAAAASUVORK5CYII=";

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
        await expect(page.getByRole("button", { name: "批量生成视频", exact: true })).toBeEnabled();
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

        // Use a fresh episode so the earlier single-shot task cannot change batch selection while this dialog is open.
        const batchCreated = await request.post("/api/drama/projects", { data: { title: `E2E 批量视频 ${width}`, ratio: "9:16" } });
        expect(batchCreated.ok(), await batchCreated.text()).toBe(true);
        const batchProject = ((await batchCreated.json()) as { data: { project: DramaProject } }).data.project;
        const batchEpisode = batchProject.episodes[0];
        const batchSaved = await saveDramaProjectFixture(request, batchProject, { ...batchProject, episodes: [{ ...batchEpisode, shots }] });
        expect(batchSaved.ok(), await batchSaved.text()).toBe(true);
        // The refreshed run marks one video as active while the remaining shots stay selectable.
        await page.route(new RegExp(`/api/drama/projects/${batchProject.id}/production-runs\\?episodeId=`), async (route) => {
            await route.fulfill({
                json: {
                    code: 0,
                    data: {
                        run: { ...run, projectId: batchProject.id, episodeId: batchEpisode.id, status: "running", steps: run.steps.map((step) => (step.type === "video" ? { ...step, shotId: shots[0].id, status: "running", taskId: undefined } : step)) },
                        preflight: null,
                    },
                    msg: "OK",
                },
            });
        });
        await page.goto(`/drama/${batchProject.id}`, { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "切换到镜头生成" }).click();
        await page.getByRole("button", { name: "批量生成视频", exact: true }).click();
        const batchDialog = page.getByRole("dialog", { name: "批量生成视频" });
        await expect(batchDialog).toBeVisible();
        await expectNoHorizontalOverflow(page, `${width}px batch video dialog`);
        await expect(batchDialog.getByRole("textbox")).toHaveCount(0);
        await expect(batchDialog.getByText("正在生产中").first()).toBeVisible();
        await expect(batchDialog.getByRole("checkbox", { name: `选择${shots[0].title}` })).toBeDisabled();
        await expect(batchDialog.getByRole("checkbox", { name: `选择${shots[1].title}` })).toBeChecked();
        await expect(batchDialog.getByRole("checkbox", { name: `选择${shots[2].title}` })).toBeChecked();
        await batchDialog.getByRole("checkbox", { name: `选择${shots[2].title}` }).uncheck();
        await expect(batchDialog.getByRole("button", { name: "生成 1 个镜头" })).toBeEnabled();
        await batchDialog.getByRole("checkbox", { name: `选择${shots[2].title}` }).check();
        const batchResponse = page.waitForResponse((response) => response.url().endsWith(`/api/drama/projects/${batchProject.id}/production-runs`) && response.request().method() === "POST");
        await batchDialog.getByRole("button", { name: "生成 2 个镜头" }).click();
        const batch = await batchResponse;
        expect(batch.ok(), await batch.text()).toBe(true);
        const body = batch.request().postDataJSON() as { preflight: { checkedShotIds: string[] }; videoPrompts: Record<string, string> };
        expect(body.preflight.checkedShotIds).toEqual(shots.slice(1).map((shot) => shot.id));
        expect(Object.values(body.videoPrompts).every((prompt) => prompt.includes("别走。"))).toBe(true);
        const batchRun = ((await batch.json()) as { data: { run: DramaProductionRun } }).data.run;
        expect(batchRun.parameterSnapshot.videoModel).toBeTruthy();
        expect(batchRun.parameterSnapshot.videoChannelId).toBeTruthy();
        expect(batchRun.parameterSnapshot.videoQuality).toBeTruthy();
        expect(batchRun.steps.filter((step) => step.type === "video")).toHaveLength(2);
        const batchVideos = batchRun.steps.filter((step) => step.type === "video");
        expect(batchVideos.every((step) => ["ready", "running", "success"].includes(step.status))).toBe(true);
        for (const step of batchVideos.filter((step) => step.taskId)) {
            const task = await pollTask(request, `/api/video-tasks/${step.taskId}`);
            expect(task.status).toBe("success");
        }
        await request.patch(`/api/drama/projects/${batchProject.id}/production-runs/${batchRun.id}`, { data: { action: "cancel" } });
    });
}

for (const width of [1672, 390, 430]) {
    test(`saved shot prompts and references survive reopening and batch submission at ${width}px`, async ({ page, request }) => {
        const configuration = e2eSettingsPatch();
        for (const channel of configuration.systemChannels) {
            channel.baseUrl = E2E_PROTOCOL_ORIGIN;
            channel.advancedConfig.protocol = "yinglingapi";
        }
        const settings = await request.patch("/api/admin/settings", { data: configuration });
        expect(settings.ok(), await settings.text()).toBe(true);
        await resetProtocolFixture(request);
        // Each viewport gets its own account so earlier video cases cannot consume this flow's submission rate budget.
        const credentials = { username: `refs_${width}_${Date.now()}`, password: "E2e_Reference_Only_2026!" };
        const provisioned = await request.post("/api/admin/users", { data: { ...credentials, displayName: "引用回归", role: "admin", adminPermissions: ["users.read"], status: "active", pointsBalance: 0 } });
        expect(provisioned.ok(), await provisioned.text()).toBe(true);
        const signedIn = await request.post("/api/auth/login", { data: credentials });
        expect(signedIn.ok(), await signedIn.text()).toBe(true);
        await page.context().clearCookies();
        await page.context().addCookies((await request.storageState()).cookies);
        const props: DramaProject["props"] = [];
        for (const [id, name] of [
            ["box", "铁盒"],
            ["recorder", "录音卡"],
            ["phone", "手机"],
        ]) {
            const uploaded = await request.post("/api/reference-assets", { data: { dataUrl: REFERENCE_DATA_URL, type: "image", persistent: true, originalName: `${id}.png` } });
            expect(uploaded.ok(), await uploaded.text()).toBe(true);
            const asset = (await uploaded.json()) as { url: string; key: string };
            props.push({ id, name, description: name, primaryReferenceId: `${id}-ref`, references: [{ id: `${id}-ref`, url: asset.url, storageKey: asset.key, source: "library", label: name, status: "approved", createdAt: new Date().toISOString() }] });
        }
        const created = await request.post("/api/drama/projects", { data: { title: `E2E 引用保存 ${width}`, ratio: "16:9" } });
        expect(created.ok(), await created.text()).toBe(true);
        const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
        const episode = project.episodes[0];
        const shots: DramaShot[] = [1, 2].map((order) => ({
            id: `saved-shot-${order}`,
            order,
            title: `保存镜头 ${order}`,
            description: "桌上的铁盒",
            sourceText: "铁盒留在桌上。",
            shotBoundary: "",
            dialogue: "",
            narration: "",
            utterances: [],
            imagePrompt: "桌面上的铁盒与手机",
            videoPrompt: "自然摄影。\n0–15秒，铁盒打开后保持在桌面，手机在右侧，固定镜头。\n音效：室内底噪。",
            cameraMotion: "固定",
            duration: 15,
            characterIds: [],
            propIds: ["phone", "box", "recorder"],
            clueIds: [],
            generationStatus: "idle",
            audioMode: "source",
            fieldOrigins: { videoPrompt: "manual" },
            framePlan: {
                start: { source: "independent" },
                end: { required: false },
                frames: [{ id: `f-${order}`, sequenceIndex: 1, startSecond: 0, endSecond: 15, imagePrompt: "桌面铁盒", actionPrompt: "盒盖保持打开" }],
                referenceManifest: props.map((asset, index) => ({ alias: `@图片${index + 1}`, role: "prop_anchor", purpose: asset.name, assetId: asset.id })),
            },
        }));
        const fixture = await saveDramaProjectFixture(request, project, { ...project, props: [...props].reverse(), episodes: [{ ...episode, shots }] });
        expect(fixture.ok(), await fixture.text()).toBe(true);
        await page.setViewportSize({ width, height: 960 });
        await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "切换到镜头生成" }).click();
        const declarationButton = page.getByRole("button", { name: "统一前置声明", exact: true });
        const declaration = page.getByRole("dialog", { name: "统一前置声明", exact: true });
        const saveDeclaration = async () => {
            const changed = page.waitForResponse((response) => response.url().endsWith(`/api/drama/projects/${project.id}/video-prompt-prefix`) && response.request().method() === "PATCH");
            await declaration.getByRole("button", { name: "保存并应用", exact: true }).click();
            const response = await changed;
            expect(response.ok(), await response.text()).toBe(true);
            await expect(declaration).toBeHidden();
        };
        await declarationButton.click();
        await expect(declaration.getByRole("textbox", { name: "统一前置声明内容" })).toHaveValue(DEFAULT_DRAMA_VIDEO_PROMPT_PREFIX);
        await saveDeclaration();
        const undoResponse = page.waitForResponse((response) => response.url().endsWith(`/api/drama/projects/${project.id}/video-prompt-prefix`) && response.request().method() === "PATCH");
        await page.getByRole("button", { name: "撤销声明", exact: true }).click();
        expect((await undoResponse).ok()).toBe(true);
        await expect(page.getByRole("button", { name: "撤销声明", exact: true })).toHaveCount(0);
        await declarationButton.click();
        const activePrefix = `${DEFAULT_DRAMA_VIDEO_PROMPT_PREFIX}\n补充：本片为虚构创作。`;
        await declaration.getByRole("textbox", { name: "统一前置声明内容" }).fill(activePrefix);
        await saveDeclaration();
        await declarationButton.click();
        await expect(declaration.getByRole("textbox", { name: "统一前置声明内容" })).toHaveValue(activePrefix);
        await declaration.getByRole("button", { name: /取\s*消/u }).click();
        await expectNoHorizontalOverflow(page, `${width}px project declaration tools`);
        const toolsLayout = await page.locator("[data-drama-generation-tools] > div").evaluate((element) => ({
            display: getComputedStyle(element).display,
            width: element.getBoundingClientRect().width,
            children: [...element.children].map((item) => ({ x: item.getBoundingClientRect().x, y: item.getBoundingClientRect().y, width: item.getBoundingClientRect().width })),
        }));
        expect(toolsLayout.display).toBe("grid");
        expect(toolsLayout.children).toHaveLength(4);
        expect(toolsLayout.children.every((item) => item.width > 0 && item.width <= toolsLayout.width)).toBe(true);
        if (width > 1024) expect(new Set(toolsLayout.children.map((item) => item.y)).size).toBe(1);
        else expect(new Set(toolsLayout.children.map((item) => item.x)).size).toBe(1);
        const firstShot = page.locator("[data-drama-shot-task]").first();
        await firstShot.getByRole("button", { name: "展开详情" }).click();
        const gallery = firstShot.locator("[data-drama-shot-reference-assets]");
        expect(await gallery.locator("[data-reference-id]").evaluateAll((items) => items.map((item) => item.getAttribute("data-reference-id")))).toEqual(["box", "recorder", "phone"]);
        const promptPatch = (shotId: string) => page.waitForResponse((response) => response.url().includes(`/shots/${shotId}/prompt?response=shot`) && response.request().method() === "PATCH");
        const cancelled = promptPatch(shots[0].id);
        await gallery.getByRole("checkbox", { name: "引用道具 · 录音卡", exact: true }).uncheck();
        const cancelResponse = await cancelled;
        expect(cancelResponse.ok(), await cancelResponse.text()).toBe(true);
        await expect(gallery.getByRole("checkbox", { name: "引用道具 · 录音卡", exact: true })).not.toBeChecked();
        const prompt = firstShot.getByRole("textbox", { name: "完整提交提示词" });
        await expect(prompt).not.toHaveValue(/道具「录音卡」/u);
        await expect(prompt).toHaveValue(/@图片2：道具「手机」/u);
        expect((await prompt.inputValue()).startsWith(activePrefix)).toBe(true);
        const authored = `${await prompt.inputValue()}\n作者补充：铁盒保持打开。`;
        await prompt.fill(authored);
        const savedPrompt = promptPatch(shots[0].id);
        await firstShot.getByRole("button", { name: "保存", exact: true }).click();
        expect((await savedPrompt).ok()).toBe(true);
        await firstShot.getByRole("button", { name: "生成镜头", exact: true }).click();
        const single = page.getByRole("dialog", { name: "确认生成 1 个镜头" });
        await expect(single.getByRole("textbox", { name: `${shots[0].title}视频提示词` })).toHaveValue(authored);
        await expect(single.getByRole("checkbox", { name: "引用道具 · 录音卡", exact: true })).not.toBeChecked();
        await single.getByRole("button", { name: "返回修改", exact: true }).click();
        await page.getByRole("button", { name: "批量生成视频", exact: true }).click();
        const batch = page.getByRole("dialog", { name: "批量生成视频" });
        await expect(batch.getByRole("textbox")).toHaveCount(0);
        const firstRow = batch.locator(`[data-drama-prompt-shot-id="${shots[0].id}"]`);
        expect(await firstRow.locator("[data-reference-id]").evaluateAll((items) => items.map((item) => item.getAttribute("data-reference-id")))).toEqual(["box", "recorder", "phone"]);
        const selected = promptPatch(shots[0].id);
        await firstRow.getByRole("button", { name: "切换图片引用：道具 · 录音卡", exact: true }).click();
        expect((await selected).ok()).toBe(true);
        await expect(firstRow.getByRole("checkbox", { name: "引用道具 · 录音卡", exact: true })).toBeChecked();
        const removed = promptPatch(shots[0].id);
        await firstRow.getByRole("checkbox", { name: "引用道具 · 录音卡", exact: true }).uncheck();
        expect((await removed).ok()).toBe(true);
        await firstRow.getByRole("button", { name: "编辑提示词", exact: true }).click();
        const batchPrompt = firstRow.getByRole("textbox", { name: `${shots[0].title}视频提示词` });
        const frozenPrompt = `${await batchPrompt.inputValue()}\n作者补充：镜头末尾停在桌面。`;
        await batchPrompt.fill(frozenPrompt);
        const savedBatchPrompt = promptPatch(shots[0].id);
        await firstRow.getByRole("button", { name: "保存提示词与引用", exact: true }).click();
        expect((await savedBatchPrompt).ok()).toBe(true);
        await firstRow.getByRole("button", { name: "收起提示词", exact: true }).click();
        const secondRow = batch.locator(`[data-drama-prompt-shot-id="${shots[1].id}"]`);
        for (const asset of props) {
            const cleared = promptPatch(shots[1].id);
            await secondRow.getByRole("checkbox", { name: `引用道具 · ${asset.name}`, exact: true }).uncheck();
            expect((await cleared).ok()).toBe(true);
        }
        await expectNoHorizontalOverflow(page, `${width}px editable batch references`);
        const layout = await firstRow.locator("[data-drama-video-reference-gallery]").evaluate((element) => ({
            display: getComputedStyle(element).display,
            width: element.getBoundingClientRect().width,
            children: [...element.children].map((item) => ({ left: item.getBoundingClientRect().left, right: item.getBoundingClientRect().right })),
        }));
        expect(layout.display).toBe("grid");
        expect(layout.width).toBeGreaterThan(0);
        expect(layout.children.every((item, index, all) => !index || item.left > all[index - 1].left)).toBe(true);
        await firstRow.scrollIntoViewIfNeeded();
        await page.screenshot({ path: test.info().outputPath(`batch-references-${width}.png`) });
        await batch.getByRole("button", { name: /取\s*消/u }).click();
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "切换到镜头生成" }).click();
        await page.getByRole("button", { name: "批量生成视频", exact: true }).click();
        await expect(firstRow.getByRole("checkbox", { name: "引用道具 · 录音卡", exact: true })).not.toBeChecked();
        for (const asset of props) await expect(secondRow.getByRole("checkbox", { name: `引用道具 · ${asset.name}`, exact: true })).not.toBeChecked();
        const submitted = page.waitForResponse((response) => response.url().endsWith(`/api/drama/projects/${project.id}/production-runs`) && response.request().method() === "POST");
        await batch.getByRole("button", { name: "生成 2 个镜头", exact: true }).click();
        const response = await submitted;
        expect(response.ok(), await response.text()).toBe(true);
        const body = response.request().postDataJSON() as { referenceSelections: Record<string, string[]>; videoPrompts: Record<string, string> };
        expect(body.referenceSelections).toEqual({ [shots[0].id]: ["box", "phone"], [shots[1].id]: [] });
        expect(body.videoPrompts[shots[0].id]).toBe(frozenPrompt);
        expect(body.videoPrompts[shots[1].id]).not.toContain("@图片");
        const run = ((await response.json()) as { data: { run: DramaProductionRun } }).data.run;
        expect(run.steps.find((step) => step.type === "video" && step.shotId === shots[0].id)?.referenceBindingsSnapshot?.map((binding) => binding.sourceId)).toEqual(["box", "phone"]);
        let dispatched = run;
        await expect
            .poll(async () => {
                const current = await request.get(`/api/drama/projects/${project.id}/production-runs?episodeId=${episode.id}`);
                dispatched = ((await current.json()) as { data: { run: DramaProductionRun } }).data.run;
                return dispatched.steps.filter((step) => step.type === "video").every((step) => step.taskId);
            })
            .toBe(true);
        for (const step of dispatched.steps.filter((item) => item.type === "video" && item.taskId)) expect((await pollTask(request, `/api/video-tasks/${step.taskId}`)).status).toBe("success");
        const upstream = await protocolFixtureState(request);
        expect(upstream.requests).toEqual(expect.arrayContaining([expect.objectContaining({ method: "POST", prompt: frozenPrompt, images: [expect.stringContaining(props[0].references![0].url), expect.stringContaining(props[2].references![0].url)] })]));
        const reloaded = await request.get(`/api/drama/projects/${project.id}`);
        const persisted = ((await reloaded.json()) as { data: { project: DramaProject } }).data.project.episodes[0].shots;
        expect(persisted[0]).toMatchObject({ executionVideoPrompt: stripDramaVideoPromptPrefix(frozenPrompt, { videoPromptPrefix: { text: activePrefix } }), videoReferenceIds: ["box", "phone"], videoReferenceMode: "reference" });
        expect(persisted[1].videoReferenceIds).toEqual([]);
    });
}
