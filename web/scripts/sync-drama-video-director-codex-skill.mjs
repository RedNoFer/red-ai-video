import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "..");
const sourcePath = path.join(repoRoot, ".agents", "skills", "drama-video-director", "SKILL.md");
const source = readFileSync(sourcePath, "utf8");
const sourceContentHash = createHash("sha256").update(source, "utf8").digest("hex");
const destinationRoot = path.join(os.homedir(), ".codex", "skills", "drama-video-director");

mkdirSync(destinationRoot, { recursive: true });
copyFileSync(sourcePath, path.join(destinationRoot, "SKILL.md"));
writeFileSync(path.join(destinationRoot, "manifest.json"), `${JSON.stringify({ id: "drama-video-director", sourcePath, sourceContentHash, syncedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
console.log(`Synced drama-video-director to ${destinationRoot} (${sourceContentHash})`);
