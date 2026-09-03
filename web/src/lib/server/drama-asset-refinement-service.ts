import { getAuthSettings, refundUserPoints } from "@/lib/auth/store";
import type { DramaNamedAsset, DramaProject } from "@/lib/drama-project-contract";
import { compileDramaAssetRefinementPrompt } from "@/lib/drama-prompt-compiler";
import { dramaAssetRefinementTool, normalizeDramaAssetRefinement } from "@/lib/server/drama-asset-refinement";
import { toSafeGenerationErrorMessage } from "@/lib/server/generation-errors";
import { resolveTextPlanningModelCandidates } from "@/lib/server/logical-model-router";
import { hasSystemAiCharge, readSystemAiBilling, systemAiBillingHeaders, systemAiIdempotencyKey } from "@/lib/server/system-ai-billing";
import { rankTextPlanningCandidates, requestStructuredText } from "@/lib/server/text-planning-runtime";
import { DRAMA_ASSET_IMAGE_SKILL } from "@/lib/drama-image-skill";

export class DramaAssetRefinementError extends Error {
    constructor(message: string, readonly status = 502) {
        super(message);
    }
}

export async function refineDramaAssetWithModel(input: {
    origin: string;
    cookie: string;
    userId: string;
    requestId: string;
    project: Pick<DramaProject, "id" | "title" | "style" | "ratio" | "productionBible">;
    kind: "characters" | "scenes" | "props";
    asset: DramaNamedAsset;
    prompt: string;
}) {
    const settings = await getAuthSettings();
    const model = settings.defaultModels.textModel;
    const candidates = resolveTextPlanningModelCandidates(settings, model);
    if (!model || !candidates.length) throw new DramaAssetRefinementError("后台尚未配置可用的默认文本模型", 503);
    const profile = input.asset.profile || { visualIdentity: "", styling: "", colorPalette: "", consistencyRules: "" };
    let latestError: unknown;
    for (const candidate of rankTextPlanningCandidates(candidates)) {
        const idempotencyKey = systemAiIdempotencyKey("drama-asset-refine", input.userId, input.project.id, input.asset.id, input.requestId, candidate.channelId, candidate.upstreamModel);
        try {
            const call = await requestStructuredText({
                origin: input.origin,
                cookie: input.cookie,
                candidate,
                messages: [
                    { role: "system", content: refinementInstruction(input.kind) },
                    {
                        role: "user",
                        content: JSON.stringify({
                            request: input.prompt,
                            project: { title: input.project.title, style: input.project.style, ratio: input.project.ratio },
                            asset: { id: input.asset.id, name: input.asset.name, description: input.asset.description, profile },
                        }),
                    },
                ],
                tool: dramaAssetRefinementTool,
                headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey, "X-Client-Request-Id": idempotencyKey, ...systemAiBillingHeaders(model, idempotencyKey, candidate.upstreamModel) },
                onInvalidResponse: (headers) => refundInvalid(input.userId, model, headers),
            });
            try {
                const proposal = normalizeDramaAssetRefinement(JSON.parse(call.arguments), profile, input.prompt, input.asset.description);
                if (!proposal.changes.length) throw new Error("模型没有返回有效调整项");
                return {
                    ...proposal,
                    compiledPrompt: compileDramaAssetRefinementPrompt(input.project, input.asset, input.kind === "characters" ? "角色" : input.kind === "scenes" ? "场景" : "道具", proposal, input.prompt),
                };
            } catch (error) {
                await refundInvalid(input.userId, model, call.headers);
                throw error;
            }
        } catch (error) {
            latestError = error;
        }
    }
    throw new DramaAssetRefinementError(toSafeGenerationErrorMessage(latestError, "角色调整失败，请稍后重试"));
}

function refinementInstruction(kind: "characters" | "scenes" | "props") {
    const rules =
        kind === "characters"
            ? "允许调整肤色、肤质、妆容、发型发色、服装剪裁材质层次配饰、体态和气质。姓名、身份、核心年龄、关键五官、已确认身份锚点、标志色与一致性规则默认不可改变。肤色调整不得擅自改变族裔、脸型或年龄。服装必须体现剧情身份、职业和个人经历，禁止通用 NPC、RPG 套装、模板化盔甲和无意义装饰。"
            : kind === "scenes"
              ? "允许调整材质、陈设、光线、天气和时间；空间结构、入口和主要物件位置默认不可改变。"
              : "允许调整材质、磨损、颜色和细节结构；外形轮廓和关键识别特征默认不可改变。";
    return `你是 VOZEB PRO 影视资产设计师。根据用户要求生成字段级调整方案，未被用户明确要求修改的字段必须原样保留。${DRAMA_ASSET_IMAGE_SKILL.refinementRules}${rules}只输出可验证的字段变更和公开生成约束，必须调用 refine_drama_asset，不得输出 Markdown、内部规划或思维链。`;
}

async function refundInvalid(userId: string, model: string, headers: Headers) {
    const billing = readSystemAiBilling(headers);
    if (hasSystemAiCharge(billing)) await refundUserPoints(userId, model, billing.pointsCost, "text", 1, undefined, billing.pointsRecordId);
}
