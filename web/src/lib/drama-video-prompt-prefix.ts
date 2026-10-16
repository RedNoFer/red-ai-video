import type { DramaProject } from "@/lib/drama-project-contract";

export const DEFAULT_DRAMA_VIDEO_PROMPT_PREFIX = `声明：图片由人工智能豆包生成，人物形象为基于参考图片进行视觉特征参考后生成的虚构数字人物，并非对现实人物真实行为、真实经历或现实场景的还原。
参考图片仅用于辅助生成角色的整体视觉特征，包括面部轮廓、发型、服装风格、构图及视觉气质等。生成结果中的人物、动作、表情、场景、时间、事件及行为均属于AI创作内容，不应被理解为参考图片中的真实人物实际参与、实施或经历了视频中的任何行为。`;

export function stripDramaVideoPromptPrefix(prompt: string, project: Pick<DramaProject, "videoPromptPrefix">) {
    const prefix = project.videoPromptPrefix?.text.trim();
    const body = prompt.trim();
    return prefix && (body === prefix || body.startsWith(`${prefix}\n`)) ? body.slice(prefix.length).trimStart() : body;
}

export function withDramaVideoPromptPrefix(prompt: string, project: Pick<DramaProject, "videoPromptPrefix">) {
    const body = stripDramaVideoPromptPrefix(prompt, project);
    const prefix = project.videoPromptPrefix?.text.trim();
    return prefix ? `${prefix}\n\n${body}`.trimEnd() : body;
}
