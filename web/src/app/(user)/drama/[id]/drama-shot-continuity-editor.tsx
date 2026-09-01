"use client";

import { App, Button, Input, Modal } from "antd";
import { Bot, ChevronDown, LoaderCircle, Send, SlidersHorizontal, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { syncUserPointsFromHeaders } from "@/services/api/points";
import type { DramaEpisode, DramaProject, DramaReviewCompletion, DramaShot, DramaShotContinuity } from "@/lib/drama-project-contract";
import { useDramaStore } from "../stores/use-drama-store";

export function DramaShotContinuityEditor({ project, episode, shot }: { project: DramaProject; episode: DramaEpisode; shot: DramaShot }) {
    const { message } = App.useApp();
    const updateShot = useDramaStore((state) => state.updateShot);
    const applyContinuitySuggestion = useDramaStore((state) => state.applyContinuitySuggestion);
    const [open, setOpen] = useState(false);
    const [agentOpen, setAgentOpen] = useState(false);
    const [agentInput, setAgentInput] = useState("");
    const [agentMessages, setAgentMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
    const [suggestion, setSuggestion] = useState<DramaReviewCompletion["shots"][number]>();
    const [agentLoading, setAgentLoading] = useState(false);
    const continuity = { ...emptyContinuity, ...shot.continuity };
    const updateContinuity = (key: keyof DramaShotContinuity, value: string) => updateShot(project.id, episode.id, shot.id, { continuity: { ...continuity, [key]: value } });
    const panelId = `shot-continuity-${shot.id}`;
    const contextShots = useMemo(() => {
        const index = episode.shots.findIndex((item) => item.id === shot.id);
        return episode.shots.slice(Math.max(0, index - 1), index + 2);
    }, [episode.shots, shot.id]);
    const openAgent = () => {
        setAgentOpen(true);
        if (!agentMessages.length) setAgentMessages([{ role: "assistant", content: "我会结合当前镜头、前后镜头、人物站位和项目资产，生成可回填的连续性方案。你可以直接告诉我想改善的地方。" }]);
    };
    const askAgent = async () => {
        const request = agentInput.trim();
        if (!request || agentLoading) return;
        setAgentInput("");
        setAgentMessages((current) => [...current, { role: "user", content: request }]);
        setAgentLoading(true);
        try {
            const previousRequests = agentMessages.filter((item) => item.role === "user").map((item) => item.content);
            const response = await fetch("/api/drama/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phase: "review_completion",
                    completionFields: ["continuity", "entryState", "exitState"],
                    forceShotIds: [shot.id],
                    instruction: [...previousRequests, request].join("\n"),
                    summary: project.summary,
                    style: project.style,
                    episode: { id: episode.id, title: episode.title, script: episode.script, outline: episode.outline },
                    characters: project.characters,
                    scenes: project.scenes,
                    props: project.props,
                    clues: project.clues,
                    shots: contextShots,
                }),
            });
            syncUserPointsFromHeaders(response.headers, "system");
            const payload = (await response.json().catch(() => ({}))) as { data?: DramaReviewCompletion; msg?: string };
            if (!response.ok || !payload.data) throw new Error(payload.msg || "连续性 Agent 没有返回可用建议");
            const next = payload.data.shots.find((item) => item.shotId === shot.id);
            if (!next) throw new Error("连续性 Agent 没有返回当前镜头建议");
            setSuggestion(next);
            setAgentMessages((current) => [...current, { role: "assistant", content: "已生成当前镜头的连续性建议。请先查看右侧预览，确认后再回填。" }]);
        } catch (error) {
            const content = error instanceof Error ? error.message : "连续性 Agent 请求失败";
            setAgentMessages((current) => [...current, { role: "assistant", content }]);
        } finally {
            setAgentLoading(false);
        }
    };
    const applySuggestion = () => {
        if (!suggestion) return;
        applyContinuitySuggestion(project.id, episode.id, { shots: [suggestion] });
        setSuggestion(undefined);
        message.success("连续性建议已回填当前镜头");
    };

    return (
        <div className="mt-5 border-t border-border/70 pt-4">
            <div className={`group grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-lg border px-3 text-left transition-colors ${open ? "border-foreground/25 bg-muted/25" : "border-border/70 bg-background"}`}>
                <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-foreground transition-colors group-hover:bg-muted/80">
                        <SlidersHorizontal className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden">
                        <span className="truncate text-base font-semibold text-foreground">连续性控制</span>
                        <span className="truncate text-xs text-muted-foreground">站位、视线、轴线与动作衔接</span>
                    </span>
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                        size="small"
                        icon={<Sparkles className="size-3.5" />}
                        onClick={(event) => {
                            event.stopPropagation();
                            openAgent();
                        }}
                    >
                        AI 智能生成
                    </Button>
                    <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => setOpen((value) => !value)}
                        className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${open ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:border-foreground/30 hover:bg-muted/70"}`}
                    >
                        <span>{open ? "收起" : "设置连续性"}</span>
                        <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                    </button>
                </div>
            </div>
            {open ? (
                <div id={panelId} className="mt-2 grid gap-3 rounded-md bg-muted/20 p-3 sm:grid-cols-2">
                    <ContinuityInput label="景别" value={continuity.shotSize} placeholder="特写 / 近景 / 中景 / 全景" onChange={(value) => updateContinuity("shotSize", value)} />
                    <ContinuityInput label="机位与角度" value={continuity.cameraAngle} placeholder="平视、俯拍、侧后方" onChange={(value) => updateContinuity("cameraAngle", value)} />
                    <ContinuityInput label="构图" value={continuity.composition} placeholder="主体位于画面左侧，门口留出视线空间" onChange={(value) => updateContinuity("composition", value)} />
                    <ContinuityInput label="人物站位" value={continuity.characterBlocking} placeholder="女主在前景右侧，男主位于门边" onChange={(value) => updateContinuity("characterBlocking", value)} />
                    <ContinuityInput label="视线与屏幕方向" value={continuity.gazeDirection} placeholder="女主看向画面左侧，保持向右运动" onChange={(value) => updateContinuity("gazeDirection", value)} />
                    <ContinuityInput label="轴线规则" value={continuity.axisRule} placeholder="保持人物连线同侧，不越轴" onChange={(value) => updateContinuity("axisRule", value)} />
                    <ContinuityTextArea label="动作起始状态" value={continuity.actionStart} placeholder="镜头开始时人物正在做什么" onChange={(value) => updateContinuity("actionStart", value)} />
                    <ContinuityTextArea label="动作结束状态" value={continuity.actionEnd} placeholder="镜头结束时动作停在哪里，为下一镜头留下什么状态" onChange={(value) => updateContinuity("actionEnd", value)} />
                    <ContinuityTextArea label="相邻镜头备注" value={continuity.continuityNotes} placeholder="与上一镜头或下一镜头必须保持的细节" onChange={(value) => updateContinuity("continuityNotes", value)} />
                </div>
            ) : null}
            <Modal
                title={
                    <span className="flex items-center gap-2">
                        <Bot className="size-4" />
                        连续性 Agent 协作
                    </span>
                }
                open={agentOpen}
                onCancel={() => setAgentOpen(false)}
                footer={null}
                width={680}
                centered
                destroyOnHidden
                styles={{ container: { maxWidth: "calc(100vw - 24px)" } }}
            >
                <div className="grid gap-3 pt-1">
                    <div className="rounded-md border border-border bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                        当前镜头：{shot.title || `镜头 ${shot.order}`} · 已带入前后镜头和项目资产设定。Agent 只生成连续性字段，不会修改画面提示词或剧情事实。
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border/70 bg-background p-3">
                        {agentMessages.map((item, index) => (
                            <div key={`${item.role}-${index}`} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-5 ${item.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{item.content}</div>
                            </div>
                        ))}
                        {agentLoading ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <LoaderCircle className="size-3.5 animate-spin" />
                                正在分析相邻镜头连续性…
                            </div>
                        ) : null}
                    </div>
                    {suggestion ? (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">待回填建议</span>
                                <Button type="primary" size="small" onClick={applySuggestion}>
                                    回填当前镜头
                                </Button>
                            </div>
                            <div className="grid gap-1 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
                                <span>景别：{suggestion.continuity?.shotSize || "未返回"}</span>
                                <span>机位：{suggestion.continuity?.cameraAngle || "未返回"}</span>
                                <span>构图：{suggestion.continuity?.composition || "未返回"}</span>
                                <span>站位：{suggestion.continuity?.characterBlocking || "未返回"}</span>
                                <span className="sm:col-span-2">
                                    动作衔接：{suggestion.continuity?.actionStart || "未返回"} → {suggestion.continuity?.actionEnd || "未返回"}
                                </span>
                                <span className="sm:col-span-2">备注：{suggestion.continuity?.continuityNotes || "未返回"}</span>
                            </div>
                        </div>
                    ) : null}
                    <div className="flex items-end gap-2">
                        <Input.TextArea
                            value={agentInput}
                            onChange={(event) => setAgentInput(event.target.value)}
                            onPressEnter={(event) => {
                                if (!event.shiftKey) {
                                    event.preventDefault();
                                    void askAgent();
                                }
                            }}
                            autoSize={{ minRows: 2, maxRows: 4 }}
                            placeholder="例如：让这一镜和上一镜的视线方向更自然，保留女主右侧站位"
                            disabled={agentLoading}
                        />
                        <Button type="primary" shape="circle" icon={<Send className="size-4" />} disabled={!agentInput.trim() || agentLoading} onClick={() => void askAgent()} aria-label="发送连续性 Agent 请求" />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function ContinuityInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
        </label>
    );
}

function ContinuityTextArea({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
    return (
        <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <Input.TextArea value={value} onChange={(event) => onChange(event.target.value)} autoSize={{ minRows: 1, maxRows: 3 }} placeholder={placeholder} />
        </label>
    );
}

const emptyContinuity: DramaShotContinuity = {
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
