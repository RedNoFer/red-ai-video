import { describe, expect, it } from "vitest";

import { createFrameEvidence } from "@/lib/drama-continuity-policy";
import type { DramaEpisode, DramaProject } from "@/lib/drama-project-contract";
import { buildDramaVisualProductionRun, compileDramaVisualStepPrompt, unlockDramaVisualSteps } from "./drama-visual-production-run";

describe("drama director visual plan", () => {
    it("plans missing asset anchors before storyboard frames without charging", () => {
        const project = fixture();
        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", imageChannelId: "image-channel", imageQuality: "2k" });
        expect(run).toMatchObject({ status: "ready", scope: "visual", parameterSnapshot: { imageModel: "image-pro", imageChannelId: "image-channel", ratio: "9:16" } });
        expect(run.steps.map((step) => ({ id: step.id, status: step.status, dependsOn: step.dependsOn }))).toEqual([
            { id: "asset-character-one", status: "ready", dependsOn: [] },
            { id: "asset-scene-one", status: "success", dependsOn: [] },
            { id: "start-shot-one", status: "blocked", dependsOn: ["asset-scene-one", "asset-character-one"] },
            { id: "end-shot-one", status: "blocked", dependsOn: ["start-shot-one"] },
        ]);
    });

    it("unlocks dependent frames and completes only after every visual step succeeds", () => {
        const project = fixture();
        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro" });
        run.confirmedAt = new Date().toISOString();
        run.steps[0] = { ...run.steps[0], status: "success", outputUrls: ["/api/generated/character.png"] };
        const unlocked = unlockDramaVisualSteps(run);
        expect(unlocked.steps.find((step) => step.id === "start-shot-one")?.status).toBe("ready");
        expect(unlocked.status).toBe("running");
    });

    it("changes the plan identity when the image channel changes", () => {
        const project = fixture();
        const first = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", imageChannelId: "channel-one" });
        const second = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", imageChannelId: "channel-two" });
        expect(first.planRevision).not.toBe(second.planRevision);
    });

    it("scopes agent frame plans to the selected shot and keeps clue/source references", () => {
        const project = fixture();
        const episode = {
            ...project.episodes[0],
            shots: [
                ...project.episodes[0].shots,
                { ...project.episodes[0].shots[0], id: "shot-two", title: "追逐", order: 2, characterIds: [], sceneId: undefined, propIds: [], clueIds: ["clue-one"], sourceAssetIds: ["source-one"], storyboardFrameMode: "single" as const },
            ],
        };
        const run = buildDramaVisualProductionRun(
            { ...project, clues: [{ id: "clue-one", name: "裂剑", description: "断裂的剑", payoff: "揭示身份" }], sourceAssets: [{ id: "source-one", type: "image", title: "原始设定图", serverUrl: "/api/source.png" }] },
            episode,
            { imageModel: "image-pro", shotIds: ["shot-two"] },
        );

        expect(run.steps.map((step) => step.shotId || step.assetId)).toEqual(["shot-two"]);
        expect(run.steps.find((step) => step.type === "start_frame")?.referenceAssetIds).toEqual(["clue-one", "source-one"]);
    });

    it("uses maintained image references instead of inferred asset anchors", () => {
        const project = fixture();
        const shot = project.episodes[0].shots[0];
        const manualReferenceImages = [{ id: "scene-one:rain", url: "/api/reference-assets/rain.png", label: "场景基准图", binding: "锁定雨巷空间与主光方向" }];
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [],
            manualReferenceImages,
        };

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro" });

        expect(run.steps.filter((step) => step.type === "asset_anchor")).toHaveLength(0);
        expect(run.steps.find((step) => step.type === "start_frame")).toMatchObject({ referenceAssetIds: [], manualReferenceImages });
    });

    it("carries the previous shot actual tail into an Agent storyboard start frame", () => {
        const project = fixture();
        const reference = { id: "character-ref", url: "/api/reference-assets/character.png", source: "generated" as const, status: "approved" as const, label: "已审核", createdAt: new Date(0).toISOString() };
        project.characters[0].references = [reference];
        project.characters[0].primaryReferenceId = reference.id;
        project.episodes[0].continuityEdges = [{ fromShotId: "shot-one", toShotId: "shot-two", transition: "continuous", inheritActualEndFrame: true, carryCharacterIds: [], carryPropIds: [], carryEnvironment: true, carryAxis: true }];
        project.episodes[0].shots.push({ ...project.episodes[0].shots[0], id: "shot-two", title: "继续", order: 2, actualEndFrameUrl: undefined });
        project.episodes[0].shots[0].videoUrl = "/api/reference-assets/shot-one.mp4";
        project.episodes[0].shots[0].frameEvidence = [
            createFrameEvidence({ role: "actual_end", source: "video_extraction", mediaUrl: "/api/reference-assets/shot-one-tail.png", sourceVideoUrl: project.episodes[0].shots[0].videoUrl, validity: "accepted" }),
        ];

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", shotIds: ["shot-two"] });
        const start = run.steps.find((step) => step.shotId === "shot-two" && step.type === "start_frame")!;

        expect(start.referenceShotId).toBe("shot-one");
        expect(start.referenceImageUrls).toEqual(["/api/reference-assets/shot-one-tail.png"]);
        expect(start.status).toBe("blocked");
        expect(start.prompt).toContain("静态关键帧：");
        expect(start.prompt).toContain("三层空间：");
        expect(compileDramaVisualStepPrompt(project, project.episodes[0], start)).toContain("上一镜成片实际尾帧是唯一开场依据");
    });

    it("compiles the next storyboard prompt from its own entry state instead of the previous prompt text", () => {
        const project = fixture();
        const first = project.episodes[0].shots[0];
        first.continuity = {
            shotSize: "中景",
            cameraAngle: "平视",
            composition: "居中",
            characterBlocking: "车厢内",
            gazeDirection: "向前",
            actionStart: "黑湖、倒塔、四手与裂剑",
            actionEnd: "黑湖、倒塔、四手与裂剑",
            screenDirection: "向右",
            axisRule: "不越轴",
            continuityNotes: "连续",
        };
        first.endFramePrompt = "Karin在马车中惊醒，手扣断剑，呼吸急促";
        project.episodes[0].continuityEdges = [{ fromShotId: "shot-one", toShotId: "shot-two", transition: "continuous", inheritActualEndFrame: true, carryCharacterIds: [], carryPropIds: [], carryEnvironment: true, carryAxis: true }];
        project.episodes[0].shots.push({
            ...first,
            id: "shot-two",
            title: "继续",
            order: 2,
            startFramePrompt: "黑湖、倒塔、四手与裂剑，动作起始状态",
            entryState: { environment: "马车内", lighting: "冷白窗光", characters: [], props: [] },
            exitState: { environment: "马车内", lighting: "冷白窗光", characters: [], props: [] },
            framePlan: {
                start: { source: "previous_accepted_actual_tail" },
                end: { required: true },
                frames: [{ id: "shot-two-frame-one", sequenceIndex: 1, startSecond: 0, endSecond: first.duration, actionPrompt: first.videoPrompt, imagePrompt: first.imagePrompt }],
            },
        });

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", shotIds: ["shot-two"] });

        expect(run.steps.find((step) => step.type === "start_frame")?.prompt).toContain("静态关键帧：");
        expect(run.steps.find((step) => step.type === "start_frame")?.prompt).toContain("站位与视线：车厢内；向前");
        expect(run.steps.find((step) => step.type === "start_frame")?.prompt).not.toContain("Karin在马车中惊醒，手扣断剑，呼吸急促");
    });

    it("submits only the explicitly requested frame type", () => {
        const project = fixture();
        const startOnly = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "start_frame" });
        project.episodes[0].shots[0].frameEvidence = [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/generated/start.png", validity: "candidate" })];
        const endOnly = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "end_frame" });

        expect(startOnly.steps.map((step) => step.type)).not.toContain("end_frame");
        expect(endOnly.steps.find((step) => step.type === "start_frame")?.status).toBe("success");
        expect(endOnly.steps.filter((step) => step.type === "end_frame")).toHaveLength(1);
    });

    it("plans one sequential task per frame beat without an extra start candidate", () => {
        const project = fixture();
        project.episodes[0].shots[0].storyboardFrameMode = "all_frames";
        project.episodes[0].shots[0].framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: [
                { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "相遇", imagePrompt: "两人在雨夜对视" },
                { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 5, actionPrompt: "靠近", imagePrompt: "两人缩短距离" },
            ],
        };
        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "all_frames" });
        const frames = run.steps.filter((step) => step.shotId === "shot-one");
        expect(frames.map((step) => ({ id: step.id, type: step.type, status: step.status }))).toEqual([
            { id: "frame-shot-one-f1", type: "keyframe", status: "blocked" },
            { id: "frame-shot-one-f2", type: "keyframe", status: "blocked" },
        ]);
        expect(frames[1].dependsOn).toEqual(["frame-shot-one-f1"]);
        expect(frames[0].prompt).not.toMatch(/P01-F01|0-2s/u);
        expect(frames[0].prompt).toContain("静态关键帧：");
        expect(frames[1].prompt).toContain("静态关键帧：两人在雨夜相遇");
        expect(frames[1].prompt).toContain("可见表演状态：");
    });

    it("binds each storyboard frame to the scene visible in that frame", () => {
        const project = fixture();
        project.scenes[0] = { ...project.scenes[0], name: "黑湖记忆", description: "无风黑湖与倒悬古塔" };
        project.scenes.push({ id: "scene-carriage", name: "前往阿佐雷斯的马车", description: "中世纪封闭木马车", profile: { visualIdentity: "左右长凳与车窗", styling: "木质车厢", colorPalette: "冷灰", consistencyRules: "车窗在右侧" } });
        const shot = project.episodes[0].shots[0];
        shot.sceneId = "scene-one";
        shot.storyboardFrameMode = "all_frames";
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: [
                { id: "lake", sequenceIndex: 1, startSecond: 0, endSecond: 3, actionPrompt: "黑湖中的断剑裂开", imagePrompt: "静态关键帧：黑湖与倒悬古塔，断剑已经裂开" },
                { id: "carriage", sequenceIndex: 2, startSecond: 3, endSecond: 6, actionPrompt: "马车中Karin惊醒", imagePrompt: "静态关键帧：马车内Karin完全惊醒，手扣住断剑" },
            ],
            referenceManifest: [
                { alias: "@湖", role: "scene_anchor", purpose: "黑湖场景", assetId: "scene-one" },
                { alias: "@车", role: "scene_anchor", purpose: "马车场景", assetId: "scene-carriage" },
            ],
        };

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "all_frames" });
        const lakeReferences = run.steps.find((step) => step.frameId === "lake")?.referenceAssetIds || [];
        const carriageReferences = run.steps.find((step) => step.frameId === "carriage")?.referenceAssetIds || [];
        expect(lakeReferences.filter((id) => id.startsWith("scene-"))).toEqual(["scene-one"]);
        expect(carriageReferences.filter((id) => id.startsWith("scene-"))).toEqual(["scene-carriage"]);
        expect(run.steps.find((step) => step.frameId === "carriage")?.dependsOn).toContain("asset-scene-carriage");
    });

    it("recovers a frame scene anchor missing from a legacy manifest", () => {
        const project = fixture();
        project.scenes[0] = { ...project.scenes[0], name: "黑湖记忆", description: "无风黑湖与倒悬古塔" };
        project.scenes.push({
            id: "scene-carriage",
            name: "前往阿佐雷斯的马车",
            description: "中世纪封闭木马车，左右长凳与右侧竖向车窗",
            profile: { visualIdentity: "左右长凳、右侧竖窗", styling: "木质车厢", colorPalette: "冷灰", consistencyRules: "车窗在右侧" },
        });
        const shot = project.episodes[0].shots[0];
        shot.sceneId = "scene-one";
        shot.storyboardFrameMode = "all_frames";
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: [{ id: "carriage", sequenceIndex: 1, startSecond: 0, endSecond: 6, actionPrompt: "马车中Karin惊醒", imagePrompt: "静态关键帧：马车内Karin完全惊醒，手扣住断剑" }],
            referenceManifest: [{ alias: "@湖", role: "scene_anchor", purpose: "黑湖场景", assetId: "scene-one" }],
        };

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "all_frames" });
        const frame = run.steps.find((step) => step.frameId === "carriage")!;

        expect(frame.referenceAssetIds?.filter((id) => id.startsWith("scene-"))).toEqual(["scene-carriage"]);
        expect(frame.referenceManifest).toEqual(expect.arrayContaining([expect.objectContaining({ role: "scene_anchor", assetId: "scene-carriage" })]));
        expect(frame.referenceManifest).not.toEqual(expect.arrayContaining([expect.objectContaining({ role: "scene_anchor", assetId: "scene-one" })]));
        expect(frame.dependsOn).toContain("asset-scene-carriage");
    });

    it("injects the previous generated frame when unlocking the next beat", () => {
        const project = fixture();
        project.characters[0].references = [{ id: "approved", url: "/api/character.png", source: "generated", status: "approved", label: "角色", createdAt: new Date(0).toISOString() }];
        project.characters[0].primaryReferenceId = "approved";
        project.episodes[0].shots[0].storyboardFrameMode = "all_frames";
        project.episodes[0].shots[0].framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: [
                { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "相遇", imagePrompt: "对视" },
                { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 5, actionPrompt: "靠近", imagePrompt: "靠近" },
            ],
        };
        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "all_frames" });
        const first = run.steps.find((step) => step.frameId === "f1")!;
        const ready = unlockDramaVisualSteps({
            ...run,
            confirmedAt: new Date().toISOString(),
            steps: run.steps.map((step) => (step.id === first.id ? { ...step, status: "success" as const, outputUrls: ["/api/f1.png"], outputRemoteUrls: ["https://cdn.example/f1.png"] } : step)),
        });
        expect(ready.steps.find((step) => step.frameId === "f2")).toMatchObject({ status: "ready", referenceImageUrls: ["/api/f1.png"], referenceImageRemoteUrls: ["https://cdn.example/f1.png"] });
    });

    it("does not unlock an unselected later frame after a single-frame request completes", () => {
        const project = fixture();
        project.characters[0].references = [{ id: "approved", url: "/api/character.png", source: "generated", status: "approved", label: "角色", createdAt: new Date(0).toISOString() }];
        project.characters[0].primaryReferenceId = "approved";
        project.episodes[0].shots[0].storyboardFrameMode = "all_frames";
        project.episodes[0].shots[0].framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [
                { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "相遇", imagePrompt: "对视" },
                { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 5, actionPrompt: "靠近", imagePrompt: "靠近" },
            ],
        };

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "all_frames", frameIds: ["f1"] });
        const first = run.steps.find((step) => step.frameId === "f1")!;
        const unlocked = unlockDramaVisualSteps({
            ...run,
            confirmedAt: new Date().toISOString(),
            steps: run.steps.map((step) => (step.id === first.id ? { ...step, status: "success" as const, outputUrls: ["/api/f1.png"] } : step)),
        });

        expect(unlocked.steps.find((step) => step.frameId === "f2")?.status).toBe("stale");
    });

    it("dispatches a selected later frame without generating its missing predecessors", () => {
        const project = fixture();
        project.characters[0].references = [{ id: "approved", url: "/api/character.png", source: "generated", status: "approved", label: "角色", createdAt: new Date(0).toISOString() }];
        project.characters[0].primaryReferenceId = "approved";
        project.episodes[0].shots[0].storyboardFrameMode = "all_frames";
        project.episodes[0].shots[0].framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [
                { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "相遇", imagePrompt: "对视" },
                { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 5, actionPrompt: "靠近", imagePrompt: "靠近" },
            ],
        };

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "all_frames", frameIds: ["f2"] });
        const unlocked = unlockDramaVisualSteps({ ...run, confirmedAt: new Date().toISOString() });

        expect(unlocked.steps.find((step) => step.frameId === "f1")?.status).toBe("stale");
        expect(unlocked.steps.find((step) => step.frameId === "f2")?.status).toBe("ready");
    });

    it("uses the generated start frame as the end-frame continuity reference", () => {
        const project = fixture();
        project.characters[0].references = [{ id: "approved", url: "/api/character.png", source: "generated", status: "approved", label: "角色", createdAt: new Date(0).toISOString() }];
        project.characters[0].primaryReferenceId = "approved";
        project.episodes[0].shots[0].frameEvidence = [createFrameEvidence({ role: "storyboard_start", source: "generated", mediaUrl: "/api/start.png", validity: "candidate" })];

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "end_frame" });
        const ready = unlockDramaVisualSteps({ ...run, confirmedAt: new Date().toISOString() });

        expect(ready.steps.find((step) => step.type === "end_frame")).toMatchObject({ status: "ready", referenceImageUrls: ["/api/start.png"] });
    });

    it("regenerates an explicitly selected valid frame without submitting later frames", () => {
        const project = fixture();
        project.characters[0].references = [{ id: "approved", url: "/api/character.png", source: "generated", status: "approved", label: "角色", createdAt: new Date(0).toISOString() }];
        project.characters[0].primaryReferenceId = "approved";
        const shot = project.episodes[0].shots[0];
        shot.storyboardFrameMode = "all_frames";
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [
                { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "相遇", imagePrompt: "对视" },
                { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 5, actionPrompt: "靠近", imagePrompt: "靠近" },
            ],
        };
        shot.storyboardFrames = [
            { id: "f1", sequenceIndex: 1, mediaUrl: "/api/f1.png", source: "upload", status: "success", continuityStatus: "passed" },
            { id: "f2", sequenceIndex: 2, mediaUrl: "/api/f2.png", source: "upload", status: "success", continuityStatus: "passed" },
        ];

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "all_frames", frameIds: ["f1"] });
        const ready = unlockDramaVisualSteps({ ...run, confirmedAt: new Date().toISOString() });

        expect(ready.steps.find((step) => step.frameId === "f1")?.status).toBe("ready");
        expect(ready.steps.find((step) => step.frameId === "f2")?.status).toBe("success");
    });

    it("stops a sequence in needs review even while later frames remain blocked", () => {
        const project = fixture();
        project.episodes[0].shots[0].storyboardFrameMode = "all_frames";
        project.episodes[0].shots[0].framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [
                { id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "相遇", imagePrompt: "对视" },
                { id: "f2", sequenceIndex: 2, startSecond: 2, endSecond: 5, actionPrompt: "靠近", imagePrompt: "靠近" },
            ],
        };
        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", frameType: "all_frames" });
        run.confirmedAt = new Date().toISOString();
        const stopped = unlockDramaVisualSteps({ ...run, steps: run.steps.map((step) => (step.frameId === "f1" ? { ...step, status: "needs_review" as const, error: "人物身份漂移" } : step)) });

        expect(stopped.status).toBe("needs_review");
        expect(stopped.steps.find((step) => step.frameId === "f2")?.status).toBe("blocked");
    });

    it("blocks a tail frame extracted from an older video version", () => {
        const project = fixture();
        project.episodes[0].continuityEdges = [{ fromShotId: "shot-one", toShotId: "shot-two", transition: "continuous", inheritActualEndFrame: true, carryCharacterIds: [], carryPropIds: [], carryEnvironment: true, carryAxis: true }];
        project.episodes[0].shots.push({ ...project.episodes[0].shots[0], id: "shot-two", title: "继续", order: 2, actualEndFrameUrl: undefined });
        project.episodes[0].shots[0].videoUrl = "/api/reference-assets/shot-one-new.mp4";
        project.episodes[0].shots[0].actualEndFrameUrl = "/api/reference-assets/shot-one-old-tail.png";
        project.episodes[0].shots[0].actualFrameVideoUrl = "/api/reference-assets/shot-one-old.mp4";
        project.episodes[0].shots[0].continuityStatus = "passed";

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro", shotIds: ["shot-two"] });
        const start = run.steps.find((step) => step.shotId === "shot-two" && step.type === "start_frame")!;

        expect(start.referenceImageUrls).toBeUndefined();
        expect(start.status).toBe("blocked");
    });

    it("recompiles storyboard frames instead of submitting legacy execution prompt caches", () => {
        const project = fixture();
        project.style = "VS14 中世纪史诗学院奇幻";
        project.episodes[0].shots[0].executionImagePrompt = "旧版 VS14 分镜图，中性浅灰背景，多视角设定板";

        const run = buildDramaVisualProductionRun(project, project.episodes[0], { imageModel: "image-pro" });
        const framePrompts = run.steps.filter((step) => step.type === "start_frame" || step.type === "end_frame").map((step) => step.prompt || "");

        expect(framePrompts.every((prompt) => prompt.includes("光色与风格："))).toBe(true);
        expect(framePrompts.join("\n")).toContain("VS14 中世纪史诗学院奇幻");
        expect(framePrompts.join("\n")).not.toContain("中性浅灰背景");
    });

    it("recompiles a persisted visual step before retrying it", () => {
        const project = fixture();
        project.style = "VS14 中世纪史诗学院奇幻";
        const step = { id: "start-shot-one", type: "start_frame" as const, shotId: "shot-one", prompt: "旧版 VS14，中性浅灰背景", dependsOn: [], status: "ready" as const };

        const prompt = compileDramaVisualStepPrompt(project, project.episodes[0], step);

        expect(prompt).toContain("光色与风格：");
        expect(prompt).toContain("VS14 中世纪史诗学院奇幻");
    });
});

function fixture(): DramaProject {
    const episode: DramaEpisode = {
        id: "episode-one",
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
                order: 1,
                title: "相遇",
                description: "两人在雨夜相遇",
                sourceText: "",
                shotBoundary: "",
                dialogue: "",
                narration: "",
                utterances: [],
                imagePrompt: "雨夜中景",
                videoPrompt: "靠近",
                cameraMotion: "固定",
                duration: 5,
                characterIds: ["character-one"],
                propIds: [],
                clueIds: [],
                sceneId: "scene-one",
                storyboardFrameMode: "first_last",
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
        characters: [{ id: "character-one", name: "阿青", description: "青年" }],
        scenes: [
            {
                id: "scene-one",
                name: "雨巷",
                description: "夜晚",
                references: [{ id: "rain", url: "/api/reference-assets/rain.png", source: "library", status: "approved", label: "基准", createdAt: "2026-01-01T00:00:00.000Z" }],
                primaryReferenceId: "rain",
            },
        ],
        props: [],
        clues: [],
        episodes: [episode],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}
