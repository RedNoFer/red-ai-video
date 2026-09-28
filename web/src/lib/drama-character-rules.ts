import type { DramaAssetProfile } from "@/lib/drama-project-contract";

/** Shared role-quality contract for package import, prompt compilation and optimization. */
export const DRAMA_CHARACTER_PROFILE_CONTRACT = [
    "visualIdentity 只描述身份与可见识别：设定年龄感和性别、脸型、眉眼鼻唇、肤色、发际线、发型和已确认的显著标记；没有事实时不要编造极端身高、族裔或新剧情。",
    "styling 只描述当前项目视觉合同下的发型结构、服装层次、腰部结构、鞋靴、固定配饰、材质和穿着逻辑；历史资产中的造型不能覆盖当前合同，也不要把镜头、剧情动作或内部审核规则写入服装字段。",
    "colorPalette 只描述当前项目视觉合同重新设计后的角色固有主色与少量强调色，跨镜头保持稳定；环境光色不写入角色固有色。",
    "consistencyRules 只锁定年龄感、性别表达、脸型与五官、发际线和发束、体态比例、显著标记及四个视图的身份连续性；服装、配饰、材质和固有色只进入 styling，并必须服从当前项目视觉合同；只允许用户明确要求的单项变化。",
].join("\n");

export const DRAMA_CHARACTER_SUPPLIER_QUALITY_RULES =
    "按设定年龄和性别保持自然骨骼与身材比例；男性不女性化，女性不幼态化或过度性感；四视图必须是同一身份：身份特写锁定五官，正面、严格左侧面、背面锁定体态，以及当前项目视觉合同下统一设计的服装结构和固有色；后三个全身视图的双手、手指、双腿和鞋靴完整，避免僵硬姿态、脸部变形和肢体畸形。";

export const DRAMA_CHARACTER_BODY_MODELING_RULES = "按设定年龄和性别保持自然骨骼与身材比例；男性不女性化，女性不幼态化或过度性感。";

export const DRAMA_CHARACTER_CURRENT_DESIGN_RULE = "服装、配饰、材质与角色固有色按当前项目视觉合同重新设计，并在四个视图之间保持同一套当前设计。";

export const DRAMA_CHARACTER_CURRENT_COLOR_RULE = "角色固有色按当前项目视觉合同重新设计，并在四个视图与后续镜头之间保持一致。";

/** Concrete supplier-facing rendering guidance; it must not define a project's theme. */
export const DRAMA_CHARACTER_RENDER_STYLE = "高精度人物细节与清晰轮廓边缘。";

export const DRAMA_CHARACTER_FACE_MODELING_RULES =
    "身份特写与正面视图的五官按设定年龄和性别的真实骨骼塑形：眉骨、眼睑、鼻梁、鼻尖、唇峰、下颌线和耳部具有明确体积关系；左右基本对称，眼神清晰，皮肤细腻并保留自然微纹理；身份特写只放大当前角色的脸部识别，不改变脸型、年龄感或发际线；避免扁平脸、塑料脸、幼态大眼、五官糊成一团和男性女性化。";

export const DRAMA_CHARACTER_HAIR_MODELING_RULES =
    "头发按发际线、分区、根部体积、主发束、碎发和尾端层次建模；身份特写与正面视图清楚展示发际线和脸周发束，侧面与背面展示束发位置、方向和长度；四个视图保持同一发型结构，发丝有粗细变化、明确走向和自然高光，避免一团黑、贴头皮、塑料丝带或随机换发型。";

export const DRAMA_CHARACTER_WARDROBE_MATERIAL_RULES = "服装按真实裁剪逻辑分层，内层、主体服装、腰部结构、袖口、下摆和鞋靴结构清楚；布料、皮革、金属、硬质配件和其他已确认材质分别呈现不同反射与粗糙度，表面细节贴合对应材质，不出现廉价塑料质感。";

export const DRAMA_CHARACTER_STUDIO_LIGHT_RULES = "柔和大面积棚拍主光，轻微冷暖轮廓光，面部和服装细节均匀可见；阴影保留接触关系，金属高光不过曝，使用干净的纯白或浅灰背景。";

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
    "四视图之间服装结构漂移",
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

export const DRAMA_CHARACTER_DEFAULT_CONSISTENCY =
    "按设定年龄和性别保持自然骨骼与身材比例；锁定脸型、五官、发际线、发束、体态和显著标记；身份特写、正面、严格左侧面、背面必须是同一角色，不因视图重设计；身份特写只负责精确锁定五官与脸部识别，不替代后三个全身视图。";

const CHARACTER_VISUAL_FACT_PATTERN =
    /少年|少女|儿童|青年|中年|老年|男性|女性|年龄|骨骼|身材|体态|脸型|五官|眉|眼|鼻|唇|下颌|耳|肤色|皮肤|发际线|发型|头发|黑发|白发|灰发|棕发|金发|发色|发束|碎发|发丝|高束|束发|长发|短发|马尾|辫|刘海|发髻|疤|痣|胎记|标记|徽记|比例|对称/u;
const CHARACTER_NARRATIVE_FACT_PATTERN =
    /(?:故事|剧情|小说|原文|章节|背景|关系|冲突|事件|经历|过去|审判|反击|契约|父亲|母亲|名声|承诺|婚约|誓言|承担|宿命|情绪|弧线|对白|台词|镜头|场景|大厅|古堡|教堂|议事|由[^；。]+(?:转成|转为|变成)|再以|随后|然后|最终|因为|因此)/u;
const CHARACTER_STYLING_FACT_PATTERN = /服装|服饰|衣着|穿着|长袍|袍|斗篷|披风|外套|制服|盔甲|铠甲|护腕|护甲|腰封|腰带|鞋靴|鞋子|靴子|手套|配饰|饰品|首饰|挂件|纹样|刺绣|面料|材质|皮革|金属|玉石|色彩|配色|固有色|主色|颜色|时代|工艺|风格|渲染|光色|灯光/u;
const CHARACTER_CONTINUITY_FACT_PATTERN = /自然骨骼|身材比例|体态|脸型|五官|发际线|显著标记|同一角色|同一身份|身份特写|正面|左侧面|背面|四视图|头身比|保持|锁定|固定|不因视图重设计/u;

/** Extract only visible character identity facts from legacy free-form text. */
export function extractDramaCharacterVisualFacts(value: string) {
    return Array.from(
        new Set(
            value
                .split(/[；;。\n，,、]+/u)
                .map((item) =>
                    item
                        .replace(/^(?:主体与资产类型|身份\/结构锚点|一致性锁定|可见状态与材质|构图与画幅|光色与风格|负面约束)[：:]\s*/u, "")
                        .replace(/按(?:剧情|故事|原文|描述|当前项目视觉合同)[^；。]*?(?:固定|保持|重新设计)/u, "固定")
                        .replace(/^[\p{Script=Han}]{1,8}家(?=(?:少年|少女|青年|男性|女性))/u, "")
                        .trim(),
                )
                .filter((item) => item && CHARACTER_VISUAL_FACT_PATTERN.test(item) && !CHARACTER_NARRATIVE_FACT_PATTERN.test(item)),
        ),
    ).join("；");
}

/** Extract only cross-view continuity facts; wardrobe and narrative facts stay out. */
export function extractDramaCharacterContinuityFacts(value: string) {
    return uniqueCharacterFacts(
        value
            .replace(DRAMA_CHARACTER_DEFAULT_CONSISTENCY, "")
            .split(/[；;。\n，,、]+/u)
            .map((item) =>
                item
                    .replace(/^(?:一致性锁定|固定规则|连续性规则)[：:]\s*/u, "")
                    .replace(/不随(?:镜头|剧情|故事)重设计/u, "不因视图重设计")
                    .replace(/(?:与|及|并且?|和)(?:服装|服饰|造型|材质|固定配饰|固有色|鞋靴|配色)[^；。]*/u, "")
                    .trim(),
            )
            .filter((item) => item && CHARACTER_CONTINUITY_FACT_PATTERN.test(item))
            .filter((item) => !CHARACTER_STYLING_FACT_PATTERN.test(item))
            .filter((item) => !CHARACTER_NARRATIVE_FACT_PATTERN.test(item))
            .filter((item) => !/^(?:少年|少女|儿童|青年|中年|老年|男性|女性|黑发|白发|灰发|棕发|金发|发色|发型|头发|发束|碎发|发丝|高束|束发|长发|短发|马尾|辫|刘海|发髻)/u.test(item)),
    ).join("；");
}

export function normalizeDramaCharacterProfile(profile: DramaAssetProfile | undefined, description: string, name: string): DramaAssetProfile {
    const current = profile || { visualIdentity: "", styling: "", colorPalette: "", consistencyRules: "" };
    const identityPrefix = `${name}的脸型、五官、发型和年龄感按当前角色设定固定`;
    const currentVisualIdentity = current.visualIdentity.trim();
    const currentIdentityFacts = normalizeCharacterIdentityAnchor(currentVisualIdentity, name);
    const rawVisualIdentity = currentIdentityFacts || extractDramaCharacterVisualFacts(description);
    const visualIdentity = rawVisualIdentity.startsWith(identityPrefix) ? rawVisualIdentity : [identityPrefix, rawVisualIdentity].filter(Boolean).join("；");
    const styling = normalizeCharacterStaticClauses(current.styling) || `${name}的发型、服装、固定配饰、鞋靴与材质按描述固定`;
    const colorPalette = normalizeCharacterColorPalette(current.colorPalette) || "按角色固有色保持跨镜头一致";
    const consistencyRules = appendUniqueClauses(extractDramaCharacterContinuityFacts(current.consistencyRules), DRAMA_CHARACTER_DEFAULT_CONSISTENCY);
    const identityAnchors = Array.from(new Set([...(current.identityAnchors || []).map((value) => normalizeCharacterIdentityAnchor(value, name)), visualIdentity].map((value) => value.trim()).filter(Boolean)));
    const forbiddenChanges = Array.from(new Set([...(current.forbiddenChanges || []), ...DRAMA_CHARACTER_NEGATIVE_RULES.split("、")].map((value) => value.trim()).filter(Boolean)));
    return { ...current, visualIdentity, styling, colorPalette, consistencyRules, identityAnchors, forbiddenChanges };
}

function normalizeCharacterStaticClauses(value: string) {
    if (!CHARACTER_NARRATIVE_FACT_PATTERN.test(value)) return value.trim();
    return appendUniqueClauses(
        value
            .split(/[；;。\n]+/u)
            .map((item) => item.trim())
            .filter((item) => item && !CHARACTER_NARRATIVE_FACT_PATTERN.test(item))
            .join("；"),
        "",
    );
}

function normalizeCharacterColorPalette(value: string) {
    if (value.trim() === DRAMA_CHARACTER_CURRENT_COLOR_RULE) return value.trim();
    if (!CHARACTER_NARRATIVE_FACT_PATTERN.test(value) && !/(?:光|灯|环境|背景|场景|大厅|建筑|空间)/u.test(value)) return value.trim();
    return value
        .split(/[；;。\n，,、]+/u)
        .map((item) => item.trim())
        .filter((item) => item && !CHARACTER_NARRATIVE_FACT_PATTERN.test(item) && !/(?:光|灯|环境|背景|场景|大厅|建筑|空间)/u.test(item))
        .join("、");
}

function normalizeCharacterIdentityAnchor(value: string, name: string) {
    const identityPrefix = `${name}的脸型、五官、发型和年龄感按当前角色设定固定`;
    const trimmed = value.trim();
    if (!trimmed.includes(`${name}的脸型`)) return extractDramaCharacterVisualFacts(trimmed);
    const facts = extractDramaCharacterVisualFacts(trimmed);
    const extraFacts = facts
        .split("；")
        .map((fact) => fact.trim())
        .filter((fact) => fact && fact !== `${name}的脸型` && fact !== "五官" && !fact.startsWith("发型和年龄感"));
    return [identityPrefix, ...extraFacts].filter(Boolean).join("；");
}

function appendUniqueClauses(current: string, addition: string) {
    const clauses = [current, addition].flatMap((value) =>
        value
            .split(/[；;]/u)
            .map((item) => item.trim())
            .filter(Boolean),
    );
    const order: string[] = [];
    const unique = new Map<string, string>();
    for (const clause of clauses) {
        const key = clause.replace(/[。.!！]+$/u, "");
        if (!unique.has(key)) order.push(key);
        unique.set(key, clause);
    }
    return order
        .map((key) => unique.get(key) || "")
        .filter(Boolean)
        .join("；");
}

function uniqueCharacterFacts(values: string[]) {
    const order: string[] = [];
    const unique = new Map<string, string>();
    for (const value of values.flatMap((item) => item.split(/[；;]+/u))) {
        const clause = value.trim();
        if (!clause) continue;
        const key = clause.replace(/\s+/gu, "").replace(/[。.!！]+$/u, "");
        if (!unique.has(key)) order.push(key);
        unique.set(key, clause);
    }
    return order.map((key) => unique.get(key) || "").filter(Boolean);
}
