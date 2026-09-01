import { getAuthSettings } from "@/lib/auth/store";
import type { DramaCharacter, DramaVoiceBlueprint } from "@/lib/drama-project-contract";
import { resolveLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { rankTextPlanningCandidates, requestStructuredText } from "@/lib/server/text-planning-runtime";

export async function planDramaVoice(input: { origin: string; cookie: string; character: DramaCharacter; occupiedVoiceIds: string[]; requestId: string }) {
    const settings = await getAuthSettings();
    const model = settings.defaultModels.textModel;
    const candidates = resolveLogicalModelCandidates(settings, "text", model);
    if (!model || !candidates.length) throw new Error("后台尚未配置可用的默认文本模型");
    const candidate = rankTextPlanningCandidates(candidates)[0];
    const call = await requestStructuredText({
        origin: input.origin,
        cookie: input.cookie,
        candidate,
        messages: [
            { role: "system", content: "你是影视配音导演。根据角色资料生成公开的音色画像、用于创建新声纹的声音设计提示词，以及实际对白的配音指令。不要生成或猜测供应商 voice ID，只输出工具参数。" },
            { role: "user", content: JSON.stringify({ character: { name: input.character.name, description: input.character.description, profile: input.character.profile }, occupiedVoiceIds: input.occupiedVoiceIds }) },
        ],
        tool: voicePlanTool,
        headers: { "Content-Type": "application/json", "Idempotency-Key": `drama-voice-plan:${input.character.id}:${input.requestId}` },
    });
    const value = JSON.parse(call.arguments) as { blueprint?: DramaVoiceBlueprint; instructions?: string; designPrompt?: string };
    return { blueprint: value.blueprint || {}, instructions: String(value.instructions || "自然、清晰、保持角色身份一致"), designPrompt: String(value.designPrompt || "") };
}

export const voicePlanTool = {
    name: "plan_drama_voice",
    description: "生成角色公开音色画像，不生成 voice ID",
    parameters: {
        type: "object",
        properties: {
            blueprint: { type: "object", properties: { age: { type: "string" }, register: { type: "string" }, temperament: { type: "string" }, emotionalRange: { type: "string" }, texture: { type: "string" } }, additionalProperties: false },
            instructions: { type: "string" },
            designPrompt: { type: "string" },
        },
        required: ["blueprint", "instructions", "designPrompt"],
        additionalProperties: false,
    },
};
