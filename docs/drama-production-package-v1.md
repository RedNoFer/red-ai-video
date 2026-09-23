# VOZEB 短剧完整制作包 v1

固定格式标识：`vozeb-drama-production-package-v1`。

下载模板源文件为 `docs/drama-production-package-v1-template.md`，由 `pnpm compile:skills` 根据当前 Skill 和本规范自动生成到 `web/public/drama-production-package-v1-template.md`；不要直接编辑生成文件。

以后由 Codex、项目 Agent 或人工编写的完整制作包，都必须保持以下一级章节、表头和编号规则。13 章是 v1 的固定制作包结构，不因项目、集数或对话内容改变。多集项目在一个总包中仍只保留一套固定一级章节，但每一集必须在规范对象中拥有完整且自洽的剧本、场次、镜头、资产引用、表演、声音、连续性、逐帧计划和 QC 数据；按单集生成或导入时，该单集制作包也必须完整保留全部 13 章，不得只输出镜头表或局部字段。允许扩写正文，不允许改名、换序或省略必填章节。没有内容时保留章节并明确写“无”。

制作包支持两种彼此隔离的 authoring 方式：项目内生成由 `executeDramaScriptRun` 负责编排；独立 Codex authoring 只依据本模板、当前 TXT/小说、当前用户请求、当前导演 Skill 和可用资产，直接生成完整 13 章 Markdown 制作包。独立 Codex 的 Markdown 与其中唯一的规范对象 JSON 在同一轮直接生成，服务端不参与创作、不投影章节、不重写 `videoPrompt`。两种方式共享本文件、模板内嵌门禁登记表和当前导演 Skill，但独立 Codex 必须在输出前完成模板内自检与局部修订。固定脚本、历史制作包、旧 generationPrompt 或直接读取模板复制正文不得作为制作包生成器。项目导入阶段只执行 JSON、章节、字段、时间轴、资产和权限等结构安全校验，不能把导入校验当作独立 authoring 的质量门禁。最终包必须保留来源清单、契约版本、实际使用的导演 Skill/小墨公开视频格式 Skill/Seedance Skill 版本与内容哈希（能够获得时记录），以及模板/TXT/参考素材的 alias、role、顺序和内容哈希。Skill 字段是 authoring provenance，不是项目导入授权；独立包导入不要求服务器安装、执行或匹配这些 Skill。

## 版本化契约块

```yaml
contract:
  id: vozeb-drama-production-package-v1
  version: 1.0.0
  targetNarrativeChapter: 当前 TXT/小说的目标章节标识；它不是制作包一级章节编号
  authoringProviders:
    - codex-standalone
    - project-gpt
  finalizer: codex-standalone-or-project-gpt
  externalWorkOrder:
    trigger: user-confirmed-project-gpt-timeout
    output: complete-13-chapter-markdown-with-embedded-json
    reentry: optional-import-only
  draft:
    mode: package-markdown
    fields: [reply, markdown]
  productionLock:
    fields: [shotDuration, logicalShotCount, targetDuration, dialogueCapacityPlan, narrativeBeatPlan, internalCutPolicy, framePolicy, selfCheckRuleVersion, storySourceHash, templateHash, contractHash, specHash, directorSkillHash, seedanceSkillHash]
  finalAuthoringMetadata:
    fields: [authoringMode, canonicalSource, qualityGateStatus, repairCount, fullPackageRepairCount, selfCheckRuleVersion]
  shotRepair:
    mode: shot-repair
    fields: [reply, basePackageHash, repairScope, failures, patches]
    scope: failed-shot-only
    visibility: codex-internal-workflow-only; not-an-independent-submission-format
  sourceRoles:
    - package-template
    - story-source
    - reference
  hardGateCodes:
    - LITERARY_SCRIPT_COMPLETENESS
    - DIALOGUE_COVERAGE
    - DIALOGUE_CAPACITY
    - FRAME_DIALOGUE_TIMING
    - DIALOGUE_SPEAKER_VISUAL_MATCH
    - DIALOGUE_PERFORMANCE
    - VIDEO_PROMPT_LAYOUT
    - VIDEO_PROMPT_LENGTH
    - VIDEO_PROMPT_SEMANTIC_QUALITY
    - PLOT_FACT_COVERAGE
    - ACTION_DENSITY
    - ACTION_RESULT
    - ACTION_DIFFERENCE
    - EMOTION_PROGRESSION
    - NPC_REACTION_CHANGE
    - CAMERA_MOTIVATION
    - CAMERA_EVENT
    - VISUAL_CLARITY
    - TIMELINE
    - SHOT_DURATION_POLICY
    - ASSET_BINDING
    - CONTINUITY
    - TEXT_STATE_CONTINUITY
    - CROSS_SHOT_STATE_INHERITANCE
    - COMPOSITION_CONTRACT
    - SUBJECT_COVERAGE
    - CUT_INFORMATION_DIVERSITY
    - REFERENCE_ALIAS_CONSISTENCY
    - CHARACTER_WARDROBE_CONTINUITY
    - JSON_MARKDOWN_CONSISTENCY
    - PROVENANCE
    - PACKAGE_SCHEMA
    - PRODUCTION_PLAN_COMPLETENESS
    - LOGICAL_SHOT_COUNT
    - LOGICAL_SHOT_ECONOMY
```

## 独立 Codex authoring 协议

- 输入只允许：本轮用户请求、本模板全文、当前 TXT/小说/剧本、当前 Skill、当前正式资产、当前参考素材和明确生产参数；禁止读取历史制作包、旧 generationPrompt、旧运行记录或项目内部 Agent 记录。
- 正式输出必须是完整 13 章 Markdown，并且只包含一个 `drama-production-package` JSON 代码块。JSON 与 13 章正文由 Codex 同一轮生成；第十一章直接填写 Codex 写出的 `videoPrompt`，第十三章填写自检结果。
- 输出前必须完成“读取事实 → 确定逻辑片段 → 编排镜头与帧 → 生成视频提示词 → 逐镜门禁自检 → 只修失败镜头 → 再自检”的闭环。未通过 blocker 时不得输出可生产制作包。
- 普通质量失败只允许修复失败镜头的 `videoPrompt`、`framePlan`、表演、对白时间和连续性；未失败镜头、剧情、资产、逻辑片段数量、时长和总时长冻结。
- 只有协议损坏或多镜头事实冲突才允许一次完整 package 修订；第二次仍失败时停止，不自动重建或换渠道。
- 项目导入只接收已完成 Markdown，服务端可检查 JSON、章节、字段、时间轴、资产和权限，但不得调用 `executeDramaScriptRun`、完整语义门禁或 Markdown 投影器。

### Canonical 字段与逻辑片段经济性

正式 JSON 只允许使用当前导入字段：`episodes[].code`、`episodes[].shots[].code`、`episodes[].shots[].duration` 和 `episodes[].shots[].timecode`。`episodes[].episodeId`、`episodes[].shots[].shotId`、`episodes[].shots[].shotDuration` 以及 `projectionVersion`、`qualityGateRulesHash`、`repairPolicyHash`、`runId`、`workOrderId` 等服务端运行字段属于 blocker；`project.productionLock.shotDuration` 是逻辑片段时长锁定字段，仍然必填。导入器不得把别名转换为正式字段，也不得过滤后继续导入。

在生成 `framePlan` 前，Codex 必须冻结 `productionLock.logicalShotCount`、`shotDuration`、`targetDuration`、`dialogueCapacityPlan`、`narrativeBeatPlan`、`internalCutPolicy`、`framePolicy` 和 `selfCheckRuleVersion`。实际关系必须满足：`episodes[].shots` 总数等于 `logicalShotCount`，每个 `duration` 等于 `shotDuration`，同一集 `timecode` 连续，`targetDuration=logicalShotCount×shotDuration`。`framePlan.frames`、内部硬切、自然分句、换焦段和换机位只能改变当前逻辑片段内部剪辑密度，不能增加逻辑片段。

每个逻辑片段必须有独立剧情职责、关系变化、动作结果或空间信息。只有“同一对白前半/后半”、只改变摄影参数或为了凑 `dense-30s` 切数的相邻片段必须合并；这类包命中 `LOGICAL_SHOT_ECONOMY`，必须回到对白容量预检重算，而不是把错误的总时长交给导入器。

## 外部独立生成门禁

本节会随模板一并编译发布，是外部 Codex 直接生成制作包时的自包含执行规范。外部 Codex 不需要调用 `executeDramaScriptRun`、读取项目内部硬编码或等待服务端补写字段；必须在返回前完成一次完整自检，直接返回已经通过自检的完整 13 章 Markdown。项目导入时只做结构安全校验，不重复执行本节的导演语义门禁，也不得补齐、重写或拼接公开视频提示词。

### 输入边界与来源优先级

1. 只读取本轮用户请求、当前制作包模板、当前 TXT/小说/剧本、当前用户显式提供的参考素材和当前项目正式资产；禁止读取历史制作包、历史脚本、旧 generationPrompt、旧运行记录或对话中的旧成品。
2. 优先级为：本轮用户明确参数与剧情事实 > 本轮自定义模板中的明确规则 > 当前正式资产与已验收连续性 > 本模板与当前 Skill 的通用规则 > 最小合理导演补全。通用规则不能覆盖用户明确的时长、比例、台词、人物、场景或禁用项。
3. 角色、场景、道具图片不是生成制作包的必需前置条件。没有图片时不得阻断整包，也不得伪造 `@图片` alias；有图片时必须逐项登记其 alias、职责、顺序、清晰度和可读性。
4. 模板只规定制作包结构和质量合同；TXT/小说只提供剧情事实；素材只提供身份、空间、道具或连续性锚点。不得把模板示例中的角色、地点、对白或道具带入新剧情。

### Authoring 预检顺序与连续性默认策略

外部 Codex 必须严格按照以下顺序 authoring，不能先固定帧数或镜头数量再压缩对白：

```text
读取完整 TXT/剧本
→ 提取显式对白和剧情事实
→ 逐句计算对白容量
→ 确定逻辑片段数量与每段职责
→ 分配对白、动作、反应和静默时间
→ 根据真实事件确定内部帧段与硬切
→ 生成公开视频卡和 framePlan
→ 逐镜自检
→ 只修失败镜头及相邻连续性
→ 再自检并输出
```

后续镜头默认采用文字状态连续性，不要求实际尾帧：

- 没有用户明确要求时，`framePlan.start.source` 使用 `independent`，连续性通过上一镜 `exitState`、当前镜 `entryState`、首帧 `framePlan` 和首张公开视频卡锁定。
- `entryState` 与 `exitState` 必须逐项记录角色相对场景的位置、姿态/重心、支撑/接触、视线、表情、手部、道具持有关系、服装/发型/固定配饰、场景锚点、光源方向、180 度轴线和屏幕方向。
- 下一镜必须逐项继承上一镜出口状态；只有写出“触发事件 → 移动路径/受力 → 到达位置 → 下一镜首帧接住”时，才允许改变位置、姿态、持有关系或轴线。
- 除第一帧外，每帧 `startPrompt` 必须原样承接上一帧 `endPrompt`；“从上一状态继承”“保持当前状态”“自然调整”“新片段开始”不能代替具体状态。
- 只有用户明确要求实际尾帧，或当前连续性边显式设置 `inheritActualEndFrame=true` 时，才允许使用 `previous_accepted_actual_tail`；此时才要求上一镜当前视频版本的已人工验收尾帧。

对白容量必须在拆镜前完成。每句对白都要记录可发音字数、`speechRateCharsPerSecond`、`requiredSpeechSeconds`、`availableSpeechSeconds`、逻辑片段、帧段、句前停顿和句后停顿。`availableSpeechSeconds < requiredSpeechSeconds`、对白收句落在帧段内部、说话人与画面主体不一致、对白重复起句或对白结束后没有新的可见职责，均为 blocker。

### 必须交付的独立结果

- Markdown 必须完整保留固定 13 个一级章节，并包含唯一 `drama-production-package` JSON 代码块；JSON 与正文由 Codex 同一轮生成，不能只返回镜头表、视频提示词或摘要。
- Codex 可在 JSON 中记录当前 15/30 秒逻辑片段方案、内部剪辑策略、帧策略、TXT/模板/契约/两个 Skill 的版本或哈希，以及 `selfCheckRuleVersion`；不得从历史包或旧锁定方案补写。
- 每个逻辑片段先按完整剧情、对白自然时长、动作节拍和反应留白确定数量，再使用当前配置的 15 秒或 30 秒时长；整集时长由逻辑片段数量推导。
- 每个镜头直接生成 `dramaticFunction`、`performancePlan`、`dialoguePerformance`、`lightingPlan`、`continuity`、`entryState`、`exitState`、`videoPrompt`、`framePlan` 和当前资产编码；不得等待应用层补齐。
- `videoPrompt` 必须由 Agent 直接生成小墨个人分镜 Skill 6.3（`storyboard-director@6.3.0`）适配版镜头卡；每个真实 `framePlan.frames[]` 对应一张卡。服务端或外部脚本不得从 `framePlan`、旧提示词或模板示例重建公开正文。
- 第十三章必须附带逐门禁 QC 自检表，逐项记录状态、证据镜头/帧号、修订范围和最终备注；登记为 blocker 的门禁只能是 `passed`，不能以 `warning`、“待检查”或“待服务端检查”交付。只有全部 blocker 通过，才可写 `qualityGateStatus=passed`。

QC JSON 必须区分“结果”和“级别”：`authoring.qualityGateReport.status` 是整包结果；每个 `checks[]` 的 `status` 是该项结果，`severity` 是该项级别。`severity=blocker` 且 `status=passed` 表示阻断级门禁已通过，不得把 `passed` 写入 `severity`，也不得因为存在已通过的 blocker 就把整包判为 blocked。

### 门禁登记表

| code | 级别 | 必须满足的条件 |
| --- | --- | --- |
| `LITERARY_SCRIPT_COMPLETENESS` | blocker | 文学正文完整，含场次、行为、冲突推进、对白/事实和可见结果；固定 13 章齐全；目标小说章节单独标识。 |
| `DIALOGUE_COVERAGE` | blocker | TXT/剧本中的每条显式对白都出现在文学正文和镜头序列中，并绑定说话人、镜头、时间和表演；不得静默遗漏或擅自改写。 |
| `FRAME_DIALOGUE_TIMING` | blocker | 帧段边界对齐自然开口、收句、停顿、动作触发或反应留白；禁止把含对白镜头机械等分。 |
| `DIALOGUE_CAPACITY` | blocker | 逐句口型窗口是硬门禁：`availableSpeechSeconds=endSecond-startSecond` 必须不小于 `requiredSpeechSeconds=可发音字数/speechRateCharsPerSecond`；`pauseBeforeSeconds`/`pauseAfterSeconds` 另行占用句前/句后空间并必须留在镜头边界内。任何单句不足都阻断。10 个可发音字容差只用于整镜总量的兼容提醒，不适用于逐句口型窗口；不得异常加速。 |
| `DIALOGUE_SPEAKER_VISUAL_MATCH` | blocker | `台词`、`utterances`、口型主体和画面动作必须属于同一说话人；不允许画面写萧炎开口而台词归纳兰，或把未开口角色写成当前说话人。 |
| `DIALOGUE_PERFORMANCE` | blocker | 每个对白帧段写说话人、实际台词、语气、停顿、重音和具体说后反应；`画面内容`不得复制完整对白；相邻段不得重复对白游标或表演块。 |
| `VIDEO_PROMPT_LAYOUT` | blocker | 每个真实帧段对应一张镜头卡；标题含时间、景别、焦段、机位、一个主运镜和主体类型；正文含场景、画面内容、光影、色调、台词、人声、音效。禁止 `undefined`、`null`、`NaN`、`[object Object]` 等程序占位值，以及 `palette=.../saturation=.../film_stock=.../grain=.../halation=...` 这类未声明的伪参数串；视觉要求必须用自然语言表达。 |
| `VIDEO_PROMPT_LENGTH` | blocker | 每个逻辑片段的完整 `videoPrompt`（包含该片段全部公开帧卡、台词、声音和剪辑承接）最多 4500 个 Unicode 字符；超限必须在当前 Codex 对话内压缩重复全局设定，不得删除主体、触发、动作、结果、声音锚点、连续性或硬切承接。 |
| `VIDEO_PROMPT_SEMANTIC_QUALITY` | blocker | 直接检查公开视频卡片：画面内容必须有明确主体、进行中的可见动作、触发/因果、可见结果和声音锚点；不得出现“准备回应”“保持状态”“社会后果停在三人之间”等抽象占位或未来意图；相邻卡片必须带来可拍摄的信息增量。 |
| `PLOT_FACT_COVERAGE` | blocker | 当前剧情事实、人物关系、动作结果和结尾状态都在制作包中有可追溯表达；不得以泛化氛围替代事实。 |
| `ACTION_DENSITY` | blocker | 每帧完成“谁做什么 → 触发原因 → 身体/手部/道具受力 → 可见结果 → 声音锚点”；对白结束后的时间必须有剧情职责或有目的的结果停留。 |
| `ACTION_RESULT` | blocker | 每个动作必须写出具体可见结果；不得只写“准备回应”“情绪加剧”“保持疑问”“关系冻结”或其它不可拍摄的意图。 |
| `ACTION_DIFFERENCE` | blocker | 相邻帧至少有一项可验收的主体、姿态、视线、表情、重心、手部、道具、环境或摄影信息变化；不得只换形容词。 |
| `EMOTION_PROGRESSION` | blocker | 起点、中段、终点的可见表演、压力或关系状态有递进；不得整镜保持同一情绪状态。 |
| `NPC_REACTION_CHANGE` | blocker | 剧情要求的 NPC/其他角色有独立、具体且随主事件变化的反应；没有事实依据时不得凭空添加 NPC。 |
| `NPC_ROSTER_CONTINUITY` | warning | required 群像的数量、槽位、世界锚点、分布和状态在受影响帧段保持一致；风险必须显式记录。 |
| `CAMERA_MOTIVATION` | blocker | 景别、焦段、机位、轴线和主运镜服务于明确的视线、关系、空间、压力或信息揭示；连续镜头只有一条主运镜。 |
| `CAMERA_EVENT` | blocker | 内部切镜声明模式、时间、类型、触发事件、新机位、切后主运镜、信息目的和承接；切点落在真实帧边界；不得隐式 Cut。启用 `dense-30s` 时默认 8—11 帧/7—10 次硬切，少切必须写减切原因；每次硬切还必须在对应公开卡片的 `剪辑承接` 中写出时间、触发、新机位、切后主运镜、新增信息和连续性承接。 |
| `VISUAL_CLARITY` | blocker | 主角、关键 NPC、手部、道具接触面和场景锚点在当前景别可辨；有参考图时角色图须有身份特写和清晰四视图/转面，场景图须为高清 16:9 单视角全景并能读出拓扑。无图片不等于失败，但不得伪造图片绑定。 |
| `TIMELINE` | blocker | 每个镜头的帧段从 0 秒开始连续覆盖到镜头结束，无空白、重叠或超界。 |
| `SHOT_DURATION_POLICY` | blocker | 若生产方案指定 15 秒或 30 秒，每个逻辑片段严格使用该时长；内部帧段和硬切不改变逻辑片段数量和整集时长。 |
| `ASSET_BINDING` | blocker | 镜头只使用当前正式资产的稳定 code；场景、角色、道具、线索声明与正文和参考绑定一致；没有绑定的对象不得写入公开提示词。 |
| `CONTINUITY` | blocker | 下一镜继承上一镜出口的空间位置、支撑/接触、姿态、视线、持有关系、环境和 180 度轴线；改变位置必须写触发、路径/受力和到达结果。 |
| `TEXT_STATE_CONTINUITY` | blocker | 默认 `framePlan.start.source=independent`，通过文字状态连续；`entryState`、首帧 `framePlan` 和首张公开视频卡必须具体重复上一镜出口的角色位置、姿态/重心、支撑/接触、视线、道具、服装/发型/固定配饰、环境、光源和轴线；不得用抽象继承语句代替。 |
| `CROSS_SHOT_STATE_INHERITANCE` | blocker | 相邻镜头的入口状态必须逐项等于上一镜出口状态；发生变化时必须提供触发、路径/受力、到达结果和下一镜首帧承接证据。未显式要求实际尾帧时不得以尾帧缺失阻断；显式启用实际尾帧时才检查 `previous_accepted_actual_tail`。 |
| `COMPOSITION_CONTRACT` | blocker | 画幅先参与构图；9:16 优先单人/双人/过肩/纵深并保留头顶、下巴、衣领和关键手部，16:9 保留横向主体层级；不得遮脸或把人物缩成不可辨识的小人。 |
| `SUBJECT_COVERAGE` | blocker | 每个时间段明确主要主体和可见范围；剧情中需要独立呈现的角色、NPC 反应、手部或道具受力必须有独立信息。 |
| `CUT_INFORMATION_DIVERSITY` | blocker | 每次硬切带来新的角色关系、表演、空间、手部、道具或结果信息；7—10 次硬切不能只是同一角色的多个角度。 |
| `REFERENCE_ALIAS_CONSISTENCY` | blocker | 严格沿用 `referenceManifest` 的 alias、role、purpose 和顺序；禁止“@图片1至@图片N”、URL、assetId 或擅自重新编号。 |
| `CHARACTER_WARDROBE_CONTINUITY` | blocker | 出镜角色持续锁定身份、年龄感、脸型/发型、服装结构、颜色和固定配饰；角色图与场景图职责不能互换。 |
| `JSON_MARKDOWN_CONSISTENCY` | blocker | 第十一章公开 `videoPrompt`、规范对象中的同一字段和第十三章 QC 结论必须来自同一轮 authoring，原文一致，不得一处为空或另行改写。 |
| `PROVENANCE` | blocker | 记录模板、TXT/剧情源、参考素材、契约、实际使用的导演 Skill、小墨公开视频格式 Skill、Seedance Skill 的版本/内容哈希和生成时间；这些是来源审计信息，不是独立包导入的 Skill 白名单。 |
| `PACKAGE_SCHEMA` | blocker | JSON 只能使用当前契约字段；`episodes[].code`、`shots[].code`、`duration`、`timecode`、完整 `productionPlan` 和数组型 `authoring.materials` 必须存在；出现 `episodeId`、`shotId`、`shotDuration` 或服务端运行字段立即阻断，不得静默别名转换。 |
| `PRODUCTION_PLAN_COMPLETENESS` | blocker | `project.productionBible.productionPlan` 必须是完整对象，包含视频时长、内部切镜策略、帧策略、技能、视觉、参考、连续性和来源；不能让运行时默认值掩盖缺失生产方案。 |
| `LOGICAL_SHOT_COUNT` | blocker | 先冻结 `logicalShotCount`、`shotDuration`、`targetDuration`、对白容量计划和剧情节拍计划；实际逻辑片段数与锁定值一致，`targetDuration=logicalShotCount×shotDuration`，内部帧段/硬切不得改变三者。 |
| `LOGICAL_SHOT_ECONOMY` | blocker | 每个逻辑片段必须有独立剧情职责、关系变化、动作结果或场景信息；只把同一对白切成前半/后半、只换景别或为了凑 7—10 次硬切而新增的片段必须合并并阻断。 |

### 视频提示词与静态帧的硬分工

- `画面内容`只写可见口型、呼吸、视线、表情、身体受力、手部/道具状态、空间层次和结果；完整原句只能在`台词`字段，格式为“说话人说：‘实际台词’”。
- 单个逻辑片段的完整 `videoPrompt` 以 Unicode 字符数计不得超过 4500；场景、全局视觉方案和不变量只在 `productionBible` 锁定，公开卡片只保留当前帧新增的主体、触发、动作、结果、声音和连续性事实。不得通过删掉对白边界、动作结果或硬切承接来压缩。
- 公开卡片必须使用自然语言，不写未声明的供应商 DSL 或胶片参数串，例如 `palette=...`、`saturation=...`、`film_stock=...`、`grain=...`、`halation=...`；也不得出现 `undefined`、`null`、`NaN`、`[object Object]`。色彩、材质、颗粒和光晕要求只在确有叙事作用时用中文自然语言写一次。
- `imagePrompt`只冻结一个静态时刻，至少包含主体、可见状态和一项空间/视线/姿态/道具/环境结果；不得写对白、声音、运镜、时间段或动作过程。
- `framePlan`内部字段负责 `startPrompt → actionPrompt → transitionPrompt → endPrompt`、连续性、时间边界和动作因果；公开视频不得把这些内部字段名机械抄入卡片。
- 除第一张卡外，每张公开视频卡必须增加 `剪辑承接`，明确本卡与上一卡的连续镜头/硬切关系、触发事件、新机位、切后主运镜、新增信息和人物/道具/场景/轴线承接；第一张卡写明入口状态已锁定。硬切只存在于内部 `cameraEvents` 而不在公开卡片表达，视为 `CAMERA_EVENT` 失败。
- 同一 utterance 必须沿单调对白游标分段；不能在相邻卡片重新起句、复制完整台词或重叠四个及以上可发音字。
- 参考素材不是提示词正文事实源；职责和顺序只由 `referenceManifest` 承载。每镜使用最小必要集合，默认仅当前出镜角色基准图和当前场景全景锚点。

### 独立生成结束条件

外部 Codex 必须在输出前完成“生成 → 逐镜自检 → 只修失败镜头 → 再自检”闭环。正式结果必须是完整 13 章 Markdown，不得输出半成品、待门禁、待服务端补齐或仅有镜头摘要的结果。第十三章必须逐项列出全部门禁代码、状态、镜头/帧证据、修订范围和备注；登记为 blocker 的项目只能为 `passed`。所有 blocker 通过后，才可标记 `qualityGateStatus=passed`；warning 必须保留在 QC 中，不得改写成通过证据。实际尾帧缺失只有在用户显式启用实际尾帧模式时才可成为 blocker。服务端不得把 JSON 再投影成 Markdown。

本文件与模板内嵌的门禁登记表是外部生成的可执行规范；项目服务端仍可作为导入安全校验，但不得以隐藏的固定脚本、旧模板或历史包重建、补写或改写外部 Codex 已生成的公开视频正文。

本文件是制作包契约唯一规范源；模板由本文件、当前 Skill 和编译清单生成。模板内嵌规则与服务端校验发生差异时，必须更新本文件并重新编译，不得在生成器中新增只存在于代码里的导演门禁。

## Agent 运行时规则

- 项目内 Agent 制作包仍由 `executeDramaScriptRun` 组织；独立 Codex 不经过该入口。两条路径都必须依据同一模板和 Skill 自检，但独立 Codex 的正式结果是完整 Markdown，项目服务端不得把独立结果改写成另一份 Markdown。
- `authoring.materials[]` 只允许三类来源记录：`package-template`、`story-source`、`reference`，每条必须有唯一 `alias`、`title`、`type`（`text`、`markdown`、`image`、`video`、`audio`）；可取得时记录 `contentHash`。`director-skill`、`provider-adapter` 不是素材来源角色，禁止放入 `authoring.materials[]`；实际使用的当前导演 Skill、公开镜头卡格式 Skill 与 Seedance 适配 Skill 可分别记录在 `authoring.directorSkill`、`authoring.storyboardSkill`、`authoring.seedanceSkill`，并在 `productionBible.productionPlan.skills` 写入版本。它们是生成来源记录，不是导入器的 Skill 白名单或版本匹配条件。`package-template` 只规定 13 个一级章节、字段顺序和字段职责；制作包正式生成时由系统自动注入唯一系统模板，用户可以提供同角色的自定义模板覆盖它；`story-source` 只规定当前目标小说章节的剧情事实；`reference` 只规定素材职责。三类 authoring source 必须保留 alias、role、顺序和内容哈希。用户不应因为未重复上传模板而被阻止生成制作包。
- 目标小说章节使用 `targetNarrativeChapter` 单独记录；它是剧情素材范围，不得与制作包一级章节编号混用。当前集必须提供完整文学剧本、场次、镜头和可执行结果，不能只返回摘要或镜头概述。
- 镜头规范对象必须分别填写 `dramaticFunction`、`performancePlan`、`lightingPlan`、`continuity`、`entryState`、`exitState`、`videoPrompt` 和 `framePlan`；`framePlan.start.source`、`framePlan.end.required`、`framePlan.referenceManifest`、每个帧段的 `imagePrompt` 及其时间/动作/静态状态必须可校验。
- 跨镜头连续性是硬门禁：硬切允许从独立视频片段开始，但携带角色、道具、环境或轴线时，下一镜不得重置人物位置。`entryState` 必须继承上一镜 `exitState`；若位置、姿态、持有关系或轴线改变，必须在上一镜出口/edge notes/下一镜首帧写出触发、移动路径或受力和到达结果，且首个 framePlan 必须重复空间锚点。服务端不得静默用上一镜状态覆盖错误输入来伪造通过。
- 跨镜头连续性是硬门禁：硬切允许从独立视频片段开始，但携带角色、道具、环境或轴线时，下一镜不得重置人物位置。`entryState` 必须继承上一镜 `exitState`；若位置、姿态、持有关系或轴线改变，必须在上一镜出口/edge notes/下一镜首帧写出触发、移动路径或受力和到达结果，且首个 framePlan 必须重复空间锚点。服务端不得静默用上一镜状态覆盖错误输入来伪造通过。
- 项目内 `project-gpt` 的结构化 authoring draft 在规范化前必须逐镜提交完整原始字段：不得依赖服务端默认值补齐 `performancePlan`、`lightingPlan`、`continuity`、`entryState`、`exitState`、`imagePrompt`、`videoPrompt` 或帧段正文。独立 Codex 不提交该 draft，而是直接提交完整 Markdown 与唯一 JSON；同样的字段必须在 Codex 输出前完成自检。
- 每个 Agent 帧段必须直接提供 `actionPrompt`、`transitionPrompt`、`endPrompt`、`imagePrompt`；除第一帧外 `startPrompt` 必须原样承接上一帧 `endPrompt`。第一帧不要求虚构 `startPrompt`，但视频 Prompt 必须由 Agent 直接生成，不能靠服务端从其它字段拼接。公开视频 Prompt 必须使用小墨个人分镜 Skill 6.3（`storyboard-director@6.3.0`）的制作包适配版简洁镜头卡；每个真实 framePlan 时间段对应一张镜头卡，内部字段仍在 `framePlan` 中严格校验。
- 每个真实帧段必须完成“谁做什么 → 因为什么触发 → 身体微动作/手部或道具受力 → 可见结果 → 声音锚点”的闭环；`dramaticFunction` 还必须写出当前角色欲望/目标与阻力/压力。声音锚点可以是台词、人声、呼吸、动作拟音、环境音、余响或明确静默，但不得留空。对白结束后的时间只能承载新的剧情职责或有目的的结果停留，不能生成无职责静态反应。
- 每个真实帧段必须完成“谁做什么 → 因为什么触发 → 身体微动作/手部或道具受力 → 可见结果 → 声音锚点”的闭环；`dramaticFunction` 还必须写出当前角色欲望/目标与阻力/压力。声音锚点可以是台词、人声、呼吸、动作拟音、环境音、余响或明确静默，但不得留空。对白结束后的时间只能承载新的剧情职责或有目的的结果停留，不能生成无职责静态反应。
- `SEC01`—`SEC13` 只允许出现在 `archive.sections`；任何章节对象混入 `episodes[].shots` 都是伪镜头。兼容导入可以忽略并给出二次确认警告，Agent 严格生成和正式剧本导入必须阻断。
- 场景的 `backgroundNpcPolicy` 只描述无名背景群像；背景 NPC 不进入 characterCodes。required 场景的数量、前中后景分布和可见反应必须落到受影响的关键帧或视频时间段。需要跨镜头连续的群像可在策略中提供稳定 `roster`：每个槽位包含 `slotId`、世界空间 `worldAnchor`、稳定 `variant` 和 `defaultState`；镜头正文引用当前可见槽位及其状态变化，不得用画面前/中/后景重新分配同一个人。
- 默认清晰度合同要求所有可见主角、关键 NPC、剧情道具和场景锚点在当前景别下清楚可辨；不得用无意模糊、过度浅景深、雾气、泛光或颗粒遮盖脸、手、道具接触面和空间结构。只有用户明确要求的背影、虚焦或浅景深才可模糊，信息过载时应拆镜而不是缩小或虚化全部主体。30 秒高密度硬切时，每个切后画面都必须重新稳定焦点，不能用快速甩镜、运动模糊、数字变焦或缩小人物换取切换数量。
- 画幅必须先参与构图编译：9:16 优先单人/双人、过肩和纵向深度，16:9 优先横向空间、多人关系和群像定场；禁止把同一套横屏站位只替换比例后复用。
- 画幅构图是阻断式门禁，不只是导演建议：每个 `framePlan` 时间段必须明确当前主要主体和主体可见范围；9:16 的近景/中近景/特写必须写完整头顶、下巴、主要衣领和防裁脸/防前景遮脸安全区，三人以上只能用于建立空间或结果全景并明确前中后景/上下纵深；16:9 允许横向空间关系和群像，但必须保留主体层级，不能把所有人物缩成不可辨识的小人。前景肩膀、门框或其他人物穿过主要人物脸部时直接阻断。
- 内部硬切必须通过主体覆盖门禁：每个切点都要写新的信息主体或动作细节；如果当前剧情包含需要独立呈现的其他角色、NPC反应，必须至少有对应反应镜头；如果包含手部、道具接触或受力事实，必须至少有一个手部/道具细节硬切。7—10 次硬切不等于同一角色的多个角度。
- `framePlan.referenceManifest` 是提示词 alias、执行快照和供应商参考列表的唯一顺序事实源；公开提示词必须逐项写出 alias 与角色/场景/道具职责，禁止用“@图片1至@图片N”替代映射。角色锚点必须包含身份、年龄感、脸型/发型、服装和固定配饰；场景锚点不得承担角色职责，道具锚点不得承担角色职责。
- `videoPrompt` 和 `framePlan` 都由 Agent 直接生成；应用层不得从模板、旧包、历史提示词、动作字段或帧计划重建、补写、删改公开视频正文。未经声明的内部切镜、未绑定道具或未声明角色不得出现。
- 一个逻辑片段的 7—10 次硬切不能全部复用相同景别、焦段、机位和主运镜；如果没有新的主体、手部/道具、反应、空间层级或结果信息，直接判定 `CAMERA_EVENT` 与 `CUT_INFORMATION_DIVERSITY` 失败。
- 模板自检硬门禁至少包括文学剧本完整性、对白覆盖率、对白表演质量、视频提示词排版与语义、剧情事实覆盖率、动作密度/差异、情绪递进、NPC 反应变化、运镜动机、镜头事件、时间轴、素材绑定、连续性、画幅构图、主体覆盖、硬切信息差异、参考 alias 一致性和角色服装连续性。任一 blocker 都必须先在 Codex 当前上下文内修订，不得把失败草案标记完成。

## 固定章节顺序

1. 项目总览：集名、原作章节、类型、核心冲突、本集情绪、情绪曲线、色彩叙事、视觉风格、叙事主题、编剧结构卡和 9:16 导演规则。
2. 原创第一章：用于改编的连续文学正文。
3. 第一集文学剧本：基础设定及 `场N｜标题｜时间｜时间码`。
4. 镜头执行表：固定 11 列，镜号必须为 `SH01` 起连续编号。
5. 角色一致性资产：角色编码为 `C01` 起连续编号，Prompt 使用 `text` 代码块。
6. 场景一致性资产：场景编码为 `S01` 起连续编号，Prompt 使用 `text` 代码块。
7. 关键视频资产 Prompt：编码为 `V01` 起连续编号。
8. 全案板 Prompt：编码为 `全案板 N/M｜SHxx-SHxx`。
9. 台词与表演脚本：角色台词基调、台词序列、沉默设计。
10. 声音设计：逐镜环境音、拟音、音乐。
11. 分段视频 Prompt：编码 `P01` 与 `SH01` 一一对应。
12. 资产映射与执行顺序：当前存在性、推荐映射、生成顺序。
13. QC 报告：Prompt QC、视频评分和最终视频 QC。

## 固定表头

```text
| 镜号 | 时间 | 阶段 | 景别 | 运镜 | 焦段 | 灯光 | 色彩 | 转场 | 动作描述 | end_state |
| ID | 镜号 | 说话人 | 台词 | 表演与节奏 | 口型 |
| 镜号 | 环境音 | 拟音 | 音乐 |
| 优先级 | 资产 | 用途 | 计划类型 | 建议引用段 |
| 维度 | 分数 | 结论 |
```

## 数据落库规则

- 项目、资产、场次、镜头、声音与连续性进入可执行生产数据。
- 每个镜头的完整公开 `videoPrompt` 必须由 Agent 直接生成：使用小墨式镜头卡写出每个真实时间段的时间范围、景别、焦段、机位角度、主运镜、场景、可见画面、光影、色调、对白和声音。`framePlan.frames` 保存严格的内部结构化事实，运行时和第十一章不得从它拼接、补写或改写 `videoPrompt`；`起点 / 动作与触发 / 可见衔接 / 终点`只属于内部帧计划质量契约，不是公开正文固定排版。
- 独立 Codex 必须在最终输出前完成同一套模板/Skill 自检：相邻时间段有真实动作差异，起始/中段/结束形成情绪递进，required NPC 反应随主事件发生变化，主运镜有具体可见动机，内部切镜与 framePlan 边界一致；公开 videoPrompt 必须使用小墨个人分镜 Skill 6.3（`storyboard-director@6.3.0`）制作包适配版的简洁导演镜头卡，每个真实 framePlan 时间段对应一个 `### 镜头` 卡片，标题含时间范围、景别、焦段、机位角度、运镜方式和主体类型，正文含场景、画面内容、光影、色调、台词、人声和音效。公开视频不再强制八段标题或逐段复制 `起点/动作与触发/可见衔接/终点`；这些字段只在内部 framePlan 中校验。`画面内容`只能写可见口型、呼吸、视线、表情、身体和道具结果，禁止复制完整对白、引号台词或“某人说：”指令；完整原句只能放在 `台词` 字段。有对白的镜头卡必须使用 `说话人说：“实际台词”`，相邻段不得复制同一完整台词或同一表演块；对白结束段必须写具体静默或反应结果。用户本轮上传的自定义制作包模板若明确声明30秒高密度硬切，必须在本轮生成前提升为 `internalCutPolicy=dense-30s`，不得被旧的 `adaptive` 方案覆盖；系统模板中的条件说明不自动提升为高密度。自检失败只在当前 Codex 上下文内修复失败镜头；未失败镜头、剧情事实、资产身份、逻辑片段数量和总时长冻结。服务端导入不重复执行这套语义自检，也不生成镜头级工单；它只拒绝结构损坏或明确标记为 blocked 的包。
- 公开视频 Prompt 采用小墨 6.3 式简洁导演镜头卡：每个真实 `framePlan.frames[]` 对应一张 `### 镜头 N | 时间范围 | 景别 | 焦段 | 机位角度 | 运镜方式 | 人物镜头/非人物镜头` 卡片；卡片填写场景、画面内容、光影、色调、台词、人声和音效。除第一张卡外，每张卡还必须填写 `剪辑承接`，公开表达本卡与上一卡的连续/硬切关系、触发、新机位、切后主运镜、新增信息和连续性承接；第一张卡写入口状态已锁定。公开视频不再强制八段标题，也不要求逐段输出起点、动作与触发、可见衔接、终点等内部字段；这些事实只在 `framePlan` 和质量门禁中校验。全局设定、素材职责、参考 alias 和供应商顺序由结构化字段管理，不在每张卡片机械复制。
- 每张镜头卡必须声明一个有动机的主运镜；连续镜头只保留一条连续摄影路径，内部切镜则由 `framePlan` 的真实时间边界和镜头事件校验。切点必须带来新的关系、表演、道具、空间或结果信息，不能只更换焦段或同一角色角度；没有用户/项目明确配置时，不固定镜头数量或硬切配额。`propCodes` 与正文道具事实必须一致，没有绑定的道具不能写入画面内容、动作、结果或声音。
- 镜头级 `imagePrompt`、`startFramePrompt` 和 `endFramePrompt` 只描述单一静态画面，包含主体身份、当前可见姿态/表情/视线、道具或环境状态、景别、构图、光线与必要约束；不得写运镜、焦段、时间段、动作过程、对白或声音。生成前必须先由场景资产推演可用座位、长凳、地面、通道、门窗、隔断与遮挡；人物的姿态必须有合理支撑，人与物接触、动作路径及多人关系必须符合该空间，不能为突出人物把其摆在不合场景常理的位置，也不得新增原文或资产未声明的人物。图片编辑请求统一使用 `change / preserve / constraints`，其中 `change` 每次只允许一个已定位变量。
- 场景资产可配置 `backgroundNpcPolicy`：`auto` 由 Agent 按场景类型、空间容量、景别和剧情功能判断，`required` 必须安排合理数量、位置、密度和行为的无名背景 NPC，`forbidden` 禁止 NPC。`required` 场景应声明 `countRange: { min, max }`，每个受事件影响的关键帧/视频时间段必须使用 `NPC群像：N名；分布：前景X名、中景Y名、后景Z名；密度：具体密度；反应：具体可见反应`，并满足 `X+Y+Z=N`、人数在范围内；不能只写全局人数或“旁听、屏息、关注”。NPC 只作为镜头关键帧、视频时间段或构图参考中的背景群像，不进入 `characterCodes`、角色锚点或独立角色资产；场景全景基准图始终保持高清、无人、无文字。没有配置时按 `auto` 执行，不能把空配置当成禁止 NPC。
- 图片帧提示词使用现有 `imagePrompt` 作为唯一静态画面事实源，不强制九段。按事实选择 `画面主体`、`可见状态`、`构图与空间`、`光色与风格`、`针对性约束` 五类可选短段，缺少事实的段落省略；每帧至少表达主体、冻结的可见状态和一项可验收的空间关系、视线、姿态、道具或环境结果。`actionPrompt` 只描述动作过程，不复制进 `imagePrompt`。服务端只做轻量格式化和硬错误校验，质量缺口、帧间相似、构图/光线不完整和 NPC 拥挤等作为警告；不得从动作、镜头描述、资产、NPC 或相邻帧自动补写静态正文。参考图职责只进入 `framePlan.referenceManifest` 和服务端实际绑定，不写入图片正文。
- 第十一章“分段视频 Prompt”不是独立事实源，只展示当前 Agent 已生成并保存的完整 `videoPrompt`。JSON 和 Markdown 导出都必须保留该原文；不得根据 `framePlan` 重建、补写或覆盖时间段，也不得保存过期时长。
- 每个镜头必须携带可执行的 `performancePlan`、逐句 `dialoguePerformance`（无对白时为空数组）、`lightingPlan`、`continuity`、`entryState`、`exitState` 与 `framePlan`。`framePlan.start.source` 只能是 `independent` 或 `previous_accepted_actual_tail`，`framePlan.end.required` 必须是布尔值；`framePolicy` 为 `agent` 时，`framePlan.frames` 必须包含 `frameCountRange`（默认 2–11）内按不可合并的冻结可见状态自适应拆分的帧段，不能按时长、提示词长度、角色数量或参考图数量统一分配。含有带时间对白/旁白的镜头，帧段边界必须优先对齐自然开口、收句、停顿、动作触发和反应留白；如果对白边界落在帧段内部，所有帧段等长属于硬错误。用户或项目明确要求 30 秒高密度硬切时，优先使用 8–11 个帧段承载 7–10 次真实可见硬切；静态留白、结果停留或供应商能力限制可以少切，但必须在镜头中写明原因。固定策略只在用户明确选择后执行。每段提供稳定 `id`、连续 `sequenceIndex`、`startSecond`、`endSecond`、`actionPrompt` 与 `imagePrompt`，并从 0 秒无空白、无重叠地覆盖完整镜头时长。视频提示词优化返回的 `startPrompt`、`transitionPrompt`、`endPrompt` 若存在必须原样保留并用于运行时分段；缺失时直接拒绝导入，不再从描述或旧提示词补齐。
- 镜头规范对象还必须按当前事实填写 `dramaticFunction`（唯一戏剧职责）、`cameraMotion`、`lens`、`lighting`、`colorPalette`、`transitionIn`、`transitionOut`、`characterCodes`、`locationCode`、`propCodes` 和 `clueCodes`；这些字段不能用模板占位或由服务端从其它镜头重组。`videoPrompt`、`framePlan`、表演、光影和连续性分别承担自己的事实职责，不能互相冒充。
- 除第一帧外，每帧 `startPrompt` 必须原样等于上一帧 `endPrompt`；变化只能发生在本帧的动作、衔接、终点和静态 `imagePrompt`，禁止在段首凭空改写人物、道具、空间或 NPC 状态。
- 参考图编排预算与镜头时长绑定：15 秒及以下最多 9 张图片，30 秒最多 30 张图片。该预算不覆盖供应商已经声明的更小上限，提交时仍按真实模型/渠道能力校验；制作包不能把 30 秒镜头写成旧的 9 张全局上限。
- 含对白的制作包必须在 `project.productionBible.dialogueTiming` 声明 `utterance-timing-v1`；每条 `utterances` 逐句填写相对镜头的 `startSecond`/`endSecond`（只计实际说话口型，不含停顿）、`pauseBeforeSeconds`、`pauseAfterSeconds`、情绪语速 `speechRate`，并用 `speechRateCharsPerSecond` 记录可复核语速。每句先计算 `availableSpeechSeconds=endSecond-startSecond`，再计算 `requiredSpeechSeconds=可发音字数/speechRateCharsPerSecond`；`availableSpeechSeconds < requiredSpeechSeconds` 时，正式 Agent authoring、制作包应用和生产前预检一律阻断，即使整镜总时长仍有余量也不能通过。`pauseBeforeSeconds`/`pauseAfterSeconds` 另行占用句前/句后空间，必须在镜头边界内且不得与其他对白重叠。视频 Prompt 的每个实际说话时间段还必须直接写 `对白表演：说话人说：“实际台词”；语气：…；停顿：…；重音：…；说后反应：…`，公开镜头卡的台词窗口必须与对应 `framePlan` 时间段一一相容；对白结束段写反应停顿/静默结果，禁止只写说话人标签或把台词塞进重音字段。10 个可发音字容差只用于整镜总量的兼容提醒，不适用于逐句口型窗口；必须在自然分句、说话人转换、动作反应或逻辑片段边界拆分，禁止用异常加速压缩对白。
- 短剧生产方案的 `productionBible.productionPlan.skills` 必须同时记录当前唯一导演 Skill `drama-video-director` 与供应商适配层 `seedance-25-director` 及其版本。`seedance-director` 只作为历史请求的兼容别名，不得进入新制作包，也不得作为第二套提示词规则注入 Agent。静态图片帧只执行项目唯一的宽松静态帧规则；视频 Prompt 按镜头时长和用户明确操作加载 2.5 reference：15/20 秒使用普通阶段节拍，30 秒使用连续时间轴，续写、编辑、白模、转场和多宫格使用对应专用规则。服务端必须把两个当前 Skill 的版本化正文和本次 2.5 reference 注入规划/制作包生成系统指令，并在运行审计与制作包方案中保留技能 ID、名称和版本；不能只把技能名称作为展示字段，也不能因后台普通 Skill 配置缺失而静默降级。
- 每帧的 `imagePrompt` 必须以“本帧可见状态”为主体事实源：至少明确当前可见的主体、姿态/表情/视线、道具状态、空间关系或环境变化中的一项，且必须能与相邻帧区分。不得只填写对白、旁白、口型、声音、运镜、焦段、景别、色彩、负面词或“保持一致”等约束；这些内容只能作为辅助字段，分别归入 `dialoguePerformance`、声音/表演规划、镜头参数或供应商固定约束。不得复制整镜头 `imagePrompt` 后只追加“起始状态/动作展开/关键变化/结果状态”或“当前时段动作锚点”充数。制作包导入和生产预检仍必须阻止结构不完整、无可见画面或实际重复的帧；用户在帧编辑器保存时只硬校验非空、镜头/帧存在和权限，其他质量问题显示风险并允许二次确认保存。固定角色/场景/风格约束可以在服务端供应商请求中重复注入，但界面和制作包正文应突出本帧变化。
- 制作包正文禁止使用通用模板句充当帧内容，包括“入口构图已建立”“动作展开”“关键变化”“结果状态”“动作节点已经成立”“主体的眉眼、呼吸、手部和道具接触关系清晰可见”“情绪通过身体动作呈现”等。`可见状态` 必须写当前节点实际发生的具体眉眼、视线、呼吸、手部、身体或环境结果；没有具体事实时必须回到镜头原文、表演计划或道具/场景状态补足，不得用模板占位。历史制作包导入、规范化、保存和导出保留原文；旧字段或重复文案只产生质量警告，不自动迁移、重排或补写。历史内容仅供审计，不能作为新制作包或新供应商请求的事实源。
- 连续帧必须先拆成“建立场景 → 镜头/主体推进 → 关键动作 → 结果或反应/转场”四类动作节点；动作提示词写发生的动作，静态 `imagePrompt` 写该动作已经造成的可见结果。时间段按实际动作节点和帧数连续分配，不预设固定秒数。静态帧也必须有姿态、表情/视线、手部/道具或环境的状态转变；不得让每帧共享同一核心句式后仅替换阶段标签。
- 同一镜头内的每帧必须独立使用固定场景、角色、道具锚点，不引用或等待同镜上一帧图片；只有跨镜头连续性边明确要求时，镜头第一帧才可使用上一镜已人工验收的实际尾帧 `previous_accepted_actual_tail`。上一帧的姿态、视线、手部/道具状态和环境结果不得被无条件复制，当前帧 `imagePrompt` 对这些可见状态具有更高优先级。
- 连续性只锁定身份、服装、道具材质、空间轴线和光向等必要事实；降低“构图不变、主体稳定、情绪保持不变”等静态约束，不能用连续性规则压住动作变化。每一帧都必须让模型看见一个相对上一帧可验收的变化。
- `framePlan.referenceManifest` 必须以镜头声明的 `characterCodes`、`locationCode`、`propCodes`、`clueCodes` 为主事实源，再用正文补充；场景切换时必须更换 `scene_anchor`，不得因为动作描述仍提到上一场环境而继续引用旧场景。实际提交的参考图必须是当前镜头最小必要集合：默认只提交可读的场景全景锚点和出镜角色基准图；道具、线索、动作关键帧和额外构图图只有在当前时间段承担不可替代的可见细节或连续性职责时才加入。镜头生成前必须逐镜核对“镜头场景/角色/道具声明 = 实际参考图绑定”，缺少任一声明资产时阻塞生成，不得静默降级为通用参考图。角色基准图必须具备身份特写与清晰四视图/转面信息；场景图必须是高清16:9单视角全景，能读出本场长案、主位、门窗/入口等空间拓扑；不满足清晰度或拓扑要求的资产不得作为正式锚点。
- 新章节制作包生成必须先结合当前项目固定资产目录再分析剧情：服务端向剧本 Agent 提供已有角色、场景、道具和线索的稳定 `id/code/name/profile`、基准图状态、`activeEpisodeCodes` 及当前集使用情况；已有资产的身份、轮廓、材质、基准图和固定字段不得被重新设计。Agent 漏列已有资产时，服务端必须在制作包规范化前补回项目资产，并保留镜头对这些资产的稳定编码引用；项目历史资产缺少 `code` 时按名称匹配后分配稳定回退编码。已有资产可在资产表中保留但本集不出镜时，不得进入当前镜头的 `referenceManifest`。
- 对白或旁白可以不写入静态图片正文，但其可见后果必须进入对应帧：说话者的眉眼、嘴角、视线、头部朝向、手部动作、道具位置、身体姿态或对方反应；表情变化只写在视频 Prompt 而未写入图片帧，视为不合格。每个动作节点至少应有一个可验收的静态表演状态，视频 Prompt 再负责状态之间的运动和声音衔接。
- 新建镜头或制作包未提供 Agent 帧段时，服务端不生成默认帧；必须由 Agent 提供合法的 2–11 个真实动作节点（或项目明确的 `frameCountRange`），否则阻止制作包导入或生产。30秒高密度硬切镜头应提供8—11个节点以承载7—10次硬切，静态镜头除外且必须记录减切原因。
- `productionBible.productionPlan.video.shotDuration` 可设为 `15` 或 `30` 秒，表示 Agent 重新编排后的逻辑镜头目标时长。生成制作包时必须依据该值切分剧情，并将同一场景、连续时间轴内的碎片合并到目标时长（例如 8 秒 + 7 秒合并为 15 秒）；人物资产及其固定身份沿用项目现有资产，不因重新分镜而重建。
- 对白时长必须先于镜头和帧计划核算：按每秒约 5 个可发音字的质量门禁基准估算（标点、停顿和动作反应不计入可压缩空间），允许不超过 10 个可发音字的上线偏差提示；内容分析和历史/兼容导入阶段可以保留提醒并返回结果，但正式制作包 authoring、应用和生产前预检不得放行超过 10 个字的容量偏差。必须在自然分句、说话人转换或动作反应处拆镜，不能把超出容差的完整长台词当作“已通过容量优化”，也不能通过异常加速解决时长不足。
- `productionBible.productionPlan.video.framePolicy` 默认为 `agent`，并配套 `frameCountRange` 默认 `{ min: 2, max: 11 }`。Agent 必须先识别动作、表情/视线、道具、对手或 NPC 反应、空间揭示和摄影切换事件，再按不能合并的冻结可见状态决定帧数；2–11 是允许范围，不是默认模板，不能按时长、提示词长度、角色数量或参考图数量统一分配。用户或项目明确要求30秒高密度硬切时，优先生成8—11个帧段，对应7—10次完整硬切；静态留白、结果停留或供应商能力限制可以少切，但必须在镜头中说明原因。入口和出口是必要边界，同时发生的结果可以合并在一帧；只有事件集合相近的镜头才可以复用帧数。用户主动选择固定策略时才按固定数量生成，制作包已经明确给出合法逐帧计划时，以制作包为准。
- `productionBible.productionPlan.video.framePolicy` 默认为 `agent`，并配套 `frameCountRange` 默认 `{ min: 2, max: 11 }`。Agent 必须先识别动作、表情/视线、道具、对手或 NPC 反应、空间揭示和摄影切换事件，再按不能合并的冻结可见状态决定帧数；2–11 是允许范围，不是默认模板，不能按时长、提示词长度、角色数量或参考图数量统一分配。用户或项目明确要求30秒高密度硬切时，优先生成8—11个帧段，对应7—10次完整硬切；静态留白、结果停留或供应商能力限制可以少切，但必须在镜头中说明原因。入口和出口是必要边界，同时发生的结果可以合并在一帧；只有事件集合相近的镜头才可以复用帧数。除第一帧外，每帧 `startPrompt` 必须原样承接上一帧 `endPrompt`。用户主动选择固定策略时才按固定数量生成，制作包已经明确给出合法逐帧计划时，以制作包为准。
- 连续性边和 `framePlan` 是状态关系，不由 `startFramePrompt` / `endFramePrompt` 推断。自动拆镜后，后续子镜入口状态、首帧计划和提示词只能继承前一子镜出口状态；禁止复制原组首镜起始状态。声明 `previous_accepted_actual_tail` 的镜头只能使用上一镜当前视频版本、经人工验收的实际尾帧作为唯一 `first_frame`。
- 帧图统一记录在 `frameEvidence`：必须包含角色、来源类型、来源镜头/视频/任务/资产、媒体与公网 URL、内容哈希、所属视频版本、`candidate/accepted/rejected/superseded/unavailable` 有效性及验收或失效原因和时间。旧分镜 URL、旧任务结果、删除帧、拒绝帧和失效帧均不得再作为请求引用。
- 视频提取的实际首尾帧先是 `candidate`。只有人工验收当前视频版本的实际尾帧，才可解锁下游继承镜头；拒绝仅保留审计证据并阻塞下游，不自动创建重试任务。
- 首尾帧模式的 Agent 每次显式操作只创建一个帧位任务：缺起始帧时创建起始帧，已有起始帧且缺结束帧时才在下一次显式操作创建结束帧；首帧成功不得自动追加尾帧上游请求。
- 全能帧模式使用 `all_frames`，用户直接选择的有序关键帧仍遵循供应商实际能力；制作包 Agent 的内部帧计划最多可用11个节点，按 `sequenceIndex` 从1连续排列，每个帧段保存独立时间、动作、画面提示词、媒体、任务、输入哈希和连续性证据。30秒高密度硬切的8—11个节点对应7—10次硬切。分段视频 Prompt 使用 `Pxx-Fxx` 标识对应帧段；视频任务只能传给已明确声明支持相应参考图数量的模型，容量不足时按帧段拆成子片并顺序合成，禁止静默裁掉参考图。
- 原创章节、结构卡、导演规则、V/SB Prompt、表演口型、静默设计、引用计划、生成顺序和 QC 进入制作包档案。
- 完整原文件及 SHA-256 继续作为来源凭据保存。
- 人工字段优先级最高，其次为制作包、AI 补全和默认值。
- `activeEpisodeCodes` 不包含当前集的资产不得进入当前集镜头引用。
- 具备非空图片 Prompt 与视频 Prompt 的完整包可直接进入分镜，不重复调用视觉整理。

## 版本规则

- v1 内只允许增加可选说明，不修改固定章节、编码和表头。
- 若必须改变字段语义或表头，创建 v2，不在 v1 中静默变更。
- 导入预览必须显示格式版本、章节数、Prompt 资产数、场次、镜头、角色、地点和总时长。
