import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { DramaProject } from "../src/lib/drama-project-contract";

test("external package warnings permit one preview and preserve author prose after refresh", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 外部原稿 ${randomUUID().slice(0, 8)}`, ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const source = readFileSync(new URL("../../docs/drama-production-package-v1-field-example.json", import.meta.url), "utf8");
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
        }
    } finally {
        expect((await request.delete(`/api/drama/projects/${project.id}`)).ok()).toBe(true);
    }
});
