# 版权与第三方资源说明

## MIT 的适用范围

根目录 `LICENSE` 适用于本项目权利人有权许可的原创程序代码。第三方代码如带有自己的声明，应保留并遵循该声明。MIT 不授予游戏商标、角色、美术、音乐、剧本或其它第三方作品的使用权。

项目用于学习、技术研究与非商业怀旧交流，但这不是在 MIT 中增加非商业限制：MIT 代码可按其条款使用，包括商业使用；第三方资源另行判断。

## 编辑器展示层依赖

用户批准的独立后台展示层使用Vue与Element Plus（MIT）；固定版本／构建锁文件位于`editor-ui/`，不进入玩家／Trial引擎。随束附带实际参与输出的Vue运行时、Element Plus及传递依赖的完整[第三方许可文本](server/public/shell-ui-licenses.txt)，由构建器按实际模块生成，编辑器同源`/shell-ui-licenses.txt`也提供该文本。开发期Vite／Vue插件及其依赖许可保留于安装包；版本与升级按锁文件审核，非项目原创代码不能只适用根MIT声明。

## 服务端第三方代码

- `server/vendor/jpeg-js/decoder.js` 固定取自 jpeg-js v0.4.4、commit `9ccd35fb5f55a6c4f1902ac5b0f270f675750c27` 的 `lib/decoder.js`。原件 SHA256 `a3f175fd6f62d142aad94d3bd90f3a30be4e076baf9b6a6fa31c8e84d9d4aa9f`；保留 Copyright 2011 notmasteryet 及 Apache-2.0 文件头。
- 附完整 [Apache-2.0](server/vendor/jpeg-js/LICENSE-Apache-2.0.txt) 与上游包 [BSD-3-Clause](server/vendor/jpeg-js/LICENSE-BSD-3-Clause.txt) 文本；固定上游根目录无 NOTICE 文件。该第三方代码不改许可为项目 MIT，不代表完整安全认证。
- 本地 ESM／严格码流与边界修改见 [vendor说明](server/vendor/jpeg-js/README.md)。仅服务端包装器使用，不安装 npm 运行时依赖、不进入玩家 Web 束，也不引入云图片服务。

## 资源来源与授权状态

| 内容 | 来源标注 | 许可边界 |
| --- | --- | --- |
| 原游戏图像、角色、文字、数据及音频 | 《卧龙传》，NEO·GETEN 制作、松岗中文化；权利归各相关权利人 | 维护者未取得公开再分发授权，不适用项目 MIT |
| 上／中／下／后改版章节 | 项目现有来源说明：轩辕春秋文化论坛（www.xycq.org.cn）网友 yanguodong | 来源标注不是许可，原作与改版贡献可能分别涉及权利 |
| 开场 `web/intro/assets/opening.mp3` | 项目现有来源说明：《少林足球》Opening，黄英华作曲 | 音乐作品与录音可能有不同权利人；未取得公开再分发授权 |
| 游戏截图、解码图集、导出的音频和研究参考图片 | 原资源的展示、转换或研究输出 | 格式转换、重绘界面或合成音频不自动消除原作品权利 |
| 字体 | `web/font/Oswald-Light.woff2` 标识为 Oswald | 附 [Oswald 上游 SIL OFL 1.1](web/font/OFL-Oswald.txt)；项目 MIT 不覆盖字体。本地字体与上游版本尚未作逐字节来源验证 |
| 开场及 UI 重制素材 | 项目内重制／合成资源 | 不据此主张对所含原作元素拥有独立完整版权 |

Oswald 许可文本来源：[Google Fonts / Oswald](https://github.com/google/fonts/tree/main/ofl/oswald)，保留其版权声明。

这份清单按当前已知来源编写，不代表完整的权利链审计或授权保证。未注明作者或许可证的素材不应被视为公有领域或自由授权。

## 使用提醒

维护者没有取得原版图片、音乐等素材的公开再分发授权。公开源码仓库、学习用途、非商业使用、保留署名或提供删除联系方式，均不自动构成授权、合理使用或免责。请勿将未获许可的素材用于商业用途；公开部署、再分发或其它使用前，应确认所在地法律及所需许可，必要时替换资源。

私有部署说明只描述技术方式，不是对素材使用合法性的法律保证。项目与原作开发、发行及其它权利人无官方关联或背书。

## 权利联系

请通过仓库 Issue 或 <fczllc@163.com> 提供涉及的文件路径、作品及权利说明。维护者会核实并采取移除、替换或补充声明等处理。请勿公开提交证件、合同全文等敏感材料。联系处理机制不消除既有使用的法律责任。
