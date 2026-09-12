import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("./build-xiao-yan-fresh-30s-package.mjs", import.meta.url), "utf8");

describe("fresh drama package exporter", () => {
    it("only validates and exports the current Agent package", () => {
        expect(script).toContain("const inputPath = process.argv[2]");
        expect(script).toContain('source: "agent-output-only"');
        expect(script).toContain("不重建任何提示词");
        expect(script).not.toContain("three-year-pact-standalone-production-package-30s.json");
        expect(script).not.toContain("staticPromptLabels");
        expect(script).not.toContain("compactStaticPrompt");
        expect(script).not.toContain("SHxx");
        expect(script).not.toContain("2.txt");
    });
});
