import type { DramaAuthoringAudit, DramaAuthoringRepairFailure, DramaAuthoringSourceSnapshot, DramaProductionPackageV1, DramaQualityGateCheck, DramaQualityGateReport } from "@/lib/drama-project-contract";
import { dramaDialogueFragmentSequenceError, dramaDialogueTimingReminder, dramaTimedDialogueCapacityIssues, dramaUtteranceTimingIssues, hasQuotedDramaDialogue, type DramaDialogueTimingInput } from "@/lib/drama-dialogue-timing";
import { DRAMA_DENSE_HARD_CUT_RANGE_30S, hasDramaDenseCutRule, hasDramaDenseCutRuleInCustomTemplateSources } from "@/lib/drama-production-plan";
import { hasDramaReferenceAnchorClarity } from "@/lib/drama-prompt-compiler";
import { validateDramaCharacterWardrobeContinuity, validateDramaCutInformationDiversity, validateDramaPromptComposition, validateDramaReferenceAliasConsistency } from "@/lib/drama-prompt-composition-quality";
import {
    extractDramaVideoPromptCards,
    hasConcreteDramaCameraDirection,
    validateDramaFrameCausalChain,
    validateDramaFrameTiming,
    validateDramaVideoPromptCardLayout,
    validateDramaVideoPromptDialogueTiming,
    validateDramaVideoPromptSemanticQuality,
} from "@/lib/drama-prompt-quality";
import { validateDramaContinuityEdges } from "@/lib/drama-continuity-policy";
import { DRAMA_PACKAGE_GATE_CODES, DRAMA_PACKAGE_SECTIONS } from "@/lib/server/drama-production-package-contract";

export type DramaAuthoringQualityInput = {
    package: DramaProductionPackageV1;
    sources: readonly DramaAuthoringSourceSnapshot[];
    targetNarrativeChapter?: number | string;
    authoringAudit?: DramaAuthoringAudit;
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

const SHOT_REPAIR_GATE_CODES = new Set([
    "VIDEO_PROMPT_LAYOUT",
    "VIDEO_PROMPT_SEMANTIC_QUALITY",
    "FRAME_DIALOGUE_TIMING",
    "DIALOGUE_CAPACITY",
    "DIALOGUE_PERFORMANCE",
    "ACTION_DENSITY",
    "ACTION_DIFFERENCE",
    "EMOTION_PROGRESSION",
    "CAMERA_MOTIVATION",
    "CAMERA_EVENT",
    "VISUAL_CLARITY",
    "TIMELINE",
    "COMPOSITION_CONTRACT",
    "SUBJECT_COVERAGE",
    "CUT_INFORMATION_DIVERSITY",
]);

export function buildDramaAuthoringRepairPlan(report: DramaQualityGateReport) {
    const failures = report.checks.filter((check) => check.severity === "blocker");
    const shotFailures = failures.map((check) => {
        const shotIds = check.shotIds?.length ? check.shotIds : extractShotIds(check.evidence);
        const frameIds = check.frameIds?.length ? check.frameIds : extractFrameIds(check.evidence);
        return { check, shotIds, frameIds };
    });
    const shotRepairable = shotFailures.length > 0 && shotFailures.every(({ check, shotIds }) => check.repairScope === "shot" || (SHOT_REPAIR_GATE_CODES.has(check.code) && shotIds.length > 0));
    const uniqueShotIds = [...new Set(shotFailures.flatMap(({ shotIds }) => shotIds))];
    const uniqueFrameIds = [...new Set(shotFailures.flatMap(({ frameIds }) => frameIds))];
    const repairFailures: DramaAuthoringRepairFailure[] = shotFailures.flatMap(({ check, shotIds, frameIds }) =>
        shotIds.map((shotId) => ({
            shotId,
            frameIds,
            gateCode: check.code,
            evidence: check.evidence,
            fixHint: check.fixHint,
            lockedFields: check.lockedFields || ["project", "assets", "episodes[].script", "shots[].duration", "productionPlan", "unfailedShots"],
        })),
    );
    return {
        scope: shotRepairable ? ("shot" as const) : ("package" as const),
        shotIds: uniqueShotIds,
        frameIds: uniqueFrameIds,
        failures: repairFailures,
        fullPackageRepairEligible: !shotRepairable,
    };
}

function extractShotIds(value: string) {
    return [...new Set([...value.matchAll(/(?:^|\/)\b(SH\d+)\b/gu)].map((match) => match[1]))];
}

function extractFrameIds(value: string) {
    return [...new Set([...value.matchAll(/\b(F\d+)\b/gu)].map((match) => match[1]))];
}

const genericActionPattern = /^(?:自然反应|情绪加剧|准备回应|保持状态|承受压力|电影感推进|动作展开|关键变化|结果状态|动作节点已经成立|保持一致)$/u;
const observableActionPattern = /抬|低|看|望|移|转|起身|前倾|后退|按|压|握|松|收|推|拉|停|吸气|呼吸|屏息|皱|眯|睁|闭|抬手|放下|落下|走|跪|拍|碰|拿|放|递|撕|捏|拔|挥|闪|震|响|开门|关门|离开|进入|凝视|回看/u;
const observableResultPattern = /停在|落在|变为|变得|露出|显出|抬起|垂下|松开|收紧|移向|转向|对准|接住|落下|留下|响起|静止|形成|暴露|显现|被看见|无人插话|沉默|低头|抬眼|受力|改变/u;
const actionFactPattern = /因为|由于|于是|随后|最终|决定|提出|答应|拒绝|要求|悔婚|退婚|离开|进入|走进|看见|发现|说|喊|跪|拔|抬|转身|交给|拿起|放下|撞|倒|死|活|承认|质问|回应/u;
const publicSoundAnchorPattern = /人声|呼吸|吸气|吐气|衣料|脚步|碰撞|摩擦|风声|水声|门响|木石|混响|静默|沉默|屏息|余响|底噪|无声/u;
const cinematicPlaceholderPattern = /^(?:入口构图已建立|动作展开|关键变化|结果状态|动作节点已经成立|主体的眉眼、呼吸、手部和道具接触关系清晰可见|情绪通过身体动作呈现)$/u;
const denseCutExceptionPattern = /(?:减切原因|减切理由)\s*[：:]\s*(?:(?:静态留白|结果停留|凝视停留|供应商能力限制|供应商限制)[^。\n；;]*)/u;
const videoPromptPseudoParameterPattern = /(?:palette|saturation|film_stock|grain|halation)\s*=/u;
const videoPromptRuntimePlaceholderPattern = /undefined|null|NaN|\[object Object\]/u;
const videoPromptMaxUnicodeCharacters = 4500;

export function validateDramaAuthoringQuality(input: DramaAuthoringQualityInput): DramaQualityGateReport {
    const checks: DramaQualityGateCheck[] = [];
    const sourceText = input.sources
        .filter((source) => source.role === "story-source" && source.type === "text")
        .map((source) => source.textContent || "")
        .join("\n");
    const customTemplateDenseRule = hasDramaDenseCutRuleInCustomTemplateSources(input.sources);

    checkLiteraryCompleteness(checks, input.package, sourceText, input.targetNarrativeChapter);
    checkDialogueCoverage(checks, input.package, sourceText);
    checkDialogueCapacity(checks, input.package);
    checkFrameDialogueTiming(checks, input.package);
    checkDialoguePerformanceQuality(checks, input.package);
    checkVideoPromptLayout(checks, input.package);
    checkVideoPromptLength(checks, input.package);
    checkVideoPromptSemanticQuality(checks, input.package, input.authoringAudit);
    checkPlotFacts(checks, input.package, sourceText);
    checkActionDensity(checks, input.package);
    checkActionDifference(checks, input.package);
    checkEmotionProgression(checks, input.package);
    checkNpcReactionChange(checks, input.package);
    checkNpcContinuityWarnings(checks, input.package);
    checkVisualClarityWarnings(checks, input.package);
    checkCameraMotivation(checks, input.package, input.authoringAudit);
    checkCameraEvents(checks, input.package, customTemplateDenseRule);
    checkCompositionContract(checks, input.package);
    checkSubjectCoverage(checks, input.package);
    checkCutInformationDiversity(checks, input.package);
    checkReferenceAliasConsistency(checks, input.package);
    checkCharacterWardrobeContinuity(checks, input.package);
    checkPackageSchema(checks, input.package);
    checkProductionPlanCompleteness(checks, input.package);
    checkLogicalShotCount(checks, input.package);
    checkLogicalShotEconomy(checks, input.package);
    checkSimpleStructuralChecks(checks, input.package);

    return {
        status: checks.some((check) => check.severity === "blocker") ? "blocked" : "passed",
        checks,
    };
}

function checkPackageSchema(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures: string[] = [];
    if (value.schemaVersion !== 1) failures.push("schemaVersion 必须为 1");
    if (!value.episodes.length) failures.push("episodes 不能为空");
    for (const [episodeIndex, episode] of value.episodes.entries()) {
        if (!episode.code) failures.push(`episodes[${episodeIndex}].code 缺失`);
        for (const [shotIndex, shot] of episode.shots.entries()) {
            if (!shot.code) failures.push(`episodes[${episodeIndex}].shots[${shotIndex}].code 缺失`);
            if (!Number.isFinite(shot.duration) || !shot.timecode) failures.push(`${episode.code}/shots[${shotIndex}] 缺少 duration 或 timecode`);
        }
    }
    const materials = value.authoring?.materials;
    if (value.authoring?.source === "codex-standalone" && !Array.isArray(materials)) failures.push("authoring.materials 必须是数组");
    add(
        checks,
        "PACKAGE_SCHEMA",
        !failures.length,
        "制作包契约字段",
        failures.length ? failures.slice(0, 10).join("；") : "根字段、episode code、shot code、duration、timecode 和 authoring 数组字段符合当前契约",
        ["schemaVersion", "episodes[].code", "episodes[].shots[].code", "episodes[].shots[].duration", "episodes[].shots[].timecode", "authoring.materials"],
        "修复当前契约字段；禁止使用 episodeId、shotId、shotDuration 或依赖导入器静默别名转换。",
    );
}

function checkProductionPlanCompleteness(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const plan = value.project.productionBible?.productionPlan;
    const failures: string[] = [];
    if (!plan) failures.push("productionPlan 缺失");
    else {
        if (!plan.version || !plan.skills?.length || !plan.visual || !plan.video || !plan.references || !plan.continuity || !plan.frameCountRange || !plan.source)
            failures.push("productionPlan 缺少完整的 version/skills/visual/video/references/continuity/frameCountRange/source");
        if (plan.video && plan.video.shotDuration !== 15 && plan.video.shotDuration !== 30) failures.push("productionPlan.video.shotDuration 必须为 15 或 30");
        if (plan.video && (!plan.video.internalCutPolicy || !plan.video.framePolicy)) failures.push("productionPlan.video 缺少 internalCutPolicy 或 framePolicy");
    }
    add(
        checks,
        "PRODUCTION_PLAN_COMPLETENESS",
        !failures.length,
        "生产方案完整性",
        failures.length ? failures.join("；") : "productionBible.productionPlan 是完整对象，未依赖运行时默认值补齐",
        ["project.productionBible.productionPlan"],
        "直接在 JSON 中补齐完整 productionPlan；不能让缺失方案被默认值掩盖。",
    );
}

function checkLogicalShotCount(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const lock = value.project.productionLock;
    const shots = value.episodes.flatMap((episode) => episode.shots);
    const count = shots.length;
    const duration = shots.reduce((sum, shot) => sum + shot.duration, 0);
    const configuredDuration = value.project.productionBible.productionPlan?.video?.shotDuration;
    const failures: string[] = [];
    if (!lock?.logicalShotCount) failures.push("productionLock.logicalShotCount 缺失");
    else if (lock.logicalShotCount !== count) failures.push(`logicalShotCount=${lock.logicalShotCount}，实际逻辑片段=${count}`);
    if (lock && lock.targetDuration !== duration) failures.push(`targetDuration=${lock.targetDuration}，实际逻辑片段总时长=${duration}`);
    if (configuredDuration && shots.some((shot) => shot.duration !== configuredDuration)) failures.push("存在镜头 duration 与 productionPlan.video.shotDuration 不一致");
    if (lock?.narrativeBeatPlan && lock.narrativeBeatPlan.length !== count) failures.push(`narrativeBeatPlan=${lock.narrativeBeatPlan.length}，实际逻辑片段=${count}`);
    add(
        checks,
        "LOGICAL_SHOT_COUNT",
        !failures.length,
        "逻辑片段数量与总时长",
        failures.length ? failures.join("；") : `逻辑片段 ${count} 个，每镜 ${configuredDuration || "按镜头"} 秒，内部帧段/硬切未改变整集时长`,
        ["project.productionLock.logicalShotCount", "project.productionLock.targetDuration", "project.productionBible.productionPlan.video.shotDuration", "episodes[].shots[].duration"],
        "回到完整 TXT 和对白容量计划重新确定逻辑片段数量；不要把内部帧段或硬切当成新逻辑片段。",
    );
}

function checkLogicalShotEconomy(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures: string[] = [];
    const shots = value.episodes.flatMap((episode) => episode.shots.map((shot) => ({ episode, shot })));
    const beats = value.project.productionLock?.narrativeBeatPlan || [];
    if (beats.length && beats.some((beat) => !beat.id || !beat.responsibility.trim() || !beat.shotCodes.length)) failures.push("narrativeBeatPlan 存在没有独立职责或镜头绑定的节拍");
    for (let index = 1; index < shots.length; index += 1) {
        const previous = shots[index - 1];
        const current = shots[index];
        const previousIdentity = [previous.episode.code, previous.shot.locationCode, previous.shot.dramaticFunction || previous.shot.title, previous.shot.dialogue].map((item) => normalizeQualityText(item || "")).join("|");
        const currentIdentity = [current.episode.code, current.shot.locationCode, current.shot.dramaticFunction || current.shot.title, current.shot.dialogue].map((item) => normalizeQualityText(item || "")).join("|");
        if (previousIdentity && previousIdentity === currentIdentity) failures.push(`${previous.episode.code}/${previous.shot.code} 与 ${current.episode.code}/${current.shot.code} 没有独立剧情职责，疑似把同一对白或内部切镜错误拆成两个逻辑片段`);
    }
    add(
        checks,
        "LOGICAL_SHOT_ECONOMY",
        !failures.length,
        "逻辑片段经济性",
        failures.length ? failures.join("；") : "每个逻辑片段都有独立剧情职责或可验收的信息变化，内部帧段/硬切未被提升为逻辑片段",
        ["project.productionLock.narrativeBeatPlan", "episodes[].shots[].dramaticFunction", "episodes[].shots[].shotBoundary", "framePlan.frames"],
        "合并只承担同一对白分句、同一关系停顿或同一内部剪辑职责的相邻逻辑片段，再重新执行对白容量预检。",
    );
}

function checkDialogueCapacity(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const blockers: string[] = [];
    const reminders: string[] = [];
    for (const episode of value.episodes) {
        for (const shot of episode.shots) {
            const utterances = shot.utterances as DramaDialogueTimingInput[];
            const timingIssues = dramaUtteranceTimingIssues(
                shot.duration,
                utterances,
                utterances.some((utterance) => utterance.type === "dialogue" || utterance.type === "voiceover"),
                `${episode.code}/${shot.code}`,
            );
            blockers.push(...timingIssues);
            const issue = dramaDialogueTimingReminder(shot.duration, shot.utterances as DramaDialogueTimingInput[], shot.dialogue, `${episode.code}/${shot.code}`);
            if (issue) {
                if (issue.withinTolerance) reminders.push(issue.message);
                else blockers.push(issue.message);
            }
            // A whole-shot estimate can pass while a short individual utterance
            // is impossible to perform. Per-utterance mouth windows are strict:
            // the ten-character compatibility tolerance never applies here.
            for (const windowIssue of dramaTimedDialogueCapacityIssues(shot.utterances as DramaDialogueTimingInput[], `${episode.code}/${shot.code}`))
                blockers.push(`对白 utterance-${windowIssue.utteranceIndex + 1} 的实际口型窗口不足：${windowIssue.message}`);
        }
    }
    checks.push({
        code: "DIALOGUE_CAPACITY",
        severity: blockers.length ? "blocker" : "warning",
        scope: "对白容量",
        evidence: blockers.length ? blockers.slice(0, 8).join("；") : reminders.length ? `存在 ${reminders.length} 个未超过上线容差的轻微对白容量偏差：${reminders.slice(0, 3).join("；")}` : "每个含对白逻辑片段的自然语速、停顿和镜头时长匹配",
        sourceRefs: ["episodes[].shots[].utterances", "episodes[].shots[].duration"],
        fixHint: "先按自然语速和停顿计算对白容量，再在自然分句、说话人转换、动作反应或逻辑片段边界处拆分；不得把一秒内读不完的台词压进镜头。",
    });
}

function checkFrameDialogueTiming(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures = value.episodes.flatMap((episode) =>
        episode.shots.flatMap((shot) => {
            const label = `${episode.code}/${shot.code}`;
            const frames = shot.framePlan?.frames || [];
            return [...validateDramaFrameTiming(frames, shot.utterances as DramaDialogueTimingInput[], label), ...validateDramaVideoPromptDialogueTiming(shot.videoPrompt, frames, shot.utterances as DramaDialogueTimingInput[], label)];
        }),
    );
    add(
        checks,
        "FRAME_DIALOGUE_TIMING",
        !failures.length,
        "对白与帧段节奏",
        failures.length ? failures.slice(0, 8).join("；") : "带时间对白的帧段按自然开口、收句、停顿和反应边界组织，没有机械等分",
        ["episodes[].shots[].utterances", "episodes[].shots[].framePlan.frames[]"],
        "先按对白自然时长和动作反应重新划分 framePlan 时间段；禁止把含对白的30秒镜头机械切成相同长度的帧段。",
    );
}

function checkVideoPromptLayout(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures = value.episodes.flatMap((episode) =>
        episode.shots.flatMap((shot) => {
            const label = `${episode.code}/${shot.code || shot.title}`;
            const promptFailures = validateDramaVideoPromptCardLayout(shot.videoPrompt, shot.framePlan?.frames || [], shot.code || shot.title);
            if (videoPromptRuntimePlaceholderPattern.test(shot.videoPrompt)) promptFailures.push(`${label}公开视频含程序占位值 undefined/null/NaN/[object Object]`);
            if (videoPromptPseudoParameterPattern.test(shot.videoPrompt)) promptFailures.push(`${label}公开视频含未声明伪参数串；请用自然语言表达视觉要求`);
            return promptFailures;
        }),
    );
    add(
        checks,
        "VIDEO_PROMPT_LAYOUT",
        !failures.length,
        "视频提示词排版",
        failures.length ? failures.slice(0, 8).join("；") : "每个真实 framePlan 时间段都有完整的小墨式导演镜头卡",
        ["episodes[].shots[].videoPrompt", "episodes[].shots[].framePlan.frames[]"],
        "按小墨式导演成稿补齐：每个真实 framePlan 时间段对应一个镜头卡，标题包含时间、景别、焦段、机位和运镜，正文写具体可见画面与声音；内部起点/动作/衔接/终点继续只在 framePlan 中校验。",
    );
}

function checkVideoPromptLength(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures = value.episodes.flatMap((episode) =>
        episode.shots.flatMap((shot) => {
            const characterCount = Array.from(shot.videoPrompt || "").length;
            return characterCount > videoPromptMaxUnicodeCharacters ? [`${episode.code}/${shot.code || shot.title} videoPrompt=${characterCount}个Unicode字符，超过4500上限`] : [];
        }),
    );
    add(
        checks,
        "VIDEO_PROMPT_LENGTH",
        !failures.length,
        "视频提示词长度",
        failures.length ? failures.join("；") : "每个逻辑片段完整 videoPrompt 均不超过4500个Unicode字符",
        ["episodes[].shots[].videoPrompt"],
        "只删除重复的全局场景、光影、色调和材质描述；保留主体、触发、动作、可见结果、声音锚点、对白边界、连续性状态和硬切承接后重新自检。",
        {
            repairScope: "shot",
            shotIds: failures.map((failure) => failure.match(/(?:^|\/)(SH\d+)\b/u)?.[1]).filter((code): code is string => Boolean(code)),
            frameIds: [],
            lockedFields: ["project", "assets", "episodes[].script", "shots[].duration", "productionPlan", "unfailedShots"],
        },
    );
}

function checkVideoPromptSemanticQuality(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1, audit?: DramaAuthoringAudit) {
    const failures: string[] = [];
    const auditByShot = new Map((audit?.shots || []).map((shot) => [shot.shotId, shot]));
    for (const episode of value.episodes) {
        for (const shot of episode.shots) {
            const label = `${episode.code}/${shot.code}`;
            failures.push(...validateDramaVideoPromptSemanticQuality(shot.videoPrompt, shot.framePlan?.frames || [], label));
            const cards = extractDramaVideoPromptCards(shot.videoPrompt);
            const auditShot = auditByShot.get(shot.code || "");
            if (audit) {
                if (!auditShot || auditShot.frames.length !== (shot.framePlan?.frames.length || 0)) {
                    failures.push(`${label}缺少与真实帧一一对应的 authoringAudit`);
                } else {
                    for (const [index, frame] of (auditShot.frames || []).entries()) {
                        const required = [frame.subject, frame.trigger, frame.visibleAction, frame.visibleResult, frame.informationDelta, frame.cameraPurpose, frame.soundAnchor];
                        if (required.some((item) => !item.trim())) failures.push(`${label}/F${index + 1} authoringAudit 缺少主体、触发、动作、结果、信息增量、运镜动机或声音锚点`);
                        if (frame.frameId !== shot.framePlan?.frames[index]?.id) failures.push(`${label}/F${index + 1} authoringAudit frameId 未与真实 framePlan 对齐`);
                        const visual = cards[index]?.visual || "";
                        if (visual && frame.subject && !visual.includes(frame.subject)) failures.push(`${label}/F${index + 1} authoringAudit 主体未出现在公开画面内容中`);
                    }
                }
            }
        }
    }
    add(
        checks,
        "VIDEO_PROMPT_SEMANTIC_QUALITY",
        !failures.length,
        "公开视频语义质量",
        failures.length ? failures.slice(0, 12).join("；") : "公开视频卡片逐帧具备具体主体、动作触发、可见结果、信息增量和声音锚点",
        ["episodes[].shots[].videoPrompt", "episodes[].shots[].framePlan.frames[]", "authoringAudit"],
        "重写失败镜头的公开视频卡片和对应 framePlan；删除抽象/未来意图，补齐主体、触发、可见动作、结果、信息增量、运镜动机和声音锚点。",
        {
            repairScope: "shot",
            shotIds: [...new Set(failures.flatMap((failure) => [...failure.matchAll(/(?:^|\/)\b(SH\d+)\b/gu)].map((match) => match[1])))],
            frameIds: [...new Set(failures.flatMap((failure) => [...failure.matchAll(/\b(F\d+)\b/gu)].map((match) => match[1])))],
            lockedFields: ["project", "assets", "episodes[].script", "shots[].duration", "productionPlan", "unfailedShots"],
        },
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
            const previousQuotedTextsByUtterance = new Map<string, string[]>();
            for (const { frame, segmentText, spoken } of segmentPerformances) {
                const label = `${shot.code || shot.title}/${frame.id}`;
                const performanceMatch = segmentText.match(/对白表演\s*[：:]([^\n]+)/u);
                const directDialogueMatch = performanceMatch ? null : segmentText.match(/(?:^|[\n；;])\s*[^：:；;\n]{1,32}?\s*说\s*[：:]\s*“[^”\n]{1,240}”(?:[；;][^\n]*)?/u);
                if (!performanceMatch && !directDialogueMatch) {
                    if (!spoken.length) {
                        const hasSilenceResult = /对白结束|对白后|反应停顿|静默|沉默/u.test(segmentText) && /视线|目光|呼吸|肩|身体|手|指|嘴角|下颌|僵|停住|低头|抬眼/u.test(segmentText);
                        if (!hasSilenceResult) failures.push(`${label}对白结束后缺少具体静默/反应结果`);
                    } else failures.push(`${label}缺少对白表演：说话人、语气、停顿、重音、说后反应`);
                    continue;
                }
                const block = (performanceMatch?.[1] || directDialogueMatch?.[0] || "").replace(/^[\n；;]\s*/u, "").trim();
                performanceBlocks.push(block);
                const dialogueOverlapError = spoken.length ? dramaDialogueFragmentSequenceError(segmentText, spoken, previousQuotedTextsByUtterance, label) : "";
                if (dialogueOverlapError) failures.push(dialogueOverlapError);
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
            const dramaticFunction = `${shot.dramaticFunction || ""}\n${shot.performanceNotes || ""}\n${shot.performancePlan?.emotionalObjective || ""}`;
            if (!/(?:目标|欲望|想要|试图|必须|为了|守住|逼迫|阻止|拒绝|压力|阻力|承受|取回|保护|揭示|隐瞒)/u.test(dramaticFunction)) missing.push(`${shot.code}/dramaticFunction`);
            for (const frame of frames) {
                const action = frame.actionPrompt.trim();
                const result = `${frame.endPrompt || ""}\n${frame.transitionPrompt || ""}\n${frame.imagePrompt}`.trim();
                if (!action || genericActionPattern.test(action) || !observableActionPattern.test(action) || !result || !observableResultPattern.test(result) || cinematicPlaceholderPattern.test(result)) missing.push(`${shot.code}/${frame.id}`);
                missing.push(...validateDramaFrameCausalChain(frame.actionPrompt, frame.transitionPrompt, frame.endPrompt, `${shot.code}/${frame.id}`));
            }
            const publicCards = extractDramaVideoPromptCards(shot.videoPrompt);
            if (publicCards.length !== frames.length) missing.push(shot.code + "/videoPrompt 卡片数量与真实 framePlan 不一致");
            for (const [index, card] of publicCards.entries()) {
                const publicText = [card.visual, card.voice, card.sound].join("\n");
                if (!observableActionPattern.test(card.visual) || !observableResultPattern.test(card.visual) || !publicSoundAnchorPattern.test(publicText)) missing.push(shot.code + "/F" + (index + 1) + "/videoPrompt 缺少公开可见动作、结果或声音锚点");
            }
        }
    }
    add(
        checks,
        "ACTION_DENSITY",
        !missing.length,
        "逐时间段动作密度",
        missing.length ? `${missing.length} 个镜头/时间段缺少“谁做什么→因为什么→可见变化→声音锚点”闭环：${missing.slice(0, 5).join(", ")}` : "每个镜头和真实时间段都有欲望/阻力、触发、可观察动作、结果和声音锚点",
        ["episodes[].shots[].framePlan.frames[]", "episodes[].shots[].videoPrompt.画面内容", "episodes[].shots[].videoPrompt.人声", "episodes[].shots[].videoPrompt.音效"],
        "每段写清谁做什么、因为什么触发、身体微动作/手部受力、对手/NPC/道具/环境的可见结果和声音锚点；抽象词不能代替动作。",
    );
}

function checkActionDifference(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const repeated: string[] = [];
    for (const episode of value.episodes) {
        for (const shot of episode.shots) {
            const frames = shot.framePlan?.frames || [];
            const signatures = frames.map((frame) => actionSignature(frame.actionPrompt));
            const publicSignatures = extractDramaVideoPromptCards(shot.videoPrompt).map((card) =>
                [card.visual, card.dialogue]
                    .join("\n")
                    .replace(/[\s，。；：、,.!?！？]+/gu, "")
                    .replace(/(?:极慢|缓慢|微|轻微|短暂|保持|清晰|自然|真实|电影级)/gu, "")
                    .slice(0, 180),
            );
            if ((signatures.length > 1 && new Set(signatures).size < 2) || (publicSignatures.length > 1 && new Set(publicSignatures).size < 2)) repeated.push(shot.code);
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
            const npcPrompts = prompts.filter((prompt) => /NPC群像|NPC连续性|背景角色|配角|旁观者|人群/u.test(prompt));
            if (!required && !npcPrompts.length) continue;
            const reactions = npcPrompts.flatMap((prompt) => [...prompt.matchAll(/(?:反应|可见反应|状态变化)\s*[：:]\s*([^；;\n。]+)/gu)].map((match) => match[1].trim())).filter(Boolean);
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
    const failures: string[] = [];
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        const text = `${shot.imagePrompt || ""}\n${shot.videoPrompt || ""}\n${(shot.framePlan?.frames || []).map((frame) => frame.imagePrompt).join("\n")}`;
        const hasUnqualifiedBlur = /模糊|虚焦|焦外|浅景深|雾化|泛光|光晕/u.test(text) && !/明确要求|有意|只保留.*清晰|背影.*虚焦|背景.*虚焦.*主体.*清晰/u.test(text);
        const hasClarityAnchor = /清晰|可辨|完整入画|不遮挡|保持脸部|五官.*可见|结构.*可读/u.test(text);
        if (hasUnqualifiedBlur) failures.push(`${shot.code} 使用了未说明原因的模糊/虚焦/浅景深`);
        if (!hasClarityAnchor) failures.push(`${shot.code} 未明确当前景别下的主体清晰度`);
        for (const code of shot.characterCodes || []) {
            const asset = value.assets.characters.find((item) => item.code === code);
            if (asset?.supplierPrompt && !hasDramaReferenceAnchorClarity(asset.supplierPrompt, "角色")) failures.push(`${shot.code} 的角色资产 ${code} 缺少清晰身份特写、四视图/转面或服装配饰锚点`);
        }
        if (shot.locationCode) {
            const asset = value.assets.locations.find((item) => item.code === shot.locationCode);
            if (asset?.supplierPrompt && !hasDramaReferenceAnchorClarity(asset.supplierPrompt, "场景")) failures.push(`${shot.code} 的场景资产 ${shot.locationCode} 不是高清16:9单视角全景或缺少可读空间拓扑`);
        }
    }
    add(
        checks,
        "VISUAL_CLARITY",
        !failures.length,
        "画面清晰度",
        failures.length ? failures.join("；") : "可见主体具有清晰度合同或明确的有意模糊说明",
        ["project.ratio", "imagePrompt", "videoPrompt", "framePlan.frames[].imagePrompt"],
        "默认让主角、关键 NPC、道具和场景锚点清晰可辨；信息过载时拆镜，不缩小或虚化全部主体。",
    );
}

function checkCameraMotivation(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1, audit?: DramaAuthoringAudit) {
    const failed: string[] = [];
    const auditByShot = new Map((audit?.shots || []).map((shot) => [shot.shotId, shot]));
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        const cards = extractDramaVideoPromptCards(shot.videoPrompt);
        const text = `${shot.cameraMotion || ""}\n${shot.videoPrompt || ""}\n${cards.map((card) => card.cameraMotion).join("\n")}`;
        const hasCamera = /机位|景别|角度|焦段|固定|推|拉|摇|移|跟拍|环绕|镜头/u.test(text);
        const hasConcretePurpose = /为了|服务于|让观众看见|揭示|强调|承接|跟随|锁定|暴露|突出|把[^。；\n]{0,20}(?:看见|传给|压到|推向)/u.test(text);
        const genericPurpose = /服务于当前(?:信息|动作)变化|电影感推进|中轴缓慢推进/u.test(text) && !hasConcretePurpose;
        if (!hasCamera || !hasConcretePurpose || genericPurpose) failed.push(shot.code);
        if (audit) {
            const auditFrames = auditByShot.get(shot.code || "")?.frames || [];
            for (const [index, card] of cards.entries()) {
                const purpose = auditFrames[index]?.cameraPurpose || card.raw;
                if (!card.cameraMotion || !hasConcreteDramaCameraDirection(card.cameraMotion) || !/(?:为了|揭示|强调|跟随|锁定|暴露|突出|让观众看见|把[^。；\n]{0,20}(?:看见|传给|压到|推向))/u.test(purpose)) failed.push(`${shot.code}/F${index + 1}`);
            }
        }
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

function checkCameraEvents(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1, customTemplateDenseRule = false) {
    const failed: string[] = [];
    const productionPlan = value.project.productionBible?.productionPlan;
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        const prompt = shot.videoPrompt || "";
        const eventLines = [...prompt.matchAll(/镜头事件\s*[：:]\s*([^\n]+)/gu)].map((match) => match[1]);
        const hasCut = /(?:\bCut\s+to\b|\bCamera\s+cut\s+to\b|镜头事件\s*[：:])/iu.test(prompt);
        const internal = /镜头模式\s*[：:]\s*内部切镜/u.test(prompt);
        const inferredInternal = !internal && eventLines.length > 0;
        const denseMaterial = `${productionPlan?.customDirectorRules || ""}\n${prompt}`;
        const denseRuleRequested = hasDramaDenseCutRule(denseMaterial) || customTemplateDenseRule;
        const denseRequested = shot.duration === 30 && (productionPlan?.video?.internalCutPolicy === "dense-30s" || denseRuleRequested);
        const denseCutException = denseRequested && denseCutExceptionPattern.test(denseMaterial);
        if (shot.duration === 30 && denseRuleRequested && (productionPlan?.video?.internalCutPolicy === "adaptive" || (customTemplateDenseRule && productionPlan?.video?.internalCutPolicy !== "dense-30s")))
            failed.push(`${shot.code}:已声明30秒高密度硬切，但 productionPlan.video.internalCutPolicy 仍为 ${productionPlan?.video?.internalCutPolicy || "未声明"}，不能降级为 adaptive`);
        if (hasCut && !internal && !inferredInternal) failed.push(`${shot.code}:未声明内部切镜`);
        if (internal || inferredInternal || denseRequested) {
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

function checkCompositionContract(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures: string[] = [];
    const ratio = value.project.productionBible?.ratio || value.project.ratio;
    const characters = value.assets.characters;
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        const shotText = [shot.sourceText, shot.description, shot.dialogue, shot.narration, shot.videoPrompt, shot.imagePrompt, shot.entryState?.environment, shot.exitState?.environment].filter(Boolean).join("\n");
        const subjectNames = characters.filter((character) => (shot.characterCodes || []).includes(character.code)).map((character) => character.name);
        const requiredReactionNames = characters.filter((character) => (shot.characterCodes || []).includes(character.code) && characterNameHasReaction(shotText, character.name)).map((character) => character.name);
        const errors = validateDramaPromptComposition({
            ratio,
            prompt: shot.videoPrompt,
            frames: (shot.framePlan?.frames || []).map((frame) => ({
                startSecond: frame.startSecond,
                endSecond: frame.endSecond,
                startPrompt: frame.startPrompt,
                actionPrompt: frame.actionPrompt,
                transitionPrompt: frame.transitionPrompt,
                endPrompt: frame.endPrompt,
                imagePrompt: frame.imagePrompt,
            })),
            subjectNames,
            requiredReactionNames,
            requiresDetail: /手部|掌根|掌心|指节|桌沿|接触|受力|道具|物证/u.test(shotText),
            label: shot.code,
        });
        failures.push(...errors);
    }
    add(
        checks,
        "COMPOSITION_CONTRACT",
        !failures.length,
        "画幅构图与遮挡门禁",
        failures.length ? failures.slice(0, 10).join("；") : "每个时间段都明确主体和可见范围，9:16/16:9构图策略、清晰安全区和遮挡关系通过校验",
        ["project.ratio", "episodes[].shots[].videoPrompt", "episodes[].shots[].framePlan.frames[]"],
        "按当前画幅重写逐段主体、可见范围和纵横构图；9:16改为单人/双人/过肩/上下纵深，禁止横向塞入多人，并补齐完整头顶、下巴、主要衣领和防遮脸安全区。",
    );
}

function checkSubjectCoverage(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures: string[] = [];
    const characters = value.assets.characters;
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        const shotText = [shot.sourceText, shot.description, shot.dialogue, shot.narration, shot.videoPrompt, shot.imagePrompt].filter(Boolean).join("\n");
        const subjectNames = characters.filter((character) => (shot.characterCodes || []).includes(character.code)).map((character) => character.name);
        const promptText = [shot.videoPrompt, ...(shot.framePlan?.frames || []).map((frame) => [frame.startPrompt, frame.actionPrompt, frame.transitionPrompt, frame.endPrompt, frame.imagePrompt].filter(Boolean).join("\n"))].filter(Boolean).join("\n");
        if (!subjectNames.length && !/(?:主体|人物|角色|手部|道具|场景|空间|座位|锚点|双人|群像)/u.test(promptText)) failures.push(`${shot.code}未明确任何可见主体`);
        for (const character of characters.filter((item) => (shot.characterCodes || []).includes(item.code) && characterNameHasReaction(shotText, item.name))) {
            if (
                !new RegExp(
                    `${escapeRegExp(character.name)}[^\\n。；;]{0,40}(?:眉|目光|视线|肩|下颌|嘴角|呼吸|吸气|僵|停住|看向|望向|回望|前倾|收紧|松开|沉默|反应)|(?:眉|目光|视线|肩|下颌|嘴角|呼吸|吸气|僵|停住|看向|望向|回望|前倾|收紧|松开|沉默|反应)[^\\n。；;]{0,40}${escapeRegExp(character.name)}`,
                    "u",
                ).test(promptText)
            )
                failures.push(`${shot.code}未给 ${character.name} 安排独立可见反应`);
        }
    }
    add(
        checks,
        "SUBJECT_COVERAGE",
        !failures.length,
        "主体覆盖",
        failures.length ? failures.slice(0, 10).join("；") : "每个镜头和剧情要求的角色反应均有可见主体与独立画面信息",
        ["episodes[].shots[].characterCodes", "episodes[].shots[].videoPrompt", "episodes[].shots[].framePlan.frames[]"],
        "为每个时间段写明本段主要主体和可见范围；剧情事实中出现需要反应的角色、NPC或关键动作时，必须安排对应独立反应或细节信息，不能只作为背景描述。",
    );
}

function checkCutInformationDiversity(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures: string[] = [];
    const characters = value.assets.characters;
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        const shotText = [shot.sourceText, shot.description, shot.dialogue, shot.narration, shot.videoPrompt, shot.imagePrompt].filter(Boolean).join("\n");
        const subjectNames = characters.filter((character) => (shot.characterCodes || []).includes(character.code)).map((character) => character.name);
        const requiredReactionNames = characters.filter((character) => (shot.characterCodes || []).includes(character.code) && characterNameHasReaction(shotText, character.name)).map((character) => character.name);
        failures.push(
            ...validateDramaCutInformationDiversity({
                ratio: value.project.productionBible?.ratio || value.project.ratio,
                prompt: shot.videoPrompt,
                frames: shot.framePlan?.frames || [],
                subjectNames,
                requiredReactionNames,
                requiresDetail: /手部|掌根|掌心|指节|桌沿|接触|受力|道具|物证/u.test(shotText),
                label: shot.code,
            }),
        );
    }
    add(
        checks,
        "CUT_INFORMATION_DIVERSITY",
        !failures.length,
        "硬切信息主体覆盖",
        failures.length ? failures.slice(0, 10).join("；") : "每次硬切都指向不同的角色反应、关系、空间或手部/道具信息",
        ["episodes[].shots[].videoPrompt", "episodes[].shots[].framePlan.frames[]", "episodes[].shots[].characterCodes"],
        "重新分配硬切主体：至少覆盖剧情事实中的不同角色、关系、手部/道具、空间或结果信息之一；7—10次硬切不等于同一角色的7—10个角度。",
    );
}

function checkReferenceAliasConsistency(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures: string[] = [];
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        failures.push(
            ...validateDramaReferenceAliasConsistency({
                prompt: shot.videoPrompt,
                manifest: shot.framePlan?.referenceManifest || [],
                requireBinding: false,
                label: shot.code,
            }),
        );
    }
    add(
        checks,
        "REFERENCE_ALIAS_CONSISTENCY",
        !failures.length,
        "参考图 alias 与职责顺序",
        failures.length ? failures.slice(0, 10).join("；") : "公开视频素材绑定、referenceManifest alias、职责和顺序一致",
        ["episodes[].shots[].framePlan.referenceManifest", "episodes[].shots[].videoPrompt"],
        "按 referenceManifest 原顺序逐项写出 @图片 alias 与角色/场景/道具职责；禁止使用“@图片1至@图片N”这种无法确认映射的泛化写法。",
    );
}

function checkCharacterWardrobeContinuity(checks: DramaQualityGateCheck[], value: DramaProductionPackageV1) {
    const failures: string[] = [];
    for (const shot of value.episodes.flatMap((episode) => episode.shots)) {
        failures.push(
            ...validateDramaCharacterWardrobeContinuity({
                prompt: [
                    shot.videoPrompt,
                    shot.imagePrompt,
                    shot.continuity?.continuityNotes,
                    shot.entryState?.characters.map((item) => `${item.assetId} ${item.state || ""} ${item.action || ""}`).join("\n"),
                    shot.exitState?.characters.map((item) => `${item.assetId} ${item.state || ""} ${item.action || ""}`).join("\n"),
                ]
                    .filter(Boolean)
                    .join("\n"),
                characters: value.assets.characters,
                characterCodes: shot.characterCodes,
                label: shot.code,
            }),
        );
    }
    add(
        checks,
        "CHARACTER_WARDROBE_CONTINUITY",
        !failures.length,
        "角色外观与服装连续性",
        failures.length ? failures.slice(0, 10).join("；") : "出镜角色均保留年龄感、脸型/发型、服装和固定配饰锚点",
        ["assets.characters[].profile", "episodes[].shots[].characterCodes", "episodes[].shots[].videoPrompt", "episodes[].shots[].continuity"],
        "为每个出镜角色补充与正式资产一致的服装、发型、年龄感和固定配饰锚点；发现冲突时不得用另一张角色图替代。",
    );
}

function characterNameHasReaction(text: string, name: string) {
    if (!name.trim()) return false;
    const pattern = new RegExp(
        `${escapeRegExp(name)}[^\\n。；;]{0,40}(?:眉|目光|视线|肩|下颌|嘴角|呼吸|吸气|僵|停住|看向|望向|回望|前倾|收紧|松开|沉默|反应)|(?:眉|目光|视线|肩|下颌|嘴角|呼吸|吸气|僵|停住|看向|望向|回望|前倾|收紧|松开|沉默|反应)[^\\n。；;]{0,40}${escapeRegExp(name)}`,
        "u",
    );
    return pattern.test(text);
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
    } else
        add(
            checks,
            "SHOT_DURATION_POLICY",
            true,
            "逻辑片段时长",
            "当前制作包未声明固定目标时长，本门禁不启用；不得用内部帧段或硬切数量推导逻辑片段数量",
            ["project.productionBible.productionPlan.video.shotDuration", "episodes[].shots[].duration"],
            "如项目要求固定 15 秒或 30 秒，请先在生产方案中声明目标时长，再按剧情节拍拆分逻辑片段。",
        );
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
    const continuityFailures = validateDramaContinuityEdges(value.episodes);
    add(
        checks,
        "CONTINUITY",
        value.episodes.every((episode) => episode.shots.every((shot) => Boolean(shot.entryState && shot.exitState && shot.continuity))) && !continuityFailures.length,
        "连续性",
        continuityFailures.length ? continuityFailures.slice(0, 8).join("；") : "每个镜头都提供入口、出口和连续性事实，跨硬切的站位、轴线、道具和首个帧段均明确承接",
        ["entryState", "exitState", "continuity", "continuityEdges", "framePlan.frames[0]"],
        "硬切可以开始新视频片段，但必须逐项继承上一镜出口的角色/道具空间状态；若确实移动，要写清触发、路径、受力、结果，并在下一镜首帧重复站位锁定。",
    );
    if (value.authoring)
        add(
            checks,
            "PROVENANCE",
            Boolean(value.authoring.source === "executeDramaScriptRun" && value.authoring.contract?.contentHash && value.authoring.directorSkill?.contentHash && value.authoring.seedanceSkill?.contentHash),
            "来源凭据",
            "已记录 executeDramaScriptRun、契约和两个 Skill 哈希",
            ["authoring"],
            "只允许通过 executeDramaScriptRun 完成最终编排，并记录契约、导演 Skill、Seedance Skill 和来源素材哈希。",
        );
}

function add(checks: DramaQualityGateCheck[], code: string, passed: boolean, scope: string, evidence: string, sourceRefs: string[], fixHint: string, repair?: Pick<DramaQualityGateCheck, "repairScope" | "shotIds" | "frameIds" | "lockedFields">) {
    checks.push({ code, severity: passed ? "warning" : "blocker", scope, evidence: passed ? `通过：${evidence}` : evidence, sourceRefs, fixHint, ...(repair || {}) });
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
