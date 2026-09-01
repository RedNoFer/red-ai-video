"use client";

import { useEffect, useState } from "react";
import { App, Button, Input, Select } from "antd";
import { Save } from "lucide-react";

import { DRAMA_STYLE_NAME } from "@/lib/drama-style";
import { defaultDramaProductionPlan, DRAMA_SHOT_DURATION_OPTIONS, DRAMA_VIDEO_RESOLUTION_OPTIONS, normalizeDramaProductionPlan } from "@/lib/drama-production-plan";
import type { DramaProductionPlan } from "@/lib/drama-project-contract";
import type { DramaEpisode, DramaProject } from "../types";
import { useDramaStore } from "../stores/use-drama-store";

export function DramaEpisodeSettings({ project, episode, embedded = false }: { project: DramaProject; episode: DramaEpisode; embedded?: boolean }) {
    const { message } = App.useApp();
    const updateProject = useDramaStore((state) => state.updateProject);
    const updateEpisode = useDramaStore((state) => state.updateEpisode);
    const saveProjectNow = useDramaStore((state) => state.saveProjectNow);
    const [saving, setSaving] = useState(false);
    const [savedLockAt, setSavedLockAt] = useState<string>();
    const paragraphCount = episode.script.trim() ? episode.script.split(/\n+/).filter(Boolean).length : 0;
    const characterCount = new Set(episode.shots.flatMap((shot) => shot.characterIds)).size;
    const duration = episode.shots.reduce((total, shot) => total + (Number.isFinite(shot.duration) ? shot.duration : 0), 0);
    const [planDraft, setPlanDraft] = useState<DramaProductionPlan>(() => normalizeDramaProductionPlan(project.productionBible?.productionPlan, defaultDramaProductionPlan("new-project"))!);
    useEffect(() => {
        setPlanDraft(normalizeDramaProductionPlan(project.productionBible?.productionPlan, defaultDramaProductionPlan("new-project"))!);
        setSavedLockAt(undefined);
    }, [project.id, episode.id]);
    const productionPlan = planDraft;
    const updateProductionPlan = (patch: Partial<DramaProductionPlan["video"]>) => {
        setSavedLockAt(undefined);
        const nextPlan = { ...productionPlan, video: { ...productionPlan.video, ...patch }, source: "manual" as const, lockedAt: undefined };
        setPlanDraft(nextPlan);
        updateProject(project.id, {
            defaultVideoMode: nextPlan.video.mode === "text-to-video" ? "direct" : "storyboard",
            productionBible: {
                ...(project.productionBible || {}),
                language: project.productionBible?.language || "zh-CN",
                ratio: project.productionBible?.ratio || project.ratio,
                visualStyle: project.productionBible?.visualStyle || project.style,
                continuityMode: project.productionBible?.continuityMode || "strict",
                productionPlan: nextPlan,
            },
        });
    };
    const saveSettings = async () => {
        const lockedAt = new Date().toISOString();
        const lockedPlan = { ...planDraft, lockedAt, source: "manual" as const };
        const saved = await saveProjectNow(project.id, (current) => ({
            ...current,
            defaultVideoMode: lockedPlan.video.mode === "text-to-video" ? "direct" : "storyboard",
            productionBible: {
                ...(current.productionBible || {}),
                language: current.productionBible?.language || "zh-CN",
                ratio: current.productionBible?.ratio || current.ratio,
                visualStyle: current.productionBible?.visualStyle || current.style,
                continuityMode: current.productionBible?.continuityMode || "strict",
                productionPlan: lockedPlan,
            },
        }));
        const persistedPlan = normalizeDramaProductionPlan(saved.productionBible?.productionPlan);
        if (!persistedPlan?.lockedAt || persistedPlan.video.resolution !== lockedPlan.video.resolution) throw new Error("本集生产方案保存后未生效，请刷新后重试");
        setPlanDraft(persistedPlan);
        setSavedLockAt(persistedPlan.lockedAt);
    };
    return (
        <aside className={`hide-scrollbar min-h-0 min-w-0 overflow-y-auto bg-card ${embedded ? "max-h-[min(620px,calc(100vh-150px))] p-1" : "border-l border-border p-3"}`} data-drama-episode-settings>
            {!embedded ? (
                <>
                    <h3 className="text-sm font-semibold">本集设置</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">设置会自动保存到当前项目</p>
                </>
            ) : null}
            <div className={`${embedded ? "space-y-3" : "mt-4 space-y-4"}`}>
                <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-foreground">本集名称</span>
                    <Input className="!h-8" value={episode.title} onChange={(event) => updateEpisode(project.id, episode.id, { title: event.target.value })} />
                </label>
                <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-foreground">故事简介</span>
                    <Input.TextArea value={project.summary} onChange={(event) => updateProject(project.id, { summary: event.target.value })} autoSize={{ minRows: 3, maxRows: 6 }} />
                </label>
                <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-foreground">视觉风格</span>
                    <Input className="!h-8" value={project.style} placeholder={`例如：${DRAMA_STYLE_NAME}`} onChange={(event) => updateProject(project.id, { style: event.target.value })} />
                </label>
                <div className="space-y-1.5">
                    <span className="text-xs font-medium text-foreground">视频生产模式</span>
                    <div className="min-w-0">
                        <Select
                            className="w-full"
                            value={project.defaultVideoMode === "reference" ? "storyboard" : project.defaultVideoMode}
                            options={[
                                { label: "分镜驱动", value: "storyboard" },
                                { label: "直接生成", value: "direct" },
                            ]}
                            onChange={(value) => updateProductionPlan({ mode: workflowPlanMode(value as DramaProject["defaultVideoMode"]) })}
                        />
                    </div>
                </div>
                {productionPlan ? (
                    <div className="space-y-2 border-t border-border pt-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">生产方案</span>
                            <span className={`text-[11px] ${savedLockAt || productionPlan.lockedAt ? "text-emerald-600" : "text-amber-600"}`}>{savedLockAt || productionPlan.lockedAt ? "已锁定" : "待锁定"}</span>
                        </div>
                        <Select
                            className="w-full"
                            value={workflowProductionPlanMode(productionPlan.video.mode)}
                            options={[
                                { label: "分镜驱动", value: "storyboard" },
                                { label: "直接生成", value: "text-to-video" },
                            ]}
                            onChange={(mode) => updateProductionPlan({ mode })}
                        />
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                            <span>{workflowProductionPlanMode(productionPlan.video.mode) === "storyboard" ? "输入：分镜帧 + 资产参考图" : "输入：文字提示词"}</span>
                            <label className="flex items-center gap-1">
                                <span>清晰度：</span>
                                <Select
                                    size="small"
                                    className="min-w-20"
                                    value={productionPlan.video.resolution}
                                    options={DRAMA_VIDEO_RESOLUTION_OPTIONS.map((value) => ({ label: value, value }))}
                                    onChange={(resolution) => updateProductionPlan({ resolution })}
                                />
                            </label>
                            <label className="flex items-center gap-1">
                                <span>每镜：</span>
                                <Select
                                    size="small"
                                    className="min-w-20"
                                    value={productionPlan.video.shotDuration || 15}
                                    options={DRAMA_SHOT_DURATION_OPTIONS.map((value) => ({ label: `${value}s`, value }))}
                                    onChange={(shotDuration: 15 | 20 | 30) => updateProductionPlan({ shotDuration })}
                                />
                            </label>
                            <label className="flex items-center gap-1">
                                <span>帧数：</span>
                                <Select
                                    size="small"
                                    className="min-w-20"
                                    value={productionPlan.video.frameCount || 5}
                                    options={Array.from({ length: 9 }, (_, index) => ({ label: `${index + 1} 帧`, value: index + 1 }))}
                                    onChange={(frameCount) => updateProductionPlan({ frameCount })}
                                />
                            </label>
                            <span>连续性：{productionPlan.continuity.mode === "strict" ? "严格" : "平衡"}</span>
                        </div>
                    </div>
                ) : null}
            </div>
            <div className="mt-4 border-t border-border pt-3" data-drama-episode-overview>
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold">本集概况</h4>
                    <span className="text-[10px] text-muted-foreground">当前数据</span>
                </div>
                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <Stat label="字数" value={episode.script.length} />
                    <Stat label="段落" value={paragraphCount} />
                    <Stat label="场景 / 镜头" value={episode.shots.length} />
                    <Stat label="角色" value={characterCount} />
                    {duration > 0 ? <Stat label="预估时长" value={`${duration} 秒`} /> : null}
                </dl>
            </div>
            <div className="mt-4 border-t border-border pt-3">
                <Button
                    block
                    type="primary"
                    icon={<Save className="size-3.5" />}
                    loading={saving}
                    onClick={() => {
                        setSaving(true);
                        void saveSettings()
                            .then(() => message.success("本集设置已保存"))
                            .catch((error) => message.error(error instanceof Error ? error.message : "本集设置保存失败"))
                            .finally(() => setSaving(false));
                    }}
                >
                    锁定并保存设置
                </Button>
            </div>
        </aside>
    );
}

function Stat({ label, value }: { label: string; value: string | number }) {
    return (
        <div>
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{value}</dd>
        </div>
    );
}

function workflowPlanMode(mode: DramaProject["defaultVideoMode"]): DramaProductionPlan["video"]["mode"] {
    return mode === "direct" ? "text-to-video" : "storyboard";
}

function workflowProductionPlanMode(mode: DramaProductionPlan["video"]["mode"]): "storyboard" | "text-to-video" {
    return mode === "text-to-video" ? "text-to-video" : "storyboard";
}
