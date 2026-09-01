# VOZEB PRO 网站制作与操作教程

本文档面向“已经拉取并启动 VOZEB PRO 后，怎样把网站配置到能用，并怎样在网站里完成 AI 图片、短视频、音频、Canvas 和短剧制作”的场景。

当前本机实例已经完成基础初始化：

- 访问地址：http://127.0.0.1:3010
- 管理员账号：`admin`
- 管理员密码：`CJ7KMdNOkJ0axvuNIaCQ`
- 本地协议测试渠道：http://127.0.0.1:4010
- 应用容器：`vozeb-pro`
- 数据库容器：`vozeb-pro-postgres`
- 生成 Worker：`vozeb-pro-generation-worker`
- 本地模型模拟服务容器：`vozeb-protocol-fixture`

> 本机配置的“本地协议测试渠道”只用于验证流程，返回的是占位图片、占位视频和占位音频。正式制作可商用内容时，需要在后台替换为真实 AI 模型渠道和真实 API Key。

## 1. 项目是什么

VOZEB PRO 是一个开源 AI 创作平台，协议为 AGPL-3.0。它不是单纯的“文生视频小工具”，而是一套完整的创作网站：

- 统一创作 Agent：在 `/create` 输入需求，生成文本、图片、视频或音频。
- 图片制作：文生图、图生图、参考图编辑、多结果和历史记录。
- 短视频制作：文生视频、图生视频、首帧/首尾帧参考、异步任务恢复。
- Canvas 画布：把文本、图片、视频、音频、生成配置和 Agent 任务节点组织成工作流。
- 短剧生产线：剧本解析、内容审核、视觉方案、分镜、镜头视频、配音、字幕和整集合成。
- 素材与作品管理：素材库、生成记录、公开作品、社区展示。
- 管理后台：模型渠道、逻辑模型、积分、套餐、支付、邮件、存储、备份、公告和运营数据。

核心技术栈：

- 前端与后端：Next.js App Router + React + TypeScript
- UI：Ant Design、Tailwind、Zustand
- 数据库：PostgreSQL 16
- 部署：Docker Compose / standalone 镜像
- 媒体处理：本地数据目录或 S3 兼容对象存储，短剧合成依赖 FFmpeg

## 2. 目录结构怎么看

常用目录如下：

| 路径 | 作用 |
| --- | --- |
| `web/src/app/(user)/create/` | 用户侧统一创作 Agent 页面 |
| `web/src/app/(user)/canvas/` | Canvas 项目列表和编辑器 |
| `web/src/app/(user)/drama/` | 短剧项目列表和短剧生产编辑器 |
| `web/src/app/admin/` | 管理后台页面 |
| `web/src/app/install/` | 首次安装向导 |
| `web/src/app/api/` | Next.js API Route Handler |
| `web/src/lib/server/` | 服务端业务、模型路由、任务、计费、媒体、支付和存储逻辑 |
| `web/src/lib/server/database/` | PostgreSQL schema 与 Repository |
| `web/src/services/api/` | 浏览器调用本站 API 的客户端 |
| `web/scripts/` | standalone 启动、Worker、运维和测试脚本 |
| `docs/content/docs/` | 官方文档站源码 |
| `docker-compose.yml` | 默认应用、数据库和 Worker 编排 |
| `.env.example` | 环境变量模板 |
| `.env` | 本机实际环境变量，不要提交到 GitHub |

关键源码入口：

| 文件 | 用途 |
| --- | --- |
| `web/src/constant/navigation-tools.ts` | 登录后工作区导航配置 |
| `web/src/app/install/page.tsx` | 安装向导页面 |
| `web/src/app/api/install/status/route.ts` | 安装状态检查接口 |
| `web/src/app/api/install/initialize/route.ts` | 数据库 schema 初始化接口 |
| `web/src/lib/server/install-status.ts` | 安装状态核心判断 |
| `web/src/app/(user)/layout.tsx` | 登录后用户工作区鉴权和布局 |
| `web/src/app/(user)/create/page.tsx` | 统一创作 Agent 页面 |
| `web/src/app/(user)/create/use-create-agent.ts` | `/create` 会话、上传、提交和恢复逻辑 |
| `web/src/app/api/agent/runs/route.ts` | Agent Run 创建与执行入口 |
| `web/src/app/api/image-tasks/route.ts` | 图片任务 API |
| `web/src/app/api/video-generation-tasks/route.ts` | 视频任务 API |
| `web/src/app/api/audio-tasks/route.ts` | 音频任务 API |
| `web/src/app/(user)/canvas/[id]/page.tsx` | Canvas 编辑器页面入口 |
| `web/src/app/(user)/drama/[id]/page.tsx` | 短剧编辑器页面入口 |
| `web/src/lib/server/generation-task-scheduler.ts` | 生成任务调度 |
| `web/src/lib/server/generation-task-recovery-service.ts` | Worker 恢复和继续执行生成任务 |
| `web/scripts/generation-worker.mjs` | 独立生成 Worker 启动脚本 |
| `web/src/lib/server/logical-model-router.ts` | 逻辑模型到真实上游模型的路由 |
| `web/src/lib/channel-protocol-registry.ts` | 渠道协议注册表 |
| `web/src/components/admin/admin-configuration-sections.tsx` | 后台配置分区 |
| `web/src/components/admin/admin-upstream-sections.tsx` | 上游渠道和 Agent Skills 后台 |
| `web/src/components/admin/admin-points-section.tsx` | 积分规则后台 |
| `web/src/components/admin/admin-generation-settings.tsx` | 生成默认值和并发设置 |
| `web/src/components/admin/admin-local-media-storage.tsx` | 本地媒体管理 |
| `web/src/components/admin/admin-external-storage.tsx` | S3/OSS/COS/MinIO 外部存储 |

最重要的请求链路是：

1. 用户在 React 页面操作。
2. 浏览器通过 `web/src/services/api/` 请求本站 API。
3. `web/src/app/api/**/route.ts` 做入参、登录、管理员权限校验。
4. 服务端调用 `web/src/lib/server/` 的业务服务。
5. 数据进入 PostgreSQL，媒体进入本地数据目录或对象存储。
6. 生成任务交给上游 AI 渠道，Worker 负责继续查询、保存结果和恢复任务。

## 3. 本机如何启动和停止

本机使用 Docker Compose 加 override 文件启动，端口映射到 `3010`。

查看服务：

```bash
docker compose -f docker-compose.yml -f docker-compose.codex.yml ps
docker ps --filter name=vozeb
```

启动主站：

```bash
docker compose -f docker-compose.yml -f docker-compose.codex.yml up -d
```

停止主站：

```bash
docker compose -f docker-compose.yml -f docker-compose.codex.yml stop
```

查看日志：

```bash
docker compose -f docker-compose.yml -f docker-compose.codex.yml logs -f app
docker compose -f docker-compose.yml -f docker-compose.codex.yml logs -f generation-worker
docker compose -f docker-compose.yml -f docker-compose.codex.yml logs -f postgres
```

启动本地协议测试服务：

```bash
docker rm -f vozeb-protocol-fixture >/dev/null 2>&1 || true
docker run -d \
  --name vozeb-protocol-fixture \
  -e VOZEB_PRO_PROTOCOL_FIXTURE_HOST=0.0.0.0 \
  -p 4010:4010 \
  -v /Users/a1/work/vozeb-pro:/app \
  -w /app \
  node:22-bookworm-slim \
  node web/scripts/start-protocol-fixture.mjs
```

测试本地协议服务：

```bash
curl http://127.0.0.1:4010/health
```

注意：不要执行 `docker compose down -v`，它会删除数据库卷和媒体数据卷。

## 4. 首次初始化流程

从零部署时按这个顺序做：

1. 复制环境变量：

```bash
cp .env.example .env
```

2. 至少配置这些变量：

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3010
POSTGRES_PASSWORD=强数据库密码
VOZEB_PRO_ENCRYPTION_KEY=openssl rand -hex 32 的输出
VOZEB_PRO_INSTALL_TOKEN=openssl rand -hex 32 的输出
VOZEB_PRO_MAINTENANCE_TOKEN=openssl rand -hex 32 的输出
VOZEB_PRO_WORKER_TOKEN=另一个 openssl rand -hex 32 的输出
```

3. 启动 Docker：

```bash
docker compose pull
docker compose up -d
```

4. 访问 `/install`。

5. 检查 PostgreSQL 连接。

6. 使用 `VOZEB_PRO_INSTALL_TOKEN` 初始化表结构。

7. 创建第一个管理员。

8. 登录后进入 `/admin/setup` 初始化配置中心。

本机已经完成这些动作，可以直接登录后台。

## 5. 后台必须配置什么

登录管理员后，建议先打开：

```text
http://127.0.0.1:3010/admin/setup
```

按页面里的初始化项依次检查。

### 5.1 站点基础信息

入口：

```text
/admin?section=site
```

需要配置：

- 站点名称
- Logo
- 浏览器图标
- SEO 标题、描述、关键词
- 首页内容
- 社交链接

本地调试可以先不改，正式上线建议全部替换成自己的品牌信息。

### 5.2 模型渠道

入口：

```text
/admin?section=channels
```

模型渠道决定网站能不能真正生成内容。配置逻辑是：

1. 创建渠道。
2. 选择协议，例如 OpenAI 兼容、Gemini、Seedance、火山方舟视频、Stable Diffusion 或自定义协议。
3. 填 Base URL。
4. 填 API Key 或协议需要的凭据。
5. 拉取模型目录；如果上游没有模型目录，就手动填写模型 ID。
6. 同步逻辑模型。
7. 给文本、图片、视频、音频分别设置默认逻辑模型。
8. 启用渠道。
9. 回到用户端 `/create` 发起真实生成请求验证。

本机已经配置了一个模拟渠道：

| 能力 | 模型 |
| --- | --- |
| 文本 | `mock-text` |
| 图片 | `mock-image` |
| 视频 | `mock-video` |
| 音频 | `mock-audio` |

真实上线时，把模拟渠道替换为你的真实服务，例如：

```text
Base URL: https://api.openai.com/v1
API Key: sk-...
```

或其他 OpenAI 兼容供应商：

```text
Base URL: https://你的供应商域名/v1
API Key: 供应商 API Key
```

如果接入局域网模型或本机模型，需要在 `.env` 中显式允许私网上游：

```dotenv
VOZEB_PRO_ALLOW_PRIVATE_UPSTREAMS=1
VOZEB_PRO_PRIVATE_UPSTREAM_HOSTS=host.docker.internal,你的内网IP
```

正式公网部署不要随意开放私网上游。

### 5.3 积分和套餐

入口：

```text
/admin?section=products
/admin?section=billing
```

需要配置：

- 免费用户每日额度
- 文本、图片、视频、音频模型基础扣费
- 套餐权益
- 在售商品
- 管理员给用户加减积分
- 失败退款和消费流水检查

本机管理员已经加了测试积分，可以直接跑生成流程。

### 5.4 支付渠道

入口：

```text
/admin?section=payments
```

支持：

- Stripe
- 支付宝
- 微信支付
- PayPly
- 人工确认收款

生产启用支付前必须验证：

- 下单
- 支付跳转或二维码
- 回调验签
- 权益开通
- 退款
- 财务对账

本地体验可以先使用人工确认，或者暂时不开放购买。

### 5.5 邮件和注册

入口：

```text
/admin?section=settings
```

需要配置：

- SMTP Host
- SMTP Port
- SMTP 用户名和密码
- 发件人
- 邮箱验证码
- 找回密码
- 注册策略

如果不开启邮箱注册，本地测试可以只用管理员账号。

### 5.6 媒体存储和备份

入口：

```text
/admin?section=settings
```

本地默认写入容器数据目录。生产建议明确规划：

- 小规模：本地持久数据卷。
- 正式运营：S3、OSS、COS 或 MinIO 等对象存储。

必须备份两类数据：

- PostgreSQL 数据库。
- 媒体文件目录或对象存储 Bucket。

后台业务备份不包含真实密钥和媒体原文件，不能替代完整生产备份。

## 6. 用户侧制作图片、视频和音频

统一入口：

```text
http://127.0.0.1:3010/create
```

`/image` 和 `/video` 当前都会重定向到 `/create`，所以日常创作统一从 `/create` 开始。

### 6.1 最简单的文生图

1. 登录。
2. 进入 `/create`。
3. 保持“智能规划”开启。
4. 创作类型选择图片，或直接在 Agent 模式里描述你要生成图片。
5. 输入需求，例如：

```text
生成一张 9:16 手机竖屏海报，主题是国风茶饮新品，画面要有桂花、冰杯、青瓷杯和年轻女性手持饮品，风格清爽高级。
```

6. 点击发送。
7. 等待结果出现。
8. 对结果进行预览、下载、删除、重试，或继续追问修改。

### 6.2 图生图或参考图编辑

1. 进入 `/create`。
2. 上传图片素材，或从素材面板选择已有素材。
3. 在输入框描述修改目标，例如：

```text
基于这张产品图生成 4 张电商主图，保持瓶身结构和标签不变，背景改成明亮厨房台面，加入自然晨光。
```

4. 选择图片模式和比例。
5. 发送生成。

### 6.3 文生短视频

1. 进入 `/create`。
2. 创作类型选择视频。
3. 设置比例、清晰度、时长等参数。
4. 输入镜头描述，例如：

```text
制作 5 秒 9:16 短视频：一杯冰镇桂花乌龙从桌面缓慢旋转，杯壁有水珠，背景是柔和午后阳光，镜头轻微推进，质感干净高级。
```

5. 发送后等待任务轮询完成。
6. 结果出来后预览、下载，或继续让 Agent 改镜头。

### 6.4 图生视频、首帧和首尾帧

1. 上传起始图片。
2. 在视频偏好里选择首帧模式。
3. 如果要控制结尾画面，选择首尾帧模式并上传首帧和尾帧。
4. 输入运动、镜头、主体变化和不要变化的内容。
5. 发送生成。

提示：如果选择了首帧或首尾帧模式，必须先选好对应图片，否则页面会提示“请先选择视频首帧图片”或“请先同时选择视频首帧和尾帧图片”。

### 6.5 生成音频

1. 进入 `/create`。
2. 创作类型选择音频。
3. 选择音色和格式。
4. 输入旁白或配音要求，例如：

```text
生成一段 8 秒女声广告旁白，语气温柔、有亲和力：桂花乌龙，清香回甘，让夏天慢下来。
```

5. 发送并等待结果。

## 7. Canvas 画布怎么用

入口：

```text
http://127.0.0.1:3010/canvas
```

Canvas 适合做复杂项目，比如一套广告物料、一组角色设定、一条短视频的分镜素材流。

### 7.1 新建画布

1. 进入 `/canvas`。
2. 点击“新建画布”。
3. 进入画布编辑器。
4. 使用底部工具栏添加节点。

底部工具栏常用按钮：

| 按钮 | 用途 |
| --- | --- |
| 文本 | 添加提示词、脚本、设定说明 |
| 图片 | 添加空图片节点或图片结果 |
| 全景图 | 添加 360 度场景节点 |
| 视频 | 添加视频节点 |
| 音频 | 添加音频节点 |
| 生成配置 | 添加一个可执行的生成任务节点 |
| 上传素材 | 上传图片、视频或音频 |
| 资产 | 打开画布资产面板 |
| 撤销/重做 | 回退或恢复操作 |
| 清空画布 | 清空当前画布内容 |

### 7.2 用生成配置节点出图或出视频

1. 添加“文本”节点，写提示词。
2. 添加“生成配置”节点。
3. 在生成配置节点里选择生成类型：生图、文本、视频或音频。
4. 选择模型和参数。
5. 把文本、图片、视频或音频参考素材连接到生成配置节点。
6. 点击“开始生成”。
7. 等待结果节点回填到画布。

### 7.3 用 Canvas Agent 做多物料规划

1. 打开 Canvas Agent 面板。
2. 在画布里准备好已有文字、图片或视频节点。
3. 对 Agent 说清楚目标，例如：

```text
基于当前产品图，为抖音做一套竖屏短视频物料：先生成三张分镜图，再生成一条 5 秒视频，并保留品牌色调一致。
```

4. Agent 会读取当前画布和选区，规划节点、生成任务和依赖关系。
5. 可暂停、继续、取消或重试失败节点。

## 8. 短剧生产线怎么操作

入口：

```text
http://127.0.0.1:3010/drama
```

短剧模块是最接近“AI 短视频制作流水线”的地方，推荐按阶段推进。

### 8.1 新建短剧项目

1. 进入 `/drama`。
2. 点击“新建短剧”。
3. 填写项目名称。
4. 填写故事简介。
5. 设置视觉风格，默认示例是“电影感国漫”。
6. 设置生成尺寸：`9:16`、`16:9` 或自定义。
7. 点击“创建并进入”。

### 8.2 阶段一：剧本

1. 在“剧本”阶段输入或粘贴本集剧本。
2. 可以使用导入功能导入已有来源。
3. 点击“完成剧本，进入内容审核”。
4. 如果还没有镜头结构，系统会先调用 AI 剧本解析。

解析完成后会提取：

- 角色
- 场景
- 道具
- 线索
- 待审核镜头

### 8.3 阶段二：内容审核

1. 检查 AI 提取出的角色、场景和镜头。
2. 修改不准确的事实。
3. 确认镜头顺序和剧情逻辑。
4. 点击生成视觉方案。

视觉方案会进一步生成：

- 画面描述
- 镜头运动
- 参考图策略
- 视频提示词
- 分镜提示词

### 8.4 阶段三：分镜

1. 进入“分镜”阶段。
2. 逐个检查镜头卡片。
3. 精调画面、镜头运动、生成方式和配音策略。
4. 需要首帧图时先生成或上传分镜图。
5. 使用首尾帧模式时，同时准备结束帧。
6. 所有镜头就绪后点击“进入镜头生成”。

如果没有可编辑分镜，说明还没完成剧本提取和内容审核。

### 8.5 阶段四：镜头生成

在“镜头生成”阶段，系统会显示阻塞项和主操作按钮。

如果顶部出现“导演前置检查阻断生产”，不需要自己猜维护位置：点击阻断卡片里的“让 Agent 自动修复可修复问题”。Agent 会按当前集事实补全缺失的表演、对白、灯光、景别、机位、构图和连续性参数，然后自动重新检查。历史项目或普通剧本解析如果没有系列圣经，系统会在生成前自动补齐最小可执行规则；若仍提示角色/场景/道具基准图，页面会自动打开“项目资产”维护入口，这一步需要你确认哪一张候选图作为主基准图。

常见状态：

- 等待镜头：需要返回剧本并提取结构。
- 完成内容审核与视觉方案：需要先回到审核阶段。
- 准备生成：可以开始处理镜头。
- 生产进行中：镜头正在排队或生成。
- 需要处理：有镜头失败，需要按失败原因重试。
- 可合成：镜头视频和必需配音已经就绪。
- 成片已完成：可以预览和下载。

主要按钮：

- “生成 N 个就绪镜头”：批量生成镜头视频。
- “重试镜头”：只重试失败镜头。
- “生成配音”：为缺少配音的镜头生成音频。
- “合成整集”：把镜头、配音和字幕合成为整集视频。
- “下载整集成片”：下载最终 mp4。

单个镜头也可以：

- 生成镜头
- 重新生成
- 取消生成
- 生成配音
- 重试配音
- 交给创作 Agent 继续改

### 8.6 导出

短剧模块支持：

- 预览成片
- 下载整集视频
- 查看字幕时间轴
- 导出剪映草稿 ZIP

正式使用前请确认服务器 FFmpeg 可用、视频模型可用、音频模型可用、媒体目录或对象存储可写。

## 9. 一条短视频的推荐制作流程

如果你的目标是制作一条可发布的短视频，可以按这个顺序：

1. 先在 `/create` 让 Agent 生成脚本和镜头方案。
2. 把满意的角色设定、产品图或场景图保存到素材库。
3. 进入 `/canvas`，把脚本、参考图、分镜图和生成配置串成画布。
4. 先生成关键分镜图，确认主体和风格稳定。
5. 用图生视频或首尾帧模式生成镜头片段。
6. 需要多镜头故事时，进入 `/drama` 用短剧生产线管理剧本、分镜、镜头、配音和合成。
7. 下载成片。
8. 回到后台查看生成记录、扣费、失败原因和媒体存储。

简单广告片可以只用 `/create`。复杂系列短剧建议用 `/drama`。需要大量素材依赖和视觉探索时用 `/canvas`。

## 10. 当前本机测试状态

本机已经验证过：

- `/api/health/ready` 返回 ready。
- 管理员可以登录。
- PostgreSQL 正常。
- Generation Worker 正常。
- 本地 OpenAI 兼容模拟渠道可从应用容器访问。
- 图片任务成功。
- 视频任务成功。
- 音频任务成功。
- 后台 Agent readiness 显示文本、图片、视频、音频均 ready。

模拟渠道生成的是占位素材，仅证明网站流程打通。

## 11. 正式上线前检查清单

上线前至少确认：

- 使用真实 HTTPS 域名，并设置 `NEXT_PUBLIC_SITE_URL`。
- 更换 `.env` 里的所有随机密钥和数据库密码。
- 安装完成后移除或妥善保护 `VOZEB_PRO_INSTALL_TOKEN`。
- `VOZEB_PRO_WORKER_TOKEN` 和 `VOZEB_PRO_MAINTENANCE_TOKEN` 不相同。
- 配置真实模型渠道和默认逻辑模型。
- 分别跑通文本、图片、视频、音频真实生成。
- 规划积分单价和套餐。
- 配置支付渠道并验证回调。
- 配置 SMTP 并验证验证码和找回密码。
- 配置媒体持久化，本地卷或 S3 兼容对象存储。
- 配置 PostgreSQL 和媒体备份。
- 配置维护任务，例如临时媒体清理、订单过期处理。
- 检查反向代理转发 `Host`、`X-Forwarded-Proto` 和 `X-Forwarded-For`。
- 根据代理层数设置 `VOZEB_PRO_TRUSTED_PROXY_HOPS`。
- 不把 `.env`、数据库备份、媒体文件或密钥提交到 GitHub。

## 12. 常见问题

### 打开网站后跳到安装页

说明数据库未初始化，或者首个管理员还没创建。访问 `/install` 完成初始化。

### 生成时报积分不足

管理员进入用户运营，给当前用户增加测试积分；或者调整免费额度、套餐和模型扣费规则。

### 后台模型 ready，但生成失败

检查：

- 渠道是否启用。
- 逻辑模型是否绑定上游模型。
- 默认模型是否设置。
- Base URL 是否能被容器访问。
- API Key 是否正确。
- 上游返回格式是否符合协议。
- Worker 是否正常。

### 本机模拟渠道在容器里访问不到

容器访问宿主机服务时不要写 `127.0.0.1`，应使用宿主机在 Docker 网络中的可达地址。本机当前使用：

```text
http://192.168.5.2:4010/v1
```

宿主机浏览器访问模拟服务仍然是：

```text
http://127.0.0.1:4010
```

### 页面关闭后任务还会继续吗

会。项目有独立 `generation-worker`，负责继续领取、查询和保存生成任务。页面刷新或重新进入后会恢复已保存任务状态。

### 生产能不能只用本地媒体目录

可以，但要做好磁盘容量、备份和迁移规划。视频和短剧很容易占用大量空间，正式运营更推荐使用 S3 兼容对象存储。
