# Checkpoint Journal

> 本文件 = 当前主线状态 + 稳定事实/命令/坑点 + 本轮会话明细。
> 逐批历史明细的维护源：批次证据见各 `docs/editor-*.md` 的「维护源」、验证 lane 状态见 [editor-local-validation.md](editor-local-validation.md)、Trial 线程逐轮交接见 `.dragon-analysis/editor-phase/SESSION-RESTART-HANDOFF-TRIAL-SERVER-R*.md`（最新 R17）。早期逐批明细已自本文件移除，旧版在 git 历史中可查。

## 当前主线状态（2026-10-09，dev HEAD=`ebd4d52`，已 push；Release v0.1.6 已发布）

- **任务一（编辑器）E-05 Trial 服务端线程：批次 1-7e＋8a-8h 全部闭合**。8h 删除级联：`GameDeletionFence.begin()` 同事务级联 trial 行＋资产，链已封存（deletecascade-r1：derive 双向绿→guards 562/269→gate 12/13 真后端→audit 9785→postdoc 9787）。guards **567/272**（multigame-r1 已继任封存）；Q69-(ii)(iii)、round-trip、多游戏 b2 均已链封存；仍不称 Q69/Q70/Q71 闭包完成。
- **用户事项队列**：①统一/胜利终局——✅ 关闭（终局属原版规则不管，编辑器只改地图/据点/道路/人物，规则原样，不做实证）；②战术帧实际验证——✅ 8g 闭合；③删除级联——✅ 8h 闭合；④人物头像上传——✅ 链已封存；浏览器整轮 lane 回归——✅ 全绿封存（browser-regres-r1：pin 换新 guards 564/270→gate 17/0→audit 9843→postdoc 9845；talk 23/11＋talkdirect 23/11＋endview 15/7＋tactical 23/7 真浏览器）；⑤commit/push/deploy——✅ 已推送（ebd4d52）＋Release v0.1.6。
- **Web 产品决定（用户裁决 2026-10-09，非原版机制）**事项④：尺寸不限 128×128（建议值），只保源矩形裁active→64×64，单文件 ≤100K；只收 JPG/PNG；头像资源不绑定 255 槽位（uuid 级 assetId，数量不限）；落盘走 `trial_assets` 派生机制；试运行走 worker（路径 A）。
- **其它 open lane**：E-01 GameBar 图像 native 全图/SDK 502 根因 UNKNOWN；R12-4：发布登记 node 侧已落地（workerd 对等＋装配器下批）、RuntimeManifest/物理删除仍后端线程；城数/将数改造 deferred（引擎固定扫描）；Q70/Q71 open。任务二（地图改造）已收口。
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
- **当前阻塞**：无。**下一步**：workerd 对等、Q70/Q71、E-01、城数/将数改造，或收尾 push。
