"use client";

import type { CreativeGenerationMode } from "@/lib/creative-runtime-contract";
import type { DramaAssetPromptOptimization } from "@/lib/drama-project-contract";
import type { DramaGlobalVisualContract } from "@/lib/drama-style";
import { refreshUserPointsIfSystem } from "@/services/api/points";
import { throwIfClientSessionExpired } from "@/services/api/session-expiration";

type PromptOptimizationInput = { requestId: string; prompt: string; mode: "agent" | CreativeGenerationMode | "drama-frame" | "drama-asset"; visualContract?: DramaGlobalVisualContract };
type AssetPromptOptimizationInput = Omit<PromptOptimizationInput, "mode"> & { mode: "drama-asset" };
type NonAssetPromptOptimizationInput = Omit<PromptOptimizationInput, "mode"> & { mode: "agent" | CreativeGenerationMode | "drama-frame" };

async function optimizePromptResult(input: PromptOptimizationInput) {
    try {
        const response = await fetch("/api/agent/prompt-optimization", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        throwIfClientSessionExpired(response);
        const payload = (await response.json().catch(() => null)) as { data?: { prompt?: string; fields?: DramaAssetPromptOptimization["fields"] }; msg?: string } | null;
        const prompt = payload?.data?.prompt?.trim();
        if (!response.ok || !prompt) throw new Error(payload?.msg || "提示词优化失败");
        return { prompt, fields: payload?.data?.fields };
    } finally {
        void refreshUserPointsIfSystem("system");
    }
}

export function optimizePrompt(input: AssetPromptOptimizationInput): Promise<DramaAssetPromptOptimization>;
export function optimizePrompt(input: NonAssetPromptOptimizationInput): Promise<string>;
export async function optimizePrompt(input: PromptOptimizationInput): Promise<string | DramaAssetPromptOptimization> {
    const result = await optimizePromptResult(input);
    if (input.mode === "drama-asset") {
        if (!result.fields) throw new Error("提示词优化未返回完整资产字段");
        return { optimizedPrompt: result.prompt, fields: result.fields } satisfies DramaAssetPromptOptimization;
    }
    return result.prompt;
}

export function optimizeDramaFramePrompt(prompt: string, requestId = crypto.randomUUID(), visualContract?: DramaGlobalVisualContract) {
    return optimizePrompt({ requestId, prompt, mode: "drama-frame", visualContract });
}

export function optimizeDramaAssetPrompt(kind: "角色" | "场景" | "道具", prompt: string, requestId = crypto.randomUUID(), visualContract?: DramaGlobalVisualContract) {
    return optimizePrompt({ requestId, prompt: `【资产类型】${kind}\n【当前提示词】\n${prompt}`, mode: "drama-asset", visualContract });
}
