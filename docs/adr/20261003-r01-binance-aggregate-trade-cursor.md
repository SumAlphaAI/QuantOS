# ADR：Binance 公共 REST 聚合成交与原子补偿游标

日期：2026-10-03；状态：Accepted（技术决策，不替代 R01 正式验收或商业数据许可）。

用户决定暂停 LLMQuant 注册路径，先接 Binance 公共现货。首期使用 REST aggregate trade；原生解析代码置于 ingestor `binance.rs`，继续使用 QuantOS RawMarketTick/MarketEvent v2、Supabase 与 F05，不新增本地数据库或消息基础设施。

来源身份固定为 symbol:agg:a，provider/dataset 明确聚合成交语义。T 毫秒转 UTC，p/q 用原始字符串；f/l/m 验证但不进入当前 tick 契约，后续研究若需要这些字段须扩展并复审。来源 hash 覆盖当前自有契约的 ID/symbol/T/p/q，不宣称完整 Binance 响应的字段级不可变证据。

引入 `binance_ingestion_cursor` 与 SECURITY INVOKER `append_binance_page`。每页 expected cursor 校验+row lock，连续 ID、全部 receipt/event/audit/outbox 与 next_id 在一个语句中提交。失败不确认整页，重启重读已提交 next_id；游标是操作状态可更新，事实仍不可变。authenticated 无表/函数权限，backend 须持有现有权限和有效 service actor。

首次默认从最新聚合成交定义有限验证窗口；显式 from-id 定义历史起点。既有游标禁止以不同 from-id 覆盖，页内 ID gap 拒绝而不是猜测跳过。并发 worker 对过期 expected 值失败，supervisor 重读游标后恢复。

独立 watchdog/数据库连接将持久成功响应时间作为 transport 健康，空成交页也刷新响应时间；与逐 tick 的 event_time freshness 分开。若 watchdog 退出，主循环在下一轮停止。进程死亡仍由外部 supervisor 告警，不能声称独立线程跨进程存活。原 JSONL polling 保留原协议；原生 base 独立变量且限制官方域名，测试回环只在 fixture 下允许。

429/418 不继续请求，Retry-After 交由运维/supervisor 执行；暂时源错误在有界轮次中重试。迭代、页数、body 和轮询间隔有上限；没有无限任务内存缓存。页内所有事实预先构建再原子提交，domain/DB任一步失败不会留下部分游标。

验证分别报告：纯契约/CLI，loopback故障注入+实际Supabase，Binance真实摄取+主动停止后补偿。source age、接收至处理/写入、异常发出和消费延迟不能相互替代。暂停/补偿窗口的高延迟保持真实记录；真实成功响应不是端到端五秒异常 SLA 回执。
