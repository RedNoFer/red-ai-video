# VOZEB 短剧完整制作包 v1

固定格式标识：`vozeb-drama-production-package-v1`。

下载模板源文件为 `docs/drama-production-package-v1-template.md`，由 `pnpm compile:skills` 根据当前 Skill 和本规范自动生成到 `web/public/drama-production-package-v1-template.md`；不要直接编辑生成文件。

以后由 Codex、项目 Agent 或人工编写的完整制作包，都必须保持以下一级章节、表头和编号规则。13 章是 v1 的固定制作包结构，不因项目、集数或对话内容改变。多集项目在一个总包中仍只保留一套固定一级章节，但每一集必须在规范对象中拥有完整且自洽的剧本、场次、镜头、资产引用、表演、声音、连续性、逐帧计划和 QC 数据；按单集生成或导入时，该单集制作包也必须完整保留全部 13 章，不得只输出镜头表或局部字段。允许扩写正文，不允许改名、换序或省略必填章节。没有内容时保留章节并明确写“无”。

正式 Agent 制作包生成入口只有项目服务端的 `executeDramaScriptRun`。该入口把用户本轮模板、TXT/小说和参考素材作为正式 authoring input 交给项目 GPT：模板只决定格式/章节，TXT/小说只提供剧情事实。固定脚本、历史制作包、旧 generationPrompt 或直接读取模板复制正文不得作为制作包生成器。Agent 返回 authoring draft 后，服务端先执行事实与质量门禁，再从规范对象确定性导出最终 JSON/Markdown；最终对象必须记录 `authoring.source`、导演 Skill 与 Seedance 2.5 Skill 的版本/内容哈希，以及各 authoring 素材的 alias、role、顺序和内容哈希。

## 版本化契约块

```yaml
contract:
  id: vozeb-drama-production-package-v1
  version: 1.0.0
  targetNarrativeChapter: 当前 TXT/小说的目标章节标识；它不是制作包一级章节编号
  authoringProviders:
    - project-gpt
    - codex-work-order
  finalizer: executeDramaScriptRun
  externalWorkOrder:
    trigger: user-confirmed-project-gpt-timeout
    output: authoring-draft-only
    reentry: executeDramaScriptRun
  draft:
    mode: package
    fields: [reply, markdown]
  sourceRoles:
    - package-template
    - story-source
    - reference
  hardGateCodes:
    - LITERARY_SCRIPT_COMPLETENESS
    - DIALOGUE_COVERAGE
    - DIALOGUE_PERFORMANCE
    - PLOT_FACT_COVERAGE
    - ACTION_DENSITY
    - ACTION_DIFFERENCE
    - EMOTION_PROGRESSION
    - NPC_REACTION_CHANGE
    - CAMERA_MOTIVATION
    - CAMERA_EVENT
    - TIMELINE
    - ASSET_BINDING
    - CONTINUITY
    - PROVENANCE
```

## 外部 Codex 工作单协议

- 触发条件：项目 GPT 已明确超时、运行已进入失败终态，且用户主动确认切换；不得自动并发调用外部模型。
- 工作单输入：当前用户请求、模板全文（`role=package-template`）、TXT/小说全文（`role=story-source`）、参考素材职责、当前项目正式资产、当前集事实、目标小说章节、锁定生产方案，以及本契约和两个 Skill 的版本/内容哈希。
- 草案输出：只能返回 `{ "mode": "package", "reply": "...", "markdown": "..." }`；Codex 不得直接导入、修改当前集或声明已生成正式制作包。
- 回传校验：服务端重新核对 `runId`、`workOrderId`、用户身份、source alias/role/顺序/contentHash、契约哈希和两个 Skill 哈希；任一不一致直接拒绝。
- 最终入口：草案回传后仍调用 `executeDramaScriptRun`，使用同一份门禁、规范对象和确定性序列化；最终 provenance 的 `provider` 才标记为 `codex-work-order`。

本文件是制作包契约唯一规范源。`drama-production-package-v1-template.md` 只提供字段、章节和展示骨架；Skill、服务端门禁、Codex 工作单和运行时规则由本契约及编译产物提供，模板中的文字不能降低门禁。契约内容哈希由编译脚本生成并写入运行时与模板。

## Agent 运行时规则

- 制作包只能由 `executeDramaScriptRun` 组织；Agent 必须在返回 `mode=package` 草案前完成一次内部导演自检，逐镜补齐具体的表演、对白、动作、NPC、运镜、镜头事件和实际场景细节。草案若未通过门禁，执行器必须把具体失败项作为当前 authoring revision feedback 回传同一生成渠道，要求返回完整修订草案；未通过的中间草案不得展示给用户、写入当前集或进入导入流程。只有通过门禁的草案才从规范对象确定性序列化 JSON/Markdown。
- `package-template` 只规定 13 个一级章节、字段顺序和字段职责；`story-source` 只规定当前目标小说章节的剧情事实；`reference` 只规定素材职责。三类 authoring source 必须保留 alias、role、顺序和内容哈希。
- 目标小说章节使用 `targetNarrativeChapter` 单独记录；它是剧情素材范围，不得与制作包一级章节编号混用。当前集必须提供完整文学剧本、场次、镜头和可执行结果，不能只返回摘要或镜头概述。
- 镜头规范对象必须分别填写 `dramaticFunction`、`performancePlan`、`lightingPlan`、`continuity`、`entryState`、`exitState`、`videoPrompt` 和 `framePlan`；`framePlan.start.source`、`framePlan.end.required`、`framePlan.referenceManifest`、每个帧段的 `imagePrompt` 及其时间/动作/静态状态必须可校验。
- Agent authoring draft 在规范化前必须逐镜提交完整原始字段：不得依赖服务端默认值补齐 `performancePlan`、`lightingPlan`、`continuity`、`entryState`、`exitState`、`imagePrompt`、`videoPrompt` 或帧段正文。`performancePlan` 的六个标量和 start/middle/end 四项表演、`lightingPlan` 的十个字段、`continuity` 的十个字段以及 `dramaticFunction`、`cameraMotion`、`lens` 均为严格生成字段；缺失、空值或占位语必须在 Agent 草案阶段阻断。
- 每个 Agent 帧段必须直接提供 `actionPrompt`、`transitionPrompt`、`endPrompt`、`imagePrompt`；除第一帧外 `startPrompt` 必须原样承接上一帧 `endPrompt`。第一帧不要求虚构 `startPrompt`，但视频 Prompt 必须逐段镜像真实字段，不能靠服务端从其它字段拼接。
- `SEC01`—`SEC13` 只允许出现在 `archive.sections`；任何章节对象混入 `episodes[].shots` 都是伪镜头。兼容导入可以忽略并给出二次确认警告，Agent 严格生成和正式剧本导入必须阻断。
- 场景的 `backgroundNpcPolicy` 只描述无名背景群像；背景 NPC 不进入 characterCodes。required 场景的数量、前中后景分布和可见反应必须落到受影响的关键帧或视频时间段。
- `videoPrompt` 和 `framePlan` 都由 Agent 直接生成；应用层不得从模板、旧包、历史提示词、动作字段或帧计划重建、补写、删改公开视频正文。未经声明的内部切镜、未绑定道具或未声明角色不得出现。
- Agent authoring draft 的硬门禁代码来自版本化契约；至少包括文学剧本完整性、对白覆盖率、对白表演质量、剧情事实覆盖率、动作密度/差异、情绪递进、NPC 反应变化、运镜动机、镜头事件、时间轴、素材绑定、连续性和 provenance。任一 blocker 都必须先进入 authoring revision，不得把失败草案标记完成或写入正式制作包。

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
- 每个镜头的完整公开 `videoPrompt` 必须由 Agent 直接生成：除动态意图、主运镜、环境/声音母题和结束状态外，还必须直接写出每个真实时间段的时间范围、起点、动作与触发、可见衔接和终点。`framePlan.frames` 只保存同一内容的结构化镜像，运行时和第十一章不得从它拼接或改写 `videoPrompt`。
- Agent authoring draft 进入最终序列化前必须通过严格质量门禁：相邻时间段有真实动作差异，起始/中段/结束形成情绪递进，required NPC 反应随主事件发生变化，主运镜有具体可见动机，内部切镜具备完整“镜头事件”并与 framePlan 边界一致；有对白的每个时间段必须绑定当前说话人、具体语气/停顿/重音/说后反应，相邻段不得复制同一表演块，对白结束段必须写具体静默或反应结果。门禁用于生成阶段的内部返工，不得让用户先收到半成品再在导入时失败；手工或历史包导入仍按兼容门禁处理，但不得伪装成 Agent 正式生成结果。
- 公开视频 Prompt 的公开字段固定按“素材绑定（有素材时）→ 动态意图 → 全局设定 → 起始可见状态 → 时间段动作 → 单一主运镜 → 环境压力与视觉母题 → 视觉风格与光色 → 声音意图 → 结束画面 → 连续性锁 → 针对性约束”排列；不再使用顶层“触发”或“主体动作与反应”，准备、触发、接触/受力、结果、恢复和主体反应统一写入每个时间段内部的“动作与触发”。
- `单一主运镜` 必须先声明“镜头模式：连续镜头”或“镜头模式：内部切镜（N次）”。多帧或多个时间段不自动等于切镜；连续镜头只允许一个连续主运镜，内部切镜必须在对应“可见衔接”中写出带时间、类型、触发事件、新机位、信息目的和承接的“镜头事件”，且时间必须落在 framePlan 段起点。机位/景别、固定/运动方式、方向或起止关系及唯一可见目的仍需写清；“中轴推进”“电影感”等单独短语不算可执行机位。`素材绑定`、`propCodes` 与正文道具事实必须一致：没有绑定的道具不能写入环境母题、动作、结果或结尾。
- 镜头级 `imagePrompt`、`startFramePrompt` 和 `endFramePrompt` 只描述单一静态画面，包含主体身份、当前可见姿态/表情/视线、道具或环境状态、景别、构图、光线与必要约束；不得写运镜、焦段、时间段、动作过程、对白或声音。生成前必须先由场景资产推演可用座位、长凳、地面、通道、门窗、隔断与遮挡；人物的姿态必须有合理支撑，人与物接触、动作路径及多人关系必须符合该空间，不能为突出人物把其摆在不合场景常理的位置，也不得新增原文或资产未声明的人物。图片编辑请求统一使用 `change / preserve / constraints`，其中 `change` 每次只允许一个已定位变量。
- 场景资产可配置 `backgroundNpcPolicy`：`auto` 由 Agent 按场景类型、空间容量、景别和剧情功能判断，`required` 必须安排合理数量、位置、密度和行为的无名背景 NPC，`forbidden` 禁止 NPC。`required` 场景应声明 `countRange: { min, max }`，每个受事件影响的关键帧/视频时间段必须使用 `NPC群像：N名；分布：前景X名、中景Y名、后景Z名；密度：具体密度；反应：具体可见反应`，并满足 `X+Y+Z=N`、人数在范围内；不能只写全局人数或“旁听、屏息、关注”。NPC 只作为镜头关键帧、视频时间段或构图参考中的背景群像，不进入 `characterCodes`、角色锚点或独立角色资产；场景全景基准图始终保持高清、无人、无文字。没有配置时按 `auto` 执行，不能把空配置当成禁止 NPC。
- 图片帧提示词使用现有 `imagePrompt` 作为唯一静态画面事实源，不强制九段。按事实选择 `画面主体`、`可见状态`、`构图与空间`、`光色与风格`、`针对性约束` 五类可选短段，缺少事实的段落省略；每帧至少表达主体、冻结的可见状态和一项可验收的空间关系、视线、姿态、道具或环境结果。`actionPrompt` 只描述动作过程，不复制进 `imagePrompt`。服务端只做轻量格式化和硬错误校验，质量缺口、帧间相似、构图/光线不完整和 NPC 拥挤等作为警告；不得从动作、镜头描述、资产、NPC 或相邻帧自动补写静态正文。参考图职责只进入 `framePlan.referenceManifest` 和服务端实际绑定，不写入图片正文。
- 第十一章“分段视频 Prompt”不是独立事实源，只展示当前 Agent 已生成并保存的完整 `videoPrompt`。JSON 和 Markdown 导出都必须保留该原文；不得根据 `framePlan` 重建、补写或覆盖时间段，也不得保存过期时长。
- 每个镜头必须携带可执行的 `performancePlan`、逐句 `dialoguePerformance`（无对白时为空数组）、`lightingPlan`、`continuity`、`entryState`、`exitState` 与 `framePlan`。`framePlan.start.source` 只能是 `independent` 或 `previous_accepted_actual_tail`，`framePlan.end.required` 必须是布尔值；`framePolicy` 为 `agent` 时，`framePlan.frames` 必须包含 `frameCountRange`（默认 2–9）内按不可合并的冻结可见状态自适应拆分的帧段，不能按时长、提示词长度、角色数量或参考图数量统一分配。固定策略只在用户明确选择后执行。每段提供稳定 `id`、连续 `sequenceIndex`、`startSecond`、`endSecond`、`actionPrompt` 与 `imagePrompt`，并从 0 秒无空白、无重叠地覆盖完整镜头时长。视频提示词优化返回的 `startPrompt`、`transitionPrompt`、`endPrompt` 若存在必须原样保留并用于运行时分段；缺失时直接拒绝导入，不再从描述或旧提示词补齐。
- 镜头规范对象还必须按当前事实填写 `dramaticFunction`（唯一戏剧职责）、`cameraMotion`、`lens`、`lighting`、`colorPalette`、`transitionIn`、`transitionOut`、`characterCodes`、`locationCode`、`propCodes` 和 `clueCodes`；这些字段不能用模板占位或由服务端从其它镜头重组。`videoPrompt`、`framePlan`、表演、光影和连续性分别承担自己的事实职责，不能互相冒充。
- 除第一帧外，每帧 `startPrompt` 必须原样等于上一帧 `endPrompt`；变化只能发生在本帧的动作、衔接、终点和静态 `imagePrompt`，禁止在段首凭空改写人物、道具、空间或 NPC 状态。
- 参考图编排预算与镜头时长绑定：15 秒及以下最多 9 张图片，30 秒最多 30 张图片。该预算不覆盖供应商已经声明的更小上限，提交时仍按真实模型/渠道能力校验；制作包不能把 30 秒镜头写成旧的 9 张全局上限。
- 含对白的制作包必须在 `project.productionBible.dialogueTiming` 声明 `utterance-timing-v1`；每条 `utterances` 逐句填写相对镜头的 `startSecond`/`endSecond`（只计说话，不含停顿）、`pauseBeforeSeconds`、`pauseAfterSeconds`、情绪语速 `speechRate`，并用 `speechRateCharsPerSecond` 记录可复核语速。逐句时间、停顿都必须在镜头边界内且不得重叠；视频 Prompt 的每个时间段还必须直接写 `对白表演：说话人；语气；停顿；重音；说后反应`，对白结束段写反应停顿/静默结果。对白容量只生成提醒，不作为导入、应用或预览的阻断条件，不超过 10 个可发音字标记为轻微上线偏差，超过该容差建议按自然分句、说话人转换或动作反应拆镜，但仍允许继续导入。
- 短剧生产方案的 `productionBible.productionPlan.skills` 必须同时记录 `seedance-director` 与 `seedance-25-director` 及其版本。静态图片帧只执行项目唯一的宽松静态帧规则；视频 Prompt 按镜头时长和用户明确操作加载 2.5 reference：15/20 秒使用普通阶段节拍，30 秒使用连续时间轴，续写、编辑、白模、转场和多宫格使用对应专用规则。服务端必须把两个 Skill 的版本化正文和本次 2.5 reference 注入规划/制作包生成系统指令，并在运行审计与制作包方案中保留技能 ID、名称和版本；不能只把技能名称作为展示字段，也不能因后台普通 Skill 配置缺失而静默降级。
- 每帧的 `imagePrompt` 必须以“本帧可见状态”为主体事实源：至少明确当前可见的主体、姿态/表情/视线、道具状态、空间关系或环境变化中的一项，且必须能与相邻帧区分。不得只填写对白、旁白、口型、声音、运镜、焦段、景别、色彩、负面词或“保持一致”等约束；这些内容只能作为辅助字段，分别归入 `dialoguePerformance`、声音/表演规划、镜头参数或供应商固定约束。不得复制整镜头 `imagePrompt` 后只追加“起始状态/动作展开/关键变化/结果状态”或“当前时段动作锚点”充数。制作包导入和生产预检仍必须阻止结构不完整、无可见画面或实际重复的帧；用户在帧编辑器保存时只硬校验非空、镜头/帧存在和权限，其他质量问题显示风险并允许二次确认保存。固定角色/场景/风格约束可以在服务端供应商请求中重复注入，但界面和制作包正文应突出本帧变化。
- 制作包正文禁止使用通用模板句充当帧内容，包括“入口构图已建立”“动作展开”“关键变化”“结果状态”“动作节点已经成立”“主体的眉眼、呼吸、手部和道具接触关系清晰可见”“情绪通过身体动作呈现”等。`可见状态` 必须写当前节点实际发生的具体眉眼、视线、呼吸、手部、身体或环境结果；没有具体事实时必须回到镜头原文、表演计划或道具/场景状态补足，不得用模板占位。历史制作包导入、规范化、保存和导出保留原文；旧字段或重复文案只产生质量警告，不自动迁移、重排或补写。历史内容仅供审计，不能作为新制作包或新供应商请求的事实源。
- 连续帧必须先拆成“建立场景 → 镜头/主体推进 → 关键动作 → 结果或反应/转场”四类动作节点；动作提示词写发生的动作，静态 `imagePrompt` 写该动作已经造成的可见结果。时间段按实际动作节点和帧数连续分配，不预设固定秒数。静态帧也必须有姿态、表情/视线、手部/道具或环境的状态转变；不得让每帧共享同一核心句式后仅替换阶段标签。
- 同一镜头内的每帧必须独立使用固定场景、角色、道具锚点，不引用或等待同镜上一帧图片；只有跨镜头连续性边明确要求时，镜头第一帧才可使用上一镜已人工验收的实际尾帧 `previous_accepted_actual_tail`。上一帧的姿态、视线、手部/道具状态和环境结果不得被无条件复制，当前帧 `imagePrompt` 对这些可见状态具有更高优先级。
- 连续性只锁定身份、服装、道具材质、空间轴线和光向等必要事实；降低“构图不变、主体稳定、情绪保持不变”等静态约束，不能用连续性规则压住动作变化。每一帧都必须让模型看见一个相对上一帧可验收的变化。
- `framePlan.referenceManifest` 必须以镜头声明的 `characterCodes`、`locationCode`、`propCodes`、`clueCodes` 为主事实源，再用正文补充；场景切换时必须更换 `scene_anchor`，不得因为动作描述仍提到上一场环境而继续引用旧场景。镜头生成前必须逐镜核对“镜头场景/角色/道具声明 = 实际参考图绑定”，缺少任一声明资产时阻塞生成，不得静默降级为通用参考图。
- 新章节制作包生成必须先结合当前项目固定资产目录再分析剧情：服务端向剧本 Agent 提供已有角色、场景、道具和线索的稳定 `id/code/name/profile`、基准图状态、`activeEpisodeCodes` 及当前集使用情况；已有资产的身份、轮廓、材质、基准图和固定字段不得被重新设计。Agent 漏列已有资产时，服务端必须在制作包规范化前补回项目资产，并保留镜头对这些资产的稳定编码引用；项目历史资产缺少 `code` 时按名称匹配后分配稳定回退编码。已有资产可在资产表中保留但本集不出镜时，不得进入当前镜头的 `referenceManifest`。
- 对白或旁白可以不写入静态图片正文，但其可见后果必须进入对应帧：说话者的眉眼、嘴角、视线、头部朝向、手部动作、道具位置、身体姿态或对方反应；表情变化只写在视频 Prompt 而未写入图片帧，视为不合格。每个动作节点至少应有一个可验收的静态表演状态，视频 Prompt 再负责状态之间的运动和声音衔接。
- 新建镜头或制作包未提供 Agent 帧段时，服务端不生成默认帧；必须由 Agent 提供合法的 2–9 个真实动作节点（或项目明确的 `frameCountRange`），否则阻止制作包导入或生产。
- `productionBible.productionPlan.video.shotDuration` 可设为 `15` 或 `30` 秒，表示 Agent 重新编排后的逻辑镜头目标时长。生成制作包时必须依据该值切分剧情，并将同一场景、连续时间轴内的碎片合并到目标时长（例如 8 秒 + 7 秒合并为 15 秒）；人物资产及其固定身份沿用项目现有资产，不因重新分镜而重建。
- 对白时长必须先于镜头和帧计划核算：按每秒约 5 个可发音字的质量门禁基准估算（标点、停顿和动作反应不计入可压缩空间），允许不超过 10 个可发音字的上线偏差提示；任何容量偏差只作为提醒，不得阻断内容分析、制作包预览、制作包应用或生产前预检。超过 10 个字时建议在自然分句、说话人转换或动作反应处拆镜，不能把超出容差的完整长台词当作“已通过容量优化”。
- `productionBible.productionPlan.video.framePolicy` 默认为 `agent`，并配套 `frameCountRange` 默认 `{ min: 2, max: 9 }`。Agent 必须先识别动作、表情/视线、道具、对手或 NPC 反应、空间揭示和摄影切换事件，再按不能合并的冻结可见状态决定帧数；2–9 是允许范围，不是默认模板，不能按时长、提示词长度、角色数量或参考图数量统一分配。入口和出口是必要边界，同时发生的结果可以合并在一帧；只有事件集合相近的镜头才可以复用帧数。用户主动选择固定策略时才按固定数量生成，制作包已经明确给出合法逐帧计划时，以制作包为准。
- `productionBible.productionPlan.video.framePolicy` 默认为 `agent`，并配套 `frameCountRange` 默认 `{ min: 2, max: 9 }`。Agent 必须先识别动作、表情/视线、道具、对手或 NPC 反应、空间揭示和摄影切换事件，再按不能合并的冻结可见状态决定帧数；2–9 是允许范围，不是默认模板，不能按时长、提示词长度、角色数量或参考图数量统一分配。入口和出口是必要边界，同时发生的结果可以合并在一帧；只有事件集合相近的镜头才可以复用帧数。除第一帧外，每帧 `startPrompt` 必须原样承接上一帧 `endPrompt`。用户主动选择固定策略时才按固定数量生成，制作包已经明确给出合法逐帧计划时，以制作包为准。
- 连续性边和 `framePlan` 是状态关系，不由 `startFramePrompt` / `endFramePrompt` 推断。自动拆镜后，后续子镜入口状态、首帧计划和提示词只能继承前一子镜出口状态；禁止复制原组首镜起始状态。声明 `previous_accepted_actual_tail` 的镜头只能使用上一镜当前视频版本、经人工验收的实际尾帧作为唯一 `first_frame`。
- 帧图统一记录在 `frameEvidence`：必须包含角色、来源类型、来源镜头/视频/任务/资产、媒体与公网 URL、内容哈希、所属视频版本、`candidate/accepted/rejected/superseded/unavailable` 有效性及验收或失效原因和时间。旧分镜 URL、旧任务结果、删除帧、拒绝帧和失效帧均不得再作为请求引用。
- 视频提取的实际首尾帧先是 `candidate`。只有人工验收当前视频版本的实际尾帧，才可解锁下游继承镜头；拒绝仅保留审计证据并阻塞下游，不自动创建重试任务。
- 首尾帧模式的 Agent 每次显式操作只创建一个帧位任务：缺起始帧时创建起始帧，已有起始帧且缺结束帧时才在下一次显式操作创建结束帧；首帧成功不得自动追加尾帧上游请求。
- 全能帧模式使用 `all_frames`，锚点帧按 `sequenceIndex` 从 1 连续排列，数量必须为 2–9；每个帧段保存独立时间、动作、画面提示词、媒体、任务、输入哈希和连续性证据。分段视频 Prompt 使用 `Pxx-Fxx` 标识对应帧段；视频任务只能传给已明确声明支持相应参考图数量的模型，容量不足时按帧段拆成子片并顺序合成，禁止静默裁掉参考图。
- 原创章节、结构卡、导演规则、V/SB Prompt、表演口型、静默设计、引用计划、生成顺序和 QC 进入制作包档案。
- 完整原文件及 SHA-256 继续作为来源凭据保存。
- 人工字段优先级最高，其次为制作包、AI 补全和默认值。
- `activeEpisodeCodes` 不包含当前集的资产不得进入当前集镜头引用。
- 具备非空图片 Prompt 与视频 Prompt 的完整包可直接进入分镜，不重复调用视觉整理。

## 版本规则

- v1 内只允许增加可选说明，不修改固定章节、编码和表头。
- 若必须改变字段语义或表头，创建 v2，不在 v1 中静默变更。
- 导入预览必须显示格式版本、章节数、Prompt 资产数、场次、镜头、角色、地点和总时长。
