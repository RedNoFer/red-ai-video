import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import type { DramaSubtitleExportMode } from "@/lib/drama-subtitle-plan";
import { listDataDirectory, readJsonDataFile, resolveDataPath, writeJsonDataFile } from "@/lib/server/data-adapter";
import type { DramaVideoExportEntry } from "@/lib/server/drama-video-export";

const EXPORT_DIR = "drama-video-exports";
const TTL_MS = 24 * 60 * 60 * 1000;
const JOB_ID_PATTERN = /^[0-9a-f-]{36}$/i;

export type DramaVideoExportJobStatus = "pending" | "running" | "success" | "error";
export type DramaVideoExportJobPhase = "queued" | "downloading" | "subtitles" | "packaging" | "done" | "failed";

export type DramaVideoExportJob = {
    id: string;
    userId: string;
    projectId: string;
    projectTitle: string;
    status: DramaVideoExportJobStatus;
    phase: DramaVideoExportJobPhase;
    message: string;
    progress: {
        done: number;
        total: number;
        bytes: number;
        subtitlesDone: number;
        subtitlesTotal: number;
    };
    fileName: string;
    archiveBytes: number;
    exported: number;
    failed: number;
    error?: string;
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
    input: {
        entries: DramaVideoExportEntry[];
        subtitleModes: DramaSubtitleExportMode[];
        includeOriginals: boolean;
    };
};

export type DramaVideoExportJobPublic = Omit<DramaVideoExportJob, "userId" | "input"> & { downloadUrl?: string };

export async function createDramaVideoExportJob(input: { userId: string; projectId: string; projectTitle: string; entries: DramaVideoExportEntry[]; subtitleModes: DramaSubtitleExportMode[]; includeOriginals: boolean }) {
    const now = Date.now();
    const job: DramaVideoExportJob = {
        id: randomUUID(),
        userId: input.userId,
        projectId: input.projectId,
        projectTitle: input.projectTitle,
        status: "pending",
        phase: "queued",
        message: "导出任务排队中",
        progress: { done: 0, total: input.entries.length, bytes: 0, subtitlesDone: 0, subtitlesTotal: 0 },
        fileName: "",
        archiveBytes: 0,
        exported: 0,
        failed: 0,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + TTL_MS,
        input: { entries: input.entries, subtitleModes: input.subtitleModes, includeOriginals: input.includeOriginals },
    };
    await writeJob(job);
    return job;
}

export async function getDramaVideoExportJob(id: string) {
    if (!JOB_ID_PATTERN.test(id)) return null;
    const job = await readJsonDataFile<DramaVideoExportJob | null>(jobFileName(id), null);
    if (!job || job.id !== id) return null;
    if (job.expiresAt <= Date.now()) {
        await removeDramaVideoExportJob(id);
        return null;
    }
    return job;
}

export async function updateDramaVideoExportJob(job: DramaVideoExportJob) {
    const next = { ...job, updatedAt: Date.now() };
    await writeJob(next);
    return next;
}

export async function listDramaVideoExportJobs(input: { userId: string; projectId?: string; limit?: number }) {
    let entries: Awaited<ReturnType<typeof listDataDirectory>> = [];
    try {
        entries = await listDataDirectory(EXPORT_DIR);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
    }
    const jobs: DramaVideoExportJob[] = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const id = entry.name.slice(0, -".json".length);
        const job = await getDramaVideoExportJob(id);
        if (!job || job.userId !== input.userId) continue;
        if (input.projectId && job.projectId !== input.projectId) continue;
        jobs.push(job);
    }
    jobs.sort((left, right) => right.createdAt - left.createdAt);
    return jobs.slice(0, Math.max(1, input.limit ?? 10));
}

export async function removeDramaVideoExportJob(id: string) {
    if (!JOB_ID_PATTERN.test(id)) return;
    await rm(resolveDataPath(`${EXPORT_DIR}/${id}.json`), { force: true }).catch(() => undefined);
    await rm(dramaVideoExportArchivePath(id), { force: true }).catch(() => undefined);
}

export function dramaVideoExportArchivePath(id: string) {
    return resolveDataPath(`${EXPORT_DIR}/${id}.zip`);
}

export function publicDramaVideoExportJob(job: DramaVideoExportJob): DramaVideoExportJobPublic {
    const { userId: _userId, input: _input, ...rest } = job;
    return {
        ...rest,
        downloadUrl: job.status === "success" ? `/api/drama/projects/${encodeURIComponent(job.projectId)}/export-videos/${job.id}/download` : undefined,
    };
}

function jobFileName(id: string) {
    return `${EXPORT_DIR}/${id}.json`;
}

async function writeJob(job: DramaVideoExportJob) {
    await writeJsonDataFile(jobFileName(job.id), job);
}
