import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generationRuntimeEnvironment, resolveDevelopmentEnvironment, superviseGenerationRuntime } from "./generation-runtime.mjs";
import { prepareIsolatedStandaloneRuntime, prepareStandaloneAssets } from "./standalone-assets.mjs";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next";
const buildRoot = path.join(webRoot, distDir);
const standaloneRoot = path.join(buildRoot, "standalone");

await prepareStandaloneAssets({ webRoot, distDir });
const isolatedRuntime = await prepareIsolatedStandaloneRuntime({ standaloneRoot });

const runtime = generationRuntimeEnvironment({
    environment: resolveDevelopmentEnvironment({
        webRoot,
        environment: {
            ...process.env,
            PORT: process.env.PORT || "3010",
            HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
            VOZEB_PRO_DATA_DIR: process.env.VOZEB_PRO_DATA_DIR || path.join(webRoot, ".data"),
            VOZEB_PRO_INTERNAL_ORIGIN: process.env.VOZEB_PRO_INTERNAL_ORIGIN || `http://127.0.0.1:${process.env.PORT || "3010"}`,
        },
    }),
});
try {
    process.exitCode = await superviseGenerationRuntime({
        app: { command: process.execPath, args: ["server.js"], cwd: isolatedRuntime.runtimeRoot },
        workerScript: path.join(webRoot, "scripts", "generation-worker.mjs"),
        environment: runtime.environment,
    });
} finally {
    await rm(isolatedRuntime.runtimeContainer, { recursive: true, force: true });
}
