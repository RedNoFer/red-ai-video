import { describe, expect, it } from "vitest";

import type { DramaShot } from "@/lib/drama-project-contract";
import { buildDramaAss, buildDramaSrt, dramaShotHasSubtitleText, dramaShotSubtitleSources, planDramaShotSubtitles } from "./drama-subtitle-plan";

describe("Drama subtitle planning", () => {
    it("prefers structured utterances and keeps their measured local windows", () => {
        const shot = dramaShot({
            utterances: [
                { id: "u1", order: 1, type: "dialogue", speaker: "林雪", text: "先说第一句。", startSecond: 0.5, endSecond: 2.5 },
                { id: "u2", order: 2, type: "voiceover", speaker: "旁白", text: "再说第二句。", startSecond: 3, endSecond: 5 },
            ],
        });

        const cues = planDramaShotSubtitles(shot, 6_000, 1080, 1920);

        expect(cues).toHaveLength(2);
        expect(cues[0].startMs).toBeGreaterThanOrEqual(500);
        expect(cues[0].endMs).toBeLessThanOrEqual(2_500);
        expect(cues[1].startMs).toBeGreaterThanOrEqual(3_000);
        expect(cues[1].endMs).toBeLessThanOrEqual(5_000);
        expect(cues[0].endMs).toBeLessThanOrEqual(cues[1].startMs);
    });

    it("falls back to dialogue and narration when no structured utterances exist", () => {
        const shot = dramaShot({ dialogue: "林雪：你终于来了。", narration: "门外的风停了。" });

        expect(dramaShotHasSubtitleText(shot)).toBe(true);
        expect(dramaShotSubtitleSources(shot).map((source) => source.text)).toEqual(["林雪：你终于来了。", "门外的风停了。"]);
        expect(planDramaShotSubtitles(shot, 5_000, 1080, 1920).map((cue) => cue.text)).toEqual(["林雪：你终于来了。", "门外的风停了。"]);
    });

    it("splits long text into readable chunks without exceeding the cue budget", () => {
        const shot = dramaShot({ dialogue: "这是一段很长的对白，用来确认字幕会按标点和长度拆开，不会把整段文字压进一条字幕里，也不会让两条字幕重叠。" });

        const cues = planDramaShotSubtitles(shot, 8_000, 1080, 1920);

        expect(cues.length).toBeGreaterThan(1);
        for (const cue of cues) {
            expect(cue.text.length).toBeLessThanOrEqual(30);
            expect(cue.endMs).toBeGreaterThan(cue.startMs);
        }
        for (let index = 1; index < cues.length; index += 1) {
            expect(cues[index].startMs).toBeGreaterThanOrEqual(cues[index - 1].endMs);
        }
    });

    it("returns no cues when the shot has no subtitle text", () => {
        expect(planDramaShotSubtitles(dramaShot({}), 5_000, 1080, 1920)).toEqual([]);
        expect(dramaShotHasSubtitleText(dramaShot({}))).toBe(false);
    });

    it("builds ASS with bottom alignment, safe margins and escaped text", () => {
        const ass = buildDramaAss(
            [
                { startMs: 0, endMs: 2_000, text: "你 {别} 走\\N" },
                { startMs: 2_200, endMs: 4_000, text: "这是一条会换行的长字幕，用来确认字号和每行字数按画面高度计算。" },
            ],
            1080,
            1920,
        );

        expect(ass).toContain("PlayResX: 1080");
        expect(ass).toContain("PlayResY: 1920");
        expect(ass).toContain("Style: Default,Noto Sans CJK SC");
        expect(ass).toContain("{\\an2}");
        expect(ass).toContain("｛别｝");
        expect(ass).toContain("\\N");
        expect(ass).not.toContain("{别}");
        expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:02.00");
    });

    it("builds SRT with monotonic timestamps", () => {
        const srt = buildDramaSrt([
            { startMs: 0, endMs: 2_000, text: "第一句" },
            { startMs: 2_200, endMs: 4_000, text: "第二句" },
        ]);

        expect(srt).toContain("1\n00:00:00,000 --> 00:00:02,000\n第一句");
        expect(srt).toContain("2\n00:00:02,200 --> 00:00:04,000\n第二句");
    });
});

function dramaShot(input: Partial<DramaShot>): DramaShot {
    return {
        id: "shot-one",
        order: 1,
        title: "开场",
        description: "",
        sourceText: "",
        shotBoundary: "",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: "",
        videoPrompt: "",
        cameraMotion: "",
        duration: 5,
        characterIds: [],
        propIds: [],
        clueIds: [],
        ...input,
    };
}
