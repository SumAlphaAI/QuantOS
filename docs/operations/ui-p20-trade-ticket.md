# UI-P20 Trade Ticket

`/trade`、`/trade/:symbol`（大写字母/数字的服务端标的，2–40字符）及可选单个`proposalId=UUID`。URL不接收账户、mode、Command ref或交易参数。旧Proposal深链仍可用。详情标的必须与实际授权Proposal相符；静态host只映射声明的canonical符号路由。

参照design/P20-Trade-Ticket-Controlled-Order-Entry-High-Fidelity-v3.png实现范围栏、四阶段导航、OrderForm/ExecutionContext/PreTradeCheck三栏、上下文证据、订单摘要、明暗与桌面/平板/手机布局。契约只有服务端Proposal意图，本页不开放任意Buy/Sell/数量/限价/TIF/reduce-only编辑；新意图需要新Proposal。Top-of-book参考报价不伪造五档深度，手续费/滑点/可用现金/仓位影响/独立Kill状态缺失保持未知，权益不冒充现金。不把参考行情venue或lot/min-notional当执行venue限额。

1. 选择授权Proposal和精确行情参考venue，点击“读取并重新核查”。C01双读并持续撤权，C07 Proposal/C12报价/C13 opt-in执行上下文及预检SSE/能力读回互相验证。显式两次继续可生成本访问非执行intent；步骤3的审阅不授交易权限，确认风险申请时重读所有来源。变化则返回审阅，过期/deny/数据缺失拒绝。
2. 输入`EVALUATE RISK`确认。复用Proposal owner，重读对象/预检/版本，POST只发送contextHash及If-Match/幂等键/CSRF。202只受理。通过当前授权C08分页（每页50、最多1000、去重/游标循环拒绝）与实际Proposal correlation/originator/objectRef匹配唯一Approval，不猜测通用jobId为审批ID。
3. 独立审批人到Approval页面完成MFA/再认证与决定，发起人不能自批。本页只有显式“读取风险与审批状态”；不替审批人操作，不申请额外C08审阅投影权限。pending/rejected/request_info/expired均不能提交。服务端command_ready表示已签发；已submitted只读，刷新不重新下单。
4. 当前、已批准且有未过期Command ref时输入`SUBMIT COMMAND`。再次匹配当前审批与Proposal、重读服务端引用，复用Orders owner仅POST`{commandRef}`和原幂等键。202回执与真实Order分开；通过授权correlation+approval溯源匹配Order，再读事实，不把jobId当Order。跳转`/orders/:orderId`查看成交与撤单，UI-P11另行实现高保真。

风险申请或命令写入丢响应会锁定整个流程，只允许显式恢复原body/key/版本，不自动重试、换键或续期。Command恢复复用UI505原键机制；风险申请恢复沿用UI502有效期/源核查约束，原引用/上下文已失效时拒绝，不能据此声称跨会话或持久恢复。退出、离线、失焦/隐藏、scope/权限变化关闭全部owner并清除事实/草稿/恢复意图。切换另一建议需清空新开，未知结果时清空链接禁用。

SSE设置总量、帧和请求期限；预检新增EOF UTF8最终校验及permission_revoked立即清除访问能力。没有持续domain自动轮询/写重试；报价与8秒核查窗口过期如实显示陈旧。

功能Gate `PASS_P20_HIGH_FIDELITY_FUNCTION`，计划`IMPLEMENTED_PENDING_ACCEPTANCE`；正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。`node scripts/ui-p20-review.mjs --run docs/audit/evidence/ui-p20-local-20261024/attempt-NN`在本地提交源码后运行，`--verify`复核。仅本机owned reference身份/数据，明确TLS/cookie/CORS替身，OpenAPI1.16.0不改；生产凭据/推送/部署禁止。目标IdP/DB/RLS/真实风险与venue/持久恢复/远程CI/性能长稳/完整I5/发布NOT_RUN。
