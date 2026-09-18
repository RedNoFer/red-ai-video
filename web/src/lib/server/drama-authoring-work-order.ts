import { createHash } from "node:crypto";

import { nanoid } from "nanoid";

import type { DramaAuthoringSourceSnapshot, DramaAuthoringWorkOrder } from "@/lib/drama-project-contract";
import { orderCreativeAssetsByIds } from "@/lib/creative-asset-references";
import { defaultDramaProductionPlan, normalizeDramaProductionPlan, resolveDramaInternalCutPolicyPreference, resolveDramaShotDurationPreference } from "@/lib/drama-production-plan";
import { resolveDramaGlobalVisualContract } from "@/lib/drama-style";
import { getAuthSettings } from "@/lib/auth/store";
import { getCreativeAssetsByIds } from "@/lib/server/creative-runtime-store";
import { getDramaProject } from "@/lib/server/drama-project-store";
import { getAgentRun, updateAgentRunById, type AgentRun } from "@/lib/server/agent-run-store";
import { buildDramaAssetReuseContext } from "@/lib/server/drama-production-package";
import { buildDramaPackageAuthoringInput, resolveDramaTargetNarrativeChapter, classifyDramaAuthoringMaterial, ensureDramaPackageTemplateSource } from "@/lib/server/agent-run-executor";
import { selectAgentSkills } from "@/lib/server/agent-run-surface-policy";
import { DRAMA_VIDEO_DIRECTOR_SKILL } from "@/lib/server/agent-skills/drama-video-director";
import { SEEDANCE_25_DIRECTOR_SKILL } from "@/lib/server/agent-skills/seedance-25";
import { DRAMA_PACKAGE_COMPILE_MANIFEST, DRAMA_PACKAGE_CONTRACT, DRAMA_PACKAGE_GATE_CODES } from "@/lib/server/drama-production-package-contract";

export class DramaAuthoringWorkOrderError extends Error {}

export async function createDramaAuthoringWorkOrderForRun(userId: string, runId: string) {
    const run = await getAgentRun(runId);
    if (!run || run.userId !== userId) throw new DramaAuthoringWorkOrderError("Agent 任务不存在");
    if (run.workflow !== "drama-script" || !run.projectId || !run.episodeId) throw new DramaAuthoringWorkOrderError("只有短剧剧本 Agent 任务可以生成 Codex 工作单");
    if (run.status !== "failed" || run.dramaFailureKind !== "timeout") throw new DramaAuthoringWorkOrderError("只有项目 GPT 明确超时且任务已结束后，才能由用户确认切换到外部 Codex");
    if (run.dramaAuthoring?.status === "ready") return { run, workOrder: run.dramaAuthoring };

    const context = await buildWorkOrderContext(run);
    const workOrder: DramaAuthoringWorkOrder = {
        id: `drama-work-order-${nanoid()}`,
        runId: run.id,
        projectId: run.projectId,
        episodeId: run.episodeId,
        provider: "codex-work-order",
        status: "ready",
        createdAt: new Date().toISOString(),
        targetNarrativeChapter: context.targetNarrativeChapter,
        request: run.prompt,
        authoringInput: context.input,
        sources: context.sources,
        contract: DRAMA_PACKAGE_CONTRACT,
        protocol: {
            packageSpecHash: DRAMA_PACKAGE_COMPILE_MANIFEST.packageSpecHash,
            templateSourceHash: DRAMA_PACKAGE_COMPILE_MANIFEST.templateSourceHash,
            packageRulesHash: DRAMA_PACKAGE_COMPILE_MANIFEST.packageRulesHash,
            rules: DRAMA_PACKAGE_COMPILE_MANIFEST.codexWorkOrderRules,
        },
        directorSkill: { id: DRAMA_VIDEO_DIRECTOR_SKILL.id, version: DRAMA_VIDEO_DIRECTOR_SKILL.sourceVersion, contentHash: DRAMA_VIDEO_DIRECTOR_SKILL.sourceContentHash },
        seedanceSkill: { id: SEEDANCE_25_DIRECTOR_SKILL.id, version: SEEDANCE_25_DIRECTOR_SKILL.sourceVersion, contentHash: SEEDANCE_25_DIRECTOR_SKILL.sourceContentHash },
        draftContract: { mode: "package", reply: "string", markdown: "string" },
        strictGateCodes: [...DRAMA_PACKAGE_GATE_CODES],
    };
    const updated = await updateAgentRunById(run.id, { dramaAuthoring: workOrder }, { type: "drama.authoring.work-order.created", data: { workOrder } }, ["failed"]);
    if (!updated) throw new DramaAuthoringWorkOrderError("任务状态已变化，请重新读取后再生成工作单");
    return { run: updated, workOrder };
}

export async function getDramaAuthoringWorkOrderForRun(userId: string, runId: string) {
    const run = await getAgentRun(runId);
    if (!run || run.userId !== userId || run.workflow !== "drama-script") throw new DramaAuthoringWorkOrderError("Agent 工作单不存在");
    if (!run.dramaAuthoring) throw new DramaAuthoringWorkOrderError("请先由用户确认生成外部 Codex 工作单");
    return { run, workOrder: run.dramaAuthoring };
}

function buildWorkOrderContext(run: AgentRun) {
    return Promise.all([getAuthSettings(), getDramaProject(run.projectId!, run.userId), getCreativeAssetsByIds(run.referencedAssetIds || [], run.userId)]).then(([settings, project, uploadedAssets]) => {
        if (!project) throw new DramaAuthoringWorkOrderError("短剧项目不存在");
        const current = project.episodes.find((episode) => episode.id === run.episodeId);
        if (!current) throw new DramaAuthoringWorkOrderError("当前集不存在或已被删除");
        const snapshot = run.snapshot && typeof run.snapshot === "object" && !Array.isArray(run.snapshot) ? (run.snapshot as { productionPlan?: unknown }).productionPlan : undefined;
        const plan = snapshot ? normalizeDramaProductionPlan(snapshot, defaultDramaProductionPlan("manual")) : undefined;
        const shotDuration = plan?.lockedAt ? (plan.video.shotDuration === 30 ? 30 : 15) : resolveDramaShotDurationPreference(run.prompt, 15);
        const promptInternalCutPolicy = resolveDramaInternalCutPolicyPreference(run.prompt, "adaptive");
        const lockedInternalCutPolicy = plan?.lockedAt ? plan.video.internalCutPolicy || resolveDramaInternalCutPolicyPreference(plan.customDirectorRules || "", "adaptive") : undefined;
        const internalCutPolicy = promptInternalCutPolicy === "dense-30s" || lockedInternalCutPolicy === "dense-30s" ? "dense-30s" : lockedInternalCutPolicy || promptInternalCutPolicy;
        const materials = orderCreativeAssetsByIds(uploadedAssets, run.referencedAssetIds || []).map((asset, index) => {
            const base = { alias: `@附件${index + 1}`, type: asset.type, title: asset.title, ...(asset.textContent ? { textContent: asset.textContent } : {}), ...(asset.mimeType ? { mimeType: asset.mimeType } : {}) };
            return { ...base, role: classifyDramaAuthoringMaterial(base), contentHash: hashMaterial(base) } as DramaAuthoringSourceSnapshot;
        });
        const materialsWithSystemTemplate = ensureDramaPackageTemplateSource(materials);
        const assetReuseContext = buildDramaAssetReuseContext(project, current);
        const adjacent = [project.episodes[project.episodes.indexOf(current) - 1], project.episodes[project.episodes.indexOf(current) + 1]]
            .filter(Boolean)
            .map((episode) => ({ id: episode.id, title: episode.title, outline: episode.outline, hook: episode.hook, nextPreview: episode.nextPreview, script: episode.script.slice(0, 6000) }));
        const targetNarrativeChapter = resolveDramaTargetNarrativeChapter(run.prompt, current.sourceRange);
        const input = buildDramaPackageAuthoringInput({
            runPrompt: run.prompt,
            project,
            current,
            assetReuseContext,
            adjacentEpisodes: adjacent,
            selectedSkills: selectAgentSkills(settings, "drama", run.selectedSkillIds || [], run).map(({ id, name }) => ({ id, name })),
            lockedPlan: plan?.lockedAt ? plan : undefined,
            globalVisualContract: resolveDramaGlobalVisualContract(project),
            uploadedMaterials: materialsWithSystemTemplate,
            requestedShotDuration: shotDuration,
            requestedInternalCutPolicy: internalCutPolicy,
            targetNarrativeChapter,
        });
        const textRoles = new Set(materialsWithSystemTemplate.filter((material) => material.type === "text").map((material) => material.role));
        if (!textRoles.has("package-template") || !textRoles.has("story-source")) throw new DramaAuthoringWorkOrderError("Codex 工作单必须提供 TXT/小说素材；制作包模板由系统自动注入");
        return { input: { ...input, contract: DRAMA_PACKAGE_CONTRACT, targetNarrativeChapter }, sources: materialsWithSystemTemplate, targetNarrativeChapter };
    });
}

function hashMaterial(value: { type?: unknown; title?: unknown; textContent?: unknown }) {
    const content = typeof value.textContent === "string" ? value.textContent : `${String(value.type || "")}:${String(value.title || "")}`;
    return createHash("sha256").update(content, "utf8").digest("hex");
}
