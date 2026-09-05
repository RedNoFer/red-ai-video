import { after, NextResponse } from "next/server";
import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings, isAuthInputError, refundUserPoints } from "@/lib/auth/store";
import { generationModelId, toSystemGenerationChannel } from "@/lib/server/generation-channel";
import { finishGenerationAttempt, startGenerationAttempt, type GenerationAttempt } from "@/lib/server/generation-attempt";
import { fetchInternalApi, resolveInternalOrigin } from "@/lib/server/internal-origin";
import { resolveLogicalModelCandidates, supportsVideoKeyframeReferences } from "@/lib/server/logical-model-router";
import {
    assertReferenceCapabilities,
    assertReferenceUrls,
    assertVideoReferenceRoles,
    buildVideoProviderRequest,
    isProviderBusinessError,
    readProviderError,
    readProviderString,
    requiresProviderReadableReferenceUrls,
    resolvedProviderCreatePaths,
    serializeProviderRequest,
} from "@/lib/server/provider-task-config";
import { buildGlobalAiOpcVideoRequest, resolveGlobalAiOpcPreset } from "@/lib/globalaiopc-catalog";
import { createVideoTask, transitionVideoTask, updateVideoTask, type VideoTask } from "@/lib/server/video-task-store";
import { toSafeGenerationErrorMessage } from "@/lib/server/generation-errors";
import { getStoredGenerationTaskByRequest, linkStoredGenerationTask, withGenerationConcurrencyLimit, type GenerationTaskContext } from "@/lib/server/generation-task-store";
import { normalizeVideoAspectRatio, resolveUpstreamVideoDuration, resolveVideoDuration, resolveVideoGenerationParameters, withVideoReferenceFidelity } from "@/lib/server/video-task-config";
import { parseImageDimensions } from "@/lib/image-size";
import { signReferenceAssetInputUrl } from "@/lib/server/reference-asset-access";
import { resolveProviderReadableReferenceMedia } from "@/lib/server/provider-reference-media";
import { assertCapabilityConstraints } from "@/lib/server/capability-constraints";
import { checkGenerationRateLimit, rateLimitHeaders } from "@/lib/server/security";
import { resolveModelRequestTimeoutMs } from "@/lib/server/model-request-policy";
import { mediaTaskSource } from "@/lib/media-management-contract";
import { runGenerationTaskRecoveryBatch } from "@/lib/server/generation-task-recovery-service";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";
import { VIDEO_PROVIDER_MEDIA_KEYS, parseVideoProviderJson, readVideoProviderError, readVideoProviderHttpError, readVideoProviderId, readVideoProviderUrl, videoProviderResultUrlError } from "@/lib/server/video-provider-response";
import { buildSeedanceSpecialRequest } from "@/lib/seedance-special";
import { NEW_API_VIDEO_RATIOS, NEW_API_VIDEO_RESOLUTIONS, resolveBumingSeedanceVideoModelContract } from "@/lib/channel-protocol-registry";
import { assertVozebRecommendedVideoReferences, buildVozebRecommendedVideoRequest } from "@/lib/vozeb-recommended-video";
import { assertGeminiVideoReferences, buildGeminiVideoRequest, geminiVideoCreatePath, normalizeGeminiVideoDuration, parseGeminiVideoCreateResponse } from "@/lib/server/gemini-video-provider";
import { systemAiBillingHeaders } from "@/lib/server/system-ai-billing";
import { maintenanceWorkerContextHeaders, requestRuntimeCredential } from "@/lib/server/maintenance-auth";
import { resolvePublicRequestOrigin } from "@/lib/server/public-request-origin";
import { writeVideoGenerationLog } from "@/lib/server/video-task-log";
import { buildOpenAiVideoFormData } from "./video-task-openai";
import { normalizeVideoGenerationReferences, regularVideoReferences, videoFrameReferences, type VideoGenerationReference } from "@/lib/video-reference-contract";
import { assertYumengVideoReferences, buildYumengVideoRequest } from "@/lib/yumeng-model-center";
import { createVideoProviderRequestSnapshot } from "@/lib/server/video-provider-request-snapshot";

const CREATE_PATHS = ["/video/generations", "/videos/generations", "/videos/videos", "/videos"];
type CreateVideoTaskBody = { config?: Record<string, unknown>; prompt?: string; references?: VideoGenerationReference[]; source?: string; context?: GenerationTaskContext };

export async function POST(request: Request) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    const headerRequestId = clean(request.headers.get("x-vozeb-pro-client-request-id"));
    const headerAttemptNo = positiveAttemptNo(request.headers.get("x-vozeb-pro-attempt-no"));
    if (headerRequestId) {
        const existing = await getStoredGenerationTaskByRequest<VideoTask>("video", user.id, headerRequestId, headerAttemptNo);
        if (existing) return NextResponse.json({ task: publicTask(existing) });
    }
    const rate = await checkGenerationRateLimit(user.id, request, "video");
    if (!rate.allowed) return NextResponse.json({ error: "视频生成请求过于频繁，请稍后重试" }, { status: 429, headers: rateLimitHeaders(rate) });
    let body: CreateVideoTaskBody;
    try {
        body = await readJsonBody(request);
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ error: error.message }, { status: error.status });
        throw error;
    }
    if (!headerRequestId && body.context?.clientRequestId) {
        const existing = await getStoredGenerationTaskByRequest<VideoTask>("video", user.id, body.context.clientRequestId, body.context.attemptNo);
        if (existing) return NextResponse.json({ task: publicTask(existing) });
    }
    if (headerRequestId) body.context = { ...(body.context || {}), clientRequestId: headerRequestId, ...(headerAttemptNo ? { attemptNo: headerAttemptNo } : {}) };
    const settings = await getAuthSettings();
    const response = await withGenerationConcurrencyLimit(user.id, "video", 30 * 60_000, settings.generationConcurrency.video, async () => {
        // Video execution is controlled by the administrator's default logical
        // model. Client/project model fields are presentation hints only and
        // must never select a different provider model at the submission edge.
        const requestedModel = settings.defaultModels.videoModel;
        const requestedChannelId = "";
        const requestedParameters = resolveVideoGenerationParameters(body.config || {}, settings.generationDefaults);
        const candidates = resolveLogicalModelCandidates(settings, "video", requestedModel, requestedChannelId);
        const prompt = String(body.prompt || "").trim();
        if (!prompt) return NextResponse.json({ error: "视频任务参数不完整或渠道不支持" }, { status: 400 });
        const publicOrigin = requestPublicOrigin(request);
        let references: VideoGenerationReference[];
        try {
            references = normalizeVideoGenerationReferences(body.references).map((reference) => ({
                ...reference,
                url: signReferenceAssetInputUrl(reference.url, publicOrigin),
                ...(reference.serverUrl ? { serverUrl: signReferenceAssetInputUrl(reference.serverUrl, publicOrigin) } : {}),
            }));
        } catch (error) {
            return NextResponse.json({ error: error instanceof Error ? error.message : "视频参考素材不正确" }, { status: 400 });
        }
        const keyframeCount = references.filter((reference) => reference.role === "keyframe").length;
        const isDramaRun = body.context?.surface === "drama" && Boolean(body.context.runId);
        // Drama runs use the same backend default as every other video task.
        // For all-frame references, keep the default model's compatible binding
        // and never switch to a different logical model as a hidden fallback.
        const compatibleDefaultCandidates = candidates.filter((candidate) => supportsVideoKeyframeReferences(candidate, keyframeCount));
        const selectedCandidates = isDramaRun && keyframeCount ? (compatibleDefaultCandidates.length ? compatibleDefaultCandidates : candidates).slice(0, 1) : candidates;
        if (!selectedCandidates.length) return NextResponse.json({ error: "视频任务参数不完整或渠道不支持" }, { status: 400 });
        const channels = selectedCandidates.map(toSystemGenerationChannel);
        const providerPrompt = withVideoReferenceFidelity(prompt, references);
        const origin = resolveInternalOrigin(new URL(request.url).origin);
        const cookie = requestRuntimeCredential(request, user.id);
        const billingRequestId = clean(body.context?.clientRequestId) || clean(request.headers.get("x-vozeb-pro-client-request-id")) || `video-request:${user.id}:${Date.now()}`;
        const attemptRequestId = body.context?.attemptNo ? `${billingRequestId}:attempt:${body.context.attemptNo}` : billingRequestId;
        let lastError: unknown;
        let capabilityError: unknown;
        let attempts: GenerationAttempt[] = [];
        let localTask: VideoTask | undefined;
        for (let index = 0; index < channels.length; index += 1) {
            const channel = channels[index];
            const geminiVideo = isGeminiVideoChannel(channel);
            const capabilityProfile = channel.capabilityProfile;
            const bumingContract = channel.advancedConfig?.protocol === "buming-seedance" ? resolveBumingSeedanceVideoModelContract(channel.model) : undefined;
            const supportsKeyframes = bumingContract ? bumingContract.videoReferenceModes.includes("all_frames") : channel.advancedConfig?.protocol === "newapi-video" ? false : capabilityProfile?.supportsKeyframes;
            if (keyframeCount && !supportsKeyframes) {
                if (bumingContract && !bumingContract.videoReferenceModes.includes("all_frames")) {
                    const error = new Error("当前不鸣视频模型不支持全能帧连续参考");
                    if (isDramaRun) return NextResponse.json({ error: error.message }, { status: 400 });
                    capabilityError = error;
                    continue;
                }
                const error = new Error("当前模型未声明支持全能帧关键图，请切换支持全能帧的模型");
                if (isDramaRun) return NextResponse.json({ error: error.message }, { status: 400 });
                capabilityError = error;
                continue;
            }
            const parameters = {
                ...requestedParameters,
                ...(channel.advancedConfig?.protocol === "newapi-video"
                    ? {
                          size: clean(body.config?.size) ? requestedParameters.size : "16:9",
                          vquality: clean(body.config?.vquality) ? requestedParameters.vquality : "720",
                      }
                    : {}),
                videoSeconds: geminiVideo
                    ? normalizeGeminiVideoDuration(requestedParameters.videoSeconds)
                    : resolveUpstreamVideoDuration(channel.advancedConfig?.protocol === "newapi-video" && !hasProvidedValue(body.config?.videoSeconds) ? 5 : requestedParameters.videoSeconds, channel.advancedConfig?.protocol === "newapi-video" ? 5 : settings.generationDefaults.videoSeconds, {
                          durationRange: channel.advancedConfig?.durationRange,
                          minDurationSeconds: channel.capabilityProfile?.minDurationSeconds,
                          maxDurationSeconds: channel.capabilityProfile?.maxDurationSeconds,
                      }),
            };
            let candidateReferences = references;
            try {
                assertCapabilityConstraints(capabilityProfile, {
                    capability: "video",
                    referenceCount: undefined,
                    durationSeconds: parameters.videoSeconds === -1 ? undefined : parameters.videoSeconds,
                    aspectRatio: normalizeVideoAspectRatio(parameters.size),
                });
                const globalPreset = globalAiOpcVideoPreset(channel.advancedConfig, channel.model);
                if (geminiVideo) {
                    assertGeminiVideoReferences(candidateReferences);
                } else {
                    if (requiresProviderReadableReferenceUrls(channel.advancedConfig, Boolean(globalPreset))) candidateReferences = await resolveProviderReadableReferenceMedia(candidateReferences);
                    if (channel.advancedConfig?.protocol === "newapi-video") assertNewApiVideoContract(parameters, candidateReferences);
                    assertReferenceCapabilities(
                        globalPreset
                            ? {
                                  ...channel.advancedConfig!,
                                  supportsReferenceImage: Boolean(globalPreset.supportsReferenceImage),
                                  supportsReferenceVideo: Boolean(globalPreset.supportsReferenceVideo),
                                  supportsReferenceAudio: Boolean(globalPreset.supportsReferenceAudio),
                              }
                            : channel.advancedConfig,
                        candidateReferences,
                    );
                    if (channel.advancedConfig?.protocol !== "yumeng") assertVideoReferenceRoles(channel.advancedConfig, candidateReferences, globalPreset?.videoReferenceRoles, channel.model);
                    if (channel.advancedConfig?.protocol === "vozeb-recommended") assertVozebRecommendedVideoReferences(channel.model, candidateReferences);
                    if (channel.advancedConfig?.protocol === "yumeng") assertYumengVideoReferences(channel.model, candidateReferences);
                    assertReferenceUrls(channel.advancedConfig, candidateReferences, Boolean(globalPreset));
                }
            } catch (error) {
                if (isDramaRun) return NextResponse.json({ error: error instanceof Error ? error.message : "当前不鸣视频模型不支持参考素材" }, { status: 400 });
                capabilityError = error;
                continue;
            }
            const started = startGenerationAttempt(attempts, { channelId: channel.channelId, model: generationModelId(channel), capability: "video" });
            attempts = started.attempts;
            const pendingUpstream = {
                id: "",
                provider: "generation" as const,
                model: channel.model,
                pollPath: geminiVideo ? geminiVideoCreatePath(channel.model) : channel.advancedConfig?.createPath || CREATE_PATHS[0],
            };
            if (!localTask) {
                localTask = await createVideoTask({
                    userId: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    title: prompt.slice(0, 36) || "视频生成",
                    config: channel,
                    upstream: pendingUpstream,
                    requestedDurationSeconds: parameters.videoSeconds === -1 ? undefined : parameters.videoSeconds,
                    prompt,
                    source: mediaTaskSource(body.source, body.context, "video-task"),
                    attempts,
                    ...(body.context || {}),
                });
                await linkStoredGenerationTask("video", localTask.id, body.context || {});
            } else {
                await updateVideoTask(localTask.id, {
                    config: channel,
                    upstream: pendingUpstream,
                    requestedDurationSeconds: parameters.videoSeconds === -1 ? undefined : parameters.videoSeconds,
                    attempts,
                });
                localTask = { ...localTask, config: channel, upstream: pendingUpstream, requestedDurationSeconds: parameters.videoSeconds === -1 ? undefined : parameters.videoSeconds, attempts };
            }
            const submissionStartedAt = Date.now();
            await scheduleGenerationTask("video", localTask.id, {
                executionPhase: "submitting",
                channelId: channel.channelId,
                provider: channel.advancedConfig?.protocol || channel.apiFormat,
                queryPath: channel.advancedConfig?.queryPath,
                nextPollAt: submissionStartedAt + resolveModelRequestTimeoutMs(channel, "video"),
                lastUpstreamStatus: "submitting",
            });
            try {
                const candidateRequestId = index === 0 ? attemptRequestId : `${attemptRequestId}:candidate:${index + 1}`;
                const upstream = await createUpstream(user.id, origin, cookie, channel, providerPrompt, parameters, candidateReferences, settings.generationPointMultipliers, attemptRequestId, candidateRequestId);
                await updateVideoTask(localTask.id, { config: channel, upstream, requestedDurationSeconds: parameters.videoSeconds === -1 ? undefined : parameters.videoSeconds, attempts });
                const task = { ...localTask, config: channel, upstream, requestedDurationSeconds: parameters.videoSeconds === -1 ? undefined : parameters.videoSeconds, attempts };
                const submittedAt = Date.now();
                await scheduleGenerationTask("video", task.id, {
                    executionPhase: "submitted",
                    upstreamTaskId: task.upstream.id,
                    channelId: channel.channelId,
                    provider: task.upstream.provider,
                    queryPath: task.upstream.queryPath || task.config.advancedConfig?.queryPath || task.upstream.pollPath,
                    submittedAt,
                    nextPollAt: submittedAt,
                    lastUpstreamStatus: "submitted",
                });
                after(() => runGenerationTaskRecoveryBatch({ origin, cookie, limit: 1, taskIds: [task.id] }));
                return NextResponse.json({ task: publicTask(task) });
            } catch (error) {
                lastError = error;
                attempts = finishGenerationAttempt(attempts, started.attempt.attemptNo, { status: "failed", error: toSafeGenerationErrorMessage(error, "视频任务创建失败") });
                await updateVideoTask(localTask.id, { attempts });
                if (error instanceof SafeCandidateFailure && index < channels.length - 1) continue;
                const message = toSafeGenerationErrorMessage(error, "视频任务创建失败");
                if (!(error instanceof SafeCandidateFailure)) {
                    await scheduleGenerationTask("video", localTask.id, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "submission_outcome_unknown" });
                    return NextResponse.json({ task: { ...publicTask({ ...localTask, attempts }), needsReview: true }, warning: `${message}；上游创建结果待确认，系统不会自动重复创建。` }, { status: 202 });
                }
                break;
            }
        }
        if (!lastError && capabilityError) return NextResponse.json({ error: capabilityError instanceof Error ? capabilityError.message : "当前渠道不支持参考素材" }, { status: 400 });
        if (localTask && lastError) {
            const message = toSafeGenerationErrorMessage(lastError, "视频任务创建失败");
            await writeVideoGenerationLog({ ...localTask, attempts }, "failed", message, lastError instanceof SafeCandidateFailure);
            await transitionVideoTask(localTask, { status: "error", error: message, retryable: lastError instanceof SafeCandidateFailure });
            await scheduleGenerationTask("video", localTask.id, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "create_failed" });
        }
        return NextResponse.json({ error: toSafeGenerationErrorMessage(lastError, "视频任务创建失败"), canRetry: lastError instanceof SafeCandidateFailure }, { status: 502 });
    });
    return response || NextResponse.json({ error: "当前用户视频任务已达到并发上限" }, { status: 429 });
}

export async function createUpstream(
    userId: string,
    origin: string,
    cookie: string,
    channel: NonNullable<ReturnType<typeof toSystemGenerationChannel>>,
    prompt: string,
    raw: Record<string, unknown>,
    references: VideoGenerationReference[],
    multipliers: Awaited<ReturnType<typeof getAuthSettings>>["generationPointMultipliers"],
    billingRequestId: string,
    candidateRequestId = billingRequestId,
) {
    let lastError = "";
    const regularReferences = regularVideoReferences(references);
    const { firstFrame, lastFrame, keyframes } = videoFrameReferences(references);
    const images = referenceUrls([...keyframes, ...regularReferences.filter((reference) => reference.type === "image")], "image");
    const bumingSeedance = channel.advancedConfig?.protocol === "buming-seedance";
    // Keep the provider image array aligned with the public reference order:
    // an inherited first frame is followed by keyframes 1..N, then regular refs.
    const bumingImages = referenceUrls([...(firstFrame ? [firstFrame] : []), ...(lastFrame ? [lastFrame] : []), ...keyframes, ...regularReferences.filter((reference) => reference.type === "image")], "image");
    const videos = referenceUrls(regularReferences, "video");
    const audios = referenceUrls(regularReferences, "audio");
    const requestImage = images[0] || "";
    const requestImages = images;
    const firstFrameUrl = firstFrame?.url || "";
    const lastFrameUrl = lastFrame?.url || "";
    const dimensions = videoDimensions(raw.size, raw.vquality);
    const generateAudio = raw.videoGenerateAudio !== false && raw.videoGenerateAudio !== "false";
    const bumingContract = bumingSeedance ? resolveBumingSeedanceVideoModelContract(channel.model) : undefined;
    const providerPrompt = bumingSeedance ? bumingSeedancePrompt(prompt, firstFrame, lastFrame, keyframes.length, bumingImages.length - keyframes.length - Number(Boolean(firstFrame)) - Number(Boolean(lastFrame)), videos.length, audios.length) : prompt;
    if (isGeminiVideoChannel(channel)) {
        return createGeminiVideoUpstream({ userId, origin, cookie, channel, prompt, raw, references, generateAudio, multipliers, billingRequestId: candidateRequestId });
    }
    const values = {
        model: channel.model,
        prompt: providerPrompt,
        duration: duration(raw.videoSeconds),
        seconds: duration(raw.videoSeconds),
        ratio: ratio(raw.size),
        aspect_ratio: ratio(raw.size),
        size: sizeValue(raw.size),
        resolution: resolution(raw.vquality),
        quality: bumingSeedance ? bumingContract?.quality || "" : resolution(raw.vquality),
        width: dimensions.width,
        height: dimensions.height,
        generate_audio: generateAudio,
        images: bumingSeedance ? bumingImages : requestImages,
        videos,
        audios,
        image: requestImage,
        video: videos[0] || "",
        audio: audios[0] || "",
        references,
        content: videoReferenceContent(prompt, references),
        first_frame: firstFrameUrl,
        first_frame_url: firstFrameUrl,
        last_frame: lastFrameUrl,
        last_frame_url: lastFrameUrl,
        mode: bumingSeedance
            ? keyframes.length
                ? "reference"
                : firstFrameUrl
                  ? lastFrameUrl
                      ? "first-last"
                      : "first-frame"
                  : images.length || videos.length || audios.length
                    ? "reference"
                    : "text-to-video"
            : firstFrameUrl
              ? lastFrameUrl
                  ? "first-last-frame"
                  : "first-frame"
              : videos.length
                ? "reference-video"
                : images.length
                  ? "image-to-video"
                  : "text-to-video",
        client_request_id: candidateRequestId,
    };
    const defaults = {
        model: channel.model,
        prompt: providerPrompt,
        duration: values.duration,
        seconds: values.seconds,
        ratio: values.ratio,
        aspect_ratio: values.aspect_ratio,
        resolution: values.resolution,
        quality: values.quality,
        generate_audio: generateAudio,
        watermark: raw.videoWatermark === "true",
        ...(requestImage ? { image: requestImage } : {}),
        ...(requestImages.length ? { images: requestImages, image_urls: requestImages, reference_images: requestImages } : {}),
        ...(videos.length ? { video: videos[0], videos, reference_videos: videos } : {}),
        ...(audios.length ? { audio: audios[0], audios, reference_audios: audios } : {}),
        ...(references.length ? { ref_assets: references.map((item) => ({ type: item.type, url: item.url, role: item.role || "reference", ...(item.keyframeIndex ? { keyframe_index: item.keyframeIndex } : {}) })) } : {}),
        ...(firstFrameUrl ? { first_frame: firstFrameUrl, first_frame_url: firstFrameUrl } : {}),
        ...(lastFrameUrl ? { last_frame: lastFrameUrl, last_frame_url: lastFrameUrl } : {}),
        mode: values.mode,
        ...(channel.advancedConfig?.protocol === "buming-seedance" ? { client_request_id: candidateRequestId } : {}),
    };
    const globalPreset = globalAiOpcVideoPreset(channel.advancedConfig, channel.model);
    const multipart = channel.advancedConfig?.requestTemplate?.trim().toLowerCase().startsWith("multipart/form-data") === true;
    const payload = multipart
        ? undefined
        : channel.advancedConfig?.protocol === "vozeb-recommended"
          ? buildVozebRecommendedVideoRequest({
                model: channel.model,
                prompt,
                duration: values.duration as number,
                aspectRatio: values.aspect_ratio as string,
                resolution: values.resolution as string,
                generateAudio,
                images,
                videos,
                audios,
            })
          : channel.advancedConfig?.protocol === "seedance-special"
            ? buildSeedanceSpecialRequest({
                  model: channel.model,
                  prompt,
                  duration: values.duration === -1 ? 5 : (values.duration as number),
                  ratio: values.ratio as string,
                  generateAudio,
                  references,
              })
            : channel.advancedConfig?.protocol === "yumeng"
              ? buildYumengVideoRequest({
                    model: channel.model,
                    prompt,
                    duration: values.duration as number,
                    aspectRatio: values.aspect_ratio as string,
                    resolution: values.resolution as string,
                    generateAudio,
                    watermark: raw.videoWatermark === "true",
                    images: requestImages,
                    videos,
                    audios,
                    firstFrame: firstFrameUrl || undefined,
                    lastFrame: lastFrameUrl || undefined,
                })
              : globalPreset
                ? buildGlobalAiOpcVideoRequest(globalPreset, {
                      model: channel.model,
                      prompt,
                      duration: values.duration as number,
                      ratio: values.ratio as string,
                      resolution: values.resolution as string,
                      images: requestImages.length ? requestImages : requestImage ? [requestImage] : [],
                      videos,
                      audios,
                      generateAudio,
                      firstFrame: firstFrameUrl || undefined,
                      lastFrame: lastFrameUrl || undefined,
                  })
                : buildVideoProviderRequest(channel.advancedConfig?.requestTemplate, defaults, values);
    const requestBody = multipart
        ? await buildOpenAiVideoFormData({ model: channel.model, prompt, seconds: values.seconds as number, width: dimensions.width, height: dimensions.height, imageUrls: firstFrameUrl ? [firstFrameUrl] : images, origin, cookie })
        : serializeVideoProviderRequest(payload);
    const imageToVideoPath = images.length || firstFrameUrl ? channel.advancedConfig?.imageToVideoPath?.trim() : "";
    const createPaths = globalPreset ? [globalPreset.createPath] : imageToVideoPath ? [imageToVideoPath] : resolvedProviderCreatePaths(channel.advancedConfig, "video", CREATE_PATHS);
    for (const path of createPaths) {
        const response = await proxyFetch(origin, channel.baseUrl, path, cookie, {
            method: "POST",
            headers: {
                ...(multipart ? {} : { "Content-Type": "application/json" }),
                "Idempotency-Key": candidateRequestId,
                "X-Client-Request-Id": candidateRequestId,
                ...systemAiBillingHeaders(generationModelId(channel), `video-request:${candidateRequestId}`, channel.model),
            },
            body: requestBody,
            signal: AbortSignal.timeout(resolveModelRequestTimeoutMs(channel, "video")),
        });
        const text = await response.text();
        if (!response.ok) {
            lastError = readVideoProviderHttpError(text, response.status);
            if (!isSafeCreateFailure(response.status, lastError, text)) throw new Error(lastError);
            continue;
        }
        let data: unknown;
        try {
            data = parseVideoProviderJson(text);
        } catch (error) {
            const pointsCost = billedPointsCost(response.headers.get("x-vozeb-pro-points-cost"));
            const pointsRecordId = response.headers.get("x-vozeb-pro-points-record-id") || undefined;
            if (pointsCost !== undefined && pointsRecordId) await refundUserPoints(userId, generationModelId(channel), pointsCost, "video", videoUnits(raw, multipliers), undefined, pointsRecordId);
            throw error instanceof Error ? error : new Error("视频接口返回了无效 JSON");
        }
        const providerError = readVideoProviderError(data);
        if (isProviderBusinessError(data)) {
            const pointsCost = billedPointsCost(response.headers.get("x-vozeb-pro-points-cost"));
            const pointsRecordId = response.headers.get("x-vozeb-pro-points-record-id") || undefined;
            if (pointsCost !== undefined && pointsRecordId) await refundUserPoints(userId, generationModelId(channel), pointsCost, "video", videoUnits(raw, multipliers), undefined, pointsRecordId);
            throw new SafeCandidateFailure(providerError || "视频接口请求失败");
        }
        const resultUrl = readVideoProviderUrl(data, channel.advancedConfig?.resultField);
        const resultUrlError = videoProviderResultUrlError(resultUrl);
        if (resultUrlError) {
            const pointsCost = billedPointsCost(response.headers.get("x-vozeb-pro-points-cost"));
            const pointsRecordId = response.headers.get("x-vozeb-pro-points-record-id") || undefined;
            if (pointsCost !== undefined && pointsRecordId) await refundUserPoints(userId, generationModelId(channel), pointsCost, "video", videoUnits(raw, multipliers), undefined, pointsRecordId);
            throw new SafeCandidateFailure(resultUrlError);
        }
        const id = readVideoProviderId(data) || (resultUrl ? `direct:${Date.now()}` : "");
        if (!id) {
            const pointsCost = billedPointsCost(response.headers.get("x-vozeb-pro-points-cost"));
            const pointsRecordId = response.headers.get("x-vozeb-pro-points-record-id") || undefined;
            if (pointsCost !== undefined && pointsRecordId) await refundUserPoints(userId, generationModelId(channel), pointsCost, "video", videoUnits(raw, multipliers), undefined, pointsRecordId);
            throw new Error(providerError || "视频接口没有返回任务 ID");
        }
        return {
            id,
            provider: "generation" as const,
            model: channel.model,
            pollPath: path,
            queryPath: undefined,
            resultUrl: resultUrl || undefined,
            pointsCost: billedPointsCost(response.headers.get("x-vozeb-pro-points-cost")),
            pointsUnits: videoUnits(raw, multipliers),
            pointsRecordId: response.headers.get("x-vozeb-pro-points-record-id") || undefined,
            requestSnapshot: createVideoProviderRequestSnapshot(path, providerPrompt, references, requestBody, multipart),
        };
    }
    throw new SafeCandidateFailure(lastError || "没有可用的视频创建接口");
}

async function createGeminiVideoUpstream(input: {
    userId: string;
    origin: string;
    cookie: string;
    channel: NonNullable<ReturnType<typeof toSystemGenerationChannel>>;
    prompt: string;
    raw: Record<string, unknown>;
    references: VideoGenerationReference[];
    generateAudio: boolean;
    multipliers: Awaited<ReturnType<typeof getAuthSettings>>["generationPointMultipliers"];
    billingRequestId: string;
}) {
    const payload = await buildGeminiVideoRequest({
        prompt: input.prompt,
        durationSeconds: input.raw.videoSeconds,
        aspectRatio: input.raw.size,
        resolution: input.raw.vquality,
        generateAudio: input.generateAudio,
        references: input.references,
        origin: input.origin,
        cookie: input.cookie,
    });
    const path = geminiVideoCreatePath(input.channel.model);
    const response = await proxyFetch(input.origin, input.channel.baseUrl, path, input.cookie, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": input.billingRequestId,
            "X-Client-Request-Id": input.billingRequestId,
            ...systemAiBillingHeaders(generationModelId(input.channel), `video-request:${input.billingRequestId}`, input.channel.model),
        },
        body: serializeVideoProviderRequest(payload),
        signal: AbortSignal.timeout(resolveModelRequestTimeoutMs(input.channel, "video")),
    });
    const text = await response.text();
    if (!response.ok) {
        const message = readVideoProviderHttpError(text, response.status);
        if (isSafeCreateFailure(response.status, message, text)) throw new SafeCandidateFailure(message);
        throw new Error(message);
    }
    let data: unknown;
    try {
        data = parseVideoProviderJson(text);
    } catch (error) {
        throw error instanceof Error ? error : new Error("Gemini Veo 返回了无效 JSON");
    }
    const created = parseGeminiVideoCreateResponse(data, input.channel.model);
    const pointsCost = billedPointsCost(response.headers.get("x-vozeb-pro-points-cost"));
    const pointsRecordId = response.headers.get("x-vozeb-pro-points-record-id") || undefined;
    if (created.error) {
        if (pointsCost !== undefined && pointsRecordId) {
            await refundUserPoints(input.userId, generationModelId(input.channel), pointsCost, "video", videoUnits(input.raw, input.multipliers), undefined, pointsRecordId);
        }
        throw new SafeCandidateFailure(created.error);
    }
    if (!created.id) throw new Error("Gemini Veo 没有返回 operation ID");
    return {
        id: created.id,
        provider: "generation" as const,
        model: input.channel.model,
        pollPath: path,
        queryPath: created.queryPath || undefined,
        resultUrl: created.resultUrl || undefined,
        pointsCost,
        pointsUnits: videoUnits(input.raw, input.multipliers),
        pointsRecordId,
    };
}

function globalAiOpcVideoPreset(config: NonNullable<ReturnType<typeof toSystemGenerationChannel>>["advancedConfig"], model: string) {
    const preset = resolveGlobalAiOpcPreset(config, model);
    return preset?.capability === "video" ? preset : undefined;
}

function isGeminiVideoChannel(channel: NonNullable<ReturnType<typeof toSystemGenerationChannel>>) {
    return channel.apiFormat === "gemini" && channel.advancedConfig?.protocol !== "globalaiopc";
}

function proxyFetch(origin: string, baseUrl: string, path: string, cookie: string, init: RequestInit) {
    const headers = new Headers(init.headers);
    const workerHeaders = maintenanceWorkerContextHeaders(cookie);
    if (workerHeaders) Object.entries(workerHeaders).forEach(([key, value]) => headers.set(key, value));
    else if (cookie) headers.set("cookie", cookie);
    return fetchInternalApi(`${origin}${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`, { ...init, headers });
}
function publicTask(task: VideoTask) {
    return { id: task.id, status: task.status, model: generationModelId(task.config), upstreamId: task.upstream.id || undefined, durationSeconds: task.requestedDurationSeconds, canRetry: task.retryable === true };
}
function duration(value: unknown) {
    return resolveVideoDuration(value, 5);
}
function ratio(value: unknown) {
    return normalizeVideoAspectRatio(value);
}
function resolution(value: unknown) {
    const text = clean(value).replace(/p$/i, "");
    return text === "480" || text === "1080" || text === "720" ? `${text}p` : "480p";
}
function videoDimensions(size: unknown, quality: unknown) {
    const exact = parseImageDimensions(String(size || ""));
    if (exact) return exact;
    const [x, y] = ratio(size).split(":").map(Number);
    const edge = Number(resolution(quality).replace("p", "")) || 480;
    if (!x || !y) return { width: 1280, height: 720 };
    return x >= y ? { width: Math.round((edge * x) / y), height: edge } : { width: edge, height: Math.round((edge * y) / x) };
}

function bumingSeedancePrompt(prompt: string, firstFrame: VideoGenerationReference | undefined, lastFrame: VideoGenerationReference | undefined, keyframeCount: number, regularImageCount: number, videoCount: number, audioCount: number) {
    const references: string[] = [];
    if (keyframeCount) {
        const firstKeyframe = Number(Boolean(firstFrame)) + 1;
        references.push(`${firstFrame ? "首帧使用@图片1；" : ""}连续关键帧按时间顺序使用@图片${firstKeyframe}至@图片${firstKeyframe + keyframeCount - 1}`);
    } else if (firstFrame && lastFrame) references.push("首帧使用@图片1，尾帧使用@图片2");
    else if (firstFrame) references.push("首帧使用@图片1");
    const regularImageStart = keyframeCount + Number(Boolean(firstFrame)) + Number(Boolean(lastFrame)) + 1;
    if (regularImageCount) references.push(`普通参考图片使用@图片${regularImageStart}${regularImageCount > 1 ? `至@图片${regularImageStart + regularImageCount - 1}` : ""}`);
    if (videoCount) references.push(`参考视频使用@视频1${videoCount > 1 ? `至@视频${videoCount}` : ""}`);
    if (audioCount) references.push(`参考音频使用@音频1${audioCount > 1 ? `至@音频${audioCount}` : ""}`);
    return references.length ? `${references.join("；")}。\n${prompt}` : prompt;
}
function sizeValue(value: unknown) {
    const text = clean(value);
    return parseImageDimensions(text) ? text.replace(/\s+/g, "") : ratio(value);
}
function billedPointsCost(value: unknown) {
    if (value === null || value === undefined || value === "") return undefined;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : undefined;
}
function videoUnits(raw: Record<string, unknown>, multipliers: Awaited<ReturnType<typeof getAuthSettings>>["generationPointMultipliers"]) {
    const quality = clean(raw.vquality).replace(/p$/i, "") || "480";
    const seconds = String(duration(raw.videoSeconds));
    return (multipliers.videoQuality[quality] || 1) * (multipliers.videoSeconds[seconds] || 1);
}
function clean(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}
function hasProvidedValue(value: unknown) {
    return value !== undefined && value !== null && String(value).trim() !== "";
}
function positiveAttemptNo(value: unknown) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function unique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)));
}
function referenceUrls(items: readonly VideoGenerationReference[], type: VideoGenerationReference["type"]) {
    return unique(items.filter((item) => item.type === type).map((item) => clean(item.url)));
}

function videoReferenceContent(prompt: string, references: readonly VideoGenerationReference[]) {
    return [
        { type: "text", text: prompt },
        ...references.map((reference) =>
            reference.type === "image"
                ? {
                      type: "image_url",
                      role: reference.role === "first_frame" || reference.role === "last_frame" ? reference.role : reference.role === "keyframe" ? "keyframe" : "reference_image",
                      ...(reference.keyframeIndex ? { keyframe_index: reference.keyframeIndex } : {}),
                      image_url: { url: reference.url },
                  }
                : reference.type === "video"
                  ? { type: "video_url", role: "reference_video", video_url: { url: reference.url } }
                  : { type: "audio_url", role: "reference_audio", audio_url: { url: reference.url } },
        ),
    ];
}
function requestPublicOrigin(request: Request) {
    return resolvePublicRequestOrigin(request);
}
function normalizePublicOrigin(value: string) {
    try {
        const url = new URL(value.trim());
        return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
    } catch {
        return "";
    }
}
const MEDIA_KEYS = VIDEO_PROVIDER_MEDIA_KEYS;
const SAFE_CREATE_FAILURE_STATUSES = new Set([400, 401, 403, 404, 405, 413, 415, 422, 429]);

function isSafeCreateFailure(status: number, message: string, body = "") {
    if (SAFE_CREATE_FAILURE_STATUSES.has(status)) return true;
    return status === 503 && /model[\s_-]*not[\s_-]*found|模型(?:不存在|未找到)/i.test(`${message} ${body}`);
}

class SafeCandidateFailure extends Error {}

function assertNewApiVideoContract(parameters: { videoSeconds: number; size: unknown; vquality: unknown }, references: readonly VideoGenerationReference[]) {
    if (!Number.isInteger(parameters.videoSeconds) || parameters.videoSeconds < 4 || parameters.videoSeconds > 15) throw new Error("New API 视频时长需要在 4-15 秒之间");
    const aspectRatio = normalizeVideoAspectRatio(parameters.size);
    if (!NEW_API_VIDEO_RATIOS.includes(aspectRatio as (typeof NEW_API_VIDEO_RATIOS)[number])) throw new Error("New API 视频比例仅支持 16:9、9:16、1:1");
    const videoResolution = resolution(parameters.vquality);
    if (!NEW_API_VIDEO_RESOLUTIONS.includes(videoResolution as (typeof NEW_API_VIDEO_RESOLUTIONS)[number])) throw new Error("New API 视频清晰度仅支持 720p、480p");

    const imageCount = references.filter((reference) => reference.type === "image").length;
    const videoCount = references.filter((reference) => reference.type === "video").length;
    const audioCount = references.filter((reference) => reference.type === "audio").length;
    if (imageCount > 9) throw new Error("New API 视频最多支持 9 张参考图");
    if (videoCount > 3) throw new Error("New API 视频最多支持 3 个参考视频");
    if (audioCount > 3) throw new Error("New API 视频最多支持 3 个参考音频");
    if (references.some((reference) => !isNewApiPublicReferenceUrl(reference.url))) throw new Error("New API 参考素材必须使用公开的 http/https URL");
    assertNewApiReferenceDuration(references, "video", "参考视频");
    assertNewApiReferenceDuration(references, "audio", "参考音频");
}

function assertNewApiReferenceDuration(references: readonly VideoGenerationReference[], type: "video" | "audio", label: string) {
    const media = references.filter((reference) => reference.type === type);
    if (media.some((reference) => !Number.isFinite(reference.durationMs) || !reference.durationMs || reference.durationMs < 1)) throw new Error(`New API ${label}缺少可验证时长`);
    const totalDurationMs = media.reduce((total, reference) => total + reference.durationMs!, 0);
    if (totalDurationMs > 15_000) throw new Error(`New API ${label}总时长不能超过 15 秒`);
}

function isNewApiPublicReferenceUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function serializeVideoProviderRequest(value: unknown) {
    try {
        return serializeProviderRequest(value);
    } catch (error) {
        throw new SafeCandidateFailure(error instanceof Error ? error.message : "视频请求参数无效");
    }
}
