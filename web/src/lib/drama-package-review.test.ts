import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DramaProductionPackageV1, DramaProject } from "./drama-project-contract";
import { reviewDramaPackage } from "./drama-package-review";
import { dramaDenseHardCutIssues, extractDramaVideoPromptCards, validateDramaVideoPromptAudioHierarchy, validateDramaVideoPromptCardLayout, validateDramaVideoPromptUtteranceCoverage } from "./drama-prompt-quality";
import { applyDramaProductionPackage, previewDramaProductionPackage } from "./server/drama-production-package";
import { serializeDramaProductionPackageJson, serializeDramaProductionPackageMarkdown } from "./drama-production-package-serializer";

const fixture = () => JSON.parse(readFileSync(new URL("../../../docs/drama-production-package-v1-field-example.json", import.meta.url), "utf8")) as DramaProductionPackageV1;
const preview = (value: DramaProductionPackageV1, project?: DramaProject) => previewDramaProductionPackage(JSON.stringify(value), "contract.json", project, { allowImportWarnings: true, enforceExecutionContract: true });
const blockers = (value: ReturnType<typeof reviewDramaPackage>) => value.checks.filter((check) => check.status === "blocked");

describe("external production package read-only facts", () => {
    it("imports the field example without silently repairing dialogue, public prose or frame prompts", () => {
        const source = fixture();
        const authored = source.episodes[0].shots[0];
        authored.videoPrompt = `  ${authored.videoPrompt}\n `;
        authored.framePlan.frames[0].imagePrompt += "\n  外套的材质与颜色保持。 ";
        source.assets.characters[0].profile = { visualIdentity: "左眉短疤", styling: "原作者深灰外套", colorPalette: "深灰", consistencyRules: "衣服颜色与材质固定" };
        const result = preview(source);
        expect(result.package.episodes[0].shots[0].videoPrompt).toBe(authored.videoPrompt);
        expect(result.package.episodes[0].shots[0].framePlan.frames[0].imagePrompt).toBe(authored.framePlan.frames[0].imagePrompt);
        expect(result.package.assets.characters[0].profile).toMatchObject(source.assets.characters[0].profile);
        expect(result.package.authoring?.qualityGateStatus).toBe("blocked");
        expect(result.importWarnings?.length).toBeGreaterThan(0);
        const target = {
            id: "project",
            title: "目标",
            ratio: "9:16",
            style: "不同视觉风格",
            characters: [],
            scenes: [],
            props: [],
            clues: [],
            episodes: [],
            createdAt: "2026-10-11T00:00:00.000Z",
            updatedAt: "2026-10-11T00:00:00.000Z",
        } as unknown as DramaProject;
        const applied = applyDramaProductionPackage(target, result.package, result.sourceHash, JSON.stringify(source), "contract.json", { validatedStandalonePackage: true });
        expect(applied.episodes[0].shots[0].videoPrompt).toBe(authored.videoPrompt);
        expect(applied.episodes[0].shots[0].dialogue).toBe(authored.dialogue);
        expect(applied.episodes[0].shots[0].utterances[0].text).toBe("外套颜色没变，别说话。");
        expect(applied.episodes[0].shots[0].framePlan?.frames[0].imagePrompt).toBe(authored.framePlan.frames[0].imagePrompt);
    });

    it("retains manual execution prose and warns about the resulting dialogue conflict", () => {
        const source = fixture();
        const target = { id: "project", title: "目标", ratio: "9:16", characters: [], scenes: [], props: [], clues: [], episodes: [], createdAt: "2026-10-11T00:00:00.000Z", updatedAt: "2026-10-11T00:00:00.000Z" } as unknown as DramaProject;
        const existing = applyDramaProductionPackage(target, preview(source).package, "first", undefined, "contract.json", { validatedStandalonePackage: true });
        const manual = "人工手部特写，保持外套颜色与材质。";
        existing.episodes[0].shots[0].executionVideoPrompt = manual;
        existing.episodes[0].shots[0].fieldOrigins = { executionVideoPrompt: "manual" };
        const result = preview(source, existing);
        expect(result.importWarnings?.join("\n")).toContain("人工字段保留后");
        const applied = applyDramaProductionPackage(existing, result.package, result.sourceHash, undefined, "contract.json", { validatedStandalonePackage: true });
        expect(applied.episodes[0].shots[0].executionVideoPrompt).toBe(manual);
    });

    it("locates missing lines and keeps ambiguous source quotes as an explicit review gap", () => {
        const value = fixture();
        const source = "林雪：外套颜色没变，别说话。\n信封标着“证物”。\n林雪：把信留下。";
        const result = reviewDramaPackage(value, undefined, source);
        expect(
            blockers(result)
                .map((check) => check.evidence)
                .join("\n"),
        ).toContain("把信留下");
        expect(
            blockers(result)
                .map((check) => check.evidence)
                .join("\n"),
        ).not.toContain("证物");
        expect(result.checks.some((check) => check.status === "warning" && check.evidence.includes("证物"))).toBe(true);
    });

    it("reports a missing adjacent edge and an invalid endpoint separately", () => {
        const value = fixture();
        const next = structuredClone(value.episodes[0].shots[0]);
        next.code = "SH02";
        value.episodes[0].shots.push(next);
        value.episodes[0].continuityEdges.push({ fromShotCode: "SH01", toShotCode: "SH99", transition: "continuous", inheritActualEndFrame: false, carryCharacterIds: [], carryPropIds: [], carryEnvironment: false, carryAxis: false });
        const issues = blockers(reviewDramaPackage(value))
            .map((check) => check.evidence)
            .join("\n");
        expect(issues).toContain("缺少相邻片段连接");
        expect(issues).toContain("无效或缺少出口/入口状态");
    });

    it("rejects broken frame time while a quality-blocked package remains importable", () => {
        const value = fixture();
        expect(() => preview(value)).not.toThrow();
        value.episodes[0].shots[0].framePlan.frames[1].startSecond = 4;
        expect(() => preview(value)).toThrow("时间必须从 0 连续覆盖");
    });

    it("reads fenced chapter eleven prose and detects body-to-JSON disagreement without rewriting exports", () => {
        const value = fixture();
        value.episodes[0].shots[0].imagePrompt += "\n  原作者保留的外套材质。 ";
        const markdown = serializeDramaProductionPackageMarkdown(value);
        const report = reviewDramaPackage(value, markdown);
        expect(blockers(report).some((check) => check.evidence.includes("第十一章"))).toBe(false);
        const changed = markdown.replace("C01｜林雪", "C01｜另一人");
        expect(blockers(reviewDramaPackage(value, changed)).some((check) => check.code === "JSON_MARKDOWN_CONSISTENCY")).toBe(true);
        expect(JSON.parse(serializeDramaProductionPackageJson(value)).episodes[0].shots[0].imagePrompt).toBe(value.episodes[0].shots[0].imagePrompt);
        expect(markdown).not.toContain("已由服务端质量门禁校验");
    });
});

describe("public dialogue and sound scope", () => {
    it("does not confuse a spoken '别说话', listener silence or silence after speech with a mute conflict", () => {
        const shot = fixture().episodes[0].shots[0];
        expect(validateDramaVideoPromptAudioHierarchy(shot.videoPrompt, "SH01")).toEqual([]);
        expect(validateDramaVideoPromptAudioHierarchy(shot.videoPrompt.replace("收句后闭口。", "听者禁止说话；收句后只保留环境声。"), "SH01")).toEqual([]);
        expect(validateDramaVideoPromptAudioHierarchy(shot.videoPrompt.replace("收句后闭口。", "林雪儿禁止说话。"), "SH01")).toEqual([]);
        expect(validateDramaVideoPromptAudioHierarchy(shot.videoPrompt.replace("收句后闭口。", "林雪禁止说话。"), "SH01").join("\n")).toContain("同一发声窗口");
        expect(validateDramaVideoPromptAudioHierarchy(shot.videoPrompt.replace("收句后闭口。", "全段静音。"), "SH01").join("\n")).toContain("同一发声窗口");
        expect(validateDramaVideoPromptAudioHierarchy(shot.videoPrompt.replace("收句后闭口。", "仅呼吸。"), "SH01").join("\n")).toContain("同一发声窗口");
        expect(validateDramaVideoPromptAudioHierarchy(shot.videoPrompt.replace("收句后闭口。", "林雪不发声。"), "SH01").join("\n")).toContain("同一发声窗口");
    });

    it("uses exact speaker identity and detects duplicated quoted speech", () => {
        const shot = fixture().episodes[0].shots[0];
        const wrongSpeaker = shot.videoPrompt.replace("林雪说：", "林雪儿说：");
        expect(validateDramaVideoPromptUtteranceCoverage(wrongSpeaker, shot.framePlan.frames, shot.utterances, "SH01").join("\n")).toContain("未完整写入");
        const repeated = shot.videoPrompt.replace("林雪说：“外套颜色没变，别说话。”", "林雪说：“外套颜色没变，别说话。”林雪说：“外套颜色没变，别说话。”");
        expect(validateDramaVideoPromptUtteranceCoverage(repeated, shot.framePlan.frames, shot.utterances, "SH01").join("\n")).toContain("重复");
        expect(validateDramaVideoPromptUtteranceCoverage(shot.videoPrompt.replace("林雪说：", "林雪（场内画外对白）说："), shot.framePlan.frames, shot.utterances, "SH01")).toEqual([]);
    });

    it("rejects duplicate fields while keeping field-like words inside multiline quoted dialogue", () => {
        const shot = fixture().episodes[0].shots[0];
        const duplicate = shot.videoPrompt.replace("人声：", "台词：无\n人声：");
        expect(validateDramaVideoPromptCardLayout(duplicate, shot.framePlan.frames, "SH01").join("\n")).toContain("重复“台词”");
        const quote = shot.videoPrompt.replace("外套颜色没变，别说话。", "外套颜色没变，\n音效：只是原句里的文字。");
        expect(extractDramaVideoPromptCards(quote)[0].dialogue).toContain("音效：只是原句里的文字。");
        expect(validateDramaVideoPromptCardLayout(quote, shot.framePlan.frames, "SH01").join("\n")).not.toContain("重复“音效”");
    });

    it("keeps a long utterance on a monotonic cursor across a listener or hand closeup", () => {
        const shot = fixture().episodes[0].shots[0];
        const utterance = { ...shot.utterances[0], startSecond: 0, endSecond: 15 };
        const continued = shot.videoPrompt.replace("外套颜色没变，别说话。", "外套颜色没变，").replace("台词：无", "台词：林雪（场内画外对白）说：“别说话。”");
        expect(validateDramaVideoPromptUtteranceCoverage(continued, shot.framePlan.frames, [utterance], "SH01")).toEqual([]);
        expect(validateDramaVideoPromptUtteranceCoverage(continued.replace("说：“别说话。”", "说：“外套颜色没变，别说话。”"), shot.framePlan.frames, [utterance], "SH01").join("\n")).toContain("未完整写入");
    });

    it("counts only actual boundary-aligned hard cuts and records reduced density as revision", () => {
        const frames = Array.from({ length: 8 }, (_, index) => ({ id: `F${index}`, sequenceIndex: index + 1, startSecond: index * 3.75, endSecond: (index + 1) * 3.75 }));
        const events = frames
            .slice(1)
            .map((frame) => `镜头事件：时间：${frame.startSecond}秒；类型：硬切；触发事件：来手触纸；新机位：案面南侧；切后主运镜：固定；信息目的：读出纸封归属；承接：右手持封不变。`)
            .join("\n");
        expect(dramaDenseHardCutIssues(events, frames, "SH01")).toEqual([]);
        expect(dramaDenseHardCutIssues(events.replaceAll("类型：硬切", "类型：匹配切"), frames, "SH01").join("\n")).toContain("8帧/0次");
        expect(dramaDenseHardCutIssues(events.replace("时间：3.75秒", "时间：3秒"), frames, "SH01").join("\n")).toContain("帧段边界");
        expect(dramaDenseHardCutIssues("减切原因：结果停留，确认持有人未改变。", frames.slice(0, 2), "SH01").join("\n")).toContain("修订");
    });
});
