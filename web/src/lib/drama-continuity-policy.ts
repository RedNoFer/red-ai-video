import { nanoid } from "nanoid";

import type { DramaFrameEvidence, DramaFrameEvidenceValidity, DramaShot } from "./drama-project-contract";

export function createFrameEvidence(input: Omit<DramaFrameEvidence, "id" | "contentHash" | "createdAt"> & Partial<Pick<DramaFrameEvidence, "id" | "contentHash" | "createdAt">>): DramaFrameEvidence {
    return {
        ...input,
        id: input.id || `frame-${nanoid()}`,
        contentHash: input.contentHash || frameFingerprint(`${input.role}:${input.mediaUrl}:${input.sourceVideoUrl || ""}`),
        createdAt: input.createdAt || new Date().toISOString(),
    };
}

export function acceptedActualEndFrame(shot: Pick<DramaShot, "videoUrl" | "frameEvidence">) {
    return shot.frameEvidence?.find((frame) => frame.role === "actual_end" && frame.validity === "accepted" && Boolean(shot.videoUrl) && frame.sourceVideoUrl === shot.videoUrl);
}

export function invalidateFrameEvidence(frame: DramaFrameEvidence, validity: Extract<DramaFrameEvidenceValidity, "rejected" | "superseded" | "unavailable">, invalidReason: string): DramaFrameEvidence {
    const now = new Date().toISOString();
    return { ...frame, validity, invalidReason, ...(validity === "rejected" ? { rejectedAt: now } : {}) };
}

export function supersedeFrameEvidence(frames: DramaFrameEvidence[] | undefined, reason: string) {
    return (frames || []).map((frame) => (frame.validity === "accepted" || frame.validity === "candidate" ? invalidateFrameEvidence(frame, "superseded", reason) : frame));
}

export function supersedeFrameEvidenceByRole(frames: DramaFrameEvidence[] | undefined, role: DramaFrameEvidence["role"], reason: string) {
    return (frames || []).map((frame) => (frame.role === role && (frame.validity === "accepted" || frame.validity === "candidate") ? invalidateFrameEvidence(frame, "superseded", reason) : frame));
}

export function replaceFrameEvidence(frames: DramaFrameEvidence[] | undefined, next: DramaFrameEvidence, reason: string) {
    return [...(frames || []).map((frame) => (frame.role === next.role && (frame.validity === "accepted" || frame.validity === "candidate") ? invalidateFrameEvidence(frame, "superseded", reason) : frame)), next];
}

export function continuityStartEvidence(shot: Pick<DramaShot, "videoUrl" | "frameEvidence">) {
    const frame = acceptedActualEndFrame(shot);
    return frame?.mediaUrl ? frame : undefined;
}

export function latestFrameEvidence(shot: Pick<DramaShot, "frameEvidence">, role: DramaFrameEvidence["role"], validities?: DramaFrameEvidenceValidity[]) {
    return (shot.frameEvidence || []).find((frame) => frame.role === role && (!validities || validities.includes(frame.validity)));
}

export function activeFrameEvidence(shot: Pick<DramaShot, "frameEvidence">, role: DramaFrameEvidence["role"]) {
    return (shot.frameEvidence || []).filter((frame) => frame.role === role && (frame.validity === "candidate" || frame.validity === "accepted"));
}

export function decideActualEndFrame(shot: DramaShot, frameEvidenceId: string, decision: "accept" | "reject", expectedVideoRevision: string) {
    if (!shot.videoUrl || shot.videoUrl !== expectedVideoRevision) throw new Error("镜头视频版本已变化，请重新提取实际首尾帧");
    const target = shot.frameEvidence?.find((frame) => frame.id === frameEvidenceId && frame.role === "actual_end" && frame.sourceVideoUrl === shot.videoUrl);
    if (!target || target.validity !== "candidate") throw new Error("当前实际尾帧不可验收");
    const now = new Date().toISOString();
    return {
        ...shot,
        frameEvidence: (shot.frameEvidence || []).map((frame) =>
            frame.id !== target.id
                ? frame
                : decision === "accept"
                  ? { ...frame, validity: "accepted" as const, acceptedAt: now, invalidReason: undefined, rejectedAt: undefined }
                  : { ...frame, validity: "rejected" as const, rejectedAt: now, invalidReason: "人工拒绝当前实际尾帧" },
        ),
        continuityStatus: decision === "accept" ? ("passed" as const) : ("blocked" as const),
        continuityError: decision === "accept" ? undefined : "当前实际尾帧已被拒绝，请明确重新生成当前镜头后再继续。",
    };
}

function frameFingerprint(value: string) {
    let hash = 2166136261;
    for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return `frame-${(hash >>> 0).toString(16)}`;
}
