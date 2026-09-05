import { DRAMA_CONTINUOUS_FRAME_RULES, SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT, SEEDANCE_STATIC_FRAME_PROMPT_SCHEME } from "./agent-skills/creative-shortcuts";

/** Single source of truth for Agent-generated vozeb-drama-production-package-v1 output. */
export const DRAMA_PACKAGE_ARCHITECTURE_RULES = `
制作包协议：vozeb-drama-production-package-v1。必须输出完整 Markdown，并在正文中提供可解析的规范对象；固定章节只能按以下 13 章出现，不得改名、换序或省略。13 章对所有项目和集数固定；多集总包保留一套一级章节，但每集必须拥有完整自洽的执行数据；单集制作包也必须完整保留 13 章，不能只输出镜头表：
1. 项目总览（集名、原作章节、类型、冲突、情绪曲线、色彩叙事、视觉风格、主题、结构卡、9:16导演规则）
2. 原创第一章
3. 第一集文学剧本（场N｜标题｜时间｜时间码）
4. 镜头执行表
5. 角色一致性资产
6. 场景一致性资产
7. 关键视频资产 Prompt
8. 全案板 Prompt
9. 台词与表演脚本（台词基调、逐句序列、沉默设计）
10. 声音设计（逐镜环境音、拟音、音乐）
11. 分段视频 Prompt
12. 资产映射与执行顺序
13. QC 报告（Prompt QC、视频评分、最终视频 QC）。
固定表头必须保留：镜头执行表为“镜号|时间|阶段|景别|运镜|焦段|灯光|色彩|转场|动作描述|end_state”；台词表为“ID|镜号|说话人|台词|表演与节奏|口型”；声音表为“镜号|环境音|拟音|音乐”；资产表为“优先级|资产|用途|计划类型|建议引用段”；评分表为“维度|分数|结论”。
规范对象必须保存 project、assets、episodes、seriesBible、archive。每个镜头必须有 code、title、description、sourceText、dialogue、narration、utterances、duration、characterCodes、locationCode、propCodes、clueCodes、continuity、performancePlan、dialoguePerformance、lightingPlan、entryState、exitState、videoPrompt、framePlan。
productionBible.productionPlan.skills 至少包含 seedance-director / Seedance 导演 / 2.0 和 seedance-25-director / Seedance 2.5 导演 / 2.5。静态 imagePrompt、startFramePrompt、endFramePrompt 只执行 2.0 静态帧规则，只描述一个静态画面：主体/身份锚点、当前可见姿态或道具状态、景别、构图、光线与必要约束；禁止写运镜、焦段、时间段、动作过程、对白或声音。seedance-director 与 seedance-25-director 都是仅用于提示词编排的后台质量层：按字段返回补充、冲突、缺失和单变量修复建议，由 Agent 写入固定公开合同，不产生第二套提示词，也不得覆盖用户事实、时长、比例、素材顺序或已验收尾帧。视频 videoPrompt 由 Agent 直接完整生成，公开字段顺序固定为“素材绑定（有素材时）→ 动态意图 → 全局设定 → 起始可见状态 → 时间段动作 → 单一主运镜 → 环境压力与视觉母题 → 视觉风格与光色 → 声音意图 → 结束画面 → 连续性锁 → 针对性约束”；“动作与触发”只存在于每个时间段内部，同时承载准备、接触/受力、结果、恢复和主体反应，不另设顶层“触发”或“主体动作与反应”。每个真实时间段同时保存在 videoPrompt 与 framePlan.frames，后者只是结构化镜像。运行时只校验、保存和转发，不得从 framePlan 重建、拼接或重写 videoPrompt。图片编辑语义统一使用 change / preserve / constraints，change 只允许一个已定位变量，preserve 必须列出未修改的身份、构图或材质事实。不得重复项目长档案、URL、画幅、清晰度、时长、参考图清单或全局规则，也不得包含“本内部镜头只执行”等内部说明。参考图编号和职责只由 referenceManifest 与服务端绑定块提供一次。角色名是项目资产事实，不得因为与 reference、ref 等英文缩写相似而改名、删除或当作内部占位符。
imagePrompt、startFramePrompt、endFramePrompt 的推荐写法必须按“静态关键帧 → 可见状态 → 可见表演状态 → 景别 → 机位与构图 → 站位与视线 → 三层空间 → 光色与风格 → 负面约束”的顺序收敛；面部、手部或道具要清晰时优先中远景、全身中景或更近景，ELS/极远景只能保留远景空间关系，不可与清晰脸部、手部或道具细节同时出现；前景必须是具体框景或遮挡物，不能空置。
制作包内所有提示词模块都必须按字段逐行书写：镜头的 imagePrompt、startFramePrompt、endFramePrompt、videoPrompt，framePlan.frames 的 actionPrompt、imagePrompt，以及“关键视频资产 Prompt”“全案板 Prompt”“分段视频 Prompt”中的每条提示词，均要求每个非空字段独立成行；字段之间使用换行，不得用逗号或分号压成一段自然语言。静态帧按下方固定布局；公开视频镜头级 Prompt 固定按素材绑定（有素材时）、动态意图、全局设定、起始可见状态、时间段动作、单一主运镜、环境压力与视觉母题、视觉风格与光色、声音意图、结束画面、连续性锁、针对性约束逐行组织；不再使用顶层“触发”或“主体动作与反应”，这两类内容只写在每个时间段的“动作与触发”中。第 11 章的时间段动作按每个真实帧段逐块写起点、动作与触发、可见衔接、终点；只有有事实的字段才输出，不得写“待补全”或空占位。
${SEEDANCE_STATIC_FRAME_PROMPT_LAYOUT}
${SEEDANCE_STATIC_FRAME_PROMPT_SCHEME}
${DRAMA_CONTINUOUS_FRAME_RULES}
视频提示词真相规则：每镜完整公开 videoPrompt 必须由 Agent 直接生成，并包含每个真实时间段的时间范围、起点、动作与触发、可见衔接、终点和具体画面状态；framePlan.frames 只保存同一内容的结构化镜像。应用代码、制作包序列化和运行时只能校验、保存和转发，不得从 framePlan 拼接、补写、清理、删改或重写 videoPrompt。此规则覆盖本协议中任何“videoPrompt 只保存摘要”或“第 11 章按 framePlan 重建”的旧表述。
制作包生成必须读取 productionPlan.video.shotDuration（仅允许 15、20 或 30 秒）作为逻辑镜头目标；同一场景且时间轴连续的 7s/8s 等碎片必须按目标时长合并，不能机械保留碎片；人物资产沿用项目已登记角色及基准图。productionPlan.video.frameCount 默认为 5，可按用户本轮要求调整为 1-9；Agent 必须据此重新切分每镜剧情和逐帧提示词。
制作包生成前必须先读取当前项目固定资产目录（角色、场景、道具、线索的稳定 id、code、name、profile、基准图状态和 activeEpisodeCodes），再结合当前章节事实做资产复用分析。已登记资产必须原样保留在制作包资产表中；镜头只引用当前实际需要的已有 code。已有资产的身份、轮廓、材质、基准图和固定字段不得被 Agent 重设计，缺失的已有资产由服务端在规范化前补回；只有章节事实明确新增且通过资产登记的新资产才可进入包。
framePlan.start.source 只能为 independent 或 previous_accepted_actual_tail；end.required 必须为布尔值；frames 必须为 productionPlan.video.frameCount 指定数量的真实动作节点，按 sequenceIndex 连续排列，从 0 秒无空白、无重叠覆盖完整镜头时长。每帧必须有稳定 id、startSecond、endSecond、actionPrompt、imagePrompt。
每帧 imagePrompt 必须描述本时刻可见画面：主体、姿态、表情/眉眼、视线/头向、手部或身体、道具状态、空间/环境变化至少一项，并能与上一帧区分。对白和旁白可以不写成图片文字，但说话造成的表情、视线、手部/身体姿态、道具变化或对方反应必须写入对应帧；只写对白、口型、声音、运镜、焦段、色彩、约束或“起始/展开/结果状态”均不合格。
referenceManifest 必须以 characterCodes、locationCode、propCodes、clueCodes 为主事实源；每个角色使用 character_anchor，每个场景使用 scene_anchor，每个道具使用 prop_anchor。角色资产表必须保留所有已登记角色及其固定身份，即使某集或某镜不出镜；characterCodes 和 referenceManifest 只能包含当前镜头实际出镜、实际需要约束的角色。已登记但不出镜的角色必须在项目/集级规则中明确“不出镜、不得进入本集参考图请求”，供应商提示词同时使用角色名的不出镜约束和可观察画面限制（例如“除 Karin 外不显示可辨识人物面孔”），不得把该角色从资产档案删除，也不得只写含义不清的“无可辨识的角色名”。场景改变必须切换 scene_anchor，不能因文本相似继续引用上一场景。Seedance 参考图按 @图片1、@图片2…连续编号，每张图必须标明唯一用途；previous_actual_tail 只能是上一镜当前视频版本、人工验收的实际尾帧。
continuity 必须明确景别、机位、构图、站位、视线、actionStart、actionEnd、屏幕方向、180 度轴线和连续性说明。entryState/exitState 必须包含人物位置、视线、姿态、动作，道具状态/持有人，环境和灯光；下一镜入口只能继承上一镜出口，不得复制组首镜起始状态。
performancePlan 必须具体写情绪目标、情绪曲线、语气、节奏、呼吸、克制度，以及 start/middle/end 的情绪、面部动作、视线和身体/手部动作。dialoguePerformance 必须逐句写意图、语气、节奏、停顿、重音和对白前中后的面部反应；无对白只能为空数组。lightingPlan 必须写色板、色温、主光、补光、轮廓光、反差、材质反应、肤色保护、前镜继承和下镜过渡。
禁止待补全、空对象、无依据新增剧情、重复帧、无可见画面帧、错场景、漏资产、旧 URL、失效任务和把声音指令写进图片帧。第 11 章只读取当前 Agent 已生成的 videoPrompt 与其 framePlan 镜像，不得另行重建或保存过期时长。生成前必须完成资产存在性、引用一致性、帧时间轴、帧间可见差异、表演、灯光、连续性和 QC 检查；任何一项失败都不得返回可确认制作包。`;
