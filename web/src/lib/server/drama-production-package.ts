import { createHash } from "node:crypto";

import { nanoid } from "nanoid";

import type {
    DramaContinuityEdge,
    DramaContinuityEntityState,
    DramaBackgroundNpcPolicy,
    DramaBackgroundNpcSlot,
    DramaEpisode,
    DramaFieldOrigin,
    DramaNamedAsset,
    DramaProductionPackageAsset,
    DramaProductionPackageAuthoring,
    DramaProductionPackageAuthoringMaterial,
    DramaProductionPackageEpisode,
    DramaProductionPackagePreview,
    DramaProductionPackageV1,
    DramaProductionBible,
    DramaProductionLock,
    DramaProject,
    DramaAuthoringSourceSnapshot,
    DramaAuthoringAudit,
    DramaQualityGateCheck,
    DramaQualityGateReport,
    DramaReferenceManifestRole,
    DramaSeriesBible,
    DramaShot,
    DramaStoryScene,
} from "@/lib/drama-project-contract";
import { continuityStateChangeIsIntentional, validateDramaContinuityEdges } from "@/lib/drama-continuity-policy";
import { defaultDramaProductionPlan, normalizeDramaProductionPlan } from "@/lib/drama-production-plan";
import {
    dramaStaticFramePositiveText,
    formatPromptFieldLines,
    normalizeDramaFrameBeats,
    validateDramaFrameVisualContent,
    validateDramaFramePlanVisuals,
    warnDramaFrameCountUniformity,
    warnDramaFramePlanVisuals,
    warnDramaFrameVisualContent,
} from "@/lib/drama-frame-sequence";
import { dramaDialogueFragmentSequenceError, dramaDialogueTimingReminder, dramaFrameDialogueTimingReminder, dramaUtteranceTimingIssues, type DramaDialogueTimingInput } from "@/lib/drama-dialogue-timing";
import { resolveDramaStyleContract } from "@/lib/drama-style";
import { normalizeDramaCharacterProfile } from "@/lib/drama-character-rules";
import { compileDramaAssetReferencePrompt } from "@/lib/drama-prompt-compiler";
import { resolveDramaShotDuration } from "@/lib/server/drama-shot-config";
import {
    dramaTimeRangePattern,
    extractDramaVideoPromptSection,
    hasConcreteDramaCameraDirection,
    isGenericDramaDetail,
    validateDramaCameraPlan,
    validateDramaFrameTiming,
    validateDramaPerformanceDetail,
    validateDramaVideoAuthoringQuality,
    validateDramaVideoPromptCardLayout,
    validateDramaVideoSegmentDetail,
} from "@/lib/drama-prompt-quality";
import { DRAMA_VIDEO_DIRECTOR_SKILL } from "@/lib/server/agent-skills/drama-video-director";
import { SEEDANCE_25_DIRECTOR_SKILL } from "@/lib/server/agent-skills/seedance-25";
import { DRAMA_PACKAGE_CONTRACT, DRAMA_PACKAGE_CONTRACT_ID, DRAMA_PACKAGE_CONTRACT_VERSION, DRAMA_PACKAGE_GATE_CODES } from "@/lib/server/drama-production-package-contract";
import { validateDramaAuthoringQuality } from "@/lib/server/drama-production-package-quality";

export class DramaProductionPackageError extends Error {}

type DramaProjectAssetCollection = Pick<DramaProject, "title" | "style" | "ratio" | "productionBible" | "characters" | "scenes" | "props" | "clues">;

export type DramaProductionPackageNormalizationOptions = {
    validateVideoPrompt?: boolean;
    requireCameraPlan?: boolean;
    requireContentQuality?: boolean;
    requireAgentAuthoring?: boolean;
    requireAuthoringQuality?: boolean;
    allowImportWarnings?: boolean;
    /** Enforce the current authoring continuity contract before state synchronization. */
    strictContinuity?: boolean;
    /** Keep standalone Codex videoPrompt bytes unchanged during import normalization. */
    preserveAuthoredVideoPrompt?: boolean;
    /** Internal boundary: standalone imports perform structural safety checks only. */
    standaloneImport?: boolean;
    importWarnings?: string[];
    authoringSources?: import("@/lib/drama-project-contract").DramaAuthoringSourceSnapshot[];
    targetNarrativeChapter?: number | string;
};

/**
 * Builds the stable, non-media asset catalog that a chapter package must reuse.
 * URLs stay out of the planner context; the project IDs and reference status are
 * enough for the later server-side binding step.
 */
export function buildDramaAssetReuseContext(project: DramaProjectAssetCollection, episode?: Pick<DramaEpisode, "code" | "shots">) {
    const usedIds = new Set((episode?.shots || []).flatMap((shot) => [...(shot.characterIds || []), ...(shot.propIds || []), ...(shot.sceneId ? [shot.sceneId] : []), ...(shot.clueIds || [])]));
    return {
        rule: "项目固定资产优先复用；已有资产的身份、轮廓、材质、基准图和稳定编码不得重设计。只有当前章节明确新增且完成资产登记时才可增加新资产。",
        episodeCode: episode?.code || "",
        characters: catalogAssets(project.characters, "C", usedIds),
        locations: catalogAssets(project.scenes, "S", usedIds),
        props: catalogAssets(project.props, "P", usedIds),
        clues: catalogAssets(project.clues, "L", usedIds),
    };
}

function catalogAssets(items: DramaNamedAsset[], prefix: string, usedIds: Set<string>) {
    const codes = allocateAssetCodes(items, prefix);
    return items.map((asset, index) => ({
        code: codes[index],
        id: asset.id,
        name: asset.name,
        description: asset.description,
        ...(asset.supplierPrompt ? { supplierPrompt: asset.supplierPrompt } : {}),
        profile: asset.profile,
        fixed: true,
        usedInCurrentEpisode: usedIds.has(asset.id),
        activeEpisodeCodes: asset.activeEpisodeCodes || [],
        references: (asset.references || []).map((reference) => ({ id: reference.id, label: reference.label, status: reference.status, reviewStatus: reference.reviewStatus })),
        primaryReferenceId: asset.primaryReferenceId,
        ...(asset.sceneReferenceBoard ? { sceneReferenceBoard: asset.sceneReferenceBoard } : {}),
        ...(asset.backgroundNpcPolicy ? { backgroundNpcPolicy: asset.backgroundNpcPolicy } : {}),
    }));
}

function allocateAssetCodes(items: DramaNamedAsset[], prefix: string) {
    const used = new Set(items.map((asset) => asset.code).filter((code): code is string => Boolean(code)));
    let next = 1;
    return items.map((asset) => {
        if (asset.code) return asset.code;
        while (used.has(`${prefix}${String(next).padStart(2, "0")}`)) next += 1;
        const code = `${prefix}${String(next).padStart(2, "0")}`;
        used.add(code);
        next += 1;
        return code;
    });
}

/** Keep project-registered assets in a generated package and preserve their facts. */
export function mergeProjectAssetsIntoProductionPackage<T extends DramaProductionPackageV1>(value: T, project: DramaProjectAssetCollection): T {
    const assets = value.assets || { characters: [], locations: [], props: [], clues: [] };
    const episodeCodes = new Set((value.episodes || []).map((episode) => episode.code).filter(Boolean));
    const referenced = {
        C: new Set((value.episodes || []).flatMap((episode) => episode.shots.flatMap((shot) => shot.characterCodes))),
        S: new Set((value.episodes || []).flatMap((episode) => episode.shots.flatMap((shot) => (shot.locationCode ? [shot.locationCode] : [])))),
        P: new Set((value.episodes || []).flatMap((episode) => episode.shots.flatMap((shot) => shot.propCodes))),
        L: new Set((value.episodes || []).flatMap((episode) => episode.shots.flatMap((shot) => shot.clueCodes))),
    };
    return {
        ...value,
        assets: {
            ...assets,
            characters: mergeProjectAssetCollection(assets.characters, project.characters, "C", referenced.C, episodeCodes, project, "角色"),
            locations: mergeProjectAssetCollection(assets.locations, project.scenes, "S", referenced.S, episodeCodes, project, "场景"),
            props: mergeProjectAssetCollection(assets.props, project.props, "P", referenced.P, episodeCodes, project, "道具"),
            clues: mergeProjectAssetCollection(assets.clues, project.clues, "L", referenced.L, episodeCodes),
        },
    };
}

function mergeProjectAssetCollection(incoming: DramaProductionPackageAsset[], existing: DramaNamedAsset[], prefix: string, referenced: Set<string>, episodeCodes: Set<string>, project?: DramaProjectAssetCollection, kind?: "角色" | "场景" | "道具") {
    const codes = allocateAssetCodes(existing, prefix);
    const existingWithCodes = existing.map((asset, index) => ({ asset, code: codes[index] }));
    const byCode = new Map(incoming.map((asset) => [asset.code, asset]));
    const byName = new Map(incoming.map((asset) => [normalizeKey(asset.name), asset]));
    const merged = existingWithCodes.map(({ asset, code }) => {
        const current = asset.code ? byCode.get(code) || byName.get(normalizeKey(asset.name)) : byName.get(normalizeKey(asset.name)) || byCode.get(code);
        const activeEpisodeCodes = asset.activeEpisodeCodes?.length ? asset.activeEpisodeCodes : current?.activeEpisodeCodes;
        const merged = {
            ...(current || {}),
            code,
            name: asset.name,
            description: asset.description,
            ...(asset.supplierPrompt || current?.supplierPrompt ? { supplierPrompt: asset.supplierPrompt || current?.supplierPrompt } : {}),
            ...(asset.profile ? { profile: asset.profile } : current?.profile ? { profile: current.profile } : {}),
            ...(asset.sceneReferenceBoard || current?.sceneReferenceBoard ? { sceneReferenceBoard: asset.sceneReferenceBoard || current?.sceneReferenceBoard } : {}),
            ...(asset.backgroundNpcPolicy || current?.backgroundNpcPolicy ? { backgroundNpcPolicy: asset.backgroundNpcPolicy || current?.backgroundNpcPolicy } : {}),
            ...(activeEpisodeCodes?.length || referenced.has(code) ? { activeEpisodeCodes: [...new Set([...(activeEpisodeCodes || []), ...(referenced.has(code) ? episodeCodes : [])])] } : {}),
        } as DramaProductionPackageAsset;
        if (!merged.supplierPrompt && project && kind) {
            merged.supplierPrompt = compileDramaAssetReferencePrompt(project, { id: `package-${code}`, ...merged }, kind);
        }
        return merged;
    });
    const existingKeys = new Set(existingWithCodes.flatMap(({ asset, code }) => [code, normalizeKey(asset.name)]));
    return [...merged, ...incoming.filter((asset) => !existingKeys.has(asset.code) && !existingKeys.has(normalizeKey(asset.name)))];
}

export function previewDramaProductionPackage(source: string, fileName = "production-package.json", project?: DramaProjectAssetCollection, options: DramaProductionPackageNormalizationOptions = {}): DramaProductionPackagePreview {
    const trimmed = source.trim();
    if (!trimmed) throw new DramaProductionPackageError("制作包内容不能为空");
    const embedded = trimmed.match(/```(?:json|drama-production-package)[ \t]*\r?\n([\s\S]*?)```/i)?.[1];
    const format = fileName.toLowerCase().endsWith(".json") || trimmed.startsWith("{") ? "json" : "markdown";
    // The serialized Markdown embeds the canonical package object. Prefer it so
    // preview and apply use the same normalized source of truth.
    const parsed = format === "markdown" ? parseObject(embedded || "") || parseObject((embedded || "").replace(/\\u0060/gu, "`")) : parseObject(trimmed);
    if (!parsed) throw new DramaProductionPackageError("Markdown 制作包必须嵌入标准清单 JSON；不会从旧镜头表重建制作包");
    return previewDramaProductionPackageObject(parsed, project, options, createHash("sha256").update(source).digest("hex"), format);
}

/**
 * Structured authoring is already the canonical package object. Keep it on
 * the object path so authoring does not pay for a Markdown round trip before
 * the quality gate. Markdown remains a deterministic projection performed
 * only after this path passes.
 */
export function previewDramaProductionPackageObject(
    source: unknown,
    project?: DramaProjectAssetCollection,
    options: DramaProductionPackageNormalizationOptions = {},
    sourceHash?: string,
    format: "json" | "markdown" = "json",
): DramaProductionPackagePreview {
    const parsed = object(source);
    if (!Object.keys(parsed).length) throw new DramaProductionPackageError("制作包内容不能为空");
    const packageWithProjectAssets = project ? mergeProjectAssetsIntoProductionPackage(parsed as DramaProductionPackageV1, project) : parsed;
    const importWarnings: string[] = [];
    const normalizedPackage = normalizeProductionPackage(packageWithProjectAssets, { ...options, importWarnings });
    const productionPackage = normalizedPackage;
    const allWarnings = [...new Set([...importWarnings, ...collectWarnings(productionPackage)])];
    return {
        package: productionPackage,
        sourceHash: sourceHash || createHash("sha256").update(JSON.stringify(source)).digest("hex"),
        format,
        warnings: allWarnings,
        importWarnings,
        summary: {
            episodes: productionPackage.episodes.length,
            storyScenes: productionPackage.episodes.reduce((total, episode) => total + episode.storyScenes.length, 0),
            shots: productionPackage.episodes.reduce((total, episode) => total + episode.shots.length, 0),
            characters: productionPackage.assets.characters.length,
            locations: productionPackage.assets.locations.length,
            duration: productionPackage.episodes.reduce((total, episode) => total + episode.shots.reduce((sum, shot) => sum + shot.duration, 0), 0),
            archiveSections: productionPackage.archive?.sections.length || 0,
            promptAssets: productionPackage.archive?.promptAssets.length || 0,
            performancePlans: productionPackage.episodes.reduce((total, episode) => total + episode.shots.filter((shot) => hasPerformancePlan(shot.performancePlan)).length, 0),
            lightingPlans: productionPackage.episodes.reduce((total, episode) => total + episode.shots.filter((shot) => hasLightingPlan(shot.lightingPlan)).length, 0),
            continuityPlans: productionPackage.episodes.reduce((total, episode) => total + episode.shots.filter((shot) => hasContinuityPlan(shot)).length, 0),
        },
    };
}

export function applyDramaProductionPackage(project: DramaProject, source: DramaProductionPackageV1, sourceHash: string, rawSource?: string, fileName = "package.json", options: DramaProductionPackageNormalizationOptions = {}): DramaProject {
    const productionPackage = normalizeProductionPackage(source, options);
    const characters = mergeAssets(project.characters, productionPackage.assets.characters, "character");
    const locations = mergeAssets(project.scenes, productionPackage.assets.locations, "location");
    const props = mergeAssets(project.props, productionPackage.assets.props, "prop");
    const clues = mergeAssets(project.clues, productionPackage.assets.clues, "clue");
    const episodeByCode = new Map(project.episodes.flatMap((episode) => (episode.code ? [[episode.code, episode] as const] : [])));
    const episodes = productionPackage.episodes.map((episodePackage, index) =>
        mergeEpisode(episodeByCode.get(episodePackage.code) || (episodePackage.code ? undefined : project.episodes[index]), episodePackage, characters.ids, locations.ids, props.ids, clues.ids, project.defaultVideoMode),
    );
    const projectPatch = productionPackage.project;
    const sourceAsset = {
        id: `source-package-${sourceHash.slice(0, 16)}`,
        type: "text" as const,
        title: `制作包 ${fileName}`,
        textContent: rawSource || sourceHash,
        sourceHash,
    };
    const sourceAssets = [...(project.sourceAssets || []).filter((asset) => asset.id !== sourceAsset.id), sourceAsset];
    const productionBible = project.fieldOrigins?.productionBible === "manual" ? project.productionBible : projectPatch.productionBible;
    const preferredStyle = preferred(project.style, project.fieldOrigins, "style", projectPatch.style);
    const nextStyle = project.fieldOrigins?.productionBible === "manual" && project.fieldOrigins?.style !== "manual" ? productionBible?.visualStyle || preferredStyle : preferredStyle;
    const styleContract = resolveDramaStyleContract({ style: nextStyle, productionBible });
    const synchronizedBible = productionBible
        ? (() => {
              const { colorScript: _oldColorScript, ...bibleWithoutColorScript } = productionBible;
              return { ...bibleWithoutColorScript, visualStyle: styleContract.name, ...(styleContract.colorScript ? { colorScript: styleContract.colorScript } : {}) };
          })()
        : undefined;
    return {
        ...project,
        title: preferred(project.title, project.fieldOrigins, "title", projectPatch.title),
        summary: preferred(project.summary, project.fieldOrigins, "summary", projectPatch.summary),
        style: styleContract.name,
        ratio: preferred(project.ratio, project.fieldOrigins, "ratio", projectPatch.ratio),
        productionLock: productionPackage.project.productionLock || project.productionLock,
        productionBible: synchronizedBible,
        seriesBible: productionPackage.seriesBible || project.seriesBible,
        productionArchive: productionPackage.archive,
        fieldOrigins: { ...packageOrigins(["title", "summary", "style", "ratio", "productionBible"]), ...project.fieldOrigins },
        characters: characters.items,
        scenes: locations.items,
        props: props.items,
        clues: clues.items.map((item) => ({ ...item, payoff: "payoff" in item ? String(item.payoff || "") : "" })),
        activeEpisodeId: episodes[0]?.id,
        episodes,
        sourceAssets,
    };
}

export function attachDramaProductionPackageAuthoring<T extends DramaProductionPackageV1>(value: T, authoring: DramaProductionPackageAuthoring): T {
    const normalized = normalizePackageAuthoring(authoring);
    if (!normalized) throw new DramaProductionPackageError("制作包缺少有效的 Agent authoring provenance");
    return { ...value, authoring: normalized };
}

function mergeEpisode(
    existing: DramaEpisode | undefined,
    incoming: DramaProductionPackageEpisode,
    characterIds: Map<string, string>,
    locationIds: Map<string, string>,
    propIds: Map<string, string>,
    clueIds: Map<string, string>,
    defaultVideoMode: DramaProject["defaultVideoMode"],
): DramaEpisode {
    const id = existing?.id || `episode-${nanoid()}`;
    const existingShotsByCode = new Map((existing?.shots || []).flatMap((shot) => (shot.code ? [[shot.code, shot] as const] : [])));
    const shots = incoming.shots.map((shot, index) => {
        const current = existingShotsByCode.get(shot.code);
        const next: DramaShot = {
            ...shot,
            id: current?.id || `shot-${nanoid()}`,
            code: shot.code,
            order: index + 1,
            characterIds: shot.characterCodes.map((code) => characterIds.get(code)).filter((value): value is string => Boolean(value)),
            sceneId: shot.locationCode ? locationIds.get(shot.locationCode) : undefined,
            propIds: shot.propCodes.map((code) => propIds.get(code)).filter((value): value is string => Boolean(value)),
            clueIds: shot.clueCodes.map((code) => clueIds.get(code)).filter((value): value is string => Boolean(value)),
            entryState: remapContinuityState(shot.entryState, characterIds, propIds),
            exitState: remapContinuityState(shot.exitState, characterIds, propIds),
            storySceneId: undefined,
            videoMode: shot.videoMode === "direct" || defaultVideoMode === "direct" ? "direct" : "storyboard",
            storyboardStatus: current?.storyboardStatus || "idle",
            storyboardEndStatus: current?.storyboardEndStatus || "idle",
            generationStatus: current?.generationStatus || "idle",
            audioStatus: current?.audioStatus || "idle",
            fieldOrigins: mergeOrigins(current?.fieldOrigins, Object.keys(shot)),
        };
        return mergeManualFields(current, next);
    });
    const shotIds = new Map(shots.flatMap((shot) => (shot.code ? [[shot.code, shot.id] as const] : [])));
    const storyScenes = incoming.storyScenes.map<DramaStoryScene>((scene, index) => ({
        id: existing?.storyScenes?.find((item) => item.code === scene.code)?.id || `story-scene-${nanoid()}`,
        code: scene.code,
        order: scene.order || index + 1,
        title: scene.title,
        timeOfDay: scene.timeOfDay,
        timeRange: scene.timeRange,
        locationId: scene.locationCode ? locationIds.get(scene.locationCode) : undefined,
        summary: scene.summary,
        shotIds: scene.shotCodes.map((code) => shotIds.get(code)).filter((value): value is string => Boolean(value)),
        fieldOrigins: packageOrigins(["code", "order", "title", "timeOfDay", "timeRange", "locationId", "summary", "shotIds"]),
    }));
    const storySceneIds = new Map(storyScenes.flatMap((scene) => (scene.code ? [[scene.code, scene.id] as const] : [])));
    const linkedShots = shots.map((shot) => {
        const packageShot = incoming.shots.find((item) => item.code === shot.code);
        return {
            ...shot,
            framePlan: shouldPreserveManualFramePlan(shot.framePlan, shot.fieldOrigins?.framePlan) ? preserveManualFramePlan(shot.framePlan!) : remapFramePlan(packageShot?.framePlan, characterIds, locationIds, propIds, clueIds, shotIds),
            storySceneId: packageShot?.storySceneCode ? storySceneIds.get(packageShot.storySceneCode) : undefined,
        };
    });
    const continuityEdges = incoming.continuityEdges.flatMap<DramaContinuityEdge>((edge) => {
        const fromShotId = shotIds.get(edge.fromShotCode);
        const toShotId = shotIds.get(edge.toShotCode);
        return fromShotId && toShotId
            ? [
                  {
                      ...edge,
                      fromShotId,
                      toShotId,
                      carryCharacterIds: edge.carryCharacterIds.map((code) => characterIds.get(code)).filter((id): id is string => Boolean(id)),
                      carryPropIds: edge.carryPropIds.map((code) => propIds.get(code)).filter((id): id is string => Boolean(id)),
                  },
              ]
            : [];
    });
    return {
        id,
        code: incoming.code,
        title: preferred(existing?.title, existing?.fieldOrigins, "title", incoming.title),
        script: preferred(existing?.script, existing?.fieldOrigins, "script", incoming.script),
        outline: preferred(existing?.outline, existing?.fieldOrigins, "outline", incoming.outline),
        hook: preferred(existing?.hook, existing?.fieldOrigins, "hook", incoming.hook),
        nextPreview: preferred(existing?.nextPreview, existing?.fieldOrigins, "nextPreview", incoming.nextPreview),
        sourceRange: preferred(existing?.sourceRange, existing?.fieldOrigins, "sourceRange", incoming.sourceRange),
        reviewStatus: linkedShots.every((shot) => shot.imagePrompt.trim() && shot.videoPrompt.trim()) ? "visual_ready" : "content_review",
        storyScenes,
        continuityEdges,
        shots: linkedShots,
        fieldOrigins: { ...packageOrigins(["code", "title", "script", "outline", "hook", "nextPreview", "sourceRange"]), ...existing?.fieldOrigins },
    };
}

function shouldPreserveManualFramePlan(framePlan: DramaShot["framePlan"], origin: DramaFieldOrigin | undefined) {
    return origin === "manual" && Boolean(framePlan?.frames?.length);
}

function preserveManualFramePlan(framePlan: NonNullable<DramaShot["framePlan"]>): NonNullable<DramaShot["framePlan"]> {
    return {
        ...framePlan,
        frames: framePlan.frames.map(({ id, sequenceIndex, startSecond, endSecond, startPrompt, actionPrompt, transitionPrompt, endPrompt, imagePrompt }) => ({
            id,
            sequenceIndex,
            startSecond,
            endSecond,
            ...(startPrompt ? { startPrompt } : {}),
            actionPrompt,
            ...(transitionPrompt ? { transitionPrompt } : {}),
            ...(endPrompt ? { endPrompt } : {}),
            imagePrompt,
        })),
    };
}

function remapFramePlan(framePlan: DramaShot["framePlan"], characterIds: Map<string, string>, locationIds: Map<string, string>, propIds: Map<string, string>, clueIds: Map<string, string>, shotIds: Map<string, string>): DramaShot["framePlan"] {
    if (!framePlan?.referenceManifest) return framePlan;
    const remapAsset = (assetId: string) => characterIds.get(assetId) || locationIds.get(assetId) || propIds.get(assetId) || clueIds.get(assetId) || assetId;
    return {
        ...framePlan,
        referenceManifest: framePlan.referenceManifest.map((item) => ({
            ...item,
            assetId: item.assetId ? remapAsset(item.assetId) : item.assetId,
            shotId: item.shotId ? shotIds.get(item.shotId) || item.shotId : item.shotId,
        })),
    };
}

function remapContinuityState(state: DramaShot["entryState"], characterIds: Map<string, string>, propIds: Map<string, string>): DramaShot["entryState"] {
    if (!state) return undefined;
    const remap = (assetId: string) => characterIds.get(assetId) || propIds.get(assetId) || assetId;
    return {
        ...state,
        characters: state.characters.map((entity) => ({ ...entity, assetId: remap(entity.assetId), holderId: entity.holderId ? remap(entity.holderId) : undefined })),
        props: state.props.map((entity) => ({ ...entity, assetId: remap(entity.assetId), holderId: entity.holderId ? remap(entity.holderId) : undefined })),
    };
}

function mergeAssets<T extends DramaNamedAsset>(existing: T[], incoming: DramaProductionPackageAsset[], prefix: string) {
    incoming = dedupePackageAssets(incoming);
    const byCode = new Map(existing.flatMap((asset) => (asset.code ? [[asset.code, asset] as const] : [])));
    const byName = new Map(existing.map((asset) => [normalizeKey(asset.name), asset]));
    const ids = new Map<string, string>();
    const merged = incoming.map((asset) => {
        const current = byCode.get(asset.code) || byName.get(normalizeKey(asset.name));
        const next = {
            ...current,
            ...asset,
            id: current?.id || `${prefix}-${nanoid()}`,
            fieldOrigins: mergeOrigins(current?.fieldOrigins, Object.keys(asset)),
        } as unknown as T;
        const result = mergeManualFields(current, next);
        ids.set(asset.code, result.id);
        return result;
    });
    const incomingIds = new Set(merged.map((asset) => asset.id));
    const incomingKeys = new Set(merged.flatMap((asset) => [asset.code || "", normalizeKey(asset.name)]).filter(Boolean));
    const manualAssets = existing.filter((asset) => !incomingIds.has(asset.id) && Object.values(asset.fieldOrigins || {}).includes("manual") && ![asset.code || "", normalizeKey(asset.name)].some((key) => key && incomingKeys.has(key)));
    return { items: [...merged, ...manualAssets], ids };
}

function dedupePackageAssets(items: DramaProductionPackageAsset[]) {
    const byKey = new Map<string, DramaProductionPackageAsset>();
    for (const item of items) {
        const key = item.code || normalizeKey(item.name);
        if (!key) continue;
        const current = byKey.get(key);
        byKey.set(key, current ? mergePackageAsset(current, item) : item);
    }
    return [...byKey.values()];
}

function mergePackageAsset(current: DramaProductionPackageAsset, incoming: DramaProductionPackageAsset) {
    return {
        ...current,
        ...incoming,
        description: incoming.description || current.description,
        ...(current.profile || incoming.profile ? { profile: { ...current.profile, ...incoming.profile } as NonNullable<DramaProductionPackageAsset["profile"]> } : {}),
        ...(incoming.activeEpisodeCodes?.length || current.activeEpisodeCodes?.length ? { activeEpisodeCodes: incoming.activeEpisodeCodes?.length ? incoming.activeEpisodeCodes : current.activeEpisodeCodes } : {}),
        ...(incoming.backgroundNpcPolicy || current.backgroundNpcPolicy ? { backgroundNpcPolicy: incoming.backgroundNpcPolicy || current.backgroundNpcPolicy } : {}),
    } as DramaProductionPackageAsset;
}

function mergeManualFields<T extends { fieldOrigins?: Record<string, DramaFieldOrigin> }>(current: T | undefined, next: T): T {
    if (!current) return next;
    const result = { ...next } as Record<string, unknown>;
    for (const [field, origin] of Object.entries(current.fieldOrigins || {})) if (origin === "manual") result[field] = (current as Record<string, unknown>)[field];
    result.fieldOrigins = { ...next.fieldOrigins, ...current.fieldOrigins };
    return result as T;
}

/** Validate standalone Codex data before compatibility normalization can drop malformed shots. */
function validateStandalonePackageShape(input: Record<string, unknown>) {
    const has = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key);
    const fail = (path: string, message: string): never => {
        throw new DramaProductionPackageError(`${path}${message}`);
    };
    if (!Array.isArray(input.episodes) || !input.episodes.length) fail("episodes", " 必须是非空数组");
    const project = object(input.project);
    const bible = object(project.productionBible);
    const plan = object(bible.productionPlan);
    const video = object(plan.video);
    for (const field of ["version", "skills", "visual", "video", "references", "continuity", "frameCountRange", "source"]) if (!has(plan, field)) fail(`project.productionBible.productionPlan.${field}`, " 缺失；独立制作包必须携带完整 productionPlan");
    const assets = object(input.assets);
    for (const field of ["characters", "locations", "props", "clues"]) if (!Array.isArray(assets[field])) fail(`assets.${field}`, " 必须是数组");

    const authoring = object(input.authoring);
    if (authoring.authoringMode !== "codex-standalone" || authoring.canonicalSource !== "markdown-with-embedded-json") fail("authoring", " 必须声明 codex-standalone 与 markdown-with-embedded-json");
    if (authoring.qualityGateStatus !== "passed") fail("authoring.qualityGateStatus", " 必须为 passed；未通过自检的制作包不得导入");
    if (!text(authoring.generatedAt)) fail("authoring.generatedAt", " 缺失");
    if (!Array.isArray(authoring.materials)) fail("authoring.materials", " 必须是数组，不能是对象或省略");
    const materials = authoring.materials as unknown[];
    const materialRoles = new Set(materials.map((item) => text(object(item).role)));
    if (!materialRoles.has("package-template") || !materialRoles.has("story-source")) fail("authoring.materials", " 必须同时记录 package-template 与 story-source");
    const report = object(authoring.qualityGateReport);
    if (!Object.keys(report).length) fail("authoring.qualityGateReport", " 缺失；qualityGateStatus=passed 必须附带完整 QC 报告");
    if (report.status !== "passed" || !Array.isArray(report.checks)) fail("authoring.qualityGateReport", " 状态或 checks 无效");
    const reportChecks = report.checks as unknown[];
    const reportCodes = new Set(reportChecks.map((item) => text(object(item).code)));
    const missingGateCodes = DRAMA_PACKAGE_GATE_CODES.filter((code) => !reportCodes.has(code));
    if (missingGateCodes.length) fail("authoring.qualityGateReport.checks", ` 缺少门禁：${missingGateCodes.join("、")}`);
    if (reportChecks.some((item) => object(item).status === "blocked")) fail("authoring.qualityGateReport.checks", " 仍包含未通过的门禁，不能标记 passed");

    for (const field of ["projectionVersion", "qualityGateRulesHash", "repairPolicyHash", "runId", "workOrderId", "executeDramaScriptRun"]) {
        if (has(authoring, field)) fail(`authoring.${field}`, " 是服务端运行字段，codex-standalone 不得写入");
        if (has(object(project.productionLock), field)) fail(`project.productionLock.${field}`, " 是服务端运行字段，codex-standalone 不得写入");
    }
    const lock = object(project.productionLock);
    for (const field of ["shotDuration", "targetDuration", "logicalShotCount", "internalCutPolicy", "framePolicy", "dialogueCapacityPlan", "narrativeBeatPlan", "selfCheckRuleVersion"])
        if (!has(lock, field)) fail(`project.productionLock.${field}`, " 缺失；必须先冻结逻辑片段轴和对白容量计划");
    const shotDuration = Number(lock.shotDuration);
    const logicalShotCount = Number(lock.logicalShotCount);
    const targetDuration = Number(lock.targetDuration);
    if (![15, 30].includes(shotDuration)) fail("project.productionLock.shotDuration", " 必须为 15 或 30");
    if (!Number.isInteger(logicalShotCount) || logicalShotCount < 1) fail("project.productionLock.logicalShotCount", " 必须是正整数");
    if (!Number.isFinite(targetDuration) || targetDuration <= 0) fail("project.productionLock.targetDuration", " 必须是正数");
    if (!["adaptive", "dense-30s"].includes(text(lock.internalCutPolicy))) fail("project.productionLock.internalCutPolicy", " 必须为 adaptive 或 dense-30s");
    if (!["fixed-4", "fixed-5", "agent"].includes(text(lock.framePolicy))) fail("project.productionLock.framePolicy", " 必须为 fixed-4、fixed-5 或 agent");
    if (!Array.isArray(lock.dialogueCapacityPlan) || !Array.isArray(lock.narrativeBeatPlan)) fail("project.productionLock", " dialogueCapacityPlan 与 narrativeBeatPlan 必须是数组");
    for (const [index, item] of (lock.dialogueCapacityPlan as unknown[]).entries()) {
        const planItem = object(item);
        const path = `project.productionLock.dialogueCapacityPlan[${index}]`;
        const characterCount = Number(planItem.characterCount);
        const speechRate = Number(planItem.speechRateCharsPerSecond);
        const requiredSpeechSeconds = Number(planItem.requiredSpeechSeconds);
        const availableSpeechSeconds = Number(planItem.availableSpeechSeconds);
        if (
            !text(planItem.dialogueId) ||
            !text(planItem.speaker) ||
            !Number.isFinite(characterCount) ||
            characterCount < 0 ||
            !Number.isFinite(speechRate) ||
            speechRate <= 0 ||
            !Number.isFinite(requiredSpeechSeconds) ||
            !Number.isFinite(availableSpeechSeconds)
        )
            fail(path, " 缺少有效对白 ID、说话人、字数、语速或时间窗口");
        const pauseBefore = Number(planItem.pauseBeforeSeconds || 0);
        const pauseAfter = Number(planItem.pauseAfterSeconds || 0);
        if (requiredSpeechSeconds > availableSpeechSeconds - pauseBefore - pauseAfter + 0.01) fail(path, ` 对白容量不足：requiredSpeechSeconds=${requiredSpeechSeconds}，availableSpeechSeconds=${availableSpeechSeconds}，且必须另留句前/句后停顿`);
    }
    const narrativeBeatPlan = lock.narrativeBeatPlan as unknown[];
    if (narrativeBeatPlan.length !== logicalShotCount) fail("project.productionLock.narrativeBeatPlan", ` 必须有 ${logicalShotCount} 个独立剧情职责，不能用内部帧段或对白分句翻倍镜头`);
    if (narrativeBeatPlan.some((item) => !text(object(item).id) || !text(object(item).responsibility) || !Array.isArray(object(item).shotCodes) || !(object(item).shotCodes as unknown[]).length))
        fail("project.productionLock.narrativeBeatPlan", " 每个剧情节拍必须有独立责任和 shotCodes 绑定");
    if (!text(lock.selfCheckRuleVersion)) fail("project.productionLock.selfCheckRuleVersion", " 缺失");
    if (Number(video.shotDuration) !== shotDuration) fail("project.productionLock.shotDuration", " 与 project.productionBible.productionPlan.video.shotDuration 不一致");

    let totalShots = 0;
    let totalDuration = 0;
    const shotCodes = new Set<string>();
    for (const [episodeIndex, episodeValue] of (input.episodes as unknown[]).entries()) {
        const episode = object(episodeValue);
        if (has(episode, "episodeId")) fail(`episodes[${episodeIndex}].episodeId`, " 是非契约字段；请使用 code，制作包未导入");
        if (!text(episode.code)) fail(`episodes[${episodeIndex}].code`, " 缺失；检测到非契约剧集字段，制作包未导入");
        if (!Array.isArray(episode.shots) || !episode.shots.length) fail(`episodes[${episodeIndex}].shots`, " 必须是非空数组");
        let previousEnd = 0;
        for (const [shotIndex, shotValue] of (episode.shots as unknown[]).entries()) {
            const shot = object(shotValue);
            const path = `episodes[${episodeIndex}].shots[${shotIndex}]`;
            if (has(shot, "shotId")) fail(`${path}.shotId`, " 是非契约字段；请使用 code，制作包未导入");
            if (has(shot, "shotDuration")) fail(`${path}.shotDuration`, " 是非契约字段；请使用 duration，制作包未导入");
            if (!text(shot.code)) fail(`${path}.code`, " 缺失；请使用当前导入契约字段 code，制作包未导入");
            shotCodes.add(text(shot.code));
            const duration = Number(shot.duration);
            if (duration !== shotDuration) fail(`${path}.duration`, ` 必须等于 ${shotDuration}；内部帧段和硬切不能改变逻辑片段时长`);
            const parsedTimecode = parseTimecode(shot.timecode);
            if (!parsedTimecode) fail(`${path}.timecode`, " 缺失或格式无效；必须是 start-end[s] 时间码");
            const [timecodeStart, timecodeEnd] = parsedTimecode as [number, number];
            if (timecodeEnd - timecodeStart !== duration) fail(`${path}.timecode`, ` 与 duration=${duration} 不一致`);
            if (timecodeStart !== previousEnd) fail(`${path}.timecode`, ` 未与上一逻辑片段连续；期望起点 ${previousEnd}s`);
            previousEnd = timecodeEnd;
            const framePlan = object(shot.framePlan);
            const frames = Array.isArray(framePlan.frames) ? (framePlan.frames as unknown[]) : [];
            if (!frames.length) fail(`${path}.framePlan.frames`, " 缺失；内部帧段只能存在于当前逻辑片段内部");
            const startSource = text(object(framePlan.start).source);
            if (startSource !== "independent" && startSource !== "previous_accepted_actual_tail") fail(`${path}.framePlan.start.source`, " 必须为 independent 或 previous_accepted_actual_tail");
            if (startSource === "previous_accepted_actual_tail" && !array(framePlan.referenceManifest).some((item) => text(object(item).role) === "previous_actual_tail"))
                fail(`${path}.framePlan.referenceManifest`, " 启用了 previous_accepted_actual_tail 但缺少已验收实际尾帧 alias；未显式要求实际尾帧时请使用 independent");
            let previousFrameEnd = 0;
            for (const [frameIndex, frameValue] of frames.entries()) {
                const frame = object(frameValue);
                const framePath = `${path}.framePlan.frames[${frameIndex}]`;
                if (has(frame, "meta")) fail(`${framePath}.meta`, " 是生成器内部辅助字段，不属于制作包契约；请删除后重新导出");
                const start = Number(frame.startSecond);
                const end = Number(frame.endSecond);
                if (!Number.isFinite(start) || !Number.isFinite(end) || start !== previousFrameEnd || end <= start || end > duration) fail(framePath, " 时间必须从 0 连续覆盖到当前镜头 duration，不能空白、重叠或超界");
                if (!text(frame.actionPrompt) || !text(frame.endPrompt) || !text(frame.imagePrompt)) fail(framePath, " 必须同时填写 actionPrompt、endPrompt 和 imagePrompt");
                previousFrameEnd = end;
            }
            if (previousFrameEnd !== duration) fail(`${path}.framePlan.frames`, ` 未完整覆盖 ${duration}s 逻辑片段`);
            if (!text(shot.videoPrompt)) fail(`${path}.videoPrompt`, " 不能为空");
            const publicCardCount = (text(shot.videoPrompt).match(/^###\s*镜头\s*\d+/gmu) || []).length;
            if (publicCardCount !== frames.length) fail(`${path}.videoPrompt`, ` 必须与 framePlan.frames 一一对应；当前 ${publicCardCount} 张公开卡/${frames.length} 个帧段`);
            if (shotDuration === 30 && text(video.internalCutPolicy) === "dense-30s") {
                if (frames.length < 8 || frames.length > 11) fail(`${path}.framePlan.frames`, " dense-30s 必须在每个 30 秒逻辑片段内使用 8—11 个帧段");
                const hardCuts = (text(shot.videoPrompt).match(/(?:剪辑承接|镜头事件)[^\n]{0,240}硬切/gu) || []).length;
                if (hardCuts < 7 || hardCuts > 10) fail(`${path}.videoPrompt`, ` dense-30s 必须公开表达 7—10 次硬切，当前检测到 ${hardCuts} 次`);
            }
            totalShots += 1;
            totalDuration += duration;
        }
    }
    if (totalShots !== logicalShotCount) fail("project.productionLock.logicalShotCount", `=${logicalShotCount}，但 episodes[].shots 实际为 ${totalShots}；内部帧段/硬切不能生成新逻辑片段`);
    const plannedShotCodes = new Set(narrativeBeatPlan.flatMap((item) => (object(item).shotCodes as unknown[]).map(text)));
    if (plannedShotCodes.size !== shotCodes.size || [...shotCodes].some((code) => !plannedShotCodes.has(code))) fail("project.productionLock.narrativeBeatPlan", " 未覆盖全部逻辑片段 code；不能用内部帧段或对白分句伪造剧情节拍");
    if (targetDuration !== totalDuration) fail("project.productionLock.targetDuration", `=${targetDuration}，但逻辑片段总时长为 ${totalDuration}；不能把内部帧段时长累计为整集时长`);
    if (bible.targetDuration !== undefined && Number(bible.targetDuration) !== totalDuration) fail("project.productionBible.targetDuration", ` 与逻辑片段总时长 ${totalDuration} 不一致`);
}

function normalizeProductionPackage(value: unknown, options: DramaProductionPackageNormalizationOptions = {}): DramaProductionPackageV1 {
    const input = object(value);
    if (Number(input.schemaVersion) !== 1) throw new DramaProductionPackageError("仅支持 schemaVersion 1 的制作包");
    const rawAuthoring = object(input.authoring);
    if (rawAuthoring.source === "codex-standalone") validateStandalonePackageShape(input);
    const normalizationOptions = rawAuthoring.source === "codex-standalone" ? { ...options, preserveAuthoredVideoPrompt: true, standaloneImport: true } : options;
    if (options.requireContentQuality || options.requireAuthoringQuality) validateRawAgentPackageDraft(input);
    const project = object(input.project);
    const bible = object(project.productionBible);
    const assets = object(input.assets);
    const backgroundNpcPolicyByLocationCode = new Map(
        array(assets.locations).flatMap((asset) => {
            const item = object(asset);
            const code = text(item.code);
            const policy = normalizeBackgroundNpcPolicy(item.backgroundNpcPolicy);
            return code && policy ? [[code, policy] as const] : [];
        }),
    );
    const episodes = array(input.episodes)
        .map((episode, index) => normalizeEpisodePackage(episode, index, { ...normalizationOptions, backgroundNpcPolicyByLocationCode }))
        .filter((episode) => episode.shots.length);
    if (!episodes.length) throw new DramaProductionPackageError("制作包至少需要一个包含镜头的剧集");
    const normalizedAssets = {
        characters: dedupePackageAssets(
            array(assets.characters)
                .map((asset) => normalizePackageAsset(asset, false, true))
                .filter(hasCodeAndName),
        ),
        locations: dedupePackageAssets(
            array(assets.locations)
                .map((asset) => normalizePackageAsset(asset, true))
                .filter(hasCodeAndName),
        ),
        props: dedupePackageAssets(
            array(assets.props)
                .map((asset) => normalizePackageAsset(asset))
                .filter(hasCodeAndName),
        ),
        clues: dedupePackageAssets(
            array(assets.clues)
                .map((asset) => normalizePackageAsset(asset))
                .filter(hasCodeAndName),
        ),
    };
    const activeCodes = (items: DramaProductionPackageAsset[], episodeCode: string) => new Set(items.filter((item) => !item.activeEpisodeCodes?.length || item.activeEpisodeCodes.includes(episodeCode)).map((item) => item.code));
    const normalizedEpisodes = episodes.map((episode) => {
        const characters = activeCodes(normalizedAssets.characters, episode.code);
        const props = activeCodes(normalizedAssets.props, episode.code);
        const clues = activeCodes(normalizedAssets.clues, episode.code);
        return {
            ...episode,
            shots: episode.shots.map((shot) => ({
                ...shot,
                characterCodes: shot.characterCodes.filter((code) => characters.has(code)),
                propCodes: shot.propCodes.filter((code) => props.has(code)),
                clueCodes: shot.clueCodes.filter((code) => clues.has(code)),
            })),
        };
    });
    const strictContinuity = Boolean(options.strictContinuity || options.requireAuthoringQuality || rawAuthoring.source === "executeDramaScriptRun");
    const continuityIssues = strictContinuity ? validateDramaContinuityEdges(normalizedEpisodes) : [];
    if (continuityIssues.length) {
        const message = `制作包跨镜连续性预检未通过：${continuityIssues.slice(0, 12).join("；")}`;
        if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
        options.importWarnings?.push(message);
    }
    const synchronizedEpisodes = normalizedEpisodes.map(synchronizeContinuityStates);
    const derivedTargetDuration = synchronizedEpisodes.reduce((total, episode) => total + episode.shots.reduce((sum, shot) => sum + shot.duration, 0), 0);
    // Validate the caller's raw plan before normalization can apply defaults or
    // coerce an invalid value into a seemingly valid runtime plan.
    validateRawProductionPlan(bible);
    const productionPlan = normalizePackageProductionPlan(bible);
    const styleContract = resolveDramaStyleContract({
        style: text(project.style),
        productionBible: { visualStyle: text(bible.visualStyle), colorScript: optionalText(bible.colorScript), productionPlan },
    });
    const { colorScript: _rawColorScript, ...bibleWithoutColorScript } = bible;
    const colorScript = optionalText(bible.colorScript);
    const productionLock = normalizeProductionLock(project.productionLock);
    const normalizedBible = {
        ...bibleWithoutColorScript,
        visualStyle: styleContract.name,
        ...(colorScript ? { colorScript } : {}),
        ...(normalizeDialogueTimingPolicy(bible.dialogueTiming) ? { dialogueTiming: normalizeDialogueTimingPolicy(bible.dialogueTiming) } : {}),
    };
    const authoring = normalizePackageAuthoring(input.authoring, options);
    const result: DramaProductionPackageV1 = {
        schemaVersion: 1,
        project: {
            title: text(project.title) || "未命名短剧",
            summary: text(project.summary),
            style: styleContract.name,
            ratio: text(project.ratio) || "9:16",
            ...(productionLock ? { productionLock } : {}),
            productionBible: {
                targetPlatform: optionalText(bible.targetPlatform),
                language: text(bible.language) || "中文",
                ratio: text(bible.ratio) || text(project.ratio) || "9:16",
                targetDuration: derivedTargetDuration > 0 ? derivedTargetDuration : undefined,
                visualStyle: styleContract.name,
                ...(colorScript ? { colorScript } : {}),
                soundBible: optionalText(bible.soundBible),
                globalNegativePrompt: optionalText(bible.globalNegativePrompt),
                subtitleSafeArea: optionalText(bible.subtitleSafeArea),
                ...(normalizeDialogueTimingPolicy(bible.dialogueTiming) ? { dialogueTiming: normalizeDialogueTimingPolicy(bible.dialogueTiming) } : {}),
                continuityMode: bible.continuityMode === "balanced" ? "balanced" : "strict",
                productionPlan,
            },
        },
        assets: normalizedAssets,
        episodes: synchronizedEpisodes,
        seriesBible: normalizeSeriesBible(input.seriesBible),
        archive: normalizeProductionArchive(input.archive),
        ...(authoring ? { authoring } : {}),
    };
    if (options.requireAuthoringQuality) validateStrictAuthoringQuality(result, authoring, options);
    validateProductionPackageCompleteness(result, normalizationOptions);
    if (!normalizationOptions.standaloneImport) validateSplitShotFramePlans(synchronizedEpisodes, options.allowImportWarnings);
    return result;
}

function validateStrictAuthoringQuality(value: DramaProductionPackageV1, authoring: DramaProductionPackageAuthoring | undefined, options: DramaProductionPackageNormalizationOptions) {
    if (!authoring?.qualityGateReport) throw new DramaProductionPackageError("制作包缺少严格质量门禁报告，禁止导入");
    if (authoring.provider !== "project-gpt" && authoring.provider !== "codex-work-order") throw new DramaProductionPackageError("制作包缺少有效的 authoring provider，禁止导入");
    if (!authoring.runId) throw new DramaProductionPackageError("制作包缺少 authoring 运行凭据，禁止导入");
    if (!authoring.contract || authoring.contract.id !== DRAMA_PACKAGE_CONTRACT_ID || authoring.contract.version !== DRAMA_PACKAGE_CONTRACT_VERSION || authoring.contract.contentHash !== DRAMA_PACKAGE_CONTRACT.contentHash)
        throw new DramaProductionPackageError("制作包缺少当前契约版本/内容哈希，禁止导入");
    const requiredRoles = new Set(authoring.materials.filter((material) => material.type === "text" || material.type === "markdown").map((material) => material.role));
    if (!requiredRoles.has("package-template") || !requiredRoles.has("story-source")) throw new DramaProductionPackageError("制作包 authoring provenance 必须同时记录文本模板和 TXT/小说素材");
    if (options.authoringSources && !sameAuthoringMaterialManifest(authoring.materials, options.authoringSources)) throw new DramaProductionPackageError("制作包 authoring 素材 alias、role、顺序或内容哈希与本次输入不一致");
    const missingGateCodes = DRAMA_PACKAGE_GATE_CODES.filter((code) => !authoring.qualityGateReport!.checks.some((check) => check.code === code));
    if (missingGateCodes.length) throw new DramaProductionPackageError(`制作包质量门禁报告缺少检查项：${missingGateCodes.join("、")}`);
    const report = validateDramaAuthoringQuality({ package: value, sources: options.authoringSources || [], targetNarrativeChapter: options.targetNarrativeChapter ?? authoring.targetNarrativeChapter, authoringAudit: authoring.authoringAudit });
    if (report.status === "blocked") throw new DramaProductionPackageError(formatDramaQualityGateFailure(report));
    if (authoring.qualityGateReport.status !== "passed") throw new DramaProductionPackageError("制作包 authoring 质量门禁报告不是 passed，禁止导入");
}

function sameAuthoringMaterialManifest(actual: DramaProductionPackageAuthoringMaterial[], expected: DramaAuthoringSourceSnapshot[]) {
    return (
        actual.length === expected.length &&
        actual.every((material, index) => {
            const source = expected[index];
            return Boolean(source) && material.alias === source.alias && material.role === source.role && material.type === source.type && material.title === source.title && material.contentHash === source.contentHash;
        })
    );
}

function normalizeProductionLock(value: unknown): DramaProductionLock | undefined {
    const input = object(value);
    const shotDuration = Number(input.shotDuration);
    const targetDuration = Number(input.targetDuration);
    const logicalShotCount = Number(input.logicalShotCount);
    const standaloneLockIsValid =
        (shotDuration === 15 || shotDuration === 30) &&
        Number.isFinite(targetDuration) &&
        targetDuration > 0 &&
        Number.isInteger(logicalShotCount) &&
        logicalShotCount > 0 &&
        Array.isArray(input.dialogueCapacityPlan) &&
        Array.isArray(input.narrativeBeatPlan) &&
        Boolean(text(input.selfCheckRuleVersion));
    const hashFields = ["storySourceHash", "templateHash", "contractHash", "specHash", "directorSkillHash", "seedanceSkillHash", "authoringSchemaHash", "qualityGateRulesHash", "repairPolicyHash"] as const;
    if (standaloneLockIsValid && !text(input.projectionVersion) && !text(input.lockedBy)) {
        return {
            shotDuration: shotDuration as 15 | 30,
            targetDuration,
            logicalShotCount,
            dialogueCapacityPlan: input.dialogueCapacityPlan as DramaProductionLock["dialogueCapacityPlan"],
            narrativeBeatPlan: input.narrativeBeatPlan as DramaProductionLock["narrativeBeatPlan"],
            selfCheckRuleVersion: text(input.selfCheckRuleVersion),
            internalCutPolicy: text(input.internalCutPolicy) as DramaProductionLock["internalCutPolicy"],
            framePolicy: text(input.framePolicy) as DramaProductionLock["framePolicy"],
        } as DramaProductionLock;
    }
    if (
        (shotDuration !== 15 && shotDuration !== 30) ||
        !Number.isFinite(targetDuration) ||
        targetDuration <= 0 ||
        !["adaptive", "dense-30s"].includes(text(input.internalCutPolicy)) ||
        !["fixed-4", "fixed-5", "agent"].includes(text(input.framePolicy)) ||
        hashFields.some((field) => !/^[a-f0-9]{64}$/u.test(text(input[field]))) ||
        !text(input.projectionVersion) ||
        !text(input.lockedAt) ||
        text(input.lockedBy) !== "codex-current-conversation"
    )
        return undefined;
    return {
        shotDuration: shotDuration as 15 | 30,
        targetDuration,
        internalCutPolicy: text(input.internalCutPolicy) as DramaProductionLock["internalCutPolicy"],
        framePolicy: text(input.framePolicy) as DramaProductionLock["framePolicy"],
        ...Object.fromEntries(hashFields.map((field) => [field, text(input[field])])),
        projectionVersion: text(input.projectionVersion),
        lockedAt: text(input.lockedAt),
        lockedBy: "codex-current-conversation",
    } as DramaProductionLock;
}

function normalizePackageAuthoring(value: unknown, options: DramaProductionPackageNormalizationOptions = {}): DramaProductionPackageAuthoring | undefined {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    const source = text(input.source);
    if (source === "codex-standalone") {
        const generatedAt = text(input.generatedAt);
        if (!generatedAt) throw new DramaProductionPackageError("独立 Codex 制作包缺少生成时间");
        const rawMaterials = array(input.materials);
        const materials = rawMaterials.flatMap((item, index) => {
            const material = object(item);
            const role = text(material.role);
            const type = text(material.type);
            const alias = text(material.alias);
            const title = text(material.title);
            const contentHash = text(material.contentHash);
            if (!alias || !title || !["package-template", "story-source", "reference"].includes(role) || !["text", "markdown", "image", "video", "audio"].includes(type)) {
                throw new DramaProductionPackageError(
                    `authoring.materials[${index}] 无效：alias、title、role、type 必须完整；role 只能是 package-template、story-source 或 reference，type 只能是 text、markdown、image、video 或 audio；Skill 必须写入 authoring.directorSkill、authoring.storyboardSkill 或 authoring.seedanceSkill`,
                );
            }
            if (contentHash && !/^[a-f0-9]{64}$/u.test(contentHash)) throw new DramaProductionPackageError(`authoring.materials[${index}].contentHash 无效：必须是 64 位小写 SHA-256`);
            return [{ alias, role: role as DramaProductionPackageAuthoringMaterial["role"], type: type as DramaProductionPackageAuthoringMaterial["type"], title, ...(contentHash ? { contentHash } : {}) }];
        });
        const duplicateAlias = materials.find((material, index) => materials.findIndex((candidate) => candidate.alias === material.alias) !== index)?.alias;
        if (duplicateAlias) throw new DramaProductionPackageError(`authoring.materials alias 重复：${duplicateAlias}`);
        const contractInput = object(input.contract);
        const contract = contractInput.id || contractInput.version || contractInput.contentHash ? normalizePackageContract(contractInput, options) : undefined;
        const normalizeOptionalSkill = (value: unknown) => {
            const skill = object(value);
            const id = text(skill.id);
            const version = text(skill.version);
            const contentHash = text(skill.contentHash);
            if (!id && !version && !contentHash) return undefined;
            if (!id || !version || (contentHash && !/^[a-f0-9]{64}$/u.test(contentHash))) throw new DramaProductionPackageError("独立 Codex 制作包的 Skill provenance 无效");
            return { id, version, ...(contentHash ? { contentHash } : {}) };
        };
        const authoringAudit = normalizeAuthoringAudit(input.authoringAudit);
        const qualityGateReport = normalizeQualityGateReport(input.qualityGateReport);
        const directorSkill = normalizeOptionalSkill(input.directorSkill);
        const storyboardSkill = normalizeOptionalSkill(input.storyboardSkill);
        const seedanceSkill = normalizeOptionalSkill(input.seedanceSkill);
        return {
            source,
            provider: "codex-standalone",
            authoringMode: "codex-standalone",
            canonicalSource: "markdown-with-embedded-json",
            ...(input.qualityGateStatus === "passed" || input.qualityGateStatus === "blocked" ? { qualityGateStatus: input.qualityGateStatus } : {}),
            ...(Number.isInteger(input.repairCount) && Number(input.repairCount) >= 0 ? { repairCount: Number(input.repairCount) } : {}),
            ...(Number.isInteger(input.fullPackageRepairCount) && Number(input.fullPackageRepairCount) >= 0 ? { fullPackageRepairCount: Number(input.fullPackageRepairCount) } : {}),
            ...(typeof input.selfCheckRuleVersion === "string" && input.selfCheckRuleVersion.trim() ? { selfCheckRuleVersion: input.selfCheckRuleVersion.trim() } : {}),
            generatedAt,
            ...(contract ? { contract } : {}),
            ...(directorSkill ? { directorSkill } : {}),
            ...(storyboardSkill ? { storyboardSkill } : {}),
            ...(seedanceSkill ? { seedanceSkill } : {}),
            materials,
            ...(authoringAudit ? { authoringAudit } : {}),
            ...(qualityGateReport ? { qualityGateReport } : {}),
        };
    }
    const directorSkill = normalizePackageSkillProvenance(input.directorSkill, "directorSkill");
    const seedanceSkill = normalizePackageSkillProvenance(input.seedanceSkill, "seedanceSkill");
    const rawMaterials = array(input.materials);
    const materials = rawMaterials.flatMap((item) => {
        const material = object(item);
        const role = text(material.role);
        const type = text(material.type);
        const alias = text(material.alias);
        const title = text(material.title);
        const contentHash = text(material.contentHash);
        if (!alias || !title || !contentHash || !/^[a-f0-9]{64}$/u.test(contentHash) || !["package-template", "story-source", "reference"].includes(role) || !["text", "markdown", "image", "video", "audio"].includes(type)) return [];
        return [{ alias, role: role as DramaProductionPackageAuthoringMaterial["role"], type: type as DramaProductionPackageAuthoringMaterial["type"], title, contentHash }];
    });
    const provider = text(input.provider);
    const runId = text(input.runId);
    const generatedAt = text(input.generatedAt);
    if (source !== "executeDramaScriptRun" || !generatedAt || !directorSkill || !seedanceSkill) throw new DramaProductionPackageError("制作包 authoring provenance 无效，必须记录 executeDramaScriptRun、导演 Skill 和视频 Skill");
    if (materials.length !== rawMaterials.length || new Set(materials.map((material) => material.alias)).size !== materials.length) throw new DramaProductionPackageError("制作包 authoring provenance 的素材记录无效或 alias 重复");
    const targetNarrativeChapter = typeof input.targetNarrativeChapter === "number" || typeof input.targetNarrativeChapter === "string" ? input.targetNarrativeChapter : undefined;
    const contractInput = object(input.contract);
    const contract = contractInput.id || contractInput.version || contractInput.contentHash ? normalizePackageContract(contractInput, options) : undefined;
    const authoringAudit = normalizeAuthoringAudit(input.authoringAudit);
    const qualityGateReport = normalizeQualityGateReport(input.qualityGateReport);
    return {
        source,
        ...(provider === "project-gpt" || provider === "codex-work-order" ? { provider } : {}),
        ...(input.authoringMode === "codex-standalone" || input.authoringMode === "project-gpt" ? { authoringMode: input.authoringMode } : {}),
        ...(input.canonicalSource === "structured-package" ? { canonicalSource: input.canonicalSource } : {}),
        ...(typeof input.projectionVersion === "string" && input.projectionVersion.trim() ? { projectionVersion: input.projectionVersion.trim() } : {}),
        ...(input.qualityGateStatus === "passed" || input.qualityGateStatus === "blocked" ? { qualityGateStatus: input.qualityGateStatus } : {}),
        ...(Number.isInteger(input.repairCount) && Number(input.repairCount) >= 0 ? { repairCount: Number(input.repairCount) } : {}),
        ...(Number.isInteger(input.fullPackageRepairCount) && Number(input.fullPackageRepairCount) >= 0 ? { fullPackageRepairCount: Number(input.fullPackageRepairCount) } : {}),
        ...(typeof input.authoringSchemaHash === "string" && /^[a-f0-9]{64}$/u.test(input.authoringSchemaHash) ? { authoringSchemaHash: input.authoringSchemaHash } : {}),
        ...(typeof input.qualityGateRulesHash === "string" && /^[a-f0-9]{64}$/u.test(input.qualityGateRulesHash) ? { qualityGateRulesHash: input.qualityGateRulesHash } : {}),
        ...(typeof input.repairPolicyHash === "string" && /^[a-f0-9]{64}$/u.test(input.repairPolicyHash) ? { repairPolicyHash: input.repairPolicyHash } : {}),
        ...(runId ? { runId } : {}),
        ...(targetNarrativeChapter !== undefined ? { targetNarrativeChapter } : {}),
        generatedAt,
        ...(contract ? { contract } : {}),
        directorSkill,
        seedanceSkill,
        materials,
        ...(authoringAudit ? { authoringAudit } : {}),
        ...(qualityGateReport ? { qualityGateReport } : {}),
    };
}

function normalizeAuthoringAudit(value: unknown): DramaAuthoringAudit | undefined {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    if (input.schemaVersion !== 1 || !Array.isArray(input.shots)) throw new DramaProductionPackageError("制作包 authoringAudit 格式无效");
    const shots = input.shots.flatMap((item) => {
        const shot = object(item);
        const shotId = text(shot.shotId);
        if (!shotId || !Array.isArray(shot.frames)) return [];
        const frames = shot.frames.flatMap((frameValue) => {
            const frame = object(frameValue);
            const frameId = text(frame.frameId);
            const values = ["subject", "trigger", "visibleAction", "visibleResult", "informationDelta", "cameraPurpose", "soundAnchor"].map((key) => text(frame[key]));
            if (!frameId || values.some((value) => !value)) return [];
            const [subject, trigger, visibleAction, visibleResult, informationDelta, cameraPurpose, soundAnchor] = values;
            return [{ frameId, subject, trigger, visibleAction, visibleResult, informationDelta, cameraPurpose, soundAnchor }];
        });
        if (frames.length !== shot.frames.length) return [];
        return [{ shotId, frames }];
    });
    if (shots.length !== input.shots.length || new Set(shots.map((shot) => shot.shotId)).size !== shots.length) throw new DramaProductionPackageError("制作包 authoringAudit 包含无效或重复镜头");
    return { schemaVersion: 1, shots };
}

function normalizePackageSkillProvenance(value: unknown, label: string) {
    const input = object(value);
    const id = text(input.id);
    const version = text(input.version);
    const contentHash = text(input.contentHash);
    if (!id || !version || !/^[a-f0-9]{64}$/u.test(contentHash)) throw new DramaProductionPackageError(`制作包 authoring provenance 缺少有效的 ${label} 版本或内容哈希`);
    return { id, version, contentHash };
}

function normalizePackageContract(value: Record<string, unknown>, options: DramaProductionPackageNormalizationOptions = {}) {
    const id = text(value.id);
    const version = text(value.version);
    const contentHash = text(value.contentHash);
    if (id !== DRAMA_PACKAGE_CONTRACT_ID || version !== DRAMA_PACKAGE_CONTRACT_VERSION || contentHash !== DRAMA_PACKAGE_CONTRACT.contentHash) {
        const message = "制作包使用了过期或不一致的契约版本/内容哈希";
        if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
        options.importWarnings?.push(`${message}；已允许导入，已移除不受当前运行时确认的 authoring 契约凭据`);
        return undefined;
    }
    return { id: DRAMA_PACKAGE_CONTRACT_ID, version: DRAMA_PACKAGE_CONTRACT_VERSION, contentHash } as const;
}

function normalizeQualityGateReport(value: unknown): DramaQualityGateReport | undefined {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    const status = input.status === "passed" ? "passed" : input.status === "blocked" ? "blocked" : "";
    if (!status || !Array.isArray(input.checks)) throw new DramaProductionPackageError("制作包质量门禁报告格式无效");
    const checks = input.checks.flatMap((item) => {
        const check = object(item);
        const code = text(check.code);
        const severity = check.severity === "blocker" || check.severity === "warning" ? check.severity : "";
        if (!code || !severity) return [];
        const hasStatus = Object.prototype.hasOwnProperty.call(check, "status");
        const checkStatus: DramaQualityGateCheck["status"] =
            check.status === "passed" || check.status === "warning" || check.status === "blocked" ? check.status : hasStatus ? undefined : status === "blocked" && severity === "blocker" ? "blocked" : "passed";
        if (!checkStatus) return [];
        const repairScope: DramaQualityGateCheck["repairScope"] = check.repairScope === "shot" || check.repairScope === "package" ? check.repairScope : undefined;
        return [
            {
                code,
                status: checkStatus,
                severity: severity as "blocker" | "warning",
                scope: text(check.scope),
                ...(repairScope ? { repairScope } : {}),
                ...(Array.isArray(check.shotIds) ? { shotIds: strings(check.shotIds) } : {}),
                ...(Array.isArray(check.frameIds) ? { frameIds: strings(check.frameIds) } : {}),
                ...(Array.isArray(check.lockedFields) ? { lockedFields: strings(check.lockedFields) } : {}),
                evidence: text(check.evidence),
                sourceRefs: strings(check.sourceRefs),
                fixHint: text(check.fixHint),
            },
        ];
    });
    if (checks.length !== input.checks.length) throw new DramaProductionPackageError("制作包质量门禁报告包含无效检查项");
    if ((status === "blocked") !== checks.some((check) => check.status === "blocked")) throw new DramaProductionPackageError("制作包质量门禁报告状态与检查项不一致");
    return { status: status as "passed" | "blocked", checks };
}

function formatDramaQualityGateFailure(report: DramaQualityGateReport) {
    const blockers = report.checks
        .filter((check) => check.severity === "blocker")
        .slice(0, 5)
        .map((check) => `${check.code}: ${check.evidence}`)
        .join("；");
    return `制作包质量门禁未通过，禁止导入${blockers ? `：${blockers}` : ""}`;
}

function normalizePackageProductionPlan(bible: Record<string, unknown>) {
    const rawPlan = object(bible.productionPlan);
    const rawVisual = object(rawPlan.visual);
    const visualStyle = text(rawVisual.visualStyle) || text(bible.visualStyle);
    const artStyle = text(rawVisual.artStyle);
    const visualDirection = text(rawVisual.visualDirection);
    if (!Object.keys(rawPlan).length && !visualStyle && !artStyle && !visualDirection) return undefined;
    const fallback = defaultDramaProductionPlan("package");
    fallback.visual = {
        visualStyle,
        artStyle,
        ...(visualDirection ? { visualDirection } : {}),
        source: "agent",
    };
    return normalizeDramaProductionPlan(bible.productionPlan, fallback);
}

function validateProductionPackageCompleteness(value: Record<string, unknown>, options: DramaProductionPackageNormalizationOptions = {}) {
    const project = object(value.project);
    const bible = object(project.productionBible);
    validateRawProductionPlan(bible);
    const plan = normalizePackageProductionPlan(bible);
    const dialogueTiming = normalizeDialogueTimingPolicy(bible.dialogueTiming);
    const standaloneAuthoring = text(object(value.authoring).source) === "codex-standalone";
    if (!plan) throw new DramaProductionPackageError("制作包缺少 productionPlan");
    const referencesDisabled = plan?.references.minImages === 0 && plan.references.maxImages === 0;
    if (options.requireAgentAuthoring) {
        const authoring = object(value.authoring);
        if (authoring.source !== "executeDramaScriptRun") throw new DramaProductionPackageError("Agent 制作包缺少 authoring provenance，必须由 executeDramaScriptRun 生成");
        const directorSkill = object(authoring.directorSkill);
        const seedanceSkill = object(authoring.seedanceSkill);
        if (directorSkill.id !== DRAMA_VIDEO_DIRECTOR_SKILL.id || directorSkill.version !== DRAMA_VIDEO_DIRECTOR_SKILL.sourceVersion || directorSkill.contentHash !== DRAMA_VIDEO_DIRECTOR_SKILL.sourceContentHash)
            throw new DramaProductionPackageError("Agent 制作包使用了过期或不一致的导演 Skill 版本/内容哈希");
        if (seedanceSkill.id !== SEEDANCE_25_DIRECTOR_SKILL.id || seedanceSkill.version !== SEEDANCE_25_DIRECTOR_SKILL.sourceVersion || seedanceSkill.contentHash !== SEEDANCE_25_DIRECTOR_SKILL.sourceContentHash)
            throw new DramaProductionPackageError("Agent 制作包使用了过期或不一致的 Seedance 2.5 Skill 版本/内容哈希");
    }
    if (!standaloneAuthoring && !plan.skills.some((skill) => skill.id === DRAMA_VIDEO_DIRECTOR_SKILL.id)) throw new DramaProductionPackageError("制作包缺少必需的当前短剧视频导演 Skill");
    if (!standaloneAuthoring && !plan.skills.some((skill) => skill.id === "seedance-25-director")) throw new DramaProductionPackageError("制作包缺少必需的 Seedance 2.5 视频导演 Skill");
    if (plan.lockedAt && (!plan.visual.visualStyle.trim() || !plan.visual.artStyle.trim())) throw new DramaProductionPackageError("已锁定的制作方案必须包含具体的视觉风格和画风");
    if (plan.video.framePolicy === "agent" && plan.video.frameCount !== undefined) throw new DramaProductionPackageError("Agent 智能切分方案不能携带固定帧数");
    const assets = object(value.assets);
    const assetCodes = (key: string) =>
        new Set(
            array(assets[key])
                .map((item) => text(object(item).code))
                .filter(Boolean),
        );
    const characters = assetCodes("characters");
    const locations = assetCodes("locations");
    const props = assetCodes("props");
    for (const location of array(assets.locations)) {
        const item = object(location);
        if (isLegacySceneReferenceBoard(item)) throw new DramaProductionPackageError(`场景 ${text(item.code) || text(item.name) || "未命名"} 是旧九宫格资产，需要重新生成并审核高清场景全景图`);
    }
    for (const episode of array(value.episodes)) {
        for (const shot of array(object(episode).shots)) {
            const item = object(shot);
            const label = text(item.code) || text(item.title) || "镜头";
            const frameCount = array(object(item.framePlan).frames).length;
            const minFrameCount = plan.video.framePolicy === "agent" ? plan.frameCountRange?.min || 2 : 1;
            if (frameCount < minFrameCount || frameCount > (plan.video.framePolicy === "agent" ? plan.frameCountRange?.max || 11 : 9)) {
                const message = `${label}的逐帧计划必须包含 ${minFrameCount}-${plan.video.framePolicy === "agent" ? plan.frameCountRange?.max || 11 : 9} 个真实动作节点`;
                if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
                options.importWarnings?.push(`${message}；已允许导入，后续生成前需要补齐逐帧动作节点`);
            }
            if (plan.video.framePolicy === "fixed-4" && frameCount !== 4) {
                const message = `${label}的逐帧计划必须为 4 帧`;
                if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
                options.importWarnings?.push(`${message}；已允许导入，后续生成前需要补齐固定帧数`);
            }
            if (plan.video.framePolicy === "fixed-5" && frameCount !== 5) {
                const message = `${label}的逐帧计划必须为 5 帧`;
                if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
                options.importWarnings?.push(`${message}；已允许导入，后续生成前需要补齐固定帧数`);
            }
            if (!options.standaloneImport) {
                const performanceIssues = validateDramaPerformanceDetail(item.performancePlan as DramaShot["performancePlan"], undefined, 0, label);
                if (performanceIssues.length) {
                    const message = `${label}的制作包表演规划不完整：${performanceIssues[0]}`;
                    if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
                    options.importWarnings?.push(`${message}；已允许导入，后续生成前需要补齐表演规划`);
                }
                if (dialogueTiming?.requireUtteranceTimings) {
                    const timingIssues = dramaUtteranceTimingIssues(Number(item.duration), array(item.utterances) as DramaDialogueTimingInput[], true, label);
                    if (timingIssues.length) {
                        const message = timingIssues.join("；");
                        if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
                        options.importWarnings?.push(`${message}；已允许导入，后续生成前需要调整对白时间`);
                    }
                }
            }
            if (!text(item.locationCode) || !locations.has(text(item.locationCode))) throw new DramaProductionPackageError(`${label}缺少有效场景资产引用`);
            for (const code of strings(item.characterCodes)) if (!characters.has(code)) throw new DramaProductionPackageError(`${label}引用了不存在的角色资产 ${code}`);
            for (const code of strings(item.propCodes)) if (!props.has(code)) throw new DramaProductionPackageError(`${label}引用了不存在的道具资产 ${code}`);
            if (options.validateVideoPrompt) {
                const bindingIssues = validatePromptAssetBindings(text(item.videoPrompt), strings(item.characterCodes), strings(item.propCodes), text(item.locationCode), array(assets.characters), array(assets.props), array(assets.locations), label);
                if (bindingIssues.length) throw new DramaProductionPackageError(bindingIssues.join("；"));
            }
            if (!options.standaloneImport && /(?:运镜|焦段|推近|拉远|摇镜|跟拍|滑轨|环绕|吊臂|慢推|慢拉|后拉|时间段|时间轴|动作过程|对白|声音|口型)/u.test(dramaStaticFramePositiveText(text(item.imagePrompt))))
                throw new DramaProductionPackageError(`${label}的 imagePrompt 必须是单一静态画面，不能包含运镜、时间过程、对白或声音`);
            if (!options.standaloneImport && /(?:本内部镜头只执行|内部 ID|assetId|参考图清单|URL)/u.test(text(item.videoPrompt))) throw new DramaProductionPackageError(`${label}的 videoPrompt 不能包含内部说明、资产 ID、URL 或参考图清单`);
            if (!options.standaloneImport && !referencesDisabled) {
                const manifest = array(object(item.framePlan).referenceManifest);
                const has = (role: string, code: string) => manifest.some((entry) => object(entry).role === role && text(object(entry).assetId) === code);
                if (!has("scene_anchor", text(item.locationCode))) {
                    const message = `${label}的 referenceManifest 缺少当前场景锚点`;
                    if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
                    options.importWarnings?.push(`${message}；已允许导入，后续生成前需要补充场景参考绑定`);
                }
                for (const code of strings(item.characterCodes)) {
                    if (!has("character_anchor", code)) {
                        const message = `${label}的 referenceManifest 缺少角色 ${code} 锚点`;
                        if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
                        options.importWarnings?.push(`${message}；已允许导入，后续生成前需要补充角色参考绑定`);
                    }
                }
                for (const code of strings(item.propCodes)) {
                    if (!has("prop_anchor", code)) {
                        const message = `${label}的 referenceManifest 缺少道具 ${code} 锚点`;
                        if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
                        options.importWarnings?.push(`${message}；已允许导入，后续生成前需要补充道具参考绑定`);
                    }
                }
            }
        }
    }
}

function validateRawProductionPlan(bible: Record<string, unknown>) {
    const rawPlan = object(bible.productionPlan);
    const rawVideo = object(rawPlan.video);
    const rawShotDuration = rawVideo.shotDuration;
    const rawInternalCutPolicy = rawVideo.internalCutPolicy;
    const rawFramePolicy = rawVideo.framePolicy;
    if (rawShotDuration !== undefined && Number(rawShotDuration) !== 15 && Number(rawShotDuration) !== 30) throw new DramaProductionPackageError("制作包每镜时长只能为 15 秒或 30 秒");
    if (rawInternalCutPolicy !== undefined && !["adaptive", "dense-30s"].includes(String(rawInternalCutPolicy))) throw new DramaProductionPackageError("制作包内部切镜策略无效");
    if (rawFramePolicy !== undefined && !["fixed-4", "fixed-5", "agent"].includes(String(rawFramePolicy))) throw new DramaProductionPackageError("制作包帧数策略无效");
    if (rawFramePolicy === "agent" && rawVideo.frameCount !== undefined) throw new DramaProductionPackageError("Agent 智能切分方案不能携带固定帧数");
}

/**
 * Make continuity edges executable before a package is persisted or handed to a provider.
 * A carried entity's next entry state is derived from the previous exit state; generators
 * must describe intentional changes in the previous shot's exit, never by inventing a
 * second incompatible state at the next shot boundary.
 */
function synchronizeContinuityStates(episode: DramaProductionPackageEpisode): DramaProductionPackageEpisode {
    const shots = new Map(episode.shots.map((shot) => [shot.code, shot]));
    const synchronized = episode.shots.map((shot) => ({ ...shot, entryState: cloneState(shot.entryState), exitState: cloneState(shot.exitState) }));
    const synchronizedByCode = new Map(synchronized.map((shot) => [shot.code, shot]));
    for (const edge of episode.continuityEdges) {
        const from = shots.get(edge.fromShotCode);
        const to = synchronizedByCode.get(edge.toShotCode);
        if (!from || !to || !from.exitState) continue;
        const previousCharacters = new Map(from.exitState.characters.map((item) => [item.assetId, item]));
        const previousProps = new Map(from.exitState.props.map((item) => [item.assetId, item]));
        const carriedCharacters = new Set(edge.carryCharacterIds);
        const carriedProps = new Set(edge.carryPropIds);
        const firstFrame = to.framePlan?.frames[0];
        const firstFrameText = firstFrame ? [firstFrame.startPrompt, firstFrame.actionPrompt, firstFrame.transitionPrompt, firstFrame.endPrompt, firstFrame.imagePrompt].filter(Boolean).join("\n") : "";
        if (to.entryState) {
            to.entryState.characters = mergeCarriedEntities(to.entryState.characters, previousCharacters, carriedCharacters, edge.notes, firstFrameText);
            to.entryState.props = mergeCarriedEntities(to.entryState.props, previousProps, carriedProps, edge.notes, firstFrameText);
        }
        if (edge.inheritActualEndFrame) {
            if (to.framePlan) to.framePlan = { ...to.framePlan, start: { source: "previous_accepted_actual_tail" } };
        }
    }
    return { ...episode, shots: synchronized };
}

function mergeCarriedEntities<T extends DramaContinuityEntityState>(current: T[], previous: Map<string, T>, carried: Set<string>, edgeNotes: string | undefined, firstFrameText: string) {
    const result = current.map((item) => {
        const previousItem = previous.get(item.assetId);
        if (!carried.has(item.assetId) || !previousItem) return item;
        return continuityStateChangeIsIntentional(previousItem, item, edgeNotes, firstFrameText) ? ({ ...previousItem, ...item } as T) : previousItem;
    });
    const present = new Set(result.map((item) => item.assetId));
    for (const assetId of carried) {
        const item = previous.get(assetId);
        if (item && !present.has(assetId)) result.push(item);
    }
    return result;
}

function cloneState<T extends DramaProductionPackageEpisode["shots"][number]["entryState"]>(state: T): T {
    if (!state) return state;
    return {
        ...state,
        characters: state.characters.map((item) => ({ ...item })),
        props: state.props.map((item) => ({ ...item })),
    } as T;
}

function normalizeSeriesBible(value: unknown): DramaSeriesBible | undefined {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    return {
        version: "series-bible-v1",
        canonCharacters: strings(input.canonCharacters),
        immutableRules: strings(input.immutableRules),
        relationshipState: text(input.relationshipState),
        worldRules: strings(input.worldRules),
        unresolvedThreads: strings(input.unresolvedThreads),
        visualMotifs: strings(input.visualMotifs),
        soundMotifs: strings(input.soundMotifs),
        previousEpisodeExitState: normalizeState(input.previousEpisodeExitState),
    };
}

function normalizeProductionArchive(value: unknown): DramaProductionPackageV1["archive"] {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    return {
        formatVersion: "vozeb-drama-production-package-v1",
        sections: array(input.sections).flatMap((item) => {
            const section = object(item);
            const title = text(section.title);
            return title ? [{ code: text(section.code), title, content: text(section.content) }] : [];
        }),
        promptAssets: array(input.promptAssets).flatMap((item) => {
            const asset = object(item);
            const code = text(asset.code);
            const prompt = text(asset.prompt);
            const category = asset.category === "storyboard" ? ("storyboard" as const) : ("keyframe" as const);
            return code && prompt ? [{ code, category, title: text(asset.title) || code, prompt: formatPromptFieldLines(prompt, category === "storyboard" ? "video" : "static"), shotCodes: strings(asset.shotCodes) }] : [];
        }),
        dialogueDirections: array(input.dialogueDirections).flatMap((item) => {
            const direction = object(item);
            const id = text(direction.id);
            return id
                ? [
                      {
                          id,
                          shotCode: text(direction.shotCode),
                          speaker: text(direction.speaker),
                          text: text(direction.text),
                          performance: text(direction.performance),
                          lipSync: Boolean(direction.lipSync),
                          ...(finiteNumber(direction.startSecond) !== undefined ? { startSecond: finiteNumber(direction.startSecond) } : {}),
                          ...(finiteNumber(direction.endSecond) !== undefined ? { endSecond: finiteNumber(direction.endSecond) } : {}),
                          ...(finiteNumber(direction.pauseBeforeSeconds) !== undefined ? { pauseBeforeSeconds: finiteNumber(direction.pauseBeforeSeconds) } : {}),
                          ...(finiteNumber(direction.pauseAfterSeconds) !== undefined ? { pauseAfterSeconds: finiteNumber(direction.pauseAfterSeconds) } : {}),
                          ...(optionalText(direction.speechRate) ? { speechRate: optionalText(direction.speechRate) } : {}),
                          ...(finiteNumber(direction.speechRateCharsPerSecond) !== undefined ? { speechRateCharsPerSecond: finiteNumber(direction.speechRateCharsPerSecond) } : {}),
                      },
                  ]
                : [];
        }),
        voiceDirections: array(input.voiceDirections).flatMap((item) => {
            const direction = object(item);
            const subject = text(direction.subject);
            return subject ? [{ subject, direction: text(direction.direction) }] : [];
        }),
        silenceDirections: array(input.silenceDirections).flatMap((item) => {
            const direction = object(item);
            const shotCode = text(direction.shotCode);
            return shotCode ? [{ shotCode, direction: text(direction.direction) }] : [];
        }),
        referencePlan: array(input.referencePlan).flatMap((item) => {
            const plan = object(item);
            const asset = text(plan.asset);
            return asset ? [{ priority: Math.max(1, Math.floor(Number(plan.priority) || 1)), asset, purpose: text(plan.purpose), planType: text(plan.planType), shotCodes: strings(plan.shotCodes) }] : [];
        }),
        generationOrder: strings(input.generationOrder),
        qcReport: text(input.qcReport),
    };
}

function isPackageSectionShotCode(code: string) {
    return /^SEC(?:0[1-9]|1[0-3])$/u.test(code);
}

/**
 * Agent packages must prove that every production field was authored before
 * normalization. Compatibility imports may still show warnings, but strict
 * package generation must never turn missing data into a plausible fallback.
 */
function validateRawAgentPackageDraft(input: Record<string, unknown>) {
    const errors: string[] = [];
    const episodes = array(input.episodes);
    if (!episodes.length) throw new DramaProductionPackageError("Agent 制作包缺少当前集镜头，不能进入严格生成流程");
    for (const [episodeIndex, value] of episodes.entries()) {
        const episode = object(value);
        if (Object.prototype.hasOwnProperty.call(episode, "episodeId")) errors.push(`episodes[${episodeIndex}].episodeId 是非契约字段；请使用 code`);
        const shots = array(episode.shots);
        if (!shots.length) errors.push(`第 ${episodeIndex + 1} 集缺少镜头列表`);
        for (const [shotIndex, value] of shots.entries()) {
            const shot = object(value);
            if (Object.prototype.hasOwnProperty.call(shot, "shotId")) errors.push(`episodes[${episodeIndex}].shots[${shotIndex}].shotId 是非契约字段；请使用 code`);
            if (Object.prototype.hasOwnProperty.call(shot, "shotDuration")) errors.push(`episodes[${episodeIndex}].shots[${shotIndex}].shotDuration 是非契约字段；请使用 duration`);
            const label = text(shot.code) || `第 ${episodeIndex + 1} 集镜头 ${shotIndex + 1}`;
            if (isPackageSectionShotCode(text(shot.code))) {
                errors.push(`${label} 是制作包章节伪镜头；章节必须写入 archive.sections`);
                continue;
            }
            if (!text(shot.imagePrompt)) errors.push(`${label}缺少 imagePrompt，必须由 Agent 直接填写静态画面提示词`);
            else {
                try {
                    normalizeShotStaticPrompt(text(shot.imagePrompt), `${label} imagePrompt`);
                } catch (error) {
                    errors.push(error instanceof Error ? error.message : `${label} imagePrompt 无法解析`);
                }
            }
            if (!text(shot.videoPrompt)) errors.push(`${label}缺少 videoPrompt，必须由 Agent 直接填写完整视频提示词`);
            const framePlan = object(shot.framePlan);
            const frameStart = object(framePlan.start);
            const frameEnd = object(framePlan.end);
            if (frameStart.source !== "independent" && frameStart.source !== "previous_accepted_actual_tail") errors.push(`${label} framePlan.start.source 无效`);
            if (typeof frameEnd.required !== "boolean") errors.push(`${label} framePlan.end.required 必须是布尔值`);
            const frames = array(framePlan.frames);
            if (!frames.length) errors.push(`${label}缺少逐帧计划`);
            for (const [frameIndex, frameValue] of frames.entries()) {
                const frame = object(frameValue);
                const frameLabel = `${label}第 ${frameIndex + 1} 个时间段`;
                if (!text(frame.actionPrompt) || !text(frame.transitionPrompt) || !text(frame.endPrompt)) errors.push(`${frameLabel}必须填写 actionPrompt、transitionPrompt 和 endPrompt`);
                if (frameIndex > 0 && text(frame.startPrompt) !== text(object(frames[frameIndex - 1]).endPrompt)) errors.push(`${frameLabel}的 startPrompt 必须原样承接上一段 endPrompt`);
                if (!text(frame.imagePrompt)) errors.push(`${frameLabel}缺少 imagePrompt`);
                else {
                    try {
                        normalizeShotStaticPrompt(text(frame.imagePrompt), `${frameLabel} imagePrompt`);
                    } catch (error) {
                        errors.push(error instanceof Error ? error.message : `${frameLabel} imagePrompt 无法解析`);
                    }
                }
            }
            const performance = normalizePerformancePlan(shot.performancePlan);
            const dialoguePerformance = normalizeDialoguePerformance(shot.dialoguePerformance);
            const utteranceCount = array(shot.utterances).filter((item) => object(item).type !== "voiceover").length;
            errors.push(...validateDramaPerformanceDetail(performance, dialoguePerformance, utteranceCount, label));
            const lighting = normalizeLightingPlan(shot.lightingPlan);
            const lightingFields: Array<[string, string | undefined]> = [
                ["palette", lighting?.palette],
                ["colorTemperature", lighting?.colorTemperature],
                ["keyLight", lighting?.keyLight],
                ["fillLight", lighting?.fillLight],
                ["rimLight", lighting?.rimLight],
                ["contrast", lighting?.contrast],
                ["materialResponse", lighting?.materialResponse],
                ["skinToneProtection", lighting?.skinToneProtection],
                ["inheritFromPrevious", lighting?.inheritFromPrevious],
                ["transitionToNext", lighting?.transitionToNext],
            ];
            for (const [field, fieldValue] of lightingFields) if (isGenericDramaDetail(fieldValue)) errors.push(`${label} lightingPlan.${field} 缺少具体内容`);
            const continuity = object(shot.continuity);
            for (const field of ["shotSize", "cameraAngle", "composition", "characterBlocking", "gazeDirection", "actionStart", "actionEnd", "screenDirection", "axisRule", "continuityNotes"])
                if (!text(continuity[field])) errors.push(`${label} continuity.${field} 缺少内容`);
            for (const boundary of ["entryState", "exitState"]) {
                const state = object(shot[boundary]);
                if (!Object.keys(state).length || !text(state.environment) || !text(state.lighting)) errors.push(`${label} ${boundary} 必须填写环境和灯光状态`);
            }
            if (!text(shot.dramaticFunction)) errors.push(`${label}缺少 dramaticFunction`);
            if (!text(shot.cameraMotion)) errors.push(`${label}缺少 cameraMotion`);
            if (!text(shot.lens)) errors.push(`${label}缺少 lens`);
        }
    }
    if (errors.length) throw new DramaProductionPackageError(`Agent 制作包草案不完整，禁止进入最终序列化：${errors.slice(0, 8).join("；")}`);
}

function normalizeEpisodePackage(value: unknown, episodeIndex: number, options: DramaProductionPackageNormalizationOptions & { backgroundNpcPolicyByLocationCode?: Map<string, DramaBackgroundNpcPolicy> } = {}): DramaProductionPackageEpisode {
    const input = object(value);
    const shots = array(input.shots).flatMap((value, index) => {
        const rawShot = object(value);
        const code = text(rawShot.code);
        if (isPackageSectionShotCode(code)) {
            const message = `章节 ${code} 被错误放入镜头列表；制作包一级章节必须写入 archive.sections，不能作为镜头`;
            if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
            options.importWarnings?.push(`${message}；已忽略该伪镜头，未写入当前集`);
            return [];
        }
        const shot = normalizePackageShot(value, index, options);
        return shot.code ? [shot] : [];
    });
    const shotCodes = new Set(shots.map((shot) => shot.code));
    return {
        code: text(input.code) || `E${String(episodeIndex + 1).padStart(2, "0")}`,
        title: text(input.title) || `第 ${episodeIndex + 1} 集`,
        script: text(input.script),
        outline: text(input.outline),
        hook: text(input.hook),
        nextPreview: text(input.nextPreview),
        sourceRange: text(input.sourceRange),
        storyScenes: array(input.storyScenes).map((value, index) => {
            const scene = object(value);
            return {
                code: text(scene.code) || `SC${String(index + 1).padStart(2, "0")}`,
                order: positiveNumber(scene.order) || index + 1,
                title: text(scene.title) || `场 ${index + 1}`,
                timeOfDay: optionalText(scene.timeOfDay),
                timeRange: optionalText(scene.timeRange),
                locationCode: optionalText(scene.locationCode),
                summary: text(scene.summary),
                shotCodes: strings(scene.shotCodes).filter((code) => shotCodes.has(code)),
            };
        }),
        shots,
        continuityEdges: array(input.continuityEdges).flatMap((value) => {
            const edge = object(value);
            const fromShotCode = text(edge.fromShotCode);
            const toShotCode = text(edge.toShotCode);
            if (!shotCodes.has(fromShotCode) || !shotCodes.has(toShotCode)) return [];
            return [
                {
                    fromShotCode,
                    toShotCode,
                    transition: ["continuous", "match_cut", "hard_cut", "scene_change", "jump_cut"].includes(text(edge.transition)) ? (text(edge.transition) as DramaContinuityEdge["transition"]) : "hard_cut",
                    inheritActualEndFrame: Boolean(edge.inheritActualEndFrame),
                    carryCharacterIds: strings(edge.carryCharacterIds),
                    carryPropIds: strings(edge.carryPropIds),
                    carryEnvironment: Boolean(edge.carryEnvironment),
                    carryAxis: Boolean(edge.carryAxis),
                    notes: optionalText(edge.notes),
                },
            ];
        }),
    };
}

function normalizePackageShot(value: unknown, index: number, options: DramaProductionPackageNormalizationOptions & { backgroundNpcPolicyByLocationCode?: Map<string, DramaBackgroundNpcPolicy> } = {}): DramaProductionPackageEpisode["shots"][number] {
    const shot = object(value);
    const framePlan = object(shot.framePlan);
    const frameStart = object(framePlan.start);
    const frameEnd = object(framePlan.end);
    const label = text(shot.code) || String(index + 1);
    const hasValidFramePlan = Boolean(Object.keys(framePlan).length && (frameStart.source === "independent" || frameStart.source === "previous_accepted_actual_tail") && typeof frameEnd.required === "boolean");
    if (!hasValidFramePlan) {
        if (!options.allowImportWarnings) throw new DramaProductionPackageError(`镜头 ${label} 缺少有效 framePlan；必须声明首帧来源和尾帧要求`);
        options.importWarnings?.push(`镜头 ${label} 缺少有效 framePlan；已允许导入，后续生成前需要补充首帧来源、尾帧要求和逐帧计划`);
    }
    if (!Object.keys(object(shot.entryState)).length || !Object.keys(object(shot.exitState)).length) {
        if (!options.allowImportWarnings) throw new DramaProductionPackageError(`镜头 ${label} 必须声明入口和出口状态`);
        options.importWarnings?.push(`镜头 ${label} 缺少入口或出口状态；已允许导入，后续生成前需要补充连续性状态`);
    }
    const continuity = object(shot.continuity);
    const utterances: DramaShot["utterances"] = array(shot.utterances).map((value, utteranceIndex) => {
        const utterance = object(value);
        const type: "dialogue" | "voiceover" = utterance.type === "voiceover" ? "voiceover" : "dialogue";
        return {
            id: text(utterance.id) || `utterance-${utteranceIndex + 1}`,
            order: positiveNumber(utterance.order) || utteranceIndex + 1,
            type,
            speaker: text(utterance.speaker),
            text: text(utterance.text),
            ...(finiteNumber(utterance.startSecond) !== undefined ? { startSecond: finiteNumber(utterance.startSecond) } : {}),
            ...(finiteNumber(utterance.endSecond) !== undefined ? { endSecond: finiteNumber(utterance.endSecond) } : {}),
            ...(finiteNumber(utterance.pauseBeforeSeconds) !== undefined ? { pauseBeforeSeconds: finiteNumber(utterance.pauseBeforeSeconds) } : {}),
            ...(finiteNumber(utterance.pauseAfterSeconds) !== undefined ? { pauseAfterSeconds: finiteNumber(utterance.pauseAfterSeconds) } : {}),
            ...(optionalText(utterance.speechRate) ? { speechRate: optionalText(utterance.speechRate) } : {}),
            ...(finiteNumber(utterance.speechRateCharsPerSecond) !== undefined ? { speechRateCharsPerSecond: finiteNumber(utterance.speechRateCharsPerSecond) } : {}),
        };
    });
    const title = text(shot.title) || `镜头 ${index + 1}`;
    const description = text(shot.description);
    const lighting = optionalText(shot.lighting) || "延续本场主光";
    const colorPalette = optionalText(shot.colorPalette) || "沿用项目主色板";
    const actionStart = text(continuity.actionStart) || description || title;
    const actionEnd = text(continuity.actionEnd) || description || title;
    const characterCodes = strings(shot.characterCodes);
    const propCodes = strings(shot.propCodes);
    const clueCodes = strings(shot.clueCodes);
    const locationCode = optionalText(shot.locationCode);
    if (options.validateVideoPrompt) validatePackageStateRequirements(shot.entryState, "入口", characterCodes, propCodes, text(shot.code) || String(index + 1));
    if (options.validateVideoPrompt) validatePackageStateRequirements(shot.exitState, "出口", characterCodes, propCodes, text(shot.code) || String(index + 1));
    const performanceFallback = defaultPerformancePlan(title, description, actionEnd, utterances.length > 0);
    const lightingFallback = defaultLightingPlan(lighting, colorPalette);
    const performancePlan = mergePerformancePlan(normalizePerformancePlan(shot.performancePlan), performanceFallback);
    const lightingPlan = mergeLightingPlan(normalizeLightingPlan(shot.lightingPlan), lightingFallback);
    const dialoguePerformance = mergeDialoguePerformance(normalizeDialoguePerformance(shot.dialoguePerformance), utterances);
    const timecode = parseTimecode(shot.timecode);
    const duration = timecode ? Math.max(1, timecode[1] - timecode[0]) : resolveDramaShotDuration(shot.duration, 5);
    let frames: ReturnType<typeof normalizeDramaFrameBeats> = [];
    try {
        const rawFrames = array(framePlan.frames);
        if (!rawFrames.length) throw new DramaProductionPackageError("缺少逐帧计划，必须由制作包明确提供每帧动作与静态画面状态");
        const sourceFrames = rawFrames.map((value, frameIndex) => {
            const frame = object(value);
            return {
                id: text(frame.id) || `${text(shot.code) || `shot-${index + 1}`}-frame-${frameIndex + 1}`,
                sequenceIndex: positiveNumber(frame.sequenceIndex) || frameIndex + 1,
                startSecond: Number(frame.startSecond),
                endSecond: Number(frame.endSecond),
                startPrompt: text(frame.startPrompt),
                actionPrompt: text(frame.actionPrompt),
                transitionPrompt: text(frame.transitionPrompt),
                endPrompt: text(frame.endPrompt),
                imagePrompt: text(frame.imagePrompt),
            };
        });
        frames = normalizeDramaFrameBeats(sourceFrames, duration);
        frames = frames.map((frame) => ({ ...frame, imagePrompt: formatPromptFieldLines(frame.imagePrompt, "static") }));
        const visualErrors = rawFrames.length && !options.standaloneImport ? validateDramaFramePlanVisuals(frames) : [];
        if (visualErrors.length) throw new DramaProductionPackageError(`镜头 ${text(shot.code) || index + 1} 的逐帧画面无效：${visualErrors.join("；")}`);
        if (options.validateVideoPrompt && !options.standaloneImport) {
            const npcPolicy = locationCode ? options.backgroundNpcPolicyByLocationCode?.get(locationCode) : undefined;
            const npcDeclaredInFramePlan = frames.some((frame) => /NPC群像|背景角色|配角|旁观者|人群/u.test(`${frame.actionPrompt}\n${frame.transitionPrompt}\n${frame.endPrompt}`));
            validateStrictPackageVideoPrompt(text(shot.videoPrompt), frames, text(shot.code) || String(index + 1), {
                requiresBackgroundNpc: npcPolicy?.mode === "required" || (options.requireContentQuality === true && npcDeclaredInFramePlan),
                backgroundNpcCountRange: npcPolicy?.countRange,
                requiresDialoguePerformance: utterances.some((item) => item.type === "dialogue"),
                dialogueUtterances: utterances,
                requireCameraPlan: options.requireCameraPlan,
                requireContentQuality: options.requireContentQuality,
                performancePlan,
            });
        }
    } catch (error) {
        const message = `镜头 ${label} 的逐帧计划无效：${error instanceof Error ? error.message : "无法解析"}`;
        if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
        options.importWarnings?.push(`${message}；已允许导入，当前镜头保留为空帧计划，需在分镜阶段补齐`);
    }
    let imagePrompt = "";
    try {
        imagePrompt = options.standaloneImport ? text(shot.imagePrompt).trim() : normalizeShotStaticPrompt(text(shot.imagePrompt), "镜头 imagePrompt");
    } catch (error) {
        const message = `${label}的 imagePrompt 无效：${error instanceof Error ? error.message : "无法解析"}`;
        if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
        options.importWarnings?.push(`${message}；已允许导入，后续生成前需要补充静态画面提示词`);
    }
    let videoPrompt = "";
    try {
        videoPrompt = options.preserveAuthoredVideoPrompt ? (typeof shot.videoPrompt === "string" ? shot.videoPrompt : "") : normalizePackageVideoPrompt(text(shot.videoPrompt));
    } catch (error) {
        const message = `${label}的 videoPrompt 无效：${error instanceof Error ? error.message : "无法解析"}`;
        if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
        options.importWarnings?.push(`${message}；已允许导入，后续生成前需要补充视频提示词`);
    }
    const normalizeOptionalStaticPrompt = (value: unknown, promptLabel: string) => {
        if (!optionalText(value)) return undefined;
        try {
            return options.standaloneImport ? text(value).trim() : normalizeShotStaticPrompt(text(value), promptLabel);
        } catch (error) {
            const message = `${label}的 ${promptLabel} 无效：${error instanceof Error ? error.message : "无法解析"}`;
            if (!options.allowImportWarnings) throw new DramaProductionPackageError(message);
            options.importWarnings?.push(`${message}；已允许导入，后续生成前需要补充静态帧提示词`);
            return undefined;
        }
    };
    const startFramePrompt = normalizeOptionalStaticPrompt(shot.startFramePrompt, "startFramePrompt");
    const endFramePrompt = normalizeOptionalStaticPrompt(shot.endFramePrompt, "endFramePrompt");
    return {
        code: text(shot.code),
        order: positiveNumber(shot.order) || index + 1,
        title,
        description,
        sourceText: text(shot.sourceText),
        shotBoundary: text(shot.shotBoundary),
        dialogue: text(shot.dialogue),
        narration: text(shot.narration),
        utterances,
        imagePrompt,
        videoPrompt,
        ...(startFramePrompt ? { startFramePrompt } : {}),
        ...(endFramePrompt ? { endFramePrompt } : {}),
        cameraMotion: text(shot.cameraMotion),
        negativePrompt: optionalText(shot.negativePrompt),
        continuity: {
            shotSize: text(continuity.shotSize) || defaultShotSize(description, title),
            cameraAngle: text(continuity.cameraAngle) || "视线高度平视，沿动作轴线拍摄",
            composition: text(continuity.composition) || "主体保持在9:16安全区，动作方向留出前进空间",
            characterBlocking: text(continuity.characterBlocking) || `按${description || title}的动作关系安排站位`,
            gazeDirection: text(continuity.gazeDirection) || "沿叙事动作方向，反应时回看对手或关键道具",
            actionStart,
            actionEnd,
            screenDirection: text(continuity.screenDirection) || "保持同侧屏幕运动方向",
            axisRule: text(continuity.axisRule) || "保持180度关系轴线，转场时明确切换",
            continuityNotes: text(continuity.continuityNotes) || "保持人物、道具、空间和光色状态连续",
        },
        duration,
        characterCodes,
        propCodes,
        clueCodes,
        locationCode,
        storySceneCode: optionalText(shot.storySceneCode),
        timecode: timecode ? `${timecode[0]}-${timecode[1]}s` : optionalText(shot.timecode),
        dramaticFunction: optionalText(shot.dramaticFunction),
        lens: optionalText(shot.lens),
        lighting,
        colorPalette,
        transitionIn: optionalText(shot.transitionIn),
        transitionOut: optionalText(shot.transitionOut),
        performanceNotes: optionalText(shot.performanceNotes),
        performancePlan,
        dialoguePerformance,
        lightingPlan,
        sound: normalizeSound(shot.sound),
        entryState: mergeState(normalizeState(shot.entryState), directorState(characterCodes, propCodes, title, lighting, actionStart)),
        exitState: mergeState(normalizeState(shot.exitState), directorState(characterCodes, propCodes, title, lighting, actionEnd)),
        framePlan: {
            start: { source: hasValidFramePlan ? (frameStart.source as "independent" | "previous_accepted_actual_tail") : "independent" },
            end: { required: hasValidFramePlan ? Boolean(frameEnd.required) : true },
            frames,
            ...(normalizeReferenceManifest(framePlan.referenceManifest).length ? { referenceManifest: normalizeReferenceManifest(framePlan.referenceManifest) } : {}),
            ...(object(framePlan.referenceCount).min || object(framePlan.referenceCount).max ? { referenceCount: normalizeReferenceCount(framePlan.referenceCount) } : {}),
        },
        sourceAssetIds: strings(shot.sourceAssetIds),
        continuityStatus: "ready",
        videoMode: shot.videoMode === "direct" ? "direct" : "storyboard",
        storyboardFrameMode: shot.storyboardFrameMode === "single" ? "single" : shot.storyboardFrameMode === "first_last" ? "first_last" : "all_frames",
    };
}

function normalizePackageVideoPrompt(value: string) {
    const prompt = value.trim();
    if (!prompt) throw new DramaProductionPackageError("镜头缺少 Agent 提供的视频提示词");
    return prompt;
}

function normalizeShotStaticPrompt(value: string, label: string) {
    const prompt = formatPromptFieldLines(value, "static");
    const error = validateDramaFrameVisualContent(prompt);
    if (error) throw new DramaProductionPackageError(`${label}无效：${error}`);
    return prompt;
}

function validateStrictPackageVideoPrompt(
    prompt: string,
    frames: ReadonlyArray<{ startSecond: number; endSecond: number; startPrompt?: string; actionPrompt: string; transitionPrompt?: string; endPrompt?: string }>,
    label: string,
    options: {
        requiresBackgroundNpc?: boolean;
        backgroundNpcCountRange?: { min: number; max: number };
        requiresDialoguePerformance?: boolean;
        dialogueUtterances?: DramaShot["utterances"];
        requireCameraPlan?: boolean;
        requireContentQuality?: boolean;
        performancePlan?: DramaShot["performancePlan"];
    } = {},
) {
    if (options.requireContentQuality) {
        const layoutErrors = validateDramaVideoPromptCardLayout(prompt, frames, label);
        if (layoutErrors.length) throw new DramaProductionPackageError(layoutErrors.join("；"));
        const timingErrors = validateDramaFrameTiming(frames, (options.dialogueUtterances || []) as DramaDialogueTimingInput[], label);
        if (timingErrors.length) throw new DramaProductionPackageError(timingErrors.join("；"));
    }
    if (options.requireCameraPlan) {
        const cameraError = validateDramaCameraPlan(prompt, frames);
        if (cameraError) throw new DramaProductionPackageError(label + "的 Agent videoPrompt 摄影契约无效：" + cameraError);
    }
    if (/(?:^|\\n)\\s*(?:触发|主体动作与反应)\\s*[：:]/u.test(prompt)) throw new DramaProductionPackageError(`${label}的 Agent videoPrompt 仍使用旧的顶层动作字段`);
    if (/(?:https?:\/\/|data:image\/|assetId|内部 ID|参考图职责|prompt-authoring-only|seedance-director|seedance-25-director)/iu.test(prompt)) throw new DramaProductionPackageError(`${label}的 Agent videoPrompt 包含内部执行信息`);
    if (!hasConcreteDramaCameraDirection(prompt)) throw new DramaProductionPackageError(`${label}的 Agent videoPrompt 缺少具体主运镜或机位语言`);
    const previousDialogueFragmentsByUtterance = new Map<string, string[]>();
    for (const [index, frame] of frames.entries()) {
        if (index > 0 && frame.startPrompt !== frames[index - 1].endPrompt) throw new DramaProductionPackageError(`${label}第 ${index + 1} 个时间段的起点必须原样承接上一段终点`);
        const requiresDialoguePerformance =
            options.requiresDialoguePerformance &&
            (options.dialogueUtterances?.some((utterance) => {
                if (utterance.type !== "dialogue") return false;
                const start = Number(utterance.startSecond);
                const end = Number(utterance.endSecond);
                return !Number.isFinite(start) || !Number.isFinite(end) ? true : start < frame.endSecond && end > frame.startSecond;
            }) ??
                true);
        const detailErrors = validateDramaVideoSegmentDetail(frame.actionPrompt, frame.transitionPrompt, frame.endPrompt, `${label}第 ${index + 1} 个时间段`, { ...options, requiresDialoguePerformance });
        if (detailErrors.length) throw new DramaProductionPackageError(detailErrors.join("；"));
        const activeDialogueUtterances = (options.dialogueUtterances || []).filter((utterance) => {
            if (utterance.type !== "dialogue") return false;
            const start = Number(utterance.startSecond);
            const end = Number(utterance.endSecond);
            return !Number.isFinite(start) || !Number.isFinite(end) ? true : start < frame.endSecond && end > frame.startSecond;
        });
        const dialogueOverlapError = dramaDialogueFragmentSequenceError(
            [frame.actionPrompt, frame.transitionPrompt || "", frame.endPrompt || ""].join("\n"),
            activeDialogueUtterances,
            previousDialogueFragmentsByUtterance,
            `${label}第 ${index + 1} 个时间段`,
        );
        if (dialogueOverlapError) throw new DramaProductionPackageError(dialogueOverlapError);
    }
    if (options.requireContentQuality) {
        const qualityErrors = validateDramaVideoAuthoringQuality(prompt, frames, options.performancePlan, label, { requiresBackgroundNpc: options.requiresBackgroundNpc });
        if (qualityErrors.length) throw new DramaProductionPackageError(qualityErrors.join("；"));
    }
}

function validatePromptAssetBindings(prompt: string, characterCodes: string[], propCodes: string[], locationCode: string, rawCharacters: unknown[], rawProps: unknown[], rawLocations: unknown[], label: string) {
    const errors: string[] = [];
    const bindingLine = prompt.match(/(?:^|\n)\s*素材绑定\s*[：:]([^\n]+)/u)?.[1] || extractDramaVideoPromptSection(prompt, "素材绑定");
    if (!bindingLine) return errors;
    const characters = rawCharacters.map(object);
    const props = rawProps.map(object);
    const locations = rawLocations.map(object);
    const location = locations.find((item) => text(item.code) === locationCode);
    const locationTerms = semanticAssetTerms(location);
    for (const characterCode of characterCodes) {
        const character = characters.find((item) => text(item.code) === characterCode);
        if (character && ![...semanticAssetTerms(character)].some((term) => bindingLine.includes(term))) errors.push(`${label}的素材绑定未明确写出角色 ${text(character.name) || characterCode}`);
    }
    if (location && ![...semanticAssetTerms(location)].some((term) => bindingLine.includes(term))) errors.push(`${label}的素材绑定未明确写出场景 ${text(location.name) || locationCode}`);
    const declared = new Set(propCodes);
    for (const propCode of propCodes) {
        const prop = props.find((item) => text(item.code) === propCode);
        if (prop && ![...semanticAssetTerms(prop)].some((term) => bindingLine.includes(term))) errors.push(`${label}的素材绑定未明确写出道具 ${text(prop.name) || propCode}`);
    }
    const shotSpecificPrompt = prompt.replace(/【素材绑定】[\s\S]*?(?=【故事意图】)/u, "").split(/(?:^|\n)\s*针对性约束\s*[：:]/u)[0];
    for (const prop of props) {
        const code = text(prop.code);
        if (!code || declared.has(code)) continue;
        const undeclaredTerm = [...semanticAssetTerms(prop)].find((term) => !locationTerms.has(term) && shotSpecificPrompt.includes(term));
        if (undeclaredTerm) errors.push(`${label}的视频 Prompt 提到了未绑定道具 ${text(prop.name) || code}（${undeclaredTerm}），请补入 propCodes 和 referenceManifest，或删除该道具事实`);
    }
    return errors;
}

function semanticAssetTerms(asset: Record<string, unknown> | undefined) {
    if (!asset) return new Set<string>();
    const source = text(asset.name);
    const terms = new Set<string>();
    for (const chunk of source.match(/[\p{Script=Han}A-Za-z0-9]{2,}/gu) || []) {
        terms.add(chunk);
        if (/^[\p{Script=Han}]+$/u.test(chunk)) {
            for (let size = 2; size <= Math.min(4, chunk.length); size += 1) {
                for (let start = 0; start + size <= chunk.length; start += 1) {
                    const term = chunk.slice(start, start + size);
                    if (!new Set(["桌面", "桌沿"]).has(term)) terms.add(term);
                }
            }
        }
    }
    return terms;
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeReferenceManifest(value: unknown) {
    return array(value).flatMap((item) => {
        const input = object(item);
        const alias = text(input.alias);
        const role = text(input.role);
        if (!alias || !["previous_actual_tail", "character_anchor", "scene_anchor", "prop_anchor", "action_keyframe", "composition_keyframe"].includes(role)) return [];
        return [{ alias, role: role as DramaReferenceManifestRole, purpose: text(input.purpose), assetId: optionalText(input.assetId), shotId: optionalText(input.shotId), frameEvidenceId: optionalText(input.frameEvidenceId) }];
    });
}

function normalizeReferenceCount(value: unknown) {
    const input = object(value);
    const min = Math.max(1, Math.floor(Number(input.min) || 1));
    const max = Math.max(min, Math.floor(Number(input.max) || min));
    return { min: Math.min(30, min), max: Math.min(30, max) };
}

function defaultShotSize(description: string, title: string) {
    const value = `${title}\n${description}`;
    if (/(眼神|嘴角|眉|手指|手部|握住|扣住|持握|手持|局部|细节|特写|近距离)/u.test(value)) return "近景或特写";
    if (/(抵达|远处|空间全貌|环境全貌|大范围|建立镜头|群像|全景|远景)/u.test(value)) return "全景或远景";
    return "中景";
}

function normalizePerformancePlan(value: unknown): DramaShot["performancePlan"] {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    const beat = (item: unknown) => {
        const value = object(item);
        return { emotion: text(value.emotion), facialAction: text(value.facialAction), gaze: text(value.gaze), bodyAction: text(value.bodyAction) };
    };
    return {
        emotionalObjective: text(input.emotionalObjective),
        emotionalArc: text(input.emotionalArc),
        speechStyle: text(input.speechStyle),
        pace: text(input.pace),
        breath: text(input.breath),
        restraintLevel: text(input.restraintLevel),
        beats: { start: beat(object(input.beats).start), middle: beat(object(input.beats).middle), end: beat(object(input.beats).end) },
    };
}

function normalizeDialoguePerformance(value: unknown): DramaShot["dialoguePerformance"] {
    return array(value).flatMap((item) => {
        const input = object(item);
        const utteranceId = text(input.utteranceId);
        return utteranceId
            ? [
                  {
                      utteranceId,
                      intent: text(input.intent),
                      tone: text(input.tone),
                      pace: text(input.pace),
                      pause: text(input.pause),
                      emphasis: text(input.emphasis),
                      facialReactionBefore: text(input.facialReactionBefore),
                      facialReactionDuring: text(input.facialReactionDuring),
                      facialReactionAfter: text(input.facialReactionAfter),
                  },
              ]
            : [];
    });
}

function normalizeLightingPlan(value: unknown): DramaShot["lightingPlan"] {
    const input = object(value);
    if (!Object.keys(input).length) return undefined;
    return {
        palette: text(input.palette),
        colorTemperature: text(input.colorTemperature),
        keyLight: text(input.keyLight),
        fillLight: text(input.fillLight),
        rimLight: text(input.rimLight),
        contrast: text(input.contrast),
        materialResponse: text(input.materialResponse),
        skinToneProtection: text(input.skinToneProtection),
        inheritFromPrevious: text(input.inheritFromPrevious),
        transitionToNext: text(input.transitionToNext),
    };
}

function mergePerformancePlan(current: DramaShot["performancePlan"], fallback: NonNullable<DramaShot["performancePlan"]>): NonNullable<DramaShot["performancePlan"]> {
    const value = (candidate: string | undefined, fallbackValue: string) => (candidate?.trim() && !isGenericDramaDetail(candidate) ? candidate.trim() : fallbackValue);
    const mergeBeat = (candidate: Partial<NonNullable<DramaShot["performancePlan"]>["beats"]["start"]> | undefined, fallbackBeat: NonNullable<DramaShot["performancePlan"]>["beats"]["start"]) => ({
        emotion: value(candidate?.emotion, fallbackBeat.emotion),
        facialAction: value(candidate?.facialAction, fallbackBeat.facialAction),
        gaze: value(candidate?.gaze, fallbackBeat.gaze),
        bodyAction: value(candidate?.bodyAction, fallbackBeat.bodyAction),
    });
    return {
        ...fallback,
        emotionalObjective: value(current?.emotionalObjective, fallback.emotionalObjective),
        emotionalArc: value(current?.emotionalArc, fallback.emotionalArc),
        speechStyle: value(current?.speechStyle, fallback.speechStyle),
        pace: value(current?.pace, fallback.pace),
        breath: value(current?.breath, fallback.breath),
        restraintLevel: value(current?.restraintLevel, fallback.restraintLevel),
        beats: {
            ...fallback.beats,
            start: mergeBeat(current?.beats?.start, fallback.beats.start),
            middle: mergeBeat(current?.beats?.middle, fallback.beats.middle),
            end: mergeBeat(current?.beats?.end, fallback.beats.end),
        },
    };
}

function mergeLightingPlan(current: DramaShot["lightingPlan"], fallback: NonNullable<DramaShot["lightingPlan"]>): NonNullable<DramaShot["lightingPlan"]> {
    return { ...fallback, ...(current || {}) };
}

function mergeState(current: DramaShot["entryState"], fallback: NonNullable<DramaShot["entryState"]>): NonNullable<DramaShot["entryState"]> {
    const mergeEntities = (items: NonNullable<DramaShot["entryState"]>["characters"] | undefined, fallbackItems: NonNullable<DramaShot["entryState"]>["characters"]) => {
        const fallbackByAssetId = new Map(fallbackItems.map((item) => [item.assetId, item]));
        return (items?.length ? items : fallbackItems).map((item) => ({ ...(fallbackByAssetId.get(item.assetId) || {}), ...item }));
    };
    const mergeProps = (items: NonNullable<DramaShot["entryState"]>["props"] | undefined, fallbackItems: NonNullable<DramaShot["entryState"]>["props"]) => {
        const fallbackByAssetId = new Map(fallbackItems.map((item) => [item.assetId, item]));
        return (items?.length ? items : fallbackItems).map((item) => ({ ...(fallbackByAssetId.get(item.assetId) || {}), ...item }));
    };
    return {
        ...fallback,
        ...(current || {}),
        characters: mergeEntities(current?.characters, fallback.characters),
        props: mergeProps(current?.props, fallback.props),
    };
}

function mergeDialoguePerformance(current: DramaShot["dialoguePerformance"], utterances: DramaShot["utterances"]): NonNullable<DramaShot["dialoguePerformance"]> {
    const fallback = defaultDialoguePerformance(utterances);
    const currentById = new Map((current || []).map((item) => [item.utteranceId, item]));
    const merged = fallback.map((item) => ({ ...item, ...(currentById.get(item.utteranceId) || {}) }));
    return [...merged, ...(current || []).filter((item) => !fallback.some((fallbackItem) => fallbackItem.utteranceId === item.utteranceId))];
}

function defaultPerformancePlan(title: string, description: string, actionEnd: string, hasSpeech: boolean): NonNullable<DramaShot["performancePlan"]> {
    const action = description || title;
    const focus = title || action;
    return {
        emotionalObjective: `在${focus}的冲突中守住当前立场，并把压力传递到镜头出口`,
        emotionalArc: `从进入${action}的克制状态开始，经由动作反应推进，在${actionEnd}前收束`,
        speechStyle: hasSpeech ? "台词贴合当下处境，语气清晰克制，重音落在行动关键信息" : "无对白，以呼吸、视线和动作反应传递情绪",
        pace: "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
        breath: "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
        restraintLevel: "中等克制，避免夸张表演",
        beats: {
            start: { emotion: `进入${focus}时承受压力但保持动作可控`, facialAction: `眉心收紧、下颌收住，表情回应${focus}`, gaze: `视线落向${focus}涉及的当前对象`, bodyAction: `双脚或座面提供支撑，手部停在${focus}相关的受力点` },
            middle: {
                emotion: `随着${focus}推进，压抑转为必须回应的紧张`,
                facialAction: `${focus}触发时眉心收紧、嘴角压住，呼吸在开口前停半拍`,
                gaze: `视线从当前对象转向${focus}带来的关键目标并停住`,
                bodyAction: `手指压紧受力点，肩背向前收，动作后保留半拍停顿`,
            },
            end: { emotion: `在${actionEnd}成立时把紧张收束为可继承的决定`, facialAction: `眉眼和嘴角停在${actionEnd}对应的结果表情`, gaze: `视线停在${actionEnd}要求的下一动作目标`, bodyAction: actionEnd },
        },
    };
}

function defaultDialoguePerformance(utterances: Array<{ id: string; text: string; type: string }>): NonNullable<DramaShot["dialoguePerformance"]> {
    return utterances
        .filter((utterance) => utterance.type === "dialogue")
        .map((utterance) => ({
            utteranceId: utterance.id,
            intent: `用“${utterance.text.slice(0, 24)}”推进当前冲突并改变对方的可见反应`,
            tone: "开口前压低下颌，语气清晰克制，关键字加重",
            pace: "按语义分句中速说出，重音前略放慢",
            pause: "关键称谓前停半拍，句末留出反应空间",
            emphasis: `重读“${utterance.text.slice(-12)}”的核心信息`,
            facialReactionBefore: "先抬眼确认对手，眉心收紧后开口",
            facialReactionDuring: "说到重音时嘴角压住，视线保持在对手或关键道具",
            facialReactionAfter: "说完闭口短停，呼气后保留对对手的盯视",
        }));
}

function defaultLightingPlan(lighting: string, colorPalette: string): NonNullable<DramaShot["lightingPlan"]> {
    return {
        palette: colorPalette,
        colorTemperature: "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
        keyLight: `${lighting}作为主光，明确来自画面主方向并照亮主体面部`,
        fillLight: "弱补光保留面部细节，阴影侧不完全压黑",
        rimLight: "以轻微轮廓光分离人物与背景，不制造硬边光晕",
        contrast: "中等反差，主体层次清晰，避免高光溢出",
        materialResponse: "金属、皮革和织物按真实材质反射，亮部克制",
        skinToneProtection: "保护肤色自然，不被环境色完全染色",
        inheritFromPrevious: "继承上一镜主光方向、色温和环境亮度",
        transitionToNext: "在动作结束处平滑过渡到下一镜主光和色板",
    };
}

function hasPerformancePlan(value: DramaShot["performancePlan"]) {
    return Boolean(value?.emotionalObjective || value?.emotionalArc || value?.speechStyle || value?.pace || value?.breath || value?.restraintLevel || Object.values(value?.beats || {}).some((beat) => Object.values(beat).some(Boolean)));
}

function hasLightingPlan(value: DramaShot["lightingPlan"]) {
    return Boolean(value && Object.values(value).some(Boolean));
}

function hasContinuityPlan(shot: DramaProductionPackageEpisode["shots"][number]) {
    return Boolean(
        Object.values(shot.continuity || {}).some(Boolean) ||
        Object.values(shot.entryState || {}).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value))) ||
        Object.values(shot.exitState || {}).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value))),
    );
}

function normalizePackageAsset(value: unknown, location = false, character = false): DramaProductionPackageAsset {
    const asset = object(value);
    const profile = object(asset.profile);
    const name = text(asset.name);
    const description = text(asset.description);
    const rawVisualIdentity = text(profile.visualIdentity);
    const visualIdentity = rawVisualIdentity && !/^不可变为/u.test(rawVisualIdentity) ? rawVisualIdentity : description || `${name}的固定外观与识别特征`;
    const sourceText = [description, text(profile.designPrompt)].filter(Boolean).join("\n");
    const rawStyling = text(profile.styling);
    const styling = rawStyling && !(location && /发型、服装、随身物件与材质按描述固定/u.test(rawStyling)) ? rawStyling : inferAssetStyling(sourceText, name, location);
    const colorPalette = text(profile.colorPalette) || inferAssetPalette(sourceText);
    const rawConsistencyRules = text(profile.consistencyRules);
    const spatialRules = strings(profile.spatialRules);
    const consistencyRules =
        rawConsistencyRules && !isGenericConsistencyRule(rawConsistencyRules)
            ? rawConsistencyRules
            : location
              ? inferLocationConsistencyRules(name, sourceText, spatialRules, styling, colorPalette)
              : `固定${name}的外观、服装、配色和动作状态，不随镜头重设计；${visualIdentity}`;
    const baseProfile = {
        visualIdentity,
        styling,
        colorPalette,
        consistencyRules,
        designPrompt: optionalText(profile.designPrompt) || description || undefined,
        identityAnchors: strings(profile.identityAnchors).length ? strings(profile.identityAnchors) : [visualIdentity],
        spatialRules,
        stateRules: strings(profile.stateRules),
        forbiddenChanges: strings(profile.forbiddenChanges),
    };
    return {
        code: text(asset.code),
        name,
        description,
        ...(optionalText(asset.supplierPrompt) ? { supplierPrompt: optionalText(asset.supplierPrompt) } : {}),
        payoff: optionalText(asset.payoff),
        activeEpisodeCodes: strings(asset.activeEpisodeCodes),
        profile: character ? normalizeDramaCharacterProfile(baseProfile, description, name) : baseProfile,
        ...(location
            ? {
                  sceneReferenceBoard: {
                      layout: isLegacySceneReferenceBoard(asset) ? ("legacy-3x3" as const) : ("panorama" as const),
                      ...(object(asset.sceneReferenceBoard).referenceId ? { referenceId: text(object(asset.sceneReferenceBoard).referenceId) } : {}),
                  },
              }
            : {}),
        ...(location && normalizeBackgroundNpcPolicy(asset.backgroundNpcPolicy) ? { backgroundNpcPolicy: normalizeBackgroundNpcPolicy(asset.backgroundNpcPolicy) } : {}),
    };
}

function normalizeBackgroundNpcPolicy(value: unknown): DramaBackgroundNpcPolicy | undefined {
    const policy = object(value);
    if (!Object.keys(policy).length) return undefined;
    const mode: DramaBackgroundNpcPolicy["mode"] = policy.mode === "required" || policy.mode === "forbidden" ? policy.mode : "auto";
    const guidance = optionalText(policy.guidance);
    const continuity = optionalText(policy.continuity);
    const range = object(policy.countRange);
    const min = Number.isInteger(Number(range.min)) ? Math.max(0, Number(range.min)) : undefined;
    const max = Number.isInteger(Number(range.max)) ? Math.max(min ?? 0, Number(range.max)) : undefined;
    const countRange = min !== undefined && max !== undefined ? { min, max } : undefined;
    const roster = Array.isArray(policy.roster)
        ? policy.roster.flatMap((item): DramaBackgroundNpcSlot[] => {
              const slot = object(item);
              const slotId = optionalText(slot.slotId);
              const worldAnchor = optionalText(slot.worldAnchor);
              const variant = optionalText(slot.variant);
              const defaultState = optionalText(slot.defaultState);
              return slotId && worldAnchor && variant && defaultState ? [{ slotId, worldAnchor, variant, defaultState }] : [];
          })
        : [];
    return { mode, ...(guidance ? { guidance } : {}), ...(continuity ? { continuity } : {}), ...(countRange ? { countRange } : {}), ...(roster.length ? { roster } : {}) };
}

function isLegacySceneReferenceBoard(value: unknown) {
    const asset = object(value);
    const boardLayout = text(object(asset.sceneReferenceBoard).layout);
    if (["3x3", "legacy-3x3"].includes(boardLayout)) return true;
    const profile = object(asset.profile);
    const source = [asset.description, asset.supplierPrompt, profile.visualIdentity, profile.designPrompt, profile.consistencyRules].map(text).filter(Boolean).join("\n");
    const withoutNegativeRules = source.replace(/(?:不生成|禁止(?:生成)?|不要|不得|无|避免)[^。；;\n]{0,24}(?:九宫格|九格|3\s*[x×*]\s*3|三列[\s\S]*三行|3列[\s\S]*3行)/gu, "");
    return /九宫格|九格|3\s*[x×*]\s*3|三列[\s\S]*三行|3列[\s\S]*3行/u.test(withoutNegativeRules);
}

function isGenericConsistencyRule(value: string) {
    return value === "按设计 Prompt 保持一致" || /^固定：不可变为/u.test(value);
}

function inferLocationConsistencyRules(name: string, source: string, spatialRules: string[], styling: string, colorPalette: string) {
    const fixedText = spatialRules.filter(Boolean).join("；") || styling || source.split("。格")[0] || `${name}的主要空间结构按设计基准锁定`;
    const paletteText = colorPalette && !colorPalette.startsWith("按制作包描述") ? `；环境色与光向保持${colorPalette}` : "";
    return `固定${name}的空间拓扑、入口方向、主要陈设位置与镜头轴线，不随镜头重排；${fixedText}${paletteText}。`;
}

function inferAssetStyling(source: string, name: string, location = false) {
    if (location) return source.match(/(?:陈设|材质|建筑|空间|地面|墙面|入口|固定元素|固定空间)(?:为|是|：)?([^。\n]+)/u)?.[0]?.trim() || `${name}的空间陈设、建筑结构、地面与环境材质按描述固定`;
    const match = source.match(/(?:服装|造型|制服|斗篷|外套|围裙)(?:为|是|：)?([^。\n]+)/u)?.[0]?.trim();
    return match || `${name}的发型、服装、随身物件与材质按描述固定`;
}

function inferAssetPalette(source: string) {
    const colors = [...new Set(source.match(/(?:深紫黑|紫黑|皇家深蓝|海军蓝|烟紫|深墨绿|灰蓝|炭灰|暗红|深棕|旧银|铁灰|煤黑|暗琥珀|浅灰蓝|亚麻金|深栗棕|灰绿色|琥珀棕)/gu) || [])];
    return colors.length ? colors.join("、") : "按制作包描述中的固有色保持跨镜头一致";
}

function collectWarnings(value: DramaProductionPackageV1) {
    const warnings: string[] = [];
    const assetCodes = new Set([...value.assets.characters, ...value.assets.locations, ...value.assets.props, ...value.assets.clues].map((asset) => asset.code));
    for (const episode of value.episodes) {
        for (const shot of episode.shots) {
            for (const code of [...shot.characterCodes, ...shot.propCodes, ...shot.clueCodes, ...(shot.locationCode ? [shot.locationCode] : [])]) if (!assetCodes.has(code)) warnings.push(`${episode.code}/${shot.code} 引用了不存在的资产 ${code}`);
            const timingReminder = dramaDialogueTimingReminder(shot.duration, shot.utterances as DramaDialogueTimingInput[], shot.dialogue, `${episode.code}/${shot.code}`);
            if (timingReminder) warnings.push(`对白时长提醒（不阻止导入）：${timingReminder.message}`);
            for (const frame of shot.framePlan?.frames || []) {
                const frameReminder = dramaFrameDialogueTimingReminder(frame.startSecond, frame.endSecond, frame.actionPrompt, shot.utterances as DramaDialogueTimingInput[], `${episode.code}/${shot.code} ${frame.id}`);
                if (frameReminder) warnings.push(`帧段对白时长提醒（不阻止导入）：${frameReminder.message}`);
            }
            for (const frameWarning of warnDramaFramePlanVisuals(shot.framePlan?.frames || [])) warnings.push(`${episode.code}/${shot.code}：${frameWarning}`);
            for (const frame of shot.framePlan?.frames || []) {
                for (const visualWarning of warnDramaFrameVisualContent(frame.imagePrompt)) warnings.push(`${episode.code}/${shot.code} ${frame.id}：${visualWarning}`);
                if (frame.imagePrompt.length > 1600) warnings.push(`${episode.code}/${shot.code} ${frame.id}：静态帧提示词较长，建议压缩重复设定`);
            }
        }
    }
    const plan = value.project.productionBible?.productionPlan;
    const frameCounts = value.episodes.flatMap((episode) => episode.shots.map((shot) => shot.framePlan?.frames.length || 0));
    for (const frameWarning of warnDramaFrameCountUniformity(frameCounts, plan?.video.framePolicy)) warnings.push(`全包帧数检查：${frameWarning}`);
    return [...new Set(warnings)];
}

function preferred(current: string | undefined, origins: Record<string, DramaFieldOrigin> | undefined, field: string, incoming: string) {
    return origins?.[field] === "manual" ? current || "" : incoming;
}
function mergeOrigins(current: Record<string, DramaFieldOrigin> | undefined, fields: string[]) {
    return { ...packageOrigins(fields), ...current };
}
function packageOrigins(fields: string[]) {
    return Object.fromEntries(fields.map((field) => [field, "package" as const]));
}
function parseObject(value: string) {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
}
function object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}
function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}
function optionalText(value: unknown) {
    return text(value) || undefined;
}
function finiteNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function strings(value: unknown) {
    return array(value).map(text).filter(Boolean);
}
function positiveNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function normalizeDialogueTimingPolicy(value: unknown): DramaProductionBible["dialogueTiming"] | undefined {
    const input = object(value);
    if (text(input.version) !== "utterance-timing-v1") return undefined;
    const charsPerSecond = finiteNumber(input.charsPerSecond);
    return {
        version: "utterance-timing-v1",
        charsPerSecond: charsPerSecond && charsPerSecond > 0 ? charsPerSecond : 5,
        requireUtteranceTimings: input.requireUtteranceTimings !== false,
    };
}
function normalizeKey(value: string) {
    return value.trim().toLocaleLowerCase();
}
function hasCodeAndName(value: DramaProductionPackageAsset) {
    return Boolean(value.code && value.name);
}
function normalizeSound(value: unknown) {
    const sound = object(value);
    return Object.keys(sound).length ? { ambience: optionalText(sound.ambience), soundEffects: optionalText(sound.soundEffects), music: optionalText(sound.music) } : undefined;
}
function normalizeState(value: unknown) {
    const state = object(value);
    const entities = (input: unknown) =>
        array(input).flatMap((value) => {
            const entity = object(value);
            const assetId = text(entity.assetId);
            return assetId
                ? [
                      {
                          assetId,
                          ...optionalRecord({
                              wardrobe: optionalText(entity.wardrobe),
                              position: optionalText(entity.position),
                              gaze: optionalText(entity.gaze),
                              pose: optionalText(entity.pose),
                              expression: optionalText(entity.expression),
                              action: optionalText(entity.action),
                              state: optionalText(entity.state),
                              holderId: optionalText(entity.holderId),
                          }),
                      },
                  ]
                : [];
        });
    return Object.keys(state).length
        ? { characters: entities(state.characters), props: entities(state.props), environment: optionalText(state.environment), lighting: optionalText(state.lighting), axis: optionalText(state.axis), screenDirection: optionalText(state.screenDirection) }
        : undefined;
}

function validatePackageStateRequirements(value: unknown, boundary: string, characterCodes: string[], propCodes: string[], label: string) {
    const state = object(value);
    if (!optionalText(state.environment) || !optionalText(state.lighting)) throw new DramaProductionPackageError(`${label}的${boundary}状态必须包含环境和灯光状态`);
    const entities = (key: "characters" | "props") => array(state[key]).map(object);
    const characters = entities("characters");
    for (const code of characterCodes) {
        const entity = characters.find((item) => text(item.assetId) === code);
        if (!entity || !optionalText(entity.position) || !optionalText(entity.gaze) || !optionalText(entity.pose) || !optionalText(entity.action))
            throw new DramaProductionPackageError(`${label}的${boundary}角色状态必须为 ${code} 写明 position、gaze、pose 和 action`);
    }
    const props = entities("props");
    for (const code of propCodes) {
        const entity = props.find((item) => text(item.assetId) === code);
        if (!entity || !optionalText(entity.state) || !optionalText(entity.holderId)) throw new DramaProductionPackageError(`${label}的${boundary}道具状态必须为 ${code} 写明 state 和 holderId`);
    }
}

function optionalRecord<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

function parseTimecode(value: unknown): [number, number] | undefined {
    if (typeof value !== "string") return undefined;
    const matches = [...value.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    if (matches.length < 2 || matches[1] <= matches[0]) return undefined;
    return [matches[0], matches[1]];
}

function directorState(characterCodes: string[], propCodes: string[], environment: string, lighting: string, action: string) {
    const holder: Record<string, string> = { P01: "C01", P02: "C01", P03: "C05", P04: "C06", P05: "C02", P06: "C07", P07: "C06", P08: "C06" };
    return {
        characters: characterCodes.map((assetId, index) => ({
            assetId,
            wardrobe: "系列圣经标准造型",
            position: index === 0 ? "画面左侧或前景" : "画面右侧或后景",
            gaze: index === 0 ? "沿镜头轴线向右" : "沿镜头轴线向左",
            pose: "克制站姿或自然坐姿",
            expression: "按本镜表演说明",
            action,
        })),
        props: propCodes.map((assetId) => ({ assetId, state: action, holderId: holder[assetId] || characterCodes[0] || "environment" })),
        environment,
        lighting,
        axis: "保持180度人物关系轴线",
        screenDirection: "角色移动方向沿场景既定动线",
    };
}

function validateSplitShotFramePlans(episodes: DramaProductionPackageEpisode[], allowImportWarnings = false) {
    for (const episode of episodes) {
        for (let index = 0; index < episode.shots.length; index += 1) {
            const parsed = splitShotTitle(episode.shots[index].title);
            if (!parsed || parsed.part !== 1) continue;
            const group = episode.shots.slice(index, index + parsed.total);
            if (group.length !== parsed.total || group.some((shot, part) => !sameSplitShotTitle(shot.title, parsed.base, part + 1, parsed.total))) continue;
            const plans = group.map((shot) => JSON.stringify(shot.framePlan.frames.map((frame) => [frame.actionPrompt, frame.imagePrompt])));
            if (new Set(plans).size !== plans.length && !allowImportWarnings) throw new DramaProductionPackageError(`${parsed.base}的拆分镜头复用了整套逐帧计划，请分别提供每段的独立动作与静态状态`);
            index += parsed.total - 1;
        }
    }
}

function splitShotTitle(title: string) {
    const match = title.match(/^(.*?)\s+(\d+)\/(\d+)$/u);
    if (!match) return undefined;
    return { base: match[1].trim(), part: Number(match[2]), total: Number(match[3]) };
}

function sameSplitShotTitle(title: string, base: string, part: number, total: number) {
    const parsed = splitShotTitle(title);
    return parsed?.base === base && parsed.part === part && parsed.total === total;
}
function inheritCarriedStates<T extends DramaProductionPackageEpisode["shots"][number]>(shots: T[]): T[] {
    return shots.map((shot, index) => {
        const previous = shots[index - 1];
        if (!previous?.exitState || !shot.entryState) return shot;
        const previousCharacters = new Map(previous.exitState.characters.map((item) => [item.assetId, item]));
        const previousProps = new Map(previous.exitState.props.map((item) => [item.assetId, item]));
        return {
            ...shot,
            entryState: {
                ...shot.entryState,
                characters: shot.entryState.characters.map((item) => previousCharacters.get(item.assetId) || item),
                props: shot.entryState.props.map((item) => previousProps.get(item.assetId) || item),
            },
        } as T;
    });
}
