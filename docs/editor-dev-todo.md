# 编辑器功能开发待办（功能先行，部署后行）

用户决定：先完成编辑器开发，再说部署的事。部署事项（sidecar上线、V2–V5、发布验证）全部挂起，不在本清单排队。本清单只收功能开发缺口，状态源自[逐项索引](editor-requirements-matrix.md)，不复制证据。

约定：`[做]`=有基础待补完，`[缺]`=基本未开始，`[判]`=待用户决策。

## A. 实体编辑（据点/武将/势力/章节）

N3约束（已探明，不违背）：`FixedCopyProfile.verify`全图比对，城市任何改动都要新chapterEdit op+回滚臂；192基地锁不碰（Q27是“移除放置”不是删城）；字段证据见`re-notes-entity-fields.md`据点§2/§8。
- N3-1 章节城数值：`troops`（+13）/`prod`（+0E/F），门为同记录cap（`troops_cap`/`max_prod`，§8规则3），非负整数。已落地：`gamesource.editChapterCity`（decoded+raw同步改写，分歧拒收），单元十七项全绿；N3-2已关闭：draft capture `city` op门 + save应用环 + `copyprofile`回滚臂（含raw），`tools/verify_vps_city_save.mjs`七项全绿（profile接纳/拒收、存盘rev2、读值可见、超cap/坏形拒收）。N3-3已关闭：`stronghold.txt`章节选择+逐城troops/prod输入+保存（绝对值语义、cap预检、冲突落字、成功后重读），`index.html`加章节下拉，`drafts.read`城市投影加troops/prod/troopsCap/maxProd；`tools/verify_stronghold_ui_model.mjs`十六项（模型轮，非浏览器证书）+ 存盘八项 + 单元十七项全绿。LSP本轮超时未确认，以功能测试为证。`growth`/`defence`（缺上限证据，规则9）、`governor`（要武将身份同步）、`name`（Big5定长编码）、`owner`（要attr/+1B重建）、放置增删（要tile/component证据+回滚臂）全部另立项，不塞N3-1。
- N3-2 N3-1的draft capture op + profile回滚臂 + 存盘往返。
- N3-3 据点表单UI + 引用清单扩展 + 保存发布守卫。
- [缺] N3 据点CRUD：可写资料、放置、章节引用清单、安全移除、已证字段表单。
- [缺] N4 武将CRUD：全字段、历史人物权威、继承、跨章删除、新增槽（128锁定不变；改名/头像/君主军师解散已有）。
- [缺] N5 章节继承与覆盖：可写基础资料、“本章自定义”/恢复继承、势力/首都/预算初始化。
- [缺] N6 普通中立模板与空章：已证中立开局（minimal复制+无章不算数，不填0/FF/50）。
- [缺] Q27 移除据点：保资料/章节、标断路、禁发布。
- [做] Q28 新空章/复制本章：B4a已落地，可玩空白章与继承未放行。
- [做] Q13/Q40/Q41/Q51/Q52：章节独立势力、势力可选、开局无军团、完整/最小复制范围（局部有证，初始化与跨引用未闭合）。

## B. 地图/素材工具

B-3a已关闭（结构门）：试编译硬锁192槽坐标，移城永不可编译（`unsupported city relocation`钉住），B-1/B-2双门是结构性的不是暂行的；重开需G-SLOTS槽语义，另立项。B-3b已关闭：拓扑路由（GET状态+POST move/move-clear/rebuild/rebuild-clear，CSRF+Idempotency-Key+owner门，upsert语义）miniflare冒烟十一项；mapview叠加绘制（意向琥珀标+断路红线+计数，topo失败降级）模型七项。Q26仅剩产品分叉（模板内容/画像/同名显示规则）。B-1已关闭（Q14意向层）：`roadedit.moveCityIntent`/`brokenRoads`纯推导（意向不碰正本）+ `server/topology.js`意向存取（`draft_topology_moves`表，game外存档）+ 存盘/发布双门（有意向即422，缺表兼容旧库）；十三项全绿。B-2已关闭（重建记录层）：`draft_topology_rebuilds`表（形态门：整点/边界/连续/端点一致/长度上限）+ `status()`断路展示（broken/rebuilt/uncovered）+ 门保持红（flags/cost/slots要tile证据，B-3）；同脚本扩展至二十一项全绿。重建UI绘制与B-3全量验证待续；运行时准入仍关闭（原证门）。
- [做] Q14/Q21/Q59：移城断路重连、无据点路口、水陆同门、任意拓扑与规则消费适配。Q21/Q59已关闭：`buildRoad`本就有shared-cell/segment/X-crossing拒收与水陆同门（kind只记不参与门）；新增`tools/verify_road_gates.mjs`七项（水路接纳+同推导+水陆同拒收+X交叉）全绿，既有`verify_road_edit`仍绿。
- [做] Q39：超界预览/确认扩边（当前拒扩图，容量原证未闭合）。已关闭：`previewTranslateOutOfBounds`（越界格精确预览，只读不改）+ `requestMapExpansion`（确认即拒，容量原因为据）+ `buildAndStore`首门（非384×256拒`PLAY_MAP_BOUNDS`）；`tools/verify_map_bounds.mjs`九项全绿，既有115项组件套件仍PASS。
- [做] Q56/Q60/N7：完整语义工具栏、其它变换、语义组件权威（关卡/古战场/长城等）。已关闭可关闭部分：`tools/verify_tool_matrix.mjs`三十七项（全工具定义域接纳/拒收矩阵：查询、引用、更名、移除、水组、填底、平移、调序、拆分、擷取、放置、库门）；旋转/镜像/碰城/路戳/隐藏底明确不在装饰工具射程内（缺tile语义证据，不发明），N7语义组件权威仍缺。
- [做] Q26：普通创建与完整编辑、玩家同名显示。名称归一化（trim/NFC/码点/非法值）既有`verify_editor_metadata`覆盖；作者内唯一已补（S2延伸：同名409、跨作者同名放行，十五项全绿）。普通创建路由待产品分叉决策：最小模板内容为何（N6中立开局未证）+模板画像身份（profile仅认full-copy，直接复用会误标），不定擅动；玩家同名显示规则（匿名目录无creator可比）同样待定。

## C. 草稿/版本/发布（功能侧）

Q30-1已关闭（失败落字）：`general.txt`的`saveEdits`／头像上传／头像删除三处失败现在写模块区消息并继续上抛（提示框类输入瞬态，重做即可；不再只靠壳层status）；`tools/verify_generals_conflict_model.mjs`六项（失败消息+上抛+取消不发POST），壳矩阵六十九项仍PASS，三个编辑模块ESM语法核过。Q30剩余（编辑↔发布公告联动、完整编辑表单）被C-2b/D阻塞。

Q45/Q9/Q20部分关闭：`tools/verify_publish_matrix.mjs`十二项（目录隔离谓词、下架owner/admin矩阵、幂等/内置、改密门）；路由级发布全管线仍待B-3b2装配。Q30剩余为UI/发布公告联动（被C-2/D阻塞）；Q25/C-2待发布链接入+E-01重验。

C-1已关闭（Q18/Q24/Q42核心）：`server/releases.js`（`bumpOrdinal`字符串步进`0`→1.0→…→1.9→1.10 + `ReleaseLedger`发号/指針/历史，无回滚API）+ `tools/verify_vps_releases.mjs`二十二项全绿。C-2接线已关闭：`issueInTxn`/`publishInTxn`双环境形式 + `#publishPin`终提交单事务（重验权属/修订→发号→上架，pin形不动，失败回滚不耗号），原子性四项已验（二十六项全绿），发布矩阵十二项与发布包二十二项回归全绿。C-2b第一轮（未完成，已停工待因）：新生成器`.dragon-analysis/editor-phase/backend-deletion-definitions-r2/regenerate.mjs`在当前源上测得**36表／72对象／253列**，但对比HEAD冻结清单发现**两个不可解释的差异**，故未重定基、已`git checkout`还原两个生成物（现与HEAD逐字节一致）：(1)新增`content_releases`（6列）——预期内；(2)`users`从冻结的**8列**变为**12列**（多了`display_name/email/phone/note`）——这是profile字段批次后的漂移，但冻结目录一直没跟。说明冻结目录比`worker.js`旧，且既有E-01 lane自那时起未在当前SHA真跑过。下一轮C-2b必须先**实跑一轮definitions lane看真实结果**（先刷before.json pin），拿实际失败点区分“目录旧”与“lane本已红”，再决定重定基；不得先改期望。

C-2b待续（E-01三十六表重验epic）：fixture链最终都经`EditorMetadata`构造器，`content_releases`（+1索引）必现，35→36表、243→249列、对象70→73；受影响：definitions/columns/draft-freeze/private-namespace/sql-freeze/bound-freeze/validated-waits/key-namespace诸轮（含before.json pin：worker/published/drafts等已变）+各维护文档。须逐轮改期望、重跑、重封存，不可批量祝福。
- [缺] Q18/Q24 正式发布序号1.0→1.1→…→1.9→1.10（现revision不能冒充，失败不递增）。
- [判] Q25 发布与上架分离：指定正式release、指针/公告事务、管理限制交叉与并发。复判（2026-10-15）：发布链现状 `server/worker.js:310-341`＋`releases.js`＋`published.js`；缺口：① 玩家目录列全部 pin 无 `listed` 过滤——发布即公开；② pin 恒指最新发布，无指定正式 release 机制；③ 公告事务无表；④ 序号 CAS 已有。**用户决策（2026-10-15）：① 发布＝作者定版操作，上架＝管理员操作、只有上架才进玩家目录（即玩家目录必须按 `listed` 过滤，发布本身不公开）。② 不做指定正式版：只增不减；新版＝全新替换，旧版数据删，玩家下拉框只现新版本号（pin 须带 ordinal 供显示；`content_releases` 只留当前行，`next_ordinal` 照递增；A2 版本区只显示当前版）。③ 开放作者自建：模板＝第一章＋公用基础地图（全游戏永一张图，首章据点全中立，多章共同维护）；画像＝自传或模板库选（模板库待建，独立来源）；重名允许，玩家侧显示 `名＋版本（作者）`。**
- [缺] Q42 无回滚：错版只发新序号递增修正。
- [做] Q30/Q45/Q9/Q20：陈旧拒收、两作者/管理员权限矩阵、作者发布不被绕过。

## D. 公告/目录/玩家端
- [缺] Q31–Q36 公告全链：一次公告事务、上下架过滤、冻结快照、只读UI、排序、失败不阻游戏。
- [缺] Q10/Q29 下架续取与旧版保存警告（旧局不断、不热换）。
- [做] Q11/Q19/N8 版本不符单档确认清理、不可用档管理（底层已测，正式政策与UI未接）。

## E. 试运行收尾
- [做] Q67–Q71：列表分支/权限/窗口矩阵、快照迟到组合、撤销/App侧/故障组合的当前SHA整体验收。
- [做] Q37剩余：完整消费者闭包、格式/独立色彩认证（暂缓项除外）；Q69原证缺口另立项。

## F. 账户/安全矩阵

F-1已关闭：`tools/verify_idor_matrix.mjs`十项（跨作者与未知id不可区分：快照/草稿读写/头像上下行/blob权柄/任务入队同码，Trial同401，未认证恒401）。上传/Trial全提交与async边界、线上配置仍待F-2。
- [做] Q38/Q44/Q47：内容资料权限、线上配置（KDF/epoch/改密/限速已有）。
- [缺] T§6：内容IDOR、上传/Trial全提交与async边界、两作者管理员全矩阵。

## G. 删除
- [做] Q43/Q46：fence之后继续——全内容核清、共享保护、备份清理、玩家明确错误退出（不远端清档）。

## H. 用户已决策（2026-10-14）
- [定] JPEG源预算：保持当前值（16384像素/单边8192/100KiB），不扩大。
- [定] 发布UI整体验收：用户选A——发布对话框/版本列表/上下架/公告预览/冲突失败提示按完整分支验收。A1先行（只验现有管理UI）已关闭：模型轮model-r5在当前`management.txt`下26/26；浏览器轮browser-r5在真机Chrome 155下13检查/24调用/9 POST/5查询全绿（与r4同计数，errors空）。r5顺带修出两个真bug（均已改未提交）：(1)`client.txt`启动请求与登录竞态（慢后端上启动401落地清掉刚登上的会话，加`sessionEpoch`代次守卫）；(2)dba2210把解除限制也卡成要`action:'unlist'`（clear按契约收`{}`）。r5门面：11个lane文件pin+28个有归属上下文漂系统计不祝福+2条Chrome155 beforeunload日志噪音单列。
- [定] 并发：用户选(ii)整站单用户在线——任一有效会话存在时新登录一律409（码`SINGLE_USER_ONLINE`，非401）；同key重放、同会话续用不受影响；退出/过期释放座位。Q9/Q20/Q45多角色并存验收收窄为单用户流；workerd开发后端是否跟进该门另议（已封存 lanes 不动）。已实现：`vps/auth-server.mjs`经`EDITOR_SINGLE_USER=1`开启（默认关，S3十九项不受影响），`tools/verify_vps_single_user.mjs`七项（拒/重放/释放/过期）全绿。

## I. 部署（挂起，不排队）
- sidecar上线、V2解码隔离、V3分发、V4读取端、V5切换、Outbox确认协议审阅、发布部署验证。
- V1本地移植切片（S1–S10）作为功能开发底座保留，不推进部署动作。
