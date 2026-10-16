# Checkpoint Journal

> 本文件只记**当前状态、主线进度、阻塞与下一步**，供下一对话接续。长期事实/架构/命令/约定/坑点在 [`AGENTS.md`](../AGENTS.md)（含[编辑器开发待办](editor-dev-todo.md)）；机制原证在 `.agents/skills/*/SKILL.md` 与 `docs/re-notes-*.md`。历史逐轮细节（round 号、pin 计数、失败现场文件）只留 `.dragon-analysis/`（被忽略）与 Git 历史，本文件不复制。
> 发布整理基点 `dev@4a68861`；本批版本 `0.1.7`。用户已授权完整提交、合并main、推送GitHub和创建Release；Gitea不在目标内。GitHub已有v0.1.6，故不覆盖旧标签。最终提交／推送状态以Git和Release实际结果为准。

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

## 主线状态（2026-10-16）

| 方向 | 状态 |
| --- | --- |
| 编辑器功能（Q25/Q26/D公告/A2/Q34/画像退役） | 上述限定功能已提交；47表基线本次fresh Root复核通过，不代表全部E-01重lane通过 |
| V3 publisher＋V4 读取端＋Outbox | 原型纳入本次发布；23项publisher干跑／25项reader通过，生产排空与签名准入仍未闭合 |
| 死锁项 | 门闩根因已修（draft-freeze 全绿）；重 lane 502 残留（isolate 资源方向，未证实） |
| 部署线（VPS/V5） | 待用户逐项授权，未开工 |

用户产品决策（详见 `editor-dev-todo.md` H 节）：发布＝作者定版／上架＝管理员专属（A）／单版本替换删旧版；作者自建（第一章＋公用图，画像自传或模板库，重名允许）；禁上传、画像库一对一（B）；R2 `dragon` 桶四区布局（kao/artifacts/projections/control，桶私有）；凭据只放仓库外 env。

## 当前阻塞

1. **重 lane 502（死锁项残留）**：private-ns／sql-freeze／bound／validated／waits 在 500+ calls 重请求处定点 502（DO stub `fetch failed`，workerd 零日志）。门闩／freeze 交互／copy 计数／累积调用已逐项证伪；fixture multi-waiter 修复本身已被 draft-freeze r9/r10 证实。下一步：抓 isolate 级错误原文或换快机器；证据与 probe 记录见 Git 历史与本目录忽略证据。
2. **Outbox生产排空未闭合**：原型本次修复入口并通过内存双游戏／CAS失败／旧版拒绝测试；持久payload、全事件同步和真实库恢复仍缺，不能直接上线。
3. **V5＋部署**：签名准入票据、读取端 wrangler 配置／域名、Outbox 账本上线、VPS 构建——全部待用户逐项授权。
4. **散项**：Trial 上传口已退役；Q10/Q29、Q11/Q19/N8、Q30 完整表单、N3 剩余字段、E 浏览器 lane、模板画像库确认（`149.png` 恢复存疑，有意删除请明示）。

## 下一步（按序）

1. 本轮按用户授权交付GitHub v0.1.7；后续先核实际Git／Release状态，不据旧journal重复提交或推送Gitea。
2. 死锁残留：isolate 证据或换机器复判重 lane。
3. V5：用户授权后逐项做（Outbox 上线→读取端部署→切换）。
