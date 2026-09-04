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
        expect(systemMessage).toContain("静态关键帧写法模板");
        expect(systemMessage).toContain("静态帧提示词公开布局");
        expect(systemMessage).toContain("每个非空字段必须独立成行");
        expect(systemMessage).toContain("不得用逗号或分号压成一段");
        expect(systemMessage).toContain("前景必须是具体框景或遮挡物");
        expect(systemMessage).toContain("ELS/极远景只能保留远景空间关系");
        expect(systemMessage).toContain("静态帧不是无动作的氛围图");
        expect(systemMessage).toContain("不预设固定秒数");
        expect(systemMessage).toContain("上一帧/上一镜");
        expect(systemMessage).toContain("只返回优化后的公开提示词");
    });

    it("uses the dedicated drama asset skill and forces one single-subject candidate", async () => {
        vi.mocked(requestStructuredText).mockResolvedValue({
            arguments: JSON.stringify({ optimizedPrompt: "主体与资产类型：角色；身份/结构锚点：固定五官与黑色短发；构图与画幅：单人全身，9:16。" }),
            headers: new Headers(),
            protocol: "chat",
            elapsedMs: 10,
        });

        await optimizeCreativePrompt({
            origin: "http://localhost:3000",
            cookie: "session=1",
            userId: "user-one",
            requestId: "asset-request",
            prompt: "【资产类型】角色\n【当前提示词】\n旧版多视角设定板，黑色短发角色",
            mode: "drama-asset",
        });

        const systemMessage = vi.mocked(requestStructuredText).mock.calls[0]?.[0].messages.find((message) => message.role === "system")?.content || "";
        expect(systemMessage).toContain("短剧资产图片导演");
        expect(systemMessage).toContain("只生成一个完整可识别的单人角色");
        expect(systemMessage).toContain("绝对禁止多角度、三视图");
        expect(systemMessage).toContain("主体与资产类型");
    });

    it("optimizes video prompts around visible action beats", async () => {
        vi.mocked(requestStructuredText).mockResolvedValue({ arguments: JSON.stringify({ optimizedPrompt: "0-2秒建立黑湖，2-4秒镜头推进，4-5秒Karin收紧握剑，5-6秒断口冷光匹配切入马车。" }), headers: new Headers(), protocol: "chat", elapsedMs: 10 });

        await optimizeCreativePrompt({ origin: "http://localhost:3000", cookie: "session=1", userId: "user-one", requestId: "video-request", prompt: "30 秒黑湖边的人握剑", mode: "video" });

        const systemMessage = vi.mocked(requestStructuredText).mock.calls[0]?.[0].messages.find((message) => message.role === "system")?.content || "";
        expect(systemMessage).toContain("主体动作推进");
        expect(systemMessage).toContain("起始可见状态");
        expect(systemMessage).toContain("每个非空字段必须独立一行");
        expect(systemMessage).toContain("每个时间段都必须让姿态");
        expect(systemMessage).toContain("减少“保持构图、主体稳定、情绪不变”");
        expect(systemMessage).toContain("模式：30 秒精确时间轴");
    });

    it("removes narrative planning labels from an optimized video prompt", async () => {
        vi.mocked(requestStructuredText).mockResolvedValue({
            arguments: JSON.stringify({ optimizedPrompt: "动态意图：B线钩子中，Karin握住完整断剑，断口从掌心裂开。\n结束画面：Karin惊醒后仍握住断剑。" }),
            headers: new Headers(),
            protocol: "chat",
            elapsedMs: 10,
        });

        const result = await optimizeCreativePrompt({ origin: "http://localhost:3000", cookie: "session=1", userId: "user-one", requestId: "video-label-request", prompt: "Karin握住断剑后断口裂开", mode: "video" });

        const systemMessage = vi.mocked(requestStructuredText).mock.calls[0]?.[0].messages.find((message) => message.role === "system")?.content || "";
        expect(systemMessage).toContain("不得输出 A线、B线、主线、副线、钩子");
        expect(result).toContain("Karin握住完整断剑");
        expect(result).not.toMatch(/[AB]线|钩子/u);
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
