# WORKERS-DEPLOY-1：v0.1.7 自动部署与 R2 接线审计

范围：用户要求根据当前仓库结构排查 GitHub 推送后 Workers 部署失败，并回看相对旧游戏的改动。基线为旧 GitHub main `c9ce065`，本次发布为 `42f0f365825484ae9a1f3c14370d444562615596`。本批只修已复现的静态打包边界；未提交、推送、修改云配置、重部署、读写真实存档或写入 R2。持续部署说明维护于[deployment.md](deployment.md)，本页记录限定批次证据。

> 后继说明：本文资源准入缺口描述的是 WORKERS-DEPLOY-1 当时状态。用户随后选择A，已补本地签名／固定资源角色通道、退役泛 key 读取；完整前端／持久分发／云接线仍未完成，现状统一见[R2接线](r2-player-connection.md)。以下§1–5仍为历史证据；后继自动部署设置与真实失败日志复核见§6。

## 1. 实际部署状态与证据边界

- GitHub 对该提交的 `Workers Builds: dragon` check `117054247739` 为 `completed/failure`，指向构建 `9599c02f-b57a-4ed3-9ce0-6b71e6ba44b0`。Release 发布成功不代表 Workers 部署成功。
- 当次直接读取 `https://dragon.720108.xyz/src/game/clock.js` 仍见旧五档 `[60,35,20,10,3.125]` 和 cap6，不是本次 `[30,17.5,10,5,1.5625]`／cap12。该观察只证明所取线上文件不是本次新版，不代完整线上版本鉴定。
- 用现有 Wrangler OAuth 只读查询 `dragon/settings`：`bindings: []`，compatibility date `2025-04-01`。未见生产 R2 binding，不把“桶里有素材”写成“玩家已接入 R2”。
- Builds 的 metadata/logs API 返回403／12004，浏览器桥接报 `No current window`；未提升权限、换凭据绕过或触发构建。**以下本地错误可确定阻断现脚本，但尚未取得云日志，不能宣称它是该次远端失败的唯一原因。**

## 2. 相对旧版的结构变化

| 内容 | 旧版 | 当前实现／缺口 |
| --- | --- | --- |
| 内置内容 | `content/builtin/catalog.json`、根目录 `data.json`／地图资源 | `catalog.js`、`worlddefinition.js` 经 `builtinrelease.generated.js` 指向 `content/builtin/compiled/map-2-<digest>/` 的一致运行包；仍是同源静态 URL，不是全量迁到 R2 |
| 编辑创作源 | 无此次统一地图源包 | 新增多个约37～41 MiB的 `game-source.json`；编辑源和编译运行产物并列，但玩家启动不读编辑源 |
| 玩家入口 | 内置新局／本机存档 | `startmenu.js` 增目录和公告；`playapp.js` 增自建游戏持久会话，共用引擎且按游戏隔离存档；仍调用旧 `/api/published-games`、`/api/announcements`、`/api/trial-pack` 等接口 |
| 头像 | 静态 `kao/<byte>.png` | `77d7b9e` 退役上传：共用621画像库；正式包仅记 `kao/<id>.png`／SHA，不嵌头像字节。历史记录确认 R2 首传，本批没有重新列桶验证 |
| R2 分发 | 无 | `vps/publish_to_r2.mjs`、`reader/worker.js`、Outbox 原型已入库；reader 提供 `/play-api/v1/*`，与现玩家接口未完整接通，资源票据／已提交release准入门及生产恢复仍缺 |
| 云端入口 | 根 `wrangler.jsonc` 纯静态 | 根配置与旧版未变，仍只有打包步骤＋`dist/`；没有 Worker `main`、R2 binding 或上述 API 路由 |
| 编辑器后台 | 无 | `server/wrangler.jsonc`、`server/`、`vps/` 为独立目标；不能因同仓库就自动部署到玩家 `dragon` |

已核原记录：Git `77d7b9e` 的提交说明和 `server/playpacks.js` diff；[开发待办 H 节](editor-dev-todo.md#h-用户已决策2026-10-14)的画像／R2／V5决定；[v0.1.7审阅](release-v0.1.7.md)的生产缺口。早期[平台拆分方案](editor-vps-cloudflare-plan.md)仍保留“尚未实施”的历史状态，不以此否认后继首传和原型实现，也不以原型测试证明已上线。

## 3. 复现与最小修复

将 HEAD 的 `web/`、打包脚本及根配置用 `git archive` 导出到独立目录，运行原脚本，无本机未跟踪文件参与，得到：

```text
Error: Exceeds 25 MiB: content/builtin/compiled/map-2-19e2b03991ee4cf77c58ba44ef14313f213f93dbe8984407ff16392cb7748797/game-source.json
```

共有4份超限创作源，字节数为38,956,704（两份）、43,308,095、43,308,092；当前活动修订也超限，不能只删历史修订解决。旧脚本递归复制整个 `web/`，触发自己的25 MiB守卫，尚未到上传阶段即失败。

修复仅在 `tools/prepare_deploy.mjs` 排除精确路径模式 `content/builtin/compiled/[^/]+/game-source.json`：

- 不删除仓库创作源，不改游戏引擎、编译数据或 R2 对象。
- 保留当前及历史运行包、共享引擎模块、四季图集／地图、小地图、头像和既有音频。
- 不泛化成“所有大文件都略过”；运行资源超限仍硬失败，且校验失败发生在删除旧输出前。
- 不整目录排除 `src/editor/`：玩家 `main.js` 仍依赖其中的 Trial／存储能力模块。

## 4. 限定验证

- 新增 `node --test tools/verify_prepare_deploy.mjs`：5项通过。每次自有临时根／dist；覆盖创作源排除与运行字节保留、超限运行文件拒绝并保旧输出、同名不同路径不豁免、25 MiB边界、旧音频／调试过滤。无网络或真实存档 I/O。
- 干净 HEAD 导出只替换修复后的脚本，打包1377文件／149.84 MiB。
- 已安装 Wrangler 4.96.0 对该隔离副本 `deploy --config wrangler.jsonc --dry-run` 成功；未上传／切流。输出仍 `No bindings found`，不是 R2 认证。
- 对**打包后的 dist**运行既有真实生命周期浏览器测试（仅把服务器根改到本批 dist，并增加失败请求断言）：开场→真实新局→隔离 IndexedDB 保存→坏档拒绝→标题退出／取消迟到动作→读取恢复，通过，console/page/request错误均无。全新 Chromium/context、自有 loopback监听；明确 mock 两个空目录／公告 GET 防止访问本机8322。因此只认证内置静态发行包，不认证真实目录、R2、自建游戏或所有战术／战役。
- 两个工具语法检查、`git diff --check`、13个本地文档目标及验证入口SHA稳定检查通过；5个变更文件主动LSP无error，打包脚本保留既有CLI `console.log` 风格warning。session `mode=all` 另有未改动旧文件的缓存风格阻断／warning，不据此声称全仓库lint清零。
- 详细本地证据在被忽略的 `.dragon-analysis/workers-deploy-audit/`：`clean-tree/`、`worker-settings.json`、`dry-run.log`、`validation-inventory.json`、`validation-results.json`、`packaging.log`、`packed-browser.log`。不提交凭据或运行产物。

## 5. 尚未完成

1. 取得 Cloudflare 该次真实失败日志，核控制台的仓库根、分支与部署命令；未据本地干跑声称自动部署已恢复。
2. 后续提交、推送需明确授权；通过现有 GitHub→Workers 链路重新核构建记录与线上提交，不用手动部署冒自动部署验证。
3. 若要求此次上线同时支持 R2 自建游戏，须完成客户端接口／URL映射、公开读取Worker及binding、资源准入／状态门、正式产物闭包与分发恢复，并实测独立存档和下架／删除边界。不能直接部署当前 `reader/worker.js` 或把编辑器私有后台暴露到玩家域。

## 6. 后继自动部署配置复核（WORKERS-AUTO-1）

用户要求优先保证游戏端Workers自动部署。本批不扩大游戏功能、不新增辅助测试或部署框架。

- GitHub实时查询仍为`42f0f365`的同一个失败check。本地检查点`d2acb08`尚未推送。现有Wrangler OAuth只读API返回401／10000；没有提升权限，改用用户已登录的Cloudflare控制台。
- **已取得真实云日志**：上述构建使用Wrangler **4.151.1**，实际执行`[custom build] node tools/prepare_deploy.mjs`，明确因`map-2-19e2b039…/game-source.json`超过25 MiB失败。由此闭合§1当时未取得云日志的缺口；不是认证、克隆失败，也不能归因为未执行钩子。
- 控制台原设置：GitHub仓库正确、`main`、根`/`、构建命令空、部署`npx wrangler@4 deploy`。仅改为显式构建`node tools/prepare_deploy.mjs`及部署`npx wrangler@4.96.0 deploy --config wrangler.jsonc`；保存后重新导航设置页，读回两项新值及根目录。没有点击重试／新部署，没有改令牌权限、域名或生产绑定。
- 将当前工作区的1552个Git跟踪输入（明确限定web／reader／vps及根配置、打包器）复制到自有临时目录，隔离HOME／APPDATA和临时路径，不读凭据、不碰共享dist。已安装Wrangler4.96.0的普通干跑及`WORKERS_CI=1`下显式打包再干跑均成功。发行清单1391项／约150.07 MiB，Worker约43.99 KiB；输出明确包含R2／ASSETS绑定。仅本地模拟CI，**不是Cloudflare远端构建成功**。
- 静态清单SHA `dd811271f906a67b89d3678d810bb41b8c569881fe02d5f9a4ba067a2f836f3c`；证据在`.dragon-analysis/release-readiness/workers-auto-r1/`。本次没有改产品代码或删除运行文件，没有安装依赖。
- 自动部署最终验收仍须以符合发布条件的GitHub提交触发新的成功check、部署SHA和实际站点检查为准；目前生产仍为旧静态Worker，不能把保存构建配置或本地干跑描述为新玩家端已上线。维护中的执行命令见[部署指南](deployment.md#workers-static-assets本站当前链路)。
