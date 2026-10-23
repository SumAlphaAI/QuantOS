# UI-201 当前功能完整确认稿

状态 PENDING，唯一确认人为项目用户，Codex 拟稿并记录，不代用户批准。仅确认本轮 I2 UI-201 当前功能及明示本机 reference 组合，不申请 G1/FEP-1、INTEGRATION READY、运行或发布准入，不作为下一 UI-P03 的开发前置。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-201",
    "stage": "INTEGRATION",
    "sourceCommit": "e3776999ad2aee625ec38faee5547a3b6ff9e68a",
    "inputsDigest": "sha256:df0bd8ee51101534c9e05eb31c7f6b7282a452f15001ffbddedaf4486e3e45c8",
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

工程候选 `e3776999ad2aee625ec38faee5547a3b6ff9e68a`，541 输入，摘要 `sha256:df0bd8ee51101534c9e05eb31c7f6b7282a452f15001ffbddedaf4486e3e45c8`，44 产物、12 条命令。参见[工程回执](./receipt.json)、[范围](./scope.json)、[原始执行](./attempt-02/executions.json)、[报告](../../UI-201-current-function-review-2026-10-23.md)。失败工程 7330aa2d / attempt-01 和全部预检记录保留，不拼接为新候选通过。

- Product：交付 `/research`、`/research/new`；列表按服务端分页/筛选/排序；创建包含 capability、snapshot、question、精确预算和 UTC deadline。202 明示受理非完成，并显示 jobId/correlationId/auditRef，可查现有审计页。UI-P03 高保真、UI-202 详情/SSE/取消独立交付，未虚构外部引擎结果。
- Frontend：复用 UI-204/UI-P05 C04、snapshotPolicy 与 route-access；能力和快照选择、字段校验/定位、错误聚焦、双主题与小屏、最大50页/每页200条上限。只有服务端许可且快照未失效才允许当前提交；202后锁定表单，显式新意图才可再次创建。
- BFF：复用现有 C03/C04。只修正 current reference 身份 C01 缺少 research.read/write 的声明；其他身份与 live authorizer 未扩权。24项研究provider测试及新的 reference 构建通过；原 UI-204/UI-P05 证据留在原SHA，245 Rust输入中仅 lib.rs/research_tests.rs 变化，因此本轮有界重建与直接测试，无上游全链重跑。
- QA：同候选122项单测（59项新增UI201、8项既有research网关、55项直接相关快照策略/runtime）、8个Chromium、52项门禁/路由、types/lint/build和客户端88文件扫描通过。8截图与8次axe覆盖两个主题、两个路由、1440/390宽度，零violations。仍有本轮2项 color-contrast incomplete（小屏表头部分位于横向滚动视口外，两个主题各4节点），保留原报告，不声称对比度全面通过。原 P05 六项图标对比度 incomplete 仍保留，二者不互相替代。
- Security：当前身份/capability/CSRF/快照质量、许可与时效在写入前重新核对；422仅将已验证白名单字段映射为安全固定文案，合法关联ID可查审计，不回显内部SQL/路径。未知结果锁定原body/key，只显式重试；并发/改意图拒绝，429有界冷却，410显式刷新。撤权/离线/隐藏/过期清除状态并中断，恢复不重放，所有表单与键仅内存。浏览器验证实际 reference 创建/审计，字段拒绝/延迟/能力收窄等合成故障逐条标记。
- Risk：reference cookie 身份桥、loopback CORS/自签TLS替代；Firefox/WebKit 原阻塞、P05 六项图标 incomplete、历史 ledger 全部 NOT_RUN 均保留。真实身份/CORS、目标数据库/Storage、实际外部provider/引擎、生产host、同SHA远程CI、性能/长稳、人工读屏/原生200%缩放、跨OS与发布仍 NOT_RUN。离开页面丢失未知意图键，必须先查询原任务，不能把新key当恢复；旧deadline/快照过期则拒绝重发。C04标签不授予业务用途许可。

计划 IMPLEMENTED_PENDING_ACCEPTANCE，人工确认仍 PENDING；159阶段 Gate 保持 NOT_ASSESSED，G1/FEP-1 NOT_READY_GAPS_OPEN，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。未使用生产凭据、未推送、未部署。下一原任务 I2 UI-P03 可继续开发。
