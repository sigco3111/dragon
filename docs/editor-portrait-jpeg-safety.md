# PORTRAIT-JPEG-CANDIDATE-1：服务端固定JPEG解码／规范输出

用户在[JPEG路径调查](editor-portrait-jpeg-path.md)后明确「同意」仅服务端vendor方向。候选先验证，再接游戏库；**完成本页限定域，不关闭Q37／工程§6全部图片安全**。无npm运行时安装、云Images binding、玩家Web束或游戏规则改动。

## 来源、许可与本地适配

- 固定 `jpeg-js v0.4.4`／commit `9ccd35fb5f55a6c4f1902ac5b0f270f675750c27`，原decoder 40,593字节／SHA `a3f175fd6f62d142aad94d3bd90f3a30be4e076baf9b6a6fa31c8e84d9d4aa9f`。已完整读审1151行；调查原件与公开来源保于本机 `portrait-jpeg-path-r1` scope，不从浮动master安装。
- 保留Apache文件版权头，附[Apache-2.0](../server/vendor/jpeg-js/LICENSE-Apache-2.0.txt)和[包BSD-3-Clause](../server/vendor/jpeg-js/LICENSE-BSD-3-Clause.txt)完整许可；固定根目录无NOTICE。更新[第三方说明](../THIRD_PARTY_NOTICES.md)和[vendor维护说明](../server/vendor/jpeg-js/README.md)，不是以项目MIT重授权。
- `server/portraitjpeg.js`先独立预检容器／表／扫描／颜色／预算并剥全部APP/COM，然后同步调用vendor；显式关闭容错，固定16,384像素及4MiB近似分配计数。未经包装器不调用该codec处理上传。同步调用无新await／重入入口，不把模块内存计数称为进程隔离或硬RSS／CPU保证。
- vendor只作ESM导出和严格边界修改：熵字节EOF／stuffing，最终全1填充与精确scan终止、RST顺序／间隔／末段剩余MCU，baseline／渐进AC run、refinement跨块及EOB状态，8bit系数范围。撤上游跳过任意尾熵及末restart interval越界；IDCT、颜色转换与上采样算术保持上游。独立完整差异见本机父scope `decoder-upstream-final.patch`，初转换收据不冒最终源码hash。

## 当前支持域与拒绝域

| 边界 | 当前实现 |
| --- | --- |
| 规范输入 | 游戏库仍先owner／强制改密／内置／ID／保留名／重复键门，单文件≤100KiB、128×128。任意源图由现UI裁剪到此边界，未新增服务端任意矩形裁剪 |
| JPEG过程 | 单帧8bit SOF0／SOF1顺序DCT或SOF2渐进；灰度一组件h/v=1，或三组件明确YCbCr／RGB；采样1..4且总MCU块≤10；最多256段／64扫描 |
| 表与扫描 | 非零8bit量化表、已使用量化表不重定义；Huffman前缀容量／保留全1码／符号与类别范围；预定义表、组件有序、渐进初始／精化与频段状态，全部系数有首次扫描 |
| 终止 | 完整熵解码、restart计数／顺序和padding；EOI必须是文件末尾，拒截断／额外熵／尾随HTML／第二帧／缺扫描。不是通用多态检测或完整T.83符合性证书 |
| 元信息与颜色 | APP/COM只在预检读取结构，不传codec／不落存储；EXIF、注释、缩略图均不持久。拒ICC／MPO、CMYK/YCCK、Adobe transform2、未知／冲突颜色；不做任意色彩管理 |
| 其它过程 | 拒无损／算术／分层／DNL／12bit及未知marker；这是明确有界子集，不宣称所有合法JPG都支持 |

码流门依据公开[T.81](https://www.w3.org/Graphics/JPEG/itu-t81.pdf) Annex B/C/E/F（marker/长度与表、扫描、padding/restart）及固定上游调用链。128／段数／扫描／内存预算是工程限制，非DOS机制。只有边界核验通过后的RGBA进入未改`server/pngio.js:encodePNG`；JPEG与PNG新上传均规范为`image/png`，DTO／SQL／`forPublish`的字节、长度、mime、SHA统一取该输出，未持久化原JPEG。同步保留原认证及拒绝顺序。

## 验证与可复核收据

本机父scope `.dragon-analysis/editor-phase/portrait-jpeg-candidate-r1/`，工具`tools/verify_portrait_jpeg_safety.mjs <新轮号> <candidate|library>`；test-only真实SQLite DO在`tools/fixtures/portrait_jpeg_worker.mjs`，Pillow白名单oracle在`tools/verify_portrait_jpeg_oracle.py`。执行前I/O登记于[验证清单](editor-local-validation.md)。真实Node内存SQLite／workerd DO SQLite，**账户／游戏行是明确合成夹具，不是真实认证／公开worker路由／R2／发布／App**。

- 候选attempt3：85检查／84 HTTP；28正例、56负例，独立Pillow读取28输入＋28规范输出共56图。通过后才接`GamePortraits.upload`。
- 正式游戏库最终attempt5：**91检查／90 HTTP**，同28正例／56负例另加六既有gate／无写入，56张Pillow输入／输出；所有DTO、完整头像表行的字节SHA与`forPublish`输出一致。Node与workerd返回逐值相同。
- 正例含真实Pillow基线／渐进灰度及444/422/420三种彩色采样、独立手工码流顺序／渐进／精化／64扫描、非整除restart与末段、RGB标识／Adobe0、元信息剥离及精确100KiB。
- 负例含假头、坏长度／截断／尾随／第二帧、空或多余熵／stuffing／pad／RST、坏量化／Huffman／系数与run溢出、渐进refinement跨块／状态／频段、65扫描／257段／输入预算、ICC／MPO／重复组件／采样／颜色；拒绝前后完整头像表行及字节SHA不变。
- 中性／灰度与手工参考完整RGBA精确一致。六个彩色Pillow/libjpeg输入与上游输出不完全一致：444/422/420最大通道差分别3/43/78，基线与渐进均登记；本地输出与固定上游算术逐字节相同。**没有用epsilon追绿，也不将此差异登记算作独立彩色精度／Part-2符合性通过**。输出PNG由Pillow完整RGBA复核，与实际解码输出精确一致。
- 当前PNG新attempt5：54检查／53 HTTP及30张Pillow图；此前“假JPEG头仍200”历史对照已改为当前422／无写入，旧密封轮原件不覆写。库单测17、壳69、静态对等20通过；语法与主动LSP／文档校验在父报告列明。

最终生产`portraits.js` SHA `0fa8f46f00a0e7568a1c52060e2e79c5a30261ea345745cfab3b8d065eaa83b8`；wrapper SHA `f3a0dde39476969b0e916b64bbaa3358cc412a7a76cdfd61afcc6d50f2c538fa`；vendor SHA `8edfaf7a440c59edd07025b25150c8ac3a7611793cf9addc8f0406bfb96b5dce`。共享PNG适配器未改；当前直接输入／原件／本地差异／收据／文档再核于父scope最终报告，不冒全仓动态I/O图。

## 失败与历史身份

候选attempt1实捕未改上游单组件restart余段越界，保19检查／20调用现场；只对两个已明确fixture登记上游精确TypeError（不广泛吞异常），本地末段完整像素仍独立验证。新attempt2通过后补refinement跨块guard及新负例，再全新attempt3通过；旧attempt2不是最终源码。正式attempt4通过后只修新wrapper／tool风格提示，再新attempt5同期待通过，不覆盖旧收据。候选及正式轮均独占目录、输入快照与运行后SHA复核。

## 静态交付检查

八代码路径主动LSP：7clean／1findings，vendor继承上游11条unused hint，无warning/error；十二文档路径8clean／4findings，仅28条既有typos信息。session-all（warning过滤）另有旧startmenu导航1error、11warnings／112hint-info，未据缓存宣称全仓clean或清除旧GameBar扫描上限。七JS语法及两Python AST通过；文档／许可证链接、表格、73编号、新增乱码、diff与最终输入／收据hash由父scope报告独立再核。

## 仍未完成

后继[当前SHA真实链](editor-portrait-workerd-safety.md)已补17项真实账户API／R2／UI绑定／发布API／匿名App，含原JPEG规范PNG及三实体全部RGBA；不是完整App／所有消费者认证。后继[Trial PNG切片](editor-trial-portrait-png-safety.md)补有界源矩形规范化／存储预算及提交前写门；Trial JPEG原图安全／裁剪合同、进程隔离与硬CPU／RSS限额、独立彩色精度／完整格式支持、旧不安全库／历史包处理策略仍缺；并发传输、发布UI及所有消费者／窗口组合另列。旧14项功能链不能拼成新SHA全绿，不自动迁移资产、修改规则／Web束／pin、安装依赖、部署、提交或推送；不触实际SAVE或用户浏览器profile。Jev旧HTTP451地区限制未解除，不重复绕策略、不作advisory通过。
