# BFF-FE-010：Operations、Admin 与 Alert 本机功能准入

执行AGENTS.md分阶段原则：当前43个C11/C16接口及实际受影响的F06鉴权/会话、F05审计、X06告警/incident/安全Runbook、F09结构化观测边界；不跑上游Gate、全仓、三轮构建、无关风险/交易大回放。18组当前功能/直接影响检查，源码先冻结再实际执行，原失败/中断保留；日志/请求输入/产物与原版本绑定。`node scripts/record-bff-fe-010-functional.mjs`只按声明范围生成新尝试；`pnpm check:bff-fe-010`严格验证当前manifest，不把历史READY拼为新候选。

C11提供health/metrics、incident list/get/timeline/open/ack/resolve、白名单Runbook list/precheck/run，以及member/role/policy/capability/feature flag五类资源完整list/get/create/update/delete。C16提供alert list/get/ack/unack、订阅get/save和SSE。OpenAPI1.12.0、132操作/110schema；每类治理写入使用独立Spec和严格联合响应，禁止任意表达式、命令、原始metric JSON或客户端scope。

OperationsHost显式注入真实X06服务与F06身份范围租约。F09仅配置的Service observer可提交结构化健康报告及数值latency/dlq，核心验证四组件、来源、clock和30秒有效期；页面丢弃所有raw detail/summary/labels及敏感metric value，仅发布固定安全字段与sourceHash。健康/stream/Runbook陈旧拒绝；历史alert/incident事实仍标示asOf。latency为受控source观测，不证明目标P95。live无host503，不能回退reference。仅参考进程可显式选择`QUANTOS_BFF_REFERENCE_OPS_FEED=clear-once`，启动2500ms后可信observer发一次合成修复观测；该feed与浏览器请求无关、没有观测HTTP路由、不在live分支执行；用于真实core incident修复/职责分离闭环，未连接真实目标。

治理为单账户Paper/Shadow、owner注入的受控进程租约，**不是Supabase/F06表写回**。有效权限始终为当前F06身份/能力与租约role/capability/deny policy交集；不能通过租约创建未知身份、提升超出F06权限或Service/Owner自造role。成员角色/active变化使原身份在下一请求跨页面被拒绝，后续需owner从已验证F06来源刷新identity；目标持久化、身份写回及多实例传播另验。保护内置role和admin.write、最后独立管理员、引用中的role删除、本人及同user别名自治理；policy只支持typed deny，ops.approve与ops.operate角色分离；feature flags仅四个非安全功能名、显式rollout，不允许关闭kill/risk/RLS/审计等安全底线。

所有写入CSRF+Idempotency-Key+If-Match；创建校验configVersion，成员更新校验objectVersion。删除为带递增版本的tombstone，不重复使用ID/name造成ABA。当前权限在原键回放前重验；同actor/scope/session/path/method/key+intent精确恢复原结果，冲突409，验证拒绝不部分更新。成功产生一个F05 auditRef/correlation根，可由C10查证。高风险治理、incident、alert和Runbook还要求A2已验证MFA/reauth近期会话；5分钟有效断言可用于多次不同受控操作，不把它冒充X03单次签发proof。订阅为本人低风险版本化设置，无需额外MFA。live将F05写入接现有事务，commit/audit不确定后quarantine该租约并拒绝；并不证明持久回滚、崩溃恢复或跨实例一致。

ack/unack调用真实X06 CAS，不改变active/resolved；只有新的可信来源修复使source resolved。incident open/ack不授予关闭，resolve要求真实新鲜修复、比opened更新的source、原告警ack，以及独立Approver/user，复发由core重开。timeline只追加，SSE携带完整eventId/occurredAt/correlation/payloadVersion，subscriber序列对过滤后事件连续；streamId/session/当前权限/config/subscriptions绑定，gap/过期/订阅变化必须重建，不假成功。游标绑定当前身份、权限、session、query、config且冻结5分钟；page1–200。process lease最多1000资源/回执/游标/stream、10000事件；容量仅验证边界语义，不授性能/容量验收。

Runbook仅既有X06 `inspect-health` / `inspect-evidence`；后者还须真实命令证据可读；运行重新校验sourceVersion/期限/权限，不能执行shell、路径、脚本、改账、下单、取消或任意恢复。Engine/plugin capability采用独立engine_capability Spec：只有owner侧注入、真实EngineManager校验签名/manifest/artifact/routing、明确tenant且独立Approver审核的短期review，才可由Owner经MFA/version/audit准入；浏览器不能上传签名材料、endpoint或authority key。name/version/description必须与已审核manifest一致，未准入、已撤销、过期或poisoned的能力不能创建Research工作流；reference在状态锁内、live在同一governance锁持有期间完成工作流事务。该AND准入不替代真实EngineManager自身运行许可，不启动Engine进程。lease和远程运行/持久发布分开验收。

consumer只消费服务端事实，mutation receipt不乐观resolve；校验结构、资源范围、ack证据与SSE去重/gap/撤权。

完整P02/P13/P14/P23 UI、G6/FEP6业务联调、真实Supabase/Auth/MFA/RLS/Storage、F06治理持久写回、F05/outbox持久原子性、真实F09/X05观察来源、持久跨实例/重启恢复、性能/容量/长稳/部署/同SHA hosted CI与正式发布全部NOT_RUN，移交RELEASE-GATE:BETA。当前完整用户确认PENDING，formalAccepted=false，runtimeAdmission=DENIED。不得使用生产凭据、venue submit或外部发布。
