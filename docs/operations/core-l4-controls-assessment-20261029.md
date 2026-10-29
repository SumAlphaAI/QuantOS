# CORE-GATE:L4 公共 kill/C11 后当前组合评估

当前 DEVELOPMENT 基线为 `6653fd47bd9adc081acdd365ecf0d5a5993ae223`，接最新 C11 移交。旧组合、native-control、C11 与上游材料保持原字节、源码及范围；历史校验只证明材料完整，不把它们拼接为当前准入。本轮使用新冻结源码和实际命令、输入哈希、二进制、进程/浏览器回执。

当前组合为 R04 immutable Proposal/X02 signed RiskDecision → 同一公共 Subject/独立两人 reference MFA → native Command/L02 实际 mTLS 受限进程 → owned L01 原始协议 → X04 Order/Fill → X01 持久账本 → 独立签名原始协议观察/X05 → OPEN 证据 → 公共 Alert/P23/共同 C10。公共账户/当前工作区全局 kill 接当前 X02 generation 与 native durable stop；固定执行域 C11 version/history/Owner MFA/CAS 接审批服务和 native lease，实际 IO 校验租约时钟与原期限。version0 是 bounded owner reference import，不能冒充公共授权或目标准入。

本轮在同一个 accepted 场景上执行 C11 off/on、全局/账户 kill、再 off/on 与重启：原 RiskDecision generation0、request/Command/Fill/sourceHash、X01 ledger、X05/OPEN Alert 和请求审计保持；kill generation 由显式 engage 到2，C11 version 到4，不隐式解除。另在同一真实 zone commit 后调用方死亡的 UNKNOWN 场景执行账户 kill、C11 off/on 与重启：原 generation0 的签名事实不重签，当前 kill generation1/原生停止保留；入账0、隔离1、OPEN Alert2、原协议调用1。独立观察已见成交仍不构成可记账或关闭的权威。记录关联按同一个 command/request/source/ledger/books/report 校验，不能用不同 fixture 的结果冒充同源。

| 义务 | 当前自有单机观察 | 保留的剩余范围 |
|---|---|---|
| L4-CURRENT-SOURCE-01 | 当前 R04/X02/Subject/native 来源关联、旧审批/代次拒绝 | 可信账户资金/marks/估值与新风险评估，实际身份/venue |
| L4-LEDGER-01 | X04→X01→独立观察X05→公共只读Alert/C10，跨kill/C11事实不变 | valuation/P&L/exposure/风险输入快照、完整独立books/marks、异步成交及异币费用、通知/确认/明确审查关闭 |
| L4-NATIVE-CONTROL-01 | 公共全局/账户停止、独立复核后显式解除、当前代次和原生持久停止/C10 | 所有部署账户/跨主机传播、目标在途撤单与停止时延、目标身份/DB/Vault/venue |
| L4-C11-ACTIVATION-01 | scoped/versioned历史、MFA/CAS、租约实际到期、事务后进程死亡、真实写失败与手动原请求恢复 | 实际目标持久化/身份、多账户跨主机传播/外部单调锚点；任意flag/roles/policies/export/stream不在固定执行域范围 |

19项继承gap与8项义务保持OPEN，进展和剩余范围分别记录；不把 owned 实现进展写成目标闭环。159规范阶段和量化分母不变。200 venue mapping、50获准testnet旅程、四项目标演练及目标性能/审计/安全仍按原标准验收，当前代表性样本不替代它们。完整booksReady/dayCloseAllowed/executionAuthority仍false。UNKNOWN仅查询，禁止补发、自动入账、自动关闭、重置nonce或刷新原generation/有效期。

必要验证范围：当前 BFF source/kill/C11/Alert 权限函数、现有9个实际进程用例及新增同源组合断言；P10/P11/P14/P23/C10/default-off/Paper入口7个Chromium用例；相关消费者/契约、评估器负向测试、编译/Clippy/fmt/lint/计划和阶段拒绝。只执行当前组合与直接影响回归，不递归任务Gate/上游全链或全仓F05/F07 campaign，不读取dotenv，不连接数据库或外部服务。

```sh
pnpm assess:core-l4:local docs/audit/evidence/core-l4-controls-local-20261029/attempt-NN
pnpm check:core-l4:local
pnpm test:core-l4:gate
node docs/audit/evidence/core-l4-controls-local-20261029/verify.mjs
```

必须新attempt，冻结源码绑定。package当前入口指向本轮；旧脚本保留原作用域，不能对当前源码执行旧门禁后改绑历史。工程Gate目标 `PASS_L4_CURRENT_COMPOSITION_WITH_PUBLIC_KILL_C11_AND_GAPS`，以实际回执为准；开发评估 `COMPLETED_CURRENT_SCOPE`，完整Gate `NOT_READY_GAPS_OPEN`、stage `NOT_ASSESSED`、formalAccepted=false、runtimeAdmission=DENIED、M5 PREPARED_NOT_READY。正式文稿待用户确认，不自行批准。

首轮冻结0b6aede8的进程检查8/9，原fixture预占/释放端口后由BFF再次绑定发生EADDRINUSE；后续14项NOT_RUN。原attempt-01与日志按hash保留FAIL。修复只使BFF直接绑定OS分配的端口0、readiness报告listener.local_addr，fixture消费已持有的真实loopback地址；不添加启动自动重试、不修改业务授权。修复后的候选独立新attempt验收。

第二轮冻结53f296e1的浏览器6/7，P10/P11切换第二审批人前的导航取消了有状态subjects读取；可信risk/source时钟已推进而检查点尚未保存，后续重载因回退拒绝422。实际断连用例在无保护逻辑下复现同一422；修复后断连/第二人审批及原浏览器旅程通过诊断。持久profile将同一次已派发handler与checkpoint保存放入独立owned task，在客户端丢弃响应后仍只完成原事务；不重试handler、不签发替代Command、不放宽签名/时间单调性。无durable store的profile沿用原请求生命周期。私有临时owner目录的pause-subjects-before-save只用于实际取消窗口注入，没有HTTP入口。浏览器fixture也改用已持有端口并仅记录规范错误码。原attempt-02与剩余4项NOT_RUN保留，最终新冻结源码独立验收。

当前参考C01/F06/自有签名端口/临时mTLS和认证fsync文件+配合OS锁，不能抵抗全目录/密钥/宿主同时回滚，不证明Supabase/Vault/RLS、分布式原子提交或真实testnet。实际身份/目标DB/Vault/venue、完整财务和books、跨主机、外部通知/明确关闭、目标安全/容量/性能/长稳/同SHA CI/发布、完整浏览器/人工无障碍均NOT_RUN。无生产凭据、推送或外部发布。

下一原任务 `CORE:X01 DEVELOPMENT / L4-VALUATION-RISK-INPUT-01`（属于既有L4-LEDGER-01与L4-CURRENT-SOURCE-01，不新增分母）：接当前不可变账本的资金/mark来源、valuation/P&L/exposure与风险输入快照，验证账户/来源/时效/UNKNOWN保留；没有可信mark或已有UNKNOWN时保持风险拒绝。随后由X02消费新快照生成显式新风险决定，X05补齐独立books与通知/审查关闭。目标准入仍独立办理。
