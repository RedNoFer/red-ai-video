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
        expect(source).toContain("用户/剧本原始提示词（仅记录）");
        expect(source).toContain("视频执行提示词（当前标准）");
        expect(source).toContain("generateDramaVideoPrompt({ project, episode");
        expect(source).toContain("referenceMaterials");
        expect(source).toContain("提示词已优化，请确认后保存");
        expect(source).toContain("提示词优化");
        expect(source).toContain('label: "提示词优化"');
        expect(source).toContain('sm:flex-row sm:items-start sm:justify-between');
        expect(source).toContain('shrink-0 flex-wrap items-center justify-end gap-1.5 sm:ml-3');
        expect(source).toContain("onOptimizePrompt");
        expect(source).toContain("提示词已优化并保存");
        expect(source).not.toContain('label: "Agent 生成提示词"');
        expect(source).toContain("generateDramaVideoPrompt");
        expect(source).not.toContain("已提交供应商的执行快照");
        expect(source).not.toContain('["视频执行提示词（当前标准）", supplierVideoPrompt]');
        expect(source).toContain("上方原始提示词只用于追溯；生成与重试以此执行版为准");
        expect(source).toContain("实际引用资产");
        expect(source).toContain("data-drama-shot-reference-assets");
        expect(source).toContain("引用资产图片");
        expect(source).toContain("data-drama-shot-supplier-prompt");
        expect(source).toContain("data-drama-shot-boundary-frames");
        expect(source).toContain("视频提示词已保存");
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
        const executionPromptStart = source.indexOf("function ShotExecutionDetails");
        const executionPromptEnd = source.indexOf("function ProductionPromptPreview", executionPromptStart);
        const executionPrompt = source.slice(executionPromptStart, executionPromptEnd);
        expect(executionPrompt).toContain('updateDramaShotPromptPatch(project.id, episode.id, shot.id, prompt, undefined, { executionVideoPromptOrigin: "manual" })');
        expect(executionPrompt).toContain("videoPromptDraft.trim() === videoPromptOriginal.trim()");
        expect(executionPrompt).not.toContain("saveProjectNow(project.id)");
        expect(executionPrompt).not.toContain("updateShot(project.id, episode.id, shot.id");
    });

    it("cancels video tasks through their server action instead of a writable status field", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8");

        const cancelStart = source.indexOf("Array.from(videoTaskIds");
        expect(cancelStart).toBeGreaterThanOrEqual(0);
        const cancelBlock = source.slice(cancelStart, source.indexOf("const downloadSubtitles", cancelStart));
        expect(cancelBlock).toContain('JSON.stringify({ action: "cancel" })');
        expect(cancelBlock).not.toContain('JSON.stringify({ status: "cancelled" })');
        expect(source).toContain("productionRun?.steps.filter((step) => step.shotId === shot.id && step.type === \"video\")");
        expect(source).toContain("await loadProject(project.id, true)");
    });

    it("groups shot-level AI actions under one Agent creation entry", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8");

        expect(source).toContain("Agent 创作");
        expect(source).toContain("当前镜头 AI 操作");
        expect(source).toContain('key: "complete-review"');
        expect(source).toContain('key: "optimize-prompt"');
        expect(source).toContain('key: "open-agent"');
        expect(source).toContain('label: "打开 Agent 对话"');
        expect(source).not.toContain(">交给创作 Agent<");
    });

    it("keeps repeated preflight issues uniquely keyed per asset", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8");

        expect(source).toContain('issue.assetId || "none"');
        expect(source).toContain("-${index}");
    });

    it("opens the prompt preview without waiting for the optional preflight", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8");
        const start = source.indexOf("const startProduction =");
        const preview = source.indexOf("showPromptPreview(shotIds", start);

        expect(start).toBeGreaterThanOrEqual(0);
        expect(preview).toBeGreaterThan(start);
        expect(source.slice(start, preview)).not.toContain("preflightDramaGeneration");
        expect(source).toContain("onClick={() => void checkProduction()}");
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
        expect(frameEditorSource).toContain("resolveDramaFrameScene");
        expect(frameEditorSource).toContain("references: plannedFrameReferences(project, episodeId, shot, beat.sequenceIndex, storedFrames)");
        expect(frameEditorSource).toContain("已绑定 ${promptPreview?.references.length || 0} 张图片");
        expect(frameEditorSource).toContain('maxHeight: "calc(100dvh - 24px)"');
        expect(frameEditorSource).toContain("zIndex={1100}");
        expect(frameEditorSource).toContain("zIndex={1200}");
        expect(frameEditorSource).toContain("data-drama-prompt-references");
    });

    it("does not save the full oversized project before confirming production", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8");
        const lockStart = source.indexOf("const lockProduction = async");
        const lockEnd = source.indexOf("const optimizeVideoPrompt", lockStart);
        const lockProduction = source.slice(lockStart, lockEnd);

        expect(lockProduction).not.toContain("saveProjectNow(project.id)");
        expect(lockProduction).toContain('updateDramaShotPromptPatch(project.id, episode.id, shotId, prompts.videoPrompt || "", prompts.imagePrompt)');
        expect(lockProduction).toContain("createDramaProductionRun(project.id, episode.id, undefined, check");
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
        expect(source).toContain("检验图片");
        expect(source).toContain("完成后可手动检验图片");
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
