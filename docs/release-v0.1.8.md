# v0.1.8 发布审阅

## 范围与纳入决定

用户明确授权审查全部已改动／未跟踪文件，保留产品代码、测试、迁移及必要文档，创建完整提交与Release并推送。审阅基点`main@61dbf2f`，远端GitHub main同SHA；最新既有Release为`v0.1.7`，新标签使用`v0.1.8`，不改写历史标签、不推Gitea。

起始工作区76个M标记逐一按Git路径过滤后的blob核对：**12项实际差异、64项与HEAD相同、0项未忽略未跟踪文件**。无实际差异项不重写、不reset／renormalize；没有新增SQL迁移，已跟踪的产品、测试及迁移材料保留于完整提交树。

| 类别 | 纳入与审查结论 |
| --- | --- |
| `web/src/game/clock.js` | 唯一新增运行行为差异：五档6.5／5.0／4.8／1.8／1.0ms，RAF预算8→16；原证时基常量保留，规则算法、RNG、hold和战术速度未改 |
| 五个`tools/verify_*`既有入口 | clock-transition／clock-browser／march-markers-browser／engagement-browser／weather-browser；预算断言引用当前常量，接战核实际倒数相位而非强制显示四相；声音序号与5/3次断言保留 |
| `server/public/trialweb.txt` | 保留：实际服务端程序束，不是临时产物；230条逐源码文本／长度／SHA核对，仅clock条目变化，两壳无变化 |
| AGENTS、journal及三份时序／行军／内核文档 | 保留现行合同、原证／产品差异与接续状态；删除过时重复流水，保留引用锚点 |
| VERSION、README、CHANGELOG、本文件 | 补齐0.1.8版本和Release范围，共16项实际提交文件 |

排除且不删除：`.pi/`、`.codegraph/`、`.dragon-analysis/`、`.dragon-runtime/`、`.playwright-cli/`、`.wrangler/`、缓存、运行数据库／profile、日志／截图、秘密配置及`dist/`。仓库外`.agents/skills/`不强行入库；时序合同已有仓库内维护源。既有Jev可选工具／mock测试不是本地代理运行产物，不删除它们。不上传临时测试报告或另打包原素材附件；Release沿用GitHub源码归档。

## 相对v0.1.7的产品摘要

- 战略外循环、槽轮询、接战音画、云雨对象、日期季节／音乐已按原证分离规则与表现；修复月结消息返回前提前进day1，大小地图共用只读行军插值。现行提速是用户批准的Web选择，不宣称DOS毫秒等价。
- 统一游戏选择／公告，军师输入在加载期间保持可见；纳入已提交的当前版本唯一政策、共同Node／workerd发布接线和程序绑定资源。
- 原三倍速、固定接战节拍和初始重构8步预算均为历史策略，不能混用于当前验证。完整历史实现／原证见[战略时序](re-notes-strategic-time.md)，发布主线缺口见[journal§6](checkpoint-journal.md#6-发布主线阻塞与下一步)。

## 本次实际验证

- `node tools/verify_clock_transition.mjs`：原时基字节断言、玩家／生成Trial五档、30/60/144Hz预算、变速／hold／月结返回通过。
- `node tools/verify_editor_trial_rule_boundaries.mjs`：82检查、8负控，正式IndexedDB访问0。
- `node --test`显式运行native-road、native-weather、slot-phase、slot-battle、slot-continuation五入口：53项通过，0失败。预期fail-closed负控日志未删除或当作产品失败。
- 五个实际隔离浏览器入口clock／march-markers／engagement／weather／seasons重新通过：真实App与生成Trial、7组原生行军、3个DPR、五档双周期接战声音、云八帧／灾害像素、季节24阶段、月结FIFO及只读检查。
- Trial束重建`unchanged:true`，SHA256=`0078c20d726d722c5ffba20c439c71c136bbb1efd73a0d79f369dc924f013191`；全部230条与源码一致，仅clock相对HEAD变更。
- 审阅脚本首次因Windows默认GBK读取程序束失败，改为显式UTF-8后完整核验通过；未改产品数据或放宽摘要断言。变更文件秘密标记扫描无匹配，不是通用安全认证。
- 6个变更JS/MJS语法、156处本地文档链接／锚点及diff检查通过；14个支持路径主动LSP均clean，session缓存520文件无error／warning（不是全工作区重扫）。README／新发布文档首次工具未就绪，后续主动探测已确认clean。提交前另核暂存清单，远端结果以实际分支、标签与Release状态为准。

## 限制与发布边界

本次是**代码发布，不是生产上线／全战役认证**。原生行军夹具隔离城市／日结／外交泵；预算翻倍不保证全部设备实际翻倍，高速显示可跳过中间相位而不补播。没有访问真实DOS存档、用户profile、生产数据库或发布桶。

新版本唯一政策的完整发布链复验、全局物理回收、作者空白章／同引擎准入及生产装配仍未闭合；历史后端重lane未在本次全量重跑。最后实测registry为`REGISTRY_EMPTY`，VPS连接信息仍缺，详见[VPS就绪审计](vps-editor-readiness.md)。

推送只针对GitHub main和新标签；既有Cloudflare Builds可能自动触发，本次不改云配置、不手工部署，也不把push或Release成功写成线上可用证明。
