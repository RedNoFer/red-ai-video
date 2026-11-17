"use client";

import { saveAs } from "file-saver";
import { App, Button, Checkbox, Empty, Modal, Select, Spin } from "antd";
import { Download, Film } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { DramaSubtitleExportMode } from "@/lib/drama-subtitle-plan";
import { dramaVideoExportEntryKey, dramaVideoExportKeys, dramaVideoExportSelection, type DramaVideoExportPayload } from "@/lib/drama-video-export";
import { exportDramaVideos, listDramaProjectVideos } from "@/services/api/drama-projects";

type DramaSubtitleChoice = DramaSubtitleExportMode | "both";

export function DramaVideoDownloadModal({ open, projectId, onClose }: { open: boolean; projectId: string; onClose: () => void }) {
    const { message } = App.useApp();
    const [payload, setPayload] = useState<DramaVideoExportPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [includeSubtitles, setIncludeSubtitles] = useState(true);
    const [subtitleChoice, setSubtitleChoice] = useState<DramaSubtitleChoice>("bilingual");

    useEffect(() => {
        if (!open) return;
        let active = true;
        setLoading(true);
        setIncludeSubtitles(true);
        setSubtitleChoice("bilingual");
        listDramaProjectVideos(projectId)
            .then((data) => {
                if (!active) return;
                setPayload(data);
                setSelected(dramaVideoExportKeys(data));
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
    const effectiveSubtitleChoice: DramaSubtitleChoice = subtitleChoice !== "bilingual" && !selectedSubtitleAvailability.english ? "bilingual" : subtitleChoice;
    const subtitleModes: DramaSubtitleExportMode[] = effectiveSubtitleChoice === "both" ? ["bilingual", "english"] : [effectiveSubtitleChoice];
    const wantSubtitles = includeSubtitles && selectedSubtitleAvailability.any;
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

    const download = async () => {
        if (downloading || !payload || !selected.length) return;
        const items = dramaVideoExportSelection(payload, selected);
        if (!items.length) return;
        setDownloading(true);
        try {
            const result = await exportDramaVideos(projectId, items, { includeSubtitles: wantSubtitles, subtitleModes: wantSubtitles ? subtitleModes : [] });
            saveAs(result.blob, result.fileName);
            message.success(
                result.failed ? `已导出 ${items.length - result.failed} 个视频，${result.failed} 个失败（详见 manifest.json）` : `已导出 ${items.length} 个视频到本地下载目录${wantSubtitles ? `（${subtitleVersionLabel}和 SRT 结果见 manifest.json）` : ""}`,
            );
        } catch (error) {
            message.error(error instanceof Error ? error.message : "批量下载视频失败");
        } finally {
            setDownloading(false);
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
                    取消
                </Button>,
                <Button key="download" type="primary" icon={<Download className="size-4" />} loading={downloading} disabled={!selected.length} onClick={() => void download()}>
                    下载所选视频（{selected.length}）
                </Button>,
            ]}
        >
            <div className="pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Checkbox
                        checked={allKeys.length > 0 && selected.length === allKeys.length}
                        indeterminate={selected.length > 0 && selected.length < allKeys.length}
                        disabled={!allKeys.length}
                        onChange={(event) => toggleMany(allKeys, event.target.checked)}
                    >
                        全选
                    </Checkbox>
                    <span className="text-xs text-muted-foreground" data-drama-video-download-summary>
                        已选 {selected.length} / {allKeys.length} 个视频，打包为 ZIP 并按剧集分文件夹保存到本地下载目录
                    </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-muted/30 px-3 py-2" data-drama-video-download-subtitles>
                    <Checkbox checked={wantSubtitles} disabled={!selectedSubtitleAvailability.any} onChange={(event) => setIncludeSubtitles(event.target.checked)}>
                        同时导出字幕版（保留原片）
                    </Checkbox>
                    {wantSubtitles ? (
                        <Select
                            aria-label="字幕版本"
                            className="min-w-[240px]"
                            size="small"
                            value={effectiveSubtitleChoice}
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
                        {selectedSubtitleAvailability.any ? "双语字幕英文在上、中文在下，共用同一句台词时间窗；英文单独版额外输出英文烧录视频和英文 SRT。字幕会按镜头重新编码，耗时更长，原片保留。" : "所选镜头没有可烧录的台词或旁白，将只下载原片。"}
                    </span>
                </div>
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
