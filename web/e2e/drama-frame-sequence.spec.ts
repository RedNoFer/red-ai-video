import { expect, test } from "@playwright/test";

import type { DramaProject } from "../src/lib/drama-project-contract";
import { expectNoHorizontalOverflow } from "./responsive-helpers";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("drama all-frame editor keeps one beat per row across desktop, mobile and dark theme", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 逐帧计划", summary: "验证逐帧计划编辑器", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const episode = project.episodes[0];
    const frames = Array.from({ length: 4 }, (_, index) => ({
        id: `beat-${index + 1}`,
        sequenceIndex: index + 1,
        startSecond: index * 2,
        endSecond: (index + 1) * 2,
        actionPrompt: `动作 ${index + 1}`,
        imagePrompt: `画面 ${index + 1}，保持人物、服装、场景和光向连续`,
    }));
    const seeded: DramaProject = {
        ...project,
        defaultVideoMode: "storyboard",
        activeEpisodeId: episode.id,
        episodes: [
            {
                ...episode,
                reviewStatus: "visual_ready",
                continuityEdges: [],
                shots: [
                    {
                        id: "shot-frame-sequence",
                        code: "SH001",
                        order: 1,
                        title: "八秒连续动作",
                        description: "人物从静止到转身离开",
                        sourceText: "人物抬头、握紧道具、转身并离开。",
                        shotBoundary: "连续动作",
                        dialogue: "",
                        narration: "",
                        utterances: [],
                        imagePrompt: "竖屏中景，人物站在冷色场景中央",
                        videoPrompt: "人物完成连续动作，镜头缓慢推进",
                        cameraMotion: "缓慢推进",
                        duration: 8,
                        characterIds: [],
                        propIds: [],
                        clueIds: [],
                        videoMode: "storyboard",
                        storyboardFrameMode: "all_frames",
                        framePlan: { start: { source: "independent" }, end: { required: false }, frames },
                        storyboardFrames: frames.map((frame, index) => ({
                            id: frame.id,
                            sequenceIndex: frame.sequenceIndex,
                            source: index < 2 ? "upload" : "generated",
                            status: index < 2 ? "success" : index === 2 ? "stale" : "idle",
                            mediaUrl: index < 2 ? "/logo.svg" : undefined,
                            continuityStatus: index < 2 ? "passed" : index === 2 ? "stale" : "pending",
                        })),
                        storyboardStatus: "idle",
                        generationStatus: "idle",
                        audioMode: "source",
                        audioStatus: "idle",
                        continuityStatus: "ready",
                        fieldOrigins: { framePlan: "package" },
                    },
                ],
            },
        ],
    };
    const saved = await request.patch(`/api/drama/projects/${project.id}`, { data: seeded });
    expect(saved.ok(), await saved.text()).toBe(true);

    await page.setViewportSize({ width: 1672, height: 960 });
    await page.goto(`/drama/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "切换到分镜" }).click();
    await page.getByRole("button", { name: "展开" }).click();
    const sequence = page.locator("[data-drama-frame-sequence]");
    await expect(sequence).toBeVisible();
    await expect(sequence.locator("[data-drama-frame-row]")).toHaveCount(4);
    await expect(page.getByRole("button", { name: "一键补齐" })).toBeVisible();
    await expect(page.getByRole("button", { name: "重新生成全部" })).toBeVisible();
    await assertVerticalRows(sequence);
    await expectNoHorizontalOverflow(page, "1672px light frame sequence");

    const secondAction = sequence.locator("[data-drama-frame-row='beat-2'] textarea").first();
    await secondAction.fill("动作 2 已人工调整");
    await expect(secondAction).toHaveValue("动作 2 已人工调整");
    await sequence.getByRole("button", { name: "在帧 2 后增加帧" }).click();
    await expect(sequence.locator("[data-drama-frame-row]")).toHaveCount(5);
    await assertVerticalRows(sequence);

    for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
        { width: 430, height: 932 },
    ]) {
        await page.setViewportSize(viewport);
        await expect(sequence).toBeVisible();
        await assertVerticalRows(sequence);
        await expectNoHorizontalOverflow(page, `${viewport.width}px light frame sequence`);
    }

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expectNoHorizontalOverflow(page, "430px dark frame sequence");
    await page.setViewportSize({ width: 1672, height: 960 });
    await expectNoHorizontalOverflow(page, "1672px dark frame sequence");
});

async function assertVerticalRows(sequence: import("@playwright/test").Locator) {
    const boxes = await sequence.locator("[data-drama-frame-row]").evaluateAll((rows) =>
        rows.map((row) => {
            const box = row.getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth };
        }),
    );
    expect(boxes.every((box, index) => index === 0 || box.top >= boxes[index - 1].bottom)).toBe(true);
    expect(boxes.every((box) => box.scrollWidth <= box.clientWidth + 1 && box.right > box.left)).toBe(true);
}
