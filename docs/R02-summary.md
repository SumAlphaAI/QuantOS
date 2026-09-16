# CORE:R02 DataSnapshot、血缘与质量 Gate

## 交付范围

R02 提供确定性的 `DataSnapshot` 契约：schema、时间窗、来源与许可证、质量状态、对象引用、血缘、有效期和内容 hash。等价输入经规范化后生成相同 hash；PostgreSQL 以 `(tenant_id, content_hash)` 去重，并由触发器拒绝已有快照的更新。

策略和交易入口使用租户绑定的质量规则，缺少规则、来源、来源许可证或血缘时均 fail closed；过期、质量失败或许可证缺失的 300 个固定 fixture 全部被拒绝。对象存储适配器在上传和读取时校验内容 hash。

## 验证入口

- `make r02-check`：静态交付 Gate、12 个破坏性 Gate 测试、storage/strategy/runtime Rust 测试。
- `make r02-live-check`：需要显式提供 `DATABASE_URL`，执行 PostgreSQL 持久化、租户访问和查询 P95 `<300ms` 检查。
- `make db-migration-check`：migration 文件名及 RLS 基线检查。

## 验收边界

本次不使用生产或外部环境凭据。源码、migration、单元/集成边界和 CI 接线可在本地验收；真实 PostgreSQL P95、目标 Supabase RLS 行为和 Supabase Storage 往返均为 `NOT RUN / NO RECEIPT`，不能由本地绿色测试替代。

详细证据见 [R02 验收证据](./audit/R02-acceptance-evidence-2026-09-16.md)。
