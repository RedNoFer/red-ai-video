export class GenerationSubmissionSafeFailure extends Error {
    constructor(
        message: string,
        readonly status?: number,
    ) {
        super(message);
        this.name = "GenerationSubmissionSafeFailure";
    }
}

export class GenerationSubmissionUncertainError extends Error {
    constructor(
        message: string,
        readonly diagnostics?: Record<string, unknown>,
    ) {
        super(message);
        this.name = "GenerationSubmissionUncertainError";
    }
}

export function isSafeGenerationSubmissionStatus(status: number) {
    return SAFE_SUBMISSION_FAILURE_STATUSES.has(status);
}

export function generationSubmissionResponseError(status: number, message: string) {
    if (isGenerationAccountAvailabilityError(message) || isDeterministicGenerationSubmissionError(message) || isExplicitUpstreamUnavailableError(message)) return new GenerationSubmissionSafeFailure(message, status);
    return isSafeGenerationSubmissionStatus(status) ? new GenerationSubmissionSafeFailure(message, status) : new GenerationSubmissionUncertainError(message);
}

export function isGenerationAccountAvailabilityError(message: string) {
    return /no\s+available\s+(?:compatible\s+)?accounts?|no\s+compatible\s+accounts?|no\s+available\s+providers?/i.test(message);
}

function isDeterministicGenerationSubmissionError(message: string) {
    return /maximum\s+call\s+stack\s+size\s+exceeded|(?:请求|生成).*(?:参数|请求体).*(?:循环引用|嵌套层级过深)|高级请求模板.*(?:循环引用|嵌套层级过深)/i.test(message);
}

function isExplicitUpstreamUnavailableError(message: string) {
    return /upstream service temporarily unavailable/i.test(message);
}

export function generationSubmissionUncertainError(error: unknown, fallback: string) {
    if (error instanceof GenerationSubmissionSafeFailure || error instanceof GenerationSubmissionUncertainError) return error;
    const message = error instanceof Error && error.message ? error.message : fallback;
    return isGenerationAccountAvailabilityError(message) || isDeterministicGenerationSubmissionError(message) ? new GenerationSubmissionSafeFailure(message) : new GenerationSubmissionUncertainError(message);
}

const SAFE_SUBMISSION_FAILURE_STATUSES = new Set([400, 401, 403, 404, 405, 413, 415, 422, 429]);
