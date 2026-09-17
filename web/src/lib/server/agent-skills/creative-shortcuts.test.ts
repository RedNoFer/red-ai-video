import { describe, expect, it } from "vitest";

import { DRAMA_ASSET_IMAGE_SKILL } from "@/lib/drama-image-skill";
import { DRAMA_PACKAGE_ARCHITECTURE_RULES } from "../drama-production-package-rules";
import {
    CHARACTER_DESIGN_SKILL,
    DRAMA_EXTERNAL_CODEX_DIRECTOR_RULES,
    DRAMA_PACKAGE_DIRECTOR_RULES,
    DRAMA_PLANNING_SKILL,
    DRAMA_STATIC_FRAME_DIRECTOR_RULES,
    DRAMA_VIDEO_DIRECTOR_SKILL,
    DRAMA_VIDEO_PROMPT_DIRECTOR_RULES,
    IMAGE_MOTION_SKILL,
    SEEDANCE_DIRECTOR_SKILL,
    SEEDANCE_25_DIRECTOR_SKILL,
    SEEDANCE_VIDEO_PROMPT_LAYOUT,
    VIDEO_PROMPT_DIRECTOR_DEFAULTS,
} from "./creative-shortcuts";

describe("creative shortcut skills", () => {
    it("loads the shared director layer from the compiled project Skill", () => {
        expect(DRAMA_VIDEO_DIRECTOR_SKILL.id).toBe("drama-video-director");
        expect(DRAMA_VIDEO_DIRECTOR_SKILL.sourceContentHash).toMatch(/^[a-f0-9]{64}$/u);
        expect(DRAMA_PACKAGE_DIRECTOR_RULES).toContain("dramaticFunction");
        expect(DRAMA_PACKAGE_DIRECTOR_RULES).toContain("固定的是字段语义、时间连续性和可验收事实");
        expect(DRAMA_VIDEO_PROMPT_DIRECTOR_RULES).toContain("切后主运镜");
        expect(DRAMA_STATIC_FRAME_DIRECTOR_RULES).toContain("运镜过程");
        expect(DRAMA_VIDEO_PROMPT_DIRECTOR_RULES).toContain("每个真实时间段");
        expect(DRAMA_EXTERNAL_CODEX_DIRECTOR_RULES).toContain("默认执行本 Skill");
    });

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
        expect(DRAMA_ASSET_IMAGE_SKILL.promptRules).toContain("纯白色无缝背景的四视图角色基准板");
        expect(DRAMA_ASSET_IMAGE_SKILL.promptRules).toContain("场景图固定生成一张高清、无人物、无文字的完整单视角全景建立图");
        expect(DRAMA_ASSET_IMAGE_SKILL.refinementRules).toContain("change / preserve / constraints");
    });

    it("uses the integrated asset prompt layer in the package director", () => {
        expect(DRAMA_PACKAGE_DIRECTOR_RULES).toContain("角色事实固定整理为六项");
        expect(DRAMA_PACKAGE_DIRECTOR_RULES).toContain("资产基准图与镜头提示词承担不同职责");
    });

    it("keeps one optional static-frame contract", () => {
        expect(DRAMA_STATIC_FRAME_DIRECTOR_RULES).toContain("五类短段");
        expect(DRAMA_STATIC_FRAME_DIRECTOR_RULES).toContain("不强制九段");
        expect(DRAMA_STATIC_FRAME_DIRECTOR_RULES).not.toContain("参考图职责：");
    });

    it("injects adaptive frame allocation once through the canonical director layer", () => {
        expect(DRAMA_PACKAGE_DIRECTOR_RULES.match(/没有普通镜头的默认帧数/gu)).toHaveLength(1);
        expect(DRAMA_PLANNING_SKILL.instructions).not.toContain("没有普通镜头的默认帧数");
    });

    it("keeps the shared video prompt layout", () => {
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("【重要剪辑指令】");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("【逐镜头时间线】");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("镜头1");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("起点、动作与触发、可见衔接和终点");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("机器字段只是职责映射");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("公开 videoPrompt 只使用本布局字段");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).not.toContain("阶段节拍：只有多事件");
        expect(SEEDANCE_VIDEO_PROMPT_LAYOUT).toContain("每个非空字段必须独立一行");
    });

    it("defaults standalone video optimization to a director-quality pass", () => {
        expect(VIDEO_PROMPT_DIRECTOR_DEFAULTS).toContain("不要只做同义改写");
        expect(VIDEO_PROMPT_DIRECTOR_DEFAULTS).toContain("对白、多个动作节点、人物反应或信息转折");
        expect(VIDEO_PROMPT_DIRECTOR_DEFAULTS).toContain("镜头模式：内部切镜（N次）");
        expect(VIDEO_PROMPT_DIRECTOR_DEFAULTS).toContain("切后主运镜");
        expect(VIDEO_PROMPT_DIRECTOR_DEFAULTS).toContain("起点 → 动作与触发 → 可见衔接 → 终点");
        expect(VIDEO_PROMPT_DIRECTOR_DEFAULTS).toContain("支撑/接触/受力");
    });

    it("keeps the production package on the same static source", () => {
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("imagePrompt");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("referenceManifest");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).not.toContain("静态关键帧写法模板");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).not.toContain("五类");
    });

    it("keeps named non-appearing characters in the package and out of shot bindings", () => {
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("背景 NPC");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("不进入 characterCodes");
    });
});
