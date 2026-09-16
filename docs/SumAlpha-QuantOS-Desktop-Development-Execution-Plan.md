# SumAlpha QuantOS Desktop 第二期开发执行计划

> 版本：1.0
> 更新时间：2026-09-16
> 状态：第二期范围已拆分，尚未授权启动开发或发布
> 上游：[第一期 Web 前端开发执行计划](./SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)、[网站与终端设计方案](./SumAlpha-QuantOS-Web-and-Terminal-Design.md)、[Terminal 全量前端页面设计规格](./SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)
> 目标：在第一期 Web Terminal 验收稳定后，以同一业务页面、契约和安全语义交付 Tauri Desktop；原生平台能力不得形成第二套业务状态机。

## 1. 阶段定位与启动边界

1. 第一期只交付官网与 `app.sumalpha.ai` Web Terminal；Desktop 不属于第一期发布、测试矩阵或 Gate。
2. 第二期复用第一期 `apps/terminal`、`packages/ui`、`packages/domain-ui`、`packages/api-client` 的业务实现；平台差异只进入 `packages/platform` 与 `apps/terminal-desktop`。
3. 仓库已有 Tauri 壳、深链 PoC、锁文件和历史验证记录，仅作为第二期输入；其存在不代表第二期已授权、已验收或可发布。
4. 启动条件：第一期 Web Gate 完成、C17 Desktop 扩展契约达到 Reviewed、目标 OS/签名策略获批、Desktop owner/QA/Security/SRE 排期确认。
5. 本计划不授权使用生产凭据、签名证书、商店账号、发布通道或外部分发服务；这些动作必须取得独立发布授权。

## 2. 第二期范围

| 产品面 | 第二期交付 | 明确不交付 |
|---|---|---|
| 共享业务页面 | 加载第一期 Web Terminal 的同一业务产物、路由、权限判断、BFF client 与核心旅程 | 独立业务状态机、原生重写业务页、`isDesktop` 业务分叉 |
| P16 Desktop Control Center | 通知、窗口/显示器、文件导入、加密非敏感缓存、更新、诊断 | 本地交易、离线写队列、绕过 BFF 的管理入口 |
| 原生平台能力 | 深链、系统通知、多窗口、布局恢复、本地文件选择、受控下载、诊断包 | 保存 token/venue key、直连数据库/NATS/Engine/Execution Gateway/venue |
| 发布 | macOS/Windows 候选包、manifest、SBOM、签名与受控更新、回滚 | 未签名分发、自动扩大更新比例、无回滚发布 |
| 离线 | 加密的非敏感只读缓存与明确的最后同步时间 | 离线提交、自动重放旧意图、缓存风险结论或可执行命令 |

## 3. 技术与安全决策

| 层 | 选型 | 执行约束 |
|---|---|---|
| Desktop 壳 | Tauri 2 + Rust | 最小 capability；CSP 默认拒绝；只承载平台能力 |
| Webview 内容 | `apps/terminal` 静态产物 | 与 Web 业务构建同源；禁止复制页面或领域 reducer |
| 平台接口 | `packages/platform` | 浏览器和 Tauri 分别实现同一 `PlatformCapabilities`；未知能力默认拒绝 |
| 服务访问 | Gateway/BFF | 不直连内部服务；cookie/短时会话与原生回调方案须经安全评审 |
| 深链 | `quantos://` | 冷/热启动均先白名单消毒，再进入本地重新鉴权页；原始 URL 不进入 Webview |
| 更新 | 签名 manifest + 受控 rollout | 验证签名、版本、渠道和回滚；失败保持旧版本可用 |
| 构建 | Rust/Cargo + Tauri build | Node/pnpm/Rust 和 Cargo/pnpm 锁文件固定；输出 manifest、SBOM、校验和 |

## 4. 第二期工作包

### 4.1 DESK-PRE-01：桌面运行时、环境与测试基线

- 来源：原 PRE-03、PRE-05、PRE-06 中的 Desktop 部分。
- 动作：复核 Tauri/Rust pin、桌面 Cargo lock、`frontendDist`、capability/CSP；建立 desktop-local、desktop-integrated、desktop-staging 配置；建立原生测试与候选包证据格式。
- 产出：Desktop ADR、环境模板、构建/运行说明、测试矩阵、候选包 receipt schema。
- 完成标准：Web 与 Desktop 加载同一业务产物；缺失配置 fail-fast；客户端/诊断包/日志不含 server secret；故意破坏锁文件、capability、CSP 或产物路径会使 CI 失败。

### 4.2 BFF-DESKTOP-001：C17 Desktop 平台能力扩展

- 来源：原 `BFF-FE-011` 的 Desktop 部分。
- 动作：冻结 desktop capabilities、update manifest、diagnostic job/download record、deep-link exchange 与平台降级契约。
- 产出：版本化 OpenAPI、生成 client/schema/MSW、provider/consumer contract、敏感字段负向测试。
- 完成标准：P16 所有服务端字段有 operationId 与 schema；不得返回 token、secret、本地缓存内容或任意命令参数；staging provider/consumer contract 通过后方可 Integrated。

### 4.3 UI-604：Tauri adapter 与平台边界

- task_id 保留：`UI-604`；从第一期 Web 计划迁入第二期。
- 依赖：DESK-PRE-01、BFF-DESKTOP-001、第一期 Web Terminal 已验收业务产物。
- 动作：实现通知、窗口、文件、缓存、更新、诊断、深链平台 adapter；业务组件不得出现 `isDesktop` 分叉。
- 完成标准：平台能力均经 adapter；权限未知、原生调用失败、离线、更新签名失败时 fail closed；深链重新鉴权。

### 4.4 UI-P16：Desktop Control Center

- task_id 保留：`UI-P16`；设计基准：`P16-Desktop-Control-Center-High-Fidelity-v2.png`。
- 路由：`/settings/desktop`；契约：C17 Desktop 扩展与 `PlatformCapabilities`。
- 动作：实现通知、窗口/显示器、文件导入、加密缓存、更新与诊断界面及七态。
- 完成标准：所有能力按服务端/平台 capability 裁剪；无权与不支持能力不可调用；诊断导出脱敏；Web 构建不交付或导航至该入口。

### 4.5 DESK-QA-001：原生与共享旅程验证

- 动作：共享业务 E2E 在 Web/Desktop 运行；增加冷/热深链、系统通知、多窗口/多显示器、布局恢复、离线只读、文件导入、更新/回滚与 200% 缩放场景。
- 目标 OS：macOS 与 Windows 的已批准版本；实际发布支持矩阵在第二期启动时冻结。
- 完成标准：共享 P0 旅程 100% 通过；原生场景无阻断失败；不得以重跑掩盖 flaky；证据绑定候选包 hash、源提交与 OS 版本。

### 4.6 DESK-REL-001：签名候选包与受控更新

- 动作：生成 manifest/SBOM/校验和，完成签名、公证或等价平台要求，演练灰度、失败回滚与旧版本恢复。
- 完成标准：签名/更新验证失败时保持旧版本；更新源不可降级；候选包不含生产 secret；发布和回滚 receipt 可重放。
- 授权边界：没有独立签名和发布授权时只允许本地构建/验证，不得上传、分发或启用更新通道。

## 5. 建议顺序与依赖

`Web 第一期 Done → DESK-PRE-01 → BFF-DESKTOP-001 → UI-604 → UI-P16 → DESK-QA-001 → DESK-REL-001`

第二期不沿用第一期的固定周次。启动评审时根据目标 OS、签名/公证周期、BFF owner 和 QA 设备矩阵重新估算；不得把 Desktop 工作回填到第一期 Web Gate。

## 6. Desktop 测试标准

| 层级 | 覆盖要求 | 阻断标准 |
|---|---|---|
| 边界 | `apps/terminal` 不依赖 Tauri；业务代码无 `isDesktop` 分支 | 任一反向依赖或重复业务实现阻断 |
| Rust/Tauri | capability、CSP、深链消毒、窗口导航、更新签名 | 权限扩大、原始 URL 导航或签名绕过阻断 |
| 契约 | C17 Desktop OpenAPI、错误、权限、诊断/更新字段 | consumer/provider 不一致阻断 Integrated |
| 共享 E2E | 研究、策略、风险审批、订单、审计、对账、运维 | 与 Web 语义或服务端事实不一致阻断 |
| 原生 E2E | 冷/热深链、通知、多窗口、布局、离线、文件、更新/回滚 | 任一 P0 原生旅程失败阻断候选包 |
| 兼容 | 目标 macOS/Windows、200% 缩放、多显示器 | 支持矩阵任一阻断缺陷未关闭则不发布 |
| 安全 | IDOR、CSP、capability、深链、缓存、日志、诊断包、更新供应链 | 高危=0；未豁免中危=0；secret 泄露=0 |

## 7. Desktop Gate

| Gate | 放行条件 | 明确不代表 |
|---|---|---|
| D0 范围/架构 | 第一期 Web 已 Done；目标 OS、owner、预算、签名策略和 adapter 边界冻结 | 已开始实现 |
| D1 契约/环境 | C17 Desktop OpenAPI Reviewed + Mocked；环境 fail-fast；锁文件与 capability Gate 通过 | staging Integrated |
| D2 功能 | UI-604、UI-P16 与共享业务旅程在本地候选包通过 | 已签名/可分发 |
| D3 原生验收 | 目标 OS 原生 E2E、离线、深链、通知、窗口、文件和更新回滚全绿 | 生产发布 |
| D4 发布 | 精确提交与候选包 hash 绑定；签名、SBOM、灰度、监控和回滚 receipt 完整 | 可跳过外部发布授权 |

## 8. 风险与控制

| 风险 | 触发信号 | 控制 |
|---|---|---|
| Web/Desktop 业务分叉 | 出现 `isDesktop` 业务判断或重复页面 | boundary lint、共享 E2E、adapter 评审；拒绝业务 PR 平台分叉 |
| capability 过宽 | capability 增加或 CSP 放宽无 threat model | 最小权限、负向测试、安全签署 |
| 深链绕过鉴权 | 原始 URL/资源参数进入 Webview | Rust 白名单消毒、本地 reauth Gate、401/403/404 fail closed |
| 缓存泄露或离线写 | 缓存包含敏感领域状态或恢复后自动提交 | 只读非敏感 allowlist、加密、TTL、清除与负向扫描 |
| OS 矩阵晚暴露 | macOS/Windows 行为或 Webview 版本差异 | 从 D1 建立夜间矩阵；每个 Gate 保留精确 OS/包 hash 证据 |
| 签名/更新供应链 | 更新源降级、签名失效或回滚不可用 | 固定更新源、签名验证、分批 rollout、旧版恢复演练 |

## 9. 从第一期计划迁移的内容

| 原位置/标识 | 第二期归属 |
|---|---|
| PRE-03 的 Tauri 加载 PoC、双端同产物 smoke | DESK-PRE-01 |
| PRE-05 的 desktop 环境 | DESK-PRE-01 |
| PRE-06 的原生测试基线 | DESK-PRE-01 / DESK-QA-001 |
| BFF-FE-011 的 Desktop capability、update、diagnostic、deep-link 部分 | BFF-DESKTOP-001 |
| FEP-6 的 Desktop/P16 范围 | UI-604 / UI-P16 |
| 原 `UI-604`、`UI-P16` | 保留原 ID，移入本计划 |
| FEP-7 的 Desktop 兼容/安全/全量回归 | DESK-QA-001 |
| FEP-8 与发布清单中的签名更新 | DESK-REL-001 |
| Web/Desktop 分叉、原生 OS CI 风险 | 本计划第 8 节 |

## 10. 第二期发布检查表

- [ ] 第一期 Web Terminal 已完成且共享业务产物版本已冻结。
- [ ] C17 Desktop 契约、生成 client 与 provider/consumer contract 全绿。
- [ ] P16 七态、平台 adapter 和原生权限边界完成。
- [ ] Web/Desktop 共享业务代码和核心 E2E；平台差异只位于允许目录。
- [ ] 深链、通知、多窗口、布局、离线、文件、诊断、更新与回滚在目标 OS 通过。
- [ ] 缓存、日志、URL、诊断包与制品 secret scan 全绿。
- [ ] manifest、SBOM、校验和、签名和候选包 receipt 绑定精确源提交。
- [ ] 灰度、监控、失败回滚与旧版本恢复已演练并归档。
- [ ] 已取得明确的签名、分发和外部发布授权；否则不得发布。
