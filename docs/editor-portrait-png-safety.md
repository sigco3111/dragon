# PORTRAIT-PNG-SAFETY-1：游戏头像库PNG解码／重编码切片

> 后继[JPEG实现](editor-portrait-jpeg-safety.md)已接游戏库有界解码／规范PNG输出，并取得当前PNG新轮54项。本文旧JPEG假头200／16单测与源码SHA仅为PNG当轮身份；当前假头拒绝／单测17，不覆写旧收据。

用户「继续」授权服务端图片安全接续。**只完成游戏库PNG分支，不关闭Q37／工程§6。** 后继于[真实workerd功能链](editor-portrait-workerd.md)；本页维护本批详细证据，不重签旧浏览器链。

## 实现与边界

- `server/portraits.js:GamePortraits.upload` 保留owner／强制改密／内置保护／ID与保留名／重复键的既有顺序，以及原100KiB、128×128门。PNG尺寸在解压前拒绝；复用未改 `server/pngio.js` 有界完整解码，随后只从RGBA像素重编码PNG8。上传的附属块／EXIF／文本不进入存储；DTO、SQL字节、长度及SHA均取规范输出，`forPublish`读取同一输出。校验失败不写头像表。
- 适配器检查CRC、chunk顺序／类型／预算、palette／透明度、滤波、精确zlib输入消费与输出长度、完整IEND及无尾随；拒APNG和不支持的色彩管理。当前域为非交错PNG8（灰度／RGB／索引／灰度alpha／RGBA，索引另支持1/2/4bit），不把拒绝的交错／16bit／profile图像称为已支持。游戏库像素预算由128×128固定输出限制，源文件仍先经UI裁剪。
- **JPEG仍header-only原字节；Trial原图上传入口未改。** 没有服务端JPEG像素解码器、进程隔离／完整色彩管理或新解码依赖。本批不改变已批准JPG支持，不从客户端预览反证服务端安全。原已存头像／历史发布包未迁移或重新认证；只影响本实现之后的游戏库PNG上传。
- 仅生产 `server/portraits.js` 改动；共享PNG适配器、worker路由／认证、原byte／规则／RNG、Web源码／束／两注册表pin不改。无npm运行时依赖、部署、提交、推送或真实存档／profile访问。

## 当前验证（新scope，不重跑旧封存lane）

本机 `.dragon-analysis/editor-phase/portrait-png-safety-r1/attempt3/` 收据：**54检查，53实际loopback workerd调用**。Node内存SQLite及Miniflare真实SQLite DO都调用生产类；actor／游戏SQL行是明确工程夹具，**不是真实账户、公开worker路由、R2、完整发布或App证据**。

| 覆盖 | 当前结果 |
| --- | --- |
| 10真实PNG正例 | 五色彩类型／索引1/2/4/8bit、逐行五滤波、透明度、附属文本／EXIF及精确100KiB输入；规范输出只有IHDR/IDAT/IEND，SHA／长度／持久行与返回一致 |
| 36PNG／格式负例 | 缺像素／CRC／截断／尾随HTML／缺IEND／坏IDAT或Adler／短长scanline／1MiB解压炸弹／尾随压缩或第二zlib／重复IHDR／critical与reserved-bit／APNG／profile／交错／16bit／palette／chunk预算／尺寸／源大小／空／SVG；Node与workerd码值和完整头像表前后相同 |
| 6既有拒绝顺序 | foreign／must-change／失效actor／内置／保留ID／重复键在坏像素解码前拒；只证生产类及工程actor，不冒完整账户权限矩阵 |
| JPEG缺口显式对照 | 非图像JPEG头仍200且字节不变：这条锁定未修改的旧行为，不算JPEG安全通过 |
| 独立像素oracle | 已安装Pillow校验10输入＋10 Node存储输出＋10 workerd存储输出，30张RGBA SHA逐一对拍；Pillow不进入生产 |
| 聚焦兼容 | `verify_game_portraits.mjs`16项（真实PNG正例；24字节假头改拒绝；JPEG仍legacy）、壳69、静态对等20通过 |

工具：`tools/verify_portrait_png_safety.mjs <新轮号>`，test-only `tools/fixtures/portrait_png_worker.mjs`，白名单Pillow oracle `tools/verify_portrait_png_oracle.py`。I/O／环境边界先登记于[验证清单](editor-local-validation.md)。每轮独占目录与输入快照，七直接输入在receipt钉住且执行后复核；不是全仓动态I/O图。

生产 `portraits.js` SHA：`e99f2bf772396eb09fc8a8f6dba2e9f71400e27b31a0c6f0d78f7d839dc296b7`；共享 `pngio.js` SHA保持 `7561159606182e7fa9c33cab03da3a7495a5c07daded041ed5bfaabb941c463b`。最终源码／文档／收据哈希及适用静态检查另存父scope `report.json`。

## 失败原件与验证纪律

- 首语法子进程status134：父进程环境白名单漏大写SYSTEMROOT，Node在解析前CSPRNG初始化失败，非测试／产品通过。只修父环境键大小写选择，不修改全局环境；首日志／meta保留。
- attempt1：Node SQL夹具惰性exec使CREATE未执行，首snapshot报无头像表，零业务检查／零HTTP。只将新夹具exec改为立即执行（与DO语义一致），新attempt2完整重验通过；生产与期待不变。随后只消新tool两处嵌套三元／末元素提示，保留attempt2，最终attempt3同预算／同期待完整重验；30个PNG fixture与attempt2逐字节相同。
- 本批完整旧workerd上传→发布→App14项未重跑：前批收据绑定旧服务端SHA，不能拼成当前安全／完整App全绿。新证据只认证上述库边界。
- 四JS语法与Python AST通过。13适用变更路径主动LSP：9clean／4findings，28条既有文档typos信息，五代码路径无warning/error；session-all另查，不把会话旧导航error／旧警告或GameBar扫描上限冒为已清除。文档链接／表格／73编号／新增乱码／diff及最后哈希再核另列父报告。
- Jev旧HTTP451地区不可用未解除，不重复联网／绕策略、不作advisory通过。

## 剩余

游戏库JPEG有界子集解码／规范PNG输出已由[JPEG后继](editor-portrait-jpeg-safety.md)完成，不再等同一vendor批准；后继[Trial PNG切片](editor-trial-portrait-png-safety.md)补有界源矩形规范化／原存储预算及提交前写门；Trial JPEG／裁剪合同、隔离执行、完整格式／独立彩色精度、旧不安全资产策略仍未完成；后继[当前SHA真实链](editor-portrait-workerd-safety.md)已补17项真实worker路由／发布API／匿名App（含原JPEG规范PNG），不冒完整App或所有消费者认证。同时游玩／保存、发布UI和全部消费者／窗口组合也未关闭。
