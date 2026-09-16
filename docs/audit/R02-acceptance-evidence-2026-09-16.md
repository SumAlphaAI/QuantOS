# CORE:R02 验收证据（2026-09-16）

## 范围与结论

- 任务：`CORE:R02` DataSnapshot、血缘与质量 Gate
- 仓库：QuantOS
- 本地源码 Gate：`PASS`
- 生产/目标环境动作：未执行
- 真实 PostgreSQL 查询 P95、目标 Supabase RLS、Supabase Storage 往返：`NOT RUN / NO RECEIPT`

## 需求映射

| 验收项 | 实现与证据 | 结果 |
|---|---|---|
| 相同输入生成相同 hash | 输入排序、canonical JSON 与 SHA-256；`data_snapshot_hash_is_stable_for_equivalent_inputs` | PASS |
| 不可变快照 | PostgreSQL `ON CONFLICT DO NOTHING`；`trg_data_snapshots_reject_update` 拒绝 UPDATE | PASS（源码/migration） |
| 时间窗、schema、质量、许可证、来源、血缘 | `DataSnapshotInput` / `DataSnapshotRecord` 完整建模 | PASS |
| 质量 Gate 租户隔离 | 规则 tenant 必须与 snapshot tenant 相同；缺失规则 fail closed | PASS |
| 300 个拒绝 fixture | 100 过期、100 质量失败、100 许可证缺失；逐一验证 Strategy 与 Trading | PASS |
| 不完整元数据拒绝 | 缺来源、来源许可证或血缘均拒绝 | PASS |
| PostgreSQL 与 RLS | 两张表均 enable + force RLS，member policy 使用 tenant membership | PASS（静态 migration） |
| 对象存储 | 上传前和读取后校验 payload hash；登记失败时删除已上传对象 | PASS（本地单元边界） |
| 查询 P95 `<300ms` | opt-in live PostgreSQL test 采样 25 次并断言 P95 | NOT RUN / NO RECEIPT |
| 目标 RLS 与 Storage 往返 | 需要外部 Supabase/PostgreSQL 凭据及授权 | NOT RUN / NO RECEIPT |

## 自动化命令与结果

| 命令 | 结果 |
|---|---|
| `make r02-check` | PASS：静态 Gate PASS；负向 Gate 12/12；storage 10/10；runtime 5/5；strategy 16/16 |
| `cargo fmt --all -- --check` | PASS |
| `cargo clippy -p quantos-storage -p quantos-strategy -p quantos-runtime --all-targets -- -D warnings` | PASS，0 warning |
| `make db-migration-check` | PASS：migration 文件名与 RLS baseline |
| `node scripts/check-development-plans.mjs` | PASS：48 core、75 frontend；平台加载与模型复审 `NOT_RUN` |
| `make lockfile-check` | PASS：所需 lockfile 均存在 |
| `node scripts/check-secrets.mjs` | PASS：仓库 secret-pattern 检查 |

## 负向 Gate

`scripts/r02-gate-negative.mjs` 会主动破坏并确认拒绝：租户规则绑定、300 fixture 数量、血缘元数据、不可变 insert、数据库更新触发器、强制 RLS、tenant 查询谓词、P95 阈值、默认 Gate 本地隔离、R02 状态与 R01 依赖。

## 未决风险

1. 真实 PostgreSQL 网络与负载条件下的查询 P95 尚无 receipt。
2. 目标 Supabase JWT/角色下的 RLS 正负向行为尚未执行。
3. Supabase Storage 上传、读取、删除和补偿路径尚未执行真实服务往返。
4. 本地与 CI Gate 证明源码和迁移约束，不等同于生产部署或发布授权。
5. 探索性执行包含全部 `quantos-runtime` integration tests 时，两个既有 R03 `rd-agent` 编排用例因本机 Unix socket 未出现而失败；R02 默认 Gate 已限定为受影响 crate 的本地 library tests，该 R03 环境问题不计为 R02 通过证据。
