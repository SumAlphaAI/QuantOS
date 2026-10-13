# BFF-FE-005 市场页面 API

实现 7 个 C12 operation：getMarketCatalog、getWatchlist、saveWatchlist、getVenueQuotes、getCandleSeries、subscribeQuotes、subscribeCandles。OpenAPI 1.7.0 共 70 operation / 62 schema，同源生成 client、Zod、JSON Schema、MSW 和 Rust 输入策略。C16 告警仍归 BFF-FE-010。

报价使用 R01 许可 top-of-book 事件的真实 bid/ask，Decimal 精确计算 mid；缺盘口时明确 priceKind=last_trade、bid/ask/mid 为空，以真实成交价回退。盘口历史精确去重，来源身份或序列冲突拒绝；报价流序列取盘口/成交的最大已验证序列，成交更新不漏发，组合质量不提升降级成交。executable=false；费用/滑点缺真实估算来源时为空，禁止由成交价伪造盘口。spot、两 venue、七种固定 interval 和 UTC/Asia/Shanghai 为显式能力，未知组合拒绝。OHLCV 使用 Decimal，排序去重、同源冲突拒绝、显式 gaps/eventMarkers；恢复整段替换，不插值、不拼接。客户端 MarketSeriesRecovery 绑定所有维度及权限范围；断流定格、重置回补、撤权清空。

live 模式只接受受信会话的 market.read；watchlist 写额外需要 market.watchlist.write 且不能是 Viewer。QUANTOS_BFF_MARKET_CATALOG 是服务器维护的有界 tenant/instrument/snapshot 引用；每次读取和流轮询均通过 R02 load_authorized_snapshot、来源用途许可与 R01 不可变 lineage 逐事件验证。使用既有 QUANTOS_BFF_SNAPSHOT_DATABASE_URL / QUANTOS_BFF_RESEARCH_SOURCE_POLICY；没有 fixture fallback。

watchlist 的完整 tenant/actor/workspace/account/mode 范围、幂等键/意图、If-Match 和审计在一个 PostgreSQL 事务提交，冲突无副作用；新增迁移尚未应用。流重新验证会话和授权，64 个连接信号量、每 scope/operation quota 和最大 10000 source events / 500 candles 防止无界读取。

BFF005_LOCAL 完整功能闭包为 40 节点。A3_EXECUTION 仅执行两个 A3 consumer 的并集（42 节点），从同源码、同次实际检查派生 A2_LOCAL/R1_LOCAL/BFF003_LOCAL/BFF005_LOCAL 四份独立回执；不会发布 PROVIDER:A3 READY。旧回执原件保留。入口 `make bff005-local-check` / `node scripts/bff-fe-005-development.mjs`；完整运行 `make research-local-assess ATTEMPT=docs/audit/evidence/provider-a1-remediation-20261004/research-local-20261013/attempt-NN`。

DEVELOPMENT 只验本机真实 Rust/R01/HTTP/生成 client/Chromium 的受控数据功能，不代表真实数据源、Supabase 迁移/RLS/事务、IdP、持久重启、多实例、性能/容量/长稳、同 SHA CI 或正式 ACCEPTED。上述外部与性能全部移交 RELEASE-GATE:BETA，未执行 NOT_RUN，原阈值保留；formalAccepted=false。不使用生产凭据，不部署或发布。
