# FRONTEND-GATE:G7：Paper/Shadow 全业务链组合与缺口评估

本次 I9 评估在 main 进行，仅修改 QuantOS。工程 Gate `PASS_G7_OWNED_LOCAL_SEGMENT_COMPOSITION` 只覆盖冻结源码的实际本机模块组合及拒绝/恢复矩阵；G7 为 `NOT_READY_GAPS_OPEN`，review_status=IN_REVIEW，INTEGRATION stage_gate=NOT_ASSESSED，Beta 功能候选 NOT_READY，formalAccepted=false、runtimeAdmission=DENIED。没有本会话用户正式确认，不生成确认回执。

## 组合范围和直接回归

Paper、Shadow 各启动一个独立 Rust reference BFF，同一模式的业务段和页面导航共享该进程。身份为明确注入的参考 Cookie；浏览器使用 loopback TLS/CORS 代理。不是实际 IdP、生产数据或目标数据库。

- 两个模式：C01→C02 快照→C03 研究申请/取消及 C10；C16 告警→同源 C11 Incident 创建/确认→Owner 治理→独立 Operator C10 回链。Viewer 拒绝访问，ack 不代表解决。
- Paper：独立种子策略 C05 Draft→Backtest→Artifact→不可变 Release→独立 Approver MFA/reauth→批准→前端目标选择；另一个种子 Proposal→风险→独立审批→C09 accepted Order→cancelled→审计。无实际成交，不制造 Fill；Paper Performance 正确拒绝。
- Shadow：C05 正确拒绝；C15 实际账本快照→C14 三投影和精确来源核查→固定版本报告→校验原始下载字节→C10；保持 PROVISIONAL。
- R03 Worker→UDS→注册→20 条策略/回测/Release/审批因果链和静态拒绝恢复，使用既有 owned 原生夹具重新执行，单独记录来源；并非 C03 HTTP 队列出队证据。
- 直接回归选择研究/策略、FEP5 丢失回执与幂等、G4 行情/图表/Performance 来源与恢复、G6 权限撤回/治理标志/事件/审计。执行 BFF execution 和 operations 原生测试；不递归复验全部核心/Provider，不运行数据库 campaign。

本次没有产品运行代码修复：预检错误位于新测试中，原始失败日志和失败页面保留在 preflight 目录，不能计为 PASS。若正式 attempt 失败，保留 failure.json 和 NOT_RUN 清单，源变更后重新提交并使用新 attempt。

## 全链尚未接通

[机器可读缺口清单](../execution/frontend-g7-assessment.json) 是本次范围记录，既有 followups 文件不变。研究 HTTP run 在 reference 中 queued，后续显式取消；不能把独立种子策略或 owned Worker 的成功当作该 run 的产出。获批 C05 Release 与 C07 signal.strategyReleaseId 不同，目标选择仅是前端状态，没有已验证的 Release 激活→同源 Proposal。Paper mock Order 无 Fill；不能连接不同模式的 Shadow 账本。C15 异常→C16 匹配告警未提供。这些是 G7 全链正向缺口，禁止拼接 ID 或放宽模式/权限来制造成功。

保留 G4/FEP-4 的 marker 匹配源、K线/图片受控导出、C12→C14 估值来源缺口；保留 G6/FEP-6 的 UI601 InspectEvidence/resolve HTTP 正向、P13 七服务独立健康/历史、P14 完整元数据/审批历史/成员导出/持续流。通知只证明应用内有限 SSE，不证明 OS 后台推送。CORE:X06 完整闭包、11 项 G7 依赖及 159 项阶段 Gate 均不借此提升。

## 基线与未执行项

receipt 的 baselineReferences 绑定 G1/G2/G3、G4/FEP4、FEP5、G6/FEP6、P19/P21/P14 原文档和源 SHA，仅 ORIGINAL_SCOPE_ONLY。当前 Chromium 18 个功能用例含两条新模式旅程；不是完整兼容性或视觉验收。当前两个 Audit axe 扫描保留 incomplete；历史 P14 color-contrast incomplete、历史失败、BLOCKED/NOT_RUN 全部保留。截图只用于当前旅程复核，不重绑旧高保真矩阵。未作数值性能/容量/长稳测量，构建耗时不能充当性能基线。

实际 IdP/Cookie/CORS、Supabase/RLS/事务/持久化审计、跨进程重启恢复、外部行情/venue、同 SHA 远程 CI、Firefox/WebKit/跨 OS、手工读屏/原生200%缩放、完整视觉/性能/容量/长稳及 RELEASE-GATE:BETA 均 NOT_RUN。未使用生产凭据，不推送、部署或发布。

## 重现和证据

先本地提交源码，再使用新 attempt：

```sh
node scripts/frontend-g7-review.mjs --run docs/audit/evidence/frontend-g7-local-20261024/attempt-NN
node scripts/frontend-g7-review.mjs --verify
node scripts/development-execution.mjs --integration FRONTEND-GATE:G7  # 预期 exit 1，保持拒绝
```

工具使用限制环境、离线 Cargo、固定 pnpm、本机 BFF 与 Chromium；记录输入/二进制/静态构建/HTTP 请求响应哈希、每条命令和错误、历史文件哈希及原范围来源。真实目标/CI 不借本机证据代替。下一原任务 `FE:FEP-7`，可开展前端范围收口与 Beta 缺口评估；不得提前声称 Beta READY 或关闭上述缺口。
