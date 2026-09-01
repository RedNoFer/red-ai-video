import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Drama generation production workspace", () => {
    it("uses readiness, one primary action, grouped tools and an actionable compact empty state", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8");

        expect(source).toContain("summarizeDramaGeneration");
        expect(source).toContain("data-drama-generation-readiness");
        expect(source).toContain("生成前检查");
        expect(source).toContain("主生成");
        expect(source).toContain("后期处理");
        expect(source).toContain("交付导出");
        expect(source).toContain("buildPrimaryAction");
        expect(source).toContain("onOpenAssets");
        expect(source).toContain("onCompleteShotReview");
        expect(source).toContain("onAutoFixPreflight");
        expect(source).toContain("让 Agent 自动修复可修复问题");
        expect(source).toContain("前置检查已通过");
        expect(source).toContain("仍有阻断项");
        expect(source).toContain("智能补全参数");
        expect(source).not.toContain("data-drama-generation-empty");
        expect(source).toContain('<section className="mt-2.5"');
        expect(source).not.toContain("<Empty");
        expect(source).not.toContain("sm:grid-cols-4");
    });

    it("keeps shot task rows mobile-safe and exposes exact failure labels", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8");

        expect(source).toContain("data-drama-shot-task-list");
        expect(source).toContain("data-drama-shot-task");
        expect(source).toContain("data-drama-shot-execution-details");
        expect(source).toContain("展开详情");
        expect(source).toContain("实际执行提示词");
        expect(source).toContain("实际引用资产");
        expect(source).toContain("data-drama-shot-reference-assets");
        expect(source).toContain("引用资产图片");
        expect(source).toContain("data-drama-shot-supplier-prompt");
        expect(source).toContain("data-drama-shot-boundary-frames");
        expect(source).toContain("视频供应商提示词");
        expect(source).toContain("Agent 生成提示词");
        expect(source).toContain("视频提示词已保存");
        expect(source).toContain("请先按开始到结束顺序生成并验收全部顺序帧");
        expect(source).toContain("shotReferenceAssets");
        expect(source).toContain("[content-visibility:visible]");
        expect(source).toContain("sm:[content-visibility:auto]");
        expect(source).toContain("publicUpstreamError");
        expect(source).toContain("上游渠道暂时不可用");
        expect(source).toContain("data-drama-shot-preflight-blockers");
        expect(source).toContain("completeShotReviewAndRefresh");
        expect(source).toContain("去内容审核");
        expect(source).toContain("videoPromptRuns");
        expect(source).toContain("beginVideoPrompt");
        expect(source).toContain("finishVideoPrompt");
    });

    it("groups shot-level AI actions under one Agent creation entry", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8");

        expect(source).toContain("Agent 创作");
        expect(source).toContain("当前镜头 AI 操作");
        expect(source).toContain('key: "complete-review"');
        expect(source).toContain('key: "generate-prompt"');
        expect(source).toContain('key: "open-agent"');
        expect(source).toContain('label: "打开 Agent 对话"');
        expect(source).not.toContain(">交给创作 Agent<");
    });

    it("keeps repeated preflight issues uniquely keyed per asset", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8");

        expect(source).toContain('issue.assetId || "none"');
        expect(source).toContain("-${index}");
    });

    it("uses the locked episode resolution and does not expose a client video-model selector", async () => {
        const [generationSource, settingsSource, scriptSource, frameEditorSource] = await Promise.all([
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-episode-settings.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-script-agent-panel.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-shot-frame-editor.tsx"), "utf8"),
        ]);
        expect(generationSource).toContain("productionPlan?.video.resolution");
        expect(settingsSource).toContain("DRAMA_VIDEO_RESOLUTION_OPTIONS");
        expect(settingsSource).toContain("清晰度：");
        expect(settingsSource).toContain("锁定并保存设置");
        expect(settingsSource).toContain("本集设置已保存");
        expect(settingsSource).toContain("const lockedAt = new Date().toISOString()");
        expect(settingsSource).toContain("setSavedLockAt(persistedPlan.lockedAt)");
        expect(settingsSource).toContain("savedLockAt || productionPlan.lockedAt");
        expect(settingsSource).toContain('normalizeDramaProductionPlan(project.productionBible?.productionPlan, defaultDramaProductionPlan("new-project"))');
        expect(scriptSource).not.toContain("视频模型");
        expect(frameEditorSource).toContain("shotSnapshot:");
        expect(frameEditorSource).toContain("compactShotSnapshot");
        expect(frameEditorSource).not.toContain("saveProjectNow(project.id)");
        expect(frameEditorSource).not.toContain("本次绑定图片");
        expect(frameEditorSource).toContain("保存提示词");
        expect(frameEditorSource).toContain("generationReferences");
        expect(frameEditorSource).toContain("supplierPrompt");
        expect(frameEditorSource).toContain("appendDramaImageReferenceBindings");
        expect(frameEditorSource).toContain("已绑定 ${promptPreview?.references.length || 0} 张图片");
        expect(frameEditorSource).toContain('maxHeight: "calc(100dvh - 24px)"');
        expect(frameEditorSource).toContain("zIndex={1100}");
        expect(frameEditorSource).toContain("zIndex={1200}");
        expect(frameEditorSource).toContain("data-drama-prompt-references");
    });

    it("shows persistent per-frame progress without blocking the whole storyboard area", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-shot-frame-editor.tsx"), "utf8");

        expect(source).not.toContain("data-drama-frame-generation-overlay");
        expect(source).toContain("data-drama-frame-sequence");
        expect(source).toContain("data-drama-frame-row={beat.id}");
        expect(source).toContain("正在生成帧 ${activeFrame.sequenceIndex}/${beats.length}");
        expect(source).toContain('frame?.status === "queued" || frame?.status === "running"');
        expect(source).toContain("一键补齐");
        expect(source).toContain("重新生成全部");
        expect(source).toContain("导演 Agent 生图启动失败");
    });

    it("keeps regenerated frame candidates until the user selects the current frame", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-shot-frame-editor.tsx"), "utf8");

        expect(source).toContain("const { message, modal } = App.useApp();");
        expect(source).toContain("modal.confirm({");
        expect(source).not.toContain("Modal.confirm({");
        expect(source).toContain("候选图片");
        expect(source).toContain("设为当前帧");
        expect(source).toContain("实际提交提示词");
        expect(source).toContain("实际提交给供应商的完整提示词（已留档）");
        expect(source).toContain("readOnly={promptPreview?.readOnly}");
        expect(source).toContain("确认使用当前图并继续");
        expect(source).toContain("candidateStatus");
        expect(source).not.toContain('mediaUrl: undefined, remoteUrl: undefined, inputHash: undefined, continuityStatus: "pending"');
    });

    it("exposes an unmistakable manual acceptance action beside a failed continuity review", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-shot-frame-editor.tsx"), "utf8");

        expect(source).toContain("data-drama-frame-acceptance");
        expect(source).toContain("确认使用当前图并继续");
        expect(source).toContain("确认验收帧 ${beat.sequenceIndex}？");
        expect(source).toContain("不会重新生成图片");
        expect(source).toContain('frame?.continuityStatus === "needs_review" ? "needs_review"');
        expect(source).toContain("acceptDramaStoryboardFrame");
        expect(source).toContain("replaceProject(await acceptDramaStoryboardFrame");
    });

    it("keeps syncing visual tasks while the storyboard stage is mounted", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/page.tsx"), "utf8");

        expect(source).toContain("const loadProject = useDramaStore((state) => state.loadProject)");
        expect(source).toContain('getLatestDramaProductionRun(project.id, episode.id, "visual")');
        expect(source).toContain("hasPendingStoryboard");
        expect(source).toContain("resolveDramaVisualRunSync(currentProject, episode.id, run)");
        expect(source).toContain("replaceProject(decision.project)");
        expect(source).toContain("if (active && shouldContinue) timer = window.setTimeout");
        expect(source).toContain("await loadProject(project.id, true)");
    });
});
