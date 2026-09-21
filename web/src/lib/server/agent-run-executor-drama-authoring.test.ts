import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRun } from "./agent-run-store";

const mocks = vi.hoisted(() => ({
    getAuthSettings: vi.fn(),
    getDramaProject: vi.fn(),
    getCreativeAssetsByIds: vi.fn(),
    requestFunctionCall: vi.fn(),
    getAgentRun: vi.fn(),
    updateAgentRunById: vi.fn(),
    previewDramaProductionPackage: vi.fn(),
    serializeDramaProductionPackage: vi.fn(),
    attachDramaProductionPackageAuthoring: vi.fn(),
    validateDramaAuthoringQuality: vi.fn(),
    currentRun: null as AgentRun | null,
}));

vi.mock("@/lib/auth/store", () => ({ getAuthSettings: mocks.getAuthSettings }));
vi.mock("@/lib/server/drama-project-store", () => ({ getDramaProject: mocks.getDramaProject }));
vi.mock("@/lib/server/creative-runtime-store", () => ({ getCreativeAssetsByIds: mocks.getCreativeAssetsByIds }));
vi.mock("@/lib/server/agent-run-store", () => ({ getAgentRun: mocks.getAgentRun, updateAgentRunById: mocks.updateAgentRunById }));
vi.mock("@/lib/server/agent-run-execution", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/server/agent-run-execution")>();
    return { ...actual, requestFunctionCall: mocks.requestFunctionCall };
});
vi.mock("@/lib/server/drama-production-package", () => ({
    DramaProductionPackageError: class extends Error {},
    attachDramaProductionPackageAuthoring: mocks.attachDramaProductionPackageAuthoring,
    buildDramaAssetReuseContext: () => ({ rule: "", episodeCode: "E01", characters: [], locations: [], props: [], clues: [] }),
    previewDramaProductionPackage: mocks.previewDramaProductionPackage,
}));
vi.mock("@/lib/drama-production-package-serializer", () => ({ serializeDramaProductionPackageMarkdown: mocks.serializeDramaProductionPackage }));
vi.mock("@/lib/server/drama-production-package-quality", () => ({
    DramaAuthoringQualityGateError: class extends Error {},
    validateDramaAuthoringQuality: mocks.validateDramaAuthoringQuality,
}));

import { executeAgentRun } from "./agent-run-executor";

function runFixture(): AgentRun {
    const now = Date.now();
    return {
        id: "agent-drama-authoring",
        userId: "user",
        conversationId: "conversation",
        clientRequestId: "request",
        surface: "drama",
        projectId: "project",
        episodeId: "episode",
        workflow: "drama-script",
        inputMessageId: "input",
        assistantMessageId: "assistant",
        prompt: "根据当前 TXT 生成全新的制作包，30 秒高密度硬切。",
        referencedAssetIds: ["story-asset"],
        selectedSkillIds: [],
        assetIds: [],
        status: "planning",
        tasks: [],
        reviewed: false,
        createdAt: now,
        updatedAt: now,
        snapshot: {},
    };
}

describe("drama package authoring recovery", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const settings = {
            defaultModels: { textModel: "planner", imageModel: "", videoModel: "", audioModel: "" },
            systemChannels: [
                { id: "planner-channel", name: "规划", enabled: true, baseUrl: "https://api.example.com/v1", apiKey: "secret", models: ["vendor/planner"] },
                { id: "planner-backup-channel", name: "规划备用", enabled: true, baseUrl: "https://api.example.com/v1", apiKey: "secret", models: ["vendor/planner-backup"] },
            ],
            logicalModels: [
                {
                    id: "planner",
                    name: "规划",
                    capability: "text",
                    enabled: true,
                    bindings: [
                        { id: "planner-binding", channelId: "planner-channel", upstreamModel: "vendor/planner", enabled: true, priority: 1 },
                        { id: "planner-backup-binding", channelId: "planner-backup-channel", upstreamModel: "vendor/planner-backup", enabled: true, priority: 2 },
                    ],
                },
            ],
            agentSkills: [],
            generationDefaults: {},
            generationConcurrency: { agent: 2, image: 2, video: 1, audio: 2, text: 2, render: 1 },
        };
        mocks.getAuthSettings.mockResolvedValue(settings);
        mocks.getDramaProject.mockResolvedValue({
            id: "project",
            title: "当前项目",
            summary: "当前项目",
            style: "半写实",
            ratio: "16:9",
            seriesBible: {},
            episodes: [{ id: "episode", code: "E01", title: "第一集", script: "萧炎抬眼。", outline: "冲突", hook: "退婚", nextPreview: "", sourceRange: "当前 TXT" }],
        });
        mocks.getCreativeAssetsByIds.mockResolvedValue([{ id: "story-asset", type: "text", title: "2.txt", textContent: "萧炎抬眼，纳兰提出退婚。" }]);
        mocks.updateAgentRunById.mockImplementation(async (_id: string, patch: Record<string, unknown>, _event: unknown, allowedStatuses?: string[]) => {
            const current = mocks.currentRun as AgentRun;
            if (allowedStatuses && !allowedStatuses.includes(current.status)) return null;
            mocks.currentRun = { ...current, ...patch } as AgentRun;
            return mocks.currentRun;
        });
        mocks.getAgentRun.mockImplementation(async () => mocks.currentRun);
        mocks.previewDramaProductionPackage.mockReturnValue({
            package: {
                project: { productionBible: { productionPlan: { visual: { visualStyle: "东方玄幻", artStyle: "3D 半写实" } } } },
                episodes: [{ shots: [] }],
            },
        });
        mocks.serializeDramaProductionPackage.mockReturnValue("# 正式制作包");
        mocks.attachDramaProductionPackageAuthoring.mockImplementation((value: unknown) => value);
        mocks.validateDramaAuthoringQuality.mockReturnValue({ status: "passed", checks: [] });
        mocks.requestFunctionCall.mockReset();
        mocks.currentRun = null;
    });

    it("revises when the first structured authoring response is not a package", async () => {
        const run = runFixture();
        mocks.currentRun = run;
        mocks.requestFunctionCall.mockResolvedValueOnce({ arguments: JSON.stringify({ mode: "reply", reply: "请先补充信息" }) }).mockResolvedValueOnce({ arguments: JSON.stringify({ mode: "package", reply: "制作包已生成", markdown: "# 制作包" }) });

        await executeAgentRun(run, "http://localhost", "session=test");

        expect(mocks.requestFunctionCall).toHaveBeenCalledTimes(2);
        expect(mocks.currentRun?.status).toBe("completed");
    });

    it("aggregates structural preflight failures before requesting one revision", async () => {
        const run = runFixture();
        mocks.currentRun = run;
        let previewCalls = 0;
        mocks.previewDramaProductionPackage.mockImplementation((_source: string, _fileName: string, _project: unknown, options?: { importWarnings?: string[] }) => {
            previewCalls += 1;
            if (previewCalls === 1) options?.importWarnings?.push("SH04 startFramePrompt 无效", "SH06 imagePrompt 含对白");
            return {
                package: {
                    project: { productionBible: { productionPlan: { visual: { visualStyle: "东方玄幻", artStyle: "3D 半写实" } } } },
                    episodes: [{ shots: [] }],
                },
            };
        });
        mocks.requestFunctionCall
            .mockResolvedValueOnce({ arguments: JSON.stringify({ mode: "package", reply: "初版", markdown: "# 初版" }) })
            .mockResolvedValueOnce({ arguments: JSON.stringify({ mode: "package", reply: "修订版", markdown: "# 修订版" }) });

        await executeAgentRun(run, "http://localhost", "session=test");

        expect(mocks.requestFunctionCall).toHaveBeenCalledTimes(2);
        const revisionMessages = mocks.requestFunctionCall.mock.calls[1][3] as Array<{ content?: string }>;
        expect(revisionMessages[1]?.content).toContain("SH04 startFramePrompt 无效");
        expect(revisionMessages[1]?.content).toContain("SH06 imagePrompt 含对白");
    });

    it("does not fail over to another candidate after the complete revision fails a content gate", async () => {
        const run = runFixture();
        mocks.currentRun = run;
        mocks.previewDramaProductionPackage.mockImplementation((_source: string, _fileName: string, _project: unknown, options?: { importWarnings?: string[] }) => {
            options?.importWarnings?.push("SH01 package content gate failed");
            return {
                package: {
                    project: { productionBible: { productionPlan: { visual: { visualStyle: "东方玄幻", artStyle: "3D 半写实" } } } },
                    episodes: [{ shots: [] }],
                },
            };
        });
        mocks.requestFunctionCall
            .mockResolvedValueOnce({ arguments: JSON.stringify({ mode: "package", reply: "初版", markdown: "# 初版" }) })
            .mockResolvedValueOnce({ arguments: JSON.stringify({ mode: "package", reply: "修订版", markdown: "# 修订版" }) })
            .mockResolvedValueOnce({ arguments: JSON.stringify({ mode: "package", reply: "不应调用", markdown: "# 不应调用" }) });

        await executeAgentRun(run, "http://localhost", "session=test");

        expect(mocks.requestFunctionCall).toHaveBeenCalledTimes(2);
        expect(mocks.currentRun?.status).toBe("failed");
    });
});
