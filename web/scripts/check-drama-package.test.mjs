import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const command = path.join(root, "web/scripts/check-drama-package.mjs");
const run = (...args) => spawnSync(process.execPath, [command, ...args], { cwd: root, encoding: "utf8" });

describe("read-only drama package CLI", () => {
    it("returns importability and existing QC with a source gap and leaves the original bytes intact", () => {
        const file = path.join(root, "docs/drama-production-package-v1-field-example.json");
        const before = createHash("sha256").update(readFileSync(file)).digest("hex");
        const result = run(file);
        expect(result.status).toBe(2);
        const report = JSON.parse(result.stdout);
        expect(report.importable).toBe(true);
        expect(report.qualityGateReport.checks.some((check) => check.evidence.includes("未提供源 TXT"))).toBe(true);
        expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(before);
    });

    it("accepts a source TXT and locates missing dialogue without invoking a provider", () => {
        const dir = mkdtempSync(path.join(tmpdir(), "drama-cli-"));
        try {
            const source = path.join(dir, "source.txt");
            writeFileSync(source, "林雪：外套颜色没变，别说话。\n林雪：把信留下。", "utf8");
            const result = run(path.join(root, "docs/drama-production-package-v1-field-example.json"), "--source", source);
            expect(result.status).toBe(2);
            expect(JSON.parse(result.stdout).qualityGateReport.checks.some((check) => check.evidence.includes("把信留下"))).toBe(true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("returns a structural failure for broken JSON and invalid UTF-8", () => {
        const dir = mkdtempSync(path.join(tmpdir(), "drama-cli-"));
        try {
            const file = path.join(dir, "broken.json");
            for (const content of [Buffer.from("{broken"), Buffer.from([0xff])]) {
                writeFileSync(file, content);
                const result = run(file);
                expect(result.status).toBe(1);
                expect(JSON.parse(result.stdout).importable).toBe(false);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
