import { expect, test } from "@playwright/test";

import { applyChannelProtocol } from "../src/lib/channel-protocol-registry";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("管理员保存时会修复旧版 TokenGo Seedance 模板", async ({ page, request }) => {
    const current = await request.get("/api/admin/settings");
    expect(current.ok(), await current.text()).toBe(true);
    const settings = (await current.json()) as { settings: { systemChannels: Array<Record<string, unknown>> } };
    const channel = applyChannelProtocol(
        { id: "e2e-buming-seedance", name: "E2E 不鸣 Seedance", baseUrl: "http://127.0.0.1:4010/v1", apiKey: "fixture-key", apiFormat: "openai", models: ["seedance-2-0-official"], enabled: true },
        "buming-seedance",
    );
    const prepared = await request.patch("/api/admin/settings", { data: { systemChannels: [...settings.settings.systemChannels, channel] } });
    expect(prepared.ok(), await prepared.text()).toBe(true);

    let sentStaleTemplate = false;
    await page.route("**/api/admin/settings", async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        const body = route.request().postDataJSON() as { systemChannels?: Array<{ id: string; advancedConfig?: { modelConfigs?: Record<string, { requestTemplate?: string }> } }> };
        const target = body.systemChannels?.find((item) => item.id === channel.id);
        if (target?.advancedConfig?.modelConfigs?.["seedance-2-0-official"]) {
            target.advancedConfig.modelConfigs["seedance-2-0-official"].requestTemplate = '{"model":"{{model}}","prompt":"{{prompt}}","first_frame":"{{first_frame}}","last_frame":"{{last_frame}}"}';
            sentStaleTemplate = true;
        }
        await route.continue({ postData: JSON.stringify(body) });
    });

    await page.goto("/admin?section=channels", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "保存模型渠道配置" }).click();
    await expect(page.getByText("模型渠道配置已保存", { exact: true })).toBeVisible();
    expect(sentStaleTemplate).toBe(true);

    const saved = await request.get("/api/admin/settings");
    expect(saved.ok(), await saved.text()).toBe(true);
    const persisted = (await saved.json()) as { settings: { systemChannels: Array<{ id: string; advancedConfig?: { modelConfigs?: Record<string, { requestTemplate?: string }> } }> } };
    expect(persisted.settings.systemChannels.find((item) => item.id === channel.id)?.advancedConfig?.modelConfigs?.["seedance-2-0-official"]?.requestTemplate).toContain('"mode":"{{mode}}"');
});
