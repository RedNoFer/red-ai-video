import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import type { DramaProject } from "../src/lib/drama-project-contract";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("drama episode settings save through a compact request", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 本集设置 ${randomUUID().slice(0, 8)}`, summary: "验证紧凑保存请求", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const episode = project.episodes[0];

    await page.goto(`/drama/${project.id}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "打开本集设置" }).click();
    await expect(page.locator("[data-drama-episode-settings]")).toBeVisible();
    const settings = page.locator("[data-drama-episode-settings]");
    await settings.getByTestId("drama-episode-visual-direction").fill("视觉风格：东方写实摄影\n画风：克制电影美术\n色彩：冷灰蓝与暗金\n材质：真实木石与湿润反光");
    let agentRunCalls = 0;
    await page.route("**/api/agent/runs", async (route) => {
        if (route.request().method() === "POST") agentRunCalls += 1;
        await route.continue();
    });

    const saveRequest = page.waitForRequest((candidate) => candidate.method() === "PATCH" && candidate.url().endsWith(`/api/drama/projects/${project.id}/episodes/${episode.id}/settings`));
    const saveResponse = page.waitForResponse((candidate) => candidate.request().method() === "PATCH" && candidate.url().endsWith(`/api/drama/projects/${project.id}/episodes/${episode.id}/settings`));
    await page.getByRole("button", { name: "保存本集信息" }).click();

    const [outbound, inbound] = await Promise.all([saveRequest, saveResponse]);
    expect(Buffer.byteLength(outbound.postData() || "")).toBeLessThan(8 * 1024 * 1024);
    const requestBody = JSON.parse(outbound.postData() || "{}");
    expect(requestBody).toMatchObject({ title: episode.title, summary: project.summary, productionPlan: { lockedAt: expect.any(String), visual: { visualDirection: expect.stringContaining("东方写实摄影") } } });
    expect(agentRunCalls).toBe(0);
    expect(inbound.status()).toBe(200);
    await expect(page.getByText("本集设置已保存", { exact: true })).toBeVisible();
});

test("drama global parameters save without starting an Agent run", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 全局参数 ${randomUUID().slice(0, 8)}` } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;

    let agentRunCalls = 0;
    await page.route("**/api/agent/runs", async (route) => {
        if (route.request().method() === "POST") agentRunCalls += 1;
        await route.continue();
    });

    try {
        await page.goto(`/drama/${project.id}`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "剧本 GPT" }).click();
        const agentPanel = page.locator("[data-drama-script-agent]");
        await expect(agentPanel).toBeVisible();
        await agentPanel.getByRole("button", { name: "全局参数设置" }).click();

        const dialog = page.getByRole("dialog", { name: "全局参数设置" });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText("视觉风格", { exact: true })).toHaveCount(0);
        await expect(dialog.getByText("画风", { exact: true })).toHaveCount(0);
        const visualDirection = dialog.getByTestId("drama-global-visual-direction");
        await visualDirection.fill("东方写实摄影与克制电影美术\n冷灰蓝主色，真实木石材质，自然侧逆光\n禁止动漫质感、塑料皮肤和无依据的现代元素");

        const saveRequest = page.waitForRequest((candidate) => candidate.method() === "PATCH" && candidate.url().endsWith(`/api/drama/projects/${project.id}`));
        await dialog.getByRole("button", { name: "保存全局参数" }).click();
        const outbound = await saveRequest;
        expect(outbound.postDataJSON()).toMatchObject({ productionBible: { productionPlan: { visual: { visualDirection: expect.stringContaining("自然侧逆光") } } } });
        await expect(dialog).toBeHidden();
        await expect(page.getByText("全局参数设置已保存", { exact: true })).toBeVisible();
        expect(agentRunCalls).toBe(0);
    } finally {
        const deleted = await request.delete(`/api/drama/projects/${project.id}`);
        expect(deleted.ok(), await deleted.text()).toBe(true);
    }
});

test("episode settings save does not create a second project style source", async ({ page, request }) => {
    const customStyle = "ARRI Alexa 65自然光真人影视感，冷灰蓝；真实狼毛发与泥水质感；禁止动漫、插画、游戏CG";
    const created = await request.post("/api/drama/projects", {
        data: { title: `E2E 自定义风格 ${randomUUID().slice(0, 8)}`, summary: "验证自定义视觉风格 round-trip", ratio: "9:16", style: customStyle },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;

    try {
        expect(project.style).toBe(customStyle);
        expect(project.productionBible?.visualStyle).toBe(customStyle);
        expect(project.productionBible?.colorScript).toBeUndefined();

        await page.goto(`/drama/${project.id}`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "打开本集设置" }).click();
        await expect(page.getByText("生产方案")).toBeVisible();
        await page.getByRole("button", { name: "保存本集信息" }).click();
        await expect(page.getByText("本集设置已保存", { exact: true })).toBeVisible();

        const readback = await request.get(`/api/drama/projects/${project.id}`);
        expect(readback.ok(), await readback.text()).toBe(true);
        const saved = ((await readback.json()) as { data: { project: DramaProject } }).data.project;
        expect(saved.style).toBe(customStyle);
        expect(saved.productionBible?.visualStyle).toBe(customStyle);
        expect(saved.productionBible?.colorScript).toBeUndefined();

        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("button", { name: "打开本集设置" }).click();
        await expect(page.getByText("生产方案")).toBeVisible();
    } finally {
        const deleted = await request.delete(`/api/drama/projects/${project.id}`);
        expect(deleted.ok(), await deleted.text()).toBe(true);
    }
});

test("a production package restores its complete visual contract in episode settings", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 制作包视觉方案 ${randomUUID().slice(0, 8)}` } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const visualStyle = "东方写实摄影";
    const artStyle = "克制电影美术，真实木石与湿润反光";
    const visualDirection = `视觉风格：${visualStyle}\n画风：${artStyle}\n色彩：冷灰蓝与暗金\n材质：真实木石与湿润反光\n光线：自然侧逆光\n负面约束：禁止动漫质感、塑料皮肤和无依据的现代元素`;
    const sourcePackage = JSON.parse(readFileSync(new URL("../../output/mahadel-episode-01-production-package-v2-multiframe.json", import.meta.url), "utf8")) as {
        project: { style: string; productionBible: { visualStyle: string; colorScript?: string; globalNegativePrompt?: string; productionPlan: Record<string, unknown> } };
    };
    sourcePackage.project.style = visualStyle;
    sourcePackage.project.productionBible.visualStyle = visualStyle;
    sourcePackage.project.productionBible.colorScript = "冷灰蓝与暗金";
    sourcePackage.project.productionBible.globalNegativePrompt = "禁止动漫质感、塑料皮肤和无依据的现代元素";
    sourcePackage.project.productionBible.productionPlan = {
        ...sourcePackage.project.productionBible.productionPlan,
        lockedAt: "2026-09-08T00:00:00.000Z",
        visual: { visualStyle, artStyle, visualDirection, source: "agent" },
    };
    const source = JSON.stringify(sourcePackage);

    try {
        const previewResponse = await request.post(`/api/drama/projects/${project.id}/production-package`, { data: { action: "preview", source, fileName: "e2e-visual-package.json" } });
        expect(previewResponse.ok(), await previewResponse.text()).toBe(true);
        const preview = ((await previewResponse.json()) as { data: { preview: { sourceHash: string } } }).data.preview;
        const applyResponse = await request.post(`/api/drama/projects/${project.id}/production-package`, { data: { action: "apply", source, fileName: "e2e-visual-package.json", sourceHash: preview.sourceHash } });
        expect(applyResponse.ok(), await applyResponse.text()).toBe(true);

        const readback = await request.get(`/api/drama/projects/${project.id}`);
        expect(readback.ok(), await readback.text()).toBe(true);
        const saved = ((await readback.json()) as { data: { project: DramaProject } }).data.project;
        expect(saved.productionBible).toMatchObject({ visualStyle, colorScript: "冷灰蓝与暗金", globalNegativePrompt: "禁止动漫质感、塑料皮肤和无依据的现代元素", productionPlan: { visual: { visualStyle, artStyle, visualDirection } } });

        await page.goto(`/drama/${project.id}`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "打开本集设置" }).click();
        await expect(page.locator("[data-drama-episode-settings]").getByTestId("drama-episode-visual-direction")).toHaveValue(visualDirection);
    } finally {
        const deleted = await request.delete(`/api/drama/projects/${project.id}`);
        expect(deleted.ok(), await deleted.text()).toBe(true);
    }
});
