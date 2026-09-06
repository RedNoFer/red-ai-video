"use client";

import { App, Button, Drawer, Input, Modal, Popover, Select, Tooltip } from "antd";
import { Bot, FileText, History, LoaderCircle, MessageSquarePlus, Paperclip, Send, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";

import type { CreativeAsset, CreativeConversation, CreativeMessage } from "@/lib/creative-runtime-contract";
import type { DramaProductionPackagePreview, DramaProject, DramaEpisode } from "@/lib/drama-project-contract";
import { AgentMarkdown } from "@/components/agent/agent-markdown";
import { createCreativeAgentRun, createCreativeConversation, listCreativeConversationPage, listCreativeMessages, uploadCreativeAsset, watchCreativeAgentRun } from "@/services/api/creative";
import { CREATIVE_UPLOAD_MAX_BYTES, isCreativeTextFile } from "@/lib/creative-upload";
import { applyDramaEpisodeProductionPackage, saveDramaProductionPlan } from "@/services/api/drama-projects";
import { useDramaStore } from "../stores/use-drama-store";
import { useCreativeAgentOptions } from "@/hooks/use-creative-agent-options";
import { defaultDramaProductionPlan, DRAMA_SCRIPT_SHOT_DURATION_OPTIONS, DRAMA_VIDEO_RESOLUTION_OPTIONS, normalizeDramaProductionPlan } from "@/lib/drama-production-plan";
import type { DramaProductionPlan } from "@/lib/drama-project-contract";

type Props = { project: DramaProject; episode: DramaEpisode; open: boolean; onOpenChange: (open: boolean) => void };
type PendingAttachment = { id: string; file: File; previewUrl?: string };

export function DramaScriptAgentPanel({ project, episode, open, onOpenChange }: Props) {
    const { message } = App.useApp();
    const replaceProject = useDramaStore((state) => state.replaceProject);
    const [conversation, setConversation] = useState<CreativeConversation>();
    const [conversations, setConversations] = useState<CreativeConversation[]>([]);
    const [messages, setMessages] = useState<CreativeMessage[]>([]);
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [packageData, setPackageData] = useState<{ markdown: string; preview: DramaProductionPackagePreview }>();
    const [applying, setApplying] = useState(false);
    const [planOpen, setPlanOpen] = useState(false);
    const [pendingPackage, setPendingPackage] = useState(false);
    const [planDraft, setPlanDraft] = useState<DramaProductionPlan>(() => normalizeDramaProductionPlan(project.productionBible?.productionPlan, defaultDramaProductionPlan("new-project"))!);
    const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
    const attachmentsRef = useRef<PendingAttachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { skills, skillsLoading } = useCreativeAgentOptions("drama", ["video"]);
    useEffect(() => {
        setPlanDraft(normalizeDramaProductionPlan(project.productionBible?.productionPlan, defaultDramaProductionPlan("new-project"))!);
    }, [project.id, project.productionBible?.productionPlan]);
    useEffect(() => {
        attachmentsRef.current = attachments;
    }, [attachments]);
    useEffect(() => {
        if (open) return;
        setAttachments((current) => {
            current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
            return [];
        });
    }, [open]);
    useEffect(() => () => attachmentsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl)), []);
    const streamRef = useRef<(() => void) | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const [desktop, setDesktop] = useState(false);
    useEffect(() => {
        const media = window.matchMedia("(min-width: 1180px)");
        const update = () => setDesktop(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    const loadConversation = async (item: CreativeConversation) => {
        streamRef.current?.();
        setConversation(item);
        setLoading(true);
        setMessages(await listCreativeMessages(item.id));
        setLoading(false);
    };
    const ensureConversation = async () => {
        if (conversation) return conversation;
        const page = await listCreativeConversationPage({ surface: "drama", source: "drama-script", projectId: project.id, episodeId: episode.id, limit: 20 });
        const item = page.conversations[0] || (await createCreativeConversation({ surface: "drama", source: "drama-script", projectId: project.id, episodeId: episode.id, title: `${episode.title} 剧本` }));
        setConversations(page.conversations.length ? page.conversations : [item]);
        await loadConversation(item);
        return item;
    };
    useEffect(() => {
        streamRef.current?.();
        setConversation(undefined);
        setMessages([]);
        setPackageData(undefined);
        if (!open) return;
        void (async () => {
            const page = await listCreativeConversationPage({ surface: "drama", source: "drama-script", projectId: project.id, episodeId: episode.id, limit: 20 });
            const item = page.conversations[0] || (await createCreativeConversation({ surface: "drama", source: "drama-script", projectId: project.id, episodeId: episode.id, title: `${episode.title} 剧本` }));
            setConversations(page.conversations.length ? page.conversations : [item]);
            await loadConversation(item);
        })().catch((error) => message.error(error instanceof Error ? error.message : "剧本 Agent 会话加载失败"));
        return () => streamRef.current?.();
    }, [open, episode.id, project.id]);
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" });
    }, [messages.length, messages.at(-1)?.content]);

    const addAttachments = (files: File[]) => {
        const unsupported = files.find((file) => !file.type.startsWith("image/") && !isCreativeTextFile(file.name, file.type));
        if (unsupported) return message.error(`${unsupported.name} 不是支持的图片、TXT 或 Markdown 文件`);
        const oversized = files.find((file) => file.size > CREATIVE_UPLOAD_MAX_BYTES);
        if (oversized) return message.error(`${oversized.name} 超过 20MB`);
        const next = files.map((file) => ({ id: `attachment-${nanoid()}`, file, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined }));
        setAttachments((current) => [...current, ...next]);
    };

    const removeAttachment = (id: string) => {
        setAttachments((current) => {
            const removed = current.find((item) => item.id === id);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return current.filter((item) => item.id !== id);
        });
    };

    const uploadAttachments = async (conversationId: string) => {
        if (!attachments.length) return [] as CreativeAsset[];
        const uploaded: CreativeAsset[] = [];
        for (const item of attachments) uploaded.push(await uploadCreativeAsset(conversationId, item.file));
        attachments.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
        setAttachments([]);
        return uploaded;
    };

    const submit = async (requestedPrompt = prompt, requestedPlan = planDraft) => {
        const content = requestedPrompt.trim() || (attachments.length ? "请阅读本轮附件内容，结合当前项目上下文协助整理当前集剧本。" : "");
        if (!content || sending) return;
        setSending(true);
        try {
            const item = await ensureConversation();
            const uploaded = await uploadAttachments(item.id);
            setPrompt("");
            const result = await createCreativeAgentRun({
                clientRequestId: `drama-script:${project.id}:${episode.id}:${nanoid()}`,
                surface: "drama",
                workflow: "drama-script",
                conversationId: item.id,
                projectId: project.id,
                episodeId: episode.id,
                prompt: content,
                assetIds: uploaded.map((asset) => asset.id),
                skillIds: requestedPlan.skills.map((skill) => skill.id),
                modelIds: [],
                snapshot: { episodeId: episode.id, productionPlan: requestedPlan },
            });
        setMessages((current) => [
            ...current,
            { id: result.run.inputMessageId, conversationId: item.id, sequence: current.length + 1, role: "user", status: "completed", content, metadata: {}, createdAt: Date.now(), updatedAt: Date.now() },
            {
                id: result.run.assistantMessageId,
                conversationId: item.id,
                sequence: current.length + 2,
                role: "assistant",
                status: "running",
                content: "正在结合项目上下文编写本集内容…",
                metadata: {},
                runId: result.run.id,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        ]);
        streamRef.current?.();
        streamRef.current = watchCreativeAgentRun(result.run.id, {
            onProgress: (text) => setMessages((current) => current.map((message) => (message.id === result.run.assistantMessageId ? { ...message, content: text } : message))),
            onStatus: () => undefined,
            onTaskCompleted: () => undefined,
            onProjectHandoff: () => undefined,
            onConnectionError: (text) => setMessages((current) => current.map((message) => (message.id === result.run.assistantMessageId ? { ...message, content: text, status: "failed" } : message))),
            onTerminal: async (status, text) => {
                const loaded = await listCreativeMessages(item.id);
                setMessages(loaded);
                const assistant = loaded.find((message) => message.id === result.run.assistantMessageId);
                const packageValue = assistant?.metadata?.dramaScriptPackage;
                if (packageValue && typeof packageValue === "object" && typeof (packageValue as { markdown?: unknown }).markdown === "string") setPackageData(packageValue as { markdown: string; preview: DramaProductionPackagePreview });
                if (status === "failed" && text) message.error(text);
                setSending(false);
            },
        });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "剧本 Agent 请求失败");
            setSending(false);
        }
    };
    const savePlan = async () => {
        const next = normalizeDramaProductionPlan(planDraft, defaultDramaProductionPlan("new-project"))!;
        const lockedPlan = {
            ...next,
            visual: { ...next.visual, source: next.visual.visualStyle.trim() && next.visual.artStyle.trim() ? ("manual" as const) : ("agent" as const) },
            lockedAt: new Date().toISOString(),
            source: "manual" as const,
        };
        const saved = await saveDramaProductionPlan(project.id, lockedPlan);
        replaceProject(saved);
        setPlanDraft(normalizeDramaProductionPlan(saved.productionBible?.productionPlan, lockedPlan)!);
        setPlanOpen(false);
        if (pendingPackage) {
            setPendingPackage(false);
            const packageRequest = prompt.trim();
            void submit(
                packageRequest
                    ? `${packageRequest}\n\n请基于当前项目、当前集、本次锁定的生产方案和本次对话上下文，生成完整的 vozeb-drama-production-package-v1 Markdown 制作包，只包含当前集，并按本次指定的每镜时长重新分割剧情。`
                    : "请基于当前项目、当前集、本次锁定的生产方案和本次对话上下文，生成完整的 vozeb-drama-production-package-v1 Markdown 制作包，只包含当前集，并按本次指定的每镜时长重新分割剧情。",
                lockedPlan,
            );
        }
    };
    const confirmApply = async () => {
        if (!packageData) return;
        setApplying(true);
        try {
            const next = await applyDramaEpisodeProductionPackage(project, episode.id, packageData.preview, packageData.markdown, "剧本 Agent 制作包.md");
            replaceProject(next);
            setPackageData(undefined);
            message.success("已回填当前集剧本并保存版本");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "当前集制作包回填失败");
        } finally {
            setApplying(false);
        }
    };
    const content = (
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" data-drama-script-agent>
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3.5">
                <div className="flex min-w-0 items-center gap-2 font-medium">
                    <Bot className="size-4 text-primary" />
                    <span className="truncate">{episode.title} 剧本 GPT</span>
                </div>
                <div className="flex items-center gap-1">
                    <Popover
                        trigger="click"
                        placement="bottomRight"
                        content={
                            <div className="grid max-h-60 min-w-52 gap-1 overflow-y-auto">
                                {conversations.map((item) => (
                                    <Button key={item.id} type={item.id === conversation?.id ? "primary" : "text"} className="!justify-start !text-left" onClick={() => void loadConversation(item)}>
                                        {item.title || `${episode.title} 剧本`}
                                    </Button>
                                ))}
                            </div>
                        }
                    >
                        <Tooltip title="历史剧本对话">
                            <Button type="text" shape="circle" icon={<History className="size-4" />} />
                        </Tooltip>
                    </Popover>
                    <Tooltip title="新建剧本对话">
                        <Button
                            type="text"
                            shape="circle"
                            icon={<MessageSquarePlus className="size-4" />}
                            onClick={async () => {
                                const item = await createCreativeConversation({ surface: "drama", source: "drama-script", projectId: project.id, episodeId: episode.id, title: `${episode.title} 剧本` });
                                setConversations((current) => [item, ...current]);
                                await loadConversation(item);
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="关闭剧本 GPT">
                        <Button type="text" shape="circle" icon={<X className="size-4" />} onClick={() => onOpenChange(false)} />
                    </Tooltip>
                </div>
            </div>
            <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-3.5 py-3" data-drama-script-agent-messages>
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        正在恢复剧本对话
                    </div>
                ) : null}
                {!loading && !messages.length ? <p className="text-sm leading-6 text-muted-foreground">这里只讨论当前集的新剧本。可以先说明本集冲突、人物关系、节奏或结尾钩子。</p> : null}
                {messages.map((item) => (
                    <div key={item.id} className={`mb-3 text-sm leading-6 ${item.role === "user" ? "pl-6 text-right" : "pr-2"}`}>
                        {item.status === "running" ? <LoaderCircle className="mr-1 inline size-3.5 animate-spin" /> : null}
                        {item.role === "assistant" && item.status === "completed" ? <AgentMarkdown>{item.content}</AgentMarkdown> : <span className="whitespace-pre-wrap break-words">{item.content}</span>}
                    </div>
                ))}
                <div ref={endRef} />
            </div>
            <div className="mx-3 mb-3 mt-2 rounded-2xl border border-border bg-background p-3">
                <input
                    ref={fileInputRef}
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,text/plain,text/markdown"
                    multiple
                    onChange={(event) => {
                        addAttachments(Array.from(event.target.files || []));
                        event.target.value = "";
                    }}
                />
                {attachments.length ? (
                    <div className="mb-2 flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="待提交附件">
                        {attachments.map((attachment) => (
                            <div key={attachment.id} className="group relative flex h-12 w-44 shrink-0 items-center gap-2 rounded-lg border border-border bg-muted/25 px-2">
                                {attachment.previewUrl ? <img src={attachment.previewUrl} alt={attachment.file.name} className="size-8 rounded object-cover" /> : <FileText className="size-4 shrink-0 text-primary" />}
                                <span className="min-w-0 flex-1 truncate text-xs" title={attachment.file.name}>{attachment.file.name}</span>
                                <button type="button" className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => removeAttachment(attachment.id)} aria-label={`移除附件 ${attachment.file.name}`}>
                                    <X className="size-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : null}
                <Input.TextArea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    disabled={sending}
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    placeholder="只输入当前集剧本相关内容"
                    onPressEnter={(event) => {
                        if (!event.shiftKey) {
                            event.preventDefault();
                            void submit();
                        }
                    }}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                    <Button type="text" icon={<Paperclip className="size-4" />} disabled={sending} onClick={() => fileInputRef.current?.click()} aria-label="添加图片或文本附件">
                        添加附件
                    </Button>
                    <div className="flex justify-end gap-2">
                    <Button
                        loading={sending}
                        disabled={sending}
                        onClick={() => {
                            setPendingPackage(true);
                            setPlanOpen(true);
                        }}
                    >
                        生成制作包
                    </Button>
                    <Button type="primary" icon={<Send className="size-3.5" />} loading={sending} disabled={!prompt.trim() && !attachments.length} onClick={() => void submit()}>
                        发送
                    </Button>
                    </div>
                </div>
            </div>
            <Modal title="当前集制作包预览" open={Boolean(packageData)} width={720} centered onCancel={() => setPackageData(undefined)} confirmLoading={applying} okText="导入当前集" cancelText="取消" onOk={() => void confirmApply()}>
                {packageData ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
                            {[
                                ["剧集", packageData.preview.summary.episodes],
                                ["场次", packageData.preview.summary.storyScenes],
                                ["镜头", packageData.preview.summary.shots],
                                ["角色", packageData.preview.summary.characters],
                                ["地点", packageData.preview.summary.locations],
                                ["总时长", `${packageData.preview.summary.duration} 秒`],
                                ["档案章节", packageData.preview.summary.archiveSections],
                                ["Prompt 资产", packageData.preview.summary.promptAssets],
                            ].map(([label, value]) => (
                                <div key={String(label)} className="bg-card px-3 py-2">
                                    <div className="text-xs text-muted-foreground">{label}</div>
                                    <div className="font-semibold">{value}</div>
                                </div>
                            ))}
                        </div>
                        {packageData.preview.package.project.productionBible?.productionPlan ? (
                            <div className="grid gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs sm:grid-cols-3">
                                <span>视觉风格：{packageData.preview.package.project.productionBible.productionPlan.visual.visualStyle}</span>
                                <span>画风：{packageData.preview.package.project.productionBible.productionPlan.visual.artStyle}</span>
                                <span>每镜：{packageData.preview.package.project.productionBible.productionPlan.video.shotDuration || 15} 秒 · {packageData.preview.package.project.productionBible.productionPlan.video.framePolicy === "fixed-4" ? "4 帧" : packageData.preview.package.project.productionBible.productionPlan.video.framePolicy === "fixed-5" ? "5 帧" : "智能切分"}</span>
                            </div>
                        ) : null}
                        <pre className="hide-scrollbar max-h-[48vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-3 text-xs leading-5">{packageData.markdown}</pre>
                    </div>
                ) : null}
            </Modal>
            <Modal
                title="锁定本集生产方案"
                open={planOpen}
                width={640}
                centered
                onCancel={() => {
                    setPlanOpen(false);
                    setPendingPackage(false);
                }}
                okText="保存并继续"
                cancelText="取消"
                onOk={savePlan}
            >
                <div className="space-y-3">
                    <label className="block space-y-1">
                        <span className="text-xs font-medium">剧本 Skill（可选，显式选择）</span>
                        <Select
                            mode="multiple"
                            className="w-full"
                            loading={skillsLoading}
                            value={planDraft.skills.map((item) => item.id)}
                            options={skills.map((skill) => ({ label: skill.name, value: skill.id }))}
                            onChange={(ids: string[]) =>
                                setPlanDraft((current) => ({
                                    ...current,
                                    skills: ids.map((id) => {
                                        const skill = skills.find((item) => item.id === id);
                                        return { id, name: skill?.name || id, version: skill?.sourceVersion || "current" };
                                    }),
                                }))
                            }
                        />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                            <span className="text-xs font-medium">视觉风格</span>
                            <Input
                                value={planDraft.visual.visualStyle}
                                placeholder="留空由 Agent 智能建议"
                                onChange={(event) => setPlanDraft((current) => ({ ...current, visual: { ...current.visual, visualStyle: event.target.value, source: "manual" } }))}
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs font-medium">画风</span>
                            <Input
                                value={planDraft.visual.artStyle}
                                placeholder="留空由 Agent 智能建议"
                                onChange={(event) => setPlanDraft((current) => ({ ...current, visual: { ...current.visual, artStyle: event.target.value, source: "manual" } }))}
                            />
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-1">
                            <span className="text-xs font-medium">模式</span>
                            <Select
                                className="w-full"
                                value={planDraft.video.mode}
                                options={[
                                    { label: "分镜驱动", value: "storyboard" },
                                    { label: "直接生成", value: "text-to-video" },
                                ]}
                                onChange={(mode) => setPlanDraft((current) => ({ ...current, video: { ...current.video, mode } }))}
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs font-medium">清晰度</span>
                            <Select
                                className="w-full"
                                value={planDraft.video.resolution}
                                options={DRAMA_VIDEO_RESOLUTION_OPTIONS.map((value) => ({ label: value, value }))}
                                onChange={(resolution) => setPlanDraft((current) => ({ ...current, video: { ...current.video, resolution } }))}
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs font-medium">每镜时长</span>
                                <Select
                                className="w-full"
                                value={planDraft.video.shotDuration || 15}
                                options={DRAMA_SCRIPT_SHOT_DURATION_OPTIONS.map((value) => ({ label: `${value} 秒`, value }))}
                                onChange={(shotDuration) => {
                                    if (shotDuration === 15 || shotDuration === 30) setPlanDraft((current) => ({ ...current, video: { ...current.video, shotDuration } }));
                                }}
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs font-medium">每镜帧数</span>
                                <Select
                                className="w-full"
                                value={planDraft.video.framePolicy || "agent"}
                                options={[
                                    { label: "4 帧", value: "fixed-4" },
                                    { label: "5 帧", value: "fixed-5" },
                                    { label: "Agent 智能切分", value: "agent" },
                                ]}
                                onChange={(framePolicy: "fixed-4" | "fixed-5" | "agent") =>
                                    setPlanDraft((current) => {
                                        const video = { ...current.video, framePolicy };
                                        if (framePolicy === "fixed-4") return { ...current, video: { ...video, frameCount: 4 } };
                                        if (framePolicy === "fixed-5") return { ...current, video: { ...video, frameCount: 5 } };
                                        const { frameCount: _frameCount, ...agentVideo } = video;
                                        return { ...current, video: agentVideo };
                                    })
                                }
                            />
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {planDraft.video.mode === "storyboard" ? (
                            <div className="flex items-center text-xs text-muted-foreground">输入：分镜帧 + 资产参考图</div>
                        ) : (
                            <label className="block space-y-1">
                                <span className="text-xs font-medium">参考图数量</span>
                                <Select
                                    className="w-full"
                                    value={`${planDraft.references.minImages}-${planDraft.references.maxImages}`}
                                    options={[
                                        { label: "智能 3–5 张", value: "3-5" },
                                        { label: "智能 3–4 张", value: "3-4" },
                                        { label: "智能 4–5 张", value: "4-5" },
                                    ]}
                                    onChange={(value) => {
                                        const [min, max] = value.split("-").map(Number);
                                        setPlanDraft((current) => ({ ...current, references: { ...current.references, minImages: min, maxImages: max } }));
                                    }}
                                />
                            </label>
                        )}
                        <label className="block space-y-1">
                            <span className="text-xs font-medium">音频</span>
                            <Select
                                className="w-full"
                                value={planDraft.video.audioMode}
                                options={[
                                    { label: "模型原生音轨", value: "native" },
                                    { label: "后期配音", value: "voiceover" },
                                    { label: "静音", value: "mute" },
                                ]}
                                onChange={(audioMode) => setPlanDraft((current) => ({ ...current, video: { ...current.video, audioMode } }))}
                            />
                        </label>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                        Agent 会按每镜 {planDraft.video.shotDuration || 15} 秒和“{planDraft.video.framePolicy === "fixed-4" ? "4 帧" : planDraft.video.framePolicy === "fixed-5" ? "5 帧" : "智能切分"}”重新切分剧情；相邻碎片镜头会合并为完整逻辑镜头。空白视觉参数由 Agent 补出具体值并写入制作包。连续性固定为严格模式：下一镜只能引用上一镜当前视频版本且已人工验收的实际尾帧。
                    </p>
                </div>
            </Modal>
        </div>
    );
    if (!desktop)
        return (
            <Drawer placement="right" open={open} onClose={() => onOpenChange(false)} closable={false} size={360} mask={false} styles={{ wrapper: { maxWidth: "calc(100vw - 8px)" }, body: { padding: 0 } }}>
                {content}
            </Drawer>
        );
    return (
        <div className={`h-full min-h-0 shrink-0 overflow-hidden border-l border-border bg-card transition-[width,opacity] duration-200 ${open ? "w-[420px] opacity-100" : "pointer-events-none w-0 opacity-0"}`} aria-hidden={!open}>
            {content}
        </div>
    );
}
