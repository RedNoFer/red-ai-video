"use client";

import { App, Button, Checkbox, Drawer, Empty, Input, InputNumber, Select, Space, Switch, Tag } from "antd";
import { AlertTriangle, ArrowDown, ArrowUp, GitBranch, Pencil, RefreshCw, Route, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { LabeledControl, SectionTitle } from "@/components/admin/admin-settings-controls";
import type { LogicalModel, LogicalModelBinding, LogicalModelCapability, LogicalModelCapabilityProfile, SystemDefaultModels, SystemModelChannel } from "@/lib/auth/store";
import { capabilityLabel, isLogicalModelResolvable, modelRoutingValidationErrors, normalizeDefaultModelsConfig, resolveLogicalModelConfig, synchronizeLogicalModelsWithChannels } from "@/lib/model-routing-config";

type Props = {
    channels: SystemModelChannel[];
    logicalModels: LogicalModel[];
    defaultModels: SystemDefaultModels;
    onChange: (value: { logicalModels: LogicalModel[]; defaultModels: SystemDefaultModels }) => void;
};

const capabilityOptions: Array<{ label: string; value: LogicalModelCapability }> = [
    { label: "文本", value: "text" },
    { label: "图片", value: "image" },
    { label: "视频", value: "video" },
    { label: "音频", value: "audio" },
];

const defaultFields: Array<{ capability: LogicalModelCapability; key: keyof SystemDefaultModels; label: string }> = [
    { capability: "text", key: "textModel", label: "默认文本模型" },
    { capability: "image", key: "imageModel", label: "默认图片模型" },
    { capability: "video", key: "videoModel", label: "默认视频模型" },
    { capability: "audio", key: "audioModel", label: "默认音频模型（短剧 AI 配音）" },
];

export function AdminLogicalModelManager({ channels, logicalModels, defaultModels, onChange }: Props) {
    const { message } = App.useApp();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingId, setEditingId] = useState("");
    const [draft, setDraft] = useState<LogicalModel | null>(null);
    const [draftCapabilities, setDraftCapabilities] = useState<LogicalModelCapability[]>([]);
    const [query, setQuery] = useState("");
    const [capabilityFilter, setCapabilityFilter] = useState<LogicalModelCapability | "all">("all");
    const deferredQuery = useDeferredValue(query.trim().toLowerCase());
    const visibleModels = useMemo(
        () =>
            logicalModels.filter(
                (model) => (capabilityFilter === "all" || model.capability === capabilityFilter) && (!deferredQuery || `${model.id} ${model.name} ${model.bindings.map((binding) => binding.upstreamModel).join(" ")}`.toLowerCase().includes(deferredQuery)),
            ),
        [capabilityFilter, deferredQuery, logicalModels],
    );
    const availableDefaultFields = defaultFields.filter(({ capability }) => logicalModels.some((model) => model.capability === capability && isLogicalModelResolvable(logicalModels, channels, capability, model.id)));
    const availableCapabilityOptions = capabilityOptions.filter(({ value }) => availableDefaultFields.some(({ capability }) => capability === value));
    const readyCount = availableDefaultFields.filter(({ capability, key }) => isLogicalModelResolvable(logicalModels, channels, capability, defaultModels[key] || "")).length;

    const openEdit = (model: LogicalModel) => {
        setEditingId(model.id);
        setDraft(cloneLogicalModel(model));
        setDraftCapabilities(capabilitiesForModel(logicalModels, model));
        setDrawerOpen(true);
    };

    const saveDraft = () => {
        if (!draft) return;
        const name = draft.name.trim();
        if (!name) {
            message.error("请填写前端展示昵称");
            return;
        }
        if (!draftCapabilities.length) {
            message.error("至少选择一项能力类型");
            return;
        }
        const original = logicalModels.find((model) => model.id === editingId);
        if (!original) {
            message.error("逻辑模型已变化，请重新打开设置");
            return;
        }
        const normalizedDraft = cloneLogicalModel({ ...draft, name });
        const nextModels = buildCapabilityVariants(logicalModels, original, normalizedDraft, draftCapabilities);
        const nextDefaults = normalizeDefaultModelsConfig(defaultModels, nextModels, channels);
        const errors = modelRoutingValidationErrors(nextModels, channels, nextDefaults);
        if (errors.length) {
            message.error(errors[0]);
            return;
        }
        onChange({ logicalModels: nextModels, defaultModels: nextDefaults });
        setDrawerOpen(false);
        message.success("模型路由设置已更新，请保存渠道配置");
    };

    const syncChannelModels = () => {
        const nextModels = synchronizeLogicalModelsWithChannels(logicalModels, channels);
        if (JSON.stringify(nextModels) === JSON.stringify(logicalModels)) {
            message.info("逻辑模型已与渠道目录同步");
            return;
        }
        onChange({ logicalModels: nextModels, defaultModels: normalizeDefaultModelsConfig(defaultModels, nextModels, channels) });
        message.success(`已按上游模型名同步 ${nextModels.length} 个逻辑模型`);
    };

    const updateDefault = (key: keyof SystemDefaultModels, modelId: string) => onChange({ logicalModels, defaultModels: { ...defaultModels, [key]: modelId } });

    return (
        <section className="border-t border-stone-200 pt-5 dark:border-stone-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <SectionTitle icon={<Route className="size-4" />} title="逻辑模型路由" />
                        <Tag color={availableDefaultFields.length && readyCount === availableDefaultFields.length ? "green" : "orange"} className="m-0">
                            默认能力 {readyCount}/{availableDefaultFields.length} 可用
                        </Tag>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">逻辑模型按上游模型与能力独立路由；同名上游模型可同时用于文本、图片、视频和音频。</p>
                </div>
                <Button icon={<RefreshCw className="size-4" />} onClick={syncChannelModels}>
                    重新同步
                </Button>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0">
                    <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
                        <Input allowClear value={query} prefix={<Search className="size-4 text-stone-400" />} placeholder="搜索模型昵称、ID 或上游模型" onChange={(event) => setQuery(event.target.value)} />
                        <Select value={capabilityFilter} options={[{ label: "全部能力", value: "all" }, ...availableCapabilityOptions]} onChange={(value) => setCapabilityFilter(value)} />
                    </div>
                    <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
                        {visibleModels.map((model) => {
                            const resolved = resolveLogicalModelConfig(logicalModels, channels, model.capability, model.id);
                            const isDefault = Object.values(defaultModels).some((value) => value.toLowerCase() === model.id.toLowerCase());
                            return (
                                <div key={model.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800 dark:bg-stone-950">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="truncate text-sm font-semibold text-stone-950 dark:text-stone-100">{model.name}</span>
                                            <Tag className="m-0">{capabilityLabel(model.capability)}</Tag>
                                            <Tag color={model.enabled ? "green" : "default"} className="m-0">
                                                {model.enabled ? "启用" : "停用"}
                                            </Tag>
                                            {isDefault ? (
                                                <Tag color="blue" className="m-0">
                                                    默认
                                                </Tag>
                                            ) : null}
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                                            <span>ID：{model.id}</span>
                                            <span>{model.bindings.length} 个同名渠道绑定</span>
                                            <span className={resolved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{resolved ? `${resolved.channel.name} / ${resolved.binding.upstreamModel}` : "当前无可用渠道"}</span>
                                        </div>
                                    </div>
                                    <Button className="shrink-0" size="small" icon={<Pencil className="size-3.5" />} onClick={() => openEdit(model)}>
                                        路由设置
                                    </Button>
                                </div>
                            );
                        })}
                        {!visibleModels.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={logicalModels.length ? "没有匹配的逻辑模型" : "渠道尚未同步到模型目录"} /> : null}
                    </div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
                    <SectionTitle icon={<GitBranch className="size-4" />} title="默认模型" />
                    <div className="mt-4 space-y-4">
                        {availableDefaultFields.map(({ capability, key, label }) => {
                            const options = logicalModels
                                .filter((model) => model.capability === capability && isLogicalModelResolvable(logicalModels, channels, capability, model.id))
                                .map((model) => ({ label: formatLogicalModelOptionLabel(model, logicalModels), value: model.id }));
                            const selected = logicalModels.find((model) => model.id === defaultModels[key]);
                            const resolved = selected ? resolveLogicalModelConfig(logicalModels, channels, capability, selected.id) : null;
                            return (
                                <LabeledControl key={key} label={label}>
                                    <Select
                                        className="w-full"
                                        allowClear
                                        showSearch
                                        optionFilterProp="label"
                                        value={defaultModels[key] || undefined}
                                        placeholder={`选择可用${capabilityLabel(capability)}模型`}
                                        options={options}
                                        status={defaultModels[key] && !resolved ? "error" : undefined}
                                        onChange={(value) => updateDefault(key, value || "")}
                                    />
                                    <div className={`mt-1 flex items-center gap-1 text-xs ${resolved ? "text-stone-500 dark:text-stone-400" : "text-amber-600 dark:text-amber-400"}`}>
                                        {!resolved ? <AlertTriangle className="size-3.5 shrink-0" /> : null}
                                        <span>{resolved ? `实际路由：${resolved.channel.name} / ${resolved.binding.upstreamModel}` : defaultModels[key] ? "当前默认模型不可解析" : "尚未设置默认模型"}</span>
                                    </div>
                                </LabeledControl>
                            );
                        })}
                    </div>
                </div>
            </div>

            <Drawer
                title="模型路由设置"
                size={760}
                styles={{ wrapper: { maxWidth: "100vw" } }}
                open={drawerOpen}
                destroyOnHidden
                onClose={() => setDrawerOpen(false)}
                extra={
                    <Space>
                        <Button onClick={() => setDrawerOpen(false)}>取消</Button>
                        <Button type="primary" disabled={!draft?.name.trim()} onClick={saveDraft}>
                            应用修改
                        </Button>
                    </Space>
                }
            >
                {draft ? (
                    <>
                        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/40">
                            <div className="truncate text-xs text-stone-500 dark:text-stone-400">逻辑 ID 将按上游模型与能力分别建立（例如 `gpt-5.5::text`、`gpt-5.5::audio`）</div>
                            <div className="mt-2 grid gap-3 sm:max-w-[620px] sm:grid-cols-[192px_minmax(220px,1fr)_96px]">
                                <LabeledControl label="前端昵称">
                                    <Input
                                        className="!w-full"
                                        aria-label="前端展示昵称"
                                        maxLength={120}
                                        value={draft.name}
                                        placeholder={draft.bindings[0]?.upstreamModel || draft.id}
                                        onChange={(event) => setDraft((current) => (current ? { ...current, name: event.target.value } : current))}
                                    />
                                </LabeledControl>
                                <LabeledControl label="能力类型（可多选）">
                                    <Select
                                        className="w-full"
                                        mode="multiple"
                                        maxTagCount="responsive"
                                        value={draftCapabilities}
                                        options={capabilityOptions}
                                        onChange={(capabilities) => {
                                            const nextCapabilities = normalizeCapabilities(capabilities);
                                            setDraftCapabilities(nextCapabilities);
                                            setDraft((current) => (current && nextCapabilities.length ? { ...current, capability: nextCapabilities[0] } : current));
                                        }}
                                    />
                                </LabeledControl>
                                <LabeledControl label="模型状态">
                                    <div className="flex h-8 items-center">
                                        <Switch checkedChildren="启用" unCheckedChildren="停用" checked={draft.enabled} onChange={(enabled) => setDraft((current) => (current ? { ...current, enabled } : current))} />
                                    </div>
                                </LabeledControl>
                            </div>
                        </div>
                        <div className="mt-5">
                            <h3 className="text-sm font-semibold text-stone-950 dark:text-stone-100">同名渠道绑定</h3>
                            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">渠道与上游模型由目录自动同步；这里调整能力、路由优先级、启停和能力档案。</p>
                            <div className="mt-3 space-y-3">
                                {draft.bindings.map((binding) => (
                                    <BindingEditor
                                        key={binding.id}
                                        binding={binding}
                                        capability={draft.capability}
                                        channels={channels}
                                        onChange={(patch) => setDraft((current) => (current ? { ...current, bindings: current.bindings.map((item) => (item.id === binding.id ? { ...item, ...patch } : item)) } : current))}
                                    />
                                ))}
                            </div>
                        </div>
                        {draft.capability === "video" ? <VideoFallbackEditor model={draft} models={logicalModels} channels={channels} onChange={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))} /> : null}
                    </>
                ) : null}
            </Drawer>
        </section>
    );
}

function BindingEditor({ binding, capability, channels, onChange }: { binding: LogicalModelBinding; capability: LogicalModelCapability; channels: SystemModelChannel[]; onChange: (patch: Partial<LogicalModelBinding>) => void }) {
    const channel = channels.find((item) => item.id === binding.channelId);
    const profile = binding.capabilityProfile || {};
    const effectiveAsync = profile.supportsAsync ?? (capability === "image" || capability === "video");
    const timeoutSeconds = profile.timeoutMs ? Math.round(profile.timeoutMs / 1000) : undefined;
    const defaultTimeoutSeconds = capability === "image" ? 600 : capability === "text" ? 180 : 1800;
    const updateProfile = (patch: Partial<LogicalModelCapabilityProfile>) => onChange({ capabilityProfile: { ...profile, ...patch } });
    const updateList = (value: string) =>
        updateProfile({
            aspectRatios: value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
        });
    return (
        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/40">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_90px_90px_auto] sm:items-end">
                <LabeledControl label="渠道">
                    <div className="flex h-8 items-center truncate rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200">{channel?.name || "渠道已移除"}</div>
                </LabeledControl>
                <LabeledControl label="上游模型">
                    <div className="flex h-8 items-center truncate rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200">{binding.upstreamModel}</div>
                </LabeledControl>
                <LabeledControl label="优先级">
                    <InputNumber className="w-full" min={1} max={10000} precision={0} value={binding.priority} onChange={(priority) => onChange({ priority: Number(priority) || 1 })} />
                </LabeledControl>
                <LabeledControl label="权重">
                    <InputNumber className="w-full" min={1} max={10000} precision={0} value={binding.weight || 100} onChange={(weight) => onChange({ weight: Number(weight) || 100 })} />
                </LabeledControl>
                <div className="flex h-8 items-center">
                    <Switch size="small" checked={binding.enabled} aria-label={`${channel?.name || "渠道"}绑定启用状态`} onChange={(enabled) => onChange({ enabled })} />
                </div>
            </div>
            <div className="mt-3 rounded-md border border-stone-200/80 bg-white/70 p-3 dark:border-stone-800 dark:bg-stone-950/40">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <div className="text-xs font-semibold text-stone-700 dark:text-stone-200">能力档案</div>
                        <div className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">控制参考素材、任务能力和资源限制。</div>
                    </div>
                    <Tag className="m-0">{capabilityLabel(capability)}</Tag>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 dark:text-stone-300 sm:col-span-2 lg:col-span-4">
                        <Checkbox checked={profile.supportsReferenceImage === true} onChange={(event) => updateProfile({ supportsReferenceImage: event.target.checked })}>
                            参考图片
                        </Checkbox>
                        <Checkbox checked={profile.supportsReferenceVideo === true} onChange={(event) => updateProfile({ supportsReferenceVideo: event.target.checked })}>
                            参考视频
                        </Checkbox>
                        <Checkbox checked={profile.supportsReferenceAudio === true} onChange={(event) => updateProfile({ supportsReferenceAudio: event.target.checked })}>
                            参考音频
                        </Checkbox>
                        {capability === "video" ? (
                            <Checkbox checked={profile.supportsKeyframes === true} onChange={(event) => updateProfile({ supportsKeyframes: event.target.checked })}>
                                连续关键帧
                            </Checkbox>
                        ) : null}
                        {capability === "video" ? (
                            <Checkbox checked={profile.supportsKeyframes === true} onChange={(event) => updateProfile({ supportsKeyframes: event.target.checked })}>
                                全能帧（2–5 张有序关键帧）
                            </Checkbox>
                        ) : null}
                        <Checkbox checked={effectiveAsync} onChange={(event) => updateProfile({ supportsAsync: event.target.checked })}>
                            异步查询
                        </Checkbox>
                        <Checkbox checked={profile.supportsCancel === true} onChange={(event) => updateProfile({ supportsCancel: event.target.checked })}>
                            上游取消
                        </Checkbox>
                        <Checkbox checked={profile.supportsWebhook === true} onChange={(event) => updateProfile({ supportsWebhook: event.target.checked })}>
                            Webhook
                        </Checkbox>
                    </div>
                    <LabeledControl label="最大参考图数量">
                        <InputNumber className="w-full" min={0} max={16} precision={0} value={profile.maxReferenceImages} onChange={(value) => updateProfile({ maxReferenceImages: Number(value) || 0 })} />
                    </LabeledControl>
                    <LabeledControl label="最大批量数量">
                        <InputNumber className="w-full" min={1} max={100} precision={0} value={profile.maxBatchSize} onChange={(value) => updateProfile({ maxBatchSize: Number(value) || 1 })} />
                    </LabeledControl>
                    <LabeledControl label="最短时长（秒）">
                        <InputNumber className="w-full" min={0} max={3600} precision={0} value={profile.minDurationSeconds} onChange={(value) => updateProfile({ minDurationSeconds: Number(value) || 0 })} />
                    </LabeledControl>
                    <LabeledControl label="最长时长（秒）">
                        <InputNumber className="w-full" min={0} max={3600} precision={0} value={profile.maxDurationSeconds} onChange={(value) => updateProfile({ maxDurationSeconds: Number(value) || 0 })} />
                    </LabeledControl>
                    <LabeledControl label="支持比例（逗号分隔）">
                        <Input value={profile.aspectRatios?.join(", ") || ""} placeholder="1:1, 16:9, 9:16" onChange={(event) => updateList(event.target.value)} />
                    </LabeledControl>
                    <LabeledControl label="请求超时（秒）">
                        <InputNumber
                            className="w-full"
                            min={5}
                            max={1800}
                            precision={0}
                            value={timeoutSeconds}
                            placeholder={`默认 ${defaultTimeoutSeconds} 秒`}
                            onChange={(value) => updateProfile({ timeoutMs: value ? Number(value) * 1000 : undefined })}
                        />
                    </LabeledControl>
                    <LabeledControl label="并发上限">
                        <InputNumber className="w-full" min={1} max={1000} precision={0} value={profile.concurrencyLimit} onChange={(value) => updateProfile({ concurrencyLimit: Number(value) || 1 })} />
                    </LabeledControl>
                    <LabeledControl label="估算单价">
                        <InputNumber className="w-full" min={0} precision={4} value={profile.unitCost} onChange={(value) => updateProfile({ unitCost: Number(value) || 0 })} />
                    </LabeledControl>
                    <LabeledControl label="成本货币">
                        <Input value={profile.unitCostCurrency || ""} maxLength={12} placeholder="USD / CNY" onChange={(event) => updateProfile({ unitCostCurrency: event.target.value.trim().toUpperCase() })} />
                    </LabeledControl>
                    {capability === "video" ? (
                        <LabeledControl label="计费单位">
                            <Select
                                className="w-full"
                                allowClear
                                value={profile.unitCostBasis}
                                placeholder="选择单位"
                                options={[
                                    { label: "按次", value: "call" },
                                    { label: "按秒", value: "second" },
                                ]}
                                onChange={(value) => updateProfile({ unitCostBasis: value || undefined })}
                            />
                        </LabeledControl>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function VideoFallbackEditor({ model, models, channels, onChange }: { model: LogicalModel; models: LogicalModel[]; channels: SystemModelChannel[]; onChange: (patch: Pick<LogicalModel, "fallbackModelIds" | "fallbackStrategy">) => void }) {
    const fallbackModels = (model.fallbackModelIds || []).map((id) => models.find((candidate) => candidate.id.toLowerCase() === id.toLowerCase())).filter((candidate): candidate is LogicalModel => Boolean(candidate));
    const options = models
        .filter((candidate) => candidate.id !== model.id && candidate.capability === "video" && candidate.enabled && !candidate.fallbackModelIds?.length && isLogicalModelResolvable(models, channels, "video", candidate.id))
        .map((candidate) => ({ label: formatLogicalModelOptionLabel(candidate, models), value: candidate.id }));
    return (
        <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-stone-950 dark:text-stone-100">视频后备候选</h3>
                    <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">仅在创建请求明确未受理时按顺序切换；供应商已接受后的异步失败不会自动创建新任务。</p>
                </div>
                <Tag color="gold" className="m-0">
                    价格为估算值
                </Tag>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                <LabeledControl label="后备逻辑模型（按选择顺序）">
                    <Select className="w-full" mode="multiple" maxTagCount="responsive" value={model.fallbackModelIds || []} options={options} placeholder="选择其他视频模型" onChange={(value) => onChange({ fallbackModelIds: value })} />
                </LabeledControl>
                <LabeledControl label="候选排序">
                    <Select
                        className="w-full"
                        value={model.fallbackStrategy || "priority"}
                        options={[
                            { label: "管理员优先级", value: "priority" },
                            { label: "可比较成本最低", value: "cheapest" },
                        ]}
                        onChange={(value) => onChange({ fallbackStrategy: value })}
                    />
                </LabeledControl>
            </div>
            <div className="mt-3 space-y-2">
                {[model, ...fallbackModels].map((candidate, index) => {
                    const resolved = resolveLogicalModelConfig(models, channels, "video", candidate.id);
                    return (
                        <div key={candidate.id} className="min-w-0 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs dark:border-stone-800 dark:bg-stone-950">
                            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                <span className="min-w-0 truncate font-medium text-stone-800 dark:text-stone-200">
                                    {index + 1}. {candidate.name}
                                </span>
                                <span className={resolved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{resolved ? "当前可用" : "当前不可用"}</span>
                            </div>
                            <div className="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-stone-500 dark:text-stone-400">
                                {candidate.bindings
                                    .filter((binding) => binding.enabled)
                                    .map((binding) => {
                                        const channel = channels.find((item) => item.id === binding.channelId);
                                        const profile = binding.capabilityProfile;
                                        const price = profile?.unitCost !== undefined && profile.unitCostCurrency ? `${profile.unitCost} ${profile.unitCostCurrency}${profile.unitCostBasis === "second" ? "/秒" : "/次"}` : "未设置估算价";
                                        return (
                                            <span key={binding.id}>
                                                {channel?.name || "渠道已移除"} / 优先级 {binding.priority} / {price}
                                            </span>
                                        );
                                    })}
                                {!candidate.bindings.some((binding) => binding.enabled) ? <span>没有启用的渠道绑定</span> : null}
                            </div>
                            {index > 0 ? (
                                <Space.Compact size="small">
                                    <Button
                                        type="text"
                                        title="上移后备候选"
                                        aria-label={`上移 ${candidate.name}`}
                                        icon={<ArrowUp className="size-3.5" />}
                                        disabled={index === 1}
                                        onClick={() => moveFallback(fallbackModels, index - 1, index - 2, onChange)}
                                    />
                                    <Button
                                        type="text"
                                        title="下移后备候选"
                                        aria-label={`下移 ${candidate.name}`}
                                        icon={<ArrowDown className="size-3.5" />}
                                        disabled={index === fallbackModels.length}
                                        onClick={() => moveFallback(fallbackModels, index - 1, index, onChange)}
                                    />
                                </Space.Compact>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function moveFallback(models: LogicalModel[], from: number, to: number, onChange: (patch: Pick<LogicalModel, "fallbackModelIds" | "fallbackStrategy">) => void) {
    if (from < 0 || to < 0 || from >= models.length || to > models.length) return;
    const ids = models.map((model) => model.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onChange({ fallbackModelIds: ids });
}

function cloneLogicalModel(model: LogicalModel): LogicalModel {
    return {
        ...model,
        fallbackModelIds: model.fallbackModelIds ? [...model.fallbackModelIds] : undefined,
        bindings: model.bindings.map((binding) => ({ ...binding, capabilityProfile: binding.capabilityProfile ? { ...binding.capabilityProfile } : undefined })),
    };
}

function capabilitiesForModel(models: LogicalModel[], model: LogicalModel) {
    const family = models.filter((candidate) => sameLogicalModelFamily(candidate, model));
    return normalizeCapabilities(family.map((candidate) => candidate.capability));
}

function normalizeCapabilities(values: LogicalModelCapability[]) {
    const order: LogicalModelCapability[] = ["text", "image", "video", "audio"];
    return order.filter((capability) => values.includes(capability));
}

function sameLogicalModelFamily(left: LogicalModel, right: LogicalModel) {
    const rightModels = new Set(right.bindings.map((binding) => upstreamKey(binding.upstreamModel)));
    return left.bindings.some((binding) => rightModels.has(upstreamKey(binding.upstreamModel)));
}

function upstreamKey(value: string) {
    return value
        .trim()
        .replace(/^models\//i, "")
        .toLowerCase();
}

function buildCapabilityVariants(models: LogicalModel[], original: LogicalModel, draft: LogicalModel, capabilities: LogicalModelCapability[]) {
    const selected = normalizeCapabilities(capabilities);
    const family = models.filter((model) => sameLogicalModelFamily(model, original));
    const sourceModel = draft.bindings[0]?.upstreamModel || original.bindings[0]?.upstreamModel || original.id;
    const sourceName = sourceModel.trim().replace(/^models\//i, "");
    const usedIds = new Set(models.filter((model) => !family.includes(model)).map((model) => model.id.toLowerCase()));
    const variants = selected.map((capability) => {
        const existing = family.find((model) => model.capability === capability);
        const base = existing && existing.id !== original.id ? existing : draft;
        const id = existing?.id || uniqueVariantId(sourceName, capability, usedIds);
        usedIds.add(id.toLowerCase());
        return cloneLogicalModel({
            ...base,
            id,
            name: draft.name,
            enabled: draft.enabled,
            capability,
            ...(capability === "video"
                ? {
                      fallbackModelIds: draft.capability === "video" ? draft.fallbackModelIds : base.fallbackModelIds,
                      fallbackStrategy: draft.capability === "video" ? draft.fallbackStrategy : base.fallbackStrategy,
                  }
                : { fallbackModelIds: undefined, fallbackStrategy: undefined }),
            bindings: draft.bindings.map((binding) => ({ ...binding, capabilityProfile: existing?.bindings.find((item) => item.id === binding.id)?.capabilityProfile || binding.capabilityProfile })),
        });
    });
    const withoutFamily = models.filter((model) => !family.includes(model));
    const originalIndex = models.findIndex((model) => model.id === original.id);
    withoutFamily.splice(Math.min(Math.max(originalIndex, 0), withoutFamily.length), 0, ...variants);
    return withoutFamily;
}

function uniqueVariantId(sourceName: string, capability: LogicalModelCapability, usedIds: Set<string>) {
    const base = `${sourceName}::${capability}`;
    let candidate = base;
    let suffix = 2;
    while (usedIds.has(candidate.toLowerCase())) candidate = `${base}-${suffix++}`;
    return candidate;
}

function formatLogicalModelOptionLabel(model: LogicalModel, logicalModels: LogicalModel[]) {
    const sameNameCount = logicalModels.filter((item) => item.id !== model.id && item.name.trim().toLowerCase() === model.name.trim().toLowerCase()).length;
    return sameNameCount ? `${model.name} · ${capabilityLabel(model.capability)}` : model.name;
}
