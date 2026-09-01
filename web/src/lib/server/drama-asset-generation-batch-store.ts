import type { DramaAssetGenerationBatch } from "@/lib/drama-project-contract";
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/data-adapter";
import { ensurePostgresSchema, getDatabaseProvider, postgresQuery } from "@/lib/server/database";

type BatchRecord = DramaAssetGenerationBatch & { userId: string };
type BatchDatabase = { version: 1; items: BatchRecord[] };
const FILE_NAME = "drama-asset-generation-batches.json";

export async function createDramaAssetGenerationBatch(userId: string, batch: DramaAssetGenerationBatch) {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        await postgresQuery("INSERT INTO drama_asset_generation_batches (id, project_id, user_id, status, batch_json, created_at, updated_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)", [batch.id, batch.projectId, userId, batch.status, JSON.stringify(batch), new Date(batch.createdAt), new Date(batch.updatedAt)]);
        return batch;
    }
    await mutate((db) => ({ version: 1, items: [{ ...batch, userId }, ...db.items] }));
    return batch;
}

export async function getDramaAssetGenerationBatch(userId: string, projectId: string, batchId: string) {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery<{ batch_json: DramaAssetGenerationBatch }>("SELECT batch_json FROM drama_asset_generation_batches WHERE id = $1 AND project_id = $2 AND user_id = $3", [batchId, projectId, userId]);
        return result.rows[0]?.batch_json || null;
    }
    const item = (await readDatabase()).items.find((batch) => batch.id === batchId && batch.projectId === projectId && batch.userId === userId);
    if (!item) return null;
    const { userId: _userId, ...batch } = item;
    return batch;
}

export async function listDramaAssetGenerationBatches(userId: string, projectId: string, limit = 10) {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery<{ batch_json: DramaAssetGenerationBatch }>("SELECT batch_json FROM drama_asset_generation_batches WHERE project_id = $1 AND user_id = $2 ORDER BY updated_at DESC LIMIT $3", [projectId, userId, safeLimit]);
        return result.rows.map((row) => row.batch_json);
    }
    return (await readDatabase()).items.filter((batch) => batch.projectId === projectId && batch.userId === userId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, safeLimit).map(({ userId: _userId, ...batch }) => batch);
}

export async function updateDramaAssetGenerationBatch(userId: string, batch: DramaAssetGenerationBatch) {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery("UPDATE drama_asset_generation_batches SET status = $4, batch_json = $5::jsonb, updated_at = $6 WHERE id = $1 AND project_id = $2 AND user_id = $3 RETURNING id", [batch.id, batch.projectId, userId, batch.status, JSON.stringify(batch), new Date(batch.updatedAt)]);
        return result.rows[0] ? batch : null;
    }
    let found = false;
    await mutate((db) => ({ version: 1, items: db.items.map((item) => item.id === batch.id && item.projectId === batch.projectId && item.userId === userId ? (found = true, { ...batch, userId }) : item) }));
    return found ? batch : null;
}

function readDatabase() {
    return readJsonDataFile<BatchDatabase>(FILE_NAME, { version: 1, items: [] });
}

let queue = Promise.resolve();
function mutate(mutator: (db: BatchDatabase) => BatchDatabase) {
    const operation = queue.then(async () => {
        const next = mutator(await readDatabase());
        await writeJsonDataFile(FILE_NAME, next);
        return next;
    });
    queue = operation.then(() => undefined, () => undefined);
    return operation;
}
