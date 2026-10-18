# AGENTS.md — 臥龍傳 Web 项目记忆

> 本文件只维护长期事实、架构、命令、约定及当前主线。先读[全局AGENTS](../AGENTS.md)：安全、原证、审批与自主执行以其为准。
> [journal](docs/checkpoint-journal.md)只保留当前状态、限定验证摘要与证据入口；版本沿革见[CHANGELOG](CHANGELOG.md)，旧调试流水通过Git历史追溯。机制详细源为相关SKILL/`re-notes`，不在记忆中复制。历史日志不是任务授权或机制证明。

## 1. 边界与当前主线

- 原生JavaScript ES Modules + Canvas 2D重写1995 DOS《臥龍傳》，无模拟器、框架、构建步骤或npm运行时依赖；完整`web/`可由静态HTTP服务独立运行。
- 仓库`E:/Dragon/web-port`；原程序`E:/Dragon/Dragon/`；官方基准`E:/Dragon/原版/`；`上/中/下/后/`为改版库。自动化禁止访问真实`SAVE.DAT`、用户存档/profile；测试用内存、mock或新隔离profile。
- **现行规则主干**：fresh与restore使用v2原生道路/固定表，生产v1路径已删除，不相容槽禁用。原生接线及门后续段已有各自限定域证据，但不据此宣称完整战役或所有原机制均已认证。未知消费点继续fail-closed，保已提交前缀、hold/禁存。
- **当前主线**：仓库版本`0.1.7`（`VERSION`；发布历史见`CHANGELOG.md`）；不据历史journal或本地remote-tracking ref宣称实时远端发布状态。发布号由`VERSION`维护，独立规则基线仍为`web-0.1.1`。存储/内容扩展、地图分段脏层、灾害只读播放器、据点/军团锚点、战术对白折行、G1F评分刷新与普通军师新局初始化已落地。E-01 编辑器后端 schema 基线为 **50表／49索引／99对象／343列／4FK**（23 DDL源，新增冻结分发state/events/chunks；原47表字面声明保留，冻结源为`server/deletiondefinitions.js`＋`deletionschema.js`＋`distributiondeclarations.js`）。当前23源复核用`tools/verify_editor_schema_sources.mjs`；历史生成器`.dragon-analysis/editor-phase/backend-deletion-definitions-r2/regenerate.mjs`不再代表完整输入，不能直接重跑覆盖。详见[R2接线§2.17](docs/r2-player-connection.md#217-共同账本-schema-与删除检查ledger-schema-1)。
- **工作方向**：在单一规则/AI/地图引擎上推进已批准的Web工程与表现任务，不以“全逆向完成”为工程重构前提；性能先测量再切片。编辑器与当前游戏统一地图迁移遵循第2.1–2.3节；超原容量、任意道路/城池移动及完整组件分层不能因已有设计而视为已实现或已授权。
- **编辑器任务顺序（用户决定）**：**先完成编辑器开发，再说部署**。逐项清单与状态见[编辑器开发待办](docs/editor-dev-todo.md)。部署拆分已确认并部分实施：VPS（权威 Node＋SQLite）／Cloudflare（玩家程序＋R2 `dragon` 桶只读投影）职责见[平台拆分](docs/editor-vps-cloudflare-plan.md)；画像禁上传、共用库一对一（`web/kao` 621 PNG＋`manifest.js`，R2 `kao/` 已同步）；发布上架分离（上架仅管理员）、单版本替换（用户最新更正：新版上线后旧版全部作废，不保留旧版续玩兼容，见[产品§5](docs/game-editor-design.md#5-草稿校验与发布)）、作者自建、公告后端、发布 UI（A2）均已落地；V3 publisher（`vps/publish_to_r2.mjs`）＋V4 读取端（`reader/worker.js`）＋分发账本 Outbox 已有本地原型；后继签名固定资源切片见[接线状态](docs/r2-player-connection.md)，不等于持久排空、完整玩家接入或部署。业务／鉴权已提取为共同应用，Node HTTP与workerd本地验证见[VPS就绪审计](docs/vps-editor-readiness.md)；生产启动装配及完整接线仍未完成。
- 原机制只依据原指令/原数据/受控原运行态，区分实锤、推断、未知。Web产品差异单列；不凭现代码、测试或体验补公式。容量仍为原运行域，不自动授权超过192据点或改变AI/调度。
- 保留共享脏改；commit、push分别需要明确授权，不调整全局配置、信任或权限来绕过工具限制。发布目标须显式指定：`github`与Gitea镜像`origin`不是同一目标，不能因默认remote误推。
- 只纳入产品代码、测试、迁移及必要文档；本地代理状态、缓存、临时报告/截图、运行产物不入版本库，也不擅自清理。仓库外SKILL不强行复制进仓库。

## 2. 架构与数据流

`原版非存档资料 → 显式离线导入 → Web编辑源 → 校验/编译资产 → Scenario副本 → 保存守卫/快照 → IndexedDB`

模块路径相对`web/src/`：

| 模块 | 职责 |
| --- | --- |
| `main.js`、`app/startflow.js`、`app/battleflow.js` | App装配、标题/开局、战斗接续；新局与读档共用`loadState` |
| `content/`、`game/world.js`、`game/worldresources.js` | 内容/章节/修订身份、Scenario副本、每世界资源实例 |
| `game/navigation/` | 原生道路图、地形/占格能力与规则桥；不用通用Dijkstra/A*替代原寻径 |
| `game/ai.js`、`weather.js`、`autobattle.js`、`legionscheduler.js` | 战略规则、灾害、速算及逐槽调度 |
| `game/native*.js`、`legionphase.js`、`legioncounts.js`、`legioncontinuation.js`、`strategicfailure.js` | 固定原始表、相位/计数、续段所有权、严格恢复与故障暂停 |
| `game/clock.js`、`tacticalclock.js`、`battle/original*.js` | 战略/战术预算、权威Session、RNG、VM、结算 |
| `game/savegame.js`、`core/saverepository.js`、`indexeddbsavebackend.js`、`localstore.js` | 快照/守卫与仓储分离；单档正文及摘要原子写入 |
| `render/`、`ui/`、`game/playerqueries.js` | 只读绘制与表现状态、GameBar/HUD、消息FIFO、纯查询 |

- 逻辑基准640×400；现世界384×256格、16px图块、192道路节点；128军团槽、22正常势力、24×24外交矩阵、256×4B事件轮。哨兵、别名及排除槽有语义，不能把固定循环一律改成数组length。
- `web/content/builtin/`是编辑源，编译产生20章模板及资源；命名state字段为权威，未知兼容字节保留。解析纠错先导入新目录比较，不手改生成物掩盖错误。
- 图集、地图布局、世界资源与道路拓扑分离；画道路不等于建立通路，图块索引也参与规则。地图分块保留非整数DPR的整图采样回退；发布资产不等于跨文件原子事务。
- 新局live `legions=[]`不代表原始表可缺失；显式初始化有来源合同。地图对象前16火灾/暴动、后16雨云，不filter压缩槽号。
- 多档仓储使用同源IndexedDB `wolong-web/saves`；正式保存不是DOS文件或服务端API。目录与单档正文同事务提交，完成前不得报成功。`saves.html`提供隔离管理/JSON备份，`editor.html`只编辑现容量许可字段并导出补丁，不热改运行场景。
- 用户不要求旧Web格式兼容，但这不授权批量清库。新档须完整保存RNG/固定表/调度/能力状态；旧或不相容槽在hover、hit-test、click三路禁用。
- 读档先回标题；detached校验和资源ready后才安装。await后核scenario/world/clock/票据；预检失败不碰live，安装后故障保前缀并禁存，不假事务回滚。战斗、未完成交互/续段/装配/故障均禁存。

既有架构维护源：[基础重构](docs/web-refactor-phase1.md)、[多档/受限编辑/地图分块](docs/web-refactor-phase2.md)、[内容架构](docs/content-architecture.md)、[表现现代化](docs/presentation-modernization.md)。两份“第二阶段”分别指内容扩展和表现升级，不混为同一范围；既有受限编辑器不是下面的完整互联网编辑器。

### 2.1 编辑器与统一地图的文档职责

开展这些模块的设计、实现、审阅或验证前，按任务范围读取以下维护源；本文件只留长期约束，不复制字段表、接口清单、原证或批次成绩。

| 维护源 | 职责 |
| --- | --- |
| [产品设计](docs/game-editor-design.md) | 编辑器及多游戏玩家入口的已确认需求、产品更正与待确认建议 |
| [工程合同](docs/game-editor-technical-design.md) | 原游戏迁移和编辑器共用的数据、编译、加载合同；另含编辑器专属账户、发布、试运行等接口，不能把全部后端功能当迁移前提 |
| [迁移计划](docs/game-map-migration-plan.md) | 当前Web游戏地图改造的切片、差异、验收和退出条件，不是改写DOS原程序 |
| [准入排查](docs/re-notes-editor-map-admission.md)及相关SKILL/原证笔记 | 分层、道路/城市/章节、容量限制的证据与缺口；仍须复核本次影响范围的原始来源 |
| [术语表](CONTEXT.md) | 统一用语，不替代需求、机制证据或技术规范 |

产品决定、工程建议、现有实现、原机制证据与测试通过须分别标识。初次设计补齐或只读排查完成不等于方案已最终确认、迁移完成或任意自建游戏可运行；文档更新不自动授权产品实现、部署、commit或push。当前差距导航见[逐项索引](docs/editor-requirements-matrix.md)；基线98f0630的接线／历史收据时效／头像与剩余审计见[小范围审计](docs/editor-closeout-audit.md)，不替代产品或工程合同。

### 2.2 执行顺序与迁移准入

1. **先确认编辑器方案及共同地图合同 → 再迁移并验证当前Web游戏 → 确认无问题后开发编辑器。** 迁移发现合同缺口时回流共同设计；不另设原图专用格式、校验豁免、加载器或第二套规则/AI。
2. 迁移按M0基准/证据核对、M1自动小地图、M2统一源及运行接线、M3隔离真实编辑样本推进。自动小地图是首个可见交付，不等于整个迁移完成；迁移不要求先建设账户、互联网发布服务或完整编辑UI。
3. 在原384×256地图、固定192据点及现有槽域内，已取得的数据保真依据支持受控迁移的可行性判断，**不等于完整拆层、动态更新与同引擎验收已通过**。先核本批依赖，证据不足只暂停受影响机制；任意扩容、新拓扑或完整空白章节不是原槽不变迁移的共同前置条件。
4. 必须证明组件可实际修改、重新编译并由同一入口加载；不得只换包名/ID、重编未变原图或把整图包成不可编辑背景。未知底层保留unknown，副本删除时由作者明确补地形，不猜填、不恢复旧截图覆盖后续修改。
5. 拆层仍保持Scenario的唯一规则地形权威。野战邻域采样、开局着色、易主中心/角块写回须按原证核对；视觉只读投影，季节、脏块、非整数DPR回退及JSON恢复不得丢失写回、重播规则/RNG或反写创作源。旧静态画面不能掩盖本次触及的已证缺口。
6. 原图证书不推广到任意改路/移动城市/增删节点；移动也可能改变编号及战场绑定。未知初始化不补零，不以假城市填槽，不把旧显示计数或不完整connections当完整新章/拓扑权威。具体G-MAP/G-ROAD/G-INIT/G-SLOTS逐项取证。
7. **显示范围、地理寻址、实体表容量分别验证**。扩画布、放宽width或数组length、剩余边/点空间均不证明原引擎支持扩容；坐标字宽、stride、搜索工作区、固定泵/哨兵、天气、战术目录、保存和资源内存须审计。G-CAP未解除不放行超域运行，也不因此阻塞无依赖的原尺寸迁移。
8. 完成标准按迁移计划：无编辑规则字节/有序道路保真、真正修改的隔离组件样本、20章/季节及涉及战术入口、固定RNG已覆盖规则路径、隔离JSON恢复/拒绝、新浏览器实际接入、缓存与迟到资源，以及小地图用户视觉验收。保留来源hash、差异和覆盖限制；自往返不是旧档兼容，离线生成不是游戏已接入，局部通过不是全战役认证。

### 2.3 已确认的编辑器与多游戏边界

以下是后续实现须保持的产品边界，不表示功能已经存在；细节以产品设计对应节为维护源。

- **原件保护**：内置游戏始终上架，管理员也不能通过编辑器直接修改、下架或删除。授权的Web工程迁移与编辑器写权限分开，原DOS资料只读。首个可编辑实例是管理员完整复制的独立测试游戏（地图、据点、人物、势力、全部章节，不含对局/存档）；普通新建仅复制地图/道路/中立据点，不复制人物/势力/章节。复制固定来源修订，不能追踪模板更新；副本编辑、编译、发布、删除不得改写原件或共享资源。
- **共同内核与身份**：内置、正式自建和草稿试运行使用同一源合同、校验/编译与规则/AI/地图加载引擎；仅权限、内容身份和存储能力不同。引擎只维护一份源码，改动按同一批次同步到VPS试玩与Cloudflare正式端并分别验证，不分叉。稳定游戏/实体ID与原运行槽分开，身份独立不代表槽重排已经安全。同游戏章节共用地图，章节维护所属/角色/资源及明确覆盖，不热改运行对局。
- **四层与路网**：自下而上基本地图→地图装饰→道路→据点；装饰可同层叠放/调序，显隐/锁定只是工作区状态。道路/据点不因下层地形种类禁止放置，水陆路型由作者指定，不随水域覆盖自动改变；仍验证引用、连接、断路、禁止的交叉及规则支持域。装饰这个名称不表示无规则作用，显示水域分类不替代原通行/野战分类。
- **自动小地图**：同一地图源自动生成，原/新游戏不保留两套算法或必需手工渐变图；明确河/湖/海地理，保留静态水陆路网，动态军团路线不能代替道路。非水域遮挡不抹去水域摘要，重叠取最上方水域。等比例完整显示、留边不导航，图片/标记/视口/点击共用实际矩形；可用空间足够且有需要时地图区域宽高各增约20%，连同外框/名牌适配。渐变/随机感纹理尽量接近原游戏，生成可复现且不消费规则RNG，最终视觉由用户验收。
- **编辑权限与界面**：指定创作者经独立入口/端口登录，仅管理自己的内容；管理员有全局上下架/限制与删除权限，但不编辑或发布他人内容，内置保护不例外。停用账户不自动下架其游戏。编辑器只要求桌面浏览器，内部界面繁体中文，不自动转换用户内容；工作台允许常规关闭/取消/右键工具菜单。玩家匿名使用，游戏界面的右键/关闭/hold约定不因编辑器而改变。独立端口或新窗口不构成权限、cookie或存储隔离证明。
- **拆分部署（用户确认，发布就绪后执行）**：编辑器／账号／草稿／私有Trial／编译解码在VPS，玩家程序及正式运行数据在Cloudflare；两套部署是同一引擎的两份副本，VPS试玩用于验证编辑成果，引擎改动须同步更新两边。内置资源／游戏origin保持，不建Containers／解码Worker；自建数据发布不经Git或程序部署。产品边界见[产品§5.5](docs/game-editor-design.md#55-vps编辑器与cloudflare玩家端拆分最新确认)，适配／同步／读取方案见[平台拆分](docs/editor-vps-cloudflare-plan.md)。共同应用已有Node／workerd适配，未完成VPS迁移。后继用户已明确授权先补齐发布条件，再提交／推送GitHub main、循环核Cloudflare部署成功，随后部署约定VPS／域名并测试；不重复索取这些授权，不越过现有服务／数据保护边界，不把历史成功当实时部署证据。
- **草稿、发布与数据更新**：不完整草稿可保存，试运行/发布按各自依赖完整校验；手动保存拒绝陈旧覆盖，发布绑定精确已保存修订。发布与上下架分开，管理员下架限制不能被作者发布绕过。正式版本逐次1.0、1.1…1.9、1.10递增，不是小数运算；不回滚或复用旧版本。游戏数据保存/发布不需Git推送、服务重启或程序重部署；普通页面刷新发现最新已上架内容。程序更新才走另获授权的既有GitHub→Cloudflare流程，不自行改变部署或放宽技术/依赖约束。
- **隔离试运行**：列表“測試運行”打开新窗口，固定已保存且校验过的草稿快照；可只选完整章节，但必须包含其共享依赖，不能跳过缺失规则数据。只用窗口内存，不读写正式玩家存档、不回写草稿、不发布或通知；新窗口不等于隔离已成立。断网暂停保留内存进度，认证确认失效终止；重新登录须新开试运行，关闭编辑器窗口不等于登出。
- **玩家存档与退出（用户最新更正）**：新版上线，旧版全部作废，不提供旧版续玩或恢复兼容。检测到更新的旧对局停止且禁存，不热换数据。读档确认旧版时提示不能加载并自动清除；新版保存与同游戏旧档清除同事务提交，失败不先删旧档。同版其他槽及其他游戏保留。缺身份、网络错误、损坏、下架或删除不冒充版本更新。仅下架且未更新的对局仍可继续；明确整游戏删除后提示并确认回初始页。新政策实施状态见R2接线末节，历史旧局续玩／单档确认清理约定已撤销。

## 3. 当前Web产品约定

- 玩家游戏界面无关闭按钮、羽扇唯一交互开关、右键逐层退回、子菜单地图锁、地图空白左键无功能，详见[全局约定](../AGENTS.md)和[军师UI技能](../.agents/skills/re-ui-advisor-menu/SKILL.md)。强制多步对话右键无效；普通提示可右键/3秒关闭并执行后继。
- 新游戏及从标题读档后默认展开军师一级菜单、势力信息面板、小地图；军师子项未选中，不额外锁地图/hold；原按钮仍可收起。
- 菜单/模态/场景/战斗/装配/鼠标hold取并集，不改速度模拟暂停。地图鼠标移动即暂停，连续静止1秒释放自己的hold；输入锁与物理区域识别分开。
- 战略五档30/17.5/10/5/1.5625ms，每RAF最多12次完整更新、每步检查hold；战术最多一个完整帧，不补后台债务。战略与表现时钟不能互相代替。
- 据点AI四候选且405D随机低两位0时，选择第4候选、不额外耗RNG；这是用户批准的Web差异CITY-4064-WEB-1，不模拟原版动态外栈读取，也不放宽其它fail-closed边界，见[行军§3.15.6](docs/re-notes-march-pathfinding.md#3156-p394064-外栈读取闭合为永久工程边界)。
- 行军按8×movePeriod插值；城标/军团共用原图块中心(16x+8,16y+8)，不补偿到道路视觉中线，证据见[图块锚点](docs/re-notes-map-marker-anchor.md)。显示段按X优先定向、结束才采用下一方向/驻守帧；绘制不改路线/RNG。六队全骑周期2、其余3的规则不变。接战30ms换帧、60ms发声，每段连续共享接触最多五响；详情见[行军表现](docs/march-presentation-fixes.md)。
- 云雨直接使用原完整八帧PNG，不画渐变云或额外雨丝；独立表现时间100ms换帧、平滑位移，**随战略计时暂停/恢复**：speed<=0或任何hold时位置和雨丝均冻结，后台/场景退出亦冻结。可见慢帧限量推进，不整帧丢弃至永久停动画；细节见[表现合同](docs/presentation-modernization.md)。
- Canvas backing store仅尺寸/DPR变化时重建；地图分段缓存只跳过栅格化，不跳过GameBar布局/消息drain；连续移动或超容量回退直绘。灾害播放器只读原槽/frame，无新时钟或延寿。详见[表现合同](docs/presentation-modernization.md)。
- 列表右侧滚动条、24px表头、墨绿色`#4a7828`选中；排序绑定原对象。
- 自定军师`{custom:true,general_idx:null,name,hao,portrait}`；军师化身排除普通任官/编成/自动出征。统一后留在地图、不播D7END；信赖归零/玩家灭亡仍GAME OVER。
- 系统菜单：保存、读取、音效、战略速度、战术速度、退出。音效TYPE1→2→3→4→关闭调CF9；OFF停BGM，不禁PC/FM效果。战术对白不暂停Session；姓名独占首行，正文仅在DOM移除CR/LF后按宽度折行，原捕获/消息/快照不变。见[对白合同](docs/re-notes-tactical-lifecycle.md#battle-text-reflow-1姓名首行正文自动折行web产品决定)与[战术规则](docs/re-notes-tactical-rules.md)。
- 独立开场原生动画/单次MP3，会话刷新/读档直达终场；具体音乐与弹窗边界见[开场维护源](docs/opening-scene.md)。

## 4. 重要坑点与证据入口

- canonical `OriginalBattleRng`启动RTC播种一次，新局/标题不重播种，读档恢复；禁Math.random兜底。战术回写同一RNG后续战略；输入→A426 VM→A065帧，消息/RNG不能重播。见[战斗技能](../.agents/skills/re-battle-command/SKILL.md)。
- 每更新1据点/16军团，槽动作→日结→03尾→余槽/天气；退场当前槽仍完成尾段。native表唯一持有记录，live/delayed是同对象视图；0B/1E零值、独立03、F14及inactive/未知槽不能被“清理”。generalIdx、slot、leader不可混用。见[行军技能](../.agents/skills/re-march-engagement/SKILL.md)。
- `_march`不能覆盖原0A/0C/0E或消除残值；地址、节点id与字宽区分，CF1不一律无路，未知RAM不补零。工程拒绝不能伪造原版blocked。
- 六队原值及战前BP列表是权威，不合并军团、不用synthetic city替代守军。双方战果先提交再各自474A，失败保前缀；撤退不传送，初值48不等于固定等待48次。见[战后技能](../.agents/skills/re-post-battle/SKILL.md)。
- 战争关系、势力目标、军团命令分开；玩家未完命令优先，委任不能覆盖。消息返回有续段/付款/互俘边界，不假回滚。见[外交技能](../.agents/skills/re-domestic-diplomacy/SKILL.md)、[消息ABI](docs/re-notes-strategic-message-abi.md)。
- 存档恢复须贯穿传递road/movement/terrain/cityCache能力，不能靠重新合成掩盖漏传。JSON会丢undefined、非有限数变null，structuredClone不替代真实JSON往返。地址不等于SAVE偏移，内部十人单位不等于显示人数，MMAP透明用独立mask，索引0可是不透明黑。见[数据技能](../.agents/skills/re-data-formats/SKILL.md)。
- BGM FLAC来自软件OPL3，不是实机录音；无损不保证无缝或低解码内存。部署/版权见[README](README.md)，旧日志不证明再分发许可或远端状态。
- 编辑器后端（Trial/发布/草稿）坑点：`roadgraph`门面在试玩壳恒null，world查询走`scenarioNativeRoadContext`；trial web路由对query 422（唯一白名单`?v=original-sprites-1`）；试玩画布`#cv`初始300×150须等width≥1000；`server/editorapp.js`的POST分发器**无条件分发必自守**（调用方守或自守二选一）；`before.json`风格证据pin有inputs/imports双桶，改同一文件须两桶都换hash；scope内derive/run/audit/postdoc均once-only（EEXIST），重跑前移现场不覆盖。writes 门 pause/release 历史教训：单槽 release 会被重叠 put 冲掉致首 waiter 永挂，fixture 须多 waiter（`gate.releaseAll` 必须挂 gate 对象上，原型方法看不见构造器闭包）；修法沉淀在 `docs/fixture-patches/` 可重放 patch（`.dragon-analysis/` 被忽略，不随 commit 旅行）。
- R2/部署坑点：S3 SigV4 必须保留 canonical query string 这一行（无查询参数时为空行，不能漏行）；桶保持私有、无公开域，凭据只放仓库外 env 文件，绝不入库；`web/kao` 数字档 0..149 连续，`trialassetpaths.js` 硬编码循环与 available-library 指纹绑定，改前先核指纹影响；edit＋`git checkout` 循环会把 worktree 改成 CRLF 而 manifest 期望 LF——转回 LF 解（`git diff` 无内容差为准）。重 lane 502 先看是代理 502（workerd 无响应、DO stub `fetch failed`）还是产品 500（`INTERNAL_ERROR`），前者多为环境/CPU 负载（单 copies-run 可烧 120s），后者才是产品 bug。
- 编辑器后端稳定事实：Trial链路＝工作台选章→`POST /api/games/:id/trials`（issue/commit两阶段）→壳`/api/trial/web/?trial=<uuid>`（cookie Path=/api）→束内`servertrialapp.js` boot；私有资源统一只读＝束＋`trialRegistryBytes`两注册表角色；`trial_assets`派生表结束/fence级联删；两级门（保存门必填、active门全字段＋交叉＋计数，城192/将128锁）；发布pin现仍用草稿revision，**不代表正式序号/公告合同**。
- **E-01冻结schema门（50表/99对象/343列，23源）**：以 `server/deletiondefinitions.js`＋`deletionschema.js`＋`distributiondeclarations.js` 为冻结权威（生成器见上），keys（UNIQUE 索引，含 PK autoindex）数与 `deletionuniquerows.js`／`deletionindexprojections.js`／`deletionvalidatedfreeze.js` 三处字面量一致。重定基流程：补生成器 DDL 覆盖→重跑生成→复制 session 产物（留备份）→逐 lane 改期望计数→重刷 pin→重跑重封存；**不可批量祝福**。计数断言须同时扫逗号形（`tables,50`）与冒号形字面量（`uniqueConstraintsVerified:`），表50／索引49／FK4不能混用。全局分发payload引用未闭合前，非空账本的删除inventory明确拒绝，不只按game_id过滤并假定无其它引用。lane 的 `before.json` pin 有 inputs/imports 双桶，改同一文件须两桶都换 hash；绝不删除 pin 键；lane 自带计数断言刷新前后核对。
- 原证总入口：[AI全链](docs/re-notes-ai-chain.md)、[行军](docs/re-notes-march-pathfinding.md)、[去向](docs/re-notes-legion-fate.md)、[财政](docs/re-notes-ai-fiscal.md)、[外交](docs/re-notes-ai-diplomacy.md)。文档中的旧批次、历史v1说明不代替当前代码及原始证据。

## 5. 常用命令与验证

仓库根执行；先审入口、依赖和I/O，命令清单不是扩大任务/安装/部署授权。

```bash
python -m http.server 8321 --directory web
unset PYTHONOPTIMIZE
export PYTHONDONTWRITEBYTECODE=1 PYTHONUTF8=1
python -B tools/compile_content.py --output /path/to/new-generated  # 需Pillow；不要覆盖共享目录
python -B tools/verify_content_pipeline.py
node tools/verify_content_catalog.mjs
node tools/verify_world_resources.mjs
node tools/verify_start_flow.mjs
node tools/verify_legion_slot_phase.mjs
node tools/verify_legion_slot_battle.mjs
node --test --test-reporter=tap tools/verify_native_formation.mjs
node --test tools/verify_road_field_authority.mjs
python -B tools/verify_map_marker_anchor.py  # 固定非存档原资源，只读锚点/像素布局核验
node tools/verify_weather_presentation.mjs
node tools/verify_disaster_presentation.mjs
node tools/verify_retained_layers.mjs
node tools/verify_render_layers_browser.mjs
node tools/verify_weather_browser.mjs  # 已有Playwright；可指定PLAYWRIGHT_MODULE
node tools/verify_legion_lifecycle_browser.mjs
node --check web/src/main.js
git diff --check
```

- 编辑器后端：`node tools/editor_server.mjs --serve --port 8322`（本地开发后端）；`node tools/editor_server.mjs`（自检，含头像回归＋发布段）；`node tools/start_editor_backend.mjs`驱动的lane用于真实workerd/SQLite/R2；改`web/src`后必重卷Trial束 `node tools/build_trial_web_bundle.mjs`。
- VPS端口本地等价验证（V1切片，`vps/`＋`tools/verify_vps_*.mjs`）：SQLite端口、认证HTTP、文件桶、草稿存盘、任务、头像、Trial、发布包、拓扑意向、正式序号。跑法 `node tools/verify_vps_<name>.mjs`。后继共同应用入口 `verify_vps_editor_server`、文件原子安装故障 `verify_vps_file_bucket`、发布事务故障 `node tools/verify_publish_atomicity.mjs`、作者运行图素材 `node tools/verify_owned_runtime_assets.mjs`、私有固定库清单 `node tools/verify_private_library_manifest.mjs`（内存权限seam，不冒HTTP授权）与当前23源 `node tools/verify_editor_schema_sources.mjs` 见[VPS就绪审计](docs/vps-editor-readiness.md)；Linux耐久性仍须真实Linux验证，不以Windows例外代替。
- 画像库／R2／发布／读取端：`node tools/verify_kao_library.mjs`（621 文件＋manifest 自核）；`node tools/verify_r2_sign.mjs`（签名冻结向量）；`node tools/verify_r2_response_budget.mjs`（实际客户端的进程内HTTPS替身：正文预算／截断／绝对deadline，不连云）；`node tools/verify_publish_to_r2.mjs`（无网络干跑；空目录／读回修补见[接线状态](docs/r2-player-connection.md)）；`node tools/verify_distribution_outbox.mjs`（10 项）；`node tools/verify_distribution_ledger.mjs`／`node tools/verify_distribution_ledger_workerd.mjs`（独立冻结账本Node／workerd；回执seam，不冒共同Root或生产接线）；`node tools/verify_distribution_receipts.mjs`／`node tools/verify_distribution_receipts_workerd.mjs`（独立根／投影读回及最小回执，后者实际自有R2；不冒切根／完整发布）；`node tools/verify_distribution_publisher.mjs`／`node tools/verify_distribution_publisher_workerd.mjs`（独立冻结操作切根／并发／恢复拒绝，后者实际自有R2条件PUT；资源seam，未接权威生产者）；`node tools/verify_distribution_publisher_r2client.mjs`（真实客户端／签名链的进程内HTTPS替身，锁三参数条件写及非404错误，不连真实云）；`node tools/verify_distribution_resources.mjs`／`node tools/verify_distribution_resources_workerd.mjs`（默认publisher的R2运行图读验，静态依赖未配置时拒绝；opaque transport夹具，不冒完整游戏）；`node tools/verify_runtime_contract.mjs`（无网络 transport 负控）；`node tools/verify_runtime_release_namespace.mjs`（候选release独立路径／未提交对象准入负控，非权威事务证明）；`node tools/verify_reader.mjs`（自有 Miniflare/R2，签名固定资源／更新下架／竞态；非完整游戏证明）；`node tools/verify_distribution_schema.mjs`（全新Root实际DDL，不依赖历史fixture）；`node tools/verify_player_announcements.mjs`（14项当前接线／查询拒绝，不是浏览器UI证书）。真桶操作只用 `test/` 前缀并事后删净：`node vps/publish_to_r2.mjs --db <sqlite> --env <envfile> [--prefix test/<id>/] [--game <id>]`、`--drain` 排空原型（不能与`--game`合用；旧版／未上架记录保留pending并拒绝，不冒充新版本确认）。签名资源门与旧局续取已有本地切片；后继可选共同冻结生产者见下列§2.23入口；生产常驻排空／配置、完整恢复、资源闭包与前端接入仍缺，不能直接生产部署；现状见`docs/r2-player-connection.md`，历史发布审阅见`docs/release-v0.1.7.md`。
- 正式存档大序号：`node tools/verify_save_ordinals.mjs`、`node tools/verify_formal_app_browser.mjs`、`node tools/verify_player_restore_browser.mjs --large-ordinal`；同时回归普通恢复、store／snapshot／exchange、正式保存与仓储、编译、公开玩家、内置保存、Trial政策／本地浏览器及静态包／布局。format3仅大序号用规范十进制字符串，小值及CAS不变，详见[R2接线§2.56](docs/r2-player-connection.md#256-正式存档的大序号精确表示save-ordinal-1)。
- 客户端正式版本识别：`node tools/verify_player_release.mjs`（无网络51组）及下列`--release-history`（实际自有R2／workerd加客户端比对）；复验客户端／目录／reader、编译存档链、公开玩家与本地Trial浏览器、静态包／路径一致性。只读识别不是档案校验或清理授权，详见[R2接线§2.55](docs/r2-player-connection.md#255-客户端正式版本识别player-release-client-1)。
- 正式历史元数据：`node tools/verify_first_online.mjs --release-history`、`node tools/verify_frozen_publication_root.mjs`（600秒）；同时回归publisher／receipts双平台、原first-online、reader／冻结reader／公告、实际签名客户端、drainer／site／runtime、公开玩家链及编译存档链。根副本必须结合原回执与历史投影，不发旧版票据、不授权本地清档；旧历史不自动回填，详见[R2接线§2.54](docs/r2-player-connection.md#254-已公开正式版本的只读元数据证明release-history-1)。
- 公开玩家入口：`node tools/verify_publication_chain_browser.mjs --node-service --management-ui --deletion-ui --admin-deletion-ui --player-client --player-app --public-player`（600秒）；使用未替换HTML／boot和原生点击，核实际新局／恢复／退出导航、更新警告、删除确认及本地保档。另跑原App模式、目录／新局／恢复／正式App／内置保存浏览器、开局／空槽／延迟地图／单实例、仓储／编译、静态包／布局／观察器及本地Trial。已去旧标题API和localhost回退；运输仍自有桥，不冒云／物理清理／旧版确认删除，详见[R2接线§2.53](docs/r2-player-connection.md#253-公开玩家启动标题与实际导航player-public-entry-1)。下列各组件命令的“不冒”描述是其独立验证范围，当前组合状态以本项为准。
- 当前版章节预览：`node tools/verify_player_chapters.mjs`、`node tools/verify_player_pack_compiled.mjs --environment --saves --repository --chapters`（600秒）；同时回归原编译模式、client／registry／pack、实际发布到App、隔离静态包／布局及本地Trial。预览票据关闭，选择后重新核当前版准入；不是生产选章界面或可玩认证，详见[R2接线§2.49](docs/r2-player-connection.md#249-当前发布版章节预览与选择后准入player-chapters-1)。
- 正式App启动失败：`node tools/verify_formal_app_browser.mjs`核仓储／缺槽／部分装配失败的退休、原异常保留、伪删除码与禁存；同时跑保存状态复查所列全组、真实发布双模式及本地Trial。新失败场景为完整副本／记录退出端口，不冒生产导航，详见[R2接线§2.48](docs/r2-player-connection.md#248-正式app启动失败的所有权清理formal-start-failure-1)。
- 正式App保存状态复查：`node tools/verify_formal_app_browser.mjs`、下列发布到App联合验证；同时回归内置保存归属、正式／旧仓储与快照备份、Trial政策／实际本地浏览器、战术守卫、宿主、隔离静态包与布局。保存窗口只读复查、写前await后重新守卫，不将网络错误当删除；生产组合已在§2.53显式配置状态／导航端口，详见[R2接线§2.45](docs/r2-player-connection.md#245-正式app保存时状态复查formal-save-status-1)。
- 正式对局宿主：`node tools/verify_player_session_host_browser.mjs`；同时跑实际发布到App／原无App链、正式App／目录浏览器、client／registry、静态包／布局和`verify_player_browser_observation`。真实宿主警告／确认组件不等于生产首页或导航已接好；共享App保存检查接缝见后继§2.45，详见[R2接线§2.44](docs/r2-player-connection.md#244-对局版本提示与确认退出宿主player-session-host-1)。
- 玩家目录／公告视图：`node tools/verify_player_catalog_browser.mjs`（新隔离浏览器，真实reader＋受控目录，IDB零调用）；同时回归client／registry／reader announcements、隔离静态包、模块布局及实际发布到App联合链。DOM组件后继已挂标题（§2.53），本独立测试不授准入或清档，详见[R2接线§2.43](docs/r2-player-connection.md#243-目录与公告视图组件player-catalog-view-1)。
- 浏览器静态图端口：`node tools/verify_player_static.mjs`核固定HTTPS／八图路径、流预算／deadline／迟到取消和静态错误不冒删除；同时跑pack、编译链、两种发布浏览器、正式App、static package、layout／观察负控及本地Trial。联合测试已用产品端口取图，公开boot接线见§2.53；详见[R2接线§2.47](docs/r2-player-connection.md#247-浏览器静态图字节端口player-static-1)。
- 同源玩家站点：根`wrangler.jsonc`经`reader/site.js`把`/play-api`及其子路径交给游戏只读reader，把`/program-assets`及其子路径交给登记程序资源门，其余保留Static Assets；配置文件不含准入秘密，实际云绑定／密钥及生产入口仍须验证。`node tools/verify_player_site.mjs`使用自有Miniflare Assets／R2，另跑reader、workerd客户端／公告、两种发布浏览器链、prepare与runtime合同；最小静态夹具不冒生产打包／部署，详见[R2接线§2.46](docs/r2-player-connection.md#246-同源玩家站点路由player-site-1)。
- 玩家目录／公告客户端：`node tools/verify_player_registry.mjs`、`node tools/verify_reader_announcements.mjs --client`；有效目录与公告错误分离，保留公开历史且不重新准入。后者实际自有workerd两种根协议，客户端在Node运行，不冒标题／公告UI完成；详见[R2接线§2.36](docs/r2-player-connection.md#236-玩家目录与公告读取player-registry-client-1)。
- 共享App保存归属：`node tools/verify_app_save_ownership.mjs`（240秒，新隔离浏览器／原生IDB）；同时回归repository、transition、game store／snapshot／exchange、正式存档及编译链、Trial policy／discard。排队前后身份与已提交但退出的结果分开，未接正式App，详见[R2接线§2.38](docs/r2-player-connection.md#238-共享app保存请求归属app-save-ownership-1)。
- 共享App正式入口：`node tools/verify_formal_app_browser.mjs`（新profile／原生IDB／受信pack接缝）、`node tools/verify_formal_battle_discard.mjs`；同时复验内置保存、正式仓储／编译链、存档和Trial／战术入口，并重卷束后跑`node tools/verify_editor_trial_discard_browser.mjs <owned-scope>`。后继已去掉测试import map并使用普通静态模块路径，仍不冒公开入口挂载、签名准入联合链或删除确认UI，详见[R2接线§2.40](docs/r2-player-connection.md#240-共享app的显式正式入口formal-app-1)。
- 发布准入到App联合验证：`node tools/verify_publication_chain_browser.mjs --node-service --management-ui --deletion-ui --admin-deletion-ui --player-client --player-app`（600秒）；同时跑原无App模式、编译保存仓储、正式App浏览器、流观察负控、隔离静态包与模块布局。实际reader／pack／共享App／自有原生IDB连成一条链，后继已接真实宿主版本警告／删除确认，导航仍为记录端口；不冒公开选择、实际页面导航、生产HTTP或全战役，详见[R2接线§2.42](docs/r2-player-connection.md#242-实际发布准入到共享apppublished-app-chain-1)。
- 玩家静态模块：原六个客户端／适配模块的唯一实现为`web/src/player/`，`reader/`只兼容再导出；新增目录视图也位于该静态目录。`node tools/verify_player_module_layout.mjs`核同一导出身份与字面模块依赖；同时跑正式App浏览器、客户端／环境／存档／编译链、workerd／实际发布浏览器、隔离静态包及重卷后的Trial浏览器。普通静态路径不等于完整动态资源闭包，详见[R2接线§2.41](docs/r2-player-connection.md#241-玩家模块的统一静态路径player-module-layout-1)。
- 正式存档选择视图：`node tools/verify_player_restore_browser.mjs`；同时复验仓储／正式App、实际发布到App、编译存档链、正式存档／store／snapshot／exchange、隔离静态包／布局与本地Trial。先完整预检再生成可选行，点击后重新准入并核所选令牌；实际联合链原生点击恢复，不冒生产标题或旧版确认删除，详见[R2接线§2.52](docs/r2-player-connection.md#252-正式存档选择视图player-restore-view-1)。
- 正式读档捕获：`node tools/verify_player_repository.mjs`、`node tools/verify_formal_app_browser.mjs`；同时复验实际发布App链、编译存档链、正式存档／store／snapshot／exchange、静态包／布局及本地Trial。单次安装已捕获快照，外部替换后的覆盖仍冲突；不冒选档UI或删除许可，详见[R2接线§2.51](docs/r2-player-connection.md#251-正式读档捕获与首次安装player-restore-capture-1)。
- 正式存档App仓储适配：`node tools/verify_player_repository.mjs`、`node tools/verify_player_pack_compiled.mjs --environment --saves --repository`（600秒）；同时回归原编译存档链、正式存档及game store／snapshot／exchange。已观察令牌CAS、不可用行保留及跨窗口冲突，不冒App安装／删除授权，详见[R2接线§2.39](docs/r2-player-connection.md#239-正式存档的app仓储接口player-repository-1)。
- 正式身份存档适配：`node tools/verify_player_saves.mjs`、`node tools/verify_player_pack_compiled.mjs --environment --saves`（600秒）；同时回归game save store／snapshot／exchange和环境／pack／client。只用自有mock IDB，核固定正式身份、公共JSON／detached恢复、CAS及退休时序；不冒App或已识别旧版确认清理，详见[R2接线§2.37](docs/r2-player-connection.md#237-固定准入身份与本地存档适配player-saves-1)。
- 玩家正式环境：`node tools/verify_player_environment.mjs`、`node tools/verify_player_pack_compiled.mjs --environment`（600秒）；复用共享catalog／world／新局装配，原source修订与publication引用分开，含现有装配快照JSON及错正式版本拒绝。仍不是App／IDB／完整存档恢复，详见[R2接线§2.35](docs/r2-player-connection.md#235-正式运行环境与独立发布引用player-environment-1)。
- 玩家固定运行包：`node tools/verify_player_pack.mjs`、`node tools/verify_player_pack_compiled.mjs`（后者600秒；实际20章编译、所选一章／152角色＋八图装配、未修改world道路／地形加载器）。总字节预算显式配置，Blob只在本句柄拥有，不伪造Trial绑定；仍非正式App／存档／全静态旧局闭包，详见[R2接线§2.34](docs/r2-player-connection.md#234-固定运行包与自有资源urlplayer-pack-1)。
- 玩家固定准入客户端：`node tools/verify_player_client.mjs`、`node tools/verify_player_client_workerd.mjs`；同时回归reader、reader announcements和runtime contract。只核内存票据／固定角色取数／明确删除及迟到响应，独立workerd链由Node运行客户端；实际浏览器链加`--player-client`（可与`--node-service --management-ui --deletion-ui --admin-deletion-ui`组合，600秒），另跑`node tools/verify_player_browser_observation.mjs`。完整EOF关联的CDP事件须单独报告并核严格负控，不忽略未完成请求；不冒已接正式游戏引擎或存档，详见[R2接线§2.32](docs/r2-player-connection.md#232-玩家固定准入取数客户端player-client-1)及[§2.33](docs/r2-player-connection.md#233-浏览器客户端与实际编译资源player-client-browser-1)。
- 正式新局选择视图：`node tools/verify_player_new_game_browser.mjs`；同时复验章节／pack、正式App、实际发布浏览器两模式、本地Trial及静态包／布局。新局联合链实际点击章节／势力，仍不是生产boot或恢复／清档界面；详见[R2接线§2.50](docs/r2-player-connection.md#250-正式新局章节势力选择视图player-new-game-view-1)。
- 当前程序入口处理器：`node tools/verify_program_entry.mjs`及`--workerd`，另跑原资源HTTP双平台、站点、reader及清单。按当前Static Assets清单选择受控登记归档的壳，只插入固定程序base；已按[R2§2.68](docs/r2-player-connection.md#268-正式入口挂载与旧页面迟到资源program-entry-mount-1)在本地挂site／Wrangler的正式首页请求，普通首页仍走ASSETS。复用`--program-paths`验证当前程序切换后的旧页面迟到图像／数据／音乐及新页面恢复；另回归站点24组、入口57／57及资源104／104。不冒不同引擎兼容、完整战术或真实部署证明。
- 已登记程序HTTP：`node tools/verify_program_assets.mjs`及`--workerd`，另跑站点、清单／打包、登记／归档／冷读双平台、静态预检／批量、CLI、reader、共同冻结发布及完整包冷读，Linux复验共享解析器与启动链。资源必须同时匹配受控登记、清单与文件摘要；不开放HTML入口，不回退ASSETS，不授游戏历史准入。详见[R2§2.64](docs/r2-player-connection.md#264-已登记程序资源的只读httpprogram-asset-http-1)。四张战术图仅接受现有精确缓存查询后缀，新增负控及双程序字节隔离使HTTP各增至91组；另回归入口双模式／站点／reader／清单，边界见[§2.66](docs/r2-player-connection.md#266-战术图固定查询别名program-sprite-query-1)。后继固定开场片段仅供纯文本，HTTP104／104；公开发布浏览器链加`--program-paths`核程序绑定，§2.67记录初次单程序验证，后继受控软件切换与路由挂载见§2.68；不冒不同引擎兼容或真实云部署。
- 程序归档登记：`node tools/verify_program_registration.mjs`及`--workerd`，另跑CLI、安装／归档／冷读、静态预检／批量／HTTPS、服务／drainer／完整包冷读及Linux进程组。可信记录仅由操作员安装链在整包核验后写入，不能从对象存在或规范JSON推导权限；HTTP资源门后继见§2.64，玩家绑定仍待接线，见[R2§2.63](docs/r2-player-connection.md#263-程序归档的不可变登记program-registration-1)。
- 启动程序归档：`node tools/verify_publication_main.mjs`（当前64组）；同时回归安装检查、归档／归档冷读双平台、静态资源／批量／HTTPS、服务／drainer及完整包冷读，并在非root Linux复验进程／文件／SQLite／HTTP边界。显式CLI建库前必须成功归档独立pin的程序包；不覆盖旧对象，早到信号停止，配置检查仍无I/O。不是程序HTTP／旧局绑定或云部署证明，详见[R2接线§2.62](docs/r2-player-connection.md#262-显式启动链的程序归档static-startup-1)。
- 分发静态批量预检：`node tools/verify_static_batch.mjs`；同时回归原静态资源／清单／HTTPS端口、distribution resources／publisher／runtime stage双平台、CLI／服务／drainer、实际包冷读及共同冻结发布。只在单次分发内扫描整包一次，所有游戏引用仍逐项验证，重试／并发无成功缓存；不能当归档生产接线或旧局保留，详见[R2接线§2.61](docs/r2-player-connection.md#261-单次分发的静态整包批量预检static-batch-1)。
- 固定静态归档冷读：`node tools/verify_static_archive_reader.mjs`及`--workerd`，`node tools/verify_static_release_package.mjs --archive --archive-read`；另回归归档双平台、原清单／预检／打包及实际包原两模式。删除的只有自有临时源／包，以GET-only端口核固定1389资产；未接HTTP或旧局加载器，详见[R2接线§2.58](docs/r2-player-connection.md#258-固定静态归档只读端口与冷读static-archive-read-1)。
- 受信静态包归档：`node tools/verify_static_archive.mjs`及`--workerd`，`node tools/verify_static_release_package.mjs --archive`；同时回归原清单、静态预检、打包及无参数实际包。只写自有条件桶，独立构建／源码pins、完整读回、失败与重试边界；不是运行绑定、旧局读取或云部署，详见[R2接线§2.57](docs/r2-player-connection.md#257-受信静态包不可变归档static-archive-1)。
- 静态部署清单：`node tools/verify_static_release.mjs`（规范清单与固定摘要负控）、`node tools/verify_prepare_deploy.mjs`（自有临时打包器回归）、`node tools/verify_static_release_package.mjs`（实际Git跟踪Web字节加十三个显式玩家模块复制到自有临时包，重复核验；不碰共享`dist/`）。`prepare_deploy`新增`static-release.json`，仅是部署字节／源码树指纹，不冒两端核心、依赖闭包或旧局保留；详见[R2接线§2.8](docs/r2-player-connection.md#28-确定性静态部署清单static-release-1)。
- 静态包字节预检：`node tools/verify_static_resources.mjs`（自有内存端口＋实际运行图校验器接缝）、上述`verify_static_release_package`另经自有文件端口核全部asset（§2.53后为1389项）并测音乐缺失。须有独立构建／源码SHA；未接生产HTTP、未证明核心兼容／依赖闭包／旧局保留，不能据此开放生产静态门。详见[R2接线§2.9](docs/r2-player-connection.md#29-静态包字节预检static-resource-bytes-1)。
- 不切根的预上传：`node tools/verify_runtime_stage.mjs`／`node tools/verify_runtime_stage_workerd.mjs`（内存／实际自有R2条件写及逐对象、全图回读；权限和静态端口为seam，尚未接共同SQL生产者）。不冒正式提交／公开可见或物理删除在途登记，详见[R2接线§2.14](docs/r2-player-connection.md#214-不切根的不可变预上传runtime-stage-1)。
- VPS安装源码检查：`node tools/verify_installed_program.mjs`，并回归显式CLI、服务／drainer、HTTP两模式、静态清单／预检／实际包冷读及私有素材库。启动时核实际源码、Trial束与配置pin，`--check-config`仍只核语法；磁盘测量不是已加载代码或核心兼容证明。素材库旧消费者摘要失败见[R2接线§2.59](docs/r2-player-connection.md#259-vps安装源码与试玩束检查installed-program-1)，后继已按§2.60审差异并采用新registry，不能直接换pin掩盖差异。
- 固定库刷新：`node tools/verify_library_refresh.mjs`及`--workerd`、`node tools/verify_editor_backend_library_policy.mjs`、私有库回归；另跑安装／CLI／服务／drainer／HTTP、静态冷读、冻结发布及公开玩家、Trial policy／规则／discard。`node tools/verify_trial_app_boot.mjs <新整数轮次>`（600秒）使用真实自有workerd＋会话代理和全新Chromium验证服务Trial，无真实存档。新registry必须显式暂存／登记，旧行／对象不自动迁移；同引擎束需重卷。详见[R2接线§2.60](docs/r2-player-connection.md#260-固定库新身份与trial选边修复library-refresh-1)。
- Linux进程边界：在非root Linux、原生Linux临时文件系统、明确Node≥22.13下运行`node tools/verify_vps_linux.mjs`（无参数）；同时复验文件桶、blob/journal、SQLite、安装检查、CLI／服务／HTTP两模式及drainer。只用新建自有临时目录，真实SIGKILL／SIGTERM／SIGINT，不访问生产VPS或用户数据；WSL2执行不是断电／备份／容器／真实部署证书，详见[VPS就绪§4.9](docs/vps-editor-readiness.md#49-后继linux权限真实信号与进程崩溃linux-platform-1)；[§4.10](docs/vps-editor-readiness.md#410-后继linux归档中退出与异步后路径复核linux-archive-1)补归档响应暂停时的真实退出及await后私有路径变化拒启，保留已提交归档，不冒同uid全竞态防御。
- 显式冻结CLI：`node tools/verify_publication_main.mjs`（自有文件库／loopback、真实客户端的进程内HTTPS替身；真实子进程只跑脱敏`--check-config`，信号为模拟事件）。同时回归服务／drainer／HTTP两模式、签名／客户端／资源门／workerd schema；Linux信号、权限和真实部署不能由此认证。配置模板与执行边界见[VPS就绪§4.8](docs/vps-editor-readiness.md#48-后继显式冻结进程入口与配置publication-cli-1)。
- 冻结旧玩家读取面：`node tools/verify_frozen_player_surface.mjs`；另跑Node HTTP默认／`--frozen-publication`、装配生命周期、共同Root两模式、浏览器发布链两模式及workerd schema。冻结gateway与authority分别拒绝旧SQL玩家读取，Node统一配置；私有Trial保持认证。不是新玩家引擎已接入，详见[VPS就绪§4.7](docs/vps-editor-readiness.md#47-后继冻结模式关闭旧玩家读取面frozen-player-surface-1)。
- 冻结HTTP生命周期：`node tools/verify_publication_server.mjs`（真实自有loopback／文件SQLite／默认publisher／实际timer，条件内存R2与合成空投影）；同时回归drainer、冻结构造、HTTP两模式、publisher两平台、资源门及workerd schema。不冒真实游戏发布／生产CLI／TLS云，详见[VPS就绪§4.6](docs/vps-editor-readiness.md#46-后继冻结-http-与分发生命周期装配publication-service-1)。
- 分发循环：`node tools/verify_distribution_drainer.mjs`（受控／实际timer，进程内串行与停机等待；另真实内存SQLite／publisher＋条件内存R2，资源seam）。同时跑publisher、ledger、resources各Node／workerd显式入口；不冒生产常驻或实际浏览器整链挂载，详见[VPS就绪§4.5](docs/vps-editor-readiness.md#45-后继串行分发循环distribution-drainer-1)。
- Node冻结构造选项：`node tools/verify_vps_frozen_service.mjs`（坏配置须在SQL／监听前拒绝）；`node tools/verify_vps_editor_server.mjs`及`--frozen-publication`两模式；下列浏览器发布链另跑`--node-service`（600秒，经真实Node service.fetch但仍非TCP／TLS）。不等于生产CLI／常驻排空已装配，详见[VPS就绪§4.4](docs/vps-editor-readiness.md#44-后继node冻结发布构造选项node-frozen-service-1)。
- 实际本地浏览器发布链：`node tools/verify_publication_chain_browser.mjs`（600秒预算，真实共同gateway／密码登录／文件SQLite／20章编译／预上传／默认publisher／自有workerd R2及reader）。新浏览器通过进程内运输桥访问实际业务，不是API响应夹具；不冒Node TCP／TLS／云、同引擎可玩或物理删除。详见[R2接线§2.26](docs/r2-player-connection.md#226-浏览器与实际本地发布链publication-browser-chain-1)。
- 作者发布追踪UI：`node tools/verify_publish_ui_model.mjs`、`node tools/verify_publication_ui.mjs`及`node tools/verify_publication_ui_browser.mjs`（现有Playwright，全新隔离浏览器，实际共同静态路由／安全头／HTML/client＋受控API响应）；清单显式固定13个公共输入，Node HTTP逐个核client十个模块路由／MIME／字节，防止夹具直供文件掩盖漏路由。另跑共同冻结链、旧Root、Node HTTP／workerd schema。sessionStorage原键恢复不授权服务操作，不把独立UI与后端成绩拼成实际端到端；详见[R2接线§2.25](docs/r2-player-connection.md#225-作者发布追踪与显式重试publication-ui-1)。
- 删除追踪界面：`node tools/verify_deletion_ui.mjs`及`node tools/verify_publication_chain_browser.mjs --node-service --management-ui --deletion-ui`（600秒预算）。核自己游戏的原键／名称／修订、栅栏后只读恢复、真实提交后丢响应与六代确认；另跑原浏览器、管理／作者UI、删除关联双平台、HTTP两模式及50表。管理员跨作者另加`--admin-deletion-ui`，核最小确认预览／原修订／当前管理员／丢响应后恢复，配合共同Root与双平台模型负控；仍不冒物理清理，详见[R2接线§2.30](docs/r2-player-connection.md#230-自己的游戏删除请求追踪deletion-tracking-ui-1)及[§2.31](docs/r2-player-connection.md#231-管理员跨作者删除确认admin-deletion-ui-1)。
- 删除栅栏分发关联：`node tools/verify_deletion_distribution.mjs`／`node tools/verify_deletion_distribution_workerd.mjs`与共同冻结链，核原fenced响应、同事务绑定／回滚、当前主体与栅栏后只读状态；同时跑共同旧Root、管理关联／UI、HTTP两模式及50表。confirmed不授物理删除完成，详见[R2接线§2.29](docs/r2-player-connection.md#229-删除栅栏请求的分发关联deletion-distribution-1)。
- 管理追踪界面：`node tools/verify_management_distribution_ui.mjs`及`node tools/verify_publication_chain_browser.mjs --node-service --management-ui`（600秒，独立管理员浏览器真实登录／上架／下架／解除限制／状态GET，经进程内运输桥，不冒TCP／云）。同时跑原浏览器、作者UI、管理关联双平台、共同冻结链及HTTP两模式／50表；详见[R2接线§2.28](docs/r2-player-connection.md#228-管理员操作追踪与分发状态界面management-distribution-ui-1)。
- 管理员上下架／限制分发关联：`node tools/verify_listing_operations.mjs`／`node tools/verify_listing_operations_workerd.mjs`及`node tools/verify_frozen_publication_root.mjs`核原响应不变、永久关联、no-op、历史确认／当前权限和同事务回滚；同时复验共同Root旧／预上传、浏览器两模式、HTTP／CLI与50表。不是管理员状态UI或删除栅栏关联完成，详见[R2接线§2.27](docs/r2-player-connection.md#227-管理员上下架限制操作的分发关联management-distribution-1)。
- 作者发布状态：`node tools/verify_publish_operations.mjs`、`node tools/verify_distribution_ledger.mjs`／`node tools/verify_distribution_ledger_workerd.mjs`及下列共同冻结链，核永久请求→release／分发UUID、元数据只读、待确认与历史确认区别及当前权限；不冒已上架／当前远端头或UI完成，详见[R2接线§2.24](docs/r2-player-connection.md#224-作者发布操作状态publication-status-1)。
- 可选共同冻结生产者：`node tools/verify_publication_catalog.mjs`、`node tools/verify_publication_producer.mjs`（纯目录／双游戏SQL负控）及`node tools/verify_frozen_publication_root.mjs`（600秒预算，实际共同Request／20章编译／预上传／同事务事件／八代排空／Node reader）。内存R2、实际隔离静态包，不冒真云、浏览器或物理删除；默认装配未启用，详见[R2接线§2.23](docs/r2-player-connection.md#223-可选共同冻结生产者frozen-producer-1)。同时回归原共同Root两模式及publisher／reader／严格50表。
- 共同冻结账本schema：`node tools/verify_distribution_schema_rows.mjs`及`node tools/verify_distribution_schema.mjs --rows`（实际Node／workerd共同Root各16组；严格50表／49索引／4FK、类型与空账本inventory负控）；另跑23源DDL与`verify_vps_sqlite_port`。历史七条删除专用lane不能仅改计数就当通过；详细边界见R2接线§2.17。
- 上架正式身份门：共同Root的`verify_publish_operations_root.mjs`两种模式同时核拒绝预上架草稿、错release／pin／pack身份及同事务回滚。保持正常上架与公告历史，不冒R2可见；详见[R2接线§2.21](docs/r2-player-connection.md#221-上架必须已有正式发布身份listing-publication-1)。后继上架永久幂等用`node tools/verify_listing_operations.mjs`／`node tools/verify_listing_operations_workerd.mjs`及上述Root两模式复验，涵盖旧回执不重新上架、同事务回滚与实例重启；仍非冻结分发生产者，详见[§2.22](docs/r2-player-connection.md#222-管理员上架永久幂等listing-operation-1)。
- 公告历史保留：`node tools/verify_announcements.mjs`、共同发布Root两种模式及`node tools/verify_first_online.mjs`（当前可选版与公开历史分离，重上不改快照／日期，历史通知不授予旧版准入）。不冒完整生产者或前端历史弹窗，见[R2接线§2.20](docs/r2-player-connection.md#220-公开公告历史与当前运行版分离announcement-history-1)。
- 公告实际可见时间：`node tools/verify_first_online.mjs`（实际自有workerd/R2／文件SQLite／默认publisher，服务根时间与持久回执引用、pending／重试／重新上架／错误隔离）。不冒共同生产者或公告历史完整实现，见[R2接线§2.19](docs/r2-player-connection.md#219-服务端可见时间引用first-online-reference-1)。
- 公告读取失败隔离：`node tools/verify_reader_announcements.mjs`（实际自有workerd/R2，坏公告不阻断有效目录、准入或旧局资源；根／投影／核心身份仍拒绝）。与旧reader及冻结联调一起回归；前端错误提示和真实首次上线时间未由此完成，见[R2接线§2.18](docs/r2-player-connection.md#218-公告失败与游戏读取隔离reader-announcement-isolation-1)。
- 冻结根到读取端：`node tools/verify_reader_distribution.mjs`（真实文件SQLite／新publisher默认资源门／自有workerd R2／实际reader；七代和旧票续取，非共同HTTP生产者或完整可玩证明）。同时重跑旧reader／publisher／候选路径，保持旧原型读取但禁止旧writer覆盖v2；详见[R2接线§2.16](docs/r2-player-connection.md#216-冻结根读取与禁止协议降级reader-frozen-root-1)。
- 共同发布预上传接线：`node tools/verify_publish_operations_root.mjs --stage-runtime`（真实共同Request／20章编译／当前权限／SQL、内存R2及实际隔离静态包；重入口需600秒预算）。保持无参数旧流程回归；不是生产S3／持久分发／可见证明，见[R2接线§2.15](docs/r2-player-connection.md#215-共同发布的可配置预上传publish-runtime-root-1)。
- 发布候选身份：`node tools/verify_release_candidates.mjs`（真实SQLite／权限seam）、`node tools/verify_vps_releases.mjs`（旧独立接口）；共同Root与原子性入口还须核预提交副本和提交SQL字节相等。不是R2预上传／可见证明，见[R2接线§2.13](docs/r2-player-connection.md#213-预提交候选版本与快照副本release-candidate-1)。
- HTTP发布永久幂等：`node tools/verify_publish_operations.mjs`（真实SQLite，主体／命名空间seam）、`node tools/verify_publish_operations_root.mjs`（实际共同Request／固定安装／20章编译与并发、末端收据故障）。测试session／完整复制bootstrap不是作者空白新建、登录或R2证明；仍须重跑原子性、DDL、Node HTTP及workerd schema。详见[R2接线§2.11](docs/r2-player-connection.md#211-发布请求永久幂等publish-operation-1)。后继源章节`#`身份／R2字面key验证复用上述Root及runtime contract、reader、distribution resources入口，见[§2.12](docs/r2-player-connection.md#212-源章节身份与r2运输chapter-transport-1)，不以运输通过冒完整游戏准入。
- 静态HTTPS端口：`node tools/verify_static_client.mjs`（实际客户端的进程内HTTPS替身，零socket；含静态全包校验器接缝）。共享接收器改变时同时重跑`verify_r2_response_budget`和发布／回执实际客户端回归；不是TLS握手、生产装配或旧局保留证明。详见[R2接线§2.10](docs/r2-player-connection.md#210-静态https字节端口static-https-1)。
- 证据链scope内：`node <scope>/derive.mjs` → `prepare-guards.mjs` → `run.mjs` → `audit.mjs` → `post-document.mjs`；失败现场移`attemptN-*`保留后重跑，不覆盖。
- 全部变更检查实际diff、支持文件的主动LSP、`lens_diagnostics mode=all`、`git diff --check`。unavailable/inconclusive或空缓存不代表clean；工具自动格式化后核字节漂移。
- 纯文档检查链接、职责/规则一致性及元数据，不跑无关游戏回归。规则/数据/工具跑focused；共享调度/RNG/存档/跨模块状态改变须完整安全回归。UI用新profile核流程及console/page/request错误；保存额外测守卫、往返、事务失败。
- 全量先固定显式入口/依赖/源码及I/O白名单，再串行执行入口；禁止verify_*通配或把历史通过当本轮证明。新测试进入inventory、权限白名单和快照。只能关闭自有监听/profile，不碰真实档案或共享dist。
- 检出字节按 `.gitattributes` 保持：共享ESM通常LF，两个既有CRLF模块、HTML shell和不可变生成资源保留各自明确例外；Trial束／两壳JSON包装使用LF末尾。遇指纹不符先核检出转换与Git原字节，不修改预期摘要来掩盖换行漂移；详见[VPS就绪审计§4.3](docs/vps-editor-readiness.md#43-后继固定库清单与跨平台检出字节private-library-manifest-1)。
- 验证绑定实际SHA，保留失败轮；后续源码漂移先核差异再重验，不拼接成绩。UTF8日志、明确reporter；Windows复杂路径用落盘脚本，检查manifest分隔符；脚本不得覆盖已封存证据根。
- 子进程仅传必要环境白名单，不转储凭据；LF/CRLF warning不等于diff检查失败。原窗口、同引擎往返、首批及完整战役证据分开陈述。

### Jev开发期辅助（非运行时依赖）

- 仅advisory，不是机制证据、测试oracle、审阅替代品或放行门。跨规则/存档状态/时序RNG/UI浏览器/工具测试等多风险域的实际diff，或验证有明显遗漏风险时用`change`；失败经直接诊断仍有多种归因时用`failure`。
- 逆向先取得原始事实；仍有多个调查方向/关键证据缺口时用`reverse-triage`选探针，不让模型计算指令、字宽、公式或判机制。确定性证据已唯一定位、纯文档、明显语法/导入问题无需调用。
- 固定流程：人工最小文字→不联网preview并审最终state→确认无禁发信息及TYPESAFE_API_KEY可用→`--send`。适用范围已有持续授权；缺key/失败/不宜外发则说明，不阻塞权威验证。
- 禁发原版资源、真实存档/profile、凭据、个人信息、私密issue、未审完整日志或大段源码；不得把结果直接用作命令/路径/自动改码输入。
- `node tools/jev_assess.mjs <change|failure|reverse-triage> --input -`，审过后才加`--send`；详见[集成文档](docs/jev-integration.md)。
