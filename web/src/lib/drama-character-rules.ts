import type { DramaAssetProfile } from "@/lib/drama-project-contract";

/** Shared role-quality contract for package import, prompt compilation and optimization. */
export const DRAMA_CHARACTER_PROFILE_CONTRACT = [
    "visualIdentity 只描述身份与可见识别：设定年龄感和性别、脸型、眉眼鼻唇、肤色、发际线、发型和已确认的显著标记；没有事实时不要编造极端身高、族裔或新剧情。",
    "styling 只描述发型结构、服装层次、腰封/鞋靴、固定配饰、材质和穿着逻辑；不要把镜头、剧情动作或内部审核规则写入服装字段。",
    "colorPalette 只保留 2–4 个角色固有主色与少量强调色，跨镜头保持稳定；环境光色不写入角色固有色。",
    "consistencyRules 必须锁定年龄感、性别表达、脸型与五官、发际线和发束、体态比例、服装层次、固定配饰、固有色和显著标记，并明确身份特写、正面全身、严格左侧面全身、背面全身四个视图的职责；只允许用户明确要求的单项变化。",
].join("\n");

export const DRAMA_CHARACTER_SUPPLIER_QUALITY_RULES =
    "按设定年龄和性别保持自然骨骼与身材比例；男性不女性化，女性不幼态化或过度性感；四视图必须是同一身份：身份特写锁定五官，正面、严格左侧面、背面锁定体态、服装结构和固有色；后三个全身视图的双手、手指、双腿和鞋靴完整，避免僵硬姿态、脸部变形和肢体畸形。";

/** Concrete supplier-facing rendering guidance; it must not define a project's theme. */
export const DRAMA_CHARACTER_RENDER_STYLE =
    "高精度人物细节与清晰轮廓边缘。";

export const DRAMA_CHARACTER_FACE_MODELING_RULES =
    "身份特写与正面视图的五官按设定年龄和性别的真实骨骼塑形：眉骨、眼睑、鼻梁、鼻尖、唇峰、下颌线和耳部具有明确体积关系；左右基本对称，眼神清晰，皮肤细腻并保留自然微纹理；身份特写只放大当前角色的脸部识别，不改变脸型、年龄感或发际线；避免扁平脸、塑料脸、幼态大眼、五官糊成一团和男性女性化。";

export const DRAMA_CHARACTER_HAIR_MODELING_RULES =
    "头发按发际线、分区、根部体积、主发束、碎发和尾端层次建模；身份特写与正面视图清楚展示发际线和脸周发束，侧面与背面展示束发位置、方向和长度；四个视图保持同一发型结构，发丝有粗细变化、明确走向和自然高光，避免一团黑、贴头皮、塑料丝带或随机换发型。";

export const DRAMA_CHARACTER_WARDROBE_MATERIAL_RULES =
    "服装按真实裁剪逻辑分层，内层、外袍、腰封、袖口、下摆和鞋靴结构清楚；丝绸、锦缎、皮革、金属、玉石和薄纱分别呈现不同反射与粗糙度，刺绣和纹样贴合衣料，不出现廉价塑料质感。";

export const DRAMA_CHARACTER_STUDIO_LIGHT_RULES =
    "柔和大面积棚拍主光，轻微冷暖轮廓光，面部和服装细节均匀可见；阴影保留接触关系，金属高光不过曝，使用干净的纯白或浅灰背景。";

export const DRAMA_CHARACTER_NEGATIVE_RULES = [
    "额外人物",
    "额外视图",
    "四分之三视图",
    "主立绘",
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

export const DRAMA_CHARACTER_DEFAULT_CONSISTENCY = "按设定年龄和性别保持自然骨骼与身材比例；锁定脸型、五官、发际线、发束、体态、服装层次、固定配饰、固有色和显著标记；身份特写、正面、严格左侧面、背面必须是同一角色，不因视图重设计；身份特写只负责精确锁定五官与脸部识别，不替代后三个全身视图。";

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
