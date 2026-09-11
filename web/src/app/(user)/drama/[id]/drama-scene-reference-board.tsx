"use client";

import { Modal } from "antd";
import { useState } from "react";

import { imagePreviewUrl } from "@/lib/media-image-url";

export function DramaSceneReferenceBoard({ url, alt }: { url?: string; alt: string }) {
    const previewUrl = url ? imagePreviewUrl(url, 960) : "";
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
            <Modal open={previewOpen} title={alt} footer={null} onCancel={() => setPreviewOpen(false)}>
                <div className="flex max-h-[75vh] justify-center overflow-auto rounded-md bg-muted/30 p-2">{previewUrl ? <img className="max-h-[70vh] max-w-full object-contain" src={imagePreviewUrl(url!, 1920)} alt={alt} /> : null}</div>
            </Modal>
        </>
    );
}
