# 《项目名》第一集制作包

> 制作包格式：`vozeb-drama-production-package-v1`
>
> 模板版本：由 `pnpm compile:skills` 自动生成；规范来源：`drama-video-director@{{DRAMA_VIDEO_DIRECTOR_VERSION}}`（Skill hash：`{{DRAMA_VIDEO_DIRECTOR_HASH}}`，制作包规范 hash：`{{DRAMA_PACKAGE_SPEC_HASH}}`，服务端制作包规则 hash：`{{DRAMA_PACKAGE_RULES_HASH}}`）。
>
> 使用约定：本模板是当前 v1 制作包的填写入口。完整制作包必须同时提供可导入的规范对象 JSON；JSON 是导入事实源，下面的章节是面向人工阅读的确定性展示。不要把历史制作包、旧 generationPrompt 或旧分镜正文当作新包模板。
>
> v1 固定保留 13 个一级章节；每集必须完整提供剧本、场次、镜头、资产、表演、声音、连续性、逐帧计划和 QC 数据。
>
> 目标平台：按当前锁定生产方案填写｜语言：按当前项目填写｜画幅：按当前项目填写｜成片：按当前方案填写

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

### 9:16 竖屏导演规则

- 当前项目画幅与安全区：按锁定生产方案填写，不把本标题当作强制比例值。
- 视觉与叙事规则：只填写本项目实际采用的导演规则。

## 二、原创第一章

### 第一章：章节名

连续文学正文。

## 三、第一集文学剧本

### 基础设定

- 片长：按当前生产方案填写。
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

`framePlan.start.source` 只能是 `independent` 或 `previous_accepted_actual_tail`；`framePlan.end.required` 必须是布尔值。`framePlan.referenceManifest` 是参考图职责和顺序的唯一事实源，必须与当前镜头声明的角色、场景、道具和线索绑定；每张参考图只承担一个用途，不把 URL、内部 ID 或绑定信息写入图片正文。`framePolicy` 为 `agent` 时按真实动作节点自适应提供 2–9 帧；选择 `fixed-4` 或 `fixed-5` 时分别提供 4 或 5 帧。

### 静态图片帧规则

{{DRAMA_VIDEO_DIRECTOR_STATIC_FRAME_RULES}}

## 五、角色一致性资产

### 5.1 角色名｜C01｜全量角色卡 Prompt

```text
角色一致性 Prompt。
```

角色资产必须保留项目正式资产目录中的稳定 code、身份、轮廓、材质和基准图状态；本集不出镜的已登记角色也要在资产表中说明不出镜，不进入本集镜头参考绑定。

## 六、场景一致性资产

### 6.1 场景名｜S01｜场景 Prompt

```text
场景一致性 Prompt。
```

场景全景基准图保持高清、单视角、无人、无文字。`backgroundNpcPolicy` 只表达场景策略；背景 NPC 需要出现在镜头时，写入关键帧或视频时间段的可见群像结果，不进入角色资产编码。

## 七、关键视频资产 Prompt

### V01｜首帧：标题

```text
关键视频资产 Prompt。
```

参考图职责、参考图顺序和资产绑定不写入静态图片正文，统一保存到 `framePlan.referenceManifest` 和服务端执行层。

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

含对白镜头必须在规范对象中逐句记录相对镜头的开始、结束、前后停顿和语速；这些内容不写入静态图片正文。

### 沉默设计

- SH01：静默说明。

## 十、声音设计

| 镜号 | 环境音 | 拟音 | 音乐 |
| ---- | ------ | ---- | ---- |
| SH01 |        |      |      |

声音字段服务视频和声音执行，不复制到 `imagePrompt`。

## 十一、分段视频 Prompt

### P01｜SH01｜按真实时间段填写

```text
当前 Agent 生成的完整 videoPrompt。
```

每个真实时间段必须写出具体时间范围、起点、动作与触发、可见衔接和终点；按动作节点切分，不机械逐秒拆写。该章节只展示当前 `videoPrompt` 原文，不从 `framePlan` 重新拼接。

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

- 规范对象可解析：待检查。
- 静态帧唯一事实源：待检查。
- 静态帧是否存在主体、冻结状态和可验收空间结果：待检查。
- 动作字段与静态画面字段是否分工清晰：待检查。
- 历史正文、内部 ID、URL 和参考绑定是否未混入公开提示词：待检查。

### 视频评分

| 维度 | 分数 | 结论   |
| ---- | ---: | ------ |
| 总分 |    0 | 待生成 |

### 最终视频 QC

- 待实际生成后复检。
