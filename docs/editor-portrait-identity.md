# PORTRAIT-IDENTITY-1：运行时头像身份隔离

用户「继续下一步」授权后的独立工程切片，承接[头像UI修正](editor-portrait-ui-fix.md)。这是Q37表现资源身份修正，不是新原版机制结论，也不是完整编辑器／Q69/Q70/Q71验收。未提交／推送／部署，保留此前未提交改动。

## 实现与边界

- `core/assets.js`：撤销进程全局portrait byte→URL覆盖。用WeakMap让每个world持有捕获章节的实体idx→`{portrait,portraitKey,url}`；复制Map并冻结条目，不接受同world重新绑定。未绑定人物／普通数字头像仍走原kao路径；不改原byte、规则字段或255语义，不造补图。这里的idx是当前固定章节实体槽，不是已经放行跨章重排的稳定ID。
- `content/authoring/trialruntime.js`：创建world后绑定该pack的章资源；另一个环境或失败启动不清除已有world绑定。既有Trial／persistent共用入口不变，未增加IDB或认证能力。
- `GameBar`：人物传对象和所属world；军团优先现有generalIdx，旧无idx表示保留按名回落。君主／军团图片缓存改以解析后URL为键，晚图片返回先核scenario、world和当前URL，再写本地图片。五处原FF上传例外改为实体局部判定，不扩大FF规则。
- `StartMenu`：不再用byte-only菜单缓存，走已解析URL的共同加载缓存。
- `HUD`：人物／军师DOM图片使用同步`portraitURL`，不把Promise当src；君主卡使用对象身份。
- `BattleView`：用原retained speaker.slot和portrait解析所属world绑定，不取commander/generalIdx或现场姓名，不改capture、Session、VM、消息、计时和RNG。

成功图片缓存仍以不可变URL复用，失败promise清除；这不是权限凭据或远程擦除。上述接线不证明所有模态异步换场／注销组合或所有人物消费域已完整认证。

## 当前聚焦验证

入口与I/O先登记于[本地验证清单](editor-local-validation.md)。本机scope `.dragon-analysis/editor-phase/portrait-identity-r1/` 保存执行前源码、当前输入、逐轮日志和退出状态；不覆盖旧密封链。新浏览器工具只使用实际模块、合成编译pack、自有loopback白名单HTTP、全新Chromium／内存profile和IDB spy，不接真实账户或用户档案。

| 入口／收据 | 实际结果 | 覆盖／限制 |
| --- | --- | --- |
| `verify_portrait_identity_browser.mjs`／`browser-final` | 22项，status 0，IDB调用0，errors/outside空 | 同byte两个实体／两个world、共享一个asset、未绑定及内置数字回落、错误byte/key不覆盖、捕获副本不别名、失败启动不清已有绑定、真128×128 PNG全部RGBA、实际GameBar卡／消息／军团／君主缓存、StartMenu、HUD编成／确认／君主卡、BattleView retained slot、FF局部例外、禁止重绑、迟到图片不写新world |
| `verify_editor_backend_library_policy.mjs`／`library-policy-r2` | 400角色、10负例、getter 0，status 0 | 当前全部20个programHashes逐核；原报告`programFingerprints:19`是旧硬编码显示值，不作实际表基数。非实际SQL/R2登记或完整runtime准入 |
| `verify_battle_dialogue_presentation.mjs`／`dialogue` | 原完整断言通过，status 0 | fake DOM/Image/fetch，真实VM／Session／RNG与snapshot端点表现回归；非完整战役 |
| `verify_editor_portrait_ui_browser.mjs`／`ui-compat` | 16项，status 0 | 前批真实HTML/general模块、内存API/session夹具，不冒workerd认证 |
| `editor_server.mjs`／`self-check` | 自有temp自检OK，status 0 | copy/save/validate/compile/escape/refusals/publish；非互联网部署 |
| `build_trial_web_bundle.mjs`／`build`；八文件语法／`syntax` | status 0；217文件束 | 三份既有generated txt，playapp/trialapp壳内容不变；六src、policy和新浏览器工具语法通过 |

首浏览器18项通过后，仅加强新工具的像素／消费者断言，再全新22项；不把首轮当最终工具SHA。首父脚本路径语法错误发生在写入／child前，原件登记，只修父收集器。首policy失败来自既有main指纹漂移，详见下节，失败收据保留。

## 消费者pin与历史缺口

六个src改动中五个在原20程序指纹表内（startmenu原不在表，不新增基数）。首次升级五pin后，policy实际拒绝旧main pin：`c776e1f1…`不等当前`89741bcc…`。已核当前main原字节等于HEAD、初次输入捕获及before束内main，历史persistent接线早于本批；**本批没有改main.js**。仅额外纠正其pin，最终共六pin更新，资源398条、support/profile及20条未闭合G127/255登记不变。

- 当前available-library SHA／policy manifestDigest：`4031b32dcf5d04f966bfc174bd8dea62051e67653e7f71193ef88275a71ad4db`（93632字节）。
- 当前trialweb束SHA：`7da93227d083b11af143a4c2e27a8814f0f9007cec80f33d9c1e2141d48a1f7b`，217文件。
- 新工具SHA：`d42e61a4152c5ecede4d134a1d3b16787700c454cbd55540726a6d49dcfd0b80`。

（D/F 后 superseded，上文为历史封存：库 manifest 现 `c89cb0c99ec2b3dd13900c35c2882f26799eadef074d7d2d4811c2d8059291f2`（93632字节不变），trialweb 束现 `6f864b71df7f868c3db4bf89ffe2a9d6231cbf7ea1fc077bff96fa2c68ecd1f9`，`servertrialapp.js` 现 `0386710c4fe4ed163437da27ae97fcb3de3b96e898f591e1e18c5770dc635559`；见[库存 D 后重签节](editor-trial-asset-inventory.md)与[本地验证](editor-local-validation.md) TRIAL-APP-BOOT-1。）

旧安装注册表不能直接冒当前policy；后续真实lane须显式按新pin重stage／重新登记。本批没有改真实R2／数据库或部署，不追认旧native/browser链为当前束通过。

## 诊断与交付核对

最终七代码路径主动LSP为5 clean／2 findings（6条）；八文档为5 clean／3 findings（22条既有拼写info）。gamebar单独探测仍超过本工具5000行扫描上限，不计clean；先前push-only路径已主动复核。trialruntime保留旧spread提示，startmenu保留既有导航open-redirect error及硬编码URL warning／拼写提示；session-all共25路径含1 error、10 warning、136 hint/info（包括前批arrival）。导航语句在before与当前一致，不通过忽略规则、改权限或借本批修改无关导航来消告警。最终诊断／链接／表格／Q1–Q73唯一性、diff及源码／收据SHA核对登记于scope最终报告。

Jev仅发送人工审过的最小工程文字，未发源码／资源／日志／凭据；服务返回HTTP451地区限制，未绕过，**不是通过**，不代替权威验证。

## 仍未完成

1. GamePortraits／Trial上传的服务端安全解码、PNG/JPEG静态／动画／多态拒绝、像素预算和重编码去元信息；现magic/header-only不能满足工程§6。
2. 当轮合成`persistent:true`不是真实IDB运行或发布证明；后继[PORTRAIT-WORKERD-1](editor-portrait-workerd.md)补真实上传／绑定保存／发布API／匿名App串行14项，原22项不追认认证。仍缺发布UI、同时游玩／保存与完整消费者／真实撤销／迟到／窗口组合。
3. G127前史、原人物reader完整消费域及槽／初始化门；本批不以资源身份工程补原机制。Q37/Q69/Q70/Q71整体仍open，其它真实剩余见[逐项索引](editor-requirements-matrix.md)。
