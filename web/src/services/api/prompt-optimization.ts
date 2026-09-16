"use client";

import type { CreativeGenerationMode } from "@/lib/creative-runtime-contract";
import type { DramaAssetPromptOptimization } from "@/lib/drama-project-contract";
import type { DramaGlobalVisualContract } from "@/lib/drama-style";
import { refreshUserPointsIfSystem } from "@/services/api/points";
import { throwIfClientSessionExpired } from "@/services/api/session-expiration";

type PromptOptimizationInput = { requestId: string; prompt: string; mode: "agent" | CreativeGenerationMode | "drama-frame" | "drama-asset"; visualContract?: DramaGlobalVisualContract };
type AssetPromptOptimizationInput = Omit<PromptOptimizationInput, "mode"> & { mode: "drama-asset" };
type NonAssetPromptOptimizationInput = Omit<PromptOptimizationInput, "mode"> & { mode: "agent" | CreativeGenerationMode | "drama-frame" };
export type PromptOptimizationReasonCode =
    "configuration" | "missing_story_source" | "missing_asset_reference" | "invalid_input" | "unsupported_model_capability" | "unresolved_shot_reference" | "invalid_model_response" | "quality_gate_failed" | "upstream_failure";

export class PromptOptimizationApiError extends Error {
    constructor(
        message: string,
        readonly reasonCode: PromptOptimizationReasonCode = "upstream_failure",
        readonly status?: number,
    ) {
        super(message);
        this.name = "PromptOptimizationApiError";
    }
}

async function optimizePromptResult(input: PromptOptimizationInput) {
    try {
        const response = await fetch("/api/agent/prompt-optimization", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        throwIfClientSessionExpired(response);
        const payload = (await response.json().catch(() => null)) as { data?: { prompt?: string; fields?: DramaAssetPromptOptimization["fields"]; reasonCode?: PromptOptimizationReasonCode }; msg?: string } | null;
        const prompt = payload?.data?.prompt?.trim();
        if (!response.ok || !prompt) throw new PromptOptimizationApiError(payload?.msg || "提示词优化失败", payload?.data?.reasonCode, response.status);
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

export async function optimizeDramaProjectFramePrompt(input: { projectId: string; episodeId: string; shotId: string; frameId: string; prompt: string; correctionDirection?: string; requestId?: string }) {
    try {
        const response = await fetch(`/api/drama/projects/${encodeURIComponent(input.projectId)}/episodes/${encodeURIComponent(input.episodeId)}/shots/${encodeURIComponent(input.shotId)}/frames/${encodeURIComponent(input.frameId)}/prompt/optimize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId: input.requestId || crypto.randomUUID(), prompt: input.prompt, correctionDirection: input.correctionDirection }),
        });
        throwIfClientSessionExpired(response);
        const payload = (await response.json().catch(() => null)) as { data?: { prompt?: string; reasonCode?: PromptOptimizationReasonCode }; msg?: string } | null;
        const prompt = payload?.data?.prompt?.trim();
        if (!response.ok || !prompt) throw new PromptOptimizationApiError(payload?.msg || "图片帧提示词优化失败", payload?.data?.reasonCode, response.status);
        return prompt;
    } finally {
        void refreshUserPointsIfSystem("system");
    }
}

export async function getDramaFrameExternalBrief(input: { projectId: string; episodeId: string; shotId: string; frameId: string; prompt: string; correctionDirection?: string }) {
    const response = await fetch(`/api/drama/projects/${encodeURIComponent(input.projectId)}/episodes/${encodeURIComponent(input.episodeId)}/shots/${encodeURIComponent(input.shotId)}/frames/${encodeURIComponent(input.frameId)}/prompt/external-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input.prompt, correctionDirection: input.correctionDirection }),
    });
    throwIfClientSessionExpired(response);
    const payload = (await response.json().catch(() => null)) as { data?: { brief?: string }; msg?: string } | null;
    const brief = payload?.data?.brief?.trim();
    if (!response.ok || !brief) throw new Error(payload?.msg || "外部 Agent 工作单生成失败");
    return brief;
}

export function optimizeDramaAssetPrompt(kind: "角色" | "场景" | "道具", prompt: string, requestId = crypto.randomUUID(), visualContract?: DramaGlobalVisualContract) {
    return optimizePrompt({ requestId, prompt: `【资产类型】${kind}\n【当前提示词】\n${prompt}`, mode: "drama-asset", visualContract });
}
