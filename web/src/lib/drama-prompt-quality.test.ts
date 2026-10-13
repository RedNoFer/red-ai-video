import { describe, expect, it } from "vitest";
import { normalizeDramaSpeaker } from "@/lib/drama-source-dialogue";

import {
    isGenericDramaDetail,
    validateDramaCameraPlan,
    extractDramaVideoPromptCards,
    extractDramaVideoPromptSection,
    validateDramaDialogueSegmentDetail,
    validateDramaNpcSegmentDetail,
    validateDramaPerformanceDetail,
    validateDramaFrameTiming,
    validateDramaFrameCausalChain,
    validateDramaVideoAuthoringQuality,
    validateDramaVideoPromptCardLayout,
    validateDramaSeedanceVideoPromptLayout,
    validateDramaVideoPromptLength,
    validateDramaVideoPromptDialogueTiming,
    repairDramaVideoPromptAudioHierarchy,
    repairDramaVideoPromptUtteranceCoverage,
    validateDramaVideoPromptAudioHierarchy,
    validateDramaVideoPromptUtteranceCoverage,
    validateDramaVideoPromptSemanticQuality,
    validateDramaVideoPromptTemplateLayout,
    validateDramaVideoPromptTimeline,
    validateDramaVideoSegmentDetail,
    repairDramaVideoPromptRepeatedLines,
} from "./drama-prompt-quality";

describe("drama prompt quality", () => {
    it("extracts decimal timeline ranges, inline shared rules and labelled voiceovers", () => {
        const prompt = [
            "【参数】30秒，16:9，有声。",
            "【公共总规范】站位：齐岚在左侧床沿，右手持手机；冷灰窗光；禁止瞬移与无因重排；对白原声清晰可辨并位于前景，语音期间压低环境音，不遮挡台词。",
            "【时间轴】",
            "0.000-3.000秒：近景｜70mm｜侧俯视｜固定机位；画面：齐岚因闹钟抬眼，右手收紧，视线停在手机上；台词：齐岚（心理旁白）：“还是九月九日。”；音效：闹钟和呼吸。",
            "3.000-30.000秒：中景｜50mm｜平视｜缓慢推近；画面：齐岚因日期未变垂下手，手机落在床沿，左侧站位保持；台词：无；音效：衣料摩擦。",
            "【收尾】齐岚仍在左侧床沿，手机停在床沿。",
        ].join("\r\n");
        const frames = [
            { startSecond: 0, endSecond: 3 },
            { startSecond: 3, endSecond: 30 },
        ];
        const cards = extractDramaVideoPromptCards(prompt);
        expect(cards).toHaveLength(2);
        expect(cards[0]).toMatchObject({ timeRange: "0.000-3.000秒", lens: "70mm", dialogue: "齐岚（心理旁白）：“还是九月九日。”" });
        expect(extractDramaVideoPromptSection(prompt, "时间轴")).not.toContain("【收尾】");
        expect(validateDramaVideoPromptCardLayout(prompt, frames, "测试")).toEqual([]);
        expect(validateDramaVideoPromptUtteranceCoverage(prompt, frames, [{ type: "voiceover", speaker: "齐岚", text: "还是九月九日。", startSecond: 0, endSecond: 3 }], "测试")).toEqual([]);
        expect(validateDramaVideoPromptCardLayout(prompt.replace("3.000-30.000", "4.000-30.000"), frames, "测试").join("\n")).toContain("公开段时间必须从0连续覆盖");
        expect(validateDramaVideoPromptAudioHierarchy(prompt.replace("不遮挡台词", "音乐盖过台词"), "测试").join("\n")).toContain("音效描述与对白清晰度冲突");
    });

    it("uses public time windows when two legacy cards cover four internal frames", () => {
        const frames = [
            { startSecond: 0, endSecond: 3 },
            { startSecond: 3, endSecond: 7 },
            { startSecond: 7, endSecond: 10 },
            { startSecond: 10, endSecond: 15 },
        ];
        const prompt = [
            "### 镜头 01 | 0-3秒 | 中景 | 50mm | 平视 | 固定机位 | 人物镜头",
            "场景：长案北侧，林雪站立，信封受右手支撑。",
            "画面内容：林雪因对方触纸而收紧指尖，信封停在她手中。",
            "光影：西窗柔光照亮案面与手背。",
            "色调：暖灰与木棕。",
            "台词：无",
            "人声：呼吸。",
            "音效：纸边轻擦。",
            "### 镜头 02 | 3-15秒 | 近景 | 70mm | 平视 | 固定机位 | 人物镜头",
            "场景：长案北侧，林雪站立，信封仍由右手持有。",
            "画面内容：林雪因对方再伸手而收回信封，右手持封停在胸前。",
            "光影：西窗柔光照亮脸部与信封。",
            "色调：暖灰与木棕。",
            "台词：林雪说：“别说话。”",
            "人声：林雪对白原声清晰可辨、音量居前，完整发出；说后闭口。",
            "音效：对白发声期间压低环境音与动作拟音，不盖过台词。",
        ].join("\n");
        const utterances = [{ type: "dialogue", speaker: "林雪", text: "别说话。", startSecond: 7, endSecond: 10 }];
        expect(validateDramaVideoPromptCardLayout(prompt, frames, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptCardLayout(prompt, 9, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptSemanticQuality(prompt, frames, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptUtteranceCoverage(prompt, frames, utterances, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptDialogueTiming(prompt, frames, utterances, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptTimeline(prompt.replace("3-15秒", "7-15秒"), frames, "SH01")).toContainEqual(expect.stringContaining("空档"));
        expect(validateDramaVideoPromptTimeline(prompt.replace("3-15秒", "3-10秒"), frames, "SH01")).toContainEqual(expect.stringContaining("完整覆盖"));
    });
    it("warns at the Unicode threshold without truncating or counting emoji as two characters", () => {
        expect(validateDramaVideoPromptLength("😀".repeat(2500))).toEqual([]);
        expect(validateDramaVideoPromptLength("😀".repeat(2500) + "\n")).toEqual([expect.stringContaining("2501")]);
    });

    it("rejects legacy cards for authoring and execution", () => {
        expect(validateDramaSeedanceVideoPromptLayout("### 镜头 1 | 0-30秒\n场景：宿舍", [], "SH01")).toEqual([expect.stringContaining("禁止回退")]);
    });

    it("covers multiple internal frames with one narrative segment and keeps nested quoted dialogue intact", () => {
        const frames = [
            { startSecond: 0, endSecond: 5 },
            { startSecond: 5, endSecond: 15 },
            { startSecond: 15, endSecond: 30 },
        ];
        const text = "她不知道，我刚才有多怕听见“九号”这两个字。";
        const prompt = [
            "【参数】30秒，16:9，有声。",
            "【公共总规范】齐岚坐在床沿，脚底受地面支撑，右手握手机；侧窗柔光，轴线固定；禁止瞬移和穿模。",
            "【时间轴】",
            `0-15秒：齐岚因确认日期而抬眼，指节松开，目光停在上铺床帘；中景平视固定机位；台词：齐岚（心理旁白）：“${text}”；人声：5-15秒，闭唇旁白，原声清晰居前；音效：床单轻擦。`,
            "15-30秒：齐岚因触到脸颊水痕而低头擦脸，手背落在胸前，呼吸松开；近景平视固定机位，床沿支撑不变；台词：无；音效：轻呼气。",
            "【收尾】齐岚仍坐在床沿，右手握手机，左手停在胸前。",
        ].join("\n");
        const utterances = [{ type: "voiceover", speaker: "齐岚", text, startSecond: 5, endSecond: 15 }];
        expect(validateDramaSeedanceVideoPromptLayout(prompt, frames, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptUtteranceCoverage(prompt, frames, utterances, "SH01")).toEqual([]);
        expect(extractDramaVideoPromptCards(prompt)[0].visual).not.toContain(text);
        expect(validateDramaSeedanceVideoPromptLayout(prompt.replace("15-30秒", "16-30秒"), frames, "SH01")).toContainEqual(expect.stringContaining("空档"));
    });

    it("accepts the compact Seedance adapter layout and preserves spatial locks", () => {
        const prompt = [
            "【参数】30秒，9:16竖屏，有声，短剧片段。",
            "【参考】@Image 1=议事厅场景；@Image 2=萧炎角色。",
            "【公共总规范】冷灰主色，左侧窗光；萧炎在长桌左侧站立，纳兰在右侧，双方脚底受地面支撑，萧炎右手接触桌沿，保持180度轴线和屏幕方向；全程禁止闪现、瞬移、无因重排、穿模、身体互穿、悬空和接触关系跳变；对白清晰，环境音避让。",
            "【时间轴】",
            "0-15秒：萧炎低头后抬眼并压住桌沿；听见纳兰质问 → 指节收紧，视线停在纳兰脸上；中景平视缓慢推近；萧炎短促呼吸，桌沿轻响。",
            "15-30秒：萧炎沿长桌向右走两步，纳兰后退靠近门框；萧炎逼近 → 两人距离缩短，手掌落在门框旁；侧面平视跟拍；脚步声和门框震动，站位与轴线保持。",
            "【收尾】萧炎停在门框左侧，纳兰背靠门框，右手仍未接触对方；长桌和入口锚点不变。",
        ].join("\n");
        const frames = [
            { startSecond: 0, endSecond: 15 },
            { startSecond: 15, endSecond: 30 },
        ];

        expect(validateDramaVideoPromptCardLayout(prompt, frames, "SH01")).toEqual([]);
        expect(validateDramaSeedanceVideoPromptLayout(prompt, frames, "SH01")).toEqual([]);
        expect(validateDramaSeedanceVideoPromptLayout(prompt.replace("【收尾】", "【参数】"), frames, "SH01")).toContainEqual(expect.stringContaining("顺序各出现一次"));
        expect(validateDramaSeedanceVideoPromptLayout(prompt + "\n### 镜头 1", frames, "SH01")).toContainEqual(expect.stringContaining("嵌套旧公开镜头卡"));
        expect(validateDramaVideoPromptSemanticQuality(prompt, frames, "SH01")).toEqual([]);
        expect(extractDramaVideoPromptCards(prompt)).toHaveLength(2);
    });

    it("accepts natural sentences with shared spatial facts and sentence-separated audio labels", () => {
        const prompt = [
            "【参数】15秒，16:9，有声。",
            "【公共总规范】林雪在桌北侧站立，右手持封；西窗柔光，南侧摄影轴固定，无瞬移、穿模或无因换位；人声清晰居前，环境音避让。",
            "【时间轴】",
            "0-3秒：林雪因对方伸手触纸而收紧指尖，信封仍由她持有；镜头固定在手部。台词：林雪说：“别说话。”人声：原句完整发出。音效：纸张轻响。",
            "3-15秒：林雪因递交中止而屈肘把信封收至胸前；固定细节机位强调持有人未变；台词：无；音效：纸边轻擦。",
            "【收尾】林雪仍站桌北侧，右手持封停在胸前。",
        ].join("\n");
        const frames = [
            { startSecond: 0, endSecond: 3 },
            { startSecond: 3, endSecond: 15 },
        ];
        expect(validateDramaSeedanceVideoPromptLayout(prompt, frames, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptSemanticQuality(prompt, frames, "SH01")).toEqual([]);
        expect(extractDramaVideoPromptCards(prompt)[0].visual).not.toContain("别说话");
        expect(validateDramaVideoPromptUtteranceCoverage(prompt, frames, [{ speaker: "林雪", text: "别说话。", startSecond: 0, endSecond: 3 }], "SH01")).toEqual([]);
        expect(validateDramaVideoPromptAudioHierarchy(prompt, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptAudioHierarchy(prompt.replace("人声：原句完整发出", "人声：林雪禁止说话"), "SH01")).toContainEqual(expect.stringContaining("同一发声窗口"));
    });

    it("removes exact repeated lines only when explicitly requested, independent of prompt length", () => {
        const header = "### 镜头 01 | 0-4秒 | 近景 | 50mm | 平视 | 锁定机位 | 人物镜头";
        const secondHeader = "### 镜头 02 | 4-8秒 | 近景 | 50mm | 平视 | 锁定机位 | 人物镜头";
        const repeatedCut = "硬切承接：陆川压住石缝，指节停在剑柄上。";
        const prompt = [header, "场景：北坡岩缝。", repeatedCut, repeatedCut, "台词：无", secondHeader, repeatedCut, repeatedCut].join("\n");

        const repaired = repairDramaVideoPromptRepeatedLines(prompt);

        expect(repaired.changed).toBe(true);
        expect(repaired.prompt.match(/硬切承接：/gu)).toHaveLength(2);
        expect(repaired.prompt).toContain("场景：北坡岩缝。");
        expect(repairDramaVideoPromptRepeatedLines(repaired.prompt)).toEqual({ prompt: repaired.prompt, changed: false });
    });

    it("blocks dialogue that has no audible voice priority or sound-effect ducking", () => {
        const prompt = [
            "### 镜头 06 | 17.8-21秒 | 中近景 | 50mm | 泉池右前平视 | 固定机位 | 人物镜头",
            "场景：山谷泉池。",
            "画面内容：陆川转回岚音，话末嘴唇合拢，视线停在她脸上。",
            "光影：背后林下冷天光落在陆川侧脸。",
            "色调：冷灰。",
            "台词：陆川说：\u201c我不知道这里是哪儿。\u201d",
            "人声：末尾气息不稳。",
            "音效：远水细响。",
        ].join("\n");

        expect(validateDramaVideoPromptAudioHierarchy(prompt, "SH06")).toEqual(expect.arrayContaining([expect.stringContaining("对白原声必须清晰可辨并位于前景"), expect.stringContaining("环境音/动作音/音乐必须在语音期间避让")]));
    });

    it("rejects sound effects that explicitly mask spoken dialogue", () => {
        const prompt = [
            "### 镜头 01 | 0-4秒 | 近景 | 50mm | 平视 | 固定机位 | 人物镜头",
            "场景：山谷泉池。",
            "画面内容：陆川张口说话，句尾合拢嘴唇。",
            "光影：天光落在脸上。",
            "色调：冷灰。",
            "台词：陆川说：\u201c我不知道这里是哪儿。\u201d",
            "人声：陆川对白原声清晰可辨、音量居前，口型同步。",
            "音效：雷声盖过陆川台词。",
        ].join("\n");

        expect(validateDramaVideoPromptAudioHierarchy(prompt, "SH01")).toEqual(expect.arrayContaining([expect.stringContaining("音效描述与对白清晰度冲突")]));
    });

    it("repairs legacy dialogue cards with explicit voice priority and sound ducking", () => {
        const prompt = [
            "### 镜头 06 | 17.8-21秒 | 中近景 | 50mm | 泉池右前平视 | 固定机位 | 人物镜头",
            "场景：山谷泉池。",
            "画面内容：陆川转回岚音，话末嘴唇合拢，视线停在她脸上。",
            "光影：背后林下冷天光落在陆川侧脸。",
            "色调：冷灰。",
            "台词：陆川说：\u201c我不知道这里是哪儿。\u201d",
            "人声：末尾气息不稳。",
            "音效：远水细响。",
            "剪辑承接：起镜入口状态已锁定。",
        ].join("\n");

        const repaired = repairDramaVideoPromptAudioHierarchy(prompt, "SH06");

        expect(repaired.changed).toBe(true);
        expect(repaired.prompt).toContain("陆川对白原声清晰可辨、音量居前");
        expect(repaired.prompt).toContain("远水细响");
        expect(repaired.prompt).toContain("对白/旁白发声期间压低环境音、动作拟音与音乐");
        expect(repaired.prompt).toContain("剪辑承接：起镜入口状态已锁定。");
        expect(validateDramaVideoPromptAudioHierarchy(repaired.prompt, "SH06")).toEqual([]);
        expect(repairDramaVideoPromptAudioHierarchy(repaired.prompt, "SH06")).toEqual({ prompt: repaired.prompt, changed: false });
        expect(extractDramaVideoPromptCards(repaired.prompt)[0]?.sound).not.toContain("剪辑承接");
    });

    it("cleans continuity text previously appended to sound and stays idempotent", () => {
        const prompt = [
            "### 镜头 06 | 17.8-21秒 | 中近景 | 50mm | 泉池右前平视 | 固定机位 | 人物镜头",
            "场景：山谷泉池。",
            "画面内容：陆川转回岚音，话末嘴唇合拢，视线停在她脸上。",
            "光影：背后林下冷天光落在陆川侧脸。",
            "色调：冷灰。",
            "台词：陆川说：\u201c我不知道这里是哪儿。\u201d",
            "人声：末尾气息不稳。",
            "音效：远水细响。",
            "剪辑承接：起镜入口状态已锁定。；对白/旁白发声期间压低环境音、动作拟音与音乐，不遮挡台词清晰度；仅在语音停顿间隙再抬升 剪辑承接：起镜入口状态已锁定。；对白/旁白发声期间压低环境音、动作拟音与音乐，不遮挡台词清晰度；仅在语音停顿间隙再抬升",
        ].join("\n");

        const repaired = repairDramaVideoPromptAudioHierarchy(prompt, "SH06");

        expect(repaired.changed).toBe(true);
        expect(repaired.prompt.match(/剪辑承接：/gu)).toHaveLength(1);
        expect(repaired.prompt.match(/对白\/旁白发声期间压低环境音、动作拟音与音乐/gu)).toHaveLength(1);
        expect(extractDramaVideoPromptCards(repaired.prompt)[0]?.sound).toContain("远水细响");
        expect(extractDramaVideoPromptCards(repaired.prompt)[0]?.sound).not.toContain("剪辑承接");
        expect(repairDramaVideoPromptAudioHierarchy(repaired.prompt, "SH06")).toEqual({ prompt: repaired.prompt, changed: false });
    });

    it("rewrites a masking sound effect below the spoken line", () => {
        const prompt = [
            "### 镜头 06 | 17.8-21秒 | 中近景 | 50mm | 泉池右前平视 | 固定机位 | 人物镜头",
            "场景：山谷泉池。",
            "画面内容：陆川转回岚音，话末嘴唇合拢，视线停在她脸上。",
            "光影：背后林下冷天光落在陆川侧脸。",
            "色调：冷灰。",
            "台词：陆川说：\u201c我不知道这里是哪儿。\u201d",
            "人声：末尾气息不稳。",
            "音效：雷声盖过陆川台词。",
        ].join("\n");

        const repaired = repairDramaVideoPromptAudioHierarchy(prompt, "SH06");

        expect(repaired.changed).toBe(true);
        expect(repaired.prompt).toContain("雷声保持低于陆川台词");
        expect(repaired.prompt).toContain("对白/旁白发声期间压低环境音、动作拟音与音乐");
        expect(validateDramaVideoPromptAudioHierarchy(repaired.prompt, "SH06")).toEqual([]);
    });

    it("repairs legacy public cards from exact utterance fragments in the frame plan", () => {
        const frames = [
            { startSecond: 0, endSecond: 2, actionPrompt: "陆川说：\u201c我叫陆川。\u201d" },
            { startSecond: 2, endSecond: 4, actionPrompt: "陆川说：\u201c滑坡把我冲进来的。\u201d" },
        ];
        const prompt = [
            "### 镜头 01 | 0-2秒 | 中景 | 50mm | 平视 | 锁定机位 | 人物镜头",
            "场景：北坡岩缝。",
            "画面内容：陆川抬眼看向岚音，右手压住湿石，指节停在石缝边缘。",
            "光影：阴天冷光落在陆川脸部和湿石表面。",
            "色调：冷灰与低饱和黛青。",
            "台词：无",
            "人声：陆川吸气。",
            "音效：湿石滴水声。",
            "### 镜头 02 | 2-4秒 | 近景 | 85mm | 平视 | 缓慢推近 | 人物镜头",
            "场景：北坡岩缝。",
            "画面内容：陆川转向岚音，嘴唇收住句尾，肩线停在岩壁前。",
            "光影：冷光沿侧脸和岩壁边缘形成窄反光。",
            "色调：冷灰与低饱和黛青。",
            "台词：无",
            "人声：陆川短促吐气。",
            "音效：水滴落入浅水。",
        ].join("\n");
        const utterances = [{ type: "dialogue", speaker: "陆川", text: "我叫陆川。滑坡把我冲进来的。", startSecond: 0, endSecond: 4 }];

        const repaired = repairDramaVideoPromptUtteranceCoverage(prompt, frames, utterances, "SH01");

        expect(repaired.changed).toBe(true);
        expect(repaired.prompt).toContain("台词：陆川说：\u201c我叫陆川。\u201d");
        expect(repaired.prompt).toContain("台词：陆川说：\u201c滑坡把我冲进来的。\u201d");
        expect(validateDramaVideoPromptUtteranceCoverage(repaired.prompt, frames, utterances, "SH01")).toEqual([]);
    });

    it("matches labelled voiceover to its original speaker and exact timed source coverage", () => {
        const labels = ["心理旁白", "记忆旁白", "人物介绍旁白"];
        const texts = ["她记得。", "他曾来过。", "齐岚是协调员。"];
        const frames = labels.map((_, index) => ({ startSecond: index * 2, endSecond: (index + 1) * 2 }));
        const utterances = texts.map((text, index) => ({ type: "voiceover", speaker: "齐岚", text, ...frames[index] }));
        const prompt = labels
            .map((label, index) =>
                [
                    `### 镜头 ${index + 1} | ${index * 2}-${(index + 1) * 2}秒 | 近景 | 50mm | 平视 | 锁定机位 | 人物镜头`,
                    "场景：值班室，齐岚坐在桌边。",
                    "画面内容：齐岚闭唇，目光从桌面移到门口，双手压在桌沿。",
                    "光影：左侧窗光落在齐岚侧脸和木桌边缘。",
                    "色调：低饱和灰蓝与浅棕。",
                    `台词：齐岚（${label}）：“${texts[index]}”`,
                    "人声：齐岚旁白原声清晰可辨、音量居前，原句完整可听；场内人物闭唇，不对口型。",
                    "音效：纸张轻响；旁白发声期间压低环境音、动作拟音与音乐。",
                ].join("\n"),
            )
            .join("\n");

        expect(labels.map((label) => normalizeDramaSpeaker(`齐岚（${label}）`))).toEqual(["齐岚", "齐岚", "齐岚"]);
        expect(normalizeDramaSpeaker("齐岚（梦境旁白）")).toBe("齐岚（梦境旁白）");
        expect(validateDramaVideoPromptCardLayout(prompt, frames, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptUtteranceCoverage(prompt, frames, utterances, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptUtteranceCoverage(prompt.replace("齐岚（心理旁白）", "陆泊言（心理旁白）"), frames, utterances, "SH01")).toEqual(
            expect.arrayContaining([expect.stringContaining("未完整写入旁白原句"), expect.stringContaining("错说话人")]),
        );
        expect(validateDramaVideoPromptCardLayout(prompt.replace("齐岚（心理旁白）", "齐岚（梦境旁白）"), frames, "SH01")).toEqual(expect.arrayContaining([expect.stringContaining("的台词必须使用")]));
    });

    it("does not guess where to place untimed dialogue across multiple cards", () => {
        const frames = [
            { startSecond: 0, endSecond: 2, actionPrompt: "陆川抬眼" },
            { startSecond: 2, endSecond: 4, actionPrompt: "岚音转身" },
        ];
        const prompt = [
            "### 镜头 01 | 0-2秒 | 中景 | 50mm | 平视 | 锁定机位 | 人物镜头\n场景：岩缝。\n画面内容：陆川抬眼，手指停在湿石边。\n光影：冷光落在脸上。\n色调：冷灰。\n台词：无\n人声：吸气。\n音效：滴水。",
            "### 镜头 02 | 2-4秒 | 近景 | 85mm | 平视 | 锁定机位 | 人物镜头\n场景：岩缝。\n画面内容：岚音转身看向陆川。\n光影：冷光落在侧脸。\n色调：冷灰。\n台词：无\n人声：无\n音效：水声。",
        ].join("\n");

        const repaired = repairDramaVideoPromptUtteranceCoverage(prompt, frames, [{ type: "voiceover", speaker: "岚音", text: "你一个人？" }], "SH01");

        expect(repaired).toEqual({ prompt, changed: false });
    });

    it("repairs untimed dialogue only when frame actions identify its exact card fragments", () => {
        const frames = [
            { startSecond: 0, endSecond: 2, actionPrompt: "陆川说：\u201c我叫陆川。\u201d" },
            { startSecond: 2, endSecond: 4, actionPrompt: "陆川说：\u201c滑坡把我冲进来的。\u201d" },
        ];
        const prompt = [
            "### 镜头 01 | 0-2秒 | 中景 | 50mm | 平视 | 锁定机位 | 人物镜头\n场景：岩缝。\n画面内容：陆川抬眼看向岚音，手指压住湿石。\n光影：冷光落在脸上。\n色调：冷灰。\n台词：无\n人声：吸气。\n音效：滴水。",
            "### 镜头 02 | 2-4秒 | 近景 | 85mm | 平视 | 锁定机位 | 人物镜头\n场景：岩缝。\n画面内容：陆川转向岚音，嘴唇收住句尾。\n光影：冷光落在侧脸。\n色调：冷灰。\n台词：无\n人声：吐气。\n音效：水声。",
        ].join("\n");
        const utterances = [{ type: "dialogue", speaker: "陆川", text: "我叫陆川。滑坡把我冲进来的。" }];

        const repaired = repairDramaVideoPromptUtteranceCoverage(prompt, frames, utterances, "SH01");

        expect(repaired.changed).toBe(true);
        expect(validateDramaVideoPromptUtteranceCoverage(repaired.prompt, frames, utterances, "SH01")).toEqual([]);
    });

    it("recognizes generic placeholder performance language", () => {
        expect(isGenericDramaDetail("表情自然")).toBe(true);
        expect(isGenericDramaDetail("眉心收紧，右手扣住桌沿，视线停在对方的手上")).toBe(false);
    });

    it("requires observable changes in each video timeline segment", () => {
        expect(validateDramaVideoSegmentDetail("情绪加剧", "保持本镜可见反应", "保持状态", "SH01")).toHaveLength(2);
        expect(validateDramaVideoSegmentDetail("萧炎抬眼，右手指节压紧桌沿", "纳兰嫣然的目光掠向北侧首位", "茶盏仍停在萧战手边，六名旁听者同时收声", "SH01")).toEqual([]);
        expect(validateDramaVideoSegmentDetail("萧炎抬眼，右手指节压紧桌沿", "", "萧炎停在桌案旁", "SH01", { requiresBackgroundNpc: true })).toEqual([expect.stringContaining("背景 NPC")]);
    });

    it("requires concrete performance and dialogue reactions", () => {
        const errors = validateDramaPerformanceDetail(
            {
                emotionalObjective: "守住秘密",
                emotionalArc: "平静到警觉",
                speechStyle: "压低声音，句尾收住",
                pace: "前慢后快",
                breath: "说前屏息，说完短促呼气",
                restraintLevel: "克制",
                beats: {
                    start: { emotion: "平静", facialAction: "眉眼放松", gaze: "看向对方", bodyAction: "左手压住桌沿" },
                    middle: { emotion: "警觉", facialAction: "眉心收紧", gaze: "扫向门口", bodyAction: "右肩后撤" },
                    end: { emotion: "紧张", facialAction: "下颌绷住", gaze: "锁定门缝", bodyAction: "手指扣紧桌沿" },
                },
            },
            [
                {
                    utteranceId: "u1",
                    intent: "试探对方是否知情",
                    tone: "压低声音，尾音上扬",
                    pace: "每个短句之间停半拍",
                    pause: "说出关键称谓前停顿",
                    emphasis: "重读‘你看见了吗’",
                    facialReactionBefore: "先抬眼确认对方视线",
                    facialReactionDuring: "说到关键称谓时眉心收紧",
                    facialReactionAfter: "闭口后保持盯视，不移开视线",
                },
            ],
            1,
            "SH01",
        );
        expect(errors).toEqual([]);
    });

    it("requires machine-checkable NPC distribution and reaction", () => {
        const valid = "NPC群像：7名；分布：前景2名、中景3名、后景2名；密度：中低密度；反应：后景旁听者收声低头，中景两人抬眼看向首位";
        expect(validateDramaNpcSegmentDetail(valid, "SH01", { min: 5, max: 8 })).toEqual([]);
        expect(validateDramaNpcSegmentDetail("NPC群像：7名；分布：前景1名、中景3名、后景2名；密度：中低密度；反应：保持关注", "SH01", { min: 5, max: 8 })).not.toEqual([]);
    });

    it("accepts stable NPC slots without treating screen depth as identity", () => {
        const valid = "NPC连续性：可见槽位：seat-left-01、seat-wall-02；世界锚点：左侧后席、北墙阴影处；状态变化：seat-left-01从低头看纸延迟抬眼，seat-wall-02保持贴墙收声";
        expect(validateDramaNpcSegmentDetail(valid, "SH01")).toEqual([]);
        expect(validateDramaNpcSegmentDetail("NPC连续性：可见槽位：seat-left-01；世界锚点：左侧后席；状态变化：保持状态", "SH01")).not.toEqual([]);
    });

    it("requires dialogue performance details inside each segment", () => {
        expect(validateDramaDialogueSegmentDetail("萧炎抬眼；对白表演：萧炎说：“他是一族之长。”；语气：压怒；停顿：半拍；重音：落在父亲；说后反应：闭口盯视", "SH01")).toEqual([]);
        expect(validateDramaDialogueSegmentDetail("萧炎开口，情绪加剧", "SH01")).not.toEqual([]);
        expect(validateDramaDialogueSegmentDetail("对白表演：说话人：萧炎；语气：低声克制；停顿：半拍；重音：纳兰小姐；说后反应：视线承接", "SH01")).toEqual(expect.arrayContaining([expect.stringContaining("实际台词")]));
    });

    it("checks legacy template fields without equating public segments to frame count", () => {
        const prompt = [
            "【重要剪辑指令】\n真实硬切。",
            "【素材绑定】\n@图片1：角色。",
            "【故事意图】\n把压力交还给对手。",
            "【空间与连续性】\n180度轴线不变。",
            "【灯光与画面】\n左侧窗光。",
            "【摄影总则】\n近景保持脸部清晰。",
            "【逐镜头时间线】\n镜头1，00.0—02.0秒，起点：萧炎低头；动作与触发：萧炎抬眼；可见衔接：纳兰接住视线；终点：萧炎抬眼停住。\n镜头2，02.0—04.0秒，起点：萧炎抬眼；动作与触发：右手压住桌沿；可见衔接：桌沿出现受力；终点：指节停在桌沿。",
            "【硬性禁止】\n不新增人物。",
        ].join("\n\n");
        expect(validateDramaVideoPromptTemplateLayout(prompt, 2, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptTemplateLayout(prompt, 9, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptTemplateLayout(prompt.replace(/镜头[12]，/gu, "时间段，"), 2, "SH01")).toEqual(expect.arrayContaining([expect.stringContaining("缺少可识别")]));
    });

    it("accepts Xiaomo director cards without the legacy eight-section headings", () => {
        const prompt = [
            "### 镜头 01 | 0-2秒 | 中近景 | 50mm | 侧45度平视 | 锁定机位，等萧炎抬眼 | 人物镜头",
            "场景：室内长桌对话空间。",
            "画面内容：萧炎抬眼看向左侧对手，右手从身侧抬到腰前，纳兰的衣肩停在左缘。",
            "光影：左侧窗光落在萧炎脸部，黑戒边缘出现冷白反光。",
            "色调：冷灰栗色，肤色自然。",
            "台词：萧炎说：“纳兰小姐，你应该知道。”",
            "人声：萧炎对白原声清晰可辨、音量居前，原句完整可听并按时间同步、与可见口型同步；开口前半拍吸气。",
            "音效：衣料轻响和室内底噪；对白/旁白发声期间压低环境音、动作拟音与音乐，不遮挡台词清晰度，仅在语音停顿间隙再抬升。",
            "### 镜头 02 | 2-4秒 | 手部近景 | 85mm | 侧30度平视 | 沿桌沿横移8厘米，停在指节受力结果 | 非人物镜头",
            "场景：同一张长桌。",
            "画面内容：萧炎掌根压住桌沿，指节发白，玉粉在接触面旁保持原位。",
            "光影：窗光沿桌沿扫过手背和木石纹理。",
            "色调：冷灰中保留一处暖白反光。",
            "台词：无",
            "人声：无",
            "音效：掌根与桌沿接触的轻响。",
        ].join("\n");
        expect(
            validateDramaVideoPromptCardLayout(
                prompt,
                [
                    { startSecond: 0, endSecond: 2 },
                    { startSecond: 2, endSecond: 4 },
                ],
                "SH01",
            ),
        ).toEqual([]);
    });

    it("rejects lighting or tone fields that only point back to another shot", () => {
        const prompt = [
            "### 镜头 01 | 0-2秒 | 中近景 | 50mm | 侧45度平视 | 锁定机位 | 人物镜头",
            "场景：室内长桌对话空间。",
            "画面内容：萧炎抬眼看向左侧对手，右手指节压紧桌沿。",
            "光影：承前",
            "色调：与第一镜头一致",
            "台词：无",
            "人声：无",
            "音效：衣料轻响。",
        ].join("\n");

        expect(validateDramaVideoPromptCardLayout(prompt, [{ startSecond: 0, endSecond: 2 }], "SH01")).toEqual(expect.arrayContaining([expect.stringContaining("光影不能只写"), expect.stringContaining("色调不能只写")]));
        expect(
            validateDramaVideoPromptCardLayout(prompt.replace("光影：承前", "光影：与首卡一致的右侧窗光落在萧炎左颊和桌沿").replace("色调：与第一镜头一致", "色调：与首卡一致的低饱和冷灰蓝，肤色保留自然中性"), [{ startSecond: 0, endSecond: 2 }], "SH01"),
        ).toEqual([]);
    });

    it("blocks cross-clip context and subtitle text outside dialogue fields", () => {
        const prompt = [
            "### 镜头 01 | 0-2秒 | 中近景 | 50mm | 侧45度平视 | 固定机位 | 人物镜头",
            "场景：山谷泉池边。",
            "画面内容：陆川转头看向林缘，指尖松开湿衣料，水珠落回石面。",
            "光影：左侧天光落在陆川脸颊与湿石上。",
            "色调：冷灰绿，肤色自然。",
            "台词：陆川说：“我不知道这里有没有字幕。”",
            "人声：陆川对白原声清晰可辨、音量居前，原句完整可听并与可见口型同步。",
            "音效：水珠落石；语音期间压低环境音。",
            "镜头变化：回答留到SH18；上下文参数沿用上一镜。",
        ].join("\n");

        expect(validateDramaVideoPromptCardLayout(prompt, [{ startSecond: 0, endSecond: 2 }], "SH01")).toEqual(expect.arrayContaining([expect.stringContaining("不得引用其他镜头/视频、项目或上下文")]));
    });

    it("blocks Xiaomo cards that are structurally complete but only describe abstract intent", () => {
        const prompt = [
            "### 镜头 01 | 0-2秒 | 中景 | 50mm | 入口侧45度平视 | 极慢横移 | 人物镜头",
            "场景：萧家议事大厅。",
            "画面内容：三人的关系停在新的压力面，纳兰准备回应，画面为下一镜提供空间承接。",
            "光影：高窗冷青白光。",
            "色调：冷青白、黛青。",
            "台词：无",
            "人声：三人自然反应。",
            "音效：大厅余响。",
        ].join("\n");
        expect(validateDramaVideoPromptSemanticQuality(prompt, [{ startSecond: 0, endSecond: 2 }], "SH02")).toEqual(expect.arrayContaining([expect.stringContaining("抽象/未来意图")]));
    });

    it("accepts a public card with a visible trigger, action, result, and sound anchor", () => {
        const prompt = [
            "### 镜头 01 | 0-2秒 | 中近景 | 50mm | 入口侧45度平视 | 沿萧炎视线缓慢推近 | 人物镜头",
            "场景：萧家议事大厅长案前。",
            "画面内容：听见纳兰的条件后，萧炎抬眼锁住她，右手压住腰侧衣料，指节发白，纳兰的肩线停在左缘。",
            "光影：高窗冷青白光落在眼睛、下颌和指节。",
            "色调：冷青白、低饱和黛青。",
            "台词：萧炎说：“什么约定？”",
            "人声：萧炎对白原声清晰可辨、音量居前，原句完整可听并按时间同步、与可见口型同步；短促吸气后开口，句尾收住。",
            "音效：衣料绷紧，长案产生短混响；对白/旁白发声期间压低环境音、动作拟音与音乐，不遮挡台词清晰度，仅在语音停顿间隙再抬升。",
        ].join("\n");
        expect(validateDramaVideoPromptSemanticQuality(prompt, [{ startSecond: 0, endSecond: 2 }], "SH02")).toEqual([]);
    });

    it("does not treat focal-length-only changes as public information diversity", () => {
        const card = (lens: string, motion: string) =>
            [
                `### 镜头 01 | 0-2秒 | 中近景 | ${lens} | 入口侧45度平视 | ${motion} | 人物镜头`,
                "场景：萧家议事大厅长案前。",
                "画面内容：听见对方的条件后，萧炎抬眼锁住纳兰，右手压住腰侧衣料，指节发白，纳兰肩线停在左缘。",
                "光影：高窗冷青白光落在眼睛、下颌和指节。",
                "色调：冷青白、低饱和黛青。",
                "台词：无",
                "人声：萧炎短促吸气。",
                "音效：衣料绷紧，长案产生短混响。",
            ].join("\n");
        const prompt = `${card("50mm", "缓慢推近")}\n${card("85mm", "固定机位").replace("镜头 01 | 0-2秒", "镜头 02 | 2-4秒")}`;
        expect(
            validateDramaVideoPromptSemanticQuality(
                prompt,
                [
                    { startSecond: 0, endSecond: 2 },
                    { startSecond: 2, endSecond: 4 },
                ],
                "SH02",
            ),
        ).toEqual(expect.arrayContaining([expect.stringContaining("可辨识差异")]));
    });

    it("keeps complete dialogue in the dialogue field instead of duplicating it in visual action", () => {
        const prompt = [
            "### 镜头 01 | 0-2秒 | 中近景 | 50mm | 侧45度平视 | 缓慢推近4厘米 | 人物镜头",
            "场景：室内长桌对话空间。",
            "画面内容：萧炎嘴唇开启完成起句，眉心收紧，右手压住桌沿，纳兰肩线停在左缘。",
            "光影：窗光落在眼睛和手背。",
            "色调：冷青白。",
            "台词：萧炎说：“纳兰小姐，你应该知道。”",
            "人声：萧炎对白原声清晰可辨、音量居前，原句完整可听并按时间同步、与可见口型同步；开口前轻吸气。",
            "音效：衣料轻响；对白/旁白发声期间压低环境音、动作拟音与音乐，不遮挡台词清晰度，仅在语音停顿间隙再抬升。",
        ].join("\n");
        expect(validateDramaVideoPromptCardLayout(prompt, [{ startSecond: 0, endSecond: 2 }], "SH01")).toEqual([]);
        expect(validateDramaVideoPromptCardLayout(prompt.replace("嘴唇开启完成起句，", "萧炎说：“纳兰小姐，你应该知道。”；"), [{ startSecond: 0, endSecond: 2 }], "SH01")).toEqual(
            expect.arrayContaining([expect.stringContaining("画面内容不得包含完整对白")]),
        );
    });

    it("rejects equal frame durations when timed dialogue boundaries fall inside frames", () => {
        expect(
            validateDramaFrameTiming(
                [
                    { startSecond: 0, endSecond: 3.75 },
                    { startSecond: 3.75, endSecond: 7.5 },
                    { startSecond: 7.5, endSecond: 11.25 },
                    { startSecond: 11.25, endSecond: 15 },
                ],
                [{ type: "dialogue", startSecond: 1.2, endSecond: 6.8 }],
                "SH01",
            ),
        ).toEqual(expect.arrayContaining([expect.stringContaining("不能把对白切在段内")]));
        expect(
            validateDramaFrameTiming(
                [
                    { startSecond: 0, endSecond: 3 },
                    { startSecond: 3, endSecond: 8 },
                    { startSecond: 8, endSecond: 15 },
                ],
                [{ type: "dialogue", startSecond: 3, endSecond: 8 }],
                "SH01",
            ),
        ).toEqual([]);
        expect(
            validateDramaFrameTiming(
                [
                    { startSecond: 0, endSecond: 2.5 },
                    { startSecond: 2.5, endSecond: 6.5 },
                    { startSecond: 6.5, endSecond: 10.5 },
                    { startSecond: 10.5, endSecond: 15 },
                ],
                [{ type: "dialogue", startSecond: 1.1, endSecond: 5.8 }],
                "SH01",
            ),
        ).toEqual(expect.arrayContaining([expect.stringContaining("不能把对白切在段内")]));
    });

    it("rejects a public dialogue card whose mouth window is shorter than its utterance", () => {
        const text = "甲".repeat(25);
        const prompt = [
            "### 镜头 01 | 0-4秒 | 近景 | 65mm | 侧45度平视 | 锁定眼睛与嘴部 | 人物镜头",
            "场景：室内长案。",
            "画面内容：人物开口，眉心收紧，手指压住衣料。",
            "光影：冷光落在眼睛和手背。",
            "色调：冷青白。",
            `台词：萧炎说：“${text}”`,
            "人声：压低声线。",
            "音效：衣料轻响。",
        ].join("\n");
        expect(validateDramaVideoPromptDialogueTiming(prompt, [{ startSecond: 0, endSecond: 4 }], [{ type: "dialogue", speaker: "萧炎", text }], "SH01")).toEqual(expect.arrayContaining([expect.stringContaining("台词窗口不足")]));
    });

    it("requires a causal trigger, visible result, and sound anchor for an executable frame", () => {
        expect(validateDramaFrameCausalChain("萧炎抬眼", "", "萧炎停住", "SH01/F01")).toEqual(expect.arrayContaining([expect.stringContaining("触发"), expect.stringContaining("声音锚点")]));
        expect(validateDramaFrameCausalChain("听见门外脚步，萧炎压住桌沿", "衣料摩擦后纳兰收回手", "指节收紧发白，视线停在门缝", "SH01/F01")).toEqual([]);
    });

    it("does not treat keyframe boundaries as implicit cuts", () => {
        const prompt = "时间段动作：0-10秒；10-21秒；21-30秒\n单一主运镜：镜头模式：连续镜头；中景平视沿中央长桌缓慢推进";
        expect(
            validateDramaCameraPlan(prompt, [
                { startSecond: 0, endSecond: 10 },
                { startSecond: 10, endSecond: 21 },
                { startSecond: 21, endSecond: 30 },
            ]),
        ).toBe("");
    });

    it("requires complete, frame-aligned camera cut events", () => {
        const prompt = [
            "时间段动作：0-10秒；10-21秒；21-30秒",
            "单一主运镜：镜头模式：内部切镜（1次）；先中景固定，再切近景",
            "可见衔接：镜头事件：10秒；类型：硬切；触发事件：萧炎抬眼质问；新机位：近景平视锁定萧炎与纳兰；切后主运镜：锁定机位，随萧炎呼吸保留极轻微手持；信息目的：把家族压力收束到质问；承接：沿180度轴线接住萧炎视线",
        ].join("\n");
        expect(
            validateDramaCameraPlan(prompt, [
                { startSecond: 0, endSecond: 10 },
                { startSecond: 10, endSecond: 21 },
                { startSecond: 21, endSecond: 30 },
            ]),
        ).toBe("");
        expect(
            validateDramaCameraPlan(prompt.replace("切后主运镜：锁定机位，随萧炎呼吸保留极轻微手持；", ""), [
                { startSecond: 0, endSecond: 10 },
                { startSecond: 10, endSecond: 21 },
                { startSecond: 21, endSecond: 30 },
            ]),
        ).toContain("切后主运镜");
        expect(
            validateDramaCameraPlan(prompt.replace("镜头事件：10秒", "镜头事件：11秒"), [
                { startSecond: 0, endSecond: 10 },
                { startSecond: 10, endSecond: 21 },
                { startSecond: 21, endSecond: 30 },
            ]),
        ).toContain("段起点边界");
    });

    it("blocks mechanical action, emotion, NPC, and camera-motivation repetition in Agent authoring", () => {
        const performancePlan = {
            emotionalObjective: "把私人难堪转成维护父亲族长颜面的质问",
            emotionalArc: "由压抑承受到抬眼质问再到停住呼吸等待回应",
            speechStyle: "冷笑压怒，提到父亲时重音下沉",
            pace: "前段短促，中段连续，结尾放慢",
            breath: "起始压住呼吸，中段短吸，结束屏息",
            restraintLevel: "由克制转为锋利",
            beats: {
                start: { emotion: "承受难堪", facialAction: "眼睑下压", gaze: "看向桌面", bodyAction: "肩背低伏，指节贴住桌沿" },
                middle: { emotion: "转为质问", facialAction: "眉心收紧", gaze: "从萧战转回纳兰", bodyAction: "肩背抬高，右手压住桌沿" },
                end: { emotion: "冷硬停顿", facialAction: "嘴角冷笑收平", gaze: "直视纳兰", bodyAction: "下颌定住并屏息" },
            },
        };
        const frames = [
            {
                startSecond: 0,
                endSecond: 10,
                actionPrompt: "萧炎抬眼接住纳兰视线，右手指节压住桌沿\nNPC群像：7名；分布：前景2名、中景3名、后景2名；密度：中低密度；反应：旁听者收声低头",
                transitionPrompt: "纳兰视线不移",
                endPrompt: "萧炎抬眼，右手仍压住桌沿",
            },
            {
                startSecond: 10,
                endSecond: 21,
                actionPrompt: "萧炎说到父亲时短促吸气，肩背抬高并回看萧战\nNPC群像：7名；分布：前景2名、中景3名、后景2名；密度：中低密度；反应：中景三人抬眼看向首位",
                transitionPrompt: "萧战离开椅背",
                endPrompt: "萧炎肩背直起并回看纳兰",
            },
        ];
        const prompt = "单一主运镜：镜头模式：连续镜头；中景平视沿中央长桌缓慢推进，服务于萧炎抬眼锁定纳兰的视线压力";
        expect(validateDramaVideoAuthoringQuality(prompt, frames, performancePlan, "SH01", { requiresBackgroundNpc: true })).toEqual([]);

        const repeatedFrames = frames.map((frame) => ({ ...frame, actionPrompt: frames[0].actionPrompt }));
        const repeatedPlan = { ...performancePlan, beats: { start: performancePlan.beats.start, middle: performancePlan.beats.start, end: performancePlan.beats.start } };
        const errors = validateDramaVideoAuthoringQuality("单一主运镜：镜头模式：连续镜头；中景平视沿中央长桌缓慢推进，服务于当前信息或动作变化", repeatedFrames, repeatedPlan, "SH01", { requiresBackgroundNpc: true });
        expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("动作完全重复"), expect.stringContaining("情绪递进"), expect.stringContaining("NPC 反应没有变化"), expect.stringContaining("主运镜缺少具体动机")]));
    });
});
