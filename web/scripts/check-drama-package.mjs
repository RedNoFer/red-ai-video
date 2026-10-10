import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const packagePath = args[0];
const sourceIndex = args.indexOf("--source");
let server;
try {
    if (!packagePath || (sourceIndex >= 0 && !args[sourceIndex + 1])) throw new Error("用法：pnpm --dir web run check:drama-package -- <制作包.md> [--source <源文.txt>]");
    const decode = (file) => new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path.resolve(file)));
    const source = decode(packagePath);
    const storySource = sourceIndex >= 0 ? decode(args[sourceIndex + 1]) : undefined;
    const require = createRequire(import.meta.url);
    const vitePath = require.resolve("vite", { paths: [path.dirname(require.resolve("vitest/package.json"))] });
    const { createServer } = await import(pathToFileURL(vitePath).href);
    server = await createServer({ configFile: false, root: webRoot, logLevel: "silent", resolve: { alias: { "@": path.join(webRoot, "src") } }, server: { middlewareMode: true, watch: null }, appType: "custom" });
    const { previewDramaProductionPackage } = await server.ssrLoadModule("/src/lib/server/drama-production-package.ts");
    const { reviewDramaPackage } = await server.ssrLoadModule("/src/lib/drama-package-review.ts");
    const { validateDramaAuthoringQuality } = await server.ssrLoadModule("/src/lib/server/drama-production-package-quality.ts");
    const preview = previewDramaProductionPackage(source, path.basename(packagePath), undefined, { allowImportWarnings: true, enforceExecutionContract: true });
    const report = reviewDramaPackage(preview.package, preview.format === "markdown" ? source : undefined, storySource);
    const authoring = validateDramaAuthoringQuality({
        package: preview.package,
        sources: storySource === undefined ? [] : [{ alias: "@源文", role: "story-source", type: "text", title: path.basename(args[sourceIndex + 1]), textContent: storySource }],
        authoringAudit: preview.package.authoring?.authoringAudit,
    });
    const checks = [...report.checks, ...authoring.checks, ...(preview.package.authoring?.qualityGateReport?.checks || []).map((check) => ({ ...check, scope: `作者自检/${check.scope}` }))];
    const lockedSourceHash = preview.package.project.productionLock?.storySourceHash;
    if (storySource !== undefined && lockedSourceHash && createHash("sha256").update(storySource, "utf8").digest("hex") !== lockedSourceHash)
        checks.push({
            code: "PROVENANCE",
            status: "blocked",
            severity: "blocker",
            scope: "源 TXT 哈希",
            evidence: "当前源 TXT 与 productionLock.storySourceHash 不一致",
            sourceRefs: ["story-source", "productionLock.storySourceHash"],
            fixHint: "核对完整源文范围、编码和当前冻结哈希，不使用历史内容替代。",
        });
    const blocked = checks.some((check) => check.status === "blocked" || (check.status !== "passed" && check.severity === "blocker"));
    process.stdout.write(`${JSON.stringify({ importable: true, sourceHash: preview.sourceHash, summary: preview.summary, warnings: preview.warnings, qualityGateReport: { status: blocked ? "blocked" : "passed", checks } }, null, 2)}\n`);
    if (blocked) process.exitCode = 2;
} catch (error) {
    process.stdout.write(`${JSON.stringify({ importable: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
    process.exitCode = 1;
} finally {
    await server?.close();
}
