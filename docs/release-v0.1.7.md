# v0.1.7 发布审阅

## 范围与纳入原则

用户授权：审查全部已改动及未跟踪文件，保留产品代码、测试、迁移和必要文档，完整提交，合并 `main`，创建 GitHub Release 并推送；**不推送 Gitea `origin`**。追加要求更新 README 的编辑器说明。

起点为 `dev@4a68861`。核对 GitHub 后确认已有 `v0.1.6@bb9165d`，故使用新号 `v0.1.7`，不移动历史标签。`main`、GitHub `main/dev` 和 `v0.1.6` 均为该开发线祖先，可快进合并；不会丢弃既有提交。

| 工作区类别 | 审阅及处理 |
| --- | --- |
| `web/src/game/{clock,ai}.js`、`navigation/originalcity.js` | 纳入共享战略提速和已批准 CITY-4064-WEB-1；只有 Clock 常量及四候选低0分支改变行为，AI旧路径仅注释更新 |
| `server/worker.js`、`server/distribution.js` | 纳入同发布事务 Outbox 入列；不是云端同步完成证明 |
| 六个 `server/deletion*.js` 改动 | 纳入第47张Outbox表、列／索引目录与计数；不扩大删除权限，不迁移玩家存档 |
| `reader/worker.js`、三个 `vps/{publish_to_r2,r2client,r2sign}.mjs` | 纳入分发／读取原型及本次审阅修复；非生产上线版本 |
| 原有游戏／浏览器测试及 `tools/editor_server.mjs` | 纳入速度断言、候选穷举、日历步长和隔离目录mock；不降低原错误断言 |
| 17个 `verify_editor_backend_*.mjs` 与 `run_management_ui_r5.mjs` | 逐文件核实此次差异仅46→47的基线计数／描述，不将改期望当实跑通过 |
| 新增分发、签名、读取测试与 `verify_distribution_schema.mjs` | 纳入可重复的产品测试；新增schema入口使用全新实际Root，不依赖忽略目录中的历史夹具 |
| `server/public/trialweb.txt` | **保留**：它是服务端试玩实际加载的受信程序束，不是临时报告；217项逐源码／长度／SHA核对 |
| README、VERSION、CHANGELOG、AGENTS、机制笔记、journal | 纳入必要使用说明、批准差异与发布边界；不把方案当已实现 |
| `docs/fixture-patches/` | 保留测试夹具修复配方及说明；不是把本地fixture、运行数据或日志复制入库 |

排除且不删除：`.pi/`、`.codegraph/`、`.dragon-analysis/`、`.dragon-runtime/`、`.wrangler/`、`server/.local/`、私密环境文件、浏览器profile、截图／日志／缓存、`dist/`。不强行加入仓库外 `.agents/skills/`。版本库原有 `vps/auth.env.example` 是示例，不含真实凭据。没有另行新增生产SQL迁移文件：Outbox由构造器幂等建表，冻结目录同步；这不认证真实数据库升级或完整删除迁移。

## 本次审查修复

- publisher 的 `--drain` 原先被当成带值参数，位于末尾时为空字符串而未执行；改为明确布尔参数并拒绝与 `--game` 混用。
- 修复 `DistributionOutbox` 构造时漏包 `{storage}`。排空每次生成完整已上架目录，避免逐游戏覆盖全局目录；单游戏投影只允许隔离 `test/<id>/` 前缀。
- 公开release／公告投影按本次公开游戏集合过滤；旧版／未上架Outbox记录不拿当前新版冒充确认，而是保留pending、记录失败并停止。CAS失败同样保留pending。
- reader 原先在无Node兼容标志的Worker中使用 `Buffer`，有效JSON也会被拒；改为严格UTF-8 `TextDecoder`。核对控制根generation／digest格式，并实际核验投影SHA。
- 补充双游戏排空、陈旧记录／CAS失败、部分目录保护、未上架元数据隔离及有效JSON／坏UTF-8／坏投影负例。mock不可变写入成功明确返回成功对象，不再把首次写成功误走冲突分支。

## 验证与未完成项

- 本次专项5入口通过：签名7项、Outbox10项、publisher23项、reader25项；新的实际workerd Root测试核对 **47表、47索引、318列、3条外键声明**，对象／列／索引属性通过冻结门。只使用新隔离数据与内存桶，无真实R2或数据库操作。
- 游戏侧沿用紧邻的 CITY-4064-WEB-1 最终28个显式入口成绩（含native-city29项及新profile浏览器），发布前已重核255个声明源码pins和28份日志SHA；**不是本次重跑历史游戏全量**。217项Trial束均与当前源码文本／长度／SHA一致，重建结果不变。
- 61个候选文件完成纳入检查，48个JS/MJS语法检查、205个本地文档链接和`git diff --check`通过；fixture补丁反向`--check`通过。变更范围秘密标记扫描无匹配，非通用安全认证。
- 58个支持路径主动LSP检查未报告error：22个确认clean、35个因服务端静默不能确认、`ai.js`超过5000行限制（已过语法检查）。session `mode=all`有9条warning和672条hint/info，主要为既有测试日志／写法、Scenario类型提示及反汇编拼写；不宣称全量LSP clean。
- 历史后端重lane仍有502未闭合；本次没有重跑private-namespace／sql-freeze／bound／validated／waits等完整历史矩阵。它们依赖未入库的历史fixture；`docs/fixture-patches/`只提供特定修复，不能声称干净克隆可复现全部历史lane。历史pin曾批量刷新的证据限制见`4a68861`之前journal，不把新pin当旧成绩仍有效的证明。
- V5仍缺：不可变持久payload／全事件generation、上下架／限制／删除同步、空目录发布、断电／失回执／双publisher／备份恢复、完整资源身份及签名准入。reader文件端口目前只作前缀限制，不具备生产资源授权门，**不可直接公开部署**；publisher原型不得当可靠生产排空器。
- 完整物理删除、任意移城／扩容、部分编辑表单与浏览器验收仍未完成。本次不是VPS迁移／编辑器上线／原版全战役认证；未访问真实DOS存档或用户浏览器profile。
- 发布目标仅GitHub分支及Release。推送`main`可能触发项目既有Cloudflare自动部署；本次不修改其配置，不手工部署编辑器、reader或操作真实发布桶。

本地审阅清单、源码pins、专项日志与发布静态核验保存在忽略目录 `.dragon-analysis/release-v0.1.7/`，不作为Release附件或代码提交。远端发布结果以GitHub分支／标签和Release实际状态为准。
