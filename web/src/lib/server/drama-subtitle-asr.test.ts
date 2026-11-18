import { describe, expect, it } from "vitest";

import { planDramaSubtitleSources } from "@/lib/drama-subtitle-plan";

import {
    alignDramaSubtitleSources,
    buildDramaSubtitleChunks,
    buildDramaSubtitleSources,
    parseDramaSilenceIntervals,
    parseDramaSubtitleTranslations,
    parseDramaWhisperTranscript,
    refineDramaTranscriptSegments,
    type DramaSubtitleSpeechInterval,
} from "./drama-subtitle-asr";

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

    it("merges split ASR segments back into the script line and reuses the script translation", () => {
        const scriptSources = [
            { text: "The black-gold card? Grandpa said it was real.", translation: "黑金龙卡？爷爷说它真的存在。", hasEnglish: true },
            { text: "What? Something wrong?", translation: "什么？出什么事了？", hasEnglish: true },
        ];
        const segments = [
            { startMs: 0, endMs: 9_900, text: "That's the black gold card." },
            { startMs: 9_900, endMs: 12_780, text: "Grandpa said it was real." },
            { startMs: 12_780, endMs: 13_780, text: "What?" },
            { startMs: 13_780, endMs: 16_020, text: "Is something wrong?" },
        ];

        const aligned = alignDramaSubtitleSources(segments, scriptSources);

        expect(aligned).toHaveLength(2);
        expect(aligned[0]).toMatchObject({ text: scriptSources[0].text, translation: scriptSources[0].translation, startMs: 0, endMs: 12_780 });
        expect(aligned[1]).toMatchObject({ text: scriptSources[1].text, translation: scriptSources[1].translation, startMs: 12_780, endMs: 16_020 });
    });

    it("keeps unrecognized speech as ASR text and never reuses one script line", () => {
        const scriptSources = [{ text: "What? Something wrong?", translation: "什么？出什么事了？", hasEnglish: true }];
        const segments = [
            { startMs: 0, endMs: 1_000, text: "What? Something wrong?" },
            { startMs: 1_000, endMs: 2_000, text: "What? Something wrong?" },
            { startMs: 2_000, endMs: 3_000, text: "Thank you very much." },
        ];

        const aligned = alignDramaSubtitleSources(segments, scriptSources);

        expect(aligned[0]).toMatchObject({ text: scriptSources[0].text, translation: scriptSources[0].translation });
        expect(aligned[1]).toMatchObject({ text: "What? Something wrong?", startMs: 1_000, endMs: 2_000 });
        expect(aligned[1].translation).toBeUndefined();
        expect(aligned[2]).toMatchObject({ text: "Thank you very much.", startMs: 2_000, endMs: 3_000 });
    });

    it("aligns a real split transcript to the script and only leaves unmatched lines for translation", () => {
        const scriptSources = [
            { text: "The black-gold card? Grandpa said it was real.", translation: "黑金龙卡？爷爷说它真的存在。", hasEnglish: true },
            { text: "What? Something wrong?", translation: "什么？出什么事了？", hasEnglish: true },
            { text: "You don't know what that is.", translation: "你不知道那是什么。", hasEnglish: true },
            { text: "A card. The bank gave it to me.", translation: "一张卡。银行给我的。", hasEnglish: true },
            { text: "The bank gave it to you.", translation: "银行给你的。", hasEnglish: true },
            { text: "She's seen a ghost. Over my card.", translation: "她像见了鬼。就为了我那张卡。", hasEnglish: true },
            { text: "I'm Serena. Private banking, Meridian. I saw your ten at the breakfast shop.", translation: "我是Serena，Meridian私人银行。我在早餐店看见你那张十美元。", hasEnglish: true },
        ];
        const segments = [
            { startMs: 0, endMs: 9_900, text: "That's the black gold card." },
            { startMs: 9_900, endMs: 12_780, text: "Grandpa said it was real." },
            { startMs: 12_780, endMs: 13_780, text: "What?" },
            { startMs: 13_780, endMs: 16_020, text: "Is something wrong?" },
            { startMs: 16_020, endMs: 17_860, text: "You don't know what that is?" },
            { startMs: 17_860, endMs: 18_860, text: "A card." },
            { startMs: 18_860, endMs: 21_060, text: "The bank gave it to me." },
            { startMs: 21_060, endMs: 25_460, text: "The bank gave it to you." },
            { startMs: 25_460, endMs: 28_100, text: "I'm Serena Meridian's branch president." },
            { startMs: 28_100, endMs: 30_000, text: "I saw your $10 bill at breakfast." },
        ];

        const aligned = alignDramaSubtitleSources(segments, scriptSources);

        expect(aligned.map((source) => source.text)).toEqual([
            scriptSources[0].text,
            scriptSources[1].text,
            scriptSources[2].text,
            scriptSources[3].text,
            scriptSources[4].text,
            "I'm Serena Meridian's branch president.",
            "I saw your $10 bill at breakfast.",
        ]);
        expect(aligned.slice(0, 5).every((source) => source.translation)).toBe(true);
        expect(aligned[5].translation).toBeUndefined();
        expect(aligned[6].translation).toBeUndefined();
    });
});
