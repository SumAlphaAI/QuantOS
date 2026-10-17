# ADR：TP07 Paper进程、X03下游消费与不确定结果

状态：当前功能实现；完整业务联调、真实Nautilus运行时、目标环境和正式用户确认独立待验。执行依据为最新AGENTS.md与[分阶段测试规程](../operations/phased-testing.md)。

## 决策与信任边界

`dispatch::SignedExecutionGateway`是X03签名命令的typed trusted-backend消费路径，服务导出名为`X03CommandService`。仅接收`SignedCommand`、F06已认证AuthContext和服务端解析的当前来源。无新增公开HTTP/venue入口。原`ExecutionCommandService`/root TradeCommand保留F06合成探针兼容性；公开checksum不构成新路径的授权。

固定锁顺序为downstream→issuer→risk→内核。`AtomicCommandIssuer::with_current_command`验证完整存储命令/HMAC/身份/租户账户/有效期、绑定的Consumed审批及当前X01/S03/财务/venue事实，调用与kill CAS共用的RiskGuard临界区。只放行Paper/Shadow LIMIT；缺权限、撤销或失效来源、过期、kill等在内核之前拒绝，缓存重放也必须重新检查。时间与来源参数由可信后端提供；真实会话撤权、时钟和来源服务属于部署联调证据，不接受客户端自报为权威。

同一网关的克隆共享Mutex和提交缓存；tenant/workspace/account/key命名空间绑定完整命令。issuer还记录command→consumer所有权，另建一个网关也不能再消费已提交或结果不确定的同一命令。纯边界错误发生在claim之前，不产生提交；内核调用前预留Uncertain，任何调用错误都按“可能已经提交”隔离，不自动重试、不切换Paper兜底。错误不暴露任意后端诊断或秘密。已进入内核的命令不能靠重建本地网关来证明未提交；恢复需要可信下游对账和持久所有权移交，当前NOT_RUN。

## 内核与进程协议

保留QuantOS自有`ExecutionKernel`、`BoundaryCommand`、Nautilus wire词汇和Order/Fill schema。client_order_id从命令UUID生成完整SHA-256，不从跨账户可重复的用户key生成。核心不链接或导入任何Nautilus类型/包。

默认自有Paper内核可进程内运行，也可通过`PaperProcessKernel`启动固定绝对路径本机可执行文件`execution-gateway --tp07-paper-kernel`。它使用`env_clear`、私有0700临时工作目录、stdin/stdout专用通道及关闭stderr；子进程不接收用户/Agent/session/审批/风险/签名/密钥或账户标识，只收到opaque command ID和自有订单wire。严格schema/backend/PID握手先于任何交易锁，启动有60秒上限；交易请求的IO期限不超过1秒和命令剩余期限，超时关闭并回收子进程与worker。JSON行帧最大64KiB，拒绝未知字段、缺换行、错request/command绑定、空/过量事件或越期时间戳。服务端同内容重放返回同一Paper事件，不同内容同client ID拒绝；最多10000条内存记录，容量耗尽拒绝新key。

这是自有Paper参考协议，不是Nautilus公共RPC的兼容性或实际运行证明。独立进程/env清理不等于OS级文件、网络、UID或凭据沙箱；可执行文件由可信运维选择，真实部署还需制品固定、进程/出网隔离与授权。测试专用直接协议探针只在存在LLVM采集变量时向受测子进程传入该采集路径；产品spawn仍清空全部继承环境。

事件投影先校验整批再提交，拒绝未知command/venue、错期限、负数/非法精度、过量成交、同fill ID不同内容及非法状态转换。重复fill去重；分批成交累加数量并用Decimal计算均价；OrderRejected保留reason。异常批次不留下部分订单/Fill变更，网关隔离等待对账。普通Paper事件使用实际传入的提交时间，不能以过期时间充当成交时间。完整OMS、取消、append-only持久事实和10万事件验收归X04。

## Nautilus与发布边界

固定`fa86c6e39e8f064d5922c0ee4da5e2a9a2716408`的Nautilus候选仍是EVALUATION_ONLY / runtimeAdmission=DENIED；未安装、构建或执行上游。LGPL-3.0-or-later原始声明、完整运行时SBOM/最新漏洞可达性、分发/notice/source/可替换义务和法律确认不由进程隔离自动满足，参见[许可ADR](20260731-tp07-nautilus-license-compliance.md)。真实Nautilus bridge/API兼容及目标运行NOT_RUN。

本实现的线性化、幂等、claim和隔离均为进程内状态；独立issuer、重启或副本不能共享持久记录。Supabase/RLS事务、分布式dedupe/审批/审计、崩溃恢复和不确定结果对账、生产密钥托管、目标安全/性能/长稳/同SHA CI仍待验。不得把本地1000逻辑任务正确性测试当目标P95。替换内核只能用于未消费的新命令，或在完成可信对账/移交后操作；禁止因超时无回包便改走另一个内核。

## 功能门禁

`TP07_LOCAL`仅按14组当前功能与直接影响检查发布DEVELOPMENT READY；输入/命令/日志/覆盖率和源码版本可核验。直接前置仍作为NOT_REVALIDATED/referenceOnly，不递归放行上游。业务联调、发布及正式ACCEPTED单独记录。X03旧独立Gate因功能输入变化撤回，其历史manifest/日志不改写；本轮X03回归属于TP07影响验证。所有历史失败/审查超时/中断保留真实范围。
