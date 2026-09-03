import { expect, test } from "@playwright/test";
import type { DramaProject } from "../src/lib/drama-project-contract";
import { applyChannelProtocol } from "../src/lib/channel-protocol-registry";

import { expectNoHorizontalOverflow } from "./responsive-helpers";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("drama review completion, continuity and audio configuration entry are visible", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 审核音频流程", summary: "验证审核补全、连续性和音频模型入口", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const episode = project.episodes[0];
    const seededProject: DramaProject = {
        ...project,
        activeEpisodeId: episode.id,
        episodes: [
            {
                ...episode,
                reviewStatus: "content_review",
                shots: [
                    {
                        id: "shot-review-one",
                        code: "SH001",
                        order: 1,
                        title: "黑湖记忆 1/2",
                        description: "Karin 在湖面上方醒来。",
                        sourceText: "Karin 在湖面上方醒来。",
                        shotBoundary: "场次起始镜头",
                        dialogue: "你又来迟了。",
                        narration: "",
                        utterances: [{ id: "utt-one", order: 1, type: "dialogue", speaker: "Karin", text: "你又来迟了。" }],
                        imagePrompt: "黑湖、倒塔、四手与裂剑，9:16 安全构图",
                        videoPrompt: "垂直慢推，Karin 握紧裂剑",
                        cameraMotion: "垂直慢推",
                        continuity: {
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
                        },
                        entryState: { characters: [], props: [] },
                        exitState: { characters: [], props: [] },
                        duration: 8,
                        characterIds: [],
                        propIds: [],
                        clueIds: [],
                        storyboardStatus: "idle",
                        generationStatus: "idle",
                        audioMode: "source",
                        audioStatus: "idle",
                    },
                ],
                continuityEdges: [],
            },
        ],
    };
    const saved = await request.patch(`/api/drama/projects/${project.id}`, { data: seededProject });
    expect(saved.ok(), await saved.text()).toBe(true);
    const savedProject = ((await saved.json()) as { data: { project: DramaProject } }).data.project;
    expect(savedProject.episodes[0]?.shots).toHaveLength(1);

    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-drama-workspace]")).toBeVisible();
    await page.getByRole("button", { name: "切换到内容审核" }).click();
    await expect(page.getByRole("heading", { name: "内容审核" })).toBeVisible();
    await expect(page.getByRole("button", { name: /AI 补全缺失项/ })).toBeVisible();

    await page.getByText("连续性", { exact: true }).click();
    await expect(page.getByText("计划状态：", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("实际首帧：", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("实际尾帧：", { exact: false }).first()).toBeVisible();

    await page.getByRole("button", { name: "切换到镜头生成" }).click();
    await expect(page.locator("[data-drama-generation-readiness]")).toBeVisible();
    await expect(page.getByText("视频原声默认", { exact: false }).or(page.getByText("系统音频模型已就绪", { exact: false }))).toBeVisible();
    await expectNoHorizontalOverflow(page, "drama review audio flow");

    await page.goto("/admin?section=channels", { waitUntil: "domcontentloaded" });
    await page.getByText("逻辑模型", { exact: true }).click();
    await expect(page.getByText("逻辑模型路由", { exact: true })).toBeVisible();
    await expect(page.getByText("默认能力", { exact: true })).toBeVisible();
});

test("管理员可以应用并保存音频逻辑模型路由", async ({ page, request }) => {
    const currentSettingsResponse = await request.get("/api/admin/settings");
    expect(currentSettingsResponse.ok(), await currentSettingsResponse.text()).toBe(true);
    const currentSettings = ((await currentSettingsResponse.json()) as { settings: Record<string, unknown> }).settings;
    const fixtureChannel = applyChannelProtocol({ id: "e2e-routing-audio", name: "E2E 路由音频夹具", baseUrl: "http://127.0.0.1:4010/v1", apiKey: "fixture-key", apiFormat: "openai", models: ["mock-audio"], enabled: true }, "openai");
    const settingsResponse = await request.patch("/api/admin/settings", {
        data: {
            systemChannels: [fixtureChannel],
            logicalModels: [{ id: "mock-audio", name: "Mock Audio", capability: "audio", enabled: true, bindings: [{ id: "e2e-routing-audio-binding", channelId: fixtureChannel.id, upstreamModel: "mock-audio", enabled: true, priority: 1 }] }],
            defaultModels: { ...(currentSettings.defaultModels as Record<string, string>), audioModel: "mock-audio" },
        },
    });
    expect(settingsResponse.ok(), await settingsResponse.text()).toBe(true);
    await page.goto("/admin?section=channels", { waitUntil: "domcontentloaded" });
    await page.getByText("逻辑模型", { exact: true }).click();
    await expect(page.getByText("逻辑模型路由", { exact: true })).toBeVisible();

    const search = page.getByPlaceholder("搜索模型昵称、ID 或上游模型");
    await search.fill("mock-audio");
    const modelCard = page
        .locator("div")
        .filter({ hasText: "ID：mock-audio" })
        .filter({ has: page.getByRole("button", { name: "路由设置" }) })
        .first();
    await expect(modelCard).toBeVisible();
    await modelCard.getByRole("button", { name: "路由设置" }).click();
    await expect(page.getByText("模型路由设置", { exact: true })).toBeVisible();

    await page.getByLabel("前端展示昵称").fill("Mock Audio Saved");
    const saveResponse = page.waitForResponse((response) => response.url().includes("/api/admin/settings") && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "应用修改" }).click();
    expect((await saveResponse).status()).toBe(200);
    await expect(page.getByText("模型路由设置已保存", { exact: true })).toBeVisible();

    const savedSettingsResponse = await request.get("/api/admin/settings");
    expect(savedSettingsResponse.ok(), await savedSettingsResponse.text()).toBe(true);
    const settings = (await savedSettingsResponse.json()) as { settings: { logicalModels: Array<{ id: string; name: string; capability: string }> } };
    expect(settings.settings.logicalModels).toEqual(expect.arrayContaining([expect.objectContaining({ id: "mock-audio", name: "Mock Audio Saved", capability: "audio" })]));
});

test("项目资产基准图使用可访问的本地媒体 URL", async ({ page, request }) => {
    const uploaded = await request.post("/api/reference-assets", {
        data: {
            dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
            type: "image",
            persistent: true,
            originalName: "e2e-character.png",
        },
    });
    expect(uploaded.ok(), await uploaded.text()).toBe(true);
    const uploadedAsset = (await uploaded.json()) as { url: string };

    const created = await request.post("/api/drama/projects", { data: { title: "E2E 本地角色素材", summary: "验证基准图可访问", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const saved = await request.patch(`/api/drama/projects/${project.id}`, {
        data: {
            ...project,
            characters: [
                {
                    id: "character-image-e2e",
                    name: "本地角色",
                    description: "用于验证本地基准图",
                    profile: { visualIdentity: "测试角色" },
                    references: [{ id: "character-image-e2e-ref", url: uploadedAsset.url, source: "upload", status: "approved", label: "基准图", createdAt: new Date().toISOString() }],
                    primaryReferenceId: "character-image-e2e-ref",
                },
            ],
        },
    });
    expect(saved.ok(), await saved.text()).toBe(true);

    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "打开项目资产" }).click();
    const image = page.locator('img[alt="本地角色基准图"]');
    await expect(image).toBeVisible();
    await expect.poll(async () => image.evaluate((element) => ({ naturalWidth: (element as HTMLImageElement).naturalWidth, complete: (element as HTMLImageElement).complete }))).toMatchObject({ complete: true, naturalWidth: 1 });
});

test("Voice Design 生成独立 voice_id 并可播放本地试听音频", async ({ page, request }) => {
    const sessionResponse = await request.get("/api/auth/session");
    expect(sessionResponse.ok(), await sessionResponse.text()).toBe(true);
    const session = (await sessionResponse.json()) as { user?: { id?: string } };
    expect(session.user?.id).toBeTruthy();
    const balanceResponse = await request.patch(`/api/admin/users/${session.user?.id}`, { data: { pointsBalance: 10 } });
    expect(balanceResponse.ok(), await balanceResponse.text()).toBe(true);

    const currentSettingsResponse = await request.get("/api/admin/settings");
    expect(currentSettingsResponse.ok(), await currentSettingsResponse.text()).toBe(true);
    const currentSettings = ((await currentSettingsResponse.json()) as { settings: Record<string, unknown> }).settings;
    const fixtureChannel = applyChannelProtocol(
        {
            id: "e2e-audio-fixture",
            name: "E2E Voice Design 夹具",
            baseUrl: "http://127.0.0.1:4010",
            apiKey: "fixture-key",
            apiFormat: "openai",
            models: [],
            enabled: true,
        },
        "buming-seedance",
    );
    const settingsResponse = await request.patch("/api/admin/settings", {
        data: {
            systemChannels: [fixtureChannel],
            logicalModels: [
                {
                    id: "voice-design",
                    name: "Voice Design",
                    capability: "audio",
                    enabled: true,
                    bindings: [{ id: "e2e-audio-binding", channelId: fixtureChannel.id, upstreamModel: "voice-design", enabled: true, priority: 1 }],
                },
            ],
            defaultModels: { ...(currentSettings.defaultModels as Record<string, string>), audioModel: "voice-design", voiceDesignModel: "voice-design" },
        },
    });
    expect(settingsResponse.ok(), await settingsResponse.text()).toBe(true);

    const created = await request.post("/api/drama/projects", { data: { title: "E2E 角色试听", summary: "验证角色音色完整链路", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const character = {
        id: "character-voice-e2e",
        name: "Karin",
        description: "18岁男性，冷静克制",
        profile: { visualIdentity: "年轻男性" },
        references: [],
    };
    const saved = await request.patch(`/api/drama/projects/${project.id}`, { data: { ...project, characters: [character] } });
    expect(saved.ok(), await saved.text()).toBe(true);

    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "打开项目资产" }).click();
    await page.getByRole("button", { name: "编辑角色：Karin" }).click();
    await expect(page.getByText("编辑角色", { exact: true })).toBeVisible();

    const creationResponsePromise = page.waitForResponse((response) => response.url().includes(`/voice-creation`) && response.request().method() === "POST");
    await page.getByRole("button", { name: "生成新声纹" }).click();
    const creationResponse = await creationResponsePromise;
    expect(creationResponse.ok(), await creationResponse.text()).toBe(true);
    const creationPayload = (await creationResponse.json()) as { data: { task: { id?: string } } };
    const previewTaskId = creationPayload.data.task.id;
    expect(previewTaskId).toBeTruthy();

    await expect
        .poll(async () => {
            const response = await request.get(`/api/audio-tasks/${previewTaskId}`);
            const payload = (await response.json()) as { task?: { status?: string; result?: { url?: string; assetId?: string } } };
            return { status: payload.task?.status, url: payload.task?.result?.url || "", assetId: payload.task?.result?.assetId || "", voiceId: payload.task?.result?.voiceId || "" };
        })
        .toMatchObject({ status: "success", url: expect.stringContaining("/api/reference-assets/"), assetId: expect.stringContaining("permanent"), voiceId: expect.stringContaining("fixture-voice-") });

    await page.getByRole("button", { name: "刷新声纹状态" }).click();
    await expect(page.getByRole("button", { name: "播放试听" })).toBeVisible();
    const audio = page.locator("audio");
    await expect(audio).toHaveCount(1);
    await expect.poll(async () => audio.evaluate((element) => ({ readyState: element.readyState, duration: element.duration, error: element.error?.code || 0 }))).toMatchObject({ readyState: 4, error: 0 });
    await expect.poll(async () => audio.evaluate((element) => element.duration)).toBeGreaterThan(0);
    const audioUrl = await audio.getAttribute("src");
    expect(audioUrl).toContain("/api/reference-assets/");
    const audioResponse = await request.get(audioUrl!);
    expect(audioResponse.status()).toBe(200);
    expect(audioResponse.headers()["content-type"]).toContain("audio/");
    await page.getByRole("button", { name: "播放试听" }).click();
    await expect.poll(async () => audio.evaluate((element) => ({ paused: element.paused, currentTime: element.currentTime }))).toMatchObject({ paused: false });
    await expect.poll(async () => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(0);
});
