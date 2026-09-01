import { describe, expect, it } from "vitest";

import { generationRuntimeEnvironment, resolveDevelopmentEnvironment, resolveDevelopmentDatabaseUrl, resolveGenerationWorkerOrigin } from "./generation-runtime.mjs";

describe("generation runtime environment", () => {
    it("uses distinct configured maintenance and worker tokens", () => {
        const maintenanceToken = "a".repeat(32);
        const workerToken = "b".repeat(32);
        const result = generationRuntimeEnvironment({ environment: { VOZEB_PRO_MAINTENANCE_TOKEN: maintenanceToken, VOZEB_PRO_WORKER_TOKEN: workerToken, PORT: "3100" } });

        expect(result).toMatchObject({ ephemeralToken: false, environment: { VOZEB_PRO_MAINTENANCE_TOKEN: maintenanceToken, VOZEB_PRO_WORKER_TOKEN: workerToken, VOZEB_PRO_WORKER_API_ORIGIN: "http://127.0.0.1:3100" } });
    });

    it("generates a process-local token only for development", () => {
        const result = generationRuntimeEnvironment({ environment: {}, allowEphemeralToken: true });

        expect(result.ephemeralToken).toBe(true);
        expect(result.environment.VOZEB_PRO_MAINTENANCE_TOKEN).toHaveLength(64);
        expect(result.environment.VOZEB_PRO_WORKER_TOKEN).toHaveLength(64);
        expect(result.environment.VOZEB_PRO_WORKER_TOKEN).not.toBe(result.environment.VOZEB_PRO_MAINTENANCE_TOKEN);
    });

    it("fails production startup before the app can run without a valid token", () => {
        expect(() => generationRuntimeEnvironment({ environment: { VOZEB_PRO_MAINTENANCE_TOKEN: "short", VOZEB_PRO_WORKER_TOKEN: "b".repeat(32) } })).toThrow("distinct and contain at least 32 characters");
        expect(() => generationRuntimeEnvironment({ environment: { VOZEB_PRO_MAINTENANCE_TOKEN: "a".repeat(32), VOZEB_PRO_WORKER_TOKEN: "a".repeat(32) } })).toThrow("distinct and contain at least 32 characters");
    });

    it("normalizes a Render private hostport to an HTTP origin", () => {
        expect(resolveGenerationWorkerOrigin({ environment: { VOZEB_PRO_WORKER_API_ORIGIN: "vozeb-pro:3000" } })).toBe("http://vozeb-pro:3000");
    });

    it("derives a local PostgreSQL DATABASE_URL from root env fields", () => {
        expect(resolveDevelopmentDatabaseUrl({ POSTGRES_DB: "vozeb_pro", POSTGRES_USER: "vozeb_pro", POSTGRES_PASSWORD: "pa ss", POSTGRES_HOST: "127.0.0.1", POSTGRES_PORT: "55432" })).toBe("postgres://vozeb_pro:pa%20ss@127.0.0.1:55432/vozeb_pro");
    });

    it("rejects ambiguous local PostgreSQL startup fields", () => {
        expect(() => resolveDevelopmentDatabaseUrl({ POSTGRES_DB: "vozeb_pro", POSTGRES_USER: "vozeb_pro", POSTGRES_PASSWORD: "secret" })).toThrow("explicit POSTGRES_HOST and POSTGRES_PORT");
    });

    it("keeps explicit local overrides while filling development defaults", () => {
        const result = resolveDevelopmentEnvironment({
            webRoot: "/repo/web",
            environment: {
                PORT: "3100",
                POSTGRES_DB: "root_db",
                POSTGRES_USER: "root_user",
                POSTGRES_PASSWORD: "root_password",
                POSTGRES_HOST: "127.0.0.1",
                POSTGRES_PORT: "55432",
                VOZEB_PRO_DATA_DIR: "/app/web/.data",
                VOZEB_PRO_ENCRYPTION_KEY: "root-key",
                VOZEB_PRO_INTERNAL_ORIGIN: "http://127.0.0.1:3010",
            },
        });

        expect(result).toMatchObject({
            DATABASE_URL: "postgres://root_user:root_password@127.0.0.1:55432/root_db",
            VOZEB_PRO_DATA_DIR: "/repo/web/.data",
            VOZEB_PRO_ENCRYPTION_KEY: "root-key",
            VOZEB_PRO_INTERNAL_ORIGIN: "http://127.0.0.1:3100",
        });
    });

    it("keeps a non-local internal origin for deployments", () => {
        expect(resolveDevelopmentEnvironment({ environment: { PORT: "3100", VOZEB_PRO_INTERNAL_ORIGIN: "https://worker.internal.example" } }).VOZEB_PRO_INTERNAL_ORIGIN).toBe("https://worker.internal.example");
    });
});
