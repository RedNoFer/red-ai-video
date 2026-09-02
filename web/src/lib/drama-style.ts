export const DRAMA_STYLE_NAME = "半写实动漫幻想风 · 暗黑学院史诗奇幻";

export const DRAMA_STYLE_DESCRIPTION =
    "半写实动漫幻想风（semi-realistic anime fantasy illustration）的暗黑学院史诗奇幻：精致动漫五官、自然肤质与细致发丝、绘画笔触、真实材质、电影级体积光；巨型哥特魔法学院、符文法阵、暮色金紫对撞、黑金长袍、庄严神秘。不是纯写实摄影，不是真人影视感，不是3D游戏渲染。";

export const DRAMA_STYLE_VISUAL = "半写实动漫幻想插画媒介：精致动漫五官、自然皮肤与发丝质感、清晰轮廓、细腻绘画笔触、真实服装和建筑材质、柔和体积光、强暖金轮廓光与冷蓝紫阴影；不是纯写实摄影，不是3D游戏渲染";

export const DRAMA_STYLE_COLOR_SCRIPT = "暮色金紫主调，深蓝黑 #0B1026、学院紫 #241A42、旧银、暗红 #241016 与少量古铜金 #C8915D；人物面部使用自然暖肤色，冷蓝紫阴影与暖金轮廓形成高对比";

const LEGACY_LAYOUT_MARKERS = ["中性浅灰背景", "中性灰背景", "干净中性背景", "六模块纵向全量版", "三视图", "面部五角度", "设定板布局", "联系表", "分格模块", "多视角"];

function isDefaultDramaColorScript(value: string | undefined) {
    return value === DRAMA_STYLE_COLOR_SCRIPT || value === "暮色金紫主调";
}

export type ResolvedDramaStyle = {
    source: "custom" | "default";
    name: string;
    visualDescription: string;
    colorScript?: string;
    explicitNegativePrompt?: string;
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

export function resolveDramaStyleContract(project: { style?: string; productionBible?: { visualStyle?: string; colorScript?: string } }): ResolvedDramaStyle {
    const projectStyle = project.style?.trim() || "";
    const bibleStyle = project.productionBible?.visualStyle?.trim() || "";
    const style = projectStyle || bibleStyle;
    const isDefault = !style || style === DRAMA_STYLE_NAME;
    const configuredColorScript = project.productionBible?.colorScript?.trim();
    const colorScript = isDefault ? configuredColorScript || DRAMA_STYLE_COLOR_SCRIPT : configuredColorScript && !isDefaultDramaColorScript(configuredColorScript) ? configuredColorScript : undefined;
    const explicitNegativePrompt = isDefault ? undefined : style.match(/(?:禁止|不得|避免|不要)[^。；\n]+/u)?.[0];
    return {
        source: isDefault ? "default" : "custom",
        name: isDefault ? DRAMA_STYLE_NAME : style,
        visualDescription: isDefault ? DRAMA_STYLE_DESCRIPTION : style,
        ...(colorScript ? { colorScript } : {}),
        ...(explicitNegativePrompt ? { explicitNegativePrompt } : {}),
    };
}

export function resolveDramaVisualStyle(project: { style?: string; productionBible?: { visualStyle?: string } }) {
    return resolveDramaStyleContract(project).visualDescription;
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
