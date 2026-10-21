# FE:WEB-101 / I1 当前功能复核完整确认稿

状态PENDING。依据AGENTS.md及[项目验收规程](../../../gate-records/user-acceptance-confirmation-workflow.md)，唯一项目用户确认，Codex不代用户批准。确认当前工程事实和未执行边界，不申请INTEGRATION READY、正式ACCEPTED或运行准入。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:WEB-101",
    "stage": "INTEGRATION",
    "sourceCommit": "c9ae09bc7c0519b9aed0f5ffb38665ee05fbc693",
    "inputsDigest": "sha256:cc85ce9582033f2127638bd31ff3b4e88f12a7a13af3a1ab4ae10493c21644a6",
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

工程 `c9ae09bc7c0519b9aed0f5ffb38665ee05fbc693`，440项输入，摘要 `sha256:cc85ce9582033f2127638bd31ff3b4e88f12a7a13af3a1ab4ae10493c21644a6`。[机器回执](./receipt.json)、[11组原始执行](./function-attempt-04/executions.json)、[直接前提](./direct-prerequisites.json)、[完整报告](../../WEB-101-current-function-review-2026-10-21.md)、[图审](./visual-review.json)、[七页Lighthouse](./lighthouse-summary.json)。后续文档提交不改绑已测工程SHA。

| 维度 | 可确认事实与边界 |
|---|---|
| Product | 七页导航/文档搜索与空态/SEO/禁用词合规可用；访问申请受理不等于权限开通；登录仅Terminal入口，桌面与完整G1另验 |
| Frontend | 实际匿名C01请求与运行时受理校验；字段/模式/同意/honeypot守卫；同步防重复、锁字段、响应体期限与卸载取消；网络恢复不自动重提；修复ESM构建/窄屏文字与栅格重排/图标 |
| BFF | 实际Rust reference三模式受理、来源及assisted_live拒绝；直接Rust测试核查审计计数。Node测试显式注入reference固定可信Origin3190，浏览器为本站受控响应；不是官网Origin3196→目标BFF完整CORS/持久环境验收 |
| QA | 最终11组exit0，43项单测/组合、18项门禁负向、1项直接Rust公开申请测试、27项浏览器0失败/跳过/flaky；types/lint、单次非mock官网构建和JS/CSS预算通过；七页dark axe零违规、21张截图及CSS zoom重排保存 |
| Security | credentials=omit/no-store/禁止重定向；白名单请求/UUID与受理状态校验；错误不泄漏原message；结果未知不宣称未落库；接口无幂等重放保证，必须先核查再明确重提；公开模式限制Research/Paper/Shadow |
| Risk | DEVELOPMENT限定工程PASS，INTEGRATION NOT_ASSESSED、formalAccepted=false、runtime DENIED。人工读屏/原生200%、真实目标Origin/IdP/DB与完整业务、远程CI/发布均NOT_RUN；未用生产凭据、未推送/部署 |

16项直接前提仅原件引用，不递归重跑；UI-104用户确认绑定ab50c36d工程/507b3a4c文稿包，原稿/receipt保留，人工读屏和原生200%仍NOT_RUN。55,755条既有audit/gate路径字节未改。

Lighthouse12.8.2本机desktop/provided七页Performance/Accessibility/Best-practices/SEO基线均100，完整JSON/HTML及工具版本归档；不是目标环境、真实移动网络或RELEASE性能验收。axe仍有32个color-contrast incomplete节点，不升级人工通过；CSS zoom2不代替原生200%。申请路由193.0KB/200KB首屏预算通过，余量约7KB。

原始失败均保留：attempt01构建FAIL；attempt02浏览器26过1败，发现窄屏重排问题；attempt03自动化PASS但favicon404导致最佳实践96，复核CHANGES_REQUESTED；最终attempt04由新源码完成11组独立验证。开发类型/扫描/工具准备和样式原型失败不抹除，不拿原型/旧SHA拼接最终通过。

交付Git格式检查的原始Lighthouse HTML空白已登记，原字节/摘要保留，仅为本任务HTML新增窄范围.gitattributes豁免；不改绑工程源码或放宽功能校验。

未完成：真实官网Origin/CORS与持久BFF/数据库限速审计、邮件交付、组织IdP、完整业务联调、跨平台完整视觉、人工读屏/原生200%、同SHA远程CI、目标性能长稳和RELEASE；完整P01/P02/P15/P17及G1独立。当前图片仅功能图审输入，不表示全设计签署。

请确认上述工程事实和未执行边界。用户确认只收录当前范围，不授予后续HEAD或阶段READY。下一开发项为FE:UI-P01 / I1当前功能复核。
