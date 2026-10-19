# 第二阶段：表现层现代化

用户批准先提交现有成果，再开始本阶段。此前存储/内容扩展的“第二阶段”见[另文](web-refactor-phase2.md)，不与本阶段混淆。

## 原则与边界

还原的是游戏规则，不是DOS渲染技术。继续使用原生ES Modules与Canvas 2D，无框架、构建或运行时依赖。AI、规则时序、天气作用位置与范围、随机数消费、消息顺序、六队结果及存档不因表现升级而改变。

规则Clock和表现时间不互相替代：规则层产生离散权威状态，表现层只读投影；不能预设所有效果都独立计时或都由同一个时钟直接推进。显示缓存不进入IndexedDB、不反向驱动规则。军团位置仍受规则步点/周期约束，不可为了流畅提前到城。

## 现行云雨与季节（整体时钟重构取代旧独立节拍）

详细原证、关系图与现代差异统一见[战略时序](re-notes-strategic-time.md)。旧100ms云动画、120ms指数追赶、300ms淡入淡出和接战固定五声已撤销；`presentationclock.js`不再是这些消费者的时间源。

- `game/weather.js`显式执行2533准备：32固定对象按槽消费dirty，返回本次OLD帧并写下一存储帧；主更新／日历和消息续段返回后才准备。绘制不写规则对象、不消费RNG。
- `render/weatherpresentation.js`持有16视觉槽，以对象interval和战略serial插值已提交位置；物理回卷直接重定位，失活立即移除，不延寿。仍直接绘制原八帧PNG、16×9格尺寸、灾害之上/UI之下，无额外雨丝或重绘云体。
- 任一战略hold或speed0冻结位置和相位；恢复不补墙钟债，Scenario更换清缓存。页面隐藏／runtime禁用／场景转换遵循原所属门。声音请求来自原生到期分支，BGM和SFX的播放时基独立，不把所有音频都按战略速度缩放。
- 季节在换季月day1..16/hour1按日期渐变，加载也按实际日相位；生成当日256×256 atlas后使用既有分块地形。现代8-bit RGB混合不冒称原4-bit DAC量化；资源端口及同季迟到请求仍检查所属。
- 进入地图前预载原云雨／灾害帧；`MapView`只绘制已采样结果。重复draw不推进动画、对象timer或日历。

## 验证合同

纯内存验证五档共享Clock、timer/dirty/OLD帧、回卷、暂停/恢复、Scenario替换及绘制输入不变性；隔离浏览器验证八帧与原PNG逐像素一致、重复draw一致、Scenario/RNG只读、hold冻结、120ms负载仍有界推进及资源ready，并保留火灾/暴动、TALK71/72和季节日期／像素／月结通知回归。完整执行结果与覆盖限制只记录在[journal](checkpoint-journal.md)。这是对已实现Web合同的验证，不宣称美术效果已获用户验收或性能已经提升多少。

## 渲染脏层：只缓存像素，不跳过业务回调

`render/retainedlayers.js`由`MapView`持有，将绘制命令分成terrain、objects、environment、ui四段，cursor最后单独绘制。先跑所有原producer，再按命令/Canvas状态变化决定重绘；**GameBar布局与消息队列drain每次照常执行**，不把它们误当纯绘图跳过。

这些是渲染命令／缓存分段，不代表地图源已经拆成可编辑组件或建筑／地形层。后继的[统一地图编辑合同](game-editor-design.md)与[当前游戏地图改造](game-map-migration-plan.md)另行定义创作结构和自动小地图；先改造验证当前游戏、再建设编辑器。小地图生成与动态覆盖须继续遵守只读规则、RNG隔离和缓存失效边界，不能以新美术改动输入／暂停政策。

- 保存不透明的累积前缀，而非透明文本层，保留字形抗锯齿、alpha混合、图案、遮挡次序与原像素。指针单独改变时只拷贝已缓存UI前缀再画指针；完全稳定时不重新提交像素。
- 状态/path/query操作在1×1 scratch context执行，不提前修改主Canvas状态栈。若消息producer同步重入draw，先提交外层命令，再将嵌套及剩余外层切到直绘；保留原调用顺序，不重跑消息回调，也不把外层tape覆盖成内层tape。
- 前缀连续稳定后才保存checkpoint。对象连续变化时短暂回退直绘，每30次draw再探测；这是Web性能策略，不是规则timer，也不增加RAF/规则步。初版逐层全幅拷贝曾使移动场景变慢，已撤销。
- 地图分块源明确为不可变；其它canvas/video源视为易变。图片就绪/尺寸、命令参数、相机、选择/标签/所属、季节、场景层级、viewport/DPR与字体加载均参与失效。绘制结果不进入Scenario/IndexedDB。
- 四张checkpoint的名义RGBA总量超过64MiB时清空并直绘（不含主Canvas或浏览器额外内存）。非DOM测试mock也用原直绘路径。`view.draw({uncached:true})`是像素对照/诊断入口，不改变规则。
- 当前录制器只面向现有地图/UI的Canvas操作集；新增gradient、readback或跨层clip/path依赖须扩展对照验证，不能当通用Canvas代理直接采用。它减少栅格化，**不消除城市/军团扫描、布局、消息处理等JS成本**，也不承诺持续移动或全部设备更快。

## 火灾/暴动只读播放器

`render/disasterpresentation.js`集中预载与绘制原16张逻辑相位PNG；原`mapview.js`预载导出保留为转发，启动接线不变。只读取前16槽原顺序、active/group/frame/XY，保留5×5格尺寸与中心锚点，移除即消失。与云雨共用显式2533准备的帧快照，**无独立换帧时钟、淡入淡出或延寿**；重复draw不消费dirty或推进存储frame。资源ready只触发重绘，不发消息或消费RNG。

机制链不在此重写：已保留的原证入口为KI `0x34B1`（TALK71/72返回边界）、`0x23FF/0x2438`（分配/移除）、`0x2459`（timer）与`0x2533→0xD51F`（原帧映射），详见[环境与时钟维护源](re-notes-kernel.md)。这是现有绘图的只读抽取，不新增原版机制结论。

## 新增验证

- `tools/verify_render_layers_browser.mjs`：fresh隔离页面，192据点；稠密组另含128军团、16灾害及16云。DPR 1/1.25/2，7批×20draw（含一次像素读回）的中位耗时；同轮cached/direct对照区分稳定、指针和移动场景。**这是合成draw微基准，不是完整RAF/FPS或整战役性能**。
- 同脚本逐像素对照pan、所属/文字、selection、UI显示、对象移除、季节、场景撤销/恢复、指针移除、动态canvas源与resize；另对照含save/clip的嵌套draw。检查Scenario不变、稳定帧免栅格化但UI回调仍调用、重入不重复producer。
- `verify_retained_layers.mjs`覆盖缓存调度、字体失效、直绘回退与容量释放；`verify_disaster_presentation.mjs`覆盖八相、空槽/槽序/容量、不可变输入与即时移除。既有weather浏览器与native对象消费者回归继续约束TALK71/72顺序、规则寿命、RNG及暂停语义，不用新测试另定规则。
- 实际测量、失败尝试、完整安全回归与诊断限制只在[journal](checkpoint-journal.md)记录。

## 后续切片（未实现）

1. 根据真实RAF profile再评估producer的JS开销与高DPR全幅拷贝，不直接承诺进一步收益。
2. 统一可共享的资源/表现生命周期，但不强行合并战略环境、接战音效与战术Session不同的暂停政策。
3. 更换更多美术或音频表现时逐项交付，不顺带修改AI、规则容量或输入工作流。
