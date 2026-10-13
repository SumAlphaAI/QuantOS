# BFF-FE-005 实现与本地 DEVELOPMENT 验收

2026-10-13。实现当前前端计划 A3 的 C12 七个市场操作；C16 告警归 BFF-FE-010。正式确认未执行，formalAccepted=false。未使用生产凭据、未连接数据库、未运行数据库/容器、未推送或发布。

## 交付与范围

- Rust reference/live 路由：instrument catalog、scoped watchlist GET/PUT、跨 venue 报价、K 线历史、报价流、K 线流；完整 session/capability/CSRF/请求及连接配额。
- R01 增加许可原始 top-of-book 归一化与不可变记录类型，真实 bid/ask、Decimal mid；没有盘口时明确 last_trade，盘口字段 null。所有报价 executable=false；缺费用/滑点估算来源保持 null。
- R02 受权 snapshot + tenant/provider/symbol/usage/license/window/quality 验证；live 只从服务器 catalog 引用和不可变 lineage 取数据，无 fixture fallback。受控本机数据是真实 R01/R02 模块组合，未冒充真实 venue 或目标数据库验收。
- OHLCV 使用 Decimal、排序去重/冲突拒绝、时区与周边界、显式 gaps/markers；恢复提供完整 replaceSeries。盘口/成交序列共同推进报价，降级成交不提升组合质量。
- watchlist 全范围幂等、意图冲突与 If-Match/CAS；live 的持久数据/命令/审计使用同一事务、强制 RLS 迁移候选。迁移未应用；该路径仅编译/静态检查，持久目标结果 NOT_RUN。
- MarketSeriesRecovery 绑定 authority 与全部维度，整段替换、忽略重复/迟到、reset 丢弃 cursor 保留定格图、permission revoke 清空。上层调用方使用此恢复器及 URL/cursor 完成连接管理；consumer/UI 集成归 I 迭代。
- OpenAPI 1.7.0 / 70 operation / 62 schema；生成 TS/Zod/JSON Schema/MSW/Rust 输入策略，PRE01/PRE04 库存及 fixture manifest 同步。

## Gate 与证据

冻结功能源码：ac4a8dc4f35220e203b0db6cc128843235332824。完整独立执行：docs/audit/evidence/provider-a1-remediation-20261004/research-local-20261013/attempt-05；139/139 组 PASS。四份消费者回执从同源同次真实执行派生，非重复相加：

| 消费者 | DEVELOPMENT Gate | 必要节点 | 检查组 | 发布检查 |
|---|---|---|---|---|
| PROVIDER:A2 | READY / A2_LOCAL | 17 | 67 | 10 组 NOT_RUN |
| CORE-GATE:R1-SERVICE | READY / R1_LOCAL | 27 | 85 | 19 组 NOT_RUN |
| FE:BFF-FE-003 | READY / BFF003_LOCAL | 40 | 135 | 22 组 NOT_RUN |
| FE:BFF-FE-005 | READY / BFF005_LOCAL | 40 | 135 | 21 组 NOT_RUN |

A3_EXECUTION 为 42 节点执行并集，不发布 PROVIDER:A3 READY。全图 4 READY / 155 NOT_ASSESSED / 0 BLOCKED；上游独立 Gate 不自动升级。两计划中 BFF005 development_status=COMPLETED 仅指功能工程交付，不代表正式 ACCEPTED。

完整命令、时间、退出码、日志与产物摘要见[执行清单](./evidence/provider-a1-remediation-20261004/research-local-20261013/attempt-05/execution-results.json)与[证据索引](./evidence/research-local-20261013/evidence-index.json)。[前置复评](./evidence/research-local-20261013/reassessment.json)、[四份原子发布](./evidence/research-local-20261013/publication.json)、[源码绑定](./evidence/research-local-20261013/source-binding.json)、[篡改探针](./evidence/research-local-20261013/tamper-probes.json)、[历史完整性](./evidence/research-local-20261013/historical-evidence-integrity.json)、[后置检查](./evidence/research-local-20261013/postchecks.json)可独立复核。

## 测试与复验

冻结后完整命令（须使用全新目录）：

```sh
PATH=/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:$PATH \
node scripts/record-research-local.mjs \
  docs/audit/evidence/provider-a1-remediation-20261004/research-local-20261013/attempt-05
```

| 命令 | 实际结果 |
|---|---|
| 完整聚合执行 | 139 组 PASS，三次独立构建摘要一致 |
| `make lint` / `make test` | Rust 385 PASS / 7 ignored；Python 1390 PASS；Web 233 PASS / 3 skipped，lint PASS |
| `cargo test --locked --offline -p bff-gateway --lib market:: -- --nocapture` | 14 项 PASS，含 R01/R02 真实模块组合与盘口/成交序列恢复 |
| `node scripts/test-bff-fe-005.mjs` | 7 operation / 33 实际请求、Chromium 两 venue 切换及非可执行语义 PASS；成功/拒绝响应逐条独立 schema 检查 |
| `pnpm exec vitest run tests/contract/bff-market.test.ts packages/api-client/tests/market-recovery.test.ts` | 7 项 PASS |
| `node --test scripts/bff-fe-005-development.test.mjs` | 16 项证据/权限/恢复及公开 CLI 检查 PASS；临时合成 verifier fixture 非 provider 证据 |
| `make research-local-check` | 42 项 Gate 测试及四份完整递归回执 PASS |
| `node scripts/reassess-a3-prerequisites.mjs` | 四 root 均 LOCAL_READY |
| `node scripts/provider-a2-development.mjs --target` | 预期 exit 1，严格拒绝本地回执冒充目标；只读校验，无目标执行 |
| OpenAPI/generated/coverage/compatibility、PRE01/PRE04、BFF007、typecheck/Clippy | PASS，精确命令见执行清单 |
| 计划/后续 Gate 移交检查 | 64 任务 / 16 检查点，外部/性能早期 Gate 均 0 |
| 源码/日志/产物/依赖 manifest 篡改 | 4 类 REJECTED，逐字恢复后四 Gate 再通过 |
| Gitleaks/格式/链接/证据哈希 | PASS，公开 OpenAPI 摘要仅精确值例外，秘密 canary 拒绝能力保留 |

Rust 7 ignored / Web 3 skipped 代表明确未执行或另有专项覆盖，不能计为数据库/性能/consumer 验收。当前文档交付提交不声明已有同 SHA 托管 CI；功能摘要和规范范围独立绑定冻结源码。

## 诊断与关闭

[冻结前预检](./evidence/bff-fe-005-20261013/preflight/README.md)与[失败关闭映射](./evidence/research-local-20261013/failure-closure.json)保留原始事实。首轮 PRE01 四个负例仍替换旧 1.6.0，未实际触发篡改；改为从 OpenAPI 动态读取当前版本（1.7.0）。PRE04 正向库存的字段数量断言由旧 416 同步至实际 459；字段遗漏、类型/权限/库存篡改的拒绝断言保留。PRE06 库存、A1 schema 引用解析、A2 当前库存及 RELEASE 移交机器清单同步更新；TP01-C 的计划失败同源关闭。引用 schema 的未知字段负例和盘口身份/序列冲突负例保留。上述修正在新候选全闭包执行。报价新成交恢复回归在旧逻辑失败、修复后通过，原日志保留；没有拼接首轮 PASS。第二轮仅完成 5 组后因发现来源撤权需清屏而主动中断，保留原件且不用于准入；第三轮 139 组 PASS，但计划校验器的旧路径及缺 BFF005 登记导致原子发布回滚；同步策略和两计划，并新增真实计划校验器的发布闭环测试后，第四轮完整 139 组及原子发布 PASS，但公开 CLI 顶层 await 循环 exit 13；拆分纯证据模块、补齐真实 CLI 子进程回归，撤回受影响 READY 后，第五轮从头执行全闭包，并再次实际通过公开 CLI 后置检查。旧逻辑回归先进行的全文件替换因缺少新 helper 编译失败，仅作诊断；随后隔离旧序列逻辑的实际测试失败才作为有效回归证据。

篡改探针初次误选原执行日志而非消费者实际绑定的派生日志，接受结果不能用于判断消费者日志完整性；原字节已恢复，改为直接从消费者 functional manifest 选择日志/产物后复验，初次诊断保留。

本轮公开摘要豁免不涉及目录、字段或规则，独立重算当前 OpenAPI SHA256，秘密负向测试仍通过。pnpm 使用已缓存固定 10.20.0，检查环境离线且剥离凭据及目标数据库开关。

## 未决风险与下一任务

真实 Supabase 迁移/RLS/事务、Auth/session 撤权、跨实例与持久重启、真实盘口/成交摄取及用途许可、外部 Engine、完整浏览器矩阵、远程漏洞库 SCA/fork 治理、候选同 SHA CI、性能/容量/长稳均 NOT_RUN，统一由 RELEASE-GATE:BETA 首次上线前实际验收；原阈值和权限要求保留，不作为本地开发阻塞。进程内配额及信号量不代表集群限额。

当前 market live 实现须配置 server catalog、合法 snapshot 及既有 source policy；缺配置或不受权即拒绝，不能依赖 reference 数据上线。R01 book 记录类型和本机归一化已经交付，真实外部 producer 持续写入及租户 policy 的部署仍归 RELEASE。consumer/UI 的连接循环与页面交互按 I 迭代验证。Engine 版本 provenance 未报告时沿用 unreported 边界。

下一可执行任务：PROVIDER:A3 聚合开发验收，消费当前 BFF003/BFF005/A2 的完整功能回执；不得将本次 A3_EXECUTION 并集直接当作该检查点的已发布 READY 或正式用户签署。

## 变更文件与 Git

[完整变更清单](./evidence/research-local-20261013/changed-files.txt)以 4f73e815 为基线；[代码与文档清单](./evidence/research-local-20261013/changed-source-files.txt)排除原始验收证据。

主要新增：R01 book.rs、BFF market.rs/market_tests.rs/live/market.rs、api-client market.ts/恢复测试、C12 契约测试及 fixtures、20261013090000_bff_market_pages.sql、市场 HTTP/证据验证脚本及负例、BFF-FE-005-summary.md。本轮同时更新 BFF 路由和依赖、六份生成物、PRE01/PRE04、四消费者 Gate 策略/执行器/复评器/Makefile 及两计划。

本地提交：0614ae64（实现/预检）、1e1728b7（恢复游标/组合质量/版本负例修正及首轮原件）、3f43bd50（来源撤权清屏及中断原件）、e3af9ed8（发布登记闭环修复及第三轮原件）、ac4a8dc4（公开 CLI 模块边界修复及第四轮原件）；最终成功证据与文档另作本地提交，SHA 在交付消息报告。没有 push 或发布。
