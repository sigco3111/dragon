# PORTRAIT-DECODE-ISOLATION-1：解码隔离排查与 Node／Windows Job 探针

本页是本切片唯一详细维护源。用户对剩余七项答复为「1、JPEG资源具体是什么，解释一下；2、要；3、按建议；4、按建议；5、发布UI指的是什么，解释一下；6、具体解释一下；7、按建议」，随后两次要求「继续」，最新要求「剩下三个等解释需要我决策的，前面完成后，再给我整理一下我来决策」：#1／#5／#6待前项完成后统一整理，不提前要求决定。#2 已授权推进隔离，不等于授权创建云资源、调整套餐／部署配置、安装依赖或部署；无新 commit／push 授权。

> 平台后继：用户确认编辑器与私有后端部署VPS，游戏／正式数据留Cloudflare，并要求只整理方案；不再推进Containers／解码Worker。新的Linux隔离适配方向见[平台拆分方案](editor-vps-cloudflare-plan.md)，尚未安装；下文Node／Windows探针及Worker限制保原历史，不能把平台决定当生产验证。

## 决定与解释（Web 工程／产品边界，非原版机制）

| 项 | 当前处理 |
| --- | --- |
| 1 JPEG 资源 | 指作者上传的 JPG/JPEG 武将头像源文件，不是地图／音乐或全部资源。Trial JPEG 源总像素上限仍 16384、单边 8192、输入 100KiB，解码后可按确认矩形裁为规范128；游戏库服务端仍接128×128，浏览器先裁源。用户本次要解释，未批准放大预算。 |
| 2 OS 隔离 | 用户要实施，已完成独立 Node 子进程及 Windows Job 内核限额探针；后者验证提交内存限额和周期检查的用户态CPU时间终止，不是硬RSS／精确CPU截止／权限沙箱。现上传链生产隔离仍未实现；后继目标为VPS正式Node／Linux隔离端口，不再建云解码服务，适配／权限与部署仍待后续授权。 |
| 3 格式／独立彩色精度 | 按建议暂缓扩大支持和完整认证，保持现有子集拒绝门；不把暂缓写成安全／精度通过。 |
| 4 旧资产 | 按建议冻结、不自动迁移，不清除、重写或批量扫描真实旧库。不是认证旧魔数上传期对象安全，也不放宽现有读取／发布准入。原版255／G127未知引用是另一类原证缺口，不能与历史上传对象混为不安全资产；不补替代图、不改其原字节。 |
| 5 发布 UI | 作者通过工作台按钮／确认／进度／错误恢复把精确已保存草稿发布为正式内容的流程。现有发布 API 成绩不能替代全部 UI 验收；发布不等于上架，更不等于 Git 提交／程序部署。本次先解释，未新增界面实施授权。 |
| 6 游戏侧并发 | 两个编辑窗口同时保存、上传／删除头像或发布，检查旧修订拒收、幂等、发布内容稳定及在用资源保护。不是多人联机对战。本次先解释，仍未新增整组并发验证授权。 |
| 7 完整消费者组合 | 按建议暂缓整体闭包；局部已验证的 GameBar／HUD／开局／战术消费者保持，不因此关闭 Q37／Q69／Q70／Q71。 |

## 生产边界与撤回接线

- 实际服务器入口是 `server/wrangler.jsonc` 的 `worker.js`，compatibility date `2026-01-01`，只有 metadata SQLite DO／R2 bindings；不是可启动 OS 子进程的 Node 服务。
- Cloudflare 官方[兼容性说明](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#nodejs-compatibility-flag)将 `node:child_process` 列为 **non-functional stub**，启用日期为2026-03-17；升级 date／增加 flag 也不提供真实 OS 子进程。本轮不修改 date／flags。
- 前轮临时加入 `server/trials.js`／`server/portraits.js` 的自动环境探测、子进程失败回退直接解码，不能保证生产隔离，已定点撤回。本轮最终 **生产源码无 Git 差异**；原 Trial、游戏库解码／规范化／权限／事务／预算保持。
- 新子进程模块放在 `tools/fixtures/`，只由新验证入口调用，不被生产源码或 Web 束引用。子进程拥有启动用户的 OS 权限，不是文件／网络权限沙箱。
- 原先注释「用户批准30s／256MiB」撤回：用户只批准要隔离，没有批准数值。这两项仅为探针上限，不是产品 SLA、正式运维配置或扩大输入许可。
- [`--max-old-space-size`](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-mib)只限制 V8 old-space，不是进程硬 RSS；4MP RGBA 为16MiB，不能误记64MiB。wall timeout 不是 CPU 时间配额。不得用这些实验结果关闭工程合同§6。

## 工具／I/O 与源码 pins

入口 `node tools/verify_portrait_decode_isolation.mjs <轮号>`；独占新 `.dragon-analysis/editor-phase/portrait-decode-isolation-r1/attemptN/`，已有轮不覆写。显式15输入副本＋SHA、自有合成图、原5次HTTP／Node调用及 receipt；不读DOS存档、用户图片、实际浏览器profile或真实数据库，不安装依赖。Python/Pillow只合成自有128彩图JPEG、2048×2048 PNG和8192×2 JPEG，子进程与Python只传必要PATH／系统／临时目录环境；无凭据、NODE_OPTIONS或故障环境变量继承。

| 文件 | SHA-256（attempt5） |
| --- | --- |
| `tools/verify_portrait_decode_isolation.mjs` | `08488900127d12a5800a93937caf1662a1562d9b914f541a22712c253f1ab4f2` |
| `tools/fixtures/portrait_decode_isolate.mjs` | `8500425eec11820df30e2c90c365a7bab3a3619913fab7fd88959c2581f71d77` |
| `tools/fixtures/portrait_decode_child.mjs` | `3b2df1c954b2b098583c131a4a482fc6890874d6e959c5e884ec36043aad840a` |

实验使用输入≤100KiB、stdout／stderr捕获≤32MiB、V8 old-space≤256MiB、wall≤30s；测试hang用1.5s。参数只可缩小，零／NaN／无限值拒绝。源解码支持域仍来自现有PNG／JPEG模块；父进程复查宽高／像素预算、RGBA长度和规范base64。超时／崩溃／无法spawn／坏回复一律 `DecodeProcessError`，**无直接解码兜底**；已知损坏源保PNGError／PortraitJPEGError类型。基础设施故障不伪装成用户图片422，未新增生产API错误码。

## 验证与 ECONNRESET 根因

attempt1–3 保留：旧实验把同步hang测试放在真实workerd请求之间，末次seed `ECONNRESET`；不是完整通过。attempt4重构为独立探针后通过21检查／5HTTP；清工具诊断并加入现有最大输入传输后，**attempt5通过23检查／5HTTP**：

- PNG／Trial JPEG／游戏库JPEG，子进程与直接路径全RGBA相同；截断源错误类一致。
- 2048×2048 PNG、8192×2 JPEG在**原预算**内，跨进程像素传输exact；共享同一codec，不冒独立格式／色彩认证。
- 三种hang在约1.5s终止；崩溃、spawn失败、坏JSON／坏像素回复均失败关闭；非法timeout／old-space cap拒绝；失败子进程后父进程仍可再成功解码。
- 原生产TrialSessions：Node SQLite／真实Miniflare workerd SQLite DO（身份／content端口stub），PNG／JPEG预检结果一致，SHA／长度与独立子进程像素重编码结果一致；截断源422且assets前后相同。这证明输出兼容，**不是生产API装了子进程**。
- 所有HTTP响应完整消费，回环探针用 `Connection: close`，同步阻塞6.5s后真实workerd seed仍200；没有自动重试掩盖失败。

独立控制实验 `connection-probe-r1.mjs`／`.json`（同父scope，不入Git）：无解码子进程，只用`Atomics.wait`阻塞6.5s。keep-alive组下一请求ECONNRESET，随后新连接snapshot200；close组seed200且snapshot200。证实客户端同步阻塞／空闲连接复用失效，而非workerd进程被kill。保留三旧失败轮，不修改SDK、生产HTTP或旧seal。

## 收尾检查

- 三个新MJS `node --check`通过；三工具与两个恢复后的生产模块主动LSP无诊断。七文档主动LSP：四份clean，三份仅24条历史typos information，無warning／error；不改历史字段或批次标识追绿。
- 本机只读collector `final-audit-r1.py`：23检查／5HTTP、15显式source pins、435本地链接、Q1–Q73唯一及Q37列数、三个新工具语法、旧生产blob归一化等值、`server/`／`web/`无Git差异、diff检查通过。最终文档补记后另立final-audit-r2，不覆写r1的文档pins；报告明确 `productionOSIsolationPassed=false`、`hardRSSCPUVerified=false`。
- 未跑新的Root／R2／App整链或浏览器：生产路径已撤回至HEAD字节，当前仅独立工具／状态文档；不把旧14／17公开链拼成隔离通过。

## PORTRAIT-DECODE-JOB-1：Windows 内核限额（后继，仅本地工具）

WSL只读复查：Ubuntu PID1 为 `init(Ubuntu)`，普通用户1000，`systemctl --user`无bus；没有可写用户cgroup子树。不启用systemd、不sudo、不修改WSL／cgroup权限；改用已安装PowerShell7编译自有C#调用Windows Job API，不安装依赖／服务，不改执行策略。

入口 `node tools/verify_portrait_decode_job.mjs <轮号>`；独占 `.dragon-analysis/editor-phase/portrait-decode-job-r1/attemptN/`。显式7输入pins／字节副本，自有合成128 PNG／JPEG、2048×2048 PNG、8192×2 JPEG（原像素／100KiB门），各case保stdin、stdout、stderr、launcher和job原报告。仅必要Windows环境，无凭据／NODE_OPTIONS；不读真实图／存档／profile，不访问网络或已有资产。所有模块仅供测试，不被生产引用。

| 新工具 | SHA-256（attempt5） |
| --- | --- |
| `tools/verify_portrait_decode_job.mjs` | `66d70f058061b9437d8524735bb8bb4500eafa3ec89024450263462d8d71bf2d` |
| `tools/fixtures/portrait_decode_job.cs` | `5759b08734234d48a3bfeaada992f44e9b0e3017593a397ad7bdbba43e9adc9a` |
| `tools/fixtures/portrait_decode_job.ps1` | `3d16a1823204caff104b86fad831652cadbe603e7e0089015a35959a251a7680` |
| `tools/fixtures/portrait_decode_job_child.mjs` | `3608e6f7ae2da1aa31a14ee1179d599ef3d2d02695b9c00643c853b0457e6af1` |

原始API说明：[Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)、[Basic limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information)、[Extended limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information)。C#创建无名自有Job，设置 `JOB_TIME | PROCESS_MEMORY | JOB_MEMORY | KILL_ON_JOB_CLOSE`（0x2304）并读回；`CREATE_SUSPENDED`创建child，成功Assign后才Resume，不存在解码先运行再加限额窗口；禁用breakaway。超时、主进程已退出但后代仍活或启动失败时均终止自有Job，核ActiveProcesses=0后关闭handles；失败不启动无约束替代进程、不直接解码回退。

- **提交内存≠RSS**：Job限制process／job-wide committed memory。16MiB原生Buffer逐页触碰并保留，不靠V8 old-space门。96MiB／192MiB两个实验Job均出现 `ERR_MEMORY_ALLOCATION_FAILED`，attempt5峰值分别99,151,872／200,822,784B，均低于设定100,663,296／201,326,592B，且随限额改变；不能标硬RSS已验。
- **用户态CPU周期检查，不是精确截止**：1s实验quota的busy-loop由内核以 `STATUS_QUOTA_EXCEEDED`（0xC0000044）终止、未触15s wall。官方明示periodically checks；attempt5累计用户态4.578125s、wall5.450s，记录实际超调，不称CPU严格≤1s或涵盖kernel时间。
- **wall／后代清理**：1s wall实验以自有码0xE001整组终止（attempt5约1.019s）；后代先明确READY，主进程退出时仍有活后代，整组清理后ActiveProcesses=0。无文件／网络权限沙箱证明。
- **兼容与失败关闭**：三格式及原最大输入shared-codec全RGBA exact；两坏源保错误类；crash／坏JSON／CreateProcess失败／非法预算拒，无解码fallback；失败后新Job仍可解码。合法解码Job使用512MiB提交内存／5s用户CPU／15s wall，仅为实验配置，不是用户批准的生产阈值或输入扩容。

attempt1在内存错误文本期待处失败（Node实际为 `ERR_MEMORY_ALLOCATION_FAILED`）；attempt2通过17检查。加强quota退出码和后代生命周期后attempt3暴露工具只等spawn、不等child READY的问题，不能把totalProcesses当活后代证明；改为必要环境白名单＋READY握手。**attempt4和同SHA attempt5均通过17检查／15 native jobs**。保全部旧轮，不覆写或拼绿。

两个新MJS及本批七文档主动LSP（warning门）无诊断；C#/PowerShell LSP未确认（C#无project root），不冒全语言clean。每case PowerShell `Add-Type`实际编译并运行C#，PowerShell AST语法检查通过。后继收尾另立 `portrait-decode-job-r1/final-audit-r1`，固定两套源码pins、17检查／15 job原报告、两个启动失败原日志、文档链接与生产零diff；不覆写前轮r2文档pins，以实际report为准。生产server／web未改，不重跑旧Root／R2／App链，不把本地Windows结果当作Cloudflare隔离验收。

## 仍缺／下一实施依赖

1. **生产OS隔离尚未完成**：平台方向已改VPS编辑器，先正式Node／存储适配再接目标Linux隔离（详见拆分方案）；不继续Cloudflare Containers资源申请。官方[Containers限制](https://developers.cloudflare.com/containers/platform/limits/)只保留为旧可行性研究，不是本轮实施清单或任何限额已生效证明。
2. 本机未发现Docker；已有WSL Ubuntu但普通用户无可用cgroup委托／user bus，不启用系统服务或改权限。Windows Job提交内存／用户态CPU周期终止已实测，但无硬RSS、精确CPU截止、文件／网络权限沙箱或Linux cgroup证明；不是生产承载。
3. 正式方案应失败关闭，无隔离后端则明确不可用；异步解码需在await后复核作者／epoch／试运行状态及修订，并在SQL事务内提交时再次核验。不得在事务内同步spawn，也不得把服务故障报为用户图片无效。
4. 先保原输入上限、隔离服务只接源字节和规范裁剪，不传登录cookie、游戏草稿、R2钥匙或用户文件名；返回仅规范128PNG／确定摘要。需实测超时、OOM、CPU限制、坏回复、改密／结束／保存冲突、并发和无写拒绝后才能安装生产路径。
5. 更大JPEG源接受／完整格式与独立色彩精度／旧资产认证／全部消费者仍各自有边界；本轮不commit／push／deploy，不关闭Q37／Q69／Q70／Q71。
