import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DramaAuthoringWorkOrder } from "@/lib/drama-project-contract";
import { DRAMA_PACKAGE_SECTIONS } from "@/lib/server/drama-production-package-contract";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    updateAgentRunById: vi.fn(),
    getWorkOrder: vi.fn(),
    createWorkOrder: vi.fn(),
    getDramaProject: vi.fn(),
    previewDramaProductionPackage: vi.fn(),
    publicAgentRun: vi.fn((run: unknown) => run),
    executeDramaScriptRun: vi.fn(),
    validateDramaAuthoringQuality: vi.fn(),
    serializeDramaProductionPackageMarkdown: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/agent-run-store", () => ({ updateAgentRunById: mocks.updateAgentRunById }));
vi.mock("@/lib/server/drama-authoring-work-order", () => ({
    createDramaAuthoringWorkOrderForRun: mocks.createWorkOrder,
    getDramaAuthoringWorkOrderForRun: mocks.getWorkOrder,
    DramaAuthoringWorkOrderError: class DramaAuthoringWorkOrderError extends Error {},
}));
vi.mock("@/lib/server/drama-project-store", () => ({ getDramaProject: mocks.getDramaProject }));
vi.mock("@/lib/server/drama-production-package", () => ({
    previewDramaProductionPackage: mocks.previewDramaProductionPackage,
    DramaProductionPackageError: class DramaProductionPackageError extends Error {},
}));
vi.mock("@/lib/server/agent-run-public", () => ({ publicAgentRun: mocks.publicAgentRun }));

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
    protocol: { packageSpecHash: "d".repeat(64), templateSourceHash: "e".repeat(64), packageRulesHash: "f".repeat(64), rules: "codex-standalone" },
    directorSkill: { id: "drama-video-director", version: "1.3.2", contentHash: "1".repeat(64) },
    seedanceSkill: { id: "seedance-25-director", version: "1.3.2", contentHash: "2".repeat(64) },
    draftContract: { mode: "package-markdown", reply: "string", markdown: "complete-13-chapter-markdown-with-embedded-json" },
    strictGateCodes: ["VIDEO_PROMPT_SEMANTIC_QUALITY"],
};

const run = { id: "run", userId: "user", status: "failed", assistantMessageId: "assistant" };
const preview = {
    package: {
        authoring: {
            source: "codex-standalone",
            authoringMode: "codex-standalone",
            canonicalSource: "markdown-with-embedded-json",
            qualityGateStatus: "passed",
            generatedAt: "2026-09-14T00:00:00.000Z",
            materials: [],
        },
    },
    sourceHash: "source-hash",
    format: "markdown",
    warnings: [],
};

describe("external standalone drama authoring handoff", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user" });
        mocks.getWorkOrder.mockResolvedValue({ run, workOrder });
        mocks.getDramaProject.mockResolvedValue({ id: "project" });
        mocks.previewDramaProductionPackage.mockReturnValue(preview);
        mocks.updateAgentRunById.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({ ...run, ...patch }));
    });

    it("rejects a stale Skill hash without importing or invoking any authoring engine", async () => {
        const response = await POST(
            request({ action: "submit", workOrderId: workOrder.id, draft: { mode: "package-markdown", reply: "完成", markdown: validMarkdown() }, manifest: manifest({ directorSkill: { ...workOrder.directorSkill, contentHash: "0".repeat(64) } }) }),
            context(),
        );

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ msg: "Codex 工作单使用了过期或不一致的契约/Skill 哈希" });
        expect(mocks.previewDramaProductionPackage).not.toHaveBeenCalled();
        expect(mocks.executeDramaScriptRun).not.toHaveBeenCalled();
        expect(mocks.validateDramaAuthoringQuality).not.toHaveBeenCalled();
        expect(mocks.serializeDramaProductionPackageMarkdown).not.toHaveBeenCalled();
    });

    it("accepts completed Markdown, preserves it byte-for-byte, and skips project authoring gates", async () => {
        const markdown = `\n${validMarkdown()}\n`;
        const response = await POST(request({ action: "submit", workOrderId: workOrder.id, draft: { mode: "package-markdown", reply: "完成", markdown }, manifest: manifest() }), context());

        expect(response.status).toBe(200);
        expect(mocks.previewDramaProductionPackage).toHaveBeenCalledWith(markdown, "codex-standalone-production-package.md", { id: "project" }, { allowImportWarnings: false, preserveAuthoredVideoPrompt: true });
        expect(mocks.updateAgentRunById).toHaveBeenCalledWith("run", expect.objectContaining({ status: "running", dramaAuthoring: expect.objectContaining({ status: "submitted" }) }), expect.any(Object), ["failed"]);
        expect(mocks.updateAgentRunById).toHaveBeenCalledWith("run", expect.objectContaining({ status: "completed", dramaScriptPackage: { markdown, preview } }), expect.any(Object), ["running"]);
        expect(mocks.executeDramaScriptRun).not.toHaveBeenCalled();
        expect(mocks.validateDramaAuthoringQuality).not.toHaveBeenCalled();
        expect(mocks.serializeDramaProductionPackageMarkdown).not.toHaveBeenCalled();
    });

    it("rejects Markdown without the unique embedded package or a fixed chapter", async () => {
        const response = await POST(request({ action: "submit", workOrderId: workOrder.id, draft: { mode: "package-markdown", reply: "完成", markdown: "## 十三、QC 报告\n没有规范对象" }, manifest: manifest() }), context());

        expect(response.status).toBe(422);
        expect(mocks.previewDramaProductionPackage).not.toHaveBeenCalled();
        expect(mocks.updateAgentRunById).not.toHaveBeenCalled();
    });

    it("rejects a package that claims blocked QC without running another repair", async () => {
        mocks.previewDramaProductionPackage.mockReturnValueOnce({
            ...preview,
            package: { authoring: { ...preview.package.authoring, qualityGateStatus: "blocked" } },
        });
        const response = await POST(request({ action: "submit", workOrderId: workOrder.id, draft: { mode: "package-markdown", reply: "失败", markdown: validMarkdown() }, manifest: manifest() }), context());

        expect(response.status).toBe(422);
        expect((await response.json()).msg).toContain("qualityGateStatus=passed");
        expect(mocks.updateAgentRunById).not.toHaveBeenCalled();
        expect(mocks.executeDramaScriptRun).not.toHaveBeenCalled();
    });
});

function validMarkdown() {
    return ["# 独立 Codex 制作包", "", "```drama-production-package", "{}", "```", ...DRAMA_PACKAGE_SECTIONS.map((section) => `## ${section}\n\n已由 Codex 填写。`)].join("\n");
}

function manifest(overrides: Partial<{ contract: DramaAuthoringWorkOrder["contract"]; directorSkill: DramaAuthoringWorkOrder["directorSkill"]; seedanceSkill: DramaAuthoringWorkOrder["seedanceSkill"] }> = {}) {
    return {
        contract: overrides.contract || workOrder.contract,
        directorSkill: overrides.directorSkill || workOrder.directorSkill,
        seedanceSkill: overrides.seedanceSkill || workOrder.seedanceSkill,
        sources: workOrder.sources.map(({ alias, role, contentHash }) => ({ alias, role, contentHash: contentHash || "" })),
    };
}

function request(body: unknown) {
    return new Request("http://localhost/api/agent/runs/run/external-authoring", { method: "POST", headers: { "content-type": "application/json", cookie: "session=test" }, body: JSON.stringify(body) });
}

function context() {
    return { params: Promise.resolve({ id: "run" }) };
}
