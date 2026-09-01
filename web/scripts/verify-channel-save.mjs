import assert from "node:assert/strict";

import { chromium, request as playwrightRequest } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
const installToken = "vozeb-pro-e2e-install-token-32chars";
const staleTemplate = '{"model":"{{model}}","prompt":"{{prompt}}","first_frame":"{{first_frame}}","last_frame":"{{last_frame}}"}';
const presetTemplate = '{"model":"{{model}}","prompt":"{{prompt}}","mode":"{{mode}}","duration":"{{duration}}","aspect_ratio":"{{aspect_ratio}}","resolution":"{{resolution}}","quality":"{{quality}}","client_request_id":"{{client_request_id}}","images":"{{images}}","videos":"{{videos}}","audios":"{{audios}}","count":1}';

const channel = {
    id: "browser-buming",
    name: "浏览器不鸣 Seedance",
    baseUrl: "https://api.tokengo.love",
    apiKey: "fixture-key",
    apiFormat: "openai",
    models: ["seedance-2-0-official"],
    enabled: true,
    advancedConfig: {
        protocol: "buming-seedance",
        authMode: "bearer",
        modelCatalogPaths: ["/v1/logical-models", "/v1/skills/models"],
        modelCapabilities: { "seedance-2-0-official": "video" },
        modelConfigs: {
            "seedance-2-0-official": {
                capability: "video",
                source: "manual",
                protocol: "buming-seedance",
                apiFormat: "openai",
                createPath: "/v1/videos/generations",
                imageToVideoPath: "/v1/videos/generations",
                queryPath: "/v1/tasks/:task_id",
                requestTemplate: presetTemplate,
                resultField: "output_url / result_url / result.videos[0].url / result.videos[0].video_url / output.videos[0].url",
                statusField: "state / status",
                durationRange: "4-15 秒",
                referenceRule: "使用 application/json 扁平请求。",
                supportsReferenceImage: true,
                supportsReferenceVideo: true,
                supportsReferenceAudio: true,
                supportsKeyframes: true,
                videoReferenceModes: ["reference", "first_frame", "first_last", "all_frames"],
                maxReferenceImages: 9,
            },
        },
        operationConfigs: {},
    },
};

const api = await playwrightRequest.newContext({ baseURL });
const initialized = await api.post("/api/install/initialize", { data: { installToken } });
assert.ok(initialized.ok() || initialized.status() === 409, await initialized.text());
const registered = await api.post("/api/auth/register", { data: { username: "browser_admin", displayName: "浏览器管理员", password: "VozebBrowser!2026", installToken } });
assert.ok(registered.ok(), await registered.text());
const configured = await api.patch("/api/admin/settings", { data: { systemChannels: [channel], logicalModels: [], defaultModels: { textModel: "", imageModel: "", videoModel: "seedance-2-0-official", audioModel: "" } } });
assert.ok(configured.ok(), await configured.text());

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: await api.storageState() });
const page = await context.newPage();
let sentStaleTemplate = false;
await page.route("**/api/admin/settings", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const body = route.request().postDataJSON();
    const target = body.systemChannels.find((item) => item.id === channel.id);
    target.advancedConfig.modelConfigs["seedance-2-0-official"].requestTemplate = staleTemplate;
    sentStaleTemplate = true;
    await route.continue({ postData: JSON.stringify(body) });
});
await page.goto(`${baseURL}/admin?section=channels`, { waitUntil: "networkidle" });
const save = page.waitForResponse((response) => response.url().endsWith("/api/admin/settings") && response.request().method() === "PATCH");
await page.getByRole("button", { name: "保存模型渠道配置" }).click();
const saved = await save;
assert.ok(saved.ok(), await saved.text());
assert.ok(sentStaleTemplate);
const persisted = await api.get("/api/admin/settings");
assert.ok(persisted.ok(), await persisted.text());
const savedChannel = (await persisted.json()).settings.systemChannels.find((item) => item.id === channel.id);
assert.equal(savedChannel.advancedConfig.modelConfigs["seedance-2-0-official"].requestTemplate, presetTemplate);
await context.close();
await browser.close();
await api.dispose();
