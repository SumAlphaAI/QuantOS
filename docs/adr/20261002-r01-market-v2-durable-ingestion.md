# ADR：R01 MarketEvent v2 与可靠摄取

- 状态：Accepted（本仓库技术决策；不代表数据供应商许可批准或服务验收）。
- 日期：2026-10-02。
- 依据：[R01 初审](../audit/R01-comprehensive-review-2026-10-02.md)。

## 决策

1. 真实摄取只通过 `DurableMarketIngestor`。Supabase PostgreSQL 为来源身份、事件与 outbox 的唯一事实来源；F05 管理 inbox、租约、重试、死信和消费者 checkpoint。来源回执、连续序号、全部 MarketEvent、审计及 outbox 由单个 SQL 函数调用原子提交。事件失败不确认来源；重试不会被尚未提交的去重键吞掉。
2. 去重域为 `(tenant_id, provider, source_tick_id)`。相同源 ID、相同原始事实 hash 为重复；内容改变为冲突，不能静默覆盖。hash 包含 provider、ID、provider symbol、event_time、原始 price/volume，排除 received_at；价格文本或 alias 改变也算冲突，不假定是获准更正。更正必须由供应商给新 ID/修订事件。
3. 源 ID 必须非空且 ≤256 bytes；`watchdog:`/`rejected:` 为服务保留命名空间。回执不可 UPDATE/DELETE/TRUNCATE；历史事实与授权运营保留策略分开。开发测试事实同样保留，结束时停用测试服务 actor。
4. MarketEvent schema 升至 `v2`。symbol 为 `BASE/QUOTE`，按 provider 的显式 instrument map 查找；aggregate_id 为 `provider:BASE/QUOTE`。不靠删除分隔符猜测标的，不跨 provider 合并事实流。已有 v1 事件保持原样，消费者按 schema_version 分派；禁止把 v1 内容重标为 v2。
5. v2 price/volume 为可空 decimal quantity。不可解析、负数、零、超精度的原始数值作为安全有界 `raw_price/raw_volume` 保留，产生 Failed 与 QualityFailed，不用伪造零值冒充合法数值。原始不符合身份/JSON 契约的 frame 以 hash 与 reason 隔离，原文不进入错误日志。异常 causation_id 指向原 tick 事件。
6. 实时模式注入 processing clock，detected_at/occurred_at 表示实际检测时间；源 event_time/received_at 单独保留。replay 使用固定接收时间，必须显式标记 fixture，不能用历史时间证明真实延迟。持久 watchdog 从真实 tick 回执提交时间恢复，断流异常的稳定身份保证重启后不会重复发出同一状态事件。
7. 批准配置须包含 provider、dataset、license_label、approval_reference/version、expires_at、enabled、合法 SLA/skew 和标的 map。重复/空/非法配置拒绝，过期/撤销 provider 拒绝。默认批准是 `fixture:` 专用；live 路径拒绝它。轮询每轮重新加载配置，撤销在下一轮生效。
8. HTTPS JSONL adapter 为受控 provider adapter 的摄取契约，不假定它等于某个交易所的原生 REST API。endpoint 必须支持至少一次完整重发；服务不以无持久确认的网络游标跳过事实。source receipt 负责幂等恢复。HTTP 回环地址只允许显式 fixture 模式；禁止重定向和 URL userinfo。真实供应商 adapter/审批材料仍须独立配置验收。

## 边界与兼容

- `ingest-replay`/`MarketIngestor` 是有界内存验证器，不提供持久化承诺。其 batch 在成功前同时暂存 ledger 与 identity，失败不发布部分状态。
- `ingest-source`/`poll-source` 使用配置的稳定 tenant、已启用 service actor、数据库角色，不自动创建租户或授予权限。
- JSONL 单行 ≤16KiB，单次 ≤100,000 条；批准文件 ≤1MiB；轮询次数 1–1000。资源超限返回确定性拒绝，运维拆批后重试。单次 SQL 写 statement timeout 4s、锁等待 2s；异常 ≤5s 的验收使用真实测量，不由 timeout 配置替代。
- `dispatch` 只领取显式 tenant 的 market aggregate，完成市场事件事实的 inbox/checkpoint；不会更新行情 UI 或执行交易。下游投影属于相应后续任务。
- 向前 migration：来源回执表、原子函数、不可变触发器。不删除或改写旧 MarketEvent。回滚先停止新摄取并保留账本/回执；不回退到会重复写入的 v1 临时消费者。

## 测试与覆盖口径

实际编译的 source-conflict/failed-append mutants 必须被行为测试拒绝。稳定版对 market lib、durable、CLI 手写 main 逐文件要求 line ≥90%、region ≥85%；nightly 同文件 branch ≥85%。`src/tests.rs`/integration tests 不计产品覆盖；`services/market-ingestor/src/cli.rs` 仅包含 clap derive 的参数声明，作为 COV-R01-01 框架生成代码豁免，参数成功与拒绝仍由真实 binary 测试。该文件禁止加入手写 fn/impl，加入后必须扩大覆盖统计范围。主 CI 不把缺少凭据的目标测试计为 PASS；独立工作流对 Supabase 执行，不建立本机 PostgreSQL。
