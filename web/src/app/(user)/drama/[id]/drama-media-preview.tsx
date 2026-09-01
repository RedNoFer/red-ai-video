"use client";

import { Modal } from "antd";
import { Download, Film, ImageIcon, RefreshCw, ScanSearch } from "lucide-react";
import { useState } from "react";

import { mediaDownloadFileName } from "@/lib/media-file";
import { imagePreviewUrl } from "@/lib/media-image-url";

export type DramaPreviewMedia = { type: "image" | "video"; url: string; title: string; downloadUrl?: string; onRepair?: () => Promise<void> };

export function DramaMediaThumbnail({ media, onOpen }: { media: DramaPreviewMedia; onOpen: (media: DramaPreviewMedia) => void }) {
    return (
        <button
            type="button"
            className="group relative aspect-video w-44 shrink-0 overflow-hidden rounded-md border border-border bg-muted text-left"
            onClick={() => onOpen(media)}
            aria-label={`查看${media.type === "image" ? "图片" : "视频"}：${media.title}`}
        >
            {media.type === "image" ? (
                <img className="size-full object-cover transition group-hover:scale-[1.02]" src={imagePreviewUrl(media.url, 640)} alt={media.title} />
            ) : (
                <video className="pointer-events-none size-full object-cover" src={media.downloadUrl || media.url} muted playsInline preload="metadata" />
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
    return (
        <Modal
            title={media?.title || "媒体预览"}
            open={Boolean(media)}
            width={960}
            footer={
                media ? (
                    <div className="flex items-center justify-end gap-2">
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
                        <a
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                            href={downloadLink(media.downloadUrl || media.url)}
                            download={mediaDownloadFileName(media.title, media.type === "video" ? "video/mp4" : "image/png", media.url)}
                        >
                            <Download className="size-4" />
                            {media.type === "video" ? "下载视频" : "下载原图"}
                        </a>
                        {repairError ? <span className="text-xs text-rose-600">{repairError}</span> : null}
                    </div>
                ) : null
            }
            destroyOnHidden
            onCancel={onClose}
        >
            {media?.type === "image" ? <img className="max-h-[75dvh] w-full rounded-md object-contain" src={imagePreviewUrl(media.url, 2048)} alt={media.title} /> : null}
            {media?.type === "video" ? <video className="max-h-[75dvh] w-full rounded-md bg-black" src={media.downloadUrl || media.url} controls autoPlay playsInline preload="metadata" /> : null}
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
