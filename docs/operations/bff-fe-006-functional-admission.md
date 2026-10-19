# BFF-FE-006 / A4 当前功能准入

BFF006_SCOPE_LOCAL 依据当前 AGENTS.md，核对 C06–C09/C13 的 20 项 API。十个直接前置仅核对当前接口和不可变原回执；不执行旧闭包，不重授历史 READY。PROVIDER:A3 的用户原答复、4580bac 源码、93d66ad 原稿/回执保存在独立确认账本；原确认不扩为 A4 当前源码确认。

`execution::ExecutionService` 用 X01 风险输入、X02 RiskGuard、X03 AtomicCommandIssuer 和 X04 SignedExecutionGateway/PaperKernel。提案通过真实 schema、ArtifactManifest 和不可执行记录注册；浏览器只提供 UUID 引用、版本、contextHash 和业务选择器，不能提供 actor、源事实、风险 verdict、签名或可执行命令。账户/tenant/workspace/mode 从服务端身份绑定。Portfolio 金额使用 USD 的自有合成输入，继承 X01 f64 投影限制，不声称真实 FX 或账务精度验收。

服务互斥锁顺序为 host → gateway → issuer → risk；审批人独立于 requester，MFA challenge 与近期验证均须有效，单次 proof 与请求幂等关联。X03 在消费审批和签发前原子重查当前风险；签发失败不产生命令或下游提交，已记录的 Approved 可能保留；服务端将单次 proof 保留给同一 actor/session/key/意图，恢复后仅原请求可继续签发，不重复审批或消费其他 proof，不能解释为已执行。审批展示 approved 与 issuanceState=consumed 分别表达人工决定和签发消费；request_info 写入明确 decision，关闭旧审批，需可信 owner 提供新 Proposal 后重新评估。拒绝/补充信息必须说明理由。

命令引用只在服务端保存签名对象，TTL 由 X03 决定（reference 为 5 秒）；仅原 requester 可提交。提交再次检查当前 source/kill/TTL，202 仅代表受理。订单状态、Fill 与 hash 取自 X04 事实；每个已验证 Fill 以原 fillId 幂等进入同一 X01 投影，再更新后续风险输入，标记仍保留原 source_at、不刷新陈旧报价。Portfolio/financials 绑定同一投影，非 USD 非零费用无法换算时 poison 拒绝，不能臆造 FX；页面 Order.intent 按签发前仓位映射 open/increase/reduce/close，不能暴露内核的 limit 订单类型；返回 Proposal/RiskDecision/Approval/Command/Release/风险快照及事实 hash 以便追溯。capabilities 直接读取同一 RiskGuard 和 gateway 的真实配置并取保守 notional 上限，不使用固定 UI 常量。撤单按订单与 commandRef 绑定；Order.cancelCommandRef 允许刷新页面后恢复订单控制，不能延长原 submit TTL；迟到/不确定/未知状态由下游默认拒绝，不能将受理当成成交。重复成功请求优先返回原响应，改变意图或版本冲突拒绝。source 更新须由 trusted owner 调用 replace_sources，不能由浏览器刷新时间戳。

列表使用 actor/路径/查询/期限绑定的不可变分页快照。事件以资源维度的 v1 sequence/eventId 回放；重连带 afterSequence，未来游标拒绝；消费者忽略重复，gap 保留已确认状态，禁止将 202 写入 Order；撤权清除缓存。当前流是有界回放/重连协议，持续 UI 订阅、跨实例广播与持久游标由功能联调/发布验证。日志、命令引用、分页和事实数量均有界；触顶拒绝，不悄悄丢失事实。

Reference Context 与执行 host 使用同一固定 tenant/workspace/account 和相同 requester/独立 approver/owner actor，capabilities 仅为提示，真实权限仍由 host/领域模块校验。Paper GTD 到期后，撤单202只表示请求受理，事实为 expired/拒绝，不得显示 cancelled。Reference 仅 loopback，明确自有合成数据、fixture cookie 和测试 MFA。独立 fixture approver/owner 仅获 MFA 和当前执行面受控路径；A2 其他写路径保持原规则。默认 live 没有 execution host，返回 503；`router_with_execution` 只能由可信 owner 显式装配同一进程租约，使用 F06 TrustedIdentity 与 A2 近期认证记录，数据库审计提交失败将租约 poison，拒绝后续操作。该适配器尚未在真实数据库运行。Shadow host 允许投影、preflight 和 kill control，禁止命令/审批执行与任何 venue submit；Paper 内核也不连接 venue。

`scripts/bff-fe-006-functional-scope.mjs` 明列当前功能与直接回归原因：新 host；直接 X02/X03/X04/TP07 测试；共享 CSRF/MFA/Audit 的 A2 两套 provider；20 API 当前实际 HTTP/schema/401/403、1000 重试、基本 Chromium；真实 generated consumer 丢回复恢复与事实 reducer；生成/兼容性、types/lint/clippy、确认/门禁/计划。没有全仓、递归上游或三轮构建；与本次 API 变更无关的历史 X04 十万事件体量重放显式过滤，NOT_RUN，不借用旧结果。

源码校验保留全部 Git blob/hash/规范输入核对，按16MiB分批传输，避免继承清单超过单次缓冲上限；不跳过任何输入。冻结后运行 `make bff006-local-assess ATTEMPT=docs/audit/evidence/bff-fe-006-local-20261018/function-attempt-NN`；失败/超时/中断保留为新 attempt，不修改旧回执。只有所有组与源码/输入/产物绑定检查通过，才原子发布当前 manifest 和 FE:BFF-FE-006 stage_gate；五个实际入口验证失败则回滚发布文件。`pnpm check:bff-fe-006:development` 是严格准入，mandatory CI disposition 不得把 NOT_ASSESSED 解释为已准入。

功能实现、完整业务联调和发布分别记账。实际 Supabase/Auth/RLS/持久事务、跨实例/进程重启恢复、生产密钥、持续可信数据 feed、完整 UI/G5/FEP5、安全/容量/长稳/同 SHA hosted CI 与部署全部 NOT_RUN；durable execution lease/restart 接入未实施，禁止默认开启。尚不能用本机 READY 放行 runtime 或生产。formalAccepted=false、runtimeAdmission=DENIED。新完整确认稿待用户确认，不使用生产凭据、不建本地数据库、不推送或外部发布。

2026-10-19 当前重评：保留 20261018 原 manifest、确认稿和所有失败/中断原件；新证据写入 `docs/audit/evidence/bff-fe-006-local-20261019/`。装配时同步核对 issuer 的 tenant/workspace、财务 tenant/account、Release tenant/workspace、风险 policy/venue 的 quote unit；可信源替换同样核对 quote unit，失败前不修改当前投影。公共兼容契约按 1.x 且至少 1.8 校验，当前生成结果仍须逐字节匹配；新增 shared-approvals 直接回归检验后续 A4 共享路由的最小权限/撤权/隔离。共 17 组当前功能检查，不执行 A4/A5 汇总或上游 Gate。新候选确认仍 PENDING；原用户确认保持原 SHA。
