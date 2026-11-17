import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDramaVideoExportJob, getDramaVideoExportJob, listDramaVideoExportJobs, publicDramaVideoExportJob, removeDramaVideoExportJob, updateDramaVideoExportJob } from "./drama-video-export-store";

const entry = {
    episodeId: "episode-one",
    episodeTitle: "第 1 集",
    episodeOrder: 1,
    shotId: "shot-one",
    shotCode: "SH01",
    shotTitle: "开场",
    videoId: "video-one",
    url: "/api/reference-assets/token",
};

describe("Drama video export job store", () => {
    let dataDir = "";
    const previous = process.env.VOZEB_PRO_DATA_DIR;

    beforeEach(async () => {
        dataDir = await mkdtemp(join(tmpdir(), "vozeb-drama-export-store-"));
        process.env.VOZEB_PRO_DATA_DIR = dataDir;
    });

    afterEach(async () => {
        if (previous === undefined) delete process.env.VOZEB_PRO_DATA_DIR;
        else process.env.VOZEB_PRO_DATA_DIR = previous;
        await rm(dataDir, { recursive: true, force: true });
    });

    it("persists a pending job and exposes progress without leaking input", async () => {
        const job = await createDramaVideoExportJob({
            userId: "user-one",
            projectId: "project-one",
            projectTitle: "测试短剧",
            entries: [entry],
            subtitleModes: ["bilingual"],
            includeOriginals: true,
        });
        const stored = await getDramaVideoExportJob(job.id);
        expect(stored).toMatchObject({ status: "pending", phase: "queued", progress: { total: 1 } });

        const view = publicDramaVideoExportJob(stored!);
        expect(view).not.toHaveProperty("userId");
        expect(view).not.toHaveProperty("input");
        expect(view.downloadUrl).toBeUndefined();

        const running = await updateDramaVideoExportJob({ ...stored!, status: "running", phase: "downloading", progress: { done: 1, total: 1, bytes: 2048, subtitlesDone: 0, subtitlesTotal: 1 } });
        expect((await getDramaVideoExportJob(job.id))!.progress.bytes).toBe(2048);
        expect(running.updatedAt).toBeGreaterThanOrEqual(stored!.updatedAt);
    });

    it("lists recent jobs by owner and project and adds a download URL after success", async () => {
        const first = await createDramaVideoExportJob({ userId: "user-one", projectId: "project-one", projectTitle: "A", entries: [entry], subtitleModes: [], includeOriginals: true });
        const second = await createDramaVideoExportJob({ userId: "user-two", projectId: "project-one", projectTitle: "B", entries: [entry], subtitleModes: [], includeOriginals: true });
        await updateDramaVideoExportJob({ ...first, status: "success", phase: "done", fileName: "短剧视频.zip" });

        const listed = await listDramaVideoExportJobs({ userId: "user-one", projectId: "project-one" });
        expect(listed.map((job) => job.id)).toEqual([first.id]);
        expect(publicDramaVideoExportJob(listed[0]).downloadUrl).toBe(`/api/drama/projects/project-one/export-videos/${first.id}/download`);
        expect(await listDramaVideoExportJobs({ userId: "user-two" })).toHaveLength(1);
        expect(second.userId).toBe("user-two");
    });

    it("ignores invalid identifiers and removes expired jobs", async () => {
        expect(await getDramaVideoExportJob("../etc")).toBeNull();

        const job = await createDramaVideoExportJob({ userId: "user-one", projectId: "project-one", projectTitle: "A", entries: [entry], subtitleModes: [], includeOriginals: true });
        await updateDramaVideoExportJob({ ...job, expiresAt: Date.now() - 1 });
        expect(await getDramaVideoExportJob(job.id)).toBeNull();
        expect(await listDramaVideoExportJobs({ userId: "user-one" })).toHaveLength(0);

        await removeDramaVideoExportJob(job.id);
        expect(await getDramaVideoExportJob(job.id)).toBeNull();
    });
});
