import { describe, expect, it } from "vitest";

import type { DramaEpisode, DramaProject, DramaShot } from "./drama-project-contract";
import { DRAMA_STYLE_DESCRIPTION, DRAMA_STYLE_NAME } from "./drama-style";
import {
    appendDramaImageReferenceBindings,
    compileDramaAssetReferencePrompt,
    compileDramaAssetRefinementPrompt,
    compileDramaDialogueAudioInstructions,
    compileDramaFrameSupplierPrompt,
    compileDramaShotExecutionPrompts,
    dramaFrameVisibleState,
    hasDramaAssetPromptQuality,
    compileDramaShotPrompts,
    deriveDramaShotPromptContract,
    preflightDramaAssetGeneration,
} from "./drama-prompt-compiler";

describe("drama prompt compiler", () => {
    it("derives one server-side shot contract for video and keyframe consumers", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.cameraMotion = "沿轴线缓慢推进";
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: true },
            referenceManifest: [{ alias: "@图片1", role: "scene_anchor", purpose: "场景", assetId: shot.sceneId }],
            frames: [{ id: "f1", sequenceIndex: 1, startSecond: 0, endSecond: 5, actionPrompt: "抬头", imagePrompt: "人物抬头看向门缝" }],
        };

        const contract = deriveDramaShotPromptContract(project, project.episodes[0], shot);

        expect(contract).toMatchObject({
            references: [{ alias: "@图片1", role: "scene_anchor" }],
            camera: { movement: "沿轴线缓慢推进" },
            beats: [{ id: "f1", startSecond: 0, endSecond: 5, actionPrompt: "抬头" }],
        });
        expect(contract.entryState).toEqual({ characters: [], props: [] });
        expect(contract.exitState).toEqual({ characters: [], props: [] });
        expect(contract).not.toHaveProperty("project");
    });

    it("embeds exact image duties in the editable supplier prompt", () => {
        const prompt = appendDramaImageReferenceBindings("静态关键帧：Karin站在黑湖边", [
            { id: "character-one", label: "角色固定资产「Karin」", binding: "锁定身份与服装" },
            { id: "scene-one", label: "场景固定资产「黑湖记忆」", binding: "锁定空间拓扑与主光方向" },
        ]);

        expect(prompt).toContain("@图片1：角色固定资产「Karin」；绑定规则：锁定身份与服装");
        expect(prompt).toContain("@图片2：场景固定资产「黑湖记忆」；绑定规则：锁定空间拓扑与主光方向");
        expect(appendDramaImageReferenceBindings(prompt, [{ id: "scene-one", label: "场景固定资产「黑湖记忆」", binding: "锁定空间拓扑与主光方向" }])).toContain("@图片1：场景固定资产「黑湖记忆」");
        expect(appendDramaImageReferenceBindings(prompt, [{ id: "scene-one", label: "场景固定资产「黑湖记忆」", binding: "锁定空间拓扑与主光方向" }])).not.toContain("@图片2：");
    });

    it("does not keep legacy reference sections when rebinding images", () => {
        const prompt = appendDramaImageReferenceBindings("动态意图：Karin握紧断剑\n参考图顺序（与视频请求数组完全一致）：\n@图片1：旧顺序帧\n必须逐图按上述职责使用；顺序帧用于锁定对应时间段的可见状态，不能用固定资产图替代。\n单一主运镜：缓慢推进", [
            { id: "frame-one", label: "顺序帧 1（开始）", binding: "作为开始阶段画面依据" },
        ]);

        expect(prompt.match(/实际参考图绑定（编号与本次请求图片数组完全一致）/gu)).toHaveLength(1);
        expect(prompt).not.toContain("参考图顺序（与视频请求数组完全一致）");
        expect(prompt).toContain("单一主运镜：缓慢推进");
        expect(prompt).toContain("@图片1：顺序帧 1（开始）；绑定规则：作为开始阶段画面依据");
    });

    it("keeps supplier prompts free of internal Skill instructions", () => {
        const project = createProject();
        const asset = project.characters[0];

        for (const kind of ["角色", "场景", "道具"] as const) {
            const prompt = compileDramaAssetReferencePrompt(project, asset, kind);
            expect(prompt).toContain("主体与资产类型：");
            expect(prompt).toContain("身份/结构锚点：");
            expect(prompt).toContain("构图与画幅：");
            expect(prompt).toContain("负面约束：");
            expect(prompt).not.toContain("资产图片 Skill 规则：");
            expect(prompt).not.toContain("输出约束：");
            expect(prompt).not.toContain("最终自检：");
        }
    });

    it("compiles every scene as a high-definition panorama", () => {
        const project = createProject();
        const scene = project.scenes[0];
        const prompt = compileDramaAssetReferencePrompt(project, scene, "场景");
        const constraints = preflightDramaAssetGeneration(project, scene, "场景");

        expect(prompt).toContain("高清");
        expect(prompt).toContain("单视角场景全景建立图");
        expect(prompt).toContain("9:16");
        expect(prompt).toContain("不生成九宫格、分格或360°贴图");
        expect(prompt).toContain("建筑透视稳定");
        expect(prompt).not.toContain("负面约束：额外主体、拼版、多视角");
        expect(constraints.ok).toBe(true);
        if (constraints.ok) {
            expect(constraints.constraints.join("\n")).toContain("高清单视角场景全景建立图");
            expect(constraints.constraints.join("\n")).toContain("不生成九宫格");
        }
    });

    it("does not let a legacy structured scene prompt bypass the nine-view contract", () => {
        const project = createProject();
        const scene = { ...project.scenes[0], supplierPrompt: "主体与资产类型：场景\n身份/结构锚点：旧空间\n可见状态与材质：旧材质\n构图与画幅：9:16 单一场景\n光色与风格：旧风格\n负面约束：无文字" };

        expect(compileDramaAssetReferencePrompt(project, scene, "场景")).toContain("九宫格");
    });

    it("applies the locked global art style and negative prompt to scene generation", () => {
        const project = createProject();
        project.style = DRAMA_STYLE_NAME;
        project.productionBible = {
            ...project.productionBible!,
            visualStyle: DRAMA_STYLE_NAME,
            globalNegativePrompt: "不要现代灯具、不要塑料感",
            productionPlan: {
                ...project.productionBible!.productionPlan!,
                visual: { visualStyle: "东方写实摄影", artStyle: "克制电影级空间美术，真实木石材质", source: "manual" },
            },
        };

        const prompt = compileDramaAssetReferencePrompt(project, project.scenes[0], "场景");

        expect(prompt).toContain("东方写实摄影");
        expect(prompt).toContain("全局画风规格：克制电影级空间美术，真实木石材质");
        expect(prompt).toContain("不要现代灯具、不要塑料感");
    });

    it("returns the current frame imagePrompt as the only static prompt source", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, {
            id: "frame-one",
            sequenceIndex: 1,
            startSecond: 0,
            endSecond: 2,
            actionPrompt: "抬头看向门边",
            imagePrompt: "女主在门边抬头，血迹进入前景",
        });

        expect(prompt).toBe("女主在门边抬头，血迹进入前景");
        expect(prompt).not.toContain("可见表演状态：");
        expect(prompt).not.toContain("景别：中景");
        expect(prompt).not.toContain("参考图职责：");
    });

    it("locks the visible delta between adjacent keyframes", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [
                {
                    id: "frame-one",
                    sequenceIndex: 1,
                    startSecond: 0,
                    endSecond: 3,
                    actionPrompt: "三人静立，萧炎在右侧低头承受压力",
                    imagePrompt: "静态关键帧：三人静立于议事大厅\n可见状态：萧炎低头，右手停在桌沿旁，茶水静止\n可见表演状态：眉眼压低，视线未回看对方",
                },
                {
                    id: "frame-two",
                    sequenceIndex: 2,
                    startSecond: 3,
                    endSecond: 6,
                    actionPrompt: "萧炎抬眼扫过萧战，右手在桌沿收紧，茶水出现细小波纹",
                    imagePrompt: "静态关键帧：萧炎抬眼扫过萧战，右手在桌沿收紧，茶水出现细小波纹\n可见状态：萧炎抬眼扫过萧战，右手五指收紧贴住桌沿，茶水表面出现细小波纹\n可见表演状态：视线转向萧战，肩线开始绷紧",
                },
            ],
        };
        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, shot.framePlan.frames[1]);
        expect(prompt).toBe(shot.framePlan.frames[1].imagePrompt);
        expect(prompt).not.toContain("萧炎低头，右手停在桌沿旁，茶水静止");
        expect(prompt).toContain("萧炎抬眼扫过萧战，右手五指收紧贴住桌沿，茶水表面出现细小波纹");
    });

    it("rebuilds a copied adjacent performance state from the current frame action", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        const copiedPerformance = "情绪纳兰掌控欲判；面部下巴抬起、嘴角压平；视线锁定萧炎；身体与手部袖口收拢后向前半步";
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [
                {
                    id: "frame-two",
                    sequenceIndex: 2,
                    startSecond: 0,
                    endSecond: 3,
                    actionPrompt: "萧炎抬眼扫过萧战，右手在桌沿收紧",
                    imagePrompt: `静态关键帧：萧炎抬眼扫过萧战\n可见状态：萧炎抬眼扫过萧战\n可见表演状态：${copiedPerformance}`,
                },
                {
                    id: "frame-three",
                    sequenceIndex: 3,
                    startSecond: 3,
                    endSecond: 6,
                    actionPrompt: "说到父亲时萧炎转向北侧首位，肩背从低垂变为直立",
                    imagePrompt: `静态关键帧：说到父亲时萧炎转向北侧首位，肩背从低垂变为直立\n可见状态：说到父亲时萧炎转向北侧首位，肩背从低垂变为直立\n可见表演状态：${copiedPerformance}`,
                },
            ],
        };

        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, shot.framePlan.frames[1]);

        expect(prompt).toContain(copiedPerformance);
        expect(prompt).not.toContain("肩线与身体朝向转向当前叙事目标");
        expect(prompt).toContain("肩背从低垂变为直立");
    });

    it("rebuilds saved frame prompts that use generic performance wording", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, {
            id: "frame-saved-generic",
            sequenceIndex: 2,
            startSecond: 2,
            endSecond: 4,
            actionPrompt: "人物抬眼并收紧手指",
            imagePrompt: "人物抬眼并收紧手指",
        });
        expect(prompt).toBe("人物抬眼并收紧手指");
    });

    it("uses one static shot size when continuity stores a camera transition", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.continuity = { ...shot.continuity!, shotSize: "ELS→ECU" };
        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, {
            id: "frame-one",
            sequenceIndex: 1,
            startSecond: 0,
            endSecond: 2,
            actionPrompt: "黑湖无波，倒悬古塔与倒影对齐",
            imagePrompt: "黑湖无波，倒悬古塔与倒影对齐；主体保持静止",
        });

        expect(prompt).toBe("黑湖无波，倒悬古塔与倒影对齐；主体保持静止");
        expect(prompt).not.toContain("ELS→ECU");
    });

    it("rebases a frame onto its scene-change asset and keeps the interior readable", () => {
        const project = createProject();
        const lake = project.scenes[0];
        lake.id = "scene-lake";
        lake.name = "黑湖记忆";
        lake.description = "无风黑湖与倒悬古塔";
        const carriage = {
            id: "scene-carriage",
            name: "前往阿佐雷斯的马车",
            description: "中世纪封闭木马车，左右长凳与右侧竖向车窗",
            profile: { visualIdentity: "左右长凳、右侧竖窗", styling: "木质车厢", colorPalette: "冷灰", consistencyRules: "车窗固定在右侧" },
        };
        project.scenes.push(carriage);
        const shot = project.episodes[0].shots[0];
        shot.sceneId = lake.id;
        shot.continuity = { ...shot.continuity!, shotSize: "ELS→ECU" };
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: true },
            referenceManifest: [
                { alias: "@湖", role: "scene_anchor", purpose: "黑湖场景", assetId: lake.id },
                { alias: "@车", role: "scene_anchor", purpose: "马车场景", assetId: carriage.id },
            ],
            frames: [],
        };

        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, {
            id: "frame-carriage",
            sequenceIndex: 5,
            startSecond: 12,
            endSecond: 15,
            actionPrompt: "Karin在马车中完全惊醒，手扣住断剑",
            imagePrompt: "静态关键帧：马车内Karin完全惊醒，手扣住断剑",
        });

        expect(prompt).toBe("静态关键帧：马车内Karin完全惊醒，手扣住断剑");
        expect(prompt).not.toContain("无风黑湖");
    });

    it("preserves a manually saved structured prompt for a frame-scene change", () => {
        const project = createProject();
        project.scenes[0] = { ...project.scenes[0], id: "scene-lake", name: "黑湖记忆", description: "无风黑湖与倒悬古塔" };
        project.scenes.push({
            id: "scene-carriage",
            name: "前往阿佐雷斯的马车",
            description: "中世纪封闭木马车，左右长凳与右侧竖向车窗",
            profile: { visualIdentity: "左右长凳、右侧竖窗", styling: "木质车厢", colorPalette: "冷灰", consistencyRules: "车窗固定在右侧" },
        });
        const shot = project.episodes[0].shots[0];
        shot.sceneId = "scene-lake";
        shot.framePlan = { start: { source: "independent" }, end: { required: true }, referenceManifest: [{ alias: "@车", role: "scene_anchor", purpose: "马车场景", assetId: "scene-carriage" }], frames: [] };

        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, {
            id: "frame-carriage",
            sequenceIndex: 5,
            startSecond: 12,
            endSecond: 15,
            actionPrompt: "Karin在马车中完全惊醒，手扣住断剑",
            imagePrompt: "静态关键帧：Karin完全惊醒，手扣住断剑",
        });

        expect(prompt).toBe("静态关键帧：Karin完全惊醒，手扣住断剑");
        expect(prompt).not.toContain("右侧车窗映入冷光");
    });

    it("preserves a manually saved prompt when fields use ASCII colons", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, {
            id: "frame-ascii-colon",
            sequenceIndex: 1,
            startSecond: 0,
            endSecond: 5,
            actionPrompt: "人物抬头",
            imagePrompt: "静态关键帧: 用户编辑画面\n可见状态: 人物抬头\n构图与空间: 视线落向门边",
        });

        expect(prompt).toContain("用户编辑画面");
    });

    it("uses a carriage cue from the saved supplier prompt when the frame image text is stale", () => {
        const project = createProject();
        project.scenes[0] = { ...project.scenes[0], id: "scene-lake", name: "黑湖记忆", description: "无风黑湖与倒悬古塔" };
        project.scenes.push({
            id: "scene-carriage",
            name: "前往阿佐雷斯的马车",
            description: "中世纪封闭木马车，左右长凳与右侧竖向车窗",
            profile: { visualIdentity: "左右长凳、右侧竖窗", styling: "木质车厢", colorPalette: "冷灰", consistencyRules: "车窗固定在右侧" },
        });
        const shot = project.episodes[0].shots[0];
        shot.sceneId = "scene-lake";
        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, {
            id: "frame-carriage",
            sequenceIndex: 5,
            startSecond: 12,
            endSecond: 15,
            actionPrompt: "结果状态落定",
            imagePrompt: "静态关键帧：Karin完全惊醒，手扣住断剑",
        });

        expect(prompt).toBe("静态关键帧：Karin完全惊醒，手扣住断剑");
        expect(prompt).not.toContain("无风黑湖");
    });

    it("rebuilds a legacy structured supplier prompt instead of preserving its reference duty", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, {
            id: "frame-legacy",
            sequenceIndex: 1,
            startSecond: 0,
            endSecond: 2,
            actionPrompt: "女主握住断剑",
            imagePrompt: "女主握住断剑",
        });

        expect(prompt).toBe("女主握住断剑");
        expect(prompt).not.toContain("参考图职责：");
    });

    it("includes structured prop identity in supplier-facing frame prompts", () => {
        const project = createProject();
        const propId = "prop-sword";
        project.props = [
            {
                id: propId,
                name: "Karin的断剑",
                description: "暗银色的断刃短剑",
                profile: {
                    visualIdentity: "不对称双翼护手",
                    styling: "剑柄缠深蓝旧布",
                    colorPalette: "暗银与深蓝",
                    consistencyRules: "断口形态固定，不得变为完整剑刃",
                },
            },
        ];
        const shot = project.episodes[0].shots[0];
        shot.propIds = [propId];

        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, undefined, "keyframe");

        expect(prompt).toBe("冷色天台");
        expect(prompt).not.toContain("参考图职责：");

        const savedPrompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, {
            id: "frame-one",
            sequenceIndex: 1,
            startSecond: 0,
            endSecond: 2,
            actionPrompt: "握紧短剑",
            imagePrompt: "握紧短剑",
        });
        expect(savedPrompt).toBe("握紧短剑");
        expect(savedPrompt).not.toContain("只按这段手工画面生成");
        expect(savedPrompt).not.toContain("道具锚点：");
    });

    it("includes structured character and scene identity in the final supplier frame prompt", () => {
        const project = createProject();
        project.characters[0] = {
            ...project.characters[0],
            name: "Karin",
            description: "黑发少年，腰间佩戴断剑",
            profile: { visualIdentity: "灰蓝眼睛与旧伤", styling: "深色旅行斗篷", colorPalette: "深蓝与暗银", consistencyRules: "断剑始终由 Karin 持有" },
        };
        project.scenes[0] = {
            ...project.scenes[0],
            name: "黑湖记忆",
            description: "无风黑湖、倒悬古塔与雪地边界",
            profile: { visualIdentity: "倒悬塔位置、无波黑湖、雪地边界", styling: "冷白无源光", colorPalette: "深蓝黑与雪白", consistencyRules: "湖面无波，古塔倒悬位置固定" },
        };

        const prompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], project.episodes[0].shots[0], {
            id: "frame-one",
            sequenceIndex: 1,
            startSecond: 0,
            endSecond: 2,
            actionPrompt: "Karin 在湖边握紧断剑",
            imagePrompt: "Karin、断剑、无波黑湖与倒悬古塔同框",
        });

        expect(prompt).toBe("Karin、断剑、无波黑湖与倒悬古塔同框");
        expect(prompt).not.toContain("参考图职责：");
        expect(prompt).not.toContain("角色锚点：");
        expect(prompt).not.toContain("场景锚点：");
    });

    it("passes shot static fields through without deriving timeline text", () => {
        const project = createProject();
        project.episodes[0].shots[0].framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: [
                { id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "女主停在门边", imagePrompt: "女主停在门边" },
                { id: "frame-two", sequenceIndex: 2, startSecond: 2, endSecond: 5, actionPrompt: "女主抬头看向血迹", imagePrompt: "女主抬头看向血迹" },
            ],
        };
        const prompts = compileDramaShotPrompts(project, project.episodes[0], project.episodes[0].shots[0]);

        expect(prompts.imagePrompt).toBe("冷色天台");
        expect(prompts.startFramePrompt).toBe("冷色天台");
        expect(prompts.endFramePrompt).toBe("冷色天台");
        expect(prompts.videoPrompt).toBe("她抬头看向门口");
    });

    it("does not derive timeline handoffs from frame states", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: [
                { id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 2, actionPrompt: "手指扣住剑柄", imagePrompt: "静态关键帧：人物低头；可见状态：手指扣住剑柄" },
                { id: "frame-two", sequenceIndex: 2, startSecond: 2, endSecond: 5, actionPrompt: "抬头看向门外", imagePrompt: "静态关键帧：人物抬头；可见状态：视线越过门框看向门外" },
            ],
        };

        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], shot).videoPrompt;

        expect(prompt).toBe("她抬头看向门口");
    });

    it("carries physical carriage blocking into the video execution prompt", () => {
        const project = createProject();
        project.scenes[0] = {
            ...project.scenes[0],
            name: "前往阿佐雷斯的马车",
            description: "中世纪封闭木马车，左右长凳与右侧竖向车窗",
            profile: { visualIdentity: "左右长凳、右侧竖窗", styling: "木质车厢", colorPalette: "冷灰", consistencyRules: "车窗固定在右侧", spatialRules: ["左侧长凳供主角就坐", "右侧长凳保持空位", "右侧车窗固定"] },
        };
        const shot = project.episodes[0].shots[0];
        shot.sceneId = project.scenes[0].id;
        shot.description = "Karin在马车中惊醒并扣住断剑";
        shot.videoPrompt = "惊醒后扣住断剑";
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: [{ id: "frame-carriage", sequenceIndex: 1, startSecond: 0, endSecond: 5, actionPrompt: "Karin坐在右侧长凳上惊醒", imagePrompt: "Karin坐在右侧长凳上，手扣住断剑，车厢过道清晰可见" }],
        };

        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], shot).videoPrompt;

        expect(prompt).toBe("惊醒后扣住断剑");
    });

    it("does not nest a previously compiled execution prompt", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.videoPrompt = "Karin握紧断剑并停住";
        shot.executionVideoPrompt = [
            "动态意图：起始可见状态：黑湖无波；触发：四只手扣紧；主体动作与反应：剑刃裂开；主运镜：缓慢推进；结束画面：冷银断口占据中心；约束：无字幕、无额外肢体",
            "参考图顺序（与视频请求数组完全一致）：",
            "@图片1：顺序帧 1（开始）",
            "必须逐图按上述职责使用；顺序帧用于锁定对应时间段的可见状态，不能用固定资产图替代。",
        ].join("\n");

        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], shot).videoPrompt;

        expect(prompt).toBe(shot.executionVideoPrompt);
    });

    it("uses the latest Agent or manual execution prompt in the preview and generation path", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.videoPrompt = "B线钩子：旧的动态规划";
        shot.executionVideoPrompt = [
            "素材绑定：@图片1：顺序帧 1",
            "动态意图：Karin从低头状态抬眼锁定门外",
            "全局设定：冷蓝夜景与倒悬古塔保持连续",
            "起始可见状态：Karin低头，双手扣住断剑",
            "主体动作与反应：手指收紧后抬头，视线转向门外",
            "时间段动作：",
            "P01-F01｜0-3s",
            "起点：Karin低头，双手扣住断剑",
            "动作与触发：手指收紧并抬头",
            "可见衔接：视线沿剑柄移向门外",
            "终点：Karin抬头看向门外",
            "单一主运镜：固定机位",
            "环境压力与视觉母题：远处风声和冷银断口",
            "视觉风格与光色：冷蓝灰低饱和",
            "声音意图：低声耳语，保留断剑金属声",
            "结束画面：Karin抬头看向门外",
            "连续性锁：身份、服装、断剑归属和轴线不变",
            "针对性约束：无水印、无额外肢体",
        ].join("\n");
        shot.framePlan = {
            start: { source: "independent" },
            end: { required: true },
            frames: [{ id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 5, actionPrompt: "抬头", imagePrompt: "人物抬头" }],
        };
        shot.fieldOrigins = { executionVideoPrompt: "ai" };

        const previewPrompt = compileDramaShotExecutionPrompts(project, project.episodes[0], shot).videoPrompt;
        expect(previewPrompt).toContain("动态意图：Karin从低头状态抬眼锁定门外");
        expect(previewPrompt).not.toContain("B线钩子");
    });

    it("preserves a legacy execution prompt without rewriting it", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.description = "Karin在黑湖边停住";
        shot.videoPrompt = "";
        shot.executionVideoPrompt = "动态意图：起始可见状态：黑湖无波；主体动作与反应：Karin停住；结束画面：黑湖与倒影稳定";

        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], shot).videoPrompt;

        expect(prompt).toBe(shot.executionVideoPrompt);
    });

    it("preserves continuation instructions authored in the execution prompt", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.videoPrompt = "Karin在黑湖边独立起镜，握住断剑并停住";
        shot.framePlan = { start: { source: "independent" }, end: { required: true }, frames: [{ id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 5, actionPrompt: "握住断剑并停住", imagePrompt: "静态关键帧：Karin在黑湖边握住断剑并停住" }] };
        shot.executionVideoPrompt = "素材绑定：后置续写上一镜，只继承上一镜尾帧真实可见的断口\n动态意图：沿用上一镜尾帧继续推进\n单一主运镜：固定机位";
        shot.fieldOrigins = { executionVideoPrompt: "manual" };

        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], shot).videoPrompt;

        expect(prompt).toBe(shot.executionVideoPrompt);
    });

    it("keeps an independent shot's negative continuation constraint", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.executionVideoPrompt = "动态意图：Karin独立起镜并握住断剑\n针对性约束：禁止继承上一镜尾帧状态";
        shot.fieldOrigins = { executionVideoPrompt: "manual" };

        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], shot).videoPrompt;

        expect(prompt).toContain("动态意图：Karin独立起镜并握住断剑");
        expect(prompt).toContain("禁止继承上一镜尾帧状态");
    });

    it("skips generic performance transitions when selecting a frame's visible state", () => {
        const state = dramaFrameVisibleState("静态关键帧：黑湖边的Karin与断剑清晰可见\n可见状态：结果状态继续发展\n可见表演状态：表情由疑惑转为戒备");

        expect(state).toBe("黑湖边的Karin与断剑清晰可见");
    });

    it("creates a fixed white-background four-view character reference sheet", () => {
        const prompt = compileDramaAssetReferencePrompt(createProject(), createProject().characters[0], "角色");

        expect(prompt).toContain("主体与资产类型：角色");
        expect(prompt).toContain("构图与画幅：16:9 横向");
        expect(prompt).toContain("高精度人物细节");
        expect(prompt).not.toContain("暗黑学院");
        expect(prompt).toContain("五官按设定年龄和性别的真实骨骼塑形");
        expect(prompt).toContain("头发按发际线、分区、根部体积、主发束");
        expect(prompt).toContain("服装按真实裁剪逻辑分层");
        expect(prompt).toContain("角色固有色彩：红黑");
        expect(prompt).toContain("纯白色无缝背景");
        expect(prompt).toContain("身份特写、正面全身立姿、严格左侧面全身立姿、背面全身立姿");
        expect(prompt).toContain("四视图");
        expect(prompt).toContain("双腿到鞋靴完整入画");
        expect(prompt).toContain("同一基线、同一身份、同一头身比");
        expect(prompt).toContain("五官按设定年龄和性别的真实骨骼塑形");
        expect(prompt).toContain("手指畸形");
        expect(prompt).not.toContain("资产图片 Skill 规则：");
    });

    it("applies the fixed role quality contract without inventing a new scene", () => {
        const project = createProject();
        project.characters[0] = {
            ...project.characters[0],
            name: "萧炎",
            description: "乌坦城萧家少年，清瘦但肩背挺直，黑发高束，深棕眼，墨青窄袖长袍",
            profile: {
                visualIdentity: "清晰眉骨；左眉尾微挑；黑发束带位置固定",
                styling: "墨青窄袖长袍，黑色腰封，旧金细节",
                colorPalette: "墨青、煤黑、旧金",
                consistencyRules: "锁定脸部、发束、肩宽和衣袍层次",
            },
        };

        const prompt = compileDramaAssetReferencePrompt(project, project.characters[0], "角色");

        expect(prompt).toContain("清晰眉骨");
        expect(prompt).toContain("墨青窄袖长袍");
        expect(prompt).toContain("自然骨骼与身材比例");
        expect(prompt).toContain("男性不女性化");
        expect(prompt).toContain("严格左侧面");
        expect(prompt).toContain("换脸");
        expect(prompt.match(/额外人物/g)).toHaveLength(1);
        expect(prompt).not.toContain("学院建筑");
        expect(prompt).not.toContain("用途：");
    });

    it("uses a saved supplier prompt for downstream asset generation", () => {
        const project = createProject();
        const savedPrompt =
            "主体与资产类型：角色「Karin」\n身份/结构锚点：已确认脸型与发束\n一致性锁定：锁定五官、头身比和服装层次\n可见状态与材质：墨青长袍与旧金腰封；按设定保持自然骨骼比例；五官按设定年龄和性别的真实骨骼塑形；头发按发际线、分区、根部体积和主发束建模；服装按真实裁剪逻辑分层\n构图与画幅：16:9 横向，纯白色无缝背景四视图，身份特写、正面全身、严格左侧面全身、背面全身\n光色与风格：高精度人物细节；角色固有色彩：墨青、旧金\n负面约束：无额外人物、无文字。";
        project.characters[0] = { ...project.characters[0], supplierPrompt: savedPrompt };

        expect(compileDramaAssetReferencePrompt(project, project.characters[0], "角色")).toBe(savedPrompt.replace("。\n", "\n"));
    });

    it("does not let a legacy one-line supplier override bypass the structured asset contract", () => {
        const project = createProject();
        project.characters[0] = { ...project.characters[0], supplierPrompt: "生成已确认的角色图，保持原样。" };

        const prompt = compileDramaAssetReferencePrompt(project, project.characters[0], "角色");

        expect(prompt).toContain("主体与资产类型：角色");
        expect(prompt).toContain("身份/结构锚点：");
        expect(prompt).toContain("负面约束：");
        expect(prompt).not.toBe("生成已确认的角色图，保持原样。");
    });

    it("recognizes only the complete high-quality role prompt contract", () => {
        expect(hasDramaAssetPromptQuality("主体与资产类型：角色\n身份/结构锚点：脸型\n可见状态与材质：服装\n构图与画幅：三视图\n光色与风格：高精度\n负面约束：无文字", "角色")).toBe(false);
        expect(
            hasDramaAssetPromptQuality(
                "主体与资产类型：角色\n身份/结构锚点：脸型\n一致性锁定：锁定五官和头身比\n可见状态与材质：自然骨骼比例，五官按年龄塑形，头发按发际线和主发束建模，服装按真实裁剪逻辑分层\n构图与画幅：16:9纯白色四视图，身份特写、正面全身、严格左侧面全身、背面全身\n光色与风格：高精度人物细节\n负面约束：无额外人物",
                "角色",
            ),
        ).toBe(true);
    });

    it("does not let a saved supplier prompt hide a refinement proposal", () => {
        const project = createProject();
        const proposal = {
            reply: "调整完成",
            changes: [],
            updatedProfile: { ...project.characters[0].profile!, styling: "新的墨青长袍" },
            compiledPrompt: "",
            negativePrompt: "",
            preservedRules: [],
        };
        project.characters[0] = { ...project.characters[0], supplierPrompt: "旧的已保存提示词" };

        const prompt = compileDramaAssetRefinementPrompt(project, project.characters[0], "角色", proposal, "服装改为新的墨青长袍");

        expect(prompt).toContain("新的墨青长袍");
        expect(prompt).not.toContain("旧的已保存提示词");
    });

    it("does not compile structured performance and lighting into Agent prompts", () => {
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
        expect(prompts.videoPrompt).toBe(shot.videoPrompt);
        expect(prompts.videoPrompt).not.toContain("表演变化：");
        expect(prompts.videoPrompt).not.toContain("呼吸先屏息再呼气");
        expect(prompts.videoPrompt).not.toContain("表演目标：掩饰恐惧");
        expect(prompts.videoPrompt).not.toContain("色温4200K");
        expect(compileDramaDialogueAudioInstructions(shot)).toContain("重读怎么");
    });

    it("keeps internal asset and holder ids out of supplier-facing prompts", () => {
        const project = createProject();
        project.characters[0].id = "character-bA6c36imfwcVQWcJhLdlB";
        project.characters[0].name = "Karin";
        project.episodes[0].shots[0].characterIds = [project.characters[0].id];
        project.episodes[0].shots[0].entryState = {
            characters: [{ assetId: project.characters[0].id, position: "左侧", gaze: "右方", pose: "站立", action: `持有 ${project.characters[0].id}` }],
            props: [{ assetId: "prop-UoZ5m2wJEjWYW6lmsmyA", state: "完整", holderId: project.characters[0].id }],
            environment: "天台",
            lighting: "冷光",
        };
        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], project.episodes[0].shots[0]).videoPrompt;

        expect(prompt).not.toContain("参考职责：");
        expect(prompt).not.toContain("character-bA6c36imfwcVQWcJhLdlB");
        expect(prompt).not.toContain("prop-UoZ5m2wJEjWYW6lmsmyA");
    });

    it("binds manifest duties to named assets without inventing request image numbers", () => {
        const project = createProject();
        project.episodes[0].shots[0].framePlan = {
            start: { source: "independent" },
            end: { required: false },
            frames: [{ id: "frame-one", sequenceIndex: 1, startSecond: 0, endSecond: 5, actionPrompt: "抬头", imagePrompt: "抬头" }],
            referenceManifest: [{ alias: "@图片1", role: "character_anchor", purpose: "角色基准图", assetId: "character-one" }],
        };
        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], project.episodes[0].shots[0]).videoPrompt;

        expect(prompt).not.toContain("参考职责：");
        expect(prompt).not.toContain("@图片1=character_anchor");
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
        expect(prompt).toContain("身份/结构锚点：");
        expect(prompt).toContain("左眼下方有痣");
        expect(prompt).toContain("徽记固定左肩");
        expect(prompt).toContain("右肩徽记、拼版、多视角");
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

    it("keeps shot static prompts bounded to the saved source field", () => {
        const project = createProject();
        project.characters[0].description = `${"角色细节".repeat(2500)}最终识别标记`;

        const prompts = compileDramaShotPrompts(project, project.episodes[0], project.episodes[0].shots[0]);
        const assetPrompt = compileDramaAssetReferencePrompt(project, project.characters[0], "角色");

        expect(prompts.imagePrompt).toBe("冷色天台");
        expect(prompts.videoPrompt).not.toContain("最终识别标记");
        expect(assetPrompt.length).toBeGreaterThan(8000);
        expect(assetPrompt).toContain("最终识别标记");
    });

    it("preserves an imported project style while ignoring historical asset layout instructions", () => {
        const project = createProject();
        project.style = "VS14 中世纪史诗的学院奇幻变体；宏大空间与克制人物近景并重";
        project.productionBible = { ...project.productionBible!, visualStyle: project.style, colorScript: "深蓝灰、旧银、墨绿、少量暖金" };
        project.characters[0].profile = {
            ...project.characters[0].profile!,
            designPrompt: "六模块纵向全量版，中性浅灰背景，三视图和面部五角度；风格：VS14中世纪史诗学院奇幻变体，克制写实。",
        };

        const prompt = compileDramaAssetReferencePrompt(project, project.characters[0], "角色");

        expect(prompt).toContain(`项目视觉风格：${project.style}`);
        expect(prompt).toContain("角色固有色彩：红黑");
        expect(prompt).toContain("短发");
        expect(prompt).not.toContain("六模块");
        expect(prompt).not.toContain("中性浅灰背景");
    });

    it("does not inject the project visual style into the saved shot static prompt", () => {
        const project = createProject();
        project.style = "现实悬疑电影感，冷蓝灰低饱和，手持摄影";
        project.productionBible = { ...project.productionBible!, visualStyle: project.style, colorScript: "冷蓝灰、低饱和" };

        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], project.episodes[0].shots[0]);

        expect(prompt.imagePrompt).toBe("冷色天台");
        expect(prompt.videoPrompt).toBe(project.episodes[0].shots[0].videoPrompt);
        expect(prompt.imagePrompt).not.toContain(project.style);
    });

    it("uses the configured VS7 style for character assets without a hardcoded theme", () => {
        const project = createProject();
        project.style = DRAMA_STYLE_NAME;
        project.productionBible = { ...project.productionBible!, visualStyle: "VS7 东方玄幻修仙 + 3D 国漫电影质感 + PBR 材质", colorScript: "墨青、暗灰、暖金" };

        const prompt = compileDramaAssetReferencePrompt(project, project.characters[0], "角色");

        expect(prompt).toContain("项目视觉风格：VS7 东方玄幻修仙 + 3D 国漫电影质感 + PBR 材质");
        expect(prompt).toContain("PBR 材质");
        expect(prompt).toContain("高精度人物细节");
        expect(prompt).not.toContain("暗黑学院");
        expect(prompt).not.toContain("哥特魔法学院");
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
        expect(prompt).toContain("高精度人物细节");
        expect(prompt).not.toContain("旧版 VS14");
        expect(prompt).not.toContain("中性浅灰背景");
    });

    it("does not let legacy execution image prompts override the current static source", () => {
        const project = createProject();
        project.style = "冷色悬疑电影感，低饱和手持摄影";
        project.episodes[0].shots[0].executionImagePrompt = "旧版 VS14 分镜图，中性浅灰背景，多视角设定板";
        project.episodes[0].shots[0].executionVideoPrompt = "旧版 VS14 视频，保持中性灰背景";

        const prompts = compileDramaShotExecutionPrompts(project, project.episodes[0], project.episodes[0].shots[0]);

        expect(prompts.imagePrompt).toBe("冷色天台");
        expect(prompts.videoPrompt).toBe("旧版 VS14 视频，保持中性灰背景");
        expect(prompts.videoPrompt).toContain("VS14");
        expect(prompts.videoPrompt).not.toContain("统一视觉风格（最高级风格约束）");
    });

    it.each(["角色", "场景", "道具"] as const)("sanitizes legacy visual fields for %s assets", (kind) => {
        const project = createProject();
        const asset = kind === "角色" ? project.characters[0] : kind === "场景" ? project.scenes[0] : { id: "prop-one", name: "护符", description: "暗黄铜护符", profile: project.characters[0].profile };
        asset.profile = { ...asset.profile!, styling: "VS14写实电影感，六模块纵向全量版，中性浅灰背景" };

        const prompt = compileDramaAssetReferencePrompt(project, asset, kind);

        expect(prompt).not.toContain("VS14");
        expect(prompt).not.toContain("六模块");
        expect(prompt).not.toContain("中性浅灰背景");
        expect(prompt).toContain(kind === "角色" ? "高精度人物细节" : DRAMA_STYLE_DESCRIPTION);
    });

    it("recompiles a prop prompt without character action narrative", () => {
        const project = createProject();
        const prop = {
            id: "prop-brush",
            name: "毛笔与砚台",
            description: "原文事实：萧炎在桌前奋笔疾书；导演建议：普通毛笔、墨砚和吸墨宣纸，均有可触摸的木石与纤维质感",
            supplierPrompt: [
                "主体与资产类型：道具「毛笔与砚台」",
                "身份/结构锚点：原文事实：萧炎在桌前奋笔疾书；导演建议：普通毛笔、墨砚和宣纸",
                "可见状态与材质：普通毛笔、墨砚和宣纸置于桌面",
                "构图与画幅：9:16画幅，单一道具主体完整入画，无人物拼版",
                "光色与风格：东方写实",
                "负面约束：额外主体、文字、水印",
            ].join("\n"),
            profile: { visualIdentity: "毛笔、砚台和宣纸", styling: "木石与纤维质感", colorPalette: "墨黑、暖褐", consistencyRules: "固定结构" },
        };

        const prompt = compileDramaAssetReferencePrompt(project, prop, "道具");

        expect(hasDramaAssetPromptQuality(prop.supplierPrompt, "道具")).toBe(false);
        expect(hasDramaAssetPromptQuality(prompt, "道具")).toBe(true);
        expect(prompt).toContain("只展示道具本体");
        expect(prompt).toContain("人物、手部、持有人");
        expect(prompt).not.toContain("萧炎");
        expect(prompt).not.toContain("奋笔疾书");
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
