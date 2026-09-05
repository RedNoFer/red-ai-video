import { describe, expect, it } from "vitest";

import { DRAMA_ASSET_IMAGE_SKILL } from "@/lib/drama-image-skill";
import { DRAMA_PACKAGE_ARCHITECTURE_RULES } from "../drama-production-package-rules";
import {
    CHARACTER_DESIGN_SKILL,
    DRAMA_CONTINUOUS_FRAME_RULES,
    DRAMA_PLANNING_SKILL,
    IMAGE_MOTION_SKILL,
    SEEDANCE_DIRECTOR_SKILL,
    SEEDANCE_25_DIRECTOR_SKILL,
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
        expect(IMAGE_MOTION_SKILL.instructions).toContain("动态意图、全局设定、起始可见状态、时间段动作");
        expect(IMAGE_MOTION_SKILL.instructions).toContain("失败重试只修改一个已定位变量");
        expect(IMAGE_MOTION_SKILL.instructions).toContain("座位、支撑面、通道、门窗和遮挡");
    });

    it("keeps stage ownership and duration gates in drama planning", () => {
        expect(DRAMA_PLANNING_SKILL.instructions).toContain("改编大纲、资产清单、剧本节拍、分镜");
        expect(DRAMA_PLANNING_SKILL.instructions).toContain("按语速与动作节点核算时长");
        expect(DRAMA_PLANNING_SKILL.instructions).toContain("人物欲望、阻力、空间几何、受控视线和剪辑节奏");
        expect(DRAMA_PLANNING_SKILL.instructions).toContain("每个镜头至少承担情绪变化、推进动作或增加压力中的一项");
    });

    it("requires visible action changes across continuous frames", () => {
        expect(DRAMA_CONTINUOUS_FRAME_RULES).toContain("静态帧不是无动作的氛围图");
        expect(DRAMA_CONTINUOUS_FRAME_RULES).toContain("不预设固定秒数");
        expect(DRAMA_CONTINUOUS_FRAME_RULES).toContain("不得用“构图不变、主体稳定、情绪保持不变”");
        expect(DRAMA_CONTINUOUS_FRAME_RULES).toContain("谁在何处、以什么姿势、借助什么结构、对谁或什么做什么");
        expect(DRAMA_CONTINUOUS_FRAME_RULES).toContain("中央过道保持通行");
        expect(DRAMA_CONTINUOUS_FRAME_RULES).toContain("不得虚构未在原文或资产中出现的人物");
    });

    it("keeps Seedance reference roles and continuity boundaries", () => {
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("每张参考图的唯一用途");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("已人工验收的实际尾帧");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("每次返修只改变一个已定位变量");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("角色名是正式业务事实");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("本集/本镜不出镜");
    });

    it("keeps the complete Seedance 2.5 prompt contract available", () => {
        expect(SEEDANCE_25_DIRECTOR_SKILL.id).toBe("seedance-25-director");
        expect(SEEDANCE_25_DIRECTOR_SKILL.instructions).toContain("timestamp-30s");
        expect(SEEDANCE_25_DIRECTOR_SKILL.instructions).toContain("素材绑定");
        expect(SEEDANCE_25_DIRECTOR_SKILL.instructions).toContain("起点 → 动作与触发 → 可见衔接 → 终点");
        expect(SEEDANCE_25_DIRECTOR_SKILL.instructions).toContain("只修改一个已定位变量");
        expect(SEEDANCE_25_DIRECTOR_SKILL.sourceCommit).toHaveLength(40);
        expect(SEEDANCE_25_DIRECTOR_SKILL.defaultConfig).toEqual({});
    });

    it("keeps the fixed character-sheet and single-subject asset rules available", () => {
        expect(DRAMA_ASSET_IMAGE_SKILL.promptRules).toContain("纯白色无缝背景的三视图角色基准板");
        expect(DRAMA_ASSET_IMAGE_SKILL.promptRules).toContain("场景图只生成一个没有人物的空间");
        expect(DRAMA_ASSET_IMAGE_SKILL.refinementRules).toContain("change / preserve / constraints");
    });

    it("keeps the shared static frame scheme in the Seedance rules", () => {
        expect(SEEDANCE_STATIC_FRAME_RULES).toContain("静态关键帧写法模板");
        expect(SEEDANCE_STATIC_FRAME_RULES).toContain("前景必须是具体框景或遮挡物");
        expect(SEEDANCE_STATIC_FRAME_RULES).toContain("ELS/极远景只能保留远景空间关系");
        expect(SEEDANCE_STATIC_FRAME_RULES).toContain("人物姿势必须有可见且合理的支撑/接触结构");
        expect(SEEDANCE_STATIC_FRAME_RULES).toContain("封闭马车、船舱、车内、餐桌、病床");
        expect(SEEDANCE_STATIC_FRAME_RULES).toContain("必须按场景前进方向选择左侧或右侧的明确座位");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_SCHEME).toContain("9. 负面约束：");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_SCHEME).not.toContain("参考图职责：");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT).toContain("每个非空字段必须独立成行");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT).toContain("相对座位/长凳/床沿/通道/门窗/道具的位置");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT).toContain("未声明人物不入画");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT).not.toContain("参考图职责：");
        expect(SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT).toContain("不得用逗号或分号压成一段");
    });

    it("keeps the shared video prompt layout", () => {
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("起始可见状态");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("全局设定");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("时间段动作");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("起点、动作与触发、可见衔接、终点");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("公开 videoPrompt 只使用本布局字段");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).not.toContain("阶段节拍：只有多事件");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("视觉风格与光色");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("每个非空字段必须独立一行");
    });

    it("keeps the same static frame scheme in production package generation", () => {
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("静态关键帧写法模板");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("前景必须是具体框景或遮挡物");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("ELS/极远景只能保留远景空间关系");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("制作包内所有提示词模块都必须按字段逐行书写");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("字段之间使用换行");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("seedance-25-director");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("每秒约 5 个可发音字");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("10 个可发音字容差");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("每个镜头至少落实一个环境压力");
    });

    it("keeps named non-appearing characters in the package and out of shot bindings", () => {
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("角色资产表必须保留所有已登记角色");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("不得进入本集参考图请求");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("不得只写含义不清的“无可辨识的角色名”");
    });
});
