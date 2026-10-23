---
name: vozeb-pro-production-ops
description: 连接并操作 VOZEB PRO 正式服务器（SSH 别名 vozeb-pro-production，root@76.13.209.117）的运维 Skill：发布与回滚、健康检查、容器与日志、PostgreSQL 线上数据只读排查与受控写入、媒体与备份位置、短剧项目与生成任务核对。用户提到线上服务器、部署、发布、回滚、线上数据、线上任务卡住、Worker 心跳、查线上库时使用。
version: 1
---

# VOZEB PRO 正式服务器运维

这个 Skill 只描述**怎么连、怎么查、怎么改、怎么发布**。凭据不写在文件里：SSH 用本机别名，密钥由系统提供；数据库密码、渠道密钥、Worker 令牌只在服务器的 `<release>/.env` 或容器环境里读取，不回显、不落盘、不进 Git。

## 0. 什么时候用，什么时候不要用

用：

- 用户问“线上怎么样了”“发布到服务器”“回滚”“线上数据不对”“线上任务卡住/没跑”“查一下线上库”。
- 需要核对线上短剧项目、生成任务、积分流水、媒体占用、Worker 心跳。

不要用：

- 本地开发调试 → 用 `vozeb-pro-hot-development`，本机是 `PORT=3010 pnpm --dir web run start:hot`。
- 不要把它当成通用 Docker 运维手册：这台机器还有别的业务容器（MySQL、其他项目），只碰 `vozeb-pro` 这三个容器。

## 1. 连接

```bash
ssh vozeb-pro-production 'docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}"'
```

- 别名 `vozeb-pro-production`：`HostName 76.13.209.117`、`User root`、`Port 22`、`IdentityFile ~/.ssh/vozeb_pro_production_ed25519`（本机 `~/.ssh/config` 已配置好）。
- 在其他机器上使用时，需要先放好私钥并建立等价别名；没有别名就用 `ssh -i <私钥> -p 22 root@76.13.209.117 '命令'`。
- 主机、私钥、密码、令牌一律由宿主环境提供，不要写进仓库、脚本、`.env` 或对话。
- 所有远程操作都用一次性 `ssh host '命令'` 或 `bash -s < 本地脚本`，不要在服务器上留临时脚本文件。

## 2. 拓扑（先看这张图再动手）

| 项 | 值 |
| --- | --- |
| 编译产物根目录 | `/opt/vozeb-pro` |
| 发布目录 | `/opt/vozeb-pro/releases/<40 位完整 commit>` |
| 当前版本 | `/opt/vozeb-pro/current`（指向某个 release 的符号链接） |
| 发布日志 | `/opt/vozeb-pro/deploy-<7 位短 sha>.log` |
| Compose 项目 | `vozeb-pro`，配置文件为 `<release>/docker-compose.yml` |
| 应用容器 | `vozeb-pro`（镜像 `vozeb-pro:git-<7 位短 sha>`） |
| Worker 容器 | `vozeb-pro-generation-worker`（同镜像，`node /app/web/scripts/generation-worker.mjs`） |
| 数据库容器 | `vozeb-pro-postgres`（`postgres:16.6-alpine`，**运维边界外，不重建、不删卷**） |
| 对外入口 | 宝塔 nginx `:80/:443` → `127.0.0.1:3001`（应用容器内 3000） |
| 正式域名 | `https://bowlpetdaily.com` |
| 数据卷 | `vozeb-pro_vozeb-pro-data` → `/app/web/.data`；`vozeb-pro_vozeb-pro-postgres` → `/var/lib/postgresql/data` |
| 环境变量 | `/opt/vozeb-pro/current/.env`（含 `DATABASE_URL`、`POSTGRES_*`、`VOZEB_PRO_*_TOKEN`、`VOZEB_PRO_IMAGE`、`VOZEB_PRO_APP_HOST_PORT`） |

这台机器 **2 vCPU / 约 7.6 GB 内存**，还跑着其他业务；发布构建时不要并行做第二份构建，磁盘 80% 左右时要先清理旧 release 和旧镜像。

## 3. 健康检查（每次操作前后都跑）

```bash
ssh vozeb-pro-production '
  docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}" | grep vozeb-pro;
  curl -s -o /dev/null -w "live:%{http_code}\n" https://bowlpetdaily.com/api/health/live;
  curl -s https://bowlpetdaily.com/api/health/ready;
  df -h /opt | tail -1
'
```

`/api/health/ready` 返回 `data.ready=true` 才算就绪，其中：

- `database.healthy` / `database.schemaReady`：PostgreSQL 连接与结构版本。
- `generationWorker.healthy` + `lastHeartbeatAt`：Worker 心跳在 `staleAfterMs`（90 秒）内为健康。
- `encryptionReady`：`VOZEB_PRO_ENCRYPTION_KEY` 可用。

## 4. 发布（只新建 release，不原地改）

前提：commit 已 `git push` 到 `origin/main`。服务器可直接匿名 clone `https://github.com/RedNoFer/red-ai-video.git`。

```bash
SHA=<40 位 commit>; SHORT=${SHA:0:7}
DEST=/opt/vozeb-pro/releases/$SHA; SRC=/tmp/vozeb-src-$SHORT
ssh vozeb-pro-production "bash -s" <<EOF
set -euo pipefail
rm -rf "$SRC"; git clone --quiet --no-checkout https://github.com/RedNoFer/red-ai-video.git "$SRC"
git -C "$SRC" fetch --quiet --depth 1 origin "$SHA"; git -C "$SRC" checkout --quiet "$SHA"
git -C "$SRC" rev-parse HEAD
mkdir -p "$DEST"; rsync -a --exclude .git "$SRC"/ "$DEST"/
cp /opt/vozeb-pro/current/.env "$DEST/.env"
sed -i "s/^VOZEB_PRO_IMAGE=.*/VOZEB_PRO_IMAGE=vozeb-pro:git-$SHORT/" "$DEST/.env"
docker build -t "vozeb-pro:git-$SHORT" -f "$DEST/Dockerfile" "$DEST"
ln -sfn "$DEST" /opt/vozeb-pro/current
cd "$DEST" && docker compose -p vozeb-pro up -d app generation-worker
EOF
```

要点：

- 必须复制上一版 `.env`，只改 `VOZEB_PRO_IMAGE`；没有 `.env` 应用起不来。
- 只 `up -d app generation-worker`，不要 `down`、不要 `-v`、不要在别的 compose 项目目录执行。
- 部署后必须回读：容器镜像/tag 正确、`/api/health/live` 200、`/api/health/ready` ready、Worker 心跳新鲜。
- 校验发布内容与提交一致：`sha256sum` 关键文件，和本地 `shasum -a 256` 对比。
- 旧 release 至少保留上一版，供回滚。

## 5. 回滚

```bash
ssh vozeb-pro-production '
  ln -sfn /opt/vozeb-pro/releases/<上一版完整 sha> /opt/vozeb-pro/current &&
  cd /opt/vozeb-pro/releases/<上一版完整 sha> && docker compose -p vozeb-pro up -d app generation-worker
'
```

镜像 tag 来自该 release 自己的 `.env`，不用手写。回滚后同样跑一遍第 3 节检查。

## 6. 日志与故障定位

```bash
ssh vozeb-pro-production '
  docker logs --tail 200 vozeb-pro;
  docker logs --tail 200 vozeb-pro-generation-worker;
  docker compose -p vozeb-pro --project-directory /opt/vozeb-pro/current ps
'
```

Worker 可控参数（compose 里未显式设置时用默认值）：

- `VOZEB_PRO_GENERATION_WORKER_LANES` 默认 2（1–8）
- `VOZEB_PRO_GENERATION_WORKER_INTERVAL_MS` 默认 2000（500–30000）
- `VOZEB_PRO_GENERATION_WORKER_HEARTBEAT_MS` 默认 15000（5000–60000）

只重启 Worker 不影响页面：

```bash
ssh vozeb-pro-production 'cd /opt/vozeb-pro/current && docker compose -p vozeb-pro up -d --no-deps --force-recreate generation-worker'
```

手动推一轮任务恢复（走 Worker 令牌，不要直接改库）：

```bash
ssh vozeb-pro-production '
  TOKEN=$(grep "^VOZEB_PRO_WORKER_TOKEN=" /opt/vozeb-pro/current/.env | cut -d= -f2-);
  curl -s -X POST http://127.0.0.1:${VOZEB_PRO_APP_HOST_PORT:-3001}/api/maintenance/generation-tasks/run \
    -H "authorization: Bearer $TOKEN" -H "x-vozeb-pro-worker-id: manual-ops-$(date +%s)"
'
```

维护令牌只用于这四类维护任务（`authorization: Bearer $VOZEB_PRO_MAINTENANCE_TOKEN`）：
`/api/maintenance/billing-orders/expire`、`/api/maintenance/billing-refunds/run`、`/api/maintenance/referrals/settle`、`/api/maintenance/data-lifecycle/run`。

验证令牌是否可用（无副作用，只写一条心跳，可用 SQL 删掉该行）：

```bash
ssh vozeb-pro-production '
  PORT=$(grep "^VOZEB_PRO_APP_HOST_PORT=" /opt/vozeb-pro/current/.env | cut -d= -f2-)
  TOKEN=$(grep "^VOZEB_PRO_WORKER_TOKEN=" /opt/vozeb-pro/current/.env | cut -d= -f2-)
  curl -s -X POST "http://127.0.0.1:${PORT}/api/maintenance/generation-tasks/heartbeat" \
    -H "authorization: Bearer $TOKEN" -H "x-vozeb-pro-worker-id: manual-ops-verify"
'
```

## 7. 线上数据：只读排查

数据库在容器内，无需外部端口：

```bash
ssh vozeb-pro-production 'docker exec vozeb-pro-postgres psql -U vozeb_pro -d vozeb_pro -c "select now(), current_database(), pg_size_pretty(pg_database_size(current_database()));"'
```

真实表名统一带 `vozeb_pro_` 前缀（例外：`drama_asset_generation_batches`）。常用表：

| 表 | 用途 |
| --- | --- |
| `vozeb_pro_drama_projects` | 短剧项目聚合，`project_json` 存全集/角色/场景/道具/镜头/视频状态 |
| `vozeb_pro_drama_project_versions` | 项目版本快照，`version`、`reason`、`snapshot` |
| `vozeb_pro_generation_tasks` | 文本/图片/视频/音频/Agent/render 任务与 `execution_phase` |
| `vozeb_pro_generation_worker_heartbeats` | Worker 心跳，字段 `worker_id`、`last_seen_at` |
| `vozeb_pro_users` / `vozeb_pro_point_records` | 账号（`account_id` 为对外的 4 位号）、积分流水 |
| `vozeb_pro_local_media_assets` | 媒体登记，`storage_key`、`scope`、`storage_class`、`bytes` |
| `vozeb_pro_app_settings` | 站点、积分、模型目录、成本控制等全局设置（JSONB） |

常用只读 SQL（都带 `limit`，不要在线上全表扫）：

```sql
-- 最近更新的短剧项目
select id, user_id, title, status, updated_at,
       jsonb_array_length(coalesce(project_json->'episodes', '[]'::jsonb)) as episodes
from vozeb_pro_drama_projects order by updated_at desc limit 20;

-- 某个项目最近的版本快照（回滚点）
select version, reason, created_at
from vozeb_pro_drama_project_versions
where project_id = '<project-id>' order by version desc limit 10;

-- 非终态任务按阶段分布（先看有没有堆积）
select task_type, status, execution_phase, count(*)
from vozeb_pro_generation_tasks
where status in ('pending','running')
group by 1,2,3 order by 4 desc;

-- 某个项目最近的任务
select id, task_type, status, execution_phase, provider, upstream_task_id, created_at, updated_at
from vozeb_pro_generation_tasks
where project_id = '<project-id>' order by created_at desc limit 20;

-- Worker 心跳
select worker_id, last_seen_at from vozeb_pro_generation_worker_heartbeats order by last_seen_at desc;

-- 媒体占用
select storage_class, scope, count(*) as files, pg_size_pretty(sum(bytes)) as total
from vozeb_pro_local_media_assets group by 1,2 order by sum(bytes) desc;

-- 最大的几张表
select relname, pg_size_pretty(pg_total_relation_size(oid)) as size
from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
order by pg_total_relation_size(oid) desc limit 10;
```

导出片段做本地分析时只取需要的行：`copy (select ... limit 500) to stdout with csv header`，不要整库拉回本地。

把 `project_json` 抠出来看某集时用 `jsonb_pretty`，但注意 `project_json` 可能很大，先取子字段再美化。

## 8. 线上数据：受控写入

默认只读。只有用户明确说“改线上数据”时才写，并且：

1. 先在应用里让用户确认，或先建一个可恢复点：短剧项目优先用页面“版本记录”保存版本；`vozeb_pro_drama_project_versions` 有快照才能回滚。
2. 写前把要改的行取出来存档：`copy (select ... where id = '...') to stdout with csv header`，在本地重定向成文件；不要整表导出，也不要把导出文件留在服务器。
3. 只做定向 `update ... where id = '...'`，必须 `returning` 关键字段；禁止无 `where`、禁止 `truncate`、禁止改表结构、禁止动 `postgres` 容器和卷。
4. 用事务包裹，确认 `returning` 符合预期再 `commit`，不符合就 `rollback`。
5. 业务字段优先走应用接口或页面操作，不要直接拼 `project_json`：短剧项目有局部 mutation 与版本快照，直接改 JSON 会绕过版本和校验。
6. 改完重新读一次，并在报告里写清：改了哪张表、哪些 id、改前值、改后值、影响范围。

不要做的事：直接改 `points_balance` 代替走积分流水；直接删 `vozeb_pro_local_media_assets` 记录绕过引用检查；直接改 `generation_tasks` 状态把失败伪装成成功。

## 9. 备份与恢复

优先级：先用管理员后台的“数据备份”页面做常规备份；只有需要完整灾备恢复点（数据库 + 本地媒体 + 对象存储清单）时才走下面的脚本。

灾备脚本要求离线窗口，`--confirm-offline` 是强制确认，在线运行会直接报错“请先停止 App 与 Worker”。正确顺序（**必须先取得用户同意，本轮未实测执行**）：

```bash
ssh vozeb-pro-production '
set -e
cd /opt/vozeb-pro/current
docker compose -p vozeb-pro stop app generation-worker
docker run --rm --network host \
  --env-file /opt/vozeb-pro/current/.env \
  -v vozeb-pro_vozeb-pro-data:/app/web/.data \
  vozeb-pro:git-8d11590 \
  node /app/web/scripts/disaster-backup.mjs --output /app/web/.data/disaster/<时间戳> --confirm-offline
docker compose -p vozeb-pro start app generation-worker
'
```

- 镜像 tag 用 `grep "^VOZEB_PRO_IMAGE=" /opt/vozeb-pro/current/.env` 读到的实际值，不要照抄示例。
- 媒体目录当前约 5 GB，备份会再写一份同样大小的快照到数据卷，执行前先看 `df -h /opt`（低于 20 GB 可用空间不要做）。
- 产物含 `database/vozeb-pro.dump`、媒体目录快照、对象存储清单和 `manifest.json`。拿到宿主机后立即转走：`docker cp vozeb-pro:/app/web/.data/disaster/<时间戳> ./`，再按需 `rm -rf` 服务器上的副本。
- 恢复只用 `disaster-restore.mjs`（需要恢复点 ID、`--safety-dir`、`--confirm <恢复点 ID>`），同样要求离线；禁止手工 `psql < dump` 覆盖线上库。
- 需要“某个短剧项目改坏了”这种单项目回滚时，不要用整库恢复：用 `vozeb_pro_drama_project_versions` 里的版本快照，或页面“版本记录”。

## 10. 媒体与存储

- 站内媒体登记在 `vozeb_pro_local_media_assets`，物理文件在数据卷 `vozeb-pro_vozeb-pro-data` 的 `/app/web/.data` 下，按 `storage_key` 定位。
- 外部 S3 开关只决定新写入位置；历史媒体按登记的 `storage_provider` 读取。查询前先看 `vozeb_pro_object_storage_settings` 的启用状态。
- 不要直接 `rm` 媒体文件：先查 `vozeb_pro_local_media_assets` 和业务引用，删除要走应用删除接口（会做引用检查）。
- 磁盘吃紧时优先清理：旧 release 目录、旧镜像 `docker image ls 'vozeb-pro:git-*'`、`/tmp/vozeb-src-*`，而不是删媒体。

## 11. 常见问题对照

| 现象 | 先查 | 处理 |
| --- | --- | --- |
| `ready=false` 且 `database.healthy=false` | `docker ps`、`docker logs vozeb-pro-postgres` | 等数据库 healthy；不要重建容器或卷 |
| `generationWorker.healthy=false` | Worker 日志、心跳表 | 先看日志；必要时 `--no-deps` 重启 Worker |
| 页面 502 | `docker ps`、`curl 127.0.0.1:${VOZEB_PRO_APP_HOST_PORT}` | 应用容器没起来或还在启动；看 `docker logs vozeb-pro` |
| 任务一直 `running` | `execution_phase`、`lease_until`、Worker 心跳 | 手动跑一次 `generation-tasks/run`，再观察；不要改状态字段 |
| 磁盘 >85% | `df -h /opt`、最大表、媒体占用 | 清旧 release/镜像/临时目录，通知用户媒体增长 |
| 发布后行为不对 | `current` 指向、镜像 tag、`deploy-<sha>.log` | 按第 5 节回滚到上一版 |

## 12. 每次操作后的报告

给用户的结论必须包含：操作对象（release/容器/表）、执行的命令要点、结果（健康码、行数、关键字段）、影响范围、是否可回滚、遗留风险。没验证过的不要写“已完成”。

## 13. 禁止清单

- 不把密码、令牌、`.env` 内容、私钥写进仓库、脚本、日志或对话。
- 不执行 `docker compose down`、`down -v`、`docker volume rm`、`docker system prune`（会波及别的业务）。
- 不改 nginx / 宝塔站点配置（除非用户明确要求且先备份该 `.conf`）。
- 不操作 `198.200.50.8`、`204.77.130.125` 或其他服务器；本项目只有 `76.13.209.117`。
- 不在未备份的情况下批量改线上业务数据，不整表导出或整库拷回本地。
