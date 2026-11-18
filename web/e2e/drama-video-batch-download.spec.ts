import path from "node:path";
import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";

import type { DramaEpisode, DramaProject, DramaShot } from "../src/lib/drama-project-contract";
import { readJsonDataFile, withJsonDataFileLock, writeJsonDataFile } from "../src/lib/server/data-adapter";
import { expectDialogWithinViewport, expectNoHorizontalOverflow } from "./responsive-helpers";
import { saveDramaProjectFixture } from "./support";

test.use({ storageState: ".e2e-data/admin-state.json" });

test("批量下载视频按剧集分组展示，默认全选并把勾选视频打包到本地", async ({ page, request }) => {
    process.env.VOZEB_PRO_DATA_DIR = path.resolve(process.cwd(), ".e2e-data");
    const created = await request.post("/api/drama/projects", { data: { title: `E2E 批量下载视频 ${Date.now()}`, ratio: "16:9" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: DramaProject } }).data.project;
    const episode = project.episodes[0];
    const user = (await (await request.get("/api/auth/session")).json()).user as { id: string };
    const videoBytes = await readFile(path.resolve(process.cwd(), "e2e/fixtures/video-recovery.mp4"));

    const uploadVideo = async (name: string) => {
        const uploaded = await request.post("/api/reference-assets", {
            multipart: { file: { name, mimeType: "video/mp4", buffer: videoBytes }, type: "video", persistent: "true", originalName: name },
        });
        expect(uploaded.ok(), await uploaded.text()).toBe(true);
        return ((await uploaded.json()) as { url: string }).url;
    };

    const currentUrl = await uploadVideo("batch-download-current.mp4");
    const candidateUrl = await uploadVideo("batch-download-candidate.mp4");
    const secondEpisodeUrl = await uploadVideo("batch-download-second-episode.mp4");

    const subtitleScript = ["【SH01｜0–30秒｜开场】", "", '"You finally came."', "中译：你终于来了。", "", "【SH02｜30–60秒｜对峙】", "", "她把信封推过桌面。", '"你还是不肯说。"', "中译：你还是不肯说。"].join("\n");
    const shots = [shot(`${project.id}-shot-1`, "SH01", 1, "开场", currentUrl), shot(`${project.id}-shot-2`, "SH02", 2, "对峙", candidateUrl)];
    const secondEpisode: DramaEpisode = {
        ...episode,
        id: `${project.id}-episode-two`,
        title: "第 2 集",
        shots: [shot(`${project.id}-shot-3`, "SH01", 1, "收尾", secondEpisodeUrl)],
    };

    try {
        const saved = await saveDramaProjectFixture(request, project, {
            ...project,
            activeEpisodeId: episode.id,
            episodes: [{ ...episode, script: subtitleScript, reviewStatus: "visual_ready", shots }, secondEpisode],
        });
        expect(saved.ok(), await saved.text()).toBe(true);

        // 一次历史重生成成功记录：服务端按成功视频任务汇总每个片段的全部视频。
        const candidateTaskId = `${project.id}-task-candidate`;
        await withJsonDataFileLock("generation-tasks.json", async () => {
            const existing = await readJsonDataFile<unknown[]>("generation-tasks.json", []);
            await writeJsonDataFile("generation-tasks.json", [
                ...existing,
                {
                    id: candidateTaskId,
                    type: "video",
                    userId: user.id,
                    status: "success",
                    expiresAt: Date.now() + 86_400_000,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    projectId: project.id,
                    episodeId: episode.id,
                    shotId: shots[0].id,
                    surface: "drama",
                    payload: {
                        id: candidateTaskId,
                        userId: user.id,
                        status: "success",
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        projectId: project.id,
                        episodeId: episode.id,
                        shotId: shots[0].id,
                        surface: "drama",
                        config: { model: "e2e-video" },
                        upstream: { id: `provider-${candidateTaskId}`, provider: "openai", model: "e2e-video" },
                        result: { url: candidateUrl },
                    },
                },
            ]);
        });

        await page.goto(`/drama/${project.id}`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "切换到镜头生成" }).click();
        await expect(page.locator("[data-drama-shot-task]")).toHaveCount(2);
        await expect(page.locator("[data-drama-shot-task] video")).toHaveCount(0);

        const previewOption = (label: string) => page.locator(`.ant-select-dropdown:visible .ant-select-item-option[title="${label}"]`);
        const englishPreview = page.getByRole("dialog", { name: "开场生成视频" });
        await page.getByRole("button", { name: "查看视频：开场生成视频" }).click();
        await expect(englishPreview).toBeVisible();
        await expect(englishPreview.getByRole("checkbox", { name: "带字幕下载" })).not.toBeChecked();
        await expect(englishPreview.getByRole("link", { name: "下载视频" })).toBeVisible();
        await englishPreview.getByRole("checkbox", { name: "带字幕下载" }).check();
        await expect(englishPreview.locator(".ant-select-content")).toHaveText("双语字幕（英/中）");
        await englishPreview.getByRole("combobox", { name: "字幕版本" }).click();
        await expect(previewOption("英文字幕单独版")).not.toHaveClass(/ant-select-item-option-disabled/);
        await previewOption("英文字幕单独版").click();
        await expect(englishPreview.locator(".ant-select-content")).toHaveText("英文字幕单独版");
        await expect(englishPreview.getByRole("button", { name: "下载英文字幕视频" })).toBeVisible();
        await expectDialogWithinViewport(englishPreview);
        await englishPreview.locator(".ant-modal-close").click();
        await expect(englishPreview).toBeHidden();

        const chinesePreview = page.getByRole("dialog", { name: "对峙生成视频" });
        await page.getByRole("button", { name: "查看视频：对峙生成视频" }).click();
        await expect(chinesePreview).toBeVisible();
        await expect(chinesePreview.getByRole("checkbox", { name: "带字幕下载" })).not.toBeChecked();
        await expect(chinesePreview.getByRole("link", { name: "下载视频" })).toBeVisible();
        await chinesePreview.getByRole("checkbox", { name: "带字幕下载" }).check();
        await chinesePreview.getByRole("combobox", { name: "字幕版本" }).click();
        await expect(previewOption("英文字幕单独版")).toHaveClass(/ant-select-item-option-disabled/);
        await chinesePreview.getByRole("combobox", { name: "字幕版本" }).press("Escape");
        await expect(previewOption("英文字幕单独版")).toBeHidden();
        await expectNoHorizontalOverflow(page, "单镜字幕预览");
        await expectDialogWithinViewport(chinesePreview);
        await chinesePreview.locator(".ant-modal-close").click();
        await expect(chinesePreview).toBeHidden();

        await page.getByRole("button", { name: "批量下载视频" }).click();

        const modal = page.getByRole("dialog", { name: "批量下载视频" });
        await expect(modal).toBeVisible();
        await expect(modal.locator("[data-drama-video-download-group]")).toHaveCount(2);
        await expect(modal.locator("[data-drama-video-download-summary]")).toHaveText("已选 4 / 4 个视频，打包为 ZIP 并按剧集分文件夹保存到本地下载目录");
        await expect(modal.getByRole("checkbox", { name: "选择开场当前视频" })).toBeChecked();
        await expect(modal.getByRole("checkbox", { name: "选择开场候选视频" })).toBeChecked();
        await expect(modal.getByRole("checkbox", { name: "选择对峙当前视频" })).toBeChecked();
        const originalsWithSubtitles = modal.getByRole("checkbox", { name: "同时导出字幕版（保留原片）" });
        const subtitlesOnly = modal.getByRole("checkbox", { name: "仅字幕版（不含原片）" });
        await expect(originalsWithSubtitles).toBeEnabled();
        await expect(originalsWithSubtitles).not.toBeChecked();
        await expect(subtitlesOnly).toBeEnabled();
        await expect(subtitlesOnly).not.toBeChecked();
        await expect(modal.locator("[data-drama-video-download-subtitles-note]")).toContainText("当前只下载原片");
        await expect(modal.getByRole("combobox", { name: "字幕版本" })).toHaveCount(0);
        await originalsWithSubtitles.check();
        await expect(originalsWithSubtitles).toBeChecked();
        await expect(modal.locator("[data-drama-video-download-subtitles-note]")).toContainText("双语字幕英文在上、中文在下");
        const subtitleRow = modal.locator("[data-drama-video-download-subtitles]");
        const subtitleMode = subtitleRow.getByRole("combobox", { name: "字幕版本" });
        const subtitleModeLabel = subtitleRow.locator("[data-drama-video-download-subtitle-mode] .ant-select-content");
        const subtitleOption = (label: string) => page.locator(`.ant-select-dropdown:visible .ant-select-item-option[title="${label}"]`);
        const chooseSubtitleMode = async (label: string) => {
            await subtitleMode.click();
            await subtitleOption(label).click();
            await expect(subtitleModeLabel).toHaveText(label);
        };
        await expect(subtitleModeLabel).toHaveText("双语字幕（英文主行 + 中文副行）");
        await chooseSubtitleMode("英文单独版（英文烧录视频 + 英文 SRT）");
        await chooseSubtitleMode("双语 + 英文单独版（额外导出）");
        await chooseSubtitleMode("双语字幕（英文主行 + 中文副行）");

        await modal.getByRole("checkbox", { name: "选择开场当前视频" }).uncheck();
        await modal.getByRole("checkbox", { name: "选择开场候选视频" }).uncheck();
        await expect(modal.getByRole("checkbox", { name: "同时导出字幕版（保留原片）" })).toBeEnabled();
        await subtitleMode.click();
        await expect(subtitleOption("英文单独版（英文烧录视频 + 英文 SRT）")).toHaveClass(/ant-select-item-option-disabled/);
        await expect(subtitleOption("双语 + 英文单独版（额外导出）")).toHaveClass(/ant-select-item-option-disabled/);
        await page.keyboard.press("Escape");
        await expect(subtitleOption("英文单独版（英文烧录视频 + 英文 SRT）")).toBeHidden();
        await modal.getByRole("checkbox", { name: "选择对峙当前视频" }).uncheck();
        await expect(originalsWithSubtitles).toBeDisabled();
        await expect(originalsWithSubtitles).not.toBeChecked();
        await expect(subtitlesOnly).toBeDisabled();
        await expect(subtitlesOnly).not.toBeChecked();
        await expect(modal.locator("[data-drama-video-download-subtitles-note]")).toContainText("没有可烧录的台词或旁白");
        await expect(modal.getByRole("combobox", { name: "字幕版本" })).toHaveCount(0);
        await modal.getByRole("checkbox", { name: "选择开场当前视频" }).check();
        await modal.getByRole("checkbox", { name: "选择开场候选视频" }).check();
        await modal.getByRole("checkbox", { name: "选择对峙当前视频" }).check();
        await expect(originalsWithSubtitles).toBeEnabled();
        await expect(originalsWithSubtitles).not.toBeChecked();
        await expect(subtitlesOnly).toBeEnabled();
        await expect(subtitlesOnly).not.toBeChecked();
        await expect(modal.getByRole("combobox", { name: "字幕版本" })).toHaveCount(0);
        await expect(modal.locator("[data-drama-video-download-subtitles-note]")).toContainText("当前只下载原片");
        await subtitlesOnly.check();
        await expect(subtitlesOnly).toBeChecked();
        await expect(originalsWithSubtitles).not.toBeChecked();
        await expect(modal.locator("[data-drama-video-download-subtitles-note]")).toContainText("不含原片");
        await expect(modal.getByRole("button", { name: /下载所选字幕版/ })).toHaveText(/4/);
        await expect(modal.getByRole("combobox", { name: "字幕版本" })).toHaveCount(1);
        await expect(subtitleModeLabel).toHaveText("双语字幕（英文主行 + 中文副行）");
        await subtitlesOnly.uncheck();
        await expect(originalsWithSubtitles).not.toBeChecked();
        await expect(subtitlesOnly).not.toBeChecked();
        await expect(modal.locator("[data-drama-video-download-subtitles-note]")).toContainText("当前只下载原片");
        await expect(modal.getByRole("button", { name: /下载所选视频/ })).toHaveText(/4/);

        await modal.getByRole("checkbox", { name: "选择对峙当前视频" }).uncheck();
        await expect(modal.locator("[data-drama-video-download-summary]")).toContainText("已选 3 / 4 个视频");
        await expectNoHorizontalOverflow(page, "批量下载视频弹窗");
        await expectDialogWithinViewport(modal);

        const downloadStarted = page.waitForEvent("download");
        await modal.getByRole("button", { name: /下载所选视频/ }).click();
        const download = await downloadStarted;
        await expect(modal.locator("[data-drama-video-export-progress]")).toHaveAttribute("data-status", "success");
        await expect(modal.getByRole("button", { name: "下载 ZIP" })).toBeVisible();
        const archive = path.resolve(process.cwd(), ".e2e-artifacts/drama-batch-videos.zip");
        await download.saveAs(archive);
        const files = unzipSync(new Uint8Array(await readFile(archive)));
        const names = Object.keys(files);

        expect(names).toEqual(expect.arrayContaining(["manifest.json", expect.stringMatching(/^01_.*\/SH01_开场\.mp4$/), expect.stringMatching(/^01_.*\/SH01_开场_2\.mp4$/), expect.stringMatching(/^02_.*\/SH01_收尾\.mp4$/)]));
        expect(names.some((name) => name.includes("对峙"))).toBe(false);
    } finally {
        const deleted = await request.delete(`/api/drama/projects/${project.id}`);
        expect(deleted.ok(), await deleted.text()).toBe(true);
    }
});

function shot(id: string, code: string, order: number, title: string, videoUrl: string, subtitleText?: string): DramaShot {
    return {
        id,
        code,
        order,
        title,
        description: "人物在室内抬头",
        sourceText: "人物在室内抬头",
        shotBoundary: "",
        dialogue: subtitleText || "",
        narration: "",
        utterances: [],
        imagePrompt: "夜景室内",
        videoPrompt: "人物在室内抬头，听到门外声响后站定。",
        cameraMotion: "固定",
        duration: 5,
        characterIds: [],
        propIds: [],
        clueIds: [],
        ...(subtitleText ? { subtitle: subtitleText } : {}),
        videoUrl,
    };
}
