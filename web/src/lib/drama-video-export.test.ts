import { describe, expect, it } from "vitest";

import { dramaVideoExportEntryKey, dramaVideoExportKeys, dramaVideoExportSelection, type DramaVideoExportPayload } from "./drama-video-export";

describe("Drama video export selection", () => {
    it("keys every video by episode, shot and video id", () => {
        const payload = videoPayload();

        expect(dramaVideoExportKeys(payload)).toEqual([`["episode-one","shot-one","current"]`, `["episode-one","shot-one","candidate"]`, `["episode-two","shot-two","current"]`]);
        expect(dramaVideoExportEntryKey("episode-one", "shot-one", "current")).toBe('["episode-one","shot-one","current"]');
    });

    it("only turns selected videos into export items", () => {
        const payload = videoPayload();

        expect(dramaVideoExportSelection(payload, ['["episode-one","shot-one","candidate"]'])).toEqual([{ episodeId: "episode-one", shotId: "shot-one", videoId: "candidate" }]);
        expect(dramaVideoExportSelection(payload, ['["episode-one","shot-one","unknown"]'])).toEqual([]);
        expect(dramaVideoExportSelection(payload, dramaVideoExportKeys(payload))).toHaveLength(3);
    });
});

function videoPayload(): DramaVideoExportPayload {
    return {
        projectId: "project-one",
        projectTitle: "测试短剧",
        episodes: [
            {
                episodeId: "episode-one",
                order: 1,
                title: "第 1 集",
                shots: [
                    {
                        shotId: "shot-one",
                        code: "SH01",
                        title: "开场",
                        videos: [
                            { id: "current", url: "/api/media/current.mp4", isCurrent: true },
                            { id: "candidate", url: "/api/media/candidate.mp4", isCurrent: false },
                        ],
                    },
                ],
            },
            {
                episodeId: "episode-two",
                order: 2,
                title: "第 2 集",
                shots: [{ shotId: "shot-two", code: "SH02", title: "收尾", videos: [{ id: "current", url: "/api/media/second.mp4", isCurrent: true }] }],
            },
        ],
    };
}
