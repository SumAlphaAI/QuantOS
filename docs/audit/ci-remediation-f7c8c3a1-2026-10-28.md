# f7c8c3a1 CI 跟踪与修复（2026-10-28）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。远端基线 `f7c8c3a1ebaa7491e0c04644c8b5055c843063b3`；在 main 本地修复和提交，不推送。新提交 hosted CI、真实数据库权限及发布验收保留 NOT_RUN。

## 远端终态

该 SHA 的8个 push 工作流均结束：7成功，仅[QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40614118894)失败。F01、Frontend Baseline、F03、F08、F09、R01、Compatibility 成功。查询时无该 SHA 的 schedule 或 F05/F07 运行。

主 CI 的 BFF provider、workspace tests、Python/TypeScript/Rust coverage、SCA waivers 及 SCA checks 均成功，上轮启动预算修复已在远端继续通过。失败点为 `Rebuild isolated databases and test drift and RLS`，原错误为 `Only the scoped Vault function may be executable by quantos_execution_gateway.`。数据库回执完成了 shared-role 和同库别名拒绝，随后在 live-rls 失败。verify-download 传播上游未完成，保留；后续 F02 检查/打包/下载未运行，不记 PASS。

## 原因与修复

`20261027090000_l02_bound_execution_zone.sql` 已撤销四个历史解密入口的全部应用权限，仅授权 execution gateway 调用 `resolve_execution_zone_secret(text,text,timestamptz,uuid,text,bigint)`。新入口绑定 account、peer fingerprint、credential version、TTL 和 drain window，实际 Rust 调用方 `quantos-auth::resolve_for_zone` 已使用它。

`scripts/db-cli.cjs` 的 live-rls 仍要求 gateway 能执行旧的四参数 `resolve_execution_vault_secret`，与当前迁移冲突；此检查未查询新的 L02 入口。这是检查器与当前权限合同不同步，不能通过恢复旧权限解决。

修复 live-rls 的权限矩阵：

- 四个历史入口对 authenticated、anon、service_role、execution gateway 均须不可执行。
- 新 L02 入口仅 execution gateway 须可执行；其余三类角色必须拒绝。
- generic service_role 不得 SELECT 历史 secret table 的检查保留。
- 目录必须返回唯一且完整的21个 boolean 字段；缺失、null、字符串或多行结果直接拒绝。

导出同一 liveRlsCheck 并允许测试注入连接回调；CLI 默认仍使用原 withClient，不增加环境旁路、旧版本 fallback 或新的执行模式。只查询有效权限目录，不执行解密函数。原 RLS/FORCE/policy、UUID default、timestamp 及写入策略检查保留。未改历史迁移、角色授权、数据库或 Rust 业务实现。

新增离线 catalog-contract 拒绝测试，并接入现有 `make db-migration-check`，在 CI 数据库阶段前发现此类检查器漂移。测试使用同一生产检查函数及实际查询参数，验证4角色×5签名、所有历史入口拒绝、新入口非授权角色拒绝、缺失新授权、目录缺损及前置表检查拒绝。fixture 的查询断言错误不能冒充业务拒绝。

## 本地验证

| 检查 | 结果 |
|---|---|
| 旧检查器接入最小可测试回调后运行新增合同测试 | 24 PASS、7 FAIL；原输出保留，属于离线查询合同失败，不是 PostgreSQL 重现 |
| 新权限合同测试 | 31 PASS、0 skip |
| `QUANTOS_SKIP_ENV=1 make db-migration-check` | 38 PASS、0 skip；迁移文件名有效，60表 RLS 静态预检 PASS |
| UUID default / migration-role / F05-F07 manual policy 回归 | 9 PASS、1 SKIP；跳过项为需显式授权目标 PostgreSQL 的 shared-role 执行测试，不记数据库通过 |
| `node scripts/test-quality-gates.mjs` | 补齐 CI 工具环境后58 PASS、0 skip |
| Node syntax / `git diff --check` / 历史凭据扫描 | PASS，扫描规则及豁免未改变 |

首次 quality-gate 本地运行因 uv 用户缓存被沙箱拒绝、未设置 Gitleaks 路径而失败。原记录保留；指定既有工具绝对路径并允许访问 uv 缓存后原入口通过，没有修改拒绝测试或以工具报错换取通过。

本轮没有启动本机 PostgreSQL、容器或 Supabase，也未读取 .env.local 或连接真实 Supabase。完整 `make f02-db-check` 依赖 GitHub runner 的一次性 loopback PostgreSQL，本机未运行；离线测试不证明 SQL 实际执行、RLS 或部署权限生效。需要用户推送后由同 SHA CI 重新执行该阶段。未扩展到无关全仓测试、完整 F01 重建或发布矩阵。

F05/F07 仍只允许 workflow_dispatch、显式确认及 QUANTOS_MANUAL_F05_F07=1 执行完整数据库/覆盖率 campaign，手工策略检查通过；本轮 campaign 为 NOT_RUN。未修改 secrets、推送或部署。

## 证据

[归档目录](evidence/ci-f7c8c3a1-20261028) 保存同 SHA 工作流和 job 终态、原失败日志、离线合同前后结果、相关回归、质量门禁原失败及通过记录、源码绑定。gzip 无损保留原始字节，SHA256SUMS 绑定归档；历史证据不改绑。
