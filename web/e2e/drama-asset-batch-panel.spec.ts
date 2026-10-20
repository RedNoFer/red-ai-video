import { expect, test } from "@playwright/test";

import type { DramaProject } from "../src/lib/drama-project-contract";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("批量生成素材列表只显示素材名称和出图状态", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 批量面板 ${Date.now()}`, ratio: "16:9" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;

    try {
        const characters = [
            {
                id: "character-batch-with-image",
                name: "有图角色",
                description: "用于验证批量面板出图状态",
                profile: { visualIdentity: "固定视觉识别", styling: "固定结构", colorPalette: "冷灰", consistencyRules: "保持设定一致" },
                references: [{ id: "reference-batch-with-image", url: "/api/reference-assets/e2e-batch-panel.png", source: "library", label: "基准图", createdAt: new Date().toISOString() }],
            },
            {
                id: "character-batch-without-image",
                name: "无图角色",
                description: "用于验证批量面板出图状态",
                profile: { visualIdentity: "固定视觉识别", styling: "固定结构", colorPalette: "冷灰", consistencyRules: "保持设定一致" },
                references: [],
            },
        ];
        const saved = await request.patch(`/api/drama/projects/${project.id}/mutations`, {
            data: {
                projectId: project.id,
                expectedUpdatedAt: project.updatedAt,
                updatedAt: new Date(Date.parse(project.updatedAt) + 1).toISOString(),
                assets: { characters: { upsert: characters } },
            },
        });
        expect(saved.ok(), await saved.text()).toBe(true);

        await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "打开项目资产" }).click();
        await page.getByRole("button", { name: "批量生成素材" }).click();
        const dialog = page.getByRole("dialog", { name: "批量生成素材" });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText("有图角色", { exact: true })).toBeVisible();
        await expect(dialog.getByText("无图角色", { exact: true })).toBeVisible();
        await expect(dialog.getByText("已生成图")).toBeVisible();
        await expect(dialog.getByText("缺图")).toBeVisible();
        // 旧的长字段清单不再出现在选择列表里，名称与状态不会再被遮挡
        await expect(dialog.getByText(/剧情身份或用途/)).toHaveCount(0);
        await expect(dialog.getByText(/一致性规则/)).toHaveCount(0);
    } finally {
        await request.delete(`/api/drama/projects/${project.id}`);
    }
});

test("后台生成控制允许把并发上限设为 0 表示不限制", async ({ request }) => {
    const current = await request.get("/api/admin/settings");
    expect(current.ok(), await current.text()).toBe(true);
    const settings = ((await current.json()) as { settings: { generationConcurrency: Record<string, number> } }).settings;
    const previous = settings.generationConcurrency;

    const patched = await request.patch("/api/admin/settings", { data: { generationConcurrency: { ...previous, image: 0, video: 0 } } });
    expect(patched.ok(), await patched.text()).toBe(true);

    const readback = await request.get("/api/admin/settings");
    expect(readback.ok(), await readback.text()).toBe(true);
    const updated = ((await readback.json()) as { settings: { generationConcurrency: Record<string, number> } }).settings.generationConcurrency;
    expect(updated.image).toBe(0);
    expect(updated.video).toBe(0);

    const restore = await request.patch("/api/admin/settings", { data: { generationConcurrency: previous } });
    expect(restore.ok(), await restore.text()).toBe(true);
});
