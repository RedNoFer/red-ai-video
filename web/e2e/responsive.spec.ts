import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { billingProductsFixture, expectDialogWithinViewport, expectNoHorizontalOverflow, masonryGalleryFixture, masonryLayoutIsReady, openCreativeHistory, readMasonryLayout } from "./responsive-helpers";
import { e2eSettingsPatch } from "./support";
import type { DramaProject } from "../src/lib/drama-project-contract";

async function waitForCreativeComposerReady(page: Page) {
    await expect(page.locator(".creative-composer")).toHaveAttribute("data-ready", "true", { timeout: 45_000 });
    await expect(page.getByRole("button", { name: /当前创作类型：/ })).toBeVisible({ timeout: 45_000 });
}

async function mockCreativeImageUploads(page: Page, fileNames: string[], imageBuffer: Buffer) {
    const conversationId = `e2e-upload-${randomUUID()}`;
    const timestamp = Date.now();
    const imageDataUrl = `data:image/webp;base64,${imageBuffer.toString("base64")}`;
    let uploadIndex = 0;
    let conversationCreates = 0;
    let assetUploads = 0;
    await page.route(/\/api\/creative\/conversations(?:\?.*)?$/, async (route) => {
        if (route.request().method() === "GET") return route.fulfill({ json: { code: 0, data: { conversations: [], hasMore: false }, msg: "OK" } });
        if (route.request().method() !== "POST") return route.fallback();
        conversationCreates += 1;
        return route.fulfill({
            json: {
                code: 0,
                data: {
                    conversation: {
                        id: conversationId,
                        userId: "e2e-user",
                        surface: "chat",
                        source: "agent",
                        title: "新对话",
                        status: "active",
                        contextSummary: "",
                        contextSummaryThroughSequence: 0,
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        lastMessageAt: timestamp,
                    },
                },
                msg: "OK",
            },
        });
    });
    await page.route(/\/api\/creative\/assets(?:\?.*)?$/, async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        assetUploads += 1;
        const title = fileNames[uploadIndex] || `reference-${uploadIndex + 1}.webp`;
        uploadIndex += 1;
        return route.fulfill({
            json: {
                code: 0,
                data: {
                    asset: {
                        id: `asset-${uploadIndex}-${randomUUID()}`,
                        userId: "e2e-user",
                        conversationId,
                        ordinal: uploadIndex - 1,
                        type: "image",
                        status: "ready",
                        title,
                        storageKind: "remote",
                        remoteUrl: imageDataUrl,
                        serverUrl: imageDataUrl,
                        mimeType: "image/webp",
                        width: 512,
                        height: 512,
                        bytes: imageBuffer.byteLength,
                        metadata: {},
                        createdAt: timestamp + uploadIndex,
                        updatedAt: timestamp + uploadIndex,
                    },
                },
                msg: "OK",
            },
        });
    });
    await page.route(/\/api\/agent\/runs\?surface=chat$/, (route) => route.fulfill({ json: { code: 0, data: { runs: [] }, msg: "OK" } }));
    return {
        conversationCreates: () => conversationCreates,
        assetUploads: () => assetUploads,
    };
}

async function mockExistingCreativeConversation(page: Page) {
    const id = `e2e-conversation-${randomUUID()}`;
    const timestamp = Date.now();
    const conversation = {
        id,
        userId: "e2e-user",
        surface: "chat",
        source: "agent",
        title: "已有对话",
        status: "active",
        contextSummary: "",
        contextSummaryThroughSequence: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastMessageAt: timestamp,
    };
    await page.route(new RegExp(`/api/creative/conversations/${id}$`), (route) => route.fulfill({ json: { code: 0, data: { conversation }, msg: "OK" } }));
    await page.route(new RegExp(`/api/creative/conversations/${id}/messages(?:\\?.*)?$`), (route) =>
        route.fulfill({
            json: {
                code: 0,
                data: {
                    messages: [{ id: `message-${randomUUID()}`, conversationId: id, sequence: 1, role: "user", status: "completed", content: "继续完善这张图片", metadata: {}, createdAt: timestamp, updatedAt: timestamp }],
                },
                msg: "OK",
            },
        }),
    );
    await page.route(new RegExp(`/api/creative/conversations/${id}/assets$`), (route) => route.fulfill({ json: { code: 0, data: { assets: [] }, msg: "OK" } }));
    return id;
}

async function mockAgentConversationSwitchRace(page: Page) {
    const timestamp = Date.now();
    const conversationA = {
        id: `e2e-running-a-${randomUUID()}`,
        userId: "e2e-user",
        surface: "chat",
        source: "agent",
        title: "运行中的对话 A",
        status: "active",
        contextSummary: "",
        contextSummaryThroughSequence: 0,
        createdAt: timestamp,
        updatedAt: timestamp + 1,
        lastMessageAt: timestamp + 1,
    };
    const conversationB = {
        ...conversationA,
        id: `e2e-idle-b-${randomUUID()}`,
        title: "空闲对话 B",
        createdAt: timestamp - 1,
        updatedAt: timestamp,
        lastMessageAt: timestamp,
    };
    const run = {
        id: `e2e-running-run-${randomUUID()}`,
        conversationId: conversationA.id,
        inputMessageId: "e2e-running-user",
        assistantMessageId: "e2e-running-assistant",
        status: "running",
        assetIds: [],
        tasks: [{ id: "e2e-running-task", title: "生成图片", type: "image", status: "running" }],
        createdAt: timestamp,
        updatedAt: timestamp + 1,
    };
    const messages = new Map([
        [
            conversationA.id,
            [
                { id: run.inputMessageId, conversationId: conversationA.id, runId: run.id, sequence: 1, role: "user", status: "completed", content: "A 对话正在生成海报", metadata: {}, createdAt: timestamp, updatedAt: timestamp },
                { id: run.assistantMessageId, conversationId: conversationA.id, runId: run.id, sequence: 2, role: "assistant", status: "running", content: "正在生成 A 对话结果", metadata: {}, createdAt: timestamp + 1, updatedAt: timestamp + 1 },
            ],
        ],
        [
            conversationB.id,
            [
                { id: "e2e-idle-user", conversationId: conversationB.id, sequence: 1, role: "user", status: "completed", content: "B 对话自己的消息", metadata: {}, createdAt: timestamp, updatedAt: timestamp },
                { id: "e2e-idle-assistant", conversationId: conversationB.id, sequence: 2, role: "assistant", status: "completed", content: "B 对话已经完成", metadata: {}, createdAt: timestamp, updatedAt: timestamp },
            ],
        ],
    ]);
    const conversations = new Map([
        [conversationA.id, conversationA],
        [conversationB.id, conversationB],
    ]);
    let runReads = 0;
    let eventRequests = 0;
    let controlRequests = 0;
    let createRequests = 0;
    let releaseDelayedRun = () => undefined;
    let resolveDelayedRunRequested = () => undefined;
    let resolveDelayedRunReturned = () => undefined;
    const delayedRunRelease = new Promise<void>((resolve) => {
        releaseDelayedRun = resolve;
    });
    const delayedRunRequested = new Promise<void>((resolve) => {
        resolveDelayedRunRequested = resolve;
    });
    const delayedRunReturned = new Promise<void>((resolve) => {
        resolveDelayedRunReturned = resolve;
    });

    await page.route(/\/api\/creative\/conversations(?:\?.*)?$/, async (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        return route.fulfill({ json: { code: 0, data: { conversations: [conversationA, conversationB], hasMore: false }, msg: "OK" } });
    });
    await page.route(/\/api\/creative\/conversations\/([^/?]+)$/, async (route) => {
        const id = new URL(route.request().url()).pathname.split("/").at(-1) || "";
        const conversation = conversations.get(id);
        return conversation ? route.fulfill({ json: { code: 0, data: { conversation }, msg: "OK" } }) : route.fallback();
    });
    await page.route(/\/api\/creative\/conversations\/([^/?]+)\/messages(?:\?.*)?$/, async (route) => {
        const id = new URL(route.request().url()).pathname.split("/").at(-2) || "";
        return route.fulfill({ json: { code: 0, data: { messages: messages.get(id) || [] }, msg: "OK" } });
    });
    await page.route(/\/api\/creative\/conversations\/([^/?]+)\/assets$/, (route) => route.fulfill({ json: { code: 0, data: { assets: [] }, msg: "OK" } }));
    await page.route(new RegExp(`/api/agent/runs/${run.id}$`), async (route) => {
        runReads += 1;
        if (runReads === 2) {
            resolveDelayedRunRequested();
            await delayedRunRelease;
        }
        await route.fulfill({ json: { code: 0, data: { run }, msg: "OK" } });
        if (runReads === 2) resolveDelayedRunReturned();
    });
    await page.route(new RegExp(`/api/agent/runs/${run.id}/events$`), async (route) => {
        eventRequests += 1;
        await route.abort("connectionrefused");
    });
    await page.route(new RegExp(`/api/agent/runs/${run.id}/(?:cancel|pause|resume|retry)$`), async (route) => {
        controlRequests += 1;
        await route.fulfill({ json: { code: 0, data: { run }, msg: "OK" } });
    });
    await page.route(/\/api\/agent\/runs$/, async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        createRequests += 1;
        await route.fulfill({ json: { code: 0, data: { run, created: false }, msg: "OK" } });
    });

    return {
        conversationA,
        conversationB,
        run,
        delayedRunRequested,
        delayedRunReturned,
        releaseDelayedRun,
        runReads: () => runReads,
        eventRequests: () => eventRequests,
        controlRequests: () => controlRequests,
        createRequests: () => createRequests,
    };
}

async function mockCreativeMediaRound(page: Page, imageBuffer: Buffer, options: { imageDataUrl?: string; outputCount?: number; outputDimensions?: { width: number; height: number } } = {}) {
    const id = `e2e-media-round-${randomUUID()}`;
    const runId = `e2e-run-${randomUUID()}`;
    const timestamp = Date.now();
    const imageDataUrl = options.imageDataUrl || `data:image/webp;base64,${imageBuffer.toString("base64")}`;
    const outputCount = options.outputCount || 1;
    let repeatedRequest: Record<string, unknown> | undefined;
    const userMessage = {
        id: `user-${randomUUID()}`,
        conversationId: id,
        runId,
        sequence: 7,
        role: "user",
        status: "completed",
        content: "让参考图变成清透自然的电影感画面",
        metadata: { assetIds: ["reference-one"] },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    const assistantMessage = {
        id: `assistant-${randomUUID()}`,
        conversationId: id,
        runId,
        sequence: 8,
        role: "assistant",
        status: "completed",
        content: "图片已生成。",
        metadata: {
            generation: {
                highlights: [
                    { title: "主体清晰", description: "人物轮廓与服饰细节完整，适合作为商品主视觉。" },
                    { title: "质感细腻", description: "光影层次自然，材质与色彩表现稳定。" },
                    { title: "构图完整", description: "画面信息层级清楚，核心内容易于浏览。" },
                    { title: "便于延展", description: "可继续用于详情页、海报与社媒物料。" },
                ],
            },
        },
        createdAt: timestamp + 1,
        updatedAt: timestamp + 1,
    };
    const historyMessages = Array.from({ length: 6 }, (_, index) => ({
        id: `history-${index}-${randomUUID()}`,
        conversationId: id,
        sequence: index + 1,
        role: index % 2 ? "assistant" : "user",
        status: "completed",
        content: index % 2 ? `前面的创作记录 ${index + 1} 已完成。` : `前面的创作需求 ${index + 1}，用于验证长对话滚动。`,
        metadata: {},
        createdAt: timestamp - (7 - index),
        updatedAt: timestamp - (7 - index),
    }));
    const conversation = {
        id,
        userId: "e2e-user",
        surface: "chat",
        source: "agent",
        title: userMessage.content,
        status: "active",
        contextSummary: "",
        contextSummaryThroughSequence: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastMessageAt: timestamp,
    };
    const reference = {
        id: "reference-one",
        userId: "e2e-user",
        conversationId: id,
        sourceRunId: "upload",
        ordinal: 0,
        type: "image",
        status: "ready",
        title: "人物参考图",
        serverUrl: imageDataUrl,
        remoteUrl: imageDataUrl,
        mimeType: "image/webp",
        width: 512,
        height: 512,
        metadata: {},
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    const outputs = Array.from({ length: outputCount }, (_, index) => ({
        ...reference,
        ...options.outputDimensions,
        id: `output-${index + 1}`,
        sourceRunId: runId,
        messageId: assistantMessage.id,
        ordinal: index + 1,
        title: outputCount > 1 ? `生成结果 ${index + 1}` : "生成结果",
        createdAt: timestamp + index + 1,
        updatedAt: timestamp + index + 1,
    }));
    const run = {
        id: runId,
        conversationId: id,
        inputMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        status: "completed",
        prompt: userMessage.content,
        referencedAssetIds: [reference.id],
        requestedModelIds: ["e2e-image-model"],
        generationPreferences: { mode: "image", image: { size: "1:1", quality: "high" } },
        assetIds: outputs.map((output) => output.id),
        tasks: [{ id: "image-task", title: "生成图片", type: "image", model: "e2e-image-model", ratio: "1:1", quality: "high", count: outputCount, status: "completed" }],
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    await page.route(new RegExp(`/api/creative/conversations/${id}$`), (route) => route.fulfill({ json: { code: 0, data: { conversation }, msg: "OK" } }));
    await page.route(new RegExp(`/api/creative/conversations/${id}/messages(?:\\?.*)?$`), (route) => route.fulfill({ json: { code: 0, data: { messages: [...historyMessages, userMessage, assistantMessage] }, msg: "OK" } }));
    await page.route(new RegExp(`/api/creative/conversations/${id}/assets$`), (route) => route.fulfill({ json: { code: 0, data: { assets: [reference, ...outputs] }, msg: "OK" } }));
    await page.route(new RegExp(`/api/agent/runs/${runId}$`), (route) => route.fulfill({ json: { code: 0, data: { run }, msg: "OK" } }));
    await page.route(/\/api\/agent\/runs$/, async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        repeatedRequest = (await route.request().postDataJSON()) as Record<string, unknown>;
        const repeatedRun = { ...run, id: `repeat-${runId}`, inputMessageId: `repeat-user-${randomUUID()}`, assistantMessageId: `repeat-assistant-${randomUUID()}`, status: "running", assetIds: [], tasks: [] };
        return route.fulfill({ json: { code: 0, data: { run: repeatedRun, created: true }, msg: "OK" } });
    });
    return { id, repeatedRequest: () => repeatedRequest };
}

async function openComposerPopover(trigger: Locator, popover: Locator) {
    await expect(trigger).toBeVisible();
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    await expect(popover).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

async function selectComposerPopoverOption(trigger: Locator, popover: Locator, option: Locator, verify: () => Promise<void>) {
    await openComposerPopover(trigger, popover);
    await option.scrollIntoViewIfNeeded();
    await expect(option).toBeVisible();
    await option.click();
    await verify();
}

test("creative composer controls return to a neutral palette after selection", async ({ page }) => {
    const readPalette = (selector: Locator) =>
        selector.evaluate((element) => {
            const style = getComputedStyle(element);
            return { backgroundColor: style.backgroundColor, borderColor: style.borderColor, color: style.color };
        });

    const verifyNeutralControls = async (label: string) => {
        await waitForCreativeComposerReady(page);
        const modeTrigger = page.getByRole("button", { name: "当前创作类型：Agent 模式" });
        await expect(modeTrigger).toBeVisible();
        const neutralPalette = await readPalette(page.getByRole("button", { name: "生成模型：智能模型" }));
        await expect.poll(() => readPalette(modeTrigger)).toEqual(neutralPalette);
        await expect.poll(() => readPalette(page.getByRole("button", { name: "生成参数：生成参数" }))).toEqual(neutralPalette);
        await expect.poll(() => readPalette(page.getByRole("button", { name: "选择创作 Skill" }))).toEqual(neutralPalette);

        const modePopover = page.locator(".ant-popover").filter({ hasText: "创作类型" }).last();
        await openComposerPopover(modeTrigger, modePopover);
        const [modeTriggerRect, modePopoverRect] = await Promise.all([modeTrigger.evaluate((element) => element.getBoundingClientRect().toJSON()), modePopover.evaluate((element) => element.getBoundingClientRect().toJSON())]);
        expect(modePopoverRect.top, `${label} mode popover should open below its trigger`).toBeGreaterThanOrEqual(modeTriggerRect.bottom - 1);
        await expect.poll(() => readPalette(modeTrigger)).not.toEqual(neutralPalette);
        const selectedModeTrigger = page.getByRole("button", { name: "当前创作类型：视频生成" });
        await selectComposerPopoverOption(modeTrigger, modePopover, modePopover.getByRole("button", { name: /视频生成/ }), () => expect(selectedModeTrigger).toBeVisible());
        await expect(modePopover).toBeHidden();

        await expect.poll(() => readPalette(selectedModeTrigger)).toEqual(neutralPalette);

        const preferenceTrigger = page.getByRole("button", { name: "生成参数：智能参数 · 5秒" });
        const preferencePopover = page.locator(".ant-popover").last();
        await openComposerPopover(preferenceTrigger, preferencePopover);
        await expect.poll(() => readPalette(preferenceTrigger)).not.toEqual(neutralPalette);
        await preferencePopover.getByRole("tab", { name: "输出" }).click();
        const configuredPreferenceTrigger = page.getByRole("button", { name: "生成参数：智能参数 · 10秒" });
        await selectComposerPopoverOption(preferenceTrigger, preferencePopover, preferencePopover.getByRole("button", { name: "输入视频时长 10 秒" }), () => expect(configuredPreferenceTrigger).toBeVisible());
        await page.keyboard.press("Escape");
        await expect(preferencePopover).toBeHidden();

        await expect.poll(() => readPalette(configuredPreferenceTrigger)).toEqual(neutralPalette);
        await expectNoHorizontalOverflow(page, label);
    };

    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await verifyNeutralControls("creative composer neutral controls light");

    await page.evaluate(() => localStorage.setItem("vozeb-pro:theme_store", JSON.stringify({ state: { theme: "dark" }, version: 0 })));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await verifyNeutralControls("creative composer neutral controls dark");
});

test("creative composer optimizes the current prompt without sending it", async ({ page }) => {
    let optimizationRequests = 0;
    let runCreates = 0;
    await page.route(/\/api\/agent\/prompt-optimization$/, async (route) => {
        optimizationRequests += 1;
        const body = (await route.request().postDataJSON()) as Record<string, unknown>;
        expect(body).toMatchObject({ prompt: "做个国风人物海报", mode: "agent" });
        await route.fulfill({ json: { code: 0, data: { prompt: "生成一张国风人物海报，突出人物主体与传统服饰细节。" }, msg: "OK" } });
    });
    await page.route(/\/api\/agent\/runs$/, async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        runCreates += 1;
        return route.abort();
    });
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await waitForCreativeComposerReady(page);

    const input = page.getByRole("textbox", { name: "输入你的创作想法、脚本或画面要求" });
    const optimize = page.getByRole("button", { name: "优化提示词" });
    await expect(optimize).toBeDisabled();
    await input.fill("做个国风人物海报");
    await expect(optimize).toBeEnabled();
    await optimize.click();

    await expect(input).toHaveValue("生成一张国风人物海报，突出人物主体与传统服饰细节。");
    expect(optimizationRequests).toBe(1);
    expect(runCreates).toBe(0);
    await expectNoHorizontalOverflow(page, "creative prompt optimizer");
});

test("creative composer ignores an optimization response after the user sends", async ({ page }) => {
    let releaseOptimization = () => undefined;
    const optimizationRelease = new Promise<void>((resolve) => {
        releaseOptimization = resolve;
    });
    let runCreates = 0;
    await page.route(/\/api\/agent\/prompt-optimization$/, async (route) => {
        await optimizationRelease;
        await route.fulfill({ json: { code: 0, data: { prompt: "这条迟到的优化结果不能覆盖输入框" }, msg: "OK" } });
    });
    await page.route(/\/api\/agent\/runs$/, async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        runCreates += 1;
        await route.abort("connectionrefused");
    });
    try {
        await page.goto("/create", { waitUntil: "domcontentloaded" });
        await waitForCreativeComposerReady(page);

        const input = page.getByRole("textbox", { name: "输入你的创作想法、脚本或画面要求" });
        await input.fill("直接发送当前提示词");
        await page.getByRole("button", { name: "优化提示词" }).click();
        const send = page.getByRole("button", { name: "发送" });
        await expect(send).toBeEnabled();
        await send.click();
        await expect.poll(() => runCreates).toBe(1);

        releaseOptimization();
        await expect(input).toHaveValue("直接发送当前提示词");
        expect(runCreates).toBe(1);
    } finally {
        releaseOptimization();
    }
});

test("Agent generation inputs apply immediately and reveal video frame slots", async ({ page }, testInfo) => {
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await waitForCreativeComposerReady(page);

    const preferenceTrigger = page.getByRole("button", { name: "生成参数：生成参数" });
    const preferencePopover = page.locator(".ant-popover").last();
    await openComposerPopover(preferenceTrigger, preferencePopover);

    await preferencePopover.getByRole("button", { name: "打开图片自定义像素尺寸" }).click();
    await expect(preferencePopover.getByText("修改后立即生效，例如 1024 × 1536")).toHaveCount(0);
    await expect(preferencePopover.getByRole("button", { name: "恢复智能" })).toHaveCount(0);
    await preferencePopover.getByRole("textbox", { name: "自定义图片宽度" }).fill("1024");
    await preferencePopover.getByRole("textbox", { name: "自定义图片高度" }).fill("1536");
    await expect(preferencePopover.getByText("1024×1536", { exact: true })).toBeVisible();
    await expect(preferencePopover.getByRole("button", { name: "应用", exact: true })).toHaveCount(0);

    await preferencePopover.getByRole("tab", { name: "输出" }).click();
    const countInput = preferencePopover.getByRole("textbox", { name: "自定义生成数量" });
    await countInput.fill("6");
    await expect(countInput).toHaveValue("6");
    if (process.env.VOZEB_PRO_VISUAL_CAPTURE === "1") {
        const screenshotPath = testInfo.outputPath(`agent-immediate-parameters-${testInfo.project.name}.png`);
        await page.screenshot({ path: screenshotPath });
        await testInfo.attach("Agent 即时尺寸与数量", { path: screenshotPath, contentType: "image/png" });
    }

    await preferencePopover.getByRole("button", { name: "视频", exact: true }).click();
    await preferencePopover.getByRole("tab", { name: "输出" }).click();
    const durationInput = preferencePopover.getByRole("spinbutton", { name: "输入视频时长" });
    await expect(durationInput).not.toHaveAttribute("max");
    await durationInput.fill("60");
    await durationInput.press("Tab");
    await expect(durationInput).toHaveValue("60");
    await preferencePopover.getByRole("tab", { name: "画面" }).click();
    const firstLastOption = preferencePopover.getByRole("button", { name: "选择视频参考方式 首尾帧" });
    await expect(firstLastOption).toBeVisible();
    await firstLastOption.click();
    await expect(page.getByRole("button", { name: "当前创作类型：Agent 模式" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(preferencePopover).toBeHidden();

    const frames = page.locator('[aria-label="视频首尾帧"]');
    const firstFrame = page.getByRole("button", { name: "添加视频首帧" });
    await expect(frames).toBeVisible();
    await expect(firstFrame).toBeVisible();
    await expect(page.getByRole("button", { name: "添加视频尾帧" })).toBeVisible();

    await firstFrame.click();
    const framePopover = page.locator(".ant-popover").filter({ hasText: "选择首帧图片" }).last();
    await expect(framePopover).toBeVisible();
    const [frameRect, framePopoverRect] = await Promise.all([firstFrame.evaluate((element) => element.getBoundingClientRect().toJSON()), framePopover.evaluate((element) => element.getBoundingClientRect().toJSON())]);
    expect(framePopoverRect.top, "new Agent frame picker should open below its slot").toBeGreaterThanOrEqual(frameRect.bottom - 1);
    await expectNoHorizontalOverflow(page, `${testInfo.project.name} Agent immediate inputs and video frames`);
    if (process.env.VOZEB_PRO_VISUAL_CAPTURE === "1") {
        const screenshotPath = testInfo.outputPath(`agent-immediate-inputs-${testInfo.project.name}.png`);
        await page.screenshot({ path: screenshotPath });
        await testInfo.attach("Agent 即时参数与首尾帧", { path: screenshotPath, contentType: "image/png" });
    }
});

test("creative composer renders uploaded images as thumbnails instead of filename chips", async ({ page }, testInfo) => {
    const imageBuffer = readFileSync("public/generation-smoke.webp");
    const projectName = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-");
    const fileName = `${projectName}-reference.webp`;
    const requests = await mockCreativeImageUploads(page, [fileName], imageBuffer);

    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await waitForCreativeComposerReady(page);

    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "添加素材" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: fileName, mimeType: "image/webp", buffer: imageBuffer });

    const preview = page.getByRole("img", { name: fileName });
    await expect(preview).toBeVisible({ timeout: 45_000 });
    await expect(preview).toHaveAttribute("src", /^blob:/);
    await expect(page.getByText(fileName, { exact: true })).toHaveCount(0);
    await expect(page.getByText("上传中", { exact: true })).toHaveCount(0);
    expect(requests.conversationCreates()).toBe(0);
    expect(requests.assetUploads()).toBe(0);
    await expect(page).toHaveURL(/\/create$/);
    const inputRow = page.getByTestId("creative-composer-input-row");
    const previewSlot = page.getByLabel(`已上传图片 ${fileName}`);
    const textarea = page.getByRole("textbox", { name: "输入你的创作想法、脚本或画面要求" });
    await expect
        .poll(async () => {
            const [previewRect, textareaRect, rowRect] = await Promise.all([
                previewSlot.evaluate((element) => element.getBoundingClientRect().toJSON()),
                textarea.evaluate((element) => element.getBoundingClientRect().toJSON()),
                inputRow.evaluate((element) => element.getBoundingClientRect().toJSON()),
            ]);
            return previewRect.top >= rowRect.top && previewRect.bottom <= rowRect.bottom && previewRect.left < textareaRect.left && previewRect.width >= 48 && previewRect.height >= 48;
        })
        .toBe(true);
    await expectNoHorizontalOverflow(page, `${testInfo.project.name} creative image attachment preview`);

    const removeButton = page.getByRole("button", { name: `移除${fileName}` });
    const addButton = page.getByRole("button", { name: "继续添加参考素材" });
    await expect
        .poll(() =>
            removeButton.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                const indicator = element.querySelector<HTMLElement>("[data-delete-indicator]");
                if (!indicator) return false;
                const indicatorRect = indicator.getBoundingClientRect();
                const style = getComputedStyle(indicator);
                return (
                    rect.width >= 28 &&
                    rect.height >= 28 &&
                    indicatorRect.width >= 22 &&
                    indicatorRect.width <= 24 &&
                    indicatorRect.height >= 22 &&
                    indicatorRect.height <= 24 &&
                    style.backgroundColor !== "transparent" &&
                    style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
                    style.color === "rgb(255, 255, 255)"
                );
            }),
        )
        .toBe(true);
    await expect
        .poll(async () => {
            const [previewRect, removeRect, addRect] = await Promise.all([
                preview.evaluate((element) => element.getBoundingClientRect().toJSON()),
                removeButton.evaluate((element) => element.getBoundingClientRect().toJSON()),
                addButton.evaluate((element) => element.getBoundingClientRect().toJSON()),
            ]);
            return removeRect.top < previewRect.top && removeRect.right <= addRect.left;
        })
        .toBe(true);
    await removeButton.click();
    await expect(preview).toBeHidden();
});

test("creative conversation keeps successful media rounds copy-only", async ({ page }, testInfo) => {
    if (testInfo.project.name === "chromium") await page.setViewportSize({ width: 1672, height: 941 });
    const imageBuffer = readFileSync("public/generation-smoke.webp");
    const portraitDataUrl = `data:image/svg+xml;base64,${Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><rect width="720" height="1280" fill="#111820"/><rect x="52" y="52" width="616" height="760" rx="12" fill="#243846"/><circle cx="360" cy="350" r="168" fill="#8fb5c3"/><rect x="108" y="870" width="504" height="24" rx="12" fill="#e8eef1"/><rect x="168" y="926" width="384" height="16" rx="8" fill="#82939c"/><rect x="96" y="1030" width="148" height="148" rx="8" fill="#304c5c"/><rect x="286" y="1030" width="148" height="148" rx="8" fill="#456778"/><rect x="476" y="1030" width="148" height="148" rx="8" fill="#6b8793"/></svg>',
    ).toString("base64")}`;
    const fixture = await mockCreativeMediaRound(page, imageBuffer, { imageDataUrl: portraitDataUrl, outputDimensions: { width: 720, height: 1280 } });
    await page.goto(`/create?conversationId=${fixture.id}`, { waitUntil: "domcontentloaded" });

    const round = page.getByTestId("creative-media-round");
    await expect(round).toBeVisible({ timeout: 45_000 });
    await expect(round.getByText("让参考图变成清透自然的电影感画面", { exact: true })).toBeVisible();
    await expect(round.getByRole("img", { name: "人物参考图" })).toBeVisible();
    await expect(round.getByTestId("creative-user-avatar")).toBeVisible();
    await expect(round.getByLabel("本轮创作参数")).toContainText("e2e-image-model");
    await expect(round.getByLabel("本轮创作参数")).toContainText("1:1");
    await expect(round.getByLabel("本轮创作参数")).toContainText("高画质");

    const result = round.getByTestId("creative-media-result");
    const primaryResult = result.getByTestId("creative-primary-result");
    const media = primaryResult.getByRole("img", { name: "生成结果" });
    await expect(media).toBeVisible();
    await expect(primaryResult).toHaveAttribute("data-rendered-width", "300");
    await expect(primaryResult).toHaveAttribute("data-rendered-height", "533");
    await expect(result.getByText("更多生成结果", { exact: true })).toHaveCount(0);
    await expect(result.getByTestId("creative-result-switcher")).toHaveCount(0);
    const [primaryRect, mediaRect] = await Promise.all([primaryResult.evaluate((element) => element.getBoundingClientRect().toJSON()), media.evaluate((element) => element.getBoundingClientRect().toJSON())]);
    const portraitScale = Math.min(1, page.viewportSize()!.height / 3 / 533);
    expect(Math.abs(primaryRect.width - 300 * portraitScale)).toBeLessThanOrEqual(2);
    expect(Math.abs(primaryRect.height - 533 * portraitScale)).toBeLessThanOrEqual(2);
    expect(primaryRect.width - mediaRect.width).toBeLessThanOrEqual(3);
    expect(primaryRect.height - mediaRect.height).toBeLessThanOrEqual(3);

    const resultGroup = round.getByTestId("creative-result-group");
    const request = round.getByTestId("creative-round-request");
    await expect(resultGroup).toBeVisible();
    await expect(round.getByLabel("创作助手")).toBeVisible();
    await expect
        .poll(() =>
            resultGroup.evaluate((element) => {
                const style = getComputedStyle(element);
                return {
                    backgroundColor: style.backgroundColor,
                    borderWidth: `${style.borderTopWidth} ${style.borderRightWidth} ${style.borderBottomWidth} ${style.borderLeftWidth}`,
                    boxShadow: style.boxShadow,
                };
            }),
        )
        .toEqual({ backgroundColor: "rgba(0, 0, 0, 0)", borderWidth: "0px 0px 0px 0px", boxShadow: "none" });
    const actions = result.getByLabel("本轮创作操作", { exact: true });
    const [groupRect, resultRect, actionsRect, requestRect] = await Promise.all([
        resultGroup.evaluate((element) => element.getBoundingClientRect().toJSON()),
        result.evaluate((element) => element.getBoundingClientRect().toJSON()),
        actions.evaluate((element) => element.getBoundingClientRect().toJSON()),
        request.evaluate((element) => element.getBoundingClientRect().toJSON()),
    ]);
    expect(Math.abs(groupRect.width - resultRect.width)).toBeLessThanOrEqual(2);
    expect(actionsRect.width).toBeLessThanOrEqual(primaryRect.width + 2);
    expect(groupRect.width).toBeGreaterThanOrEqual(primaryRect.width - 2);
    expect(groupRect.width).toBeLessThanOrEqual(352);
    expect(requestRect.bottom, JSON.stringify({ requestBottom: requestRect.bottom, groupTop: groupRect.top })).toBeLessThanOrEqual(groupRect.top + 1);
    if (process.env.VOZEB_PRO_VISUAL_CAPTURE === "1") {
        await page.getByTestId("creative-conversation-scroll").evaluate((element) => element.scrollTo({ top: Math.max(0, element.scrollHeight - element.clientHeight - 230) }));
        await expect(page.locator(".creative-composer")).toHaveAttribute("data-compact", "true");
        const screenshotPath = testInfo.outputPath(`creative-media-single-${testInfo.project.name}.png`);
        await page.screenshot({ path: screenshotPath });
        await testInfo.attach("单结果创作记录", { path: screenshotPath, contentType: "image/png" });
    }

    const scrollArea = page.getByTestId("creative-conversation-scroll");
    const composer = page.locator(".creative-composer");
    await scrollArea.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(composer).toHaveAttribute("data-compact", "false");
    const expandedComposerHeight = await composer.evaluate((element) => element.getBoundingClientRect().height);
    await expect.poll(() => scrollArea.evaluate((element) => element.scrollHeight - element.clientHeight > 200)).toBe(true);
    await scrollArea.evaluate((element) => element.scrollTo({ top: 0 }));
    await expect(composer).toHaveAttribute("data-compact", "true");
    await expect(page.getByRole("button", { name: "回到底部" })).toBeVisible();
    const compactAppearance = await composer.evaluate((element) => {
        const style = getComputedStyle(element);
        const shell = element.parentElement;
        const dock = shell?.parentElement;
        return {
            backgroundColor: style.backgroundColor,
            borderWidth: `${style.borderTopWidth} ${style.borderRightWidth} ${style.borderBottomWidth} ${style.borderLeftWidth}`,
            boxShadow: style.boxShadow,
            composerHeight: element.getBoundingClientRect().height,
            shellHeight: shell?.getBoundingClientRect().height || 0,
            shellBackgroundColor: shell ? getComputedStyle(shell).backgroundColor : null,
            dockBackgroundColor: dock ? getComputedStyle(dock).backgroundColor : null,
            dockPosition: dock ? getComputedStyle(dock).position : null,
            dockPointerEvents: dock ? getComputedStyle(dock).pointerEvents : null,
        };
    });
    expect(compactAppearance.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(compactAppearance.borderWidth).not.toBe("0px 0px 0px 0px");
    expect(compactAppearance.boxShadow).not.toBe("none");
    expect(compactAppearance).toMatchObject({ shellBackgroundColor: "rgba(0, 0, 0, 0)", dockBackgroundColor: "rgba(0, 0, 0, 0)", dockPosition: "absolute", dockPointerEvents: "none" });
    expect(compactAppearance.composerHeight).toBeLessThan(expandedComposerHeight);
    expect(compactAppearance.shellHeight).toBeLessThan(expandedComposerHeight);
    await page.getByRole("button", { name: "回到底部" }).click();
    await expect(composer).toHaveAttribute("data-compact", "false");
    await expect.poll(() => scrollArea.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(4);

    await round.getByRole("button", { name: "查看本轮创作详细信息" }).click();
    const details = page.getByText("本轮创作详情", { exact: true }).locator("..", { hasText: "e2e-image-model" });
    await expect(details).toContainText("高画质");
    await page.keyboard.press("Escape");

    await page.evaluate(() => localStorage.setItem("vozeb-pro:theme_store", JSON.stringify({ state: { theme: "dark" }, version: 0 })));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(round).toBeVisible();
    await expect(round.getByLabel("本轮创作参数")).toContainText("e2e-image-model");
    await expectNoHorizontalOverflow(page, `${testInfo.project.name} creative media round dark`);
    if (process.env.VOZEB_PRO_VISUAL_CAPTURE === "1") {
        const screenshotPath = testInfo.outputPath(`creative-media-single-dark-${testInfo.project.name}.png`);
        await round.screenshot({ path: screenshotPath });
        await testInfo.attach("深色单结果创作记录", { path: screenshotPath, contentType: "image/png" });
    }

    await expect(round.getByRole("button", { name: "更多本轮创作操作" })).toBeVisible();
    await expect(round.getByRole("button", { name: "重新编辑" })).toHaveCount(0);
    await expect(round.getByRole("button", { name: "再次生成" })).toHaveCount(0);
    expect(fixture.repeatedRequest()).toBeUndefined();
    await expectNoHorizontalOverflow(page, `${testInfo.project.name} creative media round`);
});

test("creative conversation uses the shared switcher only for multiple media results", async ({ page }, testInfo) => {
    if (testInfo.project.name === "chromium") await page.setViewportSize({ width: 1672, height: 941 });
    const imageBuffer = readFileSync("public/generation-smoke.webp");
    const fixture = await mockCreativeMediaRound(page, imageBuffer, { outputCount: 4 });
    await page.goto(`/create?conversationId=${fixture.id}`, { waitUntil: "domcontentloaded" });

    const round = page.getByTestId("creative-media-round");
    const result = round.getByTestId("creative-media-result");
    const primaryResult = result.getByTestId("creative-primary-result");
    const switcher = result.getByTestId("creative-result-switcher");
    await expect(primaryResult.getByRole("img", { name: "生成结果 1" })).toBeVisible({ timeout: 45_000 });
    await expect(result).toHaveAttribute("data-results-count", "4");
    await expect(switcher).toHaveAttribute("data-results-count", "4");
    await expect(result.getByText("更多", { exact: true })).toBeVisible();
    await expect(switcher.getByRole("button", { name: /查看生成结果/ })).toHaveCount(4);
    const bounds = await switcher.getByRole("button", { name: /查看生成结果/ }).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
    expect(bounds.every((rect) => rect.width <= 79 && rect.height <= 65)).toBe(true);
    if (page.viewportSize()!.width >= 640) {
        expect(Math.max(...bounds.map((rect) => rect.left)) - Math.min(...bounds.map((rect) => rect.left))).toBeLessThanOrEqual(1);
        expect(bounds.every((rect, index) => index === 0 || rect.top > bounds[index - 1].top)).toBe(true);
    } else {
        expect(Math.max(...bounds.map((rect) => rect.top)) - Math.min(...bounds.map((rect) => rect.top))).toBeLessThanOrEqual(1);
        expect(bounds.every((rect, index) => index === 0 || rect.left > bounds[index - 1].left)).toBe(true);
    }
    await switcher.getByRole("button", { name: "查看生成结果 2" }).click();
    await expect(switcher.getByRole("button", { name: "查看生成结果 2" })).toHaveAttribute("aria-pressed", "true");
    const [groupWidth, primaryWidth, actionsWidth, switcherWidth] = await Promise.all([
        round.getByTestId("creative-result-group").evaluate((element) => element.getBoundingClientRect().width),
        primaryResult.evaluate((element) => element.getBoundingClientRect().width),
        result.getByLabel("本轮创作操作", { exact: true }).evaluate((element) => element.getBoundingClientRect().width),
        switcher.evaluate((element) => element.getBoundingClientRect().width),
    ]);
    expect(primaryWidth).toBeLessThanOrEqual(420);
    expect(groupWidth).toBeGreaterThanOrEqual(primaryWidth);
    expect(actionsWidth).toBeLessThanOrEqual(primaryWidth + 2);
    if (page.viewportSize()!.width >= 640) expect(switcherWidth).toBeLessThan(primaryWidth);
    else expect(Math.abs(switcherWidth - primaryWidth)).toBeLessThanOrEqual(2);
    await expectNoHorizontalOverflow(page, `${testInfo.project.name} four media results`);

    if (process.env.VOZEB_PRO_VISUAL_CAPTURE === "1") {
        await page.getByTestId("creative-conversation-scroll").evaluate((element) => element.scrollTo({ top: Math.max(0, element.scrollHeight - element.clientHeight - 230) }));
        const screenshotPath = testInfo.outputPath(`creative-media-four-${testInfo.project.name}.png`);
        await page.screenshot({ path: screenshotPath });
        await testInfo.attach("四结果创作记录", { path: screenshotPath, contentType: "image/png" });
    }
});

test("creative composer opens menus upward after entering a conversation", async ({ page }) => {
    const conversationId = await mockExistingCreativeConversation(page);
    await page.goto(`/create?conversationId=${conversationId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("继续完善这张图片", { exact: true })).toBeVisible();

    const modeTrigger = page.getByRole("button", { name: "当前创作类型：Agent 模式" });
    const modePopover = page.locator(".ant-popover").filter({ hasText: "创作类型" }).last();
    await openComposerPopover(modeTrigger, modePopover);
    const [triggerRect, popoverRect] = await Promise.all([modeTrigger.evaluate((element) => element.getBoundingClientRect().toJSON()), modePopover.evaluate((element) => element.getBoundingClientRect().toJSON())]);
    expect(popoverRect.bottom, "conversation mode popover should open above its trigger").toBeLessThanOrEqual(triggerRect.top + 1);
});

test("switching conversations keeps the previous Agent run isolated and resumable", async ({ page }) => {
    const fixture = await mockAgentConversationSwitchRace(page);
    await page.goto(`/create?conversationId=${fixture.conversationA.id}`, { waitUntil: "domcontentloaded" });
    await waitForCreativeComposerReady(page);
    await expect(page.getByText("A 对话正在生成海报", { exact: true })).toBeVisible();
    await fixture.delayedRunRequested;

    let history = await openCreativeHistory(page);
    await history.getByText("空闲对话 B", { exact: true }).click();
    await expect(page.getByText("B 对话自己的消息", { exact: true })).toBeVisible();
    await expect(page.getByText("A 对话正在生成海报", { exact: true })).toBeHidden();
    if ((page.viewportSize()?.width || 0) >= 1024) await expect(history).toBeVisible();
    else await expect(history).toBeHidden();

    fixture.releaseDelayedRun();
    await fixture.delayedRunReturned;
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

    await expect(page.getByRole("button", { name: "发送" })).toBeVisible();
    await expect(page.getByRole("button", { name: "停止生成" })).toHaveCount(0);
    expect(fixture.eventRequests(), "the delayed A run must not reconnect inside B").toBe(0);
    expect(fixture.controlRequests(), "switching conversations must not control or cancel A").toBe(0);

    history = await openCreativeHistory(page);
    await history.getByText("运行中的对话 A", { exact: true }).click();
    await expect(page.getByText("A 对话正在生成海报", { exact: true })).toBeVisible();
    await expect(page.getByText("B 对话自己的消息", { exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "停止生成" })).toBeVisible();
    await expect.poll(fixture.eventRequests).toBeGreaterThan(0);

    expect(fixture.runReads()).toBeGreaterThanOrEqual(4);
    expect(fixture.createRequests(), "returning to A must reuse the persisted run").toBe(0);
    expect(fixture.controlRequests(), "returning to A must not cancel, pause, resume, or retry it").toBe(0);
});

test("creative video first and last frame controls support upload, removal and reselection", async ({ page }, testInfo) => {
    const frameBuffer = readFileSync("public/generation-smoke.webp");
    const projectName = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-");
    const firstFileName = `${projectName}-first-frame.webp`;
    const lastFileName = `${projectName}-last-frame.webp`;
    await mockCreativeImageUploads(page, [firstFileName, lastFileName], frameBuffer);

    const selectFirstLastMode = async () => {
        await waitForCreativeComposerReady(page);
        const modeTrigger = page.getByRole("button", { name: /当前创作类型：/ });
        await expect(modeTrigger).toBeVisible();
        if ((await modeTrigger.getAttribute("aria-label")) !== "当前创作类型：视频生成") {
            const modePopover = page.locator(".ant-popover").filter({ hasText: "创作类型" }).last();
            await selectComposerPopoverOption(modeTrigger, modePopover, modePopover.getByRole("button", { name: /^视频生成/ }), () => expect(modeTrigger).toHaveAttribute("aria-label", "当前创作类型：视频生成"));
            await expect(modePopover).toBeHidden();
        }

        const preferenceTrigger = page.getByRole("button", { name: /生成参数：/ });
        const preferencePopover = page.locator(".ant-popover").filter({ hasText: "参考方式" }).last();
        const frames = page.locator('[aria-label="视频首尾帧"]');
        await selectComposerPopoverOption(preferenceTrigger, preferencePopover, preferencePopover.getByRole("button", { name: "选择视频参考方式 首尾帧" }), () => expect(frames).toBeVisible());
        await page.keyboard.press("Escape");
        await expect(preferencePopover).toBeHidden();
    };

    const uploadFrame = async (label: "首帧" | "尾帧", fileName: string) => {
        await page.getByRole("button", { name: `添加视频${label}` }).click();
        const popover = page
            .locator(".ant-popover")
            .filter({ hasText: `选择${label}图片` })
            .last();
        await expect(popover).toBeVisible();
        const chooserPromise = page.waitForEvent("filechooser");
        await popover.getByRole("button", { name: "上传新图片" }).click();
        const chooser = await chooserPromise;
        await chooser.setFiles({ name: fileName, mimeType: "image/webp", buffer: frameBuffer });
        await expect(page.getByRole("button", { name: `更换视频${label}` })).toBeVisible({ timeout: 45_000 });
    };

    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await selectFirstLastMode();

    const composer = page.locator(".creative-composer");
    const frames = page.locator('[aria-label="视频首尾帧"]');
    await composer.locator("textarea").fill("让首尾画面自然衔接");
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText("请先同时选择视频首帧和尾帧图片").last()).toBeVisible();

    await uploadFrame("首帧", firstFileName);
    await uploadFrame("尾帧", lastFileName);
    await expect(frames.getByRole("img", { name: firstFileName })).toBeVisible();
    await expect(frames.getByRole("img", { name: lastFileName })).toBeVisible();
    await expect(composer.getByText(firstFileName, { exact: true })).toHaveCount(0);
    await expect(composer.getByText(lastFileName, { exact: true })).toHaveCount(0);

    await frames.getByRole("button", { name: "移除视频尾帧" }).click();
    await expect(page.getByRole("button", { name: "添加视频尾帧" })).toBeVisible();
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText("请先同时选择视频首帧和尾帧图片").last()).toBeVisible();

    await page.getByRole("button", { name: "添加视频尾帧" }).click();
    const tailPopover = page.locator(".ant-popover").filter({ hasText: "选择尾帧图片" }).last();
    await expect(tailPopover).toBeVisible();
    await tailPopover.getByRole("button", { name: `设为尾帧：${lastFileName}` }).click();
    await expect(frames.getByRole("img", { name: lastFileName })).toBeVisible();
    await expect(composer.getByText(lastFileName, { exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page, `${testInfo.project.name} creative video frames light`);

    await page.evaluate(() => localStorage.setItem("vozeb-pro:theme_store", JSON.stringify({ state: { theme: "dark" }, version: 0 })));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await selectFirstLastMode();
    await expect(page.getByRole("button", { name: "添加视频首帧" })).toBeVisible();
    await expect(page.getByRole("button", { name: "添加视频尾帧" })).toBeVisible();
    await expectNoHorizontalOverflow(page, `${testInfo.project.name} creative video frames dark`);
});

test("Agent text assets with emoji remain visible after hydration and refresh", async ({ page }) => {
    const conversationId = "agent-emoji-conversation";
    const messageId = "agent-emoji-message";
    const conversation = {
        id: conversationId,
        userId: "e2e-user",
        surface: "chat" as const,
        source: "agent" as const,
        title: "Emoji 文章回归",
        status: "active" as const,
        contextSummary: "",
        contextSummaryThroughSequence: 0,
        createdAt: 1,
        updatedAt: 2,
        lastMessageAt: 2,
    };
    const message = {
        id: messageId,
        conversationId,
        sequence: 2,
        role: "assistant" as const,
        status: "completed" as const,
        content: "已完成 1 个创作任务。",
        metadata: {},
        createdAt: 2,
        updatedAt: 2,
    };
    const asset = {
        id: "agent-emoji-asset",
        userId: "e2e-user",
        conversationId,
        messageId,
        ordinal: 0,
        type: "text" as const,
        status: "ready" as const,
        title: "夏日新品推文",
        textContent: "# 夏日新品\n\n今天也要保持好心情 😊❤️🚀",
        metadata: {},
        createdAt: 2,
        updatedAt: 2,
    };

    await page.route(/\/api\/creative\/conversations(?:\/.*)?(?:\?.*)?$/, async (route) => {
        const url = new URL(route.request().url());
        if (route.request().method() !== "GET") return route.fallback();
        if (url.pathname.endsWith(`/conversations/${conversationId}`)) return route.fulfill({ json: { code: 0, data: { conversation }, msg: "OK" } });
        if (url.pathname.endsWith(`/conversations/${conversationId}/messages`)) return route.fulfill({ json: { code: 0, data: { messages: [message] }, msg: "OK" } });
        if (url.pathname.endsWith(`/conversations/${conversationId}/assets`)) return route.fulfill({ json: { code: 0, data: { assets: [asset] }, msg: "OK" } });
        if (url.pathname === "/api/creative/conversations") return route.fulfill({ json: { code: 0, data: { conversations: [conversation], hasMore: false }, msg: "OK" } });
        return route.fallback();
    });

    await page.goto(`/create?conversationId=${conversationId}`, { waitUntil: "domcontentloaded" });
    const textResult = page.getByRole("region", { name: "文本产物：夏日新品推文" });
    await expect(textResult).toBeVisible();
    await expect(textResult).toContainText("今天也要保持好心情 😊❤️🚀");
    await expect(page.getByText("已完成 1 个创作任务。", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "复制消息" })).toBeVisible();
    const markdown = textResult.locator('div[style*="Segoe UI Emoji"]');
    expect(await markdown.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Segoe UI Emoji");
    await expectNoHorizontalOverflow(page, "Agent emoji article");

    await page.evaluate(() => localStorage.setItem("vozeb-pro:theme_store", JSON.stringify({ state: { theme: "dark" }, version: 0 })));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("region", { name: "文本产物：夏日新品推文" })).toContainText("今天也要保持好心情 😊❤️🚀");
    await expectNoHorizontalOverflow(page, "Agent emoji article dark");
});

test("drama asset GPT refinement drawer stays within desktop and mobile viewports", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 角色精修", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: { id: string } } }).data.project;

    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "打开项目资产" }).click();
    await page.getByRole("button", { name: "新建角色" }).click();
    const createAsset = page.getByRole("dialog", { name: "新建角色" });
    await createAsset.locator("input").first().fill("Rifa E2E");
    await createAsset.locator("textarea").first().fill("需要保持身份一致的主角");
    await createAsset.getByRole("button", { name: "创建角色" }).click();

    await page.getByRole("button", { name: "编辑角色：Rifa E2E" }).click();
    const drawer = page.getByRole("dialog", { name: "编辑角色" });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("[data-drama-asset-refinement]")).toBeVisible();
    await expect(drawer.getByPlaceholder(/Rifa E2E 的肤色/)).toBeVisible();
    await expectDialogWithinViewport(drawer);
    const layout = await drawer.locator("[data-drama-asset-editor-content]").evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
});

test("drama candidate generation does not require the approved baseline image", async ({ page, request }) => {
    const settings = await request.patch("/api/admin/settings", { data: e2eSettingsPatch() });
    expect(settings.ok(), await settings.text()).toBe(true);
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 无参考图候选", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const characterId = "character-no-reference-e2e";
    const referenceId = "reference-approved-e2e";
    const saved = await request.patch(`/api/drama/projects/${project.id}`, {
        data: {
            ...project,
            characters: [
                {
                    id: characterId,
                    name: "无参考图角色",
                    description: "用于验证普通候选生成不强制依赖基准图",
                    profile: { visualIdentity: "短发青年" },
                    references: [{ id: referenceId, url: "/api/reference-assets/permanent/e2e-approved.png", source: "upload", status: "approved", label: "基准图", createdAt: new Date().toISOString() }],
                    primaryReferenceId: referenceId,
                },
            ],
        },
    });
    expect(saved.ok(), await saved.text()).toBe(true);

    const taskId = "e2e-drama-no-reference-task";
    let submittedBody: Record<string, unknown> | undefined;
    await page.route(/\/api\/image-tasks$/, async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        submittedBody = (await route.request().postDataJSON()) as Record<string, unknown>;
        return route.fulfill({ json: { task: { id: taskId, kind: "generation", status: "pending", model: "e2e-image" } } });
    });
    await page.route(new RegExp(`/api/image-tasks/${taskId}$`), (route) =>
        route.fulfill({
            json: {
                task: {
                    id: taskId,
                    kind: "generation",
                    status: "success",
                    model: "e2e-image",
                    result: { dataUrl: "data:image/png;base64,e2e", serverUrl: "/api/generation-log-assets/permanent/e2e-candidate.png", width: 1024, height: 1792, mimeType: "image/png" },
                },
            },
        }),
    );
    await page.route(new RegExp(`/api/drama/projects/${project.id}/assets/characters/${characterId}/review$`), (route) =>
        route.fulfill({ json: { code: 0, data: { review: { mode: "mock", status: "passed", summary: "通过", issues: [], retryTaskIds: [] } }, msg: "OK" } }),
    );

    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "打开项目资产" }).click();
    await page.getByRole("button", { name: "编辑角色：无参考图角色" }).click();
    const drawer = page.getByRole("dialog", { name: "编辑角色" });
    await drawer.getByRole("button", { name: "生成候选" }).click();
    await expect.poll(() => submittedBody).toBeTruthy();
    expect(submittedBody?.references).toEqual([]);
    await expect(page.getByText("参考图需要公网图片 URL", { exact: false })).toHaveCount(0);
});

test("drama shot generation previews prompt before confirmation", async ({ page }) => {
    const effectCleanupErrors: string[] = [];
    page.on("console", (message) => {
        if (message.type() === "error" && message.text().includes("useEffect must not return anything besides a function")) effectCleanupErrors.push(message.text());
    });
    const adminState = JSON.parse(readFileSync(".e2e-data/admin-state.json", "utf8")) as { cookies: Array<{ name: string; value: string }> };
    const cookie = adminState.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
    const created = await page.request.post("/api/drama/projects", { headers: { cookie }, data: { title: "E2E 镜头提示词预览", summary: "验证镜头生成前先看提示词", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const episode = project.episodes[0];
    const seededProject: DramaProject = {
        ...project,
        defaultVideoMode: "reference",
        productionBible: {
            ...project.productionBible,
            language: "中文",
            ratio: "9:16",
            visualStyle: "电影感",
            continuityMode: "strict",
            productionPlan: {
                version: "drama-production-plan-v1",
                skills: [],
                video: { model: "e2e-video", mode: "storyboard", ratio: "9:16", resolution: "720p", durationPolicy: "shot", count: 1, audioMode: "native", allowExplicitFallback: false },
                references: { strategy: "adaptive", minImages: 1, maxImages: 5, roles: [] },
                continuity: { mode: "strict", requireAcceptedActualTail: true },
                lockedAt: "2026-01-01T00:00:00.000Z",
                source: "manual",
            },
        },
        seriesBible: {
            version: "series-bible-v1",
            canonCharacters: ["character-one"],
            immutableRules: ["角色识别保持不变"],
            relationshipState: "稳定",
            worldRules: ["黑湖持续存在"],
            unresolvedThreads: [],
            visualMotifs: ["冷灰蓝"],
            soundMotifs: ["低频风声"],
            previousEpisodeExitState: { environment: "黑湖边", lighting: "冷雾", characters: [], props: [] },
        },
        characters: [
            {
                id: "character-one",
                name: "Karin",
                description: "主角",
                activeEpisodeCodes: [episode.code || episode.id],
                primaryReferenceId: "character-one-ref",
                references: [{ id: "character-one-ref", url: "/karin.png", source: "generated", label: "基准", status: "approved", createdAt: "2026-01-01T00:00:00.000Z" }],
            },
        ],
        scenes: [
            {
                id: "scene-one",
                name: "黑湖",
                description: "湖面和高塔",
                primaryReferenceId: "scene-one-ref",
                references: [{ id: "scene-one-ref", url: "/scene.png", source: "generated", label: "基准", status: "approved", createdAt: "2026-01-01T00:00:00.000Z" }],
            },
        ],
        props: [],
        clues: [],
        episodes: [
            {
                ...episode,
                reviewStatus: "visual_ready",
                shots: [
                    {
                        id: "shot-one",
                        code: "SH01",
                        order: 1,
                        title: "黑湖记忆 1/1",
                        description: "Karin 在黑湖边转身，风掠过水面。",
                        sourceText: "Karin 在黑湖边转身，风掠过水面。",
                        shotBoundary: "镜头起始于湖岸。",
                        dialogue: "",
                        narration: "",
                        utterances: [],
                        performancePlan: {
                            emotionalObjective: "压住慌乱",
                            emotionalArc: "从克制到警觉",
                            speechStyle: "沉稳",
                            pace: "中慢",
                            breath: "浅",
                            restraintLevel: "中",
                            beats: {
                                start: { emotion: "紧张", facialAction: "眉头微皱", gaze: "看向湖心", bodyAction: "肩背绷紧" },
                                middle: { emotion: "警觉", facialAction: "目光收紧", gaze: "扫向左侧", bodyAction: "手指扣紧" },
                                end: { emotion: "决断", facialAction: "下颌收紧", gaze: "盯住前方", bodyAction: "转身前倾" },
                            },
                        },
                        lightingPlan: {
                            palette: "冷灰蓝",
                            colorTemperature: "5600K",
                            keyLight: "左前方柔光",
                            fillLight: "低强度环境补光",
                            rimLight: "背后冷色轮廓光",
                            contrast: "中高",
                            materialResponse: "水面微亮，衣料吸光",
                            skinToneProtection: "保留自然肤色",
                            inheritFromPrevious: "延续前镜冷雾",
                            transitionToNext: "过渡到更近景别",
                        },
                        imagePrompt: "黑湖边的写实电影感竖屏镜头，Karin 独自站立，禁止文字、水印、logo。",
                        videoPrompt: "生成15秒9:16竖屏电影级视频。Karin 在黑湖边缓慢转身，风掠过水面，禁止文字、水印、logo。",
                        executionImagePrompt: "黑湖边的写实电影感竖屏镜头，Karin 独自站立，禁止文字、水印、logo。",
                        cameraMotion: "轻微推进",
                        continuity: { shotSize: "中景", cameraAngle: "平视", composition: "主体居中", characterBlocking: "单人站立", gazeDirection: "看向湖心", screenDirection: "右向左", axisRule: "180度内", continuityNotes: "保持冷雾连续" },
                        entryState: { environment: "黑湖边", lighting: "冷雾", characters: [], props: [] },
                        exitState: { environment: "黑湖边", lighting: "冷雾", characters: [], props: [] },
                        duration: 5,
                        framePlan: {
                            start: { source: "independent" },
                            end: { required: true },
                            referenceManifest: [
                                { role: "character_anchor", assetId: "character-one", purpose: "保持 Karin 的身份与服装" },
                                { role: "scene_anchor", assetId: "scene-one", purpose: "保持黑湖空间结构与光向" },
                            ],
                            frames: [
                                { id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "Karin 在湖岸停住", imagePrompt: "Karin 在湖岸停住" },
                                { id: "frame-two", sequenceIndex: 2, startSecond: 2, endSecond: 5, actionPrompt: "Karin 转身看向湖心", imagePrompt: "Karin 转身看向湖心" },
                            ],
                        },
                        storyboardFrames: [
                            { id: "frame-one", sequenceIndex: 1, source: "generated", status: "success", mediaUrl: "/frame-one.png", continuityStatus: "passed" },
                            { id: "frame-two", sequenceIndex: 2, source: "generated", status: "success", mediaUrl: "/frame-two.png", continuityStatus: "passed" },
                        ],
                        characterIds: ["character-one"],
                        propIds: [],
                        clueIds: [],
                        sceneId: "scene-one",
                        storyboardFrameMode: "all_frames",
                        videoMode: "reference",
                        audioMode: "source",
                    },
                ],
                continuityEdges: [],
            },
        ],
    };
    const unlockedProject = {
        ...seededProject,
        productionBible: {
            ...seededProject.productionBible,
            productionPlan: { ...seededProject.productionBible!.productionPlan!, lockedAt: undefined },
        },
    } as DramaProject;
    const saved = await page.request.patch(`/api/drama/projects/${project.id}`, { headers: { cookie }, data: unlockedProject });
    expect(saved.ok(), await saved.text()).toBe(true);
    const locked = await page.request.patch(`/api/drama/projects/${project.id}`, {
        headers: { cookie },
        data: { productionBible: { ...unlockedProject.productionBible, productionPlan: { ...unlockedProject.productionBible!.productionPlan!, lockedAt: "2026-01-01T00:00:00.000Z" } } },
    });
    expect(locked.ok(), await locked.text()).toBe(true);
    let productionRunCreates = 0;
    await page.route(new RegExp(`/api/drama/projects/${project.id}/production-runs$`), async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        productionRunCreates += 1;
        await route.fulfill({
            json: {
                code: 0,
                data: {
                    run: {
                        id: "run-one",
                        projectId: project.id,
                        episodeId: episode.id,
                        planRevision: "preview-e2e",
                        status: "ready",
                        mode: "strict",
                        parameterSnapshot: { imageModel: "image-e2e", videoModel: "video-e2e", imageQuality: "standard", videoQuality: "720", ratio: "9:16" },
                        steps: [],
                        preflightSnapshot: { checkedShotIds: ["shot-one"], issues: [], changeSummary: [], prompts: {} },
                        createdAt: "2026-01-01T00:00:00.000Z",
                        updatedAt: "2026-01-01T00:00:00.000Z",
                    },
                },
                msg: "连续性生产计划已锁定",
            },
        });
    });
    let preflightCalls = 0;
    await page.route("**/api/drama/preflight", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        preflightCalls += 1;
        await route.fulfill({ json: { code: 0, data: { preflight: { status: "passed", issues: [], revisedPrompts: {}, changeSummary: [] } }, msg: "OK" } });
    });

    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "切换到镜头生成" }).click();
    const generationPanel = page.locator("[data-drama-generation-panel]");
    await expect(generationPanel).toBeVisible();
    await expect(generationPanel.getByRole("button", { name: "生成镜头" })).toBeVisible();
    await generationPanel.getByRole("button", { name: "生成镜头" }).click();

    const previewDialog = page.getByRole("dialog", { name: "确认生成 1 个镜头" });
    await expect(previewDialog).toBeVisible();
    expect(preflightCalls).toBe(0);
    expect(effectCleanupErrors).toEqual([]);
    await expect(previewDialog.getByText("清晰度：", { exact: false })).toBeVisible();
    await expect(previewDialog.getByText("动态意图：", { exact: false })).toBeVisible();
    await expect(previewDialog.getByText("时间段动作：", { exact: false })).toBeVisible();
    await expect(previewDialog.getByText("实际参考图绑定（编号与本次请求图片数组完全一致）", { exact: false })).toBeVisible();
    await expect(previewDialog.getByText("@图片1：顺序帧 1", { exact: false })).toBeVisible();
    await expect(previewDialog.getByText("@图片3：场景 · 黑湖", { exact: false })).toBeVisible();
    const referenceGallery = previewDialog.locator("[data-drama-prompt-reference-gallery]");
    await expect(referenceGallery).toBeVisible();
    await expect(referenceGallery.getByRole("img")).toHaveCount(4);
    await expect(referenceGallery.getByText("@图片1", { exact: true })).toBeVisible();
    await expect(referenceGallery.getByText("@图片4", { exact: true })).toBeVisible();
    await expect(referenceGallery.getByRole("img", { name: "顺序帧 1" })).toBeVisible();
    await expect(referenceGallery.getByRole("img", { name: "角色 · Karin" })).toBeVisible();
    await expect(previewDialog.getByText("生成15秒", { exact: false })).toHaveCount(0);
    await expect(previewDialog.getByText("角色设定：", { exact: false })).toHaveCount(0);
    await expect(previewDialog.getByText("确认后才会创建视频任务并消耗额度", { exact: false })).toBeVisible();
    await expect(generationPanel.getByRole("button", { name: "生成镜头" })).toBeVisible();
    expect(productionRunCreates).toBe(0);

    await previewDialog.getByRole("button", { name: "返回修改" }).click();
    await generationPanel.getByRole("button", { name: "检查生成条件" }).click();
    await expect.poll(() => preflightCalls).toBe(1);
    await expect(page.getByText("生成前检查已通过", { exact: true })).toBeVisible();

    await generationPanel.getByRole("button", { name: "生成镜头" }).click();
    const reopenedPreviewDialog = page.getByRole("dialog", { name: "确认生成 1 个镜头" });
    await reopenedPreviewDialog.getByRole("button", { name: "确认生成" }).click();
    await expect(reopenedPreviewDialog).toBeHidden();
    expect(productionRunCreates).toBe(1);
});

test("drama shot prompt optimization is available from the Agent menu and persists the result", async ({ page }) => {
    const adminState = JSON.parse(readFileSync(".e2e-data/admin-state.json", "utf8")) as { cookies: Array<{ name: string; value: string }> };
    const cookie = adminState.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
    const created = await page.request.post("/api/drama/projects", { headers: { cookie }, data: { title: "E2E 提示词优化菜单", summary: "验证镜头菜单的提示词优化", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const episode = project.episodes[0];
    const shot = {
        id: "optimize-shot",
        code: "SH01",
        order: 1,
        title: "提示词优化镜头",
        description: "人物在湖边抬头",
        sourceText: "人物在湖边抬头。",
        shotBoundary: "湖边中景",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: "湖边中景，人物站立",
        videoPrompt: "人物在湖边抬头，镜头缓慢推进",
        generationStatus: "idle",
        storyboardStatus: "idle",
        audioMode: "source",
        audioStatus: "idle",
        characterIds: [],
        propIds: [],
        clueIds: [],
        duration: 5,
        storyboardFrameMode: "single",
        videoMode: "reference",
    };
    const seeded = {
        ...project,
        episodes: project.episodes.map((item) => (item.id === episode.id ? { ...item, reviewStatus: "visual_ready", shots: [shot] } : item)),
    } as DramaProject;
    const saved = await page.request.patch(`/api/drama/projects/${project.id}`, { headers: { cookie }, data: seeded });
    expect(saved.ok(), await saved.text()).toBe(true);

    let optimizationBody: { phase?: string; shots?: Array<{ id?: string }>; referenceMaterials?: unknown[] } = {};
    await page.route(/\/api\/drama\/analyze$/, async (route) => {
        optimizationBody = (await route.request().postDataJSON()) as typeof optimizationBody;
        await route.fulfill({ json: { code: 0, data: { shots: [{ shotId: "optimize-shot", videoPrompt: "动态意图：优化后的镜头视频提示词" }] }, msg: "OK" } });
    });

    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "切换到镜头生成" }).click();
    const row = page.locator("[data-drama-shot-task]").filter({ hasText: "提示词优化镜头" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "打开 Agent 创作操作" }).click();
    const optimizeItem = page.getByRole("menuitem", { name: "提示词优化" });
    await expect(optimizeItem).toBeVisible();
    await expect(optimizeItem).not.toHaveAttribute("aria-disabled", "true");
    const saveRequest = page.waitForRequest((request) => request.method() === "PATCH" && request.url().includes(`/episodes/${episode.id}/shots/optimize-shot/prompt`));
    await optimizeItem.click();
    await expect.poll(() => optimizationBody.phase).toBe("video_prompt");
    await expect.poll(() => optimizationBody.shots?.[0]?.id).toBe("optimize-shot");
    const patchRequest = await saveRequest;
    expect(patchRequest.postDataJSON()).toMatchObject({ executionVideoPrompt: "优化后的镜头视频提示词" });
    await expect(page.getByText("提示词已优化并保存", { exact: true })).toBeVisible();

    const persisted = ((await (await page.request.get(`/api/drama/projects/${project.id}`, { headers: { cookie } })).json()) as { data: { project: DramaProject } }).data.project;
    expect(persisted.episodes[0].shots[0].executionVideoPrompt).toBe("优化后的镜头视频提示词");
});

test("drama execution prompt saves through its scoped shot endpoint", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 执行提示词保存", summary: "验证镜头级保存", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const episode = project.episodes[0];
    const shot = {
        id: "execution-prompt-shot",
        code: "SH01",
        order: 1,
        title: "执行提示词保存镜头",
        description: "人物在黑湖边抬眼。",
        sourceText: "人物在黑湖边抬眼。",
        shotBoundary: "黑湖边中景",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: "黑湖边中景，人物站立",
        videoPrompt: "人物在黑湖边抬眼，镜头缓慢推进",
        generationStatus: "idle",
        storyboardStatus: "idle",
        audioMode: "source",
        audioStatus: "idle",
        characterIds: [],
        propIds: [],
        clueIds: [],
        duration: 5,
        storyboardFrameMode: "single",
        videoMode: "reference",
    };
    const seeded = {
        ...project,
        episodes: project.episodes.map((item) => (item.id === episode.id ? { ...item, reviewStatus: "visual_ready", shots: [shot] } : item)),
    } as DramaProject;
    const seedResponse = await request.patch(`/api/drama/projects/${project.id}`, { data: seeded });
    expect(seedResponse.ok(), await seedResponse.text()).toBe(true);

    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "切换到镜头生成" }).click();
    const row = page.locator("[data-drama-shot-task]").filter({ hasText: "执行提示词保存镜头" });
    await row.getByRole("button", { name: "展开详情" }).click();
    const editor = row.locator("[data-drama-shot-supplier-prompt]");
    const prompt = "动态意图：人物在黑湖边抬眼，指尖收紧断剑。\n单一主运镜：中景缓慢推进。\n结束画面：人物直视塔影。";
    await editor.locator("textarea").fill(prompt);
    await expect(editor.getByRole("button", { name: "保存" })).toBeEnabled();
    const saveRequest = page.waitForRequest((candidate) => candidate.method() === "PATCH" && candidate.url().includes(`/episodes/${episode.id}/shots/${shot.id}/prompt`));
    await editor.getByRole("button", { name: "保存" }).click();
    const patchRequest = await saveRequest;
    expect(patchRequest.postDataJSON()).toEqual({ executionVideoPrompt: prompt, executionVideoPromptOrigin: "manual" });
    await expect(page.getByText("视频提示词已保存", { exact: true })).toBeVisible();

    const persisted = ((await (await request.get(`/api/drama/projects/${project.id}`)).json()) as { data: { project: DramaProject } }).data.project;
    expect(persisted.episodes[0].shots[0]).toMatchObject({ executionVideoPrompt: prompt, fieldOrigins: { executionVideoPrompt: "manual" } });
});

test("creative workspaces remain usable without horizontal overflow in light and dark themes", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 短剧项目", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: { id: string } } }).data.project;
    const canvasCreated = await request.post("/api/canvas/projects", {
        data: {
            title: "E2E 响应式画布",
            project: {
                viewport: { x: 40, y: 100, k: 1 },
                nodes: [
                    { id: "responsive-config", type: "config", title: "生成配置", position: { x: 100, y: 100 }, width: 300, height: 220, metadata: { size: "1280x720" } },
                    { id: "responsive-image", type: "image", title: "图片", position: { x: 100, y: 350 }, width: 260, height: 200, metadata: {} },
                ],
                connections: [],
            },
        },
    });
    expect(canvasCreated.ok(), await canvasCreated.text()).toBe(true);
    const canvasProject = ((await canvasCreated.json()) as { data: { project: { id: string } } }).data.project;
    const canvasRoute = `/canvas/${canvasProject.id}`;
    const dramaRoute = `/drama/${project.id}`;

    await page.goto("/drama", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "新建短剧" }).click();
    const createDialog = page.getByRole("dialog", { name: "新建短剧项目" });
    await expect(createDialog).toBeVisible();
    const dialogBox = await createDialog.boundingBox();
    const ratioLabelBox = await createDialog.getByText("生成尺寸", { exact: true }).boundingBox();
    const ratioControlBox = await createDialog.locator(".ant-segmented").boundingBox();
    expect(dialogBox?.width || 0).toBeLessThanOrEqual(Math.min(522, (page.viewportSize()?.width || 0) - 22));
    expect((ratioLabelBox?.y || 0) + (ratioLabelBox?.height || 0)).toBeLessThanOrEqual((ratioControlBox?.y || 0) + 1);
    await createDialog.getByRole("button", { name: /取\s*消/ }).click();
    const projectEntry = page.locator(`a[href="${dramaRoute}"]`);
    await expect(projectEntry).toHaveAttribute("aria-label", "进入短剧项目：E2E 短剧项目");
    await projectEntry.click();
    await expect(page).toHaveURL(new RegExp(`/drama/${project.id}$`));

    const routes = ["/create", "/canvas", canvasRoute, dramaRoute];

    for (const route of routes) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible();
        if (route.startsWith("/drama/")) {
            const dramaWorkspace = page.locator("[data-drama-workspace]");
            await expect(dramaWorkspace).toBeVisible();
            await expect(page.locator(".workspace-shell")).toHaveCount(0);
            await expect(page.getByLabel("短剧项目名称").first()).toHaveValue("E2E 短剧项目");
            await expect(page.locator("[data-drama-workspace-header]")).toHaveCount(1);
            await expect(page.locator("[data-drama-stage-navigation]")).toHaveCount(1);
            await page.getByRole("button", { name: "完整制作包", exact: true }).click();
            const packageDialog = page.getByRole("dialog", { name: "导入完整制作包" });
            await expect(packageDialog).toBeVisible();
            await expect(packageDialog.getByRole("button", { name: "选择制作包文件" })).toBeVisible();
            await expect(packageDialog.getByRole("button", { name: "下载制作包模板" })).toBeVisible();
            await expect(packageDialog.getByRole("textbox", { name: "粘贴制作包文本" })).toBeVisible();
            const packageDialogBox = await packageDialog.boundingBox();
            expect(packageDialogBox?.width || 0).toBeLessThanOrEqual((page.viewportSize()?.width || 0) - 22);
            await packageDialog.getByRole("button", { name: /取\s*消/ }).click();
            const workspaceBody = page.locator("[data-drama-workspace-body]");
            const productionSurface = page.locator("[data-drama-production-surface]");
            const closedLayout = await Promise.all([workspaceBody.boundingBox(), productionSurface.boundingBox()]);
            const desktopWide = (page.viewportSize()?.width || 0) >= 1366;
            if (desktopWide) {
                const sidebar = page.locator("[data-drama-episode-sidebar]");
                await expect(sidebar).toBeVisible();
                const sidebarBox = await sidebar.boundingBox();
                expect(Math.round(sidebarBox?.width || 0)).toBe(226);
                expect((sidebarBox?.x || 0) + (sidebarBox?.width || 0)).toBeLessThanOrEqual((closedLayout[1]?.x || 0) + 1);
                await expect(page.getByPlaceholder("搜索集数")).toBeVisible();
                await expect(page.getByText("新建集数", { exact: true })).toBeVisible();
                if ((page.viewportSize()?.width || 0) >= 1600) {
                    await expect(page.locator("[data-drama-script-workspace]")).toBeVisible();
                    const columns = await page.locator("[data-drama-script-workspace]").evaluate((element) => {
                        const targets = ["[data-drama-scene-structure]", "[data-drama-script-editor]", "[data-drama-episode-settings]"];
                        return targets.map((selector) => {
                            const rect = element.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
                            return rect ? { left: Math.round(rect.left), width: Math.round(rect.width) } : null;
                        });
                    });
                    expect(columns.every(Boolean)).toBe(true);
                    expect(columns[0]?.width).toBeGreaterThanOrEqual(200);
                    expect(columns[2]?.width).toBeGreaterThanOrEqual(280);
                    expect(columns[1]?.width).toBeGreaterThan(320);
                }
            } else {
                expect(Math.abs((closedLayout[0]?.x || 0) - (closedLayout[1]?.x || 0))).toBeLessThanOrEqual(1);
                expect(Math.abs((closedLayout[0]?.width || 0) - (closedLayout[1]?.width || 0))).toBeLessThanOrEqual(1);
            }

            await page.getByRole("button", { name: "打开项目资产" }).click();
            await expect(page.locator("[data-drama-assets-library]")).toBeVisible();
            await expect(page.getByRole("button", { name: "新建角色" })).toBeVisible();
            await page.getByRole("button", { name: "新建角色" }).click();
            const assetDrawer = page.getByRole("dialog", { name: "新建角色" });
            await expect(assetDrawer).toBeVisible();
            await expectDialogWithinViewport(assetDrawer);
            await assetDrawer.getByRole("button", { name: /取\s*消/ }).click();

            await page.getByRole("button", { name: "切换到内容审核" }).click();
            await expect(page.getByRole("heading", { name: "内容审核" })).toBeVisible();

            await page.getByRole("button", { name: "切换到镜头生成" }).click();
            await expect(page.getByRole("heading", { name: "镜头生成" })).toBeVisible();
            await expect(page.locator("[data-drama-generation-readiness]")).toBeVisible();
            await expect(page.locator("[data-drama-generation-panel]")).toBeVisible();
            const generationLayout = await page.locator("[data-drama-generation-panel]").evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
            expect(generationLayout.scrollWidth).toBeLessThanOrEqual(generationLayout.clientWidth + 1);
            const visualPlan = page.locator("[data-drama-visual-plan]");
            await visualPlan.getByRole("button", { name: "生成视觉计划" }).click();
            const confirmVisualPlan = visualPlan.getByRole("button", { name: /确认执行/ });
            await expect(confirmVisualPlan).toBeVisible();
            await confirmVisualPlan.click();
            await expect(page.getByText("确认执行视觉计划？", { exact: true })).toBeVisible();
            await page
                .getByRole("button", { name: /取\s*消/ })
                .last()
                .click();
            await expect(page.getByText("确认执行视觉计划？", { exact: true })).toBeHidden();
            await expectNoHorizontalOverflow(page, `${dramaRoute} visual plan`);

            if ((page.viewportSize()?.width || 0) < 1366) {
                await page.getByRole("button", { name: "打开剧集导航" }).click();
                const episodeNavigation = page.getByRole("dialog", { name: "集数管理" });
                await expect(episodeNavigation).toBeVisible();
                await expectDialogWithinViewport(episodeNavigation);
                await episodeNavigation.getByRole("button", { name: "收起集数管理" }).click();
                await expect(episodeNavigation).toBeHidden();
            } else {
                const episodeSidebar = page.locator("[data-drama-episode-sidebar]");
                await expect(episodeSidebar).toBeVisible();
                const beforeCollapse = await Promise.all([workspaceBody.boundingBox(), productionSurface.boundingBox()]);
                await page.getByRole("button", { name: "收起剧集导航" }).click();
                await expect(episodeSidebar).toBeHidden();
                const afterCollapse = await Promise.all([workspaceBody.boundingBox(), productionSurface.boundingBox()]);
                expect(afterCollapse[1]?.x || 0).toBeLessThanOrEqual(beforeCollapse[1]?.x || 0);
                expect(afterCollapse[1]?.width || 0).toBeGreaterThan(beforeCollapse[1]?.width || 0);
                await page.getByRole("button", { name: "打开剧集导航" }).click();
                await expect(page.locator("[data-drama-episode-sidebar]")).toBeVisible();
            }

            await page.getByRole("button", { name: "打开项目 Agent" }).click();
            let agentSurface: Locator;
            if ((page.viewportSize()?.width || 0) >= 1280) {
                const agentPanel = page.getByRole("complementary", { name: "项目 Agent 面板" });
                await expect(agentPanel).toBeVisible();
                const contentBox = await productionSurface.boundingBox();
                const agentBox = await agentPanel.boundingBox();
                expect((contentBox?.x || 0) + (contentBox?.width || 0)).toBeLessThanOrEqual((agentBox?.x || 0) + 1);
                agentSurface = agentPanel;
            } else {
                const agentDrawer = page.getByRole("dialog", { name: "项目 Agent" });
                await expect(agentDrawer).toBeVisible();
                await expectDialogWithinViewport(agentDrawer);
                agentSurface = agentDrawer;
            }
            const quickActions = agentSurface.locator("[data-drama-agent-quick-actions]");
            await expect(quickActions).toBeVisible();
            const quickLayout = await quickActions.evaluate((element) => {
                const buttons = [...element.querySelectorAll<HTMLElement>("button")];
                const bounds = element.getBoundingClientRect();
                return {
                    display: getComputedStyle(element).display,
                    columns: [...new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().left)))],
                    inside: buttons.every((button) => {
                        const rect = button.getBoundingClientRect();
                        return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
                    }),
                    clientWidth: element.clientWidth,
                    scrollWidth: element.scrollWidth,
                };
            });
            expect(quickLayout.display).toBe("block");
            expect(quickLayout.columns).toHaveLength(1);
            expect(quickLayout.inside).toBe(true);
            expect(quickLayout.scrollWidth).toBeLessThanOrEqual(quickLayout.clientWidth + 1);
            await agentSurface.getByRole("button", { name: "打开本阶段 Agent 建议" }).click();
            const stageSuggestionMenu = page.getByRole("menu");
            await expect(stageSuggestionMenu).toBeVisible();
            await expect(stageSuggestionMenu.getByRole("menuitem")).toHaveCount(4);
            await page.keyboard.press("Escape");
            await agentSurface.getByRole("button", { name: "收起项目 Agent" }).click();
            await expect(page.getByRole("button", { name: "打开项目 Agent", exact: true })).toBeVisible();
        }
        if (route === canvasRoute) {
            await expect(page.locator("[data-canvas-surface]")).toHaveCSS("background-color", "rgb(255, 255, 255)");
            if ((page.viewportSize()?.width || 0) <= 768) {
                await page.getByRole("button", { name: "打开 Agent", exact: true }).click();
                const agentPanel = page.getByLabel("Canvas Agent 对话面板");
                await expect(agentPanel).toBeVisible();
                await expect.poll(async () => Math.round((await agentPanel.boundingBox())?.width || 0)).toBe(page.viewportSize()?.width || 0);
                await expect(page.getByPlaceholder("描述你想让 Agent 如何操作画布")).toBeVisible();
                await expectNoHorizontalOverflow(page, `${route} Agent`);
                await page.getByRole("button", { name: "收起 Agent 面板" }).click();
            }
            await page.locator('[data-node-id="responsive-config"]').click({ position: { x: 32, y: 32 } });
            await expect.poll(() => page.locator('[contenteditable="true"]').evaluate((element) => document.activeElement === element)).toBe(true);
            await page.getByRole("button", { name: "关闭提示词组装" }).click();
            await page.locator('[data-node-id="responsive-image"]').click({ position: { x: 32, y: 32 } });
            await page.getByRole("button", { name: "放大提示词输入" }).click();
            const promptDialog = page.getByRole("dialog", { name: "编辑提示词" });
            await expect(promptDialog).toBeVisible();
            await expectDialogWithinViewport(promptDialog);
            await expect.poll(() => promptDialog.getByRole("textbox", { name: "提示词编辑器" }).evaluate((element) => document.activeElement === element)).toBe(true);
            await promptDialog.getByRole("button", { name: "收起提示词输入" }).click();
            await page.getByRole("button", { name: "切换到框选模式" }).click();
            await expect(page.locator("[data-canvas-surface]")).toHaveAttribute("data-canvas-interaction-mode", "select");
            await page.getByRole("button", { name: "切换到小手模式" }).click();
            await expect(page.locator("[data-canvas-surface]")).toHaveAttribute("data-canvas-interaction-mode", "pan");
        }
        await expectNoHorizontalOverflow(page, route);
    }

    await page.addInitScript(() => {
        localStorage.setItem("vozeb-pro:theme_store", JSON.stringify({ state: { theme: "dark" }, version: 0 }));
    });
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectNoHorizontalOverflow(page, "/create dark");
    await page.goto(canvasRoute, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-canvas-surface]")).toHaveCSS("background-color", "rgb(9, 11, 16)");
    await expectNoHorizontalOverflow(page, `${canvasRoute} dark`);
    await page.goto(dramaRoute, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("[data-drama-workspace]")).toBeVisible();
    await expect(page.locator(".workspace-shell")).toHaveCount(0);
    await expectNoHorizontalOverflow(page, `${dramaRoute} dark`);
});

test("admin user editor groups permission controls and keeps the footer visible", async ({ page }, testInfo) => {
    await page.goto("/admin?section=users", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "用户管理" })).toBeVisible();

    const adminRow = page.getByRole("row").filter({ hasText: "@e2e_admin" });
    await expect(adminRow).toBeVisible();
    await adminRow.getByRole("button", { name: "管理", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: /用户管理/ });
    await expect(dialog).toBeVisible();
    await expectDialogWithinViewport(dialog);

    const layout = await dialog.evaluate((element) => {
        const bounds = (target: Element | null) => {
            const rect = target?.getBoundingClientRect();
            return rect ? { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom) } : null;
        };
        const body = element.querySelector<HTMLElement>(".ant-modal-body");
        const footer = element.querySelector<HTMLElement>(".ant-modal-footer");
        const grid = element.querySelector<HTMLElement>("[data-admin-permission-grid]");
        const groups = [...element.querySelectorAll<HTMLElement>("[data-admin-permission-group]")];
        return {
            columns: [...new Set(groups.map((group) => Math.round(group.getBoundingClientRect().left)))],
            gridDisplay: grid ? getComputedStyle(grid).display : null,
            groups: groups.map((group) => {
                const rect = group.getBoundingClientRect();
                const items = [...group.querySelectorAll<HTMLElement>("[data-admin-permission-item]")].map((item) => bounds(item));
                return { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), width: Math.round(rect.width), items };
            }),
            bodyScrollable: Boolean(body && body.scrollHeight > body.clientHeight),
            dialog: bounds(element),
            footer: bounds(footer),
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
        };
    });

    const mobile = testInfo.project.name.startsWith("mobile-");
    expect(layout.columns).toHaveLength(mobile ? 1 : 2);
    expect(layout.gridDisplay).toBe("grid");
    if (mobile) {
        expect(layout.groups.every((group) => group.left === layout.groups[0]?.left)).toBe(true);
    } else {
        for (const row of [layout.groups.slice(0, 2), layout.groups.slice(2, 4)]) {
            expect(new Set(row.map((group) => group.top)).size).toBe(1);
            expect(row.map((group) => group.left)).toEqual(layout.columns);
            expect(Math.max(...row.map((group) => group.width)) - Math.min(...row.map((group) => group.width))).toBeLessThanOrEqual(1);
        }
    }
    for (const group of layout.groups) {
        expect(group.items.length).toBeGreaterThan(0);
        expect(group.items.every((item) => item && item.left >= group.left && item.right <= group.right)).toBe(true);
    }
    expect(layout.bodyScrollable).toBe(true);
    expect(layout.dialog?.left).toBeGreaterThanOrEqual(0);
    expect(layout.dialog?.right).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(layout.footer?.top).toBeGreaterThanOrEqual(0);
    expect(layout.footer?.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth + 1);

    const analyticsPermission = dialog.getByRole("checkbox", { name: /经营分析/ });
    const initiallyChecked = await analyticsPermission.isChecked();
    await analyticsPermission.click();
    expect(await analyticsPermission.isChecked()).toBe(!initiallyChecked);
    await analyticsPermission.click();
    expect(await analyticsPermission.isChecked()).toBe(initiallyChecked);
});

test("conversation and Canvas deletion stay deleted after refresh", async ({ page, request }) => {
    const suffix = randomUUID().slice(0, 8);
    const conversationTitles = [`删除回归 A ${suffix}`, `删除回归 B ${suffix}`, `删除回归 C ${suffix}`];
    const conversations = await Promise.all(
        conversationTitles.map(async (title) => {
            const response = await request.post("/api/creative/conversations", { data: { surface: "chat", source: "agent", title } });
            expect(response.ok(), await response.text()).toBe(true);
            return ((await response.json()) as { data: { conversation: { id: string } } }).data.conversation;
        }),
    );

    await page.goto(`/create?conversationId=${encodeURIComponent(conversations[0].id)}`, { waitUntil: "domcontentloaded" });
    let historyDialog = await openCreativeHistory(page);
    await expect(historyDialog.getByText(conversationTitles[0], { exact: true })).toBeVisible();
    await historyDialog.getByText(conversationTitles[0], { exact: true }).hover();
    await historyDialog.getByRole("button", { name: `管理${conversationTitles[0]}` }).click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    const conversationDialog = page.getByRole("dialog", { name: "删除这条对话？" });
    await expect(conversationDialog).toContainText("永久删除消息、生成记录");
    await expectDialogWithinViewport(conversationDialog);
    await conversationDialog.getByRole("button", { name: /删\s*除/ }).click();
    await expect(historyDialog.getByText(conversationTitles[0], { exact: true })).toBeHidden();
    expect((await request.get(`/api/creative/conversations/${conversations[0].id}`)).status()).toBe(404);

    await historyDialog.getByRole("button", { name: "批量管理" }).click();
    await historyDialog.getByRole("checkbox", { name: `选择${conversationTitles[1]}` }).check();
    await historyDialog.getByRole("checkbox", { name: `选择${conversationTitles[2]}` }).check();
    await historyDialog.getByRole("button", { name: "批量删除" }).click();
    const batchDialog = page.getByRole("dialog", { name: "删除 2 条对话？" });
    await expectDialogWithinViewport(batchDialog);
    await batchDialog.getByRole("button", { name: /删\s*除/ }).click();
    await expect(batchDialog).toBeHidden();
    await expect(historyDialog.getByText(conversationTitles[1], { exact: true })).toBeHidden();
    await expect(historyDialog.getByText(conversationTitles[2], { exact: true })).toBeHidden();
    await page.reload({ waitUntil: "domcontentloaded" });
    historyDialog = await openCreativeHistory(page);
    for (const title of conversationTitles) await expect(historyDialog.getByText(title, { exact: true })).toHaveCount(0);

    const canvasTitle = `删除画布回归 ${suffix}`;
    const canvasResponse = await request.post("/api/canvas/projects", { data: { title: canvasTitle, project: { nodes: [], connections: [] } } });
    expect(canvasResponse.ok(), await canvasResponse.text()).toBe(true);
    const canvasProject = ((await canvasResponse.json()) as { data: { project: { id: string; creativeConversationId: string } } }).data.project;
    await page.goto("/canvas", { waitUntil: "domcontentloaded" });
    const canvasCard = page.locator("article").filter({ hasText: canvasTitle });
    await expect(canvasCard).toBeVisible();
    await canvasCard.getByLabel("删除", { exact: true }).click();
    const canvasDialog = page.getByRole("dialog", { name: "删除画布？" });
    await expect(canvasDialog).toContainText("永久删除 1 个画布");
    await expectDialogWithinViewport(canvasDialog);
    await canvasDialog.getByRole("button", { name: /删\s*除/ }).click();
    await expect(canvasCard).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(canvasTitle, { exact: true })).toHaveCount(0);
    expect((await request.get(`/api/canvas/projects/${canvasProject.id}`)).status()).toBe(404);
    expect((await request.get(`/api/creative/conversations/${canvasProject.creativeConversationId}`)).status()).toBe(404);
});

test("eight billing plans remain dense and usable across desktop and mobile", async ({ page }, testInfo) => {
    await page.route("**/api/billing/products", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ products: billingProductsFixture(), paymentProviders: ["payply"] }),
        }),
    );
    await page.goto("/profile?section=billing", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "可选套餐" })).toBeVisible();
    await expect.poll(() => page.locator("[role='tab']").count()).toBe(8);

    const layout = await page.evaluate(() => {
        const visible = (element: Element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0;
        };
        const cards = [...document.querySelectorAll<HTMLElement>("[data-billing-plan-card]")].filter(visible);
        const tabs = [...document.querySelectorAll<HTMLElement>("[role='tab']")];
        const tabViewport = tabs[0]?.parentElement?.parentElement;
        return {
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            visibleCards: cards.length,
            cardOverflow: cards.some((card) => card.scrollWidth > card.clientWidth + 1),
            actionsOutsideCards: cards.some((card) => {
                const action = card.querySelector<HTMLElement>("[data-billing-plan-action]");
                if (!action) return true;
                const cardBounds = card.getBoundingClientRect();
                const actionBounds = action.getBoundingClientRect();
                return actionBounds.left < cardBounds.left - 1 || actionBounds.right > cardBounds.right + 1;
            }),
            tabViewportWidth: tabViewport?.clientWidth || 0,
            tabScrollWidth: tabViewport?.scrollWidth || 0,
        };
    });

    const mobile = testInfo.project.name.startsWith("mobile-");
    expect(layout.visibleCards).toBe(mobile ? 1 : 8);
    expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth + 1);
    expect(layout.cardOverflow).toBe(false);
    expect(layout.actionsOutsideCards).toBe(false);
    if (mobile) expect(layout.tabScrollWidth).toBeGreaterThan(layout.tabViewportWidth);
});

test("inspiration works fill each row before continuing down the shortest masonry column", async ({ page }, testInfo) => {
    await page.route("**/api/public/gallery?**", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ code: 0, data: { items: masonryGalleryFixture() }, msg: "OK" }),
        }),
    );
    await page.goto("/create", { waitUntil: "domcontentloaded" });

    const grid = page.locator('[aria-label="灵感作品列表"]');
    await expect(grid).toBeVisible();
    await expect(grid.locator(":scope > div")).toHaveCount(8);
    await grid.scrollIntoViewIfNeeded();
    await expect.poll(() => grid.locator('img[alt^="瀑布流测试作品"]').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);

    const viewports = testInfo.project.name === "chromium" ? [390, 430, 700, 900, 1100, 1280] : [page.viewportSize()!.width];
    for (const width of viewports) {
        await page.setViewportSize({ width, height: width < 640 ? 900 : 820 });
        const expectedColumns = width >= 1280 ? 6 : width >= 1024 ? 5 : width >= 768 ? 4 : width >= 640 ? 3 : 2;
        await expect.poll(async () => masonryLayoutIsReady(await readMasonryLayout(page), expectedColumns)).toBe(true);

        const layout = await readMasonryLayout(page);
        expect(layout.columnCount).toBe(expectedColumns);
        expect(layout.firstRowLefts).toHaveLength(expectedColumns);
        expect(new Set(layout.firstRowLefts).size).toBe(expectedColumns);
        expect(layout.firstRowLefts).toEqual([...layout.firstRowLefts].sort((left, right) => left - right));
        expect(layout.firstRowTopRange).toBeLessThanOrEqual(1);
        expect(layout.nextItemLeft).toBe(layout.shortestColumnLeft);
        expect(layout.nextItemTop).toBeGreaterThanOrEqual(layout.shortestColumnBottom - 1);
        expect(layout.nextItemTop).toBeLessThanOrEqual(layout.shortestColumnBottom + layout.rowGap * 2 + 4);
        expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth + 1);
        expect(layout.gridScrollWidth).toBeLessThanOrEqual(layout.gridClientWidth + 1);
        expect(layout.itemsInsideGrid).toBe(true);
    }
});
