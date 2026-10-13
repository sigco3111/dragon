# Checkpoint Journal

> 本文件记录当前主线摘要与有日期的历史批次，不是长期约定或新任务授权。
> 当前小范围审计见 [editor-closeout-audit.md](editor-closeout-audit.md)，后继头像实施／验证见 [editor-portrait-ui-fix.md](editor-portrait-ui-fix.md)；逐批证据见各 `docs/editor-*.md` 维护源，验证清单见 [editor-local-validation.md](editor-local-validation.md)。Trial R17 为旧交接，已落后于后继壳／头像／战术批次，不作当前待办源。
> 当前交接以紧接下方的新块为准；更下方“本轮／未提交／下批”均指各历史批次，不据其重开实施或判断当前工作区。未核实时远端；旧标题曾记 `ebd4d52` 已 push／v0.1.6 已发布，本地 VERSION／标签不支持据此宣称最新发布。

## 本次交接（提交前快照）：PORTRAIT-COMMIT-1 → TRIAL-PORTRAIT-JPEG-1

> 此块记录写交接时的HEAD／未提交状态。用户随后明确要求「提交代码」，本批代码／测试／12文档一并本地提交；提交结果以Git记录为准，不授权push／deploy。下文未提交及权限措辞保交接时效，不代表后续未执行提交。

### 本轮目标与当前状态

- 用户先要求「提交代码，继续」，本次另要求写checkpoint供下一对话续接。已提交前续头像链；随后完成Trial JPEG假头旁路的限定安全修复、兼容验证、文档回流及最终审计。当前没有活动goal，不新增提交／推送／部署授权。
- 本地分支 `dev`，HEAD=`4629ee00e87512062ff77c6854cde837865a78d9`，提交标题 `Fix portrait identity and upload safety across editor and Trial`，59文件；提交后曾干净。未push／deploy／fetch，仓库VERSION仍 `0.1.5`，不宣称实时远端状态。
- 当前工作区为后继四旧源码修改＋两新测试＋12文档（含本日志），尚未提交，暂存区空。保留所有本地改动及ignored证据，不reset／clean。此次请求仅更新日志，不实施下一代码切片或自动再次commit。

### 已完成工作与关键决策

- Trial上传JPEG不再只认魔数并保存原字节：授权／源门后完整有界预检和解码，再按源宽高编码RGBA PNG；坏码流422 `TRIAL_PORTRAIT_JPEG_INVALID`，无原JPEG兜底。DTO／资源行／manifest／serve的MIME、SHA、长度统一取规范输出。
- 新Trial JPEG入口保 **总像素≤16384、单边≤8192、输入≤100KiB、256segments／64scans、原4MiB codec估算**；公共游戏库入口仍严格128×128。不扩大allocation预算，不把工程支持域冒为「源图必须128」产品决定；256×128等超预算JPEG仍拒绝。源矩形保留，未做裁剪／缩放／EXIF方向或规范128输出。
- PNG现有规范化及规范产物100KiB门不变。预检不写资源；commit重新授权／解码，expected字段及manifest在写前核验。公开Root原有外层事务仍负责SQL失败回滚，不自造嵌套事务，也不声称生命周期拒绝均无SQL写入（可合法清资产）。
- vendor、共享PNG适配器、认证／Root协议、Web束／库pin、规则／RNG／原头像byte未改；旧资产不迁移。server-only固定vendor方向已有批准，无需重复索取同一批准。

### 验证与最终收据

| 当前新轮 | 实际结果 | 覆盖边界 |
| --- | --- | --- |
| Trial JPEG attempt2 | 58检查／124 workerd HTTP／84图Pillow全RGBA exact | 28中性真JPEG正例、18拒绝及提交／权限／生命周期；Node与真实SQLite DO，但principal／games／drafts／catalog是stub |
| Trial PNG attempt4 | 66／105 HTTP／33图exact | 假JPEG现拒绝，较旧106少一次commit，不能拼旧绿 |
| 库JPEG／PNG各attempt6 | 91／90 HTTP／56图；54／53 HTTP／30图 | 当前wrapper兼容；彩色精度差异只登记，不认证完整JPEG符合性 |
| 四focused | Trial5组／库17／壳69／静态对等20 | 全部新日志status0；八入口各保存870项执行前字节副本，无超时 |

- 最终只读collector `.dragon-analysis/editor-phase/trial-portrait-jpeg-parent-r1/final-audit.py` AST／主server LSP clean、执行status0；独立postseal复核 **30直接输入pins／12文档pins／9859产物pins EXACT**，636本地链接、表格／Q1..73唯一、无新增乱码／冲突标记、diff检查通过。保全部失败／通过源码副本、原HTTP、完整assets BLOB前后及合成图。
- 父scope `report.json` SHA=`c4cb3be5ece13dae671c44405e4246347341795b46ed21562176188418db9dfa`。报告明确 `fullImageSafetyPassed=false`、`currentSHAPublicAppChainRevalidated=false`。本次日志追加发生在seal之后，故该报告的journal文档pin从此属于追加前历史；不覆写旧报告或冒12个文档仍与当前全部相同，源码／产物证据保原时效。
- 主server六改动代码＋runner七clean、12文档clean；all-server代码为2clean／5inconclusive，collector另probe也有未确认server，不能称全server通过。最后session-all62文件仍既有1blocking／10warnings／106hint-info（startmenu导航、arrival等），GameBar旧扫描上限未解除，不称全仓clean。
- 本次交接只做文档诊断／链接与diff检查，不重跑游戏。前17项真实公开App链用860旧输入，含旧Trial和wrapper；未重跑那24分钟链，不能替本轮当前SHA作Root／R2／App认证。

### 失败尝试与原因

- 提交gate首次inline表格regex被shell转义损坏；改为审过的落盘只读gate后通过，未改生产追绿。新vendor原尾空白用仅对应路径的Git whitespace属性处理，完整源码／许可证字节保留。本次日志校验inline也遇同类转义失败，改逐字符表格／链接检查后重验通过，未放松检查目标或改旧报告。
- Trial JPEG attempt1已走58检查／124 HTTP，但末Pillow误把静态JPEG缺 `n_frames` 当多帧而失败。探针确认JPEG缺该属性、PNG为1；仅在PNG/JPEG格式门内把缺省改为1，仍拒MPO、保全RGBA／尺寸／预算／SHA，再fresh attempt2和全部兼容lane。原失败保留，partial计数不冒整轮通过。
- Jev既有HTTP451地区限制未解除，不重复联网或绕过；不阻塞权威本地验证。没有本切片未解决的测试失败。

### 相关文件与恢复入口

- 生产：`server/trials.js`（当前SHA `4a55c1bee85aeee699be85372f4f15204fa37357725e7d00566a663121b83927`）、`server/portraitjpeg.js`（`77b8cb26adb76c562b8206092de20dac5691a4507d05c2905c9d4993b32e79f9`）。
- 测试：修改 `tools/verify_trial_portrait_upload.mjs`、`tools/verify_trial_portrait_png_safety.mjs`；新增 `tools/verify_trial_portrait_jpeg_safety.mjs`、`tools/fixtures/trial_portrait_jpeg.py`；复用现有Trial fixture／worker。
- 唯一详源：[Trial JPEG安全](editor-trial-portrait-jpeg-safety.md)；入口／I/O：[本地验证](editor-local-validation.md)；范围：[逐项索引](editor-requirements-matrix.md)及[小范围审计](editor-closeout-audit.md)。12文档后继同步已保历史结论与限制。
- 新证据父scope `trial-portrait-jpeg-parent-r1/`、子scope `trial-portrait-jpeg-r1/attempt1/`（失败）与`attempt2/`（通过），均在 `.dragon-analysis/editor-phase/`，不进Git、不覆写。最终collector和report已经完成，不要从旧“报告另核”措辞误开重复轮。

### 阻塞点与下一步

1. **当前限定切片可交付；完整头像合同未完成。** Trial更大JPEG源的资源预算／隔离、服务端裁剪参数及规范128输出仍缺；先读全局／仓库AGENTS、产品§4.3、工程§6和本详源，核对合同再按已授权方向拆最小切片，不直接放大codec预算或添加原字节fallback。
2. 新切片须先登记入口／依赖／I/O，另建scope保失败与当前SHA；独立像素oracle及库固定128／PNG／Trial兼容保持。源码变化后旧收据只作历史，不拼绿。涉及UI才使用全新隔离浏览器；不读DOS `SAVE.DAT`、用户实际profile或存档。
3. 当前SHA公开Trial／Root认证／R2／App链需独立新轮，不能用stub专项代替。完整色彩／格式、硬CPU-RSS／进程隔离、旧不安全资产策略、全部消费者／窗口组合、并发和发布UI仍open；Q37／Q69／Q70／Q71不关闭。
4. GameBar native／SDK502原因UNKNOWN、RuntimeManifest／物理删除及地图扩容原证是独立旧缺口，不借头像批次关闭或升级为本切片停工。下一次提交、push、deploy分别须明确授权；先保存现有未提交后继，不覆盖前续工作。

## 历史主线状态（本地审计基线 dev HEAD=`98f0630`，仓库 VERSION=`0.1.5`）

- **任务一（编辑器）E-05 Trial 服务端线程：批次 1-7e＋8a-8h 全部闭合**。8h 删除级联：`GameDeletionFence.begin()` 同事务级联 trial 行＋资产，链已封存（deletecascade-r1：derive 双向绿→guards 562/269→gate 12/13 真后端→audit 9785→postdoc 9787）。guards **567/272**（multigame-r1 已继任封存）；Q69-(ii)(iii)、round-trip、多游戏 b2 均已链封存；仍不称 Q69/Q70/Q71 闭包完成。
- **用户事项队列**：①统一/胜利终局——✅ 关闭（终局属原版规则不管，编辑器只改地图/据点/道路/人物，规则原样，不做实证）；②战术帧实际验证——✅ 8g 闭合；③删除级联——✅ 8h 闭合；④人物头像上传——✅ 链已封存；浏览器整轮 lane 回归——✅ 全绿封存（browser-regres-r1：pin 换新 guards 564/270→gate 17/0→audit 9843→postdoc 9845；talk 23/11＋talkdirect 23/11＋endview 15/7＋tactical 23/7 真浏览器）；⑤历史推送／发布记载不作实时结论；本地四提交已存在（HEAD 98f0630），相对本地 github/dev ahead 4，本轮未 fetch／commit／push／deploy。
- **Web 产品决定（用户裁决 2026-10-09，非原版机制）**事项④：尺寸不限 128×128（建议值），只保源矩形裁active→64×64，单文件 ≤100K；只收 JPG/PNG；头像资源不绑定 255 槽位（uuid 级 assetId，数量不限）；落盘走 `trial_assets` 派生机制；试运行走 worker（路径 A）。
- **其它 open lane**：E-01 GameBar 图像 native 全图／SDK 502 根因 UNKNOWN；RuntimeManifest／物理删除仍开放；workerd 发布登记、冻结包和匿名玩路由已落地，BOOT-1 已补本机 installed-source 全链，不再列“对等下批”。正式 release 序号／历史保全／公告及玩家版本政策仍缺；城数／将数仍固定域；Q69/Q70/Q71 整体 open。任务二限定地图域已收口。
- **Q70/Q71 战术帧动态浏览器证据（2026-10-13 历史 lane，已纳入 965dc06；不等 HEAD 新回归）**：真实 Chromium 对 lane 后端一次跑通 workbench→trial 窗→宣战（军师进言敌对提案 AL=1 即时接受，张角 0/0）→编成（何進 6000）→canvas 行军令（洛陽→信都，經官渡）→真实交战开战→`session.frame` 推进→offline 冻结→online 恢复→改密终态停战＋战斗关闭，IDB 0、console/page/outside 0。链已封存（derive→guards→run→audit→postdoc）。沿途修三真缺陷（均规则零改动）：①试玩壳自建 world 路图实例（`ai.js`/`gamebar.js` context.roads 优先，`Uncovered original movement Le` 冻泵）；②`closeProposalAudience` 补 drain（宣战 TALK onClose 提交滞留）；③43D3 外交别名走完整 24×24 native 表（`Uncovered diplomacy 2072`）。当轮回归：road 32/0、war 8/8。后继 98f0630 lint 修改 arrival／playpacks 并重卷束；当前 SHA 与此浏览器 lane 不同，提交虽记聚焦再验，未取得 lint 后独立完整链收据，详见小范围审计。
- **历史批次一句话**：8g 战术帧实证修两真缺陷（`commands.js` 门面路图→`scenarioNativeRoadContext`；trial web `?v=` 白名单）→561/268；lint 收口（barrel 本地再导出＋tlog 约定）journal 瘦身 883→90 行；browser-regres-r1 四 lane 全绿→564/270；q69ii 两级门→564/270；q69iii 五点 FF 跳过；round-trip 字节同一性→565/271；multigame b2（发布＋/play＋隔离存档＋冒烟 7 项）→567/272。

## 后继批次 PORTRAIT-UI-FIX-1（本地未提交）

- 用户再次「按建议执行」：修workerd武将节清除绑定空键早退、原JPG/PNG≤100KiB前置门、可调方形裁剪／明确确认、Image及编码异步代次；切游戏／身份变化清预览与自有ObjectURL。生产仅general.txt/index.html，规则／原byte／束／认证未改。
- 当前SHA聚焦：全新Chromium16项（内存API/session夹具，非workerd认证整链）、壳静态69、header库15、对等静态20、自有temp自检、movement32/32、arrival31/31。arrival首30/31失败保留，仅修合成输入写原生矩阵cell，不改期望／规则。
- 当轮同byte不同key缺口后由下述运行时身份批修正；服务端安全解码及完整workerd UI→发布→运行整链仍open；不关闭Q37/Q69/Q70/Q71，不把旧战术20项冒当前整链。详细源码SHA／attempt／检查边界见[唯一维护源](editor-portrait-ui-fix.md)。

## 后继批次 PORTRAIT-IDENTITY-1（本地未提交）

- 用户「继续下一步」：用所属world／捕获章实体idx绑定portraitKey，撤全局byte覆盖；GameBar／HUD／StartMenu／BattleView接对象或原retained speaker.slot，URL缓存和晚图片返回守卫，不改原byte／capture／规则／RNG／认证。
- 当前聚焦：全新Chromium22项（实际模块＋合成pack／内存profile，IDB0、errors/outside空）；policy400角色／10负例及全部20pin、原对白表现、前批UI16项、自有temp自检及语法通过。非真实workerd发布／认证／完整App链。
- 五改src pin升级＋首policy失败实捕旧main pin缺口，核main未改后另纠正，最终六pin；库manifest `4031b32d…`，217文件束 `7da93227…`。资源／20条G127未知登记不变，旧安装须后续显式按新pin重stage，不冒旧链当前绿。
- LSP非全clean（含既有startmenu导航error／warning、push-only及gamebar扫描上限）；Jev返回HTTP451未绕过、不作通过。详细SHA／失败原件／限制见[唯一维护源](editor-portrait-identity.md)；服务端图片安全、完整消费者组合及workerd整链仍open。

## 后继批次 PORTRAIT-WORKERD-1（本地未提交）

- 全新本机workerd／SQLite／R2／两个Chromium context：原stager完整指纹门→真实登录改密／安装／复制→UI裁剪确认上传两图→同byte7的G7/G93分别绑定保存修订3→发布API及匿名资源SHA→在用删拒409→UI清除保存修订4→匿名App继续固定修订3，两图全部RGBA正确。最终attempt11串行14项，21 Node HTTP／385浏览器响应，编辑IDB0、未分类错误／失败请求／outside空。
- 实捕并修壳业务节嵌隐藏admin父容器、模块render破坏菜单视图、列表isBusy未定义／新库按钮忙后未解禁、管理blob预览CSP、匿名共同资源白名单和document-relative base／八季图门。规则／web/src／认证零改；217束与库pin不变，只play壳生成内容变。
- 当轮聚焦壳69／静态对等20／UI16／自有temp自检／重建不变／五文件语法通过。attempt1–10失败／超时原件保留，不追认partial；attempt9并发传输根因UNKNOWN，最终只证串行，不签SDK修复。发布仍API非按钮；服务端图片安全、同时游玩／保存及完整消费者／窗口组合仍open。源码SHA／预算／限制见[唯一维护源](editor-portrait-workerd.md)。

## 后继批次 PORTRAIT-PNG-SAFETY-1（本地未提交）

- 用户「继续」：只补游戏库PNG有界完整解码／RGBA规范重编码，DTO／SQL／SHA均取输出；JPEG仍header-only、Trial原图未处理，不加依赖、不关闭Q37／§6。共享PNG适配器、原byte／规则／认证／Web束／库pin未改，旧资产／包不迁移。
- 当前最终attempt3（消新tool风格提示后同期待再验）：Node与真实workerd SQLite工程夹具一致，54检查／53 HTTP／Pillow30图，含36负例拒绝无头像表写入；头像库16／壳69／静态对等20通过。首次环境Node初始化失败与惰性SQL夹具失败原件保留，只修新父／夹具后新轮验证。
- 不是完整账户／公开worker路由／发布／App新验收，旧14项绑定旧服务SHA，不重跑或拼绿。剩余JPEG／Trial／隔离安全、当前SHA真实整链与完整格式支持；详见[唯一维护源](editor-portrait-png-safety.md)。未commit/push/deploy/fetch或触实档／用户profile。

## 后继调查 PORTRAIT-JPEG-PATH-1（历史：之后已批准vendor方向）

- 用户「继续」：当前Node／自有loopback workerd四项指定图像全局均undefined，仓库未声明Images binding；一次200仅能力观测，不是JPEG解码通过。PNG切片与JPEG／Trial旧行为未改。
- 已核固定候选 `jpeg-js v0.4.4` commit、decoder字节、BSD／Apache许可及一项资源消耗公告；源码仅ignored调查原件，未执行／安装／接生产，不宣称全安全审计。云Images需新binding／生产计费，未调用或开通。
- 推荐经明确批准后仅服务端vendor固定解码源码（无npm运行时安装、不接云服务、不进玩家束）；新增第三方代码仍须范围确认，不能当零依赖豁免。完整有界码流／像素／隔离／真实上传发布验证仍未做；来源、probe与下一门见[唯一维护源](editor-portrait-jpeg-path.md)。无commit/push/deploy/fetch或实档／用户profile操作。

## 后继实现 PORTRAIT-JPEG-CANDIDATE-1（本地未提交）

- 用户明确「同意」仅server固定JPEG源码vendor；保Apache／BSD许可与原件，独立预检及严格熵／restart／run边界适配后，候选attempt3通过才接游戏库。规范输入仍128×128／100KiB，JPEG与PNG新上传均从核验RGBA输出PNG，mime／SQL／SHA取规范字节；同步无新await，不改认证／规则／Web束／库pin，不安装npm或云binding。
- 当前正式库最终attempt5：91检查／90实际workerd HTTP，28正例／56负例／六既有gate，Pillow56输入／输出；PNG新attempt5为54／53 HTTP／Pillow30；库17／壳69／静态对等20通过。工程actor＋真实SQLite不是账户API／R2／发布App；中性／灰度精确，六彩色与Pillow最大差3/43/78只登记不放宽epsilon或宣称Part-2符合性。
- 上游末restart余段越界初失败、之后候选／库各轮收据与源码快照保留。Trial原图／裁剪合同、进程隔离／硬CPU-RSS、完整格式／独立彩色精度、旧资产策略及当前SHA真实整链仍缺，不关闭Q37／§6。详细来源／修改／SHA／限制见[唯一维护源](editor-portrait-jpeg-safety.md)。未commit/push/deploy/fetch或触实档／用户profile。

## 后继验证 PORTRAIT-WORKERD-SAFETY-1（本地未提交）

- 用户「继续」：仅新增测试／文档，不改生产／规则／RNG／Web束／库pin。全新workerd／SQLite／R2及两个Chromium context，由真实账户API／原stager／安装／完整复制准备；原JPEG公开API规范PNG，三坏输入422且资源404；真实UI两PNG裁剪上传／三实体绑定保存修订4、发布API、在用删拒及清除保存5，随后匿名App固定修订4，三个头像全部RGBA正确。
- 新attempt1串行17项、31 Node HTTP／390浏览器响应，status0／1497.19秒；编辑IDB0、未分类console／pageErrors／failedRequests／outside空。库17／壳69／静态对等20及两工具语法通过；860执行前输入及三focused源码另钉。不是发布UI、并发、进程隔离或完整App／消费者认证。
- Trial原图／裁剪合同、完整格式／独立彩色精度、旧资产策略和Q37/Q69/Q70/Q71整体仍open；初LSP等待超时后重probe两代码clean，既有全仓诊断不借本批关闭。详细SHA／隔离／最终审计见[唯一维护源](editor-portrait-workerd-safety.md)，未commit/push/deploy/fetch或触真实档／用户profile。

## 后继批次 TRIAL-PORTRAIT-PNG-1（本地未提交）

- 用户「继续，遇到问题分析原因找到办法解决」：只修Trial PNG魔数假正例为有界完整解码／源矩形RGBA重编码；先比对预检DTO及manifest再写，直调拒绝不留新资源。公开Root外事务原本已有，SQL写失败仍由其回滚，不冒公开API原有部分写入漏洞。
- 512×512合成源3789B规范后686274B，补原100KiB存储预算独立错误码，源尺寸不强制128；后继裁剪仍缺，不能称所有≤100KiB合法源都可上传。JPEG原魔数／原字节保持，假头可过是未修缺口，不算安全正例。
- 最终新attempt3：66项／106实际workerd HTTP／Pillow33图exact，Node与真实SQLite DO一致，但principal／games／drafts／catalog是stub，非Root认证／R2／App。原头像上传五组（含JPEG legacy登记）、库17／壳69／静态对等20新日志通过；六改动代码主动all-server LSP clean。首Worker文本模块类型拒绝失败、预算门前attempt2与最终3均保，未放松来源hash／类型门。
- 868执行前明确输入／源码与产物新钉；仅Trial服务／单测和新测试／文档改动，规则／RNG／原byte／共享PNG适配器／认证／Web束／库pin未改。前批860输入17项公开链含旧Trial源码，不能拼新SHA全绿；JPEG原图／裁剪／隔离／完整格式／旧资产及Q37/Q69/Q70/Q71整体open。详细证据见[唯一维护源](editor-trial-portrait-png-safety.md)，未commit/push/deploy/fetch或触实档／用户profile。

## 后继提交 PORTRAIT-COMMIT-1 与 TRIAL-PORTRAIT-JPEG-1（后继本地改动未提交）

- 用户「提交代码，继续」：前续头像链59文件提交 `4629ee0`，提交后工作区干净；未push/deploy/fetch。只读gate核16source／4075原artifact／868输入及727本地链接／暂存字节；首次inline regex被shell转义破坏，改落盘审过入口通过，不改生产。保vendor与完整许可证原字节，仅路径级Git whitespace属性处理其原尾空白。
- 后继本地Trial JPEG修假头原字节旁路：共用有界预检／解码后源矩形RGBA PNG，固定128库入口仍严格，不扩大原16384 pixels／4MiB codec估算；更大源失败关闭，不冒“源必须128”产品决定。vendor／PNG／规则／RNG／认证／Web束／库pin未改，旧资产未迁移。
- 新attempt2为58检查／124实际workerd HTTP／84中性图Pillow全RGBA exact，28真JPEG正例／18拒绝；Node／SQLite DO但服务端口stub，非Root账户／R2／App。attempt1末Pillow JPEG缺n_frames属性误判失败保，探针确认后仅oracle修再全fresh。当前PNG66／105／33、库JPEG91／90／56、库PNG54／53／30及Trial5组／库17／壳69／parity20新日志通过。
- 每入口870 current输入副本／原HTTP／完整assets BLOB前后保存；旧17真实App所用860含旧Trial／wrapper，不能拼新SHA公开整链。更大JPEG源／裁剪128／隔离／彩色精度／完整格式／旧资产和Q37／69／70／71整体仍缺，详见[唯一维护源](editor-trial-portrait-jpeg-safety.md)。

## 稳定架构事实（Trial 栈，实锤）

- 链路：工作台选章 → POST `/api/games/:id/trials`（issue/commit 两阶段）→ 壳 `/api/trial/web/?trial=<uuid>`（会话 cookie Path=/api）→ 束内 `servertrialapp.js` boot（gate 十字段）→ 战略时钟 hold 并集＋`createTrialBattleFrames` 战术边界。试玩束当前217文件，改 web/src 后必重卷。
- 私有资源：`/api/trial/web/<path>` 统一只读＝束＋`trialRegistryBytes` 两注册表角色；库398资源，当前manifest `4031b32d`（93632字节；后继身份批六程序pin升级，资源/refs不动）；发布 pin 钉修订＋展示名，列表内置恒首项 `卧龙传·制霸天下`，20 条 G127/255 未闭合保持登记。`trial_assets` 派生表：八行（manifest/章 state/六资产）＋上传头像行（`portraits` 清单记 manifest），结束/ fence 级联删。
- 两级门（(ii) 立法）：保存门必填拒存（含草稿）；active 门 15/14/19 全字段＋闭合交叉＋计数（城 192/将 128 dense 锁），draft 记诊断、严格＋试玩拒收。
- 发布玩链（b2／后继 workerd 本机）：POST 发布→GET /play 三段选择（游戏→章→势力，pin 复核）→同引擎 persistent 开＋按游戏隔离 IDB 库；workerd-parity-r1 与 BOOT-1 已补接线及限定链。当前发布 pin 仍用草稿 revision，不代表完整正式版本／公告合同。
- 头像链（事项④）：壳预启动 `mountPortraitUploads` 上传→`POST /api/trials/:id/portraits`→运行按所属world／章实体idx解析portraitKey资源（原byte保留；未命中回落kao）→工作台 `POST /api/general-portrait` 写草稿 `portraitKey`（byte 不动，门禁照验 byte）。
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
- **当时阻塞／排期（历史）**：workerd 对等现已由后继批次完成；不再从此段重开实施或推送。真实剩余见[小范围审计](editor-closeout-audit.md)。

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
- 当轮验证：静态 69（＋4 B4e）＋单测 15＋自检绿＋LSP clean，editor-shell-b4e 当轮封存，后纳入 965dc06。封存只涵盖库/API 链，未完成 Q37：源尺寸不限与规范128输出分开；源大小／裁剪确认、服务端安全解码和同 byte 不同 key 隔离仍缺；清除绑定按钮当时被 `if (!key) return` 阻断（前轮源码审计）；后继UI小闭环已修清除／源限制／裁剪确认／预览守卫，详细范围见[头像UI维护源](editor-portrait-ui-fix.md)，不追认旧B4e为全部UI证据。
