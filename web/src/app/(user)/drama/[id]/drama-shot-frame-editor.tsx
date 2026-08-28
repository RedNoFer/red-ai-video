"use client";

import { App, Button, Image, Input, InputNumber, Modal, Segmented, Tag } from "antd";
import { ImagePlus, LoaderCircle, Plus, RotateCcw, Sparkles, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { activeFrameEvidence, createFrameEvidence, latestFrameEvidence, replaceFrameEvidence, supersedeFrameEvidenceByRole } from "@/lib/drama-continuity-policy";
import { deleteDramaFrameBeat, insertDramaFrameBeat, updateDramaFrameBeat } from "@/lib/drama-frame-sequence";
import { imagePreviewUrl } from "@/lib/media-image-url";
import type { DramaFrameBeat, DramaProductionStep, DramaProject, DramaStoryboardFrame } from "@/lib/drama-project-contract";
import { createDramaProductionRun, updateDramaProductionRun } from "@/services/api/drama-projects";
import { uploadImage } from "@/services/image-storage";
import { resolveModelRequestConfig, useEffectiveConfig } from "@/stores/use-config-store";
import { useDramaStore } from "../stores/use-drama-store";
import type { DramaShot } from "../types";

type FrameKind = "start" | "end" | "sequence";

export function DramaShotFrameEditor({ project, episodeId, shot }: { project: DramaProject; episodeId: string; shot: DramaShot }) {
    const { message } = App.useApp();
    const updateShot = useDramaStore((state) => state.updateShot);
    const config = useEffectiveConfig();
    const imageRequestConfig = resolveModelRequestConfig(config, config.imageModel || config.model);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<{ kind: FrameKind; frameId?: string }>({ kind: "start" });
    const [uploading, setUploading] = useState("");
    const [submitting, setSubmitting] = useState("");
    const frameMode = shot.storyboardFrameMode || "single";
    const startFrame = latestFrameEvidence(shot, "storyboard_start", ["candidate", "accepted"]);
    const endFrame = latestFrameEvidence(shot, "storyboard_end", ["candidate", "accepted"]);
    const startFrames = activeFrameEvidence(shot, "storyboard_start");
    const endFrames = activeFrameEvidence(shot, "storyboard_end");
    const beats = useMemo(() => frameBeats(shot), [shot]);
    const storedFrames = useMemo(() => [...(shot.storyboardFrames || [])].sort((left, right) => left.sequenceIndex - right.sequenceIndex), [shot.storyboardFrames]);
    const frameById = useMemo(() => new Map(storedFrames.map((frame) => [frame.id, frame])), [storedFrames]);
    const generationActive = storedFrames.some((frame) => frame.status === "queued" || frame.status === "running") || [shot.storyboardStatus, shot.storyboardEndStatus].some((status) => status === "queued" || status === "running");
    const completedCount = beats.filter((beat) => frameById.get(beat.id)?.status === "success" && frameById.get(beat.id)?.mediaUrl).length;
    const activeFrame = beats.find((beat) => ["queued", "running"].includes(frameById.get(beat.id)?.status || ""));
    const generationError = storedFrames.find((frame) => frame.status === "error" || frame.status === "needs_review")?.error || shot.storyboardError || shot.storyboardEndError;

    const chooseFile = (kind: FrameKind, frameId?: string) => {
        setUploadTarget({ kind, frameId });
        fileInputRef.current?.click();
    };

    const uploadFrame = async (file?: File) => {
        if (!file) return;
        const targetKey = uploadTarget.frameId || uploadTarget.kind;
        setUploading(targetKey);
        try {
            const stored = await uploadImage(file);
            const url = stored.serverUrl || stored.url;
            if (uploadTarget.kind === "sequence" && uploadTarget.frameId) {
                const beatIndex = beats.findIndex((beat) => beat.id === uploadTarget.frameId);
                const nextFrame: DramaStoryboardFrame = {
                    id: uploadTarget.frameId,
                    sequenceIndex: beatIndex + 1,
                    mediaUrl: url,
                    remoteUrl: stored.remoteUrl || (stored.serverUrl && /^https?:\/\//i.test(stored.serverUrl) ? stored.serverUrl : undefined),
                    width: stored.width,
                    height: stored.height,
                    source: "upload",
                    status: "success",
                    continuityStatus: "passed",
                    continuityEvidenceId: `manual-upload:${uploadTarget.frameId}:${Date.now()}`,
                };
                const staleIds = new Set(beats.slice(beatIndex + 1).map((beat) => beat.id));
                updateShot(project.id, episodeId, shot.id, {
                    storyboardFrameMode: "all_frames",
                    storyboardFrames: upsertStoryboardFrame(storedFrames, nextFrame).map((frame) => (staleIds.has(frame.id) ? staleFrame(frame) : frame)),
                    frameEvidence: replaceSequenceEvidence(shot.frameEvidence, createFrameEvidence({ role: "storyboard_keyframe", sequenceIndex: beatIndex + 1, source: "upload", mediaUrl: url, sourceShotId: shot.id, validity: "candidate" })),
                    ...clearedGeneratedMedia,
                });
                message.success(`帧 ${beatIndex + 1} 已上传，后续帧已标记失效`);
            } else if (uploadTarget.kind === "start") {
                updateShot(project.id, episodeId, shot.id, {
                    frameEvidence: replaceFrameEvidence(shot.frameEvidence, createFrameEvidence({ role: "storyboard_start", source: "upload", mediaUrl: url, sourceShotId: shot.id, validity: "candidate" }), "用户上传了新的分镜首帧"),
                    storyboardStatus: "success",
                    storyboardTaskId: undefined,
                    storyboardError: undefined,
                    storyboardImageUrl: url,
                    storyboardImageRemoteUrl: undefined,
                    storyboardImageUrls: [url],
                    storyboardImageWidth: stored.width,
                    storyboardImageHeight: stored.height,
                    storyboardImageDeletedAt: undefined,
                    ...clearedGeneratedMedia,
                });
                message.success("起始帧已上传");
            } else {
                updateShot(project.id, episodeId, shot.id, {
                    frameEvidence: replaceFrameEvidence(shot.frameEvidence, createFrameEvidence({ role: "storyboard_end", source: "upload", mediaUrl: url, sourceShotId: shot.id, validity: "candidate" }), "用户上传了新的分镜尾帧"),
                    storyboardFrameMode: "first_last",
                    storyboardEndStatus: "success",
                    storyboardEndTaskId: undefined,
                    storyboardEndError: undefined,
                    storyboardEndImageUrl: url,
                    storyboardEndImageRemoteUrl: undefined,
                    storyboardEndImageUrls: [url],
                    storyboardEndImageWidth: stored.width,
                    storyboardEndImageHeight: stored.height,
                    storyboardEndImageDeletedAt: undefined,
                    ...clearedGeneratedMedia,
                });
                message.success("结束帧已上传");
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : "分镜图片上传失败");
        } finally {
            setUploading("");
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const saveFramePlan = (nextBeats: DramaFrameBeat[], nextFrames = storedFrames) => {
        updateShot(project.id, episodeId, shot.id, {
            storyboardFrameMode: "all_frames",
            framePlan: {
                start: shot.framePlan?.start || { source: "independent" },
                end: shot.framePlan?.end || { required: false },
                frames: nextBeats,
                referenceManifest: shot.framePlan?.referenceManifest,
                referenceCount: shot.framePlan?.referenceCount,
            },
            storyboardFrames: nextFrames,
            fieldOrigins: { ...(shot.fieldOrigins || {}), framePlan: "manual" },
            ...clearedGeneratedMedia,
        });
    };

    const editBeat = (beat: DramaFrameBeat, patch: Partial<Pick<DramaFrameBeat, "endSecond" | "actionPrompt" | "imagePrompt">>) => {
        try {
            const next = updateDramaFrameBeat(beats, storedFrames, beat.id, patch);
            saveFramePlan(next.beats, next.frames);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "帧计划更新失败");
        }
    };

    const addBeat = (beat: DramaFrameBeat) => {
        try {
            const nextBeats = insertDramaFrameBeat(beats, beat.id);
            const changedIndex = nextBeats.findIndex((item) => item.id === beat.id);
            const staleIds = new Set(nextBeats.slice(changedIndex).map((item) => item.id));
            saveFramePlan(
                nextBeats,
                storedFrames.map((frame) => (staleIds.has(frame.id) ? staleFrame(frame) : frame)),
            );
        } catch (error) {
            message.error(error instanceof Error ? error.message : "无法增加帧段");
        }
    };

    const removeBeat = (beat: DramaFrameBeat) => {
        try {
            const index = beats.findIndex((item) => item.id === beat.id);
            const nextBeats = deleteDramaFrameBeat(beats, beat.id);
            const changedIndex = Math.max(0, index - 1);
            const staleIds = new Set(nextBeats.slice(changedIndex).map((item) => item.id));
            saveFramePlan(
                nextBeats,
                storedFrames.filter((frame) => frame.id !== beat.id).map((frame) => (staleIds.has(frame.id) ? staleFrame(frame) : frame)),
            );
        } catch (error) {
            message.error(error instanceof Error ? error.message : "无法删除帧段");
        }
    };

    const removeSequenceImage = (beat: DramaFrameBeat) => {
        const index = beats.findIndex((item) => item.id === beat.id);
        const staleIds = new Set(beats.slice(index).map((item) => item.id));
        updateShot(project.id, episodeId, shot.id, {
            storyboardFrames: storedFrames.map((frame) =>
                frame.id === beat.id ? { ...staleFrame(frame), mediaUrl: undefined, remoteUrl: undefined, width: undefined, height: undefined, source: "generated" as const } : staleIds.has(frame.id) ? staleFrame(frame) : frame,
            ),
            ...clearedGeneratedMedia,
        });
    };

    const generateSequence = async (input: { frameIds: string[]; regenerateAll?: boolean; label: string }) => {
        if (!input.frameIds.length) {
            message.info("当前帧序列已经完整，无需补齐");
            return;
        }
        const selected = new Set(input.frameIds);
        const reviewFrame = storedFrames.find((frame) => frame.status === "needs_review" && !selected.has(frame.id));
        if (reviewFrame && !input.regenerateAll) {
            message.warning(`帧 ${reviewFrame.sequenceIndex} 连续性需调整，请先修改提示词、上传替换图或单独重新生成`);
            return;
        }
        setSubmitting(input.frameIds.length === 1 ? input.frameIds[0] : "batch");
        try {
            const firstIndex = Math.min(...input.frameIds.map((id) => beats.findIndex((beat) => beat.id === id)).filter((index) => index >= 0));
            updateShot(project.id, episodeId, shot.id, {
                storyboardFrameMode: "all_frames",
                storyboardFrames: beats.map((beat, index) => {
                    const existing = frameById.get(beat.id) || emptyStoryboardFrame(beat);
                    if (selected.has(beat.id))
                        return { ...existing, status: "queued" as const, taskId: undefined, error: undefined, mediaUrl: undefined, remoteUrl: undefined, inputHash: undefined, continuityStatus: "pending" as const, continuityEvidenceId: undefined };
                    return input.frameIds.length === 1 && index > firstIndex ? staleFrame(existing) : existing;
                }),
                storyboardError: undefined,
                ...clearedGeneratedMedia,
            });
            await useDramaStore.getState().saveProjectNow(project.id);
            const run = await createDramaProductionRun(project.id, episodeId, "visual", undefined, {
                shotIds: [shot.id],
                imageModel: imageRequestConfig.model,
                imageChannelId: imageRequestConfig.channelId,
                imageQuality: config.quality,
                frameType: "all_frames",
                frameIds: input.frameIds,
                regenerateAll: input.regenerateAll,
            });
            const confirmed = await updateDramaProductionRun(project.id, run.id, { action: "confirm" });
            const frameSteps = confirmed.steps.filter((step) => step.shotId === shot.id && step.type === "keyframe");
            updateShot(project.id, episodeId, shot.id, {
                storyboardFrames: beats.map((beat) => {
                    const live = useDramaStore
                        .getState()
                        .projects.find((item) => item.id === project.id)
                        ?.episodes.find((item) => item.id === episodeId)
                        ?.shots.find((item) => item.id === shot.id)
                        ?.storyboardFrames?.find((frame) => frame.id === beat.id);
                    const existing = live || frameById.get(beat.id) || emptyStoryboardFrame(beat);
                    const step = frameSteps.find((item) => item.frameId === beat.id);
                    return step ? { ...existing, status: storyboardTaskStatus(step), taskId: step.taskId, error: step.error } : existing;
                }),
            });
            const created = frameSteps.some((step) => Boolean(step.taskId));
            const failed = frameSteps.find((step) => step.status === "failed" || step.status === "needs_review");
            if (failed) message.error(failed.error || `${failed.title}启动失败`);
            else if (!created && confirmed.status === "completed") message.info("当前帧序列已经完整，无需创建新的图片任务");
            else if (!created) message.error("图片供应商任务没有创建，请查看当前帧状态");
            else message.success(`${input.label}已提交，系统会按帧顺序生成并逐帧检查连续性`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "导演 Agent 生图启动失败";
            const liveFrames =
                useDramaStore
                    .getState()
                    .projects.find((item) => item.id === project.id)
                    ?.episodes.find((item) => item.id === episodeId)
                    ?.shots.find((item) => item.id === shot.id)?.storyboardFrames || storedFrames;
            updateShot(project.id, episodeId, shot.id, {
                storyboardFrames: beats.map((beat) => {
                    const frame = liveFrames.find((item) => item.id === beat.id) || emptyStoryboardFrame(beat);
                    return selected.has(beat.id) ? { ...frame, status: "error" as const, taskId: undefined, error: errorMessage } : frame;
                }),
                storyboardError: errorMessage,
            });
            message.error(errorMessage);
        } finally {
            setSubmitting("");
        }
    };

    const generateMissing = () => {
        const firstMissing = beats.findIndex((beat) => {
            const frame = frameById.get(beat.id);
            return !frame?.mediaUrl || frame.status === "stale" || frame.status === "error" || frame.status === "cancelled";
        });
        void generateSequence({ frameIds: firstMissing < 0 ? [] : beats.slice(firstMissing).map((beat) => beat.id), label: "逐帧补齐任务" });
    };

    const regenerateAll = () => {
        Modal.confirm({
            title: "重新生成全部帧？",
            content: `将重新创建 ${beats.length} 个图片任务，并按顺序执行。已有图片只会保留在历史记录中。`,
            okText: "确认重新生成",
            cancelText: "取消",
            okButtonProps: { danger: true },
            onOk: () => generateSequence({ frameIds: beats.map((beat) => beat.id), regenerateAll: true, label: "全部帧重生任务" }),
        });
    };

    const generateLegacy = async () => {
        const frameType = startFrame && frameMode === "first_last" && !endFrame ? "end_frame" : "start_frame";
        setSubmitting(frameType);
        try {
            await useDramaStore.getState().saveProjectNow(project.id);
            const run = await createDramaProductionRun(project.id, episodeId, "visual", undefined, {
                shotIds: [shot.id],
                imageModel: imageRequestConfig.model,
                imageChannelId: imageRequestConfig.channelId,
                imageQuality: config.quality,
                frameType,
            });
            const confirmed = await updateDramaProductionRun(project.id, run.id, { action: "confirm" });
            const step = confirmed.steps.find((item) => item.shotId === shot.id && item.type === frameType);
            updateShot(
                project.id,
                episodeId,
                shot.id,
                frameType === "end_frame"
                    ? { storyboardEndStatus: storyboardTaskStatus(step), storyboardEndTaskId: step?.taskId, storyboardEndError: step?.error }
                    : { storyboardStatus: storyboardTaskStatus(step), storyboardTaskId: step?.taskId, storyboardError: step?.error },
            );
            if (!step?.taskId) message.error(step?.error || "图片供应商任务没有创建");
            else message.success(`已提交${frameType === "end_frame" ? "结束帧" : "起始帧"}生成任务`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "导演 Agent 生图启动失败");
        } finally {
            setSubmitting("");
        }
    };

    const switchMode = (value: string | number) => {
        const mode = value as "single" | "first_last" | "all_frames";
        updateShot(project.id, episodeId, shot.id, {
            storyboardFrameMode: mode,
            ...(mode === "all_frames" && !shot.framePlan ? { framePlan: { start: { source: "independent" as const }, end: { required: false }, frames: beats }, fieldOrigins: { ...(shot.fieldOrigins || {}), framePlan: "manual" as const } } : {}),
            ...clearedGeneratedMedia,
        });
    };

    return (
        <div className="mt-3.5 border-t border-border/70 pt-3.5">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                        <div className="shrink-0 text-sm font-semibold">分镜帧</div>
                        <p className="truncate text-xs leading-5 text-muted-foreground">每帧对应一个连续动作时间段，最多 9 帧</p>
                    </div>
                    {frameMode === "all_frames" ? (
                        <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
                            {activeFrame ? `正在生成帧 ${activeFrame.sequenceIndex}/${beats.length} · 已完成 ${completedCount}` : `已完成 ${completedCount}/${beats.length}`}
                        </p>
                    ) : null}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {frameMode === "all_frames" ? (
                        <>
                            <Button size="small" icon={submitting === "batch" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} disabled={Boolean(submitting) || generationActive} onClick={generateMissing}>
                                一键补齐
                            </Button>
                            <Button size="small" icon={<RotateCcw className="size-3.5" />} disabled={Boolean(submitting) || generationActive} onClick={regenerateAll}>
                                重新生成全部
                            </Button>
                        </>
                    ) : (
                        <Button size="small" icon={<Sparkles className="size-3.5" />} loading={Boolean(submitting)} disabled={generationActive} onClick={() => void generateLegacy()}>
                            让 Agent 生成
                        </Button>
                    )}
                    <Segmented
                        className="!w-fit !shrink-0"
                        disabled={Boolean(submitting) || generationActive}
                        value={frameMode}
                        options={[
                            { label: "单帧", value: "single" },
                            { label: "首尾帧", value: "first_last" },
                            { label: "全能帧", value: "all_frames" },
                        ]}
                        onChange={switchMode}
                    />
                </div>
            </div>

            {frameMode === "all_frames" ? (
                <div className="mt-3 space-y-2.5" data-drama-frame-sequence>
                    {beats.map((beat, index) => {
                        const frame = frameById.get(beat.id);
                        const rowBusy = submitting === beat.id || frame?.status === "queued" || frame?.status === "running";
                        const previous = index ? frameById.get(beats[index - 1].id) : undefined;
                        const canGenerate = index === 0 || Boolean(previous?.mediaUrl && previous.status === "success" && previous.continuityStatus !== "needs_review" && previous.continuityStatus !== "stale");
                        return (
                            <div key={beat.id} className="grid min-w-0 gap-3 rounded-md border border-border/80 bg-muted/10 p-2.5 sm:grid-cols-[144px_minmax(0,1fr)]" data-drama-frame-row={beat.id}>
                                <div className="min-w-0">
                                    <div className="relative aspect-video w-full overflow-hidden rounded border border-border/70 bg-background sm:w-36">
                                        {frame?.mediaUrl ? (
                                            <Image className="!size-full !object-cover" src={imagePreviewUrl(frame.mediaUrl, 640)} alt={`帧 ${beat.sequenceIndex}`} preview={{ mask: "查看", src: imagePreviewUrl(frame.mediaUrl, 1920) }} />
                                        ) : (
                                            <button
                                                type="button"
                                                className="grid size-full place-items-center text-muted-foreground hover:bg-muted/45 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                                disabled={rowBusy}
                                                onClick={() => chooseFile("sequence", beat.id)}
                                                aria-label={`上传帧 ${beat.sequenceIndex}`}
                                            >
                                                {rowBusy ? <LoaderCircle className="size-5 animate-spin text-primary" /> : <ImagePlus className="size-5" />}
                                            </button>
                                        )}
                                    </div>
                                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
                                        <Button type="text" size="small" className="!h-7 !px-1.5" loading={uploading === beat.id} disabled={rowBusy} icon={<Upload className="size-3.5" />} onClick={() => chooseFile("sequence", beat.id)}>
                                            {frame?.mediaUrl ? "替换" : "上传"}
                                        </Button>
                                        {frame?.mediaUrl ? (
                                            <Button
                                                type="text"
                                                size="small"
                                                danger
                                                className="!size-7 !min-w-0 !p-0"
                                                disabled={rowBusy}
                                                aria-label={`移除帧 ${beat.sequenceIndex} 图片`}
                                                icon={<Trash2 className="size-3.5" />}
                                                onClick={() => removeSequenceImage(beat)}
                                            />
                                        ) : null}
                                    </div>
                                </div>
                                <div className="min-w-0 space-y-2">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold">帧 {beat.sequenceIndex}</span>
                                        <span className="text-xs text-muted-foreground">{formatSecond(beat.startSecond)}s</span>
                                        <span className="text-xs text-muted-foreground">至</span>
                                        <InputNumber
                                            size="small"
                                            className="!w-20"
                                            min={beat.startSecond + 0.1}
                                            max={index + 1 < beats.length ? beats[index + 1].endSecond - 0.1 : shot.duration}
                                            step={0.1}
                                            precision={1}
                                            value={beat.endSecond}
                                            disabled={rowBusy || index === beats.length - 1}
                                            onChange={(value) => typeof value === "number" && editBeat(beat, { endSecond: value })}
                                            aria-label={`帧 ${beat.sequenceIndex} 结束时间`}
                                        />
                                        <span className="text-xs text-muted-foreground">s</span>
                                        <FrameStatusTag frame={frame} />
                                        <div className="ml-auto flex items-center gap-1">
                                            <Button
                                                size="small"
                                                icon={rowBusy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                                                disabled={Boolean(submitting) || generationActive || !canGenerate}
                                                title={!canGenerate ? "请先完成并验收上一帧" : undefined}
                                                onClick={() => void generateSequence({ frameIds: [beat.id], label: `帧 ${beat.sequenceIndex} 任务` })}
                                            >
                                                生成
                                            </Button>
                                            <Button
                                                type="text"
                                                size="small"
                                                className="!size-7 !min-w-0 !p-0"
                                                icon={<Plus className="size-3.5" />}
                                                disabled={beats.length >= 9 || rowBusy}
                                                aria-label={`在帧 ${beat.sequenceIndex} 后增加帧`}
                                                onClick={() => addBeat(beat)}
                                            />
                                            <Button
                                                type="text"
                                                size="small"
                                                danger
                                                className="!size-7 !min-w-0 !p-0"
                                                icon={<Trash2 className="size-3.5" />}
                                                disabled={beats.length <= 1 || rowBusy}
                                                aria-label={`删除帧 ${beat.sequenceIndex}`}
                                                onClick={() => removeBeat(beat)}
                                            />
                                        </div>
                                    </div>
                                    <label className="block text-xs text-muted-foreground">
                                        动作提示词
                                        <Input.TextArea className="mt-1" autoSize={{ minRows: 1, maxRows: 3 }} value={beat.actionPrompt} disabled={rowBusy} onChange={(event) => editBeat(beat, { actionPrompt: event.target.value })} />
                                    </label>
                                    <label className="block text-xs text-muted-foreground">
                                        画面提示词
                                        <Input.TextArea className="mt-1" autoSize={{ minRows: 2, maxRows: 4 }} value={beat.imagePrompt} disabled={rowBusy} onChange={(event) => editBeat(beat, { imagePrompt: event.target.value })} />
                                    </label>
                                    {frame?.error ? (
                                        <p role="alert" className="text-xs leading-5 text-destructive">
                                            {frame.error}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                    <p className="text-xs leading-5 text-muted-foreground">系统严格按顺序生成：当前帧通过相邻画面连续性检查后，才会提交下一帧。单帧生成只创建当前图片任务。</p>
                </div>
            ) : (
                <div className="mt-3 grid min-w-0 gap-2.5 sm:grid-cols-2">
                    <FrameSlot
                        title="起始帧"
                        urls={startFrames.map((frame) => frame.mediaUrl)}
                        loading={uploading === "start"}
                        disabled={Boolean(submitting) || generationActive}
                        onUpload={() => chooseFile("start")}
                        onRemove={() => removeLegacyFrame("start", project, episodeId, shot, updateShot)}
                    />
                    {frameMode === "first_last" ? (
                        <FrameSlot
                            title="结束帧"
                            urls={endFrames.map((frame) => frame.mediaUrl)}
                            loading={uploading === "end"}
                            disabled={Boolean(submitting) || generationActive}
                            onUpload={() => chooseFile("end")}
                            onRemove={() => removeLegacyFrame("end", project, episodeId, shot, updateShot)}
                        />
                    ) : null}
                </div>
            )}
            {generationError ? (
                <p role="alert" className="mt-2 text-xs leading-5 text-destructive">
                    分镜帧生成失败：{generationError}
                </p>
            ) : null}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadFrame(event.target.files?.[0])} />
        </div>
    );
}

function FrameSlot({ title, urls, loading, disabled, onUpload, onRemove }: { title: string; urls: string[]; loading: boolean; disabled: boolean; onUpload: () => void; onRemove: () => void }) {
    return (
        <div className="flex min-w-0 items-center gap-2.5 rounded-md border border-border/80 bg-muted/15 p-2">
            <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded border border-border/70 bg-background">
                {urls.length ? (
                    <Image className="!size-full !object-cover" src={imagePreviewUrl(urls[0], 640)} alt={title} preview={{ mask: "查看", src: imagePreviewUrl(urls[0], 1920) }} />
                ) : (
                    <button
                        type="button"
                        disabled={disabled}
                        className="grid size-full place-items-center text-muted-foreground hover:bg-muted/45 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={onUpload}
                        aria-label={`上传${title}`}
                    >
                        <ImagePlus className="size-4.5" />
                    </button>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{title}</span>
                <div className="mt-1 flex items-center gap-0.5">
                    <Button type="text" size="small" className="!h-7 !px-1.5" loading={loading} disabled={disabled} icon={<Upload className="size-3.5" />} onClick={onUpload}>
                        {urls.length ? "替换" : "上传"}
                    </Button>
                    {urls.length ? <Button type="text" size="small" danger disabled={disabled} className="!size-7 !min-w-0 !p-0" aria-label={`移除${title}`} icon={<Trash2 className="size-3.5" />} onClick={onRemove} /> : null}
                </div>
            </div>
        </div>
    );
}

function FrameStatusTag({ frame }: { frame?: DramaStoryboardFrame }) {
    const state = frame?.status || "idle";
    const labels: Record<string, string> = { idle: "待生成", queued: "排队中", running: "生成中", success: "已完成", stale: "已失效", needs_review: "连续性需调整", error: "失败", cancelled: "已取消" };
    const colors: Record<string, string> = { queued: "processing", running: "processing", success: "success", stale: "warning", needs_review: "warning", error: "error", cancelled: "default", idle: "default" };
    return <Tag color={colors[state]}>{labels[state] || state}</Tag>;
}

function frameBeats(shot: DramaShot): DramaFrameBeat[] {
    return shot.framePlan?.frames?.length
        ? [...shot.framePlan.frames].sort((left, right) => left.sequenceIndex - right.sequenceIndex)
        : [{ id: `frame-${shot.id}-1`, sequenceIndex: 1, startSecond: 0, endSecond: shot.duration, actionPrompt: shot.videoPrompt.trim(), imagePrompt: shot.imagePrompt.trim() }];
}

function emptyStoryboardFrame(beat: DramaFrameBeat): DramaStoryboardFrame {
    return { id: beat.id, sequenceIndex: beat.sequenceIndex, source: "generated", status: "idle" };
}

function staleFrame(frame: DramaStoryboardFrame): DramaStoryboardFrame {
    return { ...frame, status: "stale", taskId: undefined, error: undefined, inputHash: undefined, continuityStatus: "stale", continuityEvidenceId: undefined };
}

function upsertStoryboardFrame(frames: DramaStoryboardFrame[], next: DramaStoryboardFrame) {
    return [...frames.filter((frame) => frame.id !== next.id), next].sort((left, right) => left.sequenceIndex - right.sequenceIndex);
}

function storyboardTaskStatus(step: DramaProductionStep | undefined): DramaStoryboardFrame["status"] {
    if (!step) return "queued";
    if (step.status === "success" && step.outputUrls?.length) return "success";
    if (step.status === "failed") return "error";
    if (step.status === "cancelled") return "cancelled";
    if (step.status === "needs_review") return "needs_review";
    return step.taskId || step.status === "ready" || step.status === "running" ? "running" : "queued";
}

function replaceSequenceEvidence(frames: DramaShot["frameEvidence"], next: NonNullable<DramaShot["frameEvidence"]>[number]) {
    return [
        ...(frames || []).map((frame) =>
            frame.role === "storyboard_keyframe" && frame.sequenceIndex === next.sequenceIndex && (frame.validity === "accepted" || frame.validity === "candidate")
                ? { ...frame, validity: "superseded" as const, invalidReason: "用户上传了新的逐帧锚点图" }
                : frame,
        ),
        next,
    ];
}

function removeLegacyFrame(kind: "start" | "end", project: DramaProject, episodeId: string, shot: DramaShot, updateShot: ReturnType<typeof useDramaStore.getState>["updateShot"]) {
    updateShot(project.id, episodeId, shot.id, {
        ...(kind === "start"
            ? {
                  frameEvidence: supersedeFrameEvidenceByRole(shot.frameEvidence, "storyboard_start", "用户删除了分镜首帧"),
                  storyboardStatus: "idle" as const,
                  storyboardImageUrl: undefined,
                  storyboardImageRemoteUrl: undefined,
                  storyboardImageUrls: undefined,
              }
            : {
                  frameEvidence: supersedeFrameEvidenceByRole(shot.frameEvidence, "storyboard_end", "用户删除了分镜尾帧"),
                  storyboardEndStatus: "idle" as const,
                  storyboardEndImageUrl: undefined,
                  storyboardEndImageRemoteUrl: undefined,
                  storyboardEndImageUrls: undefined,
              }),
        ...clearedGeneratedMedia,
    });
}

function formatSecond(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const clearedGeneratedMedia = { generationStatus: "idle" as const, generationTaskId: undefined, generationError: undefined, videoUrl: undefined, audioStatus: "idle" as const, audioTaskId: undefined, audioError: undefined, audioUrl: undefined };
