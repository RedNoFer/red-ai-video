import type { GenerationTaskExecutionPhase } from "@/lib/server/generation-task-scheduler";

export type DramaTaskStatus = "idle" | "queued" | "running" | "success" | "error" | "cancelled" | "stale" | "needs_review";
export type DramaReviewStatus = "draft" | "content_review" | "approved" | "visual_ready";
export type DramaVideoMode = "storyboard" | "direct" | "reference";
export type DramaStoryboardFrameMode = "single" | "first_last" | "all_frames";
export type DramaShotAudioMode = "source" | "voiceover" | "mute";
export type DramaFieldOrigin = "package" | "manual" | "ai" | "default";
export type DramaContinuityTransition = "continuous" | "match_cut" | "hard_cut" | "scene_change" | "jump_cut";
export type DramaFrameRole = "storyboard_start" | "storyboard_end" | "storyboard_keyframe" | "actual_start" | "actual_end";
export type DramaFrameEvidenceSource = "package" | "generated" | "upload" | "video_extraction";
export type DramaFrameEvidenceValidity = "candidate" | "accepted" | "rejected" | "superseded" | "unavailable";

export type DramaFrameEvidence = {
    id: string;
    role: DramaFrameRole;
    source: DramaFrameEvidenceSource;
    mediaUrl: string;
    remoteUrl?: string;
    sourceShotId?: string;
    sourceVideoUrl?: string;
    generationRunId?: string;
    generationTaskId?: string;
    assetId?: string;
    contentHash: string;
    validity: DramaFrameEvidenceValidity;
    createdAt: string;
    acceptedAt?: string;
    rejectedAt?: string;
    invalidReason?: string;
    sequenceIndex?: number;
    generationPrompt?: string;
    generationReferences?: DramaImageReferenceBinding[];
};

export type DramaShotFramePlan = {
    start: { source: "independent" | "previous_accepted_actual_tail" };
    end: { required: boolean };
    frames: DramaFrameBeat[];
    referenceManifest?: DramaReferenceManifestItem[];
    referenceCount?: { min: number; max: number };
};

export type DramaFrameBeat = {
    id: string;
    sequenceIndex: number;
    startSecond: number;
    endSecond: number;
    actionPrompt: string;
    imagePrompt: string;
    supplierPrompt?: string;
};

export type DramaImageReferenceBinding = {
    id: string;
    label: string;
    binding: string;
    url: string;
    remoteUrl?: string;
    width?: number;
    height?: number;
};

export type DramaReferenceManifestRole = "previous_actual_tail" | "character_anchor" | "scene_anchor" | "prop_anchor" | "action_keyframe" | "composition_keyframe";
export type DramaReferenceManifestItem = {
    alias: string;
    role: DramaReferenceManifestRole;
    purpose: string;
    assetId?: string;
    shotId?: string;
    frameEvidenceId?: string;
};

export type DramaVideoReferenceBinding = {
    alias: string;
    role: "first_frame" | "last_frame" | "keyframe" | "character_anchor" | "scene_anchor" | "prop_anchor";
    purpose: string;
    sourceId?: string;
    shotId?: string;
    frameId?: string;
    url: string;
    remoteUrl?: string;
    keyframeIndex?: number;
};

export type DramaAssetReference = {
    id: string;
    url: string;
    remoteUrl?: string;
    storageKey?: string;
    source: "upload" | "generated" | "library";
    label: string;
    width?: number;
    height?: number;
    createdAt: string;
    status?: "candidate" | "approved" | "rejected";
    version?: number;
    contentHash?: string;
    approvedAt?: string;
    promptVersion?: number;
    compiledPrompt?: string;
    promptChanges?: DramaAssetRefinementChange[];
    logicalModelId?: string;
    generationTaskId?: string;
    generationStage?: "initial" | "refinement";
    reviewStatus?: "pending" | "reviewing" | "passed" | "needs_revision" | "rejected" | "unavailable";
    reviewSummary?: string;
    reviewIssues?: Array<{ category: string; severity: "low" | "medium" | "high"; message: string; correction?: string }>;
    refinement?: DramaAssetRefinementProposal;
};

export type DramaAssetGenerationBatchStatus = "queued" | "running" | "completed" | "partial_failed" | "failed" | "cancelled";
export type DramaAssetGenerationItemStatus = "queued" | "running" | "success" | "error" | "cancelled";
export type DramaAssetGenerationBatchItem = {
    id: string;
    kind: "characters" | "scenes" | "props";
    outputType: "reference_image" | "character_voice";
    assetId: string;
    assetName: string;
    prompt: string;
    status: DramaAssetGenerationItemStatus;
    generationTaskId?: string;
    generationTaskStatus?: "pending" | "running" | "success" | "error" | "paused" | "cancelled";
    generationExecutionPhase?: GenerationTaskExecutionPhase;
    generationLastUpstreamStatus?: string;
    planningStatus?: "queued" | "running" | "success" | "error";
    previewTaskId?: string;
    voiceId?: string;
    candidateReferenceId?: string;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    attempt: number;
    missingItems?: Array<{ key: string; label: string; task: "planning" | "voice" | "reference" }>;
    planningError?: string;
    voiceError?: string;
    referenceError?: string;
    voiceStatus?: "not_applicable" | "queued" | "running" | "success" | "error";
    referenceStatus?: "not_applicable" | "queued" | "running" | "candidate" | "primary" | "error";
};
export type DramaAssetGenerationBatch = {
    id: string;
    projectId: string;
    status: DramaAssetGenerationBatchStatus;
    executionConfig?: Record<string, unknown>;
    totalCount: number;
    completedCount: number;
    successCount: number;
    failedCount: number;
    cancelledCount: number;
    currentItemId?: string;
    items: DramaAssetGenerationBatchItem[];
    createdAt: string;
    updatedAt: string;
};

export type DramaAssetProfile = {
    visualIdentity: string;
    styling: string;
    colorPalette: string;
    consistencyRules: string;
    designPrompt?: string;
    identityAnchors?: string[];
    spatialRules?: string[];
    stateRules?: string[];
    forbiddenChanges?: string[];
};

export type DramaAssetRefinementChange = {
    field: "description" | "visualIdentity" | "styling" | "colorPalette" | "consistencyRules";
    before: string;
    after: string;
    reason: string;
};

export type DramaAssetRefinementProposal = {
    reply: string;
    changes: DramaAssetRefinementChange[];
    updatedDescription?: string;
    updatedProfile: DramaAssetProfile;
    compiledPrompt: string;
    negativePrompt: string;
    preservedRules: string[];
};

export type DramaAssetRefinementMessage = {
    id: string;
    request: string;
    reply: string;
    proposal: DramaAssetRefinementProposal;
    createdAt: string;
};

export type DramaVoiceIdentityType = "provider" | "custom" | "parameterized";
export type DramaVoiceStatus = "unassigned" | "assigned" | "unavailable" | "needs_review";
export type DramaVoiceAssignmentSource = "manual" | "auto" | "gpt";
export type DramaVoiceCreationMode = "design" | "clone";
export type DramaVoiceCreationStatus = "idle" | "queued" | "running" | "success" | "error";
export type DramaVoiceBlueprint = {
    age?: string;
    register?: string;
    temperament?: string;
    emotionalRange?: string;
    texture?: string;
};

export type DramaVoiceProfile = {
    /** @deprecated 仅用于读取旧快照，业务调用必须使用 voiceId。 */
    voice?: string;
    identityType?: DramaVoiceIdentityType;
    provider?: string;
    model?: string;
    logicalModelId?: string;
    channelId?: string;
    voiceId?: string;
    status?: DramaVoiceStatus;
    blueprint?: DramaVoiceBlueprint;
    sampleAssetId?: string;
    assignedAt?: string;
    assignmentSource?: DramaVoiceAssignmentSource;
    blueprintVersion?: number;
    speed: number;
    instructions: string;
    previewStatus?: "idle" | "queued" | "running" | "success" | "error" | "stale";
    previewTaskId?: string;
    previewLogicalModelId?: string;
    previewChannelId?: string;
    previewAudioUrl?: string;
    previewText?: string;
    previewFingerprint?: string;
    previewError?: string;
    creationMode?: DramaVoiceCreationMode;
    designPrompt?: string;
    creationTaskId?: string;
    creationStatus?: DramaVoiceCreationStatus;
    creationSampleAssetId?: string;
    creationFingerprint?: string;
    creationError?: string;
};

export type DramaNamedAsset = {
    id: string;
    code?: string;
    name: string;
    description: string;
    fieldOrigins?: Record<string, DramaFieldOrigin>;
    activeEpisodeCodes?: string[];
    profile?: DramaAssetProfile;
    references?: DramaAssetReference[];
    primaryReferenceId?: string;
    referenceImageUrl?: string;
    referenceStorageKey?: string;
    refinementHistory?: DramaAssetRefinementMessage[];
};

export type DramaCharacter = DramaNamedAsset & { voiceProfile?: DramaVoiceProfile };
export type DramaScene = DramaNamedAsset;
export type DramaLocation = DramaScene;
export type DramaProp = DramaNamedAsset;
export type DramaClue = DramaNamedAsset & { payoff: string };

export type DramaShotContinuity = {
    shotSize: string;
    cameraAngle: string;
    composition: string;
    characterBlocking: string;
    gazeDirection: string;
    actionStart: string;
    actionEnd: string;
    screenDirection: string;
    axisRule: string;
    continuityNotes: string;
};

export type DramaContinuityEntityState = {
    assetId: string;
    wardrobe?: string;
    position?: string;
    gaze?: string;
    pose?: string;
    expression?: string;
    action?: string;
    state?: string;
    holderId?: string;
};

export type DramaContinuityState = {
    characters: DramaContinuityEntityState[];
    props: DramaContinuityEntityState[];
    environment?: string;
    lighting?: string;
    axis?: string;
    screenDirection?: string;
};

export type DramaContinuityEdge = {
    fromShotId: string;
    toShotId: string;
    transition: DramaContinuityTransition;
    inheritActualEndFrame: boolean;
    carryCharacterIds: string[];
    carryPropIds: string[];
    carryEnvironment: boolean;
    carryAxis: boolean;
    notes?: string;
};

export type DramaStoryScene = {
    id: string;
    code?: string;
    order: number;
    title: string;
    timeOfDay?: string;
    timeRange?: string;
    locationId?: string;
    summary: string;
    shotIds: string[];
    fieldOrigins?: Record<string, DramaFieldOrigin>;
};

export type DramaProductionBible = {
    targetPlatform?: string;
    language: string;
    ratio: string;
    targetDuration?: number;
    visualStyle: string;
    colorScript?: string;
    soundBible?: string;
    globalNegativePrompt?: string;
    subtitleSafeArea?: string;
    continuityMode: "strict" | "balanced";
    productionPlan?: DramaProductionPlan;
};

export type DramaProductionPlan = {
    version: "drama-production-plan-v1";
    skills: Array<{ id: string; name: string; version: string }>;
    video: {
        model: string;
        channelId?: string;
        mode: "storyboard" | "reference" | "first-frame" | "first-last" | "text-to-video";
        ratio: string;
        resolution: string;
        durationPolicy: "shot" | "fixed";
        duration?: number;
        /** Target duration of each logical shot in the production package. */
        shotDuration?: 15 | 30;
        count: number;
        audioMode: "native" | "voiceover" | "mute";
        allowExplicitFallback: boolean;
        modelParameters?: Record<string, unknown>;
    };
    references: {
        strategy: "adaptive";
        minImages: number;
        maxImages: number;
        roles: DramaReferenceManifestRole[];
    };
    continuity: {
        mode: "strict" | "balanced";
        requireAcceptedActualTail: boolean;
    };
    lockedAt?: string;
    source: "new-project" | "package" | "manual";
};

export type DramaSeriesBible = {
    version: "series-bible-v1";
    canonCharacters: string[];
    immutableRules: string[];
    relationshipState: string;
    worldRules: string[];
    unresolvedThreads: string[];
    visualMotifs: string[];
    soundMotifs: string[];
    previousEpisodeExitState?: DramaContinuityState;
};

export type DramaProductionArchive = {
    formatVersion: "vozeb-drama-production-package-v1";
    sections: Array<{ code: string; title: string; content: string }>;
    promptAssets: Array<{ code: string; category: "keyframe" | "storyboard"; title: string; prompt: string; shotCodes: string[] }>;
    dialogueDirections: Array<{ id: string; shotCode: string; speaker: string; text: string; performance: string; lipSync: boolean }>;
    voiceDirections: Array<{ subject: string; direction: string }>;
    silenceDirections: Array<{ shotCode: string; direction: string }>;
    referencePlan: Array<{ priority: number; asset: string; purpose: string; planType: string; shotCodes: string[] }>;
    generationOrder: string[];
    qcReport: string;
};

export type DramaShotSound = {
    ambience?: string;
    soundEffects?: string;
    music?: string;
};

export type DramaUtterance = {
    id: string;
    order: number;
    type: "dialogue" | "voiceover";
    speaker: string;
    characterId?: string;
    text: string;
};

export type DramaPerformanceBeat = {
    emotion: string;
    facialAction: string;
    gaze: string;
    bodyAction: string;
};

export type DramaPerformancePlan = {
    emotionalObjective: string;
    emotionalArc: string;
    speechStyle: string;
    pace: string;
    breath: string;
    restraintLevel: string;
    beats: {
        start: DramaPerformanceBeat;
        middle: DramaPerformanceBeat;
        end: DramaPerformanceBeat;
    };
};

export type DramaDialoguePerformance = {
    utteranceId: string;
    intent: string;
    tone: string;
    pace: string;
    pause: string;
    emphasis: string;
    facialReactionBefore: string;
    facialReactionDuring: string;
    facialReactionAfter: string;
};

export type DramaLightingPlan = {
    palette: string;
    colorTemperature: string;
    keyLight: string;
    fillLight: string;
    rimLight: string;
    contrast: string;
    materialResponse: string;
    skinToneProtection: string;
    inheritFromPrevious: string;
    transitionToNext: string;
};

export type DramaStoryboardFrame = {
    id: string;
    sequenceIndex: number;
    mediaUrl?: string;
    remoteUrl?: string;
    width?: number;
    height?: number;
    source: DramaFrameEvidenceSource;
    status: DramaTaskStatus;
    taskId?: string;
    error?: string;
    inputHash?: string;
    continuityStatus?: "pending" | "passed" | "needs_review" | "stale";
    continuityEvidenceId?: string;
    generationPrompt?: string;
    generationReferences?: DramaImageReferenceBinding[];
    candidateStatus?: DramaTaskStatus;
    candidateTaskId?: string;
    candidateError?: string;
    candidates?: DramaStoryboardFrameCandidate[];
};

export type DramaStoryboardFrameCandidate = {
    id: string;
    mediaUrl: string;
    remoteUrl?: string;
    width?: number;
    height?: number;
    source: DramaFrameEvidenceSource;
    taskId?: string;
    createdAt: string;
    continuityStatus?: "pending" | "passed" | "needs_review";
    continuityEvidenceId?: string;
    error?: string;
    generationPrompt?: string;
    generationReferences?: DramaImageReferenceBinding[];
};

export type DramaShot = {
    id: string;
    code?: string;
    order: number;
    title: string;
    description: string;
    sourceText: string;
    shotBoundary: string;
    dialogue: string;
    narration: string;
    utterances: DramaUtterance[];
    performancePlan?: DramaPerformancePlan;
    dialoguePerformance?: DramaDialoguePerformance[];
    lightingPlan?: DramaLightingPlan;
    imagePrompt: string;
    videoPrompt: string;
    executionVideoPrompt?: string;
    executionImagePrompt?: string;
    cameraMotion: string;
    startFramePrompt?: string;
    endFramePrompt?: string;
    negativePrompt?: string;
    continuity?: DramaShotContinuity;
    storySceneId?: string;
    timecode?: string;
    dramaticFunction?: string;
    lens?: string;
    lighting?: string;
    colorPalette?: string;
    transitionIn?: string;
    transitionOut?: string;
    performanceNotes?: string;
    sound?: DramaShotSound;
    entryState?: DramaContinuityState;
    exitState?: DramaContinuityState;
    framePlan?: DramaShotFramePlan;
    frameEvidence?: DramaFrameEvidence[];
    fieldOrigins?: Record<string, DramaFieldOrigin>;
    sourceAssetIds?: string[];
    continuityStatus?: "ready" | "stale" | "blocked" | "needs_review" | "passed";
    continuityError?: string;
    actualStartFrameUrl?: string;
    actualEndFrameUrl?: string;
    actualFrameVideoUrl?: string;
    duration: number;
    characterIds: string[];
    propIds: string[];
    clueIds: string[];
    sceneId?: string;
    videoMode?: DramaVideoMode;
    storyboardStatus?: DramaTaskStatus;
    storyboardFrameMode?: DramaStoryboardFrameMode;
    storyboardFrames?: DramaStoryboardFrame[];
    storyboardAttempt?: number;
    storyboardTaskId?: string;
    storyboardError?: string;
    storyboardImageUrl?: string;
    storyboardImageRemoteUrl?: string;
    storyboardImageUrls?: string[];
    storyboardImageWidth?: number;
    storyboardImageHeight?: number;
    storyboardImageDeletedAt?: string;
    storyboardPrompt?: string;
    storyboardEndStatus?: DramaTaskStatus;
    storyboardEndAttempt?: number;
    storyboardEndTaskId?: string;
    storyboardEndError?: string;
    storyboardEndImageUrl?: string;
    storyboardEndImageRemoteUrl?: string;
    storyboardEndImageUrls?: string[];
    storyboardEndImageWidth?: number;
    storyboardEndImageHeight?: number;
    storyboardEndImageDeletedAt?: string;
    storyboardEndPrompt?: string;
    generationStatus?: DramaTaskStatus;
    generationAttempt?: number;
    generationRunId?: string;
    generationTaskId?: string;
    generationError?: string;
    videoUrl?: string;
    subtitle?: string;
    audioMode?: DramaShotAudioMode;
    audioStatus?: DramaTaskStatus;
    audioAttempt?: number;
    audioTaskId?: string;
    audioError?: string;
    audioUrl?: string;
    characterId?: string;
    voiceIdentityId?: string;
    voiceId?: string;
    voiceBlueprintVersion?: number;
    voiceAssignmentSource?: DramaVoiceAssignmentSource;
};

export type DramaRenderTask = {
    id: string;
    status: "pending" | "running" | "success" | "error" | "cancelled";
    result?: { url?: string };
    error?: string;
};

export type DramaReviewCompletionTask = {
    id: string;
    status: "running" | "success" | "error";
    missingCount: number;
    completedCount: number;
    message?: string;
    error?: string;
    startedAt: string;
    updatedAt: string;
    completedAt?: string;
};

export type DramaVisualReview = {
    mode: "visual" | "text" | "unavailable";
    status: "passed" | "needs_revision" | "unavailable";
    score?: number;
    summary: string;
    issues: Array<{ taskId?: string; category: string; severity: "low" | "medium" | "high"; message: string; correction?: string }>;
    retryTaskIds: string[];
};

export type DramaEpisode = {
    id: string;
    code?: string;
    canvasProjectId?: string;
    title: string;
    script: string;
    scriptRichContent?: import("@/lib/drama-script-rich-content").DramaScriptRichContent;
    outline: string;
    hook: string;
    nextPreview: string;
    sourceRange: string;
    reviewStatus: DramaReviewStatus;
    storyScenes?: DramaStoryScene[];
    continuityEdges?: DramaContinuityEdge[];
    fieldOrigins?: Record<string, DramaFieldOrigin>;
    shots: DramaShot[];
    renderTask?: DramaRenderTask;
    reviewCompletionTask?: DramaReviewCompletionTask;
    visualReview?: DramaVisualReview;
};

export type DramaSourceAsset = {
    id: string;
    type: "text" | "image" | "video" | "audio";
    title: string;
    textContent?: string;
    storageKey?: string;
    remoteUrl?: string;
    serverUrl?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    sourceHash?: string;
};

export type DramaProject = {
    id: string;
    sourceHandoffId?: string;
    title: string;
    summary: string;
    style: string;
    ratio: string;
    productionBible?: DramaProductionBible;
    seriesBible?: DramaSeriesBible;
    productionArchive?: DramaProductionArchive;
    fieldOrigins?: Record<string, DramaFieldOrigin>;
    status: "active" | "archived";
    creativeConversationId?: string;
    activeEpisodeId?: string;
    characters: DramaCharacter[];
    scenes: DramaScene[];
    props: DramaProp[];
    clues: DramaClue[];
    defaultVideoMode: DramaVideoMode;
    episodes: DramaEpisode[];
    sourceAssets?: DramaSourceAsset[];
    createdAt: string;
    updatedAt: string;
};

export type DramaProjectSummary = Pick<DramaProject, "id" | "title" | "summary" | "style" | "ratio" | "status" | "createdAt" | "updatedAt"> & {
    episodeCount: number;
    characterCount: number;
    sceneCount: number;
    shotCount: number;
    pendingTaskCount: number;
    failedTaskCount: number;
};

export type DramaProjectSummaryPage = {
    items: DramaProjectSummary[];
    total: number;
    page: number;
    pageSize: number;
};

export type CreateDramaProjectInput = Pick<DramaProject, "title" | "summary" | "style" | "ratio"> & {
    sourceHandoffId?: string;
    initialScript?: string;
    sourceAssets?: DramaSourceAsset[];
    defaultVideoMode?: DramaVideoMode;
};

export type DramaContentAnalysis = {
    episode: Pick<DramaEpisode, "outline" | "hook" | "nextPreview" | "sourceRange">;
    characters: Array<Omit<DramaCharacter, "id">>;
    scenes: Array<Omit<DramaScene, "id">>;
    props: Array<Omit<DramaProp, "id">>;
    clues: Array<Omit<DramaClue, "id">>;
    shots: Array<
        Pick<DramaShot, "title" | "description" | "sourceText" | "shotBoundary" | "dialogue" | "narration" | "utterances" | "duration"> & {
            characterNames: string[];
            propNames: string[];
            clueNames: string[];
            sceneName: string;
        }
    >;
};

export type DramaVisualAnalysis = {
    shots: Array<
        Pick<DramaShot, "imagePrompt" | "videoPrompt" | "cameraMotion"> &
            Required<Pick<DramaShot, "startFramePrompt" | "endFramePrompt" | "negativePrompt" | "continuity" | "performancePlan" | "dialoguePerformance" | "lightingPlan" | "framePlan">> & {
                shotId: string;
            }
    >;
};

export type DramaVideoPromptAnalysis = {
    shots: Array<{ shotId: string; videoPrompt: string }>;
};

export type DramaImagePromptAnalysis = {
    shots: Array<{ shotId: string; imagePrompt: string }>;
};

export type DramaReviewCompletion = {
    shots: Array<
        Pick<DramaShot, "performancePlan" | "dialoguePerformance" | "lightingPlan" | "continuity" | "entryState" | "exitState"> & {
            shotId: string;
            continuityEdge?: Omit<DramaContinuityEdge, "fromShotId" | "toShotId"> & { fromShotId: string; toShotId: string };
        }
    >;
};

export type DramaProjectVersion = {
    id: string;
    projectId: string;
    version: number;
    reason: string;
    createdAt: string;
};

export type DramaCostSummary = {
    estimatedPoints: number;
    actualPoints: number;
    taskCount: number;
    successCount: number;
    failedCount: number;
    byType: Partial<Record<"image" | "video" | "audio", { tasks: number; estimatedPoints: number; actualPoints: number }>>;
};

export type DramaProductionPackageAsset = {
    code: string;
    name: string;
    description: string;
    profile?: DramaAssetProfile;
    payoff?: string;
    activeEpisodeCodes?: string[];
    fieldOrigins?: Record<string, DramaFieldOrigin>;
};

export type DramaProductionPackageShot = Omit<DramaShot, "id" | "characterIds" | "propIds" | "clueIds" | "sceneId" | "storySceneId"> & {
    code: string;
    characterCodes: string[];
    propCodes: string[];
    clueCodes: string[];
    locationCode?: string;
    storySceneCode?: string;
    framePlan: DramaShotFramePlan;
};

export type DramaProductionPackageEpisode = {
    code: string;
    title: string;
    script: string;
    outline: string;
    hook: string;
    nextPreview: string;
    sourceRange: string;
    storyScenes: Array<Omit<DramaStoryScene, "id" | "shotIds"> & { code: string; locationCode?: string; shotCodes: string[] }>;
    shots: DramaProductionPackageShot[];
    continuityEdges: Array<Omit<DramaContinuityEdge, "fromShotId" | "toShotId"> & { fromShotCode: string; toShotCode: string }>;
};

export type DramaProductionPackageV1 = {
    schemaVersion: 1;
    project: {
        title: string;
        summary: string;
        style: string;
        ratio: string;
        productionBible: DramaProductionBible;
    };
    assets: {
        characters: DramaProductionPackageAsset[];
        locations: DramaProductionPackageAsset[];
        props: DramaProductionPackageAsset[];
        clues: DramaProductionPackageAsset[];
    };
    episodes: DramaProductionPackageEpisode[];
    archive?: DramaProductionArchive;
    seriesBible?: DramaSeriesBible;
};

export type DramaProductionPackagePreview = {
    package: DramaProductionPackageV1;
    sourceHash: string;
    format: "json" | "markdown";
    warnings: string[];
    summary: {
        episodes: number;
        storyScenes: number;
        shots: number;
        characters: number;
        locations: number;
        duration: number;
        archiveSections: number;
        promptAssets: number;
        performancePlans: number;
        lightingPlans: number;
        continuityPlans: number;
    };
};

export type DramaProductionRunStatus = "planning" | "ready" | "running" | "paused" | "needs_review" | "completed" | "failed" | "cancelled";
export type DramaProductionStepStatus = "blocked" | "ready" | "running" | "success" | "needs_review" | "failed" | "stale" | "cancelled";
export type DramaProductionStep = {
    id: string;
    shotId?: string;
    type: "asset_anchor" | "start_frame" | "end_frame" | "keyframe" | "video" | "extract_frames" | "continuity_qc" | "audio";
    dependsOn: string[];
    status: DramaProductionStepStatus;
    attemptNo?: number;
    taskId?: string;
    clipIndex?: number;
    sequenceIndex?: number;
    duration?: number;
    referenceShotId?: string;
    inputHash?: string;
    outputUrls?: string[];
    outputRemoteUrls?: string[];
    error?: string;
    assetId?: string;
    assetKind?: "characters" | "scenes" | "props";
    title?: string;
    prompt?: string;
    executionPrompt?: string;
    referenceAssetIds?: string[];
    referenceImageUrls?: string[];
    referenceImageRemoteUrls?: Array<string | undefined>;
    referenceManifest?: DramaReferenceManifestItem[];
    referenceBindingsSnapshot?: DramaVideoReferenceBinding[];
    referenceImagesSnapshot?: DramaImageReferenceBinding[];
    frameId?: string;
    startSecond?: number;
    endSecond?: number;
    continuityEvidenceId?: string;
    outputWidth?: number;
    outputHeight?: number;
};
export type DramaProductionRun = {
    id: string;
    projectId: string;
    episodeId: string;
    planRevision: string;
    status: DramaProductionRunStatus;
    mode: "strict" | "balanced";
    parameterSnapshot: {
        imageModel: string;
        imageChannelId?: string;
        videoModel: string;
        videoChannelId?: string;
        audioModel?: string;
        ratio: string;
        maxVideoSeconds?: number;
        imageQuality?: string;
        videoQuality?: string;
        productionPlan?: DramaProductionPlan;
        modelParameters?: Record<string, unknown>;
    };
    steps: DramaProductionStep[];
    scope?: "visual";
    confirmedAt?: string;
    blockers?: string[];
    preflightSnapshot?: {
        checkedShotIds: string[];
        issues: DramaProductionPreflightIssue[];
        changeSummary: string[];
        prompts: Record<string, { sourceImagePrompt: string; sourceVideoPrompt: string; executionImagePrompt: string; executionVideoPrompt: string }>;
    };
    createdAt: string;
    updatedAt: string;
};

export type DramaProductionPreflightIssue = {
    code: string;
    severity: "blocking" | "warning";
    message: string;
    shotId?: string;
    assetId?: string;
    correction?: string;
};

export type DramaProductionPreflight = {
    status: "passed" | "needs_confirmation" | "blocked";
    issues: DramaProductionPreflightIssue[];
    revisedPrompts?: Record<string, { imagePrompt?: string; videoPrompt?: string }>;
    changeSummary?: string[];
    checkedShotIds?: string[];
};
