# R01 原十项问题关闭复核台账

复核日期：2026-10-07。代码基线 `68924e1`（完整 SHA 及文件摘要见[证据索引](./evidence/r01-closure-recheck-20261007/index.json)）。本台账逐项复核 2026-10-02 的 B01、H01–H04、M01–M04、L01；不把新鲜度专项的 FA-H01 算成原 H01，也不扩大原十项分母。

[初审原文](./R01-initial-review-2026-10-02.md)按字节完整保存，[归档回执](./evidence/r01-closure-recheck-20261007/initial-report-archive.json)记录 SHA256。原文中的 `docs/R01-summary.md` 已迁至 [docs/execution/R01-summary.md](../execution/R01-summary.md)，其他初审数字、失败探针和历史结论不改写。当前结论见[主报告](./R01-comprehensive-review-2026-10-02.md)。

## 逐项复核

下表的 CLOSED 表示原缺陷已修复且有对应行为证据，不表示 R01 正式验收、当前 DEVELOPMENT 准入或发布就绪。代码路径均相对仓库根目录。

| ID / 原级别 | 所属模块、原具体表现与影响 | 当前实现与验证依据 | 结论 |
|---|---|---|---|
| B01 / 阻塞 | market-ingestor / 持久化：只有 replay、进程内状态；退出丢事实、无法跨进程补偿 | `services/market-ingestor/src/{main,binance}.rs`、`quantos-market/src/durable.rs` 接入原子 receipt/event/audit/outbox、Binance 页游标、监督和 F05 恢复；当前目标功能测试及历史真实两标的窗口已证明这些功能。部署/父进程与主机死亡通知、长期运行、候选同 SHA CI、适用用途许可和实际新鲜度仍未完整验收 | **PARTIAL / OPEN**，实现缺口已补齐，完整验收欠项移交 R01/F09/L04 与 RELEASE-GATE:BETA；不以此自动阻塞所有研发 |
| H01 / 高危 | market / ledger：append 前发布去重及序号；失败重试误判 duplicate，丢数据 | `ingest_batch` 同时暂存 ingestor/ledger，全部 append 成功后发布；`append_market_source` 在同一 SQL 语句提交 receipt、序号、事件、audit/outbox。`failed_batch_does_not_publish_partial_ledger_or_identity`、真实 Supabase 外键失败后重试及八写者竞争通过；破坏原子性编译 mutant 被行为测试拒绝 | **CLOSED** |
| H02 / 高危 | market / source identity：缺 tenant、内容 hash、非空约束；跨租户压掉数据、同 ID 改价静默丢失 | 领域键和 SQL 唯一键包含 tenant/provider/ID，hash 排除投递时间但覆盖源事实；空/保留 ID 拒绝，同 ID 异内容冲突。`identity_is_tenant_scoped_and_conflicting_content_is_rejected`、目标重启/冲突/越租户、CLI 隔离恢复及冲突编译 mutant 通过 | **CLOSED** |
| H03 / 高危 | market / symbol：删除分隔符导致币对碰撞，多段符号被接受；可能污染研究输入 | v2 `BASE/QUOTE` 与显式 provider instrument map；`AB/C != A/BC`、多段/未知别名拒绝、不同 provider stream 分离；`instrument_identity_is_unambiguous_and_venue_scoped` 通过，ADR 与 v2 迁移存在 | **CLOSED** |
| H04 / 高危 | market / 质量与 CLI：负数/不可解析数值直接中止，无质量事实，后续 tick 丢失 | nullable typed value + bounded raw value 产生 Failed/QualityFailed；不可解析帧走 hash 隔离，后续有效 tick 可继续。`invalid_numeric_ticks_emit_quality_with_raw_values_and_continue` 覆盖负值、非数值、超精度、零值和恢复；目标 CLI 验证隔离与回放 | **CLOSED** |
| M01 / 中危 | market / watchdog：只比较输入时间，无 processing clock/无 tick 检测；函数耗时冒充端到端时限 | live 使用实际 processing clock；持久 watchdog、原生与监督 ACK 记录、空响应 transport health、真实 cursor 恢复已接入。当前时钟/ACK/采样负向和目标 watchdog 通过；历史受控故障 16 项、自然窗口精确 ACK 另有证据。原检测能力缺口关闭，实际新鲜度风险由 FA-H01 保留，不能从本项关闭推出全环境 ≤5s | **CLOSED** |
| M02 / 中危 | provider registry：空元数据、重复 provider、非法 SLA、无撤销/到期治理；批准边界不明确 | 构造返回 Result，校验 metadata/alias/SLA/重复项；enabled/expiry 每次使用检查，live 拒绝 fixture；版本/引用与受控审批文件、原 scope 存在。`provider_configuration_fails_closed_and_supports_revocation`、监督 scope/expiry/revocation 负向通过；配置有效性不代替商用许可证 | **CLOSED** |
| M03 / 中危 | Gate / CI：字符串检查掩盖缺陷、CLI 无测试、覆盖范围不完整 | 本轮 46 Node、13 market、5 native unit 与 CLI 行为检查通过，两项真实编译 mutant 被拒绝；配置的 Supabase 单独执行原子/恢复测试。四个关键生产文件覆盖 Gate、缺测/低阈值负向、stable/nightly CI 配置存在；历史覆盖原件复算通过。assembly PASS 不代替 stage_gate 或远程候选 CI | **CLOSED** |
| M04 / 中危 | replay / parser：空 symbols panic，整文件/去重状态无界；可能崩溃或资源耗尽 | spec/count/date/symbol 校验，100,000 条上限、16KiB frame（含空白）、有界流式解析；durable 不保留全历史内存身份表。`replay_and_parser_are_bounded_and_invalid_specs_return_errors`、CLI 大输入拒绝通过；不宣称做过 OOM 压测 | **CLOSED** |
| L01 / 低危 | README / 摘要：缺必需 trace 配置，内存与 durable、质量处理表述混淆；命令不可直接使用 | README 已提供 trace exporter 并明确 replay 为内存验证；本轮同步过时摘要、报告入口与独立证据目录示例。CLI 成功/配置拒绝、文档链接与计划检查通过；历史命令仍作为当时事实保存 | **CLOSED** |

## 证据与边界

- 当前行为：[本地 Gate](./evidence/r01-closure-recheck-20261007/logs/r01-check-authorized.log)、[目标 Supabase 回执](./evidence/r01-closure-recheck-20261007/target-functional/target-receipt.json)、[actor 停用读回](./evidence/r01-closure-recheck-20261007/target-functional/actor-cleanup.json)。本地套件内未启用数据库的用例返回不计为数据库 PASS；目标 runner 显式启用并记录独立结果。
- 历史工程依据：[首次整改](./R01-remediation-validation-2026-10-02.md)、[Binance 接入](./R01-binance-rest-validation-2026-10-03.md)、[监督与补偿](./R01-supervision-validation-2026-10-03.md)、[新鲜度专项整改](./R01-freshness-remediation-2026-10-04.md)。不改历史源码 SHA，不把过往故障/缺测改成通过。
- 历史证据完整性：[复核结果](./evidence/r01-closure-recheck-20261007/historical-integrity.json)验证专项索引 412 个文件全部匹配，最终窗口离线重算与归档 JSON 全等。33 个历史源码绑定中 28 个仍匹配，锁文件、Makefile、package 清单和 supervision 验证器共 5 个已变化；运行域核心文件未变，但历史依赖/环境/整套覆盖不冒充本次重新执行。
- 覆盖复核仅重算历史 stable/nightly 原件：四个关键生产文件 line≥90%、region≥85%，nightly branch≥85%。本轮没有重新采集 coverage，没有复跑真实 provider、扩大窗口、部署或远程 CI。
- 开发记录仍 `COMPLETED`；正式复审仍 `FIX_VALIDATION`；阶段记录仍 `DEVELOPMENT / NOT_ASSESSED`。功能证据不自动替代前置阶段 READY、准入输入摘要或项目用户正式确认。

## 文档修复

本轮没有发现需新增业务代码修复的原十项缺陷回归。修复的是当前文档仍展示全部 OPEN、交付摘要落后于最终专项结果，以及 Runbook 三次目标命令复用非空默认目录的可执行性问题。主报告只列 B01 与明确区分的专项 FA-H01；初审原文和所有失败证据保留。9/10=90% 是原问题关闭率，不能替换初审 24 个检查点、工作量或正式验收完成率。
