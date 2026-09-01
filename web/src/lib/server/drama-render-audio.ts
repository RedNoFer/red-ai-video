import type { DramaShotAudioMode } from "@/lib/drama-project-contract";

export type DramaRenderAudioPlan = "source" | "voiceover" | "voiceover_mix" | "silence";

export function normalizeDramaShotAudioMode(value: unknown): DramaShotAudioMode {
    return value === "voiceover" || value === "mute" ? value : "source";
}

export function resolveDramaRenderAudioPlan(audioMode: DramaShotAudioMode, audioUrl: string, sourceHasAudio: boolean): DramaRenderAudioPlan {
    if (audioMode === "voiceover") {
        if (!audioUrl) throw new Error("AI 配音尚未完成");
        return sourceHasAudio ? "voiceover_mix" : "voiceover";
    }
    if (audioMode === "source" && sourceHasAudio) return "source";
    return "silence";
}
