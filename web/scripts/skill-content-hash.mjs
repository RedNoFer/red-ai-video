import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export function listSkillFiles(root) {
    return walk(root).filter((file) => path.basename(file) !== "manifest.json");
}

export function hashSkillContent(root) {
    const hash = createHash("sha256");
    const files = listSkillFiles(root).filter((file) => {
        const relative = path.relative(root, file).split(path.sep).join("/");
        return relative === "SKILL.md" || relative.startsWith("references/");
    });
    for (const file of files.sort()) {
        hash.update(path.relative(root, file).split(path.sep).join("/"), "utf8");
        hash.update("\n", "utf8");
        hash.update(readFileSync(file));
        hash.update("\n", "utf8");
    }
    return hash.digest("hex");
}

function walk(root) {
    return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const absolute = path.join(root, entry.name);
        return entry.isDirectory() ? walk(absolute) : statSync(absolute).isFile() ? [absolute] : [];
    });
}
