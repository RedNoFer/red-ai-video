import { describe, expect, it } from "vitest";

import { DRAMA_PACKAGE_ARCHITECTURE_RULES } from "../drama-production-package-rules";
import { CHARACTER_DESIGN_SKILL, DRAMA_PLANNING_SKILL, IMAGE_MOTION_SKILL, SEEDANCE_DIRECTOR_SKILL } from "./creative-shortcuts";

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

    it("keeps Seedance reference roles and continuity boundaries", () => {
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("每张参考图的唯一用途");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("已人工验收的实际尾帧");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("每次返修只改变一个已定位变量");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("角色名是正式业务事实");
        expect(SEEDANCE_DIRECTOR_SKILL.instructions).toContain("本集/本镜不出镜");
    });

    it("keeps named non-appearing characters in the package and out of shot bindings", () => {
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("角色资产表必须保留所有已登记角色");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("不得进入本集参考图请求");
        expect(DRAMA_PACKAGE_ARCHITECTURE_RULES).toContain("不得只写含义不清的“无可辨识的角色名”");
    });
});
