# TP01-C 必要依赖闭包与 DEVELOPMENT 准入复评

> 本报告保留TP01-C冻结b1603bf的52组/13节点历史开发准入。 TP01-D源码变更后的最新16节点开发准入见[当前报告](./TP01-D-selective-absorption-2026-10-09.md)；下文当前字样以本报告原冻结范围为准。

2026-10-09，QuantOS。**52/52组实际检查通过，13个必要节点严格DEVELOPMENT READY；当前计划13 READY、146 NOT_ASSESSED、0 BLOCKED。** TP01-C工程交付及本轮必要依赖准入完成；正式ACCEPTED、发布、部署和候选同SHA hosted CI未授予。

冻结源码提交：`b1603bfbd760230e342f68990e402a98ab0642de`（`feat(tp01-c): implement research adapter skeleton and admission policy`）。进入评估前工作区干净；本轮后续dirty来自生成证据与阶段记录，前后功能输入摘要一致。实际命令从2026-10-09 11:00:50至12:06:08（Asia/Shanghai，末项开始时间）；完整命令、时间、退出码、日志及摘要见[52组执行记录](./evidence/provider-a1-remediation-20261004/tp01-c-admission-20261009/attempt-01/execution-results.json)。证据提交与源码提交分开；最终提交SHA在任务完成回复中报告，无推送或外部发布。

## 准入与依赖范围

必要闭包为F01–F09、TP01-A、TP01-B、CORE-GATE:F0及TP01-C，共13节点，全部递归严格校验通过。R01/R02不属于该闭包，当前保持NOT_ASSESSED；原执行与用户确认按其历史范围保留，不能自动迁移到新Engine输入。

| 当前回执 | 状态与范围 |
| --- | --- |
| [F08](./evidence/provider-a1-remediation-20261004/tp01-c-admission-20261009/attempt-01/core-f08.json) | READY；Engine功能、覆盖率及实际安装wheel/本地服务链 |
| [F0](./evidence/provider-a1-remediation-20261004/tp01-c-admission-20261009/attempt-01/core-gate-f0.json) | READY；必要基础闭包聚合 |
| [TP01-C统一manifest](./evidence/provider-a1-remediation-20261004/tp01-c-admission-20261009/attempt-01/core-tp01-c.json) | READY；当前源码/规范输入/实际命令/日志/支持artifact/依赖摘要绑定；formalAccepted=false |
| [TP01-C独立视图](./evidence/tp01-c-20261009/receipt.json) | engineeringStatus=PASS、status=READY；`--admit`后再严格验证统一回执与当前依赖 |

统一manifest内复制的TP01-C工程artifact记录执行时尚未发布依赖，所以其stage状态为BLOCKED。它只证明工程检查，独立工程验证跳过依赖时仅返回NOT_ASSESSED。最终准入以严格依赖绑定的统一manifest及更新后的独立视图为准；不改写复制artifact或历史BLOCKED事实。

[首次交付报告](./TP01-C-skeleton-2026-10-09.md)、[原始BLOCKED证据](./evidence/tp01-c-20261009/initial-blocked/receipt.json)、沙箱失败及原14节点回执保持归档。本轮没有失败检查组或重启评估，attempt-01完整通过；连接内部重试与恢复故障注入按原始日志保留。最终补充secret扫描首次因PATH未找到Gitleaks退出2；使用已有固定版`artifacts/tools/gitleaks`后423提交扫描无泄漏，失败及重跑结果均记入final-gates.log。

## 命令、测试与真实目标结果

| 入口/检查 | 实际结果 |
| --- | --- |
| `node scripts/provider-a1-receipts.mjs --assess-tp01-c docs/audit/evidence/provider-a1-remediation-20261004/tp01-c-admission-20261009/attempt-01` | 52/52，退出0；13节点正式发布DEVELOPMENT阶段回执 |
| F01三轮独立构建、F02迁移/secrets/license/SCA、协议/SDK/客户端及F04覆盖率 | 全部PASS；三轮制品摘要一致，固定Node24.12.0/pnpm10.20.0/Rust1.91.0/uv0.7.0 |
| F02/F05/Storage/RLS真实数据库与目标检查 | 已配置Supabase实际执行PASS；F05数据库8/8，8workers/1000次并发去重；10,000事件消费者收敛，最终持久事件集合、checkpoint、inbox/outbox计数核验 |
| F06目标七步骤 | build/preflight/auth-bff/auth-runtime/execution/vault/database全部PASS，数据库8/8，拥有的fixture清理PASS；[原始目标回执](./evidence/provider-a1-remediation-20261004/tp01-c-admission-20261009/attempt-01/f06-target.json) |
| F07恢复/覆盖率/服务 | 100任务OS-kill恢复与100唯一Artifact绑定PASS；恢复/覆盖诊断和配置开发服务链分别保留；P95为1337.73ms，仅诊断，不满足200ms性能目标 |
| `make f08-check` / `make f08-nightly-check` | Python263/263、Manager55/55，lint/type PASS；Python SDK/mock覆盖90.77%，Rust行/分支门禁及四项nightly负向PASS；既定豁免范围未扩大 |
| F08实际安装wheel与UDS服务链 | 五RPC/租户拒绝、三次监督崩溃、deadline、运行中取消、Artifact与观测9场景PASS；本地隔离进程诊断，非部署回执 |
| F09真实目标与功能负向 | 已配置Supabase9命令/6检查PASS，实际两次一分钟调度tick、缺采样fail-closed与数据库故障恢复；开发范围，不授予长稳/性能结论 |
| `node engines/vibe-adapter/check-development.mjs --record` | 7子检查PASS：Python263、Manager55、ruff、6文件format、pyright零错误/警告、离线lock52packages及计划；100组×双RPC边界拒绝/20回放/取消/deadline/幂等通过 |
| `node engines/vibe-adapter/check-development.mjs --admit` / `--verify` / `--ready` | 全部退出0，engineeringStatus=PASS、stageGate=READY、formalAccepted=false |
| `node --test scripts/provider-a1-receipts.test.mjs scripts/tp01-c-functional-artifacts.test.mjs` | 最终56/56；含新增10项工程artifact负向 |
| `node scripts/check-development-plans.mjs` / `pnpm test:development-plans` | 结构与依赖顺序PASS，38项计划负向PASS |

最终核验及只读变异探针见[final-gates.log](./evidence/provider-a1-remediation-20261004/tp01-c-admission-20261009/attempt-01/final-gates.log)：全部13回执内容校验、当前统计、源码/日志/依赖篡改拒绝、独立READY、56项receipt/artifact负向、38项计划负向、差异空白及secret扫描。没有启动本地PostgreSQL/Supabase/Docker、重建共享数据库、读取生产凭据或外部发布。

## 变更与未决风险

代码变更为adapter的allowlist/context/artifact_api/service/server五文件，以及新增Python边界/生命周期测试；文档为adapter README、开发计划及首次/本轮审计报告。门禁变更为adapter check-development、provider-a1-policy、provider-a1-receipts及新增tp01-c-functional-artifacts测试；验收证据在本报告链接的两个目录。原始报告与归档保留，当前报告仅列未决项。

- **持久服务待验：**mock Artifact及execution/owner/取消状态为进程内数据，不能证明重启后的持久恢复或生产容量；真实Artifact、可信snapshot/policy与部署HTTP/JWT留后续联调。
- **运行隔离待验：**本轮只有固定mock计划，无真实LLM/工具执行；OS egress隔离、持久授权与新用途许可仍需独立证据。
- **性能/发布待验：**F07诊断P95未达目标；代表性环境性能、长稳/canary/回滚、部署、同SHA hosted CI和正式用户确认不由当前工程Gate替代。
- **下一可执行任务：**独立刷新R01/R02当前DEVELOPMENT依赖与回执；严格READY后执行TP01-D选择性吸收与最小patch队列。TP01-D尚不具备完整准入，R1服务/集成Gate未完成。
