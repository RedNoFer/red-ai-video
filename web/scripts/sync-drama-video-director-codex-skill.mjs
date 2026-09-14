import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashSkillContent, listSkillFiles } from "./skill-content-hash.mjs";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "..");
const codexSkillsRoot = path.join(os.homedir(), ".codex", "skills");
const checkOnly = process.argv.includes("--check");
const skills = [
    {
        id: "drama-video-director",
        sourceRoot: path.join(repoRoot, ".agents", "skills", "drama-video-director"),
        destinationRoot: path.join(codexSkillsRoot, "drama-video-director"),
    },
    {
        id: "seedance-25-director",
        sourceRoot: path.join(repoRoot, ".agents", "skills", "seedance-25"),
        destinationRoot: path.join(codexSkillsRoot, "seedance-25-director"),
    },
];

const results = skills.map((skill) => syncOrCheckSkill(skill));
const failed = results.filter((result) => !result.ok);
for (const result of results) console.log((result.ok ? (checkOnly ? "OK " : "Synced ") : "ERROR ") + result.id + ": " + result.message);
if (failed.length) process.exit(1);

function syncOrCheckSkill(skill) {
    const files = listSkillFiles(skill.sourceRoot);
    const sourceContentHash = hashSkillContent(skill.sourceRoot);
    const sourceManifest = readJson(path.join(skill.sourceRoot, "manifest.json"));
    const expected = {
        id: skill.id,
        sourcePath: path.relative(repoRoot, skill.sourceRoot),
        sourceVersion: String(sourceManifest?.sourceVersion || readFrontmatterVersion(path.join(skill.sourceRoot, "SKILL.md")) || "current"),
        sourceContentHash,
    };
    if (checkOnly) {
        const missing = files.find((file) => !sameFile(file, path.join(skill.destinationRoot, path.relative(skill.sourceRoot, file))));
        const mirrorManifest = readJson(path.join(skill.destinationRoot, "manifest.json"));
        if (missing) return { ok: false, id: skill.id, message: "镜像文件缺失或内容不一致：" + path.relative(skill.sourceRoot, missing) };
        if (!mirrorManifest || mirrorManifest.sourceContentHash !== expected.sourceContentHash) return { ok: false, id: skill.id, message: "镜像 manifest 与项目源码哈希不一致" };
        return { ok: true, id: skill.id, message: expected.sourceVersion + " " + sourceContentHash };
    }

    mkdirSync(skill.destinationRoot, { recursive: true });
    for (const file of files) {
        const destination = path.join(skill.destinationRoot, path.relative(skill.sourceRoot, file));
        mkdirSync(path.dirname(destination), { recursive: true });
        copyFileSync(file, destination);
    }
    writeFileSync(path.join(skill.destinationRoot, "manifest.json"), JSON.stringify({ ...expected, syncedAt: new Date().toISOString(), mirrorOf: "project-skill-source" }, null, 2) + "\n", "utf8");
    return { ok: true, id: skill.id, message: expected.sourceVersion + " " + sourceContentHash };
}

function sameFile(source, destination) {
    return existsSync(destination) && readFileSync(source).equals(readFileSync(destination));
}

function readJson(file) {
    if (!existsSync(file)) return undefined;
    try {
        return JSON.parse(readFileSync(file, "utf8"));
    } catch {
        return undefined;
    }
}

function readFrontmatterVersion(file) {
    const source = readFileSync(file, "utf8");
    return source.match(/^version:\s*(.+)$/mu)?.[1]?.trim();
}
