import type { DramaEpisode, DramaProductionPreflight, DramaProject } from "@/lib/drama-project-contract";
import { compileDramaShotPrompts } from "@/lib/drama-prompt-compiler";
import { DRAMA_STYLE_DESCRIPTION, resolveDramaVisualStyle } from "@/lib/drama-style";
import { getAuthSettings, refundUserPoints } from "@/lib/auth/store";
import { resolveLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { rankTextPlanningCandidates, requestStructuredText } from "@/lib/server/text-planning-runtime";
import { preflightDramaProduction } from "@/lib/server/drama-production-preflight";
import { hasSystemAiCharge, readSystemAiBilling, systemAiBillingHeaders, systemAiIdempotencyKey } from "@/lib/server/system-ai-billing";

export type DramaGenerationPreflightInput = { origin: string; cookie: string; userId: string; requestId: string; project: DramaProject; episode: DramaEpisode; shotIds?: string[] };

export async function preflightDramaGeneration(input: DramaGenerationPreflightInput): Promise<DramaProductionPreflight> {
    const selected = new Set(input.shotIds?.length ? input.shotIds : input.episode.shots.map((shot) => shot.id));
    const base = preflightDramaProduction(input.project, input.episode, [...selected]);
    const issues = [
        ...base.issues.filter((issue) => !issue.shotId || selected.has(issue.shotId)),
        ...input.episode.shots
            .filter((shot) => selected.has(shot.id) && shot.continuityError)
            .map((shot) => ({ code: "PRIOR_CONTINUITY_REVIEW", severity: "warning" as const, message: `${shot.title}上次连续性检查：${shot.continuityError}`, shotId: shot.id, correction: "将上次复盘问题纳入本次提示词修订" })),
        ...(input.episode.visualReview?.issues || [])
            .filter((issue) => issue.taskId && selected.has(issue.taskId))
            .map((issue) => ({ code: "PRIOR_VISUAL_REVIEW", severity: "warning" as const, message: issue.message, shotId: issue.taskId, correction: issue.correction })),
    ];
    const status = issues.some((issue) => issue.severity === "blocking") ? "blocked" : issues.length ? "needs_confirmation" : "passed";
    const result: DramaProductionPreflight = { ...base, status, issues, checkedShotIds: [...selected] };
    if (result.status === "blocked" || !issues.some((issue) => issue.severity === "warning")) return result;

    const settings = await getAuthSettings();
    const logicalModel = settings.defaultModels.textModel;
    const candidates = logicalModel ? resolveLogicalModelCandidates(settings, "text", logicalModel) : [];
    if (!candidates.length) return result;
    const shots = input.episode.shots
        .filter((shot) => selected.has(shot.id))
        .map((shot) => ({ id: shot.id, title: shot.title, prompt: compileDramaShotPrompts(input.project, input.episode, shot).videoPrompt, risks: issues.filter((issue) => issue.shotId === shot.id) }));
    const tool = {
        name: "preflight_drama_generation",
        description: "检查短剧镜头生成提示词并返回必要的公开提示词修订",
        parameters: {
            type: "object",
            properties: {
                revisions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: { shotId: { type: "string" }, videoPrompt: { type: "string" }, imagePrompt: { type: "string" }, summary: { type: "string" } },
                        required: ["shotId", "imagePrompt", "videoPrompt", "summary"],
                        additionalProperties: false,
                    },
                },
            },
            required: ["revisions"],
            additionalProperties: false,
        },
    };
    const messages = [
        { role: "system", content: `你是影视生成前质检导演。只修订公开的镜头提示词，不输出思维过程。所有图片和视频必须保持${DRAMA_STYLE_DESCRIPTION}。必须保留镜头事实、角色和场景，不新增无依据主体；明确景别、主体位置、光照连续性、动作起止，并禁止文字、水印和 Logo。不得把提示词改成纯写实摄影、真人影视感或3D游戏渲染。` },
        { role: "user", content: JSON.stringify({ project: { title: input.project.title, summary: input.project.summary, style: resolveDramaVisualStyle(input.project), ratio: input.project.ratio }, shots }) },
    ];
    for (const candidate of rankTextPlanningCandidates(candidates)) {
        try {
            const call = await requestStructuredText({
                origin: input.origin,
                cookie: input.cookie,
                candidate,
                messages,
                tool,
                headers: {
                    "Content-Type": "application/json",
                    cookie: input.cookie,
                    ...systemAiBillingHeaders(logicalModel, systemAiIdempotencyKey("drama-generation-preflight", input.userId, input.requestId, candidate.channel.id, candidate.upstreamModel), candidate.upstreamModel),
                },
            });
            const parsed = JSON.parse(call.arguments) as { revisions?: Array<{ shotId?: string; videoPrompt?: string; imagePrompt?: string; summary?: string }> };
            const valid = (parsed.revisions || []).filter((revision) => selected.has(String(revision.shotId)) && String(revision.imagePrompt || "").trim() && String(revision.videoPrompt || "").trim() && String(revision.summary || "").trim());
            if (!valid.length) continue;
            const revisedPrompts = Object.fromEntries(valid.map((revision) => [String(revision.shotId), { videoPrompt: String(revision.videoPrompt).trim(), ...(revision.imagePrompt?.trim() ? { imagePrompt: revision.imagePrompt.trim() } : {}) }]));
            return { ...result, revisedPrompts, changeSummary: valid.map((revision) => String(revision.summary).trim()).slice(0, 8) };
        } catch (error) {
            const call = (error && typeof error === "object" && "headers" in error ? error : null) as { headers?: Headers } | null;
            if (call?.headers) {
                const billing = readSystemAiBilling(call.headers);
                if (hasSystemAiCharge(billing)) await refundUserPoints(input.userId, logicalModel, billing.pointsCost, "text", 1, undefined, billing.pointsRecordId);
            }
            continue;
        }
    }
    return {
        ...result,
        status: "blocked",
        issues: [...result.issues, { code: "MODEL_PREFLIGHT_FAILED", severity: "blocking", message: "生成前模型预检没有返回有效修订，未创建生成任务，请稍后重试" }],
    };
}
