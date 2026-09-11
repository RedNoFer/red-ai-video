---
title: 不鸣 TokenGo Seedance 视频协议
description: 不鸣视频扁平异步接口与项目多帧参考映射
---

# 不鸣 TokenGo Seedance 视频协议

本项目使用不鸣公开 Skill 文档核对视频协议。来源：

- 路由表：`https://buming.token6688.com/v1/skills`
- 调用指南：`https://buming.token6688.com/v1/skills/guide`
- 模型目录：`https://buming.token6688.com/v1/skills/models?type=video`

## 请求与轮询

- 创建：`POST /v1/videos/generations`
- 查询：`GET /v1/tasks/{task_id}`
- 请求体使用扁平 JSON，不使用 `params` 信封。
- `client_request_id` 用于请求幂等；创建一次任务后不得因首帧、尾帧或多帧再次提交。
- 图片、视频和音频必须是供应商可访问的公网 HTTP(S) 地址。

项目发送的固定字段为 `model`、`prompt`、`mode`、`duration`、`aspect_ratio`、`resolution`、`quality`、`client_request_id`、`images`、`videos`、`audios` 和 `count`。

## 模式映射

| 项目模式 | 不鸣 `mode` | 参考素材规则 |
| --- | --- | --- |
| 无参考 | `text-to-video` | 不发送参考素材 |
| 普通参考 | `reference` | 普通图片按项目选择顺序发送 |
| 首帧 | `first-frame` | `images[0]` 为首帧 |
| 首尾帧 | `first-last` | `images[0]`、`images[1]` 依次为首帧、尾帧 |
| 全能帧 | `reference` | 连续帧按 `keyframeIndex` 排在 `images` 前面，提示词用 `@图片N` 标注 |

项目连续帧最多 5 张；普通资产图可以追加，但必须与连续帧合计满足模型的参考图片上限。项目不把供应商最多 9 张能力扩大为用户侧连续帧上限。

## 已核实模型能力

- `seedance-2-0-official`：支持普通参考、首帧、首尾帧和多帧参考；供应商图片上限 9 张。
- `seedance-2-0-special`：支持普通参考、首帧、首尾帧和多帧参考；供应商图片上限 9 张。
- `seedance-2-0-manju-special`：只支持文生视频、首帧和首尾帧，不支持全能帧。
- `seedance-2-5-special`：供应商页面显示支持 15 秒和 30 秒档位，最多 30 张参考图；项目按 `4-30 秒` 和普通参考、首帧、首尾帧、全能帧能力编排。

模型级合同优先于 Buming 渠道的通用 `4-15 秒` 回退配置。这样即使历史绑定里仍保存 `maxDurationSeconds=15`，已核实的 `seedance-2-5-special` 30 秒镜头也不会在制作包规划或上游请求归一化阶段被降成 15 秒；如果供应商实际返回明确拒绝，仍按供应商错误记录任务失败。

已知模型继续按上表的供应商能力合同校验；未列入静态合同的 Buming 模型按供应商通用 `reference` 多参考图接口处理，连续帧会按顺序写入 `images` 并由提示词标注 `@图片N`，不再因为缺少本地静态合同而在短剧生成前拦截。管理员若确认某个绑定不支持全能帧，可在该绑定能力档案中显式关闭 `supportsKeyframes`；真实上游拒绝仍会作为该任务的明确失败返回，不会自动重复扣费。
