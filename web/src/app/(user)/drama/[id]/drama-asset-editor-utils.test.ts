import { describe, expect, it } from "vitest";

import { resolveDramaSupplierPrompt } from "./drama-asset-editor-utils";

describe("drama asset supplier prompt editor", () => {
    it("keeps an explicitly cleared prompt empty instead of restoring the automatic prompt", () => {
        expect(resolveDramaSupplierPrompt(undefined, "自动提示词")).toBe("自动提示词");
        expect(resolveDramaSupplierPrompt("", "自动提示词")).toBe("");
        expect(resolveDramaSupplierPrompt("手动提示词", "自动提示词")).toBe("手动提示词");
    });
});
