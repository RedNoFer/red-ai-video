import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAgentRun: vi.fn() }));

vi.mock("@/lib/server/agent-run-store", () => ({ getAgentRun: mocks.getAgentRun }));

import { createDramaAuthoringWorkOrderForRun } from "./drama-authoring-work-order";

describe("drama Codex work-order eligibility", () => {
    beforeEach(() => vi.clearAllMocks());

    it("does not create an external work order for a non-timeout failure", async () => {
        mocks.getAgentRun.mockResolvedValue({ id: "run", userId: "user", workflow: "drama-script", projectId: "project", episodeId: "episode", status: "failed", dramaFailureKind: "quality" });

        await expect(createDramaAuthoringWorkOrderForRun("user", "run")).rejects.toThrow("明确超时");
    });

    it("returns an existing ready work order without rebuilding or duplicating it", async () => {
        const workOrder = { id: "work-order", status: "ready" };
        mocks.getAgentRun.mockResolvedValue({ id: "run", userId: "user", workflow: "drama-script", projectId: "project", episodeId: "episode", status: "failed", dramaFailureKind: "timeout", dramaAuthoring: workOrder });

        await expect(createDramaAuthoringWorkOrderForRun("user", "run")).resolves.toEqual({ run: expect.objectContaining({ id: "run" }), workOrder });
    });
});
