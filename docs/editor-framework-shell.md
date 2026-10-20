# 后台展示层迁移（EDITOR-UI-1至14）

## 授权与范围

用户提出后台登录／个人资料／改密／菜单不应上下堆叠，允许采用轻量框架，游戏有关部分保留原技术；随后明确批准按该规划开始实施。选用 **Vue 3＋Element Plus**，这是Web展示层决定，不是原版机制变更。

首批完成后台外壳与账户页；第二批将创作者账户管理迁为Vue表格／表单；用户随后明确要求使用`/goal`持续推进，第三批迁移游戏／章节草稿及只读当前草稿栏。完整范围与逐项状态见[迁移验收清单](editor-ui-migration-checklist.md)。现有后台页面已逐页组件化，**共同审计及获追加授权的阶段结构GET修复均已完成，但不是完整编辑器产品已完成**。既有地图／据点／武将／草稿／发布／删除能力及准入限制不变。迁移实施期间没有生产操作；用户后继另行授权的提交、推送与受限部署见[journal §33](checkpoint-journal.md#33-后台迁移提交推送与受限上线)。

## 文件与所有权

- `editor-ui/src/Workbench.vue`：侧栏工作台、账户菜单、登出快捷入口与页面装配。`LoginPage.vue`、`AccountPages.vue`分别承载登录及个人资料／改密，保留原生表单的FormData／reset接口，密码不进入响应式树。
- `editor-ui/src/AccountsPanel.vue`：创作者账户表格、创建表单、关键词／状态筛选、状态标签与操作列。使用预编译Vue、Element Plus按钮／标签及语义HTML表格，不额外引入大型表格库。新账户名称和筛选仅为本地输入；所有显示文本经Vue插值，不作HTML执行。
- `editor-ui/src/accounts.js`：不依赖Vue的UI适配器，复用client提供的api、authority及串行work。仅传递白名单账户显示字段，保存查询版本作为操作expectedVersion；不改服务端权限、密码策略、幂等或会话契约。
- `editor-ui/src/DraftPanel.vue`：游戏／修订选择、元数据表单、原操作查询、章节动作、只读资源和Trial入口。`server/public/draft.txt`保留无框架业务控制器，经publish输出显示投影，不再创建或修改DOM。
- `editor-ui/src/main.js`：仅把账户名、角色、认证／强制改密事实、选中模块、忙状态及各页面显示模型映射到响应式树；不保存CSRF、密码、完整编辑源、原请求body或游戏运行对象。
- `server/public/client.txt`：原有会话传输、模块安装与业务调度；显式向壳同步显示事实。后端仍判定鉴权／CSRF／所有权／CAS，隐藏菜单不是权限门。
- `server/public/index.html`：仅工作台挂载点、加载提示、noscript及同源资源；空`#main`容器与DOM岛已移除。各页面DOM与显隐由Vue拥有；地图绘制及下载仍由原生控制器执行。脚本失败保留加载提示，不展示业务面板。
- `server/public/style.css`：仅后台展示。各页使用Vue的hidden门；原生`data-shell-active`双重显隐及无人消费的`#main`样式已退役。
- `server/editorapp.js`：仅新增同源静态资源白名单，Node与workerd共用；API、数据库、发布服务和玩家／Trial壳不变。

导航统一经过离开守卫；草稿未保存或操作未确认仍须原键查询，不自动重发。账户建立／个人资料／密码未提交也会提示；切换页面保留表单实例，登出或会话失效清除账户输入和复制／账户清单显示。强制改密时不显示业务或个人资料，完成后才进入工作台。管理账户、上架与限制、固定库登记各自独立；完整测试复制仅管理员显示。URL片段仅选择页面，不提供权限，也不自动保存／查询／发布。

### 账户页操作边界（EDITOR-UI-2）

- Vue独占`#admin`及其后代；原生`show`跳过该节点，忙状态只通过props传入Vue控件，不再用全局DOM恢复覆盖其禁用条件。该批其余模块曾通过不透明DOM容器接入，UI-12后已无未迁移业务DOM。
- 创建、停用／恢复、重设仍走原有服务接口；管理员行不提供动作，确认前不POST。搜索与筛选只改变显示，不改变目标ID或原查询版本；停用不自动下架内容。
- 版本冲突、写入结果未知或清单读取失败：保留原清单供核对，提示并锁定写入，必须显式重载；不自动重试、覆盖版本或假装操作回滚。创建已被服务确认但后续读失败时清空创建输入，保留读取失败提示，避免把已确认创建伪装成未提交。
- 会话变更清空清单、创建输入和筛选；身份／请求代际挡住迟到读回包。服务端继续判定真正权限、CSRF、账户版本和epoch；此UI门不是服务端替代品。

### 草稿页操作边界（EDITOR-UI-3）

- Vue独占`#draft-editor`后代，菜单显隐及忙门通过props；控制器持有原生fields、身份代际、loaded与attempt，显示投影只包含表单文字、游戏摘要、章ID／缺口、只读四资源及禁用事实。完整source／运行状态不进入响应式树。
- 保存前仍绑定明确已保存修订；失去回包保留原输入／key／body／If-Match，查询与同键重试规则不变。sessionStorage仍只记gameId／revision／key，不存正文或凭据；恢复收据本身不启用编辑，须另行明确读取。清单刷新不切latest。
- 完整校验读回章结构后才安装新显示，异常不半替换旧输入。失效身份不投影私有字段，迟到回包不复活旧上下文；同作者恢复仍可处理原操作。统一beforeunload保留会话失效后的脏数据／未知操作保护，不因当前登录为空而丢失提示。
- 章新增／复制／改名／删除仍调用原章编辑保存接口；原生prompt／confirm保留，取消不POST，动作绑定稳定章ID。Trial同步开等待窗口，再用已保存修订和所选章申请；不隐式保存未提交输入，不改Trial引擎或正式存档。
- 当前草稿栏显示已明确读取／确认的gameId、名称、修订、脏状态与未确认事实；仅恢复收据时提示尚须明确载入。它不是其它模块的自动换目标命令，也不提供权限。已有阶段／素材消费者继续经savedContext读取合法上下文。
- 自有副本清单的跳转在既有串行work内部执行，不再通过一个会因busy拒绝的合成DOM change事件；直接用户选择仍受busy／离开守卫限制，不自动读取草稿。

### 阶段任务页（EDITOR-UI-4）

- `StageJobsPanel.vue`拥有用途、动作、状态及产物列表DOM；`stage.txt`只输出显示投影，业务仍持有六用途关联、原键／body／CAS与服务端回执。下载动作带稳定operationId／assetId，不能因切换用途下载另一任务；实际长度、正文SHA、响应SHA均通过后才建立文件。
- sessionStorage仍仅保留原关联，不保存产物、凭据或源；重载不自动查询／重跑。未知预约以原键原body明确确认，未知命令先GET；会话代际挡迟到响应，改密撤销后旧任务不可运行／下载。统一离开守卫保护未知操作，卸载回收objectURL。
- 10组控制器测试与真实后台任务流程覆盖以上边界；Node模式用实际SQLite／FileBucket及自有HTTPS，workerd模式仍可运行。两者共用业务类，不替代云端证明。

### 阶段结构页（EDITOR-UI-4）

- `StageAssetsPanel.vue`独占只读结构页；`stageassets.txt`保留原六任务上下文、GET、结构校验和请求代际，不再操作DOM。client显式桥接动作、显示投影及pagehide清理。
- 响应式模型仅接收显示文字／字符串列表／禁用事实；不传递原plan、rootKey、凭据或任务操作对象。身份失效不投影旧结果，精确关联变化或pagehide清空显示。清除显示不删SQL／物件，不执行任务或自动查询。
- 原44描述、398库引用、20章／未闭合引用、6报告／缺项和四项false准入校验保持不变；本迁移不改变其正确性依据，不把结构集合当RuntimeManifest。
- 6控制器测试覆盖显式原六ID GET、权限／代际、关联变化、错误不重试和pagehide；隔离壳浏览器38项含空态、有数据文本转义、44／26行及清除无请求。
- **历史缺口已在UI-14获授权修复**：UI-4时旧76cdf28结构身份与现行f4ba804b策略不一致，Node／workerd真实GET500。用户授权后，`sourcecatalogpolicy.js`导出固定`AVAILABLE_LIBRARY_REGISTRY_ID`，结构消费复用同一常量；清单摘要／长度、400角色、权限及资源校验未放宽，旧身份仍拒绝。详细证据以[最终审计](editor-ui-final-audit.md#原功能阻塞的授权修复editor-ui-14)维护。
- 完整真实入口默认要求GET200，最终轮64已通过，含真实六任务、结构44／398／26及内外四项false，并以实际回执重组及测试旧／未知身份拒绝。`--jobs-only`仍是显式局部测试，不能把其`structuralGetChecked:false`称为结构链验证。

### 只读素材库页（EDITOR-UI-5）

- `LibraryPanel.vue`拥有目录、筛选及下载控件；`library.txt`保留原精确修订、398资源／20未闭合引用及固定注册身份校验。响应式树只接收文字／ID／长度／MIME与禁用事实，不接收catalogRoot、sourceDigest、完整回执或二进制。
- 筛选只改变本地可见行；动作使用目录代际＋稳定assetId，拒绝旧目录按钮或任意路径。真正下载仍逐项核正文SHA／长度、响应SHA、原修订、sourceDigest、catalogRoot、admission和固定文件名，不渲染／执行下载内容或授予Runtime资格。
- 上下文／身份／pagehide变化清空显示及筛选、回收URL；迟到成功或失败不得恢复旧会话展示。载入前脏确认保留，取消不请求；操作忙门与最终render由client同步，Vue禁用条件不被原DOM批量解锁覆盖。
- 6组控制器验证含全部响应绑定、陈旧ID、迟到下载与失败；实际Node／SQLite／FileBucket／隔离HTTPS浏览器读398／20目录、筛选原ID下载核SHA，篡改响应root后不建文件，独立作者禁用与改密清理。该实际素材GET成功与UI-4结构GET失败是不同端点，不能相互替代。

### 据点页（EDITOR-UI-6）

- `StrongholdPanel.vue`拥有游戏／章选择、滚动表格及输入；`stronghold.txt`只发布显示投影，私有detail／metadata不进入Vue树。表头固定，槽位是稳定行身份；未命名章显示原章ID，不伪造名字或转换作者文本。
- 沿用既有自有游戏列表、明确清单修订读取、绝对troops／prod值、同记录上限、原章ID／cityIdx与If-Match保存合同；基城192锁定不变，删除检查只展示引用阻止项，不发删除请求。
- render不再重建输入而丢失未保存数值；保存一行后的精确修订重读保留其它脏行。读取／切章／换游戏与共同导航、beforeunload均提示未保存输入。冲突或未知回包保留输入及原查询修订，不自动重试／切latest；确认保存后重读失败则锁写，须显式重读，不能以旧detail继续写新修订。
- 保留本模块原有的单次保存请求方式，不冒充草稿页的持久原键恢复流程；显式刷新会重读自有清单，再读取该清单修订。身份变化清空私有显示，迟到响应不重新安装；该模块保存不偷偷替换草稿页或六任务已选上下文。
- 7组控制器测试与真实Node／SQLite／隔离HTTPS验证192行、越界不POST、脏取消、实际保存读回、实际412输入保留、成功写入丢回包后显式重读及作者隔离；不是扩容或原版机制证明。

### 只读地图页（EDITOR-UI-7）

- `MapPanel.vue`拥有选择、状态、道路描述和Canvas元素生命周期；`mapview.txt`通过非响应式getCanvas引用绘制原生像素。几何、据点、意向及完整草稿回执留在原生控制器，Vue只收游戏标签、当前读取身份、文字列表与禁用事实。
- 原384×256示意、道路颜色、据点坐标、琥珀色意向和红色断路覆盖不变，绘制不修改源或请求API。道路文字仍仅列前200条，绘图不截断。不是游戏地图编辑器，不开放拖动据点、绘路、图块或任意拓扑。
- 显式刷新自有清单后读取清单指定修订；换游戏立即清空旧图／意向，不自动读取。身份／请求代际阻止迟到草稿和意向回包复活旧图；核对回执gameId／revision后才安装。拓扑是独立GET，不冒充该草稿的历史快照；读取失败或绑定异常明确显示“未确认”，不能把缺失当无阻挡或发布许可。
- 7组控制器测试记录Canvas调用；真实Node／SQLite／隔离HTTPS浏览器读取保存4的192据点／254道路和独立意向，核据点像素，点击／离开返回无写入或自动重读，作者空清单与改密清空像素。共享草稿栏／阶段关联仍保留保存1，不自动换目标。

### 固定库登记页（EDITOR-UI-8）

- `CatalogPanel.vue`独占固定库状态、原操作说明和四个动作；`catalog.txt`保留原schema校验、sessionStorage关联和显式空body登记／原键重放。Vue只收文字与禁用事实，原键仍按原界面作为文字供核对，不接收完整op、root、定义摘要或凭据。
- 页面导航与重载不自动GET／POST；必须明确查看当前固定库事实才可新建或重放。registered只是库事实，不能确认原键已执行；只有该次回执通过绑定校验才标确认。目录／账户版本不匹配、损坏或不可写存储均拒绝另起键绕过；放弃只移除本机关联，不取消服务操作。
- 原角色、强制改密、代际及离开守卫保留；pagehide经client统一委派，清除本次视图但保留恢复关联。迟到回包不在新身份下重装状态，非管理员不投影私有文字。服务端仍判定实际权限／epoch／库身份，本批不修复阶段结构的旧库身份合同。
- 6组控制器测试；真实Node／SQLite／隔离HTTPS浏览器验证400角色的实际登记、取消无POST、实际提交后丢回包、离开取消、重载无请求、查事实不确认原键、同键空body重放、只放弃本机关联。

### 武将与势力页（EDITOR-UI-9）

- `GeneralsPanel.vue`拥有游戏／章选择、势力及武将滚动表格、共享画像选择与只读目录；`general.txt`保留无框架控制器、完整回执和原生prompt／confirm。按章显示而非一次堆叠全部章，不改变稳定章ID／槽位；Vue仅收白名单文字／数值和禁用事实。
- 保留改名／字、画像绑定／清除、四种势力动作与128密排删除阻止说明；不新增上传、画像删除、人物增删或游戏机制。目录数量来自实际回执，不再把旧620提示当固定准入。所有作者文本用插值显示。
- 保存仍先读取清单指定的原修订、使用其metadata与原章／槽位发起一次新键请求，再验证清单恰好推进一修订并重读。冲突／未知结果禁止自动重试、偷偷切latest或假称回滚，锁定写入直到明确重读。原生对话框输入是暂态，保留“重读后重做”的原工作流，不冒充草稿页的持久原键恢复。
- 身份／请求代际阻止迟到回包重装私有状态，也在保存前的await后核身份，失效后不再POST。游戏／章／武将／画像动作均按现有稳定身份取原目标，不能靠旧行位置重定向。
- 修复输入转换风险：非整数／空白不能经`Number`变成NaN后在JSON里变成null，从而把无效军师编号误作辞退；null只来自明确`q`。这只是输入防损，不更改服务端任免或槽位规则。
- 8控制器组覆盖全部动作body、取消、原修订、未知／冲突、格式拒绝与代际；真实Node隔离浏览器覆盖128行、实际改名、画像绑定／清除、解散取消、非法编号不POST、实际412锁定／重读、作者隔离与改密后401清理。四种势力动作的规则正确性不是本次UI测试的证明对象。

### 完整测试副本页（EDITOR-UI-10）

- `CopyPanel.vue`独占来源、复制表单、操作状态和自有游戏清单；原client中的DOM业务迁入无框架`editor-ui/src/copy.js`，只投影标签、稳定gameId、输入和禁用事实，不放入来源正文、摘要或凭据。仍使用共同api、串行work和原服务端鉴权／租约／CAS，不改变完整复制策略。
- 仍先明确查看／验证固定来源，预约使用原registryId、名称／简介与新键，执行／取消使用该操作键及已查询rowRevision。sessionStorage保持原用户隔离的单个key格式；重载不自动查询／执行／重建body。丢回包或异常后锁定新预约与命令，显式GET恢复原目标；已完成只代表独立草稿，不代表Trial／发布。
- 原自动清除404追踪改为明确确认；404或`COPY_OPERATION_REVOKED`均不能伪装取消／回滚。确认只移除本地键，不发取消或新建请求。不可写／损坏存储在POST前关闭写入，不再仅警告后继续。未提交字段及未确认／未完成操作接入离开守卫，确认预约后清空输入；身份／pagehide代际拒绝迟到结果。
- 自有游戏动作按原gameId；“测试运行”仍只是跳转草稿选择，不读取、启动Trial或写正式存档。删除入口仍仅打开追踪模块，不替用户执行删除。用户文本用Vue插值，源／复制状态不能反向证明服务权限。
- 9控制器组及真实Node／SQLite／FileBucket／隔离HTTPS浏览器验证实际来源登记、预约／执行成功后丢回包、重载无POST、原键查询、独立保存1、自有草稿跳转、原rowRevision取消及401清理。404／撤销后本地清除的取消／确认分支另由控制器测试覆盖，不冒充物理清理验证。

### 发布管理页（EDITOR-UI-11）

- `PublishPanel.vue`独占游戏选择、名称、版本／公告和操作追踪；`publish.txt`只投影显示字符串、稳定gameId与禁用事实。原tuple、pin、分发回执、凭据和源留在原生控制器，不进入Vue响应式树。仍以原API／服务端权限为准。
- sessionStorage保持原actorId／账户版本／gameId／key／原名称关联，写入后读回核验；重载不自动POST或查询。未知回包先GET，只有明确404且无已确认本地提交才允许用户确认同键／同名称重送；当前输入或游戏选择不改在途目标。失败观察不能把已提交改成失败，停止追踪不取消服务请求。
- 继续区分本地定版、历史分发确认、当前上架；恢复锁不由此页解除。统一身份／请求代际拒绝迟到包，账户版本变更不能重送原请求。未提交名称新增选择／刷新／离开保护，取消保留输入。确认文案撤销旧“已准入旧局持续”的遗留描述，按已批准当前版本唯一政策提示确认更新后旧局停止且禁存；不修改引擎规则。
- 9组控制器及9组隔离API夹具浏览器验证原键／名称恢复、404重送、取消、私有清理、损坏存储和状态区分。另有真实Node共享服务／SQLite／20章编译／自有workerd R2／默认publisher／reader浏览器链：实际提交后丢回包、原操作查询、远端根已写但收据失败仍pending、恢复后确认、新版拒旧票、下架仅拒新准入、删除栅栏410及重开数据库通过。管理／删除在本轮是鉴权API动作，不冒充其UI验证；没有云端、正式玩家App或物理清理结论。

### 上架限制与删除追踪页（EDITOR-UI-12）

- `ManagementPanel.vue`／`DeletionPanel.vue`分别拥有清单、操作按钮与状态；`management.txt`两个原生控制器只投影文字、稳定gameId／rowRevision及禁用事实。行操作回传ID与查询修订，由私有原清单再次定位；旧行或伪造目标不产生请求。没有把原tuple／receipt／distribution对象、凭据或源放进响应式树。
- 保留原actor／版本、永久key、body／If-Match或确认名称／原修订及sessionStorage读回核验。未知操作先明确GET，只有原操作端点明确404且无本地提交回执才允许同键重送；存储失败、版本变化、已知提交均不能绕过。停止本机追踪不取消SQL或分发，恢复锁不可由此页解除。
- 管理员上架／下架限制／解除限制与发布分离；解除仍保持下架。管理员跨作者删除必须先读取目标预览并校验gameId、原修订和准确名称，再明确输入确认；不赋予他人草稿读取／编辑权。柵栏不可逆，但其分发确认不是物理清理证明，不删除玩家本地存档。
- 48管理＋54删除控制器检查保留原全部回执／分发／恢复／异常覆盖，并加显示投影无别名、原ID／修订与取消检查。真实Node／SQLite／自有R2发布链启用三种UI标志，覆盖Vue上架、下架限制、解除限制与管理员跨作者删除，实际提交后丢回包、重载只GET、历史分发确认、旧票拒绝、柵栏410和重启；不是生产云或物理清理验证。

## 构建与分发

版本固定于`editor-ui/package.json`及`package-lock.json`。当前Vue 3.5.44、Element Plus 2.14.7、Vite 6.4.4、Vue插件5.2.4；依赖安装局限该目录。

```bash
npm --prefix editor-ui ci --ignore-scripts
npm --prefix editor-ui run build
npm --prefix editor-ui run check
npm --prefix editor-ui audit
```

`build.mjs`生成并追踪以下资源，服务端只导入文本，无运行时npm安装：

| 文件 | 同源地址 |
| --- | --- |
| `server/public/shell-ui.txt` | `/shell-ui.js` |
| `server/public/shell-ui.css` | `/shell-ui.css` |
| `server/public/shell-ui-licenses.txt` | `/shell-ui-licenses.txt` |

构建按实际输出模块收集完整上游许可证；构建产物固定LF，`check`重新构建并逐字节比较，不覆写。Vue模板在构建时编译，浏览器不使用模板编译器／eval，不依赖CDN；保持既有`script-src 'self'; style-src 'self'`，没有unsafe-inline或unsafe-eval。第三方资源见[许可说明](../THIRD_PARTY_NOTICES.md)。

只有修改后台程序才构建／交付上述资源；编辑游戏、保存草稿、发布内容仍是数据操作。没有改玩家静态部署、Trial资源束、共同编译核心或生产维护门。后续部署必须一起交付HTML、client、样式、三份生成物与网关接线，仍须独立授权；不能只替换HTML。

## 验证入口与边界

```bash
node tools/verify_editor_shell.mjs
node --test tools/verify_editor_accounts.mjs tools/verify_editor_draft_controller.mjs tools/verify_editor_stage_assets_controller.mjs tools/verify_editor_stage_jobs_controller.mjs tools/verify_editor_library_controller.mjs tools/verify_stronghold_ui_model.mjs tools/verify_mapview_topology_model.mjs tools/verify_editor_catalog_controller.mjs tools/verify_generals_conflict_model.mjs tools/verify_editor_copy_controller.mjs tools/verify_publish_ui_model.mjs
node tools/verify_editor_workbench_browser.mjs
node tools/verify_publication_ui_browser.mjs
node tools/verify_management_distribution_ui.mjs
node tools/verify_deletion_ui.mjs
node tools/verify_publication_chain_browser.mjs --node-service --management-ui --deletion-ui --admin-deletion-ui
node tools/verify_vps_editor_server.mjs
node tools/verify_vps_editor_server.mjs --frozen-publication
# 已有真实workerd／SQLite／隔离HTTPS账户流程（端口须空闲且可监听）：
# PLAYWRIGHT_MODULE=<已安装的Playwright模块> EDITOR_TEST_PORT=18787 \
#   node tools/verify_editor_backend_browser.mjs <新的.dragon-analysis输出目录>
# 阶段任务：设置PLAYWRIGHT_MODULE、EDITOR_TEST_PORT；Node模式另设EDITOR_TEST_NODE=1。
# node tools/verify_editor_backend_stage_ui.mjs <新整数轮次> --jobs-only
# 仅跑真实武将流程（同一服务与隔离边界，不重复六用途任务）：
# node tools/verify_editor_backend_stage_ui.mjs <新整数轮次> --generals-only
# 仅跑真实完整副本流程：
# node tools/verify_editor_backend_stage_ui.mjs <新整数轮次> --copy-only
# 去掉上述范围选项即包含真实结构GET；UI-14轮64已通过完整combined链。
# 真实草稿回包丢失／冲突／恢复流程（同样设置PLAYWRIGHT_MODULE、EDITOR_TEST_PORT）：
# node tools/verify_editor_backend_draft_ui.mjs .dragon-analysis/editor-phase/backend-draft-ui-session-r1/ui-r<新轮次>.png
```

- 静态壳矩阵保留原覆盖，更新为共同`editorapp.js`而非已退化为适配器的`worker.js`，删除确认查实际management模块，不拿旧文件位置冒失败。
- 账户适配器内存测试：显示字段投影、权限门、原ID／版本、取消、冲突锁定、无自动重试、已确认创建后的读失败、清单格式拒绝、会话切换迟到包与串行写入；不替代服务端验证。
- 新浏览器入口：真实静态网关／CSP、全新隔离context、显式API夹具；登录、强制改密、单模块、角色菜单、个人资料、回退、脏离开取消、保存409输入保留、登出清理和会话失效；第二批加账户表格、HTML文本转义、筛选后的目标ID／版本、冲突锁定与重载、取消操作、创建脏离开和输入清理。不是服务端鉴权证明。
- HTTP回归：自有SQLite／文件桶，分别核普通及冻结发布模式、静态资源、CSRF、会话epoch、密码／账户、重启持久化；真实workerd浏览器另核账户创建／停用／恢复／重设、CAS与持久重启。
- 不读写真实SAVE.DAT、用户profile或正式IndexedDB。UI-11已补上述发布链；没有运行正式玩家App／完整地图编辑或游戏战役回归，不能据后台局部检查声称这些功能已经完成。

草稿控制器另测原输入／原键、原修订、收据恢复、迟到响应、失效身份、章动作及Trial窗口回执。隔离浏览器增补四种章操作、文本转义、取消、脏选择恢复和失效会话的beforeunload；真实workerd／SQLite／R2浏览器验证实际保存后丢包、跨页CAS冲突、同键重试、无正文恢复、实际改密撤销及独立作者不可见。章节按钮夹具不冒充原版初始化机制或完整Trial引擎验收。

实际结果、失败轮、LSP限制和未提交状态见[首批journal](checkpoint-journal.md#19-后台框架壳editor-ui-1)、[账户管理journal](checkpoint-journal.md#20-账户管理组件化editor-ui-2)、[草稿journal](checkpoint-journal.md#21-草稿与章节组件化editor-ui-3)、[阶段journal](checkpoint-journal.md#22-阶段任务与结构展示editor-ui-4)及[素材库journal](checkpoint-journal.md#23-只读素材库组件化editor-ui-5)。最终管理／删除结果见[journal UI-12](checkpoint-journal.md#30-上架限制与删除追踪组件化editor-ui-12)。共同收尾、逐项证据及唯一功能回归阻塞见[最终审计](editor-ui-final-audit.md)。不能借壳迁移新增游戏规则或放宽准入；原阶段结构功能阻塞已按追加授权闭合；迁移完成范围不包含未授权产品功能；后续部署按单独授权执行，不解除生产维护门。
