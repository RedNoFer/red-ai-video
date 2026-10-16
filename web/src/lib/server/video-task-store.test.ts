import { describe, expect, it } from "vitest";

import { canReconcileVideoTask } from "./video-task-store";

describe("video task reconciliation eligibility", () => {
    it("allows retrying result retrieval for a completed provider task missing its local video address", () => {
        expect(canReconcileVideoTask({ status: "error", error: "视频任务已完成但没有返回视频地址" })).toBe(true);
    });

    it("keeps unrelated provider failures terminal", () => {
        expect(canReconcileVideoTask({ status: "error", error: "The output video may contain sensitive information" })).toBe(false);
    });
});
