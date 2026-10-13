# PORTRAIT-UI-FIX-1：头像 UI 小闭环与当前源码聚焦验证

用户在[状态审计](editor-closeout-audit.md)后要求「按建议执行」。本批修 workerd 武将节的独立 UI 缺陷，并补当前 SHA 的聚焦验证；不改 DOS 规则、固定槽、认证权限或原头像 byte，不将本批称为 Q37／完整编辑器收口。HEAD 仍 `98f0630`，本地未提交／推送／部署，保留前轮文档改动。

## 实现与产品边界

产品来源：[产品§4.3](game-editor-design.md)、[journal](checkpoint-journal.md)记录的用户2026-10-09后续裁决；JPG/PNG源文件≤100KiB，源尺寸不限（128为建议），裁剪后规范输出128 PNG、运行显示64。不新增容量／原版机制结论。

| 范围 | 当前实现／位置 | 聚焦证据 |
| --- | --- | --- |
| 清除绑定 | `server/public/general.txt`：已有绑定提交 `portraitKey:null`；只有新增绑定的取消／空输入早退，trim编号 | 实际DOM按钮生成清除payload、旧revision，夹具保存后按钮刷新；取消／空输入无POST，失败保绑定 |
| 源检查／裁剪 | 同文件及 `index.html`：PNG/JPEG MIME、非空、≤100KiB先于Image；方形边长及左右／上下位移可调，不拉伸；必须明确确认 | 真256×128红蓝PNG默认居中及可调全蓝裁剪、真32×64JPEG；输出128×128全蓝像素、100KiB边界接受，过大／空／GIF先拒，坏PNG无ready |
| 代次／上下文 | 选图、切游戏／刷新／身份变化撤销预览与ObjectURL；Image回调、toBlob返回及arrayBuffer返回核File／游戏／identity／确认代次 | pending／空canvas无上传，A→B迟到及身份丢失不绘制，编码中退出／切游戏无POST；全部自有ObjectURL释放 |
| 上传／库 | 规范PNG非空／≤100KiB后才POST；裁剪变更撤确认；游戏下拉更新selected；库响应晚到核身份／游戏 | null／空／过大输出无POST，修改裁剪须再确认，切游戏清预览并读正确名册 |

只有 `server/public/general.txt`、`server/public/index.html` 改生产代码；未改 `web/src`，无需重卷 Trial 束／消费者 pin。另新增一个浏览器工具，并修一个既有道路测试的合成输入（见下）。库/API／草稿writer及运行时头像覆盖未改。

## 本批实际验证（各自范围，不拼完整链）

新工具/I/O 已先登记于[本地验证清单](editor-local-validation.md)。新scope `.dragon-analysis/editor-phase/portrait-ui-fix-r1/` 保留执行前源码、各attempt日志／退出状态、最终SHA；不覆盖旧密封lane。

| 当前入口 | 结果 | 限度 |
| --- | --- | --- |
| `node tools/verify_editor_portrait_ui_browser.mjs` | 最终attempt3，16项通过 | 实际HTML／general模块、全新Chromium／自有loopback，API／会话是内存夹具；不是workerd认证／真实草稿存储／发布链。真浏览器PNG/JPEG和像素检查，IDB0，console/page/outside0 |
| `node tools/verify_editor_shell.mjs` | 69通过 | 当前静态壳矩阵，不冒live浏览器69项 |
| `node tools/verify_game_portraits.mjs` | 15通过 | 内存SQLite，原header-only合同；假头正例不证明图片可解码 |
| `node tools/verify_workerd_parity.mjs` | 20通过 | 静态对等路由／顺序，不冒本次workerd全链 |
| `node tools/editor_server.mjs` | 自有temp自检通过 | 本地copy/save/validate/compile/头像绑定清除/publish，不用实际用户存档 |
| `node --test tools/verify_native_road_arrival.mjs` | 首轮30/31；只修夹具后31/31 | 生产native表未改，原期望不变；不是全战役证书 |
| `node --test tools/verify_native_road_movement.mjs` | 32/32 | 此入口才是历史road32/0，合成bytes＋四严格mock URL，无forward |

首browser attempt1为15项；attempt2增加边界／迟到断言为16项。随后代码审阅发现初始range max为0会钳掉居中偏移，已先设max再设value，新增默认中心／两端像素断言后最终attempt3再跑通过。旧pass不冒最终源码。一次attempt3父Python路径转义语法失败发生在任何child／写入前，记录保留；仅改父收集器为Path.as_posix，测试预算和产品期望不变。

arrival失败位置为原 `tools/verify_native_road_arrival.mjs:572`：测试替换 `sc.diplomacy` 全数组并设row22/col8，但 `nativeDiplomacyAt` 读 `nativeDiplomacyMatrix.rows`；实际设定未生效，断言1≠2。现用已有 `writeNativeDiplomacyAt` 写固定cell并读回，核公开prefix长度不变，原低／高分支及状态、目标、占格期望保留。来源是 `nativediplomacy.js` 的工程单权威合同，不是本批新逆向公式。原失败日志／测试源码保留，不删失败，不改RNG或生产fallback。

语法检查：general按ES Module stdin、两工具 `node --check` 通过。主动LSP及session-all已执行：arrival保留9条原有风格warning（JSON真实往返及嵌套条件）／Scenario动态属性提示；本批不为消风格提示改变夹具语义。文档保留既有SQL引文／摘要拼写info，无error；`.txt` 无配置LSP，push-only不确认clean的路径如实列未确认，非全clean。文档链接／表格／73行唯一编号／乱码与HEAD比较／diff核查见最终报告。本批不外发第三方资产／凭据、不fetch或修改配置；Jev仅小范围文字preview，未外发且不作为通过证据。

## 仍未完成与下一边界

1. **服务端安全处理未完成**：`GamePortraits`及Trial上传仍只读magic／头，不满足工程§6的隔离解码、静态／动画／多态拒绝、像素预算及重编码去EXIF。已有 `server/pngio.js` 是受限非交错8位／indexed PNG adapter，拒部分metadata／动画，**不提供JPEG解码，也没有接入头像两端口**。不能用浏览器预览或PNG适配器的旧成绩代服务端完整合同；后续需先确定适合workerd的受限安全PNG/JPEG处理接缝，不静默拒产品允许的JPG，不擅加依赖或改变部署。
2. **当轮运行时身份缺口（历史）**：全局byte覆盖曾使同byte不同key冲突；后继[PORTRAIT-IDENTITY-1](editor-portrait-identity.md)改为所属world／章实体绑定，实际消费者聚焦浏览器22项通过，不追认本UI批为运行时证据。完整消费者／workerd组合验收仍缺；两批均不改255语义或造补图。
3. **当轮未跑workerd整链（历史）**；后继[PORTRAIT-WORKERD-1](editor-portrait-workerd.md)补真实上传／保存／发布API／匿名App串行14项，不是完整发布UI或同时游玩／保存传输证书。B4e/BOOT-1和本批原收据保留当轮身份，不追认全部Q37/Q69/Q70/Q71或lint后战术20项通过。
