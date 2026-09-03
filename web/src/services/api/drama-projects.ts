import type { CreativeReview } from "@/lib/creative-agent-contract";
import type {
    CreateDramaProjectInput,
    DramaCostSummary,
    DramaEpisode,
    DramaProductionPackagePreview,
    DramaProductionPreflight,
    DramaProductionPlan,
    DramaProductionRun,
    DramaProject,
    DramaVideoPromptAnalysis,
    DramaProjectSummary,
    DramaProjectVersion,
    DramaAssetRefinementProposal,
    DramaAssetReference,
    DramaAssetGenerationBatch,
    DramaVisualReview,
    DramaShot,
} from "@/lib/drama-project-contract";

export function listDramaAssetGenerationBatches(projectId: string) {
    return request<{ batches: DramaAssetGenerationBatch[] }>(`/api/drama/projects/${encodeURIComponent(projectId)}/asset-generation-batches`).then((data) => data.batches);
}

export function createDramaAssetGenerationBatch(projectId: string, assets: Array<{ kind: "characters" | "scenes" | "props"; assetId: string }>, config: unknown) {
    return request<{ batch: DramaAssetGenerationBatch }>(`/api/drama/projects/${encodeURIComponent(projectId)}/asset-generation-batches`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assets, config }) }).then(
        (data) => data.batch,
    );
}

export function getDramaAssetGenerationBatch(projectId: string, batchId: string) {
    return request<{ batch: DramaAssetGenerationBatch }>(`/api/drama/projects/${encodeURIComponent(projectId)}/asset-generation-batches/${encodeURIComponent(batchId)}`).then((data) => data.batch);
}

export function cancelDramaAssetGenerationBatch(projectId: string, batchId: string) {
    return request<{ batch: DramaAssetGenerationBatch }>(`/api/drama/projects/${encodeURIComponent(projectId)}/asset-generation-batches/${encodeURIComponent(batchId)}/cancel`, { method: "POST" }).then((data) => data.batch);
}

export function retryDramaAssetGenerationBatch(projectId: string, batchId: string, config: unknown) {
    return request<{ batch: DramaAssetGenerationBatch }>(`/api/drama/projects/${encodeURIComponent(projectId)}/asset-generation-batches/${encodeURIComponent(batchId)}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
    }).then((data) => data.batch);
}

export function refineDramaAsset(projectId: string, kind: "characters" | "scenes" | "props", assetId: string, prompt: string, requestId: string) {
    return request<{ proposal: DramaAssetRefinementProposal }>(`/api/drama/projects/${encodeURIComponent(projectId)}/assets/${kind}/${encodeURIComponent(assetId)}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, requestId }),
    }).then((data) => data.proposal);
}

export function completeDramaAsset(projectId: string, kind: "characters" | "scenes" | "props" | "clues", assetId: string, requestId: string, config?: unknown) {
    return request<{ project: DramaProject; missingItems: unknown[]; planning?: string; voice?: string; reference?: string; referenceTaskId?: string }>(
        `/api/drama/projects/${encodeURIComponent(projectId)}/assets/${kind}/${encodeURIComponent(assetId)}/complete`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, config }) },
    );
}

export function planDramaVoice(projectId: string, assetId: string) {
    return request<{ project: DramaProject; voiceProfile: import("@/lib/drama-project-contract").DramaVoiceProfile; task?: { id: string; status: string }; cached?: boolean; warning?: string }>(
        `/api/drama/projects/${encodeURIComponent(projectId)}/assets/characters/${encodeURIComponent(assetId)}/voice-plan`,
        {
            method: "POST",
        },
    ).then((data) => data);
}

export function createDramaVoiceProfile(projectId: string, assetId: string, input: { mode: "clone"; sampleAssetId?: string; requestId: string; confirmReplace?: boolean }) {
    return request<{ project: DramaProject; voiceProfile: import("@/lib/drama-project-contract").DramaVoiceProfile; task: { id: string; status: string }; cached: boolean }>(
        `/api/drama/projects/${encodeURIComponent(projectId)}/assets/characters/${encodeURIComponent(assetId)}/voice-creation`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    );
}

export function syncDramaVoiceCreation(projectId: string, assetId: string) {
    return request<{ project: DramaProject; voiceProfile: import("@/lib/drama-project-contract").DramaVoiceProfile; task?: { id: string; status: string } }>(
        `/api/drama/projects/${encodeURIComponent(projectId)}/assets/characters/${encodeURIComponent(assetId)}/voice-creation`,
        { method: "GET" },
    );
}

export function syncDramaVoicePreview(projectId: string, assetId: string) {
    return request<{ project: DramaProject; voiceProfile: import("@/lib/drama-project-contract").DramaVoiceProfile; task?: { id: string; status: string }; cached?: boolean }>(
        `/api/drama/projects/${encodeURIComponent(projectId)}/assets/characters/${encodeURIComponent(assetId)}/voice-preview`,
        { method: "GET" },
    ).then((data) => data);
}

export function retryDramaVoicePreview(projectId: string, assetId: string) {
    return request<{ project: DramaProject; voiceProfile: import("@/lib/drama-project-contract").DramaVoiceProfile; task?: { id: string; status: string }; cached?: boolean }>(
        `/api/drama/projects/${encodeURIComponent(projectId)}/assets/characters/${encodeURIComponent(assetId)}/voice-preview`,
        { method: "POST" },
    ).then((data) => data);
}

export function reviewDramaAssetCandidates(projectId: string, kind: "characters" | "scenes" | "props", assetId: string, prompt: string, references: DramaAssetReference[]) {
    return request<{ review: CreativeReview }>(`/api/drama/projects/${encodeURIComponent(projectId)}/assets/${kind}/${encodeURIComponent(assetId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, generationStage: references[0]?.generationStage || "initial", references: references.map(({ id, url }) => ({ id, url })) }),
    }).then((data) => data.review);
}

export function approveDramaAssetReference(projectId: string, kind: "characters" | "scenes" | "props" | "clues", assetId: string, referenceId: string) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}/assets/${kind}/${encodeURIComponent(assetId)}/primary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId }),
    }).then((data) => data.project);
}

export type DramaProjectSummaryResponse = { projects: DramaProjectSummary[]; total: number; page: number; pageSize: number };

export function listDramaProjectSummaries(input: { page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams({ page: String(input.page || 1), pageSize: String(input.pageSize || 12) });
    return request<DramaProjectSummaryResponse>(`/api/drama/projects?${query}`);
}

export async function getDramaProject(id: string) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(id)}`).then((data) => data.project);
}

export function createDramaProject(input: CreateDramaProjectInput) {
    return request<{ project: DramaProject }>("/api/drama/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }).then((data) => data.project);
}

export function saveDramaProject(project: DramaProject) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(project.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(project) }).then((data) => data.project);
}

export function saveDramaProductionPlan(projectId: string, productionPlan: DramaProductionPlan) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultVideoMode: productionPlan.video.mode === "text-to-video" ? "direct" : "storyboard", productionBible: { productionPlan } }),
    }).then((data) => data.project);
}

export function saveDramaEpisodeSettings(projectId: string, episodeId: string, input: { title: string; summary: string; style: string; productionPlan: DramaProductionPlan }) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    }).then((data) => data.project);
}

export function acceptDramaStoryboardFrame(projectId: string, episodeId: string, shotId: string, frameId: string, candidateId?: string) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/shots/${encodeURIComponent(shotId)}/frames/${encodeURIComponent(frameId)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidateId ? { candidateId } : {}),
    }).then((data) => data.project);
}

export function reviewDramaStoryboardFrame(projectId: string, episodeId: string, shotId: string, frameId: string) {
    return request<{ project: DramaProject; review: CreativeReview }>(`/api/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/shots/${encodeURIComponent(shotId)}/frames/${encodeURIComponent(frameId)}/review`, {
        method: "POST",
    });
}

export function deleteDramaProject(id: string) {
    return request<{ deleted: boolean }>(`/api/drama/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function deleteDramaAgentConversation(projectId: string, conversationId: string) {
    return request<{ deleted: boolean; activeConversationId: string; project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}/agent-conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" });
}

export function createDramaProjectVersion(project: DramaProject, reason: string) {
    return request<{ version: DramaProjectVersion }>(`/api/drama/projects/${encodeURIComponent(project.id)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, snapshot: project }),
    }).then((data) => data.version);
}

export function listDramaProjectVersions(projectId: string) {
    return request<{ versions: DramaProjectVersion[] }>(`/api/drama/projects/${encodeURIComponent(projectId)}/versions`).then((data) => data.versions);
}

export function restoreDramaProjectVersion(projectId: string, versionId: string) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`, { method: "POST" }).then((data) => data.project);
}

export function getDramaProjectCosts(projectId: string) {
    return request<{ summary: DramaCostSummary }>(`/api/drama/projects/${encodeURIComponent(projectId)}/costs`).then((data) => data.summary);
}

export function previewDramaProductionPackage(projectId: string, source: string, fileName: string) {
    return request<{ preview: DramaProductionPackagePreview }>(`/api/drama/projects/${encodeURIComponent(projectId)}/production-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", source, fileName }),
    }).then((data) => data.preview);
}

export function applyDramaProductionPackage(project: DramaProject, preview: DramaProductionPackagePreview, source: string, fileName: string) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(project.id)}/production-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", source, fileName, sourceHash: preview.sourceHash }),
    }).then((data) => data.project);
}

export function previewDramaEpisodeProductionPackage(projectId: string, episodeId: string, source: string, fileName: string) {
    return request<{ preview: DramaProductionPackagePreview }>(`/api/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/script-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", source, fileName }),
    }).then((data) => data.preview);
}

export function applyDramaEpisodeProductionPackage(project: DramaProject, episodeId: string, preview: DramaProductionPackagePreview, source: string, fileName: string) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(project.id)}/episodes/${encodeURIComponent(episodeId)}/script-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", source, fileName, sourceHash: preview.sourceHash, expectedUpdatedAt: project.updatedAt }),
    }).then((data) => data.project);
}

export function getLatestDramaProductionRun(projectId: string, episodeId: string, scope: "visual" | "production" = "production") {
    return request<{ run: DramaProductionRun | null; preflight: DramaProductionPreflight | null }>(`/api/drama/projects/${encodeURIComponent(projectId)}/production-runs?episodeId=${encodeURIComponent(episodeId)}&scope=${scope}`);
}

export function preflightDramaGeneration(projectId: string, episodeId: string, shotIds: string[], requestId: string) {
    return request<{ preflight: DramaProductionPreflight }>("/api/drama/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, episodeId, shotIds, requestId }),
    }).then((data) => data.preflight);
}

export function generateDramaVideoPrompt(input: { project: DramaProject; episode: DramaEpisode; shot: DramaShot; referenceMaterials: unknown[]; requestId?: string }) {
    const shot = input.shot;
    const episode: Partial<DramaEpisode> = {
        id: input.episode.id,
        code: input.episode.code,
        title: input.episode.title,
        continuityEdges: input.episode.continuityEdges?.filter((edge) => edge.fromShotId === shot.id || edge.toShotId === shot.id),
    };
    const characterIds = new Set([...(shot.characterIds || []), shot.characterId, shot.voiceIdentityId].filter(Boolean));
    const propIds = new Set(shot.propIds || []);
    const clueIds = new Set(shot.clueIds || []);
    return request<DramaVideoPromptAnalysis>("/api/drama/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            phase: "video_prompt",
            requestId: input.requestId || crypto.randomUUID(),
            summary: input.project.summary,
            style: input.project.style,
            episode,
            characters: input.project.characters.filter((item) => characterIds.has(item.id)),
            scenes: input.project.scenes.filter((item) => item.id === shot.sceneId),
            props: input.project.props.filter((item) => propIds.has(item.id)),
            clues: input.project.clues.filter((item) => clueIds.has(item.id)),
            shots: [shot],
            referenceMaterials: input.referenceMaterials,
        }),
    });
}

export function generateDramaImagePrompt(input: { project: DramaProject; episode: DramaEpisode; shot: DramaShot; instruction?: string; requestId?: string }) {
    const shot = input.shot;
    const episode: Partial<DramaEpisode> = {
        id: input.episode.id,
        code: input.episode.code,
        title: input.episode.title,
        continuityEdges: input.episode.continuityEdges?.filter((edge) => edge.fromShotId === shot.id || edge.toShotId === shot.id),
    };
    const characterIds = new Set([...(shot.characterIds || []), shot.characterId, shot.voiceIdentityId].filter(Boolean));
    const propIds = new Set(shot.propIds || []);
    const clueIds = new Set(shot.clueIds || []);
    return request<{ shots: Array<{ shotId: string; imagePrompt: string }> }>("/api/drama/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            phase: "image_prompt",
            requestId: input.requestId || crypto.randomUUID(),
            summary: input.project.summary,
            style: input.project.style,
            episode,
            characters: input.project.characters.filter((item) => characterIds.has(item.id)),
            scenes: input.project.scenes.filter((item) => item.id === shot.sceneId),
            props: input.project.props.filter((item) => propIds.has(item.id)),
            clues: input.project.clues.filter((item) => clueIds.has(item.id)),
            shots: [shot],
            instruction: input.instruction,
        }),
    });
}

export function createDramaProductionRun(
    projectId: string,
    episodeId: string,
    scope?: "visual",
    preflight?: DramaProductionPreflight,
    options: {
        shotIds?: string[];
        imageModel?: string;
        imageChannelId?: string;
        imageQuality?: string;
        frameType?: "start_frame" | "end_frame" | "all_frames";
        frameCount?: number;
        frameIds?: string[];
        regenerateAll?: boolean;
        productionPlan?: DramaProductionPlan;
        shotSnapshot?: DramaShot;
        referenceSelections?: Record<string, string[]>;
    } = {},
) {
    const compactPreflight = preflight
        ? {
              status: preflight.status,
              checkedShotIds: preflight.checkedShotIds,
              issues: preflight.issues,
              changeSummary: preflight.changeSummary,
          }
        : undefined;
    return request<{ run: DramaProductionRun }>(`/api/drama/projects/${encodeURIComponent(projectId)}/production-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            episodeId,
            ...(scope ? { scope } : {}),
            ...(compactPreflight ? { preflight: compactPreflight } : {}),
            ...(options.shotIds?.length ? { shotIds: options.shotIds } : {}),
            ...(options.imageModel ? { imageModel: options.imageModel } : {}),
            ...(options.imageChannelId ? { imageChannelId: options.imageChannelId } : {}),
            ...(options.imageQuality ? { imageQuality: options.imageQuality } : {}),
            ...(options.frameType ? { frameType: options.frameType } : {}),
            ...(options.frameCount ? { frameCount: options.frameCount } : {}),
            ...(options.frameIds?.length ? { frameIds: options.frameIds } : {}),
            ...(options.regenerateAll ? { regenerateAll: true } : {}),
            ...(options.productionPlan ? { productionPlan: options.productionPlan } : {}),
            ...(options.shotSnapshot ? { shotSnapshot: options.shotSnapshot } : {}),
            ...(options.referenceSelections ? { referenceSelections: options.referenceSelections } : {}),
        }),
    }).then((data) => data.run);
}

export function updateDramaProductionRun(projectId: string, runId: string, input: { action: "confirm" | "cancel" | "retry"; stepIds?: string[] }) {
    return request<{ run: DramaProductionRun }>(`/api/drama/projects/${encodeURIComponent(projectId)}/production-runs/${encodeURIComponent(runId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    }).then((data) => data.run);
}

export function ensureDramaEpisodeCanvas(projectId: string, episodeId: string) {
    return request<{ canvas: { canvasProjectId: string; href: string; title: string } }>(`/api/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/canvas`, { method: "POST" }).then((data) => data.canvas);
}

export function syncDramaCanvas(canvasProjectId: string) {
    return request<{ canvas: { canvasProjectId: string; href: string; title: string } }>(`/api/canvas/projects/${encodeURIComponent(canvasProjectId)}/drama-sync`, { method: "POST" }).then((data) => data.canvas);
}

export function updateDramaShotMedia(projectId: string, episodeId: string, shotId: string, input: { field: "storyboardImageUrl" | "storyboardEndImageUrl" | "videoUrl"; url: string; width?: number; height?: number }) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/shots/${encodeURIComponent(shotId)}/media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    }).then((data) => data.project);
}

export function updateDramaShotPrompt(projectId: string, episodeId: string, shotId: string, executionVideoPrompt?: string, imagePrompt?: string) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/shots/${encodeURIComponent(shotId)}/prompt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(executionVideoPrompt ? { executionVideoPrompt } : {}), ...(imagePrompt ? { imagePrompt } : {}) }),
    }).then((data) => data.project);
}

export function updateDramaShotImagePrompt(projectId: string, episodeId: string, shotId: string, imagePrompt: string) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/shots/${encodeURIComponent(shotId)}/prompt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePrompt }),
    }).then((data) => data.project);
}

export function updateDramaStoryboardFramePrompt(projectId: string, episodeId: string, shotId: string, frameId: string, supplierPrompt: string) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/shots/${encodeURIComponent(shotId)}/frames/${encodeURIComponent(frameId)}/prompt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierPrompt }),
    }).then((data) => data.project);
}

export function decideDramaContinuityFrame(projectId: string, episodeId: string, shotId: string, input: { frameEvidenceId: string; decision: "accept" | "reject"; expectedVideoRevision: string }) {
    return request<{ project: DramaProject }>(`/api/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/shots/${encodeURIComponent(shotId)}/continuity-frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    }).then((data) => data.project);
}

export function reviewDramaEpisode(project: DramaProject, episode: DramaEpisode) {
    return request<{ review: DramaVisualReview }>("/api/drama/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: { title: project.title, summary: project.summary, style: project.style, ratio: project.ratio }, episode }),
    }).then((data) => data.review);
}

export async function exportDramaJianyingDraft(projectId: string, input: { episodeId: string; draftPath: string; version: "5" | "6" }) {
    const response = await fetch(`/api/drama/projects/${encodeURIComponent(projectId)}/export-jianying`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { msg?: string };
        throw new Error(payload.msg || "剪映草稿导出失败");
    }
    const disposition = response.headers.get("content-disposition") || "";
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    return { blob: await response.blob(), fileName: encodedName ? decodeURIComponent(encodedName) : "短剧剪映草稿.zip" };
}

async function request<T>(url: string, init?: RequestInit) {
    const response = await fetch(url, { cache: "no-store", ...init });
    const payload = (await response.json().catch(() => ({}))) as { data?: T; msg?: string };
    if (!response.ok || !payload.data) throw new Error(payload.msg || "短剧项目请求失败");
    return payload.data;
}
