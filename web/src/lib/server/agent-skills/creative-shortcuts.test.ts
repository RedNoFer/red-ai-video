import { describe, expect, it } from "vitest";

import { DRAMA_PACKAGE_ARCHITECTURE_RULES } from "../drama-production-package-rules";
import {
    CHARACTER_DESIGN_SKILL,
    DRAMA_CONTINUOUS_FRAME_RULES,
    DRAMA_PLANNING_SKILL,
    IMAGE_MOTION_SKILL,
    SEEDANCE_DIRECTOR_SKILL,
    SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT,
    SEEDANCE_STATIC_FRAME_PROMPT_SCHEME,
    SEEDANCE_STATIC_FRAME_RULES,
    SEEDANCE_VIDEO_PROMPT_LAYOUT,
} from "./creative-shortcuts";

describe("creative shortcut skills", () => {
    it("keeps the extracted image workflow rules in character design", () => {
        expect(CHARACTER_DESIGN_SKILL.instructions).toContain("change/preserve/constraints");
        expect(CHARACTER_DESIGN_SKILL.instructions).toContain("所有成功结果都保留为独立候选");
    });

    it("keeps the extracted timeline and repair rules in image motion", () => {
        expect(IMAGE_MOTION_SKILL.instructions).toContain("静态锚点、可见起点、触发");
        expect(IMAGE_MOTION_SKILL.instructions).toContain("失败重试只修改一个已定位变量");
    });

    it("keeps stage ownership and duration gates in drama planning", () => {
        expect(DRAMA_PLANNING_SKILL.instructions).toContain("改编大纲、资产清单、剧本节拍、分镜");
        expect(DRAMA_PLANNING_SKILL.instructions).toContain("按语速与动作节点核算时长");
    });

    it("requires visible action changes across continuous frames", () => {
        expect(DRAMA_CONTINUOUS_FRAME_RULES).toContain("静态帧不是无动作的氛围图");
        expect(DRAMA_CONTINUOUS_FRAME_RULES).toContain("不预设固定秒数");
        expect(DRAMA_CONTINUOUS_FRAME_RULES).toContain("不得用“构图不变、主体稳定、情绪保持不变”");
    });

    it("keeps Seedance reference roles and continuity boundaries", () => {
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("每张参考图的唯一用途");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("已人工验收的实际尾帧");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("每次返修只改变一个已定位变量");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("角色名是正式业务事实");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("本集/本镜不出镜");
    });

    it("keeps the shared static frame scheme in the Seedance rules", () => {
        expect(SEEDANCE_STATIC_FRAME_RULES).toContain("静态关键帧写法模板");
        expect(SEEDANCE_STATIC_FRAME_RULES).toContain("前景必须是具体框景或遮挡物");
        expect(SEEDANCE_STATIC_FRAME_RULES).toContain("ELS/极远景只能保留远景空间关系");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_SCHEME).toContain("9. 负面约束：");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_SCHEME).not.toContain("参考图职责：");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT).toContain("每个非空字段必须独立成行");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT).not.toContain("参考图职责：");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT).toContain("不得用逗号或分号压成一段");
    });

    it("keeps the shared video prompt layout", () => {
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("起始可见状态");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("全局设定");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("阶段节拍");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("视觉风格与光色");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("每个非空字段必须独立一行");
    });

    it("keeps the same static frame scheme in production package generation", () => {
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("静态关键帧写法模板");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("前景必须是具体框景或遮挡物");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("ELS/极远景只能保留远景空间关系");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("制作包内所有提示词模块都必须按字段逐行书写");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("字段之间使用换行");
    });

    it("keeps named non-appearing characters in the package and out of shot bindings", () => {
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("角色资产表必须保留所有已登记角色");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("不得进入本集参考图请求");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("不得只写含义不清的“无可辨识的角色名”");
    });
});
