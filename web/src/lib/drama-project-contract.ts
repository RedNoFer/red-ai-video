export type DramaTaskStatus = "idle" | "queued" | "running" | "success" | "error" | "cancelled";
export type DramaReviewStatus = "draft" | "content_review" | "approved" | "visual_ready";
export type DramaVideoMode = "storyboard" | "direct" | "reference";
export type DramaStoryboardFrameMode = "single" | "first_last";
export type DramaShotAudioMode = "source" | "voiceover" | "mute";
export type DramaFieldOrigin = "package" | "manual" | "ai" | "default";
export type DramaContinuityTransition = "continuous" | "match_cut" | "hard_cut" | "scene_change" | "jump_cut";

export type DramaAssetReference = {
    id: string;
    url: string;
    storageKey?: string;
    source: "upload" | "generated" | "library";
    label: string;
    width?: number;
    height?: number;
    createdAt: string;
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

export type DramaVoiceProfile = {
    voice: string;
    speed: number;
    instructions: string;
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
    text: string;
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
    imagePrompt: string;
    videoPrompt: string;
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
    fieldOrigins?: Record<string, DramaFieldOrigin>;
    sourceAssetIds?: string[];
    continuityStatus?: "ready" | "stale" | "blocked" | "needs_review" | "passed";
    continuityError?: string;
    actualStartFrameUrl?: string;
    actualEndFrameUrl?: string;
    duration: number;
    characterIds: string[];
    propIds: string[];
    clueIds: string[];
    sceneId?: string;
    videoMode?: DramaVideoMode;
    storyboardStatus?: DramaTaskStatus;
    storyboardFrameMode?: DramaStoryboardFrameMode;
    storyboardAttempt?: number;
    storyboardTaskId?: string;
    storyboardError?: string;
    storyboardImageUrl?: string;
    storyboardImageWidth?: number;
    storyboardImageHeight?: number;
    storyboardEndStatus?: DramaTaskStatus;
    storyboardEndAttempt?: number;
    storyboardEndTaskId?: string;
    storyboardEndError?: string;
    storyboardEndImageUrl?: string;
    storyboardEndImageWidth?: number;
    storyboardEndImageHeight?: number;
    generationStatus?: DramaTaskStatus;
    generationAttempt?: number;
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
};

export type DramaRenderTask = {
    id: string;
    status: "pending" | "running" | "success" | "error" | "cancelled";
    result?: { url?: string };
    error?: string;
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
            Required<Pick<DramaShot, "startFramePrompt" | "endFramePrompt" | "negativePrompt" | "continuity">> & {
                shotId: string;
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
};

export type DramaProductionPackagePreview = {
    package: DramaProductionPackageV1;
    sourceHash: string;
    format: "json" | "markdown";
    warnings: string[];
    summary: { episodes: number; storyScenes: number; shots: number; characters: number; locations: number; duration: number; archiveSections: number; promptAssets: number };
};

export type DramaProductionRunStatus = "planning" | "ready" | "running" | "paused" | "needs_review" | "completed" | "failed" | "cancelled";
export type DramaProductionStepStatus = "blocked" | "ready" | "running" | "success" | "needs_review" | "failed" | "stale" | "cancelled";
export type DramaProductionStep = {
    id: string;
    shotId?: string;
    type: "asset_anchor" | "start_frame" | "end_frame" | "video" | "extract_frames" | "continuity_qc" | "audio";
    dependsOn: string[];
    status: DramaProductionStepStatus;
    taskId?: string;
    clipIndex?: number;
    duration?: number;
    referenceShotId?: string;
    inputHash?: string;
    outputUrls?: string[];
    error?: string;
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
        videoModel: string;
        audioModel?: string;
        ratio: string;
        maxVideoSeconds?: number;
        imageQuality?: string;
        videoQuality?: string;
    };
    steps: DramaProductionStep[];
    createdAt: string;
    updatedAt: string;
};
