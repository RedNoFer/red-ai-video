import type { DramaEpisode, DramaProject, DramaShot } from "../types";
import { dramaShotVideoMode } from "./drama-shot-generation-utils";
import { hasApprovedAssetReference } from "@/lib/drama-asset-baseline";

const ACTIVE_TASK_STATUSES = new Set(["queued", "running"]);

export type DramaGenerationReadiness = {
    totalShots: number;
    completedVideoCount: number;
    activeShotIds: string[];
    failedShotIds: string[];
    incompleteShotIds: string[];
    queueableShotIds: string[];
    missingPromptShotIds: string[];
    missingReferenceShotIds: string[];
    missingBaselineShotIds: string[];
    voiceoverShotIds: string[];
    missingAudioShotIds: string[];
    completedAudioCount: number;
    progressPercent: number;
};

export function shotNeedsVoiceover(shot: DramaShot) {
    return shot.audioMode === "voiceover" && Boolean((shot.subtitle || shot.dialogue || shot.narration).trim());
}

export function summarizeDramaGeneration(project: DramaProject, episode: DramaEpisode): DramaGenerationReadiness {
    const activeShotIds: string[] = [];
    const failedShotIds: string[] = [];
    const incompleteShotIds: string[] = [];
    const missingPromptShotIds: string[] = [];
    const missingReferenceShotIds: string[] = [];
    const missingBaselineShotIds: string[] = [];
    const voiceoverShotIds: string[] = [];
    const missingAudioShotIds: string[] = [];
    let completedVideoCount = 0;
    let completedAudioCount = 0;

    for (const shot of episode.shots) {
        const mode = dramaShotVideoMode(project, shot);
        const active = [shot.storyboardStatus, shot.storyboardEndStatus, shot.generationStatus, shot.audioStatus].some((status) => ACTIVE_TASK_STATUSES.has(status || ""));
        const failed = [shot.storyboardStatus, shot.storyboardEndStatus, shot.generationStatus, shot.audioStatus].some((status) => status === "error");
        const missingPrompt = !shot.videoPrompt.trim() || (mode === "storyboard" && !shot.imagePrompt.trim());
        const missingReference = false;
        const shotAssets = [
            shot.sceneId ? project.scenes.find((item) => item.id === shot.sceneId) : undefined,
            ...shot.characterIds.map((id) => project.characters.find((item) => item.id === id)),
            ...shot.propIds.map((item) => project.props.find((asset) => asset.id === item)),
        ];
        const missingBaseline = shotAssets.some((asset) => !hasApprovedAssetReference(asset));

        if (shot.videoUrl) completedVideoCount += 1;
        else incompleteShotIds.push(shot.id);
        if (active) activeShotIds.push(shot.id);
        if (failed) failedShotIds.push(shot.id);
        if (!shot.videoUrl && missingPrompt) missingPromptShotIds.push(shot.id);
        if (missingReference) missingReferenceShotIds.push(shot.id);
        if (missingBaseline) missingBaselineShotIds.push(shot.id);

        if (shotNeedsVoiceover(shot)) {
            voiceoverShotIds.push(shot.id);
            if (shot.audioUrl) completedAudioCount += 1;
            else missingAudioShotIds.push(shot.id);
        }
    }

    const blockedShotIds = new Set([...missingPromptShotIds, ...missingReferenceShotIds, ...missingBaselineShotIds]);
    const activeIds = new Set(activeShotIds);
    const queueableShotIds = incompleteShotIds.filter((shotId) => !blockedShotIds.has(shotId) && !activeIds.has(shotId));

    return {
        totalShots: episode.shots.length,
        completedVideoCount,
        activeShotIds,
        failedShotIds,
        incompleteShotIds,
        queueableShotIds,
        missingPromptShotIds,
        missingReferenceShotIds,
        missingBaselineShotIds,
        voiceoverShotIds,
        missingAudioShotIds,
        completedAudioCount,
        progressPercent: episode.shots.length ? Math.round((completedVideoCount / episode.shots.length) * 100) : 0,
    };
}
