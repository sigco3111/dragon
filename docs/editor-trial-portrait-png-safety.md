# TRIAL-PORTRAIT-PNG-1：Trial源矩形PNG规范化与提交前写门

> 本页为当轮封存，JPEG假头接受只描述此轮旧行为。后继[Trial JPEG切片](editor-trial-portrait-jpeg-safety.md)已改为完整有界解码／规范PNG或422，库固定128门保；当前PNG专项attempt4为66／105 HTTP／33图exact，原106次少一条legacy commit。原报告／SHA不覆写，不追认当轮JPEG安全。

用户「继续，遇到问题，分析原因，找到办法解决」授权本地接续。仅完成本页限定Web工程切片，不改原规则／RNG／原头像byte，不commit/push/deploy/fetch、不触DOS存档或用户profile。产品源尺寸不限于128与工程128裁剪输出仍分开，见[产品§4.3](game-editor-design.md)／[工程§6](game-editor-technical-design.md)。**本批不关闭Q37／完整图片安全或裁剪合同。**

## 原因与最小修复

1. `TrialSessions.#checkPortraitUpload` 原来只验PNG/JPEG魔数；旧 `verify_trial_portrait_upload.mjs` 用签名加零填充当上传正例，不能证明像素有效。现在PNG在真实Trial授权之后，复用未改 `pngio.js` 完整有界解码，再以源宽高编码纯RGBA8 PNG。伪头／CRC／压缩／滤波／结束边界／不支持profile失败返回422 `TRIAL_PORTRAIT_PNG_INVALID`。不处理或保存输入元数据，只保存核验像素。
2. `uploadCommit` 原来INSERT并改manifest后才比对预检结果；不带外层事务的直调失败会留下部分资源。现在先生成规范DTO、比对assetId／MIME／SHA／长度，再校验manifest存在／JSON／portraits数组，最后才写。**公开Root原本已有外层SQLite事务，不能把此直调缺陷说成已实证的公开API部分写入漏洞。** 外层事务仍负责真实两次SQL写入失败的回滚；本批没有自造嵌套事务或宣称裸调用SQL失败也原子。
3. 源PNG≤100KiB不代表重编码产物≤100KiB。自有512×512 Sub-filter梯度探针：源3789B，未裁剪规范RGBA PNG为686274B。保留原源矩形的本切片必须同时保原Trial资源存储100KiB预算；新增422 `TRIAL_PORTRAIT_OUTPUT_BYTES`，明确区分源输入超限。该拒绝不是说源图损坏，也不是新的源必须128产品决定；后继裁剪／128输出仍需完成，不能称全部≤100KiB合法源均已可上传。

预检不写头像资源；Root的seal await之后，提交仍重新规范化并重新授权／核对，不复用客户端摘要或新增await。DTO、SQL行、manifest项、资源服务长度和SHA都使用规范输出。输入仍非空≤100KiB；源形状保留，不自动居中裁剪／缩放／拉伸。JPEG保持原魔数＋原字节行为，**假JPEG头仍可接受，是明确未修的缺口，不是安全正例**。没有将游戏库固定128 JPEG解码器擅自放宽。

## 有界支持与限制

复用 `png-io-2-noninterlaced8-indexed124`：共享上限为4Mi pixels／单边8192／4096 chunks，尺寸／像素门在inflate前；CRC／chunk次序、exact zlib输入消费与输出长度、五filter、palette／透明及IEND／尾字节均校验。支持非交错8bit灰度／RGB／灰度alpha／RGBA与indexed1/2/4/8，输出只有IHDR／IDAT／IEND；动画、交错、16bit及未支持色彩管理profile拒绝。PNG适配器自身16MiB字节上限不是头像存储许可，规范输出另受原100KiB存储门。

不是进程沙箱／硬CPU-RSS／所有PNG格式／色彩管理／EXIF方向显示一致性认证。保的是原始RGBA采样矩形；不将原样本像素对拍冒为客户端预览／完整消费者视觉验收。旧不安全Trial资源、库和历史包没有迁移、删除或重新认证。新资源数量配额、完整裁剪和任意源JPEG规范化仍须后继。

## 入口、隔离与实际验证

入口与I/O先登记[本地验证清单](editor-local-validation.md)。新入口 `node tools/verify_trial_portrait_png_safety.mjs <新轮号>`，共用 `trial_portrait_fixture.mjs`＋`trial_portrait_png_worker.mjs`。Node内存SQLite与实际workerd SQLite DO均调用当前生产TrialSessions；principal／games／drafts／catalog是明确stub，只固定政策使用真正pinned字节。**不是公开Root账户／CSRF／R2／发布／App或浏览器新轮。** 只用合成PNG及自有scope、已装Pillow，不安装依赖或联网处理图片。

父scope `.dragon-analysis/editor-phase/trial-portrait-png-parent-r1/`；子scope `trial-portrait-png-r1/attemptN/`。初864项明确旧输入与新四测试文件共868项，执行前逐字节快照；最终driver12直接输入含一份自有增长探针PNG。父预算300秒、HTTP30秒、Pillow60秒，环境仅必要白名单。原失败／中间通过／新最终轮全部保留，wx收据与日志不覆写。

| 最终入口／检查 | 实际结果 | 可以支持的结论 |
| --- | --- | --- |
| 新PNG／提交专项 attempt3 | 66项，106次workerd HTTP，status0／无超时 | 11真PNG正例，36拒绝样本，预检无资源写入、四字段／缺预检／重复／三个坏manifest直调无资源写入、SQL写失败外事务回滚；一项JPEG legacy仅缺口登记 |
| HEAD 重绿 attempt6 | 66项，105 HTTP，33图exact，status0 | 在 A–H（含 F 库重签）之后当前 SHA 重跑，形状同 attempt5（假JPEG头422故少一次commit）；Trial 人像 PNG 路径不受 F 影响，无静默漂移。 |
| 正例独立Pillow | 33图全部RGBA exact | 11份源、Node规范输出、实际workerd输出；包含非方形、packed奇数宽透明、100KiB源边界、4Mi pixels／8192边界，不设epsilon |
| 权限／生命周期夹具 | 拒绝无新头像 | foreign／invalid principal／不存在Trial在decode前拒；epoch／删除栅栏／已结束拒；前两种生命周期可合法清原资产，不声称整个SQL命名空间零写 |
| 当前头像上传原单测 | 五组status0，JPEG一组登记未修 | 真实256×128 PNG、规范DTO／资源及错误前状态，替换假PNG上传正例 |
| 当前库／壳／静态对等 | 17／69／20，各status0 | 当前新日志，不是live或新App／并发认证 |
| 语法与主动诊断 | 五JS＋一Python AST通过；六改动代码all-server主动LSP均clean | 不借空缓存、既有全仓诊断或GameBar扫描上限称全仓clean |

增长探针源SHA `80884ba66a29e3ea5c4cd80c2426fc7dd1a40a07d72b5b91995bc5d3a6e6f567`，未裁剪规范PNG SHA `16d92b866e9dd1a2303cdfc15a4ffff1716be79b479d2c15324dfd0e8f8f4a58`；最终专项确认该源触发独立输出预算错误且资源表／manifest不变，不用增加SQLite容量或放松源限制追绿。

## 失败分析与收据时效

- attempt1首Worker构造报 `SOURCE_MANIFEST_NOT_PINNED`。文本模块返回string，而原政策只接受Uint8Array；Node使用readFileSync字节正常。原政策正确拒绝，不改hash／类型／权限门，只将新workerd夹具文本按UTF-8转Buffer。随后补存HTTP状态／原响应，再解析JSON，避免解析错误掩盖根因。原partial的0 calls是未解析成功计数，不等于未尝试HTTP。
- 首次收口collector只识别Git一种缺文件文案，对未提交新文档实际的 `exists on disk, but not in 'HEAD'` 错误拒绝，未生成report。原脚本／log／err／meta保留；新 `final-audit-r2.py` 仅在明确五个新文档路径、exit128与逐字节准确Git文案下允许HEAD不存在，其余失败不吞。生产、专项入口与期待结果均不改。
- attempt2为输出预算门前版本，65项／105 HTTP／33图通过，只算该轮源码。增长探针实测后增加产物门及拒绝样本，再全新attempt3：66／106／33；最终四focused另存current日志／源码，未用attempt2拼最终绿。
- [前批17项真实链](editor-portrait-workerd-safety.md)当轮860输入含旧Trial源码。新Trial改动使其整组字节不再等于当前；没有重跑这24分钟公开链，也不把当前PNG内部专项冒为新Root／匿名App验收。游戏库PNG/JPEG及其vendor源码未改，仍保各历史证据自己的SHA／覆盖域。
- Jev旧地区451未解除，不重复联网或绕限制。规则、认证协议、Root路由、共享PNG适配器、玩家Web束、固定库pin均未改，保留全部既有本地脏改。

## 当前直接源码SHA

| 文件 | SHA-256 |
| --- | --- |
| `server/trials.js` | `9aa281a5758f8f64eab624f156400a243fd2855ba2d7b18b6573684a338d81b1` |
| `tools/verify_trial_portrait_upload.mjs` | `9c8cc0a2271db02da88c925ea51c0ad37440a1e82a1fa1d11e9df18a6ae54722` |
| `tools/verify_trial_portrait_png_safety.mjs` | `b0d68ca65daa2ebf01bc0178d76b4e0ba5bb73ac7aca23dcd121d13f0bbdffb2` |
| `tools/fixtures/trial_portrait_fixture.mjs` | `53b597600fd57c076308d604f3f7f724f5fbf97032e862ea8dd6bb756f75c460` |
| `tools/fixtures/trial_portrait_png_worker.mjs` | `a8b805d5494b600096a51e7a9447d48dfc4a5239a4e92154757d4c9e87283a5a` |
| `tools/verify_trial_portrait_png_oracle.py` | `31da5c80b4760a40ed49e551bfafa42d8b9a4f79055b3548b4ad7d90fcef93d3` |
| 共享未改 `server/pngio.js` | `7561159606182e7fa9c33cab03da3a7495a5c07daded041ed5bfaabb941c463b` |

六变更代码最终all-server主动LSP为6clean／0诊断；11文档7clean／4findings，仅28个既有或标识词information，无warning／error。session-all覆盖58文件，既有startmenu 1blocking、arrival／URL共10warnings、106hint-info；GameBar旧扫描上限未因此解除，不称全仓clean。

最终输入／文档／全部失败与通过产物pin、链接／表格／Q73／新增乱码／diff检查以新父scope `report.json`为准；自有collector只读本批明示文件、Pillow图与本地Git检查，exclusive创建收据，不复写旧seal。后继方向为服务端裁剪参数／规范128输出与有界任意源JPEG处理，继续保进程隔离／完整格式／独立彩色精度／旧资产／发布UI／并发和全部消费者组合open，见[逐项索引](editor-requirements-matrix.md)。
