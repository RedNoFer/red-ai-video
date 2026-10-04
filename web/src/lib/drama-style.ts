export const DRAMA_STYLE_NAME = "用户自定义视觉风格";

export const DRAMA_STYLE_DESCRIPTION = "用户自定义视觉风格；只遵循项目明确配置的媒介、题材、造型、材质、光色和负面要求，不预设时代、场景或固定配色。";

export const DRAMA_STYLE_VISUAL = "按项目配置的视觉媒介、造型、材质和光色执行，不预设题材或固定配色";

export const DRAMA_STYLE_COLOR_SCRIPT = "用户自定义色彩";

export const DRAMA_ASSET_REALISM_RULES =
    "在当前题材与项目视觉合同内优先呈现真实电影摄影与实物物理质感：比例、透视、重量、接触阴影和光线方向可信；只呈现有依据的细微纹理、磨损、接缝与不均匀边缘；避免卡通化、塑料皮肤、塑料高光、数字磨皮和无依据的发光效果。";

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
    /** Internal equality key; never render this in a provider prompt. */
    fingerprint?: string;
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
    productionBible?: { visualStyle?: string; colorScript?: string; globalNegativePrompt?: string; productionPlan?: { lockedAt?: string; source?: string; visual?: { visualStyle?: string; artStyle?: string; visualDirection?: string; source?: string } } };
}): ResolvedDramaStyle {
    const projectStyle = project.style?.trim() || "";
    const bibleStyle = project.productionBible?.visualStyle?.trim() || "";
    const productionPlan = project.productionBible?.productionPlan;
    const plannedStyle = productionPlan?.visual?.visualStyle?.trim() || "";
    const planIsExplicit = Boolean(plannedStyle && (productionPlan?.lockedAt || productionPlan?.source === "manual" || productionPlan?.visual?.source === "manual"));
    // The complete project/Bible contract is authoritative. A locked plan is
    // still allowed to supply an artStyle when it is aligned with that
    // contract, but a short historical summary can never replace it.
    const customProjectStyle = projectStyle && !isBuiltInDramaStyle(projectStyle) ? projectStyle : "";
    const customBibleStyle = bibleStyle && !isBuiltInDramaStyle(bibleStyle) ? bibleStyle : "";
    const customPlannedStyle = plannedStyle && !isBuiltInDramaStyle(plannedStyle) ? plannedStyle : "";
    const style = customProjectStyle || customBibleStyle || customPlannedStyle || projectStyle || bibleStyle || plannedStyle || "";
    const planProvidesStyle = Boolean(plannedStyle && plannedStyle === style && ((!customProjectStyle && !customBibleStyle) || planIsExplicit || plannedStyle === projectStyle || plannedStyle === bibleStyle));
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
    const contract = {
        visualStyle: resolved.visualDescription,
        artStyle: resolved.artStyle || "",
        colorScript: resolved.colorScript || "",
        globalNegativePrompt: resolved.globalNegativePrompt || "",
    };
    return { ...contract, fingerprint: dramaVisualContractFingerprint(contract) };
}

export function dramaVisualContractFingerprint(contract: Pick<DramaGlobalVisualContract, "visualStyle" | "artStyle" | "colorScript" | "globalNegativePrompt">) {
    const canonical = [contract.visualStyle, contract.artStyle, contract.colorScript, contract.globalNegativePrompt].map((value) => value.trim()).join("\u001f");
    let hash = 2166136261;
    for (const character of canonical) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return `visual-${(hash >>> 0).toString(16)}`;
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
