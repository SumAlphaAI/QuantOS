# L01：单一 Spot Testnet 的受控协议边界

日期：2026-10-26。状态：当前本地工程实现；不代表 testnet 或发布批准。

选择 Binance Spot Testnet 的固定 origin，实际执行只启用 LIMIT/GTC。凭据/HTTP 留在未来受限执行宿主；本次只实现无凭据协议端口与自有 fixture 进程。旧 ScenarioDrivenTransport 和 f64 接口继续作为 fixture 兼容，不作为真实 venue 路径。实际入口仍须 X03 已签发、当前授权的命令，拒绝以公开校验和替代执行权限。

官方依据（当日只读核对，无账户或 API 调用；未复制密钥示例）：

- [官方 Spot Testnet REST API](https://github.com/binance/binance-spot-api-docs/blob/master/testnet/rest-api.md)：订单 FULL 回应和成交字段、查询/撤单标识、myTrades 的 orderId 与最多 1000 条；429/418 的 Retry-After 单位秒；403 是访问/WAF 类拒绝。5xx 不保证执行失败。内部严格累计成交核对、摘要 client ID 与缓存上限是 QuantOS 自有保守约束。
- [官方错误码](https://github.com/binance/binance-spot-api-docs/blob/master/testnet/errors.md)：-1006/-1007 表示执行结果未知；本地保留不确定占位，不自动重发。认证失败与明确订单拒绝分别分类，原始 msg 不落入订单或错误日志。
- [官方 filters](https://github.com/binance/binance-spot-api-docs/blob/master/testnet/filters.md)：PRICE_FILTER、LOT_SIZE 与 MIN_NOTIONAL 采用十进制约束。当前自有规则子集不等于动态 exchangeInfo 全量支持；额外过滤器、全局权重和目标规则刷新仍需真实环境联调。

研究/UI 不解析 secret reference；测试环境使用白名单，子进程 env_clear。配置中唯一固定 secret:// 引用仅是标识，不是凭据；不输出其中可变内容。此处没有 HMAC、私钥、真实账户或 HTTP 实现。不能把自有 stdio 成功、旧 200 场景 report 或单一原生签发用例当作交易所成交回执。
