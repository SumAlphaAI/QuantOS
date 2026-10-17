# TP07：Paper内核与X03下游单次消费

2026-10-17。基线`66e1ea4d2954a0db797865421aa0beadf8566feb`，本轮功能证据源码`37922e3d5ad8fd4a9ec7d207f4c5f148d839a037`，149个精确输入。**TP07_LOCAL / DEVELOPMENT READY（功能范围），engineeringStatus=PASS，formalAccepted=false**。14组当前功能/直接影响检查全部PASS；两份计划同步IMPLEMENTED_PENDING_ACCEPTANCE。自有Paper真实进程已经执行，真实Nautilus未安装/执行、runtimeAdmission=DENIED；完整业务联调、发布和26组目标NOT_RUN，ProjectUser确认PENDING。

## 实现与验收

| 要求 | 实现与当前证据 |
| --- | --- |
| X03下游权威 | 新`dispatch::SignedExecutionGateway`/服务`X03CommandService`只接收SignedCommand与可信AuthContext/CurrentSources；复核exact stored HMAC、账户身份、Consumed审批、当前X01/S03/财务/venue风险和有效期 |
| 原子当前检查/kill | 固定downstream→issuer→risk锁；同一risk临界区覆盖当前复核和内核调用，kill CAS不能插入其中；每次缓存重放也检查安全状态 |
| 幂等与异常 | scoped tenant/workspace/account/key绑定完整命令；克隆共享dedupe；issuer command→consumer claim阻止独立网关再次消费。调用前预留Uncertain，错误可能已提交，保持claim并禁止重投/fallback |
| 1000并发单提交 | 1000逻辑任务在16个Tokio worker同时释放，只得到一个order和一个内核调用；真实Paper进程另执行1000次重放，只有一个下游提交/Fill。不是1000独占OS线程或P95验收 |
| 真实Paper进程 | 自有服务`--tp07-paper-kernel`，有界stdio/64KiB帧/schema/backend/PID握手，清空环境、0700私有cwd、1秒以内且不超过命令剩余期限的请求预算；超时/崩溃/异常回包关闭回收并隔离 |
| 内核隔离/可替换 | 自有ExecutionKernel/BoundaryCommand/Nautilus wire；只传opaque command ID及订单wire，不传用户/Agent/session/审批/签名/风险/密钥。核心没有Nautilus包或类型，Paper为默认替换路径 |
| Order/Fill映射 | 真实Paper accepted/fill；拒绝保留reason；partial fill Decimal累计数量/加权均价，重复fill去重；整批校验后提交，未知命令/venue、过量/非法数值、越期和冲突事件回滚并隔离 |

原legacy checksum/F06探针路径明确保留为合成兼容，不构成新签名消费入口。没有新增公开订单HTTP、UI或venue连接。部署身份、会话撤权、观测时间和当前来源由可信后端解析；env_clear与独立进程不证明OS文件/出网/用户级沙箱。握手在交易锁外有60秒启动预算，交易锁内请求有界；原kill与签发P95目标没有降低，真实调度/负载延迟仍未验。

[操作规程](../operations/tp07-local-admission.md)、[边界ADR](../adr/20261017-tp07-paper-dispatch-boundary.md)、[许可ADR](../adr/20260731-tp07-nautilus-license-compliance.md)和两个组件README均已同步。切换内核只适用于新命令，结果不确定时禁止以“未收到回包”为理由重建网关或改投Paper。持久对账/消费移交与完整OMS取消/append-only事实属于后续X04及部署验证。

## 按影响范围测试

遵守最新AGENTS.md：没有全仓、三轮独立构建或递归上游复验。`tp07-test-scope.mjs`逐组记录路径与选择原因，`record-tp07-local.mjs`保留真实源码、输入、命令/时钟/预算/错误/信号/超时和日志摘要，成功后事务写入专用manifest与两份计划。SIGINT/SIGTERM记录INTERRUPTED，不记PASS。[14组原始结果](./evidence/tp07-local-20261017/function-attempt-01/execution-results.json)、[输入](./evidence/tp07-local-20261017/function-attempt-01/inputs.json)、[manifest](./evidence/tp07-local-20261017/manifest.json)、[摘要](./evidence/tp07-local-20261017/summary.json)。

实际非覆盖率重复计数的Rust：76 passed / 1 ignored；其中TP07消费8、进程协议4、兼容56、X03回归8。ignored为原发布性能用例，不算目标通过。专用Gate 65项和计划负向44项，共109 PASS。必要编译、Clippy无warning、fmt、计划/移交与上游排除静态检查均通过。没有RiskGuard代码修改，不重跑整条X02及上游闭包；当前风险和X03审批行为由实际TP07模块组合及8项原X03回归验证。

LLVM文件指标：authority.rs 行96.72%/region91.91%；gateway.rs 行95.62%/region94.17%；dispatch.rs 行97.78%/region94.44%；process_kernel.rs 行94.78%/region93.21%，均达到开发≥90%行/≥85%region阈值；gateway/process文件包含其编译的内嵌单元测试，不宣称全仓或分支/目标覆盖率。见[原始覆盖率及回执](./evidence/tp07-local-20261017/function-attempt-01/coverage/receipt.json)。产品子进程清除环境导致首轮进程采集不足，新增测试专用直接协议探针只传LLVM_PROFILE_FILE；产品清理不变，真实native子进程的执行与采集分别有证据。

## 历史、失败与版本边界

[开发记录](./evidence/tp07-local-20261017/preflight/history.json)保留：legacy TradeCommand序列化和BufRead reborrow编译失败；审计fixture缺owner scope的6PASS/1FAIL；计划编辑API/字段名错误；首轮process覆盖65.61%/61.67%的原始数据。逐项修正后原范围重测通过，没有放宽权限、数值或覆盖率阈值。最初Paper测试启动的自动权限审查超时，命令NOT_STARTED；按返回许可仅重试一次，随后正常执行成功。超时不被描述为安全否决或测试PASS。

X03原manifest/日志逐字保留，仅独立stage_gate因authority/gateway输入变化撤回NOT_ASSESSED，见[撤回记录](./evidence/tp07-local-20261017/x03-admission-withdrawal.json)。本轮8项X03回归仅属于TP07影响范围，未改绑为X03新候选独立READY。更早失败/中断和637文件保全记录不被改写。TP07的依赖仍按原任务图并显式增加X03，回执依赖行NOT_REVALIDATED/referenceOnly，不授予上游READY。

本轮后续文档/证据提交仅登记上述源码和精确输入，不宣称新HEAD已重新测试。完整[变更文件索引](./evidence/tp07-local-20261017/changed-files.json)与[收尾检查](./evidence/tp07-local-20261017/post/checks.json)供核对；没有因元数据提交再触发功能或上游全量复验。

## 未决、Gate及下一任务

真实Nautilus bridge/API/固定候选运行、LGPL分发法律/notice/source/替换义务、完整运行时SBOM与最新漏洞可达性仍NOT_RUN。离线评估器只核对1051包与56个advisory ID的历史快照及无运行时导入，不能称当前漏洞清零或法律许可。自有Paper模拟执行和Nautilus-style wire验证不构成真实上游运行。

进程内claim/dedupe/审计与投影不替代Supabase/RLS持久事务；独立issuer、重启或副本不共享记录。持久崩溃恢复、不确定提交对账/消费移交、真实会话/身份/时钟/来源撤权、生产密钥托管、OS文件/出网隔离、完整业务联调、原P95/安全/负载/长稳与同SHA hosted CI等26组目标保持NOT_RUN。继承X02/X03的f64风险估值、单报价单位和保守gross假设，不宣称完整财务模型验收。当前仅Paper/Shadow LIMIT；完整OMS取消、append-only持久事实和规模验收归X04。

[六维项目用户确认稿](./evidence/tp07-local-20261017/confirmation-draft.md)为PENDING，依据一人确认规程保存真实用户答复后再独立执行正式门禁，Codex不自行批准。`--ready`仅功能范围；`--release`缺实际目标和正式确认时拒绝。未使用生产凭据，未连接目标数据库、未创建本地PostgreSQL/Supabase、未推送或外部发布，仅修改QuantOS。

下一可执行：**CORE:X04：Nautilus边界、Paper OMS与订单状态机**，补齐提交/取消审计、append-only订单事实和10万事件合法转换，继续按当前功能与实际影响测试。TP12完整复审依计划仍在TP07完整业务联调后，当前不将Paper功能READY冒充其前置联调已验。
