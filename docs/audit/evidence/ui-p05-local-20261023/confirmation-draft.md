# UI-P05 当前页面完整确认稿

状态PENDING，唯一确认人为项目用户。Codex拟稿、核对和记录，不代用户批准。本稿只确认I2 UI-P05当前页面功能及明示reference组合，不申请G1/FEP-1、INTEGRATION READY、正式/运行或发布准入，不作为下一UI-201的开发前置。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P05",
    "stage": "INTEGRATION",
    "sourceCommit": "a76cca2194fa341bba3fb2e0883e8b137cb94bbd",
    "inputsDigest": "sha256:f44fa6fb93af95a950b363a1f923f806d3963030fec8a31312b7744bf5b4809f",
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

工程候选 `a76cca2194fa341bba3fb2e0883e8b137cb94bbd`，539项输入，摘要 `sha256:f44fa6fb93af95a950b363a1f923f806d3963030fec8a31312b7744bf5b4809f`，56产物、10命令。见[工程回执](./receipt.json)、[范围](./scope.json)、[执行](./attempt-01/executions.json)、[报告](../../UI-P05-current-page-review-2026-10-23.md)。

- Product：按P05设计的目录表格、右侧详情、质量卡/时间窗/Schema与血缘来源/许可信息、过滤分页、本页统计、双主题与响应式，均取自C04。未合成图示98分、覆盖率、全局42条、OHLCV字段定义、中间血缘步骤或许可Approved。
- Frontend：复用UI-204 runtime/policy/权限恢复；增加键盘标签、关闭焦点恢复、复制失败手动选取、内存两快照对比与白名单元数据下载。对比/下载显式重读C04并复核授权，失效清除且恢复不重放，元数据下载blob URL及时撤销，额外passthrough字段不导出。
- BFF：C04/C01及Rust源码未改，245个Rust输入全部不变；原54ab042b二进制原样复用。UI-204原工程/确认及原证据保持各自SHA；本轮不重跑Rust/上游全链，不以G1辅助项阻断功能开发。
- QA：同候选74项直接单测、13个Chromium、50项门禁/路由通过，types/lint/build与79文件客户端扫描通过；6图（两主题×1672/1024/390）比对通过，6次axe零violations，保留6项color-contrast incomplete（非文本图标）。已知统计区缺role已修复，原incomplete/失败不改写。482字节实际元数据JSON与哈希回执已核对，不代表原始数据集导出。
- Security：原failed/degraded/expired/license_missing等用途阻断不变，后续业务仍需用途/资源授权。撤权发生在元数据读取与发布之间时未交付文件，显式恢复不重放。来源标签/内容哈希仅作事实展示，不代表独立签名或用途许可。
- Risk：reference cookie身份桥/CORS loopback代理替代保留；能力收窄、503、延迟、degraded/expired等合成场景逐条标记。Firefox/WebKit原阻塞及历史ledger全部NOT_RUN保留。真实IdP/MFA、Cookie/CORS、目标数据库、生产托管rewrite、后续业务提交、人工读屏/原生200%缩放、跨OS/设备、远程同SHA CI、性能/长稳与发布仍NOT_RUN，图标对比度待人工核验。

人工确认仍PENDING，计划IMPLEMENTED_PENDING_ACCEPTANCE，全部159阶段Gate均NOT_ASSESSED，G1/FEP-1仍NOT_READY_GAPS_OPEN，formalAccepted=false、runtimeAdmission=DENIED；不把新HEAD或文档提交宣称为新的已验收产品候选。无生产凭据、推送或部署。下一原任务I2 UI-201可继续开发。
