import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import pg from "pg";

const projectId = "drama-KLQPfB77uyRXRnBjFvRpY";
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const packagePath = new URL("../../output/mahadel-episode-01-production-package-v2-multiframe.json", import.meta.url);
const packageValue = JSON.parse(fs.readFileSync(packagePath, "utf8"));

const mahadelOpeningSegments = new Map([
    ["SH001", { description: "黑湖无波，倒悬古塔压住 Karin 的倒影；雪地四只手扣紧，Karin 握住完整剑刃", actionStart: "黑湖、倒悬古塔、四只手与完整剑刃静止相持", actionEnd: "Karin 掌心的完整剑刃裂开，四只手仍未松开" }],
    ["SH002", { description: "冷银断口匹配切进马车；Karin 睁眼，手继续扣住断剑，呼吸急促", actionStart: "Karin 掌心的完整剑刃裂开，四只手仍未松开", actionEnd: "Karin 在马车中完全惊醒，手扣断剑，呼吸急促" }],
    ["SH003", { description: "Rifa 等 Karin 呼吸平复，轻声问起梦境；Karin 避开视线否认", actionStart: "Karin 惊醒后手仍扣在断剑上，呼吸未稳", actionEnd: "Karin 避开 Rifa 的视线，否认刚才的梦境" }],
    ["SH004", { description: "Rifa 看向过分平整的皇家道路调侃，把水囊沿座椅推向 Karin", actionStart: "Karin 避开 Rifa 的视线，否认刚才的梦境", actionEnd: "水囊停在 Karin 手边，Rifa 收回目光" }],
    ["SH005", { description: "Karin 接住水囊，Rifa 移开视线，车内短暂恢复日常", actionStart: "水囊停在 Karin 手边，Rifa 收回目光", actionEnd: "Karin 接住水囊，Rifa 移开视线，车内短暂恢复日常" }],
]);

const dynamicFrameBeats = {
    SH003: [
        { action: "车窗外的结界冷光逼近马车；Karin低头看向正在熄灭的护符，Rifa转头确认他的反应", image: "马车内Karin低头看向掌中的护符，护符只剩最后一点微光；Rifa在对面转头看他，车窗外结界冷光刚映上两人的脸" },
        { action: "结界光线扫过车厢；护符短促闪烁后熄灭，Karin抬头，Rifa的视线转向车窗外", image: "护符已经熄灭，Karin抬头看向车窗，冷色结界纹理横过他的眼睛；Rifa侧身望向逼近的结界" },
        { action: "Karin伸手重新握住失灵的护符；Rifa向车窗靠近，车厢座位随马车转弯轻晃", image: "Karin五指收紧握住失灵护符，手腕停在胸前；Rifa已经靠近车窗，结界冷光切过她的侧脸" },
        { action: "结界光在护符表面反射后彻底消失；Karin与Rifa同时把视线锁向车外，身体进入警戒姿态", image: "护符表面没有光，冷色结界倒影占据车窗；Karin肩膀绷紧，Rifa前倾，两人的视线同时落向车外" },
        { action: "马车驶入结界边缘；Karin扣住护符，Rifa望向结界深处，二人以警觉姿态迎接盘查", image: "Karin扣住已经熄灭的护符，Rifa望向车窗外的结界入口；两人坐姿和视线落在明确的警戒终点" },
    ],
    SH004: [
        { action: "马车穿过结界薄膜；折射光掠过Karin与Rifa的脸，城门法师从远处转头", image: "马车刚穿过半透明结界，冷光纹理横过Karin和Rifa的脸；城门法师在背景转头注视他们" },
        { action: "两人下车走到检查台前；检查官抬起黄铜探测器，对准Karin腰间的断剑", image: "Karin与Rifa刚停在检查台前，检查官举起黄铜探测器对准Karin腰间断剑，法师仍在后方观察" },
        { action: "探测器指针从零位抬起又回落；Karin收住脚步，Rifa把视线从检查官移向指针", image: "黄铜探测器已经靠近断剑，指针停在零位；Karin站在台前收住脚步，Rifa侧眼看向空白刻度" },
        { action: "检查官把探测器转向Rifa；Karin与Rifa短暂交换视线，三人的站位被检查台拉开", image: "探测器转向Rifa，Karin回头与她短暂对视；检查官横在两人和城门之间，检查台形成清晰前景" },
        { action: "探测器完全举在两人之间并保持零读数；法师的注视落定，二人停在检查台前等待放行", image: "黄铜探测器停在两人之间，指针仍指向零；Karin和Rifa站在检查台前，背景法师的目光已经锁定他们" },
    ],
    SH005: [
        { action: "探测器屏幕保持空白；检查官的手停在读数上方，Karin与Rifa看向同一块空白刻度", image: "黄铜探测器的刻度盘完全空白，检查官手指停在盘面上方；Karin和Rifa的视线同时落向空白读数" },
        { action: "锁链从闸门上方开始下落；Karin抬眼看向闸门，Rifa向后撤开半步", image: "闸门锁链刚从高处垂下，Karin抬头看向锁链，Rifa已经退到他的后侧，空白探测器仍在前景" },
        { action: "Karin向前迈出半步挡在Rifa前面；检查官收回探测器，闸门继续下降", image: "Karin已经前移半步挡在Rifa身前，肩线切开两人距离；检查官收回探测器，沉重闸门压低在背景" },
        { action: "锁链绷直，闸门落到闭合位置；Rifa侧身避开，Karin的手移向腰后断剑", image: "闸门已经完全闭合，锁链绷直；Rifa侧后站位，Karin的手停在腰后断剑附近，三人被封在同一侧" },
        { action: "空白读数映在闸门金属上；Karin挡在前方，Rifa保持侧后，盘查现场落入封锁结果", image: "闸门金属反射出空白探测器刻度，Karin站在前方护住Rifa，锁链和检查台把封锁结果固定在画面中" },
    ],
    SH006: [
        { action: "Karin拇指轻敲断剑护手发出旧信号；Rifa从侧后看见信号，双手仍垂在身侧", image: "Karin拇指停在断剑护手上，敲击刚结束；Rifa在侧后抬眼确认，两人的手与断剑形成明确信号关系" },
        { action: "Rifa回敲同一节奏；两人同时转正肩线，手臂抬向尚未打开的封印线", image: "Karin与Rifa的肩线已经对齐，两只手分别抬到封印线两侧；Rifa刚完成回敲，目光与Karin相接" },
        { action: "两人同时把力量压入封印；银色细线从闸门缝隙亮起，尘埃被压力托离地面", image: "闸门缝隙出现一条银色亮线，Karin和Rifa的手掌朝向封印；地面尘埃悬起，力量刚进入可见结果" },
        { action: "封印向内凹陷，旗帜与衣角在无声压力中停住；两人手臂绷紧后开始收力", image: "封印线向两人之间凹陷，悬停尘埃和停住的旗帜占据背景；Karin与Rifa手臂绷紧，表情从用力转向克制" },
        { action: "两人完全并肩站定，只保留一线未开的封印；Karin与Rifa同时看向闸门缝隙，旧信号动作落到结果", image: "Karin与Rifa肩并肩站在封印前，银线停在即将打开的位置；两人的视线共同落向缝隙，断剑和手部关系清晰" },
    ],
    SH007: [
        { action: "封印压力扩散；旗帜、尘埃和探测器指针同时停住，世界短暂失去惯性", image: "城门前旗帜悬停在半空，尘埃凝住，黄铜探测器指针停在裂开的刻度上；Karin与Rifa站在冻结的空间中心" },
        { action: "闸门周围的结界向两人凹陷；Karin与Rifa保持伸手姿态，远处高塔观察者转身看向异常", image: "结界像被无形力量压向Karin与Rifa，二人手臂仍伸向封印；高塔远处的观察者转身，银戒反射冷光" },
        { action: "封印裂开一道可通行的银白缝隙；两人的力量达到峰值，闸门链条从内部断开", image: "闸门中央出现银白缝隙，断开的链条垂落两侧；Karin与Rifa的手掌停在力量峰值，冷光照亮地面" },
        { action: "Karin先收回力量，Rifa慢半拍跟上；两人重新踩稳，闸门在身后开始打开", image: "Karin已经收回手臂并站稳，Rifa正从蓄力姿态放下手；闸门向两侧打开，地面尘埃重新落下" },
        { action: "闸门完全打开；Karin与Rifa并肩站定，远处观察者隔着城市纵深继续注视", image: "打开的闸门形成前景框景，Karin与Rifa站在城门内侧，远处高塔上的观察者仍望向他们，结果关系固定" },
    ],
    SH008: [
        { action: "城市沿陡坡在两人面前展开；Karin抬头寻找上行道路，Rifa与他并肩走在同一动线上", image: "阿佐雷斯城市沿陡坡向上叠起，Karin仰头看向高处道路，Rifa在他身侧并肩前行，断剑贴在腰后" },
        { action: "断剑撞上路边手推车；Karin立刻伸手护住剑鞘，Rifa停下半步看向他的手", image: "手推车刚被断剑碰到，Karin的手已经压住剑鞘，木轮停在前景；Rifa侧身看向他的手，城市坡道延向背景" },
        { action: "Rifa放慢脚步与Karin对齐；她的视线从断剑移到Karin脸上，Karin把目光留在坡道前方", image: "Rifa已经放慢并与Karin肩线对齐，目光落在他的脸上；Karin仍望向坡道上方，手没有离开剑鞘" },
        { action: "Karin的手从剑鞘边缘稍微松开又重新扣住；Rifa侧头等待回答，两人的步伐在坡道转折处停顿", image: "坡道转折处，Karin手指从剑鞘边缘短暂松开又扣回；Rifa侧头看他，两人的脚步刚停在同一台阶" },
        { action: "两人重新并肩走到上行坡道尽头；Karin避开Rifa的视线，Rifa把目光投向前方门口", image: "Karin与Rifa并肩抵达上行坡道尽头，Karin视线避开她，Rifa望向前方门口；断剑位置和两人站位落定" },
    ],
    SH009: [
        { action: "Edia Knight木门上的银色裂痕映入Karin眼中；他停在门外，手指靠近腰后断剑", image: "木门上的银色裂痕占据前景，纹路与梦中断口相同；Karin停在门外看向裂痕，手指悬在腰后断剑旁" },
        { action: "木门向内打开；Karin与Rifa停在门槛，奥伦背对站在炉光深处", image: "木门已经打开一半，Karin与Rifa停在门槛外；奥伦背对他们立在暗琥珀炉光与银纹冷光交界处" },
        { action: "Karin把靠近断剑的手收回衣侧；Rifa向门内探看，奥伦仍不回头，三人的纵深开始拉开", image: "Karin的手已经收回衣侧，身体略向后收；Rifa向门内探看，奥伦背对站在铁砧前，门框分隔三人" },
        { action: "Rifa转头确认Karin的反应；Karin避开她的视线，把梦境藏回沉默，奥伦的肩膀微微转动", image: "Rifa侧头看向Karin，Karin把脸转向门内避开目光；奥伦肩膀刚开始转动，炉光压在他的背上" },
        { action: "三人停在门槛关系中；奥伦背对门内，Karin与Rifa并立门外，银纹冷光与炉火形成明确分界", image: "Karin与Rifa并立在门槛外，奥伦背对站在炉火深处；门上银纹冷光和室内炉光把三人的空间关系固定" },
    ],
    SH010: [
        { action: "奥伦从铁砧旁抬眼质疑断剑为何被打断；Karin站在铁砧前，Rifa留在门侧观察", image: "奥伦抬眼看向Karin和腰后断剑，铁砧占据前景；Karin站在铁砧前，Rifa在门侧保持旁观位置" },
        { action: "Karin取下断剑平放到铁砧上；Rifa的视线跟随剑身，奥伦伸手取来无头锤柄", image: "断剑已经平放在铁砧中央，Karin的手刚离开剑柄；Rifa看向剑身，奥伦从铁砧旁拿起无头锤柄" },
        { action: "奥伦把锤柄缓缓对准断口；Karin收紧手指但没有阻止，Rifa向门侧退开半步", image: "无头锤柄已经抵住断剑断口，奥伦的手压在上方；Karin手指收紧，Rifa退到门侧，三层站位清晰" },
        { action: "锤柄触碰断口，炉火收成一线；Karin抬头看向奥伦，断剑裂痕映出冷银光", image: "锤柄刚触到断口，炉火缩成铁砧旁的一线暗光；Karin抬头看奥伦，裂痕在冷银反光中清晰可见" },
        { action: "锤柄停在断口上，三人不再移动；奥伦的手、Karin的断剑和Rifa的视线共同落到被打断的结果", image: "无头锤柄稳定抵在断剑断口，Karin站在铁砧前，奥伦的手没有移开，Rifa从门侧注视断口，结果状态成立" },
    ],
    SH011: [
        { action: "断剑旁的记忆残影显出一条暗红线；Karin低头看向自己的手腕，Rifa发现线条与她的辫绳相似", image: "炉火收缩后的铁砧旁，Karin手腕上浮出暗红线残影；Rifa看向那条线，奥伦停在冷光边缘" },
        { action: "暗红线沿Karin手腕向断剑延伸；Karin想把手收回，Rifa抬手阻止他的动作", image: "暗红线已经连接到Karin握剑的手腕，Karin正要收手；Rifa的手悬在他腕前，奥伦的目光落向两只手" },
        { action: "Rifa抓住Karin手腕；她的辫绳与记忆中的红线重合，奥伦向前半步确认相接的手", image: "Rifa已经扣住Karin手腕，暗红辫绳与腕上红线并列；奥伦向前半步，视线集中在两人相接的手" },
        { action: "Karin的手腕在Rifa掌中绷紧又停住；Rifa没有松手，奥伦的手停在断剑上方", image: "Karin手腕在Rifa掌中绷紧，手指停在断剑旁；Rifa牢牢扣住他，奥伦的手悬在断剑上方，三点关系形成" },
        { action: "暗红线与辫绳同时落入冷光；Rifa仍抓住Karin，奥伦注视相接的手，记忆结果切回现实", image: "冷光压过炉火，Rifa的手仍扣住Karin腕部，奥伦俯视两人相接的手；暗红线和辫绳形成清晰的记忆回声" },
    ],
    SH012: [
        { action: "奥伦的解释停在半句；窄木匣从铁砧下被推到前景，Karin与Rifa同时把视线移向匣面", image: "窄木匣已经停在铁砧边，Karin和Rifa的视线从奥伦转向匣面；奥伦的手留在匣盖旁，炉火压低" },
        { action: "木匣盖弹开，四个微光点依次亮起；Rifa的手靠近短刃，Karin盯住匣内的冷光", image: "木匣盖已经打开，四个微光点在黑色内衬上亮起；Rifa手指靠近短刃柄，Karin俯身看向匣内" },
        { action: "烟黑铜镜在匣内反射出高塔观察者；Karin抬头，Rifa转向镜面，奥伦的手停在熄灭的炉膛旁", image: "烟黑铜镜已经映出高塔观察者的轮廓，Karin与Rifa同时转向镜面；奥伦停在暗下来的炉膛旁" },
        { action: "炉火完全熄灭，铜镜中的观察者保持清晰；短刃从鞘中滑出半寸，三人的视线被镜面分开", image: "炉火已经熄灭，铜镜仍映着高塔观察者；短刃露出半寸停在匣边，Karin、Rifa和奥伦的视线分别落向镜面与刀口" },
        { action: "木匣四点微光、铜镜观察者和半出鞘短刃同时落入静止终点；答案结束，新问题被留下", image: "暗室中木匣四点微亮，铜镜映着高塔观察者，短刃出鞘半寸；Karin与Rifa停在匣前，奥伦留在熄灭炉膛旁" },
    ],
};

function text(value) {
    return typeof value === "string" ? value.trim() : "";
}

function metadataAction(value) {
    const action = text(value);
    return !action || /^生成\d+秒/u.test(action) || /^(?:深蓝黑、|无字幕、|口型同步、|拟亲情关系、|本内部镜头只执行：|保持角色、道具、轴线|(?:耳语|对白|旁白|台词)[:：])/u.test(action);
}

function groupedActions(shot) {
    const frames = Array.isArray(shot.framePlan?.frames) ? shot.framePlan.frames : [];
    const source = [shot.continuity?.actionStart, ...frames.map((frame) => frame.actionPrompt), ...String(shot.videoPrompt || "").split(/[。；;\n]+/u), shot.continuity?.actionEnd, shot.description];
    const actions = source.map(cleanVisibleAction).filter(isVisualAction);
    const unique = [...new Map(actions.map((action) => [action, action])).values()];
    const start = cleanVisibleAction(shot.continuity?.actionStart);
    const end = cleanVisibleAction(shot.continuity?.actionEnd);
    const middle = unique.filter((action) => action !== start && action !== end);
    return [...new Set([start, ...middle, end].filter(Boolean))].slice(0, 4);
}

function isVisualAction(action) {
    return action.length > 3 && /[\p{L}\p{N}]/u.test(action) && !metadataAction(action) && !/(?:镜头|运镜|推镜|拉镜|摇镜|跟拍|拍摄|口型|对白|旁白|耳语|说：|问：|回答：|无字幕|无水印|无logo|无现代|无额外|禁止|避免|没有)/u.test(action);
}

function cleanVisibleAction(value) {
    return text(value)
        .replace(/^生成\d+(?:\.\d+)?(?:秒|s)[^。；\n]*视频[^。；\n]*[。；]?/iu, "")
        .replace(/(?:Karin低头，双手垂落|Karin抬眼，右手收紧握住衣角|关键道具移入Karin手边并被她扣住|Karin视线锁定前方，握剑的手停在胸前)/gu, "")
        .replace(/[“"][^”"]{0,160}[”"]/gu, "")
        .replace(/(?:耳语|对白|旁白|台词|询问|回答|问)[:：][^；。\n]*/gu, "")
        .replace(/(?:Karin|Rifa|奥伦|检查官|记忆)[:：][^；。\n]*/gu, "")
        .replace(/(?:Karin|Rifa|奥伦|检查官|观察者)\s*（[^）]*）?[:：][^；。\n]*/gu, "")
        .replace(/(?:再开口|开口|低声|回答过快|回应)[:：][^；。\n]*/gu, "")
        .replace(/^\d+mm[^；。\n]*[；。]?/u, "")
        .replace(/^(?:镜头)?沿[^；。\n]*(?:推|拉|摇|跟拍|环绕)[^；。\n]*[；。]?/u, "")
        .replace(/^(?:无对白|无台词)[；。]?/u, "")
        .replace(/(?:镜头运动|运镜|推镜|拉镜|摇镜|跟拍|拍摄)[:：]?[^；。\n]*/gu, "")
        .replace(/(?:口型同步|无字幕|无水印|无logo|无浪漫凝视|无现代[^；。\n]*|无额外[^；。\n]*|禁止[^；。\n]*|避免[^；。\n]*)/gu, "")
        .replace(/(?:银白转冷紫黑|深蓝黑与炉火琥珀|雾蓝灰与皮革棕|冷灰蓝与雪白)[；。]?/gu, "")
        .replace(/[“”"']/gu, "")
        .replace(/^\s*(?:Karin|Rifa|奥伦|检查官|观察者|记忆)\s*[:：]\s*/u, "")
        .replace(/[；，,。\s：:]+$/gu, "")
        .trim();
}

function fiveFramePlan(shot) {
    const duration = Math.max(1, Number(shot.duration) || 5);
    const dynamic = dynamicFrameBeats[shot.code];
    if (dynamic && duration === 15) return openingCutFrames(shot.code, duration, dynamic);
    if (shot.code === "SH001" && duration === 15)
        return openingCutFrames("SH001", duration, [
            { action: "黑湖与倒悬古塔建立空间；Karin低头，完整剑刃贴在掌心，四只手刚刚扣住", image: "黑湖无波，倒悬古塔与Karin模糊倒影对齐；雪地中央四只手刚刚扣住，Karin低头看向掌心的完整剑刃" },
            { action: "镜头向雪地与四只手推进；Karin抬头看向倒悬古塔，双手收紧，完整剑刃出现第一道银色裂纹", image: "雪地中央四只手彼此扣紧；Karin抬头看向倒悬古塔，双手收紧，完整剑刃出现第一道银色裂纹" },
            { action: "剑刃从掌心断口向外裂开，冷银碎屑飞出；Karin眉眼骤然睁大，下颌绷紧，四只手仍扣住断剑", image: "剑刃已经从掌心断口向外裂开，冷银碎屑停在断口周围；Karin眉眼骤然睁大、下颌绷紧，四只手仍扣住断剑" },
            { action: "裂纹扩展成断口，镜头落到冷银碎片；Karin手指仍扣住剑刃，视线从断口转向无法解释的裂痕", image: "冷银断口占据前景中心，Karin手指扣住碎裂剑刃，视线锁定断口，银色碎屑停在掌心附近" },
            { action: "断口冷光成为匹配切入口；Karin在马车中猛然睁眼，手扣断剑，呼吸急促并完全惊醒", image: "马车内Karin完全惊醒，灰绿色眼睛锁定断剑握柄，肩膀绷紧，手掌稳定扣住断剑；车厢冷光与暗影关系落定" },
        ]);
    if (shot.code === "SH002" && duration === 15)
        return openingCutFrames("SH002", duration, [
            { action: "Rifa转向刚惊醒的Karin；Karin手仍扣住断剑，视线避开对方，车厢随车轮轻晃", image: "马车内Rifa转向Karin，Karin手仍扣住断剑，眼睛刚从惊醒中收回，视线避开Rifa" },
            { action: "镜头向两人推进；Rifa抬眉等待回答，Karin短暂抬眼又移开，嘴角压住否认梦境", image: "Rifa眉心微收看向Karin；Karin抬眼与她短暂对视后移开视线，嘴角压住，手指仍扣住断剑" },
            { action: "Rifa把水囊沿座椅推向Karin；Karin的视线跟随水囊，手从断剑旁抬起准备接住", image: "水囊已经滑到Karin手边，Karin抬手接住，Rifa的目光停在他的手上，车窗冷光掠过座椅" },
            { action: "Karin接住水囊并缓下呼吸；腰间护符短促闪烁后熄灭，Rifa的目光转向护符", image: "Karin双手握住水囊，肩膀略微放松；腰间护符刚熄灭，Rifa转头看向护符，车厢气氛重新收紧" },
            { action: "两人把视线落向逼近的皇家结界；Karin收回握水囊的手，Rifa停止追问，镜头落在车窗外的冷光", image: "Karin握住水囊望向车窗外，Rifa也转向逼近的皇家结界；两人坐姿与道具位置落在克制的结果状态" },
        ]);
    if (shot.code === "SH001" && duration === 8)
        return openingCutFrames("SH001", duration, [
            { action: "黑湖远景建立后，镜头向雪地推进；Karin低头，完整剑刃贴在掌心，四只手刚刚扣住", image: "黑湖无波，倒悬古塔与Karin模糊倒影对齐；雪地中央四只手刚刚扣住，Karin低头看向掌心的完整剑刃" },
            { action: "镜头继续推进到四只手与剑；Karin抬头看向倒悬古塔，双手收紧，剑身出现第一道裂纹", image: "雪地中央四只手彼此扣紧；Karin抬头看向倒悬古塔，双手收紧，完整剑刃出现第一道银色裂纹" },
            { action: "剑刃从掌心断口向外裂开，冷银碎屑飞出；Karin眉眼骤然睁大，四只手仍未松开", image: "剑刃已经从掌心断口向外裂开，冷银碎屑停在断口周围；Karin眉眼骤然睁大、下颌绷紧，四只手仍扣住断剑" },
            { action: "镜头骤停在冷银断口，Karin手指扣住碎裂剑刃；断口冷光匹配切入马车", image: "冷银断口占据前景中心，Karin手指扣住碎裂剑刃，视线锁定断口；断口冷光形成下一镜马车窗光的匹配切入口" },
        ]);
    if (shot.code === "SH002" && duration === 7)
        return openingCutFrames("SH002", duration, [
            { action: "冷银断口匹配切入马车内同一只扣紧的手；车厢开始震动，Karin仍闭眼", image: "马车内同一只手压住断剑，指节发白，Karin闭眼伏在座位上；冷银断口方向与上一镜一致" },
            { action: "车轮震动传入车厢；Karin肩膀骤然绷紧，手掌继续压住断剑", image: "马车内Karin肩膀绷紧，手掌压住断剑，指节发白；车窗冷光在剑柄上形成短促反光" },
            { action: "Karin猛然睁开灰绿色眼睛，视线落向断剑，呼吸急促；手指收紧握柄", image: "Karin灰绿色眼睛已经睁开，视线落向断剑，嘴唇微张急促吸气；手指收紧握住断剑" },
            { action: "镜头短促推近眼睛与剑柄之间；Karin完全惊醒，视线锁定握柄，肩膀绷紧", image: "Karin完全惊醒，灰绿色眼睛锁定断剑握柄，肩膀绷紧，手掌稳定扣住断剑；车厢冷光与暗影关系已经落定" },
        ]);
    const actionStart = text(shot.continuity?.actionStart) || text(shot.description) || text(shot.title);
    const actionEnd = text(shot.continuity?.actionEnd) || text(shot.description) || text(shot.title);
    const stateSuffixes = ["动作入口已成立，主体处于可辨识准备姿态", "主体重心、视线或手部位置相对入口已经改变", "关键动作已经发生，道具或环境出现可见结果", "主体对结果作出可见反应，视线与姿态发生转向", "动作结果已经成立，手部与目标道具落在明确终点"];
    const actions = [...new Set([actionStart, text(shot.description), actionEnd].map(cleanVisibleAction).filter(isVisualAction))];
    if (shot.code === "SH001") actions.unshift("黑湖无波，倒悬古塔与Karin模糊倒影对齐");
    while (actions.length < 5) actions.push(`${actions.at(-1) || actionStart}；${stateSuffixes[actions.length]}`);
    if (shot.code === "SH001") actions[4] = "Karin在马车中完全惊醒，手扣断剑，呼吸急促";
    const frameCount = 5;
    const continuity = shot.continuity || {};
    const context = [
        /(?:ELS|极远景)/u.test(text(continuity.shotSize)) ? "中远景" : (text(continuity.shotSize) || "电影中景").split(/\s*(?:→|->|至)\s*/u)[0],
        text(continuity.cameraAngle) || "视线高度平视，沿动作轴线拍摄",
        text(continuity.composition) || "主体保持在 9:16 安全区",
        `站位与视线：${text(continuity.characterBlocking) || "按动作关系安排站位"}；${text(continuity.gazeDirection) || "沿叙事动作方向"}`,
        `灯光与色彩：${text(shot.lighting) || "延续主光"}；${text(shot.colorPalette) || "沿用项目主色板"}`,
    ].join("；");
    return actions.slice(0, 5).map((action, index) => {
        const startSecond = Number(((duration * index) / frameCount).toFixed(3));
        const endSecond = index === frameCount - 1 ? duration : Number(((duration * (index + 1)) / frameCount).toFixed(3));
        return {
            id: `${shot.code}-F${String(index + 1).padStart(2, "0")}`,
            sequenceIndex: index + 1,
            startSecond,
            endSecond,
            actionPrompt: `${actionPhase(index, frameCount)}：${action}；${visibleFrameState(action, index, frameCount)}`,
            imagePrompt: `静态关键帧：${action}；可见状态：${stateSuffixes[index]}；可见表演状态：${visibleFrameState(action, index, frameCount)}；景别：${context.split("；")[0]}；机位与构图：${context.split("；").slice(1, 3).join("；")}，9:16安全区，前景有具体框景；站位与视线：${context.split("；").slice(3, 5).join("；")}；三层空间：前景为框景遮挡，中景承载主体与道具，背景交代环境纵深；光色与风格：${context.split("；").slice(-1)[0]}，材质纹理自然；参考图职责：按本镜已绑定角色、场景、道具和连续性图片各司其职；负面约束：无字幕、无水印、无logo、无HUD、无现代元素、无额外主体、无额外肢体、无变形。`,
        };
    });
}

function actionPhase(index, count) {
    if (index === 0) return "建立场景与动作入口";
    if (index === count - 1) return "落到结果、反应或转场";
    if (index === count - 2) return "执行关键动作";
    return "镜头推进并改变主体状态";
}

function visibleFrameState(action, index, count) {
    if (/惊醒|睁眼|呼吸急促/u.test(action)) return index === count - 1 ? "表情由惊惧收束为警觉，视线稳定锁定断剑，肩膀绷紧" : "眉眼骤然睁开、下颌绷紧，视线落向断剑，手部继续扣住握柄";
    if (/否认|避开|隐瞒/u.test(action)) return "眉心轻收、嘴角压住，视线先避开对方后短暂回看，手部保持道具接触";
    if (/接住|水囊|推过去/u.test(action)) return "表情紧张略缓，视线跟随水囊，手部从待接变为握稳";
    if (/护符|警觉|注视|探测器|结界/u.test(action)) return "眉心收紧、眼神警觉，视线锁定结界或探测器，手部握紧当前道具";
    if (/解封|封印|力量|收力/u.test(action)) return "下颌收紧后放松，视线正对目标，手部由蓄力转为稳定收力";
    if (/木匣|铜镜|短刃|断口|铁砧|裂纹/u.test(action)) return "表情由疑惑转为戒备，视线锁定关键道具，手部保持明确接触关系";
    if (index === 0) return "表情与视线落在动作入口，手部与道具形成明确起点关系";
    if (index === count - 1) return "表情、视线与手部关系落在动作结果，目标道具位置清晰";
    return "眉眼出现反应，视线转向当前目标，手部或道具位置相对入口发生变化";
}

function openingCutFrames(code, duration, actions) {
    const stateLabels = [
        "动作入口已成立，主体处于可辨识准备姿态",
        "镜头推进后主体重心、视线或手部位置已经改变",
        "关键动作已经发生，道具或环境出现可见结果",
        "结果状态继续发展，主体反应或道具关系已经转向",
        "结果状态与转场落点已经成立，主体姿态和道具位置清晰",
    ];
    const boundaries = actions.map((_, index) => Number(((duration * index) / actions.length).toFixed(3))).concat(duration);
    return actions.map((action, index) => {
        const actionText = typeof action === "string" ? action : action.action;
        const imageText = typeof action === "string" ? action : action.image;
        return {
            id: `${code}-F${String(index + 1).padStart(2, "0")}`,
            sequenceIndex: index + 1,
            startSecond: boundaries[index],
            endSecond: boundaries[index + 1],
            actionPrompt: `${actionPhase(index, actions.length)}：${actionText}`,
            imagePrompt: `静态关键帧：${imageText}；可见状态：${stateLabels[index]}；可见表演状态：${visibleFrameState(actionText, index, actions.length)}；必要连续性：人物身份、服装、道具材质、空间轴线和光向连续；只呈现当前时间点已经发生的静态结果，不表现运动过程。`,
        };
    });
}

function splitTitle(title) {
    const match = text(title).match(/^(.*?)\s+(\d+)\/(\d+)$/u);
    return match ? { base: match[1].trim(), part: Number(match[2]), total: Number(match[3]) } : undefined;
}

function splitVisualActions(shot) {
    return [
        ...new Set(
            [shot.description, shot.continuity?.actionStart, shot.continuity?.actionEnd, ...(shot.exitState?.characters || []).map((item) => item.action), ...(shot.exitState?.props || []).map((item) => item.state)].flatMap((value) =>
                text(value)
                    .split(/[\n。！？!?；;]+/u)
                    .map(cleanVisibleAction)
                    .filter(isVisualAction),
            ),
        ),
    ];
}

function repairSplitGroup(group) {
    const actions = [...new Set(group.flatMap(splitVisualActions))];
    if (!actions.length) actions.push(text(group[0].description) || text(group[0].title));
    const finalAction = text(group.at(-1)?.continuity?.actionEnd) || actions.at(-1);
    let previousAction = text(group[0].continuity?.actionStart) || actions[0];
    return group.map((shot, index) => {
        const override = mahadelOpeningSegments.get(shot.code);
        const from = Math.floor((index * actions.length) / group.length);
        const to = Math.max(from + 1, Math.floor(((index + 1) * actions.length) / group.length));
        const description = override?.description || splitVisualActions(group[index])[0] || actions.slice(from, to).join("；");
        const actionStart = override?.actionStart || previousAction;
        const actionEnd = override?.actionEnd || (index === group.length - 1 ? finalAction : description);
        previousAction = actionEnd;
        const next = {
            ...shot,
            description,
            imagePrompt: `${actionStart}到${actionEnd}，${text(shot.continuity?.shotSize) || "电影景别"}，${text(shot.lighting) || "延续主光"}，9:16安全构图，人物头顶与底部字幕区留白`,
            videoPrompt: `本内部镜头只执行：${actionStart}到${actionEnd}。保持角色、道具、轴线和前后状态连续。`,
            continuity: { ...shot.continuity, actionStart, actionEnd },
        };
        return { ...next, framePlan: { ...next.framePlan, frames: fiveFramePlan(next) } };
    });
}

function repairEpisode(episode) {
    const nextShots = [];
    for (let index = 0; index < (episode.shots || []).length;) {
        const parsed = splitTitle(episode.shots[index].title);
        const group = parsed?.part === 1 ? episode.shots.slice(index, index + parsed.total) : [];
        if (
            group.length === parsed?.total &&
            group.every((shot, part) => {
                const title = splitTitle(shot.title);
                return title?.base === parsed.base && title.part === part + 1 && title.total === parsed.total;
            })
        ) {
            nextShots.push(...repairSplitGroup(group));
            index += parsed.total;
            continue;
        }
        const shot = episode.shots[index];
        nextShots.push({ ...shot, framePlan: { ...shot.framePlan, frames: fiveFramePlan(shot) } });
        index += 1;
    }
    return { ...episode, shots: nextShots };
}

function updatePackage(value) {
    const fixedTitles = [
        "一、项目总览",
        "二、原创第一章",
        "三、第一集文学剧本",
        "四、镜头执行表",
        "五、角色一致性资产",
        "六、场景一致性资产",
        "七、关键视频资产 Prompt",
        "八、全案板 Prompt",
        "九、台词与表演脚本",
        "十、声音设计",
        "十一、分段视频 Prompt",
        "十二、资产映射与执行顺序",
        "十三、QC 报告",
    ];
    value.project.productionBible.productionPlan.video.frameCount = 5;
    value.episodes = (value.episodes || []).map(repairEpisode);
    value.archive = {
        ...value.archive,
        sections: (value.archive?.sections || []).map((section, index) => {
            section = { ...section, title: fixedTitles[Number(String(section.code || "").replace(/\D/g, "")) - 1] || fixedTitles[index] || section.title };
            if (section.title.includes("分段视频 Prompt")) {
                const content = value.episodes[0].shots
                    .map(
                        (shot) =>
                            `### ${shot.code} ${shot.title}\n${shot.framePlan.frames.map((frame) => `- P${String(shot.order).padStart(2, "0")}-F${String(frame.sequenceIndex).padStart(2, "0")} ${frame.startSecond}-${frame.endSecond}s：${frame.actionPrompt}`).join("\n")}`,
                    )
                    .join("\n\n");
                return { ...section, content: `默认每镜 5 个连续剧情帧；用户可在 1-9 帧范围内明确调整。\n\n${content}` };
            }
            if (section.title.includes("资产映射与执行顺序")) {
                return {
                    ...section,
                    content: `生产方案快照（导入后作为本集执行契约）：\n${JSON.stringify(value.project.productionBible.productionPlan, null, 2)}\n\n多帧执行规则：默认每镜 5 个连续剧情帧，按 Pxx-Fxx 顺序执行；用户明确指定的 1-9 帧优先。15/20 秒片段提交前校验分镜帧与固定资产图合计不超过 9 张，30 秒片段不超过 30 张；连续镜头的首帧只接受上一镜已人工验收的实际尾帧。`,
                };
            }
            return section;
        }),
    };
    return value;
}

function serializeMarkdown(value) {
    const fixedTitles = [
        "一、项目总览",
        "二、原创第一章",
        "三、第一集文学剧本",
        "四、镜头执行表",
        "五、角色一致性资产",
        "六、场景一致性资产",
        "七、关键视频资产 Prompt",
        "八、全案板 Prompt",
        "九、台词与表演脚本",
        "十、声音设计",
        "十一、分段视频 Prompt",
        "十二、资产映射与执行顺序",
        "十三、QC 报告",
    ];
    const sections = (value.archive?.sections || []).map((section, index) => `## ${fixedTitles[Number(String(section.code || "").replace(/\D/g, "")) - 1] || fixedTitles[index] || section.title}\n\n${section.content || ""}`).join("\n\n");
    return `# 《${value.project.title}》完整制作包\n\n> 制作包格式：\`vozeb-drama-production-package-v1\`\n> 规范数据源：JSON；本文件由同一对象确定性导出。\n\n## 规范对象（导入权威数据）\n\n\`\`\`drama-production-package\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n${sections}\n`.replace(
        /\n+$/u,
        "\n",
    );
}

const updatedPackage = updatePackage(packageValue);
const packageJson = `${JSON.stringify(updatedPackage, null, 2)}\n`;
const packageMarkdown = serializeMarkdown(updatedPackage);
fs.writeFileSync(new URL("../../output/mahadel-episode-01-production-package-v2-multiframe.json", import.meta.url), packageJson, "utf8");
fs.writeFileSync(new URL("../../output/mahadel-episode-01-production-package-v2-multiframe.md", import.meta.url), packageMarkdown, "utf8");

if (!connectionString) {
    console.log("制作包文件已整改；未配置 DATABASE_URL/POSTGRES_URL，跳过数据库同步");
    process.exit(0);
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
    await client.query("BEGIN");
    const result = await client.query("SELECT user_id, project_json FROM vozeb_pro_drama_projects WHERE id = $1 FOR UPDATE", [projectId]);
    const row = result.rows[0];
    if (!row) throw new Error(`项目不存在：${projectId}`);
    const project = row.project_json;
    const before = JSON.stringify(project);
    const oldCounts = project.episodes.flatMap((episode) => episode.shots.map((shot) => shot.framePlan?.frames?.length || 0));
    const nextProject = structuredClone(project);
    nextProject.episodes = nextProject.episodes.map(repairEpisode);
    const sourceHash = createHash("sha256").update(packageMarkdown).digest("hex");
    nextProject.productionArchive = updatedPackage.archive;
    const sourceId = `source-package-${sourceHash.slice(0, 16)}`;
    nextProject.sourceAssets = [...(nextProject.sourceAssets || []).filter((asset) => asset.id !== sourceId), { id: sourceId, type: "text", title: "制作包 Mahadel-episode-01-five-frame.md", textContent: packageMarkdown, sourceHash }];
    nextProject.updatedAt = new Date().toISOString();
    const after = JSON.stringify(nextProject);
    if (before === after) throw new Error("项目没有需要更新的 9/8 帧计划");
    const version = await client.query("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM vozeb_pro_drama_project_versions WHERE user_id = $1 AND project_id = $2", [row.user_id, projectId]);
    await client.query("INSERT INTO vozeb_pro_drama_project_versions (id, project_id, user_id, version, reason, snapshot, created_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)", [
        `drama-version-${randomUUID()}`,
        projectId,
        row.user_id,
        Number(version.rows[0].version),
        "修复拆分镜头重复逐帧计划前",
        JSON.stringify(project),
        new Date(),
    ]);
    await client.query("UPDATE vozeb_pro_drama_projects SET project_json = $2::jsonb, updated_at = $3 WHERE id = $1", [projectId, JSON.stringify(nextProject), new Date(nextProject.updatedAt)]);
    await client.query("COMMIT");
    const nextCounts = nextProject.episodes.flatMap((episode) => episode.shots.map((shot) => shot.framePlan?.frames?.length || 0));
    console.log(
        JSON.stringify(
            { projectId, oldCounts: { min: Math.min(...oldCounts), max: Math.max(...oldCounts), total: oldCounts.length }, nextCounts: { min: Math.min(...nextCounts), max: Math.max(...nextCounts), total: nextCounts.length }, packageHash: sourceHash },
            null,
            2,
        ),
    );
} catch (error) {
    await client.query("ROLLBACK");
    throw error;
} finally {
    await client.end();
}
