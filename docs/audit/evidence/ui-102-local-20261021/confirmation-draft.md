# FE:UI-102 / I1 当前功能复核完整确认稿

状态：PENDING。项目用户唯一确认，Codex不自行批准。本稿确认当前工程事实与未执行边界，不请求INTEGRATION READY或正式ACCEPTED。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-102",
    "stage": "INTEGRATION",
    "sourceCommit": "fd2f3e64e204c1015af302b49cbb10159475bbfe",
    "inputsDigest": "sha256:87747a1552502a6dd39476e6597002254d4d6578cb1db29389d5819f7a886be0",
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

工程源 `fd2f3e64e204c1015af302b49cbb10159475bbfe`，253项输入，摘要 `sha256:87747a1552502a6dd39476e6597002254d4d6578cb1db29389d5819f7a886be0`。[机器回执](./receipt.json)、[原始执行](./function-attempt-02/executions.json)、[直接前提](./direct-prerequisites.json)、[完整报告](../../UI-102-current-function-review-2026-10-21.md)。15项直接前提仅核验不可变原件，不递归重跑整条依赖链；UI-VIS-000原确认独立保存，不修改其原稿/receipt或授予新输入READY。

| 维度 | 可确认事实与边界 |
|---|---|
| Product | 登录/callback/MFA/申请/403-404/维护/离线恢复覆盖；访问申请202仅受理，维护禁写，恢复不重放旧意图 |
| Frontend | PKCE同步一次消费、10分钟有效期及拒绝清理；URL去参数，返回路径无敏感参数；旧数据需重新登录；迟到响应不能恢复已清空内存身份 |
| BFF | 生成schema验证MFA/reauth/申请；MFA401清理并返回安全登录；真实模式token换服务端204为必要条件；本次实际IdP/BFF响应为受控fixture，真实联调NOT_RUN |
| QA | 最终8组exit0；68单测、16Node测试、31浏览器、1原登录视觉比较；types/lint/build/client秘密静态扫描/计划检查通过；失败批次27通过4定位器失败及4trace保留 |
| Security | 过期/畸形/错误state/无身份拒绝；认证POST各15秒deadline无自动重试；MFA失败清验证码、账户中性文案及429等待；403/404不披露存在性；客户端清理不等于服务端撤销 |
| Risk | 真实IdP/MFA、目标数据库、同SHA远程CI/RELEASE未执行；未用生产凭据、未推送/部署；55,339既有audit/gate路径无修改；INTEGRATION NOT_ASSESSED、formalAccepted=false、runtime DENIED |

5页面axe违规0，10条incomplete（5条aria-prohibited-attr、5条color-contrast）原样保存，不能升级人工通过；实际登录/MFA/网络恢复3张1440截图已由Codex查看。人工读屏、原生200%缩放仍NOT_RUN；390px/CSS zoom=2不替代原生缩放。仅本机Chromium/Darwin登录原基线比较通过，其他浏览器/OS及UI-VIS既有视觉迁移风险保留。真实会话cookie/IdP端点、MFA及撤销持久性未验证；超时写入服务端结果可能未知，必须重新建立身份。

工程功能与受控契约组合PASS，阶段与正式验收不升级。请确认上述事实和未执行边界；确认不代替NOT_RUN义务。下一开发项FE:UI-101 / I1当前功能复核。
