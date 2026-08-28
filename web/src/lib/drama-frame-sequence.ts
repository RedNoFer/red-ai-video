import { nanoid } from "nanoid";

import type { DramaFrameBeat, DramaStoryboardFrame } from "./drama-project-contract";

const MAX_FRAME_BEATS = 9;

export function normalizeDramaFrameBeats(value: readonly DramaFrameBeat[], duration: number): DramaFrameBeat[] {
    if (!value.length) throw new Error("逐帧计划至少需要 1 帧");
    if (value.length > MAX_FRAME_BEATS) throw new Error("逐帧计划最多 9 帧");
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("镜头时长必须为正数秒");
    if (value.length > duration) throw new Error("帧数不能超过镜头整数秒数");
    if ((Number.isInteger(duration) ? Math.round(value[0].startSecond) : value[0].startSecond) !== 0 || (Number.isInteger(duration) ? Math.round(value.at(-1)!.endSecond) : value.at(-1)!.endSecond) !== duration) throw new Error("逐帧时间段必须完整覆盖镜头时长");
    const boundaries = integerBoundaries(value, duration);
    const frames = value.map((frame, index) => ({
        id: frame.id.trim() || `frame-${nanoid()}`,
        sequenceIndex: index + 1,
        startSecond: boundaries[index],
        endSecond: boundaries[index + 1],
        actionPrompt: frame.actionPrompt.trim(),
        imagePrompt: frame.imagePrompt.trim(),
    }));
    if (frames.some((frame) => !frame.actionPrompt || !frame.imagePrompt)) throw new Error("每帧必须填写动作提示词和画面提示词");
    if (frames[0].startSecond !== 0 || frames.at(-1)!.endSecond !== duration) throw new Error("逐帧时间段必须完整覆盖镜头时长");
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (frame.startSecond < 0 || frame.endSecond <= frame.startSecond) throw new Error(`第 ${index + 1} 帧时间段无效`);
        if (index && frame.startSecond !== frames[index - 1].endSecond) throw new Error("逐帧时间段不能重叠或存在空白");
    }
    return frames;
}

export function defaultDramaFrameBeats(duration: number, actionPrompt: string, imagePrompt: string): DramaFrameBeat[] {
    const phases = ["起始状态", "动作展开", "关键变化", "结果状态"];
    const normalizedDuration = Math.max(0.001, duration);
    const activePhases = phases.slice(0, Math.min(phases.length, normalizedDuration));
    const durations = integerPartitions(normalizedDuration, activePhases.length);
    const normalizedActionPrompt = actionPrompt.trim();
    const normalizedImagePrompt = imagePrompt.trim();
    return activePhases.map((phase, index) => {
        const startSecond = durations.slice(0, index).reduce((sum, value) => sum + value, 0);
        const endSecond = startSecond + durations[index];
        return {
            id: `frame-${index + 1}`,
            sequenceIndex: index + 1,
            startSecond,
            endSecond,
            actionPrompt: `${normalizedActionPrompt}；${phase}`,
            imagePrompt: `${normalizedImagePrompt}；${phase}静态锚点`,
        };
    });
}

export function upgradeDramaFrameImagePrompt(
    imagePrompt: string,
    actionPrompt: string,
    context: { description: string; shotSize: string; cameraAngle: string; composition: string; characterBlocking: string; gazeDirection: string; lighting: string; colorPalette: string; sequenceIndex?: number },
) {
    if (imagePrompt.trim().startsWith("静态关键帧：") && imagePrompt.includes("冻结当前时间点的可见状态")) return imagePrompt.trim();
    const subject = staticFrameSubject(imagePrompt, actionPrompt, context.description);
    return [
        `静态关键帧：${subject}`,
        context.shotSize ? `景别（本帧固定）：${staticShotSize(context.shotSize, context.sequenceIndex)}` : "",
        context.cameraAngle ? `视角：${cleanStaticConstraint(context.cameraAngle)}` : "",
        context.composition ? `构图：${cleanStaticConstraint(context.composition)}` : "",
        context.characterBlocking || context.gazeDirection ? `站位与视线：${[context.characterBlocking, context.gazeDirection].map(cleanStaticConstraint).filter(Boolean).join("；")}` : "",
        context.lighting || context.colorPalette ? `灯光与色彩：${[context.lighting, staticPalette(context.colorPalette, context.sequenceIndex)].map(cleanStaticConstraint).filter(Boolean).join("；")}` : "",
        "三层空间：前景用于框定或遮挡；中景承载主体与当前状态；背景交代环境关系与纵深。",
        "动作只以当前冻结姿态、手部/道具接触关系或环境残留呈现，不表现运动过程。",
        "主体、道具与环境保留可辨识材质纹理；人物面部清晰、自然并保持身份一致。",
        "冻结当前时间点的可见状态；不包含运动、剪辑、对白或声音指令；保持人物、道具、空间结构与上一帧连续。",
    ]
        .filter(Boolean)
        .join("；");
}

function staticShotSize(value: string, sequenceIndex = 1) {
    const parts = value.split(/\s*(?:→|->|至)\s*/u).map((part) => part.trim()).filter(Boolean);
    return parts[Math.min(Math.max(sequenceIndex - 1, 0), parts.length - 1)] || value;
}

function staticPalette(value: string, sequenceIndex = 1) {
    const parts = value.split(/\s*(?:→|->|至)\s*/u).map((part) => part.trim()).filter(Boolean);
    return parts[Math.min(Math.max(sequenceIndex - 1, 0), parts.length - 1)] || value;
}

function cleanStaticConstraint(value: string) {
    return value
        .replace(/[“”"][^“”"]{0,160}[”"]?/gu, "")
        .replace(/(?:耳语|对白|旁白|口型同步|询问|回答|问)[:：][^；。]*/u, "")
        .trim();
}

function staticFrameSubject(imagePrompt: string, actionPrompt: string, fallback: string) {
    const markerSources = [imagePrompt, actionPrompt]
        .map((value) => value.match(/当前(?:时段动作锚点|帧可见画面)：([\s\S]*)/u)?.[1] || "")
        .filter(Boolean);
    const candidates = [...markerSources, imagePrompt, actionPrompt]
        .map((value) =>
            value
                .replace(/^当前(?:时段动作锚点|帧可见画面)：/u, "")
                .replace(/^静态关键帧：/u, "")
                .replace(/^生成\d+秒[^。]*。?/u, "")
                .replace(/^本内部镜头只执行：/u, "")
                .replace(/^无字幕、无水印、无logo[^。]*。?/u, "")
                .replace(/^深蓝黑、雪白、极少冷银。?/u, "")
                .replace(/^.*?(?:匹配切到|切到|切至|转到)/u, "")
                .replace(/(?:耳语|对白|旁白|口型同步|询问|回答|问)[:：][\s\S]*$/u, "")
                .replace(/(?:镜头运动|运镜|推镜|拉镜|摇镜|跟拍|拍摄)[:：]?[\s\S]*$/u, "")
                .replace(/^”/u, "")
                .replace(/[“”"][^“”"]{0,160}[”"]?/gu, "")
                .trim(),
        )
        .flatMap((value) => value.split(/[。；]/u))
        .map((value) => value.trim())
        .filter((value) => value.length > 3)
        .filter((value) => !/^(?:耳语|对白|旁白|口型同步|无对白|无字幕|不要|禁止)/u.test(value))
        .filter((value) => !/(?:镜头|运镜|推镜|拉镜|摇镜|跟拍|匹配切|固定双人|景别|口型同步|开口|说话|回答|询问|质疑|否认|沿动作轴线|视线高度|拍摄|动作过渡|连续反应|当前动作|动作展开|关键变化|结果状态|缩短距离|冲刺|奔跑|靠近|走向|逐渐|继续)/u.test(value));
    const safeFallback = cleanStaticConstraint(fallback).replace(/[；。]+$/u, "").trim();
    return candidates[0] || safeFallback || "主体保持当前设定中的静态状态";
}

export function insertDramaFrameBeat(frames: readonly DramaFrameBeat[], frameId: string): DramaFrameBeat[] {
    if (frames.length >= MAX_FRAME_BEATS) throw new Error("逐帧计划最多 9 帧");
    const index = frames.findIndex((frame) => frame.id === frameId);
    if (index < 0) throw new Error("待拆分帧不存在");
    const current = frames[index];
    const middle = Math.floor((current.startSecond + current.endSecond) / 2);
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
        frames: generated.map((frame) => (staleIds.has(frame.id) ? { ...frame, status: "stale" as const, taskId: undefined, error: undefined, inputHash: undefined, continuityStatus: "stale" as const, continuityEvidenceId: undefined, generationPrompt: undefined } : frame)),
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

function integerBoundaries(frames: readonly DramaFrameBeat[], duration: number) {
    const boundaries = [0];
    for (let index = 0; index < frames.length - 1; index += 1) {
        const remaining = frames.length - index - 1;
        const preferred = Number.isInteger(duration) ? Math.round(Number(frames[index].endSecond)) : Number(frames[index].endSecond);
        const minimum = boundaries[index];
        const maximum = duration;
        boundaries.push(Math.min(Math.max(preferred, minimum), maximum));
    }
    boundaries.push(duration);
    return boundaries;
}

function integerPartitions(total: number, count: number) {
    const safeTotal = Math.max(count * 0.001, total);
    const base = Math.floor(safeTotal / count);
    const remainder = safeTotal - base * count;
    return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
