# UI-504 Approval、MFA 与职责分离

功能入口 `/approvals` 与 `/approvals/{approvalId}`。静态宿主只映射准确 UUID；不接受 account/mode/actor/决定等 URL 注入。只在 QuantOS main 开发与本地提交，无生产凭据、外部推送或部署。

## 操作与边界

C01 session/context 双重授权，持续会话撤销流、5秒核对与8秒验证窗口；账户、模式、主体、MFA 或能力变化及离线/隐藏/焦点变化都会清除事实、原因、回执和内存恢复引用。访问至少要求 execution.operate，决定还要求 strategy.approve、paper、已验证 MFA 与独立发起人。前端能力只控制可见性，服务端逐次授权才是权限依据。

C08 cursor列表每页50、最多1000项，重复 ID/cursor 循环拒绝，详情独立授权；展示真实发起人、审批身份、版本、到期、业务类型/对象、关联 ID。未提供字段明确显示“未提供”。Trade Approval 未提供 kind/objectRef，不能用 AsyncAccepted.jobId 或猜测关系补齐。C08 未提供完整 RiskDecision，UI-P10 高保真/风险详情仍是后续任务。

二次确认包含具体审批/版本/决定/原因与确认短语、6位 MFA；初始焦点在取消，可 Esc 退出。approve/reject/request_info 均显式确认，后两者原因必填、最多1000字符。确认前重读 C01/详情，完成真实 C01 MFA/再认证后再次重读详情及 C01，变化要求重新审阅，不自动覆盖决定。发送 If-Match、Idempotency-Key、CSRF、Request-ID；无乐观成功、签名伪造、Command 提交或 Order/Fill 推断。仅收到绑定正确、版本变化、实际决定/状态吻合的200才显示服务端回执。批准得到 commandRef 也仅提示短时引用，后续提交仍须独立核验。

Trade 和 strategy_release 共用 C08。Release 分支补齐实际 decision、拒绝原因校验与时间线记录；request_info 与现有 Trade 一致，以 rejected 关闭本次申请并记录原决定，不授权、不隐式重开或部署。欲重新申请需业务方后续流程，本任务不构造。

自批/过期/非pending在客户端提前拒绝；CAS冲突、额度/健康变化由服务端最终拒绝。409不自动覆盖/提交，需显式刷新与重新确认；422/429/401/403不报成功，429按有界retryAfter冷却且仅显式重试，不展示后台私有message。MFA码不保存在运行时草稿、恢复请求、存储或网络证据中。

若写入返回未知/丢失/不符合绑定，保留原主体、原版本、原body/验证引用与原幂等键在本次访问内存，锁住新决定；只能显式原键恢复。恢复时再核对C01，原审批或再认证过期后禁止重发，仅可读服务端/审计核对。未知结果不会因一次刷新自动变为成功。离开页面/失权会清除内存引用；跨访问持久恢复 NOT_RUN。成功版本只记入本次访问最多100项的防重复集合，不淘汰后重开。

## 验证

`node scripts/ui504-review.mjs --run docs/audit/evidence/ui504-local-20261024/attempt-NN` 必须针对已本地提交的源码、新目录执行；`--verify`校验源码输入、命令/退出码、原始日志与构建/二进制/网络/截图hash。限定当前功能、C08执行/Release宿主和会话/执行恢复直接回归，不递归重验上游依赖、不启动数据库/覆盖率campaign。测试环境白名单，真实reference BFF仅回环地址；浏览器明确使用合成身份cookie/CORS/TLS桥接，所有负面修改标识SYNTHETIC，外网拦截。

限定工程Gate PASS_UI504_APPROVAL_FUNCTION 不等于正式ACCEPTED。development_status=IMPLEMENTED_PENDING_ACCEPTANCE；stage_gate=INTEGRATION/NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。真实IdP/cookie/CORS、目标DB/RLS/持久恢复、真实risk/portfolio、同SHA远程CI、性能长稳、跨浏览器/OS、人工读屏/原生200%缩放、完整I5联调与发布仍NOT_RUN。旧证据 ORIGINAL_SCOPE_ONLY，原始失败不覆写。
