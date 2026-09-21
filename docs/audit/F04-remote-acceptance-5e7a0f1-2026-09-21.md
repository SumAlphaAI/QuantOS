# 5e7a0f1 完整 CI 核验

核验日期：2026-09-21。完整 SHA：`5e7a0f1f9539ace8fe665e5139f5700d6fa3b3fe`，main，08:57 GMT+8 push。来源为已登录 GitHub Actions 页面与作业执行记录。本次仅核验此 SHA，不拼接其他提交的成功结果。

**结论：六项工作流已全部结束，5 SUCCESS、1 FAILURE。原三个 CI 阻断已远端验证修复；新增 SCA yanked 依赖阻断，F04 继续待验收。**

## 同 SHA 工作流

| 工作流 | 回执 | 结果 |
|---|---|---|
| QuantOS CI #105 | [35549330280](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330280) | FAILURE；verify 15m56s，SCA 失败 |
| F01 Clean Room #63 | [35549330297](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330297) | SUCCESS；clean-room 与三轮 reproducibility 均通过 |
| Frontend Baseline #48 | [35549330352](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330352) | SUCCESS；frontend-baseline 3m30s |
| F03 Protocol Acceptance #10 | [35549330279](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330279) | SUCCESS；proto-check 2m23s |
| F04 Core Branch Coverage #5 | [35549330425](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330425) | SUCCESS；branch-coverage 1m38s |
| QuantOS Compatibility #69 | [35549330572](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330572) | SUCCESS；三个浏览器全部通过 |

## 已核实的执行范围

- Frontend Baseline：PRE-04 清单、PRE-06 结构与负向门禁、lint/typecheck/unit/build、性能预算、视觉基线完整性、Terminal E2E/axe/平台视觉、官网 E2E/axe，以及 sabotage self-test 均已执行成功。[作业](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330352/job/106181035769)。
- F03：回执拒绝规则、无 SDK 生成物时的生成器 bootstrap、proto workspace 与跨语言兼容性、同 SHA 协议及生成物回执写入和归档均成功。[作业](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330279/job/106181035514)。
- F04：nightly `make coverage-rust-branch` 和制品归档成功；该命令强制总体与 precision.rs 实测 branch coverage ≥90%。本轮未以历史 SHA 的精确覆盖率数值替代当前回执。[作业](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330425/job/106181036060)。
- Compatibility：Chromium、Firefox、WebKit 各自 Terminal 27 passed、官网 18 passed，总计 135 个浏览器测试实例通过。三个浏览器报告均上传。
- F01 clean-room 子作业成功，耗时 7m20s。[作业](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330297/job/106181035671)。

## 制品与证据边界

F03 制品：[f03-protocol-5e7a0f1…](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330279/artifacts/10616913740)。F04 制品：[f04-branch-5e7a0f1…](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330425/artifacts/10618027619)，GitHub 页面摘要 `sha256:730620529b992276b73bf39436cc6a82a6a10811afbde5538f215b7b45493283`。本轮通过页面核验，未下载这些制品做本地摘要校验；页面摘要不等于正式签名验证。

Actions 页面有 Node.js 20 action runtime 弃用提醒，当前运行已自动使用 Node.js 24，未导致作业失败；这是后续维护项，不等于仓库 Node 工具链版本错误。F02 A11 保持开放，其分支保护等验收独立于本次 F04 检查。

## 主 CI 阻断及影响

[verify 作业](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330280/job/106181035542) 已通过完整 Linux 视觉基线、浏览器自动化、协议/BFF/R01/R02、F04 stable Gate、质量门禁自检、lint、workspace test、三语言覆盖率、许可证检查、SCA waiver 和 TP intake。原 cargo-deny wildcard 阻断已消除。

失败位于 step 37 `Run SCA checks`，[日志位置](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330280/job/106181035542#step:37:55)：

```text
Non-waivable cargo scanner failure
code: yanked
crate: chacha20 0.10.1
message: detected yanked crate (try `cargo update -p chacha20`)
make: *** [Makefile:200: sca-check] Error 1
Process completed with exit code 2.
```

远端日志完成时间 `2026-09-21T01:13:30.094Z`。本地只读核对 `Cargo.lock:383` 确认锁定 `chacha20 0.10.1`，`deny.toml:7` 为 `yanked = "deny"`；`scripts/check-sca.mjs:38` 对不属于可豁免 advisory 的 scanner failure 拒绝放行。日志依赖链包含 `postgres-protocol 0.6.12 → rand 0.10.2 → chacha20 0.10.1`，影响使用 PostgreSQL 的多个 crate/服务。这是撤回版本准入失败，本次未据此推断存在已确认可利用漏洞。

后续数据库/RLS、F02 recovery、runtime packaging 和 unsigned digest 未执行；signing-policy、sign-main、verify-download-main 跳过，汇总 verify-download 失败。PR 分支专用 verify-download-pr 在 main push 下跳过属于正常路由。本次没有正式制品签名或下载验签成功回执。

## F01 三轮构建补充

[reproducibility 作业](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330297/job/106181035666) 成功，工作流执行 `--mode reproducibility --runs 3`；与 clean-room 作业共同证明正式清单修复在 Linux 生效。制品页面记录：

| 制品 | 链接 | GitHub 页面 SHA-256 |
|---|---|---|
| f01-clean-room-evidence | [10618205011](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330297/artifacts/10618205011) | `442543360571e2968adc88e1b144551302d4366b6a15e5d9541e5a017e6ea84d` |
| f01-reproducibility-evidence | [10617972708](https://github.com/SumAlphaAI/QuantOS/actions/runs/35549330297/artifacts/10617972708) | `8efd589aeb3bdc93836865fad2d3e62366bfce80770eeafe1f63c526fd8c2fff` |

## 后续整改与验收边界

1. 对 chacha20 依赖链做最小兼容升级，核验候选版本未撤回并审查 Cargo.lock 差异；保留 `yanked = "deny"` 及不可豁免失败规则。
2. 完成 locked build/test、SCA、cargo-deny、协议无漂移和相关门禁验证后提交；锁文件变化须重新验证构建回执，不复用旧 SHA 的构建摘要。
3. 人工推送修复提交，再收集该完整 SHA 的全部必需 CI 结果，特别是尚未到达的数据库/RLS、打包、正式签名和下载验签。

本轮仅收集和核验回执，未修改依赖或放宽供应链策略。F04 保持 `IMPLEMENTED_PENDING_ACCEPTANCE / FIX_VALIDATION`；F02 A11 继续开放。
