"use client";

import { Modal } from "antd";
import { useState } from "react";

import { imagePreviewUrl } from "@/lib/media-image-url";
import { DRAMA_SCENE_REFERENCE_BOARD_VIEWS } from "@/lib/drama-scene-reference-board";

export function DramaSceneReferenceBoard({ url, alt }: { url?: string; alt: string }) {
    const previewUrl = url ? imagePreviewUrl(url, 960) : "";
    const [previewOpen, setPreviewOpen] = useState(false);
    return (
        <>
            <div
                className={`grid aspect-square w-full grid-cols-3 gap-px overflow-hidden bg-border ${previewUrl ? "cursor-zoom-in" : ""}`}
                data-drama-scene-reference-board
                aria-label={previewUrl ? `${alt}，点击预览完整基准图` : alt}
                role="img"
                title={previewUrl ? "点击预览完整场景基准图" : undefined}
                onClick={(event) => {
                    event.stopPropagation();
                    if (previewUrl) setPreviewOpen(true);
                }}
            >
                {DRAMA_SCENE_REFERENCE_BOARD_VIEWS.map((view, index) => {
                    const x = index % 3;
                    const y = Math.floor(index / 3);
                    return (
                        <div
                            key={view.key}
                            className="relative min-w-0 overflow-hidden bg-muted/60"
                            style={previewUrl ? { backgroundImage: `url(${previewUrl})`, backgroundPosition: `${x * 50}% ${y * 50}%`, backgroundRepeat: "no-repeat", backgroundSize: "300% 300%" } : undefined}
                        >
                            {!previewUrl ? <span className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">{view.label}</span> : null}
                            {previewUrl ? <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 py-0.5 text-[9px] text-white">{view.label}</span> : null}
                        </div>
                    );
                })}
            </div>
            <Modal open={previewOpen} title={alt} footer={null} onCancel={() => setPreviewOpen(false)}>
                <div className="flex max-h-[75vh] justify-center overflow-auto rounded-md bg-muted/30 p-2">{previewUrl ? <img className="max-h-[70vh] max-w-full object-contain" src={imagePreviewUrl(url!, 1920)} alt={alt} /> : null}</div>
            </Modal>
        </>
    );
}
