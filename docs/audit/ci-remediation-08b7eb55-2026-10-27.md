# 08b7eb55 CI 跟踪与修复（2026-10-27）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。基线：`08b7eb558954ac56c5ac3adae76ca5444dcfbdad`。在 main 修复并生成本地提交，不推送。本地结果绑定该基线及修改文件字节，不替代新提交 hosted CI、真实数据库或发布验收。

## 远端结果与根因

该 SHA 的 8 个 push 工作流全部结束，7 成功、1 失败。F01 Clean Room、F08 Engine CI、Frontend Baseline、QuantOS Compatibility、F03、R01、F09 均成功，结果保持原 SHA/范围。F05/F07 无运行。

唯一失败为 [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40431417212) 的 `Check Rust coverage`。`make coverage-rust` 第二条命令经 cargo-llvm-cov 执行 `cargo test --tests`，不会构建 examples；L01 的 200-case 自有进程测试寻找本次目录中的 `debug/examples/l01_fixture`，因文件不存在而失败（exit 101）。上轮普通 `cargo test` 会构建 examples，其成功没有覆盖这个调用方式。verify-download 正常传播上游失败，保留该行为。

## 修复

`scripts/with-fresh-coverage-target.mjs` 在选中 quantos-execution 时，先使用 `cargo build --package quantos-execution --example l01_fixture --locked --offline` 构建自有协议夹具；随后将本次可执行文件路径显式传给覆盖率测试。夹具位于本次独立目录的 owned-fixture 子树，原 instrumentation 位于 llvm-cov-target 子树，夹具构建清除继承的 instrumentation flags/profile/fixture 路径；记录可执行文件 SHA-256 和构建阶段。

该 peer 只充当真实 stdio 测试对端，其对象不进入覆盖率测量；实际被测核心库和进程消费者仍由原 cargo-llvm-cov 命令 instrument/test。Makefile、三库报告范围、execution-gateway 消费者和原阈值不变：core release lines/regions 90%/90%，合并报告 90%/85%。没有跳过 L01、改写 corpus、扩展文件排除或借用旧产物。

构建失败、信号、启动错误、构建成功但产物缺失均在进入覆盖率前拒绝；覆盖率失败保持原退出码。回归覆盖连续两次独立目录、拒绝旧夹具路径及继承 instrumentation、成功准备不能掩盖测试失败。

## 验证与证据

| 检查 | 结果 |
|---|---|
| 最终原入口 `QUANTOS_SKIP_ENV=1 CARGO_BUILD_JOBS=1 make coverage-rust` | PASS，exit 0；共 156 PASS、0 FAIL、2 原有性能 ignored |
| core release 部分 | 12 PASS；lines 97.75%、regions 96.70%，原 90%/90% 阈值 |
| 独立目录三库合并部分 | 144 PASS、2 原有性能 ignored；22 个生产文件，lines 6785/7208 = 94.13%、regions 9649/10463 = 92.22%，原 90%/85% 阈值 |
| 原失败 L01 stdio/replay 测试 | PASS；实际执行原 200-case corpus；夹具可执行文件摘要与 receipt 一致，不在测量对象树内 |
| wrapper 和测量范围回归 | 21 PASS、0 skip；包含准备失败、缺失产物、coverage 失败传播及原测量范围拒绝测试 |
| 完整质量门禁负向套件 | 57 PASS、0 skip；沿用真实 Gitleaks 及原有工具的故障拒绝/恢复控制 |
| F05/F07 手工维护策略 | 6 PASS、0 skip；未连接数据库 |
| 修改脚本 ESLint / git diff --check | PASS |
| Gitleaks 8.28.0 完整历史 / 原始证据目录 | PASS；历史 969 commits、约 1.99GB，无新豁免 |

region 不代表 branch；本机 Rust 1.91.0 / cargo-llvm-cov 0.8.7 的结果不替代 Linux hosted CI。夹具构建的 offline 依赖由原 CI bootstrap 的 `cargo fetch --locked` 准备，不修改锁文件。

原失败、中断和修复后的结果分别保留。本地初次运行因 Make 默认加载 .env.local，在 fixture 编译阶段主动 SIGINT 中断；后续使用 CI 相同的 QUANTOS_SKIP_ENV=1、全新 target 重新执行，未进行数据库操作。显式 ESLint 首次发现新增 console 缺少 Node 导入，修复后重跑通过。手工策略测试首次误用不存在的文件名，正确入口随后 6 项通过，首次错误记录保留。

[证据目录](evidence/ci-08b7eb55-20261027) 包含远端终态、原失败日志、最终完整覆盖率日志、逐文件度量和测试摘要、fixture receipt、回归日志和扫描结果。`.gz` 可用 `gzip -dc` 无损读取，完整性见 SHA256SUMS；source-binding 绑定两份修改脚本、本文和未变更的测量/夹具/工作流输入。旧尝试目录保留，没有借用其对象或 profile。

F05/F07 仍仅 workflow_dispatch、确认默认 false，并要求 QUANTOS_MANUAL_F05_F07=1；本轮未运行全量数据库/覆盖率 campaign。新提交 hosted CI、真实数据库、交易所 HTTP、部署及发布验收为 NOT_RUN。未推送或修改 secrets。

下一步：用户推送本地修复提交后，跟踪新同 SHA 的 Rust 覆盖率及原主 CI 后续未抵达步骤；其他七项工作流的旧 SHA 成功不迁移为新提交验收。
