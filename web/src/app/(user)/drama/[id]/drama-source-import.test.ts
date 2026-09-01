import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("drama source import workspace", () => {
    it("keeps large episode previews bounded and paginated without changing the import pipeline", async () => {
        const [source, template] = await Promise.all([
            readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-source-import.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "public/drama-production-package-v1-template.md"), "utf8"),
        ]);

        expect(source).toContain("splitDramaSource(await file.text())");
        expect(source).toContain('createVersion(project, "整本导入前")');
        expect(source).toContain("importEpisodes(project.id, drafts)");
        expect(source).toContain("IMPORT_PAGE_SIZE = 20");
        expect(source).toContain("data-drama-import-preview");
        expect(source).toContain("<Pagination");
        expect(source).toContain("overflow-y-auto");
        expect(source).toContain("max-h-[min(68vh,640px)]");
        expect(source).toContain('PRODUCTION_PACKAGE_TEMPLATE_URL = "/drama-production-package-v1-template.md"');
        expect(source).toContain('anchor.download = "drama-production-package-v1-template.md"');
        expect(source).toContain("下载制作包模板");
        expect(source).toContain('footer={(_, { OkBtn, CancelBtn }) =>');
        expect(template).toContain("vozeb-drama-production-package-v1");
        expect(template).toContain("## 十三、QC 报告");
        expect(template).toContain("| 镜号 | 时间 | 阶段 | 景别 | 运镜 | 焦段 | 灯光 | 色彩 | 转场 | 动作描述 | end_state |");
    });
});
