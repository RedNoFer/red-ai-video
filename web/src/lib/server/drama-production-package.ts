import { createHash } from "node:crypto";

import { nanoid } from "nanoid";

import type {
    DramaContinuityEdge,
    DramaEpisode,
    DramaFieldOrigin,
    DramaNamedAsset,
    DramaProductionPackageAsset,
    DramaProductionPackageEpisode,
    DramaProductionPackagePreview,
    DramaProductionPackageV1,
    DramaProject,
    DramaReferenceManifestRole,
    DramaSeriesBible,
    DramaShot,
    DramaStoryScene,
} from "@/lib/drama-project-contract";
import { normalizeDramaProductionPlan } from "@/lib/drama-production-plan";
import { formatPromptFieldLines, normalizeDramaFrameBeats, upgradeDramaFrameImagePrompt, validateDramaFramePlanVisuals } from "@/lib/drama-frame-sequence";
import { dramaDialogueTimingIssue, dramaFrameDialogueTimingIssue, type DramaDialogueTimingInput } from "@/lib/drama-dialogue-timing";
import { resolveDramaStyleContract } from "@/lib/drama-style";
import { resolveDramaShotDuration } from "@/lib/server/drama-shot-config";

export class DramaProductionPackageError extends Error {}

type DramaProjectAssetCollection = Pick<DramaProject, "characters" | "scenes" | "props" | "clues">;

/**
 * Builds the stable, non-media asset catalog that a chapter package must reuse.
 * URLs stay out of the planner context; the project IDs and reference status are
 * enough for the later server-side binding step.
 */
export function buildDramaAssetReuseContext(project: DramaProjectAssetCollection, episode?: Pick<DramaEpisode, "code" | "shots">) {
    const usedIds = new Set(
        (episode?.shots || []).flatMap((shot) => [
            ...(shot.characterIds || []),
            ...(shot.propIds || []),
            ...(shot.sceneId ? [shot.sceneId] : []),
            ...(shot.clueIds || []),
        ]),
    );
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
        profile: asset.profile,
        fixed: true,
        usedInCurrentEpisode: usedIds.has(asset.id),
        activeEpisodeCodes: asset.activeEpisodeCodes || [],
        references: (asset.references || []).map((reference) => ({ id: reference.id, label: reference.label, status: reference.status, reviewStatus: reference.reviewStatus })),
        primaryReferenceId: asset.primaryReferenceId,
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
            characters: mergeProjectAssetCollection(assets.characters, project.characters, "C", referenced.C, episodeCodes),
            locations: mergeProjectAssetCollection(assets.locations, project.scenes, "S", referenced.S, episodeCodes),
            props: mergeProjectAssetCollection(assets.props, project.props, "P", referenced.P, episodeCodes),
            clues: mergeProjectAssetCollection(assets.clues, project.clues, "L", referenced.L, episodeCodes),
        },
    };
}

function mergeProjectAssetCollection(incoming: DramaProductionPackageAsset[], existing: DramaNamedAsset[], prefix: string, referenced: Set<string>, episodeCodes: Set<string>) {
    const codes = allocateAssetCodes(existing, prefix);
    const existingWithCodes = existing.map((asset, index) => ({ asset, code: codes[index] }));
    const byCode = new Map(incoming.map((asset) => [asset.code, asset]));
    const byName = new Map(incoming.map((asset) => [normalizeKey(asset.name), asset]));
    const merged = existingWithCodes.map(({ asset, code }) => {
        const current = asset.code ? byCode.get(code) || byName.get(normalizeKey(asset.name)) : byName.get(normalizeKey(asset.name)) || byCode.get(code);
        const activeEpisodeCodes = asset.activeEpisodeCodes?.length ? asset.activeEpisodeCodes : current?.activeEpisodeCodes;
        return {
            ...(current || {}),
            code,
            name: asset.name,
            description: asset.description,
            ...(asset.profile ? { profile: asset.profile } : current?.profile ? { profile: current.profile } : {}),
            ...(activeEpisodeCodes?.length || referenced.has(code) ? { activeEpisodeCodes: [...new Set([...(activeEpisodeCodes || []), ...(referenced.has(code) ? episodeCodes : [])])] } : {}),
        } as DramaProductionPackageAsset;
    });
    const existingKeys = new Set(existingWithCodes.flatMap(({ asset, code }) => [code, normalizeKey(asset.name)]));
    return [...merged, ...incoming.filter((asset) => !existingKeys.has(asset.code) && !existingKeys.has(normalizeKey(asset.name)))];
}

export function previewDramaProductionPackage(source: string, fileName = "production-package.json", project?: DramaProjectAssetCollection): DramaProductionPackagePreview {
    const trimmed = source.trim();
    if (!trimmed) throw new DramaProductionPackageError("制作包内容不能为空");
    const embedded = trimmed.match(/```(?:json|drama-production-package)[ \t]*\r?\n([\s\S]*?)```/i)?.[1];
    const format = fileName.toLowerCase().endsWith(".json") || trimmed.startsWith("{") ? "json" : "markdown";
    // The serialized Markdown embeds the canonical package object. Prefer it so
    // preview and apply use the same normalized source of truth.
    const parsed = format === "markdown" ? parseObject(embedded || "") || parseObject((embedded || "").replace(/\\u0060/gu, "`")) || parseDirectorMarkdown(trimmed) : parseObject(trimmed);
    if (!parsed) throw new DramaProductionPackageError("Markdown 制作包缺少可读取的标准清单或导演执行表");
    const packageWithProjectAssets = project ? mergeProjectAssetsIntoProductionPackage(parsed as DramaProductionPackageV1, project) : parsed;
    const normalizedPackage = normalizeProductionPackage(packageWithProjectAssets);
    const productionPackage = normalizedPackage;
    return {
        package: productionPackage,
        sourceHash: createHash("sha256").update(source).digest("hex"),
        format,
        warnings: collectWarnings(productionPackage),
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

export function applyDramaProductionPackage(project: DramaProject, source: DramaProductionPackageV1, sourceHash: string, rawSource?: string, fileName = "package.json"): DramaProject {
    const productionPackage = normalizeProductionPackage(source);
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
            framePlan: shouldPreserveManualFramePlan(shot.framePlan, shot.fieldOrigins?.framePlan) ? shot.framePlan : remapFramePlan(packageShot?.framePlan, characterIds, locationIds, propIds, clueIds, shotIds),
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
    if (origin !== "manual" || !framePlan?.frames?.length) return false;
    return framePlan.frames.every((frame) => {
        const prompt = frame.supplierPrompt || frame.imagePrompt;
        return (
            prompt.startsWith("静态关键帧：") &&
            prompt.includes("可见表演状态：") &&
            prompt.includes("景别：") &&
            prompt.includes("机位与构图：") &&
            prompt.includes("站位与视线：") &&
            prompt.includes("三层空间：") &&
            prompt.includes("光色与风格：") &&
            prompt.includes("负面约束：") &&
            !/参考图职责[：:]/u.test(prompt)
        );
    });
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
    } as DramaProductionPackageAsset;
}

function mergeManualFields<T extends { fieldOrigins?: Record<string, DramaFieldOrigin> }>(current: T | undefined, next: T): T {
    if (!current) return next;
    const result = { ...next } as Record<string, unknown>;
    for (const [field, origin] of Object.entries(current.fieldOrigins || {})) if (origin === "manual") result[field] = (current as Record<string, unknown>)[field];
    result.fieldOrigins = { ...next.fieldOrigins, ...current.fieldOrigins };
    return result as T;
}

function normalizeProductionPackage(value: unknown): DramaProductionPackageV1 {
    const input = object(value);
    if (Number(input.schemaVersion) !== 1) throw new DramaProductionPackageError("仅支持 schemaVersion 1 的制作包");
    const project = object(input.project);
    const bible = object(project.productionBible);
    const assets = object(input.assets);
    const episodes = array(input.episodes)
        .map(normalizeEpisodePackage)
        .filter((episode) => episode.shots.length);
    if (!episodes.length) throw new DramaProductionPackageError("制作包至少需要一个包含镜头的剧集");
    const normalizedAssets = {
        characters: dedupePackageAssets(
            array(assets.characters)
                .map((asset) => normalizePackageAsset(asset))
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
    const synchronizedEpisodes = normalizedEpisodes.map((episode) => synchronizeContinuityStates(repairOpeningCut(episode, text(project.title))));
    const styleContract = resolveDramaStyleContract({
        style: text(project.style),
        productionBible: { visualStyle: text(bible.visualStyle), colorScript: optionalText(bible.colorScript) },
    });
    const normalizedBible = {
        ...bible,
        visualStyle: styleContract.name,
        ...(styleContract.colorScript ? { colorScript: styleContract.colorScript } : {}),
    };
    validateProductionPackageCompleteness({ ...input, project: { ...project, productionBible: normalizedBible }, assets: normalizedAssets, episodes: synchronizedEpisodes });
    validateSplitShotFramePlans(synchronizedEpisodes);
    return {
        schemaVersion: 1,
        project: {
            title: text(project.title) || "未命名短剧",
            summary: text(project.summary),
            style: styleContract.name,
            ratio: text(project.ratio) || "9:16",
            productionBible: {
                targetPlatform: optionalText(bible.targetPlatform),
                language: text(bible.language) || "中文",
                ratio: text(bible.ratio) || text(project.ratio) || "9:16",
                targetDuration: positiveNumber(bible.targetDuration),
                visualStyle: styleContract.name,
                ...(styleContract.colorScript ? { colorScript: styleContract.colorScript } : {}),
                soundBible: optionalText(bible.soundBible),
                globalNegativePrompt: optionalText(bible.globalNegativePrompt),
                subtitleSafeArea: optionalText(bible.subtitleSafeArea),
                continuityMode: bible.continuityMode === "balanced" ? "balanced" : "strict",
                productionPlan: normalizeDramaProductionPlan(bible.productionPlan),
            },
        },
        assets: normalizedAssets,
        episodes: synchronizedEpisodes,
        seriesBible: normalizeSeriesBible(input.seriesBible),
        archive: normalizeProductionArchive(input.archive),
    };
}

function validateProductionPackageCompleteness(value: Record<string, unknown>) {
    const project = object(value.project);
    const bible = object(project.productionBible);
    const plan = normalizeDramaProductionPlan(bible.productionPlan);
    if (!plan?.skills.some((skill) => skill.id === "seedance-director")) throw new DramaProductionPackageError("制作包缺少必需的 Seedance 2.0 导演 Skill");
    if (!plan.skills.some((skill) => skill.id === "seedance-25-director")) throw new DramaProductionPackageError("制作包缺少必需的 Seedance 2.5 视频导演 Skill");
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
    for (const episode of array(value.episodes)) {
        for (const shot of array(object(episode).shots)) {
            const item = object(shot);
            const label = text(item.code) || text(item.title) || "镜头";
            if (!text(item.locationCode) || !locations.has(text(item.locationCode))) throw new DramaProductionPackageError(`${label}缺少有效场景资产引用`);
            for (const code of strings(item.characterCodes)) if (!characters.has(code)) throw new DramaProductionPackageError(`${label}引用了不存在的角色资产 ${code}`);
            for (const code of strings(item.propCodes)) if (!props.has(code)) throw new DramaProductionPackageError(`${label}引用了不存在的道具资产 ${code}`);
            if (/(?:运镜|焦段|推近|拉远|摇镜|跟拍|滑轨|环绕|吊臂|慢推|慢拉|后拉|时间段|时间轴|动作过程|对白|声音|口型)/u.test(text(item.imagePrompt)))
                throw new DramaProductionPackageError(`${label}的 imagePrompt 必须是单一静态画面，不能包含运镜、时间过程、对白或声音`);
            if (/(?:本内部镜头只执行|内部 ID|assetId|参考图清单|URL)/u.test(text(item.videoPrompt))) throw new DramaProductionPackageError(`${label}的 videoPrompt 不能包含内部说明、资产 ID、URL 或参考图清单`);
            const manifest = array(object(item.framePlan).referenceManifest);
            const has = (role: string, code: string) => manifest.some((entry) => object(entry).role === role && text(object(entry).assetId) === code);
            if (!has("scene_anchor", text(item.locationCode))) throw new DramaProductionPackageError(`${label}的 referenceManifest 缺少当前场景锚点`);
            for (const code of strings(item.characterCodes)) if (!has("character_anchor", code)) throw new DramaProductionPackageError(`${label}的 referenceManifest 缺少角色 ${code} 锚点`);
            for (const code of strings(item.propCodes)) if (!has("prop_anchor", code)) throw new DramaProductionPackageError(`${label}的 referenceManifest 缺少道具 ${code} 锚点`);
        }
    }
}

function repairOpeningCut<T extends DramaProductionPackageEpisode>(episode: T, projectTitle: string): T {
    const first = episode.shots[0];
    const second = episode.shots[1];
    const legacyOpening = first?.continuity?.actionStart === "黑湖、倒塔、四手与裂剑" && second?.continuity?.actionStart === "黑湖、倒塔、四手与裂剑";
    if (
        !/Mahadel|四界之心/u.test(projectTitle) ||
        !first ||
        !second ||
        first.code !== "SH001" ||
        second.code !== "SH002" ||
        first.title !== "黑湖记忆 1/2" ||
        second.title !== "黑湖记忆 2/2" ||
        !/黑湖/.test(first.description) ||
        !/马车/.test(second.description || second.sourceText) ||
        !legacyOpening
    )
        return episode;
    const firstActionEnd = "Karin掌心的完整剑刃裂开，手指仍扣住断口";
    const secondActionStart = firstActionEnd;
    const nextShots = episode.shots.map((shot, index) => {
        if (index === 0) {
            return {
                ...shot,
                duration: first.duration,
                timecode: first.timecode,
                description: "黑湖、倒塔、四手与裂剑；剑刃在 Karin 掌心裂开",
                sourceText: shot.sourceText.split(/Karin猛然睁眼/u)[0].trim(),
                videoPrompt:
                    "黑湖记忆中，倒悬高塔压在黑色湖面上，四只手在雪地中央扣紧；Karin握住完整剑刃，断口从掌心向外裂开。镜头沿倒塔轴线缓慢推进，冷风掠过无波湖面，裂剑发出细碎金属声，停在断口与仍未松开的手指上。结束画面：断裂剑刃的冷银断口占据画面中心。",
                continuity: { ...shot.continuity, actionStart: "黑湖、倒塔、四手与完整剑刃", actionEnd: firstActionEnd, continuityNotes: "断口匹配切" },
                framePlan: {
                    ...shot.framePlan,
                    start: { source: "independent" },
                    frames: openingCutFrames("SH001", first.duration, [
                        { action: "镜头由黑湖远景缓慢推进至雪地；Karin低头，完整剑刃贴在掌心，四只手刚刚扣住", image: "黑湖无波，倒悬古塔与Karin模糊倒影对齐；雪地中央四只手刚刚扣住，Karin低头看向掌心的完整剑刃" },
                        { action: "镜头继续推进到四只手与剑；Karin抬头看向倒悬古塔，双手收紧，剑身出现第一道裂纹", image: "雪地中央四只手彼此扣紧；Karin抬头看向倒悬古塔，双手收紧，完整剑刃出现第一道银色裂纹" },
                        { action: "剑刃从掌心断口向外裂开，冷银碎屑飞出；Karin眉眼骤然睁大，四只手仍未松开", image: "剑刃已经从掌心断口向外裂开，冷银碎屑停在断口周围；Karin眉眼骤然睁大、下颌绷紧，四只手仍扣住断剑" },
                        { action: "镜头骤停在冷银断口，Karin手指扣住碎裂剑刃；断口冷光匹配切入马车", image: "冷银断口占据前景中心，Karin手指扣住碎裂剑刃，视线锁定断口；断口冷光形成下一镜马车窗光的匹配切入口" },
                    ]),
                },
            };
        }
        if (index === 1) {
            return {
                ...shot,
                duration: second.duration,
                timecode: second.timecode,
                locationCode: "S06",
                description: "马车中的 Karin 从裂剑匹配切中惊醒，手扣住断剑，呼吸急促",
                sourceText: "裂开的剑刃断口与 Karin 扣紧的手指匹配切到马车内；Karin 猛然睁眼，手扣住断剑，呼吸急促。",
                videoPrompt: "从上一镜裂开的冷银断口匹配切到马车内同一只扣紧的手。Karin猛然睁眼，肩膀先绷紧再吸气，手掌继续压住断剑；车轮震动和急促呼吸成为声音锚点。镜头只做一次短促推近，结束画面停在他睁开的灰绿色眼睛与断剑握柄之间。",
                startFramePrompt: "上一镜已验收实际尾帧中的裂剑断口与扣紧手指作为唯一首帧依据；匹配切进入马车内，保持手指、断口方向和冷光连续。",
                endFramePrompt: "Karin在马车中睁眼并扣住断剑，呼吸急促，肩膀绷紧。",
                continuity: { ...shot.continuity, actionStart: secondActionStart, actionEnd: "Karin在马车中睁眼并扣住断剑，呼吸急促", continuityNotes: "继承上一镜断口，匹配切入马车" },
                framePlan: {
                    ...shot.framePlan,
                    start: { source: "previous_accepted_actual_tail" },
                    frames: openingCutFrames("SH002", second.duration, [
                        { action: "冷银断口匹配切入马车内同一只扣紧的手；车厢开始震动，Karin仍闭眼", image: "马车内同一只手压住断剑，指节发白，Karin闭眼伏在座位上；冷银断口方向与上一镜一致" },
                        { action: "车轮震动传入车厢；Karin肩膀骤然绷紧，手掌继续压住断剑", image: "马车内Karin肩膀绷紧，手掌压住断剑，指节发白；车窗冷光在剑柄上形成短促反光" },
                        { action: "Karin猛然睁开灰绿色眼睛，视线落向断剑，呼吸急促；手指收紧握柄", image: "Karin灰绿色眼睛已经睁开，视线落向断剑，嘴唇微张急促吸气；手指收紧握住断剑" },
                        { action: "镜头短促推近眼睛与剑柄之间；Karin完全惊醒，视线锁定握柄，肩膀保持绷紧", image: "Karin完全惊醒，灰绿色眼睛锁定断剑握柄，肩膀绷紧，手掌稳定扣住断剑；车厢冷光与暗影关系已经落定" },
                    ]),
                },
            };
        }
        return shot;
    });
    return { ...episode, shots: nextShots };
}

function openingCutFrames(code: string, duration: number, actions: Array<string | { action: string; image: string }>) {
    const stateLabels = ["场景与动作入口已建立", "镜头推进后的姿态与道具位置已改变", "关键动作结果已经发生", "结果状态与转场落点已经成立"];
    const entries = actions;
    const boundaries = entries.map((_, index) => Number(((duration * index) / entries.length).toFixed(3))).concat(duration);
    return entries.map((entry, index) => {
        const action = typeof entry === "string" ? entry : entry.action;
        const image = typeof entry === "string" ? entry : entry.image;
        return {
            id: `${code}-F${String(index + 1).padStart(2, "0")}`,
            sequenceIndex: index + 1,
            startSecond: boundaries[index],
            endSecond: boundaries[index + 1],
            actionPrompt: action,
            imagePrompt: formatPromptFieldLines(
                `静态关键帧：${image}；可见状态：${stateLabels[index] || "动作节点的可见结果已经成立"}；可见表演状态：${image}中的眉眼、视线、呼吸与手部/身体关系清晰可见；保持人物身份、服装、道具材质、空间轴线和光向连续；只呈现当前时间点已经发生的静态结果，不表现运动过程。`,
            ),
        };
    });
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
        if (to.entryState) {
            to.entryState.characters = mergeCarriedEntities(to.entryState.characters, previousCharacters, carriedCharacters);
            to.entryState.props = mergeCarriedEntities(to.entryState.props, previousProps, carriedProps);
        }
        if (edge.inheritActualEndFrame) {
            if (to.framePlan) to.framePlan = { ...to.framePlan, start: { source: "previous_accepted_actual_tail" } };
        }
    }
    return { ...episode, shots: synchronized };
}

function mergeCarriedEntities<T extends { assetId: string }>(current: T[], previous: Map<string, T>, carried: Set<string>) {
    const result = current.map((item) => (carried.has(item.assetId) && previous.has(item.assetId) ? previous.get(item.assetId)! : item));
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
            return id ? [{ id, shotCode: text(direction.shotCode), speaker: text(direction.speaker), text: text(direction.text), performance: text(direction.performance), lipSync: Boolean(direction.lipSync) }] : [];
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

function normalizeEpisodePackage(value: unknown, episodeIndex: number): DramaProductionPackageEpisode {
    const input = object(value);
    const shots = array(input.shots)
        .map(normalizePackageShot)
        .filter((shot) => shot.code);
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

function normalizePackageShot(value: unknown, index: number): DramaProductionPackageEpisode["shots"][number] {
    const shot = object(value);
    const framePlan = object(shot.framePlan);
    const frameStart = object(framePlan.start);
    const frameEnd = object(framePlan.end);
    if (!Object.keys(framePlan).length || (frameStart.source !== "independent" && frameStart.source !== "previous_accepted_actual_tail") || typeof frameEnd.required !== "boolean")
        throw new DramaProductionPackageError(`镜头 ${text(shot.code) || index + 1} 缺少有效 framePlan；必须声明首帧来源和尾帧要求`);
    if (!Object.keys(object(shot.entryState)).length || !Object.keys(object(shot.exitState)).length) throw new DramaProductionPackageError(`镜头 ${text(shot.code) || index + 1} 必须声明入口和出口状态`);
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
    const performanceFallback = defaultPerformancePlan(title, description, actionEnd, utterances.length > 0);
    const lightingFallback = defaultLightingPlan(lighting, colorPalette);
    const performancePlan = mergePerformancePlan(normalizePerformancePlan(shot.performancePlan), performanceFallback);
    const lightingPlan = mergeLightingPlan(normalizeLightingPlan(shot.lightingPlan), lightingFallback);
    const dialoguePerformance = mergeDialoguePerformance(normalizeDialoguePerformance(shot.dialoguePerformance), utterances);
    const timecode = parseTimecode(shot.timecode);
    const duration = timecode ? Math.max(1, timecode[1] - timecode[0]) : resolveDramaShotDuration(shot.duration, 5);
    const dialogueTiming = dramaDialogueTimingIssue(duration, utterances as DramaDialogueTimingInput[], text(shot.dialogue), `${text(shot.code) || `镜头 ${index + 1}`}`);
    if (dialogueTiming) throw new DramaProductionPackageError(dialogueTiming.message);
    let frames;
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
        for (const frame of frames) {
            const frameTiming = dramaFrameDialogueTimingIssue(frame.startSecond, frame.endSecond, frame.actionPrompt, utterances as DramaDialogueTimingInput[], `${text(shot.code) || `镜头 ${index + 1}`} ${frame.id}`);
            if (frameTiming) throw new DramaProductionPackageError(frameTiming.message);
        }
        frames = frames.map((frame) => ({
            ...frame,
            imagePrompt: upgradeDramaFrameImagePrompt(frame.imagePrompt, frame.actionPrompt, {
                description,
                shotSize: text(continuity.shotSize),
                cameraAngle: text(continuity.cameraAngle),
                composition: text(continuity.composition),
                characterBlocking: text(continuity.characterBlocking),
                gazeDirection: text(continuity.gazeDirection),
                lighting,
                colorPalette,
                performanceState: performanceStateForFrame(performancePlan, frame.sequenceIndex, frames.length),
                sequenceIndex: frame.sequenceIndex,
                frameCount: frames.length,
            }),
        }));
        const visualErrors = rawFrames.length ? validateDramaFramePlanVisuals(frames) : [];
        if (visualErrors.length) throw new DramaProductionPackageError(`镜头 ${text(shot.code) || index + 1} 的逐帧画面无效：${visualErrors.join("；")}`);
    } catch (error) {
        throw new DramaProductionPackageError(`镜头 ${text(shot.code) || index + 1} 的逐帧计划无效：${error instanceof Error ? error.message : "无法解析"}`);
    }
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
        imagePrompt: formatPromptFieldLines(text(shot.imagePrompt), "static"),
        videoPrompt: normalizePackageVideoPrompt(text(shot.videoPrompt)),
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
        locationCode: optionalText(shot.locationCode),
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
            start: { source: frameStart.source },
            end: { required: frameEnd.required },
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

function performanceStateForFrame(plan: DramaShot["performancePlan"], sequenceIndex: number, frameCount: number) {
    const beat = sequenceIndex <= 1 ? plan?.beats.start : sequenceIndex >= frameCount ? plan?.beats.end : plan?.beats.middle;
    return beat ? `情绪${beat.emotion}；面部${beat.facialAction}；视线${beat.gaze}；身体与手部${beat.bodyAction}` : "";
}

function normalizePackageVideoPrompt(value: string) {
    const prompt = value.trim();
    if (!prompt) throw new DramaProductionPackageError("镜头缺少 Agent 提供的视频提示词");
    return prompt;
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
    if (/(眼神|嘴角|眉|手指|戒指|护符|剑刃|特写|近距离)/u.test(value)) return "近景或特写";
    if (/(抵达|城门|远处|全貌|街道|塔楼|广场|全景)/u.test(value)) return "全景或远景";
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
    return {
        ...fallback,
        ...(current || {}),
        beats: {
            ...fallback.beats,
            ...(current?.beats || {}),
            start: { ...fallback.beats.start, ...(current?.beats?.start || {}) },
            middle: { ...fallback.beats.middle, ...(current?.beats?.middle || {}) },
            end: { ...fallback.beats.end, ...(current?.beats?.end || {}) },
        },
    };
}

function mergeLightingPlan(current: DramaShot["lightingPlan"], fallback: NonNullable<DramaShot["lightingPlan"]>): NonNullable<DramaShot["lightingPlan"]> {
    return { ...fallback, ...(current || {}) };
}

function mergeState(current: DramaShot["entryState"], fallback: NonNullable<DramaShot["entryState"]>): NonNullable<DramaShot["entryState"]> {
    return {
        ...fallback,
        ...(current || {}),
        characters: current?.characters?.length ? current.characters : fallback.characters,
        props: current?.props?.length ? current.props : fallback.props,
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
    return {
        emotionalObjective: `围绕${action}完成当前镜头的外在行动目标`,
        emotionalArc: `从进入${action}的克制状态开始，经由动作反应推进，在${actionEnd}前收束`,
        speechStyle: hasSpeech ? "台词贴合当下处境，语气清晰克制，重音落在行动关键信息" : "无对白，以呼吸、视线和动作反应传递情绪",
        pace: "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
        breath: "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
        restraintLevel: "中等克制，避免夸张表演",
        beats: {
            start: { emotion: "保持与上一状态一致", facialAction: "眉眼和下颌保持可读的初始反应", gaze: "沿当前镜头动作方向", bodyAction: `进入${action}` },
            middle: { emotion: "压力或目标逐步显现", facialAction: "眉眼、嘴角或下颌出现与动作对应的细微变化", gaze: "短暂聚焦关键人物或道具", bodyAction: "完成主要动作并保留反应停顿" },
            end: { emotion: "在下一镜头切点前完成情绪落点", facialAction: "固定最终表情，避免切点前漂移", gaze: "指向下一动作或转场方向", bodyAction: actionEnd },
        },
    };
}

function defaultDialoguePerformance(utterances: Array<{ id: string; text: string; type: string }>): NonNullable<DramaShot["dialoguePerformance"]> {
    return utterances
        .filter((utterance) => utterance.type === "dialogue")
        .map((utterance) => ({
            utteranceId: utterance.id,
            intent: "推动当前镜头行动并回应对手或环境",
            tone: "贴合当前情绪，清晰自然",
            pace: "按语义分句，中速完成",
            pause: "关键信息前短停，句末自然收束",
            emphasis: utterance.text,
            facialReactionBefore: "先以视线和眉眼确认对方或关键道具",
            facialReactionDuring: "说话时保持与行动一致的面部反应",
            facialReactionAfter: "说完保留短暂反应，衔接下一动作",
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

function normalizePackageAsset(value: unknown, location = false): DramaProductionPackageAsset {
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
    return {
        code: text(asset.code),
        name,
        description,
        payoff: optionalText(asset.payoff),
        activeEpisodeCodes: strings(asset.activeEpisodeCodes),
        profile: {
            visualIdentity,
            styling,
            colorPalette,
            consistencyRules,
            designPrompt: optionalText(profile.designPrompt) || description || undefined,
            identityAnchors: strings(profile.identityAnchors).length ? strings(profile.identityAnchors) : [visualIdentity],
            spatialRules,
            stateRules: strings(profile.stateRules),
            forbiddenChanges: strings(profile.forbiddenChanges),
        },
    };
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
        }
    }
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
function strings(value: unknown) {
    return array(value).map(text).filter(Boolean);
}
function positiveNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function normalizeKey(value: string) {
    return value.trim().toLocaleLowerCase();
}
function functionalRoleAsset(labelValue: string, description: string, index: number, knownCharacters: DramaProductionPackageAsset[]) {
    const label = labelValue.trim();
    if (/(木匣|声音|断剑|护符|探测器|短刃|银戒|锤柄|铜镜|剑鞘|马车|城门|高塔|黑湖|结界)/u.test(label)) return [];
    const aliases: Record<string, string> = { 检查官: "城门检查官", 观察者: "神秘观察者", 奥伦: "奥伦·奈特" };
    const canonicalName = aliases[label] || label;
    if (knownCharacters.some((asset) => normalizeKey(asset.name) === normalizeKey(canonicalName))) return [];
    return [packageAsset(`C${String(knownCharacters.length + index + 1).padStart(2, "0")}`, canonicalName, description, description, [description.split(/[；，]/).at(-1) || description])];
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

function optionalRecord<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

function parseDirectorMarkdown(source: string): DramaProductionPackageV1 | null {
    const shotRows = markdownTableRows(section(source, "## 四、镜头执行表", "## 五、"), 11).filter((row) => /^SH\d+$/i.test(row[0]));
    if (!shotRows.length) return null;
    const title = source.match(/^#\s*《([^》]+)》/m)?.[1] || "未命名短剧";
    const meta = source.match(/目标平台：([^｜\n]+)｜语言：([^｜\n]+)｜画幅：([^｜\n]+)｜成片：约\s*(\d+)\s*秒/);
    const episodeTitle = bullet(source, "集名").replace(/[《》]/g, "") || "第 1 集";
    const literary = section(source, "## 三、第一集文学剧本", "## 四、");
    const storySceneMatches = [...`${literary}\n### 场999｜END｜END｜0-0秒\n`.matchAll(/^###\s*场(\d+)｜([^｜\n]+)｜([^｜\n]+)｜([^\n]+)\n+([\s\S]*?)(?=^###\s*场\d+｜)/gm)].filter((match) => match[1] !== "999");
    const storyScenes = storySceneMatches.map((match) => {
        const timeRange = match[4].trim();
        const [start, end] = timeRangeSeconds(timeRange);
        const code = `SC${String(Number(match[1])).padStart(2, "0")}`;
        return {
            code,
            order: Number(match[1]),
            title: match[2].trim(),
            timeOfDay: match[3].trim(),
            timeRange,
            locationCode: storyLocationCode(Number(match[1])),
            summary: compactMarkdown(match[5]),
            shotCodes: shotRows.filter((row) => overlaps(timeRangeSeconds(row[1]), [start, end])).map((row) => row[0]),
        };
    });
    const characterAssets = markdownPromptAssets(section(source, "## 五、角色一致性资产", "## 六、"), /###\s*5\.\d+\s+([^｜\n]+)｜(C\d+)｜[^\n]*\n+```text\n([\s\S]*?)```/g);
    const functionalRoles = [...section(source, "### 5.5 本集功能角色 DNA", "## 六、").matchAll(/^-\s*([^：\n]+)：([^\n]+)/gm)].flatMap((match, index) => functionalRoleAsset(match[1], match[2], index, characterAssets));
    const locationAssets = [
        ...markdownPromptAssets(section(source, "## 六、场景一致性资产", "## 七、"), /###\s*6\.\d+\s+([^｜\n]+)｜(S\d+)｜[^\n]*\n+```text\n([\s\S]*?)```/g, true),
        packageAsset("S05", "黑湖记忆", "无风黑湖、倒悬古塔、雪地四手与冷白无源光", "黑湖贯穿竖幅，倒悬古塔位置固定，雪地位于画面下方，冷白无源光", ["倒悬塔位置", "无波黑湖", "雪地边界"], true),
        packageAsset("S06", "前往阿佐雷斯的马车", "中世纪封闭木马车，左右长凳、右侧竖向车窗、前进方向固定", "车厢长凳左右相对，Karin位于左侧、Rifa位于右侧，竖向车窗在Rifa身后，阴天柔光从右上进入", ["左右长凳", "右侧竖窗", "前进方向"], true),
    ];
    const props = [
        packageAsset("P01", "Karin的断剑", "暗银断剑、不对称双翼护手、剑柄缠深蓝旧布", "暗银断剑，不对称双翼护手，剑柄缠深蓝旧布", ["不对称双翼护手", "断口形态固定"]),
        packageAsset("P02", "失灵护符", "暗黄铜圆片，边缘有焦黑痕", "暗黄铜圆片护符", ["焦黑边缘"]),
        packageAsset("P03", "灵压探测器", "黄铜探测器，指针可停在零并从内部裂开", "皇家黄铜灵压探测器", ["黄铜材质"]),
        packageAsset("P04", "四点木匣", "带银裂痕与四点印记的窄木匣", "四点印记窄木匣", ["四点印记", "银色裂痕"]),
        packageAsset("P05", "Rifa短刃", "哑光钢刃、黑木握柄缠暗红细线、窄鞘固定右腰", "Rifa短刃正侧背细节卡", ["黑木红线握柄", "窄鞘", "右腰位置"]),
        packageAsset("P06", "四点银戒", "观察者右手佩戴的旧银戒，四个圆点等距排列", "四点银戒多角度细节卡", ["四点等距", "旧银材质"]),
        packageAsset("P07", "无头锤柄", "奥伦使用的深色旧木锤柄，没有锤头", "无头锤柄正侧面细节卡", ["无锤头", "旧木磨损"]),
        packageAsset("P08", "烟黑铜镜", "悬挂在铁砧上方、表面烟黑的旧铜镜", "烟黑铜镜正侧面细节卡", ["烟黑镜面", "铁砧上方位置"]),
    ];
    const soundRows = markdownTableRows(section(source, "## 十、声音设计", "## 十一、"), 4).filter((row) => /^SH\d+$/i.test(row[0]));
    const soundByShot = new Map(soundRows.map((row) => [row[0], { ambience: row[1], soundEffects: row[2], music: row[3] }]));
    const dialogueRows = markdownTableRows(section(source, "### 台词序列", "### 沉默设计"), 6).filter((row) => /^D\d+$/i.test(row[0]));
    const utterancesByShot = new Map<string, DramaProductionPackageEpisode["shots"][number]["utterances"]>();
    for (const row of dialogueRows) {
        const list = utterancesByShot.get(row[1]) || [];
        list.push({ id: row[0], order: list.length + 1, type: row[5] === "否" ? "voiceover" : "dialogue", speaker: row[2], text: row[3].replace(/^[“\"]|[”\"]$/g, "") });
        utterancesByShot.set(row[1], list);
    }
    const videoPrompts = new Map([...section(source, "## 十一、Seedance 分段视频 Prompt", "## 十二、").matchAll(/###\s*P(\d+)｜[^\n]*\n+```text\n([\s\S]*?)```/g)].map((match) => [`SH${match[1].padStart(2, "0")}`, match[2].trim()]));
    const archive = parseProductionArchive(source);
    const allCharacters = [...characterAssets, ...functionalRoles];
    const baseShots = shotRows.map((row, index) => {
        const code = row[0];
        const prompt = videoPrompts.get(code) || row[9];
        const utterances = utterancesByShot.get(code) || [];
        const storyScene = storyScenes.find((scene) => scene.shotCodes.includes(code));
        const characterCodes = allCharacters.filter((asset) => asset.activeEpisodeCodes?.includes("E01") && matchesAssetText(asset.name, `${prompt}\n${row[9]}`)).map((asset) => asset.code);
        const propCodes = props.filter((asset) => matchesAssetText(asset.name, `${prompt}\n${row[9]}`)).map((asset) => asset.code);
        const duration = timeRangeSeconds(row[1]);
        const lighting = row[6] || "延续本场主光";
        const colorPalette = row[7] || "沿用项目主色板";
        const actionEnd = row[10] || row[9];
        const performancePlan = defaultPerformancePlan(
            row[9],
            row[9],
            actionEnd,
            utterances.some((item) => item.type === "dialogue"),
        );
        const dialoguePerformance = defaultDialoguePerformance(utterances);
        const lightingPlan = defaultLightingPlan(lighting, colorPalette);
        return {
            code,
            order: index + 1,
            title: promptHeading(source, code) || row[9],
            description: row[9],
            sourceText: storyScene?.summary || row[9],
            shotBoundary: row[8],
            dialogue: utterances
                .filter((item) => item.type === "dialogue")
                .map((item) => `${item.speaker}：${item.text}`)
                .join("\n"),
            narration: utterances
                .filter((item) => item.type === "voiceover")
                .map((item) => `${item.speaker}：${item.text}`)
                .join("\n"),
            utterances,
            imagePrompt: `${row[9]}，${row[3]}，${row[6]}，${row[7]}，9:16竖屏电影分镜`,
            videoPrompt: prompt,
            cameraMotion: row[4],
            startFramePrompt: `${row[9]}，动作起始状态`,
            endFramePrompt: row[10],
            negativePrompt: negativePromptFrom(prompt),
            continuity: {
                shotSize: row[3],
                cameraAngle: "视线高度平视，沿动作轴线拍摄",
                composition: "主体保持在9:16安全区，动作方向留出前进空间",
                characterBlocking: `按${row[9]}的动作关系安排站位`,
                gazeDirection: "沿叙事动作方向，反应时回看对手或关键道具",
                actionStart: row[9],
                actionEnd,
                screenDirection: "保持同侧屏幕运动方向",
                axisRule: "保持180度关系轴线，转场时明确切换",
                continuityNotes: row[8] || "保持人物、道具、空间和光色状态连续",
            },
            duration: Math.max(1, duration[1] - duration[0]),
            characterCodes,
            propCodes,
            clueCodes: [],
            locationCode: storyScene?.locationCode,
            storySceneCode: storyScene?.code,
            timecode: row[1],
            dramaticFunction: row[2],
            lens: row[5],
            lighting,
            colorPalette,
            transitionOut: row[8],
            performanceNotes: utterances.map((item) => item.text).join("；"),
            performancePlan,
            dialoguePerformance,
            lightingPlan,
            sound: soundByShot.get(code),
            entryState: directorState(characterCodes, propCodes, storyScene?.title || "未命名场景", row[6], `进入${row[9]}`),
            exitState: directorState(characterCodes, propCodes, storyScene?.title || "未命名场景", row[6], row[10]),
            videoMode: "storyboard" as const,
            storyboardFrameMode: "all_frames" as const,
            continuityStatus: "ready" as const,
            framePlan: { start: { source: "independent" as const }, end: { required: true }, frames: [] },
        };
    });
    const shots = inheritCarriedStates(baseShots);
    const resolvedStoryScenes = storyScenes.map((scene) => ({ ...scene, shotCodes: shots.filter((shot) => shot.storySceneCode === scene.code).map((shot) => shot.code) }));
    const edges = shots.slice(0, -1).map((shot, index) => {
        const next = shots[index + 1];
        const sameScene = shot.storySceneCode === next.storySceneCode;
        const transition = !sameScene ? "scene_change" : shot.transitionOut?.includes("匹配") ? "match_cut" : shot.transitionOut?.includes("硬切") ? "hard_cut" : "continuous";
        return {
            fromShotCode: shot.code,
            toShotCode: next.code,
            transition: transition as DramaContinuityEdge["transition"],
            inheritActualEndFrame: sameScene && transition !== "hard_cut",
            carryCharacterIds: shot.characterCodes.filter((code) => next.characterCodes.includes(code)),
            carryPropIds: shot.propCodes.filter((code) => next.propCodes.includes(code)),
            carryEnvironment: sameScene,
            carryAxis: sameScene,
            notes: shot.transitionOut,
        };
    });
    return {
        schemaVersion: 1,
        project: {
            title,
            summary: bullet(source, "核心冲突"),
            style: bullet(source, "视觉风格"),
            ratio: meta?.[3]?.trim() || "9:16",
            productionBible: {
                targetPlatform: meta?.[1]?.trim(),
                language: meta?.[2]?.trim() || "中文",
                ratio: meta?.[3]?.trim() || "9:16",
                targetDuration: Number(meta?.[4]) || shots.reduce((total, shot) => total + shot.duration, 0),
                visualStyle: bullet(source, "视觉风格"),
                colorScript: bullet(source, "色彩叙事"),
                soundBible: "按镜头声音设计表执行，保留对白空间与静默段落",
                globalNegativePrompt: "无字幕、无水印、无logo、无现代元素、无角色身份漂移",
                subtitleSafeArea: "角色头顶与画面底部保留安全区",
                continuityMode: "strict",
            },
        },
        assets: { characters: allCharacters, locations: locationAssets, props, clues: [] },
        episodes: [
            {
                code: "E01",
                title: episodeTitle,
                script: storySceneMatches.map((match) => `### 场${match[1]}｜${match[2]}｜${match[3]}｜${match[4]}\n\n${match[5].trim()}`).join("\n\n"),
                outline: bullet(source, "核心冲突"),
                hook: bullet(source, "结尾新问题"),
                nextPreview: "进入 Edia Knight 后，追查断剑与木匣的共同记忆。",
                sourceRange: bullet(source, "小说章节"),
                storyScenes: resolvedStoryScenes,
                shots,
                continuityEdges: edges,
            },
        ],
        seriesBible: {
            version: "series-bible-v1",
            canonCharacters: ["C01", "C02", "C03", "C04"],
            immutableRules: ["Karin、Rifa、Ras、Ref的面孔、身高比例、发型、服装基线与标志道具跨集不可重建", "Ras与Ref第一集不出镜，不得进入E01参考图请求", "任何新角色、服装、地点或道具必须先登记资产再进入镜头Prompt"],
            relationshipState: bullet(source, "关系弧"),
            worldRules: ["Mahadel保存诸界试图遗忘的记忆", "器物能够保存并借用接触者的记忆", "Karin十八岁后会使魔法装备逐渐失灵"],
            unresolvedThreads: [bullet(source, "结尾新问题"), "预言中缺失的两个名字是谁", "木匣为何记得Karin"].filter(Boolean),
            visualMotifs: [bullet(source, "色彩叙事"), "四点印记", "倒悬塔", "银色裂痕"].filter(Boolean),
            soundMotifs: ["无呼吸女声耳语", "低弦两音母题", "力量释放前的绝对静音"],
        },
        archive,
    };
}

function parseProductionArchive(source: string): NonNullable<DramaProductionPackageV1["archive"]> {
    const sections = [...source.matchAll(/^##\s+([^\n]+)\n([\s\S]*?)(?=^##\s+|\s*$)/gm)].map((match, index) => ({
        code: `SEC${String(index + 1).padStart(2, "0")}`,
        title: match[1].replace(/^[一二三四五六七八九十]+、/, "").trim(),
        content: match[2].trim(),
    }));
    const referenceRows = markdownTableRows(section(source, "### 参考图生成后的推荐映射", "### 生成顺序"), 5).filter((row) => /^\d+$/.test(row[0]));
    const referencePlan = referenceRows.map((row) => ({ priority: Number(row[0]), asset: row[1], purpose: row[2], planType: row[3], shotCodes: shotCodes(row[4]) }));
    const referenceShots = new Map(
        referencePlan.flatMap((plan) => {
            const code = plan.asset.match(/^(V\d+|C\d+|S\d+)/)?.[1];
            return code ? [[code, plan.shotCodes] as const] : [];
        }),
    );
    const keyframes = [...section(source, "## 七、关键视频资产 Prompt", "## 八、").matchAll(/###\s*(V\d+)｜([^\n]+)\n+```text\n([\s\S]*?)```/g)].map((match) => ({
        code: match[1],
        category: "keyframe" as const,
        title: match[2].trim(),
        prompt: match[3].trim(),
        shotCodes: referenceShots.get(match[1]) || [],
    }));
    const storyboards = [...section(source, "## 八、全案板 Prompt", "## 九、").matchAll(/###\s*全案板\s*(\d+)\/\d+｜(SH\d+)-(SH\d+)\n+```text\n([\s\S]*?)```/g)].map((match) => ({
        code: `SB${match[1].padStart(2, "0")}`,
        category: "storyboard" as const,
        title: `${match[2]}-${match[3]}`,
        prompt: match[4].trim(),
        shotCodes: inclusiveShotRange(match[2], match[3]),
    }));
    const dialogueDirections = markdownTableRows(section(source, "### 台词序列", "### 沉默设计"), 6)
        .filter((row) => /^D\d+$/i.test(row[0]))
        .map((row) => ({ id: row[0], shotCode: row[1], speaker: row[2], text: row[3].replace(/^[“\"]|[”\"]$/g, ""), performance: row[4], lipSync: row[5] !== "否" }));
    const voiceDirections = [...section(source, "### 角色台词基调", "### 台词序列").matchAll(/^-\s*([^：\n]+)：([^\n]+)/gm)].map((match) => ({ subject: match[1].trim(), direction: match[2].trim() }));
    const silenceDirections = [...section(source, "### 沉默设计", "## 十、").matchAll(/^-\s*(SH\d+)([^\n]*)/gm)].map((match) => ({ shotCode: match[1], direction: match[2].replace(/^[:：]/, "").trim() }));
    const generationOrder = [...section(source, "### 生成顺序", "## 十三、").matchAll(/^\d+\.\s*([^\n]+)/gm)].map((match) => match[1].trim());
    return {
        formatVersion: "vozeb-drama-production-package-v1",
        sections,
        promptAssets: [...keyframes, ...storyboards],
        dialogueDirections,
        voiceDirections,
        silenceDirections,
        referencePlan,
        generationOrder,
        qcReport: section(source, "## 十三、QC 报告", "## 十四、").trim(),
    };
}

function shotCodes(value: string) {
    const range = value.match(/(P|SH)(\d+)-(?:P|SH)?(\d+)/i);
    if (range) return inclusiveShotRange(`SH${range[2].padStart(2, "0")}`, `SH${range[3].padStart(2, "0")}`);
    return [...value.matchAll(/(?:P|SH)(\d+)/gi)].map((match) => `SH${match[1].padStart(2, "0")}`);
}

function inclusiveShotRange(start: string, end: string) {
    const from = Number(start.match(/\d+/)?.[0]);
    const to = Number(end.match(/\d+/)?.[0]);
    return Number.isFinite(from) && Number.isFinite(to) && to >= from ? Array.from({ length: to - from + 1 }, (_, index) => `SH${String(from + index).padStart(2, "0")}`) : [];
}

function markdownPromptAssets(source: string, pattern: RegExp, location = false) {
    return [...source.matchAll(pattern)].map((match) => {
        const prompt = match[3].trim();
        const anchors =
            prompt
                .match(/不可变特征(?:红框标注)?：([^。\n]+)/)?.[1]
                ?.split(/[、，]/)
                .map((item) => item.trim())
                .filter(Boolean) || [];
        return packageAsset(match[2], match[1], firstMeaningfulParagraph(prompt), prompt, anchors, location);
    });
}
function packageAsset(code: string, name: string, description: string, designPrompt: string, anchors: string[], location = false): DramaProductionPackageAsset {
    return {
        code,
        name: name.trim(),
        description: description.trim(),
        activeEpisodeCodes: code === "C03" || code === "C04" ? [] : ["E01"],
        profile: {
            visualIdentity: anchors.join("、") || description.trim(),
            styling: designPrompt.match(/(?:服装|固定元素|固定空间)：([^。\n]+)/)?.[1] || "",
            colorPalette: designPrompt.match(/色彩(?:CN3)?：?([^。\n]+)/)?.[1] || "",
            consistencyRules: anchors.length
                ? `固定：${anchors.join("、")}`
                : location
                  ? inferLocationConsistencyRules(
                        name,
                        designPrompt,
                        location ? sentenceList(designPrompt, /固定(?:元素|空间)：([^。\n]+)/) : [],
                        designPrompt.match(/固定(?:元素|空间)：([^。\n]+)/)?.[1] || "",
                        designPrompt.match(/色彩(?:CN3)?：?([^。\n]+)/)?.[1] || "",
                    )
                  : "按设计 Prompt 保持一致",
            designPrompt,
            identityAnchors: anchors,
            spatialRules: location ? sentenceList(designPrompt, /固定(?:元素|空间)：([^。\n]+)/) : [],
            stateRules: [],
            forbiddenChanges: sentenceList(designPrompt, /负面提示词：([^\n]+)/),
        },
    };
}
function markdownTableRows(source: string, columns: number) {
    return source
        .split("\n")
        .filter((line) => line.trim().startsWith("|"))
        .map((line) =>
            line
                .trim()
                .slice(1, -1)
                .split("|")
                .map((cell) => cell.trim()),
        )
        .filter((row) => row.length >= columns && !row.every((cell) => /^:?-+:?$/.test(cell)));
}
function section(source: string, start: string, end: string) {
    const from = source.indexOf(start);
    if (from < 0) return "";
    const to = source.indexOf(end, from + start.length);
    return source.slice(from, to < 0 ? undefined : to);
}
function bullet(source: string, label: string) {
    return source.match(new RegExp(`^-\\s*${label}：([^\\n]+)`, "m"))?.[1]?.trim() || "";
}
function timeRangeSeconds(value: string): [number, number] {
    const matches = [...value.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    return [matches[0] || 0, matches[1] || matches[0] || 0];
}
function parseTimecode(value: unknown): [number, number] | undefined {
    if (typeof value !== "string") return undefined;
    const matches = [...value.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    if (matches.length < 2 || matches[1] <= matches[0]) return undefined;
    return [matches[0], matches[1]];
}
function overlaps(left: [number, number], right: [number, number]) {
    return left[0] < right[1] && left[1] > right[0];
}
function storyLocationCode(order: number) {
    return order === 1 ? "S05" : order === 2 ? "S06" : order <= 4 ? "S02" : order === 5 ? "S03" : "S04";
}
function matchesAssetText(name: string, value: string) {
    const aliases: Record<string, string[]> = {
        城门检查官: ["检查官"],
        "奥伦·奈特": ["奥伦", "铸剑师"],
        神秘观察者: ["观察者"],
        Karin的断剑: ["断剑", "剑柄", "剑鞘"],
        失灵护符: ["护符"],
        灵压探测器: ["探测器"],
        四点木匣: ["木匣"],
        Rifa短刃: ["短刃"],
        四点银戒: ["银戒"],
        无头锤柄: ["锤柄", "木柄"],
        烟黑铜镜: ["铜镜"],
    };
    return [name, ...(aliases[name] || [])].some((alias) => value.includes(alias));
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

/**
 * Reassembles explicit Agent-created shot fragments into the selected logical
 * shot duration. Only fragments carrying the same `title N/M` group are
 * eligible, so intentional cuts and scene changes remain untouched.
 */
export function mergeDramaProductionPackageShotDurations(value: DramaProductionPackageV1, targetDuration: 15 | 20 | 30): DramaProductionPackageV1 {
    return { ...value, episodes: value.episodes.map((episode) => mergeTargetDurationShots(episode, targetDuration)) };
}

function mergeTargetDurationShots(episode: DramaProductionPackageEpisode, targetDuration: 15 | 20 | 30): DramaProductionPackageEpisode {
    const groups: DramaProductionPackageEpisode["shots"][] = [];
    let changed = false;
    for (let index = 0; index < episode.shots.length;) {
        const group = explicitDurationGroup(episode.shots, index, targetDuration);
        if (group.length > 1) {
            groups.push(group);
            index += group.length;
            changed = true;
        } else {
            groups.push([episode.shots[index]]);
            index += 1;
        }
    }
    if (!changed) return episode;

    const merged = groups.map((group) => (group.length === 1 ? group[0] : mergeShotGroup(group)));
    const codeMap = new Map<string, string>();
    merged.forEach((shot, index) => {
        const code = `SH${String(index + 1).padStart(3, "0")}`;
        const sourceCodes = groups[index].map((item) => item.code);
        sourceCodes.forEach((sourceCode) => codeMap.set(sourceCode, code));
    });
    const shots = merged.map((shot, index) => {
        const code = `SH${String(index + 1).padStart(3, "0")}`;
        return {
            ...shot,
            code,
            order: index + 1,
            framePlan: {
                ...shot.framePlan,
                frames: shot.framePlan.frames.map((frame, frameIndex) => ({ ...frame, id: `${code}-F${String(frameIndex + 1).padStart(2, "0")}`, sequenceIndex: frameIndex + 1 })),
                referenceManifest: shot.framePlan.referenceManifest?.map((item) => ({ ...item, shotId: item.shotId ? codeMap.get(item.shotId) || item.shotId : item.shotId })),
            },
        };
    });
    const storyScenes = episode.storyScenes.map((scene) => ({ ...scene, shotCodes: dedupeStrings(scene.shotCodes.map((code) => codeMap.get(code) || code)) }));
    const continuityEdges = dedupeContinuityEdges(
        episode.continuityEdges.flatMap((edge) => {
            const fromShotCode = codeMap.get(edge.fromShotCode) || edge.fromShotCode;
            const toShotCode = codeMap.get(edge.toShotCode) || edge.toShotCode;
            return fromShotCode === toShotCode ? [] : [{ ...edge, fromShotCode, toShotCode }];
        }),
    );
    return { ...episode, shots, storyScenes, continuityEdges };
}

function explicitDurationGroup(shots: DramaProductionPackageEpisode["shots"], startIndex: number, targetDuration: 15 | 20 | 30) {
    const first = splitShotTitle(shots[startIndex]?.title || "");
    if (!first || first.part !== 1 || first.total < 2) return [];
    const group = shots.slice(startIndex, startIndex + first.total);
    if (
        group.length !== first.total ||
        group.some((shot, index) => {
            const parsed = splitShotTitle(shot.title);
            return parsed?.base !== first.base || parsed.part !== index + 1 || parsed.total !== first.total || shot.storySceneCode !== group[0].storySceneCode || shot.locationCode !== group[0].locationCode;
        })
    )
        return [];
    const total = group.reduce((sum, shot) => sum + shot.duration, 0);
    if (total !== targetDuration) return [];
    const firstTime = parseTimecode(group[0].timecode);
    let previousEnd = firstTime?.[1] ?? firstTime?.[0] ?? 0;
    for (let index = 1; index < group.length; index += 1) {
        const current = parseTimecode(group[index].timecode);
        if (!current || Math.abs(current[0] - previousEnd) > 0.01) return [];
        previousEnd = current[1];
    }
    return group;
}

function mergeShotGroup(group: DramaProductionPackageEpisode["shots"]) {
    const first = group[0];
    const last = group.at(-1)!;
    const firstTitle = splitShotTitle(first.title)?.base || first.title;
    const offsets = group.reduce<number[]>((values, shot, index) => [...values, (values[index - 1] || 0) + (index ? group[index - 1].duration : 0)], []);
    const mergedFrames = group.flatMap((shot, index) => shot.framePlan.frames.map((frame) => ({ ...frame, startSecond: Number((frame.startSecond + offsets[index]).toFixed(3)), endSecond: Number((frame.endSecond + offsets[index]).toFixed(3)) })));
    const frames = compactMergedFrames(
        mergedFrames,
        group.reduce((sum, shot) => sum + shot.duration, 0),
    );
    const references = dedupeReferenceManifest(group.flatMap((shot, index) => (shot.framePlan.referenceManifest || []).filter((item) => index === 0 || item.role !== "previous_actual_tail")));
    const firstTime = parseTimecode(first.timecode);
    const lastTime = parseTimecode(last.timecode);
    const startSecond = firstTime?.[0] ?? 0;
    const endSecond = lastTime?.[1] ?? startSecond + group.reduce((sum, shot) => sum + shot.duration, 0);
    return {
        ...first,
        title: firstTitle,
        description: joinTexts(group.map((shot) => shot.description)),
        sourceText: joinTexts(group.map((shot) => shot.sourceText)),
        shotBoundary: joinTexts(group.map((shot) => shot.shotBoundary)),
        dialogue: joinTexts(group.map((shot) => shot.dialogue)),
        narration: joinTexts(group.map((shot) => shot.narration)),
        utterances: group.flatMap((shot) => shot.utterances).map((utterance, index) => ({ ...utterance, order: index + 1 })),
        imagePrompt: first.imagePrompt,
        videoPrompt: group.map((shot) => shot.videoPrompt.trim()).filter(Boolean).join("\n"),
        startFramePrompt: first.startFramePrompt,
        endFramePrompt: last.endFramePrompt,
        negativePrompt: joinTexts(group.map((shot) => shot.negativePrompt)),
        continuity: {
            ...first.continuity,
            actionStart: first.continuity?.actionStart || first.description,
            actionEnd: last.continuity?.actionEnd || last.description,
            continuityNotes: joinTexts([first.continuity?.continuityNotes, last.continuity?.continuityNotes]),
        },
        duration: group.reduce((sum, shot) => sum + shot.duration, 0),
        characterCodes: dedupeStrings(group.flatMap((shot) => shot.characterCodes)),
        propCodes: dedupeStrings(group.flatMap((shot) => shot.propCodes)),
        clueCodes: dedupeStrings(group.flatMap((shot) => shot.clueCodes)),
        timecode: `${trimSecond(startSecond)}-${trimSecond(endSecond)}s`,
        dramaticFunction: joinTexts(group.map((shot) => shot.dramaticFunction)),
        performanceNotes: joinTexts(group.map((shot) => shot.performanceNotes)),
        transitionIn: first.transitionIn,
        transitionOut: last.transitionOut,
        sound: mergeSounds(group.map((shot) => shot.sound)),
        entryState: first.entryState,
        exitState: last.exitState,
        framePlan: { start: first.framePlan.start, end: last.framePlan.end, frames, ...(references.length ? { referenceManifest: references } : {}), ...(first.framePlan.referenceCount ? { referenceCount: first.framePlan.referenceCount } : {}) },
    } as DramaProductionPackageEpisode["shots"][number];
}


function compactMergedFrames(frames: DramaProductionPackageEpisode["shots"][number]["framePlan"]["frames"], duration: number) {
    const unique = frames.filter((frame, index, all) => all.findIndex((item) => item.actionPrompt.trim() === frame.actionPrompt.trim()) === index);
    if (unique.length === frames.length) return frames;
    const selected = unique.length <= 9 ? unique : Array.from({ length: 9 }, (_, index) => unique[Math.floor((index * unique.length) / 9)]);
    const partitions = integerPartitions(duration, selected.length);
    let cursor = 0;
    return selected.map((frame, index) => ({
        ...frame,
        startSecond: cursor,
        endSecond: (cursor += partitions[index]),
    }));
}

function dedupeReferenceManifest(items: NonNullable<DramaProductionPackageEpisode["shots"][number]["framePlan"]["referenceManifest"]>) {
    const seen = new Set<string>();
    return items
        .filter((item) => {
            const key = `${item.role}|${item.assetId || ""}|${item.shotId || ""}|${item.frameEvidenceId || ""}|${item.purpose || ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map((item, index) => ({ ...item, alias: `@图片${index + 1}` }));
}

function mergeSounds(values: Array<DramaProductionPackageEpisode["shots"][number]["sound"]>) {
    const entries = values.filter(Boolean);
    if (!entries.length) return undefined;
    return {
        ambience: joinTexts(entries.map((sound) => sound?.ambience)),
        soundEffects: joinTexts(entries.map((sound) => sound?.soundEffects)),
        music: joinTexts(entries.map((sound) => sound?.music)),
    };
}

function joinTexts(values: Array<string | undefined>) {
    return [...new Set(values.map((value) => value?.trim()).filter(Boolean))].join("；");
}

function dedupeStrings(values: string[]) {
    return [...new Set(values.filter(Boolean))];
}

function dedupeContinuityEdges(edges: DramaProductionPackageEpisode["continuityEdges"]) {
    const seen = new Set<string>();
    return edges.filter((edge) => {
        const key = `${edge.fromShotCode}|${edge.toShotCode}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function validateSplitShotFramePlans(episodes: DramaProductionPackageEpisode[]) {
    for (const episode of episodes) {
        for (let index = 0; index < episode.shots.length; index += 1) {
            const parsed = splitShotTitle(episode.shots[index].title);
            if (!parsed || parsed.part !== 1) continue;
            const group = episode.shots.slice(index, index + parsed.total);
            if (group.length !== parsed.total || group.some((shot, part) => !sameSplitShotTitle(shot.title, parsed.base, part + 1, parsed.total))) continue;
            const plans = group.map((shot) => JSON.stringify(shot.framePlan.frames.map((frame) => [frame.actionPrompt, frame.imagePrompt])));
            if (new Set(plans).size !== plans.length) throw new DramaProductionPackageError(`${parsed.base}的拆分镜头复用了整套逐帧计划，请分别提供每段的独立动作与静态状态`);
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
function trimSecond(value: number) {
    return String(Math.round(value));
}
function integerPartitions(total: number, count: number) {
    const safeTotal = Math.max(count, Math.round(total));
    const base = Math.floor(safeTotal / count);
    const remainder = safeTotal - base * count;
    return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
function compactMarkdown(value: string) {
    return value.replace(/\n{2,}/g, "\n").trim();
}
function firstMeaningfulParagraph(value: string) {
    return (
        value
            .split(/\n{2,}/)
            .map((item) => item.trim())
            .find((item) => /^(角色|场景|格1)/.test(item)) ||
        value.split(/\n{2,}/)[0]?.trim() ||
        ""
    );
}
function negativePromptFrom(value: string) {
    const marker = value.match(/(?:负面提示词：|无字幕)[\s\S]*$/)?.[0];
    return marker || "无水印、无logo、无角色身份漂移、无现代元素";
}
function promptHeading(source: string, shotCode: string) {
    const number = String(Number(shotCode.replace(/\D/g, ""))).padStart(2, "0");
    return source.match(new RegExp(`###\\s*P${number}｜[^｜\\n]+｜([^\\n]+)`))?.[1]?.trim();
}
function sentenceList(value: string, pattern: RegExp) {
    return (
        pattern
            .exec(value)?.[1]
            ?.split(/[；，]/)
            .map((item) => item.trim())
            .filter(Boolean) || []
    );
}
