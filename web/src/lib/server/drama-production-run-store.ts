import type { DramaProductionRun } from "@/lib/drama-project-contract";
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/data-adapter";
import { ensurePostgresSchema, getDatabaseProvider, postgresQuery } from "@/lib/server/database";

type RunRecord = DramaProductionRun & { userId: string };
type RunDatabase = { version: 1; items: RunRecord[] };

const FILE_NAME = "drama-production-runs.json";

export async function createDramaProductionRun(userId: string, run: DramaProductionRun) {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        await postgresQuery("INSERT INTO drama_production_runs (id, project_id, episode_id, user_id, status, run_json, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)", [
            run.id,
            run.projectId,
            run.episodeId,
            userId,
            run.status,
            JSON.stringify(run),
            new Date(run.createdAt),
            new Date(run.updatedAt),
        ]);
        return run;
    }
    return mutateDatabase((database) => ({ database: { ...database, items: [{ ...run, userId }, ...database.items] }, result: run }));
}

export async function getDramaProductionRun(userId: string, projectId: string, runId: string) {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery<{ run_json: DramaProductionRun }>("SELECT run_json FROM drama_production_runs WHERE id = $1 AND user_id = $2 AND project_id = $3", [runId, userId, projectId]);
        return result.rows[0]?.run_json || null;
    }
    const item = (await readDatabase()).items.find((run) => run.id === runId && run.userId === userId && run.projectId === projectId);
    if (!item) return null;
    const { userId: _userId, ...run } = item;
    return run;
}

export async function findLatestDramaProductionRun(userId: string, projectId: string, episodeId: string, scope: "visual" | "production" = "production") {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery<{ run_json: DramaProductionRun }>("SELECT run_json FROM drama_production_runs WHERE user_id = $1 AND project_id = $2 AND episode_id = $3 AND (($4 = 'visual' AND run_json->>'scope' = 'visual') OR ($4 = 'production' AND COALESCE(run_json->>'scope', '') <> 'visual')) ORDER BY updated_at DESC LIMIT 1", [userId, projectId, episodeId, scope]);
        return result.rows[0]?.run_json || null;
    }
    const item = (await readDatabase()).items.filter((run) => run.userId === userId && run.projectId === projectId && run.episodeId === episodeId && (scope === "visual" ? run.scope === "visual" : run.scope !== "visual")).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    if (!item) return null;
    const { userId: _userId, ...run } = item;
    return run;
}

export async function updateDramaProductionRun(userId: string, run: DramaProductionRun) {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery("UPDATE drama_production_runs SET status = $4, run_json = $5::jsonb, updated_at = $6 WHERE id = $1 AND user_id = $2 AND project_id = $3 RETURNING id", [
            run.id,
            userId,
            run.projectId,
            run.status,
            JSON.stringify(run),
            new Date(run.updatedAt),
        ]);
        return result.rows[0] ? run : null;
    }
    let found = false;
    await mutateDatabase((database) => ({
        database: {
            ...database,
            items: database.items.map((item) => {
                if (item.id !== run.id || item.userId !== userId || item.projectId !== run.projectId) return item;
                found = true;
                return { ...run, userId };
            }),
        },
        result: undefined,
    }));
    return found ? run : null;
}

function readDatabase() {
    return readJsonDataFile<RunDatabase>(FILE_NAME, { version: 1, items: [] });
}
function writeDatabase(database: RunDatabase) {
    return writeJsonDataFile(FILE_NAME, database);
}
let mutationQueue = Promise.resolve();
function mutateDatabase<T>(mutator: (database: RunDatabase) => { database: RunDatabase; result: T }) {
    const operation = mutationQueue.then(async () => {
        const mutation = mutator(await readDatabase());
        await writeDatabase(mutation.database);
        return mutation.result;
    });
    mutationQueue = operation.then(
        () => undefined,
        () => undefined,
    );
    return operation;
}
