import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("drama script workspace layout", () => {
    it("keeps the scene structure panel fixed while scene jumps scroll the editor body", async () => {
        const [page, workspace, editor, sections, sourceImport, review] = await Promise.all([
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/page.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-script-workspace.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-rich-script-editor.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-project-sections.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-source-import.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-review-panel.tsx"), "utf8"),
        ]);

        expect(page).toContain('!assetsOpen && stage === "script" ? "overflow-hidden" : "overflow-y-auto"');
        expect(page).toContain('stage === "script" ? "h-full max-w-none overflow-hidden');
        expect(workspace).toContain("sticky top-0 hidden h-full min-h-0 min-w-0 self-start overflow-hidden");
        expect(editor).toContain("data-drama-script-editor-scroll");
        expect(editor).toContain("scrollSelectionInsideEditor(editor)");
        expect(editor).toContain('closest<HTMLElement>("[data-drama-script-editor-scroll]")');
        expect(workspace).toContain("selectTextRef.current([shot.sourceText, shot.description, shot.title])");
        expect(editor).not.toContain("offset < 0 ? 1");
        expect(editor).not.toContain(".chain()\n        .focus()\n        .setTextSelection");
        expect(editor).not.toContain(".scrollIntoView()");
        expect(sections).toContain('{ label: "剧情场次", value: episode.storyScenes?.length || 0 }');
        expect(sections).toContain('{ label: "导演镜头", value: episode.shots.length }');
        expect(sourceImport).toContain("粘贴制作包文本");
        expect(sourceImport).toContain("选择制作包文件");
        expect(review).toContain('hasPackageVisualPlan ? () => onStageChange("storyboard") : onDesignVisuals');
        expect(review).toContain('hasPackageVisualPlan ? "进入分镜"');
    });
});
