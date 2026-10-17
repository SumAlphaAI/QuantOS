# X04：自有 OMS、取消控制与订单事实边界

状态：功能开发实现；完整业务联调和发布独立待验。依据最新 [AGENTS.md](../../AGENTS.md) 和开发计划 X04；不引入或执行上游 Nautilus。

可信后端仍通过 `X03CommandService` 消费 X03 的 `SignedCommand`。提交保留 downstream→issuer→risk→bounded IO 的锁顺序、完整当前风险复核与独立消费 claim；取消和历史查询使用 downstream→issuer，以当前 capability、角色、tenant/workspace/account、原 requester、精确已存签名 Command 和原 consumer claim 控制。取消已有订单不增加风险，不要求原签发期限、approval期限或 kill 开关仍允许下单；这项例外不延伸到 submit。身份、时间与来源必须由可信服务解析，未增加客户端 HTTP 下单入口。

QuantOS-owned adapter 将提交转换为 LIMIT/GTD wire，将取消转换为 `client_order_id/venue_order_id/cancel_id/requested_at`。三个关联 ID 为不含凭据的 opaque ID；不转发 actor、tenant、账户、用户幂等键、审批、签名或 session。`OrderCanceled`、`OrderCancelRejected`、`OrderExpired` 以及 ack/fill/reject 映射为自有事件；`cancel_id` 是获准 bridge 必须回传的 QuantOS 关联扩展，不能声称实际 Nautilus API 已兼容。固定上游候选的运行时、法律、供应链和部署隔离仍 DENIED/NOT_RUN。

状态约束：submitted→accepted/rejected/expired；accepted→partially_filled/filled/cancelled/expired；partially_filled→partially_filled/filled/cancelled/expired；终态不接收新成交或新的 ack。CancelRejected 更新取消审计和最后事件时间，保持订单状态。相同事件完整内容哈希去重，冲突 Fill ID、未知 Command、venue关联错误、乱序、非法精度/金额、超量成交、无请求取消响应与非法终态转换均拒绝。成交采用 Decimal，累积数量、加权均价、非负手续费和每个 Fill 的 command_id/order_id 一并验证。ack/fill/reject 的交易事件时间须落在提交和GTD期限内；expiry事件在期限之后，取消可以晚于原Command期限。

每个取消键先保留请求事实再调用内核，键仅在对应 Command 内有效。成功/拒绝记录完成时间、微秒延迟、状态与原因；当前本机协议IO预算最多1秒，响应逻辑时间也在请求后0–1秒内。这个预算是拒绝边界，不代表目标 cancel 延迟SLO或真实性能验收。无回包、超时、崩溃、缺结果或错误关联均记 Uncertain，保留原请求事实；相同键和换新键均不能重投这个不确定订单。新进程或切换网关不能绕过 X03 原 claim。未来对账确认需独立事务和审计，不在本轮猜测成功。

事实日志是单写者、进程内 append-only API：提交意图在任何下游副作用前追加，kernel事件整批验证成功才追加，取消请求/不确定结果也只追加。事件批次只复制受影响订单，成交索引按 ID 查找；列表按事实顺序生成，改变 drain 批次不改变重放结果。读模型可更新，事实无原地修改接口。错误批次保留原订单、Fill和事实前缀并隔离后续提交；非法事件本身不能冒充已接受订单事实，原始进程回包和目标审计留存仍需部署方案。

`OrderFact` 含连续序号、order_id、command_id、前一哈希、类型化内容和带domain的当前哈希；`FactAnchor` 固定数量和末端哈希，重放必须提交可信外部保存的anchor，发现缺行、乱序、篡改和截尾。重放重新执行业务约束，输出读模型，不恢复 issuer claim、密钥或任何执行权限。哈希链不提供身份签名、持久性或抗攻击者改写全部数据与anchor的保证。按Command筛选的历史用于溯源，跨订单完整链重放必须使用完整日志和anchor。

`PaperKernel::resting` 与真实 `PaperProcessKernel::spawn_resting` 仅ACK并允许取消；默认模式维持即时成交，取消返回终态拒绝。独立进程复用严格有界 `quantos-kernel/v1` JSON行协议，新增互斥的cancel帧；旧submit形状保持不变，未知字段拒绝。子进程清空环境、私有0700工作目录、固定启动参数、不调用 shell；这些措施不替代目标 OS 文件/出网隔离。每进程最多保留一万提交及一万取消协议缓存；达到容量拒绝且由父网关保留不确定状态，禁止静默驱逐导致重复副作用。

局部风险：事实、claim、取消去重和投影仍在内存；独立进程/崩溃后恢复、Supabase强制RLS/持久事务、原子anchor归档、跨实例单写者与不确定结果对账都未验收。发布前必须在获准实际目标完成；当前不提供生产或真实venue执行授权。旧 `paper` 浮点fixture仅作兼容测试，其非法成交先修改再拒绝的问题已修复；可信路径使用本ADR中的Decimal reducer。

GatewayOrder/GatewayFill是内部投影，新增期限与直接Command溯源字段；本轮未暴露新的BFF/HTTP或生成客户端API。公开交易schema仍可经Fill→Order→Command关联，后续完整API联调需显式版本与权限映射，不能把内部serde结构视作已发布契约。

自有挂单模式在取消请求的受控时间达到GTD期限时，先映射OrderExpired再返回CancelRejected；取消控制本身通过授权，但订单已到期不能记作取消成功。当前无独立实时定时器，期限事件在控制请求时补记，目标持续事件驱动与断线补偿仍需联调。
