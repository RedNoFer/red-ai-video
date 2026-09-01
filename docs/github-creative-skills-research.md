# GitHub 热门短剧与图片生成 Skills/项目调研

> 调研日期：2026-08-31。项目热度用 GitHub 官方 REST API 在本日的 `stargazers_count`、`pushed_at` 和 `license.spdx_id` 快照表示；能力判断只依据对应仓库的官方 README、源码说明、Release 或 LICENSE。Stars 会持续变化，以下数字用于比较而不是承诺。
>
> 这里的“Skill”包含两种形态：可直接导入 Agent 的 `SKILL.md` 规则包，以及需要由 VOZEB PRO Provider/工作流适配的开源模型或创作工具。模型权重、第三方节点和在线服务的许可证可能与代码仓库不同，接入前必须分别复核。

## 结论先行

最适合当前 VOZEB PRO 的不是引入一个“大而全”的外部产品，而是把外部能力拆成四层：

1. **规划规则层**：继续以当前固定版本的 `seedance-director` 为短剧默认 Skill；从 `seedance-skills` 只吸收 sequence、continuation、camera、lighting、characters、audio、antislop 等与当前制作包契约直接相交的规则。
2. **故事一致性层**：用 StoryDiffusion 的连续自注意力思路生成角色/场景/分镜候选图；用 IP-Adapter 保持身份与参考风格，用 ControlNet 锁定姿态、深度、边缘和构图。
3. **图片执行层**：优先评估 InvokeAI（Apache-2.0）作为图片 Provider；需要复杂节点编排时再以外部服务方式接 ComfyUI（GPL-3.0），不要把 GPL 代码直接链接进 VOZEB PRO。
4. **视频执行层**：Wan2.1（Apache-2.0）最贴合当前的 T2V/I2V/FLF2V/VACE 与首尾帧工作流；LTX-Video/Open-Sora 可做后续 Provider 试验，不应先改动剧本和分镜数据契约。

当前项目的 [制作包 v1 规范](drama-production-package-v1.md) 已要求 `performancePlan`、逐句 `dialoguePerformance`、`lightingPlan`、`continuity`、`framePlan` 和每帧可见状态；因此外部仓库应作为**规划补充或执行器**，不能绕过这些服务端字段，也不能把外部 README 全文注入公开对话。

## 当前热门的 Agent Skill 仓库

下面单独列出真正以 `SKILL.md`/Agent Skill 为交付物的仓库；它们和后文的模型/工作台项目不是同一类依赖。快照同样来自 GitHub 官方 API，适合做热度排序，不代表质量或生产可用性。

| Skill 仓库 | Stars / 最近推送 / 许可证 | 主要能力 | 与 VOZEB 的整合建议 |
|---|---:|---|---|
| [dexhunter/seedance2-skill](https://github.com/dexhunter/seedance2-skill) | 3,478 / 2026-02-18 / MIT（[API](https://api.github.com/repos/dexhunter/seedance2-skill)） | Seedance 2.0 的参考图 `@` 语法、镜头语言、结构模板，覆盖广告、短剧、MV 等。见 [README](https://github.com/dexhunter/seedance2-skill#readme)。 | **可提炼**。补充当前 `seedance-director` 的供应商语法和模板；不替换项目的首尾帧、连续性和失败终态规则。 |
| [songguoxs/seedance-prompt-skill](https://github.com/songguoxs/seedance-prompt-skill) | 2,745 / 2026-02-12 / 未声明（[API](https://api.github.com/repos/songguoxs/seedance-prompt-skill)） | Seedance 2.0 提示词 Skill，专注视频提示词生成。 | **仅审查后试用**。许可证未声明，先固定 commit 并完成法务确认；不要直接启用为默认 Skill。 |
| [eternityspring/shuohao-skills](https://github.com/eternityspring/shuohao-skills) | 2,464 / 2026-08-26 / Apache-2.0（[API](https://api.github.com/repos/eternityspring/shuohao-skills)） | `novel-outline`、`novel-characters`、`novel-art`、`novel-script`、`novel-storyboard`，带时长、节拍、资产和分镜质量门。见 [README](https://github.com/eternityspring/shuohao-skills#readme)。 | **短剧规则高匹配**。吸收剧本节拍/时长和分镜质量门；不要引入其五份 Markdown 作为第二套事实源，最终仍落 `vozeb-drama-production-package-v1`。 |
| [liangdabiao/Seedance2-Storyboard-Generator](https://github.com/liangdabiao/Seedance2-Storyboard-Generator) | 2,239 / 2026-06-19 / 未声明（[API](https://api.github.com/repos/liangdabiao/Seedance2-Storyboard-Generator)） | 小说/故事到多集剧本、C/S/P 资产编号、Seedance 时间轴提示词和尾帧衔接。见 [README](https://github.com/liangdabiao/Seedance2-Storyboard-Generator#readme)。 | **可借鉴编号和时间轴**。许可证未声明，不能直接作为依赖；C/S/P 需映射到现有资产 ID，不得按文本去重。 |
| [zenstory-ai/drama-skills](https://github.com/zenstory-ai/drama-skills) | 1,413 / 2026-08-31 / MIT（[API](https://api.github.com/repos/zenstory-ai/drama-skills)） | 十个技能覆盖项目路由、剧本、资产、图片提示词、分镜、视频提示词、生产确认和审查，并强调 preview→confirm→run。见 [README](https://github.com/zenstory-ai/drama-skills#readme)。 | **最适合做流程规则参考**。优先提炼 `short-drama-image-prompts`、`short-drama-storyboard`、`short-drama-video-prompts` 和 review 的边界；不要复制其文件系统 Dashboard 或 adapter。 |
| [smixs/visual-skills](https://github.com/smixs/visual-skills) | 233 / 2026-08-08 / CC-BY-4.0（[API](https://api.github.com/repos/smixs/visual-skills)） | `image`/`video` 两个导演 Skill，包含戏剧结构、镜头职责、连续性、模型特定提示词和角色/场景参考图规则。见 [README](https://github.com/smixs/visual-skills#readme)。 | **规则可选吸收**。有助于强化 `drama-planning` 与图片提示词；必须保留署名，且不能把它的英文模型默认、禁词或隐藏规则覆盖项目中文输出和公开摘要。 |
| [freestylefly/awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) | 26,095 / 2026-08-30 / MIT（[API](https://api.github.com/repos/freestylefly/awesome-gpt-image-2)） | GPT-Image-2 的 500+ 案例、20+ 工业模板和可导入的 style-library Skill，强调结构化 Prompt-as-Code。见 [README](https://github.com/freestylefly/awesome-gpt-image-2#readme)。 | **图片 Skill 首选参考库**。将角色/场景/叙事类模板转为 `direction` 或图片 Prompt 片段；不要把整库常驻注入规划上下文，也不要让模板覆盖 `DRAMA_STYLE_*` 和精确尺寸契约。 |
| [wuyoscar/GPT-Image2-Skill](https://github.com/wuyoscar/GPT-Image2-Skill) | 5,013 / 2026-08-10 / MIT（[API](https://api.github.com/repos/wuyoscar/GPT-Image2-Skill)） | GPT Image 2 提示词图库、编辑/参考图工作流、Agent Skill 和 CLI。见 [README](https://github.com/wuyoscar/GPT-Image2-Skill#readme)。 | **可吸收编辑语义**。借用 change/preserve/constraints 和参考图角色；CLI、API Key 和供应商调用必须排除，统一走 VOZEB 图片任务 Provider。 |
| [YouMind-OpenLab/ai-image-prompts-skill](https://github.com/YouMind-OpenLab/ai-image-prompts-skill) | 920 / 2026-08-31 / MIT（[API](https://api.github.com/repos/YouMind-OpenLab/ai-image-prompts-skill)） | 10,000+ 多模型图片提示词、语义检索、内容改写和示例图。见 [README](https://github.com/YouMind-OpenLab/ai-image-prompts-skill#readme)。 | **仅作可选灵感库**。动态远程内容不适合生成审计和可复现默认值；如接入，必须做版本快照、来源记录和用户显式选择。 |

### Skill 仓库的直接结论

- **最值得整合到当前剧本链**：`shuohao-skills` 的剧本/节拍/时长门、`zenstory-ai/drama-skills` 的阶段所有权与审查、`dexhunter/seedance2-skill` 的 Seedance 语法。它们都应被提炼为服务端结构化规则，而不是并行写 Markdown 项目。
- **最值得整合到当前图片链**：`awesome-gpt-image-2` 的模板/案例索引、`GPT-Image2-Skill` 的编辑 preserve 语义、`smixs/visual-skills` 的角色连续性检查。生产结果仍必须写入现有资产、任务和 `frameEvidence`。
- **不建议直接启用**：没有许可证的仓库、需要安装 CLI/自带 API Key 的仓库、把文件系统文档当作唯一真相的仓库，以及会自动调用供应商的 adapter。外部 Skill 的说明、脚本、模型 ID 和 API 地址不能进入公开对话或替代管理员模型目录。

## 热门与活跃项目快照

| 项目 | GitHub 快照（Stars / 最近推送 / 许可证） | 官方 README 能力 | 对 VOZEB PRO 的判断 |
|---|---|---|---|
| [ArcReel/ArcReel](https://github.com/ArcReel/ArcReel) | 4,289 / 2026-08-31 / AGPL-3.0（[API](https://api.github.com/repos/ArcReel/ArcReel)） | 自托管 AI 视频工作台；把小说/剧本转为角色、场景、道具、分镜、视频、配音和剪映草稿，含一致性、审核、成本追踪和可恢复流程。见 [README](https://github.com/ArcReel/ArcReel#readme)。 | **架构参考，高相关**。本项目快捷方式中的 `image-motion`、`drama-planning` 已记录该仓库为来源；可继续对照其阶段化流程，但 AGPL 网络服务义务要求把代码复用和 Provider 边界分开审查。 |
| [LeoYeAI/seedance-skills](https://github.com/LeoYeAI/seedance-skills) | 38 / 2026-07-08 / MIT（[API](https://api.github.com/repos/LeoYeAI/seedance-skills)） | README 列出 28 个 Agent Skill、56 份参考文档，覆盖 interview、sequence、continuation、camera、motion、lighting、characters、audio、pipeline、QC，以及 T2V/I2V/V2V/R2V/FLF2V、多片段和多语言。见 [README](https://github.com/LeoYeAI/seedance-skills#readme)。 | **直接可整合，优先级最高**。当前 `seedance-director` 已固定到该仓库 commit；建议按需导入少数规则，保持 VOZEB 的公开提示词、制作包和连续性校验不变，不把 28 个 Skill 常驻暴露给所有工作区。 |
| [HVision-NKU/StoryDiffusion](https://github.com/HVision-NKU/StoryDiffusion) | 6,455 / 2024-09-26 / Apache-2.0（[API](https://api.github.com/repos/HVision-NKU/StoryDiffusion)） | 一致性自注意力用于长序列角色一致图片，兼容 SD1.5/SDXL；至少 3 个文本提示，另有条件图之间的长视频运动预测。视频模型源码/权重仍在 README TODO。见 [README](https://github.com/HVision-NKU/StoryDiffusion#readme)。 | **图片分镜高匹配，视频暂不依赖**。可作为 `character-design`/`drama-planning` 的候选图 Provider，按 `framePlan.frames` 批量生成并保留每帧独立 Prompt；不能宣称它已解决视频连续性。 |
| [wonderunit/storyboarder](https://github.com/wonderunit/storyboarder) | 3,823 / 2024-03-17 / GitHub API 未识别 SPDX（[API](https://api.github.com/repos/wonderunit/storyboarder)） | 面向编剧/导演的手绘故事板工具，支持 Fountain screenplay、onion skin、参考层、轨迹回放、协作和多格式导出。见 [README](https://github.com/wonderunit/storyboarder#readme) 与 [许可证说明](https://wonderunit.com/thoughts-on-free-and-open-source/)。 | **人工审核/导出中等匹配**。可设计 `framePlan` 或 Fountain 导出适配器，让导演在生成前后验收镜头；许可证与资产使用条款不清，不能作为服务端依赖前先过法务。 |
| [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI) | 130,826 / 2026-08-31 / GPL-3.0（[API](https://api.github.com/repos/Comfy-Org/ComfyUI)） | 模块化节点图和本地 API；支持图像、视频、音频、3D、参考条件、ControlNet/Adapter、队列、部分重算、工作流 JSON、离线运行和大量模型。见 [README](https://github.com/Comfy-Org/ComfyUI#readme)。 | **图片/视频执行器高匹配，但需隔离**。可把工作流 JSON、输入哈希和输出尺寸映射到 Provider 任务；建议独立进程/服务调用并保存 workflow 版本，避免 GPL 代码与 VOZEB 核心形成不可控衍生关系。 |
| [invoke-ai/InvokeAI](https://github.com/invoke-ai/InvokeAI) | 28,074 / 2026-08-31 / Apache-2.0（[API](https://api.github.com/repos/invoke-ai/InvokeAI)） | 本地 Web server 与 React UI；统一 Canvas、工作流/节点、画廊与生成元数据，支持生成、迭代、局部重绘、放大和多种 SD/Flux/Qwen/Wan 等模型。见 [README](https://github.com/invoke-ai/InvokeAI#readme)。 | **图片 Provider 首选候选**。与当前 `image-task-runtime`、Canvas 和资产元数据更容易做服务边界映射；先验证其稳定 HTTP/队列接口，再实现模型、尺寸、seed、参考图和结果数组的显式映射。 |
| [AUTOMATIC1111/stable-diffusion-webui](https://github.com/AUTOMATIC1111/stable-diffusion-webui) | 164,752 / 2026-03-02 / AGPL-3.0（[API](https://api.github.com/repos/AUTOMATIC1111/stable-diffusion-webui)） | Gradio Stable Diffusion Web UI，覆盖 txt2img/img2img、inpainting、变体、超分、生成参数回读、扩展脚本、API 和历史元数据。见 [README](https://github.com/AUTOMATIC1111/stable-diffusion-webui#readme)。 | **兼容性后端，中等匹配**。生态很大但架构偏 UI/扩展，且 AGPL；不建议作为 VOZEB 新核心，只有已有用户工作流需要时才做隔离 Provider。 |
| [lllyasviel/ControlNet](https://github.com/lllyasviel/ControlNet) | 34,102 / 2024-02-25 / Apache-2.0（[API](https://api.github.com/repos/lllyasviel/ControlNet)） | 以边缘、线稿、姿态、深度、分割、法线等条件控制 Stable Diffusion，可组合多个 ControlNet。见 [README](https://github.com/lllyasviel/ControlNet#readme)。 | **关键帧控制高匹配**。把 `framePlan` 的姿态/深度/构图约束作为结构化控制输入；它不负责角色语义、色彩脚本或跨镜头状态，且主仓库更新较旧，需锁定经过验证的模型与节点版本。 |
| [tencent-ailab/IP-Adapter](https://github.com/tencent-ailab/IP-Adapter) | 6,680 / 2024-06-28 / Apache-2.0（[API](https://api.github.com/repos/tencent-ailab/IP-Adapter)） | Image Prompt Adapter，让预训练文生图模型使用图像提示，README 提供文生图、图生图和多种 adapter 组合。见 [README](https://github.com/tencent-ailab/IP-Adapter#readme)。 | **角色/场景参考高匹配**。可将角色基准图、场景锚点和风格参考绑定到 `referenceManifest`，但必须继续由项目层维护资产编码、有效性和首尾帧验收。 |
| [Wan-Video/Wan2.1](https://github.com/Wan-Video/Wan2.1) | 16,919 / 2026-03-05 / Apache-2.0（[API](https://api.github.com/repos/Wan-Video/Wan2.1)） | 开源视频套件，支持 T2V、I2V、视频编辑、T2I、V2A，并提供 FLF2V 和 VACE；README 说明 T2V-1.3B 约 8.19GB 显存可生成 5 秒 480P，且已集成 Diffusers/ComfyUI。见 [README](https://github.com/Wan-Video/Wan2.1#readme)。 | **视频 Provider 高匹配**。FLF2V 对当前首尾帧模式最有价值；应接在已验收分镜帧之后，显式传 `first_frame`/`last_frame`、比例、时长和版本，不让模型层改写连续性政策。自托管 GPU 成本仍需单独评估。 |
| [Lightricks/LTX-Video](https://github.com/Lightricks/LTX-Video) | 10,920 / 2026-01-05 / Apache-2.0（[API](https://api.github.com/repos/Lightricks/LTX-Video)） | 支持 T2V/I2V、多关键帧、关键帧动画、前后扩展、V2V；README 已将 LTX-2 标为后续主仓库，并提到同步音视频、IC-LoRA、3D camera logic。见 [README](https://github.com/Lightricks/LTX-Video#readme)。 | **后续试验，中等匹配**。多关键帧与扩展能力适合长镜头研究，但代码仓库正在迁移到 LTX-2；README 还单独列出 OpenRail-M 权重许可，不能只看代码仓库 Apache-2.0 就上线商用。 |
| [hpcaitech/Open-Sora](https://github.com/hpcaitech/Open-Sora) | 29,329 / 2026-04-09 / Apache-2.0（[API](https://api.github.com/repos/hpcaitech/Open-Sora)） | 面向高效视频生产；README 版本说明覆盖 T2V/I2V/V2V、2–15 秒、144p–720p、多比例、视频处理流水线，并有 Prompt Refine 与 seed。见 [README](https://github.com/hpcaitech/Open-Sora#readme)。 | **研究/基准用途**。能力面广但推理、显存和模型版本管理复杂，不宜先替换现有上游；可在统一 Provider 契约稳定后作为可选实验模型。 |
| [guoyww/AnimateDiff](https://github.com/guoyww/AnimateDiff) | 12,231 / 2024-07-31 / Apache-2.0（[API](https://api.github.com/repos/guoyww/AnimateDiff)） | 插件式运动模块，把社区文生图模型变成动画生成器；支持 MotionLoRA、SparseCtrl 和 Gradio 示例。见 [README](https://github.com/guoyww/AnimateDiff#readme)。 | **图片动效备选**。可作为 `image-motion` 的本地实验 Provider，但主分支面向 SD1.5、更新较旧，不承担当前短剧的多镜头首尾帧契约。 |

## 与当前 Skills 的整合映射

| 当前能力 | 推荐吸收/接入 | 需要保留的 VOZEB 事实源与边界 |
|---|---|---|
| `seedance-director`（短剧默认） | `seedance-sequence`、`seedance-continuation`、`seedance-camera`、`seedance-lighting`、`seedance-characters`、`seedance-audio`、`seedance-antislop` | 继续固定 Skill commit、版本、内容哈希和审计；外部规则只用于规划输入，公开摘要不得显示内部导演规则。 |
| `drama-planning` | StoryDiffusion 的多提示序列思想；Storyboarder 的 Fountain/故事板导出思路 | 服务端仍生成 `vozeb-drama-production-package-v1` 的 13 章，并强制每镜表演、灯光、连续性、逐帧动作和 QC；不能只保存外部 Markdown。 |
| `character-design` | IP-Adapter 做身份/风格参考；StoryDiffusion 做多帧一致候选图；ControlNet 做姿态/构图约束 | 角色编码、资产版本、参考图可读性和 `referenceManifest` 由 VOZEB 持有；外部模型结果必须完整落盘，不能只保留第一张。 |
| `image-motion` | Wan2.1 I2V/FLF2V、LTX-Video I2V、AnimateDiff；ComfyUI 可承载组合工作流 | 只能从已验收图片/视频帧开始；`first_frame`/`last_frame`、实际宽高、任务版本和失败终态必须走现有 Provider/任务存储。 |
| Canvas / 生图工作台 | InvokeAI 或 ComfyUI 工作流，ControlNet/IP-Adapter 节点 | 保持精确自定义宽高优先级、参考图比例继承、多结果落盘、`recordId + resultId` 定位和公开消息标记；不要把工作流内部 Prompt 作为用户消息。 |

## 推荐落地顺序

### P0：先做规则与审计，不接新模型

- 保持当前 `seedance-director` 为短剧必选默认；将外部 Skill 以固定 commit 导入，记录 `sourceRepository`、`sourcePath`、`sourceCommit`、`sourceContentHash`、许可证和工作区。
- 在 `drama-planning`/制作包生成器中吸收 sequence、continuation、camera、lighting、characters、audio、antislop 的**结构化要求**，确保最终落库仍符合 13 章和每镜 `framePlan`。
- 增加能力矩阵：Provider 是否支持 T2V/I2V/FLF2V、多参考图、首尾帧、精确尺寸、异步取消、结果数组和真实媒体校验；没有公开契约的能力不进入目录。

### P1：图片连续性闭环

- 先以 InvokeAI（Apache-2.0）做图片 Provider 试点；需要多节点时以独立 ComfyUI 服务验证同一任务契约。
- 把角色基准图、场景锚点、姿态/深度图分别映射到 IP-Adapter/ControlNet；StoryDiffusion 只负责候选图生成，不改写项目资产状态。
- 回归角色一致性、参考图失效回退、精确宽高、多结果登记、失败终态和人工验收；所有新 Provider 都复用现有图片协议清理和媒体可读性检查。

### P2：视频 Provider 试点

- 优先试 Wan2.1 FLF2V/I2V：用 `framePlan.start`、已验收实际尾帧和显式结束帧构造请求，按现有 `first_frame`/`last_frame` 契约落盘。
- LTX-Video 仅在确认 LTX-2 迁移路径和模型权重许可证后评估；Open-Sora 作为研究 Provider，AnimateDiff 作为轻量图片动效备选。
- 所有视频模型都必须经过真实浏览器回归：结果 URL、固有宽高、时长、播放器清理、窄屏控件和连续性证据不能只靠模型参数推断。

## 许可证与运营风险

- **MIT / Apache-2.0**：`seedance-skills`、StoryDiffusion、InvokeAI、ControlNet、IP-Adapter、Wan2.1、Open-Sora、AnimateDiff 的仓库许可证相对适合作为规则或服务边界内的依赖；仍要复核模型权重、训练数据和第三方节点许可。
- **AGPL-3.0**：ArcReel、AUTOMATIC1111、ComfyUI。网络服务形态、修改发布和组合方式需单独做法务判断；推荐通过独立进程/API 进行能力隔离，不把代码复制进 VOZEB 核心。ArcReel 的架构可参考，但不能把参考等同于自动获得许可。
- **许可证不明确或代码/权重分离**：Storyboarder 的 GitHub API 没有 SPDX，需查看其官方许可证说明；LTX-Video README 明确代码仓库与 OpenRail-M 权重许可并存；上线前按具体 checkpoint、LoRA、ControlNet、ComfyUI 节点逐项登记。

## 不建议的做法

- 不要把 ComfyUI/A1111 的工作流 JSON 或 README 全文直接注入 Agent 提示词；只保存版本化工作流和结构化参数。
- 不要让 StoryDiffusion、IP-Adapter 或 ControlNet 代替 `continuity`、`frameEvidence`、人工验收和公开消息标记。
- 不要因为 Wan2.1/LTX/Open-Sora 支持 I2V 就跳过项目资产绑定、首尾帧可读性验证、任务幂等和失败终态。
- 不要把“热门”当作生产就绪：ControlNet、StoryDiffusion、AnimateDiff 的主仓库推送时间较早，实际运行需锁定依赖、模型权重和可复现测试环境。

## 最终推荐

**立即整合**：保留并细化 `seedance-director`，选择性吸收 `seedance-skills` 的导演规则；以 StoryDiffusion + IP-Adapter + ControlNet 补强角色/场景/分镜图片一致性；用 InvokeAI 做第一图片 Provider。

**第二阶段整合**：以 Wan2.1 作为支持首尾帧的视频 Provider，ComfyUI 作为隔离的复杂工作流执行服务。

**暂缓或仅实验**：A1111（AGPL 且 UI/扩展耦合）、LTX-Video（迁移与权重许可待确认）、Open-Sora（基础设施成本高）、AnimateDiff（旧分支和 SD1.5 偏向）、Storyboarder（许可证与自动化边界需确认）。

这样可以让外部项目提升规划质量、参考图一致性和 Provider 覆盖，而不破坏 VOZEB PRO 已有的剧本、图片、分镜、连续性、任务审计和制作包事实源。
