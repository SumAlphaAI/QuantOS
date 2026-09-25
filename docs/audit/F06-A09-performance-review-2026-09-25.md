# F06-A09 鉴权读性能续修与隔离目标复验

> 后续验收范围修正：用户确认 F06 阶段无同区域运行器使用权限，已在 [A09 Gate 范围修正](./F06-A09-gate-scope-correction-2026-09-25.md)移除同区域 Gate。本报告记录修正前的要求与测试事实，A09 最新状态以修正报告为准。

> 日期：2026-09-25。被测源码完整提交：`a301c740108f44accbd9d9311892a1bfd5a305a4`。开发机到隔离 Supabase `ca-central-1` 的结构化结果见 [跨区域回执](./F06-A09-developer-remote-receipt-2026-09-25.json)。没有输出数据库 URL、口令、测试身份或 TLS 私有配置。

## 任务完成概况

**A09 保持 OPEN；两个必需拓扑中 1/2 通过。** 本轮增加使用正式受限 BFF 登录、严格 TLS、现有隔离测试身份的只读 100 次鉴权 Gate。开发机跨区域 P95 为 **392.78ms，严格小于 500ms**；同区域 `<100ms` 尚无运行器及回执，不能从开发机结果推定。F06 总状态保持 `FIX_VALIDATION`。

## 完成情况明细统计

| 项目 | 结果 | 说明 |
|---|---|---|
| 专用 BFF 登录与证书验证 | PASS | `GatewayAuthMiddleware::connect_as_bff` 要求独立角色和 `sslmode=verify-full`；本次连接及 100 次授权成功。先前 pooler 证书问题在该服务 URL/CA 组合上已不再阻断。 |
| 开发机跨区域 100 次鉴权读 | **PASS，P95 392.78ms** | P50 222.396ms；门槛严格 `<500ms`；回执绑定完整 SHA、`quantos_bff` 角色、拓扑和数据库区域。提交前另两组诊断为 282.328ms、313.683ms，不作为正式同 SHA 回执。 |
| 同区域 100 次鉴权读 | **NOT RUN / NO RECEIPT** | 仓库只有普通 GitHub hosted runner；本机没有 QuantOS 的 `ca-central-1` 运行器。已准备同一 Gate 的 `same_region` 模式，要求运行器区域与数据库区域一致，并填写部署证据引用。该元数据仍须由实际运行器记录佐证。 |
| 非同区域伪装负向检查 | PASS | 未提供匹配区域和运行器部署证据时，`same_region` Gate 在数据库连接前拒绝。 |
| 代码质量 | PASS | 定向 Rust 测试、Clippy `-D warnings`、Node 语法、格式、diff 与秘密扫描通过。 |

原有 `make f06-live-check` 在 operator 连接和临时 fixture 上曾测得 651ms，且同库 `select 1` P95 曾达 526ms；这是历史真实失败。本轮新 Gate 使用独立 BFF 登录和已有隔离身份，避免将 operator 测量或 fixture 写入成本当作服务查询延迟。网络链路明显波动，单次 PASS 不证明长期稳定。

## 问题清单及风险分析

1. **中危，A09，同区域验收缺口**：没有位于 Supabase 数据库 `ca-central-1` 的受控运行器、运行器部署元数据及 `<100ms` 的 100 样本回执。影响是 F06 的性能双门槛只完成 1/2，不能关闭 A09 或放行 F06。
2. **中危，A09，跨区域波动**：历史 operator P95 651ms，本轮专用 BFF P95 392.78ms，前两组诊断也不同。不同连接角色与采样时段不能互相替代；以后源码、数据库路由或网络状态变化后，应重新绑定完整 SHA 测量。
3. **低危，Gate 证据归属**：`QUANTOS_F06_RUNNER_REGION` 和 `QUANTOS_F06_RUNNER_EVIDENCE` 是运行器提供的声明；最终审计需核对部署 ARN/实例/容器元数据、区域和测试时间，不将手填变量本身视为可信证明。

## 整改建议与同区域执行步骤

1. 在 QuantOS 隔离项目中准备 `ca-central-1` 的受控 Linux 运行器。它只需出站访问同项目 Supabase pooler，不需部署 Terminal 或正式交易服务。使用当前代码完整 SHA，注入现有 `QUANTOS_BFF_DATABASE_URL`、`QUANTOS_F06_TEST_USER_ID`、`QUANTOS_F06_TEST_TENANT_ID`、`QUANTOS_F06_TEST_ACCOUNT_ID`，秘密仅放运行器秘密管理配置。
2. 在该运行器设置 `QUANTOS_F06_TOPOLOGY=same_region`、`QUANTOS_F06_RUNNER_REGION=ca-central-1`、`QUANTOS_F06_RUNNER_EVIDENCE=<部署 ARN 或可复核的运行器记录>`，执行 `make f06-auth-latency-check`。保存 JSON 输出、运行器区域元数据、测试时间和完整源码 SHA；必须是 100 次且 P95 严格 `<100ms`。若失败，先比较同区域 `select 1` 网络基线与 PostgreSQL 查询计划，再优化连接和 SQL；不得放宽阈值或用缓存替代逐次授权读取。
3. 在同一最终源码 SHA 重新采集开发机跨区域回执和同区域回执；双 PASS 后再关闭 A09。F06 的其他开放问题和总回执仍分别验收。
