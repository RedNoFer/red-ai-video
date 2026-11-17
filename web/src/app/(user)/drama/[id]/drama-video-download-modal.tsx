"use client";

import { App, Button, Checkbox, Empty, Modal, Progress, Select, Spin } from "antd";
import { CircleAlert, CheckCircle2, Download, Film } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DramaSubtitleExportMode } from "@/lib/drama-subtitle-plan";
import { dramaVideoExportEntryKey, dramaVideoExportKeys, dramaVideoExportSelection, type DramaVideoExportPayload } from "@/lib/drama-video-export";
import { createDramaVideoExport, getDramaVideoExport, listDramaProjectVideos, listDramaVideoExports, type DramaVideoExportJob } from "@/services/api/drama-projects";

type DramaSubtitleChoice = DramaSubtitleExportMode | "both";

export function DramaVideoDownloadModal({ open, projectId, onClose }: { open: boolean; projectId: string; onClose: () => void }) {
    const { message } = App.useApp();
    const [payload, setPayload] = useState<DramaVideoExportPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [includeSubtitles, setIncludeSubtitles] = useState(true);
    const [subtitlesOnly, setSubtitlesOnly] = useState(false);
    const [subtitleChoice, setSubtitleChoice] = useState<DramaSubtitleChoice>("bilingual");
    const [job, setJob] = useState<DramaVideoExportJob | null>(null);
    const autoDownloadJobId = useRef<string | null>(null);
    const jobId = job?.id;
    const jobStatus = job?.status;
    const jobActive = jobStatus === "pending" || jobStatus === "running";

    useEffect(() => {
        if (!open) return;
        let active = true;
        setLoading(true);
        setIncludeSubtitles(true);
        setSubtitlesOnly(false);
        setSubtitleChoice("bilingual");
        Promise.all([listDramaProjectVideos(projectId), listDramaVideoExports(projectId).catch(() => [])])
            .then(([data, jobs]) => {
                if (!active) return;
                setPayload(data);
                setSelected(dramaVideoExportKeys(data));
                setJob(jobs[0] || null);
                autoDownloadJobId.current = null;
            })
            .catch((error) => {
                if (!active) return;
                message.error(error instanceof Error ? error.message : "读取镜头视频失败");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [open, projectId, message]);

    useEffect(() => {
        if (!open || !jobId || (jobStatus !== "pending" && jobStatus !== "running")) return;
        let cancelled = false;
        let busy = false;
        const poll = async () => {
            if (busy) return;
            busy = true;
            try {
                const next = await getDramaVideoExport(projectId, jobId);
                if (cancelled) return;
                setJob(next);
                if (next.status === "success") {
                    if (autoDownloadJobId.current === next.id) {
                        autoDownloadJobId.current = null;
                        triggerNativeDownload(next);
                    }
                    message.success(next.failed ? `导出完成，${next.failed} 个视频失败（详见 manifest.json）` : `导出完成（${formatBytes(next.archiveBytes)}），浏览器已开始下载`);
                } else if (next.status === "error") {
                    message.error(next.error || "批量下载视频失败");
                }
            } catch (error) {
                if (!cancelled) message.error(error instanceof Error ? error.message : "读取导出进度失败");
            } finally {
                busy = false;
            }
        };
        const timer = window.setInterval(() => void poll(), 1500);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [open, jobId, jobStatus, projectId, message]);

    const allKeys = useMemo(() => (payload ? dramaVideoExportKeys(payload) : []), [payload]);
    const selectedSubtitleAvailability = useMemo(() => {
        const available = { any: false, english: false };
        if (!payload) return available;
        for (const episode of payload.episodes) {
            for (const shot of episode.shots) {
                if (!shot.hasSubtitles && !shot.hasEnglishSubtitles) continue;
                if (!shot.videos.some((video) => selected.includes(dramaVideoExportEntryKey(episode.episodeId, shot.shotId, video.id)))) continue;
                available.any ||= shot.hasSubtitles;
                available.english ||= shot.hasEnglishSubtitles;
            }
        }
        return available;
    }, [payload, selected]);
    useEffect(() => {
        if (selectedSubtitleAvailability.any) return;
        setSubtitlesOnly(false);
        setIncludeSubtitles(true);
    }, [selectedSubtitleAvailability.any]);
    const effectiveSubtitleChoice: DramaSubtitleChoice = subtitleChoice !== "bilingual" && !selectedSubtitleAvailability.english ? "bilingual" : subtitleChoice;
    const subtitleModes: DramaSubtitleExportMode[] = effectiveSubtitleChoice === "both" ? ["bilingual", "english"] : [effectiveSubtitleChoice];
    const subtitlesOnlyActive = subtitlesOnly && selectedSubtitleAvailability.any;
    const includeOriginals = !subtitlesOnlyActive;
    const wantSubtitles = (includeSubtitles || subtitlesOnlyActive) && selectedSubtitleAvailability.any;
    const subtitleVersionLabel = subtitleModes.length > 1 ? "双语与英文字幕版" : subtitleModes[0] === "english" ? "英文字幕版" : "双语字幕版";
    const toggle = (key: string, checked: boolean) => setSelected((current) => (checked ? [...new Set([...current, key])] : current.filter((item) => item !== key)));
    const toggleMany = (keys: string[], checked: boolean) =>
        setSelected((current) => {
            const next = new Set(current);
            for (const key of keys) {
                if (checked) next.add(key);
                else next.delete(key);
            }
            return [...next];
        });
    const chooseOriginalsWithSubtitles = (checked: boolean) => {
        setIncludeSubtitles(checked);
        if (checked) setSubtitlesOnly(false);
    };
    const chooseSubtitlesOnly = (checked: boolean) => {
        setSubtitlesOnly(checked);
        setIncludeSubtitles(!checked);
    };

    const download = async () => {
        if (submitting || jobActive || !payload || !selected.length) return;
        const items = dramaVideoExportSelection(payload, selected);
        if (!items.length) return;
        setSubmitting(true);
        try {
            const created = await createDramaVideoExport(projectId, items, { includeSubtitles: wantSubtitles, includeOriginals, subtitleModes: wantSubtitles ? subtitleModes : [] });
            autoDownloadJobId.current = created.status === "success" ? null : created.id;
            setJob(created);
            if (created.status === "success") {
                triggerNativeDownload(created);
                message.success(`导出完成（${formatBytes(created.archiveBytes)}），浏览器已开始下载`);
            } else {
                message.info("已创建导出任务，完成后会自动使用浏览器原生下载");
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : "批量下载视频失败");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title="批量下载视频"
            open={open}
            onCancel={onClose}
            width="min(920px, calc(100vw - 24px))"
            destroyOnHidden
            footer={[
                <Button key="cancel" onClick={onClose}>
                    {jobActive ? "后台运行" : "取消"}
                </Button>,
                <Button key="download" type="primary" icon={<Download className="size-4" />} loading={submitting} disabled={!selected.length || jobActive} onClick={() => void download()}>
                    下载所选{includeOriginals ? "视频" : "字幕版"}（{selected.length}）
                </Button>,
            ]}
        >
            <div className="pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Checkbox
                        checked={allKeys.length > 0 && selected.length === allKeys.length}
                        indeterminate={selected.length > 0 && selected.length < allKeys.length}
                        disabled={!allKeys.length || jobActive}
                        onChange={(event) => toggleMany(allKeys, event.target.checked)}
                    >
                        全选
                    </Checkbox>
                    <span className="text-xs text-muted-foreground" data-drama-video-download-summary>
                        已选 {selected.length} / {allKeys.length} 个视频，打包为 ZIP 并按剧集分文件夹保存到本地下载目录
                    </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-muted/30 px-3 py-2" data-drama-video-download-subtitles>
                    <Checkbox checked={includeSubtitles} disabled={!selectedSubtitleAvailability.any || jobActive} onChange={(event) => chooseOriginalsWithSubtitles(event.target.checked)}>
                        同时导出字幕版（保留原片）
                    </Checkbox>
                    <Checkbox checked={subtitlesOnlyActive} disabled={!selectedSubtitleAvailability.any || jobActive} onChange={(event) => chooseSubtitlesOnly(event.target.checked)}>
                        仅字幕版（不含原片）
                    </Checkbox>
                    {wantSubtitles ? (
                        <Select
                            aria-label="字幕版本"
                            className="min-w-[240px]"
                            size="small"
                            value={effectiveSubtitleChoice}
                            disabled={jobActive}
                            data-drama-video-download-subtitle-mode
                            onChange={(value: DramaSubtitleChoice) => setSubtitleChoice(value)}
                            options={[
                                { value: "bilingual", label: "双语字幕（英文主行 + 中文副行）" },
                                { value: "english", label: "英文单独版（英文烧录视频 + 英文 SRT）", disabled: !selectedSubtitleAvailability.english },
                                { value: "both", label: "双语 + 英文单独版（额外导出）", disabled: !selectedSubtitleAvailability.english },
                            ]}
                        />
                    ) : null}
                    <span className="text-xs text-muted-foreground" data-drama-video-download-subtitles-note>
                        {selectedSubtitleAvailability.any
                            ? subtitlesOnlyActive
                                ? "仅字幕版会打包烧录后的字幕视频和 SRT，不含原片；原片仍保留在项目中，不会被删除。字幕会按镜头重新编码，耗时更长。"
                                : "双语字幕英文在上、中文在下，共用同一句台词时间窗；英文单独版额外输出英文烧录视频和英文 SRT。字幕会按镜头重新编码，耗时更长，原片保留。"
                            : "所选镜头没有可烧录的台词或旁白，将只下载原片。"}
                    </span>
                </div>
                {job ? (
                    <div className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2" data-drama-video-export-progress data-status={job.status}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                                {jobActive ? <Spin size="small" /> : job.status === "success" ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <CircleAlert className="size-4 shrink-0 text-red-600" />}
                                <span className="min-w-0 truncate text-xs">{jobStatusText(job)}</span>
                            </div>
                            {job.status === "success" && job.downloadUrl ? (
                                <Button size="small" icon={<Download className="size-3.5" />} onClick={() => triggerNativeDownload(job)}>
                                    下载 ZIP
                                </Button>
                            ) : null}
                        </div>
                        {jobActive ? (
                            <>
                                <Progress percent={jobPercent(job)} size="small" showInfo={false} className="!mb-0 !mt-1.5" status="active" />
                                <span className="text-[11px] text-muted-foreground">可以关闭弹窗，导出任务会在服务器后台继续；完成后使用浏览器原生下载。</span>
                            </>
                        ) : null}
                    </div>
                ) : null}
                {loading ? (
                    <div className="grid min-h-32 place-items-center">
                        <Spin />
                    </div>
                ) : payload?.episodes.some((episode) => episode.shots.length) ? (
                    <div className="mt-3 max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                        {payload.episodes
                            .filter((episode) => episode.shots.length)
                            .map((episode) => {
                                const episodeKeys = episode.shots.flatMap((shot) => shot.videos.map((video) => dramaVideoExportEntryKey(episode.episodeId, shot.shotId, video.id)));
                                const episodeSelected = episodeKeys.filter((key) => selected.includes(key)).length;
                                return (
                                    <section key={episode.episodeId} className="rounded-lg border border-border" data-drama-video-download-group={episode.episodeId}>
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                                            <Checkbox
                                                checked={episodeKeys.length > 0 && episodeSelected === episodeKeys.length}
                                                indeterminate={episodeSelected > 0 && episodeSelected < episodeKeys.length}
                                                disabled={jobActive}
                                                onChange={(event) => toggleMany(episodeKeys, event.target.checked)}
                                            >
                                                <span className="font-medium">
                                                    第{String(episode.order).padStart(2, "0")}集 · {episode.title || `第${episode.order}集`}
                                                </span>
                                            </Checkbox>
                                            <span className="text-xs tabular-nums text-muted-foreground">
                                                {episodeSelected} / {episodeKeys.length} 个视频
                                            </span>
                                        </div>
                                        <div className="space-y-2.5 px-3 py-2.5">
                                            {episode.shots.map((shot, shotIndex) => (
                                                <div key={shot.shotId}>
                                                    <div className="text-xs font-medium text-muted-foreground">
                                                        {shot.code} · {shot.title}
                                                    </div>
                                                    <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
                                                        {shot.videos.map((video, videoIndex) => {
                                                            const key = dramaVideoExportEntryKey(episode.episodeId, shot.shotId, video.id);
                                                            const inputId = `drama-video-export-${episode.order}-${shotIndex}-${videoIndex}`;
                                                            return (
                                                                <div key={key} className="flex min-w-0 items-center gap-2 rounded-md border border-border px-2 py-1.5">
                                                                    <Checkbox
                                                                        id={inputId}
                                                                        checked={selected.includes(key)}
                                                                        disabled={jobActive}
                                                                        onChange={(event) => toggle(key, event.target.checked)}
                                                                        aria-label={`选择${shot.title}${video.isCurrent ? "当前视频" : "候选视频"}`}
                                                                    />
                                                                    <Film className="size-3.5 shrink-0 text-muted-foreground" />
                                                                    <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer truncate text-xs">
                                                                        {video.isCurrent ? "当前视频" : "候选视频"}
                                                                    </label>
                                                                    {video.createdAt ? <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{new Date(video.createdAt).toLocaleString()}</span> : null}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}
                    </div>
                ) : (
                    <Empty className="!my-8" description="还没有已生成视频的镜头可以下载" />
                )}
            </div>
        </Modal>
    );
}

function triggerNativeDownload(job: DramaVideoExportJob) {
    if (!job.downloadUrl) return;
    const link = document.createElement("a");
    link.href = job.downloadUrl;
    link.download = job.fileName || "短剧视频.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function jobStatusText(job: DramaVideoExportJob) {
    if (job.status === "error") return `导出失败：${job.error || "请稍后重试"}`;
    if (job.status === "success") return `导出完成：${job.fileName || "短剧视频.zip"}${job.archiveBytes ? `（${formatBytes(job.archiveBytes)}）` : ""}`;
    return job.message || "导出任务排队中";
}

function jobPercent(job: DramaVideoExportJob) {
    if (job.status === "success") return 100;
    if (job.phase === "downloading" && job.progress.total > 0) return Math.min(99, Math.round((job.progress.done / job.progress.total) * 100));
    if (job.phase === "subtitles" && job.progress.subtitlesTotal > 0) return Math.min(99, Math.round((job.progress.subtitlesDone / job.progress.subtitlesTotal) * 100));
    if (job.phase === "packaging") return 99;
    return 0;
}

function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
