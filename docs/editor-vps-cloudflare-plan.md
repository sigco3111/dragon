# EDITOR-VPS-CLOUDFLARE-PLAN-1：VPS编辑器／Cloudflare玩家端拆分方案

状态：**已确认部署边界；工程接入方案待审阅，尚未实施或部署。** 本页为平台拆分、适配与分发的唯一详细方案源，不认证原版规则或关闭既有产品缺口。产品来源：[产品§5.5](game-editor-design.md#55-vps编辑器与cloudflare玩家端拆分最新确认)；共同合同：[工程§4–8](game-editor-technical-design.md)。

用户确认「分成两套，由编辑器发布到cloudflare游戏上」，并要求整理VPS适配、发布同步、Cloudflare读取端方案，暂不实施部署。两套指部署／职责；用户补充编辑器也有测试试玩，所以**VPS与Cloudflare各部署一份同一引擎的副本；VPS试玩用于验证编辑成果，共用同一源码／规则／源格式，修改引擎必须同步更新两边，不分别维护兼容变体**。此前Containers可行性讨论不再作为实施方向；不创建Containers或解码Worker，不安装软件、改域名／端口／凭据、迁移真实数据、commit／push或deploy。本轮只修改方案与必要的产品／工程／交接文档。

## 1. 边界与资源

```text
VPS：编辑器页面＋试玩壳／引擎副本／必需静态资源
     正式Node API＋SQLite权威数据＋私有文件资源
     登录／草稿／私有Trial（浏览器同引擎、仅RAM）／编译解码／分发
                     │ 仅分发校验完成的正式运行产物及公开状态投影
                     ▼
Cloudflare：正式玩家页面／引擎副本＋发布资源R2＋薄读取Worker
           目录／公告／准入／固定版本manifest与资产／明确删除状态
                     ▼
玩家浏览器：同一引擎＋按游戏隔离的IndexedDB；不建立玩家账户或云存档
```

| 归属 | 权威或职责 | 不承担 |
| --- | --- | --- |
| VPS | 试玩用同源引擎副本／静态资源，作者身份／epoch、草稿修订、固定来源、完整校验、正式版本／管理状态／公告及分发账本 | 玩家存档、改写内置原件、运行任意作者脚本 |
| Cloudflare | 已确认公开状态投影及已分发运行产物；匿名玩家取数与状态门 | 作者登录、私人资料、草稿、私有Trial、编译、图片解码 |
| 玩家 | 自己的Scenario／规则RNG／对局进度与本地存档 | 持有发布密钥、写正式内容、将客户端校验当发布证书 |

当前内置游戏静态文件、资源规模、引擎和原部署源保持；不因平台拆分重导原资源、换游戏域名或改变游戏规则。V0已核游戏端实际为Workers Static Assets项目`dragon`，经GitHub仓库`main`自动部署，当前`e5d929f3 Release v0.1.5`，域名为`workers.dev`二级域名及一个自定义域（`origin`即自定义域，存档绑该源）；项目内绑定0、无服务绑定。新增自建内容必须增加运行数据存储／读取能力，不能声称所有Cloudflare用量永久不变。内置启动不依赖VPS、目录服务成功或远端准入。

工程建议的最小Cloudflare增量是**一个独立发布产物R2桶＋一个读取Worker＋R2 binding及必要秘密配置**，不是新Containers、编辑器DO、D1、KV、Queues或解码服务。桶保持私有，关闭公共直连；不把现有编辑器私有源桶公开。读取Worker无管理写API；VPS受控publisher经R2 S3 API上传和条件切换。V0已核账号为免费套餐；R2现有桶仅两个非编辑器桶（一个3对象约2MB、一个765对象约33MB，本期账单$0.00），无`dragon-editor-private`，账号级无编辑器Worker。现有桶不复用为发布桶。新增发布桶／读取Worker和绑定均待授权。VPS侧盘点另行进行，本页不冒VPS已就绪。测试／生产分桶、分Worker、分密钥，不能把真实目录当测试fixture。

## 2. 已读代码事实与迁移接缝

以下是现有实现事实，不是VPS已具备能力的证明：

| 接缝 | 当前源码 | 拟议适配 |
| --- | --- | --- |
| 权威入口／认证／同事务构造 | `server/worker.js` 的 `EditorMetadata`，`server/wrangler.jsonc` 的DO／R2 bindings | 提炼共用应用／路由核心，Node HTTP适配；保实际principal／Origin／CSRF／epoch及提交复查 |
| 私有元数据／Job | `server/metadata.js`、`privatedrafts.js`、`jobs.js`及管理／栅栏服务 | 同一VPS SQLite事务域；接口与类型差分验证，不把进程Map当持久状态 |
| 私有对象／写日志 | `server/blobs.js`、`privatewrites.js`、`sourcecatalog.js` | 文件系统不可变对象适配＋SQL写意图／引用；保条件创建、全字节SHA、逐await复查 |
| 公开正式数据 | `server/published.js`、`playpacks.js` | 把构建运行产物与权威发布事务／分发分离；现pack的draftRevision不冒正式releaseOrdinal |
| 当前公开入口 | `server/worker.js` 的玩壳／pack／asset／来源资源读取 | 读取Worker只使用已分发公开投影，不回连VPS草稿或凭据 |
| 私有Trial与头像 | `server/trials.js`、`portraits.js`及同引擎壳 | 全留VPS受控源；规范输出／旧路径兼容分别锁测试，接Linux隔离端口 |
| 启动工具 | `tools/start_editor_backend.mjs`使用Miniflare；`tools/editor_server.mjs`为开发／验证入口 | 均不直接当公网生产Node服务，不能以把监听地址改为0.0.0.0代替迁移 |

`PublishedPacks.buildAndStore`当前在SQLite冻结章节／资产，重新发布会替换现pack；这不能直接满足历史正式版本资源保留。旧匿名浏览器成绩也不证明跨主机发布、VPS生产入口、真实Linux隔离或完整正式版本政策。源／库固定策略、398库存与未知G127/255、共同初始化／容量／消费者缺口全部保持；迁移不得顺手解除未知门。

## 3. VPS后端适配

### 3.1 运行与持久化

V0已核VPS：Debian 13 trixie、内核6.12.90-amd64 x86_64、systemd 257、2核／3.8Gi内存／1Gi swap／根盘100G（可用约95G）、Docker 29.6.0／Compose v5.1.4。用户已定Docker Compose部署以便迁移，编辑器Compose独立放`/srv/dragon-editor`，不动`/home/web`现有栈（nginx容器、php、mysql、redis、kejilion-panel）。域名`dragon-editor.720108.xyz`已指向VPS。反代并入现存容器nginx（host网络，配置即宿主`/home/web/conf.d`，证书`acme.sh` webroot `/home/web/letsencrypt`）；宿主apt版nginx已disable停用，不争80/443。机上原Node v20.19.2仅参考；生产以pin摘要的`node:22-bookworm-slim`镜像构建（已pin `sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392`），不新增npm运行时依赖。A空壳已验：只读容器+`./data` volume+`127.0.0.1:8787`+重启恢复+公网HTTPS 200 ok全绿（后端未接入前曾回502，握手正常）。注意probe重启约11s（缺SIGTERM处理，正式服务须加`stop_grace_period`/信号处理）。首版Compose内一个权威API写服务（宿主`127.0.0.1:8787`，已确认空闲），解码为一次性受限worker服务，不持有DB写权限；不先引入Redis／多实例集群。数据用命名volume（宿主路径`/srv/dragon-editor`，已建并归`dragon-editor`用户），代码只读挂载；密钥、R2凭据一律环境文件挂载，不bake进镜像。注意：`/home/web/docker-compose.yml`内含mysql明文密码，该文件绝不入库，本方案不记录其值。反代已接：域名经Cloudflare代理（橙云、SSL Full Strict保持）到容器nginx，`dragon-editor.720108.xyz.conf`照既有站写法（去静态缓存、`client_max_body_size 5m`、续期路径保留），`acme.sh` webroot签发ECC证书并装入`/home/web/certs`，HTTPS握手已通（后端未起时回502符合预期）。V0关闭，唯备份方式待V1前定。

- 正式Node入口不导入含 `cloudflare:workers` 或专属Text-loader假设的整个Worker；共享服务经显式平台端口装配，无框架、无新增npm运行时依赖。后台与引擎共享算法，不复制编译规则或用另一套简化鉴权。
- SQL端口核游标／行类型、BLOB的ArrayBuffer／Buffer、约束、触发器、同事务服务身份、嵌套事务语义与重启持久性。同步事务不得接受Promise或跨网络／文件await；实际事务模式、WAL和持久性设置通过目标机验证再冻结，不只用API名称声称对等。
- 文件端口按游戏／摘要定位，不使用用户文件名；隔离临时写、fsync、目录持久化后**不覆盖地原子安装**，已存在对象全长度／SHA一致才接受。不得无条件rename覆盖正式key；防路径穿越／符号链接／跨游戏访问。SQL意图先记账，文件写与SQL引用提交不是跨系统原子事务；崩溃后核实际文件与日志，未知状态不能自动当成功。
- 私有草稿、源、库、头像、试运行和计算staging均不在反向代理静态公开目录；软件更新不覆盖数据目录。仅manifest允许的公开产物交给publisher。
- 长任务保既有Job身份、lease代次、checkpoint、源码／pipeline摘要及永久操作结果；重启只恢复正确代次，不把计算Map／DTO复活为权限。

### 3.2 认证、Trial、资源隔离

编辑器与私有Trial同受控VPS源；cookie保持host-only、Secure／HttpOnly／SameSite及精确Origin／CSRF，不给游戏源共享管理Cookie。HTTPS代理只信明确配置的上游头，不信用户伪造来源IP。账户停用／改密／重置与提交复核维持同SQL权威；日志不录凭据、个人资料、图片正文或整份草稿。

解码用一次性Docker worker服务：无业务凭据／数据库／发布密钥，输入只含字节／模式／裁剪；`network:none`、只读文件系统、`no-new-privileges`、非root user、独立`tmpfs` scratch、限内存／pids／任务数及wall，异常整容器组清理并核零后代。`--cpus`只是速率不是累计CPU，累计仍自己记；`--memory`是cgroup总量，不拿V8 old-space冒充。具体参数经原预算最坏输入实测后批准。

容器内存总量、CPU速率、累计CPU时间、RSS和wall分别记录，不能互相冒充；V8 old-space不冒硬内存。当前Node／Windows实验只提供思路和可复核失败模式，不是Linux sandbox验收。隔离不可用则上传明确不可用，无直接解码fallback。Trial仍只用窗口RAM，网络暂停／确认认证无效终止，重登须重开；不把正式游戏的离线行为改成Trial规则。

### 3.3 两边的引擎副本与试玩资源

VPS不是仅API：其软件发行包须包含编辑器前端、私有试玩入口、同源共享引擎ES Modules及试玩所需CSS／字体／头像／音乐／战术与地图公共资源。受信静态程序和非私密库可由VPS提供；试运行快照和派生／上传资源仍经实际会话／Trial路由取数。Trial从VPS取得固定草稿与全部可达资源，不回连Cloudflare正式游戏站；Cloudflare游戏站不可用时不应破坏VPS试玩，只保留VPS自身网络／认证暂停规则。

- 两份引擎都在各自页面的浏览器运行，Scenario／RNG／时钟与资源实例分离；VPS不为每个试玩新增一套服务端规则模拟器。服务器负责取数、校验／编译、隔离解码和会话，不承载浏览器AI帧泵。
- **用户明确要求同一引擎、改动两边同步**：VPS试玩验证编辑成果能在独立正式游戏实际运行，不是近似预览器或兼容变体。仅维护一份核心源码／规则及编译加载合同；发布软件时记录同一核心清单／SHA／软件修订，两份部署的对应核心须匹配。私有Trial壳与公开玩家壳的权限、取数和存储端口不同，所以两份完整部署包可有不同SHA，但不能维护独立规则分支。
- VPS试玩只使用窗口RAM，禁止正式IndexedDB存取／回写草稿；Cloudflare正式局使用按游戏隔离的IndexedDB。不同origin／新窗口不是禁存和资源隔离已证，须实际监听存储调用及迟到输入。
- 引擎改动属于**同一软件变更批次**：从同一受审修订构建，VPS／Cloudflare同步更新对应核心并分别验试玩／正式局。两次部署不是跨主机原子事务；过渡期实际版本未匹配时，暂停新的试玩准入和正式内容发布，匹配及两端验证后才恢复，不长期允许两边不同引擎。旧已打开对局不在线热换；旧软件的迟到依赖仍须固定本局版本，不能拿无版本URL覆写冒同步更新成功。
- 编辑器独有界面或Node适配变化不自动要求游戏程序重部署。内容发布只上传数据，不夹带引擎JS；同时核实际Cloudflare受信引擎修订、schema／ruleProfile／compiler支持域，不能只信浏览器版本值或把VPS试玩成功当完整验证证明。
- VPS资源清单纳入代码包／受信静态库和私有取数端口的完整依赖，核包括惰性战术／音频／季节资源；不把只有启动画布或六派生资源200当完整试玩闭包。既有库存／Q69未知仍单列，不能为离线于游戏站而补原版未知头像。

## 4. 分发内容与Cloudflare对象布局

拟议布局（不是已生成文件或已部署API）：

| 区域 | 内容／边界 |
| --- | --- |
| VPS private | 完整创作源、原始上传、草稿、baseline、身份／会话、内部报告与任务；绝不上传为公开包 |
| R2 `artifacts/<gameId>/<releaseId>/<sha>` | 校验完成的章节／固定表、地图／道路、视觉／小地图、规范头像及正式必需资源；创建后不可覆盖 |
| R2 `projections/<generation>/<digest>/...` | 不可变完整公开状态快照／目录／公告分片／release索引，只允许必要公开字段 |
| R2 `control/current.json` | 小型可变根：协议版本、单调generation、不可变投影地址及SHA、前代／分发操作身份；仅条件写 |

运行包是数据，不是作者JS／HTML／SVG／任意远程URL；不为每个游戏复制一套系统代码。复用现有共同manifest／加载合同，正式身份清楚区分 `gameId/releaseId/releaseOrdinal/draftRevision/sourceDigest/manifestDigest/compilerRevision/ruleProfile`。现有 `studio-app-2`形状可经同一受审适配器转换，不静默把draftRevision或程序VERSION当游戏1.0。

资源闭包包含全部章节及共享规则／季节／战术／对白／音频等实际依赖，不只上传六派生产物或头像。可信静态共享资源可按固定摘要／修订引用Cloudflare现有包；若本机包没有某必需角色，上传已校验正式副本或拒发布，绝不临时回源VPS私有库。内置受保护路径与自建命名空间隔离，publisher不能写内置程序／资源或删除共享对象。

桶无公开域／r2.dev读取入口；未提交staging不可经猜URL取出。Worker从**当前根的release索引**验证读取资格，不能扫描桶对象列表作为游戏目录，不能仅凭对象存在或客户端SHA允许取数。未上架首次发布可存储，但匿名不得取得新局／读档资格；已下架旧局的历史取数见§6。

## 5. 发布同步：事务账本＋单调公开投影

### 5.1 提交点与状态（拟议补充，需专项证明）

VPS SQLite与R2**没有分布式原子事务**。采用一个VPS权威事务域＋持久Outbox（分发账本），R2只是其单调公开投影；不称「两个数据库同事务」或无条件对象覆盖已经线性化。

1. 捕获准确saved revision及预期正式版／行版本；完整校验编译，暂存产物上传R2并全部读回核SHA／长度／依赖。任何提交前失败不创建Release、递增版本或切当前根；旧正式内容不变。
2. VPS提交事务再核作者／epoch、游戏非内置／非删除、准确草稿和预期正式版。**同一事务**登记正式Release及整数序号、当前正式指针、提交时上架／管理状态、公告唯一键、registry generation及不可变Outbox payload／永久操作结果。事务前save变更／禁用／下架／删除仍按原CAS门决定，不用队列副本代替实际权限。
3. 该事务为权威提交点；分发状态另为 `COMMITTED_SYNC_PENDING`。事务后不能把网络错误报「发布失败未生效」、撤回版本计数、分配新版本重试或允许取消已提交内容。界面明确「已提交，正在同步」／「同步受阻」，仅公开端确认完整匹配后为 `VISIBLE_CONFIRMED` 并显示发布完成。
4. publisher从持久账本生成／上传不可变公开投影，核全依赖后，以R2 `If-Match`（首个根 `If-None-Match:*`）切 `control/current.json`。公开目录、版本／上架状态、公告及删除状态均引用同一generation，不逐个覆盖latest文件。
5. 回读根／投影并核操作身份／SHA后，VPS记分发收据；原key或operation查询返回同一正式版本。CAS超时／响应丢失为结果未知，先读回实际根／前代链核证，不再分配版本；只允许同payload幂等推进。

这意味着「VPS权威提交」与「公开可见确认」是两步，上传完成不等于发布完成。期间Cloudflare继续提供上一完整投影；无权威提交的失败不递增，权威已提交但同步未知不冒失败。此为本页工程提案，须确认和故障验证后落实，不用它改写发布失败不递增／失败保旧／公告一次提交的产品要求。若要求跨主机瞬间同生同灭，单纯SQLite＋R2无法保证，须重新选协调协议，不能用文档宣称已经满足。

### 5.2 顺序、竞态与恢复

- global generation在同一SQL事务递增；publish、list／unlist、restriction、公告和删除栅栏均进入同一持久投影流，不能只有发布同步、管理状态还留VPS。按代次串行推送；只有已核同一前代才CAS，陈旧／不同摘要冲突停止并核事实，禁止last-write-wins。
- 单publisher不等于可靠排空。持久lease／代次、旧进程晚回、断电重启、两台误启动及在途旧PUT均要用远端CAS拒倒退。根generation不可回退／复用／日常删除；本机锁或timestamp不能替代远端条件写。
- 本游戏已有已提交未确认分发时，新的发布先拒／等待明确恢复，不把原pending视为可取消失败；草稿保存不修改原Outbox。管理下架可追加更高代次，其成功提示也须确认Cloudflare可见，不假称VPS写完已对玩家下架。降级／滞后状态显式可查。
- 实际授权先后以VPS事务定义：撤销先于事务则拒；事务先于撤销已提交内容不倒回。后续必要管理限制仍按同一序列投影，作者发布不得绕过限制或重新上架。
- 发布序号1.0→1.1→1.9→1.10；草稿保存／上架／下架不改序号。首次发布默认未上架，已有上架态由提交实际状态决定。公告保生成名称／版本／创建者账户快照，重新上架不重复公告／置顶，私密资料不输出。
- **上线时间不冒入队时间**：publishedAt绑定VPS正式事务；首次firstOnlineAt绑定真正使该版可玩的Cloudflare根切换。拟将初次可见事件绑定generation，当前投影读取时以同一次R2根对象的服务端uploaded时间解析；确认后VPS持久记录该事件／时间，后代投影只引用已核收据，不用后续root时间重贴。分发Outbox的时间引用与业务快照固定，未知前代先核收据再物化后代，不改成latest草稿或重新发布。这些时间／代次绑定及公告一次可见需专项证明，不能声称本地提交已等于玩家上线。
- VPS恢复备份后先比Cloudflare当前generation／摘要及分发收据；远端领先或链缺失时禁推送并受控核账，不能上传旧目录复活删除内容。仍存在游戏保全部已发布资源，不自动GC；未提交staging清理另需引用／在途写证据，不以TTL代替。

### 5.3 物理删除

删除必须先VPS实际权限／下架检查及永久写栅栏；把删除事实投影到Cloudflare并确认后，读取端阻止新准入／资源请求，明确游戏删除可返回410。随后核在途传输／对象引用，清除VPS草稿／Trial／所有正式版本和R2游戏专属产物、旧公开投影中的游戏内容及公告、内部缓存与备份内容；最后才报告物理删除完成。

旧投影不是可恢复的历史目录档案；游戏删除时清其内容并生成只含不可复用ID／删除事实的最小替代记录。前代链／收据需设计为不依赖永存含内容的旧projection，保必要摘要／操作身份，不提供回收站。跨游戏共享资源仍须真实引用核验，不能靠hash相同或存在文件猜归属。删除未知状态不能报完成，恢复备份不得复活内容。

读取端每次实际请求先读状态再命中内部资产缓存；不把公开R2永久URL/CDN缓存放到状态门之前。清理不远程抹除已下载浏览器字节，不清玩家IDB；资源404／网络失败不是GAME_DELETED。完整physical delete当前未认证，平台拆分不能自动开放旧503门。

## 6. Cloudflare读取端与游戏接线

保留现游戏origin及IndexedDB可见性；不要为方便跨域而换游戏域名。若现有域有受控API路由可同源；否则独立读取origin，对确切游戏origin开放所需匿名CORS，无编辑Cookie、通配凭据或VPS管理端代理。域名／路由改动待单独授权。

拟议沿共同玩家合同 `/play-api/v1`，兼容现有pack URL的适配另测：

| 读取接口 | 行为 |
| --- | --- |
| registry／announcements | 固定一次current根读取其同generation投影，过滤当前上架；内置常驻。公告单独失败不阻断成功目录 |
| admissions | 匿名新局／恢复，核当前上架与预期正式版／章；签固定 `gameId/releaseId/manifestDigest` 取数凭据，无玩家账户或每局DB。可为POST但不写管理状态 |
| manifest／chapter／asset | 核凭据／game状态／已提交release／角色白名单及SHA／长度；仅固定版本。下架后原准入可续取，不为旧版签新局／读档资格 |
| game status | 明确存在、版本／上架态或最小删除事实；没有删除事实的未知ID／缺资源不返回GAME_DELETED |

签名密钥只在读取Worker秘密配置中，含key版本；轮换时维持仍需续取的已签凭据策略，不能无说明杀死旧局。读取端不把持有签名当草稿权，保留已下载公开内容不是DRM承诺。VPS发布凭据仅限该R2桶并只驻留受控publisher，不进编辑器浏览器／仓库／日志。绑定技术上可写不等于公开Worker有写API：所有管理／对象写仅VPS受控服务，公开路由不导出R2写能力。

状态、根、目录／公告、准入均不缓存旧最新态；返回no-store并排除CDN负缓存／stale-while-revalidate。不可变资产可在Worker状态门后的内部缓存，缓存键含游戏／release／摘要；浏览器缓存不承诺即时撤销。公开快照分片不能按多个mutable latest请求拼装；客户端保registry generation、revision和入口票据，冲突重新选择。

内置仍走就绪的静态manifest与同一引擎装配；自建仅增加数据驱动目录与取数适配。无需为每个游戏改import／分支。已打开对局固定版本、不热换；下架继续并按原禁存守卫保存；更新仅警告旧版本进度；明确删除按用户确认返回初始页。缺目录／网络故障禁自建新局和读档，但不推断版本不同、清档或终止内置。正式游戏不采用私有Trial认证暂停规则。

## 7. 平台证据与费用边界

本轮只读官方文档，实际云端行为尚未验证：

- [R2 S3 API兼容](https://developers.cloudflare.com/r2/api/s3/api/)列 `PutObject` 条件If-Match／If-None-Match；publisher须实测条件失败、在途请求、初始化及相同body重放，不能从S3名称假设所有AWS特性存在。
- [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)明确条件put失败不写、put／delete强一致；全SHA仍必须自己核，ETag仅作为条件写token，不代内容摘要。
- [R2一致性](https://developers.cloudflare.com/r2/reference/consistency/)区分直连S3／binding与公共域CDN缓存；404／覆盖／删除可能受CDN旧缓存影响，所以不开放桶直连绕过状态门。
- [R2计费](https://developers.cloudflare.com/r2/pricing/)及Worker请求费用按用量／账号方案核算；保历史正式资源会增长容量。不存在因不建Containers就能承诺自建内容永远零费用的结论。静态内置原用量仍独立，不自动升级套餐或新建资源。

VPS CPU／RAM／磁盘上限、生成大图峰值、数据库／文件fsync与云读取费用需测量后配置；本页不批准30s／256MiB／Windows512MiB等实验值为生产SLA。

## 8. 实施切片与验收（全部待授权／执行）

用户最新决定（取代此前环境先行）：先完成编辑器开发（见[功能待办](editor-dev-todo.md)），再说部署的事。V2–V5、sidecar上线、发布验证全部挂起；本节V1本地切片仅作功能开发底座保留，不推进部署动作。

| 切片 | 最小交付与证据 |
| --- | --- |
| V0 只读盘点／合同冻结 | VPS OS／Node／权限／磁盘／现数据、Cloudflare游戏源／可用路由／账号资源；正式资源角色与单调投影协议、提交／可见状态经审阅 |
| V1 容器内Node／SQLite／文件适配 | 镜像内对现权限／DB／blob原语逐项差分；实际容器重启／崩溃、volume fsync／条件创建／CAS／同事务rollback、BLOB与来源／库完整读回；不得直接公开dev工具。已落十片（本地161项）：S1 SQLite端口14项（含savepoint嵌套）、S2真实GameMetadataStore创建／保存／CAS／回放／上架13项、S3认证HTTP登录／会话／改密／管理19项、S4文件桶+真实ImmutableBlobStore／PrivateWriteJournal写入／读验／篡改拒／并发单胜16项、S5真实PrivateDrafts基线暂存→创建→空存→改资→读／编译／收据13项、S6认证sidecar打包（待VPS构建验证）、S7真实CompileJobs入队／回放／认领／心跳／检查点／失败／重试／租约过期／epoch／管线／快照门26项、S8真实GamePortraits上传规范／列表／删除／发布冻结17项、S9真实TrialSessions（41角色真实install→开局→提交→取包→资源→头像→结束）21项、S10文本加载端口+真实PublishedGames／PublishedPacks冻结／上架／匿名取数／替换／下架／腐坏闭锁22项；业务代码复用`server/`，仅换平台端口。S5确认两条生产语义：无改动保存返回当前修订不递增；draft外层事务包games内层（savepoint嵌套，DO同语义）。S6打包（本地已验入口）：`vps/server-main.mjs`+pin镜像`Dockerfile`+`docker-compose.auth.yml`（8788 sidecar，与probe共存）+`auth.env.example`；镜像只含`server/`+`vps/`+`web/src`，密钥走env_file，`USER node`对宿主uid 1000，待VPS构建验证。目录fsync在Linux硬 enforcement，Windows本地仅best-effort（EPERM），以V1容器验证为准 |
| V2 Docker解码隔离＋私有Trial | 实际受限单元内原预算像素对拍，OOM／CPU／wall／坏输出／后代／网络／文件权限；await改密／结束／冲突拒无引用写；VPS同源试玩引擎／资源完整清单、Cloudflare站不可用仍可试玩、两端对应核心SHA一致及引擎双端更新／过渡期准入门、惰性资源、独立profile零正式IDB |
| V3 公开包＋分发 | 只自有数据与mock桶／隔离测试桶：全角色／SHA／大小、草稿不可读、private字段泄漏负控、CAS／失回执／双publisher／每阶段断电／旧代晚到／备份恢复；正式序号／管理态／公告唯一性 |
| V4 读取端＋同引擎 | staging验证目录不缓存旧态、公告实际首次上线时间／失回执／重新上架不置顶、旧局延迟资源、下架／删除差异、签名伪造／换game／换release拒；内置API失败仍可玩、自建目录失败不清档；同引擎匿名App与存档隔离 |
| V5 切换／上线 | 经授权的真实数据导出与双账核验、备份及恢复／删除纪律；停止旧写入口后单权威切换，公开读端先就绪再允许发布。用户另授权资源、安装、域名、迁移及部署，commit／push仍分别批准 |

旧测试只锁其已证切片，不拼成VPS完成；新增入口／依赖／I/O先登记，不执行verify通配、不读DOS SAVE或实际浏览器档。游戏规则／保存／跨模块装配实际改动按项目升级验证；本轮纯文档只查链接、职责、LSP及diff。

### 待提供／批准的信息

设计不等待这些信息，但实施必须核实：VPS系统与内存／磁盘／权限、现有域名和HTTPS方式、是否有真实编辑器存量需迁移、Cloudflare当前游戏部署方式／origin、测试与生产的发布桶／读取Worker授权及预算。**部署边界已确认，具体Outbox可见确认协议、适配实现及任何基础设施变更未批准。**

JPEG源扩容／发布UI整体验收／游戏编辑窗口并发的三项原决策仍保留，不在本方案擅自实现；格式／独立色彩与完整消费者仍按建议暂缓，旧资产冻结不是安全证明。不关闭Q37／Q69／Q70／Q71或完整E-01..11。
