# TP12 X3 当前功能边界核对

2026-10-17。决策仍为 reference_only，runtimeAdmission=DENIED；不安装、构建、执行或引入 nautilus_agents/Nautilus 上游运行时。固定 agents 参考 8d79877380f8617b45dff2b8c8b3790c2f9d963a，12 个文件保持原字节和 Git tree/blob 绑定。本文补充 S2 评估，不改写历史证据或引用为当前 READY。

按最新 AGENTS.md，TP12_LOCAL 完成本地功能边界核对和直接影响回归，不递归验收 F07、TP07、S2 或全仓。TP07 完整业务联调后的 TP12 完整复审仍 NOT_RUN，不能用本轮替代。实际目标、发布、正式确认另行验收。

## 七条禁止耦合规则

1. Agent 无 venue/下单工具、网络授权和凭据；研究入口只允许 query_signal/query_snapshot/query_artifact，递归拒绝权威字段及大小写/连字符别名。
2. 建议始终 executable=false；上游 ReducePosition 与 QuantOS TradeProposal 无 wire 兼容，不自动映射为命令。
3. Agent advisory、风险声明、trace 不能替代 X02 当前风险、X03 独立审批及原子签发。实际入口为 AtomicCommandIssuer，旧 CommandIssuer 只作历史 fixture，不能当生产准入。
4. Agent 不调用 kernel。真实 SignedCommand 由 SignedExecutionGateway 校验、当前复核和唯一消费，kernel 仅接收净化 BoundaryCommand；account/venue 在 kernel 内有意保留。通用 ExecutionGateway 是可信内部 API，须由宿主限制可达性，类型不等于 OS 授权。
5. Agent trace 仅为输入证据，不能自行成为权威审计、X04 Fill 或 X05 修复/关闭依据。runtime 记录 Artifact，OMS 追加事实，异常服务以自己的报告/CAS 状态复验关闭。Agent mock Artifact 不是生产审计。
6. 过期、kill、stale 和权限撤销必须当前拒绝；重放不能绕过。ShadowRunner 只生成虚拟建议/账本，不签发/提交命令。
7. 上游 SDK/包/别名/加载代码不进入 QuantOS runtime/lock/manifest。新静态扫描覆盖 Python AST 导入/常量动态加载、Rust 路径、JS import/require、manifest 别名/URL及锁文件；它不证明任意混淆代码或宿主环境的隔离。

机器规则、六面接口差异、八项威胁映射见 [x3-boundary-review.json](../../third_party/nautilus-agents/x3-boundary-review.json)。威胁均为 DESIGN_HYPOTHESIS，残余风险独立列明；没有把场景描述当作漏洞发现或安全审计通过。

AgentClient 是 Agent 协议而非交易 transport；当前 PaperProcessKernel 为 QuantOS 自有 stdio 进程，并未运行 Nautilus。AdvisoryValidator 不替代 RiskGuard。ReferenceOnly/Redacted/Full、Restricted 留存与 fields.toml 逐字段治理仍为候选，未新增运行时实现或依赖。

## 验证与后置义务

本机真实 Agent UDS 子进程验证非可执行建议、重放稳定、权限/模式/字段注入拒绝和拒绝后恢复。直接回归只覆盖当前 issuer 拒绝、独立审批、dispatch 当前复核/独立消费者、kernel 净化、R04 Artifact 和 X05 禁止伪造关闭；编译由这些 Rust 测试完成。新评估工具有篡改/提权/别名依赖/动态加载反例和门禁负向测试。未执行 10 万 OMS 事件、20 类对账或上游全闭包，不将停止记为通过。

TP07 集成后的完整复审、实际 Agent/内核 transport/OS egress 与凭据接收方、Supabase/RLS/持久原子性/跨实例崩溃恢复、受限 trace、协议演进、法律分发/最新全量供应链/CVE/可达性/签名、目标性能/长稳/同 SHA hosted CI 均 NOT_RUN。正式 ProjectUser 确认 PENDING。回退为撤回本轮文档/工具/计划准入，不涉及部署状态。

## 当前边界缺陷及修复

新测试在真实X03签发→SignedExecutionGateway路径发现：原内部idempotency_key拼接了tenant/workspace/account和调用方command_key，虽通过字段名清单仍把租户/工作区和原始键值传给kernel。本轮改为带quantos-signed-dispatch-idempotency/v1域标识的规范JSON元组SHA256摘要；账户/venue仍按契约保留。新测试观察实际下游12字段及值：伪造签名/Agent trace拒绝、原始身份/调用键/签名不出现、重放无额外调用、两独立键不同。

该变更直接影响dispatch幂等键，故扩大到全部8项tp07_dispatch、X04签名取消/权限拒绝及实际自有Paper进程提交取消回归；不执行10万事件或S2闭包。旧lib单测首次编译/启动300秒超时保留，本轮使用当前真实签发路径的新测试；Rust检查编译时限900秒不代表性能验收。当前状态/幂等为进程内；未来持久部署若改变键版本，须独立设计迁移与去重恢复，不从本轮推断已兼容持久旧键。
