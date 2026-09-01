"use client";

import { App, Button, Checkbox, Divider, Input, Modal, Popover, Progress, Select, Tag } from "antd";
import { Ban, Check, LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { DramaAssetGenerationBatch, DramaProject } from "@/lib/drama-project-contract";
import { approvedAssetReference } from "@/lib/drama-asset-baseline";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { cancelDramaAssetGenerationBatch, createDramaAssetGenerationBatch, getDramaAssetGenerationBatch, listDramaAssetGenerationBatches, retryDramaAssetGenerationBatch } from "@/services/api/drama-projects";
import { dramaAssetReferences } from "./drama-asset-reference-utils";
import { dramaAssetAutoCompletionItems } from "./drama-asset-library-utils";

type BatchKind = "characters" | "scenes" | "props";
const kinds: BatchKind[] = ["characters", "scenes", "props"];
const labels: Record<BatchKind, string> = { characters: "角色", scenes: "场景", props: "道具" };

export function DramaAssetGenerationBatchPanel({ project, onProjectReload }: { project: DramaProject; onProjectReload: () => void }) {
    const { message } = App.useApp();
    const config = useEffectiveConfig();
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [selectionQuery, setSelectionQuery] = useState("");
    const [selectionFilter, setSelectionFilter] = useState<"all" | "missing" | "used">("all");
    const [batch, setBatch] = useState<DramaAssetGenerationBatch>();
    const [loading, setLoading] = useState(false);
    const [completeSettings, setCompleteSettings] = useState(true);
    const [batchesLoading, setBatchesLoading] = useState(false);
    const [progressOpen, setProgressOpen] = useState(false);

    const assets = useMemo(() => kinds.flatMap((kind) => project[kind].map((asset) => ({ kind, asset, key: `${kind}:${asset.id}` }))), [project]);
    const missingKeys = assets.filter(({ asset }) => !dramaAssetReferences(asset).length).map(({ key }) => key);
    const selectedAssets = assets.filter(({ key }) => selected.includes(key));
    const selectableAssets = assets.filter(({ asset }) => {
        const matchesQuery = !selectionQuery.trim() || asset.name.toLowerCase().includes(selectionQuery.trim().toLowerCase());
        const matchesFilter = selectionFilter === "all" || (selectionFilter === "missing" ? !approvedAssetReference(asset) : dramaAssetReferences(asset).length > 0);
        return matchesQuery && matchesFilter;
    });
    const percent = batch?.totalCount ? Math.round((batch.completedCount / batch.totalCount) * 100) : 0;
    const active = batch && ["queued", "running"].includes(batch.status);

    useEffect(() => {
        let disposed = false;
        setBatchesLoading(true);
        listDramaAssetGenerationBatches(project.id)
            .then((items) => {
                if (disposed) return;
                const latest = items[0];
                if (!latest) return;
                return getDramaAssetGenerationBatch(project.id, latest.id)
                    .catch(() => latest)
                    .then((detail) => {
                        if (disposed) return;
                        setBatch(detail);
                        setCompleteSettings(detail.executionConfig?.completeSettings !== false);
                    });
            })
            .catch(() => undefined)
            .finally(() => {
                if (!disposed) setBatchesLoading(false);
            });
        return () => {
            disposed = true;
        };
    }, [project.id]);

    useEffect(() => {
        if (!batch?.id || !active) return;
        const timer = window.setInterval(() => {
            void getDramaAssetGenerationBatch(project.id, batch.id)
                .then((next) => {
                    setBatch(next);
                    onProjectReload();
                })
                .catch(() => undefined);
        }, 5000);
        return () => window.clearInterval(timer);
    }, [active, batch?.id, onProjectReload, project.id]);

    const submit = async () => {
        if (!selectedAssets.length) return message.warning("请至少选择一个角色、场景或道具");
        setLoading(true);
        try {
            const created = await createDramaAssetGenerationBatch(
                project.id,
                selectedAssets.map(({ kind, asset }) => ({ kind, assetId: asset.id })),
                { ...config, model: config.imageModel || config.model, imageModel: config.imageModel || config.model, count: "1", completeSettings },
            );
            setBatch(created);
            setOpen(false);
            setSelected([]);
            message.success(`已提交 ${created.totalCount} 个素材的批量生成任务`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "批量生成提交失败");
        } finally {
            setLoading(false);
        }
    };

    const cancel = async () => {
        if (!batch) return;
        setLoading(true);
        try {
            setBatch(await cancelDramaAssetGenerationBatch(project.id, batch.id));
            message.success("批量任务已取消");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "取消失败");
        } finally {
            setLoading(false);
        }
    };

    const retry = async () => {
        if (!batch) return;
        setLoading(true);
        try {
            setBatch(await retryDramaAssetGenerationBatch(project.id, batch.id, { ...config, model: config.imageModel || config.model, imageModel: config.imageModel || config.model, count: "1", completeSettings }));
            message.success("失败项已重新排队");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "重试失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button type="primary" icon={<Sparkles className="size-3.5" />} onClick={() => setOpen(true)}>
                批量生成素材
            </Button>
            {batch && batch.totalCount ? (
                <div className="mt-3 flex items-center justify-end" data-drama-asset-generation-progress>
                    <Popover
                        open={progressOpen}
                        onOpenChange={setProgressOpen}
                        trigger="click"
                        placement="bottomRight"
                        autoAdjustOverflow
                        align={{ offset: [0, 8] }}
                        styles={{ content: { width: "min(760px, calc(100vw - 24px))", maxWidth: "calc(100vw - 24px)", maxHeight: "calc(100vh - 160px)", overflow: "hidden", padding: 12 } }}
                        overlayClassName="drama-asset-generation-progress-popover"
                        content={
                            <BatchProgressDetails
                                batch={batch}
                                percent={percent}
                                active={Boolean(active)}
                                loading={loading}
                                onCancel={() => void cancel()}
                                onRetry={() => void retry()}
                                onClose={() => {
                                    setProgressOpen(false);
                                    setBatch(undefined);
                                }}
                            />
                        }
                    >
                        <Button size="small" icon={<Sparkles className="size-3.5" />}>
                            批量生成进度{" "}
                            <Tag className="!mr-0">
                                {batch.completedCount}/{batch.totalCount}
                            </Tag>
                        </Button>
                    </Popover>
                </div>
            ) : null}
            <Modal
                title="批量生成素材"
                open={open}
                onCancel={() => setOpen(false)}
                onOk={() => void submit()}
                okText="开始批量生成"
                cancelText="取消"
                confirmLoading={loading}
                width={720}
                styles={{ container: { maxWidth: "calc(100vw - 24px)" }, body: { maxHeight: "calc(100vh - 190px)", overflowY: "auto" } }}
            >
                <p className="text-sm text-muted-foreground">每个资产生成 1 张候选图，不会覆盖已有主基准图；全部完成后请逐个审核。</p>
                <div className="mt-3 grid gap-2">
                    <Checkbox checked={completeSettings} onChange={(event) => setCompleteSettings(event.target.checked)}>
                        同时补全缺失设定
                    </Checkbox>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Input size="small" className="min-w-[180px] flex-1" value={selectionQuery} onChange={(event) => setSelectionQuery(event.target.value)} placeholder="搜索角色、场景或道具" aria-label="搜索批量生成资产" />
                    <Select
                        size="small"
                        value={selectionFilter}
                        onChange={setSelectionFilter}
                        options={[
                            { value: "all", label: "全部状态" },
                            { value: "missing", label: "缺基准" },
                            { value: "used", label: "已有参考图" },
                        ]}
                        aria-label="筛选批量生成资产"
                    />
                    <Button size="small" onClick={() => setSelected(missingKeys)}>
                        选择全部缺基准
                    </Button>
                    <Button size="small" onClick={() => setSelected([])}>
                        清空选择
                    </Button>
                    <span className="self-center text-xs text-muted-foreground">已选 {selectedAssets.length} 个素材</span>
                </div>
                {kinds.map((kind) => {
                    const rows = selectableAssets.filter((item) => item.kind === kind);
                    const allRows = assets.filter((item) => item.kind === kind);
                    const checked = rows.length > 0 && rows.every((item) => selected.includes(item.key));
                    return (
                        <div key={kind} className="mt-4">
                            <div className="flex items-center justify-between">
                                <Checkbox
                                    checked={checked}
                                    indeterminate={!checked && rows.some((item) => selected.includes(item.key))}
                                    onChange={(event) => {
                                        const keys = rows.map((item) => item.key);
                                        setSelected((current) => (event.target.checked ? [...new Set([...current, ...keys])] : current.filter((key) => !keys.includes(key))));
                                    }}
                                >
                                    {labels[kind]}（{allRows.length}）
                                </Checkbox>
                                <span className="text-xs text-muted-foreground">{allRows.filter((item) => !dramaAssetReferences(item.asset).length).length} 个缺基准</span>
                            </div>
                            <Divider className="!my-2" />
                            <div className="grid gap-2 sm:grid-cols-2">
                                {rows.map(({ asset, key }) => (
                                    <label key={key} className="flex min-w-0 cursor-pointer items-center gap-2 rounded border border-border px-2.5 py-2 hover:bg-muted/50">
                                        <Checkbox checked={selected.includes(key)} onChange={(event) => setSelected((current) => (event.target.checked ? [...current, key] : current.filter((value) => value !== key)))} />
                                        <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                                        <span className="shrink-0 text-[11px] text-muted-foreground">
                                            {dramaAssetAutoCompletionItems(asset, kind)
                                                .map((item) => item.label)
                                                .join("、") || "设定完整"}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
                <div className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    当前模型：{config.imageModel || config.model || "后台默认图片模型"} · 预计候选图：{selectedAssets.length} 张
                </div>
            </Modal>
            {batchesLoading ? <span className="sr-only">正在读取批量生成进度</span> : null}
        </>
    );
}

function BatchProgressDetails({ batch, percent, active, loading, onCancel, onRetry, onClose }: { batch: DramaAssetGenerationBatch; percent: number; active: boolean; loading: boolean; onCancel: () => void; onRetry: () => void; onClose: () => void }) {
    return (
        <div className="w-full min-w-0 max-w-full">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <Sparkles className="size-4 text-muted-foreground" />
                    <strong className="text-sm">批量生成进度</strong>
                    <Tag>
                        {batch.completedCount}/{batch.totalCount}
                    </Tag>
                </div>
                <div className="flex shrink-0 gap-1">
                    {active ? (
                        <Button size="small" icon={<Ban className="size-3.5" />} loading={loading} onClick={onCancel}>
                            取消未完成
                        </Button>
                    ) : null}
                    {batch.failedCount ? (
                        <Button size="small" icon={<RefreshCw className="size-3.5" />} loading={loading} onClick={onRetry}>
                            重试失败项
                        </Button>
                    ) : null}
                    {!active ? (
                        <Button size="small" type="text" icon={<X className="size-3.5" />} onClick={onClose}>
                            关闭
                        </Button>
                    ) : null}
                </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
                <Progress className="min-w-0 flex-1" percent={percent} showInfo={false} />
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>成功 {batch.successCount}</span>
                <span>失败 {batch.failedCount}</span>
                <span>取消 {batch.cancelledCount}</span>
                {batch.currentItemId ? <span>当前：{batch.items.find((item) => item.id === batch.currentItemId)?.assetName}</span> : null}
            </div>
            <div className="mt-3 grid max-h-[calc(100vh-240px)] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {batch.items.map((item) => (
                    <div key={item.id} className="grid min-w-0 gap-1 rounded border border-border px-2 py-1.5 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                            <StatusIcon status={item.status} />
                            <span className="min-w-0 flex-1 truncate">{item.assetName}</span>
                            <span className="shrink-0 text-muted-foreground">{batchItemStatusLabel(item)}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
                            <span>设定：{item.planningStatus === "success" ? "已补" : item.planningStatus === "error" ? "失败" : item.planningStatus === "queued" ? "排队中" : "无需"}</span>
                            <span>音色：{item.voiceStatus === "success" ? "已补" : item.voiceStatus === "error" ? "失败" : item.voiceStatus === "not_applicable" ? "不适用" : "排队中"}</span>
                            <span>
                                基准图：{item.referenceStatus === "primary" ? "已设主基准" : item.referenceStatus === "candidate" ? "候选已生成" : item.referenceStatus === "error" ? "失败" : item.referenceStatus === "not_applicable" ? "无需" : "排队中"}
                            </span>
                            {item.generationExecutionPhase ? <span>任务：{generationPhaseLabel(item.generationExecutionPhase)}</span> : null}
                        </div>
                        {item.error || item.planningError || item.voiceError || item.referenceError ? <div className="break-words text-[10px] text-rose-600">原因：{item.error || item.planningError || item.voiceError || item.referenceError}</div> : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

function batchItemStatusLabel(item: DramaAssetGenerationBatch["items"][number]) {
    if (item.status === "success") return "已完成";
    if (item.status === "error") return "生成失败";
    if (item.status === "cancelled") return "已取消";
    if (item.status === "queued") return "排队中";
    return generationPhaseLabel(item.generationExecutionPhase) || "生成中";
}

function generationPhaseLabel(phase: DramaAssetGenerationBatch["items"][number]["generationExecutionPhase"]) {
    if (phase === "created") return "等待执行";
    if (phase === "submitting") return "提交上游";
    if (phase === "submitted") return "上游已受理";
    if (phase === "polling") return "上游处理中";
    if (phase === "result_ready") return "结果待回收";
    if (phase === "persisting") return "保存素材";
    if (phase === "needs_review") return "待确认";
    return undefined;
}

function StatusIcon({ status }: { status: DramaAssetGenerationBatch["items"][number]["status"] }) {
    if (status === "success") return <Check className="size-3.5 text-emerald-600" />;
    if (status === "error") return <X className="size-3.5 text-rose-600" />;
    if (status === "cancelled") return <Ban className="size-3.5 text-muted-foreground" />;
    return <LoaderCircle className={`size-3.5 text-muted-foreground ${status === "running" ? "animate-spin" : ""}`} />;
}
