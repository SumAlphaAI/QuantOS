# F07 覆盖率补齐与目标服务复验（2026-09-25）

## 任务完成概况

本轮对 `F07 Runtime 最小可恢复工作流` 补充实际 HTTP、worker、Storage 和故障路径测试，并在隔离 Supabase PostgreSQL 17 项目上复验。Rust 覆盖率三项门槛已通过。目标服务使用真实 Supabase Auth 身份与独立 BFF/Runtime 数据库登录，完整运行排程、worker、私有 Storage 上传、Artifact 校验取回、跨租户拒绝和会话撤销。目标服务回执仍是 **`DIAGNOSTIC_ONLY`**：执行时工作树未提交，Storage 临时使用管理员 key，且尚无同一新 SHA 的 CI/Nightly 与部署入口回执。F07 保持 `FIX_VALIDATION`。

## 完成情况明细统计

| 检查项 | 本轮结果 | 证据与边界 |
| --- | --- | --- |
| Rust 行覆盖率 | **2011/2156 = 93.27%，PASS** | `artifacts/f07/coverage.json`，要求 ≥90% |
| Rust 区域覆盖率 | **2336/2650 = 88.15%，PASS** | 同一覆盖率 JSON，要求 ≥85% |
| Rust 分支覆盖率 | **123/138 = 89.13%，PASS** | nightly Rust `--branch` 诊断，要求 ≥85% |
| 诊断数据库恢复 | **10/10、唯一 Artifact 绑定 10/10** | `artifacts/f07/coverage-diagnostic.json`；仅为覆盖率诊断，调度 P95 不作正式判定 |
| 网关链路 | PASS | 真实 PostgreSQL fixture 与本地 Storage 适配器；会话、Tool、排程、读取、取消、worker 成功/失败/重试、Artifact 与租户/actor 拒绝 |
| 目标服务链路 | **DIAGNOSTIC_ONLY** | `artifacts/f07/target-service.json`；真实 Supabase Auth、BFF cookie、独立服务登录、严格 TLS、私有 Storage 上传与按哈希取回、跨租户拒绝、登出撤销 |
| 前向迁移与 RLS | PASS | `20260925120000_f07_actor_identity_uniqueness.sql` 与 `20260925121000_f07_artifact_bucket.sql` 已应用到隔离项目；RLS 基线通过 |
| 同 SHA 完整 Nightly | NOT RUN | 当前变更尚未生成并推送新提交；不能复用 `adfde71` 的 Nightly 回执 |
| 受限 Storage 凭据 | NOT RUN | 本轮仅获授权使用临时管理员 key；不得据此声称最小权限配置已验收 |
| 部署入口 | NOT RUN | 本轮运行的是本地 BFF/Runtime 二进制连接隔离目标服务，尚非部署后的 HTTPS 入口 |

计量文件仍为 `quantos-runtime/src/lib.rs`、`quantos-runtime/src/pg.rs`、`runtime-gateway/src/live.rs`；`scripts/f07-coverage-check.cjs` 的 90%/85%/85% 门槛和文件列表未降低。此前 `adfde71` Nightly 的调度 P95 为 38.61ms，覆盖率为 67.43%/56.15%/26.87%；该结果仅适用于其自身 SHA。本轮本机覆盖率诊断 10 次任务的 P95 受跨区域网络往返影响，不计入正式的 `<200ms` 判定。

## 问题清单及风险分析

| 优先级 | 模块 | 具体表现与影响范围 | 本轮处理/剩余风险 |
| --- | --- | --- | --- |
| 阻塞级 | F07 验收回执 | 新覆盖率和目标服务证据来自未提交工作树，缺同 SHA 的完整 100 次强杀恢复、调度 P95、CI/Nightly 回执。 | 待提交、推送并在同 SHA 重跑；当前不能放行 F07。 |
| 高危 | Storage 权限与部署 | 目标服务使用临时管理员 Storage key；未证明只可访问 `quantos-artifacts`，也未走部署 HTTPS 入口。 | 目标回执标为 `DIAGNOSTIC_ONLY`；正式验收需要受限凭据与部署入口。 |
| 高危（已修复） | `quantos.actors` | 原 `UNIQUE NULLS NOT DISTINCT (tenant_id, service_name)` 拒绝同租户第二个普通用户 actor；同理 `user_id` 约束限制 service actor。影响同租户权限隔离与正常协作。 | 前向迁移改为仅对非空 user/service 标识唯一；同租户第二 actor 及资源拒绝用例通过。该 schema 变更需要 F06 受影响 Gate 复验。 |
| 中危（已修复） | Supabase Storage | 隔离项目缺少 `quantos-artifacts` Bucket；首次目标运行重试耗尽，`last_error=storage upload failed`。 | 前向迁移创建私有 Bucket；Storage API 上传/删除探针及完整目标链路通过。 |
| 低危 | 测试资源 | 目标 Auth fixture 与 append-only audit 按隔离库证据策略保留；当前仅注销 BFF session、停用 Tool 并清理未完成任务。 | 仅在隔离项目运行，维护 fixture 库存；不得用于生产项目。 |

## 整改建议与下一步验收

1. 将本轮代码、迁移、Runbook 和本报告生成独立提交；在干净工作树上重跑覆盖率诊断与目标服务诊断，记录新完整 SHA。
2. 推送该 SHA，等 CI 与 F07 Nightly 全部终态；Nightly 必须重新执行 100 次强杀恢复、唯一 Artifact、调度 P95 `<200ms` 及三项覆盖率，不能引用旧 SHA 结果。
3. 为 Runtime 配置并证明只可访问私有 Artifact Bucket 的凭据，再通过部署的 HTTPS 入口复验真实会话、跨租户拒绝、cancel/timeout、重启恢复与 Artifact 取回；回执需绑定同一 SHA。
4. 本轮修改 `actors` 身份 schema；按新 SHA 复验受影响的 F06 身份、RLS、拒绝矩阵和 BFF/Runtime 登录 Gate。

运行中的诊断回执由 Gate 写到 `artifacts/f07/`，含目标项目引用哈希而无数据库密码或 Storage key；它们不作为 Git 跟踪文件。正式验收只以最终提交对应的完整、干净、终态回执为准。
