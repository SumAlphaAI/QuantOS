# BFF-FE-010 / A5 完整确认稿

状态：**PENDING_USER_CONFIRMATION**。Codex拟稿，仅项目用户可确认，不自动批准。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:BFF-FE-010",
    "stage": "DEVELOPMENT",
    "sourceCommit": "5d41b7fbdb7453205dec534dd368094cfaabd1a8",
    "inputsDigest": "sha256:329dcc9f1a3cc9699b126188ea8a10a7047fbcc66a9937c0bbf0f6936080b72c",
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

确认范围：冻结源码 `5d41b7fbdb7453205dec534dd368094cfaabd1a8`，1058输入、18组当前功能/直接影响与6实际入口通过；仅授予 **BFF010_SCOPE_LOCAL DEVELOPMENT** 功能范围。BFF008本次原稿已确认，A4、BFF009原确认保持原SHA。七直接前置只核验原回执/输入/日志/产物，不重授当前READY；BFF008独立当前Gate因共享变化撤回NOT_ASSESSED。完整联调、G6/FEP6、运行与发布验收不由本稿替代。

- Product：43个C11/C16接口覆盖health/metrics、incident/timeline/open/ack/resolve、固定安全Runbook、member/role/policy/capability/flag五类完整CRUD，以及alert list/get/ack/unack/subscriptions/SSE。ack不解决来源故障；incident仅新来源已修复后由独立Approver关闭。typed policy仅deny、flags仅四个安全UI名；不提供任意策略表达式或交易安全阈值编辑器。Engine/plugin能力仅批准已签名审核的metadata，不允许浏览器安装/发布Engine。
- Frontend：OpenAPI1.12.0共132操作/110schema，六类生成产物一致；真实生成consumer丢回复以原键恢复，校验authoritative alert事实、scope、ack证据、流租约/去重/gap/撤权。基本Chromium健康/alert/incident读取通过；完整P02/P13/P14/P23页面、全浏览器和G6/FEP6 NOT_RUN。
- BFF：owner显式注入真实X06/F09及F06已验证身份的单账户Paper/Shadow进程租约。有效权限保持F06上限；成员变更下一请求跨页面拒绝旧身份，必须由可信F06来源刷新。五类治理版本/tombstone/引用/最后管理员/本人及同user别名自治理保护。签名Engine review经真实EngineManager验签和tenant绑定；Owner经MFA批准name/version/description精确匹配的能力，未准入/过期/撤销/poison拒绝Research创建。reference在状态锁内、live在同一治理锁下持有工作流事务；无Engine spawn/IPC。
- QA：Rust 48、Node 172、consumer/契约44/7文件通过；43 API共287条当前HTTP，逐项成功/401/403/schema、100次原键恢复与一次F05根；40并发治理唯一回执与1000 native重复。helper26/26行、42/42分支100%；18检查/6入口日志绑定本稿源码。诊断中的编译、fixture、示例、静态失败保留，不算最终PASS，不拼接历史READY。
- Security：CSRF、current身份/权限、版本、recent MFA/reauth caller与期限校验；F09 raw detail/summary/labels/metric value不出页面。只读inspect-health/evidence Runbook重验权限/来源/预检，无shell/改账/任意命令/venue submit。accepted intent有一个F05 auditRef/correlation根；live audit/commit不确定后隔离租约，目标事务回滚/持久恢复未验收。source/metadata密钥扫描仅本地工程证据，不是生产安全验收。未使用生产凭据或外部发布。
- Risk：治理、身份投影、review、回执、游标与SSE为process lease；不是Supabase/F06表写回，不能授予未知身份/超出F06能力。健康来源30秒、Engine审核5分钟、分页/流5分钟；容量上限为边界语义而非性能承诺。真实DB/Auth/MFA/RLS/Storage、治理/审计/outbox持久原子性、跨实例/重启恢复、真实observer来源、Engine远程运行与完整业务联调、性能/容量/长稳/部署/同SHA hosted CI/发布全部NOT_RUN。formalAccepted=false、runtimeAdmission=DENIED。

证据：[报告](../../BFF-FE-010-functional-review-2026-10-18.md)、[manifest](./manifest.json)、[24限定控制](./control-matrix.json)、[结果](./review-results.json)、[变更文件](./changed-files.txt)、[索引](./evidence-index.json)。53,439个原audit/gate文件byte-for-byte保持，见[历史保留](./history-preservation.json)。

建议确认答复：“确认BFF-FE-010完整确认稿，仅确认所列DEVELOPMENT功能范围及未验收边界；不授予新HEAD、上游、完整联调、运行或发布准入。”
