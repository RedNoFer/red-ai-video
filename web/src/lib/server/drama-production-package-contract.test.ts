import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DRAMA_PACKAGE_COMPILE_MANIFEST, DRAMA_PACKAGE_GATE_CODES, DRAMA_PACKAGE_SECTIONS } from "./drama-production-package-contract";

const docs = readFileSync(new URL("../../../../docs/drama-production-package-v1.md", import.meta.url), "utf8");
const template = readFileSync(new URL("../../../public/drama-production-package-v1-template.md", import.meta.url), "utf8");

describe("drama production package contract compilation", () => {
    it("keeps generated runtime, template, server manifest and Codex work-order rules on one source hash", () => {
        expect(DRAMA_PACKAGE_SECTIONS).toHaveLength(13);
        expect(DRAMA_PACKAGE_GATE_CODES).toEqual(expect.arrayContaining(["LITERARY_SCRIPT_COMPLETENESS", "DIALOGUE_CAPACITY", "SHOT_DURATION_POLICY", "CAMERA_EVENT", "PROVENANCE"]));
        expect(DRAMA_PACKAGE_COMPILE_MANIFEST.contract.contentHash).toBe(sha256(section(docs, "版本化契约块")));
        expect(template).toContain(`契约 hash：\`${DRAMA_PACKAGE_COMPILE_MANIFEST.contract.contentHash}\``);
        expect(template).toContain(DRAMA_PACKAGE_COMPILE_MANIFEST.packageSpecHash);
        expect(DRAMA_PACKAGE_COMPILE_MANIFEST.codexWorkOrderRules).toContain("executeDramaScriptRun");
        expect(template).toContain("外部 Codex 独立生成");
        expect(template).toContain("逐项 `selfCheck`");
        expect(template).toContain("availableSpeechSeconds = endSecond - startSecond");
        expect(template).toContain("不适用于逐句口型窗口");
        for (const gateCode of DRAMA_PACKAGE_GATE_CODES) expect(template).toContain(`\`${gateCode}\``);
        for (const title of DRAMA_PACKAGE_SECTIONS) expect(template).toContain(title);
    });
});

function section(value: string, heading: string) {
    const lines = value.replace(/^---[\s\S]*?---\r?\n/u, "").split(/\r?\n/u);
    const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
    if (start < 0) throw new Error(`Missing section: ${heading}`);
    const content: string[] = [];
    for (const line of lines.slice(start + 1)) {
        if (/^##\s+/u.test(line.trim())) break;
        content.push(line);
    }
    return content.join("\n").trim();
}

function sha256(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}
