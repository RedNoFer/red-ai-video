import { describe, expect, it } from "vitest";

import type { DramaEpisode, DramaProject, DramaShot } from "@/lib/drama-project-contract";
import { preflightDramaProduction } from "@/lib/server/drama-production-preflight";

describe("drama production preflight", () => {
    it("blocks paid production before canon assets and executable continuity are ready", () => {
        const project = fixture();
        const result = preflightDramaProduction(project, project.episodes[0]);
        expect(result.status).toBe("blocked");
        expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["SERIES_BIBLE", "CHARACTER_ANCHOR", "CHARACTER_STATE"]));
    });

    it("passes a short shot with locked references and complete states", () => {
        const project = fixture();
        const reference = { id: "ref-one", url: "/api/media/ref.png", source: "generated" as const, status: "approved" as const, label: "已审核", createdAt: new Date(0).toISOString() };
        project.seriesBible = { version: "series-bible-v1", canonCharacters: ["C01"], immutableRules: ["不可换脸"], relationshipState: "同伴", worldRules: ["记忆可附着在器物"], unresolvedThreads: [], visualMotifs: [], soundMotifs: [] };
        project.characters[0].references = [reference];
        project.characters[0].primaryReferenceId = reference.id;
        project.scenes[0].references = [reference];
        project.scenes[0].primaryReferenceId = reference.id;
        project.props[0].references = [reference];
        project.props[0].primaryReferenceId = reference.id;
        project.episodes[0].shots[0].duration = 6;
        const state = {
            characters: [{ assetId: "character-one", position: "画面左侧", gaze: "向右", pose: "站立", action: "静止" }],
            props: [{ assetId: "prop-one", state: "入鞘", holderId: "character-one" }],
            environment: "城门",
            lighting: "左上冷光",
            axis: "180度轴线",
            screenDirection: "左到右",
        };
        project.episodes[0].shots[0].entryState = state;
        project.episodes[0].shots[0].exitState = state;
        project.episodes[0].shots[0].continuityStatus = "passed";
        const result = preflightDramaProduction(project, project.episodes[0]);
        expect(result.status).toBe("needs_confirmation");
        expect(result.issues.filter((issue) => issue.severity === "blocking")).toEqual([]);
    });

    it("blocks names introduced by prompts without shot references", () => {
        const project = fixture();
        project.characters.push({ id: "character-two", code: "C02", name: "Rifa", description: "", activeEpisodeCodes: ["E01"] });
        project.props.push({ id: "prop-two", code: "P02", name: "银戒", description: "" });
        project.episodes[0].shots[0].videoPrompt += "，Rifa举起银戒";
        const codes = preflightDramaProduction(project, project.episodes[0]).issues.map((issue) => issue.code);
        expect(codes).toEqual(expect.arrayContaining(["PROMPT_CHARACTER_REFERENCE", "PROMPT_PROP_REFERENCE"]));
    });

    it("blocks a reference manifest whose scene or declared assets do not match the shot", () => {
        const project = fixture();
        project.episodes[0].shots[0].framePlan!.referenceManifest = [
            { alias: "@场景", role: "scene_anchor", purpose: "错误场景", assetId: "scene-wrong" },
            { alias: "@角色", role: "character_anchor", purpose: "角色基准", assetId: "character-one" },
        ];
        const issues = preflightDramaProduction(project, project.episodes[0]).issues;
        expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "REFERENCE_MANIFEST_SCENE", severity: "blocking" })]));
        expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "REFERENCE_MANIFEST_PROP", severity: "blocking", assetId: "prop-one" })]));
    });

    it("does not treat characters named only inside negative prompt constraints as references", () => {
        const project = fixture();
        project.characters.push({ id: "character-two", code: "C02", name: "Ras", description: "", activeEpisodeCodes: [] });
        project.characters.push({ id: "character-three", code: "C03", name: "Ref", description: "", activeEpisodeCodes: [] });
        project.episodes[0].shots[0].videoPrompt += "，无可辨识的Ras或Ref、无额外角色";
        const issues = preflightDramaProduction(project, project.episodes[0]).issues;
        expect(issues.some((issue) => issue.code === "INACTIVE_CHARACTER" || issue.code === "PROMPT_CHARACTER_REFERENCE")).toBe(false);
    });

    it("keeps an explicit storyboard shot out of a project reference-plan gate", () => {
        const project = fixture();
        project.productionBible = {
            language: "中文",
            ratio: project.ratio,
            visualStyle: project.style,
            continuityMode: "strict",
            productionPlan: {
                version: "drama-production-plan-v1",
                skills: [],
                video: { model: "video", mode: "reference", ratio: project.ratio, resolution: "720p", durationPolicy: "shot", count: 1, audioMode: "native", allowExplicitFallback: false },
                references: { strategy: "adaptive", minImages: 3, maxImages: 5, roles: [] },
                continuity: { mode: "strict", requireAcceptedActualTail: true },
                lockedAt: new Date(0).toISOString(),
                source: "manual",
            },
        } as never;
        project.episodes[0].shots[0].videoMode = "storyboard";
        const codes = preflightDramaProduction(project, project.episodes[0]).issues.map((issue) => issue.code);
        expect(codes).not.toContain("REFERENCE_MANIFEST_COUNT");
    });

    it("returns confirmation status for soft framing risks instead of blocking production", () => {
        const project = fixture();
        const reference = { id: "ref-one", url: "/api/media/ref.png", source: "generated" as const, status: "approved" as const, label: "已审核", createdAt: new Date(0).toISOString() };
        project.seriesBible = { version: "series-bible-v1", canonCharacters: [], immutableRules: [], relationshipState: "", worldRules: [], unresolvedThreads: [], visualMotifs: [], soundMotifs: [] };
        project.characters[0].references = [reference];
        project.characters[0].primaryReferenceId = reference.id;
        project.scenes[0].references = [reference];
        project.scenes[0].primaryReferenceId = reference.id;
        project.props[0].references = [reference];
        project.props[0].primaryReferenceId = reference.id;
        project.episodes[0].shots[0].duration = 6;
        const state = {
            characters: [{ assetId: "character-one", position: "左侧", gaze: "向右", pose: "站立", action: "静止" }],
            props: [{ assetId: "prop-one", state: "入鞘", holderId: "character-one" }],
            environment: "城门",
            lighting: "冷光",
            axis: "180度",
            screenDirection: "左到右",
        };
        project.episodes[0].shots[0].entryState = state;
        project.episodes[0].shots[0].exitState = state;
        project.episodes[0].shots[0].continuityStatus = "passed";
        const result = preflightDramaProduction(project, project.episodes[0]);
        expect(result.status).toBe("needs_confirmation");
        expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "FRAMING_UNCLEAR", severity: "warning" })]));
    });

    it("warns when adjacent carried states conflict", () => {
        const project = fixture();
        const first = project.episodes[0].shots[0];
        const second = {
            ...first,
            id: "shot-two",
            code: "SH002",
            order: 2,
            entryState: {
                characters: [{ assetId: "character-one", position: "右侧", gaze: "向左", pose: "站立", action: "静止", wardrobe: "白袍" }],
                props: [{ assetId: "prop-one", state: "断裂", holderId: "character-one" }],
                environment: "雪地",
                lighting: "冷光",
                axis: "反打轴",
                screenDirection: "右到左",
            },
        };
        first.exitState = {
            characters: [{ assetId: "character-one", position: "左侧", gaze: "向右", pose: "站立", action: "静止", wardrobe: "黑袍" }],
            props: [{ assetId: "prop-one", state: "完整", holderId: "character-one" }],
            environment: "黑湖",
            lighting: "冷光",
            axis: "正轴",
            screenDirection: "左到右",
        };
        project.episodes[0].shots.push(second);
        project.episodes[0].continuityEdges = [
            { fromShotId: first.id, toShotId: second.id, transition: "continuous", inheritActualEndFrame: false, carryCharacterIds: ["character-one"], carryPropIds: ["prop-one"], carryEnvironment: true, carryAxis: true },
        ];
        const codes = preflightDramaProduction(project, project.episodes[0]).issues.map((issue) => issue.code);
        expect(codes).toEqual(expect.arrayContaining(["ENVIRONMENT_CONTINUITY", "AXIS_CONTINUITY", "SCREEN_DIRECTION_CONTINUITY", "WARDROBE_CONTINUITY", "GAZE_CONTINUITY", "PROP_CONTINUITY"]));
    });

    it("does not validate later shots when only the first shot is being generated", () => {
        const project = fixture();
        const first = project.episodes[0].shots[0];
        project.episodes[0].shots.push({
            ...first,
            id: "shot-two",
            code: "SH002",
            order: 2,
            framePlan: { ...first.framePlan!, start: { source: "previous_accepted_actual_tail" } },
        });
        project.episodes[0].continuityEdges = [
            { fromShotId: first.id, toShotId: "shot-two", transition: "continuous", inheritActualEndFrame: true, carryCharacterIds: ["character-one"], carryPropIds: [], carryEnvironment: true, carryAxis: true },
        ];

        const result = preflightDramaProduction(project, project.episodes[0], [first.id]);

        expect(result.checkedShotIds).toEqual([first.id]);
        expect(result.issues.some((issue) => issue.shotId === "shot-two")).toBe(false);
        expect(result.issues.some((issue) => issue.message.includes("SH002需要上一镜"))).toBe(false);
    });
});

function fixture(): DramaProject {
    const shot: DramaShot = {
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
            speechStyle: "低声克制",
            pace: "慢速",
            breath: "屏息后缓慢呼气",
            restraintLevel: "高度克制",
            beats: {
                start: { emotion: "平静", facialAction: "眉眼放松", gaze: "看向门前", bodyAction: "站定" },
                middle: { emotion: "警觉", facialAction: "眉心收紧", gaze: "短暂移开", bodyAction: "肩部绷紧" },
                end: { emotion: "紧张", facialAction: "嘴角压住", gaze: "锁定门缝", bodyAction: "微微后退" },
            },
        },
        lightingPlan: {
            palette: "冷灰蓝",
            colorTemperature: "4200K",
            keyLight: "左上冷主光",
            fillLight: "低强度正面补光",
            rimLight: "背后蓝色轮廓光",
            contrast: "中高反差",
            materialResponse: "湿地面有细碎反射",
            skinToneProtection: "保留自然肤色",
            inheritFromPrevious: "无",
            transitionToNext: "冷光延续",
        },
        cameraMotion: "固定",
        duration: 15,
        characterIds: ["character-one"],
        sceneId: "scene-one",
        propIds: ["prop-one"],
        clueIds: [],
        entryState: { characters: [{ assetId: "character-one" }], props: [{ assetId: "prop-one" }], environment: "城门", lighting: "冷光" },
        exitState: { characters: [{ assetId: "character-one" }], props: [{ assetId: "prop-one" }], environment: "城门", lighting: "冷光" },
        framePlan: { start: { source: "independent" }, end: { required: true }, frames: [{ id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 15, actionPrompt: "视频", imagePrompt: "图" }] },
    };
    const episode: DramaEpisode = { id: "episode-one", code: "E01", title: "第一集", script: "", outline: "", hook: "", nextPreview: "", sourceRange: "", reviewStatus: "visual_ready", shots: [shot] };
    return {
        id: "project-one",
        title: "Mahadel",
        summary: "",
        style: "写实奇幻",
        ratio: "9:16",
        status: "active",
        defaultVideoMode: "storyboard",
        activeEpisodeId: episode.id,
        characters: [{ id: "character-one", code: "C01", name: "Karin", description: "", activeEpisodeCodes: ["E01"] }],
        scenes: [{ id: "scene-one", code: "S01", name: "城门", description: "" }],
        props: [{ id: "prop-one", code: "P01", name: "断剑", description: "", profile: { visualIdentity: "断剑", styling: "", colorPalette: "", consistencyRules: "", identityAnchors: ["不对称护手"] } }],
        clues: [],
        episodes: [episode],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
    };
}
