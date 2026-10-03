# Binance 公共现货聚合成交：本次受控技术验证授权

- 日期：2026-10-03；版本：v1。
- 授权依据：项目用户在本次会话明确决定采用 Binance 公共现货行情，并指示“先完成 REST 聚合成交接入，再验证实时运行与断线补偿，完成后生成 Git 提交”。此记录保留真实用户授权，不是供应商颁发的许可。
- 范围：BTCUSDT/ETHUSDT 公共聚合成交；QuantOS 内部研发及本次真实数据链路验证，使用具名测试租户与 service actor，事实保留在已有 Supabase。无交易、提现、客户展示或再分发授权。
- 来源：[官方无需 API Key 的公共行情说明](https://developers.binance.com/en/docs/products/spot/faqs/market_data_only)，[聚合成交契约](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market)。
- 数据语义：aggregate trade，不冒充逐笔撮合记录；价格/聚合数量为原始十进制字符串，时间单位固定毫秒。
- 有效期：至 2026-10-10T00:00:00Z；到期或 disabled 阻止使用，扩大标的/用途需新版本授权。
- 许可边界：公开可访问与用户的技术验证授权不等于 Binance 书面商用/再分发许可。商用、展示、地区适用性及持续生产运行的条款审查仍未完成；此项不得写成已通过法务审查。
- 本次验证启动器生成的 actor 在退出后停用；需要持续运行时由运维指定稳定有效 actor、日志采集与监督进程。本记录不授权自动创建长期生产权限。
