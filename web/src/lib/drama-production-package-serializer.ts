import type { DramaProductionPackageV1 } from "@/lib/drama-project-contract";
import { formatPromptFieldLines, upgradeDramaFrameImagePrompt } from "@/lib/drama-frame-sequence";

export function serializeDramaProductionPackageJson(value: DramaProductionPackageV1) {
    return `${JSON.stringify(withDeterministicVideoSection(value), null, 2)}\n`;
}

/** Markdown is a deterministic presentation of the canonical package object. */
export function serializeDramaProductionPackageMarkdown(value: DramaProductionPackageV1) {
    const canonical = withDeterministicVideoSection(value);
    const sections = canonical.archive?.sections || [];
    const body = sections.map((section, index) => `## ${canonicalChapterTitle(section, index)}\n\n${section.title.includes("镜头执行表") ? shotTable(canonical) : section.content.trim()}`).join("\n\n");
    const embeddedJson = JSON.stringify(canonical, null, 2).replace(/```/gu, "\\u0060\\u0060\\u0060");
    return `${`# 《${canonical.project.title}》完整制作包\n\n> 制作包格式：\`vozeb-drama-production-package-v1\`\n> 规范数据源：JSON；本文件由同一对象确定性导出。\n> 目标平台：${canonical.project.productionBible.targetPlatform || "未指定"}｜语言：${canonical.project.productionBible.language}｜画幅：${canonical.project.ratio}｜成片：约 ${canonical.project.productionBible.targetDuration || canonical.episodes.reduce((total, episode) => total + episode.shots.reduce((sum, shot) => sum + shot.duration, 0), 0)} 秒\n\n## 规范对象（导入权威数据）\n\n\`\`\`drama-production-package\n${embeddedJson}\n\`\`\`\n\n${body}`.trimEnd()}\n`;
}

function withDeterministicVideoSection(value: DramaProductionPackageV1): DramaProductionPackageV1 {
    const canonical = {
        ...value,
        episodes: value.episodes.map((episode) => ({
            ...episode,
            shots: episode.shots.map((shot) => ({
                ...shot,
                imagePrompt: formatPromptFieldLines(shot.imagePrompt, "static"),
                ...(shot.startFramePrompt ? { startFramePrompt: formatPromptFieldLines(shot.startFramePrompt, "static") } : {}),
                ...(shot.endFramePrompt ? { endFramePrompt: formatPromptFieldLines(shot.endFramePrompt, "static") } : {}),
                videoPrompt: shot.videoPrompt.trim(),
                framePlan: {
                    ...shot.framePlan,
                    frames: shot.framePlan.frames.map((frame) => ({
                        ...frame,
                        imagePrompt: formatPromptFieldLines(needsLegacyFrameRewrite(frame.imagePrompt) ? upgradeDramaFrameImagePrompt(frame.imagePrompt, frame.actionPrompt, {
                            description: shot.description,
                            shotSize: shot.continuity?.shotSize || "中景",
                            cameraAngle: shot.continuity?.cameraAngle || "视线高度平视",
                            composition: shot.continuity?.composition || "主体位于画面安全区，前景有具体框景",
                            characterBlocking: shot.continuity?.characterBlocking || "按当前动作关系安排主体站位",
                            gazeDirection: shot.continuity?.gazeDirection || "视线落向当前叙事目标",
                            lighting: shot.lighting || "延续本场主光",
                            colorPalette: shot.colorPalette || "沿用本场色板",
                            sequenceIndex: frame.sequenceIndex,
                            frameCount: shot.framePlan.frames.length,
                        }) : frame.imagePrompt, "static"),
                        ...(frame.supplierPrompt ? { supplierPrompt: formatPromptFieldLines(frame.supplierPrompt, "static") } : {}),
                    })),
                },
            })),
        })),
    };
    if (!canonical.archive?.sections.some((section) => section.title.includes("分段视频 Prompt"))) return canonical;
    return {
        ...canonical,
        archive: {
            ...canonical.archive,
            sections: canonical.archive.sections.map((section, index) => ({
                ...section,
                title: canonicalChapterTitle(section, index),
                ...(section.title.includes("分段视频 Prompt") ? { content: videoPromptSection(canonical) } : {}),
            })),
        },
    };
}

function needsLegacyFrameRewrite(prompt: string) {
    return /(?:入口构图已建立|入口姿态、表情与视线已建立|动作入口已成立|动作节点的可见结果已经成立|动作展开|关键变化|结果状态|主体的眉眼、呼吸、手部和道具接触关系清晰可见|情绪通过身体动作呈现|眉眼、视线和手部动作与当前节拍一致)/u.test(prompt);
}

const FIXED_CHAPTER_TITLES = [
    "一、项目总览",
    "二、原创第一章",
    "三、第一集文学剧本",
    "四、镜头执行表",
    "五、角色一致性资产",
    "六、场景一致性资产",
    "七、关键视频资产 Prompt",
    "八、全案板 Prompt",
    "九、台词与表演脚本",
    "十、声音设计",
    "十一、分段视频 Prompt",
    "十二、资产映射与执行顺序",
    "十三、QC 报告",
] as const;

function canonicalChapterTitle(section: NonNullable<DramaProductionPackageV1["archive"]>["sections"][number], index: number) {
    const byCode = Number(section.code.replace(/\D/g, "")) - 1;
    return FIXED_CHAPTER_TITLES[byCode] || FIXED_CHAPTER_TITLES[index] || section.title;
}

function videoPromptSection(value: DramaProductionPackageV1) {
    return value.episodes
        .flatMap((episode) =>
            episode.shots.map((shot) => {
                const promptCode = `P${String(shot.order).padStart(2, "0")}`;
                return `### ${promptCode}｜${shot.code} ${shot.title}\n\n\`\`\`text\n${shot.videoPrompt.trim()}\n\`\`\``;
            }),
        )
        .join("\n\n");
}

function shotTable(value: DramaProductionPackageV1) {
    const rows = value.episodes.flatMap((episode) =>
        episode.shots.map(
            (shot) =>
                `| ${shot.code} | ${shot.timecode || ""} | ${shot.dramaticFunction || ""} | ${shot.continuity?.shotSize || ""} | ${shot.cameraMotion} | ${shot.lens || ""} | ${shot.lighting || ""} | ${shot.colorPalette || ""} | ${shot.transitionOut || ""} | ${shot.description.replace(/\|/g, "／")} | ${(
                    shot.exitState?.characters
                        .map((item) => item.action)
                        .filter(Boolean)
                        .join("；") ||
                    shot.endFramePrompt ||
                    ""
                ).replace(/\|/g, "／")} |`,
        ),
    );
    return ["| 镜号 | 时间 | 阶段 | 景别 | 运镜 | 焦段 | 灯光 | 色彩 | 转场 | 动作描述 | end_state |", "|---|---:|---|---|---|---:|---|---|---|---|---|", ...rows].join("\n");
}
