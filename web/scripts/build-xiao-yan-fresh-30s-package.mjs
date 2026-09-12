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
                const error = staticPromptError(prompt);
                if (error) throw new Error(`${shot.code || "镜头"} 第 ${index + 1} 帧：${error}`);
                warnings.push(...staticPromptWarnings(prompt).map((warning) => `${shot.code || "镜头"} 第 ${index + 1} 帧：${warning}`));
            }
        }
    }
    return [...new Set(warnings)];
}

function staticPromptError(prompt) {
    if (/(?:https?:\/\/|data:image\/|assetId|referenceManifest|参考绑定|参考图职责|内部\s*ID|Skill|\{[\s\S]*\}|\[[\s\S]*\])/iu.test(prompt)) return "包含内部 ID、URL、JSON、Skill 名称或参考绑定信息";
    const subject = field(prompt, "画面主体") || field(prompt, "静态关键帧") || firstUnlabeledLine(prompt);
    const state = field(prompt, "可见状态") || field(prompt, "可见表演状态");
    if (!subject || /^(?:无|待补全|待生成)$/u.test(subject)) return "缺少当前可见主体";
    if (!state || /^(?:入口构图已建立|动作展开|关键变化|结果状态|起始状态)$/u.test(state)) return "缺少当前冻结的可见状态";
    if (!/(?:空间|左侧|右侧|东侧|西侧|北侧|南门|桌面|桌沿|门框|前景|中景|背景|位于|站在|坐在|视线|看向|接触|支撑|道具|环境|中央)/u.test(prompt)) return "缺少可验收的空间、视线、姿态、道具或环境结果";
    if (/(?:运镜|推镜|拉镜|摇镜|跟拍|滑轨|环绕|吊臂|时间段|时间轴|动作过程|对白|旁白|声音|音效|音乐|口型)/u.test(positiveText(prompt))) return "静态画面包含视频过程、对白或声音指令";
    return "";
}

function staticPromptWarnings(prompt) {
    const subject = normalize(field(prompt, "画面主体") || field(prompt, "静态关键帧"));
    const state = normalize(field(prompt, "可见状态"));
    const warnings = [];
    if (subject && state && subject === state) warnings.push("画面主体与可见状态重复");
    if (/(?:静态关键帧|可见表演状态|景别|机位与构图|站位与视线|三层空间|负面约束)[：:]/u.test(prompt)) warnings.push("包含旧版静态字段");
    if (/(?:需要移动|沿[^，。；\n]{1,20}移动|目光往返|后退半步|动作节点|触发)/u.test(positiveText(prompt))) warnings.push("静态正文疑似包含动作过程");
    return warnings;
}

function positiveText(prompt) {
    return prompt
        .split(/\r?\n/u)
        .filter((line) => !/^(?:针对性约束|负面约束)[：:]/u.test(line.trim()))
        .join("\n");
}

function field(prompt, label) {
    const labels = ["画面主体", "静态关键帧", "可见状态", "可见表演状态", "构图与空间", "景别", "机位与构图", "站位与视线", "三层空间", "光色与风格", "针对性约束", "负面约束"];
    const next = labels.filter((item) => item !== label).join("|");
    return prompt.match(new RegExp(`(?:^|\\n)${label}[：:]\\s*([\\s\\S]*?)(?=\\n(?:${next})[：:]|$)`, "u"))?.[1]?.trim() || "";
}

function firstUnlabeledLine(prompt) {
    return (
        prompt
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .find((line) => line && !/^[^：:]{1,20}[：:]/u.test(line)) || ""
    );
}

function normalize(value) {
    return value.replace(/[\s“”"「」『』，。！？!?、：:；;…—-]/gu, "").trim();
}

function renderMarkdown(pkg) {
    const sections = Array.isArray(pkg.archive?.sections) ? pkg.archive.sections : [];
    const body = sections.map((section) => `## ${section.title || "未命名章节"}\n\n${String(section.content || "").trim()}`).join("\n\n");
    const embedded = JSON.stringify(pkg, null, 2).replaceAll("```", "\\u0060\\u0060\\u0060");
    return `# 《${pkg.project?.title || "短剧制作包"}》完整制作包\n\n> 制作包格式：\`vozeb-drama-production-package-v1\`\n> 本文件仅由 Agent 已生成的 JSON 确定性导出，不重建任何提示词。\n\n## 规范对象（导入权威数据）\n\n\`\`\`drama-production-package\n${embedded}\n\`\`\`\n\n${body}\n`;
}
