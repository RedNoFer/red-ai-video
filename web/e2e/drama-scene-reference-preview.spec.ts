import { expect, test } from "@playwright/test";

import type { DramaProject } from "../src/lib/drama-project-contract";

const REFERENCE_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGPQq/3/H4QZYAwAWewKpRUlAtEAAAAASUVORK5CYII=";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("场景参考图弹窗在桌面和窄屏保持可用尺寸并支持放大原图", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 场景预览弹窗 ${Date.now()}`, ratio: "16:9" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const uploaded = await request.post("/api/reference-assets", {
        data: { dataUrl: REFERENCE_DATA_URL, type: "image", persistent: true, originalName: "scene-preview-e2e.png" },
    });
    expect(uploaded.ok(), await uploaded.text()).toBe(true);
    const uploadedAsset = (await uploaded.json()) as { url: string; key?: string };
    const referenceId = "scene-preview-reference-e2e";

    try {
        const saved = await request.patch(`/api/drama/projects/${project.id}`, {
            data: {
                ...project,
                scenes: [
                    {
                        id: "scene-preview-e2e",
                        name: "弹窗尺寸测试场景",
                        description: "用于验证场景基准图弹窗尺寸和原图放大入口",
                        references: [
                            {
                                id: referenceId,
                                url: uploadedAsset.url,
                                storageKey: uploadedAsset.key,
                                source: "library",
                                label: "弹窗测试场景图",
                                width: 3840,
                                height: 2160,
                                status: "approved",
                                createdAt: new Date().toISOString(),
                            },
                        ],
                        primaryReferenceId: referenceId,
                        sceneReferenceBoard: { layout: "panorama", referenceId },
                    },
                ],
            },
        });
        expect(saved.ok(), await saved.text()).toBe(true);

        await page.goto(`/drama/${project.id}`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "打开项目资产" }).click();
        await page.locator('[aria-label="项目资产分类"] button').filter({ hasText: "场景" }).click();
        await page.locator("[data-drama-assets-library] article").filter({ hasText: "弹窗尺寸测试场景" }).getByRole("button", { name: "编辑场景：弹窗尺寸测试场景" }).last().click();

        const drawer = page.getByRole("dialog", { name: "编辑场景" });
        await drawer.getByRole("img", { name: "弹窗测试场景图，点击预览完整基准图", exact: true }).click();
        const modal = page.locator(".ant-modal").filter({ hasText: "弹窗测试场景图" }).last();
        await expect(modal).toBeVisible();
        const modalBox = await modal.boundingBox();
        const viewport = page.viewportSize();
        expect(viewport).toBeTruthy();
        expect(modalBox?.width).toBeGreaterThan((viewport?.width || 0) - 48);
        expect(modalBox?.width).toBeLessThanOrEqual(viewport?.width || 0);
        await expect(modal.locator(".ant-image img")).toHaveAttribute("src", /format=webp.*width=2048/);

        await modal.locator(".ant-image").click();
        await expect(page.getByRole("button", { name: "zoomIn" })).toBeVisible();
        await expect(page.getByRole("dialog").last().locator("img").first()).toHaveAttribute("src", /download=original/);
    } finally {
        const deleted = await request.delete(`/api/drama/projects/${project.id}`);
        expect(deleted.ok(), await deleted.text()).toBe(true);
    }
});
