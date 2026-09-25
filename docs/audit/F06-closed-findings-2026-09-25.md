# F06 已关闭问题与修复追踪归档

> 从开发计划迁出，保留原 10 项关闭记录及验证路径；本次仅整理文档，不代表重新执行目标环境验收。

当前结论见 [F06 复审报告](./F06-comprehensive-review-2026-09-24.md)。原有验收范围、同 SHA 回执及干净工作树要求继续有效。此文件由 F06 验收 Gate 读取；缺项、重复编号或非 CLOSED 状态均不得通过。

本轮验证：计划结构检查通过；F06 Gate 5/5 测试通过，包括原有同 SHA/三组回执拒绝条件，以及归档缺失、重复 ID、非 CLOSED 状态和缺失归档链接的拒绝。未重跑目标环境验收，未生成新 SHA PASS 回执。

## 已关闭记录

- issues:
  - issue_id: F06-A01
    severity: BLOCKER
    description: 已验证真实 Auth/BFF/Runtime 身份闭环
    evidence: docs/audit/F06-A01-A08-target-review-2026-09-24.md
    status: CLOSED
  - issue_id: F06-A02
    severity: BLOCKER
    description: 已验证受控 Execution 到 Vault 的隔离 paper 命令链
    evidence: docs/audit/F06-A02-command-path-review-2026-09-25.md
    status: CLOSED
  - issue_id: F06-A03
    severity: HIGH
    description: 已验证跨租户关系约束与查询隔离
    evidence: docs/audit/F06-A03-A04-A05-target-review-2026-09-25.md
    status: CLOSED
  - issue_id: F06-A04
    severity: HIGH
    description: 已验证 Primary 主上下文与账户模式
    evidence: docs/audit/F06-A03-A04-A05-target-review-2026-09-25.md
    status: CLOSED
  - issue_id: F06-A05
    severity: HIGH
    description: 已验证 capability 默认拒绝与账户模式范围
    evidence: docs/audit/F06-A03-A04-A05-target-review-2026-09-25.md
    status: CLOSED
  - issue_id: F06-A06
    severity: HIGH
    description: 已验证专用角色登录与最小权限
    evidence: docs/audit/F06-A02-A06-A07-target-review-2026-09-25.md
    status: CLOSED
  - issue_id: F06-A07
    severity: HIGH
    description: 已验证 Vault 路径收敛与撤销过期拒绝
    evidence: docs/audit/F06-A02-A06-A07-target-review-2026-09-25.md
    status: CLOSED
  - issue_id: F06-A08
    severity: MEDIUM
    description: 已验证四类请求与四角色 Vault 拒绝矩阵
    evidence: docs/audit/F06-A01-A08-target-review-2026-09-24.md
    status: CLOSED
  - issue_id: F06-A09
    severity: MEDIUM
    description: 开发机跨区域鉴权读 P95 已转诊断；同区域性能移至首次部署验证
    evidence: docs/audit/F06-A09-remote-latency-gate-withdrawal-2026-09-25.md
    status: CLOSED
  - issue_id: F06-A10
    severity: LOW
    description: 已区分开发完成与绑定提交的目标验收
    evidence: docs/audit/F06-final-same-sha-acceptance-2026-09-25.md
    status: CLOSED
- fix_tracking:
  - issue_id: F06-A10
    fix_ref: 72ea0d17fb6a8ff4512a40aefd4bfd324b3776d9
    verification_command: make f06-acceptance-gate
    verification_environment: isolated_supabase_local_bff_execution_runtime_developer_remote
    verification_evidence: docs/audit/F06-final-same-sha-acceptance-2026-09-25.md
    verification_status: PASS
  - issue_id: F06-A03
    fix_ref: 1839b98c950c7f2d532b59dea3bac8d2d87fed53
    verification_command: make f06-live-check
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F06-A03-A04-A05-target-receipt-2026-09-25.json
    verification_status: PASS
  - issue_id: F06-A04
    fix_ref: 1839b98c950c7f2d532b59dea3bac8d2d87fed53
    verification_command: make f06-live-check && make f06-bff-live-smoke
    verification_environment: isolated_supabase_local_bff
    verification_evidence: docs/audit/F06-A03-A04-A05-target-receipt-2026-09-25.json
    verification_status: PASS
  - issue_id: F06-A05
    fix_ref: 1839b98c950c7f2d532b59dea3bac8d2d87fed53
    verification_command: cargo test -p quantos-policy --locked && make db-apply && make f06-live-check
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F06-A03-A04-A05-target-receipt-2026-09-25.json
    verification_status: PASS
  - issue_id: F06-A09
    fix_ref: 530bdeda46c7c0a17c8c3ba9c6971f878aed164d
    verification_command: QUANTOS_F06_TOPOLOGY=developer_remote make f06-auth-latency-check
    verification_environment: isolated_supabase_developer_remote
    verification_evidence: docs/audit/F06-A09-scope-correction-receipt-2026-09-25.json
    verification_status: PASS
  - issue_id: F06-A02
    fix_ref: d6e9c20d007a0d87d0b80e530ebfa86b90af9d4f
    verification_command: QUANTOS_F06_ISOLATED_PROJECT=1 make f06-execution-command-smoke && make f06-execution-login-check && make f06-vault-check
    verification_environment: isolated_supabase_local_execution
    verification_evidence: docs/audit/F06-A02-command-path-receipt-2026-09-25.json
    verification_status: PASS
  - issue_id: F06-A06
    fix_ref: d99b18095bfcd3ea09cfd02d0db1ba6b0fb8b0cb
    verification_command: make f06-execution-login-check && make f06-execution-service-check
    verification_environment: isolated_supabase_local_execution
    verification_evidence: docs/audit/F06-A02-A06-A07-target-receipt-2026-09-25.json
    verification_status: PASS
  - issue_id: F06-A07
    fix_ref: d99b18095bfcd3ea09cfd02d0db1ba6b0fb8b0cb
    verification_command: make f06-vault-check && make rls-policy-test
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F06-A02-A06-A07-target-receipt-2026-09-25.json
    verification_status: PASS
  - issue_id: F06-A01
    fix_ref: fa6e540714231663324ada627c60c101764122fb
    verification_command: make f06-bff-live-smoke && make f06-runtime-login-check && QUANTOS_F06_ISOLATED_PROJECT=1 QUANTOS_F06_ALLOW_TEMP_ADMIN_STORAGE_KEY=1 make f06-runtime-live-smoke
    verification_environment: isolated_supabase_local_bff
    verification_evidence: docs/audit/F06-A01-A08-target-receipt-2026-09-24.json
    verification_status: PASS
  - issue_id: F06-A08
    fix_ref: 559471e60bdb380695853d1151cd2e655a79cbc7
    verification_command: make f06-denial-matrix && make f06-vault-check
    verification_environment: isolated_supabase
    verification_evidence: docs/audit/F06-A01-A08-target-receipt-2026-09-24.json
    verification_status: PASS
