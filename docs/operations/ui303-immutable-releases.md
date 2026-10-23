# UI-303 不可变 Release、审批申请与目标选择

任务依据前端执行计划 I3 UI-303，C05/C08；路由 `/releases`、`/releases/:releaseId`，创建入口位于实际 `/backtests/:runId` 成功报告。UI-P07高保真、后续审批决策工作区、部署和交易不属于本功能。

## 固定内容与服务事实

- 成功回测不自动创建Release。先读取同一保存版本的草稿、无泄漏报告与报告Artifact，核对strategy/version/snapshot、参数原类型、report/parameter/environment hash和研究证据。创建前重读并与已展示固定输入比较，漂移拒绝，不悄悄提交新版本。
- POST `/v1/releases` 仅发送strategyId/objectVersion/backtestRunId/parameters；不发送自选targets、客户端许可或审批结论。服务端执行实际S04不可变创建。页面展示contentHash、源/镜像/参数/报告哈希、保存版本、snapshot、回测与Artifact、研究证据；不提供修改Release接口。草稿变化须重新回测/创建。
- C05添加server-owned name/draftObjectVersion/backtestRunId/backtestReportHash/evidenceRefs及可解析C08 approvalRef，均取自实际core结果/host记录；不改核心Release内容哈希算法或生成契约。扩展缺失时前端保守拒绝，不生成缺失证据。报告Artifact的服务端contentHash用于绑定，前端不声称独立复算Rust canonical哈希。
- Release目录按后端排序/游标分页，本地不推断全局完整性。详情no-store读取Release、绑定回测，存在approvalRef时再读C08，要求对象、类型、状态、有效期一致；策略审批不接受TradeCommand引用。已读不可变内容、allowedTargets和创建时间不能变化；有效期只允许收窄，状态/时间线可由服务端更新。

## 审批与目标

- 只有strategy.write身份可提交申请。POST approval-submissions携带If-Match=Release objectVersion/contentHash、CSRF和原幂等键。202仅受理；随后读取真实C05/C08状态，不当作批准。已pending/approved/rejected/expired不再次申请。时间线只显示服务端actor/time/correlation，链接实际Audit Explorer，不伪造签名或独立审批人。
- 申请与决策分离。本页没有审批决策、MFA代填、自批、部署或交易端点；独立审批决策留给后续工作区。浏览器验证通过**明确标记的本机reference测试控制**以另一actor执行fixture MFA/reauth/决策，验证已批准展示；该测试控制不属于产品UI，也不是生产身份验收。
- 目标选项完全取自后端allowedTargets，不提供paper/shadow默认回填。必须已批准、未过期、C08与报告可读且目标受当前Paper/Shadow范围支持；空数组、重复、缺失、assisted_live、未批准/到期/权限变化/请求错误均不授予可用目标。选择只在当前页面内存，不产生命令或部署请求；后续执行须再次核对服务端权限、目标和有效期。

## 拒绝与恢复

创建和申请共享同步busy与单一写意图锁；重入拒绝。网络/超时/5xx/畸形成功响应导致结果未知，锁定原资源/版本/参数与键，只能显式重试原意图；即使重试C01预检失败也不丢失恢复键。不自动重发，不用刷新创建新键。明确401/403/409/422/429拒绝不自动重试，429有界冷却。202已受理后若事实读取失败保留受理引用，刷新只读，不再自动提交。

C01会话/工作区/capability/mode、有效期、线上状态由既有route monitor约束；失效、隐藏/离线、换scope立即清内存，恢复后显式读取，不重放写入。未知请求离开前提示；内存键不落本地存储。只读approver能查看证据，不能创建或申请。渲染保留金额字符串，不执行草稿代码。

## 有界验证

`node scripts/ui303-review.mjs --run <新attempt>` 冻结完整源码后执行UI303与直接影响UI302/UI301/P06单测、实际生成consumer、C05/C08 provider成功/拒绝/审批/过期/幂等专项、types/lint/routes、一次必要Rust/Terminal构建和Chromium流程；`--verify`复核源码、命令、退出码、原始日志/报告/截图/产物摘要。UI507只读引用其原确认范围；不递归重验完整上游或运行全仓/数据库campaign。预检失败保留，不能作为冻结候选通过。

DEVELOPMENT功能门禁与完整INTEGRATION、发布分别记账。stage_gate INTEGRATION/NOT_ASSESSED；formalAccepted=false；runtimeAdmission=DENIED。实际IdP/MFA/Cookie/CORS、Supabase/RLS/事务/Storage、目标持久恢复、托管rewrite、Firefox/WebKit、人工读屏/native200%、跨OS、同SHA远程CI、性能/容量/长稳、完整FEP-3/G3联调/发布及UI-P07高保真全部NOT_RUN。UI302/P06/UI301历史确认只绑定原候选；保留各自incomplete与全部NOT_RUN。下一原任务UI-P07。
