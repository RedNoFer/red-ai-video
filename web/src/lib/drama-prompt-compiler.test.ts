import { describe, expect, it } from "vitest";

import type { DramaEpisode, DramaProject, DramaShot } from "./drama-project-contract";
import { DRAMA_STYLE_DESCRIPTION, DRAMA_STYLE_NAME } from "./drama-style";
import { compileDramaAssetReferencePrompt, compileDramaAssetRefinementPrompt, compileDramaDialogueAudioInstructions, compileDramaShotExecutionPrompts, compileDramaShotPrompts, preflightDramaAssetGeneration } from "./drama-prompt-compiler";

describe("drama prompt compiler", () => {
    it("compiles project assets and continuity into both media prompts", () => {
        const project = createProject();
        const prompts = compileDramaShotPrompts(project, project.episodes[0], project.episodes[0].shots[0]);

        expect(prompts.imagePrompt).toContain(`统一风格：${DRAMA_STYLE_NAME}`);
        expect(prompts.imagePrompt).toContain("女主：红色外套");
        expect(prompts.imagePrompt).toContain("轴线 保持同侧");
        expect(prompts.startFramePrompt).toContain("动作起始");
        expect(prompts.endFramePrompt).toContain("动作结束");
        expect(prompts.videoPrompt).toContain("从“动作起始”自然过渡到“动作结束”");
        expect(prompts.videoPrompt).toContain(`最终视觉锁定：${DRAMA_STYLE_DESCRIPTION}`);
        expect(prompts.videoPrompt).toContain("半写实动漫幻想风");
        expect(prompts.videoPrompt).toContain("不是3D游戏渲染");
    });

    it("creates a focused asset reference brief", () => {
        const prompt = compileDramaAssetReferencePrompt(createProject(), createProject().characters[0], "角色");

        expect(prompt).toContain("角色设定图");
        expect(prompt).toContain(`统一风格：${DRAMA_STYLE_NAME}`);
        expect(prompt).toContain("巨型哥特魔法学院");
        expect(prompt).toContain("固定色彩：红黑");
        expect(prompt).toContain("不添加文字");
        expect(prompt).toContain("不要拼版、联系表、多视角");
        expect(prompt).toContain("严格保留角色的身份");
        expect(prompt).toContain("肖像级面部刻画 > 脸部比例与审美 > 五官质感 > 光线 > 服装 > 背景");
        expect(prompt).toContain("完整全身角色模型图");
        expect(prompt).toContain("脸部是最高细节区域");
        expect(prompt).toContain("双腿和鞋靴全部入画");
        expect(prompt).toContain("头部必须位于画面上方并完整出现");
        expect(prompt).toContain("负面构图词：无头、无脸、缺失头部");
        expect(prompt).toContain("半写实动漫幻想风");
    });

    it("compiles structured performance and lighting into execution prompts", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.performancePlan = {
            emotionalObjective: "掩饰恐惧",
            emotionalArc: "平静到紧张",
            speechStyle: "低声压抑",
            pace: "短促",
            breath: "先屏息再呼气",
            restraintLevel: "克制",
            beats: {
                start: { emotion: "平静", facialAction: "眉眼放松", gaze: "看向门", bodyAction: "站定" },
                middle: { emotion: "紧张", facialAction: "眉心收紧", gaze: "短暂移开", bodyAction: "肩部绷紧" },
                end: { emotion: "压回冷静", facialAction: "嘴角压住", gaze: "重新锁定", bodyAction: "微微后退" },
            },
        };
        shot.dialoguePerformance = [{ utteranceId: "u1", intent: "试探", tone: "低沉", pace: "短促", pause: "开口前半秒", emphasis: "重读怎么", facialReactionBefore: "吞咽", facialReactionDuring: "眉心收紧", facialReactionAfter: "视线移向门缝" }];
        shot.lightingPlan = {
            palette: "冷灰蓝",
            colorTemperature: "4200K",
            keyLight: "左上冷光",
            fillLight: "低强度补光",
            rimLight: "蓝色轮廓光",
            contrast: "中高反差",
            materialResponse: "湿地面反射",
            skinToneProtection: "保留肤色",
            inheritFromPrevious: "延续冷光",
            transitionToNext: "逐渐压暗",
        };
        const prompts = compileDramaShotPrompts(project, project.episodes[0], shot);
        expect(prompts.videoPrompt).toContain("表演目标：掩饰恐惧");
        expect(prompts.videoPrompt).toContain("微表情中段：情绪紧张");
        expect(prompts.videoPrompt).toContain("色彩与灯光：色板冷灰蓝");
        expect(compileDramaDialogueAudioInstructions(shot)).toContain("重读怎么");
    });

    it("keeps internal asset and holder ids out of supplier-facing prompts", () => {
        const project = createProject();
        project.characters[0].id = "character-bA6c36imfwcVQWcJhLdlB";
        project.characters[0].name = "Karin";
        project.episodes[0].shots[0].characterIds = [project.characters[0].id];
        project.episodes[0].shots[0].entryState = { characters: [{ assetId: project.characters[0].id, position: "左侧", gaze: "右方", pose: "站立", action: `持有 ${project.characters[0].id}` }], props: [{ assetId: "prop-UoZ5m2wJEjWYW6lmsmyA", state: "完整", holderId: project.characters[0].id }], environment: "天台", lighting: "冷光" };
        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], project.episodes[0].shots[0]).videoPrompt;

        expect(prompt).toContain("角色 Karin");
        expect(prompt).toContain("由Karin持有");
        expect(prompt).not.toContain("character-bA6c36imfwcVQWcJhLdlB");
        expect(prompt).not.toContain("prop-UoZ5m2wJEjWYW6lmsmyA");
    });

    it("normalizes manifest aliases without producing double-at references", () => {
        const project = createProject();
        project.episodes[0].shots[0].framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [{ id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 5, actionPrompt: "抬头", imagePrompt: "抬头" }],
            referenceManifest: [{ alias: "@图片1", role: "character_anchor", purpose: "角色基准图", assetId: "character-one" }],
        };
        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], project.episodes[0].shots[0]).videoPrompt;

        expect(prompt).toContain("@图片1=character_anchor");
        expect(prompt).not.toContain("@@图片1");
    });

    it("compiles identity, spatial and forbidden rules before the first generation", () => {
        const project = createProject();
        project.characters[0].profile = {
            ...project.characters[0].profile!,
            identityAnchors: ["左眼下方有痣"],
            spatialRules: ["徽记固定左肩"],
            forbiddenChanges: ["右肩徽记、拼版、多视角"],
        };
        const prompt = compileDramaAssetReferencePrompt(project, project.characters[0], "角色");
        expect(prompt).toContain("身份锚点（必须保留）：左眼下方有痣");
        expect(prompt).toContain("空间/位置约束（必须准确）：徽记固定左肩");
        expect(prompt).toContain("禁止：右肩徽记、拼版、多视角");
        expect(preflightDramaAssetGeneration(project, project.characters[0], "角色").ok).toBe(true);
    });

    it("allows a named asset with incomplete settings to generate its first candidate", () => {
        const project = createProject();
        project.characters[0] = {
            ...project.characters[0],
            description: "",
            profile: { visualIdentity: "", styling: "", colorPalette: "", consistencyRules: "" },
        };

        expect(preflightDramaAssetGeneration(project, project.characters[0], "角色").ok).toBe(true);
    });

    it("preserves long execution prompts instead of truncating the final constraints", () => {
        const project = createProject();
        project.characters[0].description = `${"角色细节".repeat(2500)}最终识别标记`;

        const prompts = compileDramaShotPrompts(project, project.episodes[0], project.episodes[0].shots[0]);
        const assetPrompt = compileDramaAssetReferencePrompt(project, project.characters[0], "角色");

        expect(prompts.imagePrompt.length).toBeGreaterThan(8000);
        expect(prompts.imagePrompt).toContain("最终识别标记");
        expect(assetPrompt.length).toBeGreaterThan(8000);
        expect(assetPrompt).toContain("最终识别标记");
    });

    it("replaces legacy project style and ignores historical asset layout instructions", () => {
        const project = createProject();
        project.style = "VS14 中世纪史诗的学院奇幻变体；宏大空间与克制人物近景并重";
        project.productionBible = { ...project.productionBible!, visualStyle: project.style, colorScript: "深蓝灰、旧银、墨绿、少量暖金" };
        project.characters[0].profile = {
            ...project.characters[0].profile!,
            designPrompt: "六模块纵向全量版，中性浅灰背景，三视图和面部五角度；风格：VS14中世纪史诗学院奇幻变体，克制写实。",
        };

        const prompt = compileDramaAssetReferencePrompt(project, project.characters[0], "角色");

        expect(prompt).toContain(`最终风格锁定：${DRAMA_STYLE_DESCRIPTION}`);
        expect(prompt).toContain("暗黑学院魔法背景");
        expect(prompt).toContain("短发");
        expect(prompt).not.toContain("VS14");
        expect(prompt).not.toContain("六模块");
        expect(prompt).not.toContain("中性浅灰背景");
    });

    it("recompiles cached refinement proposals with the current project style", () => {
        const project = createProject();
        const proposal = {
            reply: "调整完成",
            changes: [],
            updatedProfile: { ...project.characters[0].profile!, styling: "黑金学院长袍" },
            compiledPrompt: "旧版 VS14 生图提示词，中性浅灰背景",
            negativePrompt: "",
            preservedRules: [],
        };

        const prompt = compileDramaAssetRefinementPrompt(project, project.characters[0], "角色", proposal, "服装改为黑金学院长袍");

        expect(prompt).toContain("黑金学院长袍");
        expect(prompt).toContain(`最终风格锁定：${DRAMA_STYLE_DESCRIPTION}`);
        expect(prompt).not.toContain("旧版 VS14");
        expect(prompt).not.toContain("中性浅灰背景");
    });

    it("does not let legacy cached shot prompts bypass the current project style", () => {
        const project = createProject();
        project.style = "VS14 中世纪史诗学院奇幻，写实电影感";
        project.episodes[0].shots[0].executionImagePrompt = "旧版 VS14 分镜图，中性浅灰背景，多视角设定板";
        project.episodes[0].shots[0].executionVideoPrompt = "旧版写实电影感视频，保持中性灰背景";

        const prompts = compileDramaShotExecutionPrompts(project, project.episodes[0], project.episodes[0].shots[0]);

        expect(prompts.imagePrompt).toContain(`最终视觉锁定：${DRAMA_STYLE_DESCRIPTION}`);
        expect(prompts.videoPrompt).toContain(`最终视觉锁定：${DRAMA_STYLE_DESCRIPTION}`);
        expect(prompts.imagePrompt).not.toContain("VS14");
        expect(prompts.imagePrompt).not.toContain("中性浅灰背景");
        expect(prompts.videoPrompt).not.toContain("写实电影感");
        expect(prompts.videoPrompt).toContain("旧版视频");
    });

    it.each(["角色", "场景", "道具"] as const)("sanitizes legacy visual fields for %s assets", (kind) => {
        const project = createProject();
        const asset = kind === "角色" ? project.characters[0] : kind === "场景" ? project.scenes[0] : { id: "prop-one", name: "护符", description: "暗黄铜护符", profile: project.characters[0].profile };
        asset.profile = { ...asset.profile!, styling: "VS14写实电影感，六模块纵向全量版，中性浅灰背景" };

        const prompt = compileDramaAssetReferencePrompt(project, asset, kind);

        expect(prompt).not.toContain("VS14");
        expect(prompt).not.toContain("六模块");
        expect(prompt).not.toContain("中性浅灰背景");
        expect(prompt).toContain(`最终风格锁定：${DRAMA_STYLE_DESCRIPTION}`);
    });
});

function createProject(): DramaProject {
    const shot: DramaShot = {
        id: "shot-one",
        order: 1,
        title: "发现",
        description: "女主发现门边的血迹",
        sourceText: "她在门边停下。",
        shotBoundary: "发现后切镜",
        dialogue: "怎么回事？",
        narration: "",
        utterances: [],
        imagePrompt: "冷色天台",
        videoPrompt: "她抬头看向门口",
        cameraMotion: "缓慢推进",
        duration: 5,
        characterIds: ["character-one"],
        propIds: [],
        clueIds: [],
        sceneId: "scene-one",
        continuity: {
            shotSize: "中景",
            cameraAngle: "平视",
            composition: "人物在右侧",
            characterBlocking: "女主站在门边",
            gazeDirection: "看向左侧",
            actionStart: "动作起始",
            actionEnd: "动作结束",
            screenDirection: "向左",
            axisRule: "保持同侧",
            continuityNotes: "门把手位置不变",
        },
    };
    const episode: DramaEpisode = { id: "episode-one", title: "第 1 集", script: "", outline: "", hook: "", nextPreview: "", sourceRange: "", reviewStatus: "visual_ready", shots: [shot] };
    return {
        id: "drama-one",
        title: "测试短剧",
        summary: "",
        style: DRAMA_STYLE_NAME,
        ratio: "9:16",
        status: "active",
        productionBible: { language: "中文", ratio: "9:16", visualStyle: DRAMA_STYLE_NAME, colorScript: "暮色金紫主调", soundBible: "", globalNegativePrompt: "", subtitleSafeArea: "", continuityMode: "strict" },
        activeEpisodeId: episode.id,
        characters: [
            {
                id: "character-one",
                name: "女主",
                description: "红色外套",
                profile: { visualIdentity: "短发", styling: "红色外套", colorPalette: "红黑", consistencyRules: "发型不变" },
            },
        ],
        scenes: [{ id: "scene-one", name: "天台", description: "雨夜", profile: { visualIdentity: "高楼天台", styling: "湿润水泥", colorPalette: "蓝灰", consistencyRules: "保持门在左侧" } }],
        props: [],
        clues: [],
        defaultVideoMode: "storyboard",
        episodes: [episode],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}
