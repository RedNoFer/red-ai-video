import { spawn } from "node:child_process";
import path from "node:path";
import { randomBytes } from "node:crypto";

const MIN_TOKEN_LENGTH = 32;

export function generationRuntimeEnvironment({ environment = process.env, allowEphemeralToken = false } = {}) {
    const source = { ...environment };
    const maintenanceToken = source.VOZEB_PRO_MAINTENANCE_TOKEN?.trim() || "";
    const workerToken = source.VOZEB_PRO_WORKER_TOKEN?.trim() || "";
    if (!allowEphemeralToken && (maintenanceToken.length < MIN_TOKEN_LENGTH || workerToken.length < MIN_TOKEN_LENGTH || maintenanceToken === workerToken)) {
        throw new Error("VOZEB_PRO_MAINTENANCE_TOKEN and VOZEB_PRO_WORKER_TOKEN must be distinct and contain at least 32 characters");
    }

    const port = validPort(source.PORT) || 3000;
    const resolvedMaintenanceToken = maintenanceToken.length >= MIN_TOKEN_LENGTH ? maintenanceToken : randomBytes(32).toString("hex");
    let resolvedWorkerToken = workerToken.length >= MIN_TOKEN_LENGTH ? workerToken : randomBytes(32).toString("hex");
    if (resolvedWorkerToken === resolvedMaintenanceToken) resolvedWorkerToken = randomBytes(32).toString("hex");
    return {
        environment: {
            ...source,
            VOZEB_PRO_MAINTENANCE_TOKEN: resolvedMaintenanceToken,
            VOZEB_PRO_WORKER_TOKEN: resolvedWorkerToken,
            VOZEB_PRO_WORKER_API_ORIGIN: resolveGenerationWorkerOrigin({ environment: source, fallbackOrigin: `http://127.0.0.1:${port}` }),
        },
        ephemeralToken: maintenanceToken.length < MIN_TOKEN_LENGTH || workerToken.length < MIN_TOKEN_LENGTH || maintenanceToken === workerToken,
    };
}

export function resolveDevelopmentEnvironment({ webRoot, environment = process.env } = {}) {
    const source = { ...environment };
    if (webRoot) {
        const localDataDir = path.join(webRoot, ".data");
        if (!source.VOZEB_PRO_DATA_DIR?.trim() || source.VOZEB_PRO_DATA_DIR === "/app/web/.data") {
            source.VOZEB_PRO_DATA_DIR = localDataDir;
        }
    }

    if (!source.DATABASE_URL?.trim() && !source.POSTGRES_URL?.trim() && source.VOZEB_PRO_DATABASE_PROVIDER !== "file") {
        const databaseUrl = resolveDevelopmentDatabaseUrl(source);
        if (databaseUrl) source.DATABASE_URL = databaseUrl;
    }
    source.VOZEB_PRO_INTERNAL_ORIGIN = resolveDevelopmentInternalOrigin(source);

    return source;
}

export function resolveDevelopmentDatabaseUrl(environment = process.env) {
    const database = environment.POSTGRES_DB?.trim() || "";
    const username = environment.POSTGRES_USER?.trim() || "";
    const password = environment.POSTGRES_PASSWORD ?? "";
    const host = environment.POSTGRES_HOST?.trim() || "";
    const port = environment.POSTGRES_PORT?.trim() || "";
    if (!database || !username) return "";
    if (!host || !port) throw new Error("Local PostgreSQL startup requires explicit POSTGRES_HOST and POSTGRES_PORT");

    return `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

export function resolveGenerationWorkerOrigin({ environment = process.env, fallbackOrigin = "http://127.0.0.1:3000" } = {}) {
    const raw = environment.VOZEB_PRO_WORKER_API_ORIGIN?.trim() || environment.VOZEB_PRO_INTERNAL_ORIGIN?.trim() || environment.NEXT_PUBLIC_SITE_URL?.trim() || fallbackOrigin;
    const value = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Generation worker origin must use HTTP or HTTPS");
    return url.origin;
}

function resolveDevelopmentInternalOrigin(environment) {
    const port = validPort(environment.PORT);
    const origin = environment.VOZEB_PRO_INTERNAL_ORIGIN?.trim() || "";
    if (!port) return origin;
    if (!origin) return `http://127.0.0.1:${port}`;
    try {
        const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(origin) ? origin : `http://${origin}`);
        return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) ? `http://127.0.0.1:${port}` : origin;
    } catch {
        return origin;
    }
}

export function superviseGenerationRuntime({ app, workerScript, environment }) {
    const definitions = [
        { name: "web", command: app.command, args: app.args, cwd: app.cwd },
        { name: "generation-worker", command: process.execPath, args: [workerScript], cwd: app.cwd },
    ];
    const children = definitions.map((definition) => ({
        ...definition,
        process: spawn(definition.command, definition.args, { cwd: definition.cwd, env: environment, stdio: "inherit" }),
    }));

    return new Promise((resolve) => {
        let closed = 0;
        let stopping = false;
        let requestedExitCode = 0;
        let forceTimer;

        const cleanup = () => {
            process.off("SIGINT", stopForSignal);
            process.off("SIGTERM", stopForSignal);
            if (forceTimer) clearTimeout(forceTimer);
        };
        const stop = (exitCode) => {
            if (stopping) return;
            stopping = true;
            requestedExitCode = exitCode;
            for (const child of children) {
                if (child.process.exitCode === null && child.process.signalCode === null) child.process.kill("SIGTERM");
            }
            forceTimer = setTimeout(() => {
                for (const child of children) {
                    if (child.process.exitCode === null && child.process.signalCode === null) child.process.kill("SIGKILL");
                }
            }, 5_000);
            forceTimer.unref();
        };
        const stopForSignal = () => stop(0);

        process.once("SIGINT", stopForSignal);
        process.once("SIGTERM", stopForSignal);
        for (const child of children) {
            child.process.once("error", (error) => {
                console.error(`${child.name} process failed to start`, error);
                stop(1);
            });
            child.process.once("close", (code) => {
                closed += 1;
                if (!stopping) {
                    console.error(`${child.name} process stopped unexpectedly with code ${code ?? "unknown"}`);
                    stop(code && code > 0 ? code : 1);
                }
                if (closed === children.length) {
                    cleanup();
                    resolve(requestedExitCode);
                }
            });
        }
    });
}

function validPort(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : undefined;
}
