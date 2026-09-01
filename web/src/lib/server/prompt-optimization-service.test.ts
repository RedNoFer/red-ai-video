import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthSettings, refundUserPoints } from "@/lib/auth/store";
import { resolveLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { requestStructuredText } from "@/lib/server/text-planning-runtime";
import { optimizeCreativePrompt } from "./prompt-optimization-service";

vi.mock("@/lib/auth/store", () => ({ getAuthSettings: vi.fn(), refundUserPoints: vi.fn() }));
vi.mock("@/lib/server/logical-model-router", () => ({ resolveLogicalModelCandidates: vi.fn() }));
vi.mock("@/lib/server/text-planning-runtime", () => ({
    rankTextPlanningCandidates: <T>(items: T[]) => items,
    requestStructuredText: vi.fn(),
}));

const candidate = {
    channelId: "text-channel",
    upstreamModel: "grok-4.5",
    channel: { id: "text-channel", name: "文本渠道", baseUrl: "https://example.com/v1", apiKey: "secret", apiFormat: "openai", models: ["grok-4.5"], enabled: true },
};

describe("prompt optimization service", () => {
    beforeEach(() => {
        vi.mocked(getAuthSettings)
            .mockReset()
            .mockResolvedValue({ defaultModels: { textModel: "planner" } } as Awaited<ReturnType<typeof getAuthSettings>>);
        vi.mocked(resolveLogicalModelCandidates)
            .mockReset()
            .mockReturnValue([candidate] as ReturnType<typeof resolveLogicalModelCandidates>);
        vi.mocked(requestStructuredText).mockReset();
        vi.mocked(refundUserPoints).mockReset();
    });

    it("uses the default text model once and returns a valid public prompt", async () => {
        vi.mocked(requestStructuredText).mockResolvedValue({ arguments: JSON.stringify({ optimizedPrompt: "生成一张清晰的国风角色海报，保留青色长袍。" }), headers: new Headers(), protocol: "chat", elapsedMs: 10 });

        const result = await optimizeCreativePrompt({ origin: "http://localhost:3000", cookie: "session=1", userId: "user-one", requestId: "request-one", prompt: "做个国风角色海报 青衣", mode: "image" });

        expect(result).toBe("生成一张清晰的国风角色海报，保留青色长袍。");
        expect(requestStructuredText).toHaveBeenCalledTimes(1);
        expect(requestStructuredText).toHaveBeenCalledWith(
            expect.objectContaining({
                messages: expect.arrayContaining([expect.objectContaining({ role: "user", content: "做个国风角色海报 青衣" })]),
            }),
        );
        expect(new Headers(vi.mocked(requestStructuredText).mock.calls[0]![0].headers).get("x-vozeb-pro-logical-model")).toBe("planner");
    });

    it("applies structured edit semantics to image prompt optimization", async () => {
        vi.mocked(requestStructuredText).mockResolvedValue({
            arguments: JSON.stringify({ optimizedPrompt: "change：将背景改为雨夜；preserve：保留人物身份、服装和构图；constraints：16:9，不新增人物。" }),
            headers: new Headers(),
            protocol: "chat",
            elapsedMs: 10,
        });

        await optimizeCreativePrompt({ origin: "http://localhost:3000", cookie: "session=1", userId: "user-one", requestId: "image-request", prompt: "把背景改成雨夜，人物不变", mode: "image" });

        const systemMessage = vi.mocked(requestStructuredText).mock.calls[0]?.[0].messages.find((message) => message.role === "system")?.content || "";
        expect(systemMessage).toContain("change、preserve、constraints");
        expect(systemMessage).toContain("只包含一个已定位变量");
    });

    it("evaluates drama frame prompts with the internal Seedance director rules", async () => {
        vi.mocked(requestStructuredText).mockResolvedValue({ arguments: JSON.stringify({ optimizedPrompt: "静态关键帧：Karin站在无波黑湖边，倒悬古塔与倒影对齐。" }), headers: new Headers(), protocol: "chat", elapsedMs: 10 });

        await optimizeCreativePrompt({ origin: "http://localhost:3000", cookie: "session=1", userId: "user-one", requestId: "frame-request", prompt: "原始帧提示词", mode: "drama-frame" });

        const systemMessage = vi.mocked(requestStructuredText).mock.calls[0]?.[0].messages.find((message) => message.role === "system")?.content || "";
        expect(systemMessage).toContain("Seedance 2.0 静态图片帧提示词导演");
        expect(systemMessage).toContain("Seedance 导演 Skill（固定版本");
        expect(systemMessage).toContain("每张参考图的唯一用途");
        expect(systemMessage).toContain("静态关键帧专用规则");
        expect(systemMessage).toContain("ELS/极远景");
        expect(systemMessage).toContain("上一帧/上一镜");
        expect(systemMessage).toContain("只返回优化后的公开提示词");
    });

    it("refunds an invalid charged response instead of accepting hidden or empty output", async () => {
        vi.mocked(requestStructuredText).mockResolvedValue({
            arguments: JSON.stringify({ explanation: "内部分析" }),
            headers: new Headers({ "x-vozeb-pro-points-cost": "3", "x-vozeb-pro-points-record-id": "points-one" }),
            protocol: "chat",
            elapsedMs: 10,
        });

        await expect(optimizeCreativePrompt({ origin: "http://localhost:3000", cookie: "session=1", userId: "user-one", requestId: "request-one", prompt: "优化这句话", mode: "agent" })).rejects.toThrow("默认文本模型没有返回有效提示词");
        expect(refundUserPoints).toHaveBeenCalledWith("user-one", "planner", 3, "text", 1, undefined, "points-one");
    });

    it("fails clearly when no default text binding is available", async () => {
        vi.mocked(resolveLogicalModelCandidates).mockReturnValue([]);

        await expect(optimizeCreativePrompt({ origin: "http://localhost:3000", cookie: "", userId: "user-one", requestId: "request-one", prompt: "优化这句话", mode: "agent" })).rejects.toMatchObject({ status: 503 });
        expect(requestStructuredText).not.toHaveBeenCalled();
    });
});
