import { describe, expect, it } from "vitest";

import type { DramaAuthoringSourceSnapshot, DramaProductionPackageV1 } from "@/lib/drama-project-contract";
import { DRAMA_PACKAGE_CONTRACT, DRAMA_PACKAGE_GATE_CODES } from "@/lib/server/drama-production-package-contract";
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
            "00.0–15.0秒，入口事实：萧炎站在中央长桌东侧，低头，右手指节压住桌沿；纳兰在桌对面，萧战位于北侧首位，摄影轴在长桌南侧。中景平视沿桌轴缓慢推进，萧炎听见纳兰的退婚要求后抬眼并压住桌沿，指节受力发白，视线落向纳兰；室内底噪收低，衣料轻响。\n15.0–30.0秒，萧炎肩背直起，视线从萧战转回纳兰，右手离开桌沿；中近景从入口侧平视锁定，萧战前倾，纳兰下颌微抬，旁听者收声；长桌与人物左右关系保持不变，呼吸声回落，停在萧炎直视纳兰的结果。",
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

const hardCutTransition = (time: number, trigger = "萧炎抬眼", camera = "入口侧近景") =>
    `镜头事件：时间：${time}秒；类型：硬切；触发事件：${trigger}；新机位：${camera}；切后主运镜：锁定机位后缓慢推进；信息目的：看清人物视线变化；承接：站位、视线与长桌轴线连续。`;

it("checks author-reviewed source dialogue rather than assigning a quoted pronoun as a character", () => {
    const value = packageValue({ dialogue: true });
    const utterance = value.episodes[0].shots[0].utterances[0];
    value.episodes[0].script += `\n萧炎说：“${utterance.text}”`;
    value.episodes[0].shots[0].dialogue = `萧炎说：“${utterance.text}”`;
    const report = validateDramaAuthoringQuality({
        package: value,
        sources: [source(`她说：“${utterance.text}”`)],
    });
    expect(report.checks.filter((check) => check.code === "DIALOGUE_COVERAGE" && check.status === "blocked")).toEqual([]);
});

describe("drama authoring quality gates", () => {
    it("keeps project-agent runtime gate codes within the versioned contract", () => {
        const value = packageValue();
        value.authoring = {
            source: "executeDramaScriptRun",
            generatedAt: "2026-09-20T00:00:00.000Z",
            directorSkill: { id: "drama-video-director", version: "test", contentHash: "a".repeat(64) },
            seedanceSkill: { id: "seedance-25-director", version: "test", contentHash: "b".repeat(64) },
            materials: [],
        };
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(DRAMA_PACKAGE_GATE_CODES).toEqual(expect.arrayContaining([...new Set(report.checks.filter((check) => check.severity === "blocker").map((check) => check.code))]));
    });

    it("blocks an unqualified blur or missing clarity anchor instead of leaving VISUAL_CLARITY as a warning", () => {
        const report = validateDramaAuthoringQuality({ package: packageValue({ videoPrompt: "00.0–30.0秒，入口事实：萧炎站在长桌东侧。固定机位，人物虚焦。" }), sources: [] });
        expect(blockers(report, "VISUAL_CLARITY")).not.toHaveLength(0);
    });

    it("blocks a spoken line when the audio fields do not protect it from sound effects", () => {
        const videoPrompt = [
            "开场时，萧炎在长桌东侧站立，右手贴住桌沿，纳兰在对面，冷窗光落在脸部和手背。",
            "00.0–30.0秒，萧炎抬眼看向纳兰，句尾合唇，手指压住桌沿；萧炎低声说：\u201c他是一族之长。\u201d末尾气息不稳，大厅混响和桌沿轻响在发声时避让。",
            "结束时，萧炎仍站在长桌东侧，右手停在桌沿，视线落在纳兰脸上。",
        ].join("\n");
        const report = validateDramaAuthoringQuality({ package: packageValue({ videoPrompt }), sources: [] });

        expect(blockers(report, "AUDIO_MIXING_HIERARCHY")).not.toHaveLength(0);
    });

    it("blocks a short summary instead of treating it as a literary script", () => {
        const report = validateDramaAuthoringQuality({ package: packageValue({ script: "听着退婚要求，萧炎最终质问萧家颜面。" }), sources: [source("第3章：纳兰嫣然来到萧家议事大厅，提出退婚。")], targetNarrativeChapter: 3 });
        expect(report.status).toBe("blocked");
        expect(blockers(report, "LITERARY_SCRIPT_COMPLETENESS")).not.toHaveLength(0);
    });

    it("blocks missing TXT dialogue from both literary and timed dialogue coverage", () => {
        const report = validateDramaAuthoringQuality({
            package: packageValue({ script: "场景：议事大厅。萧炎说：“纳兰小姐，你来了。”他抬眼看向对方。萧战按住茶盏。" }),
            sources: [source("第3章。\n萧炎：“纳兰小姐，你来了。”\n萧炎：“我不会退让。”")],
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

    it("blocks an individually overpacked utterance even when the whole logical shot has spare time", () => {
        const value = packageValue({ dialogue: true });
        const text = "甲".repeat(25);
        value.episodes[0].shots[0].utterances = [{ id: "u1", order: 1, type: "dialogue", speaker: "萧炎", text, startSecond: 1, endSecond: 5 }];
        value.episodes[0].shots[0].dialogue = text;
        const report = validateDramaAuthoringQuality({ package: value, sources: [source("第3章。场景在议事大厅。萧炎抬眼。")], targetNarrativeChapter: 3 });
        expect(blockers(report, "DIALOGUE_CAPACITY")).not.toHaveLength(0);
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
            "00.0–10.0秒，入口事实：7名NPC群像分布在前景2名、中景3名、后景2名，中低密度；中景固定机位，质问升级时NPC群像反应：收声低头。\n10.0–20.0秒，7名NPC群像仍分布在前景2名、中景3名、后景2名，中低密度；中景固定机位，NPC群像反应：收声低头。";
        const report = validateDramaAuthoringQuality({ package: packageValue({ npcPolicy: true, videoPrompt: prompt }), sources: [] });
        expect(blockers(report, "NPC_REACTION_CHANGE")).not.toHaveLength(0);
    });

    it("blocks an undeclared Cut to", () => {
        const report = validateDramaAuthoringQuality({ package: packageValue({ videoPrompt: "00.0–30.0秒，入口事实：萧炎站在长桌东侧，萧战位于北侧首位。中景固定机位，萧炎抬眼。Cut to：萧战近景，他抬眼看向儿子。" }), sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).not.toHaveLength(0);
    });

    it("blocks a 30-second dense-cut package that silently falls back to three cuts", () => {
        const value = packageValue({
            videoPrompt: "00.0–15.0秒，入口事实：萧炎站在长桌东侧，右手压住桌沿，纳兰在对面。萧炎抬眼。\n15.0–30.0秒，萧炎直视纳兰。",
        });
        value.episodes[0].shots[0].framePlan!.frames[1].transitionPrompt = hardCutTransition(15);
        value.project.productionBible = { ...(value.project.productionBible || {}), productionPlan: { shotDuration: 30, framePolicy: "agent", customDirectorRules: "当前用户明确要求30秒高密度硬切，目标7—10次" } } as never;
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).not.toHaveLength(0);
    });

    it("blocks a dense-30s plan when the package only contains three frame segments", () => {
        const value = packageValue({
            videoPrompt: "00.0–10.0秒，入口事实：萧炎站在长桌东侧。中景固定机位，萧炎抬眼。\n10.0–20.0秒，萧炎右手压住桌沿。Cut to：手部近景，指节发白。\n20.0–30.0秒，萧炎直视纳兰。",
        });
        const shot = value.episodes[0].shots[0];
        const baseFrame = shot.framePlan!.frames[0];
        shot.framePlan!.frames = [0, 10, 20].map((startSecond, index) => ({
            ...baseFrame,
            id: `F${index + 1}`,
            sequenceIndex: index + 1,
            startSecond,
            endSecond: startSecond + 10,
            actionPrompt: ["萧炎抬眼", "萧炎右手压住桌沿", "萧炎直视纳兰"][index],
            transitionPrompt: index ? hardCutTransition(startSecond, index === 1 ? "萧炎抬眼" : "萧炎压住桌沿", index === 1 ? "中近景" : "手部近景") : "萧炎抬眼，指节受力。",
            endPrompt: ["萧炎抬眼完成", "指节发白", "萧炎直视纳兰"][index],
            imagePrompt: ["萧炎抬眼", "指节发白", "萧炎直视纳兰"][index],
        }));
        value.project.productionBible = {
            ...(value.project.productionBible || {}),
            productionPlan: { video: { shotDuration: 30, framePolicy: "agent", internalCutPolicy: "dense-30s" } },
        } as never;
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).not.toHaveLength(0);
    });

    it("accepts seven aligned dense hard-cut events across two public timeline ranges", () => {
        const value = packageValue();
        const shot = value.episodes[0].shots[0];
        const baseFrame = shot.framePlan!.frames[0];
        const starts = [0, 3, 6, 9, 12, 15, 20, 25];
        shot.framePlan!.frames = starts.map((startSecond, index) => ({
            ...baseFrame,
            id: `F${index + 1}`,
            sequenceIndex: index + 1,
            startSecond,
            endSecond: starts[index + 1] ?? 30,
            ...(index ? { startPrompt: "上一帧结果继续承接" } : {}),
            actionPrompt: "萧炎听见声响后抬眼，指节离开桌沿。",
            transitionPrompt: "视线落向门口，桌面和轴线保持连续。",
            endPrompt: "萧炎停在门口方向，手掌离开桌沿。",
            imagePrompt: "萧炎抬眼，视线指向门口，手掌离开桌沿。",
        }));
        shot.framePlan!.frames = shot.framePlan!.frames.map((frame, index) => ({
            ...frame,
            ...(index ? { transitionPrompt: hardCutTransition(starts[index], index % 2 ? "萧炎抬眼" : "萧炎压住桌沿", index % 2 ? "入口侧近景" : "桌沿手部近景") } : {}),
        }));
        shot.videoPrompt = [
            "00.0–15.0秒，入口事实：萧炎站在长桌东侧，右手贴着桌沿，门口在他视线方向，摄影轴固定在桌南侧。中景平视，门外声响触发他抬眼，指节松开；短促吸气，桌沿轻响。Cut to：入口侧中近景，萧炎抬眼看向门口。Cut to：桌沿手部近景，指节离开木面。Cut to：萧战反应近景，他的视线转向门口。Cut to：长桌关系中景，众人仍留在原位。",
            "15.0–30.0秒，萧炎转向门口并退开半步，肩线停在门框内，右手离开桌面；近景侧面跟拍，鞋底擦地，呼吸回落。Cut to：侧面中近景，身体停在门框内。Cut to：手部近景，右手离开桌面。Cut to：门口方向反打，人物视线保持连续。停在已成立的门框内站位结果。",
        ].join("\n");
        value.project.productionBible = {
            ...(value.project.productionBible || {}),
            productionPlan: { video: { shotDuration: 30, framePolicy: "agent", internalCutPolicy: "dense-30s" } },
        } as never;

        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).toHaveLength(0);
    });

    it("blocks an adaptive prompt that names a hard cut without its timeline event", () => {
        const value = packageValue({
            videoPrompt: ["00.0–30.0秒，入口事实：萧炎站在长桌东侧，摄影轴固定在桌南侧。中景平视固定机位，萧炎抬眼后 Cut to：手部特写，指节离开桌沿。停在手掌离开桌沿的结果。"].join("\n"),
        });
        value.project.productionBible = {
            ...(value.project.productionBible || {}),
            productionPlan: { video: { shotDuration: 30, framePolicy: "agent", internalCutPolicy: "adaptive" } },
        } as never;

        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).not.toHaveLength(0);
    });

    it("blocks a dense-cut rule that is silently downgraded to adaptive", () => {
        const value = packageValue({
            videoPrompt: "00.0–30.0秒，入口事实：萧炎站在长桌东侧，右手贴住桌沿。此30秒片段要求7—10次硬切，每次服务当前动作信息变化。",
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
            videoPrompt: "00.0–30.0秒，入口事实：萧炎站在长桌东侧，右手贴住桌沿。30秒逻辑片段按模板要求规划8—11帧和7—10次硬切。",
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
        const value = packageValue({
            dialogue: true,
            actions: ["萧炎抬眼，目光锁住纳兰", "萧炎眉心收紧，声音继续", "萧炎下颌收紧，视线不移"],
        });
        const shot = value.episodes[0].shots[0];
        shot.utterances = [{ id: "u1", order: 1, type: "dialogue", speaker: "萧炎", text: "纳兰小姐，你来了。", startSecond: 1, endSecond: 29 }];
        shot.dialogue = "纳兰小姐，你来了。";
        shot.framePlan!.frames[0].actionPrompt = "萧炎说：“纳兰小姐，你来了。”；语气：低声克制；停顿：开口前半拍；重音：纳兰小姐；说后反应：目光锁住纳兰。";
        shot.framePlan!.frames[1].actionPrompt = "萧炎说：“纳兰小姐，你来了。”；语气：硬度增加；停顿：句中短停；重音：来了；说后反应：眉心收紧。";
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "DIALOGUE_PERFORMANCE")).not.toHaveLength(0);
    });

    it("blocks logical shots that only duplicate the same narrative duty", () => {
        const value = packageValue();
        const duplicate = structuredClone(value.episodes[0].shots[0]);
        duplicate.code = "SH02";
        duplicate.title = value.episodes[0].shots[0].title;
        value.episodes[0].shots.push(duplicate);
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "LOGICAL_SHOT_ECONOMY").some((check) => check.evidence.includes("没有独立剧情职责"))).toBe(true);
    });

    it("blocks overlapping dialogue prefixes across adjacent frame segments", () => {
        const value = packageValue({
            dialogue: true,
            actions: ["萧炎抬眼，目光锁住纳兰", "萧炎眉心收紧，声音继续", "萧炎下颌收紧，视线不移"],
        });
        const shot = value.episodes[0].shots[0];
        shot.utterances = [
            {
                id: "u1",
                order: 1,
                type: "dialogue",
                speaker: "萧炎",
                text: "纳兰小姐…你应该知道，在斗气大陆，女方悔婚会让对方有多难堪。",
                startSecond: 1,
                endSecond: 29,
            },
        ];
        shot.dialogue = shot.utterances[0].text;
        shot.framePlan!.frames[0].actionPrompt = "萧炎说：“纳兰小姐…你应该知道，在”；语气：低声克制；停顿：开口前半拍；重音：知道；说后反应：目光锁住纳兰。";
        shot.framePlan!.frames[1].actionPrompt = "萧炎说：“纳兰小姐…你应该知道，”；语气：硬度增加；停顿：句中短停；重音：知道；说后反应：眉心收紧。";
        shot.framePlan!.frames[2].actionPrompt = "萧炎继续说：“在斗气大陆，女方悔婚，”；语气：硬度增加；停顿：句中短停；重音：悔婚；说后反应：下颌收紧。";
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(report.status).toBe("blocked");
        expect(blockers(report, "DIALOGUE_PERFORMANCE").some((check) => check.evidence.includes("对白片段与上一时间段重叠"))).toBe(true);
    });

    it("rejects obsolete Xiaomo public cards even when frame boundaries are valid", () => {
        const value = packageValue({
            videoPrompt: [
                "### 镜头 01 | 0-15秒 | 中景 | 35mm | 入口侧45度平视 | 缓慢推近10厘米 | 人物镜头",
                "场景：议事大厅。",
                "画面内容：萧炎低头后抬眼，右手压住桌沿，纳兰接住视线，指节停在桌沿形成压力。",
                "光影：左侧窗光照亮萧炎侧前方，桌面保留冷灰反光。",
                "色调：冷中性栗灰。",
                "台词：无",
                "人声：短促吸气。",
                "音效：指节接触桌沿的轻响。",
                "### 镜头 02 | 15-30秒 | 中近景 | 50mm | 入口侧45度平视 | 锁定机位 | 双人关系镜头",
                "场景：议事大厅。",
                "画面内容：萧炎肩背直起并回看纳兰，萧战在主位抬眼，父子与纳兰的视线关系重新落回同一空间。",
                "光影：窗光沿人物侧脸落下，主位比窗边暗一档。",
                "色调：冷中性栗灰，局部暖白反光。",
                "台词：无",
                "人声：大厅保持静默。",
                "音效：室内底噪持续。",
            ].join("\n"),
        });
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "VIDEO_PROMPT_LAYOUT")).toHaveLength(1);
        expect(blockers(report, "CAMERA_EVENT")).toHaveLength(0);
    });

    it("blocks long logical-shot video prompts while still rejecting undeclared pseudo parameters", () => {
        const value = packageValue({
            videoPrompt: `### 镜头 01 | 0-30秒 | 中景 | 50mm | 平视 | 锁定 | 人物镜头\n场景：议事大厅。\n画面内容：萧炎抬眼并压住桌沿，指节发白，纳兰接住视线。\n光影：冷窗光落在手部。\n色调：冷青白。\npalette=冷中性/saturation=low/film_stock=Kodak 500T/grain=barely-visible/halation=none\n台词：无\n人声：短促吸气。\n音效：木案轻响。\n${"重复全局设定".repeat(1000)}`,
        });
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "VIDEO_PROMPT_LENGTH")).toHaveLength(0);
        expect(report.checks.find((check) => check.code === "VIDEO_PROMPT_LENGTH")).toMatchObject({ severity: "warning", evidence: expect.stringContaining("超过 2000") });
        expect(blockers(report, "VIDEO_PROMPT_LAYOUT")).not.toHaveLength(0);
    });

    it("rejects public density bookkeeping and requires a structured cut-reduction record", () => {
        const value = packageValue({
            videoPrompt:
                "开场时，萧战坐在长桌北侧首位，右手摊开，掌心留着玉粉。\n00.0–30.0秒，萧战手掌停稳，玉粉仍在原处；中近景锁定手部，萧炎说完族长后切至85mm主桌手部近景。减切原因：结果停留，萧战摊开的手掌需要保留静态留白。\n结束时，萧战仍坐在北侧首位，右手停在原处，玉粉未动。",
        });
        value.episodes[0].shots[0].framePlan!.frames[1].transitionPrompt =
            "镜头事件：时间：15秒；类型：硬切；触发事件：萧炎说完族长；新机位：85mm主桌手部近景；切后主运镜：锁定机位，重新稳定焦点；信息目的：看清父亲压住怒意的手部结果；承接：萧战手掌、玉粉位置和声音状态不变。";
        value.project.productionBible = { ...(value.project.productionBible || {}), productionPlan: { shotDuration: 30, framePolicy: "agent", customDirectorRules: "当前用户明确要求30秒高密度硬切，目标7—10次" } } as never;
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(
            blockers(report, "VIDEO_PROMPT_LAYOUT")
                .map((check) => check.evidence)
                .join("\n"),
        ).toContain("不得包含减切原因");
        expect(
            blockers(report, "CAMERA_EVENT")
                .map((check) => check.evidence)
                .join("\n"),
        ).toContain("只登记在结构化 QC 中");
    });

    it("keeps a documented density revision visible as a warning with the dense lock", () => {
        const value = packageValue({
            videoPrompt: "开场时，萧战坐在长桌北侧，右手摊开，掌心玉粉露出。\n00.0–30.0秒，中景平视固定，掌心停稳，纸页轻响。\nCut to：85mm桌沿手部近景，掌心停稳，纸页轻响。\n结束时，萧战仍坐在北侧，手掌停稳，玉粉可见。",
        });
        value.project.productionBible.productionPlan = { video: { shotDuration: 30, internalCutPolicy: "dense-30s", framePolicy: "agent" } } as never;
        value.episodes[0].shots[0].framePlan.frames[1].transitionPrompt = hardCutTransition(15, "萧战摊开手掌", "桌沿手部近景");
        value.authoring = {
            source: "executeDramaScriptRun",
            generatedAt: "2026-10-15T00:00:00.000Z",
            materials: [],
            qualityGateReport: {
                status: "passed",
                checks: [
                    {
                        code: "CAMERA_EVENT",
                        status: "warning",
                        severity: "warning",
                        scope: "减切修订",
                        shotIds: ["SH01"],
                        evidence: "减切原因：结果停留，静态留白让观众看清掌心玉粉；实际：2帧/1次硬切；修订状态：已修订为2帧1次硬切，保留原句窗口和掌心结果。",
                        sourceRefs: ["framePlan.frames"],
                        fixHint: "保留 dense-30s 锁定",
                    },
                ],
            },
        };
        const report = validateDramaAuthoringQuality({ package: value, sources: [] });
        expect(blockers(report, "CAMERA_EVENT")).toHaveLength(0);
        expect(report.checks).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CAMERA_EVENT", status: "warning", severity: "warning", evidence: expect.stringContaining("实际2帧/1次硬切") })]));
        expect(value.project.productionBible.productionPlan).toEqual(expect.objectContaining({ video: expect.objectContaining({ internalCutPolicy: "dense-30s" }) }));
        value.episodes[0].shots[0].framePlan.frames[1].transitionPrompt = hardCutTransition(14);
        expect(blockers(validateDramaAuthoringQuality({ package: value, sources: [] }), "CAMERA_EVENT")).not.toHaveLength(0);
    });

    it("accepts restrained performance with concrete evidence instead of forcing emotional escalation", () => {
        const value = packageValue({});
        const shot = value.episodes[0].shots[0];
        const beat = { emotion: "克制警觉", facialAction: "唇线收紧但眉弓不抬", gaze: "持续盯住持封右手", bodyAction: "重心稳定在案北侧，右手捏住封口" };
        shot.performancePlan = { ...shot.performancePlan!, emotionalObjective: "克制表演：防止对方接走纸封，情绪不升级", beats: { start: beat, middle: { ...beat }, end: { ...beat } } };
        expect(blockers(validateDramaAuthoringQuality({ package: value, sources: [] }), "EMOTION_PROGRESSION")).toHaveLength(0);
    });

    it("keeps narrative chapter 3 separate from package section 3", () => {
        const report = validateDramaAuthoringQuality({ package: packageValue({ sourceRange: "第3章" }), sources: [source("第3章：萧炎在议事大厅抬眼。")], targetNarrativeChapter: 3 });
        expect(report.checks.find((check) => check.scope === "目标小说章节")?.evidence).toContain("一级章节编号与小说章节独立");
        expect(DRAMA_PACKAGE_CONTRACT.id).toBe("vozeb-drama-production-package-v1");
    });
});
