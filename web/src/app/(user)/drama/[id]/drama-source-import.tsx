"use client";

import { useMemo, useRef, useState } from "react";
import { App, Button, Input, Modal, Pagination } from "antd";
import { BookOpenText, FileJson2, FileText, PackageOpen, Search, TriangleAlert, Upload } from "lucide-react";

import type { DramaProductionPackagePreview } from "@/lib/drama-project-contract";
import { splitDramaSource, type DramaSourceEpisodeDraft } from "@/lib/drama-source-splitter";
import { applyDramaProductionPackage, previewDramaProductionPackage } from "@/services/api/drama-projects";
import type { DramaProject } from "../types";
import { useDramaStore } from "../stores/use-drama-store";

const IMPORT_PAGE_SIZE = 20;

export function DramaSourceImport({ project, onImported }: { project: DramaProject; onImported: () => void }) {
    const { message } = App.useApp();
    const importEpisodes = useDramaStore((state) => state.importEpisodes);
    const createVersion = useDramaStore((state) => state.createVersion);
    const replaceProject = useDramaStore((state) => state.replaceProject);
    const inputRef = useRef<HTMLInputElement>(null);
    const packageInputRef = useRef<HTMLInputElement>(null);
    const [drafts, setDrafts] = useState<DramaSourceEpisodeDraft[]>([]);
    const [fileName, setFileName] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [importing, setImporting] = useState(false);
    const [packageSource, setPackageSource] = useState("");
    const [packageFileName, setPackageFileName] = useState("");
    const [packageDraft, setPackageDraft] = useState("");
    const [packageImportOpen, setPackageImportOpen] = useState(false);
    const [packagePreview, setPackagePreview] = useState<DramaProductionPackagePreview>();
    const [previewingPackage, setPreviewingPackage] = useState(false);
    const open = drafts.length > 0;
    const totalCharacters = useMemo(() => drafts.reduce((total, draft) => total + draft.script.length, 0), [drafts]);
    const filtered = useMemo(() => {
        const keyword = query.trim().toLocaleLowerCase();
        if (!keyword) return drafts.map((draft, index) => ({ draft, index }));
        return drafts.flatMap((draft, index) => (`${draft.title} ${draft.sourceRange}`.toLocaleLowerCase().includes(keyword) ? [{ draft, index }] : []));
    }, [drafts, query]);
    const visible = filtered.slice((page - 1) * IMPORT_PAGE_SIZE, page * IMPORT_PAGE_SIZE);

    const close = () => {
        setDrafts([]);
        setFileName("");
        setQuery("");
        setPage(1);
    };

    const readSource = async (file?: File) => {
        if (!file) return;
        try {
            const nextDrafts = splitDramaSource(await file.text());
            if (!nextDrafts.length) return message.warning("导入文件没有可识别的文本内容");
            setDrafts(nextDrafts);
            setFileName(file.name);
            setQuery("");
            setPage(1);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "整本导入失败");
        } finally {
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const confirmImport = async () => {
        setImporting(true);
        try {
            await createVersion(project, "整本导入前");
            importEpisodes(project.id, drafts);
            close();
            onImported();
            message.success(`已导入 ${drafts.length} 集，请逐集检查并提取内容结构`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "整本导入失败");
        } finally {
            setImporting(false);
        }
    };

    const previewPackageSource = async (source: string, sourceName: string) => {
        if (!source.trim()) return message.warning("请粘贴制作包内容，或选择制作包文件");
        setPreviewingPackage(true);
        try {
            const preview = await previewDramaProductionPackage(project.id, source, sourceName);
            setPackageSource(source);
            setPackageFileName(sourceName);
            setPackagePreview(preview);
            setPackageImportOpen(false);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "制作包解析失败");
        } finally {
            setPreviewingPackage(false);
        }
    };

    const readPackage = async (file?: File) => {
        if (!file) return;
        try {
            await previewPackageSource(await file.text(), file.name);
        } finally {
            if (packageInputRef.current) packageInputRef.current.value = "";
        }
    };

    const closePackage = () => {
        if (importing) return;
        setPackageSource("");
        setPackageFileName("");
        setPackageDraft("");
        setPackagePreview(undefined);
    };

    const confirmPackage = async () => {
        if (!packagePreview) return;
        setImporting(true);
        try {
            const nextProject = await applyDramaProductionPackage(project, packagePreview, packageSource, packageFileName);
            replaceProject(nextProject);
            setPackageSource("");
            setPackageFileName("");
            setPackageDraft("");
            setPackagePreview(undefined);
            onImported();
            message.success(`已导入 ${packagePreview.summary.shots} 个导演镜头，制作参数和连续性关系已保留`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "制作包导入失败");
        } finally {
            setImporting(false);
        }
    };

    return (
        <>
            <Button className="!h-8 !px-2.5" size="small" icon={<BookOpenText className="size-3.5" />} onClick={() => inputRef.current?.click()}>
                导入剧本
            </Button>
            <Button className="!h-8 !px-2.5" size="small" icon={<PackageOpen className="size-3.5" />} loading={previewingPackage} onClick={() => setPackageImportOpen(true)}>
                完整制作包
            </Button>
            <input ref={inputRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(event) => void readSource(event.target.files?.[0])} />
            <input ref={packageInputRef} type="file" accept=".json,.md,application/json,text/markdown" className="hidden" onChange={(event) => void readPackage(event.target.files?.[0])} />
            <Modal
                title="导入完整制作包"
                open={packageImportOpen}
                width={680}
                centered
                destroyOnHidden
                confirmLoading={previewingPackage}
                okText="识别并预览"
                cancelText="取消"
                okButtonProps={{ disabled: !packageDraft.trim() }}
                onOk={() => void previewPackageSource(packageDraft, "粘贴制作包文本.md")}
                onCancel={() => {
                    if (!previewingPackage) setPackageImportOpen(false);
                }}
                styles={{ container: { maxWidth: "calc(100vw - 24px)" } }}
            >
                <div className="space-y-3 pt-1">
                    <Button block className="!h-9" icon={<Upload className="size-4" />} loading={previewingPackage} onClick={() => packageInputRef.current?.click()}>
                        选择制作包文件
                    </Button>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">或直接粘贴</div>
                    <Input.TextArea
                        value={packageDraft}
                        onChange={(event) => setPackageDraft(event.target.value)}
                        autoSize={{ minRows: 10, maxRows: 18 }}
                        placeholder="粘贴制作包文本，支持标准 JSON 或包含导演执行表的 Markdown"
                        aria-label="粘贴制作包文本"
                    />
                    <p className="text-xs leading-5 text-muted-foreground">识别后先展示项目参数、资产、剧情场次、导演镜头和警告，不会直接覆盖当前项目。</p>
                </div>
            </Modal>
            <Modal
                title="导入整本剧本"
                open={open}
                width={720}
                centered
                destroyOnHidden
                mask={{ closable: !importing }}
                closable={!importing}
                okText={`确认导入 ${drafts.length} 集`}
                cancelText="取消"
                okButtonProps={{ loading: importing }}
                cancelButtonProps={{ disabled: importing }}
                onOk={() => void confirmImport()}
                onCancel={close}
                styles={{ container: { maxWidth: "calc(100vw - 24px)" }, body: { padding: 0 } }}
            >
                <div className="flex max-h-[min(68vh,640px)] min-h-0 flex-col overflow-hidden">
                    <div className="shrink-0 border-b border-border px-5 py-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                            <span className="flex min-w-0 items-center gap-1.5" title={fileName}>
                                <FileText className="size-3.5 shrink-0" />
                                <span className="max-w-60 truncate text-foreground">{fileName}</span>
                            </span>
                            <span>{drafts.length.toLocaleString("zh-CN")} 集</span>
                            <span>{totalCharacters.toLocaleString("zh-CN")} 字</span>
                            <span>将替换当前 {project.episodes.length} 集，并自动创建恢复版本</span>
                        </div>
                        <Input
                            className="!mt-3 !h-8"
                            allowClear
                            prefix={<Search className="size-3.5 text-muted-foreground" />}
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setPage(1);
                            }}
                            placeholder="搜索分集标题或来源范围"
                            aria-label="搜索待导入分集"
                        />
                    </div>
                    <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2" data-drama-import-preview>
                        {visible.length ? (
                            <div className="divide-y divide-border">
                                {visible.map(({ draft, index }) => (
                                    <div key={`${index}-${draft.title}`} className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2 px-2 py-2.5">
                                        <span className="text-xs font-medium tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium">{draft.title || `第 ${index + 1} 集`}</span>
                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{draft.sourceRange || "按正文长度自动划分"}</span>
                                        </span>
                                        <span className="text-xs tabular-nums text-muted-foreground">{draft.script.length.toLocaleString("zh-CN")} 字</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">没有匹配的分集</div>
                        )}
                    </div>
                    {filtered.length > IMPORT_PAGE_SIZE ? (
                        <div className="flex shrink-0 justify-end border-t border-border px-4 py-2.5">
                            <Pagination size="small" current={page} pageSize={IMPORT_PAGE_SIZE} total={filtered.length} showSizeChanger={false} showLessItems onChange={setPage} />
                        </div>
                    ) : null}
                </div>
            </Modal>
            <Modal
                title="导入完整制作包"
                open={Boolean(packagePreview)}
                width={680}
                centered
                destroyOnHidden
                closable={!importing}
                mask={{ closable: !importing }}
                okText="确认应用制作包"
                cancelText="取消"
                okButtonProps={{ loading: importing }}
                cancelButtonProps={{ disabled: importing }}
                onOk={() => void confirmPackage()}
                onCancel={closePackage}
                styles={{ container: { maxWidth: "calc(100vw - 24px)" } }}
            >
                {packagePreview ? (
                    <div className="space-y-4 pt-1" data-drama-production-package-preview>
                        <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/25 px-3 py-2.5">
                            <FileJson2 className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={packageFileName}>{packageFileName}</span>
                            <span className="shrink-0 text-xs uppercase text-muted-foreground">{packagePreview.format}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
                            {[
                                ["剧集", packagePreview.summary.episodes],
                                ["剧情场次", packagePreview.summary.storyScenes],
                                ["导演镜头", packagePreview.summary.shots],
                                ["角色", packagePreview.summary.characters],
                                ["地点", packagePreview.summary.locations],
                                ["总时长", `${packagePreview.summary.duration} 秒`],
                                ["档案章节", packagePreview.summary.archiveSections],
                                ["Prompt 资产", packagePreview.summary.promptAssets],
                            ].map(([label, value]) => (
                                <div key={String(label)} className="bg-card px-3 py-2.5">
                                    <div className="text-[11px] text-muted-foreground">{label}</div>
                                    <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-2 text-xs sm:grid-cols-2">
                            <PackageFact label="画幅" value={packagePreview.package.project.ratio} />
                            <PackageFact label="目标平台" value={packagePreview.package.project.productionBible.targetPlatform || "由后台规划"} />
                            <PackageFact label="连续性" value={packagePreview.package.project.productionBible.continuityMode === "strict" ? "连续性优先" : "平衡模式"} />
                            <PackageFact label="字段策略" value="人工编辑 > 制作包 > AI 补全" />
                            <PackageFact label="格式版本" value={packagePreview.package.archive?.formatVersion || "基础制作包 v1"} />
                        </div>
                        {packagePreview.warnings.length ? (
                            <div className="rounded-md border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/20 dark:text-amber-100">
                                <div className="flex items-center gap-1.5 font-medium"><TriangleAlert className="size-3.5" />解析警告</div>
                                <ul className="mt-1.5 space-y-1">{packagePreview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                            </div>
                        ) : null}
                        <p className="text-xs leading-5 text-muted-foreground">应用前会自动创建恢复版本；制作包正文保存为项目来源素材，文学剧本、资产、镜头参数和连续性关系分别进入对应数据结构。</p>
                    </div>
                ) : null}
            </Modal>
        </>
    );
}

function PackageFact({ label, value }: { label: string; value: string }) {
    return <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border px-2.5 py-2"><span className="text-muted-foreground">{label}</span><span className="min-w-0 truncate font-medium" title={value}>{value}</span></div>;
}
