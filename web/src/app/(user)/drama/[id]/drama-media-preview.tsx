"use client";

import { Checkbox, Modal, Select } from "antd";
import { saveAs } from "file-saver";
import { Download, Film, ImageIcon, RefreshCw, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";

import type { DramaSubtitleExportMode } from "@/lib/drama-subtitle-plan";
import { mediaDownloadFileName } from "@/lib/media-file";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { exportDramaSubtitleVideo } from "@/services/api/drama-projects";

export type DramaPreviewMedia = {
    type: "image" | "video";
    url: string;
    title: string;
    downloadUrl?: string;
    posterUrl?: string;
    onRepair?: () => Promise<void>;
    subtitleExport?: { projectId: string; episodeId: string; shotId: string; videoId: string; hasText: boolean; hasEnglishText: boolean };
};

export function DramaMediaThumbnail({ media, onOpen }: { media: DramaPreviewMedia; onOpen: (media: DramaPreviewMedia) => void }) {
    return (
        <button
            type="button"
            className="group relative aspect-video w-44 shrink-0 overflow-hidden rounded-md border border-border bg-muted text-left"
            onClick={() => onOpen(media)}
            aria-label={`查看${media.type === "image" ? "图片" : "视频"}：${media.title}`}
        >
            {media.type === "image" || media.posterUrl ? (
                <img className="size-full object-contain transition" src={imagePreviewUrl(media.type === "image" ? media.url : media.posterUrl || "", 640)} alt={media.title} />
            ) : (
                <span className="grid size-full place-items-center bg-muted text-muted-foreground">
                    <Film className="size-6" />
                </span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100 group-focus-visible:bg-black/25 group-focus-visible:opacity-100">
                <ScanSearch className="size-5 drop-shadow" />
            </span>
            <span className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded bg-black/60 text-white">{media.type === "image" ? <ImageIcon className="size-3.5" /> : <Film className="size-3.5" />}</span>
        </button>
    );
}

export function DramaMediaPreviewModal({ media, onClose }: { media?: DramaPreviewMedia; onClose: () => void }) {
    const [repairing, setRepairing] = useState(false);
    const [repairError, setRepairError] = useState("");
    const [downloadingSubtitles, setDownloadingSubtitles] = useState(false);
    const [downloadError, setDownloadError] = useState("");
    const [withSubtitles, setWithSubtitles] = useState(false);
    const [subtitleMode, setSubtitleMode] = useState<DramaSubtitleExportMode>("bilingual");

    useEffect(() => {
        setWithSubtitles(Boolean(media?.subtitleExport?.hasText));
        setSubtitleMode("bilingual");
        setDownloadError("");
        setRepairError("");
    }, [media]);

    const downloadSubtitles = async () => {
        if (!media?.subtitleExport || downloadingSubtitles) return;
        setDownloadingSubtitles(true);
        setDownloadError("");
        try {
            const result = await exportDramaSubtitleVideo(media.subtitleExport.projectId, {
                episodeId: media.subtitleExport.episodeId,
                shotId: media.subtitleExport.shotId,
                videoId: media.subtitleExport.videoId,
                mode: subtitleMode,
            });
            saveAs(result.blob, result.fileName);
        } catch (error) {
            setDownloadError(error instanceof Error ? error.message : "生成字幕版视频失败");
        } finally {
            setDownloadingSubtitles(false);
        }
    };

    return (
        <Modal
            title={media?.title || "媒体预览"}
            open={Boolean(media)}
            width={960}
            footer={
                media ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {media.type === "video" && media.subtitleExport ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <Checkbox checked={withSubtitles} disabled={!media.subtitleExport.hasText} onChange={(event) => setWithSubtitles(event.target.checked)}>
                                    带字幕下载
                                </Checkbox>
                                {withSubtitles ? (
                                    <Select
                                        aria-label="字幕版本"
                                        size="small"
                                        className="min-w-[164px]"
                                        value={subtitleMode}
                                        onChange={(value: DramaSubtitleExportMode) => setSubtitleMode(value)}
                                        options={[
                                            { value: "bilingual", label: "双语字幕（英/中）" },
                                            { value: "english", label: "英文字幕单独版", disabled: !media.subtitleExport.hasEnglishText },
                                        ]}
                                    />
                                ) : null}
                            </div>
                        ) : null}
                        {media.type === "video" && media.onRepair ? (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={repairing}
                                onClick={async () => {
                                    setRepairing(true);
                                    setRepairError("");
                                    try {
                                        await media.onRepair?.();
                                    } catch (error) {
                                        setRepairError(error instanceof Error ? error.message : "视频补全失败");
                                    } finally {
                                        setRepairing(false);
                                    }
                                }}
                            >
                                <RefreshCw className={`size-4 ${repairing ? "animate-spin" : ""}`} />
                                {repairing ? "补全中" : "补全视频"}
                            </button>
                        ) : null}
                        {media.type === "video" && media.subtitleExport && withSubtitles ? (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={downloadingSubtitles}
                                onClick={() => void downloadSubtitles()}
                            >
                                <Download className={`size-4 ${downloadingSubtitles ? "animate-pulse" : ""}`} />
                                {downloadingSubtitles ? "正在生成字幕版..." : subtitleMode === "english" ? "下载英文字幕视频" : "下载双语字幕视频"}
                            </button>
                        ) : (
                            <a
                                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                                href={downloadLink(media.downloadUrl || media.url)}
                                download={mediaDownloadFileName(media.title, media.type === "video" ? "video/mp4" : "image/png", media.url)}
                            >
                                <Download className="size-4" />
                                {media.type === "video" ? "下载视频" : "下载原图"}
                            </a>
                        )}
                        {repairError ? <span className="text-xs text-rose-600">{repairError}</span> : null}
                        {downloadError ? <span className="text-xs text-rose-600">{downloadError}</span> : null}
                    </div>
                ) : null
            }
            destroyOnHidden
            onCancel={onClose}
        >
            {media?.type === "image" ? <img className="max-h-[calc(100dvh-280px)] w-full rounded-md object-contain" src={imagePreviewUrl(media.url, 2048)} alt={media.title} /> : null}
            {media?.type === "video" ? <video className="max-h-[calc(100dvh-280px)] w-full rounded-md bg-black" src={media.downloadUrl || media.url} controls autoPlay playsInline preload="metadata" /> : null}
        </Modal>
    );
}

function downloadLink(url: string) {
    try {
        const target = new URL(url, "http://vozeb.local");
        target.searchParams.set("download", "1");
        return /^[a-z][a-z\d+.-]*:/i.test(url) ? target.toString() : `${target.pathname}${target.search}${target.hash}`;
    } catch {
        return url;
    }
}
