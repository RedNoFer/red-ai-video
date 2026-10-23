import { createHash } from "node:crypto";

import { nanoid } from "nanoid";

import type { DramaEpisode, DramaNamedAsset, DramaProject, DramaReferenceManifestRole, DramaShot, DramaShotReferenceIntent } from "@/lib/drama-project-contract";
import { extractDramaPackageReferenceEntries, replaceDramaPackageCodeTokens, stripDramaPackageReferenceSections, type DramaPackageReferenceEntry } from "@/lib/drama-package-reference-intents";

type AssetKind = "characters" | "scenes" | "props" | "clues";
type CompactAsset = { kind: AssetKind; code: string; name: string; prompt: string };
type CompactShot = {
    code: string;
    title: string;
    duration: number;
    description?: string;
    videoPrompt: string;
    imagePrompt?: string;
    startFramePrompt?: string;
    endFramePrompt?: string;
    characters: string[];
    scene?: string;
    props: string[];
    clues: string[];
    referenceEntries?: DramaPackageReferenceEntry[];
};
type CompactEpisode = { code: string; title: string; script: string; shots: CompactShot[] };
type CompactPackage = { assets: CompactAsset[]; episodes: CompactEpisode[] };

export type DramaCompactPackageOptions = { overwriteAssetPrompts?: boolean };

export type DramaCompactPackagePreview = {
    sourceHash: string;
    summary: { episodes: number; shots: number; duration: number; assetsNew: number; assetsReused: number; assetPromptsOverwritable: number; shotsUpdated: number; oldResultsToReview: number };
    warnings: string[];
};

export class DramaCompactPackageError extends Error {}

const kinds: Record<string, AssetKind> = { 角色: "characters", 场景: "scenes", 道具: "props", 线索: "clues" };
const promptFields = { 章节文案: "description", 视频提示词: "videoPrompt", 静帧提示词: "imagePrompt", 首帧提示词: "startFramePrompt", 尾帧提示词: "endFramePrompt" } as const;
const codePattern = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const referencePrefixKinds: Record<string, AssetKind> = { CHAR: "characters", LOC: "scenes", PROP: "props", CLUE: "clues" };
const kindLabels: Record<AssetKind, string> = { characters: "角色", scenes: "场景", props: "道具", clues: "线索" };
const roleForKind: Record<AssetKind, DramaReferenceManifestRole> = { characters: "character_anchor", scenes: "scene_anchor", props: "prop_anchor", clues: "prop_anchor" };

function fail(message: string): never {
    throw new DramaCompactPackageError(message);
}

function nameKey(value: string) {
    return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

const COMPACT_SHOT_TEXT_FIELDS = ["title", "description", "imagePrompt", "videoPrompt", "startFramePrompt", "endFramePrompt"] as const;

type CompactShotTextField = (typeof COMPACT_SHOT_TEXT_FIELDS)[number];

/**
 * Package text wins, manual edits stay manual, and fields the package leaves
 * empty stay open so later AI passes can fill them.
 */
function resolveCompactTextField(field: CompactShotTextField, incoming: string | undefined, previous: DramaShot | undefined) {
    const previousOrigin = previous?.fieldOrigins?.[field];
    if (previousOrigin === "manual") return { value: previous?.[field] || "", origin: "manual" as const };
    if (incoming?.trim()) return { value: incoming, origin: "package" as const };
    return { value: "", origin: undefined };
}

function parseCodes(value: string) {
    return value.split(/[,，、\s]+/u).filter(Boolean);
}

export function parseDramaCompactPackage(source: string): CompactPackage {
    const lines = source.replace(/\r\n?/gu, "\n").split("\n");
    const result: CompactPackage = { assets: [], episodes: [] };
    let scope: "assets" | "episode" | undefined;
    let asset: CompactAsset | undefined;
    let episode: CompactEpisode | undefined;
    let shot: CompactShot | undefined;
    let field: "script" | "prompt" | keyof typeof promptFields | undefined;
    let titleSeen = false;
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim();
        if (!line || (line.startsWith("<!--") && line.endsWith("-->"))) continue;
        if (line === "# 精简制作包" && !titleSeen) {
            titleSeen = true;
            continue;
        }
        if (!titleSeen) fail("首行标题必须是 # 精简制作包");
        if (line === "## 固定资产") {
            scope = "assets";
            asset = undefined;
            shot = undefined;
            field = undefined;
            continue;
        }
        const episodeMatch = /^## 剧集 ([A-Za-z][A-Za-z0-9_-]*)｜(.+)$/u.exec(line);
        if (episodeMatch) {
            scope = "episode";
            asset = undefined;
            episode = { code: episodeMatch[1], title: episodeMatch[2].trim(), script: "", shots: [] };
            result.episodes.push(episode);
            shot = undefined;
            field = undefined;
            continue;
        }
        const assetMatch = /^### (角色|场景|道具|线索) ([A-Za-z][A-Za-z0-9_-]*)｜(.+)$/u.exec(line);
        if (scope === "assets" && assetMatch) {
            asset = { kind: kinds[assetMatch[1]], code: assetMatch[2], name: assetMatch[3].trim(), prompt: "" };
            result.assets.push(asset);
            field = undefined;
            continue;
        }
        if (scope === "episode" && line === "### 小说原文") {
            if (!episode || shot) fail("小说原文必须位于该集片段之前");
            field = "script";
            continue;
        }
        const shotMatch = /^### 片段 ([A-Za-z][A-Za-z0-9_-]*)｜(\d+)秒｜(.+)$/u.exec(line);
        if (scope === "episode" && episode && shotMatch) {
            shot = { code: shotMatch[1], duration: Number(shotMatch[2]), title: shotMatch[3].trim(), videoPrompt: "", characters: [], props: [], clues: [] };
            episode.shots.push(shot);
            field = undefined;
            continue;
        }
        if (scope === "assets" && line === "#### 图片提示词" && asset) {
            field = "prompt";
            continue;
        }
        const promptField = /^#### (章节文案|视频提示词|静帧提示词|首帧提示词|尾帧提示词)$/u.exec(line);
        if (shot && promptField) {
            field = promptField[1] as keyof typeof promptFields;
            continue;
        }
        if (line === "~~~text" || line === "```text") {
            if (!field) fail(`第 ${index + 1} 行的文本块缺少字段标题`);
            const fence = line.slice(0, 3);
            let end = index + 1;
            while (end < lines.length && lines[end].trim() !== fence) end++;
            if (end === lines.length) fail(`第 ${index + 1} 行的文本块没有结束标记 ${fence}`);
            const content = lines.slice(index + 1, end).join("\n");
            if (field === "script") episode!.script = content;
            else if (field === "prompt") asset!.prompt = content;
            else if (shot) shot[promptFields[field]] = content;
            field = undefined;
            index = end;
            continue;
        }
        const binding = /^(角色|场景|道具|线索)：(.*)$/u.exec(line);
        if (shot && binding) {
            const codes = parseCodes(binding[2]);
            if (binding[1] === "角色") shot.characters = codes;
            if (binding[1] === "场景") {
                if (codes.length > 1) fail(`${episode?.code}/${shot.code} 只能绑定一个场景`);
                shot.scene = codes[0];
            }
            if (binding[1] === "道具") shot.props = codes;
            if (binding[1] === "线索") shot.clues = codes;
            continue;
        }
        fail(`第 ${index + 1} 行无法识别：${line.slice(0, 60)}`);
    }
    if (!result.episodes.length) fail("至少需要一个剧集");
    const assetCodes = new Set<string>();
    const assetNames = new Set<string>();
    for (const item of result.assets) {
        if (!item.name || !item.prompt.trim()) fail(`资产 ${item.code} 缺少名称或图片提示词`);
        if (assetCodes.has(item.code)) fail(`资产代码重复：${item.code}`);
        assetCodes.add(item.code);
        const key = `${item.kind}:${nameKey(item.name)}`;
        if (assetNames.has(key)) fail(`同类型资产名称重复：${item.name}`);
        assetNames.add(key);
    }
    const episodeCodes = new Set<string>();
    for (const item of result.episodes) {
        if (episodeCodes.has(item.code)) fail(`剧集代码重复：${item.code}`);
        episodeCodes.add(item.code);
        if (!item.title || !item.script.trim() || !item.shots.length) fail(`剧集 ${item.code} 需要标题、小说原文和至少一个片段`);
        const shotCodes = new Set<string>();
        for (const part of item.shots) {
            if (!codePattern.test(part.code) || shotCodes.has(part.code)) fail(`${item.code} 的片段代码重复或无效：${part.code}`);
            shotCodes.add(part.code);
            if (!part.title || !Number.isSafeInteger(part.duration) || part.duration < 1 || !part.videoPrompt.trim()) fail(`${item.code}/${part.code} 需要标题、正整数时长和视频提示词`);
            for (const [kind, codes] of [
                ["characters", part.characters],
                ["scenes", part.scene ? [part.scene] : []],
                ["props", part.props],
                ["clues", part.clues],
            ] as const) {
                for (const code of codes) if (!result.assets.some((asset) => asset.kind === kind && asset.code === code)) fail(`${item.code}/${part.code} 的${kind}绑定不存在或类型不符：${code}`);
            }
        }
    }
    processDramaPackageReferenceEntries(result);
    return result;
}

/** Extract 【参考】 facts, strip them from the public text, swap known codes for asset names, and validate the codes. */
function processDramaPackageReferenceEntries(result: CompactPackage) {
    const assetsByCode = new Map(result.assets.map((asset) => [asset.code, asset]));
    const resolveAsset = (code: string) => assetsByCode.get(code) || assetsByCode.get([...assetsByCode.keys()].find((key) => key.toUpperCase() === code.toUpperCase()) || "");
    for (const episode of result.episodes) {
        for (const shot of episode.shots) {
            const entries: DramaPackageReferenceEntry[] = [];
            for (const field of ["description", "videoPrompt"] as const) {
                const text = shot[field];
                if (!text?.trim()) continue;
                entries.push(...extractDramaPackageReferenceEntries(text));
                const stripped = stripDramaPackageReferenceSections(text);
                shot[field] = replaceDramaPackageCodeTokens(stripped, (code) => resolveAsset(code)?.name);
            }
            if (!entries.length) continue;
            const seen = new Set<string>();
            for (const entry of entries) {
                if (seen.has(entry.code)) continue;
                seen.add(entry.code);
                const asset = resolveAsset(entry.code);
                if (!asset) fail(`${episode.code}/${shot.code} 的【参考】绑定代码不存在：${entry.code}，请先在固定资产中定义`);
                const prefix = /^([A-Za-z]+)_/u.exec(entry.code)?.[1]?.toUpperCase();
                const expectedKind = prefix && referencePrefixKinds[prefix];
                if (expectedKind && expectedKind !== asset!.kind) fail(`${episode.code}/${shot.code} 的【参考】代码 ${entry.code} 与资产类型不符：按前缀应为${kindLabels[expectedKind]}`);
            }
            shot.referenceEntries = entries;
        }
    }
}

function projectAssets(project: DramaProject, kind: AssetKind): DramaNamedAsset[] {
    return kind === "characters" ? project.characters : kind === "scenes" ? project.scenes : kind === "props" ? project.props : project.clues;
}

function matchAsset(project: DramaProject, asset: CompactAsset) {
    const matches = projectAssets(project, asset.kind).filter((item) => nameKey(item.name) === nameKey(asset.name));
    if (matches.length > 1) fail(`${asset.name} 匹配到多个已有${asset.kind}资产，请先消除重名`);
    const collision = projectAssets(project, asset.kind).find((item) => item.code === asset.code && nameKey(item.name) !== nameKey(asset.name));
    if (!matches.length && collision) fail(`资产代码 ${asset.code} 已被 ${collision.name} 使用`);
    return matches[0];
}

export function previewDramaCompactPackage(source: string, project: DramaProject, options: DramaCompactPackageOptions = {}): DramaCompactPackagePreview {
    const compact = parseDramaCompactPackage(source);
    const overwrite = options.overwriteAssetPrompts === true;
    const warnings: string[] = [];
    let assetsReused = 0;
    let assetPromptsOverwritable = 0;
    for (const asset of compact.assets) {
        const current = matchAsset(project, asset);
        if (!current) continue;
        assetsReused++;
        if (!current.supplierPrompt?.trim() || current.supplierPrompt.trim() === asset.prompt.trim()) continue;
        assetPromptsOverwritable++;
        warnings.push(overwrite ? `${asset.name} 的提示词文案将按本文件覆盖，基准图、候选图和参考图绑定保留。` : `${asset.name} 已有固定资产提示词和基准图；本次保留现有设定，忽略新文本。需要改写时可勾选“覆盖已有资产的提示词文案”。`);
    }
    let shotsUpdated = 0;
    let oldResultsToReview = 0;
    for (const episode of compact.episodes) {
        const current = project.episodes.find((item) => item.code === episode.code);
        for (const shot of episode.shots) {
            const previous = current?.shots.find((item) => item.code === shot.code);
            if (previous) shotsUpdated++;
            if (previous && (previous.videoUrl || previous.storyboardImageUrl || previous.storyboardEndImageUrl || previous.storyboardFrames?.some((frame) => frame.mediaUrl))) oldResultsToReview++;
            for (const entry of shot.referenceEntries || []) {
                if (!shot.characters.includes(entry.code) && shot.scene !== entry.code && !shot.props.includes(entry.code) && !shot.clues.includes(entry.code)) {
                    warnings.push(`${episode.code}/${shot.code} 的【参考】${entry.code} 未在本片段绑定行声明，导入后不会引用该资产的基准图。`);
                }
            }
        }
    }
    return {
        sourceHash: createHash("sha256").update(source).digest("hex"),
        summary: {
            episodes: compact.episodes.length,
            shots: compact.episodes.reduce((total, item) => total + item.shots.length, 0),
            duration: compact.episodes.reduce((total, item) => total + item.shots.reduce((sum, shot) => sum + shot.duration, 0), 0),
            assetsNew: compact.assets.length - assetsReused,
            assetsReused,
            assetPromptsOverwritable,
            shotsUpdated,
            oldResultsToReview,
        },
        warnings,
    };
}

export function applyDramaCompactPackage(project: DramaProject, source: string, fileName: string, options: DramaCompactPackageOptions = {}): DramaProject {
    const compact = parseDramaCompactPackage(source);
    const overwriteAssetPrompts = options.overwriteAssetPrompts === true;
    const nextAssets = {
        characters: [...project.characters],
        scenes: [...project.scenes],
        props: [...project.props],
        clues: [...project.clues],
    };
    const ids = new Map<string, string>();
    for (const asset of compact.assets) {
        const current = matchAsset(project, asset);
        const id = current?.id || `${asset.kind}-${nanoid()}`;
        ids.set(asset.code, id);
        const incoming = current
            ? {
                  ...current,
                  ...(!current.supplierPrompt?.trim()
                      ? {
                            supplierPrompt: asset.prompt,
                            profile: current.profile ? { ...current.profile, visualIdentity: current.profile.visualIdentity || asset.prompt } : { visualIdentity: asset.prompt, styling: "", colorPalette: "", consistencyRules: "" },
                        }
                      : overwriteAssetPrompts && current.supplierPrompt.trim() !== asset.prompt.trim()
                        ? {
                              supplierPrompt: asset.prompt,
                              profile: current.profile ? { ...current.profile, visualIdentity: asset.prompt } : { visualIdentity: asset.prompt, styling: "", colorPalette: "", consistencyRules: "" },
                              fieldOrigins: { ...current.fieldOrigins, supplierPrompt: "package" as const },
                          }
                        : {}),
              }
            : {
                  id,
                  code: asset.code,
                  name: asset.name,
                  description: "",
                  supplierPrompt: asset.prompt,
                  profile: { visualIdentity: asset.prompt, styling: "", colorPalette: "", consistencyRules: "" },
                  fieldOrigins: { supplierPrompt: "package" as const, profile: "package" as const },
              };
        const bucket = nextAssets[asset.kind] as DramaNamedAsset[];
        if (current) bucket[bucket.findIndex((item) => item.id === current.id)] = incoming;
        else if (asset.kind === "clues") nextAssets.clues.push({ ...incoming, payoff: "" });
        else bucket.push(incoming);
    }
    const episodes = project.episodes.filter((episode) => episode.code || episode.script.trim() || episode.shots.length);
    const kindByCode = new Map(compact.assets.map((asset) => [asset.code, asset.kind]));
    for (const item of compact.episodes) {
        const index = episodes.findIndex((episode) => episode.code === item.code);
        const current = episodes[index];
        const episodeText = (key: "title" | "script") => {
            if (current?.fieldOrigins?.[key] === "manual") return { value: current[key] || "", origin: "manual" as const };
            return { value: item[key], origin: "package" as const };
        };
        const shots = item.shots.map((shot, shotIndex): DramaShot => {
            const previous = current?.shots.find((candidate) => candidate.code === shot.code);
            const characterIds = shot.characters.map((code) => ids.get(code)!);
            const propIds = shot.props.map((code) => ids.get(code)!);
            const clueIds = shot.clues.map((code) => ids.get(code)!);
            const sceneId = shot.scene ? ids.get(shot.scene) : undefined;
            const intents = new Map<string, DramaShotReferenceIntent>();
            for (const entry of shot.referenceEntries || []) {
                const assetId = ids.get(entry.code);
                if (!assetId || intents.has(assetId)) continue;
                intents.set(assetId, { assetId, code: entry.code, role: roleForKind[kindByCode.get(entry.code) || "props"], guidance: entry.guidance });
            }
            const hasOldMedia = Boolean(previous?.videoUrl || previous?.storyboardImageUrl || previous?.storyboardEndImageUrl || previous?.storyboardFrames?.some((frame) => frame.mediaUrl));
            const text = Object.fromEntries(COMPACT_SHOT_TEXT_FIELDS.map((key) => [key, resolveCompactTextField(key, shot[key], previous)])) as Record<CompactShotTextField, { value: string; origin: "manual" | "package" | "ai" | undefined }>;
            const fieldOrigins: NonNullable<DramaShot["fieldOrigins"]> = {
                ...previous?.fieldOrigins,
                duration: "package",
                characterIds: "package",
                sceneId: "package",
                propIds: "package",
                clueIds: "package",
            };
            for (const key of COMPACT_SHOT_TEXT_FIELDS) {
                const origin = text[key].origin;
                if (origin) fieldOrigins[key] = origin;
                else delete fieldOrigins[key];
            }
            return {
                ...previous,
                id: previous?.id || `shot-${nanoid()}`,
                code: shot.code,
                order: shotIndex + 1,
                title: text.title.value,
                duration: shot.duration,
                description: text.description.value,
                sourceText: "",
                shotBoundary: "",
                dialogue: "",
                narration: "",
                utterances: [],
                performancePlan: undefined,
                dialoguePerformance: undefined,
                lightingPlan: undefined,
                imagePrompt: text.imagePrompt.value,
                videoPrompt: text.videoPrompt.value,
                executionVideoPrompt: undefined,
                executionImagePrompt: undefined,
                startFramePrompt: text.startFramePrompt.value,
                endFramePrompt: text.endFramePrompt.value,
                cameraMotion: "",
                continuity: undefined,
                entryState: undefined,
                exitState: undefined,
                framePlan: undefined,
                ...(intents.size ? { referenceIntents: [...intents.values()] } : {}),
                storySceneId: undefined,
                sourceAssetIds: [],
                videoReferenceIds: undefined,
                characterIds,
                sceneId,
                propIds,
                clueIds,
                videoMode: "direct",
                storyboardPrompt: undefined,
                storyboardEndPrompt: undefined,
                storyboardStatus: hasOldMedia && (previous?.storyboardImageUrl || previous?.storyboardFrames?.some((frame) => frame.mediaUrl)) ? "stale" : previous?.storyboardStatus || "idle",
                storyboardEndStatus: hasOldMedia && previous?.storyboardEndImageUrl ? "stale" : previous?.storyboardEndStatus || "idle",
                generationStatus: previous?.videoUrl ? "stale" : previous?.generationStatus || "idle",
                audioStatus: previous?.audioUrl ? "stale" : previous?.audioStatus || "idle",
                continuityStatus: hasOldMedia ? "stale" : "ready",
                fieldOrigins,
            };
        });
        const nextEpisode: DramaEpisode = {
            ...current,
            id: current?.id || `episode-${nanoid()}`,
            code: item.code,
            title: episodeText("title").value,
            script: episodeText("script").value,
            scriptRichContent: undefined,
            outline: "",
            hook: "",
            nextPreview: "",
            sourceRange: "",
            reviewStatus: "draft",
            reviewCompletionTask: undefined,
            visualReview: undefined,
            storyScenes: [],
            continuityEdges: [],
            shots,
            renderTask: undefined,
            fieldOrigins: { ...current?.fieldOrigins, title: episodeText("title").origin, script: episodeText("script").origin },
        };
        if (index < 0) episodes.push(nextEpisode);
        else episodes[index] = nextEpisode;
    }
    const hash = createHash("sha256").update(source).digest("hex");
    return {
        ...project,
        ...nextAssets,
        episodes,
        activeEpisodeId: episodes.find((episode) => episode.code === compact.episodes[0].code)?.id,
        productionLock: undefined,
        productionBible: project.productionBible
            ? {
                  ...project.productionBible,
                  targetDuration: undefined,
                  productionPlan: project.productionBible.productionPlan ? { ...project.productionBible.productionPlan, lockedAt: undefined } : undefined,
              }
            : undefined,
        sourceAssets: [
            ...(project.sourceAssets || []).filter((asset) => asset.id !== `source-compact-${hash.slice(0, 16)}`),
            { id: `source-compact-${hash.slice(0, 16)}`, type: "text", title: `精简制作包 ${fileName}`, textContent: hash, sourceHash: hash },
        ],
    };
}
