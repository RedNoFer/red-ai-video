import type { DramaAssetReference, DramaEpisode, DramaProject, DramaShot } from "../types";
import type { DramaProductionPlan, DramaProductionRun, DramaStoryboardFrameCandidate } from "@/lib/drama-project-contract";
import { approvedAssetReference } from "@/lib/drama-asset-baseline";
import { createFrameEvidence, continuityStartEvidence, invalidateFrameEvidence, latestFrameEvidence, replaceFrameEvidence, supersedeFrameEvidence } from "@/lib/drama-continuity-policy";
import type { useEffectiveConfig } from "@/stores/use-config-store";
import { resolveDramaGenerationSize } from "@/lib/drama-image-size";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio } from "@/types/media";
import type { VideoReferenceRole } from "@/lib/video-reference-contract";

export function resolveDramaVisualRunSync(project: DramaProject, episodeId: string, run: DramaProductionRun) {
    let changed = false;
    const episodes = project.episodes.map((episode) => {
        if (episode.id !== episodeId) return episode;
        const shots = episode.shots.map((shot) => {
            const activeSteps = run.steps.filter((step) => step.shotId === shot.id && step.taskId && step.status === "running");
            if (!activeSteps.length) return shot;
            let nextShot = shot;
            const start = activeSteps.find((step) => step.type === "start_frame");
            const end = activeSteps.find((step) => step.type === "end_frame");
            if (start && (shot.storyboardStatus !== "running" || shot.storyboardTaskId !== start.taskId)) nextShot = { ...nextShot, storyboardStatus: "running", storyboardTaskId: start.taskId, storyboardError: undefined };
            if (end && (shot.storyboardEndStatus !== "running" || shot.storyboardEndTaskId !== end.taskId)) nextShot = { ...nextShot, storyboardEndStatus: "running", storyboardEndTaskId: end.taskId, storyboardEndError: undefined };
            const keyframes = activeSteps.filter((step) => step.type === "keyframe" && (step.frameId || step.sequenceIndex));
            if (keyframes.length) {
                const frames = [...(nextShot.storyboardFrames || [])];
                for (const step of keyframes) {
                    const index = frames.findIndex((frame) => frame.id === step.frameId || frame.sequenceIndex === step.sequenceIndex);
                    const current = frames[index];
                    if ((current?.mediaUrl ? current.candidateStatus === "running" && current.candidateTaskId === step.taskId : current?.status === "running" && current.taskId === step.taskId)) continue;
                    const frame = current?.mediaUrl
                        ? { ...current, candidateStatus: "running" as const, candidateTaskId: step.taskId, candidateError: undefined }
                        : {
                              ...(current || { id: step.frameId || `frame-${step.sequenceIndex}`, sequenceIndex: step.sequenceIndex || 1, source: "generated" as const }),
                              status: "running" as const,
                              taskId: step.taskId,
                              error: undefined,
                          };
                    if (index >= 0) frames[index] = frame;
                    else frames.push(frame);
                }
                nextShot = { ...nextShot, storyboardFrameMode: "all_frames", storyboardFrames: frames.sort((left, right) => left.sequenceIndex - right.sequenceIndex) };
            }
            if (nextShot !== shot) changed = true;
            return nextShot;
        });
        return shots.some((shot, index) => shot !== episode.shots[index]) ? { ...episode, shots } : episode;
    });
    const runtimeProject = changed ? { ...project, episodes } : project;
    const episode = runtimeProject.episodes.find((item) => item.id === episodeId);
    const pending = Boolean(
        episode?.shots.some(
            (shot) =>
                [shot.storyboardStatus, shot.storyboardEndStatus].some((status) => status === "queued" || status === "running") ||
                (shot.storyboardFrames || []).some((frame) => frame.status === "queued" || frame.status === "running" || frame.candidateStatus === "queued" || frame.candidateStatus === "running"),
        ),
    );
    const trackedTaskIds = new Set(
        episode?.shots.flatMap((shot) => [shot.storyboardTaskId, shot.storyboardEndTaskId, ...(shot.storyboardFrames || []).flatMap((frame) => [frame.taskId, frame.candidateTaskId])].filter((taskId): taskId is string => Boolean(taskId))) || [],
    );
    const resolvedSteps = run.steps.filter((step) => step.taskId && ["success", "failed", "cancelled", "needs_review"].includes(step.status));
    const shouldReload = Boolean(resolvedSteps.length && (!pending || resolvedSteps.some((step) => trackedTaskIds.has(step.taskId!))));
    const shouldContinue = !shouldReload && (pending || run.status === "ready" || run.status === "running");
    return { project: runtimeProject, shouldContinue, shouldReload };
}

export function applyDramaVisualRunTerminalStep(shot: DramaShot, step: DramaProductionRun["steps"][number]) {
    if (!step.shotId || step.shotId !== shot.id || !["success", "failed", "cancelled", "needs_review"].includes(step.status)) return shot;
    if (step.type === "start_frame" || step.type === "end_frame") {
        const isEnd = step.type === "end_frame";
        const resultUrl = step.outputUrls?.[0];
        const status = step.status === "success" && resultUrl ? ("success" as const) : ("error" as const);
        const role = isEnd ? "storyboard_end" : "storyboard_start";
        const evidence = resultUrl
            ? createFrameEvidence({
                  role,
                  source: "generated",
                  mediaUrl: resultUrl,
                  remoteUrl: step.outputRemoteUrls?.[0],
                  sourceShotId: shot.id,
                  generationTaskId: step.taskId,
                  generationPrompt: step.executionPrompt || step.prompt,
                  generationReferences: step.referenceImagesSnapshot,
                  validity: "candidate",
              })
            : undefined;
        const frameEvidence = evidence
            ? replaceFrameEvidence(shot.frameEvidence, evidence, isEnd ? "新的分镜尾帧已生成" : "新的分镜首帧已生成")
            : (shot.frameEvidence || []).map((frame) =>
                  frame.role === role && frame.generationTaskId === step.taskId && (frame.validity === "candidate" || frame.validity === "accepted")
                      ? invalidateFrameEvidence(frame, "unavailable", step.error || "图片任务失败")
                      : frame,
              );
        return {
            ...shot,
            frameEvidence,
            ...(isEnd
                ? {
                      storyboardEndStatus: status,
                      storyboardEndTaskId: step.taskId,
                      storyboardEndError: status === "error" ? step.error : undefined,
                      ...(resultUrl
                          ? {
                                storyboardEndImageUrl: resultUrl,
                                storyboardEndImageUrls: step.outputUrls,
                                storyboardEndImageRemoteUrl: step.outputRemoteUrls?.[0],
                                storyboardEndImageWidth: step.outputWidth,
                                storyboardEndImageHeight: step.outputHeight,
                                storyboardEndPrompt: step.executionPrompt || step.prompt,
                            }
                          : {}),
                  }
                : {
                      storyboardStatus: status,
                      storyboardTaskId: step.taskId,
                      storyboardError: status === "error" ? step.error : undefined,
                      ...(resultUrl
                          ? {
                                storyboardImageUrl: resultUrl,
                                storyboardImageUrls: step.outputUrls,
                                storyboardImageRemoteUrl: step.outputRemoteUrls?.[0],
                                storyboardImageWidth: step.outputWidth,
                                storyboardImageHeight: step.outputHeight,
                                storyboardPrompt: step.executionPrompt || step.prompt,
                            }
                          : {}),
                  }),
        };
    }
    if (step.type !== "keyframe" || !(step.frameId || step.sequenceIndex)) return shot;
    const sequenceIndex = step.sequenceIndex || 1;
    const frameId = step.frameId || `frame-${sequenceIndex}`;
    const currentFrames = [...(shot.storyboardFrames || [])];
    const index = currentFrames.findIndex((frame) => frame.id === frameId || frame.sequenceIndex === sequenceIndex);
    const current = index >= 0 ? currentFrames[index] : undefined;
    if (step.status !== "success" || !step.outputUrls?.length) {
        const failedFrame = current?.mediaUrl
            ? { ...current, candidateStatus: "error" as const, candidateTaskId: step.taskId, candidateError: step.error }
            : { ...(current || { id: frameId, sequenceIndex, source: "generated" as const }), status: "error" as const, taskId: step.taskId, error: step.error };
        if (index >= 0) currentFrames[index] = failedFrame;
        else currentFrames.push(failedFrame);
        const frameEvidence = (shot.frameEvidence || []).map((frame) =>
            frame.role === "storyboard_keyframe" && frame.sequenceIndex === sequenceIndex && frame.generationTaskId === step.taskId && (frame.validity === "candidate" || frame.validity === "accepted")
                ? invalidateFrameEvidence(frame, "unavailable", step.error || "图片任务失败")
                : frame,
        );
        return { ...shot, frameEvidence, storyboardFrameMode: "all_frames" as const, storyboardFrames: currentFrames.sort((left, right) => left.sequenceIndex - right.sequenceIndex) };
    }
    const evidence = step.outputUrls.map((url, index) =>
        createFrameEvidence({
            role: "storyboard_keyframe",
            sequenceIndex,
            source: "generated",
            mediaUrl: url,
            remoteUrl: step.outputRemoteUrls?.[index],
            sourceShotId: shot.id,
            generationTaskId: step.taskId,
            generationPrompt: step.executionPrompt || step.prompt,
            generationReferences: step.referenceImagesSnapshot,
            validity: "candidate",
        }),
    );
    const currentCandidate: DramaStoryboardFrameCandidate | undefined = current?.mediaUrl
        ? {
              id: `current-${current.taskId || current.id}`,
              mediaUrl: current.mediaUrl,
              remoteUrl: current.remoteUrl,
              width: current.width,
              height: current.height,
              source: current.source,
              taskId: current.taskId,
              createdAt: new Date().toISOString(),
              continuityStatus: current.continuityStatus === "stale" ? undefined : current.continuityStatus,
              continuityEvidenceId: current.continuityEvidenceId,
              error: current.error,
              generationPrompt: current.generationPrompt,
              generationReferences: current.generationReferences,
          }
        : undefined;
    const generatedCandidates: DramaStoryboardFrameCandidate[] = step.outputUrls.map((url, index) => ({
        id: `${step.taskId || frameId}-${index}`,
        mediaUrl: url,
        remoteUrl: step.outputRemoteUrls?.[index],
        width: step.outputWidth,
        height: step.outputHeight,
        source: "generated",
        taskId: step.taskId,
        createdAt: new Date().toISOString(),
        continuityStatus: "pending",
        generationPrompt: step.executionPrompt || step.prompt,
        generationReferences: step.referenceImagesSnapshot,
    }));
    const candidates = [...(current?.candidates || []), ...(currentCandidate ? [currentCandidate] : []), ...generatedCandidates].filter(
        (candidate, candidateIndex, all) => all.findIndex((item) => item.mediaUrl === candidate.mediaUrl) === candidateIndex,
    );
    const selected = current?.mediaUrl ? current : generatedCandidates[0];
    const nextFrame = {
        id: frameId,
        sequenceIndex,
        mediaUrl: selected.mediaUrl,
        remoteUrl: selected.remoteUrl,
        width: selected.width,
        height: selected.height,
        source: selected.source,
        status: "success" as const,
        taskId: current?.mediaUrl ? current.taskId : step.taskId,
        inputHash: current?.inputHash || step.inputHash,
        continuityStatus: current?.mediaUrl ? current.continuityStatus : ("pending" as const),
        continuityEvidenceId: current?.mediaUrl ? current.continuityEvidenceId : undefined,
        error: current?.mediaUrl ? current.error : undefined,
        generationPrompt: current?.mediaUrl ? current.generationPrompt : step.executionPrompt || step.prompt,
        generationReferences: current?.mediaUrl ? current.generationReferences : step.referenceImagesSnapshot,
        candidateStatus: undefined,
        candidateTaskId: undefined,
        candidateError: undefined,
        candidates,
    };
    return {
        ...shot,
        frameEvidence: [...(shot.frameEvidence || []).filter((frame) => !evidence.some((item) => item.generationTaskId && item.generationTaskId === frame.generationTaskId)), ...evidence],
        storyboardFrameMode: "all_frames" as const,
        storyboardFrames: [...currentFrames.filter((frame) => frame.sequenceIndex !== sequenceIndex), nextFrame].sort((left, right) => left.sequenceIndex - right.sequenceIndex),
    };
}

export function applyDramaProductionRunStep(shot: DramaShot, step: DramaProductionRun["steps"][number], runId?: string) {
    if (!step.shotId || step.shotId !== shot.id) return shot;
    if (step.type === "extract_frames") {
        if (step.status === "success" && step.outputUrls?.[0])
            return {
                ...shot,
                generationStatus: "success" as const,
                generationRunId: runId || shot.generationRunId,
                generationTaskId: shot.generationTaskId,
                generationError: undefined,
                videoUrl: step.outputUrls[0],
                frameEvidence: supersedeFrameEvidence(shot.frameEvidence, "当前镜头视频已重新生成"),
                actualStartFrameUrl: undefined,
                actualEndFrameUrl: undefined,
                actualFrameVideoUrl: undefined,
                ...(shot.audioMode === "voiceover" && (shot.subtitle || shot.dialogue).trim() ? { audioStatus: "queued" as const, audioError: undefined } : {}),
            };
        if (step.status === "failed" || step.status === "needs_review") return { ...shot, generationStatus: step.status === "needs_review" ? ("needs_review" as const) : ("error" as const), generationRunId: runId || shot.generationRunId, generationError: step.error };
        return step.status === "cancelled" ? { ...shot, generationStatus: "cancelled" as const, generationRunId: runId || shot.generationRunId, generationError: step.error } : shot;
    }
    if (step.type !== "video") return shot;
    if (step.status === "running") return { ...shot, generationStatus: "running" as const, generationTaskId: step.taskId, generationRunId: runId || shot.generationRunId, generationError: undefined };
    if (step.status === "failed" || step.status === "needs_review") return { ...shot, generationStatus: step.status === "needs_review" ? ("needs_review" as const) : ("error" as const), generationRunId: runId || shot.generationRunId, generationTaskId: step.taskId, generationError: step.error };
    if (step.status === "cancelled") return { ...shot, generationStatus: "cancelled" as const, generationRunId: runId || shot.generationRunId, generationTaskId: step.taskId, generationError: step.error };
    return shot;
}

export function shotReferenceImages(project: DramaProject, shot: DramaShot) {
    const assetUrls = [
        ...project.characters.filter((item) => shot.characterIds.includes(item.id)),
        ...project.scenes.filter((item) => item.id === shot.sceneId),
        ...project.props.filter((item) => shot.propIds.includes(item.id)),
        ...(project.clues || []).filter((item) => shot.clueIds.includes(item.id)),
    ].flatMap((item) => {
        const reference = primaryAssetReference(item);
        return reference ? [referenceImage(item.id, `${item.name}.png`, reference.url, "image/png", reference.width, reference.height, undefined, reference.remoteUrl)] : [];
    });
    const sourceAssetIds = new Set(shot.sourceAssetIds || []);
    const sourceUrls = (project.sourceAssets || []).flatMap((item) => {
        if (!sourceAssetIds.has(item.id)) return [];
        if (item.type !== "image") return [];
        const url = item.serverUrl || item.remoteUrl;
        return url ? [referenceImage(item.id, item.title, url, item.mimeType, item.width, item.height)] : [];
    });
    return [...assetUrls, ...sourceUrls];
}

export function continuityReferenceImages(project: DramaProject, episode: DramaEpisode, shot: DramaShot) {
    const edge = episode.continuityEdges?.find((item) => item.toShotId === shot.id && item.inheritActualEndFrame);
    const previous = edge ? episode.shots.find((item) => item.id === edge.fromShotId) : undefined;
    const actualTail = previous ? continuityStartEvidence(previous) : undefined;
    const actualEnd = actualTail ? referenceImage(`continuity-end-${previous!.id}`, `${previous!.title}-实际尾帧.png`, actualTail.mediaUrl, "image/png", undefined, undefined, "first_frame", actualTail.remoteUrl) : null;
    return [...(actualEnd ? [actualEnd] : []), ...shotReferenceImages(project, shot)];
}

export function multiFrameReferenceImages(project: DramaProject, episode: DramaEpisode, shot: DramaShot, plan: DramaProductionPlan) {
    const continuity = continuityReferenceImages(project, episode, shot);
    const tail = continuity.find((item) => item.videoRole === "first_frame");
    const assets = shotReferenceImages(project, shot);
    const keyframes = storyboardReferenceImages(shot);
    const manifest = shot.framePlan?.referenceManifest || [];
    const ordered = manifest.flatMap((item, index) => {
        if (item.role === "previous_actual_tail") return tail ? [{ ...tail, videoRole: "reference" as const }] : [];
        if (item.assetId) {
            const asset = assets.find((candidate) => candidate.id === item.assetId);
            if (asset) return [{ ...asset, videoRole: "reference" as const }];
        }
        if (item.role === "action_keyframe" || item.role === "composition_keyframe") {
            const frame = keyframes[index] || keyframes.find((candidate) => !candidate.videoRole || candidate.videoRole === "keyframe");
            if (frame) return [{ ...frame, videoRole: "reference" as const }];
        }
        return [];
    });
    const fallback = [...(tail ? [{ ...tail, videoRole: "reference" as const }] : []), ...assets.map((item) => ({ ...item, videoRole: "reference" as const })), ...keyframes.map((item) => ({ ...item, videoRole: "reference" as const }))];
    return Array.from(new Map([...ordered, ...fallback].map((item) => [item.url || item.dataUrl, item])).values()).slice(0, plan.references.maxImages);
}

export function isDramaContinuityStartReady(episode: DramaEpisode, shot: DramaShot) {
    const edge = episode.continuityEdges?.find((item) => item.toShotId === shot.id && item.inheritActualEndFrame);
    if (!edge) return true;
    const previous = episode.shots.find((item) => item.id === edge.fromShotId);
    return Boolean(previous && continuityStartEvidence(previous));
}

export function storyboardReferenceImages(shot: DramaShot) {
    if (shot.storyboardFrameMode === "all_frames") {
        const keyframes = (shot.storyboardFrames || [])
            .filter((frame) => frame.mediaUrl && frame.status === "success" && frame.continuityStatus !== "needs_review" && frame.continuityStatus !== "stale")
            .sort((left, right) => left.sequenceIndex - right.sequenceIndex)
            .map((frame) => ({
                ...referenceImage(`storyboard-keyframe-${shot.id}-${frame.sequenceIndex}`, `${shot.title}-关键帧${frame.sequenceIndex}.png`, frame.mediaUrl!, "image/png", frame.width, frame.height, "keyframe", frame.remoteUrl),
                keyframeIndex: frame.sequenceIndex,
            }));
        return keyframes.slice(0, 5).map((frame, index) => ({ ...frame, keyframeIndex: index + 1 }));
    }
    return [
        latestFrameEvidence(shot, "storyboard_start", ["candidate", "accepted"])
            ? referenceImage(
                  `storyboard-start-${shot.id}`,
                  `${shot.title}-起始帧.png`,
                  latestFrameEvidence(shot, "storyboard_start", ["candidate", "accepted"])!.mediaUrl,
                  "image/png",
                  undefined,
                  undefined,
                  "first_frame",
                  latestFrameEvidence(shot, "storyboard_start", ["candidate", "accepted"])!.remoteUrl,
              )
            : null,
        shot.storyboardFrameMode === "first_last" && latestFrameEvidence(shot, "storyboard_end", ["candidate", "accepted"])
            ? referenceImage(
                  `storyboard-end-${shot.id}`,
                  `${shot.title}-结束帧.png`,
                  latestFrameEvidence(shot, "storyboard_end", ["candidate", "accepted"])!.mediaUrl,
                  "image/png",
                  undefined,
                  undefined,
                  "last_frame",
                  latestFrameEvidence(shot, "storyboard_end", ["candidate", "accepted"])!.remoteUrl,
              )
            : null,
    ].filter((item): item is ReturnType<typeof referenceImage> => Boolean(item));
}

export function videoReferenceImages(project: DramaProject, episode: DramaEpisode, shot: DramaShot) {
    const continuity = continuityReferenceImages(project, episode, shot);
    const assets = shotReferenceImages(project, shot);
    const storyboard = storyboardReferenceImages(shot);
    const continuityReferences = continuity.map((reference) => ({ ...reference, videoRole: "reference" as const }));
    if (shot.storyboardFrameMode === "all_frames") {
        return dedupeVideoReferences([...storyboard, ...continuityReferences]);
    }
    const combined = dedupeVideoReferences([...continuity, ...storyboard]);
    const hasActualTail = continuity.some((reference) => reference.videoRole === "first_frame");
    // Strict providers reject first/last-frame inputs mixed with ordinary asset refs.
    // When assets are present, keep every storyboard frame in the same reference batch
    // so the provider receives both the storyboard and the project anchors.
    if (assets.length) return combined.map((reference) => ({ ...reference, videoRole: "reference" as const }));
    return hasActualTail ? combined.map((reference) => (reference.id.startsWith("storyboard-start-") ? { ...reference, videoRole: "reference" as const } : reference)) : combined;
}

function dedupeVideoReferences<T extends { id: string; url?: string }>(references: T[]) {
    return Array.from(new Map(references.map((reference) => [reference.url || reference.id, reference])).values());
}

export function dramaShotVideoMode(project: DramaProject, shot: DramaShot) {
    const mode = shot.videoMode || project.defaultVideoMode;
    return mode === "reference" ? "storyboard" : mode;
}

export function characterReferenceAudios(project: DramaProject, shot: DramaShot): ReferenceAudio[] {
    const characterKeys = new Set([...(shot.characterIds || []), shot.characterId, shot.voiceIdentityId].filter((value): value is string => Boolean(value)));
    return project.characters.flatMap((character) => {
        const voice = character.voiceProfile;
        const isReferenced = characterKeys.has(character.id) || characterKeys.has(`${project.id}:${character.id}`);
        if (!isReferenced || !voice?.sampleAssetId || voice.previewStatus !== "success" || !voice.previewAudioUrl?.startsWith("/api/reference-assets/")) return [];
        return [{ id: `voice-${character.id}-${voice.sampleAssetId}`, name: `${character.name} 角色音频`, type: audioMimeType(voice.previewAudioUrl), url: voice.previewAudioUrl }];
    });
}

function audioMimeType(url: string) {
    const path = url.split("?", 1)[0].toLowerCase();
    if (path.endsWith(".mp3") || path.endsWith(".mpeg")) return "audio/mpeg";
    if (path.endsWith(".ogg") || path.endsWith(".opus")) return "audio/ogg";
    if (path.endsWith(".m4a") || path.endsWith(".aac")) return "audio/aac";
    if (path.endsWith(".flac")) return "audio/flac";
    return "audio/wav";
}

function primaryAssetReference(item: DramaProject["characters"][number]): Pick<DramaAssetReference, "url" | "remoteUrl" | "width" | "height"> | undefined {
    return approvedAssetReference(item);
}

export function referenceImage(id: string, name: string, url: string, type = "image/png", width?: number, height?: number, videoRole?: VideoReferenceRole, remoteUrl?: string): ReferenceImage {
    return { id, name, type, dataUrl: url, url, width, height, ...(videoRole ? { videoRole } : {}), ...(url.startsWith("/") ? { serverUrl: url } : /^https?:\/\//i.test(url) ? { remoteUrl: url } : {}), ...(remoteUrl ? { remoteUrl } : {}) };
}

export function dramaGenerationSize(project: DramaProject, prompt: string, references: ReferenceImage[] = []) {
    return resolveDramaGenerationSize({ projectSize: project.ratio, prompt, references });
}

export function estimateTaskPoints(config: ReturnType<typeof useEffectiveConfig>, type: "image" | "video" | "audio", duration = 5) {
    const model = type === "image" ? config.imageModel || config.model : type === "video" ? config.videoModel || config.model : config.audioModel;
    const base = Number(config.modelPointCosts[model] || 0);
    if (type === "image") return Number((base * (config.generationPointMultipliers.imageQuality[config.quality] || 1)).toFixed(2));
    if (type === "video") {
        const quality = config.generationPointMultipliers.videoQuality[config.vquality] || 1;
        const seconds = config.generationPointMultipliers.videoSeconds[String(duration)] || config.generationPointMultipliers.videoSeconds[config.videoSeconds] || 1;
        return Number((base * quality * seconds).toFixed(2));
    }
    return Number(base.toFixed(2));
}

export function estimateEpisodePoints(config: ReturnType<typeof useEffectiveConfig>, project: DramaProject, shots: DramaShot[], videoResolution?: string) {
    const videoQuality = String(videoResolution || config.vquality).replace(/p$/i, "");
    const total = shots.reduce((sum, shot) => {
        const mode = dramaShotVideoMode(project, shot);
        const image = mode === "storyboard" ? estimateTaskPoints(config, "image") * (shot.storyboardFrameMode === "all_frames" ? Math.max(2, shot.storyboardFrames?.length || 3) : shot.storyboardFrameMode === "first_last" ? 2 : 1) : 0;
        const audio = shot.audioMode === "voiceover" && (shot.subtitle || shot.dialogue || shot.narration).trim() ? estimateTaskPoints(config, "audio") : 0;
        return sum + image + estimateTaskPoints({ ...config, vquality: videoQuality }, "video", shot.duration) + audio;
    }, 0);
    return Number(total.toFixed(2));
}
