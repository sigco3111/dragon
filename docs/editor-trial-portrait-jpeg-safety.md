# TRIAL-PORTRAIT-JPEG-1：旧像素预算内的Trial矩形JPEG规范化

用户「提交代码，继续」：前续头像链已提交 `4629ee0`（59文件），未push。本页为后继本地切片，不把该请求视为永久自动提交许可；不deploy/fetch/安装，不触DOS存档或用户profile，不改原规则／RNG／原头像byte。

## 原因与修复边界

[Trial PNG批次](editor-trial-portrait-png-safety.md)保留了JPEG魔数＋原字节旁路，伪头可进入资源表。现 `TrialSessions.#checkPortraitUpload` 在原ID／非空100KiB／魔数门及真实Trial授权之后，调用新增 `decodeTrialPortraitJPEG`，完整预检／熵解码后重编码源宽高RGBA PNG；`PortraitJPEGError`返回422 `TRIAL_PORTRAIT_JPEG_INVALID`，没有原JPEG兜底。DTO／SQL／manifest／serve MIME统一PNG，SHA与长度均为规范输出。预检不写头像，commit重新解码／授权，四expected字段和manifest校验仍在写前，SQL失败仍由外层事务回滚。Root协议、认证、await和库表不改。

### 没有扩大现有解码资源预算

- 公共 `decodePortraitJPEG`／`preflightPortraitJPEG` 仍严格128×128，游戏库size门也不改。
- 内部预检与解码复用，新增Trial入口只将固定方形改为 **1..8192边、总像素≤16384的矩形子集**；保持100KiB、256 segments、64 scans、原4MiB codec估算和0.016384MP。参数是受信代码常量，不接客户端预算，维持原codec算术及严格entropy／restart／padding检查。
- `vendor/jpeg-js/decoder.js`和`pngio.js`逐字节未改；同8bit SOF0/1/2、gray或三分量受支持颜色／采样子集，APP/COM剥离，ICC/MPO／不支持过程和非完整结束拒绝。库固定128入口拒绝全部新非128正例，另重跑库91项锁定原门。
- **这是安全工程支持域，不是“源必须128”的产品新规定。** 256×64、64×256、129×127、8192×2等能保源形状；256×128超过当前JPEG像素预算，明确拒绝，不能称所有≤100KiB合法源可上传。更大任意源需要后继资源预算／隔离验证；不靠扩大默认内存上限追绿。
- 无裁剪／缩放／规范128输出／EXIF方向处理、硬CPU-RSS或OS隔离、全JPEG格式或独立彩色精度认证。旧不安全Trial资产／库／历史包未迁移或重验，客户端显示组合及完整Q37仍open。

## 新轮验证与失败分析

入口/I/O先登记[本地验证](editor-local-validation.md)。`verify_trial_portrait_jpeg_safety.mjs`用共享明确stub端口夹具，在Node内存SQLite与实际Miniflare/workerd SQLite DO调用生产TrialSessions；policy是真pinned字节，但principal／games／drafts／catalog是stub。不是Root真实账户／CSRF／R2／发布／App／浏览器新轮。只用已装Pillow和本轮合成图，随机loopback、自有进程、必要环境白名单、每HTTP30秒／Pillow60秒／父300秒，保wx原日志和失败轮。

| 当前新入口 | 实际结果 | 限定覆盖 |
| --- | --- | --- |
| Trial JPEG attempt2 | 58 checks／124 workerd HTTP／status0无超时 | 28正例、18 JPEG拒绝、四expected字段、预检后坏源、权限先于decode、manifest缺失、SQL写失败外事务回滚、epoch／deleting／ended拒绝无新头像 |
| HEAD 重绿 attempt4 | 58 checks／124 HTTP／84图exact／status0 | 在 A–H（含 F 库重签）之后当前 SHA 重跑；Trial 人像 JPEG 路径不受 F 影响，无静默漂移。 |
| 独立Pillow | 84图全RGBA exact | 28源JPEG＋各Node和workerd PNG；gray／RGB中性、baseline／progressive、7种源形状，含极长边及16384像素；纯IHDR／IDAT／IEND，无输入元数据 |
| Trial PNG attempt4 | 66／105 HTTP／33图exact／status0 | 原PNG全域当前兼容，假JPEG头期望已改422，故比旧106少一次commit，不拼旧绿 |
| 游戏库JPEG attempt6 | 91／90 HTTP／56图／status0 | 当前wrapper SHA、原28正例／56负例／六gate；彩色Pillow差异仍只登记，未设epsilon或冒符合性 |
| 游戏库PNG attempt6 | 54／53 HTTP／30图exact／status0 | 共享PNG及库未改的当前兼容 |
| 四focused | Trial5组／库17／壳69／静态对等20，全部status0 | 新日志及每入口870项执行前快照；不冒全App／并发认证 |

attempt1已执行58检查／124 HTTP，但末尾Pillow oracle失败：当前静态`JpegImageFile`没有`n_frames`，旧oracle把缺属性当多帧。自有同轮源JPEG实查 `JPEG/JpegImageFile/hasattr=false`，输出 `PNG/PngImageFile/n_frames=1`；只改新oracle，在限定JPEG/PNG且MPO拒绝的格式门内按静态JPEG默认一帧，仍保全RGBA、尺寸／预算／摘要。生产未因此改动，全新attempt2全部重跑，原失败日志和图保留。不把partial检查数当整轮通过。

父scope `.dragon-analysis/editor-phase/trial-portrait-jpeg-parent-r1/`；专项子scope `trial-portrait-jpeg-r1/attemptN/`。沿旧868明确原输入副本保before（不是从当前新源码伪造before），每次新870输入全复制／hash；只四旧源码改变、两新测试文件新增。每次真实HTTP原文／Node-worker全BLOB前后状态保存，可重核无写；生命周期合法清资产不冒全SQL零写。

## 当前直接改动SHA

| 文件 | SHA-256 |
| --- | --- |
| `server/trials.js` | `4a55c1bee85aeee699be85372f4f15204fa37357725e7d00566a663121b83927` |
| `server/portraitjpeg.js` | `77b8cb26adb76c562b8206092de20dac5691a4507d05c2905c9d4993b32e79f9` |
| `tools/verify_trial_portrait_upload.mjs` | `d9e7df0cee7f872c32ecd7273e1fe488bb0575ac13b87bbf2fcc7e0fe424b62a` |
| `tools/verify_trial_portrait_png_safety.mjs` | `665c2cf28e4bf61d9f5faa5828f8747f3c7aa0481bd68802b42df8496d8d2d07` |
| `tools/verify_trial_portrait_jpeg_safety.mjs` | `12cd3cd8f65d21ae40706628bbe23f2c8a7349c718d0e485dae8281f5949f85d` |
| `tools/fixtures/trial_portrait_jpeg.py` | `8ec697776e90b21a293a0d45c2e7c29dff8da4864ce7e154369739fefa0942bd` |

最终主server主动LSP六改动代码＋owned runner七clean、12文档clean；all-server代码另probe为2clean／5inconclusive（push-only silent），不能冒全server均确认。session-all62文件仍旧1blocking／10warnings／106hint-info；startmenu导航／arrival警告及GameBar旧扫描上限不借本批关闭。最终collector诊断与报告单独核。

前17项真实App链所用旧860输入同时含旧Trial及旧wrapper，本批没有重跑该24分钟链，不称当前SHA公开整链已重验。详细final输入／文档／原失败及全部产物pins、支持的主动LSP／session-all与文档／diff检查，以新父scope `report.json`为准；不覆写前轮seal。Jev地区451未解除，不重复或绕过。

后继仍须服务端裁剪与规范128、更大JPEG源的资源预算／隔离验证、完整格式／色彩精度／旧资产策略、公开Trial实际链、全部消费者／窗口组合与并发、发布UI。Q37／69／70／71不关闭，见[逐项索引](editor-requirements-matrix.md)。
