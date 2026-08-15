# UI-104 实施记录

> 阶段：FEP-1（W3–W4）  状态：UI Complete / Contract Mocked  日期：2026-08-15

## 需求拆解与交付

| UI-104 要求 | 可运行交付 | 质量证据 |
|---|---|---|
| Profile 与区域设置 | `/settings/profile`：个人资料、身份托管字段、语言、数字格式、时区、默认页、主题、密度与无障碍偏好 | 生成类型约束；保存反馈不改变角色、权限或风险规则 |
| 通知设置 | `/settings/notifications`：严重性/渠道矩阵、静默时段、Critical 绕过与摘要频率 | 浏览器权限 denied/default/unsupported 均降级至站内通知；不重复请求权限 |
| 安全与 MFA | `/settings/security`：安全评分、MFA、活跃会话、可信设备和安全操作 | 当前会话不可撤销；最后有效因素保护；撤销需要确认短语、六位 MFA、服务端最终校验提示与 correlation ID |
| Web 浏览器能力 | `/settings/browser`：通知、下载、存储、授权深链、兼容性、响应式限制与能力状态 | 权限只由点击触发；下载说明短时签名/过期/审计；Desktop 通过平台 adapter 隐藏 P17 入口 |
| C17 契约 | OpenAPI 1.1.0 additive candidate，13 个 settings/platform operation，生成 client、JSON Schema 与 MSW | 55 operations / 41 schemas 全量生成与覆盖检查通过；页面标识 `Contract Mocked`，不误报 Integrated |
| 多端适配 | 1440 完整态；768–1365 折叠导航/双栏；390 单栏只读；200% 回流 | 小于 768px 隐藏撤销会话/设备等高风险按钮；文档无横向溢出，宽表仅组件内滚动 |

## 架构与安全边界

- 页面只消费 `@sumalpha/api-client` 生成类型；样例数据集中于 `src/settings/fixture.ts`，业务组件不声明页面 DTO。
- `SettingsGateway` 首先调用 `GET /v1/session`，失败时不发起任何 C17 并行请求；写接口携带 `If-Match`、`Idempotency-Key`，撤销接口另携带 `X-Reauth-Token-Ref`。
- 会话撤销在 UI 中只显示“已受理”，最终状态由撤销事件确认；本地不伪造服务端完成状态。
- 浏览器深链只含资源引用，进入后重新鉴权；token、领域秘密与本地敏感缓存不进入 URL 或浏览器存储。
- `shouldExposeBrowserSettings()` 位于 platform adapter；业务组件没有 `isDesktop` 分叉。
- GAP-17 保持 Open：P15/P17 具备同构 Contract Mocked，BFF-FE-001/011 staging 签署及 P16 cache/update/diagnostic 仍待后续阶段。

## 状态与交互验收

- Storybook 注册 default/loading/empty/error/unauthorized/stale/offline 七态，另含 DangerConfirm、BrowserCapabilities、MobileReadonly 与 DesktopHidesBrowserEntry。
- stale/offline 显示快照警告并暂停危险写操作；unauthorized 不渲染隐藏领域数据；error 提供重试与关联 ID 指引。
- 危险确认打开后初始焦点为“取消”；精确确认短语和六位 MFA 都满足前确认按钮保持 disabled。
- 通知拒绝后 Browser 列禁用，In-app 渠道保持可用；下载过期/未完成时按钮禁用并提供可行动原因。
- `/command` 头像入口已链接到 `/settings/profile`，四个设置路由可互相导航。

## 验证证据

- `pnpm --filter @sumalpha/terminal typecheck`：通过。
- `pnpm --filter @sumalpha/terminal test`：9 files / 51 tests 通过，其中 UI-104 5 tests。
- `pnpm --filter @sumalpha/platform test && typecheck`：2 tests 通过。
- `pnpm check:bff-openapi && pnpm generate:bff && pnpm check:bff-generated && pnpm check:bff-contract-coverage`：通过。
- `pnpm test:contract`：8/8 通过。
- `pnpm --filter @sumalpha/ui build-storybook`：通过，UI-104 Story 已纳入静态产物。
- `pnpm --filter @sumalpha/terminal build`：17 个静态页面成功生成，含四个 settings 路由。
- Chromium UI-104 E2E：7/7 通过；Profile/Security/Browser axe 严重与高等级问题为 0；P15/P17 1440 深色视觉基线已生成。
- 内置浏览器 1280px 实测：页面 `scrollWidth === innerWidth`，中等桌面折叠为 64px 主导航和双栏 Browser 网格，控制台无 warning/error。

## 时间节点与后续依赖

- W3：C17 additive candidate、生成物、settings 模型/gateway 与 P15 页面完成。
- W4：P17、平台降级、七态 Story、响应式/200%、单测、axe、E2E、视觉与浏览器验收完成。
- UI-104 可按 `UI Complete / Contract Mocked` 交付；升级为 `Integrated` 前必须完成 BFF-FE-001/011 staging contract/provider verification，并补 P16 所需的 cache/update/diagnostic operation。
