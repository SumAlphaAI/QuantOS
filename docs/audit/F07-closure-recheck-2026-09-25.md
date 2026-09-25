# F07 已关闭问题复核记录

> 日期：2026-09-25；检查时 HEAD：`467108a6f93ab203e845dc56e03c8962dac4a238`；已验收实现基线：`f5993743420cc7f5f2de0544e3b83404eea88cdc`。

## 复核结论与范围

按用户确认的开发阶段范围，12/12 问题均保持关闭：阻塞级 2/2、高危 5/5、中危 4/4、低危 1/1。本轮没有发现需要新增源码修复的原问题回归。`git diff --name-only f5993743420cc7f5f2de0544e3b83404eea88cdc 467108a6f93ab203e845dc56e03c8962dac4a238` 仅列出 5 个文档/归档证据文件；Runtime、迁移、测试、依赖锁及 CI 配置无变更。

本轮逐项读取实现与测试，并重跑下面的本地检查。数据库正向测试、完整 CI、Nightly 和真实服务烟测采用[已归档的 f599374 验收记录](./F07-development-acceptance-2026-09-25.md)，本轮未重新运行远端 Nightly 或目标数据库测试，也未将历史回执重新绑定到当前 HEAD。HTTPS 部署入口和受限 Storage 凭据继续按 L04 上线前 Gate 管理。

## 逐项关闭依据

下表中的 `pg.rs` 指 `crates/quantos-runtime/src/pg.rs`，数据库测试指 `crates/quantos-runtime/tests/postgres_runtime.rs`，Gateway 测试指 `services/runtime-gateway/src/live_tests.rs`。

| ID | 优先级 | 当前实现与自动化依据 | 判定 |
|---|---|---|---|
| F07-A01 | 阻塞级 | `main.rs` 调用 `live::serve()`；`live.rs` 接线真实 HTTP、鉴权、worker 和 Storage。归档本地服务回执覆盖真实登录、排程、Artifact 取回和登出撤销；Gateway 测试覆盖 worker 成功、取消、重试。 | CLOSED（开发阶段） |
| F07-A02 | 阻塞级 | `f07-db-gate.cjs` 强制 DB_REQUIRED、100 样本和 200ms；Nightly 调用该 Gate。f599374 同 SHA CI/Nightly 成功，归档 F06 note 为 PASS。缺库负向测试本轮确认 4 项均失败，避免假绿。 | CLOSED |
| F07-A03 | 高危 | `schedule_run` 校验 session 有效/未撤销、tool enabled/capability、actor、membership、账户模式及 capability 范围；数据库撤销/能力负向测试和 Gateway 身份拒绝路径已覆盖。 | CLOSED |
| F07-A04 | 高危 | 每次 claim 生成 attempt UUID；checkpoint/Artifact/完成/失败操作校验 attempt、租约、状态、deadline；写 checkpoint/Artifact 前锁定 run。数据库旧 attempt 拒绝测试、100 任务 checkpoint 恢复证据通过。 | CLOSED |
| F07-A05 | 高危 | `claim_runs` 限制 attempts 并终止过期耗尽任务；`fail_and_retry` 持久化有界指数退避和最大次数失败终态。数据库预算/重试测试及 Gateway 重试恢复测试已覆盖。 | CLOSED |
| F07-A06 | 高危 | `record_artifact` 原子计量新绑定成本，重复绑定不重复计费；调度 CTE 原子写速率窗口，CHECK 约束拒绝超额并回滚任务。数据库成本拒绝、速率计数及回滚断言通过。 | CLOSED |
| F07-A07 | 高危 | Artifact 写入查询要求 run/manifest tenant 相同；hardening migration 为绑定建立 tenant+run、tenant+artifact 复合外键。数据库 foreign manifest 和真实 HTTP 跨租户拒绝证据通过。 | CLOSED |
| F07-A08 | 中危 | 请求指纹覆盖序列化调度输入；相同 key 指纹不一致返回冲突。数据库 changed-input 断言和内存拒绝测试覆盖。 | CLOSED |
| F07-A09 | 中危 | cancel 只转换 queued/running；finalize 只转换 cancel_requested 且等待租约到期；timeout 包含取消中状态并排除所有终态；审计与状态同事务提交。数据库精确 audit 列表及 Gateway 取消回归通过。 | CLOSED |
| F07-A10 | 中危 | 远程连接必须 verify-full，OpenSSL PEER 校验证书，Runtime 登录只具备 Runtime 角色。归档独立登录/严格 TLS 烟测通过；本轮传输和角色负向单元测试通过。 | CLOSED |
| F07-A11 | 中危 | PostgreSQL 测试默认/正式 Gate 均使用 200ms 和 100 个逐次样本；历史正式 Nightly P95 27.66ms，满足 <200ms。覆盖率插桩阶段的延迟不替代正式测量。 | CLOSED |
| F07-A12 | 低危 | `tests/fixtures/f07-workflow.json`、专项数据库/Gateway 测试、恢复/回滚 Runbook、三项达标覆盖率和验收归档均存在。主报告现整理为当前结论，明细转移至本历史记录。 | CLOSED |

## 本轮检查结果

| 检查 | 结果与边界 |
|---|---|
| `cargo test -p quantos-runtime --lib --locked` | PASS，12/12；包含内存状态机、TLS 和专用角色负向检查。 |
| `cargo test -p runtime-gateway --bin runtime-gateway --locked malformed_cookie_is_rejected_before_database_access` | PASS，1/1；只证明无数据库访问前的 cookie 拒绝路径。 |
| `env -u DATABASE_URL QUANTOS_F07_DB_REQUIRED=1 cargo test -p quantos-runtime --test postgres_runtime --locked -- --test-threads=1` | 预期拒绝：退出 101，4 项缺库失败、1 个子进程 helper ignored；此结果不是数据库功能 PASS。 |
| 归档 JSON 核验 | F06 status=PASS、failures=[]；F07 sourceCommit=f599374、dirty=false、DIAGNOSTIC_ONLY，保持临时管理员 Storage key 的诊断边界。 |
| `node scripts/check-development-plans.mjs`、`git diff --check` | 文档更新后通过；结构校验不表示平台加载或另一次模型复审。 |

## 从开发计划移出的关闭追踪

以下内容保留问题 ID、修复基线和既有验证路径，供追溯；不再占用主报告和开发计划的活动问题清单。

```yaml
- issues:
  - issue_id: F07-A01
    severity: BLOCKER
    description: 本地 Runtime 服务入口和真实 worker 接线已验证
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A02
    severity: BLOCKER
    description: 隔离库、同 SHA 量化回执及 F06 依赖已齐
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A03
    severity: HIGH
    description: session 与 tool 授权负向路径已在数据库验证
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A04
    severity: HIGH
    description: 租约凭据与旧 worker 写入拒绝已在数据库验证
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A05
    severity: HIGH
    description: PostgreSQL 重试与最大次数终态已验证
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A06
    severity: HIGH
    description: 成本与速率限额已在数据库验证
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A07
    severity: HIGH
    description: Artifact 租户复合约束迁移和负向验证已通过
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A08
    severity: MEDIUM
    description: 请求指纹幂等冲突已在数据库验证
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A09
    severity: MEDIUM
    description: cancel 和 deadline 状态竞态已在数据库验证
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A10
    severity: MEDIUM
    description: 运行时严格 TLS 与专用角色已在隔离目标连接验证
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A11
    severity: MEDIUM
    description: 200ms P95 门槛已由同 SHA Nightly 实测通过
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
  - issue_id: F07-A12
    severity: LOW
    description: fixture、Runbook、覆盖率和文档追踪已完成开发阶段验收
    evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    status: CLOSED
- fix_tracking:
  - issue_id: F07-A01
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: make f07-target-service-acceptance
    verification_environment: isolated_supabase_local_service
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A02
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: F07 Nightly #6 && QuantOS CI #138 && make f06-acceptance-gate
    verification_environment: github_actions_and_isolated_supabase
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A03
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: F07 Nightly #6 && make f07-target-service-acceptance
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A04
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: F07 Nightly #6
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A05
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: F07 Nightly #6
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A06
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: F07 Nightly #6
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A07
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: F07 Nightly #6 && make f07-target-service-acceptance
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A08
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: F07 Nightly #6
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A09
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: F07 Nightly #6
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A10
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: make f07-target-service-acceptance
    verification_environment: isolated_supabase_local_service
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A11
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: F07 Nightly #6
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F07-A12
    fix_ref: f5993743420cc7f5f2de0544e3b83404eea88cdc
    verification_command: F07 Nightly #6 && node scripts/check-development-plans.mjs
    verification_environment: github_actions_and_local
    verification_evidence: docs/audit/F07-development-acceptance-2026-09-25.md
    verification_status: PASS
```
