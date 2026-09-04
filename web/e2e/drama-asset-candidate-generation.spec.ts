import { expect, test } from "@playwright/test";

import { applyChannelProtocol } from "../src/lib/channel-protocol-registry";
import type { DramaProject } from "../src/lib/drama-project-contract";
import { e2eSettingsPatch, protocolFixtureState, resetProtocolFixture } from "./support";

const REFERENCE_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGPQq/3/H4QZYAwAWewKpRUlAtEAAAAASUVORK5CYII=";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("生成候选通过真实图片任务链路完成", async ({ page, request }) => {
    await resetProtocolFixture(request);
    const settings = await request.patch("/api/admin/settings", { data: sub2ApiImageSettingsPatch() });
    expect(settings.ok(), await settings.text()).toBe(true);

    const created = await request.post("/api/drama/projects", { data: { title: "E2E 真实候选生成", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const characterId = "character-real-candidate-e2e";
    const saved = await request.patch(`/api/drama/projects/${project.id}`, {
        data: {
            ...project,
            characters: [
                {
                    id: characterId,
                    name: "真实候选角色",
                    description: "一名需要保持身份一致的暗黑学院青年角色",
                    profile: { visualIdentity: "黑发青年，黑金学院长袍，完整全身设定图" },
                    references: [],
                },
            ],
        },
    });
    expect(saved.ok(), await saved.text()).toBe(true);

    const pageErrors: string[] = [];
    let submittedPrompt = "";
    let submittedSize = "";
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route(/\/api\/agent\/prompt-optimization$/, (route) =>
        route.fulfill({
            json: {
                code: 0,
                data: {
                    prompt: "主体与资产类型：角色\n身份/结构锚点：固定黑发与黑金学院长袍。\n可见状态与材质：三视图均为完整全身立姿。\n构图与画幅：9:16，纯白色无缝背景，正面、侧面、背面等距水平排列，侧面固定为左侧。\n光色与风格：角色本体保持半写实动漫幻想材质。\n用途：短剧角色基准板。\n负面约束：无主立绘、无肖像特写、无表情组、无文字、无水印。",
                },
                msg: "OK",
            },
        }),
    );
    await page.route(/\/api\/image-tasks$/, async (route) => {
        if (route.request().method() === "POST") {
            const body = route.request().postDataJSON() as { prompt?: unknown; config?: { size?: unknown } };
            submittedPrompt = typeof body.prompt === "string" ? body.prompt : "";
            submittedSize = typeof body.config?.size === "string" ? body.config.size : "";
        }
        await route.fallback();
    });
    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "打开项目资产" }).click();
    await page.getByRole("button", { name: "编辑角色：真实候选角色" }).click();
    const drawer = page.getByRole("dialog", { name: "编辑角色" });
    await drawer.getByRole("button", { name: "提示词优化" }).click();
    await expect(drawer.getByText("已优化提示词（生成候选将使用）")).toBeVisible();
    await drawer.getByRole("button", { name: "生成候选" }).click();

    await expect(page.getByText(/已生成 1 张候选图/)).toBeVisible({ timeout: 90_000 });
    expect(pageErrors).not.toContain("Maximum call stack size exceeded");
    await expect(drawer.locator('img[alt="AI 候选图"]')).toHaveCount(1);
    await drawer.getByRole("button", { name: "确认主基准" }).click();
    await expect(drawer.getByRole("button", { name: "已审核基准" })).toBeVisible();
    const primaryPreview = drawer.locator("[data-drama-primary-preview]");
    await expect(primaryPreview).toBeVisible();
    const previewBox = await primaryPreview.boundingBox();
    expect(previewBox?.width).toBeGreaterThan(0);
    expect(previewBox?.height).toBeGreaterThan(0);
    await expect(primaryPreview.locator('img[alt="真实候选角色基准图"]')).toHaveAttribute("src", /format=webp/);
    await expect(drawer.locator('img[alt="真实候选角色基准图"]')).toHaveCount(1);
    await expect(drawer.getByText("待补基准图")).toHaveCount(0);
    await drawer.getByRole("button", { name: "保存设定" }).click();
    await expect(drawer).toHaveCount(0);
    await page.getByRole("button", { name: "编辑角色：真实候选角色" }).click();
    const reopenedDrawer = page.getByRole("dialog", { name: "编辑角色" });
    await expect(reopenedDrawer.locator('img[alt="真实候选角色基准图"]')).toHaveCount(1);
    await expect(reopenedDrawer.getByText("待补基准图")).toHaveCount(0);

    const reloaded = await request.get(`/api/drama/projects/${project.id}`);
    expect(reloaded.ok(), await reloaded.text()).toBe(true);
    const reloadedProject = ((await reloaded.json()) as { data: { project: DramaProject } }).data.project;
    const character = reloadedProject.characters.find((item) => item.id === characterId);
    expect(character?.references?.find((item) => item.id === character.primaryReferenceId)).toMatchObject({ status: "approved", url: expect.stringContaining("/api/") });

    const fixture = await protocolFixtureState(request);
    const imageRequest = fixture.requests.find((item) => item.method === "POST" && item.path.endsWith("/images/generations"));
    expect(imageRequest).toBeTruthy();
    expect(submittedPrompt).toContain("主体与资产类型：角色");
    expect(submittedPrompt).toContain("纯白色无缝背景");
    expect(submittedPrompt).toContain("正面、侧面、背面");
    expect(submittedPrompt).toContain("侧面固定为左侧");
    expect(submittedSize).toBe("16:9");
});

test("生成调整候选通过历史方案链路完成", async ({ page, request }) => {
    await resetProtocolFixture(request);
    const settings = await request.patch("/api/admin/settings", { data: sub2ApiImageSettingsPatch() });
    expect(settings.ok(), await settings.text()).toBe(true);

    const created = await request.post("/api/drama/projects", { data: { title: "E2E 调整候选生成", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const uploaded = await request.post("/api/reference-assets", {
        data: {
            dataUrl: REFERENCE_DATA_URL,
            type: "image",
            persistent: true,
            originalName: "reference-refinement-e2e.png",
        },
    });
    expect(uploaded.ok(), await uploaded.text()).toBe(true);
    const uploadedAsset = (await uploaded.json()) as { url: string; key?: string };
    expect(uploadedAsset.url).toContain("/api/reference-assets/");
    const saved = await request.patch(`/api/drama/projects/${project.id}`, {
        data: {
            ...project,
            characters: [
                {
                    id: "character-refinement-candidate-e2e",
                    name: "历史方案角色",
                    description: "一名需要按历史调整方案重新生成的暗黑学院青年角色",
                    profile: { visualIdentity: "黑发青年，黑金学院长袍，完整全身设定图" },
                    references: [
                        {
                            id: "reference-refinement-e2e",
                            url: uploadedAsset.url,
                            storageKey: uploadedAsset.key,
                            source: "library",
                            status: "approved",
                            label: "主基准图",
                            createdAt: new Date().toISOString(),
                        },
                    ],
                    primaryReferenceId: "reference-refinement-e2e",
                    refinementHistory: [
                        {
                            id: "refinement-e2e",
                            request: "强化面部美感并保留全身构图",
                            reply: "已生成调整方案",
                            createdAt: new Date().toISOString(),
                            proposal: {
                                reply: "已生成调整方案",
                                changes: [
                                    {
                                        field: "styling",
                                        before: "",
                                        after: "半写实动漫幻想风的黑金学院长袍",
                                        reason: "统一章节视觉风格",
                                    },
                                ],
                                updatedDescription: "一名需要按历史调整方案重新生成的暗黑学院青年角色",
                                updatedProfile: { visualIdentity: "黑发青年，黑金学院长袍，完整全身设定图", styling: "半写实动漫幻想风" },
                                compiledPrompt: "用户调整要求：强化面部美感并保留全身构图\n服装与造型：半写实动漫幻想风的黑金学院长袍",
                                negativePrompt: "避免拼版、文字和水印",
                                preservedRules: ["完整全身构图"],
                            },
                        },
                    ],
                },
            ],
        },
    });
    expect(saved.ok(), await saved.text()).toBe(true);

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "打开项目资产" }).click();
    await page.getByRole("button", { name: "编辑角色：历史方案角色" }).click();
    const drawer = page.getByRole("dialog", { name: "编辑角色" });
    await drawer.getByRole("button", { name: "生成调整候选" }).click();

    await expect(page.getByText(/已生成 1 张候选图/)).toBeVisible({ timeout: 90_000 });
    expect(pageErrors).not.toContain("Maximum call stack size exceeded");
    await expect(drawer.locator('img[alt="AI 候选图"]')).toHaveCount(1);
    const fixture = await protocolFixtureState(request);
    expect(fixture.requests.filter((item) => item.method === "POST" && item.path.endsWith("/images/edits"))).toHaveLength(1);
});

test("批量完成后将基准图写入项目资产列表", async ({ page, request }) => {
    await resetProtocolFixture(request);
    const settings = await request.patch("/api/admin/settings", { data: sub2ApiImageSettingsPatch() });
    expect(settings.ok(), await settings.text()).toBe(true);

    const created = await request.post("/api/drama/projects", { data: { title: "E2E 批量基准图回写", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const sceneId = "scene-batch-reference-e2e";
    const saved = await request.patch(`/api/drama/projects/${project.id}`, {
        data: {
            ...project,
            scenes: [
                {
                    id: sceneId,
                    name: "批量基准场景",
                    description: "用于验证批量生成完成后列表能够显示真实基准图",
                    profile: { visualIdentity: "完整场景空间结构与固定入口", styling: "半写实动漫幻想风", colorPalette: "冷蓝灰", consistencyRules: "入口和空间结构保持一致" },
                    references: [],
                },
            ],
        },
    });
    expect(saved.ok(), await saved.text()).toBe(true);

    const submitted = await request.post(`/api/drama/projects/${project.id}/asset-generation-batches`, {
        data: { assets: [{ kind: "scenes", assetId: sceneId }], config: { ...e2eSettingsPatch(), model: "e2e-image", imageModel: "e2e-image", count: "1", completeSettings: false, generateVoice: false } },
    });
    expect(submitted.ok(), await submitted.text()).toBe(true);
    const batch = ((await submitted.json()) as { data: { batch: { id: string } } }).data.batch;

    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "打开项目资产" }).click();
    await page.getByRole("button", { name: /场景/ }).click();

    await expect
        .poll(
            async () => {
                const response = await request.get(`/api/drama/projects/${project.id}/asset-generation-batches/${batch.id}`);
                expect(response.ok(), await response.text()).toBe(true);
                return ((await response.json()) as { data: { batch: { status: string } } }).data.batch.status;
            },
            { timeout: 90_000 },
        )
        .toBe("completed");

    const reloaded = await request.get(`/api/drama/projects/${project.id}`);
    expect(reloaded.ok(), await reloaded.text()).toBe(true);
    const reloadedProject = ((await reloaded.json()) as { data: { project: DramaProject } }).data.project;
    const scene = reloadedProject.scenes.find((item) => item.id === sceneId);
    expect(scene?.primaryReferenceId).toBeTruthy();
    expect(scene?.references?.find((item) => item.id === scene.primaryReferenceId)).toMatchObject({ status: "approved", url: expect.stringContaining("/api/") });

    const damaged = await request.patch(`/api/drama/projects/${project.id}`, {
        data: { ...reloadedProject, scenes: reloadedProject.scenes.map((item) => (item.id === sceneId ? { ...item, primaryReferenceId: undefined, referenceImageUrl: undefined, references: [] } : item)) },
    });
    expect(damaged.ok(), await damaged.text()).toBe(true);

    const progressAfterDamage = await request.get(`/api/drama/projects/${project.id}/asset-generation-batches/${batch.id}`);
    expect(progressAfterDamage.ok(), await progressAfterDamage.text()).toBe(true);
    const repairedBatch = ((await progressAfterDamage.json()) as { data: { batch: { items: Array<{ assetId: string; status: string; candidateReferenceId?: string }> } } }).data.batch;
    expect(repairedBatch.items.find((item) => item.assetId === sceneId)).toMatchObject({ status: "success", candidateReferenceId: expect.any(String) });
    const repairedProjectResponse = await request.get(`/api/drama/projects/${project.id}`);
    expect(repairedProjectResponse.ok(), await repairedProjectResponse.text()).toBe(true);
    const repairedProject = ((await repairedProjectResponse.json()) as { data: { project: DramaProject } }).data.project;
    expect(repairedProject.scenes.find((item) => item.id === sceneId)?.primaryReferenceId).toBeTruthy();

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "打开项目资产" }).click();
    await page.getByRole("button", { name: /场景/ }).click();
    await expect(page.locator('img[alt="批量基准场景基准图"]')).toHaveCount(1);
});

function sub2ApiImageSettingsPatch() {
    const settings = e2eSettingsPatch();
    const primary = settings.systemChannels[0];
    if (!primary) throw new Error("缺少 E2E 图片渠道");
    return {
        ...settings,
        systemChannels: [applyChannelProtocol({ ...primary, models: ["e2e-image"] }, "sub2api")],
        defaultModels: { textModel: "", imageModel: "e2e-image", videoModel: "", audioModel: "" },
    };
}
