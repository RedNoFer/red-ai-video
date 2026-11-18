import { describe, expect, it, vi } from "vitest";

import { planDramaSubtitleSources } from "@/lib/drama-subtitle-plan";

const mocks = vi.hoisted(() => ({
    settings: vi.fn(),
    candidates: vi.fn(),
    ranked: vi.fn((items: unknown[]) => items),
    structured: vi.fn(),
    refund: vi.fn(),
}));

vi.mock("@/lib/auth/store", () => ({ getAuthSettings: mocks.settings, refundUserPoints: mocks.refund }));
vi.mock("@/lib/server/logical-model-router", () => ({ resolveTextPlanningModelCandidates: mocks.candidates }));
vi.mock("@/lib/server/text-planning-runtime", () => ({ rankTextPlanningCandidates: mocks.ranked, requestStructuredText: mocks.structured }));

import {
    alignDramaSubtitleSources,
    alignDramaTranscriptSegments,
    buildDramaSubtitleChunks,
    buildDramaSubtitleSources,
    dramaScriptHasSubtitleTranslations,
    filterDramaSpeechBursts,
    parseDramaSilenceIntervals,
    parseDramaSubtitleTranslations,
    parseDramaWhisperTranscript,
    refineDramaTranscriptSegments,
    translateDramaSubtitleChunks,
    type DramaSubtitleSpeechBurst,
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

    it("keeps only intervals confirmed as real speech by per-burst recognition", () => {
        const intervals: DramaSubtitleSpeechInterval[] = [
            { startMs: 2_970, endMs: 5_530 },
            { startMs: 6_116, endMs: 6_459 },
            { startMs: 12_637, endMs: 12_819 },
        ];

        expect(filterDramaSpeechBursts(intervals, ["[BLANK_AUDIO]", "That's...", "What?"])).toEqual([
            { startMs: 6_116, endMs: 6_459, text: "That's..." },
            { startMs: 12_637, endMs: 12_819, text: "What?" },
        ]);
        // 识别失败按仍有语音处理（text 为空，仅按时长兜底对齐），宁可多显示也不丢对白。
        expect(filterDramaSpeechBursts(intervals, [undefined, undefined, ""])).toEqual([
            { startMs: 2_970, endMs: 5_530, text: "" },
            { startMs: 6_116, endMs: 6_459, text: "" },
        ]);
    });

    it("aligns sentences to real speech bursts instead of drifting whisper timestamps", () => {
        // SH01 形态：全量识别把首句提前到音乐起点（2.97s），句尾拖进静音；真实语音从 6.1s 开始。
        const segments = [
            { startMs: 2_970, endMs: 9_880, text: "That's the black gold card." },
            { startMs: 9_880, endMs: 12_780, text: "Grandpa said it was real." },
            { startMs: 12_780, endMs: 13_780, text: "What?" },
            { startMs: 13_780, endMs: 16_020, text: "Is something wrong?" },
        ];
        const bursts: DramaSubtitleSpeechBurst[] = [
            { startMs: 6_116, endMs: 6_459, text: "That's..." },
            { startMs: 7_198, endMs: 8_394, text: "the black gold card." },
            { startMs: 9_885, endMs: 10_979, text: "Grandpa said it was real." },
            { startMs: 12_637, endMs: 12_819, text: "What?" },
            { startMs: 13_482, endMs: 14_128, text: "Is something wrong?" },
        ];

        const aligned = alignDramaTranscriptSegments(segments, bursts);

        expect(aligned.map((segment) => [segment.startMs, segment.endMs])).toEqual([
            [6_116, 8_394], // 两段爆发同属一句
            [9_885, 10_979],
            [12_637, 13_422], // 0.18s 的短句延长到可读时长，但不越过下一句
            [13_482, 14_482],
        ]);
        expect(aligned.map((segment) => segment.text)).toEqual(segments.map((segment) => segment.text));
    });

    it("claims short bursts by duration when per-burst text is noise", () => {
        // 真实案例："What?" 被单独识别成 "one."，词重合为 0；短区间文本证据弱，应由时长主导归还给 "What?"
        const segments = [
            { startMs: 0, endMs: 2_000, text: "Grandpa said it was real." },
            { startMs: 2_000, endMs: 3_000, text: "What?" },
            { startMs: 3_000, endMs: 5_000, text: "Is something wrong?" },
        ];

        const aligned = alignDramaTranscriptSegments(segments, [
            { startMs: 0, endMs: 1_120, text: "Grandpa said it was real." },
            { startMs: 1_200, endMs: 1_390, text: "one." },
            { startMs: 1_450, endMs: 2_100, text: "Is something wrong?" },
        ]);

        expect(aligned.map((segment) => [segment.startMs, segment.endMs])).toEqual([
            [0, 1_120],
            [1_200, 1_390],
            [1_450, 2_450], // 独占结尾的句子允许延到一个短尾巴
        ]);
        expect(aligned.map((segment) => segment.text)).toEqual(segments.map((segment) => segment.text));
    });

    it("slices a single burst window when silence detection cannot separate continuous speech", () => {
        const segments = [
            { startMs: 0, endMs: 600, text: "Hello there my dear friend" },
            { startMs: 0, endMs: 600, text: "Hi." },
        ];

        const aligned = alignDramaTranscriptSegments(segments, [{ startMs: 0, endMs: 600, text: "Hello there my dear friend. Hi." }]);

        expect(aligned.map((segment) => [segment.startMs, segment.endMs])).toEqual([
            [0, 500],
            [500, 1400], // 独占结尾的句子允许延到一个短尾巴
        ]);
        expect(aligned.map((segment) => segment.text)).toEqual(["Hello there my dear friend", "Hi."]);
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

    it("only treats script sources with Chinese as model-free subtitle sources", () => {
        expect(dramaScriptHasSubtitleTranslations([{ text: "What?", hasEnglish: true }])).toBe(false);
        expect(dramaScriptHasSubtitleTranslations([{ text: "What?", translation: "   ", hasEnglish: true }])).toBe(false);
        expect(dramaScriptHasSubtitleTranslations([{ text: "What?", translation: "什么？", hasEnglish: true }])).toBe(true);
    });

    it("splits a matched script line across real ASR segments and keeps each segment timing", () => {
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

        expect(aligned).toHaveLength(4);
        expect(aligned[0]).toMatchObject({ text: "The black-gold card?", translation: "黑金龙卡？", startMs: 0, endMs: 9_900 });
        expect(aligned[1]).toMatchObject({ text: "Grandpa said it was real.", translation: "爷爷说它真的存在。", startMs: 9_900, endMs: 12_780 });
        expect(aligned[2]).toMatchObject({ text: "What?", translation: "什么？", startMs: 12_780, endMs: 13_780 });
        expect(aligned[3]).toMatchObject({ text: "Something wrong?", translation: "出什么事了？", startMs: 13_780, endMs: 16_020 });
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
            "The black-gold card?",
            "Grandpa said it was real.",
            "What?",
            "Something wrong?",
            "You don't know what that is.",
            "A card.",
            "The bank gave it to me.",
            "The bank gave it to you.",
            "I'm Serena. Private banking, Meridian.",
            "I saw your ten at the breakfast shop.",
        ]);
        expect(aligned.every((source) => source.translation)).toBe(true);
        expect(aligned[8].translation).toBe("我是Serena，Meridian私人银行。");
        expect(aligned[9].translation).toBe("我在早餐店看见你那张十美元。");
        expect(aligned.every((source, index) => source.startMs === segments[index].startMs && source.endMs === segments[index].endMs)).toBe(true);
        expect(aligned.some((source) => source.text.includes("seen a ghost"))).toBe(false);

        const cues = planDramaSubtitleSources(aligned, 30_000, 1920, 1080, "bilingual");
        expect(cues.map((cue) => cue.text)).toEqual(aligned.map((source) => source.text));
        expect(cues[0].startMs).toBe(0);
        expect(cues[1].startMs).toBeGreaterThanOrEqual(9_900);
        expect(cues[9].endMs).toBeLessThanOrEqual(30_000);
        expect(cues.every((cue) => cue.secondaryText)).toBe(true);
    });

    it("falls back to the next text model for translation and bills that model", async () => {
        mocks.settings.mockResolvedValue({ defaultModels: { textModel: "gpt-5.5" } });
        mocks.candidates.mockReturnValue([
            { logicalModelId: "gpt-5.5", channelId: "channel-one", upstreamModel: "gpt-5.5", channel: { id: "channel-one" } },
            { logicalModelId: "gpt-5.6", channelId: "channel-one", upstreamModel: "gpt-5.6", channel: { id: "channel-one" } },
        ]);
        mocks.structured.mockImplementation(async (input: { candidate: { logicalModelId: string } }) => {
            if (input.candidate.logicalModelId === "gpt-5.5") throw new Error("文本模型渠道暂不可用（HTTP 502）");
            return { arguments: JSON.stringify({ translations: ["我是Serena Meridian分行的行长。", "我早餐时看到了你那张10美元钞票。"] }), headers: new Headers() };
        });

        const result = await translateDramaSubtitleChunks({
            origin: "http://127.0.0.1:3000",
            cookie: "",
            userId: "user-one",
            projectId: "project-one",
            shotId: "shot-one",
            videoId: "video-one",
            chunks: ["I'm Serena Meridian's branch president.", "I saw your $10 bill at breakfast."],
        });

        expect(result).toEqual(["我是Serena Meridian分行的行长。", "我早餐时看到了你那张10美元钞票。"]);
        expect(mocks.structured).toHaveBeenCalledTimes(3);
        expect(mocks.structured.mock.calls[2][0].headers["x-vozeb-pro-logical-model"]).toBe("gpt-5.6");
    });
});
