# UI-302 限定当前功能待确认文稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-302",
    "stage": "DEVELOPMENT",
    "sourceCommit": "3f7f37cd1acb20f97962fd9fefcac212eb021eed",
    "toolingCommit": "c61e1dc1e94d05888688bb9e264eb1705290bf81",
    "inputsDigest": "sha256:a82691d0d68ee8c6ab8ea3c616d85a931ccf73507b2f2c1585ae0558287a14c8",
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

确认对象为应用源码 `3f7f37cd1acb20f97962fd9fefcac212eb021eed` 的 UI-302 本机reference功能，采集/门禁工具 `c61e1dc1e94d05888688bb9e264eb1705290bf81`；工程Gate=`PASS_UI302_REFERENCE_FUNCTION`，最终回执 `receipt.json` 绑定完整输入与原始日志。源码、工具、构建和运行时fixture分别记账，不宣称当前HEAD或完整联调/发布已接受。

| 审阅维度 | 本次限定范围 |
| --- | --- |
| Product | 真实静态检查、本会话已受理回测队列、已有UUID任务读取、固定输入报告；C05无全局列表/取消接口，最多25项内存队列 |
| Frontend | 保存与检查版本绑定，编辑失效检查；未知结果同键恢复；报告GET/SSE、gap回放、撤权关闭、无伪进度/收益；功能页面，UI-P07高保真保留后续 |
| BFF | 实际C05/S01/S02适配器，server-owned检查绑定及费用/滑点配置；报告与Artifact同源；snapshot/clock/cost/slippage/input/environment/report hash清晰呈现 |
| QA | 89项前端、19项门禁/路由、20项C05、3项核心专项（含100个泄漏拒绝fixture）、11项Chromium通过；types/lint/format/构建与计划检查通过；采集失败及lint失败完整保留 |
| Security | 写入前重验C01/CSRF/capability与已保存head；幂等未知不换键；只读拒绝、权限失效清内存；错误/畸形/不一致报告不授予Release；不连接生产/数据库 |
| Risk | 泄漏失败、输入缺失、非成功或已知版本变化阻断Release；发布按钮始终禁用至UI-303；报告不构成可部署或交易许可；后续提交须核对当前head与有效期 |

最终14次axe扫描0 violations，保留12条incomplete扫描记录；原P06 18条、先前UI301回归12条及原UI301 8条分别保留，不是去重缺陷数，不视为关闭。

构建/原始功能命令来自 `docs/audit/evidence/ui302-local-20261023/attempt-01`、应用源码 `3f7f37cd1acb20f97962fd9fefcac212eb021eed`；`attempt-01` 的11项浏览器通过但折叠details的innerText采集为空，最终核验拒绝，没有生成PASS回执。`attempt-02` 工具负向测试lint失败。仅修复textContent采集和工具复用核验后在 `docs/audit/evidence/ui302-local-20261023/attempt-03` 重跑lint、19项门禁/路由及11项浏览器；其余原命令/源码/构建摘要逐项核对未变，不虚构重跑。reference fixture来源为实际工具checkout `c61e1dc1e94d05888688bb9e264eb1705290bf81`，binary与Terminal应用构建来源仍为 `3f7f37cd1acb20f97962fd9fefcac212eb021eed`；费用/时钟/环境哈希属于各次真实reference运行，不跨运行改绑。

全部真实IdP/MFA/CORS、Supabase/RLS/事务/Storage、持久化恢复、托管rewrite、Firefox/WebKit、人工读屏/native200%、跨OS、远程同SHA CI、性能/容量/长稳、完整FEP-3/G3联调/发布及P07高保真均NOT_RUN。参考身份cookie和loopback TLS/CORS为测试替代。前端展示并校验服务端绑定，不宣称独立复算Rust canonical报告哈希；扩展字段缺失、版本超JS安全整数保守拒绝。

本稿PENDING；项目用户直接确认后仅满足上述限定功能人工确认条件。stage_gate保持INTEGRATION/NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。UI-P06原确认仅绑定f2854052与0d998c4e，原文及manifest保留于相邻确认包。下一原计划任务UI-303。
