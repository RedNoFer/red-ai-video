"use client";

import { App, Button, Input, InputNumber, Modal, Segmented, Tag } from "antd";
import { ChevronDown, GitBranch, MessageSquareText, RotateCcw, Sparkles, Volume1 } from "lucide-react";
import { useState } from "react";

import { useDramaStore } from "../stores/use-drama-store";
import type { DramaEpisode, DramaProject, DramaShot } from "../types";
import { StoryboardTag } from "./drama-editor-elements";
import { DramaShotAudioModeEditor } from "./drama-shot-audio-mode-editor";
import { DramaShotContinuityEditor } from "./drama-shot-continuity-editor";
import { DramaShotDialogueEditor } from "./drama-shot-dialogue-editor";
import { DramaShotFrameEditor } from "./drama-shot-frame-editor";
import { dramaShotVideoMode } from "./drama-shot-generation-utils";
import { formatPromptFieldLines } from "@/lib/drama-frame-sequence";
import { updateDramaShotImagePrompt } from "@/services/api/drama-projects";
import { optimizeDramaFramePrompt } from "@/services/api/prompt-optimization";

const shotFieldClass = "!shadow-none hover:!border-foreground/25 focus:!border-foreground/35 focus:!shadow-none";

export function DramaStoryboardShotCard({
    project,
    episode,
    shot,
    expanded,
    onToggle,
    onOpenCanvas,
    onPrefetchCanvas,
}: {
    project: DramaProject;
    episode: DramaEpisode;
    shot: DramaShot;
    expanded: boolean;
    onToggle: () => void;
    onOpenCanvas: () => void;
    onPrefetchCanvas?: () => void;
}) {
    const { message } = App.useApp();
    const episodeId = episode.id;
    const updateShot = useDramaStore((state) => state.updateShot);
    const replaceProject = useDramaStore((state) => state.replaceProject);
    const [imagePromptModalOpen, setImagePromptModalOpen] = useState(false);
    const [imagePromptDraft, setImagePromptDraft] = useState("");
    const [imagePromptOriginal, setImagePromptOriginal] = useState("");
    const [imagePromptGenerating, setImagePromptGenerating] = useState(false);
    const [imagePromptSaving, setImagePromptSaving] = useState(false);
    const formattedImagePrompt = formatPromptFieldLines(shot.imagePrompt, "static");
    const dialogueLines = shot.dialogue
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
    const dialoguePreview = shot.utterances
        .filter((item) => item.type === "dialogue" && item.text.trim())
        .map((item) => `${item.speaker.trim() ? `${item.speaker.trim()}：` : ""}${item.text.trim()}`)
        .join(" / ");
    const speakers = [
        ...new Set(
            shot.utterances
                .filter((item) => item.type === "dialogue")
                .map((item) => item.speaker.trim())
                .filter(Boolean),
        ),
    ];

    const generateImagePrompt = async () => {
        setImagePromptGenerating(true);
        try {
            const sourcePrompt = formattedImagePrompt || shot.description;
            setImagePromptOriginal(sourcePrompt);
            setImagePromptDraft(formatPromptFieldLines(await optimizeDramaFramePrompt(sourcePrompt), "static"));
            setImagePromptModalOpen(true);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "Agent 图片提示词生成失败");
        } finally {
            setImagePromptGenerating(false);
        }
    };

    const saveImagePrompt = async () => {
        const prompt = formatPromptFieldLines(imagePromptDraft, "static");
        if (!prompt) return;
        setImagePromptSaving(true);
        try {
            replaceProject(await updateDramaShotImagePrompt(project.id, episode.id, shot.id, prompt));
            setImagePromptModalOpen(false);
            message.success("图片提示词已覆盖保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "图片提示词保存失败");
        } finally {
            setImagePromptSaving(false);
        }
    };

    return (
        <article
            className={`min-w-0 self-start overflow-hidden rounded-lg border border-border/80 bg-background/65 p-3 transition hover:border-foreground/15 hover:shadow-sm sm:p-4 [content-visibility:visible] sm:[content-visibility:auto] ${expanded ? "xl:col-span-2" : ""}`}
        >
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <Input variant="borderless" className="!min-w-0 !w-full !p-0 !font-semibold" value={shot.title} onChange={(event) => updateShot(project.id, episodeId, shot.id, { title: event.target.value })} />
                <div className="flex shrink-0 items-center gap-1.5">
                    <StoryboardTag status={shot.storyboardStatus} />
                    <Tag className="!m-0">#{shot.order}</Tag>
                    <Button size="small" className="!h-8 !px-2.5" icon={<GitBranch className="size-3.5" />} onMouseEnter={onPrefetchCanvas} onFocus={onPrefetchCanvas} onPointerDown={onPrefetchCanvas} onClick={onOpenCanvas}>
                        画布
                    </Button>
                    <Button size="small" className="!h-8 !px-2.5" icon={<ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />} iconPlacement="end" aria-expanded={expanded} onClick={onToggle}>
                        {expanded ? "收起" : "展开"}
                    </Button>
                </div>
            </div>
            {expanded ? (
                <div className="mt-4">
                    <div className="rounded-md border border-border/75 bg-muted/20 p-2.5 sm:p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">镜头内容</span>
                            {dialogueLines.length ? (
                                <span className="text-xs text-muted-foreground">
                                    {speakers.length ? `${speakers.join("、")} · ` : ""}已保留 {dialogueLines.length} 句对白
                                </span>
                            ) : (
                                <span className="text-xs text-muted-foreground">本镜头暂无明确对白</span>
                            )}
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <label className="block space-y-1.5 lg:col-span-2">
                                <span className="text-xs font-medium text-muted-foreground">镜头事实</span>
                                <Input.TextArea
                                    className={shotFieldClass}
                                    value={shot.description}
                                    onChange={(event) => updateShot(project.id, episodeId, shot.id, { description: event.target.value })}
                                    autoSize={{ minRows: 1, maxRows: 3 }}
                                    placeholder="只写画面中真实发生的动作和人物状态"
                                />
                            </label>
                            <div className="min-w-0">
                                <DramaShotDialogueEditor projectId={project.id} episodeId={episodeId} shot={shot} />
                            </div>
                            <label className="block space-y-1.5">
                                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Volume1 className="size-3.5" />
                                    画外音（旁白）
                                </span>
                                <Input.TextArea
                                    className={shotFieldClass}
                                    value={shot.narration}
                                    onChange={(event) => updateShot(project.id, episodeId, shot.id, { narration: event.target.value, subtitle: [shot.dialogue, event.target.value].filter(Boolean).join("\n") })}
                                    autoSize={{ minRows: 1, maxRows: 4 }}
                                    placeholder="没有旁白请留空"
                                />
                            </label>
                            <details className="rounded-md border border-border/60 bg-background/55 px-2.5 py-2 lg:col-span-2">
                                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">查看原文依据</summary>
                                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{shot.sourceText || "暂无原文依据"}</p>
                            </details>
                        </div>
                    </div>
                    <div className="mt-4 border-t border-border/70 pt-4">
                        <div className="grid gap-3.5 lg:grid-cols-2">
                            <label className="block space-y-1.5">
                                <span className="grid gap-0.5 text-sm font-medium sm:flex sm:items-baseline sm:gap-x-2">
                                    <span className="flex items-center gap-1.5">静态帧提示词 <Button type="text" size="small" className="!h-6 !px-1.5 !text-xs" icon={<Sparkles className="size-3.5" />} loading={imagePromptGenerating} disabled={imagePromptGenerating} onClick={() => void generateImagePrompt()}>提示词优化</Button></span>
                                    <span className="text-xs font-normal text-muted-foreground">主体、场景、景别、构图与光线</span>
                                </span>
                                <Input.TextArea
                                    className={shotFieldClass}
                                    value={formattedImagePrompt}
                                    onChange={(event) => updateShot(project.id, episodeId, shot.id, { imagePrompt: event.target.value })}
                                    autoSize={{ minRows: 2, maxRows: 5 }}
                                    placeholder="例如：女主站在雨夜天台，中景，侧逆光，压抑冷色调"
                                />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="grid gap-0.5 text-sm font-medium sm:flex sm:items-baseline sm:gap-x-2">
                                    动态提示词
                                    <span className="text-xs font-normal text-muted-foreground">动作过程、节奏和起止状态</span>
                                </span>
                                <Input.TextArea
                                    className={shotFieldClass}
                                    value={shot.videoPrompt}
                                    onChange={(event) => updateShot(project.id, episodeId, shot.id, { videoPrompt: event.target.value })}
                                    autoSize={{ minRows: 2, maxRows: 5 }}
                                    placeholder="例如：女主缓慢回头，雨水掠过脸侧，最后看向门口"
                                />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="grid gap-0.5 text-sm font-medium sm:flex sm:items-baseline sm:gap-x-2">
                                    镜头运动
                                    <span className="text-xs font-normal text-muted-foreground">机位移动和速度</span>
                                </span>
                                <Input className={shotFieldClass} value={shot.cameraMotion} onChange={(event) => updateShot(project.id, episodeId, shot.id, { cameraMotion: event.target.value })} placeholder="例如：固定机位、缓慢推进、向右横移" />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">视频生成方式</span>
                                <Segmented
                                    block
                                    className="!min-w-0 !w-full [&_.ant-segmented-group]:!min-w-0 [&_.ant-segmented-item]:!min-w-0 [&_.ant-segmented-item-label]:!truncate [&_.ant-segmented-item-label]:!px-1.5 sm:[&_.ant-segmented-item-label]:!px-2"
                                    value={dramaShotVideoMode(project, shot)}
                                    options={[
                                        { label: "分镜驱动", value: "storyboard" },
                                        { label: "直接生成", value: "direct" },
                                    ]}
                                    onChange={(value) => updateShot(project.id, episodeId, shot.id, { videoMode: value as DramaProject["defaultVideoMode"] })}
                                />
                            </label>
                        </div>
                        {dramaShotVideoMode(project, shot) === "storyboard" ? <DramaShotFrameEditor project={project} episodeId={episodeId} shot={shot} /> : null}
                        <DramaShotContinuityEditor project={project} episode={episode} shot={shot} />
                        {shot.storyboardError ? <p className="mt-2 text-xs text-red-500">{shot.storyboardError}</p> : null}
                        {shot.storyboardEndError ? <p className="mt-2 text-xs text-red-500">{shot.storyboardEndError}</p> : null}
                        <DramaShotAudioModeEditor projectId={project.id} episodeId={episodeId} shot={shot} />
                        <div className="mt-3.5 flex min-h-9 items-center gap-2.5 text-sm">
                            <span className="whitespace-nowrap">时长</span>
                            <InputNumber
                                className="!h-9 !w-24 [&.ant-input-number-focused]:!border-foreground/35 [&.ant-input-number-focused]:!shadow-none"
                                min={1}
                                max={30}
                                step={1}
                                precision={0}
                                value={shot.duration}
                                onChange={(value) => updateShot(project.id, episodeId, shot.id, { duration: Number(value) || 5 })}
                            />
                            <span>秒</span>
                        </div>
                    </div>
                    <Modal
                        open={imagePromptModalOpen}
                        title="Agent 图片提示词"
                        centered
                        width="min(760px, calc(100vw - 24px))"
                        okText="覆盖保存"
                        cancelText="取消"
                        confirmLoading={imagePromptSaving}
                        onOk={() => void saveImagePrompt()}
                        onCancel={() => setImagePromptModalOpen(false)}
                    >
                        <div className="mb-2 flex items-start justify-between gap-2">
                            <p className="text-xs leading-5 text-muted-foreground">已结合当前镜头事实、连续性和固定资产生成 Seedance 2.0 静态画面提示词。编辑后覆盖保存，不会修改视频提示词或剧情字段。</p>
                            <Button size="small" icon={<RotateCcw className="size-3.5" />} disabled={imagePromptDraft === imagePromptOriginal || imagePromptSaving} onClick={() => setImagePromptDraft(imagePromptOriginal)}>
                                还原上次
                            </Button>
                        </div>
                        <Input.TextArea value={imagePromptDraft} onChange={(event) => setImagePromptDraft(event.target.value)} autoSize={{ minRows: 8, maxRows: 18 }} />
                    </Modal>
                </div>
            ) : (
                <div className="mt-2 space-y-1.5">
                    <p className="truncate text-xs leading-5 text-muted-foreground">{shot.description || shot.imagePrompt || shot.videoPrompt || "尚未生成视觉提示词"}</p>
                    {shot.dialogue ? (
                        <p className="flex min-w-0 items-start gap-1.5 text-xs leading-5 text-foreground/75">
                            <MessageSquareText className="mt-1 size-3.5 shrink-0" />
                            <span className="line-clamp-2 min-w-0">对白：{dialoguePreview || shot.dialogue}</span>
                        </p>
                    ) : null}
                    {shot.narration ? (
                        <p className="flex min-w-0 items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                            <Volume1 className="mt-1 size-3.5 shrink-0" />
                            <span className="line-clamp-2 min-w-0">旁白：{shot.narration}</span>
                        </p>
                    ) : null}
                </div>
            )}
        </article>
    );
}
