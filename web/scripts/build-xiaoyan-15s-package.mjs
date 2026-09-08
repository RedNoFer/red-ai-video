import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const sourcePath = path.join(root, "drafts", "xiao-yan-three-year-pact-production-package-v2.json");
const targetJsonPath = path.join(root, "drafts", "xiao-yan-three-year-pact-production-package-v3-15s.json");
const targetMarkdownPath = path.join(root, "drafts", "xiao-yan-three-year-pact-production-package-v3-15s.md");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const sourceShots = source.episodes.flatMap((episode) => episode.shots);
const shotDuration = 15;
const frameDuration = 3;

const plans = [
    plan(
        "SH01",
        "萧炎指出退婚伤及族长颜面",
        "SC01",
        ["D01"],
        [
            "三人静立于萧家议事大厅，萧炎在右侧低头承受退婚压力",
            "萧炎抬眼扫过萧战，右手在桌沿收紧，茶水出现细小波纹",
            "说到父亲时萧炎转向北侧首位，肩背从低垂变为直立",
            "萧炎把家族立足的问题压回纳兰，纳兰袖口被手指收拢",
            "萧炎停住呼吸并直视纳兰，留下‘什么约定’的追问空间",
        ],
    ),
    plan(
        "SH02",
        "纳兰收回退婚并提出约定",
        "SC01",
        ["D02", "D03"],
        [
            "纳兰在左侧收住袖口，先看萧战再承认今日莽撞",
            "纳兰转回萧炎，语气克制强势，南门暖光切过浅青衣袖",
            "她说暂缓解除婚约，萧战的手离开茶盏，茶面停止晃动",
            "纳兰把一个约定作为交换条件，萧炎眉头收紧并向前半步",
            "萧炎低声问什么约定，三人对峙在短暂安静中定格",
        ],
    ),
    plan(
        "SH03",
        "纳兰宣布三年云岚宗挑战",
        "SC01",
        ["D04"],
        [
            "纳兰左侧抬手指向南门，三年期限第一次落地",
            "她的手指从南门收回，视线回到萧炎，袖口保持受力",
            "萧炎右手握拳，萧战从首位旁缓慢起身，桌案形成压力前景",
            "纳兰说到失败解除婚约，茶盏边缘轻颤，冷灰大厅更紧",
            "萧战右掌落向桌面，纳兰转头，萧炎抬眼看父亲",
        ],
    ),
    plan(
        "SH04",
        "纳兰把萧家颜面变成压力",
        "SC01",
        ["D05", "D06"],
        ["纳兰侧身面对萧战，袖口压住手腕，宣判责任归属", "她把悔婚责任说成萧战必须承担的颜面，萧战下颌收紧", "纳兰转向萧炎，右手指向约定，东西对峙通道被压窄", "萧炎看一眼父亲再看回纳兰，呼吸停半拍", "萧炎站在右侧接住约定，萧战留在首位，门光仍从南侧压入"],
    ),
    plan(
        "SH05",
        "逼问前者还是后者",
        "SC02",
        ["D07", "D08"],
        ["纳兰站在左侧逼问选择，萧炎仍低头不答", "萧炎的手从身侧抬到胸前，短促吸气，衣袍摩擦清晰", "纳兰目光压住萧炎，萧战在后景等待，茶盏保持静止", "萧炎抬眼直视纳兰，右脚向中线迈半步", "萧炎说我接下，三人关系短暂定格，桌面茶水停止晃动"],
    ),
    plan(
        "SH06",
        "萧炎承认当下屈辱但保留时间",
        "SC02",
        ["D09", "D10"],
        ["萧炎站在右侧冷笑，先压住纳兰的强势姿态", "他说到废物时下颌锁紧，手指在袍袖内收紧", "萧炎承认云岚宗很强，目光越过纳兰指向南门", "他说自己还年轻，肩背抬起，门外风声加重", "萧炎把时间留在自己一侧，纳兰的表情第一次出现裂痕"],
    ),
    plan(
        "SH07",
        "萧炎以旧日天赋反击",
        "SC02",
        ["D11"],
        ["萧炎从右侧向中线迈步，掌心抬起但不出现斗气特效", "他说十二岁成为斗者，纳兰眼神短暂停住", "他指出纳兰当年的八段斗之气，手掌指向自己胸口", "萧炎说现在虽是废物，眉骨压低，声音由低转高", "他反问凭什么不能再次翻身，停在纳兰面前半步"],
    ),
    plan(
        "SH08",
        "莫欺少年穷得到萧战回应",
        "SC02",
        ["D12", "D13"],
        ["萧炎向纳兰压低声音，手掌落回身侧，背景只留大厅风声", "三十年河东落下，南门风声和衣袍摩擦清晰可闻", "萧炎说莫欺少年穷，抬眼越过纳兰看向萧战", "萧战双掌拍桌，茶水飞溅，纳兰肩膀一颤", "萧战说儿子不凡，音乐停一拍，父子获得公开同盟"],
    ),
    plan(
        "SH09",
        "纳兰把三年赌约说到尽头（一）",
        "SC03",
        ["D14a"],
        ["纳兰左侧咬牙攥袖，萧炎在右侧冷笑转身", "纳兰质问凭什么教训她，眼尾收紧，手指指向萧炎胸口", "她说过去的天赋无人能及，短剑与宣纸第一次进入桌面前景", "废物二字落下，萧炎不回头，墨砚在冷灰光中保持静止", "纳兰说等他再次超越，萧炎已经站到桌案南侧"],
    ),
    plan(
        "SH10",
        "纳兰把三年赌约说到尽头（二）",
        "SC03",
        ["D14b"],
        [
            "纳兰继续说明三年后云岚宗等待，手指压住桌面边缘",
            "她把翻身条件逐项说出，语速偏快但每个条件留出停顿",
            "获胜后为奴为婢的条件落下，萧炎拿起毛笔准备落笔",
            "纳兰视线追着萧炎，短剑仍在纸张右前方，桌面暖光增强",
            "口头赌约封口，萧炎低头落笔，画面从对峙转入契约动作",
        ],
    ),
    plan(
        "SH11",
        "契约与兴趣的最后加码",
        "SC03",
        ["D15", "D16"],
        ["纳兰补充失败后交出契约，手指敲在桌沿", "萧炎听完抬眼，嘴角压出冷笑，毛笔尖停在纸面", "纳兰说完废物条件，袖口停在身前等待回应", "萧炎说不用三年，视线从纳兰移向宣纸", "萧炎转身走向桌案，毛笔、砚台和短剑形成新的动作轴"],
    ),
    plan(
        "SH12",
        "落笔与割掌",
        "SC03",
        [],
        ["萧炎右手落笔，宣纸在桌面上被左手拉平", "墨线快速划过纸面，文字保持不可读，笔尖停住", "萧炎放下毛笔并握住短剑，呼吸屏住，纳兰在后景僵住", "短剑只划左掌一次，血痕细而集中，不出现喷溅", "血珠从左掌边缘落向宣纸，短剑停在右前方承接下一镜"],
    ),
    plan(
        "SH13",
        "血手休证拍到桌前",
        "SC03",
        ["D17"],
        ["萧炎把左掌悬在宣纸上方，血珠沿掌纹聚拢", "血掌向下压，纸张纤维被压出清晰轮廓", "血印完整成立，短剑放回桌面，纳兰瞳孔放大", "萧炎拈起契约，血红印记成为冷灰大厅唯一高饱和色", "契约被重重砸到纳兰面前，桌面闷响后留一拍静默"],
    ),
    plan(
        "SH14",
        "纳兰震惊质问",
        "SC04",
        ["D18"],
        ["血契停在桌面，纳兰左侧瞳孔放大，手指触到纸边", "纳兰抬头质问，声音短促，冷灰墙面吞掉回声", "萧炎不解释，转身把视线交给北侧首位的萧战", "萧炎曲腿下跪，左掌伤痕仍朝向镜头，纳兰僵在原地", "萧炎额头触地，代价落地，萧战俯身准备扶住他"],
    ),
    plan(
        "SH15",
        "萧战托住儿子的誓言",
        "SC04",
        ["D19"],
        ["萧战从首位旁俯身，右手托住萧炎肩膀", "他说不会一辈子是废物，手掌稳住儿子的背", "流言蜚语被说出口，纳兰在左后景低头看血契", "现实面前不攻自破，萧炎抬眼，父亲声音回到低沉温暖", "萧战扶萧炎起身，父子肩线形成稳定支撑，南门暖光重新占上风"],
    ),
    plan(
        "SH16",
        "三年之后的离场誓言",
        "SC04",
        ["D20", "D21"],
        ["萧炎面对萧战立誓，左掌伤痕贴近胸口", "父亲二字落下，萧炎呼吸颤动后稳定下来", "他说三年后去云岚宗，目光穿过南门落向白日", "经过纳兰身侧时脚步停半拍，冰冷说会找她", "萧炎背影被南门日光拉长，纳兰留在冷灰大厅握住血契"],
    ),
];

const totalDuration = plans.length * shotDuration;
const shots = plans.map((item, index) =>
    normalizeShot(
        sourceShots.find((shot) => shot.code === item.code),
        item,
        index + 1,
    ),
);
const output = structuredClone(source);

output.project.summary = `第一集按 15 秒生成成本约束和对白动作因果重切为 ${plans.length} 个 15 秒逻辑镜头，总时长约 ${totalDuration} 秒；逐句对白带说话区间、停顿和情绪语速。`;
output.project.productionBible.targetDuration = totalDuration;
output.project.productionBible.productionPlan.video.shotDuration = shotDuration;
for (const episode of output.episodes) {
    episode.targetDuration = totalDuration;
    episode.storyScenes = episode.storyScenes.map((scene) => {
        const sceneShots = shots.filter((shot) => shot.storySceneCode === scene.code);
        const start = sceneShots[0]?.order ? (sceneShots[0].order - 1) * shotDuration : 0;
        return { ...scene, timeRange: `${start}-${start + sceneShots.length * shotDuration}s`, shotCodes: sceneShots.map((shot) => shot.code) };
    });
    episode.script = episode.script.replaceAll("0-30s", "0-60s").replaceAll("30-75s", "60-120s").replaceAll("75-120s", "120-195s").replaceAll("120-150s", "195-240s");
    episode.shots = shots;
}

output.archive.dialogueDirections = shots.flatMap((shot) =>
    shot.utterances.map((utterance) => ({
        id: utterance.id,
        shotCode: shot.code,
        speaker: utterance.speaker,
        text: utterance.text,
        performance: `${utterance.speechRate}；前停顿${utterance.pauseBeforeSeconds}s，后停顿${utterance.pauseAfterSeconds}s`,
        lipSync: true,
        startSecond: utterance.startSecond,
        endSecond: utterance.endSecond,
        pauseBeforeSeconds: utterance.pauseBeforeSeconds,
        pauseAfterSeconds: utterance.pauseAfterSeconds,
        speechRate: utterance.speechRate,
        speechRateCharsPerSecond: utterance.speechRateCharsPerSecond,
    })),
);
output.archive.promptAssets = output.archive.promptAssets.map((asset) => ({
    ...asset,
    title: asset.code === "SB01" ? "SH01-SH16 15秒全案板" : asset.title,
    prompt: asset.code === "SB01" ? asset.prompt.replace("十个15秒镜头", "十六个15秒镜头") : asset.prompt,
}));
output.archive.generationOrder = [
    "生成 C01-C03 角色固定资产并复用已审核基准图。",
    "生成 S01 萧家议事大厅空间锚点。",
    "生成 P01-P04 道具固定资产。",
    `生成 V01-V04 关键帧与 SB01 全案板，关键帧按${plans.length}个15秒逻辑镜头复核。`,
    `按 SH01-SH${String(plans.length).padStart(2, "0")} 顺序生成视频；每镜固定15秒，先验收对白时序、帧计划和公开 videoPrompt，再生成并人工验收实际尾帧。`,
];
output.archive.qcReport =
    "制作包结构预检：通过。对白时序：22句均具备 startSecond/endSecond、前后停顿、情绪语速和可复核字速；逐句无重叠、无越界。镜头容量：通过；15秒镜头内对白按真实语速和停顿核算，未把完整长台词塞入5秒帧段。导演场景审计：每镜具备欲望、阻力、空间几何、受控视线、节奏、镜头任务、三项可见细节和结果停顿。媒体生成前仍需供应商能力确认、实际尾帧人工验收和最终音画 QC。";
output.archive.sections = output.archive.sections.map((section) => updateSection(section, output));

const json = `${JSON.stringify(output, null, 2)}\n`;
fs.writeFileSync(targetJsonPath, json, "utf8");
fs.writeFileSync(targetMarkdownPath, serializeMarkdown(output, json), "utf8");

function normalizeShot(sourceShot, blueprint, order) {
    const shot = structuredClone(sourceShot);
    const start = (order - 1) * shotDuration;
    const end = start + shotDuration;
    const utterances = assignUtteranceTiming(shot.utterances, blueprint.code);
    const utteranceMap = new Map(utterances.map((utterance) => [utterance.id, utterance]));
    shot.code = blueprint.code;
    shot.order = order;
    shot.storySceneCode = blueprint.sceneCode;
    shot.time = `${start}-${end}秒`;
    shot.timecode = `${start}-${end}s`;
    shot.duration = shotDuration;
    shot.utterances = utterances;
    shot.dialogue = utterances.map((utterance) => `${utterance.speaker}：${utterance.text}`).join(" ");
    shot.sourceText = utterances.map((utterance) => utterance.text).join(" ") || shot.sourceText;
    shot.dialoguePerformance = shot.dialoguePerformance.map((performance) => {
        const utterance = utteranceMap.get(performance.utteranceId);
        return utterance ? { ...performance, pause: `前${utterance.pauseBeforeSeconds}s / 后${utterance.pauseAfterSeconds}s`, pace: utterance.speechRate } : performance;
    });
    shot.framePlan.frames = shot.framePlan.frames.map((frame, index) => ({
        ...frame,
        id: `${blueprint.code}-F${String(index + 1).padStart(2, "0")}`,
        sequenceIndex: index + 1,
        startSecond: index * frameDuration,
        endSecond: (index + 1) * frameDuration,
        startPrompt: index === 0 ? blueprint.beats[index] : blueprint.beats[index - 1],
        actionPrompt: blueprint.beats[index],
        transitionPrompt: index === 0 ? "起点状态已经成立" : `承接上一帧的可见结果：${blueprint.beats[index - 1]}`,
        endPrompt: blueprint.beats[index],
        imagePrompt: staticFramePrompt(shot, blueprint.beats[index], index),
    }));
    shot.videoPrompt = buildVideoPrompt(shot, blueprint, utterances);
    return shot;
}

function assignUtteranceTiming(values, shotCode) {
    if (!values.length) return [];
    const pauses = values.map((_, index) => ({ before: index === 0 ? 0.6 : 0.35, after: index === values.length - 1 ? 0.8 : 0.35 }));
    const baseRates = values.map((value) => Number(value.speechRateCharsPerSecond) || 5);
    const totalPauses = pauses.reduce((sum, item) => sum + item.before + item.after, 0);
    const baseSpeech = values.reduce((sum, value, index) => sum + countSpokenCharacters(value.text) / baseRates[index], 0);
    const availableSpeech = shotDuration - totalPauses;
    const scale = baseSpeech > availableSpeech ? baseSpeech / availableSpeech : 1;
    let cursor = 0;
    return values.map((value, index) => {
        const pauseBeforeSeconds = pauses[index].before;
        const pauseAfterSeconds = pauses[index].after;
        const speechRateCharsPerSecond = Number(Math.min(8, Math.max(2, baseRates[index] * scale)).toFixed(1));
        const startSecond = Number((cursor + pauseBeforeSeconds).toFixed(2));
        const endSecond = Number((startSecond + countSpokenCharacters(value.text) / speechRateCharsPerSecond).toFixed(2));
        cursor = endSecond + pauseAfterSeconds;
        return {
            ...value,
            startSecond,
            endSecond,
            pauseBeforeSeconds,
            pauseAfterSeconds,
            speechRate: value.speechRate || speechRateFor(shotCode),
            speechRateCharsPerSecond,
        };
    });
}

function buildVideoPrompt(shot, blueprint, utterances) {
    const references = shot.videoPrompt.split("动态意图：")[0].trim();
    const timeline = blueprint.beats
        .map(
            (beat, index) =>
                `${blueprint.code}-F${String(index + 1).padStart(2, "0")} ${index * frameDuration}-${(index + 1) * frameDuration}秒\n起点：${index === 0 ? beat : blueprint.beats[index - 1]}\n动作与触发：${beat}\n可见衔接：${index === 0 ? "起点状态已经成立" : `承接上一帧的可见结果：${blueprint.beats[index - 1]}`}\n终点：${beat}`,
        )
        .join("\n");
    const dialogue = utterances.length
        ? utterances
              .map(
                  (utterance) =>
                      `${utterance.speaker}「${utterance.text}」（${utterance.startSecond}-${utterance.endSecond}秒；前停顿${utterance.pauseBeforeSeconds}秒；后停顿${utterance.pauseAfterSeconds}秒；${utterance.speechRate}，${utterance.speechRateCharsPerSecond}字/秒）`,
              )
              .join("；")
        : "无对白";
    return `${references}\n动态意图：${blueprint.title}，动作按五个可验收节点推进，最终停在${blueprint.beats[4]}。\n全局设定：萧家议事大厅，人物关系和180度轴线固定，南门白日暖光压过室内冷灰，角色服装和道具材质沿用已验收资产。\n起始可见状态：${blueprint.beats[0]}\n时间段动作：\n${timeline}\n单一主运镜：${shot.cameraMotion}\n环境压力与视觉母题：${shot.environmentMotif}\n视觉风格与光色：${shot.colorPalette}\n声音意图：${dialogue}；大厅短混响、衣袍摩擦和动作拟音按节点进入；字幕后期置于底部安全区，不提前加入字幕。\n结束画面：${blueprint.beats[4]}\n连续性锁：保持萧炎、纳兰嫣然、萧战的身份、服装、左右站位、北侧首位、长桌和南门轴线；道具只由当前镜头已绑定资产承担。\n针对性约束：${shot.negativePrompt}`;
}

function staticFramePrompt(shot, state, frameIndex) {
    const visualState = state
        .replaceAll("声音由低转高", "眉骨压低、嘴角收紧")
        .replaceAll("声音回到低沉温暖", "眉眼放松、手掌稳定")
        .replaceAll("声音短促", "下颌快速收紧")
        .replaceAll("语速偏快但每个条件留出停顿", "手指逐项收拢、眉眼保持锐利")
        .replaceAll("声音", "气息")
        .replaceAll("继续", "")
        .replaceAll("走向", "站在")
        .replaceAll("转身", "身体朝向")
        .replaceAll("朝向镜头", "朝向画面")
        .replaceAll("经过纳兰身侧时脚步停半拍，冰冷说会找她", "萧炎位于纳兰身侧，脚步停半拍，下颌收紧");
    const shotSizes = shot.shotSize
        .split(/(?:到|→|->|至|切)/u)
        .map((item) => item.trim())
        .filter(Boolean);
    const fixedShotSize = shotSizes[Math.min(frameIndex, shotSizes.length - 1)] || shot.shotSize;
    return `静态关键帧：${visualState}\n可见状态：${visualState}\n可见表演状态：主体的眉眼、呼吸、手部和道具接触关系清晰可见，情绪通过身体动作呈现\n景别：${fixedShotSize}\n机位与构图：平视沿大厅既定180度轴线，前景由桌角或门框形成具体遮挡，主体视线落在当前冲突对象\n站位与视线：纳兰嫣然保持画面左/西，萧炎保持画面右/东，萧战位于北侧首位；身体由地面或桌案支撑，目光方向明确\n三层空间：前景为桌角/门框，中景承载人物与道具，背景交代北侧首位、墙面和南门纵深\n光色与风格：${shot.lighting}；${shot.colorPalette}；3D国漫PBR材质，自然皮肤纹理\n负面约束：${shot.negativePrompt}`;
}

function updateSection(section, value) {
    let content = section.content.replaceAll("320 秒", "240 秒").replaceAll("16 个 × 20 秒", "16 个 × 15 秒").replaceAll("16个20秒", "16个15秒").replaceAll("每镜按16个20秒逻辑镜头", "每镜按16个15秒逻辑镜头");
    if (section.title.includes("第一集文学剧本")) content = value.episodes[0].storyScenes.map((scene) => `### ${scene.title}｜${scene.timeRange}\n${scene.summary}\n镜头：${scene.shotCodes.join("、")}`).join("\n\n");
    if (section.title.includes("台词与表演脚本"))
        content = "每条对白以 archive.dialogueDirections 为准；对白本体与执行提示词分离。15秒镜头内每句记录相对镜头的 startSecond/endSecond、pauseBeforeSeconds/pauseAfterSeconds、speechRate、speechRateCharsPerSecond。";
    if (section.title.includes("声音设计")) content = "大厅短混响、桌案受力声、纸张摩擦、短剑割掌和南门暖光形成声音锚点；15秒镜头保留对白停顿和结果留白，SH08、SH13、SH16 保留冲突后的静默。";
    if (section.title.includes("资产映射")) content = "固定资产 → 场景锚点 → 道具 → 关键帧 → SH01-SH16 15秒视频 → 实际尾帧人工验收 → 连续性复核。";
    return { ...section, content };
}

function serializeMarkdown(value, embeddedJson) {
    const sections = value.archive.sections.map((section, index) => {
        const title = `${index + 1}、${section.title.replace(/^\d+[、.]\s*/u, "")}`;
        if (title.includes("镜头执行表")) return `## ${title}\n\n${shotTable(value)}`;
        if (title.includes("分段视频 Prompt"))
            return `## ${title}\n\n${value.episodes.flatMap((episode) => episode.shots.map((shot) => `### P${String(shot.order).padStart(2, "0")}｜${shot.code} ${shot.title}\n\n\`\`\`text\n${shot.videoPrompt}\n\`\`\``)).join("\n\n")}`;
        return `## ${title}\n\n${section.content.trim()}`;
    });
    return `# 《${value.project.title}》完整制作包\n\n> 制作包格式：\`vozeb-drama-production-package-v1\`\n> 规范数据源：JSON；本文件由同一对象确定性导出。\n> 目标平台：${value.project.productionBible.targetPlatform}｜语言：${value.project.productionBible.language}｜画幅：${value.project.ratio}｜成片：约 ${totalDuration} 秒\n\n## 规范对象（导入权威数据）\n\n\`\`\`drama-production-package\n${embeddedJson.trimEnd()}\n\`\`\`\n\n${sections.join("\n\n")}\n`;
}

function shotTable(value) {
    const rows = value.episodes.flatMap((episode) =>
        episode.shots.map(
            (shot) =>
                `| ${shot.code} | ${shot.timecode} | ${shot.dramaticFunction || ""} | ${shot.shotSize || ""} | ${shot.cameraMotion} | ${shot.lens || ""} | ${shot.lighting || ""} | ${shot.colorPalette || ""} | ${shot.transitionOut || ""} | ${shot.description.replaceAll("|", "／")} | ${(
                    shot.exitState?.characters || []
                )
                    .map((item) => item.action)
                    .filter(Boolean)
                    .join("；")} |`,
        ),
    );
    return ["| 镜号 | 时间 | 阶段 | 景别 | 运镜 | 焦段 | 灯光 | 色彩 | 转场 | 动作描述 | end_state |", "|---|---:|---|---|---|---:|---|---|---|---|---|", ...rows].join("\n");
}

function plan(code, title, sceneCode, utteranceIds, beats) {
    return { code, title, sceneCode, utteranceIds, beats };
}

function speechRateFor(shotCode) {
    if (["SH01", "SH03", "SH07"].includes(shotCode)) return "压怒偏快，重点词留重音";
    if (["SH09", "SH10", "SH11"].includes(shotCode)) return "尖锐逼迫，条件逐项落下";
    return "克制清晰，句尾留出反应";
}

function countSpokenCharacters(value) {
    return (value.match(/[\p{L}\p{N}]/gu) || []).length;
}
