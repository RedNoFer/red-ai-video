import { describe, expect, it } from "vitest";

import { resolveGenerationReviewReason, upstreamFailureReviewReason } from "./generation-task-review-reason";

describe("generation review reason", () => {
    it("prefers the persisted sanitized reason", () => {
        expect(resolveGenerationReviewReason({ executionPhase: "needs_review", lastUpstreamStatus: "submission_outcome_unknown", resultPayload: { reviewReason: "渠道返回内容无法确认" } })).toBe("渠道返回内容无法确认");
    });

    it("explains a legacy uncertain submission without implying it is safe to retry", () => {
        expect(resolveGenerationReviewReason({ executionPhase: "needs_review", lastUpstreamStatus: "submission_outcome_unknown" })).toContain("避免重复生成和扣费");
    });

    it("keeps the provider error text in front of the generic explanation", () => {
        const reason = resolveGenerationReviewReason({
            executionPhase: "needs_review",
            lastUpstreamStatus: "submission_outcome_unknown",
            taskPayload: { attempts: [{ attemptNo: 1, status: "failed", error: "这班还没开" }] },
        });
        expect(reason).toContain("上游返回「这班还没开」");
        expect(reason).toContain("未取得可查询的任务 ID");
    });

    it("ignores generic internal fallbacks when looking for the upstream error", () => {
        const reason = resolveGenerationReviewReason({
            executionPhase: "needs_review",
            lastUpstreamStatus: "submission_outcome_unknown",
            taskPayload: { attempts: [{ attemptNo: 1, status: "failed", error: "视频任务创建失败" }] },
        });
        expect(reason).not.toContain("上游返回");
        expect(reason).toContain("避免重复生成和扣费");
    });

    it("builds the review reason from a known upstream error", () => {
        expect(upstreamFailureReviewReason("这班还没开")).toContain("上游返回「这班还没开」");
        expect(upstreamFailureReviewReason("")).not.toContain("上游返回");
    });
});
