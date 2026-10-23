# UI-505 Command / Order / Fill 操作规程

仅 `/orders`、`/orders/:orderId` 和 `/orders?approvalId=UUID`；引用不能授予权限。C01 session/context 双读及撤权监听绑定 actor/tenant/workspace/account/mode/environment/capabilities，offline、失焦/隐藏、过期或失权关闭运行时并清空事实、回执和恢复意图。必须显式重新核查。

发起人选择已批准、已签发、未过期的服务端 Approval，查看 Command 引用并输入 `SUBMIT COMMAND`。新写入前重新读取 C01、OrderCapabilities 和 Approval；POST `/v1/commands` body 仅 `{commandRef}`，带 CSRF、Request-ID、Idempotency-Key。前端不签名、不拼接交易参数。shadow 只读，paper 写入仍以当前服务端权限/风险/额度/有效期为准。

202 仅受理，单独显示 jobId/correlationId/auditRef。通用 jobId 不被当成 Order ID；只通过授权 `/orders?accountId=...&filter=correlationId:eq:...` 查询并匹配实际 evidence.approvalId（撤单匹配原 orderId），确认唯一资源后读取真实 Order 和 SSE。最多20页、每页50条；不能解析时保留受理回执供显式再次读取，不造订单。

Order/Fill 数量使用十进制字符串精确比较。成交和累计数量必须相符；唯一 Fill、不可变 Order 字段、非递减成交、append-only Fill、合法终态、事件租约、事件ID、连续序号和时间均校验。相同事件可重放；空洞/冲突/断流保留最后确认序号并停止新撤单。点击“续传并核对订单事实”从 afterSequence 恢复并对照 GET 当前事实；8秒未核查只读。有限 SSE 回补是显式查询，不声称持续实时连接。

撤单需当前可撤状态和服务端 cancelCommandRef，输入 `CANCEL ORDER` 后再次核查事实与权限。POST body 仍仅 `{commandRef}`；202 cancel_requested 仅表示受理，实际 cancelled/filled 等由 Order/Fill 事实确认，不删除成交。提交 TTL 过期不授予新提交能力；是否仍可撤单由订单及服务端判定。

网络中断/损坏响应/5xx 等未知写结果保留原 action/body/key，仅允许显式“恢复原请求”，禁止换键、新引用或自动重试。原键恢复可在原提交引用过期后进行，服务端区分已受理回放与尚未提交的过期命令。已确认的401/403/404/409/422/429拒绝不伪装成功；429冷却有上限。恢复仅本次访问内存，不持久化敏感引用；离开后使用服务端订单与审计只读核查，跨会话恢复 NOT_RUN。

本机 reference BFF 使用合成身份与 owned PaperKernel 数据，回环 TLS/cookie/CORS 是明确替身。固定测试 MFA 仅审批前置夹具。没有目标数据库、生产凭据、真实 venue 或外部发布动作。OpenAPI 1.16.0 未修改。UI-P20/UI-P11 高保真、完整I5联调、目标持久恢复、真实IdP/RLS/风控源/CI/性能长稳/发布均另行执行。

验证入口：`node scripts/ui505-review.mjs --run docs/audit/evidence/ui505-local-20261024/attempt-NN`（源码先本地提交；全白名单环境），随后 `node scripts/ui505-review.mjs --verify`。Gate仅 `PASS_UI505_EXECUTION_FUNCTION`；开发状态 IMPLEMENTED_PENDING_ACCEPTANCE，正式 INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。
