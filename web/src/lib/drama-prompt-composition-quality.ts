import type { DramaReferenceManifestItem } from "@/lib/drama-project-contract";

export type DramaPromptQualityFrame = {
    startSecond?: number;
    endSecond?: number;
    startPrompt?: string;
    actionPrompt?: string;
    transitionPrompt?: string;
    endPrompt?: string;
    imagePrompt?: string;
};

export type DramaPromptCompositionInput = {
    ratio?: string;
    prompt: string;
    frames: readonly DramaPromptQualityFrame[];
    subjectNames?: readonly string[];
    requiredReactionNames?: readonly string[];
    requiresDetail?: boolean;
    label?: string;
};

export type DramaReferenceAliasInput = Pick<DramaReferenceManifestItem, "alias" | "role" | "purpose" | "assetId" | "frameEvidenceId">;

const VERTICAL_RATIO = /(?:^|[^\d])9\s*[:x/]\s*16(?:$|[^\d])/iu;
const HORIZONTAL_RATIO = /(?:^|[^\d])16\s*[:x/]\s*9(?:$|[^\d])/iu;
const CLOSE_SHOT = /特写|近景|中近景|眼神近景|手部近景|脸部近景/u;
const CLARITY_TERMS = /完整头顶|头顶完整|下巴(?:完整|入画)?|主要衣领|衣领(?:完整|入画)?|不裁脸|不遮脸|防遮脸|主体安全区|安全区|脸部清晰|五官清晰|完整入画/u;
const VISIBLE_SCOPE_TERMS = /左侧|右侧|中央|前景|中景|后景|入画|画面|上半身|肩线|手部|全景|中景|近景|特写|纵深|前中后|上下/u;
const SUBJECT_TERMS = /主体|主要人物|说话人|对白表演|台词|静态关键帧|双人|单人|过肩|手部|道具|场景|空间|座位|锚点|关系|人物|角色|人像/u;
const HORIZONTAL_PACKING = /横向并排|横向并列|左右并排|横排|横向塞入|三人横|多人横向|全员横向|并排塞入/u;
const VERTICAL_DEPTH = /纵向深度|上下纵深|前中后景|前中后分层|通道纵深|上下安全区|纵深关系|主体.*后方|前景.*中景.*后景/u;
const OCCLUSION = /(?:前景|门框|肩膀|肩线|人物|衣肩)[^。；;\n]{0,30}(?:穿过|挡住|遮住|遮挡|压住)[^。；;\n]{0,20}(?:脸|面部|五官)|(?:脸|面部|五官)[^。；;\n]{0,20}(?:被|遭到)(?:遮挡|挡住|裁掉)|遮脸|裁脸/u;
const REACTION_TERMS = /眉|眉心|眼睛|目光|视线|肩|下颌|嘴角|呼吸|吸气|僵|停住|看向|望向|回望|前倾|收紧|松开|沉默|反应/u;
const DETAIL_TERMS = /手部|掌根|掌心|指节|桌沿|接触|受力|道具|物件|器物|容器|武器|法器|信物|文字|证据|物证/u;
const EXPLICIT_SPEAKER = /[\p{L}·]{2,20}\s*说\s*[：:]/u;

export function validateDramaPromptComposition(input: DramaPromptCompositionInput) {
    const label = input.label || "镜头";
    const ratio = normalizeRatio(input.ratio);
    const frames = input.frames.length ? input.frames : [{ actionPrompt: input.prompt, imagePrompt: input.prompt }];
    const subjects = unique(input.subjectNames || []).filter((name) => name.trim().length >= 2);
    const errors: string[] = [];
    const allText = [input.prompt, ...frames.map(frameText)].join("\n");

    if (ratio === "9:16" && HORIZONTAL_RATIO.test(allText)) errors.push(`${label}项目画幅为9:16，但提示词混入横版16:9构图`);
    if (ratio === "16:9" && VERTICAL_RATIO.test(allText)) errors.push(`${label}项目画幅为16:9，但提示词混入竖版9:16构图`);

    for (const [index, frame] of frames.entries()) {
        const text = frameText(frame);
        const frameLabel = `${label}第 ${index + 1} 个时间段`;
        if (!hasSubject(text, subjects)) errors.push(`${frameLabel}未明确本段主要主体`);
        if (ratio && !VISIBLE_SCOPE_TERMS.test(text) && !SUBJECT_TERMS.test(text)) errors.push(`${frameLabel}未明确主体可见范围或空间层级`);
        if (CLOSE_SHOT.test(text) && !CLARITY_TERMS.test(text)) errors.push(`${frameLabel}为近景/特写但未声明完整头顶、下巴、主要衣领或防裁脸防遮挡安全区`);
        if (OCCLUSION.test(text)) errors.push(`${frameLabel}存在前景或门框遮脸、裁脸或主要人物被遮挡描述`);

        if (ratio === "9:16") {
            const visibleSubjects = subjects.filter((subject) => text.includes(subject));
            const broadGroup = visibleSubjects.length >= 3 || /三人|多人|全员|九人|群像/u.test(text);
            const wide = /全景|中全景|建立|空间全景|结果全景|恢复空间|空间尺度/u.test(text);
            if (HORIZONTAL_PACKING.test(text)) errors.push(`${frameLabel}把多人横向并排塞入9:16画面，必须改为单人/双人或上下纵深`);
            if (broadGroup && (!wide || !VERTICAL_DEPTH.test(text))) errors.push(`${frameLabel}在9:16中承载多人，但没有建立全景/结果全景与纵向前中后景关系`);
        }
    }

    const requiredReactions = unique(input.requiredReactionNames || []).filter((name) => name.trim());
    const reactionText = frames.map(frameText).join("\n");
    for (const subject of requiredReactions) {
        if (!new RegExp(`${escapeRegExp(subject)}[^\\n。；;]{0,36}${REACTION_TERMS.source}|${REACTION_TERMS.source}[^\\n。；;]{0,36}${escapeRegExp(subject)}`, "u").test(reactionText)) errors.push(`${label}未在时间段中写出 ${subject} 的独立可见反应`);
    }
    return unique(errors);
}

export function validateDramaCutInformationDiversity(input: DramaPromptCompositionInput) {
    const label = input.label || "镜头";
    const text = input.prompt;
    const events = [...text.matchAll(/镜头事件\s*[：:]\s*([^\n]+)/gu)].map((match) => match[1]);
    if (events.length < 2) return [];
    const targets = events.map((event) => classifyCutTargets(event, unique(input.subjectNames || [])));
    const errors: string[] = [];
    const nonEmpty = targets.filter((target) => target.size);
    if (nonEmpty.length !== events.length) errors.push(`${label}存在硬切事件未明确新的信息主体或动作细节`);
    const categories = new Set([...targets.flatMap((target) => [...target])]);
    if (categories.size < 2) errors.push(`${label}所有硬切都指向同一信息主体，必须在不同角色、关系、手部/道具、空间或结果信息之间形成可见差异`);
    const requiredReactions = unique(input.requiredReactionNames || []).filter((name) => name.trim());
    for (const subject of requiredReactions) {
        if (!targets.some((target) => target.has(`character:${subject}`))) errors.push(`${label}包含 ${subject} 的剧情反应，但没有对应的独立硬切主体`);
    }
    if (input.requiresDetail && !targets.some((target) => target.has("detail"))) errors.push(`${label}包含手部/道具/受力事实，但没有手部或道具细节硬切`);
    return unique(errors);
}

export function validateDramaReferenceAliasConsistency(input: { prompt: string; manifest?: readonly DramaReferenceAliasInput[]; references?: readonly { alias?: string; role?: string; purpose?: string }[]; label?: string }) {
    const label = input.label || "镜头";
    const entries = input.manifest?.length ? input.manifest : input.references || [];
    if (!entries.length) return [];
    const aliases = entries.map((entry, index) => entry.alias?.trim() || `@图片${index + 1}`);
    const errors: string[] = [];
    const duplicate = aliases.find((alias, index) => aliases.indexOf(alias) !== index);
    if (duplicate) errors.push(`${label}参考图 alias ${duplicate} 重复，不能映射到多个素材`);
    const binding = extractBindingSection(input.prompt);
    if (!binding) return [`${label}缺少素材绑定，无法确认参考图 alias 与职责`];
    const positions = aliases.map((alias) => binding.indexOf(alias));
    if (positions.some((position) => position < 0)) errors.push(`${label}素材绑定缺少参考图 ${aliases.filter((alias, index) => positions[index] < 0).join("、")}`);
    if (positions.some((position, index) => index > 0 && position <= positions[index - 1])) errors.push(`${label}公开提示词中的参考图 alias 顺序与 referenceManifest 不一致`);
    for (const [index, entry] of entries.entries()) {
        const alias = aliases[index];
        const line = binding.split(/\r?\n/u).find((value) => value.includes(alias)) || binding;
        const mapping = line
            .slice(line.indexOf(alias) + alias.length)
            .replace(/^[\s：:：()（）\[\]【】、,，-]+/u, "")
            .trim();
        if (!mapping || /^至|到|等|普通参考图|参考图$/u.test(mapping)) errors.push(`${label}${alias}没有逐项写明素材职责，不能只写“@图片1至@图片N”`);
        const role = String(entry.role || "");
        if (role === "character_anchor" && /场景|地点|建筑|环境|空间/u.test(`${entry.purpose || ""} ${mapping}`)) errors.push(`${label}${alias}声明为角色锚点却绑定了场景职责`);
        if (role === "scene_anchor" && /角色|人物|脸型|服装|发型/u.test(`${entry.purpose || ""} ${mapping}`)) errors.push(`${label}${alias}声明为场景锚点却绑定了角色职责`);
        if (role === "prop_anchor" && /角色|人物|脸型|发型/u.test(`${entry.purpose || ""} ${mapping}`)) errors.push(`${label}${alias}声明为道具锚点却绑定了角色职责`);
    }
    return unique(errors);
}

export function validateDramaCharacterWardrobeContinuity(input: {
    prompt: string;
    characters: readonly { id?: string; code?: string; name: string; profile?: { visualIdentity?: string; styling?: string; consistencyRules?: string } }[];
    characterCodes?: readonly string[];
    label?: string;
}) {
    const label = input.label || "镜头";
    const text = input.prompt;
    const errors: string[] = [];
    for (const code of input.characterCodes || []) {
        const character = input.characters.find((item) => (item.code || item.id) === code);
        if (!character?.profile) continue;
        const profileText = [character.profile.visualIdentity, character.profile.styling, character.profile.consistencyRules].filter(Boolean).join(" ");
        const hasAnchor = /衣|袍|服|装|发|头发|发型|耳坠|戒|配饰|年龄|脸型|轮廓|袖|饰/u.test(profileText) && /衣|袍|服|装|发|头发|发型|耳坠|戒|配饰|年龄|脸型|轮廓|袖|饰/u.test(text);
        if (!hasAnchor) errors.push(`${label}角色 ${character.name || code} 缺少服装、发型、年龄感或固定配饰连续性锚点`);
    }
    return errors;
}

export function inferDramaPromptSubjects(value: string, candidateNames: readonly string[] = []) {
    return unique(candidateNames).filter((name) => name.trim().length >= 2 && value.includes(name));
}

function frameText(frame: DramaPromptQualityFrame) {
    return [frame.startPrompt, frame.actionPrompt, frame.transitionPrompt, frame.endPrompt, frame.imagePrompt].filter(Boolean).join("\n");
}

function hasSubject(text: string, subjects: readonly string[]) {
    return SUBJECT_TERMS.test(text) || EXPLICIT_SPEAKER.test(text) || subjects.some((subject) => text.includes(subject)) || /主体|人物|角色|画面中心|前景肩|画外/u.test(text);
}

function classifyCutTargets(value: string, subjectNames: readonly string[]) {
    const targets = new Set<string>();
    for (const subject of subjectNames) if (value.includes(subject)) targets.add(`character:${subject}`);
    if (!subjectNames.length && /主体|主要人物|说话人|角色|人物|人像/u.test(value)) targets.add("character");
    if (/双人|双方|过肩|关系|对峙/u.test(value)) targets.add("relationship");
    if (DETAIL_TERMS.test(value)) targets.add("detail");
    if (/建立|全景|中全景|群像|空间结果|恢复空间|空间轴线|尺度关系/u.test(value)) targets.add("space");
    return targets;
}

function extractBindingSection(prompt: string) {
    const heading = prompt.match(/【素材绑定】([\s\S]*?)(?=【[^】]+】|$)/u);
    if (heading) return heading[1].trim();
    const line = prompt.match(/(?:^|\n)\s*素材绑定\s*[：:]([\s\S]*?)(?=\n\s*(?:动态意图|全局设定|起始可见状态|时间段动作|单一主运镜|环境压力|视觉风格|声音意图|结束画面|连续性锁|针对性约束)\s*[：:]|$)/u);
    return line?.[1]?.trim() || "";
}

function normalizeRatio(value: string | undefined) {
    const text = String(value || "").replace(/[×x]/gu, ":");
    if (/9\s*:\s*16/u.test(text)) return "9:16";
    if (/16\s*:\s*9/u.test(text)) return "16:9";
    return "";
}

function unique(values: readonly string[]) {
    return [...new Set(values.filter(Boolean))];
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
