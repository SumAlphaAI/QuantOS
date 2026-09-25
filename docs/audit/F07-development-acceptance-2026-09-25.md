# F07 开发阶段验收与上线前移交

> 日期：2026-09-25；实现基线：`f5993743420cc7f5f2de0544e3b83404eea88cdc`；结论范围：F07 开发阶段功能验收。本文是对 [初审](./F07-comprehensive-review-2026-09-24.md)、[整改](./F07-remediation-2026-09-24.md)及[覆盖率与服务复验](./F07-coverage-target-service-2026-09-25.md)的后续判定，不改写当时的失败与诊断记录。

## 一、任务完成概况

**F07 开发阶段 `ACCEPTED`；Runtime 上线前准入 `NOT RUN`。** 用户明确将部署后的 HTTPS BFF/Runtime 入口和 Runtime Storage 最小权限凭据检查移至项目末期。当前开发阶段仍须有可运行的本地服务、真实隔离数据库、自动化负向测试、强杀恢复、审计、性能、覆盖率及 F04–F06 依赖证据。这些条件在上述实现基线上满足。初审 18 项按修订后的开发阶段口径为 **18/18（100%）**；F07 专属三项量化标准为 **3/3**；初审问题 F07-A01–A12 在开发范围内 **12/12 关闭**。这里的 100% 只表示该阶段检查表完成，不表示部署或上线风险检查完成。

服务烟测运行于本地 BFF/Runtime 进程并连接隔离 Supabase，已归档的 [target-service.json](./evidence/F07-development-2026-09-25/target-service.json) 的 `sourceCommit` 与上述 SHA 一致、`dirty=false`，但其 `status=DIAGNOSTIC_ONLY`、`storageCredentialScope=temporary-admin-key`。它是开发功能证据，不能作为最小权限或部署入口回执。旧的本地 `artifacts/f07/database.json` 为 `1e14310` 的失败且脏工作树结果，**不计入**本次验收；正式数据库量化结果采用同 SHA Nightly 上传物。

## 二、证据与完成情况明细

| 证据 | 核验结果 | 适用范围 |
|---|---|---|
| [QuantOS CI #138](https://github.com/SumAlphaAI/QuantOS/actions/runs/36123638398) | `SUCCESS`，`headSha=f5993743420cc7f5f2de0544e3b83404eea88cdc`；主 CI 含工作区验证、数据库重建/漂移/RLS、签名策略及独立下载验签。 | 同源码基线的通用代码、供应链与数据库回归。 |
| [F07 Runtime Nightly #6](https://github.com/SumAlphaAI/QuantOS/actions/runs/36123778702) | `SUCCESS`，同完整 SHA；上传物 `f07-nightly-f5993743420cc7f5f2de0544e3b83404eea88cdc`，Actions Artifact 摘要 `sha256:f85b62bc44448ce1ddd22aa5dc3110ca26421d82cb5b62773c805378a798e07d`。 | 隔离 Supabase PostgreSQL 的正式恢复、P95、覆盖率 Gate。 |
| Nightly 量化结果 | worker 经 OS 强杀后 100/100 任务从 checkpoint 恢复、100/100 唯一 Artifact 绑定；cancel/timeout audit 测试通过；100 次调度 P95 **27.66ms <200ms**。 | F07 三项专属量化标准通过。 |
| Nightly 覆盖率 | 指定三个文件的 Rust line **2030/2160=93.98%**、region **1593/1837=86.72%**、branch **123/138=89.13%**；分别高于 90%/85%/85%。 | 只覆盖 `quantos-runtime/src/lib.rs`、`quantos-runtime/src/pg.rs`、`runtime-gateway/src/live.rs`，未扩张统计口径。 |
| 本地服务诊断 | 真实 Supabase Auth；独立 BFF/Runtime 数据库登录及严格 TLS；HTTP 排程、worker、私有 Storage 上传、Artifact 校验取回；跨租户 run/cancel/Artifact 拒绝、缺失 cookie 拒绝、登出撤销。 | 证明本地服务功能闭环；临时管理员 Storage key 限于隔离测试，不证明受限凭据。 |
| F06 依赖 | 同 SHA 的本地 `refs/notes/f06-acceptance` [归档副本](./evidence/F07-development-2026-09-25/f06-acceptance-note.json) 为 `PASS`、`failures=[]`；真实 Auth/BFF/Runtime、Execution/Vault、拒绝矩阵及总 Gate 均通过。 | F06 在此实现基线的依赖复验；Git note 是本地证据，不冒称远端附件。F04/F05 采用其既有已验收记录。 |

初审 18 项复核映射如下；“本地服务”均指隔离环境中本机进程，不表示已有对外部署。

| # | 检查点 | 开发阶段结果与证据 |
|---:|---|---|
| 01 | Runtime crate 可构建 | PASS；主 CI 与定向 Rust 测试。 |
| 02 | 持久任务表、迁移、RLS | PASS；主 CI 数据库重建/漂移/RLS，Nightly 隔离 Supabase 前向迁移。 |
| 03 | session 生命周期 | PASS；撤销、过期和服务身份负向路径在数据库/本地 HTTP 测试中通过。 |
| 04 | tool registry 与 capability | PASS；能力不匹配和禁用拒绝在 PostgreSQL 测试中通过。 |
| 05 | 持久调度与幂等 | PASS；原子调度及冲突输入拒绝在 PostgreSQL 测试中通过。 |
| 06 | deadline 与超时 | PASS；过期拒绝、持久终态与 timeout audit 在 PostgreSQL 测试中通过。 |
| 07 | cancel | PASS；本地 HTTP 取消、跨租户拒绝及 worker 终态测试通过。 |
| 08 | retry 与最大次数 | PASS；持久退避、重试上限与失败终态测试通过。 |
| 09 | checkpoint 与恢复 | PASS；租约 attempt fencing、旧 worker 写入拒绝及 100 次强杀恢复通过。 |
| 10 | Artifact API 与去重 | PASS；本地私有 Storage 往返、内容 hash 校验、租户拒绝及 100 次唯一绑定通过。 |
| 11 | 成本限额 | PASS；原子用量计数与超限拒绝测试通过。 |
| 12 | 速率限额 | PASS；窗口计数、超限拒绝和回滚测试通过。 |
| 13 | worker 与服务接线 | PASS；本地独立 Runtime HTTP/worker 真实运行，Gateway 测试通过。 |
| 14 | 100 次强杀恢复及唯一 Artifact | PASS；同 SHA Nightly 100/100。 |
| 15 | cancel/timeout audit | PASS；同 SHA PostgreSQL 测试验证事件与状态同事务写入。 |
| 16 | 调度 P95 <200ms | PASS；同 SHA Nightly 100 样本 P95 27.66ms。 |
| 17 | fixtures、输入/拒绝/恢复测试 | PASS；版本化 fixture、PostgreSQL 负向矩阵及 HTTP 回归。 |
| 18 | 专项 Gate、覆盖率、运行手册、依赖 | PASS；同 SHA CI/Nightly、三项覆盖率、[恢复手册](../runbooks/f07_runtime_recovery.md)及 F06 本地总 Gate。上线部署与 Storage 凭据单列 L04。 |

## 三、问题清单及风险分析

| 问题 | 原优先级 | 开发阶段处置 | 保留边界 |
|---|---|---|---|
| F07-A01、A02 | 阻塞级 | 本地真实 HTTP/worker、同 SHA CI/Nightly、F06 依赖通过，关闭开发阶段缺口。 | 外部部署入口仍待 L04。 |
| F07-A03–A07 | 高危 | session/tool 授权、attempt fencing、重试上限、限额、Artifact 复合租户约束由隔离数据库负向测试及本地服务路径验证，关闭。 | 不将临时管理员 Storage key 视为生产权限设计。 |
| F07-A08–A11 | 中危 | 幂等冲突、cancel/deadline、严格 TLS/专用数据库角色和实测 P95 已验证，关闭。 | 目标部署后的网络与证书配置仍需复验。 |
| F07-A12 | 低危 | fixture、恢复/回滚手册、覆盖率与本报告已归档，关闭开发阶段缺口。 | 实际部署回滚演练仍属 L04。 |

**待上线前验证的两项条件是新阶段的独立开放项，不属于 F07 开发阶段未完成问题：**

1. **部署入口**：在拟上线的隔离环境中，从外部 HTTPS BFF/Runtime 入口以真实身份完成登录、调度、worker 重启恢复、Artifact 取回及跨租户拒绝，并留存网络、证书和回滚回执。
2. **Storage 最小权限**：Runtime 凭据只能读写 `quantos-artifacts`；其他 bucket 的读写必须被拒，且验证轮换与撤销。临时管理员 key 的 `DIAGNOSTIC_ONLY` 回执不可升级为此项 PASS。

两项均应在 L04 上线证据包中绑定候选发布源码 SHA。缺任一项时，**F07 开发可继续依赖，Runtime 不得发布**。若后续代码或配置改变关键运行路径，应对受影响 Gate 重新取证；本报告不会自动迁移至新源码基线。

## 四、整改与移交建议

1. 继续后续 F0 开发，无须为当前 F07 开发验收先建公网部署环境或长期 Storage 凭据。
2. 保持 Nightly 的 100 次恢复、P95、覆盖率及负向测试；保持本地服务诊断的 `DIAGNOSTIC_ONLY` 标记和隔离项目限制。
3. 到 L04 拟上线时配置部署入口及受限 Storage 凭据，执行上述正负向和恢复检查，生成同候选发布 SHA 的独立回执，再判断 Runtime 发布。
