# 0a0b2b02 CI 跟踪与修复（2026-10-28）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。远端基线 `0a0b2b02d5b9aa1cfc99f547ed0fcff193822c24`；在 main 修复并本地提交，不推送。新提交 hosted CI、目标数据库和发布验收仍为 NOT_RUN。

## 远端终态

该 SHA 的8个 push 工作流全部结束，6成功、2失败。Frontend Baseline、F03、F08、F09、R01、Compatibility 成功。F08 成功包含上轮 TP08 样本字节修复；不把该成功改绑到新提交。查询时该 SHA 无 schedule 或 F05/F07 运行。

- [主 CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40606003429) 在 Test BFF auth and settings reference provider 失败。
- [F01](https://github.com/SumAlphaAI/QuantOS/actions/runs/40606003501) 的 clean-room job 在同一个 Rust 测试失败；reproducibility job 成功。

共同失败为 `operations_feed_starts_with_configured_download_origin`，`reference_startup.rs:42` 等待10秒后返回 Timeout。对应 suite 的非法 HTTP origin 拒绝测试分别在约9.39秒和8.59秒成功；有效 origin 测试均在10秒结束。主 CI verify-download 传播上游未完成，行为保留。后续覆盖率、SCA、打包等跳过步骤不记为通过。

## 原因与修复

该测试把10秒硬编码为正确性检查的启动预算。`BffProvider::default()` 在报告 readiness 前调用 `reference_image_digest()`，同步读取并 SHA-256 计算整个正在运行的 debug executable；共享 runner 的 CPU/I/O 竞争使该预算缺少余量。本机原测试2 PASS，用时约2.96秒，不能把本机较快启动解释为远端无故障；本轮也未对远端 runner 做性能剖析。

仅修改 `services/bff-gateway/tests/reference_startup.rs`：统一采用有界60秒启动预算；若等待失败，先终止并回收自有子进程，再在错误中输出状态和 stderr。原 ready JSON、reference 模式、进程存活、非法 origin 不得 ready、非零退出及 HTTPS 错误断言全部保留。Drop 仍负责正常路径和 panic 的 kill/wait 清理。未新增跳过、重试、测试环境旁路或降低哈希/HTTPS校验。

服务实现、reference image 哈希、live 路径、依赖、工作流、覆盖率门槛及扫描器均未修改。这是测试启动容错预算修复，不构成60秒业务性能目标或部署性能验收。

## 验证

| 检查 | 结果 |
|---|---|
| 原测试在本机、修改前 | 2 PASS；远端两个原始 Timeout 日志分别保留 |
| 受控调度延迟：同一真实 gateway 的原版/修复版测试 | 各自只暂停自有 gateway 子进程11.5秒；原版 Timeout/exit 101，修复版超过旧10秒预算后成功/exit 0，两者子进程均已回收 |
| `QUANTOS_SKIP_ENV=1 GITHUB_SHA=<基线完整SHA> make bff-provider-test` | 290 PASS、0 FAIL、3个既有 ignored；包括真实启动与 HTTPS 拒绝 |
| 单独 `cargo test -p bff-gateway --locked --test reference_startup` | 2 PASS，0 skip |
| `cargo fmt --all -- --check` | PASS |
| `cargo clippy -p bff-gateway --test reference_startup --locked -- -D warnings` | PASS |
| F05/F07 手工策略 | 6 PASS，0 skip |
| 原始证据 Gitleaks / `git diff --check` | PASS，未增加豁免 |

受控延迟探针从精确基线读取原测试、从当前工作树读取修复测试，用 rustc 编译后指向同一个 Cargo-built gateway，只运行成功启动用例。它验证调度延迟下的预算差异，不声称复现远端 CPU/I/O 耗时分解；探针及前后日志均保存。

首次本地运行原 Make 入口未提供 GitHub CI 自带的 GITHUB_SHA，在既有 G3 evidence 输出处因 NotPresent 失败（256 PASS、1 FAIL、3 ignored）。原记录保留；补齐该 CI 环境字段后原入口完整通过，没有为该本地环境遗漏修改业务或无关测试。

首次 rustfmt 检查提出一处方法链换行差异，原输出保留；格式化后检查通过，并在最终源码上再次执行启动测试、Clippy 和受控延迟探针。未因格式更新重复无关全仓检查。

## 范围与证据

[归档证据](evidence/ci-0a0b2b02-20261028) 保存同 SHA 工作流与 job 终态、两份远端失败日志、本地原始失败和修复结果、调度探针及前后结果、静态检查和源码绑定。gzip 可无损读取，SHA256SUMS 绑定归档字节。

F05/F07 仍为 workflow_dispatch、显式确认及 QUANTOS_MANUAL_F05_F07=1 才可执行完整数据库/覆盖率 campaign，手工策略检查通过。本轮未读取 .env.local、连接数据库、修改 secrets、启动本机数据库或推送。完整 F01 clean-room/三次构建、无关全仓测试、目标环境和发布矩阵未重跑，保留 NOT_RUN；后续由用户推送修复提交后跟踪新 SHA CI。
