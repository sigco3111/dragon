# Checkpoint Journal

> 本文件只记**当前状态、主线进度、阻塞与下一步**，供下一对话接续。长期事实/架构/命令/约定/坑点在 [`AGENTS.md`](../AGENTS.md)（含[编辑器开发待办](editor-dev-todo.md)）；机制原证在 `.agents/skills/*/SKILL.md` 与 `docs/re-notes-*.md`。历史逐轮细节（round 号、pin 计数、失败现场文件）只留 `.dragon-analysis/`（被忽略）与 Git 历史，本文件不复制。
> 发布整理基点 `dev@4a68861`；本批版本 `0.1.7`。用户已授权完整提交、合并main、推送GitHub和创建Release；Gitea不在目标内。GitHub已有v0.1.6，故不覆盖旧标签。最终提交／推送状态以Git和Release实际结果为准。

## 发布就绪与VPS共同应用（VPS-EDITOR-READY-1，进行中）

- 用户已授权补齐发布条件后提交／推送GitHub main，循环监测并修复Cloudflare部署至成功，再部署约定VPS／域名并测试；无需重复审批。当前尚未具备整链发布条件，未执行新的commit/push/deploy。
- 提取共同editorapp，workerd保原DO基类，Node HTTP实际复用业务／鉴权；修同步事务async／BEGIN失败深度、文件桶原子无覆盖安装和arrayBuffer接口。固定库清单恢复Git同字节并加`-text`，不放宽SHA门。DDL仅换入口源文件，47表／94对象／318列冻结门未变。
- 显式六入口全通过：22源DDL审计、文件桶12组、真实blob/journal16项、SQLite18项、HTTP11组、实际workerd schema。源码pins稳定，Windows非Linux耐久性证明；详细失败／边界／证据见[VPS就绪审计](vps-editor-readiness.md)。
- 后继PUBLISH-ATOMIC-1已将pack准备移出SQL写、安装纳入发号／pin／Outbox共同事务；10组真实SQLite故障／捕获负例通过，并完整重跑当前DDL、HTTP11组和workerd schema。不是完整HTTP发布证明；详细维护源同上。
- OWNED-RUNTIME-1已为发布／Trial接所属当前草稿的9角色地图素材读取，保留管理员安装／全源／原版复制门。最终r5九入口全通过：621画像逐SHA、reader25组、原子性10组、真实安装编译后的作者发布25项／Trial20项、IDOR9项、DDL、HTTP11组、workerd schema。修旧fixture620计数与非法ID422/404混淆，失败日志保留；非浏览器或真实云证明。
- TEMPLATE-PORTRAIT-1已修R2画像p模板角色兼容：原始621PNG／清单核对、合同48项、publisher29项、Outbox10项、reader58项五入口全通过；模板缺失／损坏不切根，不允许未声明角色或泛key。详细证据见[R2接线维护源](r2-player-connection.md)，非完整游戏／浏览器证明。
- PRIVATE-LIBRARY-MANIFEST-1仅以固定policy长度替代错误93530常量，仍核原SHA并保admin／owner门。私有库14组＋DDL＋真实HTTP11组＋workerd schema四入口通过。另经SHA与HEAD先验核对修76处纯检出换行，20消费者和217项束一致；束／两壳等于已发布Git字节，重复生成unchanged，不重定清单／资源摘要。失败轮与格式诊断保留，详见就绪审计§4.3；先前scope的不同原始检出SHA不冒当前证据。
- RUNTIME-RELEASE-NAMESPACE-1为预上传增加releaseId独立路径，避免失败候选占住同序号的manifest／章节；未提交对象不准入，旧票继续固定原release。六入口完整通过：路径15＋原始621画像＋合同48＋publisher29＋Outbox10＋实际workerd reader58；原3个路径冲突与测试前缀适配失败现场保留。详细源为R2接线§2.1／§3；尚未接候选预留、持久payload或权威幂等，不冒整链完成。
- RUNTIME-CANONICAL-1固定索引角色映射次序，解决相同行在准备数组／SQL游标中因枚举顺序不同而产生不同SHA。仅索引映射排序，不改章节顺序或原字节；原实现失败现场保留，修后完整六入口49／15／621画像／29／10／58通过。详细证据仍在R2接线§2.1／§3；不是持久payload完成。
- FROZEN-LEDGER-1独立组件固定操作身份／全局代次／分块payload／有序确认与恢复锁；Node29组、实际workerd同28组及实例重启通过，故障注入验证外层事务共同回滚。回执只是测试能力seam，3表25列1FK未注册到共同Root；现行47表冻结不改。真实R2回执、权威生产者和schema接线仍待完成，详细源R2接线§2.3；不冒整链就绪。
- DISTRIBUTION-RECEIPTS-1增加独立R2根／投影读回、服务端时间和不可变最小回执，再向账本发品牌确认能力；响应丢失可重建验证器后核持久回执恢复。内存R2与实际自有workerd R2各23组、账本29组通过；不切根、不验证全依赖，尚未接生产者／远端领先恢复守卫／共同Root，47表冻结不改。详细源R2接线§2.4。
- DISTRIBUTION-PUBLISHER-1独立冻结操作已接条件切根、前代持久回执、未知响应恢复及远端旧／异／领先／回退守卫；并发旧观察重试，不误设永久锁。后继真实客户端回归复现四／三参数不匹配并修ETag调用，GET412不冒缺失；最终九入口8／7／29／30／30／23／23／29／28及workerd实例重启通过，含实际自有R2条件竞争。客户端调用只用进程内HTTPS替身，不是真云；资源仍是显式seam，权威HTTP生产者／永久幂等／全事件和共同Root未接，47表冻结未变。详细源R2接线§2.5，不冒完整发布／部署。
- DISTRIBUTION-RESOURCES-1为独立publisher增加默认冻结R2运行图校验：精确投影／候选runtime、角色与manifest关联、逐对象SHA／长度／MIME及严格JSON；缺资源不切根。十一入口全过，新内存／实际自有R2各34组，含无override的默认publisher两代缺失／恢复。实际包的静态四季引用缺验证端口时拒绝，不冒全资源／可玩认证；共同Root／47表未变，详见R2接线§2.6。
- R2-RESPONSE-BUDGET-1已为实际HTTPS客户端加接收前／chunk预算、长度／中断检测及绝对deadline；根／回执4096B、投影／运行对象按冻结长度收紧。新增进程内HTTPS28组，连同前十一入口全部通过；没有真实云请求，PUT中断不冒回滚。静态包／正式生产者仍缺，详细源R2接线§2.7。
- STATIC-RELEASE-1新增确定性静态部署字节／源码树清单，保原过滤并核复制后字节；合同43组、临时打包6组、实际1377文件两次隔离打包逐SHA通过。没有触碰共享dist或云，也未接静态依赖验证／旧局资源保留；详细源R2接线§2.8，不冒完整依赖或部署证明。
- STATIC-RESOURCE-BYTES-1新增带独立构建／源码SHA的静态包只读字节预检，绑定八幅四季图并逐项核所有asset，末次重读清单且不跨次缓存。四入口35／43／6／实际1376个asset通过，音乐缺失重复预检拒绝；仅自有内存／文件端口，未接生产HTTP、未证明核心兼容／迟到资源保留。详细源R2接线§2.9；共同Root及47表未动，未commit/push/deploy。
- STATIC-HTTPS-1新增受信origin／前缀的只读HTTPS端口，严核路径／状态／MIME／编码，不带凭据或跟随重定向；与R2提取共用接收预算和绝对deadline。十七入口全过：新31组及原R2、静态包、分发、回执、账本回归；HTTPS只用进程内替身，未证明真实TLS／生产配置／旧局延迟资源保留。详细源R2接线§2.10；共同Root／47表及前端未动，未commit/push/deploy。
- PUBLISH-OPERATION-1已为共同应用的新HTTP发布接永久请求／结果，同键竞争只发号一次，末端收据失败共同回滚。六入口通过：SQLite24组、实际Request／固定安装／20章编译13组、原子性10、DDL、HTTP11及workerd schema；47表冻结不变。真实章节ID含`#`暴露R2通用ID限制，收据保留源ID，后继运输修复见下一批。详细源R2接线§2.11；非R2／浏览器／作者空白新建证明，未commit/push/deploy。
- CHAPTER-TRANSPORT-1独立校验源章节ID及当前game范围，通用release／签名key不放宽；R2保留字面量`#`，HTTP只编码一次。实际共同编译20章逐字节进入索引，运输合同66、真实R2 reader66及资源35／35通过；连同发布事务、DDL、HTTP和分发回归共22入口全过。未改源／存档／schema／前端；不冒完整R2游戏或静态闭包，详见R2接线§2.12，未commit/push/deploy。
- RELEASE-CANDIDATE-1：共同发布在异步准备前生成不占序号的候选ID，最终事务重新核状态／权限后提交准确ID；pack导出独立准备副本。24入口通过：候选21、旧release27、原子性13、真实20章Root15及原运输／schema回归；预提交与提交后文件／索引逐字节相等。旧fixture缺ordinal／误查未上架目录和新增null-prototype比较错误保留原证后修正。详细源R2接线§2.13；尚无R2预上传或持久账本接线，未commit/push/deploy。
- RUNTIME-STAGE-1新增独立不可变预上传／逐对象及全图回读，仅写候选专属对象、不切根或改SQL；共享画像只读、静态端口未配置拒绝，私有票绑定准确候选。八入口全过：内存／实际自有R2各28组，含丢响应、冲突、最后读回／静态撤销，另资源35／35、合同66、客户端8、签名7、路径15。权限／静态为seam，尚未接共同生产者，不冒可见或物理删除在途登记；详细源R2接线§2.14，未commit/push/deploy。
- PUBLISH-RUNTIME-ROOT-1将预上传作为可信可配置端口接共同发布，使用真实当前会话／源／删除栅栏守卫，末端事务核私有票。十七入口全过：配置Root22／旧Root15、inspect25及候选／原子性／schema／HTTP／stage／资源／reader／静态回归；实际20章＋隔离打包1376个asset，R2为内存端口。修事务内未完整reservation误判，保留180秒超时及错误静态筛选夹具后完整重跑。仍无持久冻结生产者、远端可见或生产CLI，47表不变；详细源R2接线§2.15，未commit/push/deploy。
- READER-FROZEN-ROOT-1为已有generation／digest读取补完整v2根校验及全根SHA准入复查，禁止旧publisher覆盖v2。十二入口全过：新增实际SQLite→新publisher默认资源门→自有workerd R2／reader89项，七代及旧票续取／同投影身份竞态／坏根拒绝，另旧reader66及分发回归。不是共同权威事务、完整游戏、公告时间生产者或物理删除证明，47表未改；详见R2接线§2.16，未commit/push/deploy。
- LEDGER-SCHEMA-1共同Root新增空冻结账本，严格门同步23源／50表／49索引／343列／4FK，原47表声明保留。Node扫描暴露并补databaseSize／迭代游标；28入口全过，含共同Node／workerd各16组新增schema／类型／inventory负控、SQLite22及真实20章预上传Root22／旧Root15。非空全局账本inventory明确拒绝，未实现完整引用／清理；历史七条删除lane在本批只同步计数，后继复验见下项。详细源R2接线§2.17，未commit/push/deploy。
- DELETION-LANES-50-1在新证据目录复验七条旧删除安全lane，全过且610输入SHA稳定；bound SQL freeze含1239次真实HTTPS调用。保原断言与历史收据，仅迁移自有夹具／端口；固定8787的EACCES失败保留，不改系统策略或停其它进程。没有产品代码变化，不冒完整删除／发布或所有旧502已修；详细维护源仍为R2接线§2.17。
- READER-ANNOUNCEMENT-ISOLATION-1：公告故障不再阻断有效目录、status、准入及旧局取数；registry保目录并显式标记公告不可用，核心损坏／明确删除仍拒绝。新107项及十二读取／分发回归全过，旧实现失败已隔离复现；只属读取协议，前端提示、实际首次上线时间和冻结生产者仍未接。详细源R2接线§2.18，未commit/push/deploy。
- FIRST-ONLINE-REFERENCE-1：v2投影按同根R2服务时间／已有最小回执解析首次上线日期，默认publisher核历史引用，错误保持公告隔离。新89项及其余29入口全过；四代含回执故障pending、同根重试、重启、较晚根重新上架不改时。共同生产者、公告历史与前端仍待接；详见R2接线§2.19，未commit/push/deploy。
- ANNOUNCEMENT-HISTORY-1纠正“当前版可选”误删公开公告：共同发布保旧快照，下架隐藏、重上恢复；运输允许历史序号但拒重复／未来及旧公告重置时间。31入口全过，公告模型23、实际20章Root21／预上传28、实际R2时间／历史113；旧实现对新Root断言确定失败。未将旧Outbox／本地时间生产者与冻结引用拼成完整闭环，详见R2接线§2.20，未commit/push/deploy。
- LISTING-PUBLICATION-1在实际共同Request复现并拒绝“未发布草稿预上架”；同事务核release／pin／pack身份，错误不留下listed／行修订／审计／公告变更。31入口全过，Root23／预上传30组，含17种身份故障／缺行；原失败收据保留。该批尚未接上架永久幂等（后继见下项），冻结生产者仍未接；详见R2接线§2.21，未commit/push/deploy。
- LISTING-OPERATION-1已将管理员上架、公告／registry、审计与永久回执置于同事务，保原响应字段；原Request重试409失败有基线证据，旧回执不会重新上架。33入口全过：Node／workerd25组及重建，实际Root28／预上传35组。保留UUID夹具错误与workerd临时trigger拒绝的失败记录；不是冻结生产者、实际可见或浏览器重试UI，详见R2接线§2.22，未commit/push/deploy。
- FROZEN-PRODUCER-1可选共同装配已把发布、上架、下架／解除限制和删除栅栏与冻结事件同事务提交，保私有目录、公开公告历史和准确可见时间引用。36入口全过：目录34、双游戏SQL14、实际20章共同链16组／八代；排空发生在SQL包删除后仍按冻结字节执行，旧票续取及栅栏410通过。R2为内存条件端口，默认生产装配未启用，非物理删除／浏览器／生产成功；详见R2接线§2.23，未commit/push/deploy。
- PUBLICATION-STATUS-1增加当前作者按永久请求查询发布事件；publish的release UUID同时作为分发UUID，状态只读元数据，不扫描payload。36入口全过：发布模型37、账本Node31／workerd30及重建、实际20章冻结链23组／八代；根已写而回执失败仍pending，旧请求剪枝后可查，权限／栅栏仍生效。不是当前已上架或UI／生产成功；详见R2接线§2.24，未commit/push/deploy。
- PUBLICATION-UI-1作者发布页保存原请求关联、明确查询／同键重试，区分本地提交、待确认与历史确认，账户／晚到响应隔离。八入口全过：原UI16、新模型39、全新浏览器实际页面九组，另永久操作37／冻结链23／旧Root28／HTTP11／workerd50表。保留beforeunload console错误及账户输入残留负例后修复；后继r2审计发现共同入口漏`/publish.js`及清单漏pin，实际HTTP先复现404再修导入／路由，r3经共同静态入口完整重跑八入口并显式固定13个公共输入，测试样式修正后r4再次全部通过。浏览器API仍受控，不冒实际浏览器发布整链。详见R2接线§2.25，未commit/push/deploy。
- PUBLICATION-BROWSER-CHAIN-1串接新浏览器真实密码登录／共同业务／文件SQLite／20章编译／预上传／默认publisher／自有workerd R2及reader，非API响应夹具。九入口全过；新链十组／两次发布／五代确认，全部20章浏览器SHA、丢响应恢复、pending／确认、更新／下架旧票、栅栏410及数据库重开通过。仅新增测试；进程内运输桥不是生产HTTP／TLS／云或完整可玩／物理删除证明。详见R2接线§2.26，未commit/push/deploy。
- NODE-FROZEN-SERVICE-1补Node service／server受信冻结参数转发，默认false、坏配置在SQL／监听前拒绝。十二入口全过：构造14、HTTP两模式各11、浏览器经Node service与原gateway各十组／五代／20章，另原UI／共同Root／workerd回归。仅一处产品模块改动，不冒TCP发布、生产CLI或常驻排空；详见VPS就绪§4.4，未commit/push/deploy。
- DISTRIBUTION-DRAINER-1新增单实例串行循环，明确重试间隔、恢复锁停调度、幂等停机等待在途完成。七入口全过：新35组及publisher／ledger／resources双平台回归；真实内存SQLite／条件内存R2核回执故障恢复不重切根。尚未挂生产CLI／服务生命周期／浏览器整链，详细源VPS就绪§4.5；未commit/push/deploy。
- PUBLICATION-SERVICE-1新增受信冻结HTTP／默认publisher／drainer装配，监听前核远端，关闭等HTTP请求和在途分发全部结束。九入口全过，新18组含回执故障、真实慢正文停机、文件库重开不重切根；条件内存R2／空投影，非真实游戏HTTP发布或生产CLI。详见VPS就绪§4.6，未commit/push/deploy。
- FROZEN-PLAYER-SURFACE-1关闭冻结gateway的旧玩家shell／目录／公告／包／资源路径，authority另独立拒绝实时读取；Node统一配对，旧模式和私有Trial保留。十四入口全过：新13组、HTTP两模式各12、浏览器实际链两模式各10组／五代／20章，另共同Root／UI／装配／workerd回归。不是玩家引擎接线或物理删除完成；详见VPS就绪§4.7，未commit/push/deploy。
- PUBLICATION-CLI-1新增独立显式启动入口／纯环境配置／空凭据模板，接真实R2与静态校验、私有目录／数据库保护、退出信号和脱敏状态事件；不改旧auth sidecar／Compose。十五入口全过，新50组含真实子进程仅核配置、预检故障／文件重开／模拟早到信号／日志失败释放。HTTPS仍进程内替身，非Linux／云／部署；详见VPS就绪§4.8，未commit/push/deploy。
- MANAGEMENT-DISTRIBUTION-1为新上架／下架／解除限制永久回执保存准确分发关联，原响应不变；只读管理员查询区分pending、历史确认和明确no-op。二十入口全过：Node／workerd原25＋新24组及重建、实际冻结链30／八代，另共同Root／两种浏览器链／HTTP／CLI／50表。负例复现并修关联回调晚改行绕过最终校验，详见R2接线§2.27；无新schema／引擎／UI，未commit/push/deploy。
- MANAGEMENT-DISTRIBUTION-UI-1接管理员上架／下架／解除限制追踪与分发查询，保原键／body／If-Match、晚到响应及账户隔离；自己的游戏列表不再直发上下架。十二入口全过：新模型46，实际独立管理员浏览器11组／六代／20章，另原浏览器／作者UI／管理关联／HTTP／50表。真实浏览器发现首次发布公开名称null导致按钮误禁用，改按既有正式指针判断后完整重跑。详见R2接线§2.28；不是TCP／云／物理删除或完整玩家引擎认证，未commit/push/deploy。
- DELETION-DISTRIBUTION-1为删除栅栏请求接同事务准确事件关联及栅栏后只读查询，原fenced响应不变，历史分发确认不表示物理清理完成。十七入口全过：新Node／workerd24组及持久重建、共同冻结链35／八代，另旧Root、管理／浏览器、HTTP两模式及50表。没有新DDL或清理能力；详见R2接线§2.29，未commit/push/deploy。
- DELETION-TRACKING-UI-1接自己的游戏删除原键追踪，替代列表临时键POST；区分本地栅栏、历史分发确认与仍未完成的物理清理。十一入口全过：新模型42，综合浏览器真实作者删除提交后丢响应／刷新查回／六代确认，另原浏览器、管理／作者UI、删除双平台、HTTP两模式及50表。仍为进程内运输桥；不冒管理员跨作者删除界面、物理清理或生产成功。详见R2接线§2.30，未commit/push/deploy。
- ADMIN-DELETION-UI-1复用原删除追踪，补管理员全局摘要／三个最小确认字段；原名称及修订匹配后才POST，不开放他人草稿。十五入口全过：UI52、双平台删除31及重建、Root37，实际跨作者管理员／作者自己／原浏览器三模式均通过；跨作者真实提交丢响应后查回与六代确认，SQL actor为管理员。r1旧包装计数24未更新而失败，r2同步31后完整重跑；仍不是物理清理或生产成功。详见R2接线§2.31，未commit/push/deploy。
- PLAYER-CLIENT-1增加尚未挂载的固定准入取数客户端：票据只在闭包内存，固定角色／摘要／MIME／流预算与deadline，更新下架不重新准入，只有明确410删除退休句柄。五入口通过（客户端42、实际自有workerd链7、reader66、公告107、contract66）；实际链客户端在Node运行，非浏览器同引擎或存档证明。详见R2接线§2.32，未commit/push/deploy。
- PLAYER-CLIENT-BROWSER-1把真实客户端接入隔离浏览器测试：20章与SQL编译字节对拍、152索引asset、更新下架续取、缺文件503恢复和明确410退休通过。修已完成响应不必要abort；裸原生流亦可出现完整EOF后的Chromium CDP中止事件，须逐请求完整关联另记，不冒零requestfailed。八入口全过（观察器18、增强浏览器11＋6、原模式10、客户端43等），详见R2接线§2.33；仍未挂正式游戏入口／存档，未commit/push/deploy。
- PLAYER-PACK-1新增固定运行包／自有Blob URL适配，不伪造Trial binding、不读旧VPS资源；身份白名单、显式总字节预算、SHA／MIME／迟到及清理守卫。六入口全过（新52、实际编译链6、客户端43／workerd7、reader66、contract66）；实际20章编译中所选一章及152角色＋八图装配，并通过未修改world道路／地形加载器。仍为Node Blob与内存R2，不冒完整浏览器App／存档／全静态闭包；详见R2接线§2.34，未commit/push/deploy。
- PLAYER-ENVIRONMENT-1新增正式环境，Blob角色接原catalog／world／新局构造器，source修订不变而章节引用独立绑定releaseId／ordinal。八入口通过（环境37、实际编译环境7及原六入口）；实际一章经原prepareScenario成为v2 detached状态，装配快照JSON保留发布字段并拒绝错版本。r1合成夹具缺既有n_legions被拒，仅修夹具；r3完整复验。尚非App／正式存档或云，详见R2接线§2.35，未commit/push/deploy。
- PLAYER-REGISTRY-CLIENT-1补客户端当前目录／公开历史公告，白名单冻结、公告失败不阻断目录，不自动准入或将缺行视为删除。七入口全过：新29组、实际workerd两种根32次客户端比对及原107组，其余客户端／reader／contract回归保持；仍未接标题及公告界面。详见R2接线§2.36，未commit/push/deploy。
- PLAYER-SAVES-1复用既有游戏仓储，把固定准入的release／ordinal／chapter／manifest绑定到完整快照与公共JSON／detached恢复；不重贴新版本、不开放删除。r2八入口通过：新30组、实际编译选章保存恢复10组、既有store／20章snapshot／exchange等；下架保存、410拒新读写、本地保档及退休前后写提交边界已核。仍为mock IDB／fresh0tick，非App／清档UI；超安全整数ordinal明确拒绝待格式闭合。详见R2接线§2.37，未commit/push/deploy。
- APP-SAVE-OWNERSHIP-1修复共享App保存排队／IDB晚返回跨局改写：实际新profile负控先复现，修复后17项浏览器观察及十个验证入口通过；已提交但退出如实回执、不改新UI，未发出的旧请求不写。重卷217项Trial束，两壳未变。r1无关开场MP3 requestfailed保留，r2显式已看过开场路径且仍严格零失败请求；非正式App接线完成。详见R2接线§2.38，未commit/push/deploy。
- PLAYER-REPOSITORY-1补正式存档到App仓储形状的显式适配：已观察精确令牌才覆写，新增不占已有槽，其它版本／章保留为不可用，不自动重读覆盖或删除。七入口通过：24组真实CAS/mock IDB、实际编译正式链13组及原10组／存档30／store／snapshot／exchange；仍未安装到App，无新浏览器或清档UI证书。详见R2接线§2.39，未commit/push/deploy。
- FORMAL-APP-1新增共享App显式正式环境／仓储入口，保原新局／恢复引擎；终止先废票，阻止输入、RAF、异步资源及晚保存安装，战术只丢弃不结算。保存窗口隐藏不可用保留槽且新槽避开其身份。十八入口和独立本地Trial浏览器通过，新正式浏览器15组含真实IDB新局／恢复／迟到提交；受信pack及测试import map不是签名准入联合链或生产挂载。217项束已重卷；公开选择／公告、版本清档与删除确认host仍缺。详见R2接线§2.40，未commit/push/deploy。
- PLAYER-MODULE-LAYOUT-1把六个玩家模块统一到`web/src/player/`，reader只再导出；正式App浏览器已去掉import map／模块替身，普通静态根下原15组保持。十九入口全过，含49模块字面依赖、真实本地发布／Trial浏览器、workerd及隔离静态打包；223项束保原217项字节。不是公开选择挂载或签名准入到App联合证明，详见R2接线§2.41；未commit/push/deploy。
- PUBLISHED-APP-CHAIN-1把实际共同发布／自有R2／签名reader、pack与共享App串为同一浏览器链，第一章真实新局／原生IDB保存／重新准入冷恢复、更新下架保旧身份保存及410退休保档均通过。七入口全过；新增仅测试与文档，普通静态包供模块／八图，host仍为测试适配，不冒公开选择、删除确认或生产HTTP／完整战役。详见R2接线§2.42，未commit/push/deploy。
- PLAYER-CATALOG-VIEW-1新增独立当前目录／公告DOM视图，内置默认、故障隔离、完整历史滚动及右键返回，刷新撤下旧选项、迟到结果不重开。七入口全过，新浏览器17组／40条历史、IDB零调用；实际发布App联合链同时复验新增静态模块，224项Trial束保原223项字节。尚未挂标题／替换旧API，不授准入或清档，详见R2接线§2.43；未commit/push/deploy。
- PLAYER-SESSION-HOST-1新增固定正式对局版本警告／确认退出宿主，单飞状态请求、未知不冒删除、确认前不导航且本地保档。十入口通过，新浏览器16组及真实发布到App链验证持续警告／旧身份保存／410退休后右键无效与左键确认；实际首页、保存检查触发、导航接线仍缺。目录浏览器偶发失败补严格逐流证据与36负控，原失败保留，不泛化忽略请求错误；225项束保原224项字节。详见R2接线§2.44；未commit/push/deploy。
- FORMAL-SAVE-STATUS-1为共享App新增正式状态检查端口，保存窗口打开及写前复查，await后重核归属／运行／禁存守卫，网络错误不冒删除。二十四入口通过，正式浏览器20组，真实联合链验证先警告后旧身份保存、410在IDB前阻断且确认前不导航；225项束仅main／GameBar更新。GameBar过大及push-only LSP未确认，公开入口／导航仍缺。详见R2接线§2.45；未commit/push/deploy。
- PLAYER-SITE-1新增同源只读API／Static Assets入口及根Wrangler绑定／非秘密配置。八入口通过，新18组真实本地Assets路由验证API遮蔽拒绝、缺密钥不影响静态读取、签发与旧票更新下架／删除边界；两种实际发布浏览器链API已走新入口。Web／225项Trial束／规则存档字节不改；没有生产密钥、云绑定或部署证明，公开启动与导航仍缺。详见R2接线§2.46；未commit/push/deploy。
- PLAYER-STATIC-1增加固定HTTPS／八季节图的浏览器字节端口，并替代实际发布到App测试中的临时静态读取。十入口通过，新47组含预算／deadline／已完成不abort／迟到取消／静态410及外部typed error不冒删除；226项Trial束仅新增模块、原225项及两壳保持。公开boot、生产TLS响应与旧局完整延迟资产保留仍缺。详见R2接线§2.47；未commit/push/deploy。
- FORMAL-START-FAILURE-1补共享正式App启动异常清理，原异常仍抛给调用方，只有固定环境所有权守卫可提供删除事实。补丁前负控保留；二十四入口通过，正式浏览器25组含五种启动拒绝／部分装配清理及原档保留，226项束仅main更新。r1测试错误期待预检前已有BattleView，修正后重跑；公开启动／导航仍未接。详见R2接线§2.48；未commit/push/deploy。
- PLAYER-CHAPTERS-1增加当前发布版真实章节预览与选择后重新准入；临时票据逐章关闭，混版／下架／迟到结果不安装。十入口通过，新42组、20章SQL展示字段对拍／编译链16组，真实浏览器新局与恢复均先预览再新签；227项束保原226项。仍未接生产选章／势力及导航，详见R2接线§2.49；未commit/push/deploy。
- PLAYER-NEW-GAME-VIEW-1新增独立章节／势力选择界面，明确点击才新准入／交付固定包，实际槽号、取消和迟到资源受守卫。九入口通过，新浏览器20组及实际发布App新局原生点击；228项束保原227项。r1清单映射及r2本地Trial bad-port失败保留，r3／r4完整通过；公开boot／恢复／导航仍缺，详见R2接线§2.50；未commit/push/deploy。
- PLAYER-RESTORE-CAPTURE-1补正式选中档的令牌核对与单次App装配快照；捕获后外部替换不换恢复内容，覆盖仍冲突保新档。十一入口通过，仓储35组／正式浏览器27组及实际发布恢复联合链保持；228项束仅仓储变化。生产选档／旧版确认清理与导航仍缺，详见R2接线§2.51；未commit/push/deploy。
- PLAYER-RESTORE-VIEW-1增加正式存档选择组件，完整预检才可选，点击后重新准入并捕获准确令牌；不可用行只保留／说明，不读未知正文或删除。十二入口通过，新浏览器17组与实际发布App原生点击恢复，229项束保原228项。生产标题组合、旧版确认清理及导航仍缺，详见R2接线§2.52；未commit/push/deploy。
- PLAYER-PUBLIC-ENTRY-1已把目录／公告、新局／恢复、正式仓储与退出宿主挂入公开boot／原标题，去旧API和localhost回退；自建“否”不再读取内置档。十八入口通过，未替换HTML／boot的实际发布联合链验证原生点击、真正新局／冷恢复／游戏内读档导航、更新下架旧身份保存及410确认后回首页保档；230项Trial束更新三旧模块并新增装配模块。运输仍为自有桥，非真实云／TLS；旧版确认清理与完整资源／生产门尚缺，详见R2接线§2.53；未commit/push/deploy。
- 继续作者新建／库权限、完整物理清理、玩家端／真实生产装配与恢复验证。已询问VPS IP、SSH用户名／端口／现有密钥选择，文档仅有域名与目录，本机SSH config无对应主机；本地工作不因此停工。

- RELEASE-HISTORY-1已补不可变根副本与只读正式历史元数据查询：当前历史引用→原回执→根SHA／操作元组→历史投影／运行索引，末次重核当前根；不发旧版票据，也不授本地删档。十六入口通过，publisher双平台37／37、历史146、共同20章／八代38及公开玩家链保持；旧缺证据不回填，物理清理仍拒绝。Web／Trial束未变，客户端确认清理待接；详见R2接线§2.54，未commit/push/deploy。

- PLAYER-RELEASE-CLIENT-1接只读正式版本识别，准确请求身份／manifest／同版关系及BigInt序号校验，不发旧票或删除档案。十二入口通过，新51组、实际历史152组及公开玩家／本地Trial回归；230项束只更新客户端。识别响应仍不是本地语义校验或清档授权，确认清理待接；详见R2接线§2.55，未commit/push/deploy。

## R2 选择A与资源准入（R2-ADMISSION-A，本地切片，整链未接通）

- 用户明确回复“A”：仅当前版可选／新局／读档，但保留已准入旧局的必要固定运行资源。旧政策歧义已解除；不恢复历史选择／回滚，不自动GC或TTL终止，物理删除仍例外。产品源与开发待办已同步。
- publisher真实接不可变runtime索引、元数据／字节身份核验和画像依赖读验；reader退役泛key入口，接当前版／章节签名准入与固定角色白名单。旧票跨更新／下架仍取原版，返回前复查状态，未知不冒删除；轮换保旧验证key。游戏代码／SQL schema／Trial束未变。
- 本历史切片四显式入口32＋29＋10＋50项通过；后继画像合同验证以上节为准。含真实Miniflare/R2及受控await负例，非完整编译游戏／浏览器证明。证据 `.dragon-analysis/r2-admission-a/r3/`，失败r1保留；唯一详细维护源[R2接线](r2-player-connection.md)。
- 尚缺持久全事件分发／恢复、旧API到票据资源的玩家适配、全资源与正式存档版本合同、VPS正式入口及云装配。根Wrangler仍纯静态；未commit/push/deploy，不把本切片说成正式站可玩。

## R2 玩家接线前置修补（R2-PLAYER-CONNECTION-1，尚未接通）

- 用户要求解决自建游戏正式发布的 R2 链路。已核玩家 `/api/*` 与 reader `/play-api/v1/*` 不匹配、签名资源门／持久全事件分发／VPS 正式入口仍缺；不能只加桶绑定就宣布完成。
- 本地已修最后游戏下架后的完整空目录、不可变产物与投影的全字节读回、旧根预检、CAS 后根回读；确认未知保留 pending，不冒回滚。publisher 29 项＋Outbox 10 项隔离验证通过，含实际 reader 空目录准入拒绝；未测试真实云或完整浏览器发布链。
- 当时旧资源政策待明确；**后继用户已选择A，阻塞解除，以上节为准**。历史冲突与剩余接线见[R2 接线维护源](r2-player-connection.md)。未commit/push/deploy；前序打包修复保留。

## 后继部署排查（WORKERS-DEPLOY-1，本地修复，未上线）

- 用户要求核本次推送相对旧游戏及 R2 的差异。GitHub `42f0f36` 的 Workers check 实际失败；线上取得的 Clock 仍旧速度；只读云设置显示 `dragon` 绑定为空。构建日志权限403，不能断言远端唯一根因。
- 干净 HEAD 导出确定复现：旧静态打包脚本包含4份37～41 MiB统一地图 `game-source.json`，触发25 MiB守卫。已仅排除这些创作源，运行数据／共享引擎／画像保留；5项打包回归、隔离副本 Wrangler dry-run、打包后 dist 的新profile真实新局／存读生命周期均通过。未修改共享dist、云配置或R2，未commit/push/deploy。
- 历史已确认画像库R2首传和V3/V4原型；这不等于玩家运行链已接通。旧 `/api/*` 与 `/play-api/v1/*`、资源准入／生产恢复仍有缺口，本批不直接上线reader。详细证据、边界及待办统一见[部署审计](workers-deployment-audit.md)；持续配置见[部署指南](deployment.md)。

## 本轮发布整理（RELEASE-0.1.7）

- 全部工作区改动按产品／测试／冻结schema／必要文档分类保留；本地代理、运行数据、日志／截图和秘密配置不入库。README新增编辑器功能、本地认证后台启动、试玩隔离与未部署边界；VERSION／CHANGELOG同步0.1.7。
- 审查修复publisher的drain布尔参数／storage接线、部分目录覆盖全局风险与公开元数据过滤；reader改严格UTF-8解码并核投影SHA。5个新增／扩展专项入口通过，实际fresh Root核47表／47索引／318列。游戏侧沿用紧邻28入口并重新核SHA，不混称本次重跑全量。
- 详细范围、已知V5安全／恢复缺口及历史重lane限制见[发布审阅](release-v0.1.7.md)。本次不进行VPS／读取端部署或真实R2操作；main推送可能触发既有静态站自动部署。

## 前序批次：战略再提速与4064报错（STRATEGIC-SPEED-2）

- 用户要求玩家/编辑器战略在现有基础上翻倍：共享Clock改30/17.5/10/5/1.5625ms、RAF cap12，Trial束重建；规则周期、RNG、日历及战术速度未改。最终 `strategic-speed-2-r3` 的28个显式入口全部exit0，执行前后声明源码SHA不变；包含玩家App+生成Trial时钟、编辑副本10日、空章40日、战术五档矩阵及新profile存读。道路旧退休用例仍为skip，不把入口通过当全部规则认证。
- 验证inventory：既有AGENTS核心安全入口（content compile/pipeline/catalog/world/start、slot-phase/slot-battle/formation/road-authority/road-movement、marker/weather/disaster/retained及render/weather/lifecycle browser），加save-repository/local-saves/transition-guard、clock-transition/browser、Trial-rule-boundaries/Trial-browser、blank-livetick、native-city/raw-city及battle-browser。纯内存/固定Web资源/明确非存档原证；浏览器仅新profile/自有loopback，编译仅新隔离输出；子进程OS必要环境白名单、串行、逐日志保留失败。入口/源码SHA及日志位于 `.dragon-analysis/strategic-speed-2/`。不是编辑器全部后端或完整战役认证。
- 首轮28入口23通过、5失败原日志保留：blank合成据点y=1被fresh着色段别名门拒；四浏览器入口被标题新增目录/公告API请求污染。仅修测试夹具：blank移至内部网格（不改规则门），四入口显式mock同源空目录/公告以禁止回落共享8322；原错误断言保持，不过滤错误。r2同28入口通过；随后仅两新增JSON读取补明确错误包装，r3全部重验通过，helper纳源码清单；不据空目录fixture认证真实发布服务。
- 吕布归天/刘勋截图 `Uncovered SS:[BP+10h] at 4064` 已定位至四候选且随机低两位0时越过16字节局部帧。原字节签名重新通过；外层栈动态值非现有规则状态可恢复，详见[道路原证§3.15.6](re-notes-march-pathfinding.md#3156-p394064-外栈读取闭合为永久工程边界)。不是提高速度造成的新规则错误。用户随后明确回复“同意，继续”，批准CITY-4064-WEB-1仅此分支选第4候选、不额外耗RNG的Web差异。共同规则已最小接入，旧永久停点说明已更正；尚无截图同局/同RNG复现，不宣称整个战役已认证。
- CITY-4064-WEB-1实际验证：native-city专项29项通过，包含1..4候选×256随机byte、弱城一次canonical RNG、Clock/Trial最高档真实aiTick与低1正常分支的后继状态/随机消费对照；随后同上28显式入口全部exit0、声明源码SHA前后稳定，Trial束重建。独立 `.dragon-analysis/city-4064-web-1/` 保inventory/receipt/日志及最终audit；不读取用户存档、不运行真实后端或扩大规则差异。其它fail-closed/hold/禁存负例保持；不是截图同局或完整战役证明。
- 本修复主动LSP无error；native-city既有Scenario字段类型hint及JSON往返warning保留（测试真实JSON语义，不能换structuredClone），ai.js超过5000行工具上限未确认，只改注释并另作语法检查；文档链接/束217项逐byte与摘要/源码pins/语法/diff结果见本scope audit。Jev前轮HTTP451地区限制未重试，不绕过。无commit/push/deploy。

- 最终静态核9个变更JS/MJS语法、217项束内源码/长度/SHA、两壳未变及r3源码pins均通过；重建除Clock外还带入5个此前漏卷的已提交模块（gamesource/roadedit/componenttools/generalportrait/startmenu），已逐项核其源码与HEAD相同，本轮未改其功能。最初“束只差Clock”静态假设失败已记录并纠正，不伪称单条束差异。重复build为unchanged。
- 主动LSP有部分push-only未确认，测试辅助文件仍有既有URL warning/类型hint，不称全clean；新增JSON诊断已修复。Jev最小工程摘要preview后请求返回地区HTTP451，不重试或绕过；不阻塞确定性验证。无commit/push/deploy，原有其它任务改动保留。

## 历史主线快照（2026-10-16，实时状态以上方后继scope为准）

| 方向 | 状态 |
| --- | --- |
| 编辑器功能（Q25/Q26/D公告/A2/Q34/画像退役） | 上述限定功能已提交；47表基线本次fresh Root复核通过，不代表全部E-01重lane通过 |
| V3 publisher＋V4 读取端＋Outbox | 原型纳入本次发布；23项publisher干跑／25项reader通过，生产排空与签名准入仍未闭合 |
| 死锁项 | 门闩根因已修（draft-freeze 全绿）；重 lane 502 残留（isolate 资源方向，未证实） |
| 部署线（VPS/V5） | 待用户逐项授权，未开工 |

用户产品决策（详见 `editor-dev-todo.md` H 节）：发布＝作者定版／上架＝管理员专属（A）／单版本替换（后继A明确保留已准入旧局的必要运行资源）；作者自建（第一章＋公用图，画像自传或模板库，重名允许）；禁上传、画像库一对一（B）；R2 `dragon` 桶四区布局（kao/artifacts/projections/control，桶私有）；凭据只放仓库外 env。

## 正式存档大序号（SAVE-ORDINAL-1，本地完成）

format3安全整数小值保持，仅更大正式序号用唯一规范十进制字符串；保存、备份、冷恢复及选择界面已接，槽／写入计数和CAS不变。`save-ordinal-r1`十六显式入口通过，含54语法／事务组、正式App29组、普通／大序号恢复17／18组及公开玩家联合链；全部仅自有内存或新profile。详细合同、范围及原始证据见[R2§2.56](r2-player-connection.md#256-正式存档的大序号精确表示save-ordinal-1)。旧版确认清理、旧静态资源闭包与实际部署仍缺，未提交／推送／部署。

## 受信静态包归档（STATIC-ARCHIVE-1，本地基础）

新增按构建摘要隔离的不可变静态归档，置于既有`artifacts/`区，逐资产与末次完整读回后才写清单；不切发布根、不覆盖或清理旧包。七入口通过：内存／自有workerd各34组、实际1389资产归档及原静态检查；Web／Trial束未变。尚未接固定对局身份、归档HTTP读取及延迟消费者，不冒旧局保留全部完成；详见[R2§2.57](r2-player-connection.md#257-受信静态包不可变归档static-archive-1)。未提交／推送／部署。

## 固定静态归档冷读（STATIC-ARCHIVE-READ-1，本地基础）

新增固定构建／源码pins的GET-only归档字节端口，严格清单成员、SHA／长度／MIME和所属守卫，无源回退／写入。十入口通过：内存／自有workerd各55组，实际1389资产在删除自有临时源／包后经原静态预检完整冷读，移除归档曲目后再次拒绝；r1测试地形文件名错误已保留并按真实消费者纠正。Web／Trial束未变，尚未接程序身份、HTTP和延迟消费者，不冒完整旧局保留；详见[R2§2.58](r2-player-connection.md#258-固定静态归档只读端口与冷读static-archive-read-1)。未提交／推送／部署。

## VPS安装源码检查（INSTALLED-PROGRAM-1，附未通过回归）

显式CLI在创建库／对象目录和远端IO前，核实际229源码、230项Trial束及受信源码pin；错pin拒绝，语法检查仍不冒安装认证。十入口执行、九通过，私有素材库因main／battleview／gamebar仍钉Git HEAD旧消费者摘要而失败，未改旧pin或删除断言。Web／束未变；下一步审差异与自有清单候选，不以磁盘测量冒已加载代码、完整资源闭包或上线。详细证据与限制见[R2§2.59](r2-player-connection.md#259-vps安装源码与试玩束检查installed-program-1)。未提交／推送／部署，目标继续。

## 固定库新身份／Trial选边（LIBRARY-REFRESH-1，本地）

消费者差异审计后重新捕获清单，以新registry登记，不覆写旧行／对象／永久键。真实SQLite＋内存／自有R2各8组保留432个旧对象；原私有库失败已解决。实际Trial浏览器发现过时头像图库遮住开始按钮，移除已废弃上传界面后普通点击启动同一App，零IDB访问。最终19入口通过，含实际workerd Trial22项、公开玩家及冻结发布／安装／静态冷读；失败轮及误用App属性的测试纠错均保留。细节及边界见[R2§2.60](r2-player-connection.md#260-固定库新身份与trial选边修复library-refresh-1)。未提交／推送／部署；完整资源、清档及生产条件仍待闭合。

## Linux权限／信号／进程崩溃（LINUX-PLATFORM-1，本地WSL2）

既有Ubuntu＋Node22、非root、ext4自有临时目录中十入口通过；新12组含11个真实子进程，核SIGKILL文件／SQLite恢复、权限拒绝及umask000下私有模式、SIGTERM／SIGINT等待未完HTTP与SQL、启动时早到信号。只新增测试及文档，产品源码／Trial束未变。最终1645源码pin稳定，失败轮和补齐入口pin后的完整重跑保留。详细源见[VPS就绪§4.9](vps-editor-readiness.md#49-后继linux权限真实信号与进程崩溃linux-platform-1)；HTTPS仍替身，不冒断电、真实VPS或云部署。未提交／推送／部署，完整发布条件继续推进。

## 分发静态批量预检（STATIC-BATCH-1，本地）

同一次分发的全部可见游戏／隐藏发布候选逐项核静态引用，整包仅扫描一次；单项端口兼容，失败不降级，重试／并发无成功缓存。四游戏夹具读取52→13，实际SQLite＋默认publisher两代缺文件不切根／不确认、修复后原payload重试；十五入口通过，新36组及原双平台／共同发布／1389资产冷读均复验。Web／Trial束未改，无浏览器／云操作；归档生产读取、核心兼容与旧局资源仍未闭合。详细维护源见[R2§2.61](r2-player-connection.md#261-单次分发的静态整包批量预检static-batch-1)。未提交／推送／部署。

## 启动程序归档（STATIC-STARTUP-1，本地）

显式CLI在建库／监听前归档独立pin的静态程序包并完整读回，失败禁启、碰撞不覆盖、重试不重复PUT；归档期间早到信号停止后续操作。Windows十二入口与WSL2十入口全部通过，CLI59组及原Linux12组复验；运输是自有HTTPS替身，没有云操作。Web／Trial束未改，旧程序HTTP／运行绑定等发布条件仍未完成。详细源见[R2§2.62](r2-player-connection.md#262-显式启动链的程序归档static-startup-1)。未提交／推送／部署。

## Linux归档退出／路径复核（LINUX-ARCHIVE-1，本地WSL2）

原Linux测试新增七场景：真实SIGTERM／SIGINT在静态GET及已提交PUT响应等待中退出，保留已提交字节；归档await后目录／数据库权限及symlink变化拒启，不修复或删除原数据。十入口首次全过，Linux共19组／18子进程；仅测试与文档改变，产品／Web／Trial束未改，没有云或用户数据操作。详细源见[VPS§4.10](vps-editor-readiness.md#410-后继linux归档中退出与异步后路径复核linux-archive-1)。仍非完整发布／部署证明，未提交／推送。

## 程序不可变登记（PROGRAM-REGISTRATION-1，本地）

显式安装链在整包归档及安装／路径复核后写入独立程序登记，精确读回后再次复核才建库。碰撞保留、丢响应靠读回、未知拒启、旧登记无GC；不修改游戏发布根或授权作者程序写入。Windows十四／Linux十入口首轮通过，新协议40／40、CLI64及Linux19组；Web／Trial束未改，尚未开放程序资源HTTP或接入玩家迟到资源。详细维护源见[R2§2.63](r2-player-connection.md#263-程序归档的不可变登记program-registration-1)。未提交／推送／部署。

## 已登记程序资源HTTP（PROGRAM-ASSET-HTTP-1，本地）

新增只读`/program-assets/<SHA>/<path>`，按受控登记、规范清单及文件摘要逐层验证，末端重读；无ASSETS回退、HTML入口或游戏历史准入。抽出共享纯清单格式，原完整静态包字节／SHA不变。Windows十七／Linux十一入口全过，新52／52组、实际站点21组及原发布／CLI／Linux边界复验；首轮漏复制工具依赖的打包失败已保留并修正测试复制清单。Web／Trial束未改，仍缺玩家迟到资源绑定和核心兼容等完整发布门。详细源见[R2§2.64](r2-player-connection.md#264-已登记程序资源的只读httpprogram-asset-http-1)。未提交／推送／部署。

## 当前程序入口处理器（PROGRAM-ENTRY-1，本地未挂载）

新增从当前Static Assets清单选择已登记程序壳的内部处理器，共用原资源门的归档读验，只插入固定程序base，不接受历史程序选择。七入口通过，新Node／workerd各57组含两份自有静态部署；修复实际workerd不支持redirect:error，失败现场保留。尚未挂site／Wrangler：战术图片查询后缀、八季节图绝对路径及完整浏览器迟到资源须先闭合。Web／Trial束未变，无云操作；详细合同与限制见[R2§2.65](r2-player-connection.md#265-当前部署的程序入口处理器program-entry-1尚未挂载)。未提交／推送／部署，目标继续。

## 战术图固定查询别名（PROGRAM-SPRITE-QUERY-1，本地）

程序资源门仅为四张既有战术图接受精确`?v=original-sprites-1`，仍按同一程序摘要／登记／清单／文件读验；其它查询和路径零桶访问拒绝。七入口首轮通过，资源HTTP91／91组，原入口57／57、站点21、reader66、清单43保持；图像为运输夹具，非浏览器或战术认证。Web／Trial束及site／Wrangler不变，当前程序入口仍未挂载，下一接缝为八季节图基址与真实迟到消费者。详细源见[R2§2.66](r2-player-connection.md#266-战术图固定查询别名program-sprite-query-1)。未提交／推送／部署。

## 季节图程序基址（PROGRAM-BASE-1，本地）

八季节图从已加载模块推导的固定程序前缀取数；补开场固定片段纯文本供应，不开放旧HTML页面。复用公开浏览器链验证实际程序归档到新局／保存／恢复／退出，21入口通过，Trial束已重卷；失败轮及具体限制见[R2§2.67](r2-player-connection.md#267-季节图程序基址与实际浏览器接线program-base-1)。仅单程序隔离运输，不是跨部署迟到资源证明；入口未挂载，无提交／推送／部署。用户要求收紧边界、避免过多辅助测试和过度工程化；本批只收尾，不另扩功能。

## 正式入口挂载（PROGRAM-ENTRY-MOUNT-1，本地）

正式首页请求已接程序入口，普通首页仍走Static Assets；只复用既有浏览器／站点验证，没有新增测试文件。受控切换当前软件后，旧页面首次加载的战术图／数据和音乐仍用旧归档，退出后恢复使用新程序；不是战斗Session或不同引擎兼容证明。七入口首轮通过（站点24、入口57／57、资源104／104、两条公开浏览器链），详细维护源见[R2§2.68](r2-player-connection.md#268-正式入口挂载与旧页面迟到资源program-entry-mount-1)。未提交／推送／部署，整体发布条件仍未满足。

## 代码检查点与当前版本唯一政策

按用户要求先提交当前代码：`d2acb08`（235文件），未推送／部署。提交后72个状态标记经逐文件核对与HEAD字节完全相同，没有覆盖或重置它们；一次假定为换行差异的检查在写入索引前拒绝，不产生额外提交。

用户随后更正为“新版本上线，旧版本全部作废”：撤销旧局续玩、保留旧游戏资源与旧档单独确认删除。当前已接新版保存原子清旧档、加载旧档提示并自动清除；复用mock及真实隔离IDB／恢复浏览器验证，未新建测试文件，重卷Trial束。详见[R2§2.69](r2-player-connection.md#269-新版作废旧档保存与加载清理current-only-saves-1)。旧凭据与宿主后继见下节；服务端旧数据回收及相关旧测试更正仍待继续，不能按旧策略测试成绩宣布具备发布条件。

## 当前版本资源门与宿主退休（CURRENT-SESSION-1，本地）

共同投影保留最小当前版本元数据，reader在取数前后拒绝旧凭据；客户端精确409进入作废态，宿主确认更新后退休会话／资源并提示确认返回。复用目录、客户端、workerd、reader、宿主／正式App／Trial共七个现有入口通过，未新增测试文件；新政策完整发布浏览器链仍待更正复验，物理回收仍未完成。详细范围、夹具失败及新Trial束见[R2§2.70](r2-player-connection.md#270-当前版本资源门与旧对局退休current-session-1)。没有新提交、推送或部署。

## 当前阻塞

1. **历史重 lane 502（部分尚待复验）**：后继DELETION-LANES-50-1的bound SQL freeze已在当前Root完成1239次HTTPS调用；这不替代其它lane或解释旧故障。旧private-ns／sql-freeze／bound／validated／waits 在 500+ calls 重请求处定点 502（DO stub `fetch failed`，workerd 零日志）。门闩／freeze 交互／copy 计数／累积调用已逐项证伪；fixture multi-waiter 修复本身已被 draft-freeze r9/r10 证实。下一步：抓 isolate 级错误原文或换快机器；证据与 probe 记录见 Git 历史与本目录忽略证据。
2. **Outbox生产排空未闭合**：原型本次修复入口并通过内存双游戏／CAS失败／旧版拒绝测试；持久payload、全事件同步和真实库恢复仍缺，不能直接上线。
3. **V5＋部署**：签名固定资源本地切片见最新R2节；持久全事件同步、前端及VPS正式装配仍未完成。后继用户已授权本地闭合及约定云／VPS部署，不重复索取批准；当前待补VPS实际SSH连接信息，独立本地工作继续。
4. **散项**：Trial 上传口已退役；Q10/Q29、Q11/Q19/N8、Q30 完整表单、N3 剩余字段、E 浏览器 lane、模板画像库确认（`149.png` 恢复存疑，有意删除请明示）。

## 下一步（按序）

1. 继续补齐本轮R2／VPS发布条件，含持久全事件、原子性／幂等、玩家身份与资源闭包、相应隔离回归；既有重lane失败不能冒通过。
2. 满足条件后按已获授权提交并推送GitHub main，监测Cloudflare实际部署；失败查因返回修复，直至站点核验成功。不重复发布旧tag，不推Gitea。
3. 核实VPS连接和现有服务／数据，按约定独立部署并绑定域名测试；保持同引擎、来源隔离及真实存档保护，不以历史probe替代当前验证。
