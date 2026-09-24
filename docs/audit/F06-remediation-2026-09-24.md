# F06 整改复验记录

> 日期：2026-09-24。基线复审见 [F06 全面复审](./F06-comprehensive-review-2026-09-24.md)。本记录区分源码修复、本地/隔离库 Gate 与正式目标验收；提交后的完整 SHA 应用于后续目标回执。

## 一、任务完成概况

按 F06-A01 至 A10 逐项整改了身份来源、主上下文、同租户约束、能力范围、Vault 访问路径、应用角色和负向数据库 Gate。代码已形成可复验的独立修复集，但 **F06 仍未达到完整验收**：正式 OIDC 与 BFF 全路由尚未取得目标运行回执，Execution Gateway 尚未在真实下单路径调用秘密解析，同区域 P95 未运行，当前开发机跨区域库的 100 次采样 P95 超过 500ms。`make f06-acceptance-gate` 因 review 未接受及缺同 SHA 目标回执按预期失败。

## 二、完成情况明细

| 审计项 | 整改结果 | 验收边界 |
|---|---|---|
| A01 身份入口 | Live BFF 新增 Supabase Auth `/auth/v1/user` 验证、5 分钟服务器端不透明会话、Primary 主上下文查询；参考 provider 限 loopback。Terminal 非 mock 回调要求 BFF 地址并建立 cookie 会话。 | 只接入 session/context/auth 路由；其余页面路由和真实 OIDC 浏览器回放未验收。 |
| A02 Vault/Execution | 新的受控 SQL 函数返回 Vault 明文，Rust `ExecutionSecretStore` 在专用角色下调用；Execution 入口可校验角色连接。 | 实际交易命令入口尚未调用该 store，也无部署回执。 |
| A03 同租户关联 | 新 migration 补组合外键，查询加租户谓词；跨租户写入负向测试。 | 隔离库已执行。 |
| A04 主上下文模式 | 服务端由账户模式导出并校验选中账户，消除客户端传入 mode 的权威性。 | 正式 BFF 页面请求未全部迁移。 |
| A05 capability | Owner 只继承明列能力；SQL helper 强制账户/mode 范围。 | 本地单测及隔离库负向检查。 |
| A06 专用角色 | `quantos_bff`、`quantos_engine` 和 `quantos_execution_gateway` 权限分离；应用拒绝高权登录。 | 需实际部署专用 login 并跑服务。 |
| A07 双 secret 路径 | 撤销旧函数执行权，统一至会话、命令过期、rotation 和 revoke 约束的 Vault 函数。 | 平台管理 `service_role` 仍可读解密视图；用户明确允许该例外，但 BFF/Engine 严禁持有。 |
| A08 拒绝矩阵 | Vault Gate 覆盖 8/8 UI、用户、BFF、Engine SQL 拒绝及撤销/过期探针；RLS 增补实际身份负向测试。 | 正式 HTTP 入口的四类请求 100% 拒绝未取得回执。 |
| A09 性能 | 采样提高到 100 次，按拓扑执行硬阈值；增加查询索引。 | 当前库跨区域 P95 仍超标；无同区域目标。 |
| A10 状态治理 | 计划 review 为 `FIX_VALIDATION`，新增 `f06-acceptance-gate`，要求 ACCEPTED、无 OPEN、同 HEAD SHA 的目标回执及五项 PASS。 | Gate 当前按预期失败，不能被开发状态 `COMPLETED` 取代。 |

## 三、问题与风险

- **阻塞级 A01/A02**：尚无正式 OIDC 浏览器、全 BFF 路由和 Execution 交易命令到 Vault 的端到端证据；不得开放真实交易凭据。
- **中危 A08/A09**：SQL 角色负向矩阵有隔离库证据，但 HTTP 矩阵与同区域 P95 未取得；开发机跨区域 P95 未达标。
- **低危 A10**：已有独立准入 Gate；在回执缺失时明确失败。
- `service_role` 为 Supabase 平台管理例外，仅供受控运维；普通 BFF 与 Engine 的连接角色不能拥有该角色及 Vault 解密视图权限。

## 四、复验命令与整改建议

已通过：`cargo check -p bff-gateway -p quantos-auth -p execution-gateway --locked`、`cargo clippy -p quantos-auth -p quantos-policy -p bff-gateway -p execution-gateway --locked -- -D warnings`、相关 Rust 本地测试、Terminal 12 项定向测试、`node scripts/check-development-plans.mjs`、`node scripts/check-bff-generated.mjs`、`make rls-policy-test`（静态 37 表及远端检查）、`make f06-vault-check`（隔离库，8/8 SQL 拒绝）。`make f06-live-check` 在隔离库 **3/4 通过**，100 次鉴权读 `developer_remote` P95 为 **734ms**，未满足 `<500ms`；总耗时约 90.69 秒。此前同库采样分别为 724ms、733ms，增加索引后仍未达标。`make f06-acceptance-gate` 因缺回执按预期失败；不以未加载 `.env.local` 的直接 Cargo 测试计数据库验收。

`make db-replay-check` 通过：21 个 migration 在隔离 schema 创建 38 张基础表，随后事务回滚。

下一步依次完成：1. 将 live BFF 全部需要 F06 的页面操作接到服务器端会话与能力检查，并在真实 OIDC 测试身份下重放；2. 在 Execution Gateway 的实际交易提交路径中解析指定秘密，并部署独立受限登录；3. 在相同完整源提交上取得 HTTP 拒绝矩阵、同区域 P95 和当前远程 P95 回执；4. 达标后更新 review 与 `F06-target-acceptance-receipt.json`，运行 `make f06-acceptance-gate`。当前隔离库由用户确认可写可清理，且用户要求保留该库并记录 P95 未达标。
