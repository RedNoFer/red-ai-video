import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import type { DramaAuthoringStandalonePackageDraft, DramaAuthoringWorkOrder } from "@/lib/drama-project-contract";
import { DRAMA_PACKAGE_SECTIONS } from "@/lib/server/drama-production-package-contract";
import { createDramaAuthoringWorkOrderForRun, DramaAuthoringWorkOrderError, getDramaAuthoringWorkOrderForRun } from "@/lib/server/drama-authoring-work-order";
import { getDramaProject } from "@/lib/server/drama-project-store";
import { previewDramaProductionPackage, DramaProductionPackageError } from "@/lib/server/drama-production-package";
import { updateAgentRunById } from "@/lib/server/agent-run-store";
import { publicAgentRun } from "@/lib/server/agent-run-public";

export const maxDuration = 2400;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, 32 * 1024 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const runId = (await context.params).id;
        const input = record(parsed.data);
        if (input.action === "create-work-order") {
            const result = await createDramaAuthoringWorkOrderForRun(user.id, runId);
            return NextResponse.json({ code: 0, data: { run: publicAgentRun(result.run), workOrder: result.workOrder }, msg: "Codex 独立制作包工作单已生成" });
        }
        if (input.action !== "submit") return NextResponse.json({ code: 400, data: null, msg: "外部 authoring 操作无效" }, { status: 400 });
        const result = await getDramaAuthoringWorkOrderForRun(user.id, runId);
        const workOrder = result.workOrder;
        if (workOrder.status !== "ready") throw new DramaAuthoringWorkOrderError("该独立 Codex 工作单已经提交或失效");
        const workOrderId = text(input.workOrderId);
        if (workOrderId !== workOrder.id) throw new DramaAuthoringWorkOrderError("Codex 工作单 ID 不匹配");
        validateManifest(workOrder, input.manifest);
        const draft = normalizeStandaloneDraft(input.draft);
        const project = await getDramaProject(workOrder.projectId, user.id);
        if (!project) throw new DramaAuthoringWorkOrderError("短剧项目不存在");
        validateStandaloneMarkdown(draft.markdown);
        const preview = previewDramaProductionPackage(draft.markdown, "codex-standalone-production-package.md", project, { allowImportWarnings: false, preserveAuthoredVideoPrompt: true });
        const authoring = preview.package.authoring;
        if (authoring?.authoringMode !== "codex-standalone" || authoring.canonicalSource !== "markdown-with-embedded-json" || authoring.qualityGateStatus !== "passed")
            throw new DramaProductionPackageError("独立 Codex 制作包必须在第十三章/QC 元数据中标记 qualityGateStatus=passed");
        const submittedWorkOrder = { ...workOrder, status: "submitted" as const };
        const claimed = await updateAgentRunById(result.run.id, { status: "running", executionId: undefined, dramaAuthoring: submittedWorkOrder }, { type: "drama.authoring.markdown.submitted", data: { workOrderId: workOrder.id } }, ["failed"]);
        if (!claimed) throw new DramaAuthoringWorkOrderError("任务状态已变化，请重新读取后提交");
        const acceptedWorkOrder = { ...submittedWorkOrder, status: "accepted" as const };
        const completed = await updateAgentRunById(
            claimed.id,
            {
                status: "completed",
                tasks: [],
                reviewed: true,
                dramaFailureKind: undefined,
                dramaQualityGateReport: authoring.qualityGateReport,
                dramaScriptPackage: { markdown: draft.markdown, preview },
                dramaAuthoring: acceptedWorkOrder,
                timings: { ...(claimed.timings || { requestAcceptedAt: claimed.createdAt }), dramaAuthoringCompletedAt: Date.now(), runCompletedAt: Date.now() },
            },
            { type: "run.completed", data: { reply: draft.reply || "独立 Codex 制作包已导入。", dramaScriptPackage: { markdown: draft.markdown, preview } } },
            ["running"],
        );
        if (!completed) throw new DramaAuthoringWorkOrderError("制作包已校验，但任务状态更新失败，请重新读取任务");
        return NextResponse.json({ code: 0, data: { run: publicAgentRun(completed), workOrder: acceptedWorkOrder }, msg: "独立 Codex Markdown 已通过结构安全校验并导入" });
    } catch (error) {
        if (error instanceof DramaAuthoringWorkOrderError) return NextResponse.json({ code: 409, data: null, msg: error.message }, { status: 409 });
        if (error instanceof DramaProductionPackageError) return NextResponse.json({ code: 422, data: null, msg: error.message }, { status: 422 });
        throw error;
    }
}

function normalizeStandaloneDraft(value: unknown): DramaAuthoringStandalonePackageDraft {
    const input = record(value);
    if (input.mode !== "package-markdown") throw new DramaAuthoringWorkOrderError("Codex 必须提交 mode=package-markdown 的完整 13 章 Markdown");
    const markdown = typeof input.markdown === "string" ? input.markdown : "";
    if (!markdown.trim()) throw new DramaAuthoringWorkOrderError("独立 Codex 制作包 Markdown 不能为空");
    return { mode: "package-markdown", reply: text(input.reply) || "独立 Codex 制作包已提交。", markdown };
}

function validateStandaloneMarkdown(markdown: string) {
    const blocks = [...markdown.matchAll(/```(?:drama-production-package|json)[ \t]*\r?\n[\s\S]*?```/giu)];
    if (blocks.length !== 1) throw new DramaProductionPackageError("独立 Codex 制作包必须包含且只能包含一个 drama-production-package JSON 代码块");
    let previousIndex = -1;
    for (const section of DRAMA_PACKAGE_SECTIONS) {
        const pattern = new RegExp(`^##\\s+[^\\n]*${escapeRegExp(section)}[^\\n]*$`, "gmu");
        const matches = [...markdown.matchAll(pattern)];
        if (matches.length !== 1) throw new DramaProductionPackageError(`独立 Codex 制作包必须包含且仅包含一个固定章节：${section}`);
        const index = matches[0].index ?? -1;
        if (index <= previousIndex) throw new DramaProductionPackageError(`独立 Codex 制作包固定章节顺序错误：${section}`);
        previousIndex = index;
    }
}

function validateManifest(workOrder: DramaAuthoringWorkOrder, value: unknown) {
    const input = record(value);
    if (!sameManifest(workOrder.contract, input.contract) || !sameManifest(workOrder.directorSkill, input.directorSkill) || !sameManifest(workOrder.seedanceSkill, input.seedanceSkill))
        throw new DramaAuthoringWorkOrderError("Codex 工作单使用了过期或不一致的契约/Skill 哈希");
    const sources = Array.isArray(input.sources) ? input.sources : [];
    if (sources.length !== workOrder.sources.length || sources.some((item, index) => !sameSource(workOrder.sources[index], item))) throw new DramaAuthoringWorkOrderError("Codex 工作单素材 alias、顺序或内容哈希不一致");
}

function sameManifest(expected: { id: string; version: string; contentHash: string }, actual: unknown) {
    const value = record(actual);
    return value.id === expected.id && value.version === expected.version && value.contentHash === expected.contentHash;
}

function sameSource(expected: DramaAuthoringWorkOrder["sources"][number], actual: unknown) {
    const value = record(actual);
    return value.alias === expected.alias && value.role === expected.role && value.contentHash === expected.contentHash;
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}
