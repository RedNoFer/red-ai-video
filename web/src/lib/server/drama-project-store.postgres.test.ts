import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { DramaProject } from "@/lib/drama-project-contract";
import { initializePostgresSchema, postgresQuery } from "@/lib/server/database";
import { createDramaProject, getDramaProject, updateDramaProjectAssetMutation, updateDramaProjectRatioMutation, updateDramaProjectShotMutation } from "./drama-project-store";

const postgresDescribe = process.env.VOZEB_PRO_RUN_POSTGRES_INTEGRATION === "1" ? describe : describe.skip;

postgresDescribe("drama project PostgreSQL mutation round-trip", () => {
    beforeAll(() => initializePostgresSchema());

    it("uses the exact persisted JSON version across consecutive shot and asset saves with the real trigger", async () => {
        const userId = `drama-regression-${randomUUID()}`;
        const now = new Date().toISOString();
        const project = {
            id: `drama-${randomUUID()}`,
            title: "版本回归",
            status: "active",
            createdAt: now,
            updatedAt: now,
            characters: [{ id: "character-one", name: "主角", description: "旧设定" }],
            ratio: "9:16",
            productionBible: { ratio: "9:16", productionPlan: { video: { ratio: "9:16" } } },
            episodes: [{ id: "episode-one", shots: [{ id: "shot-one", title: "旧镜头" }] }],
        } as DramaProject;
        await postgresQuery("INSERT INTO users (id, username, display_name, password_hash) VALUES ($1, $1, '版本回归', 'test-only')", [userId]);
        try {
            await createDramaProject(userId, project);
            const shot = await updateDramaProjectShotMutation(userId, { projectId: project.id, episodeId: "episode-one", shotId: "shot-one", shot: { ...project.episodes[0].shots[0], title: "新镜头" }, expectedUpdatedAt: project.updatedAt });
            expect(shot.updatedAt).toBe((await getDramaProject(project.id, userId))?.updatedAt);
            const asset = await updateDramaProjectAssetMutation(userId, { projectId: project.id, assetKind: "characters", assetId: "character-one", asset: { ...project.characters[0], description: "新设定" }, expectedUpdatedAt: shot.updatedAt });
            expect(asset.updatedAt).toBe((await getDramaProject(project.id, userId))?.updatedAt);
            const ratio = await updateDramaProjectRatioMutation(userId, { projectId: project.id, ratio: "16:9", expectedUpdatedAt: asset.updatedAt });
            const persisted = await getDramaProject(project.id, userId);
            expect(ratio.updatedAt).toBe(persisted?.updatedAt);
            expect(persisted).toMatchObject({ ratio: "16:9", productionBible: { ratio: "16:9", productionPlan: { video: { ratio: "16:9" } } } });
            await expect(updateDramaProjectRatioMutation(userId, { projectId: project.id, ratio: "9:16", expectedUpdatedAt: asset.updatedAt })).rejects.toMatchObject({ status: 409 });
            await expect(updateDramaProjectAssetMutation(userId, { projectId: project.id, assetKind: "characters", assetId: "character-one", asset: project.characters[0], expectedUpdatedAt: now })).rejects.toMatchObject({ status: 409 });
            expect((await getDramaProject(project.id, userId))?.characters[0].description).toBe("新设定");
        } finally {
            await postgresQuery("DELETE FROM users WHERE id = $1", [userId]);
        }
    });
});
