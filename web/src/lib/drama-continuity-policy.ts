import { nanoid } from "nanoid";

import type { DramaContinuityEntityState, DramaFrameEvidence, DramaFrameEvidenceValidity, DramaProductionPackageEpisode, DramaShot } from "./drama-project-contract";

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

const MOVEMENT_CUE =
    /移动到|走向|离开[^。；\n]{0,18}(?:到|至|门|座|案|侧|前|后)|进入[^。；\n]{0,18}(?:门|房|厅|座|案|侧)|起身[^。；\n]{0,18}(?:走|到|向)|坐下|站起[^。；\n]{0,18}(?:走|到|向)|后退到|前进到|转身走向|绕过[^。；\n]{0,18}(?:到|向)|换位到|挪到|靠近[^。；\n]{0,18}(?:对方|门|案|座|侧)|远离[^。；\n]{0,18}(?:对方|门|案|座|侧)|被迫[^。；\n]{0,18}(?:退|移|走)|推开[^。；\n]{0,18}(?:门|人)|拉开[^。；\n]{0,18}(?:门|人)|交给|递给|接过|落座于|出画|入画/u;
const AXIS_CHANGE_CUE = /轴线切换|越轴|转轴|重新建立轴线|改变视线轴/u;
const POSITION_SEPARATOR = /[，,；;、/]|或者?|(?:\s+and\s+)/iu;
const POSITIONAL_STATE_FIELDS = ["position", "pose", "holderId"] as const;

type ContinuityEntity = DramaContinuityEntityState;
type ContinuityIssue = { episodeCode: string; fromShotCode: string; toShotCode: string; message: string };

/**
 * Hard-cut continuity is a new clip boundary, not a spatial reset. This gate
 * validates the authored state before the importer is allowed to inherit or
 * normalize anything from the previous shot.
 */
export function validateDramaContinuityEdges(episodes: readonly DramaProductionPackageEpisode[]): string[] {
    return episodes.flatMap((episode) => validateEpisodeContinuityEdges(episode).map(formatContinuityIssue));
}

export function continuityStateChangeIsIntentional(previous: ContinuityEntity, next: ContinuityEntity, edgeNotes: string | undefined, firstFrameText: string) {
    return POSITIONAL_STATE_FIELDS.some((field) => previous[field] && next[field] && normalize(previous[field]) !== normalize(next[field])) && hasMovementCause(`${previous.action || ""}\n${previous.state || ""}\n${edgeNotes || ""}\n${firstFrameText}`);
}

function validateEpisodeContinuityEdges(episode: DramaProductionPackageEpisode): ContinuityIssue[] {
    const shots = new Map(episode.shots.map((shot) => [shot.code, shot]));
    const issues: ContinuityIssue[] = [];
    for (const edge of episode.continuityEdges) {
        const from = shots.get(edge.fromShotCode);
        const to = shots.get(edge.toShotCode);
        if (!from || !to || !from.exitState || !to.entryState) continue;
        const firstFrame = to.framePlan?.frames[0];
        const firstFrameText = firstFrame ? [firstFrame.startPrompt, firstFrame.actionPrompt, firstFrame.transitionPrompt, firstFrame.endPrompt, firstFrame.imagePrompt].filter(Boolean).join("\n") : "";
        const previousCharacters = new Map(from.exitState.characters.map((item) => [item.assetId, item]));
        const nextCharacters = new Map(to.entryState.characters.map((item) => [item.assetId, item]));
        const previousProps = new Map(from.exitState.props.map((item) => [item.assetId, item]));
        const nextProps = new Map(to.entryState.props.map((item) => [item.assetId, item]));
        for (const assetId of edge.carryCharacterIds) validateEntityCarry(issues, episode.code, edge, assetId, previousCharacters.get(assetId), nextCharacters.get(assetId), firstFrameText, "角色");
        for (const assetId of edge.carryPropIds) validateEntityCarry(issues, episode.code, edge, assetId, previousProps.get(assetId), nextProps.get(assetId), firstFrameText, "道具");
        if (edge.carryEnvironment && normalize(from.exitState.environment) !== normalize(to.entryState.environment)) issues.push(issue(episode.code, edge, "跨硬切继承的环境状态发生变化；必须在上一镜出口动作或 edge notes 中写明场景变化原因"));
        if (edge.carryAxis && (normalize(from.exitState.axis) !== normalize(to.entryState.axis) || normalize(from.exitState.screenDirection) !== normalize(to.entryState.screenDirection)) && !AXIS_CHANGE_CUE.test(edge.notes || ""))
            issues.push(issue(episode.code, edge, "跨硬切继承的轴线/屏幕方向发生变化；未声明越轴或重新建立轴线的可见原因"));
        if (edge.carryCharacterIds.length || edge.carryPropIds.length) {
            const blocking = `${to.continuity?.characterBlocking || ""}\n${to.continuity?.continuityNotes || ""}`;
            for (const assetId of [...edge.carryCharacterIds, ...edge.carryPropIds]) {
                const state = nextCharacters.get(assetId) || nextProps.get(assetId);
                const position = state?.position;
                if (position && !positionAnchors(position).some((anchor) => blocking.includes(anchor) || firstFrameText.includes(anchor)))
                    issues.push(issue(episode.code, edge, `下一镜首个帧段未重复锁定 ${assetId} 的空间位置“${position}”；硬切后不得让模型自行重排人物/道具`));
            }
        }
    }
    return issues;
}

function validateEntityCarry(
    issues: ContinuityIssue[],
    episodeCode: string,
    edge: DramaProductionPackageEpisode["continuityEdges"][number],
    assetId: string,
    previous: ContinuityEntity | undefined,
    next: ContinuityEntity | undefined,
    firstFrameText: string,
    kind: string,
) {
    if (!previous || !next) {
        issues.push(issue(episodeCode, edge, `连续承接的${kind} ${assetId} 缺少上一镜出口或下一镜入口状态`));
        return;
    }
    const differences = POSITIONAL_STATE_FIELDS.filter((field) => previous[field] && next[field] && normalize(previous[field]) !== normalize(next[field]));
    if (!differences.length) return;
    if (!hasMovementCause(`${previous.action || ""}\n${previous.state || ""}\n${edge.notes || ""}\n${firstFrameText}`))
        issues.push(issue(episodeCode, edge, `连续承接的${kind} ${assetId} 在 ${differences.join("、")} 上改变，但没有“动作触发→移动路径/受力→新位置”的明确依据`));
}

function hasMovementCause(value: string) {
    return MOVEMENT_CUE.test(value);
}

function positionAnchors(value: string) {
    return value
        .split(POSITION_SEPARATOR)
        .map((part) => part.replace(/(?:画面|当前|保持|位于|处于|站在|坐在|停在)/gu, "").trim())
        .filter((part) => part.length >= 2);
}

function issue(episodeCode: string, edge: DramaProductionPackageEpisode["continuityEdges"][number], message: string): ContinuityIssue {
    return { episodeCode, fromShotCode: edge.fromShotCode, toShotCode: edge.toShotCode, message };
}

function formatContinuityIssue(value: ContinuityIssue) {
    return `${value.episodeCode}/${value.fromShotCode}→${value.toShotCode}：${value.message}`;
}

function normalize(value: string | undefined) {
    return (value || "").replace(/[\s，。；：、,.!?！？]+/gu, "").trim();
}

function frameFingerprint(value: string) {
    let hash = 2166136261;
    for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return `frame-${(hash >>> 0).toString(16)}`;
}
