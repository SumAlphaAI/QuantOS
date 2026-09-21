# F05 同 SHA 远端验收通过（6b06a90）

> 2026-09-21 再复验修订：本报告保留历史运行的真实成功状态，但不再作为 F05 全部 ACCEPTED 的依据。A07 覆盖率排除了持久化适配器；A09 旧容量测试直接写完成状态，五秒指标仅计数据库执行。本轮已修订容量测试，待新回执。当前状态与开放项以 [F05 全面复审报告](./F05-comprehensive-review-2026-09-21.md) 为准。


- 核验日期：2026-09-21
- 完整提交：`6b06a90de275fb38f5efb7982fd2e09dd5963581`
- 分支：`main`
- 核验方式：通过已登录的 GitHub Actions 页面重新运行 QuantOS CI，并手动触发 F05 Event Nightly；逐项核对终态、作业日志、制品链接与页面摘要
- 结论：**PASS；QuantOS CI、正式打包与验签、F05 一次性 PostgreSQL 验收及 branch coverage 全部绑定同一完整 SHA 成功**

## 一、远端运行总览

| 工作流 | Run | 触发方式 | 结果 | 时长 |
|---|---:|---|---|---:|
| QuantOS CI #111，attempt 2 | [35574043608](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608) | 对 `main` push run 执行 Re-run all jobs | SUCCESS | 17m04s |
| F05 Event Nightly #2 | [35590560951](https://github.com/SumAlphaAI/QuantOS/actions/runs/35590560951) | `workflow_dispatch`，分支 `main` | SUCCESS | 3m20s |

两次运行均显示提交 `6b06a90de275fb38f5efb7982fd2e09dd5963581`。本报告未拼接其他提交的成功结果。

## 二、QuantOS CI、打包与正式验签

| 作业 | 结果 | 验收意义 |
|---|---|---|
| [verify](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608/job/106303667760) | SUCCESS，16m07s | F05 source Gate、一次性 PostgreSQL Gate、全仓测试、覆盖率、许可证/SCA、数据库/RLS、破坏性恢复、浏览器自动化及运行时打包均执行成功 |
| [signing-policy](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608/job/106308059595) | SUCCESS，11s | `f02-signing` 环境和 main-only 策略检查通过 |
| [sign-main](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608/job/106308123363) | SUCCESS，12s | 写入 HMAC-SHA256 签名并上传正式发布制品 |
| [verify-download-main](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608/job/106308198169) | SUCCESS，12s | 独立下载并验证 236 个发布文件、完整 SHA 与正式签名，生成下载回执 |
| [verify-download](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608/job/106308269075) | SUCCESS，4s | main 下载验签汇总门禁通过 |
| verify-download-pr | SKIPPED | main push 下按条件跳过，符合工作流设计 |

正式验签日志为：

```text
Verified 236 release files for 6b06a90de275fb38f5efb7982fd2e09dd5963581
Verified HMAC-SHA256 signature for artifacts/release/manifest.json
```

`write-f02-ci-receipt.mjs` 仅在发布文件、源码 SHA 与正式签名验证通过后写入回执；main 路径回执字段包含 `downloadVerified=true` 与 `formalSignatureVerified=true`。

### 2.1 同次 CI 制品

| 制品 | Artifact | 页面 SHA-256 |
|---|---:|---|
| `ci-browser-comparison-6b06a90de275fb38f5efb7982fd2e09dd5963581` | [10634386944](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608/artifacts/10634386944) | `717ba6cd90b9c6ed94f54637caba1829407f0031a6dafd0d9c9469030784f984` |
| `f02-download-receipt` | [10635082225](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608/artifacts/10635082225) | `ed31bbb01480ae64ced59f12e9517c3068a64bfa565ef27bc99ddf09ebefa9b6` |
| `f02-validation-evidence` | [10634034394](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608/artifacts/10634034394) | `5c42e2e3aec79d852d7bf29a726f59143a4cdd00e49dc33d1ab6f33bb507b0d9` |
| `quantos-build-artifacts` | [10634263963](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608/artifacts/10634263963) | `78a8c42ef2dc835f0ba2d88060657903b590925361cf474d789daab56812aba5` |
| `quantos-build-inputs` | [10634313684](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608/artifacts/10634313684) | `53b65bb3377351988aac1549d50a2b958ed97277f18c9495af01cfe6b0283dc8` |

页面摘要中的制品哈希用于索引本次运行；正式签名验证由 `verify-download-main` 在远端独立下载后完成。

## 三、F05 Event Nightly

[`branch-and-database`](https://github.com/SumAlphaAI/QuantOS/actions/runs/35590560951/job/106303743697) 作业成功，主要证据如下：

| 检查 | 结果 | 证据 |
|---|---|---|
| 一次性 PostgreSQL 重建 | PASS | 15 个 migration 顺序应用，最后一个为 `20260921090000_f05_ledger_integrity_and_replay.sql` |
| RLS | PASS | 日志显示 `Remote RLS checks passed for quantos schema.` |
| 数据库结构化回执 | PASS | `schema=quantos-f05-acceptance/v1`、`status=PASS`、`dirty=false`、`source=6b06a90...` |
| 容量场景 | PASS | `eventCount=10000`、`concurrentDeliveryAttempts=1000` |
| migration digest | PASS | `sha256:347db18d854bae424ba50537dfbbffc8289eaac83ce9ad7b5ac1c61190a7c011` |
| 核心 branch coverage | PASS | `85.00% (51/60)`，达到 ≥85% 门槛 |
| Nightly 制品 | PASS | 2 个文件，37,824 bytes，绑定完整 SHA |

Nightly 制品 `f05-nightly-6b06a90de275fb38f5efb7982fd2e09dd5963581`：

- [Artifact 10634711307](https://github.com/SumAlphaAI/QuantOS/actions/runs/35590560951/artifacts/10634711307)
- 页面 SHA-256：`1d725a54ff5eec08dd7cded473fc35825547166186513782d0cfa95d5c2f5720`

## 四、验收结论

先前的账户付款/Actions spending limit 阻断已经解除，重跑作业均实际启动并成功完成。结合 `e0520da0dd6ff04bbac9269be54db776f6129c38` 的隔离 Supabase 正式验收，本轮关闭 F05-V01：30/30 检查点全部 PASS，严格完成率 100%，F05 更新为 `ACCEPTED`。

GitHub 页面报告的警告均为 GitHub Actions 将部分仍声明 Node.js 20 的 action 强制运行在 Node.js 24 的迁移提示，以及 Playwright 成功摘要；不影响本次作业结论。后续可在上游 action 发布对应主版本后例行升级，当前不作为 F05 缺陷。
