import type { DramaAssetRefinementProposal, DramaEpisode, DramaFrameBeat, DramaNamedAsset, DramaProject, DramaReferenceManifestItem, DramaShot, DramaShotContinuity } from "@/lib/drama-project-contract";
import { DRAMA_STYLE_COLOR_SCRIPT, DRAMA_STYLE_DESCRIPTION, DRAMA_STYLE_NAME, DRAMA_STYLE_VISUAL, resolveDramaVisualStyle, sanitizeDramaVisualPrompt } from "@/lib/drama-style";
import { upgradeDramaFrameImagePrompt } from "@/lib/drama-frame-sequence";

export type DramaAssetGenerationPreflight = { ok: true; constraints: string[] } | { ok: false; errors: string[]; constraints: string[] };

export type CompiledDramaPrompts = {
    imagePrompt: string;
    startFramePrompt: string;
    endFramePrompt: string;
    videoPrompt: string;
};

const STRUCTURED_VIDEO_LABELS = [
    "动态意图",
    "起始可见状态",
    "触发",
    "主体动作与反应",
    "主运镜",
    "单一主运镜",
    "动作连续",
    "表演变化",
    "微动作",
    "环境压力",
    "光色",
    "声音意图",
    "声音母题",
    "对白与口型",
    "画外音节奏",
    "参考职责",
    "结束画面",
    "风格",
    "针对性约束",
    "约束",
] as const;
const STRUCTURED_VIDEO_ROOT_LABELS = ["动态意图", "起始可见状态", "触发", "主体动作与反应", "单一主运镜", "动作连续", "表演变化"] as const;

/** Remove reference manifests before the current request order is appended. */
export function stripDramaReferenceBindingSections(prompt: string) {
    const lines = prompt.trim().split(/\r?\n/u);
    const output: string[] = [];
    let skipping = false;
    for (const line of lines) {
        const value = line.trim();
        if (/^(?:参考图顺序（与(?:视频)?请求数组完全一致）|实际参考图绑定（编号与本次请求图片数组完全一致）)[：:]?/u.test(value)) {
            skipping = true;
            continue;
        }
        if (skipping && (/^@图片\d+[：:]/u.test(value) || /^必须逐图按上述职责使用/u.test(value) || /^执行要求：逐图识别/u.test(value) || !value)) continue;
        skipping = false;
        output.push(line);
    }
    return output.join("\n").trim();
}

/** Append image duties in the exact order used by the supplier request. */
export function appendDramaImageReferenceBindings(prompt: string, references: Array<{ id: string; label?: string; binding?: string }>) {
    const base = stripDramaReferenceBindingSections(prompt);
    if (!references.length) return base;
    const manifest = references
        .map((reference, index) => {
            const label = reference.label || (reference.id.startsWith("continuity-") ? "上一帧连续性锚点" : "项目资产基准图");
            return `@图片${index + 1}：${label}${reference.binding ? `；绑定规则：${reference.binding}` : ""}`;
        })
        .join("\n");
    return [base, `实际参考图绑定（编号与本次请求图片数组完全一致）：\n${manifest}\n执行要求：逐图识别并按上述绑定关系使用；角色图不得替代场景，场景图不得改写角色，连续性帧优先约束当前可见状态。未列入本清单的图片不得假定已引用。`]
        .filter(Boolean)
        .join("\n");
}

export function compileDramaShotPrompts(project: DramaProject, episode: DramaEpisode, shot: DramaShot): CompiledDramaPrompts {
    const scene = project.scenes.find((item) => item.id === shot.sceneId);
    const characters = project.characters.filter((item) => shot.characterIds.includes(item.id));
    const props = project.props.filter((item) => shot.propIds.includes(item.id));
    const clues = project.clues.filter((item) => shot.clueIds.includes(item.id));
    const continuity = continuityLines(shot.continuity);
    const imagePlan = sanitizeDramaSupplierText(sanitizeDramaVisualPrompt(shot.executionImagePrompt || shot.imagePrompt), project);
    const startPlan = sanitizeDramaSupplierText(sanitizeDramaVisualPrompt(shot.startFramePrompt || imagePlan), project);
    const endPlan = sanitizeDramaSupplierText(sanitizeDramaVisualPrompt(shot.endFramePrompt || shot.executionVideoPrompt || shot.videoPrompt || imagePlan), project);
    const entryState = stateLines(shot.entryState, project);
    const exitState = stateLines(shot.exitState, project);
    const inheritedTail = shot.framePlan?.start.source === "previous_accepted_actual_tail";
    const referenceManifest = shot.framePlan?.referenceManifest || [];
    const finalStyleLock = `最终视觉锁定：${DRAMA_STYLE_DESCRIPTION}；镜头中已有视觉方案若与统一风格冲突，必须以本风格为准。`;
    const shared = compact([
        `项目：${project.title} / ${episode.title}`,
        `统一风格：${DRAMA_STYLE_NAME}`,
        `统一视觉风格（最高级风格约束）：${resolveDramaVisualStyle(project)}`,
        `统一表现媒介（所有图片与视频必须遵守）：${DRAMA_STYLE_VISUAL}`,
        `画幅：${project.ratio}`,
        scene ? `场景设定：${assetText(scene, project)}` : "",
        characters.length ? `角色设定：${characters.map((item) => assetText(item, project)).join("；")}` : "",
        props.length ? `道具设定：${props.map((item) => assetText(item, project)).join("；")}` : "",
        clues.length ? `叙事线索：${clues.map((item) => `${assetText(item, project)}；回收：${sanitizeDramaSupplierText(item.payoff, project)}`).join("；")}` : "",
        continuity.length ? `连续性约束：${continuity.join("；")}` : "",
        entryState.length ? `入口状态：${entryState.join("；")}` : "",
        exitState.length ? `出口状态：${exitState.join("；")}` : "",
        `首帧引用策略：${inheritedTail ? "仅引用上一镜当前视频版本、已人工验收的实际尾帧作为 first_frame" : "独立镜头，按本镜入口状态生成"}`,
        inheritedTail ? "不得引用历史分镜首帧、旧任务结果、已删除、已拒绝或已失效的帧图；不得把上一镜的起始动作复制为本镜入口状态。" : "不得继承未在本镜入口状态中明确声明的上一镜动作、站位或道具状态。",
        referenceManifest.length
            ? `参考图职责计划：${referenceManifest.map((item) => `${manifestTarget(item, project)}=${item.role}${item.purpose ? `（${item.purpose}）` : ""}`).join("；")}。最终图片编号必须以本次请求末尾的“实际参考图绑定”为准，不得沿用计划别名猜测顺序。`
            : "",
        shot.negativePrompt ? `避免：${shot.negativePrompt}` : "",
        `全局色彩脚本：${project.productionBible?.colorScript || DRAMA_STYLE_COLOR_SCRIPT}`,
    ]);
    const imagePrompt = compact([
        ...shared,
        `镜头事实：${sanitizeDramaSupplierText(shot.description || shot.sourceText, project)}`,
        imagePlan ? `视觉方案：${imagePlan}` : "",
        shot.startFramePrompt ? `起始画面：${startPlan}` : "",
        "保持角色身份、服装、道具形态、场景空间关系与相邻镜头一致，不添加未在设定中出现的主体或文字。",
        finalStyleLock,
    ]).join("\n");
    const startFramePrompt = compact([...shared, `起始动作状态：${shot.entryState ? entryState.join("；") : shot.continuity?.actionStart || shot.description}`, startPlan, finalStyleLock]).join("\n");
    const endFramePrompt = compact([...shared, `结束动作状态：${shot.exitState ? exitState.join("；") : shot.continuity?.actionEnd || shot.description}`, endPlan, finalStyleLock]).join("\n");
    const videoPrompt = compact([compileDramaShotVideoBasePrompt(project, episode, shot), ...(shot.framePlan?.frames || []).map((frame) => `${frame.startSecond}-${frame.endSecond}s：${sanitizeDramaSupplierText(frame.actionPrompt, project)}`)]).join("\n");
    return {
        imagePrompt: sanitizeDramaSupplierText(imagePrompt, project),
        startFramePrompt: sanitizeDramaSupplierText(startFramePrompt, project),
        endFramePrompt: sanitizeDramaSupplierText(endFramePrompt, project),
        videoPrompt: sanitizeDramaSupplierText(videoPrompt, project),
    };
}

/**
 * Compact shot-level motion brief. Shared style DNA and full asset profiles live
 * in the project/package and are bound as references instead of being repeated
 * in every video request.
 */
export function compileDramaShotVideoBasePrompt(project: DramaProject, _episode: DramaEpisode, shot: DramaShot) {
    const videoPlan = cleanDramaVideoMotionBrief(
        shot.executionVideoPrompt || shot.videoPrompt,
        project,
        shot.executionVideoPrompt && !hasStructuredDramaVideoPrompt(shot.videoPrompt) ? shot.videoPrompt || shot.description : shot.executionVideoPrompt ? shot.description : undefined,
    );
    const actionStart = shot.continuity?.actionStart || stateActions(shot.entryState, project) || shot.description;
    const actionEnd = shot.continuity?.actionEnd || stateActions(shot.exitState, project) || shot.description;
    const middle = shot.performancePlan?.beats.middle;
    const performance = shot.performancePlan?.beats;
    const breath = shot.performancePlan?.breath;
    const light = shot.lightingPlan;
    const sound = compact([shot.sound?.ambience, shot.sound?.soundEffects, shot.sound?.music]).join("；");
    return sanitizeDramaSupplierText(
        compact([
            `动态意图：${videoPlan || sanitizeDramaSupplierText(shot.description || shot.sourceText, project)}`,
            `单一主运镜：${shot.cameraMotion || "固定机位"}`,
            `动作连续：${sanitizeDramaSupplierText(actionStart, project)} → ${sanitizeDramaSupplierText(actionEnd, project)}`,
            performance
                ? `表演变化：${performanceBeatLine("起始", performance.start)}；${performanceBeatLine("中段", performance.middle)}；${performanceBeatLine("结束", performance.end)}${breath ? `；呼吸${breath}` : ""}`
                : middle
                  ? `微动作：${compact([middle.facialAction, middle.gaze, middle.bodyAction]).join("，")}`
                  : "",
            light ? `光色：${compact([light.palette, light.keyLight]).join("；")}` : shot.colorPalette || shot.lighting ? `光色：${compact([shot.colorPalette, shot.lighting]).join("；")}` : "",
            sound ? `声音母题：${sanitizeDramaSupplierText(sound, project)}` : "",
            shot.dialogue ? `对白与口型：${sanitizeDramaSupplierText(shot.dialogue, project)}` : shot.narration ? `画外音节奏：${sanitizeDramaSupplierText(shot.narration, project)}` : "",
            `结束画面：${sanitizeDramaSupplierText(actionEnd, project)}`,
            `风格：${DRAMA_STYLE_NAME}`,
            `针对性约束：${sanitizeDramaSupplierText(shot.negativePrompt || "无闪烁、无形变、无背景漂移、无道具消失、无身份跳变、无水印文字", project)}`,
        ]).join("\n"),
        project,
    );
}

function performanceBeatLine(label: string, beat: NonNullable<NonNullable<DramaShot["performancePlan"]>["beats"]>["start"]) {
    return `${label}情绪${beat.emotion}，面部${beat.facialAction}，视线${beat.gaze}，身体${beat.bodyAction}`;
}

/**
 * Runtime generation must always use a fresh compilation so stale execution
 * snapshots cannot override the current project style or asset facts.
 */
export function compileDramaShotExecutionPrompts(project: DramaProject, episode: DramaEpisode, shot: DramaShot) {
    return compileDramaShotPrompts(project, episode, shot);
}

export function compileDramaFrameSupplierPrompt(project: DramaProject, episode: DramaEpisode, shot: DramaShot, beat?: DramaFrameBeat, phase: "start" | "end" | "keyframe" = "keyframe") {
    const scene = project.scenes.find((item) => item.id === shot.sceneId);
    const characters = project.characters.filter((item) => shot.characterIds.includes(item.id)).map((item) => assetText(item, project));
    const props = project.props.filter((item) => shot.propIds.includes(item.id)).map((item) => assetText(item, project));
    const clues = project.clues.filter((item) => shot.clueIds.includes(item.id)).map((item) => item.name);
    const saved = phase === "start" ? (shot.fieldOrigins?.startFramePrompt === "manual" ? shot.startFramePrompt : undefined) : phase === "end" ? (shot.fieldOrigins?.endFramePrompt === "manual" ? shot.endFramePrompt : undefined) : beat?.supplierPrompt;
    const image = beat?.imagePrompt || shot.imagePrompt;
    const action = beat?.actionPrompt || (phase === "start" ? shot.continuity?.actionStart || shot.description : phase === "end" ? shot.continuity?.actionEnd || shot.description : shot.description);
    const sequenceIndex = beat?.sequenceIndex || (phase === "end" ? Number.MAX_SAFE_INTEGER : 1);
    // Only preserve a manually saved prompt when it already follows the current
    // static-frame contract. Legacy prompts are rebuilt from the canonical beat
    // image prompt so old asset-anchor text cannot leak back into the preview.
    const savedPrompt = saved?.trim();
    const sourceImage = savedPrompt && isCurrentStaticFramePrompt(savedPrompt) ? savedPrompt : image;
    const staticPrompt = upgradeDramaFrameImagePrompt(sourceImage, action, {
        description: [shot.description, characters.length ? characters.join("；") : "", scene ? assetText(scene, project) : "", props.length ? props.join("；") : "", clues.length ? `线索：${clues.join("、")}` : ""].filter(Boolean).join("；") || image,
        shotSize: shot.continuity?.shotSize || "中景",
        cameraAngle: shot.continuity?.cameraAngle || "视线高度平视",
        composition: shot.continuity?.composition || "主体位于9:16安全区，前景有具体框景",
        characterBlocking: shot.continuity?.characterBlocking || "按当前动作关系安排主体站位",
        gazeDirection: shot.continuity?.gazeDirection || "视线落向当前叙事目标",
        lighting: shot.lighting || "延续本场主光",
        colorPalette: [shot.colorPalette || "沿用本场色板", `统一风格：${DRAMA_STYLE_NAME}`].join("；"),
        sequenceIndex,
    });
    return sanitizeDramaSupplierText(staticPrompt, project);
}

function isCurrentStaticFramePrompt(value: string) {
    return value.startsWith("静态关键帧：") && value.includes("可见表演状态：") && value.includes("景别：") && value.includes("机位与构图：") && value.includes("站位与视线：") && value.includes("三层空间：") && value.includes("光色与风格：") && value.includes("参考图职责：") && value.includes("负面约束：");
}

export function compileDramaDialogueAudioInstructions(shot: DramaShot) {
    const plan = shot.performancePlan;
    return compact([
        plan ? `整体语气：${plan.speechStyle}；节奏：${plan.pace}；呼吸：${plan.breath}；情绪递进：${plan.emotionalArc}` : "",
        shot.dialoguePerformance?.length ? shot.dialoguePerformance.map((item) => `【${item.utteranceId}】意图${item.intent}，语气${item.tone}，节奏${item.pace}，停顿${item.pause}，重音${item.emphasis}`).join("\n") : "",
    ]).join("\n");
}

function performanceLines(shot: DramaShot) {
    const plan = shot.performancePlan;
    const beats = plan?.beats;
    return compact([
        plan ? `表演目标：${plan.emotionalObjective}` : "",
        plan ? `情绪递进：${plan.emotionalArc}` : "",
        plan ? `说话方式：${plan.speechStyle}；节奏：${plan.pace}；呼吸：${plan.breath}；克制度：${plan.restraintLevel}` : "",
        shot.performanceNotes ? `补充表演说明：${shot.performanceNotes}` : "",
        beats ? `微表情起始：${beatText(beats.start)}` : "",
        beats ? `微表情中段：${beatText(beats.middle)}` : "",
        beats ? `微表情结束：${beatText(beats.end)}` : "",
        shot.dialoguePerformance?.length
            ? `逐句表演：${shot.dialoguePerformance.map((item) => `【${item.utteranceId}】意图${item.intent}，语气${item.tone}，节奏${item.pace}，停顿${item.pause}，重音${item.emphasis}；开口前${item.facialReactionBefore}，说话中${item.facialReactionDuring}，说完后${item.facialReactionAfter}`).join("；")}`
            : "",
    ]).join("\n");
}

function beatText(beat: NonNullable<NonNullable<DramaShot["performancePlan"]>["beats"]>["start"]) {
    return `情绪${beat.emotion}；面部${beat.facialAction}；视线${beat.gaze}；身体${beat.bodyAction}`;
}

function lightingLines(shot: DramaShot) {
    const plan = shot.lightingPlan;
    return plan
        ? `色彩与灯光：色板${plan.palette}；色温${plan.colorTemperature}；主光${plan.keyLight}；补光${plan.fillLight}；轮廓光${plan.rimLight}；反差${plan.contrast}；材质反射${plan.materialResponse}；肤色保护${plan.skinToneProtection}；上一镜继承${plan.inheritFromPrevious}；下一镜过渡${plan.transitionToNext}`
        : "";
}

function cleanDramaVideoMotionBrief(value: string, project: DramaProject, fallback?: string) {
    const cleaned = stripDramaReferenceBindingSections(
        sanitizeDramaSupplierText(sanitizeDramaVisualPrompt(value), project)
            .replace(/^\s*生成\s*\d+(?:\.\d+)?\s*(?:秒|s)\s*[^。；\n]*视频[，,。；;：:]*/iu, "")
            .replace(/(?:视频)?时长\s*[：:]?\s*\d+(?:\.\d+)?\s*(?:秒|s)/giu, "")
            .trim(),
    );
    const fallbackBrief = fallback
        ? stripDramaReferenceBindingSections(
              sanitizeDramaSupplierText(sanitizeDramaVisualPrompt(fallback), project)
                  .replace(/^\s*生成\s*\d+(?:\.\d+)?\s*(?:秒|s)\s*[^。；\n]*视频[，,。；;：:]*/iu, "")
                  .replace(/(?:视频)?时长\s*[：:]?\s*\d+(?:\.\d+)?\s*(?:秒|s)/giu, "")
                  .trim(),
          )
        : "";
    if (!hasStructuredDramaVideoPrompt(cleaned)) return cleaned;
    if (fallbackBrief && !hasStructuredDramaVideoPrompt(fallbackBrief)) return fallbackBrief;
    const dynamic = extractDramaVideoSection(cleaned, "动态意图");
    return dynamic && !hasStructuredDramaVideoPrompt(dynamic) ? dynamic : fallbackBrief || cleaned;
}

function hasStructuredDramaVideoPrompt(input: string) {
    return STRUCTURED_VIDEO_ROOT_LABELS.some((label) => input.includes(`${label}：`) || input.includes(`${label}:`));
}

function extractDramaVideoSection(value: string, label: (typeof STRUCTURED_VIDEO_LABELS)[number]) {
    const start = value.search(new RegExp(`${label}[：:]`, "u"));
    if (start < 0) return "";
    const contentStart = start + label.length + 1;
    const rest = value.slice(contentStart);
    const next = rest.search(new RegExp(`(?:^|[\\n；。])\\s*(?:${STRUCTURED_VIDEO_LABELS.filter((item) => item !== label).join("|")})[：:]`, "u"));
    return rest.slice(0, next < 0 ? undefined : next).trim();
}

function stateActions(value: DramaShot["entryState"], project: DramaProject) {
    if (!value) return "";
    return compact([...value.characters.map((entity) => sanitizeDramaSupplierText(entity.action || entity.pose || "", project)), ...value.props.map((entity) => sanitizeDramaSupplierText(entity.state || "", project))]).join("；");
}

export function compileDramaAssetReferencePrompt(project: Pick<DramaProject, "title" | "style" | "ratio" | "productionBible">, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具") {
    const constraints = compileDramaAssetConstraints(project, asset, kind);
    return compact([
        "这是严格的资产基准图生成任务，不是自由创作或概念发挥。请先核对全部硬约束，再生成一张可直接用于后续镜头的基准图。",
        "约束优先级：统一视觉风格 > 身份锚点与固定规则 > 用户明确设定 > 画幅和构图约束；资产历史提示词不得覆盖统一视觉风格。",
        `${kind}设定图，画幅 ${project.ratio}`,
        `统一风格：${DRAMA_STYLE_NAME}`,
        `统一视觉风格（最高级风格约束）：${resolveDramaVisualStyle(project)}`,
        `风格指引：${DRAMA_STYLE_VISUAL}；${kind}必须融入暗黑学院魔法环境、哥特建筑或微光符文法阵的氛围层。`,
        `名称：${asset.name}`,
        `基础描述：${asset.description}`,
        asset.profile?.visualIdentity ? `视觉识别：${sanitizeDramaVisualPrompt(asset.profile.visualIdentity)}` : "",
        asset.profile?.styling ? `造型与材质：${sanitizeDramaVisualPrompt(asset.profile.styling)}` : "",
        asset.profile?.colorPalette ? `固定色彩：${sanitizeDramaVisualPrompt(asset.profile.colorPalette)}` : "",
        asset.profile?.consistencyRules ? `一致性规则：${sanitizeDramaVisualPrompt(asset.profile.consistencyRules)}` : "",
        asset.profile?.designPrompt ? "资产档案中的历史 designPrompt 不直接发送；生图只使用已结构化的身份、服装、材质、固定道具和一致性字段，不采用其中的旧画风、旧色彩、旧背景、旧构图或设定板布局。" : "",
        asset.profile?.identityAnchors?.length ? `身份锚点（必须保留）：${asset.profile.identityAnchors.join("；")}` : "",
        asset.profile?.spatialRules?.length ? `空间/位置约束（必须准确）：${asset.profile.spatialRules.join("；")}` : "",
        asset.profile?.stateRules?.length ? `状态约束：${asset.profile.stateRules.join("；")}` : "",
        kind === "角色"
            ? "角色构图硬约束（高于风格与背景）：正面或三分之二全身立姿（full-body, head-to-toe），镜头必须从头顶拍到鞋底；头部必须位于画面上方并完整出现，脸部清晰可见，头顶和脚底保留安全边距。禁止只生成躯干、胸像、半身、裁脸或画面外的人头。"
            : "",
        kind === "角色" ? "角色视觉刻画优先级：完整头部与脸部入画 > 肖像级面部刻画 > 脸部比例与审美 > 五官质感 > 光线 > 服装 > 背景；构图仍必须是完整全身角色模型图，不得裁切身体。" : "",
        ...constraints.map((item) => `输出约束：${item}`),
        `最终风格锁定：${DRAMA_STYLE_DESCRIPTION}。不得回退到历史 designPrompt 的旧风格或中性灰设定板。`,
        `最终自检：只能有一个主体，${kind === "角色" ? "全身、头部、躯干、双臂、双手、双腿和鞋靴必须完整入画；脸部作为最高细节区域，优先清晰且具有审美表现" : "主体结构和关键材质必须完整入画"}，必须能从身份锚点准确识别；若无法同时满足全部约束，宁可保持设定的简洁原貌，也不得自行添加、替换或拼版。`,
    ]).join("\n");
}

export function compileDramaAssetConstraints(project: Pick<DramaProject, "ratio">, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具") {
    const forbidden = asset.profile?.forbiddenChanges?.length ? asset.profile.forbiddenChanges : ["未授权的服装、道具、饰品、武器、徽章、文字、水印或品牌"];
    return compact([
        `只输出一张完整、独立的 ${project.ratio || "9:16"} 设定图，不要拼版、联系表、多视角或分格模块。`,
        kind === "角色"
            ? "角色基准图必须是单人完整全身角色模型图：头顶、完整头部、脸部、颈部、躯干、双臂、双手、双腿和鞋靴全部入画，采用全身立姿或自然站姿，人物占画面约 70%–85%，上下左右均保留安全边距；脸部必须在画面上方清晰可见，不能被画面边缘截断；脸部是最高细节区域，使用协调耐看的半写实动漫审美比例，眼神有神，眉眼、鼻唇、面部轮廓、自然肤质和发丝精细清晰，脸部刻画精致但不放大到占据大部分画面；服装、体态和关键识别配件完整可见；暗黑学院魔法背景使用适度景深，哥特建筑或微光符文法阵作为氛围层。"
            : kind === "场景"
              ? "单一场景主体完整可见，结构轮廓和关键材质清晰，暗黑学院魔法环境，哥特建筑、符文法阵和暮色金紫光线形成空间层次。"
              : "单一道具主体完整可见，结构轮廓和关键材质清晰，置于暗黑学院氛围环境或深色展示台中，使用暮色金紫轮廓光。",
        kind === "角色" ? "负面构图词：无头、无脸、缺失头部、裁掉头部、裁脸、画面外人头、半身、胸像、躯干特写、身体局部、只画服装。" : "",
        "不得添加设定中没有出现的主体、装饰或剧情信息，不添加文字、水印、logo、边框。",
        `严格保留${kind}的身份、轮廓、年龄感、色彩和一致性规则，不得擅自改写。`,
        "禁止把中文说明、角色关系表、参数表、海报排版或多张视图画进图片；设定文字只作为生成约束，不是画面内容。",
        `禁止：${forbidden.join("；")}`,
    ]);
}

export function preflightDramaAssetGeneration(project: Pick<DramaProject, "ratio">, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具"): DramaAssetGenerationPreflight {
    const constraints = compileDramaAssetConstraints(project, asset, kind);
    const errors = compact([asset.name.trim() ? "" : "缺少资产名称"]);
    return errors.length ? { ok: false, errors, constraints } : { ok: true, constraints };
}

export function compileDramaAssetRefinementPrompt(project: Pick<DramaProject, "title" | "style" | "ratio" | "productionBible">, asset: DramaNamedAsset, kind: "角色" | "场景" | "道具", proposal: DramaAssetRefinementProposal, request: string) {
    const updatedAsset = { ...asset, description: proposal.updatedDescription || asset.description, profile: proposal.updatedProfile };
    return compact([
        compileDramaAssetReferencePrompt(project, updatedAsset, kind),
        `本轮调整：${request}`,
        proposal.preservedRules.length ? `必须保留：${proposal.preservedRules.join("；")}` : "",
        proposal.negativePrompt ? `负面约束：${proposal.negativePrompt}` : "",
        kind === "角色" ? "服装必须体现剧情功能、职业经历和社会身份，具有稳定识别配件；禁止通用 NPC、模板化游戏角色和无意义装饰。" : "",
    ]).join("\n");
}

function assetText(asset: DramaNamedAsset, project: DramaProject) {
    return sanitizeDramaSupplierText(
        compact([
            `${asset.name}：${asset.description}`,
            asset.profile?.visualIdentity,
            asset.profile?.styling,
            asset.profile?.colorPalette ? `色彩 ${asset.profile.colorPalette}` : "",
            asset.profile?.consistencyRules ? `固定规则 ${asset.profile.consistencyRules}` : "",
        ]).join("，"),
        project,
    );
}

function continuityLines(value?: DramaShotContinuity) {
    if (!value) return [];
    return compact([
        value.shotSize ? `景别 ${value.shotSize}` : "",
        value.cameraAngle ? `机位 ${value.cameraAngle}` : "",
        value.composition ? `构图 ${value.composition}` : "",
        value.characterBlocking ? `站位 ${value.characterBlocking}` : "",
        value.gazeDirection ? `视线 ${value.gazeDirection}` : "",
        value.screenDirection ? `运动方向 ${value.screenDirection}` : "",
        value.axisRule ? `轴线 ${value.axisRule}` : "",
        value.continuityNotes,
    ]);
}

function stateLines(value: DramaShot["entryState"], project: DramaProject) {
    if (!value) return [];
    const nameFor = (id: string) => [...project.characters, ...project.scenes, ...project.props, ...project.clues].find((asset) => asset.id === id)?.name || "当前对象";
    return compact([
        value.environment ? `环境 ${value.environment}` : "",
        value.lighting ? `灯光 ${value.lighting}` : "",
        value.axis ? `轴线 ${value.axis}` : "",
        value.screenDirection ? `屏幕方向 ${value.screenDirection}` : "",
        ...value.characters.map(
            (entity) =>
                `角色 ${nameFor(entity.assetId)}：位置${entity.position}，视线${entity.gaze}，姿态${entity.pose}，动作${sanitizeDramaSupplierText(entity.action || "保持当前状态", project)}${entity.wardrobe ? `，服装${entity.wardrobe}` : ""}${entity.expression ? `，表情${entity.expression}` : ""}`,
        ),
        ...value.props.map((entity) => `道具 ${nameFor(entity.assetId)}：${sanitizeDramaSupplierText(entity.state || "保持当前状态", project)}，由${entity.holderId ? nameFor(entity.holderId) : "环境"}持有`),
    ]);
}

export function sanitizeDramaSupplierText(value: string, project: DramaProject) {
    let result = value;
    for (const asset of [...project.characters, ...project.scenes, ...project.props, ...project.clues]) {
        if (asset.id && asset.id !== asset.name) result = result.split(asset.id).join(asset.name);
    }
    for (const shot of project.episodes.flatMap((episode) => episode.shots)) {
        if (shot.id && shot.id !== shot.title) result = result.split(shot.id).join(shot.title);
    }
    return result.replace(/\b(?:character|prop|scene|shot|frame|source|asset|continuity|storyboard|video|drama)-[A-Za-z0-9_-]{6,}\b/gi, "当前对象").replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "当前对象");
}

function manifestTarget(item: DramaReferenceManifestItem, project: DramaProject) {
    const asset = [...project.characters, ...project.scenes, ...project.props, ...project.clues].find((candidate) => candidate.id === item.assetId);
    const shot = project.episodes.flatMap((episode) => episode.shots).find((candidate) => candidate.id === item.shotId);
    return asset ? `固定资产「${asset.name}」` : shot ? `镜头「${shot.title}」` : item.role === "previous_actual_tail" ? "上一镜已验收实际尾帧" : "未解析参考对象";
}

function compact(values: Array<string | undefined>) {
    return values.map((value) => value?.trim() || "").filter(Boolean);
}
