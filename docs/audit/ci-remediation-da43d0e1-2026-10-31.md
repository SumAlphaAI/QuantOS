# da43d0e1 CI 复核及修复（2026-10-31）

状态：`PASS_LOCAL_BFF_CONTRACT_REPAIR_HOSTED_RECHECK_PENDING`。远端结果绑定 `da43d0e1d6ede9abf0e099ce7ba173eee4fbfb3d`；当前修复在 main 生成本地提交，不推送。当前输入绑定于 source-binding.json 及包含本记录的提交；本地语义日志内 sourceCommit/GITHUB_SHA 为修复前 HEAD，不是新提交的 hosted 或目标环境验收。

## 原 SHA 远端结果

9 个 push 工作流为 7 success、2 failure。F01、F03、F04、R01、F08、F09、Compatibility 成功；未查询到该 SHA 的 Visual Baseline，F05/F07 完整 campaign 未运行，不借用其他 SHA 的结果。

| 工作流 | 当前远端事实 |
|---|---|
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/41159268586) | clean-room 与 reproducibility 均 SUCCESS。原始 clean-room 报告为 PASS，bootstrap 11.128 秒，make lockfile-check/f01-check/lint/test 1178.677 秒，总计 1189.818 秒，低于原 1800 秒限额。上一轮的 Web fixture/宿主修复已得到本 SHA 完整远端执行证据 |
| [QuantOS Compatibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/41159268565) | Chromium、WebKit、Firefox 三个 jobs 均 SUCCESS；当前 SHA 的 Firefox 兼容性继续通过 |
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/41159268600) | FAIL：A2 正向语义及前四个变异成功，live-last-factor 未能以业务断言失败结束，原严格判据拒绝 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/41159268617) | FAIL：同样停在 live-last-factor；verify-download 保持传播前置未完成，没有修改其拒绝逻辑 |

Frontend 的 A2 诊断 artifact 显示：`cargo test --lib` 编译时无法读取 X05 unknown-reconciliation 和 X02 books-risk open 两份 JSON，报 `could not compile bff-gateway (lib test) due to 2 previous errors`。原 mutations.json 中前四项 rejected=true，live-last-factor 为 exit 101 但 rejected=false，后四项尚未执行。编译退出 101 并不是 MFA 安全断言被触发，原 Gate 正确地没有将它计为变异通过。

## 修复范围

Rust 会在测试名称筛选之前编译所有 cfg(test) 模块。A2 的临时源码副本已有 crates、BFF、执行网关和迁移输入，但缺少两份新增 include_str! 测试依赖。

`scripts/test-bff-fe-001-mutations.mjs` 现在只补复制这两个确切文件，并逐个核对原件和副本的 SHA-256；在 mutations.json 的 fixtureInputs 中以独立 path/sha256 字段保留输入身份：

- `docs/audit/evidence/core-x05-current-local-20261029/attempt-02/unknown-reconciliation.json`
- `docs/audit/evidence/core-x02-books-risk-local-20261030/attempt-01/open.json`

没有复制整个审计目录，没有修改这两份历史 JSON 或重跑其业务 campaign。它们仅为当前库测试的编译输入，不是当前风险、账本或目标授权。任一文件缺失、复制失败或摘要不符仍会失败。

九个变异定义、指定测试名称、Cargo 命令、240 秒单次期限及拒绝判据逐字保持：必须 exit 101、无 signal/error、输出包含 test result: FAILED 和指定业务测试 FAILED。生产 BFF、live policy、profile、Makefile、Cargo.lock、凭据扫描规则与历史验收均未改动。额外显式导入 Node process/console，修正该脚本原有 globals 静态检查错误；初次 ESLint 两条失败及修正结果分别保留。

## 当前本地验证

执行与远端失败步骤相同的完整 `make bff-contract-check`，使用现有固定 pnpm 10.20.0，QUANTOS_SKIP_ENV=1；兼容性基线显式绑定本轮原 SHA，接口未变。

| 检查 | 结果 |
|---|---|
| 完整 bff-contract-check | PASS，exit 0；从 A1/生成物/覆盖、A2 实际语义及变异到后续 C10/CI disposition、BFF004/A4/A5/BFF009/BFF008/BFF010 等 recipe 均执行完成，没有在原失败点后停止 |
| A2 原三组实际语义回归 | PASS：settings_policy 8、auth_settings_provider 17、Terminal auth/settings 29；三组 exit 0，来源及原始输出摘要匹配 |
| A2 九个真实变异 | 9/9 被指定业务断言拒绝；每项 exit 101，无 signal/error。live-last-factor 现在实际运行并在保护末个 MFA 因素的 unwrap_err 断言失败，其余四个 live policy 变异同样实际执行 |
| 变异和输入保留比较 | PASS：原五个已记录变异的 mutatedSourceSha256/test/scope 与远端相同；全部九个变异定义、命令、期限及拒绝表达式与原源码逐字一致；两份 fixture 字节与原提交一致 |
| ESLint、git diff --check | PASS |

各变异的 FAILED 是预期的拒绝证据，整体 runner 为 PASS；不把编译失败或超时当作拒绝。CI disposition 的 NOT_ASSESSED、assessmentExecuted=false、admitted=false 仍按原策略保留；完整工程契约步骤通过不授予 DEVELOPMENT/目标/发布 READY。

## 证据与后续

[证据目录](evidence/ci-da43d0e1-20261031) 保存原 workflow/jobs、两条完整失败日志、Frontend 原 A2 artifact、原成功 F01 报告、当前完整契约日志、九个变异输出/manifest、实际 A2 语义 proof 与范围比较。gzip、SHA256SUMS、source-binding.json 绑定实际字节和当前输入；原有失败和未执行记录不改写。

当前修复未改变生产路径，没有启动本机数据库/容器、连接真实 Supabase/交易所、推送或部署。未重跑无关全仓/三轮构建或 F05/F07 campaign；本地完整 BFF 契约步骤是当前 CI 工具修复的直接验证范围。新提交 hosted CI、完整 F01、目标/发布验收均 `NOT_RUN`；原 SHA 的成功只属于原范围。用户推送后应复查两个失败工作流及后续步骤，不能将当前本地 PASS 改绑为新 SHA hosted PASS。提交后另执行完整历史凭据扫描，并在交付信息中报告。
