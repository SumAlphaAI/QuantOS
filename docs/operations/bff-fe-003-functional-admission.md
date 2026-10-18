# BFF-FE-003 当前功能准入

依据[最新AGENTS.md](../../AGENTS.md)和[分阶段测试规程](phased-testing.md)，BFF003_SCOPE_LOCAL仅授予C03/C04九操作当前本机功能READY。九项直接前置关系保持不变，但不执行旧40节点闭包；A2原完整确认和回执按3f0c9bd5源码/013c20e8回执核对，未改绑为新候选READY。共享输入变化撤回A2独立READY，旧文稿、原始用户答复、失败和证据保留原字节。

`scripts/bff-fe-003-functional-scope.mjs`明列19组命令与选择原因：九操作契约、生成输出、旧门禁拒绝单测；当前Research/reference和live pure authority/scope；R03/R04语义/幂等/Artifact重放；R02审批和snapshot hash/quality/expiry；F08签名注册；实际Runtime→Manager→Python fixture RD-Agent UDS；共享Audit/session受影响的A2两组provider；当前九API真实loopback HTTP及18项401/403；生成consumer、丢响应同键恢复、分页/资源/status/hash绑定、SSE重复/乱序/gap/续传/撤权；types/lint/clippy、原确认负向、scoped gate负向和计划/CI。

首次复现的三项reference缺陷已记录：auditRef未写入C10事实、校验未用reference当前时钟、Artifact metadata与附件canonical hash不同。修复只在reference Research模块；生产持久路径保持其现有F05审计bridge和R03/Storage约束，实际目标未执行。reference默认Artifact明确标注synthetic fixture，无worker完成或私有对象验收宣称。浏览器consumer将附件hash绑定已选metadata，canonical archived bytes由服务端验证，不引入第二套JSON编码。

先提交冻结源码，再用 `make bff003-assess-local ATTEMPT=docs/audit/evidence/bff-fe-003-local-20261018/function-attempt-NN` 记录当前范围。19组正常退出、源码/输入/命令/时间/日志/产物摘要一致且九操作成功及拒绝完整后，事务发布本任务manifest/计划，并执行development、CI、A2原确认、plans四个真实入口；入口失败恢复原manifest和计划。每次使用新目录，保留FAIL/INTERRUPTED，不拼接不同候选或旧READY。

`pnpm check:bff-fe-003:development`、`make bff003-local-check`识别当前scoped回执；强制CI使用`pnpm check:bff-fe-003:ci`校验当前任务disposition和严格内容。旧target/historical入口和research-local闭包回执保留原用途，不能代替当前任务准入。

工具使用固定pnpm10.20.0、公开local-mock白名单、cargo locked/offline单job；Python仅既有.venv的确定性fixture，无网络工具。禁止生产凭据、目标库、私有Storage、本地数据库和外部发布。INTEGRATION/RELEASE分别NOT_RUN，包括真实PostgreSQL/RLS/跨作用域并发、持久worker/lease/恢复、真实Engine授权/隔离、私有Storage、完整UI/API链、部署/性能/长稳/同SHA hosted CI；runtimeAdmission=DENIED、formalAccepted=false。当前完整确认稿待项目用户明确回复；A2原确认不批准当前任务。

冻结0eec7e6a的首轮执行在源码复核发现亚秒有效期缺口后于source-policy步骤安全中断，已完成结果和SIGTERM/INTERRUPTED、启动采样保留，不拼入最终回执。修复将整秒截断改为capture/window-end的完整时间deadline与checked overflow拒绝，新增边界等值、超期1ns和溢出测试；19组范围不扩大，用新源码/新attempt独立记录。
