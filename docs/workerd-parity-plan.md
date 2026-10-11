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

## 任务分解

1. **裁决（已定 2026-10-11，用户设计）**：玩免登——玩家入口与编辑器入口分离（将来绑两个域名）；编辑器＝游戏后台，有用户登录。
   落点：玩侧（`/play` 壳、发布列表、已发布游戏的持久会话）匿名可达；发侧（publish/unpublish 及编辑器全路由）保持登录/admin。
   workerd 需新增匿名 actor 能力（仅已发布游戏可玩，会话/ fence 隔离；b2 无过期沿 localhost 理由，公网玩侧过期策略随部署定）。
2. **存储**：发布登记落 Durable Object（对标 node `gameDir/publish.json`），损坏 fail-closed 500（同 node 语义）。
3. **路由**：publish/unpublish/published-games（鉴真规则同 node：gameId 名非空/已编译修订/损坏拒），`/play` 壳（换 boot，不动 trial 壳）。
4. **持久语义**：`persistent` 透传＋`playSaveDatabaseName` 隔离（浏览器侧已就绪，workerd 会话侧接）。
5. **验证**：自检对等段＋真机（ miniflare 或预发环境）下拉→预选→开局→隔离；node 侧回归绿。
6. **封存**：独立链（derive→guards→run→audit→postdoc），不称 Q69 闭包。

## 非目标

- 主壳世界管线（A，已否决）；Q70/Q71；E-01；城/将数扩容；b2 本地语义变更。
