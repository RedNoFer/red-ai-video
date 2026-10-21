import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Drama batch video download", () => {
    it("exposes a batch download entry in the delivery tool group", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-generation-panel.tsx"), "utf8");

        expect(source).toContain("批量下载视频");
        expect(source).toContain("setVideoDownloadOpen(true)");
        expect(source).toContain("disabled={!downloadableVideoCount}");
        expect(source).toContain("<DramaVideoDownloadModal open={videoDownloadOpen} projectId={project.id} onClose={() => setVideoDownloadOpen(false)} />");
    });

    it("groups every produced video by episode and checks them all by default", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/(user)/drama/[id]/drama-video-download-modal.tsx"), "utf8");

        expect(source).toContain("listDramaProjectVideos(projectId)");
        expect(source).toContain("setSelected(dramaVideoExportKeys(data))");
        expect(source).toContain("data-drama-video-download-group");
        expect(source).toContain("toggleMany(episodeKeys, event.target.checked)");
        expect(source).toContain("saveAs(result.blob, result.fileName)");
        expect(source).toContain("exportDramaVideos(projectId, items)");
    });

    it("only exports videos that belong to the project", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/api/drama/projects/[id]/export-videos/route.ts"), "utf8");

        expect(source).toContain("resolveDramaVideoExportEntries(payload, items)");
        expect(source).toContain("getDramaProjectForUser(user.id");
        expect(source).not.toContain("items[0].url");
    });
});
