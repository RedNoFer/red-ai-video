import { describe, expect, it } from "vitest";

import { validateDramaContinuityEdges } from "./drama-continuity-policy";

const state = (assetId: string, position: string, action: string) => ({ assetId, position, gaze: "看向对手", pose: "站立并以地面支撑", action });

function episode(nextPosition: string, previousAction = "萧炎压住桌沿") {
    return {
        code: "E01",
        title: "第一集",
        script: "",
        outline: "",
        hook: "",
        nextPreview: "",
        sourceRange: "",
        storyScenes: [],
        shots: [
            {
                code: "SH01",
                duration: 30,
                entryState: { characters: [state("C01", "长案右侧", "萧炎低头")], props: [], environment: "大厅", axis: "长案轴线", screenDirection: "右向" },
                exitState: { characters: [state("C01", "长案右侧", previousAction)], props: [], environment: "大厅", axis: "长案轴线", screenDirection: "右向" },
                continuity: { characterBlocking: "长案右侧", continuityNotes: "站位锁定" },
                framePlan: { frames: [{ startSecond: 0, endSecond: 30, actionPrompt: previousAction, transitionPrompt: "声音连续", endPrompt: "萧炎停在长案右侧", imagePrompt: "长案右侧" }] },
            },
            {
                code: "SH02",
                duration: 30,
                entryState: { characters: [state("C01", nextPosition, "萧炎抬眼")], props: [], environment: "大厅", axis: "长案轴线", screenDirection: "右向" },
                exitState: { characters: [state("C01", nextPosition, "萧炎停住")], props: [], environment: "大厅", axis: "长案轴线", screenDirection: "右向" },
                continuity: { characterBlocking: nextPosition, continuityNotes: "站位锁定" },
                framePlan: { frames: [{ startSecond: 0, endSecond: 30, actionPrompt: `承接出口，萧炎在${nextPosition}抬眼`, transitionPrompt: "呼吸和衣料声连续", endPrompt: `萧炎停在${nextPosition}`, imagePrompt: nextPosition }] },
            },
        ],
        continuityEdges: [{ fromShotCode: "SH01", toShotCode: "SH02", transition: "hard_cut", inheritActualEndFrame: false, carryCharacterIds: ["C01"], carryPropIds: [], carryEnvironment: true, carryAxis: true }],
    } as never;
}

describe("drama continuity policy", () => {
    it("blocks a hard cut that silently moves a carried character", () => {
        const issues = validateDramaContinuityEdges([episode("门侧")]);
        expect(issues.join("；")).toContain("移动路径");
    });

    it("allows an independent hard-cut clip when the spatial state is repeated", () => {
        expect(validateDramaContinuityEdges([episode("长案右侧")])).toEqual([]);
    });

    it("allows a changed position only when movement is authored as a visible cause", () => {
        expect(validateDramaContinuityEdges([episode("门侧", "萧炎起身，沿长案外侧走向门侧")])).toEqual([]);
    });
});
