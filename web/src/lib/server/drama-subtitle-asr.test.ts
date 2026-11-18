import { describe, expect, it } from "vitest";

import { planDramaSubtitleSources } from "@/lib/drama-subtitle-plan";

import { buildDramaSubtitleChunks, buildDramaSubtitleSources, parseDramaSilenceIntervals, parseDramaSubtitleTranslations, parseDramaWhisperTranscript, refineDramaTranscriptSegments, type DramaSubtitleSpeechInterval } from "./drama-subtitle-asr";

describe("Drama subtitle ASR", () => {
    it("parses silence detection into real speech intervals", () => {
        const stderr = [
            "[silencedetect @ 0x1] silence_start: 0",
            "[silencedetect @ 0x1] silence_end: 2.538095 | silence_duration: 2.538095",
            "[silencedetect @ 0x1] silence_start: 5.750862",
            "[silencedetect @ 0x1] silence_end: 6.085442 | silence_duration: 0.33458",
        ].join("\n");

        expect(parseDramaSilenceIntervals(stderr, 10_000)).toEqual([
            { startMs: 2_538, endMs: 5_751 },
            { startMs: 6_085, endMs: 10_000 },
        ]);
        expect(parseDramaSilenceIntervals("", 10_000)).toEqual([{ startMs: 0, endMs: 10_000 }]);
    });

    it("reads Whisper token boundaries and drops special tokens", () => {
        const segments = parseDramaWhisperTranscript(
            {
                transcription: [
                    {
                        offsets: { from: 0, to: 7_460 },
                        text: " That's the black gold card.",
                        tokens: [
                            { offsets: { from: 0, to: 0 }, text: "[_BEG_]" },
                            { offsets: { from: 2_538, to: 3_600 }, text: " That" },
                            { offsets: { from: 3_600, to: 4_600 }, text: " gold" },
                            { offsets: { from: 4_600, to: 5_750 }, text: " card." },
                            { offsets: { from: 5_750, to: 5_750 }, text: "[_TT_543]" },
                        ],
                    },
                ],
            },
            30_000,
        );

        expect(segments).toEqual([{ startMs: 2_538, endMs: 5_750, text: "That's the black gold card." }]);
    });

    it("snaps ASR segments to speech and removes silence-only hallucinations", () => {
        const speech: DramaSubtitleSpeechInterval[] = [
            { startMs: 2_538, endMs: 5_750 },
            { startMs: 6_085, endMs: 6_465 },
            { startMs: 7_162, endMs: 8_457 },
            { startMs: 9_877, endMs: 10_993 },
            { startMs: 12_636, endMs: 12_822 },
            { startMs: 13_476, endMs: 14_136 },
        ];
        const refined = refineDramaTranscriptSegments(
            [
                { startMs: 0, endMs: 9_880, text: "That's the black gold card." },
                { startMs: 9_880, endMs: 12_780, text: "Grandpa said it was real." },
                { startMs: 11_000, endMs: 12_000, text: "Thank you." },
                { startMs: 12_780, endMs: 13_780, text: "What?" },
            ],
            speech,
        );

        expect(refined.map((segment) => segment.text)).toEqual(["That's the black gold card.", "Grandpa said it was real.", "What?"]);
        expect(refined[0]).toMatchObject({ startMs: 2_538, endMs: 9_880 });
        expect(refined[1].endMs).toBe(12_780);
        expect(refined[1].startMs).toBeGreaterThanOrEqual(9_880);
        expect(refined[2].startMs).toBeGreaterThanOrEqual(12_780);
    });

    it("splits actual speech into readable cue windows and keeps bilingual text aligned", () => {
        const chunks = buildDramaSubtitleChunks([{ startMs: 0, endMs: 8_000, text: "This is the first line of dialogue. This is a much longer second line that must be split before it is shown on screen." }], 1080, 1920);

        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks[0].startMs).toBe(0);
        expect(chunks[chunks.length - 1].endMs).toBe(8_000);
        for (let index = 1; index < chunks.length; index += 1) expect(chunks[index].startMs).toBeGreaterThanOrEqual(chunks[index - 1].endMs);

        const sources = buildDramaSubtitleSources(
            chunks,
            chunks.map((_, index) => `中文字幕第 ${index + 1} 句。`),
        );
        const cues = planDramaSubtitleSources(sources, 8_000, 1080, 1920, "bilingual");
        expect(cues).toHaveLength(chunks.length);
        expect(cues[0]).toMatchObject({ text: chunks[0].text, secondaryText: "中文字幕第 1 句。" });
        const english = planDramaSubtitleSources(sources, 8_000, 1080, 1920, "english");
        expect(english.every((cue) => cue.secondaryText === undefined)).toBe(true);
    });

    it("validates translated lines by exact count and content", () => {
        expect(parseDramaSubtitleTranslations(JSON.stringify({ translations: ["那是黑金龙卡。", "爷爷说它是真的。"] }), 2)).toEqual(["那是黑金龙卡。", "爷爷说它是真的。"]);
        expect(parseDramaSubtitleTranslations(JSON.stringify({ translations: ["只有一句。"] }), 2)).toBeUndefined();
        expect(parseDramaSubtitleTranslations(JSON.stringify({ translations: ["", "空行。"] }), 2)).toBeUndefined();
        expect(parseDramaSubtitleTranslations("not json", 1)).toBeUndefined();
    });
});
