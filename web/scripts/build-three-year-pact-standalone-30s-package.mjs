import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const sourcePath = process.argv[2] || "/Users/a1/Desktop/2.txt";
const outputBase = path.join(repoRoot, "output", "three-year-pact-standalone-production-package-30s");
const sourceRaw = fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/u, "");
const sourceText = sourceRaw.trim();
const sourceHash = createHash("sha256").update(sourceRaw, "utf8").digest("hex");

const visualDirection =
    "东方玄幻修仙世界以高精度 3D 半写实国漫电影质感呈现：仙门殿宇、云海山崖、灵气与法阵构成具有真实尺度和空气透视的东方幻想空间，画面宏阔却保留可触摸的材质细节。人物采用自然克制的 CG 建模，脸部保留真实皮肤微纹理、细碎绒毛与柔和骨相起伏，避免过度磨皮和玩偶式塑料感；发丝需呈现分束、受风与逆光透亮的层次。锦缎、薄纱、鎏金金属、珍珠、玉石、木石与法器均按照具有磨损、透光、粗糙度和反射差异的 PBR 逻辑表现。整体以清冷青白月光、低饱和黛青山色和局部暖金法光建立色彩层次，辅以体积雾、浮尘、灵气粒子和电影级景深，确保角色、服装、环境与特效在全剧中共享统一的光色、材质和真实感标准。避免廉价游戏渲染、荧光高饱和、扁平卡通贴图、过强锐化和脱离场景光源的特效高光。";
const negativePrompt = "无字幕、无水印、无 logo、无 HUD、无现代元素、无额外人物、无额外肢体、无换脸、无空间漂移、无塑料皮肤、无廉价游戏渲染、无荧光高饱和、无扁平卡通贴图、无过强锐化、无脱离场景光源的特效高光";

const characters = [
    asset(
        "C01",
        "萧炎",
        "原文事实：少年、萧战之子、萧家少爷，当前被纳兰嫣然称为废物；导演建议：清瘦少年体态，肩背在冲突中由低垂逐步挺直，黑发与墨色窄袖长袍采用克制的东方玄幻设计。",
        "少年男性；清瘦但骨相清晰，黑发束起，墨青窄袖长袍；保留自然皮肤微纹理、细碎发丝和左掌最终出现的单一道浅血口。",
        "锁定少年年龄感、眉骨与发束、墨青衣袍层次、左掌伤口位置；不把伤口扩大为重伤，不因镜头改变脸型或服装。",
    ),
    asset(
        "C02",
        "纳兰嫣然",
        "原文事实：少女、貌美、天赋高，来自强势背景，代表云岚宗提出三年挑战；导演建议：身形纤长，浅青白宗门礼服，黑发高束并以一枚低调浅金发簪作为视觉锚点。",
        "少女女性；纤长身形，杏眼，黑发高束，浅青白宗门礼服，浅金发簪；表演从克制强势转为被血手休证击穿后的错愕。",
        "锁定杏眼、发簪、礼服结构和画面左/西侧站位；保持强势而不舞台化夸张，不加入法术攻击或额外首饰。",
    ),
    asset(
        "C03",
        "萧战",
        "原文事实：萧炎的父亲、萧家族长，坐在大厅首位并承受家族颜面压力；导演建议：中年男性，宽肩，鬓角少量灰白，暗褐蓝长袍。",
        "中年男性；宽肩，少量灰白鬓角，暗褐蓝长袍，低沉厚重的父亲气质；右手拍桌，后段以手掌和肩背托住跪地的萧炎。",
        "锁定北侧首位、年龄感、族长体态和右手拍桌逻辑；不让萧战脱离首位轴线，不新增其他家族成员出镜。",
    ),
];

const locations = [
    asset(
        "S01",
        "萧家议事大厅",
        "原文事实：退婚谈判发生在萧家大厅，有首位、桌面、纸笔、短剑和通向外部的阳光；导演建议：北侧首位、中央深色木长桌、南侧大门、东西两侧对峙通道，青砖地面与黛青墙面。",
        "东方玄幻家族议事大厅；北侧高背首位，中央深色木桌，南侧大门通向白日暖光，东西两侧留出三步对峙通道；青砖、木石和陶瓷均有真实粗糙度。",
        "固定南门暖金侧逆光、室内冷青白反射、北侧首位和中央桌案；人物不穿越既定 180 度轴线，门外只作为光与风的来源，不新增可识别人物。",
    ),
];

const props = [
    asset(
        "P01",
        "婚约契约／休证",
        "原文事实：白纸上写下契约，最终留下萧炎的血手印；导演建议：薄宣纸，边缘略卷，黑墨字迹保持不可读。",
        "薄宣纸，边缘略卷，墨迹不可读，最终在纸面中央偏下留下清晰但不过度夸张的左掌血印。",
        "固定纸张比例、血印位置和持有人关系；不得生成可读文字，不得出现第二张同名契约。",
    ),
    asset(
        "P02",
        "短剑",
        "原文事实：萧炎从桌上抽出短剑并划伤左掌一次；导演建议：暗银窄刃与深木剑柄，适合少年单手使用。",
        "窄刃暗银金属，深木剑柄，刃口有克制冷光，只执行一次短促划掌动作。",
        "固定刀刃形制、剑柄材质和使用手；不出现剑气、喷血、二次挥砍或额外武器。",
    ),
    asset(
        "P03",
        "毛笔与砚台",
        "原文事实：萧炎在桌前奋笔疾书；导演建议：普通毛笔、墨砚和吸墨宣纸，均有可触摸的木石与纤维质感。",
        "普通毛笔、黑墨砚台和宣纸并置于中央桌案右前方，笔尖落墨，文字不需要可读。",
        "固定笔、砚与纸的桌面关系；不把毛笔变成法器，不出现漂浮墨迹或额外书卷。",
    ),
    asset(
        "P04",
        "茶盏与长桌",
        "原文事实：萧战拍桌时茶水洒落；导演建议：深色木桌与一只陶瓷茶盏，受力时只有少量茶水飞溅。",
        "深色木长桌，陶瓷茶盏位于萧战手侧，木纹、杯沿和少量茶水反光清晰。",
        "锁定桌面位置、茶盏数量和拍桌受力关系；不让茶水变成法术特效，不改变桌案朝向。",
    ),
];

const shotDefinitions = [
    shot(
        "萧炎把退婚推到父亲和萧家颜面",
        "SC01",
        ["C01", "C02", "C03"],
        ["P04"],
        "萧炎从低头承受转为抬眼质问，把退婚的私人难堪明确推到萧战和萧家颜面。",
        "萧炎：纳兰小姐，你应该知道，在斗气大陆，女方悔婚会让对方有多难堪，呵呵，我脸皮厚，倒是没什么，可我的父亲！他是一族之长，今日若是真答应了你的要求，他日后还如何掌管萧家？还如何在乌坦城立足？",
        "萧炎把家族责任压回纳兰；纳兰暂时不打断，萧战在首位承受目光。",
        [
            frame("三人静立在萧家议事大厅，萧炎位于画面右侧低头看向桌面，纳兰嫣然位于画面左侧看着他，萧战坐在北侧首位，茶盏停在手边。", "萧炎下颌收紧，肩背略低；纳兰嘴角压平；萧战目光在两人之间停留。"),
            frame("萧炎已经抬眼扫向北侧首位，右手按住长桌边缘，茶盏中的水面出现细小波纹。", "萧炎眉尾微挑，手指收紧；萧战左手按住茶盏；纳兰袖口仍然收拢。"),
            frame("萧炎肩背已经直立，脸转向萧战后又回到纳兰，纳兰的手指收拢浅青袖口。", "萧炎说到父亲时呼吸收住；纳兰眼神变窄；萧战身体从椅背前倾。"),
            frame("萧炎正面看向纳兰，右手离开桌沿停在身侧，萧战在北侧首位保持前倾，南门暖光勾出三人的肩线。", "萧炎冷笑被压成质问；纳兰保持强势凝视；萧战的下颌绷紧。"),
            frame("萧炎停住呼吸直视纳兰，三人和桌案形成稳定三角关系，茶水波纹已经消退。", "萧炎的目光不再回避；纳兰的袖口仍受力；萧战把视线交给纳兰，留下回答空间。"),
        ],
        {
            speaker: "萧炎",
            text: "纳兰小姐，你应该知道，在斗气大陆，女方悔婚会让对方有多难堪，呵呵，我脸皮厚，倒是没什么，可我的父亲！他是一族之长，今日若是真答应了你的要求，他日后还如何掌管萧家？还如何在乌坦城立足？",
            rate: 5.2,
            before: 0.8,
            after: 1.2,
            tone: "冷笑压怒，后段加重",
            intent: "把退婚的后果从个人羞辱推到父亲和家族颜面",
            emphasis: "我的父亲、一族之长、如何掌管萧家",
            beforeAction: "嘴角带冷笑，目光从纳兰扫向萧战",
            duringAction: "说到父亲时肩背直立并转回纳兰",
            afterAction: "停住呼吸直视纳兰",
        },
        "中轴缓慢推进",
        "35mm",
        "建立冲突并完成责任转移",
        "连续动作",
    ),
    shot(
        "纳兰收回退婚并提出交换约定",
        "SC01",
        ["C01", "C02", "C03"],
        ["P04"],
        "纳兰承认今日莽撞，却把收回退婚要求变成一项新的交换条件；萧炎被迫追问。",
        "纳兰嫣然：今日的事，的确是嫣然有些莽撞了，今天，我可以暂时收回解除婚约的要求，不过，我需要你答应我一个约定！\n萧炎：什么约定？",
        "纳兰先看萧战再转向萧炎，用礼貌外壳包住强势条件；萧炎从直视转为皱眉前探。",
        [
            frame("纳兰嫣然收回按紧袖口的手，目光先落向北侧的萧战；萧炎仍站在长桌东侧，萧战抬眼看她。", "纳兰眉间出现短暂歉意但嘴角不松；萧炎保持警惕；萧战的手离开茶盏。"),
            frame("纳兰已经把脸转回萧炎，浅青袖口垂在身侧，萧炎的眉头开始收紧。", "纳兰下巴微抬，语气克制；萧炎右脚向中线靠近半步；萧战观察两人。"),
            frame("纳兰的右手在胸前形成一个克制的交换姿态，萧炎抬眼锁住她，桌面上的茶水完全静止。", "纳兰把‘暂时收回’停在唇边；萧炎呼吸变浅；萧战保持前倾。"),
            frame("纳兰把手指收回袖中，视线不移，萧炎身体前探并准备开口，南门暖光切过两人发丝。", "纳兰的表情恢复宣判般平静；萧炎眉骨压低；萧战视线落向萧炎。"),
            frame("萧炎已经问出疑问，脸朝纳兰，右手停在身侧；纳兰和萧战同时看向他，三人被长桌分隔。", "萧炎语气短促；纳兰不回答而保持等待；大厅只留下门外风声。"),
        ],
        [
            {
                speaker: "纳兰嫣然",
                text: "今日的事，的确是嫣然有些莽撞了，今天，我可以暂时收回解除婚约的要求，不过，我需要你答应我一个约定！",
                rate: 5.0,
                before: 0.8,
                after: 1.0,
                tone: "先缓后硬，礼貌外壳下带控制",
                intent: "承认莽撞并提出新的交换条件",
                emphasis: "暂时收回、一个约定",
                beforeAction: "看向萧战，轻咬下唇",
                duringAction: "转回萧炎并收拢袖口",
                afterAction: "停住视线等待答复",
            },
            { speaker: "萧炎", text: "什么约定？", rate: 4.2, before: 0.6, after: 1.4, tone: "低沉警觉", intent: "确认纳兰真正的条件", emphasis: "什么约定", beforeAction: "眉头收紧", duringAction: "向前探身", afterAction: "停在对峙轴线上" },
        ],
        "中轴轻微推进后停住",
        "50mm",
        "提出条件并制造下一轮信息悬停",
        "连续动作",
    ),
    shot(
        "三年云岚宗挑战落地",
        "SC01",
        ["C01", "C02", "C03"],
        ["P04"],
        "纳兰把解除婚约延后三年，并将云岚宗挑战、失败后解除婚约和顾及萧战颜面一次性说清。",
        "纳兰嫣然：今日的要求，我可以延迟三年，三年之后，你来云岚宗向我挑战，如果输了，我便当众将婚约解除，而到那时候，想必你也进行了家族的成年仪式，所以，就算是输了，也不会让萧叔叔脸面太过难堪，你可敢接？",
        "纳兰的手势从桌面前方指向南门，再收回到自己身侧；萧炎听见‘三年’后右手握拳，萧战开始起身。",
        [
            frame("纳兰站在画面左侧，右手抬到胸前，萧炎在右侧皱眉，萧战坐在北侧首位等待她把条件说完。", "纳兰目光稳定；萧炎眉头收紧；萧战手掌压在桌面边缘。"),
            frame("纳兰的手指已经指向南侧大门，萧炎的右手在身侧握成半拳，萧战从高背椅上抬起肩背。", "纳兰第一次明确‘三年’；萧炎屏住气；萧战的椅脚发出轻微受力声。"),
            frame("纳兰手指从南门方向收回，萧炎的拳头已经收紧，萧战右肩离开椅背，茶盏边缘出现细小晃动。", "纳兰把失败与解除婚约并置；萧炎目光落向父亲；萧战怒意上升但尚未爆发。"),
            frame("萧战已经站到桌案后方，右掌悬在桌面上方，纳兰仍在左侧保持宣判姿态，萧炎夹在两人之间。", "萧战呼吸加重；纳兰下巴抬高；萧炎目光在两人之间快速移动。"),
            frame("萧战右掌重重落在长桌上，少量茶水飞溅；纳兰肩线一颤，萧炎抬眼看向父亲。", "桌拍成为明确结果；纳兰的不耐显露；萧炎从被动承受进入保护父亲的压力。"),
        ],
        {
            speaker: "纳兰嫣然",
            text: "今日的要求，我可以延迟三年，三年之后，你来云岚宗向我挑战，如果输了，我便当众将婚约解除，而到那时候，想必你也进行了家族的成年仪式，所以，就算是输了，也不会让萧叔叔脸面太过难堪，你可敢接？",
            rate: 5.3,
            before: 0.8,
            after: 1.5,
            tone: "平静宣判，条件逐项加重",
            intent: "用三年挑战包装退婚并把颜面压力交给萧家",
            emphasis: "延迟三年、云岚宗、你可敢接",
            beforeAction: "身体朝萧炎转正",
            duringAction: "手指指向南门后收回",
            afterAction: "停在萧炎视线内",
        },
        "沿桌面向前缓慢推进",
        "40mm",
        "把口头约定变成不可回避的期限",
        "硬切进入父亲拍桌",
    ),
    shot(
        "萧战护子，纳兰逼问选择",
        "SC02",
        ["C01", "C02", "C03"],
        ["P04"],
        "萧战反驳纳兰是在侮辱萧炎，纳兰把责任和颜面继续压回萧家，逼萧炎在现在与三年后之间选择。",
        "萧战：纳兰小姐，你又不是不清楚炎儿的状况，你让他拿什么和你挑战？如此这般侮辱与他，有意思么？\n纳兰嫣然：萧叔叔，悔婚这种事，总需要有人去承担责任，若不是为了保全您的面子，嫣然此刻便会强行解婚！然后公布于众！",
        "萧战站在桌后挡住萧炎的退路；纳兰侧身对萧战说话，最后把视线切回萧炎。",
        [
            frame("萧战站在北侧桌后，右掌仍压在桌面，萧炎位于右侧后方，纳兰位于左侧，三人轴线保持不变。", "萧战怒而护子；萧炎嘴唇抿紧；纳兰目光从萧炎转向萧战。"),
            frame("萧战的右手离开桌面并指向纳兰，萧炎在他身后抬眼，纳兰袖口被手指攥紧。", "萧战质问‘拿什么挑战’；纳兰下颌绷紧；萧炎听见侮辱后肩背进一步直立。"),
            frame("纳兰已经侧身面对萧战，手掌压住自己的袖口，萧战站在长桌后保持正面，萧炎被两人的视线夹在右侧。", "纳兰从歉意转为不耐；萧战的眉峰下压；萧炎目光落向父亲。"),
            frame("纳兰把手掌摊向桌案，纸笔和茶盏在前景形成谈判压力，萧战的手指在桌面留下受力痕迹。", "纳兰把责任说成保全颜面；萧战胸口起伏；萧炎低头再抬眼。"),
            frame("纳兰转回萧炎，右手指向两人之间的空位，萧炎站在画面右侧接住她的目光，萧战留在北侧首位方向。", "纳兰进入逼问姿态；萧炎吸气；萧战把决定权留给儿子。"),
        ],
        [
            {
                speaker: "萧战",
                text: "纳兰小姐，你又不是不清楚炎儿的状况，你让他拿什么和你挑战？如此这般侮辱与他，有意思么？",
                rate: 4.8,
                before: 0.8,
                after: 0.8,
                tone: "低沉爆发但不失族长克制",
                intent: "阻止纳兰把不可能的挑战变成对萧炎的公开羞辱",
                emphasis: "拿什么和你挑战、侮辱",
                beforeAction: "站起并按住桌面",
                duringAction: "掌心指向纳兰",
                afterAction: "视线回到萧炎",
            },
            {
                speaker: "纳兰嫣然",
                text: "萧叔叔，悔婚这种事，总需要有人去承担责任，若不是为了保全您的面子，嫣然此刻便会强行解婚！然后公布于众！",
                rate: 5.0,
                before: 0.4,
                after: 1.0,
                tone: "不耐与强势逐句上升",
                intent: "将退婚责任转化为萧战必须承担的家族颜面",
                emphasis: "承担责任、保全您的面子、公布于众",
                beforeAction: "转向萧战",
                duringAction: "手掌压住袖口并向桌面施压",
                afterAction: "转回萧炎",
            },
        ],
        "保持中轴，短促横向转向纳兰",
        "50mm",
        "让父亲的保护与纳兰的责任话术正面碰撞",
        "连续动作",
    ),
    shot(
        "逼问现在或三年后，萧炎接下约定",
        "SC02",
        ["C01", "C02", "C03"],
        ["P04"],
        "纳兰逼萧炎在当下退婚与三年后挑战之间二选一，萧炎用一句‘我接下’结束被动。",
        "纳兰嫣然：你既然不愿让萧叔叔颜面受损，那么便接下约定！三年之后与现在，你究竟选择前者还是后者？\n萧炎：我接下。",
        "纳兰从左侧压迫式逼问，萧炎先看父亲再迈向中线，短句回答后大厅出现清晰停顿。",
        [
            frame("纳兰站在左侧抬手指向萧炎，萧炎仍在右侧低头，萧战站在北侧桌后看向儿子。", "纳兰的目光锁住萧炎；萧炎指节收紧；萧战不再插话。"),
            frame("纳兰的手指已经落回身侧，萧炎抬眼看向萧战，右脚离开东侧站位准备向中线迈步。", "纳兰把‘颜面’压重；萧炎吸气；萧战用极轻的点头给出无言支撑。"),
            frame("萧炎已经向大厅中线迈出半步，肩背挺直，纳兰在左侧保持等待，萧战在后方形成父子同侧关系。", "萧炎从羞辱中稳住重心；纳兰第一次露出等待答案的停顿；萧战目光稳定。"),
            frame("萧炎正面看向纳兰，右手垂下，左手贴近胸前，纳兰的手指停在袖口边缘。", "萧炎把呼吸压低；纳兰下巴微抬；大厅风声短暂露出。"),
            frame("萧炎已经完成接受约定后的停顿，脚步停在中线前，纳兰与萧战分别位于左右和后景，三人关系完成重新排布。", "萧炎唇形收紧后停住；纳兰收回手势；萧战肩背放松半寸。"),
            frame("萧炎保持中线前的直立姿态，纳兰在左侧、萧战在北侧首位方向，桌案作为三人之间的硬边界。", "一句回答后的静默被保留；萧炎目光不再躲闪；纳兰准备迎接他的反击。"),
        ],
        [
            {
                speaker: "纳兰嫣然",
                text: "你既然不愿让萧叔叔颜面受损，那么便接下约定！三年之后与现在，你究竟选择前者还是后者？",
                rate: 5.0,
                before: 0.6,
                after: 1.2,
                tone: "逼问，前半句压迫，后半句逐字落锤",
                intent: "把萧炎逼到必须公开作答的位置",
                emphasis: "接下约定、前者还是后者",
                beforeAction: "指向萧炎",
                duringAction: "视线在萧炎和萧战之间切换",
                afterAction: "等待答案",
            },
            { speaker: "萧炎", text: "我接下。", rate: 4.0, before: 0.8, after: 2.0, tone: "短促、稳定、带决断", intent: "主动承担三年挑战", emphasis: "接下", beforeAction: "看向萧战并吸气", duringAction: "向中线迈半步", afterAction: "正面看住纳兰" },
        ],
        "跟随萧炎迈向中线后停住",
        "50mm",
        "用短句完成从被动到主动的转折",
        "连续动作",
    ),
    shot(
        "萧炎反击天之骄女，指出自己仍有时间",
        "SC02",
        ["C01", "C02", "C03"],
        [],
        "萧炎第一次完整反击纳兰的强势姿态，承认现实处境却拒绝接受她对未来的判决。",
        "萧炎：纳兰嫣然，你不用做出如此强势的姿态，你想退婚，无非便是认为我萧炎一届废物配不上你这天之骄女，说句刻薄的，你除了你的美貌之外，其他的本少爷根本瞧不上半点！云岚宗的确很强，可我还年轻，我还有的是时间。",
        "萧炎从中线前方开始，先以冷笑拆掉纳兰的姿态，再在说到‘时间’时把目光越过她投向南门。",
        [
            frame("萧炎站在中线前，面朝纳兰，嘴角带冷笑，纳兰在左侧保持高位姿态，萧战在后景安静观察。", "萧炎下颌锁紧、呼吸尚未加重；纳兰眉峰微抬；萧战的手离开桌面。"),
            frame("萧炎右手抬到胸前后停住，纳兰袖口被指尖收拢，二人之间的桌角形成清晰前景遮挡。", "萧炎把‘强势’说成可见判断；纳兰脸色微冷；萧战目光转向纳兰。"),
            frame("萧炎的视线从纳兰脸上移向南门，右手落回身侧，纳兰仍站在左侧没有后退。", "萧炎承认云岚宗强大但保持肩背直立；纳兰的嘴角抿紧；南门暖光压过冷色背景。"),
            frame("萧炎重新看向纳兰，左肩向前，双脚稳稳踩在青砖上，纳兰的手指停在袖口边缘。", "萧炎语速加快后在‘我还年轻’处放慢；纳兰第一次出现短暂迟疑；萧战呼吸变缓。"),
            frame("萧炎说到时间时面向南门，发丝边缘被暖金光照亮，纳兰在左后景看着他的侧脸。", "萧炎将未来重新拿回自己；纳兰的目光追过去；萧战的肩背略微放松。"),
            frame("萧炎转回纳兰并停在直视状态，右手握拳后松开，桌面和三人轴线没有改变。", "冷笑消失，留下克制的自信；纳兰的强势表情出现裂缝；萧战眼神变亮。"),
        ],
        {
            speaker: "萧炎",
            text: "纳兰嫣然，你不用做出如此强势的姿态，你想退婚，无非便是认为我萧炎一届废物配不上你这天之骄女，说句刻薄的，你除了你的美貌之外，其他的本少爷根本瞧不上半点！云岚宗的确很强，可我还年轻，我还有的是时间。",
            rate: 5.2,
            before: 0.6,
            after: 1.8,
            tone: "冷笑拆解后转为坚定",
            intent: "承认当下被压低的处境，但否定纳兰对未来的判决",
            emphasis: "强势的姿态、废物、还年轻、时间",
            beforeAction: "正面看住纳兰",
            duringAction: "视线越过纳兰投向南门",
            afterAction: "重新直视纳兰",
        },
        "从纳兰肩后缓慢绕回萧炎正面但不越轴",
        "40mm",
        "把羞辱转化为仍有时间的反击",
        "连续动作",
    ),
    shot(
        "旧日斗者天赋与莫欺少年穷",
        "SC02",
        ["C01", "C02", "C03"],
        ["P04"],
        "萧炎用十二岁成为斗者的事实击穿纳兰判断，随后以‘莫欺少年穷’把个人反击交给萧战回应。",
        "萧炎：我十二岁便已经成为一名斗者，而你，纳兰嫣然，你十二岁的时候，方才不过八段斗之气而已！没错，现在的我的确是废物，可我既然能够在三年前创造奇迹，那么日后的岁月里，你凭什么认为我不能再次翻身？\n萧炎：纳兰小姐，看在纳兰老爷子的面上，萧炎奉劝你几句话，三十年河东，三十年河西，莫欺少年穷！",
        "萧炎先把比较落到事实，再把最后一句压低说出；萧战在‘莫欺少年穷’后拍桌。",
        [
            frame("萧炎右手抬起指向自己胸口，纳兰在左侧微微睁大眼，萧战站在北侧桌后保持沉默。", "萧炎眉骨压低；纳兰开始计算他的话；萧战的视线锁住儿子。"),
            frame("萧炎的手掌已经停在胸前，纳兰的目光短暂移开，桌面茶盏被萧战的左手按稳。", "萧炎把十二岁和斗者说得清楚；纳兰脸色变硬；萧战的呼吸加深。"),
            frame("萧炎向纳兰迈近半步，右手落回身侧，纳兰身形仍在左侧但肩膀出现轻微后收。", "萧炎指出现在的废物只是当前状态；纳兰被迫正面承受；萧战没有打断。"),
            frame("萧炎停在纳兰面前半步，目光稳定，纳兰袖口被握紧，南门暖光沿两人的肩线形成分离。", "萧炎问出‘凭什么不能再次翻身’；纳兰嘴唇张开但没有立即回答；大厅风声变轻。"),
            frame("萧炎转过半身看向萧战，左手垂在身侧，萧战在北侧首位方向迎上他的目光。", "萧炎从对手转向父亲；萧战的眼神从担忧转为支持；纳兰留在左侧后景。"),
            frame("萧炎重新面对纳兰，唇形收紧后保持警告后的停顿，萧战右掌已经抬离桌面准备落下。", "萧炎唇角收紧、目光清晰；纳兰肩线微颤；萧战的支持即将成为可见动作。"),
        ],
        {
            speaker: "萧炎",
            text: "我十二岁便已经成为一名斗者，而你，纳兰嫣然，你十二岁的时候，方才不过八段斗之气而已！没错，现在的我的确是废物，可我既然能够在三年前创造奇迹，那么日后的岁月里，你凭什么认为我不能再次翻身？",
            rate: 5.1,
            before: 0.8,
            after: 0.9,
            tone: "由压怒升至锋利反击",
            intent: "用可核验的过去证明未来并未被判死",
            emphasis: "十二岁、斗者、创造奇迹、凭什么",
            beforeAction: "指向自己胸口",
            duringAction: "向纳兰迈近半步",
            afterAction: "转向父亲",
        },
        {
            speaker: "萧炎",
            text: "纳兰小姐，看在纳兰老爷子的面上，萧炎奉劝你几句话，三十年河东，三十年河西，莫欺少年穷！",
            rate: 4.8,
            before: 0.5,
            after: 1.2,
            tone: "压低声音，最后一句铮然落下",
            intent: "用一句公开警告封住纳兰的羞辱",
            emphasis: "三十年河东、三十年河西、莫欺少年穷",
            beforeAction: "看向父亲后回转",
            duringAction: "直视纳兰",
            afterAction: "停住等待萧战回应",
        },
        "沿萧炎向前的动作轴线缓慢推进",
        "50mm",
        "把事实反击推到一句可被全厅记住的警告",
        "硬切保留桌拍余响",
    ),
    shot(
        "萧战公开支持，纳兰把赌约加码",
        "SC03",
        ["C01", "C02", "C03"],
        ["P04"],
        "萧战用‘儿子不凡’公开接住萧炎，纳兰在受辱后把三年挑战升级为胜负与终身侍奉的极端赌约。",
        "萧战：好，好一句莫欺少年穷！我萧战的儿子，就是不凡！\n纳兰嫣然：你凭什么教训我？就算你以前的天赋无人能及，可现在的你，就是一个废物！好，我纳兰嫣然就等着你再次超越我的那天，",
        "桌拍成为全厅声响中心；纳兰从错愕转为尖锐反击，萧炎在她身前不退。",
        [
            frame("萧战双掌落在长桌上，少量茶水飞起，萧炎在右侧保持直立，纳兰在左侧肩膀被声响震动。", "萧战眼神发亮；萧炎的嘴角收紧；纳兰被突如其来的支持打断。"),
            frame("茶水已经落回桌面，萧战右手仍按住桌案，萧炎转头看父亲，纳兰咬住下唇。", "萧战把儿子推到公开立场；萧炎眼角湿润但不低头；纳兰怒意上升。"),
            frame("纳兰重新面向萧炎，手指指向他胸前，萧炎不退，萧战留在北侧首位方向作为后景支撑。", "纳兰嘴角拉紧、身体保持克制；萧炎下颌锁紧；萧战收回一只手。"),
            frame("纳兰的手指已经收回袖口，脸色铁青，萧炎的目光仍停在她脸上，桌面茶水只剩一圈细小水痕。", "纳兰把过去天赋与现在废物并置；萧炎不以手势回应；萧战目光沉稳。"),
            frame("纳兰向前半步，浅金发簪被南门暖光擦亮，萧炎在画面右侧准备转向桌案。", "纳兰从被击中转入主动加码；萧炎听见‘等你超越’后视线落向桌面。"),
            frame("萧炎已经从纳兰面前转向中央桌案，纳兰仍在左后方盯住他，萧战的右手重新落在桌边。", "赌约从口头冲突转入契约动作；三人的视线方向完成新的动作轴。"),
        ],
        [
            {
                speaker: "萧战",
                text: "好，好一句莫欺少年穷！我萧战的儿子，就是不凡！",
                rate: 4.8,
                before: 0.7,
                after: 1.0,
                tone: "低沉爆发后转为骄傲",
                intent: "在大厅公开承认并支持萧炎",
                emphasis: "儿子、就是不凡",
                beforeAction: "听见警告后抬眼",
                duringAction: "双掌重砸桌面",
                afterAction: "看向萧炎",
            },
            {
                speaker: "纳兰嫣然",
                text: "你凭什么教训我？就算你以前的天赋无人能及，可现在的你，就是一个废物！好，我纳兰嫣然就等着你再次超越我的那天，",
                rate: 5.0,
                before: 0.4,
                after: 0.6,
                tone: "受辱后的尖锐反击",
                intent: "拒绝承认萧炎的反击并把等待变成新的羞辱",
                emphasis: "凭什么、现在的你、等着你再次超越",
                beforeAction: "咬牙盯住萧炎",
                duringAction: "指向萧炎胸前",
                afterAction: "向桌案方向逼近",
            },
        ],
        "桌拍后沿纳兰转身到桌案，保持同轴",
        "35mm",
        "把父子同盟公开化并把冲突推入契约执行",
        "连续动作",
    ),
    shot(
        "三年赌约加码与萧炎走向桌案",
        "SC03",
        ["C01", "C02", "C03"],
        ["P01", "P03"],
        "纳兰说出云岚宗等待、胜者处置权和失败交出契约；萧炎以‘不感兴趣’结束争辩并走到桌前。",
        "纳兰嫣然：今天解除婚约之事，我可以不再提，不过三年之后，我在云岚宗等你，有本事，你就让我看看你能翻身到何种地步！如果到时候你能打败我，我纳兰嫣然今生为奴为婢，全都你说了算！当然，三年后如果你依旧是这般废物，那纸解除婚约的契约，你也给我乖乖的交出来！\n萧炎：不用三年之后，我对你，实在是提不起半点兴趣！",
        "纳兰从左侧沿桌案边缘加码，萧炎不再回头争辩，径直走向毛笔、砚台和宣纸。",
        [
            frame("纳兰站在桌案左侧，手掌压住桌沿，萧炎在桌案右侧转身，毛笔与砚台位于前景。", "纳兰继续掌控话语；萧炎的视线已经从她移向宣纸；萧战站在北侧观察。"),
            frame("纳兰的手指沿桌面敲落一次，宣纸和毛笔清晰位于画面中央，萧炎右手停在纸张上方。", "纳兰说到云岚宗等待；萧炎不回头；桌面木纹承受手指压力。"),
            frame("纳兰把手掌收回胸前，萧炎已经走到桌前并站在宣纸右侧，砚台墨面被南门暖光照出低反射。", "纳兰说出胜负条件；萧炎呼吸变稳；萧战的视线落到宣纸。"),
            frame("纳兰的手仍压在桌边，萧炎拿起毛笔但没有落下，短剑在宣纸右前方保持可见。", "‘为奴为婢’落下后出现停顿；萧炎把回应留给动作；纳兰追着他的手。"),
            frame("纳兰完成失败条件的宣告，萧炎抬眼冷笑后转向纸面，毛笔尖已经接近宣纸。", "纳兰的语气回到冷硬；萧炎用眼神否定她的主导权；萧战不再阻止。"),
            frame("萧炎已经把毛笔落在墨面并开始在宣纸上书写，纳兰停在桌案对面，短剑仍位于纸张右前方。", "萧炎说出不感兴趣后进入执行；纳兰的嘴唇僵住；动作轴由人物冲突转向桌面契约。"),
        ],
        [
            {
                speaker: "纳兰嫣然",
                text: "今天解除婚约之事，我可以不再提，不过三年之后，我在云岚宗等你，有本事，你就让我看看你能翻身到何种地步！如果到时候你能打败我，我纳兰嫣然今生为奴为婢，全都你说了算！当然，三年后如果你依旧是这般废物，那纸解除婚约的契约，你也给我乖乖的交出来！",
                rate: 5.1,
                before: 0.5,
                after: 1.0,
                tone: "从挑衅到给出极端条件，逐项加重",
                intent: "把三年挑战变成公开胜负契约并保留退婚筹码",
                emphasis: "云岚宗、打败我、为奴为婢、交出来",
                beforeAction: "沿桌边逼近",
                duringAction: "手指压住桌沿并逐项落条件",
                afterAction: "盯住萧炎等待反应",
            },
            {
                speaker: "萧炎",
                text: "不用三年之后，我对你，实在是提不起半点兴趣！",
                rate: 4.8,
                before: 0.6,
                after: 1.6,
                tone: "冷淡嘲讽，拒绝继续口头争辩",
                intent: "切断纳兰的语言主导并进入书写动作",
                emphasis: "不用三年、提不起半点兴趣",
                beforeAction: "抬眼冷笑",
                duringAction: "转身面向宣纸",
                afterAction: "毛笔落墨",
            },
        ],
        "沿桌面横移跟随萧炎，落笔前停住",
        "40mm",
        "将赌约从语言交锋转为可见契约动作",
        "连续动作",
    ),
    shot(
        "落笔、割掌与血印成立",
        "SC03",
        ["C01", "C02"],
        ["P01", "P02", "P03"],
        "萧炎完成书写，抽出短剑划伤左掌，把血手印按在宣纸上；30 秒内只执行一次划掌，不使用喷溅特效。",
        "无对白。",
        "毛笔书写、笔停、抽剑、一次划掌、血掌按纸五个连续动作节点；纳兰在后景僵住，萧战留在首位方向。",
        [
            frame("萧炎右手握毛笔，左手压住宣纸，墨线已经覆盖纸面但字迹不可读；纳兰在左后景看着他的手。", "萧炎呼吸均匀，肩背前倾；纳兰眉眼收紧；桌面墨砚保持稳定。"),
            frame("毛笔已经停在宣纸末端，萧炎右手离开笔杆，短剑位于纸张右前方，左掌仍压住纸角。", "动作由书写进入决定；纳兰的手指停在袖口；萧战在后景不动。"),
            frame("萧炎右手已经握住短剑柄，剑身从桌面抬起，左掌摊开在纸张旁，纳兰眼睛睁大。", "萧炎屏住呼吸；纳兰身体后收；冷青白室内光沿暗银刃口形成细线。"),
            frame("左掌已经出现一道细而集中的血口，血珠沿掌纹聚拢，短剑停在右前方，纸面仍未沾血。", "萧炎眉眼不动但手腕绷紧；纳兰僵住；不出现喷血或多次切割。"),
            frame("萧炎的左掌已经压在宣纸中央偏下，清晰血手印成立，短剑被放回纸张右侧，萧战和纳兰同时看向血印。", "血印成为画面唯一高饱和色；萧炎抬起下颌；纳兰的惊愕在沉默中形成。"),
        ],
        [],
        "桌面横向微移后固定在血印特写",
        "65mm",
        "以物理动作完成关系反转，血印是结果而非特效",
        "血印匹配切",
    ),
    shot(
        "血手休证拍到纳兰面前",
        "SC04",
        ["C01", "C02", "C03"],
        ["P01", "P02"],
        "萧炎把血手契约定义为逐出纳兰的休证并砸到她面前，纳兰第一次失去语言主导。",
        "萧炎：不要以为我萧炎多在乎你这什么天才老婆，这张契约，不是解除婚约的契约，而是本少爷把你逐出萧家的休证！从此以后，你，纳兰嫣然，与我萧家，再无半点瓜葛！\n纳兰嫣然：你…你敢休我？",
        "萧炎拈起带血契约，从桌前走到纳兰面前重重放下；纳兰先看纸再抬头，萧炎转身面对萧战。",
        [
            frame("血手契约停在长桌中央，萧炎站在纸张右侧，纳兰在左侧盯住血印，萧战在北侧首位方向保持沉默。", "血印让纳兰的目光失焦；萧炎呼吸稳定；萧战的肩背沉下。"),
            frame("萧炎左手拈起宣纸，血印朝向纳兰，短剑留在桌面右侧，纳兰的手指停在纸边外侧但没有触碰。", "萧炎把‘休证’说出口；纳兰身体前倾；萧战看向儿子的左掌。"),
            frame("萧炎已经走到纳兰面前，左手把契约压向桌面，血印在两人之间形成视觉中心。", "纸张与桌面产生闷响；纳兰瞳孔放大；萧炎不再看她的脸。"),
            frame("纳兰的手已经停在血契旁，萧炎转身朝北侧首位迈出半步，萧战从桌后向前探身。", "纳兰短促问出‘你敢休我’；萧炎把结果交给父亲；萧战准备接住他的歉疚。"),
            frame("萧炎背对纳兰站到萧战面前，左掌伤口朝向父亲，血手契约留在纳兰面前，三人形成前后纵深。", "纳兰被留在纸张一侧；萧炎的肩背第一次完全挺直；萧战伸手示意他跪下。"),
        ],
        [
            {
                speaker: "萧炎",
                text: "不要以为我萧炎多在乎你这什么天才老婆，这张契约，不是解除婚约的契约，而是本少爷把你逐出萧家的休证！从此以后，你，纳兰嫣然，与我萧家，再无半点瓜葛！",
                rate: 5.0,
                before: 0.7,
                after: 1.2,
                tone: "冷硬宣告，重音落在休证与再无瓜葛",
                intent: "重新命名血手契约，夺回退婚叙事的主动权",
                emphasis: "休证、逐出萧家、再无半点瓜葛",
                beforeAction: "拈起契约并看向纳兰",
                duringAction: "把契约重重砸到桌面",
                afterAction: "转向萧战",
            },
            {
                speaker: "纳兰嫣然",
                text: "你…你敢休我？",
                rate: 4.2,
                before: 0.8,
                after: 1.6,
                tone: "错愕、短促、第一次失去掌控",
                intent: "确认眼前的血手契约是否真实",
                emphasis: "敢休我",
                beforeAction: "盯住血印",
                duringAction: "抬头看萧炎",
                afterAction: "手指停在纸边",
            },
        ],
        "由桌面跟到纳兰面前后转向萧战",
        "50mm",
        "让血印从道具结果变成公开关系反转",
        "连续动作",
    ),
    shot(
        "跪父、父亲托住萧炎",
        "SC04",
        ["C01", "C02", "C03"],
        ["P01"],
        "萧炎在血手休证后向萧战跪下，萧战没有把责任推回儿子，而是用信任托住他的尊严。",
        "萧战：我相信我儿子不会是一辈子的废物，区区流言蜚语，日后在现实面前，自会不攻而破。",
        "萧炎曲腿跪下并磕头，纳兰留在左后景看着血契；萧战从首位旁俯身托住萧炎肩背。",
        [
            frame("萧炎面对北侧首位曲腿跪下，左掌伤口朝上，纳兰站在左后景，血手契约仍在她面前。", "萧炎紧咬嘴唇；纳兰从错愕转为茫然；萧战向前俯身。"),
            frame("萧炎额头已经触到青砖地面，左掌撑在身侧，萧战右手伸向他的肩，纳兰低头看向血契。", "萧炎把歉疚压进沉默；萧战的动作稳而慢；纳兰手指轻触纸边。"),
            frame("萧战的手已经托住萧炎右肩，萧炎抬起半张脸，血契留在纳兰和桌案之间。", "萧战先看儿子再看血契；萧炎眼角湿润但不哭喊；纳兰不再做手势。"),
            frame("萧战把萧炎从跪姿扶到半起，父子肩线形成稳定支撑，纳兰在左侧低头握住血契。", "‘不会是一辈子’落下；萧炎呼吸逐渐平稳；大厅回声变短。"),
            frame("父子站在北侧首位与中央桌案之间，萧炎左掌伤口贴近胸前，纳兰独自留在纸张一侧。", "父亲的信任成为可见结果；萧炎重新获得直立姿态；门外暖光落到父子肩线上。"),
        ],
        {
            speaker: "萧战",
            text: "我相信我儿子不会是一辈子的废物，区区流言蜚语，日后在现实面前，自会不攻而破。",
            rate: 4.8,
            before: 1.0,
            after: 2.4,
            tone: "低沉、温厚、把愤怒转成信任",
            intent: "消解萧炎对父亲颜面的歉疚并稳住父子关系",
            emphasis: "相信我儿子、不会一辈子、现实面前",
            beforeAction: "托住萧炎肩背",
            duringAction: "扶他起身",
            afterAction: "与儿子保持同一肩线",
        },
        "围绕父子肩线缓慢下移后回到平视",
        "50mm",
        "将公开羞辱转化为父子之间的信任结果",
        "连续动作",
    ),
    shot(
        "三年之后的洗辱誓言与离场",
        "SC04",
        ["C01", "C02", "C03"],
        ["P01"],
        "萧炎向父亲承诺三年后去云岚宗洗刷今日之辱，经过纳兰身侧留下最后一句‘三年之后，我会找你’，走入南门日光。",
        "萧炎：父亲，三年之后，炎儿会去云岚宗，为您亲自洗刷今日之辱！\n萧炎：三年之后，我会找你。",
        "萧炎先面向萧战立誓，再从纳兰身侧经过；纳兰握住血契，目光追随他的背影直到门光吞没。",
        [
            frame("萧炎站在萧战面前，左掌伤口贴近胸口，萧战的右手仍停在他肩侧，纳兰在左后景握住血手契约。", "萧炎眼角湿润但目光坚定；萧战把手从肩侧收回；纳兰不再抬头。"),
            frame("萧炎已经抬眼越过萧战看向南门，父子之间保持一臂距离，暖金门光照亮发丝边缘。", "萧炎说到云岚宗时呼吸变稳；萧战点头；纳兰的手指压住血印。"),
            frame("萧炎从萧战身侧转向南门，墨青衣袍后摆随步伐轻动，纳兰在左侧被留在长桌旁。", "父子誓言完成；萧炎不再回头；南门风声进入大厅。"),
            frame("萧炎经过纳兰身侧停半拍，侧脸朝向她，血手契约仍在纳兰手中，二人保持一臂距离。", "萧炎冷静说出最后一句；纳兰嘴唇微张；她没有追上或反驳。"),
            frame("萧炎已经走入南门白日暖光，背影被拉长，纳兰站在冷灰大厅中握住血契，萧战留在北侧首位方向。", "门光成为离场结果；纳兰的手臂下沉；萧炎的背影孤独但不再低头。"),
        ],
        [
            {
                speaker: "萧炎",
                text: "父亲，三年之后，炎儿会去云岚宗，为您亲自洗刷今日之辱！",
                rate: 4.8,
                before: 0.8,
                after: 1.4,
                tone: "含泪压住颤抖，最后落为坚定",
                intent: "把今日羞辱转成对父亲的未来承诺",
                emphasis: "三年之后、云岚宗、亲自洗刷",
                beforeAction: "左掌贴近胸口",
                duringAction: "抬眼看向南门",
                afterAction: "转身离场",
            },
            {
                speaker: "萧炎",
                text: "三年之后，我会找你。",
                rate: 4.4,
                before: 0.8,
                after: 3.0,
                tone: "经过纳兰时的低声冷语",
                intent: "留下明确的未来对决承诺",
                emphasis: "三年之后、找你",
                beforeAction: "经过纳兰身侧停步",
                duringAction: "侧脸看她",
                afterAction: "继续走入门光",
            },
        ],
        "跟随萧炎向南门移动，最后保持背影静止",
        "40mm",
        "以离场背影和血契重量收束本章",
        "落在门光中的慢切黑",
    ),
];

function asset(code, name, description, styling, consistencyRules) {
    return {
        code,
        name,
        description,
        profile: {
            visualIdentity: description,
            styling,
            colorPalette: "清冷青白、低饱和黛青、局部暖金；血印仅在剧情结果处成为受控高饱和色",
            consistencyRules,
            identityAnchors: [name, styling, consistencyRules],
            spatialRules: [],
            stateRules: [],
            forbiddenChanges: ["不新增原文未声明人物或道具", "不改变既定空间轴线", "不生成文字水印"],
        },
    };
}

function frame(visible, performance) {
    return { visible, performance };
}

function shot(title, storySceneCode, characterCodes, propCodes, description, dialogue, narration, frames, utterances, cameraMotion, lens, dramaticFunction, transitionOut) {
    return { title, storySceneCode, characterCodes, propCodes, description, dialogue, narration, frames, utterances, cameraMotion, lens, dramaticFunction, transitionOut };
}

function countSpokenCharacters(text) {
    return [...text].filter((char) => !/[，。！？；：“”‘’、…,.!?;:\s]/u.test(char)).length;
}

function timedUtterances(definition, shotCode) {
    const items = Array.isArray(definition) ? definition : definition ? [definition] : [];
    let cursor = 0;
    return items.map((item, index) => {
        const pauseBefore = item.before ?? 0.6;
        const pauseAfter = item.after ?? 0.8;
        const rate = item.rate ?? 5;
        cursor += pauseBefore;
        const startSecond = round(cursor);
        cursor += countSpokenCharacters(item.text) / rate;
        const endSecond = round(cursor);
        cursor += pauseAfter;
        if (endSecond > 29.2) throw new Error(`${shotCode} 台词超过30秒容量：${item.speaker} ${endSecond}s`);
        return {
            id: `${shotCode}-D${String(index + 1).padStart(2, "0")}`,
            order: index + 1,
            type: "dialogue",
            speaker: item.speaker,
            text: item.text,
            startSecond,
            endSecond,
            pauseBeforeSeconds: pauseBefore,
            pauseAfterSeconds: pauseAfter,
            speechRate: item.tone,
            speechRateCharsPerSecond: rate,
            intent: item.intent,
            emphasis: item.emphasis,
            beforeAction: item.beforeAction,
            duringAction: item.duringAction,
            afterAction: item.afterAction,
            shotCode,
        };
    });
}

function round(value) {
    return Number(value.toFixed(2));
}

function buildStaticPrompt(item, shotData, sequenceIndex, frameCount) {
    return [
        `静态关键帧：${item.visible}`,
        `可见状态：${item.visible}`,
        `可见表演状态：${item.performance}`,
        `景别：${shotData.shotSize}`,
        `机位与构图：${shotData.cameraAngle}；${shotData.composition}`,
        `站位与视线：${shotData.characterBlocking}；当前视线落在${shotData.gazeDirection}；身体由青砖地面、桌案或椅面提供真实支撑。`,
        `三层空间：前景为长桌边缘、纸张或门框形成的实际遮挡；中景承载人物与道具的接触关系；背景保留北侧首位、黛青墙面和南门纵深。`,
        `光色与风格：${shotData.lighting}；${shotData.colorPalette}；${visualDirection}；本帧为第${sequenceIndex}/${frameCount}个可见状态节点。`,
        `负面约束：${negativePrompt}`,
    ].join("\n");
}

function buildFrames(definition, shotData, shotCode) {
    const frameCount = definition.frames.length;
    const step = 30 / frameCount;
    return definition.frames.map((item, index) => {
        const startSecond = round(index * step);
        const endSecond = round((index + 1) * step);
        const previousVisible = index === 0 ? "本镜头起始状态" : definition.frames[index - 1].visible;
        return {
            id: `${shotCode}-F${String(index + 1).padStart(2, "0")}`,
            sequenceIndex: index + 1,
            startSecond,
            endSecond,
            startPrompt: `${previousVisible}；从该已成立状态进入本节点。`,
            actionPrompt: item.visible,
            transitionPrompt: index === 0 ? "起点状态在镜头开始前已经成立。" : `承接上一帧已经成立的可见结果：${previousVisible}`,
            endPrompt: item.visible,
            imagePrompt: buildStaticPrompt(item, shotData, index + 1, frameCount),
        };
    });
}

function buildVideoPrompt(shotData, frames, utterances) {
    const materialBindings = shotData.referenceManifest
        .filter((item) => item.role !== "previous_actual_tail")
        .map((item) => `${item.alias}：${item.purpose}`)
        .join("\n");
    const timeline = frames
        .map((frameItem) => `${frameItem.id} ${frameItem.startSecond}-${frameItem.endSecond}秒\n起点：${frameItem.startPrompt}\n动作与触发：${frameItem.actionPrompt}\n可见衔接：${frameItem.transitionPrompt}\n终点：${frameItem.endPrompt}`)
        .join("\n");
    const dialogueSound = utterances.length
        ? utterances.map((item) => `${item.speaker}「${item.text}」（${item.startSecond}-${item.endSecond}秒；前停顿${item.pauseBeforeSeconds}秒；后停顿${item.pauseAfterSeconds}秒；${item.speechRate}；${item.speechRateCharsPerSecond}字/秒）`).join("\n")
        : "无对白；保留毛笔、短剑、纸张、桌面和呼吸的真实拟音。";
    return [
        `素材绑定：${materialBindings}`,
        `动态意图：${shotData.dramaticFunction}；${shotData.description}`,
        `全局设定：${shotData.globalSetting}`,
        `起始可见状态：${frames[0].endPrompt}`,
        `时间段动作：\n${timeline}`,
        `单一主运镜：${shotData.cameraMotion}`,
        `环境压力与视觉母题：${shotData.environmentMotif}`,
        `视觉风格与光色：${shotData.lighting}；${shotData.colorPalette}；${visualDirection}`,
        `声音意图：${dialogueSound}\n大厅短混响、门外风声与动作拟音按时间段进入；字幕仅后期加入底部安全区。`,
        `结束画面：${frames.at(-1).endPrompt}`,
        `连续性锁：${shotData.continuityNotes}`,
        `针对性约束：${negativePrompt}；单镜只保留一个主运镜；不将静态帧写成动作过程。`,
    ].join("\n");
}

function makePerformancePlan(shotData) {
    return {
        emotionalObjective: shotData.dramaticFunction,
        emotionalArc: shotData.arc,
        speechStyle: "中文对白按真实自然语速表演，重音落在行动信息，不抢占动作结果；禁止连续快嘴覆盖反应镜头。",
        pace: "30 秒连续时间轴按起点、触发、动作、结果和反应组织；长台词之间保留呼吸和视线反应。",
        breath: "压力升高时吸气变短，关键判断前留半拍，结果成立后保留可剪辑的呼吸或环境声。",
        restraintLevel: "中等克制，东方玄幻半写实 CG 表演，避免舞台化挥臂和无依据法术特效。",
        beats: shotData.beats,
    };
}

function makeLightingPlan(shotData) {
    return {
        palette: shotData.colorPalette,
        colorTemperature: "南门暖金侧光与大厅清冷青白/黛青反射形成层次，血印只在成立时提供受控暖红视觉重心。",
        keyLight: shotData.lighting,
        fillLight: "弱冷青白正面补光，保留眼神、手部、纸张纤维和衣料纹理，不抹平皮肤微纹理。",
        rimLight: "南门暖金沿发丝、肩线和薄纱边缘形成细窄轮廓光，随人物离门远近自然衰减。",
        contrast: "中高反差但暗部保留大厅结构，脸部不过曝，金属刃口和陶瓷杯沿不产生脱离光源的高光。",
        materialResponse: "木桌哑光、宣纸纤维微反射、陶瓷柔反射、暗银刃口冷反射、锦缎与薄纱按 PBR 粗糙度区分。",
        skinToneProtection: "保留自然肤色、细碎绒毛和柔和骨相起伏，不使用磨皮或塑料皮肤。",
        inheritFromPrevious: shotData.inheritFromPrevious,
        transitionToNext: shotData.transitionToNext,
    };
}

function state(characterState, propsState, action, lighting = "南门暖金侧逆光，室内清冷青白反射") {
    return {
        characters: characterState,
        props: propsState,
        environment: "萧家议事大厅：北侧首位、中央长桌、南侧大门和东西对峙通道保持不变",
        lighting,
        axis: "纳兰嫣然画面左/西，萧炎画面右/东，萧战北侧首位；保持180度轴线",
        screenDirection: action,
    };
}

function entity(assetId, position, gaze, pose, expression, action) {
    return { assetId, position, gaze, pose, expression, action };
}

function createShot(definition, order, previousCode) {
    const timeStart = order * 30;
    const shotCode = `SH${String(order + 1).padStart(2, "0")}`;
    const common = {
        shotSize: definition.frames.length >= 6 ? "中景至中近景" : "中景",
        cameraAngle: "视线高度平视，沿大厅既定180度动作轴线",
        composition: "中央长桌作为横向分隔，人物按左/西、右/东和北侧首位形成可复核三角或纵深关系",
        characterBlocking: "萧炎默认位于画面右/东侧或中央桌案动作位，纳兰嫣然位于画面左/西侧，萧战位于北侧首位；需要移动时只沿大厅通道移动，不穿越轴线",
        gazeDirection: definition.gazeDirection || "当前冲突对象、北侧首位或南门",
        actionStart: definition.frames[0].visible,
        actionEnd: definition.frames.at(-1).visible,
        screenDirection: "左/西与右/东关系固定，萧炎向南门移动时保持由大厅内向南的屏幕方向",
        axisRule: "纳兰嫣然左/西、萧炎右/东、萧战北侧首位；所有反打保持180度轴线，不从南门反向切入",
        continuityNotes: "继承角色身份、服装层次、道具材质、南门主光和大厅空间拓扑；下一镜只使用本镜当前视频版本经人工验收的实际尾帧作为连续性图片依据。",
    };
    const referenceManifest = [];
    if (previousCode) referenceManifest.push({ alias: "@图片1", role: "previous_actual_tail", purpose: "上一镜当前视频版本经人工验收的实际尾帧，仅用于锁定本镜入口状态", shotId: previousCode });
    let aliasIndex = referenceManifest.length + 1;
    for (const code of definition.characterCodes) {
        referenceManifest.push({ alias: `@图片${aliasIndex++}`, role: "character_anchor", purpose: `锁定${assetName(code)}的身份、脸部、服装和当前状态`, assetId: code });
    }
    referenceManifest.push({ alias: `@图片${aliasIndex++}`, role: "scene_anchor", purpose: "锁定萧家议事大厅的首位、桌案、南门光向、通道和180度轴线", assetId: "S01" });
    for (const code of definition.propCodes) referenceManifest.push({ alias: `@图片${aliasIndex++}`, role: "prop_anchor", purpose: `锁定${assetName(code)}的形状、材质和持有人关系`, assetId: code });
    const referenceCount = { min: referenceManifest.length, max: Math.min(9, referenceManifest.length) };
    common.globalSetting = "萧家议事大厅；中央长桌与北侧首位固定，南门白日暖光进入室内，角色身份、服装、道具材质和180度轴线不漂移；画面采用东方玄幻半写实3D国漫电影质感。";
    common.environmentMotif = definition.environmentMotif || "门外风声与室内短混响形成压力；桌面、衣袖、茶水、宣纸或血印承担可见节拍。";
    common.lighting = definition.lighting || "南门暖金侧逆光沿角色肩线与发丝进入，室内清冷青白反射保留面部和手部细节";
    common.colorPalette = definition.colorPalette || "清冷青白、低饱和黛青大厅，局部暖金；血印结果处使用克制血红";
    common.gazeDirection = definition.gazeDirection || "冲突对象与北侧首位之间的受控视线关系";
    common.arc = definition.arc || "从压力建立到当前镜头结果成立；每个可见节点改变姿态、视线、手部或道具状态。";
    const performanceBeat = (phase, item) => ({
        emotion: `${phase}阶段，${item.performance}`,
        facialAction: item.performance,
        gaze: `视线围绕${common.gazeDirection}保持可见反应`,
        bodyAction: item.visible,
    });
    common.beats = definition.beats || {
        start: performanceBeat("起始", definition.frames[0]),
        middle: performanceBeat("中段", definition.frames[Math.floor(definition.frames.length / 2)]),
        end: performanceBeat("结束", definition.frames.at(-1)),
    };
    const frames = buildFrames(definition, common, shotCode);
    const utterances = timedUtterances(definition.utterances, shotCode);
    const framePlan = {
        start: { source: previousCode ? "previous_accepted_actual_tail" : "independent" },
        end: { required: true },
        frames,
        referenceManifest,
        referenceCount,
    };
    const entryCharacters = definition.entryCharacters || defaultEntryCharacters();
    const exitCharacters = definition.exitCharacters || defaultExitCharacters();
    const entryProps = definition.entryProps || definition.propCodes.map((code) => ({ assetId: code, state: "本镜入口保持已声明的道具状态", holderId: code === "P04" ? "C03" : "C01" }));
    const exitProps = definition.exitProps || definition.propCodes.map((code) => ({ assetId: code, state: "本镜出口保持可被下一镜继承的道具状态", holderId: code === "P04" ? "C03" : "C01" }));
    const continuity = { ...common };
    const shotData = {
        ...common,
        referenceManifest,
        continuityNotes: common.continuityNotes,
    };
    const dialoguePerformance = utterances.map((item) => ({
        utteranceId: item.id,
        intent: item.intent,
        tone: item.speechRate,
        pace: `${item.speechRateCharsPerSecond}字/秒；前停顿${item.pauseBeforeSeconds}秒，后停顿${item.pauseAfterSeconds}秒`,
        pause: `前${item.pauseBeforeSeconds}秒 / 后${item.pauseAfterSeconds}秒`,
        emphasis: item.emphasis,
        facialReactionBefore: item.beforeAction,
        facialReactionDuring: item.duringAction,
        facialReactionAfter: item.afterAction,
    }));
    const videoPrompt = buildVideoPrompt(shotData, frames, utterances);
    const firstPrompt = frames[0].imagePrompt;
    const lastPrompt = frames.at(-1).imagePrompt;
    return {
        code: shotCode,
        order: order + 1,
        title: definition.title,
        description: definition.description,
        sourceText: definition.sourceText || definition.dialogue,
        shotBoundary: `按自然语义、说话人转换、动作触发和结果停顿切分；${definition.description}`,
        dialogue: definition.dialogue,
        narration: definition.narration,
        utterances,
        performancePlan: makePerformancePlan(shotData),
        dialoguePerformance,
        lightingPlan: makeLightingPlan(shotData),
        imagePrompt: firstPrompt,
        videoPrompt,
        cameraMotion: definition.cameraMotion,
        startFramePrompt: firstPrompt,
        endFramePrompt: lastPrompt,
        negativePrompt,
        continuity,
        timecode: `${timeStart}-${timeStart + 30}s`,
        dramaticFunction: definition.dramaticFunction,
        lens: definition.lens,
        lighting: common.lighting,
        colorPalette: common.colorPalette,
        transitionIn: order === 0 ? "独立建立" : previousCode && definition.storySceneCode !== "SC04" ? "连续动作" : "承接上一镜出口状态",
        transitionOut: definition.transitionOut,
        performanceNotes: definition.narration,
        sound: {
            ambience: "萧家大厅短混响、南门白日风声、远处空间空气声",
            soundEffects: definition.propCodes.includes("P04") ? "衣袍摩擦、茶盏轻碰、桌面受力和少量茶水声" : definition.propCodes.includes("P02") ? "毛笔落墨、宣纸摩擦、短剑出鞘和一次克制划掌声" : "衣袍摩擦、纸张移动、脚步和呼吸变化",
            music: "低声古琴与箫铺底；桌拍、血印成立和最后离场处按导演停顿设计留白",
        },
        entryState: state(entryCharacters, entryProps, "角色保持既定左右关系，视线沿180度轴线进入本镜"),
        exitState: state(exitCharacters, exitProps, "结果姿态沿当前轴线停住，作为下一镜唯一连续性状态"),
        framePlan,
        sourceAssetIds: [],
        duration: 30,
        characterCodes: definition.characterCodes,
        propCodes: definition.propCodes,
        clueCodes: [],
        locationCode: "S01",
        videoMode: "storyboard",
        storyboardFrameMode: "all_frames",
        storySceneCode: definition.storySceneCode,
    };
}

function assetName(code) {
    return [...characters, ...locations, ...props].find((item) => item.code === code)?.name || code;
}

function defaultEntryCharacters() {
    return [
        entity("C01", "画面右/东侧或中央桌案动作位", "看向当前冲突目标", "站立，双脚由青砖支撑", "压抑但可控", "承受并准备回应"),
        entity("C02", "画面左/西侧", "看向萧炎或萧战", "站立，礼服袖口收拢", "克制强势", "掌控谈判节奏"),
        entity("C03", "北侧首位或桌后", "观察萧炎与纳兰", "坐或站在首位方向", "疲惫而警觉", "承受家族颜面压力"),
    ];
}

function defaultExitCharacters() {
    return [
        entity("C01", "画面右/东侧或中央桌案动作位", "看向下一镜动作目标", "肩背比入口更直", "当前结果后的坚定", "把出口状态交给下一镜"),
        entity("C02", "画面左/西侧", "看向萧炎或当前结果", "站立，袖口保持受力", "强势或被结果动摇", "停在当前结果旁"),
        entity("C03", "北侧首位或桌后", "看向儿子或当前道具", "保持首位轴线", "担忧转为支持", "保留父亲的支撑关系"),
    ];
}

function updateStateDetails(shots) {
    const details = [
        [
            [
                entity("C01", "画面右/东侧长桌边", "直视纳兰", "肩背直立，右手离开桌沿", "压怒后的警觉", "把责任推回纳兰"),
                entity("C02", "画面左/西侧", "看向萧炎", "袖口被手指收拢", "表面平静", "准备提出条件"),
                entity("C03", "北侧首位", "看向纳兰", "身体前倾", "担忧", "承受颜面压力"),
            ],
            [{ assetId: "P04", state: "茶盏水面波纹正在消退", holderId: "C03" }],
        ],
        [
            [entity("C01", "画面右/东侧", "看向纳兰", "身体前探", "警觉", "等待约定内容"), entity("C02", "画面左/西侧", "看向萧炎", "手收回袖中", "宣判般平静", "把条件留给下一句"), entity("C03", "北侧首位", "看向两人", "保持前倾", "审慎", "等待答案")],
            [{ assetId: "P04", state: "茶水完全静止", holderId: "C03" }],
        ],
        [
            [entity("C01", "画面右/东侧", "看向萧战", "右手握拳", "被逼到边缘", "承受三年期限"), entity("C02", "画面左/西侧", "看向萧炎", "手势收回", "冷静强势", "条件已说完"), entity("C03", "北侧桌后", "看向纳兰", "右掌刚离桌面", "暴怒", "拍桌打断")],
            [{ assetId: "P04", state: "少量茶水从杯沿洒到桌面", holderId: "C03" }],
        ],
        [
            [
                entity("C01", "画面右/东侧", "看向纳兰", "站在中线前", "决断前的紧绷", "准备回答"),
                entity("C02", "画面左/西侧", "看向萧炎", "手指指向中线", "不耐", "逼问选择"),
                entity("C03", "北侧桌后", "看向萧炎", "双手离开桌面", "克制", "把决定权留给儿子"),
            ],
            [{ assetId: "P04", state: "桌面茶水停止晃动", holderId: "C03" }],
        ],
        [
            [
                entity("C01", "中央中线前", "先看萧战再直视纳兰", "双脚稳住，右手落回身侧", "冷笑转坚定", "明确自己仍有时间"),
                entity("C02", "画面左/西侧", "追随萧炎视线", "袖口收紧", "被反击刺中", "保持强势外壳"),
                entity("C03", "北侧首位方向", "看向儿子", "肩背放松半寸", "支持初现", "听见儿子反击"),
            ],
            [],
        ],
        [
            [
                entity("C01", "中线前", "看向纳兰再转向萧战", "前移半步后停住", "锋利而克制", "说出莫欺少年穷"),
                entity("C02", "画面左/西侧", "看向萧炎", "肩膀轻微后收", "被迫承受", "失去话语优势"),
                entity("C03", "北侧桌后", "看向萧炎", "右掌抬起", "骄傲与激动", "准备拍桌回应"),
            ],
            [{ assetId: "P04", state: "茶盏被左手按稳，桌拍前保持静止", holderId: "C03" }],
        ],
        [
            [
                entity("C01", "画面右/东侧桌前", "看向宣纸", "右手持笔，左手靠近纸角", "冷静决绝", "进入书写动作"),
                entity("C02", "画面左/西侧桌边", "盯住萧炎的手", "手掌压住桌沿", "尖锐强势", "说完赌约条件"),
                entity("C03", "北侧首位", "看向宣纸", "站在桌后", "沉默支持", "等待儿子落笔"),
            ],
            [
                { assetId: "P01", state: "宣纸平放，尚无血印", holderId: "C01" },
                { assetId: "P03", state: "毛笔落入墨砚并接近纸面", holderId: "C01" },
            ],
        ],
        [
            [
                entity("C01", "中央桌案前", "看向宣纸与左掌", "右手停笔后握短剑", "屏息决绝", "完成一次划掌并按下血印"),
                entity("C02", "画面左后景", "看向萧炎的左掌", "身体后收", "震惊", "不敢靠近"),
                entity("C03", "北侧首位方向", "看向血印", "保持不动", "沉重", "等待结果落地"),
            ],
            [
                { assetId: "P01", state: "中央偏下已经出现清晰血手印", holderId: "C01" },
                { assetId: "P02", state: "短剑已放回纸张右侧，刀刃无血滴飞溅", holderId: "C01" },
                { assetId: "P03", state: "毛笔停在砚台旁", holderId: "C01" },
            ],
        ],
        [
            [
                entity("C01", "纳兰面前的桌案右侧", "先看血契再看萧战", "左手拈契约，随后转身", "冷硬", "宣布休证并转向父亲"),
                entity("C02", "画面左/西侧桌边", "看向血契", "手指停在纸边", "错愕", "第一次失去反驳节奏"),
                entity("C03", "北侧首位", "看向萧炎左掌", "身体向前探", "心疼与震动", "准备接住儿子"),
            ],
            [
                { assetId: "P01", state: "血手契约被重重放在纳兰面前", holderId: "C02" },
                { assetId: "P02", state: "短剑留在桌面右侧", holderId: "C01" },
            ],
        ],
        [
            [
                entity("C01", "北侧首位与中央桌案之间", "看向萧战", "从跪姿被扶到半起", "歉疚转坚定", "接受父亲支撑"),
                entity("C02", "画面左/西侧", "低头看血契", "握住纸边", "茫然", "留在关系断裂一侧"),
                entity("C03", "北侧首位前方", "看向萧炎", "右手托住儿子肩背", "温厚坚定", "说出信任"),
            ],
            [{ assetId: "P01", state: "血手契约仍在纳兰手中，纸面血印朝上", holderId: "C02" }],
        ],
        [
            [
                entity("C01", "从中央向南门移动", "先看萧战再看纳兰", "左掌贴近胸口，随后向门外行走", "坚定而孤独", "留下三年后再见的承诺"),
                entity("C02", "画面左/西侧桌边", "追随萧炎背影", "握住血契，身体不动", "错愕转茫然", "承受契约重量"),
                entity("C03", "北侧首位方向", "看向儿子与南门", "保持站立", "信任与担忧并存", "目送儿子离场"),
            ],
            [{ assetId: "P01", state: "血手契约被纳兰握住，纸张边缘因受力略微卷起", holderId: "C02" }],
        ],
        [
            [
                entity("C01", "北侧首位与中央桌案之间", "看向萧战", "由跪姿被扶起，左掌贴近胸口", "歉疚转为坚定", "听完父亲的信任"),
                entity("C02", "画面左/西侧桌边", "低头看血契", "双手握住纸张", "茫然", "留在血契一侧"),
                entity("C03", "北侧首位前方", "看向萧炎", "右手托住儿子肩背", "温厚坚定", "说出不会一辈子是废物"),
            ],
            [{ assetId: "P01", state: "血手契约在纳兰手中保持血印朝上", holderId: "C02" }],
        ],
        [
            [
                entity("C01", "中央向南门的通道", "看向南门并短暂停在纳兰侧面", "左掌贴近胸口，随后迈入门光", "坚定而孤独", "留下三年后再见的承诺"),
                entity("C02", "画面左/西侧桌边", "追随萧炎背影", "握住血契，身体不动", "错愕转茫然", "承受契约重量"),
                entity("C03", "北侧首位方向", "看向儿子与南门", "保持站立", "信任与担忧并存", "目送儿子离场"),
            ],
            [{ assetId: "P01", state: "血手契约被纳兰握住，纸张边缘因受力略微卷起", holderId: "C02" }],
        ],
    ];
    for (let i = 0; i < shots.length; i += 1) {
        const detail = details[i] || [defaultExitCharacters(), []];
        shots[i].entryState = state(defaultEntryCharacters(), detail[1], "按大厅既定轴线进入本镜");
        shots[i].exitState = state(detail[0], detail[1], "按本镜结果状态向下一镜交接");
    }
}

function section(code, title, content) {
    return { code, title, content };
}

function buildArchive(episode, sourceText) {
    const shots = episode.shots;
    const dialogueDirections = shots.flatMap((shot) =>
        shot.utterances.map((item) => ({
            id: item.id,
            shotCode: shot.code,
            speaker: item.speaker,
            text: item.text,
            performance: `${item.speechRate}；前停顿${item.pauseBeforeSeconds}s，后停顿${item.pauseAfterSeconds}s`,
            lipSync: true,
            startSecond: item.startSecond,
            endSecond: item.endSecond,
            pauseBeforeSeconds: item.pauseBeforeSeconds,
            pauseAfterSeconds: item.pauseAfterSeconds,
            speechRate: item.speechRate,
            speechRateCharsPerSecond: item.speechRateCharsPerSecond,
        })),
    );
    const allShotCodes = shots.map((shot) => shot.code);
    const shotTable = [
        "| 镜号 | 时间 | 阶段 | 景别 | 运镜 | 焦段 | 灯光 | 色彩 | 转场 | 动作描述 | end_state |",
        "|---|---:|---|---|---|---:|---|---|---|---|---|",
        ...shots.map(
            (shot) =>
                `| ${shot.code} | ${shot.timecode} | ${shot.dramaticFunction} | ${shot.continuity.shotSize} | ${shot.cameraMotion} | ${shot.lens} | ${shot.lighting} | ${shot.colorPalette} | ${shot.transitionOut} | ${shot.description} | ${shot.exitState.characters.map((item) => item.action).join("；")} |`,
        ),
    ].join("\n");
    const dialogueTable = ["| ID | 镜号 | 说话人 | 台词 | 表演与节奏 | 口型 |", "|---|---|---|---|---|---|", ...dialogueDirections.map((item) => `| ${item.id} | ${item.shotCode} | ${item.speaker} | ${item.text} | ${item.performance} | 是 |`)].join("\n");
    const soundTable = ["| 镜号 | 环境音 | 拟音 | 音乐 |", "|---|---|---|---|", ...shots.map((shot) => `| ${shot.code} | ${shot.sound.ambience} | ${shot.sound.soundEffects} | ${shot.sound.music} |`)].join("\n");
    const sections = [
        section(
            "SEC01",
            "一、项目总览",
            `项目名：三年之约·血手休证（全新独立制作包）\n原作来源：${path.basename(sourcePath)}，SHA-256：${sourceHash}\n类型：东方玄幻修仙／家族冲突／少年成长\n核心冲突：纳兰嫣然以退婚与三年挑战压迫萧家颜面，萧炎以血手休证夺回叙事主动权。\n本集情绪：压抑 → 逼问 → 反击 → 血印反转 → 父子信任 → 孤独离场。\n成片：13 个逻辑片段，每片 30 秒，总时长 390 秒；720p，9:16。\n视觉方案：${visualDirection}\n导演执行：每镜一个唯一戏剧职责；每段视频按起点、动作与触发、可见衔接、终点写入完整时间轴；图片帧按九段静态骨架冻结已经发生的可见状态。`,
        ),
        section("SEC02", "二、原创第一章", sourceText),
        section(
            "SEC03",
            "三、第一集文学剧本",
            `基础设定：乌坦城萧家议事大厅，白日南门光进入冷青白室内；萧炎、纳兰嫣然、萧战三人保持固定180度轴线。\n\n${episode.storyScenes.map((scene) => `场${scene.order}｜${scene.title}｜${scene.timeOfDay}｜${scene.timeRange}\n${scene.summary}\n镜头：${scene.shotCodes.join("、")}`).join("\n\n")}\n\n剧本正文：\n${episode.script}`,
        ),
        section("SEC04", "四、镜头执行表", shotTable),
        section(
            "SEC05",
            "五、角色一致性资产",
            characters
                .map((item) => `### ${item.code} ${item.name}\n\n\`\`\`text\n${item.profile.styling}\n视觉身份：${item.profile.visualIdentity}\n一致性锁：${item.profile.consistencyRules}\n负面：${item.profile.forbiddenChanges.join("；")}\n\`\`\``)
                .join("\n\n"),
        ),
        section("SEC06", "六、场景一致性资产", locations.map((item) => `### ${item.code} ${item.name}\n\n\`\`\`text\n${item.profile.styling}\n空间锚点：${item.profile.visualIdentity}\n一致性锁：${item.profile.consistencyRules}\n\`\`\``).join("\n\n")),
        section(
            "SEC07",
            "七、关键视频资产 Prompt",
            [
                "### V01｜萧家议事大厅空间锚点\n",
                "\`\`\`text\n高精度3D半写实东方玄幻议事大厅，北侧高背首位、中央深色木长桌、南侧大门通向白日暖金，东西两侧形成不穿越180度轴线的对峙通道；青砖、木石、陶瓷、宣纸均按PBR粗糙度与反射差异表现；室内清冷青白反射，南门暖金侧逆光，真实空气透视与浅体积尘埃；无人物、无文字、无水印、无现代元素。\n\`\`\`",
                "### V02｜血手契约动作锚点\n",
                "\`\`\`text\n中央深色木桌上的薄宣纸、普通毛笔与暗银短剑；宣纸先保持无可读文字，随后只出现一次左掌清晰血印；短剑刃口冷反射，血液不喷溅，纸纤维和桌面受力可见；冷青白室内光与南门暖金共同照明，血红只作为剧情结果的受控视觉重心。\n\`\`\`",
                "### V03｜父子信任与离场锚点\n",
                "\`\`\`text\n萧战在北侧首位方向托住跪地的萧炎，父子肩线形成真实支撑；纳兰在左侧握住血手契约；萧炎随后向南门白日暖光离场，背影被拉长，冷灰大厅与暖金门光保持同一空间比例和材质标准。\n\`\`\`",
            ].join("\n"),
        ),
        section(
            "SEC08",
            "八、全案板 Prompt",
            `全案板 1/1｜${allShotCodes[0]}-${allShotCodes.at(-1)}\n\`\`\`text\n9:16竖版连续分镜总览，13个30秒逻辑片段按同一萧家议事大厅空间拓扑排列：SH01-03退婚与三年约定；SH04-07父子护持与少年反击；SH08-10赌约加码、落笔、割掌、血手休证；SH11-13父子信任、三年后离场。统一角色身份、服装、南门暖金主光、冷青白室内反射、深色木桌、宣纸、短剑和血印结果；每格突出相邻状态变化，不复制同一姿态，不加入额外人物、字幕、水印或现代元素。\n\`\`\``,
        ),
        section(
            "SEC09",
            "九、台词与表演脚本",
            `台词基调：萧炎前段冷笑压怒，中段由克制转锋利，末段含泪但坚定；纳兰从礼貌强势转不耐、受辱和错愕；萧战从族长的愤怒转为父亲的厚重信任。\n\n${dialogueTable}\n\n沉默设计：SH03拍桌后留茶水与门风；SH05“我接下”后留2秒以上反应；SH10血印成立后留桌面与呼吸留白；SH13最后一句后保留门外风声和血契纸张摩擦。`,
        ),
        section("SEC10", "十、声音设计", soundTable),
        section("SEC11", "十一、分段视频 Prompt", shots.map((shot) => `### P${String(shot.order).padStart(2, "0")}｜${shot.code} ${shot.title}\n\n\`\`\`text\n${shot.videoPrompt}\n\`\`\``).join("\n\n")),
        section(
            "SEC12",
            "十二、资产映射与执行顺序",
            `资产映射：C01-C03 为角色一致性资产；S01 为唯一场景锚点；P01-P04 为本章实际出镜道具。每个镜头的 referenceManifest 只绑定本镜声明的角色、场景、道具；SH02 起使用上一镜当前视频版本经人工验收的实际尾帧作为唯一连续性图片依据。\n\n生成顺序：\n1. 生成并人工确认 C01-C03 角色固定资产。\n2. 生成并人工确认 S01 萧家议事大厅空间锚点，锁定南门光向和180度轴线。\n3. 生成并人工确认 P01-P04 道具基准图，尤其是宣纸、血印、短剑和茶盏受力关系。\n4. 依次生成 SH01-SH13 的逐帧图片；每镜先验收本帧可见状态，再生成30秒视频。\n5. 每镜视频完成后提取实际首尾帧；只有人工验收当前视频版本实际尾帧，才解锁下一镜。\n6. 最后进行对白口型、动作因果、材质连续性、光色一致性和最终音画 QC。\n\n镜头范围：${allShotCodes.join("、")}。`,
        ),
        section(
            "SEC13",
            "十三、QC 报告",
            `结构 QC：13 章固定章节齐全，格式为 vozeb-drama-production-package-v1；本包为全新独立包，不引用旧制作包的规范对象、资产 ID 或镜头数据。\n导演 QC：每镜具备唯一戏剧职责、真实空间支撑、受控180度轴线、单一主运镜、具体光源方向、前景/中景/背景纵深和可见出口状态。\n对白 QC：所有对白逐句记录 startSecond/endSecond、前后停顿、情绪语速和可复核字速；对白按约5字/秒核算，超过镜头容量时生成前置提醒，不用快嘴硬塞。\n帧 QC：每镜 ${shots.map((shot) => `${shot.code}=${shot.framePlan.frames.length}帧`).join("，")}；每帧从0秒无空白、无重叠覆盖30秒，并用九段静态帧骨架写出不同的可见姿态、视线、手部、道具或环境结果。\n连续性 QC：SH01独立起始；SH02-SH12均声明 previous_accepted_actual_tail；实际生产前必须完成上一镜视频版本尾帧人工验收。\n风险提醒：附件只提供小说片段，角色基准图、场景基准图和声音资产尚未生成；正式供应商生产前需完成资产确认、上游模型能力确认和最终口型/音画验收。`,
        ),
    ];
    return {
        formatVersion: "vozeb-drama-production-package-v1",
        sections,
        promptAssets: [
            { code: "V01", category: "keyframe", title: "萧家议事大厅空间锚点", prompt: "高精度3D半写实东方玄幻议事大厅，北侧首位、中央木桌、南门暖金光、冷青白室内反射、真实PBR木石陶瓷材质和180度轴线。", shotCodes: allShotCodes },
            { code: "V02", category: "keyframe", title: "血手契约动作锚点", prompt: "宣纸、毛笔、暗银短剑与一次左掌血印动作，血印作为受控结果色，禁止喷溅与可读文字。", shotCodes: ["SH07", "SH08", "SH09", "SH10"] },
            { code: "V03", category: "keyframe", title: "父子信任离场锚点", prompt: "萧战托住萧炎，纳兰握血契，萧炎向南门暖光离场，保留冷灰大厅与门光的真实纵深。", shotCodes: ["SH10", "SH11", "SH12"] },
            { code: "SB01", category: "storyboard", title: "SH01-SH13 30秒连续全案板", prompt: "13个30秒逻辑片段的竖版全案板，按退婚、三年约定、反击、血契、父子信任和离场六个情绪段落排列，统一角色、空间、材质、光色和轴线。", shotCodes: allShotCodes },
        ],
        dialogueDirections,
        voiceDirections: [
            { subject: "萧炎", direction: "少年男声，前段低沉冷笑，中段锋利但不嘶喊，末段含泪压住颤抖后坚定。" },
            { subject: "纳兰嫣然", direction: "少女声线清亮偏冷，从礼貌强势转为不耐、受辱后的尖锐和血契成立后的短促失语。" },
            { subject: "萧战", direction: "中年男声低沉厚重，桌拍处爆发，托住儿子时回到温厚坚定。" },
        ],
        silenceDirections: [
            { shotCode: "SH03", direction: "萧战拍桌后保留茶水落回桌面的真实声响和短暂空白。" },
            { shotCode: "SH05", direction: "萧炎说‘我接下’后保留不少于2秒的视线反应和大厅风声。" },
            { shotCode: "SH09", direction: "血印成立后保留纸张受压、呼吸和桌面闷响，不立刻铺满音乐。" },
            { shotCode: "SH13", direction: "最后一句后保留门外风声、衣袍远去声和纳兰握纸摩擦声。" },
        ],
        referencePlan: [
            { priority: 1, asset: "C01 萧炎", purpose: "锁定少年身份、脸部、发束、衣袍和左掌伤口", planType: "consistency_asset", shotCodes: allShotCodes },
            { priority: 2, asset: "C02 纳兰嫣然", purpose: "锁定少女身份、发簪、礼服和画面左侧站位", planType: "consistency_asset", shotCodes: allShotCodes },
            { priority: 3, asset: "C03 萧战", purpose: "锁定父亲年龄感、族长体态、首位位置和拍桌动作", planType: "consistency_asset", shotCodes: allShotCodes },
            { priority: 4, asset: "S01 萧家议事大厅", purpose: "锁定北侧首位、中央桌案、南门光向、通道和180度轴线", planType: "scene_anchor", shotCodes: allShotCodes },
            { priority: 5, asset: "P01 婚约契约／休证", purpose: "锁定宣纸比例、血印位置和持有人关系", planType: "prop_anchor", shotCodes: ["SH08", "SH09", "SH10", "SH11", "SH12", "SH13"] },
            { priority: 6, asset: "P02 短剑", purpose: "锁定暗银窄刃、深木剑柄和一次划掌动作", planType: "prop_anchor", shotCodes: ["SH09", "SH10"] },
            { priority: 7, asset: "P03 毛笔与砚台", purpose: "锁定落笔动作的桌面道具关系", planType: "prop_anchor", shotCodes: ["SH08", "SH09"] },
            { priority: 8, asset: "P04 茶盏与长桌", purpose: "锁定拍桌受力和茶水飞溅幅度", planType: "prop_anchor", shotCodes: ["SH01", "SH02", "SH03", "SH04", "SH08"] },
        ],
        generationOrder: [
            "先生成并确认 C01-C03 角色基准图，再生成 S01 场景锚点和 P01-P04 道具基准图。",
            "按 SH01→SH13 顺序生成逐帧图片；每镜使用5-6个真实动作节点，先验收当前帧状态。",
            "按30秒连续时间轴生成视频；上一镜当前视频版本的实际尾帧经人工验收后才作为下一镜唯一连续性图片。",
            "完成对白口型、环境音、拟音、音乐停顿、材质光色和最终音画 QC。",
        ],
        qcReport: "本包按最新短剧视频导演规范生成：事实、资产和导演建议分开；每镜一个戏剧职责；静态帧冻结结果，视频 Prompt 直接携带真实时间段；生产前仍需完成基准资产生成、供应商能力确认、实际尾帧人工验收和最终音画 QC。",
    };
}

function markdown(value) {
    const embedded = JSON.stringify(value, null, 2).replace(/```/gu, "\\u0060\\u0060\\u0060");
    const body = value.archive.sections.map((section) => `## ${section.title}\n\n${section.content}`).join("\n\n");
    return `# 《${value.project.title}》完整制作包\n\n> 制作包格式：\`vozeb-drama-production-package-v1\`\n> 规范数据源：JSON；本文件为全新独立制作包。\n> 目标平台：Seedance 2.5｜语言：中文｜画幅：9:16｜成片：约 390 秒\n\n## 规范对象（导入权威数据）\n\n\`\`\`drama-production-package\n${embedded}\n\`\`\`\n\n${body}\n`;
}

function validate(value) {
    if (value.episodes[0].shots.length !== 13) throw new Error("独立包必须包含13个30秒镜头");
    for (const shot of value.episodes[0].shots) {
        if (shot.duration !== 30) throw new Error(`${shot.code} duration 无效`);
        if (shot.framePlan.frames.length < 5 || shot.framePlan.frames.length > 9) throw new Error(`${shot.code} 帧数必须在5-9之间`);
        if (shot.framePlan.frames[0].startSecond !== 0 || shot.framePlan.frames.at(-1).endSecond !== 30) throw new Error(`${shot.code} 帧时间轴未覆盖0-30秒`);
        for (let i = 1; i < shot.framePlan.frames.length; i += 1) {
            if (shot.framePlan.frames[i - 1].endSecond !== shot.framePlan.frames[i].startSecond) throw new Error(`${shot.code} 帧时间轴有空白或重叠`);
        }
        if (!shot.framePlan.referenceManifest.some((item) => item.role === "scene_anchor" && item.assetId === "S01")) throw new Error(`${shot.code} 缺少场景锚点`);
        if (!shot.imagePrompt.includes("静态关键帧：") || !shot.imagePrompt.includes("负面约束：")) throw new Error(`${shot.code} 静态帧骨架不完整`);
        if (/主体的眉眼|动作展开|关键变化|结果状态|入口构图已建立/u.test(shot.imagePrompt)) throw new Error(`${shot.code} 包含模板化帧文案`);
        if (/(?:运镜|时间段|对白|声音|口型)/u.test(shot.imagePrompt)) throw new Error(`${shot.code} imagePrompt 混入视频字段`);
        if (!shot.videoPrompt.includes("起点：") || !shot.videoPrompt.includes("动作与触发：") || !shot.videoPrompt.includes("可见衔接：") || !shot.videoPrompt.includes("终点：")) throw new Error(`${shot.code} videoPrompt 时间段字段不完整`);
    }
}

const shots = shotDefinitions.map((definition, index) => createShot(definition, index, index ? `SH${String(index).padStart(2, "0")}` : undefined));
updateStateDetails(shots);
for (const shot of shots) {
    const frames = shot.framePlan.frames;
    const shotData = {
        ...shot.continuity,
        referenceManifest: shot.framePlan.referenceManifest,
        dramaticFunction: shot.dramaticFunction,
        description: shot.description,
        globalSetting: "萧家议事大厅；中央长桌与北侧首位固定，南门白日暖光进入室内，角色身份、服装、道具材质和180度轴线不漂移；画面采用东方玄幻半写实3D国漫电影质感。",
        environmentMotif: "门外风声与室内短混响形成压力；桌面、衣袖、茶水、宣纸或血印承担可见节拍。",
        lighting: shot.lighting,
        colorPalette: shot.colorPalette,
        cameraMotion: shot.cameraMotion,
        continuityNotes: shot.continuity.continuityNotes,
    };
    shot.videoPrompt = buildVideoPrompt(shotData, frames, shot.utterances);
}
const episode = {
    code: "E01-NEW",
    title: "血手休证·三年之约",
    targetDuration: 390,
    sourceRange: `独立读取：${path.basename(sourcePath)}；SHA-256 ${sourceHash}`,
    script: sourceText,
    outline: "退婚压力进入萧家大厅 → 三年云岚宗挑战成立 → 父子与少年反击 → 血手休证完成关系反转 → 父亲托住儿子 → 三年后离场誓言。",
    hook: "少年被称为废物，却以血手休证把退婚写成逐出对方的宣告。",
    nextPreview: "三年后云岚宗再会，今日的羞辱将转化为公开对决。",
    storyScenes: [
        { code: "SC01", order: 1, title: "退婚改为三年约定", timeOfDay: "白日", timeRange: "0-90s", locationCode: "S01", summary: "萧炎指出退婚伤及父亲颜面，纳兰提出三年云岚宗挑战，萧战拍桌护子。", shotCodes: ["SH01", "SH02", "SH03"] },
        { code: "SC02", order: 2, title: "少年接下约定并反击", timeOfDay: "白日", timeRange: "90-210s", locationCode: "S01", summary: "纳兰逼问现在与三年后，萧炎接下约定并以旧日天赋和莫欺少年穷反击。", shotCodes: ["SH04", "SH05", "SH06", "SH07"] },
        { code: "SC03", order: 3, title: "赌约加码与血手契约", timeOfDay: "白日", timeRange: "210-300s", locationCode: "S01", summary: "纳兰把赌约加码，萧炎落笔、割掌、留下血手休证并把契约拍到她面前。", shotCodes: ["SH08", "SH09", "SH10"] },
        { code: "SC04", order: 4, title: "父子信任与离场誓言", timeOfDay: "白日", timeRange: "300-390s", locationCode: "S01", summary: "萧炎跪父，萧战以信任托住他，萧炎留下三年后洗辱与再会承诺后离场。", shotCodes: ["SH11", "SH12", "SH13"] },
    ],
    shots,
    continuityEdges: shots.slice(1).map((shot, index) => ({
        fromShotCode: shots[index].code,
        toShotCode: shot.code,
        transition: shot.storySceneCode === shots[index].storySceneCode ? "continuous" : "match_cut",
        inheritActualEndFrame: true,
        carryCharacterIds: shot.characterCodes,
        carryPropIds: shot.propCodes,
        carryEnvironment: true,
        carryAxis: true,
        notes: "下一镜只使用上一镜当前视频版本经人工验收的实际尾帧，不复制上一镜姿态或手部结果。",
    })),
};

const project = {
    title: "三年之约·血手休证（独立新包）",
    summary: "基于附件小说片段重新创作的全新独立短剧制作包；13个30秒逻辑片段，总时长390秒，按真实语速、动作因果、连续性和东方玄幻半写实3D国漫视觉方案编排。",
    style: "东方玄幻修仙世界／高精度3D半写实国漫电影质感／PBR材质",
    ratio: "9:16",
    productionBible: {
        targetPlatform: "Seedance 2.5",
        language: "中文",
        ratio: "9:16",
        targetDuration: 390,
        visualStyle: visualDirection,
        colorScript: "大厅清冷青白与低饱和黛青 → 南门局部暖金 → 血手成立时受控血红 → 父子与离场回到冷青白和暖金交界",
        soundBible: "大厅短混响、南门白日风声、古琴与箫低声铺底；对白按约5字/秒核算，桌拍、纸张、短剑、血印和脚步承担动作节点。",
        globalNegativePrompt: negativePrompt,
        subtitleSafeArea: "字幕只在后期加入，位于画面底部安全区，不写入参考图和静态帧。",
        dialogueTiming: { version: "utterance-timing-v1", charsPerSecond: 5, requireUtteranceTimings: true },
        continuityMode: "strict",
        productionPlan: {
            version: "drama-production-plan-v1",
            skills: [
                { id: "seedance-director", name: "Seedance 导演", version: "2.0" },
                { id: "seedance-25-director", name: "Seedance 2.5 导演", version: "2.5" },
            ],
            visual: { visualStyle: visualDirection, artStyle: "高精度3D半写实国漫电影质感，真实皮肤微纹理、分束发丝、PBR木石锦缎金属和电影级空气透视", visualDirection, source: "manual" },
            video: { model: "seedance-2.5-c1", mode: "storyboard", ratio: "9:16", resolution: "720p", durationPolicy: "shot", shotDuration: 30, framePolicy: "agent", count: 1, audioMode: "native", allowExplicitFallback: false, modelParameters: {} },
            references: { strategy: "adaptive", minImages: 3, maxImages: 30, roles: ["previous_actual_tail", "character_anchor", "scene_anchor", "prop_anchor", "action_keyframe", "composition_keyframe"] },
            continuity: { mode: "strict", requireAcceptedActualTail: true },
            source: "package",
        },
    },
};

const archive = buildArchive(episode, sourceText);
const value = {
    schemaVersion: 1,
    project,
    assets: { characters, locations, props, clues: [] },
    episodes: [episode],
    seriesBible: {
        version: "series-bible-v1",
        canonCharacters: ["C01 萧炎", "C02 纳兰嫣然", "C03 萧战"],
        immutableRules: ["萧家大厅保持180度轴线", "血手契约只出现一次左掌血印", "三年后云岚宗挑战是本章唯一未来悬念"],
        relationshipState: "退婚关系被萧炎以血手休证强行改写为逐出纳兰，父子关系由颜面压力转为公开信任。",
        worldRules: ["斗气大陆", "乌坦城", "云岚宗", "修炼天赋与家族颜面共同构成社会压力"],
        unresolvedThreads: ["三年后萧炎与纳兰嫣然在云岚宗的挑战", "萧炎能否重新恢复并超越旧日天赋"],
        visualMotifs: ["南门暖金光", "清冷青白大厅", "宣纸血印", "长桌与180度轴线", "被拉长的离场背影"],
        soundMotifs: ["茶水波纹", "桌拍", "纸张摩擦", "短剑出鞘", "门外风声"],
    },
    archive,
};

validate(value);
fs.writeFileSync(`${outputBase}.json`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
fs.writeFileSync(`${outputBase}.md`, markdown(value), "utf8");
console.log(JSON.stringify({ outputBase, sourcePath, sourceHash, shots: shots.length, duration: episode.targetDuration, frameCounts: shots.map((shot) => [shot.code, shot.framePlan.frames.length]) }, null, 2));
