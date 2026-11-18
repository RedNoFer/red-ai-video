import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getAuthSettings: vi.fn(),
    refundUserPoints: vi.fn(),
    resolveTextPlanningModelCandidates: vi.fn(),
    rankTextPlanningCandidates: vi.fn(),
    requestStructuredText: vi.fn(),
    hasSystemAiCharge: vi.fn(),
    readSystemAiBilling: vi.fn(),
    systemAiBillingHeaders: vi.fn(),
    systemAiIdempotencyKey: vi.fn(),
}));

vi.mock("@/lib/auth/store", () => ({ getAuthSettings: mocks.getAuthSettings, refundUserPoints: mocks.refundUserPoints }));
vi.mock("@/lib/server/logical-model-router", () => ({ resolveTextPlanningModelCandidates: mocks.resolveTextPlanningModelCandidates }));
vi.mock("@/lib/server/text-planning-runtime", () => ({ rankTextPlanningCandidates: mocks.rankTextPlanningCandidates, requestStructuredText: mocks.requestStructuredText }));
vi.mock("@/lib/server/system-ai-billing", () => ({
    hasSystemAiCharge: mocks.hasSystemAiCharge,
    readSystemAiBilling: mocks.readSystemAiBilling,
    systemAiBillingHeaders: mocks.systemAiBillingHeaders,
    systemAiIdempotencyKey: mocks.systemAiIdempotencyKey,
}));

import { translateDramaSubtitleChunks } from "./drama-subtitle-asr";

describe("Drama subtitle translation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getAuthSettings.mockResolvedValue({ defaultModels: { textModel: "text-model" } });
        mocks.resolveTextPlanningModelCandidates.mockReturnValue([{ channelId: "channel-one", upstreamModel: "upstream-one", logicalModelId: "text-model", channel: {} }]);
        mocks.rankTextPlanningCandidates.mockImplementation((candidates: unknown[]) => candidates);
        mocks.systemAiBillingHeaders.mockReturnValue({});
        mocks.systemAiIdempotencyKey.mockReturnValue("translation-idempotency-key");
        mocks.readSystemAiBilling.mockReturnValue({ pointsCost: 5, pointsRecordId: "record-one" });
        mocks.hasSystemAiCharge.mockReturnValue(true);
        mocks.refundUserPoints.mockResolvedValue(undefined);
    });

    it("returns one translated line per English line", async () => {
        mocks.requestStructuredText.mockResolvedValue({
            arguments: JSON.stringify({ translations: ["那是黑金龙卡。", "爷爷说它是真的。"] }),
            headers: new Headers(),
        });

        await expect(
            translateDramaSubtitleChunks({
                origin: "http://127.0.0.1:3000",
                cookie: "worker-context",
                userId: "user-one",
                projectId: "project-one",
                shotId: "shot-one",
                videoId: "video-one",
                chunks: ["That's the black gold card.", "Grandpa said it was real."],
            }),
        ).resolves.toEqual(["那是黑金龙卡。", "爷爷说它是真的。"]);
        expect(mocks.requestStructuredText).toHaveBeenCalledWith(expect.objectContaining({ candidate: expect.objectContaining({ channelId: "channel-one" }) }));
    });

    it("refunds a charged but invalid translation response and fails clearly", async () => {
        mocks.requestStructuredText.mockResolvedValue({
            arguments: JSON.stringify({ translations: ["只有一句。"] }),
            headers: new Headers(),
        });

        await expect(
            translateDramaSubtitleChunks({
                origin: "http://127.0.0.1:3000",
                cookie: "worker-context",
                userId: "user-one",
                projectId: "project-one",
                shotId: "shot-one",
                videoId: "video-one",
                chunks: ["That's the black gold card.", "Grandpa said it was real."],
            }),
        ).rejects.toMatchObject({ status: 502, message: "默认文本模型没有返回有效的中文字幕翻译" });
        expect(mocks.refundUserPoints).toHaveBeenCalledWith("user-one", "text-model", 5, "text", 1, undefined, "record-one");
    });

    it("fails with a configuration error when no default text model is available", async () => {
        mocks.getAuthSettings.mockResolvedValue({ defaultModels: { textModel: "" } });
        mocks.resolveTextPlanningModelCandidates.mockReturnValue([]);

        await expect(
            translateDramaSubtitleChunks({
                origin: "http://127.0.0.1:3000",
                cookie: "",
                userId: "user-one",
                projectId: "project-one",
                shotId: "shot-one",
                videoId: "video-one",
                chunks: ["That's the black gold card."],
            }),
        ).rejects.toMatchObject({ status: 503, message: "后台尚未配置可用的默认文本模型，无法生成双语字幕" });
    });
});
