import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { imageResultsToReferences } from "./drama-assets-panel";
import { filterAndSortDramaAssets, type DramaAssetLibraryRow } from "./drama-asset-library-utils";
import { dramaAssetReferences, mergeGeneratedReferenceReviews } from "./drama-asset-reference-utils";

describe("drama asset image results", () => {
    it("assigns unique ids when historical references contain duplicates", () => {
        const references = dramaAssetReferences({
            id: "character-one",
            name: "角色",
            description: "",
            references: [
                { id: "reference-task-0", url: "/first.png", source: "generated", label: "第一张", createdAt: "2026-01-01T00:00:00.000Z" },
                { id: "reference-task-0", url: "/second.png", source: "generated", label: "第二张", createdAt: "2026-01-01T00:00:01.000Z" },
            ],
        });

        expect(references.map((reference) => reference.id)).toEqual(["reference-task-0", "reference-task-0-2"]);
    });

    it("keeps every generated image as a candidate reference", () => {
        const references = imageResultsToReferences({
            dataUrl: "data:image/png;base64,first",
            serverUrl: "/api/generation-log-assets/first.png",
            results: [
                { dataUrl: "data:image/png;base64,first", serverUrl: "/api/generation-log-assets/first.png", remoteUrl: "https://provider.example/first.png", width: 1024, height: 1024 },
                { serverUrl: "/api/generation-log-assets/second.png", width: 1024, height: 1024 },
            ],
        });

        expect(references).toHaveLength(2);
        expect(references.map((item) => item.url)).toEqual(["/api/generation-log-assets/first.png", "/api/generation-log-assets/second.png"]);
        expect(references[0]?.remoteUrl).toBe("https://provider.example/first.png");
        expect(references.map((item) => item.label)).toEqual(["AI 候选图 1", "AI 候选图 2"]);
    });

    it("keeps a server-promoted first reference primary when review metadata arrives later", () => {
        const merged = mergeGeneratedReferenceReviews(
            [
                {
                    id: "reference-task-first-0",
                    url: "/api/generation-log-assets/first.png",
                    source: "generated",
                    label: "AI 候选图",
                    status: "approved",
                    reviewStatus: "pending",
                    approvedAt: "2026-09-05T00:00:00.000Z",
                    version: 1,
                    createdAt: "2026-09-05T00:00:00.000Z",
                },
            ],
            [{ id: "reference-task-first-0", url: "/api/generation-log-assets/first.png", source: "generated", label: "AI 候选图", status: "candidate", reviewStatus: "passed", createdAt: "2026-09-05T00:00:01.000Z" }],
        );

        expect(merged[0]).toMatchObject({ id: "reference-task-first-0", status: "approved", reviewStatus: "passed", approvedAt: "2026-09-05T00:00:00.000Z", version: 1 });
    });

    it("prefers the owned server media URL over a temporary provider URL", () => {
        const references = imageResultsToReferences({
            dataUrl: "data:image/png;base64,first",
            remoteUrl: "https://provider.example/temp-image.png?expires=1",
            serverUrl: "/api/generation-log-assets/permanent/image.png",
        });

        expect(references[0]?.url).toBe("/api/generation-log-assets/permanent/image.png");
        expect(references[0]?.remoteUrl).toBe("https://provider.example/temp-image.png?expires=1");
    });

    it("does not save an upstream-only URL as a project asset", () => {
        const references = imageResultsToReferences({ remoteUrl: "https://provider.example/temp-image.png?expires=1" });

        expect(references).toEqual([]);
    });

    it("uses an asset card library and moves create/edit fields into a responsive drawer", async () => {
        const [panel, editor] = await Promise.all([readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-assets-panel.tsx"), "utf8"), readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-asset-editor-drawer.tsx"), "utf8")]);

        expect(panel).toContain("data-drama-asset-grid");
        expect(panel).toContain("data-drama-assets-toolbar");
        expect(panel).toContain("待补基准");
        expect(panel).toContain("当前集涉及");
        expect(panel).toContain("下载项目基准图");
        expect(panel).toContain("downloadDramaAssetBundle");
        expect(panel).toContain("未被引用");
        expect(panel).toContain("data-drama-source-assets");
        expect(panel).toContain("<DramaAssetEditorDrawer");
        expect(panel).toContain("<DramaAssetGenerationBatchPanel");
        expect(panel).toContain("const { message, modal } = App.useApp();");
        expect(panel).toContain("modal.confirm({");
        expect(panel).not.toContain("Modal.confirm({");
        expect(panel).not.toContain("generateVoice: true");
        const batchPanel = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-asset-generation-batch-panel.tsx"), "utf8");
        expect(batchPanel).toContain("批量生成素材");
        expect(batchPanel).toContain("选择全部缺基准");
        expect(batchPanel).toContain("data-drama-asset-generation-progress");
        expect(batchPanel).toContain("重试失败项");
        expect(batchPanel).toContain('placement="bottomRight"');
        expect(batchPanel).toContain("autoAdjustOverflow");
        expect(batchPanel).toContain("calc(100vw - 24px)");
        expect(batchPanel).not.toContain("展开详情");
        expect(batchPanel).not.toContain("收起详情");
        expect(editor).toContain("<Modal");
        expect(editor).toContain("const { message, modal } = App.useApp();");
        expect(editor).toContain("modal.confirm({");
        expect(editor).not.toContain("Modal.confirm({");
        expect(editor).not.toContain("generateVoice: true");
        expect(editor).toContain("width={640}");
        expect(editor).toContain("if (!asset)");
        expect(editor).toContain("size={620}");
        expect(editor).toContain('maxWidth: "100vw"');
        expect(editor).toContain("从来源选择");
        expect(editor).toContain("上传候选");
        expect(editor).toContain("生成候选");
        expect(editor).toContain("提示词优化");
        expect(editor).toContain("optimizedAssetPrompt");
        expect(editor).toContain("生成候选将使用");
        expect(editor).not.toContain("Voice Design");
        expect(editor).not.toContain("声音设计提示词");
        expect(editor).toContain('mode: "clone"');
        expect(editor).toContain("上传 Clone 音频样本");
        expect(editor).toContain("dataUrl: storedReferenceUrl");
        expect(editor).toContain("const existingReferenceUrl");
        expect(editor).toContain("referenceOverride || (activeProposal ? primary : undefined)");
        expect(editor).toContain("data-drama-primary-preview");
        expect(editor).toContain("aspectRatio: primary?.width && primary?.height");
        expect(editor).toContain("实际供应商提示词");
        expect(editor).toContain("mergeGeneratedReferenceReviews");
        expect(editor).toContain("await loadProject(project.id, true)");
        expect(editor).toContain("await saveProjectNow(project.id)");
    });

    it("filters derived readiness and usage states without changing project data", () => {
        const rows: DramaAssetLibraryRow[] = [
            {
                asset: {
                    id: "ready",
                    name: "已引用角色",
                    description: "主角",
                    primaryReferenceId: "ready-ref",
                    references: [{ id: "ready-ref", url: "/ready.png", source: "generated", label: "基准", status: "approved", createdAt: "2026-01-01T00:00:00.000Z" }],
                },
                referenceCount: 2,
                usageCount: 4,
                currentEpisodeUsageCount: 2,
                incomplete: false,
            },
            { asset: { id: "missing", name: "待补角色", description: "" }, referenceCount: 0, usageCount: 0, currentEpisodeUsageCount: 0, incomplete: true },
            {
                asset: {
                    id: "unused",
                    name: "备用角色",
                    description: "配角",
                    primaryReferenceId: "unused-ref",
                    references: [{ id: "unused-ref", url: "/unused.png", source: "generated", label: "基准", status: "approved", createdAt: "2026-01-01T00:00:00.000Z" }],
                },
                referenceCount: 1,
                usageCount: 0,
                currentEpisodeUsageCount: 0,
                incomplete: false,
            },
        ];

        expect(filterAndSortDramaAssets(rows, "current-episode", "default", "").map((row) => row.asset.id)).toEqual(["ready"]);
        expect(filterAndSortDramaAssets(rows, "missing-reference", "default", "").map((row) => row.asset.id)).toEqual(["missing"]);
        expect(filterAndSortDramaAssets(rows, "used", "default", "").map((row) => row.asset.id)).toEqual(["ready"]);
        expect(filterAndSortDramaAssets(rows, "unused", "attention", "").map((row) => row.asset.id)).toEqual(["missing", "unused"]);
    });
});
