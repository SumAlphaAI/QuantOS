# Binance 公共行情：30 分钟扩大窗口内部评估授权

日期：2026-10-04；版本 `v2-window-30m`。本记录新增本轮范围，保留 [2026-10-03 v1](./20261003-binance-public-evaluation.md) 历史记录。

授权依据为项目用户在当前会话的直接指令：“继续执行：扩大运行窗口，明确授权范围，生成独立 Git 提交”，并确认“30 分钟（建议，完成后提交）”。这是工程内部技术评估授权，不是 Binance 颁发的商用许可证或法务审查结论。

| 项目 | 本轮范围 |
|---|---|
| 来源与接口 | Binance 官方公共现货 `https://data-api.binance.vision/`，只请求 `/api/v3/aggTrades`，无需 API Key |
| 标的与语义 | BTCUSDT、ETHUSDT 聚合成交；保留原十进制字符串和毫秒时间，不冒充逐笔撮合记录 |
| 用途与环境 | 本工程前台监督程序、有界内部研究/工程验证，直接连接原配置 Supabase 事务池；创建具名测试 tenant/service actor |
| 单次运行 | supervisor 正常运行窗口 1800 秒（30 分钟），连接/构建准备和 ≤30 秒停机宽限另记，不并入运行窗口；15 秒采样 |
| 数据边界 | 允许写 market receipt/event/audit/outbox、F05 消费/checkpoint 和运行状态证据；不可变事实保留在现有 Supabase，不重建数据库 |
| 权限边界 | 不授予交易、提现、客户展示、再分发、商用或长期生产权限，不改 credentials/数据库池容量，不注册常驻系统服务 |
| 资源与停止 | 两标的、每个 worker poll 至少 1000ms；来源 tick 200000 / event 500000 为停止护栏，15 秒采样期间有在途页（最多每标的 1000 tick），不是 SQL 配额；触发则本次窗口不能 PASS；严格限流等待、原生致命错误/监督失败/审批过期撤销均停止，人工处理退出码 78 不重启 |
| 到期/撤销 | 仍为 2026-10-10T00:00:00Z（北京时间 10 月 10 日 08:00）；不延长旧有效期。范围 enabled=false 或 provider disabled/过期均阻止启动/继续本轮 |
| 结束与回执 | 本轮直接创建的进程退出，actor 停用并读回；记录实际运行秒数、两个游标的完整 ID 窗口、F05 对齐、采样、资源与异常，不把短跑/失败写成 30 分钟通过 |

[provider 配置](./20261004-binance-window-evaluation.json)沿用严格 Rust provider 契约，仅切换版本与授权引用。[机器可读范围](./20261004-binance-window-scope.json)单独描述评估窗口；启动器逐项检查并持续重读，不能把自由新增字段塞进 provider 契约。原生命令自行检查 provider；范围护栏由本轮有界启动器执行，直接绕开启动器并不获得本轮窗口授权。

[官方公共行情说明](https://developers.binance.com/en/docs/products/spot/faqs/market_data_only)和[聚合成交契约](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market)于本轮读取核对。公开可访问不等于商用/再分发权。30 分钟运行也不构成 24h、Linux/systemd 部署、主机死亡外部告警或整个 R01 验收。
