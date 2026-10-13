import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { E2E_PROTOCOL_ORIGIN, saveDramaProjectFixture } from "./support";
import { expectNoHorizontalOverflow } from "./responsive-helpers";
import type { DramaProject } from "../src/lib/drama-project-contract";

for (const layout of ["cards", "timeline"]) {
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
        const authored = JSON.parse(source).episodes[0].shots[0];
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
        const voice = dialog.locator(`[data-drama-character-voice="${character.id}"]`);
        await expect(voice).toContainText("使用音色提示词");
        await expect(voice).toContainText(timbre);
        await expect(dialog.locator("[data-drama-character-voices] audio")).toHaveCount(0);
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
        await expect(audioVoice).toContainText("引用角色配音音频");
        await expect(audioVoice).not.toContainText(timbre);
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
