# VOZEB PRO Seedance 2.5 导演 Skill

这是项目内固定版本的 Seedance 2.5 提示词规则包。运行时主规则位于
`web/scripts/compile-seedance-25-skill.mjs` 会在开发、测试和生产构建前，将本目录编译为
`web/src/lib/server/agent-skills/seedance-25.generated.ts`。业务代码只读取生成模块；本目录是
唯一的提示词规则和来源元数据，不执行外部脚本，也不包含 API 密钥或付费调用逻辑。

来源：`liyue-aigc/seedance-2-5-video-director`

固定 commit：`ad0e68ba6ce24fb9ae9c67c9276061cef37663f1`

许可：MIT

项目适配原则：

- 外部 Skill 只提供导演方法和提示词结构；项目自己的模型目录、协议、尺寸、素材、
  连续性、权限、计费和失败终态规则优先。
- 2.5 专属模式只有在当前供应商真实暴露并通过项目协议验证后才能执行。
- 目录中的规则不会自动调用供应商，不会提交生成任务，也不会把内部规划内容写入公开消息。

## 文件

- `SKILL.md`：主路由、完整视频提示词合同和来源元数据。
- `references/capabilities-and-limits.md`：能力事实、稳定性建议和项目边界。
- `references/prompt-blueprints.md`：按主模式选择提示词字段和时间粒度；运行时按 15/20 秒普通视频、30 秒时间轴或用户明确的专用模式读取对应规则。
- `references/multimodal-patterns.md`：参考素材职责、范围和排除项。
- `references/failure-diagnosis.md`：按根因单变量修复，不盲目重生成。
- `references/realistic-direction-patterns.md`：真人表演、对白、情感反应和物理因果。
- `references/multi-character-blocking.md`：多人站位、视线、支撑面、道具归属和轴线。
- `references/example-adaptation.md`：只迁移用户明确指定的示例结构维度，不复制身份或内容。
- `references/mode-routing.md`：15/20 秒、30 秒、续写、编辑、白模、转场和多宫格的模式规则。
- `manifest.json`：编译产物，用于审阅当前编译内容哈希；不要手工编辑。
