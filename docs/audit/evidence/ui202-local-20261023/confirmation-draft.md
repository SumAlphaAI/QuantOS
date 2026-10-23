# UI-202 当前功能完整确认稿

状态PENDING；唯一确认人为项目用户，Codex拟稿与核对，不代用户批准。仅确认I2 UI-202当前功能与明示本机reference组合，不申请G1/FEP-1、INTEGRATION READY、运行或发布准入，不作为UI-203开发前置。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-202",
    "stage": "INTEGRATION",
    "sourceCommit": "baf91152e556945ca6e83e6a8363980bd46081c9",
    "inputsDigest": "sha256:744493acfe6172f56df754187fb22f1dc55b8434549564bb80e673fb6eab7409",
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
  ],
  "approver": "ProjectUser",
  "decision": "PENDING"
}
```

工程候选 `baf91152e556945ca6e83e6a8363980bd46081c9`，579输入，摘要 `sha256:744493acfe6172f56df754187fb22f1dc55b8434549564bb80e673fb6eab7409`；48产物、10条命令。见[工程回执](./receipt.json)、[范围](./scope.json)、[原始执行](./attempt-02/executions.json)、[视觉核对](./visual-review.json)、[报告](../../UI-202-current-function-review-2026-10-23.md)。原71e74cc4/attempt-01的124测试通过仅按原范围保留；预检失败均不改写。

- Product：交付实际`/research/:runId`静态UUID深链及`?runId`详情入口；列表/创建受理回执可进入详情。预算/实际成本、状态、快照引用、deadline/创建时间、inputHash、engineVersion、correlationId、auditRef及Artifact/Evidence引用按C03展示，缺少标题/进度/健康/成本不虚构。快照/审计跳到既有页面；Artifact/Evidence详情交给UI-203，高保真交给UI-P04。202取消仅显示cancel_requested，最终状态由GET重读确认。
- Frontend：复用C03网关、UI-201身份读取、route-access和共享SSE。完整UUID入口规范化小写后再作精确资源绑定，拒绝无效/重复/冲突引用。每条有效通知按sequence/eventId去重、迟到丢弃、gap从最后确认afterSequence回补；通知不直接覆盖领域事实，应用后GET重读。暂停/失败可显式恢复，终态停流；只保留最近200通知、最多2000已确认事件，65536字符帧上限、最多5次自动重连，30秒无确认事件暂停。原生取消dialog/Escape/焦点恢复、在途互斥及小屏换行均验证。
- BFF：后端/契约、原gateway/runtime/policy、共享SSE未变。245个Rust输入不变，复用原UI-201工程e3776999 reference二进制，不重建/不重跑Rust或上游全链。实际reference创建/详情/取消/审计关联和原幂等回包复用已测；身份cookie桥、CORS loopback、自签TLS是替代环境。合成duplicate/gap/progress、错误资源、success/failure终态及409/429等逐项标注，不冒充实际研究引擎或目标owner验证。
- QA：同一候选125单测（49本轮+59 UI-201+8网关+9共享SSE直接回归）、13Chromium、66门禁/路由、types/lint/build及88文件客户端检查通过。两主题×1440/390的4截图与4次axe零violations、零新增incomplete；未作UI-P04图像基线比对。原6图标、2表头、12条P03 incomplete仍保留，不因本轮扫描而关闭。原撤权ID去重遗漏已在详情专用reducer修复；静态、夹具/测试及入口缺失原失败保留，最终仅用baf91152/attempt-02通过结果。
- Security：取消前重读C01与C03；research.write/CSRF必需，未知结果只显式重试同任务原幂等键。新受理不伪造终态，409/429不自动重放。撤权通知先验证再终止，即使旧eventId/sequence也不能被吞掉；401/403、离线、隐藏/失焦、scope/MFA/过期沿原持续授权机制清空详情、事件、游标、受理及意图并中断在途请求。恢复只重建读取，不重放取消；所有意图/游标仅内存。取消不会因任务deadline已过而被前端阻止；owner最终裁定当前状态。
- Risk：保留reference身份/CORS/TLS替代边界、Firefox环境阻塞、WebKit附件拦截接收阻塞、原6+2项与12条P03 color-contrast incomplete及历史ledger全部NOT_RUN。12条扫描控件重复，不等于12独立缺陷。人工读屏、原生200%缩放、跨OS、真实IdP/MFA/Cookie/CORS、目标数据库/Storage、实际provider/研究引擎、生产host、远程同SHA CI、性能/长稳/发布仍NOT_RUN。原reference事件响应有限，与目标长连接/owner存在环境差异；断流显示恢复/不可用，详情为最后成功GET，需显式刷新。离开后未知取消key不持久化，应先读原任务/审计；本页确认不授予交易/业务用途。

计划IMPLEMENTED_PENDING_ACCEPTANCE，人工确认PENDING；159阶段Gate保持NOT_ASSESSED，G1/FEP-1 NOT_READY_GAPS_OPEN，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。不将G1辅助项作为开发前置，不重跑上游全链。未使用生产凭据、推送或部署。下一原任务I2 UI-203可继续开发。
