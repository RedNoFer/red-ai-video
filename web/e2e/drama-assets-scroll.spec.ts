import { expect, test } from "@playwright/test";

import type { DramaProject } from "../src/lib/drama-project-contract";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("project asset cards remain scrollable through the last card on desktop and mobile", async ({ page, request }) => {
    const projectsResponse = await request.get("/api/drama/projects?page=1&pageSize=100");
    expect(projectsResponse.ok(), await projectsResponse.text()).toBe(true);
    const projects = ((await projectsResponse.json()) as { data: { projects: Array<{ id: string; title: string }> } }).data.projects;
    for (const previous of projects.filter((item) => item.title.startsWith("E2E 项目资产滚动 "))) {
        const deleted = await request.delete(`/api/drama/projects/${previous.id}`);
        expect(deleted.ok(), await deleted.text()).toBe(true);
    }

    const created = await request.post("/api/drama/projects", { data: { title: `E2E 项目资产滚动 ${Date.now()}`, ratio: "16:9" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    expect(project.creativeConversationId).toBeTruthy();

    try {
        const makeAssets = (kind: "character" | "scene" | "prop") =>
            Array.from({ length: 18 }, (_, index) => ({
                id: `${kind}-scroll-e2e-${index}`,
                name: `滚动测试资产 ${String(index + 1).padStart(2, "0")}`,
                description: "用于验证项目资产网格的纵向滚动",
                profile: { visualIdentity: "固定视觉识别", styling: "固定结构", colorPalette: "冷灰", consistencyRules: "保持设定一致" },
                references: [],
            }));
        const characters = makeAssets("character");
        const scenes = makeAssets("scene");
        const props = makeAssets("prop");
        await page.route(`**/api/drama/projects/${project.id}`, async (route) => {
            if (route.request().method() !== "GET") return route.continue();
            const response = await route.fetch();
            const payload = (await response.json()) as { data: { project: DramaProject } };
            await route.fulfill({
                response,
                json: {
                    ...payload,
                    data: {
                        ...payload.data,
                        project: { ...payload.data.project, characters, scenes, props },
                    },
                },
            });
        });

        for (const viewport of [
            { width: 1640, height: 806 },
            { width: 390, height: 844 },
        ]) {
            await page.setViewportSize(viewport);
            await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
            await page.getByRole("button", { name: "打开项目资产" }).click();
            const library = page.locator("[data-drama-assets-library]");
            await expect(library).toBeVisible();
            for (const [label, expectedCount] of [
                ["角色", characters.length],
                ["场景", scenes.length],
                ["道具", props.length],
            ] as const) {
                await page.locator('[aria-label="项目资产分类"] button').filter({ hasText: label }).click();
                await expect(library.locator("[data-drama-asset-grid] article")).toHaveCount(expectedCount);
                const dimensions = await page.evaluate(() => {
                    const scroller = document.querySelector<HTMLElement>("[data-drama-production-scroll]");
                    const lastCard = document.querySelector<HTMLElement>("[data-drama-assets-library] article:last-child");
                    if (!scroller || !lastCard) throw new Error("资产滚动区域或末尾卡片不存在");
                    scroller.scrollTop = scroller.scrollHeight;
                    return {
                        clientHeight: scroller.clientHeight,
                        scrollHeight: scroller.scrollHeight,
                        scrollTop: scroller.scrollTop,
                        lastCardBottom: lastCard.getBoundingClientRect().bottom,
                        viewportBottom: scroller.getBoundingClientRect().bottom,
                    };
                });
                expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
                expect(dimensions.scrollTop).toBeGreaterThan(0);
                expect(dimensions.lastCardBottom).toBeLessThanOrEqual(dimensions.viewportBottom + 1);
            }
        }
    } finally {
        const deleted = await request.delete(`/api/drama/projects/${project.id}`);
        expect(deleted.ok(), await deleted.text()).toBe(true);
    }
});
