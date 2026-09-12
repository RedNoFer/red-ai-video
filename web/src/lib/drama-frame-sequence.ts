import { nanoid } from "nanoid";

import type { DramaFrameBeat, DramaStoryboardFrame } from "./drama-project-contract";

export const MAX_FRAME_BEATS = 9;
const TIME_EPSILON = 0.001;
const STATIC_FRAME_PROMPT_LABELS = ["画面主体", "静态关键帧", "可见状态", "可见表演状态", "构图与空间", "景别", "机位与构图", "站位与视线", "三层空间", "光色与风格", "针对性约束", "负面约束"] as const;
const POSITIVE_STATIC_FRAME_PROMPT_LABELS = STATIC_FRAME_PROMPT_LABELS.filter((label) => label !== "针对性约束" && label !== "负面约束");
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

/** Normalize existing field boundaries only; static prompt content is never reconstructed or stripped. */
export function formatPromptFieldLines(value: string, kind: "static" | "video" = "static") {
    const labels = kind === "video" ? VIDEO_PROMPT_LABELS : STATIC_FRAME_PROMPT_LABELS;
    const pattern = labels.join("|");
    return value
        .trim()
        .replace(new RegExp(`[\\s,，;；。]+(?=(?:${pattern})[：:])`, "gu"), "\n")
        .replace(/[ \t]*\n[ \t]*/gu, "\n")
        .trim();
}

/** Return only positive static-frame fields; negative constraints may contain words that are forbidden in the image itself. */
export function dramaStaticFramePositiveText(value: string) {
    const prompt = formatPromptFieldLines(value, "static");
    const fields = POSITIVE_STATIC_FRAME_PROMPT_LABELS.map((label) => staticFrameField(prompt, label)).filter(Boolean);
    return fields.length ? fields.join("\n") : prompt;
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
        ...(frame.startPrompt?.trim() ? { startPrompt: frame.startPrompt.trim() } : {}),
        actionPrompt: frame.actionPrompt.trim(),
        ...(frame.transitionPrompt?.trim() ? { transitionPrompt: frame.transitionPrompt.trim() } : {}),
        ...(frame.endPrompt?.trim() ? { endPrompt: frame.endPrompt.trim() } : {}),
        imagePrompt: frame.imagePrompt.trim(),
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
    const state = imagePrompt.match(/(?:画面主体|静态关键帧|可见状态)：([^；。\n]+)/u)?.[1] || "";
    const performanceState = imagePrompt.match(/可见表演状态：([^\n]+)/u)?.[1] || "";
    return [subject, isGenericFrameState(state) ? "" : state, isGenericPerformanceState(performanceState) ? "" : performanceState].filter(Boolean).join("｜");
}

/**
 * Compares only the visible state and performance state of two static frames.
 * Repeated identity, lighting and scene text is expected; repeated observable
 * state is not. The normalization only removes status filler and common
 * wording variants, so it does not impose a similarity score on provider art.
 */
export function dramaFrameVisualSignature(imagePrompt: string) {
    return ["可见状态", "可见表演状态", "景别", "机位与构图"]
        .map((label) => imagePrompt.match(new RegExp(`${label}[：:]([^\\n]+)`, "u"))?.[1] || "")
        .map(normalizeFrameStateForComparison)
        .filter(Boolean)
        .join("|");
}

export function dramaFrameCameraSignature(imagePrompt: string) {
    return ["景别", "机位与构图"]
        .map((label) => imagePrompt.match(new RegExp(`${label}[：:]([^\\n]+)`, "u"))?.[1] || "")
        .map(normalizeFrameStateForComparison)
        .filter(Boolean)
        .join("|");
}

export function validateDramaFrameVisualContent(imagePrompt: string, actionPrompt = "") {
    void actionPrompt;
    const normalized = formatPromptFieldLines(imagePrompt);
    const subject = staticFrameSubject(normalized, "", "");
    const visibleState = ["可见状态", "可见表演状态"].map((label) => staticFrameField(normalized, label)).find(Boolean) || "";
    const positivePrompt = dramaStaticFramePositiveText(imagePrompt);
    if (!normalized) return "静态图片提示词不能为空";
    if (/(?:https?:\/\/|data:image\/|assetId|内部\s*ID|内部编号|Skill|referenceManifest|参考绑定|实际参考图绑定|参考图职责|\{[\s\S]*\}|\[[\s\S]*\])/iu.test(imagePrompt)) return "静态图片提示词不能包含内部 ID、URL、JSON、Skill 名称或参考绑定信息";
    if (/(?:运镜|推镜|拉镜|摇镜|跟拍|滑轨|环绕|吊臂|慢推|慢拉|后拉|时间段|时间轴|动作过程|对白|旁白|声音|音效|音乐|口型)/u.test(positivePrompt)) return "静态图片提示词不能包含运镜过程、时间轴、对白或声音指令";
    if (!subject || /^(?:无|待补全|待生成)$/u.test(subject) || /^(?:口型同步|无字幕|无水印|禁止|避免|不得|不展示|没有)/u.test(subject)) return "每帧必须描述当前可见主体";
    if ((!visibleState && !hasVisibleStaticState(positivePrompt)) || (visibleState && isGenericFrameState(visibleState))) return "每帧必须描述当前冻结的可见状态";
    if (!hasVisibleSpatialResult(positivePrompt)) return "每帧至少需要一项可验收的空间关系、视线、姿态、道具或环境结果";
    return undefined;
}

export function validateDramaFramePlanVisuals(frames: readonly DramaFrameBeat[]) {
    const errors: string[] = [];
    frames.forEach((frame, index) => {
        const error = validateDramaFrameVisualContent(frame.imagePrompt, frame.actionPrompt);
        if (error) errors.push(`第 ${index + 1} 帧：${error}`);
    });
    return errors;
}

/** Similar adjacent frames are a quality warning, not a hard import error. */
export function warnDramaFramePlanVisuals(frames: readonly DramaFrameBeat[]) {
    const warnings: string[] = [];
    frames.forEach((frame, index) => {
        if (index === 0) return;
        const currentSubject = dramaFrameVisualSubject(frame.imagePrompt);
        const previousSubject = dramaFrameVisualSubject(frames[index - 1].imagePrompt);
        const currentSignature = dramaFrameVisualSignature(frame.imagePrompt);
        const previousSignature = dramaFrameVisualSignature(frames[index - 1].imagePrompt);
        if (currentSubject && currentSubject === previousSubject) warnings.push(`第 ${index + 1} 帧与上一帧的可见主体/状态接近`);
        else if (currentSignature && currentSignature === previousSignature) warnings.push(`第 ${index + 1} 帧与上一帧的语义状态接近`);
    });
    return warnings;
}

/** Existing static prompt text is only normalized; it is never upgraded or rebuilt. */
export function isCurrentDramaStaticFramePrompt(value: string) {
    return !validateDramaFrameVisualContent(value);
}

function staticFrameSubject(imagePrompt: string, actionPrompt: string, fallback: string) {
    const normalized = formatPromptFieldLines(imagePrompt);
    const labeledSubject = staticFrameField(normalized, "画面主体") || staticFrameField(normalized, "静态关键帧");
    if (labeledSubject) return labeledSubject.trim();
    const firstVisibleLine = normalized
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line && !/^(?:可见状态|可见表演状态|构图与空间|景别|机位与构图|站位与视线|三层空间|光色与风格|针对性约束|负面约束)[：:]/u.test(line));
    return firstVisibleLine || actionPrompt.trim() || fallback.trim();
}
function isGenericFrameState(value: string) {
    return /^(?:主体保持进入镜头时的静止姿态|主体的手部或身体姿态已发生可见变化|关键道具或环境出现明确可见变化|主体保持动作完成后的稳定姿态|入口构图已建立|入口姿态、表情与视线已建立|动作入口已成立|动作节点的可见结果已经成立|人物姿态与道具位置清晰可见|手部与道具关系发生可见变化|表情、视线与道具状态同步变化|动作完成后的稳定尾帧|起始状态|动作展开|关键变化|结果状态)$/u.test(
        value.trim(),
    );
}

function isGenericPerformanceState(value: string) {
    return /(?:主体的眉眼、呼吸、手部和道具接触关系清晰可见|眉眼、视线和手部动作与当前节拍一致|情绪通过身体动作呈现|表情保持入口情绪且眉眼清晰|眉眼出现细微反应；视线转向当前叙事目标|表情保持稳定|冻结为单一静态姿态|情绪保持与上一状态一致|面部眉眼和下颌保持可读的初始反应|视线沿当前镜头动作方向|身体与手部进入)/u.test(
        value.trim(),
    );
}

function normalizeFrameStateForComparison(value: string) {
    return value
        .trim()
        .replace(/(?:已经|已|正在|仍然|继续|当前|本帧|清晰可见|明确|自然|状态|关系|结果|节点|呈现|形成|保持)/gu, "")
        .replace(/手指|手掌/gu, "手")
        .replace(/抬起|抬头/gu, "抬")
        .replace(/看向|望向|注视/gu, "看")
        .replace(/朝向/gu, "向")
        .replace(/收紧|攥紧|扣紧/gu, "紧")
        .replace(/放松|松开/gu, "松")
        .replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, "")
        .trim();
}

function hasVisibleStaticState(value: string) {
    return /(?:静立|站立|坐在|低头|抬头|睁眼|闭眼|呼吸|肩膀|脚步|看向|对视|视线|姿态|下颌|眉眼|手部|手指|握住|扣住|按住|放在|停在|位于|面向|朝向|保持|茶盏|道具|波纹|阴影|反光|打开|闭合|破损|裂纹|血印|屏息)/u.test(value);
}

function hasVisibleSpatialResult(value: string) {
    return /(?:前景|中景|背景|左侧|右侧|东侧|西侧|北侧|南门|桌面|桌沿|门窗|通道|座位|长桌|靠墙|柱|同框|站在|坐在|位于|朝向|面向|视线|看向|对视|接触|支撑|握住|按住|停在|放在|道具|环境|马车|车厢|湖边|门边|室内|户外|前方|后方|中央|同一侧)/u.test(value);
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

export function updateDramaFrameBeat(frames: readonly DramaFrameBeat[], generated: readonly DramaStoryboardFrame[], frameId: string, patch: Partial<Pick<DramaFrameBeat, "endSecond" | "actionPrompt" | "imagePrompt">>) {
    const index = frames.findIndex((frame) => frame.id === frameId);
    if (index < 0) throw new Error("待更新帧不存在");
    const beats = frames.map((frame) => ({ ...frame }));
    beats[index] = { ...beats[index], ...patch };
    if (patch.endSecond !== undefined && index + 1 < beats.length) beats[index + 1].startSecond = patch.endSecond;
    const invalidFrom = patch.imagePrompt !== undefined || patch.endSecond !== undefined ? index : index + 1;
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

function staticFrameField(prompt: string, label: string) {
    const labels = STATIC_FRAME_PROMPT_LABELS.join("|");
    return prompt.match(new RegExp(`(?:^|\\n)${label}[：:]([\\s\\S]*?)(?=\\n(?:${labels})[：:]|$)`, "u"))?.[1]?.trim() || "";
}

function number(value: number) {
    return Number(value.toFixed(3));
}
