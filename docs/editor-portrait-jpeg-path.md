# PORTRAIT-JPEG-PATH-1：服务端JPEG解码路径调查（历史批次）

> 后继状态：用户已明确「同意」仅server固定源码vendor方向，候选有界审计／验证后已接游戏库，详见[JPEG实现维护源](editor-portrait-jpeg-safety.md)。以下“未执行／待范围确认”只指本调查批，不能重复索取同一批准；Trial／隔离／完整验收仍开放。

用户「继续」授权JPEG安全接续。本批先验证平台能力、候选来源和约束，**未引入生产JPEG解码器，未关闭Q37／工程§6**。上批游戏库[PNG安全切片](editor-portrait-png-safety.md)保持原样；JPEG仍header-only，Trial原图仍未规范处理。

## 已核事实与限定证据

- 仓库 `server/wrangler.jsonc` 使用兼容日期 `2026-01-01`、`nodejs_compat`，未声明Images binding。本机自有随机loopback、无存储／账户／图片数据的Miniflare worker实际返回200；Node与workerd的指定全局 `ImageDecoder/createImageBitmap/OffscreenCanvas/HTMLCanvasElement` 均为 `undefined`。这只证本次环境的四项能力及仓库配置，不穷尽所有原生API，也不证明线上账户是否开通服务。
- 收据在本机 `.dragon-analysis/editor-phase/portrait-jpeg-path-r1/receipt.json`：一次HTTP，三项直接输入SHA与执行后复核。结果名 `OBSERVED-CAPABILITIES-NOT-DECODE-PASS`，不是JPEG像素／安全／发布／App通过；没有复用浏览器预览充当服务器解码。
- 只查询公开标准、平台文档及候选代码／许可，没有把用户图片、原版资源、凭据或私有日志外发。第三方源码仅以 `.txt` 保存于ignored调查scope，**未执行、未安装、未加入生产或Web束**；不是完整源码安全审计。

## 路径比较（工程建议，未获依赖／平台变更授权）

| 路径 | 可确认的条件 | 当前结论 |
| --- | --- | --- |
| 已有原生接口 | 上述四项在当前Node／workerd不可用，仓库没有Images binding | 不能直接用Canvas／ImageDecoder补服务端JPEG；不靠改兼容日期猜放行 |
| Cloudflare Images | 官方文档说明需每Worker配置binding，可从原始stream解码并输出PNG；生产转换涉及计费，线下与远程测试实现不同 | 是外部平台资源接入，不是零新增能力；未经授权不改配置、开通服务或使用远程图片处理 |
| 自写JPEG像素解码 | T.81区分基线／渐进式与不同编码过程；仅头部／基线路径不能代表完整JPEG | 不把临时自写熵解码／IDCT当安全替代，也不以拒绝全部JPG绕过产品要求；须独立实现与标准／像素／恶意输入认证 |
| 固定第三方解码源码随库维护 | `jpeg-js`的公开解码源码存在SOF0／SOF1／SOF2分支，包运行时dependencies为空；可研究仅取decoder并适配ESM | **推荐继续审计的候选，不是已认证安全库**。仍属于新增第三方代码，不能因“不运行npm install”假称零依赖或自动获准 |

## 候选来源、许可与风险

候选是上游 `v0.4.4` tag，本次GitHub API解析为commit `9ccd35fb5f55a6c4f1902ac5b0f270f675750c27`。按immutable commit读取的 `lib/decoder.js` 为40,593字节、SHA256 `a3f175fd6f62d142aad94d3bd90f3a30be4e076baf9b6a6fa31c8e84d9d4aa9f`；原件与URL／长度／SHA保存于scope `public-sources.json`。`package.json`源内版本仍为development值，候选身份以tag解析及commit／字节为准，不把该字段伪改成发布版本。

- 包LICENSE为BSD-3-Clause，decoder文件头及README另载上游Apache-2.0声明。若采用，须保留对应版权／完整许可、来源及修改说明，更新[第三方说明](../THIRD_PARTY_NOTICES.md)；不是项目MIT自动覆盖。当前没有修改许可证或引入该库。
- 源码默认 `tolerantDecoding:true`、100MP、512MiB近似内存预算，**不能直接沿用在头像入口**。关闭容错也不自动证明完整容器／尾随／多态拒绝；须独立预检、维度／组件／采样／扫描与内存／CPU边界、完整码流及终止门。
- 上游已披露CVE-2020-8175：低于0.4.0存在资源消耗风险。候选高于该修复版本，仅排除此公告版本范围，**不代表不存在其它漏洞或已完成当前版本全公告／源码审计**。
- 候选内存计数是同步解码模块状态，输出可携EXIF／comments；生产适配必须只取核验后的RGBA并用现有PNG编码器生成规范输出，不持久化原JPEG或这些元信息。实例／重入／异步生命周期与真正隔离执行仍需验证，不能把内存计数称为进程沙箱。

## 调查时的范围确认建议（已获后续批准）

建议批准：**仅在服务端引入固定版本、可审计的第三方JPEG解码源码（随仓库vendor，不新增npm运行时安装、不接云图片服务、不进入玩家Web束）**；批准的是候选审计／有界适配方向，不是安全验收或部署许可。

批准后按独立新scope完整读审候选、保原件／最小ESM修改与许可证，先做有界码流预检和候选隔离验证，再以真实基线／渐进、灰度／RGB及明确支持的色彩域、坏表／截断／尾随／多帧／扫描／资源预算负例与独立像素参考验证Node及workerd。IDCT／采样差异必须明确来源，不临时放宽像素期待来追绿；候选失败则不接正式上传路径。服务端规范PNG的mime／SHA／存储／发布统一绑定，改为异步时还须沿用返回与提交前真实owner／epoch／删除栅栏复核。

在确认前不引入库或平台binding，也不削减现有JPG支持。独立调查已完成；JPEG解码实现依赖上述范围确认，PNG和其它已有工作不被撤销。本批不运行旧密封游戏／浏览器lane，不commit／push／deploy／fetch、不访问真实存档／profile。

## 可复核公开来源

- [JPEG T.81标准](https://www.w3.org/Graphics/JPEG/itu-t81.pdf)；像素精度／符合性不能仅由基线支持标签推定。
- [Cloudflare Images binding／配置／计费／本地与远程](https://developers.cloudflare.com/images/optimization/binding/)及[格式限制](https://developers.cloudflare.com/images/get-started/limits/)。本批未调用该服务。
- [tag解析](https://api.github.com/repos/jpeg-js/jpeg-js/git/ref/tags/v0.4.4)、[固定decoder源码](https://raw.githubusercontent.com/jpeg-js/jpeg-js/9ccd35fb5f55a6c4f1902ac5b0f270f675750c27/lib/decoder.js)、[README许可](https://raw.githubusercontent.com/jpeg-js/jpeg-js/9ccd35fb5f55a6c4f1902ac5b0f270f675750c27/README.md)、[包LICENSE](https://raw.githubusercontent.com/jpeg-js/jpeg-js/9ccd35fb5f55a6c4f1902ac5b0f270f675750c27/LICENSE)。
- [CVE-2020-8175公告](https://github.com/advisories/GHSA-w7q9-p3jq-fmhm)及[公告结构化原件](https://api.github.com/advisories/GHSA-w7q9-p3jq-fmhm)。仅此公告已核，不冒完整安全清单。
