const GENERIC_UPSTREAM_FALLBACKS = new Set(["视频任务创建失败", "图片生成失败", "音频生成失败", "文本生成失败", "生成失败", "任务创建失败", "视频接口没有返回任务 ID"]);

export function resolveGenerationReviewReason(input: { executionPhase?: string; lastUpstreamStatus?: string; resultPayload?: unknown; taskPayload?: unknown }) {
    if (input.executionPhase !== "needs_review") return undefined;
    const payload = record(input.resultPayload);
    const persisted = text(payload.reviewReason) || text(payload.reason);
    if (persisted) return persisted.slice(0, 500);

    const upstreamError = upstreamErrorText(input.taskPayload) || upstreamErrorText(input.resultPayload);
    switch (text(input.lastUpstreamStatus)) {
        case "query_contract_missing":
            return withUpstreamError("生成渠道未提供可用的异步查询路径，系统无法安全确认上游结果，已停止自动重试。", upstreamError);
        case "query_contract_invalid":
            return withUpstreamError("生成渠道的查询契约返回了无效内容，系统无法安全确认上游结果，已停止自动重试。", upstreamError);
        case "worker_handler_missing":
            return "生成任务缺少可用的后台执行器处理器，系统已暂停自动重试。";
        case "submission_outcome_unknown":
            return withUpstreamError("未取得可查询的任务 ID；为避免重复生成和扣费，系统已停止自动重试。", upstreamError);
        default:
            return withUpstreamError("上游创建结果待确认；为避免重复生成和扣费，系统已停止自动重试。", upstreamError);
    }
}

/** Compose the review reason for a submission whose upstream error is already known. */
export function upstreamFailureReviewReason(upstreamError: string, status = "submission_outcome_unknown") {
    const message = upstreamErrorText({ error: upstreamError });
    if (status === "submission_outcome_unknown") return withUpstreamError("未取得可查询的任务 ID；为避免重复生成和扣费，系统已停止自动重试。", message);
    return withUpstreamError("上游创建结果待确认；为避免重复生成和扣费，系统已停止自动重试。", message);
}

/** Keep the provider's own wording in front of our generic explanation. */
function withUpstreamError(base: string, upstreamError: string) {
    return upstreamError ? `上游返回「${upstreamError}」；${base}` : base;
}

function upstreamErrorText(value: unknown) {
    const payload = record(value);
    const direct = usableError(payload.error);
    if (direct) return direct;
    const attempts = Array.isArray(payload.attempts) ? payload.attempts : [];
    for (const attempt of [...attempts].reverse()) {
        const message = usableError(record(attempt).error);
        if (message) return message;
    }
    return "";
}

function usableError(value: unknown) {
    const message = text(value);
    if (!message) return "";
    if (GENERIC_UPSTREAM_FALLBACKS.has(message)) return "";
    return message.slice(0, 200);
}

function record(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}
