# CORE:L01 当前功能与验收边界

2026-10-26，直接在 main 完成；按 AGENTS.md 的当前功能与直接影响范围验证。

`venue_protocol::ProtocolKernel<P>` 实现 X04 `ExecutionKernel`。当前可信主机入口为 X03 `AtomicCommandIssuer` → `SignedExecutionGateway` → 已脱敏 `BoundaryCommand` → 固定 testnet 协议 → X04 Order/Fill 与事实回放。`ProtocolPort` 没有随附网络、密钥解析或签名实现，研究 Engine、Web/BFF 不能由此获得凭据。直接构造 BoundaryCommand 和旧 TradeCommand 的测试仅证明可信边界内部映射；真实签发用例另行验证，200 个映射样本不等于 200 次真实身份审批。

| 项目 | 当前行为 |
| --- | --- |
| 单一 venue | 配置标识 `binance-spot-testnet`，执行域标识 `BINANCE_SPOT_TESTNET`（符合执行域大写符号约束），唯一 origin `https://testnet.binance.vision`。配置 endpoint 必须完整相等；不接受子串、端口、路径或别名绕过。 |
| 订单意图 | 当前实际执行 profile 为 LIMIT/GTC；不静默降级市场/止损/其他意图。旧 fixture 编码 MARKET/LIMIT/STOP_LOSS/STOP_LOSS_LIMIT，仅保留兼容用途。 |
| 精度与过滤 | Decimal 字符串；签发数量/价格不改写。检查 tick、step、价格/数量上下界、最小名义金额、规则有效期与命令 TTL。规则是 owner 显式传入，source_hash 是引用摘要，不是交易所签名或抓取证明。 |
| 请求 | 固定 POST/GET/DELETE `/api/v3/order` 和 GET `/api/v3/myTrades`；受控 timestamp、recvWindow。client ID 为域隔离摘要，端口不携带 account、actor、审批签名、会话或原始幂等键。 |
| 限流 | 同一内核实例提交/查询/撤单共享预算，单调受控时钟；429/418 按 Retry-After 秒冷却，异常超长 backoff 保守冻结。不是交易所全局 IP/账户权重限流。 |
| 失败分类 | 401/已知认证码→Authentication；403→AccessDenied；429/418→RateLimited；明确业务错误→VenueRejected。5xx、-1006/-1007、断连、超时、未知/矛盾/无效回包→未知，保留提交占位且不自动重新 POST/DELETE。上游 msg 不进入错误或订单理由。 |
| 回包原子性 | 校验订单/client/symbol/side/类型、数量/限价、时间、状态、成交/费用及交易 ID；整帧先验证再发布事件。重复交易不重复记账；变更、超量、未来或外来交易拒绝。 |
| 恢复 | 显式 reconcile 只读查询，未知提交按原 client ID，已绑定/撤单按 order ID；有成交必须读取真实字段形状的 myTrades，不以平均价或累计数量伪造成交/费用。最多 1000 条，无法覆盖累计量则保持未知，分页待联调。 |
| 幂等与生命周期 | 同一内核租期内至多 4096 个订单，保留命令、键、交易与撤单绑定；未知写不重发，明确撤单拒绝后可用新授权 cancel ID 重试。进程重启/多副本持久去重未实现；命令 gateway 仍独立维护不确定状态。 |

验收入口：`pnpm assess:core-l01:local docs/audit/evidence/core-l01-local-20261026/attempt-NN`，先提交候选，再采集，不覆盖旧 attempt。`pnpm check:core-l01:local` 校验原候选输入、日志、矩阵、二进制摘要和拒绝边界。`pnpm test:core-l01:gate` 运行回执变异测试。脚本使用显式环境白名单、Cargo offline 和自有 stdio 子进程，不读取私有 dotenv、不继承测试凭据。

200 个唯一自有合成样本包含 50 完全成交、50 部分成交、50 拒绝、25 撤单、25 撤单拒绝；同一批样本分别走直接端口和真实进程，共两个回放面，不宣称 400 个独立场景。每面 250 次协议调用。进程面另外验证 X04 事实回放及重复提交零新增写。所有金额与规则均为自有合成输入，不具有市场有效性。

直接影响回归：修改旧 VenueConfig/十进制映射和错误脱敏，因此复验旧 venue 4 例、当前 legacy 6 例；新内核接入当前执行链，因此复验 gateway、TP07 dispatch 和 X04 原子性/撤单/事实回放（不执行 100k 性能样本）。quantos-evidence 是旧 API 直接消费者，仅编译兼容；其宽范围性能/恢复 campaign 未运行。不改 Web/UI，无浏览器验收；不递归复跑 X3 或其他上游 Gate。

工程 Gate 为 `PASS_OWNED_LOCAL_L01_PROTOCOL_ADAPTER`，仅在机器回执通过后有效；完整 Gate `NOT_READY_GAPS_OPEN`，DEVELOPMENT stage `NOT_ASSESSED`，正式 ACCEPTED=false，runtime `DENIED`。不因本地工程通过修改依赖的历史 READY。

未决义务：L02 的受限密钥宿主/签名、Vault/mTLS/egress；真实时钟同步、exchangeInfo 新鲜度与完整过滤器、交易所全局权重/账户限制、HTTP/TLS/用户数据流、reset 与分页、持久去重和跨进程未知状态恢复、真实 testnet 200 笔、C09/完整业务消费、目标环境/安全/性能/长稳/同 SHA CI 和正式验收。当前全部 `NOT_RUN`；没有生产凭据、推送或发布。下一可执行原计划任务：`CORE:L02`。

协议事实与依据见 [L01 ADR](../adr/20261026-l01-testnet-protocol.md)，逐条结果见 [证据包](../audit/evidence/core-l01-local-20261026/README.md)。
