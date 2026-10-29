# CORE:X04 DEVELOPMENT 评审文稿（待用户确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "CORE:X04",
    "stage": "DEVELOPMENT",
    "sourceCommit": "c8f1e7302e6f6075619340490b08e358d774834e",
    "inputsDigest": "sha256:d3f393b6bd9fa6d073a6a323a735ed60ba0f26de759dc8f411f6f06e0a4495ca",
    "reviewDimensions": ["requirements", "implementation", "security", "testing", "usability", "operations"]
  },
  "status": "PENDING_USER_REVIEW",
  "approval": null,
  "selfApproved": false
}
```

确认对象仅为源码 `c8f1e7302e6f6075619340490b08e358d774834e` 的当前原生成交来源与直接影响验证。按[统一确认规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保存待审文稿；用户尚未确认，不自行批准，工程完成不要求先取得正式确认。

需求与产品：接续X02原Subject/Proposal/签名decision，将实际原生Order/逐笔Fill及精确费用提供给公共只读事实、P11和C10。只完成L4-LEDGER-01的X04来源；X01/X05/Alert实际持久闭环保持待办，不以一个来源复制出独立对账。

实现与BFF：原Subject和OMS快照与原Command回执存入同一认证文件事务。按Command派生的只读重放链保留原journal hash，恢复核验实际Order/Fill；公共DTO sourceHash以版本域canonical JSON计算，关联同一C10完成事件。保留原5节点审计链与旧无facts负载；旧无journal回执不反推Fill。hash只关联来源，不代表可信身份或执行权。

安全与风控：当前会话/账户/角色/scope校验继续生效；只读事实不续期审批/命令。UNKNOWN、响应丢失、实际进程死亡和BFF崩溃保留原Command与不确定状态，禁止补发或假定零费用；非报价币费用保留原币且待转换。认证MAC之外还重放校验快照一致性，畸形、错绑、撤权与损坏拒绝。无HTTP导入、无生产凭据、无外部发布。

测试与QA：冻结27项命令达到预期；Rust72、consumer86、contract113、Gate72、Chromium4，零skip。直接OMS回归验证10万事件及Fill溯源，不换算成真实venue笔数。正向浏览器16.118秒，30秒超时、60秒风险TTL与50样本不变。3次axe零violation，但C10 color-contrast有1 incomplete/9节点。6份未冻结失败原件保留；当前冻结attempt-01通过，旧X02全部219文件保持原hash。

前端与可用性：实看P11/C10渲染截图，P11可见同一Command/Order、sourceHash、Fill及0.01 USDT原币费用；C10完成负载可见同一hash/fillIds。当前scope与Subject/decision错绑清除旧快照，scope变化撤权。共享C10壳UNKNOWN/只读提示保留；人工读屏、缩放与全浏览器未执行。

运维：仅single-host认证文件锁/fsync与owner HMAC。异步venue回报、不确定结果真实对账、非报价币换算、X01持久账本/X05独立books/Alert闭环、实际IdP/MFA/资金源/Vault/Supabase/RLS、跨主机、目标安全/P95/负载/长稳/同SHA CI及完整联调发布全部NOT_RUN。原量化标准与19gap/8义务保留OPEN。

工程Gate PASS_NATIVE_ORDER_FILL_PUBLIC_SOURCE；实现 IMPLEMENTED_PENDING_ACCEPTANCE，完整Gate NOT_READY_GAPS_OPEN，stage NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY。下一 CORE:X01 DEVELOPMENT 消费不可变Fill并补齐持久去重、来源绑定、费用精度和UNKNOWN隔离，再交X05/Alert。
