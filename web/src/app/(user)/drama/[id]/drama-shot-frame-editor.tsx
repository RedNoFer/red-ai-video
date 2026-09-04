"use client";

import { App, Button, Image, Input, InputNumber, Modal, Segmented, Tag } from "antd";
import { Check, ImagePlus, LoaderCircle, Maximize2, Plus, RotateCcw, Save, ScanSearch, Sparkles, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { approvedAssetReference } from "@/lib/drama-asset-baseline";
import { activeFrameEvidence, continuityStartEvidence, createFrameEvidence, latestFrameEvidence, replaceFrameEvidence, supersedeFrameEvidenceByRole } from "@/lib/drama-continuity-policy";
import { deleteDramaFrameBeat, dramaFrameVisualSubject, formatPromptFieldLines, insertDramaFrameBeat, updateDramaFrameBeat, validateDramaFrameVisualContent } from "@/lib/drama-frame-sequence";
import { appendDramaImageReferenceBindings, compileDramaFrameSupplierPrompt, resolveDramaFrameScene } from "@/lib/drama-prompt-compiler";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { dramaAssetReferences } from "./drama-asset-reference-utils";
import type { DramaFrameBeat, DramaImageReferenceBinding, DramaProductionStep, DramaProject, DramaStoryboardFrame, DramaStoryboardFrameCandidate } from "@/lib/drama-project-contract";
import { acceptDramaStoryboardFrame, createDramaProductionRun, reviewDramaStoryboardFrame, updateDramaProductionRun, updateDramaStoryboardFramePrompt } from "@/services/api/drama-projects";
import { optimizeDramaFramePrompt } from "@/services/api/prompt-optimization";
import { uploadImage } from "@/services/image-storage";
import { resolveModelRequestConfig, useEffectiveConfig } from "@/stores/use-config-store";
import { useDramaStore } from "../stores/use-drama-store";
import type { DramaShot } from "../types";

type FrameKind = "start" | "end" | "sequence";
type PromptPreview = { title: string; prompt: string; references: DramaImageReferenceBinding[]; frameId?: string; phase?: "start" | "end"; visibleSubject?: string; readOnly?: boolean };
type ReferencePreview = { reference: DramaImageReferenceBinding; index: number };

export function DramaShotFrameEditor({ project, episodeId, shot }: { project: DramaProject; episodeId: string; shot: DramaShot }) {
    const { message, modal } = App.useApp();
    const updateShot = useDramaStore((state) => state.updateShot);
    const replaceProject = useDramaStore((state) => state.replaceProject);
    const config = useEffectiveConfig();
    const imageRequestConfig = resolveModelRequestConfig(config, config.imageModel || config.model);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const submittingRef = useRef(false);
    const savingPromptRef = useRef(false);
    const [uploadTarget, setUploadTarget] = useState<{ kind: FrameKind; frameId?: string }>({ kind: "start" });
    const [uploading, setUploading] = useState("");
    const [submitting, setSubmitting] = useState("");
    const [reviewingFrameId, setReviewingFrameId] = useState("");
    const [promptPreview, setPromptPreview] = useState<PromptPreview | null>(null);
    const [referencePreview, setReferencePreview] = useState<ReferencePreview | null>(null);
    const [promptDraft, setPromptDraft] = useState("");
    const [promptOriginal, setPromptOriginal] = useState("");
    const [optimizingPrompt, setOptimizingPrompt] = useState(false);
    const [savingPrompt, setSavingPrompt] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [manualReferenceDraft, setManualReferenceDraft] = useState<DramaImageReferenceBinding[]>([]);
    const frameMode = shot.storyboardFrameMode || "single";
    const startFrame = latestFrameEvidence(shot, "storyboard_start", ["candidate", "accepted"]);
    const endFrame = latestFrameEvidence(shot, "storyboard_end", ["candidate", "accepted"]);
    const startPromptEvidence = latestPromptEvidence(shot, "storyboard_start");
    const endPromptEvidence = latestPromptEvidence(shot, "storyboard_end");
    const startFrames = activeFrameEvidence(shot, "storyboard_start");
    const endFrames = activeFrameEvidence(shot, "storyboard_end");
    const beats = useMemo(() => frameBeats(shot), [shot]);
    const storedFrames = useMemo(() => [...(shot.storyboardFrames || [])].sort((left, right) => left.sequenceIndex - right.sequenceIndex), [shot.storyboardFrames]);
    const frameById = useMemo(() => new Map(storedFrames.map((frame) => [frame.id, frame])), [storedFrames]);
    const generationActive =
        storedFrames.some((frame) => frame.status === "queued" || frame.status === "running" || frame.candidateStatus === "queued" || frame.candidateStatus === "running") ||
        [shot.storyboardStatus, shot.storyboardEndStatus].some((status) => status === "queued" || status === "running");
    const completedCount = beats.filter((beat) => frameById.get(beat.id)?.status === "success" && frameById.get(beat.id)?.mediaUrl).length;
    const activeFrame = beats.find((beat) => {
        const frame = frameById.get(beat.id);
        return ["queued", "running"].includes(frame?.status || "") || ["queued", "running"].includes(frame?.candidateStatus || "");
    });
    const generationError =
        storedFrames.find((frame) => frame.status === "error" || frame.continuityStatus === "needs_review")?.error || storedFrames.find((frame) => frame.candidateError)?.candidateError || shot.storyboardError || shot.storyboardEndError;

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
                    storyboardPrompt: undefined,
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
                    storyboardEndPrompt: undefined,
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
                manualReferenceImages: shot.framePlan?.manualReferenceImages,
                referenceCount: shot.framePlan?.referenceCount,
            },
            storyboardFrames: nextFrames,
            storyboardPrompt: undefined,
            storyboardEndPrompt: undefined,
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

    const acceptCurrentFrame = (beat: DramaFrameBeat) => {
        const frame = frameById.get(beat.id);
        if (!frame?.mediaUrl) return;
        modal.confirm({
            title: `确认验收帧 ${beat.sequenceIndex}？`,
            content: "确认后会使用当前图片并解锁下一帧，不会重新生成图片。请先点击左侧图片查看大图，确认人物、场景和动作连续性可以接受。",
            okText: "确认使用当前图",
            cancelText: "取消",
            onOk: async () => {
                try {
                    replaceProject(await acceptDramaStoryboardFrame(project.id, episodeId, shot.id, beat.id));
                    message.success(`帧 ${beat.sequenceIndex} 已人工验收，可继续生成下一帧`);
                } catch (error) {
                    message.error(error instanceof Error ? error.message : "分镜帧验收失败");
                    throw error;
                }
            },
        });
    };

    const inspectFrame = async (beat: DramaFrameBeat) => {
        if (reviewingFrameId) return;
        const frame = frameById.get(beat.id);
        if (!frame?.mediaUrl) return;
        setReviewingFrameId(beat.id);
        try {
            const result = await reviewDramaStoryboardFrame(project.id, episodeId, shot.id, beat.id);
            replaceProject(result.project);
            if (result.review.status === "passed") message.success(`帧 ${beat.sequenceIndex} 检验通过`);
            else if (result.review.status === "needs_revision") message.warning(`帧 ${beat.sequenceIndex} 检验未通过，请查看结果后处理`);
            else message.info(result.review.summary || "图片检验暂不可用");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "图片检验失败");
        } finally {
            setReviewingFrameId("");
        }
    };

    const selectFrameCandidate = (beat: DramaFrameBeat, candidate: DramaStoryboardFrameCandidate) => {
        modal.confirm({
            title: `确认将此候选设为帧 ${beat.sequenceIndex}？`,
            content: "确认后才会替换当前帧，并把后续帧标记为需要重新生成；取消不会改变现有图片。候选缩略图可先点击查看大图。",
            okText: "确认替换当前帧",
            cancelText: "保留原图",
            onOk: async () => {
                try {
                    replaceProject(await acceptDramaStoryboardFrame(project.id, episodeId, shot.id, beat.id, candidate.id));
                    message.success(`帧 ${beat.sequenceIndex} 已切换为所选候选，后续帧已标记失效`);
                } catch (error) {
                    message.error(error instanceof Error ? error.message : "候选图片切换失败");
                    throw error;
                }
            },
        });
    };

    const generateSequence = async (input: { frameIds: string[]; regenerateAll?: boolean; label: string }) => {
        if (submittingRef.current) return;
        if (!input.frameIds.length) {
            message.info("当前帧序列已经完整，无需补齐");
            return;
        }
        const selected = new Set(input.frameIds);
        const reviewFrame = storedFrames.find((frame) => frame.continuityStatus === "needs_review" && !selected.has(frame.id));
        if (reviewFrame && !input.regenerateAll) {
            message.warning(`帧 ${reviewFrame.sequenceIndex} 连续性需调整，请先修改提示词、上传替换图或单独重新生成`);
            return;
        }
        submittingRef.current = true;
        setSubmitting(input.frameIds.length === 1 ? input.frameIds[0] : "batch");
        try {
            updateShot(project.id, episodeId, shot.id, {
                storyboardFrameMode: "all_frames",
                storyboardFrames: beats.map((beat) => {
                    const existing = frameById.get(beat.id) || emptyStoryboardFrame(beat);
                    if (selected.has(beat.id))
                        return existing.mediaUrl
                            ? { ...existing, candidateStatus: "queued" as const, candidateTaskId: undefined, candidateError: undefined }
                            : { ...existing, status: "queued" as const, taskId: undefined, error: undefined, inputHash: undefined, continuityStatus: "pending" as const, continuityEvidenceId: undefined };
                    return existing;
                }),
                storyboardError: undefined,
                ...clearedGeneratedMedia,
            });
            const run = await createDramaProductionRun(project.id, episodeId, "visual", undefined, {
                shotIds: [shot.id],
                imageModel: imageRequestConfig.model,
                imageChannelId: imageRequestConfig.channelId,
                imageQuality: config.quality,
                frameType: "all_frames",
                frameIds: input.frameIds,
                regenerateAll: input.regenerateAll,
                shotSnapshot: compactShotSnapshot(
                    useDramaStore
                        .getState()
                        .projects.find((item) => item.id === project.id)
                        ?.episodes.find((episode) => episode.id === episodeId)
                        ?.shots.find((item) => item.id === shot.id),
                ),
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
                    return step
                        ? existing.mediaUrl
                            ? { ...existing, candidateStatus: storyboardTaskStatus(step), candidateTaskId: step.taskId, candidateError: step.error }
                            : { ...existing, status: storyboardTaskStatus(step), taskId: step.taskId, error: step.error, generationPrompt: step.executionPrompt || step.prompt, generationReferences: step.referenceImagesSnapshot }
                        : existing;
                }),
            });
            const created = frameSteps.some((step) => Boolean(step.taskId));
            const failed = frameSteps.find((step) => step.status === "failed" || step.status === "needs_review");
            if (failed) message.error(failed.error || `${failed.title}启动失败`);
            else if (!created && confirmed.status === "completed") message.info("当前帧序列已经完整，无需创建新的图片任务");
            else if (!created) message.error("图片供应商任务没有创建，请查看当前帧状态");
            else message.success(`${input.label}已提交，系统会按帧顺序生成；完成后可手动检验图片`);
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
                    return selected.has(beat.id)
                        ? frame.mediaUrl
                            ? { ...frame, candidateStatus: "error" as const, candidateTaskId: undefined, candidateError: errorMessage }
                            : { ...frame, status: "error" as const, taskId: undefined, error: errorMessage }
                        : frame;
                }),
                storyboardError: errorMessage,
            });
            message.error(errorMessage);
        } finally {
            submittingRef.current = false;
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
        modal.confirm({
            title: "重新生成全部帧？",
            content: `将重新创建 ${beats.length} 个图片任务，并按顺序执行。已有图片保持为当前帧，新结果进入候选；只有设为当前帧后才会更新后续连续性。`,
            okText: "确认重新生成",
            cancelText: "取消",
            okButtonProps: { danger: true },
            onOk: () => generateSequence({ frameIds: beats.map((beat) => beat.id), regenerateAll: true, label: "全部帧重生任务" }),
        });
    };

    const generateLegacy = async () => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        const frameType = startFrame && frameMode === "first_last" && !endFrame ? "end_frame" : "start_frame";
        setSubmitting(frameType);
        try {
            const run = await createDramaProductionRun(project.id, episodeId, "visual", undefined, {
                shotIds: [shot.id],
                imageModel: imageRequestConfig.model,
                imageChannelId: imageRequestConfig.channelId,
                imageQuality: config.quality,
                frameType,
                shotSnapshot: compactShotSnapshot(shot),
            });
            const confirmed = await updateDramaProductionRun(project.id, run.id, { action: "confirm" });
            const step = confirmed.steps.find((item) => item.shotId === shot.id && item.type === frameType);
            updateShot(
                project.id,
                episodeId,
                shot.id,
                frameType === "end_frame"
                    ? { storyboardEndStatus: storyboardTaskStatus(step), storyboardEndTaskId: step?.taskId, storyboardEndError: step?.error, storyboardEndPrompt: step?.executionPrompt || step?.prompt }
                    : { storyboardStatus: storyboardTaskStatus(step), storyboardTaskId: step?.taskId, storyboardError: step?.error, storyboardPrompt: step?.executionPrompt || step?.prompt },
            );
            if (!step?.taskId) message.error(step?.error || "图片供应商任务没有创建");
            else message.success(`已提交${frameType === "end_frame" ? "结束帧" : "起始帧"}生成任务`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "导演 Agent 生图启动失败");
        } finally {
            submittingRef.current = false;
            setSubmitting("");
        }
    };

    const switchMode = (value: string | number) => {
        const mode = value as "single" | "first_last" | "all_frames";
        updateShot(project.id, episodeId, shot.id, {
            storyboardFrameMode: mode,
            ...(mode === "all_frames" && !shot.framePlan ? { framePlan: { start: { source: "independent" as const }, end: { required: false }, frames: beats }, fieldOrigins: { ...(shot.fieldOrigins || {}), framePlan: "manual" as const } } : {}),
            storyboardPrompt: undefined,
            storyboardEndPrompt: undefined,
            ...clearedGeneratedMedia,
        });
    };

    const openPromptPreview = (input: PromptPreview) => {
        const prompt = appendDramaImageReferenceBindings(formatPromptFieldLines(input.prompt, "static"), input.references);
        setPromptPreview({ ...input, prompt });
        setPromptDraft(formatPromptFieldLines(prompt, "static"));
        setPromptOriginal(formatPromptFieldLines(prompt, "static"));
    };

    const savePromptPreview = async () => {
        const current = promptPreview;
        const prompt = formatPromptFieldLines(promptDraft, "static");
        if (!current || current.readOnly || !prompt || savingPromptRef.current) return;
        if (current.frameId) {
            const visualError = validateDramaFrameVisualContent(prompt);
            if (visualError) {
                message.error(visualError);
                return;
            }
            try {
                savingPromptRef.current = true;
                setSavingPrompt(true);
                const supplierPrompt = prompt;
                replaceProject(await updateDramaStoryboardFramePrompt(project.id, episodeId, shot.id, current.frameId, supplierPrompt));
                message.success("图片提示词已保存，当前帧已标记为待重新生成");
            } catch (error) {
                message.error(error instanceof Error ? error.message : "图片提示词保存失败");
                return;
            } finally {
                savingPromptRef.current = false;
                setSavingPrompt(false);
            }
        } else if (current.phase) {
            updateShot(
                project.id,
                episodeId,
                shot.id,
                current.phase === "start" ? { startFramePrompt: prompt, fieldOrigins: { ...(shot.fieldOrigins || {}), startFramePrompt: "manual" } } : { endFramePrompt: prompt, fieldOrigins: { ...(shot.fieldOrigins || {}), endFramePrompt: "manual" } },
            );
            message.success("图片提示词已保存");
        }
        setPromptPreview(null);
    };

    const optimizePromptPreview = async () => {
        const current = promptPreview;
        const prompt = promptDraft.trim();
        if (!current || current.readOnly || !prompt || optimizingPrompt) return;
        setOptimizingPrompt(true);
        try {
            setPromptDraft(formatPromptFieldLines(appendDramaImageReferenceBindings(await optimizeDramaFramePrompt(prompt), current.references), "static"));
            message.success("已按 Seedance 2.0 规则生成新的帧提示词，请确认后保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "帧提示词优化失败");
        } finally {
            setOptimizingPrompt(false);
        }
    };

    const openAssetPicker = () => {
        const options = availableManualReferenceImages(project);
        const existing = shot.framePlan?.manualReferenceImages || (promptPreview?.references || []).filter((reference) => !reference.id.startsWith("continuity-"));
        setManualReferenceDraft(existing.flatMap((reference) => options.find((option) => option.url === reference.url) || reference));
        setAssetPickerOpen(true);
    };

    const saveManualReferences = () => {
        const nextManual = manualReferenceDraft;
        const current = promptPreview;
        updateShot(project.id, episodeId, shot.id, {
            framePlan: { ...(shot.framePlan || { start: { source: "independent" as const }, end: { required: false }, frames: beats }), manualReferenceImages: nextManual },
        });
        if (current) {
            const continuity = current.references.filter((reference) => reference.id.startsWith("continuity-"));
            const nextReferences = [...continuity, ...nextManual].filter((reference, index, all) => all.findIndex((item) => item.url === reference.url) === index);
            const nextPrompt = appendDramaImageReferenceBindings(promptDraft, nextReferences);
            setPromptPreview({ ...current, references: nextReferences });
            setPromptDraft(nextPrompt);
            setPromptOriginal((original) => appendDramaImageReferenceBindings(original, nextReferences));
        }
        setAssetPickerOpen(false);
        message.success(nextManual.length ? `已手动引用 ${nextManual.length} 张资产图` : "已清空手动引用资产图");
    };

    const removePromptReference = (reference: DramaImageReferenceBinding) => {
        const current = promptPreview;
        if (!current || reference.id.startsWith("continuity-")) return;
        const currentManual = shot.framePlan?.manualReferenceImages || current.references.filter((item) => !item.id.startsWith("continuity-"));
        const nextManual = currentManual.filter((item) => item.url !== reference.url);
        const nextReferences = current.references.filter((item) => item.url !== reference.url);
        updateShot(project.id, episodeId, shot.id, {
            framePlan: { ...(shot.framePlan || { start: { source: "independent" as const }, end: { required: false }, frames: beats }), manualReferenceImages: nextManual },
        });
        setManualReferenceDraft(nextManual);
        setPromptPreview({ ...current, references: nextReferences });
        setPromptDraft((draft) => appendDramaImageReferenceBindings(draft, nextReferences));
        setPromptOriginal((original) => appendDramaImageReferenceBindings(original, nextReferences));
        message.success(`已移除引用：${reference.label}`);
    };

    return (
        <div className="mt-3.5 border-t border-border/70 pt-3.5">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                        <div className="shrink-0 text-sm font-semibold">分镜帧</div>
                        <p className="truncate text-xs leading-5 text-muted-foreground">默认 4 帧；每帧对应一个连续动作时间段，最多 9 帧</p>
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
                        const rowBusy = reviewingFrameId === beat.id || submitting === beat.id || frame?.status === "queued" || frame?.status === "running" || frame?.candidateStatus === "queued" || frame?.candidateStatus === "running";
                        const previous = index ? frameById.get(beats[index - 1].id) : undefined;
                        const canGenerate = index === 0 || Boolean(previous?.mediaUrl && previous.status === "success" && previous.continuityStatus !== "needs_review" && previous.continuityStatus !== "stale");
                        const candidates = visibleFrameCandidates(frame);
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
                                        <Button
                                            type="link"
                                            size="small"
                                            className="!h-7 !px-1.5 !text-xs"
                                            onClick={() =>
                                                openPromptPreview({
                                                    title: "帧 " + beat.sequenceIndex + " 图片提示词",
                                                    prompt: plannedFramePrompt(project, episodeId, shot, beat),
                                                    references: plannedFrameReferences(project, episodeId, shot, beat.sequenceIndex, storedFrames),
                                                    frameId: beat.id,
                                                    visibleSubject: dramaFrameVisualSubject(beat.imagePrompt, beat.actionPrompt, shot.description),
                                                    readOnly: false,
                                                })
                                            }
                                        >
                                            查看完整提示词
                                        </Button>
                                        <div className="ml-auto flex items-center gap-1">
                                            {frame?.mediaUrl ? (
                                                <Button
                                                    size="small"
                                                    icon={<ScanSearch className="size-3.5" />}
                                                    loading={reviewingFrameId === beat.id}
                                                    disabled={Boolean(submitting) || generationActive || reviewingFrameId !== ""}
                                                    onClick={() => void inspectFrame(beat)}
                                                >
                                                    检验图片
                                                </Button>
                                            ) : null}
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
                                        静态帧提示词
                                        <Input.TextArea className="mt-1" autoSize={{ minRows: 2, maxRows: 4 }} value={formatPromptFieldLines(beat.imagePrompt, "static")} disabled={rowBusy} onChange={(event) => editBeat(beat, { imagePrompt: event.target.value })} />
                                    </label>
                                    {frame?.mediaUrl && frame.continuityStatus === "needs_review" ? (
                                        <div
                                            className="flex min-w-0 flex-col gap-2.5 rounded-md border border-amber-300/70 bg-amber-50/70 p-2.5 text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700/60 dark:bg-amber-950/25 dark:text-amber-100"
                                            data-drama-frame-acceptance
                                        >
                                            <div className="min-w-0 text-xs leading-5">
                                                <div className="font-medium">当前图片已保留，等待你确认</div>
                                                <p className="break-words text-amber-800 dark:text-amber-200">{frame.error || "图片检验未通过，请查看大图后决定使用或重新生成。"}</p>
                                            </div>
                                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                <Button size="small" type="primary" className="!shrink-0 !whitespace-nowrap" onClick={() => acceptCurrentFrame(beat)}>
                                                    确认使用当前图并继续
                                                </Button>
                                                <Button
                                                    size="small"
                                                    className="!shrink-0 !whitespace-nowrap"
                                                    disabled={Boolean(submitting) || generationActive}
                                                    onClick={() => void generateSequence({ frameIds: [beat.id], label: `帧 ${beat.sequenceIndex} 候选任务` })}
                                                >
                                                    重新生成候选
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}
                                    {candidates.length > 1 ? (
                                        <div className="rounded-md border border-border/70 bg-muted/15 p-2" data-drama-frame-candidates>
                                            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                                                <span className="font-medium text-foreground">候选图片</span>
                                                <span className="text-muted-foreground">选择后才替换当前帧</span>
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                                {candidates.map((candidate) => {
                                                    const current = candidate.mediaUrl === frame?.mediaUrl;
                                                    return (
                                                        <div key={candidate.id} className={`w-28 shrink-0 overflow-hidden rounded-md border bg-background ${current ? "border-primary" : "border-border/70"}`}>
                                                            <Image
                                                                rootClassName="!block"
                                                                className="!aspect-video !w-full !object-cover"
                                                                src={imagePreviewUrl(candidate.mediaUrl, 320)}
                                                                alt={`帧 ${beat.sequenceIndex} 候选`}
                                                                preview={{ mask: "查看", src: imagePreviewUrl(candidate.mediaUrl, 1920) }}
                                                            />
                                                            <div className="space-y-1 p-1.5 text-[10px]">
                                                                <div className={current ? "font-medium text-primary" : "text-muted-foreground"}>{current ? "当前帧" : candidate.continuityStatus === "needs_review" ? "待人工验收" : "候选"}</div>
                                                                {!current ? (
                                                                    <>
                                                                        {candidate.generationPrompt ? (
                                                                            <Button
                                                                                type="link"
                                                                                size="small"
                                                                                className="!h-6 !px-0 !text-[10px]"
                                                                                onClick={() =>
                                                                                    openPromptPreview({
                                                                                        title: `帧 ${beat.sequenceIndex} 候选实际提交提示词`,
                                                                                        prompt: candidate.generationPrompt!,
                                                                                        references: candidate.generationReferences || [],
                                                                                        visibleSubject: dramaFrameVisualSubject(beat.imagePrompt, beat.actionPrompt, shot.description),
                                                                                        readOnly: true,
                                                                                    })
                                                                                }
                                                                            >
                                                                                实际提交提示词
                                                                            </Button>
                                                                        ) : null}
                                                                        <Button type="link" size="small" className="!h-6 !px-0 !text-[10px]" onClick={() => selectFrameCandidate(beat, candidate)}>
                                                                            设为当前帧
                                                                        </Button>
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : null}
                                    {frame?.error && frame.continuityStatus !== "needs_review" ? (
                                        <p role="alert" className="text-xs leading-5 text-destructive">
                                            {frame.error}
                                        </p>
                                    ) : null}
                                    {frame?.candidateError ? (
                                        <p role="alert" className="text-xs leading-5 text-destructive">
                                            新候选生成失败：{frame.candidateError}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                    <p className="text-xs leading-5 text-muted-foreground">系统按帧顺序生成图片；生成完成后可点击“检验图片”核对当前帧与提示词及相邻画面的连续性。单帧生成只创建当前图片任务。</p>
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
                        onPrompt={() =>
                            openPromptPreview({
                                title: "起始帧图片提示词",
                                prompt: plannedLegacyPrompt(project, episodeId, shot, "start"),
                                references: startPromptEvidence?.generationReferences || plannedFrameReferences(project, episodeId, shot, 1, storedFrames),
                                phase: "start",
                                readOnly: false,
                            })
                        }
                    />
                    {frameMode === "first_last" ? (
                        <FrameSlot
                            title="结束帧"
                            urls={endFrames.map((frame) => frame.mediaUrl)}
                            loading={uploading === "end"}
                            disabled={Boolean(submitting) || generationActive}
                            onUpload={() => chooseFile("end")}
                            onRemove={() => removeLegacyFrame("end", project, episodeId, shot, updateShot)}
                            onPrompt={() =>
                                openPromptPreview({
                                    title: "结束帧图片提示词",
                                    prompt: plannedLegacyPrompt(project, episodeId, shot, "end"),
                                    references: endPromptEvidence?.generationReferences || plannedFrameReferences(project, episodeId, shot, "end", storedFrames),
                                    phase: "end",
                                    readOnly: false,
                                })
                            }
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
            <Modal
                open={Boolean(promptPreview)}
                title={promptPreview?.title}
                footer={null}
                onCancel={() => {
                    setReferencePreview(null);
                    setPromptPreview(null);
                }}
                centered
                zIndex={1100}
                width="min(760px, calc(100vw - 24px))"
                styles={{ container: { display: "flex", maxHeight: "calc(100dvh - 24px)", flexDirection: "column" }, body: { minHeight: 0, overflowY: "auto" } }}
            >
                {promptPreview?.frameId ? (
                    <div className="rounded-md border border-primary/40 bg-primary/[0.04] p-3">
                        <div className="text-xs font-semibold text-primary">本帧可见画面</div>
                        <p className="mt-1 text-sm leading-6 text-foreground">{promptPreview.visibleSubject || "请补充当前帧的可见主体状态"}</p>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">这里只描述当前冻结瞬间的主体、姿态、道具或环境变化；对白、旁白和运镜请放在对应的声音或视频字段。</p>
                    </div>
                ) : null}
                <div className="mt-3 rounded-md border border-border/70 bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-foreground">帧图片提示词</span>
                        <span className="text-muted-foreground">{promptPreview?.readOnly ? "实际提交给供应商的完整提示词（已留档）" : `Seedance 2.0 静态帧 · 已绑定 ${promptPreview?.references.length || 0} 张图片`}</span>
                    </div>
                    {promptPreview?.references.length ? (
                        <div className="mb-2 grid grid-cols-3 gap-2" data-drama-prompt-references aria-label="提示词中的参考图片">
                            {promptPreview.references.map((reference, index) => (
                                <div key={`${reference.id}:${index}`} className="min-w-0 overflow-hidden rounded border border-border/70 bg-muted/15">
                                    <button
                                        type="button"
                                        className="group block w-full text-left transition hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
                                        onClick={() => setReferencePreview({ reference, index })}
                                        aria-label={`查看提示词引用图片 ${index + 1}：${reference.label}`}
                                    >
                                        <div className="relative aspect-video overflow-hidden bg-muted">
                                            <Image preview={false} rootClassName="!size-full" className="!size-full !object-cover transition group-hover:scale-[1.02]" src={imagePreviewUrl(reference.url, 320)} alt={`图片${index + 1} ${reference.label}`} />
                                            <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">@图片{index + 1}</span>
                                            <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded bg-black/70 text-white" aria-hidden="true">
                                                <Maximize2 className="size-3" />
                                            </span>
                                        </div>
                                        <div className="truncate px-1.5 py-1 text-[10px] font-medium text-foreground">{reference.label}</div>
                                    </button>
                                    {!promptPreview.readOnly ? (
                                        <div className="flex items-center justify-between gap-1 border-t border-border/60 px-1.5 py-1">
                                            <span className="truncate text-[10px] text-muted-foreground">{reference.id.startsWith("continuity-") ? "连续性帧 · 必保留" : "当前已引用"}</span>
                                            {!reference.id.startsWith("continuity-") ? (
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    danger
                                                    icon={<Trash2 className="size-3" />}
                                                    className="!h-6 shrink-0 !px-1.5 !text-[10px]"
                                                    onClick={() => removePromptReference(reference)}
                                                    aria-label={`取消引用 ${reference.label}`}
                                                >
                                                    取消引用
                                                </Button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {!promptPreview?.readOnly ? (
                        <div className="mb-2 flex items-center justify-between gap-2 rounded border border-dashed border-primary/35 bg-primary/[0.03] px-2.5 py-2">
                            <span className="text-xs text-muted-foreground">Agent 未涉及的资产可在这里手动补充或移除</span>
                            <Button size="small" icon={<ImagePlus className="size-3.5" />} onClick={openAssetPicker}>
                                手动引用资产图
                            </Button>
                        </div>
                    ) : null}
                    <Input.TextArea value={promptDraft} readOnly={promptPreview?.readOnly} onChange={(event) => setPromptDraft(event.target.value)} autoSize={{ minRows: 8, maxRows: 18 }} className="text-xs leading-5" />
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button onClick={() => setPromptPreview(null)}>{promptPreview?.readOnly ? "关闭" : "取消"}</Button>
                    {!promptPreview?.readOnly ? (
                        <>
                            <Button icon={<RotateCcw className="size-3.5" />} disabled={promptDraft === promptOriginal || optimizingPrompt} onClick={() => setPromptDraft(promptOriginal)}>
                                还原上次
                            </Button>
                            <Button icon={<Sparkles className="size-3.5" />} loading={optimizingPrompt} disabled={!promptDraft.trim()} onClick={() => void optimizePromptPreview()}>
                                提示词优化
                            </Button>
                            <Button type="primary" icon={<Save className="size-3.5" />} loading={savingPrompt} disabled={!promptDraft.trim() || optimizingPrompt || savingPrompt} onClick={() => void savePromptPreview()}>
                                保存提示词
                            </Button>
                        </>
                    ) : null}
                </div>
            </Modal>
            <Modal
                open={assetPickerOpen}
                title="手动引用资产图"
                centered
                zIndex={1100}
                width="min(760px, calc(100vw - 24px))"
                okText="保存引用"
                cancelText="取消"
                onCancel={() => setAssetPickerOpen(false)}
                onOk={saveManualReferences}
                styles={{ body: { maxHeight: "min(62vh, 520px)", overflowY: "auto" } }}
            >
                <p className="mb-3 text-xs leading-5 text-muted-foreground">勾选需要随本镜头图片提示词提交的资产图，当前已勾选 {manualReferenceDraft.length} 张。取消勾选即可移除 Agent 或手动引用的资产图；系统连续性帧仍会自动保留。</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {availableManualReferenceImages(project).map((reference) => {
                        const checked = manualReferenceDraft.some((item) => item.id === reference.id);
                        return (
                            <button
                                key={reference.id}
                                type="button"
                                className={`group min-w-0 overflow-hidden rounded-md border text-left transition ${checked ? "border-primary ring-1 ring-primary/35" : "border-border/70 hover:border-primary/50"}`}
                                onClick={() => setManualReferenceDraft((current) => (checked ? current.filter((item) => item.id !== reference.id) : [...current, reference]))}
                                aria-pressed={checked}
                            >
                                <div className="relative aspect-video overflow-hidden bg-muted">
                                    <Image preview={false} rootClassName="!size-full" className="!size-full !object-cover transition group-hover:scale-[1.02]" src={imagePreviewUrl(reference.url, 480)} alt={reference.label} />
                                    <span className={`absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full ${checked ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"}`}>
                                        {checked ? <Check className="size-3.5" /> : <span className="size-2.5 rounded-sm border border-white/80" aria-hidden />}
                                    </span>
                                </div>
                                <div className="truncate px-2 py-1.5 text-xs font-medium text-foreground">{reference.label}</div>
                            </button>
                        );
                    })}
                </div>
                {!availableManualReferenceImages(project).length ? <p className="py-8 text-center text-sm text-muted-foreground">当前项目暂无可用资产图</p> : null}
            </Modal>
            <Modal
                open={Boolean(referencePreview)}
                title={referencePreview ? `图片 ${referencePreview.index + 1} 详情` : "图片详情"}
                footer={null}
                centered
                zIndex={1200}
                onCancel={() => setReferencePreview(null)}
                width="min(720px, calc(100vw - 24px))"
                styles={{ container: { maxHeight: "calc(100dvh - 24px)" }, body: { overflowY: "auto" } }}
            >
                {referencePreview ? (
                    <div data-drama-reference-image-detail className="space-y-3">
                        <div className="flex max-h-[65vh] min-h-48 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/25 p-2">
                            <Image
                                className="!max-h-[62vh] !w-auto !max-w-full !object-contain"
                                src={imagePreviewUrl(referencePreview.reference.url, 1600)}
                                alt={`图片 ${referencePreview.index + 1} ${referencePreview.reference.label}`}
                                preview={{ src: referencePreview.reference.url, mask: "查看原图" }}
                            />
                        </div>
                        <div className="rounded-md border border-border/70 bg-muted/15 p-3 text-xs leading-5">
                            <div className="font-mono font-medium text-foreground">@图片{referencePreview.index + 1}</div>
                            <div className="mt-1 font-medium text-foreground">{referencePreview.reference.label}</div>
                            <div className="text-muted-foreground">绑定规则：{referencePreview.reference.binding}</div>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </div>
    );
}

function compactShotSnapshot(shot: DramaShot | undefined) {
    if (!shot) return undefined;
    return JSON.parse(JSON.stringify(shot, (_key, value) => (typeof value === "string" && /^(?:data|blob):/i.test(value) ? undefined : value))) as DramaShot;
}

function FrameSlot({ title, urls, loading, disabled, onUpload, onRemove, onPrompt }: { title: string; urls: string[]; loading: boolean; disabled: boolean; onUpload: () => void; onRemove: () => void; onPrompt: () => void }) {
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
                    <Button type="link" size="small" className="!h-7 !px-1.5 !text-xs" onClick={onPrompt}>
                        提示词
                    </Button>
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
    const state = frame?.candidateStatus || (frame?.continuityStatus === "needs_review" ? "needs_review" : frame?.status) || "idle";
    const labels: Record<string, string> = {
        idle: "待生成",
        queued: frame?.mediaUrl ? "候选排队中" : "排队中",
        running: frame?.mediaUrl ? "候选生成中" : "生成中",
        success: frame?.continuityStatus === "needs_review" ? "连续性需调整" : frame?.continuityStatus === "pending" ? "待检验" : "已完成",
        stale: "已失效",
        needs_review: "连续性需调整",
        error: frame?.mediaUrl ? "候选失败" : "失败",
        cancelled: "已取消",
    };
    const colors: Record<string, string> = { queued: "processing", running: "processing", success: "success", stale: "warning", needs_review: "warning", error: "error", cancelled: "default", idle: "default" };
    return <Tag color={colors[state]}>{labels[state] || state}</Tag>;
}

function frameBeats(shot: DramaShot): DramaFrameBeat[] {
    return shot.framePlan?.frames?.length ? [...shot.framePlan.frames].sort((left, right) => left.sequenceIndex - right.sequenceIndex) : [];
}

function emptyStoryboardFrame(beat: DramaFrameBeat): DramaStoryboardFrame {
    return { id: beat.id, sequenceIndex: beat.sequenceIndex, source: "generated", status: "idle" };
}

function staleFrame(frame: DramaStoryboardFrame): DramaStoryboardFrame {
    return {
        ...frame,
        status: "stale",
        taskId: undefined,
        error: undefined,
        inputHash: undefined,
        continuityStatus: "stale",
        continuityEvidenceId: undefined,
        generationPrompt: undefined,
        generationReferences: undefined,
        candidateStatus: undefined,
        candidateTaskId: undefined,
        candidateError: undefined,
    };
}

function visibleFrameCandidates(frame?: DramaStoryboardFrame): DramaStoryboardFrameCandidate[] {
    const candidates = [...(frame?.candidates || [])];
    if (frame?.mediaUrl && !candidates.some((candidate) => candidate.mediaUrl === frame.mediaUrl))
        candidates.unshift({
            id: `current-${frame.taskId || frame.id}`,
            mediaUrl: frame.mediaUrl,
            remoteUrl: frame.remoteUrl,
            width: frame.width,
            height: frame.height,
            source: frame.source,
            taskId: frame.taskId,
            createdAt: "",
            continuityStatus: frame.continuityStatus === "stale" ? undefined : frame.continuityStatus,
            continuityEvidenceId: frame.continuityEvidenceId,
            error: frame.error,
            generationPrompt: frame.generationPrompt,
            generationReferences: frame.generationReferences,
        });
    return candidates;
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
                  storyboardPrompt: undefined,
              }
            : {
                  frameEvidence: supersedeFrameEvidenceByRole(shot.frameEvidence, "storyboard_end", "用户删除了分镜尾帧"),
                  storyboardEndStatus: "idle" as const,
                  storyboardEndImageUrl: undefined,
                  storyboardEndImageRemoteUrl: undefined,
                  storyboardEndImageUrls: undefined,
                  storyboardEndPrompt: undefined,
              }),
        ...clearedGeneratedMedia,
    });
}

function formatSecond(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function plannedFramePrompt(project: DramaProject, episodeId: string, shot: DramaShot, beat: DramaFrameBeat) {
    const episode = project.episodes.find((item) => item.id === episodeId);
    if (!episode) return beat.imagePrompt;
    return compileDramaFrameSupplierPrompt(project, episode, shot, beat);
}

function plannedLegacyPrompt(project: DramaProject, episodeId: string, shot: DramaShot, kind: "start" | "end") {
    const episode = project.episodes.find((item) => item.id === episodeId);
    if (!episode) return [shot.imagePrompt, kind === "start" ? shot.startFramePrompt : shot.endFramePrompt].filter(Boolean).join("\n");
    return compileDramaFrameSupplierPrompt(project, episode, shot, undefined, kind);
}

function latestPromptEvidence(shot: DramaShot, role: "storyboard_start" | "storyboard_end") {
    return [...(shot.frameEvidence || [])].reverse().find((frame) => frame.role === role && frame.generationPrompt);
}

function plannedFrameReferences(project: DramaProject, episodeId: string, shot: DramaShot, frame: number | "end", frames: DramaStoryboardFrame[]): DramaImageReferenceBinding[] {
    const episode = project.episodes.find((item) => item.id === episodeId);
    if (!episode) return [];
    const references: DramaImageReferenceBinding[] = [];
    if (frame === "end") {
        const start = frames.find((item) => item.sequenceIndex === 1 && item.mediaUrl && item.status === "success");
        if (start?.mediaUrl)
            references.push({
                id: "continuity-start",
                label: "本镜头已生成起始帧",
                binding: "作为结束帧连续性起点，保持人物姿态、服装、道具状态、场景空间、构图、光向和轴线",
                url: start.mediaUrl,
                remoteUrl: start.remoteUrl,
                width: start.width,
                height: start.height,
            });
    } else if (frame > 1) {
        const previous = frames.find((item) => item.sequenceIndex === frame - 1 && item.mediaUrl && item.status === "success");
        if (previous?.mediaUrl)
            references.push({
                id: "continuity-previous",
                label: "上一分镜帧 P" + String(shot.order).padStart(2, "0") + "-F" + String(frame - 1).padStart(2, "0"),
                binding: "作为当前帧连续性起点，保持当前可见状态连续",
                url: previous.mediaUrl,
                remoteUrl: previous.remoteUrl,
                width: previous.width,
                height: previous.height,
            });
    } else {
        const incoming = episode.continuityEdges?.find((edge) => edge.toShotId === shot.id && edge.inheritActualEndFrame);
        const previous = incoming ? episode.shots.find((item) => item.id === incoming.fromShotId) : undefined;
        const tail = previous ? continuityStartEvidence(previous) : undefined;
        if (tail?.mediaUrl && previous)
            references.push({ id: "continuity-tail", label: "上一镜「" + previous.title + "」已验收实际尾帧", binding: "作为当前帧唯一动作起点，锁定人物姿态、服装、道具状态、场景空间、构图、光向和轴线", url: tail.mediaUrl, remoteUrl: tail.remoteUrl });
    }
    const beat = frame === "end" ? undefined : frameBeats(shot).find((item) => item.sequenceIndex === frame);
    const frameScene = beat ? resolveDramaFrameScene(project, shot, beat) : project.scenes.find((item) => item.id === shot.sceneId);
    const available = [frameScene?.id, ...shot.characterIds, ...shot.propIds, ...shot.clueIds, ...(shot.sourceAssetIds || [])].filter((id): id is string => Boolean(id));
    if (shot.framePlan?.manualReferenceImages) {
        const manual = shot.framePlan.manualReferenceImages;
        return [...references, ...manual].filter((reference, index, all) => all.findIndex((item) => item.url === reference.url) === index);
    }
    const preferred = (shot.framePlan?.referenceManifest || []).flatMap((item) => (item.assetId && available.includes(item.assetId) ? [item.assetId] : []));
    for (const id of Array.from(new Set([...preferred, ...available]))) {
        const character = project.characters.find((item) => item.id === id);
        const scene = project.scenes.find((item) => item.id === id);
        const prop = project.props.find((item) => item.id === id);
        const clue = project.clues.find((item) => item.id === id);
        const source = project.sourceAssets?.find((item) => item.id === id && item.type === "image");
        const asset = character || scene || prop || clue;
        const reference = asset ? approvedAssetReference(asset) : undefined;
        const url = reference?.url || source?.serverUrl || source?.remoteUrl;
        if (!url) continue;
        const category = character ? "角色" : scene ? "场景" : prop ? "道具" : clue ? "线索" : "来源素材";
        const name = asset?.name || source?.title || "未命名图片";
        references.push({
            id,
            label: category + "固定资产「" + name + "」",
            binding: category === "角色" ? "锁定身份、脸部、发型、服装和识别特征" : category === "场景" ? "锁定空间拓扑、建筑结构、材质、陈设和主光方向" : "锁定造型、材质、色彩、位置和可识别细节",
            url,
            remoteUrl: reference?.remoteUrl || source?.remoteUrl,
            width: reference?.width || source?.width,
            height: reference?.height || source?.height,
        });
    }
    return references.filter((reference, index, all) => all.findIndex((item) => item.url === reference.url) === index);
}

function availableManualReferenceImages(project: DramaProject): DramaImageReferenceBinding[] {
    const output: DramaImageReferenceBinding[] = [];
    const addAsset = (asset: DramaProject["characters"][number], category: string, binding: string) => {
        for (const reference of dramaAssetReferences(asset)) {
            if (!reference.url) continue;
            output.push({
                id: `${asset.id}:${reference.id}`,
                label: `${category}「${asset.name}」${reference.label ? ` · ${reference.label}` : ""}`,
                binding,
                url: reference.url,
                remoteUrl: reference.remoteUrl,
                width: reference.width,
                height: reference.height,
            });
        }
    };
    project.characters.forEach((asset) => addAsset(asset, "角色", "锁定身份、脸部、发型、服装和识别特征"));
    project.scenes.forEach((asset) => addAsset(asset, "场景", "锁定空间拓扑、建筑结构、材质、陈设和主光方向"));
    project.props.forEach((asset) => addAsset(asset, "道具", "锁定造型、材质、色彩、位置和可识别细节"));
    project.clues.forEach((asset) => addAsset(asset, "线索", "锁定外观、材质、位置和可识别细节"));
    for (const source of project.sourceAssets || []) {
        const url = source.serverUrl || source.remoteUrl;
        if (source.type === "image" && url)
            output.push({
                id: `${source.id}:source`,
                label: `来源素材「${source.title || "未命名图片"}」`,
                binding: "仅用于当前提示词声明的视觉信息，不覆盖角色或场景固定资产",
                url,
                remoteUrl: source.remoteUrl,
                width: source.width,
                height: source.height,
            });
    }
    return output.filter((reference, index, all) => all.findIndex((item) => item.id === reference.id || item.url === reference.url) === index);
}

const clearedGeneratedMedia = { generationStatus: "idle" as const, generationTaskId: undefined, generationError: undefined, videoUrl: undefined, audioStatus: "idle" as const, audioTaskId: undefined, audioError: undefined, audioUrl: undefined };
