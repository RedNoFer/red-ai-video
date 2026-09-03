import { expect, test } from "@playwright/test";

import type { DramaProject } from "../src/lib/drama-project-contract";
import { expectNoHorizontalOverflow } from "./responsive-helpers";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("drama all-frame editor keeps one beat per row across desktop, mobile and dark theme", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 逐帧计划", summary: "验证逐帧计划编辑器", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const episode = project.episodes[0];
    const frames = Array.from({ length: 4 }, (_, index) => ({
        id: `beat-${index + 1}`,
        sequenceIndex: index + 1,
        startSecond: index * 2,
        endSecond: (index + 1) * 2,
        actionPrompt: `动作 ${index + 1}`,
        imagePrompt: `画面 ${index + 1}，保持人物、服装、场景和光向连续`,
    }));
    const seeded: DramaProject = {
        ...project,
        defaultVideoMode: "storyboard",
        activeEpisodeId: episode.id,
        episodes: [
            {
                ...episode,
                reviewStatus: "visual_ready",
                continuityEdges: [],
                shots: [
                    {
                        id: "shot-frame-sequence",
                        code: "SH001",
                        order: 1,
                        title: "八秒连续动作",
                        description: "人物从静止到转身离开",
                        sourceText: "人物抬头、握紧道具、转身并离开。",
                        shotBoundary: "连续动作",
                        dialogue: "",
                        narration: "",
                        utterances: [],
                        imagePrompt: "竖屏中景，人物站在冷色场景中央",
                        videoPrompt: "人物完成连续动作，镜头缓慢推进",
                        cameraMotion: "缓慢推进",
                        duration: 8,
                        characterIds: [],
                        propIds: [],
                        clueIds: [],
                        videoMode: "storyboard",
                        storyboardFrameMode: "all_frames",
                        framePlan: { start: { source: "independent" }, end: { required: false }, frames },
                        storyboardFrames: frames.map((frame, index) => ({
                            id: frame.id,
                            sequenceIndex: frame.sequenceIndex,
                            source: index < 2 ? "upload" : "generated",
                            status: index < 2 ? "success" : index === 2 ? "stale" : "idle",
                            mediaUrl: index < 2 ? "/logo.svg" : undefined,
                            continuityStatus: index < 2 ? "passed" : index === 2 ? "stale" : "pending",
                        })),
                        storyboardStatus: "idle",
                        generationStatus: "idle",
                        audioMode: "source",
                        audioStatus: "idle",
                        continuityStatus: "ready",
                        fieldOrigins: { framePlan: "package" },
                    },
                ],
            },
        ],
    };
    const saved = await request.patch(`/api/drama/projects/${project.id}`, { data: seeded });
    expect(saved.ok(), await saved.text()).toBe(true);

    await page.setViewportSize({ width: 1672, height: 960 });
    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "切换到分镜" }).click();
    await page.getByRole("button", { name: "展开" }).click();
    const sequence = page.locator("[data-drama-frame-sequence]");
    await expect(sequence).toBeVisible();
    await expect(sequence.locator("[data-drama-frame-row]")).toHaveCount(4);
    await expect(page.getByRole("button", { name: "一键补齐" })).toBeVisible();
    await expect(page.getByRole("button", { name: "重新生成全部" })).toBeVisible();
    const firstFrame = sequence.locator("[data-drama-frame-row='beat-1']");
    const inspectionButton = firstFrame.getByRole("button", { name: "检验图片" });
    await expect(inspectionButton).toBeVisible();
    let inspectionRequested = false;
    await page.route(`**/api/drama/projects/${project.id}/episodes/${episode.id}/shots/shot-frame-sequence/frames/beat-1/review`, async (route) => {
        inspectionRequested = true;
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ code: 0, data: { project: seeded, review: { mode: "visual", status: "passed", summary: "当前帧符合设定", issues: [], retryTaskIds: [] } }, msg: "图片检验完成" }),
        });
    });
    await inspectionButton.click();
    await expect(page.getByText("帧 1 检验通过")).toBeVisible();
    expect(inspectionRequested).toBe(true);
    await assertVerticalRows(sequence);
    await expectNoHorizontalOverflow(page, "1672px light frame sequence");

    const secondAction = sequence.locator("[data-drama-frame-row='beat-2'] textarea").first();
    await secondAction.fill("动作 2 已人工调整");
    await expect(secondAction).toHaveValue("动作 2 已人工调整");
    await sequence.getByRole("button", { name: "在帧 2 后增加帧" }).click();
    await expect(sequence.locator("[data-drama-frame-row]")).toHaveCount(5);
    await assertVerticalRows(sequence);

    for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
        { width: 430, height: 932 },
    ]) {
        await page.setViewportSize(viewport);
        await expect(sequence).toBeVisible();
        await assertVerticalRows(sequence);
        await expectNoHorizontalOverflow(page, `${viewport.width}px light frame sequence`);
    }

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expectNoHorizontalOverflow(page, "430px dark frame sequence");
    await page.setViewportSize({ width: 1672, height: 960 });
    await expectNoHorizontalOverflow(page, "1672px dark frame sequence");
});

test("drama frame prompt lets users maintain asset references before optimization", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 手动引用资产图", summary: "验证提示词资产维护", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const episode = project.episodes[0];
    const seeded: DramaProject = {
        ...project,
        characters: [
            {
                id: "auto-character",
                name: "Agent 多引用角色",
                description: "Agent 自动引用的角色",
                primaryReferenceId: "auto-character-ref",
                references: [{ id: "auto-character-ref", url: "/auto-character.png", source: "generated", status: "approved", label: "基准图", createdAt: "2026-01-01T00:00:00.000Z" }],
            },
            {
                id: "manual-character",
                name: "未自动涉及角色",
                description: "需要人工补充的角色",
                primaryReferenceId: "manual-character-ref",
                references: [{ id: "manual-character-ref", url: "/manual-character.png", source: "generated", status: "approved", label: "基准图", createdAt: "2026-01-01T00:00:00.000Z" }],
            },
        ],
        episodes: [
            {
                ...episode,
                reviewStatus: "visual_ready",
                shots: [
                    {
                        ...episode.shots[0],
                        id: "manual-shot",
                        title: "手动引用镜头",
                        imagePrompt: "人物站在雨巷中",
                        videoPrompt: "人物抬头",
                        characterIds: ["auto-character"],
                        sceneId: undefined,
                        propIds: [],
                        clueIds: [],
                        storyboardFrameMode: "all_frames",
                        framePlan: {
                            start: { source: "independent" },
                            end: { required: false },
                            frames: [{ id: "manual-frame", sequenceIndex: 1, startSecond: 0, endSecond: 5, actionPrompt: "人物抬头", imagePrompt: "人物站在雨巷中" }],
                        },
                    },
                ],
            },
        ],
    };
    const saved = await request.patch(`/api/drama/projects/${project.id}`, { data: seeded });
    expect(saved.ok(), await saved.text()).toBe(true);

    let optimizationPrompt = "";
    await page.route(/\/api\/agent\/prompt-optimization$/, async (route) => {
        const body = (await route.request().postDataJSON()) as { prompt?: string; mode?: string };
        optimizationPrompt = body.prompt || "";
        await route.fulfill({ json: { code: 0, data: { prompt: "优化后的帧提示词" }, msg: "OK" } });
    });

    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "切换到分镜" }).click();
    await page.getByRole("button", { name: "展开" }).click();
    const sequence = page.locator("[data-drama-frame-sequence]");
    await sequence.getByRole("button", { name: "查看完整提示词" }).click();
    const promptDialog = page.getByRole("dialog", { name: "帧 1 图片提示词" });
    await expect(promptDialog).toBeVisible();
    const autoReference = promptDialog.getByRole("button", { name: /查看提示词引用图片.*Agent 多引用角色/ });
    await expect(autoReference).toBeVisible();
    await promptDialog.getByRole("button", { name: /取消引用.*Agent 多引用角色/ }).click();
    await expect(autoReference).toBeHidden();
    await promptDialog.getByRole("button", { name: "手动引用资产图" }).click();
    const picker = page.getByRole("dialog", { name: "手动引用资产图" });
    await expect(picker).toBeVisible();
    for (const viewport of [
        { width: 390, height: 844 },
        { width: 430, height: 932 },
    ]) {
        await page.setViewportSize(viewport);
        await expect(picker).toBeVisible();
        await expectNoHorizontalOverflow(page, `${viewport.width}px manual asset picker`);
    }
    const assetCard = picker.getByRole("button", { name: /未自动涉及角色/ });
    await expect(assetCard).toHaveAttribute("aria-pressed", "false");
    await assetCard.click();
    await expect(assetCard).toHaveAttribute("aria-pressed", "true");
    await picker.getByRole("button", { name: "保存引用" }).click();
    await expect(picker).toBeHidden();
    await expect(promptDialog.getByRole("button", { name: /查看提示词引用图片.*未自动涉及角色/ })).toBeVisible();

    const editedPrompt = [
        "静态关键帧：用户保存后的雨巷画面",
        "可见状态：人物抬头并握紧断剑",
        "可见表演状态：眉眼紧绷，视线锁定巷口",
        "景别：中景",
        "机位与构图：平视，主体位于画面中央",
        "站位与视线：人物站在雨巷右侧，视线落向巷口",
        "三层空间：前景为湿润石墙，中景承载人物与断剑，背景交代雨巷纵深",
        "光色与风格：冷色侧光，半写实动漫幻想风",
        "负面约束：无字幕、无水印、无logo、无HUD、无额外主体、无额外肢体、无变形",
    ].join("\n");
    await promptDialog.getByRole("textbox").fill(editedPrompt);
    const saveRequest = page.waitForRequest((request) => request.method() === "PATCH" && request.url().includes(`/frames/manual-frame/prompt`));
    await promptDialog.getByRole("button", { name: "保存提示词" }).click();
    await saveRequest;
    await expect(promptDialog).toBeHidden();

    await sequence.getByRole("button", { name: "查看完整提示词" }).click();
    await expect(page.getByRole("dialog", { name: "帧 1 图片提示词" }).getByRole("textbox")).toHaveValue(/用户保存后的雨巷画面/);
    const persisted = ((await (await request.get(`/api/drama/projects/${project.id}`)).json()) as { data: { project: DramaProject } }).data.project;
    expect(persisted.episodes[0].shots[0].framePlan?.frames[0].supplierPrompt).toContain("用户保存后的雨巷画面");

    await promptDialog.getByRole("button", { name: "提示词优化" }).click();
    await expect(promptDialog.getByRole("textbox")).toHaveValue(/优化后的帧提示词/);
    expect(optimizationPrompt).toContain("未自动涉及角色");
    expect(optimizationPrompt).not.toContain("Agent 多引用角色");
    expect(optimizationPrompt).toContain("实际参考图绑定");
});

async function assertVerticalRows(sequence: import("@playwright/test").Locator) {
    const boxes = await sequence.locator("[data-drama-frame-row]").evaluateAll((rows) =>
        rows.map((row) => {
            const box = row.getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth };
        }),
    );
    expect(boxes.every((box, index) => index === 0 || box.top >= boxes[index - 1].bottom)).toBe(true);
    expect(boxes.every((box) => box.scrollWidth <= box.clientWidth + 1 && box.right > box.left)).toBe(true);
}
