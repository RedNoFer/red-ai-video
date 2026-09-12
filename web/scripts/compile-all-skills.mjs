import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
for (const script of ["compile-seedance-25-skill.mjs", "compile-drama-image-skill.mjs", "compile-drama-video-director-skill.mjs", "compile-drama-production-package-template.mjs"]) {
    const result = spawnSync(process.execPath, [path.join(scriptsRoot, script)], { cwd: path.resolve(scriptsRoot, ".."), stdio: "inherit" });
    if (result.status) process.exit(result.status);
}
