import { describe, expect, it } from "vitest";

import { validateDramaCharacterWardrobeContinuity, validateDramaCutInformationDiversity, validateDramaPromptComposition, validateDramaReferenceAliasConsistency } from "./drama-prompt-composition-quality";

describe("drama prompt composition and cut quality gates", () => {
    it("blocks horizontal multi-person packing in a 9:16 close shot", () => {
        const errors = validateDramaPromptComposition({
            ratio: "9:16",
            prompt: "9:16竖屏，三人横向并排，角色甲、角色乙、角色丙全部挤在中近景，前景肩膀遮住脸部。",
            subjectNames: ["角色甲", "角色乙", "角色丙"],
            frames: [{ actionPrompt: "三人横向并排进入画面，近景，前景肩膀遮住脸部", imagePrompt: "角色甲、角色乙、角色丙三人横向并排" }],
        });

        expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("横向并排"), expect.stringContaining("遮脸")]));
    });

    it("allows a 16:9 three-person establishing composition when hierarchy is explicit", () => {
        const errors = validateDramaPromptComposition({
            ratio: "16:9",
            prompt: "16:9横版建立全景，角色甲、角色乙、角色丙处于长桌关系中，画面中央主体层级清楚，人物五官和手部清晰可辨。",
            subjectNames: ["角色甲", "角色乙", "角色丙"],
            frames: [{ actionPrompt: "三人长桌群像保持空间关系", imagePrompt: "画面中央主体层级清楚" }],
        });

        expect(errors).toEqual([]);
    });

    it("blocks seven cuts that all keep the same character as the information target", () => {
        const prompt = Array.from({ length: 7 }, (_, index) => `镜头事件：${index + 1}秒；新机位：角色甲侧面近景；信息目的：角色甲表情和视线。`).join("\n");
        const errors = validateDramaCutInformationDiversity({
            ratio: "9:16",
            prompt,
            frames: [],
            subjectNames: ["角色甲", "角色乙", "角色丙"],
            requiredReactionNames: ["角色乙", "角色丙"],
        });

        expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("同一信息主体"), expect.stringContaining("角色乙"), expect.stringContaining("角色丙")]));
    });

    it("blocks a prompt whose alias order differs from the manifest", () => {
        const errors = validateDramaReferenceAliasConsistency({
            prompt: "【素材绑定】\n@图片2：角色甲锚点\n@图片1：大厅场景锚点\n【故事意图】建立对峙",
            manifest: [
                { alias: "@图片1", role: "scene_anchor", purpose: "大厅" },
                { alias: "@图片2", role: "character_anchor", purpose: "角色甲" },
            ],
        });

        expect(errors.join("；")).toContain("alias 顺序与 referenceManifest 不一致");
    });

    it("blocks a character shot that drops the registered wardrobe and accessory anchors", () => {
        const errors = validateDramaCharacterWardrobeContinuity({
            prompt: "角色甲抬眼看向角色乙，眉心收紧。",
            characters: [{ id: "C01", name: "角色甲", profile: { styling: "深色长袍、束发、固定耳饰" } }],
            characterCodes: ["C01"],
        });

        expect(errors.join("；")).toContain("服装、发型、年龄感或固定配饰连续性锚点");
    });
});
