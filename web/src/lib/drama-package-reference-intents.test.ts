import { describe, expect, it } from "vitest";

import { bindDramaPackageReferenceEntries, extractDramaPackageReferenceEntries, replaceDramaPackageCodeTokens, stripDramaPackageReferenceSections } from "./drama-package-reference-intents";

describe("drama package reference intents", () => {
    it("extracts code facts and drops the trailing note", () => {
        const text = "【参考】CHAR_01=阿泽主外观与服装锁定；CHAR_02=苏晚主外观与细框眼镜锁定；PROP_01=泛黄手绘古图。参考仅提供外观与空间基准职责，不含上传图片编号。";
        expect(extractDramaPackageReferenceEntries(text)).toEqual([
            { code: "CHAR_01", guidance: "阿泽主外观与服装锁定" },
            { code: "CHAR_02", guidance: "苏晚主外观与细框眼镜锁定" },
            { code: "PROP_01", guidance: "泛黄手绘古图" },
        ]);
    });

    it("extracts multi-line blocks and CRLF input", () => {
        const text = "【参考】\nCHAR_01=阿泽主外观与服装锁定；\nCHAR_02=苏晚主外观与服装锁定。\n参考仅提供外观与空间基准职责。\n\n00.0–5.0秒，阿泽看向古图。";
        expect(extractDramaPackageReferenceEntries(text)).toEqual([
            { code: "CHAR_01", guidance: "阿泽主外观与服装锁定" },
            { code: "CHAR_02", guidance: "苏晚主外观与服装锁定" },
        ]);
        expect(extractDramaPackageReferenceEntries("【参考】CHAR_01=阿泽锁定")).toEqual([{ code: "CHAR_01", guidance: "阿泽锁定" }]);
    });

    it("strips reference blocks while keeping surrounding text intact and stays idempotent", () => {
        const text = "开场时，阿泽站在零公里碑前。\n【参考】CHAR_01=阿泽主外观与服装锁定。\n参考仅提供外观与空间基准职责。\n\n00.0–5.0秒，阿泽低头看古图。";
        const stripped = stripDramaPackageReferenceSections(text);
        expect(stripped).toBe("开场时，阿泽站在零公里碑前。\n\n00.0–5.0秒，阿泽低头看古图。");
        expect(stripDramaPackageReferenceSections(stripped)).toBe(stripped);
        expect(stripDramaPackageReferenceSections("没有参考块的正文。")).toBe("没有参考块的正文。");
    });

    it("stops the block at structural lines so following prompt text survives", () => {
        const text = "【参考】CHAR_01=阿泽锁定\n00.0–5.0秒，阿泽出门。";
        expect(stripDramaPackageReferenceSections(text)).toBe("00.0–5.0秒，阿泽出门。");
    });

    it("replaces known asset codes with names and leaves shot or episode codes alone", () => {
        const replaced = replaceDramaPackageCodeTokens("保持CHAR_01至CHAR_02形象不漂移，剧集E01片段SH01。", (code) => ({ CHAR_01: "阿泽", CHAR_02: "苏晚" })[code]);
        expect(replaced).toBe("保持阿泽至苏晚形象不漂移，剧集E01片段SH01。");
    });

    it("binds entries in authored order, dedupes codes, and reports unknown codes", () => {
        const { intents, unknownCodes } = bindDramaPackageReferenceEntries(
            [
                { code: "CHAR_01", guidance: "阿泽主外观与服装锁定" },
                { code: "CHAR_01", guidance: "重复项应被忽略" },
                { code: "LOC_01", guidance: "零公里起点全景" },
                { code: "CHAR_99", guidance: "未定义" },
            ],
            (code) => (code === "CHAR_01" ? { assetId: "char-1", role: "character_anchor" as const } : code === "LOC_01" ? { assetId: "scene-1", role: "scene_anchor" as const } : undefined),
        );
        expect(intents).toEqual([
            { assetId: "char-1", code: "CHAR_01", role: "character_anchor", guidance: "阿泽主外观与服装锁定" },
            { assetId: "scene-1", code: "LOC_01", role: "scene_anchor", guidance: "零公里起点全景" },
        ]);
        expect(unknownCodes).toEqual(["CHAR_99"]);
    });
});
