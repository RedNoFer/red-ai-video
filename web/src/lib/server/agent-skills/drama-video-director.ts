export { dramaDirectorSourceManifest, DRAMA_VIDEO_DIRECTOR_SKILL, resolveDramaDirectorInstructions, type DramaDirectorSurface } from "./drama-video-director.generated";

import type { DramaShot } from "@/lib/drama-project-contract";

export type DramaDirectorQualityIssue = {
    code: "DIRECTOR_CAMERA" | "DIRECTOR_LIGHT_SOURCE" | "DIRECTOR_DEPTH" | "DIRECTOR_RESULT" | "DIRECTOR_CINEMA_SLOP" | "DIRECTOR_MULTI_MOTION";
    message: string;
    correction: string;
};

const concreteDepthPattern = /前景|中景|背景|纵深|层次|遮挡|通道|门窗|景深|焦外/u;
const lightDirectionPattern = /左|右|上|下|侧|窗|门|背|前|来自|方向|逆光|顶光|侧光|轮廓光/u;
const abstractCinemaPattern = /电影感|氛围感|高级感|震撼|大片感/u;
const cameraMotionPattern = /推|拉|摇|移|跟|升|降|旋转|环绕|变焦|手持|固定/gu;

/**
 * Returns advisory director checks only. Factual asset and continuity checks stay in production preflight.
 */
export function auditDramaShotDirectorQuality(shot: DramaShot): DramaDirectorQualityIssue[] {
    const issues: DramaDirectorQualityIssue[] = [];
    const continuity = shot.continuity;
    const visualText = [shot.imagePrompt, shot.videoPrompt, shot.lighting, shot.colorPalette, continuity?.composition, continuity?.characterBlocking].filter(Boolean).join("\n");
    const keyLight = shot.lightingPlan?.keyLight || shot.lighting || shot.entryState?.lighting || "";

    if (!continuity?.shotSize || !continuity.cameraAngle || !continuity.composition || !shot.lens || !shot.cameraMotion?.trim())
        issues.push({ code: "DIRECTOR_CAMERA", message: "缺少完整的景别、焦段、机位、构图或主运镜意图", correction: "补充一个服务于当前动作/信息变化的景别、焦段、机位、构图和单一主运镜" });
    if (!keyLight.trim() || !lightDirectionPattern.test(keyLight)) issues.push({ code: "DIRECTOR_LIGHT_SOURCE", message: "缺少可执行的主光来源或方向", correction: "写明主光来自何处、照向谁，以及主体与背景的光照关系" });
    if (!concreteDepthPattern.test(visualText)) issues.push({ code: "DIRECTOR_DEPTH", message: "缺少具体的前景/中景/背景、遮挡、景深或空间纵深机制", correction: "用画面中真实存在的框景、主体和背景元素说明纵深" });
    if (!shot.dramaticFunction?.trim() && !continuity?.actionEnd?.trim() && !shot.exitState)
        issues.push({ code: "DIRECTOR_RESULT", message: "缺少镜头结束时的可见结果或戏剧职责", correction: "补充镜头唯一职责，以及出口状态中可观察的动作、反应或环境结果" });
    if (abstractCinemaPattern.test(visualText) && !/(光|色|材质|构图|运镜|姿态|视线|呼吸|手部|身体|道具|遮挡|景深|焦段)/u.test(visualText))
        issues.push({ code: "DIRECTOR_CINEMA_SLOP", message: "存在没有执行含义的电影化套话", correction: "将抽象审美词改写为具体的光色、材质、构图、运动或可见表演" });
    const motionCount = [shot.cameraMotion, continuity?.composition, shot.videoPrompt].filter(Boolean).reduce((count, value) => count + Array.from(String(value).matchAll(cameraMotionPattern)).length, 0);
    if (motionCount > 3) issues.push({ code: "DIRECTOR_MULTI_MOTION", message: "镜头可能堆叠多个互不相容的运镜动作", correction: "只保留一个有动机的主运镜，并说明它响应的动作或信息变化" });
    return issues;
}
