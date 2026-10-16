import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DRAMA_PACKAGE_COMPILE_MANIFEST, DRAMA_PACKAGE_GATE_CODES, DRAMA_PACKAGE_SECTIONS } from "./drama-production-package-contract";

const docs = readFileSync(new URL("../../../../docs/drama-production-package-v1.md", import.meta.url), "utf8");
const template = readFileSync(new URL("../../../public/drama-production-package-v1-template.md", import.meta.url), "utf8");

describe("drama production package contract compilation", () => {
    it("keeps generated runtime, template, server manifest and Codex work-order rules on one source hash", () => {
        expect(DRAMA_PACKAGE_SECTIONS).toHaveLength(13);
        expect(DRAMA_PACKAGE_GATE_CODES).toEqual(
            expect.arrayContaining([
                "LITERARY_SCRIPT_COMPLETENESS",
                "DIALOGUE_CAPACITY",
                "DIALOGUE_SPEAKER_VISUAL_MATCH",
                "ACTION_RESULT",
                "TEXT_STATE_CONTINUITY",
                "CROSS_SHOT_STATE_INHERITANCE",
                "SHOT_DURATION_POLICY",
                "CAMERA_EVENT",
                "JSON_MARKDOWN_CONSISTENCY",
                "PROVENANCE",
            ]),
        );
        expect(DRAMA_PACKAGE_COMPILE_MANIFEST.contract.contentHash).toBe(sha256(section(docs, "版本化契约块")));
        expect(template).toContain(`契约 hash：\`${DRAMA_PACKAGE_COMPILE_MANIFEST.contract.contentHash}\``);
        expect(template).toContain(DRAMA_PACKAGE_COMPILE_MANIFEST.packageSpecHash);
        expect(DRAMA_PACKAGE_COMPILE_MANIFEST.codexWorkOrderRules).toContain("不调用 executeDramaScriptRun");
        expect(template).toContain("外部 Codex 独立生成");
        expect(template).toContain("qualityGateStatus=passed");
        expect(template).toContain("availableSpeechSeconds = endSecond - startSecond");
        expect(template).toContain("不适用于逐句口型窗口");
        expect(template).toContain("默认必须使用 `independent` 并由文字状态锁定连续性");
        expect(template).toContain("剪辑承接");
        expect(template).toContain("只有全部 blocker 门禁均为 `passed`");
        expect(template).toContain("准备回应");
        expect(docs).toMatch(/informationalGateCodes:[\s\S]*- VIDEO_PROMPT_LENGTH/u);
        expect(template).toMatch(/`VIDEO_PROMPT_LENGTH`\s*\| warning/u);
        expect(template).toContain("2500 是提醒线");
        expect(template).toContain("超出只提示");
        expect(template).toContain("seedance25-prompt-adapter@1.4.0");
        for (const gateCode of DRAMA_PACKAGE_GATE_CODES) expect(template).toContain(`\`${gateCode}\``);
        for (const title of DRAMA_PACKAGE_SECTIONS) expect(template).toContain(title);
    });

    it("publishes a stable narrator identity and per-line delivery without changing source speech", () => {
        expect(template).toContain("旁白声音身份与逐句讲述");
        expect(template).toContain("这不是所有项目的默认性别");
        expect(template).toContain("archive.voiceDirections");
        expect(template).toContain("archive.dialogueDirections[].performance");
        expect(template).toContain("保留原句、原说话人、出现顺序与次数及既定发声时间");
        expect(docs).toContain("场内画外对白不转为统一旁白");
        expect(docs).toContain("不得把特定项目的女声偏好设为所有项目默认");
    });

    it("keeps QC metadata out of public prompts in the canonical package contract", () => {
        expect(template).toContain("字段边界（硬性）");
        expect(template).toContain("门禁状态/代码/证据、帧数/切数");
        expect(template).toContain("禁止依赖导入、保存、编译或提交时过滤");
        expect(docs).toContain("字段边界（authoring 硬性要求）");
    });

    it("publishes the field guide and tested JSON from the canonical documentation", () => {
        for (const name of ["drama-production-package-v1-fields.md", "drama-production-package-v1-field-example.json"]) {
            const published = readFileSync(new URL(`../../../public/${name}`, import.meta.url), "utf8");
            const source = readFileSync(new URL(`../../../../docs/${name}`, import.meta.url), "utf8");
            if (name.endsWith(".json")) expect(JSON.parse(published)).toEqual(JSON.parse(source));
            else expect(published).toBe(source);
        }
        expect(template).toContain("drama-production-package-v1-fields.md");
        expect(docs).not.toContain("三视图");
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
