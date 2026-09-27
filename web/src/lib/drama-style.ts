export const DRAMA_STYLE_NAME = "用户自定义视觉风格";

export const DRAMA_STYLE_DESCRIPTION = "用户自定义视觉风格；只遵循项目明确配置的媒介、题材、造型、材质、光色和负面要求，不预设时代、场景或固定配色。";

export const DRAMA_STYLE_VISUAL = "按项目配置的视觉媒介、造型、材质和光色执行，不预设题材或固定配色";

export const DRAMA_STYLE_COLOR_SCRIPT = "用户自定义色彩";

const LEGACY_DRAMA_STYLE_NAME = "半写实动漫幻想风 · 暗黑学院史诗奇幻";
const LEGACY_LAYOUT_MARKERS = ["中性浅灰背景", "中性灰背景", "干净中性背景", "六模块纵向全量版", "三视图", "面部五角度", "设定板布局", "联系表", "分格模块", "多视角"];

function isDefaultDramaColorScript(value: string | undefined) {
    return value === DRAMA_STYLE_COLOR_SCRIPT || value === "暮色金紫主调";
}

function isBuiltInDramaStyle(value: string) {
    return value === DRAMA_STYLE_NAME || value === LEGACY_DRAMA_STYLE_NAME;
}

export type ResolvedDramaStyle = {
    source: "custom" | "default";
    name: string;
    visualDescription: string;
    artStyle?: string;
    colorScript?: string;
    explicitNegativePrompt?: string;
    globalNegativePrompt?: string;
};

export type DramaGlobalVisualContract = {
    visualStyle: string;
    artStyle: string;
    colorScript: string;
    globalNegativePrompt: string;
};

export function isLegacyDramaStyle(value: unknown) {
    // Imported packages may intentionally use any visual language; legacy
    // markers are sanitized only when embedded in stale prompt text.
    void value;
    return false;
}

export function normalizeDramaStyleName(value: unknown) {
    const style = typeof value === "string" ? value.trim() : "";
    return style || DRAMA_STYLE_NAME;
}

export function resolveDramaStyleContract(project: {
    style?: string;
    productionBible?: { visualStyle?: string; colorScript?: string; globalNegativePrompt?: string; productionPlan?: { lockedAt?: string; source?: string; visual?: { visualStyle?: string; artStyle?: string; source?: string } } };
}): ResolvedDramaStyle {
    const projectStyle = project.style?.trim() || "";
    const bibleStyle = project.productionBible?.visualStyle?.trim() || "";
    const productionPlan = project.productionBible?.productionPlan;
    const plannedStyle = productionPlan?.visual?.visualStyle?.trim() || "";
    const planIsExplicit = Boolean(plannedStyle && (productionPlan?.lockedAt || productionPlan?.source === "manual" || productionPlan?.visual?.source === "manual"));
    // A manually locked production plan is an explicit current setting. An
    // unmarked plan is only a fallback and must not resurrect stale style
    // text over the current project style.
    const styleCandidates = planIsExplicit ? [plannedStyle, projectStyle, bibleStyle] : [projectStyle, plannedStyle, bibleStyle];
    const style = styleCandidates.find((value) => value && !isBuiltInDramaStyle(value)) || styleCandidates.find(Boolean) || "";
    const planProvidesStyle = Boolean(plannedStyle && style === plannedStyle);
    const artStyle = planProvidesStyle ? productionPlan?.visual?.artStyle?.trim() || "" : "";
    const isDefault = !style || isBuiltInDramaStyle(style);
    const configuredColorScript = project.productionBible?.colorScript?.trim();
    const colorScript = isDefault ? configuredColorScript || DRAMA_STYLE_COLOR_SCRIPT : configuredColorScript && !isDefaultDramaColorScript(configuredColorScript) ? configuredColorScript : undefined;
    const explicitNegativePrompt = isDefault ? undefined : style.match(/(?:禁止|不得|避免|不要)[^。；\n]+/u)?.[0];
    const globalNegativePrompt = [project.productionBible?.globalNegativePrompt?.trim(), explicitNegativePrompt].filter(Boolean).join("；");
    return {
        source: isDefault ? "default" : "custom",
        name: isDefault ? DRAMA_STYLE_NAME : style,
        visualDescription: isDefault ? DRAMA_STYLE_DESCRIPTION : style,
        ...(artStyle ? { artStyle } : {}),
        ...(colorScript ? { colorScript } : {}),
        ...(explicitNegativePrompt ? { explicitNegativePrompt } : {}),
        ...(globalNegativePrompt ? { globalNegativePrompt } : {}),
    };
}

export function resolveDramaStyleContractWithFallback(project: Parameters<typeof resolveDramaStyleContract>[0], fallback?: Parameters<typeof resolveDramaStyleContract>[0]) {
    const current = resolveDramaStyleContract(project);
    if (current.source === "custom" || !fallback) return current;
    const fallbackContract = resolveDramaStyleContract(fallback);
    return hasConcreteDramaStyleContract(fallback) ? fallbackContract : current;
}

export function hasConcreteDramaStyleContract(project: Parameters<typeof resolveDramaStyleContract>[0]) {
    const resolved = resolveDramaStyleContract(project);
    const plan = project.productionBible?.productionPlan;
    return resolved.source === "custom" && Boolean(resolved.artStyle || plan?.lockedAt || plan?.source === "manual" || plan?.visual?.source === "manual");
}

export function resolveDramaVisualStyle(project: { style?: string; productionBible?: { visualStyle?: string } }) {
    return resolveDramaStyleContract(project).visualDescription;
}

export function resolveDramaGlobalVisualContract(project: Parameters<typeof resolveDramaStyleContract>[0]): DramaGlobalVisualContract {
    const resolved = resolveDramaStyleContract(project);
    return {
        visualStyle: resolved.visualDescription,
        artStyle: resolved.artStyle || "",
        colorScript: resolved.colorScript || "",
        globalNegativePrompt: resolved.globalNegativePrompt || "",
    };
}

export function formatDramaGlobalVisualContract(contract: Partial<DramaGlobalVisualContract> | undefined) {
    if (!contract) return "";
    return [
        contract.visualStyle ? `全局视觉风格：${contract.visualStyle}` : "",
        contract.artStyle ? `全局画风规格：${contract.artStyle}` : "",
        contract.colorScript ? `全局色彩脚本：${contract.colorScript}` : "",
        contract.globalNegativePrompt ? `全局负面约束：${contract.globalNegativePrompt}` : "",
    ]
        .filter(Boolean)
        .join("\n");
}

export function resolveDramaColorScript(project: { style?: string; productionBible?: { visualStyle?: string; colorScript?: string } }) {
    return resolveDramaStyleContract(project).colorScript || "";
}

export function sanitizeDramaVisualPrompt(value: unknown) {
    if (typeof value !== "string") return "";
    return ["VS14", ...LEGACY_LAYOUT_MARKERS]
        .reduce((text, marker) => text.split(marker).join(""), value)
        .replace(/[，、；：]{2,}/g, "，")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}
