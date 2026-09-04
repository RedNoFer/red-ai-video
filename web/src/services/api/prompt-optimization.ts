"use client";

import type { CreativeGenerationMode } from "@/lib/creative-runtime-contract";
import { refreshUserPointsIfSystem } from "@/services/api/points";
import { throwIfClientSessionExpired } from "@/services/api/session-expiration";

export async function optimizePrompt(input: { requestId: string; prompt: string; mode: "agent" | CreativeGenerationMode | "drama-frame" | "drama-asset" }) {
    try {
        const response = await fetch("/api/agent/prompt-optimization", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        throwIfClientSessionExpired(response);
        const payload = (await response.json().catch(() => null)) as { data?: { prompt?: string }; msg?: string } | null;
        const prompt = payload?.data?.prompt?.trim();
        if (!response.ok || !prompt) throw new Error(payload?.msg || "提示词优化失败");
        return prompt;
    } finally {
        void refreshUserPointsIfSystem("system");
    }
}

export function optimizeDramaFramePrompt(prompt: string, requestId = crypto.randomUUID()) {
    return optimizePrompt({ requestId, prompt, mode: "drama-frame" });
}

export function optimizeDramaAssetPrompt(kind: "角色" | "场景" | "道具", prompt: string, requestId = crypto.randomUUID()) {
    return optimizePrompt({ requestId, prompt: `【资产类型】${kind}\n【当前提示词】\n${prompt}`, mode: "drama-asset" });
}
