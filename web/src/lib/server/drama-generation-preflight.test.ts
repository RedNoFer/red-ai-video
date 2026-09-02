import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthSettings: vi.fn(), resolveLogicalModelCandidates: vi.fn(), requestStructuredText: vi.fn() }));
vi.mock("@/lib/auth/store", () => ({ getAuthSettings: mocks.getAuthSettings, refundUserPoints: vi.fn() }));
vi.mock("@/lib/server/logical-model-router", () => ({ resolveLogicalModelCandidates: mocks.resolveLogicalModelCandidates }));
vi.mock("@/lib/server/text-planning-runtime", () => ({ rankTextPlanningCandidates: (items: unknown[]) => items, requestStructuredText: mocks.requestStructuredText }));

import { preflightDramaGeneration } from "./drama-generation-preflight";
import type { DramaEpisode, DramaProject } from "@/lib/drama-project-contract";

describe("drama generation preflight", () => {
    beforeEach(() => vi.resetAllMocks());

    it("does not call the model when deterministic checks block generation", async () => {
        const project = fixture();
        const result = await preflightDramaGeneration({ origin: "http://localhost", cookie: "", userId: "user", requestId: "request", project, episode: project.episodes[0] });
        expect(result.status).toBe("blocked");
        expect(mocks.requestStructuredText).not.toHaveBeenCalled();
    });

    it("returns model revisions without replacing the source prompt", async () => {
        const project = fixture();
        project.seriesBible = { version: "series-bible-v1", canonCharacters: [], immutableRules: [], relationshipState: "", worldRules: [], unresolvedThreads: [], visualMotifs: [], soundMotifs: [] };
        project.episodes[0].shots[0].duration = 6;
        const ref = { id: "ref", url: "/api/ref", source: "generated" as const, status: "approved" as const, label: "已审核", createdAt: new Date(0).toISOString() };
        project.characters[0].references = [ref];
        project.characters[0].primaryReferenceId = ref.id;
        project.scenes[0].references = [ref];
        project.scenes[0].primaryReferenceId = ref.id;
        project.props[0].references = [ref];
        project.props[0].primaryReferenceId = ref.id;
        const state = { characters: [{ assetId: "character-one", position: "左", gaze: "右", pose: "站立", action: "静止" }], props: [{ assetId: "prop-one", state: "入鞘", holderId: "character-one" }], environment: "城门", lighting: "冷光" };
        project.episodes[0].shots[0].entryState = state;
        project.episodes[0].shots[0].exitState = state;
        mocks.getAuthSettings.mockResolvedValue({ defaultModels: { textModel: "planner" } });
        mocks.resolveLogicalModelCandidates.mockReturnValue([{ channelId: "channel", upstreamModel: "gpt", channel: { id: "channel" } }]);
        mocks.requestStructuredText.mockResolvedValue({
            arguments: JSON.stringify({ revisions: [{ shotId: "shot-one", imagePrompt: "修订后的分镜提示词", videoPrompt: "修订后的视频提示词", summary: "补充远景和主体位置" }] }),
            headers: new Headers(),
            protocol: "chat",
            elapsedMs: 1,
        });
        const result = await preflightDramaGeneration({ origin: "http://localhost", cookie: "", userId: "user", requestId: "request", project, episode: project.episodes[0] });
        expect(result.revisedPrompts?.["shot-one"]).toEqual({ imagePrompt: "修订后的分镜提示词", videoPrompt: "修订后的视频提示词" });
        expect(project.episodes[0].shots[0].videoPrompt).toBe("Karin站在门前");
        const messages = mocks.requestStructuredText.mock.calls[0]?.[0]?.messages as Array<{ role: string; content: string }>;
        expect(messages[0]?.content).toContain("项目视觉风格：写实");
        expect(messages[0]?.content).not.toContain("纯写实摄影或真人影视感");
    });

    it("does not inherit blockers from shots outside a targeted retry", async () => {
        const project = fixture();
        project.episodes[0].shots.push({ ...project.episodes[0].shots[0], id: "shot-two", title: "未完成镜头", imagePrompt: "", videoPrompt: "" });
        const result = await preflightDramaGeneration({ origin: "http://localhost", cookie: "", userId: "user", requestId: "request", project, episode: project.episodes[0], shotIds: ["shot-one"] });
        expect(result.issues.every((issue) => issue.shotId !== "shot-two")).toBe(true);
    });

    it("blocks generation when a configured model returns an invalid revision", async () => {
        const project = fixture();
        project.seriesBible = { version: "series-bible-v1", canonCharacters: [], immutableRules: [], relationshipState: "", worldRules: [], unresolvedThreads: [], visualMotifs: [], soundMotifs: [] };
        project.episodes[0].shots[0].duration = 6;
        const ref = { id: "ref", url: "/api/ref", source: "generated" as const, status: "approved" as const, label: "已审核", createdAt: new Date(0).toISOString() };
        for (const asset of [project.characters[0], project.scenes[0], project.props[0]]) {
            asset.references = [ref];
            asset.primaryReferenceId = ref.id;
        }
        const state = { characters: [{ assetId: "character-one", position: "左", gaze: "右", pose: "站立", action: "静止" }], props: [{ assetId: "prop-one", state: "入鞘", holderId: "character-one" }], environment: "城门", lighting: "冷光" };
        project.episodes[0].shots[0].entryState = state;
        project.episodes[0].shots[0].exitState = state;
        mocks.getAuthSettings.mockResolvedValue({ defaultModels: { textModel: "planner" } });
        mocks.resolveLogicalModelCandidates.mockReturnValue([{ channelId: "channel", upstreamModel: "gpt", channel: { id: "channel" } }]);
        mocks.requestStructuredText.mockResolvedValue({ arguments: JSON.stringify({ revisions: [] }), headers: new Headers(), protocol: "chat", elapsedMs: 1 });
        const result = await preflightDramaGeneration({ origin: "http://localhost", cookie: "", userId: "user", requestId: "request", project, episode: project.episodes[0] });
        expect(result).toMatchObject({ status: "blocked", issues: expect.arrayContaining([expect.objectContaining({ code: "MODEL_PREFLIGHT_FAILED" })]) });
    });
});

function fixture(): DramaProject {
    const episode: DramaEpisode = {
        id: "episode-one",
        code: "E01",
        title: "第一集",
        script: "",
        outline: "",
        hook: "",
        nextPreview: "",
        sourceRange: "",
        reviewStatus: "visual_ready",
        shots: [
            {
                id: "shot-one",
                code: "SH001",
                order: 1,
                title: "门前",
                description: "角色站立",
                sourceText: "角色站立",
                shotBoundary: "",
                dialogue: "",
                narration: "",
                utterances: [],
                imagePrompt: "9:16门前",
                videoPrompt: "Karin站在门前",
                performancePlan: {
                    emotionalObjective: "保持警觉",
                    emotionalArc: "平静到紧张",
                    speechStyle: "低声",
                    pace: "慢速",
                    breath: "屏息",
                    restraintLevel: "克制",
                    beats: {
                        start: { emotion: "平静", facialAction: "眉眼放松", gaze: "向前", bodyAction: "站定" },
                        middle: { emotion: "紧张", facialAction: "眉心收紧", gaze: "移开", bodyAction: "肩部绷紧" },
                        end: { emotion: "压制", facialAction: "嘴角压住", gaze: "锁定", bodyAction: "后退" },
                    },
                },
                lightingPlan: {
                    palette: "冷灰",
                    colorTemperature: "4200K",
                    keyLight: "左上冷光",
                    fillLight: "低补光",
                    rimLight: "蓝轮廓",
                    contrast: "中高",
                    materialResponse: "湿地反射",
                    skinToneProtection: "保留肤色",
                    inheritFromPrevious: "无",
                    transitionToNext: "延续",
                },
                cameraMotion: "固定",
                framePlan: { start: { source: "independent" }, end: { required: true }, frames: [{ id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 15, actionPrompt: "Karin站在门前", imagePrompt: "9:16门前" }] },
                duration: 15,
                characterIds: ["character-one"],
                propIds: ["prop-one"],
                clueIds: [],
                sceneId: "scene-one",
            },
        ],
    };
    return {
        id: "project-one",
        title: "项目",
        summary: "",
        style: "写实",
        ratio: "9:16",
        status: "active",
        defaultVideoMode: "storyboard",
        activeEpisodeId: episode.id,
        characters: [{ id: "character-one", name: "Karin", description: "" }],
        scenes: [{ id: "scene-one", name: "城门", description: "" }],
        props: [{ id: "prop-one", name: "断剑", description: "", profile: { visualIdentity: "", styling: "", colorPalette: "", consistencyRules: "", identityAnchors: ["剑"] } }],
        clues: [],
        episodes: [episode],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
    };
}
