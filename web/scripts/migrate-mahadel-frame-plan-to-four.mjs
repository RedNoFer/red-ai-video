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

function text(value) {
    return typeof value === "string" ? value.trim() : "";
}

function metadataAction(value) {
    const action = text(value);
    return !action || /^生成\d+秒/u.test(action) || /^(?:深蓝黑、|无字幕、|口型同步、|拟亲情关系、|本内部镜头只执行：|保持角色、道具、轴线|(?:耳语|对白|旁白|台词)[:：])/u.test(action);
}

function groupedActions(shot) {
    const frames = Array.isArray(shot.framePlan?.frames) ? shot.framePlan.frames : [];
    const source = [
        shot.continuity?.actionStart,
        ...frames.map((frame) => frame.actionPrompt),
        ...String(shot.videoPrompt || "").split(/[。；;\n]+/u),
        shot.continuity?.actionEnd,
        shot.description,
    ];
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
    if (shot.code === "SH001" && duration === 8) return openingCutFrames("SH001", duration, [
        "黑湖无波，倒悬古塔与Karin模糊倒影对齐",
        "雪地中央四只手彼此扣紧，Karin掌心握住完整剑刃",
        "完整剑刃从掌心断口向外裂开，四只手仍未松开",
        "冷银断口占据画面中心，Karin手指扣住碎裂剑刃并停住",
    ]);
    if (shot.code === "SH002" && duration === 7) return openingCutFrames("SH002", duration, [
        "上一镜冷银断口与扣紧手指作为马车内匹配切入口",
        "马车内同一只手继续压住断剑，Karin肩膀绷紧",
        "Karin睁开灰绿色眼睛，视线落向断剑，呼吸急促并保持握持",
        "Karin完全惊醒，手扣断剑、肩膀绷紧、视线稳定锁定握柄",
    ]);
    const actionStart = text(shot.continuity?.actionStart) || text(shot.description) || text(shot.title);
    const actionEnd = text(shot.continuity?.actionEnd) || text(shot.description) || text(shot.title);
    const stateSuffixes = ["入口姿态、表情与视线已建立", "表情和视线对当前目标作出初次反应", "手部或身体姿态形成可见变化", "关键道具或环境状态已经改变", "动作完成后的表情、视线与道具关系稳定落点"];
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
            actionPrompt: `${action}；${visibleFrameState(action, index, frameCount)}`,
            imagePrompt: `静态关键帧：${action}；可见状态：${stateSuffixes[index]}；可见表演状态：${visibleFrameState(action, index, frameCount)}。${context}；三层空间保持前景框景、中景主体与背景环境关系；冻结为单一静态姿态。`,
        };
    });
}

function visibleFrameState(action, index, count) {
    if (/惊醒|睁眼|呼吸急促/u.test(action)) return index === count - 1 ? "表情由惊惧收束为警觉，视线稳定锁定断剑，肩膀绷紧" : "眉眼骤然睁开、下颌绷紧，视线落向断剑，手部继续扣住握柄";
    if (/否认|避开|隐瞒/u.test(action)) return "眉心轻收、嘴角压住，视线先避开对方后短暂回看，手部保持道具接触";
    if (/接住|水囊|推过去/u.test(action)) return "表情紧张略缓，视线跟随水囊，手部从待接变为握稳";
    if (/护符|警觉|注视|探测器|结界/u.test(action)) return "眉心收紧、眼神警觉，视线锁定结界或探测器，手部握紧当前道具";
    if (/解封|封印|力量|收力/u.test(action)) return "下颌收紧后放松，视线正对目标，手部由蓄力转为稳定收力";
    if (/木匣|铜镜|短刃|断口|铁砧|裂纹/u.test(action)) return "表情由疑惑转为戒备，视线锁定关键道具，手部保持明确接触关系";
    if (index === 0) return "表情保持入口情绪，视线沿叙事目标方向，手部与道具保持入口关系";
    if (index === count - 1) return "表情落在动作完成后的稳定状态，视线锁定下一叙事目标，手部与道具关系固定";
    return "眉眼出现细微反应，视线转向当前目标，手部或道具位置发生可见变化";
}

function openingCutFrames(code, duration, actions) {
    const stateLabels = ["入口构图已建立", "手部与道具关系发生可见变化", "表情、视线与道具状态同步变化", "动作完成后的稳定尾帧"];
    return actions.map((action, index) => {
        const startSecond = Number(((duration * index) / actions.length).toFixed(3));
        const endSecond = index === actions.length - 1 ? duration : Number(((duration * (index + 1)) / actions.length).toFixed(3));
        return {
            id: `${code}-F${String(index + 1).padStart(2, "0")}`,
            sequenceIndex: index + 1,
            startSecond,
            endSecond,
            actionPrompt: action,
            imagePrompt: `静态关键帧：${action}；可见状态：${stateLabels[index]}；可见表演状态：${visibleFrameState(action, index, actions.length)}；保持人物身份、服装、道具材质、空间结构、光向、构图和轴线连续；只呈现当前时间点的静态画面，不表现运动过程。`,
        };
    });
}

function splitTitle(title) {
    const match = text(title).match(/^(.*?)\s+(\d+)\/(\d+)$/u);
    return match ? { base: match[1].trim(), part: Number(match[2]), total: Number(match[3]) } : undefined;
}

function splitVisualActions(shot) {
    return [...new Set([
        shot.description,
        shot.continuity?.actionStart,
        shot.continuity?.actionEnd,
        ...(shot.exitState?.characters || []).map((item) => item.action),
        ...(shot.exitState?.props || []).map((item) => item.state),
    ].flatMap((value) => text(value).split(/[\n。！？!?；;]+/u).map(cleanVisibleAction).filter(isVisualAction)))];
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
    for (let index = 0; index < (episode.shots || []).length; ) {
        const parsed = splitTitle(episode.shots[index].title);
        const group = parsed?.part === 1 ? episode.shots.slice(index, index + parsed.total) : [];
        if (group.length === parsed?.total && group.every((shot, part) => {
            const title = splitTitle(shot.title);
            return title?.base === parsed.base && title.part === part + 1 && title.total === parsed.total;
        })) {
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
    const fixedTitles = ["一、项目总览", "二、原创第一章", "三、第一集文学剧本", "四、镜头执行表", "五、角色一致性资产", "六、场景一致性资产", "七、关键视频资产 Prompt", "八、全案板 Prompt", "九、台词与表演脚本", "十、声音设计", "十一、分段视频 Prompt", "十二、资产映射与执行顺序", "十三、QC 报告"];
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
    const fixedTitles = ["一、项目总览", "二、原创第一章", "三、第一集文学剧本", "四、镜头执行表", "五、角色一致性资产", "六、场景一致性资产", "七、关键视频资产 Prompt", "八、全案板 Prompt", "九、台词与表演脚本", "十、声音设计", "十一、分段视频 Prompt", "十二、资产映射与执行顺序", "十三、QC 报告"];
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
