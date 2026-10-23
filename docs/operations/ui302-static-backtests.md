# UI-302 静态检查、回测队列与报告

任务依据前端执行计划 I3 UI-302、C05。功能路由为现有 Strategy Lab 与 `/backtests/:runId`。高保真回测/Release 页面仍属于后续 UI-P07；Release 创建与审批属于 UI-303。

## 操作与事实

1. 保存有效草稿，按 objectVersion 运行静态检查。服务端核对真实受信规则源码、参数、数据快照、研究引用与 S01 校验。202 仅受理；必须有 passed=true、真实版本/版本哈希与资源绑定，检查后再次读取相同 head 才显示通过。编辑后检查失效。服务端拒绝或绑定缺失阻断回测。
2. 显式创建回测：发送 strategyId/objectVersion/dataSnapshotId，服务端再次静态检查并执行实际 S02 适配器。C05 没有全局回测列表/取消接口；队列只列本会话已接受任务，最多25项，不编造进度或全局完整性。已有任务可用 UUID 显式打开，刷新页面只读，不创建任务。
3. 超时/掉线/畸形202/5xx结果未知时锁定编辑、保存和另一类写命令；显式重试复用原幂等键与完全相同意图，不自动重发。429遵守有界冷却。状态在内存；离开前提醒，离开或权限变化清除，不持久化或后台重放。只读 approver 可以读报告，不能检查或创建。
4. 报告通过 no-store GET 和有界 SSE 读取。通知先验证资源/信封/序号，gap从最后确认序号重连，重复不应用，重复撤权仍终止；事件上限2000、帧64Ki字符、idle30秒、最多5次指数退避。应用通知后重新GET事实，终态停止；错误清除可展示报告，显式刷新恢复。C01失效/离线/隐藏/换scope立即清内存。
5. 固定输入来自服务端：snapshot、draft version/version hash/parameter hash、candidate clock/source/image/runtime、input/environment/report hash、fee_bps/slippage_bps与费用/滑点合计。C05 provider新增静态检查资源绑定与 executionInputs.costModel（来自同一受信StrategyInput），报告Artifact一并返回。未修改核心回测报告哈希算法或生成契约；Zod passthrough扩展缺失时前端拒绝成功报告，不从合计反算配置。十进制指标字符串原样呈现。
6. 成功报告必须版本/资源/快照/参数哈希/报告哈希互相一致；后续成功读取不得更换报告内容/指标/成本绑定。前端校验服务端绑定，不声称在浏览器独立复算Rust canonical report hash。泄漏列表非空、核心 violations>0、非成功、输入缺失/不一致或已知版本变化时 Release readiness=false。发布按钮始终禁用至UI-303，回测不等于交易或发布许可；后续提交必须重新读当前草稿/核对有效期。

服务端 current host clock 在执行时固定进 report.candidate.clock，trusted费用/滑点进入核心 input/environment hash；不把浏览器时钟当回测时钟，不声称不同任务输入时钟相同。版本超出JS安全整数的核心报告版本会保守拒绝，草稿u64字符串保存逻辑保留。

## 验证与边界

`node scripts/ui302-review.mjs --run <新attempt目录>` 在冻结完整源码提交执行当前功能/直接影响回归：UI-302、UI-301保存/恢复、P06参数与展示单测，C05 provider测试及核心泄漏/哈希绑定专项，类型/lint/路由、一次必要Rust与Terminal构建、Chromium实际reference流程。`--verify`核对源码、命令、日志与所有产物摘要。开发入场允许，完整INTEGRATION拒绝为预期结果，不递归重跑依赖链。原UI301/P06确认与其incomplete、NOT_RUN保持原候选范围；本轮扫描另记账。

所有服务写入仅reference进程内，身份cookie、loopback TLS/CORS是显式测试替代；真实IdP/MFA/CORS、Supabase/RLS/事务/Storage、持久化恢复、托管rewrite、Firefox/WebKit、人工读屏/native200%、跨OS、远程CI、性能/容量/长稳、完整FEP-3/G3/发布均NOT_RUN。开发状态为IMPLEMENTED_PENDING_ACCEPTANCE，人工确认PENDING，stage_gate=INTEGRATION/NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。下一可执行原任务UI-303。
