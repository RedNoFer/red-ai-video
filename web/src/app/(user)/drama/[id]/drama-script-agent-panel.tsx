"use client";

import { App, Button, Drawer, Input, Modal, Popover, Select, Tooltip } from "antd";
import { Bot, History, LoaderCircle, MessageSquarePlus, Send, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";

import type { CreativeConversation, CreativeMessage } from "@/lib/creative-runtime-contract";
import type { DramaProductionPackagePreview, DramaProject, DramaEpisode } from "@/lib/drama-project-contract";
import { AgentMarkdown } from "@/components/agent/agent-markdown";
import { createCreativeAgentRun, createCreativeConversation, listCreativeConversationPage, listCreativeMessages, watchCreativeAgentRun } from "@/services/api/creative";
import { applyDramaEpisodeProductionPackage } from "@/services/api/drama-projects";
import { useDramaStore } from "../stores/use-drama-store";
import { useCreativeAgentOptions } from "@/hooks/use-creative-agent-options";
import { defaultDramaProductionPlan, DRAMA_VIDEO_RESOLUTION_OPTIONS, normalizeDramaProductionPlan } from "@/lib/drama-production-plan";
import type { DramaProductionPlan } from "@/lib/drama-project-contract";

type Props = { project: DramaProject; episode: DramaEpisode; open: boolean; onOpenChange: (open: boolean) => void };

export function DramaScriptAgentPanel({ project, episode, open, onOpenChange }: Props) {
    const { message } = App.useApp();
    const replaceProject = useDramaStore((state) => state.replaceProject);
    const saveProjectNow = useDramaStore((state) => state.saveProjectNow);
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
    const { skills, skillsLoading } = useCreativeAgentOptions("drama", ["video"]);
    useEffect(() => {
        setPlanDraft(normalizeDramaProductionPlan(project.productionBible?.productionPlan, defaultDramaProductionPlan("new-project"))!);
    }, [project.id, project.productionBible?.productionPlan]);
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

    const submit = async (requestedPrompt = prompt) => {
        const content = requestedPrompt.trim();
        if (!content || sending) return;
        const item = await ensureConversation();
        setPrompt("");
        setSending(true);
        const result = await createCreativeAgentRun({
            clientRequestId: `drama-script:${project.id}:${episode.id}:${nanoid()}`,
            surface: "drama",
            workflow: "drama-script",
            conversationId: item.id,
            projectId: project.id,
            episodeId: episode.id,
            prompt: content,
            assetIds: [],
            skillIds: planDraft.skills.map((skill) => skill.id),
            modelIds: [],
            snapshot: { episodeId: episode.id, productionPlan: planDraft },
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
    };
    const savePlan = async () => {
        const next = normalizeDramaProductionPlan(planDraft, defaultDramaProductionPlan("new-project"))!;
        const productionBible = {
            ...(project.productionBible || {}),
            language: project.productionBible?.language || "zh-CN",
            ratio: project.productionBible?.ratio || "9:16",
            visualStyle: project.productionBible?.visualStyle || "",
            continuityMode: project.productionBible?.continuityMode || "strict",
            productionPlan: { ...next, lockedAt: new Date().toISOString(), source: "manual" as const },
        };
        const defaultVideoMode = next.video.mode === "text-to-video" ? "direct" : "storyboard";
        useDramaStore.getState().updateProject(project.id, { productionBible, defaultVideoMode });
        setPlanDraft(productionBible.productionPlan);
        setPlanOpen(false);
        await saveProjectNow(project.id);
        if (pendingPackage) {
            setPendingPackage(false);
            void submit("请基于当前项目、当前集、本次锁定的生产方案和本次对话上下文，生成完整的 vozeb-drama-production-package-v1 Markdown 制作包，只包含当前集，并为每个镜头生成有序多帧 referenceManifest。");
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
                <div className="mt-2 flex justify-end gap-2">
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
                    <Button type="primary" icon={<Send className="size-3.5" />} loading={sending} disabled={!prompt.trim()} onClick={() => void submit()}>
                        发送
                    </Button>
                </div>
            </div>
            <Modal title="当前集制作包预览" open={Boolean(packageData)} width={720} centered onCancel={() => setPackageData(undefined)} confirmLoading={applying} okText="确认回填当前集" cancelText="取消" onOk={() => void confirmApply()}>
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
                    <p className="text-xs leading-5 text-muted-foreground">连续性固定为严格模式：下一镜只能引用上一镜当前视频版本且已人工验收的实际尾帧；模型不支持多图时不会自动改成首尾帧。</p>
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
