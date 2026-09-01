import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DramaProductionRun } from "@/lib/drama-project-contract";

const mocks = vi.hoisted(() => ({ files: new Map<string, unknown>() }));
vi.mock("@/lib/server/database", () => ({ ensurePostgresSchema: vi.fn(), getDatabaseProvider: vi.fn(() => "file"), postgresQuery: vi.fn() }));
vi.mock("@/lib/server/data-adapter", () => ({
    readJsonDataFile: vi.fn(async (name: string, fallback: unknown) => structuredClone(mocks.files.has(name) ? mocks.files.get(name) : fallback)),
    writeJsonDataFile: vi.fn(async (name: string, value: unknown) => mocks.files.set(name, structuredClone(value))),
}));

import { createDramaProductionRun, findLatestDramaProductionRun, getDramaProductionRun, updateDramaProductionRun } from "./drama-production-run-store";

describe("drama production run file provider", () => {
    beforeEach(() => mocks.files.clear());

    it("persists runs by owner and restores the latest episode run", async () => {
        const first = run("run-one", "2026-01-01T00:00:00.000Z");
        const second = run("run-two", "2026-01-02T00:00:00.000Z");
        await createDramaProductionRun("user-one", first);
        await createDramaProductionRun("user-one", second);

        expect(await findLatestDramaProductionRun("user-one", "project", "episode")).toMatchObject({ id: "run-two" });
        expect(await getDramaProductionRun("user-two", "project", "run-two")).toBeNull();
        expect(await updateDramaProductionRun("user-one", { ...second, status: "cancelled", updatedAt: "2026-01-03T00:00:00.000Z" })).toMatchObject({ status: "cancelled" });
    });

    it("keeps visual director runs separate from full production runs", async () => {
        await createDramaProductionRun("user-one", run("production", "2026-01-01T00:00:00.000Z"));
        await createDramaProductionRun("user-one", { ...run("visual", "2026-01-02T00:00:00.000Z"), scope: "visual" });

        expect(await findLatestDramaProductionRun("user-one", "project", "episode", "production")).toMatchObject({ id: "production" });
        expect(await findLatestDramaProductionRun("user-one", "project", "episode", "visual")).toMatchObject({ id: "visual", scope: "visual" });
    });
});

function run(id: string, updatedAt: string): DramaProductionRun {
    return { id, projectId: "project", episodeId: "episode", planRevision: id, status: "ready", mode: "strict", parameterSnapshot: { imageModel: "image", videoModel: "video", ratio: "9:16" }, steps: [], createdAt: updatedAt, updatedAt };
}
