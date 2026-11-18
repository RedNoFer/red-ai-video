import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Zip, ZipPassThrough } from "fflate";

import type { DramaProject, DramaShot, DramaShotVideoResult } from "@/lib/drama-project-contract";
import { buildDramaSrt, dramaScriptShotSubtitleSources, dramaShotSubtitleAvailability, planDramaSubtitleSources, type DramaSubtitleExportMode, type DramaSubtitleSource } from "@/lib/drama-subtitle-plan";
import { mergeDramaShotVideoResults, visibleDramaShotVideoResults } from "@/lib/drama-shot-video-results";
import type { DramaVideoExportPayload } from "@/lib/drama-video-export";
import { mediaFileExtension } from "@/lib/media-file";
import { queryStoredGenerationTasks } from "@/lib/server/generation-task-store";
import { downloadMediaToFile } from "@/lib/server/media-download";
import { resolveDramaSubtitleSources } from "@/lib/server/drama-subtitle-asr";
import { probeDramaVideo, renderDramaSubtitleVideo } from "@/lib/server/drama-subtitle-render";
import type { VideoTask } from "@/lib/server/video-task-store";

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 800 * 1024 * 1024;

export type DramaVideoExportResult = {
    stream: ReadableStream<Uint8Array>;
    fileName: string;
    exported: number;
    failed: number;
};

export type DramaVideoExportProgress = {
    phase: "downloading" | "subtitles" | "packaging";
    done: number;
    total: number;
    bytes: number;
    subtitlesDone: number;
    subtitlesTotal: number;
};

type DramaVideoExportManifest = {
    projectId: string;
    projectTitle: string;
    exportedAt: string;
    originalsIncluded: boolean;
    exported: Array<{ episode: string; shot: string; shotCode: string; file: string; videoId: string; url: string }>;
    failed: Array<{ episode: string; shot: string; reason: string }>;
    subtitles: {
        requested: boolean;
        modes: DramaSubtitleExportMode[];
        generated: Array<{ episode: string; shot: string; shotCode: string; videoId: string; mode: DramaSubtitleExportMode; file: string; srt: string }>;
        skipped: Array<{ episode: string; shot: string; shotCode: string; videoId: string; mode: DramaSubtitleExportMode; reason: string }>;
        failed: Array<{ episode: string; shot: string; shotCode: string; videoId: string; mode: DramaSubtitleExportMode; reason: string }>;
    };
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
                const subtitleAvailability = dramaShotSubtitleAvailability(shot, episode.script);
                return {
                    shotId: shot.id,
                    code: shot.code || `镜头${String(shot.order).padStart(2, "0")}`,
                    title: shot.title || `镜头 ${shot.order}`,
                    videos,
                    hasSubtitles: subtitleAvailability.hasText,
                    hasEnglishSubtitles: subtitleAvailability.hasEnglish,
                };
            })
            .filter((shot) => shot.videos.length > 0);
        episodes.push({ episodeId: episode.id, order: index + 1, title: episode.title, shots });
    }
    return { projectId: project.id, projectTitle: project.title, episodes };
}

/** 把选中的镜头视频打包成按剧集分目录的 ZIP，直接落到用户本地下载目录。 */
export async function exportDramaVideos(input: {
    project: DramaProject;
    entries: DramaVideoExportEntry[];
    origin: string;
    cookie?: string;
    userId: string;
    includeSubtitles?: boolean;
    subtitleModes?: DramaSubtitleExportMode[];
    includeOriginals?: boolean;
    onProgress?: (progress: DramaVideoExportProgress) => void;
}): Promise<DramaVideoExportResult> {
    if (!input.entries.length) throw new DramaVideoExportError("请先选择要下载的视频", 422);
    const includeOriginals = input.includeOriginals !== false;
    const subtitleModes: DramaSubtitleExportMode[] = input.subtitleModes?.length ? [...input.subtitleModes] : input.includeSubtitles === true ? ["bilingual"] : [];
    if (!includeOriginals) assertDramaSubtitlesExportable(input.project, input.entries, subtitleModes);
    const root = await mkdtemp(join(tmpdir(), "vozeb-drama-videos-"));
    const downloads: Array<{ entry: DramaVideoExportEntry; path: string; zipPath: string; variant: number; mimeType: string }> = [];
    const failures: Array<{ episode: string; shot: string; reason: string }> = [];
    const variants = new Map<string, number>();
    let totalBytes = 0;
    let settledBytes = 0;
    const total = input.entries.length;
    input.onProgress?.({ phase: "downloading", done: 0, total, bytes: 0, subtitlesDone: 0, subtitlesTotal: 0 });
    try {
        for (const [index, entry] of input.entries.entries()) {
            const path = join(root, `${index}.media`);
            try {
                const downloaded = await downloadMediaToFile(entry.url, path, {
                    origin: input.origin,
                    cookie: input.cookie,
                    maxBytes: MAX_FILE_BYTES,
                    onProgress: (bytes) => input.onProgress?.({ phase: "downloading", done: index, total, bytes: settledBytes + bytes, subtitlesDone: 0, subtitlesTotal: 0 }),
                });
                totalBytes += downloaded.bytes;
                settledBytes += downloaded.bytes;
                input.onProgress?.({ phase: "downloading", done: index + 1, total, bytes: settledBytes, subtitlesDone: 0, subtitlesTotal: 0 });
                if (totalBytes > MAX_TOTAL_BYTES) throw new DramaVideoExportError("批量下载素材超过 800MB，请减少勾选数量后重试", 413);
                const shotKey = `${entry.episodeId}::${entry.shotId}`;
                const variant = (variants.get(shotKey) || 0) + 1;
                variants.set(shotKey, variant);
                downloads.push({ entry, path, zipPath: `${episodeFolder(entry)}/${shotFileName(entry, variant, downloaded.mimeType)}`, variant, mimeType: downloaded.mimeType });
            } catch (error) {
                if (error instanceof DramaVideoExportError) throw error;
                failures.push({ episode: entry.episodeTitle, shot: entry.shotTitle, reason: error instanceof Error ? error.message : "下载失败" });
            }
        }
        if (!downloads.length) throw new DramaVideoExportError("视频文件下载失败，请稍后重试", 502);
        const manifest: DramaVideoExportManifest = {
            projectId: input.project.id,
            projectTitle: input.project.title,
            exportedAt: new Date().toISOString(),
            originalsIncluded: includeOriginals,
            exported: includeOriginals ? downloads.map(({ entry, zipPath }) => ({ episode: entry.episodeTitle, shot: entry.shotTitle, shotCode: entry.shotCode, file: zipPath, videoId: entry.videoId, url: entry.url })) : [],
            failed: failures,
            subtitles: { requested: subtitleModes.length > 0, modes: subtitleModes, generated: [], skipped: [], failed: [] },
        };
        const stream = createZipStream(root, downloads, manifest, input.project, subtitleModes, includeOriginals, settledBytes, input.onProgress, {
            origin: input.origin,
            cookie: input.cookie || "",
            userId: input.userId,
        });
        return {
            stream,
            fileName: `${safeName(input.project.title) || "短剧项目"}_${includeOriginals ? "视频" : "字幕版"}.zip`,
            exported: includeOriginals ? downloads.length : 0,
            failed: failures.length,
        };
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

function assertDramaSubtitlesExportable(project: DramaProject, entries: DramaVideoExportEntry[], subtitleModes: DramaSubtitleExportMode[]) {
    if (!subtitleModes.length) throw new DramaVideoExportError("仅字幕版需要至少选择一种字幕版本", 422);
    const selected = new Set(entries.map((entry) => `${entry.episodeId}::${entry.shotId}`));
    const available = project.episodes.some((episode) =>
        episode.shots.some((shot) => {
            if (!selected.has(`${episode.id}::${shot.id}`)) return false;
            const subtitle = dramaShotSubtitleAvailability(shot, episode.script);
            return subtitleModes.some((mode) => (mode === "english" ? subtitle.hasEnglish : subtitle.hasText));
        }),
    );
    if (!available) throw new DramaVideoExportError("所选镜头没有可导出的字幕内容", 422);
}

function createZipStream(
    root: string,
    downloads: Array<{ entry: DramaVideoExportEntry; path: string; zipPath: string; variant: number }>,
    manifest: DramaVideoExportManifest,
    project: DramaProject,
    subtitleModes: DramaSubtitleExportMode[],
    includeOriginals: boolean,
    receivedBytes: number,
    onProgress: ((progress: DramaVideoExportProgress) => void) | undefined,
    context: { origin: string; cookie: string; userId: string },
) {
    let closed = false;
    const subtitlesTotal = downloads.length * subtitleModes.length;
    let subtitlesDone = 0;
    return new ReadableStream<Uint8Array>({
        cancel() {
            closed = true;
            return rm(root, { recursive: true, force: true }).catch(() => undefined);
        },
        start(controller) {
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
                    const shots = new Map<string, { shot: DramaShot; script: string }>();
                    for (const episode of project.episodes) {
                        for (const shot of episode.shots) shots.set(`${episode.id}::${shot.id}`, { shot, script: episode.script });
                    }
                    for (const [index, item] of downloads.entries()) {
                        if (closed) break;
                        if (includeOriginals) {
                            const original = new ZipPassThrough(item.zipPath);
                            zip.add(original);
                            original.push(new Uint8Array(await readFile(item.path)), true);
                        }
                        if (!subtitleModes.length) continue;

                        const record = shots.get(`${item.entry.episodeId}::${item.entry.shotId}`);
                        if (!record) {
                            for (const mode of subtitleModes) manifest.subtitles.skipped.push({ episode: item.entry.episodeTitle, shot: item.entry.shotTitle, shotCode: item.entry.shotCode, videoId: item.entry.videoId, mode, reason: "镜头不存在" });
                            continue;
                        }
                        const availability = dramaShotSubtitleAvailability(record.shot, record.script);
                        if (!availability.hasText) {
                            for (const mode of subtitleModes)
                                manifest.subtitles.skipped.push({ episode: item.entry.episodeTitle, shot: item.entry.shotTitle, shotCode: item.entry.shotCode, videoId: item.entry.videoId, mode, reason: "本镜头没有可烧录的台词或旁白" });
                            continue;
                        }
                        let probe: Awaited<ReturnType<typeof probeDramaVideo>> | undefined;
                        let sources: DramaSubtitleSource[] | undefined;
                        try {
                            probe = await probeDramaVideo(item.path, { cwd: root });
                            sources = await resolveDramaSubtitleSources({
                                sourcePath: item.path,
                                workdir: root,
                                durationMs: probe.durationMs,
                                width: probe.width,
                                height: probe.height,
                                audioCodec: probe.audioCodec,
                                mode: subtitleModes.includes("bilingual") ? "bilingual" : "english",
                                origin: context.origin,
                                cookie: context.cookie,
                                userId: context.userId,
                                projectId: project.id,
                                shotId: item.entry.shotId,
                                videoId: item.entry.videoId,
                                scriptSources: dramaScriptShotSubtitleSources(record.script, record.shot.code),
                            });
                        } catch (error) {
                            const reason = error instanceof Error ? error.message : "字幕语音识别失败";
                            for (const mode of subtitleModes) manifest.subtitles.failed.push({ episode: item.entry.episodeTitle, shot: item.entry.shotTitle, shotCode: item.entry.shotCode, videoId: item.entry.videoId, mode, reason });
                            subtitlesDone += subtitleModes.length;
                            onProgress?.({ phase: "subtitles", done: index + 1, total: downloads.length, bytes: receivedBytes, subtitlesDone, subtitlesTotal });
                            continue;
                        }
                        if (!sources?.length) {
                            for (const mode of subtitleModes)
                                manifest.subtitles.skipped.push({ episode: item.entry.episodeTitle, shot: item.entry.shotTitle, shotCode: item.entry.shotCode, videoId: item.entry.videoId, mode, reason: "本镜头没有检测到可烧录的对白" });
                            subtitlesDone += subtitleModes.length;
                            onProgress?.({ phase: "subtitles", done: index + 1, total: downloads.length, bytes: receivedBytes, subtitlesDone, subtitlesTotal });
                            continue;
                        }
                        for (const mode of subtitleModes) {
                            onProgress?.({ phase: "subtitles", done: index, total: downloads.length, bytes: receivedBytes, subtitlesDone, subtitlesTotal });
                            subtitlesDone += 1;
                            if (mode === "english" && !availability.hasEnglish) {
                                manifest.subtitles.skipped.push({ episode: item.entry.episodeTitle, shot: item.entry.shotTitle, shotCode: item.entry.shotCode, videoId: item.entry.videoId, mode, reason: "本镜头没有英文字幕" });
                                continue;
                            }
                            try {
                                const cues = planDramaSubtitleSources(sources, probe.durationMs, probe.width, probe.height, mode);
                                if (!cues.length) {
                                    manifest.subtitles.skipped.push({ episode: item.entry.episodeTitle, shot: item.entry.shotTitle, shotCode: item.entry.shotCode, videoId: item.entry.videoId, mode, reason: "本镜头没有检测到可烧录的对白" });
                                    continue;
                                }
                                const subtitleFile = subtitleZipPath(item, mode);
                                const srtFile = srtZipPath(item, mode);
                                const outputPath = join(root, `subtitle-${index}-${mode}.mp4`);
                                await renderDramaSubtitleVideo({
                                    workdir: root,
                                    sourcePath: item.path,
                                    outputPath,
                                    cues,
                                    width: probe.width,
                                    height: probe.height,
                                    audioCodec: probe.audioCodec,
                                });
                                const subtitleBytes = new Uint8Array(await readFile(outputPath));
                                const srtBytes = new TextEncoder().encode(buildDramaSrt(cues));
                                const subtitle = new ZipPassThrough(subtitleFile);
                                zip.add(subtitle);
                                subtitle.push(subtitleBytes, true);
                                const srt = new ZipPassThrough(srtFile);
                                zip.add(srt);
                                srt.push(srtBytes, true);
                                manifest.subtitles.generated.push({ episode: item.entry.episodeTitle, shot: item.entry.shotTitle, shotCode: item.entry.shotCode, videoId: item.entry.videoId, mode, file: subtitleFile, srt: srtFile });
                            } catch (error) {
                                manifest.subtitles.failed.push({
                                    episode: item.entry.episodeTitle,
                                    shot: item.entry.shotTitle,
                                    shotCode: item.entry.shotCode,
                                    videoId: item.entry.videoId,
                                    mode,
                                    reason: error instanceof Error ? error.message : "字幕视频生成失败",
                                });
                            }
                        }
                    }
                    if (closed) return;
                    if (!includeOriginals && !manifest.subtitles.generated.length) {
                        const reason = manifest.subtitles.failed[0]?.reason || manifest.subtitles.skipped[0]?.reason || "没有生成任何字幕文件";
                        throw new DramaVideoExportError(`字幕版导出失败：${reason}`, 502);
                    }
                    onProgress?.({ phase: "packaging", done: downloads.length, total: downloads.length, bytes: receivedBytes, subtitlesDone, subtitlesTotal });
                    const manifestEntry = new ZipPassThrough("manifest.json");
                    zip.add(manifestEntry);
                    manifestEntry.push(new TextEncoder().encode(JSON.stringify(manifest, null, 2)), true);
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

function subtitleZipPath(item: { entry: DramaVideoExportEntry; variant: number }, mode: DramaSubtitleExportMode) {
    const base = subtitleBaseName(item);
    if (mode === "english") return `${episodeFolder(item.entry)}/字幕版/英文/${base}_英文字幕.mp4`;
    return `${episodeFolder(item.entry)}/字幕版/${base}_字幕.mp4`;
}

function srtZipPath(item: { entry: DramaVideoExportEntry; variant: number }, mode: DramaSubtitleExportMode) {
    const base = subtitleBaseName(item);
    if (mode === "english") return `${episodeFolder(item.entry)}/字幕版/英文/${base}.en.srt`;
    return `${episodeFolder(item.entry)}/字幕版/${base}.srt`;
}

function subtitleBaseName(item: { entry: DramaVideoExportEntry; variant: number }) {
    return `${safeName(item.entry.shotCode)}_${safeName(item.entry.shotTitle) || "镜头"}${item.variant > 1 ? `_${item.variant}` : ""}`;
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
