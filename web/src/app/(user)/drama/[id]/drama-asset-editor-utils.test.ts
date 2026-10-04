import { describe, expect, it } from "vitest";

import { resolveDramaSupplierPrompt } from "./drama-asset-editor-utils";

describe("drama asset supplier prompt editor", () => {
    it("uses the automatic prompt until the user edits an explicit override", () => {
        expect(resolveDramaSupplierPrompt(undefined, "自动提示词")).toBe("自动提示词");
        expect(resolveDramaSupplierPrompt("手动提示词", "自动提示词")).toBe("手动提示词");
    });

    it("reconciles saved scene prompt ratios with the current project without dropping user details", () => {
        const saved = "场景：保留石墙和长案；输出16:9\n构图与画幅：16:9 横向全景，门窗与通道可读；保留雨水痕迹";

        expect(resolveDramaSupplierPrompt(saved, "自动提示词", "1080x1920")).toBe("场景：保留石墙和长案；输出1080x1920 竖向\n构图与画幅：1080x1920 竖向全景，门窗与通道可读；保留雨水痕迹");
        expect(resolveDramaSupplierPrompt("手工场景提示词，无比例字段", "自动提示词", "9:16")).toContain("构图与画幅：9:16 竖向");
    });
});
