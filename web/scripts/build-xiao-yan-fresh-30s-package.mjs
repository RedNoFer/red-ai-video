import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const inputPath = process.argv[2];
const outputBase = path.resolve(repoRoot, process.argv[3] || "output/xiao-yan-fresh-blood-contract-production-package-30s");

if (!inputPath) throw new Error("该脚本只负责校验和导出 Agent 已生成的制作包，请提供制作包 JSON 路径，不再从旧制作包或文章重建提示词");

const sourcePath = path.resolve(inputPath);
const raw = fs.readFileSync(sourcePath, "utf8");
const value = JSON.parse(raw);
const warnings = validatePackage(value);

fs.mkdirSync(path.dirname(outputBase), { recursive: true });
fs.writeFileSync(`${outputBase}.json`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
fs.writeFileSync(`${outputBase}.md`, renderMarkdown(value), "utf8");

console.log(
    JSON.stringify(
        {
            inputPath: sourcePath,
            outputBase,
            episodeCount: Array.isArray(value.episodes) ? value.episodes.length : 0,
            shotCount: Array.isArray(value.episodes) ? value.episodes.reduce((total, episode) => total + (Array.isArray(episode.shots) ? episode.shots.length : 0), 0) : 0,
            warnings,
            source: "agent-output-only",
        },
        null,
        2,
    ),
);

function validatePackage(pkg) {
    if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) throw new Error("制作包必须是 JSON 对象");
    const warnings = [];
    const episodes = Array.isArray(pkg.episodes) ? pkg.episodes : [];
    for (const episode of episodes) {
        for (const shot of Array.isArray(episode.shots) ? episode.shots : []) {
            const frames = Array.isArray(shot.framePlan?.frames) ? shot.framePlan.frames : [];
            for (const [index, frame] of frames.entries()) {
                const prompt = String(frame.imagePrompt || "").trim();
                if (!prompt) throw new Error(`${shot.code || "镜头"} 第 ${index + 1} 帧缺少 imagePrompt`);
                if (/(?:https?:\/\/|data:image\/|assetId|referenceManifest|参考绑定|参考图职责|内部\s*ID|Skill|\{[\s\S]*\}|\[[\s\S]*\])/iu.test(prompt))
                    throw new Error(`${shot.code || "镜头"} 第 ${index + 1} 帧包含内部 ID、URL、JSON、Skill 名称或参考绑定信息`);
                warnings.push(...staticPromptWarnings(prompt).map((warning) => `${shot.code || "镜头"} 第 ${index + 1} 帧：${warning}`));
            }
        }
    }
    const frameCounts = episodes.flatMap((episode) => (Array.isArray(episode.shots) ? episode.shots : []).map((shot) => (Array.isArray(shot.framePlan?.frames) ? shot.framePlan.frames.length : 0)));
    const framePolicy = pkg.project?.productionBible?.productionPlan?.video?.framePolicy;
    const validFrameCounts = frameCounts.filter((count) => Number.isInteger(count) && count >= 2 && count <= 9);
    if (framePolicy === "agent" && validFrameCounts.length >= 2 && new Set(validFrameCounts).size === 1)
        warnings.push(`全包帧数检查：Agent 自适应模式下 ${validFrameCounts.length} 个镜头全部使用 ${validFrameCounts[0]} 帧，疑似机械套用统一帧数；请按各镜头的可见事件节点复核`);
    return [...new Set(warnings)];
}

function staticPromptWarnings(prompt) {
    const warnings = [];
    if (/(?:静态关键帧|可见表演状态|景别|机位与构图|站位与视线|三层空间|负面约束)[：:]/u.test(prompt)) warnings.push("包含旧版静态字段");
    if (prompt.length > 1600) warnings.push("静态提示词较长，建议压缩重复设定");
    return warnings;
}

function renderMarkdown(pkg) {
    const sections = Array.isArray(pkg.archive?.sections) ? pkg.archive.sections : [];
    const body = sections.map((section) => `## ${section.title || "未命名章节"}\n\n${String(section.content || "").trim()}`).join("\n\n");
    const embedded = JSON.stringify(pkg, null, 2).replaceAll("```", "\\u0060\\u0060\\u0060");
    return `# 《${pkg.project?.title || "短剧制作包"}》完整制作包\n\n> 制作包格式：\`vozeb-drama-production-package-v1\`\n> 本文件仅由 Agent 已生成的 JSON 确定性导出，不重建任何提示词。\n\n## 规范对象（导入权威数据）\n\n\`\`\`drama-production-package\n${embedded}\n\`\`\`\n\n${body}\n`;
}
