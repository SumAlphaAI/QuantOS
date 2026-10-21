# 46c47a13 远程 CI 修复（2026-10-21）

基线：`46c47a13fab123764dd30abaf0b2d6f099fc89bc`。从干净 main 开始，查询该完整 SHA 的 9 个工作流，全部已结束：6 SUCCESS、3 FAILURE。本轮只生成本地提交，不推送、不执行数据库或部署。

## 同 SHA 远程结果

| 工作流 | 运行 | 结果与原因 |
|---|---|---|
| F01 Clean Room | [39564650069](https://github.com/SumAlphaAI/QuantOS/actions/runs/39564650069) | FAIL：isolated source snapshot 的 Clippy 拒绝测试模块后的函数，以及两个 8 参数测试辅助函数。 |
| QuantOS CI | [39564650129](https://github.com/SumAlphaAI/QuantOS/actions/runs/39564650129) | FAIL：相同的 3 条 Clippy 错误。verify-download 因前置 CI 失败、CI_RESULT=skipped 连带失败；保留该依赖门禁，不把跳过当通过。 |
| Frontend Baseline (FEP-0) | [39564650053](https://github.com/SumAlphaAI/QuantOS/actions/runs/39564650053) | FAIL：PRE-04 的 C01/C17/C10 仍绑定旧 provider/test 摘要，共 5 处不一致。 |
| F08 Engine CI | [39564650057](https://github.com/SumAlphaAI/QuantOS/actions/runs/39564650057) | SUCCESS |
| QuantOS Compatibility | [39564650082](https://github.com/SumAlphaAI/QuantOS/actions/runs/39564650082) | SUCCESS |
| F04 Core Branch Coverage | [39564650052](https://github.com/SumAlphaAI/QuantOS/actions/runs/39564650052) | SUCCESS |
| F03 Protocol Acceptance | [39564650085](https://github.com/SumAlphaAI/QuantOS/actions/runs/39564650085) | SUCCESS |
| R01 Market Service Gate | [39564650149](https://github.com/SumAlphaAI/QuantOS/actions/runs/39564650149) | SUCCESS |
| F09 Observability Gate | [39564650153](https://github.com/SumAlphaAI/QuantOS/actions/runs/39564650153) | SUCCESS |

成功结果只属于基线 SHA 各自工作流范围，不等于修复提交的托管验收。

## 修复与范围复核

将 live/research.rs 的 command_source 原函数移到 tests 模块之前；函数和测试块的原始字节分别核对一致，仅改变声明顺序。两个测试模块 a6_tests.rs、provider_all_tests.rs 的 HTTP call 辅助函数保留显式 identity、幂等键、版本、再认证输入，并添加仅限该函数的 `expect(clippy::too_many_arguments)` 及理由。与 allow 不同，expect 在预期诊断消失时会触发 unfulfilled_lint_expectations；全仓 Clippy 仍使用 `-D warnings`。测试参数、执行路径、断言和 CI 配置未修改。

PRE-04 旧摘要可从 `cea64f2ca74fe0af9b820c5f7a252e6953433137` 的对应 Git 文件独立重算。对比该版本与当前文件，仅有 WEB101 公开申请 expectedMode 从 paper/shadow/assisted_live 收敛为 research/paper/shadow，以及相应接受/拒绝和审计次数测试。此次更新 5 处当前摘要，基线版本改为 1.9，字段字典只重新生成版本/日期头，710 行字段内容未改变。OpenAPI 1.14.0 / 134 operations / 113 schemas、契约身份、历史签署与摘要均保持原值。reviewedSourceSha 仍为 null，targetAcceptance 仍为 NOT_RUN / NO_RECEIPT。未将旧 READY 或用户确认改绑为本候选通过。

## 本地验证

| 检查 | 实际结果 |
|---|---|
| CI 同款 `make lint` | PASS：Rustfmt、全仓全 target Clippy、Python Ruff/Pyright、全前端 ESLint/typecheck |
| `make f01-check` | PASS：F01 工具链/模块预检及现有负向、输出捕获和模块 ID 回归；未执行完整 clean-room/reproducibility |
| `pnpm check:pre04` / `pnpm test:pre04` | PASS：17 契约、17 Gap、23 P0 页面、710 字段；45 项测试 PASS |
| BFF 当前库和直接相关集成测试 | 211 库测试 + 15 auth/settings + 14 audit/export = 240 PASS；1 项既有 Supabase 目标测试 ignored，未记作数据库通过 |
| OpenAPI / generated / contract coverage / development plans | 全部 PASS |
| Research / A6 / ALL CI disposition | recordValidation=PASS；DEVELOPMENT / NOT_ASSESSED、assessmentExecuted=false、admitted=false、formalAccepted=false |
| 差异核对 / 密钥扫描 | 逐项字节和摘要复核 PASS；历史与暂存补丁扫描日志见证据，无新增扫描例外 |

保留两类本地初次失败：make lint 完成 Rust 后被沙箱阻止读取既有 uv 缓存，授权访问该缓存后同命令通过；更新 PRE-04 版本后、尚未重新生成字典时的正负检查失败，生成版本头后通过。均不计作最终 PASS。

库测试中 `live::f09_live_tests::real_logout_db_write_matches_persistent_trace` 按既有要求仅在显式启用 Supabase 目标测试时运行，本轮未启用。所有实际 BFF 回归使用参考/进程内输入，没有安装或运行本地 PostgreSQL/Supabase，也没有连接目标数据库。

[原始证据](evidence/ci-46c47a13-20261021/)保存远端完整 SHA 的状态、三个失败工作流的 jobs JSON 和失败日志 gzip、旧基线与实际源码差异、本地完整命令输出及失败尝试、摘要审阅表和输入/证据 SHA256 清单。候选以清单及所在 Git 提交共同标识。

本轮 Gate：PASS_LOCAL_SCOPED；hostedCandidateGate=NOT_RUN。完整新 SHA 托管流水线、完整 clean-room/reproducibility、目标数据库、联调及发布验收未执行。推送后仍须检查新提交对应远程结果。
