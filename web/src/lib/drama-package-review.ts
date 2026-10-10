import type { DramaProductionPackageV1, DramaQualityGateCheck, DramaQualityGateReport } from "@/lib/drama-project-contract";
import { extractDramaSourceDialogues, normalizeDramaSpeaker } from "@/lib/drama-source-dialogue";
import { normalizeDramaDialogueSequenceText } from "@/lib/drama-dialogue-timing";
import { validateDramaContinuityEdges } from "@/lib/drama-continuity-policy";
import { extractDramaVideoPromptCards, validateDramaVideoPromptCardLayout, validateDramaVideoPromptUtteranceCoverage } from "@/lib/drama-prompt-quality";
import { DRAMA_PACKAGE_SECTIONS } from "@/lib/server/drama-production-package-contract";

/** Deterministic, read-only facts. Import presents findings as warnings. */
export function reviewDramaPackage(value: DramaProductionPackageV1, markdown?: string, sourceText?: string): DramaQualityGateReport {
    const checks: DramaQualityGateCheck[] = [];
    const add = (code: string, scope: string, evidence: string, sourceRefs: string[], fixHint: string, passed = false) =>
        checks.push({ code, scope, status: passed ? "passed" : "blocked", severity: passed ? "warning" : "blocker", evidence, sourceRefs, fixHint });
    for (const episode of value.episodes) {
        for (const shot of episode.shots) {
            const scope = `${episode.code}/${shot.code}`;
            for (const error of [...validateDramaVideoPromptCardLayout(shot.videoPrompt, shot.framePlan?.frames || [], scope), ...validateDramaVideoPromptUtteranceCoverage(shot.videoPrompt, shot.framePlan?.frames || [], shot.utterances || [], scope)])
                add("VIDEO_PROMPT_LAYOUT", scope, error, ["videoPrompt", "framePlan", "utterances"], "在作者侧修订原句、说话人、窗口和字段冲突；导入不会自动补写。");
        }
    }
    for (const error of validateDramaContinuityEdges(value.episodes)) add("CONTINUITY", "相邻片段与状态覆盖", error, ["continuityEdges", "entryState", "exitState"], "逐对登记转换依据并核对角色、道具、空间及轴线。");
    if (markdown) {
        const body = markdown.replace(/```drama-production-package[^\n]*\n[\s\S]*?```/gu, "");
        const chapters = [...body.matchAll(/^##\s+([^\n]+)\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/gmu)].filter((match) => !match[1].includes("规范对象"));
        if (chapters.length !== DRAMA_PACKAGE_SECTIONS.length) add("PACKAGE_SCHEMA", "章节结构", `要求 13 个固定章节，实际 ${chapters.length} 个`, ["markdown"], "辅助字段说明放在配套文档，不新增制作包章节。");
        for (const [index, title] of DRAMA_PACKAGE_SECTIONS.entries()) {
            if (!chapters[index]?.[1].includes(title)) add("PACKAGE_SCHEMA", `第 ${index + 1} 章`, `正文章节缺失或顺序错误：${title}`, ["markdown", "archive.sections"], "保留 13 个固定章节，并与 JSON 归档一致。");
        }
        const videoChapter = chapters.find((chapter) => chapter[1].includes("分段视频 Prompt"))?.[2] || "";
        const compact = (text: string) => text.replace(/\s/gu, "");
        for (const [assets, index] of [
            [value.assets.characters, 4],
            [value.assets.locations, 5],
        ] as const)
            for (const asset of assets) {
                if (!chapters[index]?.[2].includes(asset.code) || !chapters[index]?.[2].includes(asset.name))
                    add("JSON_MARKDOWN_CONSISTENCY", asset.code, "资产章节与 JSON 资产清单的 code/name 缺失或不一致", ["markdown.assets", "assets"], "核对资产编码、正式名称与当前正文，导入不重写资产设定。");
            }
        const scriptChapter = compact(chapters[2]?.[2] || "");
        const dialogueChapter = compact(chapters[8]?.[2] || "");
        for (const episode of value.episodes) {
            if (episode.script.trim() && !scriptChapter.includes(compact(episode.script)))
                add("JSON_MARKDOWN_CONSISTENCY", episode.code, "第三章与 JSON 文学剧本不一致或缺失", ["markdown.chapter3", "episodes[].script"], "核对当前剧情范围、正式剧本和结尾事实。");
            for (const utterance of episode.shots.flatMap((shot) => shot.utterances || []))
                if (utterance.text.trim() && !dialogueChapter.includes(compact(utterance.text)))
                    add("DIALOGUE_COVERAGE", `${episode.code}/${utterance.id}`, "第九章缺少 JSON 已登记原句", ["markdown.chapter9", "utterances"], "核对台词顺序、唯一说话人及窗口，不由导入器补写。");
        }
        for (const episode of value.episodes)
            for (const shot of episode.shots) {
                if (!videoChapter.includes(shot.videoPrompt.trim()))
                    add("VIDEO_PROMPT_LAYOUT", `${episode.code}/${shot.code}`, "第十一章与 JSON 的 videoPrompt 原文不一致", ["markdown.chapter11", "videoPrompt"], "从同一作者成稿核对正文与 JSON，不由导入器重建。");
                const tableChapter = chapters.find((chapter) => chapter[1].includes("镜头执行表"))?.[2] || "";
                const row = tableChapter.split("\n").find((line) => line.includes(`| ${shot.code} |`) || line.includes(`|${shot.code}|`));
                if (!row || (shot.timecode && !row.includes(shot.timecode))) add("TIMELINE", `${episode.code}/${shot.code}`, "镜头执行表缺失或与 JSON timecode 不一致", ["markdown.chapter4", "timecode"], "核对同一镜头的时间码与时长。");
            }
        for (const chapter of chapters) {
            const title = DRAMA_PACKAGE_SECTIONS.find((title) => chapter[1].includes(title));
            const archived = title ? value.archive?.sections.find((section) => section.title.includes(title)) : undefined;
            if (archived?.content.trim() && archived.content.trim() !== chapter[2].trim()) add("PACKAGE_SCHEMA", chapter[1], "正文与 archive.sections 的已填写内容不一致", ["markdown", "archive.sections"], "核对作者双重表达，保存两份原稿并明确修订范围。");
        }
    }
    if (sourceText !== undefined) {
        const lines = extractDramaSourceDialogues(
            sourceText,
            value.assets.characters.map((character) => character.name),
        );
        const utterances = value.episodes.flatMap((episode) => episode.shots.flatMap((shot) => shot.utterances || []));
        let cursor = 0;
        for (const line of lines) {
            const text = normalizeDramaDialogueSequenceText(line.text);
            const index = utterances.findIndex((utterance, index) => index >= cursor && normalizeDramaDialogueSequenceText(utterance.text) === text && (!line.speaker || normalizeDramaSpeaker(utterance.speaker) === normalizeDramaSpeaker(line.speaker)));
            if (index < 0 && line.speaker) add("DIALOGUE_COVERAGE", `源文字符 ${line.offset}`, `原句缺失、错序或说话人不符：${line.speaker}：“${line.text}”`, ["story-source", "utterances"], "由作者核对来源顺序、原句及唯一正式说话人。");
            else if (index >= 0) cursor = index + 1;
            if (!line.speaker)
                checks.push({
                    code: "DIALOGUE_COVERAGE",
                    status: "warning",
                    severity: "warning",
                    scope: `源文字符 ${line.offset}`,
                    evidence: `引文声源尚待作者核对：“${line.text}”`,
                    sourceRefs: ["story-source"],
                    fixHint: "引号可能表示物品或引用，不能自动认定为对白。",
                });
        }
        if (!lines.length)
            checks.push({
                code: "DIALOGUE_COVERAGE",
                status: "warning",
                severity: "warning",
                scope: "来源识别范围",
                evidence: "未识别显式对白；不能据此声明无对白或全文对白已通过",
                sourceRefs: ["story-source"],
                fixHint: "作者核对源文实际格式，并在第十三章记录检查范围。",
            });
        else add("DIALOGUE_COVERAGE", "来源检查范围", `检查 ${lines.length} 条源文引文/对白及 ${utterances.length} 条结构化发声记录`, ["story-source", "utterances"], "", true);
    } else
        checks.push({
            code: "DIALOGUE_COVERAGE",
            status: "warning",
            severity: "warning",
            scope: "来源检查范围",
            evidence: "未提供源 TXT，仅核对制作包内部事实，未完成源文遗漏检查",
            sourceRefs: ["story-source"],
            fixHint: "外部交稿检查可通过 --source 提供完整源 TXT。",
        });
    const cards = value.episodes.flatMap((episode) => episode.shots.flatMap((shot) => extractDramaVideoPromptCards(shot.videoPrompt)));
    add("CONTINUITY", "检查范围", `逐对检查 ${value.episodes.reduce((count, episode) => count + Math.max(0, episode.shots.length - 1), 0)} 对相邻片段和 ${cards.length} 张公开镜头卡；只检查文本，未验收实际媒体`, ["episodes", "videoPrompt"], "", true);
    return { status: checks.some((check) => check.status === "blocked") ? "blocked" : "passed", checks };
}
