# F06 验收 Gate 边界修正

> 日期：2026-09-24。根据 F06 原始任务范围和 Web 前端执行计划，撤销把已部署 Terminal 浏览器入口作为 F06 验收前提的表述。本记录修正此前 F06 复审与续修文档中的验收归属；历史测试结果保持原样。

## 修正结论

F06 交付的是身份、授权、秘密引用与主上下文的服务端基础能力。当前尚无已部署 Terminal，因此真实浏览器登录、实际 `QUANTOS_TERMINAL_ORIGIN`、MFA 页面交互、跨页面撤销流和全部页面 API 的前后端联调不计入 F06 Gate。这些项目由 [Web 前端执行计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)中的 BFF-FE-001、UI-102、页面联调和 G1 承接；其各自的 staging/浏览器验收条件保持有效。

`QUANTOS_TERMINAL_ORIGIN` 仍是独立运行 live BFF 时的服务端 CORS 配置，不能删除其 HTTPS 与精确匹配校验。F06 的 HTTP 烟测通过子进程临时设置明确标记的合成 HTTPS Origin，检查合法请求及错误 Origin 拒绝；这证明服务端边界行为，不声明浏览器验收。

## F06 当前 Gate 范围

| Gate 条件 | F06 处理 |
|---|---|
| 真实 Auth/OIDC 身份到 BFF 服务端会话、成员映射、Primary 上下文与撤销 | 保留；需要目标证据 |
| 缺 tenant/actor、越权 capability、绕过 RLS、Engine 取 secret 四类服务端拒绝 | 保留；同 SHA 目标矩阵 |
| UI、Engine、普通 BFF、用户角色读取 Vault 解密视图/函数的拒绝 | 保留；同 SHA 目标矩阵 |
| Execution Gateway 受控角色与 Vault allowlist 调用 | 保留；目标闭环待验收 |
| 同区域鉴权读 P95 <100ms、开发机跨区域复验 P95 <500ms | 保留；不得用浏览器环境缺失豁免 |
| 已部署 Terminal、真实浏览器 E2E、MFA 页面、全部页面 API | 从 F06 Gate 排除，移交 Web 前端相应 Gate |

仓库的 `make f06-acceptance-gate` 实际脚本从未检查浏览器字段；它检查 `review_status=ACCEPTED`、无 `OPEN` 问题、回执 `sourceCommit=HEAD`，以及 `realOidcBff`、`executionRoleAndVault`、`denialMatrix`、`developerRemoteP95`、`sameRegionP95` 五项 `PASS`。本次同步移除 live BFF 烟测输出中的浏览器/MFA/页面 API `NOT_RUN` 字段，避免把范围外项目误当作 F06 缺口。

## 对现有审计的影响

- [初审报告](./F06-comprehensive-review-2026-09-24.md)的 `3/18` 是当时按原检查清单得到的历史完成统计，不能因本次缩小 Gate 自动改写为新的通过率。F06 仍为 `FIX_VALIDATION`，A01/A08 等问题尚未据此关闭。
- [live 续修](./F06-A01-A08-live-continuation-2026-09-24.md)中的真实 Auth、隔离数据库、9 项 HTTP 烟测、4/4 拒绝和 8/8 Vault 拒绝仍是有效执行记录。其浏览器 `NOT RUN` 是事实，但已不构成 F06 阻塞。
- A01/A08 后续只按 F06 服务端范围取得同一完整 `sourceCommit` 的目标回执并复审。其他 F06 问题，尤其 Execution 真实调用和 P95，继续独立验收；未取得全部五项 `PASS` 前不更新为 `ACCEPTED`。
