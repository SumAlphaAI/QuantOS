# FE:BFF-FE-008 完整确认稿（待项目用户确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:BFF-FE-008",
    "stage": "DEVELOPMENT",
    "sourceCommit": "b20efc3054c51933a706b8ac4132dd4316b5c71d",
    "inputsDigest": "sha256:ed19be79c4d9b2d7ca665ad6c497c31e6528b09127fd768b436a8a4a4c4efa28",
    "reviewDimensions": [
      "Product",
      "Frontend",
      "BFF",
      "QA",
      "Security",
      "Risk"
    ]
  },
  "reviewDimensions": [
    "Product",
    "Frontend",
    "BFF",
    "QA",
    "Security",
    "Risk"
  ]
}
```

项目用户一人确认六维度，目前PENDING，Codex不代批。仅冻结源码b20efc3054c51933a706b8ac4132dd4316b5c71d和1109项输入、原始日志与技术回执，不批准之后HEAD、完整业务联调或发布。formalAccepted=false、runtimeAdmission=DENIED。

Product：C14八API当前复核完成，绩效summary/series/attribution与report create/status/get/grant/content可用；USD/simple、实际X01/C15版本、P&L/费用/回撤/归因及缺覆盖/未对账强制provisional保持，202仅queued，不乐观生成已对账事实。没有浏览器改账/估值/closure或venue执行。

Frontend：OpenAPI1.12.0共132操作/110schema与六类生成产物精确一致。46项consumer/契约、7文件通过，生成client丢回复恢复、报告字节hash/size、版本与12个新增schema-valid状态/时间/审计/替代关系负向探针通过；文档重新计算hash也不能绕过授权元数据绑定。reportVersion固定1已由schema限制，不虚构原版本漏洞。helper行/关键分支100%、一个基本Chromium通过；完整P21/G4/FEP4链NOT_RUN。

BFF：报告到期后的旧票据清理释放1000配额，新报告可下载；活动报告60秒已知票据仍410，15分钟旧报告仍410，原queued回执可按原键恢复，历史jobs/replays不删除。容量1000/429与到期恢复通过；受控时钟不作为性能验收。原冻结worker、单次materialize、独立身份/角色/能力/会话/源版本与poison隔离不放宽。Rust57项：C14 10、C15直接18、Auth/audit 29通过。

QA：1109输入、15组及6实际入口PASS；Node173、consumer/契约46，八API/146条HTTP、100原键重试、真实下载proof和Chromium通过，26控制点；本轮function-attempt-01独立完成，不拼接历史PASS。54,236份原audit/gate字节保持，历史失败/中断不改写。

Security：C15本会话原稿CONFIRMED仅限007040fd/1e1ca813；A4原确认仅限1297bc3b/4085bdef。五前置referenceOnly/NOT_REVALIDATED，独立当前Gate均NOT_ASSESSED；只本任务BFF008_SCOPE_LOCAL DEVELOPMENT READY。F06身份不改，默认live无可信双host503；真实Auth/MFA/RLS/Storage及审计持久性NOT_RUN。不使用生产凭据、无push/部署/外部发布。

Risk：sample/job/replay进程内1000上限与活动报告ticket配额保留；长周期partial与采样间未观察峰谷不推断，沿用X01 f64、固定quote/异币费用拒绝，不声称Decimal提升上游精度。真实feed/用途许可/连续Paper-Shadow业务、持久跨实例/重启worker恢复、C16通知、完整UI、安全/性能/长稳/部署和同SHA hosted CI/正式发布全部NOT_RUN，runtimeAdmission=DENIED。

全图1 READY/158 NOT_ASSESSED；完整业务联调/发布NOT_RUN。依据：[本轮报告](../../BFF-FE-008-functional-review-2026-10-20.md)、[manifest](./manifest.json)、[结果](./review-results.json)、[控制](./control-matrix.json)、[索引](./evidence-index.json)。用户确认后依[规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保存原始答复并核验原候选。下一可执行FE:BFF-FE-010 / A5当前功能复核。
