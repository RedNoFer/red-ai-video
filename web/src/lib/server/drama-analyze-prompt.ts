export type DramaAnalyzePhase = "content" | "visual" | "review_completion" | "video_prompt" | "image_prompt";

export function buildDramaAnalyzeSchemaInstruction(_phase: DramaAnalyzePhase, toolParameters: Record<string, unknown>) {
    return `即使渠道没有传递工具定义，也必须只返回符合以下 JSON Schema 的对象，不能返回输入对象，不能把 script 或 summary 作为顶层字段：${JSON.stringify(toolParameters)}`;
}
