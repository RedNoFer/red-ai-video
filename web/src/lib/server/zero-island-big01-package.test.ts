import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { previewDramaProductionPackage } from "@/lib/server/drama-production-package";
import { validateDramaAuthoringQuality } from "@/lib/server/drama-production-package-quality";

const stem = fileURLToPath(new URL("../../../../output/零坐标岛_BIG01_第1-10集_1200s_身份校正_精简提示词_20261004", import.meta.url));
// The package is a local authoring deliverable, not a repository fixture; run only when it exists.
const hasLocalPackage = existsSync(`${stem}.json`);

describe.skipIf(!hasLocalPackage)("fresh zero island BIG01 package", () => {
    it("imports as one 1200-second episode with plot-bound identities", () => {
        const json = readFileSync(`${stem}.json`, "utf8");
        const preview = previewDramaProductionPackage(json, "zero-island-big01.json", undefined, { allowImportWarnings: true });
        const shots = preview.package.episodes[0].shots;
        expect(preview.package.episodes).toHaveLength(1);
        expect(shots).toHaveLength(40);
        expect(shots.reduce((sum, shot) => sum + shot.duration, 0)).toBe(1200);
        expect(preview.package.assets.characters.find((character) => character.code === "C01")?.name).toBe("罗衡");
        expect(preview.package.assets.characters.find((character) => character.code === "C02")?.name).toBe("陆川");
        expect(shots[0].characterCodes).toEqual(["C01"]);
        expect(shots[0].framePlan.referenceManifest?.filter((reference) => reference.role === "character_anchor").map((reference) => reference.assetId)).toEqual(["C01"]);
        expect(shots[1].characterCodes).toEqual(["C01", "C02"]);
        expect(shots[1].framePlan.referenceManifest?.filter((reference) => reference.role === "character_anchor").map((reference) => reference.assetId)).toEqual(["C01", "C02"]);
        expect(shots.every((shot) => shot.framePlan.frames.length >= 8 && shot.framePlan.frames.length <= 11)).toBe(true);
        expect(new Set(shots.map((shot) => shot.framePlan.frames.length)).size).toBeGreaterThan(1);
        expect(
            shots.every((shot) => {
                const hardCuts = shot.videoPrompt.match(/类型：硬切/gu)?.length || 0;
                return hardCuts >= 7 && hardCuts <= 11;
            }),
        ).toBe(true);
        expect(shots.every((shot) => Array.from(shot.videoPrompt).length <= 2000)).toBe(true);
        expect(shots.every((shot) => (shot.videoPrompt.match(/当前项目视觉合同（唯一风格来源）/gu) || []).length === 1)).toBe(true);
        expect(shots[0].videoPrompt).toContain("信息目的：影像随手掌遮住镜头而中断");
        expect(preview.package.project.productionLock?.logicalShotCount).toBe(40);
        expect(preview.package.archive?.sections).toHaveLength(13);
        expect(preview.package.authoring?.qualityGateStatus).toBe("blocked");
        expect(preview.warnings.join("\n")).toContain("qualityGateStatus");
    });

    it("keeps Markdown and JSON canonical objects identical", () => {
        const json = readFileSync(`${stem}.json`, "utf8");
        const markdown = readFileSync(`${stem}.md`, "utf8");
        const embedded = markdown.match(/```drama-production-package\n([\s\S]*?)\n```/u)?.[1];
        expect(embedded).toBeTruthy();
        expect(JSON.parse(embedded!)).toEqual(JSON.parse(json));
    });

    it("reports strict authoring quality separately from import", () => {
        const json = readFileSync(`${stem}.json`, "utf8");
        const preview = previewDramaProductionPackage(json, "zero-island-big01.json", undefined, { allowImportWarnings: true });
        const report = validateDramaAuthoringQuality({ package: preview.package, sources: [{ id: "novel", role: "story-source", type: "text", textContent: preview.package.episodes[0].script } as never] });
        expect(report.status).toBe("blocked");
        expect(report.checks.find((check) => check.code === "LOGICAL_SHOT_COUNT")?.evidence).toContain("逻辑片段 40 个");
        expect(report.checks.find((check) => check.code === "DIALOGUE_CAPACITY")?.evidence).toContain("每个含对白逻辑片段的自然语速");
        expect(report.checks.find((check) => check.code === "PROVENANCE")?.evidence).toContain("独立 Codex 来源");
    });
});
