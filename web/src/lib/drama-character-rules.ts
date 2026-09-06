import type { DramaAssetProfile } from "@/lib/drama-project-contract";

/** Shared role-quality contract for package import, prompt compilation and optimization. */
export const DRAMA_CHARACTER_PROFILE_CONTRACT = [
    "visualIdentity 只描述身份与可见识别：设定年龄感和性别、脸型、眉眼鼻唇、肤色、发际线、发型和已确认的显著标记；没有事实时不要编造极端身高、族裔或新剧情。",
    "styling 只描述发型结构、服装层次、腰封/鞋靴、固定配饰、材质和穿着逻辑；不要把镜头、剧情动作或内部审核规则写入服装字段。",
    "colorPalette 只保留 2–4 个角色固有主色与少量强调色，跨镜头保持稳定；环境光色不写入角色固有色。",
    "consistencyRules 必须锁定年龄感、性别表达、脸型与五官、发际线和发束、体态比例、服装层次、固定配饰、固有色和显著标记；只允许用户明确要求的单项变化。",
].join("\n");

export const DRAMA_CHARACTER_SUPPLIER_QUALITY_RULES =
    "按设定年龄和性别保持自然骨骼与身材比例；面部比例自然、左右基本对称、眼鼻唇协调，皮肤细腻但保留真实材质；男性不女性化，女性不幼态化或过度性感；发际线、发束、脸部锚点、服装层次和固有色在三视图中完全一致；双手、手指、双腿和鞋靴完整，避免塑料皮肤、僵硬姿态、脸部变形和肢体畸形。";

export const DRAMA_CHARACTER_NEGATIVE_RULES = [
    "额外人物",
    "额外视图",
    "四分之三视图",
    "主立绘",
    "肖像特写",
    "表情组",
    "手部或道具拆解",
    "换脸",
    "换年龄",
    "性别表达漂移",
    "大头娃娃",
    "身体短粗",
    "服装结构变化",
    "额外配饰",
    "塑料皮肤",
    "脸部变形",
    "手指畸形",
    "缺失肢体",
    "裁掉头部或鞋靴",
    "文字",
    "logo",
    "水印",
].join("、");

export const DRAMA_CHARACTER_DEFAULT_CONSISTENCY = "按设定年龄和性别保持自然骨骼与身材比例；锁定脸型、五官、发际线、发束、体态、服装层次、固定配饰、固有色和显著标记；正面、严格左侧面、背面必须是同一角色，不因镜头重设计。";

export function normalizeDramaCharacterProfile(profile: DramaAssetProfile | undefined, description: string, name: string): DramaAssetProfile {
    const current = profile || { visualIdentity: "", styling: "", colorPalette: "", consistencyRules: "" };
    const rawVisualIdentity = current.visualIdentity.trim() || description.trim();
    const identityPrefix = `${name}的脸型、五官、发型和年龄感按剧情身份固定`;
    const visualIdentity = rawVisualIdentity.startsWith(identityPrefix) ? rawVisualIdentity : [identityPrefix, rawVisualIdentity].filter(Boolean).join("；");
    const styling = current.styling.trim() || `${name}的发型、服装、固定配饰、鞋靴与材质按描述固定`;
    const colorPalette = current.colorPalette.trim() || "按角色固有色保持跨镜头一致";
    const consistencyRules = appendUniqueClauses(current.consistencyRules, DRAMA_CHARACTER_DEFAULT_CONSISTENCY);
    const identityAnchors = Array.from(new Set([...(current.identityAnchors || []), visualIdentity].map((value) => value.trim()).filter(Boolean)));
    const forbiddenChanges = Array.from(new Set([...(current.forbiddenChanges || []), ...DRAMA_CHARACTER_NEGATIVE_RULES.split("、")].map((value) => value.trim()).filter(Boolean)));
    return { ...current, visualIdentity, styling, colorPalette, consistencyRules, identityAnchors, forbiddenChanges };
}

function appendUniqueClauses(current: string, addition: string) {
    return Array.from(
        new Set(
            [current, addition].flatMap((value) =>
                value
                    .split(/[；;]/u)
                    .map((item) => item.trim())
                    .filter(Boolean),
            ),
        ),
    ).join("；");
}
