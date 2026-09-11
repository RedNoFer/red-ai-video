import type { DramaProductionPlan, DramaProductionBible, DramaReferenceManifestRole } from "@/lib/drama-project-contract";

export const DRAMA_PRODUCTION_PLAN_VERSION = "drama-production-plan-v1" as const;
export const DEFAULT_DRAMA_SKILL = { id: "seedance-director", name: "Seedance 导演", version: "2.0" } as const;
export const DEFAULT_DRAMA_VIDEO_SKILL = { id: "seedance-25-director", name: "Seedance 2.5 导演", version: "2.5" } as const;
export const DRAMA_REFERENCE_ROLES: DramaReferenceManifestRole[] = ["previous_actual_tail", "character_anchor", "scene_anchor", "prop_anchor", "action_keyframe", "composition_keyframe"];
export const DRAMA_VIDEO_RESOLUTION_OPTIONS = ["480p", "720p", "1080p"] as const;
export const DRAMA_SHOT_DURATION_OPTIONS = [15, 30] as const;
export type DramaShotDuration = (typeof DRAMA_SHOT_DURATION_OPTIONS)[number];
export const DRAMA_SCRIPT_SHOT_DURATION_OPTIONS = DRAMA_SHOT_DURATION_OPTIONS;
export type DramaScriptShotDuration = (typeof DRAMA_SCRIPT_SHOT_DURATION_OPTIONS)[number];
export const DRAMA_FRAME_COUNT_DEFAULT = 5;
export const DRAMA_FRAME_COUNT_MAX = 9;
export const DRAMA_FRAME_POLICY_OPTIONS = ["fixed-4", "fixed-5", "agent"] as const;
export type DramaFramePolicy = (typeof DRAMA_FRAME_POLICY_OPTIONS)[number];
export const DRAMA_VIDEO_REFERENCE_IMAGE_LIMIT = 9;
export const DRAMA_VIDEO_REFERENCE_IMAGE_LIMIT_30S = 30;

export function dramaReferenceImageBudget(duration: DramaShotDuration | number): number {
    return duration >= 30 ? DRAMA_VIDEO_REFERENCE_IMAGE_LIMIT_30S : DRAMA_VIDEO_REFERENCE_IMAGE_LIMIT;
}

export function defaultDramaProductionPlan(source: DramaProductionPlan["source"] = "new-project"): DramaProductionPlan {
    return {
        version: DRAMA_PRODUCTION_PLAN_VERSION,
        skills: [DEFAULT_DRAMA_SKILL, DEFAULT_DRAMA_VIDEO_SKILL],
        visual: { visualStyle: "", artStyle: "", source: "agent" },
        video: {
            model: "seedance-2-0-official",
            mode: "storyboard",
            ratio: "9:16",
            resolution: "720p",
            durationPolicy: "shot",
            shotDuration: 15,
            framePolicy: "agent",
            count: 1,
            audioMode: "native",
            allowExplicitFallback: false,
        },
        references: { strategy: "adaptive", minImages: 3, maxImages: 5, roles: [...DRAMA_REFERENCE_ROLES] },
        continuity: { mode: "strict", requireAcceptedActualTail: true },
        source,
    };
}

export function productionPlanFromBible(bible: DramaProductionBible | undefined) {
    return bible?.productionPlan;
}

export function normalizeDramaProductionPlan(value: unknown, fallback?: DramaProductionPlan): DramaProductionPlan | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
    const input = value as Record<string, unknown>;
    const rawBase = fallback || defaultDramaProductionPlan("package");
    const base = rawBase.visual ? rawBase : { ...rawBase, visual: { visualStyle: "", artStyle: "", source: "agent" as const } };
    const videoInput = object(input.video);
    const visualInput = object(input.visual);
    const referenceInput = object(input.references);
    const continuityInput = object(input.continuity);
    const skills = Array.isArray(input.skills)
        ? input.skills.flatMap((item) => {
              const skill = object(item);
              const id = text(skill.id);
              return id ? [{ id, name: text(skill.name) || id, version: text(skill.version) || "unknown" }] : [];
          })
        : base.skills;
    const normalizedSkills = [DEFAULT_DRAMA_SKILL, DEFAULT_DRAMA_VIDEO_SKILL].reduce((current, required) => (current.some((skill) => skill.id === required.id) ? current : [...current, required]), skills);
    const requestedMode = text(videoInput.mode);
    const baseMode = base.video.mode === "text-to-video" ? "text-to-video" : "storyboard";
    const mode = requestedMode === "text-to-video" ? "text-to-video" : ["storyboard", "reference", "first-frame", "first-last"].includes(requestedMode) ? "storyboard" : baseMode;
    const minImages = boundedInteger(referenceInput.minImages, base.references.minImages, 1, 30);
    const maxImages = Math.max(minImages, boundedInteger(referenceInput.maxImages, base.references.maxImages, minImages, 30));
    const roles = Array.isArray(referenceInput.roles) ? referenceInput.roles.map(text).filter((role): role is DramaReferenceManifestRole => DRAMA_REFERENCE_ROLES.includes(role as DramaReferenceManifestRole)) : base.references.roles;
    const requestedShotDuration = positive(videoInput.shotDuration) || (videoInput.durationPolicy === "fixed" ? positive(videoInput.duration) : undefined);
    const framePolicy = normalizeFramePolicy(videoInput.framePolicy, base.video.framePolicy || (Number(videoInput.frameCount) === 4 ? "fixed-4" : Number(videoInput.frameCount) === 5 ? "fixed-5" : "agent"));
    const visualStyle = typeof visualInput.visualStyle === "string" ? text(visualInput.visualStyle) : base.visual.visualStyle;
    const artStyle = typeof visualInput.artStyle === "string" ? text(visualInput.artStyle) : base.visual.artStyle;
    const visualDirection = typeof visualInput.visualDirection === "string" ? text(visualInput.visualDirection) : base.visual.visualDirection;
    const frameCount = framePolicy === "fixed-4" ? 4 : framePolicy === "fixed-5" ? 5 : undefined;
    return {
        version: DRAMA_PRODUCTION_PLAN_VERSION,
        skills: normalizedSkills,
        visual: {
            visualStyle,
            artStyle,
            ...(visualDirection ? { visualDirection } : {}),
            source: visualInput.source === "manual" || visualInput.source === "agent" ? visualInput.source : base.visual.source,
        },
        video: {
            model: text(videoInput.model) || base.video.model,
            channelId: text(videoInput.channelId) || base.video.channelId,
            mode,
            ratio: text(videoInput.ratio) || base.video.ratio,
            resolution: normalizeResolution(videoInput.resolution, base.video.resolution),
            durationPolicy: videoInput.durationPolicy === "fixed" ? "fixed" : "shot",
            duration: positive(videoInput.duration) || base.video.duration,
            shotDuration: normalizeShotDuration(requestedShotDuration, base.video.shotDuration || 15),
            ...(frameCount ? { frameCount } : {}),
            framePolicy,
            count: boundedInteger(videoInput.count, base.video.count, 1, 50),
            audioMode: ["native", "voiceover", "mute"].includes(text(videoInput.audioMode)) ? (text(videoInput.audioMode) as DramaProductionPlan["video"]["audioMode"]) : base.video.audioMode,
            allowExplicitFallback: videoInput.allowExplicitFallback === true,
            modelParameters: object(videoInput.modelParameters),
        },
        references: { strategy: "adaptive", minImages, maxImages, roles: roles.length ? roles : base.references.roles },
        continuity: { mode: continuityInput.mode === "balanced" ? "balanced" : "strict", requireAcceptedActualTail: continuityInput.requireAcceptedActualTail !== false },
        lockedAt: text(input.lockedAt) || base.lockedAt,
        source: ["new-project", "package", "manual"].includes(text(input.source)) ? (text(input.source) as DramaProductionPlan["source"]) : base.source,
    };
}

export function dramaVisualDirection(plan: DramaProductionPlan) {
    if (plan.visual.visualDirection?.trim()) return plan.visual.visualDirection.trim();
    if (plan.visual.visualStyle.trim() === plan.visual.artStyle.trim()) return plan.visual.visualStyle.trim();
    return [plan.visual.visualStyle.trim() ? `视觉风格：${plan.visual.visualStyle.trim()}` : "", plan.visual.artStyle.trim() ? `画风：${plan.visual.artStyle.trim()}` : ""].filter(Boolean).join("\n");
}

export function applyDramaVisualDirection(plan: DramaProductionPlan, value: string): DramaProductionPlan {
    const direction = value.trim();
    const visualStyle = direction.match(/(?:^|\n)视觉风格\s*[：:]\s*([^\n]+)/u)?.[1]?.trim() || direction;
    const artStyle = direction.match(/(?:^|\n)画风\s*[：:]\s*([^\n]+)/u)?.[1]?.trim() || direction;
    return { ...plan, visual: { ...plan.visual, visualStyle, artStyle, visualDirection: direction, source: visualStyle && artStyle ? "manual" : "agent" } };
}

export function resolveDramaShotDurationPreference(prompt: string, fallback: DramaShotDuration = 15): DramaShotDuration {
    const values = Array.from(prompt.matchAll(/(?:^|[^\d])(15|20|30)\s*(?:秒|s)(?!\w)/giu), (match) => Number(match[1])).filter((value): value is DramaShotDuration => DRAMA_SHOT_DURATION_OPTIONS.includes(value as DramaShotDuration));
    const unique = [...new Set(values)];
    return unique.length === 1 ? unique[0] : fallback;
}

export function resolveDramaFrameCountPreference(prompt: string, fallback = DRAMA_FRAME_COUNT_DEFAULT): number {
    const values = Array.from(prompt.matchAll(/(?:分\s*)?(\d+)\s*(?:个)?\s*帧/giu), (match) => Number(match[1])).filter((value) => Number.isInteger(value) && value >= 1 && value <= DRAMA_FRAME_COUNT_MAX);
    return values.length ? values.at(-1)! : Math.max(1, Math.min(DRAMA_FRAME_COUNT_MAX, Math.floor(fallback)));
}

function object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function positive(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
}

function normalizeShotDuration(value: unknown, fallback: number) {
    const requested = Number(value);
    if (DRAMA_SHOT_DURATION_OPTIONS.includes(requested as DramaShotDuration)) return requested as DramaShotDuration;
    return DRAMA_SHOT_DURATION_OPTIONS.includes(fallback as DramaShotDuration) ? (fallback as DramaShotDuration) : 15;
}

function normalizeFramePolicy(value: unknown, fallback: DramaFramePolicy): DramaFramePolicy {
    if (DRAMA_FRAME_POLICY_OPTIONS.includes(value as DramaFramePolicy)) return value as DramaFramePolicy;
    return DRAMA_FRAME_POLICY_OPTIONS.includes(fallback) ? fallback : "agent";
}

function normalizeResolution(value: unknown, fallback: string) {
    const normalized = text(value).toLowerCase().replace(/p$/, "");
    if (DRAMA_VIDEO_RESOLUTION_OPTIONS.some((option) => option.slice(0, -1) === normalized)) return `${normalized}p`;
    const fallbackValue = text(fallback).toLowerCase().replace(/p$/, "");
    return DRAMA_VIDEO_RESOLUTION_OPTIONS.some((option) => option.slice(0, -1) === fallbackValue) ? `${fallbackValue}p` : "720p";
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number >= min ? Math.min(max, number) : fallback;
}
