import { SEEDANCE_25_DIRECTOR_SKILL } from "./seedance-25";
import { DRAMA_VIDEO_DIRECTOR_SKILL, resolveDramaDirectorInstructions } from "./drama-video-director";
import { DRAMA_ASSET_IMAGE_SKILL } from "@/lib/drama-image-skill";
import { DRAMA_DIALOGUE_TIMING_RULES } from "@/lib/drama-dialogue-timing";

export { SEEDANCE_25_DIRECTOR_SKILL } from "./seedance-25";
export { DRAMA_VIDEO_DIRECTOR_SKILL, resolveDramaDirectorInstructions } from "./drama-video-director";

/** Shared director layer imported from .agents/skills/drama-video-director. */
export const DRAMA_VIDEO_DIRECTOR_RULES = DRAMA_VIDEO_DIRECTOR_SKILL.instructions;
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

export const DRAMA_CONTINUOUS_FRAME_RULES = `
连续动作帧规则：按真实动作、反应、道具结果、空间揭示和摄影切换事件决定 2-9 个帧段；固定 4/5 帧只在用户主动选择时生效。每段必须有连续时间范围、起点、动作与触发、可见衔接和终点，上一段终点成为下一段起点。actionPrompt 只描述动作过程，imagePrompt 只描述对应冻结画面；不要从动作段复制静态画面正文。跨镜连续性只允许使用已验收实际尾帧作为入口依据，同镜后续帧不引用上一帧图片。`;

export const DRAMA_DIRECTOR_SCENE_RULES = `导演拆镜前置审计：每个场景先明确此刻人物欲望、阻力、空间几何、受控视线和剪辑节奏；每个镜头至少承担情绪变化、推进动作或增加压力中的一项。每个镜头至少落实一个环境压力、一个身体微动作和一个声音/视觉母题，不能只写“电影感”“紧张”或漂亮空镜。先按语速与动作节点核算时长，再完成对白容量、停顿和动作反应的可说时长核算，决定镜头边界、时间段和帧数；必须明确镜头结束时的可见结果，并在重大冲击前保留必要停顿。`;

/** Shared public layout for generic video optimization and drama video prompts. */
export const SEEDANCE_VIDEO_PROMPT_LAYOUT = `
视频提示词公开布局（只输出提示词正文，不输出 Markdown 标题、解释或内部检查）：
动态意图：一句话写主体、主要事件和视觉目标。
全局设定：只写本镜头需要持续的环境、材质和主体不变量；同时交代行动实际依赖的空间结构、通道和支撑面，不要把完整资产档案复制进来。
起始可见状态：只写首帧已经可见的主体、道具、空间和动作状态；明确人物相对座位、门窗、通道或其他出镜人物的位置、朝向与接触关系。若有上一镜实际尾帧，只继承该真实边界状态。
时间段动作：按 framePlan 的真实动作节点连续分段；每段独立成块，依次写“起点、动作与触发、可见衔接、终点”，其中“动作与触发”同时承载准备、接触/受力、结果、恢复和可观察表演反应。时间范围连续、不重叠；每段都要保留合理的身体支撑、手脚接触、人与物距离和多人相对方位，不能为追求戏剧性让人物以不可能的姿势或位置完成动作。只在动作节点需要时增加帧，不按每一秒机械切碎；每段的终点必须成为下一段的起点。
单一主运镜：每镜只保留一个有动机的景别/机位/运镜，并说明它响应的动作或信息变化。公共场景读取场景 NPC 策略：auto 按场景类型、空间容量、景别和剧情功能判断，required 必须安排合理数量范围、前中后景分布、密度和群体行为结果，forbidden 不得出现 NPC；NPC 仅是不具名背景群像，不加入主角色、锚点或独立资产，场景全景基准图保持无人。
环境压力与视觉母题：至少写一个具体环境压力，以及一个声音或视觉锚点；不要用“电影感、震撼、氛围感”等空泛词代替。
视觉风格与光色：写可执行的色板、主光方向、材质反应和风格质感，不用空泛的“高级感”。
声音意图：对白写说话人、语言、语气和短句；另写环境声、动作音、音乐或静音、字幕策略。
结束画面：写最终可见的构图、姿态、道具位置、光色或声音状态。
连续性锁：只保留身份、数量、服装、道具归属、空间方向、光向和轴线等高代价约束；多人物明确同一镜头/场景参照系下的左右、前后和视线关系，未声明人物不得入画。
针对性约束：只列本镜头最可能且重做代价高的错误；不得添加内部 ID、URL、模型/API 参数或用户未提供的剧情事实。
规则：有参考素材时只继承其声明的属性；静态图生视频只描述运动和变化，不重复整张静态图；每镜只保留一个主要变化。公开 videoPrompt 只使用本布局字段，必须由 Agent 直接完整写出每个真实时间段的时间范围、起点、动作与触发、可见衔接和终点；不要另设顶层“触发”或“主体动作与反应”字段。framePlan.frames 只是同一内容的结构化镜像。应用代码只能校验、保存和转发，禁止拼接、补写、删改或从 framePlan 生成 videoPrompt。每个非空字段必须独立一行，禁止把所有字段压成一段逗号串。`;

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
    instructions: `以短剧生产工作流执行。按改编大纲、资产清单、剧本节拍、分镜、图片关键帧、视频提示词和审查的阶段顺序推进；每一阶段只修改自己的事实，不建立并行的文件或提示词真相。先核对主题、受众、冲突、角色、场景、道具、叙事节奏和集长。${DRAMA_DIRECTOR_SCENE_RULES}${DRAMA_DIALOGUE_TIMING_RULES}每个镜头必须有唯一戏剧职责、画面主体、对白/旁白、时长、景别、机位、声音、可见起点和终点，并通过稳定资产 ID 绑定角色、场景、道具和关键帧。对白和旁白可以不写进静态图片，但其可见后果必须进入对应帧；相邻帧必须有真实状态差异，禁止复制整镜提示词后只追加“起始/展开/结果”。${DRAMA_CONTINUOUS_FRAME_RULES}生成前展示准确的任务、参考和参数，付费生产等待用户明确确认；不要跳过结构分析，也不要在用户未明确要求时创建 Canvas 或短剧项目。`,
} as const;

/**
 * Vetted through the GitHub Skill import contract. This is the mandatory
 * default for drama; the server-side continuity policy still runs separately.
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
    instructions: `这是 prompt-authoring-only 的字段级质量层，不生成第二套提示词，也不把本规则原文附加到供应商请求。按 Seedance 2.0 多模态短剧工作流执行。把长故事视为有入口、出口和连续性边界的镜头序列，而不是互不相关的提示词；先锁定镜头职责、时长、入口状态、出口状态、屏幕方向、轴线和每张参考图的唯一用途。每个镜头先从场景资产推演实际可用的座位、长凳、地面、通道、门窗、隔断和遮挡，再给每个实际出镜角色确定同一参照系下的位置、朝向、视线、支撑/接触对象与相对关系；坐姿必须落在可见座位或其他合理支撑面，封闭车厢内惊醒的人应坐在明确一侧长凳或座位而不是中央过道。多人必须写明彼此左右/前后和视线关系；没有原文或资产依据的人物不得补入画面。项目资产表中的角色名是正式业务事实，不得因为与 reference、ref 等英文缩写相似而改名、删除或当作内部占位符；已登记但本集/本镜不出镜的角色仍须保留在资产档案，并明确不得进入本集参考图请求。当前镜头只把实际出镜角色写入 characterCodes 和 referenceManifest；供应商提示词表达不出镜角色时，同时写角色名的不出镜约束和可观察画面限制，不得只写含义不清的“无可辨识的角色名”。参考图按角色、场景、道具、构图、首帧、尾帧或关键帧分工，@图片/@视频/@音频只表达用途，实际编号、顺序和 URL 由服务端绑定，提示词不得重复伪造参考清单。公开视频 Prompt 固定按动态意图、全局设定、起始可见状态、时间段动作、单一主运镜、环境压力与视觉母题、视觉风格与光色、声音意图、结束画面、连续性锁和针对性约束组织；不另设顶层触发或主体动作字段，动作与触发、准备/受力/结果/恢复和次级反应都写在对应时间段内。人物情绪必须转成每个时间段可观察的眉眼、嘴角、下颌、视线、呼吸、手部或身体变化，禁止只写“电影感”“表情自然”“情绪丰富”等抽象词。只有上一镜当前视频版本且已人工验收的实际尾帧可以承担下一镜 first_frame；不得复制组内首镜起始状态，也不得引用旧分镜、旧任务或失效素材。用户明确的尺寸、比例、质量、时长和参考模式优先，不能擅自改选；每次返修只改变一个已定位变量，并保留已验收状态与引用。`,
} as const;

export const DEFAULT_CREATIVE_SHORTCUT_SKILLS = [CHARACTER_DESIGN_SKILL, IMAGE_MOTION_SKILL, DRAMA_PLANNING_SKILL, SEEDANCE_DIRECTOR_SKILL, SEEDANCE_25_DIRECTOR_SKILL, DRAMA_ASSET_IMAGE_SKILL] as const;
