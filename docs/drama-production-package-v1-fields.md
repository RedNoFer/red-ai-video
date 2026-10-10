# 制作包 v1 字段合同与导入检查

本说明配合 13 章模板使用，不是第十四章，也不新增制作包字段。JSON 是机器导入对象，正文是作者成稿；两者须来自同一次创作。目标服务器无需安装作者的 Skill 或提供项目内部运行凭据。

[最小可导入镜头示例](drama-production-package-v1-field-example.json) 已用真实解析器验证。它只说明嵌套类型，不是剧情生成器或生产合格样板；示例 QC 保留修订状态，审计哈希是占位值。正式交稿应计算真实哈希、完成完整导演文本自检，保留一次完整修订上限。

| 路径                                                                              | 类型与职责                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                                                                   | 数字 `1`，不能写字符串或另造格式版本                                                                                                                                             |
| `project.productionBible.productionPlan`                                          | 对象；保留 `version/skills/visual/video/references/continuity/frameCountRange/source`，模型与视频偏好位于 `video` 内                                                             |
| `project.productionLock`                                                          | 对象；冻结逻辑轴，不是内部剪辑事件列表                                                                                                                                           |
| `productionLock.shotDuration/targetDuration/logicalShotCount`                     | 数字；本合同每个逻辑片段 15 或 30 秒，总时长等于全部逻辑片段时长之和                                                                                                             |
| `productionLock.internalCutPolicy/framePolicy`                                    | 枚举 `adaptive/dense-30s` 与 `agent/fixed-4/fixed-5`；当前要求高密度时不能改成 `adaptive`                                                                                        |
| `productionLock.storySourceHash/templateHash/directorSkillHash/seedanceSkillHash` | 当前完整内容的哈希字符串；Skill 信息只用于来源审计                                                                                                                               |
| `productionLock.dialogueCapacityPlan`                                             | 对象数组；每条填写 `dialogueId/speaker/characterCount/speechRateCharsPerSecond/requiredSpeechSeconds/availableSpeechSeconds`，并关联 `episodeCode/shotCode`                      |
| `productionLock.narrativeBeatPlan`                                                | 对象数组；每条 `id/responsibility/shotCodes[]` 对应一个独立逻辑剧情职责                                                                                                          |
| `assets`                                                                          | 对象，包含 `characters/locations/props/clues` 四个数组；资产用 `code`，引用用相应代码字段                                                                                        |
| `episodes[]`                                                                      | 对象；`code/storyScenes[]/shots[]/continuityEdges[]` 组织场次、逻辑片段和片段之间的连接                                                                                          |
| `shots[].duration/timecode/order`                                                 | 数字时长、连续时间码字符串、数字顺序；不能改用 `shotDuration/shotId/episodeId`                                                                                                   |
| `shots[].utterances[]`                                                            | 对象数组，不能直接放字符串；每条含 `id/type/speaker/text`，对白用 `type=dialogue`、角色代码放 `characterId`，窗口用数字 `startSecond/endSecond`                                  |
| `shots[].entryState/exitState`                                                    | 对象；`characters[]/props[]` 记录实体，`environment/lighting/axis` 记录世界空间事实；不是一段自由文本                                                                            |
| `state.characters[]`                                                              | `assetId` 加 `position/pose/gaze/action` 等可见状态；世界站位与摄影机位分别表达                                                                                                  |
| `state.props[]`                                                                   | `assetId/holderId/state`；持有人用角色代码或 `environment`；递物需写出接触、转移或收回过程                                                                                       |
| `shots[].performancePlan`                                                         | 对象；`emotionalObjective` 说明职责，`beats.start/middle/end` 各为表演对象，填写 `emotion/facialAction/gaze/bodyAction` 等可见证据；稳定表演不强迫情绪升级                       |
| `shots[].dialoguePerformance[]`                                                   | 对象数组，按 `utteranceId` 关联台词表演；语气、停顿、重音、说后反应保持与实际对白一致                                                                                            |
| `shots[].framePlan`                                                               | 对象；`start`、`end`、`frames[]`、`referenceManifest[]` 都在其内部                                                                                                               |
| `framePlan.start.source`                                                          | `independent` 或 `previous_accepted_actual_tail`；后者必须提供已验收实际尾帧引用，纯外部文本包通常用前者                                                                         |
| `framePlan.end.required`                                                          | 布尔值，不能写 `"true"` 或提示词                                                                                                                                                 |
| `framePlan.frames[]`                                                              | 每帧 `id/sequenceIndex/startSecond/endSecond/actionPrompt/endPrompt/imagePrompt`；按真实对白与动作边界从 0 连续覆盖至当前 `duration`，无空隙、重叠或越界                         |
| `framePlan.referenceManifest[]`                                                   | 对象数组，使用 `alias/role/purpose/assetId`；默认场景全景加出镜角色基准，道具或关键帧只在不可替代时加入                                                                          |
| `shots[].videoPrompt`                                                             | 独立完整字符串；每帧一张公开镜头卡，首卡重述当前世界事实；完整对白只进入卡内 `台词`，不复制进 `画面内容`                                                                         |
| `continuityEdges[]`                                                               | 片段之间的连接；`fromShotCode/toShotCode/transition/inheritActualEndFrame/carryCharacterIds/carryPropIds/carryEnvironment/carryAxis/notes`；枚举全部相邻片段，换场与跳时说明依据 |
| `authoring.materials[]`                                                           | 文本来源对象数组；必须包含 `package-template` 与 `story-source`，不用提供运行凭据                                                                                                |
| `authoring.qualityGateReport`                                                     | `{status, checks[]}`，检查项记 `code/status/severity/scope/evidence/sourceRefs/fixHint`；被阻断的检查与总状态必须一致。导入不替作者改成 `passed`                                 |
| `archive.sections[]`                                                              | 现有章节归档；可稀疏填写，已填写内容必须与实际正文核对，缺项声明范围缺口                                                                                                         |

角色资产统一为一张白底板：身份特写＋正面、严格左侧面、背面全身。场景为当前画幅的高清单视角全景，须读出空间拓扑。

30 秒 `dense-30s` 默认 8–11 个连续帧段、7–10 次实际 `type=硬切`。匹配切、跳切与跨片段转场不计数；硬切对齐帧边界并填写触发、新机位、切后主运镜、信息目的和承接。减切原因写在本镜正文并登记修订状态，不能自动降级配置。

```sh
pnpm --dir web run check:drama-package -- /绝对路径/制作包.md --source /绝对路径/源文.txt
```

命令只读，不调用模型、不生成分镜、不修改输入文件。输出 `importable/sourceHash/summary/warnings/qualityGateReport`：退出码 `0` 表示文本检查无阻断项；`1` 表示无法解析或结构不允许导入；`2` 表示结构可导入但需质量修订。未提供 TXT、未识别声源或尚未生成媒体时，报告保留检查缺口，不宣称全文对白、口型或成片验收通过。

导入预览集中提醒质量问题，可确认后继续导入。JSON 损坏、章节结构、必填嵌套类型、非法字段与时间轴错误仍阻断。导入、保存和刷新保留作者公开原稿；目标项目风格冲突及人工字段合并冲突只提醒。稳定 ID 映射与明确的人工字段保留是允许的变更。修改对白、入口状态或同帧提示词后，相关旧媒体保留并进入待复核状态。
