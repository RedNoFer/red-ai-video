import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";

import { exportDramaVideos, type DramaVideoExportProgress } from "@/lib/server/drama-video-export";
import { dramaVideoExportArchivePath, updateDramaVideoExportJob, type DramaVideoExportJob } from "@/lib/server/drama-video-export-store";
import { getDramaProjectForUser } from "@/lib/server/drama-project-service";

const globalRunner = globalThis as typeof globalThis & { __vozebProDramaVideoExportActive?: Set<string> };
const activeJobs = (globalRunner.__vozebProDramaVideoExportActive ??= new Set<string>());

/** 占用任务槽位，返回 false 表示已有进程在跑同一个任务。 */
export function prepareDramaVideoExportJob(id: string) {
    if (activeJobs.has(id)) return false;
    activeJobs.add(id);
    return true;
}

/** 页面或状态轮询恢复因进程重启而中断的任务。 */
export function prepareResumableDramaVideoExportJobs(jobs: DramaVideoExportJob[]) {
    const prepared: DramaVideoExportJob[] = [];
    for (const job of jobs) {
        if (job.status !== "pending" && job.status !== "running") continue;
        if (!prepareDramaVideoExportJob(job.id)) continue;
        prepared.push(job);
    }
    return prepared;
}

export async function runDramaVideoExportJob(job: DramaVideoExportJob, context: { origin: string; cookie?: string }) {
    activeJobs.add(job.id);
    const archivePath = dramaVideoExportArchivePath(job.id);
    const partPath = `${archivePath}.part`;
    let current: DramaVideoExportJob = job;
    let lastPersistedAt = 0;
    const persist = async (patch: Partial<DramaVideoExportJob>, force = false) => {
        current = { ...current, ...patch, updatedAt: Date.now() };
        if (!force && Date.now() - lastPersistedAt < 500) return;
        lastPersistedAt = Date.now();
        const snapshot = current;
        await updateDramaVideoExportJob(snapshot).catch((error) => console.error("drama video export progress persist failed", error));
    };
    try {
        await mkdir(dirname(archivePath), { recursive: true });
        await persist({ status: "running", phase: "queued", message: "正在准备导出", error: undefined }, true);
        const project = await getDramaProjectForUser(job.userId, job.projectId);
        const result = await exportDramaVideos({
            project,
            entries: job.input.entries,
            origin: context.origin,
            cookie: context.cookie,
            subtitleModes: job.input.subtitleModes,
            includeOriginals: job.input.includeOriginals,
            onProgress: (progress) => {
                void persist({ phase: progress.phase, message: progressMessage(progress), progress: normalizeProgress(progress), status: "running" });
            },
        });
        await pipeline(Readable.fromWeb(result.stream as unknown as NodeReadableStream<Uint8Array>), createWriteStream(partPath));
        await rm(archivePath, { force: true });
        await rename(partPath, archivePath);
        const details = await stat(archivePath);
        await persist(
            {
                status: "success",
                phase: "done",
                message: "导出完成",
                fileName: result.fileName,
                archiveBytes: details.size,
                exported: result.exported,
                failed: result.failed,
                error: undefined,
            },
            true,
        );
    } catch (error) {
        await rm(partPath, { force: true }).catch(() => undefined);
        await persist(
            {
                status: "error",
                phase: "failed",
                message: "导出失败",
                error: error instanceof Error ? error.message : "批量下载视频失败",
            },
            true,
        );
    } finally {
        activeJobs.delete(job.id);
    }
}

function normalizeProgress(progress: DramaVideoExportProgress) {
    return {
        done: progress.done,
        total: progress.total,
        bytes: progress.bytes,
        subtitlesDone: progress.subtitlesDone,
        subtitlesTotal: progress.subtitlesTotal,
    };
}

function progressMessage(progress: DramaVideoExportProgress) {
    if (progress.phase === "downloading") {
        if (progress.done >= progress.total) return `视频已接收 ${formatBytes(progress.bytes)}，准备处理`;
        return `正在下载视频（${Math.min(progress.done + 1, progress.total)}/${progress.total}）· 已接收 ${formatBytes(progress.bytes)}`;
    }
    if (progress.phase === "subtitles") {
        return `正在烧录字幕（${Math.min(progress.subtitlesDone + 1, progress.subtitlesTotal)}/${progress.subtitlesTotal}）· 已接收 ${formatBytes(progress.bytes)}`;
    }
    return `正在打包 ZIP · 已接收 ${formatBytes(progress.bytes)}`;
}

function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
