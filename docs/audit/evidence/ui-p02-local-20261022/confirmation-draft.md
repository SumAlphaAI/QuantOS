# FE:UI-P02 / I1 当前页面功能完整确认稿

状态 PENDING。唯一确认人为项目用户，Codex负责拟稿、核对工程事实和记录，不自行批准。本稿只确认下述当前页面功能范围，不请求联调READY、运行准入或发布验收。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P02",
    "stage": "INTEGRATION",
    "sourceCommit": "a2132f51276d6fb802ec0094ab40fba3052fc860",
    "inputsDigest": "sha256:be750de6b01800f7ea5f8b6c674edf2bc55ba651f507b2b21125a498a08fb748",
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

冻结工程 `a2132f51276d6fb802ec0094ab40fba3052fc860`，1311项输入，`sha256:be750de6b01800f7ea5f8b6c674edf2bc55ba651f507b2b21125a498a08fb748`。见[回执](./receipt.json)、[输入及实际执行](./function-attempt-01/)、[报告](../../UI-P02-current-function-review-2026-10-22.md)、[失败与中断历史](./attempt-history.json)。16项前提仅保留原需求引用，不重新授予READY；后续证据提交不作为新源码验收。

| 维度 | 完整审阅对象及边界 |
|---|---|
| Product | `/command` P02简体中文主工作区，优先处理、逐源健康、四类KPI、最近活动、快速入口；BFF提供事实、按权限裁剪，无页面内静态业务数值兜底。研究/策略创建、目标详情页和完整英文文案由后续任务交付 |
| Frontend | 系统深浅主题，1440/1024/390、CSS zoom=2、筛选/列表展开/安全导航/键盘、折叠与紧凑布局/重置、存储失败恢复；仅两个布局布尔值持久化。无契约的搜索/通知数明确禁用，Actor/延迟/可用率保持未知 |
| BFF | C01顺序守卫后消费C02，执行/运维事实由C02聚合C06/C16。账户/mode、来源集合/TTL/时间/哈希、最早租约、partial及对象路径校验。actual Rust reference模块受控组合4身份，只读GET；种子来源及测试身份/CORS桥接，不代替真实IdP、浏览器Cookie/CORS、目标BFF/数据库 |
| QA | 冻结源码16条实际命令全部退出0，76单元/组合、58门禁/边界、38 Chromium/WebKit功能、4本机Rust浏览器组合、14守卫回归、2视觉、7mock回归通过；types/lint/双profile构建/视觉登记/计划校验通过。3张Darwin Chromium像素比较，初始化不作独立设计验收；12组axe违规0、24项incomplete保留 |
| Security | capability只裁剪数据，不创造权限；禁止跨账户/mode与kind/id不匹配路径，过期/未来/畸形拒绝；HTTP只读快照，session/context/summary最早期限清除重验。网络断开禁用资源入口，恢复重验，不自动提交旧意图；目标模块独立鉴权，未声称实时撤权推送 |
| Risk | Firefox启动TimeoutError，功能BLOCKED_ENVIRONMENT。真实IdP/MFA、目标BFF/数据库、真实Cookie/CORS、人工读屏、原生200%、跨OS视觉、远程同SHA CI、性能/容量/长稳、RELEASE均NOT_RUN。INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；原验收边界不提升 |

P02自动axe的incomplete：aria-prohibited-attr 12、color-contrast 12；不等于人工通过。HTTP快照未启用SSE，来源时间标为采样时数据年龄。P01补登记图像保持原字节，原确认包和旧Command原件保留，不改绑为新候选PASS。全部预检失败和环境阻塞保存；本轮不推送或部署、不触碰生产凭据。计划IMPLEMENTED_PENDING_ACCEPTANCE，尚无本稿用户确认记录。下一可执行任务FE:UI-P15 / I1。
