import { generationModelId } from "@/lib/server/generation-channel";
import type { GenerationLogRequestSnapshot } from "@/lib/generation-log-snapshot";
import { isGenerationSource } from "@/lib/server/generation-log-store";
import { recordGenerationTaskLogResult } from "@/lib/server/generation-log-task-service";
import type { VideoTask } from "@/lib/server/video-task-store";

export function writeVideoGenerationLog(task: VideoTask, status: "success" | "failed", error?: string, canRetry = false) {
    const url = task.result?.url || task.result?.remoteUrl || "";
    return recordGenerationTaskLogResult({
        logId: task.generationLogId,
        slotId: task.generationSlotId,
        clientRequestId: task.clientRequestId,
        taskId: task.id,
        userId: task.userId,
        username: task.username || "",
        displayName: task.displayName || task.username || "",
        kind: "video",
        source: isGenerationSource(task.source) ? task.source : "video-workbench",
        status,
        title: task.title || task.prompt?.slice(0, 36) || "视频生成",
        prompt: task.prompt || "",
        model: generationModelId(task.config),
        summary: status === "success" ? "视频生成完成" : "视频生成失败",
        durationMs: Math.max(0, Date.now() - task.createdAt),
        asset:
            status === "success" && url
                ? {
                      type: "video",
                      url,
                      remoteUrl: task.result?.remoteUrl,
                      serverUrl: task.result?.url?.startsWith("/api/") ? task.result.url : undefined,
                      mimeType: task.result?.mimeType,
                  }
                : undefined,
        error,
        canRetry,
        requestSnapshot: providerRequestSnapshot(task),
        taskProvider: task.upstream.provider,
        taskPollPath: task.upstream.pollPath,
        serverTaskId: task.id,
        createdAt: task.createdAt,
    });
}

function providerRequestSnapshot(task: VideoTask): GenerationLogRequestSnapshot | undefined {
    const snapshot = task.upstream.requestSnapshot;
    if (!snapshot) return undefined;
    return {
        version: 1,
        parameters: {
            model: task.config.model,
            ...(task.requestedDurationSeconds ? { seconds: String(task.requestedDurationSeconds) } : {}),
        },
        references: snapshot.references.map((reference, index) => ({
            id: `provider-reference-${index + 1}`,
            kind: reference.type,
            name: reference.role || `参考素材 ${index + 1}`,
            mimeType: reference.type === "video" ? "video/mp4" : reference.type === "audio" ? "audio/mpeg" : "image/png",
            url: reference.url,
            ...(reference.remoteUrl ? { remoteUrl: reference.remoteUrl } : {}),
            ...(reference.serverUrl ? { serverUrl: reference.serverUrl } : {}),
            ...(reference.durationMs ? { durationMs: reference.durationMs } : {}),
        })),
        slots: [],
    };
}
