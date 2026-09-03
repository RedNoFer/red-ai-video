"use client";

import { Button, Popover } from "antd";
import { ArrowLeftRight, ChevronLeft, ChevronRight, ImagePlus, Upload, X } from "lucide-react";
import { useState } from "react";

import type { CreativeAsset } from "@/lib/creative-runtime-contract";
import { imagePreviewUrl } from "@/lib/media-image-url";
import type { CreativeVideoReferenceMode, VideoReferenceRole } from "@/lib/video-reference-contract";
import { cn } from "@/lib/utils";

type FrameRole = Extract<VideoReferenceRole, "first_frame" | "last_frame">;
type FramePopoverPlacement = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export function CreativeVideoFrameControls({
    mode,
    images,
    firstFrameAssetId,
    lastFrameAssetId,
    frameAssetIds = [],
    uploading,
    placement,
    onSelect,
    onUpload,
    onRemove,
    onToggleKeyframe,
    onUploadKeyframe,
    onMoveKeyframe,
}: {
    mode: CreativeVideoReferenceMode;
    images: CreativeAsset[];
    firstFrameAssetId?: string;
    lastFrameAssetId?: string;
    frameAssetIds?: string[];
    uploading: boolean;
    placement: "topLeft" | "bottomLeft";
    onSelect: (role: FrameRole, assetId: string) => void;
    onUpload: (role: FrameRole) => void;
    onRemove: (role: FrameRole) => void;
    onToggleKeyframe?: (assetId: string) => void;
    onUploadKeyframe?: () => void;
    onMoveKeyframe?: (assetId: string, direction: -1 | 1) => void;
}) {
    if (mode === "reference") return null;
    if (mode === "all_frames") {
        return <KeyframeControls images={images} assetIds={frameAssetIds} uploading={uploading} placement={placement} onToggle={onToggleKeyframe} onUpload={onUploadKeyframe} onMove={onMoveKeyframe} />;
    }
    return (
        <div className="flex shrink-0 items-start gap-1" aria-label={mode === "first_last" ? "视频首尾帧" : "视频首帧"}>
            <FrameSlot role="first_frame" label="首帧" assetId={firstFrameAssetId} images={images} uploading={uploading} placement={placement === "bottomLeft" ? "bottomLeft" : "topLeft"} onSelect={onSelect} onUpload={onUpload} onRemove={onRemove} />
            {mode === "first_last" ? (
                <>
                    <ArrowLeftRight className="mt-7 size-3.5 shrink-0 text-[#9aa3ad] dark:text-[#7d8793]" aria-hidden="true" />
                    <FrameSlot
                        role="last_frame"
                        label="尾帧"
                        assetId={lastFrameAssetId}
                        images={images}
                        uploading={uploading}
                        placement={placement === "bottomLeft" ? "bottomRight" : "topRight"}
                        onSelect={onSelect}
                        onUpload={onUpload}
                        onRemove={onRemove}
                    />
                </>
            ) : null}
        </div>
    );
}

function KeyframeControls({
    images,
    assetIds,
    uploading,
    placement,
    onToggle,
    onUpload,
    onMove,
}: {
    images: CreativeAsset[];
    assetIds: string[];
    uploading: boolean;
    placement: "topLeft" | "bottomLeft";
    onToggle?: (assetId: string) => void;
    onUpload?: () => void;
    onMove?: (assetId: string, direction: -1 | 1) => void;
}) {
    const [open, setOpen] = useState(false);
    const frames = assetIds.map((id) => images.find((image) => image.id === id)).filter((asset): asset is CreativeAsset => Boolean(asset));
    return (
        <div className="flex shrink-0 items-start gap-1" aria-label="视频全能帧">
            <Popover
                trigger="click"
                placement={placement}
                arrow={false}
                destroyOnHidden
                open={open}
                onOpenChange={setOpen}
                content={
                    <div className="w-64 max-w-[calc(100vw-40px)] py-0.5 sm:w-80">
                        <p className="px-1 pb-2 text-xs font-semibold text-[#303943] dark:text-[#eef1f4]">选择 2–9 张有序关键帧</p>
                        <div className="hide-scrollbar grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto">
                            {images.map((item) => {
                                const url = assetUrl(item);
                                const selected = assetIds.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        disabled={!url || (!selected && assetIds.length >= 9)}
                                        className={cn(
                                            "relative aspect-square min-w-0 overflow-hidden rounded-lg border bg-[#f1f3f5] transition disabled:opacity-40 dark:bg-[#2a2f36]",
                                            selected ? "border-[#4d7f99] ring-2 ring-[#4d7f99]/20 dark:border-[#82adc3]" : "border-[#e0e4e8] hover:border-[#aeb8c2] dark:border-[#3b424b]",
                                        )}
                                        onClick={() => onToggle?.(item.id)}
                                        aria-label={`${selected ? "移除" : "添加"}关键帧：${item.title}`}
                                    >
                                        {url ? <img src={imagePreviewUrl(url, 320)} alt="" className="size-full object-cover" /> : null}
                                        {selected ? <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-center text-[10px] text-white">第 {assetIds.indexOf(item.id) + 1} 帧</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                        <Button
                            type="text"
                            block
                            className="mt-2 !h-9 !justify-start !rounded-lg !text-xs"
                            icon={<Upload className="size-3.5" />}
                            loading={uploading}
                            onClick={() => {
                                setOpen(false);
                                onUpload?.();
                            }}
                        >
                            上传新图片
                        </Button>
                    </div>
                }
            >
                <button
                    type="button"
                    className="relative grid size-14 place-items-center overflow-hidden rounded-lg border border-[#dfe4e8] bg-[#f1f3f5] text-[#84909c] shadow-[0_2px_8px_rgba(38,49,65,0.08)] transition hover:border-[#aeb8c2] dark:border-[#3c444d] dark:bg-[#191c20]"
                    aria-label="设置视频全能帧"
                >
                    {frames[0] ? <img src={imagePreviewUrl(assetUrl(frames[0]), 320)} alt="全能帧" className="size-full object-cover" /> : <ImagePlus className="size-5" />}
                    <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-center text-[9px] font-medium text-white">{frames.length ? `${frames.length} 帧` : "全能帧"}</span>
                </button>
            </Popover>
            <div className="flex max-w-36 items-center gap-1 overflow-x-auto pt-1">
                {frames.map((frame, index) => (
                    <div key={frame.id} className="relative shrink-0">
                        <img src={imagePreviewUrl(assetUrl(frame), 160)} alt={`关键帧 ${index + 1}`} className="size-10 rounded border border-[#dfe4e8] object-cover dark:border-[#3c444d]" />
                        <button type="button" className="absolute -left-1 -top-1 rounded bg-black/60 text-white" disabled={index === 0} onClick={() => onMove?.(frame.id, -1)} aria-label="关键帧前移">
                            <ChevronLeft className="size-3" />
                        </button>
                        <button type="button" className="absolute -right-1 -top-1 rounded bg-black/60 text-white" disabled={index === frames.length - 1} onClick={() => onMove?.(frame.id, 1)} aria-label="关键帧后移">
                            <ChevronRight className="size-3" />
                        </button>
                        <button type="button" className="absolute -right-1 -bottom-1 rounded bg-black/60 text-white" onClick={() => onToggle?.(frame.id)} aria-label="移除关键帧">
                            <X className="size-3" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FrameSlot({
    role,
    label,
    assetId,
    images,
    uploading,
    placement,
    onSelect,
    onUpload,
    onRemove,
}: {
    role: FrameRole;
    label: string;
    assetId?: string;
    images: CreativeAsset[];
    uploading: boolean;
    placement: FramePopoverPlacement;
    onSelect: (role: FrameRole, assetId: string) => void;
    onUpload: (role: FrameRole) => void;
    onRemove: (role: FrameRole) => void;
}) {
    const [open, setOpen] = useState(false);
    const asset = images.find((item) => item.id === assetId);
    const url = assetUrl(asset);
    return (
        <div className="relative h-16 w-14 shrink-0">
            <Popover
                trigger="click"
                placement={placement}
                arrow={false}
                destroyOnHidden
                open={open}
                onOpenChange={setOpen}
                content={
                    <div className="w-64 max-w-[calc(100vw-40px)] py-0.5 sm:w-80">
                        <p className="px-1 pb-2 text-xs font-semibold text-[#303943] dark:text-[#eef1f4]">选择{label}图片</p>
                        <div className="hide-scrollbar grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto">
                            {images.map((item) => {
                                const itemUrl = assetUrl(item);
                                const selected = item.id === assetId;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        disabled={!itemUrl}
                                        className={cn(
                                            "relative aspect-square min-w-0 overflow-hidden rounded-lg border bg-[#f1f3f5] transition disabled:opacity-40 dark:bg-[#2a2f36]",
                                            selected ? "border-[#4d7f99] ring-2 ring-[#4d7f99]/20 dark:border-[#82adc3]" : "border-[#e0e4e8] hover:border-[#aeb8c2] dark:border-[#3b424b] dark:hover:border-[#626d78]",
                                        )}
                                        onClick={() => {
                                            onSelect(role, item.id);
                                            setOpen(false);
                                        }}
                                        aria-label={`设为${label}：${item.title}`}
                                    >
                                        {itemUrl ? <img src={imagePreviewUrl(itemUrl, 320)} alt="" className="size-full object-cover" /> : <ImagePlus className="absolute inset-0 m-auto size-4 text-[#9aa3ad]" />}
                                    </button>
                                );
                            })}
                        </div>
                        {!images.length ? <p className="py-4 text-center text-xs text-[#8b949f] dark:text-[#7f8996]">本轮还没有图片素材</p> : null}
                        <Button
                            type="text"
                            block
                            className="mt-2 !h-9 !justify-start !rounded-lg !text-xs"
                            icon={<Upload className="size-3.5" />}
                            loading={uploading}
                            onClick={() => {
                                setOpen(false);
                                onUpload(role);
                            }}
                        >
                            上传新图片
                        </Button>
                    </div>
                }
            >
                <button
                    type="button"
                    className={cn(
                        "relative grid size-14 place-items-center overflow-hidden rounded-lg border border-[#dfe4e8] bg-[#f1f3f5] text-[#84909c] shadow-[0_2px_8px_rgba(38,49,65,0.08)] transition hover:border-[#aeb8c2] hover:text-[#3f4a55] dark:border-[#3c444d] dark:bg-[#191c20] dark:text-[#9ea8b3] dark:hover:border-[#626d78] dark:hover:text-white",
                        role === "first_frame" ? "rotate-[-3deg]" : "rotate-[3deg]",
                    )}
                    aria-label={asset ? `更换视频${label}` : `添加视频${label}`}
                >
                    {url ? (
                        <img src={imagePreviewUrl(url, 320)} alt={asset?.title || label} className="size-full object-cover" />
                    ) : (
                        <span className="grid size-full place-items-center bg-[#f1f3f5] dark:bg-[#242930]">
                            <ImagePlus className="size-5" />
                        </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-center text-[9px] font-medium text-white">{asset ? label : `添加${label}`}</span>
                </button>
            </Popover>
            {asset ? (
                <button
                    type="button"
                    className="absolute -right-1 -top-1 z-10 grid size-5 place-items-center rounded-full border border-white bg-black/60 text-white transition hover:bg-black/80 dark:border-[#181b20]"
                    onClick={() => onRemove(role)}
                    aria-label={`移除视频${label}`}
                >
                    <X className="size-3.5" />
                </button>
            ) : null}
        </div>
    );
}

function assetUrl(asset: CreativeAsset | undefined) {
    return asset?.serverUrl || asset?.remoteUrl || "";
}
