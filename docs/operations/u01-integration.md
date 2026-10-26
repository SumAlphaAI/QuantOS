# U01 Web 壳、认证与 Research 本机组合验证

本次按主计划第 9 节 CORE:U01 执行，代码直接在 main 迭代。复用已有 Next Web、typed client、P01–P05 与 App Shell，修复真实 Research 页的小屏风险动作缺口；没有重跑历史上游准入或修改历史确认。当前功能开发完成，完整 INTEGRATION 与 RELEASE 分别保留，不能将本机测试宿主当作目标业务部署。

## 实现与受影响路径

- P03 使用既有 `useDesktopOperations`，小于 768px 时隐藏创建入口和创建表单；首次媒体查询生效后才加载创建快照。P04 隐藏取消及未知结果重试入口，缩屏时关闭已经打开的取消确认框。
- Research runtime 与 detail runtime 在写入的每次权限检查中重核屏幕条件，包括读取 C01/C04 后、POST 前的异步窗口。已发出写入后若缩屏，仍保留已知受理回执，避免把它丢失后引导重复提交。读列表、详情和证据继续可用；放大屏幕或恢复连接不会自动发送业务写入。
- reference C04 的实际 worker Artifact 现在返回可定位的 evidence 成员；与 live adapter 共享原有确定性 ID 转换，算法不变。产物成员和 hash 来自实际 R03 record，未使用页面代理替换完成状态或伪造产物。
- `services/bff-gateway/src/u01.rs` 仅在 `cfg(test)` 编译。它读取 reference C03 已受理意图，经受控独立 loopback 端口调度真正的 `ResearchWorkflowCoordinator`、运行时、快照质量门禁、EngineManager 与仓库内 RD-Agent Python UDS 进程。完成后将真实 record 交给 reference C04/C03 查询及通知，增加完成审计。浏览器只通过 typed API 消费事实。测试控制不能提交终态或产物载荷。
- 为避免虚报持久队列，本宿主明确记录 `bffRunId → workerRunId`。C03 意图存储、C04 仓库、身份 cookie 桥、自签 TLS/CORS 都是自有端口替代。该测试适配器不是生产路由，也不证明 live PostgreSQL/Storage 已执行。

## 必要验证与证据

手工入口：`node scripts/u01-review.mjs --run docs/audit/evidence/u01-local-20261026/attempt-N`；复核：`node scripts/u01-review.mjs --verify`。执行器只从环境白名单和仓库 public 示例构造配置，不读取私有 dotenv；不继承 DATABASE_URL、Supabase 凭据或交易/provider secrets。Cargo 和包管理器使用离线依赖。浏览器仅允许 localhost/127.0.0.1，宿主 API 和控制端口仅监听回环。测试自有进程组在结束时关闭。

源码必须先提交；执行器核对 Git 中的完整候选 SHA 与所有实际输入摘要。每组记录命令、时间、退出码、信号、日志 hash；manifest 绑定全部产物。后续证据提交不会把候选结果改绑为新 HEAD。原探索失败目录保留为未冻结工作区诊断，不能作为候选 PASS。

| 检查 | 当前范围与原因 |
| --- | --- |
| bff lib 编译、research tests | 验证共享 evidence ID、C03/C04 schema、幂等、质量、权限和审计路径 |
| auth_settings_provider | 实际 BFF 身份、CSRF/MFA、撤权与安全恢复直接回归 |
| quantos-runtime research 单元 | 当前消费的调度、取消、deadline、产物完整性边界；不等于 Web 全组合恢复 |
| UI201/UI202/research-gateway/auth-bff/auth-poc/UI203 | 当前消费者创建、取消、异步缩屏拒绝、OIDC/PKCE 状态、产物关系与 hash |
| Chromium 五场景 | Web 创建→真实 worker→通知→终态重读→Artifact/Evidence/Snapshot/Audit；排队取消→实际 runtime 取消；断连显式恢复无写入重放；390px 隐藏与缩屏关闭弹窗；P01–P05 noindex；实际 reference MFA 成功/拒绝与壳导航；身份及质量拒绝 |
| Terminal build/typecheck、定向 lint | 真实 Next 静态导出、客户端凭据扫描与编译检查 |
| 计划/执行门禁与负向校验 | 状态一致、缺证据不能放行，拒绝提升边界、缺失/跳过/不稳定浏览器场景 |

该矩阵按实际变更路径选择，不执行全仓测试、三轮构建、历史 Gate 闭包或 F05/F07 数据库/覆盖率 campaign。每次开发调试构建均是因新代码变化需要，不能计为三轮冻结发布验收。

## 状态与边界

工程结果以 [当前证据目录](../audit/evidence/u01-local-20261026/) 中的 receipt、命令日志及报告为准。工程 Gate `PASS_OWNED_LOCAL_U01_COMPOSITION` 仅代表上述本机组合；U01 `development_status=COMPLETED`，完整联调 `PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS`，stage_gate 保持 `INTEGRATION/NOT_ASSESSED`，汇总结论 `NOT_READY_GAPS_OPEN`。formalAccepted=false、runtimeAdmission=DENIED、发布 NOT_RUN。不自行批准用户验收。

仍须在原 U01/TP01/R1 及发布范围收口：持久 C03 HTTP→R03 队列及 C04 Storage；运行中取消、deadline 与进程重启后的 Web 组合恢复；真实 OIDC/MFA/Cookie/CORS；完整浏览器及人工可访问性检查；全仓联调；Supabase/实际外部目标、性能/长稳/部署和同 SHA 远程 CI。底层取消/deadline 单元通过不能代替这些组合用例。历史 G2 页面确认与 incomplete 只保留原候选范围，本次没有将其关闭或重绑。

下一原计划任务为 CORE:TP01（研究 workflow/工具/MCP/记忆 UX 参考与受控 Fork 总项），可按现有 DEVELOPMENT 入口推进当前功能及直接影响范围；CORE-GATE:R1 与 G2 的正式联调准入仍独立拒绝。没有执行推送、部署、外部发布或生产凭据动作。
