# 7f7b4b44 五个 CI 工作流跟踪与第八轮修复（2026-10-19）

基线：`7f7b4b44b4e1507d36444032e00dfd4115b73252`。五个工作流均进入终态，4 成功、1 失败。本轮在 main 修复并生成本地提交，未推送。用户已有 AGENTS.md 未提交修改保留，未纳入本轮提交；前七轮报告及历史证据保留。

## 远程终态

| 工作流 | 同 SHA 运行 | 结果 |
|---|---|---|
| Frontend Baseline (FEP-0) | [39224061704](https://github.com/SumAlphaAI/QuantOS/actions/runs/39224061704) | SUCCESS |
| F01 Clean Room | [39224060972](https://github.com/SumAlphaAI/QuantOS/actions/runs/39224060972) | SUCCESS |
| QuantOS Compatibility | [39224060992](https://github.com/SumAlphaAI/QuantOS/actions/runs/39224060992) | SUCCESS |
| F08 Engine CI | [39224060667](https://github.com/SumAlphaAI/QuantOS/actions/runs/39224060667) | SUCCESS |
| QuantOS CI | [39224060546](https://github.com/SumAlphaAI/QuantOS/actions/runs/39224060546) | FAILURE；Rebuild isolated databases and test drift and RLS 步骤误报 bff_market_watchlist_commands.idempotency_key 缺少 UUID 默认值。 |

上一轮 rustls 修复已通过远程 SCA。主 CI 已通过此前的测试、覆盖率、许可证及 SCA 门禁，F02 数据库 receipt 保留 FAIL；已完成共享角色复用/不安全角色拒绝/事务 fixture 回滚，以及同库不同 URL 的自比较拒绝。数据库步骤失败后的 F05、F02 拒绝恢复、打包与下载验证仍未执行；verify-download 的失败是前置检查跳过后的连锁结果。

## 修复与约束

当前 live-rls 对非外键 UUID 主键要求数据库默认值，并对必须由业务提供的身份字段维护精确 table.column 集合。新行情迁移的命令键未登记，因而被误当作需随机生成的实体 ID。

`20261013090000_bff_market_pages.sql` 将该列定义为 UUID NOT NULL，并与 scope_key 组成主键。实际 BFF 写路径解析 Idempotency-Key 为 UUID，在同一 scope 内查重、校验 intent，再显式写入该 UUID；自动生成默认值会掩盖遗漏调用方 token 的错误。现有并发重试、冲突和审计单次追加测试验证了这一语义。

本轮只在 db-uuid-defaults.cjs 的精确集合中登记 `bff_market_watchlist_commands.idempotency_key`（9 项到 10 项），继续拒绝未知表、同表其他列、相邻表同名列，以及合法行与未知行混合的目录结果。迁移测试同步核对真实 SQL 的 NOT NULL、无随机默认值及 scope 复合主键。UUID 回归已接入 test-quality-gates.mjs，使主 CI 的质量自检在数据库步骤前执行该检查。

57 个 SQL 迁移及其原始摘要、业务 Rust 源码、数据库查询与 RLS 策略保持原样。本机未启动或连接数据库；新增测试读取 SQL 文本和真实失败目录行，不声称已完成 PostgreSQL 验收。

## 本地验证

| 检查 | 结果 |
|---|---|
| 新回归在旧策略下 | 预期 FAIL，复现同一 table.column 错误；保留原始日志 |
| 远程失败目录行复验 | 旧策略 FAIL、新策略 PASS，混入未知 UUID 列仍 REJECTED |
| UUID / 迁移回归 | 9/9 PASS，0 skip；含原始迁移摘要、角色适配边界、隔离 replay 文本校验 |
| 主 CI 质量自检实际入口 | 52/52 PASS，0 skip；含新 UUID 及既有 F01/F02、覆盖率正负向检查 |
| BFF watchlist 消费者回归 | 3/3 PASS，0 ignored；并发重试/冲突/CAS、单次审计、聚合事实去重；147 项无关库测试 filtered out |
| RLS 静态检查 | 59 张表 PASS；真实数据库执行单独待验证 |
| 脚本语法 / 开发计划 / diff 检查 | PASS |
| Gitleaks 8.28.0 | 历史 644 commits / 0 leaks；新增暂存补丁结果见证据 |

质量自检首次停在本机全局 pnpm 11.21.0 lint 命令，终止专属进程并清理本轮 lint fixture，保留 INTERRUPTED_NOT_PASS。改用项目固定 pnpm 10.20.0 后，3 项检查因沙箱禁止读取 uv 缓存而 FAIL；允许既有缓存访问后的最终入口为 52/52 PASS。以上尝试分别留档，不覆盖或计入通过结果。本轮未修改这些工具的实现或依赖锁。

## 证据与边界

[第八轮证据](evidence/ci-remediation-round8-20261019/)包含五工作流终态、失败作业详情及原始日志、提取的数据库 FAIL receipt、复现/修复回归、两次受环境影响的自检记录、最终成功日志、迁移摘要及 manifest.json。候选由所在 Git 提交标识，输入与证据绑定 SHA256；用户已有 AGENTS.md 修改仅作为执行上下文摘要记录，未被纳入候选。

本轮 Gate：`PASS_LOCAL_SCOPED`。新提交远程 CI 为 `NOT_RUN`（未推送）；完整 F02 PostgreSQL 门禁及其后续步骤、目标 Supabase、发布验收均未在本轮本地执行。推送后应继续核对新同 SHA 五工作流；7f7b4b44 的四项 SUCCESS 不改绑为新提交结果。
