import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { E2E_PROTOCOL_ORIGIN, e2eSettingsPatch, pollTask, saveDramaProjectFixture } from "./support";
import { expectNoHorizontalOverflow } from "./responsive-helpers";
import type { DramaProject } from "../src/lib/drama-project-contract";

for (const layout of ["template", "timeline"]) {
    test(`${layout} package warnings permit one preview and preserve author prose after refresh`, async ({ page, request }) => {
        const created = await request.post("/api/drama/projects", { data: { title: `E2E 外部原稿 ${randomUUID().slice(0, 8)}`, ratio: "9:16" } });
        expect(created.ok(), await created.text()).toBe(true);
        const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
        let source = readFileSync(new URL("../../docs/drama-production-package-v1-field-example.json", import.meta.url), "utf8");
        const example = JSON.parse(source);
        const characterAsset = example.assets.characters[0];
        characterAsset.profile = { visualIdentity: "成年女性；长脸、杏眼、低束黑发", styling: "墨灰短夹克、耐磨长裤、低帮户外鞋", colorPalette: "墨灰、黑", consistencyRules: "脸型和低束发固定" };
        characterAsset.supplierPrompt =
            "主体与资产类型：角色\n身份/结构锚点：成年女性，长脸、杏眼、低束黑发\n可见状态与材质：墨灰短夹克、耐磨长裤、低帮户外鞋\n构图与画幅：纯白色背景四视图，身份特写、正面、严格左侧面、背面全身\n光色与风格：自然骨骼，五官与头发清晰，真实织物材质，柔和棚光\n负面约束：换脸、额外人物、文字";
        const sceneAsset = example.assets.locations[0];
        sceneAsset.description = "后左门、右窗、中央木桌，桌旁留出通道";
        sceneAsset.profile = { visualIdentity: sceneAsset.description, styling: "旧木地板、石墙、湿玻璃", colorPalette: "木褐、石灰", consistencyRules: "门窗桌位置固定" };
        sceneAsset.supplierPrompt = "主体与资产类型：场景\n身份/结构锚点：后左门、右窗、中央木桌\n可见状态与材质：旧木地板、石墙、湿玻璃\n构图与画幅：9:16高清单视角全景，通道完整\n光色与风格：右窗自然光\n负面约束：人物、分格、字幕";
        source = JSON.stringify(example);
        if (layout === "timeline") {
            const packageInput = JSON.parse(source);
            packageInput.episodes[0].shots[0].videoPrompt = [
                "【参数】15秒，9:16，有声。",
                "【公共总规范】林雪站在长案北侧，右手持封；西窗柔光，暖灰；摄影机在长案南侧；禁止瞬移和无因重排；对白原声清晰可辨并位于前景，语音期间压低环境音，不遮挡台词。",
                "【时间轴】",
                "0.000-3.000秒：特写｜50mm｜平视｜固定机位；画面：因来手触纸，林雪嘴唇开合，收句闭口，右手持封未松开；台词：林雪说：“外套颜色没变，别说话。”；音效：纸张摩擦。",
                "3.000-15.000秒：特写｜50mm｜平视｜固定机位；画面：因来手继续靠近，右臂收回信封，信封停在胸前，持有人不变；台词：无；音效：纸封擦过袖口发出轻响。",
                "【收尾】林雪仍在长案北侧，信封由右手持于胸前。",
            ].join("\n");
            source = JSON.stringify(packageInput);
        }
        const seededProject = structuredClone(project);
        seededProject.characters = [{ id: "retained-asset", code: characterAsset.code, name: characterAsset.name, description: "原文角色与功能事实。", supplierPrompt: "旧通用约束" }];
        seededProject.scenes = [{ id: "retained-location", code: sceneAsset.code, name: sceneAsset.name, description: "入口、出口、地面支撑", supplierPrompt: "旧通用场景约束" }];
        expect((await saveDramaProjectFixture(request, project, seededProject)).ok()).toBe(true);
        const packageInput = JSON.parse(source);
        const authored = packageInput.episodes[0].shots[0];
        authored.videoPrompt += `\n${"🧭".repeat(2501)}`;
        const originalFrames = structuredClone(authored.framePlan.frames);
        const boundaries = [0, 1, 2, 3, 5, 7, 9, 11, 13, 15];
        authored.framePlan.frames = boundaries.slice(0, -1).map((startSecond, index) => ({ ...originalFrames[startSecond < 3 ? 0 : 1], id: `F${index + 1}`, sequenceIndex: index + 1, startSecond, endSecond: boundaries[index + 1] }));
        source = JSON.stringify(packageInput);
        expect(Array.from(authored.videoPrompt).length).toBeGreaterThan(2500);
        const template = await request.get("/drama-production-package-v1-template.md");
        expect(template.ok()).toBe(true);
        expect(await template.text()).toContain("不阻断交稿或视频提交");
        let previewCount = 0;
        page.on("request", (req) => {
            if (req.url().endsWith("/production-package") && req.postDataJSON()?.action === "preview") previewCount += 1;
        });
        try {
            await page.goto(`/drama/${project.id}`);
            await page.getByRole("button", { name: "完整制作包", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "导入完整制作包" });
            await dialog.getByRole("textbox", { name: "粘贴制作包文本" }).fill(source);
            await dialog.getByRole("button", { name: "识别并预览" }).click();
            const preview = page.locator("[data-drama-production-package-preview]");
            await expect(preview.locator("[data-drama-production-package-import-warnings]")).toContainText("允许导入");
            await expect(preview.locator("[data-drama-production-package-import-warnings]")).toContainText("2500");
            const apply = page.getByRole("button", { name: "继续导入（有警告）" });
            await expect(apply).toBeVisible();
            const box = await apply.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
            await apply.click();
            const confirmation = page.getByRole("dialog", { name: "制作包存在识别警告" });
            await expect(confirmation).toContainText("保留作者公开原稿");
            await confirmation.getByRole("button", { name: "仍然导入" }).click();
            await expect(page.getByText(/已导入 \d+ 个导演镜头/u)).toBeVisible();
            expect(previewCount).toBe(1);
            for (const refresh of [false, true]) {
                if (refresh) await page.reload();
                const response = await request.get(`/api/drama/projects/${project.id}`);
                expect(response.ok(), await response.text()).toBe(true);
                const saved = ((await response.json()) as { data: { project: DramaProject } }).data.project;
                const imported = saved.episodes.find((episode) => episode.code === "E01")!.shots[0];
                expect(imported.videoPrompt).toBe(authored.videoPrompt);
                expect(imported.dialogue).toBe(authored.dialogue);
                expect(imported.utterances[0].text).toBe("外套颜色没变，别说话。");
                expect(imported.framePlan?.frames).toEqual(authored.framePlan.frames);
                expect(saved.characters[0].voiceProfile?.timbrePrompt).toBe(JSON.parse(source).assets.characters[0].voiceProfile.timbrePrompt);
                expect(saved.characters[0]).toMatchObject({ id: "retained-asset", profile: characterAsset.profile, supplierPrompt: characterAsset.supplierPrompt });
                expect(saved.scenes[0]).toMatchObject({ id: "retained-location", description: sceneAsset.description, profile: sceneAsset.profile, supplierPrompt: sceneAsset.supplierPrompt });
            }
            await page.getByRole("button", { name: "打开项目资产" }).click();
            await page
                .getByRole("button", { name: `编辑角色：${characterAsset.name}` })
                .last()
                .click();
            let drawer = page.getByRole("dialog", { name: "编辑角色" });
            await drawer.getByText("实际供应商提示词（可编辑）").click();
            await expect(drawer.getByRole("textbox", { name: "供应商提示词" })).toHaveValue(characterAsset.supplierPrompt);
            await drawer.getByRole("button", { name: "关闭", exact: true }).click();
            await page.locator('[aria-label="项目资产分类"] button').filter({ hasText: "场景" }).click();
            await page
                .getByRole("button", { name: `编辑场景：${sceneAsset.name}` })
                .last()
                .click();
            drawer = page.getByRole("dialog", { name: "编辑场景" });
            await drawer.getByText("实际供应商提示词（可编辑）").click();
            await expect(drawer.getByRole("textbox", { name: "供应商提示词" })).toHaveValue(sceneAsset.supplierPrompt);
        } finally {
            expect((await request.delete(`/api/drama/projects/${project.id}`)).ok()).toBe(true);
        }
    });
}

test("imports a package larger than 20 MiB from file and restores the imported project", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 大制作包 ${randomUUID().slice(0, 8)}`, ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const example = JSON.parse(readFileSync(new URL("../../docs/drama-production-package-v1-field-example.json", import.meta.url), "utf8"));
    example.importPadding = "x".repeat(21 * 1024 * 1024);
    const source = JSON.stringify(example);
    const requestBytes: Record<string, number> = {};
    page.on("request", (req) => {
        if (!req.url().endsWith("/production-package")) return;
        const action = (req.postDataJSON() as { action?: string } | null)?.action;
        if (action) requestBytes[action] = req.postDataBuffer()?.byteLength || 0;
    });

    try {
        await page.goto(`/drama/${project.id}`);
        await page.getByRole("button", { name: "完整制作包", exact: true }).click();
        await page.locator('input[type="file"][accept*="application/json"]').setInputFiles({
            name: "large-package.json",
            mimeType: "application/json",
            buffer: Buffer.from(source),
        });
        await expect(page.locator("[data-drama-production-package-preview]")).toBeVisible();
        const warnings = page.locator("[data-drama-production-package-import-warnings]");
        if (await warnings.count()) {
            await page.getByRole("button", { name: "继续导入（有警告）" }).click();
            await page.getByRole("dialog", { name: "制作包存在识别警告" }).getByRole("button", { name: "仍然导入" }).click();
        } else {
            await page.getByRole("button", { name: "确认应用制作包" }).click();
        }
        await expect(page.getByText(/已导入 \d+ 个导演镜头/u)).toBeVisible();
        expect(requestBytes.preview).toBeGreaterThan(20 * 1024 * 1024);
        expect(requestBytes.apply).toBeGreaterThan(20 * 1024 * 1024);

        await page.reload();
        const restored = await request.get(`/api/drama/projects/${project.id}`);
        expect(restored.ok(), await restored.text()).toBe(true);
        const saved = ((await restored.json()) as { data: { project: DramaProject } }).data.project;
        expect(saved.episodes.some((episode) => episode.code === "E01")).toBe(true);
        expect(saved.sourceAssets?.some((asset) => asset.title === "制作包 large-package.json")).toBe(true);
    } finally {
        expect((await request.delete(`/api/drama/projects/${project.id}`)).ok()).toBe(true);
    }
});

test("character timbre saves and refreshes, then uploaded audio replaces prompt in the video preview", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 角色音色 ${randomUUID().slice(0, 8)}`, ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const source = readFileSync(new URL("../../docs/drama-production-package-v1-field-example.json", import.meta.url), "utf8");
    const endpoint = `/api/drama/projects/${project.id}/production-package`;
    const preview = await request.post(endpoint, { data: { action: "preview", source, fileName: "voice.json" } });
    expect(preview.ok(), await preview.text()).toBe(true);
    const sourceHash = (await preview.json()).data.preview.sourceHash;
    const applied = await request.post(endpoint, { data: { action: "apply", source, fileName: "voice.json", sourceHash } });
    expect(applied.ok(), await applied.text()).toBe(true);
    const imported = ((await applied.json()) as { data: { project: DramaProject } }).data.project;
    const character = imported.characters[0];
    const seeded = structuredClone(imported);
    seeded.characters[0].references = [{ id: "voice-character-image", source: "upload", status: "approved", label: "角色基准", url: `${E2E_PROTOCOL_ORIGIN}/media/fixture.png`, createdAt: new Date().toISOString() }];
    seeded.characters[0].primaryReferenceId = "voice-character-image";
    seeded.episodes[0].reviewStatus = "visual_ready";
    expect((await saveDramaProjectFixture(request, imported, seeded)).ok()).toBe(true);
    const billable: string[] = [];
    page.on("request", (req) => {
        if (req.method() === "POST" && /voice-creation|audio-generation-tasks|video-generation-tasks/.test(req.url())) billable.push(req.url());
    });
    const timbre = "年轻成年女性，中高音区，清亮温润，轻微气声；普通话自然清晰，情绪变化时保持同一声线。";
    const edit = async () => {
        await page.getByRole("button", { name: "打开项目资产" }).click();
        await page
            .getByRole("button", { name: `编辑角色：${character.name}` })
            .last()
            .click();
        return page.getByRole("dialog", { name: "编辑角色" });
    };
    const openPreview = async () => {
        await page.getByRole("button", { name: "切换到镜头生成" }).click();
        await page.getByRole("button", { name: "生成镜头", exact: true }).first().click();
        return page.getByRole("dialog", { name: "确认生成 1 个镜头" });
    };
    try {
        await page.goto(`/drama/${project.id}`);
        let drawer = await edit();
        await drawer.getByRole("textbox", { name: "固定音色提示词" }).fill(timbre);
        await drawer.getByRole("textbox", { name: "台词表演指令" }).fill("克制、停顿自然");
        const save = page.waitForResponse((res) => res.url().endsWith(`/assets/characters/${character.id}`) && res.request().method() === "PATCH");
        await drawer.getByRole("button", { name: "保存设定", exact: true }).click();
        expect((await save).ok()).toBe(true);
        await page.reload();
        drawer = await edit();
        await expect(drawer.getByRole("textbox", { name: "固定音色提示词" })).toHaveValue(timbre);
        await drawer.getByRole("button", { name: "关闭", exact: true }).click();
        await page.getByRole("button", { name: "打开项目资产" }).click();
        let dialog = await openPreview();
        const prompt = dialog.getByRole("textbox", { name: `${seeded.episodes[0].shots[0].title}视频提示词` });
        await expect(prompt).toHaveValue(new RegExp(timbre, "u"));
        await expect(dialog.locator("[data-drama-character-voices]")).toHaveCount(0);
        await expect(dialog.getByText("查看本次引用与配音绑定", { exact: true })).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        await dialog.getByRole("button", { name: "返回修改" }).click();
        drawer = await edit();
        await drawer.locator('input[type="file"][accept*="audio/wav"]').setInputFiles({ name: "voice.wav", mimeType: "audio/wav", buffer: Buffer.from("UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==", "base64") });
        await expect(page.getByText("Clone 音频样本已上传", { exact: true })).toBeVisible();
        await drawer.getByRole("button", { name: "保存设定", exact: true }).click();
        await expect(drawer).toHaveCount(0);
        await page.reload();
        dialog = await openPreview();
        const audioVoice = dialog.locator(`[data-drama-character-voice="${character.id}"]`);
        await expect(dialog.getByRole("textbox", { name: `${seeded.episodes[0].shots[0].title}视频提示词` })).toHaveValue(/【角色音色】[\s\S]*配音引用 @音频1/u);
        expect(await dialog.getByRole("textbox", { name: `${seeded.episodes[0].shots[0].title}视频提示词` }).inputValue()).not.toContain(timbre);
        const audio = audioVoice.getByLabel(`${character.name}角色配音音频`);
        await expect(audio).toBeVisible();
        const audioResponse = await request.get((await audio.getAttribute("src"))!);
        expect(audioResponse.ok()).toBe(true);
        expect(audioResponse.headers()["content-type"]).toContain("audio/");
        const bounds = await audio.boundingBox();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
        await expectNoHorizontalOverflow(page);
        expect(billable).toEqual([]);
    } finally {
        expect((await request.delete(`/api/drama/projects/${project.id}`)).ok()).toBe(true);
    }
});

test("shot assets replace secondary checks and manual fixed references reach the real run", async ({ page, request }) => {
    const settings = e2eSettingsPatch();
    const video = {
        ...settings.systemChannels[0].advancedConfig.operationConfigs.video,
        protocol: "custom",
        createPath: "/custom/videos",
        imageToVideoPath: "/custom/videos",
        queryPath: "/custom/results/:task_id",
        resultField: "data.video_url",
        statusField: "data.status",
        requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","duration":"{{duration}}","images":"{{images}}"}',
    };
    const systemChannels = settings.systemChannels.map((channel) => ({
        ...channel,
        advancedConfig: { ...channel.advancedConfig, protocol: "custom", operationConfigs: { ...channel.advancedConfig.operationConfigs, video }, modelConfigs: { ...channel.advancedConfig.modelConfigs, "e2e-video": video } },
    }));
    const configured = await request.patch("/api/admin/settings", { data: { ...settings, systemChannels } });
    expect(configured.ok()).toBe(true);
    const normalized = (await configured.json()).settings;
    const logicalModels = normalized.logicalModels.map((model: { id: string; bindings: Array<{ capabilityProfile?: Record<string, unknown> }> }) =>
        model.id === "e2e-video" ? { ...model, bindings: model.bindings.map((binding) => ({ ...binding, capabilityProfile: { ...binding.capabilityProfile, maxReferenceImages: 9 } })) } : model,
    );
    const limited = await request.patch("/api/admin/settings", { data: { logicalModels } });
    expect(limited.ok()).toBe(true);
    expect((await limited.json()).settings.logicalModels.find((model: { id: string }) => model.id === "e2e-video").bindings[0].capabilityProfile.maxReferenceImages).toBe(9);
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 手动引用 ${randomUUID().slice(0, 8)}`, ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const empty = (await created.json()).data.project as DramaProject;
    const source = readFileSync(new URL("../../docs/drama-production-package-v1-field-example.json", import.meta.url), "utf8");
    const endpoint = `/api/drama/projects/${empty.id}/production-package`;
    const preview = await request.post(endpoint, { data: { action: "preview", source, fileName: "manual.json" } });
    expect(preview.ok(), await preview.text()).toBe(true);
    const applied = await request.post(endpoint, { data: { action: "apply", source, fileName: "manual.json", sourceHash: (await preview.json()).data.preview.sourceHash } });
    expect(applied.ok(), await applied.text()).toBe(true);
    const imported = (await applied.json()).data.project as DramaProject;
    const seeded = structuredClone(imported);
    const role = seeded.characters[0];
    role.references = [{ id: "main-reference", source: "upload", status: "approved", label: "角色基准", url: `${E2E_PROTOCOL_ORIGIN}/media/fixture.png?main`, createdAt: new Date().toISOString() }];
    role.primaryReferenceId = "main-reference";
    role.voiceProfile = { timbrePrompt: "成年女性中音区，清晰克制", speed: 1, instructions: "" };
    seeded.characters.push({
        ...structuredClone(role),
        id: "manual-character",
        code: "C99",
        name: "手动角色",
        references: [{ ...role.references[0], id: "manual-character-reference", url: `${E2E_PROTOCOL_ORIGIN}/media/fixture.png?manual-character` }],
        primaryReferenceId: "manual-character-reference",
    });
    seeded.characters.push(
        ...Array.from({ length: 5 }, (_, index) => ({
            ...structuredClone(role),
            id: `quota-role-${index}`,
            code: `C${80 + index}`,
            name: `额度角色${index}`,
            references: [{ ...role.references[0], id: `quota-image-${index}`, url: `${E2E_PROTOCOL_ORIGIN}/media/fixture.png?quota-${index}` }],
            primaryReferenceId: `quota-image-${index}`,
        })),
    );
    seeded.characters.push({ ...structuredClone(role), id: "missing-character", code: "C98", name: "未生成角色", references: [], primaryReferenceId: undefined });
    const originalScene = seeded.scenes[0];
    seeded.scenes.push({
        ...structuredClone(originalScene),
        id: "manual-scene",
        code: "S99",
        name: "手动场景",
        references: [{ ...role.references[0], id: "manual-scene-reference", url: `${E2E_PROTOCOL_ORIGIN}/media/fixture.png?manual-scene` }],
        primaryReferenceId: "manual-scene-reference",
        sceneReferenceBoard: { layout: "panorama", referenceId: "manual-scene-reference" },
    });
    const episode = seeded.episodes[0];
    episode.reviewStatus = "visual_ready";
    const shot = episode.shots[0];
    const prop = seeded.props.find((item) => shot.propIds.includes(item.id))!;
    prop.references = [{ ...role.references[0], id: "prop-reference", url: `${E2E_PROTOCOL_ORIGIN}/media/fixture.png?prop` }];
    prop.primaryReferenceId = "prop-reference";
    const clue = { ...structuredClone(prop), id: "bound-clue", code: "CL99", name: "旧钥匙线索", references: [{ ...role.references[0], id: "clue-reference", url: `${E2E_PROTOCOL_ORIGIN}/media/fixture.png?clue` }], primaryReferenceId: "clue-reference" };
    seeded.clues.push(clue);
    shot.clueIds.push(clue.id);
    expect((await saveDramaProjectFixture(request, imported, seeded)).ok()).toBe(true);
    try {
        await page.goto(`/drama/${seeded.id}`);
        await page.getByRole("button", { name: "切换到镜头生成" }).click();
        const missing = page.locator("[data-drama-shot-missing-fixed-assets]").first();
        await expect(missing).toContainText(`场景 · ${originalScene.name}`);
        await expect(missing).toContainText("尚未生成");
        await expect(page.locator("[data-drama-shot-preflight-blockers]")).toHaveCount(0);
        await expect(page.getByText("可选优化，不影响视频生成", { exact: true })).toHaveCount(0);
        await missing.getByRole("button", { name: "去生成 / 确认资产图" }).click();
        await expect(page.getByRole("button", { name: "编辑角色：手动角色" }).last()).toBeVisible();
        await page.getByRole("button", { name: "打开项目资产" }).click();
        await page.locator("[data-drama-generation-panel]").getByRole("button", { name: "生成镜头", exact: true }).first().click();
        const dialog = page.getByRole("dialog", { name: "确认生成 1 个镜头" });
        const gallery = dialog.locator("[data-drama-prompt-reference-gallery]");
        await expect(
            gallery
                .locator("[data-drama-prompt-reference-item]")
                .filter({ hasText: `道具 · ${prop.name}` })
                .getByRole("checkbox"),
        ).toBeChecked();
        await expect(
            gallery
                .locator("[data-drama-prompt-reference-item]")
                .filter({ hasText: `线索 · ${clue.name}` })
                .getByRole("checkbox"),
        ).toBeChecked();
        const promptEditor = dialog.getByRole("textbox", { name: `${shot.title}视频提示词` });
        await promptEditor.fill("");
        await expect(dialog.getByText("视频提示词不能为空", { exact: true })).toBeVisible();
        const editedPrompt = `总体风格：真人实拍，自然窗光。\n0–15秒：人物在窗旁抬起右手，指尖停在旧铜钥匙上。\n音效：衣料轻响。\n${randomUUID()}`;
        await promptEditor.fill(editedPrompt);
        await dialog.getByRole("button", { name: `${shot.title}添加固定资产图` }).click();
        const picker = dialog.locator("[data-drama-fixed-asset-picker]");
        await picker.getByRole("textbox", { name: "搜索固定资产图" }).fill("未生成角色");
        await expect(picker.getByRole("checkbox", { name: "引用固定资产图：角色 · 未生成角色" })).toBeDisabled();
        await picker.getByRole("textbox", { name: "搜索固定资产图" }).fill("手动角色");
        await picker.getByRole("checkbox", { name: "引用固定资产图：角色 · 手动角色" }).check();
        await picker.getByRole("textbox", { name: "搜索固定资产图" }).fill("手动场景");
        await picker.getByRole("checkbox", { name: "引用固定资产图：场景 · 手动场景" }).check();
        await expect(promptEditor).toHaveValue(new RegExp(`^【参考图片】[\\s\\S]*${editedPrompt.split("\n").at(-1)}$`, "u"));
        let completePrompt = await promptEditor.inputValue();
        expect(completePrompt).toContain("@图片4：角色「手动角色」");
        expect(completePrompt).toContain("@图片5：场景「手动场景」");
        expect(completePrompt).not.toContain("项目资产基准图");
        expect(completePrompt).not.toContain("参考素材一致性要求");
        await expect(dialog.locator("[data-drama-prompt-reference-gallery]").getByRole("img", { name: "角色 · 手动角色" })).toBeVisible();
        await expect(dialog.locator("[data-drama-prompt-reference-gallery]").getByRole("img", { name: "场景 · 手动场景" })).toBeVisible();
        await picker.getByRole("textbox", { name: "搜索固定资产图" }).fill("额度角色");
        for (let index = 0; index < 4; index++) await picker.getByRole("checkbox", { name: `引用固定资产图：角色 · 额度角色${index}` }).check();
        await expect(dialog.getByText("9/9 张", { exact: false })).toBeVisible();
        await picker.getByRole("checkbox", { name: "引用固定资产图：角色 · 额度角色4" }).check();
        await expect(dialog.getByText("超出 1 张", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "确认生成", exact: true }).click();
        await expect(dialog).toBeVisible();
        for (let index = 0; index < 5; index++) await picker.getByRole("checkbox", { name: `引用固定资产图：角色 · 额度角色${index}` }).uncheck();
        await expect(promptEditor).toHaveValue(completePrompt);
        completePrompt = `  ${completePrompt}\n作者补充：远处车辆经过时保持原人物站位。\n`;
        await promptEditor.fill(completePrompt);
        const bounds = await dialog.boundingBox();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
        const grid = await gallery
            .locator(".grid")
            .first()
            .evaluate((element) => ({
                display: getComputedStyle(element).display,
                columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
                cells: Array.from(element.children).map((cell) => ({ x: cell.getBoundingClientRect().x, right: cell.getBoundingClientRect().right, width: cell.getBoundingClientRect().width })),
            }));
        expect(grid.display).toBe("grid");
        expect(new Set(grid.cells.slice(0, grid.columns).map((cell) => Math.round(cell.x))).size).toBe(page.viewportSize()!.width < 640 ? 2 : 4);
        expect(grid.cells.every((cell) => cell.width > 0 && cell.right <= page.viewportSize()!.width)).toBe(true);
        const responsePromise = page.waitForResponse((response) => response.url().endsWith(`/projects/${seeded.id}/production-runs`) && response.request().method() === "POST");
        await dialog.getByRole("button", { name: "确认生成", exact: true }).click();
        const response = await responsePromise;
        expect(response.ok(), await response.text()).toBe(true);
        const run = (await response.json()).data.run;
        expect(run.parameterSnapshot.referenceSelections[shot.id]).toEqual([role.id, prop.id, clue.id, "manual-character", "manual-scene"]);
        expect(run.parameterSnapshot.videoPrompts[shot.id]).toBe(completePrompt);
        let dispatched = run;
        await expect
            .poll(async () => {
                dispatched = (await (await request.get(`/api/drama/projects/${seeded.id}/production-runs?episodeId=${episode.id}`)).json()).data.run;
                return dispatched.steps.find((item: { type: string }) => item.type === "video")?.executionPrompt || "";
            })
            .toBe(completePrompt);
        const step = dispatched.steps.find((step: { type: string }) => step.type === "video");
        expect(step.prompt).toBe(completePrompt);
        expect(step.executionPrompt, step.error).toBe(completePrompt);
        expect(step.executionPrompt).not.toContain(shot.videoPrompt);
        const upstream = await (await request.get(`${E2E_PROTOCOL_ORIGIN}/__state`)).json();
        const submission = upstream.requests.find((item: { method: string; prompt?: string }) => item.method === "POST" && item.prompt?.includes(editedPrompt));
        expect(submission).toBeDefined();
        expect(submission.prompt).toBe(completePrompt);
        expect(submission.images).toEqual(step.referenceBindingsSnapshot.map((binding: { url: string }) => binding.url));
        expect(step.referenceBindingsSnapshot).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "manual-character", role: "character_anchor" }), expect.objectContaining({ sourceId: "manual-scene", role: "scene_anchor" })]));
        const fresh = (await (await request.get(`/api/drama/projects/${seeded.id}/production-runs?episodeId=${episode.id}`)).json()).data.run;
        expect(fresh.parameterSnapshot.referenceSelections).toEqual(run.parameterSnapshot.referenceSelections);
        expect(fresh.parameterSnapshot.videoPrompts).toEqual(run.parameterSnapshot.videoPrompts);
        await pollTask(request, `/api/video-tasks/${step.taskId}`);
    } finally {
        expect((await request.delete(`/api/drama/projects/${seeded.id}`)).ok()).toBe(true);
        expect((await request.patch("/api/admin/settings", { data: e2eSettingsPatch() })).ok()).toBe(true);
    }
});
