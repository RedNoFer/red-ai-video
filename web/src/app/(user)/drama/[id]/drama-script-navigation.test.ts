import { describe, expect, it } from "vitest";

import { findDramaSceneHeadingRange, findDramaScriptTextRange, resolveDramaShotAnchor } from "./drama-script-navigation";

describe("drama script navigation", () => {
    it("uses the first candidate that exists in the script", () => {
        expect(findDramaScriptTextRange("开场\n银色裂痕出现在门上。\n结束", ["不存在的完整原文", "银色裂痕"])).toEqual({ from: 3, to: 7 });
    });

    it("matches source text when editor whitespace differs", () => {
        expect(findDramaScriptTextRange("Karin停下。\n\nRifa抬头。", ["Karin停下。 Rifa抬头。"])).toEqual({ from: 0, to: 17 });
    });

    it("does not send an unmatched shot to the start of the script", () => {
        expect(findDramaScriptTextRange("现有剧本", ["未出现在剧本中的镜头"])).toBeUndefined();
    });

    it("finds the scene heading before falling back to the shot body", () => {
        expect(findDramaSceneHeadingRange("### 场1｜黑湖记忆｜时间不明｜0-15秒\n正文", { order: 1, title: "黑湖记忆", timeOfDay: "时间不明", timeRange: "0-15秒" })).toEqual({ from: 0, to: 22 });
        expect(resolveDramaShotAnchor("### 场1｜黑湖记忆｜时间不明｜0-15秒\n正文", { code: "SH01", order: 1, title: "黑湖记忆 1/2", description: "黑湖记忆", sourceText: "" }, { order: 1, title: "黑湖记忆", timeOfDay: "时间不明", timeRange: "0-15秒" }).kind).toBe("shot");
    });
});
