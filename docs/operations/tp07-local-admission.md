# TP07功能开发与本机Paper操作

依据最新AGENTS.md，运行`make tp07-assess-local`，默认新证据路径为`docs/audit/evidence/tp07-local-20261017/function-attempt-01`；重试必须换新`function-attempt-NN`。`record-tp07-local.mjs`只运行`tp07-test-scope.mjs`的14组检查，每组记录实际变更影响理由。没有全仓、三轮构建或递归上游验收，也不改写canonical历史产物。

测试包括：真实X03签名/审批/当前风险模块消费、1000逻辑任务/16worker并发单提交、独立网关所有权、kill竞争与不确定结果隔离；自有Paper真实子进程/严格帧/超时/崩溃/错误回包、Wire重放；变化的gateway/service兼容与X03回归；必要编译/Clippy/fmt、四个核心文件覆盖率、专用门禁反例、计划与移交以及固定上游仍被排除的离线检查。没有RiskGuard实现变更，不递归跑X02或更早任务；当前风险行为由TP07实际消费与X03回归覆盖。

`make tp07-local-check`验证已登记的功能输入和证据；`make tp07-release-check`在实际目标与正式确认缺失时必须拒绝。功能DEVELOPMENT READY、完整业务联调NOT_RUN、发布NOT_RUN分开记账；手工确认稿仍需项目用户真实回复，Codex不自行批准。

可信后端使用`services/execution-gateway`导出的`X03CommandService::new(issuer, limits, kernel)`，随后调用`submit(auth, signed_command, current_sources, observed_at)`。观察时间、身份和来源必须由可信后端新鲜解析；该API不接收客户端身份断言，也不公开HTTP路由。内核可选自有`PaperKernel`或`PaperProcessKernel::spawn(absolute_binary, request_timeout)`；交易IO预算为1秒以内，不能超过命令剩余期限。正常构建与本机启动示例：

```sh
cargo build --locked --offline -p execution-gateway
# 由可信网关通过专用stdio启动；不要把用户shell/Agent/session接到该通道。
target/debug/execution-gateway --tp07-paper-kernel
```

Paper backend只接受QuantOS自有LIMIT/GTD模拟wire，不访问数据库、模型、网络venue或secret resolver；stdin EOF后退出。父网关记录权威Order/Fill与提交状态，内核只模拟执行。`env_clear`及私有工作目录是本机工程措施，不能冒充目标OS出网/文件/用户权限隔离。60秒启动握手发生在交易锁之外；交易期间downstream→issuer→risk锁与kill CAS线性化，真实调度/kill延迟目标另验。

任何结果不确定、协议/事件异常都隔离；不可自动重投、重新建网关或切换Paper兜底来绕过claim。边界前拒绝可以纠正后重试，因为没有产生下游调用。持久恢复、跨进程对账/消费移交与完整OMS取消审计仍需X04及实际部署证据。

上游Nautilus仍是固定版本参考，未安装/执行；不能将自有Paper测试记成真实Nautilus验收。全部继承目标和新增TP07目标（26组）保持NOT_RUN，原性能数值、法律/供应链、Supabase/RLS持久分布式幂等/审计/恢复、身份与来源/时钟、部署OS隔离、安全/负载/长稳及同SHA CI保留。详见[边界ADR](../adr/20261017-tp07-paper-dispatch-boundary.md)。
