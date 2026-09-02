"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { App, Button, Checkbox, Dropdown, Input, Popconfirm, Progress, Select, Tag, type MenuProps } from "antd";
import { ArrowRight, Captions, ChevronDown, ChevronUp, CircleAlert, CircleCheck, CircleDashed, Download, Film, GitBranch, LoaderCircle, Pause, Play, RefreshCw, Save, ScanSearch, Send, Sparkles, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { mediaDownloadFileName } from "@/lib/media-file";
import { imagePreviewUrl, originalMediaDownloadUrl } from "@/lib/media-image-url";
import {
    createDramaProductionRun,
    ensureDramaEpisodeCanvas,
    exportDramaJianyingDraft,
    generateDramaVideoPrompt,
    getDramaProjectCosts,
    getLatestDramaProductionRun,
    preflightDramaGeneration,
    reviewDramaEpisode,
    updateDramaProductionRun,
    updateDramaShotPrompt,
} from "@/services/api/drama-projects";
import { resolveModelRequestConfig, useEffectiveConfig } from "@/stores/use-config-store";
import { appendDramaImageReferenceBindings, compileDramaShotExecutionPrompts, sanitizeDramaSupplierText } from "@/lib/drama-prompt-compiler";
import { formatPromptFieldLines } from "@/lib/drama-frame-sequence";
import { approvedAssetReference } from "@/lib/drama-asset-baseline";
import { dramaReferenceImageBudget } from "@/lib/drama-production-plan";
import { activeFrameEvidence, continuityStartEvidence } from "@/lib/drama-continuity-policy";
import { dramaVideoPromptRunKey, useDramaStore } from "../stores/use-drama-store";
import { buildSrt } from "../subtitle";
import type { DramaCostSummary, DramaEpisode, DramaProductionPreflight, DramaProductionRun, DramaProject, DramaRenderTask, DramaShot } from "../types";
import { cancelDramaAudioTask } from "./use-drama-audio-queue";
import { AudioTag, DramaStageHeader, GenerationTag, StoryboardTag } from "./drama-editor-elements";
import { summarizeDramaGeneration } from "./drama-generation-readiness";
import { DramaMediaPreviewModal, DramaMediaThumbnail, type DramaPreviewMedia } from "./drama-media-preview";
import { DramaJianyingModal, DramaSubtitleModal } from "./drama-project-modals";
import type { DramaProjectStage } from "./drama-project-sections";
import { dramaShotVideoMode, estimateEpisodePoints } from "./drama-shot-generation-utils";
import { markDramaCanvasSynced } from "../../canvas/[id]/canvas-drama-navigation";

const actionButtonClass = "!h-9 !px-3 [&>span:last-child]:whitespace-nowrap";

export function DramaGenerationPanel({
    project,
    episode,
    onStageChange,
    onOpenAssets,
    onOpenAgentForShot,
    onCompleteShotReview,
    onAutoFixPreflight,
}: {
    project: DramaProject;
    episode: DramaEpisode;
    onStageChange: (stage: DramaProjectStage) => void;
    onOpenAssets: () => void;
    onOpenAgentForShot: (shot: DramaShot) => void;
    onCompleteShotReview: (shotId: string) => Promise<boolean>;
    onAutoFixPreflight: (issues: DramaProductionPreflight["issues"]) => Promise<boolean>;
}) {
    const { message, modal } = App.useApp();
    const router = useRouter();
    const config = useEffectiveConfig();
    const imageRequestConfig = resolveModelRequestConfig(config, config.imageModel || config.model);
    const updateEpisode = useDramaStore((state) => state.updateEpisode);
    const updateShot = useDramaStore((state) => state.updateShot);
    const loadProject = useDramaStore((state) => state.loadProject);
    const saveProjectNow = useDramaStore((state) => state.saveProjectNow);
    const replaceProject = useDramaStore((state) => state.replaceProject);
    const queueAudio = useDramaStore((state) => state.queueAudio);
    const [costSummary, setCostSummary] = useState<DramaCostSummary | null>(null);
    const [renderReady, setRenderReady] = useState<boolean | null>(null);
    const [reviewingVisuals, setReviewingVisuals] = useState(false);
    const [productionRun, setProductionRun] = useState<DramaProductionRun | null>(null);
    const [preflight, setPreflight] = useState<DramaProductionPreflight | null>(null);
    const [creatingRun, setCreatingRun] = useState(false);
    const [visualRun, setVisualRun] = useState<DramaProductionRun | null>(null);
    const [visualPlanning, setVisualPlanning] = useState(false);
    const [jianyingOpen, setJianyingOpen] = useState(false);
    const [jianyingPath, setJianyingPath] = useState("");
    const [jianyingVersion, setJianyingVersion] = useState<"5" | "6">("6");
    const [jianyingExporting, setJianyingExporting] = useState(false);
    const [subtitleOpen, setSubtitleOpen] = useState(false);
    const [previewMedia, setPreviewMedia] = useState<DramaPreviewMedia>();
    const [preflighting, setPreflighting] = useState(false);
    const [autoFixing, setAutoFixing] = useState(false);
    const visualSyncVersion = useRef("");
    const productionSyncVersion = useRef("");
    const readiness = useMemo(() => summarizeDramaGeneration(project, episode), [episode, project]);
    const productionPlan = project.productionBible?.productionPlan;
    const renderTask = episode.renderTask || null;
    const audioReady = Boolean(config.audioModel.trim());
    const assetCount = project.characters.length + project.scenes.length + project.props.length + project.clues.length;
    const audioCandidateShotIds = episode.shots.filter((shot) => shot.videoUrl && (shot.subtitle || shot.dialogue).trim() && shot.audioStatus !== "success").map((shot) => shot.id);
    const openEpisodeCanvas = async () => {
        try {
            if (episode.canvasProjectId) {
                router.push(`/canvas/${encodeURIComponent(episode.canvasProjectId)}`);
                return;
            }
            const canvas = await ensureDramaEpisodeCanvas(project.id, episode.id);
            updateEpisode(project.id, episode.id, { canvasProjectId: canvas.canvasProjectId });
            markDramaCanvasSynced(canvas.canvasProjectId);
            router.push(canvas.href);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "本集画布打开失败");
        }
    };
    const prefetchEpisodeCanvas = () => {
        if (episode.canvasProjectId) router.prefetch(`/canvas/${encodeURIComponent(episode.canvasProjectId)}`);
    };

    useEffect(() => {
        let active = true;
        setRenderReady(null);
        void fetch("/api/drama/render-capability", { cache: "no-store" })
            .then((response) => response.json())
            .then((payload: { data?: { available?: boolean } }) => active && setRenderReady(Boolean(payload.data?.available)))
            .catch(() => active && setRenderReady(false));
        return () => {
            active = false;
        };
    }, [episode.id, project.id]);

    useEffect(() => {
        let active = true;
        let loading = false;
        const load = async () => {
            if (loading) return;
            loading = true;
            try {
                const { run } = await getLatestDramaProductionRun(project.id, episode.id, "visual");
                if (!active || run?.scope !== "visual") return;
                setVisualRun(run);
                const hasResolvedShotStep = run.steps.some((step) => step.type !== "asset_anchor" && step.taskId && ["success", "failed", "cancelled", "needs_review"].includes(step.status));
                if (hasResolvedShotStep && run.updatedAt !== visualSyncVersion.current) {
                    visualSyncVersion.current = run.updatedAt;
                    void loadProject(project.id, true).catch(() => undefined);
                }
            } catch {
                // A later pass will surface the persisted task state.
            } finally {
                loading = false;
            }
        };
        load();
        const timer = window.setInterval(load, visualRun?.confirmedAt && ["running", "ready"].includes(visualRun.status) ? 2500 : 10000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [episode.id, project.id, visualRun?.confirmedAt, visualRun?.status, loadProject]);

    useEffect(() => {
        let active = true;
        let loading = false;
        const load = async () => {
            if (loading) return;
            loading = true;
            try {
                const data = await getLatestDramaProductionRun(project.id, episode.id);
                if (!active) return;
                setProductionRun(data.run);
                setPreflight(data.preflight);
                if (data.run?.updatedAt && data.run.updatedAt !== productionSyncVersion.current) {
                    productionSyncVersion.current = data.run.updatedAt;
                    void loadProject(project.id, true).catch(() => undefined);
                }
            } catch {
                if (!active) return;
                setProductionRun(null);
                setPreflight(null);
            } finally {
                loading = false;
            }
        };
        load();
        const timer = window.setInterval(load, ["running", "ready", "needs_review"].includes(productionRun?.status || "") ? 2500 : 10000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [episode.id, project.id, productionRun?.status, loadProject]);

    useEffect(() => {
        let active = true;
        const load = () =>
            void getDramaProjectCosts(project.id)
                .then((value) => active && setCostSummary(value))
                .catch(() => active && setCostSummary(null));
        load();
        const timer = window.setInterval(load, 5000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [project.id]);

    useEffect(() => {
        if (!renderTask?.id || !["pending", "running"].includes(renderTask.status)) return;
        let active = true;
        const load = async () => {
            const response = await fetch(`/api/drama/render/${encodeURIComponent(renderTask.id)}`, { cache: "no-store" });
            const payload = (await response.json().catch(() => ({}))) as { data?: DramaRenderTask };
            if (active && response.ok && payload.data) updateEpisode(project.id, episode.id, { renderTask: payload.data });
        };
        void load();
        const timer = window.setInterval(() => void load(), 2500);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [episode.id, project.id, renderTask?.id, renderTask?.status, updateEpisode]);

    const cancelShot = async (shot: DramaShot) => {
        const requests = [
            shot.storyboardTaskId ? fetch(`/api/image-tasks/${encodeURIComponent(shot.storyboardTaskId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) }) : undefined,
            shot.storyboardEndTaskId ? fetch(`/api/image-tasks/${encodeURIComponent(shot.storyboardEndTaskId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) }) : undefined,
            shot.generationTaskId ? fetch(`/api/video-tasks/${encodeURIComponent(shot.generationTaskId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) }) : undefined,
        ].filter(Boolean) as Promise<Response>[];
        await Promise.all(requests.map((request) => request.catch(() => undefined)));
        updateShot(project.id, episode.id, shot.id, shot.storyboardTaskId || shot.storyboardEndTaskId ? { storyboardStatus: "cancelled", storyboardEndStatus: "cancelled", generationStatus: "cancelled" } : { generationStatus: "cancelled" });
    };

    const downloadSubtitles = () => {
        const content = buildSrt(episode.shots);
        if (!content) return message.warning("请先填写至少一条对白或字幕");
        const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: "application/x-subrip;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${project.title.trim().replace(/[\\/:*?"<>|]/g, "-") || "短剧字幕"}.srt`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        message.success("SRT 字幕已导出");
    };

    const exportJianying = async () => {
        if (!jianyingPath.trim()) return message.warning("请填写剪映草稿目录");
        setJianyingExporting(true);
        try {
            const result = await exportDramaJianyingDraft(project.id, { episodeId: episode.id, draftPath: jianyingPath.trim(), version: jianyingVersion });
            const url = URL.createObjectURL(result.blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = result.fileName;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setJianyingOpen(false);
            message.success("剪映草稿已导出");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "剪映草稿导出失败");
        } finally {
            setJianyingExporting(false);
        }
    };

    const createRender = async () => {
        try {
            const response = await fetch("/api/drama/render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: project.id,
                    conversationId: project.creativeConversationId,
                    title: project.title,
                    ratio: project.ratio,
                    shots: episode.shots.map((shot) => ({ videoUrl: shot.videoUrl, audioMode: shot.audioMode || "source", audioUrl: shot.audioUrl, subtitle: shot.subtitle || shot.dialogue, duration: shot.duration })),
                }),
            });
            const payload = (await response.json().catch(() => ({}))) as { data?: DramaRenderTask; msg?: string };
            if (!response.ok || !payload.data) throw new Error(payload.msg || "整集合成任务创建失败");
            updateEpisode(project.id, episode.id, { renderTask: payload.data });
            message.success("整集合成任务已创建");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "整集合成任务创建失败");
        }
    };

    const cancelRender = async () => {
        if (!renderTask?.id) return;
        try {
            const response = await fetch(`/api/drama/render/${encodeURIComponent(renderTask.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
            if (!response.ok) throw new Error("整集合成取消失败");
            updateEpisode(project.id, episode.id, { renderTask: { ...renderTask, status: "cancelled" } });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "整集合成取消失败");
        }
    };

    const reviewVisuals = async () => {
        if (!episode.shots.some((shot) => activeFrameEvidence(shot, "storyboard_start").length || shot.storyboardFrames?.some((frame) => frame.mediaUrl && frame.status === "success"))) return message.warning("请先生成至少一张分镜图");
        setReviewingVisuals(true);
        try {
            const review = await reviewDramaEpisode(project, episode);
            updateEpisode(project.id, episode.id, { visualReview: review });
            const retryShotIds = new Set(review.retryTaskIds);
            for (const shot of episode.shots)
                if (shot.frameEvidence?.some((frame) => frame.role === "actual_end" && frame.validity === "candidate"))
                    updateShot(project.id, episode.id, shot.id, {
                        continuityStatus: retryShotIds.has(shot.id) ? "blocked" : "needs_review",
                        continuityError: retryShotIds.has(shot.id) ? review.issues.find((issue) => issue.taskId === shot.id)?.message : "AI 复盘仅供参考，请人工验收实际尾帧后再解锁下一镜。",
                    });
            if (review.status === "passed") message.success("视觉复盘通过");
            else if (review.status === "needs_revision") message.warning("视觉复盘发现需要调整的镜头");
            else message.info(review.summary);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "视觉复盘失败");
        } finally {
            setReviewingVisuals(false);
        }
    };

    const lockProduction = async (shotIds: string[], check: DramaProductionPreflight, referenceSelections: Record<string, string[]>) => {
        for (const [shotId, prompts] of Object.entries(check.revisedPrompts || {})) updateShot(project.id, episode.id, shotId, { executionVideoPrompt: prompts.videoPrompt, executionImagePrompt: prompts.imagePrompt });
        setCreatingRun(true);
        try {
            // Flush the editable episode plan (including resolution) before locking the run.
            await saveProjectNow(project.id);
            const run = await createDramaProductionRun(project.id, episode.id, undefined, check, { referenceSelections });
            setProductionRun(run);
            await loadProject(project.id, true);
            message.success("生产运行已锁定，将按逐帧锚点、视频分段、拼接和连续性 QC 顺序执行");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "生产计划创建失败");
        } finally {
            setCreatingRun(false);
        }
    };

    const generateVideoPrompt = async (shot: DramaShot) => {
        const frames = (shot.storyboardFrames || []).filter((frame) => frame.mediaUrl && frame.status === "success" && frame.continuityStatus !== "stale").sort((left, right) => left.sequenceIndex - right.sequenceIndex);
        const start = activeFrameEvidence(shot, "storyboard_start")[0];
        const end = activeFrameEvidence(shot, "storyboard_end")[0];
        if (shot.storyboardFrameMode === "all_frames" && (frames.length < (shot.framePlan?.frames.length || 2) || frames.some((frame, index) => frame.sequenceIndex !== index + 1))) return message.warning("请先按开始到结束顺序生成并验收全部顺序帧");
        if (shot.storyboardFrameMode === "first_last" && (!start || !end)) return message.warning("请先生成并验收本镜首帧和尾帧");
        if (shot.storyboardFrameMode !== "all_frames" && shot.storyboardFrameMode !== "first_last" && !frames.length && !start) return message.warning("请先生成并验收本镜起始帧");
        const incoming = episode.continuityEdges?.find((edge) => edge.toShotId === shot.id && edge.inheritActualEndFrame);
        const previous = incoming ? episode.shots.find((item) => item.id === incoming.fromShotId) : undefined;
        const tail = previous ? continuityStartEvidence(previous) : undefined;
        const referenceMaterials = [
            ...(tail ? [{ role: "first_frame", purpose: "上一镜当前视频版本的已人工验收实际尾帧", url: tail.mediaUrl }] : []),
            ...(shot.storyboardFrameMode === "first_last"
                ? [
                      start ? { role: tail ? "reference" : "first_frame", purpose: tail ? "本镜已验收首帧构图参考（供应商首帧由上一镜尾帧承担）" : "本镜已验收首帧", url: start.mediaUrl } : undefined,
                      end ? { role: "last_frame", purpose: "本镜已验收尾帧", url: end.mediaUrl } : undefined,
                  ].filter(Boolean)
                : frames.map((frame) => ({
                      role: "keyframe",
                      purpose: `顺序帧 ${frame.sequenceIndex}（${frame.sequenceIndex === 1 ? "开始" : frame.sequenceIndex === frames.length ? "结束" : "中间"}）`,
                      sequenceIndex: frame.sequenceIndex,
                      url: frame.mediaUrl!,
                  }))),
            ...shotReferenceAssets(project, shot).map((asset) => ({ role: "asset_anchor", purpose: asset.label, url: asset.url })),
        ];
        try {
            const result = await generateDramaVideoPrompt({ project, episode, shot, referenceMaterials, requestId: "drama-video-prompt:" + project.id + ":" + episode.id + ":" + shot.id + ":" + crypto.randomUUID() });
            const generated = result.shots.find((item) => item.shotId === shot.id)?.videoPrompt;
            if (!generated) throw new Error("Agent 未返回当前镜头的视频提示词");
            const saved = await updateDramaShotPrompt(project.id, episode.id, shot.id, sanitizeDramaSupplierText(generated, project));
            replaceProject(saved);
            message.success("Agent 视频提示词已生成并保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "Agent 视频提示词生成失败");
        }
    };

    const showPromptPreview = (shotIds: string[], check: DramaProductionPreflight) => {
        const selectedShots = episode.shots.filter((shot) => shotIds.includes(shot.id));
        const promptRows = selectedShots.map((shot) => ({
            shot,
            references: previewVideoReferenceBindings(project, episode, shot),
            basePrompt: compileDramaShotExecutionPrompts(project, episode, shot).videoPrompt,
        }));
        const selectionState = {
            selections: Object.fromEntries(promptRows.map((row) => [row.shot.id, row.references.map((reference) => reference.id)])),
            invalid: promptRows.some((row) => row.references.length > dramaReferenceImageBudget(row.shot.duration)),
        };
        modal.confirm({
            title: `确认生成 ${selectedShots.length} 个镜头`,
            width: 760,
            content: <ProductionPromptPreview project={project} rows={promptRows} onChange={(value) => Object.assign(selectionState, value)} />,
            okText: "确认生成",
            cancelText: "返回修改",
            onOk: () => {
                if (selectionState.invalid) {
                    message.error("仍有镜头的参考图超过供应商上限，请先取消部分中间帧");
                    return Promise.reject();
                }
                return lockProduction(shotIds, check, selectionState.selections);
            },
        });
    };

    const startProduction = async (shotIds: string[]) => {
        if (preflighting || creatingRun) return;
        setPreflighting(true);
        try {
            const check = await preflightDramaGeneration(project.id, episode.id, shotIds, `drama-preflight:${project.id}:${episode.id}:${shotIds.join(",")}:${project.updatedAt}`);
            setPreflight(check);
            if (check.status === "blocked") return message.error("导演前置检查未通过，请先处理阻断项");
            if (check.status === "needs_confirmation") {
                const hasRevisions = Object.keys(check.revisedPrompts || {}).length > 0;
                modal.confirm({
                    title: "生成前发现可修订风险",
                    content: (
                        <div className="max-h-52 overflow-y-auto text-sm">
                            {(check.changeSummary || check.issues.map((issue) => issue.message)).slice(0, 8).map((item, index) => (
                                <p key={`${item}-${index}`} className="mb-1">
                                    {item}
                                </p>
                            ))}
                        </div>
                    ),
                    okText: hasRevisions ? "应用修订并查看提示词" : "查看提示词",
                    cancelText: "取消",
                    onOk: () => {
                        showPromptPreview(shotIds, check);
                    },
                });
                return;
            }
            showPromptPreview(shotIds, check);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "生成前预检失败");
        } finally {
            setPreflighting(false);
        }
    };

    const completeShotReviewAndRefresh = async (shotId: string) => {
        const completed = await onCompleteShotReview(shotId);
        if (!completed) return false;
        try {
            const check = await preflightDramaGeneration(project.id, episode.id, [shotId], `drama-preflight:${project.id}:${episode.id}:${shotId}:${Date.now()}`);
            setPreflight((current) => ({ ...(current || check), ...check }));
            if (check.status === "blocked") {
                message.error("镜头补全已返回，但前置检查仍有阻断项，请展开详情查看具体缺失字段");
                return false;
            }
            return true;
        } catch (error) {
            message.error(error instanceof Error ? error.message : "镜头补全后检查失败");
            return false;
        }
    };

    const createVisualPlan = async (shotIds?: string[]) => {
        setVisualPlanning(true);
        try {
            const run = await createDramaProductionRun(project.id, episode.id, "visual", undefined, {
                ...(shotIds?.length ? { shotIds } : {}),
                imageModel: imageRequestConfig.model,
                imageChannelId: imageRequestConfig.channelId,
                imageQuality: config.quality,
            });
            setVisualRun(run);
            message.success(`已生成${shotIds?.length ? "当前镜头" : "本集缺失分镜帧"}视觉计划，共 ${run.steps.filter((step) => ["asset_anchor", "start_frame", "end_frame", "keyframe"].includes(step.type)).length} 项任务`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "视觉计划生成失败");
        } finally {
            setVisualPlanning(false);
        }
    };

    const confirmVisualPlan = async () => {
        if (!visualRun) return;
        setVisualPlanning(true);
        try {
            const run = await updateDramaProductionRun(project.id, visualRun.id, { action: "confirm" });
            setVisualRun(run);
            for (const shot of episode.shots) {
                const start = run.steps.find((step) => step.shotId === shot.id && step.type === "start_frame");
                const end = run.steps.find((step) => step.shotId === shot.id && step.type === "end_frame");
                if (start?.taskId || end?.taskId)
                    updateShot(project.id, episode.id, shot.id, { ...(start?.taskId ? { storyboardStatus: "running", storyboardTaskId: start.taskId } : {}), ...(end?.taskId ? { storyboardEndStatus: "running", storyboardEndTaskId: end.taskId } : {}) });
            }
            message.success("视觉计划已确认，图片任务已提交");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "视觉计划确认失败");
        } finally {
            setVisualPlanning(false);
        }
    };

    const primaryAction = buildPrimaryAction({
        episode,
        readiness,
        renderReady,
        audioReady,
        renderTask,
        onStageChange,
        onQueueShots: (shotIds) => void startProduction(shotIds),
        onQueueAudio: (shotIds) => queueAudio(project.id, episode.id, shotIds),
        onCreateRender: () => void createRender(),
    });
    const status = generationStageStatus(readiness, renderTask);
    const checklist = [
        {
            id: "review",
            title: "内容审核",
            detail: episode.reviewStatus === "visual_ready" ? `${readiness.totalShots} 个镜头已确认并生成视觉方案` : readiness.totalShots ? "镜头内容尚未完成确认或视觉方案未生成" : "还没有可审核的镜头结构",
            tone: episode.reviewStatus === "visual_ready" ? ("done" as const) : ("blocked" as const),
            action: () => onStageChange(readiness.totalShots ? "review" : "script"),
            actionLabel: readiness.totalShots ? "去审核" : "去写剧本",
        },
        {
            id: "assets",
            title: "视觉资产",
            detail: readiness.missingBaselineShotIds.length
                ? `${readiness.missingBaselineShotIds.length} 个镜头缺少已审核的角色、场景或道具基准图`
                : readiness.missingReferenceShotIds.length
                  ? `${readiness.missingReferenceShotIds.length} 个镜头缺少可用资产引用`
                  : assetCount
                    ? `已登记 ${assetCount} 项资产，镜头引用的主基准图均已审核`
                    : "必须先登记并审核项目资产",
            tone: readiness.missingBaselineShotIds.length || readiness.missingReferenceShotIds.length ? ("blocked" as const) : assetCount ? ("done" as const) : ("blocked" as const),
            action: onOpenAssets,
            actionLabel: readiness.missingBaselineShotIds.length ? "前往项目资产库" : "查看资产",
        },
        {
            id: "storyboard",
            title: "分镜配置",
            detail: readiness.missingPromptShotIds.length ? `${readiness.missingPromptShotIds.length} 个镜头缺少画面或动态提示词` : readiness.totalShots ? `${readiness.totalShots} 个镜头生成参数已就绪` : "等待内容审核生成镜头",
            tone: readiness.missingPromptShotIds.length || !readiness.totalShots ? ("blocked" as const) : ("done" as const),
            action: () => onStageChange("storyboard"),
            actionLabel: "打开分镜",
        },
        {
            id: "audio",
            title: "音频与音色",
            detail: !readiness.voiceoverShotIds.length
                ? "视频原声默认；角色音色在项目资产中绑定"
                : audioReady
                  ? `系统音频模型已就绪，${readiness.voiceoverShotIds.length} 个镜头将跟随角色音色配音`
                  : `${readiness.voiceoverShotIds.length} 个镜头需要 AI 配音，但系统音频模型未配置`,
            tone: !readiness.voiceoverShotIds.length ? ("optional" as const) : audioReady ? ("done" as const) : ("blocked" as const),
            action: () => message.info("默认音频模型由管理员在“上游配置 → 逻辑模型路由 → 默认音频模型”维护；角色音色请在项目资产中绑定。"),
            actionLabel: "查看配置说明",
        },
    ];

    return (
        <div className="min-w-0" data-drama-generation-panel>
            <DramaStageHeader
                step="04"
                title="镜头生成"
                description={status.description}
                status={status.label}
                tone={status.tone}
                metrics={
                    readiness.totalShots
                        ? [
                              { label: "镜头", value: `${readiness.completedVideoCount}/${readiness.totalShots}` },
                              { label: "配音", value: readiness.voiceoverShotIds.length ? `${readiness.completedAudioCount}/${readiness.voiceoverShotIds.length}` : "无需" },
                              { label: "预计", value: `${estimateEpisodePoints(config, project, episode.shots, productionPlan?.video.resolution)} 积分` },
                              { label: "实际", value: `${costSummary?.actualPoints || 0} 积分` },
                              { label: "任务", value: costSummary?.taskCount || 0 },
                          ]
                        : []
                }
                action={
                    creatingRun ? (
                        <Button type="primary" className="!h-11 !w-full !px-4 sm:!h-9 sm:!w-auto" loading disabled>
                            锁定生产参数
                        </Button>
                    ) : (
                        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row">
                            <Button
                                className="!h-11 !w-full !px-4 sm:!h-9 sm:!w-auto"
                                icon={<GitBranch className="size-4" />}
                                disabled={!readiness.totalShots}
                                onMouseEnter={prefetchEpisodeCanvas}
                                onFocus={prefetchEpisodeCanvas}
                                onPointerDown={prefetchEpisodeCanvas}
                                onClick={() => void openEpisodeCanvas()}
                            >
                                打开本集画布
                            </Button>
                            {primaryAction}
                        </div>
                    )
                }
            />

            {productionRun ? (
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" data-drama-production-run>
                    <span className="font-medium text-foreground">生产计划已锁定</span>
                    <span>{productionRun.parameterSnapshot.ratio}</span>
                    <span>清晰度：{productionPlan?.video.resolution || "按后台默认"}</span>
                    <span>{productionRun.mode === "strict" ? "严格连续" : "平衡连续"}</span>
                </div>
            ) : null}

            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2" data-drama-visual-plan>
                {!visualRun ? (
                    <Button size="small" icon={<Sparkles className="size-3.5" />} loading={visualPlanning} onClick={() => void createVisualPlan()}>
                        生成本集缺失分镜帧
                    </Button>
                ) : null}
                {visualRun && !visualRun.confirmedAt ? (
                    <Popconfirm title="确认执行视觉计划？" description="确认后会创建图片任务并消耗图片额度。" okText="确认执行" cancelText="取消" onConfirm={() => void confirmVisualPlan()}>
                        <Button size="small" type="primary" loading={visualPlanning}>
                            确认执行 {visualRun.steps.filter((step) => ["asset_anchor", "start_frame", "end_frame", "keyframe"].includes(step.type)).length} 项图片任务
                        </Button>
                    </Popconfirm>
                ) : null}
                {visualRun?.confirmedAt ? <span className="text-xs text-muted-foreground">视觉计划：{visualRun.status === "completed" ? "已完成" : visualRun.status === "failed" ? "有失败项" : "执行中"}</span> : null}
            </div>

            {readiness.totalShots ? (
                <div className="mt-3 flex items-center gap-3" aria-label="镜头完成进度">
                    <Progress className="!m-0 min-w-0 flex-1" percent={readiness.progressPercent} showInfo={false} />
                    <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{readiness.progressPercent}%</span>
                </div>
            ) : null}

            <section className="mt-2.5" aria-labelledby="drama-preflight-title" data-drama-generation-readiness>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <h3 id="drama-preflight-title" className="shrink-0 text-sm font-semibold">
                            生成前检查
                        </h3>
                        <p className="truncate text-xs text-muted-foreground">阻塞项会说明原因，并带你回到真正需要处理的位置。</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{checklist.filter((item) => item.tone === "done" || item.tone === "optional").length}/4 可继续</span>
                </div>
                <div className={`mt-2 grid gap-1.5 ${readiness.totalShots ? "sm:grid-cols-2 xl:grid-cols-4" : "max-w-xl"}`}>
                    {(readiness.totalShots ? checklist : checklist.slice(0, 1)).map(({ id, ...item }) => (
                        <ReadinessItem key={id} {...item} />
                    ))}
                </div>
                {preflight?.status === "blocked" ? (
                    <div className="mt-2 rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/25 dark:text-amber-100" data-drama-director-blockers>
                        <div className="flex items-center gap-2 font-semibold">
                            <CircleAlert className="size-4" />
                            导演前置检查阻断生产
                        </div>
                        <ul className="mt-2 space-y-1 pl-5">
                            {preflight.issues.slice(0, 8).map((issue, index) => (
                                <li key={`${issue.code}-${issue.shotId || "general"}-${issue.assetId || "none"}-${index}`} className="list-disc">
                                    {issue.message}
                                </li>
                            ))}
                        </ul>
                        {preflight.issues.length > 8 ? <p className="mt-2 text-amber-800 dark:text-amber-200">另有 {preflight.issues.length - 8} 项，请补齐资产与连续性状态后重新检查。</p> : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                                size="small"
                                type="primary"
                                icon={<Sparkles className="size-3.5" />}
                                loading={autoFixing}
                                onClick={async () => {
                                    if (autoFixing) return;
                                    setAutoFixing(true);
                                    try {
                                        const changed = await onAutoFixPreflight(preflight.issues);
                                        if (changed) {
                                            const refreshed = await preflightDramaGeneration(project.id, episode.id, preflight.checkedShotIds || [], `drama-preflight:auto-fix:${project.id}:${episode.id}:${Date.now()}`);
                                            setPreflight(refreshed);
                                            if (refreshed.status === "blocked") message.error("Agent 已补全可修复字段，但前置检查仍有阻断项，请展开详情查看剩余问题");
                                            else if (refreshed.status === "passed") message.success("Agent 已补全镜头参数，前置检查已通过");
                                            else message.info("Agent 已补全镜头参数，请确认剩余提示项后继续");
                                        }
                                    } finally {
                                        setAutoFixing(false);
                                    }
                                }}
                            >
                                让 Agent 自动修复可修复问题
                            </Button>
                            <span className="text-amber-800/80 dark:text-amber-200/80">会补全镜头参数；基准图仍需你确认主图。</span>
                        </div>
                    </div>
                ) : null}
                {preflight?.status === "needs_confirmation" ? (
                    <div className="mt-2 rounded-xl border border-sky-300/70 bg-sky-50/70 p-3 text-xs text-sky-950 dark:border-sky-700/60 dark:bg-sky-950/25 dark:text-sky-100" data-drama-director-warnings>
                        <div className="flex items-center gap-2 font-semibold">
                            <CircleAlert className="size-4" />
                            生成前发现可确认风险
                        </div>
                        <ul className="mt-2 space-y-1 pl-5">
                            {preflight.issues
                                .filter((issue) => issue.severity === "warning")
                                .slice(0, 6)
                                .map((issue, index) => (
                                    <li key={`${issue.code}-${issue.shotId || "general"}-${issue.assetId || "none"}-${index}`} className="list-disc">
                                        {issue.message}
                                    </li>
                                ))}
                        </ul>
                    </div>
                ) : null}
            </section>

            {readiness.totalShots ? (
                <section className="mt-3 border-y border-border" aria-labelledby="drama-production-tools" data-drama-generation-tools>
                    <h3 id="drama-production-tools" className="sr-only">
                        生产辅助工具
                    </h3>
                    <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-border">
                        <ToolGroup title="主生成" description="批量生成由顶部唯一主操作承接，避免重复触发任务。">
                            <Button
                                className={actionButtonClass}
                                icon={<ScanSearch className="size-4" />}
                                loading={reviewingVisuals}
                                disabled={!episode.shots.some((shot) => activeFrameEvidence(shot, "storyboard_start").length || shot.storyboardFrames?.some((frame) => frame.mediaUrl && frame.status === "success"))}
                                onClick={() => void reviewVisuals()}
                            >
                                视觉复盘
                            </Button>
                        </ToolGroup>
                        <ToolGroup title="后期处理" description={audioReady ? "配音与字幕按镜头结果继续处理。" : "AI 配音需后台先配置音频模型。"}>
                            <Button
                                className={actionButtonClass}
                                icon={<Volume2 className="size-4" />}
                                disabled={!audioReady || !audioCandidateShotIds.length}
                                title={audioReady ? undefined : "请管理员先在后台设置默认音频模型"}
                                onClick={() => queueAudio(project.id, episode.id, audioCandidateShotIds)}
                            >
                                批量配音
                            </Button>
                            <Button className={actionButtonClass} icon={<Captions className="size-4" />} disabled={!episode.shots.some((shot) => (shot.subtitle || shot.dialogue).trim())} onClick={() => setSubtitleOpen(true)}>
                                字幕时间轴
                            </Button>
                        </ToolGroup>
                        <ToolGroup title="交付导出" description="镜头结果可导出字幕和剪映草稿，成片完成后直接下载。">
                            <Button className={actionButtonClass} icon={<Download className="size-4" />} disabled={!episode.shots.some((shot) => (shot.subtitle || shot.dialogue).trim())} onClick={downloadSubtitles}>
                                导出 SRT
                            </Button>
                            <Button className={actionButtonClass} icon={<Download className="size-4" />} disabled={!episode.shots.some((shot) => shot.videoUrl)} onClick={() => setJianyingOpen(true)}>
                                剪映草稿
                            </Button>
                        </ToolGroup>
                    </div>
                </section>
            ) : null}

            {episode.visualReview ? <VisualReview project={project} episode={episode} onRetry={(shotIds) => void startProduction(shotIds)} /> : null}
            {renderTask ? <RenderTaskCard task={renderTask} onCancel={() => void cancelRender()} /> : null}

            {episode.shots.length ? (
                <section className="mt-3" aria-labelledby="drama-shot-task-title">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                        <div>
                            <h3 id="drama-shot-task-title" className="text-sm font-semibold">
                                镜头任务
                            </h3>
                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">每个镜头独立显示分镜、视频和配音状态；失败时只重试目标镜头。</p>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                            <span>{readiness.completedVideoCount} 已完成</span>
                            <span>{readiness.activeShotIds.length} 处理中</span>
                            <span>{readiness.failedShotIds.length} 失败</span>
                        </div>
                    </div>

                    <div className="mt-2.5 overflow-hidden rounded-lg border border-border bg-card" data-drama-shot-task-list>
                        {episode.shots.map((shot) => (
                            <ShotTaskRow
                                key={shot.id}
                                project={project}
                                episode={episode}
                                shot={shot}
                                productionRun={productionRun}
                                audioReady={audioReady}
                                onPreview={setPreviewMedia}
                                onCancel={() => void cancelShot(shot)}
                                onSendToAgent={() => onOpenAgentForShot(shot)}
                                onOpenCanvas={() => void openEpisodeCanvas()}
                                onCompleteReview={() => completeShotReviewAndRefresh(shot.id)}
                                onGenerate={() => void startProduction([shot.id])}
                                onGenerateVideoPrompt={() => generateVideoPrompt(shot)}
                                blocked={readiness.missingBaselineShotIds.includes(shot.id)}
                                preflightIssues={preflight?.issues.filter((issue) => issue.shotId === shot.id && issue.severity === "blocking") || []}
                                onMaintain={(action) => {
                                    if (action === "assets") onOpenAssets();
                                    else if (action === "storyboard") onStageChange("storyboard");
                                    else onStageChange("review");
                                }}
                            />
                        ))}
                    </div>
                </section>
            ) : null}

            <DramaJianyingModal
                open={jianyingOpen}
                path={jianyingPath}
                version={jianyingVersion}
                exporting={jianyingExporting}
                onClose={() => setJianyingOpen(false)}
                onExport={() => void exportJianying()}
                onPathChange={setJianyingPath}
                onVersionChange={setJianyingVersion}
            />
            <DramaSubtitleModal open={subtitleOpen} shots={episode.shots} onClose={() => setSubtitleOpen(false)} />
            <DramaMediaPreviewModal media={previewMedia} onClose={() => setPreviewMedia(undefined)} />
        </div>
    );
}

type ReadinessTone = "done" | "blocked" | "optional";

function ReadinessItem({ title, detail, tone, action, actionLabel }: { title: string; detail: string; tone: ReadinessTone; action: () => void; actionLabel: string }) {
    const Icon = tone === "done" ? CircleCheck : tone === "blocked" ? CircleAlert : CircleDashed;
    const iconClass = tone === "done" ? "text-emerald-600 dark:text-emerald-300" : tone === "blocked" ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground";
    return (
        <button
            type="button"
            className="group flex h-12 min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-left transition hover:border-foreground/20 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
            onClick={action}
            title={`${title}：${detail}`}
            aria-label={`${title}，${actionLabel}`}
        >
            <Icon className={`size-4 shrink-0 ${iconClass}`} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{detail}</span>
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground transition group-hover:text-foreground">{actionLabel}</span>
        </button>
    );
}

function ToolGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
        <div className="min-w-0 border-b border-border py-3 last:border-b-0 lg:border-b-0 lg:px-4 lg:first:pl-0 lg:last:pr-0">
            <div className="text-sm font-semibold">{title}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            <div className="mt-2 flex min-w-0 flex-wrap gap-2">{children}</div>
        </div>
    );
}

function VisualReview({ project, episode, onRetry }: { project: DramaProject; episode: DramaEpisode; onRetry: (shotIds: string[]) => void }) {
    const review = episode.visualReview!;
    return (
        <section className="mt-6 border-b border-border pb-5" aria-label="分镜视觉复盘">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">分镜视觉复盘</h3>
                        <Tag color={review.status === "passed" ? "success" : review.status === "needs_revision" ? "warning" : "default"}>{review.status === "passed" ? "通过" : review.status === "needs_revision" ? "需调整" : "未完成"}</Tag>
                        {typeof review.score === "number" ? <span className="text-xs tabular-nums text-muted-foreground">{review.score} 分</span> : null}
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{review.summary}</p>
                </div>
                {review.retryTaskIds.length ? (
                    <Button className="!h-9 shrink-0" icon={<RefreshCw className="size-4" />} onClick={() => onRetry(review.retryTaskIds)}>
                        重试 {review.retryTaskIds.length} 个问题镜头
                    </Button>
                ) : null}
            </div>
            {review.issues.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {review.issues.map((issue, index) => {
                        const shot = episode.shots.find((item) => item.id === issue.taskId);
                        return (
                            <div key={`${issue.taskId || "general"}-${index}`} className="border-l-2 border-amber-400 pl-3 text-sm">
                                <div className="font-medium">{shot?.title || issue.category}</div>
                                <p className="mt-1 leading-5 text-muted-foreground">{issue.message}</p>
                                {issue.correction ? <p className="mt-1 leading-5">建议：{issue.correction}</p> : null}
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </section>
    );
}

function RenderTaskCard({ task, onCancel }: { task: DramaRenderTask; onCancel: () => void }) {
    const active = task.status === "pending" || task.status === "running";
    return (
        <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="整集合成任务">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold">
                        {active ? <LoaderCircle className="size-4 animate-spin text-sky-600 dark:text-sky-300" /> : <Film className="size-4" />}
                        整集合成
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {task.status === "success"
                            ? "成片已经完成，可预览并下载原文件。"
                            : task.status === "error"
                              ? task.error || "合成失败，请检查镜头媒体后重试。"
                              : task.status === "cancelled"
                                ? "合成已取消，可以从页面顶部重新创建任务。"
                                : "正在转码、拼接并烧录字幕，离开页面不会取消后台任务。"}
                    </p>
                </div>
                {active ? (
                    <Button danger className="!h-9 shrink-0" onClick={onCancel}>
                        取消合成
                    </Button>
                ) : null}
            </div>
            {task.result?.url ? (
                <div className="mt-4">
                    <video className="max-h-[520px] w-full rounded-xl bg-black" src={task.result.url} controls preload="metadata" />
                    <a className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:underline dark:text-cyan-300" href={originalMediaDownloadUrl(task.result.url)} download={mediaDownloadFileName(task.id, "video/mp4", task.result.url)}>
                        下载整集成片
                    </a>
                </div>
            ) : null}
        </section>
    );
}

function ShotTaskRow({
    project,
    episode,
    shot,
    productionRun,
    audioReady,
    onPreview,
    onCancel,
    onSendToAgent,
    onOpenCanvas,
    onCompleteReview,
    onGenerate,
    onGenerateVideoPrompt,
    blocked,
    preflightIssues,
    onMaintain,
}: {
    project: DramaProject;
    episode: DramaEpisode;
    shot: DramaShot;
    productionRun: DramaProductionRun | null;
    audioReady: boolean;
    onPreview: (media: DramaPreviewMedia) => void;
    onCancel: () => void;
    onSendToAgent: () => void;
    onOpenCanvas: () => void;
    onCompleteReview: () => Promise<boolean>;
    onGenerate: () => void;
    onGenerateVideoPrompt: () => Promise<unknown>;
    blocked: boolean;
    preflightIssues: DramaProductionPreflight["issues"];
    onMaintain: (action: "assets" | "storyboard" | "review") => void;
}) {
    const updateShot = useDramaStore((state) => state.updateShot);
    const saveProjectNow = useDramaStore((state) => state.saveProjectNow);
    const queueAudio = useDramaStore((state) => state.queueAudio);
    const beginVideoPrompt = useDramaStore((state) => state.beginVideoPrompt);
    const finishVideoPrompt = useDramaStore((state) => state.finishVideoPrompt);
    const videoPromptRunKey = dramaVideoPromptRunKey(project.id, episode.id, shot.id);
    const generatingVideoPrompt = useDramaStore((state) => Boolean(state.videoPromptRuns[videoPromptRunKey]));
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [completingReview, setCompletingReview] = useState(false);
    const generating = [shot.storyboardStatus, shot.storyboardEndStatus, shot.generationStatus].some((status) => status === "queued" || status === "running");
    const failed = [shot.storyboardStatus, shot.storyboardEndStatus, shot.generationStatus].some((status) => status === "error");
    const audioRunning = shot.audioStatus === "running" || shot.audioStatus === "queued";
    const dialogue = (shot.subtitle || shot.dialogue || shot.narration).trim();
    const startFrames = activeFrameEvidence(shot, "storyboard_start");
    const endFrames = activeFrameEvidence(shot, "storyboard_end");
    const agentActionItems: MenuProps["items"] = [
        {
            type: "group",
            label: "当前镜头 AI 操作",
            children: [
                { key: "complete-review", icon: <Sparkles className="size-3.5" />, label: "智能补全参数", disabled: generating || completingReview },
                { key: "generate-prompt", icon: <Sparkles className="size-3.5" />, label: "Agent 生成提示词", disabled: generating || blocked || generatingVideoPrompt },
                {
                    key: audioRunning ? "cancel-audio" : "audio",
                    icon: audioRunning ? <Pause className="size-3.5" /> : <Volume2 className="size-3.5" />,
                    label: audioRunning ? "取消配音" : shot.audioStatus === "error" ? "重试配音" : shot.audioMode === "voiceover" ? "生成配音" : "改用 AI 配音",
                    disabled: audioRunning ? false : !dialogue || !audioReady,
                },
            ],
        },
        { type: "divider" },
        { key: "open-agent", icon: <Send className="size-3.5" />, label: "打开 Agent 对话", disabled: !shot.videoPrompt },
    ];
    const handleAgentAction: MenuProps["onClick"] = ({ key }) => {
        if (key === "complete-review") {
            setCompletingReview(true);
            void onCompleteReview().finally(() => setCompletingReview(false));
            return;
        }
        if (key === "generate-prompt") {
            if (!beginVideoPrompt(project.id, episode.id, shot.id)) return;
            void onGenerateVideoPrompt().finally(() => finishVideoPrompt(project.id, episode.id, shot.id));
            return;
        }
        if (key === "cancel-audio") {
            void cancelDramaAudioTask(shot.audioTaskId).finally(() => updateShot(project.id, episode.id, shot.id, { audioStatus: "cancelled" }));
            return;
        }
        if (key === "audio") {
            queueAudio(project.id, episode.id, [shot.id]);
            return;
        }
        if (key === "open-agent") onSendToAgent();
    };

    return (
        <article
            className="grid min-w-0 gap-4 overflow-hidden border-b border-border p-3.5 last:border-b-0 hover:bg-muted/20 [content-visibility:visible] sm:p-4 sm:[content-visibility:auto] lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start"
            data-drama-shot-task
        >
            <div className="min-w-0">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums">{String(shot.order).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                            <h4 className="min-w-0 truncate font-semibold">{shot.title || `镜头 ${String(shot.order).padStart(2, "0")}`}</h4>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <StoryboardTag status={shot.storyboardStatus} />
                                {shot.storyboardFrameMode === "first_last" ? <Tag className="!m-0 !h-6 !rounded-md !leading-6">尾帧 {shot.storyboardEndStatus === "success" ? "完成" : shot.storyboardEndStatus === "error" ? "失败" : "待处理"}</Tag> : null}
                                <GenerationTag status={shot.generationStatus} />
                                {shot.audioMode === "voiceover" ? <AudioTag status={shot.audioStatus} /> : <Tag className="!m-0">{shot.audioMode === "mute" ? "静音" : "视频原声"}</Tag>}
                            </div>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{shot.videoPrompt || "动态提示词尚未填写，请回到分镜阶段补充。"}</p>
                        <Button type="text" size="small" className="mt-1 !h-7 !px-0 text-xs" icon={detailsOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />} onClick={() => setDetailsOpen((value) => !value)}>
                            {detailsOpen ? "收起详情" : "展开详情"}
                        </Button>
                    </div>
                </div>

                <ShotErrors shot={shot} />
                {preflightIssues.length ? <ShotPreflightBlockers issues={preflightIssues} onMaintain={onMaintain} /> : null}
                {detailsOpen ? <ShotExecutionDetails project={project} episode={episode} shot={shot} productionRun={productionRun} onPreview={onPreview} /> : null}

                {startFrames.length || endFrames.length || shot.videoUrl ? (
                    <div className="ml-11 mt-3 flex max-w-2xl flex-wrap gap-2">
                        {startFrames.map((frame, index) => (
                            <DramaMediaThumbnail key={`start-${frame.id}`} media={{ type: "image", url: frame.mediaUrl, title: `${shot.title}起始帧${index + 1}` }} onOpen={onPreview} />
                        ))}
                        {endFrames.map((frame, index) => (
                            <DramaMediaThumbnail key={`end-${frame.id}`} media={{ type: "image", url: frame.mediaUrl, title: `${shot.title}结束帧${index + 1}` }} onOpen={onPreview} />
                        ))}
                        {shot.videoUrl ? (
                            <DramaMediaThumbnail
                                media={{
                                    type: "video",
                                    url: shot.videoUrl,
                                    title: `${shot.title}生成视频`,
                                    downloadUrl: shot.generationTaskId ? `/api/video-tasks/${encodeURIComponent(shot.generationTaskId)}/download` : undefined,
                                    onRepair: shot.generationTaskId
                                        ? async () => {
                                              const response = await fetch(`/api/video-tasks/${encodeURIComponent(shot.generationTaskId!)}/download?repair=1`, { cache: "no-store" });
                                              const payload = (await response.json().catch(() => ({}))) as { data?: { url?: string }; msg?: string };
                                              if (!response.ok || !payload.data?.url) throw new Error(payload.msg || "视频资源补全失败");
                                              updateShot(project.id, episode.id, shot.id, { videoUrl: payload.data.url, generationError: undefined });
                                              await saveProjectNow(project.id);
                                          }
                                        : undefined,
                                }}
                                onOpen={onPreview}
                            />
                        ) : null}
                    </div>
                ) : null}
                {dialogue ? <p className="ml-11 mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">字幕：{dialogue}</p> : null}
                {shot.audioUrl ? <audio className="ml-11 mt-3 h-10 w-[calc(100%_-_2.75rem)] max-w-sm" src={shot.audioUrl} controls preload="metadata" /> : null}
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-1">
                <Dropdown trigger={["click"]} placement="bottomRight" menu={{ items: agentActionItems, onClick: handleAgentAction }}>
                    <Button
                        className={`${actionButtonClass} col-span-2 lg:col-span-1 !justify-between`}
                        icon={<Sparkles className="size-4" />}
                        loading={completingReview || generatingVideoPrompt}
                        disabled={completingReview || generatingVideoPrompt}
                        aria-busy={generatingVideoPrompt || undefined}
                        aria-label="打开 Agent 创作操作"
                    >
                        <span>{generatingVideoPrompt ? "正在分析当前镜头" : "Agent 创作"}</span>
                        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
                    </Button>
                </Dropdown>
                {generating ? (
                    <Button className={`${dialogue ? "" : "col-span-2 lg:col-span-1"} ${actionButtonClass}`} icon={<Pause className="size-4" />} onClick={onCancel}>
                        取消生成
                    </Button>
                ) : (
                    <Button
                        className={`${dialogue ? "" : "col-span-2 lg:col-span-1"} ${actionButtonClass}`}
                        disabled={episode.reviewStatus !== "visual_ready" || blocked}
                        title={blocked ? "角色、场景或关键道具缺少已审核主基准图" : undefined}
                        icon={failed ? <RefreshCw className="size-4" /> : <Play className="size-4" />}
                        onClick={onGenerate}
                    >
                        {failed ? "重试镜头" : shot.videoUrl ? "重新生成" : "生成镜头"}
                    </Button>
                )}
                <Button type="text" className={`col-span-2 !bg-muted/60 hover:!bg-muted lg:col-span-1 ${actionButtonClass}`} icon={<GitBranch className="size-4" />} onClick={onOpenCanvas}>
                    在画布中查看
                </Button>
            </div>
        </article>
    );
}

function ShotErrors({ shot }: { shot: DramaShot }) {
    const errors: Array<[string, string]> = [
        shot.storyboardError ? ["分镜图", shot.storyboardError] : null,
        shot.storyboardEndError ? ["结束帧", shot.storyboardEndError] : null,
        shot.generationError ? ["视频", shot.generationError] : null,
        shot.audioError ? ["配音", shot.audioError] : null,
    ].filter((item): item is [string, string] => Boolean(item));
    return errors.length ? (
        <div className="ml-11 mt-2 space-y-1 border-l-2 border-rose-300 pl-3 text-xs leading-5 text-rose-600 dark:border-rose-800 dark:text-rose-300">
            {errors.map(([scope, raw]) => (
                <details key={`${scope}:${raw}`} className="group">
                    <summary className="cursor-pointer list-none">
                        {scope}：{publicUpstreamError(raw)}
                        <span className="ml-1 text-rose-500/70 group-open:hidden">展开原始详情</span>
                    </summary>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-rose-500/80">原始详情：{raw}</p>
                </details>
            ))}
        </div>
    ) : null;
}

function ShotPreflightBlockers({ issues, onMaintain }: { issues: DramaProductionPreflight["issues"]; onMaintain: (action: "assets" | "storyboard" | "review") => void }) {
    const action = (issue: DramaProductionPreflight["issues"][number]) => {
        if (["CHARACTER_ANCHOR", "LOCATION_ANCHOR", "PROP_ANCHOR", "CHARACTER_REFERENCE", "LOCATION_REFERENCE", "PROP_REFERENCE", "CLUE_REFERENCE"].includes(issue.code)) return "assets" as const;
        if (["PROMPT_MISSING", "FRAMING_UNCLEAR", "NEGATIVE_TEXT_MISSING"].includes(issue.code)) return "storyboard" as const;
        return "review" as const;
    };
    return (
        <div className="ml-11 mt-2 space-y-2 rounded-md border border-amber-300/70 bg-amber-50/70 p-2.5 text-xs text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/25 dark:text-amber-100" data-drama-shot-preflight-blockers>
            <div className="flex items-center gap-1.5 font-semibold">
                <CircleAlert className="size-3.5" />
                该镜头仍有 {issues.filter((issue) => issue.severity === "blocking").length || issues.length} 项前置问题
            </div>
            <div className="space-y-1.5">
                {issues.slice(0, 6).map((issue) => (
                    <div key={`${issue.code}-${issue.assetId || "none"}`} className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 leading-5">{issue.message}</span>
                        <Button type="link" size="small" className="!h-auto !shrink-0 !p-0 !text-xs !text-amber-800 dark:!text-amber-200" onClick={() => onMaintain(action(issue))}>
                            {action(issue) === "assets" ? "去项目资产" : action(issue) === "storyboard" ? "去分镜" : "去内容审核"}
                        </Button>
                    </div>
                ))}
            </div>
            {issues.length > 6 ? <p className="text-amber-800 dark:text-amber-200">另有 {issues.length - 6} 项，请先处理上方维护入口。</p> : null}
        </div>
    );
}

function publicUpstreamError(raw: string) {
    const lower = raw.toLowerCase();
    if (lower.includes("upstream service temporarily unavailable")) return "上游渠道暂时不可用，可重试；连续失败请检查渠道健康、模型账号和网关连通性";
    if (lower.includes("timeout") || raw.includes("超时")) return "上游任务超时，建议先重试；连续超时请降低任务复杂度或检查渠道响应";
    if (raw.includes("无可用账号") || lower.includes("no available account")) return "模型无可用账号，请管理员检查渠道账号池、额度或模型绑定";
    if (lower.includes("unauthorized") || lower.includes("forbidden") || raw.includes("鉴权")) return "渠道鉴权失败，请管理员检查账号、密钥和模型绑定";
    if (lower.includes("429") || lower.includes("rate limit") || raw.includes("频繁")) return "渠道请求过于频繁，可稍后重试或切换备用渠道";
    if (lower.includes("invalid") || raw.includes("协议") || raw.includes("解析")) return "上游返回不符合协议，需要人工检查任务状态";
    return raw;
}

function ShotExecutionDetails({ project, episode, shot, productionRun, onPreview }: { project: DramaProject; episode: DramaEpisode; shot: DramaShot; productionRun: DramaProductionRun | null; onPreview: (media: DramaPreviewMedia) => void }) {
    const { message } = App.useApp();
    const updateShot = useDramaStore((state) => state.updateShot);
    const saveProjectNow = useDramaStore((state) => state.saveProjectNow);
    const [videoPromptDraft, setVideoPromptDraft] = useState("");
    const [videoPromptOriginal, setVideoPromptOriginal] = useState("");
    const promptSnapshot = productionRun?.preflightSnapshot?.prompts?.[shot.id];
    const sourceImagePrompt = promptSnapshot?.sourceImagePrompt || shot.imagePrompt;
    const sourceVideoPrompt = promptSnapshot?.sourceVideoPrompt || shot.videoPrompt;
    const executionImagePrompt = shot.executionImagePrompt || promptSnapshot?.executionImagePrompt;
    const executionVideoPrompt = shot.executionVideoPrompt || promptSnapshot?.executionVideoPrompt;
    const assets = shotAssetLabels(project, shot);
    const referenceAssets = shotReferenceAssets(project, shot);
    const videoStep = productionRun?.steps.filter((step) => step.shotId === shot.id && step.type === "video").sort((left, right) => (right.clipIndex || 0) - (left.clipIndex || 0))[0];
    const referenceBindings = videoStep?.referenceBindingsSnapshot || [];
    const sequenceFrames = (shot.storyboardFrames || []).filter((frame) => frame.mediaUrl && frame.status === "success" && frame.continuityStatus !== "stale").sort((left, right) => left.sequenceIndex - right.sequenceIndex);
    const boundaryFrames = [
        ...activeFrameEvidence(shot, "storyboard_start")
            .slice(0, 1)
            .map((frame) => ({ ...frame, label: "本镜首帧" })),
        ...activeFrameEvidence(shot, "storyboard_end")
            .slice(0, 1)
            .map((frame) => ({ ...frame, label: "本镜尾帧" })),
    ];
    const compiledVideoPrompt = compileDramaShotExecutionPrompts(project, episode, shot).videoPrompt;
    const supplierVideoPrompt = shot.framePlan?.frames?.length
        ? compiledVideoPrompt
        : formatPromptFieldLines(shot.executionVideoPrompt?.trim() || compiledVideoPrompt, "video");
    useEffect(() => {
        setVideoPromptDraft(supplierVideoPrompt);
        setVideoPromptOriginal(supplierVideoPrompt);
    }, [shot.id, supplierVideoPrompt]);
    const continuityEdge = episode.continuityEdges?.find((edge) => edge.toShotId === shot.id && edge.inheritActualEndFrame);
    const continuitySource = continuityEdge ? episode.shots.find((item) => item.id === continuityEdge.fromShotId) : undefined;
    const voiceSource = shot.audioMode === "mute" ? "静音" : shot.audioMode === "source" ? "视频原声" : shotVoiceSource(project, shot);
    const modelText = productionRun ? `图片 ${productionRun.parameterSnapshot.imageModel} / 视频 ${productionRun.parameterSnapshot.videoModel}` : "等待生产计划锁定";
    const rows = [
        ["章节文案", shot.description || episode.outline || episode.script],
        ["镜头事实", shot.shotBoundary || shot.sourceText],
        ["对白/旁白", [shot.dialogue, shot.narration].filter(Boolean).join("\n")],
        ["原文依据", shot.sourceText],
        ["用户/剧本提示词", [sourceImagePrompt ? `画面：${sourceImagePrompt}` : "", sourceVideoPrompt ? `动态：${sourceVideoPrompt}` : ""].filter(Boolean).join("\n")],
        ["实际执行提示词", [executionImagePrompt ? `生图：${executionImagePrompt}` : "", executionVideoPrompt ? `生视频：${executionVideoPrompt}` : ""].filter(Boolean).join("\n")],
        ["实际引用资产", assets.length ? assets.join("、") : "无显式资产引用"],
        ["连续性来源", continuitySource ? `继承 ${continuitySource.title || `镜头 ${continuitySource.order}`} 的实际尾帧${continuityStartEvidence(continuitySource) ? "，已人工验收" : "，等待上镜尾帧验收"}` : "未继承上一镜实际尾帧"],
        ["模型与方式", `${modelText}；${dramaShotVideoMode(project, shot) === "storyboard" ? "分镜驱动" : "直接生成"}；${shot.storyboardFrameMode === "first_last" ? "首尾帧，起止约束不代表质量保证" : "单帧"}`],
        ["声音来源", voiceSource],
    ].filter(([, value]) => String(value || "").trim());
    return (
        <div className="ml-11 mt-3 grid min-w-0 gap-2 rounded-md border border-border bg-muted/15 p-3 text-xs leading-5" data-drama-shot-execution-details>
            {rows.map(([label, value]) => (
                <div key={label} className="grid min-w-0 gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
                    <span className="font-medium text-foreground">{label}</span>
                    <p className="min-w-0 whitespace-pre-wrap break-words text-muted-foreground">{value}</p>
                </div>
            ))}
            <div className="mt-1 border-t border-border/70 pt-3" data-drama-shot-reference-assets>
                <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">引用资产图片</span>
                    <span className="text-muted-foreground">{referenceAssets.length ? `${referenceAssets.length} 张` : "暂无已审核基准图"}</span>
                </div>
                {referenceAssets.length ? (
                    <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
                        {referenceAssets.map((asset) => (
                            <button
                                key={asset.id}
                                type="button"
                                className="group min-w-0 overflow-hidden rounded-md border border-border bg-background text-left transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
                                onClick={() => onPreview({ type: "image", url: asset.url, title: asset.label })}
                                aria-label={`查看引用资产：${asset.label}`}
                            >
                                <span className="block overflow-hidden bg-muted" style={{ aspectRatio: asset.width && asset.height ? `${asset.width} / ${asset.height}` : "4 / 3" }}>
                                    <img className="size-full object-cover transition group-hover:scale-[1.02]" src={imagePreviewUrl(asset.url, 480)} alt={asset.label} />
                                </span>
                                <span className="block truncate px-2 py-1.5 text-[11px] text-muted-foreground">{asset.label}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="mt-2 text-muted-foreground">本镜头引用的固定资产还没有可展示的已审核主基准图。</p>
                )}
            </div>
            <div className="mt-1 border-t border-border/70 pt-3" data-drama-shot-sequence-frames>
                <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">顺序帧引用</span>
                    <span className="text-muted-foreground">{sequenceFrames.length ? `${sequenceFrames.length} 张` : "暂无已验收顺序帧"}</span>
                </div>
                {sequenceFrames.length ? (
                    <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
                        {sequenceFrames.map((frame) => {
                            const binding = referenceBindings.find((item) => item.frameId === frame.id || item.keyframeIndex === frame.sequenceIndex);
                            const beat = shot.framePlan?.frames.find((item) => item.id === frame.id || item.sequenceIndex === frame.sequenceIndex);
                            return (
                                <button
                                    key={frame.id}
                                    type="button"
                                    className="group min-w-0 overflow-hidden rounded-md border border-border bg-background text-left transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
                                    onClick={() => onPreview({ type: "image", url: frame.mediaUrl!, title: `${shot.title}顺序帧${frame.sequenceIndex}` })}
                                    aria-label={`查看顺序帧 ${frame.sequenceIndex}`}
                                >
                                    <span className="block overflow-hidden bg-muted" style={{ aspectRatio: frame.width && frame.height ? `${frame.width} / ${frame.height}` : "4 / 3" }}>
                                        <img className="size-full object-cover transition group-hover:scale-[1.02]" src={imagePreviewUrl(frame.mediaUrl!, 480)} alt={`${shot.title}顺序帧${frame.sequenceIndex}`} />
                                    </span>
                                    <span className="block px-2 py-1.5 text-[11px] leading-4 text-muted-foreground">
                                        <span className="block font-medium text-foreground">
                                            帧 {frame.sequenceIndex} · {frame.sequenceIndex === 1 ? "开始" : frame.sequenceIndex === sequenceFrames.length ? "结束" : "中间"}
                                            {binding ? ` · ${binding.alias}` : ""}
                                        </span>
                                        <span className="block truncate">{beat ? `${beat.startSecond}-${beat.endSecond}s` : "已验收关键帧"}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="mt-2 text-muted-foreground">本镜头尚未生成并验收可用于视频的顺序关键帧，固定资产图不能替代顺序帧。</p>
                )}
                {shot.storyboardFrameMode === "first_last" ? (
                    <div className="mt-3 border-t border-border/70 pt-3" data-drama-shot-boundary-frames>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground">本镜首尾帧</span>
                            <span className="text-muted-foreground">{boundaryFrames.length}/2 张已验收</span>
                        </div>
                        {boundaryFrames.length ? (
                            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
                                {boundaryFrames.map((frame) => (
                                    <button
                                        key={`${frame.label}-${frame.id}`}
                                        type="button"
                                        className="group min-w-0 overflow-hidden rounded-md border border-border bg-background text-left transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
                                        onClick={() => onPreview({ type: "image", url: frame.mediaUrl, title: `${shot.title}${frame.label}` })}
                                        aria-label={`查看${frame.label}`}
                                    >
                                        <span className="block overflow-hidden bg-muted" style={{ aspectRatio: "4 / 3" }}>
                                            <img className="size-full object-cover transition group-hover:scale-[1.02]" src={imagePreviewUrl(frame.mediaUrl, 480)} alt={`${shot.title}${frame.label}`} />
                                        </span>
                                        <span className="block px-2 py-1.5 text-[11px] leading-4 text-muted-foreground">{frame.label}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 text-muted-foreground">本镜首帧和尾帧尚未生成并验收，不能用固定资产图代替。</p>
                        )}
                    </div>
                ) : null}
                {referenceBindings.length ? (
                    <div className="mt-3 space-y-1 rounded-md border border-border/70 bg-background/60 p-2.5" data-drama-shot-reference-mapping>
                        <div className="font-medium text-foreground">供应商引用映射</div>
                        {referenceBindings.map((binding) => (
                            <div key={`${binding.alias}-${binding.sourceId || binding.frameId || binding.shotId || "reference"}`} className="grid min-w-0 gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                                <span className="font-medium text-foreground">{binding.alias}</span>
                                <span className="min-w-0 break-words text-muted-foreground">{binding.purpose}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
                {continuitySource && continuityStartEvidence(continuitySource) ? (
                    <div className="mt-3 border-t border-border/70 pt-3" data-drama-shot-continuity-tail>
                        <div className="font-medium text-foreground">上一镜实际尾帧</div>
                        <button
                            type="button"
                            className="mt-2 flex max-w-[180px] flex-col overflow-hidden rounded-md border border-border bg-background text-left"
                            onClick={() => onPreview({ type: "image", url: continuityStartEvidence(continuitySource)!.mediaUrl, title: `${continuitySource.title}实际尾帧` })}
                        >
                            <img className="aspect-video w-full object-cover" src={imagePreviewUrl(continuityStartEvidence(continuitySource)!.mediaUrl, 480)} alt={`${continuitySource.title}实际尾帧`} />
                            <span className="px-2 py-1.5 text-[11px] text-muted-foreground">已人工验收 · {continuitySource.title}</span>
                        </button>
                    </div>
                ) : null}
            </div>
            <div className="mt-1 border-t border-border/70 pt-3" data-drama-shot-supplier-prompt>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-foreground">视频供应商提示词</div>
                    <Button size="small" icon={<RefreshCw className="size-3.5" />} disabled={videoPromptDraft === videoPromptOriginal} onClick={() => setVideoPromptDraft(videoPromptOriginal)}>
                        还原上次
                    </Button>
                    <Button
                        size="small"
                        icon={<Save className="size-3.5" />}
                        disabled={!videoPromptDraft.trim() || videoPromptDraft.trim() === supplierVideoPrompt.trim()}
                        onClick={async () => {
                            updateShot(project.id, episode.id, shot.id, { executionVideoPrompt: videoPromptDraft.trim(), fieldOrigins: { ...(shot.fieldOrigins || {}), executionVideoPrompt: "manual" } });
                            await saveProjectNow(project.id);
                            message.success("视频提示词已保存");
                        }}
                    >
                        保存
                    </Button>
                </div>
                <Input.TextArea className="mt-2" value={videoPromptDraft} onChange={(event) => setVideoPromptDraft(event.target.value)} autoSize={{ minRows: 5, maxRows: 14 }} placeholder="先生成并验收顺序帧，再生成或编辑视频提示词" />
            </div>
        </div>
    );
}

type ShotReferenceAsset = { id: string; label: string; url: string; width?: number; height?: number };
type PromptReferenceBinding = ShotReferenceAsset & { alias: string; purpose: string; alt: string; required: boolean };
type ProductionPromptRow = { shot: DramaShot; references: PromptReferenceBinding[]; basePrompt: string };

function ProductionPromptPreview({ project, rows, onChange }: { project: DramaProject; rows: ProductionPromptRow[]; onChange: (value: { selections: Record<string, string[]>; invalid: boolean }) => void }) {
    const [selections, setSelections] = useState<Record<string, string[]>>(() => Object.fromEntries(rows.map((row) => [row.shot.id, row.references.map((reference) => reference.id)])));
    const invalid = rows.some((row) => (selections[row.shot.id] || []).length > dramaReferenceImageBudget(row.shot.duration));
    useEffect(() => {
        onChange({ selections, invalid });
    }, [invalid, onChange, selections]);
    return (
        <div className="max-h-[60vh] overflow-y-auto pr-1 text-sm">
            <div className="mb-3 grid gap-2 rounded-md border border-border bg-muted/20 p-3 text-xs sm:grid-cols-2">
                <span>清晰度：{project.productionBible?.productionPlan?.video.resolution || "按后台默认"}</span>
                <span>画幅：{project.ratio}</span>
                <span>时长：{rows.map((row) => `${row.shot.duration}s`).join("、")}</span>
                <span>全部图片默认引用，首尾帧与连续性帧固定保留</span>
            </div>
            {rows.map(({ shot, basePrompt, references }) => {
                const selectedIds = selections[shot.id] || [];
                const selectedReferences = references.filter((reference) => selectedIds.includes(reference.id)).map((reference, index) => ({ ...reference, alias: `@图片${index + 1}` }));
                const limit = dramaReferenceImageBudget(shot.duration);
                const prompt = appendDramaImageReferenceBindings(
                    basePrompt,
                    selectedReferences.map((reference) => ({ id: reference.id, label: reference.label, binding: reference.purpose })),
                );
                const overLimit = selectedReferences.length > limit;
                return (
                    <section key={shot.id} className={`mb-3 rounded-md border p-3 last:mb-0 ${overLimit ? "border-red-500" : "border-border"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-semibold">{shot.title || `镜头 ${String(shot.order).padStart(2, "0")}`}</h4>
                            <span className={`text-xs ${overLimit ? "text-red-600" : "text-muted-foreground"}`}>
                                {selectedReferences.length}/{limit} 张 · {shot.duration} 秒 · {shot.storyboardFrameMode === "all_frames" ? "全能帧" : shot.storyboardFrameMode === "first_last" ? "首尾帧" : "单帧"}
                            </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words leading-6 text-muted-foreground">{prompt}</p>
                        {references.length ? (
                            <div className="mt-3 border-t border-border/70 pt-3" data-drama-prompt-reference-gallery>
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="font-medium text-foreground">本次实际引用图片</span>
                                    <span className={overLimit ? "text-red-600" : "text-muted-foreground"}>{overLimit ? `超出 ${selectedReferences.length - limit} 张` : "顺序与供应商请求一致"}</span>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
                                    {references.map((reference) => {
                                        const checked = selectedIds.includes(reference.id);
                                        const alias = selectedReferences.find((item) => item.id === reference.id)?.alias;
                                        return (
                                            <div key={`${reference.id}-${reference.url}`} className={`min-w-0 overflow-hidden rounded-md border bg-background ${checked ? "border-primary" : "border-border opacity-60"}`} data-drama-prompt-reference-item>
                                                <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: reference.width && reference.height ? `${reference.width} / ${reference.height}` : "4 / 3" }}>
                                                    <img className="size-full object-cover" src={imagePreviewUrl(reference.url, 480)} alt={reference.alt} />
                                                    {alias ? <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">{alias}</span> : null}
                                                </div>
                                                <div className="space-y-1 px-2 py-1.5 text-[11px] leading-4">
                                                    <Checkbox
                                                        checked={checked}
                                                        disabled={reference.required}
                                                        onChange={(event) =>
                                                            setSelections((current) => ({
                                                                ...current,
                                                                [shot.id]: event.target.checked ? [...(current[shot.id] || []), reference.id] : (current[shot.id] || []).filter((id) => id !== reference.id),
                                                            }))
                                                        }
                                                    >
                                                        {reference.required ? "必须引用" : "引用此图"}
                                                    </Checkbox>
                                                    <div className="truncate font-medium text-foreground">{reference.label}</div>
                                                    <div className="break-words text-muted-foreground">{reference.purpose}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </section>
                );
            })}
            <p className="mt-3 text-xs text-muted-foreground">未勾选图片会同时从供应商请求和提示词引用块移除；确认后才会创建视频任务并消耗额度。</p>
        </div>
    );
}

function previewVideoReferenceBindings(project: DramaProject, episode: DramaEpisode, shot: DramaShot): PromptReferenceBinding[] {
    const incoming = episode.continuityEdges?.find((edge) => edge.toShotId === shot.id && edge.inheritActualEndFrame);
    const previous = incoming ? episode.shots.find((item) => item.id === incoming.fromShotId) : undefined;
    const tail = previous ? continuityStartEvidence(previous) : undefined;
    const frames = (shot.storyboardFrames || []).filter((frame) => frame.mediaUrl && frame.status === "success" && frame.continuityStatus !== "stale").sort((left, right) => left.sequenceIndex - right.sequenceIndex);
    const frameBindings: PromptReferenceBinding[] = [];
    if (tail) frameBindings.push({ id: `tail-${previous?.id || shot.id}`, alias: "@图片1", label: "上一镜实际尾帧", purpose: "作为当前镜头唯一开场画面", url: tail.mediaUrl, alt: "上一镜实际尾帧", required: true });
    if (shot.storyboardFrameMode === "all_frames") {
        frames.forEach((frame) =>
            frameBindings.push({
                id: frame.id,
                alias: `@图片${frameBindings.length + 1}`,
                label: `顺序帧 ${frame.sequenceIndex}`,
                purpose: `对应 ${frame.sequenceIndex === 1 ? "开始" : frame.sequenceIndex === frames.length ? "结束" : "中间"}阶段的画面依据`,
                url: frame.mediaUrl!,
                width: frame.width,
                height: frame.height,
                alt: `顺序帧 ${frame.sequenceIndex}`,
                required: frame.sequenceIndex === 1 || frame.sequenceIndex === frames.length,
            }),
        );
    } else {
        const start = activeFrameEvidence(shot, "storyboard_start")[0];
        const end = activeFrameEvidence(shot, "storyboard_end")[0];
        for (const frame of [start, end]) {
            if (!frame?.mediaUrl || frameBindings.some((item) => item.url === frame.mediaUrl)) continue;
            frameBindings.push({
                id: frame.id,
                alias: `@图片${frameBindings.length + 1}`,
                label: frame === start ? "本镜首帧" : "本镜尾帧",
                purpose: frame === start ? "锁定视频开场画面" : "锁定视频结束画面",
                url: frame.mediaUrl,
                alt: frame === start ? "本镜首帧" : "本镜尾帧",
                required: true,
            });
        }
    }
    const assets = shotReferenceAssets(project, shot);
    const manifest = shot.framePlan?.referenceManifest || [];
    const fallbackOrder = [shot.sceneId, ...shot.characterIds, ...shot.propIds, ...shot.clueIds, ...(shot.sourceAssetIds || [])];
    const orderedAssets = [...manifest.flatMap((item) => assets.filter((asset) => asset.id === item.assetId)), ...fallbackOrder.flatMap((id) => assets.filter((asset) => asset.id === id)), ...assets].filter(
        (asset, index, all) => all.findIndex((item) => item.id === asset.id) === index,
    );
    orderedAssets.forEach((asset) => {
        const manifestItem = manifest.find((item) => item.assetId === asset.id);
        frameBindings.push({ ...asset, alias: `@图片${frameBindings.length + 1}`, purpose: manifestItem?.purpose || asset.label, alt: asset.label, required: true });
    });
    return frameBindings;
}

function shotReferenceAssets(project: DramaProject, shot: DramaShot): ShotReferenceAsset[] {
    const fixedAssets: Array<{ id: string; label: string; asset: DramaProject["characters"][number] }> = [
        ...project.characters.filter((item) => shot.characterIds.includes(item.id)).map((asset) => ({ id: asset.id, label: `角色 · ${asset.name}`, asset })),
        ...project.scenes.filter((item) => item.id === shot.sceneId).map((asset) => ({ id: asset.id, label: `场景 · ${asset.name}`, asset })),
        ...project.props.filter((item) => shot.propIds.includes(item.id)).map((asset) => ({ id: asset.id, label: `道具 · ${asset.name}`, asset })),
        ...(project.clues || []).filter((item) => shot.clueIds.includes(item.id)).map((asset) => ({ id: asset.id, label: `线索 · ${asset.name}`, asset })),
    ];
    const fixedReferences = fixedAssets.flatMap(({ id, label, asset }) => {
        const reference = approvedAssetReference(asset);
        return reference?.url ? [{ id, label, url: reference.url, width: reference.width, height: reference.height }] : [];
    });
    const sourceReferences = (project.sourceAssets || []).flatMap((asset) => {
        if (asset.type !== "image" || !(shot.sourceAssetIds || []).includes(asset.id)) return [];
        const url = asset.serverUrl || asset.remoteUrl;
        return url ? [{ id: asset.id, label: `来源素材 · ${asset.title}`, url, width: asset.width, height: asset.height }] : [];
    });
    return [...fixedReferences, ...sourceReferences].filter((asset, index, all) => all.findIndex((item) => item.id === asset.id || item.url === asset.url) === index);
}

function shotAssetLabels(project: DramaProject, shot: DramaShot) {
    const labels = [
        ...project.characters.filter((item) => shot.characterIds.includes(item.id)).map((item) => `角色：${item.name}`),
        ...project.scenes.filter((item) => item.id === shot.sceneId).map((item) => `场景：${item.name}`),
        ...project.props.filter((item) => shot.propIds.includes(item.id)).map((item) => `道具：${item.name}`),
        ...(project.clues || []).filter((item) => shot.clueIds.includes(item.id)).map((item) => `线索：${item.name}`),
        ...(project.sourceAssets || []).filter((item) => (shot.sourceAssetIds || []).includes(item.id)).map((item) => `来源素材：${item.title}`),
    ];
    return Array.from(new Set(labels));
}

function shotVoiceSource(project: DramaProject, shot: DramaShot) {
    const speaker = shot.utterances.find((item) => item.speaker)?.speaker;
    const character = project.characters.find((item) => item.id === shot.characterId || item.name === speaker || item.id === shot.voiceIdentityId);
    if (character?.voiceProfile?.voiceId || shot.voiceId) return `角色资产音色：${character?.name || speaker || "当前角色"}`;
    return "旁白/未匹配对白使用全局默认音色";
}

function generationStageStatus(readiness: ReturnType<typeof summarizeDramaGeneration>, renderTask: DramaRenderTask | null): { label: string; description: string; tone: "neutral" | "ready" | "attention" | "running" } {
    if (!readiness.totalShots) return { label: "等待镜头", description: "当前集还没有镜头结构。完成剧本提取与内容审核后，生成任务会在这里集中管理。", tone: "attention" };
    if (renderTask?.status === "success") return { label: "成片已完成", description: "整集合成已经完成，可以预览成片、下载文件或继续导出字幕与剪映草稿。", tone: "ready" };
    if (renderTask && ["pending", "running"].includes(renderTask.status)) return { label: "正在合成", description: "全部镜头已经进入整集合成，后台会继续完成转码、拼接与字幕处理。", tone: "running" };
    if (readiness.activeShotIds.length) return { label: "生产进行中", description: `${readiness.activeShotIds.length} 个镜头正在排队或生成，完成后会自动继续处理下一项。`, tone: "running" };
    if (readiness.failedShotIds.length) return { label: "需要处理", description: `${readiness.failedShotIds.length} 个镜头存在失败项。下方会显示精确原因，并只重试对应镜头。`, tone: "attention" };
    if (readiness.completedVideoCount === readiness.totalShots && !readiness.missingAudioShotIds.length) return { label: "可合成", description: "镜头视频和必需配音已经就绪，下一步可以合成整集成片。", tone: "ready" };
    return { label: "准备生成", description: "先处理生成前检查中的阻塞项，再从唯一主操作启动本集镜头队列。", tone: "neutral" };
}

function buildPrimaryAction({
    episode,
    readiness,
    renderReady,
    audioReady,
    renderTask,
    onStageChange,
    onQueueShots,
    onQueueAudio,
    onCreateRender,
}: {
    episode: DramaEpisode;
    readiness: ReturnType<typeof summarizeDramaGeneration>;
    renderReady: boolean | null;
    audioReady: boolean;
    renderTask: DramaRenderTask | null;
    onStageChange: (stage: DramaProjectStage) => void;
    onQueueShots: (shotIds: string[]) => void;
    onQueueAudio: (shotIds: string[]) => void;
    onCreateRender: () => void;
}) {
    const primaryClass = "!h-11 !w-full !px-4 sm:!h-9 sm:!w-auto";
    if (!readiness.totalShots)
        return (
            <Button type="primary" className={primaryClass} icon={<ArrowRight className="size-4" />} onClick={() => onStageChange("script")}>
                返回剧本并提取结构
            </Button>
        );
    if (episode.reviewStatus !== "visual_ready")
        return (
            <Button type="primary" className={primaryClass} icon={<ArrowRight className="size-4" />} onClick={() => onStageChange("review")}>
                完成内容审核与视觉方案
            </Button>
        );
    if (readiness.activeShotIds.length)
        return (
            <Button type="primary" className={primaryClass} loading disabled>
                正在处理 {readiness.activeShotIds.length} 个镜头
            </Button>
        );
    if (readiness.queueableShotIds.length)
        return (
            <Button type="primary" className={primaryClass} icon={<Play className="size-4" />} onClick={() => onQueueShots(readiness.queueableShotIds)}>
                {readiness.failedShotIds.length ? "重试" : "生成"} {readiness.queueableShotIds.length} 个就绪镜头
            </Button>
        );
    if (readiness.missingPromptShotIds.length || readiness.missingReferenceShotIds.length || readiness.missingBaselineShotIds.length)
        return (
            <Button type="primary" className={primaryClass} icon={<ArrowRight className="size-4" />} onClick={() => onStageChange("storyboard")}>
                处理 {new Set([...readiness.missingPromptShotIds, ...readiness.missingReferenceShotIds, ...readiness.missingBaselineShotIds]).size} 个阻塞镜头
            </Button>
        );
    if (readiness.missingAudioShotIds.length)
        return (
            <Button type="primary" className={primaryClass} icon={<Volume2 className="size-4" />} disabled={!audioReady} title={audioReady ? undefined : "请管理员先在后台设置默认音频模型"} onClick={() => onQueueAudio(readiness.missingAudioShotIds)}>
                {audioReady ? `生成 ${readiness.missingAudioShotIds.length} 条配音` : "等待音频模型配置"}
            </Button>
        );
    if (renderTask && ["pending", "running"].includes(renderTask.status))
        return (
            <Button type="primary" className={primaryClass} loading disabled>
                正在合成整集
            </Button>
        );
    if (renderTask?.result?.url)
        return (
            <Button type="primary" className={primaryClass} icon={<Download className="size-4" />} href={originalMediaDownloadUrl(renderTask.result.url)} download={mediaDownloadFileName(renderTask.id, "video/mp4", renderTask.result.url)}>
                下载整集成片
            </Button>
        );
    if (renderReady === null)
        return (
            <Button type="primary" className={primaryClass} loading disabled>
                检查合成环境
            </Button>
        );
    if (!renderReady)
        return (
            <Button type="primary" className={primaryClass} disabled title="服务器尚未安装 FFmpeg">
                FFmpeg 未就绪
            </Button>
        );
    return (
        <Button type="primary" className={primaryClass} icon={<Film className="size-4" />} onClick={onCreateRender}>
            {renderTask?.status === "error" || renderTask?.status === "cancelled" ? "重新合成整集" : "合成整集"}
        </Button>
    );
}
