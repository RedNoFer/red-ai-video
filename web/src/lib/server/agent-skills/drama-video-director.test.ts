import { describe, expect, it } from "vitest";

import type { DramaShot } from "@/lib/drama-project-contract";
import { auditDramaShotDirectorQuality, resolveDramaDirectorInstructions } from "./drama-video-director";

describe("drama video director adapter", () => {
    it("keeps static frame rules separate from video process rules", () => {
        const staticRules = resolveDramaDirectorInstructions("static-frame");
        const videoRules = resolveDramaDirectorInstructions("video");

        expect(staticRules).toContain("静态帧只冻结一个已经发生的瞬间");
        expect(staticRules).toContain("不得写运镜过程");
        expect(videoRules).toContain("每个真实时间段逐块写出起点、动作与触发、可见衔接和终点");
        expect(videoRules).not.toContain("只冻结一个已经发生的瞬间");
    });

    it("returns advisory cinematography issues without creating blocking errors", () => {
        const shot = {
            imagePrompt: "人物站在门前",
            videoPrompt: "人物紧张地看向门缝，电影感",
            cameraMotion: "推镜后摇镜",
            duration: 5,
        } as unknown as DramaShot;

        const issues = auditDramaShotDirectorQuality(shot);

        expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["DIRECTOR_CAMERA", "DIRECTOR_LIGHT_SOURCE", "DIRECTOR_DEPTH", "DIRECTOR_RESULT", "DIRECTOR_CINEMA_SLOP"]));
        expect(issues.every((issue) => issue.code.startsWith("DIRECTOR_"))).toBe(true);
    });

    it("accepts a concrete camera, light, depth and result design", () => {
        const shot = {
            imagePrompt: "前景是门框，中景人物握住断剑，背景是湿地城门，左上窗光形成冷色轮廓",
            videoPrompt: "人物从门边抬眼，镜头沿左到右缓慢推进，最后断剑挡住门缝",
            cameraMotion: "沿动作轴线缓慢推进",
            lens: "50mm",
            dramaticFunction: "从警觉推进到确认威胁",
            continuity: {
                shotSize: "中景",
                cameraAngle: "平视",
                composition: "门框作为前景，人物位于左侧三分之一",
                characterBlocking: "人物站在门内侧，右手握剑",
                gazeDirection: "看向门缝",
                actionStart: "手握剑柄",
                actionEnd: "剑身挡住门缝",
                screenDirection: "左到右",
                axisRule: "180度轴线内",
                continuityNotes: "沿用上一镜冷光",
            },
            lightingPlan: { keyLight: "来自左上方的窗光", palette: "冷灰蓝" },
            exitState: { characters: [], props: [], environment: "城门", lighting: "左上窗光" },
        } as unknown as DramaShot;

        expect(auditDramaShotDirectorQuality(shot)).toEqual([]);
    });

    it("counts distinct camera motion types instead of repeated prompt wording", () => {
        const shot = {
            imagePrompt: "前景门框，中景人物，背景是城门纵深，左上窗光照亮人物",
            videoPrompt: "单一主运镜：中轴缓慢推进\n起始状态：人物站定\n结束画面：人物停住",
            cameraMotion: "中轴缓慢推进",
            lens: "50mm",
            dramaticFunction: "把人物的视线压力推向门外",
            continuity: {
                shotSize: "中景",
                cameraAngle: "平视",
                composition: "前景门框，中景人物，背景城门",
                characterBlocking: "人物站在门内侧",
                gazeDirection: "看向门缝",
                actionStart: "人物站定",
                actionEnd: "人物停住",
            },
            lightingPlan: { keyLight: "来自左上方的窗光", palette: "冷灰蓝" },
        } as unknown as DramaShot;

        expect(auditDramaShotDirectorQuality(shot).map((issue) => issue.code)).not.toContain("DIRECTOR_MULTI_MOTION");
        expect(auditDramaShotDirectorQuality({ ...shot, cameraMotion: "先推镜再横摇" })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "DIRECTOR_MULTI_MOTION" })]));
    });
});
