import { nanoid } from "nanoid";

import type { DramaFrameBeat, DramaStoryboardFrame } from "./drama-project-contract";

export const MAX_FRAME_BEATS = 9;
const TIME_EPSILON = 0.001;
const STATIC_FRAME_PROMPT_LABELS = ["静态关键帧", "可见状态", "可见表演状态", "景别", "机位与构图", "站位与视线", "三层空间", "光色与风格", "负面约束"] as const;
const VIDEO_PROMPT_LABELS = [
    "素材绑定",
    "动态意图",
    "全局设定",
    "起始可见状态",
    "触发",
    "主体动作与反应",
    "时间段动作",
    "阶段节拍",
    "单一主运镜",
    "主运镜",
    "环境压力与视觉母题",
    "环境压力与声音",
    "视觉风格与光色",
    "声音意图",
    "声音母题",
    "结束画面",
    "连续性锁",
    "针对性约束",
    "约束",
    "参考图职责",
] as const;

/** Normalize known prompt fields to one line per field without rewriting field content. */
export function formatPromptFieldLines(value: string, kind: "static" | "video" = "static") {
    const labels = kind === "video" ? VIDEO_PROMPT_LABELS : STATIC_FRAME_PROMPT_LABELS;
    const pattern = labels.join("|");
    const normalized = kind === "static" ? stripLegacyStaticReferenceRole(value) : value;
    return normalized
        .trim()
        .replace(new RegExp(`[\\s,，;；。]+(?=(?:${pattern})[：:])`, "gu"), "\n")
        .replace(/[ \t]*\n[ \t]*/gu, "\n")
        .trim();
}

/** Reference roles belong to referenceManifest, never to a static image prompt. */
export function stripLegacyStaticReferenceRole(value: string) {
    return value.replace(
        /(?:^|[,，；;\n])\s*参考图职责[：:][\s\S]*?(?=(?:[,，；;\n]\s*(?:静态关键帧|可见状态|可见表演状态|景别|机位与构图|站位与视线|三层空间|光色与风格|负面约束)[：:]|$))/gu,
        "",
    );
}

export function normalizeDramaFrameBeats(value: readonly DramaFrameBeat[], duration: number): DramaFrameBeat[] {
    if (!value.length) throw new Error("逐帧计划至少需要 1 帧");
    if (value.length > MAX_FRAME_BEATS) throw new Error("逐帧计划最多 9 帧");
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(duration)) throw new Error("镜头时长必须为正整数秒");
    const frames = value.map((frame, index) => ({
        id: frame.id.trim() || `frame-${nanoid()}`,
        sequenceIndex: index + 1,
        startSecond: number(frame.startSecond),
        endSecond: number(frame.endSecond),
        actionPrompt: frame.actionPrompt.trim(),
        imagePrompt: frame.imagePrompt.trim(),
        ...(frame.supplierPrompt?.trim() ? { supplierPrompt: frame.supplierPrompt.trim() } : {}),
    }));
    if (frames.some((frame) => !frame.actionPrompt || !frame.imagePrompt)) throw new Error("每帧必须填写动作提示词和画面提示词");
    if (Math.abs(frames[0].startSecond) > TIME_EPSILON || Math.abs(frames.at(-1)!.endSecond - duration) > TIME_EPSILON) throw new Error("逐帧时间段必须完整覆盖镜头时长");
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (frame.startSecond < 0 || frame.endSecond <= frame.startSecond) throw new Error(`第 ${index + 1} 帧时间段无效`);
        if (index && Math.abs(frame.startSecond - frames[index - 1].endSecond) > TIME_EPSILON) throw new Error("逐帧时间段不能重叠或存在空白");
    }
    return frames;
}

/** Returns the visible subject that must change from frame to frame. */
export function dramaFrameVisualSubject(imagePrompt: string, actionPrompt = "", fallback = "") {
    const subject = staticFrameSubject(imagePrompt, actionPrompt, fallback);
    const state = imagePrompt.match(/可见状态：([^；。\n]+)/u)?.[1] || "";
    const performanceState = imagePrompt.match(/可见表演状态：([^；。\n]+)/u)?.[1] || "";
    return [subject, isGenericFrameState(state) ? "" : state, performanceState].filter(Boolean).join("｜");
}

export function validateDramaFrameVisualContent(imagePrompt: string, actionPrompt = "") {
    const subject = staticFrameSubject(imagePrompt, actionPrompt, "");
    const visibleState = imagePrompt.match(/可见状态：([^；。\n]+)/u)?.[1]?.trim() || "";
    if (/参考图职责[：:]/u.test(imagePrompt)) return "参考图职责属于资产绑定数据，不能写入静态图片提示词正文";
    if (/(?:运镜|焦段|推镜|拉镜|摇镜|跟拍|滑轨|环绕|吊臂|慢推|慢拉|后拉|时间段|时间轴|动作过程|对白|声音|口型)/u.test(imagePrompt)) return "每帧必须描述当前可见画面，且静态图片帧不能包含运镜、时间过程、对白或声音指令";
    if (/(?:景别|镜头)(?:（[^）]*）)?\s*[：:]\s*[^；。\n]*(?:→|->|至)/u.test(imagePrompt)) return "每帧只能使用一个固定景别，不能保留景别切换过程";
    if (/(?:ELS|极远景)/u.test(imagePrompt) && /(?:清晰面部|面部清晰|眉眼|嘴角|下颌|手部|手指|道具|细节)/u.test(imagePrompt)) return "ELS/极远景只能承载远景空间关系，不能与清晰面部、手部或道具细节同时出现";
    if (visibleState && isGenericFrameState(visibleState)) return "每帧必须写出动作节点已经造成的可见状态变化，不能只写通用阶段标签";
    if (!subject || /^(?:主体保持当前设定中的静态状态|无|待补全|待生成)$/u.test(subject) || /^(?:口型同步|无字幕|无水印|禁止|避免|不得|不展示|没有)/u.test(subject) || /^(?:\d+mm|镜头|运镜|沿[^；。]*?(?:推|拉|摇|跟拍)|(?:慢推|慢拉|环绕))/u.test(subject))
        return "每帧必须描述当前可见的主体、姿态、道具或环境状态，不能只有对白、旁白、运镜或约束说明";
    return undefined;
}

export function validateDramaFramePlanVisuals(frames: readonly DramaFrameBeat[]) {
    const errors: string[] = [];
    const subjects = frames.map((frame) => dramaFrameVisualSubject(frame.imagePrompt, frame.actionPrompt));
    frames.forEach((frame, index) => {
        const error = validateDramaFrameVisualContent(frame.imagePrompt, frame.actionPrompt);
        if (error) errors.push(`第 ${index + 1} 帧：${error}`);
        if (index > 0 && subjects[index] && subjects[index] === subjects[index - 1]) errors.push(`第 ${index + 1} 帧与上一帧的可见画面没有变化，请补充本帧状态变化`);
    });
    return errors;
}

export function defaultDramaFrameBeats(duration: number, actionPrompt: string, imagePrompt: string, frameCount = 5): DramaFrameBeat[] {
    const count = Math.max(1, Math.min(MAX_FRAME_BEATS, Math.floor(frameCount)));
    const phases = ["建立动作入口", "动作推进", "关键动作结果", "结果反应/转场"];
    const normalizedDuration = Math.max(1, Math.round(duration));
    const activePhases = Array.from({ length: count }, (_, index) => phases[index] || `阶段${index + 1}`);
    const normalizedActionPrompt = actionPrompt.trim();
    const normalizedImagePrompt = imagePrompt.trim();
    const boundaries = activePhases.map((_, index) => number((normalizedDuration * index) / activePhases.length)).concat(normalizedDuration);
    return activePhases.map((phase, index) => {
        const startSecond = boundaries[index];
        const endSecond = boundaries[index + 1];
        return {
            id: `frame-${index + 1}`,
            sequenceIndex: index + 1,
            startSecond,
            endSecond,
            actionPrompt: `${phase}：${normalizedActionPrompt}；${frameProgressionState(index, count)}`,
            imagePrompt: formatPromptFieldLines(
                `静态关键帧：${normalizedImagePrompt}；可见状态：${frameProgressionState(index, count)}；可见表演状态：${phase}时眉眼、视线、呼吸与手部/身体关系呈现对应变化；景别：中景；机位与构图：平视，主体位于9:16安全区，前景有具体框景；站位与视线：主体站位明确，视线落向当前叙事目标；三层空间：前景为具体框景或遮挡物，中景承载主体与道具，背景交代环境纵深；光色与风格：延续本场主光与色板，材质纹理自然；负面约束：无字幕、无水印、无logo、无HUD、无现代元素、无额外主体、无额外肢体、无变形。`,
            ),
        };
    });
}

export function upgradeDramaFrameImagePrompt(
    imagePrompt: string,
    actionPrompt: string,
    context: {
        description: string;
        shotSize: string;
        cameraAngle: string;
        composition: string;
        characterBlocking: string;
        gazeDirection: string;
        lighting: string;
        colorPalette: string;
        performanceState?: string;
        sequenceIndex?: number;
        frameCount?: number;
        forceRefresh?: boolean;
    },
) {
    const existingVisibleState = imagePrompt.match(/可见状态[：:]([^；。\n]+)/u)?.[1]?.trim() || "";
    if (
        !context.forceRefresh &&
        /^静态关键帧[：:]/u.test(imagePrompt.trim()) &&
        ["可见表演状态", "景别", "机位与构图", "站位与视线", "三层空间", "光色与风格", "负面约束"].every((label) => new RegExp(`${label}[：:]`, "u").test(imagePrompt)) &&
        !/参考图职责[：:]/u.test(imagePrompt) &&
        !isGenericFrameState(existingVisibleState) &&
        !/(?:景别|镜头)(?:（[^）]*）)?\s*[：:]\s*[^；。\n]*(?:→|->|至)/u.test(imagePrompt)
    )
        return formatPromptFieldLines(imagePrompt.trim());
    const subject = staticFrameSubject(imagePrompt, actionPrompt, context.description);
    const visibleState = !isGenericFrameState(existingVisibleState) ? existingVisibleState : "";
    const performanceState = context.performanceState || inferStaticPerformanceState(subject, actionPrompt, context.sequenceIndex);
    const frameState = visibleState || inferStaticFrameState(subject, actionPrompt, context.sequenceIndex, context.frameCount);
    const resolvedShotSize = staticShotSize(context.shotSize, context.sequenceIndex, `${subject}；${frameState}；${performanceState}`);
    return [
        `静态关键帧：${subject}`,
        `可见状态：${frameState}`,
        `可见表演状态：${performanceState}`,
        context.shotSize ? `景别：${resolvedShotSize}` : "",
        context.cameraAngle || context.composition ? `机位与构图：${[context.cameraAngle, context.composition].map(cleanStaticConstraint).filter(Boolean).join("；")}；前景有具体框景或遮挡物` : "",
        context.characterBlocking || context.gazeDirection ? `站位与视线：${[context.characterBlocking, context.gazeDirection].map(cleanStaticConstraint).filter(Boolean).join("；")}` : "",
        "三层空间：前景必须是具体框景或遮挡物；中景承载主体与当前状态；背景交代环境关系与纵深。",
        context.lighting || context.colorPalette ? `光色与风格：${[context.lighting, staticPalette(context.colorPalette, context.sequenceIndex)].map(cleanStaticConstraint).filter(Boolean).join("；")}；保留自然材质纹理` : "",
        "负面约束：无字幕、无水印、无logo、无HUD、无现代元素、无额外主体、无额外肢体、无变形。",
    ]
        .filter(Boolean)
        .join("\n");
}

function inferStaticPerformanceState(subject: string, actionPrompt: string, sequenceIndex = 1) {
    const text = `${subject}；${actionPrompt}`;
    if (/惊醒|睁眼|呼吸急促/u.test(text)) return "眉眼骤然睁开、下颌绷紧；视线落向断剑或当前触发物；手部继续扣住握柄";
    if (/否认|避开|隐瞒/u.test(text)) return "眉心轻收、嘴角压住；视线先避开对方后短暂回看；手部保持道具接触";
    if (/接住|水囊|推过去/u.test(text)) return "表情紧张略缓；视线跟随水囊；手部从待接变为握稳";
    if (/护符|警觉|注视|探测器|结界/u.test(text)) return "眉心收紧、眼神警觉；视线锁定结界或探测器；手部握紧当前道具";
    if (/解封|封印|力量|收力/u.test(text)) return "下颌收紧后放松；视线正对目标；手部由蓄力转为稳定收力";
    if (/木匣|铜镜|短刃|断口|铁砧|裂纹/u.test(text)) return "表情由疑惑转为戒备；视线锁定关键道具；手部保持明确接触关系";
    if (sequenceIndex <= 1) return "表情保持入口情绪且眉眼清晰；视线沿叙事目标方向；手部与道具保持入口关系";
    return "眉眼出现细微反应；视线转向当前叙事目标；手部或道具位置形成可见变化";
}

function frameProgressionState(index: number, count: number) {
    if (count <= 1) return "动作结果已经成立，主体、手部/身体与目标道具落在可辨识的终点状态";
    if (index === 0) return "动作入口已成立，主体处于准备姿态，手部/身体与当前目标形成明确起点关系";
    if (index === count - 1) return "动作结果已经成立，主体姿态、视线与道具位置落在新的稳定终点";
    if (index === count - 2) return "关键动作已经发生，主体重心或手部位置相对入口明显改变，道具/环境出现结果";
    return "动作正在推进，主体重心或手部位置相对入口发生可辨识变化，视线转向当前目标";
}

function inferStaticFrameState(subject: string, actionPrompt: string, sequenceIndex = 1, frameCount = 4) {
    const state = frameProgressionState(Math.max(0, sequenceIndex - 1), Math.max(1, frameCount || 4));
    return `${state}；${subject || actionPrompt}`;
}

export function staticShotSize(value: string, sequenceIndex = 1, visibleContent = "") {
    const parts = value
        .split(/\s*(?:→|->|至)\s*/u)
        .map((part) => part.trim())
        .filter(Boolean);
    const selected = parts[Math.min(Math.max(sequenceIndex - 1, 0), parts.length - 1)] || value;
    if (/(?:ELS|极远景)/u.test(selected) && /(?:面部|眉眼|眼睛|下颌|嘴角|手部|手指|道具|剑刃|断剑|细节)/u.test(visibleContent)) return "中远景";
    return selected;
}

function staticPalette(value: string, sequenceIndex = 1) {
    const parts = value
        .split(/\s*(?:→|->|至)\s*/u)
        .map((part) => part.trim())
        .filter(Boolean);
    return parts[Math.min(Math.max(sequenceIndex - 1, 0), parts.length - 1)] || value;
}

function cleanStaticConstraint(value: string) {
    return value
        .replace(/[“”"][^“”"]{0,160}[”"]?/gu, "")
        .replace(/(?:耳语|对白|旁白|口型同步|询问|回答|问)[:：][^；。]*/u, "")
        .trim();
}

function isGenericFrameState(value: string) {
    return /^(?:主体保持进入镜头时的静止姿态|主体的手部或身体姿态已发生可见变化|关键道具或环境出现明确可见变化|主体保持动作完成后的稳定姿态|入口构图已建立|入口姿态、表情与视线已建立|手部与道具关系发生可见变化|表情、视线与道具状态同步变化|动作完成后的稳定尾帧|起始状态|动作展开|关键变化|结果状态)$/u.test(
        value.trim(),
    );
}

function staticFrameSubject(imagePrompt: string, actionPrompt: string, fallback: string) {
    const markerSources = [imagePrompt, actionPrompt].map((value) => value.match(/(?:本帧|当前)(?:时段动作锚点|帧可见画面)：([\s\S]*)/u)?.[1] || "").filter(Boolean);
    const candidates = [...markerSources, imagePrompt, actionPrompt]
        .map((value) =>
            value
                .replace(/^(?:本帧|当前)(?:时段动作锚点|帧可见画面)：/u, "")
                .replace(/^静态关键帧：/u, "")
                .replace(/^本帧可见画面：/u, "")
                .replace(/^生成\d+秒[^。]*。?/u, "")
                .replace(/^本内部镜头只执行：/u, "")
                .replace(/[；\n](?:可见状态|可见表演状态|景别|机位与构图|站位与视线|三层空间|光色与风格|参考图职责|负面约束)：[\s\S]*$/u, "")
                .replace(/^无字幕、无水印、无logo[^。]*。?/u, "")
                .replace(/^深蓝黑、雪白、极少冷银。?/u, "")
                .replace(/^.*?(?:匹配切到|切到|切至|转到)/u, "")
                .replace(/(?:耳语|对白|旁白|台词|口型同步|询问|回答|问)[:：][\s\S]*$/u, "")
                .replace(/(?:镜头运动|运镜|推镜|拉镜|摇镜|跟拍|拍摄)[:：]?[\s\S]*$/u, "")
                .replace(/^(?:镜头)?沿[^；。\n]*(?:推|拉|摇|跟拍|环绕)[^；。\n]*[；。]?/u, "")
                .replace(/^(?:无对白|无台词|无字幕|无水印)[；。]?/u, "")
                .replace(/(?:保持(?:角色|人物|身份|服装|道具|场景|空间|结构|连续)|严格以|冻结当前时间点|不包含运动|不表现运动过程|主体、道具与环境保留可辨识材质纹理|可见表演状态)[^；。]*[；。]?/gu, "")
                .replace(/^”/u, "")
                .replace(/[“”"][^“”"]{0,160}[”"]?/gu, "")
                .trim(),
        )
        .flatMap((value) => value.split(/[。；]/u))
        .map((value) => value.trim())
        .filter((value) => value.length > 3)
        .filter((value) => !/^(?:耳语|对白|旁白|口型同步|无对白|无字幕|不要|禁止)/u.test(value))
        .filter(
            (value) => !/(?:镜头|运镜|推镜|拉镜|摇镜|跟拍|匹配切|固定双人|景别|口型同步|开口|说话|回答|询问|质疑|否认|沿动作轴线|视线高度|拍摄|动作过渡|连续反应|当前动作|动作展开|关键变化|结果状态|缩短距离|冲刺|奔跑|靠近|走向|逐渐|继续)/u.test(value),
        );
    const safeFallback = cleanStaticConstraint(fallback)
        .replace(/[；。]+$/u, "")
        .trim();
    const safeImage = cleanStaticConstraint(imagePrompt)
        .replace(/^静态关键帧：/u, "")
        .replace(/[；。]+$/u, "")
        .trim();
    const usableImage = safeImage.length > 3 && !/^(?:无|待补全|待生成)$/u.test(safeImage) && !/(?:镜头|运镜|推镜|拉镜|摇镜|跟拍|拍摄|焦段|\d+mm|缩短距离|靠近|冲刺|奔跑|逐渐|继续|向前靠近)/u.test(safeImage);
    return candidates[0] || (usableImage ? safeImage : safeFallback) || "主体保持当前设定中的静态状态";
}

export function insertDramaFrameBeat(frames: readonly DramaFrameBeat[], frameId: string): DramaFrameBeat[] {
    if (frames.length >= MAX_FRAME_BEATS) throw new Error("逐帧计划最多 9 帧");
    const index = frames.findIndex((frame) => frame.id === frameId);
    if (index < 0) throw new Error("待拆分帧不存在");
    const current = frames[index];
    const middle = number((current.startSecond + current.endSecond) / 2);
    if (middle <= current.startSecond || middle >= current.endSecond) throw new Error("当前时间段无法继续拆分");
    return reindex([...frames.slice(0, index), { ...current, endSecond: middle }, { ...current, id: `frame-${nanoid()}`, startSecond: middle, actionPrompt: `${current.actionPrompt}（后续）` }, ...frames.slice(index + 1)]);
}

export function deleteDramaFrameBeat(frames: readonly DramaFrameBeat[], frameId: string): DramaFrameBeat[] {
    if (frames.length <= 1) throw new Error("逐帧计划至少保留 1 帧");
    const index = frames.findIndex((frame) => frame.id === frameId);
    if (index < 0) throw new Error("待删除帧不存在");
    const next = frames.map((frame) => ({ ...frame }));
    const [removed] = next.splice(index, 1);
    if (index > 0) next[index - 1].endSecond = removed.endSecond;
    else next[0].startSecond = removed.startSecond;
    return reindex(next);
}

export function updateDramaFrameBeat(frames: readonly DramaFrameBeat[], generated: readonly DramaStoryboardFrame[], frameId: string, patch: Partial<Pick<DramaFrameBeat, "endSecond" | "actionPrompt" | "imagePrompt" | "supplierPrompt">>) {
    const index = frames.findIndex((frame) => frame.id === frameId);
    if (index < 0) throw new Error("待更新帧不存在");
    const beats = frames.map((frame) => ({ ...frame }));
    beats[index] = { ...beats[index], ...patch };
    if (patch.endSecond !== undefined && index + 1 < beats.length) beats[index + 1].startSecond = patch.endSecond;
    const invalidFrom = patch.imagePrompt !== undefined || patch.supplierPrompt !== undefined || patch.endSecond !== undefined ? index : index + 1;
    const staleIds = new Set(beats.slice(invalidFrom).map((frame) => frame.id));
    return {
        beats: reindex(beats),
        frames: generated.map((frame) =>
            staleIds.has(frame.id)
                ? { ...frame, status: "stale" as const, taskId: undefined, error: undefined, inputHash: undefined, continuityStatus: "stale" as const, continuityEvidenceId: undefined, generationPrompt: undefined, generationReferences: undefined }
                : frame,
        ),
    };
}

export function planDramaVideoSegments(frames: readonly DramaFrameBeat[], limits: { minDurationSeconds: number; maxDurationSeconds: number; maxReferenceImages: number; assetReferenceCount: number }) {
    const availableFrameReferences = limits.maxReferenceImages - limits.assetReferenceCount;
    if (availableFrameReferences < 2) throw new Error("当前视频模型无法同时容纳项目资产与至少 2 张逐帧锚点图");
    const segments: Array<{ startIndex: number; endIndex: number; startSecond: number; endSecond: number; duration: number; frameIds: string[] }> = [];
    let startIndex = 0;
    while (startIndex < frames.length) {
        if (segments.length && frames.length - startIndex < 2) throw new Error("最后一个视频子段无法同时携带边界锚点和结束锚点，请调整帧时间或视频模型时长限制");
        const remainingDuration = frames.at(-1)!.endSecond - frames[startIndex].startSecond;
        if (remainingDuration <= limits.maxDurationSeconds && frames.length - startIndex <= availableFrameReferences) {
            if (segments.length && frames.length - startIndex < 2) throw new Error("最后一个视频子段无法同时携带边界锚点和结束锚点，请调整帧时间或视频模型时长限制");
            if (remainingDuration < limits.minDurationSeconds) throw new Error(`时间段 ${frames[startIndex].startSecond}-${frames.at(-1)!.endSecond}s 小于当前视频模型最短时长 ${limits.minDurationSeconds}s，无法安全分段`);
            segments.push({ startIndex, endIndex: frames.length - 1, startSecond: frames[startIndex].startSecond, endSecond: frames.at(-1)!.endSecond, duration: remainingDuration, frameIds: frames.slice(startIndex).map((frame) => frame.id) });
            break;
        }

        let boundaryIndex = -1;
        for (let index = startIndex + 1; index < frames.length; index += 1) {
            const duration = frames[index].startSecond - frames[startIndex].startSecond;
            const referenceCount = index - startIndex + 1;
            if (duration > limits.maxDurationSeconds || referenceCount > availableFrameReferences) break;
            boundaryIndex = index;
        }
        if (boundaryIndex < 0) throw new Error(`当前视频模型无法在 ${limits.maxDurationSeconds}s 和 ${availableFrameReferences} 张锚点图限制内安全分段`);
        const duration = frames[boundaryIndex].startSecond - frames[startIndex].startSecond;
        if (duration < limits.minDurationSeconds) throw new Error(`时间段 ${frames[startIndex].startSecond}-${frames[boundaryIndex].startSecond}s 小于当前视频模型最短时长 ${limits.minDurationSeconds}s，无法安全分段`);
        segments.push({ startIndex, endIndex: boundaryIndex, startSecond: frames[startIndex].startSecond, endSecond: frames[boundaryIndex].startSecond, duration, frameIds: frames.slice(startIndex, boundaryIndex + 1).map((frame) => frame.id) });
        startIndex = boundaryIndex;
    }
    return segments;
}

function reindex(frames: readonly DramaFrameBeat[]) {
    return frames.map((frame, index) => ({ ...frame, sequenceIndex: index + 1 }));
}

function number(value: number) {
    return Number(value.toFixed(3));
}
