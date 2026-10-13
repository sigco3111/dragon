# 编辑器单系统壳排期（按 `game-editor-design.md` 严格执行）

> 设计依据：§1 编辑系统独立入口、独立端口、首页为登录页；§4 左侧模块菜单＋右侧主窗口＋"当前游戏"共享上下文；
> §4.6 用户管理与个人资料；§4.7 编辑器专属交互例外；§4.8 草稿测试运行。

## 当前摘要（本地 98f0630 小范围审计）

B1–B4e 已有本机限定链；BOOT-1 已补 installed-source→copy→read/save→publish→pack/assets→上下架，以下各批“bootstrap 缺口”仅为当时记录。当前地图示意仍唯读，据点192／武将128仍锁定，不能据壳齐全宣布完整编辑器。B4e API 生命周期不等全部 UI／上传安全通过，后继[头像UI修正](editor-portrait-ui-fix.md)已补清除按钮／预览守卫／源限制／可调裁剪确认及当前聚焦回归；后继[运行时身份](editor-portrait-identity.md)已修全局byte覆盖及所属world／实体消费者接线，聚焦22项；后继[真实workerd链](editor-portrait-workerd.md)已补上传／保存／发布API／匿名App串行14项，并修隐藏父容器、render后的菜单视图和匿名资源路径；后继[PNG安全切片](editor-portrait-png-safety.md)已补游戏库PNG有界解码／规范重编码；后继[JPEG有界实现](editor-portrait-jpeg-safety.md)补游戏库JPEG规范PNG输出；后继[当前SHA真实链](editor-portrait-workerd-safety.md)补原JPEG公开API／发布／匿名App串行17项；后继[Trial PNG切片](editor-trial-portrait-png-safety.md)补源矩形规范化／存储预算／提交前写门；后继[Trial JPEG切片](editor-trial-portrait-jpeg-safety.md)补旧16384像素预算内矩形规范PNG；更大JPEG源／裁剪／隔离／独立彩色精度与完整格式、完整App、同时游玩／保存、发布UI与完整消费者组合仍缺，见[审计详细源](editor-closeout-audit.md)。node 上传 UI 不属本 workerd 壳范围。

## 历史侦察（2026-10-12，B1 实施前）

- workerd `/` = `server/public/index.html`（手写跟踪文件）＋`client/draft/stage/...txt`
  各节 JS：已有登录表单＋会话＋草稿/阶段/资源/目录/复制/管理/测试运行各
  `<section>`，但**无左菜单/nav 布局**（各节堆叠显示/隐藏），未登录也能看到页面骨架。
- workerd 后端 API 登录/会话/角色/用户管理已齐（tianyi 种子、强制改密、epoch、admin/author）。
- node localhost 侧（`editor-games/entities/studio` 等）是多文档本地工具，无登录；
  设计 §1 的"编辑系统"指互联网部署版（= workerd），node 侧定位为本地工具保留，不在本排期收口范围内。

## 批次

- **B1 单系统壳**（已封存 2026-10-12：静态 34＋live 8＋自检绿）：`/` 未登录只见登录页；登录后左菜单＋右主窗，各节改为菜单切换视图
  （无整页跳转）；菜单项按权限过滤（用户管理仅 admin）；"当前游戏"上下文共享；
  §4.7 脏离开提示。验收：匿名只见登录（DOM 无业务节）；登录后左菜单齐全；菜单切换不整页跳；
  API 鉴权行为不变（回归既有 smoke/矩阵）。
- **B2 用户管理页（§4.6）**（已封存 2026-10-12：profile 四字段＋ADMIN_LAST＋资料 UI，静态 40＋live 10＋自检绿）：增/禁/恢复作者、重置密码、个人资料＋改密、禁用即时撤销会话、
  最后 admin 不可禁。验收逐项对 §4.6。
- **B3 游戏列表对标（§4.1）**（已封存 2026-10-12：静态 47＋live 7＋自检绿）：creator 上架 API（`metadata.setListed`，owner-or-admin、restricted 挡全体、builtin 403、条件 UPDATE）；deletion fence 接线（begin＋query 路由，fence-only 无物理删除）；own-games 列表升级（名/简介/创建/修改/状态＋上架/下架/测试运行/删除＋规则提示）；draft `gotoGame` 跳转；management 行补简介/日期。缺口：有游戏状态流转（list→unlist→delete 全链）需 installed-source bootstrap，另 lane。
- **B4 模块补齐（§4.2–4.5）**：拆 B4a 章节（已封存，见下）→B4b 据点（已封存，见下）→B4c 武将（拆 B4c1 人物基础已封存见下→B4c2 势力／君主／军师／解散）→B4d 地图。
- **B4d1 地图示意（§4.4）**（已封存 2026-10-12：静态 58＋live 1＋自检绿）：唯讀示意圖节 `mapview.txt`（游戏选择＋canvas 放置／道路几何＋道路表，上限 200 行；无编辑——放置 192 锁定、拓扑章节钉死、图块语义未审计）＋`/mapview.js` 接线。缺口：全部结构编辑（管线／放置／道路／扩边／图块，模型锁定，另行排期）。
- **B4c1 武将人物基础（§4.3）**（已封存 2026-10-12：静态 55＋函数单测 10＋live 1＋自检绿）：`renameGeneral`（章内名／字，名非空＋控制字符拒）＋`checkGeneralDeletable`（128 锁定检查单）；draft save 新 op `rename-general`／`portrait`（后者复用 setGeneralPortrait）；武將节（章武将表＋改名／字＋頭像綁定／清除＋刪除檢查＋修订核对保存）。缺口：势力配置（B4c2）＋有游戏全链（bootstrap lane）。上传管线见 B4e（已闭合）。
- **B4c2 势力／君主／军师／解散（§4.3）**（已封存 2026-10-12：静态 57＋函数单测 8＋自检绿）：`setMonarch`（新君主须自由＋无任职）／`setStrategist`（一势力一名，替换回 replaced 供 UI 确认，null 辞退）／`removeMonarch`（继任或解散二选一）／`disbandFaction`（成员转自由＋据点转中立＋删记录，仅本章，join_faction 不动）；draft save 新 op 四个；武將节势力面板（立君主／设军师／免君主／解散＋替换／解散双确认）。缺口：有游戏全链（bootstrap lane）。上传管线见 B4e（已闭合）。
- **B4b 据点（§4.2）**（已封存 2026-10-12：静态 53＋函数单测 6＋live 1＋自检绿）：`cityReferences`/`checkCityDeletable`（放置／道路／章节引用派生；删除为检查单，无 mutation——基础据点 192 锁定、CITY_COUNT_LOCKED 实锤）；據點节（游戏选择＋据点表＋刪除檢查＋规则提示）；worker 接 `/stronghold.js`。缺口：改图／图片清单（无原图提取存量）＋有游戏全链（同 bootstrap lane）。
- **B4e 头像上传管线（§4.3/Q37）**（已封存 2026-10-12：静态 69＋单测 15＋live 全链＋自检绿）：`GamePortraits` 游戏级资源库（owner-only，id 1-32 字母＋保留名拒，PNG/JPEG sniff，100KB，128×128 头解析；删拒在用键）；worker 路由（上传 201／列表 inUse／删除）；publish 冻结进包（manifest.portraits＋sha/mime 重验）；trial-asset 匿名可取；fence 级联；武将节上传面板（canvas 中央裁剪预览）。后继头像UI小闭环已补源文件限制／可调裁剪确认／清除绑定及16项聚焦浏览器回归；后继[运行时身份切片](editor-portrait-identity.md)已修同byte不同key隔离及消费者接线；后继[真实workerd链](editor-portrait-workerd.md)补串行上传／保存／发布API／匿名App，非全程UI；后继[PNG安全切片](editor-portrait-png-safety.md)已补游戏库PNG分支；后继[JPEG有界实现](editor-portrait-jpeg-safety.md)补游戏库JPEG规范PNG输出；后继[当前SHA真实链](editor-portrait-workerd-safety.md)补串行17项；后继[Trial PNG切片](editor-trial-portrait-png-safety.md)补有界源矩形规范化／存储预算及提交前写门；后继[Trial JPEG切片](editor-trial-portrait-jpeg-safety.md)补有界矩形JPEG规范化；剩余更大JPEG源／裁剪／隔离／独立彩色精度与完整格式、完整App、同时游玩／保存及完整消费者组合，详见[头像UI维护源](editor-portrait-ui-fix.md)。node 仅绑定 UI 是保留本地工具的能力差异，不作本壳阻塞。
- **B4a 章节编辑（§4.5）**（已封存 2026-10-12：静态 51＋函数单测 10＋live 8＋自检绿）：gamesource 章节 CRUD（空白新增／本游戏复制／删除／改名，地图共用；章节名只拒空与控制字符，不发明长度规则）＋完成度计数；draft save `chapterEdits`（≤16，严格字段，校验先行）；read 回执带 gaps；publish 无章节 422（设计禁令，原链可发布空章）；draft 节章节管理区（缺口显示＋CRUD＋删章确认）。缺口：有游戏全链（同 bootstrap lane）。

## 初始排期纪律（历史范围）

- 初始壳批仅 `server/public/` 手写文件＋必要 worker 接线；后继 B3／BOOT-1／B4e 已各自登记所需存储、fence及发布接线，不把本排期当新修改授权。
- 每批独立链封存；node 回归绿；`SAVE.DAT` 铁律不变。
