# X04 功能开发与 Paper OMS 操作

本轮仅 QuantOS，采用 [分阶段测试规程](phased-testing.md)。`scripts/x04-test-scope.mjs`列出16组实际当前功能/直接影响检查及reason；不运行递归依赖、全仓或三轮构建。X03签发、TP07并发消费/风险/claim、进程协议与相关包兼容是本轮源码变化的直接回归，不构成重新验收上游Gate。

`make x04-assess-local`默认写入全新`docs/audit/evidence/x04-local-20261017/function-attempt-01`；重试向`node scripts/record-x04-local.mjs`传新的`function-attempt-NN`，不得覆盖失败。记录精确源码/本地编译依赖输入、HEAD、原命令、时间、退出码/信号/超时、日志与coverage摘要。全部正常完成、输入不漂移、变更文件覆盖率达标后，事务发布独立X04 manifest和两份计划的阶段状态。源码改变使TP07旧独立READY撤回，旧原始证据保留；不能拼接历史READY。

门禁入口：`make x04-check`运行主要功能与直接回归；`make x04-local-check`重新验证已发布事实、原始日志、精确输入和覆盖率；`make x04-release-check`在实际目标矩阵和正式确认不足时拒绝。X04_LOCAL只允许`functionImplementation=PASS`，完整业务联调和发布保持NOT_RUN。16组内含：9个OMS用例（其中20,000订单产生100,000条混合kernel事件），3个真实Paper进程用例，TP07的8+4个直接回归，X03的8个回归、相关包单元/必要编译/Clippy/fmt、六个变更文件的覆盖率、专用门禁反例、计划/交接及离线上游边界检查。具体数量以当轮原始结果为准，新增反例会更新清单。

可信服务调用`submit(auth, signed_command, current_sources, now)`，取消调用`cancel(auth, signed_command, stable_cancel_key, now)`；查询`order_history`仍需相同身份和签发绑定。可选择`PaperKernel::resting("100")`或`PaperProcessKernel::spawn_resting(absolute_executable, timeout≤1s)`模拟挂单。默认Paper即时成交维持TP07行为。受控本机可通过`target/debug/execution-gateway --x04-paper-resting-kernel`运行协议backend；真实服务在访问任何数据库环境前处理此固定参数。禁止把用户shell/Agent连接到stdio或将凭据填入请求。

每次取消有稳定关联ID；相同键返回原审计，不增加下游调用。Command过期/kill开启仍可取消已归属订单，但提交继续拒绝。取消Uncertain或异常事件隔离后，禁止换键、换进程、切换内核自动重投；留给X05及目标持久对账恢复。可序列化订单事实和独立anchor，使用`ExecutionGateway::replay_facts(facts, anchor)`验证完整日志；可信anchor须与日志分开保存，重放不授予执行权限。

验收维度分开记账：本地合成10万事件全部合法与Fill溯源不等于目标性能、真实Nautilus或持久DB验收。继承26组及X04新增1组目标（共27组）全部NOT_RUN；目标10万事件、cancel审计、数据库/跨实例恢复、完整Paper/Shadow业务链、安全/性能/长稳、同SHA hosted CI和正式用户确认由INTEGRATION/RELEASE-GATE:BETA落实。正式确认依[用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)保存真实答复，执行任务请求不等于批准验收稿。

边界、状态矩阵、异常与未决风险见[X04 ADR](../adr/20261017-x04-paper-oms-facts.md)。
