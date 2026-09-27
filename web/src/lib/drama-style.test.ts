import { describe, expect, it } from "vitest";

import { DRAMA_STYLE_COLOR_SCRIPT, DRAMA_STYLE_DESCRIPTION, DRAMA_STYLE_NAME, formatDramaGlobalVisualContract, resolveDramaColorScript, resolveDramaGlobalVisualContract, resolveDramaStyleContract, sanitizeDramaVisualPrompt } from "./drama-style";

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

    it("does not let a stale production-plan style override the current project style", () => {
        const currentStyle = "西方CG电影级写实幻想，physically based 3D";
        const resolved = resolveDramaStyleContract({
            style: currentStyle,
            productionBible: {
                visualStyle: currentStyle,
                productionPlan: { visual: { visualStyle: "旧东方古风国漫", artStyle: "旧版国漫渲染" } },
            },
        });

        expect(resolved).toMatchObject({ source: "custom", name: currentStyle, visualDescription: currentStyle });
        expect(resolved.artStyle).toBeUndefined();
    });

    it("does not let a locked short visual summary replace the complete project contract", () => {
        const completeStyle =
            "写实3D动画电影质感的冷调哥特式暗黑西幻风格；高精度角色、真人比例、自然表情与真实皮肤毛发材质；中世纪古堡和哥特教堂空间；蓝灰、炭黑、旧银低饱和冷色，冷窗光、低调高反差、薄雾体积光和柔和景深；动作遵循真实重量、惯性与空间关系。";
        const resolved = resolveDramaStyleContract({
            style: completeStyle,
            productionBible: {
                visualStyle: completeStyle,
                productionPlan: {
                    lockedAt: "2026-09-27T00:00:00.000Z",
                    source: "manual",
                    visual: {
                        visualStyle: "冷调哥特暗黑西幻",
                        artStyle: "高精度3D动画",
                        visualDirection: "冷调哥特暗黑西幻；16:9横向关系构图；人物、手部、道具始终可辨",
                        source: "manual",
                    },
                },
            },
        });

        expect(resolved.name).toBe(completeStyle);
        expect(resolved.visualDescription).toBe(completeStyle);
        expect(resolved.artStyle).toBeUndefined();
    });

    it("uses a custom bible style when the top-level style is the stale built-in default", () => {
        expect(resolveDramaStyleContract({ style: DRAMA_STYLE_NAME, productionBible: { visualStyle: "其他风格" } })).toMatchObject({ source: "custom", name: "其他风格", visualDescription: "其他风格" });
    });

    it("recognizes the legacy dark-academy default as built-in when a project Bible has custom style", () => {
        expect(resolveDramaStyleContract({ style: "半写实动漫幻想风 · 暗黑学院史诗奇幻", productionBible: { visualStyle: "VS7 东方玄幻修仙 + 3D 国漫电影质感 + PBR 材质" } })).toMatchObject({
            source: "custom",
            name: "VS7 东方玄幻修仙 + 3D 国漫电影质感 + PBR 材质",
        });
    });

    it("keeps the built-in default only when no custom project style is configured", () => {
        const style = "自然光真人影视感，冷灰蓝低饱和";
        expect(resolveDramaStyleContract({ style: DRAMA_STYLE_NAME, productionBible: { visualStyle: style } })).toMatchObject({ source: "custom", name: style, visualDescription: style });
    });

    it("preserves an explicitly configured non-default color script for custom styles", () => {
        const style = "真人影视感，阴雨自然光";
        expect(resolveDramaColorScript({ style, productionBible: { visualStyle: style, colorScript: "冷灰蓝、湿泥棕" } })).toBe("冷灰蓝、湿泥棕");
    });

    it("uses the locked production-plan art style and global negative prompt", () => {
        const resolved = resolveDramaStyleContract({
            style: DRAMA_STYLE_NAME,
            productionBible: {
                visualStyle: DRAMA_STYLE_NAME,
                productionPlan: { visual: { visualStyle: "东方写实摄影", artStyle: "克制的电影级空间美术，真实材质" } },
                globalNegativePrompt: "不要现代灯具、不要塑料感",
            },
        });

        expect(resolved).toMatchObject({ name: "东方写实摄影", artStyle: "克制的电影级空间美术，真实材质", globalNegativePrompt: "不要现代灯具、不要塑料感" });
        expect(
            formatDramaGlobalVisualContract(
                resolveDramaGlobalVisualContract({
                    style: DRAMA_STYLE_NAME,
                    productionBible: { visualStyle: DRAMA_STYLE_NAME, productionPlan: { visual: { visualStyle: "东方写实摄影", artStyle: "克制的电影级空间美术，真实材质" } }, globalNegativePrompt: "不要现代灯具、不要塑料感" },
                }),
            ),
        ).toContain("全局画风规格：克制的电影级空间美术，真实材质");
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

    it("derives one stable fingerprint from the complete visual contract", () => {
        const project = { style: "西方写实 CG 电影质感", productionBible: { colorScript: "冷蓝灰与旧银", globalNegativePrompt: "禁止塑料感" } };
        const first = resolveDramaGlobalVisualContract(project);
        const second = resolveDramaGlobalVisualContract(structuredClone(project));

        expect(first.fingerprint).toMatch(/^visual-[0-9a-f]+$/u);
        expect(second.fingerprint).toBe(first.fingerprint);
    });
});
