# CORE-GATE:X3 变更文件

基线 `3868be3f6d20ea48ba9010c1b86f068c19c6cc51` → 源码 `07c867ed3df10bd9ede2c3e54cd6730938ae71d9`。

| 文件 | 内容 |
| --- | --- |
| `apps/terminal/src/reconciliation/runtime.ts` | 权限状态在解析前失效/清理；本地撤权清理；CSRF 轮换拒绝；503 原键恢复 |
| `apps/terminal/tests/x3-provider-consumer.test.ts` | 6 项新增实际 reference consumer 边界和恢复 |
| `docs/SumAlpha-QuantOS-Development-Plan.md` | 同步当前 X3 评估、未决、Gate 与下一 G7；完整清单/阶段未提升 |
| `docs/execution/core-x3-current-assessment.json` | 3 项完整清单均 PARTIAL_GAPS_OPEN，记录当前范围和发布移交 |
| `docs/operations/core-x3-current-assessment.md` | 当前实现、来源分段、28 组范围及 Gate/目标边界 |
| `docs/operations/x3-service-local-admission.md` | CORE X3 用独立当前功能入口，不自动运行旧 SERVICE campaign |
| `package.json` | assess/check/test:x3-current |
| `playwright.config.ts` | 专用 X3 场景排除通用矩阵 |
| `playwright.x3.config.ts` | 专用无重试顺序 Chromium 配置 |
| `scripts/core-x3-review.mjs` | 冻结输入、28 组检查、原生/C15/Web/字节/阶段校验 |
| `scripts/core-x3-review.test.mjs` | 拒绝状态伪提升和虚假来源/回放/关闭 |
| `services/bff-gateway/src/lib.rs` | 仅 cfg(test) 注册当前原生组合模块 |
| `services/bff-gateway/src/x3_current_tests.rs` | 实际原生 Book→C15 handler 来源/金额/Fill/回放/拒绝证据，无生产路由 |
| `services/execution-gateway/tests/x3_service.rs` | 测试 helper clean_chain 以 crate 可见复用，原 5 项行为保留 |
| `tests/e2e/fixtures/x3-reference.ts` | 实际 Shadow reference BFF、显式身份/TLS、响应故障、网络和下载透传 |
| `tests/e2e/ui506.spec.ts` | 当前 P22 文案加服务端 open 核对，实际共享壳/设计 token 主题断言 |
| `tests/e2e/x3-integration.spec.ts` | C15/C14/报表/Audit/安全 Runbook/Admin 同实例段落及撤权清除 |

附加新增证据目录 `docs/audit/evidence/core-x3-local-20261026/`：README、commands、changed-files、待确认验收文稿、开发过程记录、receipt、manifest、verify、4 个 preflight 和 3 个 attempt，保留原始失败/截图/网络/日志。

本地源码提交：

- `07c867ed test(reconciliation): align UI506 status and theme assertions with current P22`
- `9c0d8280 test(x3): scope strict Clippy to current BFF package`
- `b2941988 fix(x3): invalidate reconciliation authority and assess native Web execution loop`

没有创建分支/worktree、推送或外部发布。
