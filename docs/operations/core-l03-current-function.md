# CORE:L03 当前公共审批、原生权限与 P10/P11 接续

本轮仅 main、DEVELOPMENT。本地工程 Gate `PASS_OWNED_LOCAL_CORE_L03_PUBLIC_NATIVE_JOIN` 以冻结回执为准；开发状态 IMPLEMENTED_PENDING_ACCEPTANCE，完整 Gate NOT_READY_GAPS_OPEN、stage NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。实际 testnet、生产凭据、数据库与外部发布均未执行。

## 权限与同源事实

新增 `quantos_execution::assisted_execution::AssistedExecution`，组合现有 SERVICE:L03 和 X04/L01。旧 Paper/Shadow `AtomicCommandIssuer` 继续拒绝 Assisted Live；服务审批 receipt.execution_authority 始终false。新桥接没有反序列化 command/grant 或导入回执的接口，只有当前服务锁内的两人检查能签发内部命令。

锁顺序为 bridge→approval service；身份、原申请者会话/generation、两名审批者当前会话与HMAC证明、当前policy revision、同一不可变Subject及RiskDecision、额度/白名单、半开有效期全部重检，再在服务锁内调用现有 X04 gateway。Subject新增明确side并进入内容hash，避免审批未绑定买卖方向。原F06完成窗口可以缩短native challenge，不能借重签延长MFA；当前公开adapter把窗口限制在原verifiedAt+120秒、challenge/session/request最早截止。命令最多30秒，且不越过原审批/身份期限。

内部命令HMAC绑定完整Subject、批准记录/两名actor、policy、request和Command ID；签名不是用户/组织公钥签字。命令仅存在于当前进程私有映射，不交给浏览器重建。X04交给ProtocolKernel的BoundaryCommand不带用户会话、MFA证明或密钥。所有同申请重放只读原结果，不再调用kernel；同一不可变proposal hash即使新建审批请求也只能保留一个原生命令。未知结果永久保留当前reservation/原Command，不换key补单；过原命令期限拒绝重放，当前授权仍可只读查旧事实。跨进程持久恢复归CORE:L04。

## 公共契约与界面

OpenAPI 1.18.0新增8个操作/12个schema，生成SDK/Zod/schema/MSW/input-policy。新路径位于 `/v1/assisted-testnet/`：当前能力、Subject目录、申请目录/创建/详情、独立审批、原生命令及当前签名审批审计。客户端仅提交Subject ID或request ID/expected revision及原MFA/reauth引用，不能注入actor、mode、quantity、risk、enabled或command。已有134个操作与既有schema语义保持不变。

服务端 capability 绑定C01完整作用域、8秒窗口和policyRevision，flag/target默认false；能力发现与审批回执都不是执行权限。关闭时业务接口在JSON反序列化前拒绝。原生profile禁止调用Paper/Shadow旧业务路径，不能通过改mode降级为Paper签发。

P10/P11由当前C01选择模式，引用规范化先于网络请求，query/public build flag不授予权限。Paper/Shadow保留原页面；当前Assisted profile展示同一Subject指纹、数量/方向/限价、两名审批者、申请期限和原生Command/Order。P10逐次MFA+reauth、职责分离，P11需要两人批准且为原申请者才能提交；高风险操作有桌面限制、确认短语与最终勾选。小屏只读。

前端控制器持有原CSRF/key/body/deadline，非JSON401/403、C01作用域变化、失权/离线均自行清除敏感事实并中断，不能依赖调用方callback。未知结果只允许显式原请求恢复；已知原生unknown不自动补发。页面只读续验短期capability，过期或改变条件立即关闭动作；不进行定时写入。

## 自有端口与适用限制

`BffProvider::assisted_reference(enabled)` 只由显式loopback reference启动：`QUANTOS_BFF_REFERENCE_CONTEXT=assisted-local`，且 `QUANTOS_BFF_OWNED_ASSISTED=enabled` 才开启；缺省/其他值关闭。live启动分支没有挂载此profile，普通BFF不能借环境flag访问Vault或外部venue。

本轮当前同源流为：真实公共C01/MFA/reauth路由（reference Cookie与固定因素完成替代端口）→真实SERVICE:L03 keyed证明/两人审批→真实AssistedExecution/X04/ProtocolKernel→自有无网络ProtocolPort返回合成venue字节→同源GatewayOrder。临时随机HMAC key不序列化/Debug并zeroize。Owned venue回执使用独立计数ID，批次rate profile显式1000/s，仅为本机合成端口，不代表真实交易所rate limit或性能通过。

Subject/RiskDecision来自可信owner自有当前投影，不是完整Research/R04/X02生产来源；C11的持久配置/变更治理、真实F06/IdP、L02 mTLS受限进程接续和公共C10持久审计尚未接入。原L02/L4证明仅原SHA参考，不拼为本轮mTLS成功。新公共审批审计确实按同一request/subject生成并在服务内验证完整HMAC链，但不是公共C10持久存储或重启恢复验收。

## 本轮限定验证

原生检查覆盖原回执不能跳过第二人、32并发只执行一次、policy/Subject/申请者和审批者撤销/generation、原命令半开deadline、unknown不补单、同proposal不得重复、side hash与原MFA期限。公共Axum及实际socket HTTP各跑同类50参数化审批流程，均100条两人HMAC审批审计、50个同源Command/Order；它们是同一50案例语料的两个面，不计100个独立场景。M5 flag-off 50案例分别在默认无host与显式关闭profile执行，所有业务请求拒绝；能力发现返回false。额外验证无权/自批/跨会话/伪造证明/注入、200申请目录上限下原key恢复，以及实际P10/P11丢失响应/小屏/默认关闭/失权。

原生模块、BFF入口与SDK有变，故执行直接服务审批与旧Paper拒绝边界、BFF execution 29项、契约/消费者/类型/lint/build及12项Chromium（新3项+旧G8/FEP5九项）。不递归全上游、数据库campaign、覆盖率或全仓验收。每轮失败和未执行保留，候选先提交再采集；`node scripts/core-l03-review.mjs --run docs/audit/evidence/core-l03-local-20261027/attempt-NN` 使用白名单环境/固定pnpm/Cargo locked offline，不覆盖旧attempt；`--verify`只读核对证据。

开发预检保存：Rust UUID借用/Debug缺项、schema名错误、header测试使用非UUID、毫秒时钟对齐、类型/lint、模型非法C01应清理、记录会话时机，以及首轮浏览器使用全零SHA被既有Paper source resolver拒绝。全零预检3pass/9fail不能当验收；修正来源标记并保留未冻结性质后12项通过。最终以固定候选新attempt为准。

## Gate、缺口与移交

[当前机器评估](../execution/core-l03-scope-assessment.json)保留FEP-8原19项ID/OPEN，四项G8进展单列；当前本机正向不自动关闭完整M5或原Gate。真实IdP/MFA/Cookie/CORS、Vault/数据库迁移/RLS/事务/Storage、共同持久事实/跨进程多副本恢复、当前mTLS/OS隔离、实际venue HTTP/signing/testnet、目标网络/轮换/容量/安全/性能/长稳/同SHA CI、人工读屏/原生200%缩放/全浏览器与RELEASE均NOT_RUN。正式用户确认另行PENDING，不自批。

下一原任务 **CORE:L04 DEVELOPMENT**：接续当前同源公共审批/原生命令到L02 mTLS受限进程，建立公共C10共同审计及持久恢复证据，并评估完整业务Gate；不得以本轮in-process或历史mTLS事实拼成该接续已通过。[证据包](../audit/evidence/core-l03-local-20261027/README.md)。
