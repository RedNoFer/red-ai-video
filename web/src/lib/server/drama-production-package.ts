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
    DramaShot,
    DramaStoryScene,
} from "@/lib/drama-project-contract";

export class DramaProductionPackageError extends Error {}

export function previewDramaProductionPackage(source: string, fileName = "production-package.json"): DramaProductionPackagePreview {
    const trimmed = source.trim();
    if (!trimmed) throw new DramaProductionPackageError("制作包内容不能为空");
    const embedded = trimmed.match(/```(?:json|drama-production-package)\s*([\s\S]*?)```/i)?.[1];
    const format = fileName.toLowerCase().endsWith(".json") || trimmed.startsWith("{") ? "json" : "markdown";
    const parsed = parseObject(format === "json" ? trimmed : embedded || "") || (format === "markdown" ? parseDirectorMarkdown(trimmed) : null);
    if (!parsed) throw new DramaProductionPackageError("Markdown 制作包缺少可读取的标准清单或导演执行表");
    const productionPackage = normalizeProductionPackage(parsed);
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
    return {
        ...project,
        title: preferred(project.title, project.fieldOrigins, "title", projectPatch.title),
        summary: preferred(project.summary, project.fieldOrigins, "summary", projectPatch.summary),
        style: preferred(project.style, project.fieldOrigins, "style", projectPatch.style),
        ratio: preferred(project.ratio, project.fieldOrigins, "ratio", projectPatch.ratio),
        productionBible: project.fieldOrigins?.productionBible === "manual" ? project.productionBible : projectPatch.productionBible,
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
            videoMode: shot.videoMode || defaultVideoMode,
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
        return { ...shot, storySceneId: packageShot?.storySceneCode ? storySceneIds.get(packageShot.storySceneCode) : undefined };
    });
    const continuityEdges = incoming.continuityEdges.flatMap<DramaContinuityEdge>((edge) => {
        const fromShotId = shotIds.get(edge.fromShotCode);
        const toShotId = shotIds.get(edge.toShotCode);
        return fromShotId && toShotId ? [{ ...edge, fromShotId, toShotId }] : [];
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
    const manualAssets = existing.filter((asset) => !incomingIds.has(asset.id) && Object.values(asset.fieldOrigins || {}).includes("manual"));
    return { items: [...merged, ...manualAssets], ids };
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
        characters: array(assets.characters).map(normalizePackageAsset).filter(hasCodeAndName),
        locations: array(assets.locations).map(normalizePackageAsset).filter(hasCodeAndName),
        props: array(assets.props).map(normalizePackageAsset).filter(hasCodeAndName),
        clues: array(assets.clues).map(normalizePackageAsset).filter(hasCodeAndName),
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
    return {
        schemaVersion: 1,
        project: {
            title: text(project.title) || "未命名短剧",
            summary: text(project.summary),
            style: text(project.style),
            ratio: text(project.ratio) || "9:16",
            productionBible: {
                targetPlatform: optionalText(bible.targetPlatform),
                language: text(bible.language) || "中文",
                ratio: text(bible.ratio) || text(project.ratio) || "9:16",
                targetDuration: positiveNumber(bible.targetDuration),
                visualStyle: text(bible.visualStyle) || text(project.style),
                colorScript: optionalText(bible.colorScript),
                soundBible: optionalText(bible.soundBible),
                globalNegativePrompt: optionalText(bible.globalNegativePrompt),
                subtitleSafeArea: optionalText(bible.subtitleSafeArea),
                continuityMode: bible.continuityMode === "balanced" ? "balanced" : "strict",
            },
        },
        assets: normalizedAssets,
        episodes: normalizedEpisodes,
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
    const continuity = object(shot.continuity);
    return {
        code: text(shot.code),
        order: positiveNumber(shot.order) || index + 1,
        title: text(shot.title) || `镜头 ${index + 1}`,
        description: text(shot.description),
        sourceText: text(shot.sourceText),
        shotBoundary: text(shot.shotBoundary),
        dialogue: text(shot.dialogue),
        narration: text(shot.narration),
        utterances: array(shot.utterances).map((value, utteranceIndex) => {
            const utterance = object(value);
            return {
                id: text(utterance.id) || `utterance-${utteranceIndex + 1}`,
                order: positiveNumber(utterance.order) || utteranceIndex + 1,
                type: utterance.type === "voiceover" ? "voiceover" : "dialogue",
                speaker: text(utterance.speaker),
                text: text(utterance.text),
            };
        }),
        imagePrompt: text(shot.imagePrompt),
        videoPrompt: text(shot.videoPrompt),
        cameraMotion: text(shot.cameraMotion),
        startFramePrompt: optionalText(shot.startFramePrompt),
        endFramePrompt: optionalText(shot.endFramePrompt),
        negativePrompt: optionalText(shot.negativePrompt),
        continuity: {
            shotSize: text(continuity.shotSize),
            cameraAngle: text(continuity.cameraAngle),
            composition: text(continuity.composition),
            characterBlocking: text(continuity.characterBlocking),
            gazeDirection: text(continuity.gazeDirection),
            actionStart: text(continuity.actionStart),
            actionEnd: text(continuity.actionEnd),
            screenDirection: text(continuity.screenDirection),
            axisRule: text(continuity.axisRule),
            continuityNotes: text(continuity.continuityNotes),
        },
        duration: positiveNumber(shot.duration) || 5,
        characterCodes: strings(shot.characterCodes),
        propCodes: strings(shot.propCodes),
        clueCodes: strings(shot.clueCodes),
        locationCode: optionalText(shot.locationCode),
        storySceneCode: optionalText(shot.storySceneCode),
        timecode: optionalText(shot.timecode),
        dramaticFunction: optionalText(shot.dramaticFunction),
        lens: optionalText(shot.lens),
        lighting: optionalText(shot.lighting),
        colorPalette: optionalText(shot.colorPalette),
        transitionIn: optionalText(shot.transitionIn),
        transitionOut: optionalText(shot.transitionOut),
        performanceNotes: optionalText(shot.performanceNotes),
        sound: normalizeSound(shot.sound),
        entryState: normalizeState(shot.entryState),
        exitState: normalizeState(shot.exitState),
        sourceAssetIds: strings(shot.sourceAssetIds),
        continuityStatus: shot.continuityStatus === "blocked" || shot.continuityStatus === "needs_review" || shot.continuityStatus === "passed" || shot.continuityStatus === "stale" ? shot.continuityStatus : "ready",
        videoMode: shot.videoMode === "direct" || shot.videoMode === "reference" ? shot.videoMode : "storyboard",
        storyboardFrameMode: shot.storyboardFrameMode === "single" ? "single" : "first_last",
    };
}

function normalizePackageAsset(value: unknown): DramaProductionPackageAsset {
    const asset = object(value);
    const profile = object(asset.profile);
    return {
        code: text(asset.code),
        name: text(asset.name),
        description: text(asset.description),
        payoff: optionalText(asset.payoff),
        activeEpisodeCodes: strings(asset.activeEpisodeCodes),
        profile: Object.keys(profile).length
            ? {
                  visualIdentity: text(profile.visualIdentity),
                  styling: text(profile.styling),
                  colorPalette: text(profile.colorPalette),
                  consistencyRules: text(profile.consistencyRules),
                  designPrompt: optionalText(profile.designPrompt),
                  identityAnchors: strings(profile.identityAnchors),
                  spatialRules: strings(profile.spatialRules),
                  stateRules: strings(profile.stateRules),
                  forbiddenChanges: strings(profile.forbiddenChanges),
              }
            : undefined,
    };
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
                          wardrobe: optionalText(entity.wardrobe),
                          position: optionalText(entity.position),
                          gaze: optionalText(entity.gaze),
                          pose: optionalText(entity.pose),
                          expression: optionalText(entity.expression),
                          action: optionalText(entity.action),
                          state: optionalText(entity.state),
                          holderId: optionalText(entity.holderId),
                      },
                  ]
                : [];
        });
    return Object.keys(state).length
        ? { characters: entities(state.characters), props: entities(state.props), environment: optionalText(state.environment), lighting: optionalText(state.lighting), axis: optionalText(state.axis), screenDirection: optionalText(state.screenDirection) }
        : undefined;
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
    const functionalRoles = [...section(source, "### 5.5 本集功能角色 DNA", "## 六、").matchAll(/^-\s*([^：\n]+)：([^\n]+)/gm)].map((match, index) =>
        packageAsset(`C${String(characterAssets.length + index + 1).padStart(2, "0")}`, match[1], match[2], match[2], [match[2].split(/[；，]/).at(-1) || match[2]]),
    );
    const locationAssets = markdownPromptAssets(section(source, "## 六、场景一致性资产", "## 七、"), /###\s*6\.\d+\s+([^｜\n]+)｜(S\d+)｜[^\n]*\n+```text\n([\s\S]*?)```/g, true);
    const props = [
        packageAsset("P01", "Karin的断剑", "暗银断剑、不对称双翼护手、剑柄缠深蓝旧布", "暗银断剑，不对称双翼护手，剑柄缠深蓝旧布", ["不对称双翼护手", "断口形态固定"]),
        packageAsset("P02", "失灵护符", "暗黄铜圆片，边缘有焦黑痕", "暗黄铜圆片护符", ["焦黑边缘"]),
        packageAsset("P03", "灵压探测器", "黄铜探测器，指针可停在零并从内部裂开", "皇家黄铜灵压探测器", ["黄铜材质"]),
        packageAsset("P04", "四点木匣", "带银裂痕与四点印记的窄木匣", "四点印记窄木匣", ["四点印记", "银色裂痕"]),
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
    const allCharacters = [...characterAssets, ...functionalRoles];
    const shots = shotRows.map((row, index) => {
        const code = row[0];
        const prompt = videoPrompts.get(code) || row[9];
        const utterances = utterancesByShot.get(code) || [];
        const storyScene = storyScenes.find((scene) => scene.shotCodes.includes(code));
        const characterCodes = allCharacters.filter((asset) => asset.activeEpisodeCodes?.includes("E01") && (prompt.includes(asset.name) || row[9].includes(asset.name))).map((asset) => asset.code);
        const propCodes = props.filter((asset) => prompt.includes(asset.name.replace(/^Karin的/, "")) || row[9].includes(asset.name.replace(/^Karin的/, ""))).map((asset) => asset.code);
        const duration = timeRangeSeconds(row[1]);
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
            continuity: { shotSize: row[3], cameraAngle: "", composition: "9:16竖向构图", characterBlocking: "", gazeDirection: "", actionStart: row[9], actionEnd: row[10], screenDirection: "", axisRule: "保持同侧轴线", continuityNotes: row[8] },
            duration: Math.max(1, duration[1] - duration[0]),
            characterCodes,
            propCodes,
            clueCodes: [],
            locationCode: storyScene?.locationCode,
            storySceneCode: storyScene?.code,
            timecode: row[1],
            dramaticFunction: row[2],
            lens: row[5],
            lighting: row[6],
            colorPalette: row[7],
            transitionOut: row[8],
            performanceNotes: utterances.map((item) => item.text).join("；"),
            sound: soundByShot.get(code),
            entryState: { characters: characterCodes.map((assetId) => ({ assetId })), props: propCodes.map((assetId) => ({ assetId })), environment: storyScene?.title, lighting: row[6] },
            exitState: { characters: characterCodes.map((assetId) => ({ assetId })), props: propCodes.map((assetId) => ({ assetId })), environment: row[10], lighting: row[6] },
            videoMode: "storyboard" as const,
            storyboardFrameMode: "first_last" as const,
            continuityStatus: "ready" as const,
        };
    });
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
                storyScenes,
                shots,
                continuityEdges: edges,
            },
        ],
    };
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
            consistencyRules: anchors.length ? `固定：${anchors.join("、")}` : "按设计 Prompt 保持一致",
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
    const matches = [...value.matchAll(/\d+/g)].map((match) => Number(match[0]));
    return [matches[0] || 0, matches[1] || matches[0] || 0];
}
function overlaps(left: [number, number], right: [number, number]) {
    return left[0] < right[1] && left[1] > right[0];
}
function storyLocationCode(order: number) {
    return order <= 2 ? undefined : order <= 4 ? "S02" : order === 5 ? "S03" : "S04";
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
