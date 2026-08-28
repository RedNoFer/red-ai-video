import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const sourcePath = path.join(root, "output", "mahadel-episode-01-production-package.json");
const targetPath = path.join(root, "output", "mahadel-episode-01-production-package-v2-multiframe.json");
const targetMarkdownPath = path.join(root, "output", "mahadel-episode-01-production-package-v2-multiframe.md");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

const productionPlan = {
    version: "drama-production-plan-v1",
    skills: [],
    video: {
        model: "seedance-2-5",
        mode: "reference",
        ratio: "9:16",
        resolution: "720p",
        durationPolicy: "shot",
        count: 1,
        audioMode: "native",
        allowExplicitFallback: false,
    },
    references: {
        strategy: "adaptive",
        minImages: 3,
        maxImages: 5,
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

    const text = [shot.title, shot.description, shot.dialogue, shot.narration, shot.startFramePrompt, shot.endFramePrompt].filter(Boolean).join(" ");
    const matchedCharacters = characters.filter((asset) => text.includes(asset.name)).slice(0, 2);
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

    const matchedProp = props.find((asset) => text.includes(asset.name));
    if (matchedProp && manifest.length < 5) {
        manifest.push({
            alias: `@图片${manifest.length + 1}`,
            role: "prop_anchor",
            purpose: `道具基准图：保持 ${matchedProp.name} 的形状、持有人与当前状态一致`,
            assetId: matchedProp.code,
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

    return manifest.slice(0, 5).map((item, index) => ({ ...item, alias: `@图片${index + 1}` }));
}

function frameBeatsForShot(shot) {
    const duration = Math.max(1, Number(shot.duration) || 5);
    const actions = String(shot.videoPrompt || shot.description || shot.title)
        .split(/[。；;\n]+/u)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 9);
    const beats = actions.length ? actions : [shot.description || shot.title];
    return beats.map((actionPrompt, index) => ({
        id: `${shot.code}-F${String(index + 1).padStart(2, "0")}`,
        sequenceIndex: index + 1,
        startSecond: Number(((duration * index) / beats.length).toFixed(3)),
        endSecond: Number(((duration * (index + 1)) / beats.length).toFixed(3)),
        actionPrompt,
        imagePrompt: `${shot.imagePrompt || shot.description}。当前时段动作锚点：${actionPrompt}。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。`,
    }));
}

source.project.productionBible = {
    ...source.project.productionBible,
    targetPlatform: "Seedance 2.5",
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

const shots = source.episodes[0].shots;
source.episodes[0].shots = shots.map((shot, index) => {
    const previous = shots[index - 1];
    const referenceManifest = referencesForShot(shot, previous);
    return {
        ...shot,
        videoMode: "reference",
        storyboardFrameMode: "all_frames",
        framePlan: {
            start: { source: previous ? "previous_accepted_actual_tail" : "independent" },
            end: { required: true },
            frames: frameBeatsForShot(shot),
            referenceCount: { min: 3, max: 5 },
            referenceManifest,
        },
        continuityStatus: "planned",
        startFramePrompt: `${shot.startFramePrompt || shot.description}\n连续性硬约束：${previous ? `仅以${referenceManifest[0].alias}（上一镜已验收实际尾帧）作为首要入口依据。` : "本镜建立第一处可复用的入口状态。"}`,
        endFramePrompt: `${shot.endFramePrompt || shot.description}\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。`,
    };
});

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
