import { buildVideoReferenceBindings, compileDramaVideoSubmissionPrompt } from "@/lib/drama-video-submission";
import { describe, expect, it } from "vitest";
import type { DramaProject, DramaShot } from "@/lib/drama-project-contract";
import { validateDramaReferenceSelections } from "./drama-project-service";
import { buildDramaProductionRun, refreshDramaVideoStepReferences } from "./drama-production-run";

const character = { id: "extra-character", name: "同伴", description: "成年同伴", primaryReferenceId: "character-image", references: [{ id: "character-image", status: "approved", url: "/character.png" }] };
const scene = {
    id: "extra-scene",
    name: "车厢",
    description: "单视角全景",
    primaryReferenceId: "scene-image",
    references: [{ id: "scene-image", status: "approved", url: "/scene.png" }],
    sceneReferenceBoard: { layout: "panorama", referenceId: "scene-image" },
};
function fixture() {
    const shot = { id: "shot", title: "镜头", order: 1, duration: 15, characterIds: [], propIds: [], clueIds: [], sourceAssetIds: [], videoPrompt: "车厢中的人物抬眼观察", utterances: [], dialogue: "", audioMode: "source" } as unknown as DramaShot;
    const project = { id: "project", title: "测试", style: "写实", ratio: "16:9", characters: [character], scenes: [scene], props: [], clues: [], episodes: [{ id: "episode", shots: [shot], continuityEdges: [] }] } as unknown as DramaProject;
    return { project: structuredClone(project), shot, episode: project.episodes[0] };
}

describe("manual fixed asset reference selection", () => {
    it("keeps the edited prompt through persistence and reference refresh without restoring the project prompt", () => {
        const { project, episode, shot } = fixture();
        const edited = "总体风格：自然摄影。\n0–15秒：同伴在车窗左侧抬起右手，衣袖擦过玻璃后停住。\n音效：短促衣料摩擦。";
        const parameters = { imageModel: "image", videoModel: "video", referenceSelections: { [shot.id]: ["extra-character"] }, videoPrompts: { [shot.id]: edited } };
        const run = JSON.parse(JSON.stringify(buildDramaProductionRun(project, episode, parameters)));
        const step = run.steps.find((item: { type: string }) => item.type === "video");
        expect(step.prompt).toBe(edited);
        const refreshed = refreshDramaVideoStepReferences(project, episode, step, run.parameterSnapshot.videoPrompts[shot.id]);
        expect(refreshed.prompt).toBe(edited);
        expect(refreshed.referenceBindingsSnapshot).toEqual(step.referenceBindingsSnapshot);
        expect(shot.videoPrompt).toBe("车厢中的人物抬眼观察");
        expect(buildDramaProductionRun(project, episode, { ...parameters, videoPrompts: { [shot.id]: `${edited}\n尾帧停在手背。` } }).planRevision).not.toBe(run.planRevision);
    });
    it("validates unbound approved assets and retains their identity and order through dispatch snapshots", () => {
        const { project, episode, shot } = fixture();
        const referenceSelections = { [shot.id]: ["extra-character", "extra-scene"] };
        expect(() => validateDramaReferenceSelections(project, episode, [shot], referenceSelections)).not.toThrow();
        const run = buildDramaProductionRun(project, episode, { imageModel: "image", videoModel: "video", referenceSelections });
        const step = run.steps.find((item) => item.type === "video")!;
        expect(step.referenceAssetIds).toEqual(["extra-character", "extra-scene"]);
        expect(step.referenceBindingsSnapshot).toMatchObject([
            { alias: "@图片1", sourceId: "extra-character", role: "character_anchor", url: "/character.png" },
            { alias: "@图片2", sourceId: "extra-scene", role: "scene_anchor", url: "/scene.png" },
        ]);
        expect(refreshDramaVideoStepReferences(project, episode, step).referenceBindingsSnapshot).toEqual(step.referenceBindingsSnapshot);
        expect(run.steps.filter((item) => item.type === "asset_anchor").every((item) => item.status === "success")).toBe(true);
        expect(shot.characterIds).toEqual([]);
    });

    it("labels assets and renumbers the actual selected manifest order", () => {
        const { project, shot } = fixture();
        shot.framePlan = {
            referenceManifest: [
                { alias: "@图片5", role: "scene_anchor", assetId: "extra-scene", purpose: "项目资产基准图" },
                { alias: "@图片8", role: "character_anchor", assetId: "extra-character", purpose: "人物固定图" },
            ],
        } as never;
        project.characters[0].voiceProfile = { timbrePrompt: "低沉克制，普通话清晰", speed: 1, instructions: "" };
        const ids = ["extra-character", "extra-scene"];
        const bindings = buildVideoReferenceBindings(project, shot, [], ids);
        const prompt = compileDramaVideoSubmissionPrompt("人物扶住车门。", project, shot, bindings, ids);
        expect(prompt).toContain("@图片1：场景「车厢」\n@图片2：角色「同伴」");
        expect(prompt).toContain("低沉克制，普通话清晰");
        expect(prompt).not.toContain("项目资产基准图");
        expect(compileDramaVideoSubmissionPrompt(prompt, project, shot, bindings, ids)).toBe(prompt);
        const selected = buildVideoReferenceBindings(project, shot, [], ["extra-character"]);
        expect(selected).toMatchObject([{ alias: "@图片1", sourceId: "extra-character" }]);
        const changed = compileDramaVideoSubmissionPrompt(`${prompt}\n作者补充：保持窗外路灯位置。`, project, shot, selected, ["extra-character"]);
        expect(changed).toContain("人物扶住车门。\n作者补充：保持窗外路灯位置。\n【参考图片】\n@图片1：角色「同伴」");
        expect(changed).not.toContain("场景「车厢」");
    });

    it("accepts nine images and rejects ten before creating a 30-second supplier task", () => {
        const { project, episode, shot } = fixture();
        shot.duration = 30;
        project.characters = Array.from({ length: 10 }, (_, index) => ({ ...project.characters[0], id: `role-${index}` }));
        const ids = project.characters.map((item) => item.id);
        expect(() => validateDramaReferenceSelections(project, episode, [shot], { [shot.id]: ids.slice(0, 9) }, 9)).not.toThrow();
        expect(() => validateDramaReferenceSelections(project, episode, [shot], { [shot.id]: ids }, 9)).toThrow("超过当前模型的 9 张上限");
    });

    it.each(["unknown", "extra-character", "extra-scene"])("rejects foreign or unconfirmed reference %s", (id) => {
        const { project, episode, shot } = fixture();
        project.characters[0].primaryReferenceId = undefined;
        project.scenes[0].sceneReferenceBoard = { layout: "legacy-3x3" };
        project.scenes[0].description = "九宫格场景";
        expect(() => validateDramaReferenceSelections(project, episode, [shot], { [shot.id]: [id] })).toThrow("无效的参考图选择");
    });
});
