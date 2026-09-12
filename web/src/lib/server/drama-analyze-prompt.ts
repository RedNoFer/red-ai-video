import { DRAMA_STATIC_FRAME_DIRECTOR_RULES } from "@/lib/server/agent-skills/creative-shortcuts";
import { DRAMA_PACKAGE_ARCHITECTURE_RULES } from "@/lib/server/drama-production-package-rules";

export type DramaAnalyzePhase = "content" | "visual" | "review_completion" | "video_prompt" | "image_prompt";

export function buildDramaAnalyzeSchemaInstruction(phase: DramaAnalyzePhase, toolParameters: Record<string, unknown>, seedance25VideoInstructions = "") {
    const seedanceSkillInstruction =
        phase === "image_prompt"
            ? `本次静态图片帧任务只执行一次静态帧规则：${DRAMA_STATIC_FRAME_DIRECTOR_RULES}\n`
            : phase === "visual"
              ? `本次视觉任务只执行一次静态帧规则：${DRAMA_STATIC_FRAME_DIRECTOR_RULES}\n本次视觉任务执行制作包规则：${DRAMA_PACKAGE_ARCHITECTURE_RULES}\n`
              : seedance25VideoInstructions
                ? `本次视频提示词强制执行 Seedance 2.5 导演 Skill：${seedance25VideoInstructions}\n`
                : "";
    return `${seedanceSkillInstruction}即使渠道没有传递工具定义，也必须只返回符合以下 JSON Schema 的对象，不能返回输入对象，不能把 script 或 summary 作为顶层字段：${JSON.stringify(toolParameters)}`;
}
