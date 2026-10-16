# 《项目名》第一集制作包

> 制作包格式：`vozeb-drama-production-package-v1`
>
> 模板版本：由 `pnpm compile:skills` 自动生成；唯一制作包契约：`vozeb-drama-production-package-v1@1.2.0`（契约 hash：`6b80279cb6597d032bbf63725a3d36251287c72eab1553ad199c5b13a20038a5`，规范源 hash：`a7e419487e39230bd1abc12c43f71cd029db8e9aa9c3dd62f6ae8e8e273e0189`）。导演 Skill：`drama-video-director@1.16.0`（hash：`4e66841324faf2286cc232340e4661c0b811c283142e907de539729bad5a5045`）；模板自检规则、Seedance Skill 和来源版本由同一编译清单绑定。
>
> 使用约定：本模板是当前 v1 制作包的结构、自检规则和最终交付格式。独立 Codex 必须直接生成完整 13 章 Markdown，并在“规范对象”代码块中嵌入唯一标准 JSON；JSON 与正文由 Codex 同一轮生成，服务端不负责章节投影或镜头卡重建。读取和导入保留作者原稿，只读核对并提示缺句、声音冲突或版本差异，不替代完整 authoring 自检。不要把历史制作包、旧 generationPrompt 或旧分镜正文当作新包模板。
>
> 生成方式：本模板支持外部 Codex 独立生成。外部 Codex 只依据本模板、当前用户请求、当前 TXT/小说、当前正式资产和当前参考素材完成一次 authoring、自检和修正，不需要调用项目内部 `executeDramaScriptRun` 或依赖隐藏硬编码。项目导入时检查 JSON、章节、字段、时间轴、资产和权限，不重复执行完整语义门禁，也不从 `framePlan`、旧提示词或模板示例重建镜头卡；读取/导入不补台词、不追加声音说明、不重编译公开正文，质量问题定位提醒并允许继续导入。
>
> 来源优先级：本轮用户请求与本轮自定义模板 > 当前 TXT/小说事实 > 当前正式资产与已验收连续性 > 本模板与当前导演 Skill 的通用规则 > 最小合理导演补全。不得读取历史制作包、历史脚本、旧 generationPrompt 或旧运行记录。没有角色/场景图片不阻断制作包生成；有图片时必须按 alias、职责、顺序和清晰度登记，不能伪造引用。
>
> v1 固定保留 13 个一级章节；独立 Codex 必须直接填写这些章节。规范对象 JSON 与正文必须同时完整提供剧本、场次、镜头、资产、表演、声音、连续性、逐帧计划和 QC 数据。
>
> 目标平台：按当前锁定生产方案填写｜语言：按当前项目填写｜画幅：按当前项目填写｜每个逻辑片段时长：按当前方案填写｜整集成片时长：由 TXT/剧本拆解后的逻辑片段数量推导

### 外部交稿的顺序与范围

完整源文及结尾 → 逐句原文、声源与顺序 → 人物目标/知情/触发/选择/结果 → 建筑锚点、路线、左右手、道具归属与轴线 → 容量核算并冻结逻辑轴 → 逐帧信息职责、静态瞬间与摄影选择 → JSON/正文 → 观众顺序审阅与局部修订。只使用当前正式事实，不回灌旧制作包。

长对白切听者时保留原角色的场内画外声源；人物、手部、道具和环境特写按实际主体检查。克制表演不强制情绪升级，所有相邻片段必须登记连续或合法变化依据。声音冲突按声源与窗口核对，原句“别说话”不当作禁声指令。第十三章记录具体证据和实际检查范围；无媒体时只报告文本自检。

可运行 `pnpm --dir web run check:drama-package -- <制作包.md> --source <源文.txt>`；工具只读不改稿。每个公开时间轴段用自然语言写出动作、空间、声音与新增信息，不新增“剪辑承接”等重复字段；禁止跨逻辑片段引用。字段说明与测试过的最小合法镜头见配套 [字段合同与最小镜头示例](drama-production-package-v1-fields.md)，示例不进入本包。结构错误先修，质量问题集中局部修订；项目允许提醒后导入且保留原稿，导入成功不等于 QC 通过。

### Seedance 2.5 压缩与公开段落规则

本模板固定 Seedance 2.5 的公开 `videoPrompt` 结构。小墨 6.3 提供导演判断，模板规定最终正文的唯一顺序和表达方式。

- 正文依次为：以“开场时，”起句；可选的一段自然语言视觉基调；仅当本镜有真实绑定素材时，插入一次 `参考图片：` 清单；从 `00.0` 起连续的自然时间段；以“结束时，”交代最终状态。可选的末尾 `声音：` 只写稳定角色音色要求。
- 时间段写当前画面、摄影、动作因果、表演、完整原句对白及局部声音。时间覆盖从 0 开始且连续到片段结束；每段是完整自然语句，不能改成 `参数/公共总规范/时间轴/收尾/台词/人声/音效` 包装字段。内部 `framePlan.frames[]` 与公开时间段数量独立。
- 视觉基调只在开场处按需写一次；导入、提示词拼接和生成提交不得再补写统一视觉合同或重复视觉风格。
- 每个已绑定角色参考图只引用一次，并在该角色素材绑定中仅附加一次以下约束：`每张角色资产图均展示同一个人的不同观察角度，仅参考面容、体型、服装和配饰，不继承白底、排版或图中身体投影的数量。保证人物唯一性，每个角色在世界空间中仅有一人。`该约束只解释参考图用途，不把四视图投影当成场景内多个人。
- 字段边界（硬性）：`episodes[].shots[].videoPrompt` 只保存可直接提交给视频模型的公开画面、动作、表演、对白与声音正文。门禁状态/代码/证据、帧数/切数、减切原因和修订状态只写在 `authoring.qualityGateReport` 与第十三章，不得复制或拼接进 `videoPrompt`。若 authoring 自检发现混入，须在交付前修正制作包源稿，并保证 JSON 与第十一章正文一致；禁止依赖导入、保存、编译或提交时过滤，相关流程必须原样保留作者正文。
- 每次内部硬切在公开视频中用独立换行的 `Cut to：` 描述观众看到的新画面；对应触发、新机位、切后主运镜、信息目的和承接写入切后帧的 `framePlan.frames[].transitionPrompt`。正文不写“镜头事件”等机器字段。
- 只有 `internalCutPolicy=dense-30s` 被本轮或当前方案明确锁定时，30 秒逻辑片段才要求 8—11 个真实帧段和 7—10 次 `type=硬切`。少切例外及其实际帧/切数量、原因和修订状态写入结构化 QC。
- 正文建议控制在 2000 个 Unicode 字符以内；2500 是提醒线。超出只提示压缩重复表达，不阻断、不截断、不拆分逻辑片段，不得删减剧情动作、对白、表演或连续性事实。
- 每条提示词是单独提交的完整输入。不得依赖历史提示词、其他镜头、对话上下文、内部 ID/资产别名或编辑器字段；入口状态必须在本条开场和相关时间段中写成可见事实。

## 规范对象（机器导入必填）

正式制作包必须在本节保留且只保留一个 `drama-production-package` JSON 代码块。项目导入器只解析这个代码块，不会从下方 13 章 Markdown、旧镜头表或 `framePlan` 文本反向重建对象。

生成正式制作包时必须满足：

1. 代码块语言必须是 `drama-production-package`（也兼容 `json`）。
2. 代码块内容必须是一个完整、可解析的 JSON 对象，不得保留 `<占位符>`、省略号、注释或 Markdown 列表。
3. 根对象必须至少包含 `schemaVersion`、`project`、`assets`、`episodes` 和 `archive`；`episodes[].shots[]` 必须保存每个逻辑片段及其 `videoPrompt`、`framePlan.frames[]`、表演、对白、光影和连续性字段。
4. 下方 13 章与 JSON 是同一份 Codex authoring 结果的两种表达，不能互相矛盾；JSON 作为导入事实源，但正文也必须由 Codex 完整填写。

下面仅展示容器形状，属于模板示意，不能直接导入；正式生成时必须替换为完整对象：

```drama-production-package
{
  "schemaVersion": 1,
  "project": {
    "title": "替换为项目与集名称",
    "summary": "替换为本集摘要",
    "style": "替换为当前视觉风格",
    "ratio": "16:9",
    "productionLock": {
      "shotDuration": 30,
      "logicalShotCount": 1,
      "targetDuration": 30,
      "dialogueCapacityPlan": [],
      "narrativeBeatPlan": [{ "id": "BEAT01", "responsibility": "替换为独立剧情职责", "shotCodes": ["SH01"] }],
      "internalCutPolicy": "dense-30s",
      "framePolicy": "agent",
      "selfCheckRuleVersion": "drama-production-package-v1-standalone-preflight-1"
    },
    "productionBible": {
      "language": "中文",
      "ratio": "16:9",
      "visualStyle": "替换为当前视觉风格",
      "continuityMode": "strict",
      "productionPlan": "替换为完整 productionPlan 对象"
    }
  },
  "assets": {
    "characters": [],
    "locations": [],
    "props": [],
    "clues": []
  },
  "episodes": [],
  "archive": {
    "formatVersion": "vozeb-drama-production-package-v1",
    "sections": [],
    "promptAssets": [],
    "dialogueDirections": [],
    "voiceDirections": [],
    "silenceDirections": [],
    "referencePlan": [],
    "generationOrder": [],
    "qcReport": ""
  }
}
```

独立 Codex authoring 时，不得把上述示意对象原样返回；必须替换为当前 TXT/剧本真实生成的完整 JSON 和 13 章正文。服务端导入时只解析该 JSON，不从 JSON 重新投影章节正文；对白完整性和声音冲突只读检查，缺口由作者修订。

### 正式字段锁定与逻辑片段轴

独立 Codex 输出的 JSON 必须使用当前导入契约字段，不能使用历史或服务端内部别名：

```text
episodes[].code                  ✅
episodes[].shots[].code          ✅
episodes[].shots[].duration      ✅
episodes[].shots[].timecode      ✅
episodes[].shots[].framePlan     ✅ 当前逻辑片段内部帧段
```

以下字段命中即为 blocker，禁止“先识别再转换”：`episodes[].episodeId`、`episodes[].shots[].shotId`、`episodes[].shots[].shotDuration`、`projectionVersion`、`qualityGateRulesHash`、`repairPolicyHash`、`runId`、`workOrderId`。注意：`project.productionLock.shotDuration` 是逻辑片段时长锁定字段，属于必填字段；只有把 `shotDuration` 错放在单个 `shot` 对象上才是非契约字段。镜头缺少 `code` 时不得依靠数组序号补码，必须在当前 Codex 对话修复后再输出。

在写任何 `framePlan` 或公开视频卡之前，必须冻结唯一的 `productionLock`：`logicalShotCount`、`shotDuration`、`targetDuration`、`dialogueCapacityPlan`、`narrativeBeatPlan`、`internalCutPolicy`、`framePolicy` 和 `selfCheckRuleVersion`。满足以下关系才可继续：

```text
逻辑片段总数 = episodes[].shots 的实际数量 = logicalShotCount
每个 duration = shotDuration
每个 timecode 的跨度 = duration，且同一集连续无空洞
targetDuration = logicalShotCount × shotDuration
```

`framePlan.frames`、内部硬切和公开视频卡只是当前逻辑片段内部的剪辑密度轴。8—11 个帧段、7—10 次硬切、自然分句或换景别都不能新增逻辑片段；若相邻片段没有独立剧情职责、关系变化、动作结果或场景信息，必须合并并回到对白容量预检重算。

### 输出前不可跳过的结构自检

正式输出前必须逐项检查并在第十三章给出证据：根对象可解析且只有一个 `drama-production-package` JSON 代码块；13 个一级章节齐全且顺序正确；每个 episode/shot 使用 `code`；`duration` 与 `timecode` 一致；`productionPlan` 完整；`authoring.materials` 是数组；每个逻辑片段的帧段从 0 连续覆盖到自身时长；公开时间轴完整覆盖所有内部帧，公开段边界对齐真实帧边界；JSON 中的 `videoPrompt` 与第十一章原文一致；全部门禁代码都有状态、镜头/帧证据和修订范围。

`authoring.materials[]` 只能登记 `package-template`、`story-source`、`reference` 三种来源角色；每条来源必须有唯一 `alias`、`title` 和合法 `type`（`text`、`markdown`、`image`、`video`、`audio`），hash 能取得时填写 `contentHash`。导演 Skill、公开视频格式 Skill 和供应商适配 Skill 不是素材来源，必须分别放入可选的 `authoring.directorSkill`、`authoring.storyboardSkill`、`authoring.seedanceSkill`，不能写成 `director-skill` 或 `provider-adapter` 混入 `materials[]`。这三个字段只记录本次 authoring 实际使用的来源，不要求项目当前安装同名 Skill，也不参与导入准入、版本匹配或语义复检。`framePlan.frames[]` 也只能保留本模板列出的契约字段，禁止写入 `meta` 等生成器内部辅助对象。

若发现字段错误、逻辑片段总数错误、对白容量不足、帧时间不连续、公开视频卡缺失或 QC 证据缺失，必须在当前 Codex 对话内修复后重新自检。不得把错误包交给用户，也不得把错误交给导入器“过滤后继续”。

正式独立包的根级 `authoring` 必须记录：`source=codex-standalone`、`authoringMode=codex-standalone`、`canonicalSource=markdown-with-embedded-json`、`qualityGateStatus=passed`、实际 `repairCount`、`fullPackageRepairCount`、`generatedAt` 和 `materials`；模板/TXT/参考素材的 hash 能取得时记录，不能取得时记录来源名称和版本，不得伪造 hash。`directorSkill`、`storyboardSkill`、`seedanceSkill` 是可选 provenance 字段，只用于审计“本包按什么规则生成”，不属于项目导入限制；即使当前项目没有这些 Skill，结构合法且 QC 通过的独立包仍可导入。不得写入 `executeDramaScriptRun`、`workOrderId`、`projectionVersion`、`qualityGateRulesHash`、`repairPolicyHash` 或服务端运行凭据。

## 独立生成协议与完整门禁

以下规则随模板一并发布，外部 Codex 可以只使用本模板和本轮输入完成制作包，不需要读取项目内部实现。门禁不是生成后的补充检查，而是 authoring 阶段必须一次完成的自检条件；任何 blocker 未通过，都不得输出“可直接使用”的制作包。

### 当前绑定版本

- 制作包契约：`vozeb-drama-production-package-v1@1.2.0`，契约 hash：`6b80279cb6597d032bbf63725a3d36251287c72eab1553ad199c5b13a20038a5`。
- 规范源 hash：`a7e419487e39230bd1abc12c43f71cd029db8e9aa9c3dd62f6ae8e8e273e0189`；编译规则 hash：`75adcec4adc746bfce86ee1cb9a4956d534d716a243e9a07864360da9093bb84`。
- 主导演 Skill：`drama-video-director@1.16.0`，hash：`4e66841324faf2286cc232340e4661c0b811c283142e907de539729bad5a5045`。
- 视频提示词公开格式：Seedance 2.5 自然段适配器 `seedance25-prompt-adapter@1.4.0`，导演判断来源为小墨个人分镜 Skill 6.3（`storyboard-director@6.3.0`）；具体输出顺序和例文见第十一章。
- 每条逻辑片段只提交一份独立 `videoPrompt`。开场、可选视觉基调、真实素材绑定、连续自然时间段和结束状态各司其职；不能把场景、风格、声音、入口状态在多个段落重复堆叠。
- 正文长度遵循顶部 Seedance 2.5 规范；完整剧情事实、动作因果、表演、原句对白、声音锚点和连续性优先保留。
- 每个时间段中的位置变化必须写明触发、移动路径/受力和到达结果；没有位移时写清支撑、接触和持有关系如何保持。禁止瞬移、无因重排、穿模、悬空、脚底离地及轴线无因翻转。
- 公开视频卡使用自然语言，不得出现 `palette=...`、`saturation=...`、`film_stock=...`、`grain=...`、`halation=...` 等未声明伪参数串，也不得出现 `undefined`、`null`、`NaN`、`[object Object]`；光色、材质、胶片感如确有作用，只用自然语言写入 `productionBible` 或当前帧新增作用。
- 供应商适配层：`seedance-25-director`，只负责 Seedance 2.5 的时长、画幅、参考素材和模式适配，不替代主导演 Skill。

### 独立 Codex 输入与输出

1. 输入只允许：本轮用户请求、本模板全文、本轮 TXT/小说/剧本、当前正式资产、当前用户提供的参考素材和明确的生产参数。
2. 最终输出必须是完整 13 章 Markdown，并且只包含一个 `drama-production-package` JSON 代码块。JSON 必须包含完整文学剧本、场次、镜头、资产、表演、声音、连续性、逐帧计划、分段视频 Prompt 和 QC 数据。
3. 每个真实 `framePlan.frames[]` 必须被 Agent 直接写出的连续公开时间轴完整覆盖，允许一个公开段覆盖多个连续内部帧；不得由脚本或应用层拼接。
4. 第十三章必须逐项记录门禁状态、证据镜头/帧号、已执行的局部修订和最终 `qualityGateStatus=passed`；不得写“待服务端检查”。
5. 普通公开视频质量失败必须在当前 Codex 上下文内只修失败镜头的 `videoPrompt`、`framePlan` 和必要表演/连续性字段，未失败镜头、逻辑片段数量、时长、资产身份和剧情事实冻结不变。
6. 外部生成不要求角色、场景或道具图片存在；没有图片时保留文字资产事实，不新增 `@图片` alias。已有图片必须检查清晰度和职责，低清或拓扑不可辨的图片只能标记待修，不能作为正式锚点。

### Authoring 前置预检与连续性默认值

Codex 必须先做预检，再开始拆镜和写公开视频卡；不能先按固定帧数切完，再把对白和动作压进剩余时间：

```text
读取完整 TXT/剧本
→ 提取剧情事实、显式对白和说话人
→ 建立逐句对白容量表
→ 确定逻辑片段数量与每段剧情职责
→ 分配对白、停顿、动作、结果和反应留白
→ 决定内部帧段与硬切事件
→ 分别生成内部 framePlan 与公开自然语言时间轴，数量不绑定
→ 逐卡、逐镜、跨镜自检
→ 只修失败镜头及必要相邻连续性
→ 再自检并输出
```

对白容量表至少包含：对白 ID、说话人、可发音字数、`speechRateCharsPerSecond`、`requiredSpeechSeconds`、`availableSpeechSeconds`、逻辑片段、帧段、句前停顿和句后停顿。`requiredSpeechSeconds = 可发音字数 / speechRateCharsPerSecond`，`availableSpeechSeconds = endSecond - startSecond`。单句窗口不足、对白收句落在帧段内部、可见说话人的口型主体不一致（听者特写允许原说话人继续场内画外对白）、相邻帧重复起句，或对白结束后没有新的动作/反应/道具结果/有目的静默，必须先修复，不能进入正式制作包。

后续镜头默认使用文字状态连续性：

- `framePlan.start.source` 默认写 `independent`，不要求实际尾帧；下一镜必须逐项继承上一镜 `exitState`。
- 每个镜头的 `entryState`、`exitState` 必须写明：角色相对场景的位置、身体姿态与重心、支撑面/接触关系、视线、表情、手部、道具持有关系、服装/发型/固定配饰、场景锚点、光源方向、180 度轴线和屏幕方向。
- 位置、姿态、持有关系或轴线只有在写清“触发事件 → 移动路径/受力 → 到达位置 → 下一镜首帧状态”后才能改变；“自然调整”“新片段开始”“换机位后重新排列”“保持当前状态”“承接上一镜”都不是状态证据。
- 除第一帧外，每帧 `startPrompt` 必须原样等于上一帧 `endPrompt`；新变化只能写入本帧动作、衔接和终点。第一张公开视频卡也必须具体写出入口人物、场景锚点、支撑/接触、视线和道具状态。
- 只有用户明确要求实际尾帧，且上一镜已有当前版本并经过人工验收时，才可使用 `previous_accepted_actual_tail` 和 `inheritActualEndFrame=true`。未启用时不得伪造 alias，也不得把缺尾帧写成 blocker。

### 门禁登记表

| code                            | 级别    | 必须满足的条件                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LITERARY_SCRIPT_COMPLETENESS`  | blocker | 文学正文完整，含场次、行为、冲突推进、对白/事实和可见结果；固定 13 章齐全；目标小说章节单独标识。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `DIALOGUE_COVERAGE`             | blocker | TXT/剧本中的每条显式对白都出现在文学正文和镜头序列中，并绑定说话人、镜头、时间和表演；不得静默遗漏或擅自改写。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `FRAME_DIALOGUE_TIMING`         | blocker | 帧段边界对齐自然开口、收句、停顿、动作触发或反应留白；禁止把含对白镜头机械等分。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `DIALOGUE_CAPACITY`             | blocker | 逐句口型窗口是硬门禁：`availableSpeechSeconds=endSecond-startSecond` 必须不小于 `requiredSpeechSeconds=可发音字数/speechRateCharsPerSecond`；`pauseBeforeSeconds`/`pauseAfterSeconds` 另行占用句前/句后空间并必须留在镜头边界内。任何单句不足都阻断。10 个可发音字容差只用于整镜总量的兼容提醒，不适用于逐句口型窗口；不得异常加速。                                                                                                                                                                                                                                                                        |
| `DIALOGUE_SPEAKER_VISUAL_MATCH` | blocker | `台词`、`utterances`、口型主体和画面动作必须属于同一说话人；不允许画面写萧炎开口而台词归纳兰，或把未开口角色写成当前说话人。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `DIALOGUE_PERFORMANCE`          | blocker | 每个对白帧段写说话人、实际台词、语气、停顿、重音和具体说后反应；`画面内容`不得复制完整对白；相邻段不得重复对白游标或表演块。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `AUDIO_MIXING_HIERARCHY`        | blocker | 有台词/旁白的卡片必须明确原声实际发出、清晰可辨、音量居前且原句完整可听，并和对应说话时间/可见口型同步；环境音、动作拟音和音乐必须在语音窗口压低避让，只在停顿间隙恢复，不能盖过、吞没或替代台词。                                                                                                                                                                                                                                                                                                                                                                                                          |
| `VIDEO_PROMPT_LAYOUT`           | blocker | 正文以“开场时，……”起句，可选视觉基调和实际绑定的 `参考图片：`，随后连续写自然时间段，最后以“结束时，……”交代最终状态；可选末尾 `声音：` 只写稳定音色。时间从 00.0 连续覆盖片段时长，允许公开段数与 `framePlan.frames[]` 数量不同。禁止 `参数/公共总规范/时间轴/收尾/台词/人声/音效` 包装标题、字幕/转写、内部编号、历史上下文、未绑定 alias、URL、编辑器元数据和伪参数。角色素材绑定区对四视图仅说明一次：`每张角色资产图均展示同一个人的不同观察角度，仅参考面容、体型、服装和配饰，不继承白底、排版或图中身体投影的数量。保证人物唯一性，每个角色在世界空间中仅有一人。`不得把统一视觉合同重复追加到正文。 |
| `VIDEO_PROMPT_LENGTH`           | warning | 完整 `videoPrompt` 目标为 2000 个 Unicode 字符以内，2500 为提醒线；超出只提示压缩重复表达，不阻断交稿或视频提交，不自动截断或拆分，不能删除剧情动作、原句对白、表演、声音锚点或连续性事实。                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `VIDEO_PROMPT_SEMANTIC_QUALITY` | blocker | 直接检查公开视频卡片：画面内容必须有明确主体、进行中的可见动作、触发/因果、可见结果和声音锚点；不得出现“准备回应”“保持状态”“社会后果停在三人之间”等抽象占位或未来意图；相邻卡片必须带来可拍摄的信息增量。                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PLOT_FACT_COVERAGE`            | blocker | 当前剧情事实、人物关系、动作结果和结尾状态都在制作包中有可追溯表达；不得以泛化氛围替代事实。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ACTION_DENSITY`                | blocker | 每帧完成“谁做什么 → 触发原因 → 身体/手部/道具受力 → 可见结果 → 声音锚点”；对白结束后的时间必须有剧情职责或有目的的结果停留。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ACTION_RESULT`                 | blocker | 每个动作必须写出具体可见结果；不得只写“准备回应”“情绪加剧”“保持疑问”“关系冻结”或其它不可拍摄的意图。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ACTION_DIFFERENCE`             | blocker | 相邻帧至少有一项可验收的主体、姿态、视线、表情、重心、手部、道具、环境或摄影信息变化；不得只换形容词。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `EMOTION_PROGRESSION`           | blocker | 起点、中段、终点的可见表演、压力或关系状态有递进；克制或稳定表演须说明剧情职责与可见阶段证据，不强迫情绪升级。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `NPC_REACTION_CHANGE`           | blocker | 剧情要求的 NPC/其他角色有独立、具体且随主事件变化的反应；没有事实依据时不得凭空添加 NPC。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `NPC_ROSTER_CONTINUITY`         | warning | required 群像的数量、槽位、世界锚点、分布和状态在受影响帧段保持一致；风险必须显式记录。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `CAMERA_MOTIVATION`             | blocker | 景别、焦段、机位、轴线和主运镜服务于明确的视线、关系、空间、压力或信息揭示；连续镜头只有一条主运镜。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `CAMERA_EVENT`                  | blocker | 内部切镜声明模式、时间、类型、触发事件、新机位、切后主运镜、信息目的和承接；切点落在真实帧边界；不得隐式 Cut。启用 `dense-30s` 时默认 8—11 帧/7—10 次硬切，少切必须写减切原因；每次硬切还必须在对应公开卡片的 `镜头变化` 中写出本条内部的时间、触发、新机位、切后主运镜和新增信息，结构化连续性状态仍留在制作包字段中。                                                                                                                                                                                                                                                                                     |
| `VISUAL_CLARITY`                | blocker | 主角、关键 NPC、手部、道具接触面和场景锚点在当前景别可辨；有参考图时角色图须有身份特写和清晰四视图/转面，场景图须与项目画幅比例一致、为高清单视角全景并能读出拓扑。无图片不等于失败，但不得伪造图片绑定。                                                                                                                                                                                                                                                                                                                                                                                                   |
| `TIMELINE`                      | blocker | 每个镜头的帧段从 0 秒开始连续覆盖到镜头结束，无空白、重叠或超界。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `SHOT_DURATION_POLICY`          | blocker | 若生产方案指定 15 秒或 30 秒，每个逻辑片段严格使用该时长；内部帧段和硬切不改变逻辑片段数量和整集时长。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ASSET_BINDING`                 | blocker | 镜头只使用当前正式资产的稳定 code；场景、角色、道具、线索声明与正文和参考绑定一致；没有绑定的对象不得写入公开提示词。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `CONTINUITY`                    | blocker | 下一镜继承上一镜出口的空间位置、支撑/接触、姿态、视线、持有关系、环境和 180 度轴线；改变位置必须写触发、路径/受力和到达结果。                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `TEXT_STATE_CONTINUITY`         | blocker | 默认 `framePlan.start.source=independent`，通过文字状态连续；`entryState`、首帧 `framePlan` 和首张公开视频卡必须具体重复上一镜出口的角色位置、姿态/重心、支撑/接触、视线、道具、服装/发型/固定配饰、环境、光源和轴线；不得用抽象继承语句代替。                                                                                                                                                                                                                                                                                                                                                              |
| `CROSS_SHOT_STATE_INHERITANCE`  | blocker | 相邻镜头的入口状态必须逐项等于上一镜出口状态；发生变化时必须提供触发、路径/受力、到达结果和下一镜首帧承接证据。未显式要求实际尾帧时不得以尾帧缺失阻断；显式启用实际尾帧时才检查 `previous_accepted_actual_tail`。                                                                                                                                                                                                                                                                                                                                                                                           |
| `COMPOSITION_CONTRACT`          | blocker | 画幅先参与构图；9:16 优先单人/双人/过肩/纵深并保留头顶、下巴、衣领和关键手部，16:9 保留横向主体层级；不得遮脸或把人物缩成不可辨识的小人。                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `SUBJECT_COVERAGE`              | blocker | 每个时间段明确主要主体和可见范围；剧情中需要独立呈现的角色、NPC 反应、手部或道具受力必须有独立信息。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `CUT_INFORMATION_DIVERSITY`     | blocker | 每次硬切带来新的角色关系、表演、空间、手部、道具或结果信息；7—10 次硬切不能只是同一角色的多个角度。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `REFERENCE_ALIAS_CONSISTENCY`   | blocker | 严格沿用 `referenceManifest` 的 alias、role、purpose 和顺序；禁止“@图片1至@图片N”、URL、assetId 或擅自重新编号。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `CHARACTER_WARDROBE_CONTINUITY` | blocker | 出镜角色持续锁定身份、年龄感、脸型/发型、服装结构、颜色和固定配饰；角色图与场景图职责不能互换。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `JSON_MARKDOWN_CONSISTENCY`     | blocker | 第十一章公开 `videoPrompt`、规范对象中的同一字段和第十三章 QC 结论必须来自同一轮 authoring，原文一致，不得一处为空或另行改写。                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `PROVENANCE`                    | blocker | 记录模板、TXT/剧情源、参考素材、契约、实际使用的导演 Skill、Seedance 2.5 提示词适配规范、Seedance Skill 的版本/内容哈希和生成时间；这些是来源审计信息，不是独立包导入的 Skill 白名单。                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `PACKAGE_SCHEMA`                | blocker | JSON 只能使用当前契约字段；`episodes[].code`、`shots[].code`、`duration`、`timecode`、完整 `productionPlan` 和数组型 `authoring.materials` 必须存在；出现 `episodeId`、`shotId`、`shotDuration` 或服务端运行字段立即阻断，不得静默别名转换。                                                                                                                                                                                                                                                                                                                                                                |
| `PRODUCTION_PLAN_COMPLETENESS`  | blocker | `project.productionBible.productionPlan` 必须是完整对象，包含视频时长、内部切镜策略、帧策略、技能、视觉、参考、连续性和来源；不能让运行时默认值掩盖缺失生产方案。                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `LOGICAL_SHOT_COUNT`            | blocker | 先冻结 `logicalShotCount`、`shotDuration`、`targetDuration`、对白容量计划和剧情节拍计划；实际逻辑片段数与锁定值一致，`targetDuration=logicalShotCount×shotDuration`，内部帧段/硬切不得改变三者。                                                                                                                                                                                                                                                                                                                                                                                                            |
| `LOGICAL_SHOT_ECONOMY`          | blocker | 每个逻辑片段必须有独立剧情职责、关系变化、动作结果或场景信息；只把同一对白切成前半/后半、只换景别或为了凑 7—10 次硬切而新增的片段必须合并并阻断。                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### 独立生成结束条件

- 先按完整剧情、对白自然时长、动作节拍和反应留白确定逻辑片段数量，再为每个片段使用 15 秒或 30 秒配置；内部帧段和硬切不改变逻辑片段数量或整集时长。
- 普通镜头按真实可见事件决定帧数；只有用户或项目明确 `internalCutPolicy=dense-30s` 时，30 秒逻辑片段才执行 8—11 个帧段、7—10 次 `type=硬切`。若需少切，原因、实际帧/切数量和修订状态只记录于结构化 QC，不写入 `videoPrompt`。
- 完成“生成 → 逐镜自检 → 只修失败镜头 → 再自检”后，才可标记为可直接使用；warning 必须保留在 QC 中，不能改写成通过。
- 只有全部 blocker 门禁均为 `passed`，且每项都有镜头/帧证据和修订范围，才能写 `qualityGateStatus=passed`；任何 blocker 缺失、失败、待检查或证据不足都必须阻断交付。实际尾帧仅在本轮显式启用时才属于 blocker。
- 外部 Codex 不得返回半成品、待服务端补齐、待内部 Agent 重建、只含镜头摘要、只含完整对白或只有 JSON 而缺少 13 章正文的结果。
- 只有协议损坏或多镜头事实冲突才允许一次完整 `package` 修订；第二次失败直接结束，不切换候选渠道、不重复提交整包。

### 反模板化自检硬禁项

以下内容不得作为合格的视频提示词交付：

- “准备回应”“准备进入下一条件”“保持状态”“关系停在压力面”“为下一镜承接”等未来意图或内部剪辑说明；
- 只有“说话、看向对方、保持站位、情绪加剧”等抽象情绪，没有身体、手部、道具、视线、重心或环境的可见变化；
- 通过重复完整场景/光影/色调段落填充长度；
- 出现 `undefined`、`null`、`NaN`、`[object Object]` 或 `palette=.../saturation=.../film_stock=.../grain=.../halation=...` 伪参数串；
- 只改变焦段、景别、机位或形容词，却没有新的角色反应、动作结果、道具受力、空间信息或声音变化；
- 只有抽象情绪而没有可见动作、结果或声音锚点；完整对白必须在对应自然时间段出现一次，不得重复粘贴为画面指令；
- 长时间站桩说话，或对白结束后没有具体反应、结果、环境变化或有目的的静默；
- 没有“主体 → 触发 → 可见动作 → 可见结果 → 声音锚点”闭环的镜头卡。
- `dense-30s` 的真实切镜在公开正文中没有独立换行的 `Cut to：`，或切后帧的 `transitionPrompt` 缺少对应事件证据。
- 一个逻辑片段的硬切全部复用相同景别、焦段、机位和主运镜，只更换形容词或“继续说话/看向对方”的，直接判定 `CAMERA_EVENT` 与 `CUT_INFORMATION_DIVERSITY` 失败；
- 相邻镜头没有逐项写出入口状态，或用“承接上一镜”等抽象短语代替位置、接触、视线、道具、光源和轴线事实。

Codex 必须在输出第十三章前逐镜抽查上述禁项；命中任一项时只修复命中的镜头和必要相邻连续性，不得重新创作未失败镜头。

## 一、项目总览

- 集名：《集名》
- 小说章节：《章节名》
- 类型：
- 核心冲突：
- 本集情绪：
- 情绪曲线：
- 色彩叙事：
- 视觉风格：
- 叙事主题：

### 编剧结构卡

- 系列宏观结构：
- 本集结构：
- 四幕：
- 本集戏剧问题：
- 本集回答：
- 结尾新问题：
- 角色目标与需求：
- 关系弧：

### 画幅构图与清晰度导演规则

- 当前项目画幅与安全区：按锁定生产方案填写，不把本标题当作强制比例值。
- 9:16 优先单人/双人、过肩和纵向深度；16:9 优先横向空间、多人关系和群像定场。不能把横屏站位只替换比例后复用。
- 所有可见主角、关键 NPC、剧情道具和场景锚点在当前景别下清晰可辨；只有明确要求时才使用背影、虚焦或浅景深。
- 每个 `framePlan` 时间段必须明确本段主要主体和主体可见范围；9:16 近景/中近景/特写必须保留完整头顶、下巴、主要衣领和关键手部，并声明防裁脸、防前景遮脸安全区；三人以上只用于建立空间或结果全景，并写出前中后景/上下纵深。16:9 可以承载横向群像，但必须写清主体层级。
- 每次内部硬切必须改变信息主体或动作细节；剧情事实中出现需要独立呈现的角色、NPC反应或手部/道具受力时，必须分别提供对应独立反应或细节镜头，不能让所有硬切都只拍同一个角色。
- `framePlan.referenceManifest` 是公开 alias、执行快照和供应商顺序的唯一事实源；素材绑定必须逐项写出 `@图片N` 与角色/场景/道具职责，禁止使用“@图片1至@图片N”代替映射。角色镜头必须保留服装、发型、年龄感和固定配饰锚点。
- 两条轴必须分开填写和校验：**逻辑片段轴**使用 `shots`、`shotDuration` 和整集总时长，先完整读取 TXT/剧本，按剧情节拍、对白自然时长与反应留白确定片段数量，再让每个片段使用配置时长；**片段内部剪辑密度轴**使用 `framePlan.frames`、镜头事件和内部硬切，只描述当前逻辑片段内部的可见状态变化。内部帧段或硬切数量绝不能新增、删除或改变逻辑片段，也不能改变整集总时长。若当前生产方案明确要求 `30秒高密度硬切`，必须使用 `internalCutPolicy=dense-30s`，每个30秒片段默认提供8—11个帧段承载7—10次硬切；不得用 `adaptive` 或3—4帧静默降级。

## 二、原创第一章

### 第一章：章节名

连续文学正文。

## 三、第一集文学剧本

### 基础设定

- 每个逻辑片段时长：按当前生产方案填写；整集总时长由完整 TXT/剧本拆解出的逻辑片段数量计算，不得预先指定总秒数来压缩或扩写剧情。
- 表演方法：

### 场 1｜场景标题｜时间｜时间码

场景正文。

## 四、镜头执行表

| 镜号 |           时间 | 阶段 | 景别 | 运镜 | 焦段 | 灯光 | 色彩 | 转场 | 动作描述 | end_state |
| ---- | -------------: | ---- | ---- | ---- | ---- | ---- | ---- | ---- | -------- | --------- |
| SH01 | 按镜头时长填写 |      |      |      |      |      |      |      |          |           |

### 镜头 JSON 必备职责

每个镜头的规范对象必须同时包含：

- `performancePlan`
- `dialoguePerformance`（无对白时使用空数组）
- `lightingPlan`
- `continuity`
- `entryState`
- `exitState`
- `videoPrompt`
- `framePlan`

镜头对象还必须明确 `dramaticFunction`、`characterCodes`、`locationCode`、`propCodes`、`clueCodes`、`cameraMotion`、`lens`、`lighting`、`colorPalette` 和 `transitionOut` 等当前镜头事实；没有实际资产或场景事实时不得填写占位对象。

`videoPrompt` 由 Agent 直接生成完整公开内容；`framePlan.frames` 是同一视频内容的结构化镜像，不是服务端重建 `videoPrompt` 的素材。

Codex authoring 不能使用固定脚本或直接复制模板正文冒充生成结果。外部 Codex 必须自行完成规范对象所需字段和门禁自检；项目导入层只读检查结构与事实，将质量问题集中提醒并允许导入；不得补写对白、追加混音说明或重建公开视频正文。相邻动作差异、情绪递进、NPC 反应变化、运镜动机和镜头事件缺一项都不得标记为可生产。

### 逐帧字段职责

`framePlan.frames[]` 只保留以下字段：

```text
id
sequenceIndex
startSecond
endSecond
startPrompt
actionPrompt
transitionPrompt
endPrompt
imagePrompt
```

其中 `startPrompt`、`actionPrompt`、`transitionPrompt`、`endPrompt` 服务视频时间段；`imagePrompt` 只服务当前冻结的静态画面。每帧从 0 秒连续覆盖当前镜头时长，不能有空白或重叠。

`framePlan.start.source` 只能是 `independent` 或 `previous_accepted_actual_tail`，默认必须使用 `independent` 并由文字状态锁定连续性；`framePlan.end.required` 必须是布尔值。`framePlan.referenceManifest` 是参考图职责和顺序的唯一事实源，必须与当前镜头声明的角色、场景、道具和线索绑定；每张参考图只承担一个用途，不把 URL、内部 ID 或绑定信息写入图片正文。`framePolicy` 为 `agent` 时先识别当前逻辑片段内真实镜头事件，再按不可合并的冻结可见状态自适应提供 2–11 帧；不能把帧数当作逻辑片段数。若生产方案的 `internalCutPolicy` 为 `dense-30s`，则每个30秒逻辑片段必须使用8–11个帧段承载7–10次实际 `type=硬切`，切点对齐帧段边界；少切例外须在结构化 QC 写清原因、实际帧/切数和修订状态，不写入公开视频。内部硬切数量不改变整集逻辑片段数量和总时长。

### 视频时间段字段说明

本模板只说明字段位置，不复制门禁实现。NPC 语法、对白表演、镜头模式、内部切镜、帧承接、素材绑定和其它硬门禁统一以本模板的门禁登记表、`docs/drama-production-package-v1.md` 的版本化契约和编译后的导演 Skill 为准；模板内容不能覆盖或放宽这些规则。

### 静态图片帧规则

`imagePrompt` 作为唯一静态画面事实源；按事实选择画面主体、可见状态、构图与空间、光色与风格、针对性约束五类短段，缺少事实的段落省略，不强制九段。完整规则由当前编译的 `drama-video-director` Skill 提供，项目导入器只做结构安全检查并保留 Codex 原文。

## 五、角色一致性资产

### 5.1 角色名｜C01｜全量角色卡 Prompt

固定音色提示词：依据该角色创作稳定、可区分的声音身份；与 JSON 的 `assets.characters[].voiceProfile.timbrePrompt` 保持原文一致。例：年轻成年女性，中高音区，清亮温润，轻微气声，普通话自然清晰；情绪变化时保持同一声线。示例只说明字段，不直接套用到所有角色。角色已绑定音频时，视频实际提交优先引用音频；没有音频时使用此提示词。台词情绪、停顿和重音另写表演指令，不修改原句或时间窗口。外部 JSON 只填写音色文本，不编造音频地址、声纹或服务器存储键。

```text
角色一致性 Prompt。
```

角色资产必须保留项目正式资产目录中的稳定 code、身份、轮廓、材质和基准图状态；本集不出镜的已登记角色也要在资产表中说明不出镜，不进入本集镜头参考绑定。

## 六、场景一致性资产

### 6.1 场景名｜S01｜场景 Prompt

```text
场景一致性 Prompt。
```

场景全景基准图必须按用户提供或当前项目配置的画幅比例生成，并与成片比例一致；按该比例重新组织构图，形成高清、单视角、无人、无文字的空间建立图，不得擅自固定为 `16:9`。优先呈现可信空间尺度、透视、重量、接触阴影、材质粗糙度和有依据的细微纹理，不把“超写实”当作细节描述，也不虚构磨损或结构。`backgroundNpcPolicy` 只表达场景策略；`required` 场景填写 `countRange`。跨镜头群像可以声明稳定 `roster` 槽位，每个槽位绑定世界空间锚点和稳定变体；背景 NPC 需要出现在镜头时，按槽位及其可见状态写入每个受影响关键帧或视频时间段的群像结果，不进入角色资产编码。

## 七、关键视频资产 Prompt

### V01｜首帧：标题

```text
关键视频资产 Prompt。
```

参考图职责、参考图顺序和资产绑定不写入静态图片正文，统一保存到 `framePlan.referenceManifest`，供后续实际执行读取。

## 八、全案板 Prompt

### 全案板 1/1｜SH01-SH01

```text
全案板 Prompt。
```

全案板用于检查人物、场景、道具、画面关系和镜头变化，不替代逐帧 `imagePrompt` 或镜头级 `videoPrompt`。

## 九、台词与表演脚本

### 角色台词基调

- 角色名：声音与表演基调。

### 台词序列

| ID  | 镜号 | 说话人 | 台词   | 表演与节奏     | 口型 |
| --- | ---- | ------ | ------ | -------------- | ---- |
| D01 | SH01 | 角色名 | “台词” | 按逐句时序填写 | 是   |

含对白镜头必须在规范对象中逐句记录相对镜头的开始、结束、前后停顿和语速，并在 authoring 前完成逐句对白容量表：`availableSpeechSeconds = endSecond - startSecond`；`requiredSpeechSeconds = 可发音字数 / speechRateCharsPerSecond`；`pauseBeforeSeconds` 与 `pauseAfterSeconds` 另行占用句前/句后空间并必须留在镜头边界内。任何一句 `availableSpeechSeconds < requiredSpeechSeconds` 都不得完成正式 authoring、制作包导入或生产前预检；必须移动帧段边界、拆自然分句/说话人转换/动作反应或增加逻辑片段。10 个可发音字容差只用于整镜总量的兼容提醒，不适用于逐句口型窗口；不得异常加速。公开 `videoPrompt` 在实际说话时间段写出说话人和完整原句一次，同时描述可见口型、呼吸、视线和反应；这些内容不写入静态图片正文。

对白/旁白必须作为可听见的声音实际发出，并在自然时间段写清原声清晰居前、语气/节奏和呼吸表演。环境音、动作拟音和音乐在对白/旁白实际发声窗口压低避让，只能在语音停顿间隙恢复。稳定角色音色只写入可选的末尾 `声音：` 句；提示词不含字幕、台词转写、对白字卡或画面文字叠加指令。

### 沉默设计

- SH01：静默说明。

## 十、声音设计

### 旁白声音身份与逐句讲述

- 叙述旁白须单独确定并贯穿全书的声音身份，遵循用户指定的性别与声音偏好，写清年龄感、音区、共鸣、质感、气息和口音。当前项目选择女声时，可写“成年女声，中音偏低，口腔聚焦、胸腔共鸣柔和，温润微绒，气息细稳，标准普通话”；这不是所有项目的默认性别。
- 使用既有 `archive.voiceDirections` 登记原旁白说话人与稳定音色，并在 `project.productionBible.soundBible` 记录统一讲述规则；不新增故事人物或正式 JSON 字段。每条含旁白的独立 `videoPrompt` 只写一次完整音色，在真实参考图片清单之后、首个动作或时间段之前；无旁白镜头省略。
- 每句旁白按原句语义设计情绪、轻重、停连和收句：回望、事实核对、犹疑、承认责任与结尾留白分别处理，不能只写“自然语速、旁白连续”，也不统一煽情。将具体表演自然地融入该句实际发声窗口，并同步第九章与 `archive.dialogueDirections[].performance`；稳定音色与单句情绪分开。
- 保留原句、原说话人、出现顺序与次数及既定发声时间；停连必须在原窗口容量内完成，不新增长停顿、赶字或延长收句。叙述旁白在画外讲述，画中人物不配旁白口型；角色本人心理旁白沿用该角色声线，场内画外对白仍属于原角色，不改成统一女旁白。
- 没有已确认旁白音频时只写固定音色文本；有真实可用的同一旁白音频时才引用，不伪造音频地址、alias 或 voiceId。第十章、逐句表演、第十一章和 JSON 保持一致，第十三章记录覆盖镜头、声音窗口、长度及实际检查范围。

| 镜号 | 环境音 | 拟音 | 音乐 |
| ---- | ------ | ---- | ---- |
| SH01 |        |      |      |

对白/旁白优先于非语言声音：逐镜混音必须让实际原句清晰可辨并处于前景，环境音、动作拟音和音乐在语音窗口压低避让，只在停顿间隙恢复。声音字段服务视频和声音执行，不复制到 `imagePrompt`。

## 十一、分段视频 Prompt

### P01｜SH01｜按真实时间段填写

```text
开场时，……
可选的一段视觉基调。
参考图片：仅列本镜真实绑定；如含角色参考图，在绑定区写一次四视图唯一性约束。
00.0–……秒，……
Cut to：……（仅有内部硬切时使用，并与切后帧 transitionPrompt 对齐）
……–……秒，……
结束时，……
声音：……（可选，仅写稳定人声身份。）
```

公开 `videoPrompt` 使用 Seedance 2.5 自然段格式，是可独立提交的完整视频输入。标准顺序为：开场句 → 可选视觉基调段 → 本次实际绑定的参考图片清单 → 连续时间段 → 结束句 → 可选稳定音色句。参考图片与声音句由实际素材和角色音色决定，没有对应内容时省略。

```text
开场时，阿泽沿柏油路从画面左侧走向成都318零公里路牌下的长椅，左腕旧黑手绳露出；椅面有五只纸盒，越野车停在右侧。晨光从道路左侧照亮人物和纸面，晨雾只留在背景。

真实摄影机现场电影质感，保留自然肤色、纸张纤维和布料重量。

参考图片：
@图片1：场景「成都318零公里」
@图片2：角色「阿泽」
@图片3：角色「苏晚」
@图片4：角色「老杨」
@图片5：角色「许棠」
@图片6：角色「小林」
@图片7：道具「五人延迟寄送纸盒包裹」
@图片8：道具「成都至拉萨古地图」
@图片9：道具「五人同班次车票」
@图片10：道具「林澈教过的黑绳结」
@图片11：道具「阿泽旧黑手绳」
以上规则分别适用于每位角色，不跨角色合并理解：每张角色资产图均展示同一个人的不同观察角度，仅参考面容、体型、服装和配饰，不继承白底、排版或图中身体投影的数量。保证人物唯一性，每个角色在世界空间中仅有一人。

00.0–04.0秒，道路侧固定全景，阿泽走到椅左前，袖口随步伐退开露出旧黑手绳；苏晚从椅右端靠近，看清绳结后停步，双脚稳稳落地。鞋底压过柏油，衣袖擦过手腕。
Cut to：椅前双人中景，苏晚指尖指向纸盒，阿泽站在椅左前。
04.0–08.0秒，苏晚问：“你也收到这个？”阿泽抬眼回答：“看来不止我一个。”半秒停顿中两人互看，远车声压低，近处对白清晰。
Cut to：道路侧中全景，车后通道通向车头，长椅和越野车仍在原位。
08.0–12.0秒，老杨、许棠和小林沿通道走到车头；五人各自把一个纸盒放到地面后才松手，小林蹲下撕开纸壳，裂口露出旧物。
Cut to：小林右侧手脸近景，车票和地图落在纸壳上。
12.0–16.0秒，小林右手托起旧电池，拇指停在接点后抬眼说：“这东西……我四年前见过。”迟疑后吸气，纸片轻擦。
Cut to：车头右侧许棠正侧近景，晨光落在湿黑绳纤维上。
16.0–20.0秒，许棠双手提起黑绳，指腹捏住结扣，认出后嘴角收紧、目光仍落在绳结上，说：“林澈教过我们这个结。”
Cut to：道路侧俯视手部，五块地图碎片在纸壳上拼合。
20.0–24.0秒，五只手依次把地图碎片推齐；苏晚右指沿路线划过九个银灰标记，停在末端，说：“三千国道，九道关卡。”矿物线只反射晨光。
Cut to：纸壳左缘老杨中近景，阿泽的右手伸向最后一张纸。
24.0–27.0秒，老杨蹲在阿泽对面读完字条，垂眼说：“至拉萨，可得解脱。”阿泽的手指接触最后一张纸。
Cut to：阿泽肩侧俯视手部特写，旧手绳贴住纸边。
27.0–30.0秒，阿泽翻到纸背，看见已有笔迹后指尖停住；其余四人的手退出纸面，纸张翻动后他短吸气。
结束时，五人围在车头前，地图留在地面纸壳上；阿泽握翻面的字条，许棠握黑绳，小林持旧电池，所有人脚底支撑和物件持有关系完整。
声音：阿泽成年男性中低音、胸腔共鸣、干燥克制；苏晚成年女性中音、清晰偏冷；老杨成年男性低音粗粝、尾音短；许棠成年女性中低音结实直接；小林成年男性中高音偏薄但有支撑，惊惧时音色轻颤而不变声。
```

开场与结束都用完整自然句。视觉基调仅在开场后按需写一次；禁止提示词编译、生成或导入时再追加一段统一视觉合同。时间段从 `00.0` 连续覆盖整个逻辑片段，写清主体动作、触发、可见结果、摄影选择、表演、原句对白和局部声音。完整对白在实际发声时间段逐字保留一次；对白清晰居前，发声期间环境音和拟音压低避让。心理/记忆旁白写为“角色（心理旁白）：“原句””，不要求画面角色开口。

角色参考图只在 `参考图片：` 下按真实绑定顺序列出；引用角色图时，唯一性约束只附在该绑定清单中一次，不能在公共段落或时间轴重复。场景图、道具图不套用角色四视图规则。没有绑定的素材不得伪造 `@图片` 编号。

每个 `Cut to：` 必须独立换行。时间、切换类型、已发生的触发、新机位、切后运镜、观众新增信息及动作/轴线承接写入切后帧的 `framePlan.frames[].transitionPrompt`；公开视频只呈现观众看到的变化，不出现机器事件字段或 QC 说明。公开视频中的 Cut 数量必须与内部事件证据一致。只有显式锁定 `dense-30s` 时执行 8—11 个内部帧段和 7—10 次实际硬切；少切例外以结构化 QC 记录原因、实际数量与修订状态。

时间段可以覆盖一个或多个连续内部帧，不要求公开段数量等于 `framePlan.frames[]` 数量。移动须写清触发、路径/受力和到达位置；没有移动时写明站位、支撑、接触和持物关系如何保持。提示词不得引用其他镜头、上一/下一片段、历史提示词、上下文、资产 ID、内部别名或 URL，也不得包含字幕/转写、对白字卡、内部字段、画幅/时长参数或其他包装标题。稳定声音要求只能放在可选的最后 `声音：` 句中。

JSON 外层字段维护时长、画幅、任务目标、参考绑定和 QC；不得把这些字段标签复制进公开视频正文。模板示例仅示范结构，具体镜头必须依据本轮剧情、资产与参考素材创作，并遵循顶部 Seedance 2.5 正文与长度规范。

## 十二、资产映射与执行顺序

### 当前存在性

- 实际图片资产：按当前项目填写。

### 参考图映射

| 优先级 | 资产       | 用途     | 计划类型          | 建议引用段     |
| -----: | ---------- | -------- | ----------------- | -------------- |
|      1 | C01 角色卡 | 锁定角色 | consistency_asset | 按实际镜头填写 |

### 生成顺序

1. 核对当前项目正式资产及本集使用范围。
2. 生成角色、场景和道具一致性资产。
3. 生成镜头关键帧与视频。
4. 完成连续性、画面、对白、音画和供应商能力 QC。

## 十三、QC 报告

### Prompt QC

- 规范对象可解析：`passed`；证据：`drama-production-package` JSON 已解析。
- 固定 13 章完整且顺序正确：`passed`；证据：章节清单与正文目录。
- 静态帧唯一事实源：`passed`；证据：逐帧 `imagePrompt` 与 `framePlan`。
- 视频卡具备主体、触发、可见动作、结果、摄影目的和声音锚点：`passed`；证据：第十一章逐卡抽检镜号/帧号。
- 公开视频/QC 字段边界、反模板禁项、对白时间、连续性和硬切信息差异：`passed`；证据：第十一章不含 QC 文案且与 JSON 正文一致，并列出镜号/帧号及局部修订范围；存在任何 blocker 时不得输出制作包。
- 所有 blocker 门禁：逐项 `passed`；warning 只能用于非阻断建议并逐项保留，不能替代 blocker 通过。
- `qualityGateStatus`：仅当所有 blocker 已通过、所有对白边界已对齐、每张卡有动作结果/声音锚点、相邻状态已继承、硬切事件有公开承接、JSON 与第十一章原文一致时写 `passed`。

### 全部门禁 QC 表

必须逐项列出门禁登记表中的全部 `code`，每项填写 `status=passed|warning`、证据镜号/帧号、实际修订范围和备注；门禁登记表中标记为 blocker 的项目只能填写 `passed`，不能填写 `warning`；不得省略门禁代码，不得出现 `blocker`、“待检查”或“待服务端检查”。嵌入 JSON 的 `authoring.qualityGateReport` 使用契约字段：报告顶层 `status` 只能是 `passed|blocked`，每个 `checks[]` 使用 `code`、`status=passed|warning|blocked`、`severity=blocker|warning`、`scope`、`evidence`、`sourceRefs`、`fixHint` 及可选修订范围字段；`status` 表示本项结果，`severity` 只表示门禁级别，不能把 `passed` 写进 `severity`。报告顶层为 `passed` 时不得存在 `status=blocked`；`severity=blocker` 且 `status=passed` 是合法的“阻断级门禁已通过”。

### 视频评分

| 维度 |           分数 | 结论     |
| ---- | -------------: | -------- |
| 总分 | 按本轮自检填写 | `passed` |

### 最终视频 QC

- 结构与 authoring 自检状态：`qualityGateStatus=passed`。
- 可生产结论：`passed`；若存在 blocker，不得输出该制作包。
