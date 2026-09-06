"use client";

import { useEffect, useState } from "react";
import { App, Button, Input } from "antd";
import { Save } from "lucide-react";

import { defaultDramaProductionPlan, normalizeDramaProductionPlan } from "@/lib/drama-production-plan";
import type { DramaProductionPlan } from "@/lib/drama-project-contract";
import { saveDramaEpisodeSettings } from "@/services/api/drama-projects";
import type { DramaEpisode, DramaProject } from "../types";
import { useDramaStore } from "../stores/use-drama-store";

export function DramaEpisodeSettings({ project, episode, embedded = false }: { project: DramaProject; episode: DramaEpisode; embedded?: boolean }) {
    const { message } = App.useApp();
    const replaceProject = useDramaStore((state) => state.replaceProject);
    const [saving, setSaving] = useState(false);
    const [savedLockAt, setSavedLockAt] = useState<string>();
    const [titleDraft, setTitleDraft] = useState(episode.title);
    const [summaryDraft, setSummaryDraft] = useState(project.summary);
    const paragraphCount = episode.script.trim() ? episode.script.split(/\n+/).filter(Boolean).length : 0;
    const characterCount = new Set(episode.shots.flatMap((shot) => shot.characterIds)).size;
    const duration = episode.shots.reduce((total, shot) => total + (Number.isFinite(shot.duration) ? shot.duration : 0), 0);
    const [planDraft, setPlanDraft] = useState<DramaProductionPlan>(() => normalizeDramaProductionPlan(project.productionBible?.productionPlan, defaultDramaProductionPlan("new-project"))!);

    useEffect(() => {
        setPlanDraft(normalizeDramaProductionPlan(project.productionBible?.productionPlan, defaultDramaProductionPlan("new-project"))!);
        setTitleDraft(episode.title);
        setSummaryDraft(project.summary);
        setSavedLockAt(undefined);
    }, [episode.id, episode.title, project.id, project.productionBible?.productionPlan, project.style, project.summary]);

    const saveSettings = async () => {
        const saved = await saveDramaEpisodeSettings(project.id, episode.id, { title: titleDraft, summary: summaryDraft });
        const persistedPlan = normalizeDramaProductionPlan(saved.productionBible?.productionPlan);
        if (!persistedPlan) throw new Error("本集设置保存后未生效，请刷新后重试");
        replaceProject(saved);
        setPlanDraft(persistedPlan);
        setSavedLockAt(persistedPlan.lockedAt);
    };

    return (
        <aside className={`hide-scrollbar min-h-0 min-w-0 overflow-y-auto bg-card ${embedded ? "max-h-[min(620px,calc(100vh-150px))] p-1" : "border-l border-border p-3"}`} data-drama-episode-settings>
            {!embedded ? (
                <>
                    <h3 className="text-sm font-semibold">本集设置</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">生产方案仅由剧本 GPT 锁定</p>
                </>
            ) : null}
            <div className={`${embedded ? "space-y-3" : "mt-4 space-y-4"}`}>
                <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-foreground">本集名称</span>
                    <Input className="!h-8" value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} />
                </label>
                <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-foreground">故事简介</span>
                    <Input.TextArea value={summaryDraft} onChange={(event) => setSummaryDraft(event.target.value)} autoSize={{ minRows: 3, maxRows: 6 }} />
                </label>
                <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">生产方案</span>
                        <span className={`text-[11px] ${savedLockAt || planDraft.lockedAt ? "text-emerald-600" : "text-amber-600"}`}>{savedLockAt || planDraft.lockedAt ? "已锁定" : "待锁定"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                        <span>生成模式：{planDraft.video.mode === "text-to-video" ? "直接生成" : "分镜驱动"}</span>
                        <span>清晰度：{planDraft.video.resolution}</span>
                        <span>每镜：{planDraft.video.shotDuration || 15} 秒</span>
                        <span>帧数：{planDraft.video.framePolicy === "fixed-4" ? "固定 4 帧" : planDraft.video.framePolicy === "fixed-5" ? "固定 5 帧" : "Agent 智能切分"}</span>
                        <span>连续性：{planDraft.continuity.mode === "strict" ? "严格" : "平衡"}</span>
                        <span>视觉风格：{planDraft.visual.visualStyle || "由 Agent 建议"}</span>
                        <span>画风：{planDraft.visual.artStyle || "由 Agent 建议"}</span>
                    </div>
                    <p className="text-[11px] leading-5 text-muted-foreground">视觉参数、每镜时长和帧数策略只在剧本 GPT 中锁定；本处仅展示当前方案。</p>
                </div>
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
                    保存本集信息
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
