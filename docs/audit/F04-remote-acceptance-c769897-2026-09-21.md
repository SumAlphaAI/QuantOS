# F04 同 SHA 完整远端验收通过

核验日期：2026-09-21。验收源码：`c769897de9b1f94fbd6dd9ac3e35b6aca2e8945a`，main push（09:37 GMT+8）。本次通过已登录 GitHub Actions 页面逐项核验最终状态、制品链接与下载验签日志；未拼接其他 SHA 的成功结果。

**结论：六项工作流全部 SUCCESS，运行时打包、正式签名、独立下载验签和汇总门禁均通过。F04 更新为 COMPLETED / ACCEPTED。F02 A11 的分支保护等剩余要求独立存在，保持开放。**

## 六项工作流

| 工作流 | 同 SHA 回执 | 结果 |
|---|---|---|
| QuantOS CI #107 | [35551523377](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523377) | SUCCESS |
| F01 Clean Room #65 | [35551523357](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523357) | SUCCESS；clean-room、三轮 reproducibility 两个作业全部成功 |
| Frontend Baseline #50 | [35551523353](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523353) | SUCCESS；Terminal 27、官网 18 项通过 |
| F03 Protocol Acceptance #12 | [35551523347](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523347) | SUCCESS；proto-check 2m26s，协议与生成物无漂移门禁成功 |
| F04 Core Branch Coverage #6 | [35551523387](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523387) | SUCCESS；branch-coverage 1m48s |
| QuantOS Compatibility #71 | [35551523372](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523372) | SUCCESS；Chromium、Firefox、WebKit 各 Terminal 27 / 官网 18 项通过 |

## 主 CI、打包与正式验签

| 作业 | 结果 | 意义 |
|---|---|---|
| [verify](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523377/job/106187028588) | SUCCESS，24m40s | Linux 视觉基线、协议/BFF/R01/R02/F04、质量门禁自检、lint/test、覆盖率、许可证、全量 SCA、数据库/RLS、F02 拒绝恢复、运行时制品打包及归档均成功 |
| [signing-policy](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523377/job/106190661339) | SUCCESS，18s | 已有 f02-signing 环境 main-only 策略检查通过 |
| [sign-main](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523377/job/106190713143) | SUCCESS，10s | 正式签名及 quantos-build-artifacts 归档成功 |
| [verify-download-main](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523377/job/106190744557) | SUCCESS，20s | 独立下载后验证发布文件、源码 SHA 和正式签名，写入并上传回执 |
| [verify-download](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523377/job/106190806953) | SUCCESS，4s | main push 对应下载验签结果严格为 success |
| verify-download-pr | SKIPPED | main push 下不运行 PR 专用路径，符合工作流条件，不是缺失验收 |

下载验签步骤的当前 SHA 日志原文：

```text
Verified 236 release files for c769897de9b1f94fbd6dd9ac3e35b6aca2e8945a
Verified HMAC-SHA256 signature for artifacts/release/manifest.json
```

上述为 GitHub Actions 上实际执行的正式 HMAC-SHA256 验签，不是仅检查未签名摘要或制品上传状态。`write-f02-ci-receipt.mjs` 在 main push 下先校验 release 与 SHA，再执行正式验签，成功后才写出并上传 `download-receipt.json`。本次验签和回执上传作业均成功。

## 同次运行制品索引

以下摘要为 GitHub 页面显示的 artifact SHA-256；本轮未将 artifact 下载到本机再次计算摘要或使用签名密钥验签。正式下载验签发生在上表远端独立作业。

| 制品 | 链接 | 页面 SHA-256 |
|---|---|---|
| quantos-build-artifacts | [10618554784](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523377/artifacts/10618554784) | `6058b61c6ac267e8b5b0dbc0e16e13afd3e57c40719d8f5edd00270ff44b1f0c` |
| f02-download-receipt | [10619580023](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523377/artifacts/10619580023) | `285cf277a198c5140c0200e63d3646b60fa9beb640a846d7b95fd6fe2026d1a2` |
| f02-validation-evidence | [10618429871](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523377/artifacts/10618429871) | `01fb2e28b7570e866365d3f606ee482753f9d623259ac8c4f0f08b1170bd976e` |
| quantos-build-inputs | [10619610006](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523377/artifacts/10619610006) | `6264110034470908af2cf86b6c10bb7c34cb7ad8d67900734f66f1c729f3156a` |
| f04-branch-c769897… | [10618298021](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523387/artifacts/10618298021) | `a151ed1a22c9fd94d4a5969be79177ad9686927da49e4d212bcd04436826872c` |
| f03-protocol-c769897… | [10618482795](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523347/artifacts/10618482795) | `ab0f8cb9d657793e6ba730826dfcd73c78bee6bf9f0fda0614a774213228d83c` |

F01 的两份成功制品：[clean-room](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523357/artifacts/10618353491)、[reproducibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/35551523357/artifacts/10618474319)。

## 关闭结论与维护边界

原九项 F04 问题和后续已确认 CI 阻断均已完成修复；尤其 chacha20 yanked 阻断已通过此次远端 SCA 验证。结合既有 23/23 本地检查点与此次同 SHA 全部远端回执，F04 验收完成。精确本地覆盖率指标保留在复审报告原验证记录中，不将历史测量数值冒充本次远端测量。

本次未修改仓库设置、读取密钥、重新运行任务或推送代码。F02 A11 不因 F04 通过自动关闭；后续代码或依赖变更仍须收集对应新 SHA 的门禁回执。本文后续文档提交仅归档此次已完成的验收，不改变被验收的源码 SHA。
