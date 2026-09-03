export type Seedance25VideoPromptRoute = "basic-multimodal" | "timestamp-30s" | "long-video" | "video-extension" | "video-edit" | "clay-renderer" | "seamless-transition" | "multi-grid-storyboard";

export type Seedance25VideoPromptReferenceInput = {
    prompt?: string;
    durationSeconds?: number;
};

const ROUTE_REFERENCES: Record<Seedance25VideoPromptRoute, string> = {
    "basic-multimodal": `本次加载参考：普通视频。
15 或 20 秒镜头默认使用阶段节拍与可见结束状态，不机械逐秒拆分。先绑定每份参考素材的唯一职责，再写起始状态、一个主要动作链、一个有动机的主运镜、声音意图和可验证结束画面；多个事件只能在动作因果和表演时长允许时连续出现。`,
    "timestamp-30s": `本次加载参考：30 秒精确时间轴。
时间段从 0 秒连续覆盖到 30 秒，不重叠、不留空。每段按“起点 → 动作与触发 → 可见衔接 → 终点”写，前一段终点必须成为下一段起点；先减少事件密度，再写时间码。对白、停顿、反应和动作必须有足够的真实表演时间，禁止逐秒堆叠镜头或让多个关键事件挤在同一秒。`,
    "long-video": `本次加载参考：长视频。
按幕和序列组织，不罗列大量微镜头。每个序列写入口状态、主要事件、可见出口状态和与下一序列的连续性锁；长视频的身份、服装、空间方向、光向、声音母题和道具归属必须贯穿所有序列。`,
    "video-extension": `本次加载参考：视频续写。
必须明确新增片段放在源视频之前还是之后、添加时长和衔接边界。前置续写以源视频首帧为新增区间终点，后置续写以源视频尾帧为新增区间起点；只描述新增画面，保留原片内容、摄影机、光线、声音和空间关系，禁止无原因重置人物、道具或场景。`,
    "video-edit": `本次加载参考：视频编辑。
明确编辑位置或时间、目标对象、add/remove/replace/change 操作和 preserve 列表。未被点名的身份、服装、构图、动作、声音、字幕、背景和镜头运动保持不变；不要把局部编辑扩展成整段重生成。`,
    "clay-renderer": `本次加载参考：白模控制。
粗白模只继承走位、镜头、节奏、空间和动作关系；细白模可以继承构图和材质变化。最终画面必须移除轨迹线、坐标轴、相机锥体、灰模材质和辅助标记，并为每个主体补足最终身份、服装、环境、材质和光线。`,
    "seamless-transition": `本次加载参考：无缝转场。
两段源视频保持不变，只生成中间桥接段。明确连接物的形状、位置、比例、方向、速度、运动趋势、摄影机连续性和视觉变形；转场终点必须自然落到第二段的入口状态。`,
    "multi-grid-storyboard": `本次加载参考：多宫格分镜。
每个格子是有序的完整镜头，不把分镜编号、边框、箭头或说明渲染进最终视频。按面板顺序锁定镜头的主体、场景、动作、机位和连续关系；只有需要独立补拍时才拆成首尾帧镜头对。`,
};

const REALISTIC_DIRECTION_RE = /真人|人物|角色|对话|台词|口型|情感|情绪|表演|情侣|访谈|综艺|体育|运动员/iu;
const MULTI_CHARACTER_RE = /多人|两人|双人|三人|四人|群像|对手|彼此|对话|会议|餐桌|车内/iu;
const EXAMPLE_STRUCTURE_RE = /参考(?:结构|示例|镜头)|参考\s*@?(?:图片|视频|音频)|模仿|复刻|参照/iu;
const FAILURE_DIAGNOSIS_RE = /失败|翻车|漂移|变形|模糊|错位|不一致|不符合|重试|修复/iu;

function conditionalReferences(prompt: string) {
    const references: string[] = [];
    if (REALISTIC_DIRECTION_RE.test(prompt))
        references.push(`附加参考：真人表演与对白。
先写角色在本镜的目标、阻力和策略，再写可见行为。对白必须标明说话人、语言、语气和短句；听者的反应只能发生在听到信息之后。情绪转为眉眼、嘴角、下颌、视线、呼吸、手部、重心和人与人距离的变化，避免用“自然表情”“情绪丰富”等空词替代。`);
    if (MULTI_CHARACTER_RE.test(prompt))
        references.push(`附加参考：多人物空间调度。
所有出镜人物使用同一场景参照系，明确左右/前后、朝向、视线、座位或支撑面、接触对象、道具归属和发言顺序。摄影机轴线、屏幕方向和人物距离连续；未声明的人物不入画，不能为了戏剧性制造悬空姿势、穿模动作或不可能的接触关系。`);
    if (EXAMPLE_STRUCTURE_RE.test(prompt))
        references.push(`附加参考：示例结构迁移。
只能继承用户明确指定的层级、时间粒度、镜头语法、节奏或动作因果；示例中的人物身份、品牌、台词、背景、文字、水印、音乐和未声明剧情不得迁移。先列出继承维度，再用当前用户素材和项目事实重写。`);
    if (FAILURE_DIAGNOSIS_RE.test(prompt))
        references.push(`附加参考：失败诊断。
先定位第一个失败层：身份、参考职责、构图、动作因果、物理、时间、音频或连续性。只修复该层的一个变量，保留已验收的身份、资产、空间轴线和声音规则；不要整段重写、追加互相冲突的否定词或重复提交同一请求。`);
    return references;
}

export function resolveSeedance25VideoPromptRoute(input: Seedance25VideoPromptReferenceInput): Seedance25VideoPromptRoute {
    const prompt = input.prompt || "";
    if (/(?:智能|高级|局部)?编辑|替换|移除|删除|保留原片|change\s*\/\s*preserve/iu.test(prompt)) return "video-edit";
    if (/续写|延长|接着拍|接续|扩展|prepend|append/iu.test(prompt)) return "video-extension";
    if (/白模|clay(?:\s*renderer)?|blockout/iu.test(prompt)) return "clay-renderer";
    if (/无缝转场|两段视频|桥接(?:片段)?|seamless\s*transition/iu.test(prompt)) return "seamless-transition";
    if (/多宫格|分镜板|故事板|storyboard\s*grid/iu.test(prompt)) return "multi-grid-storyboard";
    if (/长视频|超长|long\s*video/iu.test(prompt) || (input.durationSeconds || 0) > 30) return "long-video";
    return input.durationSeconds === 30 ? "timestamp-30s" : "basic-multimodal";
}

export function resolveSeedance25VideoPromptReferences(input: Seedance25VideoPromptReferenceInput) {
    const route = resolveSeedance25VideoPromptRoute(input);
    return { route, instructions: [ROUTE_REFERENCES[route], ...conditionalReferences(input.prompt || "")].join("\n\n") };
}

export function inferSeedance25VideoDuration(prompt: string) {
    const values = Array.from(prompt.matchAll(/(?:^|[^\d])(\d{1,3})\s*(?:秒|s)(?!\w)/giu), (match) => Number(match[1])).filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? values.at(-1) : undefined;
}
