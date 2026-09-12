import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const sourcePath = process.argv[2] || "/Users/a1/Desktop/2.txt";
const sourceRaw = fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/u, "");
const sourceHash = createHash("sha256").update(sourceRaw, "utf8").digest("hex");
const basePath = path.join(repoRoot, "output", "three-year-pact-standalone-production-package-30s.json");
const outputBase = path.join(repoRoot, "output", "xiao-yan-fresh-blood-contract-production-package-30s");

const visualStyle =
    "东方玄幻修仙世界以高精度 3D 半写实国漫电影质感呈现：仙门殿宇、云海山崖、灵气与法阵构成具有真实尺度和空气透视的东方幻想空间，画面宏阔却保留可触摸的材质细节。人物采用自然克制的 CG 建模，脸部保留真实皮肤微纹理、细碎绒毛与柔和骨相起伏，避免过度磨皮和玩偶式塑料感；发丝需呈现分束、受风与逆光透亮的层次。锦缎、薄纱、鎏金金属、珍珠、玉石、木石与法器均按照具有磨损、透光、粗糙度和反射差异的 PBR 逻辑表现。整体以清冷青白月光、低饱和黛青山色和局部暖金法光建立色彩层次，辅以体积雾、浮尘、灵气粒子和电影级景深，确保角色、服装、环境与特效在全剧中共享统一的光色、材质和真实感标准。避免廉价游戏渲染、荧光高饱和、扁平卡通贴图、过强锐化和脱离场景光源的特效高光。";
const negativePrompt = "无字幕、无水印、无 logo、无 HUD、无现代元素、无额外主角、无额外肢体、无换脸、无空间漂移、无塑料皮肤、无廉价游戏渲染、无荧光高饱和、无扁平卡通贴图、无过强锐化、无脱离场景光源的特效高光；允许且仅允许场景策略要求的无名背景 NPC";
const npcPolicy = {
    mode: "required",
    guidance:
        "每镜安排 6 名无名萧家旁系、执事或年轻族人作为旁听群像：前景 1 名靠柱或桌沿形成轻微框景，中景 3 名分置长桌两侧，后景 2 名靠墙或南门内侧；群像只做收声旁听、交换眼神、受桌拍惊动、因‘莫欺少年穷’抬眼和血手休证后屏息后退，不说话、不与主角发生未声明接触、不抢主角脸部与手部焦点，不进入 characterCodes 或独立角色资产。",
    continuity: "全剧保持 6 名左右的低密度旁听群像和相同前中后景分布；背景 NPC 只沿墙边、桌侧和门侧移动，不穿越萧炎—纳兰嫣然的主通道，不改变 180 度轴线。场景全景基准图保持无人，NPC 只写入镜头关键帧和视频时间段。",
};

const value = JSON.parse(fs.readFileSync(basePath, "utf8"));
const renamed = JSON.parse(JSON.stringify(value).replace(/SH(\d{2})/gu, "NP$1"));

renamed.project.title = "萧家血契·少年誓约（全新独立制作包）";
renamed.project.summary = "依据附件 2.txt 单独重编的全新短剧制作包；13 个 30 秒逻辑镜头，总时长 390 秒，采用 Seedance 2.5 精确时间轴、自适应片段帧和多 NPC 群像调度。原有制作包不参与本包数据。";
renamed.project.style = "东方玄幻修仙世界／高精度 3D 半写实国漫电影质感／PBR 材质";
renamed.project.ratio = "9:16";
renamed.project.productionBible.targetDuration = 390;
renamed.project.productionBible.ratio = "9:16";
renamed.project.productionBible.visualStyle = visualStyle;
renamed.project.productionBible.globalNegativePrompt = negativePrompt;
renamed.project.productionBible.colorScript = "冷青白与低饱和黛青大厅 → 南门局部暖金 → 少年反击时压低饱和度并提高面部对比 → 血手成立时短暂受控血红 → 父子信任与离场回到青白和暖金交界";
renamed.project.productionBible.soundBible = "萧家大厅短混响、南门白日风声、古琴与箫低声铺底；对白按约 5 字/秒核算，旁听群像只保留轻微衣料与呼吸，桌拍、纸张、短剑、血印和脚步承担动作节点。";
renamed.project.productionBible.productionPlan.skills = [
    { id: "seedance-director", name: "Seedance 导演", version: "2.0" },
    { id: "drama-video-director", name: "短剧视频导演", version: "1.1.0" },
    { id: "drama-asset-image-director", name: "短剧资产图片导演", version: "1.0.0" },
    { id: "seedance-25-director", name: "Seedance 2.5 导演", version: "ad0e68ba6ce24fb9ae9c67c9276061cef37663f1" },
];
renamed.project.productionBible.productionPlan.visual = {
    visualStyle,
    artStyle: "高精度 3D 半写实国漫电影质感，真实皮肤微纹理、分束发丝、PBR 木石锦缎金属和电影级空气透视",
    visualDirection: visualStyle,
    source: "manual",
};
renamed.project.productionBible.productionPlan.video = {
    ...renamed.project.productionBible.productionPlan.video,
    model: "seedance-2.5-c1",
    mode: "storyboard",
    ratio: "9:16",
    resolution: "720p",
    durationPolicy: "shot",
    shotDuration: 30,
    framePolicy: "agent",
    count: 1,
    audioMode: "native",
    allowExplicitFallback: false,
    modelParameters: {},
};
renamed.project.productionBible.productionPlan.frameCountRange = { min: 2, max: 9 };
renamed.project.productionBible.productionPlan.references = {
    strategy: "adaptive",
    minImages: 3,
    maxImages: 30,
    roles: ["previous_actual_tail", "character_anchor", "scene_anchor", "prop_anchor", "action_keyframe", "composition_keyframe"],
};
renamed.project.productionBible.productionPlan.continuity = { mode: "strict", requireAcceptedActualTail: true };
renamed.project.productionBible.productionPlan.customDirectorRules = `${npcPolicy.guidance}${npcPolicy.continuity}`;
renamed.project.productionBible.productionPlan.source = "package";
renamed.project.productionBible.subtitleSafeArea = "字幕只在后期加入，位于画面底部安全区，不写入参考图和静态帧。";

const location = renamed.assets.locations.find((item) => item.code === "S01");
if (!location) throw new Error("新制作包缺少 S01 场景资产");
location.backgroundNpcPolicy = npcPolicy;
location.profile.consistencyRules = `${location.profile.consistencyRules}；${npcPolicy.continuity}`;
location.profile.stateRules = ["南门入口保持白日暖金主光", "人物不穿越 180 度轴线", "场景全景基准图无人", "镜头群像保持 6 名左右低密度旁听者"];

const episode = renamed.episodes[0];
episode.code = "E01-FRESH";
episode.title = "血契回响·三年誓约";
episode.sourceRange = `独立读取：${path.basename(sourcePath)}；SHA-256 ${sourceHash}`;
episode.script = sourceRaw.trim();
episode.outline = "退婚压力落入萧家大厅 → 纳兰提出三年云岚宗挑战 → 萧战护子、萧炎反击并接下约定 → 赌约加码与血手休证 → 父子立誓、少年离场；旁听群像以受压与反应强化家族公共审判感。";
episode.hook = "六名旁听者无声围观少年受辱，萧炎却用一次血手印把退婚写成逐出对方的宣告。";
episode.nextPreview = "三年后云岚宗再会；今日大厅里被压低的目光，将在公开挑战中兑现。";

for (const scene of episode.storyScenes) {
    scene.summary = `${scene.summary} 旁听群像只作为无名背景反应，保持 6 名左右的低密度前中后景分布。`;
}

const npcMoments = [
    "6 名无名旁听者：前景 1 名贴近柱影，中景 3 名分列桌侧，后景 2 名靠墙；他们压低呼吸，目光在萧炎、纳兰与萧战之间往返，但不发声。",
    "6 名无名旁听者保持原位；纳兰看向萧战时，中景两人交换短促眼神，后景一人把袖口收紧，群像的沉默让约定更像公开审判。",
    "桌拍触发时，6 名旁听者同时收肩：前景者扶住桌沿，中景三人向后半步，后景两人抬眼看向萧战；不越过主通道。",
    "纳兰逼问选择时，6 名旁听者不靠近主角；中景一人从萧炎移开视线又重新看回，前景轮廓保持虚焦，后景两人把身体贴向墙侧。",
    "萧炎说出旧日天赋时，6 名旁听者出现不同步但克制的反应：两人抬眼、两人垂眸、两人保持屏息，形成被事实刺中的公共空间。",
    "‘莫欺少年穷’落下时，6 名旁听者同时把视线投向萧炎；前景者手指停在桌沿，中景三人肩线抬起，后景两人短暂离开墙面又停住。",
    "赌约加码时，6 名旁听者退到桌侧与墙边的安全位置；一人看向纳兰，一人看向萧炎的笔，其他人压低下颌，形成无声催促。",
    "萧炎落笔后，6 名旁听者围绕桌案保持距离；中景三人只看纸面与短剑，前景者收回手，后景两人屏住呼吸，不把动作变成围观主角。",
    "短剑划过左掌后，6 名旁听者同步后撤半步；一人捂住嘴但不出声，两人盯住血口，三人看向宣纸，血印未出现前不新增血迹。",
    "血手印成立时，6 名旁听者集体静止：前景者的手停在半空，中景三人瞪大眼后收住表情，后景两人向南门暖光方向偏头；不遮挡契约。",
    "萧炎把血契砸回桌面后，6 名旁听者沿墙侧保持退让；两人看纳兰、两人看萧炎、两人看萧战，短暂的视线分裂凸显关系反转。",
    "萧炎跪向萧战时，6 名旁听者自动让出中央通道；前景者垂眸，中景三人收肩，后景两人看向萧战的托扶动作，保持不入主角接触范围。",
    "萧炎走向南门时，6 名旁听者沿两侧形成窄通道：前景轮廓退入墙影，中景三人目送，后景两人被门光切出肩线；纳兰仍独自握住血契。",
];

const shotDirectives = [
    {
        dramaticFunction: "建立冲突并完成责任转移",
        emotionalObjective: "让萧炎把退婚的羞辱从个人承受推回萧战与萧家颜面，迫使大厅中的三人重新站位。",
        emotionalArc: "萧炎由低头承受转为抬眼质问，萧战前倾，纳兰的袖口收紧，最后三人形成受压三角。",
    },
    {
        dramaticFunction: "提出条件并制造下一轮信息悬停",
        emotionalObjective: "让纳兰以礼貌承认莽撞为外壳，重新掌握谈判节奏，并把萧炎逼到必须追问约定的位置。",
        emotionalArc: "纳兰先向萧战示弱，再把手势收回胸前，萧炎的眉头和身体逐步前探，最后三人共同等待下一项条件。",
    },
    {
        dramaticFunction: "把口头约定变成不可回避的期限",
        emotionalObjective: "让三年云岚宗挑战从一句承诺变成所有旁听者都能见证的期限与胜负条件。",
        emotionalArc: "纳兰平静列出期限和代价，萧炎由皱眉转为盯住她，萧战以拍桌把私人谈判推成家族公开事件。",
    },
    {
        dramaticFunction: "让父亲的保护与纳兰的责任话术正面碰撞",
        emotionalObjective: "让萧战用族长身份挡住侮辱，同时让纳兰把责任和面子重新压回萧家，形成不可回避的选择。",
        emotionalArc: "萧战的手掌仍压在桌上，纳兰的指向动作逼近两人之间，萧炎从父亲身后站直并接住她的目光。",
    },
    {
        dramaticFunction: "用短句完成从被动到主动的转折",
        emotionalObjective: "让纳兰把现在或三年后的选择落成逼问，让萧炎用一句‘我接下’夺回行动权。",
        emotionalArc: "纳兰沿桌边逼近并逐字施压，萧炎从低头变为直立，短句落下后大厅的视线全部转向他。",
    },
    {
        dramaticFunction: "把羞辱转化为仍有时间的反击",
        emotionalObjective: "让萧炎承认当前弱势却拒绝被未来判死，以冷笑和年轻作为仍能翻身的可见依据。",
        emotionalArc: "萧炎先拆解纳兰的强势姿态，再把右手从胸前收回身侧，最后以稳定直视留下未完成的反击。",
    },
    {
        dramaticFunction: "用旧日天赋与一句誓言夺回公开话语权",
        emotionalObjective: "让萧炎用十二岁成为斗者的事实和‘莫欺少年穷’封住全厅的轻视，把反击交给萧战回应。",
        emotionalArc: "萧炎先指向自己的旧日天赋，再向纳兰迈近半步，最后唇角收紧直视她，萧战的手掌进入即将落桌的支持姿态。",
    },
    {
        dramaticFunction: "把父子同盟公开化并把冲突推入契约执行",
        emotionalObjective: "让萧战公开承认儿子不凡，让纳兰的受辱反击推动萧炎离开口头争辩、走向纸笔。",
        emotionalArc: "萧战拍桌后由愤怒转为骄傲，纳兰抬声反击，萧炎转向中央桌案，旁听者退让出契约动作的空间。",
    },
    {
        dramaticFunction: "将赌约从语言交锋转为可见契约动作",
        emotionalObjective: "让纳兰把三年后的输赢写成可执行的契约条件，让萧炎用转身、落笔前停住来拒绝继续口头纠缠。",
        emotionalArc: "纳兰压住桌沿逐项加码，萧炎从她面前转向宣纸，毛笔和短剑在同一桌面上形成清晰的执行路径。",
    },
    {
        dramaticFunction: "以物理动作完成关系反转，血印是结果而非特效",
        emotionalObjective: "让萧炎通过一次真实划掌和一次按印把退婚契约改写为休证，血印只在最终结果成立时成为视觉重心。",
        emotionalArc: "书写收尾后萧炎停笔取剑，左掌出现单一道血口，按印完成；纳兰和萧战的视线由手部转向纸面血印。",
    },
    {
        dramaticFunction: "让血印从道具结果变成公开关系反转",
        emotionalObjective: "让萧炎把血手契约拍到纳兰面前并命名为休证，使纳兰第一次失去语言主导，父亲成为他下一步的承接对象。",
        emotionalArc: "血契先停在桌心，萧炎拈纸走近并重放，纳兰从盯住血印到抬头错愕，萧炎随后背对她转向萧战。",
    },
    {
        dramaticFunction: "将公开羞辱转化为父子之间的信任结果",
        emotionalObjective: "让萧炎的跪地和歉疚被萧战的托扶接住，把家族颜面压力转成父子之间可见的信任支撑。",
        emotionalArc: "萧炎跪下并低头，萧战伸手托住肩背，父子从跪姿恢复到同一肩线，纳兰退到血契一侧保持沉默。",
    },
    {
        dramaticFunction: "以离场背影和血契重量收束本章",
        emotionalObjective: "让萧炎把今日羞辱转成三年后的公开承诺，经过纳兰身侧留下最后一句话，再以南门暖光中的背影结束。",
        emotionalArc: "萧炎先向父亲立誓，再看向南门并经过纳兰，最后背影进入暖光；纳兰留在冷灰大厅中握住血契。",
    },
];
const adaptiveFrameCounts = [4, 3, 5, 5, 4, 4, 4, 5, 5, 5, 3, 4, 3];

function cleanStaticPrompt(prompt) {
    return prompt
        .replace(/；本帧为第\d+\/\d+个可见状态节点。?/gu, "")
        .replace(/本帧为第\d+\/\d+个可见状态节点。?/gu, "")
        .replace(/本镜入口状态已在镜头开始前成立。?/gu, "")
        .replace(/本镜上一动作节点的可见结果已成立，进入当前动作节点。?/gu, "")
        .replace(/当前帧独立使用固定资产锚点生成，不引用同镜上一帧图片。?/gu, "")
        .replace(/纳兰开始计算他的话/gu, "纳兰嘴角收紧，视线停在萧炎脸上")
        .replace(/纳兰准备迎接他的反击/gu, "纳兰视线锁住萧炎，嘴角收紧")
        .replace(/萧战的支持即将成为可见动作/gu, "萧战右掌悬停在桌面上方，眉峰下压")
        .replace(/呼吸逐渐平稳/gu, "呼吸已经恢复均匀")
        .replace(/后摆随步伐轻动/gu, "后摆停在行进后的自然摆幅")
        .replace(/从歉意转为不耐/gu, "眉间歉意消退，嘴角压紧")
        .trim();
}

const staticPromptLabels = ["画面主体", "静态关键帧", "可见状态", "可见表演状态", "构图与空间", "景别", "机位与构图", "站位与视线", "三层空间", "光色与风格", "针对性约束", "负面约束"];

function staticPromptField(prompt, label) {
    const nextLabels = staticPromptLabels.filter((item) => item !== label).join("|");
    return prompt.match(new RegExp(`(?:^|\\n)${label}[：:]\\s*([\\s\\S]*?)(?=(?:\\n\\s*(?:${nextLabels})[：:]|$))`, "u"))?.[1]?.trim() || "";
}

function compactStaticPrompt(prompt, moment = "") {
    const source = cleanStaticPrompt(prompt);
    const subject = staticPromptField(source, "画面主体") || staticPromptField(source, "静态关键帧") || source.split("\n")[0]?.trim() || "当前镜头主体";
    const visible = [staticPromptField(source, "可见状态"), staticPromptField(source, "可见表演状态"), moment].filter(Boolean).join("；");
    const composition = [staticPromptField(source, "构图与空间"), staticPromptField(source, "景别"), staticPromptField(source, "机位与构图"), staticPromptField(source, "站位与视线"), staticPromptField(source, "三层空间")].filter(Boolean).join("；");
    const style = "清冷青白与低饱和黛青为主，南门暖金侧逆光勾勒肩线和发丝；保留皮肤、发丝、木石与纸张的自然材质纹理，半写实 3D 国漫质感";
    const constraints = staticPromptField(source, "针对性约束") || staticPromptField(source, "负面约束") || negativePrompt;
    return [`画面主体：${subject}`, `可见状态：${visible || subject}`, `构图与空间：${composition || "主体、关键道具和背景结构同框，人物保持既定轴线与真实支撑"}`, `光色与风格：${style}`, `针对性约束：${constraints}`].join("\n");
}

function selectAdaptiveFrames(frames, targetCount, shotCode) {
    if (targetCount < 2 || targetCount > 9) throw new Error(`${shotCode} 自适应帧数必须在 2-9 之间`);
    if (targetCount > frames.length) throw new Error(`${shotCode} 没有足够的真实动作节点支撑 ${targetCount} 帧`);
    const sourceIndexes = Array.from({ length: targetCount }, (_, index) => Math.round((index * (frames.length - 1)) / (targetCount - 1)));
    const step = 30 / targetCount;
    return sourceIndexes.map((sourceIndex, index) => {
        const source = frames[sourceIndex];
        return {
            ...source,
            id: `${shotCode}-F${String(index + 1).padStart(2, "0")}`,
            sequenceIndex: index + 1,
            startSecond: Number((index * step).toFixed(2)),
            endSecond: Number(((index + 1) * step).toFixed(2)),
        };
    });
}

function normalizeFramePrompts(frames, inheritedStartPrompt) {
    frames.forEach((frame, index) => {
        const previousEnd = index === 0 ? inheritedStartPrompt : frames[index - 1].endPrompt;
        frame.startPrompt = cleanStaticPrompt(previousEnd || frame.endPrompt);
        frame.transitionPrompt = index === 0 ? `镜头从${frame.startPrompt}的已成立状态开始，人物、道具和场景支撑关系保持可见。` : `承接上一时间段终点的${frame.startPrompt}，沿同一180度轴线和真实支撑关系转入${frame.endPrompt}。`;
        frame.actionPrompt = cleanStaticPrompt(frame.actionPrompt);
        frame.endPrompt = cleanStaticPrompt(frame.endPrompt);
        frame.imagePrompt = cleanStaticPrompt(frame.imagePrompt);
    });
}

function addPreviousTailBinding(videoPrompt, referenceManifest) {
    const previousTail = referenceManifest.find((item) => item.role === "previous_actual_tail");
    if (!previousTail || videoPrompt.includes(`${previousTail.alias}：`)) return videoPrompt;
    return videoPrompt.replace(/^素材绑定：/u, `素材绑定：${previousTail.alias}：${previousTail.purpose}\n`);
}

function addNpcToPerformance(plan, moment) {
    if (!plan) return;
    for (const key of ["start", "middle", "end"]) {
        plan.beats[key].bodyAction = `${plan.beats[key].bodyAction}；背景群像反应：${moment}`;
    }
}

function rebuildTimeline(videoPrompt, frames) {
    const timeline = frames.map((frame) => `${frame.id} ${frame.startSecond}-${frame.endSecond}秒\n起点：${frame.startPrompt}\n动作与触发：${frame.actionPrompt}\n可见衔接：${frame.transitionPrompt}\n终点：${frame.endPrompt}`).join("\n");
    return videoPrompt.replace(/时间段动作：[\s\S]*?\n单一主运镜：/u, `时间段动作：\n${timeline}\n单一主运镜：`);
}

for (const [index, shot] of episode.shots.entries()) {
    const moment = npcMoments[index] || npcMoments.at(-1);
    const directive = shotDirectives[index];
    if (!directive) throw new Error(`缺少 ${shot.code} 的镜头导演指令`);
    const previousShot = episode.shots[index - 1];
    const inheritedStartPrompt = shot.framePlan.start.source === "previous_accepted_actual_tail" && previousShot ? previousShot.endFramePrompt || previousShot.continuity.actionEnd : undefined;
    const previousTailBinding = shot.framePlan.referenceManifest.find((item) => item.role === "previous_actual_tail");
    if (previousTailBinding) previousTailBinding.purpose = "锁定上一镜经人工验收的实际尾帧与本镜起始连续性状态";
    shot.framePlan.frames = selectAdaptiveFrames(shot.framePlan.frames, adaptiveFrameCounts[index], shot.code);
    shot.dramaticFunction = directive.dramaticFunction;
    shot.lens = ["35mm", "50mm", "40mm", "50mm", "50mm", "40mm", "50mm", "35mm", "40mm", "65mm", "50mm", "50mm", "40mm"][index];
    shot.transitionOut = [
        "责任转移切入纳兰的回应",
        "约定条件切入三年期限",
        "桌拍反切萧战",
        "萧炎接下选择并向中线移动",
        "短句后切入少年反击",
        "反击落点交给萧炎的旧日天赋",
        "莫欺少年穷后切入萧战支持",
        "支持落桌匹配契约桌面",
        "落笔前停在纸笔与短剑",
        "血印成立后切入纳兰",
        "休证结果转入父子跪扶",
        "父子信任转入南门离场",
        "落在门光中的慢切黑",
    ][index];
    shot.continuity.shotSize = ["中景", "中景", "中景", "中景至中近景", "中景", "中近景", "中近景", "中景", "中近景", "近景至特写", "中近景", "中近景", "中远景"][index];
    shot.performancePlan = {
        ...shot.performancePlan,
        emotionalObjective: directive.emotionalObjective,
        emotionalArc: directive.emotionalArc,
    };
    const cameraFallbacks = [
        "沿大厅中轴缓慢推进",
        "沿桌面中轴轻微推进后停住",
        "沿桌面向前推进并停在三年约定的反应上",
        "保持中轴并短促横移至纳兰",
        "跟拍萧炎迈向中线后固定",
        "从纳兰肩后沿半环绕缓慢回到萧炎正面但不越轴",
        "沿萧炎肩线缓慢前推并停在正面中近景",
        "桌拍后沿纳兰转身横移到桌案并保持同轴",
        "沿桌面横移跟随萧炎，落笔前停住",
        "桌面横移后固定在血印特写",
        "沿桌面跟拍到纳兰面前后转向萧战",
        "围绕父子肩线缓慢下移后回到平视",
        "跟拍萧炎向南门移动，最后保持背影静止",
    ];
    const hasConcreteCamera = typeof shot.cameraMotion === "string" && /固定机位|推(?:进|近|镜)|拉(?:远|镜)|摇镜|横移|跟拍|滑轨|环绕|吊臂|升降|手持|变焦|俯拍|仰拍|平视|低机位|高机位|中景|近景|特写|远景/u.test(shot.cameraMotion);
    shot.cameraMotion = hasConcreteCamera ? shot.cameraMotion : cameraFallbacks[index];
    shot.videoPrompt = shot.videoPrompt.replace(/单一主运镜：[^\n]*/u, `单一主运镜：${shot.cameraMotion}`);
    shot.description = `${shot.description}；6 名无名旁听 NPC 以低密度群像反应强化本镜的公共压力。`;
    shot.narration = `${shot.narration}；背景群像：${moment}`;
    shot.performanceNotes = `${shot.performanceNotes}；${moment}`;
    shot.negativePrompt = negativePrompt;
    shot.imagePrompt = compactStaticPrompt(shot.imagePrompt, moment);
    shot.startFramePrompt = compactStaticPrompt(shot.startFramePrompt, moment);
    shot.endFramePrompt = compactStaticPrompt(shot.endFramePrompt, moment);
    for (const frame of shot.framePlan.frames) {
        frame.imagePrompt = compactStaticPrompt(frame.imagePrompt, moment);
        frame.actionPrompt = `${frame.actionPrompt}；${moment}`;
        frame.endPrompt = `${frame.endPrompt}；${moment}`;
        frame.transitionPrompt = `${frame.transitionPrompt} 背景群像只沿墙侧、桌侧和门侧承接，不穿越主通道。`;
    }
    normalizeFramePrompts(shot.framePlan.frames, inheritedStartPrompt);
    shot.endFramePrompt = shot.framePlan.frames.at(-1).imagePrompt;
    if (inheritedStartPrompt) {
        shot.startFramePrompt = inheritedStartPrompt;
        shot.continuity.actionStart = inheritedStartPrompt;
        shot.framePlan.frames[0].startPrompt = inheritedStartPrompt;
    }
    shot.videoPrompt = rebuildTimeline(shot.videoPrompt, shot.framePlan.frames);
    shot.videoPrompt = addPreviousTailBinding(shot.videoPrompt, shot.framePlan.referenceManifest);
    shot.videoPrompt = shot.videoPrompt.replace(/环境压力与视觉母题：([^\n]*)/u, `环境压力与视觉母题：$1；背景群像调度：6 名无名旁听者，前景 1／中景 3／后景 2，保持低密度并不遮挡主角；${moment}`);
    shot.videoPrompt = shot.videoPrompt.replace(/视觉风格与光色：[^\n]*/u, `视觉风格与光色：${shot.lighting}；${shot.colorPalette}；高精度 3D 半写实国漫电影质感，保留自然皮肤微纹理、分束发丝、PBR 材质差异、体积雾和电影级景深。`);
    addNpcToPerformance(shot.performancePlan, moment);
    shot.entryState.environment = `${shot.entryState.environment}；6 名无名旁听者保持前 1、中 3、后 2 的低密度分布。`;
    shot.exitState.environment = `${shot.exitState.environment}；背景群像完成本镜反应后回到墙侧、桌侧或门侧，不改变主通道。`;
    shot.entryState.screenDirection = `${shot.continuity.actionStart}；保持纳兰嫣然在左/西、萧炎在右/东、萧战在北侧首位的屏幕关系。`;
    shot.exitState.screenDirection = `${shot.continuity.actionEnd}；下一镜沿同侧屏幕方向和180度轴线交接。`;
    shot.lightingPlan = {
        ...shot.lightingPlan,
        inheritFromPrevious: index === 0 ? "首镜建立南门暖金侧光与室内冷青白反射，人物肤色和材质从此基准开始。" : "继承上一镜已经成立的南门暖金光向、室内冷青白反射和材质粗糙度，只随人物距门远近自然衰减。",
        transitionToNext: index === episode.shots.length - 1 ? "末镜保留暖金门光与冷灰大厅的分界，收束到萧炎背影和纳兰手中的血契。" : "向下一镜保持南门光向、室内冷青白反射、血印受控色相和皮肤微纹理，不突然换色温。",
    };
    shot.continuity.continuityNotes = `${shot.continuity.continuityNotes} ${npcPolicy.continuity}`;
}

for (const edge of episode.continuityEdges) edge.notes = edge.notes?.replace(/各帧仅使用固定资产锚点/gu, "各帧独立维持角色、场景、道具和空间连续") || edge.notes;

renamed.seriesBible.relationshipState = "退婚谈判在萧家大厅被旁听群像见证；萧炎用血手休证夺回主动权，父子关系由颜面压力转为公开信任，纳兰被留在契约重量与三年挑战之间。";
renamed.seriesBible.immutableRules = ["萧家大厅保持 180 度轴线", "血手契约只出现一次左掌血印", "无名旁听群像保持 6 名左右且不升级为正式角色", "三年后云岚宗挑战是本章唯一未来悬念"];
renamed.seriesBible.visualMotifs = ["南门暖金光", "清冷青白大厅", "宣纸血印", "长桌与 180 度轴线", "旁听者分裂的视线", "被拉长的离场背影"];

const archive = renamed.archive;
archive.sections = archive.sections
    .map((section) => ({
        ...section,
        content: section.content
            .replace(/三年之约·血手休证（独立新包）/gu, renamed.project.title)
            .replace(/三年之约·血手休证/gu, renamed.project.title)
            .replaceAll(`${renamed.project.title}（全新独立制作包）`, renamed.project.title)
            .replace(/SH(\d{2})/gu, "NP$1"),
    }))
    .filter((section) => /^SEC(?:0[1-9]|1[0-3])$/u.test(section.code));
const characterViewRule = "固定为一张纯白无缝背景四视图角色基准板：左侧身份特写、正面全身、严格左侧面全身、背面全身；四个视图同一身份、同一基线、同一头身比，身份特写锁定脸部五官，后三个全身视图锁定体态、服装、发型、固定配饰和鞋靴。";
for (const character of renamed.assets.characters) {
    character.profile = {
        ...character.profile,
        consistencyRules: `${character.profile.consistencyRules}；${characterViewRule}`,
        forbiddenChanges: [...new Set([...(character.profile.forbiddenChanges || []), "主立绘", "表情组", "四分之三视图", "额外人物", "额外视图", "文字", "logo", "水印"])],
    };
    character.supplierPrompt = `${characterViewRule} ${character.description} ${character.profile.styling} ${visualStyle} 负面约束：主立绘、表情组、四分之三视图、拆解图、额外人物、文字、logo、水印、换脸、换年龄、塑料皮肤、畸形手指、裁掉头部或鞋靴。`;
}

const scenePrompt = `一张高清、无人物、无文字、无水印的 9:16 单视角全景建立图：萧家议事大厅，北侧高背首位、中央深色木长桌、南侧大门通向白日暖金，东西两侧保留三步对峙通道；青砖地面、木石墙面、陶瓷茶盏和宣纸按 PBR 粗糙度与反射差异表现，室内清冷青白反射，南门暖金侧逆光，真实尺度、空气透视和轻体积尘埃；不出现任何人物或可读文字。`;
location.supplierPrompt = scenePrompt;
location.sceneReferenceBoard = { layout: "panorama" };

const propPrompts = {
    P01: "单主体道具基准图：薄宣纸婚约契约／休证，纸张边缘略卷，黑墨字迹不可读，最终只允许一处左掌血印位置作为状态锚点；无人物、无手持、无文字水印。",
    P02: "单主体道具基准图：暗银窄刃短剑，深木剑柄，刃口有克制冷反射，结构适合少年单手使用；无人物、无血液喷溅、无文字水印。",
    P03: "单主体道具基准图：普通毛笔、石质砚台与吸墨宣纸作为一个桌面书写道具组合，木石和纸纤维粗糙度可触摸；不出现可读文字、人物或额外道具。",
    P04: "单主体道具基准图：深色木桌旁的一只陶瓷茶盏，茶水液面和桌面受力关系清晰，陶瓷柔反射、木桌哑光；无人物、无文字水印。",
};
for (const prop of renamed.assets.props) prop.supplierPrompt = `${propPrompts[prop.code] || `单主体道具基准图：${prop.description}`} ${visualStyle}`;

const characterSection = renamed.assets.characters.map((character) => `### ${character.code} ${character.name}\n\n\`\`\`text\n${character.supplierPrompt}\n\`\`\``).join("\n\n");
const sceneSection = `### S01 萧家议事大厅\n\n\`\`\`text\n${scenePrompt}\n\`\`\``;
const sectionByCode = new Map(archive.sections.map((section) => [section.code, section]));
sectionByCode.get("SEC05").content = characterSection;
sectionByCode.get("SEC06").content = sceneSection;
sectionByCode.get("SEC08").content = sectionByCode.get("SEC08").content.replace(/16:9/gu, "9:16");
sectionByCode.get("SEC07").content += `\n\n${renamed.assets.props.map((prop) => `### ${prop.code}｜${prop.name}\n\n\`\`\`text\n${prop.supplierPrompt}\n\`\`\``).join("\n\n")}`;

archive.promptAssets = archive.promptAssets.map((asset) => ({
    ...asset,
    title: asset.title.replace(/SH(\d{2})/gu, "NP$1"),
    prompt: asset.prompt.replace(/SH(\d{2})/gu, "NP$1"),
}));
archive.promptAssets = archive.promptAssets.filter((asset) => asset.code !== "V04");
archive.promptAssets.push({
    code: "V04",
    category: "keyframe",
    title: "萧家旁听群像行为锚点",
    prompt: `6 名无名旁听 NPC，前景 1／中景 3／后景 2，沿柱影、桌侧、墙边和南门内侧低密度分布；按桌拍收肩、少年反击抬眼、血手成立后屏息后退和离场目送做可见反应；不说话、不接触主角、不遮挡脸部和手部、不进入角色资产。${visualStyle}`,
    shotCodes: episode.shots.map((shot) => shot.code),
});
for (const prop of renamed.assets.props) {
    archive.promptAssets.push({ code: prop.code, category: "keyframe", title: `${prop.name}单主体基准图`, prompt: prop.supplierPrompt, shotCodes: episode.shots.filter((shot) => shot.propCodes.includes(prop.code)).map((shot) => shot.code) });
}
if (!archive.referencePlan.some((item) => item.asset === "S01 背景 NPC 策略"))
    archive.referencePlan.push({ priority: 9, asset: "S01 背景 NPC 策略", purpose: "按场景策略生成无名旁听群像的数量、前中后景位置与反应，不生成独立人物资产", planType: "scene_policy", shotCodes: episode.shots.map((shot) => shot.code) });
archive.generationOrder = [
    "先生成并确认 C01-C03 角色四视图基准板；不为无名旁听 NPC 生成独立角色基准图。",
    "生成并确认 S01 高清、无人、单视角全景场景图，锁定南门光向、桌案、首位和 180 度轴线。",
    "生成并确认 P01-P04 道具基准图，尤其是宣纸、血印、短剑和茶盏受力关系。",
    `按 NP01→NP13 顺序，根据真实动作节点自适应生成每镜 ${adaptiveFrameCounts.join("/")} 个片段帧；每帧独立使用角色、场景和道具职责明确的参考图，并在关键帧和视频时间段写入 6 名左右无名旁听群像的可见反应。`,
    "跨故事段只在上一镜视频版本实际尾帧经人工验收后，使用 previous_accepted_actual_tail 解锁下一镜入口；同镜帧不互相引用。",
    "完成对白口型、旁听群像反应、动作因果、材质光色、连续性和最终音画 QC。",
];
const shotTable = [
    "| 镜号 | 时间 | 阶段 | 景别 | 运镜 | 焦段 | 灯光 | 色彩 | 转场 | 动作描述 | end_state |",
    "|---|---:|---|---|---|---:|---|---|---|---|---|",
    ...episode.shots.map(
        (shot) =>
            `| ${shot.code} | ${shot.timecode} | ${shot.dramaticFunction} | ${shot.continuity.shotSize} | ${shot.cameraMotion} | ${shot.lens} | ${shot.lighting} | ${shot.colorPalette} | ${shot.transitionOut} | ${shot.description.replace(/\|/gu, "／")} | ${shot.exitState.characters
                .map((item) => item.action)
                .filter(Boolean)
                .join("；")
                .replace(/\|/gu, "／")} |`,
    ),
].join("\n");
sectionByCode.get("SEC04").content = shotTable;
sectionByCode.get("SEC11").content = episode.shots.map((shot) => `### P${String(shot.order).padStart(2, "0")}｜${shot.code} ${shot.title}\n\n\`\`\`text\n${shot.videoPrompt}\n\`\`\``).join("\n\n");
sectionByCode.get("SEC12").content =
    `资产映射：C01-C03 为角色一致性资产；S01 为唯一高清、无人、单视角全景场景锚点；P01-P04 为单主体道具基准图。每个镜头的 referenceManifest 只绑定本镜声明的角色、场景、道具；同镜头各帧独立生成，只有跨镜头连续性边的第一帧使用上一镜当前视频版本经人工验收的实际尾帧。\n\n生成顺序：\n${archive.generationOrder.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n镜头范围：${episode.shots.map((shot) => shot.code).join("、")}。`;
sectionByCode.get("SEC13").content =
    `结构 QC：固定 13 章齐全，格式为 vozeb-drama-production-package-v1；本包使用独立标题、E01-FRESH 集编号和 NP01-NP13 镜头编号。\n导演 QC：每镜具备唯一戏剧职责、具体表演目标、真实空间支撑、受控 180 度轴线、单一主运镜、主光/补光/轮廓光、材质响应和可见出口状态。\n对白 QC：所有对白逐句记录 startSecond/endSecond、前后停顿、情绪语速和可复核字速；对白容量只提示，不用快嘴硬塞。\n帧 QC：${episode.shots.map((shot) => `${shot.code}=${shot.framePlan.frames.length}帧`).join("，")}；每帧从 0 秒无空白、无重叠覆盖 30 秒，静态画面按五类可选语义冻结具体可见状态，不因缺少语义段自动补写。\nNPC QC：S01 为 required，6 名无名旁听群像只存在于镜头关键帧和视频时间段，不进入角色资产、characterCodes、角色锚点或独立语音资产。\n连续性 QC：NP03→NP04、NP07→NP08、NP10→NP11 只在上一镜实际尾帧人工验收后继承；同镜帧不互相引用。\n风险提醒：附件只提供小说片段，角色基准图、高清场景全景图、单主体道具图和声音资产尚未生成；正式供应商生产前需完成资产确认、上游模型能力确认和最终口型/音画验收。`;
archive.qcReport =
    "本包按当前短剧视频导演、短剧资产图片导演、Seedance 2.0 与 Seedance 2.5 导演规范重编：小说内容与用户参数分开识别；角色四视图、场景单张无人全景、道具单主体基准图职责分离；无名旁听群像只存在于镜头关键帧和视频段落；每镜一个戏剧职责；静态帧使用五类可选语义，缺少语义段不自动补写；视频 Prompt 直接包含每个真实时间段的起点、动作与触发、可见衔接和终点；30 秒、720p、9:16、Agent 2-9 自适应帧数与 30 张参考图预算已写入制作方案。正式生产前仍需完成供应商能力确认、基准资产人工确认、实际尾帧验收和音画 QC。";

function assertPackage(pkg) {
    for (const section of archive.sections) section.content = section.content.replaceAll("九段静态骨架", "五类可选语义").replaceAll("九段骨架", "五类可选语义");
    sectionByCode.get("SEC13").content = sectionByCode.get("SEC13").content.replace("静态画面按九段骨架冻结具体可见状态", "静态画面按五类可选语义冻结具体可见状态，不因缺少语义段自动补写");
    archive.qcReport = archive.qcReport.replace("静态帧使用九段骨架", "静态帧使用五类可选语义，缺少语义段不自动补写");
    if (pkg.project.title === value.project.title) throw new Error("新包标题未与旧包隔离");
    if (pkg.project.ratio !== "9:16") throw new Error("未指定画幅时必须沿用项目默认 9:16");
    if (pkg.episodes[0].code !== "E01-FRESH") throw new Error("新集编号未更新");
    if (pkg.episodes[0].shots.some((shot) => !shot.code.startsWith("NP"))) throw new Error("仍存在旧镜头编号");
    if (!pkg.assets.locations.some((item) => item.backgroundNpcPolicy?.mode === "required")) throw new Error("缺少 required NPC 场景策略");
    if (pkg.archive.sections.length !== 13 || pkg.archive.sections.some((section, index) => section.code !== `SEC${String(index + 1).padStart(2, "0")}`)) throw new Error("制作包必须严格保留 13 个固定章节");
    if (!pkg.project.productionBible.productionPlan.frameCountRange || pkg.project.productionBible.productionPlan.frameCountRange.min !== 2 || pkg.project.productionBible.productionPlan.frameCountRange.max !== 9)
        throw new Error("缺少 Agent 2-9 自适应帧数范围");
    if (!pkg.project.productionBible.productionPlan.skills.some((skill) => skill.id === "seedance-director" && skill.version === "2.0")) throw new Error("缺少 Seedance 2.0 导演技能记录");
    if (!pkg.assets.locations[0].supplierPrompt.includes("无人物") || !pkg.assets.locations[0].supplierPrompt.includes("单视角全景")) throw new Error("场景基准图未锁定为无人单视角全景");
    if (pkg.assets.characters.some((character) => !character.supplierPrompt.includes("身份特写") || !character.supplierPrompt.includes("严格左侧面全身") || !character.supplierPrompt.includes("背面全身"))) throw new Error("角色基准板未锁定四视图职责");
    if (pkg.assets.props.some((prop) => !prop.supplierPrompt.includes("单主体道具基准图"))) throw new Error("道具基准图未按单主体职责生成");
    if (new Set(pkg.episodes[0].shots.map((shot) => shot.framePlan.frames.length)).size < 3) throw new Error("Agent 自适应帧数没有体现镜头复杂度差异");
    for (const shot of pkg.episodes[0].shots) {
        if (shot.duration !== 30) throw new Error(`${shot.code} 时长不是 30 秒`);
        if (shot.framePlan.frames.length < 2 || shot.framePlan.frames.length > 9) throw new Error(`${shot.code} 自适应帧数超出 2-9`);
        if (shot.framePlan.frames[0].startSecond !== 0 || shot.framePlan.frames.at(-1).endSecond !== 30) throw new Error(`${shot.code} 时间轴未覆盖 0-30 秒`);
        if (!shot.performancePlan?.emotionalObjective || !shot.performancePlan?.emotionalArc) throw new Error(`${shot.code} 缺少具体情绪目标或情绪曲线`);
        if (!shot.lightingPlan?.inheritFromPrevious || !shot.lightingPlan?.transitionToNext) throw new Error(`${shot.code} 缺少前镜继承或下镜过渡灯光计划`);
        if (shot.dramaticFunction === "50mm" || shot.lens === shot.dramaticFunction) throw new Error(`${shot.code} 戏剧职责与焦段字段错位`);
        if (["画面主体：", "可见状态：", "构图与空间：", "光色与风格：", "针对性约束："].some((field) => !shot.imagePrompt.includes(field))) throw new Error(`${shot.code} 缺少静态帧语义`);
        if (["画面主体：", "可见状态：", "构图与空间："].some((field) => !shot.framePlan.frames.every((frame) => frame.imagePrompt.includes(field)))) throw new Error(`${shot.code} 逐帧静态提示词缺少必要可见事实`);
        if (!shot.videoPrompt.includes("起点：") || !shot.videoPrompt.includes("动作与触发：") || !shot.videoPrompt.includes("可见衔接：") || !shot.videoPrompt.includes("终点：")) throw new Error(`${shot.code} 视频时间段不完整`);
        const promptAuditText = `${shot.startFramePrompt}\n${shot.endFramePrompt}\n${shot.videoPrompt}\n${shot.framePlan.frames.map((frame) => `${frame.startPrompt}\n${frame.transitionPrompt}`).join("\n")}`;
        if (/本镜入口状态|本镜上一动作节点|本帧为第|当前帧独立使用固定资产锚点|同镜上一帧图片/gu.test(promptAuditText)) {
            throw new Error(`${shot.code} 残留旧版通用或内部提示词`);
        }
        if (!shot.framePlan.frames.every((frame) => frame.imagePrompt.includes("无名旁听") || frame.imagePrompt.includes("旁听者"))) throw new Error(`${shot.code} 静态帧缺少 NPC 反应`);
        if (!shot.framePlan.frames.every((frame) => frame.actionPrompt.includes("无名旁听") || frame.actionPrompt.includes("旁听者"))) throw new Error(`${shot.code} 视频帧缺少 NPC 反应`);
        if (shot.framePlan.start.source === "previous_accepted_actual_tail") {
            const index = pkg.episodes[0].shots.indexOf(shot);
            const previous = pkg.episodes[0].shots[index - 1];
            if (!previous || shot.startFramePrompt !== (previous.endFramePrompt || previous.continuity.actionEnd) || shot.continuity.actionStart !== (previous.endFramePrompt || previous.continuity.actionEnd))
                throw new Error(`${shot.code} 未从上一镜实际尾帧派生入口状态`);
            const previousTail = shot.framePlan.referenceManifest.find((item) => item.role === "previous_actual_tail");
            if (!previousTail || !shot.videoPrompt.includes(`${previousTail.alias}：`)) throw new Error(`${shot.code} 视频 Prompt 缺少上一镜尾帧素材绑定`);
        }
    }
}

assertPackage(renamed);
fs.writeFileSync(`${outputBase}.json`, `${JSON.stringify(renamed, null, 2)}\n`, "utf8");
const markdownBody = renamed.archive.sections.map((section) => `## ${section.title}\n\n${section.content}`).join("\n\n");
const embedded = JSON.stringify(renamed, null, 2).replace(/```/gu, "\\u0060\\u0060\\u0060");
fs.writeFileSync(
    `${outputBase}.md`,
    `# 《${renamed.project.title}》完整制作包\n\n> 制作包格式：\`vozeb-drama-production-package-v1\`\n> 本文件为全新独立制作包，规范数据源为同名 JSON。\n> 目标平台：Seedance 2.5｜语言：中文｜画幅：9:16（未指定画幅，沿用项目默认）｜单镜：30 秒｜清晰度：720p\n\n## 规范对象（导入权威数据）\n\n\`\`\`drama-production-package\n${embedded}\n\`\`\`\n\n${markdownBody}\n`,
    "utf8",
);
console.log(
    JSON.stringify(
        {
            outputBase,
            sourcePath,
            sourceHash,
            episode: renamed.episodes[0].code,
            shots: renamed.episodes[0].shots.length,
            duration: renamed.episodes[0].shots.reduce((sum, shot) => sum + shot.duration, 0),
            frameCounts: renamed.episodes[0].shots.map((shot) => [shot.code, shot.framePlan.frames.length]),
            npcPolicy: location.backgroundNpcPolicy,
        },
        null,
        2,
    ),
);
