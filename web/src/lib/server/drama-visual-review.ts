import type { CreativeFoundation } from "@/lib/creative-agent-contract";
import type { CreativeReviewTaskInput } from "@/lib/server/creative-review-service";
import { resolveDramaVisualStyle } from "@/lib/drama-style";

export function normalizeDramaVisualReviewInput(value: unknown): { foundation: CreativeFoundation; tasks: CreativeReviewTaskInput[] } {
    const input = object(value);
    const project = object(input.project);
    const episode = object(input.episode);
    const productionBible = object(project.productionBible);
    const style = resolveDramaVisualStyle({ style: text(project.style), productionBible: { visualStyle: text(productionBible.visualStyle) } });
    const ratio = text(project.ratio);
    const tasks = array(episode.shots).flatMap((item) => {
        const shot = object(item);
        const id = text(shot.id);
        const imageUrls = [mediaUrl(shot.storyboardImageUrl), mediaUrl(shot.storyboardEndImageUrl), mediaUrl(shot.actualStartFrameUrl), mediaUrl(shot.actualEndFrameUrl)].filter(Boolean);
        if (!id || !imageUrls.length) return [];
        return [
            {
                id,
                title: text(shot.title) || "未命名镜头",
                type: "image" as const,
                prompt: text(shot.compiledPrompt) || text(shot.imagePrompt) || text(shot.description),
                resultSummary: mediaUrl(shot.actualEndFrameUrl) ? "已生成分镜及成片实际首尾帧，按图片顺序核对身份、动作起止和状态" : imageUrls.length > 1 ? "已生成起始帧和结束帧" : "已生成分镜图",
                imageUrls,
            },
        ];
    });
    for (const item of array(episode.continuityEdges)) {
        const edge = object(item);
        if (!edge.inheritActualEndFrame) continue;
        const fromShot = array(episode.shots)
            .map(object)
            .find((shot) => text(shot.id) === text(edge.fromShotId));
        const toShot = array(episode.shots)
            .map(object)
            .find((shot) => text(shot.id) === text(edge.toShotId));
        const imageUrls = [mediaUrl(fromShot?.actualEndFrameUrl), mediaUrl(toShot?.actualStartFrameUrl)].filter(Boolean);
        if (imageUrls.length !== 2) continue;
        tasks.push({
            id: text(edge.toShotId),
            title: `${text(fromShot?.title) || "上一镜头"} → ${text(toShot?.title) || "下一镜头"}`,
            type: "image",
            prompt: `严格检查相邻镜头衔接：转场 ${text(edge.transition)}；${text(edge.notes)}。第一张是上一镜头实际尾帧，第二张是下一镜头实际首帧。`,
            resultSummary: "相邻成片实际尾帧与首帧连续性对比",
            imageUrls,
        });
    }
    return {
        foundation: {
            complexity: "complex",
            brief: {
                objective: `${text(project.title) || "短剧"} · ${text(episode.title) || "当前剧集"}分镜一致性检查`,
                coreMessage: text(project.summary),
                constraints: [`画幅 ${ratio || "未指定"}`, "角色身份、服装、道具、空间、视线和轴线应在相邻镜头中保持连续"],
                referenceStrategy: "以项目资产设定和相邻镜头为一致性基准",
            },
            direction: {
                summary: style || "保持镜头叙事清晰、主体稳定、相邻画面连续",
                style,
                composition: "检查景别、构图、人物站位、视线和屏幕运动方向",
                avoid: ["角色身份漂移", "服装或道具无依据变化", "空间关系跳变", "轴线与视线错误", "文字和水印"],
            },
        },
        tasks,
    };
}

function mediaUrl(value: unknown) {
    const url = text(value);
    return url.startsWith("/api/") || /^https:\/\//i.test(url) || /^data:image\//i.test(url) ? url : "";
}

function object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}
