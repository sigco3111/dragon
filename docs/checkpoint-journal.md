# Checkpoint Journal

> 本文件只记**本轮会话的详细进展、调试过程、失败尝试、相关文件、当前阻塞与下一步**，供下一对话接续。
> 长期事实/架构/命令/约定/坑点在 [`AGENTS.md`](../AGENTS.md)（含[编辑器开发待办](editor-dev-todo.md)）；机制原证在 `.agents/skills/*/SKILL.md` 与 `docs/re-notes-*.md`。
> 历史逐批记录（2026-10-10 至 10-14 各批次）已在 Git 历史中可通过 `git log -p -- docs/checkpoint-journal.md` 取回，本轮不再保留副本；其内容已按主题归并到各 `docs/editor-*.md` 维护源。
> 当前 HEAD `19b2b17`（分支 `dev`，`VERSION=0.1.5`）；**本轮全部改动未提交**，未 push/deploy/fetch，未核远端。

## 维护源索引（按主题取详情，不在此复制）

| 主题 | 维护源 |
| --- | --- |
| 编辑器待办与状态（本轮主索引） | [editor-dev-todo.md](editor-dev-todo.md) |
| 产品需求基线与 Q1–Q73 缺口矩阵 | [game-editor-design.md](game-editor-design.md)、[editor-requirements-matrix.md](editor-requirements-matrix.md) |
| 工程合同（数据/编译/加载/接口） | [game-editor-technical-design.md](game-editor-technical-design.md) |
| 平台拆分方案（VPS 编辑器 → Cloudflare 游戏） | [editor-vps-cloudflare-plan.md](editor-vps-cloudflare-plan.md)（仅方案，未适配/部署） |
| 后端账户/草稿/Trial/发布/删除各限定批次 | `docs/editor-backend-*.md`（见矩阵 E9/E10 行） |
| 头像链（PNG/JPEG 安全、裁剪、隔离探针） | `docs/editor-portrait-*.md`、`docs/editor-trial-portrait-*.md` |
| 地图迁移与准入 | [game-map-migration-plan.md](game-map-migration-plan.md)、[re-notes-editor-map-admission.md](re-notes-editor-map-admission.md) |
| 小范围审计与差距 | [editor-closeout-audit.md](editor-closeout-audit.md)、[editor-local-validation.md](editor-local-validation.md) |

## 本轮会话主线

用户要求：**先完成编辑器开发，再说部署**。据此按单子（`editor-dev-todo.md`）推进功能侧；部署线（sidecar 上线、V2–V5、发布验证）全部挂起。会话中途用户另定两条产品决策：**整站单用户在线（(ii)）**、**发布 UI 按 A＝完整分支验收**；2026-10-14 追加 JPEG 源预算**保持当前**。

## 已完成（本轮全部未提交）

### V0 VPS 盘点（已关闭）
- 域名 `dragon-editor.720108.xyz` 已指 VPS；反代并入现存容器 nginx（配置即宿主 `/home/web/conf.d`，证书 `acme.sh` webroot `/home/web/letsencrypt`）；宿主 apt 版 nginx 已 disable。
- 新建 `dragon-editor` 用户与 `/srv/dragon-editor`；Docker 29.6.0 / Compose v5.1.4；A 空壳验证全绿（只读容器 + `./data` + 重启恢复 + 公网 HTTPS 200）。
- 镜像 pin `node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392`。生产用镜像 Node 22，宿主 v20 不动。
- ⚠️ 未落盘：`/home/web/docker-compose.yml` 含 mysql 明文密码，**该文件绝不入库**。

### V1 本地移植切片 S1–S10（`vps/`，161 检查全绿）
`vps/sqlite-port.mjs`（DO `storage.sql.exec`/`transactionSync` 语义，含 savepoint 嵌套）、`vps/auth-server.mjs`、`vps/file-bucket.mjs`、`vps/topology.mjs`→`server/topology.js`、`server/releases.js`、`vps/text-loader.mjs`、`vps/server-main.mjs`、`vps/Dockerfile`、`vps/docker-compose.auth.yml`、`vps/auth.env.example`。
工具：`tools/verify_vps_{sqlite_port,metadata_port,auth_server,blob_file,draft_save,jobs,portraits,trial,publish_pack,single_user,topology_intent,releases,city_save}.mjs`。
**关键发现（生产语义，非 bug）**：无改动保存返回当前修订不递增；`drafts.save` 外层事务包 `games.transaction` 内层（DO 靠 savepoint）；Trial `issue` 与 `buildAndStore` 必经 `catalog.loadFull`，后者要求 admin。

### A1 发布 UI 完整分支验收（已关闭）
- 模型轮 `model-r5` 26/26；浏览器轮 `browser-r5` 在真机 Chrome 155 下 13 检查/24 调用/9 POST/5 查询全绿（与 r4 同计数，`errors` 空）。
- 证据：`.dragon-analysis/editor-phase/backend-management-ui-session-r1/`（`model-r5.*`、`browser-r5.*`、`run-r5.mjs` 未纳入仓库的轮次运行器在 `tools/run_management_ui_r5.mjs`）。垫片 `.dragon-analysis/pw-chrome-shim.mjs`（本机 Chrome 155 需强制 `--headless=new`）。
- **顺带修出两个真 bug（已改未提交）**：① `server/public/client.txt` 启动请求与登录竞态（慢后端上启动 `/api/session` 401 落地会清掉刚登上的会话）→ 加 `sessionEpoch` 代次守卫；② `server/worker.js` `#postAdminUnlist` 把解除限制也卡成要 `action:'unlist'` → 按 UI 契约（clear 收 `{}`）修回。
- r5 门面如实收窄：11 个 lane 文件 pin + 28 个有归属的上下文漂移只统计不祝福 + 2 条 Chrome155 beforeunload 日志噪音单列。

### 单用户在线 (ii)（已关闭）
`vps/auth-server.mjs` 经 `EDITOR_SINGLE_USER=1` 开启（默认关，S3 十九项不受影响）：任一未过期会话存在时新登录 409 `SINGLE_USER_ONLINE`（非同 key 重放）；退出/过期释放座位。`tools/verify_vps_single_user.mjs` 7 项。

### N3 据点数值编辑（已关闭）
- `web/src/content/authoring/gamesource.js`：`editChapterCity`（只开 `troops`/`prod`，门为同记录 `troops_cap`/`max_prod`，decoded 与 raw 同步改写，分歧拒收）→ `tools/verify_editor_city_fields.mjs` 17 项。
- `server/drafts.js`：capture `city` op 门 + save 应用环；`server/copyprofile.js`：`revCity`/`baseCity`/`revertCityFields`（值+raw 一起回滚）→ `tools/verify_vps_city_save.mjs` 8 项。
- `server/public/stronghold.txt` 重写（章节下拉 + 逐城 troops/prod 输入 + 保存，绝对值语义、cap 预检、冲突落字、成功后重读）；`server/public/index.html` 加 `#stronghold-chapters`；`drafts.read` 城市投影加 `troops/prod/troopsCap/maxProd` → `tools/verify_stronghold_ui_model.mjs` 16 项。
- 有意未开：`growth`/`defence`（缺上限证据）、`governor`、`name`（Big5 定长）、`owner`（要 attr/+1B 重建）、放置增删。

### B 组地图/拓扑（已关闭，除 B-3b 的 C 尾巴）
- **B-1/B-2**：`web/src/content/authoring/roadedit.js` 加 `moveCityIntent`/`brokenRoads`（意向不碰正本）；`server/topology.js`（`draft_topology_moves` + `draft_topology_rebuilds` 表，存盘/发布双门 422，**缺表兼容旧库**）→ `tools/verify_vps_topology_intent.mjs` 21 项。
- **B-3a 结构门**：试编译硬锁 192 槽坐标，移城永不可编译（`unsupported city relocation`），故双门是结构性的，重开需 G-SLOTS 槽语义。
- **B-3b**：拓扑路由（GET 状态 + POST move/move-clear/rebuild/rebuild-clear，CSRF+Idempotency-Key+owner 门）→ `tools/verify_topology_routes.mjs` 11 项（Miniflare 冒烟）；`server/public/mapview.txt` 叠加绘制（意向琥珀标 + 断路红线 + 计数，topo 失败降级）→ `tools/verify_mapview_topology_model.mjs` 7 项。
- **Q21/Q59**：`buildRoad` 本就有 shared-cell/segment/X-crossing 拒收与水陆同门 → `tools/verify_road_gates.mjs` 8 项。
- **Q39**：`previewTranslateOutOfBounds` + `requestMapExpansion` + `buildAndStore` 首门 `PLAY_MAP_BOUNDS` → `tools/verify_map_bounds.mjs` 9 项。
- **Q56/Q60**：全工具定义域/拒收矩阵 → `tools/verify_tool_matrix.mjs` 37 项。

### C 组发布序号（C-1/C-2 关闭，C-2b 停工）
- **C-1** `server/releases.js`：`bumpOrdinal`（`0`→1.0→…→1.9→1.10 字符串步进，永不浮点）+ `ReleaseLedger`（发号/当前指针/全历史，无回滚 API＝Q42 设计）。
- **C-2 接线**：`issueInTxn`/`publishInTxn` + `#publishPin` 终提交单事务（重验权属/修订 → 发号 → 上架，pin 形不动，失败回滚不耗号）。`tools/verify_vps_releases.mjs` 26 项（含原子性 4 项）；回归 `verify_publish_matrix` 12、`verify_vps_publish_pack` 22 全绿。
- **C-2b 第一轮主动停工**：见下「当前阻塞」。

### F-1 IDOR 矩阵（已关闭）
`tools/verify_idor_matrix.mjs` 10 项：跨作者与未知 id 不可区分（快照/草稿读写/头像上下行/blob 权柄/任务入队同码，Trial 同 401，未认证恒 401）。

### Q30-1 失败落字（已关闭）
`server/public/general.txt` 三处失败点（保存/头像上传/头像删除）失败写模块区并继续上抛 → `tools/verify_generals_conflict_model.mjs` 6 项；壳矩阵 `tools/verify_editor_shell.mjs` 69 项仍 PASS。

### 产品决策（已落盘）
- **整站单用户在线 (ii)**：见上。
- **发布 UI 按 A**：完整分支验收（已由 A1 完成现有部分）。
- **JPEG 源预算**：保持当前值（16384 像素/单边 8192/100KiB），不扩大。
- 发布UI-A2（补齐作者侧发布对话框+版本列表+公告预览）**被 C-2b 阻塞**，未开工。

## 当前阻塞

### 1. C-2b：E-01 冻结 schema 门与运行时 DDL 存在未解释漂移（需先实跑）
- 新生成器 `.dragon-analysis/editor-phase/backend-deletion-definitions-r2/regenerate.mjs`（纯内存 Node SQLite，15 个源含新 `server/releases.js`）测得 **36 表 / 72 对象 / 253 列**。
- 与 HEAD 冻结清单对比只有两处差异：① 新增 `content_releases`（6 列，预期内）；② **`users` 从冻结的 8 列变成 12 列**（多 `display_name/email/phone/note`）——这是 profile 字段批次后的漂移，冻结目录从未跟。
- 含义：冻结目录比 `worker.js` 旧，且既有 E-01 lane 可能自那时起未在当前 SHA 真跑过。
- **已做**：`git checkout -- server/deletiondefinitions.js server/deletionschema.js` 还原至 HEAD 逐字节一致（`git status` 确认）；只保留生成器与对比件（`r1-head-*.js`）作证据。
- **下一步顺序（不得颠倒）**：先刷各 E-01 套件 `before.json` 的 inputs/imports 双桶 pin → 实跑一轮 `tools/verify_editor_backend_deletion_definitions.mjs` → 用真实失败点区分「目录旧」与「lane 本已红」→ 才谈重定基。受影响套件约 8 个（definitions/columns/draft-freeze/private-namespace/sql-freeze/bound-freeze/validated-waits/key-namespace）。

### 2. 其余挂起项（分类明确，非未完成）
- **依赖 C-2b**：Q25 发布/上架分离、D 组公告后端（同样新增表，建议与 C-2b 合并一次 schema 变更做完）、Q30 剩余（编辑↔发布公告联动）。
- **产品分叉待定**：Q26 普通创建路由（最小模板内容 N6 中立开局未证 + 模板画像身份仅认 full-copy）、玩家同名显示规则。
- **结构关闭**：移城运行准入（需 G-SLOTS）。
- **独立 epic**：G 组物理删除完成态、E 剩余浏览器 lane。
- **部署线（挂起）**：sidecar 上线、V2 解码隔离、V3 分发、V4 读取端、V5 切换。

## 下一步（按推荐顺序）

1. C-2b 实跑一轮 definitions lane（先刷 pin），拿真实失败点。
2. 据结果决定：修目录 / 重定基（记录理由）/ 或暴露真 lane 红。
3. C-2b 关闭后再做 C-2b 之后的 D 组与 Q25（一次 schema 变更）。
4. 产品分叉项（Q26、发布UI-A2）在 C-2b 后统一向用户收决策。

## 本轮失败尝试与教训

- **A1 浏览器轮**：多次栽在"冷后端 + 立即交互"的竞态，最终定位为**产品 bug**（`client.txt` 启动请求清会话），不是测试问题——修产品而非放宽测试。
- **r5 跑不动**：脚本原在证据目录，相对导入全断 → 必须放 `tools/`；`PLAYWRIGHT_MODULE` 环境变量传给脚本的是**路径**（脚本内自包 `pathToFileURL`），且必须相对仓库根。
- **B 组测试自身多处期望错**（组件 footprint 形状、`renameMaterial` 改的是 name 不是 key、水组要求 waterClass、split 只收多格）→ 一律修测试，未动产品。
- **Q30 模型 fakeDOM 缺 `querySelectorAll`** → 补桩；断言用 `findButton` 遍历树而非固定下标（渲染顺序会变）。
- **C-2b**：宁可停工也不拿现状重定基（见阻塞 1）。

## 本轮工作区状态

- 修改：`AGENTS.md`、`CONTEXT.md`、`docs/*.md`（含新 `editor-dev-todo.md`、`editor-vps-cloudflare-plan.md`、`editor-portrait-decode-isolation.md`）、`server/{worker,published,drafts,copyprofile,playpacks,topology,releases}.js`、`server/public/{client,general,stronghold,mapview,index.html}`、`web/src/content/authoring/{roadedit,gamesource}.js`、`web/src/editor/componenttools.js`。
- 新增工具：`tools/verify_vps_*.mjs`（13 个）、`tools/verify_{road_gates,map_bounds,tool_matrix,topology_routes,mapview_topology_model,publish_matrix,idor_matrix,generals_conflict_model,stronghold_ui_model,vps_releases}.mjs` 等。
- 未提交改动 = **全部本轮成果**；用户未授权 commit/push。
