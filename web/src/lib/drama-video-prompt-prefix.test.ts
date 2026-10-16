import { describe, expect, it } from "vitest";
import type { DramaProject, DramaShot } from "@/lib/drama-project-contract";
import { compileDramaVideoSubmissionPrompt } from "@/lib/drama-video-submission";
import { DEFAULT_DRAMA_VIDEO_PROMPT_PREFIX, stripDramaVideoPromptPrefix, withDramaVideoPromptPrefix } from "./drama-video-prompt-prefix";

const project = { characters: [], scenes: [], props: [], clues: [], videoPromptPrefix: { text: DEFAULT_DRAMA_VIDEO_PROMPT_PREFIX } } as unknown as DramaProject;
const shot = { characterIds: [], propIds: [], clueIds: [] } as unknown as DramaShot;

describe("project-wide video prompt prefix", () => {
    it("keeps the complete editable declaration first, exactly once, before image bindings", () => {
        const body = "0–15秒：铁盒保持打开。\n音效：室内底噪。";
        const bindings = [{ alias: "@图片1", role: "prop_anchor" as const, purpose: "道具「铁盒」", sourceId: "box", url: "/box.png" }];
        const prompt = compileDramaVideoSubmissionPrompt(body, project, shot, bindings, ["box"]);
        expect(prompt.startsWith(`${DEFAULT_DRAMA_VIDEO_PROMPT_PREFIX}\n\n参考图片：`)).toBe(true);
        expect(prompt).toContain("@图片1：道具「铁盒」");
        expect(compileDramaVideoSubmissionPrompt(prompt, project, shot, bindings, ["box"])).toBe(prompt);
        expect(stripDramaVideoPromptPrefix(prompt, project)).not.toContain("声明：");
        const empty = compileDramaVideoSubmissionPrompt(prompt, project, shot, [], []);
        expect(empty.startsWith(DEFAULT_DRAMA_VIDEO_PROMPT_PREFIX)).toBe(true);
        expect(empty).not.toContain("@图片");
        expect(empty).toContain(body);
    });

    it("replaces and removes a prefix without changing independently saved shot bodies", () => {
        const bodies = ["第一集原稿", "第二集原稿"];
        const updated = { videoPromptPrefix: { text: "修改后的声明" } };
        for (const body of bodies) {
            const old = withDramaVideoPromptPrefix(body, project);
            const saved = stripDramaVideoPromptPrefix(old, project);
            expect(saved).toBe(body);
            expect(withDramaVideoPromptPrefix(saved, updated)).toBe(`修改后的声明\n\n${body}`);
            expect(withDramaVideoPromptPrefix(saved, {})).toBe(body);
        }
    });
});
