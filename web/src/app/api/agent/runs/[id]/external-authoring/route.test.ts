import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DramaAuthoringWorkOrder } from "@/lib/drama-project-contract";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    executeDramaScriptRun: vi.fn(),
    getAgentRun: vi.fn(),
    updateAgentRunById: vi.fn(),
    getWorkOrder: vi.fn(),
    createWorkOrder: vi.fn(),
    publicAgentRun: vi.fn((run: unknown) => run),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/agent-run-executor", () => ({ executeDramaScriptRun: mocks.executeDramaScriptRun }));
vi.mock("@/lib/server/agent-run-store", () => ({ getAgentRun: mocks.getAgentRun, updateAgentRunById: mocks.updateAgentRunById }));
vi.mock("@/lib/server/drama-authoring-work-order", () => ({
    createDramaAuthoringWorkOrderForRun: mocks.createWorkOrder,
    getDramaAuthoringWorkOrderForRun: mocks.getWorkOrder,
    DramaAuthoringWorkOrderError: class DramaAuthoringWorkOrderError extends Error {},
}));
vi.mock("@/lib/server/agent-run-public", () => ({ publicAgentRun: mocks.publicAgentRun }));
vi.mock("@/lib/server/internal-origin", () => ({ resolveInternalOrigin: vi.fn(() => "http://localhost") }));

import { POST } from "./route";

const workOrder: DramaAuthoringWorkOrder = {
    id: "work-order",
    runId: "run",
    projectId: "project",
    episodeId: "episode",
    provider: "codex-work-order",
    status: "ready",
    createdAt: "2026-09-14T00:00:00.000Z",
    targetNarrativeChapter: 3,
    request: "生成第 3 章制作包",
    authoringInput: { request: "生成第 3 章制作包" },
    sources: [{ alias: "@模板", role: "package-template", type: "text", title: "模板", contentHash: "a".repeat(64), textContent: "模板" }],
    contract: { id: "vozeb-drama-production-package-v1", version: "1.0.0", contentHash: "c".repeat(64) },
    protocol: { packageSpecHash: "d".repeat(64), templateSourceHash: "e".repeat(64), packageRulesHash: "f".repeat(64), rules: "executeDramaScriptRun" },
    directorSkill: { id: "drama-video-director", version: "1.3.2", contentHash: "1".repeat(64) },
    seedanceSkill: { id: "seedance-25-director", version: "1.3.2", contentHash: "2".repeat(64) },
    draftContract: { mode: "package", reply: "string", markdown: "string" },
    strictGateCodes: ["PROVENANCE"],
};

const run = { id: "run", userId: "user", status: "failed", assistantMessageId: "assistant" };
const draft = { mode: "package" as const, reply: "完成", markdown: "# draft" };

describe("external drama authoring handoff", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user" });
        mocks.getWorkOrder.mockResolvedValue({ run, workOrder });
        mocks.updateAgentRunById.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({ ...run, ...patch }));
        mocks.getAgentRun.mockResolvedValue({ ...run, status: "completed" });
    });

    it("rejects a stale Skill hash before invoking the common finalizer", async () => {
        const response = await POST(request({ action: "submit", workOrderId: workOrder.id, draft, manifest: manifest({ directorSkill: { ...workOrder.directorSkill, contentHash: "0".repeat(64) } }) }), context());

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ msg: "Codex 工作单使用了过期或不一致的契约/Skill 哈希" });
        expect(mocks.executeDramaScriptRun).not.toHaveBeenCalled();
        expect(mocks.updateAgentRunById).not.toHaveBeenCalled();
    });

    it("sends a valid Codex draft through executeDramaScriptRun", async () => {
        const response = await POST(request({ action: "submit", workOrderId: workOrder.id, draft, manifest: manifest() }), context());

        expect(response.status).toBe(200);
        expect(mocks.executeDramaScriptRun).toHaveBeenCalledWith(expect.objectContaining({ id: "run" }), "http://localhost", "session=test", expect.any(AbortSignal), { provider: "codex-work-order", draft });
        expect(mocks.updateAgentRunById).toHaveBeenCalledWith("run", expect.objectContaining({ status: "running", dramaAuthoring: expect.objectContaining({ status: "submitted" }) }), expect.any(Object), ["failed"]);
        expect(mocks.updateAgentRunById).toHaveBeenCalledWith("run", expect.objectContaining({ dramaAuthoring: expect.objectContaining({ status: "accepted" }) }), expect.any(Object), ["completed"]);
    });
});

function manifest(overrides: Partial<{ contract: DramaAuthoringWorkOrder["contract"]; directorSkill: DramaAuthoringWorkOrder["directorSkill"]; seedanceSkill: DramaAuthoringWorkOrder["seedanceSkill"] }> = {}) {
    return {
        contract: overrides.contract || workOrder.contract,
        directorSkill: overrides.directorSkill || workOrder.directorSkill,
        seedanceSkill: overrides.seedanceSkill || workOrder.seedanceSkill,
        sources: workOrder.sources.map(({ alias, role, contentHash }) => ({ alias, role, contentHash })),
    };
}

function request(body: unknown) {
    return new Request("http://localhost/api/agent/runs/run/external-authoring", { method: "POST", headers: { "content-type": "application/json", cookie: "session=test" }, body: JSON.stringify(body) });
}

function context() {
    return { params: Promise.resolve({ id: "run" }) };
}
