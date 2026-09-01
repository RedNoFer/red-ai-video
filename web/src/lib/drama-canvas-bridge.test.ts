import { describe, expect, it } from "vitest";

import type { CanvasProject } from "@/lib/canvas-project-contract";
import { CanvasNodeType } from "@/app/(user)/canvas/types";
import { buildDramaEpisodeCanvasGraph, dramaEpisodeCanvasHandoffId, mergeDramaEpisodeCanvasProject, applyDramaCanvasMediaField } from "./drama-canvas-bridge";
import type { DramaEpisode, DramaProject, DramaShot } from "./drama-project-contract";

describe("drama canvas bridge", () => {
    it("builds one visual flow for an episode", () => {
        const project = dramaProject([shot("one", 1), { ...shot("two", 2), storyboardFrameMode: "first_last", storyboardEndImageUrl: "/api/end.webp" }]);
        const graph = buildDramaEpisodeCanvasGraph(project, project.episodes[0]);

        expect(graph.nodes.map((node) => node.metadata?.dramaShotId)).toContain("one");
        expect(graph.nodes.every((node) => node.metadata?.canvasOrigin === "drama")).toBe(true);
        expect(graph.nodes.find((node) => node.id === "drama-shot-two-end")?.metadata?.status).toBe("success");
        expect(graph.connections.some((connection) => connection.id === "drama-flow-one-two")).toBe(true);
    });

    it("keeps each shot in a stable vertical block and maps frame slots to the shot", () => {
        const project = dramaProject([shot("one", 1), { ...shot("two", 2), storyboardFrameMode: "first_last" }]);
        const graph = buildDramaEpisodeCanvasGraph(project, project.episodes[0]);
        const first = graph.nodes.filter((node) => node.metadata?.dramaShotId === "one");
        const second = graph.nodes.filter((node) => node.metadata?.dramaShotId === "two");

        expect(first).toHaveLength(3);
        expect(second).toHaveLength(4);
        expect(new Set(first.map((node) => node.position.x))).toEqual(new Set([80]));
        expect(new Set(second.map((node) => node.position.x))).toEqual(new Set([600]));
        expect(first.map((node) => node.position.y)).toEqual([180, 470, 1050]);
        expect(second.map((node) => node.position.y)).toEqual([180, 470, 760, 1050]);
    });

    it("refreshes drama nodes while preserving free canvas exploration nodes", () => {
        const project = dramaProject([shot("one", 1)]);
        const canvas: CanvasProject = {
            id: `canvas-${dramaEpisodeCanvasHandoffId(project.id, project.episodes[0].id)}`,
            sourceHandoffId: dramaEpisodeCanvasHandoffId(project.id, project.episodes[0].id),
            creativeConversationId: "conversation",
            title: "旧画布",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            nodes: [
                { id: "drama-shot-one-text", type: "text" as never, title: "旧镜头", position: { x: 0, y: 0 }, width: 1, height: 1, metadata: { sourceSurface: "drama", dramaProjectId: project.id, dramaEpisodeId: project.episodes[0].id, dramaShotId: "one" } },
                { id: "free-note", type: "text" as never, title: "探索", position: { x: 9, y: 9 }, width: 100, height: 100, metadata: { canvasOrigin: "user" } },
            ],
            connections: [{ id: "free-edge", fromNodeId: "free-note", toNodeId: "free-note" }],
            chatSessions: [],
            activeChatId: null,
            backgroundMode: "lines",
            showImageInfo: false,
            viewport: { x: 0, y: 0, k: 1 },
        };

        const merged = mergeDramaEpisodeCanvasProject(canvas, project, project.episodes[0]);

        expect(merged.nodes.some((node) => node.id === "free-note")).toBe(true);
        expect(merged.nodes.find((node) => node.id === "drama-shot-one-text")?.title).toContain("镜头 1");
        expect(merged.connections.some((connection) => connection.id === "free-edge")).toBe(true);
    });

    it("migrates a mixed legacy canvas once and resets the initial viewport", () => {
        const project = dramaProject([shot("one", 1)]);
        const canvas = {
            ...emptyCanvas(project),
            nodes: [
                { id: "old-text", type: CanvasNodeType.Text, title: "旧镜头", position: { x: 0, y: 0 }, width: 340, height: 240, metadata: { sourceSurface: "drama" as const } },
                { id: "user-note", type: CanvasNodeType.Text, title: "用户笔记", position: { x: 20, y: 20 }, width: 200, height: 120, metadata: { canvasOrigin: "user" as const } },
            ],
            connections: [{ id: "old-edge", fromNodeId: "old-text", toNodeId: "user-note" }],
            viewport: { x: -900, y: 0, k: 1 },
        };

        const migrated = mergeDramaEpisodeCanvasProject(canvas, project, project.episodes[0]);
        expect(migrated.canvasMigrationVersion).toBe(5);
        expect(migrated.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(["user-note", "drama-shot-one-text"]));
        expect(migrated.nodes.map((node) => node.id)).not.toContain("old-text");
        expect(migrated.connections.some((connection) => connection.id === "old-edge")).toBe(false);
        expect(migrated.viewport).not.toEqual(canvas.viewport);
        expect(migrated.viewport).toEqual({ x: 48, y: 28, k: 0.72 });

        const replay = mergeDramaEpisodeCanvasProject(migrated, project, project.episodes[0]);
        expect(replay.viewport).toEqual(migrated.viewport);
        expect(replay.nodes.some((node) => node.id === "user-note")).toBe(true);
    });

    it("applies canvas media back to supported drama shot fields", () => {
        expect(applyDramaCanvasMediaField(shot("one", 1), "storyboardImageUrl", { url: "/api/start.webp", width: 640, height: 960 })).toMatchObject({ storyboardStatus: "success", storyboardImageUrl: "/api/start.webp", storyboardImageWidth: 640 });
        expect(applyDramaCanvasMediaField(shot("one", 1), "storyboardEndImageUrl", { url: "/api/end.webp" })).toMatchObject({ storyboardFrameMode: "first_last", storyboardEndStatus: "success", storyboardEndImageUrl: "/api/end.webp" });
        expect(applyDramaCanvasMediaField(shot("one", 1), "videoUrl", { url: "/api/video.mp4" })).toMatchObject({ generationStatus: "success", videoUrl: "/api/video.mp4" });
    });
});

function dramaProject(shots: DramaShot[]): DramaProject {
    const episode: DramaEpisode = { id: "episode-one", title: "第 1 集", script: "", outline: "", hook: "", nextPreview: "", sourceRange: "", reviewStatus: "visual_ready", shots };
    return { id: "drama-one", title: "短剧", summary: "", style: "写实", ratio: "9:16", status: "active", defaultVideoMode: "storyboard", characters: [], scenes: [], props: [], clues: [], episodes: [episode], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
}

function emptyCanvas(project: DramaProject): CanvasProject {
    return {
        id: `canvas-${dramaEpisodeCanvasHandoffId(project.id, project.episodes[0].id)}`,
        sourceHandoffId: dramaEpisodeCanvasHandoffId(project.id, project.episodes[0].id),
        title: "旧画布",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        nodes: [],
        connections: [],
        chatSessions: [],
        activeChatId: null,
        backgroundMode: "lines",
        showImageInfo: false,
        viewport: { x: 0, y: 0, k: 1 },
    };
}

function shot(id: string, order: number): DramaShot {
    return {
        id,
        order,
        title: `镜头 ${order}`,
        description: "人物向前走",
        sourceText: "",
        shotBoundary: "",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: "起始画面",
        videoPrompt: "向前推进",
        cameraMotion: "推进",
        duration: 5,
        characterIds: [],
        propIds: [],
        clueIds: [],
        storyboardStatus: "idle",
        generationStatus: "idle",
        audioStatus: "idle",
    };
}
