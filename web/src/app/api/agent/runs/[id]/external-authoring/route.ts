import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBodyResult } from "@/lib/auth/request";
import type { DramaAuthoringDraft, DramaAuthoringWorkOrder } from "@/lib/drama-project-contract";
import { executeDramaScriptRun } from "@/lib/server/agent-run-executor";
import { DramaAuthoringQualityGateError } from "@/lib/server/drama-production-package-quality";
import { createDramaAuthoringWorkOrderForRun, DramaAuthoringWorkOrderError, getDramaAuthoringWorkOrderForRun } from "@/lib/server/drama-authoring-work-order";
import { getAgentRun, updateAgentRunById } from "@/lib/server/agent-run-store";
import { publicAgentRun } from "@/lib/server/agent-run-public";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { toSafeGenerationErrorMessage } from "@/lib/server/generation-errors";

export const maxDuration = 2400;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const parsed = await readJsonBodyResult<unknown>(request, 16 * 1024 * 1024);
    if (!parsed.ok) return NextResponse.json({ code: parsed.status, data: null, msg: parsed.message }, { status: parsed.status });
    try {
        const runId = (await context.params).id;
        const input = record(parsed.data);
        if (input.action === "create-work-order") {
            const result = await createDramaAuthoringWorkOrderForRun(user.id, runId);
            return NextResponse.json({ code: 0, data: { run: publicAgentRun(result.run), workOrder: result.workOrder }, msg: "Codex 工作单已生成" });
        }
        if (input.action !== "submit") return NextResponse.json({ code: 400, data: null, msg: "外部 authoring 操作无效" }, { status: 400 });
        const result = await getDramaAuthoringWorkOrderForRun(user.id, runId);
        const workOrder = result.workOrder;
        if (workOrder.status !== "ready") throw new DramaAuthoringWorkOrderError("该 Codex 工作单已经提交或失效");
        const workOrderId = text(input.workOrderId);
        if (workOrderId !== workOrder.id) throw new DramaAuthoringWorkOrderError("Codex 工作单 ID 不匹配");
        validateManifest(workOrder, input.manifest);
        const draft = normalizeDraft(input.draft);
        const executionId = `codex-${nanoid()}`;
        const submittedWorkOrder = { ...workOrder, status: "submitted" as const };
        const claimed = await updateAgentRunById(
            result.run.id,
            { status: "running", executionId, dramaAuthoring: submittedWorkOrder },
            { type: "drama.authoring.work-order.submitted", data: { workOrderId: workOrder.id } },
            ["failed"],
        );
        if (!claimed) throw new DramaAuthoringWorkOrderError("任务状态已变化，请重新读取后提交");
        try {
            await executeDramaScriptRun(claimed, resolveInternalOrigin(new URL(request.url).origin), request.headers.get("cookie") || "", new AbortController().signal, { provider: "codex-work-order", draft });
            const completed = await getAgentRun(result.run.id);
            const acceptedWorkOrder = { ...submittedWorkOrder, status: "accepted" as const };
            const updated = completed ? await updateAgentRunById(completed.id, { dramaAuthoring: acceptedWorkOrder }, { type: "drama.authoring.work-order.accepted", data: { workOrderId: workOrder.id } }, ["completed"]) : null;
            return NextResponse.json({ code: 0, data: { run: publicAgentRun(updated || completed || claimed), workOrder: acceptedWorkOrder }, msg: "Codex 草案已通过统一门禁并生成制作包" });
        } catch (error) {
            const latest = await getAgentRun(result.run.id);
            const rejectedWorkOrder = { ...submittedWorkOrder, status: "rejected" as const };
            if (latest)
                await updateAgentRunById(latest.id, { status: "failed", executionId: undefined, dramaAuthoring: rejectedWorkOrder, ...(error instanceof DramaAuthoringQualityGateError ? { dramaQualityGateReport: error.report } : {}) }, { type: "run.failed", data: { message: toSafeGenerationErrorMessage(error, "Codex 草案未通过质量门禁") } }, ["running"], executionId);
            throw new DramaAuthoringWorkOrderError(toSafeGenerationErrorMessage(error, "Codex 草案未通过质量门禁"));
        }
    } catch (error) {
        if (error instanceof DramaAuthoringWorkOrderError) return NextResponse.json({ code: 409, data: null, msg: error.message }, { status: 409 });
        throw error;
    }
}

function normalizeDraft(value: unknown): DramaAuthoringDraft {
    const input = record(value);
    if (input.mode !== "package") throw new DramaAuthoringWorkOrderError("Codex 只能提交 mode=package 的 authoring draft");
    const reply = text(input.reply);
    const markdown = text(input.markdown);
    if (!reply || !markdown) throw new DramaAuthoringWorkOrderError("Codex 草案必须包含 reply 和完整 markdown");
    return { mode: "package", reply, markdown };
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

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}
