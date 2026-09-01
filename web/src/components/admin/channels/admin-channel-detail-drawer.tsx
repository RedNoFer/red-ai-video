"use client";

import { Button, Drawer, Empty, Select, Space, Tabs, Tag } from "antd";
import { Info, RefreshCw } from "lucide-react";

import { SystemChannelEditor } from "@/components/admin/admin-system-channel-editor";
import type { SystemModelChannel } from "@/lib/auth/store";
import { channelProtocolDefinition, channelRequiresApiKey, channelSupportsModelCatalog } from "@/lib/channel-protocol-registry";
import { capabilityLabel, channelModelCapability } from "@/lib/model-routing-config";

import { ChannelStatusBadge } from "./admin-channel-status-badge";
import { channelBindingCount, channelCapabilityLabels, channelProtocolLabel, channelUsabilityHint, channelWorkspaceStatus, type ChannelWorkspaceSettings } from "./admin-channel-workspace-model";

type Props = {
    open: boolean;
    channel?: SystemModelChannel;
    settings: ChannelWorkspaceSettings;
    fetching: boolean;
    onClose: () => void;
    onChange: (patch: Partial<SystemModelChannel>) => void;
    onDelete: () => Promise<boolean>;
    onFetchModels: () => void;
};

export function AdminChannelDetailDrawer({ open, channel, settings, fetching, onClose, onChange, onDelete, onFetchModels }: Props) {
    if (!channel) return null;
    const status = channelWorkspaceStatus(channel);
    return (
        <Drawer title={channel.name || "渠道详情"} size={720} styles={{ wrapper: { maxWidth: "100vw" } }} open={open} destroyOnHidden onClose={onClose}>
            <Tabs
                items={[
                    {
                        key: "overview",
                        label: "概览",
                        children: <ChannelOverview channel={channel} settings={settings} status={status} onFetchModels={onFetchModels} fetching={fetching} />,
                    },
                    {
                        key: "config",
                        label: "渠道配置",
                        children: (
                            <SystemChannelEditor
                                channel={channel}
                                fetching={fetching}
                                onChange={onChange}
                                onDelete={async () => {
                                    if (await onDelete()) onClose();
                                }}
                                onFetchModels={onFetchModels}
                            />
                        ),
                    },
                        { key: "models", label: `上游模型 ${channel.models.length}`, children: <ChannelModels channel={channel} onChange={onChange} onFetchModels={onFetchModels} /> },
                ]}
            />
        </Drawer>
    );
}

function ChannelOverview({ channel, settings, status, onFetchModels, fetching }: { channel: SystemModelChannel; settings: ChannelWorkspaceSettings; status: ReturnType<typeof channelWorkspaceStatus>; onFetchModels: () => void; fetching: boolean }) {
    const capabilities = channelCapabilityLabels(channel);
    const canSync = channelSupportsModelCatalog(channel);
    const usabilityHint = channelUsabilityHint(channel);
    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4 dark:border-stone-800">
                <div className="flex flex-wrap items-center gap-2">
                    <ChannelStatusBadge status={status} />
                    <Tag>{channelProtocolLabel(channel)}</Tag>
                    {capabilities.map((capability) => (
                        <Tag key={capability}>{capability}</Tag>
                    ))}
                </div>
                {canSync ? (
                    <Space wrap>
                        <Button icon={<RefreshCw className="size-4" />} loading={fetching} onClick={onFetchModels}>
                            同步模型
                        </Button>
                    </Space>
                ) : (
                    <Tag className="m-0">{channelProtocolDefinition(channel.advancedConfig?.protocol || "auto").builtInModels?.length ? "官方预置模型" : "模型手动维护"}</Tag>
                )}
            </div>
            {usabilityHint ? (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                    <Info className="mt-1 size-4 shrink-0" />
                    <span>{usabilityHint}如果这是 GPT / OpenAI 兼容供应商，请在“渠道配置”里添加供应商真实模型 ID，再同步或绑定逻辑模型。</span>
                </div>
            ) : null}
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <OverviewValue label="Base URL" value={channel.baseUrl || "未配置"} />
                <OverviewValue label="凭据" value={channelRequiresApiKey(channel) ? (channel.apiKey || channel.hasApiKey ? "已安全保存" : "未配置") : "无需凭据"} />
                <OverviewValue label="协议" value={channelProtocolLabel(channel)} />
                <OverviewValue label="上游模型" value={`${channel.models.length} 个`} />
                <OverviewValue label="逻辑绑定" value={`${channelBindingCount(channel.id, settings)} 个`} />
                <OverviewValue label="验证方式" value="用户工作台真实调用" />
            </div>
            <div>
                <div className="mb-2 text-sm font-semibold text-stone-950 dark:text-stone-100">逻辑模型绑定</div>
                <div className="divide-y divide-stone-200 border-y border-stone-200 dark:divide-stone-800 dark:border-stone-800">
                    {settings.logicalModels.flatMap((model) =>
                        model.bindings
                            .filter((binding) => binding.channelId === channel.id)
                            .map((binding) => (
                                <div key={binding.id} className="flex min-w-0 items-center justify-between gap-3 py-2.5 text-sm">
                                    <span className="font-medium text-stone-900 dark:text-stone-100">{model.name}</span>
                                    <span className="min-w-0 truncate text-stone-500 dark:text-stone-400">{binding.upstreamModel}</span>
                                </div>
                            )),
                    )}
                    {!channelBindingCount(channel.id, settings) ? <div className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">尚未绑定逻辑模型</div> : null}
                </div>
            </div>
        </div>
    );
}

function ChannelModels({ channel, onChange, onFetchModels }: { channel: SystemModelChannel; onChange: (patch: Partial<SystemModelChannel>) => void; onFetchModels: () => void }) {
    const canSync = channelSupportsModelCatalog(channel);
    return (
        <div className="space-y-4">
            <div className="rounded-md border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-800 dark:bg-stone-900/30">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">模型 ID</div>
                        <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">
                            {canSync ? "可先同步模型，也可以手动输入上游真实模型 ID。" : "当前协议没有可同步的模型目录，请直接输入上游真实模型 ID，按 Enter 后保存。"}
                        </div>
                    </div>
                    {canSync ? (
                        <Button size="small" onClick={onFetchModels}>
                            同步模型
                        </Button>
                    ) : null}
                </div>
                <Select
                    className="mt-3 w-full"
                    mode="tags"
                    tokenSeparators={[",", "，", "\n"]}
                    maxTagCount="responsive"
                    value={channel.models}
                    placeholder="输入模型 ID 后按 Enter，可添加多个"
                    onChange={(models) => onChange({ models: models.map((model) => model.trim()).filter(Boolean) })}
                />
            </div>
            <div className="divide-y divide-stone-200 border-y border-stone-200 dark:divide-stone-800 dark:border-stone-800">
                {channel.models.map((model) => (
                    <div key={model} className="flex min-w-0 items-center justify-between gap-3 py-3">
                        <span className="min-w-0 truncate text-sm font-medium text-stone-950 dark:text-stone-100">{model}</span>
                        <Tag className="m-0">{capabilityLabel(channelModelCapability(channel, model))}</Tag>
                    </div>
                ))}
                {!channel.models.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有上游模型" /> : null}
            </div>
        </div>
    );
}

function OverviewValue({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 border-b border-stone-100 pb-3 dark:border-stone-900">
            <div className="text-xs text-stone-500 dark:text-stone-400">{label}</div>
            <div className="mt-1 break-all text-sm font-medium text-stone-950 dark:text-stone-100">{value}</div>
        </div>
    );
}
