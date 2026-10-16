# Fixture patches（被忽略目录 `.dragon-analysis/` 的可重放修复）

`.dragon-analysis/` 被 git 忽略，里面的 fixture 改动不会随 commit 旅行。
本目录保存统一 diff，供换机器／清缓存后重放。

## write-gate-multiwaiter.patch

死锁项根因修复：writes 门单槽 `release` 被重叠 put 冲掉致首 waiter 永挂。
改为多 waiter（`gate.releaseAll` 挂 gate 对象上；原型方法看不见构造器闭包）。

对象：`.dragon-analysis/editor-phase/backend-private-write-journal-session-r1/fixture-worker.js`

```bash
# 应用（需先有原始版文件；已修复的工作树上直接打会失败，属正常）
git apply docs/fixture-patches/write-gate-multiwaiter.patch
# 回滚验证
git apply -R --check docs/fixture-patches/write-gate-multiwaiter.patch
```

验证：draft-freeze lane r9/r10 全绿；最小 probe 双 put 全 settle。
行尾由仓库 autocrlf 归一，不影响应用。
