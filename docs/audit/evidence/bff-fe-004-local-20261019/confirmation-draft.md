# BFF-FE-004 / A4 完整确认稿（2026-10-19，PENDING）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:BFF-FE-004",
    "stage": "DEVELOPMENT",
    "sourceCommit": "20d65a86efaebccb60abf7cfc896b6a6edd77033",
    "inputsDigest": "sha256:2a797e1cc35d4049d8bc0bb054f9ebf0551a004f7a260d42ff99f4ea04195e93",
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

本稿只覆盖冻结源码 `20d65a86efaebccb60abf7cfc896b6a6edd77033` 的 BFF004_SCOPE_LOCAL 当前本机功能，尚未由用户确认。已确认FE006原稿和全部历史记录不改字节；不扩为当前HEAD、上游、完整联调或发布许可。

Product：C05 Strategy/Draft、static check、Backtest/get/stream、Release/list/get/submit approval/rollback共12项API完成当前功能检查。保留真实S01-S04模块组合、不可变Release及Paper/Shadow目标；rollback仅受理，不执行部署、发布、venue或TradeCommand签发。

Frontend：当前OpenAPI1.12.0/132操作/110schema及六生成产物匹配，本任务只评估12项C05。generated consumer完成版本冲突、真实报告/Artifact、丢回复重试和独立MFA审批。新增captureSave捕获提交修订，saved只更新匹配的后继版本，保留在途新编辑及显式回退编辑；陈旧保存回复和冲突刷新不得回退版本。54项consumer/契约测试通过；Strategy consumer行19/19、分支46/46。基本Chromium通过，完整P06/P07/G3页面尚未验收。

BFF：重复送审的新幂等键仍返回同一审批ID，首次requester/requestedAt/correlationId及timeline不再被后续同工作区写入人重写。同键原响应恢复、不同意图拒绝、CAS、静态失败、快照/版本/参数绑定、独立审批/单次proof/TTL、同策略历史已审批rollback限制有实测。报告Artifact仅由当前可信租约按工作区/能力提供，隔离不回退；默认live缺宿主503。

QA：1032项输入、18/18组及5/5本机门禁入口PASS。Rust104、Node184、consumer/契约54；12 API/1068条实际HTTP，各有成功/401/403/schema，1000次幂等重试、基本Chromium及types/lint/clippy通过。只采用function-attempt-01当前候选证据，没有拼接历史READY；未执行上游Gate、全仓或三轮构建。额外单项probe及编译锁等待保留，不计作性能验收。

Security：服务端Context/tenant/workspace/角色及capability校验保留，浏览器不能注入验证结论、可信源/Artifact、actor、targets或签名对象。独立审批MFA/近期认证、proof复用拒绝、撤权游标与quarantined host均有直接回归。FE006本次用户确认只绑定aad08dd5及2404a7df原稿/回执；其独立当前Gate仍NOT_ASSESSED，不借人工确认重授READY。所有原确认/失败/验收记录保留，当前环境清除数据库和生产凭据。

Risk：回测固定输入/参数/快照及不可变报告，任意代码/未来引用静态拒绝；未经审批、非法target、陈旧/过期、跨资源proof和自审批均拒绝。受理202不能显示为完成，回测事实流与消费者去重/缺口/撤权有实测；继承核心f64指标精度边界，输出字符串不提升计算精度。

九个直接前置仅验证当前消费边界与不可变原参考回执，NOT_REVALIDATED/referenceOnly，不授予独立READY。真实Supabase/Auth/RLS/Storage/F05持久事务、进程/实例重启恢复、可信来源/身份/许可撤权、全页面及完整A4联调、部署、安全/容量/性能/长稳、候选同SHA hosted CI及发布全部NOT_RUN。formalAccepted=false，runtimeAdmission=DENIED。未建本机数据库、未使用生产凭据、未push或部署。

依据[完整报告](../../BFF-FE-004-functional-review-2026-10-19.md)、[manifest](./manifest.json)、[逐组结果和精确命令](./review-results.json)、[控制矩阵](./control-matrix.json)进行确认；当前确认状态PENDING，未代用户批准。
