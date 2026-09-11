import type { DramaDialoguePerformance, DramaPerformancePlan } from "@/lib/drama-project-contract";

const GENERIC_DETAIL_PATTERNS = [
    /^表情(?:自然|丰富|到位|稳定)$/u,
    /^情绪(?:自然|丰富|到位|稳定|逐步变化)$/u,
    /^(?:动作|反应|状态|表演)(?:自然|丰富|到位|稳定|合理|清晰)$/u,
    /^根据(?:动作|情绪|剧情|现场)(?:变化|推进|发展)$/u,
    /^适当(?:变化|调整|反应)$/u,
    /^保持(?:稳定|自然|一致|原状|当前状态)$/u,
    /^沿当前(?:动作|镜头|叙事)方向$/u,
    /^完成主要动作(?:并保留反应停顿)?$/u,
    /^指向下一动作或转场方向$/u,
    /^说话时保持与行动一致的面部反应$/u,
    /^先以视线和眉眼确认对方或关键道具$/u,
    /^说完保留短暂反应，衔接下一动作$/u,
    /^推动当前镜头行动并回应对手或环境$/u,
];
const CONCRETE_CAMERA_PATTERN = /固定机位|推(?:进|近|镜)|拉(?:远|镜)|摇镜|横移|跟拍|滑轨|环绕|吊臂|升降|手持|变焦|俯拍|仰拍|平视|低机位|高机位|中景|近景|特写|远景/u;

export function isGenericDramaDetail(value: unknown) {
    const text = typeof value === "string" ? value.trim() : "";
    return !text || GENERIC_DETAIL_PATTERNS.some((pattern) => pattern.test(text));
}

export function validateDramaPerformanceDetail(plan: DramaPerformancePlan | undefined, dialogue: DramaDialoguePerformance[] | undefined, dialogueCount = 0, label = "镜头") {
    const errors: string[] = [];
    if (!plan) return [`${label}缺少表演计划`];
    const scalarFields: Array<[string, string | undefined]> = [
        ["情绪目标", plan.emotionalObjective],
        ["情绪递进", plan.emotionalArc],
        ["说话方式", plan.speechStyle],
        ["节奏", plan.pace],
        ["呼吸", plan.breath],
        ["克制度", plan.restraintLevel],
    ];
    for (const [name, value] of scalarFields) if (isGenericDramaDetail(value)) errors.push(`${label}${name}过于笼统`);
    for (const [name, beat] of [
        ["起始", plan.beats.start],
        ["中段", plan.beats.middle],
        ["结束", plan.beats.end],
    ] as const) {
        for (const [field, value] of [
            ["情绪", beat.emotion],
            ["面部动作", beat.facialAction],
            ["视线", beat.gaze],
            ["身体/手部动作", beat.bodyAction],
        ] as const)
            if (isGenericDramaDetail(value)) errors.push(`${label}${name}${field}缺少具体可见结果`);
    }
    if (dialogueCount > 0 && (!dialogue || dialogue.length < dialogueCount)) errors.push(`${label}对白缺少逐句表演指导`);
    for (const [index, item] of (dialogue || []).entries()) {
        const fields: Array<[string, string | undefined]> = [
            ["意图", item.intent],
            ["语气", item.tone],
            ["节奏", item.pace],
            ["停顿", item.pause],
            ["重音", item.emphasis],
            ["说前反应", item.facialReactionBefore],
            ["说中反应", item.facialReactionDuring],
            ["说后反应", item.facialReactionAfter],
        ];
        for (const [name, value] of fields) if (isGenericDramaDetail(value)) errors.push(`${label}第${index + 1}句${name}缺少具体表演结果`);
    }
    return errors;
}

export function validateDramaFrameDetail(value: unknown, label: string) {
    return isGenericDramaDetail(value) ? `${label}缺少具体可见动作或状态` : "";
}

export function hasConcreteDramaCameraDirection(value: unknown) {
    return typeof value === "string" && CONCRETE_CAMERA_PATTERN.test(value.trim());
}
