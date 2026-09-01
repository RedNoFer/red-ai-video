import type { CanvasProject } from "@/lib/canvas-project-contract";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasNodeMetadata } from "@/app/(user)/canvas/types";
import type { DramaEpisode, DramaProject, DramaShot } from "@/lib/drama-project-contract";

export type DramaCanvasMediaField = "storyboardImageUrl" | "storyboardEndImageUrl" | "videoUrl";

const SHOT_X_GAP = 520;
const SHOT_X = 80;
const SLOT_Y = { text: 180, start: 470, end: 760, video: 1050 };
const DRAMA_CANVAS_MIGRATION_VERSION = 5;

export function dramaEpisodeCanvasHandoffId(projectId: string, episodeId: string) {
    return `drama-episode-${projectId}-${episodeId}`;
}

export function buildDramaEpisodeCanvasTitle(project: Pick<DramaProject, "title">, episode: Pick<DramaEpisode, "title">) {
    return `${project.title} · ${episode.title} 画布`;
}

export function mergeDramaEpisodeCanvasProject(canvas: CanvasProject, project: DramaProject, episode: DramaEpisode): CanvasProject {
    const dramaNodeIds = new Set(canvas.nodes.filter((node) => isDramaEpisodeCanvasNode(node, project.id, episode.id)).map((node) => node.id));
    const needsMigration = canvas.canvasMigrationVersion !== DRAMA_CANVAS_MIGRATION_VERSION || hasLegacyHorizontalDramaLayout(canvas, project.id, episode.id);
    const legacyNodes = needsMigration ? canvas.nodes.filter((node) => !dramaNodeIds.has(node.id) && node.metadata?.canvasOrigin !== "user") : [];
    const legacyNodeIds = new Set(legacyNodes.map((node) => node.id));
    const preservedNodes = canvas.nodes.filter((node) => !dramaNodeIds.has(node.id) && !legacyNodeIds.has(node.id));
    const removedNodeIds = new Set([...dramaNodeIds, ...legacyNodeIds]);
    const preservedConnections = canvas.connections.filter((connection) => !removedNodeIds.has(connection.fromNodeId) && !removedNodeIds.has(connection.toNodeId));
    const { nodes, connections } = buildDramaEpisodeCanvasGraph(project, episode);
    return {
        ...canvas,
        title: canvas.title || buildDramaEpisodeCanvasTitle(project, episode),
        nodes: [...nodes, ...preservedNodes],
        connections: [...connections, ...preservedConnections],
        viewport: needsMigration ? initialDramaViewport() : canvas.viewport,
        canvasMigrationVersion: DRAMA_CANVAS_MIGRATION_VERSION,
    };
}

function initialDramaViewport() {
    return { x: 48, y: 28, k: 0.72 };
}

function hasLegacyHorizontalDramaLayout(canvas: CanvasProject, projectId: string, episodeId: string) {
    const dramaNodes = canvas.nodes.filter((node) => isDramaEpisodeCanvasNode(node, projectId, episodeId));
    if (dramaNodes.length < 2) return false;
    return [...new Set(dramaNodes.map((node) => node.metadata?.dramaShotId).filter(Boolean))].some((shotId) => {
        const shotNodes = dramaNodes.filter((node) => node.metadata?.dramaShotId === shotId);
        return new Set(shotNodes.map((node) => node.position.x)).size > 1;
    });
}

export function buildDramaEpisodeCanvasGraph(project: DramaProject, episode: DramaEpisode): { nodes: CanvasNodeData[]; connections: CanvasConnection[] } {
    const nodes = episode.shots.flatMap((shot, index) => buildShotNodes(project, episode, shot, index));
    const connections: CanvasConnection[] = [];
    for (const shot of episode.shots) {
        connections.push(edge(textNodeId(shot.id), frameNodeId(shot.id, "storyboardImageUrl")));
        connections.push(edge(frameNodeId(shot.id, "storyboardImageUrl"), videoNodeId(shot.id)));
        if (shot.storyboardFrameMode === "first_last") connections.push(edge(frameNodeId(shot.id, "storyboardEndImageUrl"), videoNodeId(shot.id)));
    }
    for (let index = 1; index < episode.shots.length; index += 1) {
        const previous = episode.shots[index - 1];
        const current = episode.shots[index];
        connections.push(edge(videoNodeId(previous.id), textNodeId(current.id), `drama-flow-${previous.id}-${current.id}`));
    }
    return { nodes, connections };
}

export function applyDramaCanvasMediaField(shot: DramaShot, field: DramaCanvasMediaField, input: { url: string; width?: number; height?: number }): DramaShot {
    if (field === "videoUrl") {
        return { ...shot, videoUrl: input.url, generationStatus: "success", generationError: undefined };
    }
    if (field === "storyboardEndImageUrl") {
        return {
            ...shot,
            storyboardFrameMode: "first_last",
            storyboardEndImageUrl: input.url,
            storyboardEndImageWidth: input.width,
            storyboardEndImageHeight: input.height,
            storyboardEndStatus: "success",
            storyboardEndError: undefined,
        };
    }
    return {
        ...shot,
        storyboardImageUrl: input.url,
        storyboardImageWidth: input.width,
        storyboardImageHeight: input.height,
        storyboardStatus: "success",
        storyboardError: undefined,
    };
}

function buildShotNodes(project: DramaProject, episode: DramaEpisode, shot: DramaShot, index: number): CanvasNodeData[] {
    const x = 80 + index * SHOT_X_GAP;
    const base = dramaMetadata(project, episode, shot);
    const textStatus: CanvasNodeMetadata["status"] = activeStatus(shot) ? "loading" : failedStatus(shot) ? "error" : "success";
    const nodes: CanvasNodeData[] = [
        {
            id: textNodeId(shot.id),
            type: CanvasNodeType.Text,
            title: `${String(shot.order).padStart(2, "0")} ${shot.title || "镜头"}`,
            position: { x, y: SLOT_Y.text },
            width: 360,
            height: 220,
            metadata: {
                ...base,
                dramaRole: "text",
                content: [shot.description, shot.videoPrompt ? `动态：${shot.videoPrompt}` : "", shot.cameraMotion ? `运镜：${shot.cameraMotion}` : ""].filter(Boolean).join("\n\n"),
                status: textStatus,
                fontSize: 14,
                errorDetails: [shot.storyboardError, shot.storyboardEndError, shot.generationError].filter(Boolean).join("\n") || undefined,
            },
        },
        frameNode(project, episode, shot, "storyboardImageUrl", x, SLOT_Y.start, "起始帧", shot.storyboardImageUrl, shot.storyboardImageWidth, shot.storyboardImageHeight, shot.storyboardStatus),
        frameNode(project, episode, shot, "storyboardEndImageUrl", x, SLOT_Y.end, "结束帧", shot.storyboardEndImageUrl, shot.storyboardEndImageWidth, shot.storyboardEndImageHeight, shot.storyboardEndStatus),
        {
            id: videoNodeId(shot.id),
            type: CanvasNodeType.Video,
            title: `${shot.title || "镜头"} · 视频`,
            position: { x, y: SLOT_Y.video },
            width: 360,
            height: 220,
            metadata: {
                ...base,
                dramaRole: "video",
                dramaField: "videoUrl",
                content: shot.videoUrl || "",
                serverUrl: serverMediaUrl(shot.videoUrl),
                remoteUrl: remoteMediaUrl(shot.videoUrl),
                status: taskStatus(shot.generationStatus, Boolean(shot.videoUrl)),
                errorDetails: shot.generationError,
                prompt: shot.videoPrompt,
            },
        },
    ];
    return nodes.filter((node) => node.id !== frameNodeId(shot.id, "storyboardEndImageUrl") || shot.storyboardFrameMode === "first_last" || shot.storyboardEndImageUrl);
}

function frameNode(project: DramaProject, episode: DramaEpisode, shot: DramaShot, field: "storyboardImageUrl" | "storyboardEndImageUrl", x: number, y: number, label: string, url?: string, width?: number, height?: number, status?: DramaShot["storyboardStatus"]): CanvasNodeData {
    const size = { width: 360, height: 220 };
    return {
        id: frameNodeId(shot.id, field),
        type: CanvasNodeType.Image,
        title: `${shot.title || "镜头"} · ${label}`,
        position: { x, y },
        width: size.width,
        height: size.height,
        metadata: {
            ...dramaMetadata(project, episode, shot),
            dramaRole: field === "storyboardEndImageUrl" ? "end" : "start",
            dramaField: field,
            content: url || "",
            serverUrl: serverMediaUrl(url),
            remoteUrl: remoteMediaUrl(url),
            naturalWidth: width,
            naturalHeight: height,
            status: taskStatus(status, Boolean(url)),
            prompt: field === "storyboardEndImageUrl" ? shot.endFramePrompt : shot.imagePrompt,
        },
    };
}

function dramaMetadata(project: DramaProject, episode: DramaEpisode, shot: DramaShot): CanvasNodeMetadata {
    return { canvasOrigin: "drama", sourceSurface: "drama", dramaProjectId: project.id, dramaEpisodeId: episode.id, dramaShotId: shot.id };
}

function isDramaEpisodeCanvasNode(node: CanvasNodeData, projectId: string, episodeId: string) {
    return node.metadata?.sourceSurface === "drama" && node.metadata.dramaProjectId === projectId && node.metadata.dramaEpisodeId === episodeId;
}

function taskStatus(status: DramaShot["storyboardStatus"], hasUrl: boolean): CanvasNodeMetadata["status"] {
    if (hasUrl) return "success";
    if (status === "queued" || status === "running") return "loading";
    if (status === "error") return "error";
    if (status === "cancelled") return "cancelled";
    return "idle";
}

function activeStatus(shot: DramaShot) {
    return [shot.storyboardStatus, shot.storyboardEndStatus, shot.generationStatus].some((status) => status === "queued" || status === "running");
}

function failedStatus(shot: DramaShot) {
    return [shot.storyboardStatus, shot.storyboardEndStatus, shot.generationStatus].some((status) => status === "error");
}

function mediaSize(width?: number, height?: number) {
    if (!width || !height) return { width: 340, height: 240 };
    const ratio = width / height;
    return { width: 340, height: Math.max(160, Math.round(340 / Math.max(0.2, ratio))) };
}

function edge(fromNodeId: string, toNodeId: string, id = `drama-edge-${fromNodeId}-${toNodeId}`): CanvasConnection {
    return { id, fromNodeId, toNodeId };
}

function textNodeId(shotId: string) {
    return `drama-shot-${shotId}-text`;
}

function frameNodeId(shotId: string, field: "storyboardImageUrl" | "storyboardEndImageUrl") {
    return `drama-shot-${shotId}-${field === "storyboardImageUrl" ? "start" : "end"}`;
}

function videoNodeId(shotId: string) {
    return `drama-shot-${shotId}-video`;
}

function serverMediaUrl(url?: string) {
    return url?.startsWith("/api/") ? url : undefined;
}

function remoteMediaUrl(url?: string) {
    return /^https?:\/\//i.test(url || "") ? url : undefined;
}
