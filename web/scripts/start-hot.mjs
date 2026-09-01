import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const environment = { ...process.env };

// E2E injects a file provider and isolated data directory into its child process.
// They must not leak into the normal local PostgreSQL development server.
delete environment.VOZEB_PRO_DATABASE_PROVIDER;
delete environment.VOZEB_PRO_DATA_DIR;

const child = spawn(process.execPath, [path.join(webRoot, "scripts", "run-app.mjs"), "dev"], {
    cwd: webRoot,
    env: environment,
    stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));

child.once("error", (error) => {
    console.error("Hot development server failed to start", error);
    process.exitCode = 1;
});

child.once("exit", (code, signal) => {
    process.exitCode = typeof code === "number" ? code : signal ? 1 : 0;
});
