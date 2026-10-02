import { describe, expect, it } from "vitest";

import { resolveDramaSupplierPrompt } from "./drama-asset-editor-utils";

describe("drama asset supplier prompt editor", () => {
    it("uses the automatic prompt until the user edits an explicit override", () => {
        expect(resolveDramaSupplierPrompt(undefined, "自动提示词")).toBe("自动提示词");
        expect(resolveDramaSupplierPrompt("手动提示词", "自动提示词")).toBe("手动提示词");
    });
});
