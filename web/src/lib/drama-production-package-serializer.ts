import type { DramaProductionPackageV1 } from "@/lib/drama-project-contract";
import { formatPromptFieldLines } from "@/lib/drama-frame-sequence";
import { DRAMA_PACKAGE_SECTIONS } from "@/lib/server/drama-production-package-contract";

export function serializeDramaProductionPackageJson(value: DramaProductionPackageV1) {
    return `${JSON.stringify(withDeterministicVideoSection(value), null, 2)}\n`;
}

/** Markdown is a deterministic presentation of the canonical package object. */
export function serializeDramaProductionPackageMarkdown(value: DramaProductionPackageV1) {
    const canonical = withDeterministicVideoSection(value);
    const body = DRAMA_PACKAGE_SECTIONS.map((title, index) => {
        const section = canonical.archive?.sections[index];
        const content = title.includes("镜头执行表") ? shotTable(canonical) : title.includes("分段视频 Prompt") ? videoPromptSection(canonical) : section?.content.trim() || fallbackSectionContent(canonical, index);
        return `## ${chapterTitle(index)}\n\n${content}`;
    }).join("\n\n");
    const embeddedJson = JSON.stringify(canonical, null, 2).replace(/```/gu, "\\u0060\\u0060\\u0060");
    return `${`# 《${canonical.project.title}》完整制作包\n\n> 制作包格式：\`vozeb-drama-production-package-v1\`\n> 规范数据源：JSON；本文件由同一对象确定性导出。\n> 目标平台：${canonical.project.productionBible.targetPlatform || "未指定"}｜语言：${canonical.project.productionBible.language}｜画幅：${canonical.project.ratio}｜成片：约 ${canonical.project.productionBible.targetDuration || canonical.episodes.reduce((total, episode) => total + episode.shots.reduce((sum, shot) => sum + shot.duration, 0), 0)} 秒\n\n## 规范对象（导入权威数据）\n\n\`\`\`drama-production-package\n${embeddedJson}\n\`\`\`\n\n${body}`.trimEnd()}\n`;
}

function withDeterministicVideoSection(value: DramaProductionPackageV1): DramaProductionPackageV1 {
    const canonical = {
        ...value,
        episodes: value.episodes.map((episode) => ({
            ...episode,
            shots: episode.shots.map((shot) => {
                return {
                    ...shot,
                    imagePrompt: formatPromptFieldLines(shot.imagePrompt, "static"),
                    ...(shot.startFramePrompt ? { startFramePrompt: formatPromptFieldLines(shot.startFramePrompt, "static") } : {}),
                    ...(shot.endFramePrompt ? { endFramePrompt: formatPromptFieldLines(shot.endFramePrompt, "static") } : {}),
                    videoPrompt: shot.videoPrompt.trim(),
                    framePlan: {
                        ...shot.framePlan,
                        frames: shot.framePlan.frames.map((frame) => ({
                            ...frame,
                            imagePrompt: formatPromptFieldLines(frame.imagePrompt, "static"),
                        })),
                    },
                };
            }),
        })),
    };
    const existingSections = canonical.archive?.sections || [];
    const emptyArchive = {
        formatVersion: "vozeb-drama-production-package-v1" as const,
        sections: [],
        promptAssets: [],
        dialogueDirections: [],
        voiceDirections: [],
        silenceDirections: [],
        referencePlan: [],
        generationOrder: [],
        qcReport: "",
    };
    const sections = DRAMA_PACKAGE_SECTIONS.map((title, index) => {
        const existing = existingSections.find((section, sectionIndex) => sectionIndexFor(section, sectionIndex) === index || section.title.includes(title));
        return { code: `SEC${String(index + 1).padStart(2, "0")}`, title: chapterTitle(index), content: existing?.content.trim() || fallbackSectionContent(canonical, index) };
    });
    return {
        ...canonical,
        archive: {
            ...emptyArchive,
            ...canonical.archive,
            sections: sections.map((section, index) => ({ ...section, ...(index === 3 ? { content: shotTable(canonical) } : {}), ...(index === 10 ? { content: videoPromptSection(canonical) } : {}) })),
        },
    };
}

function chapterTitle(index: number) {
    const numerals = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三"];
    return `${numerals[index] || index + 1}、${DRAMA_PACKAGE_SECTIONS[index] || "制作包附录"}`;
}

function sectionIndexFor(section: NonNullable<DramaProductionPackageV1["archive"]>["sections"][number], fallback: number) {
    const number = Number(section.code.replace(/\D/g, ""));
    return number >= 1 && number <= DRAMA_PACKAGE_SECTIONS.length ? number - 1 : fallback;
}

function fallbackSectionContent(value: DramaProductionPackageV1, index: number) {
    const episode = value.episodes[0];
    if (index === 0) return `项目：${value.project.title}\n类型：${value.project.style}\n当前集：${episode?.title || "未指定"}\n原作章节：${episode?.sourceRange || "未指定"}`;
    if (index === 1) return `原作章节：${episode?.sourceRange || "未指定"}\n\n${episode?.script || "无"}`;
    if (index === 2) return episode?.script || "无";
    if (index === 4) return value.assets.characters.map((asset) => `${asset.code}｜${asset.name}｜${asset.description}`).join("\n") || "无";
    if (index === 5) return value.assets.locations.map((asset) => `${asset.code}｜${asset.name}｜${asset.description}`).join("\n") || "无";
    if (index === 6) return value.archive?.promptAssets.filter((asset) => asset.category === "keyframe").map((asset) => `${asset.code}｜${asset.title}\n${asset.prompt}`).join("\n\n") || "无";
    if (index === 7) return value.archive?.promptAssets.filter((asset) => asset.category === "storyboard").map((asset) => `${asset.code}｜${asset.title}\n${asset.prompt}`).join("\n\n") || "无";
    if (index === 8) return value.archive?.dialogueDirections.map((direction) => `${direction.id}｜${direction.shotCode}｜${direction.speaker}｜${direction.text}\n${direction.performance}`).join("\n\n") || "无对白";
    if (index === 9) return episode?.shots.map((shot) => `${shot.code}｜环境音：${shot.sound?.ambience || "无"}｜拟音：${shot.sound?.soundEffects || "无"}｜音乐：${shot.sound?.music || "无"}`).join("\n") || "无";
    if (index === 10) return videoPromptSection(value) || "无";
    if (index === 11) return episode?.shots.map((shot) => `${shot.code}：场景 ${shot.locationCode || "未指定"}；角色 ${shot.characterCodes.join("、") || "无"}；道具 ${shot.propCodes.join("、") || "无"}`).join("\n") || "无";
    if (index === 12) return value.archive?.qcReport || "已由服务端质量门禁校验；无额外 QC 说明。";
    return "无";
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
