import { describe, expect, it } from "vitest";

import { isGenericDramaDetail, validateDramaFrameDetail, validateDramaPerformanceDetail } from "./drama-prompt-quality";

describe("drama prompt quality", () => {
    it("rejects generic performance language while accepting visible results", () => {
        expect(isGenericDramaDetail("表情自然")).toBe(true);
        expect(isGenericDramaDetail("眉头收紧，视线移向门口")).toBe(false);
        expect(validateDramaPerformanceDetail(undefined, undefined)).toEqual(["镜头缺少表演计划"]);
        expect(validateDramaFrameDetail("保持当前状态", "帧画面")).toContain("缺少具体");
    });
});
