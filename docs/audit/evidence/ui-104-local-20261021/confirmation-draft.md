# FE:UI-104 / I1 当前功能复核完整确认稿

状态PENDING。依据AGENTS.md及[项目验收规程](../../../gate-records/user-acceptance-confirmation-workflow.md)，唯一项目用户确认，Codex不代用户批准。确认当前工程事实与未执行边界，不申请INTEGRATION READY、正式ACCEPTED或运行准入。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-104",
    "stage": "INTEGRATION",
    "sourceCommit": "ab50c36dc34778b6c9a88ec2bb3ecf2ede504294",
    "inputsDigest": "sha256:78f0aebef2ce48fae2a87462f33620d9e3870d0b374890800c58ae6785ea3056",
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

工程 `ab50c36dc34778b6c9a88ec2bb3ecf2ede504294`，508项输入，摘要 `sha256:78f0aebef2ce48fae2a87462f33620d9e3870d0b374890800c58ae6785ea3056`。[机器回执](./receipt.json)、[12组原始执行](./function-attempt-04/executions.json)、[直接前提](./direct-prerequisites.json)、[完整报告](../../UI-104-current-function-review-2026-10-21.md)、[图审](./visual-review.json)。后续文档提交不改变原工程绑定。

| 维度 | 可确认事实与边界 |
|---|---|
| Product | Profile/通知/安全/浏览器四页当前功能可操作；会话撤销、通知降级、下载说明及小屏高风险隐藏已验证；完整P15/P17与新增身份因素管理独立 |
| Frontend | C01/context先行、分区受权读取、非mock不回退fixture；草稿保留、显式冲突恢复/重读、身份scope绑定、取消/过期；移除假Active/固定数量/实时连接；修复窄屏与checkbox焦点 |
| BFF | 实际C17保存/CAS、security_change MFA→reauth→DELETE及重读；202仅受理不本地删除资源；真实Rust reference两项组合验证通过，仅进程内存状态；浏览器BFF为受控响应边界 |
| QA | 最终12组exit0；69项单测/组合、16项门禁负向、13项mock+17项非mock浏览器；必要BFF构建、types/lint、两配置前端构建通过；两PNG初始化后none比较通过；四页axe零违规，每页7个color-contrast incomplete保留 |
| Security | 实际CSRF/If-Match/稳定幂等键、写体白名单；MFA拒绝不继续，短时引用过期拒绝；当前会话/设备/最后因素保护；401清内存，403/404隐蔽；手势取同源HTTPS有效lease、不保存下载URL；复制失败不冒充成功 |
| Risk | DEVELOPMENT限定工程PASS；INTEGRATION NOT_ASSESSED、formalAccepted=false、runtime DENIED。人工读屏/原生200%、真实IdP/MFA、目标持久数据库、完整联调、远程CI、性能长稳/发布仍NOT_RUN。未用生产凭据、未推送/部署 |

15项直接前提只读核验原件，不递归重跑。UI-101确认绑定原4423badb工程/d78cc56c文稿包，原稿/回执保留；55,530条既有audit/gate路径未改变。当前源码和日志摘要均绑定同一输入。

失败事实：attempt01浏览器9过8败；attempt02为16过1败，确认通知schema passthrough导致元数据遗漏过滤；attempt03自动化通过但图审/axe复核CHANGES_REQUESTED；最终attempt04在新源码修复并通过。原始失败、截图、trace、development日志和各轮视觉before/after均保留。当前Darwin基线初始化不是旧图匹配；其他OS/浏览器尚未迁移，远程CI可能拒绝。人工读屏及原生200%仍NOT_RUN，CSS zoom=2不作替代；axe incomplete不升级人工通过。

未完成：真实IdP/MFA与目标持久撤销、真实浏览器→完整服务业务联调、原生权限OS交互、跨平台视觉、性能长稳/RELEASE、完整P15/P17与G1。上述义务不自动放行。用户确认只收录当前范围，不授予后续HEAD或阶段READY。

请确认上述工程事实与未执行边界。下一开发项为FE:WEB-101 / I1当前功能复核。
