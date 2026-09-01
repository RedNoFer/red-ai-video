import type { DramaAssetProfile, DramaAssetRefinementChange, DramaAssetRefinementProposal } from "@/lib/drama-project-contract";

const FIELDS = new Set<DramaAssetRefinementChange["field"]>(["description", "visualIdentity", "styling", "colorPalette", "consistencyRules"]);

export function normalizeDramaAssetRefinement(value: unknown, currentProfile: DramaAssetProfile, request: string, currentDescription = ""): DramaAssetRefinementProposal {
    const input = object(value);
    const updated = object(input.updatedProfile);
    const requestedFields = explicitRequestedFields(request);
    const changes = array(input.changes).flatMap((item): DramaAssetRefinementChange[] => {
        const change = object(item);
        const field = text(change.field) as DramaAssetRefinementChange["field"];
        const after = text(change.after);
        return FIELDS.has(field) && after && (!requestedFields.size || requestedFields.has(field)) ? [{ field, before: field === "description" ? currentDescription : currentProfile[field], after, reason: text(change.reason) }] : [];
    });
    const changedFields = new Set(changes.map((change) => change.field));
    const updatedProfile: DramaAssetProfile = {
        visualIdentity: changedFields.has("visualIdentity") ? optionalText(updated.visualIdentity) || currentProfile.visualIdentity : currentProfile.visualIdentity,
        styling: changedFields.has("styling") ? optionalText(updated.styling) || currentProfile.styling : currentProfile.styling,
        colorPalette: changedFields.has("colorPalette") ? optionalText(updated.colorPalette) || currentProfile.colorPalette : currentProfile.colorPalette,
        consistencyRules: changedFields.has("consistencyRules") ? optionalText(updated.consistencyRules) || currentProfile.consistencyRules : currentProfile.consistencyRules,
        designPrompt: currentProfile.designPrompt,
        identityAnchors: currentProfile.identityAnchors,
        spatialRules: currentProfile.spatialRules,
        stateRules: currentProfile.stateRules,
        forbiddenChanges: currentProfile.forbiddenChanges,
    };
    const negativePrompt = text(input.negativePrompt);
    const preservedRules = Array.from(new Set([...texts(input.preservedRules), currentProfile.consistencyRules].filter(Boolean)));
    const compiledPrompt = [
        `用户调整要求：${request.trim()}`,
        `视觉识别：${updatedProfile.visualIdentity}`,
        `服装与造型：${updatedProfile.styling}`,
        `固定色彩：${updatedProfile.colorPalette}`,
        `一致性规则：${updatedProfile.consistencyRules}`,
        preservedRules.length ? `必须保留：${preservedRules.join("；")}` : "",
        negativePrompt ? `避免：${negativePrompt}` : "",
    ]
        .filter(Boolean)
        .join("\n");
    return {
        reply: text(input.reply) || "已根据你的要求整理角色调整方案。",
        changes,
        updatedDescription: changedFields.has("description") ? optionalText(input.updatedDescription) || currentDescription : undefined,
        updatedProfile,
        compiledPrompt,
        negativePrompt,
        preservedRules,
    };
}

function explicitRequestedFields(request: string) {
    const fields = new Set<DramaAssetRefinementChange["field"]>();
    const value = request.toLowerCase();
    if (/(肤色|肤质|皮肤|五官|脸型|眼睛|眼神|眉毛|鼻子|嘴唇|发型|发色|头发|妆容|身高|体型|体态|外貌|容貌|年龄感)/.test(value)) fields.add("visualIdentity");
    if (/(服装|衣服|穿着|造型|配饰|饰品|首饰|盔甲|铠甲|鞋靴|材质|剪裁|武器)/.test(value)) fields.add("styling");
    if (/(配色|色板|色彩方案|主色|辅色|标志色|固定色)/.test(value)) fields.add("colorPalette");
    if (/(一致性规则|固定规则|身份锚点|空间约束|状态约束|禁止项)/.test(value)) fields.add("consistencyRules");
    if (/(剧情身份|角色身份|故事身份|人物身份|剧情用途|角色用途|背景故事|人物经历)/.test(value)) fields.add("description");
    return fields;
}

export const dramaAssetRefinementTool = {
    name: "refine_drama_asset",
    description: "在保留资产身份锚点和一致性规则的前提下，生成字段级视觉调整方案",
    parameters: {
        type: "object",
        properties: {
            reply: { type: "string" },
            changes: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        field: { type: "string", enum: Array.from(FIELDS) },
                        before: { type: "string" },
                        after: { type: "string" },
                        reason: { type: "string" },
                    },
                    required: ["field", "before", "after", "reason"],
                    additionalProperties: false,
                },
            },
            updatedDescription: { type: "string" },
            updatedProfile: {
                type: "object",
                properties: {
                    visualIdentity: { type: "string" },
                    styling: { type: "string" },
                    colorPalette: { type: "string" },
                    consistencyRules: { type: "string" },
                    designPrompt: { type: "string" },
                    identityAnchors: { type: "array", items: { type: "string" } },
                    spatialRules: { type: "array", items: { type: "string" } },
                    stateRules: { type: "array", items: { type: "string" } },
                    forbiddenChanges: { type: "array", items: { type: "string" } },
                },
                additionalProperties: false,
            },
            negativePrompt: { type: "string" },
            preservedRules: { type: "array", items: { type: "string" } },
        },
        required: ["reply", "changes", "updatedProfile", "negativePrompt", "preservedRules"],
        additionalProperties: false,
    },
};

function object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
    return typeof value === "string" ? value.trim() : undefined;
}

function texts(value: unknown) {
    return array(value).map(text).filter(Boolean);
}
