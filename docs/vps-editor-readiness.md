# VPS-EDITOR-READY-1：共享应用与本地持久端口

状态：**本地前置切片通过；尚不具备完整发布／生产部署条件。** 用户后继已授权：补齐发布条件后提交并推送 GitHub main、跟踪修复 Cloudflare Workers 部署，随后部署约定 VPS／域名并测试；不再重复索取这些授权。本文记录实际适配，不用历史空壳／sidecar 或本地成绩冒部署成功。

## 1. 同一应用、两个平台壳

- [server/editorapp.js](../server/editorapp.js) 是从原 `server/worker.js` 提取的业务／鉴权／路由核心，以 `createEditorApplication(PlatformBase)` 注入平台基类。
- [server/worker.js](../server/worker.js) 仅保留 DurableObject 基类注入和默认入口导出；不是在 workerd 上改用未经验证的裸类。
- [vps/editor-server.mjs](../vps/editor-server.mjs) 以同一应用接 Node HTTP／实际 SQLite／FileBucket。不分叉认证、管理动作或 Trial 引擎，不开放开发服务器。
- Node 入口核精确 Host／配置 HTTPS origin，只接受 GET／POST 和正常相对请求目标；正文最多 16 KiB，含 chunked，超限返回完整 413 后断开。丢弃客户端伪造的来源／代理头，以直接 socket 来源记限流，暂不信任任何转发头。容器后方代理用户可能共用来源限流，不把它冒充可信真实访客 IP。
- 静态受信 `.txt/.html/.css` 由 file-only 文本加载器导入，用户数据不是可执行模块。管理页面、客户端、样式、同一生成 Trial 引擎沿用实际认证路由。

初次提取逆变换后按 LF 规范化与 `HEAD:server/worker.js` 完全相同，证明该次抽取未顺便改业务；不是宣称后续业务修复也永久逐字不变。真实 Node 构造和真实 workerd 构造分别验证。

## 2. SQLite 与冻结源

同步事务拒绝原生 async callback（不调用），普通 callback 返回 thenable 时回滚其同步写前缀。BEGIN／SAVEPOINT 成功后才增加嵌套深度；失败锁竞争不污染下一事务。此检查不声称能撤销任意用户代码已发起的异步副作用，应用事务仍必须同步。

初次抽取DDL仅从worker移到editorapp，历史基线为22源／47表／47索引／94对象／318列／3FK。后继LEDGER-SCHEMA-1在共同Root新增三表，当前为**23源／50表／49索引／99对象／343列／4FK**；严格门及限制详见[R2接线§2.17](r2-player-connection.md#217-共同账本-schema-与删除检查ledger-schema-1)。Node同时补逻辑数据库页字节及可迭代消费游标；旧历史成绩不能当新版全链成绩。

- `node tools/verify_editor_schema_sources.mjs` 按当前明确23源提取固定 CREATE，直接比较既有冻结声明／列／FK／索引。
- `node tools/verify_distribution_schema.mjs` 在全新隔离 workerd 中构造真实入口和两条 lazy freeze，再核同一冻结门。
- `.dragon-analysis/editor-phase/backend-deletion-definitions-r2/regenerate.mjs` 是历史生成器，其旧 `worker` 源名不能再当当前输入清单；本批不运行它覆盖冻结产物。未来 schema 真变更必须先更新受审源清单，再按全套重定基流程操作，不把本次移动当新增或删除表。

发现 `server/available-library.txt` 在 Windows checkout 被自动加 CR，93633 字节不匹配固定93632／SHA。新增该路径 `-text` 属性，并在核固定 SHA 后恢复与 Git blob 相同的 LF 字节；没有改 manifest、摘要、策略或放松 pin。此问题不能靠修改校验长度掩盖。

## 3. 文件桶安装与边界

[FileBucket](../vps/file-bucket.mjs) 原实现直接写最终文件且无条件调用可以覆盖，已改：

1. 同目录私有随机临时文件，循环处理短写，文件 fsync 完成后 hard-link 原子安装；最终 key 永不覆盖，包括不带条件的内部调用。
2. 安装与临时文件清理后同步目录；Linux 目录 fsync 错误不得吞掉，Windows 仅允许明确不支持错误作为本地例外。尚未据此认证真实 Linux 崩溃／磁盘耐久性。
3. 只接受 private UUID／installed registry＋SHA 形状，明确拒绝 `.`／`..` registry；遍历祖先拒绝可见 symlink／junction，文件必须 regular。I/O／损坏不能伪装成不存在。
4. 提供兼容的 body 和 arrayBuffer；延迟打开前重核路径，使用可用的 O_NOFOLLOW，并核文件身份／长度。调用方仍核完整字节／SHA，不信文件名或 etag。
5. fsync／响应不确定时不声称回滚；已完整安装对象保留，重试只验证既有对象。没有自动清理别人的临时文件，也没有删除旧正式运行资源。

这不是抵抗另一个特权／同 uid 恶意文件系统写者的 sandbox。生产必须独占私有目录／权限；后继§4.9已补WSL2 Linux上的权限、系统调用及真实进程退出／崩溃测试，仍不等于生产VPS、容器隔离或掉电耐久性认证。

## 4. 实际验证

`.dragon-analysis/release-readiness/file-bucket-r3/` 显式六入口、OS 必需环境白名单、180秒／入口、源码前后 SHA 稳定、逐日志与收据：

| 入口 | 实际覆盖／结果 |
| --- | --- |
| verify_editor_schema_sources | 22源静态声明与冻结门一致 |
| verify_vps_file_bucket | 12组：精确取数、无覆盖、短写、写／fsync／link故障、安装后确认丢失、独立线程竞争、junction拒绝、迟到读取变更拒绝 |
| verify_vps_blob_file | 16项真实 ImmutableBlobStore／PrivateWriteJournal，与新文件端口联用 |
| verify_vps_sqlite_port | 18项，含真实第二连接BEGIN锁竞争、async拒绝、thenable回滚及重开 |
| verify_vps_editor_server | 11组真实HTTP：管理页、Origin/Host、超限、初始管理员改密、CSRF/epoch、引擎字节、账号幂等、伪来源拒绝、schema、关闭重开、注销 |
| verify_distribution_schema | 实际 workerd 47表／47索引／318列／3FK一致 |

测试只用自有临时 SQLite／文件／loopback／workerd，不读真实 DOS SAVE、用户浏览器档、真实编辑器库或云凭据。未改游戏规则或 `web/src`，未用这些 HTTP 测试冒完整浏览器编辑、试玩、发布及战役认证。

早期失败保留：node-app-r1 是校验脚本未处理 CRLF，业务提取本身无差异；r2 由真实 manifest 长度门挡住，未放宽门；r3 修 checkout 属性后 SQLite／HTTP／workerd 全通过。文件桶 r1 五入口通过，r2 加当前DDL源审计后六入口通过；r3 将排序嵌套三元改成同义分支后六入口全重跑，不拼接成绩。

### 4.1 后继：发布包与正式提交原子性（PUBLISH-ATOMIC-1）

`PublishedPacks.prepare` 只产生实例私有的一次性内存凭据，不写当前 SQL 包；输入章节／资源／身份在异步读取前复制。`installPreparedInTxn` 重新核主体／epoch，与调用方的发号、pin、剪旧账本、Outbox 和公告同一同步事务。实际 `#publishPin` 已改用这条路径；旧 `buildAndStore` 只保留独立端口兼容用途，不再用于正式发布路由。

`tools/verify_publish_atomicity.mjs` 的10组在内存真实 SQLite 上使用真实 pack／release／pin／outbox／公告模块：准备不写行，七个 INSERT 阶段注入失败后九张关联表逐字节保持旧值、旧章节／terrain 仍可读取；伪凭据、epoch 失效拒绝；异步间调用方修改输入不污染捕获；成功下一版仍为1.1，不消耗失败序号。输入是合成编译 DTO，visual reader 是仅八张固定 Web 图片的测试端口，**不证明完整编译、作者权限或 HTTP 发布流程**。

`.dragon-analysis/release-readiness/publish-atomic-r1/` 四入口完整重跑：上述10组、22源冻结声明、真实 Node HTTP 11组、真实 workerd 47表／47索引／318列／3FK均通过，源码前后稳定。初次单独探针误用 `pack.state` 而非实际 DTO 的 `pack.chapter`，已修测试访问路径并保留失败记录，不把首次失败写成通过。逆变换审计只在还原本次两处发布改动后核其它业务与 HEAD 一致，不再声称应用整体无业务变化。

### 4.2 后继：作者所属运行图素材（OWNED-RUNTIME-1）

新增 [OwnedRuntimeAssets](../server/runtimeassets.js)，共同应用的 PublishedPacks／TrialSessions 已使用它读取地图素材，不再借用管理员 `loadFull`：

- 仅接受受信品牌策略和 `visuals` 类型，只允许固定地图 manifest＋四季 atlas／tiles 共9个角色。拒绝创作源、实体源、任意私有key／外链和其它类型；没有库／完整复制的隐式降级。
- 使用真实游戏端口核所有权、删除栅栏，并另核当前草稿 revision；管理员不是跨所有者豁免。每次桶 get／stream read await 后以及交付 capture／readWeb 时重核主体／epoch、快照 root／digest、注册根／版本和 copy origin。
- 根≤1MiB、chunk≤4MiB、索引描述总量≤64MiB、单返回资源≤25MiB；全索引描述与固定策略对应，只读请求角色，逐chunk和完整角色校验字节／SHA。未消费流在迟到权限失败时取消，返回字节复制；没有 SQL 写、上传或新增表。
- `sourcecatalog` 的安装／状态／全源加载仍要求管理员；没有改原版复制权限。旧私有固定库 API 的管理员边界保持，不能把这条地图素材通路当作所有作者新建／库／图片功能已闭合。
- 正式发布提交还增加当前 draftRevision 二次检查，避免保留的历史 snapshot 行让异步准备后的旧草稿重新发版。完整 HTTP 发布竞态验证仍待后继，不以该条件存在替代端到端测试。

`.dragon-analysis/release-readiness/owned-runtime-r5/` 为后继最终九个显式入口收据：画像库621文件与清单双向逐SHA；owned reader 25组（含 get/body 两类受控await中的会话／epoch／改密／换owner／改revision／删除栅栏／注册根／origin变化、坏流／坏索引／坏角色、保留管理员门）；发布事务10组；真实41角色安装＋真实编译后的作者发布25项、作者Trial20项；IDOR9项；22源DDL；Node HTTP11组；真实workerd冻结schema。环境白名单，非HTTP/workerd入口禁网络；全为内存或自有临时库／文件，finally清理；不是浏览器或真实云证明。

r2 的旧发布fixture仍写620画像而实际清单／磁盘621，改为核API投影并增加独立全库验证，没有删除画像或降低SHA断言。r3 的旧Trial用非法 `no-such-id` 断言404，实际格式门422；分开保留非法ID422与合法但不存在ID404负例。两次失败日志均保留，未执行的后续入口不冒通过。r4九入口已通过；随后移除未接入／未认证的library分支并加类型／品牌负例，最终r5九入口全部重跑通过，不拼接成绩。

### 4.3 后继：固定库清单与跨平台检出字节（PRIVATE-LIBRARY-MANIFEST-1）

`PrivateLibraryAssets` 的旧硬编码长度93530与已批准清单93632不符。现从已品牌化、不可变 policy 的 manifest 角色读取长度，保留原 SHA 校验；没有改清单／policy 摘要，也未放宽管理员、owner、精确保存修订或完整目录捕获门。作者公共库访问仍未因此开放。

专项首次运行在消费者指纹处失败：15个文件因 Git CRLF 检出与原 LF 指纹不符，逐项与 HEAD 对比证明无代码差异。扩大核验已有Trial束发现74个模块具有同类差异，而束本身保留了正确源字节。`.gitattributes` 现固定共享JS为LF，既有 `gamesource.js`／`originalroadarrival.js` 两项为CRLF，生成描述符继续 `-text`；固定库 shell 为CRLF、两个工具消费者为LF，三个JSON包装文件末尾为LF。不是更新预期摘要适应漂移。

经先验SHA＋HEAD内容相等守卫，仅修76个检出文件的换行；另修束／两壳的末尾换行。生成器重跑后217项源文本／长度／SHA全部与现有束相符，束及两壳**逐字节等于已发布HEAD**，再次生成 `unchanged:true`；Git语义diff为空。20消费者指纹、清单及资源字节均不改。详细本地凭据 `.dragon-analysis/release-readiness/private-library-source-lf/` 保留两次写前断言失败及一次写后包装换行断言失败，`verify.mjs` 最终分别核旧摘要重建与HEAD，未把失败覆盖为成功。

`.dragon-analysis/release-readiness/private-library-r3/` 四显式入口全部通过：私有库14组（400角色逐SHA、20消费者摘要、清单／选定资源、坏长度／SHA、保留admin与owner门、await后epoch／origin负例）；22源DDL；真实Node HTTP11组；实际workerd冻结schema。库专项的主体权限／目录端口为明确内存seam，不冒真实库安装或完整HTTP资源授权证明。r1因检出格式失败的日志保留；最终r3全重跑，源码pins稳定。格式修复前的其它scope凭据是历史，不冒当前SHA。

### 4.4 后继：Node冻结发布构造选项（NODE-FROZEN-SERVICE-1）

`createEditorService`及`startEditorServer`现在把受信启动代码传入的`frozenPublication`明确交给共同应用工厂，默认仍为false。true必须同时配置runtimeStager；非布尔值、缺预上传端口或异步proof端口在SQL初始化／监听前拒绝。没有新增HTTP参数、环境变量开关或客户端能力，也未改业务权限／schema／默认生产CLI。

原Node适配器遗漏该选项，传true会被静默忽略。新增`tools/verify_vps_frozen_service.mjs`先在旧实现复现，再核十种坏配置同时被service／server拒绝且SQLite零表、四种合法装配保持origin门并不调用stage。首次探针误传空桶，因无效桶导致构造中途TypeError并留下25张自有内存表，不能作为目标失败证明；换真实自有FileBucket后准确复现“缺少预期异常”，两轮记录均保留，未放宽零SQL断言。

最终`.dragon-analysis/release-readiness/node-frozen-r1/`十二显式入口全过、输入SHA稳定：构造14组；实际Node HTTP默认／冻结两模式各11组，保全部Host／Origin／会话／密码／CSRF／代理来源／重开断言；实际浏览器发布链新增`--node-service`经`createEditorService.fetch`，与原gateway模式各十组／两次发布／五代实际自有R2确认／全部20章浏览器SHA；原UI16／追踪模型39／受控API浏览器九组、永久操作37、共同冻结链23、旧Root28和workerd严格50表同时通过。

浏览器仍通过进程内运输桥，不是Node TCP／TLS；HTTP两模式的预上传端口只是禁止调用的测试端口，真正预上传由另一实际浏览器发布链验证，不拼成HTTP发布证明。两版仍使用同一已保存草稿。生产CLI、常驻排空、旧玩家API收口、Linux耐久性及真实部署未完成；详细浏览器链边界见[R2接线§2.26](r2-player-connection.md#226-浏览器与实际本地发布链publication-browser-chain-1)。未commit/push/deploy。

### 4.5 后继：串行分发循环（DISTRIBUTION-DRAINER-1）

新增[`distribution-drainer.mjs`](../vps/distribution-drainer.mjs)，仅负责进程内调度既有publisher，不直接操作SQL／R2、不捕获当前游戏、不重建payload、不确认回执、不解恢复锁或删内容。必须由受信启动代码提供publisher和明确的正整数毫秒间隔；创建不启动，`start()`只接受一次。每次只等待一个`drainOne()`，确认后经零延迟timer让出事件循环再继续，idle／pending／未锁定异常按指定间隔重试，不递归空转。

每次调用前后检查账本状态：四种既有恢复锁均停止调度，不自动清除或重启；状态不可读／非法、未知publisher结果或调度器故障也终止循环，供部署监控处理。只读status是本进程调度观察，不是公开可见、当前上架或服务健康证书；不返回底层异常／私有数据。并发限制只作用于该实例，跨实例权威仍由原publisher／账本／条件写负责。

`stop()`幂等，清除下一次timer并等待在途调用完全结束，不取消可能已提交的远端写、不提前关闭SQLite，也不以停机伪称操作回滚。停后不能重启该实例，重新装配仍从原持久账本恢复；生产退出流程尚须实际接这一等待边界。

最终`.dragon-analysis/release-readiness/distribution-drainer-r2/`七显式入口全过：新35组，原publisher内存／自有workerd各30，账本Node31／workerd30及重建，默认资源门内存／workerd各35。新用例覆盖受控时钟单飞、真实Node timer自动重试／连续排空、队列取消／迟到timer、在途成功／pending／抛错停机等待、恢复锁／不可读／非法结果／调度故障；实际内存SQLite＋publisher＋条件内存R2另核回执故障留pending、重建循环不重切根、准确旧payload与两代有序确认、远端根丢失后持久锁停。

r1七入口已过；补迟到timer、后续调度失败、在途抛错停机三组后，r2完整重跑，产品模块不变。新集成明确使用资源验证seam及固定测试日期，不冒真实游戏／workerd整链／云。仅新增循环及测试，**尚未挂入生产CLI、Node服务生命周期或实际浏览器发布链**；原HTTP／玩家／schema未改，未commit/push/deploy。

### 4.6 后继：冻结 HTTP 与分发生命周期装配（PUBLICATION-SERVICE-1）

新增[`publication-server.mjs`](../vps/publication-server.mjs)的受信`startPublicationServer`，在同一storage、R2端口及静态验证端口上构造runtime stager、默认资源门publisher、串行drainer和冻结Node HTTP服务。要求显式重试间隔／静态验证函数；配置、端口形状、监听地址及prefix先校验，不从HTTP或env选择冻结能力。复制env并绑定运输函数，避免预检await期间更换装配。未提供跳过publisher资源门的选项。

监听前调用真实`checkHead()`；远端读取失败不监听，旧协议／异权威／回退等沿原恢复规则拒绝。预检可能初始化账本或持久化恢复锁，不能把启动失败称为SQL回滚。HTTP成功监听后才启动调度；绑定失败不排空已有pending。只读status分别报告服务生命周期与drainer状态，`running`不是健康／公开可见证明，也没有新增公开健康API。

幂等`close()`同时关闭监听与停止后续调度，以`allSettled`等待全部已接受HTTP请求及在途分发观察／确认完成；任一关闭失败也不得提前跳过另一侧等待。调用方仍拥有SQLite／文件桶／运输端口，仅在关闭完成后才能释放。已接受发布若在停止调度后提交，保留pending供后续进程恢复，不撤销／重发号。未注册进程信号，也未替换仍为auth sidecar的生产CLI。

最终`.dragon-analysis/release-readiness/publication-service-r2/`九显式入口全过：新18组，drainer35、冻结构造14、HTTP默认／冻结各11、publisher内存／workerd各30、默认资源35、实际workerd严格50表。新入口使用真实Node loopback／文件SQLite／FileBucket及实际timer：坏配置零表；预检网络故障／旧根拒绝；端口冲突不分发；回执写在途且真实HTTP正文未完成时，停机必须等待两者，拒新连接但不提前关SQL；回执故障后重开文件库，仅确认原根、不重复切根；坏投影维持pending；运行时根丢失持久锁停。第一次测试误在第二代再次入队bootstrap，被既有`DISTRIBUTION_GENERATION`正确拒绝；仅改该负例为listing，保留失败现场，不放宽产品账本。

本批R2仍为条件内存端口／固定测试日期，投影是合成空目录，实际默认验证器未替换，但没有游戏资源使静态验证被调用。**不是编译游戏经HTTP发布、浏览器挂载、TLS／云S3、完整静态闭包、Linux掉电恢复或生产部署证明**。旧玩家API收口、生产配置／信号／监控、实际运行链及部署仍待完成；未commit/push/deploy。

### 4.7 后继：冻结模式关闭旧玩家读取面（FROZEN-PLAYER-SURFACE-1）

共同应用新增受信`createEditorGateway({ frozenPublication })`，默认导出仍为旧模式gateway。Node service为gateway和authority传入同一受信构造参数，冻结HTTP装配因此自动使用新门；请求、query或env字段不能切换模式。冻结gateway对`/play`、`/api/published-games`、`/api/announcements`、`/api/trial-pack`、`/api/trial-asset`、`/api/play/web/*`及`/content/builtin/compiled/*`的GET统一返回503／`PLAY_READER_REQUIRED`，不重定向、不读本地pin／公告／包、不访问authority。authority另在seed和匿名读取前独立关闭六类数据路径，即使错误搭配旧gateway也不能穿透读取。旧gateway单独仍可提供旧shell，调用方必须按模式配对；正式Node装配已配对。

这是旧通路的拒绝门，**不是新版玩家入口已经接好，也不是410删除事实**。正式数据应由R2 reader的已确认根、当前准入与固定票据提供；不将本地SQL提交冒充公开确认。未启用冻结模式的旧路径保持；编辑器静态模块、登录和私有`/api/trial/web/`、`/api/trials/`认证路径不在此门内。旧作者“公告预览”若请求该旧API会得到明确503，不能解释成没有公告；玩家端公告展示／配置仍需后续接线。

`.dragon-analysis/release-readiness/frozen-player-surface-r1/`十四显式入口全过。新增13组核两种origin、query／cookie／伪模式字段、零authority RPC、独立Root零seed／零实时投影读取、默认旧模式及私有Trial门；真实Node HTTP两模式各12组，保留原11组认证／资源／重开断言，并分别核六条旧路径200／422与冻结503。另完整重跑装配生命周期18、冻结构造14、共同冻结23／旧Root28、发布永久回执37、原UI16／新UI39／隔离浏览器9、实际workerd严格50表，以及实际浏览器发布链经匹配gateway和Node service各10组／五代／20章。后两链仍是进程内运输桥＋实际自有workerd R2，不冒TCP发布／TLS／云或可玩引擎认证。

本批没有DDL、reader、引擎、运行资源或正式存档改动；未替换生产CLI、实现管理员状态关联／玩家引擎接入或物理删除，也未commit/push/deploy。

### 4.8 后继：显式冻结进程入口与配置（PUBLICATION-CLI-1）

新增[`publication-main.mjs`](../vps/publication-main.mjs)及纯配置解析[`publication-config.mjs`](../vps/publication-config.mjs)，另有**不含可用凭据**的[`publication.env.example`](../vps/publication.env.example)。它是独立、显式选择的新入口，不修改既有auth sidecar或Compose的启动命令；完整发布条件尚未具备，不能据此直接上线。由受控进程环境注入配置后，在仓库根运行：

```bash
node vps/publication-main.mjs --check-config
node vps/publication-main.mjs
```

只接受空参数或单个`--check-config`，不接受凭据参数／任意env文件加载／旧模式开关。必须显式提供编辑器HTTPS origin、密钥／初始密码、私有绝对数据目录、监听地址／端口、重试间隔、R2账号与凭据／`dragon`桶／prefix、静态HTTPS地址及**独立可信构建给出的清单和源码树SHA**。生产prefix须显式为空；隔离测试仅允许`test/<id>/`。旧玩家origin拒绝；不从远端清单自认预期SHA，不提供跳过默认资源验证的入口。`--check-config`只核格式／合同，不打开数据目录或联网，**不证明文件权限、凭据、远端资源或生产就绪**。

真实启动要求预先存在的私有目录；拒绝路径祖先symlink／junction，固定使用`editor.sqlite`与`private-objects/`，拒绝数据库及SQLite旁文件的链接／非普通文件。POSIX还核当前uid和无group／other权限；Windows本地验证不冒Linux权限认证。新数据库按0600独占创建，不chmod、替换或删除已有数据；不抵抗另一个同uid／特权写者的文件系统竞态。随后使用真实签名R2客户端、静态HTTPS读取器／固定摘要验证器和§4.6服务，远端预检失败不监听。启动失败可能留下新私有目录／库及恢复锁，不假称回滚；异常清理失败时不在可能活动请求背后关SQL，需操作员处理。

后继[启动程序归档](r2-player-connection.md#262-显式启动链的程序归档static-startup-1)已将受信静态包不可变上传／全量读回置于建库和服务预检之前，完成后复核安装与私有路径；归档失败不建库、不监听，但可保留已写对象。归档阶段早到信号在有界请求返回后停止，只报stopped；`--check-config`仍纯解析。该后继另在Windows／Linux复验CLI59组及原进程边界，不是云上传、程序HTTP或旧局资源闭包证明。[程序不可变登记](r2-player-connection.md#263-程序归档的不可变登记program-registration-1)随后把整包核验后的受控记录写入置于建库前，并再次核安装／私有路径；该批CLI64组，Windows十四／Linux十入口通过。后继[程序资源HTTP](r2-player-connection.md#264-已登记程序资源的只读httpprogram-asset-http-1)已有登记／清单／文件读验和站点路由验证，Windows十七／Linux十一入口通过；仍不提供旧程序HTML入口或玩家运行绑定。

SIGINT／SIGTERM在异步启动前登记；早到信号被记住，启动完成即关闭，不报started。正常关闭先等HTTP与分发退出，再关闭所属SQLite；重复信号／close共用关闭过程。独立状态观察仅输出白名单事件（started、stopped、distribution-idle／pending／confirmed／blocked／faulted、失败事件），不打印原始异常、env、路径、请求或凭据；confirmed是分发器历史观察，不是当前上架保证。blocked／faulted不会自动解锁或伪造健康；外部告警、监督策略和整体停机时限尚未配置。日志输出失败不能跳过资源关闭。

最终`.dragon-analysis/release-readiness/publication-cli-r2/`十五显式入口全过：新50组、旧面13、静态客户端31／59次、R2预算28、真实客户端publisher8、签名7、服务18、drainer35、冻结构造14、HTTP两模式各12、publisher两平台各30、资源门35及实际workerd严格50表。r1为48组全过，后补预检失败关闭／日志失败仍释放两组，产品代码不变，r2完整重跑。新测试使用自有文件SQLite、FileBucket、真实loopback HTTP与**进程内HTTPS替身**；只有`--check-config`运行真实隔离子进程，退出信号用独立EventEmitter模拟。覆盖错误配置不建目录、不泄漏secret、junction／硬链接拒绝、真实签名GET与静态缺失拒绝、预检失败不建auth schema、idle→持久恢复锁、关闭后重开文件库、早到信号及日志故障。没有真实TLS／云S3、Linux信号递送／权限／掉电、容器或部署证明；已有浏览器整链代码不变，本批未重跑或冒充新的CLI浏览器链。

### 4.9 后继：Linux权限、真实信号与进程崩溃（LINUX-PLATFORM-1）

新增[`verify_vps_linux.mjs`](../tools/verify_vps_linux.mjs)与[自有子进程夹具](../tools/fixtures/vps-linux-child.mjs)。仅允许Linux非root用户，无操作员路径参数；所有可写业务数据在新建私有临时目录，要求原生Linux文件系统，拒绝Windows挂载盘作为测试数据目录。本次实际环境为既有WSL2 Ubuntu、Linux `6.18.54.1-microsoft-standard-WSL2`、Node `22.22.2`、uid1000、ext4（`0xef53`）。没有安装软件、连接VPS、触碰生产数据或修改运行代码。

新12组使用11个真实子进程，不修改`process.platform`，不以EventEmitter模拟信号：

- FileBucket分别在文件fsync后／link前，以及link＋目录fsync后暂停；父进程发送SIGKILL。前者无最终对象，后者已有完整对象；新实例重试只安装缺失对象或返回已有对象，逐字节一致。遗留临时文件保留，list不冒充正式对象，不以测试授权自动GC。
- 实际Linux路径注入目录fsync的EINVAL，必须拒绝而非沿Windows例外吞错；已安装完整对象仍可核读，重试不覆写。**系统调用执行／注入错误不是断电实验**。
- 文件SQLite已提交一行，再在未提交事务中写第二行并SIGKILL；新连接只见已提交行，`integrity_check`为ok。不是备份恢复、远端R2/SQL跨系统事务或磁盘断电证明。
- root目录以及数据库、WAL、SHM、journal的group/other权限分别拒绝，既有文件字节不变。正常启动在子进程umask000下仍产生0700对象目录及0600数据库／旁文件，uid及单链接数正确。本次不声称测过另一uid拥有者的拒绝，也不改变现有权限。
- 对实际`runPublicationCommand`子进程分别发送SIGTERM／SIGINT：已接受但尚未接收完正文的登录请求使停机等待；补全正文后仍由真实SQLite鉴权返回401，进程才报一次stopped并以0退出。监听关闭，重开库的完整性及登录限流写入仍在。真实SIGTERM在异步预检期间到达也被记住，释放预检后直接停止，不报started，不留下监控timer。

最终`.dragon-analysis/release-readiness/linux-platform-r6/`十个显式入口全部通过，源码1645项前后稳定：新Linux12组、原文件桶12、blob/journal16、SQLite22、安装检查36、CLI53、服务18、HTTP默认／冻结各12、drainer35。安装检查仍核当前229源码／230束；Web、Trial束、策略及产品运行文件均未改，因此不重跑无关浏览器／游戏规则或重卷束。各入口仅传PATH／LANG／TMPDIR；预加载守卫限制原生连接至loopback并拒绝TLS外连，子进程另拒绝出站连接。HTTPS客户端仅被精确的空远端根GET替身接管，**不是TLS、云S3、Linux完整游戏发布或生产部署证书**。

失败及补验保留：r1启动选中了系统Node18，不支持node:sqlite；改用已安装Node22绝对路径，MSYS路径转换问题另以启动参数纠正。r2测试未归一化Node22 SQLite的null-prototype行，改为比较完整自有字段；r3守卫误拒数字loopback的本地lookup，限定只放行127.0.0.1后r4十入口已通过。审计发现r4遗漏三个旧测试入口的源码pin，补递归入口清单后重跑；r5生成脚本转义错误在测试前失败，最终r6完整通过。未覆盖或修改失败轮，未放宽产品校验。

### 4.10 后继：Linux归档中退出与异步后路径复核（LINUX-ARCHIVE-1）

在§4.9同一非root WSL2／Node22／原生ext4环境扩展原两份测试，**产品代码未改**。新增七组真实子进程场景，原十二组保留，共19组／18个子进程：

- 分别在首次静态清单GET响应，以及首个归档对象PUT已提交但响应未返回时暂停；每个时点分别递送真实SIGTERM和SIGINT。请求释放前进程仍等待，不提前报停止；释放后只报一次stopped、退出码0、无后续请求。前者零对象，后者保留一个逐字节核对的已提交对象，均无最终清单、数据库、私有对象目录、权威根预检或HTTP服务器。没有假称撤销PUT或立即中断网络。
- 在最后清单PUT已提交、响应仍暂停时，分别把自有数据目录改为0755、在其中加入0644数据库占位文件、或把目录替换成指向另一自有目录的symlink。请求释放后只发生最终清单读回，二次私有路径检查拒绝启动：退出码1、只有startup-failed，无SQLite／FileBucket写入、权威预检或HTTP服务器。完整232对象归档保留；文件字节、故意改变的权限、symlink和原目录均不被产品修复或删除。**这只覆盖暂停的await边界，不宣称抵御同uid写者在同步检查之后继续竞态替换。**

`.dragon-analysis/release-readiness/linux-archive-r1/`十个显式入口首次全部通过，1665项源码pin前后稳定：Linux19、文件桶12、blob/journal16、SQLite22、安装检查36、CLI59、服务18、HTTP两模式各12及drainer35。新增七场景均核真实退出码／OS信号、事件、无监听及准确运输计数；原测试没有删除或放宽。继承全部上一轮1663项pin，只有上述两份测试改变，其余产品、Web、230项Trial束及壳字节不变。没有重卷束或重跑无关浏览器。

HTTPS仍为严格进程内替身：232对象是当前229份JS、CSS、一项自有探针加清单，不是完整1389资产的云归档。所有权限／目录变化只在自有Linux临时目录，未连接VPS、真实R2或用户数据。本批不补程序归档HTTP、旧局绑定、备份恢复、TLS、断电或生产部署证明。

## 5. 剩余与连接信息

- [R2接线维护源](r2-player-connection.md)记录后继实际共同Request／20章编译／预上传与永久幂等验证，不再把它们全称未接。可选冻结生产者及发布共同提交已有实际本地验证，§4.4已接Node构造选项，§4.6已接受信HTTP／drainer生命周期，§4.7已关闭冻结模式旧玩家读取面，§4.8已有独立CLI／信号退出／状态事件的本地验证；玩家正式入口／保存身份后继已取得本地接线证据（R2§2.53），§4.9补了Linux进程边界；实际生产配置／监督告警、备份恢复、版本清理及完整资源闭包仍缺。50表初始化不等于这些接线完成；七条历史删除lane后继复验范围见R2接线§2.17，不冒物理内容清理完成。
- 作者发布／Trial的公共地图读取已按上节修复；作者新建和公共库／引擎角色读取仍需独立核验，不放宽管理员原版复制或旧私有固定库边界。后继 TEMPLATE-PORTRAIT-1 已修 R2运行索引拒绝 `p` 模板ID的问题；完整621项画像元数据和实际workerd固定角色路径已验证，详见[R2接线维护源](r2-player-connection.md#3-本地验证不是端到端上线证明)。这不替代作者创建或完整浏览器发布认证。
- Compose／反向代理／进程监督装配、受控来源和库安装、两端引擎修订门、Linux隔离／备份／恢复尚未验证。历史`vps/server-main.mjs`仍仅auth sidecar；新的显式入口为§4.8的`vps/publication-main.mjs`，未自动替换既有部署或接触其数据。
- 约定域 `dragon-editor.720108.xyz`、隔离目录 `/srv/dragon-editor`，不得影响 `/home/web` 现有栈；详情见[平台方案](editor-vps-cloudflare-plan.md)。当前文档和本机 SSH config 未提供该 VPS 的目标 IP／SSH 用户／端口／密钥选择，已向用户询问；没有猜测目标或尝试无关主机。
- 尚未提交／推送／云部署／VPS部署。SSH 信息缺口不阻塞其余本地工作；达到完整发布条件后按用户授权继续，而不是以本文切片通过提前交付上线。
