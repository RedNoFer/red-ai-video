import type { DramaDialoguePerformance, DramaPerformancePlan } from "@/lib/drama-project-contract";
import { hasQuotedDramaDialogue, type DramaDialogueTimingInput } from "@/lib/drama-dialogue-timing";

const GENERIC_DETAIL_PATTERNS = [
    /^表情(?:自然|丰富|到位|稳定)$/u,
    /^情绪(?:自然|丰富|到位|稳定|逐步变化)$/u,
    /^(?:动作|反应|状态|表演)(?:自然|丰富|到位|稳定|合理|清晰)$/u,
    /^根据(?:动作|情绪|剧情|现场)(?:变化|推进|发展)$/u,
    /^适当(?:变化|调整|反应)$/u,
    /^保持(?:稳定|自然|一致|原状|当前状态)$/u,
    /^沿当前(?:动作|镜头|叙事)方向$/u,
    /^完成主要动作(?:并保留反应停顿)?$/u,
    /^指向下一动作或转场方向$/u,
    /^说话时保持与行动一致的面部反应$/u,
    /^先以视线和眉眼确认对方或关键道具$/u,
    /^说完保留短暂反应，衔接下一动作$/u,
    /^推动当前镜头行动并回应对手或环境$/u,
];
const WEAK_VIDEO_DETAIL_PATTERNS = [/^保持本镜可见反应$/u, /^保持可读的具体反应$/u, /(?:眉眼|表情|呼吸).*(?:随|根据).*(?:变化|推进|触发).*(?:可见变化)/u, /^(?:准备回应|承受(?:压力)?|情绪(?:逐步)?加剧|保持状态|自然反应)$/u];
const CONCRETE_CAMERA_PATTERN = /固定机位|锁定机位|推(?:进|近|镜)|拉(?:远|镜)|摇镜|横移|跟拍|滑轨|环绕|吊臂|升降|手持|变焦|俯拍|仰拍|平视|低机位|高机位|中景|近景|特写|远景/u;
const OBSERVABLE_DRAMA_DETAIL_PATTERN = /眉|眼|目光|视线|嘴角|下颌|呼吸|肩|背|身体|重心|手|指|掌|站|坐|抬|低|转|握|松|触|器物|容器|纸张|文字|纸|桌|案|地面|水面|光线|影子|门|墙|尘|衣袍|NPC|背景角色|配角|旁观者|人群|开口|说|重音|停顿|语速|语气/u;
const NPC_SEGMENT_PATTERN = /NPC群像\s*[：:]\s*(\d+)\s*名\s*[；;]\s*分布\s*[：:]\s*前景\s*(\d+)\s*名\s*[、,，]\s*中景\s*(\d+)\s*名\s*[、,，]\s*后景\s*(\d+)\s*名\s*[；;]\s*密度\s*[：:]\s*([^；;\n]+)\s*[；;]\s*反应\s*[：:]\s*([^\n]+)/u;
const NPC_SLOT_SEGMENT_PATTERN = /NPC(?:连续性|槽位|群像槽位)\s*[：:]\s*可见槽位\s*[：:]\s*([^；;\n]+)\s*[；;]\s*(?:世界锚点|空间锚点|锚点)\s*[：:]\s*([^；;\n]+)\s*[；;]\s*(?:状态变化|可见反应|反应)\s*[：:]\s*([^\n]+)/u;
const OBSERVABLE_NPC_REACTION_PATTERN = /抬眼|抬头|低头|收声|屏息|静默|看向|望向|交换眼神|后退|退开|分列|让出|肩背|僵住|停住|避开|回望|垂下|侧身/u;
const DIALOGUE_SEGMENT_MARKER = /对白表演\s*[：:]/u;
const CAMERA_CUT_EVENT_PATTERN = /镜头事件\s*[：:]/u;
const ACTIVE_CAMERA_CUT_PATTERN = /硬切|镜头切换|Camera\s+cut\s+to|Cut\s+to/iu;
const VIDEO_CARD_HEADER = /^###\s*镜头\s*(\d+)\s*\|([^\n]+)$/gmu;
const VIDEO_CARD_FIELDS = ["场景", "画面内容", "光影", "色调", "台词", "人声", "音效"] as const;
const VIDEO_CARD_CAMERA_TERMS = /平视|俯视|俯拍|仰视|仰拍|正面|侧面|侧[0-9一二三四五六七八九十]+度|过肩|入口侧|低机位|高机位|顶视|跟随视线/u;
const VIDEO_CARD_LENS_TERMS = /\d+(?:\.\d+)?\s*mm|广角|标准焦段|长焦|变形宽银幕/u;
const DIRECT_DIALOGUE_IN_VISUAL_PATTERN = /(?:对白表演|(?:画外|内心声)?[^；：\n]{0,20}(?:说|道|问|喊|答|继续说|声音落下)\s*[：:]\s*[“"][^”\n]+[”"]|[“"][^”"\n]{2,}[”"])/u;
const CAUSAL_TRIGGER_PATTERN = /因|因为|由于|听见|看见|发现|面对|遭到|受到|被|在[^。；\n]{0,20}后|话音|声音|风声|对白|说完|回应|接住|触到|压住|握住|拦住|撞上|落下|逼近|传来|为了|当[^。；\n]{0,20}时|承接/u;
const SOUND_ANCHOR_PATTERN = /音效|人声|呼吸|吸气|吐气|喘息|衣料|脚步|碰撞|摩擦|风声|水声|门响|木石|混响|静默|沉默|屏息|余响|底噪|无声/u;
/** @deprecated Legacy export retained for compatibility only; it is not a production gate. */
export const DRAMA_VIDEO_PROMPT_TEMPLATE_SECTIONS = ["重要剪辑指令", "素材绑定", "故事意图", "空间与连续性", "灯光与画面", "摄影总则", "逐镜头时间线", "硬性禁止"] as const;

export type DramaCameraPlanFrame = Pick<{ startSecond: number; endSecond: number }, "startSecond" | "endSecond">;

export type DramaVideoPromptCard = {
    index: number;
    timeRange: string;
    shotSize: string;
    lens: string;
    cameraAngle: string;
    cameraMotion: string;
    subjectMode: string;
    scene: string;
    visual: string;
    lighting: string;
    color: string;
    dialogue: string;
    voice: string;
    sound: string;
    raw: string;
};

export function isGenericDramaDetail(value: unknown) {
    const text = typeof value === "string" ? value.trim() : "";
    return !text || GENERIC_DETAIL_PATTERNS.some((pattern) => pattern.test(text));
}

export function validateDramaPerformanceDetail(plan: DramaPerformancePlan | undefined, dialogue: DramaDialoguePerformance[] | undefined, dialogueCount = 0, label = "镜头") {
    const errors: string[] = [];
    if (!plan) return [`${label}缺少表演计划`];
    const scalarFields: Array<[string, string | undefined]> = [
        ["情绪目标", plan.emotionalObjective],
        ["情绪递进", plan.emotionalArc],
        ["说话方式", plan.speechStyle],
        ["节奏", plan.pace],
        ["呼吸", plan.breath],
        ["克制度", plan.restraintLevel],
    ];
    for (const [name, value] of scalarFields) if (isGenericDramaDetail(value)) errors.push(`${label}${name}过于笼统`);
    for (const [name, beat] of [
        ["起始", plan.beats.start],
        ["中段", plan.beats.middle],
        ["结束", plan.beats.end],
    ] as const) {
        for (const [field, value] of [
            ["情绪", beat.emotion],
            ["面部动作", beat.facialAction],
            ["视线", beat.gaze],
            ["身体/手部动作", beat.bodyAction],
        ] as const)
            if (isGenericDramaDetail(value)) errors.push(`${label}${name}${field}缺少具体可见结果`);
    }
    if (dialogueCount > 0 && (!dialogue || dialogue.length < dialogueCount)) errors.push(`${label}对白缺少逐句表演指导`);
    for (const [index, item] of (dialogue || []).entries()) {
        const fields: Array<[string, string | undefined]> = [
            ["意图", item.intent],
            ["语气", item.tone],
            ["节奏", item.pace],
            ["停顿", item.pause],
            ["重音", item.emphasis],
            ["说前反应", item.facialReactionBefore],
            ["说中反应", item.facialReactionDuring],
            ["说后反应", item.facialReactionAfter],
        ];
        for (const [name, value] of fields) if (isGenericDramaDetail(value)) errors.push(`${label}第${index + 1}句${name}缺少具体表演结果`);
    }
    return errors;
}

export function validateDramaFrameDetail(value: unknown, label: string) {
    return isGenericDramaDetail(value) ? `${label}缺少具体可见动作或状态` : "";
}

export function validateDramaVideoPromptTemplateLayout(value: unknown, frameCount: number, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    const positions = DRAMA_VIDEO_PROMPT_TEMPLATE_SECTIONS.map((section) => ({ section, position: text.search(new RegExp(`(?:^|\\n)\\s*【${escapeRegExp(section)}】(?:\\s*\\n|\\s*$)`, "u")) }));
    const errors = positions.filter(({ position }) => position < 0).map(({ section }) => `缺少“【${section}】”段落`);
    const presentPositions = positions.filter(({ position }) => position >= 0).map(({ position }) => position);
    if (presentPositions.some((position, index) => index > 0 && position <= presentPositions[index - 1])) errors.push("八段标题顺序必须为“重要剪辑指令→素材绑定→故事意图→空间与连续性→灯光与画面→摄影总则→逐镜头时间线→硬性禁止”");
    const timeline = text.match(/【逐镜头时间线】([\s\S]*?)(?:\n\s*【硬性禁止】|$)/u)?.[1] || "";
    const shotMarkers = [...timeline.matchAll(/(?:^|\n)\s*镜头\s*\d+\s*[，,：:]/gu)];
    if (frameCount > 0 && shotMarkers.length !== frameCount) errors.push(`“【逐镜头时间线】”写出 ${shotMarkers.length} 个镜头段，必须与 ${frameCount} 个 framePlan 时间段一一对应`);
    for (const [index, marker] of shotMarkers.entries()) {
        const start = marker.index ?? 0;
        const end = shotMarkers[index + 1]?.index ?? timeline.length;
        const segment = timeline.slice(start, end);
        const missing = ["起点", "动作与触发", "可见衔接", "终点"].filter((field) => !new RegExp(`(?:^|\\n|[，,；;\\s])\\s*${field}\\s*[：:]`, "u").test(segment));
        if (missing.length) errors.push(`逐镜头时间线第 ${index + 1} 段缺少${missing.join("、")}`);
    }
    return errors.map((error) => `${label}${error}`);
}

export function extractDramaVideoPromptCards(value: unknown): DramaVideoPromptCard[] {
    const text = typeof value === "string" ? value.trim() : "";
    const markers = [...text.matchAll(VIDEO_CARD_HEADER)];
    return markers.map((marker, index) => {
        const start = marker.index ?? 0;
        const end = markers[index + 1]?.index ?? text.length;
        const raw = text.slice(start, end).trim();
        const columns = marker[2].split("|").map((item) => item.trim());
        const field = (name: string) => extractVideoCardField(raw, name);
        return {
            index: Number(marker[1]),
            timeRange: columns[0] || "",
            shotSize: columns[1] || "",
            lens: columns[2] || "",
            cameraAngle: columns[3] || "",
            cameraMotion: columns[4] || "",
            subjectMode: columns[5] || "",
            scene: field("场景"),
            visual: field("画面内容"),
            lighting: field("光影"),
            color: field("色调"),
            dialogue: field("台词"),
            voice: field("人声"),
            sound: field("音效"),
            raw,
        };
    });
}

export function validateDramaVideoPromptCardLayout(value: unknown, frames: ReadonlyArray<DramaCameraPlanFrame> | number, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    const expectedFrames = typeof frames === "number" ? [] : frames;
    const frameCount = typeof frames === "number" ? frames : frames.length;
    const cards = extractDramaVideoPromptCards(text);
    const errors: string[] = [];
    if (!cards.length) errors.push("缺少小墨式“### 镜头”公开镜头卡");
    if (frameCount > 0 && cards.length !== frameCount) errors.push(`公开镜头卡写出 ${cards.length} 个镜头，必须与 ${frameCount} 个 framePlan 时间段一一对应`);
    for (const [index, card] of cards.entries()) {
        const cardLabel = `第 ${index + 1} 个镜头卡`;
        if (!card.timeRange || !/\d+(?:\.\d+)?\s*(?:-|至|到|—|–|~)\s*\d+(?:\.\d+)?\s*(?:s|秒)/iu.test(card.timeRange)) errors.push(`${label}${cardLabel}缺少真实时间范围`);
        if (!card.shotSize || /待定|未知|镜头/u.test(card.shotSize)) errors.push(`${label}${cardLabel}缺少可识别景别`);
        if (!card.lens || !VIDEO_CARD_LENS_TERMS.test(card.lens)) errors.push(`${label}${cardLabel}缺少可识别焦段`);
        if (!card.cameraAngle || !VIDEO_CARD_CAMERA_TERMS.test(card.cameraAngle)) errors.push(`${label}${cardLabel}缺少可识别机位角度`);
        if (!card.cameraMotion || !hasConcreteDramaCameraDirection(card.cameraMotion)) errors.push(`${label}${cardLabel}缺少具体主运镜`);
        if (!card.subjectMode || !/人物|非人物|主体|道具|空间|手部|双人|单人/u.test(card.subjectMode)) errors.push(`${label}${cardLabel}缺少人物镜头/非人物镜头主体标识`);
        for (const field of VIDEO_CARD_FIELDS) if (!extractVideoCardField(card.raw, field)) errors.push(`${label}${cardLabel}缺少“${field}”字段`);
        if (!card.scene || !card.visual || isGenericDramaDetail(card.visual)) errors.push(`${label}${cardLabel}的画面内容必须写出可见进行中动作，不能使用空泛占位词`);
        if (DIRECT_DIALOGUE_IN_VISUAL_PATTERN.test(card.visual)) errors.push(`${label}${cardLabel}的画面内容不得包含完整对白或说话人台词指令；只写可见口型、呼吸和表演，完整台词只能放在“台词”字段`);
        if (card.dialogue && card.dialogue !== "无" && !hasQuotedDramaDialogue(card.dialogue)) errors.push(`${label}${cardLabel}的台词必须使用“说话人说：“实际台词””格式`);
        if (expectedFrames[index] && !dramaTimeRangePattern(expectedFrames[index].startSecond, expectedFrames[index].endSecond).test(card.timeRange))
            errors.push(`${label}${cardLabel}的时间范围未对应 framePlan 的 ${expectedFrames[index].startSecond}-${expectedFrames[index].endSecond}s`);
    }
    return errors.map((error) => (error.startsWith(label) ? error : `${label}${error}`));
}

/**
 * A frame plan with timed speech must expose the speech boundaries as visual
 * edit points. Mechanical equal-duration frames are only acceptable when
 * they happen to land on every timed utterance boundary.
 */
export function validateDramaFrameTiming(frames: ReadonlyArray<DramaCameraPlanFrame>, utterances: readonly DramaDialogueTimingInput[], label: string) {
    if (frames.length < 2) return [];
    const timedUtterances = utterances.filter((item) => {
        const type = item.type || "dialogue";
        return (type === "dialogue" || type === "voiceover") && Number.isFinite(item.startSecond) && Number.isFinite(item.endSecond) && Number(item.endSecond) > Number(item.startSecond);
    });
    if (!timedUtterances.length) return [];
    const boundaries = new Set(frames.flatMap((frame) => [Number(frame.startSecond), Number(frame.endSecond)]).map((value) => value.toFixed(2)));
    const unaligned = timedUtterances.some((item) => !boundaries.has(Number(item.startSecond).toFixed(2)) || !boundaries.has(Number(item.endSecond).toFixed(2)));
    return unaligned ? [`${label}含有带自然时间边界的对白/旁白，但至少一个开口或收句边界落在帧段内部；必须按对白自然时长、停顿、动作触发和反应留白重新分配帧段，不能把对白切在段内`] : [];
}

/** Every executable frame must expose a causal beat, not just an action noun. */
export function validateDramaFrameCausalChain(actionPrompt: unknown, transitionPrompt: unknown, endPrompt: unknown, label: string) {
    const action = typeof actionPrompt === "string" ? actionPrompt.trim() : "";
    const transition = typeof transitionPrompt === "string" ? transitionPrompt.trim() : "";
    const end = typeof endPrompt === "string" ? endPrompt.trim() : "";
    const all = `${action}\n${transition}\n${end}`;
    const errors: string[] = [];
    if (!CAUSAL_TRIGGER_PATTERN.test(all)) errors.push(`${label}缺少“因为什么/承接什么而动作触发”的明确原因`);
    if (!SOUND_ANCHOR_PATTERN.test(all)) errors.push(`${label}缺少声音锚点；即使是静默也必须写明静默、屏息、底噪或余响`);
    if (!end || !OBSERVABLE_DRAMA_DETAIL_PATTERN.test(end) || !/(?:停|落|变|露|显|抬|垂|松|收|移|转|对准|接住|形成|沉默|静默|屏息|受力|改变|看见)/u.test(end)) errors.push(`${label}终点没有写出由本段动作产生的具体可见结果`);
    return errors;
}

function extractVideoCardField(value: string, field: string) {
    const fieldPattern = VIDEO_CARD_FIELDS.map(escapeRegExp).join("|");
    return value.match(new RegExp(`(?:^|\\n)\\s*${escapeRegExp(field)}\\s*[：:]\\s*([\\s\\S]*?)(?=\\n\\s*(?:${fieldPattern})\\s*[：:]|$)`, "u"))?.[1]?.trim() || "";
}

export function extractDramaVideoPromptSection(value: string, section: string) {
    const heading = new RegExp(`(?:^|\\n)\\s*【${escapeRegExp(section)}】(?:\\s*\\n|\\s*$)`, "u").exec(value);
    if (!heading) return "";
    const start = (heading.index ?? 0) + heading[0].length;
    const nextHeading = /\n\s*【[^】]+】(?:\s*\n|\s*$)/u.exec(value.slice(start));
    return value.slice(start, nextHeading ? start + (nextHeading.index ?? 0) : value.length).trim();
}

export function dramaTimeRangePattern(startSecond: number, endSecond: number) {
    const numberPattern = (value: number) => {
        const [integer, fraction] = String(value).split(".");
        return fraction ? "0*" + integer + "\\." + fraction + "0*" : "0*" + integer + "(?:\\.0+)?";
    };
    return new RegExp(numberPattern(startSecond) + "\\s*(?:-|至|到|—|–|~)\\s*" + numberPattern(endSecond) + "\\s*(?:s|秒)", "iu");
}

export function validateDramaVideoSegmentDetail(
    actionPrompt: unknown,
    transitionPrompt: unknown,
    endPrompt: unknown,
    label: string,
    options: { requiresBackgroundNpc?: boolean; backgroundNpcCountRange?: { min: number; max: number }; requiresDialoguePerformance?: boolean } = {},
) {
    const action = typeof actionPrompt === "string" ? actionPrompt.trim() : "";
    const transition = typeof transitionPrompt === "string" ? transitionPrompt.trim() : "";
    const end = typeof endPrompt === "string" ? endPrompt.trim() : "";
    const errors: string[] = [];
    if (isGenericDramaDetail(action) || WEAK_VIDEO_DETAIL_PATTERNS.some((pattern) => pattern.test(action)) || !OBSERVABLE_DRAMA_DETAIL_PATTERN.test(action)) errors.push(`${label}动作与触发缺少具体可见的表情、视线、呼吸、身体、手部、道具或环境变化`);
    if (isGenericDramaDetail(end) || WEAK_VIDEO_DETAIL_PATTERNS.some((pattern) => pattern.test(end)) || !OBSERVABLE_DRAMA_DETAIL_PATTERN.test(`${end}${transition}`)) errors.push(`${label}终点缺少具体可验收的人物、道具或环境结果`);
    if (options.requiresBackgroundNpc) errors.push(...validateDramaNpcSegmentDetail(`${action}\n${transition}\n${end}`, label, options.backgroundNpcCountRange));
    if (options.requiresDialoguePerformance) errors.push(...validateDramaDialogueSegmentDetail(`${action}\n${transition}\n${end}`, label));
    return errors;
}

export function validateDramaNpcSegmentDetail(value: unknown, label: string, countRange?: { min: number; max: number }) {
    const text = typeof value === "string" ? value : "";
    const match = text.match(NPC_SEGMENT_PATTERN);
    if (!match) {
        const slotMatch = text.match(NPC_SLOT_SEGMENT_PATTERN);
        if (!slotMatch) return [`${label}要求背景 NPC，但必须写出“NPC群像：人数/分布/密度/反应”或“NPC连续性：可见槽位/世界锚点/状态变化”`];
        const visibleSlots = slotMatch[1]
            .split(/[、,，\s]+/u)
            .map((slot) => slot.trim())
            .filter(Boolean);
        const anchors = slotMatch[2].trim();
        const reaction = slotMatch[3].trim();
        const errors: string[] = [];
        if (!visibleSlots.length) errors.push(`${label}背景 NPC 的可见槽位不能为空`);
        if (!anchors) errors.push(`${label}背景 NPC 缺少稳定世界空间锚点`);
        if (!reaction || !OBSERVABLE_NPC_REACTION_PATTERN.test(reaction)) errors.push(`${label}背景 NPC 缺少具体密度或可见反应`);
        return errors;
    }
    const count = Number(match[1]);
    const distribution = [Number(match[2]), Number(match[3]), Number(match[4])];
    const errors: string[] = [];
    if (distribution.some((value) => !Number.isInteger(value) || value < 0) || distribution.reduce((sum, value) => sum + value, 0) !== count) errors.push(`${label}背景 NPC 的人数与前中后景分布不一致`);
    if (countRange && (count < countRange.min || count > countRange.max)) errors.push(`${label}背景 NPC 人数 ${count} 不在场景允许范围 ${countRange.min}-${countRange.max} 内`);
    if (!match[5].trim() || !OBSERVABLE_NPC_REACTION_PATTERN.test(match[6])) errors.push(`${label}背景 NPC 缺少具体密度或可见反应`);
    return errors;
}

export function validateDramaDialogueSegmentDetail(value: unknown, label: string) {
    const text = typeof value === "string" ? value : "";
    if (!DIALOGUE_SEGMENT_MARKER.test(text) && !hasQuotedDramaDialogue(text)) return [`${label}含对白但缺少“对白表演”或带引号的实际台词`];
    const missing = ["说话人", "语气", "停顿", "重音", "说后反应"].filter((field) => (field === "说话人" ? !new RegExp(`${field}\\s*[：:]`, "u").test(text) && !hasQuotedDramaDialogue(text) : !new RegExp(`${field}\\s*[：:]`, "u").test(text)));
    const errors = missing.length ? [`${label}对白表演缺少${missing.join("、")}`] : [];
    if (!hasQuotedDramaDialogue(text)) errors.push(`${label}对白必须写成“说话人说：“实际台词””格式，不能只写说话人或把台词塞进重音字段`);
    return errors;
}

export function hasConcreteDramaCameraDirection(value: unknown) {
    return typeof value === "string" && CONCRETE_CAMERA_PATTERN.test(value.trim());
}

export function validateDramaCameraPlan(prompt: string, frames: ReadonlyArray<DramaCameraPlanFrame>) {
    const cards = extractDramaVideoPromptCards(prompt);
    if (cards.length) {
        const cardErrors = validateDramaVideoPromptCardLayout(prompt, frames, "视频提示词");
        return cardErrors.length ? cardErrors[0] : "";
    }
    const cameraLine = prompt.match(/(?:^|\n)\s*单一主运镜\s*[：:]([^\n]+)/u)?.[1]?.trim() || "";
    const cameraSource = cameraLine || extractDramaVideoPromptSection(prompt, "摄影总则");
    const modeMatch = cameraSource.match(/镜头模式\s*[=:：]\s*(连续镜头|内部切镜)(?:\s*[（(]\s*(\d+)\s*次\s*[）)])?/u);
    const lines = prompt.split(/\r?\n/u);
    const eventLines = lines.filter((line) => CAMERA_CUT_EVENT_PATTERN.test(line));
    const activeCutLines = lines.filter((line) => ACTIVE_CAMERA_CUT_PATTERN.test(line) && !/(?:无|不得|禁止|不发生|不含)\s*(?:内部)?(?:硬切|镜头切换|Cut\s+to|Camera\s+cut)/iu.test(line));
    if (!modeMatch) {
        if (!eventLines.length) return "缺少镜头模式声明，必须明确写“连续镜头”或“内部切镜（N次）”，或在逐镜头时间线中提供完整镜头事件";
        return validateCameraCutEvents(eventLines, activeCutLines, frames, eventLines.length);
    }
    if (modeMatch[1] === "连续镜头") {
        if (eventLines.length || activeCutLines.length) return "已声明连续镜头，却又写入内部切镜事件";
        return "";
    }

    const declaredCount = Number(modeMatch[2]);
    if (!Number.isInteger(declaredCount) || declaredCount < 1) return "内部切镜必须声明正整数切镜次数";
    return validateCameraCutEvents(eventLines, activeCutLines, frames, declaredCount);
}

function validateCameraCutEvents(eventLines: string[], activeCutLines: string[], frames: ReadonlyArray<DramaCameraPlanFrame>, declaredCount: number) {
    if (eventLines.length !== declaredCount) return "内部切镜声明为 " + declaredCount + " 次，但实际只有 " + eventLines.length + " 条镜头事件";
    if (activeCutLines.length > eventLines.length) return "存在未按镜头事件格式声明的切镜，请补齐时间、触发事件、新机位、信息目的和承接";

    const frameBoundaries = new Set(frames.slice(1).map((frame) => Number(frame.startSecond).toFixed(2)));
    for (const [index, line] of eventLines.entries()) {
        const timeMatch = line.match(/镜头事件\s*[：:]\s*(\d+(?:\.\d+)?)\s*(?:秒|s)(?=$|[^0-9A-Za-z])/iu);
        if (!timeMatch) return "第 " + (index + 1) + " 条镜头事件缺少明确发生时间";
        const time = Number(timeMatch[1]);
        if (!frameBoundaries.has(time.toFixed(2))) return "镜头事件 " + time + " 秒不在 framePlan 的段起点边界上，不能在段内任意切镜";
        const missing = (
            [
                ["触发事件", /触发事件\s*[：:][^；;\n]+/u],
                ["新机位", /新机位\s*[：:][^；;\n]+/u],
                ["切后主运镜", /切后主运镜\s*[：:][^；;\n]+/u],
                ["信息目的", /(?:信息目的|目的)\s*[：:][^；;\n]+/u],
                ["承接", /承接\s*[：:][^；;\n]+/u],
            ] as const
        )
            .filter(([, pattern]) => !pattern.test(line))
            .map(([name]) => name);
        if (missing.length) return "镜头事件 " + time + " 秒缺少" + missing.join("、");
    }
    return "";
}

type DramaVideoAuthoringFrame = {
    startSecond: number;
    endSecond: number;
    actionPrompt: string;
    transitionPrompt?: string;
    endPrompt?: string;
};

/**
 * Strict authoring checks for Agent-produced packages. These checks intentionally
 * reject mechanically repeated performance blocks while leaving imported/manual
 * packages on the compatibility path.
 */
export function validateDramaVideoAuthoringQuality(prompt: string, frames: ReadonlyArray<DramaVideoAuthoringFrame>, performancePlan: DramaPerformancePlan | undefined, label = "镜头", options: { requiresBackgroundNpc?: boolean } = {}) {
    const errors: string[] = [];
    const cards = extractDramaVideoPromptCards(prompt);
    const cameraLine = prompt.match(/(?:^|\n)\s*单一主运镜\s*[：:]([^\n]+)/u)?.[1]?.trim() || extractDramaVideoPromptSection(prompt, "摄影总则");
    const purpose = cameraLine.match(/(?:服务于|响应|为了|用于|让观众看见|强调)\s*([^；;\n]+)/u)?.[1]?.trim() || "";
    if (cards.length) {
        if (cards.length !== frames.length) errors.push(`${label}公开视频镜头卡数量必须与 framePlan 一致`);
        if (cards.some((card) => !hasConcreteDramaCameraDirection(card.cameraMotion))) errors.push(`${label}每个镜头卡都必须有具体主运镜`);
    } else if (!purpose || !OBSERVABLE_DRAMA_DETAIL_PATTERN.test(purpose) || /当前(?:信息|动作|变化)|动作变化|情绪变化|剧情推进|氛围|节奏/u.test(purpose)) {
        errors.push(`${label}的主运镜缺少具体动机，必须说明它响应的可见动作、信息、表情、视线、道具或环境变化`);
    }

    const actionSignatures = frames.map((frame) => normalizeAuthoringSignature(frame.actionPrompt));
    for (let index = 1; index < actionSignatures.length; index += 1) {
        if (actionSignatures[index] && actionSignatures[index] === actionSignatures[index - 1]) errors.push(`${label}第 ${index + 1} 个时间段与上一段动作完全重复，必须产生新的可见动作或结果`);
    }
    if (frames.length > 1 && new Set(actionSignatures.filter(Boolean)).size < 2) errors.push(`${label}缺少可辨识的动作差异，不能把同一动作块复制到所有时间段`);

    if (performancePlan) {
        const beats = [performancePlan.beats.start, performancePlan.beats.middle, performancePlan.beats.end].map((beat) => normalizeAuthoringSignature([beat.emotion, beat.facialAction, beat.gaze, beat.bodyAction].join("；")));
        if (new Set(beats).size < 3) errors.push(`${label}缺少起始→中段→结束的情绪递进，三个表演阶段必须有不同的可见表情、视线、呼吸、身体或手部结果`);
    }

    if (options.requiresBackgroundNpc) {
        const reactions = frames.map((frame) => extractNpcReaction(`${frame.actionPrompt}\n${frame.transitionPrompt || ""}\n${frame.endPrompt || ""}`));
        if (reactions.some((reaction) => !reaction)) errors.push(`${label}背景 NPC 反应缺失，必须在每个受事件影响的时间段写出具体群像反应`);
        if (new Set(reactions.filter(Boolean)).size < Math.min(2, frames.length)) errors.push(`${label}背景 NPC 反应没有变化，至少要有一次由主事件触发的可见群体反应变化`);
    }
    return errors;
}

function normalizeAuthoringSignature(value: string | undefined) {
    return (value || "")
        .replace(NPC_SEGMENT_PATTERN, "")
        .replace(/对白表演\s*[：:][^\n]*/gu, "")
        .replace(/[，。；：、,.;:!?！？\s]+/gu, "")
        .trim();
}

function extractNpcReaction(value: string) {
    const legacy = value.match(NPC_SEGMENT_PATTERN)?.[6]?.trim();
    if (legacy) return legacy;
    return value.match(NPC_SLOT_SEGMENT_PATTERN)?.[3]?.trim() || "";
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
