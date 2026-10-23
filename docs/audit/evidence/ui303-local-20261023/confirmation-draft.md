# UI-303 限定当前功能待确认文稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-303",
    "stage": "DEVELOPMENT",
    "sourceCommit": "c1774a744ecc9d4fc90559c9f26f47e44ef91951",
    "inputsDigest": "sha256:f3fbcb39b4df74b7690bb59ed8995425239ab544584dd0184ed7d787e7aa49ea",
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

确认对象：应用、测试与门禁源码 `c1774a744ecc9d4fc90559c9f26f47e44ef91951` 的不可变Release、审批申请与后端目标选择；原始证据为 `docs/audit/evidence/ui303-local-20261023/attempt-01` 与 receipt.json。工程Gate=`PASS_UI303_REFERENCE_FUNCTION`，只接受本机reference当前功能范围，不接受之后HEAD、完整联调或发布。

| 审阅维度 | 限定确认范围 |
| --- | --- |
| Product | 成功回测显式创建不可变候选、Release目录/详情、审批申请与服务端时间线、批准有效期内的后端目标选择；修改须重新回测/创建，不提供编辑Release |
| Frontend | 创建前重读并比较已展示版本/参数/快照/报告/研究证据；无效/泄漏/旧head拒绝；未知创建/申请原键恢复；目录分页、404、只读、撤权与离线恢复；金额字符串保留 |
| BFF | 实际C05/S04创建、C08申请/状态；server-owned draftObjectVersion/backtestRunId/backtestReportHash/evidenceRefs/approvalRef与固定hash齐全；后端allowedTargets无前端回填 |
| QA | 125前端/真实consumer、20门禁/路由、21C05/C08、11Chromium通过；types/lint/format、Rust及Terminal构建/client-secret检查、计划验证通过；4axe扫描0 violations/0 incomplete；预检失败和修复保留 |
| Security | C01/capability/CSRF/版本/有效期守卫；不可变内容/目标不漂移，C08对象/状态/有效期一致且无TradeCommand引用；202不视为批准，独立审批测试控制与产品UI分离，不代用户/业务自批 |
| Risk | 只支持后端批准且未到期Paper/Shadow目标；空/重复/缺失/live/错误拒绝，选择仅页面内存；不部署/交易；后续执行仍需新核权与有效期校验，不代表可生产运行 |

浏览器已查看1440px/390px实际报告与Release，自动无水平溢出、截图/原文JSON/网络摘要保留；这是功能页面审阅，不是UI-P07高保真像素验收。目标选项与后端数组逐项比较；批准后的显示通过另一reference actor执行fixture MFA/reauth/决策验证。控制请求明确control=true，不属于产品UI，不代表真实IdP/MFA/生产权限验收。

原UI302的12条、P06的18条、先前UI301回归12条与原UI301的8条incomplete扫描记录分别保留，不是去重缺陷数，也不以本次零incomplete关闭历史记录。全部真实IdP/MFA/Cookie/CORS、Supabase/RLS/事务/Storage、持久恢复、托管rewrite、Firefox/WebKit、人工读屏/native200%、跨OS、远程同SHA CI、性能/容量/长稳、完整FEP-3/G3联调/发布及P07高保真均NOT_RUN；部署/交易未执行。参考身份cookie与loopback TLS/CORS为显式替代。前端核对服务端绑定，不宣称独立复算Rust canonical内容哈希。

本稿PENDING；项目用户直接确认后仅满足上述限定功能人工确认条件。stage_gate=INTEGRATION/NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。UI302原确认只绑定3f7f37cd/c61e1dc1/e42cdd84，旧原稿/receipt不改写。下一原任务UI-P07。
