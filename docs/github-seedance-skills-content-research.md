# GitHub 上的 Seedance 2.0 / 2.5 Skills：文件内容调研

> 调研时间：2026-09-03（Asia/Shanghai）
> 来源范围：GitHub 公开仓库的仓库页面、提交历史、README、`SKILL.md`、references 原始文件。以下版本均使用本次检索时克隆到本地的仓库 HEAD；链接固定到对应 commit，避免后续 `main` 分支变化造成内容漂移。
## 结论先说

- **Seedance 2.0** 目前可找到多种“提示词工程 Skill”，共同核心是旧版平台约束（图片 9、视频 3、音频 3、混合 12、4–15 秒）、`@图片N/@视频N/@音频N` 角色绑定、运镜/时间轴/音效和广告、短剧、特效等模板。
- **Seedance 2.5** 的 Skill 更偏“工作流路由器”：除普通 4–30 秒生成外，还覆盖 30–180 秒 Long Video、原生延长、智能/高级/视频编辑、BGM 分离、绿幕、白模、无缝转场、多宫格分镜、音色和多人物一致性。
- 2.5 仓库普遍明确提醒：平台能力、第三方 API 能力和具体限制不能混为一谈；不少仓库明确不保证能够调用付费生成接口。
- 同一版本内的设计理念并不完全一致：例如 `woyin2024` 强制先做主体/场景 T2I 资产图并要求镜头正文只写画面，而 `AtlasCloudAI` 将 Seedance 2.0 作为当前可执行默认、只有供应商暴露 2.5 时才切换；`allenGKC`、`liyue-aigc`、`woodfantasy` 则以 2.5 原生模式为中心。

## 检索到的代表仓库与版本

| 版本 | 仓库 | 本次 HEAD（提交日期） | 主要 Skill 文件 |
|---|---|---|---|
| 2.0 | [dexhunter/seedance2-skill](https://github.com/dexhunter/seedance2-skill/tree/e06c7c63a766d623004a2807881c30685ce517af) | `e06c7c63a766d623004a2807881c30685ce517af`（2026-02-18） | [`SKILL.md`](https://github.com/dexhunter/seedance2-skill/blob/e06c7c63a766d623004a2807881c30685ce517af/SKILL.md)、[`zh/SKILL.md`](https://github.com/dexhunter/seedance2-skill/blob/e06c7c63a766d623004a2807881c30685ce517af/zh/SKILL.md) |
| 2.0 | [songguoxs/seedance-prompt-skill](https://github.com/songguoxs/seedance-prompt-skill/tree/57d1e2f273747c238dd892698a05137ab2f10d4a) | `57d1e2f273747c238dd892698a05137ab2f10d4a`（2026-02-13） | [`.claude/skills/seedance/SKILL.md`](https://github.com/songguoxs/seedance-prompt-skill/blob/57d1e2f273747c238dd892698a05137ab2f10d4a/.claude/skills/seedance/SKILL.md) |
| 2.0 | [heloraai/Seedance2.0-Prompt-Optimizer-skill](https://github.com/heloraai/Seedance2.0-Prompt-Optimizer-skill/tree/3311ecca8c1c303e63a0099c10923a930487bf58) | `3311ecca8c1c303e63a0099c10923a930487bf58`（2026-02-25） | [`SKILL.md`](https://github.com/heloraai/Seedance2.0-Prompt-Optimizer-skill/blob/3311ecca8c1c303e63a0099c10923a930487bf58/SKILL.md) |
| 2.0 | [zhanghaonan777/Seedance2-skill](https://github.com/zhanghaonan777/Seedance2-skill/tree/4ecc0046eee2c56d517fa9e4fbe802527d39ddb3) | `4ecc0046eee2c56d517fa9e4fbe802527d39ddb3`（2026-02-21） | [`SKILL.md`](https://github.com/zhanghaonan777/Seedance2-skill/blob/4ecc0046eee2c56d517fa9e4fbe802527d39ddb3/SKILL.md)、[`reference.md`](https://github.com/zhanghaonan777/Seedance2-skill/blob/4ecc0046eee2c56d517fa9e4fbe802527d39ddb3/reference.md) |
| 2.5 | [allenGKC/Seedance-2.5](https://github.com/allenGKC/Seedance-2.5/tree/ebc68d3c19a62fba0f9ba9d2805af1f711a82aa7) | `ebc68d3c19a62fba0f9ba9d2805af1f711a82aa7`（2026-08-02） | [`skill/seedance-25/SKILL.md`](https://github.com/allenGKC/Seedance-2.5/blob/ebc68d3c19a62fba0f9ba9d2805af1f711a82aa7/skill/seedance-25/SKILL.md)、[`references/capabilities.md`](https://github.com/allenGKC/Seedance-2.5/blob/ebc68d3c19a62fba0f9ba9d2805af1f711a82aa7/skill/seedance-25/references/capabilities.md) |
| 2.5 | [liyue-aigc/seedance-2-5-video-director](https://github.com/liyue-aigc/seedance-2-5-video-director/tree/ad0e68ba6ce24fb9ae9c67c9276061cef37663f1) | `ad0e68ba6ce24fb9ae9c67c9276061cef37663f1`（2026-08-26） | [`SKILL.md`](https://github.com/liyue-aigc/seedance-2-5-video-director/blob/ad0e68ba6ce24fb9ae9c67c9276061cef37663f1/SKILL.md)、[`references/capabilities-and-limits.md`](https://github.com/liyue-aigc/seedance-2-5-video-director/blob/ad0e68ba6ce24fb9ae9c67c9276061cef37663f1/references/capabilities-and-limits.md) |
| 2.5 | [nutllwhy/seedance-tvc-director](https://github.com/nutllwhy/seedance-tvc-director/tree/9fef40f955f476551eb7e6fc5a7355f7dbc44181) | `9fef40f955f476551eb7e6fc5a7355f7dbc44181`（2026-08-09） | [`seedance-tvc-director/SKILL.md`](https://github.com/nutllwhy/seedance-tvc-director/blob/9fef40f955f476551eb7e6fc5a7355f7dbc44181/seedance-tvc-director/SKILL.md) |
| 2.5 | [AtlasCloudAI/awesome-seedance-2.5-prompts-skills](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills/tree/bde0cab62db4496fd767ca030f015f6184f105e6) | `bde0cab62db4496fd767ca030f015f6184f105e6`（2026-09-02） | [`skills/seedance-2-5-skill/SKILL.md`](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills/blob/bde0cab62db4496fd767ca030f015f6184f105e6/skills/seedance-2-5-skill/SKILL.md) |
| 2.5 | [woodfantasy/Seedance-ShotDesign-Skills](https://github.com/woodfantasy/Seedance-ShotDesign-Skills/tree/05e5c3f1aded04d816d71a2c376d132b9a2f5aaf) | `05e5c3f1aded04d816d71a2c376d132b9a2f5aaf`（2026-08-19） | [`SKILL.md`](https://github.com/woodfantasy/Seedance-ShotDesign-Skills/blob/05e5c3f1aded04d816d71a2c376d132b9a2f5aaf/SKILL.md)、[`references/seedance-specs.md`](https://github.com/woodfantasy/Seedance-ShotDesign-Skills/blob/05e5c3f1aded04d816d71a2c376d132b9a2f5aaf/references/seedance-specs.md) |
| 2.5 | [woyin2024/lengyi-seedance2.5-prompt](https://github.com/woyin2024/lengyi-seedance2.5-prompt/tree/a43cdfd3bfa5ee7900f71584b2b04f0143abb381) | `a43cdfd3bfa5ee7900f71584b2b04f0143abb381`（2026-07-31） | [`SKILL.md`](https://github.com/woyin2024/lengyi-seedance2.5-prompt/blob/a43cdfd3bfa5ee7900f71584b2b04f0143abb381/SKILL.md)、[`references/templates.md`](https://github.com/woyin2024/lengyi-seedance2.5-prompt/blob/a43cdfd3bfa5ee7900f71584b2b04f0143abb381/references/templates.md) |

## Seedance 2.0：文件内容

### 1. dexhunter/seedance2-skill：英文 + 中文双入口

README 将仓库定义为面向 Jimeng Seedance 2.0 的 Agent skill，覆盖输入约束、`@` 引用、运镜、提示词结构和广告/短剧/MV/教育模板，并提供手动复制或 `npx skills add dexhunter/seedance2-skill` 安装方式。[README](https://github.com/dexhunter/seedance2-skill/blob/e06c7c63a766d623004a2807881c30685ce517af/README.md)

`SKILL.md` 的具体结构：

- YAML 元数据：`name: seedance-prompt-en`，描述为“为 Jimeng Seedance 2.0 多模态视频生成写提示词”。
- **System Constraints**：图片 ≤9、视频 ≤3（单个 50MB、总时长 2–15s）、音频 ≤3（总时长 ≤15s）、混合文件 ≤12；输出 4–15s；列出 480p/720p 范围和写实真人脸限制。[SKILL.md#L1-L31](https://github.com/dexhunter/seedance2-skill/blob/e06c7c63a766d623004a2807881c30685ce517af/SKILL.md#L1-L31)
- **@ Reference System**：明确写 `@Image1`、`@Video1`、`@Audio1`，并要求为首帧、尾帧、人物、场景、运镜、动作、特效、节奏、声音、服装、产品等用途分配角色。[SKILL.md#L35-L70](https://github.com/dexhunter/seedance2-skill/blob/e06c7c63a766d623004a2807881c30685ce517af/SKILL.md#L35-L70)
- **Prompt Structure Blueprint**：主体/场景/动作/运镜/时间分段/转场特效/音频/风格；10 秒以上推荐按 `0–3s / 3–6s / 6–10s / 10–15s` 分段。[SKILL.md#L74-L93](https://github.com/dexhunter/seedance2-skill/blob/e06c7c63a766d623004a2807881c30685ce517af/SKILL.md#L74-L93)
- 后续章节继续提供 Camera Language、音频设计、按场景模板、质量检查和完整示例（文件共 378 行）。

中文版本 [`zh/SKILL.md`](https://github.com/dexhunter/seedance2-skill/blob/e06c7c63a766d623004a2807881c30685ce517af/zh/SKILL.md) 与英文版同构，中文文件把引用示例写成 `@图片1作为首帧`、`参考@视频1的运镜效果`、`背景BGM参考@音频1`，并额外列出字体/文字引用用途（约第 46–71 行）。

### 2. songguoxs/seedance-prompt-skill：Claude Code 单文件工作流

Skill 实际位于隐藏路径 `.claude/skills/seedance/SKILL.md`，README 说明它会先确认时长、画幅和参考素材，再给 2–3 个提示词版本；超过 15 秒时拆成可延长的多段。[README](https://github.com/songguoxs/seedance-prompt-skill/blob/57d1e2f273747c238dd892698a05137ab2f10d4a/README.md)

文件内容的显著点：

- 元数据含 `version: 2.0.0`，定位为中文 Seedance 2.0 提示词生成器。[SKILL.md#L1-L10](https://github.com/songguoxs/seedance-prompt-skill/blob/57d1e2f273747c238dd892698a05137ab2f10d4a/.claude/skills/seedance/SKILL.md#L1-L10)
- “核心能力”除纯文本、多模态、一致性、首尾帧外，还写有视频延长、视频编辑、一镜到底、音画同步。
- 仍采用旧版 9/3/3/12 约束，并把声音输出描述为自带音效/配乐；平台限制段要求避免写实真人脸素材。[SKILL.md#L20-L51](https://github.com/songguoxs/seedance-prompt-skill/blob/57d1e2f273747c238dd892698a05137ab2f10d4a/.claude/skills/seedance/SKILL.md#L20-L51)
- “十大能力与提示词模式”用固定模板说明纯文本、一致性、运镜/动作复刻、创意模板/特效、剧情补全、视频延长等。[SKILL.md#L53-L120](https://github.com/songguoxs/seedance-prompt-skill/blob/57d1e2f273747c238dd892698a05137ab2f10d4a/.claude/skills/seedance/SKILL.md#L53-L120)

README 还包含大量直接可运行示例（仙侠战斗、产品广告、短剧对白、30 秒分段），适合查看“最终提示词长什么样”，但它没有单独的 `references/` 目录。

### 3. heloraai/Seedance2.0-Prompt-Optimizer-skill：SCELA + 模板库

README 将 Skill 描述为从 400+ 高分提示词提炼出的 18 个模板，覆盖动作、仙侠、产品、短剧、变身、舞蹈 MV、生活 Vlog、科幻机甲；声称输出约 99% 平台通过率（这是仓库作者的自述，不是平台保证）。[README](https://github.com/heloraai/Seedance2.0-Prompt-Optimizer-skill/blob/3311ecca8c1c303e63a0099c10923a930487bf58/README.md)

`SKILL.md` 的实际流程：

1. 先一次性收集时长（5/10/15s）和风格；
2. 按信号词选择 A–R 模板；
3. 用 **SCELA** 展开：Subject、Camera、Effect、Light/Look、Audio；
4. 默认流畅叙事，只有需要严格顺序时才使用时间戳；
5. 内部执行合规替换，不在公开提示词里输出“禁止……”说明；
6. 输出 5 秒短版或 10/15 秒完整版本。[SKILL.md#L12-L100](https://github.com/heloraai/Seedance2.0-Prompt-Optimizer-skill/blob/3311ecca8c1c303e63a0099c10923a930487bf58/SKILL.md#L12-L100)

关键 references：

- [`references/prompt-templates.md`](https://github.com/heloraai/Seedance2.0-Prompt-Optimizer-skill/blob/3311ecca8c1c303e63a0099c10923a930487bf58/references/prompt-templates.md)：646 行，8 类主题、A–R 模板、示例和模板选择说明；目录从动作/战斗到科幻/末日。[文件](https://github.com/heloraai/Seedance2.0-Prompt-Optimizer-skill/blob/3311ecca8c1c303e63a0099c10923a930487bf58/references/prompt-templates.md#L1-L48)
- [`references/compliance.md`](https://github.com/heloraai/Seedance2.0-Prompt-Optimizer-skill/blob/3311ecca8c1c303e63a0099c10923a930487bf58/references/compliance.md)：违禁词替换、版权角色去名化、政治/敏感内容处理。
- [`references/vocab.md`](https://github.com/heloraai/Seedance2.0-Prompt-Optimizer-skill/blob/3311ecca8c1c303e63a0099c10923a930487bf58/references/vocab.md)：镜头、风格和声音词汇表。

### 4. zhanghaonan777/Seedance2-skill：创意审核 + API CLI

README 定位为“100+ 镜头词库、Seedance 2.0 全模态 API CLI”，兼容 OpenClaw/Cursor/任意 Agent；`SKILL.md` 把自己定义为“视频创意总监”，允许从图片、文案或只有一张图自主发散创意，并可调用 `scripts/seedance.py` 的 Volcengine Ark API。[SKILL.md#L6-L23](https://github.com/zhanghaonan777/Seedance2-skill/blob/4ecc0046eee2c56d517fa9e4fbe802527d39ddb3/SKILL.md#L6-L23)

实际规则包括：

- 先过“记忆点 / 意外感 / 情绪 / 叙事”创意关，不满意就推翻重写；
- 参考词汇从 `reference.md` 读取；
- 质量红线要求中文提示词、每个 `@` 引用标明用途、区分“参考”与“编辑”、禁止写实真人脸；
- 文件末尾给出旧版 9/3/3/12、4–15 秒和 API model ID `doubao-seedance-2-0-260128` 等信息。[SKILL.md#L24-L33](https://github.com/zhanghaonan777/Seedance2-skill/blob/4ecc0046eee2c56d517fa9e4fbe802527d39ddb3/SKILL.md#L24-L33)、[SKILL.md#L62-L100](https://github.com/zhanghaonan777/Seedance2-skill/blob/4ecc0046eee2c56d517fa9e4fbe802527d39ddb3/SKILL.md#L62-L100)

`reference.md` 是较大的词库和平台说明，包含镜头、构图、光影、风格和 API 使用示例，而非纯提示词流程。[reference.md](https://github.com/zhanghaonan777/Seedance2-skill/blob/4ecc0046eee2c56d517fa9e4fbe802527d39ddb3/reference.md)

## Seedance 2.5：文件内容

### 1. allenGKC/Seedance-2.5：2.5 OS 路由器

README 明确声明这是社区项目、不是 ByteDance/Jimeng/Dreamina 官方产品；其目标是把自然语言转成 Seedance 2.5 设置、参考角色和一条可粘贴提示词。[README](https://github.com/allenGKC/Seedance-2.5/blob/ebc68d3c19a62fba0f9ba9d2805af1f711a82aa7/README.md#L1-L18)

README 还把 2.5 与 2.0 的变化列成表：标准生成 4–30 秒、Ultra-long 30–180 秒、原生延长、最多 30 图片/10 视频/10 音频、Smart/Advanced/Video Edit、绿幕、白模、多宫格等。[README#Why 2.5 OS](https://github.com/allenGKC/Seedance-2.5/blob/ebc68d3c19a62fba0f9ba9d2805af1f711a82aa7/README.md#L20-L47)

`skill/seedance-25/SKILL.md` 是一个“先路由、再写提示词”的主 Skill：

- 初学者快速通道：清晰需求直接起草，默认 10 秒简单动作、30 秒有起承转合故事、9:16 社媒、720p；
- 路由到 basic generation、ultra-long、native extension、smart/advanced/video edit、white-model render；
- 要求四层提示词：参考素材声明 → 一句话概览 → 可见时间推进 → 全局锁定；
- 强调每个维度只允许一个素材/规则拥有控制权，并要求事实与观察门禁。[SKILL.md#L10-L91](https://github.com/allenGKC/Seedance-2.5/blob/ebc68d3c19a62fba0f9ba9d2805af1f711a82aa7/skill/seedance-25/SKILL.md#L10-L91)

最值得参考的参数文件是 [`references/capabilities.md`](https://github.com/allenGKC/Seedance-2.5/blob/ebc68d3c19a62fba0f9ba9d2805af1f711a82aa7/skill/seedance-25/references/capabilities.md)：它把 4–30 秒、480p/720p、30–180 秒 Long Video、延长 4–30 秒、图片 30、视频 10、音频 10和稳定性建议分开，并特别提醒这些是“即梦文档事实”，不是所有 API/router 的通用承诺。[capabilities.md#L1-L55](https://github.com/allenGKC/Seedance-2.5/blob/ebc68d3c19a62fba0f9ba9d2805af1f711a82aa7/skill/seedance-25/references/capabilities.md#L1-L55)

主 Skill 引用的参考文件包括：`prompting.md`、`capabilities.md`、`long-video.md`、`editing.md`、`references.md`、`white-model-storyboard.md`、`troubleshooting.md`、`prompt-recipes.md` 和 `safety.md`。[SKILL.md#Route the request](https://github.com/allenGKC/Seedance-2.5/blob/ebc68d3c19a62fba0f9ba9d2805af1f711a82aa7/skill/seedance-25/SKILL.md#L26-L40)

### 2. liyue-aigc/seedance-2-5-video-director：视频导演型 Skill

README 将其定义为把文本、人物参考图、视频、音频、分镜和旧提示词整理成导演方案、诊断和最终提示词；明确写出“不调用付费生成接口、不自动消耗积分”。[README#L1-L19](https://github.com/liyue-aigc/seedance-2-5-video-director/blob/ad0e68ba6ce24fb9ae9c67c9276061cef37663f1/README.md#L1-L19)

`SKILL.md` 的结构很清晰：

- 安装引导只有在“刚安装”或用户主动请求帮助时展示，不把普通新会话误判成首次安装；
- 每次先读能力限制，再读提示词蓝图；有参考素材或专业能力时按条件读取 multimodal/realistic 参考；
- 只选择一个 primary mode：`basic-multimodal`、`timestamp-30s`、`long-video`、`video-extension`、`video-edit`、`clay-renderer`、`seamless-transition`、`multi-grid storyboard`；
- 最终只交付用户请求的导演 brief、脚本、诊断、改写或提示词。[SKILL.md#L10-L52](https://github.com/liyue-aigc/seedance-2-5-video-director/blob/ad0e68ba6ce24fb9ae9c67c9276061cef37663f1/SKILL.md#L10-L52)

`references/capabilities-and-limits.md` 给出一个很实用的“事实来源快照”：来源是 Dreamina Seedance 2.5 使用手册，文档 revision 419，整理日期 2026-08-16；图片上限 30、视频 10/总时长 30 秒、音频 10/总时长 30 秒、支持 audio-only，并将稳定性建议与硬限制分开。[capabilities-and-limits.md#L11-L83](https://github.com/liyue-aigc/seedance-2-5-video-director/blob/ad0e68ba6ce24fb9ae9c67c9276061cef37663f1/references/capabilities-and-limits.md#L11-L83)

`references/prompt-blueprints.md` 按 basic multimodal、精确 30 秒、Long Video、extension、edit、Clay Renderer、无缝转场和多格分镜给出逐模式蓝图；`multimodal-patterns.md` 负责素材职责和冲突处理；`realistic-direction-patterns.md` 负责真人表演、对白、情感冲突、体育/综艺机位和物理因果。[prompt-blueprints.md](https://github.com/liyue-aigc/seedance-2-5-video-director/blob/ad0e68ba6ce24fb9ae9c67c9276061cef37663f1/references/prompt-blueprints.md)、[multimodal-patterns.md](https://github.com/liyue-aigc/seedance-2-5-video-director/blob/ad0e68ba6ce24fb9ae9c67c9276061cef37663f1/references/multimodal-patterns.md)

### 3. nutllwhy/seedance-tvc-director：商业广告专用

README 当前版本标为 `0.16.0`，定位为把产品 brief、参考图、传播目标转成 15 秒、30 秒或自定义时长 TVC 方案、导演执行单、九宫格预览和可复制提示词，并能依据时间码复盘局部重试。[README#L1-L33](https://github.com/nutllwhy/seedance-tvc-director/blob/9fef40f955f476551eb7e6fc5a7355f7dbc44181/README.md#L1-L33)

`seedance-tvc-director/SKILL.md` 的核心流程：

- 把时长、声音（有旁白/无旁白/两套）和生成方式（直出/九宫格）作为三个独立配置；
- 30 秒广告必须有 0–3 秒钩子、每 4–6 秒新增信息、产品参与因果；
- 3 人以上需要身份差异、座位顺序、肢体归属和桌面拓扑；
- 交付契约包括 brief 判断、生成配置、核心策略、创意路线、前三秒钩子、导演执行单、时间轴、最终提示词、后期与交付、风险旋钮。[SKILL.md#L10-L30](https://github.com/nutllwhy/seedance-tvc-director/blob/9fef40f955f476551eb7e6fc5a7355f7dbc44181/seedance-tvc-director/SKILL.md#L10-L30)、[SKILL.md#L77-L124](https://github.com/nutllwhy/seedance-tvc-director/blob/9fef40f955f476551eb7e6fc5a7355f7dbc44181/seedance-tvc-director/SKILL.md#L77-L124)

关键 references：`ad-hook.md`（前三秒广告钩子）、`tvc-structure.md`（15/30 秒结构）、`scene-progression.md`（30 秒反重复）、`product-actions.md`（开袋/倒出/涂抹的受力链）、`voiceover.md`（唯一旁白真源）、`delivery-and-qc.md`（交付质检）。[目录](https://github.com/nutllwhy/seedance-tvc-director/tree/9fef40f955f476551eb7e6fc5a7355f7dbc44181/seedance-tvc-director/references)

### 4. AtlasCloudAI/awesome-seedance-2.5-prompts-skills：Skill + Prompt 库 + 执行适配器

README 是“150+ prompts + installable Skill”的组合仓库。当前 HEAD 说明：Seedream 5.0 Pro 用于分镜图，Seedance 2.0 是当前可执行默认，只有所选 provider 暴露 2.5 时才切换。[README#L1-L11](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills/blob/bde0cab62db4496fd767ca030f015f6184f105e6/README.md#L1-L11)

其 `skills/seedance-2-5-skill/SKILL.md` 不把每个请求强制塞进九宫格：先选 T2V、R2V storyboard、R2V asset references、I2V shot pair、Extend/chain、staged whole-short、Editing、Seamless transition 或 Blockout reference；之后只启用所需准备模块。[SKILL.md#L11-L55](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills/blob/bde0cab62db4496fd767ca030f015f6184f105e6/skills/seedance-2-5-skill/SKILL.md#L11-L55)

文件还规定：主体 brief 记录 3–5 个不变量；每个关键帧使用干净单场景；每份参考素材分配单一主职责；重要切点写进 storyboard 与 prompt；作用域分为 global / locks / time。[SKILL.md#L57-L130](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills/blob/bde0cab62db4496fd767ca030f015f6184f105e6/skills/seedance-2-5-skill/SKILL.md#L57-L130)

该仓库还包含 `universal-video-prompt-skill`，把“模型无关 prompt spec”和具体模型编译分开；适合做 Seedance 2.0/2.5 跨模型迁移。[README#L105-L130](https://github.com/AtlasCloudAI/awesome-seedance-2.5-prompts-skills/blob/bde0cab62db4496fd767ca030f015f6184f105e6/README.md#L105-L130)

### 5. woodfantasy/Seedance-ShotDesign-Skills：模式感知 + 官方规范快照

README 说明 3.0/3.1 是能力级重写，覆盖 4–30 秒普通生成、30–180 秒超长、延长、精确编辑、工业工作流；并明确删除旧 15 秒强制切分、9/3/3/12 混合上限、500 字符上限和未经验证的 1080p/CLI 声称。[README#L17-L43](https://github.com/woodfantasy/Seedance-ShotDesign-Skills/blob/05e5c3f1aded04d816d71a2c376d132b9a2f5aaf/README.md#L17-L43)

`SKILL.md` 要求先读取 `references/seedance-specs.md`，把硬限制、稳定性建议和未验证项目分层；按意图路由到 standard、ultra_long、extension、smart/advanced edit、viewpoint、BGM、creative transfer、green screen、rough/fine white model、seamless transition、storyboard。[SKILL.md#L18-L52](https://github.com/woodfantasy/Seedance-ShotDesign-Skills/blob/05e5c3f1aded04d816d71a2c376d132b9a2f5aaf/SKILL.md#L18-L52)

`references/seedance-specs.md` 是该仓库的“平台规范”文件：标准 4–30 秒、Long Video 30–180 秒、图片 30、视频 10、音频 10；视频单文件 200MB、24–60fps；支持 audio-only；同时提醒不要把稳定性区间当硬拒绝。[seedance-specs.md#L14-L83](https://github.com/woodfantasy/Seedance-ShotDesign-Skills/blob/05e5c3f1aded04d816d71a2c376d132b9a2f5aaf/references/seedance-specs.md#L14-L83)

### 6. woyin2024/lengyi-seedance2.5-prompt：资产图优先、20–30 秒多镜头

README 的定位是把小说片段、一句剧情或主题词转成最多 30 秒的连续多镜头提示词，并先给主体/场景 T2I 资产图提示词。[README](https://github.com/woyin2024/lengyi-seedance2.5-prompt/blob/a43cdfd3bfa5ee7900f71584b2b04f0143abb381/README.md)

`SKILL.md` 的硬规则非常具体：

- 默认总时长 20–30 秒，上限 30 秒；镜头数由故事节奏决定，不用总时长除平均值；
- 先建立主体/场景锚点，再写资产图 T2I，主体使用干净背景，场景排除人物；
- 视频提示词固定为 `主体：` / `场景：` / `音乐：不要生成任何背景音乐，只生成对应音效` / `镜头N`；镜头正文只写画面，不写音效、剧情作用或叙事解释；
- 每镜自检：至少一个强动词、一个镜头运动词、一个环境/光线动态；全文 ≤4000 字。[SKILL.md#L8-L24](https://github.com/woyin2024/lengyi-seedance2.5-prompt/blob/a43cdfd3bfa5ee7900f71584b2b04f0143abb381/SKILL.md#L8-L24)、[SKILL.md#L62-L110](https://github.com/woyin2024/lengyi-seedance2.5-prompt/blob/a43cdfd3bfa5ee7900f71584b2b04f0143abb381/SKILL.md#L62-L110)

模板文件 [`references/templates.md`](https://github.com/woyin2024/lengyi-seedance2.5-prompt/blob/a43cdfd3bfa5ee7900f71584b2b04f0143abb381/references/templates.md) 给出固定输出模板、完整示例、镜头数量决策表、风格/景别/运镜/环境动态/可见情绪词库。

## 2.0 与 2.5 的差异表

| 维度 | 2.0 Skills 的共同写法 | 2.5 Skills 的共同写法 |
|---|---|---|
| 任务形态 | 以“写一条提示词”为主，模板驱动 | 先选择工作流/模式，再按模式合同生成提示词 |
| 时长假设 | 4–15 秒；长内容拆成多段延长 | 普通 4–30 秒；Long Video 30–180 秒；原生延长单独路由 |
| 素材上限 | 常见 9 图 / 3 视频 / 3 音频 / 12 混合 | 常见 30 图 / 10 视频 / 10 音频；不再默认旧混合 12 上限 |
| 引用系统 | `@图片N/@视频N/@音频N`，用途写在提示词内 | 同样要求角色绑定，但额外强调 scope、排除项、单一控制权 |
| 时间控制 | 10 秒以上建议 0–3/3–6/6–10/10–15 | 按 simple prose、stages、second-level、acts 选择粒度 |
| 编辑与延长 | 多数只给文字模板 | 专门处理 Smart/Advanced/Video Edit、BGM、视角、绿幕、白模、无缝转场 |
| 资产一致性 | 主要是重复角色/场景引用 | 主体 brief、关键帧、连续性 bible、版本/失败诊断成为一等内容 |
| 执行边界 | 有些仓库附 API CLI 或直接声称可生成 | 多数 2.5 导演 Skill 明确只做规划/提示词；Atlas 单独提供执行适配器 |

## 使用这些仓库时的事实风险

1. README 中的“官方”“首发伙伴”“通过率”“4K”等均是仓库作者文字；应以对应仓库引用的 ByteDance/Dreamina 手册和实际入口为准。
2. 2.0 仓库中的 9/3/3/12 限制与 2.5 仓库中的 30/10/10 限制属于不同版本/不同平台快照，不能直接混用。
3. `zhanghaonan777` 的 API model ID、`AtlasCloudAI` 的供应商路由、以及任何 CLI 命令，都不应在没有当前供应商文档验证时当成 Seedance 官方协议。
4. 本文只查看 GitHub 文本文件，没有声称实际运行这些 Skill 或验证生成结果；仓库中的评测、脚本和示例是作者提供的实现材料。

## 与本项目现有 Seedance Skill 的关系

本项目此前记录的 `LeoYeAI/seedance-skills` commit `797e16efaa3c5ac01c0e391d0b8466a87cc5aadc` 属于更大的 Seedance 2.0 Skill OS（主 `SKILL.md` + `skills/` 与 `references/` 大量子文件）。本次 GitHub 检索未把它重复列入版本表，但其 commit 与路径仍可直接查看：[`LeoYeAI/seedance-skills@797e16e`](https://github.com/LeoYeAI/seedance-skills/tree/797e16efaa3c5ac01c0e391d0b8466a87cc5aadc)、[`SKILL.md`](https://github.com/LeoYeAI/seedance-skills/blob/797e16efaa3c5ac01c0e391d0b8466a87cc5aadc/SKILL.md)、[`skills/`](https://github.com/LeoYeAI/seedance-skills/tree/797e16efaa3c5ac01c0e391d0b8466a87cc5aadc/skills)、[`references/`](https://github.com/LeoYeAI/seedance-skills/tree/797e16efaa3c5ac01c0e391d0b8466a87cc5aadc/references)。
