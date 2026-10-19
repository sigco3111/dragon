# Checkpoint Journal

> 本轮接续日志：进展、失败、文件、验证、阻塞与下一步。长期事实／架构／命令／约定见[AGENTS](../AGENTS.md)，机制与产品合同只链接维护源。历史成绩不代替当前验证，待办不自动授权实施。

## 1. 接续状态

- 本轮提交整理以`d04e5fd`（首次受限部署）为基线；用户已明确授权提交此后的编辑器／受限部署改动，未授权push。实际提交身份查Git日志。§9–10为更早性能批次收据。受限服务已在`https://dragon-editor.720108.xyz`上线，连接基线见§11，首次部署见§12；提交后的固定库／私有Trial接续见§13，密码强度调整见§15，当前vps6资源门与巡检接续见§16；不能将未提交代码视为已在GitHub／Cloudflare发布。
- 发布主线仍未就绪：当前版本唯一政策已有局部接线，完整链及生产条件见§6。旧版续玩成绩不能用于当前放行；程序归档固定资源前缀也不授权旧游戏内容续玩。
- §8提速与纯文档整理已随v0.1.8发布；§10修复已进入当前本地HEAD，本轮已核GitHub main和线上静态核心身份，不冒性能／完整发布验收。无实际diff的M标记保留，不批量重写。

## 2. 已关闭批次与历史索引

- UI：单一游戏下拉框／公告及加载期间保留只读姓名字号已交付；现行约定见AGENTS§3与[开场合同](opening-scene.md)。不再复制布局尺寸、截图路径和旧夹具调试流水。
- 旧三倍速／36更新预算、固定接战节拍和五响上限已撤销；`61dbf2f`的原证重构见§5，现行参数见§8。旧阶段参数和测试计数不沿用为现行规则。
- 历史`867f180`构建成功、首页／模块200，但registry为503 `REGISTRY_EMPTY`。录像排查阶段另核到`5e4d6ee`的Workers构建成功，公开Clock模块含新五档／16预算；未测用户实际模块或吞吐，也未重新验证registry，**不是自建游戏可发布／游玩证明**。失败根因是37–41MiB创作源超25MiB静态单文件限制，已排除创作源并保留运行资产；“custom build hook未执行”猜测已撤销。清单差异按Git blob／eol核验，不改预期SHA掩盖。
- 历史云证据在`.dragon-analysis/release-readiness/workers-auto-r1/`；配置与完整排查见[部署指南](deployment.md)、[部署审计](workers-deployment-audit.md)。完整提交沿革查Git／[CHANGELOG](../CHANGELOG.md)，不再维护第二份提交表。

<a id="6-render-layers-1测量脏层灾害播放器及断链整理"></a>
<a id="9-battle-text-reflow-1战术双方对白自动折行"></a>
<a id="10-014发布整理"></a>
<a id="11-015发布整理"></a>

历史引用入口：旧分层渲染、对白折行及0.1.4／0.1.5发布批次的逐项收据不再保留于本页，应查对应Git历史；合同分别见[表现合同](presentation-modernization.md)、[战术生命周期](re-notes-tactical-lifecycle.md)、[CHANGELOG](../CHANGELOG.md)，已知收据缺口见[历史收据说明](historical-receipts.md)。不据索引补造通过记录。

## 3. 历史批次相关文件（本轮部署见§12）

- 提速运行代码仅`web/src/game/clock.js`；生成物`server/public/trialweb.txt`。沿用现有测试：`tools/verify_clock_transition.mjs`、`verify_clock_browser.mjs`、`verify_march_markers_browser.mjs`、`verify_engagement_browser.mjs`、`verify_weather_browser.mjs`（后四项同在`tools/`）。
- 合同同步：`docs/re-notes-strategic-time.md`、`docs/march-presentation-fixes.md`、`docs/re-notes-kernel.md`及AGENTS；父目录`.agents/skills/`下的`re-march-engagement/SKILL.md`与`re-battle-command/SKILL.md`位于Git仓库外。
- 本次记忆整理仅改`AGENTS.md`及`docs/checkpoint-journal.md`；没有新建框架、测试或历史台账。

## 4. 验证与状态边界

- §5是重构批次，§8是随后已随v0.1.8发布的提速批次；各自测试结果不可跨参数替用。§7纯文档整理没有重跑游戏回归；当前性能修复有独立复验，见§10。
- 浏览器验证使用新隔离profile，未访问真实SAVE.DAT／用户存档。原生行军轨迹隔离了城市／日结／外交泵；实际吞吐受负载影响，不证明全设备翻倍、完整自然战役、人耳听感或用户视觉验收。
- 提交成功、云构建成功、生产游戏可用分别取证。保留原始失败／负控记录，不把旧临时日志或缓存诊断当作当前通过证明。

## 5. 当前时钟系统逆向与重构（本地完成）

本节为已收录`61dbf2f`的封存批次；其8更新／480上限已被§8取代。原字节、调用链、实现及完成审计统一见[战略时序](re-notes-strategic-time.md)，此处仅保留接续所需调试结论：

- 已闭合共享Clock→槽轮询／原生道路声音→32槽对象OLD帧／dirty准备→日期季节／音乐；大小地图共用只读行军插值。撤销独立云节拍与固定接战音画，不改战术规则。
- 产品缺陷：异步月结曾提前进入day1；修为月结消息期间保留day0/hour23/sub8，续段真正返回后再推进日期／季节／对象准备，并保持禁存边界。
- 夹具失败：旧速度／余额预期及浮点严格比较需同步；人工跳日受随机外交污染，显式清空夹具事件页；MapView缺城图ready等待；战略FIFO缺world.definition／Response.ok；天气／分层夹具仍用独立时钟。均修正夹具，不绕过资源门、清空云层或放宽规则。
- 道路旧测试曾把实际`roads.json`请求返回为`{}`，报`invalid strategic road graph`；改从`DEFAULT_WORLD.assets.roadGraph`读取并保留断言。它不是提速损坏道路数据。
- 完成联合回归及原证回流后另清理诊断，再提交`61dbf2f`；该批次早期束摘要／未清诊断已非最终状态，详细验证边界见维护源§7，不复制中间收据。

## 6. 发布主线阻塞与下一步

1. **新政策联合复验**：专项检查及后继两条完整本地联合链已通过，范围与失败轮见[R2接线§2.72](r2-player-connection.md#272-当前版本唯一的共同发布联合复验current-publication-1)／§14；资源门已按§16最小覆盖部署并复验，不替代真实游戏云发布及物理清理放行。
2. **物理回收**：全局冻结payload、R2历史对象、在途发布及备份引用尚未完整闭合。删除栅栏／409退休不等于物理删除，非空全局账本inventory仍应拒绝，不能靠game_id过滤绕过。
3. **作者准入／同引擎**：G-INIT未知初始化、剩余编辑器功能及两端兼容待按[需求矩阵](editor-requirements-matrix.md)审计；完整复制或归档SHA不证明任意空白章可玩。
4. **生产装配**：受限编辑器、可信整包归档及两端静态核心身份已核（§12）；正式游戏registry仍为`REGISTRY_EMPTY`。完整生产数据／游戏发布链及旧重lane缺口见[VPS就绪审计](vps-editor-readiness.md)，不得以局部成功冲销。
5. **VPS连接已具备**：SSH、域名HTTPS及R2连接已实测；§11为只读基线，实际受限部署见§12。保护已有`/home/web`，完整发布条件未满足，维护门仅能按相应独立证据分步解除（私有两门见§13），不能以HTTP健康为由移除发布／删除门。
6. **顺序**：提速与记忆整理已交付；§9是历史提交／Release／推送授权，不沿用到本轮。部署授权已独立取得；后续在当前任务范围内推进联合验证、回收／准入缺口及生产审计，服务上线或代码Release不自动解除以上阻塞。

## 7. 本次记忆整理

- AGENTS只保留长期事实、架构、命令、约定和主线缺口；版本号改以`VERSION`为准，删除旧提速政策流水和一次性部署成绩，保留Jev辅助边界。
- 日志删除重复提交表、旧三倍速公式、逐批测试台账、临时截图／性能采样；保留本轮失败修正、相关文件、验证边界和发布阻塞。保留§5／§8锚点，并补历史引用入口；不删除证据文件。
- 本次文档验证：56处出站链接、10处入站锚点及diff检查通过；两文件主动LSP clean，session缓存517文件无error／warning（不是全工作区重扫）。纯文档未跑游戏回归，未提交／推送／部署。

## 8. 用户指定五档提速

- **实现**：严格采用用户指定6.5／5.0／4.8／1.8／1.0ms，不另算统一倍数；每RAF预算8→16，玩家／Trial共用。保留原时基证据常量、规则顺序、RNG、周期2/3、hold、插值及战术速度；现行合同见[战略时序§6](re-notes-strategic-time.md#6-现代实现方案已落实非dos硬件复刻)。
- **失败与修正**：冻结相位测试仍用8步触发旧预算截断，出现`0.25 !== 0`；改用共享上限常量，保留冻结／清债断言。16步可能跨两次自身槽访问，旧“必见全部四相”预期不再适用；改核绘制相位等于当时倒数低两位且动画可见，不补播／延长接战。声音请求序号及周期2/3的5/3次断言不变；天气慢帧也改核共享预算。
- **时钟／规则**：600个60Hz帧最高9600更新；30/60/144Hz预算分别480/960/1000更新/秒。原生道路34＋天气6＋槽phase3／battle5／continuation5共53项通过；Trial边界82检查／8负控，以及导航、表现、接战poll/state、战斗hold、保存守卫、音乐通过。
- **实际浏览器**：既有clock／march-markers／engagement／weather／seasons五入口全部通过。行军7组各160更新，涵盖五档双周期、变速双hold、敌军移除；核逐点可见／无倒退跨段／RNG不变及3个DPR锚点。另核原声音请求、八帧／灾害像素／TALK71/72、季节24像素阶段和月结FIFO；覆盖限制见§4。
- **生成物**：Trial束230项，仅clock条目改变，两壳不变；SHA256=`0078c20d726d722c5ffba20c439c71c136bbb1efd73a0d79f369dc924f013191`，重复构建`unchanged:true`。
- **检查与交付**：6个JS/MJS语法及diff检查通过；变更路径主动LSP无诊断，最终session全量无error／warning（仍有提示级建议）。该轮为本地交付，后续发布授权与复验见§9。

## 9. v0.1.8发布审阅与执行

- 用户明确授权全量审查、完整提交、Release与推送。起始76个M逐项核Git blob：12实际差异、64相同、0未忽略未跟踪；保留产品／测试／程序束／必要文档及既有迁移，排除本地代理、缓存、运行数据和秘密配置，不删除本地证据。
- 最新既有Release为v0.1.7，选择v0.1.8；更新VERSION／README／CHANGELOG并新增[发布审阅](release-v0.1.8.md)，预计完整提交16文件。只推GitHub main与新标签，不推Gitea、不移动历史标签。
- 发布前重跑clock-transition、Trial82检查／8负控、原生道路／天气／槽53项及五个隔离浏览器入口，全部通过；230项程序束逐源码／长度／SHA匹配，重建不变。一次审阅脚本GBK解码失败改为显式UTF-8后通过，未改产品或断言。
- 发布静态核验：6个JS/MJS语法、156处链接／锚点、diff通过；14个支持路径主动LSP clean，session缓存无error／warning。远端执行结果以GitHub Release为准；不重跑历史后端全量，不操作生产桶或用户存档。push可能触发现有自动构建，但线上版本／可用性须另验，发布主线阻塞仍为§6。

## 10. 录像反馈后的战略性能修复

- 用户提供两段原版录像并授权改进代码。量测仅作线索；详细维护源为[战略时序§8–9](re-notes-strategic-time.md#9-完整app绘制热点修复)，不新增固定120ms节拍或音效次数。
- 实改`navigation/pathfinder.js`私有初始地形身份缓存、`ai.js → main.js`完成批次的普通DOM／Canvas帧内合并；消息FIFO／hold保留同步边界，RAF外续段仍立即刷新。未改五档数值、规则／RNG或音频采样。
- 完整回调固定种子对照648更新：8.31s→0.68s，地图689→41次；原生接战夹具89更新：1.21s→0.125s，请求序号25/49/73不变且均被WebAudio接受。两组初末完整内存快照／RNG分别相等。最高档可能快于录像，不称用户听感或线上效果已验收。
- 复用3个现有测试补充缓存隔离／失败重试／只编码一次及真实App帧内合并、帧外刷新的断言；95项原生回归、相关Clock／FIFO／保存／资源专项、Trial82检查／8负控及六个隔离浏览器入口通过。资源ports首次漏轮次而失败，审读后使用新round3输出通过；消息夹具误等DOM HUD超时，按实际Canvas generalCard改正后，同步hold／右键一次返回断言通过；Jev HTTP451未绕过。未新增测试框架或访问用户存档。
- Trial束230项重建，仅三个运行模块改变，两壳未变；摘要及复核材料见维护源§9。临时CPU／A/B脚本、录像与报告均留仓库外capture，不提交。
- 主动LSP已探测6个代码／测试文件：`ai.js`超5000行上限，另2项push-only/silent未确认，3项clean，无报告错误；不将未确认写成clean。6个变更JS/MJS语法、束内230项逐源码／长度／SHA及两壳对比、diff检查通过；26处文档链接／锚点通过，末次两文档及clock浏览器测试主动LSP clean。session缓存532文件仍显示3条仓库外临时剖析脚本的console警告，已标记测试输出误报但工具仍列出；无error，不宣称全工作区clean。提交前另核9个实际变更、6个语法检查及束重建不变；剩余63个M逐项经Git过滤后的blob与HEAD相同，保留不重写，无额外暂存／未忽略未跟踪文件。本节为提交前收据；用户已授权提交／推送，未作线上部署验证。

## 11. 编辑器VPS部署前只读盘点

- **连接**：用户提供`root@166.88.160.23:5522`及本机`E:/Dragon/dartnode.key`。ED25519主机指纹`SHA256:ahYPBa0NV/Tr7X3XjA7rhWGfEpXkG9pZISZm05pb6Hg`经用户在供应商控制台独立核对；连接使用自有临时known_hosts及严格校验，未改全局SSH信任配置。原密钥含字面转义换行，首次认证因invalid format失败；仅在独立临时副本规范化后成功登录，原文件未改，私钥正文未输出，盘点后临时私钥已删除。
- **运行环境**：Debian内核`6.12.90+deb13.1-amd64`、Docker29.6.0／Compose5.1.4；根盘可用约95GiB、内存3.8GiB（可用约2.6GiB）。现有`dragon-editor-probe`仍以uid1000、只读根文件系统运行，宿主仅绑定`127.0.0.1:8787`；容器Node22.23.3。`nginx`与`kejilion-panel`保持运行，未安装软件、重启或替换容器。
- **域名／数据**：本机和VPS分别GET `https://dragon-editor.720108.xyz/`均200；VPS curl TLS校验成功，反代仍指probe，不是编辑器验收。`/srv/dragon-editor`及`data/`归dragon-editor(uid1000)，当前权限0755，data下只见测试`ping`，两层目录盘点未发现编辑器SQLite／真实草稿；不据此推断机上其它位置绝无存量。正式私有数据目录仍须满足0700合同。未发现编辑器专用备份工具／相关timer或目录名；供应商快照及其它自定义备份未核验，不能称恢复已验证。
- **R2只读**：用户指定本机`C:/Users/fczll/.config/dragon-publisher.env`，含说明式Account ID／Access Key ID／Secret Access Key字段，三项非空，可映射给既有签名客户端；额外Token value未使用。凭据未复制到仓库／VPS或输出。对`dragon`桶实际签名GET `control/current.json`为404；限定`kao/`前缀的最多1项LIST成功且有对象，仅证明读取能力，不证明621项完整性或写权限。玩家站`/play-api/v1/registry`再次实测503 `REGISTRY_EMPTY`。未PUT／DELETE、初始化根或迁移数据。
- **余项**：仓库Dockerfile／Compose仍启动旧auth sidecar，需按正式`publication-main.mjs`装配，不能原样上线；仍需§6的新政策联合复验、回收／作者准入审计、两端核心与完整资源及生产备份恢复。域名、SSH、R2凭据不再列为用户未提供；后续若需供应商快照位置或存量迁移信息再精确询问。本批只记录盘点，不冒部署完成。

## 12. 受限编辑器容器部署

- **范围／隔离**：用户在§11后明确批准开始部署。独立项目在`/srv/dragon-editor/publication`；原probe、`data/ping`、panel及其它Nginx站点保留。切换前在`/root/dragon-editor-backups/deploy-20261019T103943Z/`备份原编辑器目录／该域配置，SHA及独立解包后的compose、ping、站点配置逐字节比较通过，不冒真实SQLite恢复。
- **可信程序包**：本地HEAD与GitHub main同为`b4177c8899af1d1eb6f3cf3cc437471a7c8b6c9d`。自有r3构建目录按Git属性重建LF检出，保留binary／-text／显式CRLF，未批量重写工作树。静态清单1390项（1389资产＋控制_headers），SHA=`6b8f190d10347291eaa55cf14550a9a82db229d3d94093fe69e7aa6e0717e594`，与玩家站当前清单逐字节相同；独立源码树SHA=`6d9a8f02cf27475f4d98fdf7f1dfe7bab770ba86a341ec2185d1f4d10459fe74`。安装校验36组核229源码／230束通过。原始应用tar SHA=`ce16a06f95f1e77e114cf10be500f6b9fbb10fc8682bb548db943b6d0a50522a`经传输读回确认；后续部署补丁另留清单，不把基础tar当最终镜像收据。
- **装配／失败修正**：新增完整Dockerfile、专用dockerignore、Compose和Nginx维护片段；固定Node镜像实跑22.23.3，uid1000、只读根、资源限额、宿主loopback8788、数据0700。初版漏共享服务导入的tools适配器，bare CLI正确拒绝；补齐后裸镜像配置检查通过。玩家源HTML返回307、最简Nginx遗漏FLAC MIME均被严格读取器拒绝；改用编辑器域`/deployment-assets/static-v1/<清单SHA>/`的同一可信静态字节及明确MIME，不放宽跳转／SHA／类型门，不改玩家站或其它Nginx域。
- **R2运输缺陷**：小对象首次GET 404的S3 XML超过对象本身预算，触发`R2_RESPONSE_BUDGET`。共享HTTPS端口增加独立HTTP错误信封预算，R2固定64KiB；成功200仍按原对象预算在分配前／逐块检查，只有完整404代表缺失，403／412／500、截断或错误体超限均拒绝。真实R2不可变归档／逐文件读回及程序登记均已完成；1390项清单与独立可信SHA一致，登记字节与对应源码树身份逐字节一致。玩家`/program-assets/<摘要>/src/main.js`实测200且等于本地源码；`control/current.json`仍404，公开registry仍503 `REGISTRY_EMPTY`。未手工初始化`control/current.json`、合成根、放宽条件写或碰kao对象。
- **最终装配收据**：18文件部署覆盖tar SHA=`5f4b03cd998d0b807580e1782b02e4120c401250efabd6367c81d43646a2b7d2`，保留逐文件长度／SHA清单。实际镜像`dragon-editor-publication:20261019-b4177c8-vps2`，ID=`sha256:c15f510f4c5484d1c8477c033a8bc35a4f640710959cebb5c312f104855afdc2`。外置最终Compose SHA=`b48223f3866f0f3b117181afe94042d4890a1d01ea45048b9ec3bb3d7baaab0f`；它修正Node22 fetch不传自定义Host导致的健康403，改用原生HTTP显式Host，不放宽服务Host门。首次切换被healthy断言拦住，随后误对probe运行的浏览器超时未作通过；修正后停服备份／重建，再经真实healthy才切该域upstream至8788，`nginx -t`及reload通过。镜像内旧Compose模板不参与运行；最终收据在VPS项目`deployment-final.json`。
- **来源／库**：固定来源41角色已在私有FileBucket条件写并读回，描述root=`3a563975a09a80e13a45187ceeb962cf0dd8a21ecb957f7c92059fbcf2c6146e`／18835字节；正常管理员UI的来源安装POST已200并查到已登记。CLI严格转交可选操作员描述，不替代目录验证／审批。399项固定库资产保留原SHA字节，修正静态LF检出对三个非核心输入的影响；但5个消费者指纹过期（见[VPS就绪§6](vps-editor-readiness.md#6-受限容器装配与运维边界)），未装配／登记可用库，没有改旧manifest hash自证。Nginx关闭新Trial、库登记、发布、上下架／解除限制和删除入口；公网8项维护门均503／no-store，另10项健康／匿名认证／私有路径检查通过，未接受测试变更。
- **认证／凭据**：两个全新隔离Playwright context经真实HTTPS完成`tianyi`首登强制改密、正常来源登记、退出及新密码重新登录4组，两个预期冷启动401以外零错误，未创建生产测试游戏、打开Trial或访问用户存档。当前管理员凭据仅在本机`C:/Users/fczll/.config/dragon-editor-admin.env`，部署引导配置在`dragon-editor-deployment.env`及VPS外置0600 env；未入Git／镜像／命令参数／日志，未输出密码、R2或请求密钥，不以SQL伪造认证。临时SSH私钥副本已删除，原密钥未改。
- **备份／巡检**：实际执行`backup-publication.sh`在`/root/dragon-editor-backups/publication-20261019T114028Z`完成本项目正常停机、一致备份、SHA／隔离SQLite恢复检查及自动重启；整包重检约4分钟后健康恢复。改密／来源登记后另存同机`publication-online-20261019T114658Z`：原生SQLite online backup、87个不可变对象前后清单稳定，快照SHA=`93eb0ab45967db5d1a8a5744c3587b665fe6822e27d5ed82e2bbd81bc9914a20`；断网隔离解包核对象字节、SQLite完整性／FK、已改密管理员1／来源1／游戏0通过。检查器初次误查不存在的games表，核声明后改为content_games，未改库／schema。不是恢复应用运行、异地灾备或R2根回滚。monitor timer enabled／active，手动触发真实检查成功；仅journal，无外部告警接收端。最终容器healthy、只读非root、loopback端口、数据0700及env0600逐项复核，probe／panel／nginx保留。
- **专项验证边界**：实际VPS固定镜像中非root Linux19组（真实信号／SIGKILL／fsync／SQLite／权限，云运输为替身）、共享冻结HTTP12组、服务18、drainer35、FileBucket12通过；修改后的CLI90、真实签名R2客户端13、静态客户端31／59请求通过；本地同三项及R2预算28、归档34通过。这些专项仅用独立临时数据／虚拟云端口；真实云／UI／备份另如上取证，不称完整发布浏览器链、断电、异地恢复或完整战役通过。
- **最终检查／交付**：实际diff与5份变更JS/MJS语法、44处文档链接／锚点、7份Linux运维文件LF、17个候选文件秘密值扫描及远端／本地外置Compose SHA一致均通过，无暂存内容。主动LSP共17路径：两文档＋Compose共3 clean，5份JS/MJS＋两shell共7项push-only／silent无法确认，另7项格式未配置LSP；零报告诊断不冒全部clean。另以实际Docker build、Compose config、nginx -t、sh -n及systemd-analyze verify覆盖相关配置。末次session mode=all在17文件无warning（缓存范围，非全仓重扫）；文档链接检查初次GBK解码失败，显式UTF-8后通过。受限编辑器已上线并完成上述生产冒烟，完整发布阻塞仍为§6；不能移除维护门或声称完整编辑／试玩／发布已就绪。没有提交／推送。

## 13. 固定库刷新与私有Trial接续

- **授权／范围**：用户要求先提交已有部署，再继续做完整可用编辑器；首次部署已提交`d04e5fd`，未push。本批只推进可独立核验的固定库与私有工作台／Trial，完整发布、上下架、解除限制及删除维护门仍保留。没有改Web引擎、230项束、静态核心、DOS机制或生产游戏数据。
- **维护源／本地证据**：五项消费者逐字节历史／资源依赖审计、新清单及历史保留、不可变旧登记回归、真实工作台与Trial的详细范围统一见[R2§2.71](r2-player-connection.md#271-固定素材库消费者刷新及私有工作台library-refresh-2)。本批新库`approved-available-library-f4ba804b-1`／93632字节SHA=`f4ba804b84b326ff2d569980127f52d3f6df92ab623d740ad3ab21945840615b`，只刷新五个programHashes，400角色／20消费者全匹配；20个画像255缺口不冒Q69闭合。Node／workerd刷新各8组、策略400角色／11负控、同引擎Trial22项、登记UI127的11组及素材UI126的10组均通过。后者约1314秒，之前123–125超时不算通过；所有新profile无用户存档／外网／意外错误。
- **生产阶段一**：三文件固定库覆盖tar SHA=`836595b1fdf8407870ad4b6a1355a648b325b404f8f8dd38759a6aae85692ff5`经远端逐文件核验，构建vps3镜像ID=`sha256:91be307245f09cd8c28e361eeeaf20712ca8e62a45b948af00ffc73eff6d53ce`。操作员在私有FileBucket条件写／全量读回新400角色，只装配严格描述，不伪造SQL批准。停本项目后`publication-20261019T121545Z`同机备份／独立SQLite恢复通过，切vps3并完成严格整包重检、健康及monitor检查；两项私有维护门当时仍关闭。
- **生产阶段二**：发现并修正两份工作台更旧的`76cdf28`身份及native unload调用confirm的错误，普通手动确认／原键关联保留。五个服务端UI文件覆盖tar SHA=`3d51a4836339b9fc2085ffa1ba44748b86785d1ef1bf05a7a87fd3c96315c724`，逐文件校验后构建vps4镜像ID=`sha256:3242092b3b0c67b025bfe7fb8121602cb715f3c33be1ad0dbf3fa392ec8f3af2`。裸镜像配置、安装36组／同一源码树、400固定角色／20消费者均通过；第一次测试漏临时tmpfs而EROFS，补显式隔离tmpfs后重跑通过，不是产品目录放宽。再次停机一致备份`publication-20261019T133609Z`／独立SQLite恢复通过，已启vps4严格归档重检。仅该编辑器域临时503／no-store维护，保留原站点配置；首次维护插入因原花括号换行不符被断言拒绝，未写坏配置，按实际结构定点修改并经nginx -t才reload。完整预检后容器healthy／初始化已完成、monitor成功。依次只解除库安装门，经全新隔离Chromium和真实HTTPS正常`tianyi`登录、显式GET核独立root、确认安装POST／读回200、原41来源仍登记且游戏0、正常退出，3组通过，预期冷401之外零错误；未改密／伪造SQL或创建生产测试游戏。随后才解除新私有Trial门，保留发布／上下架／限制解除／删除门，nginx -t／reload通过；公网首页200、两私有API匿名POST均401（非维护503），四项发布／管理／删除POST仍503。新配置SHA=`e7a99b1939be24af153e77c64e2d3eec7e028ca758653c8ea1ef21c00749a80a`，远端收据`deployment-private-library.json`。生产Trial未创建／执行：真实引擎运行证据为上述自有Trial22项，不能将两项门解除冒作完整作者／发布功能已验收。

## 14. 当前政策联合发布复验

- 详细维护源：[R2§2.72](r2-player-connection.md#272-当前版本唯一的共同发布联合复验current-publication-1)。修正历史测试续旧版预期时，实际默认publisher暴露仍拒绝共同投影的currentRelease字段；已补严格格式／一致性检查，不绕过默认门、不改引擎／存档协议／Trial束。
- Node及自有workerd的资源门各45组通过。记录导航端口的共享App链与未改生产boot／两软件归档的公开App链都完成：各11主组、6客户端组、App分别8／13组、20章／六根／六确认、outbound=0。新版本旧票409、旧局禁存／退休、空槽新版保存原子清旧、同版下架续玩、删除410及明确确认均已实际覆盖；失败轮r1–r4未算通过。
- 收据分别为`.dragon-analysis/release-readiness/publication-chain-browser-i7633d`和`publication-chain-browser-ufpqGC`；对应日志`published-app-current-only-r1.log`／`public-player-current-only-r6.log`保存在本轮editor-completion目录。两条仍为进程内运输桥，不冒实际云／生产发布或物理删除。
- 本批结束时生产仍是§13的vps4镜像与已开放私有库／Trial，发布／管理／删除维护门保留；本批当时没有上传资源门修复／重启VPS或写生产根，后继部署另见§16。物理清理的非空全局账本、在途／legacy写、R2历史及全部备份引用仍须先闭合；不能仅按game_id删旧payload或改永久链摘要。异地备份／外部告警、作者准入／完整资源闭包也未完成。本批没有新增commit／push。
- **收尾核查**：12份JS/MJS及5份服务端Text模块语法、400角色／20消费者／11负控、diff空白检查通过；29个实际变更／新增文件逐值比对7项私密值无命中，638本地链接目标／39锚点通过。主动LSP查21路径：4 clean、16 findings、1 push-only未确认，零error；AGENTS的跨工作区文档／README解析有9条warning，实际目标均存在，其余为保留括号提示／历史标识typos，不称全clean；session mode=all已查42个会话文件，仍9 warning。最终远端vps4 healthy／只读uid1000、env0600／data0700、monitor timer active、nginx -t及公网首页／health 200；四项发布／管理／删除门保持503，签名只读查询生产current根仍404。原probe／nginx／panel继续运行；临时规范化SSH私钥副本已删除，原私钥未改。尚未完成项见上，不把局部验收写成完整编辑器可用。

## 15. 密码强度调整与线上同步

- **用户决定／实现**：初始及新密码从至少16改为至少9、最多128个字符，必须含大写字母、小写字母、数字与符号，空白不算符号。共享后端、页面minlength／提示／422错误、本地初始化一致；详细规则见[认证合同](editor-backend-auth.md#已实现的账户api边界)。不更改scrypt、会话或原密码登录验证，不重设现有账户。测试中原纯十六进制密码夹具补四类字符，未改请求密钥／令牌或弱化断言。
- **本地验证**：纯策略／KDF17组（9／128边界、四类缺项、Unicode标点／符号、NUL／孤立代理、历史密码哈希兼容）；真实Node认证25项、单用户7项、共享编辑器HTTP12组通过。真实workerd／SQLite／HTTPS账户浏览器六组通过，新增minlength9、缺大写422／页面提示和恰好9位成功改密；仍保留旧session撤销、账户权限／CAS、重设与持久重启检查。该机8787监听EACCES的r1未通过；r2已到9位改密但旧测试未主动选择账户菜单而超时；只修测试菜单操作并允许自有测试端口，r3在55787成功，未改产品导航／网络门。证据目录`.dragon-analysis/password-policy-20261019/`；没有访问用户存档。90份相关JS/MJS／Text模块语法及diff检查通过；机械夹具更新没有重跑全部重型编辑器／游戏lane。
- **生产替换**：只将`security.js`、`public/index.html`、`public/client.txt`覆盖到既有vps4应用，未夹带§14当时尚未部署的发布资源门或其它本地代码（资源门后继见§16）。覆盖包SHA=`cc7d8d47f91aab94732bb6894dc7cea65840ccbf62ab94d8086d5f20e44f2cb7`。先构建并隔离检验新镜像，再仅对编辑器根入口临时维护、正常停止本项目；备份`/root/dragon-editor-backups/publication-20261019T151346Z`的SHA／独立SQLite恢复检查通过。新镜像`dragon-editor-publication:20261019-password9-vps5`，ID=`sha256:b1b5308513202594d4ede3eda97c38f98dd6aaf176fbb67f4e521cd58569ecf4`；完成原严格整包预检后恢复原站点配置，SHA仍`e7a99b1939be24af153e77c64e2d3eec7e028ca758653c8ea1ef21c00749a80a`。容器healthy、uid1000／只读根、env0600／data0700、monitor active；probe／nginx／panel保持运行。
- **真实HTTPS冒烟**：全新隔离Chromium检查线上9位／四类提示、原管理员正常登录、缺大写新密码422及准确页面提示、原会话仍有效与正常登出，四组通过；只有明确冷session401／非法新密码422，意外错误0。不提交有效生产新密码、不重设账户、不创建游戏／Trial／存档，不输出凭据。首页／health200，发布／下架／删除门仍503，完整发布未放行。本批没有commit／push。
- **收尾检查**：110个实际变更／新增文件逐值比对6项私密值无命中，三份变更文档的本地链接目标及最终diff检查通过。主动LSP已覆盖92路径并补查8个重点路径：报告无error，部分push-only／超时不能确认clean，Text／env两种格式无LSP；最终session mode=all为116文件／36 warning（既有测试console输出／嵌套三元及工作区外Markdown链接），不冒全仓clean。新策略测试新增console警告已改用stdout并复验；语法、实际Node／workerd／浏览器与生产Docker另如上取证。临时规范化SSH私钥已删除，原私钥未改。

## 16. 当前版本资源门部署与只读巡检补强

- **范围**：用户要求继续未完成的受限部署。只将§14已验证的`vps/distribution-resources.mjs`覆盖既有vps5应用；不上传整个工作树、不改Web／Trial束／核心摘要，不解除发布／管理／删除维护门。既有密码9位四类政策、固定来源／库及私有Trial入口保留；没有创建生产测试游戏或执行物理删除。
- **巡检修复**：原shell只看最近一条事件，可能由后续事件遮住同次运行的fault；starting也无时间上限。改为宿主stdlib Python只读端口，按当前容器StartedAt取日志、解析白名单事件；同次blocked／faulted／startup-failed／shutdown-failed一律报警，后续idle／confirmed／stopped不能抵消。preflight只容许Compose同一30分钟界限；日志超预算／未知或损坏事件／缺started、OOM及健康异常均拒绝。健康只访问loopback、显式Host、禁止环境代理／重定向，核状态、JSON类型及service／stage／initialized；输出只有固定分类，不打印原始异常、日志或凭据，不重启／解锁／改库。完整运维边界见[VPS§6](vps-editor-readiness.md#6-受限容器装配与运维边界)。
- **专项测试**：资源门Node／自有workerd各45组、drainer35组通过；新镜像在断网、只读、uid1000、无生产数据／env挂载的Docker内再跑45组通过。巡检最终13项纯fake-port测试在Windows及VPS原生Python均通过，覆盖30分钟边界、所有故障遮盖、损坏／重复JSON事件、stderr、观察预算、时间／容器异常、HTTP内容／跳转／代理及异常脱敏；另在真实当前容器和systemd服务上成功。测试不发送真实故障／停机信号，不冒掉电或真实故障注入。
- **构建／切换**：运行覆盖包SHA=`885cbabd40b65c06fe32e91ddcbd45c1a45c8329d6d28761718359327e5a7492`，只含资源门及两份宿主巡检文件；后续严格坏JSON补验包SHA=`079d9e1763e5754c9d413aabafdeea2b5f299ccfd0b02480cbe54dd50ffa7245`，仅更新宿主Python及自有测试，不重建应用。新镜像`dragon-editor-publication:20261019-current-only-vps6`，ID=`sha256:69b723d4b55f0c8a2245aef4ac207a0a79a78dafdae99cdb51715d1f202f5fc3`。先构建／隔离验证，再仅编辑器临时维护、正常停本项目；同机一致备份`/root/dragon-editor-backups/publication-20261019T153944Z`的SHA及独立SQLite恢复完整性通过。只更新外置镜像tag；整包归档／读回预检约4分钟后健康，原站点配置精确恢复，SHA仍`e7a99b1939be24af153e77c64e2d3eec7e028ca758653c8ea1ef21c00749a80a`，nginx -t／reload通过。旧镜像及源码覆盖前副本保留，不回滚SQL或R2。
- **实际复验**：镜像内资源门SHA=`624f12b8a938c1c6502f07b9eb6c23bf9096194db40bc2b98096267f6f6e1511`，最终宿主PythonSHA=`da621f300e7b706199fd6ebd83fd8494dbea5db11bf9ed70549a06ce1c119622`；容器healthy／uid1000／只读、env0600／data0700、monitor timer active且oneshot Result=success／exit0，probe／nginx／panel均保持运行。新隔离Chromium经真实HTTPS重跑§15四组认证冒烟，未有效改密／写游戏／访问IDB，意外错误0。另九路径检查：首页／health200、五项发布／管理／删除POST503且no-store、两私有API匿名JSON POST401；首次漏JSON Content-Type的检查正确得到415，只修测试请求、不改产品门。真实签名GET生产`control/current.json`仍404，没有初始化根。
- **产物／限制**：证据在`.dragon-analysis/publication-vps6-20261019/`，含两次巡检测试、Node／workerd／Docker、构建／切换、实际HTTPS／systemd及SHA收据。外部告警接收端和异地备份仍未配置；非空全局冻结payload的检查点／完整引用、在途写屏障、旧R2和全部备份清理仍未实施，不能按game_id改写永久链或将deleteAllowed改成true。作者G-INIT和完整资源／兼容审计仍未闭合；本批不能称完整编辑器／发布完成，也没有commit／push。
- **交付检查**：shell／两Python语法、diff空白检查、130个相对文档目标通过；113个实际变更／新增文件逐值核6项敏感值无命中。主动LSP覆盖7个相关路径：2 clean、3 findings（旧SHA的typos信息）、2 push-only未确认，无error；Python补探两项超时，不能称全部clean。最终session mode=all覆盖118会话文件无error，仍有既有warning；新增固定loopback HTTP被路径遍历规则误报，已按确切来源／测试标记false-positive，未加忽略注释或放宽端口。临时规范化SSH私钥已删除并确认两处历史副本均不存在，原私钥未改；凭据和诊断缓存未入Git。

## 17. 编辑器与受限部署提交整理

- 用户本轮明确要求提交代码，不包含推送。范围为§13–16的固定库刷新／工作台离开处理、当前版本唯一资源门与回归、9位四类密码政策及夹具同步、VPS只读巡检和相应合同／收据；保持完整发布仍未就绪的结论，不发Release、不改VERSION或再部署。
- 提交候选113个实际变更／新增文件均固定本次字节SHA；其余仅换行／Git缓存造成的M标记保留，不批量重写或纳入提交。旧固定库清单、新密码策略回归和两份巡检Python为正式新增文件；凭据、临时SSH副本、缓存、截图与验证产物均排除。
- 提交前串行重跑八个Node入口（密码策略、认证、单用户、共享HTTP、固定库策略、资源门Node／workerd、drainer）及巡检13项，全部通过；证据在`.dragon-analysis/commit-editor-vps6-20261019/`。重型联合浏览器与生产切换沿用§13–16已完成的独立证据，本次不重复操作生产账户／数据；提交不等于GitHub／Cloudflare已更新或维护门解除。
