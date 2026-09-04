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
    compileDramaShotPrompts,
    preflightDramaAssetGeneration,
} from "./drama-prompt-compiler";

describe("drama prompt compiler", () => {
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

    it("applies the Markdown-backed asset image Skill to character, scene and prop prompts", () => {
        const project = createProject();
        const asset = project.characters[0];

        for (const kind of ["角色", "场景", "道具"] as const) {
            const prompt = compileDramaAssetReferencePrompt(project, asset, kind);
            expect(prompt).toContain("资产图片 Skill 规则：");
            expect(prompt).toContain("角色图只生成一个完整、独立、可识别的角色主体");
            expect(prompt).toContain("禁止把角色表、参数、安装说明、分镜板、联系表、文字或水印画进图片");
        }
    });

    it("emits the current structured static-frame prompt contract", () => {
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

        expect(prompt).toContain("静态关键帧：女主在门边抬头，血迹进入前景");
        expect(prompt).toContain("可见表演状态：");
        expect(prompt).toContain("景别：中景");
        expect(prompt).toContain("机位与构图：");
        expect(prompt).toContain("站位与视线：");
        expect(prompt).toContain("三层空间：");
        expect(prompt).toContain("光色与风格：");
        expect(prompt).not.toContain("参考图职责：");
        expect(prompt).toContain("负面约束：");
        expect(prompt).not.toMatch(/(?:主体|场景|画面|当前状态|镜头|一致性)：/u);
        expect(prompt).not.toContain("章节文案");
        expect(prompt).not.toContain("统一表现媒介");
        expect(prompt.length).toBeLessThan(1200);
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

        expect(prompt).toContain("景别：中远景");
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
            supplierPrompt: "静态关键帧：黑湖外景Karin特写；可见状态：稳定；可见表演状态：清晰；景别：特写；机位与构图：平视；站位与视线：居中；三层空间：背景；光色与风格：冷光；参考图职责：场景；负面约束：无水印",
        });

        expect(prompt).toContain("左右长凳");
        expect(prompt).toContain("车厢");
        expect(prompt).toContain("中央过道保持通行");
        expect(prompt).toContain("坐姿必须落在左右长凳或明确座位");
        expect(prompt).toContain("若原文和资产未指定座位侧，必须选择与动作和机位相容的左侧或右侧座位");
        expect(prompt).toContain("景别：中景");
        expect(prompt).not.toContain("无风黑湖");
        expect(prompt).not.toContain("景别：特写");
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
            supplierPrompt:
                "静态关键帧：马车内Karin完全惊醒，右侧车窗映入冷光\n可见状态：Karin手扣断剑，肩膀绷紧\n可见表演状态：眉眼骤然睁开，视线锁定断剑\n景别：中景\n机位与构图：平视，左右长凳与右侧竖向车窗清晰可见\n站位与视线：Karin坐在车厢中央，视线落向断剑\n三层空间：前景为车厢门框，中景承载Karin与断剑，背景交代车厢纵深\n光色与风格：冷色雪白侧光，半写实动漫幻想风\n负面约束：无字幕、无水印、无logo、无HUD、无现代元素、无额外主体、无额外肢体、无变形。",
        });

        expect(prompt).toContain("右侧车窗映入冷光");
        expect(prompt).toContain("Karin手扣断剑，肩膀绷紧");
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
            imagePrompt: "人物抬头",
            supplierPrompt: "静态关键帧: 用户编辑画面\n可见状态: 人物抬头\n可见表演状态: 眉眼紧绷\n景别: 中景\n机位与构图: 平视，主体居中\n站位与视线: 视线落向门边\n三层空间: 前景为门框，中景承载人物，背景交代空间纵深\n光色与风格: 冷色侧光，半写实动漫幻想风\n负面约束: 无字幕、无水印、无logo、无HUD、无变形",
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
            supplierPrompt: "马车内Karin完全惊醒，车厢空间清晰可见",
        });

        expect(prompt).toContain("左右长凳");
        expect(prompt).toContain("中央过道保持通行");
        expect(prompt).toContain("若原文和资产未指定座位侧，必须选择与动作和机位相容的左侧或右侧座位");
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
            supplierPrompt: "静态关键帧：旧画面；可见状态：手握断剑；可见表演状态：紧张；景别：中景；机位与构图：平视；站位与视线：居中；三层空间：背景；光色与风格：冷光；参考图职责：沿用旧图；负面约束：无水印",
        });

        expect(prompt).not.toContain("参考图职责：");
        expect(prompt).toContain("静态关键帧：女主握住断剑");
        expect(prompt.split("\n")).toHaveLength(9);
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

        expect(prompt).toContain("静态关键帧：冷色天台");
        expect(prompt).not.toContain("参考图职责：");

        const savedPrompt = compileDramaFrameSupplierPrompt(project, project.episodes[0], shot, {
            id: "frame-one",
            sequenceIndex: 1,
            startSecond: 0,
            endSecond: 2,
            actionPrompt: "握紧短剑",
            imagePrompt: "握紧短剑",
            supplierPrompt: "只按这段手工画面生成",
        });
        expect(savedPrompt).toContain("静态关键帧：握紧短剑");
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

        expect(prompt).toContain("静态关键帧：Karin、断剑、无波黑湖与倒悬古塔同框");
        expect(prompt).not.toContain("参考图职责：");
        expect(prompt).not.toContain("角色锚点：");
        expect(prompt).not.toContain("场景锚点：");
    });

    it("keeps video prompts compact while image prompts retain full asset context", () => {
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

        expect(prompts.imagePrompt).toContain(`统一风格：${DRAMA_STYLE_NAME}`);
        expect(prompts.imagePrompt).toContain("女主：红色外套");
        expect(prompts.imagePrompt).toContain("轴线 保持同侧");
        expect(prompts.startFramePrompt).toContain("动作起始");
        expect(prompts.endFramePrompt).toContain("动作结束");
        expect(prompts.videoPrompt).toContain("时间段动作：");
        expect(prompts.videoPrompt).toContain("P01-F01｜0-2s");
        expect(prompts.videoPrompt).toContain("起点：动作起始");
        expect(prompts.videoPrompt).toContain("动作与触发：女主停在门边");
        expect(prompts.videoPrompt).toContain("终点：女主停在门边");
        expect(prompts.videoPrompt).toContain("P01-F02｜2-5s");
        expect(prompts.videoPrompt).toContain("可见衔接：承接上一段终点");
        expect(prompts.videoPrompt).toContain("动作与触发：女主抬头看向血迹");
        expect(prompts.videoPrompt).toContain("单一主运镜：缓慢推进");
        expect(prompts.videoPrompt).toContain("结束画面：以时间段动作最后一段终点作为本镜唯一收束画面");
        expect(prompts.videoPrompt).toContain(`风格：${DRAMA_STYLE_DESCRIPTION}`);
        expect(prompts.videoPrompt).not.toContain("5s 9:16 视频");
        expect(prompts.videoPrompt).not.toContain("女主：红色外套");
        expect(prompts.videoPrompt).not.toContain("场景设定：");
        expect(prompts.videoPrompt).not.toContain("统一表现媒介");
        expect(prompts.videoPrompt.length).toBeLessThan(prompts.imagePrompt.length);
    });

    it("derives each timeline handoff from the adjacent frame states", () => {
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

        expect(prompt).toContain("可见衔接：从镜头入口“动作起始”进入当前帧“手指扣住剑柄”");
        expect(prompt).toContain("可见衔接：承接上一段终点“手指扣住剑柄”，过渡到当前帧“视线越过门框看向门外”");
        expect(prompt).toContain("终点：手指扣住剑柄");
        expect(prompt).toContain("终点：视线越过门框看向门外");
        expect(prompt).not.toContain("只执行本段新增的可见变化");
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

        expect(prompt).toContain("空间与动作可行性：");
        expect(prompt).toContain("中央过道保持通行");
        expect(prompt).toContain("坐姿必须落在左右长凳或明确座位");
        expect(prompt).toContain("资产固定布局：左侧长凳供主角就坐；右侧长凳保持空位；右侧车窗固定");
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

        expect(prompt).toContain("动态意图：Karin握紧断剑并停住");
        expect(prompt).not.toContain("动态意图：起始可见状态");
        expect(prompt).not.toContain("参考图顺序（与视频请求数组完全一致）");
        expect(prompt.match(/单一主运镜：/gu)).toHaveLength(1);
        expect(prompt.match(/结束画面：/gu)).toHaveLength(1);
    });

    it("falls back to the shot fact when only a legacy compiled prompt remains", () => {
        const project = createProject();
        const shot = project.episodes[0].shots[0];
        shot.description = "Karin在黑湖边停住";
        shot.videoPrompt = "";
        shot.executionVideoPrompt = "动态意图：起始可见状态：黑湖无波；主体动作与反应：Karin停住；结束画面：黑湖与倒影稳定";

        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], shot).videoPrompt;

        expect(prompt).toContain("动态意图：Karin在黑湖边停住");
        expect(prompt).not.toContain("动态意图：起始可见状态");
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
        expect(prompts.videoPrompt).toContain("视觉风格与光色：冷灰蓝；左上冷光；湿地面反射");
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
        expect(prompts.videoPrompt).not.toContain("最终识别标记");
        expect(prompts.videoPrompt.length).toBeLessThan(prompts.imagePrompt.length);
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

        expect(prompt).toContain(`最终风格锁定：${project.style}`);
        expect(prompt).toContain("全局色彩脚本：深蓝灰、旧银、墨绿、少量暖金");
        expect(prompt).toContain("短发");
        expect(prompt).not.toContain("六模块");
        expect(prompt).not.toContain("中性浅灰背景");
    });

    it("uses a custom project visual style in generated prompts", () => {
        const project = createProject();
        project.style = "现实悬疑电影感，冷蓝灰低饱和，手持摄影";
        project.productionBible = { ...project.productionBible!, visualStyle: project.style, colorScript: "冷蓝灰、低饱和" };

        const prompt = compileDramaShotExecutionPrompts(project, project.episodes[0], project.episodes[0].shots[0]);

        expect(prompt.imagePrompt).toContain(project.style);
        expect(prompt.videoPrompt).toContain(`风格：${project.style}`);
        expect(prompt.imagePrompt).not.toContain("暗黑学院魔法环境");
        expect(prompt.imagePrompt).not.toContain("暮色金紫主调");
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
        project.style = "冷色悬疑电影感，低饱和手持摄影";
        project.episodes[0].shots[0].executionImagePrompt = "旧版 VS14 分镜图，中性浅灰背景，多视角设定板";
        project.episodes[0].shots[0].executionVideoPrompt = "旧版 VS14 视频，保持中性灰背景";

        const prompts = compileDramaShotExecutionPrompts(project, project.episodes[0], project.episodes[0].shots[0]);

        expect(prompts.imagePrompt).toContain(`最终视觉锁定：${project.style}`);
        expect(prompts.videoPrompt).toContain(`风格：${project.style}`);
        expect(prompts.imagePrompt).not.toContain("VS14");
        expect(prompts.imagePrompt).not.toContain("中性浅灰背景");
        expect(prompts.videoPrompt).not.toContain("VS14");
        expect(prompts.videoPrompt).toContain("旧版 视频");
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
