# PORTRAIT-BUDGET-1：解码资源预算验证（B切片，零生产改动）

用户按 A/B/C 顺序授权；本页为 B 切片唯一详细维护源。本切片为纯验证：默认 codec 预算**不放大**，无生产改动；只证明上限内最坏输入有界完成＋像素 exact＋无跨调用留存趋势，并如实登记隔离缺口。不 commit/push/deploy/fetch，不触 DOS 存档或用户 profile。

## 探针与结果

入口 `node --expose-gc tools/verify_portrait_decode_budget.mjs <轮号>`（须带 `--expose-gc`，工具内断言）；scope `.dragon-analysis/editor-phase/trial-portrait-budget-r1/attemptN/`（attempt1 留存界偏紧失败后把重复窗 10→30 次摊薄噪声，attempt2 通过但收据标签过期，attempt3 为正式通过轮）。

| 文件 | SHA-256 |
| --- | --- |
| `tools/verify_portrait_decode_budget.mjs` | `daee6595328e9c4b6ff0e574af0332146b0021fa777b7d038e81d2b31329f8f0` |
| `tools/fixtures/portrait_decode_budget.py` | `784f4d843b6c295a53581f56fd5b20d04874c41baa93fbfb4e5a8471b135fb6b` |

合成上限内输入（已装 Pillow，平坦灰保证 exact oracle）：8192×2 JPEG（16384 像素预算顶）、progressive JPEG、2048×2048 平坦 PNG（适配器 4MP 路径；输入 8534B，过 100KiB 源门）。

attempt3：7检查／33 HTTP 通过——Node 直接解码三项（9／4／73ms，堆零增长）＋生产 TrialSessions preview 在 Node／workerd 双侧三项（82／19／308ms）＋30 次 max-JPEG 重复留存 `growth -0.11MB < churn/2=0.94MB`（探针本地界，非产品 SLA）。输出全部像素 exact，输入 pins 全程钉住。

## 仍 open（不关闭）

- OS 进程隔离／硬 RSS／CPU 时间上限：从未提供，本探针只测上限内完成＋留存趋势，不冒此证。
- 更大任意源（超 16384 像素／4MiB 估算）仍失败关闭；接受更大源须另立预算＋隔离方案，本切片未授权。
- 完整格式／独立彩色精度、Trial UI、公开整链（C切片）仍缺；Q37 不关闭，见[逐项索引](editor-requirements-matrix.md)。
