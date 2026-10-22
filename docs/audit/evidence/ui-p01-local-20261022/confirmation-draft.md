# FE:UI-P01 / I1 当前页面功能完整确认稿

状态 PENDING。项目用户唯一确认，Codex 记录工程事实，不自行批准；本稿不请求 INTEGRATION READY 或 RELEASE ACCEPTED。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P01",
    "stage": "INTEGRATION",
    "sourceCommit": "5f7aec514f20f1dacbc9d7e6f5580186d3aeca2d",
    "inputsDigest": "sha256:17a0faa963b4503712c214f307d38600511df4e7930d54ac94161d9b9a4b80cd",
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

冻结源码 `5f7aec514f20f1dacbc9d7e6f5580186d3aeca2d`，1001 项输入，摘要 `sha256:17a0faa963b4503712c214f307d38600511df4e7930d54ac94161d9b9a4b80cd`。见[机器回执](./receipt.json)、[原始执行](./function-attempt-03/executions.json)、[报告](../../UI-P01-current-function-review-2026-10-22.md)、[失败与中断历史](./attempt-history.json)。16项直接依赖仅冻结原计划需求引用，不递归执行或授予新候选 READY。

| 维度 | 确认对象与边界 |
|---|---|
| Product | 五页简体中文设计实现：登录、MFA、申请、无权、离线恢复；202只显示受理，申请支持Research/Paper/Shadow；完整英文文案后续完善 |
| Frontend | 同步防重复，断网/卸载取消等待，拒绝外站/敏感参数/认证循环返回路径；MFA键盘与六位填充、失败清码、429期限；双主题、小屏、可展开说明及复制失败恢复 |
| BFF | C01生成类型/schema与限时HTTP transport；响应为受控IdP/BFF边界；并非真实目标后端联调。申请无幂等键，未知结果先核查后明确手动重提，网络恢复不重放 |
| QA | 102项单元/组合、54项Node门禁/边界、26项Chromium/WebKit功能、18项Chromium认证回归、2项视觉用例/10张1440双主题比较；types/lint/构建/秘密扫描/计划校验通过。初始化不作独立视觉验收 |
| Security | 错误账户中性，403/404隐藏资源存在性；关联ID白名单；未知结果/5xx/畸形成功拒绝成功展示；取消客户端等待不代表服务器撤销 |
| Risk | Firefox启动TimeoutError，BLOCKED_ENVIRONMENT；原失败/中断保持。真实IdP/MFA、目标BFF/数据库、人工读屏、原生200%、跨OS视觉、远程同SHA CI、RELEASE为NOT_RUN；formalAccepted=false、runtimeAdmission=DENIED |

20组页面/主题/浏览器axe扫描违规0，incomplete 40项：{"aria-prohibited-attr": 20, "color-contrast": 20}。incomplete原样保存，不自动算人工通过。390px与CSS zoom=2测试不替代原生200%缩放。Codex已查看默认五页代表性双主题截图，视觉基线仅为本机Darwin Chromium同构建比较，不能等同设计方签署或跨平台验收。

浏览器网络状态只作恢复提示，实际会话与权限仍由后续BFF验证；申请未知状态仅保留内存，刷新/新标签页会丢失此提示，重复提交前仍须向组织管理员核查。当前代码与客户端契约组合PASS；计划IMPLEMENTED_PENDING_ACCEPTANCE，INTEGRATION NOT_ASSESSED。未使用生产凭据、未推送、未部署。下一可执行开发任务FE:UI-P02 / I1。
