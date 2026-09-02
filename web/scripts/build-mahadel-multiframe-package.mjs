import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const sourcePath = path.join(root, "output", "mahadel-episode-01-production-package-v2-multiframe.json");
const targetPath = path.join(root, "output", "mahadel-episode-01-production-package-v3-static-frame.json");
const targetMarkdownPath = path.join(root, "output", "mahadel-episode-01-production-package-v3-static-frame.md");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const videoModel = process.env.VOZEB_VIDEO_MODEL?.trim() || source.project.productionBible?.productionPlan?.video?.model || source.project.productionBible?.targetPlatform?.trim();
if (!videoModel) throw new Error("VOZEB_VIDEO_MODEL is required; set it to the exact enabled logical video model ID from the admin model routing settings");

const productionPlan = {
    version: "drama-production-plan-v1",
    skills: [{ id: "seedance-director", name: "Seedance 导演", version: "2.0" }],
    video: {
        model: videoModel,
        mode: "storyboard",
        ratio: "9:16",
        resolution: "720p",
        durationPolicy: "shot",
        count: 1,
        audioMode: "native",
        allowExplicitFallback: false,
        modelParameters: {},
        frameCount: 5,
    },
    references: {
        strategy: "adaptive",
        minImages: 3,
        maxImages: 9,
        roles: ["previous_actual_tail", "character_anchor", "scene_anchor", "prop_anchor", "action_keyframe", "composition_keyframe"],
    },
    continuity: { mode: "strict", requireAcceptedActualTail: true },
    source: "package",
};

const characters = source.assets.characters;
const props = source.assets.props;

function referencesForShot(shot, previous) {
    const manifest = [];
    if (previous) {
        manifest.push({
            alias: "@图片1",
            role: "previous_actual_tail",
            purpose: "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
            shotId: previous.code,
        });
    }

    const text = [shot.title, shot.description, shot.dialogue, shot.narration, shot.startFramePrompt, shot.endFramePrompt, shot.continuity?.actionStart, shot.continuity?.actionEnd].filter(Boolean).join(" ");
    const declaredCharacters = characters.filter((asset) => shot.characterCodes?.includes(asset.code));
    const matchedCharacters = [...declaredCharacters, ...characters.filter((asset) => text.includes(asset.name))].filter((asset, index, list) => list.findIndex((item) => item.code === asset.code) === index);
    for (const asset of matchedCharacters) {
        manifest.push({
            alias: `@图片${manifest.length + 1}`,
            role: "character_anchor",
            purpose: `角色基准图：保持 ${asset.name} 的身份特征、服装与道具不漂移`,
            assetId: asset.code,
        });
    }

    manifest.push({
        alias: `@图片${manifest.length + 1}`,
        role: "scene_anchor",
        purpose: "场景基准图：保持空间结构、光向与轴线一致",
        assetId: shot.locationCode,
    });

    const declaredProps = props.filter((asset) => shot.propCodes?.includes(asset.code));
    for (const asset of [...declaredProps, ...props.filter((item) => text.includes(item.name))].filter((asset, index, list) => list.findIndex((item) => item.code === asset.code) === index)) {
        if (manifest.length >= 9) break;
        manifest.push({
            alias: `@图片${manifest.length + 1}`,
            role: "prop_anchor",
            purpose: `道具基准图：保持 ${asset.name} 的形状、持有人与当前状态一致`,
            assetId: asset.code,
        });
    }

    if (manifest.length < 3) {
        manifest.push({
            alias: `@图片${manifest.length + 1}`,
            role: "action_keyframe",
            purpose: "动作关键帧：由本镜入口状态与动作起点派生，生成前需完成关键帧验收",
            shotId: shot.code,
        });
    }

    return manifest.slice(0, 9).map((item, index) => ({ ...item, alias: `@图片${index + 1}` }));
}

function frameBeatsForShot(shot) {
    const duration = Math.max(1, Number(shot.duration) || 5);
    const beats = frameStatesForShot(shot);
    const boundaries = beats.map((_, index) => Number(((duration * index) / beats.length).toFixed(3))).concat(duration);
    return beats.map((actionPrompt, index) => ({
        id: `${shot.code}-F${String(index + 1).padStart(2, "0")}`,
        sequenceIndex: index + 1,
        startSecond: boundaries[index],
        endSecond: boundaries[index + 1],
        actionPrompt: `${actionPhase(index, beats.length)}：${actionPrompt}`,
        imagePrompt: staticImagePrompt(shot, actionPrompt, index, beats.length),
    }));
}

function actionPhase(index, count) {
    if (index === 0) return "建立场景与动作入口";
    if (index === count - 1) return "落到结果、反应或转场";
    if (index === count - 2) return "执行关键动作";
    return "镜头推进并改变主体状态";
}

const EXPLICIT_FRAME_STATES = {
    SH001: [
        "黑湖无波，倒悬古塔与Karin模糊倒影对齐；雪地中央四只手刚刚扣住，Karin低头看向掌心的完整剑刃",
        "雪地中央四只手彼此扣紧；Karin抬头看向倒悬古塔，双手收紧，完整剑刃出现第一道银色裂纹",
        "剑刃已经从掌心断口向外裂开，冷银碎屑停在断口周围；Karin眉眼骤然睁大、下颌绷紧，四只手仍扣住断剑",
        "冷银断口占据前景中心，Karin手指扣住碎裂剑刃，视线锁定断口；断口冷光形成下一镜马车窗光的匹配切入口",
    ],
    SH002: [
        "马车内同一只手压住断剑，指节发白，Karin闭眼伏在座位上；冷银断口方向与上一镜一致",
        "马车内Karin肩膀绷紧，手掌继续压住断剑；车窗冷光在剑柄上形成短促反光",
        "Karin灰绿色眼睛已经睁开，视线落向断剑，嘴唇微张急促吸气；手指收紧握住断剑",
        "Karin完全惊醒，灰绿色眼睛锁定断剑握柄，肩膀绷紧，手掌稳定扣住断剑；车厢冷光与暗影关系已经落定",
    ],
    SH003: ["马车内Rifa看向Karin，Karin的手仍扣住断剑", "Karin避开Rifa的视线，Rifa眉心收紧并等待回答", "Karin接住水囊，Rifa移开目光，车厢关系恢复克制"],
    SH004: ["Rifa观察Karin的呼吸，Karin仍坐在车厢内", "Karin避开Rifa的视线，嘴角压住，手仍靠近断剑", "Rifa把水囊推到Karin手边，Karin抬手准备接住"],
    SH005: ["水囊停在Karin手边，Rifa收回目光", "Karin双手接住水囊，肩膀从绷紧转为放松", "Karin握住水囊，Rifa望向车窗，车厢恢复日常站位"],
    SH006: ["腰间黄铜护符闪烁后熄灭，Karin的手停在护符旁", "透明皇家结界逼近车窗，两人同时转头警觉", "Karin握住熄灭护符，Rifa望向结界并保持警觉"],
    SH007: ["Karin握住熄灭护符，Rifa仍看向车窗外的结界", "Rifa的视线锁定结界，Karin手指收紧护符", "两人保持警觉站位，护符贴在Karin掌心，结界占据车窗背景"],
    SH008: ["马车穿过透明皇家结界，冷银光落在Karin与Rifa身上", "双塔上方的法师剪影俯视马车，结界光纹停在背景", "Karin与Rifa站在检查台前，黄铜探测器被举起"],
    SH009: ["透明结界光纹停在双塔城门外，法师剪影俯视道路", "马车停在检查台前，Karin与Rifa从车厢下车", "两人站在检查台前，检查官举起黄铜探测器"],
    SH010: ["黄铜探测器指针停在零刻度，检查官与两名旅人保持对峙站位", "检查官抬手，竖幅上方的闸门锁链开始下落", "Karin前移半步挡住检查官看向Rifa的视线，闸门锁闭"],
    SH011: ["黄铜探测器停在零刻度，检查官与两名旅人保持对峙站位", "检查官抬手，竖幅上方闸门锁链开始下落", "Karin前移半步挡住检查官看向Rifa的视线，闸门锁闭"],
    SH012: ["检查官与Karin隔着零刻度探测器对峙，Rifa站在侧后方", "Karin向前半步，Rifa保持侧后位置，闸门锁链悬在上方", "闸门锁闭，Karin挡住检查官视线，Rifa保持警觉"],
    SH013: ["Karin拇指压在断剑剑柄上，Rifa看向他的手", "Rifa向前一步停在Karin身侧，两人肩膀逐渐放松", "两人并肩站在封印前，手部保持旧信号后的静止关系"],
    SH014: ["Karin与Rifa并肩站在封印前，Rifa的视线落向封印边缘", "两人的肩膀放松，双手停在封印两侧", "两人完全并肩，封印保持将开未开的裂隙状态"],
    SH015: ["Karin与Rifa并肩站在封印前，双手停在解除动作起点", "旗帜与尘埃悬停，结界向两人凹陷，探测器内部出现裂纹", "两人收力站稳，闸门打开，远处观察者转动四点银戒"],
    SH016: ["悬停的旗帜和尘埃固定在半空，结界保持凹陷", "探测器从内部裂开，Karin与Rifa的肩膀开始放松", "高塔远处观察者转动四点银戒，闸门在背景打开"],
    SH017: ["Karin与Rifa站在打开的闸门前，肩膀已收力", "闸门完全打开，两人保持站稳，冷银光落在地面", "高塔观察者站在远处阴影中，四点银戒停在抬起的手指间"],
    SH018: ["阿佐雷斯层叠塔楼、吊桥和水渠沿陡坡展开", "断剑撞上蓝玻璃瓶手推车，Karin立刻护住剑鞘", "Rifa放慢脚步与Karin并肩抵达上行坡道"],
    SH019: ["Rifa望向Karin，Karin的手仍按住剑鞘", "Karin避开视线，Rifa保持半步距离并等待回答", "两人放慢脚步并肩前行，Karin没有把手从剑上移开"],
    SH020: ["Karin与Rifa沿阿佐雷斯上行坡道并肩走近门口", "两人停在坡道转折处，Rifa侧身看向Karin", "两人并肩抵达上行坡道尽头，剑鞘仍在Karin腰后"],
    SH021: ["Edia Knight木门占满竖幅，门面银色裂痕与梦中剑刃断口相同", "Karin抬手未触门，腰后断剑先发生震动", "木门开启，奥伦背对站在冷蓝外光与暗琥珀炉光交界处"],
    SH022: ["Karin与Rifa立在木门门槛，奥伦背对站在炉光深处", "Karin的手停在腰后断剑旁，Rifa的视线落向门内", "奥伦保持背对，Karin避开Rifa的视线，三人纵深关系稳定"],
    SH023: ["奥伦站在铁砧旁抬眼看向Karin手中的断剑", "Karin走到铁砧前，Rifa守在门与他之间", "断剑平放在铁砧上，锤柄抵住断口"],
    SH024: ["奥伦侧身站在铁砧旁，目光落向Karin手中的断剑", "Karin把断剑平放在铁砧上，Rifa守在门与他之间", "锤柄抵住断口，三人停在同一纵深关系中"],
    SH025: ["奥伦的手停在断剑上方，Karin站在铁砧前", "Karin把断剑平放在铁砧上，Rifa保持门口站位", "锤柄抵住断口，三人停在同一纵深关系中"],
    SH026: ["锤柄触碰断剑，炉火缩成一线，金属朝铁砧偏转", "黑湖记忆浮现，雪地中央的手腕系着暗红细线", "Rifa抓住Karin手腕，奥伦注视两人相接的手"],
    SH027: ["无头锤柄触碰断剑，炉火缩成一线，金属朝铁砧偏转", "黑湖记忆浮现，雪地中央的手腕系着暗红细线", "Rifa抓住Karin手腕，奥伦注视两人相接的手"],
    SH028: ["炉火缩成一线，Karin看向暗红细线的记忆残影", "Rifa的手扣住Karin手腕，暗红辫绳与记忆中的红线相对", "奥伦注视两人相接的手，断剑停在铁砧上"],
    SH029: ["奥伦从铁砧下取出窄木匣并推向Karin", "Rifa的短刃滑出半寸，视线转向木匣与奥伦", "炉火熄灭，木匣四点微亮，铜镜映出高塔观察者"],
    SH030: ["窄木匣停在铁砧边，Rifa的短刃露出半寸", "烟黑铜镜映出高塔观察者，奥伦的手停在熄灭的炉膛旁", "炉火完全熄灭，木匣四点微亮，短刃保持出鞘半寸"],
};

function frameStatesForShot(shot) {
    const existingStates = (shot.framePlan?.frames || [])
        .map((frame) => String(frame.imagePrompt || "").match(/静态关键帧：([\s\S]*?)(?:；可见状态：|\n可见状态：)/u)?.[1]?.trim() || "")
        .filter(Boolean);
    if (existingStates.length) return existingStates;
    const explicit = EXPLICIT_FRAME_STATES[shot.code];
    if (explicit) return explicit;
    const raw = [shot.continuity?.actionStart, shot.description, shot.continuity?.actionEnd]
        .map((item) => String(item || "").trim())
        .flatMap((item, index, list) => splitVisibleState(item, index, list.length))
        .filter(Boolean);
    const unique = [...new Map(raw.map((state) => [state, state])).values()];
    return (unique.length ? unique : ["主体处于动作入口，当前目标关系清晰"]).slice(0, 5);
}

function splitVisibleState(value, index, count) {
    const parts = value
        .replace(/^(?:进入|本内部镜头只执行：)/u, "")
        .replace(/(?:的)?连续反应与动作过渡/gu, "")
        .split(/\s*(?:到|→|再|然后)\s*/u)
        .map((item) => item.trim())
        .filter(Boolean);
    const selected = parts.length > 1 ? parts[Math.min(index, parts.length - 1)] : parts[0] || "";
    return selected
        .replace(/[“”][^“”]*[””]/gu, "")
        .replace(/(?:\b(?:ELS|ECU|LS|MS|MCU|CU|OTS)\b(?:\s*→\s*\b(?:ELS|ECU|LS|MS|MCU|CU|OTS)\b)?|\d+mm)/giu, "")
        .replace(/(?:镜头|运镜|沿[^，。；]*?(?:推|拉|摇|跟拍|环绕|下降|后退)[^，。；]*[，。；]?)/gu, "")
        .replace(/[,，、；;]\s*$/u, "")
        .trim();
}

function staticImagePrompt(shot, state, index, count) {
    const performance = cleanPerformanceText(visiblePerformanceState(state, index, count));
    const size = staticShotSize(shot.continuity?.shotSize || "中景", index + 1, `${state}；${performance}`);
    const cameraAngle = cleanStaticText(shot.continuity?.cameraAngle || "视线高度平视，沿动作轴线拍摄");
    const composition = cleanStaticText(shot.continuity?.composition || "主体置于9:16安全区，画面前方保留空间");
    const blocking = cleanStaticText(shot.continuity?.characterBlocking || "主体站位明确");
    const gaze = cleanStaticText(shot.continuity?.gazeDirection || "视线落向当前叙事目标");
    const lighting = cleanStaticText(shot.lighting || "延续本场主光");
    const palette = cleanStaticText(shot.colorPalette || "沿用本场色板");
    const foreground = foregroundForShot(shot);
    const middle = visibleAssetsForShot(shot);
    const background = backgroundForLocation(shot.locationCode);
    const negative = cleanNegativeText(shot.negativePrompt);
    return [
        `静态关键帧：${state}`,
        `可见状态：${state}`,
        `可见表演状态：${performance}`,
        `景别：${size}`,
        `机位与构图：${cameraAngle}；${composition}；前景以${foreground}形成具体框景`,
        `站位与视线：${blocking}；${gaze}；画面前方保留前进空间`,
        `三层空间：前景为${foreground}；中景承载${middle}；背景为${background}`,
        `光色与风格：${lighting}；${palette}；半写实动漫幻想风，暗黑学院史诗奇幻，保留皮肤、亚麻、皮革与金属的自然纹理`,
        `负面约束：${negative}`,
    ].join("\n");
}

const FOREGROUND_BY_SHOT = {
    SH001: "结霜的黑色湖岸与低矮枯枝",
    SH002: "马车内侧木窗框",
    SH003: "马车右侧竖向车窗框",
    SH004: "马车木窗框与结界反光",
    SH005: "检查台的黄铜边缘",
    SH006: "城门前的银色界碑",
    SH007: "城门检查台的黄铜边缘",
    SH008: "上行坡道的黑石路沿",
    SH009: "铸剑铺的木门框",
    SH010: "铁砧的黑色边缘",
    SH011: "铁砧上方的烟黑铜镜边缘",
    SH012: "铁砧与窄木匣的边缘",
};

const BACKGROUND_BY_LOCATION = {
    S02: "阿佐雷斯双塔城门、透明皇家结界与盘查道路",
    S03: "阿佐雷斯层叠塔楼、吊桥、水渠与上行坡道",
    S04: "Edia Knight铸剑铺、炉膛、柜台与铁砧上方的烟黑铜镜",
    S05: "无波黑湖、倒悬古塔、雪地边界与对齐的模糊倒影",
    S06: "封闭木马车内的长凳、右侧竖向车窗与车外冷色结界",
};

function foregroundForShot(shot) {
    return FOREGROUND_BY_SHOT[shot.code] || (shot.locationCode === "S04" ? "铸剑铺入口木框" : "场景中可见的具体建筑边缘");
}

function backgroundForLocation(locationCode) {
    return BACKGROUND_BY_LOCATION[locationCode] || "已绑定场景中的建筑结构与环境纵深";
}

function visibleAssetsForShot(shot) {
    const names = [...(shot.characterCodes || []).map((code) => characters.find((asset) => asset.code === code)?.name), ...(shot.propCodes || []).map((code) => props.find((asset) => asset.code === code)?.name)].filter(Boolean);
    return names.length ? names.join("、") : "主体与当前可见道具";
}

function cleanNegativeText(value) {
    return String(value || "无字幕、无水印、无logo、无HUD、无现代元素、无未声明角色、无额外主体、无额外肢体、无变形")
        .replace(/无可辨识的?Ras或Ref/gu, "无未声明角色的可辨识面孔")
        .replace(/无可辨识的?(?:Ras|Ref)/gu, "无未声明角色的可辨识面孔")
        .replace(/[。；;]+$/u, "");
}

function staticShotSize(value, sequenceIndex = 1, visibleContent = "") {
    const labels = { ELS: "大远景", WS: "全景", LS: "远景", MS: "中景", MCU: "中近景", CU: "近景", ECU: "特写", OTS: "过肩中景" };
    const parts = String(value || "中景")
        .split(/\s*(?:→|->|至|\/)\s*/u)
        .map((part) => part.trim())
        .filter(Boolean);
    const selected = parts[Math.min(Math.max(sequenceIndex - 1, 0), parts.length - 1)] || "中景";
    if (/(?:ELS|极远景)/u.test(selected) && /(?:面部|眉眼|眼睛|下颌|嘴角|手部|手指|道具|剑刃|断剑|细节)/u.test(visibleContent)) return "中远景";
    return labels[selected] || selected;
}

function cleanStaticText(value) {
    return String(value || "")
        .replace(/\s*(?:→|->|至)\s*/gu, "，")
        .replace(/(?:镜头|运镜|推镜|拉镜|摇镜|跟拍|滑轨|环绕|下降|后拉|慢推|慢拉)[^；。]*/gu, "")
        .replace(/[,，、；;]\s*$/u, "")
        .trim();
}

function cleanPerformanceText(value) {
    return String(value || "")
        .replace(/沿当前镜头动作方向/gu, "朝向当前主体")
        .replace(/进入([^；。]+)/gu, "$1")
        .replace(/完成主要动作并保留反应停顿/gu, "身体保持当前姿态")
        .replace(/固定最终表情，避免切点前漂移/gu, "表情保持稳定")
        .replace(/指向下一动作或转场方向/gu, "视线朝向当前主体")
        .replace(/按本镜表演说明/gu, "")
        .replace(/[；。]{2,}/gu, "；")
        .replace(/^[；。]+|[；。]+$/gu, "")
        .trim();
}

function isGenericPerformance(value) {
    return /进入|连续反应|动作过渡|世界短暂失去常态|城市揭示|答案与新问题|裂纹似梦中断口|借她的记忆/u.test(value);
}

function videoPromptForShot(shot) {
    const states = frameStatesForShot(shot);
    const start = states[0];
    const end = states.at(-1) || start;
    const sound = [shot.sound?.ambience, shot.sound?.soundEffects, shot.sound?.music].filter(Boolean).join("；") || "保留现场环境声";
    const summary = shot.dramaticFunction ? `${shot.dramaticFunction}，完成本镜唯一主要变化` : "本镜完成唯一主要变化并落到明确结束状态";
    const continuity = shot.continuity?.continuityNotes || "角色身份、服装、道具归属、空间轴线与主光方向保持连续";
    const lines = [
        `动态意图：${summary}`,
        `单一主运镜：${shot.cameraMotion || "固定机位"}`,
        `环境压力与视觉母题：${sound}`,
        `结束画面：${shot.framePlan?.frames?.length ? "以时间段动作最后一段终点作为本镜唯一收束画面" : end}`,
        `连续性锁：${continuity}`,
        `风格：半写实动漫幻想风，暗黑学院史诗奇幻`,
        `针对性约束：${shot.negativePrompt || "无闪烁、无形变、无背景漂移、无身份跳变、无水印文字"}`,
        "时间段动作：",
    ];
    const frames = frameStatesForShot(shot);
    for (let index = 0; index < frames.length; index += 1) {
        const previous = frames[index - 1];
        const startState = previous || start;
        const endState = frames[index];
        const startSecond = Number(((shot.duration * index) / frames.length).toFixed(3));
        const endSecond = Number(((shot.duration * (index + 1)) / frames.length).toFixed(3));
        lines.push(
            `${startSecond}-${endSecond}s｜起点：${startState}`,
            `${startSecond}-${endSecond}s｜动作与触发：${shot.framePlan?.frames?.[index]?.actionPrompt || `${actionPhase(index, frames.length)}：${endState}`}`,
            `${startSecond}-${endSecond}s｜可见衔接：${previous ? "承接上一段终点" : "从镜头入口直接承接"}；${continuity}；只执行本段新增的可见变化`,
            `${startSecond}-${endSecond}s｜终点：${endState}`,
        );
    }
    return lines.join("\n");
}

function visiblePerformanceState(action, index, count) {
    if (/惊醒|睁眼|呼吸急促/u.test(action)) return index === 0 ? "表情：眉眼骤然睁开、下颌绷紧；视线：先落向断剑；手部：继续扣住握柄" : "表情：惊惧收束为警觉、嘴唇闭合；视线：稳定锁定断剑；肩膀：保持绷紧";
    if (/低头|掌心|完整剑刃/u.test(action)) return "表情：眉眼收紧、下颌保持克制；视线：向下落在掌心的完整剑刃；手部：四只手保持明确扣紧关系";
    if (/抬头|裂纹/u.test(action)) return "表情：眉眼睁大、下颌开始绷紧；视线：从掌心抬向倒悬古塔与剑刃裂纹；手部：双手收紧但不松开剑刃";
    if (/碎裂|断口|冷银碎屑/u.test(action)) return "表情：眉眼骤然睁大、下颌绷紧；视线：锁定断口；手部：手指继续扣住碎裂剑刃";
    if (/水囊|接住/u.test(action)) return "表情：紧张略缓、嘴角压住；视线：跟随水囊后短暂回看对方；手部：从待接变为握稳水囊";
    if (/车窗|结界|检查台|探测器/u.test(action)) return "表情：眉心收紧、眼神警觉；视线：锁定车窗外结界或黄铜探测器；手部：握紧当前道具";
    if (/否认|避开|隐瞒/u.test(action)) return "表情：嘴角压住、眉心轻收；视线：避开对方后短暂回看；手部：保持断剑接触";
    if (/护符|警觉|注视|探测器|结界/u.test(action)) return "表情：眉心收紧、眼神警觉；视线：锁定结界或探测器；手部：握紧当前道具";
    if (/解封|封印|力量|收力/u.test(action)) return "表情：下颌收紧后放松；视线：正对前方目标；手部：由蓄力转为稳定收力";
    if (/木匣|铜镜|短刃|断口|铁砧|裂纹/u.test(action)) return "表情：疑惑转为戒备；视线：锁定关键道具；手部：保持与断剑或道具的明确接触";
    if (index === 0) return "表情：眉眼清晰；视线：朝向当前主体；手部与道具保持明确接触关系";
    if (index === count - 1) return "表情：收束在稳定落点；视线：锁定下一叙事目标；手部与道具保持最终关系";
    return "表情：眉眼出现细微反应；视线：从前一目标转向当前目标；手部/道具：形成可见位置变化";
}

source.project.productionBible = {
    ...source.project.productionBible,
    targetPlatform: videoModel,
    continuityMode: "strict",
    productionPlan,
};
source.archive = {
    ...source.archive,
    sections: (source.archive?.sections || []).map((section) =>
        section.title === "资产映射与执行顺序"
            ? {
                  ...section,
                  content: `${section.content || ""}\n\n生产方案快照（导入后作为本集执行契约）：\n${JSON.stringify(productionPlan, null, 2)}\n\n多帧执行规则：每镜按 framePlan.frames 的 Pxx-Fxx 时间顺序执行，并按 referenceManifest 的 @图片N 顺序提交 images；连续镜头的 @图片1 仅接受上一镜当前视频版本、已人工验收的实际尾帧。`,
              }
            : section,
    ),
};

function buildSegmentPromptSection(episodes) {
    return episodes
        .flatMap((episode) =>
            episode.shots.map((shot) => {
                return `### P${String(shot.order).padStart(2, "0")}｜${shot.code}\n\n${shot.videoPrompt}`;
            }),
        )
        .join("\n\n");
}

const shots = source.episodes[0].shots;
source.episodes[0].shots = shots.map((shot, index) => {
    const previous = shots[index - 1];
    const normalizedShot = shot.code === "SH002" ? { ...shot, locationCode: "S06" } : shot;
    const referenceManifest = referencesForShot(normalizedShot, previous);
    const frames = frameBeatsForShot(normalizedShot);
    return {
        ...normalizedShot,
        videoMode: "reference",
        storyboardFrameMode: "all_frames",
        imagePrompt: frames[0].imagePrompt,
        videoPrompt: videoPromptForShot(normalizedShot),
        framePlan: {
            start: { source: previous ? "previous_accepted_actual_tail" : "independent" },
            end: { required: true },
            frames,
            referenceCount: { min: 3, max: 9 },
            referenceManifest,
        },
        continuityStatus: "planned",
        startFramePrompt: frames[0].imagePrompt,
        endFramePrompt: frames.at(-1).imagePrompt,
    };
});

const keyframeAssetFrames = { V01: ["SH001", 0], V02: ["SH007", 4], V03: ["SH008", 2], V04: ["SH012", 4] };
source.archive.promptAssets = (source.archive.promptAssets || []).map((asset) => {
    const frame = keyframeAssetFrames[asset.code];
    if (!frame) return asset;
    const shot = source.episodes.flatMap((episode) => episode.shots).find((item) => item.code === frame[0]);
    const framePrompt = shot?.framePlan.frames[Math.min(frame[1], shot.framePlan.frames.length - 1)]?.imagePrompt;
    return framePrompt ? { ...asset, prompt: framePrompt } : asset;
});
source.archive.sections = (source.archive.sections || []).map((section) => (/分段视频 Prompt/u.test(section.title) ? { ...section, content: buildSegmentPromptSection(source.episodes) } : section));

// The package format identifier is carried by the import contract; schemaVersion stays numeric for v1 parsing.
source.schemaVersion = 1;
fs.writeFileSync(targetPath, `${JSON.stringify(source, null, 2)}\n`, "utf8");

const sections = source.archive?.sections || [];
const sectionBody = sections
    .map((section) => {
        if (section.title !== "镜头执行表") return `## ${section.title}\n\n${section.content || ""}`;
        const rows = source.episodes.flatMap((episode) =>
            episode.shots.map((shot) => {
                const endState =
                    shot.exitState?.characters
                        ?.map((item) => item.action)
                        .filter(Boolean)
                        .join("；") ||
                    shot.endFramePrompt ||
                    "";
                return `| ${shot.code} | ${shot.timecode || ""} | ${shot.dramaticFunction || ""} | ${shot.continuity?.shotSize || ""} | ${shot.cameraMotion || ""} | ${shot.lens || ""} | ${shot.lighting || ""} | ${shot.colorPalette || ""} | ${shot.transitionOut || ""} | ${(shot.description || "").replaceAll("|", "／")} | ${endState.replaceAll("|", "／")} |`;
            }),
        );
        return ["## 镜头执行表", "", "| 镜号 | 时间 | 阶段 | 景别 | 运镜 | 焦段 | 灯光 | 色彩 | 转场 | 动作描述 | end_state |", "|---|---:|---|---|---|---:|---|---|---|---|---|", ...rows].join("\n");
    })
    .join("\n\n");
const markdown = [
    `# 《${source.project.title}》完整制作包`,
    "",
    "> 制作包格式：`vozeb-drama-production-package-v1`",
    "> 规范数据源：JSON；本文件由同一对象确定性导出。",
    `> 目标平台：${source.project.productionBible.targetPlatform || "未指定"}｜语言：${source.project.productionBible.language || "中文"}｜画幅：${source.project.ratio}｜成片：约 ${source.project.productionBible.targetDuration || 0} 秒`,
    "",
    "## 规范对象（导入权威数据）",
    "",
    "```drama-production-package",
    JSON.stringify(source, null, 2),
    "```",
    "",
    sectionBody,
    "",
].join("\n");
fs.writeFileSync(targetMarkdownPath, markdown.replace(/\n+$/u, "\n"), "utf8");
console.log(`Wrote ${path.relative(root, targetPath)} and ${path.relative(root, targetMarkdownPath)} (${source.episodes[0].shots.length} shots)`);
