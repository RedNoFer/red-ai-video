# GitHub 人物表演与场景光色能力调研

> 调研日期：2026-08-20。Stars、`pushed_at` 和仓库状态来自 GitHub 官方仓库 API 快照；能力判断只依据对应仓库的 README、源码或官方项目页。这里的“Skill”指可接入生产流程的开源能力，不代表这些仓库本身就是 VOZEB PRO 的 Codex Skill。

## 结论先行

GitHub 上目前没有一个成熟、通用、可以直接插入 VOZEB PRO 镜头生成链路的“人物情绪管理 Skill + 场景色彩光泽图 Skill”。可用资源分成两类：

1. **人物表演模型**：从音频、驱动视频或参考情绪图生成面部/口型/表情运动；它们不是剧本分析器，也不会自动产生可审核的情绪弧线、逐句语气和微表情 Prompt。
2. **图像光照/条件控制模型**：对关键帧进行重光照、结构或参考图约束；它们不是跨镜头色彩脚本管理器，也不能单独保证视频时间一致性。

因此，推荐把开源模型放在“执行/参考素材”层，把人物情绪、表演节奏、色彩脚本和连续性作为 VOZEB PRO 内置的结构化规划层。不能只安装一个 GitHub 项目就解决前面提出的 Prompt 缺字段问题。

## 人物情绪与表演

### Tencent-Hunyuan/HunyuanVideo-Avatar

- 仓库：[Tencent-Hunyuan/HunyuanVideo-Avatar](https://github.com/Tencent-Hunyuan/HunyuanVideo-Avatar)
- GitHub 快照：约 **2.1k stars**；`pushed_at` **2025-12-16**，仓库 API 的最近更新 **2026-08-18**。
- README 明确提供音频驱动的人物动画、多角色对话和情绪可控视频；其 Audio Emotion Module（AEM）从**情绪参考图**提取情绪线索，并支持通过音频控制面部情绪。
- 适合：已有对白音频、角色基准图和情绪参考图时，作为“表演执行器”或单独的说话角色视频 Provider。
- 不足：输入/输出契约是模型推理，不是镜头级表演计划；不会替项目决定“情绪目标 → 情绪递进 → 逐句停顿/重音 → 微表情阶段”。官方 README 还要求 Linux/NVIDIA，建议 96GB 显存，工程成本高。

### KlingAIResearch/LivePortrait

- 仓库：[KlingAIResearch/LivePortrait](https://github.com/KlingAIResearch/LivePortrait)
- GitHub 快照：约 **18.9k stars**；`pushed_at` **2026-06-01**，仓库 API 的最近更新 **2026-08-20**。
- 官方 `src/config/argument_config.py` 暴露 `animation_region`（`exp`/`pose`/`lip`/`eyes`/`all`）、`flag_eye_retargeting`、`flag_lip_retargeting`、`driving_option` 和 `driving_multiplier`；README 说明其核心是肖像动画、拼接和 retargeting 控制。
- 适合：用已有驱动视频或动作模板控制眼睛、嘴唇、表情区域和头部姿态；作为角色表情参考片或后处理组件。
- 不足：它是驱动式表情/姿态迁移，不理解剧本语义，也不提供“愤怒逐步压抑”“说到某个词时眉心收紧”这类语言级表演控制。官方参数中眼/唇 retargeting 仍标为 WIP/不推荐默认开启，不能当成稳定的语义情绪引擎。

### EmotiveTalk

- 项目页仓库：[EmotiveTalk/EmotiveTalk.github.io](https://github.com/EmotiveTalk/EmotiveTalk.github.io)
- GitHub 快照：约 **4 stars**；`pushed_at` **2025-02-06**，仓库 API 的最近更新 **2026-05-21**。
- 官方项目页描述了音频解耦、情绪视频扩散，以及图像来源/文本来源的情绪控制（如 neutral、angry、happy、surprised）。
- 适合：作为研究方向或评估“文本/参考情绪 → 说话头像表演”的论文原型。
- 不足：该仓库主要是项目展示页，不是可直接接入生产的完整 Provider/Skill；不能据此假设有稳定 API、模型权重、许可证或多角色镜头能力。

## 场景色彩、光照与参考控制

### lllyasviel/IC-Light

- 仓库：[lllyasviel/IC-Light](https://github.com/lllyasviel/IC-Light)
- GitHub 快照：约 **8.5k stars**；`pushed_at` **2025-02-20**，仓库 API 的最近更新 **2026-08-20**。
- 官方 README 明确提供 text-conditioned relighting 和 background-conditioned relighting；输入前景图，可用文字描述 sunshine、window shadow、neon、warm atmosphere 等光照意图。
- 适合：为角色/场景基准图、起始帧和结束帧生成统一方向的主光、补光、窗光、霓虹或夕阳光；把 `lighting` 结构化字段落成可视参考图。
- 不足：主要是**单张图像重光照**，不是视频时间一致性方案；它不会维护跨镜头色彩脚本、曝光连续性或角色肤色锁定。应在关键帧阶段使用，不能直接替代视频生成。

### lllyasviel/ControlNet

- 仓库：[lllyasviel/ControlNet](https://github.com/lllyasviel/ControlNet)
- GitHub 快照：约 **34.1k stars**；`pushed_at` **2024-02-25**。
- 官方定位是“Let us control diffusion models”，以边缘、姿态、深度等条件控制生成结构。
- 适合：锁定场景布局、人物姿态、景别结构和关键帧构图，减少色彩/光泽变化时的构图漂移。
- 不足：不是色彩脚本或光泽图生成器；主责是结构条件控制，且上游仓库更新较旧。不要把它作为人物情绪或电影调色方案。

### Tencent AI Lab/IP-Adapter

- 仓库：[tencent-ailab/IP-Adapter](https://github.com/tencent-ailab/IP-Adapter)
- GitHub 快照：约 **6.7k stars**；`pushed_at` **2024-06-28**。
- 官方定位是用图像 Prompt Adapter 让预训练文生图模型使用图像提示；适合把角色基准图、场景色彩参考图和材质参考图作为条件。
- 适合：在关键帧生成时保持角色身份、场景风格和色彩参考的相似性。
- 不足：它是图像条件适配器，不是情绪理解器，也不是跨镜头色彩管理器；视频一致性仍需由项目层的参考图、连续性状态和镜头编排保证。

## 与当前 VOZEB PRO 的匹配度

当前项目已经有一部分基础设施：

- `DramaShot` 已有 `performanceNotes`、`entryState/exitState.characters[].expression`、`lighting`、`colorPalette`。
- `DramaProductionBible` 已有 `colorScript`。
- 角色 `voiceProfile` 已有 `blueprint`（年龄感、音域、性格、情绪范围、声音质感）和 `instructions`。
- `drama-prompt-compiler.ts` 已编译角色、场景、连续性、对白和镜头运动，但当前视觉工具 Schema 没有强制返回结构化表演计划，也没有把这些表演字段完整编译进 `videoPrompt`。
- 现有 `character-design`、`image-motion`、`drama-planning` 是提示词快捷方式。它们能帮助角色外观、基础图片动效和短剧拆解，但不是人物情绪状态机或色彩脚本引擎；`character-design` 里的“表情/动作参考”也不等于逐句表演指导。

因此，现有 Skills **可以作为输入素材和规划入口，但不能单独解决问题**。尤其是 `image-motion` 的说明集中在主体稳定、动作、镜头运动和时长，没有语气、呼吸、停顿、重音和微表情阶段；`drama-planning` 也只要求对白、时长、景别、机位和动作。

## 推荐组合

```text
剧本/对白
  -> VOZEB PRO 内置「表演导演规划」
     -> emotionalObjective / emotionalArc
     -> utterance tone / pace / pause / emphasis / breath
     -> expression beats（眉眼、嘴角、视线、下颌、呼吸，按起中止分段）
  -> VOZEB PRO 内置「色彩与光照脚本」
     -> palette / key light / fill / rim / contrast / color temperature / transition
  -> 关键帧生成
     -> IP-Adapter / ControlNet（身份、参考图、构图）
     -> IC-Light（单帧重光照与光泽参考）
  -> 视频执行
     -> 普通视频 Provider；需要说话头像时再评估 HunyuanVideo-Avatar 或 LivePortrait
  -> 生成前 QC
     -> 检查结构化表演字段和 lighting/colorScript 已实际进入 executionVideoPrompt
```

### 建议的优先级

1. **先改 VOZEB PRO 的数据契约和 Prompt 编译器**：让每个有对白的镜头强制生成表演谱和色彩/光照谱。这是解决缺字段的根本措施。
2. **再把 IC-Light 用于角色/场景关键帧**：验证光向、色温、轮廓光和反射质感，再把结果作为视频参考帧。
3. **如果 Provider 支持参考图或控制图，再接 IP-Adapter/ControlNet**：它们负责身份、布局和参考风格，不负责情绪语义。
4. **只有明确要做音频驱动说话头像时才接 HunyuanVideo-Avatar/LivePortrait**：两者都应封装为独立 Provider，不能替代所有镜头视频生成。

## 不建议的做法

- 不要把 GitHub 仓库 README 直接当成普通 Skill 指令注入 Prompt。模型代码、推理参数和剧本规划是不同层次。
- 不要因为 `character-design` 提到“表情/动作参考”就认为已经覆盖逐句情绪递进。
- 不要把 IC-Light 的单帧重光照结果直接当成视频色彩一致性保证；必须保存光照脚本和跨镜头连续性状态。
- 不要把 HunyuanVideo-Avatar 或 LivePortrait 当作通用电影镜头模型；它们更适合说话角色/头像表演专项。
- 不要只添加“电影感、光泽、情绪自然、表情丰富”等抽象形容词。生成前 QC 应拒绝没有可观察动作、阶段和参数的 Prompt。

## 最终判断

**有可复用的开源模型能力，但没有一个现成热门 Skill 能自动解决 VOZEB PRO 当前的问题。** 最稳妥的方案是：VOZEB PRO 自己建立结构化“表演导演规划 + 色彩光照脚本”层，再选择性调用 HunyuanVideo-Avatar/LivePortrait、IC-Light、IP-Adapter/ControlNet 作为执行器或参考图工具。这样外部模型升级时，剧本和镜头的可审核契约不会被绑死。
