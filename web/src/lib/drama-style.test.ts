import { describe, expect, it } from "vitest";

import { DRAMA_STYLE_COLOR_SCRIPT, DRAMA_STYLE_DESCRIPTION, DRAMA_STYLE_NAME, resolveDramaColorScript, resolveDramaStyleContract, sanitizeDramaVisualPrompt } from "./drama-style";

describe("drama visual style contract", () => {
    it("uses the default style and color script when no style is supplied", () => {
        expect(resolveDramaStyleContract({})).toMatchObject({
            source: "default",
            name: DRAMA_STYLE_NAME,
            visualDescription: DRAMA_STYLE_DESCRIPTION,
            colorScript: DRAMA_STYLE_COLOR_SCRIPT,
        });
    });

    it("keeps a custom realistic style and its explicit negative constraint", () => {
        const style = "ARRI Alexa 65自然光电影摄影，冷灰蓝；真实狼毛发与泥水质感；禁止动漫、插画、游戏CG";
        const resolved = resolveDramaStyleContract({ style });

        expect(resolved).toMatchObject({ source: "custom", name: style, visualDescription: style });
        expect(resolved.explicitNegativePrompt).toContain("禁止动漫");
        expect(resolved.visualDescription).not.toContain("暮色金紫");
    });

    it("prefers project style over a stale bible value and removes injected default color from custom styles", () => {
        const style = "现实悬疑摄影，低饱和冷蓝灰";
        const project = { style, productionBible: { visualStyle: DRAMA_STYLE_NAME, colorScript: DRAMA_STYLE_COLOR_SCRIPT } };

        expect(resolveDramaStyleContract(project)).toMatchObject({ source: "custom", name: style, visualDescription: style });
        expect(resolveDramaColorScript(project)).toBe("");
    });

    it("uses the non-empty project style before the bible style, including the explicit default", () => {
        expect(resolveDramaStyleContract({ style: DRAMA_STYLE_NAME, productionBible: { visualStyle: "其他风格" } })).toMatchObject({ source: "default", name: DRAMA_STYLE_NAME });
    });

    it("keeps the explicit default project style ahead of a custom bible value", () => {
        const style = "自然光真人影视感，冷灰蓝低饱和";
        expect(resolveDramaStyleContract({ style: DRAMA_STYLE_NAME, productionBible: { visualStyle: style } })).toMatchObject({
            source: "default",
            name: DRAMA_STYLE_NAME,
            visualDescription: DRAMA_STYLE_DESCRIPTION,
        });
    });

    it("preserves an explicitly configured non-default color script for custom styles", () => {
        const style = "真人影视感，阴雨自然光";
        expect(resolveDramaColorScript({ style, productionBible: { visualStyle: style, colorScript: "冷灰蓝、湿泥棕" } })).toBe("冷灰蓝、湿泥棕");
    });

    it("only strips known legacy layout tokens from prompt text", () => {
        const value = "VS14写实电影感、纯写实摄影、真人影视；中性浅灰背景；多视角设定板";
        const sanitized = sanitizeDramaVisualPrompt(value);

        expect(sanitized).toContain("写实电影感");
        expect(sanitized).toContain("纯写实摄影");
        expect(sanitized).toContain("真人影视");
        expect(sanitized).not.toContain("VS14");
        expect(sanitized).not.toContain("中性浅灰背景");
        expect(sanitized).not.toContain("多视角设定板");
    });
});
