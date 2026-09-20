# F04 同 SHA 远端验收回执

- 核验日期：2026-09-21（Asia/Shanghai）。
- 核验提交：`b34a35286e8a9d3745146825098671880f48e53b`，分支 `main`，push 时间 2026-09-20 23:08 GMT+8。
- 采集方式：已登录 GitHub 的 Actions 页面、job 日志及 artifact 元数据；以下为页面转录摘要，不是下载的原始日志或制品验签报告。
- 结论：**F04 nightly branch Gate 已远端通过；主 CI 失败，stable F04 Gate 被前置视觉测试阻断。整体远端验收未通过，保留 IMPLEMENTED_PENDING_ACCEPTANCE / FIX_VALIDATION。**

## 回执明细

| 工作流 | Run / Job | 结果 | 核验内容 |
|---|---|---|---|
| [F04 Core Branch Coverage #2](https://github.com/SumAlphaAI/QuantOS/actions/runs/35518613741) | 35518613741 / 106098696320 | SUCCESS | 同 SHA；耗时 1m53s；core 契约测试 10/10；branch Gate PASS |
| [QuantOS CI #100](https://github.com/SumAlphaAI/QuantOS/actions/runs/35518613742) | 35518613742 / 106098696127 | FAILURE | 同 SHA；耗时 6m45s；浏览器套件 24 passed、3 failed；后续 F04 stable 步骤未执行 |
| [F03 Protocol Acceptance #5](https://github.com/SumAlphaAI/QuantOS/actions/runs/35518613761) | 35518613761 | SUCCESS | Actions 列表确认同 SHA 与成功状态 |
| [QuantOS Compatibility #64](https://github.com/SumAlphaAI/QuantOS/actions/runs/35518613745) | 35518613745 | SUCCESS | Actions 列表确认同 SHA 与成功状态 |

[branch job 日志](https://github.com/SumAlphaAI/QuantOS/actions/runs/35518613741/job/106098696320) 的 `make coverage-rust-branch` 最终输出：

```json
{"acceptance":"PASS","branchPercent":97.73,"coveredBranches":43,"totalBranches":44,"linePercent":97.75,"regionPercent":95.52}
```

nightly Linux 数值与本地 stable/release line、region 数值分开记录。脚本包含 precision.rs 独立 ≥90% 阈值，远端通过；本次未下载 LLVM JSON，未另行转录远端 precision 精确计数。

制品页面显示：

- 名称：`f04-branch-b34a35286e8a9d3745146825098671880f48e53b`。
- [Artifact 10607582376](https://github.com/SumAlphaAI/QuantOS/actions/runs/35518613741/artifacts/10607582376)，大小 21.1 KB。
- GitHub 显示 digest：`sha256:ce3abc130e7bcad79eed032c787dec1dc1507a4d4faeb65b3df6ec68ad5df4c9`。
- 已确认上传成功；未将页面 digest 当作本地下载校验或正式签名验签。

## 尚未通过的主 CI

[verify job](https://github.com/SumAlphaAI/QuantOS/actions/runs/35518613742/job/106098696127) 在 `Run browser automation suite` 失败。三项均在 retry 后仍失败：

| 模块 / 测试 | 表现 | 影响 |
|---|---|---|
| Command Center / `tests/e2e/command.spec.ts:70` | `command-1440-dark.png`：53,873 像素差异，页面显示比例 0.05 | 阻断主 CI |
| UI-102 / `tests/e2e/ui102-auth.spec.ts:108` | `ui102-login-1440-dark.png`：20,388 像素差异，比例 0.02 | 阻断主 CI |
| UI-104 / `tests/e2e/ui104-settings.spec.ts:83` | `ui104-security-1440-dark.png`：预期 1440×1089，实际 1440×1086；42,461 像素差异，比例 0.03 | 阻断主 CI，后续 browser settings 截图未被本次测试验证 |

这些是已确认的视觉比较失败，尚未定位为字体、平台渲染、布局回归或基线过期；不能直接更新截图或放宽 0.005 阈值来宣告修复。workflow 中 `make f04-check` 位于该失败步骤之后、没有独立执行条件，因此本次没有远端 stable coverage、双进程确定性或 P95 回执。

`signing-policy`、`sign-main`、`verify-download-main` 被跳过，汇总 `verify-download` 失败；本次没有正式制品验签回执，不改变 F02 A11 状态。Actions 列表还显示同 SHA F01 Clean Room #58 与 Frontend Baseline #43 失败；本轮未展开它们的日志，不推定与主 CI 同根因。

## 后续验收顺序

1. 在与 CI 一致的 Linux/Chromium 环境采集上述三个 actual/diff，判断并修复真实差异；基线需要变更时应先视觉复核，保留现有比较阈值。
2. 本地修复与提交 → GitHub Desktop 人工推送 → 等待 Actions。
3. 收集修复提交同 SHA 的主 CI 与 F04 branch 成功回执，并确认 stable `make f04-check` 实际执行通过；如果修复仅触及前端，F04 workflow 的路径过滤可能不触发，需确保新的同 SHA 运行实际存在。
4. 两项要求都满足后再将 F04 更新为 ACCEPTED。当前只归档实际结果，不将成功的 branch Gate 替代失败的主 CI。
