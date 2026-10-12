# Workerd 对等计划（多游戏/发布玩线上闭环，新对话执行）

> 状态：计划（2026-10-11）。node 侧已封存：`a0289e1`（step1）＋`481c782`（step2-B）。
> b2 部署警示仍然有效：localhost 免登无过期仅因无远端暴露成立，workerd 对等必须同时回炉登录/过期。

## 目标

公网 workerd (`server/worker.js`) 与 node (`tools/editor_server.mjs`) 在发布玩链上对等：
`POST /api/publish`、`POST /api/unpublish`、`GET /api/published-games`、`GET /play`（壳＋`?game=` 预选）、持久会话（persistent＋按游戏隔离存档）。

## 现状（已侦察，实锤）

- workerd 已有：`TrialSessions`（`server/trials.js` 与 node 共用）＋ issue/commit/end/portrait ＋ pack/asset/status 路由（`server/worker.js:352-353,369,419-464`）。
- workerd 缺：publish 三件套路由、`/play` 壳、`persistent` 语义、发布登记存储。
- workerd 约束：全路由登录会话（`tokenHash`），与 b2 免登冲突——**需用户裁决**（发布玩是否要求登录；建议：玩需登录，发布需 admin）。
- 本地无 workerd 仿真工具链（仓库无 npm 依赖，需 wrangler/miniflare 或等效，另行准备）。

## 部署形态（已定 2026-10-11）

- 同一 Worker 绑两个域名，按 `Host` 分流：玩域名→玩侧（免登），编辑域名→后台（登录/admin）。
- 端口分流在 Cloudflare 上走不通（CDN 只认 80/443 及白名单端口），localhost 的 8321/8322 只是开发期形态。
- 代码要求：路由不分家，门禁按域名分；部署绑域名即插即用，不改码。（已落码：`EDITOR_PLAY_ORIGIN` 可选绑定，未设＝单域名开发模式；玩域名仅匿名玩路由＋/play，编辑器 UI 与 trial/编辑 API 在玩域名 404；Origin 校验双域名放行。）

## 任务分解

1. **裁决（已定 2026-10-11，用户设计）**：玩免登——玩家入口与编辑器入口分离（将来绑两个域名）；编辑器＝游戏后台，有用户登录。
   落点：玩侧（`/play` 壳、发布列表、已发布游戏的持久会话）匿名可达；发侧（publish/unpublish 及编辑器全路由）保持登录/admin。
   workerd 需新增匿名 actor 能力（仅已发布游戏可玩，会话/ fence 隔离；b2 无过期沿 localhost 理由，公网玩侧过期策略随部署定）。
2. **存储**（进行中 2026-10-11：`server/published.js` PublishedGames 已落＋fence 级联＋worker 接线，伪存储 17 项绿；路由/鉴真下批任务 3）：发布登记落 Durable Object（对标 node `gameDir/publish.json`），损坏 fail-closed 500（同 node 语义）。
3. **路由**（已落码 2026-10-11，未提交：publish/unpublish 登录＋owner＋即时编译鉴真；published-games＋/play＋/api/play/web 匿名；双域名门禁见下。真机留任务 5）：publish/unpublish/published-games（鉴真规则同 node：gameId 名非空/已编译修订/损坏拒），`/play` 壳（换 boot，不动 trial 壳）。
4. **持久语义**（已落码 2026-10-11，未提交：发布即冻结公共快照＋匿名 trial-pack/trial-asset/registry；真机留任务 5）：`persistent` 透传＋`playSaveDatabaseName` 隔离（浏览器侧已就绪，workerd 会话侧接）。匿名 actor 决议：不设匿名服务端会话，发布冻结不可变公共快照（revision 钉死，republish 替换/unpublish-fence 删除），会话只活在浏览器 IDB（按游戏隔离库名），无服务端过期问题。
5. **验证**（已验证 2026-10-11，未提交：node 自检绿＋浏览器 7/7 绿；workerd miniflare smoke 17 项绿＋origin 门 3 向绿＋静态矩阵 20 项绿；完整发布→开局玩链真机留缺口见下）：自检对等段（`tools/verify_workerd_parity.mjs` 常驻 20 项）＋真机（miniflare 程序化：wrangler CLI 被代理 hang，改用其内置 miniflare 4.x＋自签 HTTPS；注意 `useSQLite`＋`bindings`（非 vars）＋`r2Buckets`（非 r2）＋ESModule 含 mjs＋`rootPath`，DO/vars 缺任一即全 /api 500——基线 aca488b 同样复现，已定位非本批代码问题）下拉→预选→开局→隔离；node 侧回归绿。
   缺口（非阻塞，另起 lane）：workerd 完整玩链（staging source→install→copy→save→compile→publish→pack→浏览器开局→隔离）需 installed-source bootstrap（`editor_stage_source.mjs`＋R2 上传＋staged env），本次仅覆盖空注册表面的全部新路由/门禁/错误码；node 侧同链已由 `verify_play_shell_browser.mjs` 7/7 覆盖。
   附带修复（真机发现，node 对标）：`#publishPin` 空名 422 先于权属 404（原 404 优先；node 先验名后查 draft，`tools/editor_server.mjs` 376 行）。
6. **封存**：独立链（derive→guards→run→audit→postdoc），不称 Q69 闭包。

## 非目标

- 主壳世界管线（A，已否决）；Q70/Q71；E-01；城/将数扩容；b2 本地语义变更。
