# GitHub Seedance 2.5 与热门视频提示词 Skill 调研

> 调研日期：2026-09-02。仓库热度使用 GitHub 官方 REST API 搜索快照的 `stargazers_count`、`pushed_at`、`updated_at` 与 `license.spdx_id`；Stars 会变化，数字只用于本次比较。提示词结构和能力判断只依据各仓库的 README、`SKILL.md`、references、示例或官方来源链接。

## 结论先行

Seedance 2.5 相关 Skill 已经从“关键词堆砌”转向**模式路由 + 素材职责 + 时间状态 + 连续性审计**。最稳定的共同骨架是：

1. 先选择任务模式（T2V、I2V、参考图/视频、首尾帧、延长、编辑、分镜或长视频）。
2. 逐个绑定参考素材的职责和排除项，例如人物身份、场景、动作、运镜、音色；不要只写“参考图片”。
3. 用一句话定义主体、地点、事件和基调，再写全局环境、风格、镜头和表演规则。
4. 按时间顺序写可观察动作。复杂片段为每个 beat 指定起始状态、因果链和可见末态。
5. 单独写音频、对白、字幕策略，以及少量高代价的连续性/禁止项；关键锁可在提示词末尾复述。

对 VOZEB PRO 的直接启示：把 `mode`、`referenceManifest`、`globalDirection`、`timeline[]`、`audio`、`continuity`、`constraints` 作为结构化规划字段，最后再编译成 Seedance 2.5 方言。模型名、时长、比例、分辨率和 API 参数应留在任务设置，除非目标平台的提示词契约明确要求它们。

## 热度与活跃度快照

| 仓库                                                                                                                    | Stars | 最近推送   | 最近更新   | 许可证（API） | 定位                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | ----: | ---------- | ---------- | ------------- | --------------------------------------------------------------- |
| [jnMetaCode/ai-shortfilm-prompts](https://github.com/jnMetaCode/ai-shortfilm-prompts)                                   |   389 | 2026-08-25 | 2026-09-01 | MIT           | 跨 Sora、Kling、Veo、Seedance 的 5 段式电影短片 Skill           |
| [cclank/lanshu-awesome-ai-video-kit](https://github.com/cclank/lanshu-awesome-ai-video-kit)                             |   384 | 2026-06-01 | 2026-08-31 | MIT           | 411 个 Prompt、15 个模型、方法论和 Seedance Skill               |
| [OSideMedia/higgsfield-ai-prompt-skill](https://github.com/OSideMedia/higgsfield-ai-prompt-skill)                       |   464 | 2026-08-23 | 2026-09-01 | MIT           | 专门的 Seedance 2.5 omni-reference Skill、编辑/延长与多素材流程 |
| [liyue-aigc/seedance-2-5-video-director](https://github.com/liyue-aigc/seedance-2-5-video-director)                     |   236 | 2026-08-26 | 2026-09-01 | MIT           | Seedance 2.5 专用模式路由、提示词蓝图和审计                     |
| [AtlasCloudAI/awesome-seedance-2.5-prompts-skills](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills) |   174 | 2026-09-01 | 2026-09-01 | NOASSERTION   | 150 条案例、Seedance 2.5 Skill 与通用视频 Prompt Skill          |
| [Square-Zero-Labs/video-prompting-skill](https://github.com/Square-Zero-Labs/video-prompting-skill)                     |   162 | 2026-08-25 | 2026-09-01 | Apache-2.0    | 多模型 Skill，含独立 Seedance 2.5 prompting guide               |
| [woodfantasy/Seedance-ShotDesign-Skills](https://github.com/woodfantasy/Seedance-ShotDesign-Skills)                     |   109 | 2026-08-19 | 2026-08-29 | MIT-0         | Seedance 2.5 分镜、延长、编辑、白模和工业流程                   |
| [smixs/visual-skills](https://github.com/smixs/visual-skills)                                                           |   238 | 2026-08-08 | 2026-09-01 | CC-BY-4.0     | 通用视频导演 Skill，含 Seedance 2.5 专门提示词参考              |
| [EvoLinkAI/awesome-seedance-2.5-prompts](https://github.com/EvoLinkAI/awesome-seedance-2.5-prompts)                     |   170 | 2026-06-24 | 2026-08-28 | NOASSERTION   | 163 条早期访问 Prompt 案例库                                    |
| [Anil-matcha/awesome-seedance-2.5-api-prompts](https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts)         |   313 | 2026-08-09 | 2026-08-30 | 未声明        | API 路由、参数、镜头词典和 30+ 示例                             |

> 元数据来源：各仓库的 [GitHub REST API](https://api.github.com/repos/jnMetaCode/ai-shortfilm-prompts)、[cclank API](https://api.github.com/repos/cclank/lanshu-awesome-ai-video-kit)、[OSideMedia API](https://api.github.com/repos/OSideMedia/higgsfield-ai-prompt-skill)、[liyue API](https://api.github.com/repos/liyue-aigc/seedance-2-5-video-director)、[Atlas API](https://api.github.com/repos/AtlasCloudAI/awesome-seedance-2.5-prompts-skills)、[Square-Zero API](https://api.github.com/repos/Square-Zero-Labs/video-prompting-skill)、[woodfantasy API](https://api.github.com/repos/woodfantasy/Seedance-ShotDesign-Skills)、[smixs API](https://api.github.com/repos/smixs/visual-skills)、[EvoLink API](https://api.github.com/repos/EvoLinkAI/awesome-seedance-2.5-prompts)、[Anil-matcha API](https://api.github.com/repos/Anil-matcha/awesome-seedance-2.5-api-prompts)。Atlas/Evo 的 README 有许可证徽章或说明，但 API 返回 `NOASSERTION`，接入前应按仓库 LICENSE 和内容来源再核实。

## 各 Skill 的真实提示词结构

### 1. AtlasCloudAI：作用域分块 + 路由模板

来源：[README 的 Prompt guide](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills#-seedance-25-prompt-guide)、[Seedance Skill](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills/blob/main/skills/seedance-2-5-skill/SKILL.md)、[中文组件库](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills/blob/main/skills/seedance-2-5-skill/references/prompt-blocks.zh-CN.md)、[中文模板](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills/blob/main/skills/seedance-2-5-skill/references/prompt-templates.zh-CN.md)。

- 先选路线：T2V、整张 Storyboard R2V、资产参考 R2V、I2V 首尾帧、延长/接龙、分阶段长片、编辑、无缝转场或白模参考。
- 把指令分成三个作用域：`Global`（片型、场景、风格、运镜原则）、`Locks`（身份、素材职责、音频源、连续性、负向）、`Time`（各 beat 及末态）。最昂贵的两三条锁在物理末尾再复述。
- 中文组件顺序为“参考绑定 → 可观察动作 → 空间关系 → 主导运镜/剪辑 → 光影风格 → 音频 → 末态 → 约束”。
- 多事件默认用“段落 + 末态”，而不是无依据的逐秒时间轴；末态必须能在静帧中检查（谁拿着什么、物体在哪里、门/盖是否打开）。
- 多素材必须写“控什么”和“不要继承什么”；整张分镜图作为 R2V 时按 `镜头1/2/3` 表达顺序，只有格子不可读或需要独立重拍才切格。

可复用的 Seedance 专用骨架（以下为归纳，不是原文复制）：

```text
素材绑定：@图片1控制角色外观；@视频1只控制动作/运镜；@音频1只控制音色或节奏；列出排除项。
一句话意图：主体在地点完成事件，基调与镜头意图是什么。
全局设定：环境、材质、风格、灯光、主体不变量。
时间/分镜：按顺序描述动作、镜头、声音；每段写可见末态。
音频：对白、音效、环境声、音乐和字幕策略。
连续性与约束：身份、数量、道具归属、空间方向、禁止文字/水印/重复主体。
```

### 2. OSideMedia：四模式路由 + 参考保真等级

来源：[Seedance 2.5 SKILL.md](https://github.com/OSideMedia/higgsfield-ai-prompt-skill/blob/main/skills/higgsfield-seedance-2-5/SKILL.md)。

- 先选 `t2v`、`omni_reference`、`video_edit` 或 `video_extension`；它们分别对应场景 brief、参考角色地图加场景 brief、唯一编辑母片加修改范围/保持项，以及边界连续性契约加新增内容。
- 基础 prompt 是 `主体 + 可观察动作 + 场景 → 风格 → 景别/机位/运镜/剪辑 → 音频`；复杂多参考先写角色表，再进入场景阶段。
- 每项参考素材都写“负责什么”和“不继承什么”，另标注 `full-preserve`、`partial-preserve`、`attribute-transfer` 或 `loose-guide`，将职责与保真强度分开。
- 30 秒叙事按阶段组织：起始状态 → 一个主变化 → 可见末态；下一阶段从前一阶段末态继续。编辑与延长分别强调唯一 source master 和源片边界帧。

### 3. liyue-aigc：模式蓝图 + 资产锁表 + 最终审计

来源：[SKILL.md](https://github.com/liyue-aigc/seedance-2-5-video-director/blob/main/SKILL.md)、[prompt-blueprints.md](https://github.com/liyue-aigc/seedance-2-5-video-director/blob/main/references/prompt-blueprints.md)、[multimodal-patterns.md](https://github.com/liyue-aigc/seedance-2-5-video-director/blob/main/references/multimodal-patterns.md)。

- 强制选择一个 primary mode：`basic-multimodal`、`timestamp-30s`、`long-video`、`video-extension`、`video-edit`、`clay-renderer`、`seamless-transition` 或 `multi-grid-storyboard`。
- 先建立资产锁表：`label | role | active time | preserve | do not inherit`；同一素材不能同时承担冲突角色。
- shared assembly order 是：输出意图/平台设置（外部）→ 素材声明 → 一句话电影意图 → 全局环境/风格/镜头/主体/表演 → 时间线或编辑操作 → 专项物理/表演规则 → 音频 → 连续性与禁止变化。
- 精确 30 秒每段需包含“时间范围 + 戏剧功能 + 可见动作/表情 + 景别/镜头 + 声音/对白 + 末态”；时间段必须连续、不重叠并覆盖全时长。
- 延长必须先规范成 `prepend-before-source` 或 `append-after-source`，只描述新增区间并明确源片首/尾边界状态；编辑使用“定位 + 目标 + A→B 变化 + 生效时段 + 保持项”。
- 输出前审计模式、素材、时间、物理因果、台词容量、声音策略和连续性，Skill 本身不提交付费生成任务。

### 4. woodfantasy：按模式的 Prompt Contract + 物理因果

来源：[SKILL.md](https://github.com/woodfantasy/Seedance-ShotDesign-Skills/blob/main/SKILL.md)、[prompt-contracts.md](https://github.com/woodfantasy/Seedance-ShotDesign-Skills/blob/main/references/prompt-contracts.md)、[seedance-specs.md](https://github.com/woodfantasy/Seedance-ShotDesign-Skills/blob/main/references/seedance-specs.md)。

- 标准 4–30 秒合同：素材说明 → 一句话概述 → 时间轴 → 全局补充；复杂 30 秒增加多模态参考层、全局设定和时间戳剧本。
- 复杂提示词的全局设定字段为：环境/质感、视觉风格、镜头语言、角色/主体、表演核心、全局限制。
- 复杂镜头可使用固定字段：`FORMAT`、`STARTING STATE`、`TIMELINE`、`CAMERA`、`CONTINUITY`、`AUDIO`、`ENDING STATE`、`CONSTRAINTS`；每个 beat 从前一 beat 的物理结果开始。
- 动作采用“接近/准备 → 接触或受力 → 结果运动 → 恢复/停稳”，液体、布料、烟尘和碰撞也必须写受力方向和落点。
- 参考视频只继承指定的动作、运镜或节奏；白模需把每个可辨识模型映射到最终角色/物体，并排除灰模材质、轨迹线和相机锥体。
- `seedance-specs.md` 将硬限制、稳定性建议和未验证事项分开，避免把旧的 15 秒/9 图/3 视频等限制当作 2.5 事实。

### 5. Square-Zero-Labs：跨模型入口，Seedance 2.5 专门章节

来源：[入口 Skill](https://github.com/Square-Zero-Labs/video-prompting-skill/blob/main/video-prompting/SKILL.md)、[Seedance 2.5 guide](https://github.com/Square-Zero-Labs/video-prompting-skill/blob/main/video-prompting/references/models/seedance2-5/prompting.md)。

- 简单镜头：主体与场景 → 一个动作弧 → 景别和一个运镜 → 一致的光影/风格 → 声音 → 最终画面。
- 复杂镜头：`FORMAT` → `REFERENCE ROLES` → `STARTING STATE` → `TIMELINE` → `CAMERA` → `CONTINUITY` → `AUDIO` → `ENDING STATE` → `CONSTRAINTS`。
- 明确要求 I2V“动画化而不是重写”：图片是身份、服装、场景和构图权威；文字只描述运动、摄影机、表演、物理和有意变化。
- 参考音频若包含对白，提示词不能转录或改写台词，只能指定角色按 `@Audio` 原样口型同步，并禁止额外生成对白。
- 通用规则把模型名、版本、时长、比例、分辨率和 API 参数放在提示词外；只有模型的时间轴契约需要时才在提示词里出现时间。

### 6. jnMetaCode：5 段式电影短片骨架

来源：[README.zh.md](https://github.com/jnMetaCode/ai-shortfilm-prompts/blob/main/README.zh.md)、[cheatsheet.zh.md](https://github.com/jnMetaCode/ai-shortfilm-prompts/blob/main/cheatsheet.zh.md)、[demo-prompt.md](https://github.com/jnMetaCode/ai-shortfilm-prompts/blob/main/assets/demo-prompt.md)。

该库的方法论顺序固定为：

1. **核心主题**：3–6 个风格/题材/美学标签。
2. **人物与场景**：脸、服装、材质、缺陷、环境动态。
3. **氛围与画质**：真实摄影机和镜头型号、色调、质感、声音。
4. **镜头规则**：单镜或多镜、景别/角度/运动、轻微“呼吸感”手持规则。
5. **分镜**：逐秒切片或逐镜切片；每段写动作、镜头和特效，可附声音/表情。

demo 是一条 15 秒单镜头 Seedance 2.0 提示词，使用“人物与基础设定、氛围与画质、运镜规则、0–3/3–6/…时间段、克制结尾”的完整结构。其可复用原则是：具体摄影机和镜头、物理反馈、角色/装备瑕疵、无配乐同期声、留白结尾；这些是审美模板，不应覆盖 VOZEB 的模型限制和生产字段。

### 7. smixs：简式核心公式 + 三模块复杂镜头

来源：[video SKILL.md](https://github.com/smixs/visual-skills/blob/main/video/SKILL.md)、[Seedance 2.5 guide](https://github.com/smixs/visual-skills/blob/main/video/references/seedance-25.md)。

- 简单镜头先用四句：`主体在场景中执行动作 → 视觉风格 → 景别/机位/运镜/剪辑 → 音频`。
- 长片或多参考扩展为 `Reference layer → Global settings → Timestamped storyboard`：第一层写每份素材职责与排除项，第二层写环境/纹理、摄影、表演和禁用项，第三层给每段的景别、构图、微动作与情绪次文本。
- 所有抽象情绪都需转译为可观察行为；每一镜需要环境压力、物理微动作及声音或视觉母题三种可检查细节。

### 8. cclank：任务决策树 + 8/9 要素工程公式

来源：[基础任务类型](https://github.com/cclank/lanshu-awesome-ai-video-kit/blob/main/methodology/01-%E5%9F%BA%E7%A1%80%E5%85%AC%E5%BC%8F.md)、[8 要素公式](https://github.com/cclank/lanshu-awesome-ai-video-kit/blob/main/methodology/02-%E8%BF%9B%E9%98%B6%E5%85%AC%E5%BC%8F.md)、[分镜时序](https://github.com/cclank/lanshu-awesome-ai-video-kit/blob/main/methodology/03-%E5%88%86%E9%95%9C%E6%97%B6%E5%BA%8F.md)、[Seedance masterclass](https://github.com/cclank/lanshu-awesome-ai-video-kit/blob/main/methodology/15-seedance-masterclass.md)、[Seedance Skill](https://github.com/cclank/lanshu-awesome-ai-video-kit/blob/main/skills/seedance-prompter/SKILL.md)。

- 先区分多模态参考、编辑、延长和组合任务；编辑/延长直接指代源视频，不要用“参考视频”造成模式误判。
- 8 要素公式：精准主体 → 动作细节 → 场景环境 → 光影色调 → 镜头运镜 → 视觉风格 → 画质 → 约束条件；其 Seedance masterclass 另给 9 要素版本，增加 Audio 和 Quality Suffix。
- 复杂剧情按 `镜头1/2/3` 事件顺序组织；每镜包含运镜/切换、主体动作与表情、位置/空间变化、音频四维度。
- 该库强调动作的部位、速度、力度和过渡，以及用身体细节外化情绪；建议每镜只使用一种主运镜。
- 需要精确节奏时才加时间戳，否则让模型按镜头顺序自然分配时长；建议控制参考素材数量，避免所有素材同时出现。

### 9. Anil-matcha 与 EvoLink：案例库与 API 导向

来源：[Anil Prompt Engineering Guide](https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts/blob/main/README.md#prompt-engineering-guide)、[Anil Shot Script](https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts/blob/main/README.md#shot-script-format-advanced)、[EvoLink README](https://github.com/EvoLinkAI/awesome-seedance-2.5-prompts/blob/main/README.md)。

- Anil 给出较短的 6 步公式：`Subject + Action + Environment + Camera + Style + Constraints`，建议开头 20–30 个词锁定主体和动作，目标 60–100 词；多镜头再用 `[0:00–0:03] WIDE SHOT — ...` 这种时间码格式。
- Anil 的 `@Image1/@Video1/@Audio1` 只是文本映射约定，实际 API 使用 `images_list/videos_list/audios_list`；接口字段和供应商默认值不能直接当作通用提示词规则。
- EvoLink 主要是按题材组织的 163 条案例库，常见写法是先给一句完整场景/风格，再用 `0:00-0:05`、`0:05-0:10` 分段，最后补 `Style`、音频和连续性；适合做示例检索，不如上述 Skill 适合作为规则源。

## 统一可复用结构（建议映射到 VOZEB）

### 结构化中间表示

```text
mode: t2v | i2v | reference | first_last | extension | edit | storyboard | long_video
settings: duration/ratio/resolution（任务设置，不默认写入 prompt）
references[]: { label, role, activeTime, preserve[], exclude[] }
intent: subject + place + event + tone + camera idea
global: environment, subject/wardrobe, visualStyle, lighting, cameraPrinciple, performance
timeline[]: { time?, dramaticFunction, startState, actionCause, camera, sound, endState }
audio: dialogue, speaker/language, ambience, sfx, music, subtitlePolicy
continuity: identity/count, wardrobe, propOwnership, geography, axis, light/palette, voice
constraints[]: only task-specific high-cost prohibitions
```

### 编译后的 Seedance 2.5 Prompt 模板

```text
素材说明：逐个声明 @图片/@视频/@音频 的控制范围和不继承内容。
一句话概述：主体在场景中完成事件，给出基调与核心镜头意图。
全局设定：环境/材质、角色与道具、视觉风格/光影、镜头原则、表演核心。
时间线：按顺序写每个阶段的可观察动作；动作遵循准备→接触/受力→反应→停稳，必要时写时间范围和末态。
声音：对白（说话人、语言、原文或音频来源）、环境声、动作音、音乐、字幕策略。
连续性：身份、数量、服装、道具归属、空间方向、镜头轴、光色和音色。
约束：只列本镜头最可能且重做代价高的错误；把关键锁在末尾复述一次。
```

## 对当前项目的落地建议

1. **吸收规则，不复制仓库**：优先采用 Atlas/OSideMedia 的作用域分块、liyue 的资产锁表、woodfantasy/Square-Zero 的 `STARTING STATE/ENDING STATE`、cclank 的动作因果、smixs 的三模块检查和 jnMetaCode 的镜头审美词库；外部 Skill 不应成为第二套制作包事实源。
2. **服务端先路由再编译**：在规划器输出中强制一个 primary mode，按模式选择模板。参数层读取真实 provider 能力，提示词层不猜测 `/v1/models`、分辨率或参考文件上限。
3. **素材引用使用稳定 ID**：将每个参考媒体映射为 `assetId + role + scope + exclude`，不要按标题或 Prompt 文本去重；生成日志区分用户原文与执行 Prompt。
4. **把末态与连续性编译进视频 Prompt**：每个多事件镜头必须有可见末态；连续接龙必须引用真实上一段尾帧，切镜/匹配剪辑则独立设计。
5. **公开摘要只保留外部字段**：模型、尺寸/比例、画质/清晰度、时长、音色/格式、数量和状态；平台规则、模型选择理由、内部执行 Prompt 和 Skill 指令只用于服务端执行与审计。
6. **许可证逐项复核**：MIT/Apache/MIT-0 仍需核对模型权重、示例素材和第三方 API；`NOASSERTION` 或未声明许可证的案例库不直接作为运行时依赖。

## 研究边界

- GitHub 仓库的案例视频只能证明一次生成结果，不能证明跨 provider、版本、参数和 seed 的稳定性。
- Seedance 2.5 的平台能力、API 路由和文件上限可能随 provider 变化；本笔记只记录仓库在调研日期公开的结构，生产接入仍必须以已验证的供应商契约和 VOZEB 的任务回归为准。
- 旧版 Seedance 2.0 Skill（如 `dexhunter/seedance2-skill`）已在 [既有调研](github-creative-skills-research.md) 覆盖，本次只补充 2.5 新仓库及跨模型方法，不重复把 2.0 规则当作 2.5 限制。
