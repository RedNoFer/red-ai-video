import type { DramaAuthoringSourceSnapshot, DramaProductionPackageV1, DramaQualityGateCheck, DramaQualityGateReport } from "@/lib/drama-project-contract";
import { dramaDialogueTimingReminder, hasQuotedDramaDialogue, type DramaDialogueTimingInput } from "@/lib/drama-dialogue-timing";
import { DRAMA_DENSE_HARD_CUT_RANGE_30S } from "@/lib/drama-production-plan";
import { validateDramaVideoPromptTemplateLayout } from "@/lib/drama-prompt-quality";
import { DRAMA_PACKAGE_GATE_CODES, DRAMA_PACKAGE_SECTIONS } from "@/lib/server/drama-production-package-contract";

export type DramaAuthoringQualityInput = {
    package: DramaProductionPackageV1;
    sources: readonly DramaAuthoringSourceSnapshot[];
    targetNarrativeChapter?: number | string;
};

export class DramaAuthoringQualityGateError extends Error {
    constructor(
        message: string,
        readonly report: DramaQualityGateReport,
    ) {
        super(message);
        this.name = "DramaAuthoringQualityGateError";
    }
}

const genericActionPattern = /^(?:自然反应|情绪加剧|准备回应|保持状态|承受压力|电影感推进|动作展开|关键变化|结果状态|动作节点已经成立|保持一致)$/u;
const observableActionPattern = /抬|低|看|望|移|转|起身|前倾|后退|按|压|握|松|收|推|拉|停|吸气|呼吸|屏息|皱|眯|睁|闭|抬手|放下|落下|走|跪|拍|碰|拿|放|递|撕|捏|拔|挥|闪|震|响|开门|关门|离开|进入|凝视|回看/u;
const observableResultPattern = /停在|落在|变为|变得|露出|显出|抬起|垂下|松开|收紧|移向|转向|对准|接住|落下|留下|响起|静止|形成|暴露|显现|被看见|无人插话|沉默|低头|抬眼|受力|改变/u;
const actionFactPattern = /因为|由于|于是|随后|最终|决定|提出|答应|拒绝|要求|悔婚|退婚|离开|进入|走进|看见|发现|说|喊|跪|拔|抬|转身|交给|拿起|放下|撞|倒|死|活|承认|质问|回应/u;
const cinematicPlaceholderPattern = /^(?:入口构图已建立|动作展开|关键变化|结果状态|动作节点已经成立|主体的眉眼、呼吸、手部和道具接触关系清晰可见|情绪通过身体动作呈现)$/u;
const denseCutExceptionPattern = /(?:减切原因|减切理由)\s*[：:]\s*(?:(?:静态留白|结果停留|凝视停留|供应商能力限制|供应商限制)[^。\n；;]*)/u;

export function validateDramaAuthoringQuality(input: DramaAuthoringQualityInput): DramaQualityGateReport {
    const checks: DramaQualityGateCheck[] = [];
    const sourceText = input.sources
        .filter((source) => source.role === "story-source" && source.type === "text")
        .map((source) => source.textContent || "")
        .join("\n");

    checkLiteraryCompleteness(checks, input.package, sourceText, input.targetNarrativeChapter);
    checkDialogueCoverage(checks, input.package, sourceText);
    checkDialogueCapacity(checks, input.package);
    checkDialoguePerformanceQuality(checks, input.package);
    checkVideoPromptLayout(checks, input.package);
    checkPlotFacts(checks, input.package, sourceText);
    checkActionDensity(checks, input.package);
    checkActionDifference(checks, input.package);
    checkEmotionProgression(checks, input.package);
    checkNpcReactionChange(checks, input.package);
    checkNpcContinuityWarnings(checks, input.package);
    checkVisualClarityWarnings(checks, input.package);
    checkCameraMotivation(checks, input.package);
    checkCameraEvents(checks, input.package);
    checkSimpleStructuralChecks(checks, input.package);

    return {
        status: checks.some((check) => check.severity === "blocker") ? "blocked" : "passed",
        checks,
    };
}

function checkDialogueCapacity(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const blockers: string[] = [];
    const reminders: string[] = [];
    for (const episode of value.episodes) {
        for (const shot of episode.shots) {
            const issue = dramaDialogueTimingReminder(shot.duration, shot.utterances as DramaDialogueTimingInput[], shot.dialogue, `${episode.code}/${shot.code}`);
            if (!issue) continue;
            if (issue.withinTolerance) reminders.push(issue.message);
            else blockers.push(issue.message);
        }
    }
    checks.push({
        code: "DIALOGUE_CAPACITY",
        severity: blockers.length ? "blocker" : "warning",
        scope: "对白容量",
        evidence: blockers.length
            ? blockers.slice(0, 8).join("；")
            : reminders.length
              ? `存在 ${reminders.length} 个未超过上线容差的轻微对白容量偏差：${reminders.slice(0, 3).join("；")}`
              : "每个含对白逻辑片段的自然语速、停顿和镜头时长匹配",
        sourceRefs: ["episodes[].shots[].utterances", "episodes[].shots[].duration"],
        fixHint: "先按自然语速和停顿计算对白容量，再在自然分句、说话人转换、动作反应或逻辑片段边界处拆分；不得把一秒内读不完的台词压进镜头。",
    });
}

function checkVideoPromptLayout(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures = value.episodes.flatMap((episode) => episode.shots.flatMap((shot) => validateDramaVideoPromptTemplateLayout(shot.videoPrompt, shot.framePlan?.frames.length || 0, shot.code || shot.title)));
    add(
        checks,
        "VIDEO_PROMPT_LAYOUT",
        !failures.length,
        "视频提示词排版",
        failures.length ? failures.slice(0, 8).join("；") : "每个镜头都使用总则、素材、故事意图、空间、灯光、摄影、逐镜头时间线和硬性禁止八段结构",
        ["episodes[].shots[].videoPrompt", "episodes[].shots[].framePlan.frames[]"],
        "按固定视频 Prompt 成稿骨架重写：依次提供【重要剪辑指令】【素材绑定】【故事意图】【空间与连续性】【灯光与画面】【摄影总则】【逐镜头时间线】【硬性禁止】，并让每个时间段对应一个“镜头N”段落。",
    );
}

function checkLiteraryCompleteness(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1, sourceText: string, targetNarrativeChapter?: number | string) {
    const episode = value.episodes[0];
    const script = episode?.script.trim() || "";
    const sourceHeading = targetNarrativeChapter === undefined ? "" : `第${String(targetNarrativeChapter).replace(/^第|章$/gu, "")}章`;
    const sourceDeclaresChapter = sourceHeading ? new RegExp(`第\\s*${escapeRegExp(String(targetNarrativeChapter).replace(/^第|章$/gu, ""))}\\s*章`, "u").test(sourceText) : false;
    const packageDeclaresChapter = sourceHeading ? new RegExp(`第\\s*${escapeRegExp(String(targetNarrativeChapter).replace(/^第|章$/gu, ""))}\\s*章`, "u").test(`${episode?.sourceRange || ""}\n${script}`) : true;
    const paragraphCount = script
        .split(/\n{2,}|(?<=[。！？])\s*/u)
        .map((part) => part.trim())
        .filter(Boolean).length;
    const hasScene = /(?:场景|场\s*[一二三四五六七八九十0-9]+|内景|外景|日|夜|时间码|镜号)/u.test(script) || Boolean(episode?.storyScenes.length);
    const hasBehavior = observableActionPattern.test(script);
    const hasConflict = /冲突|质问|拒绝|答应|威胁|难堪|秘密|目标|阻力|决定|回应|离开|留下|转折/u.test(`${script}\n${episode?.outline || ""}`);
    const hasResult = Boolean(episode?.hook?.trim() || episode?.nextPreview?.trim() || episode?.shots.some((shot) => shot.exitState || shot.continuity?.actionEnd?.trim()));
    const summaryOnly = /^(?:听着|随后|最终|本集|故事|剧情|画面|镜头|角色).{0,180}(?:发生|展开|冲突|离开|回到|结束)[。！？.]?$/u.test(script) && paragraphCount <= 2;
    const complete = script.length >= 240 && paragraphCount >= 3 && hasScene && hasBehavior && hasConflict && hasResult && !summaryOnly;
    const evidence = `文学正文 ${script.length} 字，${paragraphCount} 个叙事段；场次=${hasScene ? "有" : "无"}，行为=${hasBehavior ? "有" : "无"}，冲突=${hasConflict ? "有" : "无"}，结果=${hasResult ? "有" : "无"}`;
    add(checks, "LITERARY_SCRIPT_COMPLETENESS", complete, "当前集文学剧本", evidence, ["currentEpisode.script", "currentEpisode.storyScenes"], "补写完整场次、人物行为、冲突推进、对白和可见结果；禁止只提交摘要或镜头概述。");
    const sectionTitles = value.archive?.sections.map((section) => section.title) || [];
    const hasFixedChapterStructure = sectionTitles.length === DRAMA_PACKAGE_SECTIONS.length && DRAMA_PACKAGE_SECTIONS.every((title, index) => sectionTitles[index]?.includes(title));
    add(
        checks,
        "LITERARY_SCRIPT_COMPLETENESS",
        hasFixedChapterStructure,
        "制作包固定章节",
        hasFixedChapterStructure ? "已包含并按顺序提供 13 个固定一级章节" : `固定一级章节应为 ${DRAMA_PACKAGE_SECTIONS.length} 个且顺序一致，当前为 ${sectionTitles.length} 个`,
        ["archive.sections", "drama-production-package-v1"],
        "按唯一制作包契约补齐 13 个固定一级章节；“小说第 3 章”只表示剧情素材范围，不替代制作包第 3 节。",
    );
    if (sourceDeclaresChapter && !packageDeclaresChapter)
        add(
            checks,
            "LITERARY_SCRIPT_COMPLETENESS",
            false,
            "目标小说章节",
            `TXT 明确声明${sourceHeading}，但制作包正文没有对应目标章节标识`,
            ["story-source", "currentEpisode.sourceRange"],
            "保留 targetNarrativeChapter 对应的小说章节事实；制作包第 3 节“第一集文学剧本”只是结构章节，不得替代小说章节。",
        );
    else add(checks, "LITERARY_SCRIPT_COMPLETENESS", true, "目标小说章节", `targetNarrativeChapter=${String(targetNarrativeChapter ?? "未声明")}；制作包一级章节编号与小说章节独立`, ["targetNarrativeChapter"], "");
}

function checkDialogueCoverage(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1, sourceText: string) {
    const lines = extractDialogueLines(sourceText);
    const episode = value.episodes[0];
    const literaryText = episode?.script || "";
    const sequenceText = [
        ...(episode?.shots || []).flatMap((shot) => [shot.dialogue || "", ...(shot.utterances || []).map((utterance) => utterance.text), shot.videoPrompt || ""]),
        ...(value.archive?.dialogueDirections || []).map((direction) => direction.text),
    ].join("\n");
    const missingLiterary = lines.filter((line) => !containsNormalized(literaryText, line));
    const missingSequence = lines.filter((line) => !containsNormalized(sequenceText, line));
    const utterances = episode?.shots.flatMap((shot) => shot.utterances || []) || [];
    const directions = value.archive?.dialogueDirections || [];
    const missingFormat = utterances.filter((utterance) => utterance.type === "dialogue" && (!utterance.speaker || !hasQuotedDramaDialogue(sequenceText, utterance.speaker, utterance.text)));
    const missingMetadata = lines.filter((line) => {
        const utterance = utterances.find((item) => containsNormalized(item.text, line));
        const direction = directions.find((item) => containsNormalized(item.text, line));
        return !(
            (utterance && utterance.speaker && utterance.startSecond !== undefined && utterance.endSecond !== undefined && utterance.endSecond > utterance.startSecond) ||
            (direction && direction.speaker && direction.startSecond !== undefined && direction.endSecond !== undefined)
        );
    });
    const complete = !missingLiterary.length && !missingSequence.length && !missingMetadata.length && !missingFormat.length;
    const evidence = lines.length
        ? `TXT 显式对白 ${lines.length} 句；文学正文缺失 ${missingLiterary.length} 句；台词/镜头序列缺失 ${missingSequence.length} 句；说话人/时间缺失 ${missingMetadata.length} 句；说话格式缺失 ${missingFormat.length} 句`
        : utterances.length
          ? `结构化对白 ${utterances.length} 句；说话格式缺失 ${missingFormat.length} 句`
          : "TXT 未提取到带引号的显式对白，按无对白素材处理";
    add(checks, "DIALOGUE_COVERAGE", complete, "对白覆盖率", evidence, ["story-source", "currentEpisode.script", "episodes[].shots[].utterances"], "逐句补回 TXT 原对白，并绑定说话人、镜头、时间和表演信息；不得静默遗漏或无授权改写。");
}

function checkDialoguePerformanceQuality(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures: string[] = [];
    for (const episode of value.episodes) {
        for (const shot of episode.shots) {
            const utterances = shot.utterances.filter((utterance) => utterance.type === "dialogue" && utterance.startSecond !== undefined && utterance.endSecond !== undefined);
            if (!utterances.length) continue;
            const frames = shot.framePlan?.frames || [];
            const segmentPerformances = frames.map((frame) => {
                const segmentText = [frame.actionPrompt, frame.transitionPrompt || "", frame.endPrompt || ""].join("\n");
                const spoken = utterances.filter((utterance) => Number(utterance.startSecond) < frame.endSecond && Number(utterance.endSecond) > frame.startSecond);
                return { frame, segmentText, spoken };
            });
            const performanceBlocks: string[] = [];
            for (const { frame, segmentText, spoken } of segmentPerformances) {
                const label = `${shot.code || shot.title}/${frame.id}`;
                const performanceMatch = segmentText.match(/对白表演\s*[：:]([^\n]+)/u);
                const directDialogueMatch = performanceMatch ? null : segmentText.match(/(?:^|[\n；;])\s*[^：:；;\n]{1,32}?\s*说\s*[：:]\s*“[^”\n]{1,240}”(?:[；;][^\n]*)?/u);
                if (!performanceMatch && !directDialogueMatch) {
                    if (!spoken.length && frame.startSecond >= Math.max(...utterances.map((utterance) => Number(utterance.endSecond)))) {
                        const hasSilenceResult = /对白结束|对白后|反应停顿|静默|沉默/u.test(segmentText) && /视线|目光|呼吸|肩|身体|手|指|嘴角|下颌|僵|停住|低头|抬眼/u.test(segmentText);
                        if (!hasSilenceResult) failures.push(`${label}对白结束后缺少具体静默/反应结果`);
                    } else failures.push(`${label}缺少对白表演：说话人、语气、停顿、重音、说后反应`);
                    continue;
                }
                const block = (performanceMatch?.[1] || directDialogueMatch?.[0] || "").replace(/^[\n；;]\s*/u, "").trim();
                performanceBlocks.push(block);
                const missing = ["说话人", "语气", "停顿", "重音", "说后反应"].filter((field) =>
                    field === "说话人" ? !new RegExp(`${field}\\s*[：:]\\s*[^；;\\n]+`, "u").test(block) && !hasQuotedDramaDialogue(block) : !new RegExp(`${field}\\s*[：:]\\s*[^；;\\n]+`, "u").test(block),
                );
                if (missing.length) failures.push(`${label}对白表演缺少${missing.join("、")}`);
                if (spoken.length && spoken.some((utterance) => !utterance.speaker || !hasQuotedDramaDialogue(segmentText, utterance.speaker))) failures.push(`${label}对白必须逐段写成“说话人说：“实际台词””格式，不能只写说话人、语气或重音`);
                if (/随本段|当前冲突信息|接住下一状态|动作触发前后留出|按台词表执行|自然反应|保持状态|情绪加剧|准备回应/u.test(block)) failures.push(`${label}对白表演仍是模板化描述`);
                const after = block.match(/说后反应\s*[：:]\s*([^；;\n]+)/u)?.[1] || "";
                if (!after || !/视线|目光|呼吸|肩|身体|手|指|嘴角|下颌|僵|停住|低头|抬眼|前倾|收紧|松开|转向/u.test(after)) failures.push(`${label}说后反应没有落到具体可见结果`);
                if (spoken.length && !spoken.some((utterance) => block.includes(utterance.speaker))) failures.push(`${label}对白表演没有绑定当前说话人`);
            }
            for (let index = 1; index < performanceBlocks.length; index += 1) {
                if (normalizeQualityText(performanceBlocks[index]) === normalizeQualityText(performanceBlocks[index - 1])) failures.push(`${shot.code || shot.title}相邻对白表演重复，必须随当前台词和动作节点变化`);
            }
        }
    }
    add(
        checks,
        "DIALOGUE_PERFORMANCE",
        !failures.length,
        "对白表演质量",
        failures.length ? failures.slice(0, 8).join("；") : "每个对白时间段均绑定当前说话人、带完整引号台词，并写出具体语气、停顿、重音和说后可见反应",
        ["episodes[].shots[].videoPrompt", "episodes[].shots[].framePlan.frames[]", "episodes[].shots[].utterances"],
        "按当前台词和时间段重写具体表演；对白统一使用“说话人说：“实际台词””格式，禁止把台词塞进重音字段；对白结束段改为明确的呼吸、视线、身体或道具静默结果，禁止复制模板句。",
    );
}

function normalizeQualityText(value: string) {
    return value.replace(/[，。；：、,.!?！？\s]+/gu, "").trim();
}

function checkPlotFacts(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1, sourceText: string) {
    const facts = extractPlotFacts(sourceText);
    const missing = facts.filter((fact) => {
        const tokens = Array.from(new Set(factTokens(fact).filter((token) => token.length > 1)));
        const hits = tokens.filter((token) => valueTextIncludes(value, token)).length;
        return hits < Math.min(tokens.length, tokens.length >= 4 ? 2 : 1);
    });
    const covered = facts.length - missing.length;
    const complete = !facts.length || !missing.length;
    add(
        checks,
        "PLOT_FACT_COVERAGE",
        complete,
        "剧情事实覆盖率",
        facts.length ? `TXT 关键事实 ${facts.length} 条；已覆盖 ${covered} 条；缺失 ${missing.length} 条` : "TXT 未提取到可判定的关键事实",
        ["story-source", "currentEpisode", "episodes"],
        "将 TXT 中的角色、场景、道具、关系、冲突原因、关键事件、因果结果和关键动作落到文学正文或对应制作包字段。",
    );
    for (const fact of missing.slice(0, 3)) add(checks, "PLOT_FACT_COVERAGE", false, "剧情事实覆盖率", `未找到事实锚点：${fact.slice(0, 80)}`, ["story-source"], "保留该事实的可识别名称或动作结果，避免只用泛化摘要替代。");
}

function checkActionDensity(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const missing: string[] = [];
    for (const episode of value.episodes) {
        for (const shot of episode.shots) {
            const frames = shot.framePlan?.frames || [];
            for (const frame of frames) {
                const action = frame.actionPrompt.trim();
                const result = `${frame.endPrompt || ""}\n${frame.transitionPrompt || ""}\n${frame.imagePrompt}`.trim();
                if (!action || genericActionPattern.test(action) || !observableActionPattern.test(action) || !result || !observableResultPattern.test(result) || cinematicPlaceholderPattern.test(result)) missing.push(`${shot.code}/${frame.id}`);
            }
        }
    }
    add(
        checks,
        "ACTION_DENSITY",
        !missing.length,
        "逐时间段动作密度",
        missing.length ? `${missing.length} 个时间段缺少“触发→可见变化→结果”闭环：${missing.slice(0, 5).join(", ")}` : "每个真实时间段都有可观察动作和结果状态",
        ["episodes[].shots[].framePlan.frames[]"],
        "每段写清动作触发、人物可见变化，以及对手/NPC/道具/环境的结果；抽象词不能代替动作。",
    );
}

function checkActionDifference(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const repeated: string[] = [];
    for (const episode of value.episodes) {
        for (const shot of episode.shots) {
            const frames = shot.framePlan?.frames || [];
            const signatures = frames.map((frame) => actionSignature(frame.actionPrompt));
            if (signatures.length > 1 && new Set(signatures).size < 2) repeated.push(shot.code);
        }
    }
    add(
        checks,
        "ACTION_DIFFERENCE",
        !repeated.length,
        "相邻动作差异",
        repeated.length ? `镜头 ${repeated.join(", ")} 的全部时间段重复同一动作块` : "相邻时间段存在可辨识的动作、视线、姿态、手部、道具或环境差异",
        ["framePlan.frames[].actionPrompt"],
        "按真实事件重新拆分相邻段，至少改变一个可验收的动作结果，不能只替换同义词。",
    );
}

function checkEmotionProgression(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failed: string[] = [];
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        const beats = shot.performancePlan?.beats;
        if (!beats) {
            failed.push(shot.code);
            continue;
        }
        const values = [beats.start, beats.middle, beats.end].map((beat) => [beat.emotion, beat.facialAction, beat.gaze, beat.bodyAction].join("|"));
        if (values.some((value) => value.length < 8) || new Set(values).size < 3 || values.some((value) => /自然|到位|逐步变化|结果成立|保持状态|情绪加剧/u.test(value))) failed.push(shot.code);
    }
    add(
        checks,
        "EMOTION_PROGRESSION",
        !failed.length,
        "表演情绪递进",
        failed.length ? `镜头 ${failed.join(", ")} 的 start/middle/end 不能证明三阶段可见递进` : "每镜表演计划具备不同的起始、中段和结束可见状态",
        ["episodes[].shots[].performancePlan"],
        "将情绪拆成眉眼、视线、呼吸、嘴角、重心、手部或身体的三阶段变化，不要只更换情绪形容词。",
    );
}

function checkNpcReactionChange(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failed: string[] = [];
    for (const episode of value.episodes) {
        for (const shot of episode.shots) {
            const required = value.assets.locations.find((location) => location.code === shot.locationCode)?.backgroundNpcPolicy?.mode === "required";
            const prompts = [shot.videoPrompt || "", ...(shot.framePlan?.frames || []).map((frame) => `${frame.actionPrompt}\n${frame.transitionPrompt || ""}\n${frame.endPrompt || ""}`)];
            const reactions = prompts.flatMap((prompt) => [...prompt.matchAll(/(?:反应|可见反应|状态变化)\s*[：:]\s*([^；;\n。]+)/gu)].map((match) => match[1].trim())).filter(Boolean);
            if ((required || reactions.length) && new Set(reactions).size < 2) failed.push(shot.code);
        }
    }
    add(
        checks,
        "NPC_REACTION_CHANGE",
        !failed.length,
        "NPC 群像反应变化",
        failed.length ? `镜头 ${failed.join(", ")} 的 NPC 反应没有形成至少两种可见结果` : "required NPC 或已声明 NPC 的群像反应存在变化，或当前没有 NPC 事实",
        ["backgroundNpcPolicy", "videoPrompt", "framePlan.frames"],
        "按事件改变群像的收声、视线、姿态、分布或密度；不要在每段重复“旁听、屏息、保持关注”。",
    );
}

function checkNpcContinuityWarnings(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const warnings: string[] = [];
    for (const location of value.assets.locations) {
        const policy = location.backgroundNpcPolicy;
        if (!policy || policy.mode === "forbidden") continue;
        const roster = policy.roster || [];
        const duplicateIds = roster.map((slot) => slot.slotId).filter((slotId, index, all) => all.indexOf(slotId) !== index);
        if (policy.mode === "required" && !roster.length) warnings.push(`${location.code} 未声明稳定 NPC 槽位`);
        if (duplicateIds.length) warnings.push(`${location.code} 的 NPC 槽位 ID 重复：${Array.from(new Set(duplicateIds)).join("、")}`);
        if (!roster.length) continue;
        for (const shot of value.episodes.flatMap((episode) => episode.shots.filter((item) => item.locationCode === location.code))) {
            const text = `${shot.videoPrompt || ""}\n${(shot.framePlan?.frames || []).map((frame) => `${frame.actionPrompt}\n${frame.transitionPrompt || ""}\n${frame.endPrompt || ""}`).join("\n")}`;
            if (/NPC群像|旁听|旁观者|路人/u.test(text) && !roster.some((slot) => text.includes(slot.slotId) || text.includes(slot.worldAnchor))) warnings.push(`${shot.code} 使用 NPC 群像但没有引用稳定槽位或世界锚点`);
        }
    }
    addWarning(
        checks,
        "NPC_ROSTER_CONTINUITY",
        warnings.length ? warnings.join("；") : "NPC 群像具备稳定槽位或当前没有需要连续追踪的背景群像",
        ["assets.locations[].backgroundNpcPolicy.roster", "videoPrompt", "framePlan.frames"],
        "为跨镜头 NPC 建立 slotId、世界空间锚点、稳定变体和默认状态；镜头只引用当前可见槽位及其变化。",
    );
}

function checkVisualClarityWarnings(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const warnings: string[] = [];
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        const text = `${shot.imagePrompt || ""}\n${shot.videoPrompt || ""}\n${(shot.framePlan?.frames || []).map((frame) => frame.imagePrompt).join("\n")}`;
        const hasUnqualifiedBlur = /模糊|虚焦|焦外|浅景深|雾化|泛光|光晕/u.test(text) && !/明确要求|有意|只保留.*清晰|背影.*虚焦|背景.*虚焦.*主体.*清晰/u.test(text);
        const hasClarityAnchor = /清晰|可辨|完整入画|不遮挡|保持脸部|五官.*可见|结构.*可读/u.test(text);
        if (hasUnqualifiedBlur) warnings.push(`${shot.code} 使用了未说明原因的模糊/虚焦/浅景深`);
        if (!hasClarityAnchor) warnings.push(`${shot.code} 未明确当前景别下的主体清晰度`);
    }
    addWarning(
        checks,
        "VISUAL_CLARITY",
        warnings.length ? warnings.join("；") : "可见主体具有清晰度合同或明确的有意模糊说明",
        ["project.ratio", "imagePrompt", "videoPrompt", "framePlan.frames[].imagePrompt"],
        "默认让主角、关键 NPC、道具和场景锚点清晰可辨；信息过载时拆镜，不缩小或虚化全部主体。",
    );
}

function checkCameraMotivation(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failed: string[] = [];
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        const text = `${shot.cameraMotion || ""}\n${shot.videoPrompt || ""}`;
        const hasCamera = /机位|景别|角度|焦段|固定|推|拉|摇|移|跟拍|环绕|镜头/u.test(text);
        const hasConcretePurpose = /为了|服务于|让观众看见|揭示|强调|承接|跟随|锁定|暴露|突出|把[^。；\n]{0,20}(?:看见|传给|压到|推向)/u.test(text);
        const genericPurpose = /服务于当前(?:信息|动作)变化|电影感推进|中轴缓慢推进/u.test(text) && !hasConcretePurpose;
        if (!hasCamera || !hasConcretePurpose || genericPurpose) failed.push(shot.code);
    }
    add(
        checks,
        "CAMERA_MOTIVATION",
        !failed.length,
        "运镜动机",
        failed.length ? `镜头 ${failed.join(", ")} 缺少具体机位路径或可见信息目的` : "每镜摄影路径与当前可见动作/信息变化绑定",
        ["cameraMotion", "videoPrompt"],
        "写明景别/角度、固定或运动路径、方向及其服务的具体可见变化，不要只写“电影感推进”。",
    );
}

function checkCameraEvents(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failed: string[] = [];
    const productionPlan = value.project.productionBible?.productionPlan;
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        const prompt = shot.videoPrompt || "";
        const eventLines = [...prompt.matchAll(/镜头事件\s*[：:]\s*([^\n]+)/gu)].map((match) => match[1]);
        const hasCut = /(?:\bCut\s+to\b|\bCamera\s+cut\s+to\b|镜头事件\s*[：:])/iu.test(prompt);
        const internal = /镜头模式\s*[：:]\s*内部切镜/u.test(prompt);
        const inferredInternal = !internal && eventLines.length > 0;
        const denseMaterial = `${productionPlan?.customDirectorRules || ""}\n${prompt}`;
        const denseRequested = shot.duration === 30 && (productionPlan?.video?.internalCutPolicy === "dense-30s" || /高密度硬切|7\s*[—-]\s*10\s*次(?:可见)?硬切/u.test(denseMaterial));
        const denseCutException = denseRequested && denseCutExceptionPattern.test(denseMaterial);
        if (hasCut && !internal && !inferredInternal) failed.push(`${shot.code}:未声明内部切镜`);
        if (internal || inferredInternal) {
            const events = eventLines;
            if (!events.length || events.some((event) => !/(?:时间|秒).{0,12}(?:类型|硬切|匹配切|插入|甩镜).{0,40}(?:触发事件).{0,80}(?:新机位).{0,100}(?:切后主运镜).{0,100}(?:信息目的).{0,100}(?:承接)/u.test(event)))
                failed.push(`${shot.code}:镜头事件字段不完整`);
            const starts = new Set((shot.framePlan?.frames || []).map((frame) => Number(frame.startSecond).toFixed(3)));
            for (const event of events) {
                const match = event.match(/(?:时间|发生时间)\s*[：:]?\s*(\d+(?:\.\d+)?)\s*秒/u);
                if (match && !starts.has(Number(match[1]).toFixed(3))) failed.push(`${shot.code}:切点未对齐帧边界`);
            }
            if (denseRequested) {
                const hardCutCount = events.filter((event) => /类型\s*[：:]\s*硬切/u.test(event)).length;
                const frameCount = shot.framePlan?.frames.length || 0;
                const outsideMaximum = hardCutCount > DRAMA_DENSE_HARD_CUT_RANGE_30S.max || frameCount > DRAMA_DENSE_HARD_CUT_RANGE_30S.max + 1;
                const belowTargetWithoutReason = !denseCutException && (hardCutCount < DRAMA_DENSE_HARD_CUT_RANGE_30S.min || frameCount < DRAMA_DENSE_HARD_CUT_RANGE_30S.min + 1);
                if (outsideMaximum || belowTargetWithoutReason)
                    failed.push(
                        denseCutException
                            ? `${shot.code}:已记录减切原因，但不得超过10次硬切/11个帧段，当前为${frameCount}帧/${hardCutCount}次硬切`
                            : `${shot.code}:30秒高密度硬切需用8—11个帧段承载7—10次硬切；若确需少切，必须写明“减切原因：静态留白/结果停留/供应商能力限制”，当前为${frameCount}帧/${hardCutCount}次硬切`,
                    );
            }
        }
    }
    add(
        checks,
        "CAMERA_EVENT",
        !failed.length,
        "镜头事件",
        failed.length ? failed.join("；") : "未声明切镜的镜头没有出现隐式 Cut；声明内部切镜时字段和边界完整",
        ["videoPrompt", "framePlan.frames[].startSecond"],
        "出现 Cut to 时先声明“镜头模式：内部切镜”，并在可见衔接写时间、类型、触发事件、新机位、切后主运镜、信息目的和承接；切点必须对齐帧段起点。",
    );
}

function checkSimpleStructuralChecks(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const target = value.project.productionBible?.productionPlan?.video?.shotDuration;
    if (target) {
        const invalid = value.episodes.flatMap((episode) => episode.shots.filter((shot) => shot.duration !== target).map((shot) => `${episode.code}/${shot.code}=${shot.duration}s`));
        add(
            checks,
            "SHOT_DURATION_POLICY",
            !invalid.length,
            "逻辑片段时长",
            invalid.length ? `生产方案要求每个逻辑片段 ${target} 秒，但发现 ${invalid.join("、")}` : `所有逻辑片段均为 ${target} 秒；片段内硬切不改变逻辑片段时长`,
            ["project.productionBible.productionPlan.video.shotDuration", "episodes[].shots[].duration"],
            "先按故事节拍拆成多个逻辑片段，再让每个逻辑片段严格使用生产方案规定的时长；内部帧段/硬切数量不计入片段数量。",
        );
    }
    const timelineValid = value.episodes.every((episode) =>
        episode.shots.every((shot) => {
            const frames = shot.framePlan?.frames || [];
            return frames.length > 0 && frames[0].startSecond === 0 && frames.at(-1)?.endSecond === shot.duration && frames.every((frame, index) => frame.endSecond > frame.startSecond && (index === 0 || frame.startSecond === frames[index - 1].endSecond));
        }),
    );
    add(
        checks,
        "TIMELINE",
        timelineValid,
        "时间轴",
        timelineValid ? "所有镜头从 0 秒连续覆盖，无空洞和重叠" : "至少一个镜头的帧段没有从 0 秒连续覆盖",
        ["framePlan.frames[].startSecond", "framePlan.frames[].endSecond"],
        "修正帧段的起止时间，使其从 0 秒连续覆盖镜头时长。",
    );
    add(
        checks,
        "ASSET_BINDING",
        value.episodes.every((episode) => episode.shots.every((shot) => Boolean(shot.locationCode))),
        "素材绑定",
        "每个镜头都有场景资产编码；角色/道具绑定由结构化规范继续校验",
        ["locationCode", "characterCodes", "propCodes"],
        "只引用当前正式资产的稳定 code，并让正文道具与镜头绑定一致。",
    );
    add(
        checks,
        "CONTINUITY",
        value.episodes.every((episode) => episode.shots.every((shot) => Boolean(shot.entryState && shot.exitState && shot.continuity))),
        "连续性",
        "每个镜头都提供入口、出口和连续性事实",
        ["entryState", "exitState", "continuity"],
        "补充可继承的入口/出口状态、轴线、站位、视线和动作起止。",
    );
    if (value.authoring)
        add(
            checks,
            "PROVENANCE",
            Boolean(value.authoring.source === "executeDramaScriptRun" && value.authoring.contract?.contentHash && value.authoring.directorSkill.contentHash && value.authoring.seedanceSkill.contentHash),
            "来源凭据",
            "已记录 executeDramaScriptRun、契约和两个 Skill 哈希",
            ["authoring"],
            "只允许通过 executeDramaScriptRun 完成最终编排，并记录契约、导演 Skill、Seedance Skill 和来源素材哈希。",
        );
}

function add(checks: DramaQualityGateCheck[], code: string, passed: boolean, scope: string, evidence: string, sourceRefs: string[], fixHint: string) {
    checks.push({ code, severity: passed ? "warning" : "blocker", scope, evidence: passed ? `通过：${evidence}` : evidence, sourceRefs, fixHint });
}

function addWarning(checks: DramaQualityGateCheck[], code: string, evidence: string, sourceRefs: string[], fixHint: string) {
    checks.push({ code, severity: "warning", scope: code, evidence: evidence ? `提示：${evidence}` : "提示：未发现风险", sourceRefs, fixHint });
}

function extractDialogueLines(source: string) {
    return [...source.matchAll(/[“「『]([^”」』\n]{1,240})[”」』]/gu)].map((match) => match[1].trim()).filter(Boolean);
}

function extractPlotFacts(source: string) {
    return source
        .split(/(?<=[。！？；\n])/u)
        .map((part) => part.replace(/^[\s\d.#一二三四五六七八九十、.)]+/u, "").trim())
        .filter((part) => part.length >= 8 && actionFactPattern.test(part) && !/模板|字段|规范|制作包|镜头|Prompt|Skill|哈希/u.test(part))
        .filter((part, index, all) => all.indexOf(part) === index)
        .slice(0, 80);
}

function factTokens(value: string) {
    return value.match(/[\p{Script=Han}]{2,8}/gu) || [];
}

function valueTextIncludes(value: DramaProductionPackageV1, token: string) {
    return packageSearchText(value).includes(token);
}

function packageSearchText(value: DramaProductionPackageV1) {
    return JSON.stringify(value);
}

function containsNormalized(text: string, value: string) {
    return normalizeSearchText(text).includes(normalizeSearchText(value));
}

function normalizeSearchText(value: string) {
    return value.replace(/[\s\u3000]+/gu, "").trim();
}

function actionSignature(value: string) {
    return normalizeSearchText(value)
        .replace(/[，。；：、,.!?！？]/gu, "")
        .slice(0, 72);
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function dramaAuthoringQualityGateCodes() {
    return [...DRAMA_PACKAGE_GATE_CODES];
}
