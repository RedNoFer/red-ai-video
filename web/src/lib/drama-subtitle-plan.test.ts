import { describe, expect, it } from "vitest";

import type { DramaShot } from "@/lib/drama-project-contract";
import { buildDramaAss, buildDramaSrt, dramaShotHasSubtitleText, dramaShotSubtitleSources, dramaSubtitleLayout, planDramaShotSubtitles } from "./drama-subtitle-plan";

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

    it("reads English dialogue with 中译 lines from the episode script when shot fields are empty", () => {
        const shot = dramaShot({ code: "SH01" });
        const script = bilingualScript();

        const sources = dramaShotSubtitleSources(shot, script);

        expect(sources).toHaveLength(3);
        expect(sources[0]).toMatchObject({ text: "By morning, everything would be ten million times cheaper.", translation: "到了明早，一切都将便宜一千万倍。", hasEnglish: true });
        expect(sources[1].text).toContain("You must be Lawson");
        expect(sources[2]).toMatchObject({ text: "He's my way out.", hasEnglish: true });
    });

    it("keeps English and Chinese on the same subtitle cue for the bilingual version", () => {
        const shot = dramaShot({ code: "SH01" });

        const cues = planDramaShotSubtitles(shot, 20_000, 1080, 1920, { script: bilingualScript(), mode: "bilingual" });

        expect(cues).toHaveLength(3);
        expect(cues[0]).toMatchObject({ text: "By morning, everything would be ten million times cheaper.", secondaryText: "到了明早，一切都将便宜一千万倍。" });
        expect(cues[0].endMs).toBeGreaterThan(cues[0].startMs);
    });

    it("only emits English text for the English-only version", () => {
        const shot = dramaShot({ code: "SH01" });

        const cues = planDramaShotSubtitles(shot, 20_000, 1080, 1920, { script: bilingualScript(), mode: "english" });

        expect(cues).toHaveLength(3);
        expect(cues.every((cue) => cue.secondaryText === undefined)).toBe(true);
        expect(cues.every((cue) => !/[\u4e00-\u9fff]/u.test(cue.text))).toBe(true);
    });

    it("uses the script translation for a matching saved Chinese shot line", () => {
        const shot = dramaShot({ code: "SH01", dialogue: "到了明早，一切都将便宜一千万倍。" });

        const sources = dramaShotSubtitleSources(shot, bilingualScript());

        expect(sources).toHaveLength(1);
        expect(sources[0]).toMatchObject({ text: "By morning, everything would be ten million times cheaper.", translation: "到了明早，一切都将便宜一千万倍。", hasEnglish: true });
    });

    it("keeps edited shot text ahead of a nonmatching script block", () => {
        const shot = dramaShot({ code: "SH01", dialogue: "这是我手动改过的台词。" });

        expect(dramaShotSubtitleSources(shot, bilingualScript()).map((source) => source.text)).toEqual(["这是我手动改过的台词。"]);
    });

    it("returns no cues when the shot has no subtitle text", () => {
        expect(planDramaShotSubtitles(dramaShot({}), 5_000, 1080, 1920)).toEqual([]);
        expect(dramaShotHasSubtitleText(dramaShot({}))).toBe(false);
    });

    it("uses a readable subtitle size for both horizontal and vertical frames", () => {
        expect(dramaSubtitleLayout(1920, 1080).fontSize).toBe(54);
        expect(dramaSubtitleLayout(1080, 1920).fontSize).toBe(54);
        expect(dramaSubtitleLayout(3840, 2160).fontSize).toBe(96);
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

    it("puts the English primary line before the Chinese secondary line in SRT and ASS", () => {
        const cues = [{ startMs: 0, endMs: 2_000, text: "By morning, everything would be cheaper.", secondaryText: "到了明早，一切都将便宜一千万倍。" }];
        const srt = buildDramaSrt(cues);
        const ass = buildDramaAss(cues, 1080, 1920);

        expect(srt).toContain("By morning, everything would be cheaper.\n到了明早，一切都将便宜一千万倍。");
        expect(ass).toContain("By morning, everything would be\\Ncheaper.");
        expect(ass).toMatch(/\\N到了明早，一切都将便宜一千万倍/u);
    });
});

function bilingualScript() {
    return [
        "【SH01｜0–30秒｜撞见亲吻】",
        "",
        "△ 黄昏的洛杉矶市中心。",
        "LUKE（心声）",
        '"By morning, everything would be ten million times cheaper."',
        "中译：到了明早，一切都将便宜一千万倍。",
        "",
        "PRESTON",
        '"You must be Lawson. Thanks for taking care of her."',
        "中译：你一定是Lawson。谢谢你把Chloe照顾得这么好。",
        "",
        "*He's my way out.*",
        "中译：他是我摆脱那桩婚事的出路。",
        "",
        "【SH02｜30–60秒｜另一场】",
        "",
        '"This belongs to the next shot."',
        "中译：这是下一镜的台词。",
    ].join("\n");
}

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
