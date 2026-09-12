/** Shared public prompt contracts used by package generation and single-shot optimization. */
export const DRAMA_PUBLIC_VIDEO_PROMPT_CONTRACT = `
视频公开合同（Seedance 2.5）：素材绑定（有素材时）、动态意图、全局设定、起始可见状态、时间段动作、单一主运镜、环境压力与视觉母题、视觉风格与光色、声音意图、结束画面、连续性锁、针对性约束。每个非空字段必须独立成行；时间段动作必须按真实帧段逐块写出时间范围、起点、动作与触发、可见衔接和终点，且与 framePlan.frames 逐字镜像。不得新增顶层触发或主体动作与反应字段，不得输出内部规划、Skill、模式、ID、URL 或解释文字。`;
