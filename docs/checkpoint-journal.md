# Checkpoint Journal

> 本文件 = 当前主线状态 + 稳定事实/命令/坑点 + 本轮会话明细。
> 逐批历史明细的维护源：批次证据见各 `docs/editor-*.md` 的「维护源」、验证 lane 状态见 [editor-local-validation.md](editor-local-validation.md)、Trial 线程逐轮交接见 `.dragon-analysis/editor-phase/SESSION-RESTART-HANDOFF-TRIAL-SERVER-R*.md`（最新 R17）。早期逐批明细已自本文件移除，旧版在 git 历史中可查。

## 当前主线状态（2026-10-09，dev HEAD=`ebd4d52`，已 push；Release v0.1.6 已发布）

- **任务一（编辑器）E-05 Trial 服务端线程：批次 1-7e＋8a-8h 全部闭合**。8h 删除级联：`GameDeletionFence.begin()` 同事务级联 trial 行＋资产，链已封存（deletecascade-r1：derive 双向绿→guards 562/269→gate 12/13 真后端→audit 9785→postdoc 9787）。guards **567/272**（multigame-r1 已继任封存）；Q69-(ii)(iii)、round-trip、多游戏 b2 均已链封存；仍不称 Q69/Q70/Q71 闭包完成。
- **用户事项队列**：①统一/胜利终局——✅ 关闭（终局属原版规则不管，编辑器只改地图/据点/道路/人物，规则原样，不做实证）；②战术帧实际验证——✅ 8g 闭合；③删除级联——✅ 8h 闭合；④人物头像上传——✅ 链已封存；浏览器整轮 lane 回归——✅ 全绿封存（browser-regres-r1：pin 换新 guards 564/270→gate 17/0→audit 9843→postdoc 9845；talk 23/11＋talkdirect 23/11＋endview 15/7＋tactical 23/7 真浏览器）；⑤commit/push/deploy——✅ 已推送（ebd4d52）＋Release v0.1.6。
- **Web 产品决定（用户裁决 2026-10-09，非原版机制）**事项④：尺寸不限 128×128（建议值），只保源矩形裁active→64×64，单文件 ≤100K；只收 JPG/PNG；头像资源不绑定 255 槽位（uuid 级 assetId，数量不限）；落盘走 `trial_assets` 派生机制；试运行走 worker（路径 A）。
- **其它 open lane**：E-01 GameBar 图像 native 全图/SDK 502 根因 UNKNOWN；R12-4：发布登记 node 侧已落地（workerd 对等＋装配器下批）、RuntimeManifest/物理删除仍后端线程；城数/将数改造 deferred（引擎固定扫描）；Q70/Q71 open（战术帧动态浏览器证据已取：trial-tactical-browser-r1 20/20 绿封存，见下）。任务二（地图改造）已收口。
- **Q70/Q71 战术帧动态浏览器证据（2026-10-13，本轮，已提交 965dc06，未推送）**：真实 Chromium 对 lane 后端一次跑通 workbench→trial 窗→宣战（军师进言敌对提案 AL=1 即时接受，张角 0/0）→编成（何進 6000）→canvas 行军令（洛陽→信都，經官渡）→真实交战开战→`session.frame` 推进→offline 冻结→online 恢复→改密终态停战＋战斗关闭，IDB 0、console/page/outside 0。链已封存（derive→guards→run→audit→postdoc）。沿途修三真缺陷（均规则零改动）：①试玩壳自建 world 路图实例（`ai.js`/`gamebar.js` context.roads 优先，`Uncovered original movement Le` 冻泵）；②`closeProposalAudience` 补 drain（宣战 TALK onClose 提交滞留）；③43D3 外交别名走完整 24×24 native 表（`Uncovered diplomacy 2072`）。回归：road 32/0、war 8/8。
- **历史批次一句话**：8g 战术帧实证修两真缺陷（`commands.js` 门面路图→`scenarioNativeRoadContext`；trial web `?v=` 白名单）→561/268；lint 收口（barrel 本地再导出＋tlog 约定）journal 瘦身 883→90 行；browser-regres-r1 四 lane 全绿→564/270；q69ii 两级门→564/270；q69iii 五点 FF 跳过；round-trip 字节同一性→565/271；multigame b2（发布＋/play＋隔离存档＋冒烟 7 项）→567/272。

## 稳定架构事实（Trial 栈，实锤）

- 链路：工作台选章 → POST `/api/games/:id/trials`（issue/commit 两阶段）→ 壳 `/api/trial/web/?trial=<uuid>`（会话 cookie Path=/api）→ 束内 `servertrialapp.js` boot（gate 十字段）→ 战略时钟 hold 并集＋`createTrialBattleFrames` 战术边界。试玩束 216 文件，改 web/src 后必重卷。
- 私有资源：`/api/trial/web/<path>` 统一只读＝束＋`trialRegistryBytes` 两注册表角色；库 398 资源 manifest `fa0ec91f`（93632 字节不变；④三 pin＋(iii) 两 pin 先后换新，资源/refs 不动）；发布 pin 钉修订＋展示名，列表内置恒首项 `卧龙传·制霸天下`，20 条 G127/255 未闭合保持登记。`trial_assets` 派生表：八行（manifest/章 state/六资产）＋上传头像行（`portraits` 清单记 manifest），结束/ fence 级联删。
- 两级门（(ii) 立法）：保存门必填拒存（含草稿）；active 门 15/14/19 全字段＋闭合交叉＋计数（城 192/将 128 dense 锁），draft 记诊断、严格＋试玩拒收。
- 发布玩链（b2，localhost）：POST /api/publish→GET /play 三段选择（游戏→章→势力，pin 复核）→试玩同款运行时 persistent 开＋按游戏隔离 IDB 库；index.html/startmenu 冻结，workerd 对等下批。
- 头像链（事项④）：壳预启动 `mountPortraitUploads` 上传→`POST /api/trials/:id/portraits`→运行 `portraitOverrides` 按 byte 覆盖 kao（未命中回落）→工作台 `POST /api/general-portrait` 写草稿 `portraitKey`（byte 不动，门禁照验 byte）。
- 战术入口：玩家进攻 4F36 必挂起；玩家空城 0x4200 快战无战术。章数据 20 章全零初始军团。
- 权威文档：[editor-trial-server.md](editor-trial-server.md)（设计＋逐批）、[editor-goal-completion.md](editor-goal-completion.md)（最新收口）、[editor-local-validation.md](editor-local-validation.md)（验证清单＋工具表）。

## 关键命令

- 后端：`node tools/editor_server.mjs --serve --port 8322`；自检 `node tools/editor_server.mjs`（含头像回归＋发布段）。
- 发布/回放：`node tools/verify_roundtrip_byte_identity.mjs`（8 检查）；`node tools/verify_play_shell_browser.mjs`（真机 7 检查）；`node tools/verify_editor_trial_talk_gate.mjs <round>`（复制章活体）。
- Trial 工具：`node tools/verify_editor_trial_<name>.mjs <round>`；头像 `node tools/verify_trial_portrait_upload.mjs`；级联 `node tools/verify_trial_deletion_cascade.mjs`。
- 束重卷：`node tools/build_trial_web_bundle.mjs`（改 web/src 后必跑）。
- 证据链（scope 内）：`node <scope>/derive.mjs` → `prepare-guards.mjs` → `run.mjs` → `audit.mjs` → `post-document.mjs`；失败现场移 `attemptN-*` 保留后重跑，不得覆盖。
- Jev 审过：`node tools/jev_assess.mjs <change|failure|reverse-triage> --input -`（先不加 `--send`）。

## 重要坑点（已验证）

- **roadgraph 门面 vs app.world**：试玩壳只装配自建 world，门面恒 null；当前 world 查询走 `scenarioNativeRoadContext(sc).roads`。
- **TRIAL_QUERY vs bust**：trial web 对 query 422，唯一白名单 `?v=original-sprites-1`；响应全 no-store。
- **试玩壳画布竞态**：`#cv` 初始 300×150，须轮询等 width≥1000；`encodeURIComponent` 章 id 的 `#`。
- **dispatcher 无条件分发必自守**：8h gate 实捕 `#postTrialStart/End` 丢路径守卫劫持全部 POST（改密 422）；调用方守或自守二选一，generic 保持先 match 后 admin。
- **guards 双桶**：同一文件 inputs/imports 两桶都要写新 hash；before.json pin 旧 hash，重跑须继任。
- **链式 EEXIST**：derive/run/audit/postdoc 均 once-only，重跑前移现场（含 scope 轮目录）。
- **gitattributes 假象**：大面积脏改常系换行符归一化，用字节比对甄别；journal 工作区 CRLF/worktree 混合属 checkout 现象，链内 pair 走 LF 规范化＋raw 钉 hash。
- **E717 槽纪律／fail-closed**：单格 detour 拒收；`Uncovered …` 是覆盖缺口信号，禁经验补公式。
- 会话改写禁裸切：本轮记录换写（t[:i]）会切掉已追加的决策块，改写后必须补回（本轮 (ii)/A/b2 三块即如此丢失后补记）。
- `--serve` 无监听分支：冒烟须进程内 import startEditorServer（自检同款）。
- 消费者 pin 尾巴：凡改 programHashes 成员必跟 pin 换新（④→(iii)→multigame 三连）。
- 双表示：chapters/*.json（含 connections）≠安装源（x/y/raw，无 connections）；防火墙以安装源为准。
- verify 输出走 `tlog`；`prepareScenario` 别名 enforcement；`structuredClone` 深拷贝；断言读 DOM 不读内存。

## 约定（证据链纪律）

- 批次闭环五段全部 hash 钉住、不重跑已密封 scope、不追认历史成功；derive 失败现场如实登记 attempt。
- 机制结论只认原始证据；推断/未知不进正式规则路径；用户已批准差异另标「Web 产品决定」。
- 试玩内容前提：仅地图/据点/道路/武将数据可定制，引擎/规则/AI（含统一胜利终局）不动；自动化禁触 `E:/Dragon/Dragon/SAVE.DAT`。
- 提交与推送分别授权；不自动改全局配置/信任策略。

## 本轮会话记录（2026-10-10，多游戏 b2＋memory 整理）

- 整批 A 拆 A1/A2 再定 b2（localhost 免登持久玩）；发布登记＋/play＋隔离存档＋冒烟 7 项全绿，multigame-r1 封存（gate 14/3→audit 9940→postdoc 9942）。
- memory 整理：补记丢失的 (ii)/A/b2 决策块（会话改写切掉，内容恢复、字节不追认）；HEAD/队列/lane/命令/坑点同步，长期事实保留。
- 標題下拉 step1（用戶要球 2026-10-11）：新游戏弹窗上方原生 select（内置首项臥龍傳·制霸天下；同源 /api/published-games 拉不到回落内置）；Canvas 原版几何不动，选择态无人消费、对当前游戏零影响；zIndex 9999 盖 Canvas 合成层；--serve 补真监听（前解析无监听）。
- step2 按 B 落定封验（用户裁决 2026-10-11，非原版机制）：主壳固定槽位（内置焊死），非内置离壳进持久会话槽（同引擎同规则，存档按游戏隔离）。标题下拉→8322/play?game= 预选→选章选势力→持久开局，全链真机绿；发布列表对象归一化 bug 修；published-games 加 localhost CORS（只绑 127.0.0.1）；curl GBK 发名致 � 入库教训（node UTF-8 重发）。测试剧本 step2-full 已撤发布（2026-10-11，用户定“去”），列表回仅内置；拷贝残留 store（无删除 API，無害）。
- **Web 产品决定双入口（用户裁决 2026-10-11，非原版机制）**：玩免登；玩家入口与编辑器（后台，有登录）分离，将来绑两个域名。玩侧匿名可达（仅已发布），发侧保持登录/admin。
- **当前阻塞**：无。**下一步**：workerd 对等（裁决已定，新对话按计划执行）、Q70/Q71、E-01、城数/将数改造，或收尾 push。

## 本轮会话记录（2026-10-11，workerd 对等任务 2 存储）

- 新文件 `server/published.js`：PublishedGames（`published_games` 表；pin 形同 node publish.json；写时 checkGameName-40/UUIDv4/revision/sourceDigest/chapters 422，读坏 fail-closed 500；unpublish 幂等＋owner/admin 403；list 无 auth 由路由定匿名）。
- `server/worker.js` 接线（无 blob 依赖，与 games/management 同级构造）；`server/deletionfence.js` begin 级联删发布行（sqlite_master 守卫，对标 trial 级联）。路由/已编译鉴真/published-games 匿名＋/play 壳下批任务 3。
- 验证：node --check 三文件过；伪 DO 存储单测 17 项绿（往返/覆写/幂等/7 拒收/owner/admin/双 corrupt-500，用后即删）；LSP 三文件 clean；`git diff --check` 过。node 侧未动（回归留任务 5）。改动未提交。

## 本轮会话记录（2026-10-11，workerd 对等任务 3 路由＋壳）

- `tools/build_trial_web_bundle.mjs` 增发 `server/public/playapp.txt`（schema dragon-play-app-shell-1；同骨架换 boot→playapp.js＋#play-status＋title 選擇遊戲 — 臥龍傳＋stylesheet 绝对 bundle URL，对标 node /play 置换；trial 壳字节未动）。顺带重卷 trialweb.txt 216→217（HEAD 后 web/src 漂移：playapp.js 新增＋6 文件变更，含 step1/2 内容；壳未动）。
- `server/security.js`：config 增可选 `EDITOR_PLAY_ORIGIN`（https/异域/非空校验，错配 503；未设＝单域名）。
- `server/worker.js`：DO `#isPlayRoute`（GET published-games＋/api/play/web 匿名，cookie 前分流）；玩域名非玩路由 404；publish（登录＋owner＋snapshot＋capture＋validate＋compileTrialSource 即时编译鉴真，`PUBLISH_NOT_COMPILED` 422）/unpublish（登录＋owner/admin，幂等键格式守卫＋天然幂等不复 sealed）；入口 `GET /play` 匿名壳（trialHeaders CSP）＋玩域名编辑 UI 404。无 CORS 白名单（同域即够）。
- 验证：三文件 --check 过；play 壳 sha/len 自检＋壳引用闭合（2 绝对 URL 皆在束内，零相对残留）；LSP clean；diff --check 过。pack/势力/持久留任务 4，真机留任务 5。改动未提交。

## 本轮会话记录（2026-10-11，workerd 对等任务 4 持久语义）

- 新文件 `server/playpacks.js`：PublishedPacks（`published_packs`＋`published_pack_assets`；发布把已证编译冻结为 node 形 manifest whole-game＋章 states＋6 载荷，minimap 复 node 派生，visuals 复 trial 级 registry 绑定；读坏 fail-closed 500/503，digest 钉死 409，章缺 422）。
- `server/worker.js`：publish 先冻包后登记（包孤儿不可见优先）；unpublish 同删包；匿名 `GET /api/trial-pack`（原名对等，revision/chapter 缺省对标 node）＋`GET /api/trial-asset`（原名，digest 必须钉 pin）＋`GET /content/builtin/compiled/*`（仅 8 季图 role，sha 重验；入口放行转发，玩域名可达）。playapp 零改动：persistent 透传＋playSaveDatabaseName 按游戏隔离已在浏览器侧就绪（main.js:953）。
- fence 级联扩展两包表。验证：四文件 --check 过；伪存储 13 项绿（含真 bug 一枚：serve 方法形参 shadow 模块 `revision` 校验函数，已改名；另有两桩 sha 不一致，桩问题）；LSP clean；diff --check 过。R2 实读＋发布全量编译耗时与真机留任务 5。改动未提交。

## 本轮会话记录（2026-10-11，workerd 对等任务 5 验证）

- node 侧：自检绿（含 publish round）；`verify_play_shell_browser.mjs` 7/7 绿（下拉→预选→开局→隔离，IDB 按游戏隔离）。
- workerd 真机（wrangler CLI 被代理 hang，改用其内置 miniflare 4.x 程序化＋自签 HTTPS＋同源 env）：smoke 17 项绿（/play 壳、health、published-games 内建唯一、bundle、trial-pack/asset 未发布 404＋码、login→rotate→unpublish 幂等 200→publish 未知 404→空名 422→匿名 401）；origin 门 dispatch 探针（同源 200/伪域 403/http 403）。
- miniflare 程序化坑（已实锤，均环境侧非代码错）：`durableObjects` 对象式须 `useSQLite:true`（否则 SQL 未启用全 /api 500，基线 aca488b 同样复现）；`vars`→`bindings`、`r2`→`r2Buckets`（旧键静默丢弃，entry/DO 双双无 env）；modulesRules ESModule 须含 mjs；Text 含 txt/html/css；须 `rootPath`。
- 附带修复（真机发现，node 对标 editor_server.mjs:376 先验名）：`#publishPin` 空名 422 先于权属 404（原 404 优先）。
- 常驻对等段：`tools/verify_workerd_parity.mjs` 20 项绿（路由/门禁/损坏 fail-closed/校验顺序/冻结/幂等/无新绑定）。
- 缺口（另 lane）：workerd 完整玩链需 installed-source bootstrap（editor_stage_source＋R2 上传＋staged env）；本次覆盖空注册表面的全部新路由/门禁/错误码。改动未提交。

## 本轮会话记录（2026-10-11，workerd 对等任务 6 封存）

- 独立链 `.dragon-analysis/editor-phase/workerd-parity-r1/`（derive→guards→run→audit→postdoc）已封存：derive 冻结 7 authored＋2 generated 文件哈希＋机制/顺序断言；guards（node 版本/批次完整/SAVE.DAT 未碰/仅批次脏）过；run 三收据（自检 OK、矩阵 20、浏览器 7）；audit（收据＋批次不可变）过；post-document sealed。LSP 七文件 clean，diff --check 过。改动未提交（commit/push 待授权）。

## 本轮会话记录（2026-10-12，编辑器单系统壳 B1）

- 排期 `docs/editor-shell-plan.md`（B1 壳→B2 用户管理→B3 游戏列表→B4 模块补齐；node 多页面定位本地工具保留）。
- B1 落码：`server/public/index.html` 加 `#shell>#menu+#main` 左菜单右主窗（登录后显）；`client.txt` 菜单构建/视图切换（6 视图，帳戶與管理仅 admin 且须已改密）＋render 接线＋`beforeunload` 脏离开提示（§4.7）；`style.css` 菜单布局。
- 验证：`tools/verify_editor_shell.mjs` 34 项绿（含 q() 跨文件 id 闭合）；miniflare 浏览器 live 8 项绿（匿名只见登录、改密后 6 菜单、默认草稿、切换阶段）；node 自检绿。独立链 `editor-shell-b1` sealed。改动未提交。

## 本轮会话记录（2026-10-12，编辑器单系统壳 B2 用户管理 §4.6）

- 落码：users 表加 display_name/email/phone/note（含老库 ALTER 迁移）；seed/create INSERT 补空值；dto＋principal 透出资料；`POST /api/auth/profile`（自助，仅可选字段，version 递增、会话不死；must_change 期间照常被 403）；disable 加 ADMIN_LAST（最后启用 admin 不可禁）；client/index 加個人資料表单＋列表展示。
- 验证：`verify_editor_shell.mjs` 40 项绿；miniflare live 10 项绿（改资料→会话存活→持久→空体 422→禁 tianyi 403→建/禁作者）；node 自检绿。独立链 `editor-shell-b2` sealed。改动未提交。

## 本轮会话记录（2026-10-12，编辑器壳 B3 游戏列表§4.1）

- 后端：`metadata.js` 加 `setListed`（owner-or-admin；restricted 挡住全体上架，admin 走 unlist 原 restrict 流；builtin 403；条件 UPDATE 防并发）；worker 接 `GameDeletionFence`（`POST /api/games/:id/deletion` begin＋`GET deletion-operations/:key` query，fence-only）；`#postManagement` 拆 creator list/unlist 分支＋`#postAdminUnlist`（unlist/clear-restriction）。
- 前端：own-games 行升级（名/简介/创建/修改/状态＋上架/下架/测试运行/删除＋规则提示）；draft 加 `gotoGame`（测试运行跳转载入）；management 行补简介/日期；copy 节规则提示。
- 验证：静态 47（＋7 B3）＋miniflare live 7（login→rotate→listing 缺省 404→坏 action 422→deletion 缺省 404→坏体 422→query 缺省 404）＋自检绿；LSP clean（txt 无 server 既往如此；修 worker 未用 request hint）。
- 缺口（另 lane）：有游戏状态流转全链需 installed-source bootstrap。改动未提交。

## 本轮会话记录（2026-10-12，编辑器壳 B3 封存）

- 独立链 `.dragon-analysis/editor-phase/editor-shell-b3/`（derive→guards→run→audit→postdoc）已封存：run 双收据（矩阵 47、自检 OK），audit（收据＋批次不可变）过。附带修：`#postEntryRoutes` 漏解构 `deletionPath` 致全 POST 500（live 发现，已补）；worker 未用 request hint 已删。B1/B2 仍未提交（style.css 等为其遗留，guards 放行注明）。改动未提交。

## 本轮会话记录（2026-10-12，编辑器壳 B4a 章节§4.5）

- 后端：gamesource 加章节 CRUD（addBlank/copy/delete/rename＋gap 计数；改名只拒空与控制字符）；draft save 接 `chapterEdits`（≤16，严格字段，DRAFT_CHAPTER_EDITS/EDIT 422）；read 回执带 gaps；publish 无章节 422（PUBLISH_NOT_COMPILED，原链可发布空章可玩性断层）。
- 前端：draft 节章节管理区（缺口显示＋新增/复制/改名/删除＋删章确认文案）；save 后重载新修订。
- 验证：静态 51（＋4 B4a）＋函数单测 10（空章 0 保存缺口/2 发布缺口，符合设计）＋miniflare live 8＋自检绿；LSP 唯一告警为既有 `#profile` 布尔参。改动未提交。

## 本轮会话记录（2026-10-12，编辑器壳 B4a 封存）

- 独立链 `.dragon-analysis/editor-phase/editor-shell-b4a/` sealed：run 双收据（矩阵 51、自检 OK），audit（收据＋批次不可变）过。改动未提交。

## 本轮会话记录（2026-10-12，编辑器壳 B4b 据点§4.2）

- gamesource 加 `cityReferences`（放置／道路／章节引用派生）＋`checkCityDeletable`（检查单，无 mutation；192 锁定实锤，CITY_COUNT_LOCKED 常驻 blocker）。
- 新據點节 `stronghold.txt`（游戏选择＋据点表＋刪除檢查＋规则提示）＋client/index/worker 接线（`/stronghold.js`）。
- 验证：静态 53（＋2 B4b）＋函数单测 6＋live 1（/stronghold.js 200 且含 installStronghold）＋自检绿；LSP clean。缺口：改图／图片清单＋有游戏全链（bootstrap lane）。改动未提交。

## 本轮会话记录（2026-10-12，编辑器壳 B4c1 武将人物基础§4.3）

- gamesource 加 `renameGeneral`（章内名／字；名非空＋控制字符拒，不发明长度规则）＋`checkGeneralDeletable`（128 锁定检查单）；draft save 新 op `rename-general`／`portrait`（后者复用既有 setGeneralPortrait 纯函数，kao 回退不动）。
- 新武將节 `general.txt`（章武将表＋改名／字＋頭像綁定／清除＋刪除檢查；单键保存＋修订核对，未确认不重試）＋client/index/worker 接线（`/general.js`）。
- 验证：静态 55（＋2 B4c1）＋函数单测 10（rename 6＋portrait 4）＋live 1（/general.js）＋自检绿；LSP 仅预存 drafts.js flag-argument 警告（非本批）。缺口：头像上传管线＋势力配置 B4c2＋有游戏全链。改动未提交。

## 本轮会话记录（2026-10-12，编辑器壳 B4c2 势力§4.3）

- gamesource 加君主／军师／解散四函数（章内势力实体 Q13：换君主留势力；新君主须自由＋无任职；一势力一名军师，替换回 replaced；免君主须继任或解散；解散成员转自由＋据点转中立＋删记录仅本章，join_faction 历史不动）。
- drafts.js 加 `set-monarch`／`set-strategist`／`remove-monarch`／`disband-faction` 四 op（严格字段）；武將节加势力面板（立君主／设军师／免君主／解散＋替换／解散双确认）。
- 验证：静态 57（＋2 B4c2）＋函数单测 8＋自检绿；LSP 仅预存 drafts.js flag-argument 警告（非本批）。缺口：头像上传管线＋有游戏全链。改动未提交。

## 本轮会话记录（2026-10-12，编辑器壳 B4d1 地图示意§4.4）

- 新地圖节 `mapview.txt`（唯讀：游戏选择＋canvas 放置点／道路折线＋道路表；无编辑，放置 192 锁定＋拓扑钉死＋图块语义未审计）＋client/index/worker 接线（`/mapview.js`）。
- 验证：静态 58（＋1 B4d1）＋live 1（/mapview.js）＋自检绿；LSP clean。缺口：全部结构编辑另行排期。改动未提交。

## 本轮会话记录（2026-10-12，BOOT-1 lane：真机全链＋收据扩展）

- 真机发现 publish 500：`SQLITE_TOOBIG`——2.36MB 整包 chaptersJson 超 workerd SQLite 单值上限（真机实锤，非逻辑错）。修：`published_pack_chapters` 逐章分行（~122KB/行）＋重组校验（缺章／多章→PLAY_PACK_CORRUPT）；fence 级联＋retire 同删。
- 真机发现 draft read 只回摘要：general/stronghold/mapview 三 UI 读 `state` 扑空。修：收据扩展（章 generals 名册＋factions 君主／军师／首都＋cities 名册＋strongholds 权威引用＋map 道路几何），三 UI 改用收据形状。
- 链：install→reserve→copy-run→game→read→save→publish→pack→asset 全通；transitions（list/unlist/rename/disband）验证中。miniflare 程序化要点：r2Persist/durableObjectsPersist（无顶层 persist）、幂等键每轮随机、限流 10 分钟窗。

## 本轮会话记录（2026-10-12，BOOT-1 lane 真机 bug 收获）

- 真 bug 其一：`fields(edit, ['op'])` 预检与分支检查矛盾，所有带参 chapterEdits（B4a 的 copy/delete/rename 亦从未走通过 save）永拒 422。修：预检改为对象检查，分支各自 fields＋末 else。
- 真 bug 其二（B3 遗留）：admin unlist If-Match 正则 `$` 写进引号内，永假；且共享 fields 门先于 admin 分支（REQUEST_FIELDS）。修：正移到引号外＋门顺序（先 action→admin→creator fields，null 加守）。
- 收获：save 无变更幂等不推进修订（正确行为，脚本已重排先改后发）。

## 本轮会话记录（2026-10-12，BOOT-1 lane 封存：真机全链打通）

- 真机全链（miniflare＋persist＋staging）：install→reserve→copy→read→rename→read→disband→read→publish→listed→pack→asset→list→unlist→unpublish→pack-gone 全绿（e2e part1 13 项＋part2 10 项，同一 lane DB）。
- 修 profile 章节编辑死锁：`revertAppliedChapterEdits`（op 精确 revert＋compare 兜底；篡改／越权／错序 fail closed，node 单测覆盖 rename/disband/monarch+portrait/delete+add+copy＋三拒收）＋`#editHistory`（revision 链回放，save/read/compile 三处）。
- 修 draft read 收据扩展（章名册＋strongholds＋map 道路几何），三 UI 改用收据形状（此前读 state 扑空）。
- 修 per-chapter pack rows（2.36MB 整包 SQLITE_TOOBIG）＋fence/retire 级联。
- 修 listing 门顺序＋admin unlist If-Match 正则 `$` 错位（B3 遗留，永假）＋chapterEdits `fields(edit,['op'])` 预检杀死全部带参 op（B4a 遗留）。
- 验证：静态 63（＋4 BOOT-1）＋自检绿＋LSP（仅预存警告）。独立链 editor-shell-boot1 待封存。改动未提交。

## 本轮会话记录（2026-10-12，BOOT-1 追查：二次 disband 错位＋全链 20 绿重封存）

- 真 bug（live 实锤，node 单次复现漏网）：`revertDisband` 按 baseline 下标 splice；历史已有删除压缩数组后错位（`factions.1.advisor_idx: 60 vs null`）。修：按 baseline 相对顺序插入（找首个现存后继，不存在则 append）。
- 顺带修同类潜 bug：copy 匹配用 `JSON.stringify` 对顺序敏感（快照往返 parser 排序键，baseline 保持 loader 插入序），改走结构 compare＋WeakMap。
- e2e 本轮全绿 20 项（rename→disband→publish→pack→asset→list→unlist→unpublish→pack-gone，同一 lane DB rev1-4；另补 disband#1 落库复核）。其间 e2e 探针小修：listing expectedRowRevision 改读现值（GAME_CHANGED 守卫行为正确）。
- 验证：静态 65（＋2 本轮）＋自检绿＋LSP clean（仅预存警告）；独立链 editor-shell-boot1 已重封存。改动未提交。

## 本轮会话记录（2026-10-12，B4e 头像上传管线§4.3/Q37 封存）

- 新文件 `server/portraits.js`：GamePortraits 游戏级库（owner-only；id 1-32 字母＋pack 保留名拒；PNG/JPEG sniff；100KB；128×128 头解析 PNG IHDR/JPEG SOF，不解像素；删拒当前修订在用键，旧修订 kao 回落）。
- worker：`POST/GET /api/games/:id/portraits`＋`POST :id/portraits/:key` 删除（空体）；幂等键 'portrait' 命名空间；assertNotDeleting。
- publish：pack manifest.portraits（role game-portrait）＋bytes 进 published_pack_assets；serve 门扩展（manifest 内＋mime 取 entry）；sha/mime 重验。
- fence 级联 game_portraits；武将节上传面板（canvas 中央裁剪预览＋列表 inUse＋删除）。
- 真机全链：上传 201（422/409 负例）→列表→绑定→发布→包内→asset 字节→删拒 409→解绑→删除落库。附带修真 bug×2：workerd BLOB 系 ArrayBuffer（instanceof Uint8Array 永假）＋`#postPortraitDelete` 漏解构 request。
- 环境注记：miniflare HTTPS 慢响应（47s＋）客户端掉线为环境抖动，服务端均 200/落库；探针以同键重试＋状态复核应对。
- 验证：静态 69（＋4 B4e）＋单测 15＋自检绿＋LSP clean。独立链 editor-shell-b4e 已封存。改动未提交。
