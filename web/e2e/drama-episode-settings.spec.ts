import { randomUUID } from "node:crypto";

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

    const saveRequest = page.waitForRequest((candidate) => candidate.method() === "PATCH" && candidate.url().endsWith(`/api/drama/projects/${project.id}/episodes/${episode.id}/settings`));
    const saveResponse = page.waitForResponse((candidate) => candidate.request().method() === "PATCH" && candidate.url().endsWith(`/api/drama/projects/${project.id}/episodes/${episode.id}/settings`));
    await page.getByRole("button", { name: "锁定并保存设置" }).click();

    const [outbound, inbound] = await Promise.all([saveRequest, saveResponse]);
    expect(Buffer.byteLength(outbound.postData() || "")).toBeLessThan(8 * 1024 * 1024);
    expect(JSON.parse(outbound.postData() || "{}")).toEqual(expect.objectContaining({ title: episode.title, summary: project.summary, style: project.style, productionPlan: expect.any(Object) }));
    expect(inbound.status()).toBe(200);
    await expect(page.getByText("本集设置已保存", { exact: true })).toBeVisible();
});

test("custom visual style survives create, episode settings save, refresh, and API readback", async ({ page, request }) => {
    const customStyle = "ARRI Alexa 65自然光真人影视感，冷灰蓝；真实狼毛发与泥水质感；禁止动漫、插画、游戏CG";
    const updatedStyle = `${customStyle}；低饱和湿地绿色`;
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
        const styleInput = page.getByRole("textbox", { name: "视觉风格" });
        await expect(styleInput).toHaveValue(customStyle);
        await styleInput.fill(updatedStyle);
        await page.getByRole("button", { name: "锁定并保存设置" }).click();
        await expect(page.getByText("本集设置已保存", { exact: true })).toBeVisible();

        const readback = await request.get(`/api/drama/projects/${project.id}`);
        expect(readback.ok(), await readback.text()).toBe(true);
        const saved = ((await readback.json()) as { data: { project: DramaProject } }).data.project;
        expect(saved.style).toBe(updatedStyle);
        expect(saved.productionBible?.visualStyle).toBe(updatedStyle);
        expect(saved.productionBible?.colorScript).toBeUndefined();

        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("button", { name: "打开本集设置" }).click();
        await expect(page.getByRole("textbox", { name: "视觉风格" })).toHaveValue(updatedStyle);
    } finally {
        const deleted = await request.delete(`/api/drama/projects/${project.id}`);
        expect(deleted.ok(), await deleted.text()).toBe(true);
    }
});
