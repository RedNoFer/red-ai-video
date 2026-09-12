import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "..");
const templateSourcePath = path.join(repoRoot, "docs", "drama-production-package-v1-template.md");
const skillSourcePath = path.join(repoRoot, ".agents", "skills", "drama-video-director", "SKILL.md");
const packageSpecPath = path.join(repoRoot, "docs", "drama-production-package-v1.md");
const packageRulesPath = path.join(webRoot, "src", "lib", "server", "drama-production-package-rules.ts");
const outputPath = path.join(webRoot, "public", "drama-production-package-v1-template.md");

const templateSource = readFileSync(templateSourcePath, "utf8");
const skillSource = readFileSync(skillSourcePath, "utf8");
const packageSpec = readFileSync(packageSpecPath, "utf8");
const packageRules = readFileSync(packageRulesPath, "utf8");
const skillVersion = skillSource.match(/^version:\s*(.+)$/mu)?.[1]?.trim() || "current";
const skillHash = sha256(skillSource);
const packageSpecHash = sha256(packageSpec);
const packageRulesHash = sha256(packageRules);
const staticFrameRules = extractSection(skillSource, "静态帧适配器");
const packageChapterHeadings = extractPackageChapterHeadings(packageSpec);

if (!staticFrameRules) throw new Error("drama-video-director Skill 缺少“静态帧适配器”章节");

const replacements = {
    "{{DRAMA_VIDEO_DIRECTOR_VERSION}}": skillVersion,
    "{{DRAMA_VIDEO_DIRECTOR_HASH}}": skillHash,
    "{{DRAMA_PACKAGE_SPEC_HASH}}": packageSpecHash,
    "{{DRAMA_PACKAGE_RULES_HASH}}": packageRulesHash,
    "{{DRAMA_VIDEO_DIRECTOR_STATIC_FRAME_RULES}}": staticFrameRules,
};
const template =
    Object.entries(replacements)
        .reduce((value, [token, replacement]) => value.replaceAll(token, replacement), templateSource)
        .trimEnd() + "\n";
if (/\{\{[A-Z0-9_]+\}\}/u.test(template)) throw new Error("制作包模板存在未替换的同步标记");
for (const heading of packageChapterHeadings) {
    if (!new RegExp(`^##\\s+[^\\n]*${escapeRegExp(heading)}`, "mu").test(template)) throw new Error(`制作包模板缺少规范章节：${heading}`);
}
const packageContractMarkers = ["imagePrompt", "framePlan.start.source", "framePlan.end.required", "framePlan.referenceManifest", "dramaticFunction", "backgroundNpcPolicy"];
for (const marker of packageContractMarkers) {
    if (!packageRules.includes(marker)) throw new Error(`服务端制作包规则缺少规范字段：${marker}`);
    if (!template.includes(marker)) throw new Error(`制作包模板缺少规范字段：${marker}`);
}

const formattedTemplate = await prettier.format(template, { filepath: outputPath, parser: "markdown" });
writeFileSync(outputPath, formattedTemplate, "utf8");

function sha256(value) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function extractSection(value, heading) {
    const lines = value.replace(/^---[\s\S]*?---\r?\n/u, "").split(/\r?\n/u);
    const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
    if (start < 0) return "";
    const content = [];
    for (const line of lines.slice(start + 1)) {
        if (/^##\s+/u.test(line.trim())) break;
        content.push(line);
    }
    return content.join("\n").trim();
}

function extractPackageChapterHeadings(value) {
    const section = extractSection(value, "固定章节顺序");
    return [...section.matchAll(/^\d+\.\s+([^：:]+)[：:]/gmu)].map((match) => match[1].trim());
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
