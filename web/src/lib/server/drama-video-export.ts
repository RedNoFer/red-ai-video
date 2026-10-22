import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Zip, ZipPassThrough } from "fflate";

import type { DramaProject, DramaShotVideoResult } from "@/lib/drama-project-contract";
import { mergeDramaShotVideoResults, visibleDramaShotVideoResults } from "@/lib/drama-shot-video-results";
import type { DramaVideoExportPayload } from "@/lib/drama-video-export";
import { mediaFileExtension } from "@/lib/media-file";
import { queryStoredGenerationTasks } from "@/lib/server/generation-task-store";
import { downloadMediaToFile } from "@/lib/server/media-download";
import type { VideoTask } from "@/lib/server/video-task-store";

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 800 * 1024 * 1024;

export type DramaVideoExportResult = {
    stream: ReadableStream<Uint8Array>;
    fileName: string;
    exported: number;
    failed: number;
};

export type DramaVideoExportEntry = {
    episodeId: string;
    episodeTitle: string;
    episodeOrder: number;
    shotId: string;
    shotCode: string;
    shotTitle: string;
    videoId: string;
    url: string;
};

/** 汇总项目全部剧集里每个片段产出的所有视频：当前视频加上历史重生成成功的视频。 */
export async function collectDramaVideoExportPayload(userId: string, project: DramaProject): Promise<DramaVideoExportPayload> {
    const episodes: DramaVideoExportPayload["episodes"] = [];
    for (const [index, episode] of project.episodes.entries()) {
        const tasks = await queryEpisodeVideoTasks(userId, project.id, episode.id);
        const byShot = new Map<string, DramaShotVideoResult[]>();
        for (const task of tasks) {
            const shotId = task.shotId || "";
            const url = task.result?.url || "";
            if (!shotId || !url) continue;
            const results = byShot.get(shotId) || [];
            results.push({ id: task.id, taskId: task.id, url, createdAt: new Date(task.createdAt).toISOString(), durationMs: task.result?.durationMs });
            byShot.set(shotId, results);
        }
        const shots = episode.shots
            .filter((shot) => Boolean(shot.videoUrl))
            .map((shot) => {
                const merged = mergeDramaShotVideoResults(shot, byShot.get(shot.id) || []);
                const videos = visibleDramaShotVideoResults(merged).map((result) => ({
                    id: result.id,
                    url: result.url,
                    isCurrent: result.url === shot.videoUrl,
                    createdAt: result.createdAt,
                    durationMs: result.durationMs,
                }));
                return { shotId: shot.id, code: shot.code || `镜头${String(shot.order).padStart(2, "0")}`, title: shot.title || `镜头 ${shot.order}`, videos };
            })
            .filter((shot) => shot.videos.length > 0);
        episodes.push({ episodeId: episode.id, order: index + 1, title: episode.title, shots });
    }
    return { projectId: project.id, projectTitle: project.title, episodes };
}

/** 把选中的镜头视频打包成按剧集分目录的 ZIP，直接落到用户本地下载目录。 */
export async function exportDramaVideos(input: { project: DramaProject; entries: DramaVideoExportEntry[]; origin: string; cookie?: string }): Promise<DramaVideoExportResult> {
    if (!input.entries.length) throw new DramaVideoExportError("请先选择要下载的视频", 422);
    const root = await mkdtemp(join(tmpdir(), "vozeb-drama-videos-"));
    const downloads: Array<{ entry: DramaVideoExportEntry; path: string; zipPath: string }> = [];
    const failures: Array<{ episode: string; shot: string; reason: string }> = [];
    const variants = new Map<string, number>();
    let totalBytes = 0;
    try {
        for (const [index, entry] of input.entries.entries()) {
            const path = join(root, `${index}.media`);
            try {
                const downloaded = await downloadMediaToFile(entry.url, path, { origin: input.origin, cookie: input.cookie, maxBytes: MAX_FILE_BYTES });
                totalBytes += downloaded.bytes;
                if (totalBytes > MAX_TOTAL_BYTES) throw new DramaVideoExportError("批量下载素材超过 800MB，请减少勾选数量后重试", 413);
                const shotKey = `${entry.episodeId}::${entry.shotId}`;
                const variant = (variants.get(shotKey) || 0) + 1;
                variants.set(shotKey, variant);
                downloads.push({ entry, path, zipPath: `${episodeFolder(entry)}/${shotFileName(entry, variant, downloaded.mimeType)}` });
            } catch (error) {
                if (error instanceof DramaVideoExportError) throw error;
                failures.push({ episode: entry.episodeTitle, shot: entry.shotTitle, reason: error instanceof Error ? error.message : "下载失败" });
            }
        }
        if (!downloads.length) throw new DramaVideoExportError("视频文件下载失败，请稍后重试", 502);
        const manifest = {
            projectId: input.project.id,
            projectTitle: input.project.title,
            exportedAt: new Date().toISOString(),
            exported: downloads.map(({ entry, zipPath }) => ({ episode: entry.episodeTitle, shot: entry.shotTitle, shotCode: entry.shotCode, file: zipPath, videoId: entry.videoId, url: entry.url })),
            failed: failures,
        };
        const stream = createZipStream(root, downloads, manifest);
        return { stream, fileName: `${safeName(input.project.title) || "短剧项目"}_视频.zip`, exported: downloads.length, failed: failures.length };
    } catch (error) {
        await rm(root, { recursive: true, force: true });
        throw error;
    }
}

/** 只接受当前项目真实存在的视频选择，外部传入的地址一律忽略。 */
export function resolveDramaVideoExportEntries(payload: DramaVideoExportPayload, items: Array<{ episodeId?: string; shotId?: string; videoId?: string }>): DramaVideoExportEntry[] {
    const byId = new Map<string, DramaVideoExportEntry>();
    for (const episode of payload.episodes) {
        for (const shot of episode.shots) {
            for (const video of shot.videos) {
                byId.set(`${episode.episodeId}::${shot.shotId}::${video.id}`, {
                    episodeId: episode.episodeId,
                    episodeTitle: episode.title,
                    episodeOrder: episode.order,
                    shotId: shot.shotId,
                    shotCode: shot.code,
                    shotTitle: shot.title,
                    videoId: video.id,
                    url: video.url,
                });
            }
        }
    }
    const entries: DramaVideoExportEntry[] = [];
    for (const item of items) {
        const entry = byId.get(`${String(item.episodeId || "")}::${String(item.shotId || "")}::${String(item.videoId || "")}`);
        if (entry && !entries.some((current) => current.videoId === entry.videoId && current.shotId === entry.shotId)) entries.push(entry);
    }
    return entries;
}

async function queryEpisodeVideoTasks(userId: string, projectId: string, episodeId: string) {
    const tasks: VideoTask[] = [];
    let cursor: { createdAt: number; id: string } | undefined;
    while (true) {
        const page = await queryStoredGenerationTasks<VideoTask>("video", { userId, projectId, episodeId, statuses: ["success"], limit: 100, cursor });
        tasks.push(...page);
        if (page.length < 100) break;
        const last = page[page.length - 1];
        cursor = { createdAt: last.createdAt, id: last.id };
    }
    return tasks;
}

function createZipStream(root: string, downloads: Array<{ path: string; zipPath: string }>, manifest: unknown) {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            const fail = (error: unknown) => {
                if (closed) return;
                closed = true;
                controller.error(error instanceof Error ? error : new Error("批量下载视频失败"));
            };
            const zip = new Zip((error, chunk, final) => {
                if (error) return fail(error);
                if (closed) return;
                controller.enqueue(chunk);
                if (final) {
                    closed = true;
                    controller.close();
                }
            });
            (async () => {
                try {
                    const manifestEntry = new ZipPassThrough("manifest.json");
                    zip.add(manifestEntry);
                    manifestEntry.push(new TextEncoder().encode(JSON.stringify(manifest, null, 2)), true);
                    for (const item of downloads) {
                        const entry = new ZipPassThrough(item.zipPath);
                        zip.add(entry);
                        entry.push(new Uint8Array(await readFile(item.path)), true);
                    }
                    zip.end();
                } catch (error) {
                    fail(error);
                } finally {
                    await rm(root, { recursive: true, force: true });
                }
            })();
        },
    });
}

function episodeFolder(entry: DramaVideoExportEntry) {
    return `${String(entry.episodeOrder).padStart(2, "0")}_${safeName(entry.episodeTitle) || `第${entry.episodeOrder}集`}`;
}

function shotFileName(entry: DramaVideoExportEntry, variant: number, mimeType?: string) {
    const base = `${safeName(entry.shotCode)}_${safeName(entry.shotTitle) || "镜头"}`;
    return `${base}${variant > 1 ? `_${variant}` : ""}.${mediaFileExtension(mimeType, entry.url, "mp4")}`;
}

function safeName(value: string) {
    return value
        .trim()
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\.\.+/g, "_")
        .replace(/[. ]+$/g, "");
}

export class DramaVideoExportError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}
