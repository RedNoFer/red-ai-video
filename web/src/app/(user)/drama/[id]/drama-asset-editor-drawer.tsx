"use client";

import { App, Button, Drawer, Image, Input, InputNumber, Modal, Popconfirm, Popover, Space, Tooltip } from "antd";
import { Check, FolderInput, ImagePlus, MessageCircle, Send, Sparkles, Trash2, Upload, Volume2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";

import { compileDramaAssetConstraints, compileDramaAssetReferencePrompt, compileDramaAssetRefinementPrompt, preflightDramaAssetGeneration } from "@/lib/drama-prompt-compiler";
import { resolveDramaVisualStyle } from "@/lib/drama-style";
import { approvedAssetReference } from "@/lib/drama-asset-baseline";
import type { DramaAssetProfile, DramaAssetReference, DramaAssetRefinementMessage, DramaAssetRefinementProposal, DramaCharacter, DramaNamedAsset, DramaProject, DramaVoiceProfile } from "@/lib/drama-project-contract";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { createImageGenerationTask, waitForImageGenerationTask } from "@/services/api/image";
import { imageToDataUrl, uploadImage } from "@/services/image-storage";
import { serverMediaUrl, uploadServerMedia } from "@/services/server-media-storage";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { useDramaStore } from "../stores/use-drama-store";
import { approveDramaAssetReference, completeDramaAsset, createDramaAssetGenerationBatch, createDramaVoiceProfile, refineDramaAsset, retryDramaVoicePreview, reviewDramaAssetCandidates, syncDramaVoiceCreation, syncDramaVoicePreview } from "@/services/api/drama-projects";
import { DRAMA_ASSET_DEFINITIONS, type DramaAssetKind } from "./drama-asset-definitions";
import { dramaAssetReferences, ensureUniqueDramaAssetReferenceIds, imageResultsToReferences } from "./drama-asset-reference-utils";
import { dramaAssetAutoCompletionItems, dramaAssetMissingFields } from "./drama-asset-library-utils";
import { getDramaAssetMissingItems } from "@/lib/drama-asset-completion";
import { dramaGenerationSize } from "./drama-shot-generation-utils";

type AssetDraft = {
    name: string;
    description: string;
    payoff: string;
    profile: DramaAssetProfile;
    voiceProfile: DramaVoiceProfile;
};

const emptyProfile = (): DramaAssetProfile => ({ visualIdentity: "", styling: "", colorPalette: "", consistencyRules: "" });
const emptyVoiceProfile = (): DramaVoiceProfile => ({ voiceId: "", speed: 1, instructions: "", previewStatus: "idle", creationMode: "clone", creationStatus: "idle" });
const emptyDraft = (): AssetDraft => ({ name: "", description: "", payoff: "", profile: emptyProfile(), voiceProfile: emptyVoiceProfile() });

export function DramaAssetEditorDrawer({ project, kind, assetId, open, onClose }: { project: DramaProject; kind: DramaAssetKind; assetId?: string; open: boolean; onClose: () => void }) {
    const { message, modal } = App.useApp();
    const config = useEffectiveConfig();
    const addCharacter = useDramaStore((state) => state.addCharacter);
    const addScene = useDramaStore((state) => state.addScene);
    const addProp = useDramaStore((state) => state.addProp);
    const addClue = useDramaStore((state) => state.addClue);
    const updateAsset = useDramaStore((state) => state.updateAsset);
    const replaceProject = useDramaStore((state) => state.replaceProject);
    const saveProjectNow = useDramaStore((state) => state.saveProjectNow);
    const liveAsset = useDramaStore((state) => state.projects.find((item) => item.id === project.id)?.[kind].find((item) => item.id === assetId));
    const fileInputRef = useRef<HTMLInputElement>(null);
    const voiceSampleInputRef = useRef<HTMLInputElement>(null);
    const refinementSectionRef = useRef<HTMLElement>(null);
    const voicePreviewAudioRef = useRef<HTMLAudioElement>(null);
    const voiceCreationRequestIdRef = useRef("");
    const editorKeyRef = useRef("");
    const [draft, setDraft] = useState<AssetDraft>(emptyDraft);
    const [uploading, setUploading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [refinementPrompt, setRefinementPrompt] = useState("");
    const [refinementProposal, setRefinementProposal] = useState<DramaAssetRefinementProposal>();
    const [refining, setRefining] = useState(false);
    const [creatingVoice, setCreatingVoice] = useState(false);
    const [uploadingVoiceSample, setUploadingVoiceSample] = useState(false);
    const [syncingVoicePreview, setSyncingVoicePreview] = useState(false);
    const definition = DRAMA_ASSET_DEFINITIONS[kind];
    const asset = liveAsset || project[kind].find((item) => item.id === assetId);
    const character = kind === "characters" ? (asset as DramaCharacter | undefined) : undefined;
    const references = asset ? dramaAssetReferences(asset) : [];
    const primary = approvedAssetReference(asset);
    const cloneAvailable = config.channels.some((channel) =>
        Object.values(channel.advancedConfig?.modelConfigs || {}).some(
            (operation) => operation.audioOperation === "voice-clone" && Boolean(operation.cloneSampleField) && /\{\{\s*(?:clone_sample_url|sample_audio_url|sample_url)\s*\}\}/i.test(operation.requestTemplate || ""),
        ),
    );
    const voicePreviewStatus = draft.voiceProfile.previewStatus === "success" ? "试听已完成" : draft.voiceProfile.previewStatus === "error" ? "试听生成失败" : ["queued", "running"].includes(draft.voiceProfile.previewStatus || "") ? "试听生成中" : "";
    const voiceCreationActive = creatingVoice || ["queued", "running"].includes(draft.voiceProfile.creationStatus || "");
    const voicePreviewActive = syncingVoicePreview || ["queued", "running"].includes(draft.voiceProfile.previewStatus || "");

    useEffect(() => {
        if (!open) {
            editorKeyRef.current = "";
            setRefinementPrompt("");
            setRefinementProposal(undefined);
            return;
        }
        const editorKey = `${kind}:${assetId || "new"}`;
        if (editorKeyRef.current === editorKey) return;
        editorKeyRef.current = editorKey;
        if (!asset) {
            setDraft(emptyDraft());
            return;
        }
        const latestRefinement = asset.refinementHistory?.at(-1)?.proposal;
        setRefinementProposal(latestRefinement);
        setDraft({
            name: asset.name,
            description: asset.description,
            payoff: kind === "clues" && "payoff" in asset && typeof asset.payoff === "string" ? asset.payoff : "",
            profile: asset.profile || emptyProfile(),
            voiceProfile: character
                ? {
                      ...(character.voiceProfile || emptyVoiceProfile()),
                      creationMode: "clone",
                      creationStatus: character.voiceProfile?.creationStatus || "idle",
                  }
                : emptyVoiceProfile(),
        });
    }, [asset, assetId, character?.voiceProfile, kind, open]);

    const save = async () => {
        if (saving) return;
        const name = draft.name.trim();
        if (!name) return message.warning(`请输入${definition.label}名称`);
        const voiceId = draft.voiceProfile.voiceId;
        if (kind === "characters" && voiceId && project.characters.some((item) => item.id !== assetId && (item.voiceProfile?.voiceId || "").trim().toLowerCase() === voiceId.trim().toLowerCase())) return message.error("同一项目的角色不能使用相同音色 ID");
        setSaving(true);
        const base = { name, description: draft.description.trim(), profile: draft.profile };
        try {
            if (asset) {
                updateAsset(project.id, kind, asset.id, {
                    ...base,
                    ...(kind === "characters" ? { voiceProfile: draft.voiceProfile } : {}),
                    ...(kind === "clues" ? { payoff: draft.payoff.trim() } : {}),
                });
            } else if (kind === "characters") {
                addCharacter(project.id, { ...base, voiceProfile: draft.voiceProfile, references: [] });
            } else if (kind === "scenes") {
                addScene(project.id, { ...base, references: [] });
            } else if (kind === "props") {
                addProp(project.id, { ...base, references: [] });
            } else {
                addClue(project.id, { ...base, payoff: draft.payoff.trim(), references: [] });
            }
            await saveProjectNow(project.id);
            message.success(asset ? `${definition.title}设定已保存` : `${definition.title}已创建`);
            onClose();
        } catch (error) {
            message.error(error instanceof Error ? error.message : `${definition.title}保存失败`);
        } finally {
            setSaving(false);
        }
    };

    const createVoice = async (confirmReplace = false) => {
        if (!character?.id) return;
        if (voiceCreationActive) return void message.info("新声纹正在生成，请先刷新声纹状态");
        const requestId = voiceCreationRequestIdRef.current || nanoid();
        voiceCreationRequestIdRef.current = requestId;
        setCreatingVoice(true);
        try {
            const result = await createDramaVoiceProfile(project.id, character.id, {
                mode: "clone",
                sampleAssetId: draft.voiceProfile.creationSampleAssetId,
                requestId,
                confirmReplace,
            });
            useDramaStore.getState().replaceProject(result.project);
            setDraft((current) => ({ ...current, voiceProfile: result.voiceProfile }));
            if (result.voiceProfile.creationStatus === "success") message.success(`已生成新声纹：${result.voiceProfile.voiceId}`);
            else message.success("新声纹任务已提交");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "新声纹创建失败");
        } finally {
            setCreatingVoice(false);
            voiceCreationRequestIdRef.current = "";
        }
    };

    const uploadVoiceSample = async (file: File) => {
        setUploadingVoiceSample(true);
        try {
            const stored = await uploadServerMedia(file, "audio", 20 * 1024 * 1024);
            setDraft((current) => ({ ...current, voiceProfile: { ...current.voiceProfile, creationSampleAssetId: stored.storageKey } }));
            message.success("Clone 音频样本已上传");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "音频样本上传失败");
        } finally {
            setUploadingVoiceSample(false);
        }
    };

    const setPrimaryReference = async (reference: DramaAssetReference) => {
        if (!asset) return;
        try {
            const savedProject = await approveDramaAssetReference(project.id, kind, asset.id, reference.id);
            replaceProject(savedProject);
            message.success(reference.reviewStatus === "passed" ? "已确认审核通过的主基准图，相关镜头将重新检查" : "已将该候选设为主基准图，相关镜头将按当前图重新检查");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "主基准图保存失败");
        }
    };

    const requestRefinement = async () => {
        if (!asset || kind === "clues" || !refinementPrompt.trim()) return;
        setRefining(true);
        try {
            const proposal = await refineDramaAsset(project.id, kind as "characters" | "scenes" | "props", asset.id, refinementPrompt.trim(), `${asset.id}:${Date.now()}`);
            setRefinementProposal(proposal);
            const history: DramaAssetRefinementMessage = { id: `refinement-${nanoid()}`, request: refinementPrompt.trim(), reply: proposal.reply, proposal, createdAt: new Date().toISOString() };
            updateAsset(project.id, kind, asset.id, { refinementHistory: [...(asset.refinementHistory || []), history] }, { markShotsStale: false });
            message.success("GPT 已生成调整方案，请确认后生成候选");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "GPT 调整失败");
        } finally {
            setRefining(false);
        }
    };

    const applyRefinementDraft = () => {
        if (!asset || !refinementProposal) return;
        setDraft((current) => ({ ...current, profile: refinementProposal.updatedProfile, description: refinementProposal.updatedDescription || current.description }));
        message.success("调整已应用到未保存草稿");
    };

    const completeMissingSettings = () => {
        if (!asset || kind === "clues") return;
        const missing = dramaAssetMissingFields(asset, kind);
        if (!missing.length) return message.info("当前设定已经填写完整");
        setRefinementPrompt(`请只补全当前为空的字段：${missing.join("、")}。根据已有剧情身份和视觉设定给出可执行、可复用的简洁描述；已填写字段不得改写。`);
        refinementSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const runCompletion = async () => {
        if (!asset) return;
        const allMissing = dramaAssetAutoCompletionItems(asset, kind);
        const missing = allMissing.filter((item) => item.task !== "voice");
        if (!missing.length) return message.info(allMissing.some((item) => item.task === "voice") ? "文字设定和基准图已完整；音色请单独创建" : "当前设定已经完整");
        const confirmed = await new Promise<boolean>((resolve) =>
            modal.confirm({
                title: `智能补全“${asset.name}”`,
                content: `将补全：${missing.map((item) => item.label).join("、")}。预计文本 ${missing.filter((item) => item.task === "planning").length} 项、音色 ${missing.filter((item) => item.task === "voice").length} 项、基准图 ${missing.filter((item) => item.task === "reference").length} 项。`,
                okText: "开始补全",
                cancelText: "取消",
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
            }),
        );
        if (!confirmed) return;
        setGenerating(true);
        try {
            if (kind === "clues") await completeDramaAsset(project.id, kind, asset.id, `drawer:${project.id}:${kind}:${asset.id}:${Date.now()}`, config);
            else
                await createDramaAssetGenerationBatch(project.id, [{ kind, assetId: asset.id }], {
                    ...config,
                    model: config.imageModel || config.model,
                    imageModel: config.imageModel || config.model,
                    count: "1",
                    completeMissingOnly: true,
                });
            await useDramaStore.getState().loadProject(project.id, true);
            message.success("智能补全已提交");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "智能补全失败");
        } finally {
            setGenerating(false);
        }
    };

    const adjustFromReview = (reference: DramaAssetReference) => {
        if (!asset || kind === "clues") return;
        const correction = reference.reviewIssues
            ?.map((issue) => issue.correction || issue.message)
            .filter(Boolean)
            .join("；");
        const request = correction ? `请根据审核建议调整：${correction}` : "请修正这张候选图中审核指出的问题，并保留角色身份、五官、年龄和一致性规则。";
        setRefinementPrompt((current) => (current.trim() ? `${current.trim()}；${request}` : request));
        refinementSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        message.info("已回填审核建议，你可以继续修改后再生成调整方案");
    };

    const appendReferences = (item: DramaNamedAsset, added: DramaAssetReference[]) => {
        updateAsset(
            project.id,
            kind,
            item.id,
            {
                references: ensureUniqueDramaAssetReferenceIds([...dramaAssetReferences(item), ...added]),
            },
            { markShotsStale: false },
        );
    };

    const appendSourceReference = (source: NonNullable<DramaProject["sourceAssets"]>[number]) => {
        if (!asset) return;
        const url = source.serverUrl || source.remoteUrl;
        if (!url) return;
        if (references.some((reference) => reference.url === url || (source.storageKey && reference.storageKey === source.storageKey))) {
            message.info("这张来源图片已经在候选中");
            return;
        }
        appendReferences(asset, [
            {
                id: `reference-${nanoid()}`,
                url,
                storageKey: source.storageKey,
                source: "library",
                label: source.title || "项目来源图片",
                width: source.width,
                height: source.height,
                createdAt: new Date().toISOString(),
            },
        ]);
        message.success("来源图片已加入候选，请确认主基准图");
    };

    const removeReference = (referenceId: string) => {
        if (!asset) return;
        const nextReferences = references.filter((reference) => reference.id !== referenceId);
        const nextPrimary = asset.primaryReferenceId === referenceId ? nextReferences[0] : nextReferences.find((reference) => reference.id === asset.primaryReferenceId);
        updateAsset(
            project.id,
            kind,
            asset.id,
            {
                references: nextReferences,
                primaryReferenceId: nextPrimary?.id,
                referenceImageUrl: nextPrimary?.url,
                referenceStorageKey: nextPrimary?.storageKey,
            },
            { markShotsStale: asset.primaryReferenceId === referenceId },
        );
    };

    const uploadReference = async (file?: File) => {
        if (!file || !asset) return;
        setUploading(true);
        try {
            const stored = await uploadImage(file);
            appendReferences(asset, [
                {
                    id: `reference-${nanoid()}`,
                    url: stored.serverUrl || stored.url,
                    storageKey: stored.storageKey,
                    source: "upload",
                    label: file.name,
                    width: stored.width,
                    height: stored.height,
                    createdAt: new Date().toISOString(),
                },
            ]);
            message.success("参考图已上传为候选，请确认主基准图");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "参考图上传失败");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const generateReference = async (proposalOverride?: DramaAssetRefinementProposal, referenceOverride?: DramaAssetReference) => {
        if (!asset || kind === "clues") return;
        setGenerating(true);
        try {
            const activeProposal = proposalOverride || refinementProposal;
            const assetKind = kind === "characters" ? "角色" : kind === "scenes" ? "场景" : "道具";
            const preflight = preflightDramaAssetGeneration(project, asset, assetKind);
            if (!preflight.ok) {
                message.warning(`暂不能生成：${preflight.errors.join("；")}`);
                return;
            }
            const prompt = activeProposal ? compileDramaAssetRefinementPrompt(project, asset, assetKind, activeProposal, refinementPrompt) : compileDramaAssetReferencePrompt(project, asset, assetKind);
            const imageModel = config.imageModel || config.imageModels[0] || "";
            if (!imageModel) throw new Error("后台尚未配置可用的图片模型，请先在管理后台配置图片渠道");
            const imageConfig = { ...config, model: imageModel, imageModel, size: dramaGenerationSize(project, prompt), count: "1" };
            const referenceForRefinement = referenceOverride || (activeProposal ? primary : undefined);
            const existingReferenceUrl = referenceForRefinement ? serverMediaUrl(referenceForRefinement.storageKey, referenceForRefinement.url) : "";
            const referenceDataUrl = referenceForRefinement && !existingReferenceUrl ? await imageToDataUrl(referenceForRefinement) : "";
            if (referenceForRefinement && !existingReferenceUrl && !/^data:image\//i.test(referenceDataUrl)) throw new Error("读取已选参考图失败，请重新选择候选图");
            const storedReference = referenceDataUrl ? await uploadImage(referenceDataUrl) : undefined;
            const storedReferenceUrl = existingReferenceUrl || storedReference?.serverUrl || storedReference?.url || "";
            if (referenceForRefinement && !storedReferenceUrl) throw new Error("读取已选参考图失败，请重新选择候选图");
            const generationReferences =
                referenceForRefinement && storedReferenceUrl
                    ? [
                          {
                              id: referenceForRefinement.id,
                              name: `${asset.name}调整参考图`,
                              type: storedReference?.mimeType || "image/png",
                              dataUrl: storedReferenceUrl,
                              url: storedReferenceUrl,
                              remoteUrl: referenceForRefinement.remoteUrl,
                              serverUrl: storedReferenceUrl,
                              storageKey: storedReference?.storageKey || referenceForRefinement.storageKey,
                              width: storedReference?.width || referenceForRefinement.width,
                              height: storedReference?.height || referenceForRefinement.height,
                          },
                      ]
                    : [];
            const task = await createImageGenerationTask(imageConfig, prompt, generationReferences, undefined, {
                logSource: "drama",
                logTitle: `${project.title} · ${asset.name}设定图`,
                conversationId: project.creativeConversationId,
                surface: "drama",
                projectId: project.id,
                assetKind: kind === "characters" || kind === "scenes" || kind === "props" ? kind : undefined,
                assetId: asset.id,
                generationStage: activeProposal ? "refinement" : "initial",
                clientRequestId: `drama-reference:${project.id}:${asset.id}:${nanoid()}`,
            });
            const nextReferences = imageResultsToReferences(await waitForImageGenerationTask(imageConfig, task), {
                promptVersion: (references.reduce((max, item) => Math.max(max, item.promptVersion || 0), 0) || 0) + 1,
                compiledPrompt: prompt,
                generationStage: activeProposal ? "refinement" : "initial",
                ...(activeProposal ? { promptChanges: activeProposal.changes, refinement: activeProposal } : {}),
                generationTaskId: task.id,
                logicalModelId: task.model,
                reviewStatus: "reviewing",
            });
            if (!nextReferences.length) throw new Error("生成结果没有可持久化地址");
            const review = await reviewDramaAssetCandidates(project.id, kind as "characters" | "scenes" | "props", asset.id, prompt, nextReferences).catch(() => ({
                mode: "unavailable" as const,
                status: "unavailable" as const,
                summary: "自动审核暂时不可用，候选图已保留，请人工确认后再设为主基准。",
                issues: [],
                retryTaskIds: [],
            }));
            const reviewedReferences = nextReferences.map((reference) => ({
                ...reference,
                reviewStatus: review.status === "passed" ? ("passed" as const) : review.status === "needs_revision" ? ("needs_revision" as const) : ("unavailable" as const),
                reviewSummary: review.summary,
                reviewIssues: review.issues.filter((issue) => !issue.taskId || issue.taskId === reference.id).map(({ category, severity, message: issueMessage, correction }) => ({ category, severity, message: issueMessage, correction })),
            }));
            const latestAsset = useDramaStore
                .getState()
                .projects.find((item) => item.id === project.id)
                ?.[kind].find((item) => item.id === asset.id);
            const latestReferences = latestAsset ? dramaAssetReferences(latestAsset) : references;
            updateAsset(project.id, kind, asset.id, { references: ensureUniqueDramaAssetReferenceIds([...latestReferences, ...reviewedReferences]) }, { markShotsStale: false });
            message.success(`已生成 ${nextReferences.length} 张候选图${review.status === "passed" ? "，可直接使用" : "，图片已保留，请查看审核建议"}`);
            setRefinementProposal(undefined);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "候选图生成失败");
        } finally {
            setGenerating(false);
        }
    };

    const actions = (
        <div className="flex items-center justify-end gap-2">
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" loading={saving} onClick={save}>
                {asset ? "保存设定" : `创建${definition.title}`}
            </Button>
        </div>
    );
    const editorContent = (
        <div className={`grid p-4 ${asset ? "gap-6 sm:p-5" : "gap-4"}`} data-drama-asset-editor-content>
            <section className={`grid min-w-0 gap-3 ${asset ? "sm:grid-cols-[136px_minmax(0,1fr)]" : ""}`}>
                {asset ? (
                    <div
                        className="grid w-full place-items-center overflow-hidden rounded-lg border border-border bg-muted/50"
                        data-drama-primary-preview
                        style={{ aspectRatio: primary?.width && primary?.height ? `${primary.width} / ${primary.height}` : "4 / 5" }}
                    >
                        {primary?.url ? (
                            <Image src={imagePreviewUrl(primary.url, 384)} alt={`${draft.name || definition.title}基准图`} rootClassName="!block !size-full" className="!size-full !object-cover" preview={{ src: imagePreviewUrl(primary.url, 1920) }} />
                        ) : (
                            <div className="grid gap-2 text-center text-muted-foreground">
                                <ImagePlus className="mx-auto size-6" />
                                <span className="text-xs">待补基准图</span>
                            </div>
                        )}
                    </div>
                ) : null}
                <div className="grid min-w-0 content-start gap-3">
                    <label className="grid gap-1.5 text-sm">
                        <span className="font-medium">{definition.label}名称</span>
                        <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={definition.placeholder} />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                        <span className="font-medium">剧情身份或用途</span>
                        <Input.TextArea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} autoSize={{ minRows: asset ? 3 : 2, maxRows: 5 }} placeholder="一句话说明它在故事中的作用" />
                    </label>
                    {kind === "clues" ? (
                        <label className="grid gap-1.5 text-sm">
                            <span className="font-medium">线索回收位置</span>
                            <Input value={draft.payoff} onChange={(event) => setDraft((current) => ({ ...current, payoff: event.target.value }))} placeholder="何时揭示、反转或回收" />
                        </label>
                    ) : null}
                </div>
            </section>

            <section className="border-t border-border pt-3.5">
                <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h3 className="text-sm font-semibold">视觉设定档</h3>
                    <p className="text-xs text-muted-foreground">供分镜与生成保持一致；标志色用于跨镜头识别角色/物件，约束服装、道具和光线中的稳定色彩线索，不是卡片状态颜色。</p>
                    {asset && kind !== "clues" ? (
                        <Button type="link" size="small" className="!px-0" icon={<Sparkles className="size-3.5" />} onClick={completeMissingSettings}>
                            智能补全缺失设定
                        </Button>
                    ) : null}
                    {asset ? (
                        <Button type="primary" size="small" className="!ml-auto !h-8 !px-3" icon={<Sparkles className="size-3.5" />} loading={generating} onClick={() => void runCompletion()}>
                            智能补全全部缺失
                        </Button>
                    ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    {(["visualIdentity", "styling", "colorPalette", "consistencyRules"] as const).map((key, index) => (
                        <label key={key} className="grid gap-1.5 text-sm">
                            <span className="font-medium">{definition.profileLabels[index]}</span>
                            <Input.TextArea value={draft.profile[key]} onChange={(event) => setDraft((current) => ({ ...current, profile: { ...current.profile, [key]: event.target.value } }))} autoSize={{ minRows: asset ? 2 : 1, maxRows: 4 }} />
                        </label>
                    ))}
                </div>
            </section>

            {kind === "characters" ? (
                <section className="border-t border-border pt-3.5">
                    <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h3 className="text-sm font-semibold">角色配音</h3>
                        <p className="text-xs text-muted-foreground">生成新声纹决定角色身份；配音指令只控制台词的语气、情绪与表演。</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(140px,0.8fr)_110px_minmax(220px,1.2fr)]">
                        <Input value={draft.voiceProfile.voiceId} readOnly placeholder="生成成功后显示 voice_id" />
                        <Space.Compact className="w-full">
                            <InputNumber
                                className="!min-w-0 !flex-1"
                                min={0.25}
                                max={4}
                                step={0.05}
                                value={draft.voiceProfile.speed}
                                onChange={(value) => setDraft((current) => ({ ...current, voiceProfile: { ...current.voiceProfile, speed: Number(value) || 1 } }))}
                            />
                            <span className="inline-flex h-8 shrink-0 items-center rounded-r-md border border-l-0 border-border bg-muted/45 px-2 text-xs text-muted-foreground">倍速</span>
                        </Space.Compact>
                        <Input value={draft.voiceProfile.instructions} onChange={(event) => setDraft((current) => ({ ...current, voiceProfile: { ...current.voiceProfile, instructions: event.target.value } }))} placeholder="语气、年龄感、情绪等配音指令" />
                    </div>
                    <div className="mt-3 grid gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">Voice Clone</span>
                            <span className="text-xs text-muted-foreground">上传样本后克隆角色音色</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                ref={voiceSampleInputRef}
                                className="hidden"
                                type="file"
                                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/opus,audio/aac,audio/flac"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    if (file) void uploadVoiceSample(file);
                                }}
                            />
                            <Button icon={<Upload className="size-4" />} loading={uploadingVoiceSample} onClick={() => voiceSampleInputRef.current?.click()}>
                                上传 Clone 音频样本
                            </Button>
                            {draft.voiceProfile.creationSampleAssetId ? (
                                <audio controls preload="metadata" src={serverMediaUrl(draft.voiceProfile.creationSampleAssetId)} />
                            ) : (
                                <span className="text-xs text-muted-foreground">需要一段属于当前用户的音频样本</span>
                            )}
                        </div>
                        <Space wrap>
                            <Button
                                type="primary"
                                icon={<Sparkles className="size-4" />}
                                loading={creatingVoice}
                                disabled={!asset || !cloneAvailable || voiceCreationActive || !draft.voiceProfile.creationSampleAssetId}
                                onClick={() => {
                                    if (!draft.voiceProfile.voiceId) return void createVoice();
                                    modal.confirm({
                                        title: "替换角色声纹？",
                                        content: "将创建一个新的供应商 voice_id。当前声纹和试听会在新声纹生成成功后被替换。",
                                        okText: "确认替换",
                                        cancelText: "取消",
                                        onOk: () => createVoice(true),
                                    });
                                }}
                            >
                                {draft.voiceProfile.voiceId ? "生成并替换新声纹" : "生成新声纹"}
                            </Button>
                            {draft.voiceProfile.creationStatus === "queued" || draft.voiceProfile.creationStatus === "running" ? (
                                <Button
                                    htmlType="button"
                                    loading={syncingVoicePreview}
                                    onClick={async () => {
                                        setSyncingVoicePreview(true);
                                        try {
                                            const result = await syncDramaVoiceCreation(project.id, character?.id || "");
                                            useDramaStore.getState().replaceProject(result.project);
                                            setDraft((current) => ({ ...current, voiceProfile: result.voiceProfile }));
                                            if (result.voiceProfile.creationStatus === "success") message.success("新声纹和试听已就绪");
                                            else if (result.voiceProfile.creationStatus === "error") message.error(result.voiceProfile.creationError || "声纹创建失败");
                                            else message.info("新声纹仍在生成");
                                        } catch (error) {
                                            message.error(error instanceof Error ? error.message : "声纹状态同步失败");
                                        } finally {
                                            setSyncingVoicePreview(false);
                                        }
                                    }}
                                >
                                    刷新声纹状态
                                </Button>
                            ) : null}
                            <Button
                                htmlType="button"
                                icon={<Volume2 size={16} />}
                                loading={syncingVoicePreview}
                                disabled={!draft.voiceProfile.voiceId || voicePreviewActive}
                                onClick={async () => {
                                    if (voicePreviewActive) return void message.info("试听任务正在生成，请先等待完成或刷新页面状态");
                                    if (draft.voiceProfile.previewStatus === "success" && draft.voiceProfile.previewAudioUrl) {
                                        await voicePreviewAudioRef.current?.play();
                                        return;
                                    }
                                    setSyncingVoicePreview(true);
                                    try {
                                        const result = draft.voiceProfile.previewStatus === "error" ? await retryDramaVoicePreview(project.id, character?.id || "") : await syncDramaVoicePreview(project.id, character?.id || "");
                                        useDramaStore.getState().replaceProject(result.project);
                                        setDraft((current) => ({ ...current, voiceProfile: result.voiceProfile }));
                                        if (result.voiceProfile.previewStatus === "error") message.error(`试听失败：${result.voiceProfile.previewError || "上游未返回可播放音频"}`);
                                        else if (result.voiceProfile.previewAudioUrl) message.success("试听音频已就绪");
                                        else message.info("试听任务仍在生成");
                                    } catch (error) {
                                        message.error(error instanceof Error ? error.message : "试听状态同步失败");
                                    } finally {
                                        setSyncingVoicePreview(false);
                                    }
                                }}
                            >
                                {draft.voiceProfile.previewStatus === "success" && draft.voiceProfile.previewAudioUrl ? "播放试听" : draft.voiceProfile.previewStatus === "error" ? "重新生成试听" : "刷新试听"}
                            </Button>
                            {voicePreviewStatus ? <span className="text-xs text-muted-foreground">{voicePreviewStatus}</span> : null}
                            {draft.voiceProfile.previewStatus === "success" && draft.voiceProfile.previewAudioUrl ? <audio ref={voicePreviewAudioRef} controls preload="metadata" src={draft.voiceProfile.previewAudioUrl} /> : null}
                        </Space>
                    </div>
                </section>
            ) : null}

            {asset ? (
                <>
                    {kind !== "clues" ? (
                        <section ref={refinementSectionRef} className="border-t border-border pt-4" data-drama-asset-refinement>
                            <div className="mb-2.5 flex items-start gap-2">
                                <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                                <div>
                                    <h3 className="text-sm font-semibold">GPT 调整</h3>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">只修改你明确提出的特征，姓名、身份和一致性规则会自动保留。先生成候选，不会覆盖当前基准图。</p>
                                </div>
                            </div>
                            {asset.refinementHistory?.length ? (
                                <div className="hide-scrollbar mb-3 grid max-h-44 gap-2 overflow-y-auto border-l-2 border-border pl-3" aria-label="GPT 调整记录">
                                    {asset.refinementHistory.slice(-3).map((item) => (
                                        <div key={item.id} className="text-xs leading-5">
                                            <p className="font-medium text-foreground">你：{item.request}</p>
                                            <p className="text-muted-foreground">GPT：{item.reply}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            <Input.TextArea value={refinementPrompt} onChange={(event) => setRefinementPrompt(event.target.value)} autoSize={{ minRows: 3, maxRows: 6 }} placeholder={`${asset.name} 的肤色、服装、造型或材质需要怎样调整？`} />
                            <div className="mt-2 flex justify-end">
                                <Button type="primary" ghost icon={<Send className="size-3.5" />} loading={refining} disabled={!refinementPrompt.trim()} onClick={() => void requestRefinement()}>
                                    生成调整方案
                                </Button>
                            </div>
                            {refinementProposal ? (
                                <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3" data-drama-asset-refinement-proposal>
                                    <p className="text-sm leading-6">{refinementProposal.reply}</p>
                                    {refinementProposal.changes.length ? (
                                        <div className="mt-2 grid gap-1.5 text-xs text-muted-foreground">
                                            {refinementProposal.changes.map((change) => (
                                                <div key={`${change.field}:${change.after}`}>
                                                    <span className="font-medium text-foreground">{change.field}</span>：{change.before || "未填写"} → {change.after}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                    {refinementProposal.preservedRules.length ? <p className="mt-2 text-xs text-muted-foreground">保留：{refinementProposal.preservedRules.join("；")}</p> : null}
                                    {refinementProposal.negativePrompt ? <p className="mt-1 text-xs text-muted-foreground">避免：{refinementProposal.negativePrompt}</p> : null}
                                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                                        <Button size="small" onClick={applyRefinementDraft}>
                                            仅应用到设定
                                        </Button>
                                        <Button size="small" type="primary" icon={<Sparkles className="size-3.5" />} loading={generating} onClick={() => void generateReference()}>
                                            生成调整候选
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </section>
                    ) : null}
                    <section className="border-t border-border pt-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold">参考图候选</h3>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">候选图不会进入镜头生成，必须明确确认一张主基准图。</p>
                                <div className="mt-2 rounded-lg border border-border bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                    <span className="font-medium text-foreground">审核标准：</span>
                                    与本次生成提示词使用同一套身份锚点、位置约束、单主体画幅、允许项和禁止项；审核建议不会阻止你选择有效候选。
                                </div>
                                {asset && kind !== "clues" ? (
                                    <details className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-xs leading-5">
                                        <summary className="cursor-pointer font-medium text-foreground">查看本次生成依据</summary>
                                        <div className="mt-2 grid gap-1 text-muted-foreground">
                                            <div>· 统一风格：{resolveDramaVisualStyle(project)}</div>
                                            <div>· 视觉方向：暗黑学院魔法环境、哥特建筑、符文法阵、暮色金紫对撞、黑金长袍、强轮廓光</div>
                                            {asset.profile?.designPrompt ? <div>· 历史 designPrompt：不直接发送，只使用已结构化的身份、服装、材质和固定道具字段</div> : null}
                                            {compileDramaAssetConstraints(project, asset, kind === "characters" ? "角色" : kind === "scenes" ? "场景" : "道具").map((constraint) => (
                                                <div key={constraint}>· {constraint}</div>
                                            ))}
                                        </div>
                                    </details>
                                ) : null}
                            </div>
                            {asset ? (
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    {kind !== "clues" ? (
                                        <Button icon={<MessageCircle className="size-3.5" />} onClick={() => refinementSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                                            GPT 调整{definition.title}
                                        </Button>
                                    ) : null}
                                    <DramaSourceImagePicker project={project} onSelect={appendSourceReference} />
                                    <Button icon={<Upload className="size-3.5" />} loading={uploading} onClick={() => fileInputRef.current?.click()}>
                                        上传候选
                                    </Button>
                                    {kind !== "clues" ? (
                                        <Button icon={<Sparkles className="size-3.5" />} loading={generating} onClick={() => void generateReference()}>
                                            生成候选
                                        </Button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                        {!references.length ? <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/25 px-4 py-4 text-center text-sm text-muted-foreground">还没有参考图，可上传已有设定或生成候选图。</div> : null}
                        {references.length ? (
                            <Image.PreviewGroup>
                                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {references.map((reference) => {
                                        const isPrimary = reference.id === primary?.id;
                                        return (
                                            <article key={reference.id} className={`min-w-0 overflow-hidden rounded-xl border bg-background ${isPrimary ? "border-foreground ring-2 ring-foreground/10" : "border-border"}`}>
                                                <Image src={imagePreviewUrl(reference.url, 384)} alt={reference.label} rootClassName="!block !w-full" className="!block !h-auto !w-full" preview={{ src: imagePreviewUrl(reference.url, 1920) }} />
                                                {reference.promptVersion || reference.reviewStatus ? (
                                                    <div className="flex min-h-8 items-center justify-between gap-2 border-t border-border px-2 text-[11px] text-muted-foreground">
                                                        <span>{reference.promptVersion ? `提示词 v${reference.promptVersion}` : "普通候选"}</span>
                                                        {reference.reviewStatus && reference.reviewStatus !== "passed" && reference.reviewStatus !== "reviewing" && reference.reviewStatus !== "pending" && reference.reviewStatus !== "unavailable" ? (
                                                            <Popover trigger="click" placement="topRight" content={<ReviewDetails reference={reference} />}>
                                                                <div className="flex items-center gap-2">
                                                                    <button type="button" className="font-medium text-amber-700 underline decoration-dotted underline-offset-2 dark:text-amber-300">
                                                                        查看原因
                                                                    </button>
                                                                    <button type="button" className="font-medium text-amber-700 underline decoration-dotted underline-offset-2 dark:text-amber-300" onClick={() => adjustFromReview(reference)}>
                                                                        按建议调整
                                                                    </button>
                                                                </div>
                                                            </Popover>
                                                        ) : (
                                                            <span className={reference.reviewStatus === "passed" ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground"}>{reviewLabel(reference)}</span>
                                                        )}
                                                    </div>
                                                ) : null}
                                                <div className="flex min-h-10 items-stretch border-t border-border">
                                                    <button
                                                        type="button"
                                                        className={`flex min-w-0 flex-1 items-center justify-center gap-1 px-2 text-xs font-medium transition ${isPrimary ? "bg-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                                                        style={isPrimary ? { color: "var(--background)" } : undefined}
                                                        onClick={() => setPrimaryReference(reference)}
                                                        aria-pressed={isPrimary}
                                                    >
                                                        {isPrimary ? <Check className="size-3.5" style={{ color: "var(--background)" }} /> : null}
                                                        <span className="truncate" style={isPrimary ? { color: "var(--background)" } : undefined}>
                                                            {reference.status === "approved" ? (reference.reviewStatus === "needs_revision" || reference.reviewStatus === "rejected" ? "主基准（有偏差）" : "已审核基准") : "确认主基准"}
                                                        </span>
                                                    </button>
                                                    <Popconfirm title="删除这张参考图？" description={isPrimary ? "删除后会自动选择下一张候选作为基准。" : undefined} okText="删除" cancelText="取消" onConfirm={() => removeReference(reference.id)}>
                                                        <Tooltip title="删除参考图">
                                                            <button
                                                                type="button"
                                                                className="grid w-10 shrink-0 place-items-center border-l border-border text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                                                                aria-label={`删除参考图：${reference.label}`}
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </button>
                                                        </Tooltip>
                                                    </Popconfirm>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </Image.PreviewGroup>
                        ) : null}
                    </section>
                </>
            ) : null}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                    void uploadReference(event.target.files?.[0]);
                    event.target.value = "";
                }}
            />
        </div>
    );

    if (!asset) {
        return (
            <Modal
                title={`新建${definition.title}`}
                open={open}
                width={640}
                centered
                destroyOnHidden
                mask={{ closable: false }}
                onCancel={onClose}
                footer={actions}
                styles={{ container: { maxWidth: "calc(100vw - 24px)" }, body: { maxHeight: "calc(100vh - 150px)", overflowY: "auto", padding: 0 } }}
            >
                {editorContent}
            </Modal>
        );
    }

    return (
        <Drawer title={`编辑${definition.title}`} placement="right" size={620} open={open} destroyOnHidden mask={{ closable: false }} onClose={onClose} styles={{ wrapper: { maxWidth: "100vw" }, body: { padding: 0 } }} footer={actions}>
            {editorContent}
        </Drawer>
    );
}

function DramaSourceImagePicker({ project, onSelect }: { project: DramaProject; onSelect: (source: NonNullable<DramaProject["sourceAssets"]>[number]) => void }) {
    const [open, setOpen] = useState(false);
    const sources = project.sourceAssets?.filter((source) => source.type === "image" && (source.serverUrl || source.remoteUrl)) || [];

    if (!sources.length) return null;
    return (
        <Popover
            trigger="click"
            open={open}
            onOpenChange={setOpen}
            placement="bottomRight"
            content={
                <div className="w-64 max-w-[calc(100vw-32px)]">
                    <div className="mb-2 text-xs text-muted-foreground">选择已有项目图片，不会创建媒体副本</div>
                    <div className="hide-scrollbar grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
                        {sources.map((source) => {
                            const url = source.serverUrl || source.remoteUrl || "";
                            return (
                                <button
                                    key={source.id}
                                    type="button"
                                    className="group min-w-0 overflow-hidden rounded-md border border-border text-left transition hover:border-foreground/40"
                                    onClick={() => {
                                        onSelect(source);
                                        setOpen(false);
                                    }}
                                    title={source.title || "项目来源图片"}
                                >
                                    <Image src={imagePreviewUrl(url, 192)} alt={source.title || "项目来源图片"} rootClassName="!block !aspect-square !w-full" className="!size-full !object-cover" preview={false} />
                                    <span className="block truncate px-1.5 py-1 text-[10px]">{source.title || "未命名图片"}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            }
        >
            <Button icon={<FolderInput className="size-3.5" />} aria-label="从项目来源选择参考图">
                从来源选择
            </Button>
        </Popover>
    );
}

function ReviewDetails({ reference }: { reference: DramaAssetReference }) {
    const issues = reference.reviewIssues || [];
    return (
        <div className="max-h-[min(70vh,520px)] w-[min(22rem,calc(100vw-48px))] overflow-y-auto pr-1 text-xs leading-5">
            <div className="mb-1 font-medium text-foreground">{reference.generationStage === "refinement" ? "按建议调整候选 · 自动审核结果" : "首次生成候选 · 自动审核结果"}</div>
            <div className="mb-2 text-muted-foreground">{reference.reviewSummary || (reference.reviewStatus === "rejected" ? "审核未通过" : "审核认为候选需要调整")}</div>
            {issues.length ? (
                <div className="space-y-2 border-t border-border pt-2">
                    {issues.map((issue, index) => (
                        <div key={`${issue.category}-${index}`}>
                            <div className="font-medium text-foreground">
                                {issue.category} · {issue.severity === "high" ? "高" : issue.severity === "medium" ? "中" : "低"}
                            </div>
                            <div className="text-muted-foreground">{issue.message}</div>
                            {issue.correction ? <div className="text-amber-700 dark:text-amber-300">建议：{issue.correction}</div> : null}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function reviewLabel(reference: DramaAssetReference) {
    if (reference.reviewStatus === "passed") return "可直接使用";
    if (reference.reviewStatus === "needs_revision") return reference.reviewIssues?.some((issue) => issue.severity === "high") ? "建议调整" : "存在偏差";
    if (reference.reviewStatus === "reviewing" || reference.reviewStatus === "pending") return "审核中";
    return "未自动审核";
}
