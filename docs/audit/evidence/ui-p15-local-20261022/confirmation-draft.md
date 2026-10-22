# FE:UI-P15 / I1 当前页面功能完整确认稿

状态 PENDING。唯一确认人为项目用户，Codex拟稿、核验工程事实与记录，不自行批准。本稿只覆盖当前三页功能范围，不申请联调READY、运行或发布准入。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P15",
    "stage": "INTEGRATION",
    "sourceCommit": "7bb249d86c807503f31b7aa0275882ca28d1be46",
    "inputsDigest": "sha256:5bee572f67989c4526e28b891d316f074ade00296f0152e8ce930dab76203ae6",
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

冻结工程 `7bb249d86c807503f31b7aa0275882ca28d1be46`，1321输入，`sha256:5bee572f67989c4526e28b891d316f074ade00296f0152e8ce930dab76203ae6`；见[机器回执](./receipt.json)、[实际执行](./function-attempt-02/executions.json)、[报告](../../UI-P15-current-function-review-2026-10-22.md)、[全部失败及旧候选历史](./attempt-history.json)。16项前提仅引用原需求，不递归复验或重授READY；后续记录提交不作为新工程接受。

| 审阅维度 | 完整对象与边界 |
|---|---|
| Product | P15三分区资料/区域、通知矩阵/跨午夜静默、MFA/会话/可信设备/安全验证；来自C01/C17受权事实，不填示例业务数值。新增Passkey/恢复码/密码沿用组织身份服务管理，仅明确说明；不宣称该契约外注册或秘密签发已实现 |
| Frontend | 双主题、1440/1024/390、CSS zoom=2、键盘表格内滚和取消焦点、时间/密度/对比度/减少动画预览、分区未保存与重置。资料/区域共用版本，通知独立保存；服务端时区保留，日期按偏好显示，完整英文及所有业务页全局偏好另行完善 |
| BFF | C01顺序守卫，session/context最早有效期；C17白名单/CSRF/If-Match/幂等保存；409显式重读/再存，未知结果保留键与版本，429限时冻结不自动重试。6种actual本机Rust浏览器组合仅种子内存提供者和测试身份/CORS桥接，原响应体转发，安全响应证据仅hash；不等于目标IdP、浏览器Cookie/CORS、数据库或持久撤销 |
| QA | 最终冻结源码16条命令退出0，61单元/组合、61门禁/边界、34 Chromium/WebKit功能、6本机Rust浏览器组合、17直接UI104 BFF、2新视觉和8mock回归通过；types/lint/双profile构建/静态登记/计划通过。8张Darwin Chromium像素比较，初始化不当独立设计签署。36组axe违规0、36项incomplete保留 |
| Security | 角色/邮箱/成员不写入，返回不同member拒绝；当前会话/设备/当前或最后因素保护，精确短语/六位码→security_change→reauth→撤销，202仅受理保留资源/pending，读取核验；独立近期验证不发DELETE、不保留token引用。离线、小屏、无权限、缺CSRF、过期均拒绝，不持久化认证秘密 |
| Risk | Firefox启动超时，BLOCKED_ENVIRONMENT；真实IdP/MFA/新增因素恢复码、目标BFF/数据库/持久撤销、真实Cookie/CORS、原生通知投递、人工读屏、原生200%、跨OS视觉、远程同SHA CI、性能/长稳与RELEASE全部NOT_RUN。INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；原确认范围不提升 |

自动axe incomplete：{'color-contrast': 36}，不代表人工通过；CSS zoom不代替原生缩放。HTTP设置快照无SSE；权限重验依赖刷新/到期/重连，草稿仅页面内存，离开/关闭会丢失。浏览器通知只在明确点击后请求，拒绝不重复；Desktop只是偏好，非投递验收。UI104两张原图和catalog字节保留，本轮回归不提前关闭UI-P17。原d3623b82结果保持原SHA，新CSS候选独立验证；原失败/trace完整保存。没有推送、部署、生产凭据或外部发布动作。计划IMPLEMENTED_PENDING_ACCEPTANCE，尚无本稿用户确认记录。下一可执行FE:UI-P17 / I1。
