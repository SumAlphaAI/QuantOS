# F08 已关闭问题及修复追踪归档

以下 11 项问题和对应 `fix_tracking` 从验收前活动计划原样移入归档；原始复审结论、整改报告及同 SHA 正式回执仍分别保存。

```yaml
- issues:
  - issue_id: F08-B01
    severity: BLOCKER
    description: 已补签名审批、制品 digest 及握手身份核对，本地负向测试通过。
    evidence: [F08 整改记录](./audit/F08-remediation-2026-09-25.md)
    status: CLOSED
  - issue_id: F08-B02
    severity: BLOCKER
    description: 已补 Manager 持有的 sidecar 生命周期和三次真实崩溃自动恢复。
    evidence: [F08 整改记录](./audit/F08-remediation-2026-09-25.md)
    status: CLOSED
  - issue_id: F08-H01
    severity: HIGH
    description: 已将 Execute/Stream 绝对 deadline 扩至全调用，并限制其他 RPC 为两秒。
    evidence: [F08 整改记录](./audit/F08-remediation-2026-09-25.md)
    status: CLOSED
  - issue_id: F08-H02
    severity: HIGH
    description: 已补签名租户/分类/成本/GPU/region 路由约束和每秒请求限流。
    evidence: [F08 整改记录](./audit/F08-remediation-2026-09-25.md)
    status: CLOSED
  - issue_id: F08-H03
    severity: HIGH
    description: 已采集并超额停止受监督进程的 RSS/CPU；CPU/GPU 硬隔离按用户决定不属于 F08 Gate。
    evidence: [F08 整改记录](./audit/F08-remediation-2026-09-25.md)
    status: CLOSED
  - issue_id: F08-H04
    severity: HIGH
    description: 已补持久 pending/结果、跨进程同键锁和 Mock SQLite 重启缓存；未证明幂等的 Engine 禁止盲目重试。
    evidence: [F08 后续整改](./audit/F08-continuation-2026-09-25.md)
    status: CLOSED
  - issue_id: F08-H05
    severity: HIGH
    description: 流已纳入配额与 deadline，Manager 运行中取消和跨租户拒绝本地测试通过。
    evidence: [F08 整改记录](./audit/F08-remediation-2026-09-25.md)
    status: CLOSED
  - issue_id: F08-M01
    severity: MEDIUM
    description: 已补主动 heartbeat、共享 readiness 摘流与恢复测试。
    evidence: [F08 整改记录](./audit/F08-remediation-2026-09-25.md)
    status: CLOSED
  - issue_id: F08-M02
    severity: MEDIUM
    description: 已补共享半开熔断、重注册清路由及与审批 manifest digest 绑定的跨进程熔断状态恢复。
    evidence: [F08 后续整改](./audit/F08-continuation-2026-09-25.md)
    status: CLOSED
  - issue_id: F08-M03
    severity: MEDIUM
    description: 共用 harness、逐 Python 文件覆盖率与错误/流/监督恢复负向测试已补；物理源码行及逐项可审计豁免后的 Rust region/branch 本地 Gate 通过。
    evidence: [M03 关闭记录](./audit/F08-coverage-closure-2026-09-26.md)
    status: CLOSED
  - issue_id: F08-L01
    severity: LOW
    description: 已补 F08 Runbook 和失败即阻断的可重放 Gate；本地稳定版与 Nightly Gate 均通过。
    evidence: [F08 整改记录](./audit/F08-remediation-2026-09-25.md)
    status: CLOSED
- fix_tracking:
  - issue_id: F08-B01
    fix_ref: crates/quantos-engine-manager/src/lib.rs
    verification_command: cargo test -p quantos-engine-manager --locked
    verification_environment: 本机 UDS 与本地审批测试密钥
    verification_evidence: docs/audit/F08-remediation-2026-09-25.md
    verification_status: PASS
  - issue_id: F08-B02
    fix_ref: crates/quantos-engine-manager/tests/python_mock_engine.rs
    verification_command: cargo test -p quantos-engine-manager --locked
    verification_environment: 本机真实 Mock sidecar 三次退出
    verification_evidence: docs/audit/F08-remediation-2026-09-25.md
    verification_status: PASS
  - issue_id: F08-H01
    fix_ref: crates/quantos-engine-manager/src/lib.rs
    verification_command: cargo test -p quantos-engine-manager --locked
    verification_environment: 本机 UDS 超时负向测试
    verification_evidence: docs/audit/F08-remediation-2026-09-25.md
    verification_status: PASS
  - issue_id: F08-H02
    fix_ref: crates/quantos-engine-manager/src/lib.rs
    verification_command: cargo test -p quantos-engine-manager --locked
    verification_environment: 本机签名策略及限速负向测试
    verification_evidence: docs/audit/F08-remediation-2026-09-25.md
    verification_status: PASS
  - issue_id: F08-H03
    fix_ref: crates/quantos-engine-manager/src/lib.rs
    verification_command: cargo test -p quantos-engine-manager --locked
    verification_environment: 本机 RSS 采样通过；CPU/GPU 硬隔离 Gate 已取消
    verification_evidence: docs/audit/F08-remediation-2026-09-25.md
    verification_status: PASS
  - issue_id: F08-H04
    fix_ref: crates/quantos-engine-manager/src/durable.rs
    verification_command: cargo test -p quantos-engine-manager --locked
    verification_environment: 本机 Manager 进程强杀、跨进程同键锁及 Mock 重启缓存
    verification_evidence: docs/audit/F08-continuation-2026-09-25.md
    verification_status: PASS
  - issue_id: F08-H05
    fix_ref: crates/quantos-engine-manager/tests/python_mock_engine.rs
    verification_command: cargo test -p quantos-engine-manager --locked
    verification_environment: 本机 UDS 运行中取消及流负向测试
    verification_evidence: docs/audit/F08-remediation-2026-09-25.md
    verification_status: PASS
  - issue_id: F08-M01
    fix_ref: crates/quantos-engine-manager/tests/python_mock_engine.rs
    verification_command: cargo test -p quantos-engine-manager --locked
    verification_environment: 本机心跳摘流及恢复测试
    verification_evidence: docs/audit/F08-remediation-2026-09-25.md
    verification_status: PASS
  - issue_id: F08-M02
    fix_ref: crates/quantos-engine-manager/src/durable.rs
    verification_command: cargo test -p quantos-engine-manager --locked
    verification_environment: 本机重建 Manager 后恢复持久熔断状态
    verification_evidence: docs/audit/F08-continuation-2026-09-25.md
    verification_status: PASS
  - issue_id: F08-M03
    fix_ref: scripts/check-f08-rust-coverage.mjs
    verification_command: QUANTOS_SKIP_ENV=1 UV_OFFLINE=1 CARGO_NET_OFFLINE=true make f08-check && CARGO_NET_OFFLINE=true make f08-nightly-check
    verification_environment: 本机允许 UDS 绑定的环境；Python 逐文件及 Rust 两道 Gate PASS，逐项豁免与负向探针已审计
    verification_evidence: docs/audit/F08-coverage-closure-2026-09-26.md
    verification_status: PASS
  - issue_id: F08-L01
    fix_ref: docs/runbooks/f08-engine-manager.md
    verification_command: node scripts/check-development-plans.mjs
    verification_environment: 本机 Runbook 与 fail-closed Gate 已落库
    verification_evidence: docs/audit/F08-remediation-2026-09-25.md
    verification_status: PASS
```
