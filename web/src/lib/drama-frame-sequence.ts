import { nanoid } from "nanoid";

import type { DramaFrameBeat, DramaStoryboardFrame } from "./drama-project-contract";

const MAX_FRAME_BEATS = 9;
const TIME_EPSILON = 0.001;

export function normalizeDramaFrameBeats(value: readonly DramaFrameBeat[], duration: number): DramaFrameBeat[] {
    if (!value.length) throw new Error("逐帧计划至少需要 1 帧");
    if (value.length > MAX_FRAME_BEATS) throw new Error("逐帧计划最多 9 帧");
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("镜头时长无效");
    const frames = value.map((frame, index) => ({
        id: frame.id.trim() || `frame-${nanoid()}`,
        sequenceIndex: index + 1,
        startSecond: number(frame.startSecond),
        endSecond: number(frame.endSecond),
        actionPrompt: frame.actionPrompt.trim(),
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

export function defaultDramaFrameBeats(duration: number, actionPrompt: string, imagePrompt: string): DramaFrameBeat[] {
    return [{ id: `frame-${nanoid()}`, sequenceIndex: 1, startSecond: 0, endSecond: duration, actionPrompt: actionPrompt.trim(), imagePrompt: imagePrompt.trim() }];
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
        frames: generated.map((frame) => (staleIds.has(frame.id) ? { ...frame, status: "stale" as const, taskId: undefined, error: undefined, inputHash: undefined, continuityStatus: "stale" as const, continuityEvidenceId: undefined } : frame)),
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
