# TRIAL-PORTRAIT-CROP-1：Trial 服务端方形裁剪＋规范128输出（A切片）

用户按 A/B/C 顺序授权执行；本页为 A 切片唯一详细维护源。只改 Trial 上传链与测试／文档，不改原规则／RNG／原头像 byte，不 deploy/fetch，不触 DOS 存档或用户 profile，不 commit/push（分别授权）。

## 合同与切片边界

- 工程合同（[技术分册](game-editor-technical-design.md)）：上传头像“先检查字节／尺寸／像素上限，再隔离解码、按裁剪参数重编码128×128规范PNG，丢弃EXIF等元信息；客户端预览不替代服务端处理”。
- 产品裁决（[产品§4.3](game-editor-design.md)，2026-10-09 Web 产品决定，非原版机制）：源尺寸不限128（建议值），保源矩形裁 active 显示64×64；“按实际显示比例裁剪、预览并确认，不直接拉伸”。
- 本切片只做 **Trial 服务端**：上传接受可选作者确认方形裁剪 `{x,y,side}`，解码后在已有像素缓冲内裁剪并重编码规范 128×128 RGBA PNG。游戏库已有客户端方形裁剪＋服务端 128 门／重编码，不在本切片改动。
- **不扩大任何解码预算**：裁剪运行于既有解码输出之内（PNG 适配器 ≤4MP／8192边、Trial JPEG ≤16384像素／8192边、输入≤100KiB 均不变）；方形→128 缩放是纯整数最近邻（`out[dy][dx]=in[y+⌊dy·side/128⌋][x+⌊dx·side/128⌋]`），不发明平滑核。无 EXIF／方向处理（解码后 RGBA 本无元信息）、无进程隔离、无完整格式／独立彩色精度认证。

## 改动（当前 SHA）

| 文件 | SHA-256 | 说明 |
| --- | --- | --- |
| `server/portraitcrop.js`（新） | `9cc243755bd18e9d7a4351863bd968e8fac9b2c96f0262035cff29624a5fa94b` | 纯模块：`checkCropShape`（解码前形状门）／`checkCropRect`（解码后边界门）／`cropSquareTo128`；`PortraitCropError` 失败关闭 |
| `server/trials.js` | `cd1a13a2224720b471ea17e4b54fc685e210126ee2cf67367cad1f7d5f0a030d` | `#checkPortraitUpload` 加可选 crop：形状门先于授权，边界门在解码后；`uploadPreview`／`uploadCommit` 透传；畸形矩形 422 `TRIAL_PORTRAIT_CROP`，无原图兜底 |
| `server/worker.js` | `c8e9523d6c2eb97d62ac49df7bfc02fac8fcab08c15e060be41e304edaac0cc5` | Trial 上传路由：有 `crop` 键走三键严格门，无则保持两键旧门；preview／commit 同 crop（幂等键天然区分不同裁剪） |
| `tools/fixtures/trial_portrait_fixture.mjs` | `ffa6ed5334123939327d1d3cd5b3547d904b1d3678b23dfbcbfa9c7e3` | 夹具透传 `input.crop`（缺省即旧路径） |
| `tools/verify_trial_portrait_crop.mjs`（新） | `1169126a182b2e745af3538574e65ba4402958d14b1642b48e202da44d6859f2` | 下述两阶段验证入口 |
| `tools/fixtures/trial_portrait_crop.py`（新） | `09e58583e0b6346bbd88a989cfe412c8dc72c115a6a539e4af563f031b8c5add` | 平坦灰 JPEG 合成与 128 输出独立 Pillow 核 |
| `web/src/editor/servertrialapp.js`（D切片） | `0386710c4fe4ed163437da27ae97fcb3de3b96e898f591e1e18c5770dc635559` | `mountPortraitUploads` 加作者确认方形裁剪：x/y/side 输入、128 预览 canvas、确认门、代次守卫；确认前上传拦截，改选／改参清确认；源字节＋crop 矩形直发本页 A 端点，传后重置 |
| `server/public/trialweb.txt`（D切片束） | `6f864b71df7f868c3db4bf89ffe2a9d6231cbf7ea1fc077bff96fa2c68ecd1f9` | `build_trial_web_bundle.mjs` 重建（217 文件，仅本束变化，无 pin 引用 churn） |
| `tools/verify_trial_portrait_ui_browser.mjs`（新，D切片） | `0938520860e4e8ac8c030783ade1e8d6b1012f84d841d7b53d7b8ef745837ffd` | 下述 D UI 验证入口 |

向后兼容：无 crop／`crop:null` 走旧源矩形路径（字节行为不变）；manifest 条目形状不变（仍 `{assetId,mime,sha256,byteLength,url}`），128 输出由存储 PNG 字节自证。旧资产不迁移。

## 验证（新 scope，不覆写旧 seal）

入口 `node tools/verify_trial_portrait_crop.mjs <轮号>`；scope `.dragon-analysis/editor-phase/trial-portrait-crop-r1/attemptN/`（失败轮保留：attempt1 源 PNG 超 100KiB 门正确拒绝后改用可压缩图案；attempt2–5 为工具期待／断言写法修正，生产未因此改动）。

| 阶段 | 结果（attempt6） | 覆盖 |
| --- | --- | --- |
| 阶段1 TrialSessions 对等 | 24检查／45 HTTP／Pillow 11图 exact | 4 PNG裁剪（居中／角／放大／偏移）＋3平坦灰JPEG裁剪全独立像素 exact；legacy 无裁剪保源几何；13畸形矩形 422 无写＋null 走旧路；换裁剪 commit 判 `TRIAL_CHANGED`；Node／workerd 全调用 deepEqual |
| 阶段2 真实 worker 路由门 | 5门 | 回环 HTTPS＋轮转 admin＋随机 trial：旧形状直达 401 授权（无 `REQUEST_FIELDS` 回退）；合法 crop 同达授权；畸形 crop 先于授权 422；未知键仍 422 |
| 兼容（新 SHA 重跑） | Trial5组／Trial PNG attempt5 66／105／33／Trial JPEG attempt3 58／124／84／库17／壳69／对等20 | 旧收据不拼绿；游戏库文件未改，其单测收据仍立 |

主动 LSP 六文件 clean，`git diff --check` 通过。失败现场（attempt1–5）保留，只计 attempt6 通过。

D UI 壳裁剪控件（新 scope，不覆写 A seal）：入口 `node tools/verify_trial_portrait_ui_browser.mjs <轮号>`；scope `.dragon-analysis/editor-phase/trial-portrait-ui-r1/attemptN/`。真 Chromium＋fresh profile＋回环静态 `web/`，被测模块真实 import，fetchImpl 与 pack 均为 stub：只证 UI 行为（默认值、确认门、crop 载荷、拒绝路径），不证 workerd 认证或解码（A／C lane 已覆）。200×100 自有图案：居中默认 50/0/100；确认前上传被拦且零 fetch；确认后发出源字节＋矩形；改参清确认；错类型／超 100KiB 拒绝且零 fetch；零页面错误。失败轮 attempt1–3 保留（bare require／确认按钮与状态选择器／传后重选流程），attempt4 通过：7检查。

## 仍缺（不关闭）

更大 JPEG 源接受／OS 隔离（见[预算探针](editor-portrait-decode-budget.md)）、浏览器 App 运行、完整格式／独立彩色精度／旧资产策略、并发与全部消费者组合；Q37／Q69／Q70／Q71 不关闭，见[逐项索引](editor-requirements-matrix.md)。Trial 壳裁剪控件（D切片）已接，见上 D UI 验证。公开 Trial 链（真实认证＋R2 安装＋开局＋裁剪上传／serve／manifest／结束，15检查／1图 exact，无浏览器 boot）已在当前 SHA 另立新轮通过，见[本地验证](editor-local-validation.md) TRIAL-PORTRAIT-PUBLIC-1。
