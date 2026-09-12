import { DRAMA_DIRECTOR_SCENE_RULES, DRAMA_PACKAGE_DIRECTOR_RULES } from "./agent-skills/creative-shortcuts";
import { DRAMA_DIALOGUE_TIMING_RULES } from "@/lib/drama-dialogue-timing";
import { DRAMA_PUBLIC_VIDEO_PROMPT_CONTRACT } from "@/lib/drama-public-prompt-contract";

/** Single source of truth for Agent-generated vozeb-drama-production-package-v1 output. */
export const DRAMA_PACKAGE_ARCHITECTURE_RULES = `
${DRAMA_PUBLIC_VIDEO_PROMPT_CONTRACT}
制作包协议：vozeb-drama-production-package-v1。返回可解析的完整制作包对象和对应 Markdown；保留 project、assets、episodes、seriesBible、archive，以及每镜的镜头事实、continuity、performancePlan、lightingPlan、entryState、exitState、videoPrompt 和 framePlan。
framePlan.frames 只保留 id、sequenceIndex、startSecond、endSecond、startPrompt、actionPrompt、transitionPrompt、endPrompt、imagePrompt。actionPrompt、transitionPrompt、startPrompt、endPrompt 服务视频时间段；imagePrompt 是唯一静态画面事实源，遵循上方静态帧 Skill，不能从动作、镜头描述、资产档案、NPC 策略或相邻帧重建。静态 imagePrompt、startFramePrompt、endFramePrompt 和 framePlan.frames[].imagePrompt 只做轻量格式化、校验、保存和转发，参考图职责只由 referenceManifest 与最终执行层绑定承载一次。
productionBible.productionPlan.visual 必须包含 visualStyle、artStyle 和 source；video.shotDuration 只接受 15 或 30 秒；framePolicy 为 fixed-4、fixed-5 或 agent。视频 videoPrompt 必须由 Agent 直接生成，framePlan.frames 是结构化镜像，运行时不得拼接、补写或重写。
${DRAMA_DIALOGUE_TIMING_RULES}
${DRAMA_DIRECTOR_SCENE_RULES}
${DRAMA_PACKAGE_DIRECTOR_RULES}
已有资产按稳定 code 复用，场景全景图保持高清、无人、无文字的单视角全景。背景 NPC 只按场景策略写入实际镜头帧或视频时间段，不进入 characterCodes、角色锚点或独立资产。对白时长仅生成提醒。
`;
