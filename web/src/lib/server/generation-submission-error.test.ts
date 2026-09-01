import { describe, expect, it } from "vitest";

import { GenerationSubmissionSafeFailure, GenerationSubmissionUncertainError, generationSubmissionResponseError, generationSubmissionUncertainError } from "./generation-submission-error";

describe("generation submission error classification", () => {
    it("treats an explicit upstream stack overflow as a retryable failed submission", () => {
        expect(generationSubmissionResponseError(500, "Maximum call stack size exceeded")).toBeInstanceOf(GenerationSubmissionSafeFailure);
    });

    it("keeps an unknown server failure in review to avoid duplicate submissions", () => {
        expect(generationSubmissionResponseError(500, "upstream connection closed")).toBeInstanceOf(GenerationSubmissionUncertainError);
    });

    it("treats an explicit upstream unavailable response as a failed submission", () => {
        expect(generationSubmissionResponseError(503, "Upstream service temporarily unavailable")).toBeInstanceOf(GenerationSubmissionSafeFailure);
    });

    it("classifies a thrown stack overflow like the same upstream response error", () => {
        expect(generationSubmissionUncertainError(new Error("Maximum call stack size exceeded"), "图片任务创建结果未知")).toBeInstanceOf(GenerationSubmissionSafeFailure);
    });

    it("classifies a thrown account availability error as a failed submission", () => {
        expect(generationSubmissionUncertainError(new Error("No available compatible accounts"), "图片任务创建结果未知")).toBeInstanceOf(GenerationSubmissionSafeFailure);
    });
});
