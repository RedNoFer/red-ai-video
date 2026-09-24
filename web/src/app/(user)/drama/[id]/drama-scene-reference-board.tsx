"use client";

import { Image, Modal } from "antd";
import { useState } from "react";

import { imagePreviewUrl, originalImageDownloadUrl } from "@/lib/media-image-url";

export function DramaSceneReferenceBoard({ url, alt }: { url?: string; alt: string }) {
    const previewUrl = url ? imagePreviewUrl(url, 960) : "";
    const originalUrl = url ? originalImageDownloadUrl(url) : "";
    const [previewOpen, setPreviewOpen] = useState(false);
    return (
        <>
            <div
                className={`grid aspect-[16/10] w-full place-items-center overflow-hidden bg-muted/60 ${previewUrl ? "cursor-zoom-in" : ""}`}
                data-drama-scene-reference-board
                aria-label={previewUrl ? `${alt}，点击预览完整基准图` : alt}
                role="img"
                title={previewUrl ? "点击预览完整场景基准图" : undefined}
                onClick={(event) => {
                    event.stopPropagation();
                    if (previewUrl) setPreviewOpen(true);
                }}
            >
                {previewUrl ? <img src={previewUrl} alt={alt} className="size-full object-contain" /> : <span className="text-[11px] text-muted-foreground">待生成高清场景全景图</span>}
            </div>
            <Modal
                open={previewOpen}
                title={alt}
                footer={null}
                centered
                destroyOnHidden
                width="min(1440px, calc(100vw - 24px))"
                styles={{
                    container: { maxWidth: "calc(100vw - 24px)", maxHeight: "calc(100dvh - 24px)" },
                    body: { maxHeight: "calc(100dvh - 108px)", overflow: "auto", padding: 0 },
                }}
                onCancel={() => setPreviewOpen(false)}
            >
                <div className="flex max-h-[calc(100dvh-108px)] min-h-0 items-center justify-center overflow-auto rounded-md bg-muted/30 p-2">
                    {previewUrl ? (
                        <Image src={imagePreviewUrl(url!, 2048)} alt={alt} className="!block !h-auto !max-h-[calc(100dvh-132px)] !w-auto !max-w-full !object-contain" preview={{ src: originalUrl || imagePreviewUrl(url!, 2048), mask: "放大查看" }} />
                    ) : null}
                </div>
            </Modal>
        </>
    );
}
