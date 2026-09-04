"use client";

import { useEffect, useRef, useState } from "react";
import { App, Button, Empty } from "antd";
import { ArrowRight, GitBranch, History } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { ensureDramaEpisodeCanvas, getLatestDramaProductionRun } from "@/services/api/drama-projects";
import { syncUserPointsFromHeaders } from "@/services/api/points";
import { createFrameEvidence, latestFrameEvidence, supersedeFrameEvidence } from "@/lib/drama-continuity-policy";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { hasActiveDramaVideoPromptRun, useDramaStore } from "../stores/use-drama-store";
import type { DramaContentAnalysis, DramaProject, DramaProjectVersion, DramaProductionPreflightIssue, DramaReviewCompletion, DramaReviewCompletionTask, DramaShot, DramaShotContinuity, DramaVisualAnalysis } from "../types";
import { useDramaAudioQueue } from "./use-drama-audio-queue";
import { DramaAgentPanel } from "./drama-agent-panel";
import { DramaScriptAgentPanel } from "./drama-script-agent-panel";
import { DramaAssetsPanel } from "./drama-assets-panel";
import { DramaStageHeader } from "./drama-editor-elements";
import { DramaGenerationPanel } from "./drama-generation-panel";
import { DramaReviewPanel, missingReviewFieldsForShot } from "./drama-review-panel";
import { DramaStoryboardShotCard } from "./drama-storyboard-shot-card";
import { markDramaCanvasSynced } from "../../canvas/[id]/canvas-drama-navigation";
import { DramaVersionModal } from "./drama-project-modals";
import { applyDramaVisualRunTerminalStep, dramaShotVideoMode, resolveDramaVisualRunSync } from "./drama-shot-generation-utils";
import { DramaEpisodeSidebar, DramaScriptPanel, DramaWorkspaceHeader, type DramaProjectStage } from "./drama-project-sections";

export default function DramaProjectPage() {
    const router = useRouter();
    const projectId = String(useParams<{ id: string }>().id || "");
    const loadProject = useDramaStore((state) => state.loadProject);
    const project = useDramaStore((state) => state.projects.find((item) => item.id === projectId));
    const userId = useUserStore((state) => state.user?.id || "");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    useEffect(() => {
        let active = true;
        setLoading(true);
        setLoadError("");
        void loadProject(projectId)
            .catch((error) => active && setLoadError(error instanceof Error ? error.message : "短剧项目加载失败"))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [loadProject, projectId, userId]);
    if (loading && !project) return <main className="grid h-full place-items-center bg-background text-sm text-muted-foreground">正在加载短剧项目…</main>;
    if (!project)
        return (
            <main className="grid h-full place-items-center bg-background">
                <Empty description={loadError || "短剧项目不存在"}>
                    <Button onClick={() => router.push("/drama")}>返回项目列表</Button>
                </Empty>
            </main>
        );
    return <DramaProjectEditor project={project} />;
}

function DramaProjectEditor({ project }: { project: DramaProject }) {
    const { message, modal } = App.useApp();
    const router = useRouter();
    const updateProject = useDramaStore((state) => state.updateProject);
    const updateEpisode = useDramaStore((state) => state.updateEpisode);
    const updateShot = useDramaStore((state) => state.updateShot);
    const updateAsset = useDramaStore((state) => state.updateAsset);
    const applyContentAnalysis = useDramaStore((state) => state.applyContentAnalysis);
    const applyVisualAnalysis = useDramaStore((state) => state.applyVisualAnalysis);
    const applyReviewCompletion = useDramaStore((state) => state.applyReviewCompletion);
    const replaceShot = useDramaStore((state) => state.replaceShot);
    const saveProjectNow = useDramaStore((state) => state.saveProjectNow);
    const createVersion = useDramaStore((state) => state.createVersion);
    const listVersions = useDramaStore((state) => state.listVersions);
    const restoreVersion = useDramaStore((state) => state.restoreVersion);
    const config = useEffectiveConfig();
    const boundaryFrameTaskRef = useRef("");
    const boundaryFrameAttemptRef = useRef("");
    const visualRunSyncVersionRef = useRef("");
    const [stage, setStage] = useState<DramaProjectStage>("script");
    const [assetsOpen, setAssetsOpen] = useState(false);
    const [episodeNavigatorOpen, setEpisodeNavigatorOpen] = useState(false);
    const [agentOpen, setAgentOpen] = useState(false);
    const [scriptAgentOpen, setScriptAgentOpen] = useState(false);
    const [selectedShotId, setSelectedShotId] = useState<string>();
    const [analyzing, setAnalyzing] = useState(false);
    const [designing, setDesigning] = useState(false);
    const [completingReview, setCompletingReview] = useState(false);
    const [versionsOpen, setVersionsOpen] = useState(false);
    const [versions, setVersions] = useState<DramaProjectVersion[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [expandedStoryboardShotId, setExpandedStoryboardShotId] = useState("");
    const audioReady = Boolean(config.audioModel.trim());
    const fallbackEpisode = project.episodes[0] || {
        id: "",
        title: "",
        script: "",
        outline: "",
        hook: "",
        nextPreview: "",
        sourceRange: "",
        reviewStatus: "draft" as const,
        shots: [],
    };
    const episode = project.episodes.find((item) => item.id === project.activeEpisodeId) || fallbackEpisode;
    const promptOptimizationActive = useDramaStore((state) => hasActiveDramaVideoPromptRun(state.videoPromptRuns, project.id, episode.id));
    const hasEpisode = project.episodes.length > 0;
    const runningVideo = episode.shots.find((shot) => shot.generationStatus === "running" && shot.generationTaskId);
    const boundaryTarget = episode.shots.find((item) => {
        const frames = item.frameEvidence || [];
        return (
            item.generationStatus === "success" &&
            item.videoUrl &&
            !frames.some((frame) => frame.role === "actual_start" && frame.sourceVideoUrl === item.videoUrl && frame.validity !== "superseded" && frame.validity !== "unavailable") &&
            !frames.some((frame) => frame.role === "actual_end" && frame.sourceVideoUrl === item.videoUrl && frame.validity !== "superseded" && frame.validity !== "unavailable")
        );
    });
    const boundaryTargetEvidenceKey = boundaryTarget
        ? (boundaryTarget.frameEvidence || []).map((frame) => `${frame.role}:${frame.sourceVideoUrl || ""}:${frame.validity}`).join("|")
        : "";
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
    const changeStage = (nextStage: DramaProjectStage) => {
        setStage(nextStage);
        setAssetsOpen(false);
    };
    const openAgentForShot = (shot: DramaShot) => {
        setSelectedShotId(shot.id);
        setAgentOpen(true);
    };

    useEffect(() => {
        const media = window.matchMedia("(min-width: 1366px)");
        const update = () => {
            setEpisodeNavigatorOpen(media.matches);
        };
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);
    useEffect(() => {
        setSelectedShotId(undefined);
        setScriptAgentOpen(false);
    }, [episode.id]);
    useDramaAudioQueue(project, episode, config, updateShot, updateAsset);
    const analyzeScript = () => {
        if (!episode.script.trim()) return message.warning("请先填写剧本内容");
        modal.confirm({
            title: "确认使用 AI 整理本集剧本？",
            content: "系统会根据当前剧本重新整理场景、角色、道具和镜头。整理完成后还需要再次确认，才会回填项目数据。",
            okText: "继续整理",
            cancelText: "取消",
            onOk: () => runAnalyzeScript(),
        });
    };
    const runAnalyzeScript = async () => {
        if (!episode.script.trim()) return message.warning("请先填写剧本内容");
        const scriptSnapshot = episode.script.trim();
        setAnalyzing(true);
        try {
            const response = await fetch("/api/drama/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phase: "content", script: episode.script, summary: project.summary, style: project.style }) });
            syncUserPointsFromHeaders(response.headers, "system");
            const payload = (await response.json().catch(() => ({}))) as { data?: DramaContentAnalysis; msg?: string };
            if (!response.ok || !payload.data) throw new Error(payload.msg || "AI 剧本解析失败");
            const analysis = payload.data;
            modal.confirm({
                title: "AI 整理结果待确认",
                content: `将回填 ${analysis.characters.length} 个角色、${analysis.scenes.length} 个场景、${analysis.props.length} 个道具和 ${analysis.shots.length} 个镜头。取消不会修改当前项目。`,
                okText: "确认回填",
                cancelText: "放弃回填",
                onOk: async () => {
                    const currentProject = useDramaStore.getState().projects.find((item) => item.id === project.id);
                    const currentEpisode = currentProject?.episodes.find((item) => item.id === episode.id);
                    if (!currentEpisode || currentEpisode.script.trim() !== scriptSnapshot) {
                        message.warning("剧本在整理期间发生变化，请重新执行 AI 整理");
                        return;
                    }
                    await createVersion(project, "AI 内容解析前");
                    applyContentAnalysis(project.id, episode.id, analysis);
                    setStage("review");
                    message.success(`已回填 ${analysis.characters.length} 个角色、${analysis.scenes.length} 个场景和 ${analysis.shots.length} 个待审核镜头`);
                },
            });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "AI 剧本解析失败");
        } finally {
            setAnalyzing(false);
        }
    };
    const designVisuals = async () => {
        if (!episode.shots.length) return message.warning("请先完成内容解析");
        updateEpisode(project.id, episode.id, { reviewStatus: "approved" });
        setDesigning(true);
        try {
            const response = await fetch("/api/drama/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phase: "visual", summary: project.summary, style: project.style, episode, characters: project.characters, scenes: project.scenes, props: project.props, clues: project.clues, shots: episode.shots }),
            });
            syncUserPointsFromHeaders(response.headers, "system");
            const payload = (await response.json().catch(() => ({}))) as { data?: DramaVisualAnalysis; msg?: string };
            if (!response.ok || !payload.data) throw new Error(payload.msg || "AI 视觉方案生成失败");
            await createVersion(project, "视觉方案生成前");
            applyVisualAnalysis(project.id, episode.id, payload.data);
            setStage("storyboard");
            message.success("已按审核内容生成视觉方案");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "AI 视觉方案生成失败");
        } finally {
            setDesigning(false);
        }
    };
    const completeReview = async (requestedFields?: readonly string[]) => {
        if (!episode.shots.length) {
            message.warning("请先完成内容解析");
            return false;
        }
        const taskId = `review-completion-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
        const startedAt = new Date().toISOString();
        const runningTask: DramaReviewCompletionTask = {
            id: taskId,
            status: "running",
            missingCount: episode.shots.reduce((total, shot) => total + missingReviewFieldsForShot(shot).length, 0),
            completedCount: 0,
            message: "AI 正在补全表演、光色和连续性字段",
            startedAt,
            updatedAt: startedAt,
        };
        setCompletingReview(true);
        updateEpisode(project.id, episode.id, { reviewCompletionTask: runningTask });
        await saveProjectNow(project.id).catch(() => undefined);
        const completionFields = [
            ["performancePlan", "表演规划"],
            ["dialoguePerformance", "对白表演"],
            ["lightingPlan", "色彩灯光"],
            ["continuity", "连续性"],
        ] as const;
        const fieldsToComplete = requestedFields?.length ? completionFields.filter(([field]) => requestedFields.includes(field)) : completionFields;
        let completedCount = 0;
        try {
            await createVersion(project, "AI 审核字段补全前");
            for (const [field, label] of fieldsToComplete) {
                const currentProject = useDramaStore.getState().projects.find((item) => item.id === project.id) || project;
                const currentEpisode = currentProject.episodes.find((item) => item.id === episode.id) || episode;
                const hasMissingField = currentEpisode.shots.some((shot) => missingReviewFieldsForShot(shot).some((item) => item.endsWith(`：${label}`)));
                if (!hasMissingField) continue;
                const response = await fetch("/api/drama/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phase: "review_completion",
                        completionFields: [field],
                        summary: currentProject.summary,
                        style: currentProject.style,
                        episode: currentEpisode,
                        characters: currentProject.characters,
                        scenes: currentProject.scenes,
                        props: currentProject.props,
                        clues: currentProject.clues,
                        shots: currentEpisode.shots,
                    }),
                });
                syncUserPointsFromHeaders(response.headers, "system");
                const payload = (await response.json().catch(() => ({}))) as { data?: DramaReviewCompletion; msg?: string };
                if (!response.ok || !payload.data) throw new Error(`${label}补全失败：${payload.msg || "AI 未返回可回填内容"}`);
                applyReviewCompletion(project.id, episode.id, payload.data);
                const nextProject = useDramaStore.getState().projects.find((item) => item.id === project.id) || currentProject;
                const nextEpisode = nextProject.episodes.find((item) => item.id === episode.id) || currentEpisode;
                completedCount += Math.max(
                    0,
                    currentEpisode.shots.reduce((total, shot) => total + missingReviewFieldsForShot(shot).filter((item) => item.endsWith(`：${label}`)).length, 0) -
                        nextEpisode.shots.reduce((total, shot) => total + missingReviewFieldsForShot(shot).filter((item) => item.endsWith(`：${label}`)).length, 0),
                );
                updateEpisode(project.id, episode.id, { reviewCompletionTask: { ...runningTask, completedCount, message: `已回填 ${completedCount} 项，正在处理${label}`, updatedAt: new Date().toISOString() } });
                await saveProjectNow(project.id);
            }
            const completedAt = new Date().toISOString();
            updateEpisode(project.id, episode.id, { reviewCompletionTask: { ...runningTask, status: "success", completedCount, message: `已回填 ${completedCount} 项缺失内容`, updatedAt: completedAt, completedAt } });
            await saveProjectNow(project.id);
            message.success(`已回填 ${completedCount} 项缺失内容`);
            return true;
        } catch (error) {
            const failedAt = new Date().toISOString();
            updateEpisode(project.id, episode.id, {
                reviewCompletionTask: {
                    ...runningTask,
                    status: "error",
                    error: error instanceof Error ? error.message : "AI 审核字段补全失败",
                    updatedAt: failedAt,
                    completedAt: failedAt,
                },
            });
            await saveProjectNow(project.id).catch(() => undefined);
            message.error(error instanceof Error ? error.message : "AI 审核字段补全失败");
            return false;
        } finally {
            setCompletingReview(false);
        }
    };
    const completeShotReview = async (shotId: string) => {
        const currentProject = useDramaStore.getState().projects.find((item) => item.id === project.id) || project;
        const currentEpisode = currentProject.episodes.find((item) => item.id === episode.id) || episode;
        const shot = currentEpisode.shots.find((item) => item.id === shotId);
        if (!shot) return false;
        try {
            const response = await fetch("/api/drama/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phase: "review_completion",
                    forceShotIds: [shot.id],
                    completionFields: ["performancePlan", "dialoguePerformance", "lightingPlan", "continuity", "entryState", "exitState"],
                    summary: currentProject.summary,
                    style: currentProject.style,
                    episode: currentEpisode,
                    characters: currentProject.characters,
                    scenes: currentProject.scenes,
                    props: currentProject.props,
                    clues: currentProject.clues,
                    shots: [shot],
                    instruction: "只补齐当前镜头缺失或不完整的审核参数，保留已有字段和镜头事实，输出可直接执行的具体内容。",
                }),
            });
            syncUserPointsFromHeaders(response.headers, "system");
            const payload = (await response.json().catch(() => ({}))) as { data?: DramaReviewCompletion; msg?: string };
            if (!response.ok || !payload.data) throw new Error(payload.msg || "镜头智能补全失败");
            await createVersion(currentProject, `镜头 ${shot.title || shot.order} 智能补全前`);
            applyReviewCompletion(currentProject.id, currentEpisode.id, payload.data);
            const completedProject = useDramaStore.getState().projects.find((item) => item.id === currentProject.id) || currentProject;
            const completedEpisode = completedProject.episodes.find((item) => item.id === currentEpisode.id) || currentEpisode;
            const completedShot = completedEpisode.shots.find((item) => item.id === shot.id) || shot;
            const continuity: DramaShotContinuity = completedShot.continuity || {
                shotSize: "",
                cameraAngle: "",
                composition: "",
                characterBlocking: "",
                gazeDirection: "",
                actionStart: "",
                actionEnd: "",
                screenDirection: "",
                axisRule: "",
                continuityNotes: "",
            };
            if (!continuity.shotSize || !continuity.cameraAngle || !continuity.composition) {
                updateShot(completedProject.id, completedEpisode.id, completedShot.id, {
                    continuity: {
                        ...continuity,
                        shotSize: continuity.shotSize || "中景",
                        cameraAngle: continuity.cameraAngle || "平视",
                        composition: continuity.composition || "主体居中，保留场景环境层次",
                    },
                });
            }
            await saveProjectNow(currentProject.id);
            message.success(`${shot.title || `镜头 ${shot.order}`} 已完成智能补全`);
            return true;
        } catch (error) {
            message.error(error instanceof Error ? error.message : "镜头智能补全失败");
            return false;
        }
    };
    const autoFixGenerationBlockers = async (issues: DramaProductionPreflightIssue[]) => {
        const shotIds = Array.from(new Set(issues.map((issue) => issue.shotId).filter((id): id is string => Boolean(id))));
        let fixedCount = 0;
        for (const shotId of shotIds) if (await completeShotReview(shotId)) fixedCount += 1;
        const assetBlocked = issues.some((issue) => ["CHARACTER_ANCHOR", "LOCATION_ANCHOR", "PROP_ANCHOR", "CHARACTER_REFERENCE", "LOCATION_REFERENCE", "PROP_REFERENCE", "CLUE_REFERENCE", "SERIES_BIBLE"].includes(issue.code));
        if (assetBlocked) {
            setAssetsOpen(true);
            message.info(fixedCount ? "Agent 已补全镜头参数；请在项目资产中确认基准图或系列圣经后继续。" : "这些阻断项需要在项目资产中确认基准图或系列圣经。已为你打开维护入口。");
        }
        return fixedCount > 0;
    };
    const openVersions = async () => {
        setVersionsOpen(true);
        setVersionsLoading(true);
        try {
            setVersions(await listVersions(project.id));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "版本记录加载失败");
        } finally {
            setVersionsLoading(false);
        }
    };
    const restore = async (version: DramaProjectVersion) => {
        try {
            await restoreVersion(project.id, version.id);
            setVersionsOpen(false);
            setStage("review");
            message.success(`已恢复到版本 ${version.version}`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "版本恢复失败");
        }
    };
    useEffect(() => {
        if (promptOptimizationActive) return;
        if (stage === "generate" && !assetsOpen) return;
        let active = true;
        let syncing = false;
        let timer: number | undefined;
        const syncVisualRun = async () => {
            if (syncing) return;
            syncing = true;
            let shouldContinue = false;
            try {
                const { run } = await getLatestDramaProductionRun(project.id, episode.id, "visual");
                if (!active || !run) return;
                const currentProject = useDramaStore.getState().projects.find((item) => item.id === project.id);
                if (!currentProject) return;
                const decision = resolveDramaVisualRunSync(currentProject, episode.id, run);
                shouldContinue = decision.shouldContinue;
                const nextEpisode = decision.project.episodes.find((item) => item.id === episode.id);
                const currentEpisode = currentProject.episodes.find((item) => item.id === episode.id);
                if (currentEpisode && nextEpisode) {
                    for (const currentShot of currentEpisode.shots) {
                        let nextShot = nextEpisode.shots.find((item) => item.id === currentShot.id) || currentShot;
                        for (const step of run.steps.filter((item) => item.shotId === currentShot.id)) nextShot = applyDramaVisualRunTerminalStep(nextShot, step);
                        if (JSON.stringify(nextShot) !== JSON.stringify(currentShot)) replaceShot(project.id, episode.id, currentShot.id, nextShot);
                    }
                }
                if (decision.shouldReload && run.updatedAt !== visualRunSyncVersionRef.current) visualRunSyncVersionRef.current = run.updatedAt;
            } catch {
                // A later sync pass will surface the persisted task state.
            } finally {
                syncing = false;
                if (active && shouldContinue) timer = window.setTimeout(() => void syncVisualRun(), 2500);
            }
        };
        void syncVisualRun();
        return () => {
            active = false;
            if (timer) window.clearTimeout(timer);
        };
    }, [assetsOpen, episode.id, project.id, promptOptimizationActive, replaceShot, stage]);

    useEffect(() => {
        const running = runningVideo;
        if (!running) return;
        const timer = window.setInterval(async () => {
            const response = await fetch(`/api/video-tasks/${encodeURIComponent(running.generationTaskId!)}`, { cache: "no-store" });
            syncUserPointsFromHeaders(response.headers, "system");
            const payload = (await response.json().catch(() => ({}))) as { task?: { status?: string; result?: { url?: string }; error?: string }; error?: string };
            if (!response.ok) return updateShot(project.id, episode.id, running.id, { generationStatus: "error", generationError: payload.error || "视频任务查询失败" });
            if (payload.task?.status === "success")
                updateShot(project.id, episode.id, running.id, {
                    generationStatus: "success",
                    videoUrl: payload.task.result?.url,
                    generationError: undefined,
                    ...(running.audioMode === "voiceover" && (running.subtitle || running.dialogue).trim() && audioReady ? { audioStatus: "queued" as const, audioError: undefined } : {}),
                    frameEvidence: supersedeFrameEvidence(running.frameEvidence, "当前镜头视频已重新生成"),
                    actualStartFrameUrl: undefined,
                    actualEndFrameUrl: undefined,
                    actualFrameVideoUrl: undefined,
                });
            if (payload.task?.status === "error" || payload.task?.status === "cancelled") updateShot(project.id, episode.id, running.id, { generationStatus: payload.task.status, generationError: payload.task.error });
        }, 2500);
        return () => window.clearInterval(timer);
    }, [audioReady, episode.id, project.id, runningVideo?.audioMode, runningVideo?.dialogue, runningVideo?.generationTaskId, runningVideo?.id, runningVideo?.subtitle, updateShot]);

    useEffect(() => {
        const shot = boundaryTarget;
        const attemptKey = shot?.videoUrl ? `${shot.id}:${shot.videoUrl}` : "";
        if (!shot || boundaryFrameTaskRef.current || boundaryFrameAttemptRef.current === attemptKey) return;
        boundaryFrameTaskRef.current = shot.id;
        boundaryFrameAttemptRef.current = attemptKey;
        void fetch("/api/drama/boundary-frames", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: project.id, episodeId: episode.id, shotId: shot.id, videoUrl: shot.videoUrl }),
        })
            .then(async (response) => {
                const payload = (await response.json().catch(() => ({}))) as { data?: { startFrameUrl?: string; endFrameUrl?: string; sourceVideoUrl?: string }; msg?: string };
                if (!response.ok || !payload.data?.startFrameUrl || !payload.data.endFrameUrl) throw new Error(payload.msg || "镜头实际首尾帧提取失败");
                updateShot(project.id, episode.id, shot.id, {
                    frameEvidence: [
                        ...(shot.frameEvidence || []).filter((frame) => frame.sourceVideoUrl !== (payload.data?.sourceVideoUrl || shot.videoUrl)),
                        createFrameEvidence({ role: "actual_start", source: "video_extraction", mediaUrl: payload.data.startFrameUrl, sourceShotId: shot.id, sourceVideoUrl: payload.data.sourceVideoUrl || shot.videoUrl, validity: "candidate" }),
                        createFrameEvidence({ role: "actual_end", source: "video_extraction", mediaUrl: payload.data.endFrameUrl, sourceShotId: shot.id, sourceVideoUrl: payload.data.sourceVideoUrl || shot.videoUrl, validity: "candidate" }),
                    ],
                    actualStartFrameUrl: payload.data.startFrameUrl,
                    actualEndFrameUrl: payload.data.endFrameUrl,
                    actualFrameVideoUrl: payload.data.sourceVideoUrl || shot.videoUrl,
                    continuityStatus: "needs_review",
                    continuityError: undefined,
                });
            })
            .catch((error) => updateShot(project.id, episode.id, shot.id, { continuityStatus: "blocked", continuityError: error instanceof Error ? error.message : "镜头实际首尾帧提取失败" }))
            .finally(() => {
                boundaryFrameTaskRef.current = "";
            });
    }, [boundaryTarget?.id, boundaryTarget?.videoUrl, boundaryTargetEvidenceKey, episode.id, project.id, updateShot]);

    return hasEpisode ? (
        <main className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground" data-drama-workspace aria-label="短剧制作工作区">
            <DramaWorkspaceHeader
                project={project}
                episode={episode}
                stage={stage}
                assetsOpen={assetsOpen}
                episodeNavigatorOpen={episodeNavigatorOpen}
                agentOpen={agentOpen}
                onStageChange={changeStage}
                onOpenAssets={() => {
                    setAssetsOpen(true);
                    setAgentOpen(false);
                    setEpisodeNavigatorOpen(false);
                }}
                onCloseAssets={() => setAssetsOpen(false)}
                onEpisodeNavigatorOpenChange={setEpisodeNavigatorOpen}
                onToggleAgent={() => {
                    setScriptAgentOpen(false);
                    setAgentOpen((open) => !open);
                }}
                onOpenVersions={() => void openVersions()}
            />
            <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden" data-drama-workspace-body>
                <DramaEpisodeSidebar project={project} episode={episode} open={episodeNavigatorOpen && !assetsOpen} onOpenChange={setEpisodeNavigatorOpen} onStageChange={changeStage} />
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col" data-drama-production-surface>
                    <div className={`min-h-0 min-w-0 flex-1 ${!assetsOpen && stage === "script" ? "overflow-hidden" : "overflow-y-auto"}`} data-drama-production-scroll>
                        <section
                            className={`mx-auto flex min-w-0 flex-col px-3 py-3 ${stage === "script" ? "h-full max-w-none overflow-hidden min-[1366px]:px-3 min-[1366px]:pb-3 min-[1366px]:pt-3" : "min-h-full max-w-[1440px] sm:px-5 sm:py-4"}`}
                            data-drama-stage={assetsOpen ? "assets" : stage}
                        >
                            {assetsOpen ? <DramaAssetsPanel project={project} episode={episode} /> : null}

                            {!assetsOpen && stage === "script" ? (
                                <DramaScriptPanel
                                    project={project}
                                    episode={episode}
                                    analyzing={analyzing}
                                    onAnalyze={() => void analyzeScript()}
                                    onStageChange={changeStage}
                                    selectedShotId={selectedShotId}
                                    onSelectedShotChange={setSelectedShotId}
                                    onOpenScriptAgent={() => {
                                        setAgentOpen(false);
                                        setScriptAgentOpen(true);
                                    }}
                                />
                            ) : null}

                            {!assetsOpen && stage === "review" ? <DramaReviewPanel project={project} episode={episode} designing={designing} onDesignVisuals={() => void designVisuals()} onStageChange={changeStage} /> : null}

                            {!assetsOpen && stage === "storyboard" ? (
                                <div>
                                    <DramaStageHeader
                                        step="03"
                                        title="分镜编辑"
                                        description="精调画面、镜头运动、生成方式和配音策略；完成后进入统一镜头生产队列。"
                                        status={!episode.shots.length ? "等待镜头" : episode.shots.every((shot) => shot.videoPrompt.trim() && (dramaShotVideoMode(project, shot) !== "storyboard" || shot.imagePrompt.trim())) ? "配置就绪" : "需要补充"}
                                        tone={!episode.shots.length ? "attention" : episode.shots.every((shot) => shot.videoPrompt.trim() && (dramaShotVideoMode(project, shot) !== "storyboard" || shot.imagePrompt.trim())) ? "ready" : "attention"}
                                        metrics={
                                            episode.shots.length
                                                ? [
                                                      { label: "镜头", value: episode.shots.length },
                                                      { label: "总时长", value: `${episode.shots.reduce((total, shot) => total + shot.duration, 0)} 秒` },
                                                      { label: "分镜驱动", value: episode.shots.filter((shot) => dramaShotVideoMode(project, shot) === "storyboard").length },
                                                  ]
                                                : []
                                        }
                                        action={
                                            <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row">
                                                <Button
                                                    className="!h-9 !w-full sm:!w-auto"
                                                    icon={<GitBranch className="size-4" />}
                                                    disabled={!episode.shots.length}
                                                    onMouseEnter={prefetchEpisodeCanvas}
                                                    onFocus={prefetchEpisodeCanvas}
                                                    onPointerDown={prefetchEpisodeCanvas}
                                                    onClick={() => void openEpisodeCanvas()}
                                                >
                                                    打开本集画布
                                                </Button>
                                                <Button
                                                    type="primary"
                                                    className="!h-9 !w-full sm:!w-auto"
                                                    icon={<ArrowRight className="size-4" />}
                                                    disabled={!episode.shots.length || episode.reviewStatus !== "visual_ready"}
                                                    onClick={() => setStage("generate")}
                                                >
                                                    进入镜头生成
                                                </Button>
                                            </div>
                                        }
                                    />
                                    {episode.shots.length ? (
                                        <div className="mt-3 grid min-w-0 items-start gap-3 xl:grid-cols-2">
                                            {episode.shots.map((shot) => (
                                                <DramaStoryboardShotCard
                                                    key={shot.id}
                                                    project={project}
                                                    episode={episode}
                                                    shot={shot}
                                                    expanded={expandedStoryboardShotId === shot.id}
                                                    onToggle={() => setExpandedStoryboardShotId((current) => (current === shot.id ? "" : shot.id))}
                                                    onPrefetchCanvas={prefetchEpisodeCanvas}
                                                    onOpenCanvas={() => void openEpisodeCanvas()}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="mt-2.5 flex min-h-14 items-center rounded-lg border border-dashed border-border bg-card/25 px-3 py-2.5">
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-medium">还没有可编辑的分镜</h3>
                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">先从剧本提取内容结构，并在内容审核阶段确认镜头事实与视觉方案。</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            {!assetsOpen && stage === "generate" ? (
                                <DramaGenerationPanel
                                    project={project}
                                    episode={episode}
                                    onStageChange={changeStage}
                                    onOpenAssets={() => setAssetsOpen(true)}
                                    onOpenAgentForShot={openAgentForShot}
                                    onCompleteShotReview={completeShotReview}
                                    onAutoFixPreflight={autoFixGenerationBlockers}
                                />
                            ) : null}
                        </section>
                    </div>
                </div>
                <DramaAgentPanel
                    project={project}
                    episode={episode}
                    stage={stage}
                    selectedShotId={selectedShotId}
                    open={agentOpen}
                    onOpenChange={setAgentOpen}
                    onConversationChange={(creativeConversationId) => updateProject(project.id, { creativeConversationId })}
                />
                <DramaScriptAgentPanel project={project} episode={episode} open={scriptAgentOpen} onOpenChange={setScriptAgentOpen} />
            </div>
            {stage === "script" ? (
                <DramaScriptGlobalBar
                    project={project}
                    episode={episode}
                    onSave={() => createVersion(project, "手动保存版本")}
                    onContinue={() => {
                        if (!episode.shots.length) return void analyzeScript();
                        if (episode.reviewStatus === "draft") updateEpisode(project.id, episode.id, { reviewStatus: "content_review" });
                        setStage("review");
                    }}
                    analyzing={analyzing}
                    episodeNavigatorOpen={episodeNavigatorOpen}
                />
            ) : null}
            <DramaVersionModal
                open={versionsOpen}
                loading={versionsLoading}
                versions={versions}
                onClose={() => setVersionsOpen(false)}
                onSave={() => void createVersion(project, "手动保存版本").then(() => openVersions())}
                onRestore={(version) => void restore(version)}
            />
        </main>
    ) : (
        <main className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
            <div className="grid flex-1 place-items-center p-6">
                <Empty description="当前短剧项目还没有剧集">
                    <Button onClick={() => router.push("/drama")}>返回项目列表</Button>
                </Empty>
            </div>
        </main>
    );
}

function DramaScriptGlobalBar({
    project,
    episode,
    onSave,
    onContinue,
    analyzing,
    episodeNavigatorOpen,
}: {
    project: DramaProject;
    episode: DramaProject["episodes"][number];
    onSave: () => Promise<void>;
    onContinue: () => void;
    analyzing: boolean;
    episodeNavigatorOpen: boolean;
}) {
    const { message } = App.useApp();
    const saveState = useDramaStore((state) => state.saveStateByProject[project.id]);
    const [savingVersion, setSavingVersion] = useState(false);
    const savedLabel =
        saveState?.status === "saving"
            ? "保存中…"
            : saveState?.status === "error"
              ? "保存失败"
              : saveState?.savedAt
                ? `最近保存 ${new Date(saveState.savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : `最近保存 ${new Date(project.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    return (
        <footer className={`flex h-[60px] shrink-0 items-center justify-between gap-2 border-t border-border bg-card px-3 sm:gap-3 sm:px-5 ${episodeNavigatorOpen ? "min-[1366px]:!pl-[210px]" : ""}`} data-drama-script-global-bar>
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span className={`size-2 shrink-0 rounded-full ${saveState?.status === "error" ? "bg-rose-500" : saveState?.status === "saving" ? "bg-amber-500" : "bg-emerald-500"}`} />
                <span className="hidden sm:inline" title={savedLabel}>
                    {saveState?.status === "saving" ? "正在自动保存" : saveState?.status === "error" ? "自动保存失败" : "自动保存已开启"}
                </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <Button
                    className="!h-10 !px-3 sm:!px-5"
                    loading={savingVersion}
                    onClick={() => {
                        setSavingVersion(true);
                        void onSave()
                            .then(() => message.success("草稿版本已保存"))
                            .catch((error) => message.error(error instanceof Error ? error.message : "草稿保存失败"))
                            .finally(() => setSavingVersion(false));
                    }}
                >
                    <span className="sm:hidden">保存</span>
                    <span className="hidden sm:inline">保存草稿</span>
                </Button>
                <Button
                    type="primary"
                    className="!h-10 !px-3 enabled:!border-violet-600 enabled:!bg-violet-600 enabled:!text-white enabled:hover:!border-violet-500 enabled:hover:!bg-violet-500 dark:enabled:!border-violet-400 dark:enabled:!bg-violet-400 dark:enabled:!text-violet-950 sm:!px-6"
                    icon={<ArrowRight className="size-4" />}
                    disabled={!episode.script.trim()}
                    loading={analyzing}
                    onClick={onContinue}
                >
                    <span className="sm:hidden">进入内容审核</span>
                    <span className="hidden sm:inline">完成剧本，进入内容审核</span>
                </Button>
            </div>
        </footer>
    );
}
