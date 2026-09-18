import { describe, expect, it } from "vitest";

import type { DramaAuthoringSourceSnapshot, DramaProductionPackageV1 } from "@/lib/drama-project-contract";
import { DRAMA_PACKAGE_CONTRACT } from "@/lib/server/drama-production-package-contract";
import { validateDramaAuthoringQuality } from "@/lib/server/drama-production-package-quality";

const source = (textContent: string): DramaAuthoringSourceSnapshot => ({ alias: "@TXT", role: "story-source", type: "text", title: "3.txt", contentHash: "a".repeat(64), textContent });

function packageValue(input: { script?: string; videoPrompt?: string; actions?: string[]; npcPolicy?: boolean; sourceRange?: string; dialogue?: boolean } = {}) {
    const actions = input.actions || ["萧炎抬眼，右手指节压住桌沿", "萧炎肩背直起，视线从萧战回到纳兰"];
    const frames = actions.map((action, index) => ({
        id: `F${index + 1}`,
        sequenceIndex: index + 1,
        startSecond: index * 15,
        endSecond: (index + 1) * 15,
        ...(index ? { startPrompt: "上一帧人物状态继续承接" } : {}),
        actionPrompt: action,
        transitionPrompt: index ? "萧战目光从首位移向纳兰，桌边茶盏保持静止" : "萧炎的指节受力，萧战将目光投向儿子",
        endPrompt: index ? "萧炎肩背直起，视线锁定纳兰，萧战身体前倾" : "萧炎抬眼，指节仍压住桌沿，萧战目光停在父子之间",
        imagePrompt: index ? "萧炎肩背直起直视纳兰，萧战前倾，前景旁听者低头" : "萧炎抬眼，指节压住桌沿，萧战看向儿子，前景旁听者低头",
    }));
    const shot = {
        code: "SH01",
        duration: 30,
        cameraMotion: "中景平视固定机位，沿中央长桌轴线缓慢推进，为了让观众看见萧炎从承受到质问的重心变化",
        videoPrompt:
            input.videoPrompt ||
            "镜头模式：连续镜头\n单一主运镜：中景平视固定机位沿中央长桌轴线缓慢推进，为了让观众看见萧炎抬眼质问纳兰。\n时间段动作：0-15秒，起点萧炎低头；动作与触发萧炎抬眼并压住桌沿；可见衔接指节受力；终点萧炎抬眼。15-30秒，起点承接；动作与触发肩背直起并回看纳兰；可见衔接萧战前倾；终点萧炎直视纳兰。",
        dialogue: "",
        utterances: input.dialogue ? [{ id: "u1", order: 1, type: "dialogue" as const, speaker: "萧炎", text: "纳兰小姐，你来了。", startSecond: 1, endSecond: 8 }] : [],
        performancePlan: {
            emotionalObjective: "把私人难堪转成家族颜面质问",
            emotionalArc: "低头承受→抬眼施压→直视逼问",
            speechStyle: "冷笑压怒",
            pace: "前缓后紧",
            breath: "先压住呼吸再变短",
            restraintLevel: "克制",
            beats: {
                start: { emotion: "承受", facialAction: "嘴角压平，眼睑下垂", gaze: "落在桌面", bodyAction: "肩背略低，指节贴住桌沿" },
                middle: { emotion: "受辱转怒", facialAction: "眉眼收窄，嘴角出现冷笑", gaze: "抬眼接住纳兰视线", bodyAction: "肩背抬高，呼吸变短" },
                end: { emotion: "逼问", facialAction: "冷笑压成质问，颌线绷紧", gaze: "直视纳兰不移开", bodyAction: "身体前送，右手停在身侧" },
            },
        },
        continuity: {
            shotSize: "中景",
            cameraAngle: "平视",
            composition: "长桌轴线对峙",
            characterBlocking: "萧炎东侧、纳兰西侧、萧战北侧首位",
            gazeDirection: "萧炎看纳兰",
            actionStart: "萧炎低头",
            actionEnd: "萧炎直视纳兰",
            screenDirection: "180度轴线不变",
            axisRule: "中央长桌轴线",
            continuityNotes: "茶盏保持右手边",
        },
        entryState: { characters: [], props: [], environment: "萧家议事大厅" },
        exitState: { characters: [], props: [], environment: "萧家议事大厅，萧炎直视纳兰" },
        framePlan: { start: { source: "independent" }, end: { required: true }, frames },
    };
    return {
        schemaVersion: 1,
        project: { title: "三年之约", summary: "家族议事", style: "东方玄幻", ratio: "9:16", productionBible: { language: "中文", ratio: "9:16", visualStyle: "东方玄幻", continuityMode: "strict" } },
        assets: { characters: [], locations: [{ code: "S01", name: "萧家议事大厅", description: "固定大厅", ...(input.npcPolicy ? { backgroundNpcPolicy: { mode: "required" as const, countRange: { min: 5, max: 8 } } } : {}) }], props: [], clues: [] },
        episodes: [
            {
                code: "E01",
                title: "第三章",
                script:
                    input.script ||
                    "场景：萧家议事大厅。萧炎低头承受众人的目光，纳兰嫣然将退婚要求放到长桌中央。萧战按住茶盏，等待儿子开口。萧炎抬眼，右手指节压住桌沿，把私人难堪推向父亲和萧家颜面。纳兰下颌微抬，旁听者收声。萧战离开椅背前倾，大厅里的风声停住，所有人等待回应。",
                outline: "退婚冲突",
                hook: "萧炎质问",
                nextPreview: "纳兰回应",
                sourceRange: input.sourceRange || "第3章",
                storyScenes: [{ code: "SC01", order: 1, title: "议事大厅", summary: "退婚冲突", locationCode: "S01", shotCodes: ["SH01"] }],
                shots: [shot],
                continuityEdges: [],
            },
        ],
    } as unknown as DramaProductionPackageV1;
}

function blockers(report: ReturnType<typeof validateDramaAuthoringQuality>, code: string) {
    return report.checks.filter((check) => check.code === code && check.severity === "blocker");
}

describe("drama authoring quality gates", () => {
    it("blocks a short summary instead of treating it as a literary script", () => {
        const report = validateDramaAuthoringQuality({ package: packageValue({ script: "听着退婚要求，萧炎最终质问萧家颜面。" }), sources: [source("第3章：纳兰嫣然来到萧家议事大厅，提出退婚。")], targetNarrativeChapter: 3 });
        expect(report.status).toBe("blocked");
        expect(blockers(report, "LITERARY_SCRIPT_COMPLETENESS")).not.toHaveLength(0);
    });

    it("blocks missing TXT dialogue from both literary and timed dialogue coverage", () => {
        const report = validateDramaAuthoringQuality({
            package: packageValue({ script: "场景：议事大厅。萧炎说：“纳兰小姐，你来了。”他抬眼看向对方。萧战按住茶盏。" }),
            sources: [source("第3章。\n“纳兰小姐，你来了。”\n“我不会退让。”")],
            targetNarrativeChapter: 3,
        });
        expect(blockers(report, "DIALOGUE_COVERAGE")).not.toHaveLength(0);
    });

    it("blocks an overpacked logical shot before the authoring package can be completed", () => {
        const speech = "甲".repeat(86);
        const value = packageValue({ dialogue: true });
        value.episodes[0].shots[0].duration = 15;
        value.episodes[0].shots[0].dialogue = speech;
        value.episodes[0].shots[0].utterances = [{ id: "u1", order: 1, type: "dialogue", speaker: "萧炎", text: speech }];
        const overpackedReport = validateDramaAuthoringQuality({ package: value, sources: [source("第3章。场景在议事大厅。萧炎抬眼。")], targetNarrativeChapter: 3 });
        expect(overpackedReport.status).toBe("blocked");
        expect(blockers(overpackedReport, "DIALOGUE_CAPACITY")).not.toHaveLength(0);
    });

    it("does not expose a package until dialogue performance is concrete and segment-specific", () => {
        const prompt = "镜头模式：连续镜头\n单一主运镜：中景平视沿长桌缓慢推进，为了让观众看见萧炎抬眼质问纳兰。";
        const report = validateDramaAuthoringQuality({
            package: packageValue({
                dialogue: true,
                videoPrompt: prompt,
            }),
            sources: [source("第3章。场景在议事大厅。萧炎抬眼。\n“纳兰小姐，你来了。”")],
            targetNarrativeChapter: 3,
        });
        expect(report.status).toBe("blocked");
        expect(blockers(report, "DIALOGUE_PERFORMANCE")).not.toHaveLength(0);
    });

    it("blocks a package that omits an explicit plot fact", () => {
        const report = validateDramaAuthoringQuality({
            package: packageValue({ script: "场景：议事大厅。萧炎与纳兰嫣然对视，萧战等待回应。" }),
            sources: [source("第3章。于是黑衣长老开启血色法阵，山门上空落下雷火，众人退到石阶后方。")],
            targetNarrativeChapter: 3,
        });
        expect(blockers(report, "PLOT_FACT_COVERAGE")).not.toHaveLength(0);
    });

    it("blocks repeated actions across adjacent time segments", () => {
        const report = validateDramaAuthoringQuality({ package: packageValue({ actions: ["萧炎抬眼并压住桌沿", "萧炎抬眼并压住桌沿", "萧炎抬眼并压住桌沿"] }), sources: [] });
        expect(blockers(report, "ACTION_DIFFERENCE")).not.toHaveLength(0);
    });

    it("blocks an NPC group that never changes reaction", () => {
        const prompt =
            "镜头模式：连续镜头\n单一主运镜：中景固定，为了让观众看见质问升级。\n0-10秒 NPC群像：7名；分布：前景2名、中景3名、后景2名；密度：中低；反应：收声低头。10-20秒 NPC群像：7名；分布：前景2名、中景3名、后景2名；密度：中低；反应：收声低头。";
        const report = validateDramaAuthoringQuality({ package: packageValue({ npcPolicy: true, videoPrompt: prompt }), sources: [] });
        expect(blockers(report, "NPC_REACTION_CHANGE")).not.toHaveLength(0);
    });

    it("blocks an undeclared Cut to", () => {
        const report = validateDramaAuthoringQuality({ package: packageValue({ videoPrompt: "镜头模式：连续镜头\n单一主运镜：固定机位，为了让观众看见萧炎抬眼。\nCut to 萧战近景。" }), sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).not.toHaveLength(0);
    });

    it("blocks a 30-second dense-cut package that silently falls back to three cuts", () => {
        const value = packageValue({
            videoPrompt:
                "镜头模式：内部切镜（3次）\n单一主运镜：每次硬切后重新锁定焦点，为了让观众看清人物和关键道具。\n时间段动作：0-15秒，萧炎抬眼；15-30秒，萧炎直视纳兰。\n镜头事件：时间：15秒；类型：硬切；触发事件：萧炎抬眼；新机位：50mm侧45度中近景；切后主运镜：向萧炎慢推10厘米；信息目的：看清少年脸部；承接：视线和轴线不变。\n镜头事件：时间：15秒；类型：硬切；触发事件：萧炎压住桌沿；新机位：85mm手部近景；切后主运镜：锁定机位；信息目的：看清指节受力；承接：桌沿状态不变。\n镜头事件：时间：15秒；类型：硬切；触发事件：萧战抬眼；新机位：65mm父亲中近景；切后主运镜：锁定机位；信息目的：看清父亲反应；承接：声音连续。",
        });
        value.project.productionBible = { ...(value.project.productionBible || {}), productionPlan: { shotDuration: 30, framePolicy: "agent", customDirectorRules: "当前用户明确要求30秒高密度硬切，目标7—10次" } } as never;
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).not.toHaveLength(0);
    });

    it("blocks a dense-30s plan when the package only contains three frame segments", () => {
        const value = packageValue({
            videoPrompt:
                "镜头模式：内部切镜（3次）\n单一主运镜：每次切换后重新合焦，为了让观众看清萧炎的眼神、手部和主位关系。\n镜头事件：时间：15秒；类型：硬切；触发事件：萧炎抬眼；新机位：50mm侧45度中近景；切后主运镜：锁定机位；信息目的：看清眼神变化；承接：视线和轴线连续。\n镜头事件：时间：15秒；类型：硬切；触发事件：萧炎压住桌沿；新机位：85mm手部近景；切后主运镜：锁定机位；信息目的：看清手部受力；承接：桌沿状态连续。\n镜头事件：时间：15秒；类型：硬切；触发事件：萧战抬眼；新机位：65mm父亲中近景；切后主运镜：锁定机位；信息目的：看清主位反应；承接：声音连续。",
        });
        value.project.productionBible = {
            ...(value.project.productionBible || {}),
            productionPlan: { video: { shotDuration: 30, framePolicy: "agent", internalCutPolicy: "dense-30s" } },
        } as never;
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).not.toHaveLength(0);
    });

    it("blocks a dense-cut rule that is silently downgraded to adaptive", () => {
        const value = packageValue({
            videoPrompt: "镜头模式：内部切镜（3次）\n单一主运镜：锁定机位，为了让观众看清萧炎抬眼。\n镜头事件：时间：15秒；类型：硬切；触发事件：萧炎抬眼；新机位：50mm中近景；切后主运镜：锁定机位；信息目的：看清眼神；承接：视线连续。",
        });
        value.project.productionBible = {
            ...(value.project.productionBible || {}),
            productionPlan: { video: { shotDuration: 30, framePolicy: "agent", internalCutPolicy: "adaptive" }, customDirectorRules: "当前用户要求30秒高密度硬切，目标7—10次" },
        } as never;
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).not.toHaveLength(0);
    });

    it("blocks a custom template dense-cut rule before it can be downgraded to adaptive", () => {
        const value = packageValue({
            videoPrompt: "镜头模式：内部切镜（3次）\n单一主运镜：锁定机位，为了让观众看清萧炎抬眼。\n镜头事件：时间：15秒；类型：硬切；触发事件：萧炎抬眼；新机位：50mm中近景；切后主运镜：锁定机位；信息目的：看清眼神；承接：视线连续。",
        });
        value.project.productionBible = {
            ...(value.project.productionBible || {}),
            productionPlan: { video: { shotDuration: 30, framePolicy: "agent", internalCutPolicy: "adaptive" } },
        } as never;
        const report = validateDramaAuthoringQuality({
            package: value,
            sources: [{ alias: "@模板", role: "package-template", type: "text", title: "最新模板.md", contentHash: "b".repeat(64), textContent: "30秒逻辑片段必须使用8—11个帧段承载7—10次内部硬切" }],
        });
        expect(blockers(report, "CAMERA_EVENT")).not.toHaveLength(0);
    });

    it("blocks repeating the same complete dialogue in adjacent active frame segments", () => {
        const value = packageValue({ dialogue: true });
        const shot = value.episodes[0].shots[0];
        shot.utterances = [{ id: "u1", order: 1, type: "dialogue", speaker: "萧炎", text: "纳兰小姐，你来了。", startSecond: 1, endSecond: 29 }];
        shot.dialogue = "纳兰小姐，你来了。";
        shot.framePlan!.frames[0].actionPrompt = "萧炎说：“纳兰小姐，你来了。”；语气：低声克制；停顿：开口前半拍；重音：纳兰小姐；说后反应：目光锁住纳兰。";
        shot.framePlan!.frames[1].actionPrompt = "萧炎说：“纳兰小姐，你来了。”；语气：硬度增加；停顿：句中短停；重音：来了；说后反应：眉心收紧。";
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "DIALOGUE_PERFORMANCE")).not.toHaveLength(0);
    });

    it("accepts the eight-section prompt layout with cut events inferred from the timeline", () => {
        const value = packageValue({
            videoPrompt: [
                "【重要剪辑指令】\n两个真实信息节点之间发生一次可见硬切。",
                "【素材绑定】\n@图片1：萧炎身份；@图片2：萧家迎客大厅。",
                "【故事意图】\n把萧炎的克制推进为对纳兰的质问。",
                "【空间与连续性】\n萧炎画面右看左，纳兰画面左看右，180度轴线不变。",
                "【灯光与画面】\n左侧窗光照亮人物侧前方，脸部和手部清晰。",
                "【摄影总则】\n中景平视，沿长桌轴线缓慢推进，为了让观众看见萧炎从低头到抬眼的压力变化。",
                "【逐镜头时间线】\n镜头1，0-15秒，起点：萧炎低头；动作与触发：萧炎抬眼并压住桌沿；可见衔接：纳兰接住视线；终点：指节停在桌沿。\n镜头事件：时间：15秒；类型：硬切；触发事件：萧炎抬眼并收住右手；新机位：50mm侧45度中近景；切后主运镜：向萧炎慢推10厘米；信息目的：看清少年脸部压力；承接：视线、轴线和桌沿受力状态连续。\n镜头2，15-30秒，起点：指节停在桌沿；动作与触发：萧炎肩背直起并回看纳兰；可见衔接：萧战目光移向父子；终点：萧炎直视纳兰。",
                "【硬性禁止】\n禁止一镜到底、越轴、运动模糊和新增对白。",
            ].join("\n\n"),
        });
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "VIDEO_PROMPT_LAYOUT")).toHaveLength(0);
        expect(blockers(report, "CAMERA_EVENT")).toHaveLength(0);
    });

    it("allows fewer dense cuts only when a static or provider reason is explicit", () => {
        const value = packageValue({
            videoPrompt:
                "镜头模式：内部切镜（1次）\n单一主运镜：切后锁定机位，重新稳定焦点，为了看清萧战手掌和玉粉。\n减切原因：结果停留，萧战摊开的手掌需要保留静默观察。\n镜头事件：时间：15秒；类型：硬切；触发事件：萧炎说完族长；新机位：85mm主桌手部近景；切后主运镜：锁定机位；信息目的：看清父亲压住怒意的手部结果；承接：萧战手掌、玉粉位置和声音状态不变。",
        });
        value.project.productionBible = { ...(value.project.productionBible || {}), productionPlan: { shotDuration: 30, framePolicy: "agent", customDirectorRules: "当前用户明确要求30秒高密度硬切，目标7—10次" } } as never;
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).toHaveLength(0);
    });

    it("keeps narrative chapter 3 separate from package section 3", () => {
        const report = validateDramaAuthoringQuality({ package: packageValue({ sourceRange: "第3章" }), sources: [source("第3章：萧炎在议事大厅抬眼。")], targetNarrativeChapter: 3 });
        expect(report.checks.find((check) => check.scope === "目标小说章节")?.evidence).toContain("一级章节编号与小说章节独立");
        expect(DRAMA_PACKAGE_CONTRACT.id).toBe("vozeb-drama-production-package-v1");
    });
});
