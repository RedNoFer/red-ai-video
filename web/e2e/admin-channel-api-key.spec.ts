import { expect, test } from "@playwright/test";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("管理员可以替换已保存的渠道 API Key", async ({ page, request }) => {
    const settings = await request.get("/api/admin/settings");
    expect(settings.ok(), await settings.text()).toBe(true);
    const current = (await settings.json()) as { settings: { systemChannels: Array<Record<string, unknown>> } };
    const channel = current.settings.systemChannels[0];
    expect(channel).toBeTruthy();

    await page.goto("/admin?section=channels", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: `查看渠道：${String(channel.name || "未命名渠道")}` }).click();
    const drawer = page.getByRole("dialog", { name: String(channel.name || "渠道详情") });
    await drawer.getByRole("tab", { name: "渠道配置" }).click();

    const apiKeyField = drawer.locator("label").filter({ hasText: "API Key" }).locator("input");
    await expect(apiKeyField).toHaveAttribute("readonly", "");
    await drawer.getByRole("button", { name: "替换" }).click();
    await expect(apiKeyField).not.toHaveAttribute("readonly", "");
    await apiKeyField.fill("e2e-replacement-secret");

    await drawer.locator(".ant-drawer-close").click();
    await page.getByRole("button", { name: "保存模型渠道配置" }).click();
    await expect(page.getByText("模型渠道配置已保存", { exact: true })).toBeVisible();

    const saved = await request.get("/api/admin/settings");
    expect(saved.ok(), await saved.text()).toBe(true);
    const savedPayload = (await saved.json()) as { settings: { systemChannels: Array<{ id: string; apiKey: string; hasApiKey?: boolean }> } };
    const savedChannel = savedPayload.settings.systemChannels.find((item) => item.id === channel.id);
    expect(savedChannel).toMatchObject({ id: channel.id, apiKey: "", hasApiKey: true });
});
