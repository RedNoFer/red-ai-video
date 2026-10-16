import { describe, expect, it } from "vitest";

import type { DramaEpisode, DramaProject } from "@/lib/drama-project-contract";
import { collectDramaAgentMentionItems, dramaAgentMentionCandidates, referencedDramaAgentItems, replaceDramaAgentMention } from "./drama-agent-mention";

function fixtures() {
    const episode = { id: "episode-1", shots: [{ id: "shot-1", order: 1, title: "孟婆递汤", description: "递出汤碗" }] } as DramaEpisode;
    const project = {
        id: "project-1",
        title: "忘川",
        summary: "",
        style: "",
        ratio: "16:9",
        status: "active",
        characters: [
            { id: "character-1", name: "赵徽", description: "男主" },
            { id: "character-2", name: "孟婆", description: "引魂者" },
        ],
        scenes: [{ id: "scene-1", name: "忘川河畔", description: "黑水翻涌" }],
        props: [],
        clues: [],
        sourceAssets: [],
        defaultVideoMode: "storyboard",
        episodes: [episode],
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:00.000Z",
    } satisfies DramaProject;
    return { project, episode };
}

describe("Drama Agent project mentions", () => {
    it("uses character names as visible aliases and keeps semantic categories", () => {
        const { project, episode } = fixtures();
        const items = collectDramaAgentMentionItems(project, episode);

        expect(items.filter((item) => item.kind === "character").map((item) => item.alias)).toEqual(["赵徽", "孟婆"]);
        expect(items.map((item) => item.kind)).toEqual(["character", "character", "scene", "shot"]);
        expect(dramaAgentMentionCandidates(items, "赵徽").map((item) => item.id)).toEqual(["character-1"]);
    });

    it("replaces the active query and resolves the referenced stable project id", () => {
        const { project, episode } = fixtures();
        const items = collectDramaAgentMentionItems(project, episode);
        const result = replaceDramaAgentMention("让 @赵", 4, "赵徽");

        expect(result.value).toBe("让 @赵徽 ");
        expect(referencedDramaAgentItems(result.value, items).map((item) => item.id)).toEqual(["character-1"]);
    });

    it("searches source metadata without indexing the full source text", () => {
        const { project, episode } = fixtures();
        const withSource: DramaProject = { ...project, sourceAssets: [{ id: "source-one", type: "text", title: "原稿", textContent: "长篇素材正文" }] };
        const items = collectDramaAgentMentionItems(withSource, episode);

        expect(items.find((item) => item.id === "source-one")?.description).toBe("文本素材");
        expect(dramaAgentMentionCandidates(items, "长篇素材正文")).toEqual([]);
        expect(dramaAgentMentionCandidates(items, "原稿").map((item) => item.id)).toEqual(["source-one"]);
    });
});
