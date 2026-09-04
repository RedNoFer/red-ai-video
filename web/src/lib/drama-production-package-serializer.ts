import type { DramaProductionPackageV1 } from "@/lib/drama-project-contract";
import { formatPromptFieldLines } from "@/lib/drama-frame-sequence";
import { dramaFrameVisibleState } from "@/lib/drama-prompt-compiler";

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
                videoPrompt: cleanPackageVideoBrief(shot.videoPrompt) || shot.description,
                framePlan: {
                    ...shot.framePlan,
                    frames: shot.framePlan.frames.map((frame) => ({
                        ...frame,
                        imagePrompt: formatPromptFieldLines(frame.imagePrompt, "static"),
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
                const frames = [...shot.framePlan.frames]
                    .sort((left, right) => left.sequenceIndex - right.sequenceIndex)
                const references = (shot.framePlan.referenceManifest || []).map((item) => `${item.alias}仅用于${item.purpose || item.role}`);
                const videoPrompt = formatPromptFieldLines(cleanPackageVideoBrief(shot.videoPrompt), "video");
                const promptLines = videoPrompt.includes("动态意图：") || videoPrompt.includes("动态意图:") ? videoPrompt.split("\n").filter(Boolean) : [`动态意图：${videoPrompt || shot.description}`];
                const timelineLines = frames.flatMap((frame, index) => {
                    const previous = frames[index - 1];
                    const start = frame.startPrompt || (previous ? dramaFrameVisibleState(previous.imagePrompt, previous.actionPrompt) : shot.continuity?.actionStart || shot.description);
                    const end = frame.endPrompt || dramaFrameVisibleState(frame.imagePrompt, frame.actionPrompt) || frame.actionPrompt;
                    const continuity = shot.continuity?.continuityNotes || "角色身份、服装、道具归属、空间轴线与主光方向保持连续";
                    const transition = frame.transitionPrompt || (previous
                        ? `承接上一段终点“${start}”，过渡到当前帧“${end}”；${continuity}`
                        : `从镜头入口“${start}”进入当前帧“${end}”；${continuity}`);
                    return [
                        `${promptCode}-F${String(frame.sequenceIndex).padStart(2, "0")}｜${frame.startSecond}-${frame.endSecond}s`,
                        `起点：${start}`,
                        `动作与触发：${frame.actionPrompt}`,
                        `可见衔接：${transition}`,
                        `终点：${end}`,
                    ];
                });
                const endState =
                    shot.exitState?.characters
                        .map((item) => item.action)
                        .filter(Boolean)
                        .join("；") ||
                    shot.continuity?.actionEnd ||
                    shot.endFramePrompt ||
                    shot.description;
                const lines = [
                    `${shot.duration}s ${value.project.ratio} 视频`,
                    ...promptLines,
                    ...(promptLines.some((line) => /(?:单一主运镜|主运镜)[：:]/u.test(line)) ? [] : [`单一主运镜：${shot.cameraMotion || "固定机位"}`]),
                    ...(timelineLines.length ? ["时间段动作：", ...timelineLines] : []),
                    references.length ? ["参考图职责：", ...references.map((reference) => `- ${reference}`)].join("\n") : "参考图职责：按资产映射表和实际绑定图片执行",
                    `结束画面：${endState}`,
                    `风格：${value.project.style}`,
                    `针对性约束：${shot.negativePrompt || "无闪烁、无形变、无背景漂移、无道具消失、无身份跳变、无水印文字"}`,
                ];
                return `### ${promptCode}｜${shot.code} ${shot.title}\n\n\`\`\`text\n${lines.join("\n")}\n\`\`\``;
            }),
        )
        .join("\n\n");
}

function cleanPackageVideoBrief(value: string) {
    return value
        .replace(/^\s*生成\s*\d+(?:\.\d+)?\s*(?:秒|s)\s*[^。；\n]*视频[，,。；;：:]*/iu, "")
        .replace(/(?:视频)?时长\s*[：:]?\s*\d+(?:\.\d+)?\s*(?:秒|s)/giu, "")
        .trim();
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
