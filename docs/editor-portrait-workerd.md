# PORTRAIT-WORKERD-1：真实头像上传／保存／发布／匿名运行链

用户「继续」授权的独立工程接续，承接[UI修正](editor-portrait-ui-fix.md)与[运行时身份](editor-portrait-identity.md)。本批取得本机真实workerd／SQLite／R2／Chromium串行功能链，不是完整Q37、图片安全、Q69/Q70/Q71或线上部署验收。保留此前未提交改动，未commit/push/deploy/fetch。

## 必要接线修正（Web工程，非原版机制）

- `server/public/index.html`：据点／武将／地图／复制节移出隐藏的账户管理父容器。`client.txt`在各子模块render之后重新应用当前菜单视图，避免渲染把其它业务节重新展开；游戏列表撤未定义的`isBusy()`，保留上架限制／删除业务禁用和`run()`并发门。
- `general.txt`：库按钮可能在busy期间新建，不属于壳最初控件快照；render时按当前busy重设这些按钮，操作完成后可正常点击。
- `worker.js`管理CSP仅增加`img-src 'self' blob:`支持本地选图预览；不开放remote/data图片、脚本或eval。Trial CSP未放宽。
- `/api/play/web/`除既有引擎束外，按当前398项可用库路径白名单读取共同资产，复用`trialRegistryBytes`完整长度／SHA及注册表门。文档base前缀下的季图只复用既有八角色精确门，不开放源JSON／草稿／任意R2路径；未知路径404，未知query422，原单一image bust白名单保持。
- `build_trial_web_bundle.mjs`为generated play壳增加固定`<base href="/api/play/web/">`，让fetch/Image的document-relative路径指向匿名资源入口。仅`/play` HTML允许`base-uri 'self'`，管理／Trial仍为`none`；script仍self-only。本批未改web/src、规则、RNG、头像byte、认证提交门或真实部署配置。

引擎束217文件／库manifest与前批相同，只有play壳生成内容变化。无公共根目录回落或复制第二套引擎。

## 当轮真实链与聚焦回归

入口和I/O先登记于[本地验证清单](editor-local-validation.md)。准备使用原source／library stager全指纹门，41来源角色及400库角色新装配到自有临时R2；真实API改密、安装、完整复制，不写SQL伪造成功、不复用旧lane。编辑页和匿名页使用两个全新context，匿名页存档只属于自有profile，编辑页IDB spy为0；不用用户profile或DOS存档。

最终scope `.dragon-analysis/editor-phase/portrait-workerd-attempt11/`，父scope `portrait-workerd-parent-r1/`保存before、854项逐轮输入快照、日志／退出状态及最终审计；不是完整动态I/O图或全部consumer认证。builder不在该浏览器入口的854项清单，生成重建后另捕获，不冒执行前pin。整链父预算1800秒，阶段180秒／HTTPS300秒。初900秒临时父预算超时仅保partial，不追认成功。

| 入口／收据 | 当前结果 | 覆盖与限制 |
| --- | --- | --- |
| `verify_workerd_portrait_browser.mjs portrait-workerd-attempt11` | 14项，status0，1138.87秒；21 Node控制HTTP、385浏览器响应记录 | 实际管理菜单／游戏清单；两张256×128 PNG裁剪确认→规范128上传；upper-1的G7/G93同原byte7分别绑定First/Second，保存修订3；真实发布API与匿名包／资源SHA；在用删除409；UI清除G7保存修订4、等目标行刷新及busy结束；随后匿名App运行固定修订3，两实体不同URL全部128×128 RGBA正确 |
| `verify_workerd_portrait_browser.mjs portrait-workerd-attempt12`（HEAD 重绿） | 14项同名全过，status0，1133秒 | 与 attempt11 同链同断言，在 A–H（含 D 壳 UI／F 库重签）之后当前 SHA 重跑，无静默漂移；TLS CERTIFICATE_UNKNOWN 为既往 miniflare 噪声（浏览器侧探针），非失败，385+响应结构同旧轮。仍不冒并发／发布 UI／完整消费者。 |
| 同轮错误门 | pageErrors／failedRequests／outside均空，未分类console空，编辑IDB0 | console仅精确分类预登录session401和在用删除409；不吞任意401/409或超时。匿名实际App／资源方法有证，非全战役／战术／存档恢复或所有人物模态组合 |
| `verify_editor_shell.mjs`／`shell-final` | 静态69，status0 | 源码壳矩阵，不冒69项live |
| `verify_workerd_parity.mjs`／`parity-final` | 静态20，status0 | 原对等路由／顺序，非完整权限或竞态矩阵 |
| `verify_editor_portrait_ui_browser.mjs`／`ui-final` | 16项，status0，IDB/errors/outside0 | 当前真实HTML/general模块，内存API／session夹具，保前批裁剪／代次／拒绝断言 |
| `editor_server.mjs`／`self-check-final` | 自有temp自检OK，status0 | copy/save/validate/compile/escape/refusals/publish；非部署 |
| `build_trial_web_bundle.mjs`／`build-final`与`syntax-final` | 217文件，重建三txt字节完全不变；五文件语法通过 | worker／builder／新tool的node检查，client/general按ESM stdin；生成束／Trial壳未改变 |

发布仍使用现有`/api/publish` API，**当前工作台没有发布按钮**，不称全程UI。链只证管理员作为该副本owner；完整普通作者／跨作者权限矩阵另列。

## 失败原件与可信边界

1. attempt1实捕隐藏admin父容器；attempt2实捕blob预览被管理CSP拦截；两者修必要接线，不绕过真实UI。
2. attempt3库列表30秒等待超时；完整引用读取已知耗时45秒以上，改有界180秒等待。attempt4/5临时900秒父预算超时，无终态，只保partial；未据partial拼绿、未杀他人Chrome／Node。
3. attempt6/7逐步实捕匿名共享资产／document base／季图前缀缺口并修上述路径；attempt8在用删除的完整引用读取超30秒，改同180秒阶段等待，不改拒绝期望。
4. attempt9同时匿名游戏装配与编辑保存发生资源超时／不完整chunk，终错误门拒绝，原件保留；**并发传输根因仍UNKNOWN，本批不证SDK修复或并发稳定**。
5. attempt10虽13检查已达，`/api/games`超时仍被错误门拒。直接审阅发现clear等待匹配任意章节同idx原图，可能提前进入后续重读／装配；只修新harness为目标人物行刷新且busy结束后继续。attempt11从全新R2／DB／浏览器重跑完整串行链，旧13项不追认为UI正确或最终SHA。
6. 两次初父收集器资源字典／目录过滤错误及一次PowerShell查询转义错误仅影响收集器，原件保留；没有通过改产品期望、忽略错误或重写失败来收口。最终只读collector首轮误把builder算作原854清单成员而拒绝；核实遗漏后单列其捕获时点，并更正UI报告字段名为pins，不重跑或追认游戏成绩。自签HTTPS预握手证书日志单列环境观测，不当页面错误或SDK根因证明。

## 当轮源码SHA与诊断

| 文件 | SHA-256 |
| --- | --- |
| `server/worker.js` | `31a4cbc65f2f432654e9725d11fc5ff97200d4f07bd21e1c048c7958502f74eb` |
| `server/public/index.html` | `437cd04fdad605ce219fa84edd94cd3fb4548f751a7d9165ca3b1540f9a9cecb` |
| `server/public/client.txt` | `317ff649ced005346050fc1eae3d26411a60e6f5c28adb232a03233683ed94ab` |
| `server/public/general.txt` | `84636441a3ac70bad268561fb3de7777b387ddfca8c946787c0fe009e4b056c9` |
| `tools/build_trial_web_bundle.mjs` | `4373417f2ce470d2a13862c6f15fb6664924f621b990e861d74e98091ddb805a` |
| `tools/verify_workerd_portrait_browser.mjs` | `9cc4b0f2c4369137be54e4ca25b4f78d53e1accd8b5baed88e1a65941678aef8` |
| `server/public/playapp.txt` | `515019f2fc5ac16bb4f0efb238f586a0840a325db57a66fb78c4a48bb7f00ffe` |

束仍`7da93227…`，库manifest仍`4031b32d…`，Trial壳仍`a456d356…`（D/F 后 superseded，此句为历史封存：现值束 `6f864b71…`／库 `c89cb0c9…`／壳 `0386710c…`，见[本地验证](editor-local-validation.md) TRIAL-APP-BOOT-1；旧 tool 不重跑。）最终输入／收据／文档hash、链接／表格／编号／diff与主动LSP及session-all见父scope最终报告。LSP不是全clean：txt无server，push-only不保证clean，新tool保留一个flag-argument风格warning及await括号提示；既有startmenu导航error／GameBar扫描上限不借本批关闭。Jev前批HTTP451地区限制尚无解除证据，本批不绕过或重复联网，不作advisory通过。

## 仍未完成

- 当轮服务端为magic/header-only；后继[PNG](editor-portrait-png-safety.md)／[JPEG](editor-portrait-jpeg-safety.md)已接有界解码／规范PNG，后继[当前SHA真实链](editor-portrait-workerd-safety.md)17项重验原JPEG公开API及发布／匿名App。本页14项和旧tool SHA保历史，不重签完整图片安全／工程§6。
- 同时游玩／编辑保存的传输、完整发布UI、全部消费者／真实撤销／窗口／迟到组合；正式版本／旧局／存档恢复与公告合同。
- Q37/Q69/Q70/Q71整体及原槽／初始化／新拓扑／容量门。真实剩余见[逐项索引](editor-requirements-matrix.md)，本批串行成功不替它们或GameBar native全图／SDK502独立lane。
