export const DRAMA_STYLE_NAME = "半写实动漫幻想风 · 暗黑学院史诗奇幻";

export const DRAMA_STYLE_DESCRIPTION = "半写实动漫幻想风（semi-realistic anime fantasy illustration）的暗黑学院史诗奇幻：精致动漫五官、自然肤质与细致发丝、绘画笔触、真实材质、电影级体积光；巨型哥特魔法学院、符文法阵、暮色金紫对撞、黑金长袍、庄严神秘。不是纯写实摄影，不是真人影视感，不是3D游戏渲染。";

export const DRAMA_STYLE_VISUAL = "半写实动漫幻想插画媒介：精致动漫五官、自然皮肤与发丝质感、清晰轮廓、细腻绘画笔触、真实服装和建筑材质、柔和体积光、强暖金轮廓光与冷蓝紫阴影；不是纯写实摄影，不是3D游戏渲染";

export const DRAMA_STYLE_COLOR_SCRIPT = "暮色金紫主调，深蓝黑 #0B1026、学院紫 #241A42、旧银、暗红 #241016 与少量古铜金 #C8915D；人物面部使用自然暖肤色，冷蓝紫阴影与暖金轮廓形成高对比";

const LEGACY_STYLE_MARKERS = ["VS14", "电影感国漫", "写实电影感", "现实电影感", "纯写实", "真人影视", "3D游戏", "游戏模型", "中世纪史诗学院奇幻", "中世纪史诗的学院奇幻", "暗黑学院史诗奇幻"];
const LEGACY_STYLE_NAMES = new Set(["写实", "电影感", "纯写实", "3D游戏渲染"]);
const LEGACY_LAYOUT_MARKERS = ["中性浅灰背景", "中性灰背景", "干净中性背景", "六模块纵向全量版", "三视图", "面部五角度", "设定板布局", "联系表", "分格模块", "多视角"];

export function isLegacyDramaStyle(value: unknown) {
    const style = typeof value === "string" ? value.trim() : "";
    if (!style || style === DRAMA_STYLE_NAME || style.startsWith("半写实动漫幻想风")) return false;
    return LEGACY_STYLE_NAMES.has(style) || LEGACY_STYLE_MARKERS.some((marker) => style.includes(marker));
}

export function normalizeDramaStyleName(value: unknown) {
    const style = typeof value === "string" ? value.trim() : "";
    return !style || isLegacyDramaStyle(style) ? DRAMA_STYLE_NAME : style;
}

export function resolveDramaVisualStyle(project: { style?: string; productionBible?: { visualStyle?: string } }) {
    const style = project.style?.trim() || project.productionBible?.visualStyle?.trim() || "";
    return isLegacyDramaStyle(style) || !style || style === DRAMA_STYLE_NAME || style.startsWith("半写实动漫幻想风") ? DRAMA_STYLE_DESCRIPTION : `${DRAMA_STYLE_DESCRIPTION} 项目补充叙事方向：${style}`;
}

export function sanitizeDramaVisualPrompt(value: unknown) {
    if (typeof value !== "string") return "";
    return [...LEGACY_STYLE_MARKERS, ...LEGACY_LAYOUT_MARKERS].reduce((text, marker) => text.split(marker).join(""), value).replace(/[，、；：]{2,}/g, "，").trim();
}
