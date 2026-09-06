"use client";

import { imagePreviewUrl } from "@/lib/media-image-url";
import { DRAMA_SCENE_REFERENCE_BOARD_VIEWS } from "@/lib/drama-scene-reference-board";

export function DramaSceneReferenceBoard({ url, alt }: { url?: string; alt: string }) {
    const previewUrl = url ? imagePreviewUrl(url, 960) : "";
    return (
        <div className="grid aspect-square w-full grid-cols-3 gap-px overflow-hidden bg-border" data-drama-scene-reference-board aria-label={alt} role="img">
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
    );
}
