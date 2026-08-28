import { afterEach, describe, expect, it, vi } from "vitest";

import { createDramaProductionRun, getLatestDramaProductionRun, listDramaProjectSummaries } from "./drama-projects";

describe("drama project api", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("requests a bounded summary page", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { projects: [], total: 24, page: 2, pageSize: 12 }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(listDramaProjectSummaries({ page: 2, pageSize: 12 })).resolves.toMatchObject({ total: 24, page: 2, pageSize: 12 });
        expect(fetchMock).toHaveBeenCalledWith("/api/drama/projects?page=2&pageSize=12", { cache: "no-store" });
    });

    it("requests visual and full production runs through separate scopes", async () => {
        const fetchMock = vi.fn().mockImplementation(async () => Response.json({ code: 0, data: { run: null, preflight: { status: "passed", issues: [] } }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);

        await getLatestDramaProductionRun("project-one", "episode-one", "visual");
        await getLatestDramaProductionRun("project-one", "episode-one", "production");

        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/drama/projects/project-one/production-runs?episodeId=episode-one&scope=visual", "/api/drama/projects/project-one/production-runs?episodeId=episode-one&scope=production"]);
    });

    it("sends the selected frame ids and explicit full-regeneration intent", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { run: { id: "run-one" } }, msg: "OK" }));
        vi.stubGlobal("fetch", fetchMock);

        await createDramaProductionRun("project-one", "episode-one", "visual", undefined, { shotIds: ["shot-one"], frameType: "all_frames", frameIds: ["f2"], regenerateAll: true });

        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ episodeId: "episode-one", scope: "visual", shotIds: ["shot-one"], frameType: "all_frames", frameIds: ["f2"], regenerateAll: true });
    });
});
