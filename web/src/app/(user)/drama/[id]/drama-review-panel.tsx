"use client";

import { Button, Input, InputNumber, Modal, Segmented, Tag } from "antd";
import { ArrowLeft, Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import type { DramaEpisode, DramaProject } from "@/lib/drama-project-contract";
import { useDramaStore } from "../stores/use-drama-store";
import { DramaStageHeader } from "./drama-editor-elements";
import type { DramaProjectStage } from "./drama-project-sections";
import { DramaShotDialogueEditor } from "./drama-shot-dialogue-editor";

export function DramaReviewPanel({ project, episode, onDesignVisuals, designing, onStageChange }: { project: DramaProject; episode: DramaEpisode; onDesignVisuals: () => void; designing: boolean; onStageChange: (stage: DramaProjectStage) => void }) {
    const updateEpisode = useDramaStore((state) => state.updateEpisode);
    const updateShot = useDramaStore((state) => state.updateShot);
    const [episodeInfoOpen, setEpisodeInfoOpen] = useState(false);
    const [view, setView] = useState<"content" | "production" | "continuity" | "package">("content");
    const [expandedShotIds, setExpandedShotIds] = useState<Set<string>>(() => new Set(episode.shots.slice(0, 1).map((shot) => shot.id)));
    useEffect(() => {
        setExpandedShotIds(new Set(episode.shots.slice(0, 1).map((shot) => shot.id)));
    }, [episode.id]);
    const updateContentShot = (shotId: string, patch: Parameters<typeof updateShot>[3]) => {
        updateShot(project.id, episode.id, shotId, patch);
        if (episode.reviewStatus !== "content_review") updateEpisode(project.id, episode.id, { reviewStatus: "content_review" });
    };
    const toggleShot = (shotId: string) => {
        setExpandedShotIds((current) => {
            const next = new Set(current);
            if (next.has(shotId)) next.delete(shotId);
            else next.add(shotId);
            return next;
        });
    };
    const totalDuration = episode.shots.reduce((total, shot) => total + shot.duration, 0);
    const dialogueCount = episode.shots.reduce((total, shot) => total + (shot.utterances.filter((item) => item.type === "dialogue").length || shot.dialogue.split(/\n+/).filter((line) => line.trim()).length), 0);
    const hasPackageVisualPlan = episode.reviewStatus === "visual_ready" && episode.shots.every((shot) => shot.imagePrompt.trim() && shot.videoPrompt.trim() && shot.fieldOrigins?.imagePrompt === "package" && shot.fieldOrigins?.videoPrompt === "package");
    return (
        <div>
            <DramaStageHeader
                step="02"
                title="内容审核"
                description="确认剧本事实、镜头边界、对白与叙事信息；视觉模型不会在这个阶段改写内容。"
                status={!episode.shots.length ? "等待内容结构" : hasPackageVisualPlan ? "制作方案已就绪" : episode.reviewStatus === "visual_ready" ? "视觉方案已生成" : "待确认"}
                tone={!episode.shots.length ? "attention" : episode.reviewStatus === "visual_ready" ? "ready" : "neutral"}
                metrics={
                    episode.shots.length
                        ? [
                              { label: "镜头", value: episode.shots.length },
                              { label: "总时长", value: `${totalDuration} 秒` },
                              { label: "对白", value: `${dialogueCount} 句` },
                          ]
                        : []
                }
                secondaryAction={
                    <Button className="!h-8" icon={<SlidersHorizontal className="size-3.5" />} onClick={() => setEpisodeInfoOpen(true)}>
                        本集信息
                    </Button>
                }
                action={
                    <Button
                        type="primary"
                        className="!h-9 !w-full sm:!w-auto"
                        icon={episode.shots.length ? <Check className="size-4" /> : <ArrowLeft className="size-4" />}
                        loading={designing}
                        onClick={!episode.shots.length ? () => onStageChange("script") : hasPackageVisualPlan ? () => onStageChange("storyboard") : onDesignVisuals}
                    >
                        {!episode.shots.length ? "返回剧本并提取结构" : hasPackageVisualPlan ? "进入分镜" : episode.reviewStatus === "visual_ready" ? "更新视觉方案" : "确认内容并生成视觉方案"}
                    </Button>
                }
            />
            {episode.shots.length ? (
                <div className="mt-2.5 overflow-x-auto hide-scrollbar">
                    <Segmented
                        value={view}
                        onChange={(value) => setView(value as typeof view)}
                        options={[
                            { label: "内容结构", value: "content" },
                            { label: "制作参数", value: "production" },
                            { label: "连续性", value: "continuity" },
                            ...(project.productionArchive ? [{ label: "制作包资料", value: "package" }] : []),
                        ]}
                    />
                </div>
            ) : null}
            {episode.shots.length && view === "content" ? (
                <div className="mt-2.5 space-y-2.5">
                    {episode.shots.map((shot) => {
                        const expanded = expandedShotIds.has(shot.id);
                        const dialogueCount = shot.utterances.filter((item) => item.type === "dialogue").length || shot.dialogue.split(/\n+/).filter((line) => line.trim()).length;
                        const sourcePreview = compactReviewText(shot.sourceText || shot.description || "暂无原文依据");
                        return (
                            <article key={shot.id} className="rounded-lg border border-border bg-background p-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="grid size-8 place-items-center rounded-md bg-muted text-xs font-semibold">{String(shot.order).padStart(2, "0")}</span>
                                    <Input variant="borderless" className="!min-w-0 !flex-1 !p-0 !font-semibold" value={shot.title} onChange={(event) => updateContentShot(shot.id, { title: event.target.value })} />
                                    <span className="hidden shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground sm:inline-flex">
                                        <span className="size-1.5 rounded-full bg-foreground/60" />
                                        可编辑内容
                                    </span>
                                    <Button
                                        size="small"
                                        className="!h-8 !shrink-0 !rounded-md !border-border/80 !px-2 !text-xs"
                                        icon={<ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />}
                                        iconPosition="end"
                                        aria-expanded={expanded}
                                        onClick={() => toggleShot(shot.id)}
                                    >
                                        {expanded ? "收起" : "展开"}
                                    </Button>
                                </div>
                                {expanded ? (
                                    <>
                                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                                            <label className="block space-y-1.5 xl:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">原文依据</span>
                                                <Input.TextArea
                                                    value={shot.sourceText}
                                                    onChange={(event) => updateContentShot(shot.id, { sourceText: event.target.value })}
                                                    autoSize={{ minRows: 2, maxRows: 5 }}
                                                    placeholder="保留这一镜头对应的连续原文，便于核对台词和动作"
                                                />
                                            </label>
                                            <label className="block space-y-1.5">
                                                <span className="text-xs font-medium text-muted-foreground">镜头事实</span>
                                                <Input.TextArea
                                                    value={shot.description}
                                                    onChange={(event) => updateContentShot(shot.id, { description: event.target.value })}
                                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                                    placeholder="只写画面中能看到的动作、人物状态和环境事实"
                                                />
                                            </label>
                                            <label className="block space-y-1.5">
                                                <span className="text-xs font-medium text-muted-foreground">镜头边界</span>
                                                <Input.TextArea
                                                    value={shot.shotBoundary}
                                                    onChange={(event) => updateContentShot(shot.id, { shotBoundary: event.target.value })}
                                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                                    placeholder="例如：说话人改变、动作反应或场景变化"
                                                />
                                            </label>
                                            <div className="min-w-0">
                                                <DramaShotDialogueEditor projectId={project.id} episodeId={episode.id} shot={shot} />
                                            </div>
                                            <label className="block space-y-1.5">
                                                <span className="text-xs font-medium text-muted-foreground">画外音（旁白）</span>
                                                <Input.TextArea
                                                    value={shot.narration}
                                                    onChange={(event) => updateContentShot(shot.id, { narration: event.target.value, subtitle: [shot.dialogue, event.target.value].filter(Boolean).join("\n") })}
                                                    autoSize={{ minRows: 2, maxRows: 5 }}
                                                    placeholder="只填写原文明确存在的旁白；没有旁白请留空"
                                                />
                                            </label>
                                        </div>
                                        <div className="mt-3 grid grid-cols-[auto_72px_auto] items-center gap-2 text-sm text-muted-foreground sm:grid-cols-[auto_88px_auto_minmax(0,1fr)]">
                                            <span className="whitespace-nowrap">镜头时长</span>
                                            <InputNumber className="!h-9 !w-[72px] sm:!w-[88px]" min={1} max={20} value={shot.duration} onChange={(value) => updateContentShot(shot.id, { duration: Number(value) || 5 })} />
                                            <span>秒</span>
                                            <span className="hidden min-w-0 text-right text-xs sm:block">视觉提示词将在确认后生成</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                                        <span className="min-w-0 max-w-full truncate">原文：{sourcePreview}</span>
                                        <span>{dialogueCount ? `${dialogueCount} 句对白` : "暂无对白"}</span>
                                        <span>{shot.duration} 秒</span>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            ) : !episode.shots.length ? (
                <div className="mt-2.5 flex min-h-14 items-center rounded-lg border border-dashed border-border bg-card/25 px-3 py-2.5">
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium">还没有待审核的内容结构</h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">先填写或导入本集剧本，再由 AI 提取可编辑的镜头事实、对白和原文依据。</p>
                    </div>
                </div>
            ) : null}
            {episode.shots.length && view === "production" ? (
                <div className="mt-2.5 overflow-hidden rounded-lg border border-border bg-background">
                    {episode.shots.map((shot) => (
                        <div key={shot.id} className="grid gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)]">
                            <div>
                                <div className="text-xs font-semibold">{shot.code || `镜头 ${String(shot.order).padStart(2, "0")}`}</div>
                                <div className="mt-1 truncate text-xs text-muted-foreground">{shot.title}</div>
                            </div>
                            <dl className="grid min-w-0 gap-x-4 gap-y-1 text-xs sm:grid-cols-2 xl:grid-cols-4">
                                <Parameter label="焦段" value={shot.lens} />
                                <Parameter label="光线" value={shot.lighting} />
                                <Parameter label="色板" value={shot.colorPalette} />
                                <Parameter label="转场" value={[shot.transitionIn, shot.transitionOut].filter(Boolean).join(" → ")} />
                                <Parameter label="环境声" value={shot.sound?.ambience} />
                                <Parameter label="音效" value={shot.sound?.soundEffects} />
                                <Parameter label="音乐" value={shot.sound?.music} />
                                <Parameter label="表演" value={shot.performanceNotes} />
                            </dl>
                        </div>
                    ))}
                </div>
            ) : null}
            {episode.shots.length && view === "continuity" ? (
                <div className="mt-2.5 space-y-2">
                    {episode.shots.map((shot) => {
                        const edge = episode.continuityEdges?.find((item) => item.toShotId === shot.id);
                        const previous = edge ? episode.shots.find((item) => item.id === edge.fromShotId) : undefined;
                        const status = shot.continuityStatus || "ready";
                        return (
                            <article key={shot.id} className="rounded-lg border border-border bg-background px-3 py-3">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold">{shot.code || `镜头 ${shot.order}`}</span>
                                    <span className="min-w-0 flex-1 truncate text-xs">{shot.title}</span>
                                    <Tag color={status === "passed" ? "success" : status === "blocked" ? "warning" : status === "needs_review" || status === "stale" ? "processing" : "default"}>{continuityStatusLabel(status)}</Tag>
                                </div>
                                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                    <span>{edge ? `${previous?.code || previous?.title || "上一镜头"} → ${shot.code || shot.title}` : "场次起始镜头，无前镜继承"}</span>
                                    <span>{edge ? `${transitionLabel(edge.transition)} · ${edge.inheritActualEndFrame ? "继承实际尾帧" : "不继承尾帧"}` : "独立起始状态"}</span>
                                    <span>实际首帧：{shot.actualStartFrameUrl ? "已提取" : "未提取"}</span>
                                    <span>实际尾帧：{shot.actualEndFrameUrl ? "已提取" : "未提取"}</span>
                                </div>
                                {shot.continuityError ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">阻塞原因：{shot.continuityError}</p> : null}
                            </article>
                        );
                    })}
                </div>
            ) : null}
            {episode.shots.length && view === "package" && project.productionArchive ? <DramaProductionArchiveView archive={project.productionArchive} /> : null}
            <Modal title="本集信息" open={episodeInfoOpen} width={620} centered destroyOnHidden footer={null} onCancel={() => setEpisodeInfoOpen(false)} styles={{ container: { maxWidth: "calc(100vw - 24px)" } }}>
                <div className="grid gap-3 pt-1 sm:grid-cols-2">
                    {[
                        ["本集大纲", "outline", "用一句话概括本集推进"],
                        ["来源范围", "sourceRange", "例如：原文第 1-3 节"],
                        ["结尾钩子", "hook", "本集结尾要留下的冲突"],
                        ["下集预告", "nextPreview", "下一集承接方向"],
                    ].map(([label, key, placeholder]) => (
                        <label key={key} className="block space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">{label}</span>
                            <Input.TextArea
                                value={episode[key as "outline" | "sourceRange" | "hook" | "nextPreview"]}
                                onChange={(event) => updateEpisode(project.id, episode.id, { [key]: event.target.value })}
                                autoSize={{ minRows: 2, maxRows: 4 }}
                                placeholder={placeholder}
                            />
                        </label>
                    ))}
                </div>
            </Modal>
        </div>
    );
}

function DramaProductionArchiveView({ archive }: { archive: NonNullable<DramaProject["productionArchive"]> }) {
    return (
        <div className="mt-2.5 space-y-3" data-drama-production-archive>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
                {[
                    ["原文章节", archive.sections.length],
                    ["视觉 Prompt 资产", archive.promptAssets.length],
                    ["台词表演指令", archive.dialogueDirections.length],
                    ["资产引用计划", archive.referencePlan.length],
                ].map(([label, value]) => (
                    <div key={String(label)} className="bg-card px-3 py-2.5"><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div></div>
                ))}
            </div>
            <section className="rounded-lg border border-border bg-background p-3">
                <h3 className="text-sm font-semibold">关键帧与全案板 Prompt</h3>
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                    {archive.promptAssets.map((asset) => (
                        <details key={asset.code} className="rounded-md border border-border bg-card px-3 py-2 open:pb-3">
                            <summary className="cursor-pointer text-xs font-medium">{asset.code} · {asset.title} <span className="ml-1 text-muted-foreground">{asset.shotCodes.join("、") || "未绑定镜头"}</span></summary>
                            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-muted-foreground">{asset.prompt}</pre>
                        </details>
                    ))}
                </div>
            </section>
            <section className="rounded-lg border border-border bg-background p-3">
                <h3 className="text-sm font-semibold">表演、静默与执行计划</h3>
                <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                    <Parameter label="角色台词基调" value={archive.voiceDirections.map((item) => `${item.subject}：${item.direction}`).join("；")} />
                    <Parameter label="沉默设计" value={archive.silenceDirections.map((item) => `${item.shotCode}：${item.direction}`).join("；")} />
                    <Parameter label="生成顺序" value={archive.generationOrder.join(" → ")} />
                    <Parameter label="格式版本" value={archive.formatVersion} />
                </dl>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {archive.referencePlan.map((item) => (
                        <div key={`${item.priority}-${item.asset}`} className="rounded-md border border-border px-2.5 py-2 text-xs">
                            <div className="font-medium">{item.priority}. {item.asset}</div>
                            <div className="mt-1 text-muted-foreground">{item.planType} · {item.purpose} · {item.shotCodes.join("、") || "未绑定镜头"}</div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 overflow-x-auto hide-scrollbar">
                    <table className="w-full min-w-[680px] text-left text-xs">
                        <thead className="text-muted-foreground"><tr><th className="pb-2">ID</th><th className="pb-2">镜头</th><th className="pb-2">说话人</th><th className="pb-2">台词</th><th className="pb-2">表演与节奏</th><th className="pb-2">口型</th></tr></thead>
                        <tbody>{archive.dialogueDirections.map((item) => <tr key={item.id} className="border-t border-border"><td className="py-2">{item.id}</td><td>{item.shotCode}</td><td>{item.speaker}</td><td>{item.text}</td><td>{item.performance}</td><td>{item.lipSync ? "是" : "否"}</td></tr>)}</tbody>
                    </table>
                </div>
            </section>
            <section className="rounded-lg border border-border bg-background p-3">
                <h3 className="text-sm font-semibold">原制作包章节与 QC</h3>
                <div className="mt-2 space-y-2">
                    {archive.sections.map((section) => (
                        <details key={section.code} className="rounded-md border border-border bg-card px-3 py-2 open:pb-3">
                            <summary className="cursor-pointer text-xs font-medium">{section.title}</summary>
                            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-muted-foreground">{section.content}</pre>
                        </details>
                    ))}
                </div>
                {archive.qcReport ? <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted/45 p-3 font-sans text-xs leading-5">{archive.qcReport}</pre> : null}
            </section>
        </div>
    );
}

function compactReviewText(value: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 72 ? `${normalized.slice(0, 72)}…` : normalized;
}

function Parameter({ label, value }: { label: string; value?: string }) {
    return (
        <div className="min-w-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 truncate text-foreground" title={value || "未设置"}>
                {value || "未设置"}
            </dd>
        </div>
    );
}

function continuityStatusLabel(status: NonNullable<DramaEpisode["shots"][number]["continuityStatus"]>) {
    return { ready: "待生产", stale: "已过期", blocked: "已阻塞", needs_review: "待 QC", passed: "已通过" }[status];
}

function transitionLabel(value: NonNullable<DramaEpisode["continuityEdges"]>[number]["transition"]) {
    return { continuous: "连续", match_cut: "匹配剪辑", hard_cut: "硬切", scene_change: "场景切换", jump_cut: "跳切" }[value];
}
