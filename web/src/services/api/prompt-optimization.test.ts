import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshUserPointsIfSystem } from "@/services/api/points";
import { optimizeDramaAssetPrompt, optimizePrompt } from "./prompt-optimization";

vi.mock("@/services/api/points", () => ({ refreshUserPointsIfSystem: vi.fn(async () => undefined) }));
vi.mock("@/services/api/session-expiration", () => ({ throwIfClientSessionExpired: vi.fn() }));

describe("prompt optimization API client", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
        vi.mocked(refreshUserPointsIfSystem).mockClear();
    });

    it("returns the optimized prompt and refreshes billed points", async () => {
        vi.mocked(fetch).mockResolvedValue(Response.json({ code: 0, data: { prompt: "优化后的提示词" }, msg: "OK" }));

        await expect(optimizePrompt({ requestId: "request-one", prompt: "原文", mode: "video" })).resolves.toBe("优化后的提示词");
        expect(fetch).toHaveBeenCalledWith("/api/agent/prompt-optimization", expect.objectContaining({ method: "POST", body: JSON.stringify({ requestId: "request-one", prompt: "原文", mode: "video" }) }));
        expect(refreshUserPointsIfSystem).toHaveBeenCalledWith("system");
    });

    it("surfaces the server message", async () => {
        vi.mocked(fetch).mockResolvedValue(Response.json({ code: 503, data: null, msg: "后台尚未配置可用的默认文本模型" }, { status: 503 }));

        await expect(optimizePrompt({ requestId: "request-one", prompt: "原文", mode: "agent" })).rejects.toThrow("后台尚未配置可用的默认文本模型");
        expect(refreshUserPointsIfSystem).toHaveBeenCalledWith("system");
    });

    it("returns structured fields for drama asset optimization", async () => {
        vi.mocked(fetch).mockResolvedValue(
            Response.json({
                code: 0,
                data: {
                    prompt: "主体与资产类型：角色",
                    fields: { description: "少年", visualIdentity: "黑发", styling: "墨色长袍", colorPalette: "墨黑", consistencyRules: "四视图一致" },
                },
                msg: "OK",
            }),
        );

        await expect(optimizeDramaAssetPrompt("角色", "原提示词", "asset-request")).resolves.toEqual({
            optimizedPrompt: "主体与资产类型：角色",
            fields: { description: "少年", visualIdentity: "黑发", styling: "墨色长袍", colorPalette: "墨黑", consistencyRules: "四视图一致" },
        });
    });
});
