# PORTRAIT-WORKERD-SAFETY-1：当轮PNG／JPEG服务端真实发布与匿名App接续

用户「继续」授权本地限定接续；不commit/push/deploy/fetch、不访问DOS存档或用户浏览器profile。承接[历史14项功能链](editor-portrait-workerd.md)及[PNG](editor-portrait-png-safety.md)／[JPEG有界实现](editor-portrait-jpeg-safety.md)。本批只增加验证工具及证据文档，**没有生产／规则／RNG／原头像byte／Web束／库pin改动**；不是Q37或工程§6全验收。

## 入口与隔离

入口/I/O先登记于[本地验证清单](editor-local-validation.md)。`node tools/verify_workerd_portrait_browser.mjs <新scope> safety`延续原真实workerd／SQLite／R2、原source/library stager全指纹门、真实登录／改密／安装／完整复制及真实工作台。默认秘密每次随机，不落日志。编辑页及匿名页两个全新Chromium context，编辑IDB spy为0；匿名App存储只属于自有profile。没有直接写SQL造成功或合成principal代替公开账户API。

父scope `.dragon-analysis/editor-phase/portrait-workerd-safety-parent-r1/`，新子scope `portrait-workerd-safety-attempt1/`，均独占创建、旧attempt不覆写。执行前859项旧输入快照加新JPEG fixture共860项；三focused工具另存执行前源码pin。不是完整动态I/O或安装工具／provider图。父预算1800秒，单阶段180秒、HTTPS300秒；仅关闭自有进程／context／监听。

## 新增公开API与实际App证据

- 已装Pillow生成128×128中性RGB JPEG及合成EXIF，独立解码后全部RGBA精确等于`[96,96,96,255]`。fixture仅测试工具，不进服务端／玩家束、不安装依赖、不联网处理图片。
- 真公开上传API接原始JPEG，201 DTO与后续资源查询均为`image/png`／128×128。输入1161B，规范输出298B，SHA取输出而非输入；发布资产MIME／长度／SHA与DTO一致，EXIF签名不保留。源码规则仍为有界JPEG子集，**单中性样本不重签独立彩色精度／完整格式／进程隔离**。
- JPEG完整SOF后截断、JPEG EOI后多一字节、假PNG头三负例均422且错误码精确；对应资源GET均404，既有JPEG DTO不变。只声称未新增头像资源，不声称整个账户／幂等命名空间没有SQL写入。
- 原两张256×128红蓝PNG仍由真实UI调整／确认裁剪后上传，G7/G93保同原byte7而分别绑定First/Second；G94保原byte17，真实UI绑定RawJPEG。保存修订4→现有发布API→冻结包。当前**没有发布UI按钮**，不称全程UI。
- 在用删First仍409；真实UI清除G7并等待目标行／busy完成，保存修订5。随后匿名实际App仍运行已发布修订4，三实体全部128×128 RGBA正确、G7/G93 URL不同；原JPEG规范PNG也由实际world／实体资源方法解析，而不只GET图片。

| 本轮入口／检查 | 结果 | 限定域 |
| --- | --- | --- |
| `verify_workerd_portrait_browser.mjs … safety` | 17项，status0，1497.19秒；31 Node HTTP、390浏览器API响应 | 全新真实认证／复制／UI上传绑定清除／发布API／匿名App，串行生命周期；不是并发或普通作者交叉权限矩阵 |
| 本轮错误门 | pageErrors／failedRequests／outside空，未分类console空，编辑IDB0 | console仅精确分类bootstrap session401及在用删除409；workerd自签TLS预握手错误日志原件保留，不用它判SDK／并发根因 |
| 头像库／壳／静态对等 | 17／69／20，各status0 | 新日志、同当前输入；不是69/20项live或旧轮追认 |
| 工具语法 | Node检查＋Python AST两项通过 | 两本批工具；不把语法替代LSP |
| 最终父scope审计 | 输入／源码／文档／产物pin，独立Pillow源JPEG与发布PNG全RGBA、链接／Q73／diff | 实际结果以新`report.json`为准；不混用旧报告或旧服务端SHA |

## 当轮直接源码SHA

| 文件 | SHA-256 |
| --- | --- |
| `tools/verify_workerd_portrait_browser.mjs` | `5e128c8852a12b2c8a142b3edba23d8d62d00b55f097c52a75ca949af499cfbf` |
| `tools/fixtures/portrait_api_jpeg.py` | `fb90168f9d89116906a07ba5d22df8e6c788b64d88427cee5cfcaf129d96e1ac` |
| `server/portraits.js` | `0fa8f46f00a0e7568a1c52060e2e79c5a30261ea345745cfab3b8d065eaa83b8` |
| `server/portraitjpeg.js` | `f3a0dde39476969b0e916b64bbaa3358cc412a7a76cdfd61afcc6d50f2c538fa` |
| `server/vendor/jpeg-js/decoder.js` | `8edfaf7a440c59edd07025b25150c8ac3a7611793cf9addc8f0406bfb96b5dce` |
| `server/pngio.js` | `7561159606182e7fa9c33cab03da3a7495a5c07daded041ed5bfaabb941c463b` |

源JPEG SHA `68b207edd8173ae7c8de169b23e77bb707ebe6888b4c1cae53b4e067cbf62884`；发布PNG SHA `113aa4500e801e45355624be9675c6c27609bfaca4b38664a5e1a0e3254d7aa3`；独立RGBA SHA `7a49cabb0fb9acb0363dd4f94448ca0287db1fa674222f56f08305a90631ac16`。无像素epsilon。

## 诊断与剩余边界

两变更代码主动LSP初等待超时，主server重probe确认两clean，不把初零诊断当通过；all-server覆盖仍两超时，不能称全部server已确认。11文档7clean／4findings，仅28条既有typos信息。最终session-all共47文件，仍1blocking／10warnings／106hint-info；此前缓存含harness布尔退层参数警告，primary刷新后的减少不替代all-server覆盖确认；既有startmenu导航error／arrival warnings／GameBar扫描上限不借本批关闭。Jev地区451未解除，不重复联网或绕限制。

本批补的是**当轮SHA限定头像App链再验**，不是完整App／战役／战术／存档／全部consumer认证。后继[Trial PNG切片](editor-trial-portrait-png-safety.md)改变Trial源码，860输入不再整组等于当前，不复写原收据或冒新Root／App再验；该切片只补有界源矩形规范化／存储预算及提交前写门。Trial JPEG原图安全和服务端裁剪合同、进程隔离／硬CPU-RSS、完整格式／独立彩色精度、旧不安全资产策略、发布UI、同时游玩／保存及全部窗口／撤销／迟到组合仍未完成。Q37/Q69/Q70/Q71整体保持open，见[逐项索引](editor-requirements-matrix.md)。
