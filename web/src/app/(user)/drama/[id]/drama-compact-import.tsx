"use client";

import { useRef, useState } from "react";
import { App, Button, Input, Modal } from "antd";
import { Check, Download, PackageOpen, Upload } from "lucide-react";

import { applyDramaCompactPackage, previewDramaCompactPackage, type DramaCompactPackagePreview } from "@/services/api/drama-projects";
import type { DramaProject } from "../types";
import { useDramaStore } from "../stores/use-drama-store";

const TEMPLATE_URL = "/drama-compact-package-template.md";

export function DramaCompactImport({ project, onImported }: { project: DramaProject; onImported: () => void }) {
    const { message } = App.useApp();
    const replaceProject = useDramaStore((state) => state.replaceProject);
    const inputRef = useRef<HTMLInputElement>(null);
    const applyingRef = useRef(false);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [source, setSource] = useState("");
    const [fileName, setFileName] = useState("");
    const [preview, setPreview] = useState<DramaCompactPackagePreview>();
    const [overwriteAssetPrompts, setOverwriteAssetPrompts] = useState(false);
    const [busy, setBusy] = useState(false);

    const previewSource = async (text: string, name: string) => {
        if (!text.trim()) return message.warning("请粘贴精简制作包，或选择 Markdown 文件");
        setBusy(true);
        try {
            const result = await previewDramaCompactPackage(project.id, text, name, false);
            setSource(text);
            setFileName(name);
            setPreview(result);
            setOverwriteAssetPrompts(false);
            setOpen(false);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "精简制作包解析失败");
        } finally {
            setBusy(false);
        }
    };

    const toggleOverwriteAssetPrompts = async (next: boolean) => {
        if (!source || busy) return;
        setOverwriteAssetPrompts(next);
        setBusy(true);
        try {
            setPreview(await previewDramaCompactPackage(project.id, source, fileName, next));
        } catch (error) {
            setOverwriteAssetPrompts(!next);
            message.error(error instanceof Error ? error.message : "精简制作包预览失败");
        } finally {
            setBusy(false);
        }
    };

    const readFile = async (file?: File) => {
        if (!file) return;
        try {
            await previewSource(await file.text(), file.name);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "文件读取失败");
        } finally {
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const closePreview = () => {
        if (busy) return;
        setPreview(undefined);
        setSource("");
        setDraft("");
        setFileName("");
        setOverwriteAssetPrompts(false);
    };

    const apply = async () => {
        if (!preview || applyingRef.current) return;
        applyingRef.current = true;
        setBusy(true);
        try {
            const saved = await applyDramaCompactPackage(project.id, source, fileName, preview.sourceHash, overwriteAssetPrompts);
            replaceProject(saved);
            setPreview(undefined);
            setSource("");
            setDraft("");
            setFileName("");
            setOverwriteAssetPrompts(false);
            onImported();
            message.success(`已导入 ${preview.summary.shots} 个片段`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "精简制作包导入失败");
        } finally {
            applyingRef.current = false;
            setBusy(false);
        }
    };

    return (
        <>
            <Button className="!h-8 !px-2.5" size="small" icon={<PackageOpen className="size-3.5" />} onClick={() => setOpen(true)}>
                精简制作包导入
            </Button>
            <input ref={inputRef} type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={(event) => void readFile(event.target.files?.[0])} />
            <Modal
                title="导入精简制作包"
                open={open}
                width={{ xs: "calc(100vw - 32px)", sm: "calc(100vw - 32px)", md: 680 }}
                centered
                destroyOnHidden
                confirmLoading={busy}
                okText="识别并预览"
                okButtonProps={{ disabled: !draft.trim() }}
                onOk={() => void previewSource(draft, "粘贴精简制作包.md")}
                onCancel={() => !busy && setOpen(false)}
                footer={(_, { OkBtn, CancelBtn }) => (
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <Button type="link" className="!px-0" icon={<Download className="size-4" />} href={TEMPLATE_URL} download="drama-compact-package-template.md">
                            下载精简模板
                        </Button>
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                            <CancelBtn />
                            <OkBtn />
                        </div>
                    </div>
                )}
                styles={{ container: { maxWidth: "calc(100vw - 24px)" } }}
            >
                <div className="space-y-3 pt-1">
                    <Button block className="!h-9" icon={<Upload className="size-4" />} loading={busy} onClick={() => inputRef.current?.click()}>
                        选择 Markdown 文件
                    </Button>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">或直接粘贴</div>
                    <Input.TextArea value={draft} onChange={(event) => setDraft(event.target.value)} autoSize={{ minRows: 10, maxRows: 18 }} placeholder="粘贴精简制作包 Markdown" aria-label="粘贴精简制作包" />
                    <p className="text-xs leading-5 text-muted-foreground">只需小说原文、固定资产图提示词及各片段视频提示词；预览后再确认导入。续集请写新的剧集代码（如 E05）以追加为新一集，固定资产名称与项目一致即自动复用。</p>
                </div>
            </Modal>
            <Modal
                title="预览精简制作包"
                open={Boolean(preview)}
                width={{ xs: "calc(100vw - 32px)", sm: "calc(100vw - 32px)", md: 680 }}
                centered
                destroyOnHidden
                closable={!busy}
                mask={{ closable: !busy }}
                okText="确认导入精简制作包"
                okButtonProps={{ loading: busy }}
                cancelButtonProps={{ disabled: busy }}
                onOk={() => void apply()}
                onCancel={closePreview}
                styles={{ container: { maxWidth: "calc(100vw - 24px)" } }}
            >
                {preview ? (
                    <div className="space-y-3 pt-1" data-drama-compact-package-preview>
                        <p className="truncate text-sm font-medium" title={fileName}>
                            {fileName}
                        </p>
                        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
                            {[
                                ["剧集", preview.summary.episodes],
                                ["片段", preview.summary.shots],
                                ["总时长", `${preview.summary.duration} 秒`],
                                ["复用资产", preview.summary.assetsReused],
                                ["新增资产", preview.summary.assetsNew],
                                ["更新镜头", preview.summary.shotsUpdated],
                                ["旧成果待复核", preview.summary.oldResultsToReview],
                            ].map(([label, value]) => (
                                <div key={String(label)} className="bg-card px-3 py-2.5">
                                    <div className="text-[11px] text-muted-foreground">{label}</div>
                                    <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
                                </div>
                            ))}
                        </div>
                        {preview.summary.assetPromptsOverwritable ? (
                            <button
                                type="button"
                                aria-pressed={overwriteAssetPrompts}
                                disabled={busy}
                                onClick={() => void toggleOverwriteAssetPrompts(!overwriteAssetPrompts)}
                                className="flex w-full items-start gap-2.5 rounded-md border border-border bg-card px-3 py-2.5 text-left transition hover:border-foreground/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded transition ${overwriteAssetPrompts ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}>
                                    {overwriteAssetPrompts ? <Check className="size-3" strokeWidth={3} /> : null}
                                </span>
                                <span className="min-w-0 text-xs leading-5">
                                    <span className="font-medium text-foreground">覆盖已有资产的提示词与名称（{preview.summary.assetPromptsOverwritable} 项）</span>
                                    <span className="mt-0.5 block text-muted-foreground">按本文件改写这些资产的供应商提示词与视觉身份；代码相同但名称不同的资产同时改用包内名称。基准图、候选图和参考图绑定保留。</span>
                                </span>
                            </button>
                        ) : null}
                        {preview.warnings.length ? (
                            <ul className="max-h-40 list-disc space-y-1 overflow-y-auto rounded-md border border-amber-300/70 bg-amber-50/70 px-7 py-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/20 dark:text-amber-100">
                                {preview.warnings.map((warning) => (
                                    <li key={warning}>{warning}</li>
                                ))}
                            </ul>
                        ) : null}
                        <p className="text-xs leading-5 text-muted-foreground">
                            仅更新包内剧集；已有固定资产默认保留基准图与提示词，需要覆盖文案或名称时可勾选上方覆盖。包内剧集按代码对应项目：代码不存在则追加为新一集，代码相同则整集替换，其余集不受影响。导入前自动创建恢复版本。
                        </p>
                    </div>
                ) : null}
            </Modal>
        </>
    );
}
