# Checkpoint Journal

> 本轮接续日志：进展、失败、文件、验证、阻塞与下一步。长期事实／架构／命令／约定见[AGENTS](../AGENTS.md)，机制与产品合同只链接维护源。历史成绩不代替当前验证，待办不自动授权实施。

## 1. 接续状态

- 当前本地HEAD为`b4177c8`（战略绘制性能修复）；§9–10保留对应发布前／提交前收据，不能当作本轮远端核验。用户已批准编辑器VPS部署；受限服务已在`https://dragon-editor.720108.xyz`上线，连接基线见§11，实际验证和未开放功能见§12。本轮未commit／push，不沿用旧批次推送授权。
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

1. **新政策联合复验**：专项旧凭据／宿主／保存检查已有通过，完整发布浏览器链仍有旧续玩预期；按当前版本唯一合同定点修正再复验，见[R2接线§2.69–2.70](r2-player-connection.md)。
2. **物理回收**：全局冻结payload、R2历史对象、在途发布及备份引用尚未完整闭合。删除栅栏／409退休不等于物理删除，非空全局账本inventory仍应拒绝，不能靠game_id过滤绕过。
3. **作者准入／同引擎**：G-INIT未知初始化、剩余编辑器功能及两端兼容待按[需求矩阵](editor-requirements-matrix.md)审计；完整复制或归档SHA不证明任意空白章可玩。
4. **生产装配**：受限编辑器、可信整包归档及两端静态核心身份已核（§12）；正式游戏registry仍为`REGISTRY_EMPTY`。完整生产数据／游戏发布链及旧重lane缺口见[VPS就绪审计](vps-editor-readiness.md)，不得以局部成功冲销。
5. **VPS连接已具备**：SSH、域名HTTPS及R2连接已实测；§11为只读基线，实际受限部署见§12。保护已有`/home/web`，完整发布条件未满足，Trial／发布等部署维护门不能以HTTP健康为由移除。
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
