# c084b2cf CI 跟踪与修复（2026-10-27）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。远端与本地基线为 `c084b2cfe5d224fae2710e704c5209bc367c6b17`。本轮在 main 修复并生成本地提交，不推送；验证绑定基线 SHA 和修复工作树字节，不改绑历史结果或宣称新提交已通过远端 CI。

## 远端结果

本 SHA 共 12 次运行：9 个 push 中 4 成功、5 失败；3 个 schedule 中 R01/F09 成功、F08 Nightly 失败。push 的 Visual Baseline Candidates、F03、R01、F09 成功。F05/F07 均无运行；F04 本轮未触发，不记为通过。

上轮 Engine Clippy、P07 清单及 A2 mutation 入口已继续通过，后续暴露以下阻断：

| 工作流 | 实际失败 |
|---|---|
| [F08 Engine CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40335182078) | Rust 测试和 Python 检查通过后，覆盖率记录在 lib.rs:1279 报 waiver source drift |
| [F08 Engine Nightly](https://github.com/SumAlphaAI/QuantOS/actions/runs/40415535256) | 相同源码坐标漂移，不是业务测试失败 |
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/40335182015) | L01 进程测试要求 QUANTOS_L01_FIXTURE_EXECUTABLE，但默认 Cargo 测试入口未设置该环境变量 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40335182033) | 默认并行浏览器任务采集 U01/TP01/R1 专用宿主套件，缺宿主回执并争用 4010 端口；verify-download 正常传播失败 |
| [QuantOS Compatibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/40335182035) | 三个浏览器同一入口问题；各自原有 49 项常规用例成功，额外 12 个专用宿主用例失败 |
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/40335182055) | A2 Gate 已通过，PRE-04 的 C01/C17/C10 共用 provider 摘要仍指向旧源码 |

保留所有失败步骤全文、job 元数据和运行终态；没有将 schedule、skip 或下游未执行结果记为通过。

## 修复及范围

F08 的 127 项既有记录中，38 项位于 Engine Manager 后段，源码行实际整体移动了两行。逐项核对原 lineSha256，在当前精确相同行内容上将 span 起止行各加 2；列号、源码行摘要、ticket、category、reason 以及记录数量均不变。覆盖率检查器和 90% 行、85% region、85% nightly branch 阈值不变。完整坐标复核见 `f08-waiver-review.json.gz`，不是新增豁免或关闭漂移保护。

L01 测试默认解析当前 Cargo 测试 profile 下 `examples/l01_fixture`。Cargo 默认包测试会构建该自有示例，实际 compiler-artifact 清单已验证这一点；由当前测试程序位置推导路径，兼容自定义 target 目录与平台可执行后缀。保留显式环境覆盖入口供既有手工 L01 runner 使用；显式错误路径仍失败。子进程继续 env_clear，200 个场景、250 个实际 stdio 请求、重复提交及 X04 事实重放断言均保留，不退回纯内存假执行。新空 target 目录且无预建示例、无显式路径时已验证默认入口成功。

默认 Playwright 配置补齐对 `u01-integration.spec.ts`、`tp01-integration.spec.ts`、`r1-integration.spec.ts` 的入口划分，与已有专用宿主套件规则一致。三个业务套件仍由各自配置及功能 runner 准备宿主、worker 输入和串行端口后运行。新增实际 CLI 发现回归，验证默认常规用例保留、无专用 integration 混入；三个专用配置仍非空、workers=1、用例 expectedStatus=passed。仅发现配置不算执行业务链；本轮没有给专用业务套件授予通过。规程同步至 `docs/operations/phased-testing.md`。

PRE-04 对照原受控 provider 源码所在 `7955c5cd3f381284ebf1d6b2fbded35a50a7b5a0`，证明差异仅新增 cfg(test) 的 r1/u01/x3_current_tests 三个模块注册，非测试 provider 字节保持原内容。将 C01/C17/C10 三处源摘要更新至当前字节，基线 v1.11；API 1.16.0、134 operations、119 schemas、713 字段行及所有历史验收文档摘要不变。字段字典仅重生成版本/日期头，reviewedSourceSha 仍为 null，原历史 SHA 和目标 NOT_RUN / NO_RECEIPT 保留；同步当前 PRE-04 总结。

## 验证

| 本地范围 | 结果 |
|---|---|
| 默认 quantos-execution 包测试，无显式 L01 可执行路径 | 100 PASS、1 项原有 ignored；实际进程 200 cases / 250 wire requests |
| 新空独立 Cargo target、无预建 L01 示例及路径 | 同一默认包入口 100 PASS、1 ignored；200 cases / 250 wire requests；不是 worktree 或数据库 |
| 原显式 L01 可执行入口 | PASS；200 cases / 250 requests，actualTestnetConnected=false，凭据不继承 |
| 显式 L01 路径无效 | 预期拒绝，exit 101，在 stdio 前失败，不回退默认示例；原负向日志保留 |
| 执行包严格 Clippy、全仓 Rust fmt | PASS |
| F08 stable 实际 LLVM 覆盖率 | 55 项引擎测试通过；源码行 97.64%、审计 region 92.85%；branch NOT_ASSESSED_STABLE |
| F08 nightly 实际分支覆盖率 | 55 项引擎测试通过；源码行 97.69%、审计 region 93.04%、branch 90.07%，原阈值全部通过 |
| F08 覆盖率负向门禁 | stable 4 PASS、1 SKIP（未启用分支插桩）；nightly 5 PASS，无 skip |
| PRE-04 当前清单及负向检查 | PASS；17 contracts、713 fields、134 operations、119 schemas；45 项负向检查 |
| 当前参考 provider 回归 | auth/settings 17 PASS、audit/export 14 PASS；没有数据库验收 |
| 实际 Playwright 配置发现及 Git history 保护 | 最终 2 PASS；配置发现不能记为专用业务链执行通过 |
| 新 Terminal 构建、默认 Chromium 比较 | 最终 49 PASS，无 skip/flaky；4 workers，禁止更新截图，client secret check 181 文件 |
| 浏览器配置和回归文件 ESLint | 最终 PASS |
| F05/F07 手工策略负向检查 | 6 PASS，无全量 campaign |

显式 ESLint 检查发现被修改的原测试文件使用 process 却未显式导入 Node process；补齐导入后检查与发现回归通过。此前 fresh 构建和 49 项成功保留在 browser-attempt1；由于 Web source digest 包含 scripts，再次执行最终 fresh 构建和 49 项比较，并核对最终 source/profile digest、buildId、完整导出清单，避免把旧构建改绑为新源码。原失败 lint 日志保留。

新空 Cargo target 仅为本轮验证创建，记录示例字节摘要和实际结果后已清理；普通工作区、Git 分支和目标数据库未受影响。所有实际 stdio 结果均为自有 fixture，不能作为交易所 testnet HTTP、真实资金或部署通过。

## 证据与边界

[证据目录](evidence/ci-c084b2cf-20261027) 保留原始日志、compiler-artifact、原始 stable/nightly LLVM JSON、各次测试及 fresh 浏览器报告。`.gz` 可用 `gzip -dc` 无损读取，摘要见 `SHA256SUMS`。`source-binding.json.gz` 绑定八份修复源码/规程及相关自有示例、配置和 provider 输入；`validation-summary.json.gz` 区分 stable/nightly、ignored、skip 和 NOT_RUN；`pre04-provider-source.diff.gz` 保留实际源码对照。

F05/F07 在本 SHA 的 push 和 schedule 完整清单中均无运行，仍仅 workflow_dispatch、确认默认 false，并要求 QUANTOS_MANUAL_F05_F07=1。本轮未连接真实数据库、安装或启动本地数据库、修改 secrets 或推送。

新提交 hosted CI、完整 F01、全仓运行测试、Linux 三浏览器重放、U01/TP01/R1 专用业务链、真实数据库/外部服务、全量联调及发布验收均为 NOT_RUN。原 c084b2cf 的成功保留自己的 SHA/范围。下一步为用户推送本地修复后，继续核对同一新 SHA 的五个 push 失败入口、F08 定时入口及后续步骤，不提升全局 READY。
