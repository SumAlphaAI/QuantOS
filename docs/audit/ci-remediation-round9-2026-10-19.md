# 36fab92a 五个 CI 工作流跟踪与第九轮修复（2026-10-19）

基线：`36fab92aa235c41d83b03c64b37321fa242b44fb`。五个工作流均结束，4 成功、1 失败。本轮在 main 修复并生成本地提交，未推送。用户已有 AGENTS.md 修改保留并排除在本轮提交之外；前八轮证据保持原样。

## 远程终态

| 工作流 | 同 SHA 运行 | 结果 |
|---|---|---|
| Frontend Baseline (FEP-0) | [39235448918](https://github.com/SumAlphaAI/QuantOS/actions/runs/39235448918) | SUCCESS |
| F01 Clean Room | [39235449232](https://github.com/SumAlphaAI/QuantOS/actions/runs/39235449232) | SUCCESS |
| QuantOS Compatibility | [39235448978](https://github.com/SumAlphaAI/QuantOS/actions/runs/39235448978) | SUCCESS |
| F08 Engine CI | [39235448937](https://github.com/SumAlphaAI/QuantOS/actions/runs/39235448937) | SUCCESS |
| QuantOS CI | [39235448921](https://github.com/SumAlphaAI/QuantOS/actions/runs/39235448921) | FAILURE；F05 Storage PostgreSQL 测试连接错误：server does not support TLS。 |

上一轮完整 F02 数据库重建、漂移和 RLS 步骤已在远程通过。F05 的迁移重建、RLS 目录检查及 quantos-event 的 11 项数据库测试通过，含 1,000 次并发投递和 10,000-event 一致性。Storage 在 fixture setup 之后、PgStorageStore::connect 处失败，F05 receipt 仍为 FAIL。后续 F02 拒绝恢复、打包及下载验证均未执行；verify-download 拒绝是前置失败的连锁结果。这些远程结果仅绑定 36fab92a。

## 根因与修复

主 CI 使用不支持 TLS 的 PostgreSQL service，但 F02_PG_ADMIN_URL 未指定 sslmode。F05 runner 将该 URL 的数据库名替换为一次性数据库名，再传入两个 Rust 消费者。Event 对未指定模式的 loopback 有明文兼容行为；Storage 默认强制验证 TLS，因而前者通过、后者失败。nightly 的同类 fixture 已明确使用 sslmode=disable。

主 CI fixture URL 补齐 `?sslmode=disable`，与 nightly 一致；F02/F05 克隆出的 URL 均继承显式模式。实际 Supabase 目标、生产 Rust 连接实现和证书校验要求未修改。

同时修正 Storage 集成测试的旧矩阵：在已声明明文的 loopback fixture 上，仅显式 disable 可以连接；缺省、prefer、require 和 verify-full 均不得降级为明文。该矩阵原来只在 URL 含 disable 时执行，因此之前未触发，并错误地期待缺省/prefer 可以回退。现按现有 Storage 生产策略收紧预期；Event 自身的兼容语义保持原样。

在既有 F05 负向套件中新增配置消费者回归，解析主 CI 与 nightly 的 YAML，确认两者保留 F05 数据库步骤，并针对各自 PostgreSQL service 使用 loopback 和显式明文模式。该套件已由现有 make f05-check 调用，不新增旁路入口。

## 本地验证

| 检查 | 结果 |
|---|---|
| 配置回归在旧主 CI 下 | 预期 FAIL；null 与 disable 不匹配，原始日志保留 |
| F05 source Gate | PASS；只证明源码和门禁接线存在 |
| F05 负向及覆盖率/量化校验 | 8/8 PASS，0 skip；包括新工作流配置、lease fencing、append-only、tenant scope、虚假/低覆盖率拒绝、部分消费与错误计时拒绝 |
| Storage 库回归及集成测试编译 | 22/22 库测试 PASS，0 ignored，含 verify-full CA 配置拒绝；数据库集成测试 --no-run 编译 PASS |
| Rust 格式 / 脚本语法 / 开发计划 / diff | PASS |
| Gitleaks | 历史 645 commits / 0 leaks；新增暂存补丁结果见证据 |

未执行 make f05-db-check、make f05-db-coverage 或任何目标数据库测试；本机未安装、启动或连接 PostgreSQL/Supabase。数据库测试仅编译，不能记作数据库执行 PASS。本轮未重跑全仓、完整 clean room 或无关上游验收。

## 证据与边界

[第九轮证据](evidence/ci-remediation-round9-20261019/)包含五工作流终态、作业步骤状态、原始失败日志及提取的 F05 FAIL receipt、配置回归修复前后的结果、相关本地检查和输入摘要。候选由所在 Git 提交标识，manifest.json 绑定源码及证据 SHA256；用户已有 AGENTS.md 仅作为执行上下文摘要记录，不纳入提交。

本轮 Gate：`PASS_LOCAL_SCOPED`。新提交远程 CI 为 `NOT_RUN`（未推送）。完整 F05 PostgreSQL 门禁及后续检查需推送后验证；不将旧 SHA 的四项 SUCCESS 或本地静态/库结果提升为新同 SHA 数据库、部署或发布验收。
