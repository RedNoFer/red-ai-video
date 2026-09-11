/** Shared public prompt contracts used by package generation and single-shot optimization. */
export const DRAMA_PUBLIC_STATIC_FRAME_PROMPT_CONTRACT = `
静态帧公开合同（Seedance 2.0）：静态关键帧、可见状态、可见表演状态、景别、机位与构图、站位与视线、三层空间、光色与风格、负面约束。每个非空字段必须独立成行；只描述一个已经冻结的可见画面，必须写出当前主体、姿态或道具/环境状态和具体表演结果。正向字段禁止运镜、焦段、时间段、动作过程、对白、声音、参考图职责、内部 ID、URL 或解释文字；负面约束字段可以明确列出无运镜过程、无对白和无声音指令。参考素材用途只由 referenceManifest 和服务端绑定承载。`;

export const DRAMA_PUBLIC_VIDEO_PROMPT_CONTRACT = `
视频公开合同（Seedance 2.5）：素材绑定（有素材时）、动态意图、全局设定、起始可见状态、时间段动作、单一主运镜、环境压力与视觉母题、视觉风格与光色、声音意图、结束画面、连续性锁、针对性约束。每个非空字段必须独立成行；时间段动作必须按真实帧段逐块写出时间范围、起点、动作与触发、可见衔接和终点，且与 framePlan.frames 逐字镜像。不得新增顶层触发或主体动作与反应字段，不得输出内部规划、Skill、模式、ID、URL 或解释文字。`;

export const DRAMA_PUBLIC_SHOT_PROMPT_CONTRACT = `${DRAMA_PUBLIC_STATIC_FRAME_PROMPT_CONTRACT}\n${DRAMA_PUBLIC_VIDEO_PROMPT_CONTRACT}`;
