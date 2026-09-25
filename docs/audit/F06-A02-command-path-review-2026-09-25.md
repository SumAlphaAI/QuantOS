# F06-A02 Execution 命令到 Vault 隔离目标复验

> 日期：2026-09-25。被测源码完整提交：`d6e9c20d007a0d87d0b80e530ebfa86b90af9d4f`（命令探针初版 `218e02a`，随后收紧 fixture 清理范围）。目标为已授权隔离 Supabase 项目、本机专用 Execution 登录和 paper kernel。结构化结果见 [回执](./F06-A02-command-path-receipt-2026-09-25.json)。未输出或提交数据库口令、会话哈希、Vault 明文。

## 任务完成概况

**A02 在 F06 的 Vault/Execution 角色验收范围内关闭。** 可执行的 `make f06-execution-command-smoke` 在独立进程中构造隔离 paper `TradeCommand`，经 `ExecutionCommandService::submit`、严格 TLS 的专用数据库登录、账户绑定的 Vault resolver，再进入 paper kernel；有效命令一次下游提交，重放不增加提交。五类拒绝命令均产生零次下游提交。该 Gate 并不签发真实 X03 命令，也不提供公网或生产交易入口。

F06 要求 Execution Gateway 以受控角色和 allowlist 函数获取秘密引用，并验证角色拒绝、会话/命令过期与轮换状态。[开发计划](../SumAlpha-QuantOS-Development-Plan.md#task-f06)将 TradeCommand 签发、审批、签名和幂等状态机列为 [X03](../SumAlpha-QuantOS-Development-Plan.md#task-x03)；因此本次按 F06 范围关闭 A02，不把合成 paper 命令记为 X03 验收。F06 总状态仍是 `FIX_VALIDATION`。

## 完成情况明细统计

| 验证 | 结果 | 证据范围 |
|---|---|---|
| `QUANTOS_F06_ISOLATED_PROJECT=1 make f06-execution-command-smoke` | PASS，6/6 场景 | 真实 Vault 返回非空后 paper kernel 提交一次，重放仍一次；账户错配、过期、rotating reference、revoked reference、revoked session 均零提交。 |
| `make f06-execution-login-check` | PASS | 独立登录、`verify-full`、Execution 角色独占，旧 resolver 和直接 Vault 访问被拒绝。 |
| `make f06-vault-check` | PASS | 函数正负向路径与 UI/用户/BFF/Engine 8/8 SQLSTATE `42501` 拒绝。 |
| `cargo test -p execution-gateway --locked`、定向 Clippy、格式与秘密扫描 | PASS | 本地代码质量；不代替隔离目标 Gate。 |
| 无隔离标志直接运行 `--f06-paper-probe` | 拒绝 | 命令探针在目标数据库连接前失败。 |

运行脚本核对 Auth、operator 和 Execution URL 均属同一隔离项目；operator 只负责短期 fixture，实际解析使用专用 Execution 登录。测试秘密、会话、账户、actor、workspace、capability 已清理，结果只输出场景和提交次数。首次清理曾因 `event_log` append-only 约束拒绝 tenant 删除，已改为逐项清理并在复跑时回收首次失败的 fixture；数据库保留一个**无关联业务行及 Vault 秘密的空隔离测试 tenant**，以遵守 append-only 约束。

## 问题与风险分析

1. **X03 后续范围，高危**：当前进程入口仅提供双隔离标志保护的本地合成 paper 探针。正常服务仍没有可信命令传输、发行者认证和加密签名校验；`TradeCommand.signature` 当前为内容哈希，不可作为授权证明。X03 必须实现真正的签发和验证，禁止直接开放接收任意命令的 HTTP 路由。
2. **真实 venue 后续范围，高危**：本次将 Vault 解析结果用于允许/拒绝判定，并未传给外部 venue adapter。paper kernel 不使用交易凭据；真实 venue 凭据传递、出站控制及防日志泄漏需在其集成阶段单独验收。
3. **隔离数据，低危**：空测试 tenant 作为 append-only 约束下的遗留壳保留；所有测试会话、引用和 Vault 秘密已删除。后续同一 Gate 复用该 tenant，不逐次增加壳记录。

## 整改建议

1. X03 实现服务端权威签发、不可伪造签名或受控命令引用、审批状态机与可信内部传输；其同 SHA 回执应覆盖伪造、重放、撤销和数据陈旧，不复用本 F06 回执代替。
2. 真正的 venue adapter 接入时增加凭据生命周期和泄漏负向测试；保持 F06 中仅 Execution 受限角色可取 Vault 秘密的约束。
3. 继续处理 F06 的 A03/A04/A05/A09/A10；尤其性能和总回执未完成前，不将 F06 整体标记为 `ACCEPTED`。
