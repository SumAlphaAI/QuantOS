# CORE-GATE:X3-SERVICE 本地服务功能准入

本检查点为 DEVELOPMENT 下的受控真实服务组合。固定数量/价格/开仓基准和手算期望见 `services/execution-gateway/tests/fixtures/x3-service-golden.json`：Paper实际X03命令→SERVICE:X06→X04事实/Fill→X01仓位；独立ShadowRunner从相同开仓基准计算Decimal虚拟订单/Fill/仓位/现金。测试只对单一账户/品种/方向/数量案例作显式一一身份映射，禁止复制Paper财务结果当作Shadow期望。Paper和Shadow使用不同command_key命名空间，保留RiskGuard同key冲突拒绝。随机合法作用域/实体ID不作跨运行一致性声明。

`make x3-service-check` 执行当前5项聚合行为；`make x3-service-assess-local` 只在已提交候选上执行 `scripts/x3-service-test-scope.mjs` 明列的17组检查，不调用历史依赖Gate。所有结果绑定同一源码和当前输入，在新function-attempt-NN目录保存原始日志、时间/退出码/信号/超时和LLVM数据。最小子进程环境剔除数据库/secret/token及目标开关，全部Cargo离线。

20类差异在真实组合产生的账本上逐类注入，检查实体/来源、未证明关闭拒绝、ack/新修复源/CAS、关闭后复发重开和日结撤销；合成时钟不算实际15分钟检测SLA。并发32次命令重放与32次同key对账保持唯一，验证同gateway租约服务实例重建、本地journal恢复无新增submit/cancel；未知结果和跨进程恢复另按现有服务契约隔离。

Paper零费用USD标签与USDT基准不构成FX，因此适配器只在非零费用时要求quote相同；非零异币、伪造/截断事实anchor、篡改仓位仍拒绝。新LLVM证据要求实际聚合测试执行费用解析/guard/拒绝三处修复行，并由正/负行为测试证明语义；整文件指标仅供参考，不虚构分支覆盖或性能通过。继承X01 f64/固定quote边界，不宣称精确会计。

`make x3-service-local-check` 校验同源码、完整命令/日志/行为、独立来源、黄金数值、20类闭环、修复行覆盖、阶段及发布移交，并验证计划manifest摘要。九项直接依赖仅NOT_REVALIDATED/referenceOnly，单任务READY不复授；历史失败/回执保留原范围。共享Cargo/adapter/门禁输入变化撤回SERVICE:X06当前独立READY，历史原件不变。

本地服务组合PASS不等于INTEGRATION完整业务链与全仓验收；CORE:X06/G4/G5/G6真实页面/BFF、TP07实际集成后的TP12完整复审另验。真实Supabase会话/MFA/RLS/持久事务/outbox、跨进程/跨实例恢复、市场/财务/对账源、凭据/OS出网隔离、10个实际交易日Shadow、真实日终未解释差异=0、负载P95/部署演练/安全/长稳/同SHA CI及继承目标全部NOT_RUN。Shadow无内核句柄/submit API；Paper仅自有内存/本机stdio进程；静态与计数证明限此范围，不是目标OS隔离证明。

`make x3-service-release-check` 与 `node scripts/x3-service-target-check.mjs` 必须exit2。用户确认按 [统一规程](../gate-records/user-acceptance-confirmation-workflow.md)，Codex只拟稿，正式确认PENDING；不授权生产凭据、venue或外部发布。下一可执行任务须按计划前序、现有状态与实际消费者范围决定。
