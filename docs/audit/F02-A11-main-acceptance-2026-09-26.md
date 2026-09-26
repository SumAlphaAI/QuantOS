# F02-A11 主线验收收尾

> 结论：**F02-A11 CLOSED；F02 COMPLETED / ACCEPTED。**
> 验收源码：`bb4ef3c95753c1db15c7f2e2ba3ae22abb7a0b1f`，2026-09-26 通过 [PR #4](https://github.com/SumAlphaAI/QuantOS/pull/4) 正常合入 main。
> 本报告及后续证据归档提交不自动继承该源码的验收结果；F0 总体和其他任务的独立验收边界不随本项改变。

## 一、任务完成概况

已关闭 F02-A11 的全部缺口：有效 required checks 配置、真实失败阻断与恢复、Playwright 截断历史修复、Terminal 可重复构建根因修复，以及修复后同一 main SHA 的完整远程检查和正式下载验签。

根因是短模块 ID 冲突后的遍历顺序依赖。原物理目录下，callback 客户端入口和 UI 共享模块均竞争 `9311`，后遍历者改取 `1692`。已用真实编译器重现历史两组 UI/依赖 chunk 的精确字节；两份 Next 配置采用固定八位 ID 空间并在冲突时失败。修复后两种遍历顺序的完整 Terminal 输出 **61/61 文件一致**，真实编译回归 **5/5 PASS**。详见[根因与针对性修复](./F02-A11-module-id-root-cause-2026-09-26.md)。

## 二、完整源码绑定与检查统计

| 对象 | 完整 SHA | 证据边界 |
|---|---|---|
| 最终修复 PR head | `01b4f0600beeffbeaddfe3c6bcb780212b136073` | PR 的8项 required checks全部成功 |
| PR 临时合并源码 | `bc5dddd251d0f3588d6fcba68b1fc09f9a1c3821` | PR F01原始回执实际构建源码；不当作main回执 |
| 实际 main 合并源码 | `bb4ef3c95753c1db15c7f2e2ba3ae22abb7a0b1f` | 以下全部主线工作流、检查和正式回执唯一验收源码 |

PR 临时 merge 与实际 main 的 Git tree 均为 `2ae3620b095db38ce44fbf72b189f97e7cf7c0af`；仍对新的 main SHA 独立运行全部验收，未复用 PR 制品作为正式签名回执。

### 2.1 主线工作流：7/7 SUCCESS

| 工作流 | 运行 |
|---|---|
| QuantOS CI | [36248006030](https://github.com/SumAlphaAI/QuantOS/actions/runs/36248006030) |
| F01 Clean Room | [36248006066](https://github.com/SumAlphaAI/QuantOS/actions/runs/36248006066) |
| Frontend Baseline (FEP-0) | [36248006065](https://github.com/SumAlphaAI/QuantOS/actions/runs/36248006065) |
| QuantOS Compatibility | [36248006010](https://github.com/SumAlphaAI/QuantOS/actions/runs/36248006010) |
| F03 Protocol Acceptance | [36248006018](https://github.com/SumAlphaAI/QuantOS/actions/runs/36248006018) |
| F04 Core Branch Coverage | [36248006074](https://github.com/SumAlphaAI/QuantOS/actions/runs/36248006074) |
| F08 Engine CI | [36248006015](https://github.com/SumAlphaAI/QuantOS/actions/runs/36248006015) |

### 2.2 Required checks：8/8 SUCCESS

`verify`、`verify-download`、`frontend-baseline`、三项 `Web contract (chromium/firefox/webkit)`、`acceptance (clean-room)`、`acceptance (reproducibility)` 全部完成且成功，App ID 均为 GitHub Actions `15368`，`head_sha` 全部为上述 main SHA。

规则集 `23727075` 仍为 active、strict、零 bypass，保留 deletion/non_fast_forward，范围仅为 main。本次正常合并的服务端 rule suite `4240581448` 明确记录 `required_status_checks=pass`，after_sha 为本次 main SHA。此前 PR #3 的真实失败拒绝与恢复证据继续保留。

### 2.3 原始回执核验

- [clean-room 原始回执](./evidence/F02-A11-main-bb4ef3c-2026-09-26/main-clean-room.json)：PASS，源码干净，耗时 **242.47 秒**，满足 ≤1800 秒。
- [三次构建原始回执](./evidence/F02-A11-main-bb4ef3c-2026-09-26/main-reproducibility.json)：PASS / reproducible=true，三次均为同一源码；综合摘要均为 `abe6ef88ea2ca0936beae9fbde92d4ddf2c6245242894168e0e9782906309127`。
- [正式下载验签原始回执](./evidence/F02-A11-main-bb4ef3c-2026-09-26/main-download-receipt.json)：PASS，`commit` 为上述 main SHA，`downloadVerified=true`、`formalSignatureVerified=true`，制品为 `quantos-build-artifacts`。
- CI 的 `verify`、`signing-policy`、`sign-main`、`verify-download-main`、`verify-download` 全部 success；PR 专用下载作业在 main push 中按设计 skipped，不被计作验收成功。

[汇总校验结果](./evidence/F02-A11-main-bb4ef3c-2026-09-26/acceptance-verification.json)是对 GitHub 原始元数据及远端原始回执的派生校验，不伪装成远端签发回执。[证据目录](./evidence/F02-A11-main-bb4ef3c-2026-09-26/README.md)提供完整性清单与离线复核脚本。

## 三、当前问题与风险边界

本次范围内未关闭问题 **0**。历史失败保留，不删除、重跑覆盖或改写为 PASS。没有减少三次比较、排除差异文件、扩大安全豁免、降低覆盖率或关闭 required checks。

新的模块 ID 冲突将明确阻断构建，需要审查后调整固定 ID 策略，不能取消 failOnConflict。现有 F01 仍采用同一物理构建前缀、每轮重建源码/安装/输出目录的验收口径；本报告不扩大为任意绝对路径之间的字节一致保证。

本次更新的是 F02 验收基线；不将 F08 CI 成功扩写成这个新 SHA 的 F08 Nightly/隔离目标验收，也不宣称 F09 或 F0 整体已通过。WebKit 与真实 Safari、专用 PostgreSQL 与托管 Supabase 的原有边界保持。

## 四、维护建议

1. 保留模块 ID 冲突负例、Git 历史保全回归、原始输出留存和全部 required checks。
2. 规则变化时重新验证真实阻断与恢复；源码变更后以新完整 SHA 取得自己的回执。
3. 下一项继续按开发计划复审 F09；F0 总体放行需核对其独立阶段清单。
