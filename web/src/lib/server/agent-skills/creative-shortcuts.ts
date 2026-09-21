import { SEEDANCE_25_DIRECTOR_SKILL } from "./seedance-25";
import { DRAMA_VIDEO_DIRECTOR_SKILL, resolveDramaDirectorInstructions } from "./drama-video-director";
import { DRAMA_ASSET_IMAGE_SKILL } from "@/lib/drama-image-skill";
import { DRAMA_DIALOGUE_TIMING_RULES } from "@/lib/drama-dialogue-timing";

export { SEEDANCE_25_DIRECTOR_SKILL } from "./seedance-25";
export { DRAMA_VIDEO_DIRECTOR_SKILL, resolveDramaDirectorInstructions } from "./drama-video-director";

/** Canonical project director layer compiled from .agents/skills/drama-video-director. */
export const DRAMA_PACKAGE_DIRECTOR_RULES = resolveDramaDirectorInstructions("package");
export const DRAMA_STATIC_FRAME_DIRECTOR_RULES = resolveDramaDirectorInstructions("static-frame");
export const DRAMA_VIDEO_PROMPT_DIRECTOR_RULES = resolveDramaDirectorInstructions("video");
export const DRAMA_EXTERNAL_CODEX_DIRECTOR_RULES = resolveDramaDirectorInstructions("external-codex");

export const CHARACTER_DESIGN_SKILL = {
    id: "character-design",
    name: "角色设定",
    description: "建立可持续复用的角色外观、服装、精细五官和四视图设定。",
    enabled: true,
    workspaces: ["image", "canvas"],
    action: "generate",
    requiresReference: false,
    defaultConfig: { quality: "high", count: 4 },
    keywords: ["角色设定", "角色设计", "人物设定", "角色图", "人物立绘", "多视图", "角色表"],
    instructions: `以角色设定工作流执行。先锁定身份、年龄、体态、脸部特征、发型轮廓、服装结构、材质、配色、关键道具和情绪范围，再生成一张白底四视图角色基准板：身份特写、正面全身、严格左侧面全身、背面全身。身份特写只负责精细五官与脸部识别，后三个全身视图负责比例、服装层次和背面结构；四个视图必须是同一角色，不能加入四分之三视图、主立绘、表情组或拆解图。每张图先明确用途和参考图控制范围；身份、比例、服装结构、发型轮廓、关键道具和色彩锚点必须跨视图保持一致。角色板只承载当前设定事实，不把安装说明、供应商参数或说明文字画进图片。后续修改使用 change/preserve/constraints，只改一个已定位变量，明确保留脸部、服装、姿态、构图和光线中不变的部分。所有成功结果都保留为独立候选，不因只需要一张主图而丢弃其他结果；不要随意改变种族、年龄、服装或脸部特征，也不要把多个视图生成成不同的人。`,
} as const;

export const IMAGE_MOTION_SKILL = {
    id: "image-motion",
    name: "图片动效",
    description: "把静态画面转成主体稳定、动作自然的短视频。",
    sourceUrl: "https://github.com/ArcReel/ArcReel",
    sourceVersion: "1.0.0",
    license: "MIT",
    enabled: true,
    workspaces: ["video"],
    action: "edit",
    requiresReference: true,
    defaultConfig: { videoSeconds: 5, vquality: "480" },
    keywords: ["图片动效", "图生视频", "图片转视频", "动效", "动画", "镜头推进", "首帧"],
    instructions: `以图生视频工作流执行。必须使用用户提供的参考图作为主体和首帧，并先说明每张参考图只控制身份、场景、构图或道具中的哪一项。公开视频 Prompt 按“动态意图、全局设定、起始可见状态、时间段动作、单一主运镜、环境压力与视觉母题、视觉风格与光色、声音意图、结束画面、连续性锁、针对性约束”组织；不另设顶层触发或主体动作字段，动作与触发、准备/受力/结果/恢复和次级反应都写在对应时间段内。只规划一个主要变化，保持人物、商品、场景、构图、色彩和文字位置稳定。动作前先核对场景中的座位、支撑面、通道、门窗和遮挡；人物位置、姿势、手脚接触、人与物距离及多人左右/前后关系必须符合现实，未声明人物不得入画。时长、比例和清晰度遵循用户与服务端配置，不在 Skill 中猜测供应商字段。避免新增人物、改变主体身份、重绘商品 Logo、过度运动、闪烁、瞬移、变形和无叙事理由的场景切换。失败重试只修改一个已定位变量，并保留已经通过验收的参考图与状态。`,
} as const;

export const DRAMA_DIRECTOR_SCENE_RULES = `导演拆镜前置审计：每个场景先明确此刻人物欲望、阻力、空间几何、受控视线和剪辑节奏；每个镜头至少承担情绪变化、推进动作或增加压力中的一项。每个镜头至少落实一个环境压力、一个身体微动作和一个声音/视觉母题，不能只写“电影感”“紧张”或漂亮空镜。先按语速与动作节点核算时长，再完成对白容量、停顿和动作反应的可说时长核算，决定镜头边界、时间段和帧数；必须明确镜头结束时的可见结果，并在重大冲击前保留必要停顿。`;

export const DRAMA_PLANNING_SKILL = {
    id: "drama-planning",
    name: "短剧策划",
    description: "从主题到角色、场景和分镜，整理可继续生产的短剧方案。",
    sourceUrl: "https://github.com/ArcReel/ArcReel",
    sourceVersion: "1.0.0",
    license: "MIT",
    enabled: true,
    workspaces: ["image", "video", "drama"],
    action: "generate",
    requiresReference: false,
    defaultConfig: { count: 1, videoSeconds: 5 },
    keywords: ["短剧策划", "短剧", "剧本", "分镜", "剧集", "镜头", "故事板"],
    instructions: `以短剧生产工作流执行。按改编大纲、资产清单、剧本节拍、分镜、图片关键帧、视频提示词和审查的阶段顺序推进；每一阶段只修改自己的事实，不建立并行的文件或提示词真相。先核对主题、受众、冲突、角色、场景、道具、叙事节奏和集长。${DRAMA_DIRECTOR_SCENE_RULES}${DRAMA_DIALOGUE_TIMING_RULES}每个镜头必须有唯一戏剧职责、画面主体、对白/旁白、时长、景别、机位、声音、可见起点和终点，并通过稳定资产 ID 绑定角色、场景、道具和关键帧。对白和旁白可以不写进静态图片，但其可见后果必须进入对应帧；相邻帧必须有真实状态差异，禁止复制整镜提示词后只追加“起始/展开/结果”。生成前展示准确的任务、参考和参数，付费生产等待用户明确确认；不要跳过结构分析，也不要在用户未明确要求时创建 Canvas 或短剧项目。`,
} as const;

/**
 * Legacy compatibility alias for older requests. It is intentionally not part
 * of DEFAULT_CREATIVE_SHORTCUT_SKILLS; new drama authoring uses the canonical
 * project director and the Seedance 2.5 adapter.
 */
export const SEEDANCE_DIRECTOR_SKILL = {
    id: "seedance-director",
    name: "Seedance 导演",
    description: "为 Seedance 多镜头连续视频规划镜头、参考角色、续接和单变量返修。",
    plannerSummary: "为短剧镜头明确参考角色、连续性锚点、首尾帧与返修范围。",
    sourceUrl: "https://github.com/LeoYeAI/seedance-skills/blob/797e16efaa3c5ac01c0e391d0b8466a87cc5aadc/SKILL.md",
    sourceRepository: "LeoYeAI/seedance-skills",
    sourcePath: "SKILL.md",
    sourceVersion: "797e16efaa3c5ac01c0e391d0b8466a87cc5aadc",
    sourceCommit: "797e16efaa3c5ac01c0e391d0b8466a87cc5aadc",
    sourceContentHash: "8cbc9b6d27460f5ef3ff8313ecf506650c006be4979274ec63aea0aade9e3d25",
    license: "MIT",
    enabled: true,
    workspaces: ["drama"],
    action: "generate",
    requiresReference: false,
    defaultConfig: { videoSeconds: 5 },
    keywords: ["Seedance", "短剧导演", "连续性", "首尾帧", "镜头续接", "返修"],
    instructions: `这是 prompt-authoring-only 的字段级质量层，不生成第二套提示词，也不把本规则原文附加到供应商请求。按 Seedance 多模态短剧工作流执行：先锁定镜头职责、时长、入口/出口状态、屏幕方向、轴线和每张参考图的唯一用途，明确支撑面、接触关系、左右/前后和视线方向。短剧公开视频 Prompt 统一使用小墨 6.3 简镜头卡；内部 framePlan、表演、连续性和对白游标保留严格结构化字段，不把旧版十二字段或起点/动作/衔接/终点标签复制到公开正文。素材 alias、顺序和 URL 由服务端绑定，提示词不得伪造参考清单；只有当前已人工验收的实际尾帧可以承担下一镜 first_frame。画幅、尺寸、质量、时长和参考模式服从用户及服务端配置，镜头数量和硬切次数按可见信息自适应；每次返修只改变一个已定位变量，并保留已验收状态与引用。`,
} as const;

/**
 * seedance-director remains only as a legacy production-plan identifier.
 * It is not an active prompt source; all drama authoring uses the canonical
 * project director plus the Seedance 2.5 adapter when a video is generated.
 */
export const DEFAULT_CREATIVE_SHORTCUT_SKILLS = [CHARACTER_DESIGN_SKILL, IMAGE_MOTION_SKILL, DRAMA_PLANNING_SKILL, DRAMA_VIDEO_DIRECTOR_SKILL, SEEDANCE_25_DIRECTOR_SKILL, DRAMA_ASSET_IMAGE_SKILL] as const;
